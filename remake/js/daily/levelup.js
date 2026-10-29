// 寝る直前のレベルアップ（SPEC 6.1a・6.3、REPORT P2〜P3）。
// 初回・節目・1晩に2つ以上上がった夜だけフル演出。それ以外は短い帯で、押さなくても寝る。
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { state, STAT_JA } from "../core/state.js";
import { DB, displayName } from "../core/data.js";
import { settleGrowth, gaugeAt, totalExpFor, openGrowthBoard } from "../core/growth.js";
import { spotById } from "./spots.js";

const STAT_HEAD = { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "察" };
const PLACE_LABEL = {
  tonari_shift: "tonariのバイト", tonari_practice: "まかないで練習", tonari_seat: "tonariの客席", axe_bar: "斧投げBar",
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
  for (const { system } of r.gains.limited) parts.push(`${STAT_HEAD[system]}の火種 ＋1`);
  return parts.join("　") || (r.boardFull ? "盤は埋まった" : "");
}

/** その日の分を精算し、上がっていれば見せる。上がらない夜は何も出さない。 */
export async function presentNightGrowth() {
  const r = settleGrowth();
  if (!r || r.to <= r.from) return r;
  if (r.full) await fullLevelUp(r);
  else await shortLevelUp(r);
  return r;
}

function skipper() {
  let skipped = false, wake = null;
  const wait = (ms) => skipped ? Promise.resolve() : new Promise((resolve) => {
    const timer = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(timer); wake = null; resolve(); };
  });
  return { wait, skip: () => { skipped = true; wake?.(); }, get skipped() { return skipped; } };
}
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- 短い帯（約1.8秒）

async function shortLevelUp(r) {
  const learned = learnedText(r.learned);
  const band = el("div.levelup-band", { role: "status", dataset: { test: "levelup-band" } }, [
    el("b.lb-top", { text: "LEVEL UP" }),
    el("span.lb-lv", { text: `Lv.${r.from} → ${r.to}` }),
    el("span.lb-hidane", { text: hidaneLine(r) }),
    learned ? el("small.lb-learned", { text: `今日学んだこと：${learned}` }) : null,
  ]);
  const s = skipper();
  band.addEventListener("pointerdown", s.skip);
  layers.fx.append(band);
  SE.select();
  await sleep(30);
  band.classList.add("show");
  await s.wait(1800);
  band.classList.remove("show");
  await sleep(220);
  band.remove();
}

// ---------------------------------------------------------------- フル演出

async function fullLevelUp(r) {
  const s = skipper();
  const settled = el("b.lu-settled"), fill = el("b.lu-fill");
  const lvText = el("strong.lu-lv", { text: `Lv.${r.from}` });
  const head = el("h2.lu-head", { text: "LEVEL UP", "aria-hidden": "true" });
  const learned = learnedText(r.learned);
  const details = el("div.lu-details", [
    el("p.lu-change", { text: `Lv.${r.from} → Lv.${r.to}` }),
    el("p.lu-hidane", [el("i.lu-hidane-icon", { "aria-hidden": "true" }), el("span", { text: hidaneLine(r) })]),
    ...r.gains.limited.map(({ level, system }) => el("p.lu-milestone", {
      dataset: { stat: system },
      text: `節目の Lv.${level}！ 火種がもうひとつ（${STAT_HEAD[system]}の火種。まだ伸びしろの大きい${STAT_JA[system]}を後押し）`,
    })),
    learned ? el("p.lu-learned", { text: `今日学んだこと：${learned}` }) : null,
    el("p.lu-note", { text: "火種は「心得の盤」で能力やスキルを灯すのに使う。貯めておいてもいい" }),
  ]);
  const ok = el("button.btn.primary.lu-ok", { text: "OK", dataset: { test: "levelup-ok" } });
  const toBoard = el("button.btn.lu-ok.lu-board", { text: "心得の盤を開く", dataset: { test: "levelup-board" } });
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
    ok.addEventListener("click", () => { SE.click?.(); resolve("ok"); }, { once: true });
    toBoard.addEventListener("click", () => { SE.select?.(); resolve("board"); }, { once: true });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") resolve("ok"); });
  });
  backdrop.classList.remove("show");
  await sleep(220);
  backdrop.remove();
  // 寝る前にそのまま盤で振れる（大会前夜も。SPEC 2.2）
  if (choice === "board") await openGrowthBoard();
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
