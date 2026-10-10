// 吸い出し（CLAUDE.md: 最低2回・3回までは無傷・それ以上は葉が痩せる。やめ時は自分で選ぶ）
// 左右に振れる針を止めた位置で、上げ吸い／キープ／下げ吸い。中央の細い帯が「ジャスト」。
// 熱管理（大会のR3・調整）も同じ針のゲーム。「炭を交換しますか？」で個数を選び、交換した炭で温度が戻ってから、
// 温度が動き続ける中で最低1回吸って整える。3回目の吸い出しからフレーバーが傷む（TH14・TH21・TH22・TH39）。
// 温度計の一番上で焦げ、熱管理で冷え切り、フレーバーの体力が尽きると、その一台はダメになる（TH06・TH19・TH20）。
// 吸いすぎ・過熱での吸い出しは、はじめの体力も削って疲れ（針が速く、成功帯が狭い）が付く（TH29）。
// 人によって狙いが違うので、EXCELLENT・GOOD の判定は出さない。吸うと温度計の横に上下の印だけが出る（TH36）。
// 左の作業風景に温度計、右に半円ダイヤル。左の下げ吸い=寒色→キープ→右の上げ吸い=暖色。
// TH61: 真円の半円と中央から振れる細い針。止めたら一口を吸い終えるまで固定する。
// 各帯には温度が上下することだけを添える。時間・強さは画面に書かない（TH60）。
// 熱管理では、立ち上げから吸われて消耗した炭を交換する。交換する炭はもう一度炭焼きで焼き、焼け具合で戻る熱と持ちが変わる（TH39）。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, shake } from "../core/ui.js";
import { SE, startBubbling } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, setBenchTemperature, setBenchDraw, failBench, setBenchLeaf, dockBenchLeaf, strainBench, scoreStep } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys } from "./common.js";
import { burnCoals, HEAT_GRADES } from "./heat.js";

import { craftConditions, heatDelta, pullResult, isOptimalTemperature, temperatureAfterSteam, pullFocusFromSteam, isBurnt, isColdOut, DANGER_TEMP, COLD_OUT, IDEAL } from "./conditions.js";
import { buildThermometer } from "./thermometer.js";
import { artImg } from "./art.js";
import { DRAW_MS, animateDraw } from "./pull-draw.js";

export { IDEAL } from "./conditions.js";
const CENTER = 0.54;
const PULL_MAX = 5;
// ここより熱い煙を吸うと、はじめがむせて疲れる（TH29）。
const HARSH_TEMP = 0.76;
// 針の位置の帯（0〜1）。下げ吸い=左、キープ=中、上げ吸い=右。芯に止めると上げ下げが強い。
const ZONES = [
  { id: "down", from: 0, to: 0.34, just: [0.14, 0.205], label: "下げ吸い", mark: "▼", delta: -0.1, justDelta: -0.16 },
  { id: "keep", from: 0.34, to: 0.66, just: [0.468, 0.532], label: "キープ", mark: "＝", delta: 0, justDelta: 0 },
  { id: "up", from: 0.66, to: 1, just: [0.795, 0.86], label: "上げ吸い", mark: "▲", delta: 0.1, justDelta: 0.16 },
];
// 交換する炭の個数ごとの、戻ってくる熱と、その後の燃え進む速さ（0個は消耗した炭のままで早く冷える）。
const COAL_HEAT = [0, 0.06, 0.11, 0.16];
const COAL_COOL = [1.6, 0.75, 0.5, 0.35];
// 交換用に焼いた炭の焼け具合。熱の戻り（火力）と持ち（安定）を、最初の炭焼きと同じ判定から決める。
const coalHeatFactor = (picks) => picks.reduce((s, g) => s + 1 + HEAT_GRADES[g].hp / 100, 0) / picks.length;
const coalLifeFactor = (picks) => picks.reduce((s, g) => s + 1 - HEAT_GRADES[g].hs / 100, 0) / picks.length;
// 半円ダイヤルの形（SVG座標）。p=0が左端、p=1が右端。
const DIAL = { cx: 240, cy: 232, r0: 140, r1: 202 };
const dialPoint = (p, r) => {
  const a = Math.PI * (1 - p);
  return `${(DIAL.cx + r * Math.cos(a)).toFixed(2)} ${(DIAL.cy - r * Math.sin(a)).toFixed(2)}`;
};
const dialSector = (p0, p1, r0 = DIAL.r0, r1 = DIAL.r1) =>
  `M${dialPoint(p0, r1)}A${r1} ${r1} 0 0 1 ${dialPoint(p1, r1)}L${dialPoint(p1, r0)}A${r0} ${r0} 0 0 0 ${dialPoint(p0, r0)}Z`;
let dials = 0;
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
    hint: "針を止めた位置で吸い方が変わる。右の上げ吸いは温度を上げ、左の下げ吸いは温度を下げる。光る芯ほど変化が大きく、中央のキープは温度を保つ（左寄りで微減・右寄りで微増）。吸い終えて温度が変わってから、次の針を止められる。温度計の緑が適温、虹色が最適温。4回目からフレーバーの葉が傷む。蒸らしで集中できたほど芯が広がり、針がゆっくり動く",
    start: startTemp, focus: pullFocusFromSteam,
  },
  care: {
    store: "care", title: "熱管理", min: 1, safe: 2, drift: true, serveLabel: "整え終える",
    hint: "立ち上げから吸われ続けた炭は消耗して、温度が下がっていく。まず交換する炭の数を決め、その炭を焼いてから替える。焼け具合が良いほど温度がしっかり戻り、長く持つ。ダイヤルは吸い出しと同じで、キープなら温度を保てる。3回目からフレーバー（下の葉）が傷む。炎の印まで上がって焦げても、雪の印まで冷え切っても、その一台はダメになる",
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
  const thermometer = buildThermometer({ coldLimit: mode.drift ? COLD_OUT : null, height: 352 });
  // SVGの縦横比を保ち、針・リングを同じ中心で回す。
  const id = ++dials;
  const dial = el("div.pull-dial", { html: `<svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs><linearGradient id="dial-grad-${id}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#149cfc"/><stop offset=".2" stop-color="#206bb9"/><stop offset=".38" stop-color="#454a69"/>
      <stop offset=".5" stop-color="#887c70"/><stop offset=".62" stop-color="#714341"/><stop offset=".8" stop-color="#ff7525"/><stop offset="1" stop-color="#ff431b"/>
    </linearGradient><radialGradient id="dial-shade-${id}" cx=".5" cy="1" r=".72">
      <stop offset=".35" stop-color="#000" stop-opacity=".34"/><stop offset=".72" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".26"/>
    </radialGradient></defs>
    <path class="dial-recess" d="${dialSector(0, 1, 118, 212)}"/>
    <path class="dial-ring" d="${dialSector(0, 1)}" fill="url(#dial-grad-${id})"/>
    <path class="dial-shade" d="${dialSector(0, 1)}" fill="url(#dial-shade-${id})"/>
    <path class="dial-gloss" d="${dialSector(0, 1, DIAL.r1 - 18, DIAL.r1)}"/>
    ${ZONES.map((z) => `<g class="pg-zone z-${z.id}"><path class="pg-just"/></g>`).join("")}
    <path class="dial-rim" d="${dialSector(0, 1)}"/>
    <g class="pg-needle" data-test="pull-needle">
      <path class="needle-body" d="M${DIAL.cx - 3} ${DIAL.cy}L${DIAL.cx - 1.5} ${DIAL.cy - DIAL.r1 + 5}L${DIAL.cx + 1.5} ${DIAL.cy - DIAL.r1 + 5}L${DIAL.cx + 3} ${DIAL.cy}Z"/>
      <path class="needle-light" d="M${DIAL.cx} ${DIAL.cy - 9}V${DIAL.cy - DIAL.r1 + 7}"/>
      <path class="needle-cap" d="M${DIAL.cx} ${DIAL.cy - DIAL.r1 - 8}l-5 11h10Z"/>
    </g>
    <circle class="dial-pivot-rim" cx="${DIAL.cx}" cy="${DIAL.cy}" r="9"/>
    <circle class="dial-pivot" cx="${DIAL.cx}" cy="${DIAL.cy}" r="5"/>
  </svg>` });
  const labels = el("div.pull-dial-labels", ZONES.map(z => el(`div.pull-zone-label.l-${z.id}`, [
    el("b", { text: z.id === "keep" ? z.label : `${z.mark} ${z.label}` }),
    el("span", { text: z.id === "keep" ? "この温度を維持" : z.id === "down" ? "温度を下げる" : "温度を上げる" }),
  ].filter(Boolean))));
  const dialRow = el("div.pull-dial-row", [dial, labels]);
  const needle = dial.querySelector(".pg-needle");
  const justs$ = [...dial.querySelectorAll(".pg-just")];
  const placeJusts = () => ZONES.forEach((z, i) => {
    const span = (z.just[1] - z.just[0]) * widen;
    justs$[i].setAttribute("d", dialSector(z.just[0], z.just[0] + span));
    justs$[i].dataset.span = span.toFixed(4); // 芯（成功帯）の実際の幅（ダイヤル一周＝1）
  });
  placeJusts();
  const moveNeedle = (at) => {
    needle.setAttribute("transform", `rotate(${((at - 0.5) * 180).toFixed(2)} ${DIAL.cx} ${DIAL.cy})`);
    needle.dataset.pos = (at * 100).toFixed(2);
  };
  moveNeedle(0);
  // 吸った回数は文字でなく点で。最低回数の点は金の縁。炭・雨・少穴は短い札（TH35）。
  const pips = Array.from({ length: PULL_MAX }, (_, i) => el(`i.pull-pip${i < mode.min ? ".need" : ""}`));
  const pipRow = el("span.pull-pips", { title: "吸った回数", dataset: { test: "pull-pips" } }, pips);
  const tags = el("span.pull-tags");
  const counter = el("div.pull-count", [pipRow, tags]);
  const readout = el("div.pull-read");
  const drawStatus = el("span.pull-draw-status", { role: "status", dataset: { test: "pull-draw-status" }, text: "吸いすぎると葉が傷み、香りが弱くなります。" });
  const inhale = el("span.pull-btn-icon", { "aria-hidden": "true", html: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 25c-6-4-1-8 3-12l7-8m-4 20c-4 3-8-1-5-5l5-6m5 9c-1 6 4 4 7-1"/></svg>' });
  const pullLabel = el("span.btn-label", { text: "吸う（針を止める）" });
  const pullBtn = el("button.btn.primary", { dataset: { test: "pull-stop" }, disabled: true }, [inhale, pullLabel]);
  const serveBtn = el("button.btn", { dataset: { test: "pull-serve" }, disabled: true }, [el("span.pull-serve-icon", { "aria-hidden": "true", html: '<svg viewBox="0 0 40 32" fill="currentColor"><path d="m6 21 5-7 8 1 9-5 3 3-10 6h-7l8 4 10-3 3 3-13 6-18-3Z"/><path d="m24 11 8-9 2 2-8 10Z"/></svg>' }), el("span.btn-label", { text: mode.serveLabel })]);
  const leafArt = (size) => artImg("ui_mockup_flavor_leaf.png", size, "leaf-skin", { h: size });
  const extraLeaves = Array.from({ length: LEAF_MAX - 1 }, (_, i) => el("i.pull-life-leaf", { "aria-hidden": "true", dataset: { slot: i + 1 } }, [leafArt(34)]));
  const lifeLeaves = el("span.pull-life-leaves", extraLeaves);
  const summary = el("div.pull-summary", [
    el("div.pull-life", [el("span.pull-life-label", { text: "フレーバーの持ち" }), lifeLeaves]),
    el("div.pull-life-note", [el("i.pull-note-leaf", { "aria-hidden": "true" }, [leafArt(23)]), el("div.pull-life-copy", [drawStatus, counter])]),
  ]);
  const play = el("div.pull-play", [dialRow, summary, el("div.pull-btns", [pullBtn, serveBtn])]);
  play.setAttribute("aria-label", "左の下げ吸いで温度を下げ、中央でキープ、右の上げ吸いで温度を上げる");
  const main = el("div.pull-main", [play]);
  panel.append(el(`div.pull${mode.drift ? ".pull-care" : ""}`, [thermometer.root, main]));
  thermometer.root.append(readout);
  dockBenchLeaf(cs, lifeLeaves);

  const render = () => {
    thermometer.update(T);
    setBenchTemperature(cs, T);
    thermometer.preview(running && !drawing && !finished && pulls < PULL_MAX ? clamp(T + heatDelta(cs, actionAt(pos).delta), 0, 1) : null);
    if (choosing) return;
    const inZone = T >= IDEAL[0] && T <= IDEAL[1];
    const optimal = isOptimalTemperature(T);
    // 今の温度を短い一語で。温度計の印と同じ色にする。
    const [state, tone] = optimal ? ["最適温", "optimal"] : inZone ? ["適温", "ok"] : T >= DANGER_TEMP ? ["焦げる寸前！", "danger"]
      : T > IDEAL[1] ? ["熱い", "hot"] : mode.drift && T <= COLD_OUT + 0.08 ? ["冷え切りそう！", "cold"] : ["ぬるい", "cool"];
    readout.dataset.tone = tone;
    readout.replaceChildren(el("b.pull-state", { text: state }), mode.drift && running && !drawing ? el("span.pull-drift", { text: "↓", title: "炭が燃え進んで、熱が落ちていく" }) : "");
    pips.forEach((p, i) => p.classList.toggle("on", i < pulls));
    extraLeaves.forEach((leaf, i) => leaf.classList.toggle("on", i + 1 < cs.leaf.hp));
    pipRow.setAttribute("aria-label", `吸った回数 ${pulls}`);
    tags.replaceChildren(...[
      coals != null && el("span.pull-tag", { text: coals ? `炭×${coals}` : "炭そのまま", title: coals ? `消耗した炭を${coals}個交換した` : "炭は交換していない" }),
      conditions.sparsity && el("span.pull-tag", { text: "少穴", title: "吸い方による温度変化が大きい" }),
      conditions.rainy && el("span.pull-tag", { text: "雨", title: "熱が入りづらい" }),
    ].filter(Boolean));
    serveBtn.disabled = !running || drawing || finished || pulls < mode.min || !!failed;
    pullBtn.disabled = !running || drawing || finished || pulls >= PULL_MAX || !!failed;
  };

  // その一台がダメになったら、すぐに止めて結果へ進む。
  const fail = (kind) => {
    if (failed) return true;
    failed = kind; running = false; render(); serve();
    return true;
  };
  const checkTemperature = () => (isBurnt(T) ? fail("burnt") : mode.drift && isColdOut(T) ? fail("cold") : false);

  // 針（左→右→左の往復）。熱管理では同じ時間で炭の熱も動く。
  let pos = 0, dir = 1, raf = 0, last = 0, running = false, choosing = false, drawing = false, finished = false, abandoned = false;
  let stopBubbles = () => {};
  let period = 1.5 * slowNow();
  const loop = (now) => {
    if (!running || drawing || finished) return;
    if (!play.isConnected) { abandoned = true; running = false; serve(); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pos += (dir * dt * 2) / period;
    if (pos >= 1) { pos = 1; dir = -1; }
    if (pos <= 0) { pos = 0; dir = 1; }
    moveNeedle(pos);
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
    // キープ中央は維持。半円の色に合わせ、左寄りは微減、右寄りは微増。
    const delta = z.id === "keep" ? (at - .5) * .18 : (isJust ? z.justDelta : z.delta) + .015;
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
  const doPull = async (at = pos) => {
    if (pulls >= PULL_MAX || failed || !running || drawing || finished) return;
    const before = T;
    const { z, isJust, delta } = actionAt(at);
    drawing = true;
    cancelAnimationFrame(raf);
    moveNeedle(at);
    pulls++;
    const duration = autoSkill() ? 120 : DRAW_MS[z.id];
    const from = coreTemp, to = clamp(from + heatDelta(cs, delta), 0, 1), sway = T - coreTemp;
    play.dataset.draw = z.id;
    play.style.setProperty("--draw-duration", `${duration}ms`);
    pullLabel.textContent = "吸っている…";
    drawStatus.textContent = `${z.label}で吸っている…`;
    setBenchDraw(cs, z.id, duration);
    stopBubbles = startBubbling({ strength: z.id === "keep" ? .65 : 1 });
    render();
    try {
      const complete = await animateDraw({ duration,
        active: () => running && !finished && !failed && play.isConnected,
        update: (progress, linear) => {
          coreTemp = from + (to - from) * progress;
          T = clamp(coreTemp + sway * (1 - progress), 0, 1);
          play.style.setProperty("--draw-progress", Math.min(1, linear).toFixed(4));
          render();
          checkTemperature();
        },
      });
      if (!complete || failed || finished) {
        if (!failed && !finished) { abandoned = true; running = false; serve(); }
        return;
      }
      if (isJust) justs++;
      const overdone = pulls > mode.safe;
      reactAudience(cs, overdone || Math.abs(T - CENTER) > Math.abs(before - CENTER) ? "bad" : "good");
      thermometer.pop(z.id === "keep" ? z.mark : isJust ? z.mark.repeat(2) : z.mark, z.id);
      if (overdone || T >= HARSH_TEMP) strain();
      if (overdone) { damageLeaf(); if (failed) return; }
    } finally {
      stopBubbles();
      setBenchDraw(cs, null);
      drawing = false;
      delete play.dataset.draw;
      pullLabel.textContent = "吸う（針を止める）";
      drawStatus.textContent = pulls >= PULL_MAX ? "吸い終えたら、温度を見て提供しよう" : "吸いすぎると葉が傷み、香りが弱くなります。";
      if (!failed && !finished && !abandoned && play.isConnected) {
        render();
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    }
  };

  /**
   * 熱管理の準備（TH21・TH39）: 立ち上げから吸われて消耗した炭を、何個交換するか選ぶ。
   * 交換する炭はもう一度炭焼きで焼き、焼け具合で戻る熱と持ちが決まる。替えた分だけ温度が戻る。
   */
  const prepareCoals = async () => {
    choosing = true;
    play.hidden = true;
    const lead = el("p.care-coals-lead", { text: "そろそろ調整の準備をしよう" });
    // 説明文の代わりに、温度計と同じ印で戻る熱を示す（▲が多いほど戻る。交換しないと ↓ 落ちていく）。
    const buttons = el("div.care-coal-btns", [0, 1, 2, 3].map((n) => el("button.btn.care-coal", {
      dataset: { test: `care-coal-${n}` }, onclick: () => pick(n),
      title: n ? `消耗した炭を${n}個、焼いた炭に交換する。温度が${["", "少し", "そこそこ", "しっかり"][n]}戻る` : "消耗した炭のまま。温度は落ちていく",
      onpointerenter: () => thermometer.preview(n ? clamp(T + heatDelta(cs, COAL_HEAT[n]), 0, 1) : null, "点線：交換するとここ"),
      onpointerleave: () => thermometer.preview(null),
    }, [
      el("span.btn-label", { text: n ? `${n}個` : "交換しない" }), el("small.btn-desc", { text: n ? "▲".repeat(n) : "↓" }),
    ])));
    const choice = el("div.care-coals", { dataset: { test: "care-coals" } }, [lead, el("p.care-coals-ask", { text: "炭を交換しますか？" }), buttons]);
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
    thermometer.preview(null);
    buttons.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    SE.select();
    coolRate = baseCool * COAL_COOL[coals];
    if (!coals) {
      lead.textContent = "消耗した炭のまま整える。熱は落ちていく";
      await sleep(autoSkill() ? 60 : 700);
      choice.remove();
      choosing = false;
      play.hidden = false;
      return;
    }
    // 交換する炭を焼く。最初の炭焼きと同じ遊び方で、個数だけ違う。
    choice.replaceChildren(el("p.care-coals-lead", { text: `交換する炭を${coals}個焼こう` }));
    const stage = el("div.care-burn", { dataset: { test: "care-burn" } });
    choice.append(stage);
    const { picks } = await burnCoals(cs, stage, { count: coals, compact: true });
    coolRate *= coalLifeFactor(picks);
    cs.careCoals = { count: coals, picks };
    await sleep(autoSkill() ? 40 : 450);
    choice.replaceChildren(el("p.care-coals-lead", { text: "消耗した炭を交換した。温度が戻ってくる" }));
    SE.coalSnip(); SE.crackle();
    const from = coreTemp, add = heatDelta(cs, COAL_HEAT[coals] * coalHeatFactor(picks)), started = performance.now(), dur = autoSkill() ? 200 : 1400;
    for (;;) {
      const k = Math.min(1, (performance.now() - started) / dur);
      coreTemp = clamp(from + add * (1 - (1 - k) ** 2), 0, 1); T = coreTemp;
      render();
      if (isBurnt(T)) { failed = "burnt"; break; }
      if (k >= 1) break;
      await new Promise(requestAnimationFrame);
    }
    choice.remove();
    choosing = false;
    play.hidden = false;
  };

  pullBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); doPull(); });
  // キーボード・支援技術が送るclickにも対応。吸引中の連打・長押しは同じ一口にする。
  pullBtn.addEventListener("click", (e) => { if (e.detail === 0) doPull(); });
  let serve;
  const served = new Promise((r) => { serve = r; });
  const finish = () => { if (!serveBtn.disabled) { finished = true; serve(); } };
  serveBtn.addEventListener("click", finish);
  const unkey = keys({ " ": (e) => !e.repeat && doPull(), Space: (e) => !e.repeat && doPull(), Enter: (e) => !e.repeat && finish() });

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
          const diff = CENTER - T, response = Math.abs(heatDelta(cs, .18));
          const keep = clamp(.5 + diff / response, .341, .659);
          const candidates = [.141, .3, keep, .75, .796];
          at = candidates.sort((a, b) => Math.abs(T + heatDelta(cs, actionAt(a).delta) - CENTER) - Math.abs(T + heatDelta(cs, actionAt(b).delta) - CENTER))[0];
        } else if (auto === "burn") {
          at = .83; // テスト用: 右のジャスト上げ吸いを重ねて焦がす
        } else {
          at = rand(0, 1) < 0.5 ? 0.7 : 0.75;
          // 雑な吸い方の自動操作でも、焦がす一手は打たない（大会の敗北テストを安定させる）。
          if (isBurnt(T + heatDelta(cs, actionAt(at).delta) + 0.03)) at = .25;
        }
        await doPull(at);
        await sleep(40);
      }
      serve();
    })();
  }
  await served;
  running = false; finished = true;
  cancelAnimationFrame(raf);
  stopBubbles();
  setBenchDraw(cs, null);
  render();
  unkey();
  if (abandoned) return;
  if (failed) {
    const text = FAIL_TEXT[failed];
    readout.textContent = `${text.title}……！`;
    await failBench(cs, failed);
    cs[mode.store] = { score: 0, grade: gradeOf(0), temp: T, pulls, justs, coals, inZone: false, optimal: false, over: failed === "burnt", under: failed === "cold", failed };
    cs.failed = failed;
    scoreStep(cs, mode.store, 0);
    if (failed === "burnt") cs.burnt = true;
    if (mode.store === "pull") { cs.pullDone = true; refreshBench(); }
    tickerSay(text.ticker);
    await resultCard(panel, { title: text.title, lines: [text.line, `${pulls}回吸った`] });
    return;
  }

  const { score, inZone, optimal } = pullResult(T, pulls, justs, IDEAL, mode.safe);
  cs[mode.store] = { score, grade: gradeOf(score), temp: T, pulls, justs, coals, inZone, optimal, over: T > IDEAL[1], under: T < IDEAL[0] };
  scoreStep(cs, mode.store, score, mode.title);
  if (mode.store === "pull") {
    cs.pullDone = true;
    refreshBench();
    tickerSay(inZone ? "パッキー「きた〜！ 煙の立ち方が変わりましたよ〜♪」" : "パッキー「おっと、ちょっと温度が怪しいか〜！？」");
    await resultCard(panel, {
      title: "吸い出し 結果",
      lines: [
        optimal ? "最適温に合わせて提供できた" : inZone ? "適温で提供できた。最適温まであと少し" : T > IDEAL[1] ? "少し熱いまま出してしまった" : "まだぬるいまま出してしまった",
        `${pulls}回吸った`,
      ],
    });
    return;
  }
  tickerSay(inZone ? "パッキー「最後の一口まで崩れない！ 守り切ったーッ！」" : "パッキー「おっと、熱がぶれているか〜！？」");
  await resultCard(panel, {
    title: "熱管理 結果",
    lines: [
      optimal ? "最適温で、最後の一口まで守り切った" : inZone ? "適温で最後の一口まで守り切った" : T > IDEAL[1] ? "熱いまま審査員に任せてしまった" : "冷めたまま審査員に任せてしまった",
      coals ? `消耗した炭を${coals}個交換した` : "炭は交換せずに整えた",
      `${pulls}回吸った`,
    ],
  });
}
