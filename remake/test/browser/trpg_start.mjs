import assert from "node:assert/strict";

/** Open the story through its cover and finish the optional picture book. */
export async function startTrpgStory(page, keyboard = false) {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const press = test => {
    const button = page.locator(`[data-test="${test}"]`);
    return keyboard ? button.press("Enter") : touch ? button.tap() : button.click();
  };
  await press("trpg-start");
  const pictureBook = page.locator('[data-test="trpg-picturebook"]');
  if (await pictureBook.count()) {
    await press("trpg-picturebook-skip");
    await pictureBook.locator('[data-test="trpg-picturebook-next"]:enabled').waitFor();
    await press("trpg-picturebook-next");
    await pictureBook.waitFor({ state: "detached" });
  }
}

/**
 * ボドゲカフェの本選び（見開きの本・TRP11）: 操作の名前（trpg-play-<本> など）から本を割り出し、その頁までめくる。
 * 本の中の操作ではない名前・すでに開いている本なら何もしない。プレイヤーと同じく、上の見出し（しおり）を押してめくる。
 */
export async function turnToTrpgBook(page, control) {
  const id = /^trpg-(?:play|buy|resume|picturebook|bookmark|memory|book)-(.+)$/.exec(control)?.[1];
  if (!id) return;
  const tab = page.locator(`[data-test="trpg-tab-${id}"]`);
  if (!await tab.count() || await tab.getAttribute("aria-current") === "true") return;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await tab.tap(); else await tab.click();
  await page.locator(`[data-test="trpg-book-${id}"]:not([hidden]):not([data-flip])`).waitFor();
}

/**
 * 本の「遊ぶ」を押した後、卓が開いて、店長の説明（次へ）か表紙（物語をはじめる）が押せるようになるまで待つ。
 * 物語は押してから読み込むので、押した直後に「次へ」が見えるとは限らない（見えないまま表紙を待つと、説明が終わらず止まる）。
 */
export async function waitForTrpgTable(page) {
  await page.locator(".trpg-root.trpg-cinematic").waitFor({ timeout: 30000 });
  await page.locator('[data-test="trpg-next"]:visible, [data-test="trpg-start"]:visible').first().waitFor({ timeout: 30000 });
}

/**
 * 判定を振って、結果の窓（「物語を続ける」）が出るまで進める。
 * スキルはダイス劇場の中で選ぶ（2026-11-27 オーナー決定。横の本編も既定）: 助力を付けられる判定は、振ると劇場の幕の上で「スキルを使う？」、
 * 成功しなかった出目は、評価のあと劇場を閉じずに「振り直す？」。劇場を出せない時（動きを減らす設定）は、今までどおり窓の助力のチェックと結果の札で選ぶ。
 * support: 助力を借りる仲間の id。reroll: 1個目を振り直す。どちらも、選べなければ失敗にする（使えたかは判定の記録でも確かめる）。
 * 指定が無ければ使わずに進む（「使わずに振る」「このまま続ける」）。press(selector) で押し方を替えられる（既定はタッチなら tap、ほかは click）。
 * onChoice(kind) は、劇場の中で選ぶ札が出た時（kind は "aid"／"reroll"）、押す前に呼ぶ（札の見た目や中身を確かめる）。
 * 戻り値: 劇場の中で選ぶ札が出たか { aid, reroll } と、結果の窓が出た時の判定（pending。試遊のページだけ）。
 */
export async function rollTrpgCheck(page, { support = null, reroll = false, press = null, onChoice = null } = {}) {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const push = press || (selector => touch ? page.locator(selector).tap() : page.locator(selector).click());
  const offered = { aid: false, reroll: false };
  const box = `[data-test="trpg-support-${support}"]`, boxed = !!support && await page.locator(box).count() > 0;
  if (boxed) await push(box); // 窓で選ぶ時（動きを減らす設定）
  await push('[data-test="trpg-roll"]');
  for (let n = 0; ; n++) {
    if (n > 600) throw new Error("The roll did not reach its result window");
    const at = await page.evaluate(() => {
      const on = test => [...document.querySelectorAll(`[data-test="${test}"]`)].some(node => node.offsetParent !== null && !node.disabled);
      if (on("trpg-show-support")) return "aid";
      if (on("trpg-show-reroll-0")) return "reroll";
      return on("trpg-settle") && !document.querySelector(".trpg-roll-show") ? "settle" : "";
    });
    if (at === "settle") break;
    if (at === "aid" || at === "reroll") { offered[at] = true; await onChoice?.(at); }
    if (at === "aid") await push(support ? '[data-test="trpg-show-support"]' : '[data-test="trpg-show-nosupport"]');
    else if (at === "reroll") await push(reroll ? '[data-test="trpg-show-reroll-0"]' : '[data-test="trpg-show-keep"]');
    else await page.waitForTimeout(80);
  }
  if (reroll && !offered.reroll) { // 窓で選ぶ時（動きを減らす設定）
    await push('[data-test="trpg-reroll-0"]');
    await page.locator('[data-test="trpg-settle"]:not(:disabled)').waitFor();
  }
  if (support && !boxed && !offered.aid) throw new Error(`${support}'s aid was not offered`);
  const pending = await page.evaluate(() => window.__trpg?.snapshot?.().pending ?? null);
  if (pending && support && pending.helper !== support) throw new Error(`The roll did not use ${support}'s aid: ${JSON.stringify(pending)}`);
  if (pending && reroll && !pending.rerolled) throw new Error("The roll was not rerolled: " + JSON.stringify(pending));
  return { ...offered, pending };
}

/**
 * 劇場の中で選ぶ札（スキルを使う？・振り直す？）が、画面と舞台の中に丸ごと見えて押せ（真ん中を押すとその札に届く）、
 * 字が札の外へはみ出さず、押す所は実寸 44px 以上（スマホ横持ちの 844×390 でも）。
 */
export async function assertTrpgChoiceFits(page, tests) {
  // 札は下から少し跳ねて入ってくる。入り終わってから測る
  await page.evaluate(tests => Promise.all(tests.flatMap(test => document.querySelector(`[data-test="${test}"]`)?.getAnimations().map(a => a.finished) || [])), tests);
  const boxes = await page.evaluate(tests => tests.map(test => {
    const node = document.querySelector(`[data-test="${test}"]`), stage = document.getElementById("stage").getBoundingClientRect();
    if (!node) return { test, missing: true };
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const spill = [...node.querySelectorAll("*")].filter(n => n.getClientRects().length && n.textContent.trim()).some(n => {
      const b = n.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1 || n.scrollWidth > n.clientWidth + 1; });
    return { test, width: Math.round(r.width), height: Math.round(r.height), inside: r.left >= Math.max(0, stage.left) - 1 && r.right <= Math.min(innerWidth, stage.right) + 1
      && r.top >= Math.max(0, stage.top) - 1 && r.bottom <= Math.min(innerHeight, stage.bottom) + 1, reachable: !!hit && node.contains(hit), spill };
  }), tests);
  for (const box of boxes) {
    assert(!box.missing, box.test + " is shown");
    assert(box.inside && box.reachable && !box.spill, "The choice card is whole and reachable: " + JSON.stringify(box));
    assert(box.width >= 44 && box.height >= 44, "The choice card is a 44px target: " + JSON.stringify(box));
  }
}
