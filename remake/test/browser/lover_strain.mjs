// すれ違い（恋人の裏の数値・台帳 STR）: 実際の画面で、朝の予兆（LIMEと、はじめの独り言）・夜の帰り道の別れ話と3つの答え・
// 友達に戻った後の扱い・実際の一日の流れ（朝と夜）へのつながりを確かめる。決まりと台本の検査は remake/test/lover_strain.mjs。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    window.H = { core: await import("./js/core/state.js"), strain: await import("./js/daily/lover-strain.js"),
      rules: await import("./js/core/lover-strain.js"), romance: await import("./js/daily/romance.js"),
      vn: await import("./js/vn/engine.js"), ch1: await import("./js/chapters/ch1.js") };
    H.ch1.setupHooks(); H.vn.vnTest.turbo = true; H.vn.vnTest.choose = () => 0;
    // 第2章 DAY 20 の夜（通算日で数える保存）。恋人と、溜まり具合は呼び出し側が決める
    H.fresh = (lovers, strain = {}, flags = {}) => {
      const s = H.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 20, slot: 2, money: 30000, stamina: 80, lovers,
        loveLevel: Object.fromEntries(lovers.map(id => [id, 2])), contacts: ["sumi", ...lovers],
        loverStrain: { init: true, by: Object.fromEntries(Object.entries(strain).map(([id, [v, cause]]) => [id, { v, why: { [cause]: v }, sign: 0, talks: 0 }])) } });
      for (const id of ["tsumugi", "minto", "rio", "hiyori", "ageha", "samechan", "naru", "sumi"]) s.met[id] = true;
      Object.assign(s.flags, { _elapsed_calendar: true, _minto_name_known: true, _minto_identity_revealed: true, ...flags });
      H.vn.clearLog();
      document.querySelectorAll(".toast").forEach(node => node.remove());
      return s;
    };
    H.read = () => H.vn.backlog().map(row => `${row.name || ""}|${row.text}`);
    H.toasts = () => [...document.querySelectorAll(".toast")].map(node => node.textContent);
    H.snap = () => { const s = H.core.state; return { lovers: [...s.lovers], money: s.money, stamina: s.stamina, stats: { ...s.stats },
      strain: JSON.parse(JSON.stringify(s.loverStrain.by)), friend: Object.keys(s.flags).filter(key => key.startsWith("_friend_")),
      temp: Object.keys(s.flags).filter(key => key.startsWith("_strain_")) }; };
    H.talk = (choice, opts) => { H.vn.vnTest.choose = () => choice; return H.strain.maybeStrainTalk(async text => { H.beat = text; }, opts); };
  });
}

await suite("lover-strain", async check => {
  // 朝の予兆: 段ごとに一度、本人のLIMEと、理由の分かる独り言。未読が残っている相手からは重ねて届かない。
  await check("morning-signs-arrive-as-lime-and-a-monologue", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const s = H.fresh(["tsumugi"], { tsumugi: [3.5, "decline"] });
      s.slot = 0;
      s.inbox.push({ id: "_date_inv_tsumugi_d19", day: 19, chapter: 2, read: true, done: true, result: "declined",
        msg: { sender: "tsumugi", lover: true, type: "invitation", accept_event: "date_tsumugi", messages: ["……会えますか"] } });
      const out = { first: H.strain.strainMorning(), firstToasts: H.toasts(), firstInbox: s.inbox.map(item => [item.id, item.read, item.msg.messages]) };
      out.again = H.strain.strainMorning();
      // 次の段: 予兆①が未読のままなら、LIMEは重ねず独り言だけ
      s.day = 21; s.loverStrain.by.tsumugi.v = 7.5;
      document.querySelectorAll(".toast").forEach(node => node.remove());
      out.second = H.strain.strainMorning(); out.secondToasts = H.toasts(); out.secondCount = s.inbox.length;
      // 読んでいる相手には「話したい」が届く（返事ができる）
      const r = H.fresh(["rio", "ageha"], { rio: [7.5, "suspect"] });
      r.slot = 0;
      out.rio = H.strain.strainMorning(); out.rioToasts = H.toasts();
      out.rioItem = r.inbox.map(item => ({ id: item.id, replyState: item.replyState, lines: item.msg.messages, replies: item.msg.replies.map(reply => reply.text) }));
      out.rioMorning = H.romance.loverMessages().map(m => [m.sender, m.type]);
      return out;
    });
    assert.equal(result.first, 1, "One LIME this morning");
    assert.deepEqual(result.firstInbox.at(-1), ["_lover_strain_tsumugi_s1_t20", false, ["……最近、ノートの二人のページが、進んでいません", "……忙しい、ですよね。……それだけ、です"]]);
    assert.deepEqual(result.firstToasts, ["（……つむぎちゃんの誘いを、続けて断っている）"], "The monologue names the reason");
    assert.equal(result.again, 0, "Once a day");
    assert.equal(result.second, 0, "Her unread message is not buried under another");
    assert.equal(result.secondCount, 2);
    assert.deepEqual(result.secondToasts, ["（……つむぎちゃんを、ずっと待たせている。まずい）"]);
    assert.equal(result.rio, 1);
    assert.deepEqual(result.rioToasts, ["（……凛想さんの目が、前より鋭い気がする）"]);
    assert.deepEqual(result.rioItem, [{ id: "_lover_strain_rio_s2_t20", replyState: "waiting",
      lines: ["モルモットくん", "近いうちに、話がある。業務連絡じゃないほうの", "……時間、空けといて"], replies: ["すみません、時間つくります", "何かありましたか"] }]);
    assert(!result.rioMorning.some(([sender, type]) => sender === "rio" && type === "chat"), "Her usual morning line stops at this stage");
  });

  // 別れ話: 理由が台詞で分かり、引き止めれば恋人のまま。必ず読む場面なので、お金・体力・能力は動かない。
  await check("the-breakup-talk-names-the-reason-and-can-be-held-back", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      H.fresh(["minto", "rio"], { minto: [10.5, "decline"], rio: [3, "suspect"] });
      const before = H.snap();
      const ok = await H.talk(0);
      const out = { ok, beat: H.beat, read: H.read(), before, after: H.snap(), toasts: H.toasts() };
      H.vn.clearLog();
      out.sameNight = await H.talk(0);
      // 何日か後に、また溜まれば、また起きる（引き止めに上限は無い）
      const s = H.core.state;
      s.day = 34; s.loverStrain.by.minto.v = 10; s.loverStrain.by.minto.why = { unread: 10 };
      out.again = await H.talk(0);
      out.againRead = H.read();
      out.final = H.snap();
      return out;
    });
    assert.equal(result.ok, true);
    assert.equal(result.beat, "——帰り道、栞さんが待っていた。");
    const at = (read, needle) => read.findIndex(text => text.includes(needle));
    assert(at(result.read, "栞|早めに閉めたの") >= 0, `She speaks as Shiori in a private scene: ${result.read.slice(0, 5).join(" / ")}`);
    assert(at(result.read, "誘うたびに、断られるでしょ") > at(result.read, "早めに閉めたの"), "The reason comes after the opening");
    assert(at(result.read, "構ってもらえないの、こたえるよ") > 0, "She says it plainly");
    assert(at(result.read, "友達に、戻ろうか") > at(result.read, "構ってもらえないの"), "Then she asks");
    assert(at(result.read, "▶|これからは、ちゃんと向き合う") > at(result.read, "友達に、戻ろうか"));
    assert(at(result.read, "もう一回、信じちゃうよ") > 0);
    assert(!result.read.some(text => text.includes("この話、二回目")), "The first talk has no 'again' line");
    assert.deepEqual(result.after.lovers, ["minto", "rio"], "Still lovers");
    assert.equal(result.after.strain.minto.v, 1);
    assert.equal(result.after.strain.minto.talks, 1);
    assert.equal(result.after.strain.rio.v, 3, "The other lover is untouched");
    assert.deepEqual([result.after.money, result.after.stamina, result.after.stats], [result.before.money, result.before.stamina, result.before.stats], "No cost, no reward");
    assert.deepEqual(result.after.temp, [], "The answer flags are cleared");
    assert.deepEqual(result.toasts, []);
    assert.equal(result.sameNight, false, "Not twice in a row");
    assert.equal(result.again, true, "Neglect her again and she asks again");
    assert(at(result.againRead, "この話、二回目だね") > 0 && at(result.againRead, "ずっと既読がつかないの") > 0, "The second time has its own line and the new reason");
    assert.equal(result.final.strain.minto.talks, 2);
    assert.deepEqual(result.final.lovers, ["minto", "rio"]);
  });

  // 言い訳は引き止められるが、次が早い。受け入れると友達に戻り、恋人としての連絡が止まる。
  await check("an-excuse-buys-time-and-accepting-goes-back-to-friends", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const out = {};
      H.fresh(["ageha"], { ageha: [10, "unread"] });
      out.excuse = await H.talk(1); out.excuseRead = H.read(); out.afterExcuse = H.snap();
      const s = H.fresh(["rio", "tsumugi"], { rio: [11, "suspect"] });
      s.pendingInvite = { sender: "rio", event: "date_rio", day: 20, slot: 1 };
      out.end = await H.talk(2); out.endRead = H.read(); out.afterEnd = H.snap(); out.toasts = H.toasts();
      out.pending = s.pendingInvite;
      s.day = 21; s.slot = 0;
      out.messages = H.romance.loverMessages().map(m => m.sender);
      out.loverAgain = H.romance.isLover("rio");
      out.confessionOpen = H.romance.romanceRouteOpen("rio");
      // 忙しい夜・遠出の間・修羅場の後は起きない
      H.fresh(["hiyori"], { hiyori: [11, "decline"] });
      out.busy = await H.talk(0, { busyNight: true });
      H.fresh(["hiyori"], { hiyori: [11, "decline"] }, { _ch2_region: "tokyo" });
      out.away = await H.talk(0);
      H.fresh(["hiyori"], { hiyori: [11, "decline"] }, { _story_shuraba_unresolved: true });
      out.unresolved = await H.talk(0);
      H.fresh(["hiyori"], { hiyori: [9.5, "decline"] });
      out.notYet = await H.talk(0);
      return out;
    });
    assert.equal(result.excuse, true);
    assert(result.excuseRead.some(text => text.includes("LIME、ずっと未読じゃん")) && result.excuseRead.some(text => text.includes("もうちょいだけ待つ")));
    assert.deepEqual(result.afterExcuse.lovers, ["ageha"]);
    assert.equal(result.afterExcuse.strain.ageha.v, 5, "Still at the first sign");
    assert.equal(result.end, true);
    assert(result.endRead.some(text => text.includes("半分はよそにいる")), "Intuition, not an accusation");
    assert(result.endRead.some(text => text.includes("この実験は、ここまで")));
    assert.deepEqual(result.afterEnd.lovers, ["tsumugi"], "Back to friends");
    assert.deepEqual(result.afterEnd.friend, ["_friend_rio"]);
    assert.deepEqual(result.toasts, ["凛想さんと、友達に戻った。"]);
    assert.equal(result.pending, null, "The promised date is gone");
    assert(!result.messages.includes("rio"), "No more lover LIME from her");
    assert.equal(result.loverAgain, false);
    assert.equal(result.confessionOpen, false, "The walk-home confession does not start over");
    assert.deepEqual([result.busy, result.away, result.unresolved, result.notYet], [false, false, false, false]);
  });

  // 実際の一日の流れ: 朝に予兆が届き（通知の件数に入る）、行動を終えた夜の帰り道で別れ話になってから家に帰る。
  await check("a-real-day-delivers-the-sign-in-the-morning-and-the-talk-at-night", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      window.D = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
        calendar: await import("./js/daily/calendar.js"), ch1: await import("./js/chapters/ch1.js") };
      const s = D.core.newGame();
      Object.assign(s, { phase: "daily", day: 8, slot: 2, money: 20000, stamina: 80, lovers: ["tsumugi"], loveLevel: { tsumugi: 2 },
        contacts: ["sumi", "tsumugi"], loverStrain: { init: true, by: { tsumugi: { v: 9.6, why: { unread: 9.6 }, sign: 2, talks: 0 } } } });
      for (const id of ["minto", "rio", "naru", "adam", "tsumugi", "sumi"]) s.met[id] = true;
      // 2日前から開いていない朝のLIME（今朝ぶんの +0.5 で 10 を越える）
      s.inbox.push({ id: "_lover_morning_tsumugi_d6", day: 6, chapter: 1, read: false, done: false, replyState: "none", log: [],
        msg: { id: "_lover_morning_tsumugi_d6", sender: "tsumugi", lover: true, type: "chat", messages: ["……おはよう、ございます"] } });
      Object.assign(s.flags, { _c_station_registered: true, _errand_scout_done: true, _lime_tut: true, _lime_opened: true,
        _delivery_adam_done: true, _delivery_minto_done: true, _delivery_report_done: true });
      D.core.save();
      D.ch1.setupHooks(); D.vn.vnTest.turbo = true; D.vn.vnTest.choose = () => 0;
      D.read = [];
      D.vn.hooks.onLine = (id, line) => { D.read.push(line.text); };
      D.run = D.calendar.runDaily({ untilDay: 12, nightEvents: {} }).catch(error => { D.error = error.stack; });
    });
    await page.waitForFunction(() => D.error || D.core.state.loverStrain.by.tsumugi.talks === 1, null, { timeout: 60000 });
    const result = await page.evaluate(() => ({ error: D.error, read: D.read, day: D.core.state.day, lovers: D.core.state.lovers,
      strain: D.core.state.loverStrain.by.tsumugi, tick: D.core.state.loverStrain.day }));
    assert.equal(result.error, undefined);
    assert.equal(result.tick, 8, "The morning advanced the hidden number once");
    const open = result.read.findIndex(text => String(text).includes("スケッチブックを抱えたつむぎが立っていた"));
    assert(open >= 0, `The talk is read on the way home: ${result.read.slice(-6).join(" / ")}`);
    assert(result.read.slice(open).some(text => String(text).includes("LIME、何日も、開いてもらえてません")), "She names the unread LIME");
    assert.deepEqual(result.lovers, ["tsumugi"]);
    assert.equal(result.strain.v, 1);
    // 別れ話の後も、その夜はいつもどおり家に帰って朝になる（家シーシャの問いかけには「今日はやめておく」と答える）
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline && !(await page.evaluate(() => D.error || D.core.state.day === 9))) {
      const skip = page.locator('.modal.show button, .layer.modal.show button').last();
      if (await skip.count() && await skip.isVisible().catch(() => false)) await skip.click({ timeout: 1000 }).catch(() => {});
      else await page.waitForTimeout(200);
    }
    const night = await page.evaluate(() => ({ error: D.error, day: D.core.state.day, read: D.read.slice(-8) }));
    assert.equal(night.error, undefined);
    assert.equal(night.day, 9, `The night goes on to the next morning after the talk: ${night.read.join(" / ")}`);
  });
});
