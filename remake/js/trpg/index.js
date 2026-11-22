import { mountTrpg } from "./view.js";
import { npcIdFor, npcPortraitUrl, portraitUrl, sceneUrl } from "./presentation.js";
import { costumeUrlsFor } from "./costumes.js";
import { isTrpgRegular } from "./regulars.js";

async function json(url, signal) {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel(); else signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Resource timeout")), 15000);
  try {
    const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error("Resource unavailable: " + response.status);
    return await response.json();
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
}

async function preload(url, signal) {
  return new Promise(resolve => {
    const img = new Image();
    let timer;
    const finish = () => { clearTimeout(timer); signal?.removeEventListener("abort", finish); img.onload = img.onerror = null; resolve(); };
    if (signal?.aborted) { finish(); return; }
    signal?.addEventListener("abort", finish, { once: true });
    timer = setTimeout(finish, 5000);
    img.onload = () => { (img.decode?.() || Promise.resolve()).catch(() => {}).finally(finish); };
    img.onerror = finish; img.src = url;
  });
}

/** Scenario and canonical presentation data only; no main-game loading or saves. */
export async function loadTrpgClubResources({ signal } = {}) {
  const base = new URL("../../../data/", import.meta.url);
  const catalog = await json(new URL("trpg_catalog.json", base), signal);
  const [characters, manifest, overlays, club] = await Promise.all([
    json(new URL("characters.json", base), signal), json(new URL("../../data/manifest.json", import.meta.url), signal),
    Promise.all((catalog.characterProfiles || []).map(file => json(new URL(file, base), signal))),
    json(new URL(catalog.club.file, base), signal),
  ]);
  const people = new Map(characters.map(c => [c.id, c]));
  overlays.forEach(o => { if (o.profile?.id) people.set(o.profile.id, o.profile); });
  return { catalog, characters: [...people.values()], manifest, club };
}

function validateCast({ characters, manifest }, scenarios) {
  const people = new Set(characters.map(person => person.id));
  for (const scenario of scenarios) {
    for (const actor of scenario.cast) {
      if (!people.has(actor.id) || !manifest.portraits[actor.id] && !isTrpgRegular(actor.id)) throw new Error("Missing canonical character: " + actor.id);
    }
  }
}

function trpgAssetUrls({ manifest, tableTalk, tutorialLines = [] }, scenarios) {
  const urls = new Set();
  scenarios.forEach(s => {
    if (sceneUrl(s)) urls.add(sceneUrl(s));
    if (s.presentation.choiceArt?.src) urls.add(new URL(s.presentation.choiceArt.src, new URL("./view.js", import.meta.url)).href);
    costumeUrlsFor([s]).forEach(url => urls.add(url));
    s.cast.forEach(c => {
      urls.add(portraitUrl(manifest, c.id));
    });
    const gm = s.cast.find(c => c.part === "GM")?.id;
    s.dialogues.forEach(d => d.lines.forEach(l => {
      urls.add(portraitUrl(manifest, l.speaker, l.face));
      if (l.speaker === gm && !/卓の会話$|はじめての人へ|場面/.test(String(l?.role ?? ""))) {
        const npcId = npcIdFor(l);
        if (npcId) urls.add(npcPortraitUrl(npcId));
      }
    }));
  });
  [...Object.values(tableTalk).flat(), ...(tutorialLines || [])].forEach(l => { if (manifest.portraits[l.speaker]) urls.add(portraitUrl(manifest, l.speaker, l.face)); });
  return urls;
}

/** 選んだシナリオ分の素材だけを先読みする（本棚表示では待たず、卓の開始時に使う）。 */
export async function preloadTrpgAssets(resources, scenario, { signal } = {}) {
  validateCast(resources, [scenario]);
  const urls = trpgAssetUrls(resources, [scenario]);
  await Promise.all([...urls].map(url => preload(url, signal)));
  if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
}

export async function loadTrpgShelf({ signal } = {}) {
  const shared = await loadTrpgClubResources({ signal });
  return { ...shared, scenarios: shared.catalog.scenarios.map(({ id, shelf }) => ({ id, ...shelf })) };
}

export async function loadTrpgLibrary({ signal, scenarioId = null, preloadAssets = true, shared = null } = {}) {
  const base = new URL("../../../data/", import.meta.url);
  const { catalog, characters, manifest, club } = shared || await loadTrpgClubResources({ signal });
  const entries = scenarioId ? catalog.scenarios.filter(s => s.id === scenarioId) : catalog.scenarios;
  if (!entries.length) throw new Error("Unknown TRPG scenario: " + scenarioId);
  const [scenarios, talk, tutorial, frames] = await Promise.all([
    Promise.all(entries.map(entry => json(new URL(entry.file, base), signal))),
    // Optional table chatter: a missing file only removes the doubles chatter.
    catalog.tableTalk ? json(new URL(catalog.tableTalk, base), signal).catch(error => { if (signal?.aborted) throw error; return null; }) : null,
    // Optional first-table tutorial by the shopkeeper: a missing file only removes the tutorial.
    catalog.tutorial ? json(new URL(catalog.tutorial, base), signal).catch(error => { if (signal?.aborted) throw error; return null; }) : null,
    json(new URL("../../img/ui/trpg/costumes/frames.json", import.meta.url), signal).catch(error => { if (signal?.aborted) throw error; return []; }),
  ]);
  const tableTalk = Object.fromEntries((talk?.dialogues || []).map(d => [d.dialogue_id, d.lines]));
  const people = new Set(characters.map(person => person.id));
  const tutorialLines = (tutorial?.lines || []).filter(l => people.has(l.speaker));
  const costumeFrames = Object.fromEntries((Array.isArray(frames) ? frames : []).filter(f => f?.face)
    .map(f => [f.scenario + "/" + f.character + "/" + f.role_id, f]));
  const resources = { catalog, scenarios, characters, manifest, club, tableTalk, tutorialLines, costumeFrames };
  validateCast(resources, scenarios);
  if (preloadAssets) await Promise.all([...trpgAssetUrls(resources, scenarios)].map(url => preload(url, signal)));
  if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
  return resources;
}

export async function loadTrpgResources({ scenarioId = "ordinary-cup", ...options } = {}) {
  const { scenarios, ...resources } = await loadTrpgLibrary({ scenarioId, ...options });
  return { ...resources, scenario: scenarios[0] };
}

/**
 * Integration entry: caller supplies an empty, owned screen host and trpg.css.
 * A completed result or {cancelled:true} is returned after the table is closed.
 * The caller owns story eligibility, rewards, day progression and saving.
 */
export async function runTrpg(host, options = {}) {
  const scenarioId = options.scenarioId || options.resources?.scenario?.id || "ordinary-cup";
  if (options.signal?.aborted) return { cancelled: true, scenarioId };
  let resources;
  try { resources = options.resources || await loadTrpgResources({ scenarioId, signal: options.signal }); }
  catch (error) { if (options.signal?.aborted) return { cancelled: true, scenarioId }; throw error; }
  const controller = mountTrpg(host, { ...resources, ...options });
  const cancel = () => controller.destroy();
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  try { return await controller.finished; }
  finally { options.signal?.removeEventListener("abort", cancel); controller.destroy(); }
}

export { mountTrpg };
