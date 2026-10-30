import { storyThreadStatus } from "./story-contact.js";
import { spendableMoney } from "../core/travel-budget.js";
// LIME（スマホ）。朝に届くメッセージ・返信の選択肢・誘い。
// ルール: 同じ相手からは1日1話題まで（小分けの連投はOK）／連絡先を交換した相手だけ（master_spec #7/#26）
// 朝は通知だけ出して受信箱に積み、プレイヤーが好きなときにアプリを開いて読む（オーナー指定）。
// 物語の節目（大会の朝・優勝の夜）だけは openPhone で必ず読ませる。
// 見た目は旧版の LIME（ノッチ付きの端末・緑のヘッダー・白と黄緑の吹き出し・明るい返信欄）を踏襲する。
import { el, sleep, fitOneLine, yen } from "../core/util.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { customLimeIconUrl } from "./lime-icons.js";
import { layers, toast } from "../core/ui.js";
import { state } from "../core/state.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { chapterDay } from "../core/chapter-clock.js";
import { gainAffinity, affinityLevel, applyStats, bond } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { hooks } from "../vn/engine.js";
import { formatHtml } from "../vn/text.js";
import { hasContact, spotById, isClosed } from "./spots.js";
import { loverMessages, isLover, dateSchedule } from "./romance.js";
import { bondInvites, friendMessages } from "./bonds.js";
import { syncMintoKnowledge } from "../core/story-knowledge.js";
import { hiyoriEventStatus } from "../core/hiyori-route.js";
import { tsumugiMessages } from "./tsumugi-schedule.js";

import { invitationCost, storeInvitationSpot, visitReminderSpot, missedInvitationNote } from "./invitations.js";

// C03: 初回受信から返信を待つ目安。再案内の日付では数え直さない。
const LIME_REPLY_NUDGE_DAYS = 3;

// 目上の相手への返信は敬語（旧版 F6）。友達口調は同世代の相手だけ
const POLITE = new Set(["sumi", "nagumo", "maezono"]);
const originId = (item) => item.originId || item.msg?.origin_id || item.id;
const importantInvite = (m) => m.type === "invitation" && !!m.important;
const needsResend = (id) => (state.inbox || []).some((item) => originId(item) === id && item.needsResend);
const canRetry = (item) => item.result === "expired"
  || ["conflict_declined", "declined"].includes(item.result) && item.needsResend && item.day < state.day;

/** 営業中の私的な約束や、固定イベントとの重複を避ける。時刻を持たない誘いは従来どおり */
function invitationAvailable(m, { fixedNight = () => false } = {}) {
  const store = storeInvitationSpot(m);
  if (m.accept_event === "__hiyori_shop__" && (!spotById(m.visit_spot) || isClosed(spotById(m.visit_spot))
    || state.flags._hiyori_encounter_day === `${state.chapter}:${state.day}`)) return false;
  if (store && isClosed(spotById(store))) return false;
  if (m.closed_on != null && state.day % 7 !== m.closed_on) return false;
  if (m.exclude_closed_on != null && state.day % 7 === m.exclude_closed_on) return false;
  if (m.time_slot === "night" && fixedNight(state.day)) return false;
  return true;
}

/** 私的な待ち合わせを配信時に確定。定休日を待つ物語は臨時休暇、仕事後が重なる大事な物語も臨時休暇にする。 */
function scheduledInvitation(m, opts = {}) {
  const holidayOnly = m.private_schedule === "holiday_or_temporary";
  if (!holidayOnly && m.private_schedule !== "holiday_or_after_close") return m;
  const day = opts.day ?? state.day;
  const schedule = holidayOnly
    ? { time_slot: "noon", ...(day % 7 === m.closed_on ? { closed_on: m.closed_on } : { temporary_closed: true }) }
    : dateSchedule(m.sender, { ...opts, allowTemporaryClosure: importantInvite(m) });
  if (!schedule) return null;
  const daytime = schedule.time_slot === "noon";
  const context = schedule.temporary_closed ? "今日は臨時のお休みだから、午後"
    : daytime ? "今日はお店がお休みだから、午後" : "今日、仕事を終えたあと";
  const when = daytime ? "午後" : "仕事のあと"; // 返事のボタン「{privateWhen}、会おう（行動を1回使う）」が1行に収まる長さ
  const render = (value) => String(value).replaceAll("{privateContext}", context).replaceAll("{privateWhen}", when);
  // DBの雛形を変更せず、その日の受信トークへ解決済みの時刻を保存する。
  const resolved = { ...m, ...schedule, after_close: !!schedule.after_close };
  if (schedule.closed_on == null) delete resolved.closed_on;
  resolved.messages = (m.messages || []).map((line) => typeof line === "string" ? render(line) : typeof line?.text === "string" ? { ...line, text: render(line.text) } : { ...line });
  if (schedule.temporary_closed && !JSON.stringify(m.messages).includes("{privateContext}")) {
    const text = { naru: "今日は店を臨時で閉めたから、午後ちょっと付き合えよ",
      adam: "今日は店を臨時で休む。午後、共に出かけよう",
      minto: "今日は臨時でお店を休みにしたの。午後、会えたら嬉しいな" }[m.sender]
      || "今日は臨時のお休み。午後、会えたらうれしいな";
    resolved.messages.unshift({ sender: m.sender, text });
  }
  if (m.reminder_text) resolved.reminder_text = render(m.reminder_text);
  if (m.accept_text) resolved.accept_text = render(m.accept_text);
  return resolved;
}

/** 期限切れは既読とは別。未読のままでも、重要な誘いの再案内を止めない */
const replySlot = (m) => m.time_slot === "night" ? 1 : storeInvitationSpot(m) ? Math.min(1, state.slot) : 0;

const bookedInvitation = (invite) => [...(state.inbox || [])].reverse().find((item) => item.result === "accepted"
  && (invite.originId ? originId(item) === invite.originId : item.msg?.accept_event === invite.event && item.msg?.sender === invite.sender));
const invitationSource = (invite, item) => DB.lime.find((m) => m.id === (invite.originId || (item && originId(item))))
  || item?.msg || DB.lime.find((m) => m.accept_event === invite.event && m.sender === invite.sender);

/** 会えなかった予約は、既読や返信報酬を戻さず、次の誘いを受け取れる履歴へ変える。 */
export function rescheduleInvitation(invite, note) {
  let item = bookedInvitation(invite);
  const source = invitationSource(invite, item);
  if (!item) {
    const id = invite.originId || source?.id || `_rescheduled_${invite.event}_d${invite.day ?? state.day}`;
    item = { id, originId: id, day: invite.day ?? state.day,
      msg: source || { id, sender: invite.sender, type: "invitation", accept_event: invite.event,
        time_slot: invite.slot ? "night" : "noon", messages: ["会う約束をしていた"] },
      read: true, done: true, log: [] };
    (state.inbox ||= []).push(stampAccount(item));
  }
  item.done = true;
  item.result = "expired";
  item.replyState = "expired";
  item.needsResend = true;
  (item.log ||= []).push({ note });
  delete state.flags[`_invited_${originId(item)}`];
  if (state.pendingInvite === invite) state.pendingInvite = null;
  return item;
}

/** 承諾と面会の完了は別に記録する。旧来の accepted 履歴もそのまま残す。 */
export function completeInvitation(invite) {
  const item = bookedInvitation(invite);
  if (item) { item.completed = true; delete item.needsResend; }
}

function completedStoryInvitation(item, source) {
  if (item.completed || source.exclude_flag && state.flags[source.exclude_flag]) return true;
  const event = source.accept_event;
  if (event === `outing_${source.sender}_1`) return !!state.flags[`_outing_done_${source.sender}`];
  if (event === "ch1_minto_fifth") return !!state.flags._minto_fifth_done;
  if (event === "ch1_minto_private_1") return !!state.flags._minto_private_done;
  if (event === "ch1_adam_outing_dagurikura") return !!state.flags._adam_arcade_done;
  if (event === "ch1_minto_bond_finale") return !!state.finales?.minto;
  return false;
}

// 所持金不足で予約だけ消えた旧セーブを救済する。完了済みの物語は再案内しない。
function repairLostStoryInvitations() {
  const checked = new Set();
  for (const item of [...(state.inbox || [])].reverse()) {
    const id = originId(item);
    if (checked.has(id)) continue;
    checked.add(id);
    const source = DB.lime.find((m) => m.id === id);
    if (item.result !== "accepted" || !source || !importantInvite(source) || completedStoryInvitation(item, source)) continue;
    const invite = { originId: id, event: source.accept_event, sender: source.sender, day: item.day };
    const pending = state.pendingInvite;
    if (pending && (pending.originId ? pending.originId === id
      : pending.event === invite.event && pending.sender === invite.sender)) continue;
    rescheduleInvitation(invite, "約束を果たせなかったため、また都合の合う日に会うことにした");
  }
}

export function expireInvitations(opts = {}) {
  const pending = state.pendingInvite;
  if (pending) {
    const booked = bookedInvitation(pending);
    const source = invitationSource(pending, booked);
    const dueDay = pending.day ?? booked?.day ?? state.day;
    const schedule = pending.temporaryClosed ? { time_slot: "noon", temporary_closed: true }
      : /^date_/.test(pending.event) ? dateSchedule(pending.sender, { ...opts, day: dueDay })
      : source ? scheduledInvitation(source, { ...opts, day: dueDay }) : source;
    // 夜の行動枠で受け付けた仕事後の約束は、閉店イベントが済むまでslot2で待つ。
    const waitingForClose = pending.afterClose && pending.queuedAfterClose && dueDay === state.day && state.slot >= 2;
    const storeVisit = storeInvitationSpot(schedule);
    if (storeVisit && dueDay === state.day && state.slot === 1 && pending.slot === 0) pending.slot = 1;
    const past = dueDay < state.day || dueDay === state.day && pending.slot < state.slot && !waitingForClose;
    const conflict = dueDay === state.day && !waitingForClose && (pending.slot === 1 && !storeVisit && opts.fixedNight?.(dueDay) || schedule === null
      || schedule && (!invitationAvailable(schedule, opts) || pending.slot !== replySlot(schedule)));
    if (past || conflict) {
      rescheduleInvitation(pending, conflict
        ? "仕事や別の予定と重なったため、約束を別の日に改めることにした"
        : "約束の時間を過ぎてしまった。また都合の合う日に会うことにした");
    } else if (schedule?.after_close) pending.afterClose = true;
  }
  repairLostStoryInvitations();
  for (const item of state.inbox || []) {
    // 旧版が昼の終了時に失効させた未返信の店LIMEも、当日・営業時間内だけ救済する。
    if (item.result === "expired" && !item.needsResend && item.day === state.day
      && storeInvitationSpot(item.msg) && state.slot < 2 && invitationAvailable(item.msg, opts)
      && !state.flags[`_invited_${originId(item)}`]) {
      item.done = false;
      delete item.result;
      item.replyState = "waiting";
    }
    if (item.done || item.msg?.type !== "invitation" || inviteState(item, opts) !== "expired") continue;
    item.done = true;
    item.result = "expired";
    item.replyState = "expired";
    const source = DB.lime.find((m) => m.id === originId(item)) || item.msg;
    (item.log ||= []).push({ note: importantInvite(source)
      ? "返事をしそびれた……。また都合の合う日に誘ってくれるそうだ"
      : "返事をしそびれた……" });
  }
}

function eligible(m, { tournamentDay = false } = {}) {
  if (state.limeRead.includes(m.id) && !importantInvite(m) && !needsResend(m.id)) return false;
  if (m.chapter && m.chapter !== state.chapter) return false;
  if (m.sender === "ageha" && state.chapter === 1) return false; // 第1章では連絡先を知らない
  const cond = m.trigger_condition;
  // 大会当日の応援は、本文がある相手のうち連絡先を交換した人から。trigger_flag は応援を言える関係になった印（ひより等）
  if (cond === "tournament_day") return tournamentDay && hasContact(m.sender) && (!m.trigger_flag || !!state.flags[m.trigger_flag]);
  if (tournamentDay) return false;
  if (!hasContact(m.sender)) return false;
  if (m.type === "invitation" && state.flags[`_invited_${m.id}`]) return false;
  if (m.exclude_flag && state.flags[m.exclude_flag]) return false;
  // みんとの最初の私的な買い出しは、♥3到達だけで正体判明より先行させない。
  if (m.id === "lime_outing_minto_1" && !state.flags._minto_identity_revealed) return false;
  if (cond === "hiyori_tonari") return hiyoriEventStatus("tonari_return") === "ready";
  if (cond === "story_count") return (state.story[m.sender] || 0) >= (m.trigger_value || 1);
  if (cond === "lime_exchanged") {
    const day = m.chapter ? chapterDay(state) : state.day;
    return needsResend(m.id) || m.trigger_day <= day && day - m.trigger_day <= 1;
  }
  if (cond === "affinity_level") return affinityLevel(m.sender) >= (m.trigger_value || 3) && !state.flags[`_invited_${m.id}`];
  if (cond === "flag") return !!state.flags[m.trigger_flag];
  return false;
}

/**
 * 今朝届くメッセージ（1人1話題・最大3通）。恋人からの LIME（記念日・デートの誘い・朝のひとこと）を優先する
 * @param opts.tournamentDay 大会当日の朝か / opts.fixedNight (day) => 夜の固定イベントがあるか
 */
export function morningMessages(opts = {}) {
  syncMintoKnowledge();
  expireInvitations(opts);
  const out = [];
  const inbox = state.inbox || [];
  const delivered = new Set(inbox.map((i) => i.id));
  // 未読が残っている相手からは重ねて届かない（読むまで溜まっていく一方にしない）
  const senders = new Set(opts.tournamentDay ? [] : inbox.filter((i) => !i.read && !canRetry(i)).map((i) => i.msg.sender));
  for (const m of loverMessages(opts)) {
    // 初めての私服の約束など、まだ見ていない大事な話題を同じ相手の定期LIMEで押し流さない。
    const storyInvite = DB.lime.some((candidate) => candidate.sender === m.sender && candidate.priority > 0
      && eligible(candidate, opts) && scheduledInvitation(candidate, opts) && invitationAvailable(scheduledInvitation(candidate, opts), opts)
      && !inbox.some((i) => originId(i) === candidate.id && !canRetry(i)));
    if (storyInvite) continue;
    if (out.length >= 3 || senders.has(m.sender) || delivered.has(m.id) || !invitationAvailable(m, opts)) continue;
    out.push(m);
    senders.add(m.sender);
  }
  // 交友の締めくくりを私的な約束で受け取る誘い（みんと）。休日の午後か仕事後に決め、断っても日を改めて届く
  for (const template of bondInvites(opts)) {
    if (out.length >= 3 || senders.has(template.sender) || delivered.has(template.id)) continue;
    const m = scheduledInvitation(template, opts);
    if (!m || !invitationAvailable(m, opts)) continue;
    out.push(m);
    senders.add(m.sender);
  }
  // スミさんのバイト誘い（旧版 N13）。他の相手の誘いと並べ、返事で予定を選べる
  const sumiStory = DB.lime.some((m) => m.sender === "sumi" && m.priority > 0 && eligible(m, opts)
    && invitationAvailable(m, opts));
  const sumi = sumiStory ? null : sumiBaitoInvite(opts);
  if (sumi && out.length < 3 && !senders.has("sumi") && !delivered.has(sumi.id)) {
    out.push(sumi);
    senders.add("sumi");
  }
  // 大事な外出の誘いは、通常の雑談より先に届ける。同じ相手からは1朝1話題。
  const messages = [...DB.lime, ...tsumugiMessages(state, DB.friends)].sort((a, b) => (Number(importantInvite(b)) + (b.priority || 0)) - (Number(importantInvite(a)) + (a.priority || 0)));
  // 大会の朝は3通までなので、応援は仲の深い相手から届く（同じ深さなら台本順）。
  if (opts.tournamentDay) messages.sort((a, b) => affinityLevel(b.sender) - affinityLevel(a.sender));
  for (const template of messages) {
    if (out.length >= 3) break;
    if (senders.has(template.sender) || !eligible(template, opts)) continue;
    const m = scheduledInvitation(template, opts);
    if (!m || !invitationAvailable(m, opts)) continue;
    const previous = inbox.filter((i) => originId(i) === m.id);
    if (previous.length && ((!importantInvite(m) && !needsResend(m.id)) || previous.some((i) => !canRetry(i)))) continue;
    const again = previous.length > 0;
    const id = again ? `${m.id}_retry_c${state.chapter}_d${state.day}` : m.id;
    if (delivered.has(id)) continue;
    out.push(again ? { ...m, id, origin_id: m.id, important: importantInvite(m) || needsResend(m.id),
      messages: [m.reminder_text || "この前のお誘い、また都合が合えば。", ...(m.messages || [])] } : m);
    senders.add(m.sender);
  }
  // 友人になった相手から、たまのLIME（雑談かシーシャのお誘い）。物語のLIMEの後に、朝1通まで（HF09）。
  // お誘いは、人と会うほかの誘い（物語・恋人）が今朝届く日・返事待ちの日には重ねず、同じ相手の雑談にする。
  // スミさんの急なバイトの誘いは仕事の連絡なので、重なってもよい（オーナー指定。どちらを受けるかはプレイヤーが選ぶ）
  const meetInvite = (m) => m?.type === "invitation" && m.accept_event !== "__sumi_baito__";
  const otherInvite = out.some(meetInvite) || inbox.some((i) => !i.done && meetInvite(i.msg));
  const hiyori = hiyoriInvite(opts);
  if (hiyori && out.length < 3 && !otherInvite && !state.pendingInvite && !senders.has("hiyori")
    && !delivered.has(hiyori.id) && invitationAvailable(hiyori, opts)) {
    out.push(hiyori);
    senders.add("hiyori");
  }
  for (const template of friendMessages(opts)) {
    if (out.length >= 3) break;
    if (senders.has(template.sender) || delivered.has(template.id)) continue;
    if (template.type === "invitation" && (otherInvite || out.some(meetInvite))) continue;
    const m = scheduledInvitation(template, opts); // お誘いは休日の午後か仕事後。合わない日は同じ相手の雑談へ
    if (!m || !invitationAvailable(m, opts)) continue;
    out.push(m);
    senders.add(m.sender);
    break;
  }
  return out;
}

// 再会後のたまの誘い。受信した日を保存するため、読了・辞退・ロードで連投しない。
function hiyoriInvite({ tournamentDay = false, fixedNight = () => false } = {}) {
  if (tournamentDay || fixedNight(state.day) || ![1, 2].includes(state.chapter) || !hasContact("hiyori")
    || !state.flags._hiyori_tonari_return_done || (state.lovers || []).includes("hiyori")) return null;
  const recent = (state.inbox || []).filter(i => i.msg?.accept_event === "__hiyori_shop__" && i.chapter === state.chapter);
  if (recent.some(i => state.day - i.day < 3) || (state.seed + state.day) % 4 !== 0) return null;
  const open = ["naru", "adam", "minto"].map(spotById).filter(s => s && state.met[s.charId] && !isClosed(s));
  if (!open.length) return null;
  const spot = open[Math.floor(state.day / 4) % open.length];
  return { id: `_hiyori_shop_c${state.chapter}_d${state.day}`, sender: "hiyori", type: "invitation",
    time_slot: "night", accept_event: "__hiyori_shop__", visit_spot: spot.id,
    messages: [`……今夜、${spot.label}で一緒に一服しない？ 私が煙になっちゃう前に`], accept_text: "今夜、行きます",
    decline_response: { text: "……うん。また都合のいい日に" } };
}

/**
 * スミさんからの「急で悪い、昼のシフト入れるか？」。序盤の固定2回（DAY3/8）＋4日以上バイトに出ていない朝。
 * 乗るとそのまま昼のシフトへ（行動1回・給料に上乗せ）。各章の大会当日は来ない
 */
function sumiBaitoInvite({ tournamentDay = false } = {}) {
  if (tournamentDay || ![1, 2].includes(state.chapter) || (state.chapter === 1 && state.day >= TOURNAMENT_DAY)) return null;
  const id = `_sumi_baito_inv_d${state.day}`;
  if (state.limeRead.includes(id)) return null;
  const fixed = state.chapter === 1 && (state.day === 3 || state.day === 8);
  const slacking = state.day >= 5 && state.day - (state.lastBaitoDay || 0) >= 4;
  if (!fixed && !slacking) return null;
  // 毎回同じ理由にならないよう日付で選ぶ（固定のDAY3とDAY8は別の理由になる）
  const reasons = [
    "常連の団体が入ってな。人手が足りん",
    "仕入れの業者と昼が重なってな。手が回らん",
    "昼に貸切の予約が入った。炭番が一人足りん",
  ];
  return {
    id,
    sender: "sumi",
    type: "invitation",
    time_slot: "noon",
    accept_event: "__sumi_baito__",
    accept_text: "入ります！",
    accept_reply: { sender: "sumi", stamp: "st_sumi_ack" },
    hint: "乗るとそのまま昼のシフトへ（行動を1回使う）。いつもの給料に上乗せがつく",
    messages: [
      "急で悪い。今日、昼のシフト入れるか？",
      reasons[state.day % reasons.length],
      "……代わりと言っちゃなんだが、給料は弾むぞ",
    ],
    decline_response: { text: "……そうか。なら、こっちで回す" },
  };
}

// ---------------------------------------------------------------- アカウント（トークの単位）
// みんとと初来店で交換するのは店の『お仕事用』のLIME（表示名は characters.json の lime_name・営業姿の顔）。
// 恋人になった夜に私用のLIMEを渡され、以後は本名の「栞」・私服の顔のアカウントから届く。どちらから届いたかは
// 受信した時点で決め（item.account）、それまでのトークはお仕事用に残す（HF10・HF11）。ほかの相手はアカウント＝ID
const PRIVATE_ACCOUNTS = { minto: { account: "minto_private", face: "oneesan" } };
const accountOwner = (account) => Object.keys(PRIVATE_ACCOUNTS).find((id) => PRIVATE_ACCOUNTS[id].account === account) || account;
/** 相手が今送ってくるアカウント */
const accountFor = (sender) => (PRIVATE_ACCOUNTS[sender] && isLover(sender) ? PRIVATE_ACCOUNTS[sender].account : sender);
/** 受信箱の1件が属するトーク（記録の無い旧セーブの項目は送り主のまま） */
const accountOf = (item) => item.account || item.msg.sender;
/** 受信箱に積む前に、送ってきたアカウントを記録する */
function stampAccount(item) {
  const account = accountFor(item.msg?.sender);
  if (account !== item.msg?.sender) item.account = account;
  return item;
}

/** 本文・履歴・一覧で同じ種別と台帳を使う。壊れた素材参照も代替表示で読める。 */
function messageContent(line) {
  if (typeof line === "string") return { kind: "text", text: line };
  if (!line || typeof line !== "object") return null;
  const kind = ["stamp", "image"].find((key) => key in line);
  if (kind) {
    const asset = DB.manifest?.limeMedia?.[line[kind]];
    return { kind, asset: asset?.kind === kind ? asset : null,
      fallback: kind === "stamp" ? "［スタンプを表示できません］" : "［画像を表示できません］" };
  }
  return typeof line.text === "string" ? { kind: "text", text: line.text } : null;
}
async function drawMessage(ui, line, mine = false, sender = null, animate = true) {
  const content = messageContent(line);
  if (!content) return;
  if (content.kind === "text") return ui.bubble(content.text, mine, sender, animate);
  return ui.media(mine ? { ...content, asset: null } : content, sender, animate);
}
const mediaLines = (item) => [...(item.msg?.messages || []), ...(item.log || [])]
  .filter((line) => ["stamp", "image"].includes(messageContent(line)?.kind));

/** 返事を確定する時点で、受信後に増えた履歴も含めて素材の間隔を判定する。 */
function replyMedia(item, line) {
  if (!line || !Object.hasOwn(line, "stamp") || Object.hasOwn(line, "image") || Object.hasOwn(line, "text")) return null;
  const asset = messageContent(line)?.asset;
  const sender = item.msg?.sender;
  if (!asset || asset.owner !== sender || line.sender && line.sender !== sender
    || ![1, 2, 3].includes(state.chapter)
    || line.media_chapters && !line.media_chapters.includes(state.chapter)
    || asset.allowed_accounts && !asset.allowed_accounts.includes(accountOf(item))
    || mediaLines(item).length) return null;
  const history = (state.inbox || []).filter((old) => old !== item && accountOwner(accountOf(old)) === sender);
  if (history.some((old) => originId(old) === originId(item) && mediaLines(old).length)
    || history.some((old) => mediaLines(old).length && (!Number.isFinite(old.day)
      || !Number.isFinite(item.day) || Math.abs(item.day - old.day) < 3))) return null;
  // 同じ相手の隣の話題に素材がある場合は、日数にかかわらず連投を避ける。
  const siblings = (state.inbox || []).filter((old) => accountOwner(accountOf(old)) === sender);
  const position = siblings.indexOf(item);
  if (position >= 0 && [siblings[position - 1], siblings[position + 1]].some((old) => old && mediaLines(old).length)) return null;
  return { sender, stamp: line.stamp, ...(line.media_chapters ? { media_chapters: [...line.media_chapters] } : {}) };
}

/** 受信時だけ素材を選別し、DBや過去の受信箱を変更しない。dayは章をまたぐ通算日。 */
function receiveItem(m) {
  const item = stampAccount({ id: m.id, originId: m.origin_id || m.id, day: state.day, chapter: state.chapter,
    msg: { ...m }, read: false, done: false,
    replyState: m.type === "invitation" || m.replies?.length ? "waiting" : "none", log: [] });
  const history = (state.inbox || []).filter((old) => accountOwner(accountOf(old)) === m.sender);
  const previousMedia = history.filter((old) => mediaLines(old).length);
  const repeated = (state.inbox || []).some((old) => originId(old) === originId(item));
  const blocked = repeated || !!mediaLines(history.at(-1) || {}).length
    || previousMedia.some((old) => !Number.isFinite(old.day) || state.day - old.day < 3);
  let count = 0;
  const freeze = (value) => hooks.interpolate ? hooks.interpolate(value) : value;
  item.msg.messages = (m.messages || []).flatMap((line) => {
    const content = messageContent(line);
    if (content && content.kind !== "text") {
      const asset = content.asset;
      if (blocked || count >= 1 || !asset || asset.owner !== m.sender || line.sender && line.sender !== m.sender
        || ![1, 2, 3].includes(state.chapter)
        || line.media_chapters && !line.media_chapters.includes(state.chapter)
        || asset.allowed_accounts && !asset.allowed_accounts.includes(accountOf(item))) return [];
      count++;
      return [{ ...line, ...(line.media_chapters ? { media_chapters: [...line.media_chapters] } : {}) }];
    }
    return [typeof line === "string" ? freeze(line)
      : typeof line?.text === "string" ? { ...line, text: freeze(line.text) } : { ...line }];
  });
  return item;
}

/** LIME の表示名。アカウント名の決まっている相手（みんと）はそれ、私用は本名。ほかは私的な場面の呼び名 */
const limeName = (account) => {
  if (account === "???") return "？？？";
  const id = accountOwner(account);
  const c = DB.characters?.[id];
  if (account !== id) return c?.private_name || displayName(id, state);
  return c?.lime_name || displayName(id, state, { context: "private" });
};

/** 顔ドット絵のアイコン。名乗る前の相手・絵の無い相手は頭文字の丸にする（正体を明かさない） */
function avatar(account, small = false) {
  const cls = `lime-face${small ? ".sm" : ""}`;
  const id = account && accountOwner(account);
  const known = id && id !== "???" && (state.met[id] || id === "sumi");
  // お仕事用は営業姿、私用は私服の顔（名前 limeName と揃える）
  const url = known ? faceIconUrl(account !== id ? PRIVATE_ACCOUNTS[id].face : id) : null;
  // 採用済みカスタムアイコンはお仕事用アカウントだけに使う（私用は正体保護のため従来どおり）
  const custom = known && account === id ? customLimeIconUrl(id) : null;
  if (custom) {
    return el(`img.${cls}.custom`, { src: custom, alt: "", onerror: (e) => {
      const node = e.currentTarget;
      node.onerror = null;
      if (url) { node.classList.remove("custom"); node.src = url; }
      else node.replaceWith(el(`span.${cls}.blank`, { text: [...limeName(account)][0] || "？" }));
    } });
  }
  if (url) return el(`img.${cls}`, { src: url, alt: "" });
  const name = known ? limeName(account) : "？";
  return el(`span.${cls}.blank`, { text: [...name][0] || "？" });
}

const text = (raw) => formatHtml(hooks.interpolate ? hooks.interpolate(String(raw)) : String(raw));

// ================================================================ 受信箱（オーナー指定: 朝は通知だけ・読みたい時に開く）
// 朝に届いたメッセージは state.inbox に積むだけ。HUD の LIME アイコンに未読件数を出し、
// プレイヤーが好きなときにアプリを開いて、トーク一覧から読みたい相手を選ぶ。
// 誘いは「当日・その時間帯のうち」なら返事ができる（昼の誘い＝昼の行動の前まで／夜の誘い＝夜の行動の前まで）。

/** 未読があるか（HUD の赤丸） */
export const unreadCount = () => (state.inbox || []).filter((i) => !i.read).length;
export const hasUnread = () => unreadCount() > 0;

/** 返事を溜めた重要連絡だけ、元の連絡ごとに一度促す。期限や既読は変更しない。 */
function nudgeWaitingContacts(opts) {
  if (state.phase !== "daily" || opts.tournamentDay) return;
  const histories = new Map();
  for (const item of state.inbox || []) {
    const id = originId(item);
    if (!histories.has(id)) histories.set(id, []);
    histories.get(id).push(item);
  }
  const due = [];
  for (const [id, history] of histories) {
    if (state.flags[`_lime_reply_nudged_${id}`]) continue;
    const latest = history.at(-1);
    const m = latest.msg;
    const source = DB.lime.find((candidate) => candidate.id === id) || m;
    if (!(m.important || source.important) || latest.done || latest.result
      || source.chapter && source.chapter !== state.chapter
      || history.some((item) => completedStoryInvitation(item, source))) continue;
    // 失効した履歴しかない時や、今日は返事できない誘いでは急かさない。
    if (m.type === "invitation" && inviteState(latest, opts) !== "open") continue;
    if (latest.read && !m.replies?.length && m.type !== "invitation") continue;
    let waitingSince = null;
    for (const item of history) {
      // 明示返信・自動辞退・予約後の失効は、返信を待った期間に含めない。
      if (item.replyState === "replied" || ["accepted", "declined", "conflict_declined"].includes(item.result)
        || item.log?.some((entry) => entry.me)) waitingSince = null;
      else if (waitingSince == null && Number.isFinite(item.day)) waitingSince = item.day;
    }
    if (waitingSince != null && state.day - waitingSince >= LIME_REPLY_NUDGE_DAYS) due.push(id);
  }
  if (!due.length) return;
  for (const id of due) state.flags[`_lime_reply_nudged_${id}`] = true;
  // 複数の誘いも一つの通知にまとめる。返信・承諾・移動はプレイヤーに任せる。
  toast("大事なLIMEが届いている。そろそろ確認して返事しよう。", { ms: 5000 });
}

/** 今朝のメッセージを受信箱に積む。戻り値=届いた件数 */
export function deliverMorning(opts = {}) {
  const msgs = morningMessages(opts);
  // {daysLeft} などは届いた日の値で固定する（数日後に読んでも「あと◯日」がずれない）
  for (const m of msgs) {
    if (m.temporary_closed) state.flags[`_temporary_closed_${m.sender}`] = `${state.chapter || 1}:${state.day}`;
    state.inbox.push(receiveItem(m));
  }
  nudgeWaitingContacts(opts);
  return msgs.length;
}

/** 朝の通知（スマホのプッシュ通知風）。件数と送り主の顔だけ見せ、中身は開くまで分からない */
export function pushNotice(count, { onOpen = null } = {}) {
  const senders = [...new Set(state.inbox.filter((i) => !i.read).map(accountOf))].slice(0, 4);
  const newest = [...state.inbox].reverse().find((i) => !i.read);
  let opened = false;
  const card = el(onOpen ? "button.lime-push" : "div.lime-push", onOpen ? {
    type: "button", dataset: { test: "lime-notice" },
    "aria-label": "新着メッセージのトークを開く",
    onclick: () => {
      if (opened) return;
      opened = true;
      card.remove();
      onOpen(newest ? accountOf(newest) : null);
    },
  } : {}, [
    el("div.lp-icon", [el("span", { text: "LIME" })]),
    el("div.lp-body", [
      el("div.lp-top", [el("b", { text: "LIME" }), el("small", { text: "いま" })]),
      el("div.lp-text", { text: `新着メッセージが${count}件あります` }),
    ]),
    el("div.lp-faces", senders.map((s) => avatar(s, true))),
  ]);
  layers.toasts.append(card);
  SE.phoneReceive();
  requestAnimationFrame(() => card.classList.add("show"));
  setTimeout(() => { card.classList.remove("show"); setTimeout(() => card.remove(), 500); }, 3200);
}

/**
 * 誘いに今から返事できるか。open=乗れる / expired=時間切れ / busy=別の約束がある
 * （店への誘いは当日の営業時間内なら夜も可。昼限定の外出は昼まで）
 */
function inviteState(item, opts = {}) {
  const m = item.msg;
  const slot = replySlot(m);
  if (!invitationAvailable(m, opts) || state.phase !== "daily" || item.day !== state.day || state.slot > slot) return "expired";
  if (state.pendingInvite) return "busy";
  return "open";
}

/** 通常の店訪問と場所が一致する、有効で返事待ちの誘いのみ対象。 */
export function venueInviteNeedingReply(spotId, opts = {}) {
  if (!spotId) return null;
  return (state.inbox || []).find((item) =>
    item?.msg?.type === "invitation" &&
    visitReminderSpot(item.msg) === spotId &&
    !item.done &&
    !item.result &&
    (!item.read || !item.replyState || item.replyState === "waiting") &&
    inviteState(item, opts) === "open"
  ) || null;
}

/**
 * マップで通常行動を確定する直前に知らせるべき招待。
 * 1. 今向かう場所と会場が一致する招待
 * 2. 別の行動を使うと当日の返信期限が切れる招待
 * 営業後の待ち合わせや外出は「普通に店へ行く」と同一視しない。
 */
export function actionInviteNeedingReply(spotId, opts = {}, ignoredIds = []) {
  const waiting = (state.inbox || []).filter((item) =>
    item?.msg?.type === "invitation" &&
    !item.done && !item.result &&
    (!item.read || !item.replyState || item.replyState === "waiting") &&
    !ignoredIds.includes(item.id) &&
    inviteState(item, opts) === "open"
  );
  const matching = waiting.find((item) => visitReminderSpot(item.msg) === spotId);
  if (matching) return { item: matching, kind: "venue" };
  // 買い物や占いへの入場は時間を使わない。凛との会話や終日休養は確定時に判定する。
  if (opts.spendsAction === false) return null;
  // みんとの店頭試飲のような「昼・夜どちらでも返信可」は夜が最後の機会。
  const expiring = waiting.find((item) =>
    state.slot + (opts.slotsUsed ?? 1) > (storeInvitationSpot(item.msg) ? 1 : replySlot(item.msg))
  );
  return expiring ? { item: expiring, kind: "deadline" } : null;
}

/**
 * C04: 約束の場面（強制イベント）を始める前に、まだ読んでいない誘いのトークがあれば、その相手を返す。
 * プレイヤーが本文を読まないまま面会の台本が始まる流れを防ぐための導線用。
 * 返事・承諾は変えず（自動で承諾・返信したことにしない）、ロード時の予約復元・旧セーブにも効く。
 * @returns {string|null} 先に開かせるトークのアカウント（送り主）。読む必要がなければ null。
 */
export function invitationReadBeforeMeeting(invite) {
  if (!invite) return null;
  const item = (state.inbox || []).find((i) => i.id === invite.originId || originId(i) === invite.originId);
  if (!item || item.read) return null;
  return accountOf(item) || invite.sender || null;
}

const thread = (account) => state.inbox.filter((i) => accountOf(i) === account);
const plain = (raw) => String(hooks.interpolate ? hooks.interpolate(String(raw)) : raw).replace(/\[\/?[a-z]+[^\]]*\]/gi, "").replace(/<[^>]+>/g, "");
const dayLabel = (item) => (item.chapter != null && item.chapter !== state.chapter
  ? `第${item.chapter}章 DAY ${item.day}`
  : item.day === state.day ? "今日" : item.day === state.day - 1 ? "昨日" : `DAY ${item.day}`);
const clockNow = () => (state.phase === "tournament" ? "大会の朝" : state.slot >= 1 ? "夜" : "昼");

/** 端末の枠（ノッチ・ステータスバー・ヘッダー・本文・返信欄）。openLime と openPhone で共用 */
function phoneShell({ time, title }) {
  const owner = state;
  const header = el("div.lime-header");
  const chat = el("div.lime-chat");
  const actions = el("div.lime-actions");
  const phone = el("div.phone", [
    el("div.phone-notch"),
    el("div.phone-status", [el("span", { text: time }), el("span", { text: title }), el("span.phone-batt", { text: "●●●▱" })]),
    header,
    chat,
    actions,
  ]);
  const overlay = el("div.phone-overlay", [phone]);
  layers.modal.replaceChildren(overlay);
  layers.modal.classList.add("show");
  requestAnimationFrame(() => overlay.classList.add("show"));

  // gen: 画面（一覧⇄トーク）を切り替えるたびに進める。古い画面の続き（吹き出し）が新しい画面に混ざらないように
  const ui = { header, chat, actions, phone, open: true, gen: 0, lastSide: null, cancel: null };
  ui.live = (g) => ui.open && ui.gen === g && state === owner;
  // 履歴の一括描画中はスクロールを保留し、最後に1回だけ実行する（scrollHeight の連続参照による強制リフローを避ける）。
  let scrollHold = 0;
  let scrollPending = false;
  ui.scroll = () => {
    if (scrollHold) { scrollPending = true; return; }
    chat.scrollTop = chat.scrollHeight;
  };
  ui.withDeferredScroll = (draw) => {
    scrollHold++;
    try { return draw(); }
    finally {
      scrollHold--;
      if (!scrollHold && scrollPending) {
        scrollPending = false;
        ui.scroll();
      }
    }
  };
  /** 吹き出し。animate=false は履歴（既読）をまとめて描くとき */
  ui.bubble = async (raw, mine = false, sender = null, animate = true) => {
    const g = ui.gen;
    if (!ui.live(g)) return;
    if (!mine && animate) {
      // 相手が打っている気配（…）を一瞬見せてから吹き出しにする
      const typing = el("div.lime-row.peer.typing", [ui.lastSide === "peer" ? el("span.lime-face.sm.gap") : avatar(sender, true), el("div.lime-bubble", [el("i"), el("i"), el("i")])]);
      chat.append(typing);
      ui.scroll();
      await sleep(300);
      typing.remove();
      if (!ui.live(g)) return;
    }
    const side = mine ? "me" : "peer";
    const face = mine ? null : ui.lastSide === "peer" ? el("span.lime-face.sm.gap") : avatar(sender, true);
    const b = el("div.lime-bubble");
    b.innerHTML = text(raw);
    chat.append(el(`div.lime-row.${side}${animate ? "" : ".past"}`, [face, b]));
    ui.lastSide = side;
    ui.scroll();
    if (animate) { (mine ? SE.phoneSend : SE.phoneReceive)(); await sleep(mine ? 260 : 380); }
  };
  /** 素材は先に枠を置く。履歴は読込を待たず、初読だけ最大3秒待つ。 */
  ui.media = async (content, sender, animate) => {
    const g = ui.gen;
    const session = state;
    const live = () => ui.live(g) && state === session && row.isConnected;
    const face = ui.lastSide === "peer" ? el("span.lime-face.sm.gap") : avatar(sender, true);
    const box = el(`div.lime-media.lime-${content.kind}`);
    const row = el(`div.lime-row.peer${animate ? "" : ".past"}`, [face, box]);
    chat.append(row);
    ui.lastSide = "peer";
    ui.scroll();
    if (animate) SE.phoneReceive();
    const asset = content.asset;
    const fallback = () => {
      box.classList.add("lime-media-fallback");
      box.replaceChildren(el("span", { text: content.fallback }));
    };
    if (!asset) { fallback(); return; }
    const image = el("img", { alt: asset.alt, width: asset.width, height: asset.height });
    box.style.aspectRatio = `${asset.width} / ${asset.height}`;
    box.append(image);
    await new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (live() && !ok) fallback();
        resolve();
      };
      const timer = setTimeout(() => finish(false), 3000);
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = asset.src;
      if (!animate) resolve(); // 履歴同士の読込待機を積まない
    });
  };
  ui.note = (t, cls = "") => {
    chat.append(el(`div.lime-note${cls}`, { text: t }));
    ui.lastSide = null;
    ui.scroll();
  };
  /** 返信の選択肢。戻る・閉じるで抜けたら null */
  ui.choose = (options, hint = null) => new Promise((resolve) => {
    ui.cancel = () => resolve(null);
    const buttons = options.map((o, i) =>
      el(`button.lime-reply${o.disabled ? ".disabled" : ""}`, {
        text: o.label || o.text,
        disabled: o.disabled || null,
        dataset: { test: `reply-${i}` },
        onclick: () => { SE.select(); actions.replaceChildren(); ui.cancel = null; resolve(o); },
      }));
    actions.replaceChildren(...[hint ? el("div.lime-hint", { text: hint }) : null, ...buttons].filter(Boolean));
    buttons.forEach((b) => fitOneLine(b, 14)); // 返信も1行（GUI22）
  });
  ui.close = async () => {
    ui.open = false;
    ui.cancel?.();
    overlay.classList.remove("show");
    await sleep(300);
    // LIMEからの誘いは閉じる間に次の行動へ進む。新しい注文画面などは消さない。
    if (overlay.parentNode === layers.modal) {
      layers.modal.classList.remove("show");
      overlay.remove();
    }
  };
  return ui;
}

/** 読み終えたときの報酬（返信の無いメッセージ）。噂は洞察、ふつうの連絡は少しだけ好感度 */
function readReward(m) {
  if (m.type === "rumor") applyStats({ insight: 2 });
  else if (m.type !== "invitation" && !(m.replies && m.replies.length) && m.sender !== "???" && m.sender !== "sumi") gainAffinity(m.sender, 2);
}

/** 一方の約束を承諾したら、その日に競合する誘いには先の約束を理由に返事を残す */
function declineConflictingInvites(acceptedItem, opts = {}) {
  for (const other of state.inbox || []) {
    if (other === acceptedItem || other.done || other.msg?.type !== "invitation" || inviteState(other, opts) === "expired") continue;
    const m = other.msg;
    const source = DB.lime.find((message) => message.id === originId(other)) || m;
    const text = POLITE.has(m.sender) ? "すみません、先に別の約束があって……" : "ごめん、先に別の約束をしてしまった";
    other.done = true;
    other.result = "conflict_declined";
    other.replyState = "replied";
    other.needsResend = importantInvite(source);
    // 相手の文面をまだ読んでいなければ未読のまま。返信と理由は後からトークで確認できる。
    (other.log ||= []).push({ me: true, text });
    if (m.decline_response?.text) other.log.push({ me: false, text: m.decline_response.text });
    other.log.push({ note: other.needsResend
      ? "先にした約束と重なったため、今回は断った。また都合の合う日に誘ってくれるそうだ"
      : "先にした約束と重なったため、今回は断った" });
    if (!other.needsResend) state.flags[`_invited_${originId(other)}`] = true;
  }
}

/**
 * 1件ぶんのやりとり（未読なら吹き出しを流す→返信・誘いの返事）。
 * 返信を選ぶ前に戻る/閉じるで抜けたら、次に開いたときに選択から再開
 */
async function runItem(item, ui, accepted, { forced = false } = {}) {
  const session = state;
  const m = item.msg;
  const g = ui.gen;
  const alive = () => ui.live(g) && state === session;
  const from = accountOf(item);
  if (!item.read) {
    for (const msg of m.messages || []) {
      await drawMessage(ui, msg, false, from);
      if (!alive()) break;
    }
    if (!alive()) return; // 読み終える前に戻ったら、既読・報酬を付けない
    item.read = true;
    if (!state.limeRead.includes(m.id)) state.limeRead.push(m.id);
    syncMintoKnowledge();
    readReward(m);
  }
  if (!alive()) return;
  if (item.done) {
    const missed = missedInvitationNote(item);
    if (missed) { ui.note(missed); return; }
    for (const entry of item.log || []) {
      if (entry.note) ui.note(entry.note);
      else await drawMessage(ui, entry, entry.me, from, false);
    }
    return;
  }

  if (m.type === "invitation" && m.accept_event) {
    const st = forced ? "open" : inviteState(item, ui.inviteOptions);
    if (st === "expired") {
      item.done = true;
      item.result = "expired";
      item.replyState = "expired";
      const note = missedInvitationNote(item);
      item.log.push({ note });
      ui.note(note);
      return;
    }
    const polite = POLITE.has(m.sender);
    const cost = invitationCost(m.accept_event);
    const affordable = spendableMoney(state) >= cost;
    const go = m.accept_text || (polite ? "行きます！" : "行く！");
    const no = st === "busy"
      ? polite ? "すみません、先に別の約束があって……" : "ごめん、先に別の約束をしてしまった"
      : polite ? "すみません、今日は難しいです……" : "ごめん、今日は難しい";
    const hintKey = m.hint ? "_hint_sumi_baito" : "_hint_invite";
    const first = !state.flags[hintKey];
    const night = replySlot(m) === 1;
    const deadline = storeInvitationSpot(m) ? "夜の行動の前まで（店の営業日だけ）" : night ? "夜の行動の前まで" : "昼の行動の前まで";
    const pick = await ui.choose(
      [
        st === "busy"
          ? { label: "（今日はもう別の約束がある）", disabled: true }
          : { label: `${go}（行動1回${cost ? `・${yen(cost)}必要${affordable ? "" : "・所持金不足"}` : ""}）`, text: go, go: true, disabled: !affordable },
        { text: no, go: false },
        ...(!forced ? [{ text: "あとで返事する（トーク一覧へ）", later: true }] : []),
      ],
      st === "busy" ? null : first ? m.hint || `誘いに乗ると行動を1回使う。返事は今日の${deadline}ならできる。断っても嫌われたりはしない` : `返事は今日の${deadline}`,
    );
    if (!pick || !alive() || state !== session || item.done) return; // 返事をせずに抜けた（期限内ならまた返事できる）
    if (pick.later) { item.replyState = "waiting"; return "deferred"; }
    // 送信演出中に戻る・別トーク・SAVE/LOADしても、返信と予約を一度だけ確定する。
    // 承諾は面会完了ではない。移動・行動消費は従来どおりLIMEを閉じた後。
    if (pick.go && !forced && inviteState(item, ui.inviteOptions) !== "open") return;
    state.flags[hintKey] = true;
    item.log.push({ me: true, text: pick.text });
    const responseMedia = pick.go ? replyMedia(item, m.accept_reply) : null;
    if (responseMedia) item.log.push({ me: false, ...responseMedia });
    state.flags[`_invited_${originId(item)}`] = true;
    item.done = true;
    item.replyState = "replied";
    if (pick.go) {
      item.result = "accepted";
      const inv = { event: m.accept_event, sender: m.sender, slot: night ? 1 : 0,
        day: state.day, originId: originId(item), afterClose: !!m.after_close, temporaryClosed: !!m.temporary_closed };
      if (!forced) inv.awaitingLimeClose = true;
      if (m.visit_spot) inv.visitSpot = m.visit_spot;
      accepted.push(inv);
      if (!forced) {
        state.pendingInvite = inv;
        declineConflictingInvites(item, ui.inviteOptions);
      }
      const t = m.accept_event === "__sumi_baito__" ? "このあと tonari のシフトに入る"
        : m.temporary_closed ? "臨時休暇の午後に会う約束ができた"
        : m.after_close ? "仕事を終えたあとに会う約束ができた"
        : m.closed_on != null ? "定休日の午後に会う約束ができた"
        : night ? "今夜の約束ができた" : "このあと向かうことにした";
      item.log.push({ note: t });
      await ui.bubble(pick.text, true);
      if (alive() && responseMedia) await drawMessage(ui, responseMedia, false, from);
      if (alive() && state === session) ui.note(t);
    } else {
      item.result = "declined";
      if (m.retry_on_decline) {
        item.needsResend = true;
        delete state.flags[`_invited_${originId(item)}`];
      }
      if (m.decline_response) item.log.push({ me: false, text: m.decline_response.text });
      gainAffinity(m.sender, 1, { source: "lime" });
      await ui.bubble(pick.text, true);
      if (alive() && state === session && m.decline_response) await ui.bubble(m.decline_response.text, false, from);
    }
    return;
  }
  if (m.replies && m.replies.length) {
    const r = await ui.choose(m.replies);
    if (!r || !alive() || state !== session || item.done) return;
    // 返信は演出を待つ前に一度だけ確定。戻る/再入室では確定済みの履歴を表示する。
    item.done = true;
    item.replyState = "replied";
    item.log.push({ me: true, text: r.text });
    const responseMedia = replyMedia(item, r.response_media);
    if (responseMedia) item.log.push({ me: false, ...responseMedia });
    if (r.response) item.log.push({ me: false, text: r.response });
    bond.private = isLover(m.sender); // 恋人とのやりとりは絆として積もる
    try {
      // 雑談は選んだ返事に応じて1〜2点。0点も尊重し、恋人の絆の倍率は従来どおり。
      const points = Number.isFinite(r.affinity) ? Math.max(0, Math.min(2, r.affinity)) : 1;
      gainAffinity(m.sender, points * (isLover(m.sender) ? 3 : 1), {
        source: "lime",
        // 確定した返信だけに添える。履歴には保存せず、再表示では通知しない。
        onGain: () => ui.note(isLover(m.sender) ? "♡ 心の距離がほんの少し近づいた" : "♡ ほんの少し仲良くなった"),
      });
    } finally {
      bond.private = false;
    }
    // 以降は表示のみ。古い画面/セーブの待機処理を新しい画面へ持ち越さない。
    await ui.bubble(r.text, true);
    if (!alive() || state !== session) return;
    if (responseMedia) await drawMessage(ui, responseMedia, false, from);
    if (!alive() || state !== session) return;
    if (r.response) await ui.bubble(r.response, false, from);
    return;
  }
  item.done = true;
  item.replyState = m.replies?.length ? "replied" : "none";
}

/** 既読ぶんを履歴として一気に描く（日付の区切りつき） */
function drawHistory(items, ui) {
  // 同期的に描き切るため途中経過は描画されない。スクロールは最後の1回だけにまとめる。
  const draw = () => {
    let lastItem = null;
    for (const it of items) {
      if (!lastItem || it.day !== lastItem.day || it.chapter !== lastItem.chapter) { ui.note(dayLabel(it), ".day"); lastItem = it; }
      if (!it.read) continue;
      for (const msg of it.msg.messages || []) drawMessage(ui, msg, false, accountOf(it), false);
      const missed = missedInvitationNote(it);
      if (missed) { ui.note(missed); continue; }
      for (const l of it.log || []) {
        if (l.note) ui.note(l.note);
        else drawMessage(ui, l, l.me, accountOf(it), false);
      }
    }
  };
  if (typeof ui.withDeferredScroll === "function") ui.withDeferredScroll(draw);
  else draw();
}

/**
 * LIME アプリを開く（トーク一覧 → 相手を選んで読む）。閉じるまで待つ。
 * 戻り値: この間に乗った誘い [{event, sender, slot}]（state.pendingInvite にも入る）
 * @param opts.tutorial 初回の説明を一覧の上に出す
 * @param opts.sender   最初に開くトーク（アカウント。みんとの私用は "minto_private"）
 */
export async function openLime({ tutorial = false, sender = null, fixedNight = () => false, beforeClose = null } = {}) {
  // HUD・案内の穴・プッシュ通知のどこから開いても、地図の上の初回案内を片付ける。
  layers.fx.querySelectorAll(".lime-coach").forEach((coach) => coach.remove());
  state.flags._lime_tut = 1;
  expireInvitations({ fixedNight });
  const owner = state;
  const accepted = [];
  const ui = phoneShell({ time: clockNow(), title: `DAY ${chapterDay(state)}` });
  ui.inviteOptions = { fixedNight };
  let resolveClose;
  const closed = new Promise((r) => { resolveClose = r; });

  const showList = () => {
    ui.gen++;
    ui.cancel?.();
    ui.cancel = null;
    ui.lastSide = null;
    const senders = [];
    for (const it of [...state.inbox].reverse()) if (!senders.includes(accountOf(it))) senders.push(accountOf(it));
    ui.header.replaceChildren(el("span.lime-logo", { text: "LIME" }), el("span.lime-title", { text: "トーク" }));
    ui.chat.replaceChildren();
    ui.chat.classList.add("list");
    if (tutorial) {
      ui.chat.append(el("div.lime-tip", [
        el("b", { text: "LIMEの使い方" }),
        el("span", { text: "読みたいトークをタップ。赤い丸は未読のしるし。" }),
        el("span", { text: "誘いには、その日のうちなら返事ができる（店への誘いは営業日なら夜まで・昼限定のお出かけは昼まで）。" }),
      ]));
    }
    if (!senders.length) ui.chat.append(el("p.lime-empty", { text: "まだトークはない" }));
    for (const sender of senders) {
      const items = thread(sender);
      const last = items.at(-1);
      const unread = items.some((i) => !i.read);
      const openInv = items.some((i) => i.msg.type === "invitation" && !i.done && inviteState(i, ui.inviteOptions) !== "expired");
      const lastContent = [...(last.msg.messages || []), ...(last.read ? last.log || [] : [])]
        .map(messageContent).filter(Boolean).at(-1);
      const preview = lastContent?.kind === "text" ? plain(lastContent.text)
        : lastContent?.asset?.preview || lastContent?.fallback || "";
      ui.chat.append(el(`button.lime-chat-row${unread ? ".unread" : ""}`, {
        dataset: { test: `lime-chat-${sender === "???" ? "unknown" : sender}` },
        onclick: () => { SE.click(); showThread(sender); },
      }, [
        el("div.lcr-face", [avatar(sender), unread ? el("i.lcr-dot") : null]),
        el("div.lcr-main", [
          el("div.lcr-name", { text: limeName(sender) }),
          el("div.lcr-preview", { text: preview }),
        ]),
        el("div.lcr-side", [
          el("small", { text: dayLabel(last) }),
          openInv ? el("span.lcr-tag", { text: "誘い" }) : last.msg.type === "chat" ? el("span.lcr-tag", { text: "雑談" }) : null,
        ]),
      ]));
    }
    ui.actions.replaceChildren(el("button.lime-reply.ghost", {
      text: "スマホを閉じる",
      dataset: { test: "phone-close" },
      onclick: () => { SE.cancel(); resolveClose(); },
    }));
  };

  const showThread = async (sender) => {
    ui.gen++;
    const g = ui.gen;
    ui.chat.classList.remove("list");
    ui.chat.replaceChildren();
    ui.actions.replaceChildren();
    ui.lastSide = null;
    ui.header.replaceChildren(
      el("button.lime-back", { text: "‹", dataset: { test: "lime-back" }, onclick: () => { SE.cancel(); showList(); } }),
      avatar(sender),
      el("span.lime-name", { text: limeName(sender) }),
    );
    const status = storyThreadStatus(sender, state);
    if (status) ui.chat.append(el("p.lime-tip", { text: status, dataset: { test: "lime-story-contact" } }));
    const items = thread(sender);
    // 既読ぶんは履歴としてすぐ出し、未読・返事待ちを順に流す
    drawHistory(items.filter((i) => i.read), ui);
    for (const it of items) {
      if (!ui.live(g)) return;
      if (it.read && it.done) continue;
      const previous = items[items.indexOf(it) - 1];
      if (!it.read && (!previous || it.day !== previous.day || it.chapter !== previous.chapter)) ui.note(dayLabel(it), ".day");
      const result = await runItem(it, ui, accepted);
      if (result === "deferred" && ui.live(g)) { showList(); return; }
    }
    if (!ui.live(g)) return;
    ui.actions.replaceChildren(el("button.lime-reply.ghost", {
      text: "‹ トーク一覧へ",
      dataset: { test: "phone-next" },
      onclick: () => { SE.click(); showList(); },
    }));
  };

  if (sender && thread(sender).length) showThread(sender);
  else showList();
  await closed;
  // 準備が失敗した場合もスマホの操作ロックを残さない。
  try {
    if (state === owner) {
      if (state.pendingInvite) delete state.pendingInvite.awaitingLimeClose;
      await beforeClose?.();
    }
  } finally { await ui.close(); }
  return accepted;
}

/**
 * 物語の節目で必ず読ませる LIME（大会の朝の応援・優勝の夜など）。メッセージを順に流す。
 * 読んだものは受信箱にも履歴として残る。戻り値: 受けた誘い
 */
export async function openPhone(messages, { title = null, time = "朝" } = {}) {
  const accepted = [];
  const ui = phoneShell({ time, title: title || (state.phase === "tournament" ? "大会当日" : `DAY ${chapterDay(state)}`) });
  await sleep(420);
  if (!ui.live(ui.gen)) return accepted;
  for (const m of messages) {
    const item = receiveItem(m);
    state.inbox.push(item);
    ui.chat.replaceChildren();
    ui.actions.replaceChildren();
    ui.lastSide = null;
    const left = messages.length - 1 - messages.indexOf(m);
    ui.header.replaceChildren(
      el("span.lime-logo", { text: "LIME" }),
      el("div.lime-peer", [avatar(accountOf(item)), el("span.lime-name", { text: limeName(accountOf(item)) })]),
      el("span.lime-unread", { text: left ? `未読 ${left}` : "" }),
    );
    await runItem(item, ui, accepted, { forced: true });
    if (!ui.live(ui.gen)) return accepted;
    item.done = true;
    await new Promise((resolve) => {
      const last = messages.at(-1) === m;
      ui.actions.replaceChildren(el("button.lime-reply.ghost", {
        text: m.close_label || (last ? "スマホを閉じる" : "次のトーク ▸"),
        dataset: { test: "phone-next" },
        onclick: () => { SE.click(); resolve(); },
      }));
    });
  }
  await ui.close();
  return accepted;
}

// ================================================================ 初回チュートリアル

/**
 * はじめて LIME が届いたとき、マップの上でアイコンを照らして開かせる（オーナー指定）。
 * 照らした穴だけ押せる。押したら onOpen（＝ふつうに LIME を開く処理）へ
 */
export function limeCoach(onOpen) {
  if (state.flags._lime_tut || !hasUnread()) return false;
  const icon = document.querySelector(".hud-lime");
  const stage = document.getElementById("stage");
  if (!icon || !stage) return false;
  state.flags._lime_tut = 1;
  const k = stage.getBoundingClientRect().width / stage.offsetWidth || 1;
  const sr = stage.getBoundingClientRect();
  const ir = icon.getBoundingClientRect();
  const x = (ir.left - sr.left) / k;
  const y = (ir.top - sr.top) / k;
  const w = ir.width / k;
  const h = ir.height / k;
  const coach = el("div.lime-coach", [
    el("button.lc-hole", {
      style: { left: `${x - 8}px`, top: `${y - 8}px`, width: `${w + 16}px`, height: `${h + 16}px` },
      dataset: { test: "coach-lime" },
      onclick: () => { SE.select(); coach.remove(); onOpen(); },
    }),
    el("div.lc-bubble", { style: { right: `${stage.offsetWidth - x - w - 4}px`, top: `${y + h + 22}px` } }, [
      el("b", { text: "LIMEにメッセージが届いた！" }),
      el("span", { text: "右上のLIMEをタップして開いてみよう。" }),
      el("span", { text: "まずは一度開いてみよう。次からは好きなときに読める。返事や誘いの受諾は、今決めなくて大丈夫。" }),
    ]),
  ]);
  layers.fx.append(coach);
  SE.phoneReceive();
  return true;
}

/** 章の旅程相談。既存端末とアカウントを使い、当日招待の失効・報酬処理へ流さない。 */
export async function openContactLime({ contacts, summary, actions, onAction, signal = null }) {
  const owner = state;
  const ui = phoneShell({ time: clockNow(), title: `DAY ${chapterDay(state)}` });
  let resolveClose;
  const closed = new Promise(resolve => { resolveClose = resolve; });
  const alive = () => ui.open && state === owner && !signal?.aborted;
  const close = () => resolveClose();
  const backButton = () => el("button.lime-reply.ghost", { text: "‹ トーク一覧へ",
    dataset: { test: "phone-next" }, onclick: showList });
  function showList() {
    if (!alive()) return;
    ui.gen++;
    ui.header.replaceChildren(el("span.lime-logo", { text: "LIME" }), el("span.lime-title", { text: "恋人との連絡" }));
    ui.chat.classList.add("list");
    ui.chat.replaceChildren();
    for (const id of contacts()) {
      const account = accountFor(id);
      ui.chat.append(el("button.lime-chat-row", { dataset: { test: `lime-contact-${id}` }, onclick: () => showThread(id) }, [
        el("div.lcr-face", [avatar(account)]),
        el("div.lcr-main", [el("div.lcr-name", { text: limeName(account) }), el("div.lcr-preview", { text: summary(id) })]),
      ]));
    }
    if (!contacts().length) ui.chat.append(el("p.lime-empty", { text: "連絡先を交換した恋人ができると、ここから連絡できます。" }));
    ui.actions.replaceChildren(el("button.lime-reply.ghost", { text: "スマホを閉じる", dataset: { test: "phone-close" }, onclick: close }));
  }
  function showThread(id) {
    if (!alive() || !contacts().includes(id)) return;
    const account = accountFor(id);
    ui.gen++;
    ui.lastSide = null;
    ui.chat.classList.remove("list");
    ui.chat.replaceChildren();
    ui.header.replaceChildren(el("button.lime-back.lime-contact-back", { text: "‹", ariaLabel: "トーク一覧へ戻る", dataset: { test: "lime-back" }, onclick: showList }),
      avatar(account), el("span.lime-name", { text: limeName(account) }));
    drawHistory(thread(account).filter(item => item.msg?.tokyoVisit), ui);
    ui.note(summary(id));
    ui.actions.replaceChildren(...actions(id).map(action => el("button.lime-reply", {
      text: action.label, dataset: { test: `lime-travel-${action.id}` }, onclick: () => {
        if (!alive() || !contacts().includes(id)) return;
        onAction(id, action.id);
        showThread(id);
      },
    })), backButton());
  }
  signal?.addEventListener("abort", close, { once: true });
  if (signal?.aborted) close(); else showList();
  try { await closed; } finally {
    signal?.removeEventListener("abort", close);
    await ui.close();
  }
}
