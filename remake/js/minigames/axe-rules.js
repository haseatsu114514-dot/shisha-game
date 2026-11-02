import { el } from "../core/util.js";
import { scoringGuide } from "./axe-coach.js";

/** Shared by the practice entrance and the in-story game. No save/state dependencies. */
export function axeRules(onClose) {
  const close = el("button.axe-button.axe-primary", { text: "戻る", dataset: { test: "axe-rules-close" }, onclick: onClose });
  const section = (title, rows) => el("section", [el("h3", { text: title }), el("ul", rows.map(text => el("li", { text })))]);
  const panel = el("section.axe-rules", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げの遊び方と得点ルール", dataset: { test: "axe-rules-panel" } }, [
    el("div.axe-rules-card", [el("header", [el("h2", { text: "斧投げの遊び方（WATL 2026式）" }), close]),
      el("div.axe-rules-scroll", { tabindex: "0" }, [
        scoringGuide(),
        section("まずこれだけ", [
          "①横 → ②縦 → ③回転の順に、ボタン・的のタップ・Space・Enterで針を止める。",
          "回転は54〜70%の緑の帯で放す。弱いと柄から当たり、強いと回りすぎて落下して0点。",
          "白い刃先（4インチの刃）が予測着地点。刃が触れた一番高い区画の点が入る。",
        ]),
        section("的と得点（公式の寸法）", [
          "外から1・2・3・4点のリング。中央は5のリングと赤い6点のブル。外側4か所にも5のリングと赤い6点がある（計5つの赤）。",
          "黒い線の上は低い側の点。赤い中心は縁まで6点。",
          "刃は縦4インチ。縦のずれは刃の幅で拾えるが、横のずれはそのまま出る。",
          "板の外に投げると刺さらず0点。板の木でも、1のリングの外は0点。",
        ]),
        section("キルショット（青）", [
          "投げる前に左上・右上・左下・右下の青を1つ宣言する。的の青を直接タップしても宣言できる。外側の青は7点、中心は8点。",
          "宣言した投は、その青以外に刺さっても0点。宣言なしで青に刺さると1のリングの1点。",
          "宣言は1ゲーム2回。外れ・落下でも1回使う。成功した高さは左右とも閉じ、後半でも閉じたまま。",
          "落下（刺さらない）すると宣言が1回増える（最後の一投を除く）。増えたぶんは前の宣言と反対の高さの青にだけ使える。",
        ]),
        section("前半・後半", [
          "10投は5投ずつ。5投目が終わると的を交代する（レーンを替える）。",
          "交代で赤・5の閉鎖は開き直すが、キルショットの閉鎖は開かない。",
        ]),
        section("部門（閉じ方の違い）", [
          "レク: 何も閉じない。全部の赤と5が毎投開いている。",
          "アマ: 当てた赤（6）と5はその半分のあいだ閉じる。閉じた赤に触れると5点、閉じた5に触れるとそのリングの点（中央4点・外側3点）。",
          "プロ: 当てた5の円は丸ごと閉じる。同じ半分で閉じた円に刃が触れると、その投は0点。5つの赤を順に回るのが満点の道。",
        ]),
        section("ひよりと10投対戦", [
          "あなたが先攻。交互に各10投、合計点で勝敗。同点ならサドンデス。",
          "サドンデス: 左上→右上→右下→左下の順に同じ青を1本ずつ投げ、点が上回った方の勝ち。3本目からは両者外しても青に近い方が勝ち（落下・板の外は負け）。",
          "マッチ（2本先取）を選ぶと、ゲームを2つ先に取った方が勝ち。",
          "相手の難易度はやさしい・ふつう・むずかしい。部門（閉じ方）は両者共通。得点ルールもあなたと同じ。",
        ]),
        section("構え・疲れ・集中", [
          "長く構えるほど腕が疲れて刃先が揺れる。緑の帯を外すと力みも増える。投げる前なら構え直せる。",
          "各投1回「息を整える」かFキーで約1秒だけ揺れを抑えられる。小さい青や赤を狙うときに。構え直しても回数は戻らない。",
          "この画面を読んでいる間と別タブでは時計が止まる。Escは説明を閉じる。ゲーム中のEscは中断。",
          "WATL（World Axe Throwing League）2026年の的と得点を参考にしたラウンジ用ルール。審判・反則線・大会運営は扱わない。",
        ]),
      ]),
    ]),
  ]);
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === "Tab") {
      const nodes = [...panel.querySelectorAll('button,[tabindex="0"]')];
      const at = nodes.indexOf(document.activeElement);
      nodes[(at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
      event.preventDefault(); event.stopPropagation();
    } else event.stopPropagation();
  });
  return panel;
}
