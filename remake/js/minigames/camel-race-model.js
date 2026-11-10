// CAMEL RACE（第4章ドバイ編の任意ミニゲーム）の純粋な競走モデル。DOM・音・保存を持たない。
// 画面は camel-race.js、本編との接続は chapters/ch4-camel-race.js。
//
// 現実のドバイのラクダレースに倣う: ラクダの背には小型のロボット騎手。調教師はコース横の道を走る車から
// リモコンで「声」（スピーカー越しの声かけ）と「ムチ」（騎手の腕）を送るだけで、進路は操縦しない。
// ゲームでも、ラクダは自分で走る。プレイヤーが決めるのは「いつ声をかけるか」「いつムチを入れるか」だけ。
// 2026-11-02 オーナー「ラクダ操ってる感とかスピード感」: 声が当たるとその場で一伸び（surge）し、
// ムチは押している間だけ騎手の腕が回り続ける（押す＝加速・スタミナを使う、離す＝声で息を整える）。
//
// 時間は秒。距離はメートル。stepRace(state, dt) を小刻みに呼ぶと進む。乱数は seed で固定（テスト・再現用）。

export const RACE = Object.freeze({
  length: 1000,          // 練習レースのコース長（本番は4〜10km。練習用に短い）
  rivals: 3,
  spurtFrom: 0.75,       // ここから「ラストスパート」区間（ムチの効きが強い）
  maxTime: 95,           // ここまでに着かなければ強制的にゴール扱い（画面の保険）
  countdown: 3,
});

// 練習は従来の1000mを維持。大会は同じ操作で短距離から順に挑戦する。
export const CAMEL_CUPS = Object.freeze([
  { id: "practice", name: "練習レース", length: 1000, rivalBoost: 0, note: "操作を練習。初回完走のご褒美はそのまま" },
  { id: "rookie", name: "入門大会", length: 700, rivalBoost: -0.9, note: "3位以内で標準大会へ" },
  { id: "standard", name: "標準大会", length: 1000, rivalBoost: 0, note: "入賞・声20点・スタミナ20点・連打なしで中級認定" },
  { id: "expert", name: "上級大会", length: 1300, rivalBoost: 0.25, note: "1位・S評価・連打なしで砂漠の名調教師" },
].map(cup => Object.freeze(cup)));
export const camelCup = id => CAMEL_CUPS.find(cup => cup.id === id) || CAMEL_CUPS[0];
export const camelCupQualified = run => !!run && run.cup !== "practice" && run.rank <= 3 && Number.isFinite(run.total);
export const camelMastered = run => run?.cup === "standard" && run.rank <= 3 && run.parts?.timing >= 20 && run.parts?.stamina >= 20 && run.stats?.spam === 0;
export const camelExpert = run => run?.cup === "expert" && run.rank === 1 && run.total >= 85 && run.stats?.spam === 0;

export const PLAYER = Object.freeze({
  base: 18.3,            // 基本速度 m/s（調子が最大で ×(floor+span)、最低で ×floor）
  rhythmFloor: 0.9, rhythmSpan: 0.14,
  rhythmStart: 0.6,
  ease: 0.6,             // 速度が目標へ寄る時定数（秒）
  staminaDrain: 0.9,     // ムチを入れていない間の消耗（1秒あたり）
  staminaRecover: 2.6,   // ムチを入れていない間の回復 ×調子（調子0.9なら +2.3/秒）
  rhythmDecay: 0.07,     // 1秒あたりの割合で調子が落ちる（PERFECT なら高いまま、GOOD だけなら中くらいで釣り合う）
  tired: 30,             // これを下回ると速度が落ち始める
});

export const CUE = Object.freeze({
  lead: 1.25,            // 合図の輪の標準の縮み時間（秒）。実際の輪は1つごとに leadMin〜leadMax で変わる
  leadMin: 0.7, leadMax: 1.4, // 輪が現れてから「ぴたり」までの秒数の幅（seedで決まる。速い輪ほど難しい）
  perfect: 0.13,         // ±この範囲なら PERFECT
  good: 0.36,            // ±この範囲なら GOOD（外は無駄な声）
  gapMin: 2.4, gapMax: 3.4, // 次の輪までの間隔（seedで決まる）
  firstAt: 1.6,
  perfectGain: 0.25, goodGain: 0.12, lostLoss: 0.26, missLoss: 0.08,
  missStamina: 3, spamStamina: 5, spamWindow: 1.5, spamCount: 3,
  // 当たった声でその場で一伸びする量（m/s。0.8秒ほどで消える）。
  perfectSurge: 1.0, goodSurge: 0.8, surgeMax: 4, surgeFade: 0.8,
});

/** ムチ: 押している間だけ騎手の腕が回る。スタミナを使い、終盤ほど効く。 */
export const WHIP = Object.freeze({
  boost: 3.0, spurtBoost: 5.0,   // 押している間の上乗せ m/s
  drain: 13, spurtDrain: 11,     // 押している間のスタミナ消費（1秒あたり）
  empty: 6,                      // これを下回ると腕が止まる（空ぶかし）
  resume: 22,                    // 空になった後、ここまで戻るまで腕は回らない
  ease: 0.4,                     // ムチの間は速度の寄りを速く
});

export const RANK_POINTS = Object.freeze([40, 30, 20, 10]);
export const GRADES = Object.freeze([["S", 85], ["A", 70], ["B", 50], ["C", 0]]);
export const gradeOf = score => GRADES.find(([, min]) => score >= min)[0];

// ライバルの走り方（先行・追い込み・安定）。区間ごとの目安速度 m/s。seed で ±0.4 の個体差と細かな揺れ。
// color はゼッケン・順位の札・名札・進み具合の点で共通（自分は金、AI は緑・青・紫で見分けやすく）。
// whip は各ライバルのムチの使い方（使う進み具合の区間・間隔 span 秒ごとに burst 秒だけ振る）。
export const RIVAL_PROFILES = Object.freeze([
  { id: "front", name: "ナジュム", color: "#4fae6a", speeds: [19.9, 18.4, 17.6], note: "先行型。前半で前に出る", whip: { from: 0, to: 0.35, span: 6.5, burst: 1.5 } },
  { id: "closer", name: "リーフ", color: "#4b8ee0", speeds: [17.7, 18.3, 20.6], note: "追い込み型。最後に伸びる", whip: { from: 0.6, to: 1, span: 6.5, burst: 1.5 } },
  { id: "steady", name: "サブール", color: "#a46ad8", speeds: [18.6, 18.6, 18.7], note: "安定型。一定の足で走る", whip: { from: 0.1, to: 0.9, span: 8, burst: 1 } },
].map(profile => Object.freeze(profile)));

/** ライバルのムチ: 振っている間だけ少し伸びる（プレイヤーのムチより弱く、見た目が主）。 */
export const RIVAL_WHIP = Object.freeze({ boost: 0.8 });

export const PLAYER_CAMEL = Object.freeze({ id: "player", name: "ハビーバ", color: "#ffb52e", note: "はじめが声をかけるラクダ" });

/** mulberry32。seed から [0,1) の列を作る。 */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 合図の輪の予定表を作る（コースを走り切るのに足りる長さ）。縮む速さは輪ごとに変える。 */
function scheduleCues(random) {
  const cues = [];
  let at = CUE.firstAt;
  while (at < RACE.maxTime) {
    const lead = CUE.leadMin + (CUE.leadMax - CUE.leadMin) * random();
    cues.push({ at, state: "pending", presses: 0, lead });
    at += CUE.gapMin + (CUE.gapMax - CUE.gapMin) * random();
  }
  return cues;
}

export function createRace({ seed = 1, cup = "practice", length = camelCup(cup).length } = {}) {
  const event = camelCup(cup);
  const random = rng(seed);
  const rivals = RIVAL_PROFILES.map((profile, index) => {
    const offset = (random() - 0.5) * 0.8 + event.rivalBoost;
    return { id: profile.id, name: profile.name, color: profile.color, index: index + 1, distance: 0, speed: profile.speeds[0] + offset,
      offset, wobble: random() * Math.PI * 2, finishedAt: null, whipping: false };
  });
  return {
    seed, cup: event.id, length, t: 0, finished: false, finishedAt: null, rank: null,
    player: { id: "player", name: PLAYER_CAMEL.name, color: PLAYER_CAMEL.color, index: 0, distance: 0, speed: PLAYER.base * 0.95,
      rhythm: PLAYER.rhythmStart, stamina: 100, finishedAt: null, surge: 0,
      whipHeld: false, whipping: false, whipLocked: false, lastVoice: -Infinity, exhausted: false },
    cues: scheduleCues(random),
    presses: [],                       // 直近の声かけ時刻（連打検出）
    // whipTime: ムチが効いた秒数、spurtWhip: そのうちスパート区間、emptyWhip: 息が無いのに押していた秒数。
    stats: { perfect: 0, good: 0, miss: 0, lost: 0, spam: 0, whips: 0, whipTime: 0, spurtWhip: 0, emptyWhip: 0 },
    events: [],                        // 画面が拾う出来事 {t, type, ...}（stepRace の後に空にしてよい）
    rivals,
  };
}

/** 今見せるべき合図の輪。輪が出ていない時は null。progress は 0（出現）→1（ぴたり）→1超（遅れ）。 */
export function activeCue(state) {
  const cue = state.cues.find(c => c.state === "pending" && state.t >= c.at - c.lead);
  if (!cue) return null;
  return { at: cue.at, lead: cue.lead, progress: (state.t - (cue.at - cue.lead)) / cue.lead, dt: state.t - cue.at };
}

/** 次の合図までの秒数（輪が出ていない時の案内用）。 */
export const nextCueIn = state => {
  const cue = state.cues.find(c => c.state === "pending");
  return cue ? Math.max(0, cue.at - cue.lead - state.t) : Infinity;
};

export const inSpurt = state => state.player.distance / state.length >= RACE.spurtFrom;

/** 声かけ（Space／左ボタン）。輪のタイミングで調子が整い、外せば消耗する。 */
export function pressVoice(state) {
  if (state.finished) return null;
  const { player, t } = state;
  state.presses = state.presses.filter(at => t - at <= CUE.spamWindow);
  state.presses.push(t);
  player.lastVoice = t;
  const cue = state.cues.find(c => c.state === "pending" && Math.abs(t - c.at) <= CUE.good);
  let result;
  if (cue && cue.presses === 0) {
    const dt = t - cue.at;
    const perfect = Math.abs(dt) <= CUE.perfect;
    cue.state = perfect ? "perfect" : "good";
    cue.presses = 1;
    player.rhythm = clamp(player.rhythm + (perfect ? CUE.perfectGain : CUE.goodGain), 0, 1);
    // その場で一伸び: 速さに少し足し、残りは0.8秒ほどかけて消える上乗せに。
    const kick = perfect ? CUE.perfectSurge : CUE.goodSurge;
    player.surge = Math.min(CUE.surgeMax, player.surge + kick);
    player.speed += kick * 0.4;
    state.stats[perfect ? "perfect" : "good"] += 1;
    result = { type: perfect ? "perfect" : "good", dt };
  } else {
    // 輪の外、または同じ輪への二度目以降の声は、ラクダを戸惑わせるだけ。
    if (cue) cue.presses += 1;
    player.rhythm = clamp(player.rhythm - CUE.missLoss, 0, 1);
    player.stamina = clamp(player.stamina - CUE.missStamina, 0, 100);
    state.stats.miss += 1;
    result = { type: "miss", dt: cue ? t - cue.at : null };
  }
  if (state.presses.length >= CUE.spamCount) {
    // 連打: 3回目以降は毎回さらに消耗する。
    player.stamina = clamp(player.stamina - CUE.spamStamina, 0, 100);
    state.stats.spam += 1;
    result.spam = true;
  }
  state.events.push({ t, ...result, kind: "voice" });
  return result;
}

/** ムチが今効くか（押していて、息が残っていて、空になった後の待ちでもない）。 */
export const whipReady = state => !state.player.whipLocked && state.player.stamina > WHIP.empty;

/**
 * ムチ（X／右ボタン）を押す・離す。押している間だけ騎手の腕が回り続け、stepRace がスタミナを使って加速させる。
 * 戻り値: 押した時 { type: "spurt" | "boost" | "spent" }、離した時 { type: "release" }、変化なしは null。
 */
export function setWhip(state, on) {
  if (state.finished) return null;
  const { player, t } = state;
  on = !!on;
  if (player.whipHeld === on) return null;
  player.whipHeld = on;
  let result;
  if (!on) result = { type: "release" };
  else {
    state.stats.whips += 1;
    result = { type: !whipReady(state) ? "spent" : inSpurt(state) ? "spurt" : "boost" };
  }
  state.events.push({ t, kind: "whip", ...result });
  return result;
}

function rivalTarget(rival, progress, t) {
  const profile = RIVAL_PROFILES[rival.index - 1];
  const [a, b, c] = profile.speeds;
  // 区間の目安を滑らかにつなぐ（0→1/3→2/3→1）。
  const base = progress < 1 / 3 ? a + (b - a) * (progress * 3)
    : progress < 2 / 3 ? b + (c - b) * ((progress - 1 / 3) * 3) : c;
  return base + rival.offset + Math.sin(t * 1.7 + rival.wobble) * 0.35;
}

/** dt 秒ぶん進める。プレイヤーがゴールした時点でレースは終わる（順位はその時点で確定）。 */
export function stepRace(state, dt) {
  if (state.finished || !(dt > 0)) return state;
  dt = Math.min(dt, 0.05);
  const { player } = state;
  const before = state.t;
  state.t += dt;
  // 見送った輪: 調子が落ちる。
  for (const cue of state.cues) {
    if (cue.state === "pending" && state.t > cue.at + CUE.good) {
      cue.state = "lost";
      player.rhythm = clamp(player.rhythm - CUE.lostLoss, 0, 1);
      state.stats.lost += 1;
      state.events.push({ t: state.t, kind: "voice", type: "lost" });
    }
  }
  // 調子は放っておくと少しずつ落ちる。
  player.rhythm = clamp(player.rhythm * (1 - PLAYER.rhythmDecay * dt), 0, 1);
  // ムチ: 押していて息があれば腕が回る。空になったら、戻るまで止まる。
  const spurt = inSpurt(state);
  if (player.whipLocked && player.stamina >= WHIP.resume) { player.whipLocked = false; state.events.push({ t: state.t, kind: "whip", type: "ready" }); }
  const whipping = player.whipHeld && whipReady(state);
  if (whipping !== player.whipping) { player.whipping = whipping; }
  if (whipping) {
    player.stamina = clamp(player.stamina - (spurt ? WHIP.spurtDrain : WHIP.drain) * dt, 0, 100);
    state.stats.whipTime += dt;
    if (spurt) state.stats.spurtWhip += dt;
    if (player.stamina <= WHIP.empty) {
      player.whipLocked = true; player.whipping = false;
      state.events.push({ t: state.t, kind: "whip", type: "empty" });
    }
  } else {
    if (player.whipHeld) state.stats.emptyWhip += dt;
    // 押していない間は、調子がよければ息が整う。
    player.stamina = clamp(player.stamina + (PLAYER.staminaRecover * player.rhythm - PLAYER.staminaDrain) * dt, 0, 100);
  }
  if (player.stamina <= 0 && !player.exhausted) { player.exhausted = true; state.events.push({ t: state.t, kind: "stamina", type: "exhausted" }); }
  if (player.stamina > WHIP.resume) player.exhausted = false;
  // 速度: 調子×息＋声の一伸び＋ムチ。
  player.surge *= Math.exp(-dt / CUE.surgeFade);
  const staminaFactor = player.stamina >= PLAYER.tired ? 1 : 0.84 + 0.16 * (player.stamina / PLAYER.tired);
  const boost = player.whipping ? (spurt ? WHIP.spurtBoost : WHIP.boost) : 0;
  const target = PLAYER.base * (PLAYER.rhythmFloor + PLAYER.rhythmSpan * player.rhythm) * staminaFactor + player.surge + boost;
  player.speed += (target - player.speed) * Math.min(1, dt / (player.whipping ? WHIP.ease : PLAYER.ease));
  player.distance += player.speed * dt;
  // ライバル。
  for (const rival of state.rivals) {
    if (rival.finishedAt !== null) continue;
    const progress = rival.distance / state.length;
    let target = rivalTarget(rival, progress, state.t);
    // ムチ: 型ごとの区間で、間隔ごとに短く振る。振っている間は少し伸び、騎手の腕も回る。
    const whip = RIVAL_PROFILES[rival.index - 1].whip;
    rival.whipping = !!whip && progress >= whip.from && progress <= whip.to
      && ((state.t + rival.wobble * 2.7) % whip.span) < whip.burst;
    if (rival.whipping) target += RIVAL_WHIP.boost;
    rival.speed += (target - rival.speed) * Math.min(1, dt / 0.9);
    rival.distance += rival.speed * dt;
    if (rival.distance >= state.length) {
      rival.distance = state.length;
      rival.finishedAt = state.t - (rival.distance - state.length) / Math.max(rival.speed, 1);
      state.events.push({ t: state.t, kind: "finish", who: rival.id });
    }
  }
  const spurtNow = inSpurt(state);
  if (spurtNow && (before === 0 || (player.distance - player.speed * dt) / state.length < RACE.spurtFrom)) {
    state.events.push({ t: state.t, kind: "spurt" });
  }
  if (player.distance >= state.length || state.t >= RACE.maxTime) {
    player.distance = Math.min(player.distance, state.length);
    player.finishedAt = state.t;
    state.finished = true;
    state.finishedAt = state.t;
    state.rank = 1 + state.rivals.filter(rival => rival.finishedAt !== null && rival.finishedAt <= state.t).length;
    state.events.push({ t: state.t, kind: "finish", who: "player", rank: state.rank });
  }
  return state;
}

/** 順位表（距離順。ゴール済みは着順）。画面の順位表示と結果に使う。 */
export function standings(state) {
  const all = [state.player, ...state.rivals];
  return all.slice().sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.distance - a.distance;
  }).map((camel, index) => ({ id: camel.id, name: camel.name, color: camel.color, position: index + 1, distance: camel.distance, finishedAt: camel.finishedAt }));
}

/**
 * 採点（0〜100）: 順位（40）＋声かけの正確さ（35）＋ムチとスタミナの使い方（25）。
 * 完走していない状態には null。
 */
export function scoreRace(state) {
  if (!state.finished) return null;
  const { stats, player, rank } = state;
  const rankPoints = RANK_POINTS[clamp(rank, 1, 4) - 1];
  const judged = stats.perfect + stats.good + stats.lost;
  const timingRaw = judged ? 35 * (stats.perfect + stats.good * 0.6) / judged : 0;
  const timing = clamp(timingRaw - stats.miss * 2 - stats.spam, 0, 35);
  // ムチとスタミナ: スパートでムチを入れたか（8: 3秒で満点）、息が無いのに押し続けていないか（9）、
  // 息を残しすぎていないか（8: 残り0〜30で満点。使い切って勝つのがいちばん）。
  const spurt = 8 * clamp(stats.spurtWhip / 3, 0, 1);
  const pressed = stats.whipTime + stats.emptyWhip;
  const efficiency = pressed > 0 ? 9 * clamp(1 - stats.emptyWhip / pressed, 0, 1) : 4;
  const remain = player.stamina;
  const pacing = remain <= 30 ? 8 : clamp(8 - (remain - 30) / 7, 0, 8);
  const stamina = clamp(Math.round(spurt + efficiency + pacing), 0, 25);
  const total = clamp(Math.round(rankPoints + timing + stamina), 0, 100);
  return { total, grade: gradeOf(total), rank, time: state.finishedAt, cup: state.cup,
    parts: { rank: rankPoints, timing: Math.round(timing), stamina },
    stats: { ...stats, whipTime: Math.round(stats.whipTime * 10) / 10, spurtWhip: Math.round(stats.spurtWhip * 10) / 10,
      emptyWhip: Math.round(stats.emptyWhip * 10) / 10, judged, staminaLeft: Math.round(remain) } };
}

/**
 * テスト・自動操作用: 方針どおりに最後まで走らせる。
 * policy: "perfect"（毎回ぴたり・中盤は息が満ちたら短くムチ・スパートで使い切る）／"good"／"cruise"（声はぴたり・ムチなし）
 *         ／"hold"（声はぴたり・ムチを押しっぱなし）／"none"（何もしない）／"spam"（連打）／関数(state)→{voice, whip}
 */
export function simulateRace({ seed = 1, policy = "perfect", cup = "practice", dt = 1 / 60 } = {}) {
  const state = createRace({ seed, cup });
  const decide = typeof policy === "function" ? policy : POLICIES[policy];
  if (!decide) throw new RangeError(`Unknown policy: ${policy}`);
  let guard = 0;
  while (!state.finished && guard++ < 20000) {
    const action = decide(state) || {};
    if (action.voice) pressVoice(state);
    setWhip(state, !!action.whip);
    stepRace(state, dt);
    state.events.length = 0;
  }
  return { state, score: scoreRace(state) };
}

/** 上手なムチ: スパートでは使い切る。中盤は息が満ちている時だけ短く入れ、スパートの前に貯め直す。 */
const smartWhip = state => {
  const { player } = state;
  if (!whipReady(state)) return false;
  if (inSpurt(state)) return true;
  const progress = player.distance / state.length;
  if (progress < 0.15 || progress > RACE.spurtFrom - 0.18) return false;
  return player.whipping ? player.stamina > 70 : player.stamina > 96;
};
const voiceAt = (lo, hi) => state => { const cue = activeCue(state); return !!cue && cue.dt >= lo && cue.dt <= hi; };
export const POLICIES = {
  perfect: state => ({ voice: voiceAt(-0.02, 0.02)(state), whip: smartWhip(state) }),
  good: state => ({ voice: voiceAt(0.2, 0.24)(state), whip: smartWhip(state) }),
  cruise: state => ({ voice: voiceAt(-0.02, 0.02)(state), whip: false }),
  hold: state => ({ voice: voiceAt(-0.02, 0.02)(state), whip: true }),
  none: () => ({}),
  spam: state => ({ voice: Math.round(state.t * 60) % 6 === 0, whip: true }),
};

