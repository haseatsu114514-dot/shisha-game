// 操作に必要な現在の素材を待つ。別工程・全員の全表情は開始条件にしない。
import { makingUrl, portraitInfo, bgUrl, faceIconUrl } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { coalCount, coalTypes } from "./coals.js";
import { coalSpriteFiles } from "./heat_view.js";
import { bowlArtFiles } from "./art.js";
import { WORKER_SCENES } from "./worker-scenes.js";
import { audienceAssetUrls } from "./audience.js";

const BASE = ["bench_base.png", "ui_craft_panel.png", "ui_craft_button.png",
  "hookah_base.png", "hookah_stem.png", "hookah_tray.png", "bowl_empty_silicone.png"];
const STEPS = {
  setup: ["bowl_empty_phunnel.png", "bowl_empty_clay.png"],
  mix: [], pack: [],
  holes: ["foil_interactive_top.png", "hajime_craft_holes_hover.png", "hajime_craft_holes_contact.png", "hajime_craft_holes_release.png"],
  heat: ["heat_stove.png", "heat_carrier.png"],
  place: ["coal_just.png", "coal_flat_just.png"],
  timer: ["kitchen_timer.png", "hajime_steam_wait.png"],
  steam: ["hajime_steam_wait.png", "ui_refresh_button.png", "ui_temperature_frame.png"],
  pull: ["ui_mockup_inhale_button.png", "ui_mockup_flavor_leaf.png", "ui_temperature_frame.png", "hajime_craft_pull.png"],
};
export function craftAssetUrls(mode = "tournament", { step = "setup", cs = null, count = null } = {}) {
  const kind = step === "care" ? "pull" : step;
  const files = [...BASE, ...(STEPS[kind] || [])];
  const scene = WORKER_SCENES[kind];
  if (scene) files.push(scene.file);
  if (["mix", "pack"].includes(kind)) files.push(...bowlArtFiles(cs));
  if (kind === "heat") {
    const n = count ?? (cs ? coalCount(cs) : 3);
    const types = cs ? coalTypes(cs, n) : ["flat_charcoal", "cube_charcoal"];
    types.forEach(type => files.push(...Object.values(coalSpriteFiles(type))));
  }
  const people = cs?.audienceIds || (mode === "tournament" ? ["pakki", "nagumo", "maezono", "dr_kemuri"] : ["hajime", "sumi"]);
  return [...new Set([
    ...files.map(makingUrl),
    bgUrl(mode === "tournament" ? "bg_tournament_stage" : "bg_tonari_inside"),
    portraitInfo("hajime", "serious")?.src,
    ...people.map(faceIconUrl),
    ...audienceAssetUrls(cs || { mode, audienceIds: people }),
  ].filter(Boolean))];
}
export function warmCraftAssets(mode, options) {
  return Promise.all(craftAssetUrls(mode, options).map(url => imageReady(url, 15000, { keep: true })));
}
