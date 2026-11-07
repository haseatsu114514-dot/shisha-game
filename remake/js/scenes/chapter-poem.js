// 巻頭ポエム（序詩と第1〜5章の章頭詩）。
// 詩の本文と意図は brand/chant_poems.md、台本は data/dialogue/chapter_poems.json（話者なしの地の文）。
// 置き場所: 序詩＝タイトルから「はじめから」を選んだ直後、各章の詩＝その章の章タイトルの直後。
import { DB } from "../core/data.js";
import { clearScreen } from "../core/ui.js";
import { play } from "../vn/engine.js";

/** 詩の指定 → 台詞ID。章は番号（1〜5）、序詩は "prologue" */
export const CHAPTER_POEM_IDS = Object.freeze({
  prologue: "poem_prologue",
  1: "poem_ch1", 2: "poem_ch2", 3: "poem_ch3", 4: "poem_ch4", 5: "poem_ch5",
});

/**
 * 詩を会話エンジンで読む。最後まで読んだら true、章が破棄された・中断された場合は false。
 * - owner を渡すと owner.controller に載せ、章の離脱（pagehide 等）で読み込みを止められる（ch2〜ch5 の読み方と同じ）。
 * - current(owner) が false になった場合は読了扱いにせず false。呼び出し元は titleSeen を立てずに戻る。
 * 読了の保存は呼び出し元が行う（章タイトルと同じ titleSeen の判定に乗せ、再開時に繰り返さない）。
 */
export async function playChapterPoem(key, { owner = null, current = () => true } = {}) {
  const id = CHAPTER_POEM_IDS[key];
  if (!id) throw new Error(`巻頭ポエムの指定が不正です: ${key}`);
  if (!DB.dialogues[id]) throw new Error(`台本がありません: ${id}`);
  if (owner && !current(owner)) return false;
  clearScreen();
  const controller = new AbortController();
  if (owner) owner.controller = controller;
  try {
    const result = await play(id, { signal: controller.signal });
    return (!owner || current(owner)) && !!result && !result.cancelled;
  } finally {
    if (owner && owner.controller === controller) owner.controller = null;
  }
}
