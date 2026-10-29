// New-game UI measurement. Never inject day, affinity, story, flags, or lovers.
// PACE_TARGET=rin|tsumugi|minto PACE_MODE=fast|usual|friend|hold|boost|fortune PACE_TOUCH=1
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("./browser/package.json", import.meta.url))("playwright");
import { installLoadingComicReader } from "./browser/loading_reader.mjs";
const target = process.env.PACE_TARGET || "rin", mode = process.env.PACE_MODE || "fast", touch = process.env.PACE_TOUCH === "1";
assert(["rin", "tsumugi", "minto"].includes(target)); assert(["fast", "usual", "friend", "hold", "boost", "fortune"].includes(mode));
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const dir = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/relationship-pace"); fs.mkdirSync(dir, { recursive: true });
const label = `${target}-${mode}-${touch ? "touch" : "pc"}`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 },
  isMobile: touch, hasTouch: touch, reducedMotion: "reduce" });
const page = await context.newPage(); page.setDefaultTimeout(20000);
await installLoadingComicReader(page);
const errors = []; page.on("pageerror", e => errors.push(e.message));
const actions = [], snapshots = []; let currentThread = null, lastKey = "", lastProgress = Date.now();
async function press(selector) {
  const node = page.locator(selector).first();
  if (!await node.count() || !await node.isVisible() || !await node.isEnabled()) return false;
  try { if (touch) await node.tap({ timeout: 1500 }); else await node.click({ timeout: 1500 }); return true; }
  catch { return false; } // A changing screen can retire an optional control before input.
}
try {
  await page.goto(base); await page.locator('[data-test="title-new"]').waitFor();
  await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
  await press('[data-test="title-new"]'); await page.locator("#vn.active").waitFor();
  await page.evaluate(async ({ target, mode }) => {
    window.P = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      spots: await import("./js/daily/spots.js"), hours: await import("./js/daily/spot-hours.js"), vn: await import("./js/vn/engine.js"), events: [], choices: [], ranks: {}, held: false };
    const enter = P.vn.hooks.onEnter, choose = P.vn.hooks.onChoice;
    P.vn.hooks.onEnter = (id, dlg) => { enter?.(id, dlg); P.events.push({ id, day: P.core.state.day, slot: P.core.state.slot }); };
    P.vn.hooks.onChoice = (...args) => { choose?.(...args); P.choices.push({ scene: args[0], choice: args[1], branch: args[2], next: args[3], text: args[4]?.text, day: P.core.state.day }); };
    P.vn.vnTest.choose = (scene, labels) => {
      if (scene === "remake_fortune_pick_live") return Math.max(0, labels.findIndex(t => ({ rin: /凛/, tsumugi: /つむぎ/, minto: /みんと|栞/ })[target].test(t)));
      if (mode === "friend" && scene === `ch1_${target}_bond_question`) return 1;
      if (mode === "hold" && scene === `remake_confession_gate_${target}` && !P.held) { P.held = true; return 1; }
      return 0;
    };
    // UI preference only; game state/seed and relationship parameters stay untouched.
    P.core.config.textSpeed = 4;
  }, { target, mode });
  const deadline = Date.now() + 12 * 60000;
  for (;;) {
    assert(Date.now() < deadline, "Pace run exceeded 12 minutes");
    const snap = await page.evaluate(target => {
      const s = P.core.state, liveMap = document.querySelector(".map:not(.done)");
      const level = P.stats.affinityLevel(target);
      if (s.met[target] && P.ranks.met == null) P.ranks.met = s.day;
      for (const n of [3, 4, 5]) if (level >= n && P.ranks[`heart${n}`] == null) P.ranks[`heart${n}`] = s.day;
      if (s.finales[target] && P.ranks.finale == null) P.ranks.finale = s.finales[target].day;
      if (s.lovers.includes(target) && P.ranks.lover == null) P.ranks.lover = s.loverSince[target];
      return { screen: document.body.dataset.screen, vn: !!document.querySelector("#vn.active"),
        phone: !!document.querySelector(".phone-overlay"), modal: document.querySelector("#modal").classList.contains("show"),
        live: !!document.querySelector("#screen > *:not(.done)"), map: !!liveMap,
        day: s.day, slot: s.slot, phase: s.phase, money: s.money, stamina: s.stamina,
        stats: s.stats, points: s.affinity[target] || 0, level, story: s.story[target] || 0, finale: s.finales[target] || null,
        lover: s.lovers.includes(target), ranks: { ...P.ranks }, visited: s.visitedDay[target] === s.day,
        // 2F (Rin) follows the game rule: night only, not on her away day, once per day.
        rinClosed: !!P.hours.rinUnavailable(s),
        met: !!s.met[target], fortuneDay: s.fortuneDay ?? null,
        visitedTsumugi: s.visitedDay.tonari_customer === s.day, baito: s.visitedDay.tonari_baito === s.day,
        sub: document.querySelector(".sub-title")?.textContent || "",
        targetNight: ["tsumugi", "minto"].includes(target) && s.story[target] >= (target === "tsumugi" ? 4 : 5) && P.spots.hasNewStory(target) === false,
      };
    }, target);
    const key = JSON.stringify([snap.screen, snap.day, snap.slot, snap.phone, snap.modal, snap.vn, snap.sub, snap.story, snap.points]);
    if (key !== lastKey) { lastKey = key; lastProgress = Date.now(); }
    if (Date.now() - lastProgress > 45000) throw Error(`UI stalled: ${key}`);
    if (snap.map && !snap.vn && !snap.modal) {
      if (!snapshots.some(x => x.day === snap.day && x.slot === snap.slot)) {
        snapshots.push(snap); console.log(`[${label}] DAY${snap.day}/${snap.slot} pts=${snap.points} heart=${snap.level} story=${snap.story} charm=${snap.stats.charm}`);
      }
      if (snap.lover || mode === "friend" && snap.finale?.route === "friend") break;
    }
    if (snap.day >= 14 || snap.phase === "tournament" || snap.phase === "cleared") break;
    if (snap.phone) {
      const replies = page.locator('.lime-reply[data-test^="reply-"]:not([disabled])');
      if (await replies.count()) {
        const invitation = await page.locator('[data-test="reply-2"]').count();
        const otherInvite = invitation && currentThread !== target;
        await press(otherInvite ? '[data-test="reply-1"]' : '.lime-reply[data-test^="reply-"]:not([disabled])');
      } else {
        const own = page.locator(`[data-test="lime-chat-${target}"]`).first();
        // The "雑談" tag only labels a chat thread; only unread rows and open "誘い" invitations need a visit.
        const ownUnread = await own.count() && await own.evaluate(n => n.classList.contains("unread") || n.querySelector(".lcr-tag")?.textContent === "誘い");
        if (ownUnread) { currentThread = target; await press(`[data-test="lime-chat-${target}"]`); }
        else if (await page.locator(".lime-chat-row.unread").count()) {
          currentThread = (await page.locator(".lime-chat-row.unread").first().getAttribute("data-test")).replace("lime-chat-", "");
          await press(".lime-chat-row.unread");
        } else if (await press('[data-test="phone-next"]')) currentThread = null;
        else if (await press('[data-test="phone-close"]')) currentThread = null;
      }
      await page.waitForTimeout(70); continue;
    }
    if (snap.modal) {
      if (!await press('[data-test="reel-intro"]') && !await press('[data-test="drill-finish"]')
        && !await press('[data-test="kuji-reveal"]')) await press("#modal .modal-actions button");
      await page.waitForTimeout(70); continue;
    }
    if (snap.vn || !snap.live) { await page.waitForTimeout(70); continue; }
    if (snap.screen === "map") {
      if (await page.locator('[data-test="map-guide"]').count()) {
        await press(".spot-pin.guide"); await press('[data-test="map-go"]'); continue;
      }
      if (await press('[data-test="coach-lime"]')) continue;
      if (await page.locator(".hud-lime.has").count()) { await press('[data-test="hud-phone"]'); continue; }
      if (mode === "fortune" && snap.met && snap.fortuneDay !== snap.day && snap.money >= 6000
        && await page.locator('[data-test="pin-fortune"]:not(.off)').count()) {
        actions.push({ day: snap.day, slot: snap.slot, action: "fortune", points: snap.points });
        await press('[data-test="pin-fortune"]'); await press('[data-test="map-go"]'); continue;
      }
      const visited = target === "tsumugi" ? snap.visitedTsumugi : snap.visited;
      const pin = target === "rin" ? "shop" : target === "tsumugi" ? "tonari" : target;
      const available = (target !== "rin" || !snap.rinClosed) && !!await page.locator(`[data-test="pin-${pin}"]:not(.off)`).count();
      let action = !visited && available && !snap.targetNight && (mode !== "usual" || snap.day % 2 === 0) ? target : "rest";
      if (snap.stamina < 30) action = "rest";
      if (action === "rest" && snap.stamina >= 38 && !snap.baito && snap.money < 7000) action = "baito";
      if (action === "rest" && mode === "boost" && snap.stamina >= 38 && snap.money >= 5000
        && await page.locator('[data-test="pin-choizap"]:not(.off)').count()) action = "choizap";
      actions.push({ day: snap.day, slot: snap.slot, action, points: snap.points });
      const dest = action === "baito" ? "tonari" : action === target ? pin : action;
      await press(`[data-test="pin-${dest}"]`); await press('[data-test="map-go"]');
      if (action === "tsumugi" || action === "baito") {
        await page.locator('[data-test="tonari-baito"]').waitFor();
        await press(`[data-test="tonari-${action === "baito" ? "baito" : "customer"}"]`);
      }
      continue;
    }
    if (snap.screen === "shop-entry") {
      if (actions.at(-1)?.action === "rin" && await press('[data-test="shop-upstairs"]')) continue;
      await press('[data-test="shop-enter"]'); continue;
    }
    if (snap.screen === "shop") {
      if (await page.locator(".shop-errand:not(.done)").count()) {
        await press('.shop-row.errand [data-test^="buy-"]');
        await press('[data-test="shop-checkout"]');
      }
      await press('[data-test="shop-leave"]'); continue;
    }
    if (snap.screen === "tonari") {
      if (snap.sub.includes("シフト上がり")) await press('[data-test="after-none"]');
      else await press('[data-test="sub-back"]');
      continue;
    }
    if (snap.screen === "preparation") { await press('[data-test="prep-flavor-blueberry"]'); continue; }
    await page.waitForTimeout(70);
  }
  const measured = await page.evaluate(target => ({ state: structuredClone(P.core.state), ranks: P.ranks,
    events: P.events, choices: P.choices, saved: JSON.parse(localStorage.getItem(P.core.SAVE_KEY)),
    affinityGate: P.stats.affinityGateWaiting(target) }), target);
  assert.deepEqual(errors, []);
  assert(measured.ranks.met != null, "Target was never met through the game");
  if (measured.ranks.lover != null) {
    assert(measured.state.finales[target]); assert(measured.saved.lovers.includes(target));
    assert.equal(measured.saved.loverSince[target], measured.state.loverSince[target]);
  }
  await page.screenshot({ path: path.join(dir, `${label}.png`) });
  fs.writeFileSync(path.join(dir, `${label}.json`), JSON.stringify({ label, base, mode, target, touch,
    acceleration: "vnTest.turbo and craftTest.auto=good; no relationship/day/seed injections", actions, snapshots, ...measured, errors }, null, 2) + "\n");
  console.log(`[${label}] PASS measurement ${JSON.stringify(measured.ranks)} route=${measured.state.finales[target]?.route || "not reached"}`);
} catch (error) {
  await page.screenshot({ path: path.join(dir, `${label}-failed.png`) }).catch(() => {});
  throw error;
} finally { await browser.close(); }
