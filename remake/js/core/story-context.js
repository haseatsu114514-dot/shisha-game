// 会話の時系列を読むだけの判定。好感度・日数・訪問回数から大会の終了を推測しない。
export function tournamentFinished(value, chapter) {
  if (!Number.isInteger(chapter) || chapter < 1) return false;
  const current = value?.chapter || 1;
  return current > chapter || current === chapter
    && ["aftermath", "cleared"].includes(value?.phase);
}
