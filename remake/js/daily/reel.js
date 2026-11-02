// MOKUMOKUパッキー — 謎のマスコット「パッキー」のスロット（日常リール）。
// 仕様の正典は docs/pakki_slot_spec.md。役・確率・天井・裏確変は旧版と同一。
// 旧成長の報酬は通常1Pの育成に合わせ、REG16/BIG24/フリーズ36P（2026-10-08 PF24）。
// 新成長が有効なら、能力Pの代わりに当たり役の経験値（core/growth.js）を入れる。
//
// Aタイプ＋天井。「1行動=1回転」でマップ隅のミニ筐体が回り、パッキーの顔が光ったら大当たり（完全告知）。
// ・抽選は決定論RNG（シード＋総回転数）— ロードしても結果が変わらない＝リセマラ不可
// ・旧成長では「直前の行動で伸びたステがさらに伸びる」。ハズレでも対象ステ+1（サイレント）
// ・新成長ではハズレ・リプレイに経験値なし。天井（ゾーン/本天井・持ち越し）は両モード共通
// ・結果と報酬は行動した瞬間に確定・適用し、演出は次にマップを開いたときに後追いで見せる
import { el, sleep } from "../core/util.js";
import { layers, gainCard, toast } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state, save, STAT_KEYS, STAT_JA } from "../core/state.js";
import { gainStat, step } from "../core/stats.js";
import { DB, faceIconUrl } from "../core/data.js";
import { SE } from "../core/audio.js";
import { growthEnabled, awardSlotExp } from "../core/growth.js";

// ================================================================ 純粋コア（抽選は旧版と同一）

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

// 役テーブル（weight 合計 1000）。準備期間は13日×2行動。役と確率は旧版の仕様を維持する
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
// フリーズは第1章（約25〜30回転）でも出会えるかもしれない程度（2026-10-16 オーナー回答・#621）。
// 総回転12からベース1/250、22回転を過ぎて未取得なら1/40。1セーブ1回まで。
const FREEZE_CONTROL = { warmupSpins: 12, baseWeight: 4, pityAt: 22, pityWeight: 25, maxPerSave: 1 };
// 設定1〜6（#621）。週替わり・章替わりの抽選回数とシードで決まる＝ロードしても変わらない。
// weight=引き直しの出やすさ（低設定が多めのホール配分）。reg/big=ボーナスの出やすさの倍率、bell=ベルのweight。
// 配分の平均で今までの出方とほぼ同じになるようにしてある（裏確変・天井はそのまま効く）。
const SETTINGS = {
  1: { weight: 30, reg: 0.85, big: 0.92, bell: 24 },
  2: { weight: 25, reg: 0.92, big: 0.96, bell: 26 },
  3: { weight: 20, reg: 1.0, big: 1.0, bell: 28 },
  4: { weight: 12, reg: 1.12, big: 1.05, bell: 30 },
  5: { weight: 8, reg: 1.25, big: 1.1, bell: 32 },
  6: { weight: 5, reg: 1.45, big: 1.18, bell: 36 },
};
function settingDraw(seed, n) {
  const rng = mulberry32((seed ^ Math.imul(n + 1, 0x9E3779B1) ^ 0x5E771) >>> 0);
  return Number(pickWeighted(rng, Object.entries(SETTINGS).map(([id, s]) => ({ id, weight: s.weight }))));
}
function ensureSetting(reel) {
  if (!SETTINGS[reel.setting]) reel.setting = settingDraw(reel.seed, reel.settingDraws || 0);
  reel.settingDraws ||= 0;
  return reel.setting;
}
// 設定の有効期間: 7日たつか章が変わると自動で変わる。観音堂訪問では変えない（2026-10-31 オーナー指示）。
// 知っている人だけがずっと有利にならないよう、良い設定も長くは続かない。
const SETTING_DAYS = 7;
const today = () => ({ chapter: state?.chapter || 1, day: state?.day || 1 });
function settingExpired(reel) {
  const since = reel.settingSince;
  if (!since) return false;
  const now = today();
  return now.chapter !== since.chapter || now.day - since.day >= SETTING_DAYS;
}
/** 設定を引き直す。kind: "weekly"=1週間・章替わりの自動変更 */
function redrawSetting(reel, kind) {
  ensureSetting(reel);
  reel.settingDraws += 1;
  reel.setting = settingDraw(reel.seed, reel.settingDraws);
  // 引きが弱すぎる人は、変わった設定も4以上にする（出来レース）
  if (rescueActive({ count: reel.count || 0, bonusCount: reel.bonusCount || 0 })) reel.setting = Math.max(reel.setting, 4);
  reel.settingSince = today();
  reel.settingNotice = kind;
  reel.resetNext = true;
  const note = reel.note || (reel.note = {});
  note.settingChanges = (note.settingChanges || 0) + 1;
}
// 文字色予告（#621・#639）。次ゲームの当選を予告する。色は 青 < 緑 < 赤 の3色まで（オーナー指定）。
// 次ゲームの当選率の目安は、実機の公開データ（青10〜32%・緑26〜90%・赤95〜100%）の中央付近から
// 青15%・緑45%・赤95%。出るのは約11回転に1回（うるさくしない）。
// 抽選本体とは別のストリームで決めるので、役や出目は変わらない。
const CUE_ORDER = ["blue", "green", "red"];
const CUE_RATES = {
  peka: { blue: 0.092, green: 0.152, red: 0.146 },
  other: { blue: 0.062, green: 0.022, red: 0.0009 },
};
function cueFor(seed, count, peka) {
  const rng = mulberry32((seed ^ Math.imul(count + 1, 0x85EBCA6B) ^ 0xC0E) >>> 0);
  const rates = CUE_RATES[peka ? "peka" : "other"];
  let v = rng();
  for (const c of CUE_ORDER) { v -= rates[c]; if (v < 0) return c; }
  return "";
}
// 裏確変（引き弱救済）。実際の当たりの割合（約1/9.4）に合わせ、10回転目から期待値の7割を割ったら×2.5（#621。
// オーナー「あまりにも収束しない人には出来レースでもいい」）。1章30回転で当たり1回以下の人は約12%→約2%
const RESCUE = { minSpins: 8, ratio: 0.7, mult: 2.5, expectedRate: 0.106 };
const rescueActive = (st) => st.count >= RESCUE.minSpins && (st.bonusCount || 0) < st.count * RESCUE.expectedRate * RESCUE.ratio;
// 最近の不調の補い（#1281 オーナー決定 2026-10-30）。直近30回転の当たりが少ない人だけ REG/BIG を少しだけ上げる。
// 30回転そろうまでは何もしない。期待値（30×10.6%≒3.2回）に対し、当たり2回なら×1.25、1回以下なら×1.5。
// 生涯の裏確変（×2.5）とは掛け合わせず、大きい方だけを使う。ジャグ連（×1.5）は従来どおり別に効く。
const SLUMP = { window: 30, steps: [{ maxHits: 1, mult: 1.5 }, { maxHits: 2, mult: 1.25 }] };
/** 直近の当たり記録（1=ペカ, 0=それ以外）を窓の長さにそろえる。旧セーブ・壊れた値は空から数え直す */
function recentWindow(recent) {
  return Array.isArray(recent) ? recent.filter((v) => v === 0 || v === 1).slice(-SLUMP.window) : [];
}
function slumpMult(st) {
  const recent = recentWindow(st.recent);
  if (recent.length < SLUMP.window) return 1;
  const hits = recent.reduce((s, v) => s + v, 0);
  return SLUMP.steps.find((x) => hits <= x.maxHits)?.mult || 1;
}
const CEILING = { zoneRun: 8, mainRun: 15 };
const JUG_REN = { games: 5, mult: 1.5 };
const REPLAY_CHAIN_MAX = 4;
// exp は旧成長で直前の行動で伸びたステへの上乗せP（新成長でも記録用に残す）。quiet は通知なし
const EFFECTS = {
  miss: { exp: 1, quiet: true },
  replay: { exp: 1, quiet: true },
  cherry: { exp: 2 },
  bell: { exp: 3 },
  rare: { exp: 24, zone: true },
  reg: { exp: 16 },
  big: { exp: 24, zone: true },
  freeze: { exp: 36, zone: true },
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
  // 設定: ベル・REG・BIGの出やすさを変え、増減はハズレで受ける
  const cfg = SETTINGS[st.setting] || SETTINGS[3];
  const shifted = ["bell", "reg", "big"].reduce((s, id) => s - get(id).weight, 0);
  get("bell").weight = cfg.bell;
  get("reg").weight = Math.round(get("reg").weight * cfg.reg);
  get("big").weight = Math.round(get("big").weight * cfg.big);
  get("miss").weight -= shifted + ["bell", "reg", "big"].reduce((s, id) => s + get(id).weight, 0);
  let fz = FREEZE_CONTROL.baseWeight;
  if ((st.freezeCount || 0) >= FREEZE_CONTROL.maxPerSave) fz = 0;
  else if (st.count < FREEZE_CONTROL.warmupSpins) fz = 0;
  else if (st.count >= FREEZE_CONTROL.pityAt) fz = FREEZE_CONTROL.pityWeight;
  // ベース分まではBIGに折り込み（外から見た合算は一定）、昇格の上乗せぶんだけハズレから移す
  get("big").weight += FREEZE_CONTROL.baseWeight - Math.min(fz, FREEZE_CONTROL.baseWeight);
  get("miss").weight -= Math.max(0, fz - FREEZE_CONTROL.baseWeight);
  get("freeze").weight = fz;
  // 生涯の裏確変と最近の不調の補いは、大きい方の倍率だけを使う（掛け合わせない）
  const helpMult = Math.max(rescueActive(st) ? RESCUE.mult : 1, slumpMult(st));
  if (helpMult > 1) {
    let added = 0;
    for (const id of ["reg", "big"]) {
      const inc = Math.round(get(id).weight * (helpMult - 1));
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
// 当選済みの後告知だけで使う表示位置。抽選用の乱数・結果には触れない。
export function reachStops(n) {
  const spin = Number.isInteger(n) ? n : 0;
  return STRIPS.map((strip, reel) => {
    if (reel === 2) return strip.indexOf("pakki");
    const candidates = [];
    strip.forEach((sym, i) => { if (sym === "replay") candidates.push(i); });
    return candidates[((spin % candidates.length) + candidates.length) % candidates.length];
  });
}

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
// 左リールのBAR狙い（#1281 K01 オーナー決定 2026-10-30・見た目だけ）。実機のジャグラーで左にBARを狙ったときの
// ハズレ目のように、ハズレ目の多くで左リールの窓にBARが見えるようにする。この配列はBARの真下がチェリーなので、
// BARが上段・中段だとチェリー（中段チェリー＝プレミア／角チェリー）に見えてしまう。ハズレではBARを下段に置く
// （中段は煙・上段はリプレイ）。役・確率・報酬・出目以外の乱数の使い方は変えない（stopsFor は各回転の乱数の最後の利用）。
const LEFT_BAR_AIM = 0.7;
function barAimSmoke(strip, rng) {
  const n = strip.length, cands = [];
  strip.forEach((s, i) => {
    if (s !== "smoke" || strip[(i + 1) % n] !== "bar") return;
    if (strip[(i - 1 + n) % n] === "cherry") return;
    cands.push(i);
  });
  return cands.length ? cands[Math.floor(rng() * cands.length)] : safeSmoke(strip, rng);
}
function stopsFor(role, rng) {
  const missStops = () => {
    const midSym = rng() < 0.5 ? "smoke" : "cherry";
    const rightSym = midSym === "smoke" ? "replay" : (rng() < 0.5 ? "smoke" : "replay");
    const left = rng() < LEFT_BAR_AIM ? barAimSmoke(STRIPS[0], rng) : safeSmoke(STRIPS[0], rng);
    return [left, stripIdx(STRIPS[1], midSym, rng), stripIdx(STRIPS[2], rightSym, rng)];
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

/** その回転の役を引く（rng は出目・告知の決定に続けて使う） */
function rollAt(reel) {
  const rng = rngFor(reel.seed, reel.count);
  const st = {
    count: reel.count, missRun: reel.missRun, bonusGap: reel.bonusGap,
    zoneLeft: reel.zoneLeft, bonusCount: reel.bonusCount || 0, freezeCount: reel.freezeCount || 0,
    recent: recentWindow(reel.recent),
    setting: ensureSetting(reel),
  };
  const role = rollRole(rng, st);
  let overlap = null;
  if (role === "cherry" && rng() < CHERRY_OVERLAP.chance) overlap = rng() < CHERRY_OVERLAP.bigShare ? "big" : "reg";
  return { rng, st, role, overlap };
}
const isPekaRoll = (role, overlap) => PEKA.includes(role) || !!overlap;

/** 1行動ぶんの抽選（リプレイ連鎖込み）。reel のカウンタを進め、結果配列を返す */
function spinSeries(reel, ctx) {
  const results = [];
  let chain = 0;
  do {
    const rolled = rollAt(reel);
    const { rng, st } = rolled;
    let { role, overlap } = rolled;
    // 前の回転で文字色予告を出した回転は、予告したときの抽選のまま（設定が変わっても予告を裏切らない）
    const lock = reel.lock && reel.lock.count === reel.count ? reel.lock : null;
    reel.lock = null;
    if (lock) { role = lock.role; overlap = lock.overlap; }
    const eff = EFFECTS[role];
    const isPeka = isPekaRoll(role, overlap);
    const premium = role === "rare" || role === "freeze";
    let variant = isPeka && role !== "freeze" ? (premium ? "premium" : pickWeighted(rng, VARIANTS)) : "none";
    // 予告の次ゲームはレバーオンで光らせない。リールを溜めてから後告知で知らせる
    if (lock && variant === "before") variant = "after";
    const result = {
      n: reel.count, role, overlap, premium,
      ren: isPeka && st.bonusCount > 0 && (st.bonusGap + 1) <= JUG_REN.games,
      stops: stopsFor(role, rng),
      variant,
      exp: (eff.exp || 0) + (overlap ? EFFECTS[overlap].exp : 0),
      quiet: !!eff.quiet && !overlap,
      zone: !!eff.zone || overlap === "big",
      // 章の最初の1回転と、設定変更の直後の1回転でリールがガクッと揺れる（リセット判別の小ネタ）
      gakkun: !!ctx && (!!ctx.chapterFirst || !!ctx.reset) && chain === 0,
      ceiling: st.bonusGap >= CEILING.mainRun ? "main" : (role !== "miss" && st.missRun >= CEILING.zoneRun ? "zone" : ""),
      afterReplay: chain > 0,
      cued: lock ? lock.cue : "", // 前の回転の文字色予告を受けた回転
      games: st.bonusGap + 1, // 前回のボーナスからこの回転までの回転数（ノートの履歴用）
    };
    reel.count += 1;
    reel.missRun = role === "miss" ? reel.missRun + 1 : 0;
    reel.bonusGap = isPeka ? 0 : reel.bonusGap + 1;
    result.ceilingRemain = isPeka ? CEILING.mainRun : Math.max(0, CEILING.mainRun - reel.bonusGap);
    reel.bonusCount = (reel.bonusCount || 0) + (isPeka ? 1 : 0);
    reel.recent = [...recentWindow(reel.recent), isPeka ? 1 : 0].slice(-SLUMP.window);
    if (role === "freeze") reel.freezeCount = (reel.freezeCount || 0) + 1;
    if (result.zone) reel.zoneLeft = JUG_REN.games;
    else if (reel.zoneLeft > 0) reel.zoneLeft -= 1;
    results.push(result);
    if (role !== "replay") break;
    chain += 1;
  } while (chain < REPLAY_CHAIN_MAX);
  // 文字色予告は「次ゲーム」の予告。この行動の最後が当たりでないときだけ、次の回転を先に引いて色を決める
  const last = results[results.length - 1];
  if (!isPekaRoll(last.role, last.overlap)) {
    const next = rollAt(reel);
    const cue = next.role === "freeze" ? "" : cueFor(reel.seed, reel.count, isPekaRoll(next.role, next.overlap));
    if (cue) {
      reel.lock = { count: reel.count, role: next.role, overlap: next.overlap, cue };
      last.nextCue = cue;
    }
  }
  return results;
}

/** 分布の確認用（コンソール: __remake.reel.simulate(100000)） */
export function simulate(n, seed = 1, setting = null) {
  const reel = { seed: seed >>> 0, count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0, recent: [], setting };
  const dist = {};
  const cues = {};
  let spins = 0, exp = 0, pekas = 0, maxGap = 0, gap = 0;
  while (spins < n) {
    for (const r of spinSeries(reel, {})) {
      dist[r.role] = (dist[r.role] || 0) + 1;
      exp += r.exp; spins++;
      const peka = PEKA.includes(r.role) || !!r.overlap;
      if (r.cued) { const c = cues[r.cued] || (cues[r.cued] = { shown: 0, hit: 0 }); c.shown++; if (peka) c.hit++; }
      if (peka) { pekas++; gap = 0; } else { gap++; maxGap = Math.max(maxGap, gap); }
    }
  }
  return { spins, exp, pekaRate: spins / pekas, maxGap, dist, cues, setting: reel.setting };
}

export const core = { mulberry32, rngFor, ROLES, EFFECTS, PEKA, CEILING, STRIPS, SETTINGS, FREEZE_CONTROL, CUE_ORDER, RESCUE, SLUMP, LEFT_BAR_AIM, spinSeries, stopsFor, effectiveTable, slumpMult, simulate, settingDraw, cueFor };

// ================================================================ 行動時のコミット

let sessionFirst = true; // ゲームを起動してからまだ1回も回していない

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

/** 自分で選び、実際に体力を消費した日常行動の終了後に呼ぶ。結果と報酬はこの瞬間に確定する（演出は同じ行動の終了時） */
export function onAction({ spent = 0 } = {}) {
  if (!(spent > 0) || !state?.reel?.installed || state.phase !== "daily") { statBuffer = {}; return; }
  commitSpinSeries();
}

// 行動後と初回体験で、同じ抽選・報酬・記録を一度だけ確定する。
function commitSpinSeries() {
  const reel = state.reel;
  const chapterFirst = reel.lastChapter !== state.chapter;
  reel.lastChapter = state.chapter;
  ensureSetting(reel);
  if (!reel.settingSince) reel.settingSince = today();
  else if (settingExpired(reel)) redrawSetting(reel, "weekly");
  // 設定変更の直後と、ゲームを起動（ロード）して最初の1回転はガックン
  const reset = !!reel.resetNext || sessionFirst;
  reel.resetNext = false;
  sessionFirst = false;
  const target = pickTarget();
  // 経験値のしくみ（心得の盤）が有効なら、報酬は能力Pではなく図柄が揃った分の経験値（#1281）。
  // 役・確率・天井・記録は同じ。r.exp（役の旧ポイント）は記録として残し、能力には足さない
  const expMode = growthEnabled();
  for (const r of spinSeries(reel, { chapterFirst, reset })) {
    if (expMode) {
      r.xp = r.quiet ? 0 : awardSlotExp(r.overlap || r.role);
      r.got = 0;
      recordNote(reel, r);
      reel.pending.push(r);
      continue;
    }
    // 章の上限で調整した実増加を記録。通知は演出のときに出す（報酬はここで一度だけ）
    selfGain = true;
    const before = { ...state.stats };
    const got = gainStat(target, r.exp, { silent: true });
    selfGain = false;
    // 上限に届いた項目は gainStat が別の項目へ振り替えるので、実際に伸びた方を記録する
    const key = STAT_KEYS.find((k) => state.stats[k] > before[k]) || target;
    r.target = key;
    r.got = got;
    if (step(key) > Math.max(1, Math.ceil(before[key] / 10))) r.starTo = step(key);
    recordNote(reel, r);
    reel.pending.push(r);
  }
}

const bonusKind = (r) => r.role === "freeze" ? "FREEZE" : r.role === "rare" ? "PREMIUM"
  : r.role === "big" || r.overlap === "big" ? "BIG" : r.role === "reg" || r.overlap === "reg" ? "REG" : "";
const HISTORY_MAX = 10;

/** パッキースロットノートの記録（役ごとの回数・ハマり・当たり履歴・フリーズ殿堂入り） */
function recordNote(reel, r) {
  const note = reel.note || (reel.note = {});
  note[r.role] = (note[r.role] || 0) + 1;
  if (r.overlap) {
    note.cherryOverlap = (note.cherryOverlap || 0) + 1;
    const k = r.overlap === "big" ? "overlapBig" : "overlapReg";
    note[k] = (note[k] || 0) + 1;
  }
  note.maxGap = Math.max(note.maxGap || 0, r.games); // 最大ハマり（当たった回転も含めた回転数）
  const kind = bonusKind(r);
  const period = Number.isInteger(reel.settingDraws) ? reel.settingDraws : 0;
  const periods = note.periods || (note.periods = {});
  const stats = periods[period] || (periods[period] = { spins: 0, big: 0, reg: 0, bell: 0 });
  stats.spins += 1;
  if (kind === "BIG" || kind === "PREMIUM") stats.big += 1;
  if (kind === "REG") stats.reg += 1;
  if (r.role === "bell") stats.bell += 1;
  if (kind) {
    (note.history ||= []).unshift({ kind, games: r.games, ren: !!r.ren, chapter: state.chapter, day: state.day });
    note.history.length = Math.min(note.history.length, HISTORY_MAX);
  }
  if (r.role === "freeze") (note.freezeLog ||= []).push({ chapter: state.chapter, day: state.day, spin: r.n + 1 });
}

// 設定示唆（パッキーの一言）。実機のように「示唆の種類」ごとに台詞を分ける。
// 偶奇・高低は出やすさが違うだけ（ガセあり）。確定系は条件を満たす設定でしか出ない（嘘をつかない）。
// 出るのは設定変更のときと、ボーナスのあとにときどき。ノートには設定ごと（period）に分けて残す。
// 偶奇の台詞は 2026-10-17 オーナー承認の文言（分類ごとの出やすさは変えない・#634）。
export const SETTING_HINTS = [
  { id: "neutral", w: () => 40, lines: ["今日もぷかぷかいこう♪", "ほどほどにがんばる〜", "ふつうがいちばん！", "いい煙の予感……？"] },
  { id: "odd", w: (s) => (s % 2 ? 16 : 6), lines: ["いち、さん、ご！ 今日はこのリズムが好き♪", "今日は奇数が気になるな〜"] },
  { id: "even", w: (s) => (s % 2 ? 6 : 16), lines: ["に、よん、ろく！ 今日はこのリズムが好き♪", "今日は偶数が気になるな〜"] },
  { id: "low", w: (s) => (s <= 2 ? 14 : s <= 4 ? 7 : 3), lines: ["今日はのんびりいこ〜", "ふぁ〜、ねむねむ……", "ゆっくりでいいよね〜"] },
  { id: "high", w: (s) => (s >= 5 ? 14 : s >= 3 ? 7 : 3), lines: ["ぷぷっ、なんだか調子いい！", "体が軽いぞっ", "キミ、ツイてるかもね♪"] },
  { id: "ge2", w: (s) => (s >= 2 ? 4 : 0), lines: ["ボク、今日はねぼすけじゃないよ！"] },        // 設定2以上確定
  { id: "ge4", w: (s) => (s >= 4 ? 4 : 0), lines: ["今日のボク、ちょっと本気かも？"] },           // 設定4以上確定
  { id: "six", w: (s) => (s === 6 ? 5 : 0), lines: ["……今日は、ボクにまかせて。"] },               // 設定6確定
];
export function settingHint(setting) {
  const kinds = SETTING_HINTS.map((h) => ({ id: h.id, weight: h.w(setting) }));
  const picked = pickWeighted(Math.random, kinds);
  const kind = SETTING_HINTS.find((h) => h.id === picked) || SETTING_HINTS[0];
  const pool = kind?.lines?.length ? kind.lines : SETTING_HINTS[0].lines;
  return pool[Math.floor(Math.random() * pool.length)] || SETTING_HINTS[0].lines[0];
}
const HINT_KEEP = 8;
/** 示唆を記録する。period＝今の設定が何回目の抽選か（settingDraws）。設定が変わると前の示唆は「前の設定」になる */
export function rememberHint(hint) {
  const reel = state.reel;
  ensureSetting(reel);
  const note = reel.note || (reel.note = {});
  note.lastHint = hint;
  (note.hints ||= []).unshift({ text: hint, chapter: state.chapter, day: state.day, period: reel.settingDraws });
  note.hints.length = Math.min(note.hints.length, HINT_KEEP);
}

/** 示唆を今の設定と前の設定に分ける。period の無い旧セーブの記録は、今の設定の証拠として扱わない */
export function splitHints(reel) {
  const n = reel?.note || {};
  const period = Number.isInteger(reel?.settingDraws) ? reel.settingDraws : 0;
  const all = (n.hints || []).slice();
  if (!all.length && n.lastHint) all.push({ text: n.lastHint, chapter: "?", day: "?" });
  const isCurrent = (h) => Number.isInteger(h.period) && h.period === period;
  return { current: all.filter(isCurrent), past: all.filter((h) => !isCurrent(h)).slice(0, 3) };
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
  ];
}

function buildWidget() {
  const lamp = el("button.rw-lamp", { title: "MOKUMOKUパッキー（タップでスロットノート）", dataset: { test: "reel-lamp" }, onclick: () => {
    if (bonusWait) settleBonus(bonusWait, false);
    else if (!busy) openNote();
  } }, [pakkiFace()]);
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
  b.className = "rw-bubble";
  if (cls) b.classList.add(...String(cls).split(" "));
  b.classList.toggle("show", !!text);
  clearTimeout(bubble.t);
  if (ms) bubble.t = setTimeout(() => b.classList.remove("show"), ms);
}
// 表示できた学習反応だけを保存。旧セーブの過去の体験は推測しない。
async function learnOnce(key, text, reel, host) {
  if (state.reel !== reel || widget !== host || !alive() || reel.learned?.[key]) return;
  bubble(text, 2400);
  (reel.learned ||= {})[key] = true;
  save();
  await sleep(2400);
}
const recent = [];
function pick(pool) {
  let c, tries = 0;
  do { c = pool[Math.floor(Math.random() * pool.length)]; tries++; } while (recent.includes(c) && tries < 10 && pool.length > 3);
  recent.push(c); if (recent.length > 3) recent.shift();
  return c;
}
// 短い当選反応だけを未見優先にする。抽選用の乱数は使わない。
const WIN_LINES = ["ぷぷぷっ！ 光った！", "ペカッ！ 光ったよ！", "ほら、光った！", "ぷぷっ、来た来た！"];
const REN_LINES = ["また光った！", "さっき光ったばかりなのに！", "ついてる、今！"];
function pickFresh(pool, key) {
  if (!pool.length) return "";
  const seenLines = state.reel.seenLines || (state.reel.seenLines = {});
  let seen = Array.isArray(seenLines[key]) ? seenLines[key] : [];
  if (pool.every((_, i) => seen.includes(i))) seen = [];
  seenLines[key] = seen;
  const weights = pool.map((_, i) => seen.includes(i) ? 1 : 3);
  let remaining = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let index = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) { index = i; break; }
  }
  if (!seen.includes(index)) seen.push(index);
  return pool[index];
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
  if (!state?.reel?.installed) return Promise.resolve();
  const owner = state;
  // 演出中は、停止処理が参照している同じリールを新しいマップへ移す。
  // 筐体だけ作り直すと、古いリールが止まり、新しい方には前回の出目が残る。
  if (busy) {
    host.append(widget);
    return current;
  }
  widget = buildWidget();
  host.append(widget);
  setStops(state.reel.shown || [4, 1, 2]); // 前回見せた出目のまま（未消化の結果は出目に出さない）。初回は左の下段にBAR
  // 初回説明を読み終えた旧セーブには、設定の説明が増えたことを一度だけ知らせる（画面は止めない）
  if (state.reel.introDone && !state.reel.settingGuideDone) {
    state.reel.settingGuideDone = true;
    save();
    toast("パッキースロットに『設定』の説明が増えたよ。パッキーをタップして、ノートの遊び方で読めるよ");
  }
  const queue = state.reel.pending;
  const notice = !!state.reel.settingNotice;
  if (!queue.length && !notice) return Promise.resolve();
  busy = true; // 初回説明の待機中も、再マウントで別の演出を始めない。
  current = (async () => {
    try {
      if (!owner.reel.introDone && !await showIntro()) return;
      if (state !== owner) return;
      if (notice) await presentSettingChange();
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

/** 行動のあと: その場でスロットを見せてから次の場面へ進む */
export async function presentNow({ label = "今夜のスロット" } = {}) {
  const owner = state;
  await current; // 昼の分の演出が途中なら、終わってから今夜の分を回す
  if (state !== owner) return;
  if (!state?.reel?.installed || !state.reel.pending?.length) return;
  const host = el("div.reel-night", [el("div.rn-label", { text: label })]);
  layers.fx.append(host);
  requestAnimationFrame(() => host.classList.add("show"));
  // フェードインした時点で今夜の回転を始めておく。前回の停止出目を見せて待たない。
  await mountReel(host, { delay: 0 });
  await sleep(900);
  host.classList.remove("show");
  await sleep(300);
  host.remove();
}

/** 自動変更の通知。旧セーブの観音堂由来の未表示通知も、確定済みの結果として一度だけ表示する */
async function presentSettingChange() {
  const reel = state.reel;
  const weekly = reel.settingNotice === "weekly";
  reel.settingNotice = false;
  const hint = settingHint(ensureSetting(reel));
  rememberHint(hint);
  save();
  if (!alive()) return;
  widget.classList.add("setting-change");
  SE.reelWin();
  bubble(weekly ? "週替わり！ 設定変更完了〜♪" : "ぷぷっ、設定変更完了〜♪", 0, "setting");
  await sleep(1500);
  if (!alive()) return;
  SE.puka();
  bubble(hint, 2400, "setting");
  await sleep(1600);
  widget?.classList.remove("setting-change");
  await sleep(500);
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

  // 前の回転で文字色予告が出た次ゲーム: 筐体の枠がその色でうっすら光り、リールを溜めてから止める
  const cued = fast ? "" : r.cued || "";
  if (cued) widget.classList.add("cued", `cued-${cued}`);
  const spinMs = fast ? 120 : cued ? 700 : r.role === "miss" ? 240 : 420;
  const gap = fast ? 40 : cued ? 260 : 130;
  const willPeka = PEKA.includes(r.role) || !!r.overlap;
  const tension = !fast && (willPeka || !!cued);
  const tensionMs = tension ? 560 : 0;
  let pres = null;
  if (!fast && !r.cued && !r.overlap && !r.premium && r.variant === "after" && (r.role === "reg" || r.role === "big")) {
    const patterns = [{ id: "beat", weight: 50 }, { id: "sync", weight: 25 }, { id: "reach", weight: 25 }];
    let seen = Array.isArray(state.reel.seenPres) ? state.reel.seenPres : [];
    if (patterns.every(({ id }) => seen.includes(id))) seen = [];
    pres = pickWeighted(Math.random, patterns.map(({ id, weight }) => ({
      id, weight: weight * (seen.includes(id) ? 1 : 2),
    })));
    if (!seen.includes(pres)) seen.push(pres);
    state.reel.seenPres = patterns.every(({ id }) => seen.includes(id)) ? [] : seen;
  }
  const shownStops = pres === "reach" ? reachStops(r.n) : r.stops;
  await sleep(spinMs);
  for (let i = 0; i < 3; i++) {
    await sleep(i === 0 ? 0 : gap + (i === 2 ? tensionMs : 0));
    if (!alive()) break;
    const s = ss[i];
    s.classList.remove("spinning");
    s.style.transform = `translateY(${tyFor(shownStops[i])}px)`;
    s.classList.add("land");
    setTimeout(() => s.classList.remove("land"), 240);
    if (!fast) SE.reelStop();
    if (tension && i === 1) widget.classList.add("tension");
    if (i === 2) widget.classList.remove("tension");
  }
  // 同期点灯とリーチ目は、第三停止からの待ちを afterStop だけで管理する。
  if (pres !== "sync" && pres !== "reach") await sleep(fast ? 60 : 200);
  if (alive()) widget.classList.remove("tension", "cued", ...CUE_ORDER.map((c) => `cued-${c}`));
  state.reel.shown = shownStops;
  await afterStop(r, fast, pres);
  // 文字色予告（次ゲーム）: 止まったあとにパッキーが色付きの文字でつぶやく
  if (r.nextCue && !fast && alive()) {
    if (r.role !== "miss") await sleep(900);
    if (!alive()) return;
    bubble(pick(CUE_LINES[r.nextCue]), 2600, `cue cue-${r.nextCue}`);
    CUE_SE[r.nextCue]?.();
    await sleep(1200);
  }
}

// 文字色予告の台詞。色で期待度が分かるよう、色ごとに口調の熱さをそろえる
const CUE_LINES = {
  blue: ["ん？ 次……？", "おや？", "ぷ？", "なにか来る？"],
  green: ["次、きてるかも……！", "む、この感じ……", "ちょっと期待して！", "ぷぷ……次……？"],
  red: ["次、アツいかも！", "ドキドキしてきた……！", "チャンスかもっ！", "これは……！"],
};
const CUE_SE = { red: () => SE.puka() };
// 緑以上の予告が外れたとき
const CUE_MISS = ["あ、あれ……？", "ご、ごめん……！", "今のはナシで！", "おかしいな〜", "期待させちゃった？", "ぐぬぬ、次こそ！"];

// 役の恩恵をパッキー口調で（数値は出さず体感語で）
function benefitLine(r) {
  // xp=0 の上限到達時も経験値の結果。表示時のモードで保存済みの報酬を読み替えない。
  if (typeof r.xp === "number") {
    if (!(r.xp > 0)) return "経験値はもう上限だよ！";
    return r.xp >= 200 ? "経験値がどーんと入ったよ！" : r.xp >= 90 ? "経験値がぐーんと入ったよ！" : "経験値がちょっと入ったよ！";
  }
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

async function afterStop(r, fast, pres = null) {
  switch (r.role) {
    case "miss":
      if (alive()) widget.classList.toggle("warm", r.ceilingRemain > 0 && r.ceilingRemain <= 3);
      if (!fast) {
        if (r.nextCue) { /* このあと次ゲームの予告を出す */ }
        else if (["green", "red"].includes(r.cued)) bubble(pick(CUE_MISS), 1500);
        else if (r.ceilingRemain > 0 && r.ceilingRemain <= 5) {
          const pool = r.ceilingRemain <= 1 ? CEILING_HINTS.soon : r.ceilingRemain <= 3 ? CEILING_HINTS.near : CEILING_HINTS.far;
          bubble(pick(pool), 1500, r.ceilingRemain <= 1 ? "hot" : null);
          if (r.ceilingRemain <= 2) SE.puka();
          const reel = state.reel, host = widget;
          if (alive() && !reel.learned?.ceiling) {
            await sleep(1500);
            await learnOnce("ceiling", "こんな気配のあとは、近々かならず光るよ！", reel, host);
          }
        } else if (Math.random() < 0.04) bubble(pick(RARE_MISS), 2200);
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
      // 後告知: 同期点灯／リーチ目を見せる間／従来の一拍。
      await sleep(fast ? 0 : pres === "sync" ? 40 : pres === "reach" ? 600 : 420);
      return peka(r, fast, false, r.ren ? pickFresh(REN_LINES, "ren") : pickFresh(WIN_LINES, "win"));
    default:
      announce(r);
  }
}

// 先告知: レバーを叩いた瞬間にランプが光る → 小筐体は回したまま、大きなリールでこの回転を赤7に止める
async function presentPreAnnounce(r) {
  lampOn(false);
  SE.puka();
  bubble("先ペカッ！ このまま7を狙って！", 0);
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
  const reel = state.reel, host = widget;
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
  const finish = async () => {
    // 演出の途中で何が落ちても done は必ず解決する（未解決だと mountReel の busy が固まる） #1359
    try {
      announce(b);
      if (!fast) {
        const cls = isBig ? "hot" : null;
        bubble(`${bonusName(b)}ッ！`, 950, cls);
        setTimeout(() => bubble(benefitLine(b), 1900, cls), 1000);
        // ボーナスのあと、ときどき設定示唆（水色の吹き出し）
        let learningDelay = 3000;
        if (b.n >= 0 && Math.random() < 0.3) {
          const hint = settingHint(ensureSetting(state.reel));
          rememberHint(hint);
          setTimeout(() => bubble(hint, 2600, "setting"), 3000);
          learningDelay = 5700;
        }
        // 揃え・報酬表示と設定示唆が終わってから。次の演出も補足の終了を待つ。
        if (b.zone && state.reel === reel && widget === host && alive() && !reel.learned?.zone) {
          await sleep(learningDelay);
          await learnOnce("zone", "パッキータイムのあいだは、当たりが近づきやすいよ！", reel, host);
        }
      }
    } catch (e) {
      console.warn("[reel] bonus finish", e);
    } finally {
      if (b.done) { const d = b.done; b.done = null; d(); }
    }
  };
  const lineUp = bonusLine(isBig);
  if (fast || !alive()) { if (alive()) setStops(lineUp); state.reel.shown = lineUp; SE.fanfare(); return finish(); }
  // 揃え演出が reject しても finish を実行し、done（= 進行の再開）を保証する #1359
  alignBonus(isBig, lineUp, b.zone, mode).then(finish, (e) => { console.warn("[reel] alignBonus", e); finish(); });
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
  // タップは今かかっている待ちだけを解決する。先押しは持ち越さない。
  let advance = null, waitTimer = null;
  const waitStop = (ms, onTap) => new Promise((resolve) => {
    const finish = (tapped = false) => {
      if (advance !== finish) return;
      advance = null;
      clearTimeout(waitTimer);
      waitTimer = null;
      if (tapped) onTap?.();
      resolve();
    };
    advance = finish;
    waitTimer = setTimeout(() => finish(), ms);
  });
  const tap = (event) => {
    event.stopPropagation();
    advance?.(true);
  };
  cut.style.pointerEvents = "auto";
  cut.addEventListener("click", tap);
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
    await waitStop(650); stop(0);
    await waitStop(420); stop(1);
    aim.textContent = "赤7・赤7……";
    board.classList.add("reach");
    SE.heartbeat();
    await waitStop(750); SE.heartbeat();
    await waitStop(750);
    // 最後の右リール: 4コマ手前から、減速しながら止める
    const r3 = strips3[2];
    const r = STRIPS[2];
    r3.classList.remove("spinning");
    r3.style.transition = "none";
    r3.style.transform = `translateY(${bty(r, line[2] + 4)}px)`;
    void r3.offsetWidth;
    r3.style.transition = "transform 1.25s cubic-bezier(0.1, 0.62, 0.16, 1)";
    r3.style.transform = `translateY(${bty(r, line[2])}px)`;
    await waitStop(1280, () => {
      r3.style.transition = "none";
      r3.style.transform = `translateY(${bty(r, line[2])}px)`;
    });
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
    advance = null;
    clearTimeout(waitTimer);
    cut.removeEventListener("click", tap);
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
  bubble("殿堂入り！スロットノートに刻まれた", 3000);
  announce(r);
}

// 報酬カード（報酬そのものは行動時に適用済み。ここは見せるだけ）
function announce(r) {
  if (r.xp > 0 && !r.quiet) {
    gainCard({ kind: "exp", source: "slot", badge: "経", top: "SLOT BONUS", main: `EXP +${r.xp}` });
    return;
  }
  if (!(r.got > 0) || r.quiet || !r.target) return;
  const fx = r.starTo ? DB.statusTexts?.statTierFx?.[r.target]?.[r.starTo - 1] : "";
  gainCard({
    kind: "stat", source: "slot", stat: r.target, points: r.starTo ? 0 : r.got, badge: { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "察" }[r.target],
    top: "SLOT BONUS", main: STAT_JA[r.target], evolution: r.starTo ? `${r.starTo}段に上がった` : "",
    fx,
  });
}

// ================================================================ パッキースロットノート

/** ノートの数字（表示用・純粋関数）。BIGはプレミアとチェリー重複BIGを含む */
export function noteSummary(reel) {
  const n = reel?.note || {};
  const spins = reel?.count || 0;
  const big = (n.big || 0) + (n.rare || 0) + (n.overlapBig || 0);
  const reg = (n.reg || 0) + (n.overlapReg || 0);
  const freeze = n.freeze || 0;
  const rate = (k) => (k > 0 && spins > 0 ? `1/${(spins / k).toFixed(1)}` : "—");
  const period = Number.isInteger(reel?.settingDraws) ? reel.settingDraws : 0;
  const periods = Object.entries(n.periods || {}).map(([key, stats]) => ({
    period: Number(key), spins: stats.spins, big: stats.big, reg: stats.reg, bell: stats.bell,
  })).sort((a, b) => b.period - a.period);
  return {
    spins, big, reg, freeze,
    rows: [
      ["BIG", big, rate(big)],
      ["REG", reg, rate(reg)],
      ["ボーナス合算", big + reg + freeze, rate(big + reg + freeze)],
      ["チェリー", n.cherry || 0, rate(n.cherry || 0)],
      ["ベル", n.bell || 0, rate(n.bell || 0)],
      ["リプレイ", n.replay || 0, rate(n.replay || 0)],
    ],
    current: reel?.bonusGap || 0,
    maxGap: n.maxGap || 0,
    history: n.history || [],
    freezeLog: n.freezeLog || [],
    periodStats: {
      current: periods.find((stats) => stats.period === period) || null,
      past: periods.filter((stats) => stats.period !== period).slice(0, 3),
    },
    settingChanges: n.settingChanges || 0,
    lastHint: n.lastHint || "",
    ...(() => { const h = splitHints(reel); return { currentHints: h.current, pastHints: h.past }; })(),
    settingSince: reel?.settingSince || null,
  };
}

// 遊び方カード（#639 オーナー「店にあるスロットのラミネートくらい文字を減らして」）。
// 短い見出し＋ひとこと＋絵。確率の数字は出さない（#634）。
// art: "lamp"=光ったパッキー／図柄の配列=リールの図柄／"cue"=青緑赤の色見本
const LEGACY_REWARD_GUIDE = { head: "ハズレでも", body: "能力は少し伸びる。天井で必ず当たる" };
const EXP_REWARD_GUIDE = { head: "図柄が揃うと", body: "チェリー・ベル・ボーナスで経験値。ハズレ・リプレイはなし" };
export const GUIDE = [
  { head: "光ったら当たり", body: "パッキーが光ればボーナス！", art: "lamp" },
  { head: "BIG", body: "7・7・7", art: ["seven", "seven", "seven"] },
  { head: "REG", body: "7・7・BAR", art: ["seven", "seven", "bar"] },
  { head: "次ゲーム予告", body: "色文字が出たら、次のゲームの当たりに期待！", art: "cue" },
  LEGACY_REWARD_GUIDE,
  { head: "設定1〜6", body: "大きいほど当たりやすい（必ず当たるわけではない）" },
  { head: "設定が変わる", body: "前回の抽選から7日／章が変わると選び直し。同じ設定や低い設定もある" },
  { head: "ガックン", body: "リールがガクッ＝章の始まり・設定変更後・ロード後の合図" },
  { head: "水色の吹き出し", body: "設定のヒント（確定ではない）" },
];
/** 初回説明とノートで共有する、現在の成長モードの遊び方。旧モードの説明は残す。 */
export function guideTiles() {
  return growthEnabled() ? GUIDE.map((g) => g === LEGACY_REWARD_GUIDE ? EXP_REWARD_GUIDE : g) : GUIDE;
}
const DETAIL_GUIDE = [
  { head: "先ペカと後ペカ", body: "レバーと同時に光る先ペカ、止まってから光る後ペカがあるよ" },
  { head: "揃え直し", body: "光ったあとのもうひと回転は精算用。新しい抽選ではないよ" },
  { head: "天井の気配", body: "長く光らなくても、必ず当たる天井があるよ。近づくとパッキーがそわそわ" },
  { head: "ヒントの読み方", body: "水色の偶奇・高低ヒントにはガセもあるよ。でも「確定」は本当！" },
];
const CUE_JA = { blue: "青", green: "緑", red: "赤" };

/** ラミネートの遊技説明のようなカード（ノートの遊び方と、初回の説明で使う） */
function guideCard(tiles = guideTiles()) {
  const art = (g) => {
    if (g.art === "lamp") return el("span.rn-art.lamp", [pakkiFace()]);
    if (g.art === "cue") return el("span.rn-art.cue", CUE_ORDER.map((c) => el(`i.cue-chip.cue-${c}`, { text: CUE_JA[c] })));
    if (Array.isArray(g.art)) return el("span.rn-art.syms", g.art.map((id) => el("span.rn-sym", { html: SYM[id]() })));
    return null;
  };
  return el("div.rn-card", { dataset: { test: "reel-guide-card" } }, tiles.map((g) => el(`div.rn-tile${g.art ? ".has-art" : ""}`, [
    el("b.rn-tile-head", { text: g.head }), art(g), el("span.rn-tile-body", { text: g.body }),
  ])));
}

export function openNote() {
  if (!state?.reel?.installed) return Promise.resolve();
  const s = noteSummary(state.reel);
  const periodLine = (label, stats) => `${label}: ${stats.spins}回転・BIG ${stats.big}・REG ${stats.reg}・ベル ${stats.bell}`;
  SE.click?.();
  return new Promise((resolve) => {
    const table = el("table.rn-table", [
      el("tr", [el("th", { text: "総回転" }), el("td", { text: `${s.spins}G` }), el("td")]),
      ...s.rows.map(([label, count, rate]) => el("tr", [el("th", { text: label }), el("td", { text: `${count}回` }), el("td", { text: rate })])),
      el("tr", [el("th", { text: "現在のハマり" }), el("td", { text: `${s.current}G` }), el("td")]),
      el("tr", [el("th", { text: "最大ハマり" }), el("td", { text: `${s.maxGap}G` }), el("td")]),
    ]);
    const history = s.history.length
      ? el("ol.rn-history", s.history.map((h) => el(`li.k-${h.kind.toLowerCase()}`, [
        el("b", [h.kind, h.ren ? el("span.rn-ren", { text: "連" }) : null]),
        el("span", { text: `${h.games}G` }), el("small", { text: `第${h.chapter}章 DAY${h.day}` }),
      ])))
      : el("p.rn-empty", { text: "まだ当たりはないよ。光るのを待とう！" });
    const hall = s.freezeLog.length
      ? el("ul.rn-hall", s.freezeLog.map((f) => el("li", { text: `FREEZE　第${f.chapter}章 DAY${f.day}・${f.spin}回転目` })))
      : el("p.rn-empty.rn-secret", { text: "？？？　まだ見ぬ伝説" });
    const panel = el("div.rn-panel", [
      el("div.ri-head", [pakkiFace(".big"), el("span.ri-app", { text: "パッキースロットノート" })]),
      el("div.rn-cols", [
        el("section", [el("h3", { text: "データ" }), table]),
        el("section", [
          el("h3", { text: "当たり履歴（新しい順）" }), history,
          el("h3", { text: "フリーズ殿堂入り" }), hall,
          el("h3", { text: "設定" }),
          el("p.rn-setting", { text: `今の設定は？？？。${s.settingChanges ? `これまでに${s.settingChanges}回変わったよ。` : ""}前回の抽選から7日たつか、章が変わると選び直されるよ` }),
          s.periodStats.current ? el("p.rn-setting", { text: periodLine("今の設定のあいだ", s.periodStats.current) }) : null,
          s.periodStats.past.length ? el("p.rn-setting", [el("small", { text: periodLine("前の設定のあいだ", s.periodStats.past[0]) })]) : null,
          el("h4.rn-hint-head", { text: s.settingSince ? `今の設定のヒント（第${s.settingSince.chapter}章 DAY${s.settingSince.day}から）` : "今の設定のヒント" }),
          s.currentHints.length
            ? el("ul.rn-hints", s.currentHints.map((h) => el("li", { text: `第${h.chapter}章 DAY${h.day}「${h.text}」` })))
            : el("p.rn-empty", { text: "まだないよ。設定が変わったときや、ボーナスのあとに出ることがあるよ" }),
          s.pastHints.length ? el("h4.rn-hint-head.past", { text: "前の設定のヒント（今の設定とは関係ないよ）" }) : null,
          s.pastHints.length ? el("ul.rn-hints.past", s.pastHints.map((h) => el("li", { text: `第${h.chapter}章 DAY${h.day}「${h.text}」` }))) : null,
          el("p.rn-empty", { text: "偶数・奇数や高い・低いのヒントは確定ではないよ" }),
        ]),
      ]),
      el("span.ri-next", { text: "▼ タップで遊び方" }),
    ]);
    // 2ページ目: 遊び方（キャラではなくシステムの説明）
    const guide = el("div.rn-panel.rn-guide", [
      el("div.ri-head", [pakkiFace(".big"), el("span.ri-app", { text: "パッキースロットの遊び方" })]),
      guideCard(),
      el("span.ri-next", { text: "▼ タップで詳しい説明" }),
    ]);
    // 3ページ目: 気になったときに読む詳しい説明
    const details = el("div.rn-panel.rn-guide", [
      el("div.ri-head", [pakkiFace(".big"), el("span.ri-app", { text: "パッキースロットの詳しい説明" })]),
      guideCard(DETAIL_GUIDE),
      el("span.ri-next", { text: "▼ タップで閉じる" }),
    ]);
    const box = el("div.reel-intro.reel-note", { role: "dialog", "aria-label": "パッキースロットノート", dataset: { test: "reel-note" } }, [panel]);
    layers.modal.replaceChildren(box);
    layers.modal.classList.add("show");
    let page = 0;
    box.onclick = () => {
      page += 1;
      if (page <= 2) { SE.click?.(); box.replaceChildren(page === 1 ? guide : details); return; }
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      resolve();
    };
  });
}

// 初回のみ: パッキーのアプリ説明（4行・タップ送り）
const INTRO_LINES = [
  "ボクはパッキー！ C.STATIONのシーシャ大会を盛り上げる、煙のマスコットだよ。よろしくね！",
  "ぷぷぷっ！ C.STATION公式アプリ『MOKUMOKUパッキー』、インストール完了〜！",
  "キミが体力を使って自由行動するたび、ボクのスロットがかってに1回転するよ。回すんじゃない——回っちゃうんだ。",
  "ルールはシンプル！ ボクの顔が光ったら——大当たりっ！ それだけ！",
  "外れても大丈夫。回したぶんだけ、がんばりがちゃーんと積もるよ。ボクの顔をタップすると記録ノートも見られるからね！",
];
// 初回のみ: パッキーの説明のあとに、遊び方カードを1枚（システムの説明）。ノートの遊び方で読み返せる
let installation = null;
/** 会場で導入し、説明直後に最初の一回を体験する。再訪・再開では増やさない。 */
export function installReel() {
  const owner = state;
  if (installation?.owner === owner) return installation.task;
  const run = { owner };
  installation = run;
  run.task = (async () => {
    const reel = owner.reel;
    // 導入済み旧セーブから体験を推測しない。新規導入の途中だけ再開する。
    if (!reel.installed && !reel.introDone && !reel.count && !reel.pending.length) {
      owner.flags._pakki_first_spin_pending = true;
    }
    reel.installed = true;
    owner.flags.pakki_app_installed = true;
    save();
    if (!reel.introDone && !await showIntro()) return;
    if (state !== owner || !owner.flags._pakki_first_spin_pending) return;
    delete owner.flags._pakki_first_spin_pending;
    // 既に行動の回転がある場合はそれを見せ、体験分を追加抽選しない。
    if (!reel.count && !reel.pending.length) commitSpinSeries();
    save(); // 結果・報酬・体験済みを、演出に入る前に同じ保存へ。
    await presentNow({ label: "はじめてのスロット" });
  })().finally(() => {
    if (installation === run) installation = null;
  });
  return run.task;
}

function showIntro() {
  const owner = state;
  const lines = [...INTRO_LINES];
  if (growthEnabled()) lines[lines.length - 1] = "図柄が揃うと経験値が入るよ！ ボクの顔をタップすると、記録ノートも見られるよ！";
  const pages = [...lines.map((text) => ({ text })), { card: true }];
  return new Promise((resolve) => {
    let i = 0;
    const text = el("p.ri-text");
    const face = pakkiFace(".big");
    const app = el("span.ri-app", { text: "MOKUMOKUパッキー" });
    const panel = el("div.ri-panel", [
      el("div.ri-head", [face, app]),
      text,
      el("span.ri-next", { text: "▼ タップ" }),
    ]);
    const box = el("div.reel-intro", { role: "dialog", "aria-label": "MOKUMOKUパッキーの説明", dataset: { test: "reel-intro" } }, [panel]);
    const close = (read) => {
      unsubscribe();
      if (box.parentElement === layers.modal) {
        box.remove();
        if (!layers.modal.childElementCount) layers.modal.classList.remove("show");
      }
      if (read) {
        owner.reel.introDone = true;
        owner.reel.settingGuideDone = true;
        save();
      }
      resolve(read);
    };
    const unsubscribe = on("hud", () => { if (state !== owner) close(false); });
    // 設定の説明はパッキーの台詞ではなくシステムの説明として見せる
    const render = () => {
      const page = pages[i];
      if (page.card) text.replaceChildren(guideCard());
      else text.textContent = page.text;
      panel.classList.toggle("sys", !!page.card);
      face.style.display = page.card ? "none" : ""; // .rw-face の display:block が hidden に勝つため
      app.textContent = page.card ? "パッキースロットの遊び方" : "MOKUMOKUパッキー";
    };
    render();
    layers.modal.replaceChildren(box);
    layers.modal.classList.add("show");
    SE.phone();
    box.onclick = () => {
      if (state !== owner) { close(false); return; }
      i += 1;
      if (i === 2) SE.puka();
      if (i < pages.length) { render(); SE.click(); return; }
      close(true);
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
