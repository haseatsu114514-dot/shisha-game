// 接続済みの対面会話だけを段階にする。保存値を削ったり、未読を既読に補完しない。
export const VISIT_SEQ = {
  sumi: ["ch1_sumi_tutorial", "ch1_sumi_basics", "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final"],
  tsumugi: ["ch1_tsumugi_first", "ch1_tsumugi_second", "ch1_tsumugi_third", "ch1_tsumugi_fourth", "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color"],
  naru: ["ch1_naru_first", "ch1_naru_second", "ch1_naru_third", "ch1_naru_group_regulars", "ch1_naru_fourth", "ch1_naru_fifth"],
  adam: ["ch1_adam_first", "ch1_adam_second", "ch1_adam_group_soutoku", "ch1_adam_third", "ch1_adam_fourth", "ch1_adam_fifth"],
  minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_group_regulars", "ch1_minto_fourth", "ch1_minto_phantom_smell"],
  rio: ["ch1_rio_first", "ch1_rio_second", "ch1_rio_third", "ch1_rio_fourth", "ch1_rio_fifth", "ch1_rio_sixth"],
};

// ♥2〜♥5。最後の白・赤のグミベアの試作（#2023）は味の会話を兼ねる。
export const AGEHA_AFFINITY_VISITS = ["remake_ch2_ageha_gyaru", "remake_ch2_ageha_newcomer", "remake_ch2_ageha_magazine", "remake_ch2_ageha_gummy"];
// 第2章の神崎・クラウドの通常訪問列（#1648）。初回chatの後、必要ハートに届いた最古の未読を一訪問一本読む。
// 短い続編・再訪は既存の保存フラグ、長い段階会話は `_ch2_read_<scene>` で既読を持つ。
const ch2Story = (file, scene, heart) => ({ file, scene, heart });
export const CH2_VISIT_STORIES = {
  kumicho: [
    { scene: "remake_ch2_kumicho_followup", heart: 1, done: "_ch2_followup_done" },
    ch2Story("ch2_kumicho", "ch2_kumicho_first", 1),
    ch2Story("ch2_kumicho", "ch2_kumicho_second", 1),
    { scene: "remake_ch2_kumicho_revisit", heart: 2, done: "_ch2_revisit_done" },
    ch2Story("ch2_kumicho", "ch2_kumicho_third", 2),
    // 「味は遠い」はDAY5夜の味の不調（_ch2_taste_distant）が前提。♥3が先に届いても、その後まではrepeat（#2720）。
    { ...ch2Story("ch2_kumicho", "ch2_kumicho_fourth", 3), after: "_ch2_taste_distant" },
    ch2Story("ch2_kumicho", "ch2_kumicho_fifth", 4),
    ch2Story("ch2_kumicho", "ch2_kumicho_sixth", 5),
  ],
  // 準備期間（DAY2〜13）に締めくくりまで届くよう、クラウドの「嘘」の相談を♥4に置く（#2027）。
  rei: [
    { scene: "remake_ch2_rei_followup", heart: 1, done: "_ch2_followup_done" },
    ch2Story("ch2_rei", "ch2_rei_first", 1),
    ch2Story("ch2_rei", "ch2_rei_second", 1),
    { scene: "remake_ch2_rei_revisit", heart: 2, done: "_ch2_revisit_done" },
    ch2Story("ch2_rei", "ch2_rei_third", 2),
    // 常連の集まりとライブの余りチケット（#2026）。「同士だ」の後、前夜の場面の _ch2_rei_ticket 分岐より前に読める位置。
    ch2Story("ch2_rei", "ch2_rei_group_concert_prep", 2),
    ch2Story("ch2_rei", "ch2_rei_fourth", 3),
    ch2Story("ch2_rei", "ch2_rei_fifth", 4),
    ch2Story("ch2_rei", "ch2_rei_sixth", 5),
  ],
};
/** 第2章の訪問列をすべて読んだか（締めくくりの前提）。 */
export const ch2VisitStoriesDone = (flags, id) => !!CH2_VISIT_STORIES[id]?.every(entry => ch2VisitDone(flags, id, entry));
export const ch2VisitDone = (flags, id, entry) => entry.done ? !!flags?.[entry.done]?.[id] : !!flags?.[`_ch2_read_${entry.scene}`];
/** 段階の前提になる物語の出来事（after）を読んだか。DAY6以降はフラグの無い旧セーブでも通す。 */
export const ch2VisitReady = (flags, entry, chapterDay) => !entry.after || !!flags?.[entry.after] || chapterDay > 5;
// 第3章のましろ（#2022）。mukaiの寄り道（任意場面）を選んで読んだ分だけ段階にする。
// 既読は ch3-story-wiring.js の optionalReadFlag（`_ch3_read_<scene>`）。♥3の質問は練習の後、締めくくりは全段階の後。
export const MASHIRO_AFFINITY_SCENES = ["ch3_mashiro_play_1", "ch3_mashiro_play_2", "ch3_mashiro_practice", "ch3_mashiro_play_3", "ch3_mashiro_black_tea"];
export const mashiroScenesRead = flags => MASHIRO_AFFINITY_SCENES.every(scene => !!flags?.[`_ch3_read_${scene}`]);
// 第4章の王煙楼（2026-11-02 オーナー「マスターフーカーの店に行けたり」「普通に他の章のライバルと同じ扱い」）。
// 龍龍水煙所のドバイの店（DAY1〜12）。必要ハートに届いた最古の未読を一訪問一本読み、5本で♥5に届く。
// 既読は flags._ch4_longlong.read（chapters/ch4-longlong.js）。
export const LONGLONG_VISIT_STORIES = Object.freeze([
  { scene: "ch4_longlong_first", heart: 0 },
  { scene: "ch4_longlong_second", heart: 1 },
  { scene: "ch4_longlong_third", heart: 2 },
  { scene: "ch4_longlong_fourth", heart: 3 },
  { scene: "ch4_longlong_fifth", heart: 4 },
].map(entry => Object.freeze(entry)));
export const longlongStoryRead = (flags, scene) => flags?._ch4_longlong?.read?.[scene] === true;
// 第4・5章ドバイの太陽・シェイク（2026-11-11 オーナー「ルートを新設」RVE03。chapters/dubai-bonds.js）。
// 太陽は第4章のFESTAで段階1〜3（prelude: FESTAは第4章だけなので締めくくりの前提にしない）、第5章の屋敷の中庭で段階4・5。
// シェイクは第5章の屋敷で段階1〜5。既読は flags._dubai_bonds.read。
export const DUBAI_BOND_FLAG = "_dubai_bonds";
export const DUBAI_BOND_STORIES = Object.freeze({
  da_silva: Object.freeze([
    { scene: "ch4_festa_bond_1", heart: 1, where: "festa", prelude: true },
    { scene: "ch4_festa_bond_2", heart: 2, where: "festa", prelude: true },
    { scene: "ch4_festa_bond_3", heart: 3, where: "festa", prelude: true },
    { scene: "ch5_taiyo_bond_4", heart: 2, where: "courtyard" },
    { scene: "ch5_taiyo_bond_5", heart: 3, where: "courtyard" },
  ].map(entry => Object.freeze(entry))),
  sheikh: Object.freeze([
    { scene: "ch5_sheikh_bond_1", heart: 1, where: "residence" },
    { scene: "ch5_sheikh_bond_2", heart: 1, where: "residence" },
    { scene: "ch5_sheikh_bond_3", heart: 2, where: "residence" },
    { scene: "ch5_sheikh_bond_4", heart: 3, where: "residence" },
    { scene: "ch5_sheikh_bond_5", heart: 4, where: "residence" },
  ].map(entry => Object.freeze(entry))),
});
const dubaiBondStoryRead = (flags, scene) => flags?.[DUBAI_BOND_FLAG]?.read?.[scene] === true;
// 質問済みフラグの保存キーは id から機械的に導出する（第1章の形式）。
// 既存IDは保存互換のため改名せず、旧文字列を使う相手だけ下の対応表で返す（#2035）。
const LEGACY_QUESTION_DONE_KEYS = { samechan: "_samechan_bond_question_done" };
export const questionDoneKey = id => LEGACY_QUESTION_DONE_KEYS[id] || `_${id}_affinity_question_done`;
const settled = (s, id) => !!s.finales?.[id] || !!s.flags?.[`_friend_${id}`] || (s.lovers || []).includes(id);
// サメちゃんの♥4・♥5の来店会話（#2025）。♥3の問いかけの後、締めくくりの前に一本ずつ読む。
// 締めくくり・友人・恋人へ着地済みの旧セーブには後から出さず、読んだものとして扱う。
export const SAMECHAN_HEART_EVENTS = [
  { dialogue: "samechan_shop_heart4", flag: "_samechan_heart4_done", heart: 4 },
  { dialogue: "samechan_shop_heart5", flag: "_samechan_heart5_done", heart: 5 },
];
export const samechanHeartEventDone = (s, event) => settled(s, "samechan") || !!s.flags?.[event.flag];
export const samechanHeartEventsDone = s => SAMECHAN_HEART_EVENTS.every(event => samechanHeartEventDone(s, event));
// 凛想の♥4・♥5（#2025）。後から足した段階なので、締めくくり・友人・恋人へ着地済みの旧セーブには出さず、読んだものとして扱う。
export const RIO_LATE_STORIES = ["ch1_rio_fifth", "ch1_rio_sixth"];
export const visitStorySkipped = (s, id, scene) => id === "rio" && RIO_LATE_STORIES.includes(scene) && settled(s, id);
export function questionComplete(s, id) {
  return settled(s, id) || !!s.flags?.[questionDoneKey(id)];
}

/** 最初の未完段階。0は初対面、1〜5はそのハートで読める既存会話。存在しない段階は作らない。 */
export function pendingAffinityStage(s, id, db = {}) {
  const stages = [];
  const flags = s.flags || {};
  const seq = id === "sumi" ? null : VISIT_SEQ[id];
  if (seq) seq.forEach((scene, level) => stages.push({ level, scene, done: (s.story?.[id] || 0) > level || visitStorySkipped(s, id, scene) }));
  if (["tsumugi", "minto", "rio"].includes(id)) stages.push({ level: 3, scene: `ch1_${id}_bond_question`, done: questionComplete(s, id) });
  if (id === "samechan") stages.push(
    { level: 0, done: !!flags._samechan_first_encounter },
    { level: 1, done: (s.story?.samechan || 0) > 0 },
    { level: 2, done: !!flags._samechan_quiet_seat_done },
    { level: 3, done: !!flags._samechan_closing_check_done && questionComplete(s, id) },
    ...SAMECHAN_HEART_EVENTS.map(event => ({ level: event.heart, scene: event.dialogue, done: samechanHeartEventDone(s, event) })),
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
    // ♥4・♥5（untilFinale）は締めくくり前の段階。着地済みの関係では残件にしない。
    for (const e of required) {
      const skipped = !!e.lateAdded && ((e.skipIf || []).some(flag => !!flags[flag]) || settled(s, id));
      stages.push({ level: levelOf(e), scene: e.dialogue, done: !!flags[e.flag] || !!e.untilFinale && settled(s, id) || skipped });
    }
    if (route.question?.flag) stages.push({ level: Math.max(3, levelOf(events.find(e => e.dialogue === route.question.host))), scene: route.question.dialogue, done: settled(s, id) || !!flags[route.question.flag] });
  }
  if (id === "master_hookah") LONGLONG_VISIT_STORIES.forEach(entry => stages.push({ level: entry.heart, scene: entry.scene, done: longlongStoryRead(flags, entry.scene) }));
  // 太陽のFESTAの段階は第4章の間だけ、屋敷の段階は第5章だけを残件にする（読めない章で「次の会話」を約束しない）。
  // 締めくくり・友人に着地した後は残件にしない。
  if (DUBAI_BOND_STORIES[id]) DUBAI_BOND_STORIES[id].forEach(entry => stages.push({ level: entry.heart, scene: entry.scene,
    done: dubaiBondStoryRead(flags, entry.scene) || settled(s, id)
      || (entry.where === "festa" ? (s.chapter || 1) !== 4 : (s.chapter || 1) !== 5) }));
  if (id === "mashiro") {
    MASHIRO_AFFINITY_SCENES.forEach((scene, level) => stages.push({ level, scene, done: !!flags[`_ch3_read_${scene}`] }));
    stages.push({ level: 3, scene: "ch3_mashiro_bond_question", done: questionComplete(s, id) });
  }
  if (["ageha", "kumicho", "rei"].includes(id)) {
    stages.push({ level: 0, done: !!flags._ch2_talks?.[id] });
    if (CH2_VISIT_STORIES[id]) CH2_VISIT_STORIES[id].forEach(entry => stages.push({ level: entry.heart, scene: entry.scene, done: ch2VisitDone(flags, id, entry) }));
    else stages.push({ level: 1, done: !!flags._ch2_followup_done?.[id] });
    if (id === "ageha") {
      AGEHA_AFFINITY_VISITS.forEach((scene, i) => stages.push({ level: i + 2, scene, done: !!flags[`_ch2_read_${scene}`] }));
      // ♥3の恋愛／友情の質問（#1988）は「初めての客」の直後。回答か着地済みの関係だけを完了とする。
      stages.push({ level: 3, scene: "ch2_ageha_bond_question", done: questionComplete(s, id) });
    }
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
