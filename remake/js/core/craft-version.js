// #3795（2026-11-19）: チュートリアル・日常・後章の作業台は桜井版に統一。
// 第1章大会の既存の切替（CRN16/SKR04）と、独立した比較プレビューだけ旧版を保持する。
// 一台の開始時に cs.craftVersion へ写し、途中の設定変更では変えない。
export const CRAFT_VERSIONS = Object.freeze([
  { id: "renewal", label: "リニューアル" },
  { id: "sakurai", label: "桜井版" },
]);
/** 第1章大会の既存設定の既定値。#3795 の統一で大会の方式を変えない。 */
export const PLAYER_DEFAULT_CRAFT_VERSION = "renewal";

const known = (value) => CRAFT_VERSIONS.some((version) => version.id === value);

export const normalizeCraftVersion = (value) => known(value) ? value : PLAYER_DEFAULT_CRAFT_VERSION;

/** URL の ?craft=renewal|sakurai は設定より優先する（確かめる時に使う。保存はしない）。 */
export function craftVersionFrom(config, search = typeof location !== "undefined" ? location.search : "") {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search || "").get("craft"); } catch { /* 読めないURLは設定に従う */ }
  return known(fromUrl) ? fromUrl : normalizeCraftVersion(config?.craftVersion);
}

/** #3795: 制作は桜井版に統一。第1章大会だけ既存の設定・試合記録による選択を保つ。 */
export function craftVersionForSession(mode, chapter, config, search) {
  return mode === "tournament" && chapter === 1 ? craftVersionFrom(config, search) : "sakurai";
}

/** 版のない部品は従来のリニューアル扱い。本編の旧SAVEは openBench で第1章大会以外を桜井版に揃える。 */
export const renewalCraft = (cs) => cs?.craftVersion !== "sakurai";
