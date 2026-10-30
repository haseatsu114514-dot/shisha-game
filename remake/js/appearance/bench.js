import { el } from "../core/util.js";
import { state } from "../core/state.js";
import { modal } from "../core/ui.js";
import { appearanceOptions } from "./model.js";
import { configureAppearance } from "./select.js";
import { appearancePreview } from "./render-preview.js";

const ROOT = new URL("../../../asset_sources/shisha-hardware-reference/skin-candidates-issue374/", import.meta.url);
// Avoid loading the catalog during ordinary setup. The catalog still validates every ID before drawing.
const APPROVED_IDS = new Set(["handle-01-yoshio", "handle-02-shishark-blue", "mouthpiece-01-crystal-drop", "mouthpiece-02-starmoon-charm"]);
const hasSelection = value => Object.values(value || {}).some(id => APPROVED_IDS.has(id));
let artworkPromise;
async function artwork() {
  artworkPromise ??= Promise.all(["candidates.json", "render-preview.json"].map(async file => {
    const response = await fetch(new URL(file, ROOT));
    if (!response.ok) throw new Error("外観資料を読み込めませんでした");
    return response.json();
  })).then(([source, geometry]) => ({ source, geometry, options: appearanceOptions(source) })).catch(error => {
    artworkPromise = null;
    throw error;
  });
  return artworkPromise;
}

export function attachBenchAppearance(bench, cs) {
  const { root, worker } = bench;
  const layer = el("div.worker-appearance", { dataset: { test: "worker-appearance" }, "aria-hidden": "true" });
  worker.root.querySelector(".bench-worker-stage").append(layer);
  let generation = 0;
  const draw = async () => {
    const current = ++generation;
    layer.replaceChildren();
    if (!hasSelection(cs.appearance)) return;
    try {
      const { source, geometry, options } = await artwork();
      if (current === generation && root.isConnected) layer.append(appearancePreview(cs.appearance, options, source, geometry));
    } catch { /* Optional artwork must never block the craft flow. */ }
  };
  void draw();
  let busy = false;
  const button = el("button.btn.small.bench-appearance-button", {
    type: "button", text: "外観を選ぶ", dataset: { test: "bench-appearance-open" },
    onclick: async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      const panel = el("div.bench-appearance-dialog", { role: "dialog", "aria-label": "装備の外観を選ぶ", dataset: { test: "bench-appearance-dialog" } });
      try {
        // Fetch only after an explicit action; the chooser owns its draft and cancellation.
        const { options } = await artwork();
        if (!root.isConnected) return;
        root.append(panel);
        const changed = await configureAppearance(state, () => panel, async () => options);
        if (changed) { cs.appearance = { ...state.appearance }; void draw(); }
      } catch (error) {
        if (root.isConnected) modal({ title: "外観を読み込めません", body: error.message });
      } finally {
        panel.remove();
        busy = false;
        button.disabled = false;
      }
    },
  });
  // 上部バーの流れに置き、工程表示・大会MENU・？ガイドに重ねない。
  (root.querySelector(".bench-top") || root).append(button);
}
