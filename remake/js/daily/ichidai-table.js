// カードゲーム「一台勝負」を本編から開く入口（tonari のメニュー）。
// 時間・お金・体力は使わない（DJ と同じ）。対戦を最後まで打ったときだけ戦績を state.ichidai に残して保存する。
// 人どうしの対戦で数値を確かめるまでは既定で切。URL に ?ichidai=1 で入（端末に覚える）、?ichidai=0 で切。
// 単体で試すなら remake/ichidai.html、本編の保存に触れずに開くなら DBG のミニゲーム一覧。
import { state, save } from "../core/state.js";
import { toast } from "../core/ui.js";
import { currentBgm, playBgm } from "../core/audio.js";
import { TOURNAMENTS } from "../minigames/ichidai-data.js";

const KEY = "suien_ichidai"; // tonari のメニュー（daily/tonari.js の ichidaiOn）も同じ名前を読む
let enabled = false;
let active = false;

/** 起動時に一度呼ぶ。入っているかを返す。 */
export function initIchidaiSwitch() {
  try {
    const q = new URLSearchParams(location.search).get("ichidai");
    if (q === "1" || q === "0") localStorage.setItem(KEY, q);
    enabled = localStorage.getItem(KEY) === "1";
  } catch { enabled = false; }
  return enabled;
}
export const ichidaiEnabled = () => enabled;

const count = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
/** 保存済みの戦績を読める形にそろえる（読むだけ。state は変えない）。 */
export function ichidaiRecords(s) {
  const raw = s?.ichidai && typeof s.ichidai === "object" ? s.ichidai : {};
  const tours = {};
  for (const t of TOURNAMENTS) {
    const e = raw.tours && typeof raw.tours === "object" ? raw.tours[t.id] : null;
    tours[t.id] = { plays: count(e?.plays), wins: count(e?.wins), best: Number.isFinite(e?.best) ? e.best : null };
  }
  return { plays: count(raw.plays), wins: count(raw.wins), losses: count(raw.losses), draws: count(raw.draws), tours };
}
/**
 * 最後まで打った対戦を記録する。game = { winner（0=自分/1=相手/null）, scores:[自分, 相手], tournament }
 * 戻り値: { firstWin（その大会の初勝利）, newBest（その大会の自己最高点） } か、形の合わない結果なら null
 */
export function recordIchidaiResult(s, game) {
  if (!s || typeof s !== "object" || !game || !Array.isArray(game.scores) || !TOURNAMENTS.some((t) => t.id === game.tournament)) return null;
  const mine = Number(game.scores[0]);
  if (!Number.isFinite(mine)) return null;
  const r = ichidaiRecords(s), t = r.tours[game.tournament];
  const won = game.winner === 0, lost = game.winner === 1;
  const firstWin = won && t.wins === 0, newBest = t.best === null || mine > t.best;
  r.plays++; if (won) r.wins++; else if (lost) r.losses++; else r.draws++;
  r.tours[game.tournament] = { plays: t.plays + 1, wins: t.wins + (won ? 1 : 0), best: newBest ? mine : t.best };
  s.ichidai = r;
  return { firstWin, newBest };
}

/** 卓に着く。遊んでも行動は進まないので、いつも false を返す。 */
export async function visitIchidaiTable({ isCurrent = () => true, signal = null } = {}) {
  if (active || !state || signal?.aborted || !isCurrent()) return false;
  active = true;
  const owner = state, controller = new AbortController();
  const current = () => !controller.signal.aborted && state === owner && isCurrent();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  window.addEventListener("pagehide", cancel, { once: true });
  const bgmBefore = currentBgm();
  try {
    const { runIchidai } = await import("../minigames/ichidai.js");
    if (!current()) return false;
    const before = ichidaiRecords(owner);
    const result = await runIchidai({ host: document.getElementById("stage"), signal: controller.signal, tutorial: before.plays === 0,
      opponent: { id: "sumi", name: "スミさん" } });
    if (!current()) return false;
    let changed = false;
    for (const game of result.games) {
      const saved = recordIchidaiResult(owner, game);
      if (!saved) continue;
      changed = true;
      const name = TOURNAMENTS.find((t) => t.id === game.tournament)?.name || "";
      if (saved.firstWin) toast(`一台勝負：${name} 初勝利`, { kind: "good" });
      else if (saved.newBest && game.winner === 0) toast(`一台勝負：${name} 自己最高 ${game.scores[0]}点`, { kind: "good" });
    }
    if (changed) save();
    return false;
  } finally {
    signal?.removeEventListener("abort", cancel);
    window.removeEventListener("pagehide", cancel);
    controller.abort(); active = false;
    if (bgmBefore && state === owner && currentBgm() !== bgmBefore) playBgm(bgmBefore);
  }
}
