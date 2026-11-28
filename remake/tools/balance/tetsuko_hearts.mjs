// てつこといっしょの、ごきげん（その日のハート5つ）と、なかよし（肉球5つ。来訪をまたいで溜まる）の調整を計る
// （docs/spec/tetsuko_time.md §12・2026-11-27）。
// 画面（tetsuko-time.js）と同じ間合いでモデルを時間つきで動かす: 操作のあと 1.6 秒は自分から動かない・自律行動は 1.7〜2.4 秒ごと・
// 7 秒触らないと見守ったことになる。1回の来訪は「切り上げになるか、決めた回数だけ触って帰る」。確定は本物の settleTetsukoTime。
// 遊び方（プレイヤーの型）× 1回に触る回数ごとに、帰る時のハートの数・1回に伸びるなかよし・嫌がらせた回数と、
// なかよしが肉球3つ（火種）・5つ（白火）に届くまでの来訪回数（通算日を変えた24通りの中央値・最短・最長）を出す。
// 調整値（tetsuko-model.js の JOY・CARE_CAP・JOY_UNIT・VISIT_TURNS・BOND_GAIN・DROP）を変えたら回し直す。
//
// 使い方: node remake/tools/balance/tetsuko_hearts.mjs [--json]
import { newState } from "../../js/core/state.js";
import { OUTINGS_FLAG } from "../../js/chapters/ch3-outing-progress.js";
import { WATCH_IDLE_MS, settleTetsukoTime, tetsukoVisitKey } from "../../js/minigames/tetsuko-time.js";
import {
  TETSUKO_TIME_FLAG, JOY_MAX, JOY_HEARTS, BOND_EMBERS, CARE_CAP, createSession, openingReaction, act, canAct, autonomous, autoDelay, peakReaction, wrapUpReaction, placeProp, invite, slotOf,
  unlockedProps, rng, readTetsukoRecord, sessionResult, SWEET_ZONES, sulky, petLimit, lapReady,
} from "../../js/minigames/tetsuko-model.js";

const AFTER_ACTION_MS = 1600, TREAT_MS = 3000, PHOTO_HOLD_MS = 6500, TOY_HELD_MS = 1700, POUNCE_MS = 380, PEAK_DELAY_MS = 900;
/** 来訪を数える上限（ここまでに肉球が5つにならなければ「届かない」）。 */
export const MAX_VISITS = 60;

/** 第3章の東京の一日。まだ一度も会っていない（来訪0回）ところから始める。 */
function save(day) {
  const value = newState();
  Object.assign(value, { chapter: 3, day, slot: 1, phase: "daily" });
  value.flags[OUTINGS_FLAG] = {};
  value.met.mashiro = true;
  value.met.mukai_master = true;
  return value;
}

/**
 * プレイヤーの型。next(session, random, memo) は次の操作 { kind, zone?, prop?, slot?, wait? } を返す。
 * - petter: なでるだけ（猫をあちこちタップ。しっぽにも触る。嫌がっても続ける）。
 * - casual: おねだりも、嫌がるしぐさも見ない。なでる・じゃらし・ブラシ・おやつを気ままに。
 * - buttons: 手元の札を順に押す（なでる→じゃらし→ブラシ→おやつ）。嫌がるしぐさは見ない。
 * - attentive: おねだりに応え、お気に入りの場所を探してなで、嫌がるしぐさを一度見たらその操作をやめる。置いた物でも誘い、そばで待つ。
 */
const PLAYERS = {
  petter: { gap: [1100, 2000], next(s, r) {
    const z = r();
    return { kind: "pet", zone: z < .12 ? "tail" : SWEET_ZONES[Math.floor(z * 3) % 3] };
  } },
  casual: { gap: [1300, 2600], next(s, r) {
    const roll = r();
    if (roll < .08 && canAct(s, "treat")) return { kind: "treat" };
    if (roll < .25 && canAct(s, "brush")) return { kind: "brush" };
    if (roll < .55) return { kind: "play" };
    const z = r();
    return { kind: "pet", zone: z < .12 ? "tail" : SWEET_ZONES[Math.floor(z * 3) % 3] };
  } },
  buttons: { gap: [1200, 1800], next(s, r, memo) {
    const order = ["pet", "pet", "pet", "play", "play", "play", "play", "play", "brush", "brush", "treat"];
    for (let i = 0; i < order.length; i += 1) {
      const kind = order[memo.step++ % order.length];
      if (canAct(s, kind)) return { kind, zone: ["head", "chin", "back"][memo.zone++ % 3] };
    }
    return { kind: "pet", zone: "head" };
  } },
  attentive: { gap: [1800, 3000], next(s, r, memo) {
    // 嫌がるしぐさ（知らせ）を一度見た操作は、もうしない。なでるのは「もういい」の手前でやめる。
    const off = kind => kind === "play" ? !!s.warned.toy && s.mood === "sleepy"
      : kind === "brush" ? (!!s.warned.brush && s.mood === "playful") || (!!s.warned.touch && sulky(s))
      : kind === "pet" ? (!!s.warned.touch && sulky(s)) || s.petStreak >= petLimit(s) - 1 : false;
    const ok = kind => canAct(s, kind) && !off(kind);
    const used = kind => s.careBy[kind] || 0;
    const wish = s.wish;
    if (wish) {
      if (wish.kind === "watch") return { wait: true };
      if (wish.kind === "decor") return decor(s, wish.prop);
      if (wish.kind === "pet" && ok("pet")) return { kind: "pet", zone: petZone(s, memo) };
      if (wish.kind !== "pet" && ok(wish.kind)) return { kind: wish.kind };
    }
    if (lapReady(s) && s.cat.pose !== "lap" && !s.found.includes("lap_nap")) return { wait: true };
    if (canAct(s, "treat")) return { kind: "treat" };
    if (s.swings > 0 && s.swings < 5) return { kind: "play" };
    if (!used("play") && ok("play")) return { kind: "play" };
    if (ok("brush") && used("brush") < CARE_CAP.brush) return { kind: "brush" };
    if (used("props") < CARE_CAP.props) return decor(s, "ball");
    if (ok("pet") && used("pet") < CARE_CAP.pet) return { kind: "pet", zone: petZone(s, memo) };
    if (used("watch") < CARE_CAP.watch) return { wait: true };
    if (ok("play")) return { kind: "play" };
    return { wait: true };
  } },
};
// 物で誘う: 置いていなければ置く（もようがえ）、置いてあれば誘う。
function decor(s, want) {
  const id = want && unlockedProps(s.stage, s.metMashiro).some(p => p.id === want) ? want : "ball";
  if (slotOf(s, id)) return { kind: "invite", prop: id };
  return { kind: "place", prop: id, slot: id === "cushion" ? "bench" : id === "bed" ? "bed" : "floor" };
}
// お気に入りが分かればそこ、分からなければ頭→あご→背中と試す。
function petZone(s, memo) {
  if (s.sweetFound) return s.sweet;
  memo.tried = (memo.tried || 0) + 1;
  return SWEET_ZONES[memo.tried % 3];
}

/** 1回の来訪（presses 回触ったら帰る）。画面と同じ間合いで流し、sessionResult を返す。 */
export function runVisit(value, { player, presses: budget, seed = 1 }) {
  const s = createSession(value, { visitKey: tetsukoVisitKey(value) });
  const r = rng(seed * 7919 + s.day * 31 + s.count);
  const type = PLAYERS[player];
  const memo = { step: 0, zone: 0 };
  let t = 0, presses = 0, quietUntil = 0, lastInput = 0, photoUntil = 0, heldUntil = 0, waitingUntil = 0, peakAt = Infinity;
  let nextTick = autoDelay(s), nextAct = 1200;
  const seen = reaction => {
    if (reaction?.found) photoUntil = t + PHOTO_HOLD_MS;
    if (reaction?.joy?.peak) peakAt = t + PEAK_DELAY_MS;
    return reaction;
  };
  seen(openingReaction(s));
  const gapOf = () => type.gap[0] + r() * (type.gap[1] - type.gap[0]);
  while (!s.ended && presses < budget && t < 10 * 60 * 1000) {
    if (peakAt <= Math.min(nextTick, nextAct)) { t = peakAt; peakAt = Infinity; peakReaction(s); quietUntil = t + 2400; continue; }
    if (nextTick <= nextAct) {
      t = nextTick;
      if (t < quietUntil || t < heldUntil) { nextTick = t + autoDelay(s); continue; }
      seen(autonomous(s, { idle: t - lastInput >= WATCH_IDLE_MS, holding: t < photoUntil }));
      nextTick = t + autoDelay(s);
      continue;
    }
    t = nextAct;
    if (t < waitingUntil && s.wish?.kind === "watch") { nextAct = waitingUntil; continue; }
    const step = type.next(s, r, memo);
    if (step.wait) { waitingUntil = t + WATCH_IDLE_MS + 2500; nextAct = waitingUntil; continue; }
    const kind = step.kind;
    if (kind === "play" && t < heldUntil) { nextAct = heldUntil + 50; continue; }
    presses += 1;
    lastInput = t;
    if (kind === "place") { placeProp(s, step.slot, step.prop); nextTick = t + 600; nextAct = t + gapOf() + 1500; continue; }
    let reaction;
    if (kind === "invite") reaction = invite(s, step.prop);
    else if (kind === "play" && s.swings > 0 && s.swings + 1 >= 5) reaction = act(s, "catch");
    else reaction = act(s, kind, { zone: step.zone });
    seen(reaction);
    quietUntil = t + (kind === "treat" ? TREAT_MS : 0) + AFTER_ACTION_MS;
    // ボタンのじゃらしで飛びついたら、先は猫の近くにあるので捕まえる（画面の press → pounce → land と同じ）。
    if (reaction?.pounce && !s.ended) { t += POUNCE_MS; seen(act(s, "catch")); quietUntil = t + AFTER_ACTION_MS; }
    if (reaction?.kind === "catch" || s.last === "catch") heldUntil = t + TOY_HELD_MS;
    nextTick = t + autoDelay(s);
    nextAct = t + gapOf();
  }
  if (s.peakReady) peakReaction(s);
  if (s.wrapReady) wrapUpReaction(s);
  return { ...sessionResult(s), seconds: Math.round(t / 1000), drops: s.drops, turns: s.turns, mood: s.mood };
}

/** 来訪0回から、なかよしが肉球5つになるまで通う。次の来訪は翌日（おやつは1日1回）。 */
export function visitsToFull({ player, presses, day = 40 }) {
  const value = save(day);
  const perVisit = [], hearts = [], drops = [], seconds = [];
  let ember = null;
  for (let visit = 1; visit <= MAX_VISITS; visit += 1) {
    const before = readTetsukoRecord(value).affection;
    const result = runVisit(value, { player, presses, seed: visit });
    settleTetsukoTime(value, result);
    const after = readTetsukoRecord(value).affection;
    perVisit.push(after - before); hearts.push(result.hearts); drops.push(result.drops); seconds.push(result.seconds);
    if (ember === null && after >= BOND_EMBERS[0]) ember = visit;
    if (after >= JOY_MAX) return { visits: visit, ember, perVisit, hearts, drops, seconds };
    value.day += 1;
  }
  return { visits: null, ember, perVisit, hearts, drops, seconds };
}

const DAYS = Array.from({ length: 24 }, (_, i) => 3 + i * 5);
export const PLAYER_TYPES = Object.freeze(Object.keys(PLAYERS));
const median = xs => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;

/**
 * 遊び方 × 1回に触る回数ごとの結果:
 * visits・fastest・slowest＝肉球5つ（白火）までの来訪回数（中央値・最短・最長）／ember＝肉球3つ（火種）までの中央値／
 * perVisit＝1回に伸びるなかよしの中央値／hearts＝帰る時のハートの中央値／heartsMean＝その平均／fullRate＝ハートが5つそろった来訪の割合／
 * drops＝1回の来訪で嫌がらせて下がった回数の平均／seconds＝1回の来訪の長さ（秒）の中央値。
 */
export function measure({ players = PLAYER_TYPES, presses = [10, 20, 40], days = DAYS } = {}) {
  const out = {};
  const mean = xs => xs.length ? +(xs.reduce((sum, x) => sum + x, 0) / xs.length).toFixed(2) : 0;
  for (const player of players) for (const n of presses) {
    const runs = days.map(day => visitsToFull({ player, presses: n, day }));
    const visits = runs.map(run => run.visits ?? Infinity);
    const hearts = runs.flatMap(run => run.hearts);
    out[`${player}/${n}`] = {
      visits: median(visits), fastest: Math.min(...visits), slowest: Math.max(...visits),
      ember: median(runs.map(run => run.ember ?? Infinity)),
      perVisit: median(runs.flatMap(run => run.perVisit.slice(0, -1))),
      hearts: median(hearts), heartsMean: mean(hearts),
      fullRate: hearts.length ? +(hearts.filter(h => h >= JOY_HEARTS).length / hearts.length).toFixed(2) : 0,
      drops: mean(runs.flatMap(run => run.drops)),
      seconds: median(runs.flatMap(run => run.seconds)),
    };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = measure();
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 1));
  else for (const [key, row] of Object.entries(result)) {
    const [player, n] = key.split("/");
    console.log(`${player.padEnd(9)} 1回に${String(n).padStart(2)}手: 帰る時のハート 中央${row.hearts}・平均${row.heartsMean}（5つの回 ${Math.round(row.fullRate * 100)}%）`
      + ` 嫌がらせ 平均${row.drops}回／なかよし 1回に中央+${row.perVisit}、肉球3つまで${row.ember}回・5つまで 中央${row.visits}回（最短${row.fastest}・最長${row.slowest}）`
      + ` 1回およそ${row.seconds}秒`);
  }
}
void TETSUKO_TIME_FLAG;
