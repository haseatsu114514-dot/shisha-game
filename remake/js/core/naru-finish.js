// なる「焼き際の見極め」。帯・表示・確定・採点が同じ試作値を使う。
// 味の種類を条件にせず、提供時の実温度だけを記録する。温度そのものは変えない。
export const NARU_FINISH = Object.freeze({ version: 1, low: .75, high: .90, bonus: .5 });
const object = value => value && typeof value === "object" && !Array.isArray(value);
const playable = cs => cs && typeof cs.mode === "string" && !["tutorial", "drill"].includes(cs.mode);

/** 新しい一台の習得状態。旧版で開始した未提供の一台だけ、吸い出し入口でも補う。 */
export function startNaruFinish(cs, learned) {
  if (!object(cs) || Object.hasOwn(cs, "naruFinish")) return;
  cs.naruFinish = { version: NARU_FINISH.version, learned: playable(cs) && learned === true, recorded: false };
}

/** 虹を表示しない配合も同じ内部帯を使う。見た目の色や葉名は判定にしない。 */
export function naruFinishRange(bands) {
  if (!Array.isArray(bands?.optimal) || !Array.isArray(bands?.ideal)) return null;
  const [lo, hi] = bands.optimal, [safeLo, safeHi] = bands.ideal;
  if (![lo, hi, safeLo, safeHi].every(Number.isFinite) || hi <= lo || safeHi <= safeLo || safeLo < 0 || safeHi > 1) return null;
  const low = lo + (hi - lo) * NARU_FINISH.low, high = lo + (hi - lo) * NARU_FINISH.high;
  return low >= safeLo && high <= safeHi && high < .9 ? { low, high } : null;
}

export function inNaruFinishRange(temp, range) {
  return Number.isFinite(temp) && !!range && temp >= range.low - 1e-9 && temp <= range.high + 1e-9;
}

export const naruFinishGuide = cs => playable(cs) && cs.naruFinish?.version === NARU_FINISH.version
  && cs.naruFinish.learned === true && cs.naruFinish.recorded === false;

/** 最初の提供だけ確定。途中通過、予測線、自動テスト、失敗では加点しない。 */
export function recordNaruFinish(cs, bands, { automatic = false } = {}) {
  if (!naruFinishGuide(cs) || !cs.pullDone) return false;
  const range = naruFinishRange(bands), temp = cs.pull?.temp;
  const hit = !automatic && !cs.failed && !cs.pull?.failed && Number.isFinite(cs.pull?.score)
    && inNaruFinishRange(temp, range);
  cs.naruFinish = { ...cs.naruFinish, recorded: true, hit,
    ...(hit ? { temp, ...range, bonus: NARU_FINISH.bonus } : {}) };
  return hit;
}

/** 調整後の帯/温度で判定し直さない。再finalizeやSAVE/LOADでも加点は一度分だけ。 */
export function naruFinishBonus(cs) {
  const record = cs?.naruFinish;
  return playable(cs) && cs.pullDone && !cs.failed && !cs.pull?.failed
    && record?.version === NARU_FINISH.version && record.learned === true && record.recorded === true
    && record.hit === true && record.bonus === NARU_FINISH.bonus
    && Number.isFinite(record.low) && Number.isFinite(record.high) && record.high > record.low
    && record.high < .9 && inNaruFinishRange(record.temp, record) ? record.bonus : 0;
}
