// MOKUMOKUパッキー — 謎のマスコット「パッキー」のスロット（日常リール）。
// 仕様の正典は docs/pakki_slot_spec.md。抽選の中身（役・確率・天井・裏確変）は旧版 web/js/reel.js と同一。
//
// Aタイプ＋天井。「1行動=1回転」でマップ隅のミニ筐体が回り、パッキーの顔が光ったら大当たり（完全告知）。
// ・抽選は決定論RNG（シード＋総回転数）— ロードしても結果が変わらない＝リセマラ不可
// ・恩恵はステータスのみ:「直前の行動で伸びたステがさらに伸びる」アンコール抽選
// ・ハズレでも対象ステ+1（サイレント）。天井（ゾーン/本天井・持ち越し）で最終的に全員救済
// ・結果と報酬は行動した瞬間に確定・適用し、演出は次にマップを開いたときに後追いで見せる
import { el, sleep } from "../core/util.js";
import { layers, gainCard } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state, save, STAT_KEYS, STAT_JA } from "../core/state.js";
import { gainStat, star, rankLabel } from "../core/stats.js";
import { DB, faceIconUrl } from "../core/data.js";
import { SE } from "../core/audio.js";

// ================================================================ 純粋コア（旧版と同一）

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 回転番号ごとに独立したストリームを切る（seed と count を混ぜる）
function rngFor(seed, count) {
  return mulberry32((seed ^ Math.imul(count + 1, 2654435761)) >>> 0);
}

// 役テーブル（weight 合計 1000）。1章 ≒ 14日×2行動 = 28回転 前提で逆算
const ROLES = [
  { id: "miss", weight: 666 },
  { id: "replay", weight: 137 },
  { id: "cherry", weight: 110 },
  { id: "bell", weight: 28 },
  { id: "rare", weight: 5 },   // 中段チェリー/単独パッキー → BIG確定（プレミア告知）
  { id: "reg", weight: 24 },
  { id: "big", weight: 26 },
  { id: "freeze", weight: 4 }, // 名目値。実際は FREEZE_CONTROL が管理する
];
const PEKA = ["reg", "big", "freeze", "rare"];
const CHERRY_OVERLAP = { chance: 0.0625, bigShare: 0.45 };
const FREEZE_CONTROL = { warmupSpins: 20, baseWeight: 4, pityAt: 110, pityWeight: 12, maxPerSave: 1 };
const RESCUE = { minSpins: 30, ratio: 0.55, mult: 1.7, expectedRate: 0.075 };
const CEILING = { zoneRun: 8, mainRun: 15 };
const JUG_REN = { games: 5, mult: 1.5 };
const REPLAY_CHAIN_MAX = 4;
// 恩恵はステータスのみ。exp は直前の行動で伸びたステへの上乗せ量。quiet は通知なし
const EFFECTS = {
  miss: { exp: 1, quiet: true },
  replay: { exp: 1, quiet: true },
  cherry: { exp: 2 },
  bell: { exp: 3 },
  rare: { exp: 6, zone: true },
  reg: { exp: 4 },
  big: { exp: 6, zone: true },
  freeze: { exp: 8, zone: true },
};

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let v = rng() * total;
  for (const e of entries) { v -= e.weight; if (v < 0) return e.id; }
  return entries[entries.length - 1].id;
}

function effectiveTable(st) {
  const t = ROLES.map((r) => ({ ...r }));
  const get = (id) => t.find((r) => r.id === id);
  let fz = FREEZE_CONTROL.baseWeight;
  if ((st.freezeCount || 0) >= FREEZE_CONTROL.maxPerSave) fz = 0;
  else if (st.count < FREEZE_CONTROL.warmupSpins) fz = 0;
  else if (st.count >= FREEZE_CONTROL.pityAt) fz = FREEZE_CONTROL.pityWeight;
  get("big").weight += FREEZE_CONTROL.baseWeight - fz;
  get("freeze").weight = fz;
  if (st.count >= RESCUE.minSpins && (st.bonusCount || 0) < st.count * RESCUE.expectedRate * RESCUE.ratio) {
    let added = 0;
    for (const id of ["reg", "big"]) {
      const inc = Math.round(get(id).weight * (RESCUE.mult - 1));
      get(id).weight += inc; added += inc;
    }
    get("miss").weight = Math.max(1, get("miss").weight - added);
  }
  if (st.zoneLeft > 0) {
    let added = 0;
    for (const id of ["reg", "big"]) {
      const inc = Math.round(get(id).weight * (JUG_REN.mult - 1));
      get(id).weight += inc; added += inc;
    }
    get("miss").weight = Math.max(1, get("miss").weight - added);
  }
  return t;
}

function rollRole(rng, st) {
  if (st.bonusGap >= CEILING.mainRun) return pickWeighted(rng, ROLES.filter((r) => r.id === "reg" || r.id === "big"));
  let role = pickWeighted(rng, effectiveTable(st));
  if (role === "miss" && st.missRun >= CEILING.zoneRun) {
    role = pickWeighted(rng, ROLES.filter((r) => !["miss", "freeze", "rare"].includes(r.id)));
  }
  return role;
}

// 告知のタイミング（オーナー指定・2026-09-28: ジャグラーと同じく先告知・後告知を半々）
//   before=先告知: レバーを叩いた瞬間にランプが光り、その回転でそのまま赤7を狙って揃える
//   after =後告知: リールがハズレ目で止まってからランプが光り、もう1回転して揃える
const VARIANTS = [
  { id: "before", weight: 50 },
  { id: "after", weight: 50 },
];

// リール図柄: seven=赤7 / bar=BAR / bell=ベル / cherry=チェリー / replay=リプレイ(水の青) / smoke=煙（ジャグラーのぶどうの位置）/ pakki=パッキー柄（ピエロの位置）
// 配列はジャグラー準拠（オーナー指定・2026-09-28）。上から下へ並べた順＝窓に上から見える順（リールは下向きに回る）
//   左: BAR の真下にチェリー（BARを狙うと角にチェリーが見える）。7 の下にもチェリー
//   右: 7 の真下に BAR（ボーナスの最後の1リールで「7か、BARか」がギリギリまで分からない）
const STRIPS = [
  ["seven", "cherry", "smoke", "replay", "smoke", "bar", "cherry", "smoke", "replay", "smoke", "bell", "smoke", "replay", "smoke", "pakki", "smoke", "replay", "smoke", "bar", "cherry", "replay"],
  ["seven", "replay", "smoke", "cherry", "smoke", "replay", "bell", "smoke", "replay", "bar", "smoke", "replay", "smoke", "pakki", "replay", "smoke", "cherry", "smoke", "replay", "smoke", "smoke"],
  ["replay", "smoke", "seven", "bar", "smoke", "replay", "cherry", "smoke", "replay", "bell", "smoke", "replay", "smoke", "seven", "smoke", "replay", "pakki", "smoke", "replay", "bar", "smoke"],
];
function stripIdx(strip, sym, rng) {
  const cands = [];
  strip.forEach((s, i) => { if (s === sym) cands.push(i); });
  return cands[Math.floor(rng() * cands.length)] || 0;
}
function safeSmoke(strip, rng) {
  const cands = [];
  strip.forEach((s, i) => {
    if (s !== "smoke") return;
    const n = strip.length;
    if (strip[(i + 1) % n] === "cherry" || strip[(i - 1 + n) % n] === "cherry") return;
    cands.push(i);
  });
  return cands[Math.floor(rng() * cands.length)] || 0;
}
function stopsFor(role, rng) {
  const missStops = () => {
    const midSym = rng() < 0.5 ? "smoke" : "cherry";
    const rightSym = midSym === "smoke" ? "replay" : (rng() < 0.5 ? "smoke" : "replay");
    return [safeSmoke(STRIPS[0], rng), stripIdx(STRIPS[1], midSym, rng), stripIdx(STRIPS[2], rightSym, rng)];
  };
  switch (role) {
    case "replay": return STRIPS.map((s) => stripIdx(s, "replay", rng));
    case "bell": return STRIPS.map((s) => stripIdx(s, "bell", rng));
    case "cherry": {
      const c = stripIdx(STRIPS[0], "cherry", rng);
      const off = rng() < 0.5 ? 1 : -1;
      return [(c + off + STRIPS[0].length) % STRIPS[0].length, stripIdx(STRIPS[1], "smoke", rng), stripIdx(STRIPS[2], "smoke", rng)];
    }
    case "rare": {
      const sym = rng() < 0.6 ? "cherry" : "pakki";
      return [stripIdx(STRIPS[0], sym, rng), stripIdx(STRIPS[1], "smoke", rng), stripIdx(STRIPS[2], "replay", rng)];
    }
    default: return missStops();
  }
}

/** 1行動ぶんの抽選（リプレイ連鎖込み）。reel のカウンタを進め、結果配列を返す */
function spinSeries(reel, ctx) {
  const results = [];
  let chain = 0;
  do {
    const rng = rngFor(reel.seed, reel.count);
    const st = {
      count: reel.count, missRun: reel.missRun, bonusGap: reel.bonusGap,
      zoneLeft: reel.zoneLeft, bonusCount: reel.bonusCount || 0, freezeCount: reel.freezeCount || 0,
    };
    const role = rollRole(rng, st);
    let overlap = null;
    if (role === "cherry" && rng() < CHERRY_OVERLAP.chance) overlap = rng() < CHERRY_OVERLAP.bigShare ? "big" : "reg";
    const eff = EFFECTS[role];
    const isPeka = PEKA.includes(role) || !!overlap;
    const premium = role === "rare" || role === "freeze";
    const result = {
      n: reel.count, role, overlap, premium,
      stops: stopsFor(role, rng),
      variant: isPeka && role !== "freeze" ? (premium ? "premium" : pickWeighted(rng, VARIANTS)) : "none",
      exp: (eff.exp || 0) + (overlap ? EFFECTS[overlap].exp : 0),
      quiet: !!eff.quiet && !overlap,
      zone: !!eff.zone || overlap === "big",
      gakkun: !!ctx && !!ctx.chapterFirst && chain === 0,
      ceiling: st.bonusGap >= CEILING.mainRun ? "main" : (role !== "miss" && st.missRun >= CEILING.zoneRun ? "zone" : ""),
      afterReplay: chain > 0,
    };
    reel.count += 1;
    reel.missRun = role === "miss" ? reel.missRun + 1 : 0;
    reel.bonusGap = isPeka ? 0 : reel.bonusGap + 1;
    result.ceilingRemain = isPeka ? CEILING.mainRun : Math.max(0, CEILING.mainRun - reel.bonusGap);
    reel.bonusCount = (reel.bonusCount || 0) + (isPeka ? 1 : 0);
    if (role === "freeze") reel.freezeCount = (reel.freezeCount || 0) + 1;
    if (result.zone) reel.zoneLeft = JUG_REN.games;
    else if (reel.zoneLeft > 0) reel.zoneLeft -= 1;
    results.push(result);
    if (role !== "replay") break;
    chain += 1;
  } while (chain < REPLAY_CHAIN_MAX);
  return results;
}

/** 分布の確認用（コンソール: __remake.reel.simulate(100000)） */
export function simulate(n, seed = 1) {
  const reel = { seed: seed >>> 0, count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0 };
  const dist = {};
  let spins = 0, exp = 0, pekas = 0, maxGap = 0, gap = 0;
  while (spins < n) {
    for (const r of spinSeries(reel, {})) {
      dist[r.role] = (dist[r.role] || 0) + 1;
      exp += r.exp; spins++;
      const peka = PEKA.includes(r.role) || !!r.overlap;
      if (peka) { pekas++; gap = 0; } else { gap++; maxGap = Math.max(maxGap, gap); }
    }
  }
  return { spins, exp, pekaRate: spins / pekas, maxGap, dist };
}

export const core = { mulberry32, rngFor, ROLES, EFFECTS, PEKA, CEILING, STRIPS, spinSeries, stopsFor, effectiveTable, simulate };

// ================================================================ 行動時のコミット

// 直前の行動で伸びたステ（gainStat の「stat-raw」を拾う）。スロット自身の加算は数えない
let statBuffer = {};
let selfGain = false;
on("stat-raw", ({ key, got }) => {
  if (selfGain || !(got > 0)) return;
  statBuffer[key] = (statBuffer[key] || 0) + got;
});
function pickTarget() {
  const keys = Object.keys(statBuffer);
  let target = null;
  if (keys.length) target = STAT_KEYS.filter((k) => keys.includes(k)).sort((a, b) => statBuffer[b] - statBuffer[a])[0];
  else target = STAT_KEYS.slice().sort((a, b) => state.stats[a] - state.stats[b])[0]; // 伸びなかった行動は一番低いステへ
  statBuffer = {};
  return target || "guts";
}

/** 日常の行動を1回消費したら呼ぶ。結果と報酬はこの瞬間に確定する（演出は次のマップ表示で） */
export function onAction() {
  if (!state?.reel || state.phase !== "daily") { statBuffer = {}; return; }
  const reel = state.reel;
  const chapterFirst = reel.lastChapter !== state.chapter;
  reel.lastChapter = state.chapter;
  const target = pickTarget();
  for (const r of spinSeries(reel, { chapterFirst })) {
    // 経験値として足す（章の上限・★段階の伸びにくさはふつうの伸びと同じ扱い）。通知は演出のときに出す
    selfGain = true;
    const before = { ...state.stats };
    const got = gainStat(target, r.exp, { silent: true });
    selfGain = false;
    // 上限に届いた項目は gainStat が別の項目へ振り替えるので、実際に伸びた方を記録する
    const key = STAT_KEYS.find((k) => state.stats[k] > before[k]) || target;
    r.target = key;
    r.got = got;
    if (star(key) > Math.max(1, Math.ceil(before[key] / 20))) r.starTo = star(key);
    const note = reel.note || (reel.note = {});
    note[r.role] = (note[r.role] || 0) + 1;
    if (r.overlap) note.cherryOverlap = (note.cherryOverlap || 0) + 1;
    reel.pending.push(r);
  }
}

// ================================================================ ミニ筐体（マップ左下）

const CELL = 26;
const LEN = STRIPS[0].length;
// 小筐体と拡大盤で同じ生成画像のアトラスを使う（配置は reel.css）。
const SYM = Object.fromEntries(["seven", "bar", "bell", "cherry", "replay", "smoke", "pakki"]
  .map((id) => [id, () => `<span class="sym sym-${id}" aria-hidden="true"></span>`]));

let widget = null;
let busy = false;
let bonusWait = null;

function pakkiFace(cls = "") {
  const f = faceIconUrl("pakki");
  return f ? el(`img.rw-face${cls}`, { src: f, alt: "" }) : el(`span.rw-face.txt${cls}`, { text: "ぷ" });
}

// 小筐体と拡大筐体は同じ部品を使い、CSSの倍率だけで大きさを変える。
function cabinetParts(lamp, machine) {
  return [
    el("div.rw-lamp-wrap", [el("span.rw-lamp-rays"), lamp]),
    el("span.rw-lever-arm", { "aria-hidden": "true" }, [el("span.rw-lever-pivot")]),
    machine,
    el("div.rw-plate", { html: "MOKUMOKU<b>パッキー</b>" }),
  ];
}

function buildWidget() {
  const lamp = el("button.rw-lamp", { title: "MOKUMOKUパッキー", dataset: { test: "reel-lamp" }, onclick: () => { if (bonusWait) settleBonus(bonusWait, false); } }, [pakkiFace()]);
  const machine = el("div.rw-machine");
  machine.innerHTML = STRIPS.map((strip) =>
    `<div class="rw-reel"><div class="rw-strip" style="--loop:${-CELL * strip.length}px">${strip.concat(strip, strip).map((s) => `<div class="rw-cell">${SYM[s]()}</div>`).join("")}</div></div>`).join("");
  const w = el("div.reel-widget", [
    ...cabinetParts(lamp, machine),
    el("div.rw-bubble"),
  ]);
  return w;
}
const strips = () => [...widget.querySelectorAll(".rw-strip")];
const tyFor = (idx) => -CELL * (idx + LEN - 1);
function setStops(stops) {
  strips().forEach((s, i) => { s.classList.remove("spinning"); s.style.transform = `translateY(${tyFor(stops[i])}px)`; });
}
const alive = () => !!widget && widget.isConnected;

function bubble(text, ms = 1800, cls = null) {
  if (!alive()) return;
  const b = widget.querySelector(".rw-bubble");
  b.textContent = text;
  b.classList.remove("hot", "rare");
  if (cls) b.classList.add(cls);
  b.classList.toggle("show", !!text);
  clearTimeout(bubble.t);
  if (ms) bubble.t = setTimeout(() => b.classList.remove("show"), ms);
}
const recent = [];
function pick(pool) {
  let c, tries = 0;
  do { c = pool[Math.floor(Math.random() * pool.length)]; tries++; } while (recent.includes(c) && tries < 10 && pool.length > 3);
  recent.push(c); if (recent.length > 3) recent.shift();
  return c;
}
function lampOn(premium) {
  if (!alive()) return;
  widget.querySelector(".rw-lamp").classList.add("lit");
  widget.classList.add("lamp-lit", "win-flash");
  widget.classList.remove("warm");
  widget.classList.toggle("lamp-premium", !!premium);
}
function lampOff() {
  if (!alive()) return;
  widget.querySelector(".rw-lamp").classList.remove("lit");
  widget.classList.remove("lamp-lit", "lamp-premium", "win-flash");
}

/**
 * 筐体を host に置き、溜まった結果を順に見せる。戻り値=見せ終わったら解決する Promise
 * （マップでは待たずに操作できる。夜の行動のあとは calendar が待ってから一日を終える）
 */
export function mountReel(host, { delay = 500 } = {}) {
  if (!state?.reel) return Promise.resolve();
  // 演出中は、停止処理が参照している同じリールを新しいマップへ移す。
  // 筐体だけ作り直すと、古いリールが止まり、新しい方には前回の出目が残る。
  if (busy) {
    host.append(widget);
    return current;
  }
  widget = buildWidget();
  host.append(widget);
  setStops(state.reel.shown || [1, 1, 2]); // 前回見せた出目のまま（未消化の結果は出目に出さない）
  const queue = state.reel.pending;
  if (!queue.length) return Promise.resolve();
  busy = true; // 初回説明の待機中も、再マウントで別の演出を始めない。
  current = (async () => {
    try {
      if (!state.reel.introDone) await showIntro();
      // 取り出してから保存（演出の途中でリロードしても二重に適用しない。報酬は適用済み）
      const items = queue.splice(0, queue.length);
      save();
      if (delay) await sleep(delay);
      while (items.length) {
        const r = items.shift();
        // 積み残しが複数なら最後の1件だけフル演出。リプレイ連鎖は何が起きたか分かるようにフルで見せる
        const fast = items.length > 0 && !(r.role === "replay" || r.afterReplay);
        await presentSpin(r, fast);
      }
    } catch (e) {
      console.warn("[reel]", e); // 演出が崩れても報酬は適用済み。次のマップで固まらないようにする
    } finally {
      busy = false;
    }
  })();
  return current;
}
let current = Promise.resolve();

/** 夜の行動のあと: その場でスロットを見せてから一日を終える（翌朝まで持ち越さない） */
export async function presentNow() {
  await current; // 昼の分の演出が途中なら、終わってから今夜の分を回す
  if (!state?.reel?.pending?.length) return;
  const host = el("div.reel-night", [el("div.rn-label", { text: "今夜のスロット" })]);
  layers.fx.append(host);
  requestAnimationFrame(() => host.classList.add("show"));
  // フェードインした時点で今夜の回転を始めておく。前回の停止出目を見せて待たない。
  await mountReel(host, { delay: 0 });
  await sleep(900);
  host.classList.remove("show");
  await sleep(300);
  host.remove();
}

async function presentSpin(r, fast) {
  if (!alive()) { announce(r); return; }
  if (bonusWait) settleBonus(bonusWait, true);
  lampOff();
  if (!fast) { widget.classList.add("lever-pull"); setTimeout(() => widget?.classList.remove("lever-pull"), 380); }
  if (r.gakkun) { widget.classList.add("gakkun"); setTimeout(() => widget?.classList.remove("gakkun"), 500); }
  SE.reelLever();
  const ss = strips();
  ss.forEach((s) => { s.style.transform = ""; s.classList.add("spinning"); });
  if (r.role === "freeze" && !fast) return presentFreeze(r);
  // 先告知: レバーオンで光ったら、ハズレ目を見せずにこの回転で揃えにいく
  if (!fast && (r.role === "reg" || r.role === "big") && !r.overlap && r.variant === "before") return presentPreAnnounce(r);

  const spinMs = fast ? 120 : r.role === "miss" ? 240 : 420;
  const gap = fast ? 40 : 130;
  const willPeka = PEKA.includes(r.role) || !!r.overlap;
  const tension = willPeka && !fast;
  const tensionMs = tension ? 560 : 0;
  await sleep(spinMs);
  for (let i = 0; i < 3; i++) {
    await sleep(i === 0 ? 0 : gap + (i === 2 ? tensionMs : 0));
    if (!alive()) break;
    const s = ss[i];
    s.classList.remove("spinning");
    s.style.transform = `translateY(${tyFor(r.stops[i])}px)`;
    s.classList.add("land");
    setTimeout(() => s.classList.remove("land"), 240);
    if (!fast) SE.reelStop();
    if (tension && i === 1) widget.classList.add("tension");
    if (i === 2) widget.classList.remove("tension");
  }
  await sleep(fast ? 60 : 200);
  if (alive()) widget.classList.remove("tension");
  state.reel.shown = r.stops;
  await afterStop(r, fast);
}

// 役の恩恵をパッキー口調で（数値は出さず体感語で）
function benefitLine(r) {
  const amt = r.exp >= 6 ? "ぐーんと" : r.exp >= 4 ? "かなり" : r.exp >= 2 ? "ちょっと" : "少し";
  return r.target ? `【${STAT_JA[r.target]}】が${amt}上がったよ！` : `${amt}上がったよ！`;
}
const CEILING_HINTS = {
  far: ["……近いかも？", "そろそろ？", "む、来そう", "気配がする……", "んん？", "ボクの勘が……"],
  near: ["もうすぐ……！？", "近い……！", "ピクッ……！", "あと少し……？", "うずうず……！", "そろそろだよっ"],
  soon: ["次っ……！？", "来るッ……！", "いつ光っても……！", "ビンビンくる……！", "うおっ、もう！", "ためてためて……！"],
};
// パッキーの人格＝かわいい見た目で他人事、たまに毒、基本ごきげん
const FUN_MISS = [
  "はずれ〜♪", "ぷぷっ、ノーカン！", "むむ、惜しい", "今、力ためてる！たぶん", "ボクはウソつくよ♪",
  "やる気は満タン！", "次に期待してね♪", "知ってた（嘘）", "ボクのせいじゃないよ？",
  "煙、いい色〜", "まばたきした？", "今のは練習！", "宇宙を感じる……", "ぷかぷか〜", "ぐぬぬ",
  "……はっ、寝てた", "ノーコメントで！", "むむむ", "ぼちぼち〜", "外れの音も、わりと好き",
  "ふー、ねむい", "鼻がムズムズ", "おっと", "んっ、今の見た？", "へいきへいき", "ボクは元気〜",
  "もういっちょ！", "ぷっぷくぷー", "なんでもないよ", "むにゃ……", "しゃきーん",
  "おなかすいた", "次こそ次こそ", "ボクを信じて？", "うーん、地味", "運も仕込みのうち！",
  "ぼー……", "き、来るかと思った", "ふっかーつ！", "そういう日もある", "夢は次回に持ち越し！",
  "けむに巻かれたね♪", "回すキミの顔、真剣〜", "光る予定は未定！", "ハズレも実力のうち♪",
];
const RARE_MISS = [
  "ねえ、たまにはボクの話も♪", "（小声）誰が作ったんだろ、これ", "スミさん、さっき笑ってたよ？",
  "今、いい匂いした。気のせい？", "案外いいコンビかもね", "キミの煙、ボク好きだよ",
  "ボク、夜はどこで寝てると思う？", "光る瞬間はね、ボクにも見えないんだ",
];
const bonusName = (r) => (r.role === "big" || r.overlap === "big" ? "ビッグボーナス" : r.role === "rare" ? "プレミア" : "レギュラーボーナス");

async function afterStop(r, fast) {
  switch (r.role) {
    case "miss":
      if (alive()) widget.classList.toggle("warm", r.ceilingRemain > 0 && r.ceilingRemain <= 3);
      if (!fast) {
        if (r.ceilingRemain > 0 && r.ceilingRemain <= 5) {
          const pool = r.ceilingRemain <= 1 ? CEILING_HINTS.soon : r.ceilingRemain <= 3 ? CEILING_HINTS.near : CEILING_HINTS.far;
          bubble(pick(pool), 1500, r.ceilingRemain <= 1 ? "hot" : null);
          if (r.ceilingRemain <= 2) SE.puka();
        } else if (Math.random() < 0.04) { bubble(pick(RARE_MISS), 2200, "rare"); SE.reelWin(); }
        else bubble(pick(FUN_MISS), 1400);
      }
      return;
    case "replay":
      if (fast) { await sleep(60); return; }
      widget?.classList.add("flash-blue"); SE.reelWin();
      bubble("リプレイ成立！", 0);
      setTimeout(() => widget?.classList.remove("flash-blue"), 520);
      await sleep(1050);
      bubble("……もう1回転！", 1000); SE.puka();
      await sleep(650);
      return;
    case "cherry":
      SE.reelWin();
      if (!r.overlap) {
        if (!fast) { bubble("チェリーッ！", 800); setTimeout(() => bubble(benefitLine(r), 1500), 850); }
        announce(r);
        await sleep(fast ? 60 : 700);
        return;
      }
      await sleep(fast ? 0 : 600);
      return peka(r, fast, false, "えっ、チェリーと一緒に光った！？");
    case "bell":
      SE.reelWin();
      if (!fast) { bubble("パインッ！", 800); setTimeout(() => bubble(benefitLine(r), 1500), 850); }
      announce(r);
      await sleep(fast ? 60 : 800);
      return;
    case "rare":
      if (!fast) { SE.pugo(); await sleep(650); }
      return peka(r, fast, true, "ぷぷぷぷぷ！！");
    case "reg":
    case "big":
      // 後告知: 止まったリールを一拍見せてから、ペカッ
      await sleep(fast ? 0 : 420);
      return peka(r, fast, r.ceiling === "main", r.ceiling === "main" ? "おたすけパッキー！" : "ぷぷぷっ！ 光った！");
    default:
      announce(r);
  }
}

// 先告知: レバーを叩いた瞬間にランプが光る → 小筐体は回したまま、大きなリールでこの回転を赤7に止める
async function presentPreAnnounce(r) {
  lampOn(r.ceiling === "main");
  SE.puka();
  bubble(r.ceiling === "main" ? "おたすけパッキー！" : "先ペカッ！ このまま7を狙って！", 0);
  await sleep(900);
  await new Promise((resolve) => settleBonus({ ...r, done: resolve }, false, "pre"));
}

// プカッ（完全告知）。光ったら少し見せてから自動で揃える（タップは早送り）
function peka(r, fast, premium, line) {
  return new Promise((resolve) => {
    lampOn(premium);
    SE.puka();
    bubble(line, 0);
    bonusWait = { ...r, done: resolve };
    if (fast) return settleBonus(bonusWait, true);
    setTimeout(() => { if (bonusWait && bonusWait.n === r.n) settleBonus(bonusWait, false); }, 750);
  });
}

/** ボーナスを揃える。mode: "post"=後告知（もう1回転して揃える）／"pre"=先告知（この回転で揃える） */
function settleBonus(b, fast, mode = "post") {
  bonusWait = null;
  lampOff();
  bubble("", 1);
  if (!fast && alive()) {
    widget.classList.remove("bonus-pop");
    void widget.offsetWidth;
    widget.classList.add("bonus-pop");
    setTimeout(() => widget?.classList.remove("bonus-pop"), 700);
  }
  const isBig = b.role === "big" || b.role === "rare" || b.overlap === "big";
  const finish = () => {
    announce(b);
    if (!fast) {
      const cls = isBig ? "hot" : null;
      bubble(`${bonusName(b)}ッ！`, 950, cls);
      setTimeout(() => bubble(benefitLine(b), 1900, cls), 1000);
    }
    if (b.done) { const d = b.done; b.done = null; d(); }
  };
  const lineUp = bonusLine(isBig);
  if (fast || !alive()) { if (alive()) setStops(lineUp); state.reel.shown = lineUp; SE.fanfare(); return finish(); }
  alignBonus(isBig, lineUp, b.zone, mode).then(finish);
}

// ボーナスの揃い目: 赤7・赤7 ＋ 右リールは「7の真下にBAR」の並びから BIG=7／REG=BAR
function bonusLine(isBig) {
  const r = STRIPS[2];
  const s7 = r.findIndex((x, i) => x === "seven" && r[(i + 1) % r.length] === "bar");
  return [STRIPS[0].indexOf("seven"), STRIPS[1].indexOf("seven"), isBig ? s7 : (s7 + 1) % r.length];
}

// 揃え演出: 大きなリール3本で左・中を赤7に止め、右だけ回したまま溜めてから、じわっと止める。
// 右は 7 の真下に BAR があるので、BIG は BAR が中段を通り過ぎてから 7、REG は 7 が上段に見えたまま BAR で止まる
const BCELL = 66;
const bty = (strip, idx) => -BCELL * (idx + strip.length - 1);

// 拡大盤の実際の位置をコマ単位で小筐体へ写す。CSS回転・停止バウンド・右の減速まで
// 同じフレームを描くので、独立したアニメーションの時計がずれない。再マウントにも追従する。
function mirrorBonusReels(largeStrips) {
  let frame;
  const sync = () => {
    if (alive()) {
      // 読み取りをまとめてから書き込む（リールごとの強制レイアウトを避ける）。
      const positions = largeStrips.map((st) => ({
        y: new DOMMatrixReadOnly(getComputedStyle(st).transform).m42 * CELL / BCELL,
        spinning: st.classList.contains("spinning"),
      }));
      strips().forEach((st, i) => {
        st.classList.add("mirrored");
        st.classList.toggle("spinning", positions[i].spinning);
        st.style.transition = "none";
        st.style.transform = `translateY(${positions[i].y}px)`;
      });
    }
    frame = requestAnimationFrame(sync);
  };
  sync();
  return () => {
    cancelAnimationFrame(frame);
    if (alive()) strips().forEach((st) => {
      st.classList.remove("mirrored");
      st.style.transition = "";
    });
  };
}

async function alignBonus(isBig, line, zone, mode = "post") {
  // 後告知は「もう1回転」: 小筐体のレバーをもう一度叩いて回し直す
  if (mode === "post" && alive()) {
    widget.classList.add("lever-pull");
    setTimeout(() => widget?.classList.remove("lever-pull"), 380);
    strips().forEach((st) => { st.style.transform = ""; st.classList.add("spinning"); });
  }
  SE.reelLever();
  const reels = STRIPS.map((strip) => {
    const st = el("div.rc-strip", { style: { "--loop": `${-BCELL * strip.length}px` } });
    st.innerHTML = strip.concat(strip, strip).map((x) => `<div class="rc-cellr">${SYM[x]()}</div>`).join("");
    return el("div.rc-reel", [st]);
  });
  const strips3 = reels.map((r) => r.firstChild);
  const aim = el("div.rc-aim", { text: mode === "pre" ? "先ペカ！　このまま赤7を狙え──" : "ペカッ！　もう1回転、赤7を狙え──" });
  const label = el("div.rc-label", { text: "BONUS" });
  const lamp = el("div.rw-lamp.rc-lamp.lit", [pakkiFace()]);
  const machine = el("div.rc-machine.lamp-lit", { style: { "--slot-scale": BCELL / CELL } },
    cabinetParts(lamp, el("div.rw-machine.rc-reels", reels)));
  const board = el(`div.rc-board.${mode}`, [aim, machine, label]);
  const cut = el("div.reel-cutin.bonus", [board]);
  layers.fx.append(cut);
  if (mode === "post") {
    machine.classList.add("lever-pull");
    setTimeout(() => machine.classList.remove("lever-pull"), 380);
  }
  strips3.forEach((st) => st.classList.add("spinning"));
  const stopMirroring = mirrorBonusReels(strips3);
  try {
    const stop = (i) => {
      const st = strips3[i];
      st.classList.remove("spinning");
      st.style.transform = `translateY(${bty(STRIPS[i], line[i])}px)`;
      st.classList.add("land");
      SE.reelStop();
    };
    await sleep(650); stop(0);
    await sleep(420); stop(1);
    aim.textContent = "赤7・赤7……";
    board.classList.add("reach");
    SE.heartbeat();
    await sleep(750); SE.heartbeat();
    await sleep(750);
    // 最後の右リール: 4コマ手前から、減速しながら止める
    const r3 = strips3[2];
    const r = STRIPS[2];
    r3.classList.remove("spinning");
    r3.style.transition = "none";
    r3.style.transform = `translateY(${bty(r, line[2] + 4)}px)`;
    void r3.offsetWidth;
    r3.style.transition = "transform 1.25s cubic-bezier(0.1, 0.62, 0.16, 1)";
    r3.style.transform = `translateY(${bty(r, line[2])}px)`;
    await sleep(1280);
    SE.reelStop();
    board.classList.remove("reach");
    board.classList.add("done", isBig ? "big" : "reg");
    aim.textContent = isBig ? "赤7・赤7・赤7！！" : "赤7・赤7・BAR";
    label.textContent = isBig ? "BIG BONUS" : "REGULAR BONUS";
    if (isBig) SE.fanfare(); else SE.jingle();
    if (zone) bubble("パッキータイム！", 2600);
    if (alive()) setStops(line);
    state.reel.shown = line;
    await sleep(1600);
    cut.classList.add("out");
    await sleep(250);
  } finally {
    stopMirroring();
    cut.remove();
  }
}
// ロングフリーズ（プレミア: 回転が止まる → EN:CODE のグリッチ → 7揃い）
async function presentFreeze(r) {
  await sleep(700);
  strips().forEach((s) => s.classList.add("frozen"));
  SE.pugo();
  widget.classList.add("silent-spin");
  await sleep(1100);
  const cut = el("div.reel-cutin.freeze");
  cut.innerHTML = `<div class="rc-freeze"><div class="rc-glitch"></div><div class="rc-freeze-text"><b>EN:CODE</b><span>運命、再コンパイル中……</span></div></div>`;
  layers.fx.append(cut);
  SE.glitch();
  await sleep(1500);
  cut.innerHTML = `<div class="rc-freeze boom"><div class="rc-freeze-label">FREEZE BONUS</div><div class="rc-dance"></div><div class="rc-freeze-sub">ぷぷぷぷぷーーっ！！</div></div>`;
  cut.querySelector(".rc-dance").append(pakkiFace(".big"), pakkiFace(".big"), pakkiFace(".big"));
  SE.freezeBoom(); SE.fanfare();
  if (alive()) {
    strips().forEach((s) => s.classList.remove("frozen", "spinning"));
    setStops(STRIPS.map((s) => s.indexOf("seven")));
    widget.classList.remove("silent-spin");
    lampOn(true);
  }
  await sleep(2400);
  cut.remove();
  lampOff();
  bubble("殿堂入り！スロノートに刻まれた", 3000);
  announce(r);
}

// 報酬カード（報酬そのものは行動時に適用済み。ここは見せるだけ）
function announce(r) {
  if (!(r.got > 0) || r.quiet || !r.target) return;
  const word = r.exp >= 5 ? "大きく上がった" : r.exp >= 3 ? "上がった" : "少し上がった";
  const fx = r.starTo ? DB.statusTexts?.statTierFx?.[r.target]?.[r.starTo - 1] : "";
  gainCard({
    kind: "stat", stat: r.target, badge: { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "観" }[r.target],
    top: r.starTo ? `PAKKI SLOT ★${r.starTo}` : "PAKKI SLOT", main: STAT_JA[r.target],
    sub: r.starTo ? `${word} ──「${rankLabel(r.target)}」` : word, fx,
  });
}

// 初回のみ: パッキーのアプリ説明（4行・タップ送り）
const INTRO_LINES = [
  "ぷぷぷっ！ C.STATION公式アプリ『MOKUMOKUパッキー』、インストール完了〜！",
  "キミが一日なにか行動するたび、ボクのスロットがかってに1回転するよ。回すんじゃない——回っちゃうんだ。",
  "ルールはシンプル！ ボクの顔が光ったら——大当たりっ！ それだけ！",
  "外れても大丈夫。回したぶんだけ、その日がんばったことがちゃーんと積もるしくみ。それじゃ、今日もぷかぷかいこう！",
];
function showIntro() {
  return new Promise((resolve) => {
    let i = 0;
    const text = el("p.ri-text");
    const panel = el("div.ri-panel", [
      el("div.ri-head", [pakkiFace(".big"), el("span.ri-app", { text: "MOKUMOKUパッキー" })]),
      text,
      el("span.ri-next", { text: "▼ タップ" }),
    ]);
    const box = el("div.reel-intro", { dataset: { test: "reel-intro" } }, [panel]);
    const render = () => { text.textContent = INTRO_LINES[i]; };
    render();
    layers.modal.replaceChildren(box);
    layers.modal.classList.add("show");
    SE.phone();
    box.onclick = () => {
      i += 1;
      if (i === 2) SE.puka();
      if (i < INTRO_LINES.length) { render(); SE.click(); return; }
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      state.reel.introDone = true;
      save();
      resolve();
    };
  });
}

/** 演出確認用: 役を偽造して演出だけ再生（カウンタ・報酬は動かさない）。__remake.reel.force("big", "before") */
export function force(role, variant = "after") {
  if (!alive()) return "マップを開いてから呼んでください";
  const r = {
    n: -1, role, overlap: null, premium: role === "rare" || role === "freeze",
    stops: stopsFor(role, mulberry32(Date.now() & 0xffff)),
    variant: PEKA.includes(role) && role !== "freeze" ? (role === "rare" ? "premium" : variant) : "none",
    exp: 0, quiet: true, zone: false, gakkun: false, ceiling: "", target: null, got: 0,
  };
  presentSpin(r, false);
  return role;
}
