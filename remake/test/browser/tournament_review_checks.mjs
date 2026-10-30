import assert from "node:assert/strict";
import { assertFits } from "./support.mjs";

// 本番の結果画面からSAVE→MENUのLOADを通り、同じ記録・助言が復元されることを確かめる。
export async function checkTournamentReview(page, chapter) {
  const t = name => `[data-test="ch${chapter}-tournament-${name}"]`;
  const read = () => page.locator(`${t("craft-review")} p`).allTextContents();
  const snapshot = () => page.evaluate(ch => {
    const s = window.__remake.state;
    return JSON.parse(JSON.stringify({ progress: s.flags[`_ch${ch}_tournament`], money: s.money }));
  }, chapter);
  const before = await snapshot();
  const lines = await read();
  await assertFits(page, `${t("craft-review")} p, ${t("continue")}`);
  assert(await page.locator(t("continue")).evaluate(node => {
    const box = node.closest(".ch2-contest").getBoundingClientRect(), r = node.getBoundingClientRect();
    return r.top >= box.top && r.bottom <= box.bottom;
  }), "Result action fits inside the card even with the longest vote commentary");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^今回よかったこと：/);
  assert.match(lines[1], /^(次に変える一つ|次の練習)：/);
  const reason = await page.locator(t("vote-reason")).textContent();
  const voteLine = await page.locator(`${t("vote-reason")} p`).first().textContent();
  await page.locator(t("menu")).click();
  await page.locator(t("save")).click();
  await page.locator('[data-test="slot-2"]').click();
  await page.locator(t("menu")).click();
  await page.locator(t("load")).click();
  await page.locator('[data-test="slot-2"]').click();
  await Promise.all([
    page.waitForEvent("load"),
    page.locator('[data-test="confirm-load"]').click(),
  ]);
  await page.locator(t("result")).waitFor();
  assert.deepEqual(await read(), lines);
  assert.equal(await page.locator(t("vote-reason")).textContent(), reason);
  assert.deepEqual(await snapshot(), before, "LOAD must not rescore, revote, repay, or change the craft");
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
  });

  const cases = [
    [null, []],
    [{}, []],
    [{ parts: { holes: 0, heat: 0, shisha: 0, care1: 0, care2: 0 } }, []],
    [{ pull: { temp: .54 } }, ["今回よかったこと：適温に整えて提供できた。"]],
    [{ pull: { failed: "cold", temp: .04 } }, ["次に変える一つ：提供は冷え切る前に炭を交換しよう。"]],
  ];
  async function render(craft) {
    await page.evaluate(async ({ chapter, craft }) => {
      const core = await import("./js/core/state.js");
      core.state.flags[`_ch${chapter}_tournament`].craft = craft;
      const mod = await import(`./js/chapters/ch${chapter}-tournament.js`);
      await mod[chapter === 2 ? "runChapterTwoTournament" : "runChapterThreeTournament"]();
    }, { chapter, craft });
    await page.locator(t("result")).waitFor();
  }
  for (const [craft, expected] of cases) {
    await render(craft);
    assert.deepEqual(await read(), expected);
    assert.equal(await page.locator(t("craft-review")).count(), expected.length ? 1 : 0, "Empty review has no heading");
    assert.equal(await page.locator(`${t("vote-reason")} p`).first().textContent(), voteLine);
    const after = await snapshot();
    assert.deepEqual(after, { ...before, progress: { ...before.progress, craft } });
  }
  await render(before.progress.craft);
  assert.deepEqual(await snapshot(), before);
}
