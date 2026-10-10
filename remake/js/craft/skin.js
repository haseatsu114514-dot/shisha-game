// 生成素材は静かな枠と質感。文字・回数・温度・針は実際のDOMで動かす。
import { DB, makingUrl } from "../core/data.js";

const SKINS = { button: "ui_craft_button.png", refresh: "ui_refresh_button.png", panel: "ui_craft_panel.png", inhale: "ui_mockup_inhale_button.png" };
export const craftSkinUrls = () => [...Object.values(SKINS), "ui_temperature_frame.png"].map(makingUrl).filter(Boolean);

export function applyCraftSkin(root) {
  for (const [id, file] of Object.entries(SKINS)) {
    const url = makingUrl(file), box = DB.manifest.makingBox?.[file];
    if (!url || !box) continue;
    const [l, t, r, b] = box;
    const w = r - l, h = b - t;
    if (w <= 0 || h <= 0) continue;
    // CSS変数の相対URLはCSSファイル基準になる。公開先のサブディレクトリにも対応する。
    root.style.setProperty(`--craft-${id}-art`, `url("${new URL(url, document.baseURI).href}")`);
    // 元PNGの透明な余白だけを表示時に吸収し、絵そのものをボタンに合わせる。
    // 吸うボタンのbboxには外光も含むため、枠本体が操作領域の高さに届くよう少し広げる。
    root.style.setProperty(`--craft-${id}-size`, `${100 / w}% ${(id === "inhale" ? 108 : 100) / h}%`);
    root.style.setProperty(`--craft-${id}-position`, `${w < 1 ? l / (1 - w) * 100 : 50}% ${h < 1 ? t / (1 - h) * 100 : 50}%`);
  }
  root.dataset.artSkin = "true";
}
