// 好感度の伸び（HF01）・みんとの公私の呼び名（HF02）・かふかの身長（HF03）・
// 好感度MAXの締めくくりと途中の恋愛／友情の質問（HF04/HF05）・専用ハガル（HF06）を、
// 本番のモジュールと会話エンジンで確かめる。
// リポジトリのルートで http.server 8123 を起動してから: node remake/test/bonds.mjs（BASE_URL で変更可）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const log = (...a) => console.log("[remake bonds]", ...a);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/", { waitUntil: "load" });
  await page.waitForSelector('[data-test="title-new"]', { timeout: 20000 });
  await page.evaluate(async () => {
    const T = {
      core: await import("./js/core/state.js"),
      stats: await import("./js/core/stats.js"),
      data: await import("./js/core/data.js"),
      vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"),
      bonds: await import("./js/daily/bonds.js"),
      romance: await import("./js/daily/romance.js"),
      spots: await import("./js/daily/spots.js"),
      phone: await import("./js/daily/phone.js"),
      shop: await import("./js/daily/shop.js"),
      score: await import("./js/craft/score.js"),
      art: await import("./js/craft/art.js"),
    };
    T.ch1.setupHooks();
    T.vn.vnTest.turbo = true;
    /** 新しいゲーム（日常パート・指定日の夜など） */
    T.fresh = (over = {}) => {
      T.core.newGame();
      Object.assign(T.core.state, { phase: "daily", day: 5, slot: 1 }, over);
      T.vn.backlog().length = 0;
      T.vn.vnTest.choose = null;
      return T.core.state;
    };
    /** 選択肢を文言で選ぶ（含まれる語の順に探す。見つからなければ先頭） */
    T.pick = (...words) => { T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex((l) => words.some((w) => l.includes(w)))); };
    T.names = () => T.vn.backlog().filter((l) => l.name && l.name !== "▶");
    window.T = T;
  });

  // ================================================================ HF01 好感度の伸び
  const pace = await page.evaluate(() => {
    const { fresh, stats } = window.T;
    const out = [];
    for (const charm of [10, 30, 50, 70, 90]) { // ★1〜★5
      for (const [pts, times] of [[1, 100], [2, 100], [5, 40], [10, 10]]) {
        const state = fresh();
        state.stats.charm = charm;
        const mult = 1 + 0.2 * stats.tier01("charm");
        for (let i = 0; i < times; i++) stats.gainAffinity("naru", pts);
        out.push({ charm, pts, times, got: state.affinity.naru, legacy: Math.round(pts * mult) * times, carry: state.affinityCarry.naru });
      }
    }
    // 占い（一度だけ ×1.5）
    let state = fresh();
    state.fortune = { char: "rin" };
    stats.gainAffinity("rin", 10);
    const fortune = { got: state.affinity.rin, carry: state.affinityCarry.rin, left: state.fortune };
    stats.gainAffinity("rin", 10);
    fortune.second = state.affinity.rin;
    // 恋人の絆: 私的な場面でだけ、従来の半分
    state = fresh({ lovers: ["tsumugi"], loveLevel: { tsumugi: 1 }, lovePts: { tsumugi: 9 } });
    stats.gainAffinity("tsumugi", 10);
    const shop = state.lovePts.tsumugi;
    stats.bond.private = true;
    stats.gainAffinity("tsumugi", 10);
    stats.gainAffinity("tsumugi", 1);
    stats.gainAffinity("tsumugi", 1);
    stats.bond.private = false;
    const lover = { shop, after: state.lovePts.tsumugi, carry: state.loveCarry.tsumugi };
    // MAXだけでは告白を予約しない
    state = fresh();
    for (let i = 0; i < 12; i++) stats.gainAffinity("tsumugi", 10);
    const max = { level: stats.affinityLevel("tsumugi"), due: state.flags._confession_due ?? null };
    return { out, fortune, lover, max };
  });
  for (const r of pace.out) {
    assert(r.got <= r.legacy, `more than legacy: ${JSON.stringify(r)}`);
    assert(Math.abs(r.got + r.carry - r.legacy * 0.85) < 1e-6, `not 85%: ${JSON.stringify(r)}`);
  }
  assert.deepEqual(pace.out.filter((r) => r.pts === 1).map((r) => r.got), [85, 85, 85, 85, 85]);
  assert.equal(pace.fortune.got, 12); assert.equal(pace.fortune.left, undefined); assert.equal(pace.fortune.second, 12 + 9); // 0.75 の端数を持ち越す
  assert.equal(pace.lover.shop, 9, "lover affinity must not grow outside private scenes");
  assert.equal(pace.lover.after, 9 + 5 + 1); assert.equal(pace.lover.carry, 0);
  assert.equal(pace.max.level, 5); assert.equal(pace.max.due, null);
  log("HF01 pace: small rewards <= legacy, 85% at every charm tier, fortune once, lover half/private only, no MAX auto-confession");

  // 端数・絆・好感度は保存とロードで消えない（旧スキーマ7からも）
  const carry = await page.evaluate(() => {
    const { core, stats, fresh } = window.T;
    const state = fresh();
    stats.gainAffinity("adam", 1);
    core.save();
    const loaded = core.load();
    const old = core.newState();
    old.schema = 7; old.affinity.minto = 40; old.affinityCarry = { minto: 0.7 }; old.loveCarry = { rin: 0.5 };
    old.lovers = ["rin"]; old.loveLevel = { rin: 2 }; old.lovePts = { rin: 25 };
    old.flags._confession_due = "minto"; old.flags._confession_wait = 9;
    delete old.romance; delete old.romanceChoices; delete old.finales;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
    const migrated = core.load();
    return { carry: loaded.affinityCarry.adam, pts: loaded.affinity.adam, schema: migrated.schema, expected: core.SCHEMA,
      oldAff: migrated.affinity.minto, oldCarry: migrated.affinityCarry.minto, loveCarry: migrated.loveCarry.rin, lovers: migrated.lovers,
      due: migrated.flags._confession_due ?? null, wait: migrated.flags._confession_wait ?? null,
      romance: migrated.romance, choices: migrated.romanceChoices, finales: migrated.finales, before: state === loaded };
  });
  assert.equal(carry.carry, 0.85); assert.equal(carry.pts, 0);
  assert.equal(carry.schema, carry.expected); assert.equal(carry.expected, 8);
  assert.equal(carry.oldAff, 40); assert.equal(carry.oldCarry, 0.7); assert.equal(carry.loveCarry, 0.5); assert.deepEqual(carry.lovers, ["rin"]);
  assert.equal(carry.due, null, "old automatic confession reservation must be dropped");
  assert.equal(carry.wait, null);
  assert.deepEqual(carry.romance, {}); assert.deepEqual(carry.choices, {}); assert.deepEqual(carry.finales, {});
  log("HF01 save/load: carry and bond kept, schema 7 -> 8, old auto confession dropped, lovers kept");

  // ================================================================ HF02 みんとの公私の呼び名
  const names = await page.evaluate(async () => {
    const { data, vn, fresh, names, DB = window.__remake.DB } = window.T;
    const n = (state, ctx) => data.displayName("minto", state, { context: ctx });
    let state = fresh({ met: { minto: true } });
    const before = { pub: n(state, null), priv: n(state, "private"), onee: data.displayName("oneesan", state, { context: "private" }) };
    state.flags._minto_name_known = true;
    const after = { pub: n(state, null), priv: n(state, "private"), call: data.callName("minto", state, { context: "private" }),
      callPub: data.callName("minto", state), onee: data.displayName("oneesan", state, { context: "private" }) };
    // 私服の初デート: 名乗りの前は「みんと」、本名を聞いた後の台詞から「栞」
    state = fresh({ met: { minto: true } });
    await vn.play("ch1_minto_fifth");
    const fifth = names().filter((l) => l.name === "みんと" || l.name === "栞").map((l) => l.name);
    // 本名を知った後: 私的な場面は「栞」、閉店後の店内（まだ店の装い）は「みんと」
    state = fresh({ met: { minto: true }, flags: { _minto_identity_revealed: true, _minto_name_known: true } });
    await vn.play("ch1_minto_private_1");
    const privateNames = [...new Set(names().filter((l) => l.text && DB.dialogues.ch1_minto_private_1.lines.some((x) => x.speaker === "minto" && x.text === l.text)).map((l) => l.name))];
    vn.backlog().length = 0;
    await vn.play("ch1_minto_phantom_smell");
    const shopNames = [...new Set(names().filter((l) => DB.dialogues.ch1_minto_phantom_smell.lines.some((x) => x.speaker === "minto" && x.text === l.text)).map((l) => l.name))];
    // 告白（分岐先の受け入れも私的な場面のまま）
    vn.backlog().length = 0;
    window.T.pick("付き合ってください");
    await vn.play("confession_minto");
    const confession = [...new Set(names().filter((l) => /栞|みんと/.test(l.name)).map((l) => l.name))];
    const lover = state.lovers.slice();
    // ジム: 本名を聞く前後で呼び方と地の文が変わる
    state = fresh({ met: { minto: true } });
    await vn.play("choizap_minto");
    const gymBefore = { names: [...new Set(names().map((l) => l.name).filter((x) => x !== "はじめ"))], text: vn.backlog().map((l) => l.text).join("|") };
    state = fresh({ met: { minto: true }, flags: { _minto_name_known: true } });
    await vn.play("choizap_minto");
    const gymAfter = { names: [...new Set(names().map((l) => l.name).filter((x) => x !== "はじめ"))], text: vn.backlog().map((l) => l.text).join("|") };
    // お姉さん（名乗る前の tonari の私服客）
    state = fresh();
    await vn.play("ch1_tutorial_oneesan");
    const tutorial = [...new Set(names().map((l) => l.name).filter((x) => x !== "はじめ" && x !== "スミさん"))];
    return { before, after, fifth, privateNames, shopNames, confession, lover, gymBefore, gymAfter, tutorial };
  });
  assert.deepEqual(names.before, { pub: "みんと", priv: "みんと", onee: "お姉さん" });
  assert.deepEqual(names.after, { pub: "みんと", priv: "栞", call: "栞さん", callPub: "みんと", onee: "お姉さん" });
  assert.equal(names.fifth[0], "みんと"); assert.equal(names.fifth.at(-1), "栞");
  assert(names.fifth.indexOf("栞") > 0 && names.fifth.slice(names.fifth.indexOf("栞")).every((x) => x === "栞"), "name changed back after reveal");
  assert.deepEqual(names.privateNames, ["栞"]);
  assert.deepEqual(names.shopNames, ["みんと"]);
  assert.deepEqual(names.confession, ["栞"]); assert.deepEqual(names.lover, ["minto"]);
  assert.deepEqual(names.gymBefore.names, ["みんと"]); assert(names.gymBefore.text.includes("みんとだ"));
  assert.deepEqual(names.gymAfter.names, ["栞"]); assert(names.gymAfter.text.includes("栞さんだ")); assert(!names.gymAfter.text.includes("みんとだ"));
  assert.deepEqual(names.tutorial, ["お姉さん"]);
  log("HF02 names: public みんと / private 栞 only after the name, reveal mid-scene, jump keeps context, gym, お姉さん");

  // LIME の名前・告白前の一拍・デート（私的な場面）
  const privateUi = await page.evaluate(async () => {
    const { fresh, phone, romance, core } = window.T;
    const state = fresh({ met: { minto: true }, contacts: ["minto"], flags: { _minto_identity_revealed: true, _minto_name_known: true } });
    state.inbox.push({ id: "probe", originId: "probe", day: state.day, read: true, done: true, replyState: "none", log: [],
      msg: { id: "probe", sender: "minto", type: "chat", messages: ["おはよう"] } });
    const session = phone.openLime({});
    await new Promise((r) => setTimeout(r, 300));
    const listName = document.querySelector('[data-test="lime-chat-minto"] .lcr-name')?.textContent;
    document.querySelector('[data-test="phone-close"]').click();
    await session;
    // 告白の前の一拍と、立ち止まる内心
    Object.assign(state, { slot: 2, finales: { minto: { day: 5, chapter: 1, route: "romance" } },
      romanceChoices: { bond_q1_minto: { char: "minto", value: 1 }, bond_q2_minto: { char: "minto", value: 1 } } });
    let beat = "";
    window.T.pick("まだ");
    await romance.maybeConfession(async (t) => { beat = t; });
    const gate = window.T.vn.backlog().map((l) => l.text).join("|");
    core.save();
    return { listName, beat, gate, due: state.flags._confession_due };
  });
  assert.equal(privateUi.listName, "栞");
  assert(privateUi.beat.includes("栞さん"), privateUi.beat);
  assert(privateUi.gate.includes("栞さんのことを考えると"), privateUi.gate);
  assert.equal(privateUi.due, "minto", "deferring at the gate keeps the reservation");
  log("HF02 LIME list name 栞, confession beat/gate use 栞さん, gate defer keeps reservation");

  // 共有データ: 私的な場面のみんとは ura_*、ura_* は私的な場面か「お姉さん」だけ。結末・設定の古い記述
  const shared = await page.evaluate(async () => {
    const { DB } = window.__remake;
    const problems = [];
    for (const d of Object.values(DB.dialogues)) {
      const rows = [...(d.lines || []), ...Object.values(d.branches || {}).flat()];
      for (const l of rows) {
        if (l.speaker !== "minto") continue;
        const ura = String(l.face || "").startsWith("ura_");
        if (d.metadata?.private_scene && !ura) problems.push(`${d.dialogue_id}: store face in private scene`);
        if (ura && !d.metadata?.private_scene) problems.push(`${d.dialogue_id}: ura face outside private scene`);
        if (ura && !DB.manifest.portraits.minto.faces.includes(l.face)) problems.push(`${d.dialogue_id}: missing sprite ${l.face}`);
      }
    }
    const ending = await (await fetch("../data/dialogue/ending.json")).json();
    const epi = ending.dialogues.find((d) => d.dialogue_id === "epilogue_minto");
    const epiText = JSON.stringify(epi);
    const accept = JSON.stringify(DB.dialogues.confession_minto_accept);
    const outing = DB.lime.find((m) => m.id === "lime_outing_minto_1");
    return { problems, epiPrivate: !!epi.metadata?.private_scene,
      epiFaces: [...new Set(epi.lines.filter((l) => l.speaker === "minto").map((l) => l.face))],
      epiHeart: /♡|みんとが|だんな様|彼女の彼女/.test(epiText), epiJump: epi.lines.at(-1),
      acceptOld: accept.includes("みんとにバレ"), rule: DB.characters.minto.appearance_rules.private_date,
      privateName: DB.characters.minto.private_name, outingExclude: outing.exclude_flag,
      kafuka: DB.kafuka.profile.height_cm, kafukaAge: DB.kafuka.profile.age, kafukaRomance: DB.kafuka.profile.romance_available };
  });
  assert.deepEqual(shared.problems, []);
  assert(shared.epiPrivate); assert(shared.epiFaces.every((f) => f.startsWith("ura_")), shared.epiFaces.join());
  assert(!shared.epiHeart, "epilogue still has the store tone or the doubled 彼女");
  assert.deepEqual(shared.epiJump, { type: "jump", next_id: "ending_daily_smoke" });
  assert(!shared.acceptOld); assert(!shared.rule.includes("恋人ルート確定後のデートシーンでのみ"));
  assert.equal(shared.privateName, "栞"); assert.equal(shared.outingExclude, "_minto_identity_revealed");
  log("HF02 data: ura faces <-> private scenes, epilogue private/calm, confession text, appearance rule, first outing before reveal");
  // HF03
  assert.equal(shared.kafuka, 156); assert.equal(shared.kafukaAge, 20); assert.equal(shared.kafukaRomance, false);
  log("HF03 kafuka height 156cm (age and romance unchanged)");

  // ================================================================ HF04/HF05 途中の質問と締めくくり
  // つむぎ: 友情寄りの答え → 締めくくりは友情の着地、贈り物あり、告白なし。再読で恋愛値を稼げない
  const friend = await page.evaluate(async () => {
    const { fresh, spots, bonds, romance, vn, pick, core } = window.T;
    const state = fresh({ met: { tsumugi: true }, story: { tsumugi: 3 }, slot: 1 });
    pick("ゆっくりしていって", "声をかける", "気持ち悪くなんかない");
    await spots.visitChar("tsumugi"); // 4つ目の固有会話 → 続けて途中の質問
    const afterFourth = { story: state.story.tsumugi, answer: { ...state.romanceChoices.bond_q1_tsumugi }, romance: bonds.romanceValue("tsumugi") };
    pick("会いたい");
    await vn.play("ch1_tsumugi_bond_question"); // 同じ質問をもう一度読んでも数えない
    const reread = { answer: state.romanceChoices.bond_q1_tsumugi.value, romance: bonds.romanceValue("tsumugi") };
    // MAXでも残りの固有会話を飛ばさない
    state.affinity.tsumugi = 90;
    state.slot = 1;
    await spots.visitChar("tsumugi");
    await spots.visitChar("tsumugi");
    const storiesFirst = { story: state.story.tsumugi, seen: !!state.finales.tsumugi };
    // 締めくくりは閉店後（夜）だけ
    state.slot = 0;
    const noonBadge = spots.hasNewStory("tsumugi");
    await spots.visitChar("tsumugi");
    const noon = !!state.finales.tsumugi;
    state.slot = 1;
    const nightBadge = spots.hasNewStory("tsumugi");
    vn.backlog().length = 0;
    await spots.visitChar("tsumugi");
    const finaleText = vn.backlog().map((l) => l.text).join("|");
    const record = { ...state.finales.tsumugi };
    const owned = state.owned.includes("suyaki_tsumugi");
    const lavender = state.flavorStock.lavender;
    state.slot = 2;
    const confessed = await romance.maybeConfession(async () => {});
    const again = (await spots.visitChar("tsumugi"), state.owned.filter((x) => x === "suyaki_tsumugi").length);
    const lavenderAfter = state.flavorStock.lavender;
    core.save();
    return { afterFourth, reread, storiesFirst, noonBadge, noon, nightBadge, finaleText, record, owned, lavender, confessed, again, lavenderAfter,
      due: state.flags._confession_due ?? null, after: bonds.finaleAtVisit("tsumugi") };
  });
  assert.equal(friend.afterFourth.story, 4); assert.equal(friend.afterFourth.answer.value, 0); assert.equal(friend.afterFourth.romance, 0);
  assert.equal(friend.reread.answer, 0); assert.equal(friend.reread.romance, 0);
  assert.equal(friend.storiesFirst.story, 6); assert.equal(friend.storiesFirst.seen, false);
  assert.equal(friend.noonBadge, false); assert.equal(friend.noon, false); assert.equal(friend.nightBadge, true);
  assert(friend.finaleText.includes("描き終わった絵、最初に見てほしくて"));
  assert(friend.finaleText.includes("いつもの席で"), "friendship landing missing");
  assert(!friend.finaleText.includes("今度は二人で"), "romance question shown after a friendly answer");
  assert.equal(friend.record.route, "friend"); assert(friend.owned); assert.equal(friend.lavender, 50);
  assert.equal(friend.confessed, false); assert.equal(friend.due, null);
  assert.equal(friend.again, 1); assert.equal(friend.lavenderAfter, 50); assert.equal(friend.after, false);
  log("HF04/05 tsumugi friendship: question once, no re-read gain, stories before MAX finale, night only, gift once, no confession");

  // つむぎ: 恋愛寄りに答え続けた → 締めくくりの最後の質問 → 恋愛ルート → 夜の帰り道で告白 → 恋人
  const love = await page.evaluate(async () => {
    const { fresh, spots, bonds, romance, vn, pick } = window.T;
    const state = fresh({ met: { tsumugi: true }, story: { tsumugi: 3 }, slot: 1 });
    pick("会いたい", "声をかける", "気持ち悪くなんかない");
    await spots.visitChar("tsumugi");
    const q1 = bonds.romanceValue("tsumugi");
    state.story.tsumugi = 6; state.affinity.tsumugi = 90;
    pick("今度は二人で");
    vn.backlog().length = 0;
    await spots.visitChar("tsumugi");
    const text = vn.backlog().map((l) => l.text).join("|");
    const route = state.finales.tsumugi.route;
    const due = state.flags._confession_due;
    state.slot = 2;
    pick("今日、想いを伝えよう", "付き合ってください", "好き");
    const confessed = await romance.maybeConfession(async () => {});
    return { q1, text, route, due, confessed, lovers: state.lovers.slice(), romance: bonds.romanceValue("tsumugi"), owned: state.owned.includes("suyaki_tsumugi") };
  });
  assert.equal(love.q1, 1); assert(love.text.includes("二人で、ですか")); assert.equal(love.route, "romance"); assert.equal(love.due, "tsumugi");
  assert.equal(love.confessed, true); assert.deepEqual(love.lovers, ["tsumugi"]); assert.equal(love.romance, 2); assert(love.owned);
  log("HF04/05 tsumugi romance: two romantic answers -> romance route -> confession at night -> lovers, gift too");

  // 恋愛寄り→最後に友情寄り: 友情の着地・告白なし ／ 旧セーブ（質問を読み終えていた）: 最後の質問だけで決める
  const mixed = await page.evaluate(async () => {
    const { fresh, spots, bonds, romance, pick, core } = window.T;
    let state = fresh({ met: { tsumugi: true }, story: { tsumugi: 3 }, slot: 1 });
    pick("会いたい", "声をかける", "気持ち悪くなんかない");
    await spots.visitChar("tsumugi");
    state.story.tsumugi = 6; state.affinity.tsumugi = 90;
    pick("大事に使うよ");
    await spots.visitChar("tsumugi");
    const lateFriend = { route: state.finales.tsumugi.route, due: state.flags._confession_due ?? null };
    state.slot = 2;
    lateFriend.confessed = await romance.maybeConfession(async () => {});
    // 旧スキーマ7: 好感度MAX・固有会話済み・自動予約あり → 予約は消え、締めくくりで答えた分だけで判断
    const old = core.newState();
    Object.assign(old, { schema: 7, phase: "daily", day: 9, slot: 1, met: { tsumugi: true }, story: { tsumugi: 6 }, affinity: { tsumugi: 80 } });
    old.flags._confession_due = "tsumugi";
    delete old.romance; delete old.romanceChoices; delete old.finales;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
    state = core.load();
    const dueAfterLoad = state.flags._confession_due ?? null;
    pick("今度は二人で");
    await spots.visitChar("tsumugi");
    const oldRoute = { route: state.finales.tsumugi.route, due: state.flags._confession_due ?? null, missed: !state.romanceChoices.bond_q1_tsumugi };
    return { lateFriend, dueAfterLoad, oldRoute };
  });
  assert.deepEqual(mixed.lateFriend, { route: "friend", due: null, confessed: false });
  assert.equal(mixed.dueAfterLoad, null);
  assert.deepEqual(mixed.oldRoute, { route: "romance", due: "tsumugi", missed: true });
  log("HF04/05 late friendly answer -> friendship; old MAX save: auto reservation dropped, finale question decides");

  // 元から恋人の旧セーブ: 関係は維持、締めくくりは恋人の着地で一度だけ、告白の予約なし
  const loverSave = await page.evaluate(async () => {
    const { core, bonds, vn, spots } = window.T;
    const old = core.newState();
    Object.assign(old, { schema: 7, phase: "daily", day: 10, slot: 1, met: { tsumugi: true }, story: { tsumugi: 6 }, affinity: { tsumugi: 70 },
      lovers: ["tsumugi"], loveLevel: { tsumugi: 3 }, lovePts: { tsumugi: 30 }, loverSince: { tsumugi: 6 } });
    delete old.romance; delete old.romanceChoices; delete old.finales;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
    const state = core.load();
    vn.backlog().length = 0;
    await spots.visitChar("tsumugi");
    const text = vn.backlog().map((l) => l.text).join("|");
    return { lovers: state.lovers, level: state.loveLevel.tsumugi, route: state.finales.tsumugi.route, owned: state.owned.includes("suyaki_tsumugi"),
      due: state.flags._confession_due ?? null, text, asked: Object.keys(state.romanceChoices) };
  });
  assert.deepEqual(loverSave.lovers, ["tsumugi"]); assert.equal(loverSave.level, 3); assert.equal(loverSave.route, "lover");
  assert(loverSave.owned); assert.equal(loverSave.due, null); assert(loverSave.text.includes("会えない日も少し近い"));
  assert.deepEqual(loverSave.asked, []);
  log("HF04/05 existing-lover save: relationship kept, lover landing once, gift, no confession reservation");

  // 凛: 3つ目の固有会話の後の最初の訪問で質問 → その後にMAXの締めくくり（友情寄り）
  const rin = await page.evaluate(async () => {
    const { fresh, spots, bonds, vn, pick } = window.T;
    const state = fresh({ met: { rin: true }, story: { rin: 3 }, affinity: { rin: 90 }, slot: 0 });
    const badge = spots.hasNewStory("rin");
    const finaleBlocked = bonds.finaleAtVisit("rin");
    pick("試香も");
    vn.backlog().length = 0;
    await spots.visitChar("rin");
    const first = vn.backlog().map((l) => l.text).join("|");
    vn.backlog().length = 0;
    await spots.visitChar("rin");
    const second = vn.backlog().map((l) => l.text).join("|");
    return { badge, finaleBlocked, first, second, answer: state.romanceChoices.bond_q1_rin?.value, route: state.finales.rin?.route, owned: state.owned.includes("suyaki_rin") };
  });
  assert.equal(rin.badge, true); assert.equal(rin.finaleBlocked, false);
  assert(rin.first.includes("試香の感想を言いに")); assert(!rin.first.includes("ラベルも同意書もない"));
  assert(rin.second.includes("ラベルも同意書もない")); assert(rin.second.includes("仕事仲間からのプレゼント"));
  assert.equal(rin.answer, 0); assert.equal(rin.route, "friend"); assert(rin.owned);
  log("HF04/05 rin: question visit before the MAX finale, friendship landing with a personal gift");

  // スミ・なる・アダム（友情）: 締めくくりと贈り物。スミさんは閉店後だけ
  const friends = await page.evaluate(async () => {
    const { fresh, spots, vn } = window.T;
    const out = {};
    for (const [id, slot] of [["sumi", 0], ["sumi", 1], ["naru", 0], ["adam", 0]]) {
      const state = fresh({ met: { [id]: true }, story: { [id]: 6 }, affinity: { [id]: 80 }, slot });
      vn.backlog().length = 0;
      await spots.visitChar(id);
      out[`${id}_${slot}`] = { route: state.finales[id]?.route || null, gift: state.owned.filter((x) => x.startsWith("suyaki_")),
        text: vn.backlog().map((l) => l.text).join("|"), cardamom: state.flavorStock.cardamom || 0 };
    }
    return out;
  });
  assert.equal(friends.sumi_0.route, null); assert.deepEqual(friends.sumi_0.gift, []);
  assert.equal(friends.sumi_1.route, "friend"); assert.deepEqual(friends.sumi_1.gift, ["suyaki_sumi"]); assert.equal(friends.sumi_1.cardamom, 50);
  assert(friends.sumi_1.text.includes("金を取るなら半額だな"));
  assert.equal(friends.naru_0.route, "friend"); assert.deepEqual(friends.naru_0.gift, ["suyaki_naru"]); assert(friends.naru_0.text.includes("次はお前の煙を吸わせろ"));
  assert.equal(friends.adam_0.route, "friend"); assert.deepEqual(friends.adam_0.gift, ["suyaki_adam"]); assert(friends.adam_0.text.includes("手入れ大全"));
  log("HF04 sumi(night only)/naru/adam: friendship finales with their own hagal");

  // みんと: 私的な約束（LIMEの誘い）で締めくくり。休日は午後・それ以外は仕事後、断っても二日後に改めて届く
  const minto = await page.evaluate(async () => {
    const { fresh, phone, bonds, spots, pick, vn } = window.T;
    const base = { met: { minto: true }, contacts: ["minto"], story: { minto: 6 }, affinity: { minto: 90 },
      flags: { _minto_identity_revealed: true, _minto_name_known: true, _minto_fifth_done: true }, slot: 0 };
    let state = fresh({ ...base, flags: { ...base.flags }, day: 13 }); // 13 % 7 === 6 → PEPPERMINT の定休日
    const atShop = bonds.finaleAtVisit("minto");
    const holiday = phone.morningMessages({ fixedNight: () => false }).find((m) => m.accept_event === "ch1_minto_bond_finale");
    state = fresh({ ...base, flags: { ...base.flags }, day: 8 });
    const workday = phone.morningMessages({ fixedNight: () => false }).find((m) => m.accept_event === "ch1_minto_bond_finale");
    const fixedNight = phone.morningMessages({ fixedNight: () => true }).find((m) => m.accept_event === "ch1_minto_bond_finale") || null;
    // 受け取って断る → 翌日は来ない → 二日後に改めて（前置きつき）
    phone.deliverMorning({ fixedNight: () => false });
    const item = state.inbox.find((i) => i.msg.accept_event === "ch1_minto_bond_finale");
    Object.assign(item, { read: true, done: true, result: "declined", replyState: "replied" });
    state.limeRead.push(item.id);
    state.day = 9;
    const nextDay = phone.morningMessages({ fixedNight: () => false }).some((m) => m.accept_event === "ch1_minto_bond_finale");
    state.day = 10;
    const retry = phone.morningMessages({ fixedNight: () => false }).find((m) => m.accept_event === "ch1_minto_bond_finale");
    // 会う: 私的な場面（栞・ura_*）・恋愛に進める相手は最後の質問 → 友情寄りを選ぶ
    pick("友達でいる");
    vn.backlog().length = 0;
    await bonds.playFinale("minto");
    const scene = window.T.names().filter((l) => l.name !== "はじめ").map((l) => l.name);
    const afterSeen = phone.morningMessages({ fixedNight: () => false }).some((m) => m.accept_event === "ch1_minto_bond_finale");
    // 本名を聞く前は誘いも来ない
    state = fresh({ ...base, flags: { _minto_identity_revealed: true }, day: 13 });
    const noName = bonds.finaleDue("minto");
    return { atShop, holiday: holiday && { slot: holiday.time_slot, closed: holiday.closed_on, text: JSON.stringify(holiday.messages) },
      workday: workday && { slot: workday.time_slot, after: workday.after_close, text: JSON.stringify(workday.messages) },
      fixedNight, nextDay, retry: retry && { id: retry.id, origin: retry.origin_id, first: JSON.stringify(retry.messages[0]) },
      scene: [...new Set(scene)], afterSeen, noName };
  });
  assert.equal(minto.atShop, false, "Minto's finale is a private meeting, not a store visit");
  assert.deepEqual([minto.holiday.slot, minto.holiday.closed], ["noon", 6]); assert(minto.holiday.text.includes("お店がお休み"));
  assert.equal(minto.workday.slot, "night"); assert(minto.workday.after); assert(minto.workday.text.includes("仕事を終えたあと"));
  assert(!/\{private/.test(minto.holiday.text + minto.workday.text));
  assert.equal(minto.fixedNight, null);
  assert.equal(minto.nextDay, false);
  assert(minto.retry && minto.retry.origin === "lime_minto_bond_finale" && minto.retry.id.endsWith("_d10")); assert(minto.retry.first.includes("この前は都合が合わなかった"));
  assert.deepEqual(minto.scene, ["栞"]); assert.equal(minto.afterSeen, false); assert.equal(minto.noName, false);
  log("HF04/05 minto: private invitation (holiday noon / after close), not on fixed nights, re-offered after decline, private 栞 scene");

  // ================================================================ HF06 専用ハガル
  const gifts = await page.evaluate(async () => {
    const { fresh, shop, score, art, core, DB = window.__remake.DB } = window.T;
    const ids = ["suyaki_sumi", "suyaki_naru", "suyaki_adam", "suyaki_tsumugi", "suyaki_minto", "suyaki_rin"];
    const data = ids.map((id) => {
      const e = DB.equipById[id];
      const f = DB.flavorById[e.gift.flavor];
      return { id, type: e.type, unsellable: e.unsellable, notForSale: e.not_for_sale, art: e.art, cap: e.capacity, from: e.gift.from,
        flavor: !!f && (f.leaf || "blond") === "blond", forSale: shop.forSale(e), name: e.name };
    });
    const state = fresh();
    state.owned.push("suyaki_minto", "hagal_80beat");
    const refused = shop.sellEquipment("suyaki_minto");
    const stillOwned = state.owned.includes("suyaki_minto");
    const moneyBefore = state.money;
    const sold = shop.sellEquipment("hagal_80beat");
    const moneyGain = state.money - moneyBefore;
    // 店の画面: 販売一覧に出ない・売却タブは「売却不可」
    const opening = shop.openShop();
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('[data-tab="equip"]').click();
    const listed = [...document.querySelectorAll(".shop-row b")].map((b) => b.textContent);
    document.querySelector('[data-tab="sell"]').click();
    const locked = !!document.querySelector('[data-test="sell-locked-suyaki_minto"]');
    const sellButton = !!document.querySelector('[data-test="sell-suyaki_minto"]');
    document.querySelector('[data-test="shop-leave"]').click();
    await opening;
    // 効き: 装備・所持・対象フレーバー3g以上のときだけ
    const cs = (bowl, mix) => ({ mode: "tournament", equip: { bowl, hms: "lotos_hagal", charcoal: "flat_charcoal" }, mix,
      mixInfo: { score: 70, intensity: 5, total: 12 }, holes: { total: 22, outerEven: 0.8, innerExcess: 0, score: 80, minimumComplete: true },
      heat: { heatPower: 60, heatStability: 70, burnRisk: 20, aromaRetention: 60, score: 80 }, pull: { score: 75, pulls: 3 }, steam: { min: 5, score: 75 },
      care: { score: 70 }, pack: "normal", place: "triangle", trial: { score: 70 } });
    const fx = {
      on: score.giftBowlEffect(cs("suyaki_minto", { mint: 3, double_apple: 9 })),
      lowMint: score.giftBowlEffect(cs("suyaki_minto", { mint: 2, double_apple: 10 })),
      otherFlavor: score.giftBowlEffect(cs("suyaki_minto", { double_apple: 9, vanilla: 3 })),
      notEquipped: score.giftBowlEffect(cs("silicone_bowl", { mint: 3, double_apple: 9 })),
    };
    const aroma = (bowl, mix) => score.computeShisha(cs(bowl, mix)).aroma;
    const aromaDiff = aroma("suyaki_minto", { mint: 3, double_apple: 9 }) - aroma("suyaki_hagal", { mint: 3, double_apple: 9 });
    const plainDiff = aroma("suyaki_minto", { double_apple: 12 }) - aroma("suyaki_hagal", { double_apple: 12 });
    const withGift = score.finalize(cs("suyaki_minto", { mint: 3, double_apple: 9 }));
    const clay = score.finalize(cs("suyaki_hagal", { mint: 3, double_apple: 9 }));
    state.owned = state.owned.filter((x) => x !== "suyaki_minto");
    const notOwned = score.giftBowlEffect(cs("suyaki_minto", { mint: 3, double_apple: 9 }));
    state.owned.push("suyaki_minto");
    // 絵: 素焼きとして描き、染みた香りの色を縁に乗せる
    const rig = art.buildRig();
    document.body.append(rig.root);
    rig.update({ equip: { bowl: "suyaki_minto" }, mix: {} });
    const bowlEl = rig.root.querySelector(".rig-bowl");
    const drawn = { clay: bowlEl.querySelector(".rig-bowl-img")?.style.backgroundImage.includes("bowl_empty_clay"), infused: bowlEl.classList.contains("infused") };
    rig.root.remove(); rig.destroy();
    // 保存とロードで所持・装備が残る
    state.equip.bowl = "suyaki_minto";
    core.save();
    const loaded = core.load();
    return { data, refused, stillOwned, sold, moneyGain, listed, locked, sellButton, fx, aromaDiff, plainDiff,
      totalDiff: Math.round((withGift.total - clay.total) * 10) / 10, notes: withGift.bonusNotes, clayNotes: clay.bonusNotes, notOwned, drawn,
      saved: { owned: loaded.owned.includes("suyaki_minto"), equip: loaded.equip.bowl } };
  });
  for (const g of gifts.data) {
    assert.equal(g.type, "bowl", g.id); assert(g.unsellable && g.notForSale, g.id); assert.equal(g.art, "suyaki_hagal", g.id);
    assert.equal(g.cap, 20, g.id); assert(g.flavor, g.id); assert.equal(g.forSale, false, g.id); assert.match(g.name, /が育てた.+専用ハガル$/);
  }
  assert.equal(gifts.data.find((g) => g.id === "suyaki_minto").name, "みんとが育てたミント専用ハガル");
  assert.equal(gifts.refused, false); assert(gifts.stillOwned); assert.equal(gifts.sold, true); assert.equal(gifts.moneyGain, 2000);
  assert(!gifts.listed.some((n) => n.includes("専用ハガル"))); assert(gifts.locked); assert.equal(gifts.sellButton, false);
  assert.deepEqual(gifts.fx.on, { aroma: 4, bonus: 1, note: "みんとが育てたミント専用ハガルに染みた香り" });
  assert.equal(gifts.fx.lowMint, null); assert.equal(gifts.fx.otherFlavor, null); assert.equal(gifts.fx.notEquipped, null); assert.equal(gifts.notOwned, null);
  assert.equal(gifts.aromaDiff, 4); assert.equal(gifts.plainDiff, 0);
  assert(gifts.totalDiff > 1 && gifts.totalDiff < 2, `total diff ${gifts.totalDiff}`);
  assert(gifts.notes.includes("みんとが育てたミント専用ハガルに染みた香り")); assert(!gifts.clayNotes.some((n) => n.includes("専用ハガル")));
  assert.deepEqual(gifts.drawn, { clay: true, infused: true });
  assert.deepEqual(gifts.saved, { owned: true, equip: "suyaki_minto" });
  log("HF06 gifts: six unsellable/non-sale hagal, sell refused in code and UI, small mint-only effect, clay art, save/load");

  // 機材の選択に出る・持ち物に贈り主と香りと売却不可
  const ui = await page.evaluate(async () => {
    const { fresh } = window.T;
    const state = fresh({ met: { tsumugi: true } });
    state.owned.push("suyaki_tsumugi");
    state.flavorStock.lavender = 50;
    const session = await import("./js/craft/session.js");
    const steps = await import("./js/craft/steps.js");
    const cs = session.newSession("rehearsal");
    session.openBench(cs, { steps: [["setup", "SETUP"]] });
    const choosing = steps.stepSetup(cs);
    await new Promise((r) => setTimeout(r, 150));
    const option = document.querySelector('[data-test="opt-suyaki_tsumugi"]');
    const offered = !!option;
    option?.click();
    await choosing;
    const equipped = cs.equip.bowl;
    const status = await import("./js/daily/status.js");
    const opened = status.openStatus();
    await new Promise((r) => setTimeout(r, 150));
    [...document.querySelectorAll(".st-tab")].find((b) => b.dataset.tab === "items").click();
    const note = document.querySelector('[data-test="gift-suyaki_tsumugi"]')?.textContent || "";
    const flavors = [...document.querySelectorAll(".st-items .chip")].map((c) => c.textContent).join("|");
    document.querySelector('[data-test="status-close"]').click();
    await opened;
    return { offered, equipped, note, flavors };
  });
  assert(ui.offered); assert.equal(ui.equipped, "suyaki_tsumugi");
  assert(ui.note.includes("つむぎから") && ui.note.includes("ラベンダー") && ui.note.includes("売却不可"), ui.note);
  assert(ui.flavors.includes("ラベンダー"), ui.flavors);
  log("HF06 UI: gift selectable at setup, inventory shows giver / infused scent / unsellable, gifted leaf listed");

  // ================================================================ HF09 友人になった後の、たまのLIME
  const friendsLime = await page.evaluate(async () => {
    const { fresh, spots, phone, bonds, vn, DB = window.__remake.DB } = window.T;
    const original = DB.lime;
    DB.lime = original.filter((m) => !["sumi", "naru", "adam", "tsumugi", "minto"].includes(m.sender)); // 物語のLIMEと切り分けて数える
    const friendIds = (list) => list.filter((m) => String(m.id).startsWith("_friend_")).map((m) => `${m.sender}:${m.type}:${m.time_slot || "-"}`);
    /** from〜to日の朝を流す。届いたLIMEは読み、誘いは断る。毎日シフトに入る＝スミさんの急なバイト誘いは固定の3日目・8日目だけ */
    const run = (state, from, to) => {
      const timeline = {};
      for (let day = from; day <= to; day++) {
        Object.assign(state, { day, slot: 0, lastBaitoDay: day });
        const got = friendIds(phone.morningMessages({ fixedNight: () => false }));
        if (got.length) timeline[day] = got;
        phone.deliverMorning({ fixedNight: () => false });
        for (const item of state.inbox.filter((i) => !i.read)) {
          Object.assign(item, { read: true, done: true, replyState: "replied", result: item.msg.type === "invitation" ? "declined" : undefined });
          state.limeRead.push(item.id);
        }
      }
      return timeline;
    };
    const friendNote = (day, sender, type = "chat") => ({ id: `_friend_${type === "chat" ? "chat" : "inv"}_${sender}_d${day}`, originId: `_friend_${type === "chat" ? "chat" : "inv"}_${sender}_d${day}`,
      day, read: true, done: true, replyState: "replied", log: [], msg: { id: `_friend_x_${sender}_d${day}`, sender, type, messages: ["……"] } });
    try {
      // なる: 締めくくり（友情）→ 4日あけて雑談 → 4日あけてシーシャのお誘い（定休日は午後）
      const state = fresh({ met: { naru: true, adam: true }, contacts: ["naru", "adam"], story: { naru: 6 }, affinity: { naru: 80 }, slot: 0, day: 2 });
      await spots.visitChar("naru");
      const timeline = run(state, 3, 11);
      const inviteText = JSON.stringify(state.inbox.find((i) => i.msg.type === "invitation" && i.msg.sender === "naru").msg.messages);
      // 3人と友人になっても重ならない: 友人のLIMEは全員で2日に1通・長く連絡のない相手から順。お誘いは全員で6日に1回・雑談のあとだけ
      const trio = fresh({ met: { naru: true, adam: true }, contacts: ["sumi", "naru", "adam"], day: 1,
        finales: { sumi: { day: 1, chapter: 1, route: "friend" }, naru: { day: 1, chapter: 1, route: "friend" }, adam: { day: 1, chapter: 1, route: "friend" } } });
      const rotation = run(trio, 2, 13);
      // スミさんの急なバイト誘い（8日目）は仕事の連絡なので、友人のお誘いと同じ朝に重なってよい（オーナー指定）
      const clash = fresh({ met: { naru: true }, contacts: ["naru"], day: 8, slot: 0, lastBaitoDay: 8, finales: { naru: { day: 1, chapter: 1, route: "friend" } } });
      clash.inbox.push(friendNote(4, "naru"));
      const withBaito = phone.morningMessages({ fixedNight: () => false }).map((m) => `${m.sender}:${m.type}`);
      // 人と会う物語の誘い（ここでは試験用の誘い）が届く朝は、友人のお誘いを重ねず雑談に。翌朝ならお誘い（仕事後）
      Object.assign(clash, { day: 9, lastBaitoDay: 9, contacts: ["naru", "tsumugi"], met: { naru: true, tsumugi: true } });
      const plain = DB.lime;
      DB.lime = [...plain, { id: "_test_story_invite", sender: "tsumugi", type: "invitation", chapter: 1, trigger_condition: "flag",
        trigger_flag: "_test_story_invite", time_slot: "night", accept_event: "test_story_event", messages: ["……今夜、少しだけ会えますか"] }];
      clash.flags._test_story_invite = true;
      const withStory = phone.morningMessages({ fixedNight: () => false }).map((m) => `${m.sender}:${m.type}`);
      DB.lime = plain;
      delete clash.flags._test_story_invite;
      const calm = friendIds(phone.morningMessages({ fixedNight: () => false }));
      // 固定イベントの夜（仕事後の約束が組めない日）は、同じ相手の雑談に切り替える
      const fallback = fresh({ met: { naru: true }, contacts: ["naru"], finales: { naru: { day: 1, chapter: 1, route: "friend" } }, day: 9, lastBaitoDay: 9 });
      fallback.inbox.push(friendNote(5, "naru"));
      const fixedNight = friendIds(phone.morningMessages({ fixedNight: () => true }));
      // 朝に届く友人のLIMEは1通まで（なる・アダムが同時に当番なら、長く連絡のないアダムから）
      fresh({ met: { naru: true, adam: true }, contacts: ["naru", "adam"], day: 9, lastBaitoDay: 9,
        finales: { naru: { day: 2, chapter: 1, route: "friend" }, adam: { day: 1, chapter: 1, route: "friend" } } });
      const oneMorning = friendIds(phone.morningMessages({ fixedNight: () => false }));
      // 恋人・告白待ち・連絡先なし・大会当日には届かない。告白で「友達のまま」なら届く
      const quiet = {};
      let s = fresh({ met: { tsumugi: true }, contacts: ["tsumugi"], day: 9, lovers: ["tsumugi"], finales: { tsumugi: { day: 1, chapter: 1, route: "lover" } } });
      quiet.lover = friendIds(phone.morningMessages({ fixedNight: () => false })).length;
      s = fresh({ met: { tsumugi: true }, contacts: ["tsumugi"], day: 9, finales: { tsumugi: { day: 1, chapter: 1, route: "romance" } } });
      quiet.romance = friendIds(phone.morningMessages({ fixedNight: () => false })).length;
      s.flags._friend_tsumugi = true;
      quiet.rejected = friendIds(phone.morningMessages({ fixedNight: () => false }));
      s = fresh({ met: { adam: true }, contacts: [], day: 9, finales: { adam: { day: 1, chapter: 1, route: "friend" } } });
      quiet.noContact = friendIds(phone.morningMessages({ fixedNight: () => false })).length;
      s.contacts.push("adam");
      quiet.tournament = friendIds(phone.morningMessages({ tournamentDay: true })).length;
      // お誘いに乗った一服: 私的な場面・得意なステ・言い回しは回ごとに入れ替わる
      s = fresh({ met: { minto: true }, slot: 0, finales: { minto: { day: 1, chapter: 1, route: "friend" } }, flags: { _minto_identity_revealed: true, _minto_name_known: true } });
      const charm = s.stats.charm;
      vn.backlog().length = 0;
      await bonds.playFriendHangout("minto");
      const first = vn.backlog().map((l) => `${l.name}:${l.text}`);
      vn.backlog().length = 0;
      await bonds.playFriendHangout("minto");
      const second = vn.backlog().map((l) => l.text);
      return { timeline, inviteText, rotation, withBaito, withStory, calm, fixedNight, oneMorning, quiet, first, second, charmUp: s.stats.charm > charm, count: s.friendHangouts.minto };
    } finally {
      DB.lime = original;
    }
  });
  // 1人なら: 締めくくりの4日後に雑談、さらに4日後にお誘い（10 % 7 === 3 はKEMURIKUSAの定休日＝午後）
  assert.deepEqual(friendsLime.timeline, { 6: ["naru:chat:-"], 10: ["naru:invitation:noon"] });
  assert(friendsLime.inviteText.includes("お店がお休み") && friendsLime.inviteText.includes("一服しようぜ"), friendsLime.inviteText);
  // 3人: 2日に1通・連日や同じ朝に重ならない・同じ相手は4日以上あく・お誘いは雑談のあとで全員で6日に1回
  assert.deepEqual(friendsLime.rotation, {
    5: ["sumi:chat:-"], 7: ["naru:chat:-"], 9: ["adam:chat:-"], 11: ["sumi:invitation:night"], 13: ["naru:chat:-"],
  }, JSON.stringify(friendsLime.rotation));
  // バイトの誘いとは重なってよい／人と会う物語の誘いとは重ねない（雑談に切り替える）
  assert(friendsLime.withBaito.includes("sumi:invitation") && friendsLime.withBaito.includes("naru:invitation")
    && !friendsLime.withBaito.includes("naru:chat"), friendsLime.withBaito.join("|"));
  assert(friendsLime.withStory.includes("tsumugi:invitation") && friendsLime.withStory.includes("naru:chat")
    && !friendsLime.withStory.includes("naru:invitation"), friendsLime.withStory.join("|"));
  assert.deepEqual(friendsLime.calm, ["naru:invitation:night"]);
  assert.deepEqual(friendsLime.fixedNight, ["naru:chat:-"]);
  assert.deepEqual(friendsLime.oneMorning, ["adam:chat:-"]);
  assert.deepEqual(friendsLime.quiet, { lover: 0, romance: 0, rejected: ["tsumugi:chat:-"], noContact: 0, tournament: 0 });
  assert(friendsLime.first.some((l) => l.startsWith("栞:")), friendsLime.first.join("|"));
  assert(friendsLime.first.some((l) => l.includes("栞さんと一服した")), friendsLime.first.join("|"));
  assert(friendsLime.second.some((l) => l.includes("仕事の話はなし")) && !friendsLime.first.some((l) => l.includes("仕事の話はなし")));
  assert(friendsLime.charmUp); assert.equal(friendsLime.count, 2);
  log("HF09 friends: shared cadence (1 friend LIME per 2 days, oldest contact first, 4+ days per person), invites 6+ days apart after a chat, never with a story/lover invitation (Sumi's shift call may overlap), holiday/after-close, none for lovers/pending romance/tournament");

  assert.deepEqual(errors, []);
  log("PASS");
} finally {
  await browser.close();
}
