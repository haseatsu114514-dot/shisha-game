// 吸い出し（CLAUDE.md: 最低2回・3回までは無傷・それ以上は葉が痩せる。やめ時は自分で選ぶ）
// 左右に振れる針を止めた位置で、上げ吸い／キープ／下げ吸い。中央の細い帯が「ジャスト」。
// 熱管理（大会のR3・調整）も同じ針のゲーム。「炭を交換しますか？」で個数を選び、交換した炭で温度が戻ってから、
// 温度が動き続ける中で最低1回吸って整える。3回目の吸い出しからフレーバーが傷む（TH14・TH21・TH22・TH39）。
// 温度計の一番上で焦げ、熱管理で冷え切り、赤い葉が0枚になると、その一台はダメになる（TH82）。一度に吸えるのは5回まで（TH94）。
// 吸いすぎ・過熱での吸い出しは、はじめの体力も削って疲れ（針が速く、成功帯が狭い）が付く（TH29）。
// 人によって狙いが違うので、EXCELLENT・GOOD の判定は出さない。吸うと温度計の横に上下の印だけが出る（TH36）。
// 左の作業風景に温度計、右に半円ダイヤル。左の下げ吸い=寒色→キープ→右の上げ吸い=暖色。
// TH61: 真円の半円と中央から振れる細い針。止めたら一口を吸い終えるまで固定する。
// 各帯には温度が上下することだけを添える。時間・強さは画面に書かない（TH60）。
// 熱管理では、立ち上げから吸われて消耗した炭を交換する。交換する炭はもう一度炭焼きで焼き、焼け具合で戻る熱と持ちが変わる（TH39）。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, shake } from "../core/ui.js";
import { SE, startBubbling } from "../core/audio.js";
import { stepPanel, refreshBench, tickerSay, reactAudience, setBenchTemperature, setBenchDraw, failBench, setBenchLeaf, dockBenchLeaf, strainBench, scoreStep, waitBenchReady } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys } from "./common.js";
import { burnCoals, HEAT_GRADES } from "./heat.js";

import { craftConditions, heatDelta, pullResult, isIdealTemperature, isOptimalTemperature, temperatureBands, visualTemperature, temperatureAfterSteam, pullFocusFromSteam, isBurnt, isColdOut, DANGER_TEMP, COLD_OUT } from "./conditions.js";
import { buildThermometer } from "./thermometer.js";
import { DRAW_MS, animateDraw } from "./pull-draw.js";
import { ensureFlavorLife, applyLeafDamage, leafDamagePerPull, leafDamageRatio, leafStopDrift } from "./flavor-life.js";
import { coalCount } from "./coals.js";
import { makerMixProfile } from "./temperature-model.js";
import { mixExpression } from "./flavor-profile.js";
import { createCraftClock } from "./clock.js";
import { waterComfort } from "./water.js";
import { waterComfortLine } from "./pull-water.js";

export { IDEAL } from "./conditions.js";
const HOSE_PATH = "M25.5 21.5C18 25 9 26 7.5 33s8 9.5 15 7 9-1 9.5 2.5";
const HOSE_ICON = `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="${HOSE_PATH}" stroke="currentColor" stroke-width="6.4"/>
  <path class="hose-core" d="${HOSE_PATH}" stroke-width="3.2"/>
  <path d="${HOSE_PATH}" stroke="currentColor" stroke-width="6.4" stroke-dasharray=".9 2.2" stroke-linecap="butt"/>
  <path d="M27.4 20.2 38.6 8.2" stroke="currentColor" stroke-width="5.6"/>
  <path class="hose-core" d="M29.4 18 37 9.9" stroke-width="1.6"/>
  <path d="m24.8 23 4.6-4.9" stroke="currentColor" stroke-width="8.6" stroke-linecap="butt"/>
  <path d="m31.6 15.8 1.8-1.9" stroke="currentColor" stroke-width="7.4" stroke-linecap="butt"/>
  <path d="m38.8 7.8 3.4-3.6" stroke="currentColor" stroke-width="3.2"/>
</svg>`;
// 針の位置の帯（0〜1）。下げ吸い=左、キープ=中、上げ吸い=右。芯に止めると上げ下げが強い。
export const ZONES = [
  { id: "down", from: 0, to: 0.34, just: [0.14, 0.205], label: "下げ吸い", mark: "▼", delta: -0.1, justDelta: -0.16 },
  { id: "keep", from: 0.34, to: 0.66, just: [0.468, 0.532], label: "キープ", mark: "＝", delta: 0, justDelta: 0 },
  { id: "up", from: 0.66, to: 1, just: [0.795, 0.86], label: "上げ吸い", mark: "▲", delta: 0.1, justDelta: 0.16 },
];
// 交換する炭の個数ごとの、戻ってくる熱と、その後の燃え進む速さ（0個は消耗した炭のままで早く冷える）。
const COAL_HEAT = [0, 0.06, 0.11, 0.16, .21];
const COAL_COOL = [1.6, 0.75, 0.5, 0.35, .28];
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
export { LEAF_MAX } from "./flavor-life.js";
/** TH94・TH95: 吸い出し・熱管理とも一度に吸えるのは5回まで。左の赤い葉の持ちの右に、回数を5つの点で並べる。 */
export const MAX_PULLS = 5;

const FAIL_TEXT = {
  burnt: { title: "シーシャが焦げてしまった", line: "熱が上がりきって葉が焦げた", ticker: "パッキー「ば、爆発ーッ！？ シーシャが焦げてしまったーッ！」" },
  cold: { title: "シーシャが冷え切ってしまった", line: "炭の熱が尽きて、煙が立たなくなった", ticker: "パッキー「あ、あれ〜？ 煙が……止まってしまったーッ！」" },
  leaf: { title: "フレーバーがダメになってしまった", line: "吸いすぎて、葉の香りが抜け切った", ticker: "パッキー「吸いすぎだーッ！ フレーバーが限界を迎えたーッ！」" },
};

/** 炭・熱・蒸らし・穴・詰めから、吸い出し開始時の温度を決める */
export function startTemp(cs) {
  return Number.isFinite(cs.steam?.temp) ? cs.steam.temp : temperatureAfterSteam(cs, undefined, rand(-0.03, 0.03));
}

/** 旧セッションに前工程の温度が無いときも、その一台の中心から調整を始める。 */
export function careStartTemp(cs) {
  const center = temperatureBands(cs).center;
  const previous = Number.isFinite(cs.care?.temp) ? cs.care.temp : Number.isFinite(cs.pull?.temp) ? cs.pull.temp
    : Number.isFinite(cs.practiceSource?.temperature) ? cs.practiceSource.temperature : center;
  return cs.careRound ? Math.max(.14, previous - .075) : Number.isFinite(cs.pull?.temp) ? cs.pull.temp : center;
}

const MODES = {
  pull: {
    store: "pull", title: "吸い出し", min: 2, safe: 3, drift: false, serveLabel: "提供する",
    hint: "右で温度を上げ、左で下げる。中央はキープ。吸い終えてから次の針を止めよう。緑の範囲で味を整える。低めと高めで表情が変わる葉もある。蒸らしで集中できたほど針はゆっくり動く",
    start: startTemp, focus: pullFocusFromSteam,
  },
  care: {
    store: "care", title: "熱管理", min: 1, safe: 2, drift: true, serveLabel: "整え終える",
    hint: "立ち上げから吸われ続けた炭は消耗して、温度が下がっていく。まず交換する炭の数を決め、その炭を焼いてから替える。焼け具合が良いほど温度がしっかり戻り、長く持つ。ダイヤルは吸い出しと同じで、キープなら温度を保てる。炎の印まで上がって焦げても、雪の印まで冷え切っても、その一台はダメになる",
    start: careStartTemp, focus: () => ({ slow: 1, window: 1 }),
  },
};

export function runPull(cs) { return pullGame(cs, MODES.pull); }
export async function runCare(cs, { round = 0 } = {}) {
  cs.careRound = round;
  const completed = await pullGame(cs, { ...MODES.care, title: round ? `調整 ${round}回目` : "熱管理" });
  if (completed === false) throw new Error("Care interrupted before finishing");
  if (round && cs.care) {
    cs.careHistory ??= [];
    cs.careHistory[round - 1] = { ...cs.care, coalsDetail: cs.careCoals ? { ...cs.careCoals } : null };
  }
}

async function pullGame(cs, mode) {
  await waitBenchReady(cs, mode.store);
  const tutorial = cs.mode === "tutorial";
  // 葉が傷むと適温帯が細くなるので、ダメージのたびに bands/ideal を取り直す。中心は動かないので一度だけ。
  let bands = temperatureBands(cs), ideal = bands.ideal;
  const center = bands.center;
  const maker = makerMixProfile(cs);
  const safeLimit = mode.safe + (maker.safePullsBonus || 0);
  // 熱すぎる吸引のペナルティも、緑上端〜危険帯の中の同じ相対位置で始める。
  const harshTemp = visualTemperature(.76, bands);
  const panel = stepPanel(mode.store, mode.title, tutorial
    ? "中央のキープで温度を保つ。右の上げ吸いは温度を上げ、左の下げ吸いは温度を下げる。吸い終わってから次の針を止める"
    : mode.hint);
  const gameClock = createCraftClock(panel);
  const concentration = mode.focus(cs);
  // 疲れが付くと途中から針が速く、成功帯が狭くなるので、毎回計算し直す。
  const slowNow = () => skill.slow(cs) * (tutorial ? 1.3 : 1) * concentration.slow;
  const widenNow = () => skill.window(cs) * (tutorial ? 1.4 : 1) * concentration.window;
  let widen = widenNow();
  let coreTemp = mode.start(cs);
  const initialTemp = coreTemp;
  let T = coreTemp;
  const conditions = craftConditions(cs);
  ensureFlavorLife(cs);
  setBenchLeaf(cs);
  let pulls = 0, justs = 0, failed = null, coals = null;
  // 熱管理だけ: 炭が燃え進んで熱が落ちる速さと、洞察で小さくなる揺らぎ
  const clarity = mode.drift ? skill.clarity(cs) : 1;
  const baseCool = mode.drift ? rand(0.006, 0.013) * (cs.retryAssist ? .55 : 1) : 0;
  let coolRate = 0, elapsed = 0;
  const wobblePhase = rand(0, 6.28);
  const wobble = () => (mode.drift ? conditions.sparsity * 0.05 * Math.sin(elapsed * Math.PI * 2 / 2.6) + 0.014 * (1 - 0.7 * clarity) * Math.sin(elapsed * 1.7 + wobblePhase) : 0);

  // ---- 画面
  const thermometer = buildThermometer({ cs, coldLimit: mode.drift ? COLD_OUT : null, height: 360, width: 64 });
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
  // 回数の点は表示しない（TH80）。炭・雨・少穴だけ短い札に残す。
  const tags = el("span.pull-tags");
  const readout = el("div.pull-read");
  const drawStatus = el("span.pull-draw-status", { role: "status", dataset: { test: "pull-draw-status" } });
  // TH89: 蛇腹のホースと硬い持ち手・吸い口。ペンに見えないよう、筒の太さと曲がりで描く。
  const inhale = el("span.pull-btn-icon", { "aria-hidden": "true", html: HOSE_ICON });
  const pullLabel = el("span.btn-label", { text: "吸う（針を止める）" });
  const pullBtn = el("button.btn.primary", { dataset: { test: "pull-stop" }, disabled: true }, [inhale, pullLabel]);
  const serveBtn = el("button.btn", { dataset: { test: "pull-serve" }, disabled: true }, [el("span.pull-serve-icon", { "aria-hidden": "true", html: '<svg viewBox="0 0 48 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="23" width="8" height="14" rx="1.5"/><path d="m11 26 7-6c1-1 3-1 4-1h6c2 0 3 1 3 3s-1 3-3 3h-7M11 34h16c2 0 4-1 6-2l10-7c2-1 3-4 1-6s-3-1-5 0l-8 6"/></svg>' }), el("span.btn-label", { text: mode.serveLabel })]);
  // 吸った回数の点。無傷で吸える回数を超える点は橙の枠で、吸いすぎの範囲だと分かるようにする。
  const pips = Array.from({ length: MAX_PULLS }, (_, i) => el(`i.pull-pip${i >= mode.safe ? ".over" : ""}`, { "aria-hidden": "true" }));
  const pullCount = el("b.pull-count-num");
  const counter = el("span.pull-count", { role: "img", dataset: { test: "pull-count" } }, [el("span.pull-pips", pips), pullCount]);
  const lifeLeaves = el("span.pull-life-leaves");
  const summary = el("div.pull-summary", [
    el("div.pull-life", [el("span.pull-life-label", { text: "フレーバーの持ち" }), lifeLeaves, tags, drawStatus]),
    el("div.pull-life.pull-count-box", [el("span.pull-life-label", { text: mode.drift ? "吸った回数" : "吸い出し回数" }), counter]),
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
    thermometer.preview(running && !drawing && !finished ? clamp(T + heatDelta(cs, actionAt(pos).delta), 0, 1) : null);
    if (choosing) return;
    const inZone = isIdealTemperature(T, bands);
    const expressive = bands.expressionWeight >= .999;
    const optimal = !expressive && isOptimalTemperature(T, bands);
    const position = (T - ideal[0]) / (ideal[1] - ideal[0]);
    const goodLabel = expressive ? position < .35 ? "適温・低" : position > .65 ? "適温・高" : "適温" : "適温";
    // 今の温度を短い一語で。温度計の印と同じ色にする。
    const [state, tone] = optimal ? ["最適温", "optimal"] : inZone ? [goodLabel, "ok"] : T >= DANGER_TEMP ? ["焦げる寸前！", "danger"]
      : T > ideal[1] ? ["熱い", "hot"] : mode.drift && T <= COLD_OUT + 0.08 ? ["冷え切りそう！", "cold"] : ["ぬるい", "cool"];
    readout.dataset.tone = tone;
    readout.replaceChildren(el("b.pull-state", { text: state }), mode.drift && running && !drawing ? el("span.pull-drift", { text: "↓", title: "炭が燃え進んで、熱が落ちていく" }) : "");
    tags.replaceChildren(...[
      coals != null && el("span.pull-tag", { text: coals ? `炭×${coals}` : "炭そのまま", title: coals ? `消耗した炭を${coals}個交換した` : "炭は交換していない" }),
      conditions.sparsity && el("span.pull-tag", { text: "少穴", title: "吸い方による温度変化が大きい" }),
      cs.vent === "closed" && el("span.pull-tag", { text: "蓋：閉" }),
      conditions.rainy && el("span.pull-tag", { text: "雨", title: "熱が入りづらい" }),
    ].filter(Boolean));
    pips.forEach((pip, i) => pip.classList.toggle("on", i < pulls));
    pullCount.textContent = `${pulls}/${MAX_PULLS}`;
    counter.dataset.pulls = String(pulls);
    counter.setAttribute("aria-label", `吸った回数 ${pulls}/${MAX_PULLS}回`);
    serveBtn.disabled = !running || drawing || finished || pulls < mode.min || !!failed;
    pullBtn.disabled = !running || drawing || finished || !!failed || pulls >= MAX_PULLS;
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
    const current = gameClock.now();
    const dt = Math.min(0.05, (current - last) / 1000);
    last = current;
    if (gameClock.paused) { raf = requestAnimationFrame(loop); return; }
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
    applyLeafDamage(cs.leaf, leafDamagePerPull(cs));
    // 傷んだ分だけ適温帯を取り直す。温度計側も同じダメージ量から細くなる。
    bands = temperatureBands(cs); ideal = bands.ideal;
    setBenchLeaf(cs, true);
    // 適温を合わせたときは成功の絵を保ち、消耗した葉だけで吸いすぎを示す。
    if (!isIdealTemperature(T, bands)) { SE.hit(); shake(undefined, 380); }
    if (cs.leaf.hp <= 0) fail("leaf");
  };
  // 吸いすぎ・過熱の吸い出しで、はじめが疲れる。針と成功帯にすぐ反映する（TH29）。
  const strain = () => {
    if (!strainBench(cs)) return;
    period = 1.5 * slowNow(); widen = widenNow(); placeJusts();
    if (T >= harshTemp) SE.miss();
  };
  const doPull = async (at = pos) => {
    if (failed || !running || drawing || finished || pulls >= MAX_PULLS || gameClock.paused) return;
    const before = T;
    // 葉が傷むほど、止めた針が狙いから少しずれて落ち着く（止まり方のズレ TH27）。傷が浅いうちはほぼ0。
    const landed = clamp(at + leafStopDrift(leafDamageRatio(cs.leaf), rand(-1, 1)), 0, 1);
    const { z, isJust, delta } = actionAt(landed);
    drawing = true;
    cancelAnimationFrame(raf);
    moveNeedle(landed);
    pulls++;
    const duration = autoSkill() ? 120 : DRAW_MS[z.id];
    const from = coreTemp, to = clamp(from + heatDelta(cs, delta), 0, 1), sway = T - coreTemp;
    play.dataset.draw = z.id;
    play.style.setProperty("--draw-duration", `${duration}ms`);
    pullLabel.textContent = "吸っている…";
    drawStatus.textContent = `${z.label}で吸っている…`;
    setBenchDraw(cs, z.id, duration);
    const strength = (z.id === "keep" ? .65 : 1) * waterComfort(cs.water).bubble;
    // startBubbling は strength=0 を1に置き換えるため、水に届かない台では開始しない。
    stopBubbles = strength > 0 ? startBubbling({ strength }) : () => {};
    render();
    try {
      const complete = await animateDraw({ duration,
        paused: () => gameClock.paused,
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
      const overdone = pulls > safeLimit;
      reactAudience(cs, isIdealTemperature(T, bands) ? "good" : Math.abs(T - center) > Math.abs(before - center) ? "bad" : "good");
      thermometer.pop(z.id === "keep" ? z.mark : isJust ? z.mark.repeat(2) : z.mark, z.id);
      if (overdone || T >= harshTemp) strain();
      if (overdone) { damageLeaf(); if (failed) return; }
    } finally {
      stopBubbles();
      setBenchDraw(cs, null);
      drawing = false;
      delete play.dataset.draw;
      pullLabel.textContent = "吸う（針を止める）";
      drawStatus.textContent = "";
      if (!failed && !finished && !abandoned && play.isConnected) {
        render();
        last = gameClock.now();
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
    const lead = el("p.care-coals-lead", { text: (cs.careRound > 1
      ? "お客さんが吸い続け、再び炭が消耗して温度が下がってきた。もう一度整えよう"
      : "提供して約20分。お客さんが吸ううちに炭が消耗し、温度が下がってきた。調整しよう")
      + "。炭を選ぶ間は時間が止まるので、急がなくていい" });
    // 説明文の代わりに、温度計と同じ印で戻る熱を示す（▲が多いほど戻る。交換しないと ↓ 落ちていく）。
    const options = Array.from({ length: coalCount(cs) + 1 }, (_, i) => i);
    const buttons = el("div.care-coal-btns", options.map((n) => el("button.btn.care-coal", {
      dataset: { test: `care-coal-${n}` }, onclick: () => pick(n),
      title: n ? `消耗した炭を${n}個、焼いた炭に交換する。温度が${["", "少し", "そこそこ", "しっかり", "強く"][n]}戻る` : "消耗した炭のまま。温度は落ちていく",
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
      const best = options.slice().sort((a, b) => Math.abs(T + heatDelta(cs, COAL_HEAT[a]) - center - 0.02) - Math.abs(T + heatDelta(cs, COAL_HEAT[b]) - center - 0.02))[0];
      setTimeout(() => pick(auto === "good" ? best : auto === "burn" ? 3 : 0), 60);
    }
    coals = await picked;
    thermometer.preview(null);
    buttons.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    SE.select();
    coolRate = baseCool * COAL_COOL[coals];
    if (!coals) {
      cs.careCoals = { count: 0, picks: [] };
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
    SE.coalPlace();
    const from = coreTemp, add = heatDelta(cs, COAL_HEAT[coals] * coalHeatFactor(picks)), started = gameClock.now(), dur = autoSkill() ? 200 : 1400;
    for (;;) {
      const k = Math.min(1, (gameClock.now() - started) / dur);
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
  const finish = () => { if (!serveBtn.disabled && !gameClock.paused) { finished = true; serve(); } };
  serveBtn.addEventListener("click", finish);
  const unkey = keys({ " ": (e) => !e.repeat && doPull(), Space: (e) => !e.repeat && doPull(), Enter: (e) => !e.repeat && finish() });

  render();
  if (mode.drift) await prepareCoals();
  if (!failed) {
    render();
    await countdown();
    running = true;
    last = gameClock.now();
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
          const diff = center - T, response = Math.abs(heatDelta(cs, .18));
          const keep = clamp(.5 + diff / response, .341, .659);
          const candidates = [.141, .3, keep, .75, .796];
          at = candidates.sort((a, b) => Math.abs(T + heatDelta(cs, actionAt(a).delta) - center) - Math.abs(T + heatDelta(cs, actionAt(b).delta) - center))[0];
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
  gameClock.dispose();
  running = false; finished = true;
  cancelAnimationFrame(raf);
  stopBubbles();
  setBenchDraw(cs, null);
  render();
  unkey();
  if (abandoned) return false;
  if (failed) {
    const text = FAIL_TEXT[failed];
    readout.textContent = `${text.title}……！`;
    await failBench(cs, failed);
    cs[mode.store] = { score: 0, grade: gradeOf(0), temp: T, startTemp: initialTemp, pulls, justs, coals, inZone: false, optimal: false, over: failed === "burnt", under: failed === "cold", failed };
    cs.failed = failed;
    scoreStep(cs, mode.drift && cs.careRound ? `care${cs.careRound}` : mode.store, 0);
    if (failed === "burnt") cs.burnt = true;
    if (mode.store === "pull") { cs.pullDone = true; refreshBench(); }
    tickerSay(text.ticker);
    await resultCard(panel, { title: text.title, lines: [text.line, waterComfortLine(cs.water), `${pulls}回吸った`] });
    return true;
  }

  const { score, inZone, optimal } = pullResult(T, pulls, justs, bands, safeLimit);
  const expression = mixExpression(cs, T);
  const tasteLine = `今回：${expression.label} ／ 甘い印象 ${expression.values.sweetness.toFixed(1)}・清涼 ${expression.values.cooling.toFixed(1)}（強さ／10）`;
  cs[mode.store] = { score, grade: gradeOf(score), temp: T, startTemp: initialTemp, pulls, justs, coals, inZone, optimal, over: T > ideal[1], under: T < ideal[0] };
  scoreStep(cs, mode.drift && cs.careRound ? `care${cs.careRound}` : mode.store, score, mode.title);
  if (mode.store === "pull") {
    cs.pullDone = true;
    refreshBench();
    tickerSay(inZone ? "パッキー「きた〜！ 煙の立ち方が変わりましたよ〜♪」" : "パッキー「おっと、ちょっと温度が怪しいか〜！？」");
    await resultCard(panel, {
      title: "提供",
      summary: ["お客さんへシーシャを提供した。しばらく吸ってもらおう"],
      lines: [
        inZone && bands.expressionWeight >= .999 ? "適温で、味の表情を整えて提供できた" : optimal ? "最適温に合わせて提供できた" : inZone ? "適温で提供できた" : T > ideal[1] ? "少し熱いまま出してしまった" : "まだぬるいまま出してしまった",
        tasteLine,
        waterComfortLine(cs.water),
        `${pulls}回吸った`,
      ],
    });
    return true;
  }
  tickerSay(inZone ? "パッキー「最後の一口まで崩れない！ 守り切ったーッ！」" : "パッキー「おっと、熱がぶれているか〜！？」");
  await resultCard(panel, {
    title: `${mode.title} 結果`,
    lines: [
      inZone ? "適温に整えて、審査員へ戻せた" : T > ideal[1] ? "熱いまま審査員に任せてしまった" : "冷めたまま審査員に任せてしまった",
      tasteLine,
      waterComfortLine(cs.water),
      coals ? `消耗した炭を${coals}個交換した` : "炭は交換せずに整えた",
      `${pulls}回吸った`,
    ],
  });
  return true;
}
