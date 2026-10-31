import { DB, bgUrl } from "../core/data.js";
import { state, save, markMet } from "../core/state.js";
import { imageReady, setBg } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { MAP, ROOMS } from "./ch2-city-data.js";
import { CH2_NIGHTS, CH2_FREE_NIGHTS, syncAgehaVibes } from "./ch2-story-data.js";
import { grantStrawberrySample } from "./ch2-strawberry-trial.js";
import { recordSentLime } from "./ch2-lime.js";

// 会話途中では完了にしない。連続する場面は一つずつ保存し、LOAD時に読了分を飛ばす。
async function readStep(step) {
  const owner = state;
  const flag = `_ch2_read_${step.id}`;
  if (owner.flags[flag] || (step.when && !step.when(owner))) return;
  if (!DB.dialogues[step.id]) throw new Error(`台本がありません: ${step.id}`);
  if (!step.bg && ["remake_ch2_eve_arrival", "remake_ch2_eve_rei", "ch2_pre_tournament_realisation"].includes(step.id)) {
    if (!await imageReady(MAP.night, 15000)) throw new Error("大会前夜の街を読み込めませんでした");
    await setBg(MAP.night, { instant: true });
  }
  const place = (step.bg && (bgUrl(step.bg) || step.bg)) || (step.room && ROOMS[step.room]);
  if (place) {
    if (!await imageReady(place, 15000)) throw new Error(`場面の背景を読み込めませんでした: ${step.bg || step.room}`);
    await setBg(place, { instant: true });
  }
  syncAgehaVibes(owner.flags);
  const result = await play(step.id);
  if (state !== owner || !result || result.cancelled) throw new Error(`未読の場面: ${step.id}`);
  owner.flags[flag] = true;
  if (step.flag) owner.flags[step.flag] = true;
  if (step.met) {
    markMet(step.met);
    // 台本で交換した連絡先は、読み終えた時点で連絡先一覧にも記録する（daily/spots.js の hasContact と同じ）
    if (owner.flags[`_lime_contact_${step.met}`] && !owner.contacts.includes(step.met)) owner.contacts.push(step.met);
  }
  if (step.sample) grantStrawberrySample(owner);
  recordSentLime(owner);
  syncAgehaVibes(owner.flags);
  save();
}

export function chapterTwoNights(startDay) {
  const absolute = (day) => startDay + day - 1;
  return Object.fromEntries(CH2_NIGHTS.map(night => {
    const flag = night.doneFlag || `_ch2_night_${night.day}_done`;
    // 後送りできる夜だけ共通の延期キューへ載せる。期限と自由な夜は通算日に直す。
    const deferrable = night.schedule === "preparation" ? {
      deadline: absolute(night.deadline), doneKeys: [flag], freeNights: CH2_FREE_NIGHTS.map(absolute),
    } : {};
    return [absolute(night.day), {
      id: `remake_ch2_night_${night.day}`, pin: night.pin, label: night.label, beat: night.beat,
      schedule: night.schedule || "fixed", prerequisites: night.prerequisites, ...deferrable,
      done: () => !!state.flags[flag],
      run: async () => {
        for (const step of night.steps) await readStep(step);
        state.flags[flag] = true;
      },
    }];
  }));
}
