import { state } from "../core/state.js";
import { DB, sceneBg, loadCinemaDialogue } from "../core/data.js";
import { imageReady, toast, withScenePreparation } from "../core/ui.js";
import { addMoney, addStamina, earnStat } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { play, isPlaying } from "../vn/engine.js";
import { CINEMA, CINEMA_FILMS, CINEMA_INTRO, cinemaDiscovered, cinemaIntroductionDue } from "../core/cinema-discovery.js";

const active = new WeakSet();
const introductions = new WeakSet();
const stamp = game => `${game.chapter}:${game.day}:${game.slot}`;
export const cinemaSpot = () => state?.chapter >= 2 ? CINEMA : null;

/** 読了結果だけを返す。解放flag・料金・行動の確定は自主訪問callerに一緒に任せる。 */
export async function readCinemaIntroduction({ signal = null } = {}) {
  if (!cinemaIntroductionDue(state) || signal?.aborted || isPlaying() || introductions.has(state)) return false;
  const owner = state;
  await loadCinemaDialogue();
  if (state !== owner || !cinemaIntroductionDue(state) || signal?.aborted || isPlaying() || introductions.has(state)
    || !DB.dialogues[CINEMA_INTRO]?.lines?.length) return false;
  const before = stamp(owner);
  introductions.add(owner);
  try {
    const result = await play(CINEMA_INTRO, { signal });
    return state === owner && stamp(state) === before && !signal?.aborted
      && !!result && !result.cancelled && cinemaIntroductionDue(state);
  } finally { introductions.delete(owner); }
}

/** calendarのpaidAction内で呼ぶ。正常読了後だけ精算し、枠と保存はcalendarに返す。 */
export async function visitCinema({ signal = null } = {}) {
  if (!cinemaDiscovered(state) || state.phase !== "daily" || ![0, 1].includes(state.slot)
    || isPlaying() || signal?.aborted || active.has(state)) return false;
  const owner = state, visitStamp = stamp(owner);
  const current = () => state === owner && stamp(state) === visitStamp
    && state.phase === "daily" && !signal?.aborted;
  if (state.flags._cinema_visit === visitStamp || state.visitedDay.rojiura_cinema === state.day
    || spendableMoney(state) < CINEMA.cost) return false;
  await loadCinemaDialogue();
  if (!current() || isPlaying() || active.has(state)
    || state.flags._cinema_visit === visitStamp || state.visitedDay.rojiura_cinema === state.day
    || spendableMoney(state) < CINEMA.cost) return false;
  const count = state.spotVisits?.rojiura_cinema || 0;
  const id = count === 0 ? CINEMA.first : CINEMA.pool[(count - 1) % CINEMA.pool.length];
  if (!DB.dialogues[id]?.lines?.length) return false;
  const film = CINEMA_FILMS[DB.dialogues[id].metadata?.cinema_film];
  if (!film) return false;
  active.add(owner);
  try {
    // 未登録・読込失敗でも課金しない。候補原画を自動採用して回避しない。
    const bg = sceneBg(film.bg, "day").url;
    if (!await withScenePreparation(imageReady(bg, 4000))) {
      if (current()) toast("上映を始められませんでした。街へ戻ります");
      return false;
    }
    if (!current()) return false;
    const result = await play(id, { bg: film.bg, signal });
    if (!current() || !result || result.cancelled || !cinemaDiscovered(state)
      || spendableMoney(state) < CINEMA.cost) return false;
    addMoney(-CINEMA.cost);
    addStamina(CINEMA.stamina);
    (state.spotVisits ||= {}).rojiura_cinema = count + 1;
    state.flags._cinema_visit = visitStamp;
    earnStat(CINEMA.stat, 4);
    return true;
  } finally { active.delete(owner); }
}
