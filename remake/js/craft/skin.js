// 生成素材は静かな枠と質感。文字・回数・温度・針は実際のDOMで動かす。
import { DB, makingUrl } from "../core/data.js";

const SKINS = { button: "ui_craft_button.png", refresh: "ui_refresh_button.png", panel: "ui_craft_panel.png" };
export const craftSkinUrls = () => [...Object.values(SKINS), "ui_temperature_frame.png"].map(makingUrl).filter(Boolean);

export function applyCraftSkin(root) {
  for (const [id, file] of Object.entries(SKINS)) {
    const url = makingUrl(file), box = DB.manifest.makingBox?.[file];
    if (!url || !box) continue;
    const [l, t, r, b] = box;
    const w = r - l, h = b - t;
    if (w <= 0 || h <= 0) continue;
    root.style.setProperty(`--craft-${id}-art`, `url("${url}")`);
    // 元PNGの透明な余白だけを表示時に吸収し、絵そのものをボタンに合わせる。
    root.style.setProperty(`--craft-${id}-size`, `${100 / w}% ${100 / h}%`);
    root.style.setProperty(`--craft-${id}-position`, `${w < 1 ? l / (1 - w) * 100 : 50}% ${h < 1 ? t / (1 - h) * 100 : 50}%`);
  }
  root.dataset.artSkin = "true";
}
