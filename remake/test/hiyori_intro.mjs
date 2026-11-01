// 本番の相席台本で、名乗り後の紹介・画像・PC/スマホ・既読保存を確認する。
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite } from "./browser/support.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const artifacts = path.resolve(root, process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");

await suite("hiyori-intro", async (check) => {
  for (const [label, options] of [
    ["desktop", {}],
    ["mobile", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["reduced-motion", { reducedMotion: "reduce" }],
  ]) {
    await check(label, async (page) => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), { DB, displayName } = await import("./js/core/data.js");
        const vn = await import("./js/vn/engine.js"), daily = await import("./js/daily/hiyori.js");
        const spots = await import("./js/daily/spots.js");
        const s = core.newGame();
        s.flags._axe_bar_legacy_access = true; // #577: 従来の初対面・紹介回帰は旧保存の導線
        Object.assign(s, { phase: "daily", day: 4, money: 90000, seed: 131 });
        core.config.textSpeed = 4;
        window.I = { core, DB, vn, daily, spots, displayName, seen: [] };
        new MutationObserver(rs => rs.forEach(r => r.addedNodes.forEach(n => {
          if (n.classList?.contains("cutin")) I.seen.push(n.dataset.char);
        }))).observe(document.querySelector("#fx"), { childList: true });
        I.meeting = daily.visitHiyoriAtShop(spots.spotById("naru"), { bg: spots.bgRef(spots.VISIT_BG.naru) });
      });
      await page.waitForSelector("#vn.active .vn-next.show");
      const before = await page.evaluate(() => ({ name: I.displayName("hiyori", I.core.state), seen: I.seen }));
      assert.deepEqual(before, { name: "？？？", seen: [] });
      await page.keyboard.down("Control");
      await page.waitForSelector('.cutin.in[data-char="hiyori"]');
      await page.keyboard.up("Control");
      await page.waitForTimeout(1600);
      const cutin = await page.evaluate(() => {
        const host = document.querySelector('.cutin[data-char="hiyori"]');
        const stage = document.querySelector("#stage").getBoundingClientRect();
        const inside = n => {
          const r = n.getBoundingClientRect();
          return r.left >= stage.left - 1 && r.right <= stage.right + 1 &&
            r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 &&
            r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
        };
        return {
          canonical: I.DB.characters.hiyori.name, reading: I.DB.characters.hiyori.reading,
          known: I.core.state.met.hiyori, flag: I.core.state.flags._intro_hiyori,
          name: host.querySelector(".ci-name").textContent,
          title: host.querySelector(".ci-title").textContent,
          quote: host.querySelector(".ci-line").textContent,
          loaded: [...host.querySelectorAll("img")].every(n => n.complete && n.naturalWidth > 0),
          background: host.querySelector(".ci-art-background").src,
          portrait: host.querySelector(".ci-portrait").src,
          fits: [".ci-title", ".ci-name", ".ci-line"].every(sel => inside(host.querySelector(sel))),
          animations: host.getAnimations({ subtree: true }).filter(a => a.playState === "running").length,
          seen: I.seen,
        };
      });
      assert.equal(cutin.canonical, "朝霧ひより"); assert.equal(cutin.reading, "あさぎり ひより");
      assert(cutin.known && cutin.flag && cutin.loaded && cutin.fits);
      assert.equal(cutin.name, "ひより"); assert.equal(cutin.title, "儚げな元スタッフ");
      assert.equal(cutin.quote, "「……煙みたいに、もう遠い昔だけどね」");
      assert(cutin.background.endsWith("/img/ui/character_intros/graphic/bg_hiyori.webp"));
      assert(cutin.portrait.endsWith("/img/ui/character_intros/graphic/hiyori.webp"));
      assert.deepEqual(cutin.seen, ["hiyori"]);
      assert(label === "reduced-motion" ? cutin.animations === 0 : cutin.animations > 0);
      await page.screenshot({ path: path.join(artifacts, `hiyori-intro-${label}-cutin.png`) });
      await page.locator(".cutin").click(); await page.keyboard.press("Enter");
      assert.equal(await page.locator('.cutin:not(.out)').count(), 1);
      await page.locator(".cutin").waitFor({ state: "detached" });
      await page.keyboard.down("Control"); await page.evaluate(() => I.meeting); await page.keyboard.up("Control");
      const saved = await page.evaluate(() => {
        I.core.save(); I.core.load();
        return { name: I.displayName("hiyori", I.core.state), intro: I.core.state.flags._intro_hiyori,
          done: I.core.state.flags._hiyori_meeting_done };
      });
      assert.deepEqual(saved, { name: "ひより", intro: true, done: true });
      // 実台本を再生しても、既読の紹介は二度出ない。
      await page.evaluate(() => { I.replay = I.vn.play("hiyori_meeting"); });
      await page.keyboard.down("Control"); await page.evaluate(() => I.replay); await page.keyboard.up("Control");
      assert.deepEqual(await page.evaluate(() => I.seen), ["hiyori"]);
    }, options);
  }
});
