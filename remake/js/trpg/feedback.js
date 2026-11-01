// Public roll information only: never inspect the hidden traveler profile.
const grades = ["success", "mixed", "trouble"];
import { DICE, gradeOf, approachBase } from "./session.js";

function percentages(totals) {
  const counts = { success: 0, mixed: 0, trouble: 0 };
  for (const total of totals) counts[gradeOf(total)]++;
  // Each percentage is approximate; independent rounding may not sum to 100.
  return Object.fromEntries(grades.map(grade => [grade, Math.round(counts[grade] * 100 / totals.length)]));
}

function requireBonus(bonus) {
  if (!Number.isFinite(bonus)) throw new TypeError("A finite roll bonus is required");
}

export function rollOdds(bonus) {
  requireBonus(bonus);
  const totals = [];
  for (let first = 1; first <= DICE.sides; first++) {
    for (let second = 1; second <= DICE.sides; second++) totals.push(first + second + bonus);
  }
  return percentages(totals);
}

export function checkForecast(scenario, state, kind, { support = false, approach = null } = {}) {
  // Momentum from table excitement is public and spent on this roll.
  const momentum = Number.isInteger(state.momentum) ? state.momentum : 0;
  // The declared PC's stat is printed on the sheet; it is public like the flat base it replaces.
  const { base } = approachBase(scenario, kind, approach);
  const baseBonus = base + (support ? DICE.support : 0) + momentum * DICE.momentum;
  // The potential is deliberately identical for correct and incorrect guesses.
  const potentialBonus = kind === "prepare" && state.hypothesis ? (scenario.rules?.hypothesisBonus || 0) * DICE.hypothesis : 0;
  return {
    baseBonus,
    base,
    momentum,
    potentialBonus,
    odds: rollOdds(baseBonus),
    bestOdds: rollOdds(baseBonus + potentialBonus),
  };
}

export function rerollOdds(dice, bonus, index) {
  requireBonus(bonus);
  if (![0, 1].includes(index) || !Array.isArray(dice) || dice.length !== 2
    || dice.some(die => !Number.isInteger(die) || die < 1 || die > DICE.sides)) {
    throw new RangeError("Choose one of two twenty-sided dice to reroll");
  }
  const kept = dice[1 - index];
  return percentages(Array.from({ length: DICE.sides }, (_, face) => kept + face + 1 + bonus));
}

