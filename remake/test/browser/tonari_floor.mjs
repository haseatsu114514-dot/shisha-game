// tonari フロア営業（ワンオペ・ミックスを一覧から選ぶ形）: 勤務札→導入→営業→締め→日当の流れ、実画面の操作（PC／横持ちタッチ）、時計の停止、LOAD の境界。
// 客は気分（フルーティ／スイート／刺激系／リラックス）を言うだけ。注文待ち・頼みの卓を押すと「接客の画面」へ替わる（左に大きな選択肢、右に卓の様子。店内の札や帯は隠れる）。
// 右にミックスの一覧（ひと押しでも出せる・シャッフルは4秒かかる）。ミックスの札には属性の印（メインが大きく、サブが小さい）。
// 炭の調整（頼まれる前に）と会計は卓を押すだけ。卓の札は、押すと進む用件の時だけ見出しを出し、手応えの言葉は見出しの所に出す（UI の上に UI を重ねない）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const t = (key) => `[data-test="tonari-floor-${key}"]`;
// 画面を横切る帯（営業開始・フィーバー・営業終了）が消えるまで待つ。帯が出ている間は、卓の札と手応えの言葉を出さない
const afterBand = (page) => page.waitForFunction(() => document.querySelector(".tonari-floor")?.dataset.band !== "true", null, { timeout: 5000 });
const shots = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";

async function setup(page, { day = 4, slot = 1, manual = true } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ day, slot, manual }) => {
    window.C = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      data: await import("./js/core/data.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), tonari: await import("./js/daily/tonari.js"),
      view: await import("./js/daily/tonari-floor-view.js"), model: await import("./js/daily/tonari-floor-model.js"),
      floorData: await import("./js/daily/tonari-floor-data.js"), bot: await import("./test/tonari_floor_bot.mjs"), audio: await import("./js/core/audio.js") };
    C.ch1.setupHooks(); C.vn.vnTest.turbo = true;
    C.view.floorTest.manual = manual;
    C.data.DB.baito = []; // 接客の抽選報酬を除き、日当と売上ボーナスだけを比べる
    C.fresh = (d = day, sl = slot) => {
      const s = C.core.newGame();
      Object.assign(s, { phase: "daily", day: d, slot: sl, money: 30000, stamina: 100, weatherSeed: 4, baitoCount: 1 });
      Object.assign(s.flags, { _lime_tut: 1, _delivery_minto_done: true, _delivery_adam_done: true,
        _errand_scout_done: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true, _ev_ageha_cameo: true, _ev_salaryman: true });
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
    // 本編の「常連さんの話」を次のシフトで読む間（第1章 DAY2 以降・未読。#3819）も、いつものシフトだけ
    await page.evaluate(() => { C.core.state.baitoCount = 1; C.core.state.flags._ev_salaryman = false; });
    await page.locator('.map:not(.done) [data-spot="tonari"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="tonari-baito"]').waitFor();
    assert.equal(await page.locator('[data-test="tonari-baito-floor"]').count(), 0, "常連さんの話を読むシフトの前は、フロアを任されない");
    await page.locator('[data-test="sub-back"]').click();
    await page.evaluate(() => { C.core.state.flags._ev_salaryman = true; });
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
      [["fruit", "フルーティ", true], ["sweet", "スイート", true], ["fresh", "刺激系", true], ["deep", "リラックス", true]], "気分（＝属性）の色と印の見本");
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
    assert.deepEqual(after.floor, { nights: 1, best: "S", fans: after.result.fans, top: after.result.sales }, "回した回数・最高の評価・ファン・売上の最高が残る");
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
    assert.deepEqual(done.floor, { nights: 3, best: done.result.rank === "S" ? "S" : "A", fans: Math.max(0, 7 + done.result.fans), top: done.result.sales });
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
      // 卓の札の文字（手応えの言葉・客のひとことが出ている間は見出しが隠れるので、先に片付けてから読む）
      const tagText = (id) => page.evaluate((id) => { const tag = document.querySelector(`.tf-spot[data-id="${id}"] .tf-bubble`);
        tag.querySelectorAll(".tf-pop").forEach((n) => n.remove()); return tag.innerText.replace(/\s+/g, " ").trim(); }, id);
      const lastLog = () => page.locator(`${t("log")} p`).last().innerText();
      const hand = (wish) => api((a, wish) => C.model.floorHand(a.state(), wish), wish);
      const wishLabel = (id) => page.evaluate((id) => C.floorData.WISHES.find((w) => w.id === id).label, id);
      await page.locator(t("option-start")).click();
      assert.equal(await api((a) => a.mode()), "live");
      // 営業開始の帯が出ている間は、卓の札・番号札・手応えの言葉を出さない（帯の文字と重ねない）。右の列は、帯より手前にある
      assert.deepEqual(await page.evaluate(() => { const root = document.querySelector(".tonari-floor"), z = (sel) => Number(getComputedStyle(root.querySelector(sel)).zIndex);
        return [root.dataset.band, getComputedStyle(root.querySelector(".tf-spots")).opacity, root.querySelector(".tf-cutin").dataset.on, z(".tf-presets") > z(".tf-cutin"), z(".tf-layer") > z(".tf-presets")]; }),
        ["true", "0", "true", true, true]);
      await afterBand(page);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".tf-spots")).opacity), "1");
      // 空席の卓は、札を出さない（番号札だけ）。出す先が無い間は、右の列に卓の番号を出さない
      assert.equal(await spot(1).locator(".tf-bubble").isVisible(), false);
      assert.equal(await spot(1).locator(".tf-plate").innerText(), "1");
      // 選んでいる卓のドックは無い（卓の札と同じ情報のため。TFL49）
      assert.equal(await page.locator(".tf-dock").count(), 0);
      assert.equal(await page.locator(t("target")).isVisible(), false);
      // 文字の代わりに印: 上の帯の見出し（仕込み中・残り時間・店の売上）は印だけで、言葉は読み上げに残す
      assert.deepEqual(await page.locator(".tf-top small").evaluateAll((list) => list.map((n) => [n.textContent.trim(), !!n.querySelector("svg"), getComputedStyle(n.querySelector(".tf-sr")).position])),
        [["残り時間", true, "absolute"], ["店の売上", true, "absolute"]]);
      // 仕込み中は、器の印と枠の丸だけ。言葉は読み上げ（aria-label）に出す
      assert.deepEqual(await page.locator(t("making")).evaluate((n) => [n.textContent, !!n.querySelector("svg"), n.querySelectorAll(".tf-making-pips > i").length, n.getAttribute("aria-label")]), ["", true, 2, "仕込み中: なし"]);
      // 来店: 客は自分で座り、気分を吹き出しで言う（フレーバーの名指しはしない）
      await tick(4);
      const g1 = await api((a) => a.state().guests[a.state().tables[0].guestId]);
      const label1 = await wishLabel(g1.order.wish);
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      assert.equal(await lastLog(), `1卓　${g1.name}「${g1.order.quote}」`);
      assert.equal(await spot(1).locator('.tf-pop[data-kind="say"]').innerText(), g1.order.quote);
      // 客のひとことは、卓の札の見出しの所（箱のすぐ上）に出る。出ている間は見出しを隠すので、札の上に札が重ならない
      const sayAt = await spot(1).evaluate((n) => { const pop = n.querySelector(".tf-pop").getBoundingClientRect(), box = n.querySelector(".tf-tag-box").getBoundingClientRect();
        return { above: pop.bottom <= box.top + 1, head: getComputedStyle(n.querySelector(".tf-tag-want")).visibility, inTag: !!n.querySelector(".tf-bubble .tf-pop") }; });
      assert.deepEqual(sayAt, { above: true, head: "hidden", inTag: true });
      // 客が着いた卓は、床の番号札を畳む（番号は札の隅に出ている）。空席の卓の番号札は残る
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tf-spot")].map((n) => [n.dataset.phase === "empty", n.querySelector(".tf-plate").getClientRects().length > 0]).every(([empty, shown]) => empty === shown)), true);
      assert.equal(await spot(1).locator(".tf-plate").isVisible(), false);
      assert.equal(await spot(5).locator(".tf-plate").isVisible(), true);
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
      // ミックス名の下に、使ったフレーバーを必ず（）で出す（グラム数は出さない）。名前も材料も、札からはみ出さない
      // 1種の物（〜単）は、名前がそのまま中身なので（）は付けない
      const recipes = await page.locator(".tf-preset").evaluateAll((list) => list.map((n) => { const row = n.getBoundingClientRect(), name = n.querySelector(".tf-preset-name").getBoundingClientRect(), node = n.querySelector(".tf-recipe"), rec = (node || n.querySelector(".tf-preset-name")).getBoundingClientRect();
        return { text: node?.textContent ?? "", label: n.getAttribute("aria-label"), inside: name.top >= row.top - 0.5 && rec.bottom <= row.bottom + 0.5 && rec.right <= row.right + 0.5 && name.right <= row.right + 0.5 && (!node || name.bottom <= rec.top + 1) }; }));
      assert.deepEqual(recipes.map((r) => r.text), first.map((m) => (m.single ? "" : `（${m.recipe.join("・")}）`)));
      assert(recipes.every((r) => r.inside), `右の列の札から、名前か材料がはみ出す: ${JSON.stringify(recipes)}`);
      assert(recipes.every((r, i) => r.label.startsWith(first[i].full) && !/\d\s*g|グラム/.test(r.text)), JSON.stringify(recipes));
      // 属性の印: メインはサブより大きく、色はその気分の色
      const badge = await page.locator(".tf-preset .tf-attr").first().evaluate((n) => { const main = n.querySelector(".tf-attr-main").getBoundingClientRect(), sub = n.querySelector(".tf-attr-sub")?.getBoundingClientRect();
        return { main: main.width, sub: sub?.width ?? 0, color: getComputedStyle(n.querySelector(".tf-attr-main")).backgroundColor }; });
      const wishColor = await page.evaluate((id) => { const probe = Object.assign(document.createElement("i"), { style: `color:${C.floorData.WISHES.find((w) => w.id === id).color}` }); document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; }, first[0].main);
      assert(badge.main >= 16 && badge.sub < badge.main * 0.7, JSON.stringify(badge));
      assert.equal(badge.color, wishColor);
      // シャッフルは、金のボタン（印と名前）
      assert.deepEqual(await page.locator(t("shuffle-side")).evaluate((n) => [n.querySelector(".tf-shuffle-main > span:not(.tf-icon)").textContent, n.querySelector(".tf-shuffle-cost").textContent.trim(), !!n.querySelector("svg"), getComputedStyle(n).backgroundImage.includes("gradient")]),
        ["シャッフル", "4秒", true, true]);
      assert.equal(await spot(1).getAttribute("data-target"), "true");
      assert.equal(await page.locator(t("screen")).getAttribute("data-ordering"), "true");
      // 画面の外へはみ出さない・押せる大きさ（実画素で40px以上）
      const boxes = await page.evaluate(() => {
        const stage = document.getElementById("stage").getBoundingClientRect();
        return [...document.querySelectorAll(".tf-seat, .tf-bonus, .tf-pause-button, .tf-ticker, .tf-clock, .tf-making, .tf-sales, .tf-presets, .tf-preset, .tf-shuffle")].map((n) => {
          const r = n.getBoundingClientRect();
          return { cls: n.className, w: r.width, h: r.height, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
        });
      });
      for (const box of boxes) {
        assert(box.inside, `${box.cls} が舞台の外`);
        if (/tf-(seat|bonus|pause-button|ticker|preset|shuffle)$/.test(box.cls)) assert(Math.min(box.w, box.h) >= 40, `${box.cls} が小さい: ${box.w}x${box.h}`);
      }
      assert.equal(await page.evaluate(() => document.querySelector(".tonari-floor").scrollLeft), 0);
      // 上の帯は左から「仕込み中・残り時間・売上・休止」。触らない情報（仕込み中・残り時間・売上）は小さな札で、押す所（休止）だけ指の大きさ（TFL49）。
      // 残り時間と売上は、ひとまとめで画面のまん中（TFL50）
      // 下の帯は出来事の行だけ（店内のまん中の下）。右の列は上から「シャッフル・ミックスの一覧・フィーバー」で、画面の上の端から下の端まで
      const bands = await page.evaluate(() => {
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const x = (sel) => { const r = rect(sel); return (r.left + r.right) / 2; };
        const stage = rect("#stage"), side = rect(".tf-presets"), top = rect(".tf-top"), bottom = rect(".tf-bottom");
        // 空席の卓は札を出さないので、押し所だけを見る
        const tags = [...document.querySelectorAll(".tf-spot")].map((n) => { const s = n.querySelector(".tf-seat").getBoundingClientRect(), box = n.querySelector(".tf-tag-box");
          const r = box.getClientRects().length ? box.getBoundingClientRect() : s;
          return { left: Math.min(r.left, s.left), right: Math.max(r.right, s.right), top: Math.min(r.top, s.top), bottom: Math.max(r.bottom, s.bottom) }; });
        const y = (sel) => { const r = rect(sel); return [r.top, r.bottom]; };
        const inSide = (sel) => { const r = rect(sel); return r.left >= side.left - 1 && r.right <= side.right + 1 && r.top >= side.top - 1 && r.bottom <= side.bottom + 1; };
        const hudRects = [".tf-making", ".tf-clock", ".tf-sales", ".tf-pause-button", ".tf-ticker"].map((sel) => { const r = rect(sel); return { sel, left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height }; });
        return { top: [x(".tf-making"), x(".tf-clock"), x(".tf-sales")], mid: x(".tf-top-mid"), ticker: x(".tf-ticker"), roomCenter: (bottom.left + bottom.right) / 2, center: (stage.left + stage.right) / 2, hudRects, stageH: stage.height,
          side: { left: side.left, top: side.top, bottom: side.bottom }, sideRight: side.left > (stage.left + stage.right) / 2, hud: top.bottom, hudTop: top.top, foot: bottom.top, footRight: bottom.right, stageBottom: stage.bottom, tags,
          topRight: Math.max(rect(".tf-sales").right, rect(".tf-pause-button").right), salesPause: [rect(".tf-sales").right, rect(".tf-pause-button").left], clockSales: [rect(".tf-clock").right, rect(".tf-sales").left],
          column: [y(".tf-presets-head"), y(".tf-preset-box"), y(".tf-bonus")], inSide: [".tf-shuffle", ".tf-preset-box", ".tf-bonus"].map(inSide), bonusInSide: !!document.querySelector(".tf-presets .tf-bonus"), bonusInFoot: !!document.querySelector(".tf-bottom .tf-bonus"),
          overflow: document.querySelector(".tf-presets").scrollWidth - document.querySelector(".tf-presets").clientWidth };
      });
      assert(bands.top[0] < bands.top[1] && bands.top[1] < bands.top[2] && Math.abs(bands.mid - bands.center) < 4, `残り時間と売上は、画面の上のまん中: ${bands.mid} / ${bands.center}`);
      assert(Math.abs(bands.ticker - bands.roomCenter) < 4, "出来事の行は、店内の下のまん中");
      // 触らない情報の札は小さい（画面の高さの8%以下）。休止と出来事の行は、指で押せる大きさ（上で確かめた）
      for (const r of bands.hudRects.filter((r) => /making|clock|sales/.test(r.sel))) assert(r.h <= bands.stageH * 0.08 + 1, `${r.sel} が大きい: ${r.h}`);
      assert(bands.sideRight && Math.abs(bands.side.top - bands.hudTop) <= 2 && bands.side.bottom <= bands.stageBottom + 1 && bands.side.bottom >= bands.foot, "右の列は、画面の上の端から下の端まで");
      assert(bands.topRight <= bands.side.left - 2 && bands.salesPause[0] <= bands.salesPause[1] && bands.clockSales[0] <= bands.clockSales[1], `売上と休止は、残り時間と右の列のあいだに収まる: ${JSON.stringify([bands.clockSales, bands.salesPause, bands.topRight, bands.side.left])}`);
      assert(bands.footRight <= bands.side.left + 2, `下の帯が右の列に被る: ${bands.footRight} > ${bands.side.left}`);
      // フィーバーのボタンとゲージは、右の列のいちばん下（下の帯には置かない）
      assert.deepEqual([bands.bonusInSide, bands.bonusInFoot, bands.inSide, bands.overflow <= 1], [true, false, [true, true, true], true]);
      assert(bands.column[0][1] <= bands.column[1][0] + 1 && bands.column[1][1] <= bands.column[2][0] + 1, `右の列の3段が重なる: ${JSON.stringify(bands.column)}`);
      for (const [i, tag] of bands.tags.entries()) {
        assert(tag.right <= bands.side.left + 2, `${i + 1}卓の札・押し所が右の列に被る: ${tag.right} > ${bands.side.left}`);
        assert(tag.top >= bands.hud - 2, `${i + 1}卓の札が上の帯に被る`);
        for (const r of bands.hudRects) assert(!(tag.left < r.right - 1 && r.left < tag.right - 1 && tag.top < r.bottom - 1 && r.top < tag.bottom - 1), `${i + 1}卓の札が ${r.sel} に被る`);
      }
      // PC はマウスを載せた卓が選ばれる（キーボードで押す卓）
      if (platform === "pc") {
        await table(2).hover();
        assert.equal(await spot(2).getAttribute("data-selected"), "true");
        await table(1).hover();
        assert.equal(await spot(1).getAttribute("data-selected"), "true");
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
      // 名前の下に、使ったフレーバー（）。札の中に収まり、合い方の印に被らない
      const optionRecipes = await page.locator(".tf-mix-option").evaluateAll((list) => list.map((n) => { const row = n.getBoundingClientRect(), text = n.querySelector(".tf-mix-text").getBoundingClientRect(), node = n.querySelector(".tf-recipe"), rec = (node || n.querySelector(".tf-mix-text")).getBoundingClientRect(), rate = n.querySelector(".tf-rate").getBoundingClientRect();
        return { text: node?.textContent ?? "", inside: text.top >= row.top - 0.5 && rec.bottom <= row.bottom + 0.5 && rec.right <= rate.left + 0.5 }; }));
      assert.deepEqual(optionRecipes.map((r) => r.text), first.map((m) => (m.single ? "" : `（${m.recipe.join("・")}）`)));
      assert(optionRecipes.every((r) => r.inside), JSON.stringify(optionRecipes));
      assert.equal(await page.locator(".tf-sheet small:not(.tf-shuffle-cost)").count(), 0, "説明の文は置かない（印と色で読む。シャッフルの秒数だけ出す）");
      // 接客の画面: 左に大きな選択肢、右に卓の様子（店内のその卓の絵・客の顔・客の言葉）。店内の帯・一覧・卓の札は隠れ、UI の上に UI が重ならない
      const view = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
        const visible = (sel) => getComputedStyle(document.querySelector(sel)).visibility;
        const over = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const parts = [".tf-sheet-head", ".tf-options.tf-list", ".tf-sheet-foot", ".tf-visit-view", ".tf-visit-info"].map(rect);
        return { stage: rect("#stage"), main: rect(".tf-sheet-main"), visit: rect(".tf-visit"), box: rect(".tf-visit-view"), who: rect(".tf-visit-who"), say: rect(".tf-visit .tf-sheet-quote"),
          row: rect(".tf-list .tf-option").h, cam: document.querySelector(".tf-cam").style.transform,
          hidden: [".tf-top", ".tf-presets", ".tf-bottom", ".tf-spots", ".tf-cutin", ".tf-banner"].map(visible),
          overlaps: parts.flatMap((a, i) => parts.slice(i + 1).map((b) => over(a, b))).filter(Boolean).length,
          art: getComputedStyle(document.querySelector(".tf-visit-view")).backgroundImage, no: document.querySelector(".tf-visit-no").textContent,
          faces: document.querySelectorAll(".tf-visit-who .tf-person").length,
          small: [...document.querySelectorAll(".tf-mix-option, .tf-sheet-foot .tf-shuffle, .tf-sheet-foot .tf-link")].filter((n) => { const r = n.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; }).length };
      });
      assert.equal(view.cam, "", "店内へ寄る動きはしない（専用の画面に替わる）");
      assert.deepEqual(view.hidden, ["hidden", "hidden", "hidden", "hidden", "hidden", "hidden"], "店内の帯・一覧・卓の札・帯の演出は、この画面の間は出さない");
      assert.equal(view.overlaps, 0, "選択肢の列・卓の様子・状態の札は、互いに重ならない");
      assert(view.main.right <= view.visit.left + 1 && view.visit.right <= view.stage.right + 1 && view.main.left >= view.stage.left - 1, "左に選択肢、右に卓の様子");
      assert(view.main.bottom <= view.stage.bottom + 1 && view.visit.bottom <= view.stage.bottom + 1 && view.main.top >= view.stage.top - 1, "舞台に収まる");
      assert(view.box.w >= view.stage.w * 0.4 && view.box.h >= view.stage.h * 0.5, `卓の様子は大きく映す: ${view.box.w}x${view.box.h}`);
      assert.match(view.art, /bg_tonari_inside/, "店内の絵を、その卓へ寄せて映す");
      assert.equal(view.no, "1卓");
      assert.equal(view.faces, g1.party, "客の顔が、卓の様子に出る");
      assert(view.say.bottom <= view.who.top + 2 && view.say.top >= view.box.top, "客の言葉は、顔の上の吹き出し");
      assert(view.row >= 56 * (view.stage.h / 720) && view.row >= 40, `選択肢は大きく取る: ${view.row}`);
      assert.equal(view.small, 0, "ミックスの札・シャッフル・「あとで」は押せる大きさ");
      const t0 = await api((a) => a.state().t);
      await tick(5);
      assert.equal(await api((a) => a.state().t), t0, "ミックスを選ぶ間は進まない");
      await page.locator(t("sheet-later")).click();
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await api((a) => a.state().tables[0].phase), "order", "「あとで」で閉じても、注文は残る");
      // シャッフル: 並んでいるミックスを全部入れ替える。入れ替えには4秒かかり、その間はミックスを出せない（列は閉じて、店へ戻る）
      await table(1).click();
      assert.deepEqual(await page.locator(t("shuffle")).evaluate((n) => [n.querySelector(".tf-shuffle-main > span:not(.tf-icon)").textContent, n.querySelector(".tf-shuffle-cost").textContent.trim(), n.getAttribute("aria-label")]),
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
      // 押すと、ボタンの「4秒」がそのまま秒読みになる（TFL50）
      assert.equal(await page.locator(t("shuffle-count")).first().textContent(), "4秒");
      await tick(2);
      assert.equal(await page.locator(t("shuffle-count")).first().textContent(), "3秒");
      await tick(6);
      assert.equal(await page.locator(t("presets")).getAttribute("data-busy"), "false");
      assert.equal(await page.locator(t("shuffle-count")).first().textContent(), "4秒", "入れ替えが済んだら、元の「4秒」に戻る");
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
      // 上の帯の仕込み中: 枠の丸が一つ灯る。どの卓の何かは、読み上げに出す（画面の文字にはしない）
      assert.deepEqual(await page.locator(t("making")).evaluate((n) => [n.getAttribute("aria-label"), [...n.querySelectorAll(".tf-making-pips > i")].map((i) => i.dataset.on)]),
        [`仕込み中: 1卓 ${pick.name}`, ["true", "false"]]);
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
      // 順番待ちの台数は、仕込み中の札の中の「＋N」。枠の丸は二つとも灯る
      assert.deepEqual(await page.locator(t("making")).evaluate((n) => { const box = n.getBoundingClientRect(), more = n.querySelector(".tf-making-more"), r = more.getBoundingClientRect();
        return [more.textContent, r.left >= box.left && r.right <= box.right + 0.5 && r.top >= box.top && r.bottom <= box.bottom + 0.5, [...n.querySelectorAll(".tf-making-pips > i")].map((i) => i.dataset.on), /順番待ち 1台$/.test(n.getAttribute("aria-label"))]; }),
        ["＋1", true, ["true", "true"], true]);
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
      assert.equal(await api((a) => C.model.floorBill(a.state(), 1).total), 3300, "チャージ700円＋基本2,000円＋初回ドリンク600円");
      // 炭の調整: 炭の残りが少なくなったら、頼まれる前に自分から行く（卓を押すだけ）。まだ残っているうちは変わらない
      await api((a) => { const x = a.state().tables[0]; x.wants = []; x.mood = 70; });
      await table(1).click();
      assert.equal(await spot(1).locator(".tf-pop").last().innerText(), "炭はまだ平気");
      // 同じ卓に続けて言葉が出ても、重ねない（新しい言葉に替わる）
      await table(1).click();
      assert.deepEqual([await spot(1).locator(".tf-pop").count(), await spot(1).locator(".tf-pop").innerText()], [1, "炭はまだ平気"]);
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
      assert.equal(await page.locator("#tf-sheet-title span").innerText(), "炭の調整");
      // 卓の様子: 客の言葉（吹き出し）と、いまの状態（出している一台・満足の顔・満足と滞在と炭の棒・ご利用の金額）
      assert.match(await page.locator(".tf-visit .tf-sheet-quote").innerText(), /^「.+」$/);
      assert.deepEqual(await page.locator(".tf-visit-info").evaluate((n) => [!!n.querySelector(".tf-visit-mix .tf-attr"), !!n.querySelector(".tf-visit-face svg"), [...n.querySelectorAll(".tf-visit-bars small")].map((x) => x.textContent), /円$/.test(n.querySelector(".tf-visit-bill strong").textContent)]),
        [true, true, ["満足", "滞在", "炭"], true]);
      // 出している一台は、名前と、使ったフレーバー（）
      assert.equal(await page.locator(".tf-visit-mix .tf-mix-text").evaluate((n) => `${n.querySelector("b").textContent}${n.querySelector(".tf-recipe")?.textContent ?? ""}`),
        await page.evaluate(() => { const s = C.view.floorTest.api.state(); return C.model.mixFullName(s.tables.find((x) => x.id === Number(document.querySelector(".tf-visit-no").textContent.replace(/\D/g, ""))).mix); }));
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
      assert.equal(await page.locator(".tf-verdict").evaluate((n) => n.parentElement.className), "tf-visit-view", "判定の印は、卓の様子の上に出る（選択肢に被らない）");
      assert.equal(await page.locator(t(`option-${verb}`)).getAttribute("data-picked"), "true");
      if (platform === "pc") await page.screenshot({ path: `${shots}/tonari-floor-pc-verdict.png` }).catch(() => {});
      await page.locator(t(`option-${verb}`)).click();
      await page.evaluate(() => { C.view.floorTest.verdictMs = null; });
      assert.equal(await api((a) => a.mode()), "live");
      assert.equal(await api((a) => C.model.floorCoalLeft(a.state(), 1)), 1, "正しく応えれば、炭も整う");
      assert.deepEqual(await page.evaluate(() => [".tf-top", ".tf-presets", ".tf-bottom", ".tf-spots"].map((sel) => getComputedStyle(document.querySelector(sel)).visibility)),
        ["visible", "visible", "visible", "visible"], "対応が済んだら、店へ戻る");
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
      // 見送りの言葉は、出来事の行に出る（同じ時に「いまの調子」の知らせが続くことがあるので、2行のどちらかに出ていればよい）
      assert.match(await page.locator(t("log")).innerText(), /(^|\n)1卓「.+」(\n|$)/);
      assert.equal(await tagText(1), "1 片付け中");
      // フィーバー: 1段溜まるまで押せない。使うと、くつろいでいる卓が最高の居心地になる
      await until("s.tables.filter((x) => x.phase === 'enjoy').length >= 2", []);
      await api((a) => { a.state().fever = 40; a.tick(1); });
      assert.equal(await page.locator(t("bonus")).isDisabled(), true);
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "");
      await api((a) => { a.state().fever = 130; a.tick(1); });
      assert.equal(await page.locator(t("bonus")).isDisabled(), false);
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "ready");
      assert.match(await page.locator(t("bonus")).innerText(), /^フィーバー\s*Lv1$/);
      const bgmBefore = await page.evaluate(() => C.audio.requestedBgm());
      await page.locator(t("bonus")).click({ force: true });
      assert.equal(await page.locator(t("screen")).getAttribute("data-fever"), "on");
      assert.match(await page.locator(".tf-cutin").innerText(), /FEVER TIME!\s*Lv1/);
      // フィーバーの帯が出ている間も、卓の札は出さない。帯の文字は、右の列まで届かない
      assert.deepEqual(await page.evaluate(() => { const root = document.querySelector(".tonari-floor"), side = root.querySelector(".tf-presets").getBoundingClientRect();
        return [root.dataset.band, getComputedStyle(root.querySelector(".tf-spots")).opacity, [...root.querySelectorAll(".tf-cutin > b, .tf-cutin > small")].every((n) => n.getBoundingClientRect().right <= side.left)]; }), ["true", "0", true]);
      await afterBand(page);
      const fever = await api((a) => { const s = a.state(); return { level: s.feverLevel, tables: s.tables.filter((x) => x.fever).map((x) => [x.id, x.mood]), fevers: s.fevers }; });
      assert.deepEqual([fever.level, fever.fevers, fever.tables.length], [1, 1, 2], "Lv1 は2卓まで");
      assert(fever.tables.every(([, m]) => m === 100));
      assert.equal(await spot(fever.tables[0][0]).getAttribute("data-tone"), "fever");
      assert.equal(await page.locator(t("bonus")).isDisabled(), true, "フィーバー中は重ねて使えない");
      // フィーバー中の名前と段は、ボタンからはみ出さない。曲は、プリクラ用に作った平成ユーロビートへ替わる
      assert.match(await page.locator(t("bonus")).innerText(), /^フィーバー中\s*Lv1$/);
      assert.equal(await page.locator(t("bonus")).evaluate((n) => { const box = n.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(n.querySelector("b"));
        const text = range.getBoundingClientRect(), lv = n.querySelector(".tf-bonus-lv").getBoundingClientRect(); return text.left >= box.left && text.right <= box.right && lv.right <= box.right && lv.bottom <= box.bottom; }), true);
      assert.equal(await page.evaluate(() => C.audio.requestedBgm()), "bgm_purikura");
      assert.notEqual(bgmBefore, "bgm_purikura");
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
          recipes: [...document.querySelectorAll(".tf-slip-mixes li")].map((li) => { const rec = li.querySelector(".tf-recipe"), box = li.getBoundingClientRect(), r = rec?.getBoundingClientRect();
            return rec ? [/^（[^（）]+）$/.test(rec.textContent), r.right <= box.right + 0.5 && r.bottom <= box.bottom + 0.5] : [/単$/.test(li.querySelector(".tf-slip-mix")?.textContent || ""), true]; }),
          inside: card.top >= stage.top - 1 && card.bottom <= stage.bottom + 1 };
      });
      assert.deepEqual(slip.names, ["お迎えした組", "チャージ", "シーシャ", "ドリンク", "トップ替え（おかわり）"]);
      assert.equal(slip.sum, slip.total);
      assert.doesNotMatch(slip.text, /原価|利益|サービス費|延長|定番/);
      assert.match(slip.text, /いい調整 \d+回・いいケア \d+回・追加ドリンク \d+杯・おかわり \d+組・フィーバー 1回/);
      assert.match(slip.fans, /^店のファン [＋−]\d+人（合計 \d+人）$/);
      assert(slip.mixes >= 1 && slip.inside, "精算の札が舞台に収まる");
      assert(slip.recipes.every((r) => r && r[0] && r[1]), `好評だったミックスにも、使ったフレーバーが切れずに出る（1種の物は「〜単」）: ${JSON.stringify(slip.recipes)}`);
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

  // 文字と文字を重ねない（2026-11-20 オーナー「こういうの見ると文字と文字が重なってるの避けたい」・TFL45）:
  // 満席の日を、言葉が消える前に次の出来事が起きる速さで回し、画面の文字の箱（手応えの言葉・卓の札・見出し・番号札・帯の文字・まん中の札・
  // 上下の帯・右の列）が、どのコマでも重ならないことを確かめる。動きは本番と同じ（出はじめに言葉がふくらむ）
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-no-text-overlap`, async (page) => {
      await setup(page);
      await page.evaluate(() => {
        C.fresh();
        window.done = C.view.runTonariFloor({ seed: 5, level: 6, chapter: 2, night: true, fans: 12, visitor: "tsumugi",
          art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
      });
      await page.locator(t("option-start")).click();
      const audit = await page.evaluate(async () => {
        const root = document.querySelector(".tonari-floor"), a = C.view.floorTest.api;
        const shown = (n) => { if (!n.getClientRects().length) return false;
          for (let x = n; x && x !== root.parentNode; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) return false; }
          return true; };
        const kinds = { pop: ".tf-pop", head: ".tf-tag-want", box: ".tf-tag-box", plate: ".tf-plate", cutin: ".tf-cutin > b, .tf-cutin > small", banner: ".tf-banner",
          making: ".tf-making", clock: ".tf-clock", sales: ".tf-sales", pause: ".tf-pause-button", side: ".tf-presets", ticker: ".tf-ticker" };
        const seen = new Map(), counts = { frames: 0, pops: 0, bands: 0, twoPops: 0 };
        const look = () => {
          counts.frames++;
          const boxes = [];
          for (const [kind, sel] of Object.entries(kinds)) for (const n of root.querySelectorAll(sel)) {
            if (!shown(n) || (kind === "head" && !n.textContent.trim())) continue;
            const r = n.getBoundingClientRect();
            if (r.width >= 2 && r.height >= 2) boxes.push({ kind, spot: n.closest(".tf-spot")?.dataset.id || "", text: n.textContent.trim().slice(0, 12), r });
          }
          const pops = boxes.filter((b) => b.kind === "pop");
          counts.pops = Math.max(counts.pops, pops.length);
          if (new Set(pops.map((b) => b.spot)).size < pops.length) counts.twoPops++;
          if (boxes.some((b) => b.kind === "cutin")) counts.bands++;
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const x = boxes[i], y = boxes[j];
            if (x.spot && x.spot === y.spot) continue; // 同じ卓の札の中の部品どうしは見ない（言葉は一つしか出ない。下で数える）
            if (!x.spot && !y.spot && x.kind === y.kind) continue;
            const w = Math.min(x.r.right, y.r.right) - Math.max(x.r.left, y.r.left), h = Math.min(x.r.bottom, y.r.bottom) - Math.max(x.r.top, y.r.top);
            if (w > 1.5 && h > 1.5) seen.set(`${x.kind}${x.spot}×${y.kind}${y.spot}`, `${x.kind}${x.spot}「${x.text}」×${y.kind}${y.spot}「${y.text}」`);
          }
        };
        for (let i = 0; i < 420; i++) {
          const s = a.state();
          if (s.done || a.mode() === "result") break;
          if (a.mode() === "panel") { document.querySelector(".tf-sheet .tf-option")?.click(); continue; }
          for (const table of s.tables) {
            const tap = C.model.floorTap(s, table.id), guest = s.guests[table.guestId];
            if (tap === "order" && s.t >= s.shuffleAt && i % 3 === 0) a.act({ type: "order", tableId: table.id, mix: C.bot.bestMix(s, guest.order, { worst: i % 5 === 0 }).id });
            else if (tap === "care" && i % 4 === 0) a.act({ type: "care", tableId: table.id, verb: i % 8 === 0 ? "chat" : C.floorData.CALLS[table.call.type].verb });
            else if (tap === "tend") a.act({ type: "tend", tableId: table.id });
            else if (tap === "bill" && i % 2 === 0) a.act({ type: "bill", tableId: table.id });
          }
          if (i % 37 === 20) a.act({ type: "shuffle" });
          if (s.fever >= 100 && !s.feverLevel && i % 9 === 0) document.querySelector('[data-test="tonari-floor-bonus"]').click();
          if (i % 11 === 5) document.querySelector(`[data-test="tonari-floor-table-${1 + (i % 5)}"]`)?.click(); // 押しても進まない卓の言葉も混ぜる
          a.tick(1);
          look();
          await new Promise((r) => setTimeout(r, 45));
          look();
        }
        return { hits: [...seen.values()], ...counts, fevers: a.state().fevers };
      });
      assert.deepEqual(audit.hits, [], `文字どうしが重なった: ${audit.hits.join(" / ")}`);
      assert.equal(audit.twoPops, 0, "同じ卓に、言葉は一つしか出ない");
      // 点検が空振りしていないこと: 言葉が同時に2つ以上出ていて、帯の演出（営業開始かフィーバー）も通っている
      assert(audit.frames > 300 && audit.pops >= 2 && audit.bands >= 1 && audit.fevers >= 1, JSON.stringify(audit));
    }, { ...options, reducedMotion: "no-preference" });
  }

  // 単品・2種・3種（2026-11-20 オーナー「ミックスは3種のも入れて欲しい。単品ならダブルアップル単とかにする」・TFL47）:
  // 1種の物は「〜単」で（）なし、2〜3種は名前のあとに（）。いちばん長い名前と材料でも、右の列の札と接客の画面の札に収まる
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) {
    await run(`${platform}-mix-kinds`, async (page) => {
      await setup(page);
      await page.evaluate(() => {
        C.fresh();
        window.done = C.view.runTonariFloor({ seed: 5, level: 6, chapter: 2, night: true, fans: 12,
          art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
      });
      await page.locator(t("option-start")).click();
      await afterBand(page);
      for (const hand of [["apple", "cappuccino", "cottoncandy", "mintshake", "berrymint"], ["berries", "flowergarden", "caramelmacchiato", "berrysmoothie", "nutslatte"], ["chai", "tropical", "pinepassion", "earlgrey", "sakuralatte"]]) {
        await page.evaluate((hand) => { const a = C.view.floorTest.api, s = a.state(); s.hand = hand; if (s.tables[0].phase === "empty") a.tick(4); else a.tick(1); }, hand);
        const expected = await page.evaluate((hand) => hand.map((id) => ({ name: C.model.mixName(id), full: C.model.mixFullName(id), single: C.model.mixIsSingle(id), flavors: C.model.mixFlavorNames(id) })), hand);
        const rows = await page.locator(".tf-preset").evaluateAll((list) => list.map((n) => { const row = n.getBoundingClientRect(), name = n.querySelector(".tf-preset-name"), nr = name.getBoundingClientRect(), node = n.querySelector(".tf-recipe"), rr = node?.getBoundingClientRect();
          const stamp = n.querySelector(".tf-match")?.getBoundingClientRect(), hits = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
          const words = [...name.querySelectorAll("span")].map((x) => x.getBoundingClientRect());
          return { single: n.dataset.single, name: name.textContent, recipe: node?.textContent ?? "", label: n.getAttribute("aria-label"), lines: node ? Math.round(rr.height / parseFloat(getComputedStyle(node).lineHeight) / (row.width / n.offsetWidth)) : 0,
            inside: nr.top >= row.top - 0.5 && (rr || nr).bottom <= row.bottom + 0.5 && words.every((w) => w.right <= row.right + 0.5) && (!rr || (rr.right <= row.right + 0.5 && nr.bottom <= rr.top + 1)), stamp: words.some((w) => hits(w, stamp)) }; }));
        assert.deepEqual(rows.map((r) => [r.single, r.name, r.recipe]), expected.map((m) => [String(m.single), m.name, m.single ? "" : `（${m.flavors.join("・")}）`]));
        assert(rows.every((r, i) => r.inside && !r.stamp && r.lines <= 2 && r.label.startsWith(expected[i].full)), `右の列の札に収まらない: ${JSON.stringify(rows)}`);
        // 接客の画面の札: 名前の下に材料（1行）。1種の物は名前だけ
        await page.locator(t("table-1")).click();
        await page.locator(t("sheet")).waitFor();
        const options = await page.locator(".tf-mix-option").evaluateAll((list) => list.map((n) => { const row = n.getBoundingClientRect(), text = n.querySelector(".tf-mix-text").getBoundingClientRect(), node = n.querySelector(".tf-recipe"), rr = node?.getBoundingClientRect(), rate = n.querySelector(".tf-rate").getBoundingClientRect(), b = n.querySelector("b");
          return { name: b.textContent, recipe: node?.textContent ?? "", cut: b.scrollWidth > b.clientWidth + 1, lines: node ? Math.round(rr.height / parseFloat(getComputedStyle(node).lineHeight) / (row.width / n.offsetWidth)) : 0,
            inside: text.top >= row.top - 0.5 && (rr || text).bottom <= row.bottom + 0.5 && (rr || text).right <= rate.left + 0.5 }; }));
        assert.deepEqual(options.map((r) => [r.name, r.recipe]), expected.map((m) => [m.name, m.single ? "" : `（${m.flavors.join("・")}）`]));
        assert(options.every((r) => r.inside && !r.cut && r.lines <= 1), `接客の画面の札に収まらない: ${JSON.stringify(options)}`);
        await page.locator(".tf-sheet .tf-link").click();
      }
      // 3種のミックスは仕込みが長く（9秒）、合った時の満足が高い。1種は早い（5秒）
      assert.deepEqual(await page.evaluate(() => { const a = C.view.floorTest.api, s = a.state(), wish = s.guests[s.tables[0].guestId].order.wish;
        const rich = Object.keys(C.floorData.MIXES).find((id) => C.floorData.MIXES[id].flavors.length === 3 && C.model.mixRatings(id)[wish] === "best");
        s.hand[0] = rich; a.act({ type: "order", tableId: 1, mix: rich });
        const total = a.state().tables[0].make.total; for (let i = 0; i < 60 && a.state().tables[0].phase !== "enjoy"; i++) a.tick(1);
        return [total, Math.round(a.state().tables[0].mood) >= 85]; }), [18, true]);
    }, options);
  }

  // 手応えと駆け引き（2026-11-20 オーナー「ゲームとして面白くしたり演出を強くする」・TFL46）:
  // 流れ（◎の連続で言葉と光が変わる）・卓の札の手応え・いまの調子のゲージ・フィーバーの入りと明け・ラストオーダー・精算の自己ベストと紙吹雪
  await run("pc-juice", async (page) => {
    await setup(page);
    await page.evaluate(() => {
      C.fresh();
      window.done = C.view.runTonariFloor({ seed: 5, level: 1, chapter: 1, night: true, fans: 12, topSales: 1000,
        art: C.data.bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night") }).then((r) => { window.result = r; });
    });
    await page.locator(t("option-start")).click();
    await afterBand(page);
    // id の卓へ、合い方 want の一台を出して提供まで進める（ほかの卓は、帰らせないように片付ける）
    const serve = (id, want) => page.evaluate(({ id, want }) => {
      const a = C.view.floorTest.api;
      const mixFor = (wish, rating) => Object.keys(C.floorData.MIXES).find((m) => C.model.mixRatings(m)[wish] === rating);
      const others = () => { const s = a.state(); for (const x of s.tables) { if (x.id === id) continue; const tap = C.model.floorTap(s, x.id);
        if (tap === "tend") a.act({ type: "tend", tableId: x.id }); else if (tap === "bill") a.act({ type: "bill", tableId: x.id });
        else if (tap === "care") a.act({ type: "care", tableId: x.id, verb: C.floorData.CALLS[x.call.type].verb });
        else if (tap === "order") x.since = s.t; } }; // 注文待ちの客は、順番が来るまで待たせておく（帰ると流れが切れるので）
      for (let i = 0; i < 200 && a.state().tables[id - 1].phase !== "order"; i++) { others(); a.tick(1); }
      const s = a.state(), mix = mixFor(s.guests[s.tables[id - 1].guestId].order.wish, want);
      s.hand[0] = mix;
      a.act({ type: "order", tableId: id, mix });
      for (let i = 0; i < 60 && a.state().tables[id - 1].phase !== "enjoy"; i++) { others(); a.tick(1); }
      const spot = document.querySelector(`.tf-spot[data-id="${id}"]`);
      return { streak: a.state().streak, pop: spot.querySelector(".tf-pop")?.textContent, hit: spot.dataset.hit, burst: !!spot.querySelector(".tf-tag-box > .tf-burst"),
        glow: document.querySelector('[data-test="tonari-floor-bonus"]').dataset.streak };
    }, { id, want });
    // 一つ目の◎: 卓の札が弾んで光る。二つ目の◎: 言葉が「2連続！」に変わり、フィーバーのゲージが光りはじめる。○を出すと流れは切れる
    assert.deepEqual(await serve(1, "best"), { streak: 1, pop: "ぴったり！", hit: "best", burst: true, glow: "0" });
    assert.deepEqual(await serve(2, "best"), { streak: 2, pop: "2連続！", hit: "chain", burst: true, glow: "1" });
    assert.deepEqual(await serve(3, "good"), { streak: 0, pop: "いい感じ", hit: "good", burst: true, glow: "0" });
    // いまの調子: 売上の下のゲージ。満足の平均と、評価の境目の刻み（まずまず・上々・大入り）。売上の箱からはみ出さない
    const outlook = await page.evaluate(() => { const bar = document.querySelector('[data-test="tonari-floor-outlook"]'), box = document.querySelector(".tf-sales").getBoundingClientRect(), r = bar.getBoundingClientRect(), o = C.model.floorOutlook(C.view.floorTest.api.state());
      return { rank: bar.dataset.rank, label: bar.getAttribute("aria-label"), fill: Math.round(parseFloat(bar.querySelector("i").style.width)), score: o.score, stamp: o.stamp, ticks: [...bar.querySelectorAll("b")].map((n) => n.style.left),
        inside: r.left >= box.left && r.right <= box.right && r.bottom <= box.bottom && r.top >= document.querySelector('[data-test="tonari-floor-sales"]').getBoundingClientRect().bottom - 1 }; });
    assert.deepEqual([outlook.rank.length, outlook.label, outlook.fill, outlook.ticks, outlook.inside], [1, `いまの調子: ${outlook.stamp}`, outlook.score, ["88%", "74%", "56%"], true]);
    // 評価の段が下がると、ゲージが光って出来事の行で知らせる
    const before = outlook.rank;
    await page.evaluate(() => { const a = C.view.floorTest.api; a.tick(10); a.state().tables.forEach((x) => { if (x.phase === "enjoy") x.mood = 20; }); a.tick(1); });
    const down = await page.evaluate(() => { const bar = document.querySelector('[data-test="tonari-floor-outlook"]'); return { rank: bar.dataset.rank, bump: bar.dataset.bump, log: document.querySelector('[data-test="tonari-floor-log"]').innerText }; });
    assert.notEqual(down.rank, before);
    assert.equal(down.bump, "down");
    assert.match(down.log, /いまの調子：(上々|まずまず|ばたばた)/);
    // フィーバー: 入る時に画面が光り、明けると、その間に増えた売上を知らせる
    await page.evaluate(() => { const a = C.view.floorTest.api; a.state().tables.forEach((x) => { if (x.phase === "enjoy") x.mood = 80; }); a.state().fever = 130; a.tick(1); });
    await page.locator(t("bonus")).click({ force: true });
    assert.equal(await page.locator(".tf-flash").getAttribute("data-on"), "fever");
    await page.evaluate(() => { const a = C.view.floorTest.api; for (let i = 0; i < 80 && a.state().feverLeft > 0; i++) a.tick(1); });
    assert.match(await page.locator(t("log")).innerText(), /フィーバーが明けました（＋[\d,]+円）/);
    assert.equal(await page.locator(".tf-flash").getAttribute("data-on"), "soft");
    await afterBand(page);
    // ラストオーダー: 新しい客が来なくなる時に、まん中の札で知らせる。残り10秒は、時計が脈を打つ
    await page.evaluate(() => { const a = C.view.floorTest.api, s = a.state(); s.t = s.length - C.model.floorLastCall - 1; a.tick(1); a.tick(1); });
    assert.match(await page.locator(".tf-banner").innerText(), /ラストオーダー\s*新しい来店は、ここまで/);
    assert.equal(await page.locator(t("screen")).getAttribute("data-final"), "false");
    await page.evaluate(() => { const a = C.view.floorTest.api, s = a.state(); s.t = s.length - 19; a.tick(1); });
    assert.equal(await page.locator(t("screen")).getAttribute("data-final"), "true");
    // 精算: 大入りは紙吹雪。これまでの売上の最高を超えた夜は「自己ベスト」。いちばん長かった流れも残る
    await page.evaluate(() => { const a = C.view.floorTest.api, s = a.state(); s.results.forEach((r) => { r.mood = 96; r.left = false; });
      s.tables.forEach((x) => { if (x.phase === "enjoy" || x.phase === "bill") x.mood = 96; else if (x.phase !== "empty") { x.phase = "empty"; x.guestId = null; } }); a.act({ type: "finish" }); });
    await page.locator(t("result")).waitFor();
    const slip = await page.evaluate(() => { const rect = (sel) => document.querySelector(sel).getBoundingClientRect(); const rec = rect('[data-test="tonari-floor-record"]'), total = rect(".tf-slip-total"), card = rect(".tf-slip");
      return { rank: document.querySelector('[data-test="tonari-floor-result"]').dataset.rank, confetti: document.querySelectorAll(".tf-confetti i").length, record: document.querySelector('[data-test="tonari-floor-record"]').textContent,
        sales: document.querySelector('[data-test="tonari-floor-final-sales"]').textContent, value: Number(document.querySelector('[data-test="tonari-floor-final-sales"]').dataset.value),
        counts: document.querySelector(".tf-slip-counts").textContent, below: rec.top >= total.bottom - 1 && rec.bottom <= card.bottom }; });
    assert.deepEqual([slip.rank, slip.confetti, slip.record, slip.below], ["S", 22, "自己ベスト！これまで 1,000円", true]);
    assert(slip.value > 1000 && slip.sales === `${slip.value.toLocaleString("ja-JP")}円`, JSON.stringify(slip));
    assert.match(slip.counts, /ぴったり 2連続$/);
    await page.locator(t("option-continue")).click();
    await page.waitForFunction(() => window.result !== undefined);
    assert.deepEqual(await page.evaluate(() => [window.result.streak, window.result.sales]), [2, slip.value]);
  });

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
      await afterBand(page);
      assert.equal(await page.locator(t("screen")).getAttribute("data-style"), "seated");
      assert.equal(await page.locator(".tf-front").count(), 1);
      // 奥の卓の札は、席の上に出て、上の帯にも右のミックスの列にも隠れない
      await api((a) => a.tick(4));
      assert.equal(await api((a) => a.state().tables[0].phase), "order");
      const back = await page.evaluate(() => {
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
        return { tag: rect('.tf-spot[data-id="1"] .tf-bubble'), seat: rect('.tf-spot[data-id="1"] .tf-seat'), hud: rect(".tf-top"), side: rect(".tf-presets"),
          right: rect('.tf-spot[data-id="3"] .tf-seat'), rightSide: rect('.tf-spot[data-id="5"] .tf-seat'), plate4: rect('.tf-spot[data-id="4"] .tf-plate'),
          plates: [...document.querySelectorAll(".tf-spot")].map((n) => [n.dataset.phase === "empty", n.querySelector(".tf-plate").getClientRects().length > 0]) };
      });
      assert(back.tag.bottom <= back.seat.top + 2, "奥の席の札は席の上");
      assert(back.plates.every(([empty, shown]) => empty === shown) && back.plates[0][0] === false && back.plates[3][0] === true, `番号札は空席の間だけ: ${JSON.stringify(back.plates)}`);
      assert(back.tag.top >= back.hud.bottom - 2, `奥の卓の札が上の帯に被る: ${back.tag.top} < ${back.hud.bottom}`);
      assert(back.right.right <= back.side.left + 2 && back.rightSide.right <= back.side.left + 2, "右の席がミックスの列に被る");
      // 手前の左の卓（4卓）に客が座るまで進める
      await until("s.tables[3].phase === 'order'", []);
      const geo = await page.evaluate(() => {
        const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
        const rect = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
        const spot = '.tf-spot[data-id="4"]';
        return { seat: rect(`${spot} .tf-seat`), plate: rect(`${spot} .tf-plate`), bubble: rect(`${spot} .tf-bubble`), plateShown: document.querySelector(`${spot} .tf-plate`).getClientRects().length > 0,
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
      // 客が着いたので番号札は畳まれる。札は、番号札があった所（内側の卓）の上に出る
      assert.equal(geo.plateShown, false);
      assert(geo.bubble.bottom <= back.plate4.top + 2, "手前の席の札は、内側の卓の上");
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
      // 専用の店内でも、接客の画面は同じ形（店内の札は隠れ、右に卓の様子）
      assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.querySelector(".tf-spots")).visibility, !!document.querySelector(".tf-visit-view"), document.querySelector(".tf-visit-no").textContent]),
        ["hidden", true, "4卓"]);
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
    assert.equal(await spot.locator(".tf-bubble").evaluate((tag) => { tag.querySelectorAll(".tf-pop").forEach((n) => n.remove()); return tag.innerText.replace(/\s+/g, " ").trim(); }), "注文 フルーティ 3 9");
    assert.match(await page.locator(t("log")).innerText(), /アダムが遊びに来た！ 3卓へ/);
    await page.locator(t("table-3")).click();
    await page.locator(t("sheet")).waitFor();
    assert.equal(await page.locator(".tf-sheet-quote").innerText(), "「……はじめよ。今日は、果実の煙を頼む」");
    assert.match(await page.locator(".tf-visit-who img").getAttribute("src"), /face_adam/);
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
