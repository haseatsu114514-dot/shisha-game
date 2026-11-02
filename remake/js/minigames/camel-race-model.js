// CAMEL RACE（第4章ドバイ編の任意ミニゲーム）の純粋な競走モデル。DOM・音・保存を持たない。
// 画面は camel-race.js、本編との接続は chapters/ch4-camel-race.js。
//
// 現実のドバイのラクダレースに倣う: ラクダの背には小型のロボット騎手。調教師はコース横の道を走る車から
// リモコンで「声」（スピーカー越しの声かけ）と「合図」（騎手の腕）を送るだけで、進路は操縦しない。
// ゲームでも、ラクダは自分で走る。プレイヤーが決めるのは「いつ声をかけるか」「いつ合図を出すか」だけ。
//
// 時間は秒。距離はメートル。stepRace(state, dt) を小刻みに呼ぶと進む。乱数は seed で固定（テスト・再現用）。

export const RACE = Object.freeze({
  length: 1000,          // 練習レースのコース長（本番は4〜10km。練習用に短い）
  rivals: 3,
  spurtFrom: 0.75,       // ここから「ラストスパート」区間（合図の効きが強い）
  maxTime: 95,           // ここまでに着かなければ強制的にゴール扱い（画面の保険）
  countdown: 3,
});

export const PLAYER = Object.freeze({
  base: 18.4,            // 基本速度 m/s（調子が最大で ×1.08、最低で ×0.88）
  rhythmStart: 0.6,
  ease: 0.65,            // 速度が目標へ寄る時定数（秒）
  staminaDrain: 0.9,     // 1秒あたりの消耗
  staminaRecover: 0.7,   // 調子が良い（rhythm ≥ 0.75）ときの回復
  rhythmDecay: 0.07,     // 1秒あたりの割合で調子が落ちる（PERFECT なら高いまま、GOOD だけなら中くらいで釣り合う）
  tired: 30,             // これを下回ると速度が落ち始める
  spent: 15,             // これを下回る合図は空ぶかし
});

export const CUE = Object.freeze({
  lead: 1.25,            // 合図の輪が現れてから「ぴたり」の瞬間までの秒数
  perfect: 0.13,         // ±この範囲なら PERFECT
  good: 0.36,            // ±この範囲なら GOOD（外は無駄な声）
  gapMin: 2.4, gapMax: 3.4, // 次の輪までの間隔（seedで決まる）
  firstAt: 1.6,
  perfectGain: 0.25, goodGain: 0.12, lostLoss: 0.26, missLoss: 0.08,
  missStamina: 3, spamStamina: 5, spamWindow: 1.5, spamCount: 3,
});

export const SIGNAL = Object.freeze({
  cost: 12, spurtCost: 10, cooldown: 3.5, duration: 2.4,
  boost: 3.2, spurtBoost: 4.6, spentBoost: 1.0,
  earlyUntil: 0.2,       // コースの最初の2割で使うと「早すぎ」（採点で減点）
});

export const RANK_POINTS = Object.freeze([40, 30, 20, 10]);
export const GRADES = Object.freeze([["S", 85], ["A", 70], ["B", 50], ["C", 0]]);
export const gradeOf = score => GRADES.find(([, min]) => score >= min)[0];

// ライバルの走り方（先行・追い込み・安定）。区間ごとの目安速度 m/s。seed で ±0.4 の個体差と細かな揺れ。
// color はゼッケン・順位の札・名札・進み具合の点で共通（自分は金、AI は緑・青・紫で見分けやすく）。
export const RIVAL_PROFILES = Object.freeze([
  { id: "front", name: "ナジュム", color: "#4fae6a", speeds: [19.9, 18.4, 17.6], note: "先行型。前半で前に出る" },
  { id: "closer", name: "リーフ", color: "#4b8ee0", speeds: [17.7, 18.3, 20.6], note: "追い込み型。最後に伸びる" },
  { id: "steady", name: "サブール", color: "#a46ad8", speeds: [18.6, 18.6, 18.7], note: "安定型。一定の足で走る" },
].map(profile => Object.freeze(profile)));

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

/** 合図の輪の予定表を作る（コースを走り切るのに足りる長さ）。 */
function scheduleCues(random) {
  const cues = [];
  let at = CUE.firstAt;
  while (at < RACE.maxTime) {
    cues.push({ at, state: "pending", presses: 0 });
    at += CUE.gapMin + (CUE.gapMax - CUE.gapMin) * random();
  }
  return cues;
}

export function createRace({ seed = 1, length = RACE.length } = {}) {
  const random = rng(seed);
  const rivals = RIVAL_PROFILES.map((profile, index) => {
    const offset = (random() - 0.5) * 0.8;
    return { id: profile.id, name: profile.name, color: profile.color, index: index + 1, distance: 0, speed: profile.speeds[0] + offset,
      offset, wobble: random() * Math.PI * 2, finishedAt: null };
  });
  return {
    seed, length, t: 0, finished: false, finishedAt: null, rank: null,
    player: { id: "player", name: PLAYER_CAMEL.name, color: PLAYER_CAMEL.color, index: 0, distance: 0, speed: PLAYER.base * 0.95,
      rhythm: PLAYER.rhythmStart, stamina: 100, finishedAt: null,
      boost: 0, boostUntil: -1, cooldownUntil: -1, lastVoice: -Infinity, exhausted: false },
    cues: scheduleCues(random),
    presses: [],                       // 直近の声かけ時刻（連打検出）
    stats: { perfect: 0, good: 0, miss: 0, lost: 0, spam: 0, signals: 0, spurtSignals: 0, earlySignals: 0, spentSignals: 0 },
    events: [],                        // 画面が拾う出来事 {t, type, ...}（stepRace の後に空にしてよい）
    rivals,
  };
}

/** 今見せるべき合図の輪。輪が出ていない時は null。progress は 0（出現）→1（ぴたり）→1超（遅れ）。 */
export function activeCue(state) {
  const cue = state.cues.find(c => c.state === "pending" && state.t >= c.at - CUE.lead);
  if (!cue) return null;
  return { at: cue.at, progress: (state.t - (cue.at - CUE.lead)) / CUE.lead, dt: state.t - cue.at };
}

/** 次の合図までの秒数（輪が出ていない時の案内用）。 */
export const nextCueIn = state => {
  const cue = state.cues.find(c => c.state === "pending");
  return cue ? Math.max(0, cue.at - CUE.lead - state.t) : Infinity;
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

/** 補助の合図（X／右ボタン）: ロボット騎手の腕。スタミナを使って一時的に加速。終盤ほど効く。 */
export function pressSignal(state) {
  if (state.finished) return null;
  const { player, t } = state;
  if (t < player.cooldownUntil) {
    state.events.push({ t, kind: "signal", type: "cooldown" });
    return { type: "cooldown" };
  }
  const spurt = inSpurt(state);
  const early = state.player.distance / state.length < SIGNAL.earlyUntil;
  let type;
  if (player.stamina < PLAYER.spent) {
    // 空ぶかし: 息が残っていない。わずかしか伸びず、残りを使い切る。
    player.boost = SIGNAL.spentBoost;
    player.stamina = 0;
    state.stats.spentSignals += 1;
    type = "spent";
  } else {
    player.boost = spurt ? SIGNAL.spurtBoost : SIGNAL.boost;
    player.stamina = clamp(player.stamina - (spurt ? SIGNAL.spurtCost : SIGNAL.cost), 0, 100);
    type = spurt ? "spurt" : "boost";
    if (spurt) state.stats.spurtSignals += 1;
    if (early) state.stats.earlySignals += 1;
  }
  player.boostUntil = t + SIGNAL.duration;
  player.cooldownUntil = t + SIGNAL.cooldown;
  state.stats.signals += 1;
  const result = { type, early };
  state.events.push({ t, kind: "signal", ...result });
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
  // スタミナ: 走れば減る。調子が良ければ息が整って少し戻る。
  const recovering = player.rhythm >= 0.75 && state.t > player.boostUntil;
  player.stamina = clamp(player.stamina - PLAYER.staminaDrain * dt + (recovering ? PLAYER.staminaRecover * dt : 0), 0, 100);
  if (player.stamina <= 0 && !player.exhausted) { player.exhausted = true; state.events.push({ t: state.t, kind: "stamina", type: "exhausted" }); }
  if (player.stamina > PLAYER.spent) player.exhausted = false;
  // 速度: 調子×息×合図。
  const staminaFactor = player.stamina >= PLAYER.tired ? 1 : 0.84 + 0.16 * (player.stamina / PLAYER.tired);
  const boost = state.t < player.boostUntil ? player.boost * (1 - (state.t - (player.boostUntil - SIGNAL.duration)) / SIGNAL.duration) : 0;
  const target = PLAYER.base * (0.88 + 0.2 * player.rhythm) * staminaFactor + boost;
  player.speed += (target - player.speed) * Math.min(1, dt / PLAYER.ease);
  player.distance += player.speed * dt;
  // ライバル。
  for (const rival of state.rivals) {
    if (rival.finishedAt !== null) continue;
    const target = rivalTarget(rival, rival.distance / state.length, state.t);
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
 * 採点（0〜100）: 順位（40）＋声かけの正確さ（35）＋スタミナの使い方（25）。
 * 完走していない状態には null。
 */
export function scoreRace(state) {
  if (!state.finished) return null;
  const { stats, player, rank } = state;
  const rankPoints = RANK_POINTS[clamp(rank, 1, 4) - 1];
  const judged = stats.perfect + stats.good + stats.lost;
  const timingRaw = judged ? 35 * (stats.perfect + stats.good * 0.6) / judged : 0;
  const timing = clamp(timingRaw - stats.miss * 2 - stats.spam, 0, 35);
  // スタミナ: 終盤で合図を出せたか（8）、無駄な合図が無いか（9）、使い切りすぎず残しすぎない（8: 残り5〜35が満点）。
  const spurt = stats.spurtSignals > 0 ? 8 : 0;
  const waste = stats.earlySignals + stats.spentSignals;
  const efficiency = stats.signals ? 9 * clamp(1 - waste / stats.signals, 0, 1) : 4;
  const remain = player.stamina;
  const pacing = remain >= 5 && remain <= 35 ? 8 : remain < 5 ? 8 * (remain / 5) : clamp(8 - (remain - 35) / 8, 0, 8);
  const stamina = clamp(Math.round(spurt + efficiency + pacing), 0, 25);
  const total = clamp(Math.round(rankPoints + timing + stamina), 0, 100);
  return { total, grade: gradeOf(total), rank, time: state.finishedAt,
    parts: { rank: rankPoints, timing: Math.round(timing), stamina },
    stats: { ...stats, judged, staminaLeft: Math.round(remain) } };
}

/**
 * テスト・自動操作用: 方針どおりに最後まで走らせる。
 * policy: "perfect"（毎回ぴたり・終盤で合図）／"good"／"none"（何もしない）／"spam"（連打）／関数(state)→{voice,signal}
 */
export function simulateRace({ seed = 1, policy = "perfect", dt = 1 / 60 } = {}) {
  const state = createRace({ seed });
  const decide = typeof policy === "function" ? policy : POLICIES[policy];
  if (!decide) throw new RangeError(`Unknown policy: ${policy}`);
  let guard = 0;
  while (!state.finished && guard++ < 20000) {
    const action = decide(state) || {};
    if (action.voice) pressVoice(state);
    if (action.signal) pressSignal(state);
    stepRace(state, dt);
    state.events.length = 0;
  }
  return { state, score: scoreRace(state) };
}

export const POLICIES = {
  perfect: state => {
    const cue = activeCue(state);
    const voice = !!cue && cue.dt >= -0.02 && cue.dt <= 0.02;
    const signal = inSpurt(state) && state.player.stamina >= 25 && state.t >= state.player.cooldownUntil;
    return { voice, signal };
  },
  good: state => {
    const cue = activeCue(state);
    const voice = !!cue && cue.dt >= 0.2 && cue.dt <= 0.24;
    const signal = inSpurt(state) && state.player.stamina >= 25 && state.t >= state.player.cooldownUntil;
    return { voice, signal };
  },
  none: () => ({}),
  spam: state => ({ voice: Math.round(state.t * 60) % 6 === 0, signal: state.t >= state.player.cooldownUntil }),
};
