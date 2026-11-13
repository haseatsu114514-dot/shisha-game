// 大会の審査の方式（第1章の SMOKE CROWN CUP・試作）。2026-11-13 オーナー「桜井式も作ってみて　なお気に入らなかったら
// 戻せるようにはしといて」（docs/owner_requests.md の SKR04）。桜井式の中身は craft/ch1-votes.js の SAKURAI。
// 進行・報酬・セーブの形には触れない。方式は試合を始める時に票の記録（voteAttempt.style）へ写し、
// 試合の途中で設定を変えても、その試合は始めた方式で最後まで進む。
export const VOTE_STYLES = Object.freeze([
  { id: "sakurai", label: "桜井式（試作）" },
  { id: "classic", label: "いままで" },
]);
/** いままでの審査（累積の平均で各回の票を決める・#2536）。 */
export const CLASSIC_VOTE_STYLE = "classic";
/** プレイヤーの端末で、何も選んでいない時の方式。 */
export const PLAYER_DEFAULT_VOTE_STYLE = "sakurai";

const known = (value) => VOTE_STYLES.some((style) => style.id === value);

/**
 * 何も選んでいない端末の既定。プレイヤーは桜井式。
 * 自動操作のブラウザ（navigator.webdriver。ブラウザテスト）だけは、いままでの審査を既定にする。既存の大会の検査が
 * いままでの票を前提に書かれているため（見た目の様式の LK09 と同じ考え方・core/look.js）。桜井式の検査は
 * ?vote=sakurai か設定で明示して選ぶ（browser/ch1_vote_style.mjs）。
 */
export function defaultVoteStyle() {
  return typeof navigator !== "undefined" && navigator.webdriver === true ? CLASSIC_VOTE_STYLE : PLAYER_DEFAULT_VOTE_STYLE;
}

export function normalizeVoteStyle(value) {
  return known(value) ? value : defaultVoteStyle();
}

/** URL の ?vote=sakurai|classic は設定より優先する（確かめる時に使う。保存はしない）。 */
export function voteStyleFrom(config, search = typeof location !== "undefined" ? location.search : "") {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search || "").get("vote"); } catch { /* 読めないURLは設定に従う */ }
  return known(fromUrl) ? fromUrl : normalizeVoteStyle(config?.voteStyle);
}
