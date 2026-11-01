// Short tabletop stories: isolated, deterministic sessions with scenario-owned rules.
const copy = value => structuredClone(value);

export const TEAMWORK_MAX = 2;
/** Character sheet stats. A PC's rating in the chosen stat replaces the flat base bonus. */
export const STATS = Object.freeze(["eye", "hand", "talk", "nerve"]);
/** The human player's seat: companions earn a spotlight when they act for the first time. */
export const PLAYER_SEAT = "hajime";
/** PC sheets keyed by the authored seat id; a materialized table carries them even when a seat is empty. */
export const sheetsOf = scenario => scenario.sheets || Object.fromEntries((scenario.cast || []).filter(c => c.sheet).map(c => [c.id, c.sheet]));
export const approachesOf = (scenario, kind) => scenario.checks?.[kind]?.approaches || [];
/** The public bonus a declared approach brings: the PC's stat, or the flat base when a check has no sheets. */
export function approachBase(scenario, kind, approachId = null, sheets = null) {
  const approaches = approachesOf(scenario, kind);
  if (!approaches.length) return { base: DICE.base, approach: null };
  const approach = approachId ? approaches.find(a => a.id === approachId) : approaches[0];
  if (!approach) throw new Error("Unknown approach");
  const stat = (sheets || sheetsOf(scenario))[approach.sheet || approach.actor]?.stats?.[approach.stat];
  return { base: Number.isInteger(stat) ? stat : DICE.base, approach };
}
/** Build the player's own character from the scenario's builder: a look, an archetype preset, edited stats and a name. */
export function buildPc(scenario, choices = {}) {
  const builder = scenario.builder;
  if (!builder) return null;
  const archetype = builder.archetypes.find(a => a.id === (choices.archetype || builder.archetypes[0].id));
  if (!archetype) throw new Error("Unknown archetype");
  const look = builder.looks.find(l => l.id === (choices.look || builder.looks[0].id));
  if (!look) throw new Error("Unknown look");
  const stats = Object.fromEntries(STATS.map(key => [key, choices.stats?.[key] ?? archetype.stats[key]]));
  for (const key of STATS) {
    if (!Number.isInteger(stats[key]) || stats[key] < builder.min || stats[key] > builder.max) throw new Error("Stat out of range: " + key);
  }
  const points = STATS.reduce((n, key) => n + stats[key], 0);
  if (points > builder.points) throw new Error("Too many stat points");
  const name = String(choices.name ?? archetype.name).trim();
  if (!name || [...name].length > (builder.nameMax || 6)) throw new Error("Invalid character name");
  return { seat: builder.seat || PLAYER_SEAT, name, title: archetype.title, trait: archetype.trait, stats, points,
    look: look.id, archetype: archetype.id, portrait: look.portrait || null, color: look.color || null, accent: look.accent || null };
}
/** A deterministic "leave it to the dice" character: look and archetype from the seed, with one point moved between stats. */
export function randomPc(scenario, seed = Date.now()) {
  const builder = scenario.builder;
  if (!builder) return null;
  let x = Number(seed) >>> 0 || 1;
  const next = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
  const look = builder.looks[next() % builder.looks.length];
  const archetype = builder.archetypes[next() % builder.archetypes.length];
  const stats = { ...archetype.stats };
  const from = STATS[next() % STATS.length], to = STATS[next() % STATS.length];
  if (from !== to && stats[from] > builder.min && stats[to] < builder.max) { stats[from]--; stats[to]++; }
  return buildPc(scenario, { look: look.id, archetype: archetype.id, stats });
}
// Keep two dice and one-die rerolls; scale the old aids toward their original success rates.
export const DICE = Object.freeze({ sides: 20, base: 3, support: 7, momentum: 4, hypothesis: 4, success: 30, mixed: 19 });
export const gradeOf = total => total >= DICE.success ? "success" : total >= DICE.mixed ? "mixed" : "trouble";
/** Doubles are table events: 20-20 critical, 1-1 fumble, any other pair a cheer. */
export const specialOf = dice => dice[0] !== dice[1] ? null : dice[0] === DICE.sides ? "critical" : dice[0] === 1 ? "fumble" : "double";
const RATING_TITLES = ["にぎやかな卓", "よい卓", "名卓", "伝説の卓"];
/** Table excitement. Each tier reached once gives one momentum: bonus +4 to the next roll (up to two). */
export const HEAT = { max: 8, tiers: [3, 6, 8], momentumMax: 2,
  names: ["静かな卓", "あたたまってきた", "沸いてきた", "最高潮"],
  nights: ["静かな夜", "和やかな夜", "盛り上がった夜", "大盛況の夜"] };
export const heatTier = value => HEAT.tiers.filter(t => value >= t).length;

export class TrpgSession {
  constructor(scenario, { seed = Date.now(), profileId = null, pc = null } = {}) {
    if (!scenario?.profiles?.length || scenario.profiles.length < 1) throw new Error("Missing traveler profiles");
    this.scenario = scenario;
    // The player's own character replaces the authored default on that seat; companions keep their sheets.
    this.pc = scenario.builder ? buildPc(scenario, pc || {}) : null;
    this.sheets = sheetsOf(scenario);
    if (this.pc) this.sheets[this.pc.seat] = { ...(this.sheets[this.pc.seat] || {}), ...this.pc };
    this.rng = Number(seed) >>> 0 || 1;
    const profile = profileId ? scenario.profiles.find(p => p.id === profileId)
      : scenario.profiles[this.next() % scenario.profiles.length];
    if (!profile) throw new Error("Unknown traveler profile");
    this.profile = profile;
    this.flow = scenario.flow || { prepare: ["aroma", "seat"], serve: ["approach"] };
    this.rules = { exploreLimit: 6, pressureMax: 3, initialPressure: 0, inspectionPressure: 0,
      checkPressure: { success: 0, mixed: 1, trouble: 1 }, detourThreshold: 1, hypothesisBonus: 0,
      ...scenario.rules };
    this.rerollActor = scenario.cast.find(c => c.abilityType === "reroll")?.id || "hajime";
    this.state = {
      scenarioId: scenario.id, version: scenario.version, seed: Number(seed) >>> 0, phase: "cover",
      profileId: profile.id, clues: [], consulted: [], hypothesis: null,
      plan: Object.fromEntries(Object.values(this.flow).flat().map(field => [field, null])),
      pressure: this.rules.initialPressure, teamwork: 2, heat: 0, momentum: 0, heatLog: [],
      used: Object.fromEntries(scenario.cast.filter(c => c.part !== "GM").map(c => [c.id, false])),
      acted: {}, checks: [], pending: null,
      pc: this.pc ? { name: this.pc.name, title: this.pc.title, look: this.pc.look, archetype: this.pc.archetype, stats: { ...this.pc.stats } } : null,
    };
  }

  next() {
    let x = this.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return this.rng = x >>> 0;
  }
  die() { return this.next() % DICE.sides + 1; }
  /** Moments the whole table enjoys. Never rolls dice, so the seeded story is unchanged. */
  cheer(amount, reason) {
    const before = this.state.heat;
    this.state.heat = Math.min(HEAT.max, before + amount);
    const gained = this.state.heat - before;
    if (!gained) return;
    const tiers = heatTier(this.state.heat) - heatTier(before);
    this.state.momentum = Math.min(HEAT.momentumMax, this.state.momentum + tiers);
    this.state.heatLog.push({ amount: gained, reason, heat: this.state.heat, tier: tiers ? heatTier(this.state.heat) : 0 });
  }
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
    if (fresh && this.state.clues.length >= this.rules.exploreLimit) throw new Error("Investigation limit reached");
    if (fresh) {
      this.state.clues.push(id);
      this.state.pressure = Math.min(this.rules.pressureMax, this.state.pressure + this.rules.inspectionPressure);
    }
    return { fresh, spot: copy(spot), evidence: copy(this.profile.evidence[id]) };
  }

  consult(id) {
    this.require("explore");
    if (!this.scenario.consult[id]) throw new Error("Unknown participant");
    if (!this.state.consulted.includes(id)) { this.state.consulted.push(id); this.cheer(1, "仲間に相談"); }
    return copy(this.scenario.consult[id]);
  }

  interpret(id) {
    this.require("explore");
    if (this.state.clues.length < 3) throw new Error("Collect three clues before discussing the plan");
    if (!this.scenario.hypotheses.some(h => h.id === id)) throw new Error("Unknown hypothesis");
    this.state.hypothesis = id;
    this.state.phase = "prepare";
    this.cheer(1, "みんなで見立てを話した");
  }

  plan(field, value) {
    const phase = Object.keys(this.flow).find(kind => this.flow[kind].includes(field));
    if (!phase) throw new Error("Unknown preparation field");
    this.require(phase);
    if (!this.scenario.options[field]?.some(option => option.id === value)) throw new Error("Unknown preparation choice");
    this.state.plan[field] = value;
  }

  /** Declare who acts and with which stat; the sheet's rating becomes the roll's base bonus. */
  beginCheck(kind, { support = false, approach = null } = {}) {
    const phases = { listen: "listen", prepare: "prepare", serve: "serve" };
    if (!phases[kind]) throw new Error("Unknown check");
    this.require(phases[kind]);
    if (this.flow[kind]?.some(field => !this.state.plan[field])) throw new Error("Complete the plan before rolling");
    const declared = approachBase(this.scenario, kind, approach, this.sheets);
    if (approach && !declared.approach) throw new Error("This check has no approaches");
    const helper = this.scenario.checks[kind].helper || null;
    if (support && (!helper || this.state.used[helper] || this.state.teamwork < 1)) throw new Error("This support is unavailable");
    if (support) { this.state.used[helper] = true; this.state.teamwork--; }
    const hypothesisBonus = kind === "prepare" && this.state.hypothesis === this.profile.id ? this.rules.hypothesisBonus * DICE.hypothesis : 0;
    const momentum = this.state.momentum;
    this.state.momentum = 0;
    const chosen = declared.approach;
    this.state.pending = {
      kind, dice: [this.die(), this.die()], base: declared.base,
      bonus: declared.base + hypothesisBonus + (support ? DICE.support : 0) + momentum * DICE.momentum, hypothesisBonus, momentum,
      approach: chosen?.id || null, actor: chosen?.actor || null, sheet: chosen ? chosen.sheet || chosen.actor : null, stat: chosen?.stat || null,
      helper: support ? helper : null, rerolled: false,
    };
    if (chosen) {
      const first = !this.state.acted[chosen.actor];
      this.state.acted[chosen.actor] = (this.state.acted[chosen.actor] || 0) + 1;
      // A companion stepping forward for the first time is a table moment; the GM playing an empty seat is not.
      if (first && !chosen.npc && chosen.actor !== PLAYER_SEAT) this.cheer(1, (this.sheets[this.state.pending.sheet]?.name || "仲間") + "の見せ場");
    }
    if (support) this.cheer(1, "仲間の見せ場");
    return this.checkResult();
  }

  checkResult() {
    const p = this.state.pending;
    if (!p) throw new Error("No pending check");
    const total = p.dice[0] + p.dice[1] + p.bonus;
    return { ...copy(p), total, grade: gradeOf(total), special: specialOf(p.dice) };
  }

  reroll(index) {
    const p = this.state.pending;
    if (!p || ![0, 1].includes(index) || p.rerolled || this.state.used[this.rerollActor] || this.state.teamwork < 1) throw new Error("Reroll unavailable");
    this.state.used[this.rerollActor] = true;
    this.state.teamwork--;
    p.rerolled = true;
    p.dice[index] = this.die();
    this.cheer(1, "ひらめきの振り直し");
    return this.checkResult();
  }

  settleCheck() {
    const result = this.checkResult();
    // A critical returns one shared card. It never changes the grade the dice already gave.
    if (result.special === "critical") {
      result.inspired = this.state.teamwork < TEAMWORK_MAX;
      if (result.inspired) this.state.teamwork++;
    }
    this.state.checks.push(result);
    const lift = { critical: [3, "クリティカル！"], fumble: [2, "ファンブルに大笑い"], double: [1, "ゾロ目"] }[result.special];
    if (lift) this.cheer(lift[0], lift[1]);
    else if (result.grade === "success") this.cheer(1, "判定がうまくいった");
    else if (result.grade === "trouble") this.cheer(1, "思わぬ出来事に卓がざわつく");
    this.state.pressure = Math.min(this.rules.pressureMax, this.state.pressure + this.rules.checkPressure[result.grade]);
    this.state.pending = null;
    this.state.phase = { listen: "explore", prepare: "serve", serve: "ending" }[result.kind];
    return copy(result);
  }

  /** Three public stars, revealed with the ending: reading the traveler, the plan, and the dice. */
  rating(ending = null) {
    const marks = {
      insight: this.state.hypothesis === this.profile.id,
      plan: (ending ?? this.result().ending) === this.profile.ending,
      dice: this.state.checks.filter(check => check.grade === "success").length >= 2,
    };
    const stars = Object.values(marks).filter(Boolean).length;
    return { stars, marks, title: RATING_TITLES[stars] };
  }

  result() {
    if (this.state.phase !== "ending") throw new Error("The session is not complete");
    const plan = this.state.plan;
    const fit = Object.entries(plan).reduce((n, [field, value]) =>
      n + (this.profile.likes[field].includes(value) ? (this.scenario.fitWeights?.[field] || 1) : 0), 0);
    const ending = fit >= 3 ? this.profile.ending : (this.scenario.fallbackEnding || "discovery");
    return {
      scenarioId: this.state.scenarioId, version: this.state.version, ending, rating: this.rating(ending),
      heat: { value: this.state.heat, max: HEAT.max, night: HEAT.nights[heatTier(this.state.heat)] },
      variant: this.state.pressure >= this.rules.detourThreshold ? "with-detour" : "smooth",
      plan: copy(plan), hypothesis: this.state.hypothesis,
      clues: copy(this.state.clues), checks: copy(this.state.checks), acted: copy(this.state.acted), pc: copy(this.state.pc),
      pressure: this.state.pressure, profileId: this.profile.id,
    };
  }
}
