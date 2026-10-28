// 台本の選択だけを行う。工程の評価・在庫・票は変更しない。
import { DB } from "../core/data.js";
import { temperatureBands, isIdealTemperature } from "./temperature-model.js";

export const TOURNAMENT_STORY_STEPS = new Map([[0, "opening"], [3, "packed"], [7, "waiting"]]);
const PACKING = { fluffy: "ふんわり詰め", normal: "均等な詰め方", firm: "デンスパック" };
// 共通工程のうち、上園が話す行だけ第3章の審査員エミルへ切り替える。
const NATIONAL_JUDGE_SCENES = new Set(["mix_single", "mix_blend", "crowd_2", "aroma_good", "aroma_work", "aroma_unknown"]);

export function tournamentStoryDialogue(cs, event, random = Math.random) {
  const chapter = [1, 2, 3].includes(cs.chapter) ? cs.chapter : 1;
  const ingredients = Object.entries(cs.mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const flavors = ingredients.map(([id, g]) => `${DB.flavorById[id]?.short_name || id} ${g}g`).join("、");
  const ids = [];
  if (event === "opening") ids.push(`opening_${chapter}`);
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
      return scene.lines.map(line => ({ ...line, text: line.text
        .replaceAll("{flavors}", flavors).replaceAll("{packing}", PACKING[cs.pack] || PACKING.normal) }));
    }),
  };
}
