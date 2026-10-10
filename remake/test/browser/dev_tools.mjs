// Select only tools implemented on the served branch. Missing requested tools fail.
import assert from "node:assert/strict";
import { suite, storageSnapshot } from "./support.mjs";

const arg = process.argv.slice(2);
assert(arg.length <= 1 && (!arg.length || arg[0].startsWith("--tools=")), "Usage: node dev_tools.mjs [--tools=inspect,preview,rehearsal]");
const selected = new Set((arg[0]?.slice("--tools=".length) || "inspect,preview,rehearsal").split(","));
assert([...selected].every(tool => ["inspect", "preview", "rehearsal"].includes(tool)), "Unknown developer tool");

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const vn = await import("./js/vn/engine.js");
    core.newGame(); core.state.flags._qa_preserved = true; core.state.stats.charm = 19;
    core.save();
    for (const slot of core.SAVE_SLOTS.filter(slot => !slot.auto)) core.saveToSlot(slot.key);
    localStorage.setItem(core.CONFIG_KEY, JSON.stringify({ textSpeed: 4, bgmVolume: 0.2 }));
    localStorage.setItem("qa_unrelated", "keep"); sessionStorage.setItem("qa_unrelated", "keep");
    const payload = '<img src="x" onerror="parent.__qaExecuted=true"></script><script>parent.__qaExecuted=true</script>';
    __remake.DB.dialogues.qa_browser = {
      dialogue_id: "qa_browser", metadata: { set_flag: "_qa_must_not_apply", set_romance: "mashiro", reward: { charm: 99 } },
      lines: [
        { speaker: "hajime", text: payload },
        { type: "choice", choices: [{ text: "分岐A", next: "a" }, { text: "分岐B", next: "b" }] },
        { text: "合流" },
      ],
      branches: {
        a: [{ text: "Aの台詞" }, { type: "apply", stats: { charm: 99 }, flags: { _qa_must_not_apply: true } }],
        b: [{ text: "Bの台詞" }],
      },
    };
    __remake.DB.dialogues.qa_jump = { dialogue_id: "qa_jump", lines: [
      { type: "choice", choices: [{ text: "別イベントへ", next_id: "qa_target" }] },
    ] };
    __remake.DB.dialogues.qa_target = { dialogue_id: "qa_target", lines: [{ text: "移動してはいけない" }] };
    const QA = window.QA = { payload, writes: [], hooks: 0,
      state: JSON.stringify(core.state), dialogues: JSON.stringify(__remake.DB.dialogues) };
    vn.hooks.onLine = () => QA.hooks++;
    vn.hooks.onChoice = () => QA.hooks++;
    for (const method of ["setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        QA.writes.push({ storage: this === localStorage ? "local" : "session", method, key: args[0] });
        return original.apply(this, args);
      };
    }
  });
  return storageSnapshot(page);
}

async function preserved(page, before) {
  assert.deepEqual(await storageSnapshot(page), before, "Developer tool changed browser storage");
  const result = await page.evaluate(() => ({
    state: QA.state === JSON.stringify(__remake.state),
    dialogues: QA.dialogues === JSON.stringify(__remake.DB.dialogues),
    writes: QA.writes, hooks: QA.hooks, executed: !!window.__qaExecuted,
  }));
  assert.deepEqual(result, { state: true, dialogues: true, writes: [], hooks: 0, executed: false });
}

async function rehearsal(page, id = "qa_browser") {
  await page.evaluate(id => { assertTool("rehearsal"); __remake.rehearsal.open(id); }, id);
  const element = page.locator('iframe[title="隔離イベント試写（本番エンジンではありません）"]');
  await element.waitFor();
  const frame = await (await element.elementHandle()).contentFrame();
  await frame.locator("#title").filter({ hasText: id }).waitFor();
  return frame;
}

await suite("dev-tools", async check => {
  // Assertion lives in the test page; public API exposure is part of the check.
  async function ready(page) {
    await page.evaluate(() => {
      window.assertTool = name => {
        if (!__remake[name]) throw new Error(`Requested developer tool is unavailable: ${name}`);
      };
    });
    return prepare(page);
  }

  if (selected.has("inspect")) await check("inspector-copy-and-storage", async page => {
    const before = await ready(page);
    const result = await page.evaluate(() => {
      assertTool("inspect");
      const inspector = __remake.inspect;
      const snapshot = inspector.snapshot();
      snapshot.flags._qa_preserved = false; snapshot.stats.charm = 100; snapshot.lovers.push("rin");
      const info = inspector.eventInfo("qa_browser"); info.metadata.reward.charm = 100;
      return { ids: inspector.events("QA_BROWSER"), zero: inspector.events("", 0),
        missing: inspector.eventInfo("qa_missing"), lines: info.lines,
        charm: inspector.eventInfo("qa_browser").metadata.reward.charm,
        exported: JSON.parse(inspector.exportSnapshot()).flags._qa_preserved,
        production: inspector.events("ch1_").length };
    });
    assert.deepEqual(result.ids, ["qa_browser"]); assert.deepEqual(result.zero, []);
    assert.equal(result.missing, null); assert.equal(result.lines, 3); assert.equal(result.charm, 99);
    assert(result.exported && result.production > 0);
    await preserved(page, before);
  });

  if (selected.has("preview")) await check("preview-literal-text-and-lifecycle", async page => {
    const before = await ready(page);
    const result = await page.evaluate(() => { assertTool("preview"); return __remake.preview.open("qa_browser"); });
    assert.deepEqual(result, { id: "qa_browser", lines: 3, branches: ["a", "b"] });
    const dialog = page.getByRole("dialog", { name: "開発用イベント台本プレビュー" });
    assert((await dialog.textContent()).includes(await page.evaluate(() => QA.payload)));
    assert.equal(await dialog.locator("img, script").count(), 0);
    assert((await dialog.textContent()).includes("Bの台詞"));
    const missing = await page.evaluate(() => {
      try { __remake.preview.open("qa_missing"); return null; } catch (error) { return error.message; }
    });
    assert.match(missing, /Unknown dialogue ID/);
    await page.evaluate(() => __remake.preview.open("ch1_opening"));
    assert.equal(await dialog.count(), 1);
    assert((await dialog.textContent()).includes("夕方のtonari。"));
    await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.evaluate(() => { __remake.preview.close(); __remake.preview.close(); });
    assert.equal(await dialog.count(), 0);
    await preserved(page, before);
  });

  if (selected.has("rehearsal")) {
    await check("rehearsal-choices-restart-and-effects", async page => {
      const before = await ready(page);
      const frame = await rehearsal(page);
      assert.equal(await frame.locator("#text").textContent(), await page.evaluate(() => QA.payload));
      assert.equal(await frame.locator("#text img, #text script").count(), 0);
      await frame.locator("#next").click();
      assert(await frame.locator("#next").isDisabled());
      await frame.getByRole("button", { name: "分岐A", exact: true }).click();
      assert.equal(await frame.locator("#text").textContent(), "Aの台詞");
      await frame.locator("#next").click();
      assert.equal(await frame.locator("#text").textContent(), "【apply】");
      await frame.locator("#next").click();
      assert.equal(await frame.locator("#text").textContent(), "合流");
      await frame.locator("#next").click();
      assert.equal(await frame.locator("#text").textContent(), "試写終了");
      assert(await frame.locator("#next").isDisabled());
      await frame.locator("#restart").click(); await frame.locator("#next").click();
      await frame.getByRole("button", { name: "分岐B", exact: true }).click();
      assert.equal(await frame.locator("#text").textContent(), "Bの台詞");
      await preserved(page, before);
    });

    await check("rehearsal-cross-event-is-a-notice", async page => {
      const before = await ready(page);
      const frame = await rehearsal(page, "qa_jump");
      await frame.getByRole("button", { name: "別イベントへ", exact: true }).click();
      assert.equal(await frame.locator("#text").textContent(), "次のイベント: qa_target（試写では移動しません）");
      await frame.locator("#next").click();
      assert.equal(await frame.locator("#text").textContent(), "試写終了");
      await preserved(page, before);
    });

    await check("rehearsal-opaque-origin-and-lifecycle", async page => {
      const before = await ready(page);
      const frame = await rehearsal(page);
      assert.equal(await page.locator("iframe").getAttribute("sandbox"), "allow-scripts");
      const access = await frame.evaluate(() => {
        const read = fn => { try { fn(); return "allowed"; } catch (error) { return error.name; } };
        return { parentDocument: read(() => parent.document), parentState: read(() => parent.__remake.state),
          parentStorage: read(() => parent.localStorage), ownStorage: read(() => localStorage.getItem("suien_remake_save")),
          ownSession: read(() => sessionStorage.getItem("qa_unrelated")) };
      });
      for (const [name, value] of Object.entries(access)) assert.equal(value, "SecurityError", name);
      await page.evaluate(() => __remake.rehearsal.open("ch1_opening"));
      assert.equal(await page.locator("iframe").count(), 1);
      const production = await (await page.locator("iframe").elementHandle()).contentFrame();
      await production.locator("#text").filter({ hasText: "夕方のtonari。" }).waitFor();
      const missing = await page.evaluate(() => {
        try { __remake.rehearsal.open("qa_missing"); return null; } catch (error) { return error.message; }
      });
      assert.match(missing, /Unknown dialogue ID/);
      await page.evaluate(() => { __remake.rehearsal.close(); __remake.rehearsal.close(); });
      assert.equal(await page.locator("iframe").count(), 0);
      await preserved(page, before);
    });
  }
});
