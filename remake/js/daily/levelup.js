// ストックしたレベルアップのフル演出（SPEC 6.3）。
// 2026-11-11 オーナー「寝る前のレベルアップは不要。経験値を貯めてレベルアップすると火種をストックして、一気にフル演出を観音とかで」（SBD108）:
// 経験値が入ったその場でレベルと火種は手持ちに入っている。ここは、観音堂などで振り返った時に、前に見せてからの分をまとめて見せるだけ。
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { state, save } from "../core/state.js";
import { on } from "../core/bus.js";
import { DB, displayName } from "../core/data.js";
import { peekGrowthStock, clearGrowthStock, gaugeAt, totalExpFor, growthView, HIDANE_KEYS, MILESTONE_LEVELS, BOARD_TOTAL } from "../core/growth.js";
import { BOARD_HEAD, BOARD_JA, HIDANE_NAME } from "../core/growth-board-data.js";
import { NODES, ringsOpen } from "../core/growth-board.js";
import { spotById } from "./spots.js";
import { hidaneIcon, igniteOn, emberField, HIDANE_COLOR, reducedMotion } from "./growth-fx.js";

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

/** 火種の粒つきの札（「火種 ＋4」「紅火 ＋2」）。文字は hidaneLine・giftLine と同じ言葉にそろえる */
function hidaneChip(kind, n, { label = null, extra = "" } = {}) {
  return el(`span.lu-chip.k-${HIDANE_COLOR[kind] ? kind : "any"}${extra}`, [hidaneIcon(kind), el("span", { text: `${label || colorName(kind)} ＋${n}` })]);
}
/** レベルアップでもらった火種の札の並び（白火は「火種」と書く。今までの言葉のまま） */
function rewardChips(r) {
  const chips = [];
  if (r.gains.any) chips.push(hidaneChip("any", r.gains.any, { label: "火種" }));
  // 節目は色の火1＋白火1（SBD109）。同じ色はまとめて1枚の札に
  const milestone = {};
  for (const { system, n, any = 0 } of r.gains.limited) {
    if (n) milestone[system] = (milestone[system] || 0) + n;
    if (any) milestone.any = (milestone.any || 0) + any;
  }
  for (const kind of HIDANE_KEYS.filter((k) => k !== "any").concat("any")) if (milestone[kind]) chips.push(hidaneChip(kind, milestone[kind], { extra: ".milestone" }));
  return chips;
}
/** 節目の一行（「節目の Lv.10！ 紅火と白火を1つずつ（いちばん灯してきた才能盤の色）」） */
function milestoneText({ level, system, n, any = 0 }) {
  if (system === "any" || !n) return `節目の Lv.${level}！ 火種がさらに${n + any}つ`;
  const what = any === n ? `${colorName(system)}と${HIDANE_NAME.any}を${n}つずつ` : any ? `${colorName(system)}${n}つと${HIDANE_NAME.any}${any}つ` : `${colorName(system)}を${n}つ`;
  return `節目の Lv.${level}！ ${what}（いちばん灯してきた${BOARD_JA[system]}盤の色）`;
}
/** ご褒美の1行を、贈り主と火種の札に分けて並べる */
function giftRow(gift, cls) {
  const from = gift.who ? `${displayName(gift.who, state)}から` : gift.label;
  return el(`p.${cls}`, { dataset: { test: "levelup-gift" }, "aria-label": giftLine(gift) }, [
    el("span.lu-gift-from", { text: from }), ...gift.parts.map(({ kind, n }) => hidaneChip(kind, n)),
  ]);
}

/**
 * 色の火をもらった夜の一言（SBD105）。色の火は「色の台座」にはめる鍵で、まだ灯していない台座の数ぶんは台座のために取ってある。
 * 台座は第2章から盤に現れるので、第1章でもらった色の火は「使えない火種」に見えていた。何のための火かをもらった時に伝える。
 */
export function colorFireNote(r, s = state) {
  const colored = r.gains.limited.some((x) => x.system !== "any" && x.n > 0) || r.gifts.some((x) => x.parts.some((p) => p.kind !== "any"));
  if (!colored) return "";
  const lit = new Set(growthView(s).nodes), open = ringsOpen(s);
  const gates = NODES.filter((n) => n.kind === "gate" && !lit.has(n.id));
  if (!gates.length) return "色の火（紅火・蒼火・翠火）は、その色の盤のマスに使える";
  return gates.some((n) => n.ring <= open)
    ? "色の火（紅火・蒼火・翠火）は、盤のひし形「色の台座」にはめる鍵。はめると、その先の道が開く"
    : "色の火（紅火・蒼火・翠火）は、盤のひし形「色の台座」にはめる鍵。台座は物語が進むと盤に現れる（それまで取っておける）";
}

/** いま持っている火種（精算の後）。0 の色は出さない */
function walletLine(s = state) {
  const hidane = growthView(s).hidane || {};
  const have = HIDANE_KEYS.filter((k) => hidane[k] > 0);
  if (!have.length) return null;
  return el("p.lu-wallet", { dataset: { test: "levelup-wallet" } }, [el("span.lu-wallet-head", { text: "手持ちの火種" }),
    ...have.map((k) => el(`span.lu-chip.small.k-${k}`, [hidaneIcon(k), el("span", { text: `${HIDANE_NAME[k]} ${hidane[k]}` })]))]);
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
  const learned = learnedText(r.learned);
  const chips = rewardChips(r), note = colorFireNote(r);
  const nextMilestone = MILESTONE_LEVELS.find((level) => level > r.to);
  const details = el("div.lu-details", [
    leveled ? el("p.lu-change", { text: `Lv.${r.from} → Lv.${r.to}` }) : null,
    // もらった火種は、粒の絵つきの札で一つずつ出す（SBD103）。盤が埋まった夜は今までどおり一言
    chips.length ? el("p.lu-hidane.lu-rewards", { dataset: { test: "levelup-rewards" } }, chips.map((chip, i) => { chip.style.setProperty("--i", String(i)); return chip; }))
      : hidaneLine(r) ? el("p.lu-hidane", { text: hidaneLine(r) }) : null,
    ...r.gains.limited.map((x) => el("p.lu-milestone", { dataset: { stat: x.system }, text: milestoneText(x) })),
    learned ? el("p.lu-learned", { text: `学んできたこと：${learned}` }) : null,
    ...r.gifts.map((x) => { const row = giftRow(x, "lu-gift"); row.prepend(el("span.lu-gift-head", { text: "ご褒美" })); return row; }),
    note ? el("p.lu-color-note", { dataset: { test: "levelup-color-note" }, text: note }) : null,
    walletLine(),
    // このあと盤が開く（内省の続き）
    el("p.lu-note", { text: "このあと、心得の盤に灯せる（時間は使わない）" }),
  ]);
  const ok = el("button.btn.primary.lu-ok", { text: "盤へ", dataset: { test: "levelup-ok" } });
  const panel = el(`div.levelup${r.milestone ? ".milestone" : ""}${leveled ? "" : ".gift-only"}`, { role: "dialog",
    "aria-label": leveled ? `レベルアップ。Lv.${r.from}からLv.${r.to}へ。${hidaneLine(r)}` : "火種が届いた", dataset: { test: "levelup" } }, [
    head, el("div.lu-lv-wrap", [el("i.lu-ring", { "aria-hidden": "true" }), lvText]),
    el("div.lu-gauge", { role: "img", "aria-hidden": "true" }, [settled, fill, el("i.lu-gauge-shine", { "aria-hidden": "true" })]),
    nextMilestone ? el("p.lu-next", { dataset: { test: "levelup-next" }, text: `次の節目 Lv.${nextMilestone}（色の火がもらえる）まで あと${nextMilestone - r.to}` }) : null,
    details, el("div.lu-actions", [ok]),
  ]);
  // 後ろに光の筋と昇る火の粉（飾り。押した所は今までどおり早送り）
  const backdrop = el("div.levelup-backdrop", [el("i.lu-rays", { "aria-hidden": "true" }), Object.assign(emberField(12), { className: "gfx-embers lu-embers" }), panel]);
  backdrop.addEventListener("pointerdown", (e) => { if (e.target !== ok) s.skip(); });
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
