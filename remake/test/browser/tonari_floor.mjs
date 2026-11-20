// tonari フロア営業（ワンオペ・ミックスを一覧から選ぶ形）: 勤務札→導入→営業→締め→日当の流れ、実画面の操作（PC／横持ちタッチ）、時計の停止、LOAD の境界。
// 客は気分（フルーティ／スイート／リフレッシュ／リラックス）を言うだけ。注文待ちの卓を押すと「接客ビュー」（店内がその卓へ寄り、左にミックスの列・下に客のドック）。
// 右にミックスの一覧（ひと押しでも出せる・シャッフルできる）。ミックスの札には属性の印（メインが大きく、サブが小さい）。
// 炭の調整（頼まれる前に）と会計は卓を押すだけ。頼み（ケア）は接客ビューで5つの手から選ぶ。卓の札は、押すと進む用件の時だけ見出しを出す。
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
    // skip 以外の卓を、ボットと同じ判断で片付ける（注文は並んでいる中でいちばん合う一台、炭は自分から整え、頼みは正しい手、会計はすぐ）
    C.others = (skip = []) => {
      const a = C.view.floorTest.api;
      for (let i = 0; i < 12; i++) {
        const s = a.state();
        const table = s.tables.find((x) => !skip.includes(x.id) && ["order", "care", "bill", "tend"].includes(C.model.floorTap(s, x.id)));
        if (!table) return;
        const kind = C.model.floorTap(s, table.id), guest = s.guests[table.guestId];
        if (kind === "order") a.act({ type: "order", tableId: table.id, mix: C.bot.bestMix(s, guest.order).id });
        else if (kind === "care") a.act({ type: "care", tableId: table.id, verb: C.floorData.CALLS[table.call.type].verb });
        else a.act({ type: kind, tableId: table.id });
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
  const MARK = { best: "◎", good: "○", none: "×" };

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
    assert.match(await page.locator(t("intro")).innerText(), /はじめてのワンオペ/);
    assert.deepEqual(await page.locator(`${t("intro-wishes")} .tf-wish`).evaluateAll((list) => list.map((n) => [n.dataset.wish, n.textContent.trim(), !!n.querySelector("svg")])),
      [["fruit", "フルーティ", true], ["sweet", "スイート", true], ["fresh", "リフレッシュ", true], ["deep", "リラックス", true]], "気分（＝属性）の色と印の見本");
    assert.equal(await page.locator(".tf-how li").count(), 4, "はじめての営業は、進め方を出す");
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
    assert(after.result.counts.tend >= 1, "炭の調整に回っている");
    assert.deepEqual(after.floor, { nights: 1, best: "S", fans: after.result.fans });
    assert(after.floor.fans > 0);
    assert.equal(after.visited, 4);
    assert.equal(after.baitoCount, 2);
    assert.deepEqual(after.order, [], "ワンオペの営業は「今日の注文」を済んだことにしない");
    assert(classic.pay >= 8000);
    assert.equal(after.money - before.money, classic.pay + 1500, "いつものシフトの日当＋売上ボーナス");
    assert.equal(after.stamina, classic.stamina, "体力の消費はいつものシフトと同じ");
    assert(after.toasts.some((text) => /フロアの売上ボーナス（大入り）\+1,500円/.test(text)), after.toasts.join(" / "));
    const saved = await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem(C.core.SAVE_KEY)); return { money: raw.money, floor: raw.flags._tonari_floor }; });
    assert.deepEqual(saved, { money: after.money, floor: after.floor });
  });

  // 二回目以降: 勤務札に予報と最高評価が出る。昼のシフトは昼の呼び名と時計。前の形の保存（定番つき）もそのまま読める。
  await run("pc-forecast", async (page) => {
    await setup(page, { slot: 0 });
    await page.evaluate(() => {
      const s = C.fresh(4, 0);
      s.flags._tonari_floor = { nights: 2, best: "A", presets: [["lemon", "mint"]], fans: 7 };
      C.core.save(); C.core.load(); C.ch1.resumeGame().catch((e) => { window.calendarError = e.stack; });
    });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.waitForFunction(() => /今日の予報：/.test(document.querySelector('[data-test="tonari-baito-floor"]')?.innerText || ""));
    assert.match(await page.locator('[data-test="tonari-baito-floor"]').innerText(), /これまでの最高：上々/);
    await page.locator('[data-test="tonari-baito-floor"]').click();
    await page.locator(t("intro")).waitFor();
    assert.deepEqual(await page.evaluate(() => C.trace.filter((id) => /floor/.test(id))), ["tonari_floor_start"]);
    assert.match(await page.locator(t("intro")).innerText(), /店のファン 7人/);
    assert.equal(await page.locator(".tf-how li").count(), 0);
    await page.locator(t("option-start")).click();
    const live = await page.evaluate(() => { const s = C.view.floorTest.api.state(); return { daytime: s.daytime, clock: C.model.floorClock(s), level: s.level }; });
    assert.deepEqual(live, { daytime: true, clock: "12:00", level: 2 });
    assert.equal(await page.locator(t("screen")).getAttribute("data-night"), "false");
    assert.equal(await page.locator(".tf-preset").count(), 5, "右の列に、ミックスが5つ並ぶ");
    await page.evaluate(() => C.drive({ pace: 3 }));
    await page.waitForFunction(() => C.core.state.slot >= 1 && !document.querySelector('[data-test="tonari-floor-screen"]:not(.done)'), null, { timeout: 60000 });
    const done = await page.evaluate(() => ({ floor: C.core.state.flags._tonari_floor, result: C.result, error: window.calendarError }));
    assert.equal(done.error, undefined);
    assert.deepEqual(done.floor, { nights: 3, best: done.result.rank === "S" ? "S" : "A", fans: Math.max(0, 7 + done.result.fans) });
    assert.equal(done.result.served + done.result.left, done.result.came);
    assert(done.result.served >= 1);
  });

  // 実画面の操作: 来店（気分の吹き出し）→ミックスを選ぶ（列・シャッフル・右の一覧のひと押し）→仕込み→提供→炭の調整→頼み→会計→フィーバー、休止・速さ・早じまい・精算。
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
      const hand = (wish) => api((a, wish) => C.model.floorHand(a.state(), wish), wish);
      const wishLabel = (id) => page.evaluate((id) => C.floorData.WISHES.find((w) => w.id === id).label, id);
      await page.locator(t("option-start")).click();
      assert.equal(await api((a) => a.mode()), "live");
      // 空席の卓は、札を出さない（番号札だけ）。出す先が無い間は、右の列に卓の番号を出さない
      assert.equal(await spot(1).locator(".tf-bubble").isVisible(), false);
      assert.equal(await spot(1).locator(".tf-plate").innerText(), "1");
      assert.match(await page.locator(t("dock")).innerText(), /1卓\s*空席/);
      assert.equal(await page.locator(t("target")).isVisible(), false);
      // 文字の代わりに印: 上の帯の見出し（仕込み中・残り時間・店の売上）は印だけで、言葉は読み上げに残す
      assert.deepEqual(await page.locator(".tf-top small").evaluateAll((list) => list.map((n) => [n.textContent.trim(), !!n.querySelector("svg"), getComputedStyle(n.querySelector(".tf-sr")).position])),
        [["仕込み中", true, "absolute"], ["残り時間", true, "absolute"], ["店の売上", true, "absolute"]]);
      // 来店: 客は自分で座り、気分を吹き出しで言う（フレーバーの名指しはしない）
      await tick(4);
      const g1 = await api((a) => a.state().guests[a.state().tables[0].guestId]);
      const label1 = await wishLabel(g1.order.wish);
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      assert.equal(await lastLog(), `1卓　${g1.name}「${g1.order.quote}」`);
      assert.equal(await spot(1).locator('.tf-pop[data-kind="say"]').innerText(), g1.order.quote);
      // 卓の札: 用件・客の気分（帯。色と印と名前）・卓番号・残り秒（注文は9秒から）
      assert.equal(await tagText(1), `注文 ${label1} 1 9`);
      assert.equal(await spot(1).getAttribute("data-tone"), "act");
      assert.equal(await spot(1).getAttribute("data-wish"), g1.order.wish);
      assert.deepEqual(await spot(1).locator(".tf-tag-req .tf-wish").evaluate((n) => [n.dataset.wish, !!n.querySelector("svg")]), [g1.order.wish, true]);
      assert.equal(await spot(2).locator(".tf-bubble").isVisible(), false);
      // 右の列: 並んでいるミックス。札の左に属性の印（メインが大きく、サブが小さい）。注文待ちの卓の客に合う札（◎・○）には、右上に判が付く
      const first = await hand(g1.order.wish);
      assert.equal(first.length, 5);
      assert.deepEqual([await page.locator(t("target")).innerText(), await page.locator(t("presets")).getAttribute("data-wish")], ["1", g1.order.wish]);
      assert.deepEqual(await page.locator(".tf-preset").evaluateAll((list) => list.map((n) => [n.dataset.mix, n.dataset.rating, n.querySelector(".tf-match")?.textContent || "",
        n.querySelector(".tf-attr").dataset.main, n.querySelector(".tf-attr").dataset.sub, n.querySelectorAll(".tf-attr svg").length])),
        first.map((m) => [m.id, m.rating, m.rating === "none" ? "" : MARK[m.rating], m.main, m.sub || "", m.sub ? 2 : 1]));
      // 属性の印: メインはサブより大きく、色はその気分の色
      const badge = await page.locator(".tf-preset .tf-attr").first().evaluate((n) => { const main = n.querySelector(".tf-attr-main").getBoundingClientRect(), sub = n.querySelector(".tf-attr-sub")?.getBoundingClientRect();
        return { main: main.width, sub: sub?.width ?? 0, color: getComputedStyle(n.querySelector(".tf-attr-main")).backgroundColor }; });
      const wishColor = await page.evaluate((id) => { const probe = Object.assign(document.createElement("i"), { style: `color:${C.floorData.WISHES.find((w) => w.id === id).color}` }); document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; }, first[0].main);
      assert(badge.main >= 16 && badge.sub < badge.main * 0.7, JSON.stringify(badge));
      assert.equal(badge.color, wishColor);
      // シャッフルは、金のボタン（印と名前）
      assert.deepEqual(await page.locator(t("shuffle-side")).evaluate((n) => [n.querySelector(":scope > span:not(.tf-icon)").textContent, n.querySelector(".tf-shuffle-cost").textContent.trim(), !!n.querySelector("svg"), getComputedStyle(n).backgroundImage.includes("gradient")]),
        ["シャッフル", "4秒", true, true]);
      assert.equal(await spot(1).getAttribute("data-target"), "true");
      assert.equal(await page.locator(t("screen")).getAttribute("data-ordering"), "true");
      // 画面の外へはみ出さない・押せる大きさ（実画素で40px以上）
      const boxes = await page.evaluate(() => {
        const stage = document.getElementById("stage").getBoundingClientRect();
        return [...document.querySelectorAll(".tf-seat, .tf-bonus, .tf-pause-button, .tf-ticker, .tf-dock, .tf-clock, .tf-making, .tf-sales, .tf-presets, .tf-preset, .tf-shuffle")].map((n) => {
          const r = n.getBoundingClientRect();
          return { cls: n.className, w: r.width, h: r.height, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
        });
      });
      for (const box of boxes) {
        assert(box.inside, `${box.cls} が舞台の外`);
        if (/tf-(seat|bonus|pause-button|ticker|preset|shuffle)$/.test(box.cls)) assert(Math.min(box.w, box.h) >= 40, `${box.cls} が小さい: ${box.w}x${box.h}`);
      }
      assert.equal(await page.evaluate(() => document.querySelector(".tonari-floor").scrollLeft), 0);
      // 上の帯は左から「仕込み中の一台・残り時間・売上」、下の帯は「卓のドック・出来事の行・フィーバー」。ミックスの列は右
      const bands = await page.evaluate(() => {
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const x = (sel) => { const r = rect(sel); return (r.left + r.right) / 2; };
        const stage = rect("#stage"), side = rect(".tf-presets"), top = rect(".tf-top"), bottom = rect(".tf-bottom");
        // 空席の卓は札を出さないので、押し所だけを見る
        const tags = [...document.querySelectorAll(".tf-spot")].map((n) => { const s = n.querySelector(".tf-seat").getBoundingClientRect(), box = n.querySelector(".tf-tag-box");
          const r = box.getClientRects().length ? box.getBoundingClientRect() : s;
          return { left: Math.min(r.left, s.left), right: Math.max(r.right, s.right), top: Math.min(r.top, s.top), bottom: Math.max(r.bottom, s.bottom) }; });
        return { top: [x(".tf-making"), x(".tf-clock"), x(".tf-sales")], bottom: [x(".tf-dock"), x(".tf-ticker"), x(".tf-bonus")], center: (stage.left + stage.right) / 2,
          side: { left: side.left, top: side.top, bottom: side.bottom }, sideRight: side.left > (stage.left + stage.right) / 2, hud: top.bottom, foot: bottom.top, tags };
      });
      assert(bands.top[0] < bands.top[1] && bands.top[1] < bands.top[2] && Math.abs(bands.top[1] - bands.center) < 4, "残り時間は上のまん中");
      assert(bands.bottom[0] < bands.bottom[1] && bands.bottom[1] < bands.bottom[2], "下の帯の並び");
      assert(bands.sideRight && bands.side.top >= bands.hud - 2 && bands.side.bottom <= bands.foot + 2, "ミックスの列は右。上下の帯に被らない");
      for (const [i, tag] of bands.tags.entries()) {
        assert(tag.right <= bands.side.left + 2, `${i + 1}卓の札・押し所がミックスの列に被る: ${tag.right} > ${bands.side.left}`);
        assert(tag.top >= bands.hud - 2 && tag.bottom <= bands.foot + 2, `${i + 1}卓の札が帯に被る`);
      }
      // 選んだ卓の様子が、下のドックに出る（注文を聞くまで、ご利用は0円）
      assert.match(await page.locator(t("dock")).innerText(), new RegExp(`1卓\\s*${g1.name}\\s*${label1}`));
      assert.equal(await page.locator(t("dock-bill")).innerText(), "0円");
      if (platform === "pc") {
        await table(2).hover();
        assert.match(await page.locator(t("dock")).innerText(), /2卓\s*空席/);
        await table(1).hover();
        assert.match(await page.locator(t("dock")).innerText(), /1卓/);
      }
      // 注文待ちの卓を押すと、店内がその卓へ寄り、左にミックスの列が出る。開いている間は時間が止まる
      await table(1).click();
      await page.locator(t("sheet")).waitFor();
      assert.equal(await api((a) => a.mode()), "panel");
      assert.equal(await page.locator(t("sheet")).getAttribute("data-kind"), "order");
      assert.equal(await page.locator(".tf-sheet-quote").innerText(), `「${g1.order.quote}」`);
      assert.equal((await page.locator(".tf-sheet-kind").innerText()).trim(), label1);
      assert.deepEqual(await page.locator(".tf-mix-option").evaluateAll((list) => list.map((n) => [n.dataset.mix, n.querySelector("b").textContent, n.querySelector(".tf-rate").textContent, n.querySelector(".tf-attr").dataset.main])),
        first.map((m) => [m.id, m.name, MARK[m.rating], m.main]), "並んでいるミックス（属性の印つき）と、客の気分との合い方");
      assert.equal(await page.locator(".tf-sheet small:not(.tf-shuffle-cost)").count(), 0, "説明の文は置かない（印と色で読む。シャッフルの秒数だけ出す）");
      const view = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height }; };
        return { cam: document.querySelector(".tf-cam").style.transform, seat: rect('.tf-spot[data-id="1"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"),
          foot: rect(".tf-sheet-foot"), row: rect(".tf-list .tf-option").h, hidden: getComputedStyle(document.querySelector(".tf-ticker")).display,
          side: getComputedStyle(document.querySelector(".tf-presets")).opacity,
          small: [...document.querySelectorAll(".tf-mix-option, .tf-sheet-foot .tf-shuffle")].filter((n) => { const r = n.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; }).length };
      });
      assert.match(view.cam, /scale\(1\.3\)/);
      assert(view.seat.left >= view.sheet.right - 2, `選んだ卓が左の列に隠れる: ${view.seat.left} < ${view.sheet.right}`);
      assert(view.seat.bottom <= view.dock.top + 2, "選んだ卓が下のドックに隠れる");
      assert(view.foot.bottom <= view.dock.top + 2, `ミックスの列がドックに被る: ${view.foot.bottom} > ${view.dock.top}`);
      assert(view.row >= 40, `行が小さい: ${view.row}`);
      assert.equal(view.small, 0, "ミックスの札とシャッフルは押せる大きさ");
      assert.equal(view.hidden, "none", "接客ビューでは、出来事の行を引っ込める");
      assert.equal(view.side, "0", "接客ビューでは、右の列を引っ込める");
      const t0 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t0, "ミックスを選ぶ間は進まない");
      await page.locator(t("sheet-later")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await api((a) => a.state().tables[0].phase), "order", "「あとで」で閉じても、注文は残る");
      // シャッフル: 並んでいるミックスを全部入れ替える。入れ替えには4秒かかり、その間はミックスを出せない（列は閉じて、店へ戻る）
      await table(1).click();
      assert.deepEqual(await page.locator(t("shuffle")).evaluate((n) => [n.querySelector(":scope > span:not(.tf-icon)").textContent, n.querySelector(".tf-shuffle-cost").textContent.trim(), n.getAttribute("aria-label")]),
        ["シャッフル", "4秒", "シャッフル（4秒かかる）"], "かかる秒数が、ボタンに出ている");
      const waitBefore = await api((a) => C.model.floorWaitLeft(a.state(), 1));
      await page.locator(t("shuffle")).click();
      assert.equal(await api((a) => a.mode()), "live", "入れ替えには時間がかかるので、列は閉じる");
      assert.deepEqual(await api((a) => [a.state().shuffles, C.model.floorShuffleLeft(a.state())]), [1, 8]);
      assert.equal(await page.locator(t("presets")).getAttribute("data-busy"), "true");
      assert.equal(await page.locator(t("shuffle-busy")).isVisible(), true);
      assert.match(await page.locator(t("shuffle-busy")).innerText(), /入れ替え中/);
      assert.equal(await page.locator(".tf-preset-list").evaluate((n) => getComputedStyle(n).visibility), "hidden", "入れ替えの最中は、ミックスを見せない");
      assert.equal(await page.locator(t("shuffle-side")).isDisabled(), true);
      assert.equal(await lastLog(), "ミックスを入れ替える（4秒かかる）");
      // その間は、注文待ちの卓を押しても列は開かない（客は待っている）
      await table(1).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await spot(1).locator(".tf-pop").last().innerText(), "入れ替え中…");
      await tick(8);
      assert.equal(await page.locator(t("presets")).getAttribute("data-busy"), "false");
      assert.equal(await lastLog(), "新しいミックスが並んだ");
      assert.equal(await api((a) => C.model.floorWaitLeft(a.state(), 1)), waitBefore - 8, "入れ替えの間も、客の待ち時間は減る");
      const second = await hand(g1.order.wish);
      assert(second.every((m) => !first.some((x) => x.id === m.id)), "並んでいた物は出てこない");
      await table(1).click();
      assert.deepEqual(await page.locator(".tf-mix-option").evaluateAll((list) => list.map((n) => n.dataset.mix)), second.map((m) => m.id));
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-order.png` }).catch(() => {});
      // いちばん合う一台を選ぶ → 仕込みが始まり、出した所へ次のミックスが入る
      const pick = await api((a) => C.bot.bestMix(a.state(), a.state().guests[a.state().tables[0].guestId].order));
      await page.locator(`.tf-mix-option[data-mix="${pick.id}"]`).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.deepEqual(await api((a) => { const x = a.state().tables[0]; return [x.phase, x.mix]; }), ["prep", pick.id]);
      assert.equal(await api((a, id) => a.state().hand.includes(id), pick.id), false);
      assert.match(await page.locator(t("making")).innerText(), new RegExp(`1\\s*${pick.name}`));
      assert.equal(await page.locator(`${t("making")} .tf-making-row .tf-attr`).getAttribute("data-main"), pick.main);
      // 出したあとの札は、卓番号と残り秒だけ（見出しと帯は畳む）
      assert.match(await tagText(1), /^1 \d+$/);
      assert.deepEqual([await spot(1).getAttribute("data-head"), await spot(1).locator(".tf-tag-want").isVisible(), await spot(1).locator(".tf-tag-req").isVisible()], ["false", false, false]);
      assert.equal(await spot(1).getAttribute("data-gauge"), "make");
      assert.equal(await lastLog(), `1卓　${pick.name}を仕込みはじめた`);
      // 右の列のひと押し: いちばん急ぎの注文待ちの卓へ、そのまま出る
      await tick(5);
      assert.equal(await api((a) => a.state().tables[1].phase), "order");
      assert.equal(await page.locator(t("target")).innerText(), "2");
      const quick = await api((a) => C.bot.bestMix(a.state(), a.state().guests[a.state().tables[1].guestId].order));
      assert.equal(await page.locator(`.tf-preset[data-mix="${quick.id}"]`).getAttribute("data-rating"), quick.rating);
      await page.locator(`.tf-preset[data-mix="${quick.id}"]`).click({ force: true });
      assert.deepEqual(await api((a) => { const x = a.state().tables[1]; return [x.phase, x.mix]; }), ["prep", quick.id]);
      assert.equal(await lastLog(), `2卓　${quick.name}を仕込みはじめた`);
      // 同時に仕込めるのは2台まで。三台目は順番を待つ
      await tick(5);
      await page.evaluate(() => C.others([1, 2]));
      assert.equal(await api((a) => a.state().tables[2].make.active), false);
      assert.deepEqual([await tagText(3), await spot(3).getAttribute("data-queued")], ["3", "true"], "順番待ちの札は、卓番号と時計の印だけ");
      assert.match(await page.locator(".tf-making-more").innerText(), /待ち 1台/);
      assert.equal(await page.locator(".tf-making-row:not(.empty)").count(), 2);
      // 出来上がると、自動で卓へ運ばれる。初回のドリンクとチャージは伝票に入る。満足の顔は ◎○△ の形の中の顔
      await until("s.tables[0].phase === 'enjoy'", [1]);
      const served = await api((a) => { const x = a.state().tables[0]; return { mood: C.model.floorStage(x.mood).id, rating: x.rating }; });
      assert.equal(served.rating, pick.rating);
      // くつろいでいる卓の札は、卓番号と満足の顔だけ（文字を出さない）
      assert.equal(await tagText(1), "1");
      assert.deepEqual([await spot(1).getAttribute("data-tone"), await spot(1).getAttribute("data-head")], ["fine", "false"]);
      assert.equal(await spot(1).getAttribute("data-smoke"), "true");
      assert.equal(await spot(1).getAttribute("data-gauge"), "coal");
      assert.equal(await spot(1).getAttribute("data-mood"), served.mood);
      assert.equal(await spot(1).locator(".tf-tag-face svg circle").count(), { max: 2, good: 1 }[served.mood] ?? 0, "大満足＝◎（二重丸）・満足＝○・普通＝△");
      // 卓の札は大きめ（顔の窓・満足の顔が、実画素で読める大きさ）
      const tagSize = await spot(1).evaluate((n) => { const cell = n.querySelector(".tf-tag-cell").getBoundingClientRect(), face = n.querySelector(".tf-tag-face .tf-icon").getBoundingClientRect(), k = document.getElementById("stage").getBoundingClientRect().width / 1280;
        return { cell: cell.width / k, face: face.width / k }; });
      assert(tagSize.cell >= 80 && tagSize.face >= 50, JSON.stringify(tagSize));
      // 不満の顔は△（逆三角にしない）。激怒は、形に入れない怒りの印で、札の右上にも怒りの印が出る
      await api((a) => { a.state().tables[0].mood = 30; a.tick(1); });
      const lowFace = await spot(1).locator(".tf-tag-face svg path").first().getAttribute("d");
      assert.match(lowFace, /^M12 3\.2/, "三角の頂点が上");
      assert.equal(await spot(1).locator(".tf-tag-anger").isVisible(), false);
      await api((a) => { a.state().tables[0].mood = 10; a.tick(1); });
      assert.deepEqual([await spot(1).getAttribute("data-mood"), await spot(1).locator(".tf-tag-anger").isVisible()], ["mad", true]);
      await api((a) => { a.state().tables[0].mood = 90; a.tick(1); });
      assert.equal(await spot(1).locator(".tf-tag-pie").evaluate((n) => getComputedStyle(n).opacity), "1");
      await page.evaluate(() => document.querySelector('[data-test="tonari-floor-table-1"]').dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" })));
      assert.equal(await page.locator(t("dock-bill")).innerText(), "3,300円", "チャージ700円＋基本2,000円＋初回ドリンク600円");
      // 炭の調整: 炭の残りが少なくなったら、頼まれる前に自分から行く（卓を押すだけ）。まだ残っているうちは変わらない
      await api((a) => { const x = a.state().tables[0]; x.wants = []; x.mood = 70; });
      await table(1).click();
      assert.equal(await spot(1).locator(".tf-pop").last().innerText(), "炭はまだ大丈夫");
      assert.equal(await api((a) => a.state().counts.tend), 0);
      await until("C.model.floorTendDue(s, 1)", [1]);
      assert.match(await tagText(1), /^炭の調整 /);
      assert.equal(await spot(1).getAttribute("data-tone"), "tend");
      assert.equal(await spot(1).getAttribute("data-tap"), "tend");
      assert.equal(await api((a) => a.state().tables[0].call), null, "客は、まだ何も言っていない");
      const moodBefore = await api((a) => a.state().tables[0].mood);
      const tendBefore = await api((a) => a.state().counts.tend); // ほかの卓も、待つ間に整えている
      await table(1).click();
      assert.equal(await api((a) => a.mode()), "live", "調整は、卓を押すだけ");
      assert.deepEqual(await api((a) => { const s = a.state(); return [s.counts.tend, C.model.floorCoalLeft(s, 1), C.model.floorTap(s, 1)]; }), [tendBefore + 1, 1, "info"]);
      assert(await api((a) => a.state().tables[0].mood) > moodBefore + 5);
      assert.equal(await lastLog(), "1卓　炭を整えた");
      // 行かないでいると、客のほうから頼まれる（煙が薄い／熱を下げてほしい）。5つの手は固定の並び
      await api((a) => { const x = a.state().tables[0]; x.stayEnd = a.state().t + 120; x.mood = 70; });
      await until("!!s.tables[0].call", [1]);
      const call = await api((a) => a.state().tables[0].call);
      assert(["thin", "harsh"].includes(call.type) && call.coal);
      const mood = await api((a) => a.state().tables[0].mood);
      assert.match(await tagText(1), /^\S+ 1 \d+$/, "頼みの札には、用件と、消えるまでの残り秒が出る");
      assert.equal(await spot(1).getAttribute("data-tone"), "act");
      await table(1).click();
      await page.locator(t("sheet")).waitFor();
      assert.equal(await page.locator(t("sheet")).getAttribute("data-kind"), "care");
      assert.equal(await page.locator(".tf-sheet-kind").innerText(), "炭の調整");
      assert.deepEqual(await page.locator(".tf-sheet .tf-option b").allInnerTexts().then((list) => list.map((s) => s.replace(/\s/g, ""))),
        ["炭を替える", "炭を下ろす", "お水を出す", "吸い方を案内する", "雑談する"]);
      const t1 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t1, "頼みに応える間は進まない");
      // 選んだあと、判定の印（◎）が出る。印が出ている間も時間は止まり、もう一度押すと先へ進む
      const verb = await page.evaluate((type) => C.floorData.CALLS[type].verb, call.type);
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
      assert.equal(await api((a) => C.model.floorCoalLeft(a.state(), 1)), 1, "正しく応えれば、炭も整う");
      assert.equal(await page.locator(".tf-cam").evaluate((n) => n.style.transform), "", "列を閉じると、店内は元の引きに戻る");
      // 会計はひと押し。見送りの言葉は出来事の行に出る
      await api((a) => { const x = a.state().tables[0]; x.stayEnd = a.state().t + 2; x.extended = true; x.wants = []; });
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
      const fever = await api((a) => { const s = a.state(); return { level: s.feverLevel, tables: s.tables.filter((x) => x.fever).map((x) => [x.id, x.mood]), fevers: s.fevers }; });
      assert.deepEqual([fever.level, fever.fevers, fever.tables.length], [1, 1, 2], "Lv1 は2卓まで");
      assert(fever.tables.every(([, m]) => m === 100));
      assert.equal(await spot(fever.tables[0][0]).getAttribute("data-tone"), "fever");
      assert.equal(await page.locator(t("bonus")).isDisabled(), true, "フィーバー中は重ねて使えない");
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-fever.png` }).catch(() => {});
      // 休止→ゆっくり→つづける→早じまい→精算
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
      // 精算: 売上の内訳（項目ごと）と合計。内訳の合計は、店の売上と一致する（原価・利益は出さない）
      const slip = await page.evaluate(() => {
        const yen = (text) => Number(text.replace(/[^0-9]/g, ""));
        const rows = [...document.querySelectorAll(".tf-slip-items div")].map((n) => [n.querySelector("dt").textContent, n.querySelector("dd").textContent]);
        const card = document.querySelector(".tf-slip").getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
        return { names: rows.map((r) => r[0].replace(/（\d+杯）/, "")), sum: rows.slice(1, 5).reduce((total, r) => total + yen(r[1]), 0),
          total: yen(document.querySelector('[data-test="tonari-floor-final-sales"]').textContent), text: document.querySelector(".tf-slip").textContent,
          fans: document.querySelector('[data-test="tonari-floor-fans"]').textContent, mixes: document.querySelectorAll(".tf-slip-mixes li").length,
          inside: card.top >= stage.top - 1 && card.bottom <= stage.bottom + 1 };
      });
      assert.deepEqual(slip.names, ["お迎えした組", "チャージ", "シーシャ", "ドリンク", "トップ替え（おかわり）"]);
      assert.equal(slip.sum, slip.total);
      assert.doesNotMatch(slip.text, /原価|利益|サービス費|延長|定番/);
      assert.match(slip.text, /いい調整 \d+回・いいケア \d+回・追加ドリンク \d+杯・おかわり \d+組・フィーバー 1回/);
      assert.match(slip.fans, /^店のファン [＋−]\d+人（合計 \d+人）$/);
      assert(slip.mixes >= 1 && slip.inside, "精算の札が舞台に収まる");
      await page.screenshot({ path: `${shots}/tonari-floor-${platform}-result.png` }).catch(() => {});
      await page.locator(t("option-continue")).click();
      await page.waitForFunction(() => window.result !== undefined);
      const result = await page.evaluate(() => window.result);
      assert.equal(result.closing, "early");
      const mine = result.groups.find((g) => g.tableId === 1);
      assert.equal(mine.stage, "max");
      assert.equal(mine.mix, pick.id);
      assert.equal(mine.total, bill.total);
      assert.deepEqual([result.fevers, result.shuffles >= 1, result.counts.tend >= 1], [1, true, true]);
      assert.deepEqual(["cost", "service", "profit", "presets"].filter((key) => key in result), []);
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
      // 奥の卓の札は、席の上に出て、上の帯にも右のミックスの列にも隠れない
      await api((a) => a.tick(4));
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      const back = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        return { tag: rect('.tf-spot[data-id="1"] .tf-bubble'), seat: rect('.tf-spot[data-id="1"] .tf-seat'), hud: rect(".tf-top"), side: rect(".tf-presets"),
          right: rect('.tf-spot[data-id="3"] .tf-seat'), rightSide: rect('.tf-spot[data-id="5"] .tf-seat') };
      });
      assert(back.tag.bottom <= back.seat.top + 2, "奥の席の札は席の上");
      assert(back.tag.top >= back.hud.bottom - 2, `奥の卓の札が上の帯に被る: ${back.tag.top} < ${back.hud.bottom}`);
      assert(back.right.right <= back.side.left + 2 && back.rightSide.right <= back.side.left + 2, "右の席がミックスの列に被る");
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
      assert(geo.seat.h >= 40 && geo.seat.w >= 40, `席は押せる大きさ: ${geo.seat.w}x${geo.seat.h}`);
      // 席の形: 上の3席はこちら向き、下の2席は内向き
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tf-spot")].map((n) => `${n.dataset.row}:${n.dataset.flip}`)),
        ["back:false", "back:false", "back:false", "side:false", "side:true"]);
      const rows = await page.evaluate(() => [...document.querySelectorAll(".tf-spot .tf-seat")].map((n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      assert(rows[0].x < rows[1].x && rows[1].x < rows[2].x && Math.abs(rows[0].y - rows[2].y) < 2, "上の段に3席");
      assert(rows[3].x < rows[0].x && rows[4].x > rows[2].x && rows[3].y > rows[0].y && Math.abs(rows[3].y - rows[4].y) < 2, "下の段は左右の端に2席");
      // 卓の札からも同じ卓のミックスの列が開く。手前の席も、列と下のドックに隠れない所へ寄る
      await page.locator('.tf-spot[data-id="4"] .tf-bubble').click({ force: true });
      await page.locator(t("sheet")).waitFor();
      const zoom = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        return { seat: rect('.tf-spot[data-id="4"] .tf-seat'), sheet: rect(".tf-sheet"), dock: rect(".tf-dock"), top: rect(".tf-top") };
      });
      assert(zoom.seat.left >= zoom.sheet.right - 2 && zoom.seat.bottom <= zoom.dock.top + 2 && zoom.seat.top >= zoom.top.bottom - 2, JSON.stringify(zoom));
      assert.equal(await page.locator(".tf-mix-option").count(), 5);
      await page.locator(".tf-mix-option").first().click();
      assert.equal(await api((a) => a.state().tables[3].phase), "prep");
      await until("s.tables[3].phase === 'enjoy'", [4]);
      assert.equal(await page.locator('.tf-spot[data-id="4"]').getAttribute("data-served"), "true");
      assert.equal(await page.locator('.tf-spot[data-id="4"] .tf-prop img').count(), 1, "卓の上の一台が出る");
      // 大満足になると、登録があれば笑顔の絵に替わる
      await api((a) => { a.state().tables[3].mood = 50; a.tick(1); });
      const idle = await page.locator('.tf-spot[data-id="4"] .tf-who img').first().getAttribute("src");
      await api((a) => { a.state().tables[3].mood = 95; a.tick(1); });
      assert.notEqual(await page.locator('.tf-spot[data-id="4"] .tf-who img').first().getAttribute("src"), idle);
      await page.screenshot({ path: `${shots}/tonari-floor-${platform}-seated.png` }).catch(() => {});
    }, options);
  }

  // たまに遊びに来る本編の人物: 顔アイコンで出て、その人の気分と言葉で返す。精算に名前が残り、好感度は動かない。
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
    assert.deepEqual([guest.charId, guest.name, guest.order.wish], ["adam", "アダム", "fruit"]);
    const spot = page.locator('.tf-spot[data-id="3"]');
    assert.equal(await spot.getAttribute("data-rare"), "true");
    assert.match(await spot.locator(".tf-tag-who img").getAttribute("src"), /face_adam/);
    assert.equal((await spot.locator(".tf-bubble").innerText()).replace(/\s+/g, " ").trim(), "注文 フルーティ 3 9");
    assert.match(await page.locator(t("log")).innerText(), /アダムが遊びに来た！ 3卓へ/);
    await page.locator(t("table-3")).click();
    await page.locator(t("sheet")).waitFor();
    assert.equal(await page.locator(".tf-sheet-quote").innerText(), "「……はじめよ。今日は、果実の煙を頼む」");
    assert.match(await page.locator(".tf-dock-who img").getAttribute("src"), /face_adam/);
    await page.keyboard.press("Escape");
    // ぴったりの一台を出すと、その人の言葉で返ってくる
    await api((a) => { a.state().hand[0] = "peachmango"; a.act({ type: "order", tableId: 3, mix: "peachmango" }); });
    await page.evaluate(() => C.until("s.tables[2].phase === 'enjoy'", [3]));
    assert.deepEqual(await api((a) => { const x = a.state().tables[2]; return [x.grade, x.line]; }), ["best", "……よい。果実が、まっすぐ立っている"]);
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

  // 実時間: 営業中だけ時計が進み、ミックスを選ぶ間・休止・フィーバーの突入・別タブで止まる。キーボードだけでも回せる。
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
    await page.keyboard.press("Enter"); // ミックスの列
    const opened = await state();
    assert.equal(opened.mode, "panel");
    await page.waitForTimeout(900);
    assert.equal((await state()).t, opened.t, "ミックスを選ぶ間は止まる");
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
    // キーボードだけで一台を出す: 列を開く → 数字キーで選ぶ
    await page.keyboard.press("Enter");
    assert.equal((await state()).mode, "panel");
    const second = await page.evaluate(() => C.view.floorTest.api.state().hand[1]);
    await page.keyboard.press("2");
    assert.deepEqual(await page.evaluate(() => { const x = C.view.floorTest.api.state().tables[0]; return [x.phase, x.mix, C.view.floorTest.api.mode()]; }), ["prep", second, "live"]);
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
