// 第5章の出張シーシャの依頼（DLV・chapters/ch5-catering-model.js）の決まりを、ブラウザ無しで確かめる。
// 届く日（第5章の自由行動・地元だけ・一度に一つ）・返事と作りに行ける期限・合い方とくじ券の枚数・手取り・委託予約と不在・
// 周回で持ち越さないこと・#2455（火種・心得の盤・大会・エンディング・進行の条件につながない）。
// 実際の LIME・地図・場面は remake/test/browser/ch5_catering.mjs。
// node remake/test/ch5_catering.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const root = new URL("../../", import.meta.url);
const readText = file => fs.readFileSync(new URL(file, root), "utf8");
const readJson = file => JSON.parse(readText(file));
const M = await import("../js/chapters/ch5-catering-model.js");
const { grantKujiTickets } = await import("../js/daily/kuji-tickets.js");
const { KUJI_TICKET_MAX } = await import("../js/core/rules.js");
const carry = await import("../js/core/carry.js");
const { newGame, load, SAVE_KEY } = await import("../js/core/state.js");

const START = 40;
/** 第5章の自由行動の保存（地元・昼）。 */
const save = (fields = {}) => {
  const value = { chapter: 5, day: START, slot: 0, seed: 0, money: 12345, kujiTickets: 0,
    flags: { _ch5: { startDay: START, part: "free" }, _ch2_region: "home" }, inbox: [] };
  return Object.assign(value, fields, { flags: { ...value.flags, ...(fields.flags || {}) } });
};
const grantTo = value => n => grantKujiTickets(n, "delivery", value);
const payTo = value => n => { value.money += n; return n; };

// ---------------------------------------------------------------- 1. 依頼のデータ
const flavors = new Set(readJson("data/flavors.json").flavors.map(f => f.id));
const scenes = new Map(readJson("data/dialogue/ch5_catering.json").dialogues.map(d => [d.dialogue_id, d]));
// quick CI の sparse checkout では背景画像の実体を取得しない。追跡ファイル名を検証する。
const backgrounds = new Set(execFileSync("git", ["ls-files", "--cached", "--", "assets/backgrounds/"],
  { cwd: root, encoding: "utf8" }).trim().split("\n").map(path => path.slice("assets/backgrounds/".length)));
assert.equal(M.CATERING_REQUESTS.length, 20, "固有の依頼は20種");
assert.equal(new Set(M.CATERING_REQUESTS.map(r => r.id)).size, M.CATERING_REQUESTS.length, "ID が重ならない");
const fullWidth = text => [...text].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
for (const r of M.CATERING_REQUESTS) {
  assert([0, 1].includes(r.slot), `${r.id}: 昼の会か夜の会`);
  assert(Number.isInteger(r.payout) && r.payout >= 15000, `${r.id}: 手取り15,000円から`);
  assert(r.title && r.client && r.place, `${r.id}: 題・依頼主・場所`);
  assert(r.lime.length >= 1 && r.lime.every(t => typeof t === "string" && t && fullWidth(t) <= 40), `${r.id}: LIMEの本文`);
  assert.equal(r.conditions.length, 3, `${r.id}: 手がかりは3つ`);
  assert.deepEqual(r.options.map(o => o.fit).sort(), ["best", "off", "ok"], `${r.id}: ぴったり・合う・外したが一つずつ`);
  for (const o of r.options) {
    assert(fullWidth(o.label) <= 26, `${r.id}: 選択肢は1行（${o.label}）`);
    assert.equal(Object.values(o.mix).reduce((a, b) => a + b, 0), 12, `${r.id}: ${o.label} は12グラム`);
    for (const id of Object.keys(o.mix)) assert(flavors.has(id), `${r.id}: ${id} は店の葉`);
  }
  // 「三種まで」の依頼は、外した組み合わせだけが四種以上
  if (r.conditions.some(c => c.includes("三種まで"))) {
    for (const o of r.options) assert.equal(Object.keys(o.mix).length > 3, o.fit === "off", `${r.id}: ${o.label}`);
  }
  // 「ミントは入れない／抜き」の依頼は、外した組み合わせだけがミント入り
  if (r.conditions.some(c => /ミントは(抜き|入れない)/.test(c))) {
    for (const o of r.options) assert.equal("mint" in o.mix, o.fit === "off", `${r.id}: ${o.label}`);
  }
  const base = r.bg;
  assert(backgrounds.has(`${base}.png`) || backgrounds.has(`${base}_${r.slot ? "night" : "day"}.png`), `${r.id}: 背景 ${base} がある`);
}
// ぴったりの組み合わせの位置は依頼ごとにばらす（いつも同じ場所を押せば当たる、にしない）
assert.equal(new Set(M.CATERING_REQUESTS.map(r => r.options.findIndex(o => o.fit === "best"))).size, 3, "ぴったりの位置が散らばる");
assert.equal(M.CATERING_SCENE_IDS.length, M.CATERING_REQUESTS.length * 4 + 4 + 6);
for (const id of M.CATERING_SCENE_IDS) assert(scenes.get(id)?.lines?.length, `台本 ${id}`);
assert.deepEqual([...scenes.keys()].sort(), [...M.CATERING_SCENE_IDS].sort(), "台本の過不足なし");
// 台詞に報酬・お金を書かない（コードが付ける）。チップ・現金の受け渡しを描かない
for (const [id, scene] of scenes) for (const line of scene.lines) {
  const text = line.text || "";
  assert.doesNotMatch(text, /上がった|好感度|円|お金|チップを置|お釣り|現金/, `${id}: ${text}`);
  if (line.speaker) assert(["customer", "hajime", "sumi"].includes(line.speaker), `${id}: 新しい人物を作らない（${line.speaker}）`);
}

// ---------------------------------------------------------------- 2. 届く日・一度に一つ・地元だけ
{
  assert.equal(M.cateringRequestDue(save({ chapter: 4 })), null, "第5章だけ");
  assert.equal(M.cateringRequestDue(save({ day: START + M.FIRST_REQUEST_DAY - 2 })), null, "第5章の初日は届かない");
  const first = save({ day: START + M.FIRST_REQUEST_DAY - 1 });
  assert(M.cateringRequestDue(first), `第5章の${M.FIRST_REQUEST_DAY}日目の朝に届く`);
  for (const part of ["prologue", "scheduled", "match", "aftermath", "finale", "cleared"]) {
    assert.equal(M.cateringRequestDue(save({ day: START + 5, flags: { _ch5: { startDay: START, part } } })), null, `${part} では届かない`);
  }
  assert.equal(M.cateringRequestDue(save({ day: START + 5, flags: { _ch5: { startDay: START, part: "free", matchDay: START + 6 } } })), null,
    "勝負の日が決まったら届かない");
  for (const region of ["tokyo", "dubai"]) {
    assert.equal(M.cateringRequestDue(save({ day: START + 5, flags: { _ch2_region: region } })), null, `${region} にいる間は届かない`);
  }
  assert(M.cateringRequestDue(save({ day: START + 5, flags: { _ch2_region: "widehanga" } })), "柚ヶ谷（地元の側）にいても届く");

  const v = save({ day: START + 2 });
  const entry = M.cateringRequestDue(v);
  assert.equal(M.recordCateringOffer(v, entry.id, "m1"), true);
  assert.equal(M.cateringRequestDue(v), null, "一度に一つ");
  assert.equal(M.recordCateringOffer(v, entry.id, "m2"), false, "二つ目は記録しない");
  assert.deepEqual(M.cateringWaiting(v), { id: entry.id, msg: "m1", day: START + 2, accepted: null, until: START + 2 + M.REPLY_DAYS - 1 });
  assert.equal(M.cateringJob(v), null, "返事の前は地図に出ない");
}

// ---------------------------------------------------------------- 3. 返事・期限
{
  // 返事をしないまま締め切り → 次の依頼は締め切りの日から REQUEST_GAP_DAYS 日後
  const v = save({ day: START + 2 });
  M.recordCateringOffer(v, M.cateringRequestDue(v).id, "m1");
  v.day += M.REPLY_DAYS - 1;
  assert.equal(M.expireCatering(v), null, "返事の期限の日はまだ残る");
  v.day += 1;
  const lapsed = M.expireCatering(v);
  assert.deepEqual(lapsed, { id: lapsed.id, msg: "m1", accepted: false });
  assert.equal(M.cateringState(v).offer, null);
  assert.equal(M.cateringState(v).next, START + 2 + M.REPLY_DAYS - 1 + M.REQUEST_GAP_DAYS);
  assert.equal(M.acceptCatering(v, "m1"), false, "締め切られた依頼は引き受けられない");
}
{
  // 引き受ける → 翌日から JOB_DAYS 日のうち、決まった時間帯に作りに行ける
  const v = save({ day: START + 2 });
  const entry = M.cateringRequestDue(v);
  M.recordCateringOffer(v, entry.id, "m1");
  assert.equal(M.acceptCatering(v, "other"), false, "別のLIMEでは引き受けない");
  assert.equal(M.acceptCatering(v, "m1"), true);
  assert.equal(M.acceptCatering(v, "m1"), false, "二度は引き受けない");
  assert.equal(M.declineCatering(v, "m1"), false, "引き受けた後は見送りにならない");
  assert.equal(M.cateringJob(v), null, "引き受けた日はまだ行けない");
  for (let d = 1; d <= M.JOB_DAYS; d++) {
    v.day = START + 2 + d;
    assert.equal(M.cateringJob(v)?.id, entry.id, `引き受けた${d}日後は行ける`);
    assert.equal(M.expireCatering(v), null);
  }
  v.slot = entry.slot;
  assert.equal(M.cateringSlotBlock(entry, v), null, "決まった時間帯は押せる");
  v.slot = 1 - entry.slot;
  assert(M.cateringSlotBlock(entry, v)?.why, "違う時間帯は理由を出して押せない");
  v.flags._ch5 = { ...v.flags._ch5, matchDay: v.day + 1 };
  assert.equal(M.cateringJob(v), null, "勝負の日が決まったら地図から消える");
  delete v.flags._ch5.matchDay;
  v.day += 1;
  assert.equal(M.cateringJob(v), null, "期限の翌日は行けない");
  assert.deepEqual(M.expireCatering(v), { id: entry.id, msg: "m1", accepted: true });
  assert.equal(M.cateringState(v).next, START + 2 + M.JOB_DAYS + M.REQUEST_GAP_DAYS);
  assert.equal(v.kujiTickets, 0, "期限切れは何も減らさない・増やさない");
  assert.equal(v.money, 12345);
}
{
  // 見送る → 叱られない。次の依頼は REQUEST_GAP_DAYS 日後で、別の依頼が巡ってくる
  const v = save({ day: START + 2 });
  const entry = M.cateringRequestDue(v);
  M.recordCateringOffer(v, entry.id, "m1");
  assert.equal(M.declineCatering(v, "m1"), true);
  assert.equal(M.cateringState(v).offer, null);
  v.day += M.REQUEST_GAP_DAYS - 1;
  assert.equal(M.cateringRequestDue(v), null, "見送った直後には来ない");
  v.day += 1;
  const next = M.cateringRequestDue(v);
  assert(next && next.id !== entry.id, "次は別の依頼");
  assert.equal(v.money, 12345);
}
{
  // 巡回: 届いた順に全種を一巡し、周回の種で始まりがずれる。壊れた記録は空として読む
  const seen = new Set();
  const v = save({ day: START + 2 });
  for (let i = 0; i < M.CATERING_REQUESTS.length; i++) {
    const entry = M.cateringRequestDue(v);
    seen.add(entry.id);
    M.recordCateringOffer(v, entry.id, `m${i}`);
    M.declineCatering(v, `m${i}`);
    v.day += M.REQUEST_GAP_DAYS;
  }
  assert.equal(seen.size, M.CATERING_REQUESTS.length, "全種が一巡する");
  assert.notEqual(M.nextCateringRequest(save({ seed: 0 })).id, M.nextCateringRequest(save({ seed: 1 })).id, "周回の種で始まりがずれる");
  for (const broken of [null, 5, "x", [], { offer: { id: "nope", day: 1, until: 2 }, offers: -1, next: "3" }]) {
    const record = M.cateringState(save({ flags: { [M.CATERING_FLAG]: broken } }));
    assert.equal(record.offer, null);
    assert.equal(record.offers, 0);
    assert.equal(record.next, START + M.FIRST_REQUEST_DAY - 1);
  }
}

// ---------------------------------------------------------------- 4. 合い方 → くじ券＋契約の手取り
const jobSave = (fit, fields = {}) => {
  const v = save({ day: START + 2, ...fields });
  const entry = M.cateringRequestDue(v);
  M.recordCateringOffer(v, entry.id, "m1");
  M.acceptCatering(v, "m1");
  v.day += 1;
  v.slot = entry.slot;
  return { v, entry, index: entry.options.findIndex(o => o.fit === fit) };
};
for (const [fit, want] of Object.entries({ best: 2, ok: 1, off: 0 })) {
  const { v, entry, index } = jobSave(fit);
  let calls = 0;
  const result = M.settleCatering(v, index, n => { calls += 1; return grantKujiTickets(n, "delivery", v); }, payTo(v));
  assert.deepEqual(result, { fit, tickets: want, payout: entry.payout, paid: entry.payout }, `${fit} → くじ券${want}枚`);
  assert.equal(M.CATERING_TICKETS[fit], want);
  assert.equal(calls, want ? 1 : 0, "0枚の時はくじ券を渡す処理を呼ばない");
  assert.equal(v.kujiTickets, want);
  assert.equal(v.money, 12345 + entry.payout, "契約の手取りだけ増える");
  const record = M.cateringState(v);
  assert.equal(record.offer, null, "作り終えた依頼は消える");
  assert.equal(record.served[entry.id], 1);
  assert.deepEqual(record.last, { id: entry.id, day: v.day, performer: "hajime", fit, tickets: want, payout: entry.payout, paid: entry.payout });
  assert.equal(record.next, v.day + M.REQUEST_GAP_DAYS);
  assert.equal(M.cateringJob(v), null);
  assert.equal(M.settleCatering(v, index, grantTo(v)), null, "二度は確定しない");
  assert.equal(v.kujiTickets, want);
}
{
  const { v, entry, index } = jobSave("best");
  for (const bad of [-1, 3, 1.5, null, undefined, "0"]) assert.equal(M.settleCatering(v, bad, grantTo(v)), null, `範囲外の選択 ${bad}`);
  assert.equal(v.kujiTickets, 0);
  v.day -= 1;
  assert.equal(M.settleCatering(v, index, grantTo(v)), null, "引き受けた日は作れない");
  v.day += 1;
  v.kujiTickets = KUJI_TICKET_MAX - 1;
  assert.deepEqual(M.settleCatering(v, index, grantTo(v), payTo(v)), { fit: "best", tickets: 1, payout: entry.payout, paid: entry.payout }, "上限を超える分は渡さず、実際の枚数を記録する");
  assert.equal(v.kujiTickets, KUJI_TICKET_MAX);
}
assert.equal(M.cateringServedTotal(save({ flags: { [M.CATERING_FLAG]: { served: { a: 2, b: 1, c: "x" } } } })), 3);

// ---------------------------------------------------------------- 5. 周回（NG+）: 依頼の記録もくじ券も持ち越さない
{
  assert.equal(carry.classifyFlag(M.CATERING_FLAG), "progression");
  assert.equal(carry.flagVerdict(M.CATERING_FLAG), "reset");
  assert.equal(carry.STATE_KEY_RULES.kujiTickets.verdict, "reset");
  const s = newGame();
  s.chapter = 5;
  s.kujiTickets = 4;
  s.flags[M.CATERING_FLAG] = { next: 9, offers: 3, offer: null, served: { wedding_party: 2 }, last: null };
  const pkg = carry.buildCarryPackage(s);
  assert(!(M.CATERING_FLAG in pkg.flags), "依頼の記録は持ち越さない");
  assert(!("kujiTickets" in pkg), "くじ券は持ち越さない");
}

// ---------------------------------------------------------------- 6. #2455: 火種・心得の盤・大会・エンディング・進行の条件につながない
{
  const code = file => readText(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const file of ["remake/js/chapters/ch5-catering.js", "remake/js/chapters/ch5-catering-model.js"]) {
    const src = code(file);
    assert.doesNotMatch(src, /growth|hidane|火種|giveColored|PLAY_REWARDS|claimPlayRewards|award\w*Exp|earnSceneCompletion/,
      `${file}: 火種・特別な経験値を付けない（経験値は日常ループの普通の行動と同じ）`);
    assert.doesNotMatch(src, /gainAffinity|affinity\[|lovers|romance/, `${file}: 好感度・恋愛を動かさない`);
    // pendingInvite は既存の約束を読むだけ。「ending」の部分一致とEDへの依存を混同しない。
    const progression = /(?:\b|_)tournament\w*|(?:\b|_)ending\w*|chapterFiveProgress|completeChapterFiveScene/;
    for (const forbidden of ["tournamentState", "endingId", "_ch5_ending", "state.ending", "chapterFiveProgress", "completeChapterFiveScene"])
      assert(progression.test(forbidden), `進行依存の禁止検査が働く: ${forbidden}`);
    assert(!progression.test("pendingInvite"));
    assert.doesNotMatch(src, progression, `${file}: 大会・エンディング・進行を動かさない`);
  }
  // 依頼の記録・場面を参照してよいのは、依頼の仕組みと第5章の日常ループ・周回の分類だけ
  const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const rel = `${dir}${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(`${rel}/`, out); }
      else if (/\.(js|json)$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  const files = [...walk("remake/js/"), ...walk("remake/data/"), ...walk("data/")];
  const allowed = ["remake/js/chapters/ch5-catering.js", "remake/js/chapters/ch5-catering-model.js", "remake/js/chapters/ch5-daily.js",
    "remake/js/core/carry.js", "remake/js/daily/tsumugi-schedule.js", "data/dialogue/ch5_catering.json"];
  const hits = files.filter(f => /ch5[-_]catering|CATERING_|Catering/.test(readText(f)));
  assert.deepEqual(hits.filter(f => !allowed.includes(f)), [], "ほかの仕組み（心得の盤・大会・エンディング・進行）から参照しない");
}

console.log("[ch5 catering] PASS: data, schedule (ch5 free days, home, one at a time), reply/job expiry, fit → tickets (2/1/0) + payout, NG+ reset, #2455");


await import("./ch5_catering_delegation.mjs");

// 実際のセーブ移行も委託由来の予定マーカーを保つ（TRPGの既存予定を破壊しない）。
{
  const s = newGame();
  s.chapter = 5;
  s.day = START + 2;
  s.slot = 0;
  s.flags._ch5 = { startDay: START, part: "free" };
  s.flags._ch2_region = "home";
  const existing = { id: "tsumugi", chapter: 5, day: s.day + 1, slot: 1, busy: false, reason: "休み" };
  s.trpg.shifts = [existing];
  assert(M.recordCateringOffer(s, "wedding_party", "migration-request"));
  assert(M.delegateCatering(s, "migration-request", { day: s.day + 1 }));
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  const loaded = load();
  assert(loaded, "委託予約を持つセーブをロードできる");
  assert.equal(loaded.trpg.shifts[0].cateringMsg, "migration-request", "移行は委託の出所を残す");
  assert.equal(loaded.trpg.shifts[0].busy, true);
  assert.deepEqual(loaded.trpg.shifts[1], existing, "移行後も元の予定を保持する");
  const { tsumugiAtTonari } = await import("../js/daily/tsumugi-schedule.js");
  loaded.day++; loaded.slot = 1;
  assert.equal(tsumugiAtTonari(loaded), false, "実LOAD後も委託枠は在店しない");
  assert(M.closeCatering(loaded));
  assert.deepEqual(loaded.trpg.shifts, [existing], "移行後の取消も委託由来だけを除く");
  assert.equal(tsumugiAtTonari(loaded), true, "取消後は元の在店へ戻る");
}

// Rendering adapters are stubbed, but the actual chapter and catering modules execute.
for (const file of ["ch5_catering_integration.mjs", "ch5_tonari_manager.mjs"]) {
  execFileSync(process.execPath, ["--experimental-vm-modules", new URL(file, import.meta.url).pathname], { stdio: "inherit" });
}
