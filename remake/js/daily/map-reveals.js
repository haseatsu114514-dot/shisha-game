// Presentation history belongs to the loaded game object, not to progression/save flags.
// Loading an existing save establishes a baseline; it never celebrates all old unlocks.
const histories = new WeakMap();

/** タイマーと中断のどちらでも一度だけ解錠。進行フラグは扱わない。 */
export function startSpotReveal({ pop, done, delay = 650, duration = 1800,
  schedule = setTimeout, cancel = clearTimeout }) {
  let finished = false;
  const timers = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(cancel);
    done();
  };
  timers.push(schedule(() => {
    if (finished) return;
    try { pop(); } catch (error) { finish(); throw error; }
  }, delay));
  timers.push(schedule(finish, delay + duration));
  return finish;
}

export function spotRevealNotice(spot) {
  const guide = { cafe: "なる", kannon: "アダム", choizap: "みんと", c_station: "なる", axe_bar: "スミ" }[spot.id];
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
