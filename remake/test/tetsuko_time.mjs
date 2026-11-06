// 「てつこといっしょ / TETSUKO TIME」（#2454）のモデルと確定点。DOM を持たない部分だけを検証する
// （画面の操作は browser/tetsuko_time.mjs、mukai の帰りからの到達は browser/ch3_tokyo_daily.mjs）。
// 守ること: 点数・ペナルティ・世話の義務を持ち込まない。関係は既存の4段階（_ch3_outings.tetsuko）から決め、下がらない。
// 回復12と来訪の加算は意味のあるふれあいの時だけ一度。能力・お金・好感度・日付・時間帯は確定点で変えない。
import assert from "node:assert/strict";
import { newState } from "../js/core/state.js";
import { TOKYO_OUTINGS } from "../js/chapters/ch3-outing-progress.js";
import { classifyFlag } from "../js/core/carry.js";
import * as M from "../js/minigames/tetsuko-model.js";
import { TETSUKO_TIME } from "../js/minigames/tetsuko-time.js";

const fresh = (visits = 0, extra = {}) => {
  const value = newState();
  Object.assign(value, { chapter: 3, day: 30, slot: 1, stamina: 40, money: 10000 }, extra);
  value.met = { ...value.met, mukai_master: true, mashiro: true };
  if (visits) value.flags._ch3_outings = { tetsuko: visits, mukai_help: 2 };
  return value;
};
const fullWidth = text => [...text].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.5 : 1), 0);
const texts = new Set();
const collect = result => { for (const entry of result?.lines || []) texts.add(JSON.stringify(entry)); return result; };

// 入口のメタ情報と、既存の「少し構っていく」の外出定義（回復12・4段階＋巡回3）を壊していない。
{
  assert.deepEqual(TETSUKO_TIME, { id: "tetsuko_time", title: "てつこといっしょ", roman: "TETSUKO TIME" });
  const cat = TOKYO_OUTINGS.find(item => item.id === "tetsuko");
  assert.equal(cat.stamina, 12);
  assert.equal(M.TETSUKO_STAMINA, cat.stamina, "The game recovers the same 12 as the short care");
  assert.equal(cat.stages.length, 4);
  assert.equal(cat.loop.length, 3);
  assert(!cat.stat && !cat.money, "No stat or money reward on the cat");
  assert.equal(classifyFlag(M.TETSUKO_TIME_FLAG), "progression", "The cat space is not carried into a new cycle");
}

// 段階は既存の来訪回数そのもの（4段階目で止まる）。旧セーブで懐いた人は最初から段階3。
{
  assert.deepEqual([0, 1, 2, 3, 4, 7, 30].map(n => M.tetsukoStage(fresh(n))), [0, 1, 2, 3, 3, 3, 3]);
  const old = fresh(7); // 膝・お腹・見送りまで読んだ旧セーブ。_tetsuko_time は無い
  const session = M.createSession(old, { key: "k" });
  assert.equal(session.stage, 3);
  assert.equal(session.cat.at, "front", "A trusting cat comes to the feet from the start");
  assert.deepEqual(session.layout, { bench: null, floor: "ball", bed: null }, "Old saves start with the old ball only");
  assert.equal(M.actionState(session).brush.ok, true);
  const opening = collect(M.openingLines(session));
  assert.equal(opening.found?.id, "waiting");
}

// 気分はゲーム内の日で決まり、開き直しても変わらない。どの気分でも全部の操作を選べる。
{
  for (let day = 1; day <= 40; day++) {
    assert.equal(M.tetsukoMood(day), M.tetsukoMood(day));
    const value = fresh(4, { day });
    const states = M.actionState(M.createSession(value));
    assert(states.pet.ok && states.play.ok && states.watch.ok && states.brush.ok, `Mood on day ${day} locks nothing`);
  }
  const moods = new Set(Array.from({ length: 40 }, (_, i) => M.tetsukoMood(i + 1).id));
  assert.equal(moods.size, 4, "All four moods appear across the days");
  const clingy = M.MOODS.find(mood => mood.id === "clingy");
  assert.notEqual(M.moodLabel(clingy, 0), M.moodLabel(clingy, 3), "A new cat is only curious, not clingy");
}

// 初対面: ブラシはまだ・おやつは無い（通販で頼める）。猫じゃらしは3回揺らすと「止める」になり、捕まえさせるのも成功。
{
  const session = M.createSession(fresh(0), { key: "k" });
  const states = M.actionState(session);
  assert.equal(states.brush.ok, false);
  assert.equal(states.treat.ok, false);
  assert.match(states.treat.why, /通販/);
  assert.equal(M.interact(session, "brush"), null, "A locked action changes nothing");
  assert.equal(session.meaningful, false);
  for (let i = 0; i < 3; i++) collect(M.interact(session, "play"));
  assert(session.found.has("first_paw"));
  assert.equal(M.actionState(session).play.label, "じゃらしを止める");
  const caught = collect(M.interact(session, "play"));
  assert.equal(caught.found, null, "At first she only pins it and lets go");
  assert.equal(M.actionState(session).play.label, "あそぶ");
  const later = M.createSession(fresh(1), { key: "k" });
  for (let i = 0; i < 4; i++) collect(M.interact(later, "play"));
  assert(later.found.has("hug_toy"), "Once used to it she hugs the toy");
}

// なでる連打は4回目で「今はもういい」。手を休めて他のことをすれば、また撫でられる。関係は下がらない。
{
  const value = fresh(2);
  const session = M.createSession(value, { key: "k" });
  const lines = [1, 2, 3, 4, 5].map(() => collect(M.interact(session, "pet")).lines[0]);
  assert.match(lines[3].text, /もういいらしい/);
  assert.equal(lines[4].who, "hajime");
  collect(M.interact(session, "watch"));
  assert.doesNotMatch(collect(M.interact(session, "pet")).lines[0].text, /もういい|そっと/);
  assert.equal(M.tetsukoStage(value), 2, "Petting too much never lowers the relationship");
}

// 通販: お金が足りないと頼めない。注文した次の日に届く。小物は一度だけ。最初の荷物で段ボール箱も手に入る。
{
  const value = fresh(4, { day: 30, money: 500 });
  assert.equal(M.orderStatus(value, "bed", value.money).status, "short");
  assert.equal(M.recordOrder(value, "bed", value.money), 0);
  assert.equal(value.flags[M.TETSUKO_TIME_FLAG], undefined, "A refused order writes nothing");
  value.money = 9000;
  assert.equal(M.recordOrder(value, "bed", value.money), 3200);
  assert.equal(M.recordOrder(value, "treat", value.money), 600);
  assert.equal(M.orderStatus(value, "bed", value.money).status, "pending");
  assert.equal(M.recordOrder(value, "bed", value.money), 0, "The same order twice is refused");
  assert.equal(M.recordOrder(value, "box", value.money), 0, "The packing box is not sold");
  assert.equal(value.money, 9000, "The model never takes money itself (the screen does, with the save)");
  const today = M.createSession(value, { key: "a" });
  assert(!today.owned.has("bed") && !today.owned.has("box"), "Nothing arrives on the order day");
  assert.equal(M.actionState(today).treat.ok, false);
  value.day = 31;
  const tomorrow = M.createSession(value, { key: "b" });
  assert(tomorrow.owned.has("bed") && tomorrow.owned.has("box"), "The parcel and its box arrive the next day");
  assert.deepEqual(tomorrow.layout, { bench: "box", floor: "ball", bed: "bed" }, "Purchases are set out first, then the box");
  assert.equal(tomorrow.treatsLeft, 6);
  const opening = collect(M.openingLines(tomorrow));
  assert.equal(opening.lines[0].who, "mukai_master");
  assert(opening.lines.some(entry => /猫ベッドを出して、寝床の角に置いた/.test(entry.text)));
  assert.equal(M.orderStatus(value, "bed", value.money).status, "owned", "A prop is bought only once");
  assert.equal(M.orderStatus(value, "treat", value.money).status, "ready", "Treats can be ordered again");
}

// おやつは一日一本。届いた分を使い切ったら通販で頼み直せる（無くても関係は進む）。
{
  const value = fresh(3, { day: 40 });
  value.flags[M.TETSUKO_TIME_FLAG] = { orders: [{ id: "treat", day: 39 }] };
  const first = M.createSession(value, { key: "3:40:0" });
  collect(M.interact(first, "treat"));
  assert.equal(M.actionState(first).treat.ok, false);
  assert.equal(M.actionState(first).treat.why, "今日はもうあげた");
  assert(M.settleTetsukoTime(value, M.sessionResult(first)).committed);
  const record = M.tetsukoRecord(value);
  assert.equal(record.treatsUsed, 1);
  assert.equal(record.treatDay, 40);
  const again = M.createSession(value, { key: "3:40:1" });
  assert.equal(M.actionState(again).treat.ok, false, "The night visit of the same day gives no second treat");
  const forged = { ...M.sessionResult(again), treatsUsed: 1, meaningful: true };
  M.settleTetsukoTime(value, forged);
  assert.equal(M.tetsukoRecord(value).treatsUsed, 1, "The settle point also refuses a second treat on one day");
  value.day = 41;
  assert.equal(M.createSession(value).treatsLeft, 5);
}

// 確定点: 何もせず帰ると保存は変わらない。意味のあるふれあいで回復12と来訪+1を一度だけ。他の値は変えない。
{
  const value = fresh(1);
  const before = structuredClone(value);
  const idle = M.createSession(value, { key: "3:30:1" });
  for (let i = 0; i < 6; i++) collect(M.nextBehavior(idle)); // 眺めるだけ
  assert.deepEqual(M.settleTetsukoTime(value, M.sessionResult(idle)), { committed: false });
  const strip = v => { const copy = structuredClone(v); delete copy.flags[M.TETSUKO_TIME_FLAG]; return copy; };
  assert.deepEqual(strip(value), strip(before), "Opening and leaving without care grants nothing");

  const session = M.createSession(value, { key: "3:30:1" });
  collect(M.interact(session, "watch")); // 見守るだけでも意味のあるふれあい
  const result = M.sessionResult(session);
  const out = M.settleTetsukoTime(value, result);
  assert.equal(out.committed, true);
  assert.equal(out.stamina, 12);
  assert.equal(value.flags._ch3_outings.tetsuko, 2);
  assert.equal(value.flags._ch3_outings.mukai_help, 2, "Other outing counts are kept");
  for (const key of ["stamina", "money", "day", "slot", "chapter", "stats", "affinity", "statXp"])
    assert.deepEqual(value[key], before[key], `${key} is not changed by the settle point`);
  assert.deepEqual(M.settleTetsukoTime(value, result), { committed: false }, "The same visit key never grants twice");
  assert.equal(value.flags._ch3_outings.tetsuko, 2);
  assert.deepEqual(M.settleTetsukoTime(value, null), { committed: false });
  assert.deepEqual(M.settleTetsukoTime(value, { ...result, key: null }), { committed: false }, "No key, no grant");

  const story = fresh(2);
  const read = M.createSession(story, { key: "3:30:0", storyRead: true });
  assert.equal(M.settleTetsukoTime(story, M.sessionResult(read)).committed, true, "Reading the stage talk is itself meaningful");
}

// もようがえ: 持っている物だけ、置ける枠だけ、同じ物は一か所。保存時も同じ規則で正す。
{
  const value = fresh(4, { day: 50 });
  value.flags[M.TETSUKO_TIME_FLAG] = { orders: [{ id: "cushion", day: 40 }, { id: "tunnel", day: 40 }], unpacked: 2,
    layout: { bench: "cushion", floor: "ball", bed: null } };
  const session = M.createSession(value, { key: "k" });
  assert.equal(M.arrange(session, "bed", "tunnel"), null, "A tunnel does not go in the bed corner");
  assert.equal(M.arrange(session, "bed", "bed"), null, "A bed not bought cannot be placed");
  assert(M.arrange(session, "bed", "cushion"));
  assert.deepEqual(session.layout, { bench: null, floor: "ball", bed: "cushion" }, "Placing moves the same item");
  assert(M.arrange(session, "floor", "tunnel"));
  const reaction = collect(M.nextBehavior(session));
  assert.equal(reaction.behavior, "tunnel_tail", "She goes to look at what was just placed");
  M.settleTetsukoTime(value, { ...M.sessionResult(session), layout: { bench: "bed", floor: "tunnel", bed: "cushion" } });
  assert.deepEqual(M.tetsukoRecord(value).layout, { bench: null, floor: "tunnel", bed: "cushion" }, "Unowned items are dropped on save");
}

// 写真: 今のしぐさか表情を一枚。同じものは一枚だけ（撮り直すと差し替え）。12枚まで。画像そのものは保存しない。
{
  const value = fresh(4);
  const session = M.createSession(value, { key: "k", dayLabel: "東京 3日目" });
  collect(M.interact(session, "watch"));
  const shot = M.takePhoto(session);
  assert.deepEqual(shot.entry, { id: "paws_together", pose: "normal", caption: "前足をそろえる", label: "東京 3日目" });
  assert.equal(M.takePhoto(session).replaced, true);
  assert.equal(session.album.length, 1);
  for (const pose of M.POSES) { session.moment = null; session.cat.pose = pose; M.takePhoto(session); }
  assert.equal(session.album.length, 6);
  session.album = Array.from({ length: 12 }, (_, i) => ({ id: `pose:x${i}`, pose: "normal", caption: "c", label: "" }));
  session.moment = "lap_nap"; session.cat.pose = "sleep";
  assert.equal(M.takePhoto(session).full, true);
  assert(M.removePhoto(session, "pose:x0"));
  assert.equal(M.takePhoto(session).ok, true);
  M.settleTetsukoTime(value, M.sessionResult(session));
  const album = M.tetsukoRecord(value).album;
  assert.equal(album.length, 12);
  assert(JSON.stringify(album).length < 2000, "The album keeps only small metadata");
}

// 図鑑の12件は、気を許した後に小物を変えながら何回か会えば、すべて見られる（低確率の引き直しを強いない）。
{
  const value = fresh(0, { day: 20, money: 99999 });
  const layouts = [null, { bench: null, floor: "ball", bed: null }, { bench: "cushion", floor: "box", bed: null },
    { bench: "box", floor: "ball", bed: "bed" }, { bench: "cushion", floor: "tunnel", bed: "bed" }];
  value.flags[M.TETSUKO_TIME_FLAG] = { orders: ["cushion", "bed", "tunnel", "scratcher"].map(id => ({ id, day: 1 })), unpacked: 4 };
  let sessions = 0;
  for (let visit = 0; visit < 10; visit++) {
    value.day += 1;
    const session = M.createSession(value, { key: `3:${value.day}:0` });
    collect(M.openingLines(session));
    const layout = layouts[Math.min(visit, layouts.length - 1)];
    if (layout) for (const [slot, id] of Object.entries(layout)) M.arrange(session, slot, id);
    for (const action of ["pet", "play", "play", "play", "play", "brush", "watch", "watch"]) collect(M.interact(session, action));
    for (let tick = 0; tick < 12; tick++) collect(M.nextBehavior(session));
    M.leave(session);
    M.settleTetsukoTime(value, M.sessionResult(session));
    sessions += 1;
    if (M.tetsukoRecord(value).found.length === M.MOMENTS.length) break;
  }
  const missing = M.MOMENTS.map(moment => moment.id).filter(id => !M.tetsukoRecord(value).found.includes(id));
  assert.deepEqual(missing, [], "Every moment can be found in a handful of visits");
  assert(sessions <= 8, `All moments within eight visits (took ${sessions})`);
  assert.equal(value.flags._ch3_outings.tetsuko, sessions, "One visit counted per visit");
}

// 自律行動: 何もしなくても反応がある。直前と同じ行動は続けない。1回おきに落ち着く。
{
  const session = M.createSession(fresh(4, { day: 33 }), { key: "k" });
  const seen = [];
  for (let tick = 0; tick < 30; tick++) { const result = collect(M.nextBehavior(session)); if (result) seen.push(result.behavior); }
  assert(seen.length >= 12, "Something happens about every other tick");
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], "No back-to-back repeat");
  assert(new Set(seen).size >= 5, "The cat does several different things");
}

// 文の規範（text-style）: 地の文は「。」で終える、台詞は「。」で終えない、1行は全角48字以内、旧名を使わない。
{
  for (const moment of M.MOMENTS) texts.add(JSON.stringify({ who: null, text: moment.hint.replace(/……$/, "。") }));
  for (const item of [...M.PROPS, M.TREAT]) texts.add(JSON.stringify({ who: null, text: item.desc }));
  for (const mood of M.MOODS) for (const label of [mood.label, mood.early].filter(Boolean)) texts.add(JSON.stringify({ who: null, text: label }));
  assert(texts.size > 60, `Collected ${texts.size} lines`);
  for (const raw of texts) {
    const { who, text } = JSON.parse(raw);
    assert(fullWidth(text) <= 48, `Too long (${fullWidth(text)}): ${text}`);
    assert(!/\n/.test(text), `No manual line break: ${text}`);
    assert(!/ヤニネコ|ヤニ猫|テツコ|ましろさん/.test(text), `Old name: ${text}`);
    if (who) assert(!/。$/.test(text), `Speech ends without 。: ${text}`);
    else assert(/[。）]$/.test(text), `Narration ends with 。: ${text}`);
  }
}

console.log("tetsuko time model: ok");
