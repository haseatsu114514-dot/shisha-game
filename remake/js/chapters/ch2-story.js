import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { imageReady, setBg } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { MAP } from "./ch2-city-data.js";
import { CH2_NIGHTS } from "./ch2-story-data.js";

// 会話途中では完了にしない。連続する場面は一つずつ保存し、LOAD時に読了分を飛ばす。
async function readStep(step) {
  const owner = state;
  const flag = `_ch2_read_${step.id}`;
  if (owner.flags[flag]) return;
  if (!DB.dialogues[step.id]) throw new Error(`台本がありません: ${step.id}`);
  if (["remake_ch2_eve_arrival", "ch2_pre_tournament_realisation"].includes(step.id)) {
    if (!await imageReady(MAP.night, 15000)) throw new Error("大会前夜の街を読み込めませんでした");
    await setBg(MAP.night, { instant: true });
  }
  const result = await play(step.id);
  if (state !== owner || !result || result.cancelled) throw new Error(`未読の場面: ${step.id}`);
  owner.flags[flag] = true;
  if (step.flag) owner.flags[step.flag] = true;
  save();
}

export function chapterTwoNights(startDay) {
  return Object.fromEntries(CH2_NIGHTS.map(night => {
    const flag = night.doneFlag || `_ch2_night_${night.day}_done`;
    return [startDay + night.day - 1, {
      id: `remake_ch2_night_${night.day}`, pin: night.pin, label: night.label,
      schedule: "fixed", prerequisites: night.prerequisites,
      done: () => !!state.flags[flag],
      run: async () => {
        for (const step of night.steps) await readStep(step);
        state.flags[flag] = true;
      },
    }];
  }));
}
