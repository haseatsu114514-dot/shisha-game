// 台本の選択だけを行う。工程の評価・在庫・票は変更しない。
import { DB } from "../core/data.js";
import { temperatureBands, isIdealTemperature } from "./temperature-model.js";

export const TOURNAMENT_STORY_STEPS = new Map([[0, "opening"], [3, "packed"], [7, "waiting"]]);
const PACKING = { fluffy: "ふんわり詰め", normal: "均等な詰め方", firm: "デンスパック" };
// 共通工程のうち、上園が話す行だけ第3章の審査員エミルへ切り替える。
// 散文に出す葉の名前。短縮名の先頭メーカー表記（AF/NS/ドバジ 等）は落とす（served-eval.js の aromaName と同じ扱い）。
const MAKER_TOKENS = new Set(["AF", "NS", "ドバジ", "ナイトサイド", "アフサール"]);
function leafName(id) {
  const name = DB.flavorById[id]?.short_name || DB.flavorById[id]?.name || id;
  const sp = name.indexOf(" ");
  return sp > 0 && MAKER_TOKENS.has(name.slice(0, sp)) ? name.slice(sp + 1) : name;
}
const NATIONAL_JUDGE_SCENES = new Set(["mix_single", "mix_blend", "crowd_2", "aroma_good", "aroma_work", "aroma_unknown"]);

/**
 * 第2章・提供後の票（2回目の投票）を見たあとのあげはの区分（#1649）。
 * 実際に投入された票（progress.lastVotes / votes）だけから決め、記録が無ければ票に触れない "unknown"。
 */
export function agehaServedVotes(progress) {
  const last = progress?.lastVotes;
  if (!last || progress.voted !== 2) return "unknown";
  const rows = Object.values(last);
  if (rows.some(row => row?.first === "ageha")) return "first";
  if (rows.some(row => (row?.points?.ageha || 0) > 0)) return "second";
  const total = Object.values(progress.votes || {}).reduce((sum, row) => sum + (row?.ageha || 0), 0);
  return total > 0 ? "none" : "zero";
}
/** 第2章・提供の実績（吸い出しの温度と提供時の香り）から、はじめの独白の区分を返す。 */
export function hajimeServedState(cs) {
  const pull = cs?.pull, aroma = cs?.tournamentStory?.servedAroma;
  if (!Number.isFinite(pull?.temp)) return "work";
  const bands = temperatureBands(cs);
  if (!isIdealTemperature(pull.temp, bands)) return pull.temp > bands.ideal[1] ? "hot" : "cold";
  return Number.isFinite(aroma) && aroma >= 65 ? "good" : "work";
}

export function tournamentStoryDialogue(cs, event, random = Math.random, context = {}) {
  const chapter = [1, 2, 3].includes(cs.chapter) ? cs.chapter : 1;
  const ingredients = Object.entries(cs.mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const flavors = ingredients.map(([id, g]) => `${DB.flavorById[id]?.short_name || id} ${g}g`).join("、");
  // 試飲の感想（aroma_*）では配合カードを読み上げない。メーカー略称とg数を落とし、多い順の主役2種だけを言う。
  const aromaFlavors = ingredients.slice().sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => leafName(id)).join("と");
  const ids = [];
  if (event === "opening") ids.push(`opening_${chapter}`);
  // 第2章の提供後の掛け合いは、画面の票と提供の実績に合わせて組み立てる（第1章の naruTastingLine と同じ考え方）。
  else if (event === "interlude1" && chapter === 2) ids.push(`interlude1_2_ageha_${agehaServedVotes(context.progress)}`,
    "interlude1_2_mid", `interlude1_2_hajime_${hajimeServedState(cs)}`);
  else if (event.startsWith("interlude")) ids.push(`${event}_${chapter}`);
  else if (event === "packed") ids.push("packed_intro", `pack_${PACKING[cs.pack] ? cs.pack : "normal"}`,
    ingredients.length > 1 ? "mix_blend" : "mix_single", "packed_end");
  else if (event === "waiting") ids.push(`waiting_${chapter}`, `crowd_${Math.min(2, Math.max(0, Math.floor(random() * 3)))}`);
  else if (event === "tasting") {
    const bands = temperatureBands(cs), pull = cs.pull;
    const ideal = result => Number.isFinite(result?.temp) && isIdealTemperature(result.temp, bands);
    const cares = cs.careHistory || [], last = cares.at(-1);
    const aroma = cs.tournamentStory?.servedAroma;
    ids.push("tasting_intro", !Number.isFinite(aroma) ? "aroma_unknown" : aroma >= 65 ? "aroma_good" : "aroma_work");
    if (Number.isFinite(pull?.temp)) ids.push(ideal(pull) ? "serve_good" : pull.temp > bands.ideal[1] ? "serve_hot" : "serve_cold");
    ids.push(cares.length !== 2 || !Number.isFinite(last?.temp) ? "care_incomplete"
      : ideal(last) ? ideal(pull) && cares.every(ideal) ? "care_steady" : "care_recovered"
        : last.temp > bands.ideal[1] ? "care_hot" : "care_cold", "tasting_end");
  } else throw new Error(`不明な大会演出: ${event}`);
  return {
    dialogue_id: `tournament_craft_${chapter}_${event}`,
    lines: ids.flatMap(id => {
      const sceneId = chapter === 3 && NATIONAL_JUDGE_SCENES.has(id) ? `${id}_3` : id;
      const scene = DB.dialogues[`tournament_craft_${sceneId}`];
      if (!scene) throw new Error(`大会演出の台本がありません: ${id}`);
      const named = id.startsWith("aroma_") ? aromaFlavors : flavors;
      return scene.lines.map(line => ({ ...line, text: line.text
        .replaceAll("{flavors}", named).replaceAll("{packing}", PACKING[cs.pack] || PACKING.normal) }));
    }),
  };
}
