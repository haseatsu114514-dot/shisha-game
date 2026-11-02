// 各工程の終了時に記録した温度の成否。最後の葉の傷みで過去の適温帯を狭めない。
export function recordedTemperatureStates(cs) {
  const rounds = [cs?.pull, cs?.careHistory?.[0], cs?.careHistory?.[1]];
  return rounds.map(result => result && !result.failed && !result.skipped
    && Number.isFinite(result.score) && Number.isFinite(result.temp) && typeof result.inZone === "boolean"
    ? result.inZone : null);
}

export function allRecordedTemperaturesIdeal(cs) {
  return recordedTemperatureStates(cs).every(value => value === true);
}
