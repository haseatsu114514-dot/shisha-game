// 第4章ドバイ編・任意イベント「ラクダレース」（CAMEL RACE）の訪問の流れ（会話→レース→結果の会話・保存・報酬）。
// 進み具合・行き先・記録の純粋関数は ch4-camel-progress.js（地図の計算が DOM 無しで読めるように分けた）。遊びの本体は minigames/camel-race.js。
import { state, save } from "../core/state.js";
import { paidAction } from "../core/stats.js";
import { toast } from "../core/ui.js";
import { growthEnabled } from "../core/growth.js";
import { runCamelRace } from "../minigames/camel-race.js";
import { CAMEL_SCENES, CAMEL_STAGES, camelRaceRecord, camelRaceDestination, recordCamelRaceResult, consumeCamelRaceDaytime,
  advanceCamelRaceStage, resultSceneFor } from "./ch4-camel-progress.js";
export * from "./ch4-camel-progress.js";

/**
 * 地図からの訪問。段階に応じて会話→レース→結果の会話を進め、確定ごとに保存する。
 * @param read 会話を再生して読了なら true を返す関数（ch4.js の readScene）
 * @param beforeRace レースを開く直前に呼ぶ（呼び出し側が中断用の controller を立てる）
 * 戻り値: { used, exerted, slotsUsed }（performSpot と同じ形。used は昼の行動を使ったか）。
 * 昼の枠はここで進めて記録と一緒に保存するので、日常ループには slotsUsed: 0 を返す（二重に進めない）。
 */
export async function visitCamelRace({ read, signal = null, isCurrent = () => true, beforeRace = () => {}, host = document.getElementById("stage"), options = null } = {}) {
  const value = state;
  const destination = camelRaceDestination(value);
  if (!destination || destination.ok === false) return { used: false, exerted: false };
  const camel = camelRaceRecord(value);
  if (camel.stage === CAMEL_STAGES.unknown || camel.stage === CAMEL_STAGES.met) {
    const id = camel.stage === CAMEL_STAGES.unknown ? CAMEL_SCENES.meet : CAMEL_SCENES.invite;
    if (!await read(id) || !isCurrent() || state !== value) return { used: false, exerted: false };
    if (advanceCamelRaceStage(value, id)) save();
    return { used: false, exerted: false };
  }
  const first = camel.stage === CAMEL_STAGES.invited;
  if (first) {
    // 本番を見る場面は一度だけ。途中で中断・LOADしても、読み終えていれば次はレースから。
    if (!camel.watched) {
      if (!await read(CAMEL_SCENES.watch) || !isCurrent() || state !== value) return { used: false, exerted: false };
      if (advanceCamelRaceStage(value, CAMEL_SCENES.watch)) save();
    }
  } else if (!await read(CAMEL_SCENES.replay) || !isCurrent() || state !== value) return { used: false, exerted: false };
  beforeRace();
  const test = typeof window !== "undefined" ? window.__remake?.camelTest : null;
  const { value: outcome } = await paidAction(async () => {
    const result = await runCamelRace({ host, signal, tutorial: camel.plays === 0, best: camel.best, allowRetry: true,
      pilot: test?.pilot ?? null, timeScale: test?.timeScale ?? 1, ...(options || {}) });
    if (!result.completed || !result.best || !isCurrent() || state !== value) return { completed: false };
    const recorded = recordCamelRaceResult(value, result.best, result.runs.length);
    consumeCamelRaceDaytime(value);
    save();
    return { completed: true, ...recorded, result };
  }, { consumed: outcome => outcome.firstClear === true, exp: { key: "camel_race", place: "camel_track", person: "saif" } });
  if (!outcome.completed) return { used: false, exerted: false };
  const { best } = outcome.result;
  if (outcome.firstClear) toast(`初めてレースを走り切った。${best.rank}位・スコア ${best.total}（${best.grade}）。${growthEnabled() ? "……今夜の精算で、火種がひとつ届く。" : ""}`, { kind: "good" });
  else if (outcome.newBest) toast(`自己ベスト更新！ スコア ${best.total}（${best.grade}・${best.rank}位）`, { kind: "good" });
  if (!isCurrent() || state !== value) return { used: true, exerted: true, slotsUsed: 0 };
  // 結果の会話。読み切れなくても記録・消費は済んでいる（二重に付かない）。
  await read(first ? resultSceneFor(best.rank) : outcome.newBest ? CAMEL_SCENES.replayBest : CAMEL_SCENES.replayUsual);
  return { used: true, exerted: true, slotsUsed: 0 };
}
