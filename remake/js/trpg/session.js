// TRPG #44: an isolated, deterministic session. No main-game state or storage imports.
const copy = value => structuredClone(value);

export class TrpgSession {
  constructor(scenario, { seed = Date.now(), profileId = null } = {}) {
    if (!scenario?.profiles?.length || scenario.profiles.length < 1) throw new Error("Missing traveler profiles");
    this.scenario = scenario;
    this.rng = Number(seed) >>> 0 || 1;
    const profile = profileId ? scenario.profiles.find(p => p.id === profileId)
      : scenario.profiles[this.next() % scenario.profiles.length];
    if (!profile) throw new Error("Unknown traveler profile");
    this.profile = profile;
    this.state = {
      scenarioId: scenario.id, version: 1, seed: Number(seed) >>> 0, phase: "cover",
      profileId: profile.id, clues: [], consulted: [], hypothesis: null,
      plan: { aroma: null, seat: null, approach: null }, pressure: 0, teamwork: 2,
      used: { hajime: false, naru: false, tsumugi: false }, checks: [], pending: null,
    };
  }

  next() {
    let x = this.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return this.rng = x >>> 0;
  }
  die() { return this.next() % 6 + 1; }
  snapshot() { return copy(this.state); }
  require(phase) {
    if (this.state.phase !== phase || this.state.pending) throw new Error("Action unavailable in this phase");
  }
  start() { this.require("cover"); this.state.phase = "listen"; }

  inspect(id) {
    this.require("explore");
    const spot = this.scenario.spots.find(s => s.id === id);
    if (!spot) throw new Error("Unknown investigation spot");
    const fresh = !this.state.clues.includes(id);
    if (fresh) this.state.clues.push(id);
    return { fresh, spot: copy(spot), evidence: copy(this.profile.evidence[id]) };
  }

  consult(id) {
    this.require("explore");
    if (!this.scenario.consult[id]) throw new Error("Unknown participant");
    if (!this.state.consulted.includes(id)) this.state.consulted.push(id);
    return copy(this.scenario.consult[id]);
  }

  interpret(id) {
    this.require("explore");
    if (this.state.clues.length < 3) throw new Error("Collect three clues before discussing the plan");
    if (!this.scenario.hypotheses.some(h => h.id === id)) throw new Error("Unknown hypothesis");
    this.state.hypothesis = id;
    this.state.phase = "prepare";
  }

  plan(field, value) {
    const phase = field === "approach" ? "serve" : "prepare";
    this.require(phase);
    if (!this.scenario.options[field]?.some(option => option.id === value)) throw new Error("Unknown preparation choice");
    this.state.plan[field] = value;
  }

  beginCheck(kind, { support = false } = {}) {
    const phases = { listen: "listen", prepare: "prepare", serve: "serve" };
    if (!phases[kind]) throw new Error("Unknown check");
    this.require(phases[kind]);
    if (kind === "prepare" && (!this.state.plan.aroma || !this.state.plan.seat)) throw new Error("Choose an aroma and a seat");
    if (kind === "serve" && !this.state.plan.approach) throw new Error("Choose how to speak to the traveler");
    const helper = kind === "prepare" ? "naru" : kind === "serve" ? "tsumugi" : null;
    if (support && (!helper || this.state.used[helper] || this.state.teamwork < 1)) throw new Error("This support is unavailable");
    if (support) { this.state.used[helper] = true; this.state.teamwork--; }
    this.state.pending = {
      kind, dice: [this.die(), this.die()], bonus: 1 + (support ? 2 : 0),
      helper: support ? helper : null, rerolled: false,
    };
    return this.checkResult();
  }

  checkResult() {
    const p = this.state.pending;
    if (!p) throw new Error("No pending check");
    const total = p.dice[0] + p.dice[1] + p.bonus;
    return { ...copy(p), total, grade: total >= 10 ? "success" : total >= 7 ? "mixed" : "trouble" };
  }

  reroll(index) {
    const p = this.state.pending;
    if (!p || ![0, 1].includes(index) || p.rerolled || this.state.used.hajime || this.state.teamwork < 1) throw new Error("Reroll unavailable");
    this.state.used.hajime = true;
    this.state.teamwork--;
    p.rerolled = true;
    p.dice[index] = this.die();
    return this.checkResult();
  }

  settleCheck() {
    const result = this.checkResult();
    this.state.checks.push(result);
    if (result.grade !== "success") this.state.pressure = Math.min(3, this.state.pressure + 1);
    this.state.pending = null;
    this.state.phase = { listen: "explore", prepare: "serve", serve: "ending" }[result.kind];
    return copy(result);
  }

  result() {
    if (this.state.phase !== "ending") throw new Error("The session is not complete");
    const plan = this.state.plan;
    const fit = Number(this.profile.likes.aroma.includes(plan.aroma))
      + Number(this.profile.likes.seat.includes(plan.seat))
      + 2 * Number(this.profile.likes.approach.includes(plan.approach));
    const ending = fit >= 3 ? this.profile.ending : "discovery";
    return {
      scenarioId: this.state.scenarioId, version: 1, ending,
      variant: this.state.pressure ? "with-detour" : "smooth",
      plan: copy(plan), hypothesis: this.state.hypothesis,
      clues: copy(this.state.clues), checks: copy(this.state.checks),
      pressure: this.state.pressure, profileId: this.profile.id,
    };
  }
}
