// 接続済みの対面会話だけを段階にする。保存値を削ったり、未読を既読に補完しない。
export const VISIT_SEQ = {
  sumi: ["ch1_sumi_tutorial", "ch1_sumi_basics", "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final"],
  tsumugi: ["ch1_tsumugi_first", "ch1_tsumugi_second", "ch1_tsumugi_third", "ch1_tsumugi_fourth", "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color"],
  naru: ["ch1_naru_first", "ch1_naru_second", "ch1_naru_third", "ch1_naru_group_regulars", "ch1_naru_fourth", "ch1_naru_fifth"],
  adam: ["ch1_adam_first", "ch1_adam_second", "ch1_adam_group_soutoku", "ch1_adam_third", "ch1_adam_fourth", "ch1_adam_fifth"],
  minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_group_regulars", "ch1_minto_fourth", "ch1_minto_phantom_smell"],
  rin: ["ch1_rin_first", "ch1_rin_second", "ch1_rin_third"],
};

export const AGEHA_AFFINITY_VISITS = ["remake_ch2_ageha_gyaru", "remake_ch2_ageha_newcomer", "remake_ch2_ageha_magazine"];
// 第2章の神崎・REIの通常訪問列（#1648）。初回chatの後、必要ハートに届いた最古の未読を一訪問一本読む。
// 短い続編・再訪は既存の保存フラグ、長い段階会話は `_ch2_read_<scene>` で既読を持つ。
const ch2Story = (file, scene, heart) => ({ file, scene, heart });
export const CH2_VISIT_STORIES = {
  kumicho: [
    { scene: "remake_ch2_kumicho_followup", heart: 1, done: "_ch2_followup_done" },
    ch2Story("ch2_kumicho", "ch2_kumicho_first", 1),
    ch2Story("ch2_kumicho", "ch2_kumicho_second", 1),
    { scene: "remake_ch2_kumicho_revisit", heart: 2, done: "_ch2_revisit_done" },
    ch2Story("ch2_kumicho", "ch2_kumicho_third", 2),
    ch2Story("ch2_kumicho", "ch2_kumicho_fourth", 3),
  ],
  rei: [
    { scene: "remake_ch2_rei_followup", heart: 1, done: "_ch2_followup_done" },
    ch2Story("ch2_rei", "ch2_rei_first", 1),
    ch2Story("ch2_rei", "ch2_rei_second", 1),
    { scene: "remake_ch2_rei_revisit", heart: 2, done: "_ch2_revisit_done" },
    ch2Story("ch2_rei", "ch2_rei_third", 2),
    ch2Story("ch2_rei", "ch2_rei_fourth", 3),
    ch2Story("ch2_rei", "ch2_rei_fifth", 3),
  ],
};
export const ch2VisitDone = (flags, id, entry) => entry.done ? !!flags?.[entry.done]?.[id] : !!flags?.[`_ch2_read_${entry.scene}`];
export const questionDoneKey = id => `_${id}_affinity_question_done`;
const settled = (s, id) => !!s.finales?.[id] || !!s.flags?.[`_friend_${id}`] || (s.lovers || []).includes(id);
export function questionComplete(s, id) {
  return settled(s, id) || !!s.flags?.[id === "samechan" ? "_samechan_bond_question_done" : questionDoneKey(id)];
}

/** 最初の未完段階。0は初対面、1〜5はそのハートで読める既存会話。存在しない段階は作らない。 */
export function pendingAffinityStage(s, id, db = {}) {
  const stages = [];
  const flags = s.flags || {};
  const seq = id === "sumi" ? null : VISIT_SEQ[id];
  if (seq) seq.forEach((scene, level) => stages.push({ level, scene, done: (s.story?.[id] || 0) > level }));
  if (["tsumugi", "minto", "rin"].includes(id)) stages.push({ level: 3, scene: `ch1_${id}_bond_question`, done: questionComplete(s, id) });
  if (id === "samechan") stages.push(
    { level: 0, done: !!flags._samechan_first_encounter },
    { level: 1, done: (s.story?.samechan || 0) > 0 },
    { level: 2, done: !!flags._samechan_quiet_seat_done },
    { level: 3, done: !!flags._samechan_closing_check_done && questionComplete(s, id) },
  );
  if (id === "hiyori" && db.hiyori?.route?.enabled) {
    const route = db.hiyori.route, events = route.events || [];
    const byFlag = new Map(events.map(e => [e.flag, e]));
    // work_talk自身は♥2だが前提のaxe_revealは♥3。前提の最大値まで許さないと詰む。
    const levelOf = (e, seen = new Set()) => {
      if (!e || seen.has(e.id)) return 0;
      const next = new Set(seen).add(e.id);
      return Math.max(e.minAffinity || 0, ...(e.requires || []).map(f => levelOf(byFlag.get(f), next)));
    };
    const required = new Set();
    const include = e => {
      if (!e || required.has(e)) return;
      required.add(e); (e.requires || []).forEach(f => include(byFlag.get(f)));
    };
    (route.storyEvents || []).forEach(id => include(events.find(e => e.id === id)));
    for (const e of required) stages.push({ level: levelOf(e), scene: e.dialogue, done: !!flags[e.flag] });
    if (route.question?.flag) stages.push({ level: Math.max(3, levelOf(events.find(e => e.dialogue === route.question.host))), scene: route.question.dialogue, done: settled(s, id) || !!flags[route.question.flag] });
  }
  if (["ageha", "kumicho", "rei"].includes(id)) {
    stages.push({ level: 0, done: !!flags._ch2_talks?.[id] });
    if (CH2_VISIT_STORIES[id]) CH2_VISIT_STORIES[id].forEach(entry => stages.push({ level: entry.heart, scene: entry.scene, done: ch2VisitDone(flags, id, entry) }));
    else stages.push({ level: 1, done: !!flags._ch2_followup_done?.[id] });
    if (id === "ageha") AGEHA_AFFINITY_VISITS.forEach((scene, i) => stages.push({ level: i + 2, scene, done: !!flags[`_ch2_read_${scene}`] }));
  }
  return stages.filter(e => !e.done).sort((a,b) => a.level - b.level)[0] || null;
}

/** 恋人の絆は普通のハートと別。追加b台本がある段階は両方の実読了が必要。 */
export function pendingLoveStage(s, id, db = {}) {
  // ひより等の未接続プレビューを新しい条件にしない。実装済みの共通ladderだけ。
  const opening = db.dialogues?.[`lover_${id}_lv1`];
  if (!opening?.lines?.length || opening.metadata?.preview_only) return null;
  const seen = s.loverEventsSeen || [];
  for (let level = 1; level <= 5; level++) {
    const base = `lover_${id}_lv${level}`;
    if (!seen.includes(base) || db.dialogues?.[`${base}_b`] && !seen.includes(`${base}_b`)) return level;
  }
  return null;
}
