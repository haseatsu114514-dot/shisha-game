// 背景の読み込みを覆う、夜の紫とラベンダーのモーショングラフィックス。
// 場面の意味ごとの型: 標準の切り替え＝一筆（#2688 F1）／就寝から翌朝＝波＋めくり（CI102）／マップから場所への移動（transition-moves.js・CI103）。
// 型の一覧と残りの場面の案は asset_sources/transitions/scene-plan-20261009/README.md。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";
import { W, H, COLOR, EASE, reducedMotion, svg, stageSvg, move, holdKeys } from "./transition-kit.js";
import { moveCurtain, moveStyle } from "./transition-moves.js";
import { state, config } from "./state.js";
import { createEntrySound } from "./entry-sound.js";
import { withStoreArrival } from "./store-arrival.js";

// 全面を覆う型の数。覆っている間の背景切り替えは、別の幕を出さずに差し替える（ui.setBg）
let covering = 0;
export const isCovering = () => covering > 0;
export function holdCover() {
  covering++;
  const release = holdKeys();
  let done = false;
  return () => { if (done) return; done = true; covering--; release(); };
}

// 次の背景切り替えで使う型の予約。マップで押したピンの位置や行き先の名前を渡す。古い予約は使わない
let cue = null;
export function cueTransition(kind, opts = {}) {
  cue = { kind, opts, at: performance.now() };
}
/** 入店前の体力確認などで待った場合も、同じ行き先の予約を実際の入店に使う。 */
export function refreshPlaceCue(spotId) {
  if (cue?.kind === "place" && cue.opts.spotId === spotId) cue.at = performance.now();
}
/** 入店前に街へ戻った場合は、その店の入店演出を次の移動へ持ち越さない。 */
export function cancelPlaceCue(spotId) {
  if (cue?.kind === "place" && cue.opts.spotId === spotId) cue = null;
}
function takeCue() {
  const c = cue;
  cue = null;
  return c && performance.now() - c.at < 3000 ? c : null;
}

export function takeSceneArrival() {
  const cued = takeCue();
  return { cued, commitArrival: createEntrySound(cued?.kind === "place" ? cued.opts : null, state?.chapter, () => SE.doorbell()) };
}

// 「見た演出を短く」の記録。毎日見る幕（帰宅の扉・夜明け）は端末に残し、セーブの状態は変えない（scene-motions.js の乗り物と同じ）
const DEVICE_SEEN = "suien_motion_seen";
const deviceSeen = () => { try { return JSON.parse(localStorage.getItem(DEVICE_SEEN) || "{}") || {}; } catch { return {}; } };
const motionSeen = (key) => !!deviceSeen()[key];
const markMotionSeen = (key) => {
  try { const seen = deviceSeen(); if (seen[key]) return; seen[key] = true; localStorage.setItem(DEVICE_SEEN, JSON.stringify(seen)); } catch { /* 保存できない環境では毎回フル */ }
};

// ---------------------------------------------------------------- 一筆: 指定のない背景の切り替え（標準の幕）

// S字の縁を持つ帯（ローカル座標: x方向に波打ち、y方向に進む）。scene-plan-20261009 の一筆を1280×720へ縮めた形
function sBand(y0, y1, amp = 136, w = 1240) {
  return `M ${-w} ${y0} C ${-w / 2} ${y0 - amp}, ${-w / 5} ${y0 - amp}, 0 ${y0} S ${w / 2} ${y0 + amp}, ${w} ${y0} ` +
    `L ${w} ${y1} C ${w / 2} ${y1 + amp}, ${w / 5} ${y1 + amp}, 0 ${y1} S ${-w / 2} ${y1 - amp}, ${-w} ${y1} Z`;
}
// 帯の進み: 画面の外（右下）→ 画面を覆う → 画面の外（左上）。帯の長さ2000、画面の対角の半分は約734
export const STROKE = { from: 900, cover: -900, to: -3000, angle: -32 };

/** 紫の一筆の帯。先頭と後尾にラベンダーの縁、中ほどに細い筋が一本 */
export function strokeBand({ angle = STROKE.angle, fill = COLOR.purple, edge = COLOR.lav } = {}) {
  const mov = svg("g", {}, [
    svg("path", { d: sBand(0, 56), fill: edge }),
    svg("path", { d: sBand(56, 1944), fill }),
    svg("path", { d: sBand(884, 916), fill: edge, "fill-opacity": ".55" }),
    svg("path", { d: sBand(1944, 2000), fill: edge }),
  ]);
  mov.style.transform = `translateY(${STROKE.from}px)`;
  const art = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg", preserveAspectRatio: "xMidYMid slice" }, [
    svg("g", { transform: `translate(${W / 2} ${H / 2}) rotate(${angle})` }, [mov]),
  ]);
  return { art, mov };
}

/**
 * 背景を替えるときの標準の幕（CI101 の「一筆」・#2688 F1）。紫の帯が右下から一筆で画面を覆い、左上へ抜けて次の場面が出る。
 * 通常 約0.75秒、SKIP中・短い幕（brief）は 約0.35秒、動きを減らす設定では短いフェード。
 * 覆っている間は Enter・Space を受け付けない。素材の読み込みを待つ間は覆ったまま待つ（ui.setBg）。
 */
export function createSceneCurtain(host, { fast = false, sceneArrival = takeSceneArrival() } = {}) {
  const reduced = reducedMotion();
  const { cued, commitArrival: entry } = sceneArrival;
  const arrival = (curtain) => Object.assign(curtain, { commitArrival: entry });
  if (cued?.kind === "place" && !fast && !reduced) {
    let style = moveStyle(cued.opts);
    // 「見た演出を短く」（config.shortSeen）: 2回目以降の帰宅は扉の代わりにピンの短い型（#2688 F9）。初回は必ず扉
    if (style === "door") {
      if (config.shortSeen && motionSeen("door")) style = "pin";
      else markMotionSeen("door");
    }
    return arrival(withStoreArrival(host, moveCurtain(host, style, cued.opts), cued.opts, { fast, reduced }));
  }
  const coverMs = reduced ? 90 : fast ? 150 : 340;
  const revealMs = reduced ? 90 : fast ? 170 : 400;
  const node = el("div.scene-curtain.stroke", { "aria-hidden": "true", style: { "--st-ms": `${coverMs}ms` }, dataset: { transition: reduced ? "fade" : "stroke" } });
  const band = reduced ? null : strokeBand();
  if (band) node.append(band.art);
  else node.classList.add("veil");
  const unhold = holdKeys();
  host.append(node);
  const covered = (async () => {
    await nextFrame();
    node.classList.add("cover");
    if (band) await move(band.mov, [{ transform: `translateY(${STROKE.from}px)` }, { transform: `translateY(${STROKE.cover}px)` }], coverMs, { easing: EASE.in });
    else await move(node, [{ opacity: 0 }, { opacity: 1 }], coverMs, { easing: "ease" });
  })();
  let released = false;
  const curtain = { covered, async release() {
    if (released) return;
    released = true;
    try {
      await covered;
      // 次の背景・画面・台詞を幕の内側で描いてから開く。
      await nextFrame(); await nextFrame();
      node.classList.add("reveal");
      if (band) await move(band.mov, [{ transform: `translateY(${STROKE.cover}px)` }, { transform: `translateY(${STROKE.to}px)` }], revealMs, { easing: EASE.out });
      else await move(node, [{ opacity: 1 }, { opacity: 0 }], revealMs, { easing: "ease" });
    } finally {
      node.remove();
      unhold();
    }
  } };
  return arrival(cued?.kind === "place" ? withStoreArrival(host, curtain, cued.opts, { fast, reduced }) : curtain);
}

/** 短い一筆で覆って mid() を行い、開く。乗り物の演出を「見た演出を短く」で省くときなどに使う（#2688 F9） */
export async function briefCover(mid, host = document.getElementById("fx")) {
  const curtain = createSceneCurtain(host, { fast: true, sceneArrival: { cued: null, commitArrival: () => {} } });
  try {
    await curtain.covered;
    return await mid?.();
  } finally { await curtain.release(); }
}

// ---------------------------------------------------------------- 覆ったまま次の場面へ渡す

// 時間が過ぎる波などが画面を覆ったまま、次の背景が出るまで待つ（#2688 A9）。次の ui.setBg がこの幕を受け取り、
// 新しい背景を描いてから開く。次の背景が来なければ、受け取り待ちの上限で自分から開く。
let parked = null;
export function parkCover(release, { maxMs = 1500 } = {}) {
  takeParkedCover()?.();
  let done = false;
  const once = async () => { if (done) return; done = true; clearTimeout(timer); if (parked === once) parked = null; await release(); };
  const timer = setTimeout(once, maxMs);
  parked = once;
}
/** 受け取る側（ui.setBg）。預かっている幕があれば、その開く関数を返して預かりを空にする。 */
export function takeParkedCover() {
  const release = parked;
  parked = null;
  return release;
}

// ---------------------------------------------------------------- 波: 時間が過ぎる（つなぎの一行・CI101）

// 右の縁が3つの丸いこぶで膨らむ帯。左へ幅 w だけ伸びる（1280×720 の座標）
function bumpBand(w = 2100, bulge = 190) {
  const n = 3, step = 800 / n;
  let d = `M ${-w} -40 L 0 -40 `;
  for (let i = 0; i < n; i++) {
    const y = -40 + i * step;
    d += `C ${bulge} ${y}, ${bulge} ${y + step}, 0 ${y + step} `;
  }
  d += `L ${-w} 760 `;
  for (let i = n - 1; i >= 0; i--) {
    const y = -40 + i * step;
    d += `C ${-w + bulge} ${y + step}, ${-w + bulge} ${y}, ${-w} ${y} `;
  }
  return d + "Z";
}
const WAVE = { from: -300, cover: 1320, to: 3480 };

/**
 * つなぎの一行（「夜、tonariに顔を出す──」など）を、丸い波に乗せて見せる（#2688 A9）。
 * 夕方のピンクを先頭にした波が左から流れて画面を覆い、一行が波の上を滑ってくる。読み終えたら波は覆ったまま
 * 次の場面へ預ける（parkCover）。dusk: false で夜の帰り道の色（ピンクなし・ゆっくり）。
 * 戻り値は覆っている間に呼ぶ mid() の結果。動きを減らす設定では、紫の面と一行のフェード。
 */
export async function waveBeat(host, text, mid = null, { dusk = true } = {}) {
  const reduced = reducedMotion();
  const unhold = holdCover();
  const node = el("div.tr-wave", { "aria-hidden": "true", dataset: { transition: "wave" } });
  const line = el("div.tr-wave-line", { text, dataset: { test: "beat-line" } });
  host.append(node);
  let release = null;
  try {
    let mov = null;
    if (reduced) {
      node.classList.add("veil");
      await move(node, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
    } else {
      mov = svg("g", {}, [
        svg("g", { transform: "translate(90 0)" }, [svg("path", { d: bumpBand(), fill: dusk ? COLOR.dusk : COLOR.lav })]),
        svg("path", { d: bumpBand(), fill: dusk ? COLOR.purple : COLOR.deep }),
      ]);
      mov.style.transform = `translateX(${WAVE.from}px)`;
      node.append(svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg", preserveAspectRatio: "xMidYMid slice" }, [mov]));
      await nextFrame();
      await move(mov, [{ transform: `translateX(${WAVE.from}px)` }, { transform: `translateX(${WAVE.cover}px)` }], dusk ? 480 : 620, { easing: EASE.in });
    }
    const result = mid ? await mid() : undefined;
    node.append(line);
    await move(line, [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }], reduced ? 200 : 380, { easing: EASE.out });
    await sleep(reduced ? 1100 : 950);
    await move(line, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: reduced ? "none" : "translateX(40px)" }], 260, { easing: EASE.in });
    line.remove();
    release = async () => {
      try {
        await nextFrame(); await nextFrame();
        if (mov) await move(mov, [{ transform: `translateX(${WAVE.cover}px)` }, { transform: `translateX(${WAVE.to}px)` }], dusk ? 560 : 700, { easing: EASE.out });
        else await move(node, [{ opacity: 1 }, { opacity: 0 }], 200, { easing: "ease" });
      } finally { node.remove(); unhold(); }
    };
    parkCover(release);
    return result;
  } finally {
    // 途中で例外が出た場合だけ、ここで片付ける（通常は預けた幕が開くときに片付く）
    if (!release) { node.remove(); unhold(); }
  }
}

// ---------------------------------------------------------------- 敗北: 色が抜けて一筋の煙が途切れる（#2688 A19）

/**
 * 大会の敗北から GAME OVER へ入る手前。画面の中心から色が抜けて灰色になり、一筋の煙が細くなって途切れる（約2秒）。
 * 覆ったまま返すので、後ろに GAME OVER の画面を出してから、戻り値の関数で灰色を薄れさせる。動きを減らす設定では何もしない。
 */
export async function defeatFade(host = document.getElementById("fx")) {
  if (!host || reducedMotion()) return async () => {};
  const unhold = holdCover();
  const node = el("div.tr-defeat", { "aria-hidden": "true", dataset: { transition: "defeat" } });
  const gray = el("div.tr-defeat-gray");
  const smoke = svg("path", { d: "M 640 760 C 600 660, 690 580, 640 480 S 600 330, 650 240", fill: "none", stroke: COLOR.lav,
    "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": 640, "stroke-dashoffset": 640 });
  node.append(gray, stageSvg([smoke]));
  host.append(node);
  try {
    await move(smoke, [{ strokeDashoffset: 640 }, { strokeDashoffset: 0 }], 600, { easing: EASE.out });
    move(gray, [{ clipPath: "circle(0% at 50% 55%)" }, { clipPath: "circle(80% at 50% 55%)" }], 1000, { easing: EASE.snap });
    await sleep(300);
    await move(smoke, [
      { strokeWidth: 9, opacity: 1, strokeDasharray: "640 0" },
      { strokeWidth: 3, opacity: 0.8, strokeDasharray: "260 50 120 400" },
      { strokeWidth: 1, opacity: 0, strokeDasharray: "140 120 40 400" },
    ], 1000, { easing: "ease-in" });
  } catch (error) { node.remove(); unhold(); throw error; }
  return async () => {
    try { await move(node, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: "ease" }); }
    finally { node.remove(); unhold(); }
  };
}

/** 再挑戦: 一筆の帯を逆向き（左上から右下）に流して色を戻し、覆っている間に mid() で大会の頭へ戻す（#2688 A19・F4） */
export async function retryStroke(mid, host = document.getElementById("fx")) {
  if (!host || reducedMotion()) { await mid?.(); return; }
  const unhold = holdCover();
  const band = strokeBand({ angle: STROKE.angle + 180 });
  const node = el("div.scene-curtain.stroke.retry", { "aria-hidden": "true", dataset: { transition: "retry" } }, [band.art]);
  host.append(node);
  try {
    await move(band.mov, [{ transform: `translateY(${STROKE.from}px)` }, { transform: `translateY(${STROKE.cover}px)` }], 380, { easing: EASE.in });
    await mid?.();
    await nextFrame(); await nextFrame();
    await move(band.mov, [{ transform: `translateY(${STROKE.cover}px)` }, { transform: `translateY(${STROKE.to}px)` }], 440, { easing: EASE.out });
  } finally { node.remove(); unhold(); }
}

// ---------------------------------------------------------------- 波＋めくり: 就寝 → 翌朝

function flipNumber(value) {
  // 日付はすでに更新済み。めくりの両面を朝の値にし、前日の数字を朝の案内に混ぜない。
  const span = el("span.tr-flip", [el("i", { text: String(value) }), el("i", { text: String(value) })]);
  span.lastChild.style.transform = "rotateX(-90deg)";
  span.lastChild.style.opacity = "0";
  return span;
}
async function flip(span) {
  const [before, after] = span.children;
  await move(before, [{ transform: "rotateX(0)", opacity: 1 }, { transform: "rotateX(90deg)", opacity: 0 }], 170, { easing: EASE.in });
  await move(after, [{ transform: "rotateX(-90deg)", opacity: 0 }, { transform: "rotateX(0)", opacity: 1 }], 230, { easing: EASE.out });
  // WAAPIの中断後も朝の数字が残るよう、最終状態をDOMにも確定する。
  before.remove();
  after.style.transform = "rotateX(0)";
  after.style.opacity = "1";
}

/** 下の縁が丸く波打つ夜の面（上から降りてくる） */
function nightPath() {
  const step = W / 5;
  let d = `M -40 -1200 L -40 0 `;
  for (let i = 0; i < 5; i++) {
    const x = -40 + i * (step + 16);
    d += `C ${x} 150, ${x + step + 16} 150, ${x + step + 16} 0 `;
  }
  return d + `L ${W + 60} -1200 Z`;
}

/**
 * 夜の紫が上から降りて眠りにつき、朝のDAYと残り日数のカードがめくれ、ラベンダーの地平線が下から昇って朝が出る。
 * mid() は覆っている間に日付を進め、{ day, left, rain, weather, sick } を返す。
 */
export async function nightToMorning(host, mid) {
  const reduced = reducedMotion();
  const unhold = holdCover();
  const node = el("div.tr-dawn", { "aria-hidden": "true", dataset: { transition: "dawn" } });
  host.append(node);
  let wx = null;
  try {
    const veil = el("div.tr-dawn-veil");
    if (reduced) {
      node.append(veil);
      await move(veil, [{ opacity: 0 }, { opacity: 1 }], 260, { easing: "ease" });
    } else {
      const fall = svg("g", {}, [svg("path", { d: nightPath(), fill: COLOR.lav, transform: "translate(0 34)" }), svg("path", { d: nightPath(), fill: COLOR.deep })]);
      fall.style.transform = "translateY(-200px)";
      const art = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, [fall]);
      node.append(art);
      await nextFrame();
      await move(fall, [{ transform: "translateY(-200px)" }, { transform: "translateY(760px)" }], 540, { easing: EASE.in });
      node.replaceChildren(veil);
    }
    const info = await mid();
    if (!info) return;
    if (info.eve) {
      // 大会・勝負の前夜（#2688 A10）: 日付はめくらず、長い夜のあと地平線がいつもより遅く昇る。DAYは当日の場面が出す。
      if (reduced) {
        await sleep(700);
        await move(node, [{ opacity: 1 }, { opacity: 0 }], 400, { easing: "ease" });
        return;
      }
      await sleep(900);
      const horizon = el("div.tr-dawn-horizon.eve");
      const glow = el("div.tr-dawn-glow");
      node.append(horizon, glow);
      move(glow, [{ opacity: 0 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], 1500, { easing: "ease-out" });
      move(horizon, [{ bottom: "0%", opacity: 1 }, { bottom: "100%", opacity: 0.4 }], 1250, { easing: EASE.inOut });
      await move(veil, [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }], 1250, { easing: EASE.inOut });
      node.style.pointerEvents = "none";
      return;
    }
    // 「見た演出を短く」（config.shortSeen）: 2回目以降の朝はめくりと間を詰める（#2688 F9）。初回は必ずフル。
    const brief = !!config.shortSeen && motionSeen("dawn");
    markMotionSeen("dawn");
    const dayFlip = flipNumber(info.day);
    // 最終日が決まっていない章（第5章の日程未定）は残り日数をめくらず、章の一言だけ出す。
    const leftFlip = info.left === null || info.left === undefined ? null : flipNumber(info.left);
    const sub = info.sick
      ? el("div.tr-dawn-sub", [el("span", { text: "……熱っぽい" })])
      : !leftFlip ? el("div.tr-dawn-sub", [el("span", { text: info.undatedNote || "" })])
      : el("div.tr-dawn-sub", [el("span", { text: `${info.tournamentName || "SMOKE CROWN CUP"} まで あと` }), leftFlip, el("span", { text: "日" })]);
    const card = el("div.tr-dawn-card", { dataset: { test: "dawn-card" } }, [el("div.tr-dawn-day", [el("small", { text: info.dayLabel || "DAY" }), dayFlip]), sub]);
    if (info.forecast) card.append(el("small.tr-dawn-sub", { text: `明日は${info.forecast}`, dataset: { test: "dawn-forecast" } }));
    if (info.sick) node.classList.add("sick");
    // その日の天気（晴れ・くもり・雨。motions/dawn-weather.js）。熱っぽい朝は出さない
    const weather = info.sick ? null : info.weather ?? (info.rain ? "rain" : null);
    if (weather) {
      const { dawnWeather } = await import("../motions/dawn-weather.js").catch(() => ({}));
      wx = dawnWeather?.(node, weather, { reduced }) || null;
    }
    if (wx?.badge) card.append(wx.badge);
    node.append(card);
    if (reduced) {
      [dayFlip, leftFlip].filter(Boolean).forEach((s) => { s.firstChild.remove(); s.firstChild.style.transform = ""; s.firstChild.style.opacity = ""; });
      await move(card, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      await sleep(1300);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" });
      return;
    }
    await move(card, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], brief ? 200 : 320, { easing: EASE.out });
    if (info.sick) {
      card.animate([
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
        { transform: "skewX(3deg) scale(1.02)", filter: "blur(1.2px)" },
        { transform: "skewX(-2deg) scale(.99)", filter: "blur(.4px)" },
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
      ], { duration: 900, iterations: Infinity, easing: "ease-in-out" });
    }
    if (brief && !info.sick) {
      // めくらずに朝の数字だけを見せる
      [dayFlip, leftFlip].filter(Boolean).forEach((s) => { s.firstChild.remove(); s.firstChild.style.transform = ""; s.firstChild.style.opacity = ""; });
      await sleep(700);
    } else {
      await sleep(220);
      SE.tick();
      await Promise.all([flip(dayFlip), info.sick || !leftFlip ? null : sleep(90).then(() => flip(leftFlip))]);
      await sleep(info.sick ? 1100 : 650);
    }
    const horizon = el("div.tr-dawn-horizon");
    node.append(horizon);
    const up = brief && !info.sick ? 520 : 760;
    move(card, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-18px)" }], 300, { easing: EASE.in });
    wx?.fadeOut(up);
    move(horizon, [{ bottom: "0%", opacity: 1 }, { bottom: "100%", opacity: 0.5 }], up);
    await move(veil, [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }], up);
    node.style.pointerEvents = "none";
  } finally {
    wx?.stop();
    node.remove();
    unhold();
  }
}
