// 熱管理 ── 提供後の一台を最後の一口まで守る（大会の R3）。
// 審査員が吸っている間も炭は生きている。温度の流れを読んで、炭を外す／回す／寄せる／見守る。
import { el, sleep, clamp, rand } from "../core/util.js";
import { SE } from "../core/audio.js";
import { stepPanel, tickerSay } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, popStamp } from "./common.js";
import { IDEAL } from "./pull.js";
import { heatDelta } from "./conditions.js";

const ACTIONS = [
  { id: "remove", label: "炭をひとつ外す", effect: -0.12, desc: "熱を落とす" },
  { id: "rotate", label: "炭の位置を回す", effect: 0, steady: true, desc: "熱をならす" },
  { id: "center", label: "炭を中央に寄せる", effect: 0.1, desc: "熱を入れる" },
  { id: "wait", label: "そのまま見守る", effect: 0, desc: "触らない" },
];
const ROUNDS = 3;
const CENTER = (IDEAL[0] + IDEAL[1]) / 2;

export async function runCare(cs) {
  const panel = stepPanel("care", "熱管理 ── 最後の一口まで", "審査員が吸っている間も熱は動く。流れを読んで、一手ずつ打つ");
  let T = cs.pull?.temp ?? CENTER;
  const history = [T];
  const clarity = skill.clarity();
  let good = 0;

  const chart = el("div.care-chart");
  const reading = el("div.care-read");
  const btns = el("div.care-btns");
  const roundEl = el("div.care-round");
  panel.append(el("div.care", [roundEl, chart, reading, btns]));

  const drawChart = () => {
    chart.replaceChildren(
      el("div.cc-zone", { style: { bottom: `${IDEAL[0] * 100}%`, height: `${(IDEAL[1] - IDEAL[0]) * 100}%` } }),
      ...history.map((v, i) => el("i.cc-pt", { style: { left: `${(i / (ROUNDS * 2)) * 100}%`, bottom: `${clamp(v, 0, 1) * 100}%` } })),
    );
  };

  for (let r = 0; r < ROUNDS; r++) {
    // この先の熱の流れ（審査員の吸い方・炭の減り）
    const drift = heatDelta(cs, rand(-0.12, 0.14));
    const noise = rand(-0.08, 0.08) * (1 - 0.75 * clarity); // 洞察★で読み違いが減る
    const seen = drift + noise;
    roundEl.textContent = `${r + 1} / ${ROUNDS} 口目`;
    reading.textContent = seen > 0.05 ? "煙が重くなってきた。熱が上がってきている気がする"
      : seen < -0.05 ? "煙が細くなってきた。熱が落ちてきている気がする"
      : "煙は落ち着いている。流れは安定しているように見える";
    drawChart();
    const choice = await new Promise((resolve) => {
      btns.replaceChildren(...ACTIONS.map((a) => el("button.btn.care-btn", { dataset: { test: `care-${a.id}` }, onclick: () => { SE.select(); resolve(a); } }, [
        el("span.btn-label", { text: a.label }), el("small.btn-desc", { text: a.desc }),
      ])));
      const auto = autoSkill();
      if (auto) {
        const next = T + drift;
        const want = auto === "bad" ? ACTIONS[3] : next > IDEAL[1] - 0.02 ? ACTIONS[0] : next < IDEAL[0] + 0.02 ? ACTIONS[2] : ACTIONS[1];
        setTimeout(() => resolve(want), 60);
      }
    });
    btns.replaceChildren();
    const before = T;
    T = clamp(T + drift + heatDelta(cs, choice.effect), 0, 1);
    if (choice.steady) T = clamp(T + heatDelta(cs, (CENTER - T) * 0.35), 0, 1); // 位置を回すと熱がならされる
    history.push((before + T) / 2, T);
    const ok = T >= IDEAL[0] && T <= IDEAL[1];
    if (ok) good++;
    popStamp(panel, ok ? "HEAT STABLE" : T > IDEAL[1] ? "熱すぎ！" : "冷めてきた…", ok ? "good" : "bad", "50%", "30%");
    ok ? SE.good() : SE.miss();
    if (ok && r === ROUNDS - 1) tickerSay("パッキー「最後の一口まで崩れない！ 守り切ったーッ！」");
    drawChart();
    await sleep(500);
  }
  const score = Math.round(clamp((good / ROUNDS) * 85 + (1 - Math.min(1, Math.abs(T - CENTER) / 0.2)) * 15, 0, 100));
  cs.care = { score, grade: gradeOf(score), good, temp: T };
  await resultCard(panel, {
    title: "熱管理 結果",
    grade: cs.care.grade,
    lines: [good === ROUNDS ? "最後の一口まで、味を守り切った" : good ? "何度か熱がぶれたが、立て直した" : "熱の流れを読み切れなかった"],
  });
}
