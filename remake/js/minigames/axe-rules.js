import { el } from "../core/util.js";
import { imgFileUrl } from "../core/img-file.js";
import { scoringGuide } from "./axe-coach.js";

// 遊び方の図解（2026-11-27 オーナー「文字で説明しすぎずUIやボタンで視覚的にわかるよう設計していきたい」「斧投げとボドゲも頼む」）:
// 開いた時は4枚の絵札だけ（一枚絵・見出し・一言・点の札）。文章のルール（下の7つの節）は「くわしいルール」を押した時だけ出す。
// 絵は gpt-image-2.6-sunburst で生成（asset_sources/ui/minigame-visuals-20261127/axe/。レーンと的の実画面・斧の絵を参照に渡した）
const HOW_CARDS = tap => [
  { id: "aim", title: "ねらう", note: "横 → 縦の針を止める" },
  { id: "throw", title: tap ? "投げる" : "回転を決める", note: tap ? "上へすばやく弾く" : "緑の帯で針を止める" },
  { id: "score", title: "得点", note: "刃が触れた一番高い所", tags: ["赤 6点"] },
  { id: "killshot", title: "キルショット", note: "青を宣言して当てる", tags: ["7・8点", "1ゲーム2回"], kind: "kill" },
];
const howCard = card => el("li.axe-how-card", { dataset: { how: card.id, test: "axe-how-card", ...(card.kind ? { kind: card.kind } : {}) } }, [
  el("img.axe-how-art", { src: imgFileUrl(`ui/axe_throw/howto/how_${card.id}.webp`), alt: "", decoding: "async", onerror: event => { event.currentTarget.hidden = true; } }),
  ...(card.tags || []).map((text, index) => el("em.axe-how-tag", { text, style: { "--i": String(index) } })),
  el("div.axe-how-caption", [el("b.axe-how-title", { text: card.title }), el("span.axe-how-note", { text: card.note })]),
]);

/** Shared by the practice entrance and the in-story game. No save/state dependencies. */
export function axeRules(onClose, { inputMode = "tap-pull" } = {}) {
  const tap = inputMode === "tap-pull";
  const close = el("button.axe-button.axe-primary", { text: "戻る", dataset: { test: "axe-rules-close" }, onclick: onClose });
  const section = (title, rows) => el("section", [el("h3", { text: title }), el("ul", rows.map(text => el("li", { text })))]);
  // 図解 ⇄ 文章のルール。開いた時は図解。文章は .axe-rules-scroll の data-detail="open" の間だけ見える（中身は前と同じ）。
  // 窓の最初のボタンは「戻る」のまま（呼び出し側が最初のボタンへフォーカス・中断時に押す）。「くわしいルール」は見た目だけ左へ置く
  const more = el("button.axe-button.axe-rules-more", { type: "button", text: "くわしいルール", "aria-expanded": "false", dataset: { test: "axe-rules-more" },
    onclick: () => {
      const scroll = panel.querySelector(".axe-rules-scroll"), open = scroll.dataset.detail !== "open";
      scroll.dataset.detail = open ? "open" : "closed"; scroll.scrollTop = 0;
      more.textContent = open ? "図解にもどる" : "くわしいルール"; more.setAttribute("aria-expanded", String(open));
    } });
  const panel = el("section.axe-rules", { role: "dialog", "aria-modal": "true", "aria-label": "斧投げの遊び方と得点ルール", dataset: { test: "axe-rules-panel" } }, [
    el("div.axe-rules-card", [el("header", [el("h2", { text: "斧投げの遊び方（WATL 2026式）" }), el("div.axe-rules-actions", [close, more])]),
      el("div.axe-rules-scroll", { tabindex: "0", dataset: { detail: "closed" } }, [
        el("ul.axe-how-cards", { dataset: { test: "axe-how-cards" } }, HOW_CARDS(tap).map(howCard)),
        scoringGuide(),
        section("まずこれだけ", [
          tap ? "的をタップで構え、①横 → ②縦の針を的のタップ・ボタン・Spaceで止めて狙う。金の三角が止めたい所（真ん中の赤、宣言した青）で、針が重なると緑になる。狙いが決まったら、的か右下のスワイプ面から、上へ素早く弾いて離すと投げる。" : "①横 → ②縦 → ③回転の順に、ボタン・的のタップ・Space・Enterで針を止める。",
          tap ? "弾く速さで回転が決まる。右のゲージの54〜70%の緑がちょうどいい。遅いと柄から当たり、速すぎると回りすぎて落下して0点。斜めに弾くと横へ流れる。" : "回転は54〜70%の緑の帯で放す。弱いと柄から当たり、強いと回りすぎて落下して0点。",
          "白い刃先（4インチの刃）が予測着地点。刃が触れた一番高い区画の点が入る。",
          tap ? "キーボードはSpace・Enterで針を止め、投げる時はSpaceを長押しして、緑の帯で離す。Fで一度だけ集中。" : "↔ 横・↕ 縦・↻ 回転のチップは、金色が今止める工程。チップの下の値が止めた位置と回転。",
          tap ? "直近の一投と累計は得点欄に表示。キルショットの残り回数は宣言ボタンに表示。" : "上の帯は各投の点数。青い斧のバッジの数字が、キルショットを宣言できる残りの回数。",
        ]),
        section("的と得点（公式の寸法）", [
          "外から1・2・3・4点のリング。中央は5のリングと赤い6点のブル。外側4か所にも5のリングと赤い6点がある（計5つの赤）。",
          "黒い線の上は低い側の点。赤い中心は縁まで6点。",
          "刃は縦4インチ。縦のずれは刃の幅で拾えるが、横のずれはそのまま出る。",
          "板の外に投げると刺さらず0点。板の木でも、1のリングの外は0点。",
        ]),
        section("キルショット（青）", [
          tap ? "投げる前に「キルショット」を押すたびに、左上→左下→右上→右下の順に金の印が移る。選べない青は飛ばし、一周で通常投げに戻る。戻る矢印でも取り消せる。回数を使うのは投げた時だけ。外側7点、中心8点。" : "投げる前に左上・右上・左下・右下の青を1つ宣言する。的の青を直接タップしても宣言できる。外側の青は7点、中心は8点。",
          "宣言した一投は、その青以外に刺さっても0点。宣言なしで青に刺さると1のリングの1点。",
          "宣言は1ゲーム2回。外れ・落下でも1回使う。成功した高さは左右とも閉じ、後半でも閉じたまま。",
          "落下（刺さらない）すると宣言が1回増える（最後の一投を除く）。増えたぶんは前の宣言と反対の高さの青にだけ使える。",
        ]),
        section("前半・後半", [
          "10投は5投ずつ。5投目が終わると的を交代する（レーンを替える）。",
          "交代で閉じた赤・5は再び開くが、閉じたキルショットは開かない。",
        ]),
        section("部門（閉じ方の違い）", [
          "レク: 何も閉じない。全部の赤と5が毎投開いている。",
          "アマ: 当てた赤（6）と5は、その前半・後半が終わるまで閉じる。閉じた赤に触れると5点、閉じた5に触れるとそのリングの点（中央4点・外側3点）。",
          "プロ: 当てた5の円は丸ごと閉じる。同じ前半・後半のうちに閉じた円へ刃が触れると、その一投は0点。5つの赤を順に回るのが満点の道。",
        ]),
        section("10投対戦", [
          "あなたが先攻。交互に各10投、合計点で勝敗。同点ならサドンデス。",
          "サドンデス: 左上→右上→右下→左下の順に同じ青を1本ずつ投げ、点が上回った方の勝ち。3本目からは両者外しても青に近い方が勝ち（落下・板の外は負け）。",
          "マッチ（2本先取）を選ぶと、ゲームを2つ先に取った方が勝ち。",
          "相手の難易度はやさしい・ふつう・むずかしい。部門（閉じ方）は両者共通。得点ルールもあなたと同じ。",
        ]),
        section("構え・疲れ・集中", [
          "長く構えるほど腕が疲れて刃先が揺れる。緑の帯を外すと力みも増える。投げる前なら構え直せる。",
          "各投1回「息を整える」かFキーで約1秒だけ揺れを抑えられる。小さい青や赤を狙うときに。構え直しても回数は戻らない。",
          "この画面を読んでいる間と別タブでは時計が止まる。Escは説明を閉じる。" + (tap ? "構える前か投げる直前のEscで宣言を取り消し、通常時は中断。" : "ゲーム中はEscで中断。"),
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

