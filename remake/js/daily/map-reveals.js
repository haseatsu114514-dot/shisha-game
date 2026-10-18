// Presentation history belongs to the loaded game object, not to progression/save flags.
// Loading an existing save establishes a baseline; it never celebrates all old unlocks.
const histories = new WeakMap();
export function newlyRevealedSpots(game, region, spots) {
  let regions = histories.get(game);
  if (!regions) { regions = new Map(); histories.set(game, regions); }
  const previous = regions.get(region);
  if (!previous) { regions.set(region, new Map(spots.map(s => [s.id, s.revealed]))); return []; }
  const fresh = spots.filter(s => s.revealed && previous.get(s.id) !== true).map(s => s.id);
  for (const s of spots) previous.set(s.id, previous.get(s.id) === true || s.revealed);
  return fresh;
}
