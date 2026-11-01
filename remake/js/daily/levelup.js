// 寝る直前のレベルアップ（SPEC 6.1a・6.3、REPORT P2〜P3）。
// 初回・節目・1晩に2つ以上上がった夜だけフル演出。それ以外は短い帯で、押さなくても寝る。
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { DB, displayName } from "../core/data.js";
import { settleGrowth, gaugeAt, totalExpFor, openGrowthBoard } from "../core/growth.js";
import { BOARD_HEAD, BOARD_JA, HIDANE_NAME } from "../core/growth-board-data.js";
import { spotById } from "./spots.js";

const colorName = (kind) => HIDANE_NAME[kind] || "火種";
const PLACE_LABEL = {
  tonari_shift: "tonariのバイト", tonari_practice: "まかないで練習", tonari_seat: "tonariの客席", axe_bar: "斧投げBar", pakki_slot: "パッキースロット",
  "tokyo:pizza_party": "ピザとシーシャの夜",
};

/** 「今日学んだこと」の名前。相手は表示名、場所は行き先の名前。分からない鍵は出さない。 */
export function learnedLabel(key) {
  if (DB.characters?.[key]) {
    const name = displayName(key, state);
    return name === "？？？" ? "" : name; // まだ名乗っていない相手は出さない
  }
  return PLACE_LABEL[key] || spotById(key)?.label || "";
}
const learnedText = (keys) => keys.map(learnedLabel).filter(Boolean).join("／");

function hidaneLine(r) {
  const parts = [];
  if (r.gains.any) parts.push(`火種 ＋${r.gains.any}`);
  for (const { system, n } of r.gains.limited) parts.push(`${colorName(system)} ＋${n}`);
  return parts.join("　") || (r.boardFull ? "盤は埋まった" : "");
}

/** ご褒美の1行（「斧投げで Aランク：才の火種 ＋2」「みんとから：才の火種 ＋2」） */
export function giftLine(gift) {
  const parts = gift.parts.map(({ kind, n }) => `${colorName(kind)} ＋${n}`).join("　");
  const from = gift.who ? `${displayName(gift.who, state)}から` : gift.label;
  return `${from}：${parts}`;
}

/** その日の分を精算し、上がっていれば見せる。上がらない夜は、ご褒美があればそれだけ短く見せる。 */
export async function presentNightGrowth(r = settleGrowth()) {
  if (!r) return r;
  const owner = state, controller = new AbortController();
  const off = on("hud", () => { if (state !== owner) controller.abort(); });
  try {
    if (r.to <= r.from) { if (r.gifts.length) await giftBand(r, controller.signal); return r; }
    if (r.full) await fullLevelUp(r, controller.signal);
    else await shortLevelUp(r, controller.signal);
    return r;
  } finally { off(); controller.abort(); }
}

function skipper(signal) {
  let skipped = false, wake = null;
  const wait = (ms) => skipped ? Promise.resolve() : new Promise((resolve) => {
    const timer = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(timer); wake = null; resolve(); };
  });
  const skip = () => { skipped = true; wake?.(); };
  signal?.addEventListener("abort", skip, { once: true });
  if (signal?.aborted) skip();
  return { wait, skip, get skipped() { return skipped; } };
}
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- 短い帯（約1.8秒）

async function shortLevelUp(r, signal) {
  const learned = learnedText(r.learned);
  const band = el("div.levelup-band", { role: "status", dataset: { test: "levelup-band" } }, [
    el("b.lb-top", { text: "LEVEL UP" }),
    el("span.lb-lv", { text: `Lv.${r.from} → ${r.to}` }),
    el("span.lb-hidane", { text: hidaneLine(r) }),
    learned ? el("small.lb-learned", { text: `今日学んだこと：${learned}` }) : null,
    ...r.gifts.map((x) => el("small.lb-gift", { text: giftLine(x) })),
  ]);
  const s = skipper(signal);
  band.addEventListener("pointerdown", s.skip);
  layers.fx.append(band);
  SE.select();
  await sleep(30);
  if (signal.aborted) { band.remove(); return; }
  band.classList.add("show");
  await s.wait(1800);
  band.classList.remove("show");
  await sleep(220);
  band.remove();
}

// ---------------------------------------------------------------- ご褒美だけの夜（レベルは上がっていない）

async function giftBand(r, signal) {
  const band = el("div.levelup-band.gift", { role: "status", dataset: { test: "gift-band" } }, [
    el("b.lb-top", { text: "HIDANE" }),
    ...r.gifts.map((x) => el("span.lb-hidane", { text: giftLine(x) })),
    el("small.lb-learned", { text: "火種は観音堂などで内省すると灯せる" }),
  ]);
  const s = skipper(signal);
  band.addEventListener("pointerdown", s.skip);
  layers.fx.append(band);
  SE.select();
  await sleep(30);
  if (signal.aborted) { band.remove(); return; }
  band.classList.add("show");
  await s.wait(2200 + 600 * r.gifts.length);
  band.classList.remove("show");
  await sleep(220);
  band.remove();
}

// ---------------------------------------------------------------- フル演出

async function fullLevelUp(r, signal) {
  const s = skipper(signal);
  const settled = el("b.lu-settled"), fill = el("b.lu-fill");
  const lvText = el("strong.lu-lv", { text: `Lv.${r.from}` });
  const head = el("h2.lu-head", { text: "LEVEL UP", "aria-hidden": "true" });
  const learned = learnedText(r.learned);
  const details = el("div.lu-details", [
    el("p.lu-change", { text: `Lv.${r.from} → Lv.${r.to}` }),
    el("p.lu-hidane", [el("i.lu-hidane-icon", { "aria-hidden": "true" }), el("span", { text: hidaneLine(r) })]),
    ...r.gains.limited.map(({ level, system, n }) => el("p.lu-milestone", {
      dataset: { stat: system },
      text: system === "any" ? `節目の Lv.${level}！ 火種がさらに${n}つ`
        : `節目の Lv.${level}！ ${colorName(system)}が${n}つ（このところ灯してきた${BOARD_JA[system]}盤を後押し）`,
    })),
    learned ? el("p.lu-learned", { text: `今日学んだこと：${learned}` }) : null,
    ...r.gifts.map((x) => el("p.lu-gift", { dataset: { test: "levelup-gift" }, text: `ご褒美　${giftLine(x)}` })),
    el("p.lu-note", { text: "火種は観音堂で静かに振り返ると、心得の盤に灯せる（時間は使わない）。貯めておいてもいい" }),
  ]);
  const ok = el("button.btn.primary.lu-ok", { text: "OK", dataset: { test: "levelup-ok" } });
  const toBoard = el("button.btn.lu-ok.lu-board", { text: "心得の盤を見る", dataset: { test: "levelup-board" } });
  const panel = el("div.levelup", { role: "dialog", "aria-label": `レベルアップ。Lv.${r.from}からLv.${r.to}へ。${hidaneLine(r)}`, dataset: { test: "levelup" } }, [
    head, lvText,
    el("div.lu-gauge", { role: "img", "aria-hidden": "true" }, [settled, fill]),
    details, el("div.lu-actions", [toBoard, ok]),
  ]);
  const backdrop = el("div.levelup-backdrop", [panel]);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target !== ok && e.target !== toBoard) s.skip(); });
  layers.fx.append(backdrop);
  const setBar = (node, ratio, instant = false) => {
    if (instant) node.style.transition = "none";
    node.style.width = `${Math.round(ratio * 1000) / 10}%`;
    if (instant) { void node.offsetWidth; node.style.transition = ""; }
  };
  const start = gaugeAt(r.from, r.xpFrom, r.xpFrom);
  setBar(settled, start.now, true);
  setBar(fill, start.now, true);
  await sleep(30);
  if (signal.aborted) { backdrop.remove(); return; }
  backdrop.classList.add("show");
  if (reducedMotion()) s.skip();
  await s.wait(350);
  // 上がったレベルの数だけ満ちて弾け、最後に残りの分で止まる
  for (let level = r.from; level < r.to && !s.skipped; level++) {
    setBar(fill, 1);
    await s.wait(620);
    if (s.skipped) break;
    panel.classList.remove("burst"); void panel.offsetWidth; panel.classList.add("burst");
    SE.good?.();
    lvText.textContent = `Lv.${level + 1}`;
    flyHidane(panel);
    setBar(settled, 0, true);
    setBar(fill, 0, true);
    await s.wait(420);
  }
  const end = gaugeAt(r.to, totalExpFor(r.to), r.xpTo);
  lvText.textContent = `Lv.${r.to}`;
  setBar(settled, 0, s.skipped);
  setBar(fill, end.now, s.skipped);
  panel.classList.add("lu-settled-state");
  if (!s.skipped) await s.wait(300);
  ok.focus?.();
  const choice = await new Promise((resolve) => {
    if (signal.aborted) { resolve("cancel"); return; }
    signal.addEventListener("abort", () => resolve("cancel"), { once: true });
    ok.addEventListener("click", () => { SE.click?.(); resolve("ok"); }, { once: true });
    toBoard.addEventListener("click", () => { SE.select?.(); resolve("board"); }, { once: true });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") resolve("ok"); });
  });
  backdrop.classList.remove("show");
  await sleep(220);
  backdrop.remove();
  // 寝る前に盤を見て目標を決められる。灯すのは参拝の場所（SPEC 2.8）
  if (choice === "board" && !signal.aborted) await openGrowthBoard();
}

/** 火種の粒を HUD の五角形（盤への入り口）へ飛ばす。HUD が見えなければ飛ばさない。 */
function flyHidane(panel) {
  if (reducedMotion()) return;
  const target = document.querySelector(".hud-level");
  const stage = document.querySelector("#stage")?.getBoundingClientRect();
  const source = panel.querySelector(".lu-gauge")?.getBoundingClientRect();
  const goal = target?.getBoundingClientRect();
  if (!stage?.width || !source?.width || !goal?.width) return;
  const sx = stage.width / 1280, sy = stage.height / 720;
  const from = [(source.right - stage.x) / sx, (source.y + source.height / 2 - stage.y) / sy];
  const to = [(goal.x + goal.width / 2 - stage.x) / sx, (goal.y + goal.height / 2 - stage.y) / sy];
  const spark = el("i.hidane-flight", { "aria-hidden": "true" });
  layers.fx.append(spark);
  spark.animate([
    { transform: `translate(${from[0]}px, ${from[1]}px) scale(1.4)`, opacity: 1 },
    { transform: `translate(${(from[0] + to[0]) / 2}px, ${Math.min(from[1], to[1]) - 60}px) scale(1)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${to[0]}px, ${to[1]}px) scale(.6)`, opacity: 0.2 },
  ], { duration: 720, easing: "ease-in-out", fill: "both" }).finished.finally(() => spark.remove());
}
