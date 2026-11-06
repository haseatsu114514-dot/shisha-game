// 大会の節目の演出を第1章から共有する部品（#2688 A16・A20）。保存・進行・票には触れない、見せるだけの部品。
// 第1章の「当日の入り（DAYカード→暗い煙ワイプ）」「ROUNDの横帯」「結果の10カウント（プチュン／パリン）」を第2〜4章でも使う。
// 審査員長の持ち点カットイン（伏見の10点）は第1章の採点の仕組みなので、第2〜4章は各章の結果カードのまま。
import { dayCard, smokeWipe, roundCut, layers } from "../core/ui.js";
import { el, sleep } from "../core/util.js";
import { playBgm } from "../core/audio.js";
import { resultCountdown, celebrate } from "../craft/result.js";
import { ENTRANCE_CARDS } from "./tournament-entrance.js";
import { displayName } from "../core/data.js";
import { state } from "../core/state.js";
import { chapterDay } from "../core/chapter-clock.js";

// 共通の制作工程（第2〜4章とも setup〜adjust の11工程）の区切り。第1章の ROUND 1〜4 と同じ名前
export const ROUND_AT = new Map([
  [0, ["ROUND 1", "準備"]],
  [8, ["ROUND 2", "吸い出し・提供"]],
  [9, ["ROUND 3", "調整 1回目"]],
  [10, ["ROUND 4", "調整 2回目"]],
]);

const fastForward = () => !!(window.__remake?.craftTest?.auto || window.__remake?.vnTest?.turbo);

/** 大会当日の朝の DAYカード（第1章の enterTournamentDay と同じ「DAY n ／ 大会名 当日」） */
export async function tournamentDayCard(title) {
  if (fastForward()) return;
  await dayCard(`DAY ${chapterDay(state)}`, `${title} 当日`);
}

/** 会場入り。暗い煙ワイプの内側で待機の曲へ替える（第1章の会場入りと同じ） */
export async function tournamentArrival({ bgm = "bgm_tournament_wait" } = {}) {
  if (fastForward()) { playBgm(bgm); return; }
  await smokeWipe(() => playBgm(bgm), { color: "dark" });
}

/** 工程 step の頭が ROUND の区切りなら、その横帯を出す。shown に記録し、同じ場面の中で二度は出さない */
export async function roundBandAt(step, shown = new Set()) {
  const round = ROUND_AT.get(step);
  if (!round || shown.has(step) || fastForward()) return;
  shown.add(step);
  await roundCut(...round);
}

/** 順位から10カウントの終わり方を決める（第1章の outcomeOf と同じ区分: 1位=プチュン、2〜3位=プチュ…パリン、それ以外=パリン） */
export const countdownKind = (rank) => rank === 1 ? "win" : rank === 2 || rank === 3 ? "close" : "lose";

/**
 * 結果の10カウント（第1章の RESULT 10 COUNT）。contestants は画面に並べる出場者（はじめを含む）、eyebrow は見出しの小さな文字。
 * 1位のときは紙吹雪で締める。カウントの画面は次の画面で片付く。
 */
export async function resultMoment(cs, rank, { contestants, eyebrow }) {
  if (fastForward()) return;
  await resultCountdown(cs, countdownKind(rank), null, { contestants, eyebrow });
  if (rank === 1) await celebrate();
}

// 第4章: 四人が同時に作る世界大会。視線がほかの作り手へ移るとき、その人の名前と二つ名の帯を短く流す（A20）
const FOCUS_RIVALS = ["naru", "master_hookah", "sheikh"];
const FOCUS_NAME = { master_hookah: "王 煙楼" };

/** 会話の行のうち、最初に話すライバルを返す（いなければ null） */
export function focusRival(dialogue, rivals = FOCUS_RIVALS) {
  for (const line of dialogue?.lines || []) if (rivals.includes(line.speaker)) return line.speaker;
  return null;
}

/** 名前と二つ名の小さな横帯。ROUNDの横帯の小型版（約0.9秒） */
export async function focusBand(id, chapter = 4) {
  if (!id || fastForward() || !layers.fx) return;
  const card = ENTRANCE_CARDS[chapter]?.find((entry) => entry.id === id);
  const name = FOCUS_NAME[id] || displayName(id, state);
  const band = el("div.round-cut.focus", { dataset: { test: "focus-band", focus: id } }, [el("b", { text: name }), card?.ring ? el("small", { text: card.ring }) : null]);
  layers.fx.append(band);
  await sleep(20);
  band.classList.add("show");
  await sleep(700);
  band.classList.add("out");
  await sleep(320);
  band.remove();
}
