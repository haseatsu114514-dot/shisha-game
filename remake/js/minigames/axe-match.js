// A match owns two independent histories. Scoring stays in the solo rules model.
import { KILLS, canCall, resolveThrow, totalOf } from "./axe-model.js";

export const DIFFICULTIES = {
  easy: { name: "やさしい", aim: .38, kill: .14, power: [.38, .86] },
  normal: { name: "ふつう", aim: .22, kill: .09, power: [.46, .78] },
  hard: { name: "むずかしい", aim: .10, kill: .05, power: [.54, .70] },
};
export const MATCH_THROWS = 10;
export function createMatch(difficulty = "normal", seed = 0) {
  if (!Object.hasOwn(DIFFICULTIES, difficulty) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("Invalid match difficulty or seed");
  return { player: [], opponent: [], difficulty, seed };
}
export function turnOf(match) {
  const p = match.player.length, o = match.opponent.length;
  if (p > MATCH_THROWS || o > MATCH_THROWS || p < o || p > o + 1) throw new RangeError("Invalid match order");
  return p === MATCH_THROWS && o === MATCH_THROWS ? null : p === o ? "player" : "opponent";
}
export function takeTurn(match, actor, input) {
  if (turnOf(match) !== actor || !["player", "opponent"].includes(actor)) throw new RangeError("Not this player's turn");
  const shot = resolveThrow(input, match[actor]);
  if (input.baseAim) shot.baseAim = { ...input.baseAim };
  if (input.sway) shot.sway = { ...input.sway };
  return { ...match, [actor]: [...match[actor], shot] };
}
export function matchResult(match) {
  const playerTotal = totalOf(match.player), opponentTotal = totalOf(match.opponent);
  return { playerTotal, opponentTotal, winner: turnOf(match) !== null ? null
    : playerTotal === opponentTotal ? "draw" : playerTotal > opponentTotal ? "player" : "opponent" };
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
export function planOpponent(match) {
  if (turnOf(match) !== "opponent") throw new RangeError("Opponent must wait for player");
  const index = match.opponent.length, settings = DIFFICULTIES[match.difficulty];
  const random = randomFor(match.seed, index);
  const target = index === 4 ? KILLS[0] : index === 9 ? KILLS[2] : null;
  const called = target && canCall(target.id, match.opponent) ? target.id : null;
  const spread = called ? settings.kill : settings.aim;
  return { x: (called ? target.x : 0) + (random() * 2 - 1) * spread,
    y: (called ? target.y : 0) + (random() * 2 - 1) * spread,
    power: settings.power[0] + random() * (settings.power[1] - settings.power[0]), called };
}
