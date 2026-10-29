// LIME のカスタムアイコン（オーナー採用済みの設定アイコン）。
// 顔ドット絵より優先するが、私用アカウントには使わない（正体保護のため呼び出し側で制御）。
// 読込に失敗した場合は呼び出し側が顔アイコン／頭文字へ段階的に戻す。
// 素材: asset_sources/lime-icons-1081-i01（PR #1175 の候補から採用: アダム=B案／みんと=B案／つむぎ=A案）
import { img } from "../core/data.js";

const CUSTOM_LIME_ICONS = {
  adam: "adam-b.png",
  minto: "minto-b.png",
  tsumugi: "tsumugi-a.png",
};

/** 採用済みカスタムアイコンの URL。未採用の相手は null */
export function customLimeIconUrl(id) {
  const file = CUSTOM_LIME_ICONS[id];
  return file ? img(`ui/lime/${file}`) : null;
}
