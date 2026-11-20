// セーブの書き出し／読み込み・全画面の案内（#2856）。保存形式は変えず、今の保存内容を包んで往復できること。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { suite } from "./support.mjs";

const SAVED = { day: 9, money: 31415, phase: "daily", slot: 1 };
const KEYS = ["suien_remake_save", "suien_remake_slot1", "suien_remake_gallery", "suien_remake_gallery_progress", "suien_remake_cycle"];

async function seed(page, save = SAVED) {
  await page.evaluate(async (v) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: v.phase, day: v.day, slot: v.slot, money: v.money, seed: 77 });
    core.saveToSlot(core.SAVE_SLOTS[1].key);
    localStorage.setItem("suien_remake_gallery", JSON.stringify(["cg_previous_cycle"]));
    localStorage.setItem("suien_remake_gallery_progress", JSON.stringify({ completeAnnounced: false, clearedChapters: [1, 5],
      keepsakes: ["minto_first_cheki"], purikura: [], routeRecords: {
        tsumugi: { becameLover: true, eventsSeen: [1, "2b"], trueEndAsLover: true } } }));
    localStorage.setItem("suien_remake_cycle", JSON.stringify({ version: 1, unlocked: true,
      trueEnds: [{ cycleId: "previous", cycle: 1, at: "2026-11-10", loversAtEnd: ["tsumugi"] }],
      highestCycleStarted: 2, carryPackage: { fromCycleId: "previous", fromCycle: 1, at: "2026-11-10", data: { money: 50000 } },
      lifetime: { tournamentWins: 1, tournamentAttempts: 3 } }));
  }, save);
}
const openConfig = async (page) => {
  await page.evaluate(async () => { (await import("./js/scenes/title.js")).openConfig(); });
  await page.locator('[data-test="save-export"]').waitFor();
};
const rawOf = (page) => page.evaluate((keys) => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), KEYS);
// 実寸（画面に出た大きさ）が基準を満たすか。ゲーム全体が縮小表示されるので getBoundingClientRect で測る
const assertSizes = async (page, selector) => {
  const sizes = await page.locator(selector).evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(), k = n.offsetHeight ? r.height / n.offsetHeight : 1;
    return { text: n.textContent.trim(), h: r.height, w: r.width, font: parseFloat(getComputedStyle(n).fontSize) * k };
  }));
  assert(sizes.length > 0, `no target ${selector}`);
  for (const s of sizes) assert(s.h >= 38 && s.w >= 38 && s.font >= 11, `too small: ${JSON.stringify(s)}`);
};
const assertReadableDialog = async page => {
  const layout = await page.locator(".xfer-box").evaluate(async box => {
    await Promise.all(box.getAnimations().map(a => a.finished.catch(() => {})));
    const r = box.getBoundingClientRect(), body = box.querySelector(".modal-body");
    const fits = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      && Math.abs(r.left + r.width / 2 - innerWidth / 2) <= 2
      && body.scrollHeight <= body.clientHeight + 1;
    return { fits, rect: r.toJSON(), viewport: [innerWidth, innerHeight], bodyHeight: body.clientHeight, contentHeight: body.scrollHeight };
  });
  assert(layout.fits, `dialog must be centered without clipped text: ${JSON.stringify(layout)}`);
};
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

await suite("save-transfer", async check => {
  await check("shared-link-keeps-saves-separate-and-file-can-move-between-profiles", async page => {
    // 同じ配布URLを開くが、Cookie・localStorage を共有しない二人のブラウザ。
    const url = page.url();
    await seed(page);
    const originBefore = await rawOf(page);
    const other = await page.context().browser().newContext();
    try {
      const recipient = await other.newPage();
      const boot = async p => { await p.locator('[data-test="title-new"]').waitFor({ timeout: 30000 }); };
      await recipient.goto(url);
      await boot(recipient);
      assert.equal((await rawOf(recipient)).suien_remake_save, null);
      const recipientSave = { ...SAVED, day: 4, money: 9876 };
      await seed(recipient, recipientSave);
      const recipientBefore = await rawOf(recipient);
      await page.reload();
      await recipient.reload();
      await boot(page); await boot(recipient);
      assert.deepEqual(await rawOf(page), originBefore);
      assert.deepEqual(await rawOf(recipient), recipientBefore);
      assert.equal(JSON.parse(recipientBefore.suien_remake_save).money, recipientSave.money);

      await openConfig(page);
      await page.locator('[data-test="save-export"]').click();
      const downloadEvent = page.waitForEvent("download");
      await page.locator('[data-test="export-file"]').click();
      const download = await downloadEvent;
      assert.match(download.suggestedFilename(), /^suien-save-\d{8}-\d{6}Z\.txt$/);
      const bytes = await readFile(await download.path());
      assert.match(bytes.toString("utf8"), /^SUIEN-SAVE2:/);

      await openConfig(recipient);
      const pick = async () => {
        await recipient.locator('[data-test="save-import"]').click();
        const chooser = recipient.waitForEvent("filechooser");
        await recipient.locator('[data-test="import-pick"]').click();
        await (await chooser).setFiles({ name: download.suggestedFilename(), mimeType: "text/plain", buffer: bytes });
        await recipient.locator('[data-test="import-go"]').click(); // ファイルを読めるまで非活性
        await recipient.locator('[data-test="import-confirm"]').waitFor();
      };
      await pick();
      assert.match(await recipient.locator(".xfer-slots").textContent(), /4日目 → 9日目/);
      assert.equal(await recipient.evaluate(() => document.activeElement.dataset.test), "import-abort");
      assert.deepEqual(await rawOf(recipient), recipientBefore, "preview must not write to storage");
      await recipient.keyboard.press("Escape");
      assert.deepEqual(await rawOf(recipient), recipientBefore, "Escape must leave the existing save untouched");
      await pick();
      await recipient.evaluate(() => { window.__beforeReload = true; });
      await recipient.locator('[data-test="import-confirm"]').click();
      await recipient.waitForFunction(() => !window.__beforeReload);
      await boot(recipient);
      assert.deepEqual(await rawOf(recipient), originBefore);
      assert.deepEqual(await rawOf(page), originBefore, "the sender's profile must not change");
    } finally {
      await other.close();
    }
  });

  await check("retired-slots-are-ignored-on-transfer", async page => {
    await seed(page);
    const result = await page.evaluate(async () => {
      const xfer = await import("./js/scenes/save-transfer.js");
      const keys = ["suien_remake_slot2", "suien_remake_slot3"];
      const old = keys.map((key, i) => JSON.stringify({ day: 2 + i, money: 100 + i }));
      keys.forEach((key, i) => localStorage.setItem(key, old[i]));
      const exported = xfer.exportSaveText();
      const decode = text => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.slice("SUIEN-SAVE2:".length)), c => c.charCodeAt(0))));
      const packet = decode(exported);
      packet.slots[keys[0]] = old[0]; packet.slots[keys[1]] = old[1];
      const bytes = new TextEncoder().encode(JSON.stringify(packet));
      const legacy = "SUIEN-SAVE2:" + btoa(String.fromCharCode(...bytes));
      const parsed = xfer.parseSaveText(legacy);
      if (!parsed || parsed.length !== 2 || !xfer.applySlots(parsed)) return null;
      return { included: Object.keys(decode(exported).slots),
        retired: keys.map(key => localStorage.getItem(key)), old };
    });
    assert(result);
    assert.deepEqual(result.included.sort(), ["suien_remake_save", "suien_remake_slot1"]);
    assert.deepEqual(result.retired, result.old);
  });

  for (const [label, viewport] of [["844x390", { width: 844, height: 390 }], ["844x340", { width: 844, height: 340 }]]) {
    await check(`roundtrip-and-sizes-${label}`, async page => {
      await seed(page);
      const before = await rawOf(page);
      await openConfig(page);
      await assertSizes(page, '[data-test="save-transfer"] button');
      await page.locator('[data-test="save-export"]').click();
      await assertSizes(page, ".xfer-box .modal-actions button");
      await assertReadableDialog(page);
      const text = await page.locator('[data-test="export-text"]').inputValue();
      assert.match(text, /^SUIEN-SAVE2:/);
      // 往復: 保存を空にしたプロファイルへ読み込むと、同じ内容で再開できる
      await page.locator('[data-test="export-close"]').click();
      await page.evaluate((keys) => keys.forEach(k => localStorage.removeItem(k)), KEYS);
      await page.locator('[data-test="save-import"]').click();
      await page.locator('[data-test="import-text"]').fill(text);
      await page.locator('[data-test="import-go"]').click();
      await page.evaluate(() => { window.__beforeReload = true; });
      await page.locator('[data-test="import-confirm"]').click();
      await page.waitForFunction(() => !window.__beforeReload, null, { timeout: 15000 });
      await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
      assert.deepEqual(await rawOf(page), before);
      const s = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_slot1")));
      assert.equal(s.day, SAVED.day); assert.equal(s.money, SAVED.money);
    }, { viewport, hasTouch: true });

    await check(`save-guide-is-discoverable-${label}`, async page => {
      await page.locator('[data-test="title-config"]').click();
      const row = page.locator("[data-test=save-transfer]");
      assert.equal(await row.evaluate(node => node.parentElement.firstElementChild === node), true);
      await assertSizes(page, '[data-test="save-transfer"] button');
      await page.locator('[data-test="save-transfer-help"]').click();
      const guide = await page.locator('[data-test="save-storage-guide"]').textContent();
      for (const phrase of ["同じ配布リンク", "アカウントは不要", "自動では移りません", "シークレットモード", "ファイルを保存", "ホーム画面版"]) {
        assert(guide.includes(phrase), phrase);
      }
      await assertSizes(page, ".xfer-box .modal-actions button");
      await assertReadableDialog(page);
    }, { userAgent: iphone, viewport, hasTouch: true });
  }

  await check("broken-text-is-rejected-and-save-kept", async page => {
    await seed(page);
    const before = await rawOf(page);
    await openConfig(page);
    const b64 = (o) => "SUIEN-SAVE1:" + Buffer.from(JSON.stringify(o)).toString("base64");
    const bads = ["こわれた文字列", "SUIEN-SAVE1:@@@", "SUIEN-SAVE3:eyJ9",
      b64({ format: "suien-save", version: 1, slots: { suien_remake_slot1: "[1]" } }),
      b64({ format: "suien-save", version: 1, slots: { suien_remake_slot1: JSON.stringify({ day: "三日目" }) } }),
      b64({ format: "suien-save", version: 1, slots: { suien_remake_slot1: JSON.stringify({ day: 3, schema: 99999 }) } })];
    for (const bad of bads) {
      await page.locator('[data-test="save-import"]').click();
      await page.locator('[data-test="import-text"]').fill(bad);
      await page.locator('[data-test="import-go"]').click();
      await page.locator('[data-test="import-error-ok"]').click();
    }
    assert.deepEqual(await rawOf(page), before);
  });

  await check("unreadable-slot-does-not-block-backing-up-other-slot", async page => {
    await seed(page);
    const autoKey = "suien_remake_save", manualKey = "suien_remake_slot1";
    await page.evaluate(key => { localStorage.setItem(key, '{"day":12,"schema":99999}'); }, manualKey);
    const before = await rawOf(page);
    await openConfig(page);
    await page.locator('[data-test="save-export"]').click();
    assert.match(await page.locator(".xfer-box .modal-body").textContent(), /読み取れなかった枠は含みません：スロット 1/);
    const text = await page.locator('[data-test="export-text"]').inputValue();
    const slots = await page.evaluate(async value => (await import("./js/scenes/save-transfer.js")).parseSaveText(value), text);
    assert.deepEqual(slots.map(s => s.key), [autoKey]);
    assert.deepEqual(await rawOf(page), before);
  });

  await check("failed-file-read-cannot-import-an-earlier-paste", async page => {
    await seed(page);
    const before = await rawOf(page);
    const text = await page.evaluate(async () => (await import("./js/scenes/save-transfer.js")).exportSaveText());
    await page.evaluate(() => {
      File.prototype.text = () => new Promise((_, reject) => { window.rejectFileRead = reject; });
    });
    await openConfig(page);
    await page.locator('[data-test="save-import"]').click();
    const input = page.locator('[data-test="import-text"]'), go = page.locator('[data-test="import-go"]');
    await input.fill(text);
    assert(await go.isEnabled());
    await page.locator('[data-test="import-file"]').setInputFiles({
      name: "unreadable.txt", mimeType: "text/plain", buffer: Buffer.from("example"),
    });
    assert(await go.isDisabled());
    assert.equal(await input.inputValue(), "");
    await page.evaluate(() => { window.rejectFileRead(new Error("file unavailable")); });
    await page.getByText("ファイルを読めません。もう一度選んでください。").waitFor();
    assert(await go.isDisabled());
    assert.deepEqual(await rawOf(page), before);
  });

  await check("confirm-cancel-keeps-save", async page => {
    await seed(page);
    await openConfig(page);
    await page.locator('[data-test="save-export"]').click();
    const text = await page.locator('[data-test="export-text"]').inputValue();
    await page.locator('[data-test="export-close"]').click();
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("suien_remake_slot1")); s.money = 1; localStorage.setItem("suien_remake_slot1", JSON.stringify(s)); });
    const before = await rawOf(page);
    await page.locator('[data-test="save-import"]').click();
    await page.locator('[data-test="import-text"]').fill(text);
    await page.locator('[data-test="import-go"]').click();
    await page.locator('[data-test="import-abort"]').click();
    assert.deepEqual(await rawOf(page), before);
  });

  await check("iphone-shows-home-screen-notice", async page => {
    await openConfig(page);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 0);
    await assertSizes(page, '[data-test="a2hs-help"]');
    await page.locator('[data-test="a2hs-help"]').click();
    const t = await page.locator('[data-test="a2hs-notice"]').textContent();
    for (const w of ["ホーム画面に追加", "ツールバーを非表示", "横向きのタブバー", "先にここで「書き出し」"]) assert(t.includes(w), w);
  }, { userAgent: iphone, viewport: { width: 844, height: 390 }, hasTouch: true });

  await check("standalone-hides-notice", async page => {
    await page.evaluate(() => Object.defineProperty(navigator, "standalone", { value: true, configurable: true }));
    await openConfig(page);
    assert.equal(await page.locator('[data-test="a2hs-help"]').count(), 0);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 0);
  }, { userAgent: iphone, viewport: { width: 844, height: 390 }, hasTouch: true });

  await check("desktop-shows-fullscreen-button", async page => {
    await openConfig(page);
    assert.equal(await page.locator('[data-test="fullscreen"]').count(), 1);
    assert.equal(await page.locator('[data-test="a2hs-help"]').count(), 0);
  });

  // #3013: 同じボタンで全画面化／解除の両方ができ、表示名が実状態へ追随すること（Fullscreen API はスタブで切り替える）
  await check("fullscreen-button-toggles", async page => {
    await page.evaluate(() => {
      let fs = null;
      Object.defineProperty(document, "fullscreenElement", { get: () => fs, configurable: true });
      document.documentElement.requestFullscreen = async () => { fs = document.documentElement; document.dispatchEvent(new Event("fullscreenchange")); };
      document.exitFullscreen = async () => { fs = null; document.dispatchEvent(new Event("fullscreenchange")); };
    });
    await openConfig(page);
    const btn = page.locator('[data-test="fullscreen"]');
    assert.equal(await btn.textContent(), "全画面");
    await btn.click();
    await page.waitForFunction(() => document.querySelector('[data-test="fullscreen"]')?.textContent === "全画面を解除");
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), true);
    await btn.click();
    await page.waitForFunction(() => document.querySelector('[data-test="fullscreen"]')?.textContent === "全画面");
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  });

  await check("manifest-is-linked-and-landscape", async page => {
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const m = await page.evaluate(async (h) => (await fetch(h)).json(), href);
    assert.equal(m.display, "fullscreen"); assert.equal(m.orientation, "landscape");
    assert(m.icons.length >= 2);
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute("content"), "yes");
    assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute("content"), "black-translucent");
    assert.equal(await page.locator('link[rel="apple-touch-icon"]').count(), 1);
  });
});

