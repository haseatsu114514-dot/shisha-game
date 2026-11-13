// プチ修羅場（SRB10〜）: 恋人が2人以上いる間の、バレかける小さな場面。実際の画面で、デートの後・店の訪問の後・LIMEの誤爆・
// 視線のカットインの短い版・最後の修羅場に返る一行を確かめる。決まりと台本の検査は remake/test/petit_shuraba.mjs。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, { turbo = true } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async (turbo) => {
    window.H = { core: await import("./js/core/state.js"), romance: await import("./js/daily/romance.js"),
      petit: await import("./js/daily/petit-shuraba.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), ui: await import("./js/core/ui.js"), data: await import("./js/core/data.js") };
    H.ch1.setupHooks(); H.vn.vnTest.turbo = turbo; H.vn.vnTest.choose = () => 0;
    // 第2章 DAY 20（通算日で数える保存）。恋人は呼び出し側が決める
    H.fresh = (lovers, flags = {}) => {
      const s = H.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 20, slot: 1, money: 30000, stamina: 100, lovers,
        loveLevel: Object.fromEntries(lovers.map(id => [id, 1])), contacts: ["sumi", ...lovers] });
      for (const id of ["tsumugi", "minto", "rio", "hiyori", "ageha", "samechan", "naru", "sumi"]) s.met[id] = true;
      Object.assign(s.flags, { _elapsed_calendar: true, _minto_name_known: true, _minto_identity_revealed: true, ...flags });
      H.vn.clearLog();
      return s;
    };
    H.read = () => H.vn.backlog().map(row => row.text);
    H.petitFlags = () => Object.fromEntries(Object.entries(H.core.state.flags).filter(([key]) => key.startsWith("_petit")));
  }, turbo);
}

await suite("petit-shuraba", async check => {
  // デートの終わりに一つずつ: 着信 → その人の気づきかけ。同じ日・翌日には続けて起きない。報酬は無い。
  await check("a-date-with-two-lovers-reads-one-petit-scene-at-a-time", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const s = H.fresh(["minto", "rio"]);
      const before = { stats: { ...s.stats }, guilt: s.guilt, rio: s.lovePts.rio || 0 };
      await H.romance.playDate("minto");
      const first = { flags: H.petitFlags(), read: H.read() };
      H.vn.clearLog();
      await H.romance.playDate("minto");            // 同じ日: 続けては起きない
      const sameDay = { flags: H.petitFlags(), read: H.read() };
      s.day = 22; H.vn.clearLog();
      await H.romance.playDate("minto");            // 2日後: 次はその人の気づきかけ
      const later = { flags: H.petitFlags(), read: H.read() };
      return { first, sameDay, later, before, after: { stats: { ...s.stats }, guilt: s.guilt, rio: s.lovePts.rio || 0 } };
    });
    assert.deepEqual(result.first.flags, { _petit_seen_date_call: true, _petit_count: 1, _petit_last_day: 20 });
    const at = (read, needle) => read.findIndex(text => text.includes(needle));
    assert(at(result.first.read, "テーブルの上で、スマホが震えた") >= 0, "The call comes during the date");
    assert(at(result.first.read, "画面を伏せる") > at(result.first.read, "テーブルの上で、スマホが震えた"), "The player picks how to dodge");
    assert(at(result.first.read, "ちょっとだけ、妬いた") > at(result.first.read, "画面を伏せる"), "The date partner answers in her own voice");
    assert.deepEqual(result.sameDay.flags, result.first.flags, "Nothing more on the same day");
    assert(!result.sameDay.read.some(text => text.includes("スマホが震えた") || text.includes("偵察")));
    assert.deepEqual(result.later.flags, { _petit_seen_date_call: true, _petit_seen_notice_minto: true, _petit_seen_notice: true,
      _petit_count: 2, _petit_last_day: 22 });
    assert(at(result.later.read, "はじめくんに似た人がいて") >= 0, "Her own way of almost noticing");
    assert.deepEqual(result.after.stats, result.before.stats, "No ability reward");
    assert.equal(result.after.guilt, result.before.guilt);
    assert.equal(result.after.rio, result.before.rio, "The other lover's bond is untouched");
  });

  // LIMEの誤爆: はじめの誤送信が自分の吹き出しで出て、相手が返し、言い訳を選ぶ。トークは履歴に残り、絆は増えない。
  await check("the-thanks-goes-to-the-wrong-lover-on-lime", async page => {
    await setup(page);
    await page.evaluate(() => {
      const s = H.fresh(["minto", "rio"], { _petit_seen_date_call: true, _petit_seen_notice_minto: true });
      window.__before = s.lovePts.rio || 0;
      window.__done = H.petit.petitAfterDate("minto").then(ok => { window.__ok = ok; });
    });
    const reply = page.locator(".phone-overlay.show .lime-reply");
    await page.waitForFunction(() => document.querySelectorAll(".phone-overlay.show .lime-reply").length === 3);
    const rows = await page.locator(".phone-overlay.show .lime-row").evaluateAll(nodes => nodes.map(node => [node.classList.contains("me"), node.textContent]));
    assert.deepEqual(rows[0], [true, "今日はありがとう。また二人で行こう"], "Hajime's own message comes first");
    assert(rows.slice(1).every(([mine]) => !mine) && rows.length >= 3, "Then her replies");
    assert.deepEqual(await reply.allTextContents(), ["寝ぼけてた、ごめん", "友達に送るやつだった", "見なかったことにして"]);
    await reply.nth(1).click();
    await page.locator('[data-test="phone-next"]').click();
    await page.evaluate(() => window.__done);
    const result = await page.evaluate(() => ({ ok: window.__ok, flags: H.petitFlags(), read: H.read(),
      inbox: H.core.state.inbox.map(item => ({ id: item.id, sender: item.msg.sender, log: item.log, done: item.done })),
      rio: H.core.state.lovePts.rio || 0, before: window.__before }));
    assert.equal(result.ok, true);
    assert.equal(result.flags._petit_seen_lime_misfire, true);
    assert.deepEqual(result.inbox.map(item => [item.id, item.sender, item.done]), [["_petit_lime_misfire", "rio", true]], "Sent to the other lover; kept in the thread");
    assert.deepEqual(result.inbox[0].log.map(line => line.me), [true, false]);
    assert.equal(result.inbox[0].log[0].text, "友達に送るやつだった");
    assert.equal(result.rio, result.before, "An excuse earns no bond");
    assert(result.read.some(text => text.includes("送り先が、違う")) && result.read.some(text => text.includes("まだ何も送っていない")));
  });

  // 店や施設の訪問の後: 恋人の店の居合わせ・tonari の予約表・映画館・なるの釘。恋人でない人の店では起きない。
  await check("visits-read-their-own-petit-scene-once", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const s = H.fresh(["minto", "rio"]);
      const out = {};
      const visit = async (label, spot) => { H.vn.clearLog(); out[label] = { ok: await H.petit.petitAfterVisit(spot), read: H.read() }; s.day += 2; };
      await visit("adam", { id: "adam", kind: "rival", charId: "adam" });
      await visit("cross", { id: "minto", kind: "rival", charId: "minto" });
      await visit("crossAgain", { id: "minto", kind: "rival", charId: "minto" });
      await visit("sumi", { id: "tonari", kind: "tonari" });
      await visit("cinema", { id: "rojiura_cinema", kind: "spot" });
      await visit("naru", { id: "naru", kind: "rival", charId: "naru" });
      out.flags = H.petitFlags();
      // 修羅場が表に出た後は、もう起きない
      const after = H.fresh(["minto", "rio"], { _story_shuraba_unresolved: true });
      out.unresolved = await H.petit.petitAfterVisit({ id: "tonari", kind: "tonari" }) || await H.petit.petitAfterDate("minto");
      const single = H.fresh(["minto"]);
      out.single = await H.petit.petitAfterVisit({ id: "tonari", kind: "tonari" }) || await H.petit.petitAfterDate("minto");
      return out;
    });
    assert.equal(result.adam.ok, false, "Not at a shop whose owner is not a lover");
    assert.equal(result.cross.ok, true);
    const cross = result.cross.read.join("\n");
    assert.match(cross, /奥の席に、見覚えのある横顔があった[\s\S]*もう帰っちゃうの[\s\S]*卸先を見に来たら[\s\S]*二人が同時に聞いた[\s\S]*誰も、それ以上は聞かなかった/,
      "The shop's lover, then the lover who walked in, then the question");
    assert.equal(result.crossAgain.ok, false, "Once");
    assert(result.sumi.ok && result.sumi.read.some(text => text.includes("席は、端と端にしておいた")));
    assert(!result.sumi.read.some(text => text.includes("気をつけろよ")), "Sumi keeps that line for the end");
    assert(result.cinema.ok && result.cinema.read.some(text => text.includes("出口は、ひとつしかない")));
    assert(result.naru.ok && result.naru.read.some(text => text.includes("言うのは、俺じゃないだろ")));
    assert.equal(result.flags._petit_count, 4);
    assert.equal(result.unresolved, false);
    assert.equal(result.single, false);
  });

  // 実際の地図から恋人の店を訪ねる: いつもの来店の後に居合わせを一度だけ読み、行動は1回。居合わせでは代金も体力も減らない。
  await check("a-real-map-visit-to-a-lovers-shop-ends-with-the-petit-scene", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      window.D = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
        calendar: await import("./js/daily/calendar.js"), ch1: await import("./js/chapters/ch1.js") };
      const s = D.core.newGame();
      Object.assign(s, { phase: "daily", day: 8, slot: 0, money: 20000, stamina: 100, lovers: ["minto", "rio"], loveLevel: { minto: 1, rio: 1 },
        contacts: ["sumi", "minto", "rio"] });
      for (const id of ["minto", "rio", "naru", "adam", "tsumugi", "sumi"]) s.met[id] = true;
      Object.assign(s.flags, { _c_station_registered: true, _errand_scout_done: true, _morning_8: true, _lime_tut: true, _lime_opened: true,
        _minto_name_known: true, _minto_identity_revealed: true });
      D.core.save();
      D.ch1.setupHooks(); D.vn.vnTest.turbo = true; D.vn.vnTest.choose = () => 0;
      D.read = [];
      // 居合わせの最初の行で、その時点の所持金と体力を控える（この場面では減らない）
      D.vn.hooks.onLine = (id, line) => {
        D.read.push(line.text);
        if (String(line.text).includes("席を立とうとして")) D.atPetit = { money: D.core.state.money, stamina: D.core.state.stamina };
      };
      D.run = D.calendar.runDaily({ untilDay: 9, nightEvents: {} }).catch(error => { D.error = error.stack; });
    });
    await page.locator('[data-test="pin-minto"]').waitFor();
    const before = await page.evaluate(() => ({ money: D.core.state.money, slot: D.core.state.slot }));
    await page.locator('[data-test="pin-minto"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.waitForFunction(() => D.error || D.core.state.flags._petit_seen_cross === true, null, { timeout: 60000 });
    await page.waitForFunction(() => D.error || D.core.state.slot === 1, null, { timeout: 60000 });
    const result = await page.evaluate(() => ({ error: D.error, money: D.core.state.money, stamina: D.core.state.stamina, atPetit: D.atPetit,
      slot: D.core.state.slot, day: D.core.state.day, read: D.read,
      flags: Object.fromEntries(Object.entries(D.core.state.flags).filter(([key]) => key.startsWith("_petit"))) }));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.flags, { _petit_seen_cross: true, _petit_count: 1, _petit_last_day: 8 });
    const cross = result.read.findIndex(text => text.includes("奥の席に、見覚えのある横顔があった"));
    assert(cross > 0, "The usual visit is read first, then the petit scene");
    assert(result.read.slice(cross).some(text => text.includes("卸先を見に来たら")), "The other lover walked in as a customer");
    assert.equal(result.slot, before.slot + 1, "One action for the visit; the petit scene costs none");
    assert(before.money > result.money, "The visit itself is paid as usual");
    assert.deepEqual({ money: result.money, stamina: result.stamina }, result.atPetit, "The petit scene costs no money and no stamina");
  });

  // 視線のカットインの短い版（居合わせ・第1章のロビー・第3章の前夜）。高速送りでは省かれるので、直接出して確かめる。
  await check("the-short-stare-cut-in", async page => {
    await setup(page, { turbo: false });
    await page.evaluate(async () => {
      const { gaze } = await import("./js/motions/gaze.js");
      window.__gazeDone = false;
      gaze(["minto", "rio"], { brief: true }).then(() => { window.__gazeDone = true; });
    });
    await page.waitForFunction(() => document.querySelectorAll(".mo-gaze.brief .mo-gaze-band").length === 2);
    const fit = await page.evaluate(() => {
      const stage = document.getElementById("stage").getBoundingClientRect();
      const k = stage.height / 720;
      return [...document.querySelectorAll(".mo-gaze-band")].map(band => {
        const box = band.getBoundingClientRect();
        return { loaded: band.querySelector("img").naturalWidth > 0, height: Math.round(box.height / k), bottom: Math.round((box.bottom - stage.top) / k) };
      });
    });
    assert(fit.every(band => band.loaded && band.height <= 104 && band.bottom <= 500), `Thin bands above the dialogue box: ${JSON.stringify(fit)}`);
    await page.waitForFunction(() => window.__gazeDone === true);
    assert.equal(await page.locator(".mo-gaze").count(), 0);
  });

  // 最後の修羅場に返る: 読んだ場面ごとに一行ずつ。気づきかけを読んだ恋人は、反応の中で一行返す。読んでいない分は出ない。
  await check("petit-scenes-come-back-at-the-final-shuraba", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const { readDialogues } = await import("./js/core/chapter-data.js");
      Object.assign(H.data.DB.dialogues, await readDialogues("ch5_party", ["ch5_party_shuraba_open"]),
        await readDialogues("relationship_conflicts", ["shuraba_open", "shuraba_tsumugi", "shuraba_rio"]));
      const play = async (flags, ids) => {
        H.fresh(["tsumugi", "rio"], flags);
        for (const id of ids) await H.vn.play(id);
        return H.read();
      };
      return {
        none: await play({}, ["ch5_party_shuraba_open", "shuraba_tsumugi"]),
        some: await play({ _petit_count: 3, _petit_seen_date_call: true, _petit_seen_naru: true, _petit_seen_notice: true,
          _petit_seen_notice_tsumugi: true }, ["ch5_party_shuraba_open", "shuraba_tsumugi", "shuraba_rio"]),
        later: await play({ _petit_count: 1, _petit_seen_cinema: true }, ["shuraba_open"]),
      };
    });
    const has = (read, needle) => read.some(text => text.includes(needle));
    for (const needle of ["ごまかした日のことが", "あの着信", "なるの声", "全部、今日に続いていた", "疲れてますかって、聞きましたよね"])
      assert(!has(result.none, needle), `Not without the petit scenes: ${needle}`);
    assert(has(result.none, "一人だけじゃ、ありません") && has(result.none, "ちゃんと聞くのは、初めてです"));
    const order = ["（……あ）", "ごまかした日のことが", "鳴りやまなかった、あの着信", "気づきかけて、聞かないでくれた顔", "なるの声",
      "全部、今日に続いていた", "誰からともなく、俺との関係を尋ねた", "一人だけじゃ、ありません", "ちゃんと聞くのは、初めてです", "疲れてますかって、聞きましたよね"];
    const positions = order.map(needle => result.some.findIndex(text => text.includes(needle)));
    assert(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), `Recalled in order: ${positions}`);
    for (const needle of ["送り先を間違えた", "二つの席", "二つの後ろ姿", "襟の香りのことは"]) assert(!has(result.some, needle), `Only what was read: ${needle}`);
    assert(has(result.later, "映画館で、振り向かなかった二つの後ろ姿") && has(result.later, "全部、今日に続いていた"), "The post-roll opening recalls them too");
  });
});
