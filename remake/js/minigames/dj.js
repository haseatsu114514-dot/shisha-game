import { recordPlayMastery, syncPlayMastery } from "../core/play-mastery.js";
import { recordTierClear, tierOpen } from "../core/play-tiers.js";
// DJ ミニゲームを本編から開く部品（2026-11-01 DJS10・クラブSEAM DJS12）。遊びの本体は remake/previews/dj/ をそのまま同じ画面に重ねて使う。
// ミニゲームは時間を使わない（#2113）: 行動・日付・お金・体力は変えない。記録は state.dj に残し、
// 心得の盤の「遊びのご褒美」（SBD39・growth.js の claimPlayRewards）が state.dj.bestRank を読んで、寝る前に感覚の火種を1つ渡す。
import { SETS } from "../../previews/dj/tracks.mjs";

export const DJ_RANKS = Object.freeze(["C", "B", "A", "S"]);
// tier: ミニゲームの三段階（#3779・core/play-tiers.js）。SET 1＝初級・SET 2＝中級・SET 3＝上級。
// 段の「クリア」は、そのセットを B ランク以上で回しきること。解放は今までどおり（前のセットを1回回しきる）。
const SET_TIERS = Object.freeze(["easy", "normal", "hard"]);
export const DJ_SETS = Object.freeze(SETS.map((set, index) => Object.freeze({ id: index + 1, name: set.name, label: set.label, tracks: set.count, tier: SET_TIERS[index] })));
/** セットの段を除いた説明（「入門・ズレなし」→「ズレなし」）。段の名前と並べる時に重ねない。 */
export const djSetNote = set => String(set?.label || "").replace(/^(入門|本命|上級)・/, "");
const rankIndex = rank => DJ_RANKS.indexOf(rank);
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const percent = value => Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;

/** 結果を検査する（DJ からの通知 {type:"dj-result",...} でも、検査済みの結果でもよい）。形の合わないものは null（記録しない）。 */
export function readDjResult(data, set = null) {
  const value = record(data);
  if (!value || (value.type !== undefined && value.type !== "dj-result")) return null;
  const id = Number(value.set), total = percent(value.total), floor = percent(value.floor);
  if (!DJ_SETS.some(item => item.id === id) || (set !== null && id !== set) || rankIndex(value.rank) < 0 || total === null || floor === null) return null;
  return { set: id, rank: value.rank, total, floor };
}

/** 保存済みの記録を読める形にそろえる（読むだけ。state は変えない）。 */
export function djRecords(s) {
  const dj = record(s?.dj), sets = {};
  for (const { id } of DJ_SETS) {
    const entry = record(record(dj?.sets)?.[id]), best = record(entry?.best);
    const plays = Number.isInteger(entry?.plays) && entry.plays > 0 ? entry.plays : 0;
    sets[id] = { plays, best: best && rankIndex(best.rank) >= 0 && percent(best.total) !== null
      ? { rank: best.rank, total: percent(best.total), floor: percent(best.floor) ?? 0, chapter: Number.isInteger(best.chapter) ? best.chapter : null, day: Number.isInteger(best.day) ? best.day : null } : null };
  }
  const ranks = Object.values(sets).flatMap(item => item.best ? [item.best.rank] : []);
  const bestRank = ranks.reduce((best, rank) => best === null || rankIndex(rank) > rankIndex(best) ? rank : best, null);
  return { sets, bestRank };
}

/** SET 1 はいつでも。SET 2・3 は前のセットを1回回しきると開く。 */
/**
 * セットの開き方。全ミニゲーム共通の段の決まり（core/play-tiers.js・#4195 M-35）: SET 1（初級）は最初から、
 * SET 2・3 はひとつ下のセットをクリア（B 以上で回しきる）すると開く。段の記録が無い旧保存は、下のセットの自己ベストが B 以上なら開く。
 * 前の決まり（下のセットの完走だけ）で一度遊んだセットは閉じない。
 */
export function djSetOpen(s, id) {
  if (id === 1) return DJ_SETS.length > 0;
  const set = DJ_SETS.find(item => item.id === id);
  if (!set) return false;
  const sets = djRecords(s).sets;
  return tierOpen(s, "dj", set.tier) || sets[id].plays > 0 || rankIndex(sets[id - 1]?.best?.rank) >= rankIndex("B");
}

/**
 * 回しきったセットを記録する。ベストは点数で比べ、bestRank は全セットで一番良いランク。
 * 戻り値: { entry, newBest, rankUp } か、形の合わない結果なら null。
 */
export function recordDjResult(s, data) {
  const result = readDjResult(data);
  if (!s || typeof s !== "object" || !result) return null;
  syncPlayMastery(s);
  const before = djRecords(s), previous = before.sets[result.set];
  const entry = { rank: result.rank, total: result.total, floor: result.floor,
    chapter: Number.isInteger(s.chapter) ? s.chapter : null, day: Number.isInteger(s.day) ? s.day : null };
  const newBest = !previous.best || entry.total > previous.best.total;
  const sets = Object.fromEntries(Object.entries(before.sets).map(([id, item]) => [id, { plays: item.plays, best: item.best }]));
  sets[result.set] = { plays: previous.plays + 1, best: newBest ? entry : previous.best };
  const after = djRecords({ dj: { sets } });
  s.dj = { sets, bestRank: after.bestRank };
  // 三段階（#3779）: B 以上で回しきったら、そのセットの段をクリア。上級（SET 3）を初めてクリアすると白火1つ（growth が精算）。
  // 達人の記録（精算を呼ぶ）より先に確定する
  const tier = DJ_SETS[result.set - 1]?.tier;
  const tiers = tier && rankIndex(result.rank) >= rankIndex("B") ? recordTierClear(s, "dj", tier) : [];
  recordPlayMastery(s, "dj", result, `${s.cycle || 1}:${result.set}:${sets[result.set].plays}`);
  return { entry, newBest, rankUp: before.bestRank === null || rankIndex(after.bestRank) > rankIndex(before.bestRank), tiers };
}

/** 東京の路地の地下のクラブ「SEAM」（店主は針間ヨル）。第3章の夜の自由時間だけ地図の行き先に出す（自由時間を使わない）。
 *  初めて入るまでは店名を知らないので「地下から低い音がする店」と出す。初回の出会いは ch3_club_first（dj-club.js が再生）。 */
export const CLUB_MET_FLAG = "_club_yoru_first_done";
export const DJ_NIGHT = Object.freeze({ id: "dj", place: "club", label: "クラブSEAMで回す",
  reasonText: "時間は進まない。セットを選んで曲をつなぐ" });
export const DJ_NIGHT_FIRST = Object.freeze({ id: "dj", place: "club_unknown", label: "地下から低い音がする店をのぞく",
  reasonText: "路地の下から、音が上がってくる" });
export const clubKnown = value => value?.flags?.[CLUB_MET_FLAG] === true;

// セットの後のヨルとの会話（ミニゲームのドラマ・2026-11-15 オーナー「始めるきっかけや途中や一区切り」・SPC26）。
// きっかけ＝初めての夜（ch3_club_first）、最初の手応え＝初めてAランク以上（ch3_club_a_talk）、
// 途中＝通算3セット目で常連から初めてのリクエスト（ch3_club_request）、
// 一区切り＝三つのセットすべてでA以上を出した夜、閉店前の三十分をヨルと交代で回す（ch3_club_last_set）。
// どれも一度だけで、1回のセットの後に読むのは一つまで（先に来たものから）。時間・お金・体力・好感度は変えない。
export const CLUB_A_TALK_FLAG = "_club_yoru_a_talk";
export const CLUB_REQUEST_FLAG = "_club_yoru_request";
export const CLUB_LAST_SET_FLAG = "_club_yoru_last_set";
export const CLUB_REQUEST_PLAYS = 3;
const high = rank => rank === "A" || rank === "S";
/** 今のセットの結果（results）の後に読む会話 { scene, flag }。無ければ null。状態は変えない。 */
export function djTalkAfterSet(s, results = []) {
  const flags = s?.flags || {};
  if (results.some(item => high(item?.rank)) && flags[CLUB_A_TALK_FLAG] !== true) return { scene: "ch3_club_a_talk", flag: CLUB_A_TALK_FLAG };
  const { sets } = djRecords(s);
  const plays = Object.values(sets).reduce((sum, item) => sum + item.plays, 0);
  if (plays >= CLUB_REQUEST_PLAYS && flags[CLUB_REQUEST_FLAG] !== true) return { scene: "ch3_club_request", flag: CLUB_REQUEST_FLAG };
  if (flags[CLUB_A_TALK_FLAG] === true && flags[CLUB_LAST_SET_FLAG] !== true && DJ_SETS.every(set => high(sets[set.id].best?.rank))) {
    return { scene: "ch3_club_last_set", flag: CLUB_LAST_SET_FLAG };
  }
  return null;
}
export function djNightChoices(value, window) {
  if (value?.chapter !== 3 || !window || window.slot !== 1) return [];
  return [{ ...(clubKnown(value) ? DJ_NIGHT : DJ_NIGHT_FIRST), ok: true, consumes: false, dj: true }];
}

/** 本編の音量設定と、自分のモニターヘッドホン（VOL07・▶の判定の幅が前後¼拍広い）を DJ へ渡す URL。
 *  best: このセットの自己ベストの点（0〜100・無ければ付けない）。結果の板が「自己ベストまであと○点」を出す（DJF07）。 */
export function djUrl(set, { muted = false, volume = 0.5, phones = false, phone = false, best = null } = {}) {
  const url = new URL("../../previews/dj/index.html", import.meta.url);
  url.searchParams.set("set", String(set));
  url.searchParams.set("embed", "1");
  if (muted) url.searchParams.set("mute", "1");
  if (Number.isFinite(volume)) url.searchParams.set("vol", String(Math.max(0, Math.min(1, volume))));
  if (phones === true) url.searchParams.set("phones", "1");
  if (phone === true) url.searchParams.set("phone", "1"); // スマホ密度（表示だけ。判定・採点は変わらない）
  if (percent(best) !== null) url.searchParams.set("best", String(percent(best))); // 表示だけ。記録は本編の state.dj が正本
  return url.href;
}

/**
 * DJ を host（本編の #stage・1280×720）の上に重ねて開く。「戻る」か signal の中断で閉じる。
 * セットを回しきるたびに onResult(result) を呼ぶ（もう一度遊べば何度でも）。
 * 戻り値: { results: [...] }。閉じたら iframe は片付ける。
 */
export function runDjSet({ host, set = 1, signal = null, muted = false, volume = 0.5, phones = false, phone = typeof document !== "undefined" && document.documentElement.dataset.density === "phone", best = null, onResult = null } = {}) {
  if (!host || !DJ_SETS.some(item => item.id === set)) return Promise.reject(new Error("DJ set unavailable"));
  return new Promise(resolve => {
    const results = [];
    if (signal?.aborted) { resolve({ results }); return; }
    const frame = document.createElement("iframe");
    frame.className = "dj-frame";
    frame.title = `DJ ${DJ_SETS[set - 1].name}`;
    frame.dataset.test = "dj-frame";
    frame.setAttribute("allow", "autoplay");
    // ステージいっぱいに重ねる（ワイドステージでは 1280 より広い）。DJ の板は中で枠の横幅に合わせて最大1600まで広がる（controller-fx.mjs）。
    // iframe の中には safe-area（iPhone 横持ちのノッチ）が届かないので、ノッチの分だけ枠を内側に寄せ、端のデッキが欠けないようにする（base.css の --stage-safe-l/r）
    Object.assign(frame.style, { position: "absolute", left: "var(--stage-safe-l, 0px)", top: "0", width: "calc(100% - var(--stage-safe-l, 0px) - var(--stage-safe-r, 0px))", height: "100%", border: "0", zIndex: "60", background: "#0b0812" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("message", listen);
      signal?.removeEventListener("abort", finish);
      frame.remove(); // 中の音声は pagehide で片付く
      resolve({ results });
    };
    const listen = event => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      if (event.data?.type === "dj-exit") { finish(); return; }
      if (event.data?.type !== "dj-result") return;
      const result = readDjResult(event.data, set);
      if (!result) return;
      results.push(result);
      try { onResult?.(result); } catch (error) { console.error(error); }
    };
    window.addEventListener("message", listen);
    signal?.addEventListener("abort", finish, { once: true });
    frame.addEventListener("load", () => { try { frame.contentWindow?.focus(); } catch { /* same origin only */ } }, { once: true });
    frame.src = djUrl(set, { muted, volume, phones, phone, best });
    host.append(frame);
  });
}
