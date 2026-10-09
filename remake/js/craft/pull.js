// 吸い出し（CLAUDE.md: 最低2回・3回までは無傷・それ以上は葉が痩せる。やめ時は自分で選ぶ）
// 左右に振れる針を止めた位置で、上げ吸い／キープ／下げ吸い。中央の細い帯が「ジャスト」。
// 熱管理（大会のR3・調整）も同じ針のゲーム。「炭を焼きますか？」で個数を選び、替えた炭で少し温度が上がってから、
// 温度が動き続ける中で最低1回吸って整える。3回目の吸い出しからフレーバーが傷む（TH14・TH21・TH22）。
// 温度計の一番上で焦げ、熱管理で冷え切り、フレーバーの体力が尽きると、その一台はダメになる（TH06・TH19・TH20）。
// 吸いすぎ・過熱での吸い出しは、はじめの体力も削って疲れ（針が速く、成功帯が狭い）が付く（TH29）。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, flash, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, setBenchTemperature, failBench, setBenchLeaf, strainBench } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";

import { craftConditions, heatDelta, pullResult, isOptimalTemperature, temperatureAfterSteam, pullFocusFromSteam, isBurnt, isColdOut, DANGER_TEMP, COLD_OUT, IDEAL } from "./conditions.js";
import { buildThermometer } from "./thermometer.js";

export { IDEAL } from "./conditions.js";
const CENTER = 0.54;
const PULL_MAX = 5;
// ここより熱い煙を吸うと、はじめがむせて疲れる（TH29）。
const HARSH_TEMP = 0.76;
// 針の位置の帯（0〜1）。上げ吸い=左、キープ=中、下げ吸い=右。ジャストはそれぞれの芯
const ZONES = [
  { id: "up", from: 0, to: 0.34, just: [0.14, 0.205], label: "上げ吸い", delta: 0.1, justDelta: 0.16 },
  { id: "keep", from: 0.34, to: 0.66, just: [0.468, 0.532], label: "キープ", delta: 0, justDelta: 0 },
  { id: "down", from: 0.66, to: 1, just: [0.795, 0.86], label: "下げ吸い", delta: -0.1, justDelta: -0.16 },
];
// 焼いて替える炭の個数ごとの、入ってくる熱と、その後の燃え進む速さ（0個は古い炭が尽きかけて早く冷える）。
const COAL_HEAT = [0, 0.06, 0.11, 0.16];
const COAL_COOL = [1.6, 0.75, 0.5, 0.35];
// フレーバー（葉）の体力。吸いすぎで1つずつ減り、尽きるとその一台はダメになる。吸い出しから熱管理へ引き継ぐ。
export const LEAF_MAX = 4;

const FAIL_TEXT = {
  burnt: { title: "シーシャが焦げてしまった", line: "温度計の一番上まで熱が上がり、葉が焦げた", ticker: "パッキー「ば、爆発ーッ！？ シーシャが焦げてしまったーッ！」" },
  cold: { title: "シーシャが冷え切ってしまった", line: "炭の熱が尽きて、煙が立たなくなった", ticker: "パッキー「あ、あれ〜？ 煙が……止まってしまったーッ！」" },
  leaf: { title: "フレーバーがダメになってしまった", line: "吸いすぎて、葉の香りが抜け切った", ticker: "パッキー「吸いすぎだーッ！ フレーバーが限界を迎えたーッ！」" },
};

/** 炭・熱・蒸らし・穴・詰めから、吸い出し開始時の温度を決める */
export function startTemp(cs) {
  return Number.isFinite(cs.steam?.temp) ? cs.steam.temp : temperatureAfterSteam(cs, undefined, rand(-0.03, 0.03));
}

const MODES = {
  pull: {
    store: "pull", title: "吸い出し", min: 2, safe: 3, drift: false, serveLabel: "提供する",
    hint: "針を止めた位置で吸い方が変わる。適温の中央にある細い最適温を狙って「提供する」。キープ中央は維持、左で微増・右で微減。4回目からフレーバーが傷む。蒸らしで集中できたほど成功帯が広がり、針もゆっくり動く",
    start: startTemp, focus: pullFocusFromSteam,
  },
  care: {
    store: "care", title: "熱管理", min: 1, safe: 2, drift: true, serveLabel: "整え終える",
    hint: "審査員が吸っている間も炭は燃え進み、温度は動き続ける。まず焼いて替える炭の数を決める。替えた炭の分だけ少し温度が上がる。針は吸い出しと同じで、キープなら温度を保てる。3回目からフレーバーが傷む。冷え切っても、焦げても、その一台はダメになる",
    start: (cs) => cs.pull?.temp ?? CENTER, focus: () => ({ slow: 1, window: 1 }),
  },
};

export function runPull(cs) { return pullGame(cs, MODES.pull); }
export function runCare(cs) { return pullGame(cs, MODES.care); }

async function pullGame(cs, mode) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel(mode.store, mode.title, mode.hint);
  const concentration = mode.focus(cs);
  // 疲れが付くと途中から針が速く、成功帯が狭くなるので、毎回計算し直す。
  const slowNow = () => skill.slow(cs) * (tutorial ? 1.3 : 1) * concentration.slow;
  const widenNow = () => skill.window(cs) * (tutorial ? 1.4 : 1) * concentration.window;
  let widen = widenNow();
  let coreTemp = mode.start(cs);
  let T = coreTemp;
  const conditions = craftConditions(cs);
  cs.leaf ??= { hp: LEAF_MAX, max: LEAF_MAX };
  setBenchLeaf(cs);
  let pulls = 0, justs = 0, failed = null, coals = null;
  // 熱管理だけ: 炭が燃え進んで熱が落ちる速さと、洞察で小さくなる揺らぎ
  const clarity = mode.drift ? skill.clarity(cs) : 1;
  const baseCool = mode.drift ? rand(0.006, 0.013) : 0;
  let coolRate = 0, elapsed = 0;
  const wobblePhase = rand(0, 6.28);
  const wobble = () => (mode.drift ? conditions.sparsity * 0.05 * Math.sin(elapsed * Math.PI * 2 / 2.6) + 0.014 * (1 - 0.7 * clarity) * Math.sin(elapsed * 1.7 + wobblePhase) : 0);

  // ---- 画面
  const thermometer = buildThermometer({ coldLimit: mode.drift ? COLD_OUT : null });
  // 針はゲージの外側の枠に置き、上下にはみ出す目立つ形にする（TH30）。
  const needle = el("i.pg-needle", { dataset: { test: "pull-needle" } });
  const justs$ = ZONES.map((z) => el("i.pg-just"));
  const placeJusts = () => ZONES.forEach((z, i) => Object.assign(justs$[i].style, {
    left: `${((z.just[0] - z.from) / (z.to - z.from)) * 100}%`, width: `${((z.just[1] - z.just[0]) * widen / (z.to - z.from)) * 100}%`,
  }));
  placeJusts();
  const gauge = el("div.pull-gauge-wrap", [el("div.pull-gauge", ZONES.map((z, i) => el(`div.pg-zone.z-${z.id}`, { style: { left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` } }, [
    el("span", { text: z.label }), justs$[i],
  ]))), needle]);
  const counter = el("div.pull-count");
  const readout = el("div.pull-read");
  const pullBtn = el("button.btn.primary", { dataset: { test: "pull-stop" } }, [el("span.btn-label", { text: "吸う（針を止める）" })]);
  const serveBtn = el("button.btn", { dataset: { test: "pull-serve" }, disabled: true }, [el("span.btn-label", { text: mode.serveLabel })]);
  const play = el("div.pull-play", [gauge, counter, el("div.pull-btns", [pullBtn, serveBtn])]);
  const main = el("div.pull-main", [readout, play]);
  panel.append(el(`div.pull${mode.drift ? ".pull-care" : ""}`, [thermometer.root, main]));

  const render = () => {
    thermometer.update(T);
    setBenchTemperature(cs, T);
    thermometer.preview(running && pulls < PULL_MAX ? clamp(T + heatDelta(cs, actionAt(pos).delta), 0, 1) : null);
    if (choosing) return;
    const inZone = T >= IDEAL[0] && T <= IDEAL[1];
    const optimal = isOptimalTemperature(T);
    const state = optimal ? "最適温。今の煙を届けよう" : inZone ? "適温。キープなら温度を保てる" : T >= DANGER_TEMP ? "焦げる寸前。下げ吸いで熱を逃がしたい"
      : T > IDEAL[1] ? "熱い。下げ吸いで落ち着かせたい" : mode.drift && T <= COLD_OUT + 0.08 ? "冷え切りそう。上げ吸いで熱を入れたい" : "まだぬるい。上げ吸いで熱を入れたい";
    readout.textContent = mode.drift && running ? `↓ 炭が燃え進んで熱が落ちていく　${state}` : state;
    counter.textContent = `吸った回数 ${pulls}（${mode.safe + 1}回目からフレーバーが傷む）`
      + (coals ? ` ／ 炭を${coals}個替えた` : "")
      + (conditions.sparsity ? " ／ 少穴：吸い方による温度変化が大きい" : "") + (conditions.rainy ? " ／ 雨：熱が入りづらい" : "");
    counter.classList.toggle("warn", pulls >= mode.safe);
    serveBtn.disabled = pulls < mode.min || !!failed;
    pullBtn.disabled = pulls >= PULL_MAX || !!failed;
  };

  // その一台がダメになったら、すぐに止めて結果へ進む。
  const fail = (kind) => {
    if (failed) return true;
    failed = kind; running = false; render(); serve();
    return true;
  };
  const checkTemperature = () => (isBurnt(T) ? fail("burnt") : mode.drift && isColdOut(T) ? fail("cold") : false);

  // 針（左→右→左の往復）。熱管理では同じ時間で炭の熱も動く。
  let pos = 0, dir = 1, raf = 0, last = 0, running = false, choosing = false;
  let period = 1.5 * slowNow();
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
      coreTemp = clamp(coreTemp - coolRate * dt, 0, 1);
      T = clamp(coreTemp + wobble(), 0, 1);
      if (checkTemperature()) return;
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
  // 吸いすぎでフレーバーが傷む。文字は出さず、ダメージの音と揺れ、葉の傷みで伝える（TH27・TH28）。
  const damageLeaf = () => {
    cs.leaf.hp = Math.max(0, cs.leaf.hp - 1);
    setBenchLeaf(cs, true);
    SE.hit(); shake(undefined, 380);
    if (cs.leaf.hp <= 0) fail("leaf");
  };
  // 吸いすぎ・過熱の吸い出しで、はじめが疲れる。針と成功帯にすぐ反映する（TH29）。
  const strain = () => {
    if (!strainBench(cs)) return;
    period = 1.5 * slowNow(); widen = widenNow(); placeJusts();
    SE.miss();
  };
  const doPull = (at = pos) => {
    if (pulls >= PULL_MAX || failed || !running) return;
    const before = T;
    const { z, isJust, delta } = actionAt(at);
    pulls++;
    coreTemp = clamp(coreTemp + heatDelta(cs, delta), 0, 1);
    T = clamp(coreTemp + wobble(), 0, 1);
    if (checkTemperature()) return;
    if (isJust) justs++;
    const overdone = pulls > mode.safe;
    reactAudience(cs, overdone || Math.abs(T - CENTER) > Math.abs(before - CENTER) ? "bad" : isJust ? "just" : "good");
    if (isJust) { SE.just(); flash("gold"); popStamp(panel, `ジャスト${z.label}`, "just", "58%", "22%"); }
    else { SE.good(); popStamp(panel, z.label, "good", "58%", "22%"); }
    SE.bubbling();
    if (overdone || T >= HARSH_TEMP) strain();
    if (overdone) { damageLeaf(); if (failed) return; }
    render();
  };

  /** 熱管理の準備: 「炭を焼きますか？」で個数を選ぶ。替えた炭の熱が少しずつ入り、温度計が上がる。 */
  const prepareCoals = async () => {
    choosing = true;
    play.hidden = true;
    readout.textContent = "そろそろ調整の準備をしよう";
    const choice = el("div.care-coals", { dataset: { test: "care-coals" } }, [
      el("p.care-coals-ask", { text: "炭を焼きますか？" }),
      el("div.care-coal-btns", [0, 1, 2, 3].map((n) => el("button.btn.care-coal", { dataset: { test: `care-coal-${n}` }, onclick: () => pick(n) }, [
        el("span.btn-label", { text: n ? `${n}個` : "焼かない" }), el("small.btn-desc", { text: n ? `熱が${["", "少し", "そこそこ", "しっかり"][n]}入る` : "今の炭のまま" }),
      ]))),
      el("p.care-coals-note", { text: "今の炭は燃え進んで、熱が落ちていく。焼いた炭に替えると、少しずつ温度が上がる" }),
    ]);
    main.append(choice);
    render();
    let pick;
    const picked = new Promise((r) => { pick = r; });
    const auto = autoSkill();
    if (auto) {
      const best = [0, 1, 2, 3].sort((a, b) => Math.abs(T + heatDelta(cs, COAL_HEAT[a]) - CENTER - 0.02) - Math.abs(T + heatDelta(cs, COAL_HEAT[b]) - CENTER - 0.02))[0];
      setTimeout(() => pick(auto === "good" ? best : auto === "burn" ? 3 : 0), 60);
    }
    coals = await picked;
    choice.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    SE.select();
    coolRate = baseCool * COAL_COOL[coals];
    if (coals) {
      readout.textContent = `炭を${coals}個焼いて替えた。熱が入ってくる`;
      SE.coalSnip(); SE.crackle();
      popStamp(panel, `炭替え ${coals}個`, "", "58%", "22%");
      const from = coreTemp, add = heatDelta(cs, COAL_HEAT[coals]), started = performance.now(), dur = autoSkill() ? 200 : 1400;
      for (;;) {
        const k = Math.min(1, (performance.now() - started) / dur);
        coreTemp = clamp(from + add * (1 - (1 - k) ** 2), 0, 1); T = coreTemp;
        render();
        if (isBurnt(T)) { failed = "burnt"; break; }
        if (k >= 1) break;
        await new Promise(requestAnimationFrame);
      }
    } else {
      readout.textContent = "今の炭のまま整える。熱は落ちていく";
      await sleep(autoSkill() ? 60 : 700);
    }
    choice.remove();
    choosing = false;
    play.hidden = false;
  };

  pullBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); doPull(); });
  let serve;
  const served = new Promise((r) => { serve = r; });
  serveBtn.addEventListener("click", () => { if (pulls >= mode.min) serve(); });
  const unkey = keys({ " ": () => doPull(), Space: () => doPull(), Enter: () => pulls >= mode.min && serve() });

  render();
  if (mode.drift) await prepareCoals();
  if (!failed) {
    render();
    await countdown();
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
    render();
  } else serve();

  const auto = autoSkill();
  if (auto && !failed) {
    (async () => {
      await sleep(60);
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
      serve();
    })();
  }
  await served;
  running = false;
  cancelAnimationFrame(raf);
  unkey();
  if (failed) {
    const text = FAIL_TEXT[failed];
    readout.textContent = `${text.title}……！`;
    await failBench(cs, failed);
    cs[mode.store] = { score: 0, grade: gradeOf(0), temp: T, pulls, justs, coals, inZone: false, optimal: false, over: failed === "burnt", under: failed === "cold", failed };
    cs.failed = failed;
    if (failed === "burnt") cs.burnt = true;
    if (mode.store === "pull") { cs.pullDone = true; refreshBench(); }
    tickerSay(text.ticker);
    await resultCard(panel, { title: text.title, lines: [text.line, `${pulls}回吸った`] });
    return;
  }

  const { score, inZone, optimal } = pullResult(T, pulls, justs, IDEAL, mode.safe);
  cs[mode.store] = { score, grade: gradeOf(score), temp: T, pulls, justs, coals, inZone, optimal, over: T > IDEAL[1], under: T < IDEAL[0] };
  const hurt = Math.max(0, pulls - mode.safe);
  if (mode.store === "pull") {
    cs.pullDone = true;
    refreshBench();
    tickerSay(inZone ? "パッキー「きた〜！ 煙の立ち方が変わりましたよ〜♪」" : "パッキー「おっと、ちょっと温度が怪しいか〜！？」");
    await resultCard(panel, {
      title: "吸い出し 結果",
      lines: [
        optimal ? "細い最適温に合わせて提供できた" : inZone ? "適温で提供できた。最適温まであと少し" : T > IDEAL[1] ? "少し熱いまま出してしまった" : "まだぬるいまま出してしまった",
        `${pulls}回吸った${justs ? `（ジャスト ${justs}回）` : ""}`,
        hurt ? "吸いすぎた分、フレーバーが傷んだ" : "",
      ],
    });
    return;
  }
  tickerSay(inZone ? "パッキー「最後の一口まで崩れない！ 守り切ったーッ！」" : "パッキー「おっと、熱がぶれているか〜！？」");
  await resultCard(panel, {
    title: "熱管理 結果",
    lines: [
      optimal ? "細い最適温で、最後の一口まで守り切った" : inZone ? "適温で最後の一口まで守り切った" : T > IDEAL[1] ? "熱いまま審査員に任せてしまった" : "冷めたまま審査員に任せてしまった",
      coals ? `炭を${coals}個焼いて替えた` : "炭は替えずに整えた",
      `${pulls}回吸った${justs ? `（ジャスト ${justs}回）` : ""}`,
      hurt ? "吸いすぎた分、フレーバーが傷んだ" : "",
    ],
  });
}
