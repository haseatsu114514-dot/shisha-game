import { BULLS, KILLS, CLUSTERS, RINGS, POWER } from "./axe-model.js";
import { AXE_FEEL } from "./axe-feel.js";

/** Two layers (2026-11-13 手応えレビュー指摘6): the physical reaction follows the axe biting into wood, whatever it scores;
 *  the celebration (coloured rings, cheer, the +N burst) follows the resolved score only.
 *  tier names the size of the hit: wood (stuck for 0) / small (1-5) / medium (6) / large (7, 8). A drop has no tier. */
export function impactFeedback(shot) {
  const F = AXE_FEEL.impact, hit = shot?.score > 0, physical = Boolean(shot?.stuck);
  // Bullseye and killshot get an extra-strong celebration; the flag only reads the resolved outcome.
  const special = hit && (shot.outcome === "bull" || shot.outcome === "killshot");
  const tier = !physical ? null : !hit ? "wood" : shot.score >= 7 ? "large" : shot.score === 6 ? "medium" : "small";
  return { hit, celebration: hit, physical, special, tier,
    duration: hit ? F.duration : physical ? F.woodDuration : 0,
    strength: tier ? F.strength[tier] : 0,
    // 刺さった瞬間の止め（#003・#047）。強い一投ほど長い
    hitstop: tier ? AXE_FEEL.hitstop[tier] : 0,
    color: shot?.outcome === "killshot" ? "#9cecff" : hit ? "#ffe0a0" : "#c0643c",
    // 0点の札: 宣言した青を外した時は「宣言外」、それ以外は「MISS」
    burst: hit ? "+" + shot.score : shot?.outcome === "killshot-miss" ? "宣言外" : "MISS" };
}
/** How long the flying axe is held at the moment it meets the board: a stick by its tier, a drop shows the bad contact first. */
export function contactHold(shot) {
  if (!shot) return 0;
  if (shot.stuck) return impactFeedback(shot).hitstop;
  return shot.dropReason === "off-board" ? 0 : AXE_FEEL.hitstop.drop;
}

/** The thrower's own rotation, in words that say which way and how much to change (2026-11-13 指摘4・桜井 #023・#009).
 *  inputMode "tap-pull" speaks of flick speed; the legacy gauges speak of when to let go. */
export function powerVerdict(power, { inputMode = "gauges" } = {}) {
  const pct = Math.round(power * 100), tap = inputMode === "tap-pull";
  // short は結果カードの1行（↻ は回転の印）。text は読み上げと説明用の全文
  if (power >= POWER.sweetMin && power <= POWER.sweetMax) return { pct, zone: "sweet", text: "回転 " + pct + "% · ちょうどいい", short: "↻" + pct + "% ちょうどいい" };
  const low = power < POWER.sweetMin, far = (low ? POWER.sweetMin - power : power - POWER.sweetMax) > .08;
  const drop = power < POWER.stickMin || power > POWER.stickMax;
  const state = power < POWER.stickMin ? "柄から当たる" : power > POWER.stickMax ? "回りすぎ" : low ? "回転が足りない" : "回り気味";
  const fix = tap ? (low ? (far ? "もっと速く弾く" : "あと少し速く") : (far ? "もっとゆっくり弾く" : "少しゆっくり"))
    : (low ? (far ? "もっと待って放す" : "あと少し待って放す") : (far ? "もっと早く放す" : "少し早く放す"));
  const brief = tap ? (low ? (far ? "もっと速く" : "少し速く") : (far ? "もっとゆっくり" : "少しゆっくり")) : (low ? (far ? "もっと待って" : "少し待って") : (far ? "もっと早く" : "少し早く"));
  return { pct, zone: drop ? "drop" : "edge", low, text: "回転 " + pct + "% · " + state + " · " + fix, short: "↻" + pct + "% " + brief };
}

export const killPlaces = { "upper-left": "左上", "upper-right": "右上", "lower-left": "左下", "lower-right": "右下" };
export const clusterPlaces = { center: "中央", ul: "左上", ur: "右上", ll: "左下", lr: "右下" };
/** Shown only when a new killshot blue is declared; declaring the same blue, or going back to normal, gives no cue. */
export function declarationCue(prevCalled, nextCalled) {
  if (!nextCalled || nextCalled === prevCalled) return null;
  if (!KILLS.some(target => target.id === nextCalled)) return null;
  return { label: "KILL SHOT 宣言", target: nextCalled, place: killPlaces[nextCalled] };
}

const redCenters = CLUSTERS.map(c => ({ x: c.x, y: c.y, id: c.id }));
function direction(landing, targets) {
  const nearest = targets.reduce((best, target) =>
    Math.hypot(target.x - landing.x, target.y - landing.y) < Math.hypot(best.x - landing.x, best.y - landing.y) ? target : best);
  const dx = nearest.x - landing.x, dy = nearest.y - landing.y;
  return (Math.abs(dx) > .025 ? dx < 0 ? "左" : "右" : "") + (Math.abs(dy) > .025 ? dy < 0 ? "上" : "下" : "");
}

/** Copy follows the resolved outcome; it never changes scoring or the next throw. */
export function shotFeedback(shot, { inputMode = "gauges" } = {}) {
  // 弾いて投げる操作では % はゲージの語彙なので、動作の言葉で言う（指摘4）
  const advice = inputMode === "tap-pull" ? (shot.dropReason === "weak" ? "次は、ひと息で今より少し速く弾こう。" : "次は、もうひと呼吸ゆっくり弾こう。")
    : "次は緑の54〜70%で放そう。";
  if (shot.outcome === "drop") return { label: "DROP", tone: "drop",
    tip: (shot.dropReason === "weak" ? "柄から当たって落下。" : "回りすぎて落下。") + advice + (shot.half !== undefined ? "落下は追加の宣言を1回もらえる。" : "") };
  if (shot.outcome === "killshot") return { label: "KILLSHOT", tone: "killshot",
    tip: shot.score === 8 ? "宣言した青の中心に刃が届いた！ 8点の最高の一投。" : "宣言した青に刃が触れた！ 狙いと回転が決まった。" };
  if (shot.outcome === "bull") return { label: "BULL'S EYE", tone: "bull",
    tip: shot.zone?.cluster && shot.zone.cluster !== "center" ? "外側の赤い中心に命中！ 6点。" : "赤い中心に命中！ 鮮やかな一投。" };
  if (shot.outcome === "killshot-miss") {
    const target = KILLS.find(target => target.id === shot.called);
    const toward = !shot.stuck ? "板の外。次は宣言した青へ。" : target ? "次は着地点から" + direction(shot.landing, [target]) + "の青を狙おう。" : "次は宣言した青を狙おう。";
    return { label: "MISS", tone: "miss", tip: "宣言した青だけが得点対象。" + toward };
  }
  if (shot.zone?.kind === "closed") return { label: "CLOSED", tone: "miss",
    tip: "この半分で使った5の円に触れて0点。開いている赤い中心へ回ろう。" };
  const hit = shot.outcome === "hit";
  const focus = shot.sway?.fatigue >= .7 && !shot.sway.focused ? "構えが長いときは「息を整える」も。" : "";
  const closedNote = shot.zone?.kind === "ring" && shot.score >= 3 && shot.closedAdjust ? "閉じた赤に触れたのでリングの点。" : "";
  return { label: hit ? "ON TARGET" : "MISS", tone: hit ? "hit" : "miss",
    tip: (!shot.stuck ? "板の外。" : closedNote) + "次は着地点から" + direction(shot.landing, redCenters) + "の赤い中心を狙おう。" + focus };
}

/** Average is numeric, rounded to two decimals like a league stat sheet. Streak is the best run of 6+ points. */
export function sessionStats(shots = []) {
  let bulls = 0, killshots = 0, stuck = 0, drops = 0, total = 0, best = 0, streak = 0, run = 0, calls = 0;
  for (const shot of shots) {
    bulls += Number(shot.outcome === "bull" && shot.score === 6);
    killshots += Number(shot.outcome === "killshot");
    calls += Number(Boolean(shot.called));
    stuck += Number(Boolean(shot.stuck)); drops += Number(!shot.stuck);
    total += shot.score; best = Math.max(best, shot.score);
    run = shot.score >= 6 ? run + 1 : 0; streak = Math.max(streak, run);
  }
  return { bulls, killshots, calls, stuck, drops, average: shots.length ? Math.round(total / shots.length * 100) / 100 : 0, best, streak };
}
export { BULLS };

/** Handle quiver after the axe sticks: a decaying wobble around the cutting edge, gone after 420ms. */
export const QUIVER_MS = AXE_FEEL.quiver.ms;
export function quiverAt(milliseconds) {
  const Q = AXE_FEEL.quiver;
  if (!(milliseconds >= 0) || milliseconds >= Q.ms) return null;
  const decay = (1 - milliseconds / Q.ms) ** 2, wave = Math.sin(milliseconds * .075);
  return { rotate: Q.rotate * wave * decay, scale: 1 + Q.scale * Math.sin(milliseconds * .075 + 1.2) * decay };
}

/** Plain words for the zone the blade touched, shown in the judge's close-up. */
export function zoneLabel(shot) {
  const zone = shot.zone || {};
  if (zone.kind === "kill") return killPlaces[shot.called] + "の青" + (shot.score === 8 ? "の中心" : "");
  if (zone.kind === "bull") return clusterPlaces[zone.cluster] + "の赤に触れた";
  if (zone.kind === "five") return clusterPlaces[zone.cluster] + "の5の円";
  if (zone.kind === "ring") return shot.score + "のリング";
  if (zone.kind === "closed") return "閉じた円に触れた";
  if (shot.called) return "宣言した青の外";
  return "得点圏の外";
}

/** The circle of the zone the blade would score, in board units, or null when it scores nothing. */
export function haloFor(shot) {
  if (!shot?.stuck || !shot.score) return null;
  const zone = shot.zone || {};
  if (zone.kind === "kill") { const k = KILLS.find(t => t.id === shot.called); return { kind: "kill", x: k.x, y: k.y, r: shot.score === 8 ? k.inner : k.outer }; }
  const cluster = CLUSTERS.find(c => c.id === zone.cluster);
  if (zone.kind === "bull" && cluster) return { kind: "bull", x: cluster.x, y: cluster.y, r: RINGS[0].radius };
  if (zone.kind === "five" && cluster) return { kind: "five", x: cluster.x, y: cluster.y, r: RINGS[1].radius };
  if (zone.kind === "ring") return { kind: "ring", x: 0, y: 0, r: RINGS[6 - shot.score].radius };
  return null;
}
