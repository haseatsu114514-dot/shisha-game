// LIME のカスタムアイコン（オーナー採用済みの設定アイコン）。
// 顔ドット絵より優先するが、私用アカウントには使わない（正体保護のため呼び出し側で制御）。
// 読込に失敗した場合は呼び出し側が顔アイコン／頭文字へ段階的に戻す。
// 素材: asset_sources/lime-icons-1081-i01（PR #1175 の候補から採用: アダム=B案／みんと=B案／つむぎ=A案）
//       asset_sources/lime-icons-picker-20261030（Issue #1768 の選別で決定した15人分。1人1枚）
import { img } from "../core/data.js";

const CUSTOM_LIME_ICONS = {
  adam: "adam-b.png",
  minto: "minto-b.png",
  tsumugi: "tsumugi-a.png",
  ageha: "ageha-a.png",
  dr_kemuri: "dr_kemuri-b.png",
  hiyori: "hiyori-a.png",
  kumicho: "kumicho-b.png",
  maezono: "maezono-08.png", // 私服セットの08番をお仕事用アカウントに使う
  mashiro: "mashiro-b.png",
  nagumo: "nagumo-a.png",
  naru: "naru-private.png", // 私服案をお仕事用アカウントに使う（なるに私用アカウントは無い）
  pakki: "pakki-a.png",
  rei: "rei-b.png",
  rin: "rin-a.png",
  samechan: "samechan-koro.png",
  sumi: "sumi-b.png",
  uranaishi: "uranaishi-b.png",
  hajime: "hajime-b.png", // 主人公。今は自分のアイコンを出す画面が無いので表示されない
};

/** 採用済みカスタムアイコンの URL。未採用の相手は null */
export function customLimeIconUrl(id) {
  const file = CUSTOM_LIME_ICONS[id];
  return file ? img(`ui/lime/${file}`) : null;
}
