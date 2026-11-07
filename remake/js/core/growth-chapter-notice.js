// 章が変わった時の心得の盤の知らせ（SPEC 6.3「章が変わった」・11章の章はじめの再案内・5.2 の組み直しの一言。C10）。
// - 章（周回）ごとに一度だけ、新しい章の日常の最初の朝に「盤に新しいスキルがNつ」と、組み直せる時はその案内を出す。
// - 旧セーブを初めて読んだ章では出さない（組み直しの機会と同じく、初読だけで知らせを作らない）。
// - DOM に触れない。カードの中身を返すだけで、出すのは日常の側（daily/calendar.js）。
import { SKILLS } from "./growth-board-data.js";
import { NODE_BY_ID } from "./growth-board-layout.js";
import { growthEnabled } from "./growth-mode.js";
import { ensureGrowth } from "./growth.js";
import { ringsOpen } from "./growth-board.js";
import { canRespec, cycleOf } from "./growth-respec.js";

const noticeKey = s => `${cycleOf(s)}:${s.chapter || 1}`;
const validNotice = n => !!n && typeof n === "object" && !Array.isArray(n)
  && typeof n.key === "string" && Number.isInteger(n.ring) && n.ring >= 1 && n.ring <= 5;

/** 今の組み直しで戻せるマスがあるか（授業は組み直しで外さない。5.1） */
const respecWorthwhile = (g, s) => canRespec(g, s) && g.nodes.some(id => NODE_BY_ID[id]?.kind !== "lesson");

/**
 * 章はじめの知らせを一度だけ取り出す。出すものが無い時・出し済みの時は null。
 * 戻り値: { skills: 新しく灯せるようになったスキル, opened: 章の範囲が広がったか, respec: 組み直せるか }
 */
export function takeChapterBoardNotice(s) {
  if (!growthEnabled() || !s?.growth || s.phase !== "daily") return null;
  const g = ensureGrowth(s);
  const key = noticeKey(s), ring = ringsOpen(s);
  if (!validNotice(g.chapterNotice)) { g.chapterNotice = { key, ring }; return null; }
  const seen = g.chapterNotice;
  if (seen.key === key) return null;
  g.chapterNotice = { key, ring };
  const skills = SKILLS.filter(k => k.ring > seen.ring && k.ring <= ring);
  const opened = ring > seen.ring, respec = respecWorthwhile(g, s);
  return opened || respec ? { skills, opened, respec } : null;
}

/** 知らせのカード（ui.js の gainCard にそのまま渡す形） */
export function chapterBoardCards(notice) {
  if (!notice) return [];
  const cards = [];
  const where = "灯すのは、静かな場所で振り返った時";
  if (notice.opened) cards.push(notice.skills.length
    ? { kind: "info", badge: "盤", top: "NEW SKILL", main: `盤に新しいスキルが${notice.skills.length}つ`, sub: notice.skills.map(k => k.name).join("・"), fx: where }
    : { kind: "info", badge: "盤", top: "BOARD", main: "心得の盤の結界が解けた", sub: "新しい道の先まで灯せる", fx: where });
  if (notice.respec) cards.push({ kind: "info", badge: "盤", top: "REBUILD", main: "今なら盤を組み直せる",
    sub: "最初の自由行動か、日付が変わるまで", fx: "灯した火種が戻る（授業はそのまま）。メニューの盤から" });
  return cards;
}

/** 地図の右下の案内に添える一言（5.2 の帯の代わり。上の帯はピンと重なる）。組み直しが開いている間だけ */
export function respecMapNotice(s) {
  if (!growthEnabled() || !s?.growth) return "";
  return respecWorthwhile(ensureGrowth(s), s) ? "心得の盤の組み直しは、最初の行動まで" : "";
}
