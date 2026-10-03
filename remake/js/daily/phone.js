// LIME（スマホ）。朝に届くメッセージ・返信の選択肢・誘い。
// ルール: 同じ相手からは1日1話題まで（小分けの連投はOK）／連絡先を交換した相手だけ（master_spec #7/#26）
// 朝は通知だけ出して受信箱に積み、プレイヤーが好きなときにアプリを開いて読む（オーナー指定）。
// 物語の節目（大会の朝・優勝の夜）だけは openPhone で必ず読ませる。
// 見た目は旧版の LIME（ノッチ付きの端末・緑のヘッダー・白と黄緑の吹き出し・明るい返信欄）を踏襲する。
import { el, sleep } from "../core/util.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { layers } from "../core/ui.js";
import { state } from "../core/state.js";
import { gainAffinity, affinityLevel, applyStats, bond } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { hooks } from "../vn/engine.js";
import { formatHtml } from "../vn/text.js";
import { hasContact } from "./spots.js";
import { loverMessages, isLover, dateSchedule } from "./romance.js";
import { bondInvites, friendMessages } from "./bonds.js";

const HEROINES_ENCOURAGE = ["tsumugi", "minto", "rin"];
// 目上の相手への返信は敬語（旧版 F6）。友達口調は同世代の相手だけ
const POLITE = new Set(["sumi", "nagumo", "maezono"]);
const originId = (item) => item.originId || item.msg?.origin_id || item.id;
const importantInvite = (m) => m.type === "invitation" && !!m.important;
const needsResend = (id) => (state.inbox || []).some((item) => originId(item) === id && item.needsResend);
const canRetry = (item) => item.result === "expired"
  || item.result === "conflict_declined" && item.needsResend && item.day < state.day;

/** 営業中の私的な約束や、固定イベントとの重複を避ける。時刻を持たない誘いは従来どおり */
function invitationAvailable(m, { fixedNight = () => false } = {}) {
  if (m.closed_on != null && state.day % 7 !== m.closed_on) return false;
  if (m.exclude_closed_on != null && state.day % 7 === m.exclude_closed_on) return false;
  if (m.time_slot === "night" && fixedNight(state.day)) return false;
  return true;
}

/** 私的な待ち合わせは、配信日に休日午後か営業後夜へ確定する。受信後は本文も時刻も固定 */
function scheduledInvitation(m, opts = {}) {
  if (m.private_schedule !== "holiday_or_after_close") return m;
  const schedule = dateSchedule(m.sender, opts);
  if (!schedule) return null;
  const daytime = schedule.time_slot === "noon";
  const context = daytime ? "今日はお店がお休みだから、午後" : "今日、仕事を終えたあと";
  const when = daytime ? "午後" : "仕事を終えたあと";
  const render = (value) => String(value).replaceAll("{privateContext}", context).replaceAll("{privateWhen}", when);
  // DBの雛形を変更せず、その日の受信トークへ解決済みの時刻を保存する。
  const resolved = { ...m, ...schedule, after_close: !!schedule.after_close };
  if (schedule.closed_on == null) delete resolved.closed_on;
  resolved.messages = (m.messages || []).map((line) => typeof line === "string" ? render(line) : { ...line, text: render(line.text) });
  if (m.reminder_text) resolved.reminder_text = render(m.reminder_text);
  if (m.accept_text) resolved.accept_text = render(m.accept_text);
  return resolved;
}

/** 期限切れは既読とは別。未読のままでも、重要な誘いの再案内を止めない */
export function expireInvitations(opts = {}) {
  const pending = state.pendingInvite;
  if (pending) {
    let booked = [...(state.inbox || [])].reverse().find((item) => item.result === "accepted"
      && (pending.originId ? originId(item) === pending.originId : item.msg?.accept_event === pending.event && item.msg?.sender === pending.sender));
    const source = DB.lime.find((m) => m.id === (pending.originId || (booked && originId(booked)))) || booked?.msg;
    const dueDay = pending.day ?? booked?.day ?? state.day;
    const schedule = /^date_/.test(pending.event) ? dateSchedule(pending.sender, { ...opts, day: dueDay })
      : source ? scheduledInvitation(source, { ...opts, day: dueDay }) : source;
    // 夜の行動枠で受け付けた仕事後の約束は、閉店イベントが済むまでslot2で待つ。
    const waitingForClose = pending.afterClose && pending.queuedAfterClose && dueDay === state.day && state.slot >= 2;
    const past = dueDay < state.day || dueDay === state.day && pending.slot < state.slot && !waitingForClose;
    const conflict = dueDay === state.day && !waitingForClose && (pending.slot === 1 && opts.fixedNight?.(dueDay) || schedule === null
      || schedule && (!invitationAvailable(schedule, opts) || pending.slot !== (schedule.time_slot === "night" ? 1 : 0)));
    if (past || conflict) {
      // 旧セーブに残った予約も、消す前に経緯をトークへ残す。既読記録は戻さない。
      if (!booked) {
        const id = pending.originId || source?.id || `_rescheduled_${pending.event}_d${dueDay}`;
        booked = { id, originId: id, day: dueDay, msg: source || { id, sender: pending.sender, type: "invitation",
          accept_event: pending.event, time_slot: pending.slot ? "night" : "noon", messages: ["会う約束をしていた"] },
          read: true, done: true, log: [] };
        state.inbox.push(booked);
      }
      booked.done = true;
      booked.result = "expired";
      booked.replyState = "expired";
      booked.needsResend = true;
      (booked.log ||= []).push({ note: conflict
        ? "仕事や別の予定と重なったため、約束を別の日に改めることにした"
        : "約束の時間を過ぎてしまった。また都合の合う日に会うことにした" });
      delete state.flags[`_invited_${originId(booked)}`];
      state.pendingInvite = null;
    } else if (schedule?.after_close) pending.afterClose = true;
  }
  for (const item of state.inbox || []) {
    if (item.done || item.msg?.type !== "invitation" || inviteState(item) !== "expired") continue;
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
  if (["ageha"].includes(m.sender)) return false; // ch1 ではまだ連絡先を知らない
  const cond = m.trigger_condition;
  if (cond === "tournament_day") return tournamentDay && HEROINES_ENCOURAGE.includes(m.sender) && hasContact(m.sender);
  if (tournamentDay) return false;
  if (!hasContact(m.sender)) return false;
  if (m.type === "invitation" && state.flags[`_invited_${m.id}`]) return false;
  if (m.exclude_flag && state.flags[m.exclude_flag]) return false;
  if (cond === "story_count") return (state.story[m.sender] || 0) >= (m.trigger_value || 1);
  if (cond === "lime_exchanged") return needsResend(m.id) || m.trigger_day <= state.day && state.day - m.trigger_day <= 1;
  if (cond === "affinity_level") return affinityLevel(m.sender) >= (m.trigger_value || 3) && !state.flags[`_invited_${m.id}`];
  if (cond === "flag") return !!state.flags[m.trigger_flag];
  return false;
}

/**
 * 今朝届くメッセージ（1人1話題・最大3通）。恋人からの LIME（記念日・デートの誘い・朝のひとこと）を優先する
 * @param opts.tournamentDay 大会当日の朝か / opts.fixedNight (day) => 夜の固定イベントがあるか
 */
export function morningMessages(opts = {}) {
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
  const sumi = sumiBaitoInvite(opts);
  if (sumi && out.length < 3 && !senders.has("sumi") && !delivered.has(sumi.id)) {
    out.push(sumi);
    senders.add("sumi");
  }
  // 大事な外出の誘いは、通常の雑談より先に届ける。同じ相手からは1朝1話題。
  const messages = [...DB.lime].sort((a, b) => (Number(importantInvite(b)) + (b.priority || 0)) - (Number(importantInvite(a)) + (a.priority || 0)));
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
  for (const template of friendMessages(opts)) {
    if (out.length >= 3) break;
    if (senders.has(template.sender) || delivered.has(template.id)) continue;
    if (template.type === "invitation" && otherInvite) continue;
    const m = scheduledInvitation(template, opts); // お誘いは休日の午後か仕事後。合わない日は同じ相手の雑談へ
    if (!m || !invitationAvailable(m, opts)) continue;
    out.push(m);
    senders.add(m.sender);
    break;
  }
  return out;
}

/**
 * スミさんからの「急で悪い、昼のシフト入れるか？」。序盤の固定2回（DAY3/8）＋4日以上バイトに出ていない朝。
 * 乗るとそのまま昼のシフトへ（行動1回・給料に上乗せ）。最終日の朝は来ない
 */
function sumiBaitoInvite({ tournamentDay = false } = {}) {
  if (tournamentDay || state.chapter !== 1 || state.day >= 14) return null;
  const id = `_sumi_baito_inv_d${state.day}`;
  if (state.limeRead.includes(id)) return null;
  const fixed = state.day === 3 || state.day === 8;
  const slacking = state.day >= 5 && state.day - (state.lastBaitoDay || 0) >= 4;
  if (!fixed && !slacking) return null;
  return {
    id,
    sender: "sumi",
    type: "invitation",
    time_slot: "noon",
    accept_event: "__sumi_baito__",
    accept_text: "入ります！",
    hint: "乗るとそのまま昼のシフトへ（行動を1回使う）。いつもの給料に上乗せがつく",
    messages: [
      "急で悪い。今日、昼のシフト入れるか？",
      "常連の団体が入ってな。人手が足りん",
      "……代わりと言っちゃなんだが、給料は弾むぞ",
    ],
    decline_response: { text: "おう、わかった。無理はするな" },
  };
}

/** LIME は個人どうしの連絡＝私的な場面の呼び名（みんとは本名を聞いた後なら「栞」） */
const limeName = (sender) => (sender === "???" ? "？？？" : displayName(sender, state, { context: "private" }));

/** 顔ドット絵のアイコン。名乗る前の相手・絵の無い相手は頭文字の丸にする（正体を明かさない） */
function avatar(sender, small = false) {
  const cls = `lime-face${small ? ".sm" : ""}`;
  const known = sender && sender !== "???" && (state.met[sender] || sender === "sumi");
  const url = known ? faceIconUrl(sender) : null;
  if (url) return el(`img.${cls}`, { src: url, alt: "" });
  const name = known ? limeName(sender) : "？";
  return el(`span.${cls}.blank`, { text: [...name][0] || "？" });
}

const text = (raw) => formatHtml(hooks.interpolate ? hooks.interpolate(String(raw)) : String(raw));

// ================================================================ 受信箱（オーナー指定: 朝は通知だけ・読みたい時に開く）
// 朝に届いたメッセージは state.inbox に積むだけ。HUD の LIME アイコンに未読の赤丸（数字なし）を出し、
// プレイヤーが好きなときにアプリを開いて、トーク一覧から読みたい相手を選ぶ。
// 誘いは「当日・その時間帯のうち」なら返事ができる（昼の誘い＝昼の行動の前まで／夜の誘い＝夜の行動の前まで）。

/** 未読があるか（HUD の赤丸） */
export const hasUnread = () => (state.inbox || []).some((i) => !i.read);

/** 今朝のメッセージを受信箱に積む。戻り値=届いた件数 */
export function deliverMorning(opts = {}) {
  const msgs = morningMessages(opts);
  // {daysLeft} などは届いた日の値で固定する（数日後に読んでも「あと◯日」がずれない）
  const freeze = (t) => (hooks.interpolate ? hooks.interpolate(String(t)) : t);
  for (const m of msgs) {
    const msg = { ...m, messages: (m.messages || []).map((x) => (typeof x === "string" ? freeze(x) : { ...x, text: freeze(x.text) })) };
    state.inbox.push({ id: m.id, originId: m.origin_id || m.id, day: state.day, msg,
      read: false, done: false, replyState: m.type === "invitation" || m.replies?.length ? "waiting" : "none", log: [] });
  }
  return msgs.length;
}

/** 朝の通知（スマホのプッシュ通知風）。件数と送り主の顔だけ見せ、中身は開くまで分からない */
export function pushNotice(count, { onOpen = null } = {}) {
  const senders = [...new Set(state.inbox.filter((i) => !i.read).map((i) => i.msg.sender))].slice(0, 4);
  const newest = [...state.inbox].reverse().find((i) => !i.read);
  let opened = false;
  const card = el(onOpen ? "button.lime-push" : "div.lime-push", onOpen ? {
    type: "button", dataset: { test: "lime-notice" },
    "aria-label": "新着メッセージのトークを開く",
    onclick: () => {
      if (opened) return;
      opened = true;
      card.remove();
      onOpen(newest?.msg.sender || null);
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
  SE.phone();
  requestAnimationFrame(() => card.classList.add("show"));
  setTimeout(() => { card.classList.remove("show"); setTimeout(() => card.remove(), 500); }, 3200);
}

/**
 * 誘いに今から返事できるか。open=乗れる / expired=時間切れ / busy=別の約束がある
 * （昼の誘いは昼の行動の前まで、夜の誘いは夜の行動の前まで。日をまたいだら時間切れ）
 */
function inviteState(item) {
  const m = item.msg;
  const slot = m.time_slot === "night" ? 1 : 0;
  if (state.phase !== "daily" || item.day !== state.day || state.slot > slot) return "expired";
  if (state.pendingInvite) return "busy";
  return "open";
}

const thread = (sender) => state.inbox.filter((i) => i.msg.sender === sender);
const plain = (raw) => String(hooks.interpolate ? hooks.interpolate(String(raw)) : raw).replace(/\[\/?[a-z]+[^\]]*\]/gi, "").replace(/<[^>]+>/g, "");
const dayLabel = (d) => (d === state.day ? "今日" : d === state.day - 1 ? "昨日" : `DAY ${d}`);
const clockNow = () => (state.phase === "tournament" ? "大会の朝" : state.slot >= 1 ? "夜" : "昼");

/** 端末の枠（ノッチ・ステータスバー・ヘッダー・本文・返信欄）。openLime と openPhone で共用 */
function phoneShell({ time, title }) {
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
  ui.live = (g) => ui.open && ui.gen === g;
  ui.scroll = () => { chat.scrollTop = chat.scrollHeight; };
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
    if (animate) { SE.phone(); await sleep(mine ? 260 : 380); }
  };
  ui.note = (t, cls = "") => {
    chat.append(el(`div.lime-note${cls}`, { text: t }));
    ui.lastSide = null;
    ui.scroll();
  };
  /** 返信の選択肢。戻る・閉じるで抜けたら null */
  ui.choose = (options, hint = null) => new Promise((resolve) => {
    ui.cancel = () => resolve(null);
    actions.replaceChildren(...[
      hint ? el("div.lime-hint", { text: hint }) : null,
      ...options.map((o, i) =>
        el(`button.lime-reply${o.disabled ? ".disabled" : ""}`, {
          text: o.label || o.text,
          disabled: o.disabled || null,
          dataset: { test: `reply-${i}` },
          onclick: () => { SE.select(); actions.replaceChildren(); ui.cancel = null; resolve(o); },
        })),
    ].filter(Boolean));
  });
  ui.close = async () => {
    ui.open = false;
    ui.cancel?.();
    overlay.classList.remove("show");
    await sleep(300);
    layers.modal.classList.remove("show");
    layers.modal.replaceChildren();
  };
  return ui;
}

/** 読み終えたときの報酬（返信の無いメッセージ）。噂は洞察、ふつうの連絡は少しだけ好感度 */
function readReward(m) {
  if (m.type === "rumor") applyStats({ insight: 2 });
  else if (m.type !== "invitation" && !(m.replies && m.replies.length) && m.sender !== "???" && m.sender !== "sumi") gainAffinity(m.sender, 2);
}

/** 一方の約束を承諾したら、その日に競合する誘いには先の約束を理由に返事を残す */
function declineConflictingInvites(acceptedItem) {
  for (const other of state.inbox || []) {
    if (other === acceptedItem || other.done || other.msg?.type !== "invitation" || inviteState(other) === "expired") continue;
    const m = other.msg;
    const source = DB.lime.find((message) => message.id === originId(other)) || m;
    const text = POLITE.has(m.sender) ? "すみません、先に別の約束をしてしまいました" : "ごめん、先に別の約束をしてしまった";
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
 * 戻る/閉じるで途中で抜けたら、返事は次に開いたときに続きから
 */
async function runItem(item, ui, accepted, { forced = false } = {}) {
  const m = item.msg;
  const g = ui.gen;
  const alive = () => ui.live(g);
  const mine = async (t) => { item.log.push({ me: true, text: t }); await ui.bubble(t, true); };
  const theirs = async (t) => { item.log.push({ me: false, text: t }); await ui.bubble(t, false, m.sender); };
  if (!item.read) {
    for (const msg of m.messages || []) {
      await ui.bubble(typeof msg === "string" ? msg : msg.text, false, m.sender);
      if (!alive()) break;
    }
    if (!alive()) return; // 読み終える前に戻ったら、既読・報酬を付けない
    item.read = true;
    if (!state.limeRead.includes(m.id)) state.limeRead.push(m.id);
    readReward(m);
  }
  if (!alive()) return;
  if (item.done) {
    for (const entry of item.log || []) {
      if (entry.note) ui.note(entry.note);
      else await ui.bubble(entry.text, entry.me, m.sender, false);
    }
    return;
  }

  if (m.type === "invitation" && m.accept_event) {
    const st = forced ? "open" : inviteState(item);
    if (st === "expired") {
      item.done = true;
      item.result = "expired";
      item.replyState = "expired";
      const note = importantInvite(m) ? "返事をしそびれた……。また都合の合う日に誘ってくれるそうだ" : "返事をしそびれた……";
      item.log.push({ note });
      ui.note(note);
      return;
    }
    const polite = POLITE.has(m.sender);
    const go = m.accept_text || (polite ? "行きます！" : "行く！");
    const no = st === "busy"
      ? polite ? "すみません、先に別の約束をしてしまいました" : "ごめん、先に別の約束をしてしまった"
      : polite ? "すみません、今日は難しいです……" : "ごめん、今日は難しい";
    const hintKey = m.hint ? "_hint_sumi_baito" : "_hint_invite";
    const first = !state.flags[hintKey];
    const night = m.time_slot === "night";
    const deadline = night ? "夜の行動の前まで" : "昼の行動の前まで";
    const pick = await ui.choose(
      [
        st === "busy"
          ? { label: "（今日はもう別の約束がある）", disabled: true }
          : { label: `${go}（行動を1回使う）`, text: go, go: true },
        { text: no, go: false },
        ...(!forced ? [{ text: "あとで返事する（トーク一覧へ）", later: true }] : []),
      ],
      st === "busy" ? null : first ? m.hint || `誘いに乗ると行動を1回使う。返事は今日の${deadline}ならできる。断っても嫌われたりはしない` : `返事は今日の${deadline}`,
    );
    if (!pick || !alive()) return; // 返事をせずに抜けた（期限内ならまた返事できる）
    if (pick.later) { item.replyState = "waiting"; return "deferred"; }
    state.flags[hintKey] = true;
    await mine(pick.text);
    state.flags[`_invited_${originId(item)}`] = true;
    item.done = true;
    item.replyState = "replied";
    if (pick.go) {
      item.result = "accepted";
      const inv = { event: m.accept_event, sender: m.sender, slot: night ? 1 : 0,
        day: state.day, originId: originId(item), afterClose: !!m.after_close };
      accepted.push(inv);
      if (!forced) {
        state.pendingInvite = inv;
        declineConflictingInvites(item);
      }
      const t = m.accept_event === "__sumi_baito__" ? "このあと tonari のシフトに入る"
        : m.after_close ? "仕事を終えたあとに会う約束ができた"
        : m.closed_on != null ? "定休日の午後に会う約束ができた"
        : night ? "今夜の約束ができた" : "このあと向かうことにした";
      item.log.push({ note: t });
      ui.note(t);
    } else {
      item.result = "declined";
      if (m.decline_response) await theirs(m.decline_response.text);
      gainAffinity(m.sender, 1);
    }
    return;
  }
  if (m.replies && m.replies.length) {
    const r = await ui.choose(m.replies);
    if (!r || !alive()) return;
    await mine(r.text);
    if (r.response) await theirs(r.response);
    bond.private = isLover(m.sender); // 恋人とのやりとりは絆として積もる
    // 雑談は選んだ返事に応じて1〜2点。0点も尊重し、恋人の絆の倍率は従来どおり。
    const points = Number.isFinite(r.affinity) ? Math.max(0, Math.min(2, r.affinity)) : 1;
    gainAffinity(m.sender, points * (isLover(m.sender) ? 3 : 1));
    bond.private = false;
  }
  item.done = true;
  item.replyState = m.replies?.length ? "replied" : "none";
}

/** 既読ぶんを履歴として一気に描く（日付の区切りつき） */
function drawHistory(items, ui) {
  let lastDay = null;
  for (const it of items) {
    if (it.day !== lastDay) { ui.note(dayLabel(it.day), ".day"); lastDay = it.day; }
    if (!it.read) continue;
    for (const msg of it.msg.messages || []) ui.bubble(typeof msg === "string" ? msg : msg.text, false, it.msg.sender, false);
    for (const l of it.log || []) {
      if (l.note) ui.note(l.note);
      else ui.bubble(l.text, l.me, it.msg.sender, false);
    }
  }
}

/**
 * LIME アプリを開く（トーク一覧 → 相手を選んで読む）。閉じるまで待つ。
 * 戻り値: この間に乗った誘い [{event, sender, slot}]（state.pendingInvite にも入る）
 * @param opts.tutorial 初回の説明を一覧の上に出す
 */
export async function openLime({ tutorial = false, sender = null } = {}) {
  expireInvitations();
  const accepted = [];
  const ui = phoneShell({ time: clockNow(), title: `DAY ${state.day}` });
  let resolveClose;
  const closed = new Promise((r) => { resolveClose = r; });

  const showList = () => {
    ui.gen++;
    ui.cancel?.();
    ui.cancel = null;
    ui.lastSide = null;
    const senders = [];
    for (const it of [...state.inbox].reverse()) if (!senders.includes(it.msg.sender)) senders.push(it.msg.sender);
    ui.header.replaceChildren(el("span.lime-logo", { text: "LIME" }), el("span.lime-title", { text: "トーク" }));
    ui.chat.replaceChildren();
    ui.chat.classList.add("list");
    if (tutorial) {
      ui.chat.append(el("div.lime-tip", [
        el("b", { text: "LIMEの使い方" }),
        el("span", { text: "読みたいトークをタップ。赤い丸は未読のしるし。" }),
        el("span", { text: "誘いには、その日のうちなら返事ができる（昼の誘いは昼の行動の前まで・夜の誘いは夜の行動の前まで）。" }),
      ]));
    }
    if (!senders.length) ui.chat.append(el("p.lime-empty", { text: "まだトークはない" }));
    for (const sender of senders) {
      const items = thread(sender);
      const last = items.at(-1);
      const unread = items.some((i) => !i.read);
      const openInv = items.some((i) => i.msg.type === "invitation" && !i.done && inviteState(i) !== "expired");
      const lastText = last.read
        ? (last.log.filter((l) => l.text).at(-1)?.text || [].concat(last.msg.messages || []).at(-1))
        : [].concat(last.msg.messages || [])[0];
      const preview = plain(typeof lastText === "string" ? lastText : lastText?.text || "");
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
          el("small", { text: dayLabel(last.day) }),
          openInv ? el("span.lcr-tag", { text: "誘い" }) : null,
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
    const items = thread(sender);
    // 既読ぶんは履歴としてすぐ出し、未読・返事待ちを順に流す
    drawHistory(items.filter((i) => i.read), ui);
    for (const it of items) {
      if (!ui.live(g)) return;
      if (it.read && it.done) continue;
      if (!it.read && it.day !== (items[items.indexOf(it) - 1]?.day)) ui.note(dayLabel(it.day), ".day");
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
  await ui.close();
  return accepted;
}

/**
 * 物語の節目で必ず読ませる LIME（大会の朝の応援・優勝の夜など）。メッセージを順に流す。
 * 読んだものは受信箱にも履歴として残る。戻り値: 受けた誘い
 */
export async function openPhone(messages, { title = null, time = "朝" } = {}) {
  const accepted = [];
  const ui = phoneShell({ time, title: title || (state.phase === "tournament" ? "大会当日" : `DAY ${state.day}`) });
  await sleep(420);
  for (const m of messages) {
    const item = { id: m.id, originId: m.origin_id || m.id, day: state.day, msg: m,
      read: false, done: false, replyState: m.type === "invitation" || m.replies?.length ? "waiting" : "none", log: [] };
    state.inbox.push(item);
    ui.chat.replaceChildren();
    ui.actions.replaceChildren();
    ui.lastSide = null;
    const left = messages.length - 1 - messages.indexOf(m);
    ui.header.replaceChildren(
      el("span.lime-logo", { text: "LIME" }),
      el("div.lime-peer", [avatar(m.sender), el("span.lime-name", { text: limeName(m.sender) })]),
      el("span.lime-unread", { text: left ? `未読 ${left}` : "" }),
    );
    await runItem(item, ui, accepted, { forced: true });
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
      el("span", { text: "未読があるとアイコンに赤い丸がつく。好きなときに開いて読めばいい。" }),
    ]),
  ]);
  layers.fx.append(coach);
  SE.phone();
  return true;
}
