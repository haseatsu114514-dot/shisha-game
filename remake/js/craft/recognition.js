// 実際の工程だけを短く認める。票・総合点・勝ち方には触れない。
import { DB } from "../core/data.js";
import { temperatureBands, isIdealTemperature } from "./temperature-model.js";

export function recognitionId(cs, { careRounds = 2 } = {}) {
  if (!cs) return null;
  const bands = temperatureBands(cs);
  const recorded = result => result && Number.isFinite(result.temp) && Number.isFinite(result.score);
  const good = result => recorded(result) && !result.failed && isIdealTemperature(result.temp, bands);
  const care = (cs.careHistory || []).slice(0, careRounds);
  if (care.length === careRounds && careRounds > 0 && good(care.at(-1))) {
    if (careRounds === 2 && good(cs.pull) && care.every(good)) return "steady";
    if ([cs.pull, ...care.slice(0, -1)].some(result => recorded(result) && !good(result))) return "recovered";
    return "care";
  }
  if (good(cs.pull)) return "serve";
  if (Number.isFinite(cs.heat?.score) && cs.heat.score >= 85) return "heat";
  if (Number.isFinite(cs.holes?.score) && cs.holes.score >= 85 && cs.holes.outerEven >= .85) return "holes";
  if (cs.steam?.hits === 0 && cs.steam.score >= 85) return "steam";
  return null;
}

export function craftRecognition(cs, options) {
  const id = recognitionId(cs, options);
  const lines = DB.dialogues[`ch1_craft_recognition_${id}`]?.lines;
  return lines ? { id, summary: lines.find(line => line.speaker === "")?.text,
    comment: lines.find(line => line.speaker === "sumi")?.text } : null;
}
