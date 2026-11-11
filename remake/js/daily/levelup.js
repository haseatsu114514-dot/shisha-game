// ストックしたレベルアップのフル演出（SPEC 6.3）。
// 2026-11-11 オーナー「寝る前のレベルアップは不要。経験値を貯めてレベルアップすると火種をストックして、一気にフル演出を観音とかで」（SBD108）:
// 経験値が入ったその場でレベルと火種は手持ちに入っている。ここは、観音堂などで振り返った時に、前に見せてからの分をまとめて見せるだけ。
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { state, save } from "../core/state.js";
import { on } from "../core/bus.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { peekGrowthStock, clearGrowthStock, gaugeAt, totalExpFor, growthView, HIDANE_KEYS, MILESTONE_LEVELS, BOARD_TOTAL } from "../core/growth.js";
import { HIDANE_NAME } from "../core/growth-board-data.js";
import { spotById } from "./spots.js";
import { hidaneIcon, igniteOn, emberField, HIDANE_COLOR, reducedMotion } from "./growth-fx.js";
import { openBoardHelp } from "./growth-board-help.js";

const colorName = (kind) => HIDANE_NAME[kind] || "火種";
const PLACE_LABEL = {
  tonari_shift: "tonariのバイト", tonari_practice: "まかないで練習", tonari_seat: "tonariの客席", axe_bar: "斧投げBar", pakki_slot: "パッキースロット",
  "tokyo:pizza_party": "ピザとシーシャの夜", "tokyo:mukai_help": "mukaiのバイト", "tokyo:gym": "CHOI-ZAP",
  "dubai:souq": "スーク", "dubai:festa": "FESTA", "dubai:center_cafe": "中心地のカフェ",
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
  const white = r.gains.any + r.gains.limited.reduce((sum, x) => sum + (x.any || 0) + (x.system === "any" ? x.n : 0), 0);
  if (white) parts.push(`火種 ＋${white}`);
  for (const { system, n } of r.gains.limited) if (system !== "any" && n) parts.push(`${colorName(system)} ＋${n}`);
  if (parts.length) return parts.join("　");
  if (r.boardFull) return "盤は埋まった";
  // 盤の全部のぶんを受け取り終えた後のレベルアップ（SBD105）: 火種が増えない理由を黙らせない
  return (growthView().earned || 0) >= BOARD_TOTAL ? "火種は盤の全部のぶんを受け取った（手持ちを灯せば盤が埋まる）" : "";
}

/** ご褒美の1行（「斧投げで Aランク：才の火種 ＋2」「みんとから：才の火種 ＋2」） */
export function giftLine(gift) {
  const parts = gift.parts.map(({ kind, n }) => `${colorName(kind)} ＋${n}`).join("　");
  const from = gift.who ? `${displayName(gift.who, state)}から` : gift.label;
  return `${from}：${parts}`;
}

// ---------------------------------------------------------------- 絵と数だけで見せる部品（SBD116「文字が多い。アイコンや絵でシンプルに」）
// 文（色の火の使い道・節目の説明・手持ち）は「？」の見方へ移した。画面には粒の絵・数・顔だけを出し、言葉は読み上げと説明（title）に残す。

const sr = (text) => el("span.lu-sr", { text });
/** もらった火種の合計（レベル＋節目＋ご褒美）を色ごとに */
export function stockTotals(r) {
  const sum = Object.fromEntries(HIDANE_KEYS.map((k) => [k, 0]));
  const add = (kind, n) => { if (n > 0) sum[HIDANE_COLOR[kind] ? kind : "any"] += n; };
  add("any", r.gains.any);
  for (const x of r.gains.limited) { add(x.system, x.n); add("any", x.any || 0); }
  for (const gift of r.gifts) for (const part of gift.parts) add(part.kind, part.n);
  return sum;
}
/** 大きな粒と数（「白火 ×12」は読み上げだけ） */
function bigFires(r) {
  const sum = stockTotals(r);
  return HIDANE_KEYS.filter((k) => sum[k] > 0).map((k, i) => {
    const node = el(`span.lu-big.k-${k}`, { title: `${colorName(k)} ＋${sum[k]}` }, [hidaneIcon(k), el("b", { "aria-hidden": "true", text: `×${sum[k]}` }), sr(`${colorName(k)} ＋${sum[k]}`)]);
    node.style.setProperty("--i", String(i));
    return node;
  });
}
const smallFires = (parts) => parts.filter((p) => p.n > 0).map((p) => el(`span.lu-mini.k-${HIDANE_COLOR[p.kind] ? p.kind : "any"}`, { "aria-hidden": "true" }, [hidaneIcon(p.kind), el("b", { text: String(p.n) })]));
const partsText = (parts) => parts.filter((p) => p.n > 0).map((p) => `${colorName(p.kind)} ＋${p.n}`).join("　");
/** ご褒美の短い名札（長い名前は説明と読み上げに） */
const SHORT_GIFT = [[/優勝/, "優勝"], [/大会/, "大会"], [/斧投げ/, "斧投げ"], [/TRPG/, "TRPG"], [/DJ/, "DJ"], [/ラクダ/, "ラクダ"], [/サンドボード/, "砂丘"], [/くじ/, "くじ"]];
const shortGift = (label = "") => SHORT_GIFT.find(([re]) => re.test(label))?.[1] || label.slice(0, 4);
/** 内訳の小さな札: 節目は「★Lv.10」、ご褒美は贈り主の顔か短い名札。文は出さない */
function sourceBadges(r) {
  const out = [];
  for (const x of r.gains.limited) {
    const parts = [{ kind: x.system, n: x.n }, { kind: "any", n: x.any || 0 }];
    out.push(el("span.lu-src.milestone", { title: `節目の Lv.${x.level}：${partsText(parts)}`, dataset: { test: "levelup-milestone" } }, [
      el("b.lu-src-tag", { "aria-hidden": "true", text: `★Lv.${x.level}` }), sr(`節目の Lv.${x.level}：${partsText(parts)}`), ...smallFires(parts)]));
  }
  for (const gift of r.gifts) {
    const face = gift.who ? faceIconUrl(gift.who, state) : null, name = giftLine(gift);
    const tag = face ? el("img.lu-src-face", { src: face, alt: "", draggable: "false" }) : el("b.lu-src-tag", { "aria-hidden": "true", text: gift.who ? displayName(gift.who, state).slice(0, 4) : shortGift(gift.label) });
    if (face) tag.addEventListener("error", () => tag.replaceWith(el("b.lu-src-tag", { "aria-hidden": "true", text: displayName(gift.who, state).slice(0, 4) })));
    out.push(el("span.lu-src", { title: name, dataset: { test: "levelup-gift" } }, [tag, sr(name), ...smallFires(gift.parts)]));
  }
  return out;
}
/** 学んできた相手の顔（場所は説明だけ） */
function learnedFaces(keys) {
  const faces = keys.filter((key) => DB.characters?.[key] && learnedLabel(key)).map((key) => {
    // 顔の絵が無い・読めない時は、短い名札で出す
    const url = faceIconUrl(key, state), name = learnedLabel(key);
    const tag = () => el("b.lu-src-tag", { "aria-hidden": "true", title: name, text: name.slice(0, 4) });
    if (!url) return tag();
    const img = el("img.lu-face", { src: url, alt: "", title: name, draggable: "false" });
    img.addEventListener("error", () => img.replaceWith(tag()));
    return img;
  });
  const text = learnedText(keys);
  return faces.length ? el("p.lu-faces", { title: `学んできたこと：${text}`, dataset: { test: "levelup-learned" } }, [...faces, sr(`学んできたこと：${text}`)]) : null;
}

/** ストックに見せるものがあるか（レベルが上がった・ご褒美が届いた） */
const worthShowing = (r) => !!r && (r.to > r.from || r.gifts.length > 0);

/**
 * ストックした分（前に見せてからのレベルアップ・火種・ご褒美）をまとめてフル演出で見せる。観音堂などの内省から呼ぶ。
 * 見せるものが無ければ何もしない（null）。最後まで見たら、ストックを空にして保存する。途中でセーブが入れ替わったら触らない。
 */
export async function presentStockedGrowth() {
  const r = peekGrowthStock();
  if (!worthShowing(r)) return null;
  const owner = state, controller = new AbortController();
  const off = on("hud", () => { if (state !== owner) controller.abort(); });
  try {
    await fullLevelUp(r, controller.signal);
    if (state === owner && !controller.signal.aborted) { clearGrowthStock(); save(); }
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

// ---------------------------------------------------------------- フル演出

async function fullLevelUp(r, signal) {
  const s = skipper(signal);
  const settled = el("b.lu-settled"), fill = el("b.lu-fill");
  const lvText = el("strong.lu-lv", { text: `Lv.${r.from}` });
  const leveled = r.to > r.from;
  const head = el("h2.lu-head", { text: leveled ? "LEVEL UP" : "HIDANE", "aria-hidden": "true" });
  const fires = bigFires(r), sources = sourceBadges(r);
  const details = el("div.lu-details", [
    leveled ? el("p.lu-change", { text: `Lv.${r.from} → Lv.${r.to}` }) : null,
    // もらった火種は、大きな粒と数だけ（SBD116）。もらえなかった時（盤が埋まった・上限の後）だけ一言
    fires.length ? el("p.lu-hidane.lu-rewards", { dataset: { test: "levelup-rewards" } }, fires)
      : hidaneLine(r) ? el("p.lu-hidane", { text: hidaneLine(r) }) : null,
    sources.length ? el("p.lu-sources", { dataset: { test: "levelup-sources" } }, sources) : null,
    learnedFaces(r.learned),
  ]);
  const ok = el("button.btn.primary.lu-ok", { text: "盤へ", dataset: { test: "levelup-ok" } });
  // 火種の種類・もらえる時・色の火の使い道は「？」の絵つきの見方で（SBD116）
  const helpButton = el("button.lu-help", { type: "button", text: "？", title: "火種の見方", "aria-label": "火種の見方", dataset: { test: "levelup-help" } });
  helpButton.addEventListener("click", () => { SE.click?.(); void openBoardHelp({ page: "fire" }); });
  const panel = el(`div.levelup${r.milestone ? ".milestone" : ""}${leveled ? "" : ".gift-only"}`, { role: "dialog",
    "aria-label": leveled ? `レベルアップ。Lv.${r.from}からLv.${r.to}へ。${hidaneLine(r)}` : "火種が届いた", dataset: { test: "levelup" } }, [
    head, el("div.lu-lv-wrap", [el("i.lu-ring", { "aria-hidden": "true" }), lvText]),
    el("div.lu-gauge", { role: "img", "aria-hidden": "true" }, [settled, fill, el("i.lu-gauge-shine", { "aria-hidden": "true" })]),
    details, el("div.lu-actions", [ok]), helpButton,
  ]);
  // 後ろに光の筋と昇る火の粉（飾り。押した所は今までどおり早送り）
  const backdrop = el("div.levelup-backdrop", [el("i.lu-rays", { "aria-hidden": "true" }), Object.assign(emberField(12), { className: "gfx-embers lu-embers" }), panel]);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target !== ok && e.target !== helpButton) s.skip(); });
  layers.fx.append(backdrop);
  let fillPace = "";
  const setBar = (node, ratio, instant = false) => {
    if (instant) node.style.transition = "none";
    node.style.width = `${Math.round(ratio * 1000) / 10}%`;
    if (instant) { void node.offsetWidth; node.style.transition = ""; if (node === fill && fillPace) node.style.transitionDuration = fillPace; }
  };
  const start = gaugeAt(r.from, r.xpFrom, r.xpFrom);
  setBar(settled, start.now, true);
  setBar(fill, start.now, true);
  await sleep(30);
  if (signal.aborted) { backdrop.remove(); return; }
  backdrop.classList.add("show");
  if (reducedMotion()) s.skip();
  await s.wait(350);
  // 上がったレベルの数だけ満ちて弾け、最後に残りの分で止まる。ためた分が多い時は足を速める（全部で約4秒まで）
  const pace = Math.min(1, 4 / Math.max(1, r.to - r.from));
  fillPace = pace < 1 ? `${Math.round(600 * pace)}ms` : "";
  fill.style.transitionDuration = fillPace;
  for (let level = r.from; level < r.to && !s.skipped; level++) {
    setBar(fill, 1);
    await s.wait(620 * pace);
    if (s.skipped) break;
    panel.classList.remove("burst"); void panel.offsetWidth; panel.classList.add("burst");
    SE.good?.();
    lvText.textContent = `Lv.${level + 1}`;
    // レベルの数字で火が弾ける。節目のレベルは大きく
    igniteOn(backdrop, lvText, { color: "#ffd38a", big: MILESTONE_LEVELS.includes(level + 1) });
    flyHidane(panel);
    setBar(settled, 0, true);
    setBar(fill, 0, true);
    await s.wait(420 * pace);
  }
  fillPace = "";
  fill.style.transitionDuration = "";
  const end = gaugeAt(r.to, totalExpFor(r.to), r.xpTo);
  lvText.textContent = `Lv.${r.to}`;
  setBar(settled, 0, s.skipped);
  setBar(fill, end.now, s.skipped);
  panel.classList.add("lu-settled-state");
  if (!s.skipped) await s.wait(300);
  ok.focus?.();
  await new Promise((resolve) => {
    if (signal.aborted) { resolve("cancel"); return; }
    signal.addEventListener("abort", () => resolve("cancel"), { once: true });
    ok.addEventListener("click", () => { SE.click?.(); resolve("ok"); }, { once: true });
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") resolve("ok"); });
  });
  backdrop.classList.remove("show");
  await sleep(220);
  backdrop.remove();
}

/** 火種の粒を HUD の MENU（火種の印と、盤への入り口のステータスタブがある所・DUI05）へ飛ばす。HUD が見えなければ飛ばさない。 */
function flyHidane(panel) {
  if (reducedMotion()) return;
  const target = document.querySelector("#hud .hud-menu");
  const stage = document.querySelector("#stage")?.getBoundingClientRect();
  const source = panel.querySelector(".lu-gauge")?.getBoundingClientRect();
  const goal = target?.getBoundingClientRect();
  if (!stage?.width || !source?.width || !goal?.width) return;
  const sx = stage.width / 1280, sy = stage.height / 720;
  const from = [(source.right - stage.x) / sx, (source.y + source.height / 2 - stage.y) / sy];
  const to = [(goal.x + goal.width / 2 - stage.x) / sx, (goal.y + goal.height / 2 - stage.y) / sy];
  const spark = hidaneIcon("any", ".hidane-flight");
  layers.fx.append(spark);
  spark.animate([
    { transform: `translate(${from[0]}px, ${from[1]}px) scale(1.4)`, opacity: 1 },
    { transform: `translate(${(from[0] + to[0]) / 2}px, ${Math.min(from[1], to[1]) - 60}px) scale(1)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${to[0]}px, ${to[1]}px) scale(.6)`, opacity: 0.2 },
  ], { duration: 720, easing: "ease-in-out", fill: "both" }).finished.finally(() => spark.remove());
}
