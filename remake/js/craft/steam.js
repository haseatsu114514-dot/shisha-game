// 蒸らし ── 雑念を躱す（CLAUDE.md: 蒸らしミニゲームは雑念弾幕。「覚悟＋締め」には戻さない）
// 選んだ蒸らし時間のあいだ、飛んでくる雑念（言葉の弾）を心(♥)で避け続ける。被弾が少ないほど良い。
import { el, sleep, clamp, rand, pick } from "../core/util.js";
import { countdown, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { tier01 } from "../core/stats.js";
import { stepPanel, refreshRig, benchRig } from "./session.js";
import { autoSkill, resultCard, keys, popStamp } from "./common.js";
import { craftConditions } from "./conditions.js";
import { craftCondition } from "../core/condition.js";

export const DODGE_WORDS = [
  "手元、見られてる……", "時間が足りないかも", "隣の煙、もう上がってる",
  "失敗したらどうしよう", "パッキーの野次", "審査員の視線", "炭、熾きてたかな",
  "詰めすぎたか？", "灰、落ちないか", "客の咳ばらい", "温度、大丈夫か",
  "香り、飛んでないか", "手が、汗ばむ", "時計の秒針", "深呼吸、わすれてた",
  "ボウル、熱いな", "煙、薄い気がする", "スミさんなら…", "隣のジャスト音",
];
// 分数 → 実際に避ける秒数。長く待つほど後半の横なぎを多く受ける。
const DURATION = { 3: 9, 5: 12, 8: 16, 10: 20 };
const OBJECTS = ["coal", "clock", "spark", "smoke"];

export async function runSteamDodge(cs) {
  const tutorial = cs.mode === "tutorial";
  const min = cs.steamMin || 5;
  const rainy = craftConditions(cs).rainy;
  const panel = stepPanel("steam", `蒸らし ── ${min}分${rainy ? "（雨：熱が入りづらい）" : ""}`,
    "心を動かして雑念を躱す。下のパッド／矢印キーで移動。リフレッシュ（Space）で弾を一掃、2回まで");
  const W = 620, H = 300;
  const box = el("div.dodge", { style: { width: `${W}px`, height: `${H}px` }, dataset: { test: "dodge" } });
  const heart = el("div.dodge-heart", { role: "img", "aria-label": "心。中央の光が当たり判定", style: { transform: `translate(${W / 2 - 14}px, ${H / 2 - 14}px)` } }, [el("i.dodge-core")]);
  const timer = el("div.dodge-timer");
  const hitsEl = el("div.dodge-hits");
  const waveEl = el("div.dodge-wave", { text: "集中", "aria-live": "polite" });
  const knob = el("i.dodge-knob");
  const pad = el("div.dodge-pad", { tabindex: 0, role: "group", "aria-label": "移動パッド。ドラッグまたは矢印キーで移動", dataset: { test: "dodge-pad" } }, [el("span", { text: "✥", "aria-hidden": "true" }), knob]);
  const refreshBtn = el("button.btn.primary.dodge-refresh", { disabled: true, dataset: { test: "dodge-refresh" } });
  box.append(heart);
  panel.append(el("div.steam", [
    el("div.dodge-hud", [timer, waveEl, hitsEl]), box,
    el("div.dodge-controls", [pad, el("div.dodge-actions", [refreshBtn, el("small", { text: "パッドで移動 ／ PCは矢印・WASD" })])]),
  ]));
  benchRig()?.bubble(true);

  const dur = DURATION[min] * (tutorial ? 0.7 : 1);
  const focus = craftCondition(cs).focus;
  const hitR = 8 * (1 - 0.2 * tier01("guts")) / focus;
  const spawnEvery = (tutorial ? 0.85 : 0.46) * (1 + 0.25 * tier01("insight")) * focus;
  let hx = W / 2, hy = H / 2, hits = 0, inv = 0, refreshes = 2;
  let running = false, time = 0, nextSpawn = 0.8, nextWave = tutorial ? 4 : 2.8;
  let warning = null, spawnCount = 0, raf = 0;
  const bullets = [], keysDown = new Set();
  const input = new AbortController();
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: input.signal });
  let padPointer = null, axisX = 0, axisY = 0;

  const renderHeart = () => { heart.style.transform = `translate(${hx - 14}px, ${hy - 14}px)`; };
  const moveTo = (x, y) => { hx = clamp(x, 14, W - 14); hy = clamp(y, 14, H - 14); renderHeart(); };
  const toLocal = (e) => {
    const r = box.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  };
  listen(box, "pointerdown", (e) => {
    if (!running) return;
    e.preventDefault(); box.setPointerCapture(e.pointerId); moveTo(...toLocal(e));
  });
  listen(box, "pointermove", (e) => { if (running && (e.buttons || e.pointerType === "mouse")) moveTo(...toLocal(e)); });

  const movePad = (e) => {
    const r = pad.getBoundingClientRect(), radius = r.width * 0.34;
    let x = (e.clientX - r.left - r.width / 2) / radius;
    let y = (e.clientY - r.top - r.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    axisX = Math.abs(x) < 0.12 ? 0 : x;
    axisY = Math.abs(y) < 0.12 ? 0 : y;
    knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
  };
  const resetPad = () => { padPointer = null; axisX = axisY = 0; knob.style.transform = ""; pad.classList.remove("held"); };
  listen(pad, "pointerdown", (e) => {
    if (!running || padPointer !== null) return;
    e.preventDefault(); padPointer = e.pointerId; pad.setPointerCapture(e.pointerId); pad.classList.add("held"); movePad(e);
  });
  listen(pad, "pointermove", (e) => { if (e.pointerId === padPointer) movePad(e); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(pad, type, (e) => { if (e.pointerId === padPointer) resetPad(); });
  listen(window, "blur", () => { keysDown.clear(); resetPad(); });

  const clearBullets = () => { bullets.splice(0).forEach((b) => b.node.remove()); };
  const refreshLabel = () => { refreshBtn.textContent = `リフレッシュ ×${refreshes}（Space）`; refreshBtn.disabled = !running || refreshes === 0; };
  const refresh = () => {
    if (!running || refreshes === 0) return;
    refreshes--; clearBullets(); warning = null; inv = 1.5;
    nextSpawn = time + 0.8; nextWave = Math.max(nextWave, time + 1.5);
    box.classList.remove("warning"); waveEl.textContent = "深呼吸";
    const fx = el("div.dodge-refresh-fx", { "aria-hidden": "true", style: { "--x": `${hx}px`, "--y": `${hy}px` } }, [
      el("i.dr-flash"), el("i.dr-ring"), el("i.dr-ring.second"),
      ...Array.from({ length: 8 }, (_, i) => el("i.dr-ray", { style: { "--angle": `${i * 45}deg` } })),
      el("b", { text: "リフレッシュ" }),
    ]);
    box.append(fx); setTimeout(() => fx.remove(), 950);
    SE.whoosh(); SE.just(); refreshLabel();
  };
  listen(refreshBtn, "pointerdown", (e) => { e.preventDefault(); refresh(); });
  // キーボードや支援技術による click でも使える（pointerdown と重ねて消費しない）。
  listen(refreshBtn, "click", (e) => { if (e.detail === 0) refresh(); });
  const direction = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d" };
  const unkey = keys(Object.fromEntries([
    ...Object.entries(direction).map(([key, value]) => [key, () => { if (running) keysDown.add(value); }]),
    [" ", (e) => { if (!e.repeat) refresh(); }],
  ]));
  listen(window, "keyup", (e) => keysDown.delete(direction[e.key]));

  const addBullet = (type, x, y, angle, speed) => {
    if (bullets.length >= 90) return;
    const word = type === "word";
    const node = el(word ? "div.dodge-word" : `div.dodge-object.${type}`, word ? { text: pick(DODGE_WORDS) } : { "aria-hidden": "true" });
    box.append(node);
    // 実際の書体とサイズで判定する。長い言葉の見えない先端に当たらないように。
    const w = node.offsetWidth, h = node.offsetHeight;
    x -= w / 2; y -= h / 2;
    node.style.transform = `translate(${x}px, ${y}px)`;
    bullets.push({ node, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w, h });
  };
  const spawn = () => {
    const side = Math.floor(rand(0, 4));
    const x = side === 0 ? -24 : side === 1 ? W + 24 : rand(20, W - 20);
    const y = side === 2 ? -24 : side === 3 ? H + 24 : rand(20, H - 20);
    const angle = Math.atan2(hy - y, hx - x), speed = rand(140, 190) * (tutorial ? 0.7 : 1);
    const isWord = spawnCount++ % 3 === 0;
    if (isWord) addBullet("word", x, y, angle, speed * 0.8);
    else {
      const count = tutorial ? 2 : time > dur * 0.5 ? 5 : 3;
      const type = pick(OBJECTS);
      for (let i = 0; i < count; i++) addBullet(type, x, y, angle + (i - (count - 1) / 2) * 0.24, speed);
    }
  };
  const launchWave = ({ side, gap }) => {
    const lanes = 9;
    for (let i = 0; i < lanes; i++) {
      if (Math.abs(i - gap) <= 1) continue; // 予告を見て移動できる広さの安全な通り道
      addBullet(i % 2 ? "spark" : "coal", side ? W + 20 : -20, (i + 0.5) * H / lanes, side ? Math.PI : 0, tutorial ? 140 : 205);
    }
    box.classList.remove("warning"); waveEl.textContent = "横なぎ！ 隙間を探そう";
  };

  timer.textContent = `残り ${min} 分`; hitsEl.textContent = "集中できている"; refreshLabel();
  await countdown();
  running = true; refreshLabel();
  const auto = autoSkill();
  try {
    if (auto) { await sleep(200); hits = auto === "good" ? 0 : 4; }
    else await new Promise((resolve) => {
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
        let x = axisX + (keysDown.has("r") ? 1 : 0) - (keysDown.has("l") ? 1 : 0);
        let y = axisY + (keysDown.has("d") ? 1 : 0) - (keysDown.has("u") ? 1 : 0);
        const length = Math.max(1, Math.hypot(x, y));
        moveTo(hx + x / length * 290 * dt, hy + y / length * 290 * dt);
        if (time >= nextSpawn && time < dur - 0.8) { spawn(); nextSpawn = time + spawnEvery * rand(0.8, 1.15) * (1 - 0.2 * time / dur); }
        if (time >= nextWave && time < dur - 2) {
          warning = { side: Math.round(rand(0, 1)), gap: Math.floor(rand(2, 7)), due: time + 0.75 };
          waveEl.textContent = warning.side ? "右から横なぎ ▶" : "◀ 左から横なぎ";
          box.classList.add("warning"); box.dataset.side = warning.side ? "right" : "left";
          nextWave = time + (tutorial ? 4 : 2.8);
        }
        if (warning && time >= warning.due) { launchWave(warning); warning = null; }
        inv = Math.max(0, inv - dt); heart.classList.toggle("shield", inv > 0);
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
          b.node.style.transform = `translate(${b.x}px, ${b.y}px)`;
          const cx = clamp(hx, b.x, b.x + b.w), cy = clamp(hy, b.y, b.y + b.h);
          if (!inv && (hx - cx) ** 2 + (hy - cy) ** 2 < hitR * hitR) {
            hits++; inv = 0.9;
            heart.classList.remove("hit"); void heart.offsetWidth; heart.classList.add("hit");
            SE.hit(); shake(box, 180);
            b.node.remove(); bullets.splice(i, 1); continue;
          }
          if (b.x + b.w < -60 || b.x > W + 60 || b.y + b.h < -60 || b.y > H + 60) { b.node.remove(); bullets.splice(i, 1); }
        }
        timer.textContent = `残り ${Math.max(0, Math.ceil((dur - time) * min / dur))} 分`;
        hitsEl.textContent = hits ? `雑念に呑まれた ×${hits}` : "集中できている";
        if (time >= dur) return resolve();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
  } finally {
    running = false; cancelAnimationFrame(raf); unkey(); input.abort(); resetPad(); clearBullets(); refreshLabel();
    heart.classList.remove("shield"); box.classList.remove("warning");
  }
  const score = clamp(100 - hits * 14, 0, 100);
  cs.steam = { min, hits, score, refreshesUsed: 2 - refreshes, warmingFactor: rainy ? 0.85 : 1 };
  refreshRig();
  popStamp(panel, hits === 0 ? "無心" : hits <= 2 ? "持ちこたえた" : "雑念まみれ", hits === 0 ? "just" : hits <= 2 ? "good" : "bad", "50%", "40%");
  await sleep(400);
  await resultCard(panel, {
    title: "蒸らし 結果",
    lines: [
      rainy ? "雨の日は熱の立ち上がりが少し遅い。吸い出しで温度を確かめよう" : "",
      `${min}分蒸らした。${hits === 0 ? "最後まで一度も揺れなかった" : `雑念に${hits}回つかまった`}`,
      min >= 8 ? "じっくり待った分、熱が入り、吸い出しに余裕ができる" : min <= 3 ? "早めの立ち上げ。温度合わせは忙しくなる" : "香りの輪郭を残した。吸い出しでしっかり熱を入れよう",
    ],
  });
}
