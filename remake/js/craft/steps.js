import { staffFlavors, staffStock, spendPracticeMix, masteryLabel, mixMasteryProfile } from "../core/flavor-mastery.js";
// 選ぶ工程: 機材・配合・詰め・炭の配置・蒸らし時間。
import { el, sleep, clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { toast, modal } from "../core/ui.js";
import { state } from "../core/state.js";
import { step, earnStat, earnRecipeDiscovery } from "../core/stats.js";
import { growthFeature, growthLesson, densePackAvailable, settleGrowthPhase, LESSON_TUNING } from "../core/growth-effects.js";
import { growthEnabled } from "../core/growth-mode.js";
import { rememberGrowthMix, growthRecallOptions } from "../core/growth-memory.js";
import { effectVisible, effectBadge } from "./effect-visual.js";
import { canSeeMixHint, canSeeGoldenShort } from "../core/stat-step-tables.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, reactAudience, waitBenchReady, dockBenchLeaf, setBenchLeafVisible } from "./session.js";
import { flavorMixLife, LEAF_DAMAGE } from "./flavor-life.js";
import { autoSkill } from "./common.js";
import { mixBowlPreview, packingBowlPreview } from "./art.js";
import { mixTaste } from "./mix-taste.js";
import { flavorStock, addFlavorStock, ownedFlavorIds, flavorPackageArt, SHOP_FLAVORS } from "../daily/shop.js";
import { runSteamTimer } from "./timer.js";
import { cafeNoted } from "../daily/cafe-ideas.js";
import { availableCoalLayouts, coalCount, coalTypes, COAL_UNLOCK, applyCoalTraining } from "./coals.js";
import { buildMixTemperatureGauge } from "./thermometer.js";
import { flavorFamilyGrams } from "./score.js";
import { FOIL_FREE_HMS } from "./holes_logic.js";
import { mixPercents } from "./mix-ratio.js";
import { makerMixProfile } from "./temperature-model.js";
import { flavorFeatureCard, flavorTags, mixForecastCard, equipmentUse, equipmentGuide } from "./flavor-guide.js";

// 章ごとの課題。第1章レモン・第2章の新作苺・第3章ドバジ チョコレート。
// オーナー決定（2026-10-28 13:29）：課題フレーバーは大会が当日 supply で用意し、本番中は無制限に使える。
// 私物在庫は減らさず持ち越しもしない。熟練度は事前の練習でのみ上がるので、買って練習した方が有利。
export const REGULATION = {
  1: { flavor: "lemon", supply: "lemon", min: 2, label: "課題フレーバー「レモン」を2g以上（大会支給）" },
  // 判定は同系統（同じ苺系統の持ち込みも可）。支給する葉は第2章DAY9の試煙会で試したアフサールの新作。
  2: { flavor: "strawberry", supply: "afsahr_strawberry", min: 4, label: "課題フレーバー「ストロベリー」を4g以上" },
  // オーナー決定 10/28：ドバジ・4g以上・大会支給。チョコは通常（chocolate）。
  3: { flavor: "chocolate", supply: "chocolate", min: 4, label: "課題フレーバー「ドバジ チョコレート」を4g以上（大会支給）" },
  // 第5章 SHISHA-9000 戦（docs/archive/setting_book/05_tournament.md）。runner の候補制限に加え、単体12gを判定する。
  5: { flavor: "double_apple", supply: "double_apple", min: 12, exact: 12, label: "課題「ダブルアップル単体12g」（主催支給）" },
};
// 第4章 GRAND SMOKE は自由課題（最高の一台）。課題の葉は無く、出発前にスミさんと決めた方針（ch4_strategy）の葉を
// 「持ち込み申請した葉」として大会側が預かり、本番中は無制限に使える（他章の支給と同じ扱い・私物は減らさない）。
// 方針の葉を何g使うかは自由（min 0）。実採点は ch4-tournament.js、実g・調整の講評は ch4-verdict.js。
export const CH4_PLAN_LEAVES = Object.freeze({ sakura: "sakura", peach: "peach", tea: "black_tea" });
function chapterFourRegulation() {
  const id = CH4_PLAN_LEAVES[state.flags?._ch4_strategy];
  const name = DB.flavorById?.[id]?.short_name || DB.flavorById?.[id]?.name || id;
  return id ? { flavor: id, supply: id, min: 0, free: true, label: `自由課題（最高の一台）。持ち込み申請した「${name}」は使い放題` }
    : { flavor: null, supply: null, min: 0, free: true, label: "自由課題（最高の一台）" };
}
// DAY7の固定練習は仕入れた葉を試す。大会・前日リハーサルの課題は維持する。
export const regulationFor = (cs) => cs.staffPractice || (cs.mode === "rehearsal" && cs.practiceKind === "midcheck") ? null : state.chapter === 1 && cs.mode === "tournament" && state.flags._legacy_mint_tournament
  ? { flavor: "mint", supply: "mint", min: 2, label: "再開中の旧大会：ミント2g以上" }
  : state.chapter === 4 && cs.mode === "tournament" ? chapterFourRegulation()
  : (cs.mode === "tournament" || cs.mode === "rehearsal" ? REGULATION[state.chapter] : null);

// スミさんの手本（チュートリアル中だけ、工程の頭に出す）
const LESSON = {
  setup: "スミ「道具は相棒だ。今日のは店の基本セットでいい」",
  mix: "スミ「まずは基本形。ダブルアップルにミントを少し。迷ったら、ここへ帰ってこい」",
  pack: "スミ「詰めは空気の通り道を作ることだ。ふんわりか、ならすか、固めるか」",
  place: "スミ「炭は三角。基本の配置だ。四つは火が強すぎる」",
  steam: "スミ「分と秒で時間を決めてスタートだ。秒は10秒ずつ動くぞ」",
};

function choose(panel, options, { cols = 2 } = {}) {
  return new Promise((resolve) => {
    const grid = el(`div.opt-grid.cols-${cols}`, options.map((o) =>
      el(`button.opt${o.disabled ? ".off" : ""}`, {
        disabled: o.disabled || null,
        dataset: { test: `opt-${o.value}` },
        onclick: () => { SE.select(); resolve(o.value); },
      }, [
        o.badge ? el("span.opt-badge", { text: o.badge }) : null,
        el("b", { text: o.label }),
        el("small", { text: o.desc || "" }),
      ])));
    panel.append(grid);
    if (autoSkill()) {
      const pickV = options.find((o) => o.auto && !o.disabled) || options.find((o) => !o.disabled);
      setTimeout(() => resolve(pickV.value), 40);
    }
  });
}

const lessonHint = (cs, id, fallback) => id === "mix" && cs.orderHint ? cs.orderHint : (cs.mode === "tutorial" && LESSON[id]) || fallback;

// ---------------------------------------------------------------- 機材

export const isSuyakiBowl = (bowlId) => {
  const b = DB.equipById?.[bowlId];
  return (b?.capacity || 0) >= 20 || String(bowlId || "").startsWith("suyaki");
};

export async function stepSetup(cs) {
  const trained = applyCoalTraining(cs, state.flags);
  await waitBenchReady(cs, "setup");
  const types = [["bowl", "ボウル（ハガル）"], ["hms", "HMD（ヒートマネジメント）"], ["charcoal", "炭（チャコール）"]];
  for (const [type, label] of types) {
    if (type === "charcoal" && !trained) continue;
    const owned = state.owned.map((id) => DB.equipById[id]).filter((e) => e && e.type === type);
    const suyaki = type === "hms" && isSuyakiBowl(cs.equip.bowl);
    const compatible = (e) => type === "bowl"
      ? state.owned.some((id) => DB.equipById[id]?.type === "hms" && !(isSuyakiBowl(e.id) && id === "tanukish_lid"))
      : !(suyaki && e.id === "tanukish_lid");
    const selectable = owned.filter(compatible);
    // 所持品だけでは制作できない旧セーブでも、未所持機材を補って確定しない。
    if (!selectable.length) throw new Error(`${label}に対応する所持機材がありません`);
    if (owned.length <= 1) {
      cs.equip[type] = selectable[0].id;
      continue;
    }
    const currentId = state.equip[type];
    const categoryHint = { bowl: "ハガルは葉を詰める器。使う量と狙う味で選ぼう", hms: "HMDは炭を載せる道具。温度の合わせやすさを見比べよう", charcoal: "同じ3個でも熱の入り方が変わる。狙う温度で選ぼう" };
    const panel = stepPanel("setup", `機材 ${label}`, lessonHint(cs, "setup", categoryHint[type]));
    panel.append(el("button.btn.small.equipment-compare", { type: "button", text: "性能を見比べる", dataset: { test: "setup-compare" },
      onclick: () => modal({ title: `${label}を見比べる`, className: "flavor-guide-dialog", body: el("div.equipment-compare-list", owned.map(item =>
        el("section", [el("b", { text: item.name }), equipmentGuide(item, currentId)]))),
      options: [{ label: "選択に戻る", primary: true, test: "setup-compare-close" }] }),
    }));
    cs.equip[type] = await choose(panel, owned.map((e) => {
      const disabled = !compatible(e);
      const guide = equipmentUse(e);
      return {
        value: e.id, label: e.name,
        desc: `${guide.use}${guide.caution ? ` ／ 注意：${guide.caution}` : ""}`,
        disabled, badge: disabled ? (type === "bowl" ? "対応するHMDを持っていません" : "素焼き非対応") : e.id === currentId ? "装備中" : null,
        auto: !disabled && e.id === currentId,
      };
    }));
    // ロートスを選んだら、アルミを付けるか選べる（既定はアルミなし／#1107 B2）。
    if (type === "hms" && FOIL_FREE_HMS.includes(cs.equip.hms) && cs.mode !== "tutorial" && cs.mode !== "drill") await chooseFoilOption(cs);
  }
  // 制作中の制限で旧セーブの装備・所有品を消さない。
  state.equip = { ...cs.equip, ...(!trained ? { charcoal: state.equip.charcoal } : {}) };
  refreshBench();
}

/** ロートスHMDで、アルミを付けて作るか選ぶ。既定はアルミなし（穴あけを飛ばす）。 */
async function chooseFoilOption(cs) {
  const panel = stepPanel("setup", "機材 アルミ", lessonHint(cs, "setup", "ロートスはアルミなしで使える。アルミを足すと穴あけの工程が増える"));
  cs.foilOptIn = await choose(panel, [
    { value: false, label: "アルミなしで作る", desc: "ロートスに直接のせる。穴あけはしない", auto: !cs.foilOptIn },
    { value: true, label: "アルミを付けて作る", desc: "アルミを張って穴を開ける。熱の入り方を自分で決める", auto: !!cs.foilOptIn },
  ]);
}

// ---------------------------------------------------------------- ミックス

function capacity(cs) {
  return DB.equipById[cs.equip.bowl]?.capacity || 12;
}

const familyKeyOf = (id) => DB.flavorById?.[id]?.family || id;

// 黄金比（#627）: レシピの golden（系統ID→整数の比）と実際の割合の差（パーセントポイント・境界を含む）。
// 小数の誤差で境界がずれないよう整数で比べる。配合点には足さない（加点の置き場所は未決定）。
export const GOLDEN_TOLERANCE = 5;
export const GOLDEN_NEAR = 12;

/** 黄金比の判定。{ level: "hit"|"near"|null, short: 一番足りない系統ID（惜しいときだけ） }。golden の無いレシピは null */
export function goldenRatioOf(recipe, mix, flavorById = DB.flavorById) {
  const golden = recipe?.golden;
  if (!golden) return null;
  const keys = Object.keys(golden);
  const grams = keys.map((k) => Math.round(flavorFamilyGrams(mix, k, flavorById) * 10)); // 0.1g単位の整数
  const total = grams.reduce((a, b) => a + b, 0);
  const weight = keys.reduce((s, k) => s + golden[k], 0);
  if (!total || !weight) return null;
  let worst = 0, short = null, shortGap = 0;
  keys.forEach((k, i) => {
    const diff = grams[i] * weight - golden[k] * total; // 負＝その葉が足りない
    worst = Math.max(worst, Math.abs(diff));
    if (diff < shortGap) { shortGap = diff; short = k; }
  });
  const within = (tol) => 100 * worst <= tol * weight * total;
  const level = within(GOLDEN_TOLERANCE) ? "hit" : within(GOLDEN_NEAR) ? "near" : null;
  return { level, short: level === "near" ? short : null };
}

const leafName = (id) => String(DB.flavorById?.[id]?.short_name || DB.flavorById?.[id]?.name || id).split(" ").pop();
/** 「レモン7：ミント3」 */
export const goldenLabel = (recipe) => Object.entries(recipe?.golden || {}).map(([id, w]) => `${leafName(id)}${w}`).join("：");

/** ミックスの評価（相性・レシピ・NG・レギュレーション） */
export function evaluateMix(cs) {
  const mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  const ids = Object.keys(mix);
  const total = ids.reduce((s, id) => s + mix[id], 0);
  const notes = [];
  const ngReasons = [];
  // 単体でも香りの完成した一台になる。種類数だけで二種より低くしない。
  let score = [0, 84, 84, 80, 70][Math.min(4, ids.length)] - (ids.length > 4 ? 8 : 0);
  const key = [...new Set(ids.map(familyKeyOf))].sort().join("+");
  const recipe = DB.recipes.find((r) => r.flavors.slice().sort().join("+") === key) || null;
  if (recipe) { score += 14; notes.push(`レシピ「${recipe.name}」の組み合わせ`); }
  const cardamom = flavorFamilyGrams(mix, "cardamom");
  const bridge = growthLesson(state, "M-W6") && cardamom > 0 && cardamom / total <= .2;
  for (const ng of DB.ngMixes) {
    const [a, b] = ng.flavors;
    const aGrams = flavorFamilyGrams(mix, a), bGrams = flavorFamilyGrams(mix, b);
    if (aGrams <= 0 || bGrams <= 0) continue;
    const hit =
      (ng.condition === "both_over_5g" && aGrams > 5 && bGrams > 5) ||
      (ng.condition === "both_over_4g" && aGrams > 4 && bGrams > 4) ||
      (ng.condition === "combined_over_10g" && aGrams + bGrams > 10) ||
      (ng.condition === "ratio_close" && Math.abs(aGrams - bGrams) <= 1);
    if (hit) {
      score += ng.penalty * 3 * (bridge ? LESSON_TUNING.cardamomPenalty : 1);
      notes.push(ng.text); ngReasons.push(ng.text);
      if (bridge && !notes.includes("カルダモンの一つまみで、ぶつかりがやわらいだ")) notes.push("カルダモンの一つまみで、ぶつかりがやわらいだ");
    }
  }
  const main = Math.max(...ids.map((id) => mix[id]), 0) / (total || 1);
  if (ids.length >= 2 && main >= 0.45 && main <= 0.8) { score += 4; notes.push("主役と脇役の比率がいい"); }
  if (total > 0 && growthLesson(state, "M-S6") && flavorFamilyGrams(mix, "blueberry") / total >= .2) {
    score += LESSON_TUNING.mix; notes.push("ブルーベリーに帰る。香りがまとまった");
  }
  const tea = flavorFamilyGrams(mix, "black_tea") / total;
  if (total > 0 && growthLesson(state, "M-B5") && tea >= .1 && tea <= .2) {
    score += LESSON_TUNING.mix; notes.push("ブラックティーを一割。香りに奥行きが出た");
  }
  if (ids.length === 1 && cs.singleStyle === true && growthLesson(state,"M-S2")) {
    const mastery = mixMasteryProfile(cs.masteryAtStart ? {flavorMastery:cs.masteryAtStart} : state,mix,DB.flavorById);
    score += mastery.progress * LESSON_TUNING.single;
    notes.push("単体の美学。使い慣れた葉の深みで勝負する");
  }
  const reg = regulationFor(cs);
  const competitionLegal = cs.mode !== "tournament" || ids.every(id => isTournamentFlavorLegal(id));
  const regOk = competitionLegal && (!reg || (reg.exact != null
    ? ids.length === 1 && total === reg.exact && flavorFamilyGrams(mix, reg.flavor) === reg.exact
    : flavorFamilyGrams(mix, reg.flavor) >= reg.min));
  if (reg && ids.length > 1 && flavorFamilyGrams(mix, "mint") > 6) { score -= 6; notes.push("ミントが強すぎて、他の香りが隠れている"); }
  // 味の傾向（重さ平均）
  const prof = {};
  for (const id of ids) {
    const st = DB.flavorById[id]?.stats || {};
    for (const [k, v] of Object.entries(st)) prof[k] = (prof[k] || 0) + (v * mix[id]) / total;
  }
  const maker = makerMixProfile(cs);
  // 黄金比は減点・課題フレーバーとは別の判定（黄金比でも減点は残る）。点は動かさない
  const golden = recipe && cs.mode !== "tutorial" ? goldenRatioOf(recipe, mix) : null;
  if (golden?.level === "hit") notes.push(`黄金比（${goldenLabel(recipe)}）`);
  return {
    golden: golden?.level || null, goldenShort: golden?.short || null,
    score: clamp(Math.round(score), 25, 100), total, recipe, notes, ngReasons, regOk, profile: prof,
    count: ids.length, intensity: prof.assertiveness || 5, cooling: prof.cooling || 0, maker,
  };
}

/**
 * 配合を使用可能な葉に収める。並んでいない葉は外し、各葉は残量まで・合計は器の量まで。
 * minTotal を渡すと、足りない分を残量の多い葉から1gずつ足す（自動操作で決定できる配合にする）。
 */
export function fitMixToStock(mix, ids, limit, cap, minTotal = 0) {
  const out = {};
  let total = 0;
  for (const [id, g] of Object.entries(mix || {})) {
    if (!ids.includes(id)) continue;
    const take = Math.max(0, Math.min(g, limit(id), cap - total));
    if (take > 0) { out[id] = take; total += take; }
  }
  const room = (id) => limit(id) - (out[id] || 0);
  while (total < Math.min(minTotal, cap)) {
    const id = ids.filter((x) => room(x) > 0).sort((a, b) => room(b) - room(a))[0];
    if (!id) break;
    out[id] = (out[id] || 0) + 1;
    total++;
  }
  return out;
}

/** 大会で使える葉か（#1279 明示ゲート）: 未発売の試作葉（competition_legal: false）は章によらず不可。
 *  発売章 chapter_min が現在の章（その周回の進行）に達していない葉は、持ち越し在庫でも大会では使えない。 */
export function isTournamentFlavorLegal(id, chapter = state.chapter) {
  const f = DB.flavorById[id];
  if (!f || f.competition_legal === false) return false;
  return (f.chapter_min || 1) <= chapter;
}

export function mixFlavorIds(cs) {
  const reg = regulationFor(cs);
  // 大会は課題フレーバーを無制限に支給（私物在庫は減らさない・持ち越さない）。課題以外の葉だけ在庫から持ち込む。
  // 店の練習は店頭の葉も使え、私物を減らさない（#783）。
  const consumes = cs.mode === "tournament";
  const supplyId = reg?.supply || null;
  let ids = ownedFlavorIds(); // 店の品＋限定サンプル＋もらった葉（贈られたハガルに添えられたカルダモン等）
  if (!consumes) ids = [...new Set(["lemon", "mint", "double_apple", state.flags._prep_flavor].filter(Boolean))].filter(id => DB.flavorById[id]);
  if (supplyId && !ids.includes(supplyId)) ids.unshift(supplyId);
  if (cs.staffPractice) ids = [...new Set([...staffFlavors(state), ...ownedFlavorIds()])].filter(id => DB.flavorById[id]);
  if (cs.mode === "tutorial") ids = ["double_apple", "mint"];
  if (cs.orderFlavorIds) ids = cs.orderFlavorIds.filter(id => DB.flavorById[id]);
  // 支給・注文指定・まかないの経路でも、大会使用不可の葉を再混入させない。
  if (consumes) ids = ids.filter(id => isTournamentFlavorLegal(id));
  return ids;
}

export async function stepMix(cs) {
  const owner = state;
  await waitBenchReady(cs, "mix");
  if (state !== owner) throw new DOMException("Mix owner changed", "AbortError");
  const reg = regulationFor(cs);
  const cap = capacity(cs);
  const panel = stepPanel("mix", "フレーバーのミックス", lessonHint(cs, "mix", `${cap}gまで詰められるボウル。${reg ? reg.label + (reg.free ? "。" : "が今日の課題。") : ""}${reg?.exact != null ? `合計${reg.exact}gちょうどで決める` : "合計12g以上で決める"}`));
  const consumes = cs.mode === "tournament";
  const supplyId = reg?.supply || null;
  const supplied = (id) => !!reg && id === supplyId;
  const ids = mixFlavorIds(cs);
  const limit = (id) => cs.staffPractice ? staffStock(state, id) + flavorStock(id) : (consumes && !supplied(id) ? flavorStock(id) : Infinity);
  const practiceFlavor = cs.mode === "rehearsal" && !cs.staffPractice ? state.flags._prep_flavor : null;
  cs.mix = practiceFlavor && ids.includes(practiceFlavor) ? (practiceFlavor === "lemon" ? { lemon: 10, mint: 2 } : { [practiceFlavor]: 10, lemon: 2 }) : {};
  const lcd = el("div.lcd");
  const vessel = el("div.mix-vessel", { dataset: { test: "mix-vessel" } });
  const taste = el("div.mix-taste", { "aria-live": "polite", dataset: { test: "mix-taste" } });
  const compactTaste = el("div.mix-taste-compact", { dataset: { test: "mix-taste-compact" } });
  const regLine = el("div.reg-line");
  const recipeLine = el("div.recipe-line");
  const thermometer = buildMixTemperatureGauge(cs, { vertical: true });
  const idealLine = el("span.mix-ideal"), optimalLine = el("span.mix-optimal");
  const temperatureHint = el("small", { text: "上が高温" });
  // #1081 E02: 蒸らし・吸い出しで初めて出る「フレーバーの持ち」を、葉を決めるこの工程でも左の窓で先に見せる。
  // 既存の共有ゲージ（bench.leaf）と flavorMixLife をそのまま表示するだけで、新しい計算はしない。
  const lifeHost = el("span.mix-life-leaves");
  const lifeNote = el("small.mix-life-note", { "aria-live": "polite" });
  const lifePreview = cs.mode === "tutorial" ? null : el("div.mix-life-preview", { dataset: { test: "mix-life-preview" } }, [
    el("b", { text: "フレーバーの持ち" }), lifeHost, lifeNote,
  ]);
  const temperaturePreview = el("div.mix-temperature-preview", { hidden: cs.mode === "tutorial", dataset: { test: "mix-temperature-preview" } }, [
    el("b", { text: "温度帯" }),
    thermometer.root,
    el("div.mix-temperature-legend", { "aria-live": "polite" }, [idealLine, optimalLine]),
    temperatureHint,
  ]);
  const singleStyle = cs.mode !== "tutorial" && growthLesson(state,"M-S2") ? el("button.btn.ghost.small", {
    text:"単体で勝負", dataset:{test:"mix-single-style"}, "aria-pressed":String(!!cs.singleStyle),
    onclick:()=>{cs.singleStyle=!cs.singleStyle;SE.select();redraw();},
  }) : null;
  const okBtn = el("button.btn.primary", { disabled: true, dataset: { test: "mix-ok" } }, [el("span.btn-label", { text: "このフレーバーで詰める" })]);
  const totalOf = () => Object.values(cs.mix).reduce((s, g) => s + g, 0);

  const redraw = () => {
    const total = totalOf();
    lcd.textContent = `${total.toFixed(1)} g / ${cap} g`;
    lcd.classList.toggle("ok", total >= 12 && total <= cap && (reg?.exact == null || total === reg.exact));
    vessel.replaceChildren(mixBowlPreview(cs, total));
    vessel.dataset.filled = String(total > 0);
    const aroma = cs.mode === "tournament" && cs.chapter === 2
      ? { headline: "苺の輪郭が、つかめない", detail: "ミックスは見えている。でも、舌では確かめられない。手元と温度を頼りに組み立てよう。", tags: ["味覚の不調"] }
      : mixTaste(cs.mix);
    const tasteDisrupted = cs.mode === "tournament" && cs.chapter === 2;
    if (tasteDisrupted) {
      for (const host of [taste, compactTaste]) host.replaceChildren(el("b", { text: aroma.headline }), el("p", { text: aroma.detail }));
    } else {
      const masteryState = cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state;
      const mastery = mixMasteryProfile(masteryState, cs.mix, DB.flavorById);
      const precision = mastery.progress;
      const compactOpen = compactTaste.querySelector(".flavor-forecast-compact")?.open;
      taste.replaceChildren(mixForecastCard(cs, { precision, mastery, aroma }));
      compactTaste.replaceChildren(mixForecastCard(cs, { precision, mastery, aroma, compact: true }));
      if (compactOpen) compactTaste.querySelector(".flavor-forecast-compact")?.setAttribute("open", "");
    }
    const info = evaluateMix(cs);
    const bands = thermometer.updateBands();
    const expressive = bands.expressionWeight >= .999;
    idealLine.textContent = bands.selected ? expressive ? "おいしい範囲" : "適温の目安" : "未選択";
    optimalLine.textContent = bands.selected ? expressive ? "低め／高め" : "合わせやすい" : "葉を加えると表示";
    temperatureHint.textContent = expressive ? "上が高温／味が変わる" : "上が高温／線は中心";
    const m = info.maker;
    const synergyText = m.makerCount <= 1 ? "単一メーカー" : `${m.makerCount}社ミックス`;
    temperaturePreview.title = `${expressive ? "緑はおいしく作れる範囲。低めと高めで香りが変わる。" : "緑は適温の目安。中央はこの配合で合わせやすい温度。"} 装備×メーカー適温幅 ×${m.totalWidthScale.toFixed(2)}（${synergyText}）`;
    regLine.textContent = reg ? `${info.regOk ? "✓" : "✗"} ${reg.label}` : "";
    regLine.classList.toggle("ok", info.regOk);
    recipeLine.textContent = info.recipe ? `📖 ${info.recipe.name}` : "";
    okBtn.disabled = !(total >= 12 && total <= cap && info.regOk && (!singleStyle || !cs.singleStyle || Object.values(cs.mix).filter(g=>g>0).length===1));
    if(singleStyle)singleStyle.setAttribute("aria-pressed",String(!!cs.singleStyle));
    // フレーバーの持ち（#1081 E02）: 配合で決まる傷みにくさ（flavorMixLife）を一言で。基準1.0との比較だけで、新しい閾値は作らない。
    if (lifePreview) {
      const life = flavorMixLife(cs);
      lifeNote.textContent = total <= 0 ? "葉を選ぶと表示"
        : life > LEAF_DAMAGE.mixLifeDefault ? "この配合は少し長持ち"
        : life < LEAF_DAMAGE.mixLifeDefault ? "この配合は少し早く傷みやすい"
        : "持ちは標準";
    }
    // 比率（#638）: グラムだけでなく、今の割合も見せる（表示のみ・判定には使わない）
    const pct = mixPercents(cs.mix);
    rows.forEach((r) => { r.g.textContent = `${cs.mix[r.id] || 0}g`; r.ratio.textContent = cs.mix[r.id] ? `比率 ${pct[r.id]}%` : ""; });
    refreshBench();
  };

  const rows = ids.map((id) => {
    const f = DB.flavorById[id];
    const tags = flavorTags(f), shortTag = tags.split("・")[0];
    const stockTag = shortTag ? ` · ${shortTag}` : "";
    const g = el("span.fr-g", { text: "0g" });
    const ratio = el("small.fr-ratio", { dataset: { test: `mix-ratio-${id}` } });
    const change = (d) => {
      const cur = cs.mix[id] || 0;
      const next = clamp(cur + d, 0, cap);
      if (d > 0 && totalOf() + d > cap) { SE.error(); return; }
      if (d > 0 && cur + d > limit(id)) { SE.error(); toast(`${f?.short_name || f?.name || id}の${consumes ? "持ち込み" : "手持ち"}は残り${flavorStock(id)}gまで`, { kind: "warn" }); return; }
      cs.mix[id] = next;
      // シロップを含む葉を取る操作はほぼ無音。数字を減らすUIだけ短いクリック。
      if (d < 0) SE.click();
      redraw();
    };
    const row = el("div.flavor-row", { dataset: { flavor: id } }, [
      el("span.fr-package", [flavorPackageArt(id, 54)]),
      el("div.fr-name", [
        el("button.fr-feature", { type: "button", dataset: { test: `flavor-info-${id}` }, "aria-label": `${f?.short_name || f?.name || id}の特徴を見る`,
          onclick: () => modal({ title: f?.short_name || f?.name || id, className: "flavor-guide-dialog", body: flavorFeatureCard(f, { description: f?.description }),
            options: [{ label: "配合に戻る", primary: true, test: "flavor-info-close" }] }),
        }, [el("b", { text: f?.short_name || f?.name || id })]),
        supplied(id) ? el("small.fr-reg", { text: `${reg.free ? "持ち込み申請" : "課題（支給）"}${stockTag}` })
          : consumes ? el("small.fr-stock", { text: `残り${flavorStock(id)}g${stockTag}` })
          : el("small", { text: tags }),
        el("small.fr-mastery", { text: masteryLabel(state, id, DB.flavorById) }),
        cs.staffPractice ? el("small.fr-stock", { text: `まかない ${staffStock(state, id)}g ／ 私物 ${flavorStock(id)}g（まかない優先）` }) : null,
        ratio,
      ]),
      el("button.fr-btn", { text: "−", "aria-label": `${f?.short_name || f?.name || id}を1g減らす`, dataset: { test: `mix-minus-${id}` }, onclick: () => change(-1) }),
      g,
      el("button.fr-btn", { text: "＋", "aria-label": `${f?.short_name || f?.name || id}を1g足す`, dataset: { test: `mix-plus-${id}` }, onclick: () => change(1) }),
    ]);
    return { id, g, ratio, row };
  });

  // 洞察の段: 相性のいい組み合わせのヒント（レシピ帳・聞いた話から）。喫茶こはくで思いついた配合は洞察に関係なく出す
  const insightful = canSeeMixHint(step("insight")) || growthFeature(state, "pairing");
  const hint = cs.mode !== "tutorial"
    ? DB.recipes.find((r) => r.flavors.every((f) => ids.includes(f)) && !state.recipes?.[r.id] && cafeNoted(state, r))
      || (insightful ? DB.recipes.find((r) => r.flavors.every((f) => ids.includes(f)) && (state.flags[`_note_${r.hint_note}`] || r.id === "sumi_basic")) : null)
    : null;
  const recall = cs.mode !== "tutorial" ? growthRecallOptions(state, DB.recipes, DB.flavorById, ids) : [];

  panel.append(el("div.mix", [
    el("div.mix-side", [vessel, taste, lifePreview, recipeLine]),
    // ひらめきは葉の組み合わせの助言なので葉の一覧の頭に置き、決定欄に隠れないようにする（#907）。
    // 見出しとまとめて1要素にし、一覧の子の数（行数に応じた配置の切り替え）を変えない。
    el("div.mix-list", [el("div.mix-list-head", [singleStyle,
      recall.length ? el("details.mix-recall", [el("summary", { text: "香りの記憶" }),
        el("div.chips", recall.map(option => el("button.btn.ghost.small", {
          text: option.name, dataset: { test: `mix-recall-${option.id}` }, onclick: () => {
            cs.mix = fitMixToStock(option.mix, ids, limit, cap);
            redraw();
          },
        }))),
      ]) : null,
      el("p.mix-list-caption", { text: cs.orderFlavorIds ? "店の支給葉。サッパリ系から、1gずつ器へ。" : "葉を1gずつ、器へ。" }),
      compactTaste,
      hint ? el("div.mix-hint", { dataset: { test: "mix-hint" } }, [
        insightful && effectVisible("insight") ? effectBadge("insight", "察") : null,
        el("span", { text: `ひらめき: ${hint.hint_text || hint.idea_hint || hint.memo}` }),
      ]) : null,
    ]), ...rows.map((r) => r.row)]),
    temperaturePreview,
    el("div.mix-footer", [el("div.mix-amount", [lcd, regLine]), okBtn]),
  ]));
  redraw();
  // 共有の葉ゲージを左の窓へ移し、配合中だけ見えるようにする（蒸らし以降は既存どおり元の位置へ戻る）。
  if (lifePreview) { dockBenchLeaf(cs, lifeHost); setBenchLeafVisible(cs, true); }
  await new Promise((resolve) => {
    okBtn.addEventListener("click", () => { SE.select(); resolve(); });
    if (autoSkill()) {
      // 上手=スミさんの基本形（ダブルアップル＋ミント）／下手=規定ぎりぎりの雑な配合
      if (autoSkill() === "good" || cs.mode === "tutorial") {
        const sideFlavor = regulationFor(cs)?.flavor || "mint";
        const mainFlavor = practiceFlavor && ids.includes(practiceFlavor) ? practiceFlavor : "double_apple";
        cs.mix = mainFlavor === sideFlavor ? { [mainFlavor]: 12 } : { [mainFlavor]: 9, [sideFlavor]: 3 };
      }
      else { cs.mix = { double_apple: 5, mint: 7 }; }
      if (reg?.flavor === "strawberry") {
        const apple = autoSkill() === "good" ? Math.min(12 - reg.min, flavorStock("double_apple")) : 0;
        cs.mix = { [supplyId]: 12 - apple, ...(apple ? { double_apple: apple } : {}) };
      }
      if (reg?.flavor === "lemon") cs.mix = { lemon: 3, double_apple: 9 };
      if (reg?.flavor === "chocolate") cs.mix = { chocolate: 4, double_apple: 8 };
      if (reg?.free && reg.flavor) cs.mix = { [reg.flavor]: 12 }; // 第4章: 方針の葉だけの一台（持ち込み申請分で足りる）
      if (cs.staffPractice || consumes) cs.mix = fitMixToStock(cs.mix, ids, limit, cap, 12);
      if (cs.orderFlavorIds) cs.mix = fitMixToStock({ lemon: 9, mint: 3 }, ids, limit, cap, 12);
      redraw();
      setTimeout(() => okBtn.click(), 60);
    }
  });
  if (state !== owner) throw new DOMException("Mix owner changed", "AbortError");
  cs.mix = Object.fromEntries(Object.entries(cs.mix).filter(([, g]) => g > 0));
  if (consumes) for (const [id, g] of Object.entries(cs.mix)) if (!supplied(id)) addFlavorStock(id, -g);
  if (cs.staffPractice) { cs.practiceSpent = spendPracticeMix(state, cs.mix); if (!cs.practiceSpent) throw new Error("練習用の葉が不足しています"); }
  cs.mixInfo = evaluateMix(cs);
  settleGrowthPhase(state, cs, "mix", cs.mixInfo, cs.mixInfo.golden === "hit");
  if (cs.mode !== "tutorial") rememberGrowthMix(state, cs.mix);
  reactAudience(cs, cs.mixInfo.score >= 65 ? "good" : "bad", { force: true });
  // レシピ帳への登録（新発見のときだけ）
  const r = cs.mixInfo.recipe;
  const discovered = r && !state.recipes[r.id];
  if (discovered) {
    state.recipes[r.id] = { day: state.day };
    toast(`📖 レシピ帳に書き加えた「${r.name}」`, { kind: "good" });
    if (cs.mode !== "tournament") earnStat("sense", 1);
  }
  if (r && !["tutorial", "tournament", "home"].includes(cs.mode)) {
    earnRecipeDiscovery(r.id, { discovered, golden: cs.mixInfo.golden === "hit" });
  }
  // 黄金比（#627）: 配合中は出さず、確定したあとだけ知らせる（＋−を押すだけで答えが探せないように）
  if (cs.mixInfo.golden === "hit") toast(`✨ 黄金比！ ${r.name}は ${goldenLabel(r)}`, { kind: "good" });
  else if (cs.mixInfo.golden === "near") {
    const short = (canSeeGoldenShort(step("insight")) || growthFeature(state, "golden")) && cs.mixInfo.goldenShort;
    toast(short ? `黄金比まで、あと少し。もう少し${leafName(short)}を` : "黄金比まで、あと少し",
      { kind: short && effectVisible("insight") ? "insight-hint" : "" });
  }
  // 配合中の予告には出さず、確定したNG理由だけを1件知らせる。
  if (cs.mixInfo.ngReasons.length) toast(cs.mixInfo.ngReasons[0]);
  await sleep(200);
}

// ---------------------------------------------------------------- 詰め・配置・蒸らし時間

export async function stepPack(cs) {
  const owner = state;
  await waitBenchReady(cs, "pack");
  if (state !== owner) throw new DOMException("Packing owner changed", "AbortError");
  // 通常公開前の旧モードで見た選択肢も、後日の盤公開で奪わない。
  if (!growthEnabled()) state.flags._dense_pack_legacy = true;
  const dense = densePackAvailable(state);
  const panel = stepPanel("pack", "パッキング", lessonHint(cs, "pack", "空気の通り道を作る。詰め方で抜けと熱の入り方が変わる"));
  const options = [
    { value: "fluffy", label: "ふんわり", surface: "空気を残す・軽い吸い心地", desc: "熱が早く入る。軽い一台を狙う時に。温めすぎに注意" },
    { value: "normal", label: "ノーマル", surface: "均等にならす・基本", desc: "熱の入り方と抜けが標準。初めての葉や器具を試す時に" },
    { value: "firm", label: "デンスパック", surface: dense ? "密に詰める・厚い味へ" : "心得の盤で習得", locked: !dense,
      desc: "蒸らしを長めにして厚みを出す。吸い心地は重くなる" },
  ];
  let selected = options.find(o => o.value === cs.pack && !o.locked) || options[1];
  const vessel = el("div.pack-vessel", { role: "img", dataset: { test: "pack-vessel" } });
  const caption = el("div.pack-caption", { "aria-live": "polite" });
  const confirm = el("button.btn.primary.pack-confirm", { dataset: { test: "pack-confirm" } }, [
    el("span.btn-label", { text: "この詰め方で決める" }),
  ]);
  const choices = options.map(option => el("button.pack-choice", {
    type: "button", disabled: !!option.locked, dataset: { test: `opt-${option.value}` },
    onclick: () => { if (option.locked) return; selected = option; SE.select(); draw(); },
  }, [el("b", { text: option.label }), el("small", { text: option.surface })]));
  function draw() {
    vessel.dataset.pack = selected.value;
    vessel.setAttribute("aria-label", `${DB.equipById[cs.equip.bowl]?.name || "ハガル"}：${selected.label}。${selected.surface}`);
    vessel.replaceChildren(packingBowlPreview(cs, selected.value));
    caption.replaceChildren(el("b", { text: selected.label }), el("p", { text: selected.desc }));
    choices.forEach((button, i) => button.setAttribute("aria-pressed", String(options[i] === selected)));
  }
  panel.append(el("div.packing", [
    el("p.pack-aroma", { dataset: { test: "mix-confirmed-taste" }, text: mixTaste(cs.mix).detail }),
    vessel, caption,
    el("div.pack-choices", { role: "group", "aria-label": "詰め方を見比べる" }, choices),
    el("div.pack-footer", [el("small", { text: "葉の量はそのまま。詰め方を見比べよう" }), confirm]),
  ]));
  draw();
  cs.pack = await new Promise(resolve => {
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      choices.forEach(button => { button.disabled = true; });
      resolve(selected.value);
    }, { once: true });
    if (autoSkill()) setTimeout(() => confirm.click(), 40);
  });
  SE.stamp();
  refreshBench();
}

export async function stepVent(cs) {
  await waitBenchReady(cs, "holes");
  const first = ["rehearsal", "practice", "tournament"].includes(cs.mode) && !state.flags._lotos_vent_hint;
  const hint = first ? "スミ「迷ったら通気は開けとけ。閉じれば熱がこもって、待ちも一口も強くなる」" : "";
  const panel = stepPanel("holes", "蓋の通気", hint, { brief: "蓋の通気を選ぶ" });
  if (first) state.flags._lotos_vent_hint = true;
  cs.vent = await choose(panel, [
    { value: "open", label: "通気を開ける（標準）", auto: true },
    { value: "closed", label: "通気を閉じる（熱がこもる）" },
  ]);
}

export async function stepPlace(cs) {
  if (!applyCoalTraining(cs, state.flags)) { refreshBench(); return; }
  await waitBenchReady(cs, "place");
  const panel = stepPanel("place", "炭の配置", lessonHint(cs, "place", "基本は同じ炭を三角に3個。配置を決めてから炭を焼く"));
  const layouts = availableCoalLayouts(cs.mode === "tutorial" ? {} : state.flags);
  cs.place = await choose(panel, layouts.map(value => value === "triangle"
    ? { value, label: "トライアングル（3個）", desc: "三角に置いて、熱を均等に届ける", auto: true }
    : { value, label: "4点置き（4個）", desc: "熱が強く入る配置。温度を見て調整する" }));
  cs.coalTypes = coalTypes({ ...cs, coalTypes: null });
  if (cs.mode !== "tutorial" && state.flags[COAL_UNLOCK.mixed] && state.owned.includes("flat_charcoal") && state.owned.includes("cube_charcoal")) {
    const n = coalCount(cs);
    const combination = await choose(stepPanel("place", "炭の組み合わせ", "フラットとキューブの火力を組み合わせる"), [
      { value: "same", label: "同じ炭で揃える", desc: `${n}個とも選んだ炭を使う`, auto: true },
      { value: "mixed", label: "フラット＋キューブ", desc: `キューブ1個とフラット${n - 1}個` },
    ]);
    if (combination === "mixed") cs.coalTypes = ["cube_charcoal", ...Array(n - 1).fill("flat_charcoal")];
  }
  refreshBench();
}

export async function stepSteamTime(cs) {
  await waitBenchReady(cs, "timer");
  await runSteamTimer(cs);
}
