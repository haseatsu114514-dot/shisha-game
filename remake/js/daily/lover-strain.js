// すれ違い（恋人の裏の数値）の差し込み口と再生（台帳 STR）。決まり（溜まり方・予兆の段・別れ話の条件・友達へ戻す処理）は
// core/lover-strain.js、別れ話の台本は data/dialogue/lover_strain.json（使う時に読む）、予兆のLIMEは remake/data/lover.json の strain。
// 差し込み口:
//   strainMorning()      … 朝（calendar.js の morning）。一日ぶん進めて、予兆のLIMEと、はじめの独り言を出す
//   maybeStrainTalk(beat) … 一日の終わり（calendar.js の endDay。告白と同じ位置）。溜まりきった恋人が帰り道で待っている
//   maybeStrainReunion(beat) … 同じく一日の終わり（別れ話が無かった夜）。友達に戻った相手に、こちらからやり直しを申し込む
//   strainAfterVisit(spot) … その人の店へ顔を出した後（calendar.js の performSpotAction）
// 別れ話は必ず読む場面なので、行動・体力・お金・能力の報酬は無い。数値は画面にも台詞にも出さない。
import { state, save } from "../core/state.js";
import { DB, callName } from "../core/data.js";
import { toast } from "../core/ui.js";
import { play, isPlaying } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { relationshipElapsedDay } from "../core/chapter-clock.js";
import { deliverLimeMessage } from "./phone.js";
import { rejoinLover } from "./romance.js";
import { petitPlace } from "./petit-shuraba.js";
import { tickStrain, syncStrain, strainTalkPick, settleStrainTalk, strainVisit, strainSignMessage,
  strainTalkScenes, joinStrainScenes, STRAIN_SCENES, STRAIN_OUTCOME_FLAGS,
  strainReunionPick, deferStrainReunion, settleStrainReunion, STRAIN_REUNION_FLAG } from "../core/lover-strain.js";

const FILE = "lover_strain";
const STREET_NIGHT = "res://assets/backgrounds/bg_street_night.png";
// はじめの呼び方（別れ話の台本の地の文・台詞と同じ）。ほかの相手は、私的な場面の呼び名（みんとは「栞さん」）
const CALL = Object.freeze({ tsumugi: "つむぎちゃん", rio: "凛想さん", hiyori: "ひよりさん" });
const name = (id) => CALL[id] || callName(id, state, { context: "private" });

// はじめの独り言（朝に一度だけ）。LIMEを開かない人にも、何がまずいのかが分かるように理由ごとに言う
const MONOLOGUE = {
  1: {
    unread: (n) => `（……${n}のLIME、まだ開いていない）`,
    decline: (n) => `（……${n}の誘いを、続けて断っている）`,
    suspect: (n) => `（……最近、${n}とちゃんと話せていない）`,
  },
  2: {
    unread: (n) => `（……${n}のLIMEを、ずっと放ってある。まずい）`,
    decline: (n) => `（……${n}を、ずっと待たせている。まずい）`,
    suspect: (n) => `（……${n}の目が、前より鋭い気がする）`,
  },
};

let loading = null;
async function loadScenes() {
  if (STRAIN_SCENES.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues(FILE, STRAIN_SCENES).then(scenes => { Object.assign(DB.dialogues, scenes); })
    .finally(() => { loading = null; });
  await loading;
}

/** 朝に一度だけ進め、今朝の予兆を出す。戻り値: 届けたLIMEの件数（朝の通知に足す） */
export function strainMorning() {
  if (!state) return 0;
  const today = relationshipElapsedDay(state);
  const events = tickStrain(state, today);
  let delivered = 0;
  for (const event of events) {
    // 未読が残っている相手からは重ねて届かない（phone.js の morningMessages と同じ決まり）。その朝は独り言だけ
    if ((state.inbox || []).some(item => !item.read && item.msg?.sender === event.id)) continue;
    const message = strainSignMessage(DB.lover, event.id, event.stage, today);
    if (!message || state.inbox.some(item => item.id === message.id)) continue;
    deliverLimeMessage(message);
    delivered++;
  }
  const top = [...events].sort((a, b) => b.stage - a.stage)[0];
  if (top) toast(MONOLOGUE[top.stage][top.cause](name(top.id)), { ms: 4600 });
  return delivered;
}

/**
 * 一日の終わりに呼ぶ。溜まりきった恋人がいれば、帰り道で別れ話になる（一晩に一人・STRAIN_TALK_GAP 日おき）。
 * @param beat 場面のつなぎの一行を出す関数（calendar.js の beat）
 * @param opts.busyNight 今夜はもう人と会った・休んでいる・大会の前夜（別れ話を重ねず、次の夜へ回す）
 * @returns 別れ話を読み終えたか
 */
export async function maybeStrainTalk(beat, { busyNight = false } = {}) {
  if (!state || state.phase !== "daily" || state.slot < 2 || busyNight || isPlaying()) return false;
  syncStrain(state); // 今日のデート・返事を先に数える（会った日の夜に切り出されない）
  const pick = strainTalkPick(state);
  if (!pick) return false;
  const owner = state;
  try { await loadScenes(); } catch { return false; } // 読めなければ今夜は見送り、数値はそのまま
  if (state !== owner) return false;
  const dialogue = joinStrainScenes(DB.dialogues, strainTalkScenes(pick));
  if (!dialogue) return false;
  const flags = Object.values(STRAIN_OUTCOME_FLAGS);
  for (const flag of flags) delete state.flags[flag];
  await beat(`——帰り道、${name(pick.id)}が待っていた。`);
  if (state !== owner) return false;
  const result = await play(dialogue, { bg: STREET_NIGHT });
  if (state !== owner) return false;
  const outcome = state.flags[STRAIN_OUTCOME_FLAGS.end] ? "end" : state.flags[STRAIN_OUTCOME_FLAGS.excuse] ? "excuse"
    : state.flags[STRAIN_OUTCOME_FLAGS.keep] ? "keep" : null;
  for (const flag of flags) delete state.flags[flag];
  if (!result || result.cancelled || !outcome) return false; // 途中のLOAD・中断では何も決めない
  const who = name(pick.id);
  settleStrainTalk(state, pick.id, outcome);
  save();
  if (outcome === "end") toast(`${who}と、友達に戻った。`, { ms: 4600 });
  return true;
}

// やり直しを申し込むかどうか（告白の前の一拍 romance.js の gateScene と同じ形）。申し込むのは、はじめのほうから
const reunionGate = (id) => ({
  dialogue_id: `remake_strain_reunion_gate_${id}`,
  metadata: { private_scene: true },
  lines: [
    { speaker: "", text: `（……${name(id)}と友達に戻ってから、ずいぶん経った）` },
    { speaker: "", text: "（それでも、まだ、あの夜のことを考えてしまう）" },
    { type: "choice", id: "strain_reunion_gate", choices: [
      { text: "もう一度、気持ちを伝える", next: "go" },
      { text: "……今は、やめておく", next: "wait" },
    ] },
  ],
  branches: {
    go: [{ type: "set_flag", flag: STRAIN_REUNION_FLAG }],
    wait: [{ speaker: "", text: "（……同じことを繰り返さないと、言い切れるだろうか。もう少し、考えよう）" }],
  },
});

/**
 * 一日の終わりに呼ぶ（別れ話が無かった夜）。友達に戻った相手に、章をまたいだ後、こちらから一度だけやり直しを申し込める。
 * 見送れば数日後にもう一度考える。申し込めば、その人の場面を読んで恋人に戻る（絆の段・読んだ場面は前のまま）。
 * @returns 一拍か場面を読んだか
 */
export async function maybeStrainReunion(beat, { busyNight = false } = {}) {
  if (!state || state.phase !== "daily" || state.slot < 2 || busyNight || isPlaying()) return false;
  const id = strainReunionPick(state);
  if (!id) return false;
  const owner = state;
  try { await loadScenes(); } catch { return false; }
  if (state !== owner) return false;
  const scene = DB.dialogues[`strain_reunion_${id}`];
  if (!scene?.lines?.length) return false;
  delete state.flags[STRAIN_REUNION_FLAG];
  await beat(`（……${name(id)}の顔が、ふと浮かんだ）`);
  if (state !== owner) return false;
  const gate = await play(reunionGate(id), { bg: STREET_NIGHT });
  if (state !== owner) return false;
  const go = !!state.flags[STRAIN_REUNION_FLAG];
  delete state.flags[STRAIN_REUNION_FLAG];
  if (!gate || gate.cancelled) return false;
  if (!go) { deferStrainReunion(state, id); save(); return true; }
  const result = await play({ ...scene, metadata: { ...(scene.metadata || {}), private_scene: true } }, { bg: STREET_NIGHT });
  if (state !== owner || !result || result.cancelled) return false; // 途中のLOAD・中断では何も決めない（次の夜にもう一度）
  const who = name(id);
  if (!settleStrainReunion(state, id)) return false;
  rejoinLover(id);
  save();
  toast(`${who}と、もう一度付き合うことになった。`, { ms: 4600 });
  return true;
}

/** その人の店へ顔を出した（行動を使った訪問の後）。恋人なら、少しだけ埋め合わせになる */
export function strainAfterVisit(spot) {
  const place = state && petitPlace(spot);
  if (place?.kind === "shop") strainVisit(state, place.who);
}
