// TRPG role costumes: full-body art for the seat's chosen origin, keyed by scenario/character/role.
// Companions and the player still use their own face in circular icons (#3050); speaker busts use this art.
export const COSTUME_KEYS = new Set(["apple-thief/hajime/bellboy", "apple-thief/hajime/doorman", "apple-thief/hajime/steward", "apple-thief/hiyori/rosa", "apple-thief/hiyori/marta", "apple-thief/tsumugi/shion", "apple-thief/tsumugi/nocto", "doll-requiem/hajime/nightwatch", "doll-requiem/hajime/restorer", "doll-requiem/hajime/courier", "doll-requiem/ageha/kirara", "doll-requiem/ageha/marie", "doll-requiem/hiyori/cecilia", "doll-requiem/hiyori/chloe", "fading-familiar/hajime/patrol", "fading-familiar/hajime/runner", "fading-familiar/hajime/bookish", "fading-familiar/samechan/hirena", "fading-familiar/samechan/fukami", "fading-familiar/adam/mars", "fading-familiar/adam/nox", "fox-market/hajime/apprentice", "fox-market/hajime/firewatch", "fox-market/hajime/scholar", "fox-market/hiyori/kasumi", "fox-market/hiyori/shizuku", "fox-market/samechan/namimaru", "fox-market/samechan/fukajiro", "leaf-mail/hajime/watch", "leaf-mail/hajime/sweep", "leaf-mail/hajime/books", "leaf-mail/hiyori/yura", "leaf-mail/hiyori/neri", "leaf-mail/adam/leon", "leaf-mail/adam/gran", "mist-kingdom/hajime/rookie", "mist-kingdom/hajime/wanderer", "mist-kingdom/hajime/shepherd", "mist-kingdom/adam/orchard", "mist-kingdom/adam/grants", "mist-kingdom/samechan/koban", "mist-kingdom/samechan/sharuku", "moonflower-encore/hajime/stagehand", "moonflower-encore/hajime/usher", "moonflower-encore/hajime/pageturner", "moonflower-encore/ageha/kirara", "moonflower-encore/ageha/moka", "moonflower-encore/adam/leon", "moonflower-encore/adam/ziek", "ordinary-cup/hajime/apprentice", "ordinary-cup/hajime/sailor", "ordinary-cup/hajime/regular", "ordinary-cup/adam/nico", "ordinary-cup/adam/pippin", "ordinary-cup/tsumugi/luca", "ordinary-cup/tsumugi/leaf", "purikura-hero/hajime/squire", "purikura-hero/hajime/photographer", "purikura-hero/hajime/shield", "purikura-hero/ageha/lovely", "purikura-hero/ageha/beatrice", "purikura-hero/rei/nocturne", "purikura-hero/rei/shion", "shark-last-order/hajime/rookie", "shark-last-order/hajime/lifeguard", "shark-last-order/hajime/radio", "shark-last-order/hiyori/otto", "shark-last-order/hiyori/midori", "shark-last-order/adam/otto", "shark-last-order/adam/mackin", "shark-last-order/tsumugi/sera", "shark-last-order/tsumugi/noa", "shark-island/hajime/deckhand", "shark-island/hajime/navigator", "shark-island/hajime/cook", "shark-island/hiyori/ruri", "shark-island/hiyori/nerine", "shark-island/adam/doran", "shark-island/adam/jiruba", "smoke-robot/hajime/rookie", "smoke-robot/hajime/pilot", "smoke-robot/hajime/mechanic", "smoke-robot/adam/nova", "smoke-robot/adam/cosmo", "smoke-robot/tsumugi/luna", "smoke-robot/tsumugi/konoha", "stage-ghost/hajime/stagehand", "stage-ghost/hajime/childstar", "stage-ghost/hajime/lightboy", "stage-ghost/hiyori/mirei", "stage-ghost/hiyori/serena", "stage-ghost/samechan/minamo", "stage-ghost/samechan/hiremaru", "regular-mail/sumi/yura", "regular-mail/sumi/neri"]);

export function costumeKey(scenarioId, characterId, roleId) {
  return scenarioId && characterId && roleId ? `${scenarioId}/${characterId}/${roleId}` : "";
}

// Regular tables restage an existing short: reuse that book's costumes, plus any keys unique to the restage.
const SCENARIO_ALIASES = { "regular-mail": "leaf-mail", "regular-harbor": "ordinary-cup" };

function costumeSourceId(scenarioId, characterId, roleId) {
  if (COSTUME_KEYS.has(costumeKey(scenarioId, characterId, roleId))) return scenarioId;
  const aliased = SCENARIO_ALIASES[scenarioId];
  return aliased && COSTUME_KEYS.has(costumeKey(aliased, characterId, roleId)) ? aliased : null;
}

export function hasCostume(scenarioId, characterId, roleId) {
  return costumeSourceId(scenarioId, characterId, roleId) !== null;
}

export function costumeUrl(scenarioId, characterId, roleId) {
  const source = costumeSourceId(scenarioId, characterId, roleId);
  if (!source) return null;
  return new URL(`../../img/ui/trpg/costumes/${source}/${characterId}_${roleId}.webp`, import.meta.url).href;
}

/** Preload every costume for the scenarios in play. */
export function costumeUrlsFor(scenarios) {
  const wanted = new Set();
  for (const s of scenarios) {
    wanted.add(s.id);
    if (SCENARIO_ALIASES[s.id]) wanted.add(SCENARIO_ALIASES[s.id]);
  }
  const urls = [];
  for (const key of COSTUME_KEYS) {
    const [scenarioId, characterId, roleId] = key.split("/");
    if (!wanted.has(scenarioId)) continue;
    urls.push(costumeUrl(scenarioId, characterId, roleId));
  }
  return urls;
}
