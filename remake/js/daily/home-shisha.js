import { notifyMastery } from "../core/mastery-notice.js";
import { gainFlavorExperience, masteryLabel } from "../core/flavor-mastery.js";
// 寝る前の一服（家シーシャ・#638 オーナー依頼）。昼と夜に行動したうえでの“ちょい足し”で、行動の枠は使わない。
// 一日の終わり（帰宅のあと・就寝の前）に聞く。自分の葉を12g決めたら、あとは短い場面が進む。
// 自分で葉を選んで味の特徴を覚える。レシピ帳からも作れる。
// 育つのは配合したフレーバーの熟練度だけ。ステータスは増えず、体力24を使う。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { addStamina, staminaAfter, maxStamina } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
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
export const HOME_STAMINA = -24;
const HOME_BG = "res://assets/backgrounds/bg_home_night.png";

const leafName = (id) => String(DB.flavorById?.[id]?.short_name || DB.flavorById?.[id]?.name || id).split(" ").pop();
const familyOf = (id) => DB.flavorById?.[id]?.family || id;
const dayKey = (s) => `${s.chapter || 1}:${s.day}`;

/** 内部の手応え区分。会話のフレーバー感想には使わない。 */
export function tasteOf(info) {
  if (info?.count === 1 && info.score >= 80) return "great";
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

/** 今夜聞くか。台があり、葉が12gあり、今日まだ吸っておらず、大会前夜でなく、現在体力が緑で、消耗後に風邪リスクがない */
export function homeShishaOffer(s = state, { eve = false } = {}) {
  const rig = homeRig(s);
  if (!rig || eve || s.flags?._home_shisha_day === dayKey(s)) return null;
  const stock = ownedFlavorIds().reduce((sum, id) => sum + flavorStock(id), 0);
  if (stock < HOME_GRAMS) return null;
  if (conditionForRatio(s.stamina / maxStamina()).health !== "green") return null;
  if (coldRisk(staminaAfter(HOME_STAMINA) / maxStamina())) return null;
  return rig;
}

/** 一服の結果を反映する（葉を減らす・体力・レシピ帳）。呼び出し側は同じ同期処理で成長も付与してから保存する */
export function applyHomeShisha(mix, rig, s = state) {
  const entries = Object.entries(mix || {});
  if (s.flags._home_shisha_day === dayKey(s) || entries.some(([id, g]) => !DB.flavorById[id] || !Number.isFinite(g) || g <= 0 || flavorStock(id) < g)
      || entries.reduce((sum, [, g]) => sum + g, 0) !== HOME_GRAMS) return null;
  for (const [id, g] of entries) addFlavorStock(id, -g);
  addStamina(HOME_STAMINA);
  const masteryGains = gainFlavorExperience(s, mix, rig.id === "home_rig_pro" ? 7.5 : 6, DB.flavorById);
  s.flags._home_shisha_day = dayKey(s);
  const info = evaluateMix({ mode: "home", mix, equip: { bowl: s.equip?.bowl || "silicone_bowl" } });
  const taste = tasteOf(info);
  // 自分で組んで当てたレシピはレシピ帳へ。発見によるセンス加算も行わない。
  const found = info.recipe && !s.recipes?.[info.recipe.id] ? info.recipe : null;
  if (found) (s.recipes ||= {})[found.id] = { day: s.day, home: true };
  return { info, taste, found, masteryGains, mix: { ...mix } };
}

// ---------------------------------------------------------------- 画面

const INTROS = {
  home_rig_set: ["窓を少し開けて、部屋の明かりを落とし、卓上台に炭をのせる。", "一日の終わり。窓を少し開け、小さな台に今日の葉を詰める。", "窓を少し開けて、寝る前の家シーシャを組む。"],
  home_rig_pro: ["窓を少し開けて、本番と同じ台に炭をのせる。手の感覚が、そのまま残る。", "一日の終わり。窓を少し開け、大会と同じ台で家シーシャを組む。"],
};
// data/flavors.json の説明に沿った一口の気づき。技法・温度・分量の講評はしない。
// 銘柄固有の味はfamilyでまとめず、同系統でも別の感想にする。
const FLAVOR_IMPRESSIONS = {
  white_gummy_bear: "パイナップルみたいな、やわらかい甘さなんだ",
  red_gummy_bear: "ベリーの甘酸っぱさがあるんだな",
  cola: "スパイスと柑橘がコーラらしく香るんだな",
  raspberry: "甘さだけじゃなく、酸味もはっきりしてる",
  pistachio: "青い香ばしさに、穏やかな甘さがある",
  gum_cinnamon: "ガムの甘さにシナモンの刺激が重なるんだ",
  bombshell: "ベリーと花の香りが重なるんだな",
  white_musk: "白い花みたいな香りがやわらかく残る",
  dark_earlgrey: "紅茶の香りがはっきり立つんだな",
  siga: "葉巻みたいな重い香りなんだな",
  nightside_blast_mint: "鋭い清涼感があるんだな",
  mint: "冴えのある清涼感なんだな",
  double_apple: "アニスが香る。りんご一色じゃないんだな",
  blueberry: "ブルーベリーの果実らしい香りなんだな",
  strawberry: "想像した苺の甘さとは違う。繊細な味なんだ",
  vanilla: "厚みのある、丸い甘さなんだな",
  pineapple: "明るいパイナップルの香りが立つんだな",
  coconut: "甘い余韻が長く残るんだな",
  mango: "トロピカルな甘みが広がるんだな",
  nightside_earlgrey: "ベルガモットの紅茶香が長く残るんだな",
  nightside_earlgrey_release: "ベルガモットの紅茶香がするんだな",
  grape: "熟したぶどうみたいな甘さなんだな",
  rose: "薔薇の華やかな香りが残るんだな",
  peach: "やわらかい桃の甘みが広がるんだな",
  orange: "柑橘の酸味と果実の甘さがあるんだな",
  lemon: "きりっとした酸味なんだな",
  watermelon: "みずみずしい果汁みたいな味なんだな",
  guava: "独特の甘酸っぱさがあるんだな",
  dragonfruit: "見た目より穏やかな甘みなんだな",
  kiwi: "酸味がはっきりしてるんだな",
  melon: "濃厚な甘みがあるんだな",
  banana: "クリーミーな甘さなんだな",
  lychee: "上品な甘みに、ほのかな花の香りがある",
  cool_mint: "ひときわ強い清涼感なんだな",
  peppermint_shake: "ミントの冷たさにミルクみたいな甘さもある",
  ice_grape: "ぶどうの甘酸っぱさと冷たさが重なるんだな",
  ice_lemon: "レモンの酸味に冷涼感が重なるんだな",
  death_by_ice: "突き抜けるような冷涼感なんだな",
  blueberry_mint: "ベリーの果実感にミントの清涼感もある",
  frozen_citrus: "柑橘の酸味と冷涼感が重なるんだな",
  frozen_berry: "ベリーの甘さに冷たさが重なるんだな",
  cardamom: "独特のスパイスの香りなんだな",
  cinnamon: "温かみのあるスパイスの香りなんだな",
  clove: "重厚なスパイスの香りなんだな",
  basil: "青い爽やかさとスパイス感があるんだな",
  anise: "ダブルアップルにも使われる、独特の香りだ",
  licorice: "独特の甘苦さが残るんだな",
  nutmeg: "ほんのり甘いスパイスの香りなんだな",
  black_pepper: "ピリッとした辛みがあるんだな",
  ginger: "じんわりした生姜の辛みなんだな",
  lavender: "やさしく残るハーブの香りなんだな",
  jasmine: "上品な花の香りなんだな",
  chamomile: "穏やかなハーブの甘みなんだな",
  sakura: "桜餅みたいな甘い香りなんだな",
  lily: "凛とした百合の花の香りなんだな",
  white_rose: "やわらかい薔薇の甘い香りが残るんだな",
  violet_rose: "深みのある薔薇の香りなんだな",
  gardenia: "濃密で甘い花の香りなんだな",
  chocolate: "甘さとビターな香りがあるんだな",
  dark_chocolate: "苦みの奥に甘さがあるんだな",
  caramel: "焦がし砂糖みたいな濃い甘さなんだな",
  cotton_candy: "綿菓子みたいなふわっとした甘さなんだな",
  mountain_mist: "レモンとライムの軽い酸味なんだな",
  popcorn: "香ばしさと甘さが一緒に来るんだな",
  hazelnut: "ナッツの香ばしさに、ほのかな甘みもある",
  cappuccino: "ミルクの甘さとコーヒーの苦みが重なるんだ",
  coffee: "焙煎した豆の深い苦みなんだな",
  espresso: "ぎゅっと凝縮した苦みと香りなんだな",
  black_tea: "紅茶の渋みと落ち着いた香りなんだな",
  absal_earlgrey: "ベルガモットの柑橘香に紅茶の渋みもある",
  lemon_tea: "落ち着いた紅茶の香りにレモンの酸味もある",
  dobaj_double_apple: "クリーミーでやわらかい甘さなんだな",
  absal_double_apple: "アニスとリコリスがはっきり香るんだな",
  dobaj_mint: "キャンディみたいな甘い清涼感なんだな",
  absal_mint: "清涼感の奥にハーブの苦みもあるんだな",
  afsahr_strawberry: "華やかな苺の香りが立つんだな",
  spring_water: "香水みたいな香りに、爽やかな後味もある",
};
/** 物語の味覚不調（DAY5で始まり、第2章の間は戻らない）。第3章以降の扱いはその章の物語に任せる */
export const tasteDistant = (s = state) => s.chapter === 2 && !!s.flags?._ch2_taste_distant;

/** 場面の台本（地の文＋はじめの心の声）。全角48字以内・手動改行なし */
export function homeShishaDialogue(result, rig, random = Math.random, { distant = false } = {}) {
  const intros = INTROS[rig.id] || INTROS.home_rig_set;
  const impressions = distant ? ["（……香りが遠い。今は味の輪郭をうまく受け取れない）"]
    : Object.entries(result.mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0)
      .map(([id]) => `（${leafName(id)}。${FLAVOR_IMPRESSIONS[id] || "どんな味か、またゆっくり確かめたい"}）`);
  const lines = [{ speaker: "", face: "", text: intros[Math.floor(random() * intros.length)] },
    { type: "sfx", id: "coalPlace" },
    { type: "sfx", id: "bubbling" },
    ...(impressions.length ? impressions : ["（今夜の味を、またゆっくり確かめたい）"]).map(text => ({ speaker: "hajime", face: "normal", text }))];
  lines.push({ type: "sfx", id: "crackle" });
  lines.push({ speaker: "hajime", face: "normal", text: distant
    ? "（また香りを感じられる日に。片付けたら今日は寝よう）"
    : "（この味の感触、覚えておこう。片付けたら今日は寝よう）" });
  // 会話の間だけ夜の曲に替え、終わったら元の曲へ戻る。味覚不調の章は ch2 の既存曲に合わせる
  const bgm = distant ? "bgm_taste_distant" : "kansetsu_shomei_to_black_coffee";
  return { dialogue_id: "home_shisha_night", metadata: { bg: HOME_BG, bgm }, lines };
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
      el("span.home-mix-name", { text: `${leafName(id)}（残り${flavorStock(id)}g） ${masteryLabel(state, id, DB.flavorById)}` }),
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
  const picked = modal({ title: "家シーシャ", className: "home-shisha-dialog", body, options: [
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
  const id = await modal({ title: "家シーシャ：レシピ帳から作る", className: "home-shisha-dialog", body: "自分の葉で作れるレシピ。使う葉と量はレシピどおり。",
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
    const how = await modal({ title: "寝る前の家シーシャ", className: "home-shisha-dialog",
      body: `まだ体力に余裕がある。${rig.name}で家シーシャをする？ 自分の葉${HOME_GRAMS}gと体力を使う。使った味の熟練度が育つ。`,
      options: [
        { label: "家シーシャをする（フレーバーを選ぶ）", value: "mix", primary: true, test: "home-shisha-mix" },
        ...(canRecipe ? [{ label: "家シーシャをする（レシピ帳）", value: "recipe", test: "home-shisha-recipe" }] : []),
        { label: "今日は寝る", value: null, test: "home-shisha-skip" },
      ] });
    if (!how || state !== owner) return false;
    mix = how === "recipe" ? await chooseRecipe() : await chooseMix();
  }
  const result = applyHomeShisha(mix, rig);
  // 消費・実施済み印・成長を、会話や再読み込みを挟む前に一括で保存する。
  if (!result) return false;
  save();
  if (result.found) toast(`📖 レシピ帳に書き加えた「${result.found.name}」`, { kind: "good" });
  if (result.info.golden === "hit") toast(`✨ 黄金比！ ${result.info.recipe.name}は ${goldenLabel(result.info.recipe)}`, { kind: "good" });
  await play(homeShishaDialogue(result, rig, Math.random, { distant: tasteDistant() }));
  if (state !== owner) return true;
  notifyMastery(result.masteryGains);
  save();
  return true;
}
