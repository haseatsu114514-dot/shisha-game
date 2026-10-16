// 第2章の保存境界と持ち点。第1章のstate.tournament/固定逆転票には触れない。
export const CONTESTANTS = ["hajime", "ageha", "kumicho", "rei"];
export const JUDGES = ["maezono", "dr_kemuri", "nagumo"];
export const SPEND = [2, 3, 2, 3];
// 初期調整値。章2の比較用の出来であり、キャラクターの能力値ではない。
export const RIVAL_QUALITY = { ageha: 75, kumicho: 80, rei: 78 };
const copy = value => JSON.parse(JSON.stringify(value));
const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));

export function tournamentProgress(value) {
  if (value.chapter !== 2) throw new Error("第2章の保存ではありません");
  const p = value.flags._ch2_tournament ||= {
    version: 1, stage: "entry", attempts: 0, step: 0, craft: null, rollback: null,
    votes: {}, voted: 0, result: null, history: [], entry: null,
  };
  if (p.version !== 1 || !Number.isInteger(p.step) || p.step < 0 || p.step > 11
    || !Array.isArray(p.history)) throw new Error("県大会の保存地点を確認できません");
  return p;
}

export function resources(value) {
  return copy({ flavorStock: value.flavorStock, stamina: value.stamina,
    equip: value.equip, recipes: value.recipes, stats: value.stats });
}
export function restoreResources(value, snapshot) {
  for (const [key, data] of Object.entries(copy(snapshot))) value[key] = data;
}
export function startAttempt(value, craft) {
  const p = tournamentProgress(value);
  if (!p.entry) p.entry = resources(value);
  restoreResources(value, p.entry);
  p.attempts++;
  Object.assign(p, { stage: "craft", step: 0, craft: copy(craft), rollback: null,
    votes: Object.fromEntries(JUDGES.map(id => [id, Object.fromEntries(CONTESTANTS.map(c => [c, 0]))])),
    voted: 0, result: null, failure: null });
  value.phase = "tournament";
  return p;
}
export function recoverStep(value) {
  const p = tournamentProgress(value);
  if (p.rollback) { restoreResources(value, p.rollback); p.rollback = null; }
  return p;
}
export function beginStep(value) {
  const p = tournamentProgress(value);
  p.rollback = resources(value);
  return copy(p.craft);
}
export function finishStep(value, craft) {
  const p = tournamentProgress(value);
  p.craft = copy(craft);
  p.rollback = null;
  if (craft.failed) { p.stage = "defeat"; p.failure = craft.failed; }
  else p.step++;
  return p;
}

/** 1回投入した点は保存後も戻らない。各審査員の累計を常に10以内にする。 */
export function castVotes(p, round, performance) {
  if (round !== p.voted || round < 0 || round >= SPEND.length) return false;
  const quality = { ...RIVAL_QUALITY, hajime: bounded(performance) };
  for (const judge of JUDGES) {
    const bias = judge === "maezono" ? { ageha: 4, rei: 1 }
      : judge === "dr_kemuri" ? { kumicho: 3 } : { rei: 3 };
    const order = CONTESTANTS.slice().sort((a, b) =>
      (quality[b] + (bias[b] || 0)) - (quality[a] + (bias[a] || 0)) || a.localeCompare(b));
    const amount = SPEND[round], row = p.votes[judge];
    const available = 10 - Object.values(row).reduce((sum, n) => sum + n, 0);
    if (available < amount) throw new Error("審査員の持ち点が不足しています");
    row[order[0]] += amount - 1;
    row[order[1]]++;
  }
  p.voted++;
  p.quality = quality;
  return true;
}
export function standings(p) {
  const points = Object.fromEntries(CONTESTANTS.map(id => [id,
    JUDGES.reduce((sum, judge) => sum + (p.votes[judge]?.[id] || 0), 0)]));
  return CONTESTANTS.slice().sort((a, b) => points[b] - points[a]
    || (p.quality?.[b] || 0) - (p.quality?.[a] || 0) || a.localeCompare(b))
    .map((id, index) => ({ id, rank: index + 1, points: points[id] }));
}
export function recordResult(value, total) {
  const p = tournamentProgress(value);
  if (p.result) return p.result;
  if (p.voted !== 4 || p.craft?.careHistory?.length !== 2) throw new Error("提供と2回の調整が未完了です");
  const rows = standings(p);
  p.result = { attempt: p.attempts, total, rank: rows.find(row => row.id === "hajime").rank,
    rows, votes: copy(p.votes), careHistory: copy(p.craft.careHistory) };
  p.history.push(copy(p.result));
  return p.result;
}
