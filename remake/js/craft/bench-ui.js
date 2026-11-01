// 制作中に常時見せる情報は短く。詳しい説明は必要なときだけ開く。
import { el } from "../core/util.js";

export const STEP_BRIEFS = {
  setup: "この一台に使う道具を選ぶ",
  water: "ボトルに水を注ぎ、目安の帯で止める",
  mix: "合計12g以上で配合を決める",
  pack: "ボウルを見比べ、詰め方を選んで決める",
  holes: "光が目印に重なったら、穴を開ける",
  heat: "全面が赤くなった炭をタップして取る",
  place: "炭を置いて、熱を均等に届ける",
  steam: "雑念をよける。困ったらリフレッシュ",
  pull: "針を止めて吸い、緑の範囲で味を整える",
  care: "消耗した炭を交換して、吸って整える",
};


/**
 * 初回レッスンだけ、用語の意味と次の操作を簡潔に見せる。
 * 抽選・採点・通常練習には影響させず、既存の「?」ガイドを再利用する。
 */
export const TUTORIAL_STEP_HELP = Object.freeze({
  water: { brief: "長押しで水を注ぎ、目安の45〜55%に収めて進む", detail: "スミ「煙は水をくぐって冷える。量で吸い心地が変わるから、まずは目安に合わせろ」" },
  mix: { brief: "香り付きの葉を「＋」で足し、合計12g以上にする", detail: "スミ「配合は葉の組み合わせと量だ。ダブルアップル9g、ミント3gを試せ」" },
  pack: { brief: "詰め方を見比べて決めよう。迷ったらノーマル", detail: "スミ「ハガルは葉を入れる器、ボウルとも呼ぶ。詰め方で空気の通り道を作れ」" },
  holes: { brief: "空気を通す穴。配置を選び、光が目印に重なったら押す", detail: "スミ「アルミは葉を覆うふた、穴は空気と熱の入口だ。目印を狙ってタップしろ」" },
  place: { brief: "三角に3個置く配置で、熱を均等に届ける", detail: "スミ「炭は葉を温める熱源だ。三角に間隔をあけて置くと、熱が偏りにくい」" },
  heat: { brief: "炭を全面まで焼く。黒い面が消えた炭をタップして取り出す", detail: "スミ「炭の全面に火を入れる工程だ。黒い面が消えて全面が赤くなったら取り出す合図、三つとも焼くぞ」" },
  timer: { brief: "温度計の目安を見て、3〜10分の範囲で蒸らし時間を決める", detail: "スミ「葉全体に熱をなじませる工程だ。分は1分、秒は10秒ずつ。熱の目安を見て、3〜10分の範囲で時間を決めろ」" },
  steam: { brief: "ハートを動かして雑念をよける", detail: "スミ「ハートは待っている間のお前の心だ。雑念をよけろ。危ない時はリフレッシュだ」" },
  pull: { brief: "針を止めて吸い、煙の様子を確かめる", detail: "スミ「吸い出しは提供前の温度合わせだ。まずは中央のキープで2回吸って、煙を確かめて提供しろ」" },
  care: { brief: "交換する炭の数を選び、焼いてから熱を整える", detail: "スミ「吸われた一台は冷えていく。炭を替え、最低1回吸って煙を確かめろ」" },
});

export function buildGuide() {
  const note = el("p");
  const summary = el("summary", { text: "?", "aria-label": "操作の説明（開くと時間が止まる）", title: "操作の説明（開くと時間が止まる）" });
  const close = el("button.btn.primary", {
    type: "button", text: "説明を閉じて進む", dataset: { test: "bench-guide-close" },
    style: { display: "block", marginTop: "12px", maxWidth: "100%", whiteSpace: "normal",
      minHeight: "calc(44px / var(--k, 1))", fontSize: "calc(16px / var(--k, 1))" },
    onclick: () => {
      // 初回説明の待機と時計の再開は、既存のtoggle経路に任せる。
      root.open = false;
      summary.focus({ preventScroll: true });
    },
  });
  const root = el("details.bench-guide", [
    summary,
    el("div.bench-guide-tip", [el("b", { text: "操作の説明" }), note,
      el("small", { text: "開くと時間が止まり、閉じると再開します。" }), close]),
  ]);
  root.addEventListener("toggle", () => {
    const bench = root.closest(".bench"), panel = bench?.querySelector(".bench-panel");
    if (panel) panel.inert = root.open;
    if (bench) bench.dataset.helpPaused = String(root.open);
    if (root.open) close.focus({ preventScroll: true });
  });
  return { root, note };
}
