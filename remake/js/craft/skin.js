// 生成素材は静かな枠と質感。文字・回数・温度・針は実際のDOMで動かす。
import { DB, makingUrl } from "../core/data.js";

const SKINS = { button: "ui_craft_button.png", refresh: "ui_refresh_button.png", panel: "ui_craft_panel.png", inhale: "ui_mockup_inhale_button.png" };
// 初期画面の枠とボタンに加えて、制作のCSSが使う枠・札・ボタンの絵（温度帯ゲージの外枠など）も待つ。
// CSSの背景の絵は、その部品が初めて出た時にやっと読みにいくので、待たないと画面が出てから枠が遅れて現れる（CRN・温度帯ゲージの読み込み）。
// 蒸らし・吸引の固有UIはその工程のreadinessで待つ。
export const craftSkinUrls = () => [...[SKINS.button, SKINS.panel].map(makingUrl).filter(Boolean), ...craftStyleImageUrls()];

const CRAFT_SHEET = /\/css\/(craft[\w-]*|steam|craft-rank|wide-craft)\.css(\?|$)/;
let styleImages = null;
/** 制作のスタイルシートが使う絵の URL（重複なし）。一度だけ数えて覚えておく。DOM の無い環境では空 */
export function craftStyleImageUrls() {
  if (styleImages) return styleImages;
  const sheets = globalThis.document?.styleSheets;
  if (!sheets) return [];
  const found = new Set();
  const walk = (rules, base) => {
    for (const rule of rules || []) {
      if (rule.cssRules) walk(rule.cssRules, base);
      for (const m of String(rule.cssText || "").matchAll(/url\(\s*["']?([^"')]+?\.(?:webp|png|jpe?g))["']?\s*\)/gi)) {
        try { found.add(new URL(m[1], base).href); } catch { /* 読めない指定は飛ばす */ }
      }
    }
  };
  for (const sheet of sheets) {
    if (!CRAFT_SHEET.test(sheet.href || "")) continue;
    try { walk(sheet.cssRules, sheet.href); } catch { /* 別オリジンなどで読めないシートは飛ばす */ }
  }
  // スタイルシートがまだ揃っていない時は覚えず、次に呼ばれた時に数え直す
  if (found.size) styleImages = [...found];
  return [...found];
}

/** 起動後の空き時間に、制作の枠の絵を先に読んでおく（初めての作業台で待たないように）。読み込みの順位は低く */
export function warmCraftStyleImages() {
  return Promise.all(craftStyleImageUrls().map(url => new Promise(resolve => {
    const img = new Image();
    img.fetchPriority = "low";
    img.onload = img.onerror = () => resolve();
    img.src = url;
  })));
}

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
