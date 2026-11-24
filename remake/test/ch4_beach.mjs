// 第4章ドバイの水着回（SPC18・Issue #3657）: 顔ぶれ・出せる時・確定（remake/js/chapters/ch4-beach.js）と台本。
// 顔ぶれは「その場に実際にいる人」だけ（同行者・到着を読んだ別便の人・会ったことのあるヌール）。好感度や渡航予定だけでは足さない。
// node remake/test/ch4_beach.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { CH4_PROLOGUE, CH4_PREP_SCENES, CH4_DAILY_TOURNAMENT_DAY, advanceToChapterFour, chapterFourArrivalsDue, completeChapterFourScene,
  departChapterFour, enterChapterFourEve, syncChapterFourDay } from "../js/chapters/ch4-progress.js";
import { OVERSEAS_HEROINES, OVERSEAS_GUESTS, chooseOverseasCompanion } from "../js/core/overseas-companion.js";
import { CH4_BEACH_SCENES, CH4_BEACH_SCENE_FILES, CH4_BEACH_PICKS, CH4_BEACH_RESIDENTS, CH4_BEACH_RIVALS, chapterFourBeachCast,
  chapterFourBeachCostume, chapterFourBeachDue, chapterFourBeachPickCount, chapterFourBeachRecord, commitChapterFourBeach } from "../js/chapters/ch4-beach.js";
import { classifyFlag } from "../js/core/carry.js";
import { CH4_MORNING_SCENES, CH4_MORNING_FILES, CH4_MORNING_FLAG, CH4_MORNING_CHEERS_MAX, chapterFourMorningCheers,
  chapterFourMorningDue, chapterFourMorningScript, CH4_AFTER_SCENES, chapterFourResultScript } from "../js/chapters/ch4-morning.js";
import { CH4_LOVERS_CALL, CH4_LOVERS_FILES, CH4_LOVERS_FLAG, CH4_LOVERS_PETIT, CH4_LOVERS_SCENES, chapterFourLoversDue, chapterFourLoversHere,
  chapterFourLoversScript } from "../js/chapters/ch4-lovers.js";
import { PETIT_KEYS, PETIT_LAST_FLAG, petitSeenFlag } from "../js/core/petit-shuraba.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"));

// 前夜（前夜祭の日）まで進めた保存。lovers・同行者・友人の締めくくり・ヌールに会ったかを選べる。
function eveSave({ lovers = [], companion = null, finales = {}, flags = {}, met = {}, eve = true } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45, slot: 1, lovers: [...lovers], finales: { ...finales } });
  value.flags = { _ch3_cleared: true, _ch3_aftermath: { version: 2, winDay: 42, stage: 6 }, _ch3_tournament_won: true, ...flags };
  value.met = { ...value.met, ...met };
  assert(advanceToChapterFour(value));
  assert(chooseOverseasCompanion(value, companion));
  for (const id of CH4_PREP_SCENES) assert(completeChapterFourScene(value, id));
  value.day += 3;
  assert(departChapterFour(value));
  for (const scene of CH4_PROLOGUE.slice(CH4_PREP_SCENES.length)) assert(completeChapterFourScene(value, scene.id));
  value.day = value.flags._ch4.startDay + 11; syncChapterFourDay(value);
  if (eve) { value.day = value.flags._ch4.startDay + 12; assert(enterChapterFourEve(value)); }
  return value;
}
const arriveAll = value => { for (const { scene } of chapterFourArrivalsDue(value)) assert(completeChapterFourScene(value, scene), scene); return value; };
const keep = value => structuredClone({ lovers: value.lovers, affinity: value.affinity, money: value.money, stats: value.stats,
  day: value.day, slot: value.slot, evening: value.flags._ch4_evening, ch4: value.flags._ch4, companion: value.flags._overseas_companion });

// ---- 台本: 全員分の場面があり、読み込み一覧と一致する
{
  const rows = readData("dialogue/ch4_beach").dialogues;
  assert.deepEqual(Object.keys(CH4_BEACH_SCENES.people), [...OVERSEAS_HEROINES, ...CH4_BEACH_RESIDENTS, ...CH4_BEACH_RIVALS, ...OVERSEAS_GUESTS]);
  assert.deepEqual([...CH4_BEACH_SCENE_FILES.ch4_beach].sort(), rows.map(row => row.dialogue_id).sort(), "ch4_beach: all scenes registered");
  for (const id of CH4_BEACH_SCENE_FILES.ch4_beach) {
    const row = rows.find(item => item.dialogue_id === id);
    assert(row?.lines?.length, id);
    // 報酬・恋人の分岐を持たない（恋人でも友人でも同じ台本）。サメちゃんの泳げない秘密だけ、既読の記録で分ける。
    const lines = [...row.lines, ...Object.values(row.branches || {}).flat()];
    assert(lines.every(line => line.type !== "apply" && line.condition_type !== "lover" && line.condition_type !== "romance_open"), `${id}: no reward or lover branch`);
    assert(!lines.some(line => /上がった。?$|下がった。?$/.test(line.text || "")), `${id}: no reward cue`);
  }
  const samechan = rows.find(row => row.dialogue_id === CH4_BEACH_SCENES.people.samechan);
  const condition = samechan.lines.find(line => line.type === "condition");
  assert.deepEqual([condition.condition_type, condition.flag], ["flag", "_samechan_swimming_known"]);
  assert(!samechan.branches.swim_unknown.some(line => /泳げ/.test(line.text || "")), "The swimming secret stays hidden until it is known");
  // 導入と締めは人数に触れない（一人でも全員でも成り立つ）。
  for (const id of [CH4_BEACH_SCENES.open, CH4_BEACH_SCENES.close]) {
    const text = rows.find(row => row.dialogue_id === id).lines.map(line => line.text).join("");
    assert(!/みんな|全員|二人|三人|ふたり/.test(text), `${id} does not count the people`);
  }
  assert.equal(classifyFlag("_ch4_beach"), "progression");
}

// ---- 衣装は選択した相手本人の個別会話だけ。ヌールは仕事服。
{
  for (const [id, scene] of Object.entries(CH4_BEACH_SCENES.people)) {
    assert.deepEqual(chapterFourBeachCostume(id, scene), id === "noor" ? undefined : { speaker: id, key: "swim" });
  }
  for (const scene of [CH4_BEACH_SCENES.open, CH4_BEACH_SCENES.close, CH4_BEACH_SCENES.people.minto,
    "ch4_tsumugi_dubai_friend", undefined]) {
    assert.equal(chapterFourBeachCostume("tsumugi", scene), undefined);
  }
  assert.equal(chapterFourBeachCostume("unknown", CH4_BEACH_SCENES.people.tsumugi), undefined);
}

// ---- 顔ぶれ: 恋人ゼロ・同行なし → いつも来るつむぎ・ましろ（友人版）。到着を読むまでは砂浜にいない。
// なる（第二代表）は第4章の最初から同じ宿にいるので、最初から砂浜にいる（男の枠・SPC24）。
{
  const value = eveSave();
  assert.deepEqual(chapterFourBeachCast(value), ["naru"], "Only Naru, who came on the same trip, before the arrivals");
  assert.equal(chapterFourBeachDue(value), false, "The beach waits for the arrivals");
  arriveAll(value);
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "mashiro", "naru"]);
  assert.equal(chapterFourBeachDue(value), true);
  assert.equal(chapterFourBeachPickCount(value), 3);
  // 顔ぶれが遊べる回数より少なければ全員（旧保存などで、なるの宿の場面を読んでいない場合）
  delete value.flags._ch4.read.ch4_arrival_inn;
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "mashiro"]);
  assert.equal(chapterFourBeachPickCount(value), 2, "Fewer people than picks: play with everyone");
}
// ---- 男の枠だけ（ヒロインもヌールもいない旧保存）なら水着回は出さない（強制イベントなので、男だけの砂浜にしない）。
{
  const value = eveSave();
  value.flags._overseas_companion = { decided: true, companion: null, supports: [], guests: ["adam"] };
  assert(completeChapterFourScene(value, "ch4_adam_dubai"));
  assert.deepEqual(chapterFourBeachCast(value), ["naru", "adam"]);
  assert.equal(chapterFourBeachDue(value), false, "No swimsuit episode with only the men");
}
// ---- 顔ぶれ: 同行者は最初からいる。別便の恋人・♥5の友人は到着を読んだら。会ったことのあるヌールも来る。
{
  const value = eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio",
    finales: { hiyori: { day: 21, chapter: 2, route: "friend" } }, met: { noor: true } });
  assert.deepEqual(chapterFourBeachCast(value), ["rio", "noor", "naru"], "The companion, Noor and Naru are already in Dubai");
  assert.equal(chapterFourBeachDue(value), false, "Arrivals first");
  arriveAll(value);
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "minto", "rio", "mashiro", "samechan", "hiyori", "noor", "naru"]);
  assert.equal(chapterFourBeachPickCount(value), CH4_BEACH_PICKS);
  // 好感度の数値・告白待ちの恋愛ルートだけでは来ない（出発前の顔ぶれで決まる）。
  assert(!chapterFourBeachCast(value).includes("ageha"));
}
// ---- ♥5の男の友人（SPC24）も、到着を読んだら砂浜に来る（ネタとにぎやかしの枠）。到着を読むまでは来ない。
{
  const value = eveSave({ finales: { adam: { day: 9, chapter: 1, route: "friend" }, steve: { day: 30, chapter: 3, route: "friend" },
    kuraudo: { day: 20, chapter: 2, route: "friend" } } });
  assert.deepEqual(chapterFourArrivalsDue(value).map(entry => entry.id), ["tsumugi", "mashiro", "adam", "kuraudo", "steve"]);
  for (const { scene } of chapterFourArrivalsDue(value).slice(0, 3)) assert(completeChapterFourScene(value, scene));
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "mashiro", "naru", "adam"], "Rei and Steve have not arrived yet");
  assert.equal(chapterFourBeachDue(value), false, "The male friends arrive before the beach");
  arriveAll(value);
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "mashiro", "naru", "adam", "kuraudo", "steve"]);
  assert.equal(chapterFourBeachDue(value), true);
  assert.equal(commitChapterFourBeach(value, ["adam", "naru", "steve"]), true, "Three men is fine: a lively beach, not a harem");
  assert.deepEqual(chapterFourBeachRecord(value), { picks: ["adam", "naru", "steve"] });
  // 締めくくりを済ませていない男キャラ（到着が無い）は来ない
  assert(!chapterFourBeachCast(value).includes("kumicho") && !chapterFourBeachCast(value).includes("volk"));
}
// ---- 男の枠の台本: その人とはじめ（と地の文）だけで、恋愛を示す台詞・ほかの人の名前・報酬は無い。
{
  const rows = readData("dialogue/ch4_beach").dialogues;
  const names = /つむぎ|みんと|栞|凛想|あげは|ましろ|サメちゃん|ひより|ヌール|アダム|神崎|クラウド|綾取|スティーブ|ヴォルク/g; // 「なる」は普通の言葉に混ざるので見ない
  const self = { naru: "なる", adam: "アダム", kumicho: "神崎", kuraudo: "クラウド", ayatori: "綾取", steve: "スティーブ", volk: "ヴォルク" };
  for (const id of [...CH4_BEACH_RIVALS, ...OVERSEAS_GUESTS]) {
    const row = rows.find(item => item.dialogue_id === CH4_BEACH_SCENES.people[id]);
    assert(row.lines.every(line => ["", "hajime", id].includes(line.speaker)), `${id}: only the two of them`);
    const others = (row.lines.map(line => line.text).join("").match(names) || []).filter(name => name !== self[id]);
    assert.deepEqual(others, [], `${id}: no one else is named`);
    assert(!row.lines.some(line => /好き|ドキ|かわい|可愛/.test(line.text || "")), `${id}: no romance`);
  }
}
// ---- 会ったことのないヌールは来ない。
{
  const value = arriveAll(eveSave({ lovers: ["ageha"] }));
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "ageha", "mashiro", "naru"]);
}

// ---- 確定: ちょうど遊べる回数・顔ぶれから重ならずに。好感度・お金・日付・前夜の記録は変えない。一度だけ。
{
  const value = arriveAll(eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio", met: { noor: true } }));
  const before = keep(value);
  for (const wrong of [[], ["rio", "noor"], ["rio", "rio", "noor"], ["rio", "noor", "ageha"], ["rio", "noor", "minto", "tsumugi"], "rio"]) {
    assert.equal(commitChapterFourBeach(value, wrong), false, JSON.stringify(wrong));
    assert.equal(chapterFourBeachRecord(value), null);
  }
  assert.equal(commitChapterFourBeach(value, ["noor", "rio", "minto"]), true);
  assert.deepEqual(chapterFourBeachRecord(value), { picks: ["noor", "rio", "minto"] });
  assert.deepEqual(keep(value), before, "The beach changes nothing else");
  assert.equal(chapterFourBeachDue(value), false, "Once");
  assert.equal(commitChapterFourBeach(value, ["tsumugi", "mashiro", "samechan"]), false);
  assert.deepEqual(chapterFourBeachRecord(JSON.parse(JSON.stringify(value))), { picks: ["noor", "rio", "minto"] }, "Survives SAVE/LOAD");
}
// ---- 出せない時: 前夜祭が始まった後・前夜の過ごし方を記録した後・大会の後・同行の選択が無い旧保存。
{
  const festival = arriveAll(eveSave());
  for (const id of ["ch4_festa", "ch4_stranger_first", "ch4_stranger_second"]) festival.flags._ch4.read[id] = true;
  assert(completeChapterFourScene(festival, "ch4_wang_reception_forced_in"));
  assert.equal(chapterFourBeachDue(festival), false, "No beach after the festival started");
  assert.equal(commitChapterFourBeach(festival, ["tsumugi", "mashiro"]), false);
  const settled = arriveAll(eveSave());
  settled.flags._ch4_evening = { kind: "rest", participants: [] };
  assert.equal(chapterFourBeachDue(settled), false);
  const after = arriveAll(eveSave());
  Object.assign(after.flags._ch4, { part: "tournament", day: CH4_DAILY_TOURNAMENT_DAY });
  assert.equal(chapterFourBeachDue(after), false);
  const free = eveSave({ eve: false });
  assert.equal(free.flags._ch4.part, "free");
  assert.equal(chapterFourBeachDue(free), false, "Not during the Dubai daily days");
}
// ---- 大会当日の朝（4-4・SPC28）: その場にいる人の一言（恋人を先に・最大4人・なるは一緒に歩くので入れない）
{
  const rows = readData("dialogue/ch4_morning").dialogues;
  assert.deepEqual([...CH4_MORNING_FILES.ch4_morning].sort(), rows.map(row => row.dialogue_id).sort(), "ch4_morning: all scenes registered");
  for (const [id, scene] of Object.entries(CH4_MORNING_SCENES.cheers)) {
    const row = rows.find(item => item.dialogue_id === scene);
    assert.deepEqual(row.lines.map(line => line.speaker), [id], `${id}: one line by themselves`);
  }
  const dialogues = Object.fromEntries(rows.map(row => [row.dialogue_id, row]));
  const value = arriveAll(eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio", met: { noor: true },
    finales: { adam: { day: 9, chapter: 1, route: "friend" } } }));
  const { cheers, more } = chapterFourMorningCheers(value);
  assert.equal(CH4_MORNING_CHEERS_MAX, 4);
  assert.deepEqual(cheers, ["minto", "rio", "samechan", "tsumugi"], "lovers first, then the others in order, up to four");
  assert.equal(more, true, "Mashiro, Noor and Adam are also there");
  assert(!cheers.includes("naru"));
  const script = chapterFourMorningScript(value, dialogues).lines.map(line => line.text);
  assert.equal(script[0], dialogues[CH4_MORNING_SCENES.open].lines[0].text);
  assert.equal(script.at(-1), dialogues[CH4_MORNING_SCENES.close].lines.at(-1).text);
  for (const id of cheers) assert(script.includes(dialogues[CH4_MORNING_SCENES.cheers[id]].lines[0].text), id);
  assert(script.includes(dialogues[CH4_MORNING_SCENES.more].lines[0].text));
  // 誰もいない（旧保存）: 一言の前置き・続きは入れない
  const alone = eveSave({ eve: false });
  const lonely = chapterFourMorningScript(alone, dialogues).lines.map(line => line.text);
  assert(!lonely.includes(dialogues[CH4_MORNING_SCENES.crowd].lines[0].text));
  assert.equal(chapterFourMorningDue(value, false), true);
  assert.equal(chapterFourMorningDue(value, true), false, "not once the tournament scene was read");
  value.flags[CH4_MORNING_FLAG] = true;
  assert.equal(chapterFourMorningDue(value, false), false, "once");
  assert.equal(classifyFlag(CH4_MORNING_FLAG), "progression");
}
// ---- 結果発表のあと（#3097 第3弾・VOL23）: 朝と同じ顔ぶれが客席から降りてくる。恋人には恋人の台本。誰もいなければ元のまま
{
  const rows = readData("dialogue/ch4_morning").dialogues;
  const dialogues = Object.fromEntries(rows.map(row => [row.dialogue_id, row]));
  const speakersOf = row => new Set([...row.lines.map(line => line.speaker)].filter(Boolean));
  for (const [id, scene] of Object.entries({ ...CH4_AFTER_SCENES.cheers })) {
    assert(dialogues[scene], `${scene}: exists`);
    assert.deepEqual([...speakersOf(dialogues[scene])].filter(who => who !== "hajime"), [id], `${scene}: only ${id} and Hajime speak`);
  }
  for (const [id, scene] of Object.entries(CH4_AFTER_SCENES.lovers)) {
    assert(dialogues[scene], `${scene}: exists`);
    assert.deepEqual([...speakersOf(dialogues[scene])].filter(who => who !== "hajime"), [id], `${scene}: only ${id} and Hajime speak`);
  }
  for (const id of ["noor", "adam", "kumicho", "kuraudo", "ayatori", "steve", "volk"]) assert(!CH4_AFTER_SCENES.lovers[id], `${id}: friend lines only`);
  const result = readData("dialogue/ch4_main").dialogues.find(row => row.dialogue_id === "ch4_result");
  const value = arriveAll(eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio", met: { noor: true },
    finales: { adam: { day: 9, chapter: 1, route: "friend" } } }));
  const script = chapterFourResultScript(result, value, dialogues);
  assert.equal(script.dialogue_id, "ch4_result");
  const texts = script.lines.map(line => line.text);
  assert.deepEqual(texts.slice(0, result.lines.length), result.lines.map(line => line.text), "the result scene itself comes first");
  const expected = [CH4_AFTER_SCENES.open, CH4_AFTER_SCENES.lovers.minto, CH4_AFTER_SCENES.lovers.rio, CH4_AFTER_SCENES.lovers.samechan,
    CH4_AFTER_SCENES.cheers.tsumugi, CH4_AFTER_SCENES.more, CH4_AFTER_SCENES.close].flatMap(id => dialogues[id].lines.map(line => line.text));
  assert.deepEqual(texts.slice(result.lines.length), expected, "same faces as the morning; lovers get their own lines");
  assert(!texts.includes(dialogues[CH4_AFTER_SCENES.cheers.minto].lines[0].text), "a lover does not also read the friend lines");
  // 誰も来ていない（旧保存）: 結果発表の台本をそのまま読む
  const alone = eveSave({ eve: false });
  assert.equal(chapterFourResultScript(result, alone, dialogues), result);
  // 結果発表を読む入口（ch4.js の readScene）が、この台本を使う
  const ch4 = readFileSync(new URL("../js/chapters/ch4.js", import.meta.url), "utf8");
  assert.match(ch4, /id === "ch4_result" \? chapterFourResultScript\(source, state, DB\.dialogues\)/);
}
// ---- 「みんな来ちゃった」（4-2・SPC28）: 日本から来た恋人が2人以上の時、砂浜の前に一度。内心のあと、読める時はノックが重なる
{
  const rows = readData("dialogue/ch4_lovers").dialogues;
  assert.deepEqual([...CH4_LOVERS_FILES.ch4_lovers].sort(), rows.map(row => row.dialogue_id).sort(), "ch4_lovers: all scenes registered");
  const dialogues = Object.fromEntries(rows.map(row => [row.dialogue_id, row]));
  // 誘い・反応は本人だけが話し、ほかの人の名前を出さない（相手が誰でも通じる）
  for (const id of OVERSEAS_HEROINES) {
    for (const scene of [CH4_LOVERS_SCENES.invite[id], CH4_LOVERS_SCENES.look[id]]) {
      const lines = dialogues[scene].lines;
      assert.deepEqual([...new Set(lines.map(line => line.speaker))], [id], scene);
      const others = Object.entries(CH4_LOVERS_CALL).filter(([other]) => other !== id).map(([, name]) => name.replace(/さん$|ちゃん$/, ""));
      for (const name of others) assert(!lines.some(line => line.text.includes(name)), `${scene}: no ${name}`);
    }
  }
  assert(PETIT_KEYS.includes(CH4_LOVERS_PETIT), "the Dubai schedule clash is a petit shuraba");
  assert.equal(classifyFlag(petitSeenFlag(CH4_LOVERS_PETIT)), "progression");
  assert.equal(classifyFlag(CH4_LOVERS_FLAG), "progression");
  // 最後の修羅場（第5章の打ち上げ・スタッフロール後）で一行返る
  for (const [file, scene] of [["ch5_party", "ch5_party_shuraba_open"], ["relationship_conflicts", "shuraba_open"]]) {
    const row = readData(`dialogue/${file}`).dialogues.find(item => item.dialogue_id === scene);
    assert(row.lines.some(line => line.flag === "_petit_seen_dubai" && line.next_true === "petit_recall_dubai"), `${scene}: recall condition`);
    assert(row.branches.petit_recall_dubai?.length, `${scene}: recall line`);
  }

  // 同行者（凛想）と別便の恋人2人。到着を読み終えるまでは出さない（砂浜と同じ時）
  const value = eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio" });
  assert.equal(chapterFourLoversDue(value), false, "not before the arrivals");
  arriveAll(value);
  assert.deepEqual(chapterFourLoversHere(value), ["minto", "rio", "samechan"]);
  assert.equal(chapterFourLoversDue(value), true);
  const before = keep(value);
  const { script, pair } = chapterFourLoversScript(value, dialogues);
  assert.deepEqual(keep(value), before, "building the script changes nothing");
  assert.deepEqual(pair, ["minto", "rio"], "the first two of those who came both got a yes for six");
  const texts = script.lines.map(line => line.text);
  assert(texts.includes("（栞さん、凛想さん、サメちゃん……みんな、来てくれた）"), "counts everyone who came");
  assert(texts.includes(dialogues[CH4_LOVERS_SCENES.many].lines[0].text));
  assert(!texts.includes(dialogues[CH4_LOVERS_SCENES.two].lines[0].text));
  for (const id of pair) assert(texts.includes(dialogues[CH4_LOVERS_SCENES.invite[id]].lines[0].text), id);
  assert(!texts.includes(dialogues[CH4_LOVERS_SCENES.invite.samechan].lines[0].text), "only two invitations clash");
  assert(!texts.some(text => /ノック/.test(text)), "no double knock (2026-11-15 owner)");
  for (const id of pair) assert.match(dialogues[CH4_LOVERS_SCENES.invite[id]].lines.map(line => line.text).join(""), /六時/, `${id}: the same six o'clock`);
  assert.equal(texts.at(-1), dialogues[CH4_LOVERS_SCENES.clashClose].lines.at(-1).text);
  // 前のプチ修羅場から日が浅ければ、内心だけ（約束の重なりは無し）
  const recent = structuredClone(value);
  recent.flags[PETIT_LAST_FLAG] = 999999;
  const quiet = chapterFourLoversScript(recent, dialogues);
  assert.equal(quiet.pair, null);
  assert.equal(quiet.script.lines.at(-1).text, dialogues[CH4_LOVERS_SCENES.close].lines.at(-1).text);
  // 2人なら「二人とも」の一行
  const twoLovers = arriveAll(eveSave({ lovers: ["tsumugi", "hiyori"], companion: "hiyori" }));
  assert.deepEqual(chapterFourLoversHere(twoLovers), ["tsumugi", "hiyori"]);
  assert(chapterFourLoversScript(twoLovers, dialogues).script.lines.some(line => line.text === dialogues[CH4_LOVERS_SCENES.two].lines[0].text));
  // 恋人が1人・ヌールは「来た」人に数えない・一度きり・砂浜の後は出さない
  const one = arriveAll(eveSave({ lovers: ["tsumugi"], companion: "tsumugi" }));
  assert.equal(chapterFourLoversDue(one), false, "one lover: nothing to juggle");
  const withNoor = arriveAll(eveSave({ lovers: ["tsumugi", "noor"], companion: "tsumugi", met: { noor: true } }));
  assert.deepEqual(chapterFourLoversHere(withNoor), ["tsumugi"], "Noor lives in Dubai; she did not come");
  assert.equal(chapterFourLoversDue(withNoor), false);
  const done = structuredClone(value);
  done.flags[CH4_LOVERS_FLAG] = true;
  assert.equal(chapterFourLoversDue(done), false, "once");
  const beached = structuredClone(value);
  assert(commitChapterFourBeach(beached, chapterFourBeachCast(beached).slice(0, chapterFourBeachPickCount(beached))));
  assert.equal(chapterFourLoversDue(beached), false, "not after the beach");
  assert.equal(chapterFourLoversDue(eveSave({ lovers: ["minto", "rio"], companion: "rio", eve: false })), false, "not during the daily days");
}
console.log("PASS ch4 beach: cast is who is actually there (with Naru and the ♥5 male friends as the lively slots), picks once without rewards, before the festival only");
