// 大会の審査の方式（第1章の SMOKE CROWN CUP・試作）。2026-11-13 オーナー「桜井式も作ってみて　なお気に入らなかったら
// 戻せるようにはしといて」（docs/owner_requests.md の SKR04）。桜井式の中身は craft/ch1-votes.js の SAKURAI。
// 進行・報酬・セーブの形には触れない。方式は試合を始める時に票の記録（voteAttempt.style）へ写し、
// 試合の途中で設定を変えても、その試合は始めた方式で最後まで進む。
import { craftVersionFrom } from "./craft-version.js";

// 2026-11-13（CRN16）から、方式はシーシャ作りの版（core/craft-version.js）で決まる: 桜井版＝桜井式、リニューアル＝いままで。
export const VOTE_STYLES = Object.freeze([
  { id: "sakurai", label: "桜井式（試作）" },
  { id: "classic", label: "いままで" },
]);
/** いままでの審査（累積の平均で各回の票を決める・#2536）。 */
export const CLASSIC_VOTE_STYLE = "classic";

const known = (value) => VOTE_STYLES.some((style) => style.id === value);

/** シーシャ作りの版から決まる審査の方式。 */
export const voteStyleForCraftVersion = (version) => version === "sakurai" ? "sakurai" : CLASSIC_VOTE_STYLE;

/** URL の ?vote=sakurai|classic は版より優先する（審査だけを確かめる時に使う。保存はしない）。 */
export function voteStyleFrom(config, search = typeof location !== "undefined" ? location.search : "") {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search || "").get("vote"); } catch { /* 読めないURLは版に従う */ }
  return known(fromUrl) ? fromUrl : voteStyleForCraftVersion(craftVersionFrom(config, search));
}
