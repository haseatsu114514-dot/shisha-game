import { isIdealTemperature } from "./temperature-model.js";

// 各工程の終了時に記録した温度の成否。最後の葉の傷みで過去の適温帯を狭めない。
export function recordedTemperatureState(result) {
  return result && !result.failed && !result.skipped
    && Number.isFinite(result.score) && Number.isFinite(result.temp) && typeof result.inZone === "boolean"
    ? result.inZone : null;
}

export function temperatureStateAtFinish(result, bands) {
  const recorded = recordedTemperatureState(result);
  if (recorded !== null || result?.inZone != null || result?.failed || result?.skipped || !Number.isFinite(result?.temp)) return recorded;
  return isIdealTemperature(result.temp, bands);
}

export function recordedTemperatureStates(cs) {
  const rounds = [cs?.pull, cs?.careHistory?.[0], cs?.careHistory?.[1]];
  return rounds.map(recordedTemperatureState);
}

export function allRecordedTemperaturesIdeal(cs) {
  return recordedTemperatureStates(cs).every(value => value === true);
}
