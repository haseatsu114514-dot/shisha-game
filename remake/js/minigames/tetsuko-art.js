// 「てつこといっしょ」の絵の差し替え表（#2454・TKT01）。Codex に頼んだ素材（asset_sources/tetsuko-care/README.md）が
// 届いて採用したら、ここの ART_READY に名前を書く。書いた素材だけが CSS の絵から差し替わる。
// 書いていない素材は読みに行かない（404 を出さない・届く前のテストを壊さない）。
//
// 置き場所: 背景は assets/backgrounds/bg_mukai_backdoor_{day,night}.png（data.js の sceneBg が昼夜を選ぶ）、
// 猫・小物・UI は assets/ui/tetsuko/*.png と実行時の remake/img/ui/tetsuko/*.webp。
// 猫のしぐさは 1024×768 の透明な画面に、既存の立ち絵と同じ縮尺（顔の幅約150px）・体が地面に触れる線 y=736・中心 x=512 で置く。
import { imgFileUrl } from "../core/img-file.js";

export const ART_READY = Object.freeze({
  // 裏口の背景（#2689・PR #2695 の案02 を 2026-11-11 に採用。1672×941 のまま・オーナー承認）。舞台と一緒に寄せる（.tt-backdrop）
  background: true,           // bg_mukai_backdoor_day / _night
  // しぐさ: #2690 の A 段8枚（PR #2715 の候補から 2026-11-11 採用）と、#3214（TKT26）の "leap","flop","mew","poke"。
  // #2690 の B 段 "walk_a","walk_b","lookback","stretch" は未着（#3214 で依頼中）。
  poses: Object.freeze(["loaf", "crouch", "reach", "hug", "groom", "yawn", "belly", "rub", "leap", "flop", "mew", "poke"]),
  // 小物: #2697（#2691）の原画を採用（2026-11-07・TKT13）。lap（はじめの膝）と tunnel_tail（トンネルから出るしっぽ）は #3214（2026-11-11）。
  props: Object.freeze(["box", "ball", "cushion", "scratcher", "tunnel", "bed", "plate", "teaser", "brush", "lap", "tunnel_tail"]),
  // UI: 紙×ラベンダーの "icons","notebook","photo_frame","tape","memo","paw_stamp","caption","toolbox","button"（#2691・専用テーマ後は使わない）。
  // 専用テーマ「茶トラと段ボール」の部品（#3213・TKT25・2026-11-11 採用）。名前を書いた部品は CSS の描画が絵に替わる。
  // B 段（#3243・Codex の PR #3248 の原画・2026-11-11 採用）: トレー・札・紙・手帳（と背）・写真の額・テープ・外枠・箱のふた（と封のテープ）・
  // 置き場所のしるし・「新」のシール・名前の札・まだ見つけていないしぐさの札。
  ui: Object.freeze(["tk_icons", "tk_token", "tk_tab", "tk_heart", "tk_pill", "tk_wish", "tk_caption", "tk_title", "tk_fx",
    "tk_tray", "tk_card", "tk_panel", "tk_book", "tk_photo", "tk_tape", "tk_frame", "tk_flap", "tk_slot", "tk_badge", "tk_nametag", "tk_unknown"]),
});

/** しぐさの絵（1024×768）の基準: 画面の上の大きさと足元。CSS の .tt-cat と同じ縮尺で重ねる。 */
export const POSE_CANVAS = Object.freeze({ w: 1024, h: 768, ax: 512, ay: 736 });

export const hasPose = name => !!name && ART_READY.poses.includes(name);
export const hasProp = id => ART_READY.props.includes(id);
export const hasUi = name => ART_READY.ui.includes(name);
export const poseUrl = name => hasPose(name) ? imgFileUrl(`ui/tetsuko/cat_${name}.webp`) : null;
export const propUrl = (id, part = "") => hasProp(id) ? imgFileUrl(`ui/tetsuko/prop_${id}${part ? `_${part}` : ""}.webp`) : null;
export const uiUrl = name => hasUi(name) ? imgFileUrl(`ui/tetsuko/ui_${name}.webp`) : null;
/** 専用テーマのアイコン（#3213 のシートから1つずつ切り出した絵）。名前は tetsuko-time.js の ICONS と同じ。 */
export const TK_ICONS = Object.freeze(["hand", "teaser", "brush", "treat", "decor", "book", "photo", "back", "heart", "wish", "tap", "watch"]);
export const tkIconUrl = name => hasUi("tk_icons") && TK_ICONS.includes(name) ? imgFileUrl(`ui/tetsuko/ui_tk_icon_${name}.webp`) : null;
/** 画面の data 属性に並べる（CSS の [data-art-props~="box"] などで、届いた素材の時だけ絵を使う）。 */
export const artAttrs = () => ({ artBg: String(ART_READY.background), artProps: ART_READY.props.join(" "), artUi: ART_READY.ui.join(" ") });
