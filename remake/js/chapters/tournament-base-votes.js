// 新規試合だけに保存する独立の基礎票。旧SAVEにこのフィールドが無ければ0票として扱う。
export const initialBaseVotes = contestants => Object.fromEntries(contestants.map(id => [id, 1]));
export const baseVoteOf = (progress, id) => progress.baseVotes?.[id] || 0;
