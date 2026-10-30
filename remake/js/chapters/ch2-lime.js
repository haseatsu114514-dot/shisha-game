// 第2章の関係の変化を、本文の説明だけでなく実際のLIME履歴に残す（#1653 ⑦）。
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { hasContact } from "../daily/spots.js";
import { morningMessages } from "../daily/phone.js";

// 前夜、つむぎにLIMEで送った返事の記録。連絡先の有無より、実際に交わした返事を優先する。
const EVE_FLAGS = ["_ch2_no_audience", "_ch2_audience_welcome"];
const eveReply = (m, game) => m.sender === "tsumugi" && EVE_FLAGS.includes(m.trigger_flag) && !!game.flags[m.trigger_flag];
const unseen = (m, game) => !(game.inbox || []).some(item => (item.originId || item.id) === m.id) && !(game.limeRead || []).includes(m.id);

/** 大会の朝の応援。第1章と同じ収集処理に、前夜の返事に応えるつむぎの1通を必ず含める（最大3通）。 */
export function chapterTwoCheers(game = state) {
  const cheers = morningMessages({ tournamentDay: true });
  const eve = DB.lime.find(m => m.chapter === 2 && m.trigger_condition === "tournament_day" && eveReply(m, game) && unseen(m, game));
  if (!eve || cheers.some(m => m.id === eve.id)) return cheers;
  return [eve, ...cheers.filter(m => m.sender !== eve.sender)].slice(0, 3);
}

/** 優勝の夜に届く「おめでとう」。前夜の返事に応じたつむぎと、連絡先のある旧メンバー（最大3通）。 */
export function chapterTwoCongratulations(game = state) {
  return DB.lime.filter(m => m.chapter === 2 && m.trigger_condition === "ch2_victory" && unseen(m, game)
    && (EVE_FLAGS.includes(m.trigger_flag) ? eveReply(m, game) : hasContact(m.sender))).slice(0, 3);
}

// 本文の場面でやり取りしたLIME。読了済みの履歴として残し、文面は台本の引用と揃える。
const me = text => ({ me: true, text });
const SENT = [
  { id: "ch2_sent_naru_apology", sender: "naru", day: 11, when: f => f._ch2_read_ch2_naru_confrontation && f._ch2_naru_hurt,
    log: [me("さっきは、すみませんでした"), me("なるさんの話を、ちゃんと聞いていませんでした"), { note: "既読がついた。返事は来なかった" }] },
  { id: "ch2_sent_naru_where", sender: "naru", day: 12, when: f => f._ch2_read_ch2_naru_window && f._ch2_naru_listened,
    log: [me("今どこにいますか"), { note: "返事はまだない" }] },
  { id: "ch2_eve_tsumugi_alone", sender: "tsumugi", day: 13, when: f => f._ch2_read_ch2_pre_tournament_realisation && f._ch2_no_audience,
    messages: ["明日の応援、どうしたらいいですか"],
    log: [me("明日は集中したいから、応援には来ないで。終わったら連絡する"), { text: "わかりました。お店で待ってます" }] },
  { id: "ch2_eve_tsumugi_welcome", sender: "tsumugi", day: 13, when: f => f._ch2_read_ch2_pre_tournament_realisation && f._ch2_audience_welcome,
    messages: ["明日の応援、どうしたらいいですか"],
    log: [me("返事、遅くなってごめん。明日、来てくれると助かる"), { text: "はい。邪魔しないところで見てます" }] },
  { id: "ch2_sent_naru_finished", sender: "naru", day: 14, when: (f, at) => at === "tasteless" && f._ch2_naru_listened,
    log: [me("終わりました")] },
];

/** 読了した場面で交わした連絡を、一度だけ受信箱へ記録する。旧保存は次の場面の読了時に補う。 */
export function recordSentLime(game = state, at = null) {
  if (game.chapter !== 2) return false;
  game.inbox ||= [];
  const start = game.flags._ch2_day1?.startDay;
  let added = false;
  for (const sent of SENT) {
    if (!sent.when(game.flags, at) || game.inbox.some(item => item.id === sent.id)) continue;
    game.inbox.push({ id: sent.id, originId: sent.id, chapter: 2, day: Number.isFinite(start) ? start + sent.day - 1 : game.day,
      msg: { id: sent.id, sender: sent.sender, type: "chat", messages: (sent.messages || []).map(text => ({ sender: sent.sender, text })) },
      read: true, done: true, replyState: "none", log: sent.log.map(entry => ({ ...entry })) });
    added = true;
  }
  return added;
}
