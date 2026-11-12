// Experimental input/session adapter. The WATL scoring model remains the single authority.
import { AIM_RANGE, MODES, DIVISIONS, POWER, RULESET, resolveThrow, releaseAimAt, canCall, totalOf, gradeOf } from './axe-model.js';
import { createMatch, takeTurn, turnOf, resolveTurn, planOpponent, matchResult, inSuddenDeath, suddenDeathTarget } from './axe-match.js';
import { pickChallenges, evaluateChallenges, rankOf, titleOf } from './axe-challenges.js';
import { sessionStats } from './axe-presentation.js';
import { AXE_EQUIPMENT, AXE_EQUIPMENT_VERSION, axePower } from './axe-equipment.js';

export const SCENE = Object.freeze({ width: 1600, height: 900, cx: 800, cy: 430, radius: 260, pullDistance: 230 });
export const INPUT_VERSION = 'tap-pull-preview-v1';
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function scenePoint(rect, clientX, clientY) {
  if (![rect.left, rect.top, rect.width, rect.height, clientX, clientY].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const k = Math.min(rect.width / SCENE.width, rect.height / SCENE.height);
  const x = (clientX - rect.left - (rect.width - SCENE.width * k) / 2) / k;
  const y = (clientY - rect.top - (rect.height - SCENE.height * k) / 2) / k;
  return x < 0 || x > SCENE.width || y < 0 || y > SCENE.height ? null : { x, y };
}
export function boardPoint(p) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  const x = (p.x - SCENE.cx) / SCENE.radius, y = (p.y - SCENE.cy) / SCENE.radius;
  return Math.abs(x) <= AIM_RANGE && Math.abs(y) <= AIM_RANGE ? { x, y } : null;
}
export function pullPower(start, p) {
  if (!start || !p || ![start.x, start.y, p.x, p.y].every(Number.isFinite)) return null;
  // Length, not release speed or event frequency. Upward/back-to-origin releases cancel.
  if (Math.abs(p.x - start.x) > 280) return null;
  return clamp((p.y - start.y) / SCENE.pullDistance, 0, 1);
}

export class AxePullSession {
  constructor({ mode = 'practice', division = 'rec', difficulty = 'normal', seed = 11, steady, equipmentId = 'house' } = {}) {
    if (!Object.hasOwn(AXE_EQUIPMENT, equipmentId)) throw new RangeError('Unknown axe');
    this.equipment = AXE_EQUIPMENT[equipmentId];
    steady ??= this.equipment.steady;
    if (!['practice', 'league', 'versus'].includes(mode) || !Object.hasOwn(DIVISIONS, division) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(steady) || steady < .5 || steady > 1) throw new RangeError('Invalid axe preview options');
    if (mode === 'versus' && !['easy', 'normal', 'hard'].includes(difficulty)) throw new RangeError('This preview does not unlock the secret opponent');
    this.mode = mode; this.division = division; this.difficulty = difficulty; this.seed = seed; this.steady = steady;
    this.rules = MODES[mode === 'versus' ? 'league' : mode];
    this.match = mode === 'versus' ? createMatch(difficulty, seed, division) : null;
    this.shots = []; this.actor = 'player'; this.phase = 'aim'; this.called = null;
    this.challengeIds = pickChallenges(mode === 'versus' ? 'league' : mode, seed);
    this.resetStance();
  }
  resetStance() { this.aim = { x: 0, y: 0 }; this.selected = false; this.power = 0; this.held = 0; this.focusUsed = false; this.focusUntil = 0; this.pull = null; this.pending = null; }
  get suddenDeath() { return Boolean(this.match && inSuddenDeath(this.match)); }
  canAim() { return this.phase === 'aim' && this.actor === 'player'; }
  aimAt(aim) {
    if (!this.canAim() || !aim || ![aim.x, aim.y].every(Number.isFinite)) return false;
    this.aim = { x: clamp(aim.x, -AIM_RANGE, AIM_RANGE), y: clamp(aim.y, -AIM_RANGE, AIM_RANGE) }; this.selected = true; return true;
  }
  declare(id) {
    if (!this.canAim() || this.suddenDeath || id !== null && !canCall(id, this.shots, this.rules.throws)) return false;
    this.called = id; return true;
  }
  focus() {
    if (!['aim', 'pull'].includes(this.phase) || !this.selected || this.focusUsed) return false;
    this.focusUsed = true; this.focusUntil = this.held + 1200; return true;
  }
  beginPull(pointerId, point, keyboard = false) {
    if (!this.canAim() || !this.selected || !point || ![point.x, point.y].every(Number.isFinite)) return false;
    this.pull = { pointerId, start: { ...point }, keyboard, clock: 0 }; this.phase = 'pull'; this.power = 0; return true;
  }
  movePull(pointerId, point) {
    if (this.phase !== 'pull' || this.pull.pointerId !== pointerId || this.pull.keyboard) return false;
    const power = pullPower(this.pull.start, point);
    if (power === null) { this.cancelPull(); return false; }
    this.power = power; return true;
  }
  cancelPull() { if (this.phase !== 'pull') return false; this.pull = null; this.power = 0; this.phase = 'aim'; return true; }
  tick(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('Invalid active time');
    if (!['aim', 'pull'].includes(this.phase) || !this.selected) return;
    this.held += milliseconds;
    if (this.phase === 'pull' && this.pull.keyboard) { this.pull.clock += milliseconds; this.power = clamp(this.pull.clock / 1200, 0, 1); }
  }
  preview(rawPower = this.phase === 'pull' ? this.power : POWER.ideal) {
    const power = axePower(rawPower, this.equipment.id);
    const release = releaseAimAt(this.aim, this.held, power, this.shots.length, this.held < this.focusUntil, this.steady);
    const input = { x: release.x, y: release.y, power, called: this.called };
    const shot = this.match ? resolveTurn(this.match, 'player', input) : resolveThrow(input, this.shots, { division: this.division, throws: this.rules.throws });
    return { ...shot, baseAim: { ...this.aim }, sway: release.sway };
  }
  release(pointerId, point = null) {
    if (this.phase !== 'pull' || this.pull.pointerId !== pointerId) return null;
    if (!this.pull.keyboard && !this.movePull(pointerId, point)) return null;
    if (this.power < .06) { this.cancelPull(); return null; }
    this.pending = this.preview(); this.pull = null; this.phase = 'flight'; return this.pending;
  }
  impact() {
    if (this.phase !== 'flight' || !this.pending) return false;
    const shot = this.pending;
    if (this.match) { this.match = takeTurn(this.match, this.actor, { ...shot.aim, power: shot.power, called: shot.called, baseAim: shot.baseAim, sway: shot.sway }); this.shots = this.match.player; }
    else this.shots.push(shot);
    this.last = shot; this.pending = null; this.phase = 'result'; return true;
  }
  next() {
    if (this.phase !== 'result') return false;
    if (this.match && turnOf(this.match) === 'opponent') {
      this.actor = 'opponent'; const input = planOpponent(this.match);
      this.pending = { ...resolveTurn(this.match, 'opponent', input), baseAim: { x: input.x, y: input.y }, sway: { x: 0, y: 0, fatigue: 0, amplitude: 0, focused: false } };
      this.phase = 'flight'; return true;
    }
    if (this.match ? turnOf(this.match) === null : this.shots.length === this.rules.throws) { this.phase = 'summary'; return true; }
    this.actor = 'player'; this.resetStance(); this.called = this.suddenDeath ? suddenDeathTarget(this.match.suddenDeath.length) : null; this.phase = 'aim'; return true;
  }
  result(completed = false) {
    const done = Boolean(completed && this.phase === 'summary'), total = totalOf(this.shots);
    return { completed: done, cancelled: !done, throws: structuredClone(this.shots), total,
      grade: done ? gradeOf(total, this.rules.max) : null, ruleset: RULESET, mode: this.mode,
      opponent: this.match ? 'hiyori' : null, division: this.division, throwCount: this.rules.throws, maximum: this.rules.max,
      challenges: evaluateChallenges(this.challengeIds, this.shots, done), rank: done ? rankOf(total, this.rules.max) : null,
      title: done ? titleOf(this.shots, this.rules.max) : null, stats: sessionStats(this.shots), inputVersion: INPUT_VERSION,
      equipment: { id: this.equipment.id, version: AXE_EQUIPMENT_VERSION, steady: this.steady, powerErrorScale: this.equipment.powerErrorScale },
      ...(this.match ? { match: { ...matchResult(this.match), winner: done ? matchResult(this.match).winner : null,
        player: structuredClone(this.match.player), opponent: structuredClone(this.match.opponent), suddenDeathThrows: structuredClone(this.match.suddenDeath), difficulty: this.difficulty, division: this.division, seed: this.seed },
        series: { bestOf: 1, games: done ? [matchResult(this.match)] : [], wins: { player: Number(done && matchResult(this.match).winner === 'player'), opponent: Number(done && matchResult(this.match).winner === 'opponent') }, winner: done ? matchResult(this.match).winner : null } } : {}) };
  }
}
