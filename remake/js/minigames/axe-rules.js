import { el } from "../core/util.js";

/** Shared by the practice entrance and the in-story game. No save/state dependencies. */
export function axeRules(onClose) {
  const close = el("button.axe-button.axe-primary", { text: "戻る", dataset: { test: "axe-rules-close" }, onclick: onClose });
  const section = (title, rows) => el("section", [el("h3", { text: title }), el("ul", rows.map(text => el("li", { text })))]);
  const panel = el("section.axe-rules", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げの遊び方と得点ルール", dataset: { test: "axe-rules-panel" } }, [
    el("div.axe-rules-card", [el("header", [el("h2", { text: "斧投げの遊び方" }), close]),
      el("div.axe-rules-scroll", { tabindex: "0" }, [
        section("① 狙う → 力を合わせて投げる", [
          "通常か青いキルショットを選び、構える。横 → 縦 → 力の順に、ボタン・的のタップ・Space・Enterでゲージを止める。",
          "①横は左〜右、②縦は上〜下の位置を決める。パネルの✓は確定した位置、的の金色の線と印はその狙い。白い照準は手ブレと力の補正を含む予測着地点。力を止めた瞬間の白い照準へ投げる。",
          "長く構えるほど腕が疲れて手ブレが増える。力の緑の帯を外すと力みも増える。投げる前なら構え直せる。",
          "各投1回「息を整える」かFキーで約1秒だけブレを抑えられる。小さい青を狙う時や、力を止める直前が使いどころ。構え直しても回数は戻らない。",
        ]),
        section("② 力と落下", [
          "力54〜70%の緑の帯が狙いどころ。62%より弱めなら下へ、強めなら上へずれる。的の緑の線とパネルの↑↓で力による補正を確認できる。白い照準にそのずれも含む。",
          "茶色を含む42〜82%なら刺さる力。赤い範囲では弱すぎるか回転が合わず、的に刺さらず落下する。落下は狙った場所にかかわらず0点。",
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
          "競技の斧投げを参考にしたラウンジ用ルール。",
        ]),
        section("⑥ ひよりと10投対戦", [
          "あなたが先攻。あなた→ひよりの順で各10投ずつ投げ、合計点で勝敗を決める。同点は引き分け、延長なし。相手が投げ終わったら、結果を見て「あなたの番へ」。",
          "宣言は各人2回、成功した高さの閉鎖も各人別。相手の番は投げる操作をせずに見守ろう。ルール閲覧・別タブでは相手の進行も止まり、中断できる。",
          "相手の難易度はやさしい・ふつう・むずかしい。既定はふつう。難しいほど狙いと力が安定する。得点ルールはあなたと同じで、点差による強さの変化はない。",
          "独立した練習ページの対戦。街の相手解禁や正式イベント、セーブ・報酬・LIMEは変更しない。",
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
