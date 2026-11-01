import { mountTrpg } from "./view.js";
import { portraitUrl, sceneUrl } from "./presentation.js";

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

function trpgAssetUrls({ characters, manifest, tableTalk, tutorialLines = [] }, scenarios) {
  const people = new Set(characters.map(c => c.id));
  const urls = new Set();
  scenarios.forEach(s => {
    urls.add(sceneUrl(s));
    s.cast.forEach(c => {
      if (!people.has(c.id) || !manifest.portraits[c.id]) throw new Error("Missing canonical character: " + c.id);
      urls.add(portraitUrl(manifest, c.id));
    });
    s.dialogues.forEach(d => d.lines.forEach(l => urls.add(portraitUrl(manifest, l.speaker, l.face))));
  });
  [...Object.values(tableTalk).flat(), ...(tutorialLines || [])].forEach(l => { if (manifest.portraits[l.speaker]) urls.add(portraitUrl(manifest, l.speaker, l.face)); });
  return urls;
}

/** 選んだシナリオ分の素材だけを先読みする（本棚表示では待たず、卓の開始時に使う）。 */
export async function preloadTrpgAssets(resources, scenario, { signal } = {}) {
  const urls = trpgAssetUrls(resources, [scenario]);
  await Promise.all([...urls].map(url => preload(url, signal)));
  if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
}

export async function loadTrpgLibrary({ signal, scenarioId = null, preloadAssets = true } = {}) {
  const base = new URL("../../../data/", import.meta.url);
  const catalog = await json(new URL("trpg_catalog.json", base), signal);
  const entries = scenarioId ? catalog.scenarios.filter(s => s.id === scenarioId) : catalog.scenarios;
  if (!entries.length) throw new Error("Unknown TRPG scenario: " + scenarioId);
  const [scenarios, characters, manifest, overlays, club, talk, tutorial] = await Promise.all([
    Promise.all(entries.map(entry => json(new URL(entry.file, base), signal))),
    json(new URL("characters.json", base), signal),
    json(new URL("../../data/manifest.json", import.meta.url), signal),
    Promise.all((catalog.characterProfiles || []).map(file => json(new URL(file, base), signal))),
    json(new URL(catalog.club.file, base), signal),
    // Optional table chatter: a missing file only removes the doubles chatter.
    catalog.tableTalk ? json(new URL(catalog.tableTalk, base), signal).catch(error => { if (signal?.aborted) throw error; return null; }) : null,
    // Optional first-table tutorial by the shopkeeper: a missing file only removes the tutorial.
    catalog.tutorial ? json(new URL(catalog.tutorial, base), signal).catch(error => { if (signal?.aborted) throw error; return null; }) : null,
  ]);
  const tableTalk = Object.fromEntries((talk?.dialogues || []).map(d => [d.dialogue_id, d.lines]));
  const people = new Map(characters.map(c => [c.id, c]));
  overlays.forEach(o => { if (o.profile?.id) people.set(o.profile.id, o.profile); });
  const tutorialLines = (tutorial?.lines || []).filter(l => people.has(l.speaker));
  const resources = { catalog, scenarios, characters: [...people.values()], manifest, club, tableTalk, tutorialLines };
  // cast 検証は先読みを省く場合も従来どおりここで行う。
  const urls = trpgAssetUrls(resources, scenarios);
  if (preloadAssets) await Promise.all([...urls].map(url => preload(url, signal)));
  if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
  return resources;
}

export async function loadTrpgResources({ scenarioId = "ordinary-cup", signal } = {}) {
  const { scenarios, ...resources } = await loadTrpgLibrary({ scenarioId, signal });
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
