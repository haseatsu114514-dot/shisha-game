// ミニゲームの自分の道具（VOL07・#2273・#1904）。斧投げBar・クラブSEAM・ボドゲカフェの各店で一度だけ買い、
// 所持品（state.owned）に残す。機材（data/equipment.json）ではないので、制作・Dr.fookahの売却・機材一覧には出ない。
// 効き目は小さく、持っていなくても普通に遊べて勝てる。何が変わるかは各店のメニューとミニゲームの画面に出す。
// 周回（NG+）では購入品として owned ごと引き継ぐ（carry.js）。効果は「持っているか」だけで決まるので、SAVE/LOADで重ならない。
import { el, yen } from "./util.js";
import { spendableMoney } from "./travel-budget.js";
import { MAX_MONEY } from "./rules.js";

/** 斧: 構えたときの照準の揺れ（axe-model.js の swayAt）に掛ける倍率。 */
export const AXE_STEADY = 0.9;
/** DJ: ▶を押す瞬間の判定（previews/dj/model.mjs の gradeOf・scoreTransition）を広げるミリ秒。 */
export const DJ_ALLOWANCE_MS = 10;

export const HOBBY_GEAR = Object.freeze({
  gear_hatchet: Object.freeze({
    id: "gear_hatchet", name: "マイ斧（投擲用ハチェット）", short: "マイ斧", price: 5000, venue: "axe_bar", chapterMin: 1,
    effect: "構えの揺れが1割小さい",
    description: "マキの店で扱う投擲用のハチェット。刃と柄の重さが手になじみ、構えたときの照準のぶれが少し小さくなる。店の10投・3投で使う。",
  }),
  gear_hatchet_balanced: Object.freeze({
    id: "gear_hatchet_balanced", name: "バランス・ハチェット", short: "バランス斧", price: 9000, venue: "axe_bar", chapterMin: 1,
    effect: "構えの揺れが2割・回転のずれが1割小さい",
    description: "重心を整えたマイ斧。店の10投・3投で選んで使う。照準と引き加減を少し助けるが、命中は保証しない。",
  }),
  gear_hatchet_precision: Object.freeze({
    id: "gear_hatchet_precision", name: "プレシジョン・ハチェット", short: "プレシジョン斧", price: 15000, venue: "axe_bar", chapterMin: 1,
    effect: "構えの揺れが3割・回転のずれが2割小さい",
    description: "握りと重心を丁寧に調整したマイ斧。店の10投・3投で選んで使う。狙いやすさは増すが、得点や的の大きさは変わらない。",
  }),
  gear_dice: Object.freeze({
    id: "gear_dice", name: "マイダイス（20面2個とトレイ）", short: "マイダイス", price: 3800, venue: "trpg_bar", chapterMin: 2,
    effect: "卓の盛り上がりが1から始まる",
    description: "六角サイの店で選んだ、20面ダイス2個と折りたたみのダイストレイ。自分のダイスを並べると、卓が少しあたたまった状態で始まる。出る目は変わらない。",
  }),
  gear_headphones: Object.freeze({
    id: "gear_headphones", name: "モニターヘッドホン", short: "ヘッドホン", price: 22000, venue: "club", chapterMin: 3,
    effect: "▶の判定が前後10ミリ秒広い",
    description: "ヨルが勧めるDJ用の密閉型ヘッドホン。次の曲を耳で先に聴けるので、▶を押す瞬間を合わせやすい。",
  }),
});

export const ownsGear = (s, id) => !!HOBBY_GEAR[id] && Array.isArray(s?.owned) && s.owned.includes(id);

/** 買えるかどうかと、買えない理由（所持済み・章が早い・お金が足りない）。 */
export function gearStatus(s, id) {
  const gear = HOBBY_GEAR[id];
  if (!gear || !s) return { ok: false, reason: "unknown" };
  if (ownsGear(s, id)) return { ok: false, reason: "owned" };
  if ((Number(s.chapter) || 1) < gear.chapterMin) return { ok: false, reason: "chapter" };
  if (spendableMoney(s) < gear.price) return { ok: false, reason: "money" };
  return { ok: true, reason: null };
}

/** 一度だけ買う。支払いと所持をまとめて反映し、保存は呼び出し側が行う。二度目・残高不足は何も変えない。 */
export function buyGear(s, id) {
  if (!gearStatus(s, id).ok) return false;
  s.money = Math.min(MAX_MONEY, Math.max(0, Math.round((Number(s.money) || 0) - HOBBY_GEAR[id].price)));
  s.owned.push(id);
  return true;
}

/**
 * 店のメニューに置く1行。未所持なら「買う」ボタン、所持済みなら効果の一文。章が早い道具は出さない（null）。
 * onBought(gear) は購入の直後に呼ぶ（保存・通知・残高に応じた再描画は呼び出し側）。
 */
export function gearOffer(s, id, { onBought = () => {}, isCurrent = () => true } = {}) {
  const gear = HOBBY_GEAR[id];
  if (!gear || !s || (Number(s.chapter) || 1) < gear.chapterMin) return null;
  if (ownsGear(s, id)) {
    return el("p.gear-offer.owned", { dataset: { test: `gear-owned-${id}` }, title: gear.description },
      [el("b", { text: `${gear.short}を使う` }), `：${gear.effect}`]);
  }
  const status = gearStatus(s, id);
  const button = el("button.btn.ghost.small.gear-offer", {
    type: "button", disabled: !status.ok, title: gear.description, dataset: { test: `gear-buy-${id}` },
    text: `${gear.short}を買う ${yen(gear.price)}（${gear.effect}）`, "aria-label": `${gear.name}を${yen(gear.price)}で買う。${gear.effect}`,
    onclick: () => {
      if (!isCurrent() || !buyGear(s, id)) return;
      button.replaceWith(gearOffer(s, id, { onBought, isCurrent }));
      onBought(gear);
    },
  });
  return button;
}
