// VOL07: 斧投げBar・クラブSEAM・ボドゲカフェで自分の道具を一度だけ買い、ミニゲームの画面で効き目が見える。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
const t = id => `[data-test="${id}"]`;

async function setup(page, values, flags = {}) {
  await page.evaluate(async ({ values, flags }) => {
    window.G = { core: await import("./js/core/state.js"), ui: await import("./js/core/ui.js"), vn: await import("./js/vn/engine.js") };
    const s = G.core.newGame();
    Object.assign(s, { phase: "daily", stamina: 80, ...values });
    Object.assign(s.flags, flags);
    for (const id of ["sumi", "maki", "hiyori", "yoru", "sai"]) { s.met[id] = true; s.flags[`_intro_${id}`] = true; }
    G.core.config.textSpeed = 4; G.core.config.bgmVolume = 0; G.core.config.mute = true;
    G.vn.vnTest.turbo = true;
    G.core.save();
  }, { values, flags });
}
const saved = page => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem(G.core.SAVE_KEY));
  return { money: raw.money, owned: raw.owned };
});

const axePhase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
const axeFlags = { _axe_bar_rumor_done: true, _hiyori_meeting_done: true, _axe_lesson_done: true,
  _axe_bar_sighting_done: true, _axe_bar_sighting_day: 3, _axe_bar_sighting_chapter: 1 };
async function openAxeBar(page) {
  await page.evaluate(async () => {
    G.bar = await import("./js/daily/axe-bar.js"); G.abort = new AbortController();
    G.flow = G.bar.visitAxeBar({ signal: G.abort.signal });
  });
  await page.locator(t("axe-bar-menu")).waitFor();
}
async function axeThrow(page) {
  await axePhase(page, "choice");
  const point = await page.locator('.axe-target').evaluate(node => {
    const p = new DOMPoint(330, 245).matrixTransform(node.getScreenCTM()); return {x:p.x,y:p.y};
  });
  await page.mouse.click(point.x, point.y); await axePhase(page, "power");
  const handle = await page.locator(t('axe-pull-handle')).boundingBox();
  const distance = await page.locator(t('axe-game')).evaluate(node => {
    const rect = node.getBoundingClientRect();
    return Math.max(80, Math.min(180, rect.height * .26));
  });
  assert(handle && distance > 0);
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + distance * .62, {steps:8}); await page.mouse.up();
  await axePhase(page, "result"); await page.locator(t('axe-action') + ':not([disabled])').click();
}

await suite("hobby-gear", async check => {
  await check("axe-bar-hatchet", async page => {
    // 的の絵は Git LFS。取得していない手元でも同じ確認ができるよう、1×1のWebPで代える（絵の中身はこの確認に関係しない）。
    await page.route("**/ui/axe_throw/target_board_watl_c_800.webp", route => route.fulfill({ contentType: "image/webp",
      body: Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64") }));
    await setup(page, { chapter: 1, day: 5, slot: 1, money: 20000 },
      { _axe_bar_rumor_done: true, _hiyori_meeting_done: true, _axe_lesson_done: true });
    await page.evaluate(async () => {
      G.bar = await import("./js/daily/axe-bar.js");
      G.abort = new AbortController();
      G.flow = G.bar.visitAxeBar({ signal: G.abort.signal });
    });
    const buy = page.locator(t("gear-buy-gear_hatchet"));
    await buy.waitFor();
    assert.match(await buy.innerText(), /5,000.*構えの揺れが1割小さい/);
    await buy.click();
    await page.locator(t("gear-owned-gear_hatchet")).waitFor();
    assert.deepEqual(await saved(page), { money: 15000, owned: ["silicone_bowl", "lotos_hagal", "flat_charcoal", "gear_hatchet"] });
    assert.equal(await page.locator(t("gear-buy-gear_hatchet")).count(), 0, "買った後はボタンが消える");
    assert.equal(await page.locator(t("axe-bar-practice")).isDisabled(), false, "残り15,000円で3,000円の3投はできる");
    await page.locator(t("axe-bar-practice")).click();
    await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]')?.dataset.phase === "choice");
    await page.waitForTimeout(350);
    await page.locator('[data-test="axe-action"]:not([disabled])').click();
    await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]')?.dataset.phase === "power");
    await page.waitForFunction(() => /マイ斧で揺れ−10%/.test(document.querySelector('[data-test="axe-steadiness"]')?.textContent || ""));
    await page.evaluate(() => G.abort.abort());
    await page.evaluate(() => G.flow);
    assert.equal((await saved(page)).money, 15000, "途中でやめた3投の代金は払わない");
  });

  await check("axe-upgrade-paid-game-save-load", async page => {
    await setup(page, { chapter: 1, day: 5, slot: 1, money: 30000 }, axeFlags);
    const initialOwned = (await saved(page)).owned;
    await openAxeBar(page);
    await page.locator(t('gear-buy-gear_hatchet')).click();
    assert.equal((await saved(page)).money, 25000);
    await page.locator(t('gear-buy-gear_hatchet_precision')).click();
    assert.equal((await saved(page)).money, 10000);
    assert.equal(await page.locator(t('axe-select-gear_hatchet_precision')).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator(t('gear-buy-gear_hatchet_precision')).count(), 0);
    assert.deepEqual((await saved(page)).owned, [...initialOwned, 'gear_hatchet', 'gear_hatchet_precision']);
    await page.locator(t('axe-bar-practice')).click(); await axePhase(page, 'choice');
    assert.equal(await page.locator(t('axe-game')).getAttribute('data-gear-id'), 'gear_hatchet_precision');
    for (let i = 0; i < 3; i++) await axeThrow(page);
    await axePhase(page, 'summary'); await page.locator(t('axe-action') + ':not([disabled])').click();
    assert.equal(await page.evaluate(() => G.flow), true);
    const finished = await page.evaluate(() => ({money:G.core.state.money,owned:G.core.state.owned,
      records:G.core.state.flags._axe_bar_records}));
    assert.equal(finished.money, 7000, 'one completed game costs exactly 3000 after two purchases');
    assert.equal(finished.records.practice.plays, 1);
    assert.equal(finished.records.career.games, 1);
    assert.equal(finished.records.practice.last.equipment.id, 'gear_hatchet_precision');
    assert.equal(finished.records.practice.last.inputVersion, 'tap-pull-v1');
    assert.equal(finished.records.practice.last.throws.length, 3);
    assert.equal(finished.owned.filter(id => id === 'gear_hatchet').length, 1);
    assert.equal(finished.owned.filter(id => id === 'gear_hatchet_precision').length, 1);
    // visitAxeBar returns the daily-action result; calendar normally owns this final save.
    // Exercise the actual save/load API here, rather than pretending the visitor saves itself.
    const loaded = await page.evaluate(() => {
      G.core.save(); G.core.load();
      return {money:G.core.state.money,owned:G.core.state.owned,records:G.core.state.flags._axe_bar_records};
    });
    assert.deepEqual(loaded, finished);
    await openAxeBar(page);
    assert.equal(await page.locator(t('axe-select-gear_hatchet_precision')).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator(t('gear-buy-gear_hatchet')).count(), 0);
    assert.equal(await page.locator(t('gear-buy-gear_hatchet_precision')).count(), 0);
    await page.locator(t('axe-bar-back')).click(); assert.equal(await page.evaluate(() => G.flow), false);
    assert.equal((await saved(page)).money, 7000, 'viewing owned equipment never charges again');
  });

  await check("legacy-owned-hatchet-keeps-records-and-cost", async page => {
    await setup(page, { chapter: 1, day: 5, slot: 1, money: 12000 }, axeFlags);
    const before = await page.evaluate(() => {
      G.core.state.owned.push('gear_hatchet');
      G.core.state.flags._axe_bar_records = { practice: { plays: 2,
        best: { chapter: 1, day: 3, total: 22, maximum: 22, ruleset: 'watl-2026-lounge', throws: [] } } };
      G.core.save();
      const old = {money:G.core.state.money,owned:[...G.core.state.owned],records:structuredClone(G.core.state.flags._axe_bar_records)};
      G.core.load(); return old;
    });
    await openAxeBar(page);
    assert.equal(await page.locator(t('gear-buy-gear_hatchet')).count(), 0);
    assert.equal(await page.locator(t('axe-select-gear_hatchet')).getAttribute('aria-pressed'), 'true');
    await page.locator(t('axe-bar-practice')).click(); await axePhase(page, 'choice');
    assert.equal(await page.locator(t('axe-game')).getAttribute('data-gear-id'), 'gear_hatchet');
    await page.evaluate(() => G.abort.abort()); assert.equal(await page.evaluate(() => G.flow), false);
    const after = await page.evaluate(() => ({money:G.core.state.money,owned:G.core.state.owned,records:G.core.state.flags._axe_bar_records}));
    assert.deepEqual(after, before, 'legacy ownership and old scores survive actual load and interrupted play');
  });

  await check("club-headphones", async page => {
    await setup(page, { chapter: 3, day: 3, slot: 1, money: 30000 }, { _club_yoru_first_done: true });
    await page.evaluate(async () => {
      G.club = await import("./js/daily/dj-club.js");
      G.abort = new AbortController();
      G.flow = G.club.visitDjClub({ signal: G.abort.signal });
    });
    const buy = page.locator(t("gear-buy-gear_headphones"));
    await buy.waitFor();
    assert.match(await buy.innerText(), /22,000.*▶の判定が前後10ミリ秒広い/);
    await buy.click();
    await page.locator(t("gear-owned-gear_headphones")).waitFor();
    assert.equal((await saved(page)).money, 8000);
    await page.locator(t("dj-set-1")).click();
    const frame = page.locator(t("dj-frame"));
    await frame.waitFor();
    assert.equal(new URL(await frame.getAttribute("src")).searchParams.get("phones"), "1");
    const inside = page.frameLocator(t("dj-frame"));
    await inside.locator("#set-gear").waitFor();
    assert.equal(await inside.locator("#set-gear").innerText(), "ヘッドホン：▶の判定が10ms広い");
    await page.evaluate(() => G.abort.abort());
    await page.evaluate(() => G.flow);
  });

  await check("trpg-dice-and-status", async page => {
    await setup(page, { chapter: 2, day: 6, slot: 1, money: 10000 });
    await page.evaluate(async () => {
      const s = G.core.state;
      s.trpg.club.founded = { chapter: 2, day: 2 };
      G.core.save();
      const [{ mountTrpgCampaign }, { el }] = await Promise.all([import("./js/trpg/campaign-view.js"), import("./js/core/util.js")]);
      G.host = el("section.trpg-screen");
      G.ui.showScreen("trpg", G.host);
      G.view = mountTrpgCampaign(G.host, { getState: () => G.core.state, save: G.core.save });
    });
    const buy = page.locator(t("gear-buy-gear_dice"));
    await buy.waitFor();
    await buy.click();
    await page.locator(`${t("trpg-gear")} ${t("gear-owned-gear_dice")}`).waitFor();
    assert.match(await page.locator(t("trpg-campaign-notice")).innerText(), /マイダイス.*盛り上がりが1から始まる/);
    const after = await saved(page);
    assert.equal(after.money, 6200);
    assert.equal(after.owned.filter(id => id === "gear_dice").length, 1);
    // ステータスの所持品に「遊びの道具」として出る（シーシャの機材とは別）。
    await page.evaluate(async () => {
      G.view.destroy();
      const { openStatus } = await import("./js/daily/status.js");
      G.status = openStatus();
    });
    await page.locator('.st-tab[data-tab="items"]').click();
    assert.match(await page.locator(t("status-hobby-gear")).innerText(), /マイダイス.*盛り上がりが1から始まる/s);
  });
});
