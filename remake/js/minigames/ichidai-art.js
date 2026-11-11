// カードゲーム「一台勝負」の絵の一覧。絵は remake/img/ui/ichidai/<種類>/<id>.webp に置き、ここに id を足すと画面に出る。
// 一覧に無いものは、色と1文字で描く（絵が無くても遊べる）。足し方は asset_sources/card_game/README.md。
//   flavor … 葉（id は ichidai-data.js の FLAVORS の id。例: lemon）
//   card   … デッキのカード（id は CARDS の id。例: flat, cube, heat_in）
//   table  … 卓の天板（counter）
import { imgFileUrl } from "../core/img-file.js";

export const ICHIDAI_ART = Object.freeze({
  flavor: ["black_tea", "blueberry", "cardamom", "chocolate", "cinnamon", "coffee", "cool_mint", "death_by_ice", "double_apple", "ice_grape", "jasmine", "lavender", "lemon", "mango", "mint", "peach", "rose", "spring_water", "vanilla", "white_gummy_bear"],
  card: ["cube", "dense_flat", "flat"],
  table: ["counter"],
});

export function artUrl(kind, id) {
  return ICHIDAI_ART[kind]?.includes(id) ? imgFileUrl(`ui/ichidai/${kind}/${id}.webp`) : null;
}
