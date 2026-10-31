// ♥3〜4の知り合いから、たまに届く読むだけの雑談（2026-10-31 オーナー「たまに雑談も欲しい」LM05）。
// 恋人（romance.js）・友人（bonds.js friendMessages）になる前の段階だけ。返事は要らず、通知を増やしすぎない:
// - 全員あわせて globalGapDays 日に1通（友人のLIMEとも分け合う）、同じ相手は gapDays 日以上あける（長く連絡のない相手から順）
// - その相手から quietDays 日以内にLIME（物語の連絡など）が届いていたら控える
// - 各雑談は一度だけ。使い切った相手からはもう届かない（物語のLIMEと交流で関係を深める）
// 文面は remake/data/casual_lime.json。phone.js が、友人のLIMEが届かない朝に1通だけ採る。
// 第3〜5章（場面カード式）は chapters/friend-entry.js が、友人のLIMEが無い時に1通だけ出す（LM07）。
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";
import { hasContact } from "./spots.js";

export const CASUAL_PREFIX = "_casual_";
const lastDay = (items) => Math.max(-99, ...items.map((i) => i.day ?? -99));
const casualSent = () => (state.inbox || []).filter((i) => String(i.originId || i.id).startsWith(CASUAL_PREFIX));

/** 今朝の知り合いの雑談の候補（長く連絡のない相手から順）。phone.js が1通だけ採る */
export function casualMessages({ tournamentDay = false, sceneChapter = false } = {}) {
  const cfg = DB.casualLime || {};
  const chapter = state.chapter || 1;
  // sceneChapter: 場面カード式の第3〜5章（chapters/friend-entry.js）から。日常の朝の端末は無いので phase は見ない（LM07）
  if (tournamentDay || !cfg.people || (sceneChapter ? ![3, 4, 5].includes(chapter) : state.phase !== "daily")) return [];
  const all = casualSent();
  // 友人のたまのLIME（bonds.js の _friend_）とも間隔を分け合い、雑談だけが毎朝続かないようにする
  const friendly = (state.inbox || []).filter((i) => String(i.originId || i.id).startsWith("_friend_"));
  if (state.day - lastDay([...all, ...friendly]) < (cfg.globalGapDays ?? 3)) return [];
  const out = [];
  for (const [id, p] of Object.entries(cfg.people)) {
    if (!(p.chapters || []).includes(chapter) || !state.met?.[id] || !hasContact(id) || (state.lovers || []).includes(id)) continue;
    // 締めくくりを読んだ相手は、友人のLIME（友情）か告白（恋愛）の段階に進んでいる
    if (state.finales?.[id]) continue;
    if (affinityLevel(id) < (cfg.minLevel ?? 3)) continue;
    const mine = all.filter((i) => i.msg?.sender === id);
    const k = mine.length;
    // 第3〜5章では、第1・2章の分を使い切ったあとに離れた場所からの雑談（later）が続く
    const pool = [...(p.chats || []), ...(chapter >= 3 ? p.later || [] : [])];
    if (k >= pool.length || mine.some((i) => !i.read)) continue;
    if (state.day - lastDay(mine) < (cfg.gapDays ?? 6)) continue;
    const recent = lastDay((state.inbox || []).filter((i) => i.msg?.sender === id));
    if (state.day - recent <= (cfg.quietDays ?? 2)) continue;
    const msgId = `${CASUAL_PREFIX}${id}_${k}`;
    if (state.limeRead.includes(msgId)) continue;
    out.push({ last: recent, msg: { id: msgId, sender: id, type: "chat", casual: true,
      messages: pool[k].map((line) => typeof line === "string" ? line : { sender: id, ...line }) } });
  }
  return out.sort((a, b) => a.last - b.last).map((c) => c.msg);
}
