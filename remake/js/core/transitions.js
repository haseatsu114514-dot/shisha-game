// 背景の読み込みを覆う、夜の藍・琥珀・煙のモーショングラフィックス。
// 場面の意味ごとの型: 就寝から翌朝（CI102）／マップから場所への移動（transition-moves.js・CI103）。
// 型の一覧と残りの場面の案は asset_sources/transitions/scene-plan-20261009/README.md。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";
import { W, H, COLOR, EASE, reducedMotion, svg, move, holdKeys } from "./transition-kit.js";
import { moveCurtain, moveStyle } from "./transition-moves.js";
import { state } from "./state.js";
import { createEntrySound } from "./entry-sound.js";
import { withStoreArrival } from "./store-arrival.js";

let serial = 0;
const STYLES = ["diagonal", "smoke", "iris"];

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

export function createSceneCurtain(host, { fast = false, sceneArrival = takeSceneArrival() } = {}) {
  const reduced = reducedMotion();
  const { cued, commitArrival: entry } = sceneArrival;
  const arrival = (curtain) => Object.assign(curtain, { commitArrival: entry });
  if (cued?.kind === "place" && !fast && !reduced) return arrival(withStoreArrival(host, moveCurtain(host, moveStyle(cued.opts), cued.opts), cued.opts, { fast, reduced }));
  const ms = reduced ? 45 : fast ? 140 : 260;
  const variant = STYLES[serial++ % STYLES.length];
  const node = el(`div.scene-curtain.${variant}`, { "aria-hidden": "true", style: { "--st-ms": `${ms}ms` }, dataset: { transition: variant } }, [
    el("div.st-field"),
    el("div.st-lines", [el("b"), el("b"), el("b")]),
    el("div.st-orbit", [el("b"), el("b")]),
    el("div.st-sign", [el("span", { text: "水煙前線" }), el("small", { text: "SUIEN ZENSEN" })]),
  ]);
  const unhold = holdKeys();
  host.append(node);
  let coveredAt = 0;
  const covered = (async () => { await nextFrame(); node.classList.add("cover"); await sleep(ms); coveredAt = performance.now(); })();
  let released = false;
  const curtain = { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    // 通常の場面転換ではロゴを読む時間を確保。素材待ちの時間もこの表示時間へ含める。
    if (!fast && !reduced) await sleep(Math.max(0, 650 - (performance.now() - coveredAt)));
    // 次の背景・画面・台詞を幕の内側で描いてから開く。
    await nextFrame(); await nextFrame();
    node.classList.add("reveal");
    await sleep(ms + 30);
    node.remove();
    unhold();
  } };
  return arrival(cued?.kind === "place" ? withStoreArrival(host, curtain, cued.opts, { fast, reduced }) : curtain);
}

// ---------------------------------------------------------------- 波＋めくり: 就寝 → 翌朝

function flipNumber(from, to) {
  const span = el("span.tr-flip", [el("i", { text: String(from) }), el("i", { text: String(to) })]);
  span.lastChild.style.transform = "rotateX(-90deg)";
  span.lastChild.style.opacity = "0";
  return span;
}
async function flip(span) {
  const [before, after] = span.children;
  await move(before, [{ transform: "rotateX(0)", opacity: 1 }, { transform: "rotateX(90deg)", opacity: 0 }], 170, { easing: EASE.in });
  await move(after, [{ transform: "rotateX(-90deg)", opacity: 0 }, { transform: "rotateX(0)", opacity: 1 }], 230, { easing: EASE.out });
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
 * 夜の紫が上から降りて眠りにつき、DAYと残り日数が1つめくれ、ラベンダーの地平線が下から昇って朝が出る。
 * mid() は覆っている間に日付を進め、{ fromDay, day, fromLeft, left, rain, weather, sick } を返す。
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
    const dayFlip = flipNumber(info.fromDay, info.day);
    const leftFlip = flipNumber(info.fromLeft, info.left);
    const sub = info.sick
      ? el("div.tr-dawn-sub", [el("span", { text: "……熱っぽい" })])
      : el("div.tr-dawn-sub", [el("span", { text: `${info.tournamentName || "SMOKE CROWN CUP"} まで あと` }), leftFlip, el("span", { text: "日" })]);
    const card = el("div.tr-dawn-card", { dataset: { test: "dawn-card" } }, [el("div.tr-dawn-day", [el("small", { text: "DAY" }), dayFlip]), sub]);
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
      [dayFlip, leftFlip].forEach((s) => { s.firstChild.remove(); s.firstChild.style.transform = ""; s.firstChild.style.opacity = ""; });
      await move(card, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      await sleep(1300);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" });
      return;
    }
    await move(card, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], 320, { easing: EASE.out });
    if (info.sick) {
      card.animate([
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
        { transform: "skewX(3deg) scale(1.02)", filter: "blur(1.2px)" },
        { transform: "skewX(-2deg) scale(.99)", filter: "blur(.4px)" },
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
      ], { duration: 900, iterations: Infinity, easing: "ease-in-out" });
    }
    await sleep(220);
    SE.tick();
    await Promise.all([flip(dayFlip), info.sick ? null : sleep(90).then(() => flip(leftFlip))]);
    await sleep(info.sick ? 1100 : 650);
    const horizon = el("div.tr-dawn-horizon");
    node.append(horizon);
    const up = 760;
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
