// 恋人システム（master_spec #11 / #24・CLAUDE.md「ヒロイン・好感度・修羅場システム」）。
// 好感度MAX → 交友の締めくくり（daily/bonds.js）→ 恋愛の答えを重ねた相手だけ告白（あげは以外は主人公が踏み出すかどうかから）
// → 付き合う／友達のまま。好感度MAXや訪問回数だけでは告白は起きない（HF05）。
// 恋人の絆（Lv1〜5）はプライベート（LIMEの誘いで行くデート・恋人とのLIME・恋愛イベント）でだけ深まる。
// 恋人に自分から会いに行くボタンは置かない（オーナー指定: 恋人とは LIME の誘いや連絡でつながる）。
// 2人以上と付き合うと、うしろめたさが積もり、大会当日に修羅場が起きる。
// 文面の正本: 告白=data/dialogue/confession.json、節目=lover_events.json、LIME・デート=remake/data/lover.json
import { DB, callName } from "../core/data.js";
import { state, save } from "../core/state.js";
import { chapterDay } from "../core/chapter-clock.js";
import { gainAffinity, releaseLoveAffinity, privateBondScope, addStamina, bond, AFFINITY_RANK_PTS } from "../core/stats.js";
import { emit } from "../core/bus.js";
import { hiyoriRoute, hiyoriFinaleReady } from "../core/hiyori-route.js";
import { play, isPlaying } from "../vn/engine.js";
import { samechanMilestoneDue, playSamechanMilestone } from "./samechan-bonds.js";
import { dateScene, dateVenue, relationshipDayTotal } from "./date-scene.js";
import { playSamechanDate, samechanDateGap, samechanDateReady } from "./samechan-date.js";

// 告白は「帰り道」の場面。背景を持たない台本は通りの絵で（前の場面の背景を引き継がない）
const STREET = "res://assets/backgrounds/bg_street.png";

const L = () => DB.lover || {};
const dayTotal = relationshipDayTotal;
export const isLover = (id) => (state.lovers || []).includes(id);
// 告白・デート・恋人の節目は仕事を離れた私的な場面（みんとは本名を聞いた後なら「栞さん」と呼ぶ）
const privateCall = (id) => callName(id, state, { context: "private" });

/**
 * 告白できる相手か。交友の締めくくり（daily/bonds.js）で恋愛ルートに入り（答えた質問がすべて恋愛寄り）、
 * まだ恋人でも「友達のまま」でもない。予約（締めくくりの直後）と再生（夜の帰り道）の両方でこれを確かめる
 */
export function romanceRouteOpen(id) {
  if (id === "hiyori") {
    const route = hiyoriRoute();
    if (!hiyoriFinaleReady() || !state.flags[route.finale?.flag]
      || ![route.question?.choice,route.finale?.question].every(key => state.romanceChoices[key]?.char === id && state.romanceChoices[key].value > 0)) return false;
  }
  if (id === "samechan" && (!(state.chapter >= 2 && state.chapter <= 3)
    || !state.flags._samechan_bond_question_done
    || state.romanceChoices?.bond_q1_samechan?.char !== id
    || state.romanceChoices?.bond_q2_samechan?.char !== id
    || !(state.romanceChoices?.bond_q1_samechan?.value > 0)
    || !(state.romanceChoices?.bond_q2_samechan?.value > 0))) return false;
  const answers = Object.values(state.romanceChoices || {}).filter((a) => a?.char === id);
  return !!id && state.finales?.[id]?.route === "romance" && answers.length > 0 && answers.every((a) => a.value > 0)
    && !isLover(id) && !state.flags[`_friend_${id}`] && !!DB.dialogues[`confession_${id}`];
}

// ---------------------------------------------------------------- 付き合う

function becomeLovers(id) {
  if (isLover(id)) return;
  state.lovers.push(id);
  state.loveLevel[id] = state.loveLevel[id] || 1;
  state.lovePts[id] = Math.max(state.lovePts[id] || 0, AFFINITY_RANK_PTS[1]);
  if (state.loverSince[id] == null) state.loverSince[id] = dayTotal();
  if (state.lovers.length >= 2) state.guilt = (state.guilt || 0) + 2; // 2人目以降＝隠しごとが増える
  emit("lovers", { id });
  save();
}

/** 会話に入るたびに呼ばれる（engine の hooks.onEnter）。告白の返事は分岐先の dialogue_id で決まる */
export function onDialogueEnter(id, dlg) {
  const m = /^confession_(\w+)_(accept|reject)$/.exec(id || "");
  if (m) {
    // この新規ルートは正式な締めくくりからだけ成立。既存の友人/恋人を再読で変更しない。
    if (m[1] === "samechan" && !romanceRouteOpen("samechan")) return;
    if (m[1] === "hiyori" && !romanceRouteOpen("hiyori")) return;
    if (m[2] === "accept") becomeLovers(m[1]);
    else state.flags[`_friend_${m[1]}`] = true; // 友達のまま（以後この告白は出ない）
  }
  const r = dlg?.metadata?.set_romance;
  if (r && (r !== "hiyori" || romanceRouteOpen(r))) becomeLovers(r);
}

// ---------------------------------------------------------------- 告白

const gateScene = (id) => ({
  dialogue_id: `remake_confession_gate_${id}`,
  metadata: { private_scene: true },
  lines: [
    { speaker: "", text: `（……${privateCall(id)}のことを考えると、胸の奥がずっと落ち着かない）` },
    { speaker: "", text: "（この気持ちに、名前をつけるなら——）" },
    { type: "choice", choices: [
      { text: "今日、想いを伝えよう", next: "go" },
      { text: "……まだ、今は胸にしまっておく", next: "wait" },
    ] },
  ],
  branches: {
    go: [{ type: "set_flag", flag: "_confession_go" }],
    wait: [{ speaker: "", text: "（大会のこと、店のこと。……今は目の前のことに集中しよう。でも、いつかきっと）" }],
  },
});

const cheatScene = (id) => ({
  dialogue_id: `remake_cheat_warning_${id}`,
  metadata: { private_scene: true },
  lines: [
    { speaker: "", text: `（……今、${state.lovers.map(privateCall).join("、")}と付き合っている）` },
    { speaker: "", text: "（この気持ちに応えれば、隠しごとがひとつ増える。それでも？）" },
    { type: "choice", choices: [
      { text: "それでも、気持ちに応えたい", next: "go" },
      { text: "……今は、目の前の人を大切にする", next: "stay" },
    ] },
  ],
  branches: {
    go: [{ type: "set_flag", flag: "_cheat_go" }, { speaker: "", text: "（胸の奥が、少しだけ重くなった気がした）" }],
    stay: [{ speaker: "", text: "（気づかないふりをした。……この想いには、まだ答えを出さない）" }],
  },
});

/**
 * 一日の終わり（夜の行動と固定イベントの後）に呼ぶ。恋愛ルートで告白を待つ相手がいれば告白イベントを始める。
 * 予約（_confession_due）は締めくくりの直後に入るが、再生の前にもルートを確かめ直す。
 * 旧セーブに残った予約だけ（好感度MAXの自動予約）では告白しない。
 * @param beat 「（……○○の顔が、ふと浮かんだ）」のような一拍を出す関数（前触れなくシーンへ飛ばない）
 * @param opts.busyNight 今夜すでに約束（誘い・締めくくり）で人と会った
 * @param opts.companion 今夜会った相手。同じ相手への告白は帰り道に続け、別の相手なら後日に回す
 * @returns 何か起きたか
 */
export async function maybeConfession(beat, { busyNight = false, companion = null } = {}) {
  if (state.phase !== "daily" || state.slot < 2) return false; // 昼の行動から仕事後の夜へ飛ばない
  let id = state.flags._confession_due;
  if (id && !romanceRouteOpen(id)) { delete state.flags._confession_due; id = null; }
  // 2人目の恋愛ルートなど、予約の空きを待っていた相手を拾う（締めくくりの順）
  if (!id) id = Object.keys(state.finales || {}).find(romanceRouteOpen) || null;
  if (!id) return false;
  state.flags._confession_due = id;
  // 新規進行は私的な約束の後。旧セーブの紹介済み・本名記録なしは、下の名乗り補完へ進める。
  if (id === "minto" && !(state.flags._minto_name_known || state.flags._minto_identity_revealed)) return false;
  if ((state.flags._confession_wait || 0) > state.day || busyNight && companion !== id) return false;
  delete state.flags._confession_due;
  await beat(companion === id ? "——別れ際、もう少しだけ話したくなった。" : id === "ageha" ? "——と、そのとき。" : `（……${privateCall(id)}の顔が、ふと浮かんだ）`);
  // すでに恋人がいるなら、応える前に一度立ち止まる
  if (state.lovers.length) {
    delete state.flags._cheat_go;
    await play(cheatScene(id), { bg: STREET });
    if (!state.flags._cheat_go) { state.flags._confession_wait = state.day + 3; save(); return true; }
    delete state.flags._cheat_go;
    state.guilt = (state.guilt || 0) + 1;
  } else if (id !== "ageha") {
    // あげは以外は、主人公が踏み出すかどうかから（あげはだけは向こうから来る）
    delete state.flags._confession_go;
    await play(gateScene(id), { bg: STREET });
    if (!state.flags._confession_go) {
      state.flags._confession_due = id;
      state.flags._confession_wait = state.day + 2;
      save();
      return true;
    }
    delete state.flags._confession_go;
  }
  // 旧セーブは私服の交流済みでも、本名を聞いた記録だけがないことがある。
  // 告白する意思を示した後で名乗りを補い、未知の名前を主人公が先に呼ばない。
  if (id === "minto" && !state.flags._minto_name_known) {
    await play({
      dialogue_id: "remake_minto_name_before_confession",
      metadata: { bg: "res://assets/backgrounds/bg_street_night.png", private_scene: true },
      lines: [
        { speaker: "", text: "仕事を終えて、私服の彼女と待ち合わせた。話し始める前に、彼女が小さく息を吸った。" },
        { speaker: "minto", face: "ura_normal", text: "……改めて、ちゃんと名乗るね。緑川栞。お店では『みんと』だけど、２人の時は、栞って呼んでくれたら嬉しい" },
        { type: "set_flag", flag: "_minto_name_known" }, // ここから名前欄も「栞」
        { speaker: "hajime", face: "normal", text: "栞さん。……教えてくれて、ありがとう" },
        { speaker: "minto", face: "ura_smile", text: "……うん。その呼び方、ちょっと照れるけど。ちゃんと、私に話しかけてくれてる感じがする" },
      ],
    });
    state.flags._minto_name_known = true;
    save();
  }
  await play(`confession_${id}`, DB.dialogues[`confession_${id}`]?.metadata?.bg ? {} : { bg: STREET });
  if (id === "samechan" && isLover(id)) await playSamechanMilestone();
  save();
  return true;
}

// ---------------------------------------------------------------- デート

let milestonePlaying = false;

/** 現在の絆Lvまでの最初の未読場面。LIMEや旧セーブで先に進んでも、未読の前段を飛ばさない。 */
export function loverMilestoneDue(id) {
  if (id === "samechan") return samechanMilestoneDue();
  if (!isLover(id)) return null;
  const seen = state.loverEventsSeen || [];
  const level = Math.min(5, state.loveLevel[id] || 0);
  for (let n = 1; n <= level; n++) {
    const base = `lover_${id}_lv${n}`;
    for (const eventId of [base, `${base}_b`]) {
      const scene = DB.dialogues[eventId];
      if ((eventId !== base && !scene) || seen.includes(eventId)) continue;
      // 通常台本が欠けた時や、未完成の追加台本がある時は後段へ進まない。
      if (!scene?.lines?.length || (scene.metadata?.min_chapter || 1) > (state.chapter || 1)) return null;
      return eventId;
    }
  }
  return null;
}

/** 実際に会った私的な場面の読了後、未読の節目を一つだけ読む。読了前の保存では未読のまま。 */
export async function playLoverMilestone(id, { signal = null } = {}) {
  if (milestonePlaying || isPlaying()) return false;
  if (id === "samechan") return playSamechanMilestone({ signal });
  const eventId = loverMilestoneDue(id);
  if (!eventId) return false;
  const owner = state, restorePrivate = privateBondScope();
  milestonePlaying = true;
  try {
    if (signal?.aborted) return false;
    const result = await play(eventId, { signal });
    if (state !== owner || signal?.aborted || (!result || result.cancelled)) return false;
    state.loverEventsSeen ||= [];
    if (!state.loverEventsSeen.includes(eventId)) state.loverEventsSeen.push(eventId);
    releaseLoveAffinity(id);
    save();
    return true;
  } finally {
    restorePrivate();
    milestonePlaying = false;
  }
}

/** デート（LIMEの誘いを受けた時間帯に呼ぶ）。行き先はデート回数でローテーション */
export async function playDate(id) {
  if (id === "samechan") return playSamechanDate();
  const sc = (L().dates || {})[id];
  if (!sc) {
    console.error(`[romance] Missing date scene for ${id}`);
    return;
  }
  const venue = dateVenue(id);
  state.lastDate[id] = state.day;
  bond.private = true;
  await play(dateScene(id, venue));
  gainAffinity(id, 10);
  bond.private = false;
  addStamina(-10);
  save();
  await playLoverMilestone(id);
}

// ---------------------------------------------------------------- 恋人からの LIME

const chat = (id, msgId, v) => ({
  id: msgId, sender: id, type: "chat", lover: true,
  messages: v.m.map((t) => String(t)), replies: v.r,
});

/** 通常のデートは定休日の午後か仕事後。大事な物語は夜の予定と重なる日に臨時休暇を取れる。 */
export function dateSchedule(id, { day = state.day, fixedNight = () => false, allowTemporaryClosure = false } = {}) {
  // 神崎・REIは第2章の店の定休日（chapters/ch2-preparation.js の CH2_CLOSED_ON と同じ曜日）。
  const closedOn = { minto: 6, naru: 3, adam: 5, kumicho: 0, rei: 1 }[id];
  if (closedOn != null && day % 7 === closedOn) return { time_slot: "noon", closed_on: closedOn };
  if (fixedNight(day)) return allowTemporaryClosure ? { time_slot: "noon", temporary_closed: true } : null;
  return { time_slot: "night", after_close: true };
}

/**
 * 今朝届く恋人からの LIME（記念日・デートの誘い・朝のひとこと・試合の朝）。
 * @param opts.tournamentDay 大会当日の朝か
 * @param opts.fixedNight (day) => その夜に固定イベントがあるか（夜の約束を重ねない）
 */
export function loverMessages({ tournamentDay = false, fixedNight = () => false } = {}) {
  const out = [];
  const read = (id) => state.limeRead.includes(id);
  const phase = L().limePhase || {};
  for (const id of state.lovers || []) {
    if (id === "samechan" && (state.chapter || 1) < 2) continue;
    const chapterKey = id === "samechan" ? `_c${state.chapter || 1}` : "";
    if (tournamentDay) {
      const pool = (L().gameday || {})[id];
      const msgId = `_lover_gameday_${id}_c${state.chapter}`;
      if (pool?.length && !read(msgId)) out.push(chat(id, msgId, pool[(state.day + (phase[id] || 0)) % pool.length]));
      continue;
    }
    // 付き合って最初の朝: 私用のLIMEからの最初のひとこと（みんと＝お仕事用とは別の「栞」・HF11）
    const intro = (L().privateAccount || {})[id];
    const introId = `_lover_private_account_${id}`;
    if (intro && !read(introId)) {
      out.push(chat(id, introId, intro));
      continue;
    }
    // 記念日（付き合って10日ごと）
    const n = dayTotal() - (state.loverSince[id] ?? dayTotal());
    const anniv = (L().anniversary || {})[id];
    if (n > 0 && n % 10 === 0 && anniv && !read(`_lover_anniv_${id}_n${n}`)) {
      const v = { m: anniv.m.map((t) => t.replace("{n}", n)), r: anniv.r };
      out.push(chat(id, `_lover_anniv_${id}_n${n}`, v));
      continue;
    }
    // デートの誘い（数日おき。絆がMAXになっても頻度を落として続く）
    const maxed = (state.loveLevel[id] || 0) >= 5;
    const last = state.lastDate[id] ?? -9;
    const invId = `_date_inv_${id}${chapterKey}_d${state.day}`;
    const schedule = dateSchedule(id, { fixedNight });
    const gap = id === "samechan" ? samechanDateGap() : state.day - last;
    if (schedule && gap >= (maxed ? 5 : 3) && chapterDay(state) < 14 && !read(invId)
      && (id !== "samechan" || samechanDateReady() && state.pendingInvite?.event !== "date_samechan")) {
      out.push({
        id: invId, sender: id, type: "invitation", lover: true,
        ...schedule,
        accept_event: `date_${id}`,
        messages: [(L().inviteOpening || {})[id]?.[schedule.time_slot]
          || (schedule.time_slot === "noon" ? "今日はお休み。午後に会えたらうれしいな。" : "今日は仕事を終えてから、少し会える？"),
          ...((maxed && (L().inviteLinesMax || {})[id]) || (L().inviteLines || {})[id] || []).slice()],
        decline_response: { text: (L().declineLines || {})[id] || "また今度ね" },
      });
      continue;
    }
    // 朝のひとこと（2日おき・キャラごとに位相をずらす）
    const pool = (L().morning || {})[id];
    const msgId = `_lover_morning_${id}${chapterKey}_d${state.day}`;
    if (pool?.length && (state.day + (phase[id] || 0)) % 2 === 0 && !read(msgId)) {
      out.push(chat(id, msgId, pool[Math.floor((state.day + (phase[id] || 0)) / 2) % pool.length]));
    }
  }
  return out;
}

// ---------------------------------------------------------------- 修羅場（第1章）

/** 大会当日、恋人が2人以上いたら会場のロビーで鉢合わせる（1回だけ） */
export async function maybeShuraba() {
  const lv = (state.lovers || []).filter((id) => ["tsumugi", "minto", "rin"].includes(id)).sort();
  if (lv.length < 2 || state.flags._shuraba_ch1) return false;
  state.flags._shuraba_ch1 = true;
  const key = lv.length >= 3 ? "all" : lv.join("_");
  await play(`remake_shuraba_${key}`);
  state.guilt = (state.guilt || 0) + 1;
  save();
  return true;
}
