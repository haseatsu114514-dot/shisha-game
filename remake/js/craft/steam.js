// 蒸らし ── 雑念を躱す（CLAUDE.md: 蒸らしミニゲームは雑念弾幕。「覚悟＋締め」には戻さない）
// 選んだ蒸らし時間のあいだ、飛んでくる雑念（言葉と物体）を心(♥)で避け続ける。被弾が少ないほど良い。
import { state } from "../core/state.js";
import { hasAttackTraining } from "./attack-training.js";
import { el, sleep, clamp, rand, pick } from "../core/util.js";
import { createCraftClock } from "./clock.js";
import { countdown, shake } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { tier01, step } from "../core/stats.js";
import { growthPerks, growthSkill, growthFeature, growthLesson, settleGrowthPhase, LESSON_TUNING, SKILL_TUNING } from "../core/growth-effects.js";
import { REFRESH_RADII, REFRESH_LABELS, refreshRestoresMental } from "../core/stat-step-tables.js";
import { stepPanel, refreshBench, reactAudience, setPlayerMental, setBenchTemperature, scoreStep, waitBenchReady, explainTutorialStep, benchRoot } from "./session.js";
import { steamSecondsOf, steamPlaySeconds, steamTimeLabel, SHORT_DODGE_SECONDS } from "./steam-time.js";
import { buildDigitalClock } from "./digital-clock.js";
import { autoSkill, resultCard, keys, popStamp } from "./common.js";
import { craftConditions, temperatureAfterSteam } from "./conditions.js";
import { buildSteamTemperature } from "./steam-forecast.js";
import { steamClimate } from "./steam-climate.js";
import { buildSteamWorld, HEART_ART, BULLET_ART } from "./steam-art.js";
import { makingUrl } from "../core/data.js";
import { buildMentalTrace } from "./mental.js";
import { craftCondition } from "../core/condition.js";
import { SLASH_ART, SLASH_RECHARGE_SECONDS, slashProfile, slashAngle, slashTouchesBullet, buildSlashFx, buildWordCutFx, buildSharkFx, sharkPulseTouchesBullet } from "./steam-slash.js";
import { HEART_SIZE, heartHitRadius, heartTouchesBullet } from "./steam-heart.js";
import { effectVisible, effectBadge, effectLine } from "./effect-visual.js";

// 雑念ははじめ自身の内心。自主練でも、その場に他の人物がいる前提にしない。
export const DODGE_WORDS = [
  "ちゃんと熱、入ってるかな", "時間が足りないかも", "少し急ぎすぎたかな",
  "失敗したらどうしよう", "うまく作れるかな", "詰め方、これでよかった？", "炭、熾きてたかな",
  "詰めすぎたか？", "灰、落ちないか", "穴、足りてたかな", "温度、大丈夫か",
  "香り、飛んでないか", "手が、汗ばむ", "時間ばかり気になる", "深呼吸、わすれてた",
  "熱、強すぎないかな", "煙、ちゃんと出るかな", "さっきの手順、大丈夫か", "吸い出しで崩したくない",
];
const OBJECTS = ["coal", "orb", "orb", "smoke"];

// SF63: 一度に1回分を持ち、使用後8秒でリチャージ。根性は範囲と回復に効く。
export const REFRESH_RECHARGE_SECONDS = 8;
// dodge枠は784×414px。根性1段の半径90pxから10段の画面全体まで広がる。
export function refreshStock() { return growthSkill(state, "K06") ? 2 : 1; }
export function refreshEffect(cs = null) {
  const level = step("guts");
  return { radius: REFRESH_RADII[level - 1] + (growthPerks(state)?.breath || 0),
    mentalRecovery: refreshRestoresMental(level) || growthFeature(state, "mental") || cs?.mode === "tournament" && growthSkill(state, "K13"),
    label: REFRESH_LABELS[level - 1] };
}

/** 旧根性の縮小分に、盤の「かわし」の縮小分を足す。保存値への書き戻しはしない。 */
export function steamHeartRadius(focus = 1) {
  return heartHitRadius(tier01("guts"), focus)
    - heartHitRadius(0, focus) * (growthPerks(state)?.dodge || 0) / 100;
}

export async function runSteamDodge(cs) {
  const owner = state;
  await waitBenchReady(cs, "steam");
  const root = benchRoot(cs);
  if (state !== owner || !root) return;
  SE.coalPlace();
  const stock = refreshStock();
  const effect = refreshEffect(cs);
  const tutorial = cs.mode === "tutorial";
  const eased = tutorial || cs.retryAssist;
  const seconds = steamSecondsOf(cs), min = seconds / 60;
  const rainy = craftConditions(cs).rainy;
  if (seconds === 0 && cs.zeroSteam === true && !tutorial && growthLesson(state,"M-W4")) {
    const panel = stepPanel("steam", "0分蒸らし", "蒸らさず、低温から吸って立ち上げる");
    const temp = temperatureAfterSteam(cs,0,cs.steamVariation ?? 0);
    cs.steam = { min:0, seconds:0, temp, hits:0, score:100, refreshesUsed:0, slashesUsed:0, wordsCut:0, combo:0, maxCombo:0, zeroSteam:true };
    // 回避をしていないので、次の工程のジャストボーナスは作らない。
    settleGrowthPhase(state,cs,"steam",cs.steam,false);
    scoreStep(cs,"steam",cs.steam.score); setBenchTemperature(cs,temp); refreshBench();
    await resultCard(panel,{title:"0分蒸らし",lines:["待たずに立ち上げる。吸い出しで低温から熱を運ぼう"]});
    return;
  }
  const panel = stepPanel("steam", "蒸らし", "アタックはZ／ボタンで上側の前方を斬る。移動中も向きは変わらない。コンボが3・6になると刃が水色→紫→金に変わり、範囲が広がって再使用も早くなる。小さな物体弾も斬れる。被弾するとコンボは途切れる。空振り・リフレッシュでは維持し、次の蒸らしでは0から始まる。", { brief: "" });
  const isCurrent = () => state === owner && benchRoot(cs) === root && panel.dataset.step === "steam";
  const W = 784, H = 414;
  const box = el("div.dodge", { style: { width: `${W}px`, height: `${H}px` }, dataset: { test: "dodge", mental: "steady", refreshRadius: String(effect.radius) } });
  const heart = el(`div.dodge-heart${effectVisible("guts") ? ".guts-visible" : ""}`, { role: "img", "aria-label": "心。中央の白丸が当たり判定", style: { transform: `translate(${W / 2 - 14}px, ${H / 2 - 14}px)` } }, [el("span", { html: HEART_ART }), el("i.dodge-core"), effectBadge("guts", "根")]);
  const clock = buildDigitalClock("dodge-timer", { label: "蒸らしの残り時間", test: "steam-clock" });
  const knob = el("i.dodge-knob");
  const controlArt = name => el("img", { src: makingUrl(name), alt: "", draggable: false, "aria-hidden": "true" });
  const pad = el("div.dodge-pad", { tabindex: 0, role: "group", "aria-label": "移動スティック。ドラッグまたは矢印キーで移動", dataset: { test: "dodge-pad" } }, [el("span", { "aria-hidden": "true" }, [controlArt("steam_stick_simple_base.png")]), knob]);
  const refreshBtn = el("button.btn.primary.dodge-action.dodge-refresh", { disabled: true, dataset: { test: "dodge-refresh" } });
  const refreshCharge = el("span.action-recharge");
  const refreshCopy = el("span.refresh-copy", { text: "リフレッシュ" });
  refreshBtn.append(el("span.refresh-emblem", { "aria-hidden": "true" }, [controlArt("steam_refresh_simple.png"), el("i.recharge-ring"), refreshCharge]),
    refreshCopy);
  const slashCharge = el("span.action-recharge");
  const slashCount = el("span.slash-count", { text: "×0" });
  const slashGrowth = el("span.slash-growth", [slashCount]);
  const slashFeedback = el("span.slash-feedback", { role: "status", "aria-live": "polite", "aria-atomic": "true", dataset: { test: "slash-feedback" } });
  const slashLock = el("span.slash-lock", { text: "🔒", "aria-hidden": "true", dataset: { test: "slash-lock" } });
  const slashBtn = el("button.btn.dodge-action.dodge-slash", { disabled: true, "aria-keyshortcuts": "Z", title: "Z／ボタンで前方へアタック", dataset: { test: "dodge-slash", uses: "0" } }, [
    el("span.refresh-emblem", { "aria-hidden": "true" }, [el("span", { html: SLASH_ART }), el("i.recharge-ring"), slashCharge, slashGrowth, slashLock]),
    el("span.refresh-copy", { text: "アタック" }),
  ]);
  const slashControl = el("div.slash-control", [slashBtn, slashFeedback]);
  const precisionState = el("span.precision-state", { text: "オフ", "aria-hidden": "true" });
  const precisionBtn = el("button.btn.dodge-action.dodge-precision", { disabled: true, "aria-pressed": "false", dataset: { test: "dodge-precision" } }, [
    el("span.refresh-emblem", { "aria-hidden": "true" }, [controlArt("steam_precision_simple.png")]),
    el("span.precision-copy", [el("span.refresh-copy", { text: "精密" }), precisionState]),
  ]);
  const thermometer = buildSteamTemperature(cs);
  const heatJitter = cs.steamVariation ?? { offset: rand(-.065, .065), transfer: rand(.9, 1.1) };
  const mental = buildMentalTrace(W, H);
  const world = buildSteamWorld(W, H);
  const renderTemperature = (temp) => { thermometer.update(temp); setBenchTemperature(cs, temp); };
  renderTemperature(temperatureAfterSteam(cs, 0, heatJitter));
  box.append(world.root, clock.root, mental.root, heart);
  const steamRoot = el("div.steam", [
    el("div.steam-play", [box]),
    el("div.dodge-controls", [refreshBtn, slashControl, precisionBtn, pad]),
    thermometer.root,
  ]);
  panel.append(steamRoot);

  // B08: 既習プレイヤーが短縮を選んだときは遊ぶ尺だけ縮める。弾の密度・採点・温度は変わらない。
  let dur = steamPlaySeconds(seconds) * (tutorial ? 0.7 : 1);
  if (cs.steamShorten && !tutorial) dur = Math.min(dur, SHORT_DODGE_SECONDS);
  const focus = craftCondition(cs).focus;
  const hitR = steamHeartRadius(focus);
  heart.style.setProperty("--heart-size", `${HEART_SIZE}px`);
  heart.style.setProperty("--hit-diameter", `${hitR * 2}px`);
  const spawnEvery = (eased ? 0.85 : 0.46) * (1 + 0.25 * tier01("insight")) * focus;
  let hx = W / 2, hy = H / 2, hits = 0, inv = 0, refreshes = stock;
  let refreshesUsed = 0, refreshReadyAt = 0, slashesUsed = 0, slashReadyAt = 0;
  let wordsCut = 0, totalWordsCut = 0, maxCombo = 0, slashCooldown = SLASH_RECHARGE_SECONDS;
  let afterglowUntil = 0, afterglows = 0, sharkPulses = 0;
  const shark = hasAttackTraining(state.flags) && growthLesson(state,"M-W7");
  let running = false, precise = false, time = 0, nextSpawn = 0.8, nextWave = tutorial ? 4 : 2.8;
  let warning = null, spawnCount = 0, raf = 0;
  const bullets = [], keysDown = new Set();
  const transients = [];
  const input = new AbortController();
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: input.signal });
  let padPointer = null, axisX = 0, axisY = 0;

  const renderHeart = () => { heart.style.transform = `translate(${hx - 14}px, ${hy - 14}px)`; };
  const moveTo = (x, y) => { hx = clamp(x, 16, W - 16); hy = clamp(y, 16, H - 16); renderHeart(); };
  const toLocal = (e) => {
    const r = box.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  };
  listen(box, "pointerdown", (e) => {
    if (!running) return;
    e.preventDefault(); box.setPointerCapture(e.pointerId); moveTo(...toLocal(e));
  });
  listen(box, "pointermove", (e) => { if (running && (e.buttons || e.pointerType === "mouse")) moveTo(...toLocal(e)); });

  const movePad = (e) => {
    const r = pad.getBoundingClientRect(), radius = r.width * 0.34;
    let x = (e.clientX - r.left - r.width / 2) / radius;
    const lift = parseFloat(getComputedStyle(pad).getPropertyValue("--stick-lift")) || 0;
    let y = (e.clientY - r.top - r.height / 2 + lift * r.height / pad.offsetHeight) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    axisX = Math.abs(x) < 0.12 ? 0 : x;
    axisY = Math.abs(y) < 0.12 ? 0 : y;
    knob.style.transform = `translate(${x * 26}px, ${y * 26}px)`;
  };
  const resetPad = () => { padPointer = null; axisX = axisY = 0; knob.style.transform = ""; pad.classList.remove("held"); };
  listen(pad, "pointerdown", (e) => {
    if (!running || padPointer !== null) return;
    e.preventDefault(); padPointer = e.pointerId; pad.setPointerCapture(e.pointerId); pad.classList.add("held"); movePad(e);
  });
  listen(pad, "pointermove", (e) => { if (e.pointerId === padPointer) movePad(e); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(pad, type, (e) => { if (e.pointerId === padPointer) resetPad(); });
  listen(window, "blur", () => { keysDown.clear(); resetPad(); });
  const togglePrecision = () => {
    if (!running) return;
    precise = !precise;
    precisionBtn.setAttribute("aria-pressed", String(precise));
    precisionState.textContent = precise ? "オン" : "オフ";
    SE.click();
  };
  // 2本目の指ではブラウザのclickが出ないことがある。refreshと同じく押した時に処理する。
  listen(precisionBtn, "pointerdown", e => { e.preventDefault(); togglePrecision(); });
  listen(precisionBtn, "click", e => { if (e.detail === 0) togglePrecision(); });

  const removeBullets = (touches) => {
    const cleared = [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (touches(b)) { cleared.push(b); b.node.remove(); bullets.splice(i, 1); }
    }
    return cleared;
  };
  const clearBullets = (radius = Infinity) => removeBullets(b => Math.hypot(hx - clamp(hx, b.x, b.x + b.w), hy - clamp(hy, b.y, b.y + b.h)) <= radius);
  const rechargeLabel = (button, caption, remaining, duration, label) => {
    const rounded = Math.ceil(remaining * 10) / 10;
    button.dataset.cooldown = rounded.toFixed(1);
    button.dataset.cooling = String(running && remaining > 0);
    button.style.setProperty("--recharge", String(1 - remaining / duration));
    caption.textContent = running && rounded > 0 ? `${rounded.toFixed(1)}秒` : "";
    button.setAttribute("aria-label", `${label}。${!running ? "操作停止中" : remaining > 0 ? `再使用まで${rounded.toFixed(1)}秒` : "使用可能"}`);
    button.disabled = !running || remaining > 0;
  };
  const refreshLabel = () => {
    refreshBtn.dataset.remaining = String(refreshes);
    refreshCopy.textContent = stock > 1 ? `リフレッシュ ×${refreshes}` : "リフレッシュ";
    rechargeLabel(refreshBtn, refreshCharge, refreshes > 0 ? 0 : Math.max(0, refreshReadyAt - time), REFRESH_RECHARGE_SECONDS,
      `リフレッシュ。${effect.label}の雑念を消す${stock > 1 && refreshes === 1 ? "。2回目は半分の範囲" : ""}`);
  };
  const slashLabel = () => {
    const profile = slashProfile(wordsCut), remaining = Math.max(0, slashReadyAt - time);
    rechargeLabel(slashBtn, slashCharge, remaining, slashCooldown,
      `アタック。上側の前方の雑念を斬る。移動中も方向は固定。Zキーでも使用。コンボ${wordsCut}。射程${profile.reach}px、リチャージ${profile.recharge}秒`);
    const learned = hasAttackTraining(state.flags);
    slashBtn.dataset.locked = String(!learned);
    slashLock.hidden = learned;
    slashBtn.title = learned ? "Z／ボタン／標準ゲームパッド下ボタンでアタック" : "アタック：使用不可";
    if (!learned) {
      slashBtn.disabled = true;
      slashBtn.setAttribute("aria-label", "アタック。使用不可");
    }
    slashBtn.dataset.cutWords = String(wordsCut);
    slashBtn.dataset.totalWordsCut = String(totalWordsCut);
    slashBtn.dataset.maxCombo = String(maxCombo);
    slashBtn.dataset.reach = String(profile.reach);
    slashBtn.dataset.recharge = String(profile.recharge);
    slashBtn.dataset.tier = String(profile.tier);
    slashCount.textContent = `×${wordsCut}`;
    slashCharge.textContent = running && remaining > 0 ? (Math.ceil(remaining * 10) / 10).toFixed(1) : "";
  };
  const refresh = () => {
    if (!running || refreshes === 0) return;
    refreshes--; refreshesUsed++; refreshReadyAt = time + REFRESH_RECHARGE_SECONDS;
    const festa = growthLesson(state, "M-B6") && !cs.festaRefreshUsed;
    if (festa) cs.festaRefreshUsed = true;
    const radius = festa ? Infinity : stock > 1 && refreshes === 0
      ? (Number.isFinite(effect.radius) ? effect.radius : Math.hypot(W, H)) / 2 : effect.radius;
    world.dissolve(time, clearBullets(radius));
    if (effect.mentalRecovery) setPlayerMental(cs, mental.recoverStep(time, hits));
    reactAudience(cs, "good");
    const reach = Number.isFinite(radius) ? radius : Math.hypot(W, H);
    const fx = el(`div.dodge-refresh-fx${effectVisible("guts") ? ".guts-visible" : ""}`, { "aria-hidden": "true", style: { "--x": `${hx}px`, "--y": `${hy}px`, "--reach": `${reach}px` } }, [
      el("i.dr-flash"), el("i.dr-ring"), el("i.dr-ring.second"),
      ...Array.from({ length: 8 }, (_, i) => el("i.dr-ray", { style: { "--angle": `${i * 45}deg` } })),
    ]);
    box.append(fx); transients.push({ node: fx, until: time + .95 });
    if (effect.mentalRecovery && effectVisible("guts")) {
      const recoveryLine = el("span.effect-line.effect-guts.dodge-guts-recovery", [effectBadge("guts", "根"), el("span", { text: "根性で持ち直した" })]);
      box.append(recoveryLine);
      setTimeout(() => recoveryLine.remove(), 1100);
    }
    SE.whoosh(); SE.just(); refreshLabel();
  };
  listen(refreshBtn, "pointerdown", (e) => { e.preventDefault(); refresh(); });
  // キーボードや支援技術による click でも使える（pointerdown と重ねて消費しない）。
  listen(refreshBtn, "click", (e) => { if (e.detail === 0) refresh(); });
  const slash = () => {
    if (!running || !hasAttackTraining(state.flags) || time < slashReadyAt) return;
    const direction = "u", angle = slashAngle(direction);
    const before = slashProfile(wordsCut);
    const cleared = removeBullets(b => slashTouchesBullet(b,hx,hy,angle,before.reach,shark?Math.PI/2:undefined));
    let cutWords=cleared.filter(b=>b.word).length;
    const pulse=shark&&Math.floor((wordsCut+cutWords)/3)>Math.floor(wordsCut/3);
    if(pulse){
      const extra=removeBullets(b=>sharkPulseTouchesBullet(b,hx,hy,before.reach*LESSON_TUNING.sharkRadius));
      cleared.push(...extra);cutWords+=extra.filter(b=>b.word).length;sharkPulses++;
    }
    const beforeCuts = wordsCut;
    wordsCut += cutWords; totalWordsCut += cutWords; maxCombo = Math.max(maxCombo, wordsCut);
    if (growthSkill(state,"K22") && Math.floor(wordsCut/3) > Math.floor(beforeCuts/3)) {
      afterglowUntil = time + SKILL_TUNING.afterglowSeconds; afterglows++;
    }
    const after = slashProfile(wordsCut);
    slashCooldown = after.recharge;
    slashesUsed++; slashReadyAt = time + slashCooldown;
    slashBtn.dataset.uses = String(slashesUsed); slashBtn.dataset.direction = direction;
    slashBtn.dataset.lastCut = String(cleared.length);
    slashFeedback.dataset.hit = String(cleared.length > 0);
    slashFeedback.textContent = cleared.length ? `${cleared.length}個${shark?"噛んだ":"斬った"}${pulse?"・大きく噛みついた！":after.tier > before.tier ? "・強化！" : ""}` : "空振り";
    world.dissolve(time, cleared, { echoWords: false });
    const fx = shark?buildSharkFx(hx,hy,angle,before.reach*(pulse?LESSON_TUNING.sharkRadius:1),pulse):buildSlashFx(hx, hy, angle, before.reach, cleared.length > 0, after.tier);
    box.append(fx); transients.push({ node: fx, until: time + .32 });
    for (const b of cleared) {
      if (b.word) {
        const halves = buildWordCutFx(b, hx, hy, angle, before.reach);
        box.append(halves); transients.push({ node: halves, until: time + .5 });
      }
      const spark = el("i.dodge-slash-impact", { "aria-hidden": "true", style: { left: `${clamp(b.x + b.w / 2, 0, W)}px`, top: `${clamp(b.y + b.h / 2, 0, H)}px` } });
      box.append(spark); transients.push({ node: spark, until: time + .32 });
    }
    slashBtn.classList.remove("striking"); void slashBtn.offsetWidth; slashBtn.classList.add("striking");
    if (cleared.length) SE.just();
    SE.whoosh(); slashLabel();
  };
  listen(slashBtn, "pointerdown", e => { e.preventDefault(); slash(); });
  listen(slashBtn, "click", e => { if (e.detail === 0) slash(); });
  const direction = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d" };
  const unkey = keys(Object.fromEntries([
    ...Object.entries(direction).map(([key, value]) => [key, () => { if (running) keysDown.add(value); }]),
    [" ", (e) => { if (!e.repeat) refresh(); }],
    ["x", (e) => { if (!e.repeat) refresh(); }],
    ["X", (e) => { if (!e.repeat) refresh(); }],
    ["z", (e) => { if (!e.repeat) slash(); }],
    ["Z", (e) => { if (!e.repeat) slash(); }],
  ]), { actionSpace: true });
  listen(window, "keyup", (e) => keysDown.delete(direction[e.key]));

  const addBullet = (type, x, y, angle, speed) => {
    if (bullets.length >= 90) return;
    const word = type === "word";
    const node = el(word ? "div.dodge-word" : `div.dodge-object.${type}`, word ? { text: pick(DODGE_WORDS) } : { "aria-hidden": "true", html: BULLET_ART[type] });
    box.append(node);
    // 実際の書体とサイズで判定する。長い言葉の見えない先端に当たらないように。
    const w = node.offsetWidth, h = node.offsetHeight;
    x -= w / 2; y -= h / 2;
    node.style.transform = `translate(${x}px, ${y}px)`;
    bullets.push({ node, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w, h, word });
  };
  const spawn = () => {
    const side = Math.floor(rand(0, 4));
    const x = side === 0 ? -24 : side === 1 ? W + 24 : rand(20, W - 20);
    const y = side === 2 ? -24 : side === 3 ? H + 24 : rand(20, H - 20);
    const angle = Math.atan2(hy - y, hx - x), speed = rand(140, 190) * (eased ? 0.7 : 1);
    const isWord = spawnCount++ % 5 !== 4;
    if (isWord) addBullet("word", x, y, angle, speed * 0.8);
    else {
      const count = eased ? 1 : 2;
      const type = pick(OBJECTS);
      for (let i = 0; i < count; i++) addBullet(type, x, y, angle + (i - (count - 1) / 2) * 0.24, speed);
    }
  };
  const launchWave = ({ side, gap }) => {
    const lanes = 9;
    for (let i = 0; i < lanes; i++) {
      if (Math.abs(i - gap) <= 1) continue; // 予告を見て移動できる広さの安全な通り道
      addBullet(i % 2 ? "word" : "orb", side ? W + 20 : -20, (i + 0.5) * H / lanes, side ? Math.PI : 0, eased ? 140 : 205);
    }
    box.classList.remove("warning");
  };

  clock.update(seconds);
  refreshLabel();
  slashLabel();
  try {
    if (!await explainTutorialStep(cs, "steam") || !isCurrent()) return;
    await countdown();
    if (!isCurrent()) return;
    running = true; precisionBtn.disabled = false; refreshLabel(); slashLabel();
    const auto = autoSkill();
    if (auto) { await sleep(200); hits = auto === "good" ? 0 : 4; }
    else await new Promise((resolve) => {
      const gameClock = createCraftClock(panel);
      let last = gameClock.now();
      const pressedPads = new Set();
      const pollAttackPad = enabled => {
        const pads = navigator.getGamepads?.() || [];
        for (let i = 0; i < pads.length; i++) {
          const pressed = pads[i]?.mapping === "standard" && pads[i].buttons[0]?.pressed;
          if (pressed && !pressedPads.has(i) && enabled) slash();
          if (pressed) pressedPads.add(i); else pressedPads.delete(i);
        }
      };
      pollAttackPad(false);

      const loop = (now) => {
        if (!isCurrent()) { gameClock.dispose(); return resolve(); }
        const current = gameClock.now();
        const dt = Math.min(0.05, (current - last) / 1000); last = current;
        pollAttackPad(!gameClock.paused);
        if (gameClock.paused) { raf = requestAnimationFrame(loop); return; }
        time += dt;
        if (!refreshes && time >= refreshReadyAt) refreshes = stock;
        refreshLabel(); slashLabel();
        renderTemperature(temperatureAfterSteam(cs, Math.min(1, time / dur) * seconds, heatJitter));
        let x = axisX + (keysDown.has("r") ? 1 : 0) - (keysDown.has("l") ? 1 : 0);
        let y = axisY + (keysDown.has("d") ? 1 : 0) - (keysDown.has("u") ? 1 : 0);
        const length = Math.max(1, Math.hypot(x, y));
        if (padPointer === null) knob.style.transform = x || y ? `translate(${x / length * 26}px, ${y / length * 26}px)` : "";
        const speed = precise ? 120 : 290;
        moveTo(hx + x / length * speed * dt, hy + y / length * speed * dt);
        if (time >= nextSpawn && time < dur - 0.8) { spawn(); nextSpawn = time + spawnEvery * rand(0.8, 1.15) * (1 - 0.2 * time / dur); }
        if (time >= nextWave && time < dur - 2) {
          warning = { side: Math.round(rand(0, 1)), gap: Math.floor(rand(2, 7)), due: time + 0.75 };
          box.classList.add("warning"); box.dataset.side = warning.side ? "right" : "left";
          nextWave = time + (eased ? 4 : 2.8);
        }
        if (warning && time >= warning.due) { launchWave(warning); warning = null; }
        inv = Math.max(0, inv - dt); heart.classList.toggle("shield", inv > 0);
        const afterglow = time < afterglowUntil;
        box.dataset.afterglow = String(afterglow);
        box.classList.toggle("afterglow",afterglow);
        box.dataset.bulletSpeed = String(afterglow ? SKILL_TUNING.afterglowSpeed : 1);
        const bulletDt = dt * (afterglow ? SKILL_TUNING.afterglowSpeed : 1);
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]; b.x += b.vx * bulletDt; b.y += b.vy * bulletDt;
          b.node.style.transform = `translate(${b.x}px, ${b.y}px)`;
          if (!inv && heartTouchesBullet(b, hx, hy, hitR)) {
            hits++; inv = 0.9;
            wordsCut = 0;
            slashFeedback.textContent = "被弾。コンボが途切れた";
            slashLabel();
            setPlayerMental(cs, mental.hit(time, hits));
            reactAudience(cs, "miss");
            heart.classList.remove("hit"); void heart.offsetWidth; heart.classList.add("hit");
            SE.hit(); shake(box, 180);
            b.node.remove(); bullets.splice(i, 1); continue;
          }
          if (b.x + b.w < -60 || b.x > W + 60 || b.y + b.h < -60 || b.y > H + 60) { b.node.remove(); bullets.splice(i, 1); }
        }
        clock.update(Math.max(0, Math.ceil((dur - time) * seconds / dur)));
        const level = mental.update(time, hits);
        setPlayerMental(cs, level); box.dataset.mental = level;
        world.draw(time, hx, hy, bullets, warning, level);
        for (let i = transients.length - 1; i >= 0; i--) {
          if (time >= transients[i].until) { transients[i].node.remove(); transients.splice(i, 1); }
        }
        if (time >= dur) { gameClock.dispose(); return resolve(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
  } finally {
    running = false; precisionBtn.disabled = true; cancelAnimationFrame(raf); unkey(); input.abort(); resetPad(); clearBullets(); refreshLabel(); slashLabel();
    transients.forEach(({ node }) => node.remove());
    world.draw(time + 1, hx, hy);
    heart.classList.remove("shield"); box.classList.remove("warning");
    setPlayerMental(cs, "steady");
    if (!isCurrent() && panel.dataset.step === "steam") {
      root.querySelector(".bench-guide").open = false;
      panel.inert = false; root.dataset.helpPaused = "false";
    }
  }
  if (!isCurrent()) return;
  const score = clamp(100 - hits * 14, 0, 100);
  clock.update(0);
  const temp = temperatureAfterSteam(cs, seconds, heatJitter);
  renderTemperature(temp);
  cs.steam = { min, seconds, temp, hits, score, refreshesUsed, slashesUsed, wordsCut: totalWordsCut, combo: wordsCut, maxCombo, afterglows, sharkPulses, warmingFactor: steamClimate(cs.environment).transfer };
  settleGrowthPhase(state, cs, "steam", cs.steam, hits === 0);
  scoreStep(cs, "steam", cs.steam.score, "蒸らし");
  refreshBench();
  popStamp(panel, hits === 0 ? "無心" : hits <= 2 ? "持ちこたえた" : "雑念まみれ", hits === 0 ? "just" : hits <= 2 ? "good" : "bad", "50%", "40%");
  await sleep(400);
  if (!isCurrent()) return;
  await resultCard(panel, {
    title: "蒸らし 結果",
    lines: [
      rainy ? "雨の日は熱の立ち上がりが少し遅い。吸い出しで温度を確かめよう" : "",
      `${steamTimeLabel(seconds)}蒸らした。${hits === 0 ? "最後まで一度も揺れなかった" : `雑念に${hits}回つかまった`}`,
      cs.steam.refreshesUsed ? `リフレッシュで${cs.steam.refreshesUsed}回、雑念を吹き払った` : "",
      effectLine("insight", "察", "洞察で雑念が少し減っていた"),
      hits === 0 ? "呼吸が整った。吸い出しも落ち着いて取りかかれそう" : "気が少し急いている。吸い出しは手元をよく見よう",
      "蒸らしで入った熱を、吸い出しで適温へ整える",
      min >= 8 ? "じっくり待った分、熱が入り、吸い出しに余裕ができる" : min <= 3 ? "早めの立ち上げ。温度合わせは忙しくなる" : "香りの輪郭を残した。吸い出しでしっかり熱を入れよう",
    ],
  });
}
