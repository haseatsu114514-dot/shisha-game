// 水入れミニゲーム（試遊）の画面。大会用ボトルのガラス部へ蛇口から注ぎ、目安線にぴったり合わせる。
// 入れすぎたらボトルを傾けてこぼす。判定は実水量だけで行い、波の見た目は判定に使わない。
// 単体ページへも持ち出せるよう、ゲーム本体のモジュールには依存しない（音は options.sound で受け取る）。
import {
  POUR, interior, capacityArea, rotate, rotatedInterior, areaBelow, surfaceY, lip, holdable,
  toMl, levelErrorMm, gradePour, formatError, pickTarget,
} from "./water-pour.js";
import { timingLabel } from "./common.js";

const DEG = Math.PI / 180;
const VIEW = { x: 90, y: -200, w: 1270, h: 1330 }; // 原画座標で見せる範囲
const TABLE_Y = 1070;
const NOZZLE = { x: 637, y: -14 };
const GRAVITY = 9000;
const COLS = 84;
const MAX_TILT = 105 * DEG;

function h(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split(".");
  const node = document.createElement(name || "div");
  if (classes.length) node.className = classes.join(" ");
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

/**
 * panel に水入れミニゲームを置く。
 * @returns {{ root, result: Promise, cancel, decide }}
 */
export function mountWaterPour(panel, {
  bottleSrc = new URL("../../img/ui/making/hookah_base.webp", import.meta.url).href,
  sound = {}, random = Math.random, endless = false, signal,
} = {}) {
  const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const canvas = h("canvas.wpour-canvas", { role: "img", "aria-label": "ボトルのガラス部と蛇口" });
  const stage = h("div.wpour-stage", {}, [canvas]);
  const spilledOut = h("b", { text: "0ml", dataset: { test: "pour-spilled" } });
  const status = h("p.wpour-status", { "aria-live": "polite", text: "目安線まで注ぐ" });
  const pourBtn = h("button.btn.primary.wpour-pour", { type: "button", dataset: { test: "pour-hold" } }, [h("span.btn-label", { text: "注ぐ（長押し）" })]);
  const tiltBtn = h("button.btn.wpour-tilt", { type: "button", dataset: { test: "pour-tilt" } }, [h("span.btn-label", { text: "傾けてこぼす（長押し）" })]);
  const decideBtn = h("button.btn.wpour-decide", { type: "button", dataset: { test: "pour-decide" } }, [h("span.btn-label", { text: "この水位で決める" })]);
  const result = h("div.wpour-result", { "aria-live": "polite", dataset: { test: "pour-result" } });
  result.hidden = true;
  const nextBtn = h("button.btn.primary.wpour-next", { type: "button", dataset: { test: "pour-next" } }, [h("span.btn-label", { text: "次の一本" }), h("span.btn-desc", { text: "目安線の高さが変わる" })]);
  nextBtn.hidden = true;
  const side = h("section.wpour-info", { "aria-label": "水入れ" }, [
    h("div.wpour-head", {}, [h("div", {}, [h("h2", { text: "水入れ" }), h("small", { text: "ガラス部" })])]),
    h("p.wpour-goal", { text: "金の目安線に、水面をぴったり合わせる" }),
    status,
    h("div.wpour-actions", {}, [pourBtn, tiltBtn, decideBtn]),
    h("p.wpour-spilled", {}, ["こぼした水 ", spilledOut]),
    result, nextBtn,
    h("p.wpour-keys", { text: "Space 注ぐ ／ → 傾ける ／ Enter 決める" }),
  ]);
  const root = h("div.wpour", { dataset: { test: "water-pour" } }, [stage, side]);
  panel.append(root);

  const bottle = new Image();
  bottle.decoding = "async";
  bottle.src = bottleSrc;

  // ---- 状態（この画面だけの寿命）
  let target, volume, tilt, tiltVel, slosh, sloshVel, valve, stream, spill, drops, puddle, spilledArea, pours;
  let holdingPour = false, holdingTilt = false, locked = false, judged = null, settleUntil = 0;
  const wave = new Float32Array(COLS), waveVel = new Float32Array(COLS);
  const colX = i => VIEW.x + (i + .5) * VIEW.w / COLS;
  const colOf = x => Math.max(0, Math.min(COLS - 1, Math.floor((x - VIEW.x) / VIEW.w * COLS)));
  function reset() {
    target = pickTarget(random);
    volume = 0; tilt = 0; tiltVel = 0; slosh = 0; sloshVel = 0; valve = 0;
    stream = []; spill = []; drops = []; puddle = []; spilledArea = 0; pours = 0;
    wave.fill(0); waveVel.fill(0);
    locked = false; judged = null;
    result.hidden = true; result.replaceChildren(); nextBtn.hidden = true;
    for (const b of [pourBtn, tiltBtn, decideBtn]) b.disabled = false;
    status.textContent = "目安線まで注ぐ";
    spilledOut.textContent = "0ml";
  }
  reset();

  let resolveResult, rejectResult;
  const done = new Promise((yes, no) => { resolveResult = yes; rejectResult = no; });
  let settled = false;
  let active = true, gradeTimer = 0;

  // ---- 入力。押している間だけ動き、指が外れる・画面が隠れるなどで止める。
  const listeners = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push(() => target.removeEventListener(type, fn, opts)); };
  function setPour(on) {
    on = on && active && !locked;
    if (on && !holdingPour) { pours++; sound.click?.(); }
    holdingPour = on; root.dataset.pour = on ? "on" : "off";
  }
  function setTilt(on) { holdingTilt = on && active && !locked; root.dataset.tilt = holdingTilt ? "on" : "off"; }
  function stopAll() { setPour(false); setTilt(false); }
  for (const [button, set] of [[pourBtn, setPour], [tiltBtn, setTilt]]) {
    listen(button, "pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault(); button.setPointerCapture?.(e.pointerId); set(true);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(button, type, () => set(false));
    listen(button, "contextmenu", e => { e.preventDefault(); set(false); });
    listen(button, "blur", () => set(false));
  }
  const isKey = (e, ...names) => names.includes(e.key) || names.includes(e.code);
  listen(window, "keydown", e => {
    if (!root.isConnected || e.target?.closest?.("input, textarea, select, .bench-guide, .bench-condition")) return;
    if (isKey(e, " ", "Space")) { e.preventDefault(); if (!e.repeat) setPour(true); }
    else if (isKey(e, "ArrowRight", "KeyD")) { e.preventDefault(); if (!e.repeat) setTilt(true); }
    else if (isKey(e, "Enter") && !e.repeat) { e.preventDefault(); (nextBtn.hidden ? decide : next)(); }
  });
  listen(window, "keyup", e => {
    if (isKey(e, " ", "Space")) setPour(false);
    if (isKey(e, "ArrowRight", "KeyD")) setTilt(false);
  });
  listen(window, "blur", stopAll);
  listen(document, "visibilitychange", () => { if (document.hidden) stopAll(); });
  listen(decideBtn, "click", () => decide());
  listen(nextBtn, "click", () => next());
  if (signal) listen(signal, "abort", () => cancel());

  // ---- 物理（見た目と実水量を分けて進める）
  const lipAngleCache = { volume: -1, angle: 0 };
  function spillAngle() {
    // いまの水量がこぼれ始める角度。そこまでは素早く、近づいたらそっと傾ける。
    if (Math.abs(lipAngleCache.volume - volume) < 800) return lipAngleCache.angle;
    let lo = 0, hi = MAX_TILT;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (holdable(mid) > volume) lo = mid; else hi = mid; }
    lipAngleCache.volume = volume; lipAngleCache.angle = lo;
    return lo;
  }
  function surfaceAt(x, base) { return base + slosh * (x - POUR.pivot.x) + wave[colOf(x)]; }
  function kick(x, amount) {
    const i = colOf(x);
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < COLS) waveVel[j] += amount * (1 - Math.abs(k) * .3);
    }
  }
  function splash(x, y, n, spread = 1) {
    if (reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) drops.push({ x, y, vx: (random() - .5) * 520 * spread, vy: -random() * 620 - 120, life: .45 + random() * .3 });
  }

  function step(dt, now) {
    // 蛇口：押している間だけ開く。開け閉めには少し時間がかかる。
    const open = holdingPour ? 1 : 0;
    valve = open ? valve + (1 - valve) * Math.min(1, dt * 5) : Math.max(0, valve - dt * 7);
    if (valve > 0) {
      const amount = POUR.pourRate * valve * valve * dt;
      stream.push({ x: NOZZLE.x + (random() - .5) * 4, y: NOZZLE.y, vy: 260, amount, w: 8 + 14 * valve });
      if (holdingPour && random() < dt * 9) sound.pour?.();
    }
    // 傾き
    const before = tiltVel;
    if (holdingTilt) {
      const careful = tilt > spillAngle() - 4 * DEG;
      tiltVel = (careful ? 10 : 140) * DEG;
      tilt = Math.min(MAX_TILT, tilt + tiltVel * dt);
      if (tilt >= MAX_TILT) tiltVel = 0;
    } else if (tilt > 0) {
      tiltVel = -Math.max(30 * DEG, tilt * 2.6);
      tilt = Math.max(0, tilt + tiltVel * dt);
      if (tilt === 0) tiltVel = 0;
    } else tiltVel = 0;
    // 揺れ：傾きの変化で水面がずれ、ゆっくり落ち着く。
    const damp = now < settleUntil ? 7 : .9;
    // 傾け始め・止めた瞬間に、水が慣性で遅れて片側へ寄る。
    sloshVel -= (tiltVel - before) * (reduced ? .07 : .2);
    sloshVel += (-(5.2 ** 2) * slosh - damp * sloshVel) * dt;
    slosh = Math.max(-.3, Math.min(.3, slosh + sloshVel * dt));
    for (let sub = 0; sub < 3; sub++) {
      const d = dt / 3;
      for (let i = 0; i < COLS; i++) {
        const l = wave[i - 1] ?? wave[i], r = wave[i + 1] ?? wave[i];
        waveVel[i] += (2600 * (l + r - 2 * wave[i]) / 3 - 40 * wave[i] - (damp + .3) * waveVel[i]) * d;
      }
      for (let i = 0; i < COLS; i++) wave[i] = Math.max(-38, Math.min(38, wave[i] + waveVel[i] * d));
    }
    const points = rotatedInterior(tilt);
    const base = surfaceY(volume, tilt, points);
    // 注いだ水：口に入れば水面へ、外れれば卓へ落ちる。
    const l = rotate(POUR.mouth.left, tilt), r = rotate(POUR.mouth.right, tilt);
    const intoMouth = x => x > Math.min(l[0], r[0]) + 12 && x < Math.max(l[0], r[0]) - 12 && Math.min(l[1], r[1]) > NOZZLE.y;
    for (const s of stream) {
      s.vy += GRAVITY * dt; s.y += s.vy * dt;
      if (s.inside === undefined) s.inside = intoMouth(s.x);
      const floor = s.inside ? Math.max(Math.min(l[1], r[1]), surfaceAt(s.x, base)) : TABLE_Y;
      if (s.inside && s.y > Math.min(l[1], r[1]) && !intoMouth(s.x)) s.inside = false; // 途中で口が逃げた
      if (s.y >= floor) {
        s.landed = true;
        if (s.inside) {
          volume = Math.min(capacityArea, volume + s.amount);
          kick(s.x, s.amount * .11 * (reduced ? .35 : 1));
          if (random() < .25) splash(s.x, floor, 1, .5);
        } else {
          spilledArea += s.amount; addPuddle(s.x, s.amount);
          if (random() < .4) splash(s.x, TABLE_Y, 1);
        }
      }
    }
    stream = stream.filter(s => !s.landed);
    // こぼれ：口の低い側の縁より水面が上ならあふれる。揺れていると余計にこぼれる。
    const edge = lip(tilt);
    let excess = volume - holdable(tilt, points);
    if (tilt > 20 * DEG) {
      const rise = base - surfaceAt(edge[0], base); // 縁で水面が持ち上がった分
      if (rise > 0) excess += rise * 120;
    }
    if (excess > 0 && volume > 0) {
      const out = Math.min(volume, excess, Math.max(2500, Math.min(26000, excess * 2.5)) * dt);
      volume -= out;
      const ax = Math.sin(tilt), ay = -Math.cos(tilt);
      spill.push({ x: edge[0] + ax * 10, y: edge[1] + ay * 10, vx: ax * 230 + 60, vy: ay * 230, amount: out, w: 4 + Math.min(14, out / dt / 4000) });
      if (random() < dt * 7) sound.pour?.();
    }
    for (const s of spill) {
      s.vy += GRAVITY * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y >= TABLE_Y) { s.landed = true; spilledArea += s.amount; addPuddle(s.x, s.amount); if (random() < .35) splash(s.x, TABLE_Y, 1); }
    }
    spill = spill.filter(s => !s.landed);
    for (const d of drops) { d.vy += GRAVITY * .6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; }
    drops = drops.filter(d => d.life > 0 && d.y < TABLE_Y + 30);
    spilledOut.textContent = `${Math.round(toMl(spilledArea))}ml`;
    root.dataset.tiltDeg = String(Math.round(tilt / DEG));
    return { points, base };
  }
  function addPuddle(x, amount) {
    const near = puddle.find(p => Math.abs(p.x - x) < 90);
    if (near) { near.x = (near.x * near.a + x * amount) / (near.a + amount); near.a += amount; }
    else puddle.push({ x, a: amount });
  }

  // ---- 描画
  const ctx = canvas.getContext("2d");
  let scale = 1, ox = 0, oy = 0, dpr = 1;
  function fit() {
    // 作業台は画面全体をCSSで拡大縮小するため、配置は拡大前の寸法で決め、解像度だけ実寸に合わせる。
    const w = stage.clientWidth, ht = stage.clientHeight;
    if (!w || !ht) return;
    const shown = stage.getBoundingClientRect().width / w || 1;
    dpr = Math.min(3, (globalThis.devicePixelRatio || 1) * shown);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr);
    canvas.style.width = `${w}px`; canvas.style.height = `${ht}px`;
    scale = Math.min(w / VIEW.w, ht / VIEW.h);
    ox = (w - VIEW.w * scale) / 2 - VIEW.x * scale;
    oy = (ht - VIEW.h * scale) / 2 - VIEW.y * scale;
  }
  const resize = globalThis.ResizeObserver ? new ResizeObserver(fit) : null;
  resize?.observe(stage);
  listen(window, "resize", fit);
  fit();

  function pathOf(points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  function drawTable() {
    const g = ctx.createLinearGradient(0, TABLE_Y, 0, VIEW.y + VIEW.h);
    g.addColorStop(0, "#3a2418"); g.addColorStop(.08, "#24140f"); g.addColorStop(1, "#140b0a");
    ctx.fillStyle = g; ctx.fillRect(VIEW.x - 400, TABLE_Y, VIEW.w + 800, VIEW.h);
    ctx.fillStyle = "#c8894a66"; ctx.fillRect(VIEW.x - 400, TABLE_Y, VIEW.w + 800, 3);
    for (const p of puddle) {
      const rx = Math.min(260, 30 + Math.sqrt(p.a) * .55), ry = Math.min(30, 5 + Math.sqrt(p.a) * .06);
      const pg = ctx.createRadialGradient(p.x, TABLE_Y + 12, 2, p.x, TABLE_Y + 12, rx);
      pg.addColorStop(0, "#8fe3f066"); pg.addColorStop(.7, "#4ab0c844"); pg.addColorStop(1, "#4ab0c800");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.ellipse(p.x, TABLE_Y + 12, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawFaucet() {
    const brass = ctx.createLinearGradient(0, -170, 0, -78);
    brass.addColorStop(0, "#f6d48a"); brass.addColorStop(.45, "#c98a3c"); brass.addColorStop(1, "#6b3a1c");
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#2a160d"; ctx.lineWidth = 62;
    ctx.beginPath(); ctx.moveTo(VIEW.x - 40, -122); ctx.lineTo(560, -122); ctx.quadraticCurveTo(NOZZLE.x, -122, NOZZLE.x, -40); ctx.stroke();
    ctx.strokeStyle = brass; ctx.lineWidth = 50; ctx.stroke();
    ctx.strokeStyle = "#fff3c455"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(VIEW.x - 40, -136); ctx.lineTo(556, -136); ctx.stroke();
    // 吐水口
    ctx.fillStyle = "#2a160d"; ctx.fillRect(NOZZLE.x - 34, -46, 68, 34);
    ctx.fillStyle = "#b07434"; ctx.fillRect(NOZZLE.x - 30, -44, 60, 28);
    ctx.fillStyle = "#4a2a16"; ctx.fillRect(NOZZLE.x - 22, -18, 44, 6);
    // ハンドル：開いた分だけ回る
    ctx.save(); ctx.translate(330, -168); ctx.rotate(valve * 1.4);
    ctx.fillStyle = "#2a160d"; ctx.fillRect(-60, -13, 120, 26); ctx.fillRect(-13, -50, 26, 100);
    ctx.fillStyle = "#e0a85a"; ctx.fillRect(-56, -9, 112, 18); ctx.fillRect(-9, -46, 18, 92);
    ctx.fillStyle = "#fff0c0"; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#6b3a1c"; ctx.fillRect(318, -156, 24, 36);
  }
  function drawStream(list, color) {
    ctx.lineCap = "round"; ctx.strokeStyle = color;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 120) continue;
      ctx.lineWidth = (a.w + b.w) / 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  function drawWater(points, base) {
    if (volume <= 0) return;
    ctx.save();
    pathOf(points); ctx.clip();
    const x0 = VIEW.x - 200, x1 = VIEW.x + VIEW.w + 200;
    const surface = [];
    for (let i = -1; i <= COLS; i++) {
      const x = i < 0 ? x0 : i === COLS ? x1 : colX(i);
      surface.push([x, surfaceAt(x, base)]);
    }
    const g = ctx.createLinearGradient(0, base - 40, 0, base + 520);
    g.addColorStop(0, "#9eeaf2b0"); g.addColorStop(.18, "#5fc4dc90"); g.addColorStop(1, "#2a6f9c99");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0, 2400);
    for (const [x, y] of surface) ctx.lineTo(x, y);
    ctx.lineTo(x1, 2400); ctx.closePath(); ctx.fill();
    // 水面のきらめき
    ctx.strokeStyle = "#e9fdffee"; ctx.lineWidth = 7;
    ctx.beginPath(); surface.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 16;
    ctx.beginPath(); surface.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 14) : ctx.moveTo(x, y + 14))); ctx.stroke();
    ctx.restore();
  }
  function drawTargetLine() {
    // ガラスに引いた目安線（ボトルと一緒に傾く）
    const row = interiorSpan(target);
    if (!row) return;
    const [left, right] = row;
    ctx.save();
    ctx.strokeStyle = "#1a0f08"; ctx.lineWidth = 11; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(left - 22, target); ctx.lineTo(right + 22, target); ctx.stroke();
    ctx.strokeStyle = "#ffd977"; ctx.lineWidth = 6; ctx.setLineDash([34, 18]);
    ctx.beginPath(); ctx.moveTo(left - 22, target); ctx.lineTo(right + 22, target); ctx.stroke();
    ctx.setLineDash([]);
    // 右端の目盛り
    ctx.fillStyle = "#ffd977";
    ctx.beginPath(); ctx.moveTo(right + 34, target); ctx.lineTo(right + 70, target - 20); ctx.lineTo(right + 70, target + 20); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function interiorSpan(y) {
    let left = Infinity, right = -Infinity;
    for (let i = 0; i < interior.length; i++) {
      const a = interior[i], b = interior[(i + 1) % interior.length];
      if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
      const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
      left = Math.min(left, x); right = Math.max(right, x);
    }
    return left < right ? [left, right] : null;
  }
  function draw(points, base) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    drawTable();
    // ボトル（ガラス部）
    ctx.save();
    ctx.translate(POUR.pivot.x, POUR.pivot.y); ctx.rotate(tilt); ctx.translate(-POUR.pivot.x, -POUR.pivot.y);
    if (bottle.complete && bottle.naturalWidth) ctx.drawImage(bottle, 0, 0, POUR.image.w, POUR.image.h);
    else { ctx.fillStyle = "#4a2b55"; pathOf(interior); ctx.fill(); }
    ctx.restore();
    drawWater(points, base);
    ctx.save();
    ctx.translate(POUR.pivot.x, POUR.pivot.y); ctx.rotate(tilt); ctx.translate(-POUR.pivot.x, -POUR.pivot.y);
    drawTargetLine();
    // ガラスの映り込み
    ctx.fillStyle = "#ffffff1c"; ctx.fillRect(560, 170, 26, 330);
    ctx.fillStyle = "#ffffff12"; ctx.beginPath(); ctx.ellipse(400, 720, 22, 120, .25, 0, Math.PI * 2); ctx.fill();
    if (judged) {
      // 確定した実水位（白）
      const y = surfaceY(volume, 0), row = interiorSpan(y);
      if (row) {
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(row[0] - 30, y); ctx.lineTo(row[1] + 30, y); ctx.stroke();
      }
    }
    ctx.restore();
    drawStream(stream, "#bff4fbdd");
    drawStream(spill, "#9fe6f2cc");
    ctx.fillStyle = "#d8faffcc";
    for (const d of drops) ctx.fillRect(d.x - 5, d.y - 5, 10, 10);
    drawFaucet();
  }

  // ---- 判定
  function decide() {
    if (!active || locked) return;
    locked = true; stopAll();
    for (const b of [pourBtn, tiltBtn, decideBtn]) b.disabled = true;
    status.textContent = "水面が落ち着くのを待つ…";
    const wait = () => {
      if (!active || !root.isConnected) return;
      if (stream.length || spill.length || tilt > 0) { gradeTimer = setTimeout(wait, 60); return; }
      settleUntil = performance.now() + 900;
      gradeTimer = setTimeout(reveal, 900);
    };
    wait();
  }
  function reveal() {
    if (!active || !root.isConnected) return;
    const errorMm = levelErrorMm(volume, target);
    const grade = gradePour(errorMm);
    judged = {
      grade: grade.kind, label: grade.label, errorMm,
      ml: Math.round(toMl(volume)), targetMl: Math.round(toMl(areaBelow(interior, target))),
      spilledMl: Math.round(toMl(spilledArea)), pours,
    };
    status.textContent = "";
    const stampText = timingLabel(grade.kind);
    result.replaceChildren(
      h(`b.wpour-stamp.${grade.kind}`, { text: stampText }),
      h("p.wpour-grade", { text: `${grade.label}　目安線から ${formatError(errorMm)}` }),
      h("small", { text: `水 ${judged.ml}ml（目安 ${judged.targetMl}ml）・注いだ回数 ${pours}` }),
    );
    result.hidden = false;
    (grade.kind === "perfect" ? sound.perfect : grade.kind === "miss" ? sound.miss : sound.good)?.();
    root.dataset.grade = grade.kind;
    if (!settled) { settled = true; resolveResult(judged); }
    if (endless) nextBtn.hidden = false;
  }
  function next() {
    if (!active || !judged || !endless) return;
    delete root.dataset.grade;
    reset();
    sound.select?.();
  }

  // ---- ループ
  let raf = 0, last = performance.now();
  function frame(now) {
    if (!active) return;
    if (!root.isConnected) { cancel(); return; }
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000)); last = now;
    const { points, base } = step(dt, now);
    draw(points, base);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function cleanup() {
    clearTimeout(gradeTimer); gradeTimer = 0;
    cancelAnimationFrame(raf); resize?.disconnect();
    for (const remove of listeners) remove();
  }
  function cancel() {
    if (!active) return;
    active = false;
    stopAll(); cleanup();
    if (!settled) { settled = true; rejectResult(new DOMException("Water pour interrupted", "AbortError")); }
  }
  // テスト・確認用の読み取り口（判定値には影響しない）
  const debug = {
    get volume() { return volume; }, set volume(v) { volume = Math.max(0, Math.min(capacityArea, v)); },
    get target() { return target; }, set target(y) { target = y; },
    get tilt() { return tilt; }, get spilledArea() { return spilledArea; },
    get waveAmp() { let m = 0; for (const v of wave) m = Math.max(m, Math.abs(v)); return m + Math.abs(slosh) * 300; },
  };
  if (signal?.aborted) cancel();
  return { root, result: done, cancel, decide, debug };
}
