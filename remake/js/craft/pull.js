// 吸い出し（CLAUDE.md: 最低2回・3回までは無傷・それ以上は葉が痩せる。やめ時は自分で選ぶ）
// 左右に振れる針を止めた位置で、上げ吸い／キープ／下げ吸い。中央の細い帯が「ジャスト」。
// 熱管理（大会のR3）も同じ針のゲーム。先に炭交換ができ、温度は動き続け、その後に最低1回吸う（TH14）。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, flash } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, setBenchTemperature, burstBench } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";

import { craftConditions, heatDelta, pullResult, isOptimalTemperature, temperatureAfterSteam, pullFocusFromSteam, isBurnt, IDEAL } from "./conditions.js";
import { buildThermometer } from "./thermometer.js";

export { IDEAL } from "./conditions.js";
const CENTER = 0.54;
const PULL_SAFE = 3, PULL_MAX = 5;
// 針の位置の帯（0〜1）。上げ吸い=左、キープ=中、下げ吸い=右。ジャストはそれぞれの芯
const ZONES = [
  { id: "up", from: 0, to: 0.34, just: [0.14, 0.205], label: "上げ吸い", delta: 0.1, justDelta: 0.16 },
  { id: "keep", from: 0.34, to: 0.66, just: [0.468, 0.532], label: "キープ", delta: 0, justDelta: 0 },
  { id: "down", from: 0.66, to: 1, just: [0.795, 0.86], label: "下げ吸い", delta: -0.1, justDelta: -0.16 },
];
// 炭交換: 新しい炭の熱は数秒かけて少しずつ入り、燃え進む速さも落ちる。
const EXCHANGE_HEAT = 0.19, EXCHANGE_RATE = 0.065;

/** 炭・熱・蒸らし・穴・詰めから、吸い出し開始時の温度を決める */
export function startTemp(cs) {
  return Number.isFinite(cs.steam?.temp) ? cs.steam.temp : temperatureAfterSteam(cs, undefined, rand(-0.03, 0.03));
}

const MODES = {
  pull: {
    store: "pull", title: "吸い出し", min: 2, drift: false, serveLabel: "提供する",
    hint: "針を止めた位置で吸い方が変わる。適温の中央にある細い最適温を狙って「提供する」。キープ中央は維持、左で微増・右で微減。吸いすぎると葉が痩せる。蒸らしで集中できたほど成功帯が広がり、針もゆっくり動く",
    start: startTemp, focus: pullFocusFromSteam,
  },
  care: {
    store: "care", title: "熱管理", min: 1, drift: true, serveLabel: "整え終える",
    hint: "審査員が吸っている間も炭は燃え進み、温度は動き続ける。最初の吸い出しの前なら「炭を交換」できる。新しい炭の熱は少しずつ入ってくる。針のゲームは吸い出しと同じで、最低1回吸ってから「整え終える」。洞察が高いほど熱の流れが読みやすい",
    start: (cs) => cs.pull?.temp ?? CENTER, focus: () => ({ slow: 1, window: 1 }),
  },
};

export function runPull(cs) { return pullGame(cs, MODES.pull); }
export function runCare(cs) { return pullGame(cs, MODES.care); }

async function pullGame(cs, mode) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel(mode.store, mode.title, mode.hint);
  const concentration = mode.focus(cs);
  const slow = skill.slow(cs) * (tutorial ? 1.3 : 1) * concentration.slow;
  const widen = skill.window(cs) * (tutorial ? 1.4 : 1) * concentration.window;
  let coreTemp = mode.start(cs);
  let T = coreTemp;
  const conditions = craftConditions(cs);
  let pulls = 0, justs = 0, burnt = false;
  // 熱管理だけ: 炭が燃え進んで熱が落ちる速さ、交換した炭からこれから入る熱、洞察で小さくなる揺らぎ
  const clarity = mode.drift ? skill.clarity(cs) : 1;
  let coolRate = mode.drift ? rand(0.006, 0.013) : 0, pendingHeat = 0, exchanged = false, elapsed = 0;
  const wobblePhase = rand(0, 6.28);
  const wobble = () => (mode.drift ? conditions.sparsity * 0.05 * Math.sin(elapsed * Math.PI * 2 / 2.6) + 0.014 * (1 - 0.7 * clarity) * Math.sin(elapsed * 1.7 + wobblePhase) : 0);
  const trend = () => (pendingHeat > 0.005 ? Math.min(EXCHANGE_RATE, pendingHeat) : 0) - coolRate;

  // ---- 画面
  const thermometer = buildThermometer();
  const thermo = thermometer.root;
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
  const serveBtn = el("button.btn", { dataset: { test: "pull-serve" }, disabled: true }, [el("span.btn-label", { text: mode.serveLabel })]);
  const exchangeBtn = mode.drift ? el("button.btn.care-exchange", { dataset: { test: "care-exchange" }, disabled: true }, [
    el("span.btn-label", { text: "炭を交換" }), el("small.btn-desc", { text: "熱が少しずつ入る" }),
  ]) : null;
  panel.append(el(`div.pull${mode.drift ? ".pull-care" : ""}`, [thermo, el("div.pull-main", [readout, gauge, counter, el("div.pull-btns", [exchangeBtn, pullBtn, serveBtn])])]));

  const render = () => {
    thermometer.update(T);
    setBenchTemperature(cs, T);
    thermometer.preview(pulls < PULL_MAX ? clamp(T + heatDelta(cs, actionAt(pos).delta), 0, 1) : null);
    const inZone = T >= IDEAL[0] && T <= IDEAL[1];
    const optimal = isOptimalTemperature(T);
    const state = optimal ? "最適温。今の煙を届けよう" : inZone ? "適温。中央の細い最適温を狙える" : T >= .90 ? "焦げる寸前。下げ吸いで熱を逃がしたい"
      : T > IDEAL[1] ? "熱い。下げ吸いで落ち着かせたい" : "まだぬるい。上げ吸いで熱を入れたい";
    const flow = trend();
    readout.textContent = mode.drift ? `${flow > 0.004 ? "↑ 熱が上がってきている" : flow < -0.004 ? "↓ 炭が燃え進んで熱が落ちていく" : "→ 熱は落ち着いている"}　${state}` : state;
    counter.textContent = `吸った回数 ${pulls}${pulls >= PULL_SAFE ? "（これ以上は葉が痩せる）" : ""}`
      + (exchanged ? " ／ 炭を交換した" : "")
      + (conditions.sparsity ? " ／ 少穴：吸い方による温度変化が大きい" : "") + (conditions.rainy ? " ／ 雨：熱が入りづらい" : "");
    counter.classList.toggle("warn", pulls >= PULL_SAFE);
    serveBtn.disabled = pulls < mode.min || burnt;
    pullBtn.disabled = pulls >= PULL_MAX || burnt;
    if (exchangeBtn) exchangeBtn.disabled = !running || exchanged || pulls > 0 || burnt;
  };

  // 温度計の一番上に届いたら、その場で爆発して焦げる（TH06）。
  const checkBurn = () => {
    if (burnt || !isBurnt(T)) return false;
    burnt = true; running = false; render(); serve();
    return true;
  };

  // 針（左→右→左の往復）。熱管理では同じ時間で炭の熱も動く。
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
    if (mode.drift) {
      elapsed += dt;
      const add = Math.min(pendingHeat, EXCHANGE_RATE * dt);
      pendingHeat -= add;
      coreTemp = clamp(coreTemp - coolRate * dt + add, 0, 1);
      T = clamp(coreTemp + wobble(), 0, 1);
      if (checkBurn()) return;
    }
    render();
    raf = requestAnimationFrame(loop);
  };

  const actionAt = (at) => {
    const z = ZONES.find((zz) => at >= zz.from && at <= zz.to) || ZONES[1];
    const jw = (z.just[1] - z.just[0]) * widen;
    const isJust = at >= z.just[0] && at <= z.just[0] + jw;
    // キープ中央は維持、左寄りは微増、右寄りは微減。最適温を自分で狙える。
    const delta = z.id === "keep" ? (.5 - at) * .18 : (isJust ? z.justDelta : z.delta) + .015;
    return { z, isJust, delta };
  };
  const doPull = (at = pos) => {
    if (pulls >= PULL_MAX || burnt || !running) return;
    const before = T;
    const { z, isJust, delta } = actionAt(at);
    pulls++;
    coreTemp = clamp(coreTemp + heatDelta(cs, delta), 0, 1);
    T = clamp(coreTemp + wobble(), 0, 1);
    if (checkBurn()) return;
    reactAudience(cs, pulls > PULL_SAFE || Math.abs(T - CENTER) > Math.abs(before - CENTER) ? "bad" : isJust ? "just" : "good");
    if (isJust) { justs++; SE.just(); flash("gold"); popStamp(panel, `ジャスト${z.label}`, "just", "58%", "22%"); }
    else { SE.good(); popStamp(panel, z.label, "good", "58%", "22%"); }
    SE.bubbling();
    if (pulls > PULL_SAFE) popStamp(panel, "葉が痩せる……", "bad", "58%", "34%");
    render();
  };
  // 炭交換は最初の吸い出しの前に一度だけ。交換したあとも温度は動き続ける。
  const exchange = () => {
    if (!mode.drift || !running || exchanged || pulls > 0 || burnt) return;
    exchanged = true;
    pendingHeat = heatDelta(cs, EXCHANGE_HEAT);
    coolRate *= 0.35;
    SE.coalSnip(); SE.crackle();
    popStamp(panel, "炭交換", "", "50%", "22%");
    render();
  };

  pullBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); doPull(); });
  exchangeBtn?.addEventListener("click", exchange);
  let serve;
  const served = new Promise((r) => { serve = r; });
  serveBtn.addEventListener("click", () => { if (pulls >= mode.min) serve(); });
  const unkey = keys({ " ": () => doPull(), Space: () => doPull(), Enter: () => pulls >= mode.min && serve() });

  render();
  await countdown();
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(loop);
  render();

  const auto = autoSkill();
  if (auto) {
    (async () => {
      await sleep(60);
      if (mode.drift && (auto === "burn" || (auto === "good" && T < CENTER - 0.04))) {
        exchange();
        while (running && pendingHeat > 0.005) await sleep(30);
      }
      const times = auto === "good" ? (mode.drift ? 2 : 3) : auto === "burn" ? 5 : mode.drift ? 1 : 5;
      for (let i = 0; i < times && running; i++) {
        let at;
        if (auto === "good") {
          const diff = CENTER - T, response = Math.abs(heatDelta(cs, diff >= 0 ? .18 : -.18));
          const keep = clamp(.5 - diff / response, .341, .659);
          const candidates = [.141, .3, keep, .75, .796];
          at = candidates.sort((a, b) => Math.abs(T + heatDelta(cs, actionAt(a).delta) - CENTER) - Math.abs(T + heatDelta(cs, actionAt(b).delta) - CENTER))[0];
        } else if (auto === "burn") {
          at = .17; // テスト用: ジャスト上げ吸いを重ねて温度計の一番上まで上げる
        } else {
          at = rand(0, 1) < 0.5 ? 0.3 : 0.25;
          // 雑な吸い方の自動操作でも、焦がす一手は打たない（大会の敗北テストを安定させる）。
          if (isBurnt(T + heatDelta(cs, actionAt(at).delta) + 0.03)) at = .75;
        }
        doPull(at);
        await sleep(40);
      }
      while (auto === "burn" && running) await sleep(30); // 交換した炭の熱で一番上まで届くのを待つ
      serve();
    })();
  }
  await served;
  running = false;
  cancelAnimationFrame(raf);
  unkey();
  if (exchangeBtn) exchangeBtn.disabled = true;
  if (burnt) {
    readout.textContent = "温度が上がりすぎた……！";
    await burstBench(cs);
    cs[mode.store] = { score: 0, grade: gradeOf(0), temp: T, pulls, justs, exchanged, inZone: false, optimal: false, over: true, under: false, burnt: true };
    cs.burnt = true;
    if (mode.store === "pull") { cs.pullDone = true; refreshBench(); }
    tickerSay("パッキー「ば、爆発ーッ！？ シーシャが焦げてしまったーッ！」");
    await resultCard(panel, { title: "シーシャが焦げてしまった", lines: ["温度計の一番上まで熱が上がり、葉が焦げた", `${pulls}回吸った`] });
    return;
  }

  const { score, inZone, optimal } = pullResult(T, pulls, justs, IDEAL);
  cs[mode.store] = { score, grade: gradeOf(score), temp: T, pulls, justs, exchanged, inZone, optimal, over: T > IDEAL[1], under: T < IDEAL[0] };
  if (mode.store === "pull") {
    cs.pullDone = true;
    refreshBench();
    tickerSay(inZone ? "パッキー「きた〜！ 煙の立ち方が変わりましたよ〜♪」" : "パッキー「おっと、ちょっと温度が怪しいか〜！？」");
    await resultCard(panel, {
      title: "吸い出し 結果",
      lines: [
        optimal ? "細い最適温に合わせて提供できた" : inZone ? "適温で提供できた。最適温まであと少し" : T > IDEAL[1] ? "少し熱いまま出してしまった" : "まだぬるいまま出してしまった",
        `${pulls}回吸った${justs ? `（ジャスト ${justs}回）` : ""}`,
        pulls > PULL_SAFE ? "吸いすぎた分、葉が痩せた" : "",
      ],
    });
    return;
  }
  tickerSay(inZone ? "パッキー「最後の一口まで崩れない！ 守り切ったーッ！」" : "パッキー「おっと、熱がぶれているか〜！？」");
  await resultCard(panel, {
    title: "熱管理 結果",
    lines: [
      optimal ? "細い最適温で、最後の一口まで守り切った" : inZone ? "適温で最後の一口まで守り切った" : T > IDEAL[1] ? "熱いまま審査員に任せてしまった" : "冷めたまま審査員に任せてしまった",
      exchanged ? "炭を交換して熱を足した" : "炭は替えずに整えた",
      `${pulls}回吸った${justs ? `（ジャスト ${justs}回）` : ""}`,
      pulls > PULL_SAFE ? "吸いすぎた分、葉が痩せた" : "",
    ],
  });
}
