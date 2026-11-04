// 「てつこといっしょ / TETSUKO TIME」の入口の土台（#2454）。
// オーナー指示（2026-11-04）: いまはアイコンと「このゲームを遊べる動線の土台」だけを作る。
// 正ゲーム（なでる・猫じゃらし・気分・模様替え・しぐさ図鑑・アルバム等）はまだ実装しない。
// ここは「選べる入口」と「準備中の画面」だけを持つ足場で、遊びの中身は入っていない。
//
// 動線: mukai で行動 → 帰りに裏口をのぞく（ch3-tokyo-daily.js の offerTetsuko）→
//       「てつこといっしょ」を選ぶ → この準備中の画面 → 「帰る」で日常ループへ戻る。
//
// この足場は保存を一切変えない: 回復・来訪回数・好感度・火種・経験値・フラグ・日付や時間を動かさない。
// 既存の「少し構っていく」（4段階＋巡回の会話・回復+12・来訪加算。#1993）はそのまま温存する。
//
// 画像: 既存のてつこの顔アイコン（face_tetsuko）を仮のアイコンに流用する。正式なふれあい用の
//   動作ポーズ素材は Codex 向けの別依頼（Issue #2454 §11 / asset_sources/tetsuko-care/）で用意する。
//   設計・コード担当は別個体の猫や未承認素材を生成・採用しない。
//
// DOM 依存（ui.js / util.js / audio.js / data.js）は openTetsukoTime の中で遅延 import する。
// これにより本ファイルの top-level は DOM 非依存で、Node のテストからそのまま import できる。

export const TETSUKO_TIME = Object.freeze({
  id: "tetsuko_time",
  title: "てつこといっしょ",
  roman: "TETSUKO TIME",
});

// ─────────────────────────────────────────────────────────────────────────────
// TODO(#2454): 正ゲームはここに差し込む。Issue #2454 §10 の責務分割に沿って分ける:
//   (1) モデル   … 猫の状態と行動選択。DOM なしで決定・テストできる（minigames/ に別ファイル）。
//   (2) 画面     … ふれあい画面（タッチ／マウス入力・猫と小物の表示・音）。この openTetsukoTime を置き換える。
//   (3) データ   … しぐさ図鑑・小物の定義。データとして追加できる形（data/ か remake/data/）。
//   (4) アダプター … 本編との接続。既存 mukai 訪問・会話・回復(12)・来訪加算・保存の確定を
//                   下の settleTetsukoTime に集約する（再入場・二重クリック・LOAD で二重付与しない）。
//   (5) アルバム … 報酬を発生させない閲覧・回想（フリーモードは本編の関係・回復・物を増やさない）。
// 受け入れ条件・ゆるさの指針・保存するもの／しないものは Issue #2454 本文（§3〜§13）を正とする。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 本編アダプターの確定点（#2454 §10-4）。
 * 足場の現状: 何も確定しない（回復なし・来訪なし・フラグなし・時間なし）。{ committed:false } を返すだけ。
 * 正ゲーム実装時は、意味のあるふれあいを終えた時だけ、親の mukai 訪問から渡す安定した訪問キーを使って
 * 回復(12)／来訪加算／発見の記録を「一つの保存境界」でここに書く。何もせず閉じた場合は追加報酬なし。
 * @param {object} [state] 現在のセーブ（足場では参照しない）
 * @param {object} [result] 画面からの結果（足場では未使用）
 * @returns {{ committed: boolean }}
 */
export function settleTetsukoTime(state, result) {
  // 足場は閲覧専用。保存は一切変えない。
  return { committed: false };
}

/**
 * 「てつこといっしょ」を開く（#2454 §10-2 画面の入口）。いまは準備中の画面を見せて、「帰る」で戻るだけ。
 * 遊んでも保存は変わらないので、親の行動結果（回復・来訪）には影響しない。
 * @param {object} [ctx]
 * @param {() => boolean} [ctx.isCurrent] このセッションがまだ有効か（LOAD/章跨ぎで false）
 * @param {AbortSignal} [ctx.signal] 中断シグナル（pagehide などで閉じる）
 * @returns {Promise<{ committed: boolean }>} 常に { committed:false }（足場は何も確定しない）
 */
export async function openTetsukoTime({ isCurrent = () => true, signal = null } = {}) {
  if (signal?.aborted || !isCurrent()) return settleTetsukoTime();
  const [{ el }, ui, audio, data] = await Promise.all([
    import("../core/util.js"),
    import("../core/ui.js"),
    import("../core/audio.js"),
    import("../core/data.js"),
  ]);
  if (signal?.aborted || !isCurrent()) return settleTetsukoTime();
  const { layers, showScreen } = ui;
  const icon = data.faceIconUrl("tetsuko");
  return await new Promise(resolve => {
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      window.removeEventListener("pagehide", leave);
      signal?.removeEventListener?.("abort", leave);
      // 自分の準備中画面がまだ出ていれば片付ける（親の日常ループが次に地図を描き直す）。
      if (layers.screen?.firstElementChild?.dataset?.test === "tetsuko-time-screen") showScreen("none", null);
      resolve(settleTetsukoTime());
    };
    const host = el("div.sub-menu.tetsuko-time", { dataset: { test: "tetsuko-time-screen" } }, [
      el("h2.sub-title", { text: TETSUKO_TIME.title }),
      icon ? el("img.tetsuko-time-face", { src: icon, alt: "てつこ",
        style: { width: "112px", height: "112px", "object-fit": "contain", display: "block", margin: "6px auto 2px" } }) : null,
      el("p.sub-lead", { text: `${TETSUKO_TIME.roman} ── 準備中` }),
      el("p.sub-lead", { text: "てつこと のんびり過ごせるミニゲームは、これから少しずつ作っていきます。" }),
      el("button.btn.ghost.small.sub-back", { type: "button", text: "← 帰る",
        dataset: { test: "tetsuko-time-back" }, onclick: () => { audio.SE?.select?.(); leave(); } }),
    ]);
    window.addEventListener("pagehide", leave, { once: true });
    signal?.addEventListener?.("abort", leave, { once: true });
    showScreen("tetsuko-time", host);
  });
}
