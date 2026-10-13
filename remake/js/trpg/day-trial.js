// 無料試遊「七つの灯り」。お金・能力・本編の乱数や保存には触れない。
export const newDayTrial = () => ({ total: 0, rolls: [], done: false });
export function rollDayTrial(trial, die) {
  if (trial.done || !Number.isInteger(die) || die < 1 || die > 6) return trial;
  const total = trial.total + die;
  return { total, rolls: [...trial.rolls, die], done: total >= 7 };
}
export function stopDayTrial(trial) {
  return trial.done || !trial.rolls.length ? trial : { ...trial, done: true };
}
