// ミニゲームの三段階（初級・中級・上級）と、上級クリアの白火（#3779。2026-11-20 オーナー「各ミニゲームに三段階の難易度を追加」
// 「火種の報酬をつけたい」）。DOM・保存・音に触れない。正本は docs/master_spec.md の「ミニゲームの三段階」。
//
// - 段は 初級(easy)・中級(normal)・上級(hard)。初級は最初から、中級は初級クリア、上級は中級クリアで開く。
//   すでにコース・セットのあるゲーム（ラクダの大会・DJ のセット）は、そのゲームの解放条件をそのまま使う（ここの tierOpen は使わない）。
// - 「クリア」の線はゲームごとに1つ（TIER_GAMES の clear）。上の段をクリアしたら下の段もクリア済みに数える。
// - 上級を初めてクリアしたら白火1つ（growth-board-data.js の PLAY_REWARDS `<game>-hard`。一度だけ・周回でも二度は渡さない）。
// - 記録は growth.playTiers[game] = { cleared: [段], last: 最後に選んだ段 }。growth ごと保存・周回（NG+）へ持ち越す。
//   新しい state.flags は作らない。結果を確定させるアダプター（各ゲームの記録関数）だけが recordTierClear を呼ぶ。
// - TRPG は三段階にしない（最後のシナリオで別に扱う）。てつこも段を持たず、来訪をまたいで溜まる好感度（ハート5）で
//   白火を渡す（2026-11-20 オーナー「てつこは難易度とかないや」）。一台勝負（カード）は保留中のため対象外。
import { emit } from "./bus.js";

export const TIERS = Object.freeze(["easy", "normal", "hard"]);
export const TIER_LABEL = Object.freeze({ easy: "初級", normal: "中級", hard: "上級" });
/** 上級クリアの白火の数（各ゲーム一度だけ）。量は小さく保つ（SPEC 1.5「あげすぎ」）。 */
export const TIER_HARD_GIFT = 1;

/** 対象のゲームと、その段の「クリア」の線（画面の説明と正本に同じ文を使う）。 */
export const TIER_GAMES = Object.freeze({
  axe: Object.freeze({ title: "斧投げ", clear: "その部門の10投で、初級はB・中級と上級はAランク以上" }),
  camel: Object.freeze({ title: "ラクダレース", clear: "その大会で3位以内" }),
  desert: Object.freeze({ title: "サンドボード", clear: "その段でヌールより先にゴール" }),
  dj: Object.freeze({ title: "DJ", clear: "そのセットをBランク以上で回しきる" }),
});

const object = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const isTier = (t) => TIERS.includes(t);

/** 保存済みの記録を読める形にそろえる（読むだけ）。 */
export function tierRecord(s, game) {
  const raw = object(s?.growth?.playTiers?.[game]);
  const cleared = TIERS.filter((t) => Array.isArray(raw.cleared) && raw.cleared.includes(t));
  return { cleared, last: isTier(raw.last) ? raw.last : null };
}

export const tierCleared = (s, game, tier) => tierRecord(s, game).cleared.includes(tier);

/** 初級は最初から。中級・上級は、ひとつ下の段（またはそれより上）をクリアしていれば開く。 */
export function tierOpen(s, game, tier) {
  const i = TIERS.indexOf(tier);
  if (i <= 0) return i === 0;
  const { cleared } = tierRecord(s, game);
  return cleared.some((t) => TIERS.indexOf(t) >= i - 1);
}

/** 今選べる段の一覧（低い順）。 */
export const openTiers = (s, game) => TIERS.filter((t) => tierOpen(s, game, t));

/** 前に選んだ段（開いていなければ、開いている中でいちばん上）。 */
export function defaultTier(s, game) {
  const { last } = tierRecord(s, game);
  if (last && tierOpen(s, game, last)) return last;
  const open = openTiers(s, game);
  return open[open.length - 1] || "easy";
}

function put(s, game, rec) {
  s.growth = object(s.growth);
  s.growth.playTiers = object(s.growth.playTiers);
  s.growth.playTiers[game] = { cleared: [...rec.cleared], ...(rec.last ? { last: rec.last } : {}) };
}

/** 最後に選んだ段を覚える（次に開いた時の既定）。保存は呼び出し側。戻り値は変わったか。 */
export function rememberTier(s, game, tier) {
  if (!s || !TIER_GAMES[game] || !isTier(tier)) return false;
  const rec = tierRecord(s, game);
  if (rec.last === tier) return false;
  put(s, game, { ...rec, last: tier });
  return true;
}

/**
 * 段のクリアを確定する（下の段も一緒にクリア済みにする）。初めてクリアした段があれば "play-tier" を知らせる
 * （growth.js が購読して、上級なら白火を精算する）。戻り値は新しくクリアした段の一覧。
 */
export function recordTierClear(s, game, tier) {
  if (!s || !TIER_GAMES[game] || !isTier(tier)) return [];
  const rec = tierRecord(s, game);
  const upto = TIERS.slice(0, TIERS.indexOf(tier) + 1);
  const added = upto.filter((t) => !rec.cleared.includes(t));
  if (!added.length) return [];
  put(s, game, { ...rec, cleared: TIERS.filter((t) => rec.cleared.includes(t) || upto.includes(t)) });
  emit("play-tier", { state: s, game, tier, added, newlyHard: added.includes("hard") });
  return added;
}

/** 記録の見出し（例:「初級✓ 中級✓ 上級— · 上級クリアで白火1」）。 */
export function tierLine(s, game) {
  const { cleared } = tierRecord(s, game);
  const marks = TIERS.map((t) => `${TIER_LABEL[t]}${cleared.includes(t) ? "✓" : "—"}`).join(" ");
  return cleared.includes("hard") ? `${marks} · 上級クリア済み` : `${marks} · 上級クリアで白火${TIER_HARD_GIFT}`;
}

/** 新しく開いた段の一言（クリアした結果の画面で使う）。無ければ null。 */
export function tierUnlockNote(game, added) {
  const list = Array.isArray(added) ? added : [];
  if (list.includes("hard")) return `${TIER_GAMES[game]?.title || ""}の上級をクリア！ 白火が${TIER_HARD_GIFT}つ届く。`;
  if (list.includes("normal")) return "中級をクリア。上級が開いた。";
  if (list.includes("easy")) return "初級をクリア。中級が開いた。";
  return null;
}

// ---------------------------------------------------------------- 旧保存の取り込み

const passB = (rank) => rank === "S" || rank === "A" || rank === "B";
/** 段を知らない保存から、証明できる段だけをクリア済みにする（知らせない。火種は精算で一度だけ）。 */
const LEGACY = {
  // ラクダ: 入門・標準・上級大会の「3位以内」（cups.*.qualified）
  camel: (s) => {
    const cups = object(s?.flags?._camel_cups && typeof s.flags._camel_cups === "object" ? s.flags._camel_cups : s?.flags?._ch4_camel?.cups);
    return [["rookie", "easy"], ["standard", "normal"], ["expert", "hard"]].filter(([id]) => object(cups[id]).qualified === true).map(([, t]) => t);
  },
  // DJ: SET 1・2・3 の自己ベストが B 以上
  dj: (s) => [["1", "easy"], ["2", "normal"], ["3", "hard"]].filter(([id]) => passB(object(object(s?.dj?.sets)[id]).best?.rank)).map(([, t]) => t),
  // 斧投げ: Barの10投の自己ベスト・前回のうち、部門の分かる記録がその段の線（レクは満点の .45＝B、アマ・プロは .62＝A）以上。
  // レク＝初級・アマ＝中級・プロ＝上級。部門の無い古い記録と3投練習からは推測しない
  axe: (s) => {
    const league = object(object(s?.flags?._axe_bar_records).league);
    const tier = { rec: "easy", am: "normal", pro: "hard" }, line = { rec: 0.45, am: 0.62, pro: 0.62 };
    return [league.best, league.last].map(object).filter((e) => tier[e.division] && e.maximum > 0 && e.total / e.maximum >= line[e.division]).map((e) => tier[e.division]);
  },
  // サンドボード: 段ができる前の勝負は今の中級。ヌールに勝っていれば中級までクリア
  desert: (s) => (Number.isInteger(s?.desert?.wins) && s.desert.wins > 0 ? ["normal"] : []),
};

/**
 * 旧保存の実績を取り込む（その保存で一度だけ。何度呼んでも同じ）。claimPlayRewards の前・各ゲームのメニューを開く時に呼ぶ。
 * 一度きりにするのは、取り込みの後のクリアを必ず recordTierClear で確定させるため（記録より先に取り込みが走ると、
 * 初めてのクリアの一言や知らせが出なくなる）。済んだ印は growth.playTiers._imported（ゲーム名ではないので tierRecord は読まない）。
 */
export function syncPlayTiers(s) {
  if (!s || s.growth?.playTiers?._imported === 1) return;
  s.growth = object(s.growth);
  s.growth.playTiers = { ...object(s.growth.playTiers), _imported: 1 };
  for (const [game, read] of Object.entries(LEGACY)) {
    const found = read(s);
    if (!found.length) continue;
    const rec = tierRecord(s, game);
    const top = Math.max(...found.map((t) => TIERS.indexOf(t)));
    const cleared = TIERS.filter((t, i) => rec.cleared.includes(t) || i <= top);
    if (cleared.length !== rec.cleared.length) put(s, game, { ...rec, cleared });
  }
}
