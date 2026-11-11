// シーシャ屋にうっすら漂う煙（docs/owner_requests.md の KMR21）。
// 見えている背景がシーシャ屋の店内のときだけ、背景のすぐ上（立ち絵・操作より下）に薄い煙を漂わせる。
// 背景を白く覆わず、気づく程度にごく薄く。夜でも層は7%、昼はさらに控えめ。描き方は core/smoke.js（もこもこの房）。
// 出さない: 端末の「動きを減らす」・自動操作・DS風の表示中・作業台や結果発表など背景が主役でない画面。
import { hazeLayer, smokeAllowed } from "./smoke.js";
import { timeOfDay } from "./state.js";

// シーシャ屋の店内の背景（時間帯・曇りの違いは同じ店として扱う）。
// tonari／第1章の3店（KEMURIKUSA・EDEN・PEPPERMINT）／第2章（MELTY PUFF・神崎煙草店）／
// 第3章の東京（mukai・煙幕・Smoke & Glory・鉄の煙）／第4章のドバイ（龍龍水煙所・カフェ3つ）。
// 葉や機材の店（Dr.fookah）・C.STATION・カフェ・ジム・クラブ・自宅・大会の舞台は入れない。
const SHISHA_SHOPS = new Set([
  "bg_tonari_inside", "kemurikusa", "eden", "bg_eden_shop", "peppermint",
  "bg_ageha_shop", "bg_yuzugaya_kumicho",
  "bg_mukai_shop", "bg_yohaku_shop", "bg_steve_shop", "bg_volk_shop",
  "bg_longlong_shop", "bg_dubai_cafe", "bg_dubai_cafe_salim", "bg_dubai_alley_cafe",
]);
// 背景が主役でない画面（作業台・結果発表・タイトル・エンディング）では出さない。ミニゲームの手触りを重くしない
const QUIET_SCREENS = new Set(["bench", "count", "result", "title", "end"]);

/**
 * 背景と画面から、漂う煙の濃さ（0＝出さない）を決める。夜は 1、昼は 0.55（客が少ない時間は控えめ）。
 * 背景の URL・ファイル名・res:// のどれでも受ける。昼夜は、絵の名前（_day・_night）か色味（tint が "night"）で決め、
 * どちらも無い店（昼夜で同じ絵）は now（"day"／"night"。省くとゲームの今の時間帯）で決める。
 */
export function hazeLevel(background, screen = "", tint = "", now = timeOfDay()) {
  if (QUIET_SCREENS.has(screen)) return 0;
  const file = String(background || "").split(/[?#]/)[0].split("/").pop().replace(/\.(?:png|webp)$/, "");
  const named = /_(day|night)$/.exec(file)?.[1];
  const base = file.replace(/_overcast(?=_(?:day|night)$)/, "").replace(/_(?:day|night)$/, "");
  if (!SHISHA_SHOPS.has(base)) return 0;
  return (tint === "night" ? "night" : named || now) === "night" ? 1 : .55;
}

/**
 * 漂う煙を出してよい端末か。自動操作のブラウザ（navigator.webdriver）は既定で出さない: 既存のブラウザ検査は
 * 背景や画面の見た目・寸法を測っていて、ずっと動く層が増えると結果がぶれるため（余白の core/side-area.js・
 * 見た目の様式の core/look.js と同じ線引き）。漂う煙の検査は localStorage の "suien_shop_haze" を "on" にして明示する
 * （test/browser/smoke_breath.mjs）。"off" にすると、遊ぶ端末でも止められる。
 */
function hazeAllowed() {
  let flag = null;
  try { flag = globalThis.localStorage?.getItem("suien_shop_haze"); } catch { /* 読めない環境は既定 */ }
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !(typeof navigator !== "undefined" && navigator.webdriver === true);
}

let haze = null;

/** 見えている背景と画面に合わせて、漂う煙を出す・濃さを変える・消す（ui.js が背景や画面を替えるたびに呼ぶ） */
export function syncShopHaze(background, screen, tint) {
  const stage = document.getElementById("stage");
  const level = stage && hazeAllowed() && smokeAllowed() && !document.hidden && document.documentElement.dataset.retroShell !== "on" ? hazeLevel(background, screen, tint) : 0;
  if (!level) { haze?.stop(); haze = null; return; }
  if (haze?.canvas.isConnected) { if (haze.level !== level) haze.setLevel(level); return; }
  let host = document.getElementById("haze");
  if (!host) {
    // 背景と雨の層より上、画面・立ち絵より下
    host = Object.assign(document.createElement("div"), { id: "haze" });
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, { zIndex: "6", pointerEvents: "none" });
    stage.insertBefore(host, document.getElementById("screen"));
  }
  haze = hazeLayer(host, { level });
}
