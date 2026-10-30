// Presentation history belongs to the loaded game object, not to progression/save flags.
// Loading an existing save establishes a baseline; it never celebrates all old unlocks.
const histories = new WeakMap();

/** 解禁表示→余韻→通常案内。中断時も一度だけ解錠し、後続案内は出さない。 */
export function startSpotReveal({ pop, settle = () => {}, done, delay = 650, duration = 1800, pause = 450,
  schedule = setTimeout, cancel = clearTimeout }) {
  let finished = false;
  const timers = [];
  const finish = (cancelled = true) => {
    if (finished) return;
    finished = true;
    timers.forEach(cancel);
    done({ cancelled });
  };
  timers.push(schedule(() => {
    if (finished) return;
    try { pop(); } catch (error) { finish(); throw error; }
  }, delay));
  timers.push(schedule(() => {
    if (finished) return;
    try { settle(); } catch (error) { finish(); throw error; }
    if (!finished) timers.push(schedule(() => finish(false), pause));
  }, delay + duration));
  return finish;
}

export function spotRevealNotice(spot, game) {
  if (spot.id === "kannon" && game && !game.flags?._spot_guide_adam) return "観音堂に行けるようになった。静かに振り返れる場所";
  const guide = { cafe: "なる", kannon: "アダム", choizap: "みんと", c_station: "なる", axe_bar: "スミ", fortune: "つむぎ", rojiura_cinema: "サメちゃん" }[spot.id];
  return guide ? `${guide}から聞いた${spot.label}に行けるようになった` : `${spot.label}に行けるようになった`;
}
export function newlyRevealedSpots(game, region, spots) {
  let regions = histories.get(game);
  if (!regions) { regions = new Map(); histories.set(game, regions); }
  const previous = regions.get(region);
  if (!previous) { regions.set(region, new Map(spots.map(s => [s.id, s.revealed]))); return []; }
  const fresh = spots.filter(s => s.revealed && previous.get(s.id) !== true).map(s => s.id);
  for (const s of spots) previous.set(s.id, previous.get(s.id) === true || s.revealed);
  return fresh;
}
