// 寝る前の一服（家シーシャ・#638 オーナー依頼）。昼と夜に行動したうえでの“ちょい足し”で、行動の枠は使わない。
// 一日の終わり（帰宅のあと・就寝の前）に聞く。自分の葉を12g決めたら、あとは短い場面が進む。
// 自分で配合すれば模索になり（美味しい／普通／イマイチ）、面倒ならレシピ帳から作れる。
// 伸びるのはその時点で一番低い能力（台で量が違う: 卓上台 0.5P・大会公式モデル 0.75P）。体力を少し使う。
import { DB } from "../core/data.js";
import { state, save, STAT_KEYS, STAT_JA } from "../core/state.js";
import { gainStat, statCap, addStamina, staminaAfter, maxStamina } from "../core/stats.js";
import { coldRisk } from "../core/illness.js";
import { el } from "../core/util.js";
import { modal, toast } from "../core/ui.js";
import { emit } from "../core/bus.js";
import { play, vnTest } from "../vn/engine.js";
import { flavorStock, addFlavorStock, ownedFlavorIds } from "./shop.js";
import { evaluateMix, goldenLabel } from "../craft/steps.js";
import { mixPercents } from "../craft/mix-ratio.js";
import { homeRig } from "./home-rig.js";

export const HOME_GRAMS = 12;
export const HOME_STAMINA = -6;
const HOME_BG = "res://assets/backgrounds/bg_home_night.png";

const leafName = (id) => String(DB.flavorById?.[id]?.short_name || DB.flavorById?.[id]?.name || id).split(" ").pop();
const familyOf = (id) => DB.flavorById?.[id]?.family || id;
const dayKey = (s) => `${s.chapter || 1}:${s.day}`;

/** その時点で一番低い能力（上限に届いた能力は除く。同じ値なら並び順）。全部上限なら null */
export function lowestStat(stats = state.stats, cap = statCap()) {
  const open = STAT_KEYS.filter((k) => (stats?.[k] || 0) < cap);
  return open.sort((a, b) => (stats[a] || 0) - (stats[b] || 0))[0] || null;
}

/** 味の手応え。レシピどおりならたいてい美味しい、組み合わせが散ると普通、噛み合わないとイマイチ */
export function tasteOf(info) {
  if (info?.recipe && info.score >= 95) return "great";
  if ((info?.score || 0) >= 80) return "fine";
  return "meh";
}

/** レシピ帳から作るときの配合（12g）。黄金比があればそれで、なければ最初の葉を主役に 2:1:1…。在庫が足りなければ null */
export function recipeMix(recipe, { stockOf = flavorStock, owned = ownedFlavorIds() } = {}) {
  if (!recipe?.flavors?.length) return null;
  const weights = recipe.golden ? recipe.flavors.map((f) => recipe.golden[f] || 0) : recipe.flavors.map((_, i) => (i === 0 ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  // 最大剰余法で合計を必ず12gに
  const raw = weights.map((w) => (HOME_GRAMS * w) / total);
  const grams = raw.map(Math.floor);
  raw.map((r, i) => [r - grams[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, HOME_GRAMS - grams.reduce((a, b) => a + b, 0)).forEach(([, i]) => { grams[i] += 1; });
  const mix = {};
  for (const [i, fam] of recipe.flavors.entries()) {
    // 同じ系統の銘柄のうち、いちばん在庫のある葉を使う
    const id = owned.filter((x) => familyOf(x) === fam).sort((a, b) => stockOf(b) - stockOf(a))[0];
    if (!id || stockOf(id) < grams[i]) return null;
    mix[id] = grams[i];
  }
  return mix;
}

/** 今夜聞くか。台があり、葉が12gあり、今日まだ吸っておらず、大会前夜でなく、体力が赤くならない */
export function homeShishaOffer(s = state, { eve = false } = {}) {
  const rig = homeRig(s);
  if (!rig || eve || s.flags?._home_shisha_day === dayKey(s)) return null;
  const stock = ownedFlavorIds().reduce((sum, id) => sum + flavorStock(id), 0);
  if (stock < HOME_GRAMS) return null;
  if (coldRisk(staminaAfter(HOME_STAMINA) / maxStamina())) return null;
  return rig;
}

/** 一服の結果を反映する（葉を減らす・体力・レシピ帳）。呼び出し側は同じ同期処理で成長も付与してから保存する */
export function applyHomeShisha(mix, rig, s = state) {
  for (const [id, g] of Object.entries(mix)) addFlavorStock(id, -g);
  addStamina(HOME_STAMINA);
  s.flags._home_shisha_day = dayKey(s);
  const info = evaluateMix({ mode: "home", mix, equip: { bowl: s.equip?.bowl || "silicone_bowl" } });
  const taste = tasteOf(info);
  // 自分で組んで当てたレシピはレシピ帳へ（伸びは一番低い能力だけにするので、センスのおまけは付けない）
  const found = info.recipe && !s.recipes?.[info.recipe.id] ? info.recipe : null;
  if (found) (s.recipes ||= {})[found.id] = { day: s.day, home: true };
  return { info, taste, found, stat: lowestStat(s.stats) };
}

/** 一番低い能力を台の分だけ伸ばす（1P未満は次の1Pまでの進みとして持ち越す）。1Pに届いたら通常の能力アップ通知 */
export function growHomeStat(stat, rig) {
  return stat ? gainStat(stat, rig.growth) : 0;
}

// ---------------------------------------------------------------- 画面

const INTROS = {
  home_rig_set: ["部屋の明かりを落として、卓上台に炭をのせる。", "一日の終わり。小さな台に、今日の葉を詰める。", "窓を少し開けて、寝る前の一服を組む。"],
  home_rig_pro: ["本番と同じ台に炭をのせる。手の感覚が、そのまま残る。", "一日の終わり。大会と同じ台で、寝る前の一服を組む。"],
};
const TASTE_LINES = {
  great: "（……これは美味しい。自分で組んで、ちゃんと当たった）",
  fine: "（普通に吸える。悪くはないけど、もう一歩だな）",
  meh: "（……イマイチだ。どこで噛み合わなかったんだろう）",
};

/** 場面の台本（地の文＋はじめの心の声）。全角48字以内・手動改行なし */
export function homeShishaDialogue(result, rig, random = Math.random) {
  const intros = INTROS[rig.id] || INTROS.home_rig_set;
  const lines = [{ speaker: "", face: "", text: intros[Math.floor(random() * intros.length)] },
    { speaker: "hajime", face: "normal", text: TASTE_LINES[result.taste] }];
  if (result.stat) lines.push({ speaker: "hajime", face: "normal", text: `（煙を眺めていたら、苦手な${STAT_JA[result.stat]}のことが浮かんできた）` });
  return { dialogue_id: "home_shisha_night", metadata: { bg: HOME_BG }, lines };
}

/** 自分で配合する（合計12gちょうど）。決めたら mix、やめたら null */
async function chooseMix() {
  const ids = ownedFlavorIds().filter((id) => flavorStock(id) > 0);
  const mix = {};
  const total = () => Object.values(mix).reduce((a, b) => a + b, 0);
  const totalLine = el("p.home-mix-total", { dataset: { test: "home-mix-total" } });
  const rows = ids.map((id) => {
    const g = el("b.home-mix-g", { text: "0g" });
    const ratio = el("span.home-mix-ratio", { dataset: { test: `home-ratio-${id}` } });
    const change = (d) => {
      const next = (mix[id] || 0) + d;
      if (next < 0 || next > flavorStock(id) || (d > 0 && total() >= HOME_GRAMS)) return;
      if (next) mix[id] = next; else delete mix[id];
      redraw();
    };
    const row = el("div.home-mix-row", [
      el("span.home-mix-name", { text: `${leafName(id)}（残り${flavorStock(id)}g）` }),
      el("button.fr-btn", { text: "−", "aria-label": `${leafName(id)}を1g減らす`, dataset: { test: `home-minus-${id}` }, onclick: () => change(-1) }),
      g,
      el("button.fr-btn", { text: "＋", "aria-label": `${leafName(id)}を1g足す`, dataset: { test: `home-plus-${id}` }, onclick: () => change(1) }),
      ratio,
    ]);
    return { id, g, ratio, row };
  });
  const redraw = () => {
    const pct = mixPercents(mix); // 比率（#638）: グラムだけでなく今の割合も見せる
    for (const r of rows) { r.g.textContent = `${mix[r.id] || 0}g`; r.ratio.textContent = mix[r.id] ? `${pct[r.id]}%` : ""; }
    totalLine.textContent = `合計 ${total()}g ／ ${HOME_GRAMS}g`;
    const ok = document.querySelector('[data-test="home-mix-ok"]');
    if (ok) ok.disabled = total() !== HOME_GRAMS;
  };
  const body = el("div.home-mix", [el("p", { text: "自分の葉を1gずつ。合計12gで一服する。" }), ...rows.map((r) => r.row), totalLine]);
  const picked = modal({ title: "寝る前の一服", className: "home-shisha-dialog", body, options: [
    { label: "これで吸う", value: true, primary: true, test: "home-mix-ok" },
    { label: "やめる", value: false, test: "home-mix-cancel" },
  ] });
  redraw();
  return (await picked) && total() === HOME_GRAMS ? { ...mix } : null;
}

/** レシピ帳から作る。作れるレシピがなければ null */
async function chooseRecipe() {
  const options = (DB.recipes || []).filter((r) => state.recipes?.[r.id] && recipeMix(r))
    .map((r) => ({ label: r.name, value: r.id, test: `home-recipe-${r.id}` }));
  if (!options.length) return null;
  const id = await modal({ title: "レシピ帳から作る", className: "home-shisha-dialog", body: "自分の葉で作れるレシピ。量は決まった配合で詰める。",
    options: [...options, { label: "戻る", value: null, test: "home-recipe-back" }] });
  return id ? recipeMix(DB.recipes.find((r) => r.id === id)) : null;
}

/** 一日の終わりに呼ぶ。吸ったら true（行動の枠は使わない） */
export async function runHomeShisha({ eve = false } = {}) {
  // 自動で進めるテスト（会話のターボ）では聞かない。通しプレイが配合の画面で止まらないように（中身は home_shisha.mjs で確かめる）
  if (vnTest.turbo) return false;
  const rig = homeShishaOffer(state, { eve });
  if (!rig) return false;
  const owner = state;
  const canRecipe = (DB.recipes || []).some((r) => state.recipes?.[r.id] && recipeMix(r));
  let mix = null;
  while (!mix) {
    const how = await modal({ title: "寝る前の一服", className: "home-shisha-dialog",
      body: `${rig.name}で一服する？ 自分の葉を${HOME_GRAMS}g使い、体力を少し使う。苦手な能力に手がかりが見えるかも。`,
      options: [
        { label: "自分で配合する", value: "mix", primary: true, test: "home-shisha-mix" },
        ...(canRecipe ? [{ label: "レシピ帳から作る", value: "recipe", test: "home-shisha-recipe" }] : []),
        { label: "今日は寝る", value: null, test: "home-shisha-skip" },
      ] });
    if (!how || state !== owner) return false;
    mix = how === "recipe" ? await chooseRecipe() : await chooseMix();
  }
  const result = applyHomeShisha(mix, rig);
  // 消費・実施済み印・成長を、会話や再読み込みを挟む前に一括で保存する。
  const got = growHomeStat(result.stat, rig);
  save();
  if (result.found) toast(`📖 レシピ帳に書き加えた「${result.found.name}」`, { kind: "good" });
  if (result.info.golden === "hit") toast(`✨ 黄金比！ ${result.info.recipe.name}は ${goldenLabel(result.info.recipe)}`, { kind: "good" });
  await play(homeShishaDialogue(result, rig));
  if (state !== owner) return true;
  if (result.stat && !got) emit("notice", { text: `寝る前に一服した。苦手な【${STAT_JA[result.stat]}】に、手がかりが見えた` });
  save();
  return true;
}
