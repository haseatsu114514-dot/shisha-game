// 本番VN・共有の恋愛/友人API・セーブを実ブラウザで通す。正式台本の代用はテスト内だけ。
import assert from "node:assert/strict";
import { assertFits } from "./browser/support.mjs";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const artifacts = path.join(root, process.env.ARTIFACT_DIR || "asset_sources/hiyori-foundation-20261011");
fs.mkdirSync(artifacts, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [], errors = [], missing = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
page.setDefaultTimeout(15000);
async function check(label, run) {
  await run();
  results.push(label);
  console.log(`[hiyori] PASS: ${label}`);
}
async function start(dialogue) {
  await page.evaluate((dlg) => { window.scene = QA.vn.play(dlg); }, dialogue);
  await page.waitForFunction(() => document.querySelector("#vn.active .vn-next.show"));
  await page.waitForTimeout(350); // 本番の初回タップ誤爆防止期間を待つ
}
async function next() { await page.locator(".vn-box").click(); }
async function fit() {
  // 原画のはみ出しではなく、本文・本心・名前の字面と操作の可読域を共通検査する。
  await assertFits(page, ".vn-box, .vn-text, .vn-inner:not([hidden]), .vn-controls, .vn-choices.show");
}
try {
  await page.goto(base);
  await page.locator('[data-test="title-new"]').waitFor();
  await page.locator("#boot").waitFor({ state: "detached" });
  await page.evaluate(async () => {
    window.QA = {
      core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), stats: await import("./js/core/stats.js"),
      route: await import("./js/core/hiyori-route.js"), daily: await import("./js/daily/hiyori.js"),
      bonds: await import("./js/daily/bonds.js"), romance: await import("./js/daily/romance.js"),
      ch1: await import("./js/chapters/ch1.js"), audio: await import("./js/core/audio.js"),
    };
    QA.ch1.setupHooks();
    QA.fresh = () => {
      const state = QA.core.newGame();
      state.flags._axe_bar_legacy_access = true; // #577: 既存ルート回帰は旧保存として保つ
      Object.assign(state, { phase: "daily", day: 5, slot: 1 });
      QA.core.config.textSpeed = 4;
      QA.vn.vnTest.turbo = false;
      QA.vn.vnTest.choose = null;
      QA.vn.backlog().length = 0;
      return state;
    };
    QA.fresh();
  });

  await check("enabled route, identity and registered assets", async () => {
    const result = await page.evaluate(() => {
      const { core, data, route, bonds } = QA;
      const before = JSON.stringify(core.state);
      const unknown = data.displayName("hiyori", core.state);
      const ready = route.availableHiyoriEvents().map((e) => e.id);
      const finale = bonds.finaleDue("hiyori");
      const unchanged = JSON.stringify(core.state) === before;
      core.state.met.hiyori = true;
      return { unknown, known: data.displayName("hiyori", core.state), ready, finale, unchanged,
        portrait: data.portraitInfo("hiyori", "normal"), icon: data.faceIconUrl("hiyori") };
    });
    assert.equal(result.unknown, "？？？"); assert.equal(result.known, "ひより");
    assert.deepEqual(result.ready, ["meeting"]); assert(result.unchanged && !result.finale && result.portrait && result.icon);
  });

  await check("spoken first, silent inner, click and ordinary dialogue", async () => {
    await page.evaluate(() => {
      QA.fresh().met.hiyori = true;
      QA.core.config.textSpeed = 1;
      QA.blips = [];
      QA.originalBlip = QA.audio.SE.blip;
      QA.audio.SE.blip = (id) => QA.blips.push(id);
      window.scene = QA.vn.play({ lines: [
        { speaker: "hiyori", text: "静かな時間だね……", inner: "会社の通知がないって最高かよ！！！" },
        { speaker: "hajime", text: "落ち着きますね", inner: "これはひより以外では表示しない" },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent?.length >= 2);
    assert(await page.locator(".vn-inner").evaluate((n) => n.hidden));
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "静かな時間だね……");
    const publicBlips = await page.evaluate(() => QA.blips.length);
    await page.waitForFunction(() => document.querySelector(".vn-inner").textContent.length > 3);
    assert.equal(await page.evaluate(() => QA.blips.length), publicBlips, "inner must not sound like a spoken line");
    await next(); // 文字送り中の1回目は両方を最後まで表示する
    assert.equal(await page.locator(".vn-inner").innerText(), "（会社の通知がないって最高かよ！！！）");
    assert.equal(await page.evaluate(() => QA.vn.backlog().length), 1);
    await next();
    await page.waitForFunction(() => document.querySelector(".vn-name").textContent === "はじめ");
    assert(await page.locator(".vn-inner").evaluate((n) => n.hidden));
    assert.equal(await page.locator(".vn-box").evaluate((n) => n.classList.contains("has-inner")), false);
    await next(); await next(); await page.evaluate(() => window.scene);
    await page.evaluate(() => { QA.audio.SE.blip = QA.originalBlip; QA.core.config.textSpeed = 4; });
  });

  await check("log separation, escaping, multi-page inner and no reward/knowledge cues", async () => {
    const inner = "……【好感度】が大きく上がった。<img src=x onerror=alert(1)>" + "明日の会議資料もまだあるけど今は煙を楽しみたい。".repeat(5);
    await page.evaluate(() => { QA.before = JSON.stringify(QA.core.state); });
    await start({ lines: [{ speaker: "hiyori", text: "今日は、のんびり……", inner }, { speaker: "hajime", text: "ゆっくりしましょう" }] });
    const seen = [];
    for (let i = 0; i < 16 && await page.locator("#vn").evaluate((n) => n.classList.contains("active")); i++) {
      const text = await page.locator(".vn-inner").innerText();
      if (text) { assert(text.startsWith("（") && text.endsWith("）")); seen.push(text); }
      assert.equal(await page.locator(".vn-inner img").count(), 0);
      await fit(); await next();
    }
    await page.evaluate(() => window.scene);
    assert(seen.length > 1);
    assert.equal(await page.evaluate(() => JSON.stringify(QA.core.state) === QA.before), true, "inner cannot grant rewards or reveal her identity");
    const lastLog = await page.evaluate(() => QA.vn.backlog().slice(-2));
    assert.equal(lastLog[0].inner, `（${inner}）`);
    await start({ lines: [{ speaker: "hajime", text: "ログを読み返そう" }] });
    await page.locator('[data-test="vn-log"]').click();
    assert.equal(await page.locator(".log-inner").last().textContent(), `（${inner}）`);
    assert.equal(await page.locator(".log-inner img").count(), 0);
    assert.equal(await page.locator(".log-inner").last().evaluate((n) => getComputedStyle(n).color), "rgb(255, 182, 204)");
    await page.locator(".log-head button").click();
    await next(); await page.evaluate(() => window.scene);
  });

  for (const [label, viewport] of [["desktop", { width: 1280, height: 720 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(`${label} layout and inner becoming spoken`, async () => {
      await page.setViewportSize(viewport);
      await start("hiyori_preview_romance");
      assert.equal(await page.locator(".vn-inner").evaluate((n) => getComputedStyle(n).color), "rgb(255, 182, 204)");
      await fit();
      await page.screenshot({ path: path.join(artifacts, `${label}-inner.png`) });
      await next(); await next();
      assert((await page.locator(".vn-text").innerText()).includes("帰りたくない"));
      assert(await page.locator(".vn-inner").evaluate((n) => n.hidden));
      await fit();
      await page.screenshot({ path: path.join(artifacts, `${label}-spoken.png`) });
      await page.evaluate(() => { QA.vn.vnTest.turbo = true; });
      await next(); await page.evaluate(() => window.scene);
      await page.evaluate(() => { QA.vn.vnTest.turbo = false; });
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await check("AUTO counts inner and pauses in LOG; SKIP waits for choices", async () => {
    await start({ lines: [{ speaker: "hiyori", text: "……", inner: "会社の通知を切ったから今は桃の香りだけを楽しむ" }, { speaker: "hajime", text: "そうですね" }] });
    await page.locator('[data-test="vn-auto"]').click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".vn-text").innerText(), "……", "AUTO must wait for inner as well");
    await page.locator('[data-test="vn-log"]').click();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".vn-text").innerText(), "……");
    await page.locator(".log-head button").click();
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "そうですね");
    await page.locator('[data-test="vn-auto"]').click();
    await next(); await page.evaluate(() => window.scene);
    await start({ lines: [
      { speaker: "hiyori", text: "君はどう思う……？", inner: "ラーメンの話、ずっとしてたい" },
      { type: "choice", choices: [{ text: "味噌が好き", next: "answer" }, { text: "醤油が好き", next: "answer" }] },
    ], branches: { answer: [{ speaker: "hiyori", text: "いいね！", inner: "その話題なら演技は一回休み" }] } });
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator(".vn-choices.show").waitFor();
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => QA.vn.isPlaying()));
    await fit();
    await page.locator('[data-test="choice-1"]').click();
    await page.evaluate(() => window.scene);
    assert.equal(await page.locator('[data-test="vn-skip"]').evaluate((n) => n.classList.contains("on")), false);
  });

  await check("event completion, prerequisites, concurrency, friendship and confession", async () => {
    const result = await page.evaluate(async () => {
      const { core, data, route, daily, bonds, stats, romance, vn } = QA;
      const original = JSON.parse(JSON.stringify(data.DB.hiyori));
      const added = [];
      const originals = { ...data.DB.dialogues };
      const add = (id, lines, branches = {}) => { data.DB.dialogues[id] = { dialogue_id: id, lines, branches }; added.push(id); };
      try {
        const s = QA.fresh(); s.slot = 1; vn.vnTest.turbo = true;
        data.DB.hiyori.route.enabled = true;
        const missing = route.hiyoriEventStatus("axe_reveal");
        // このケースは共通関係APIのfixture。実斧投げの前後読了/操作は hiyori_axe_story.mjs で通す。
        const reveal = data.DB.hiyori.route.events.find(e => e.id === "axe_reveal");
        Object.assign(reveal, { id: "fixture_reveal", requires: ["_hiyori_cracks_done"] });
        delete reveal.slot; delete reveal.outro; delete reveal.minAffinity;
        data.DB.hiyori.route.storyEvents = data.DB.hiyori.route.storyEvents.map(id => id === "axe_reveal" ? "fixture_reveal" : id);
        for (const e of route.hiyoriRoute().events) add(e.dialogue,
          e.id === "meeting" ? [{ speaker: "hiyori", text: "朝霧ひよりです" }, { type: "set_flag", flag: "_met_hiyori" },
            { type: "set_flag", flag: "_lime_contact_hiyori" }] : [{ speaker: "hiyori", text: "テスト用の正式台本", inner: "表示だけで正体フラグは立てない" }]);
        const workTooEarly = await daily.playHiyoriEvent("work_talk");
        await daily.playHiyoriEvent("meeting");
        await daily.playHiyoriEvent("sumi_message");
        await daily.playHiyoriEvent("relay");
        stats.gainAffinity("hiyori", 5); // 次回交流の好感度を共通APIで加える
        const first = daily.playHiyoriEvent("cracks");
        const beforeEnd = !!s.flags._hiyori_cracks_done;
        const concurrent = await daily.playHiyoriEvent("cracks");
        await first;
        const pts = s.affinity.hiyori;
        const replay = await daily.playHiyoriEvent("cracks");
        const stablePts = s.affinity.hiyori === pts;
        await daily.playHiyoriEvent("fixture_reveal");
        add("hiyori_bond_question", [{ type: "choice", id: "bond_q1_hiyori", romance_char: "hiyori", choices: [
          { text: "恋愛寄りの答え", romance: 1 }, { text: "友人寄りの答え", romance: 0 },
        ] }]);
        await daily.playHiyoriEvent("work_talk");
        const story = { count: s.story.hiyori, known: !!s.flags._hiyori_real_self_known, contact: s.contacts.includes("hiyori"), done: route.hiyoriStoriesDone() };
        s.affinity.hiyori = 66;
        data.DB.hiyori.route.finale.gift = null; // 未登録時の拒否を明示するfixture。正式登録はhiyori_hagal.mjsで検証。
        const withoutGift = bonds.finaleDue("hiyori");
        data.DB.hiyori.route.finale.gift = "silicone_bowl"; // 既に所持する実機材を使うテストfixture
        add("hiyori_bond_finale", [{ type: "condition", condition_type: "romance_open", char_id: "hiyori", next_true: "question", next_false: "friend" }], {
          question: [{ type: "choice", id: "bond_q2_hiyori", romance_char: "hiyori", choices: [
            { text: "恋愛として伝える", romance: 1 }, { text: "友人のまま", romance: 0 },
          ] }], friend: [{ speaker: "hiyori", text: "友人として、また会おう" }],
        });
        add("confession_hiyori", [{ type: "choice", choices: [{ text: "付き合う", next_id: "confession_hiyori_accept" },
          { text: "友達のまま", next_id: "confession_hiyori_reject" }] }]);
        add("confession_hiyori_accept", [{ speaker: "hiyori", text: "よろしくね" }]);
        add("confession_hiyori_reject", [{ speaker: "hiyori", text: "うん、友達でいよう" }]);
        await bonds.playFinale("hiyori");
        const romantic = s.finales.hiyori.route;
        s.slot = 2;
        await romance.maybeConfession(async () => {});
        const lovers = s.lovers.slice();
        const loveBefore = s.lovePts.hiyori;
        stats.gainAffinity("hiyori", 10);
        const publicUnchanged = s.lovePts.hiyori === loveBefore;
        s.slot = 1;
        await romance.playDate("hiyori");
        const dateInner = vn.backlog().some((l) => l.name === "ひより" && l.inner?.includes("五分前集合"));
        const friend = QA.fresh(); vn.vnTest.turbo = true;
        friend.met.hiyori = true; friend.contacts.push("hiyori"); friend.affinity.hiyori = 66;
        for (const e of route.hiyoriRoute().events.filter((e) => route.hiyoriRoute().storyEvents.includes(e.id))) friend.flags[e.flag] = true;
        bonds.recordRomanceChoice({ id: "bond_q1_hiyori", romance_char: "hiyori" }, { romance: 0 });
        friend.flags[data.DB.hiyori.route.question.flag] = true; // 共通関係APIの既読fixture。正式Q1の読了は専用テストで通す。
        await bonds.playFinale("hiyori");
        const friendRoute = friend.finales.hiyori.route;
        const noConfession = !friend.flags._confession_due && !romance.romanceRouteOpen("hiyori");
        friend.day += 4;
        const friendLime = bonds.friendMessages().map((m) => m.sender);
        await bonds.playFriendHangout("hiyori");
        const friendInner = vn.backlog().some((l) => l.inner?.includes("会社の電話"));
        return { missing, workTooEarly, beforeEnd, concurrent, replay, stablePts, story, withoutGift, romantic, lovers, publicUnchanged, dateInner, friendRoute, noConfession, friendLime, friendInner };
      } finally {
        data.DB.hiyori = original;
        for (const id of added) {
          if (originals[id]) data.DB.dialogues[id] = originals[id];
          else delete data.DB.dialogues[id];
        }
        vn.vnTest.turbo = false;
      }
    });
    assert.equal(result.missing, "prerequisites");
    assert.equal(result.workTooEarly, false); assert.equal(result.beforeEnd, false);
    assert.equal(result.concurrent, false); assert.equal(result.replay, false); assert(result.stablePts);
    assert.deepEqual(result.story, { count: 4, known: true, contact: true, done: true });
    assert.equal(result.withoutGift, false); assert.equal(result.romantic, "romance");
    assert.deepEqual(result.lovers, ["hiyori"]); assert(result.publicUnchanged && result.dateInner);
    assert.equal(result.friendRoute, "friend"); assert(result.noConfession && result.friendInner);
    assert.deepEqual(result.friendLime, ["hiyori"]);
  });

  await check("chapter conditions and old/new save round-trips", async () => {
    const result = await page.evaluate(() => {
      const { core, route, data } = QA;
      const s = QA.fresh();
      s.met.hiyori = true; s.contacts = ["sumi", "hiyori"]; s.affinity.hiyori = 30;
      s.flags._hiyori_real_self_known = true; s.flags._hiyori_work_talk_done = true;
      s.flags._preserve_other_character = true; s.lovers = ["rin", "hiyori"];
      s.loveLevel = { rin: 3, hiyori: 2 }; s.lovePts = { rin: 33, hiyori: 20 };
      s.romanceChoices.bond_q1_hiyori = { char: "hiyori", value: 1, day: 4 };
      core.saveToSlot("suien_remake_slot2");
      const expected = JSON.stringify(s);
      const automatic = JSON.stringify(core.load()) === expected;
      const manualState = core.loadFromSlot("suien_remake_slot2");
      const manual = manualState.flags._hiyori_real_self_known && manualState.lovePts.rin === 33 && manualState.lovePts.hiyori === 20;
      const original = JSON.parse(JSON.stringify(data.DB.hiyori));
      data.DB.hiyori.route.enabled = true;
      // 台本未執筆の第3〜5章イベントは route.unscriptedEvents に退避中（#1498）。条件判定だけは仮台本で確認する。
      data.DB.hiyori.route.events = [...data.DB.hiyori.route.events, ...(data.DB.hiyori.route.unscriptedEvents || [])];
      const originals = { ...data.DB.dialogues };
      for (const event of route.hiyoriRoute().events) data.DB.dialogues[event.dialogue] = { lines: [{ speaker: "hiyori", text: "条件確認" }] };
      const statuses = [];
      for (const chapter of [1, 2, 3, 4, 5]) {
        core.state.chapter = chapter;
        statuses.push({ chapter, tokyo: route.hiyoriEventStatus("tokyo_contact"), dubai: route.hiyoriEventStatus("dubai_support"),
          lover: route.hiyoriEventStatus("chapter5_lover"), friend: route.hiyoriEventStatus("chapter5_friend"), preserved: !!core.state.flags._hiyori_real_self_known });
      }
      for (const event of route.hiyoriRoute().events) {
        if (originals[event.dialogue]) data.DB.dialogues[event.dialogue] = originals[event.dialogue];
        else delete data.DB.dialogues[event.dialogue];
      }
      data.DB.hiyori = original;
      const old = core.newState(); old.schema = 7; old.affinity.rin = 42; old.money = 12345;
      delete old.romance; delete old.romanceChoices; delete old.finales;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
      const migrated = core.load();
      return { automatic, manual, statuses, old: { money: migrated.money, rin: migrated.affinity.rin,
        hiyoriMet: !!migrated.met.hiyori, hiyoriKnown: !!migrated.flags._hiyori_real_self_known,
        hiyoriRomance: migrated.romance.hiyori || 0, schema: migrated.schema }, schema: core.SCHEMA };
    });
    assert(result.automatic && result.manual);
    assert(result.statuses.every((s) => s.preserved));
    assert.equal(result.statuses[2].tokyo, "ready"); assert.equal(result.statuses[0].tokyo, "chapter");
    assert.equal(result.statuses[3].dubai, "ready"); assert.equal(result.statuses[4].lover, "ready");
    assert.equal(result.statuses[4].friend, "relationship");
    assert.deepEqual(result.old, { money: 12345, rin: 42, hiyoriMet: false, hiyoriKnown: false, hiyoriRomance: 0, schema: result.schema });
  });

  await check("standalone preview preserves every storage key", async () => {
    const before = await page.evaluate(() => {
      localStorage.setItem("hiyori_qa_sentinel", "keep"); sessionStorage.setItem("hiyori_qa_sentinel", "session-keep");
      return { local: { ...localStorage }, session: { ...sessionStorage } };
    });
    await page.goto(new URL("hiyori-preview.html", base).href);
    await page.locator('[data-test="hiyori-preview-gap"]').waitFor();
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true;
    });
    for (const sample of ["gap", "axe", "work", "romance", "lover"]) {
      await page.locator(`[data-test="hiyori-preview-${sample}"]`).click();
      await page.locator('[data-test="hiyori-preview-gap"]').waitFor({ state: "visible" });
    }
    const after = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert.deepEqual(after, before);
  });

  assert.deepEqual(errors, [], "page errors");
  assert.deepEqual([...new Set(missing)], [], "missing assets/data");
} finally {
  fs.writeFileSync(path.join(artifacts, "test-results.json"), JSON.stringify({ results, errors, missing: [...new Set(missing)] }, null, 2) + "\n");
  await browser.close();
}
