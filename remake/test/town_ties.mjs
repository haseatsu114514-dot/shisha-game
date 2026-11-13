// REL01〜03・06・07: 街の人同士のつながり（なる→凛想とその第5章の続き、なる→アダム、みんと→サメちゃん、ひより×みんと）の寄り道会話。
// #3468 B案: ひより×みんとの続き（ぺぱーみんとの夜の相席と、次の来店での後日の一言）。
// #3468 E案: なる→凛想の第5章の続き（お茶の場面の後、Dr.fookah の2階での仕入れ相談）。
// 出る条件（面識・順番・一度きり・なるの修行中は出ない・凛想の出張の日は出ない）と、台本の決まりを検査する。
// 相関の正本は brand/character_profiles.md「キャラ同士のつながり」。
// node remake/test/town_ties.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { spotEncounterDue, quietSpotPool, spotFollowupDue, RIO_AWAY_DAY_COPY } from "../js/daily/spot-encounters.js";
import { RIO_AWAY_DAY } from "../js/core/rules.js";

const read = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), "utf8"));
const byId = (file) => Object.fromEntries(read(`../../data/dialogue/${file}.json`).dialogues.map((d) => [d.dialogue_id, d]));
const dialogues = { ...byId("ch1_spots"), ...byId("samechan"), ...byId("ch5_shops"), ...byId("hiyori") };
// 立ち絵はLFSでCIのquickには無いため、表情の一覧はmanifestを正とする。
const portraits = read("../data/manifest.json").portraits;
const AWAY = RIO_AWAY_DAY, IN = RIO_AWAY_DAY + 1;
const save = (over = {}) => ({ slot: 0, chapter: 1, day: IN, met: {}, flags: {}, ...over });
const rift = { _ch2_read_ch2_naru_confrontation: true };

let count = 0;
function check(name, run) {
  try { run(); count++; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}

const SCENES = {
  cafe_naru_rio: { cast: ["naru", "rio"], end: "_spot_seen_cafe_naru_rio" },
  cafe_naru_rio_followup: { cast: ["naru"], end: "_spot_follow_naru_rio" },
  cafe_naru_rio_followup_rio: { cast: ["rio"], end: "_spot_follow_rio_naru" },
  kannon_adam_lunch: { cast: ["adam", "naru"], end: "_spot_seen_kannon_adam_lunch" },
  kannon_adam_lunch_followup: { cast: ["adam"], end: "_spot_follow_adam_lunch" },
  samechan_shop_minto_gift: { cast: ["samechan"], end: null }, // 既読は daily/samechan.js が来店の精算で付ける
  samechan_minto_followup: { cast: ["minto"], end: "_spot_follow_minto_samechan" },
  // 既読は呼び出し側（chapters/ch5-shops.js・daily/hiyori.js）が来店の精算で付ける
  ch5_rio_naru_tea: { cast: ["naru", "rio"], end: null },
  ch5_rio_naru_order: { cast: ["naru", "rio"], end: null },
  hiyori_shop_minto: { cast: ["hiyori", "minto"], end: null },
  hiyori_shop_minto_seat: { cast: ["hiyori", "minto"], end: null },
  hiyori_minto_seat_followup: { cast: ["hiyori", "minto"], end: "_spot_follow_minto_hiyori" },
};

check("the away day copied into spot-encounters.js matches the rule", () => {
  assert.equal(RIO_AWAY_DAY_COPY, RIO_AWAY_DAY);
});

check("every scene exists, keeps the text rules, and marks itself read at the end", () => {
  for (const [id, { cast, end }] of Object.entries(SCENES)) {
    const dlg = dialogues[id];
    assert(dlg?.lines?.length, `${id} is missing`);
    if (end) assert.deepEqual(dlg.lines.at(-1), { type: "set_flag", flag: end }, id);
    const rows = [...dlg.lines, ...Object.values(dlg.branches || {}).flat()].filter((l) => !l.type);
    const speakers = new Set(rows.map((l) => l.speaker).filter(Boolean));
    assert.deepEqual([...speakers].filter((who) => who !== "hajime").sort(), [...cast].sort(), id);
    for (const l of rows) {
      if (l.speaker) assert(portraits[l.speaker].faces.includes(l.face), `${id}: ${l.speaker}/${l.face}`);
      if (l.speaker) assert(!/。）?$/.test(l.text), `${id}: ${l.text}`);
      assert(!l.text.includes("\n"), l.text);
      assert(l.text.length <= 48, `${id} ${l.text.length}: ${l.text}`);
    }
    // 大会の前後どちらで読んでも成り立つよう、大会・日付の話をしない（交流の時系列ルール）。能力の文も埋めない。
    const whole = rows.map((l) => l.text).join("");
    for (const word of ["大会", "優勝", "本番", "明日", "昨日", "上がった", "修行"]) assert(!whole.includes(word), `${id}: ${word}`);
  }
});

check("the secrets stay secret: no age, no confession, and Rio never learns why Naru freezes", () => {
  const text = (id) => [...dialogues[id].lines, ...Object.values(dialogues[id].branches || {}).flat()].map((l) => l.text || "").join("");
  // みんとの実年齢は出さない（同い年だと信じているサメちゃんと、腹話術の一言まで）。
  assert(!/29|二十九|アラサー|年上/.test(text("samechan_shop_minto_gift")));
  assert(text("samechan_shop_minto_gift").includes("同い年"));
  // なるは凛想に何も言わない。凛想の側は「怖がられている」と思ったまま。
  for (const id of ["cafe_naru_rio", "cafe_naru_rio_followup", "cafe_naru_rio_followup_rio"]) assert(!/好き|告白|惚れ/.test(text(id)), id);
  assert(text("cafe_naru_rio_followup_rio").includes("怖いのかな"));
  // 恋人の時だけ、なるは気づいて引く。
  const follow = dialogues.cafe_naru_rio_followup;
  assert.deepEqual(follow.lines[0], { type: "condition", condition_type: "lover", char_id: "rio", next_true: "lover", next_false: "plain" });
  assert(follow.branches.lover.length && follow.branches.plain.length);
  // 第5章の続きも、恋人の時の分岐を持ち、なるは何も言わずに帰る。
  const tea = dialogues.ch5_rio_naru_tea;
  const lovers = tea.lines.filter((l) => l.condition_type === "lover");
  assert.equal(lovers.length, 2, "Naru's parting line and Rio's last line both change for a lover");
  assert(lovers.every((l) => l.char_id === "rio" && tea.branches[l.next_true]?.length));
  assert(!/好き|告白|惚れ/.test(text("ch5_rio_naru_tea")));
  assert(text("ch5_rio_naru_tea").includes("ケムリクサさん") && text("ch5_rio_naru_tea").includes("円頓寺さん"));
});

check("Naru and Rio, the order (#3468 E): names unchanged, Rio never reads it as more than work, Naru says what he needs", () => {
  const dlg = dialogues.ch5_rio_naru_order;
  const rows = dlg.lines.filter((l) => !l.type), all = [...rows, ...Object.values(dlg.branches).flat()];
  const whole = all.map((l) => l.text).join("");
  // 呼び名は変えない（屋号と、敬語の苗字）。好意・恋の進展を思わせる言葉は出さない。旧名・マニキュアの話は持ち込まない
  assert(whole.includes("ケムリクサさん") && whole.includes("円頓寺さん"));
  assert(!/好き|告白|惚れ|憧れ|照れ|赤く|亮太|鳴切|凛想さんって|くゆり|マニキュア|爪/.test(whole));
  assert(all.filter((l) => l.speaker === "naru").every((l) => !/凛想/.test(l.text)), "Naru keeps calling her by her family name");
  // 凛想が覚えていたのは仕事の記録（焼き菓子の台・焦げ）。なるは伝票をそろえかけて止め、自分の条件を先に言う
  const remember = rows.findIndex((l) => l.speaker === "rio" && l.text.includes("焦げた砂糖"));
  const stop = rows.findIndex((l) => l.text.includes("そろえかけて"));
  const terms = rows.findIndex((l) => l.speaker === "naru" && l.text.includes("条件を先に"));
  const tea = rows.findIndex((l) => l.text.includes("湯のみを二つ"));
  assert(remember >= 0 && stop > remember && terms > stop && tea > terms, "remembered → stops tidying → states his terms → tea");
  // お茶は相談を続けるため。座った後も、二人の話は仕入れのまま
  assert(rows[tea + 1].speaker === "rio" && rows[tea + 1].text.includes("座って話そう"));
  // なるが帰った後の控えには、本人の要望が書いてある。その後になるは出ない
  const left = rows.findIndex((l) => l.text.includes("階段を降りていった"));
  const slip = rows.findIndex((l) => l.text.includes("丁寧な字で三行"));
  assert(left > tea && slip > left && rows.slice(left).every((l) => l.speaker !== "naru"));
  // 恋人の時は、なるは仕事の敬意だけを言って帰る（再アプローチしない）。凛想の最後の一言も分ける
  const lovers = dlg.lines.filter((l) => l.condition_type === "lover");
  assert.equal(lovers.length, 2);
  assert(lovers.every((l) => l.char_id === "rio" && dlg.branches[l.next_true]?.length));
  assert(dlg.branches.naru_lover.every((l) => l.speaker === "naru" && l.text.includes("仕事")));
});

check("Naru and Rio, the order (#3468 E): wired after the tea at the chapter-five showroom", () => {
  const source = fs.readFileSync(new URL("../js/chapters/ch5-shops.js", import.meta.url), "utf8");
  assert.match(source, /\{ scene: "ch5_rio_naru_tea", after: 1, met: "naru" \}\),\s*Object\.freeze\(\{ scene: "ch5_rio_naru_order", after: 2, met: "naru", seen: "ch5_rio_naru_tea" \}\)/);
});

check("Hiyori and Minto: Minto plays along and never says so to her; her own age stays a joke", () => {
  const dlg = dialogues.hiyori_shop_minto;
  // みんとの店なので、名前欄は営業の「みんと」のまま（本名を知っていても）
  assert.equal(dlg.metadata.private_scene, false);
  const rows = dlg.lines.filter((l) => !l.type);
  const whole = rows.map((l) => l.text).join("");
  assert(!/29|二十九|アラサー|年上|演技|芝居/.test(whole), "nothing gives either of them away");
  // ひよりの本心はプレイヤーだけに見える inner で。みんとが気づいたことは、ひよりの前では言わない
  assert(rows.filter((l) => l.speaker === "hiyori").every((l) => l.inner), "each of Hiyori's lines carries her inner voice");
  const leftAt = rows.findIndex((l) => l.text.includes("ひよりが帰ったあと"));
  assert(leftAt > 0 && rows.slice(leftAt).every((l) => l.speaker !== "hiyori"), "Minto's remark comes after Hiyori has gone");
});

check("Hiyori and Minto, the back seat (#3468 B): Minto lets her keep the mood and never explains; no secrets shared", () => {
  const seat = dialogues.hiyori_shop_minto_seat, follow = dialogues.hiyori_minto_seat_followup;
  for (const dlg of [seat, follow]) {
    // みんとの店なので、名前欄は営業の「みんと」のまま。本名・私服の呼び名は出さない
    assert.equal(dlg.metadata.private_scene, false);
    const rows = dlg.lines.filter((l) => !l.type);
    const whole = rows.map((l) => `${l.text}${l.inner || ""}`).join("");
    assert(!/29|二十九|アラサー|年上|二十歳|栞|お姉さん|演技|芝居|恋人|彼氏|スミ|tonari/.test(whole), dlg.dialogue_id);
    // ひよりの本心は inner だけ。みんとの台詞は inner を持たない
    assert(rows.every((l) => l.speaker === "hiyori" || !l.inner), dlg.dialogue_id);
  }
  const rows = seat.lines.filter((l) => !l.type);
  // 入口は窓際、勧めるのは暗くできる奥の席（雰囲気の希望は残す）
  assert(rows[0].text.includes("窓際") && rows.some((l) => l.speaker === "minto" && l.text.includes("暗く")));
  // 手元の手際（荷物とコースター）と、その上に温かい飲み物
  const hands = rows.findIndex((l) => l.text.includes("バッグ")), cup = rows.findIndex((l) => l.text.includes("コースターの上"));
  assert(hands > 0 && cup > hands);
  // はじめが聞いても、ひよりが帰った後に、はぐらかすだけ
  const leftAt = rows.findIndex((l) => l.text.includes("ひよりが帰ったあと"));
  assert(leftAt > cup && rows.slice(leftAt).every((l) => l.speaker !== "hiyori"));
  // 後日は、ひよりが自分から同じ席にいる
  assert(follow.lines.some((l) => l.text?.includes("まっすぐあそこ")));
});

check("Naru and Rio at the cafe: after the pudding visit, with both met, on a day Rio is in town, never once Naru has left", () => {
  const both = { naru: true, rio: true };
  assert.equal(spotEncounterDue("cafe", 2, save({ met: both }), dialogues), "cafe_naru_break", "the first cafe encounter stays the same");
  const s = save({ met: both, flags: { _spot_seen_cafe_naru_break: true } });
  assert.equal(spotEncounterDue("cafe", 4, s, dialogues), "cafe_naru_rio");
  assert.equal(spotEncounterDue("cafe", 4, save({ met: { naru: true }, flags: s.flags }), dialogues), "cafe_maezono_break", "Rio unmet");
  assert.equal(spotEncounterDue("cafe", 4, save({ met: { rio: true }, flags: s.flags }), dialogues), "cafe_maezono_break", "Naru unmet");
  assert.equal(spotEncounterDue("cafe", 4, { ...s, day: AWAY }, dialogues), "cafe_maezono_break", "Rio is away on business");
  assert.equal(spotEncounterDue("cafe", 4, { ...s, day: AWAY + 7 }, dialogues), "cafe_maezono_break");
  assert.equal(spotEncounterDue("cafe", 4, { ...s, chapter: 2, flags: { ...s.flags, ...rift } }, dialogues), "cafe_maezono_break", "Naru left town");
  s.flags._spot_seen_cafe_naru_rio = true;
  assert.notEqual(spotEncounterDue("cafe", 6, s, dialogues), "cafe_naru_rio", "once");
  assert(!quietSpotPool({ id: "cafe", pool: ["cafe_herb_tea", "cafe_naru_rio"] }, 0).includes("cafe_naru_rio"));
});

check("Naru feeding Adam at the temple: only after the parcel story continued at EDEN, by day, with both met", () => {
  const both = { adam: true, naru: true };
  const before = save({ met: both, flags: { _spot_seen_kannon_adam: true } });
  assert.equal(spotEncounterDue("kannon", 4, before, dialogues), "kannon_oldman", "without the EDEN follow-up the old order holds");
  const s = save({ met: both, flags: { _spot_seen_kannon_adam: true, _spot_follow_adam: true } });
  assert.equal(spotEncounterDue("kannon", 4, s, dialogues), "kannon_adam_lunch");
  assert.equal(spotEncounterDue("kannon", 4, { ...s, slot: 1 }, dialogues), null, "daytime only");
  assert.equal(spotEncounterDue("kannon", 4, { ...s, met: { adam: true } }, dialogues), "kannon_oldman", "Naru unmet");
  assert.notEqual(spotEncounterDue("kannon", 4, { ...s, chapter: 2, flags: { ...s.flags, ...rift } }, dialogues), "kannon_adam_lunch", "Naru left town");
  s.flags._spot_seen_kannon_adam_lunch = true;
  assert.equal(spotEncounterDue("kannon", 6, s, dialogues), "kannon_oldman", "once, then the rest of the list");
});

check("follow-ups at each shop: one per visit, each read once, the older ones unchanged", () => {
  const s = save({ flags: { _spot_seen_cafe_naru_break: true, _spot_seen_cafe_naru_rio: true } });
  assert.equal(spotFollowupDue("naru", s, dialogues), "cafe_naru_followup", "the pudding follow-up still comes first");
  s.flags._spot_follow_naru = true;
  assert.equal(spotFollowupDue("naru", s, dialogues), "cafe_naru_rio_followup");
  assert.equal(spotFollowupDue("naru", { ...s, chapter: 2, flags: { ...s.flags, ...rift } }, dialogues), null, "not while Naru is away or after he returns");
  assert.equal(spotFollowupDue("rio", s, dialogues), "cafe_naru_rio_followup_rio");
  Object.assign(s.flags, { _spot_follow_naru_rio: true, _spot_follow_rio_naru: true });
  assert.equal(spotFollowupDue("naru", s, dialogues), null);
  assert.equal(spotFollowupDue("rio", s, dialogues), null);
  assert.equal(spotFollowupDue("rio", save(), dialogues), null, "nothing without the cafe scene");

  const a = save({ flags: { _spot_seen_kannon_adam: true, _spot_seen_kannon_adam_lunch: true, _spot_follow_adam: true } });
  assert.equal(spotFollowupDue("adam", a, dialogues), "kannon_adam_lunch_followup");
  assert.equal(spotFollowupDue("adam", { ...a, chapter: 2, flags: { ...a.flags, ...rift } }, dialogues), null);
  a.flags._spot_follow_adam_lunch = true;
  assert.equal(spotFollowupDue("adam", a, dialogues), null);

  const m = save({ flags: { _spot_seen_samechan_shop_minto_gift: true } });
  assert.equal(spotFollowupDue("minto", m, dialogues), "samechan_minto_followup", "does not wait for her identity to be known");
  m.flags._spot_seen_choizap_minto = m.flags._minto_identity_revealed = true;
  assert.equal(spotFollowupDue("minto", m, dialogues), "choizap_minto_followup");
  m.flags._spot_follow_minto = true;
  assert.equal(spotFollowupDue("minto", m, dialogues), "samechan_minto_followup");
  m.flags._spot_follow_minto_samechan = true;
  assert.equal(spotFollowupDue("minto", m, dialogues), null);
  m.flags._spot_seen_hiyori_shop_minto_seat = true;
  assert.equal(spotFollowupDue("minto", m, dialogues), "hiyori_minto_seat_followup", "after the night Hiyori was shown the back seat");
  assert.equal(spotFollowupDue("minto", save({ flags: { _spot_seen_hiyori_shop_minto_seat: true } }), dialogues), "hiyori_minto_seat_followup");
  m.flags._spot_follow_minto_hiyori = true;
  assert.equal(spotFollowupDue("minto", m, dialogues), null, "once");
  assert.equal(spotFollowupDue("sumi", save(), dialogues), null, "shops without follow-ups");
});

console.log(`${count} checks passed`);
