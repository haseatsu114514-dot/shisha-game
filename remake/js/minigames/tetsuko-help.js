// 「てつこといっしょ」の遊び方（#2717）。画面には出さず、右上の「？」を開いた時だけ見せる。
// ミニゲーム共通の方針（オーナー・2026-11-06）: 文字を密集させない／操作や遊び方の確認は「？」を開いて見る（常時表示しない）／
// 基本画面は必要なUIだけ。そのため、道具の使い方・画面のしるし（ハート・吹き出し・カメラ）の意味はここにまとめる。
// 文は短く（1行に収まる長さを目安に）、UIの地の文なので「。」で終える。アイコンの名前は tetsuko-time.js の ICONS と同じ。
// top-level は DOM 非依存（表だけ）。

export const HELP_TITLE = "あそびかた";

export const HELP = Object.freeze([
  Object.freeze({ title: "手元の道具", rows: Object.freeze([
    Object.freeze({ icon: "hand", name: "なでる", text: "てつこをなでる。お気に入りの場所は日替わり。" }),
    Object.freeze({ icon: "teaser", name: "じゃらし", text: "指で動かす。飛びつかれたら、止めても引いてもいい。" }),
    Object.freeze({ icon: "brush", name: "ブラシ", text: "てつこをなぞる。ムカイさんに教わると使える。" }),
    Object.freeze({ icon: "treat", name: "おやつ", text: "1日に1回あげられる。" }),
  ]) }),
  Object.freeze({ title: "画面のしるし", rows: Object.freeze([
    // ごきげん（その日のハート）は上がり下がりする。なかよし（肉球）は来訪をまたいで溜まり、減らない。
    Object.freeze({ icon: "heart", name: "ごきげん", text: "嫌がることを続けると減る。いっぱいで、とっておき。" }),
    Object.freeze({ icon: "paw", name: "なかよし", text: "帰る時のハートが多いほど伸びる。ハートの枠も増える。" }),
    Object.freeze({ icon: "wish", name: "吹き出し", text: "てつこが、今してほしいこと。" }),
    Object.freeze({ icon: "watch", name: "見守る", text: "何もしないでいると、隣で見守ったことになる。" }),
  ]) }),
  Object.freeze({ title: "上の道具", rows: Object.freeze([
    Object.freeze({ icon: "photo", name: "撮影", text: "ハートが3つあると、しぐさを撮らせてくれる。" }),
    Object.freeze({ icon: "decor", name: "もようがえ", text: "物を置く。置いた物は、タップでてつこを誘える。" }),
    Object.freeze({ icon: "book", name: "てつこ手帳", text: "しぐさと写真が残る。探すしぐさも選べる。" }),
    Object.freeze({ icon: "back", name: "帰る", text: "遊びを切り上げて裏口を出る。" }),
  ]) }),
]);

export const HELP_NOTE = "なかよしは次の日に引き継がれる。節目で、てつこが何かを置いていく。";

/**
 * 「？」の中身を作る（DOM は呼び出し側の el で作る）。
 * @param {object} p
 * @param {Function} p.el core/util.js の el
 * @param {(name: string) => string} p.icon アイコンの SVG 文字列（tetsuko-time.js の icon）
 * @param {string} [p.mood] 今日のてつこ（画面には気分のしるしだけ出すので、文はここで読める）
 * @param {() => void} p.onClose 閉じる
 */
export function helpCard({ el, icon, mood = "", onClose }) {
  return el("div.tt-help-card", [
    el("header.tt-help-head", [el("h3", { text: HELP_TITLE }), mood ? el("p.tt-help-mood", { dataset: { test: "tetsuko-help-mood" }, text: mood }) : null]),
    el("div.tt-help-groups", HELP.map(group => el("section.tt-help-group", [
      el("h4", { text: group.title }),
      el("ul.tt-help-rows", group.rows.map(row => el("li.tt-help-row", { dataset: { test: `tetsuko-help-${row.icon}` } }, [
        el("span.tt-help-ico", { html: icon(row.icon) }), el("b.tt-help-name", { text: row.name }), el("span.tt-help-text", { text: row.text }),
      ]))),
    ]))),
    el("p.tt-help-note", [el("i.tt-stamp", { "aria-hidden": "true" }), HELP_NOTE]),
    el("button.btn.small.tt-help-close", { type: "button", text: "閉じる", dataset: { test: "tetsuko-panel-close" }, onclick: onClose }),
  ]);
}
