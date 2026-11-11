// その場のレベルアップ（SPEC 6.3）。
// 2026-11-11 オーナー「一気にリザルトみたいに今日のレベルアップは、みたいなのはいらない。都度経験値もらって達したらレベルアップがいい」（SBD122）:
// 経験値が届いてレベルが上がったその場で、画面の上に短い演出を出す（"level-up"）。ご褒美の火種が届いた時も同じ形（"hidane-gift"）。
// 操作は止めない（押せない飾り）。レベルと火種は core/growth.js がもう入れてあり、ここは見せるだけ。
// 絵と数だけで見せる（SBD116）: 「LEVEL UP」「Lv.4」と、火種の粒・×N。言葉は読み上げと、縦持ちの知らせ（data-line）に残す。
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { HIDANE_NAME } from "../core/growth-board-data.js";
import { hidaneIcon, igniteOn, flyHidane, HIDANE_COLOR, reducedMotion } from "./growth-fx.js";

const KINDS = Object.keys(HIDANE_COLOR);
const colorName = (kind) => HIDANE_NAME[kind] || HIDANE_NAME.any;

/** 火種の内訳を種類ごとの合計にする（白火・紅火・蒼火・翠火の順）。 */
export function fireTotals(parts = []) {
  const sum = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const part of parts) if (part?.n > 0) sum[HIDANE_COLOR[part.kind] ? part.kind : "any"] += part.n;
  return KINDS.filter((k) => sum[k] > 0).map((kind) => ({ kind, n: sum[kind] }));
}
/** 「白火 ＋4　紅火 ＋1」（読み上げ・縦持ちの知らせ・説明に使う文） */
export const fireText = (parts) => fireTotals(parts).map(({ kind, n }) => `${colorName(kind)} ＋${n}`).join("　");

/** ご褒美の短い名札（長い名前は説明と読み上げに） */
const SHORT_GIFT = [[/優勝/, "優勝"], [/大会/, "大会"], [/斧投げ/, "斧投げ"], [/TRPG/, "TRPG"], [/DJ/, "DJ"], [/ラクダ/, "ラクダ"], [/サンドボード/, "砂丘"], [/くじ/, "くじ"]];
const shortGift = (label = "") => SHORT_GIFT.find(([re]) => re.test(label))?.[1] || label.slice(0, 4);
/** ご褒美の出どころ（「みんとから」「大会で優勝」）。まだ名乗っていない相手は名前を出さない */
export function giftFrom(gift) {
  if (!gift?.who) return gift?.label || "";
  const name = DB.characters?.[gift.who] ? displayName(gift.who, state) : "";
  return name && name !== "？？？" ? `${name}から` : "贈り物";
}

// ---------------------------------------------------------------- 順番に出す

const queue = [];
let running = false;

/** レベルが上がった。続けて上がった分は、まだ出していなければ一つにまとめる（Lv.3 → Lv.5）。 */
export function showLevelUp({ from, to, parts = [], milestone = false, capped = false } = {}) {
  if (!(to > from)) return;
  const last = queue[queue.length - 1];
  if (last?.type === "level" && last.owner === state && last.to === from) {
    Object.assign(last, { to, milestone: last.milestone || milestone, capped });
    last.parts.push(...parts);
  } else queue.push({ type: "level", from, to, parts: [...parts], milestone, capped, owner: state });
  void run();
}
/** ご褒美の火種が届いた（♥5・大会・遊び・くじ）。 */
export function showHidaneGift({ who = null, label = "", parts = [] } = {}) {
  if (!parts.some((part) => part?.n > 0)) return;
  queue.push({ type: "gift", who, label, parts: [...parts], owner: state });
  void run();
}
/** 出している・待っている演出があるか（検査用） */
export const levelUpBusy = () => running || queue.length > 0;

async function run() {
  if (running) return;
  running = true;
  try {
    await sleep(60); // 同じ行動で続けて入った経験値（章クリアと広さなど）を一つにまとめる
    while (queue.length) {
      const item = queue.shift();
      if (item.owner !== state) continue; // LOAD などで入れ替わった前のセーブの分は出さない
      await present(item);
    }
  } finally { running = false; }
}

// ---------------------------------------------------------------- 一つの演出

/** 大きな粒と ×N */
const bigFires = (parts) => fireTotals(parts).map(({ kind, n }, i) => {
  const node = el(`span.lvup-fire.k-${kind}`, [hidaneIcon(kind), el("b", { text: `×${n}` })]);
  node.style.setProperty("--i", String(i));
  return node;
});

/** ご褒美の札: 贈り主の顔（絵が無い・読めない時は短い名前）か、短い名札 */
function giftBadge(gift) {
  const tag = (text) => el("b.lvup-tag", { text });
  if (!gift.who) return tag(shortGift(gift.label));
  const name = giftFrom(gift).replace(/から$/, ""), url = faceIconUrl(gift.who, state);
  if (!url || name === "贈り物") return tag(name.slice(0, 4));
  const face = el("img.lvup-face", { src: url, alt: "", draggable: "false" });
  face.addEventListener("error", () => face.replaceWith(tag(name.slice(0, 4))));
  return face;
}

async function present(item) {
  const level = item.type === "level", still = reducedMotion();
  const fires = bigFires(item.parts), got = fireText(item.parts);
  // 火種が増えないレベルアップ（盤の全部のぶんを受け取った後・SBD105）は、理由を一言で
  const none = level && !fires.length ? (item.capped ? "火種は受け取り済み" : "") : "";
  const line = level ? [`LEVEL UP Lv.${item.to}`, got || none].filter(Boolean).join("　") : `${giftFrom(item)}　${got}`;
  const lv = level ? el("strong.lvup-lv", [item.to - item.from > 1 ? el("small", { text: `Lv.${item.from} →` }) : null, el("b", { text: `Lv.${item.to}` })]) : el("strong.lvup-lv", [giftBadge(item)]);
  const node = el(`div.lvup${level ? "" : ".gift"}${item.milestone ? ".milestone" : ""}${still ? ".still" : ""}`, {
    role: "status", "aria-label": line,
    dataset: { test: "levelup", kind: item.type, line, ...(level ? { from: String(item.from), to: String(item.to) } : {}) },
  }, [
    el("i.lvup-rays", { "aria-hidden": "true" }),
    el("div.lvup-plate", { "aria-hidden": "true" }, [
      el("span.lvup-head", { text: level ? "LEVEL UP" : "HIDANE" }),
      lv,
      fires.length ? el("span.lvup-fires", { dataset: { test: "levelup-rewards" } }, fires) : none ? el("span.lvup-none", { dataset: { test: "levelup-none" }, text: none }) : null,
    ]),
  ]);
  layers.fx.append(node);
  (level ? (item.milestone ? SE.fanfare : SE.jingle) : SE.select)?.();
  await sleep(30);
  if (item.owner !== state) { node.remove(); return; }
  node.classList.add("show");
  if (!still) {
    await sleep(380);
    // レベルの数字で火が弾ける（節目は大きく）。そのあと粒が MENU の火種の印へ飛ぶ
    if (node.isConnected) igniteOn(layers.fx, lv, { color: "#ffd38a", big: !!item.milestone });
    await sleep(700);
    const menu = document.querySelector("#hud .hud-menu");
    if (node.isConnected && menu) for (const [i, fire] of [...node.querySelectorAll(".lvup-fire .hidane-icon")].slice(0, 4).entries()) {
      void flyHidane(layers.fx, fire, menu, { kind: fire.className.match(/k-(\w+)/)?.[1] || "any", delay: i * 90, duration: 520 });
    }
  }
  await sleep(still ? 1900 : level && (item.milestone || item.to - item.from > 1) ? 1500 : 1000);
  node.classList.remove("show");
  node.classList.add("out");
  await sleep(still ? 0 : 300);
  node.remove();
}
