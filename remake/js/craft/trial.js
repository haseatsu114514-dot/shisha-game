// FLAVOR TRIAL（master_spec 第2部 §3）
// 作る前に掲げたコンセプトと、完成品から生まれたアピールポイントで、審査員のザワザワに答える。
// 用語は「コンセプト」「アピールポイント」「ぶつける」、反論は「香ってない！」「ズレてる！」のみ。
import { el, sleep, clamp, shuffle } from "../core/util.js";
import { faceIconUrl, displayName } from "../core/data.js";
import { flash, shake } from "../core/ui.js";
import { state } from "../core/state.js";
import { tier01 } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { stepPanel, tickerSay } from "./session.js";
import { gradeOf, autoSkill, resultCard, popStamp } from "./common.js";
import { buildAppeals, CONCEPT_NEED, computeShisha } from "./score.js";
import { CONCEPTS } from "./steps.js";

const DOUBTS = {
  aroma: { judge: "nagumo", text: "……狙った香りは、芯まで残っているのか" },
  smoke: { judge: "maezono", text: "煙量、ちょっと物足りなくないかい？" },
  relax: { judge: "dr_kemuri", text: "リラックスと謳うなら、焦げの兆候は許されません" },
  speed: { judge: "maezono", text: "早く作った分、どこか雑になってないかい？" },
  taste: { judge: "nagumo", text: "味が濃いと言うには、主張が弱くないか" },
  duration: { judge: "dr_kemuri", text: "最後の一口まで持つ、という根拠はありますか" },
  original: { judge: "maezono", text: "独創性って言うけど、どこが君だけの味なんだい？" },
  stability: { judge: "dr_kemuri", text: "熱の入り方が均一だという根拠を示してください" },
  regulation: { judge: "nagumo", cat: "aroma", text: "課題のミント。……ちゃんと生きているか" },
};
// 成功時の審査員4分割カットイン（「◯◯！ でも、◯◯！」形式）
const SPLITS = {
  aroma: ["キワドい！", "でも、", "香りが", "入っている！"],
  smoke: ["煙い！", "でも、", "焦げて", "ない！"],
  relax: ["軽い！", "でも、", "味は", "ある！"],
  speed: ["早い！", "でも、", "雑じゃ", "ない！"],
  taste: ["濃い！", "でも、", "くどく", "ない！"],
  duration: ["熱い！", "でも、", "飛んで", "ない！"],
  original: ["攻めてる！", "でも、", "成立して", "いる！"],
  stability: ["熱い！", "でも、", "飛んで", "ない！"],
};

export async function runTrial(cs) {
  cs.stats = computeShisha(cs);
  const appeals = buildAppeals(cs);
  const doubts = [
    ...cs.concepts.map((id) => ({ ...DOUBTS[id], cat: id === "relax" ? "relax" : id, concept: id })),
    { ...DOUBTS.regulation },
  ];
  // 3つ目: 争点がかぶるなら熱の均一さへ
  if (cs.concepts.includes("aroma")) doubts[2] = { ...DOUBTS.stability, cat: "stability" };
  let gauge = 50;
  const used = new Set();
  let success = 0, mismatch = 0, concede = 0;

  const panel = stepPanel("trial", "審査 ── FLAVOR TRIAL", "審査員のザワザワに、アピールポイントをぶつけて納得させる");
  const bar = el("b");
  const gaugeEl = el("div.tr-gauge", [el("span", { text: "納得ゲージ" }), el("i", [bar])]);
  const conceptEl = el("div.tr-concept", { text: `コンセプト: ${cs.concepts.map((id) => CONCEPTS.find((c) => c.id === id).label).join(" × ")}` });
  const doubtBox = el("div.tr-doubt#trial-doubt");
  const hand = el("div.tr-hand");
  const split = el("div.tr-split");
  panel.append(el("div.trial", [gaugeEl, conceptEl, doubtBox, hand, split]));
  const setGauge = (v) => { gauge = clamp(v, 0, 100); bar.style.width = `${gauge}%`; gaugeEl.classList.toggle("high", gauge >= 75); };
  setGauge(50);

  for (let r = 0; r < doubts.length; r++) {
    const d = doubts[r];
    doubtBox.dataset.need = d.cat;
    const face = faceIconUrl(d.judge);
    doubtBox.replaceChildren(
      el("div.td-judge", [face ? el("img", { src: face, alt: "" }) : null, el("b", { text: displayName(d.judge, state) })]),
      el("div.td-text", { text: `「${d.text}」` }),
      el("div.td-zawa", { text: "ザワ……ザワ……" }),
    );
    doubtBox.classList.remove("in");
    void doubtBox.offsetWidth;
    doubtBox.classList.add("in");
    SE.crowd(1.2);
    const pick = await new Promise((resolve) => {
      const cards = appeals.filter((a) => !used.has(a.label)).map((a) =>
        el("button.trial-appeal", { dataset: { cat: a.cat, backed: "1", test: "trial-appeal" }, onclick: () => resolve(a) }, [el("span", { text: a.label })]));
      cards.push(el("button.trial-appeal.concede", { dataset: { cat: "none", backed: "0", test: "trial-concede" }, onclick: () => resolve(null) }, [el("span", { text: "……認める（反論しない）" })]));
      hand.replaceChildren(...shuffle(cards.slice(0, -1)), cards.at(-1));
      const auto = autoSkill();
      if (auto) {
        const good = appeals.find((a) => !used.has(a.label) && a.cat === d.cat);
        setTimeout(() => resolve(auto === "good" ? good || null : appeals.find((a) => !used.has(a.label)) || null), 60);
      }
    });
    hand.replaceChildren();
    if (pick) used.add(pick.label);
    if (pick && pick.cat === d.cat) {
      success++;
      setGauge(gauge + 22 + Math.round(8 * tier01("charm")));
      SE.just();
      flash("gold");
      popStamp(panel, r === doubts.length - 1 ? "FLAVOR SYNC!!" : "納得！", "just", "50%", "36%");
      await splitCut(split, SPLITS[d.cat] || SPLITS.aroma);
      tickerSay("パッキー「確かに言ってる通りだーッ！」");
    } else if (pick) {
      mismatch++;
      setGauge(gauge - 14);
      SE.parin();
      shake(panel, 300);
      popStamp(panel, d.cat === "aroma" ? "香ってない！" : "ズレてる！", "bad", "50%", "36%");
      tickerSay("パッキー「あら〜！ 意図と味がズレちゃってる〜♪」");
    } else {
      concede++;
      setGauge(gauge - 6);
      SE.cancel();
      popStamp(panel, "……正直でよろしい", "miss", "50%", "36%");
    }
    await sleep(750);
  }

  // 言ったこと（コンセプト）と作ったもの（完成品）の一致度
  let sync = 0;
  const syncNotes = [];
  for (const id of cs.concepts) {
    const v = CONCEPT_NEED[id].stat(cs.stats, cs);
    const label = CONCEPTS.find((c) => c.id === id).label;
    if (v >= 65) { sync += 6; syncNotes.push(`「${label}」は作ったものと一致していた`); }
    else if (v < 45) { sync -= 6; syncNotes.push(`「${label}」は一台と噛み合っていなかった`); }
  }
  const score = Math.round(clamp(gauge + sync, 0, 100));
  cs.trial = { score, grade: gradeOf(score), gauge, success, mismatch, concede, sync };
  if (score >= 90) popStamp(panel, "PERFECT SESSION", "just", "50%", "50%");
  await resultCard(panel, {
    title: "FLAVOR TRIAL 結果",
    grade: cs.trial.grade,
    lines: [`納得させた ${success} / ${doubts.length}`, ...syncNotes],
  });
}

/** 審査員4分割カットイン */
async function splitCut(host, words) {
  host.replaceChildren(...words.map((w, i) => el("div.sp-cell", { style: { "--i": String(i) } }, [el("b", { text: w })])));
  host.classList.add("show");
  await sleep(1100);
  host.classList.remove("show");
}
