// tonari フロア営業: 勤務札→導入→営業→締め→日当の流れ、実画面の操作（PC／横持ちタッチ）、時計の停止、LOAD の境界。
// 卓で選ぶ場面は「接客ビュー」（店内がその卓へ寄り、左に選択肢の列・下に客のドック・選んだあとに判定の印）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const t = (key) => `[data-test="tonari-floor-${key}"]`;

async function setup(page, { day = 4, slot = 1, manual = true } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ day, slot, manual }) => {
    window.C = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      data: await import("./js/core/data.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), tonari: await import("./js/daily/tonari.js"),
      view: await import("./js/daily/tonari-floor-view.js"), model: await import("./js/daily/tonari-floor-model.js"),
      floorData: await import("./js/daily/tonari-floor-data.js"), bot: await import("./test/tonari_floor_bot.mjs") };
    C.ch1.setupHooks(); C.vn.vnTest.turbo = true;
    C.view.floorTest.manual = manual;
    C.data.DB.baito = []; // 接客の抽選報酬を除き、日当と売上ボーナスだけを比べる
    C.fresh = (d = day, sl = slot) => {
      const s = C.core.newGame();
      Object.assign(s, { phase: "daily", day: d, slot: sl, money: 30000, stamina: 100, weatherSeed: 4, baitoCount: 1 });
      Object.assign(s.flags, { _lime_tut: 1, _delivery_minto_done: true, _delivery_adam_done: true,
        _errand_scout_done: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true, _ev_ageha_cameo: true });
      s.flags[`_morning_${d}`] = s.flags[`_morning_${d + 1}`] = true;
      s.met.naru = s.met.adam = s.met.minto = true;
      s.flags._spot_guide_naru = s.flags._spot_guide_adam = s.flags._spot_guide_minto = true;
      return s;
    };
    C.trace = [];
    C.vn.hooks.onLine = (id) => { if (C.trace.at(-1) !== id) C.trace.push(id); };
    C.toasts = [];
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.classList?.contains("toast")) C.toasts.push(n.textContent);
    }).observe(document.body, { childList: true, subtree: true });
    // 営業をボットで最後まで回す（導入→営業→締め）。pace＝一つの操作にかかる刻み
    C.drive = async ({ pace = 2, pick = "best" } = {}) => {
      const api = () => C.view.floorTest.api;
      const click = (sel) => document.querySelector(sel)?.click();
      for (let i = 0; i < 4000; i++) {
        await new Promise((r) => setTimeout(r, 0));
        const a = api();
        if (!a) { if (i > 50 && C.driven) return; continue; }
        C.driven = true;
        if (a.mode() === "intro") { click('.tf-intro .tf-option'); continue; }
        if (a.mode() === "result") { C.result = C.model.floorResult(a.state()); click('[data-test="tonari-floor-option-continue"]'); return; }
        if (a.mode() !== "live") continue;
        const action = C.bot.floorBotAction(a.state(), { pick });
        if (action) a.act(action);
        if (a.mode() === "live") a.tick(pace);
      }
      throw Error("floor did not finish");
    };
    C.after = setInterval(() => {
      document.querySelector('[data-test="after-none"]')?.click();
      document.querySelector('[data-test="shift-order-0"]')?.click();
    }, 20);
  }, { day, slot, manual });
}

await suite("tonari-floor", async (check) => {
  const selected = process.env.TEST_CASES?.split(",");
  const run = (label, body, options = {}) => (!selected || selected.includes(label)
    ? check(label, body, { reducedMotion: "reduce", ...options }) : Promise.resolve());

  // 勤務札から入り、営業を終えて日当と売上ボーナスを受け取る。いつものシフトと同じ行動枠・体力。
  await run("pc-shift-flow", async (page) => {
    await setup(page);
    // 同じ状態でいつものシフトに入った時の日当（体調などの上乗せ込み）。フロアとの差が売上ボーナスになる
    const classic = await page.evaluate(async () => {
      const s = C.fresh();
      await C.stats.paidAction(() => C.tonari.doBaito());
      return { pay: s.money - 30000, stamina: s.stamina };
    });
    await page.evaluate(() => { const s = C.fresh(); s.baitoCount = 0; C.core.save(); C.core.load(); C.ch1.resumeGame().catch((e) => { window.calendarError = e.stack; }); });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="tonari-baito"]').waitFor();
    assert.equal(await page.locator('[data-test="tonari-baito-floor"]').count(), 0, "最初のシフトの前は、フロアを任されない");
    await page.locator('[data-test="sub-back"]').click();
    await page.evaluate(() => { C.core.state.baitoCount = 1; });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    const card = page.locator('[data-test="tonari-baito-floor"]');
    assert.match(await card.innerText(), /フロアを任される/);
    assert.match(await card.innerText(), /新しい仕事/);
    const before = await page.evaluate(() => ({ money: C.core.state.money, stamina: C.core.state.stamina, slot: C.core.state.slot }));
    await card.click();
    await page.locator(t("intro")).waitFor();
    assert.match(await page.locator(t("intro")).innerText(), /はじめてのフロア/);
    assert.deepEqual(await page.evaluate(() => C.trace.filter((id) => /floor/.test(id))), ["tonari_floor_first"]);
    // 営業中は保存しない（途中の体力だけが残らない）
    assert.equal(await page.evaluate(() => C.core.save()), false);
    await page.evaluate(() => C.drive({ pace: 2 }));
    await page.waitForFunction(() => C.core.state.slot === 2 || C.core.state.day === 5, null, { timeout: 60000 });
    const after = await page.evaluate(() => ({ money: C.core.state.money, stamina: C.core.state.stamina, floor: C.core.state.flags._tonari_floor,
      visited: C.core.state.visitedDay.tonari_baito, result: C.result, toasts: C.toasts, error: window.calendarError,
      order: Object.keys(C.core.state.flags).filter((k) => k.startsWith("_shift_order_")), baitoCount: C.core.state.baitoCount }));
    assert.equal(after.error, undefined);
    assert.equal(after.result.rank, "S");
    assert.equal(after.result.bonus, 1500);
    assert.deepEqual(after.floor, { nights: 1, best: "S" });
    assert.equal(after.visited, 4);
    assert.equal(after.baitoCount, 2);
    assert.deepEqual(after.order, ["_shift_order_1:4"]);
    assert(classic.pay >= 8000);
    assert.equal(after.money - before.money, classic.pay + 1500, "いつものシフトの日当＋売上ボーナス");
    assert.equal(after.stamina, classic.stamina, "体力の消費はいつものシフトと同じ");
    assert(after.toasts.some((text) => /フロアの売上ボーナス（大入り）\+1,500円/.test(text)), after.toasts.join(" / "));
    // 保存した先でも、進み具合と所持金が残る
    const saved = await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem(C.core.SAVE_KEY)); return { money: raw.money, floor: raw.flags._tonari_floor }; });
    assert.deepEqual(saved, { money: after.money, floor: { nights: 1, best: "S" } });
  });

  // 二回目以降: 勤務札に予報と最高評価が出る。三回目からは段取りを選んで始める。昼のシフトは昼の呼び名と時計。
  await run("pc-forecast-and-plan", async (page) => {
    await setup(page, { slot: 0 });
    await page.evaluate(() => { const s = C.fresh(4, 0); s.flags._tonari_floor = { nights: 2, best: "A" }; C.core.save(); C.core.load(); C.ch1.resumeGame().catch((e) => { window.calendarError = e.stack; }); });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    // 予報と最高の評価は、フロアの台本を読めてから札に足される
    await page.waitForFunction(() => /今日の予報：/.test(document.querySelector('[data-test="tonari-baito-floor"]')?.innerText || ""));
    const text = await page.locator('[data-test="tonari-baito-floor"]').innerText();
    assert.match(text, /これまでの最高：上々/);
    await page.locator('[data-test="tonari-baito-floor"]').click();
    await page.locator(t("intro")).waitFor();
    assert.deepEqual(await page.evaluate(() => C.trace.filter((id) => /floor/.test(id))), ["tonari_floor_start"]);
    assert.equal(await page.locator('[data-test^="tonari-floor-option-plan-"]').count(), 3);
    await page.locator(t("option-plan-register")).click();
    const live = await page.evaluate(() => { const s = C.view.floorTest.api.state(); return { plan: s.plan, daytime: s.daytime, clock: C.model.floorClock(s), level: s.level }; });
    assert.deepEqual(live, { plan: "register", daytime: true, clock: "12:00", level: 2 });
    assert.match(await page.locator(".tf-info").innerText(), /12:00/);
    await page.evaluate(() => C.drive({ pace: 3 }));
    await page.waitForFunction(() => C.core.state.slot >= 1 && !document.querySelector('[data-test="tonari-floor-screen"]:not(.done)'), null, { timeout: 60000 });
    const done = await page.evaluate(() => ({ floor: C.core.state.flags._tonari_floor, served: C.result.served, expected: C.result.expected, error: window.calendarError }));
    assert.equal(done.error, undefined);
    assert.equal(done.floor.nights, 3);
    assert.equal(done.served, done.expected);
  });

  // 実画面の操作: 案内→注文→配膳→合図→会計の声かけ（延長）→片付け、休止・速さ・引き継ぎ・締めの伝票。
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-ui`, async (page) => {
      await setup(page);
      await page.evaluate(() => {
        C.fresh();
        window.done = C.view.runTonariFloor({ seed: 3, level: 1, chapter: 1, anchor: { family: "citrus", index: 0 }, night: true,
          art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
      });
      const api = (fn, arg) => page.evaluate(({ fn, arg }) => new Function("a", "arg", `return (${fn})(a, arg)`)(C.view.floorTest.api, arg), { fn: fn.toString(), arg });
      const tick = (n) => api((a, n) => a.tick(n), n);
      const table = (id) => page.locator(t(`table-${id}`));
      await page.locator(t("option-start")).click();
      assert.equal(await api((a) => a.mode()), "live");
      await tick(6);
      assert.equal(await page.locator(".tf-door-chip").count(), 1);
      // 画面の外へはみ出さない・押せる大きさ（実画素で40px以上）
      const boxes = await page.evaluate(() => {
        const stage = document.getElementById("stage").getBoundingClientRect();
        return [...document.querySelectorAll(".tf-seat, .tf-bonus, .tf-pause-button, .tf-ticker, .tf-dock, .tf-clock, .tf-info, .tf-sales")].map((n) => {
          const r = n.getBoundingClientRect();
          return { cls: n.className, w: r.width, h: r.height, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
        });
      });
      for (const box of boxes) {
        assert(box.inside, `${box.cls} が舞台の外`);
        if (/tf-(seat|bonus|pause-button|ticker)/.test(box.cls)) assert(Math.min(box.w, box.h) >= 40, `${box.cls} が小さい: ${box.w}x${box.h}`);
      }
      assert.equal(await page.evaluate(() => document.querySelector(".tonari-floor").scrollLeft), 0);
      // 上の帯は左から「店の時計・残り時間・売上」、下の帯は「卓のドック・スミさんの一言・ボーナスタイム」
      const bands = await page.evaluate(() => {
        const x = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return (r.left + r.right) / 2; };
        const stage = document.getElementById("stage").getBoundingClientRect();
        return { top: [x(".tf-info"), x(".tf-clock"), x(".tf-sales")], bottom: [x(".tf-dock"), x(".tf-ticker"), x(".tf-bonus")], center: (stage.left + stage.right) / 2 };
      });
      assert(bands.top[0] < bands.top[1] && bands.top[1] < bands.top[2] && Math.abs(bands.top[1] - bands.center) < 4, "残り時間は上のまん中");
      assert(bands.bottom[0] < bands.bottom[1] && bands.bottom[1] < bands.bottom[2], "下の帯の並び");
      // 案内（1回押すだけ）。選んだ卓の様子が、下のドックに出る
      assert.match(await page.locator(t("dock")).innerText(), /1卓\s*空席/);
      await table(1).click();
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      const g1 = await api((a) => a.state().guests.g1);
      assert.match(await page.locator(t("dock")).innerText(), new RegExp(`1卓\\s*${g1.name}`));
      assert.equal(await page.locator(t("dock-bill")).innerText(), "900円", "席と初杯");
      if (platform === "pc") {
        // マウスを乗せた卓の様子に替わる（押さなくても見られる）
        await table(2).hover();
        assert.match(await page.locator(t("dock")).innerText(), /2卓\s*空席/);
        await table(1).hover();
        assert.match(await page.locator(t("dock")).innerText(), /1卓/);
      }
      // 注文: 接客ビューが開いている間は時間が止まる。「あとで」で閉じても注文は残る
      await table(1).click();
      await page.locator(t("sheet")).waitFor();
      assert.equal(await api((a) => a.mode()), "panel");
      // 接客ビュー: 店内がその卓へ寄り、選んだ卓は左の列にも下のドックにも隠れない
      const view = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { cam: document.querySelector(".tf-cam").style.transform, seat: rect('.tf-spot[data-id="1"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"),
          foot: rect(".tf-sheet-foot"), hidden: getComputedStyle(document.querySelector(".tf-ticker")).display };
      });
      assert.match(view.cam, /scale\(1\.3\)/);
      assert(view.seat.left >= view.sheet.right - 2, `選んだ卓が左の列に隠れる: ${view.seat.left} < ${view.sheet.right}`);
      assert(view.seat.bottom <= view.dock.top + 2, "選んだ卓が下のドックに隠れる");
      assert(view.foot.bottom <= view.dock.top + 2, "列の下端がドックに被る");
      assert.equal(view.hidden, "none", "接客ビューでは、スミさんの一言を引っ込める");
      assert.match(await page.locator(t("dock")).innerText(), /ご注文/);
      const quote = await page.locator(".tf-sheet-quote").innerText();
      assert.equal(quote, `「${await api((a) => a.state().guests.g1.quote)}」`);
      assert.equal(await page.locator('[data-test^="tonari-floor-option-mix-"]').count(), 3);
      const t0 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t0, "伝票の間は進まない");
      await page.locator(t("sheet-later")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await page.locator(".tf-cam").evaluate((n) => n.style.transform), "", "列を閉じると、店内は元の引きに戻る");
      await table(1).click();
      const best = await api((a) => { const g = a.state().guests.g1; return g.options.indexOf(g.best); });
      await page.locator(t(`option-mix-${best}`)).click();
      assert.equal(await api((a) => a.state().tables[0].phase), "wait");
      assert.match(await page.locator(".tf-bench-now").innerText(), /1卓/);
      await tick(15);
      assert.equal(await page.locator(t("shelf-1")).count(), 1);
      await page.locator(t("shelf-1")).click(); // 受渡棚からも運べる
      assert.equal(await api((a) => a.state().tables[0].phase), "enjoy");
      assert.equal(await page.locator('[data-test="tonari-floor-table-1"]').evaluate((n) => n.closest(".tf-spot").dataset.smoke), "true");
      // 合図: 5つの手入れは固定の並び。正しい手入れで満足が上がる
      for (let i = 0; i < 80 && !(await api((a) => a.state().tables[0].call)); i++) await tick(1);
      const call = await api((a) => a.state().tables[0].call.type);
      const mood = await api((a) => a.state().tables[0].mood);
      await table(1).click();
      assert.deepEqual(await page.locator(".tf-sheet .tf-option b").allInnerTexts().then((list) => list.map((s) => s.replace(/\s/g, ""))),
        ["炭を替える", "炭を下ろす", "飲み物を聞く", "ひと声かける", "そっとしておく"]);
      const verb = await page.evaluate((call) => C.floorData.CALLS[call].verb, call);
      // 5行の列も、下のドックに被らない
      const list = await page.evaluate(() => ({ foot: document.querySelector(".tf-sheet-foot").getBoundingClientRect().bottom, dock: document.querySelector(".tf-dock").getBoundingClientRect().top,
        row: document.querySelector(".tf-list .tf-option").getBoundingClientRect().height }));
      assert(list.foot <= list.dock + 2, `合図の列がドックに被る: ${list.foot} > ${list.dock}`);
      assert(list.row >= 40, `行が小さい: ${list.row}`);
      await page.locator(t(`option-${verb}`)).click();
      assert(await api((a) => a.state().tables[0].mood) > mood);
      assert.equal(await page.locator(t("screen")).getAttribute("data-verdict"), "best");
      // 会計の声かけ: 客の顔を見て選ぶ。笑顔の客は延長（トップ替え）に応じる
      for (let i = 0; i < 200 && (await api((a) => a.state().tables[0].phase)) !== "bill"; i++) {
        await tick(1);
        if (await api((a) => !!a.state().tables[0].call)) { await table(1).click(); await page.locator(".tf-sheet .tf-option").first().click(); }
      }
      await api((a) => { a.state().tables[0].mood = 90; });
      await table(1).click();
      assert.equal(await page.locator(t("sheet")).getAttribute("data-kind"), "bill");
      assert.equal(await api((a) => a.state().tables[0].phase), "bill", "押しただけでは会計しない");
      assert.deepEqual(await page.locator(".tf-sheet .tf-option b").allInnerTexts().then((list) => list.map((s) => s.replace(/\s/g, ""))),
        ["もう少し、いかがですか？", "ありがとうございました", "お待たせして、すみません"]);
      assert.equal(await page.locator(".tf-sheet-lead").getAttribute("data-mood"), "smile");
      assert.equal(await page.locator(".tf-sheet-tip").count(), 1, "はじめのうちは、選び方の一言が出る");
      // 選んだあと、判定の印（◎）とまん中の札が出る。印が出ている間も時間は止まり、もう一度押すと先へ進む
      await page.evaluate(() => { C.view.floorTest.verdictMs = 60000; });
      await page.locator(t("option-extend")).click();
      assert.equal(await api((a) => a.mode()), "panel");
      assert.equal(await page.locator(t("sheet")).getAttribute("data-verdict"), "best");
      assert.equal(await page.locator(".tf-verdict b").innerText(), "延長！");
      assert.match(await page.locator(".tf-banner").innerText(), /延長、いただきました！/);
      assert.equal(await page.locator(t("option-extend")).getAttribute("data-picked"), "true");
      if (platform === "pc") await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/tonari-floor-pc-verdict.png` }).catch(() => {});
      await page.locator(t("option-extend")).click();
      await page.evaluate(() => { C.view.floorTest.verdictMs = null; });
      assert.equal(await api((a) => a.mode()), "live");
      assert.deepEqual(await api((a) => { const table = a.state().tables[0]; return [table.phase, table.top, a.state().sales]; }), ["enjoy", "ordered", 0]);
      // トップ替えを運ぶ→もう一度の会計では、延長をもう誘えない
      await tick(12);
      await table(1).click();
      assert.equal(await api((a) => a.state().tables[0].top), "served");
      for (let i = 0; i < 80 && (await api((a) => a.state().tables[0].phase)) !== "bill"; i++) await tick(1);
      await table(1).click();
      assert.equal(await page.locator(t("option-extend")).isDisabled(), true);
      assert.match(await page.locator(t("dock")).innerText(), /トップ替え/);
      await page.locator(t("option-thanks")).click();
      assert.equal(await api((a) => a.state().tables[0].phase), "dirty");
      assert.notEqual(await page.locator(t("sales")).innerText(), "0円");
      assert.match(await page.locator(t("dock")).innerText(), /1卓\s*片付け待ち/);
      await table(1).click();
      assert.equal(await api((a) => a.state().tables[0].phase), "empty");
      // ボーナスタイム: 溜まるまで押せない
      assert.equal(await page.locator(t("bonus")).isDisabled(), true);
      await api((a) => { a.state().air = 100; });
      await tick(1);
      assert.equal(await page.locator(t("bonus")).isDisabled(), false);
      await page.locator(t("bonus")).click({ force: true });
      assert.equal(await page.locator(t("screen")).getAttribute("data-bonus"), "on");
      // 休止→ゆっくり→つづける→引き継ぎ→締めの伝票
      await page.locator(t("pause")).click();
      await page.locator(t("pause-panel")).waitFor();
      await page.locator(t("option-speed")).click();
      assert.match(await page.locator(t("option-speed")).innerText(), /ふつうの速さに戻す/);
      await page.locator(t("option-resume")).click();
      assert.equal(await api((a) => a.mode()), "live");
      await page.locator(t("pause")).click();
      await page.locator(t("option-delegate")).click();
      await page.locator(t("delegate-panel")).waitFor();
      await page.locator(t("option-confirm-delegate")).click();
      await page.locator(t("result")).waitFor();
      assert.match(await page.locator(t("rank")).innerText(), /大入り|上々|まずまず|ばたばた/);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/tonari-floor-${platform}-result.png` }).catch(() => {});
      await page.locator(t("option-continue")).click();
      await page.waitForFunction(() => window.result !== undefined);
      const result = await page.evaluate(() => window.result);
      assert.equal(result.closing, "handoff");
      assert.equal(result.anchorIndex, null, "「今日の注文」の客（二組目）は、まだ受け取っていない");
      const mine = result.groups.find((g) => g.tableId === 1);
      assert.equal(mine.stars, 3);
      assert.equal(mine.top, 800, "延長のトップ替えが会計に入る");
      assert.equal(result.counts.extend, 1);
      assert.equal(await page.evaluate(() => C.core.state.money), 30000, "店の売上は、はじめの所持金に入らない");
    }, options);
  }

  // 専用の店内画（客が座る形）: 絵が届く前でも、配置図の舞台で重なりと操作を確かめる。
  // 席は「上3（こちら向き）・下2（内向き）」。客 → 前景 → 番号札 → 卓のマーカーの順に重なる。絵の登録があれば影絵の代わりに絵を出す。
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-seated-stage`, async (page) => {
      await setup(page);
      await page.evaluate(async () => {
        C.fresh();
        const guide = await import("./test/tonari_floor_guide.mjs");
        const pixel = (color) => { const c = Object.assign(document.createElement("canvas"), { width: 8, height: 8 }); const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 8, 8); return c.toDataURL(); };
        window.done = C.view.runTonariFloor({ seed: 3, level: 1, night: true, stage: guide.floorGuideStage({ night: true }),
          guests: { first: { idle: pixel("#c33"), happy: pixel("#3c3") } }, props: { shisha: pixel("#ccc") } }).then((r) => { window.result = r; });
      });
      const api = (fn, arg) => page.evaluate(({ fn, arg }) => new Function("a", "arg", `return (${fn})(a, arg)`)(C.view.floorTest.api, arg), { fn: fn.toString(), arg });
      await page.locator(t("option-start")).click();
      assert.equal(await page.locator(t("screen")).getAttribute("data-style"), "seated");
      assert.equal(await page.locator(".tf-front").count(), 1);
      await api((a) => a.tick(6));
      await page.locator(t("table-4")).click(); // 手前の左の卓へ案内
      assert.equal(await api((a) => a.state().tables[3].phase), "order");
      const geo = await page.evaluate(() => {
        const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
        const stage = document.getElementById("stage").getBoundingClientRect();
        const spot = '.tf-spot[data-id="4"]';
        return { seat: rect(`${spot} .tf-seat`), plate: rect(`${spot} .tf-plate`), bubble: rect(`${spot} .tf-bubble`), stage: { top: stage.top, h: stage.height },
          z: { seat: z(`${spot} .tf-seat`), front: z(".tf-front"), plate: z(`${spot} .tf-plate`), bubble: z(`${spot} .tf-bubble`) },
          painted: !!document.querySelector(`${spot} .tf-who img`), hud: rect(".tf-top") };
      });
      assert(geo.z.seat < geo.z.front && geo.z.front < geo.z.plate && geo.z.plate < geo.z.bubble, JSON.stringify(geo.z));
      assert(geo.painted, "登録した客の絵が出る");
      assert(geo.bubble.bottom <= geo.plate.top + 2, "手前の席のマーカーは、内側の卓の上");
      assert(geo.bubble.left >= geo.seat.right - 2, "手前の左の席は、卓とマーカーが内側（右）にある");
      assert(geo.seat.h >= 40 && geo.seat.w >= 40, `座った客は押せる大きさ: ${geo.seat.w}x${geo.seat.h}`);
      // 席の形: 上の3席はこちら向き、下の2席は内向き（右の席は絵を反転する）
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tf-spot")].map((n) => `${n.dataset.row}:${n.dataset.flip}`)),
        ["back:false", "back:false", "back:false", "side:false", "side:true"]);
      const rows = await page.evaluate(() => [...document.querySelectorAll(".tf-spot .tf-seat")].map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      assert(rows[0].x < rows[1].x && rows[1].x < rows[2].x && Math.abs(rows[0].y - rows[2].y) < 2, "上の段に3席");
      assert(rows[3].x < rows[0].x && rows[4].x > rows[2].x && rows[3].y > rows[0].y && Math.abs(rows[3].y - rows[4].y) < 2, "下の段は左右の端に2席");
      // 吹き出しからも同じ卓の接客ビューが開く。手前の席も、左の列と下のドックに隠れない所へ寄る
      await page.locator('.tf-spot[data-id="4"] .tf-bubble').click();
      await page.locator(t("sheet")).waitFor();
      const zoom = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { seat: rect('.tf-spot[data-id="4"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"), top: rect(".tf-top") };
      });
      assert(zoom.seat.left >= zoom.sheet.right - 2 && zoom.seat.bottom <= zoom.dock.top + 2 && zoom.seat.top >= zoom.top.bottom - 2, JSON.stringify(zoom));
      const best = await api((a) => { const g = a.state().guests.g1; return g.options.indexOf(g.best); });
      await page.locator(t(`option-mix-${best}`)).click();
      await api((a) => a.tick(15));
      await page.locator(t("table-4")).click(); // 配膳
      assert.equal(await api((a) => a.state().tables[3].phase), "enjoy");
      assert.equal(await page.locator('.tf-spot[data-id="4"]').getAttribute("data-served"), "true");
      assert.equal(await page.locator('.tf-spot[data-id="4"] .tf-prop img').count(), 1, "卓の上の一台が出る");
      // 満足が上がると、登録があれば笑顔の絵に替わる
      const idle = await page.locator('.tf-spot[data-id="4"] .tf-who img').getAttribute("src");
      await api((a) => { a.state().tables[3].mood = 95; a.tick(1); });
      assert.notEqual(await page.locator('.tf-spot[data-id="4"] .tf-who img').getAttribute("src"), idle);
      // 奥の客のひとことは、上の帯に隠れない
      await api((a) => { for (let i = 0; i < 40 && !a.state().queue.length; i++) a.tick(1); });
      await page.locator(t("table-1")).click();
      await page.locator(t("table-1")).click();
      await page.locator(".tf-sheet .tf-option").first().click();
      await api((a) => a.tick(15));
      await page.locator(t("table-1")).click();
      const say = await page.evaluate(() => { const spot = document.querySelector('.tf-spot[data-id="1"]'); const r = spot.querySelector(".tf-say").getBoundingClientRect(); const hud = document.querySelector(".tf-top").getBoundingClientRect();
        return { top: r.top, hudBottom: hud.bottom, on: spot.querySelector(".tf-say").dataset.on, seatTop: spot.querySelector(".tf-seat").getBoundingClientRect().top, bottom: r.bottom }; });
      assert.equal(say.on, "true");
      assert(say.bottom <= say.seatTop + 2, "奥の席のひとことは頭の上");
      assert(say.top >= say.hudBottom - 4, `奥の卓のひとことが上の帯に被る: ${say.top} < ${say.hudBottom}`);
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser"}/tonari-floor-${platform}-seated.png` }).catch(() => {});
    }, options);
  }

  // 実時間: 営業中だけ時計が進み、伝票・休止・別タブで止まる。キーボードだけでも回せる。
  await run("pc-clock-and-keys", async (page) => {
    await setup(page, { manual: false });
    await page.evaluate(() => {
      C.fresh();
      window.done = C.view.runTonariFloor({ seed: 3, level: 1, night: true }).then((r) => { window.result = r; });
    });
    const state = () => page.evaluate(() => { const a = C.view.floorTest.api; return { t: a.state().t, mode: a.mode() }; });
    await page.waitForTimeout(700);
    assert.equal((await state()).t, 0, "始める前は進まない");
    await page.keyboard.press("Enter"); // 「フロアに出る」
    await page.waitForFunction(() => C.view.floorTest.api.state().queue.length > 0, null, { timeout: 10000 });
    await page.keyboard.press("Enter"); // 1卓へ案内
    assert.equal(await page.evaluate(() => C.view.floorTest.api.state().tables[0].phase), "order");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "tonari-floor-table-2");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter"); // 注文の伝票
    const opened = await state();
    assert.equal(opened.mode, "panel");
    await page.waitForTimeout(900);
    assert.equal((await state()).t, opened.t, "伝票の間は止まる");
    await page.keyboard.press("Escape");
    assert.equal((await state()).mode, "live");
    await page.waitForFunction((t) => C.view.floorTest.api.state().t > t, opened.t, { timeout: 5000 });
    await page.keyboard.press("Escape");
    const paused = await state();
    assert.equal(paused.mode, "pause");
    await page.waitForTimeout(900);
    assert.equal((await state()).t, paused.t, "休止中は止まる");
    await page.keyboard.press("Escape");
    assert.equal((await state()).mode, "live");
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
    assert.equal((await state()).mode, "pause", "別タブへ移ると休止する");
    await page.evaluate(() => { delete document.hidden; });
  });

  // 営業中に別のセーブを LOAD したら、営業は閉じて何も残さない。
  await run("pc-load-mid-floor", async (page) => {
    await setup(page);
    await page.evaluate(() => {
      const s = C.fresh();
      window.before = s;
      window.shift = C.stats.paidAction(() => C.tonari.doBaito({ floor: true })).then((r) => { window.shiftResult = r; }, (e) => { window.shiftError = e.stack; });
    });
    await page.locator(t("intro")).waitFor();
    await page.locator(t("option-start")).click();
    await page.evaluate(() => { C.view.floorTest.api.tick(8); C.core.newGame(); });
    await page.waitForFunction(() => window.shiftResult !== undefined || window.shiftError !== undefined, null, { timeout: 15000 });
    const r = await page.evaluate(() => ({ error: window.shiftError, money: window.before.money, floor: window.before.flags._tonari_floor,
      order: Object.keys(window.before.flags).filter((k) => k.startsWith("_shift_order_")), api: !!C.view.floorTest.api }));
    assert.equal(r.error, undefined);
    assert.equal(r.money, 30000);
    assert.equal(r.floor, undefined);
    assert.deepEqual(r.order, []);
    assert.equal(r.api, false);
  });
});
