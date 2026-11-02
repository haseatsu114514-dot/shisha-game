// A match owns two independent histories plus the sudden-death rounds. Scoring stays in the rules model.
import { KILLS, KILL_ROTATION, CLUSTERS, MODES, canCall, killState, closuresOf, resolveThrow, totalOf } from "./axe-model.js";

export const DIFFICULTIES = {
  easy: { name: "やさしい", aim: .38, kill: .14, power: [.38, .86] },
  normal: { name: "ふつう", aim: .22, kill: .09, power: [.46, .78] },
  hard: { name: "むずかしい", aim: .10, kill: .05, power: [.54, .70] },
};
export const MATCH_THROWS = MODES.league.throws;
/** From the third sudden-death attempt on, a double miss is measured. */
export const MEASURE_FROM = 2;
export function createMatch(difficulty = "normal", seed = 0, division = "rec") {
  if (!Object.hasOwn(DIFFICULTIES, difficulty) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !["rec", "am", "pro"].includes(division))
    throw new RangeError("Invalid match difficulty, seed or division");
  return { player: [], opponent: [], difficulty, seed, division, suddenDeath: [] };
}
const measurable = shot => shot.stuck && shot.distance !== null;
/** winner of the sudden-death rounds so far, or null while it continues. */
export function suddenDeathWinner(rounds) {
  for (const [i, round] of rounds.entries()) {
    if (!round.player || !round.opponent) return null;
    const p = round.player, o = round.opponent;
    if (p.score !== o.score) return p.score > o.score ? "player" : "opponent";
    if (p.score > 0 || i < MEASURE_FROM) continue;
    if (measurable(p) !== measurable(o)) return measurable(p) ? "player" : "opponent";
    if (measurable(p) && p.distance !== o.distance) return p.distance < o.distance ? "player" : "opponent";
  }
  return null;
}
export const suddenDeathTarget = index => KILL_ROTATION[index % KILL_ROTATION.length];
export function turnOf(match) {
  const p = match.player.length, o = match.opponent.length, rounds = match.suddenDeath || [];
  if (p > MATCH_THROWS || o > MATCH_THROWS || p < o || p > o + 1) throw new RangeError("Invalid match order");
  if (!(p === MATCH_THROWS && o === MATCH_THROWS)) return p === o ? "player" : "opponent";
  if (totalOf(match.player) !== totalOf(match.opponent)) return null;
  if (suddenDeathWinner(rounds)) return null;
  const last = rounds.at(-1);
  return !last || last.opponent ? "player" : "opponent";
}
export const inSuddenDeath = match => match.player.length === MATCH_THROWS && match.opponent.length === MATCH_THROWS
  && totalOf(match.player) === totalOf(match.opponent) && turnOf(match) !== null;
export function takeTurn(match, actor, input) {
  if (turnOf(match) !== actor || !["player", "opponent"].includes(actor)) throw new RangeError("Not this player's turn");
  const keep = shot => { if (input.baseAim) shot.baseAim = { ...input.baseAim }; if (input.sway) shot.sway = { ...input.sway }; return shot; };
  if (inSuddenDeath(match)) {
    const rounds = match.suddenDeath.map(r => ({ ...r }));
    if (actor === "player") rounds.push({ target: suddenDeathTarget(rounds.length), player: null, opponent: null });
    const round = rounds.at(-1);
    round[actor] = keep(resolveThrow({ ...input, called: round.target }, match[actor], { suddenDeath: true, throws: MATCH_THROWS, division: match.division }));
    return { ...match, suddenDeath: rounds };
  }
  const shot = keep(resolveThrow(input, match[actor], { division: match.division, throws: MATCH_THROWS }));
  return { ...match, [actor]: [...match[actor], shot] };
}
export function matchResult(match) {
  const playerTotal = totalOf(match.player), opponentTotal = totalOf(match.opponent);
  const rounds = match.suddenDeath || [], finished = turnOf(match) === null;
  const winner = !finished ? null : playerTotal !== opponentTotal ? (playerTotal > opponentTotal ? "player" : "opponent") : suddenDeathWinner(rounds);
  return { playerTotal, opponentTotal, winner, suddenDeath: rounds.length ? { rounds: rounds.length, winner: suddenDeathWinner(rounds) } : null };
}
function randomFor(seed, index) {
  // Each opposing throw has its own reproducible stream, independent of player scores.
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
/** The opponent reads its own closures like a real thrower: centre first, then an open outer bull. */
export function openAim(history, division, index = history.length) {
  const closed = closuresOf(history, index, MATCH_THROWS, division);
  const open = CLUSTERS.find(c => division === "pro" ? !closed.cluster.has(c.id) : !(closed.bull.has(c.id) && closed.five.has(c.id)));
  return open || CLUSTERS[0];
}
export function planOpponent(match) {
  if (turnOf(match) !== "opponent") throw new RangeError("Opponent must wait for player");
  const settings = DIFFICULTIES[match.difficulty];
  if (inSuddenDeath(match)) {
    const round = match.suddenDeath.at(-1), target = KILLS.find(k => k.id === round.target);
    const random = randomFor(match.seed, 100 + match.suddenDeath.length);
    return { x: target.x + (random() * 2 - 1) * settings.kill, y: target.y + (random() * 2 - 1) * settings.kill,
      power: settings.power[0] + random() * (settings.power[1] - settings.power[0]), called: round.target };
  }
  const index = match.opponent.length, random = randomFor(match.seed, index);
  const state = killState(match.opponent, MATCH_THROWS);
  // Calls on throws five and ten; a bonus call earned by a drop is spent on throw eight at the opposite height.
  const wanted = index === 4 ? "upper" : index === 9 || index === 7 && state.bonus > 0 ? (state.mustRow || "lower") : null;
  const target = wanted ? KILLS.find(k => k.row === wanted && canCall(k.id, match.opponent, MATCH_THROWS)) || null : null;
  const aim = target || openAim(match.opponent, match.division, index);
  const spread = target ? settings.kill : settings.aim;
  return { x: aim.x + (random() * 2 - 1) * spread, y: aim.y + (random() * 2 - 1) * spread,
    power: settings.power[0] + random() * (settings.power[1] - settings.power[0]), called: target?.id || null };
}
/** The shot a turn would record, without committing it. Used to show the opponent's planned throw. */
export const resolveTurn = (match, actor, input) => {
  const next = takeTurn(match, actor, input);
  return inSuddenDeath(match) ? next.suddenDeath.at(-1)[actor] : next[actor].at(-1);
};
