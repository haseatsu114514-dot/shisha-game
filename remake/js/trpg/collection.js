import { loadTrpgLibrary, mountTrpg } from "./index.js";
import { mountTrpgLibrary } from "./library.js";
import { createTrpgAudio } from "./audio.js";
import { el } from "../core/util.js";

function fontsReady(signal) {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, 6000);
    signal.addEventListener("abort", finish, { once: true });
    document.fonts.ready.then(finish, finish);
    if (signal.aborted) finish();
  });
}

/** Owned tabletop collection. No main-game state, saves, or URL changes. */
export function mountTrpgCollection(host, {
  signal, initialScenarioId = null, seed, profileId = null, tutorial = false,
  closeLabel = "閉じる", closable = false, onScenarioChange = () => {},
} = {}) {
  let controller = null, resources = null, request = null, generation = 0;
  let disposed = false, phase = "loading";
  const audio = createTrpgAudio();
  let resolve;
  const finished = new Promise(r => { resolve = r; });

  function destroy() {
    if (disposed) return;
    disposed = true; generation++; request?.abort();
    controller?.destroy(); audio.destroy(); resources = null;
    host.replaceChildren(); signal?.removeEventListener("abort", destroy);
    resolve({ closed: true });
  }
  function library() {
    if (disposed) return;
    generation++; controller?.destroy(); phase = "library";
    onScenarioChange(null);
    controller = mountTrpgLibrary(host, { ...resources, audio, onChoose: open,
      onClose: closable ? destroy : null, closeLabel });
  }
  function open(id) {
    if (disposed) return;
    const scenario = resources.scenarios.find(s => s.id === id);
    if (!scenario) { library(); return; }
    const ticket = ++generation;
    controller?.destroy(); phase = "session"; onScenarioChange(id);
    const mounted = mountTrpg(host, { scenario, characters: resources.characters, manifest: resources.manifest, tableTalk: resources.tableTalk, audio,
      tutorialLines: resources.tutorialLines, tutorial,
      seed: seed ?? Date.now(), profileId: scenario.profiles.some(p => p.id === profileId) ? profileId : null,
      closeLabel: "本棚へ戻る" });
    controller = mounted;
    mounted.finished.then(result => {
      if (disposed || ticket !== generation) return;
      if (result.replayRequested) open(id); else library();
    });
  }
  async function boot() {
    if (disposed) return;
    const ticket = ++generation; phase = "loading";
    request?.abort(); request = new AbortController();
    const actions = () => closable ? [el("button.trpg-button", { type: "button", text: closeLabel,
      dataset: { test: "trpg-collection-close" }, onclick: destroy })] : [];
    host.replaceChildren(el("div.trpg-loading", [
      el("span", { text: "小さな卓を用意しています" }),
      el("small", { text: "背景と、今夜の仲間を迎えています……" }), ...actions(),
    ]));
    try {
      resources = await loadTrpgLibrary({ signal: request.signal });
      await fontsReady(request.signal);
      if (disposed || ticket !== generation) return;
      if (initialScenarioId) open(initialScenarioId); else library();
    } catch (error) {
      if (disposed || ticket !== generation) return;
      phase = "load-error";
      host.replaceChildren(el("div.trpg-loading", [
        el("p", { text: "卓の用意が間に合いませんでした" }),
        el("small", { text: "通信を確認して、もう一度お試しください" }),
        el("button.trpg-button.primary", { type: "button", text: "もう一度用意する",
          dataset: { test: "trpg-retry-load" }, onclick: boot }), ...actions(),
      ]));
    }
  }

  signal?.addEventListener("abort", destroy, { once: true });
  if (signal?.aborted) destroy();
  const ready = disposed ? Promise.resolve() : boot();
  return { ready, finished, destroy,
    get disposed() { return disposed; },
    get loaded() { return !disposed && phase !== "loading" && phase !== "load-error"; },
    snapshot: () => disposed ? { phase: "closed" } : controller?.snapshot() || { phase },
    audioSnapshot: () => audio.snapshot(),
  };
}
