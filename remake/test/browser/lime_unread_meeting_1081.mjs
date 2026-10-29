// #1081 C04: 未読のLIMEを前提に約束の場面（強制イベント）を始めない。
// 予約済みだが本文が未読の誘いは、面会の台本の前に該当トークを自動で開いて読ませる。
// 自動で承諾・返信したことにはせず、好感度ペナルティも足さない。目的地・移動費は一度だけ確定。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("lime-unread-meeting-1081", async check => {
  for (const [platform, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${platform}-unread-pending-opens-lime-first`, async page => {
      page.setDefaultTimeout(60000);
      await page.evaluate(async () => {
        window.QA = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
          phone: await import("./js/daily/phone.js"), calendar: await import("./js/daily/calendar.js"),
          ch1: await import("./js/chapters/ch1.js"), vn: await import("./js/vn/engine.js"), ui: await import("./js/core/ui.js") };
        const s = QA.core.newGame();
        Object.assign(s, { phase: "daily", day: 6, slot: 0, stamina: 100, money: 30000 });
        Object.assign(s.flags, { _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
          _delivery_report_done: true, _delivery_schedule_v2: true, _c_station_registered: true,
          _lime_tut: 1, _lime_opened: true, _morning_6: true, _intro_minto: true, known_name_minto: true });
        s.contacts.push("minto"); s.met.minto = true; s.story.minto = 5; s.affinity.minto = 20;
        const msg = structuredClone(QA.data.DB.lime.find(m => m.id === "lime_minto_first_holiday"));
        msg.time_slot = "noon"; delete msg.private_schedule; delete msg.closed_on;
        // 承諾の予約は残っているが、本文はまだ読んでいない（旧セーブ/復元を模す）。
        s.inbox.push({ id: msg.id, originId: msg.id, day: 6, msg, read: false, done: true,
          result: "accepted", replyState: "replied",
          log: [{ me: true, text: "行きます！" }, { note: "このあと向かうことにした" }] });
        s.flags._invited_lime_minto_first_holiday = true; // limeRead には入れない（＝未読）
        s.pendingInvite = { originId: msg.id, sender: "minto", event: "ch1_minto_fifth", day: 6, slot: 0 };
        QA.ch1.setupHooks(); QA.vn.vnTest.turbo = true; QA.vn.vnTest.choose = () => 0;
        QA.played = [];
        const onEnter = QA.vn.hooks.onEnter;
        QA.vn.hooks.onEnter = (id) => { QA.played.push(id); onEnter?.(id); };
        QA.vn.backlog().length = 0; QA.ui.clearScreen();
        QA.run = QA.calendar.runDaily({ nightEvents: {} });
      });
      // 導線: 面会の台本より先に、未読の該当トークがLIMEで開く（本文を流し終えると一覧へ戻るボタンが出る）。
      await page.locator('[data-test="phone-next"]').waitFor();
      const before = await page.evaluate(() => {
        const s = QA.core.state, item = s.inbox[0];
        return { money: s.money, pending: !!s.pendingInvite, scene: QA.played.includes("ch1_minto_fifth"),
          fifth: !!s.flags._minto_fifth_done, affinity: s.affinity.minto, read: item.read,
          limeRead: s.limeRead.includes("lime_minto_first_holiday"),
          replies: item.log.filter(l => l.me).length };
      });
      // 場面はまだ始まっておらず、移動費も未確定。承諾・返信は変わっていない。
      assert.equal(before.money, 30000); assert(before.pending); assert(!before.scene); assert(!before.fifth);
      assert.equal(before.affinity, 20); assert.equal(before.replies, 1, "guard adds no extra reply");
      // トークを開いた時点で本文は既読になる（自動承諾・返信はしない）。
      assert(before.read && before.limeRead, "opening the thread marks the unread invite as read");
      // 一覧へ戻って閉じると、読み終えた上で約束の場面が始まる。
      const act = test => page.locator(`[data-test="${test}"]`)[options.hasTouch ? "tap" : "click"]();
      await act("phone-next");
      await act("phone-close");
      // 面会フラグの後にも途中の質問が続く。招待の完了まで待って精算を検査する。
      await page.waitForFunction(() => QA.played.includes("ch1_minto_fifth") && QA.core.state.flags._minto_fifth_done
        && QA.core.state.inbox[0].completed);
      const after = await page.evaluate(() => {
        const s = QA.core.state;
        return { money: s.money, pending: s.pendingInvite, affinity: s.affinity.minto,
          completed: !!s.inbox[0].completed, result: s.inbox[0].result };
      });
      // 移動費は一度だけ（ch1_minto_fifth = 800）。承諾は維持、好感度ペナルティなし。
      assert.equal(after.money, 29200); assert.equal(after.pending, null);
      assert.equal(after.result, "accepted"); assert(after.completed);
      assert(after.affinity >= 20, "no affinity penalty");
    }, { ...options, reducedMotion: "reduce" });
  }
});
