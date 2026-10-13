import { el } from "../core/util.js";

/** Shared by the practice entrance and the in-story game. No save/state dependencies. */
export function axeRules(onClose) {
  const close = el("button.axe-button.axe-primary", { text: "戻る", dataset: { test: "axe-rules-close" }, onclick: onClose });
  const section = (title, rows) => el("section", [el("h3", { text: title }), el("ul", rows.map(text => el("li", { text })))]);
  const panel = el("section.axe-rules", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げの遊び方と得点ルール", dataset: { test: "axe-rules-panel" } }, [
    el("div.axe-rules-card", [el("header", [el("h2", { text: "斧投げの遊び方" }), close]),
      el("div.axe-rules-scroll", { tabindex: "0" }, [
        section("① 狙う → 力を合わせて投げる", [
          "通常か青いキルショットを選び、構える。横 → 縦 → 力の順に、ボタン・Space・Enterでゲージを止める。",
          "細い金色の印は止めた狙い。白い照準は揺れている刃先。力を止めた瞬間の白い照準へ投げる。",
          "長く構えるほど腕が疲れて手ブレが増える。力の緑の帯を外すと力みも増える。投げる前なら構え直せる。",
          "各投1回「息を整える」で約1秒だけブレを抑えられる。小さい青を狙う時や、力を止める直前が使いどころ。構え直しても回数は戻らない。",
        ]),
        section("② 力と落下", [
          "緑の帯が狙いどころ。帯より弱めなら下へ、強めなら上へずれる。力を合わせている間は、そのずれも白い照準に表示される。",
          "力が足りないと届かず落下。強すぎると回転が合わず落下。落下は狙った場所にかかわらず0点。",
        ]),
        section("③ 的の得点", [
          "同心円は外から1・2・3・4・5点、中央の赤は6点。4つの外側の丸は外側5点、赤い中心6点。",
          "黒いリングの境界は低い側の点数、赤い中心の境界は6点。的の外は0点。",
        ]),
        section("④ キルショットはリスクを選ぶ一投", [
          "投げる前に左上・右上・左下・右下の青を宣言。その青の外側は7点、濃い青の中心は8点。",
          "宣言した投は選んだ青以外に刺さっても0点。宣言なしで青へ刺さった時は、その場所の通常リング点。",
          "宣言は1ゲーム2回まで。外れ・落下でも1回使う。成功した高さの左右2つは両方閉じ、後半5投でも閉じたまま。",
          "構える前なら通常へ戻して宣言を取り消せる。構え直すだけでは投数や宣言回数を消費しない。",
        ]),
        section("⑤ 一緒に遊ぶ", [
          "3投練習は最大22点、10投の競技練習は最大64点。各投のあとに点数と相手の反応を見て、次の狙いを選ぼう。",
          "この画面を読んでいる間と、別タブへ移っている間はゲージ・手ブレ・集中時間が止まる。Escは説明を閉じる。ゲーム中のEscは中断。",
          "競技の斧投げを参考にしたラウンジ用ルール。相手の投擲と勝敗を含む対戦は今後追加予定。",
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
