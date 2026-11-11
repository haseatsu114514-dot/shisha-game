// シーシャくじの演出の「絵の差し込み口」。
// 舞台の道具（抽選器の胴・脚・台・ハンドル・受け皿・玉・カウンター・黒板・鐘）と賞の札の地は、
// 採用済みの描いた絵（Codex 生成・asset_sources/ui/kuji-gacha-20261111/）があればそれを使い、無いあいだはコードで描いた下絵を出す。
// 絵を採用したら、下の KUJI_ART に「名前: { url }」を1行足す（置き場所と大きさは部品ごとに決まっていて、絵は枠に収めて表示する）。
// 依頼文と部品ごとの決まりは asset_sources/ui/kuji-gacha-20261111/prompts.md と README.md。
import { el } from "../core/util.js";

const img = (name) => new URL(`../../img/ui/kuji/${name}.webp`, import.meta.url).href;

/**
 * 採用済みの絵（#3228 で生成・#3313 で後処理・WebP は remake/tools/build_ui_skin.py の KUJI_PARTS で部品の枠に合わせて切り出し）。
 * 名前は部品の名前（drum・frame・base・handle・tray・counter・sign・bell・ball-s・ball-a・ball-b・ball-c・ball-last）。
 * 絵は部品の枠（css/motions/garagara.css の .kj-<部品>）いっぱいに表示する。枠と絵の縦横比が違う部品だけ box: [left, top, width, height]（px）を添える。
 * 玉置き（rail）・札の地・後ろの光・景品の包み・「大当たり」の帯は CSS、きらめきは motions/kuji-fx.js で差し替える。
 */
export const KUJI_ART = {
  drum: { url: img("garagara-drum") },
  // 軸受けの上の丸が枠の上へはみ出すので、枠を上へ広げる（軸は上から26.4px。奥の脚の回転の中心も合わせる: .kj-frame-far）
  frame: { url: img("garagara-frame"), box: [375, 265.6, 330, 337.3] },
  // 板の幅424px。脚の先が天板の中ほどに載る高さ
  base: { url: img("garagara-base"), box: [328, 579.4, 424.6, 60.8] },
  handle: { url: img("garagara-handle") },
  tray: { url: img("garagara-tray") },
  counter: { url: img("counter") },
  // 黒板は脚まで描いてあり、枠より少し幅が広い。字は書ける面に収める（.kj-sign[data-art="painted"] .kj-sign-text）
  sign: { url: img("sign"), box: [85.2, 250, 225.5, 340] },
  bell: { url: img("bell") },
  ...Object.fromEntries(["s", "a", "b", "c", "last"].map((k) => [`ball-${k}`, { url: img(`ball-${k}`) }])),
};

/** 部品を1つ作る。採用済みの絵があれば <img>、無ければ sketch()（コードで描いた下絵）を入れる。
 * 絵が読み込めなかったときも下絵に戻す（枠も CSS の大きさに戻す） */
export function artPart(name, className, sketch) {
  const art = KUJI_ART[name];
  const node = el(`div.kj-part.${className}`, { "aria-hidden": "true", dataset: { part: name, art: art ? "painted" : "sketch" } });
  if (!art) { node.append(sketch()); return node; }
  if (art.box) Object.assign(node.style, { left: `${art.box[0]}px`, top: `${art.box[1]}px`, width: `${art.box[2]}px`, height: `${art.box[3]}px` });
  const picture = el("img", { src: art.url, alt: "", draggable: "false", decoding: "async" });
  picture.addEventListener("error", () => {
    if (art.box) for (const key of ["left", "top", "width", "height"]) node.style.removeProperty(key);
    node.dataset.art = "sketch";
    picture.replaceWith(sketch());
  }, { once: true });
  node.append(picture);
  return node;
}

/** 演出が始まる前に絵を読み込んでおく（初めて回すときに部品が欠けないように）。一度だけ */
let warmed = null;
export function warmKujiArt() {
  warmed ??= Promise.all([...Object.values(KUJI_ART).map((art) => art.url), ...["card-s", "card-a", "card-b", "card-c", "card-last", "burst", "sparkle", "rail", "gift", "banner"].map(img)]
    .map((url) => new Promise((done) => { const pic = new Image(); pic.decoding = "async"; pic.onload = pic.onerror = done; pic.src = url; })));
  return warmed;
}
