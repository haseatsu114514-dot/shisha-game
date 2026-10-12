import { mountTrpg } from "./view.js";

async function json(url) {
  const response = await fetch(url, { cache: "no-cache", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("読み込みに失敗しました: " + response.status + " " + url);
  return response.json();
}

/** Reads only this scenario and shared labels/image metadata; never loads a main save. */
export async function loadTrpgResources() {
  const [scenario, characters, manifest] = await Promise.all([
    json(new URL("../../../data/dialogue/trpg_ordinary.json", import.meta.url)),
    json(new URL("../../../data/characters.json", import.meta.url)),
    json(new URL("../../data/manifest.json", import.meta.url)),
  ]);
  const urls = scenario.cast.map(c => {
    const rel = "sprites/characters/" + c.id + "/chr_" + c.id + "_normal.png";
    return (manifest.webp || []).includes(rel)
      ? new URL("../../img/" + rel.replace(/\.png$/, ".webp"), import.meta.url).href
      : new URL("../../../assets/" + rel, import.meta.url).href;
  });
  await Promise.all(urls.map(url => new Promise(resolve => {
    const image = new Image();
    const timer = setTimeout(resolve, 5000);
    image.onload = image.onerror = () => { clearTimeout(timer); resolve(); };
    image.src = url;
  })));
  return { scenario, characters, manifest };
}

/**
 * Integration entry: caller supplies an empty, owned screen host and trpg.css.
 * A completed result or {cancelled:true} is returned after the table is closed.
 * The caller owns story eligibility, rewards, day progression and saving.
 */
export async function runTrpg(host, options = {}) {
  const resources = options.resources || await loadTrpgResources();
  const controller = mountTrpg(host, { ...resources, ...options });
  const cancel = () => controller.destroy();
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  try { return await controller.finished; }
  finally { options.signal?.removeEventListener("abort", cancel); controller.destroy(); }
}

export { mountTrpg };
