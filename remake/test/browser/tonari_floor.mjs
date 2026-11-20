// tonari フロア営業（ワンオペ＆フレーバー調合型）: 勤務札→導入→営業→締め→日当の流れ、実画面の操作（PC／横持ちタッチ）、時計の停止、LOAD の境界。
// 注文待ちの卓を押すと「調合の窓」（定番・棚の30種・ボウルと予想）。ケアと会計は「接客ビュー」（店内がその卓へ寄り、左に選択肢の列・下に客のドック・選んだあとに判定の印）。
// 卓の上には「卓の札」（用件・要望の帯・卓番号と客・顔と残り秒・作成の進みと炭の残り）、右に定番の列、下の帯に出来事の行とフィーバーのゲージ。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const t = (key) => `[data-test="tonari-floor-${key}"]`;
const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";

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
        if (a.mode() === "intro") { click('[data-test="tonari-floor-option-start"]'); continue; }
        if (a.mode() === "result") { C.result = C.model.floorResult(a.state()); click('[data-test="tonari-floor-option-continue"]'); return; }
        if (a.mode() !== "live") continue;
        const action = C.bot.floorBotAction(a.state(), { pick });
        if (action) a.act(action);
        if (a.mode() === "live") a.tick(pace);
      }
      throw Error("floor did not finish");
    };
    // skip 以外の卓を、ボットと同じ判断で片付ける（注文はいちばん合う一台、ケアは正しい手、会計は見送り）
    C.others = (skip = []) => {
      const a = C.view.floorTest.api;
      for (let i = 0; i < 12; i++) {
        const s = a.state();
        const table = s.tables.find((x) => !skip.includes(x.id) && ["order", "care", "bill"].includes(C.model.floorTap(s, x.id)));
        if (!table) return;
        const kind = C.model.floorTap(s, table.id), guest = s.guests[table.guestId];
        if (kind === "order") a.act({ type: "order", tableId: table.id, mix: C.bot.bestMix(guest.order, guest.rank) });
        else if (kind === "care") a.act({ type: "care", tableId: table.id, verb: C.floorData.CALLS[table.call.type].verb });
        else a.act({ type: "bill", tableId: table.id });
      }
    };
    // stop（state を受ける式）が真になるまで、1刻みずつ進める
    C.until = (stop, skip = [], limit = 400) => {
      const a = C.view.floorTest.api, done = new Function("s", `return (${stop});`);
      for (let i = 0; i < limit; i++) {
        if (done(a.state())) return true;
        C.others(skip);
        a.tick(1);
      }
      return done(a.state());
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
    assert.match(await card.innerText(), /新しい仕事.*一人で回す/);
    const before = await page.evaluate(() => ({ money: C.core.state.money, stamina: C.core.state.stamina, slot: C.core.state.slot }));
    await card.click();
    await page.locator(t("intro")).waitFor();
    const intro = await page.locator(t("intro")).innerText();
    assert.match(intro, /はじめてのワンオペ/);
    assert.match(intro, /今日の定番 4／8/);
    assert.equal(await page.locator(".tf-how li").count(), 4, "はじめての営業は、進め方を出す");
    assert.equal(await page.locator(t("option-edit-presets")).count(), 0, "はじめての営業は、店の定番のまま始める");
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
    assert.equal(after.result.left, 0, "手際よく回せば、誰も待ちきれずに帰らない");
    assert.deepEqual(after.floor, { nights: 1, best: "S", presets: after.result.presets, fans: after.result.fans });
    assert(after.floor.presets.length >= 4 && after.floor.fans > 0);
    assert.equal(after.visited, 4);
    assert.equal(after.baitoCount, 2);
    assert.deepEqual(after.order, [], "ワンオペの営業は「今日の注文」を済んだことにしない");
    assert(classic.pay >= 8000);
    assert.equal(after.money - before.money, classic.pay + 1500, "いつものシフトの日当＋売上ボーナス");
    assert.equal(after.stamina, classic.stamina, "体力の消費はいつものシフトと同じ");
    assert(after.toasts.some((text) => /フロアの売上ボーナス（大入り）\+1,500円/.test(text)), after.toasts.join(" / "));
    // 保存した先でも、進み具合と所持金が残る
    const saved = await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem(C.core.SAVE_KEY)); return { money: raw.money, floor: raw.flags._tonari_floor }; });
    assert.deepEqual(saved, { money: after.money, floor: after.floor });
  });

  // 二回目以降: 勤務札に予報と最高評価が出る。準備の画面で定番を組める。昼のシフトは昼の呼び名と時計。
  await run("pc-forecast-and-presets", async (page) => {
    await setup(page, { slot: 0 });
    await page.evaluate(() => {
      const s = C.fresh(4, 0);
      s.flags._tonari_floor = { nights: 2, best: "A", presets: [["lemon", "mint"], ["grape", "ice"]], fans: 7 };
      C.core.save(); C.core.load(); C.ch1.resumeGame().catch((e) => { window.calendarError = e.stack; });
    });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    // 予報と最高の評価は、フロアの台本を読めてから札に足される
    await page.waitForFunction(() => /今日の予報：/.test(document.querySelector('[data-test="tonari-baito-floor"]')?.innerText || ""));
    assert.match(await page.locator('[data-test="tonari-baito-floor"]').innerText(), /これまでの最高：上々/);
    await page.locator('[data-test="tonari-baito-floor"]').click();
    await page.locator(t("intro")).waitFor();
    assert.deepEqual(await page.evaluate(() => C.trace.filter((id) => /floor/.test(id))), ["tonari_floor_start"]);
    const intro = await page.locator(t("intro")).innerText();
    assert.match(intro, /今日の定番 2／8/);
    assert.match(intro, /店のファン 7人/);
    assert.equal(await page.locator(".tf-radar svg polygon").count() >= 1, true, "定番の釣り合いの図が出る");
    // 定番を組む: 棚から選んで登録する（客のいない調合の窓）
    await page.locator(t("option-edit-presets")).click();
    await page.locator(t("mix")).waitFor();
    assert.equal(await page.evaluate(() => C.view.floorTest.api.mode()), "mix");
    assert.equal(await page.locator(t("mix-confirm")).count(), 0);
    assert.equal(await page.locator(t("mix-save")).isDisabled(), true, "空のボウルは登録できない");
    await page.locator(t("flavor-peach")).click();
    await page.locator(t("flavor-lemon")).click();
    assert.match(await page.locator(t("mix-preview")).innerText(), /相性 柑橘×甘い/);
    await page.locator(t("mix-save")).click();
    assert.deepEqual(await page.evaluate(() => C.view.floorTest.api.state().presets), [["lemon", "mint"], ["grape", "ice"], ["peach", "lemon"]]);
    assert.match(await page.locator(t("mix-save")).innerText(), /定番から外す/);
    await page.locator(t("mix-later")).click();
    assert.equal(await page.evaluate(() => C.view.floorTest.api.mode()), "intro");
    assert.match(await page.locator(t("intro")).innerText(), /今日の定番 3／8/);
    await page.locator(t("option-start")).click();
    const live = await page.evaluate(() => { const s = C.view.floorTest.api.state(); return { daytime: s.daytime, clock: C.model.floorClock(s), level: s.level }; });
    assert.deepEqual(live, { daytime: true, clock: "12:00", level: 2 });
    assert.equal(await page.locator(t("screen")).getAttribute("data-night"), "false");
    assert.equal(await page.locator(".tf-preset").count(), 3, "右の列に、登録した定番が並ぶ");
    await page.evaluate(() => C.drive({ pace: 3 }));
    await page.waitForFunction(() => C.core.state.slot >= 1 && !document.querySelector('[data-test="tonari-floor-screen"]:not(.done)'), null, { timeout: 60000 });
    const done = await page.evaluate(() => ({ floor: C.core.state.flags._tonari_floor, result: C.result, error: window.calendarError }));
    assert.equal(done.error, undefined);
    assert.equal(done.floor.nights, 3);
    assert.deepEqual(done.floor.presets, done.result.presets);
    assert(done.floor.presets.length >= 3);
    assert.equal(done.floor.fans, Math.max(0, 7 + done.result.fans));
    assert.equal(done.result.served + done.result.left, done.result.came);
    assert(done.result.served >= 1);
  });

  // 実画面の操作: 来店→調合（完全指定はそのまま・抽象的な注文は読んで組む・定番はひと押し）→作成→提供→ケア→会計→フィーバー、休止・速さ・早じまい・精算。
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-ui`, async (page) => {
      await setup(page);
      await page.evaluate(() => {
        C.fresh();
        window.done = C.view.runTonariFloor({ seed: 5, level: 1, chapter: 1, night: true, fans: 12,
          art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
      });
      const api = (fn, arg) => page.evaluate(({ fn, arg }) => new Function("a", "arg", `return (${fn})(a, arg)`)(C.view.floorTest.api, arg), { fn: fn.toString(), arg });
      const tick = (n) => api((a, n) => a.tick(n), n);
      const until = (stop, skip = []) => page.evaluate(({ stop, skip }) => C.until(stop, skip), { stop, skip });
      const table = (id) => page.locator(t(`table-${id}`));
      const spot = (id) => page.locator(`.tf-spot[data-id="${id}"]`);
      const tagText = (id) => page.locator(`.tf-spot[data-id="${id}"] .tf-bubble`).innerText().then((text) => text.replace(/\s+/g, " ").trim());
      const lastLog = () => page.locator(`${t("log")} p`).last().innerText();
      await page.locator(t("option-start")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await tagText(1), "1 空席");
      assert.match(await page.locator(t("dock")).innerText(), /1卓\s*空席/);
      // 来店: 客は自分で座る（案内はしない）。来店は下の帯の出来事の行にも出る
      await tick(4);
      const g1 = await api((a) => a.state().guests[a.state().tables[0].guestId]);
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      assert.equal(await lastLog(), `${g1.name}が来店。1卓へ`);
      // 一組目は、完全に指定してくる客（「マンゴーミルク、ください」）。卓の札: 用件・頼まれた物・卓番号・残り秒（注文は9秒から）
      assert.deepEqual([g1.order.type, g1.order.exact, g1.order.quote], ["exact", ["mango", "milk"], "マンゴーミルク、ください"]);
      assert.equal(await tagText(1), "注文 マンゴー＋ミルク 1 9 指定");
      assert.equal(await spot(1).getAttribute("data-tone"), "act");
      assert.equal(await tagText(2), "2 空席");
      assert.equal(await page.locator(t("screen")).getAttribute("data-ordering"), "true");
      // 画面の外へはみ出さない・押せる大きさ（実画素で40px以上）
      const boxes = await page.evaluate(() => {
        const stage = document.getElementById("stage").getBoundingClientRect();
        return [...document.querySelectorAll(".tf-seat, .tf-bonus, .tf-pause-button, .tf-ticker, .tf-dock, .tf-clock, .tf-making, .tf-sales, .tf-presets, .tf-preset")].map((n) => {
          const r = n.getBoundingClientRect();
          return { cls: n.className, w: r.width, h: r.height, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
        });
      });
      for (const box of boxes) {
        assert(box.inside, `${box.cls} が舞台の外`);
        if (/tf-(seat|bonus|pause-button|ticker|preset)$/.test(box.cls)) assert(Math.min(box.w, box.h) >= 40, `${box.cls} が小さい: ${box.w}x${box.h}`);
      }
      assert.equal(await page.evaluate(() => document.querySelector(".tonari-floor").scrollLeft), 0);
      // 上の帯は左から「作成中の一台・残り時間・売上」、下の帯は「卓のドック・出来事の行・フィーバー」。定番の列は右
      const bands = await page.evaluate(() => {
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const x = (sel) => { const r = rect(sel); return (r.left + r.right) / 2; };
        const stage = rect("#stage"), side = rect(".tf-presets"), top = rect(".tf-top"), bottom = rect(".tf-bottom");
        const tags = [...document.querySelectorAll(".tf-spot")].map((n) => { const r = n.querySelector(".tf-tag-box").getBoundingClientRect(), s = n.querySelector(".tf-seat").getBoundingClientRect();
          return { left: Math.min(r.left, s.left), right: Math.max(r.right, s.right), top: r.top, bottom: Math.max(r.bottom, s.bottom) }; });
        return { top: [x(".tf-making"), x(".tf-clock"), x(".tf-sales")], bottom: [x(".tf-dock"), x(".tf-ticker"), x(".tf-bonus")], center: (stage.left + stage.right) / 2,
          side: { left: side.left, top: side.top, bottom: side.bottom }, sideRight: side.left > (stage.left + stage.right) / 2, hud: top.bottom, foot: bottom.top, tags };
      });
      assert(bands.top[0] < bands.top[1] && bands.top[1] < bands.top[2] && Math.abs(bands.top[1] - bands.center) < 4, "残り時間は上のまん中");
      assert(bands.bottom[0] < bands.bottom[1] && bands.bottom[1] < bands.bottom[2], "下の帯の並び");
      assert(bands.sideRight && bands.side.top >= bands.hud - 2 && bands.side.bottom <= bands.foot + 2, "定番の列は右。上下の帯に被らない");
      for (const [i, tag] of bands.tags.entries()) {
        assert(tag.right <= bands.side.left + 2, `${i + 1}卓の札・押し所が定番の列に被る: ${tag.right} > ${bands.side.left}`);
        assert(tag.top >= bands.hud - 2 && tag.bottom <= bands.foot + 2, `${i + 1}卓の札が帯に被る`);
      }
      // 選んだ卓の様子が、下のドックに出る（注文を聞くまで、ご利用は0円）
      assert.match(await page.locator(t("dock")).innerText(), new RegExp(`1卓\\s*${g1.name}`));
      assert.equal(await page.locator(t("dock-bill")).innerText(), "0円");
      if (platform === "pc") {
        // マウスを乗せた卓の様子に替わる（押さなくても見られる）
        await table(2).hover();
        assert.match(await page.locator(t("dock")).innerText(), /2卓\s*空席/);
        await table(1).hover();
        assert.match(await page.locator(t("dock")).innerText(), /1卓/);
      }
      // 調合の窓: 開いている間は時間が止まる。「あとで」で閉じても注文は残る
      await table(1).click();
      await page.locator(t("mix")).waitFor();
      assert.equal(await api((a) => a.mode()), "mix");
      assert.equal(await page.locator(t("mix-quote")).innerText(), `「${g1.order.quote}」`);
      assert.deepEqual(await page.locator(".tf-mix-head .tf-chips span").allInnerTexts(), ["指定：マンゴー＋ミルク", "言われたとおりに、そのまま"]);
      assert.equal(await page.locator(".tf-mix-tabs button").count(), 4);
      // 名前の挙がったフレーバーの棚から開き、その棚と札に印が付く
      assert.equal(await page.locator(t("mix-tab-fruit")).getAttribute("aria-selected"), "true");
      assert.deepEqual(await page.locator('.tf-mix-tabs button[data-named="true"]').allInnerTexts(), ["フルーツ", "甘"]);
      assert.equal(await page.locator(t("flavor-mango")).getAttribute("data-must"), "true");
      assert.equal(await page.locator(".tf-mix-preset").count(), 4);
      assert.equal(await page.locator(t("mix-confirm")).isDisabled(), true);
      const frame = await page.evaluate(() => {
        const rect = (n) => n.getBoundingClientRect();
        const stage = rect(document.getElementById("stage")), card = rect(document.querySelector(".tf-mix")), shelf = rect(document.querySelector(".tf-mix-shelf")), bowl = rect(document.querySelector(".tf-mix-bowl"));
        const small = [...document.querySelectorAll(".tf-flavor, .tf-mix-preset, .tf-mix-tabs button, .tf-mix .tf-option, .tf-mix-foot .tf-link")].map(rect).filter((r) => Math.min(r.width, r.height) < 40).length;
        return { inside: card.top >= stage.top - 1 && card.bottom <= stage.bottom + 1 && card.left >= stage.left - 1 && card.right <= stage.right + 1, apart: shelf.right <= bowl.left + 1, small };
      });
      assert(frame.inside, "調合の窓が舞台に収まる");
      assert(frame.apart, "棚がボウルの列に被らない");
      assert.equal(frame.small, 0, "棚・定番・タブは押せる大きさ");
      const t0 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t0, "調合の間は進まない");
      await page.locator(t("mix-later")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      // 完全指定は、言われたとおりにそのまま出す。余計な一種を足すと「余計な一種」、3種まで。もう一度押すと外れる
      await table(1).click();
      await page.locator(t("flavor-mango")).click();
      assert.match(await page.locator(t("mix-preview")).innerText(), /頼まれた物が足りない/);
      await page.locator(t("mix-tab-sweet")).click();
      assert.equal(await page.locator(".tf-flavor").count(), 7);
      for (const id of ["milk", "vanilla", "honey"]) await page.locator(t(`flavor-${id}`)).click();
      assert.equal(await page.locator(".tf-bowl-slot:not(.empty)").count(), 3, "ボウルは3種まで");
      assert.match(await page.locator(t("mix-preview")).innerText(), /余計な一種が入っている/);
      assert.equal(await page.locator(t("mix-preview")).getAttribute("data-grade"), "good");
      await page.locator(t("flavor-vanilla")).click();
      assert.deepEqual(await page.locator(".tf-bowl-slot:not(.empty)").allInnerTexts(), ["マンゴー", "ミルク"]);
      assert.equal(await page.locator(t("mix-preview")).getAttribute("data-grade"), "best");
      assert.equal(await page.locator(t("mix-preview")).getAttribute("data-mood"), "92");
      assert.match(await page.locator(t("mix-preview")).innerText(), /言われたとおり ◎[\s\S]*予想の満足[\s\S]*大満足[\s\S]*作成 約7秒/);
      assert.doesNotMatch(await page.locator(t("mix")).innerText(), /原価/, "原価は出さない");
      await page.locator(t("mix-confirm")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await api((a) => a.state().tables[0].phase), "prep");
      assert.match(await page.locator(t("making")).innerText(), /1卓\s*マンゴー＋ミルク/);
      assert.match(await tagText(1), /^作成中 1 \d+秒$/);
      assert.equal(await spot(1).getAttribute("data-gauge"), "make");
      // 二組目は、抽象的な注文（雰囲気＋抜いてほしい物）。卓の札の帯に系統、右下に求める吸い心地、NG の印
      await tick(5);
      const g2 = await api((a) => a.state().guests[a.state().tables[1].guestId]);
      assert.deepEqual([g2.order.type, g2.order.family, g2.order.trait, g2.order.ng], ["ng", "sweet", "taste", "heavy"]);
      assert.equal(await tagText(2), "注文 甘 2 9 香り");
      assert.equal(await spot(2).locator(".tf-tag-req").getAttribute("data-ng"), "true", "NG のある注文は、帯に印が付く");
      await table(2).click();
      assert.equal(await page.locator(t("mix-quote")).innerText(), `「${g2.order.quote}」`);
      assert.deepEqual(await page.locator(".tf-mix-head .tf-chips span").allInnerTexts(), ["甘系", "味・香り", "重いの無し"]);
      assert.equal(await page.locator(t("mix-tab-sweet")).getAttribute("aria-selected"), "true", "客の求める系統の棚から開く");
      assert.equal(await page.locator(t("flavor-chocolate")).getAttribute("data-ng"), "true", "NG に当たるフレーバーには印が付く");
      await page.locator(t("flavor-chocolate")).click();
      assert.match(await page.locator(t("mix-preview")).innerText(), /重いの無しに当たる！/);
      await page.locator(t("flavor-chocolate")).click();
      for (const id of ["caramel", "pistachio"]) await page.locator(t(`flavor-${id}`)).click();
      const expected = await page.evaluate((g) => { const r = C.model.evaluateMix(["caramel", "pistachio"], g.order, g.rank); return { grade: r.grade, mood: String(Math.round(r.mood)) }; }, g2);
      assert.equal(expected.grade, "best");
      assert.equal(await page.locator(t("mix-preview")).getAttribute("data-grade"), "best");
      assert.equal(await page.locator(t("mix-preview")).getAttribute("data-mood"), expected.mood, "予想は、ルールの評価と同じ");
      assert.match(await page.locator(t("mix-preview")).innerText(), /甘系 ◎[\s\S]*相性 デザート×ナッツ[\s\S]*予想の満足[\s\S]*大満足[\s\S]*作成 約7秒/);
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-mix.png` }).catch(() => {});
      await page.locator(t("mix-confirm")).click();
      assert.equal(await api((a) => a.state().tables[1].phase), "prep");
      // 三組目は、定番をひと押し: いちばん急ぎの注文待ちの卓へ、そのまま出る。同時に作れるのは2台までで、三台目は順番を待つ
      await tick(5);
      assert.equal(await api((a) => a.state().tables[2].phase), "order");
      await page.locator(t("preset-3")).click({ force: true });
      assert.deepEqual(await api((a) => { const x = a.state().tables[2]; return [x.phase, x.preset, x.mix, x.make.active]; }), ["prep", true, ["earlgrey", "milk"], false]);
      assert.equal(await lastLog(), "3卓　アールグレイ＋ミルクを作りはじめた");
      assert.match(await tagText(3), /^作成待ち 3/);
      assert.match(await page.locator(".tf-making-more").innerText(), /待ち 1台/);
      assert.equal(await page.locator(".tf-making-row:not(.empty)").count(), 2);
      // 出来上がると、自動で卓へ運ばれる。客のひとことは下の帯の行に、初回のドリンクとチャージは伝票に入る
      await until("s.tables[0].phase === 'enjoy'", [1]);
      assert.equal(await tagText(1), "くつろぎ中 1 ×1");
      assert.equal(await spot(1).getAttribute("data-tone"), "fine");
      assert.equal(await spot(1).getAttribute("data-smoke"), "true");
      assert.equal(await spot(1).getAttribute("data-gauge"), "coal");
      assert.equal(await spot(1).getAttribute("data-mood"), "max");
      assert.equal(await spot(1).locator(".tf-tag-pie").evaluate((n) => getComputedStyle(n).opacity), "1");
      // 満足の顔は、丸い顔ではなく煙のかたちの顔（5つの表情）
      assert.equal(await spot(1).locator(".tf-tag-face svg path").count() >= 4, true);
      assert.equal(await spot(1).locator(".tf-tag-face svg circle").count(), 0);
      // 定番を出した時に3卓が選ばれているので、1卓を選び直す（マウスを乗せるのと同じ）
      await page.evaluate(() => document.querySelector('[data-test="tonari-floor-table-1"]').dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" })));
      assert.equal(await page.locator(t("dock-bill")).innerText(), "3,300円", "チャージ700円＋基本2,000円＋初回ドリンク600円");
      assert.equal(await page.locator(".tf-say").count(), 0, "卓の上の吹き出しは使わない");
      // ケア: 5つの手は固定の並び。正しい手で満足が上がる
      await api((a) => { a.state().tables[0].mood = 70; });
      await until("!!s.tables[0].call", [1]);
      const call = await api((a) => a.state().tables[0].call.type);
      const mood = await api((a) => a.state().tables[0].mood);
      assert.match(await tagText(1), /^\S+ 1 ×\d \d+$/, "ケアの札には、消えるまでの残り秒が出る");
      assert.equal(await spot(1).getAttribute("data-tone"), "act");
      await table(1).click();
      await page.locator(t("sheet")).waitFor();
      assert.equal(await api((a) => a.mode()), "panel");
      // 接客ビュー: 店内がその卓へ寄り、選んだ卓は左の列にも下のドックにも隠れない
      const view = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height }; };
        return { cam: document.querySelector(".tf-cam").style.transform, seat: rect('.tf-spot[data-id="1"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"),
          foot: rect(".tf-sheet-foot"), row: rect(".tf-list .tf-option").h, hidden: getComputedStyle(document.querySelector(".tf-ticker")).display,
          side: getComputedStyle(document.querySelector(".tf-presets")).opacity };
      });
      assert.match(view.cam, /scale\(1\.3\)/);
      assert(view.seat.left >= view.sheet.right - 2, `選んだ卓が左の列に隠れる: ${view.seat.left} < ${view.sheet.right}`);
      assert(view.seat.bottom <= view.dock.top + 2, "選んだ卓が下のドックに隠れる");
      assert(view.foot.bottom <= view.dock.top + 2, `ケアの列がドックに被る: ${view.foot.bottom} > ${view.dock.top}`);
      assert(view.row >= 40, `行が小さい: ${view.row}`);
      assert.equal(view.hidden, "none", "接客ビューでは、出来事の行を引っ込める");
      assert.equal(view.side, "0", "接客ビューでは、定番の列を引っ込める");
      assert.match(await page.locator(t("dock")).innerText(), /ご注文[\s\S]*マンゴー＋ミルク/);
      assert.deepEqual(await page.locator(".tf-sheet .tf-option b").allInnerTexts().then((list) => list.map((s) => s.replace(/\s/g, ""))),
        ["炭を替える", "炭を下ろす", "お水を出す", "吸い方を案内する", "雑談する"]);
      const t1 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t1, "ケアを選ぶ間は進まない");
      // 選んだあと、判定の印（◎）が出る。印が出ている間も時間は止まり、もう一度押すと先へ進む
      const verb = await page.evaluate((call) => C.floorData.CALLS[call].verb, call);
      await page.evaluate(() => { C.view.floorTest.verdictMs = 60000; });
      await page.locator(t(`option-${verb}`)).click();
      assert(await api((a) => a.state().tables[0].mood) > mood);
      assert.equal(await api((a) => a.mode()), "panel");
      assert.equal(await page.locator(t("sheet")).getAttribute("data-verdict"), "best");
      assert.equal(await page.locator(".tf-verdict b").innerText(), "いいケア！");
      assert.equal(await page.locator(t(`option-${verb}`)).getAttribute("data-picked"), "true");
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-verdict.png` }).catch(() => {});
      await page.locator(t(`option-${verb}`)).click();
      await page.evaluate(() => { C.view.floorTest.verdictMs = null; });
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await page.locator(".tf-cam").evaluate((n) => n.style.transform), "", "列を閉じると、店内は元の引きに戻る");
      // 会計はひと押し（選ばない）。延長は誘わない（客から言い出す）。見送りの言葉は出来事の行に出る
      await until("s.tables[0].phase === 'bill'", []);
      await api((a) => { a.state().tables[0].mood = 90; });
      const bill = await api((a) => C.model.floorBill(a.state(), 1));
      assert.equal(bill.total, bill.charge + bill.shisha + bill.drink + bill.top);
      const before = await api((a) => ({ sales: a.state().sales, fans: a.state().fans }));
      await table(1).click();
      assert.equal(await api((a) => a.mode()), "live", "会計で画面は切り替わらない");
      assert.equal(await page.locator(t("sheet")).count(), 0);
      assert.deepEqual(await api((a) => { const s = a.state(); return [s.tables[0].phase, s.fans, s.sales]; }), ["cool", before.fans + 3, before.sales],
        "大満足の客はファン＋3。売上は注文のたびに入っている（会計で二重に足さない）");
      assert(before.sales >= bill.total);
      assert.match(await lastLog(), /^1卓「.+」$/);
      assert.match(await page.locator(t("dock")).innerText(), /1卓\s*片付け中/);
      assert.equal(await tagText(1), "1 片付け中");
      // フィーバー: 1段溜まるまで押せない。使うと、くつろいでいる卓が最高の居心地になる
      await until("s.tables.filter((x) => x.phase === 'enjoy').length >= 2", []);
      await api((a) => { a.state().fever = 40; a.tick(1); });
      assert.equal(await page.locator(t("bonus")).isDisabled(), true);
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "");
      await api((a) => { a.state().fever = 130; a.tick(1); });
      assert.equal(await page.locator(t("bonus")).isDisabled(), false);
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "ready");
      assert.match(await page.locator(t("bonus")).innerText(), /フィーバー Lv1/);
      await page.locator(t("bonus")).click({ force: true });
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "on");
      assert.match(await page.locator(".tf-cutin").innerText(), /FEVER TIME!\s*Lv1/);
      const fever = await api((a) => { const s = a.state(); return { level: s.feverLevel, left: s.feverLeft, tables: s.tables.filter((x) => x.fever).map((x) => [x.id, x.mood]), fevers: s.fevers }; });
      assert.equal(fever.level, 1);
      assert.equal(fever.fevers, 1);
      assert.equal(fever.tables.length, 2, "Lv1 は2卓まで");
      assert(fever.tables.every(([, mood]) => mood === 100));
      assert.equal(await spot(fever.tables[0][0]).getAttribute("data-tone"), "fever");
      assert.equal(await page.locator(t("bonus")).isDisabled(), true, "フィーバー中は重ねて使えない");
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-fever.png` }).catch(() => {});
      // 休止→ゆっくり→つづける→早じまい→締めの伝票
      await page.locator(t("pause")).click();
      await page.locator(t("pause-panel")).waitFor();
      await page.locator(t("option-speed")).click();
      assert.match(await page.locator(t("option-speed")).innerText(), /ふつうの速さに戻す/);
      await page.locator(t("option-resume")).click();
      assert.equal(await api((a) => a.mode()), "live");
      await page.locator(t("pause")).click();
      await page.locator(t("option-close")).click();
      await page.locator(t("close-panel")).waitFor();
      await page.locator(t("option-confirm-close")).click();
      await page.locator(t("result")).waitFor();
      assert.match(await page.locator(t("rank")).innerText(), /大入り|上々|まずまず|ばたばた/);
      // 結果: 売上の内訳（項目ごと）と合計。内訳の合計は、店の売上と一致する（原価・利益は出さない）
      const slip = await page.evaluate(() => {
        const yen = (text) => Number(text.replace(/[^0-9]/g, ""));
        const rows = [...document.querySelectorAll(".tf-slip-items div")].map((n) => [n.querySelector("dt").textContent, n.querySelector("dd").textContent]);
        const card = document.querySelector(".tf-slip").getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
        return { names: rows.map((r) => r[0].replace(/（\d+杯）/, "")), sum: rows.slice(1, 5).reduce((total, r) => total + yen(r[1]), 0),
          total: yen(document.querySelector('[data-test="tonari-floor-final-sales"]').textContent), profit: document.querySelectorAll('[data-test="tonari-floor-profit"]').length,
          text: document.querySelector(".tf-slip").textContent, fans: document.querySelector('[data-test="tonari-floor-fans"]').textContent, inside: card.top >= stage.top - 1 && card.bottom <= stage.bottom + 1 };
      });
      assert.deepEqual(slip.names, ["お迎えした組", "チャージ", "シーシャ", "ドリンク", "トップ替え（おかわり）"]);
      assert.equal(slip.sum, slip.total);
      assert.equal(slip.profit, 0);
      assert.doesNotMatch(slip.text, /原価|利益|サービス費/);
      assert.match(slip.fans, /^店のファン [＋−]\d+人（合計 \d+人）$/);
      assert(slip.inside, "結果の札が舞台に収まる");
      // 好評だったミックスを、その場で定番に登録できる
      const mixes = await page.locator(".tf-slip-mixes li").count();
      assert(mixes >= 1);
      const add = page.locator('[data-test^="tonari-floor-result-save-"]').first();
      if (await add.count()) {
        const presets = await api((a) => a.state().presets.length);
        await add.click();
        assert.equal(await api((a) => a.state().presets.length), presets + 1);
        assert.equal(await page.locator(t("result")).count(), 1, "登録しても、結果の画面のまま");
      }
      await page.screenshot({ path: `${shots}/tonari-floor-${platform}-result.png` }).catch(() => {});
      await page.locator(t("option-continue")).click();
      await page.waitForFunction(() => window.result !== undefined);
      const result = await page.evaluate(() => ({ result: window.result, presets: window.result.presets.length }));
      assert.equal(result.result.closing, "early");
      const mine = result.result.groups.find((g) => g.tableId === 1);
      assert.equal(mine.stage, "max");
      assert.equal(mine.total, bill.total);
      assert.deepEqual(["cost", "service", "profit"].filter((key) => key in result.result), []);
      assert.equal(result.result.fevers, 1);
      assert(result.presets >= 4);
      assert.equal(await page.evaluate(() => C.core.state.money), 30000, "店の売上は、はじめの所持金に入らない");
    }, options);
  }

  // 専用の店内画: 絵が届く前でも、配置図の舞台で重なりと操作を確かめる。
  // 席は「上3（こちら向き）・下2（内向き）」。客は全身を描かず、席に「丸の中の顔」で出す（二人組は丸が二つ）。絵の登録があれば影絵の代わりに絵を出す。
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-seated-stage`, async (page) => {
      await setup(page);
      await page.evaluate(async () => {
        C.fresh();
        const guide = await import("./test/tonari_floor_guide.mjs");
        const pixel = (color) => { const c = Object.assign(document.createElement("canvas"), { width: 8, height: 8 }); const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 8, 8); return c.toDataURL(); };
        const painted = { idle: pixel("#c33"), happy: pixel("#3c3") };
        window.done = C.view.runTonariFloor({ seed: 3, level: 1, night: true, stage: guide.floorGuideStage({ night: true }),
          guests: new Proxy({}, { get: () => painted }), props: { shisha: pixel("#ccc") } }).then((r) => { window.result = r; });
      });
      const api = (fn, arg) => page.evaluate(({ fn, arg }) => new Function("a", "arg", `return (${fn})(a, arg)`)(C.view.floorTest.api, arg), { fn: fn.toString(), arg });
      const until = (stop, skip = []) => page.evaluate(({ stop, skip }) => C.until(stop, skip), { stop, skip });
      await page.locator(t("option-start")).click();
      assert.equal(await page.locator(t("screen")).getAttribute("data-style"), "seated");
      assert.equal(await page.locator(".tf-front").count(), 1);
      // 奥の卓の札（注文待ちがいちばん背が高い）は、座った客の頭の上に出て、上の帯にも右の定番の列にも隠れない
      await api((a) => a.tick(4));
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      const back = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        return { tag: rect('.tf-spot[data-id="1"] .tf-bubble'), seat: rect('.tf-spot[data-id="1"] .tf-seat'), hud: rect(".tf-top"), side: rect(".tf-presets"),
          right: rect('.tf-spot[data-id="3"] .tf-seat'), rightSide: rect('.tf-spot[data-id="5"] .tf-seat') };
      });
      assert(back.tag.bottom <= back.seat.top + 2, "奥の席の札は頭の上");
      assert(back.tag.top >= back.hud.bottom - 2, `奥の卓の札が上の帯に被る: ${back.tag.top} < ${back.hud.bottom}`);
      assert(back.right.right <= back.side.left + 2 && back.rightSide.right <= back.side.left + 2, "右の席が定番の列に被る");
      // 手前の左の卓（4卓）に客が座るまで進める
      await until("s.tables[3].phase === 'order'", []);
      const geo = await page.evaluate(() => {
        const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
        const spot = '.tf-spot[data-id="4"]';
        return { seat: rect(`${spot} .tf-seat`), plate: rect(`${spot} .tf-plate`), bubble: rect(`${spot} .tf-bubble`),
          z: { seat: z(`${spot} .tf-seat`), front: z(".tf-front"), plate: z(`${spot} .tf-plate`), bubble: z(`${spot} .tf-bubble`) },
          painted: !!document.querySelector(`${spot} .tf-who img`) };
      });
      assert(geo.z.seat < geo.z.front && geo.z.front < geo.z.plate && geo.z.plate < geo.z.bubble, JSON.stringify(geo.z));
      assert(geo.painted, "登録した客の絵が出る");
      // 客は「丸の中の顔」: 丸く切り抜かれ、席の範囲に収まる。席に顔が出るので、卓の札の顔の窓は畳む
      const token = await page.evaluate(() => {
        const seat = document.querySelector('.tf-spot[data-id="4"] .tf-seat').getBoundingClientRect();
        const people = [...document.querySelectorAll('.tf-spot[data-id="4"] .tf-who .tf-person')].map((n) => { const r = n.getBoundingClientRect();
          return { w: r.width, h: r.height, round: getComputedStyle(n).borderRadius, inside: r.left >= seat.left - 1 && r.right <= seat.right + 1 && r.top >= seat.top - 1 && r.bottom <= seat.bottom + 1 }; });
        return { people, party: Number(document.querySelector('.tf-spot[data-id="4"]').dataset.party), tagFace: getComputedStyle(document.querySelector('.tf-spot[data-id="4"] .tf-tag-who')).display };
      });
      assert.equal(token.people.length, token.party, "人数ぶんの丸が出る");
      for (const person of token.people) {
        assert(Math.abs(person.w - person.h) < 1.5 && person.round === "50%" && person.inside, JSON.stringify(person));
        assert(person.h < geo.seat.h * 0.75, "全身ではなく、顔の丸");
      }
      assert.equal(token.tagFace, "none");
      assert(geo.bubble.bottom <= geo.plate.top + 2, "手前の席の札は、内側の卓の上");
      assert(geo.bubble.left >= geo.seat.right - 2, "手前の左の席は、卓と札が内側（右）にある");
      assert(geo.seat.h >= 40 && geo.seat.w >= 40, `座った客は押せる大きさ: ${geo.seat.w}x${geo.seat.h}`);
      // 席の形: 上の3席はこちら向き、下の2席は内向き（右の席は絵を反転する）
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tf-spot")].map((n) => `${n.dataset.row}:${n.dataset.flip}`)),
        ["back:false", "back:false", "back:false", "side:false", "side:true"]);
      const rows = await page.evaluate(() => [...document.querySelectorAll(".tf-spot .tf-seat")].map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      assert(rows[0].x < rows[1].x && rows[1].x < rows[2].x && Math.abs(rows[0].y - rows[2].y) < 2, "上の段に3席");
      assert(rows[3].x < rows[0].x && rows[4].x > rows[2].x && rows[3].y > rows[0].y && Math.abs(rows[3].y - rows[4].y) < 2, "下の段は左右の端に2席");
      // 卓の札からも同じ卓の調合の窓が開く。窓の中の定番は、注文との合い方の印つき
      await page.locator('.tf-spot[data-id="4"] .tf-bubble').click({ force: true });
      await page.locator(t("mix")).waitFor();
      assert.equal(await page.locator(".tf-mix-preset i").count(), 4);
      await page.locator(t("mix-preset-0")).click();
      await page.locator(t("mix-confirm")).click();
      assert.deepEqual(await api((a) => { const x = a.state().tables[3]; return [x.phase, x.preset]; }), ["prep", true]);
      await until("s.tables[3].phase === 'enjoy'", [4]);
      assert.equal(await page.locator('.tf-spot[data-id="4"]').getAttribute("data-served"), "true");
      assert.equal(await page.locator('.tf-spot[data-id="4"] .tf-prop img').count(), 1, "卓の上の一台が出る");
      // 満足が上がると、登録があれば笑顔の絵に替わる
      await api((a) => { a.state().tables[3].mood = 50; a.tick(1); });
      const idle = await page.locator('.tf-spot[data-id="4"] .tf-who img').first().getAttribute("src");
      await api((a) => { a.state().tables[3].mood = 95; a.tick(1); });
      assert.notEqual(await page.locator('.tf-spot[data-id="4"] .tf-who img').first().getAttribute("src"), idle);
      // 手前の席も、ケアの列と下のドックに隠れない所へ寄る
      await until("!!s.tables[3].call", [4]);
      await page.locator(t("table-4")).click({ force: true });
      await page.locator(t("sheet")).waitFor();
      const zoom = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { seat: rect('.tf-spot[data-id="4"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"), top: rect(".tf-top") };
      });
      assert(zoom.seat.left >= zoom.sheet.right - 2 && zoom.seat.bottom <= zoom.dock.top + 2 && zoom.seat.top >= zoom.top.bottom - 2, JSON.stringify(zoom));
      await page.screenshot({ path: `${shots}/tonari-floor-${platform}-seated.png` }).catch(() => {});
    }, options);
  }

  // たまに遊びに来る本編の人物: 顔アイコンで出て、その人の注文と言葉で返す。精算に名前が残り、好感度は動かない。
  await run("pc-visitor", async (page) => {
    await setup(page);
    await page.evaluate(() => {
      const s = C.fresh();
      window.affinityBefore = JSON.stringify(s.affinity);
      window.done = C.view.runTonariFloor({ seed: 3, level: 1, chapter: 1, night: true, visitor: "adam",
        art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
    });
    const api = (fn, arg) => page.evaluate(({ fn, arg }) => new Function("a", "arg", `return (${fn})(a, arg)`)(C.view.floorTest.api, arg), { fn: fn.toString(), arg });
    await page.locator(t("option-start")).click();
    await page.evaluate(() => C.until("s.tables[2].phase === 'order'", [3]));
    const guest = await api((a) => a.state().guests[a.state().tables[2].guestId]);
    assert.deepEqual([guest.charId, guest.name, guest.order.type], ["adam", "アダム", "exact"]);
    const spot = page.locator('.tf-spot[data-id="3"]');
    assert.equal(await spot.getAttribute("data-rare"), "true");
    assert.match(await spot.locator(".tf-tag-who img").getAttribute("src"), /face_adam/);
    assert.equal((await spot.locator(".tf-bubble").innerText()).replace(/\s+/g, " ").trim(), "注文 ダブルアップル 3 9 指定");
    assert.match(await page.locator(t("log")).innerText(), /アダムが遊びに来た！ 3卓へ/);
    await page.locator(t("table-3")).click();
    await page.locator(t("mix")).waitFor();
    assert.equal(await page.locator(t("mix-quote")).innerText(), "「……はじめよ。ダブルアップルを。それだけでいい」");
    assert.equal(await page.locator(".tf-mix-head .tf-chips span").first().innerText(), "指定：ダブルアップル");
    assert.match(await page.locator(".tf-mix-who img").getAttribute("src"), /face_adam/);
    await page.locator(t("flavor-apple")).click();
    assert.match(await page.locator(t("mix-preview")).innerText(), /言われたとおり ◎/);
    await page.locator(t("mix-confirm")).click();
    await page.evaluate(() => C.until("s.tables[2].phase === 'enjoy'", [3]));
    assert.deepEqual(await api((a) => { const x = a.state().tables[2]; return [x.grade, x.line]; }), ["best", "……よい。この顔は、知っている"]);
    await api((a) => a.act({ type: "finish" }));
    await page.locator(t("result")).waitFor();
    assert.equal(await page.locator(t("visitor")).innerText(), "今日は、アダムが遊びに来た");
    await page.screenshot({ path: `${shots}/tonari-floor-pc-visitor.png` }).catch(() => {});
    await page.locator(t("option-continue")).click();
    await page.waitForFunction(() => window.result !== undefined);
    const done = await page.evaluate(() => ({ visitor: window.result.visitor, row: window.result.groups.find((g) => g.charId === "adam"), same: JSON.stringify(C.core.state.affinity) === window.affinityBefore }));
    assert.equal(done.visitor, "adam");
    assert.equal(done.row.stage, "max");
    assert(done.same, "営業で好感度は動かない");
  });

  // 実時間: 営業中だけ時計が進み、調合・休止・フィーバーの突入・別タブで止まる。キーボードだけでも回せる。
  await run("pc-clock-and-keys", async (page) => {
    await setup(page, { manual: false });
    await page.evaluate(() => {
      C.fresh();
      window.done = C.view.runTonariFloor({ seed: 3, level: 1, night: true }).then((r) => { window.result = r; });
    });
    const state = () => page.evaluate(() => { const a = C.view.floorTest.api; return { t: a.state().t, mode: a.mode() }; });
    await page.waitForTimeout(700);
    assert.equal((await state()).t, 0, "始める前は進まない");
    await page.keyboard.press("Enter"); // 「開店する」
    await page.waitForFunction(() => C.view.floorTest.api.state().tables[0].phase === "order", null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "tonari-floor-table-1");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "tonari-floor-table-2");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter"); // 調合の窓
    const opened = await state();
    assert.equal(opened.mode, "mix");
    await page.waitForTimeout(900);
    assert.equal((await state()).t, opened.t, "調合の間は止まる");
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
    // キーボードだけで一台を出す: 窓を開く→定番を選ぶ（ボウルに入り、決定へ移る）→決定
    await page.keyboard.press("Enter");
    assert.equal((await state()).mode, "mix");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "tonari-floor-mix-preset-0");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "tonari-floor-mix-confirm");
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => { const x = C.view.floorTest.api.state().tables[0]; return [x.phase, x.preset, C.view.floorTest.api.mode()]; }), ["prep", true, "live"]);
    // フィーバーの突入: 帯が出ている間は時間が止まり、明けると流れ出す
    await page.waitForFunction(() => C.view.floorTest.api.state().tables[0].phase === "enjoy", null, { timeout: 15000 });
    await page.evaluate(() => { C.view.floorTest.api.state().fever = 100; });
    await page.waitForFunction(() => !document.querySelector('[data-test="tonari-floor-bonus"]').disabled, null, { timeout: 5000 });
    await page.keyboard.press("f");
    const cut = await state();
    assert.equal(cut.mode, "cutin");
    await page.waitForTimeout(600);
    assert.equal((await state()).t, cut.t, "突入の帯の間は止まる");
    await page.waitForFunction(() => C.view.floorTest.api.mode() === "live", null, { timeout: 5000 });
    await page.waitForFunction((t) => C.view.floorTest.api.state().t > t, cut.t, { timeout: 5000 });
    assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "on");
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
