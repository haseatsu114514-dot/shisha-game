// シーシャ作りの版（2026-11-13 オーナー「リニューアル版と桜井版が今あるけどどっちも遊んで試せるようにしたい。
// どっちを採用するかはこちらで決めるので決まったら片方を消す」・docs/owner_requests.md の CRN16）。
//   renewal（リニューアル）: 作業台のリニューアル（CRN01〜15）＋いままでの審査
//   sakurai（桜井版）    : リニューアル前の作業台＋第1章の大会の桜井式の審査（SKR04・core/vote-style.js）
// 版で分かれるのは遊びの手応えだけ（ランクの上がり方・穴あけ・吸い出し・待ち・炭焼き・雑念よけ・札・お手本）。
// 軽さ（CRN13・14）と位置ずれ対策（CRN11）はどちらの版にも効く。版は一台を始める時に cs.craftVersion へ写し、
// 作業台の途中では変えない。片方に決めたら、renewalCraft(cs) の分かれ道と、この設定を消す。
export const CRAFT_VERSIONS = Object.freeze([
  { id: "renewal", label: "リニューアル" },
  { id: "sakurai", label: "桜井版" },
]);
/** 何も選んでいない端末（自動操作のブラウザを含む）の版。 */
export const PLAYER_DEFAULT_CRAFT_VERSION = "renewal";

const known = (value) => CRAFT_VERSIONS.some((version) => version.id === value);

export const normalizeCraftVersion = (value) => known(value) ? value : PLAYER_DEFAULT_CRAFT_VERSION;

/** URL の ?craft=renewal|sakurai は設定より優先する（確かめる時に使う。保存はしない）。 */
export function craftVersionFrom(config, search = typeof location !== "undefined" ? location.search : "") {
  let fromUrl = null;
  try { fromUrl = new URLSearchParams(search || "").get("craft"); } catch { /* 読めないURLは設定に従う */ }
  return known(fromUrl) ? fromUrl : normalizeCraftVersion(config?.craftVersion);
}

/** この一台がリニューアルの手応えで動くか。版の無い一台（古いSAVE・部品だけのテスト）はリニューアル。 */
export const renewalCraft = (cs) => cs?.craftVersion !== "sakurai";
