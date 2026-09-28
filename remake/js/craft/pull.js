// 吸い出し ── 温度合わせ（CLAUDE.md: 最低2回・3回までは無傷・それ以上は葉が痩せる。やめ時は自分で選ぶ）
// 左右に振れる針を止めた位置で、上げ吸い／キープ／下げ吸い。中央の細い帯が「ジャスト」。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, flash } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshRig, tickerSay } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";

export const IDEAL = [0.46, 0.62];
const CENTER = 0.54;
const PULL_MIN = 2, PULL_SAFE = 3, PULL_MAX = 5;
// 針の位置の帯（0〜1）。上げ吸い=左、キープ=中、下げ吸い=右。ジャストはそれぞれの芯
const ZONES = [
  { id: "up", from: 0, to: 0.34, just: [0.14, 0.205], label: "上げ吸い", delta: 0.1, justDelta: 0.16 },
  { id: "keep", from: 0.34, to: 0.66, just: [0.468, 0.532], label: "キープ", delta: 0, justDelta: 0 },
  { id: "down", from: 0.66, to: 1, just: [0.795, 0.86], label: "下げ吸い", delta: -0.1, justDelta: -0.16 },
];

/** 炭・熱・蒸らし・穴・詰めから、吸い出し開始時の温度を決める */
export function startTemp(cs) {
  let t = 0.3;
  t += ((cs.heat?.heatPower ?? 50) - 50) / 100 * 0.35;
  if (cs.place === "four") t += 0.12;
  t += { 3: -0.06, 5: 0, 8: 0.05, 10: 0.09 }[cs.steamMin || 5] || 0;
  t += ((cs.holes?.total ?? 22) - 22) * 0.006;
  if (cs.pack === "fluffy") t += 0.03;
  if (cs.pack === "firm") t -= 0.04;
  return clamp(t + rand(-0.03, 0.03), 0.12, 0.88);
}

export async function runPull(cs) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel("pull", "吸い出し ── 温度合わせ", "針を止めた位置で吸い方が変わる。適温帯に入れたら「提供する」。吸いすぎると葉が痩せる");
  const slow = skill.slow() * (tutorial ? 1.3 : 1);
  const widen = skill.window() * (tutorial ? 1.4 : 1);
  let T = startTemp(cs);
  let pulls = 0, justs = 0;

  // ---- 画面
  const thermoFill = el("b");
  const thermoMark = el("i.thermo-mark");
  const thermo = el("div.thermo", [
    el("div.thermo-tube", [el("div.thermo-zone", { style: { bottom: `${IDEAL[0] * 100}%`, height: `${(IDEAL[1] - IDEAL[0]) * 100}%` } }), thermoFill, thermoMark]),
    el("div.thermo-labels", [el("span", { text: "熱い" }), el("span", { text: "適温" }), el("span", { text: "ぬるい" })]),
  ]);
  const needle = el("i.pg-needle");
  const gauge = el("div.pull-gauge", [
    ...ZONES.map((z) => el(`div.pg-zone.z-${z.id}`, { style: { left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` } }, [
      el("span", { text: z.label }),
      el("i.pg-just", { style: { left: `${((z.just[0] - z.from) / (z.to - z.from)) * 100}%`, width: `${((z.just[1] - z.just[0]) * widen / (z.to - z.from)) * 100}%` } }),
    ])),
    needle,
  ]);
  const counter = el("div.pull-count");
  const readout = el("div.pull-read");
  const pullBtn = el("button.btn.primary", { dataset: { test: "pull-stop" } }, [el("span.btn-label", { text: "吸う（針を止める）" })]);
  const serveBtn = el("button.btn", { dataset: { test: "pull-serve" }, disabled: true }, [el("span.btn-label", { text: "提供する" })]);
  panel.append(el("div.pull", [thermo, el("div.pull-main", [readout, gauge, counter, el("div.pull-btns", [pullBtn, serveBtn])])]));

  const render = () => {
    thermoFill.style.height = `${T * 100}%`;
    thermoMark.style.bottom = `${T * 100}%`;
    const inZone = T >= IDEAL[0] && T <= IDEAL[1];
    thermo.classList.toggle("ok", inZone);
    readout.textContent = inZone ? "適温。いま出せば一番いい" : T > IDEAL[1] ? "熱い。下げ吸いで落ち着かせたい" : "まだぬるい。上げ吸いで熱を入れたい";
    counter.textContent = `吸った回数 ${pulls}${pulls >= PULL_SAFE ? "（これ以上は葉が痩せる）" : ""}`;
    counter.classList.toggle("warn", pulls >= PULL_SAFE);
    serveBtn.disabled = pulls < PULL_MIN;
    pullBtn.disabled = pulls >= PULL_MAX;
  };

  // 針（左→右→左の往復）
  let pos = 0, dir = 1, raf = 0, last = 0, running = false;
  const period = 1.5 * slow;
  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pos += (dir * dt * 2) / period;
    if (pos >= 1) { pos = 1; dir = -1; }
    if (pos <= 0) { pos = 0; dir = 1; }
    needle.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(loop);
  };

  const doPull = (at = pos) => {
    if (pulls >= PULL_MAX) return;
    const z = ZONES.find((zz) => at >= zz.from && at <= zz.to) || ZONES[1];
    const jw = (z.just[1] - z.just[0]) * widen;
    const isJust = at >= z.just[0] && at <= z.just[0] + jw;
    pulls++;
    let d = isJust ? z.justDelta : z.delta;
    if (z.id === "keep") d = isJust ? rand(-0.006, 0.006) : rand(-0.03, 0.03);
    T = clamp(T + d + 0.015, 0, 1); // 吸うたびに熱は少しずつ上がる
    if (isJust) { justs++; SE.just(); flash("gold"); popStamp(panel, `ジャスト${z.label}`, "just", "58%", "22%"); }
    else { SE.good(); popStamp(panel, z.label, "good", "58%", "22%"); }
    SE.bubbling();
    if (pulls > PULL_SAFE) popStamp(panel, "葉が痩せる……", "bad", "58%", "34%");
    render();
  };

  pullBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); if (running) doPull(); });
  let serve;
  const served = new Promise((r) => { serve = r; });
  serveBtn.addEventListener("click", () => { if (pulls >= PULL_MIN) serve(); });
  const unkey = keys({ " ": () => running && doPull(), Space: () => running && doPull(), Enter: () => pulls >= PULL_MIN && serve() });

  render();
  await countdown();
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) {
    (async () => {
      await sleep(60);
      for (let i = 0; i < (auto === "good" ? 3 : 5); i++) {
        let at;
        if (auto === "good") {
          const want = T > IDEAL[1] ? "down" : T < IDEAL[0] ? "up" : "keep";
          const z = ZONES.find((zz) => zz.id === want);
          at = z.just[0] + 0.001;
          // 上げすぎ・下げすぎないよう、近ければ普通帯で微調整
          if (want !== "keep" && Math.abs(T - CENTER) < 0.1) at = (z.from + z.to) / 2 + (want === "up" ? 0.08 : -0.08);
        } else {
          at = rand(0, 1) < 0.5 ? 0.3 : 0.25;
        }
        doPull(at);
        await sleep(40);
      }
      serve();
    })();
  }
  await served;
  running = false;
  cancelAnimationFrame(raf);
  unkey();

  const dev = Math.abs(T - CENTER);
  const inZone = T >= IDEAL[0] && T <= IDEAL[1];
  let score = clamp(100 - dev * 260, 0, 100) + justs * 3 - Math.max(0, pulls - PULL_SAFE) * 8;
  if (!inZone) score -= 10;
  score = Math.round(clamp(score, 0, 100));
  cs.pull = { score, grade: gradeOf(score), temp: T, pulls, justs, inZone, over: T > IDEAL[1], under: T < IDEAL[0] };
  cs.pullDone = true;
  refreshRig();
  tickerSay(inZone ? "パッキー「きた〜！ 煙の立ち方が変わりましたよ〜♪」" : "パッキー「おっと、ちょっと温度が怪しいか〜！？」");
  await resultCard(panel, {
    title: "吸い出し 結果",
    grade: cs.pull.grade,
    lines: [
      inZone ? "適温で提供できた" : T > IDEAL[1] ? "少し熱いまま出してしまった" : "まだぬるいまま出してしまった",
      `${pulls}回吸った${justs ? `（ジャスト ${justs}回）` : ""}`,
      pulls > PULL_SAFE ? "吸いすぎた分、葉が痩せた" : "",
    ],
  });
}
