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
  // 速く回っているあいだ胴に重ねる、回転でぶれた絵（軸を中心に ±9° を平均したもの）
  "drum-blur": { url: img("garagara-drum-blur") },
  // 軸受けの上の丸が枠の上へはみ出すので、枠を上へ広げる（軸は上から26.4px。奥の脚の回転の中心も合わせる: .kj-frame-far）
  frame: { url: img("garagara-frame"), box: [375, 265.6, 330, 337.3] },
  // 板の幅424px。天板は上から41.6px（y571〜613）。手前の脚の足先（下端 y600）と、奥の脚の足先（右へ22・上へ16。下端 y584）が
  // どちらも天板に載るよう、2組の脚の中ほど（右へ11）に置く
  base: { url: img("garagara-base"), box: [339, 571.4, 424.6, 57.1] },
  handle: { url: img("garagara-handle") },
  tray: { url: img("garagara-tray") },
  counter: { url: img("counter") },
  // 黒板は脚まで描いてあり、枠より少し幅が広い。字は書ける面に収める（.kj-sign[data-art="painted"] .kj-sign-text）
  sign: { url: img("sign"), box: [85.2, 250, 225.5, 340] },
  bell: { url: img("bell") },
  ...Object.fromEntries(["s", "a", "b", "c", "last"].map((k) => [`ball-${k}`, { url: img(`ball-${k}`) }])),
};

/**
 * くじのランク（店）ごとの抽選器の見た目（data/kuji.json の machine。2026-11-11 オーナー「くじのランクによってガラガラの見た目を変えたり豪華に」GCH16）。
 * walnut＝本店（くるみ材と黒い鉄。元の絵）／steel＝柚ヶ谷店（オーク材とステンレス）／brass＝東京店（マホガニーと真鍮）／
 * marble＝ドバイ店（白い大理石調と金）／lacquer＝限定台くじ（黒い漆と金）。上の店ほど豪華（lux: 0〜4。演出の華やかさにも使う）。
 * 色替えした絵は元の絵を素材ごとに塗り替えたもので、形と置き場所は同じ（remake/tools/build_ui_skin.py の KUJI_LOOKS）。
 */
export const KUJI_LOOKS = { walnut: { lux: 0 }, steel: { lux: 1 }, brass: { lux: 2 }, marble: { lux: 3, gem: true }, lacquer: { lux: 4, gem: true } };
export const lookOf = (look) => (KUJI_LOOKS[look] ? look : "walnut");
const LOOK_FILES = { drum: "garagara-drum", "drum-blur": "garagara-drum-blur", frame: "garagara-frame", base: "garagara-base", handle: "garagara-handle", tray: "garagara-tray" };
/** その見た目での部品の絵。plain は色替え前の絵（色替えした絵が読み込めないときに使う） */
function artOf(name, look) {
  const art = KUJI_ART[name];
  return art && LOOK_FILES[name] && look && look !== "walnut" && KUJI_LOOKS[look] ? { ...art, url: img(`${LOOK_FILES[name]}-${look}`), plain: art.url } : art;
}

/** 部品を1つ作る。採用済みの絵があれば <img>、無ければ sketch()（コードで描いた下絵）を入れる。look は抽選器の見た目（色替えした絵）。
 * 絵が読み込めなかったときは、色替え前の絵 → 下絵の順に戻す（下絵に戻すときは枠も CSS の大きさに戻す） */
export function artPart(name, className, sketch, look = "") {
  const art = artOf(name, look);
  const node = el(`div.kj-part.${className}`, { "aria-hidden": "true", dataset: { part: name, art: art ? "painted" : "sketch" } });
  if (!art) { node.append(sketch()); return node; }
  if (art.box) Object.assign(node.style, { left: `${art.box[0]}px`, top: `${art.box[1]}px`, width: `${art.box[2]}px`, height: `${art.box[3]}px` });
  const picture = el("img", { src: art.url, alt: "", draggable: "false", decoding: "async" });
  let plain = art.plain;
  picture.addEventListener("error", () => {
    if (plain) { picture.src = plain; plain = null; return; }
    if (art.box) for (const key of ["left", "top", "width", "height"]) node.style.removeProperty(key);
    node.dataset.art = "sketch";
    picture.replaceWith(sketch());
  });
  node.append(picture);
  return node;
}

/** 軸に付ける宝石（上位の抽選器だけ）。無い見た目では null */
export function gemPart(look) {
  if (!KUJI_LOOKS[look]?.gem) return null;
  const picture = el("img.kj-gem", { src: img(`gem-${look}`), alt: "", draggable: "false", decoding: "async", "aria-hidden": "true" });
  picture.addEventListener("error", () => picture.remove(), { once: true });
  return picture;
}

/** 演出が始まる前に絵を読み込んでおく（初めて回すときに部品が欠けないように）。見た目ごとに一度だけ */
const warmed = new Map();
export function warmKujiArt(look = "walnut") {
  const key = lookOf(look);
  if (!warmed.has(key)) {
    const urls = [...Object.keys(KUJI_ART).map((name) => artOf(name, key).url), ...(KUJI_LOOKS[key].gem ? [img(`gem-${key}`)] : []),
      ...["card-s", "card-a", "card-b", "card-c", "card-last", "burst", "sparkle", "rail", "gift", "banner"].map(img)];
    warmed.set(key, Promise.all(urls.map((url) => new Promise((done) => { const pic = new Image(); pic.decoding = "async"; pic.onload = pic.onerror = done; pic.src = url; }))));
  }
  return warmed.get(key);
}
