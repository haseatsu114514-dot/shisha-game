// 朝のLIMEの塩梅（2026-11-12 LM08〜LM11）。本番の phone.js・lime-pacing.js・romance.js・bonds.js・casual-lime.js をそのまま読み、
// 人づきあいの多い進行で何日も朝を進めて、届きすぎず・偏らず・静かな朝が続かないことを確かめる。
// node remake/test/lime_pacing.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

const stub = () => ({ style: {}, classList: { add() {}, remove() {} }, append() {}, setAttribute() {}, addEventListener() {}, remove() {}, replaceChildren() {} });
globalThis.document ||= { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, createElement: stub,
  body: { append() {}, classList: { add() {}, remove() {} } }, documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, dataset: {} } };
globalThis.window ||= globalThis;
const storage = new Map();
globalThis.localStorage ||= { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };

const core = await import("../js/core/state.js");
const { DB } = await import("../js/core/data.js");
const stats = await import("../js/core/stats.js");
const growth = await import("../js/core/growth.js");
const json = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const lime = json("../../data/lime_messages.json");
DB.lime = lime.messages; DB.limeTemplates = lime.templates;
DB.lover = json("../data/lover.json"); DB.friends = json("../data/friends.json"); DB.casualLime = json("../data/casual_lime.json");
for (const c of json("../../data/characters.json")) DB.characters[c.id] = c;
DB.manifest = { limeMedia: json("../data/lime_media.json") };
const phone = await import("../js/daily/phone.js");
const pacing = await import("../js/daily/lime-pacing.js");
const { LIME_PACING } = pacing;
const PTS = stats.AFFINITY_RANK_PTS;
const byId = (id) => DB.lime.find((m) => m.id === id);

// ---------------------------------------------------------------- 連絡の種類（LM08）
{
  const cls = (id) => pacing.storyPaceClass(byId(id));
  // 物語の誘い・噂・交換した翌朝の最初の一通は必ず届く
  for (const id of ["lime_naru_day3", "lime_outing_naru_1", "lime_minto_bond_finale", "rumor_cigarman_urban_legend", "rumor_minto_late_night", "lime_kumicho_first", "L01", "L21"]) assert.equal(cls(id), "must", id);
  // 章の◯日目の連絡・章が始まって◯日目からの連絡
  for (const id of ["lime_minto_day5", "lime_kumicho_day9", "lime_ch4_tsumugi_counter", "lime_ch5_saku_title", "L07"]) assert.equal(cls(id), "timed", id);
  // 場面を読んだ・外出した後の続き
  for (const id of ["lime_kumicho_tools", "lime_rei_lie", "lime_after_outing_naru", "lime_samechan_after_seat", "lime_mashiro_glass_cloth"]) assert.equal(cls(id), "react", id);
  // 交換の印だけ・♥だけで届く雑談
  for (const id of ["L02", "L09", "L16", "L22", "L30", "lime_kumicho_holiday", "lime_adam_bond_a", "lime_wang_02", "lime_wang_05"]) assert.equal(cls(id), "ambient", id);
  for (const m of DB.lime) assert(["must", "timed", "react", "ambient"].includes(pacing.storyPaceClass(m)), m.id);
  assert.equal(pacing.storyPaceClass(DB.limeTemplates.sumi_baito), "work");
  assert.equal(pacing.storyPaceClass(DB.limeTemplates.mukai_baito), "work");
  console.log("[LM08] PASS story LIME classes: must / timed / react / ambient / work");
}

// ---------------------------------------------------------------- 朝を何日も進める道具
const needsReply = (m) => m.type === "invitation" || !!m.replies?.length;
/** 届いた1通の種類（phone.js の morningMessages が候補に付けるのと同じ分け方） */
const kindOf = (m) => pacing.isWorkInvite(m) ? "work"
  : m.lover ? (String(m.id).startsWith("_lover_morning_") ? "ambient" : "must")
  : m.friend || m.casual || m.accept_event === "__hiyori_shop__" ? "ambient"
  : m.origin_id ? "must" : pacing.storyPaceClass(m);
const ambientLike = (m) => kindOf(m) === "ambient";
const optional = (row) => row.filter((m) => !["must", "work"].includes(kindOf(m)));
const contact = (s, ...ids) => { for (const id of ids) { if (!s.contacts.includes(id)) s.contacts.push(id); s.flags[`_lime_contact_${id}`] = true; s.met[id] = true; } };
const level = (s, map) => { for (const [id, n] of Object.entries(map)) s.affinity[id] = PTS[n]; };
const friend = (s, day, ...ids) => { for (const id of ids) { s.finales[id] = { route: "friend", day, chapter: s.chapter }; s.affinity[id] = PTS[5]; s.owned.push(`suyaki_${id}`); } };
const lover = (s, since, ...ids) => { for (const id of ids) { s.lovers.push(id); s.loverSince[id] = since; s.loveLevel[id] = 2; s.limeRead.push(`_lover_private_account_${id}`); s.finales[id] = { route: "lover", day: since }; } };
const outingsDone = (s) => { for (const m of DB.lime) if (/^lime_outing_/.test(m.id)) s.flags[`_invited_${m.id}`] = true; };

/** 毎朝すべて読んで返事をする人として進める。戻り値=朝ごとの届いた連絡 */
function run({ chapter, startDay, days, setup, perDay = () => {}, opts = () => ({}), read = () => true }) {
  const s = core.newGame();
  Object.assign(s, { chapter, phase: "daily", day: startDay, slot: 0, money: 99999, weatherSeed: 0, seed: 1 });
  s.flags._lime_tut = 1;
  setup(s);
  const rows = [];
  for (let i = 0; i < days; i++) {
    s.day = startDay + i; s.slot = 0;
    perDay(s, i + 1);
    const before = s.inbox.length;
    phone.deliverMorning({ fixedNight: () => false, ...opts(s, i + 1) });
    const got = s.inbox.slice(before);
    for (const item of got) {
      if (!read(s, item)) continue;
      item.read = true; item.done = true; item.replyState = needsReply(item.msg) ? "replied" : "none";
      if (!s.limeRead.includes(item.msg.id)) s.limeRead.push(item.msg.id);
      if (item.msg.type === "invitation") { item.result = "declined"; s.flags[`_invited_${item.originId}`] = true; }
    }
    rows.push(got.map((item) => item.msg));
  }
  return { rows, state: s };
}
const counted = (row) => row.filter((m) => !pacing.isWorkInvite(m));
const longestRun = (rows, pred) => { let best = 0, cur = 0; for (const r of rows) { cur = pred(r) ? cur + 1 : 0; best = Math.max(best, cur); } return best; };

/** どの進行でも守る決まり */
function checkRules(name, rows) {
  rows.forEach((row, i) => {
    const day = `${name} ${i + 1}日目`;
    assert(row.length <= LIME_PACING.hardCap, `${day}: 朝に${LIME_PACING.hardCap}通まで（${row.map((m) => m.id)}）`);
    assert.equal(new Set(row.map((m) => m.sender)).size, row.length, `${day}: 同じ相手からは1朝1話題`);
    // softCap 通を超えるのは、必ず届く連絡が重なった朝だけ
    if (counted(row).length > LIME_PACING.softCap) assert.equal(optional(row).length, 0, `${day}: 3通目は必ず届く連絡だけ（${row.map((m) => m.id)}）`);
    // にぎやかな朝の次は、必ず届く連絡のほかは afterBusyCap 通まで（章の◯日目の連絡は、枠が空いていれば別に届く）
    if (i > 0 && counted(rows[i - 1]).length >= LIME_PACING.softCap) {
      const waited = optional(row).filter((m) => m.trigger_condition !== "lime_exchanged");
      assert(waited.length <= LIME_PACING.afterBusyCap, `${day}: にぎやかな朝の翌朝は控えめ（${row.map((m) => m.id)}）`);
    }
    // 返事の要る雑談は、返事の要る連絡の後から重ねない
    const replyChats = row.filter((m) => ambientLike(m) && m.replies?.length);
    assert(replyChats.length <= 1, `${day}: 返事の要る雑談は朝に1通まで`);
  });
  // ふだんの雑談は、同じ人から続けて届かない（恋人で2日、ほかは3日以上あける）
  const last = new Map();
  rows.forEach((row, i) => { for (const m of row.filter(ambientLike)) {
    if (last.has(m.sender)) assert(i - last.get(m.sender) >= LIME_PACING.gapDays.lover, `${name}: ${m.sender} の雑談が${i - last.get(m.sender)}日で続いた（${m.id}）`);
    last.set(m.sender, i);
  } });
}

// ---------------------------------------------------------------- 第2章: 第1章の6人と仲が良く（友人2・恋人1）、新しい4人にも通う
{
  const { rows } = run({ chapter: 2, startDay: 15, days: 13,
    setup: (s) => {
      Object.assign(s.flags, { _ch2_day1: { startDay: 15 }, _elapsed_calendar: true, _ch2_region: "home" });
      contact(s, "sumi", "minto", "naru", "tsumugi", "rio", "adam");
      level(s, { sumi: 4, minto: 4, rio: 3 });
      friend(s, 12, "naru", "adam"); lover(s, 11, "tsumugi"); outingsDone(s);
      s.limeRead.push(...DB.lime.filter((m) => !m.chapter && m.trigger_condition === "lime_exchanged").map((m) => m.id));
      s.lastBaitoDay = 15;
    },
    perDay: (s, d) => {
      if (d >= 2) contact(s, "ageha"); if (d >= 3) contact(s, "kumicho"); if (d >= 4) contact(s, "rei"); if (d >= 5) contact(s, "samechan");
      level(s, { ageha: Math.min(4, Math.floor(d / 3)), kumicho: Math.min(4, Math.floor((d - 1) / 3)), rei: Math.min(4, Math.floor((d - 2) / 3)), samechan: Math.min(3, Math.floor((d - 3) / 3)) });
      if (d >= 4) s.flags._ch2_read_ch2_kumicho_third = true;
      if (d >= 6) s.flags._ch2_read_ch2_rei_third = true;
      if (d >= 8) Object.assign(s.flags, { _ch2_read_ch2_kumicho_fifth: true, _ch2_read_ch2_rei_fourth: true });
      if (d >= 10) Object.assign(s.flags, { _ch2_read_ch2_kumicho_sixth: true, _ch2_read_ch2_rei_fifth: true });
      s.lastBaitoDay = s.day - (d % 3);
    } });
  checkRules("第2章", rows);
  const all = rows.flat(), ids = all.map((m) => m.id);
  // 旧: 13日で37通・3通の朝が12日続いた。新: 1日2通を超えない
  assert(counted(all).length <= 13 * LIME_PACING.softCap, `第2章: 13日で${counted(all).length}通`);
  assert.equal(longestRun(rows, (r) => counted(r).length >= 3), 0, "第2章: 3通の朝は無い");
  assert(longestRun(rows, (r) => !r.length) <= 1, "第2章: 何も届かない朝は続かない");
  // 店で話を読んだ後の続きは、にぎやかな時期でも届く（日付の雑談より先）
  for (const id of ["lime_kumicho_tools", "lime_kumicho_young", "lime_kumicho_cup", "lime_rei_bond_a", "lime_rei_smile", "lime_rei_mix"]) assert(ids.includes(id), `第2章: ${id} が届く`);
  // 噂（物語の伏線）と、交換した翌朝の最初の一通は必ず届く
  for (const id of ["rumor_kemuri_experiments", "rumor_kumicho_cigarman", "lime_kumicho_first", "lime_rei_first"]) assert(ids.includes(id), `第2章: ${id} が届く`);
  // 恋人の朝のひとこと・デートの誘いも、物語の連絡に埋もれない
  assert(all.some((m) => m.lover && m.sender === "tsumugi"), "第2章: 恋人からも届く");
  console.log(`[LM08] PASS chapter 2, many contacts: ${counted(all).length} LIME in 13 days, never 3 in a morning, story follow-ups and rumors all arrive`);
}

// ---------------------------------------------------------------- 第3章の東京: 地元の10人＋東京の3人と交換していく
{
  const setup = (s) => {
    Object.assign(s.flags, { _ch3_intro: { startDay: 43, stage: 3, titleSeen: true, routeVersion: 3 }, _elapsed_calendar: true, _ch2_region: "tokyo" });
    contact(s, "sumi", "minto", "naru", "tsumugi", "rio", "adam", "ageha", "kumicho", "rei", "samechan");
    level(s, { sumi: 3, minto: 4, rio: 3, ageha: 4, samechan: 3 });
    friend(s, 12, "naru", "adam"); friend(s, 26, "kumicho", "rei"); lover(s, 11, "tsumugi"); outingsDone(s);
    s.limeRead.push("L21", "L22", "L39"); // スミさんの♥1の一言は読み終え、♥2〜3の分（L23ほか）が残っている
  };
  const perDay = (s, d) => {
    if (d >= 3) contact(s, "saku"); if (d >= 4) contact(s, "steve"); if (d >= 6) contact(s, "volk");
    level(s, { saku: Math.min(4, Math.floor(d / 3)), steve: Math.min(4, Math.floor((d - 1) / 3)), volk: Math.min(3, Math.floor((d - 3) / 3)) });
  };
  const { rows, state } = run({ chapter: 3, startDay: 43, days: 13, setup, perDay, opts: () => ({ invitations: false }) });
  checkRules("第3章の東京", rows);
  const all = rows.flat();
  const perSender = {};
  for (const m of all) perSender[m.sender] = (perSender[m.sender] || 0) + 1;
  // 旧: ヴォルクから8日続けて届いた。新: 同じ人に偏らず、いろんな人から届く
  for (const id of ["volk", "steve", "saku"]) assert(perSender[id] >= 2 && perSender[id] <= 4, `第3章: ${id} から${perSender[id]}通`);
  assert(Object.keys(perSender).length >= 8, `第3章: ${Object.keys(perSender).length}人から届く（${JSON.stringify(perSender)}）`);
  assert(longestRun(rows, (r) => !r.length) <= 1, "第3章: 何も届かない朝は続かない");
  assert(all.filter(needsReply).length <= 13 * 1.5, `第3章: 返事の要る連絡は1日1.5通まで（${all.filter(needsReply).length}通）`);
  // 交換した翌朝の最初の一通（届いたか、の確認）は必ず届く
  for (const id of ["L01", "L08", "L15"]) assert(all.some((m) => m.id === id), `第3章: ${id} が届く`);
  // 届かなかった雑談は消えず、後の朝に回る（いつでも読める話題）
  assert(DB.lime.some((m) => m.sender === "volk" && !m.chapter && !state.limeRead.includes(m.id)), "第3章: ヴォルクの雑談は後の章へ残る");
  // LM10: スミさんの♥で開く一言は店で顔を合わせている前提なので、東京では届かない。地元へ帰ると届く
  const sumiNotes = (list) => list.filter((m) => m.sender === "sumi" && byId(m.id)?.trigger_condition === "affinity_level");
  assert.equal(sumiNotes(all).length, 0, "第3章: スミさんの店の一言は東京では届かない");
  Object.assign(state, { chapter: 4, day: 56 });
  Object.assign(state.flags, { _ch2_region: "home", _ch4_prep: { startDay: 56, days: 3, step: 0, departed: false }, _ch4: { startDay: 59, day: 1, stage: 0, part: "prologue", read: {} } });
  const home = [];
  for (let day = 56; day <= 58; day++) {
    state.day = day;
    const before = state.inbox.length;
    phone.deliverMorning({ fixedNight: () => false });
    for (const item of state.inbox.slice(before)) { item.read = true; item.done = true; state.limeRead.push(item.msg.id); home.push(item.msg); }
  }
  assert(sumiNotes(home).length >= 1, `地元へ帰るとスミさんの一言が届く（${home.map((m) => m.id)}）`);
  console.log(`[LM08][LM10] PASS Tokyo with 13 contacts: ${all.length} LIME from ${Object.keys(perSender).length} people in 13 days, nobody more than 4, sumi's shop notes wait for home`);
}

// ---------------------------------------------------------------- 人づきあいの少ない進行でも、静かな朝は続かない（LM08 決まり6）
{
  const { rows } = run({ chapter: 2, startDay: 15, days: 13,
    setup: (s) => {
      Object.assign(s.flags, { _ch2_day1: { startDay: 15 }, _elapsed_calendar: true, _ch2_region: "home" });
      contact(s, "sumi", "naru"); level(s, { sumi: 3, naru: 1 }); outingsDone(s);
      s.limeRead.push(...DB.lime.filter((m) => m.trigger_condition === "lime_exchanged" || m.type === "rumor").map((m) => m.id));
      s.lastBaitoDay = 15;
    }, perDay: (s, d) => { s.lastBaitoDay = s.day - (d % 3); } });
  checkRulesQuiet(rows);
  console.log("[LM08] PASS few contacts: something arrives at least every other morning while a topic is left, never two in a row from the same person");
}
function checkRulesQuiet(rows) {
  const notes = rows.flat().filter((m) => m.sender === "sumi");
  assert(notes.length >= 5, `スミさんの一言が届く（${notes.length}通）`);
  // 話題が残っている間は、何も届かない朝が2日続かない。同じ人から連日は届かない
  const lastWithTopic = rows.findLastIndex((r) => r.length);
  assert(longestRun(rows.slice(0, lastWithTopic + 1), (r) => !r.length) <= 1, `静かな朝は続かない（${rows.map((r) => r.length)}）`);
  assert.equal(longestRun(rows, (r) => r.some((m) => m.sender === "sumi")), 1, `スミさんから連日は届かない（${rows.map((r) => r.length)}）`);
}

// ---------------------------------------------------------------- 読まずにためている間は、ふだんの雑談が積み上がらない（LM08 決まり4）
{
  const setup = (s) => {
    Object.assign(s.flags, { _ch3_intro: { startDay: 43, stage: 3, titleSeen: true, routeVersion: 3 }, _elapsed_calendar: true, _ch2_region: "tokyo" });
    contact(s, "saku", "steve", "volk", "minto", "rio", "adam", "ageha"); level(s, { saku: 3, steve: 3, volk: 3, minto: 3, rio: 3, adam: 3, ageha: 3 }); outingsDone(s);
    s.limeRead.push(...DB.lime.filter((m) => m.type === "rumor").map((m) => m.id));
  };
  const { rows, state } = run({ chapter: 3, startDay: 43, days: 10, setup, opts: () => ({ invitations: false }), read: () => false });
  const unread = state.inbox.filter((item) => !item.read);
  assert(unread.filter((item) => ambientLike(item.msg)).length <= LIME_PACING.backlog, `読まない間、雑談は${LIME_PACING.backlog}通までしかたまらない（${unread.map((i) => i.msg.id)}）`);
  assert(rows.slice(-3).every((r) => !r.some(ambientLike)), "未読がたまった後の朝は雑談が届かない");
  // たまった分を読むと、また届く
  for (const item of unread) { item.read = true; item.done = true; state.limeRead.push(item.msg.id); }
  state.day += 1;
  assert(phone.morningMessages({ fixedNight: () => false, invitations: false }).length >= 1, "読むと、また届く");
  console.log("[LM08] PASS unread backlog: small talk stops piling up at 3 unread and resumes once read");
}

// ---------------------------------------------------------------- 恋人の朝のひとことは、朝の枠が埋まった日に消えず次の朝へ回る（LM09）
{
  const { rows } = run({ chapter: 2, startDay: 15, days: 13,
    setup: (s) => {
      Object.assign(s.flags, { _ch2_day1: { startDay: 15 }, _elapsed_calendar: true, _ch2_region: "tokyo" }); // デートの誘いが出ない街で、朝のひとことだけを見る
      contact(s, "tsumugi", "kumicho", "rei", "ageha"); lover(s, 11, "tsumugi"); outingsDone(s);
      level(s, { kumicho: 3, rei: 3, ageha: 3 });
    } });
  const notes = rows.map((r, i) => r.some((m) => String(m.id).startsWith("_lover_morning_tsumugi")) ? i : -1).filter((i) => i >= 0);
  assert(notes.length >= 3, `恋人の朝のひとことが13日で${notes.length}通`);
  for (let i = 1; i < notes.length; i++) assert(notes[i] - notes[i - 1] >= 3, `朝のひとことは3日あける（${notes}）`);
  console.log(`[LM09] PASS lover morning notes survive busy mornings: ${notes.length} notes in 13 days, at least 3 days apart`);
}

// ---------------------------------------------------------------- 絆の深い相手からの誘いは、経験値が減らず多く入る（LM11）
{
  const s = core.newGame();
  Object.assign(s, { chapter: 1, phase: "daily", day: 5 });
  s.lovers.push("tsumugi"); s.finales.naru = { route: "friend", day: 3 };
  assert.equal(pacing.bondInvitation("date_tsumugi", "tsumugi"), true, "恋人のデート");
  assert.equal(pacing.bondInvitation("friend_naru", "naru"), true, "締めくくりを読んだ友人のお誘い");
  assert.equal(pacing.bondInvitation("outing_adam_1", "adam"), false, "締めくくり前の相手");
  s.finales.sumi = { route: "friend", day: 3 };
  assert.equal(pacing.bondInvitation("__sumi_baito__", "sumi"), false, "仕事の連絡は別");
  if (growth.growthEnabled()) {
    const base = growth.EXP.action;
    // 同じ相手の店に5回通うと、6回目の行動は「なじみ」で減る
    for (let i = 0; i < 5; i++) growth.awardActionExp({ key: "naru", person: "naru" });
    const before = s.growth.xp;
    const usual = growth.awardActionExp({ key: "naru", person: "naru" });
    assert.equal(usual, Math.round(base * growth.freshness(6)), "通い詰めた相手の行動は減る");
    const count = s.growth.fresh.counts.naru;
    const bond = growth.awardActionExp({ key: "naru", person: "naru", bond: true });
    assert.equal(bond, Math.round(base * growth.BOND_INVITE_MULT), "絆の深い相手からの誘いは減らず、多く入る");
    assert(bond > base && bond > usual * 3, `ふだんの行動より多い（${bond} / ${usual}）`);
    assert.equal(s.growth.fresh.counts.naru, count, "誘いは、店へ通う回数に数えない");
    assert.equal(s.growth.xp, before + usual + bond);
  }
  const calendar = fs.readFileSync(new URL("../js/daily/calendar.js", import.meta.url), "utf8");
  assert.match(calendar, /bond: bondInvitation\(inv\.event, inv\.sender\)/, "誘いの精算が絆の印を渡す");
  console.log("[LM11] PASS invitations from lovers and finale friends: no freshness decay, x1.5 EXP, not counted as a shop visit");
}
console.log("[lime pacing] PASS");
