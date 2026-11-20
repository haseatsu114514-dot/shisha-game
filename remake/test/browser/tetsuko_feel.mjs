// てつこといっしょの手応え（docs/spec/tetsuko_time.md §10・2026-11-11）。実UIで次を確かめる:
// - 触らなくても、数秒で頭の上におねだりの吹き出しが出て、応えられる道具が知らされる
// - なでる場所で反応が変わる。しっぽは触らせてくれないが、ごきげんは減らない。擬音が猫のそばに出る
// - じゃらしは 3 回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ
// - ごきげんのハートは来訪をまたいで溜まる（§11・#3779）。1回の来訪ではハート1つ分まで: 色々お世話して、その回の分が溜まると
//   「とっておき」が出て「今日は、もう満足らしい」。ハートは減らない。初めて5つそろうと、とっておきと「ハートが5つそろった」を出し、
//   確定で一度だけ "tetsuko-hearts" を知らせる。溜まったハートとかずは結果と記録に残る
// - 触らずに眺めているだけでも、隣で見守ったことになる（「そっと見守る」「止める」のボタンは無い）
// 本編の入口・確定（回復12・来訪1回）は ch3_tokyo_daily.mjs、専用テーマと基本画面の文字は tetsuko_theme.mjs が見る。
// ここは画面を直接開く（本編の道のりを通らない短い検査）。確定は、同じ確定点 settleTetsukoTime をページの中で呼んで確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
// 開いた直後の自律行動（おねだり・見つけたしぐさ）が落ち着くのを少し待つ（ごきげんの数え方は変えない）。
const settle = page => page.waitForTimeout(300);

// 懐いた後（来訪5回＝気を許す段階）のセーブで、ふれあいの画面を直接開く。結果は window.__tetsukoResult に入る。
// again は前の回のセーブのまま、次の日にもう一度開く（確定した記録・溜まったハートを持ち越す）。
async function open(page, { visits = 5, record = { sessions: 3, peaks: 3 }, again = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ visits, record, again }) => {
    const core = await import("./js/core/state.js");
    const data = await import("./js/core/data.js");
    const time = await import("./js/minigames/tetsuko-time.js");
    const value = again ? window.__tetsukoValue : core.newState();
    if (again) value.day += 1;
    else {
      Object.assign(value, { chapter: 3, phase: "daily", day: 36, slot: 1 });
      value.met = { ...(value.met || {}), mashiro: true, mukai_master: true };
      value.flags = { ...(value.flags || {}), _ch3_outings: { tetsuko: visits }, _tetsuko_time: record };
    }
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
    window.__tetsukoValue = value;
    window.__tetsukoResult = null;
    time.openTetsukoTime({ value, visitKey: time.tetsukoVisitKey(value), bg: data.sceneBg?.("bg_street", "night")?.url || null })
      .then(result => { window.__tetsukoResult = result; });
  }, { visits, record, again });
  const screen = page.locator(dt("tetsuko-time-screen"));
  await screen.waitFor();
  return screen;
}
// 帰って、結果を同じ確定点で確定する（本編の呼び出し側と同じ順）。
async function leaveAndSettle(page) {
  await page.locator(dt("tetsuko-time-back")).click();
  await page.waitForFunction(() => window.__tetsukoResult, null, { timeout: 30000 });
  return await page.evaluate(async () => {
    const time = await import("./js/minigames/tetsuko-time.js");
    const settled = time.settleTetsukoTime(window.__tetsukoValue, window.__tetsukoResult);
    return { result: window.__tetsukoResult, settled, flags: window.__tetsukoValue.flags };
  });
}

await suite("tetsuko-feel", async check => {
  for (const phone of [false, true]) await check(`tetsuko-shutter-and-captions-${phone ? "phone" : "desktop"}`, async page => {
    const shot = page.locator(dt("tetsuko-photo"));
    const note = page.locator(".tt-toast");
    await open(page, { visits: 0 });
    assert(await shot.isVisible() && await shot.isDisabled(), "The shutter is visible even before there is a moment");
    await page.keyboard.press("p");
    assert.equal(await note.count(), 0, "No photo without a moment");
    await page.locator(dt("tetsuko-time-back")).click();
    await shot.waitFor({ state: "detached" });

    await open(page, { record: { sessions: 3, props: { floor: "box", bed: "bed" } } });
    const bed = page.locator(dt("tetsuko-slot-bed"));
    await bed.waitFor({ state: "visible" });
    // ベッドに注目させると、箱のしぐさ・反応・ムカイさんのセリフが同時に出る。
    await bed.dispatchEvent("click");
    const reaction = page.locator(dt("tetsuko-caption"));
    const line = page.locator(".tt-line");
    await line.waitFor({ state: "visible" });
    assert.match(await line.textContent(), /そっちか/);
    await note.waitFor({ state: "visible" });
    const bounds = await page.locator(".tt-caption .tt-chips, .tt-caption .tt-caption-paper").evaluateAll(nodes =>
      nodes.map(node => { const { top, bottom } = node.getBoundingClientRect(); return { top, bottom }; }));
    assert(bounds[0].bottom < bounds[1].top && bounds[1].bottom < bounds[2].top, "The notice, reaction, and dialogue have separate rows");
    assert.match(await reaction.textContent(), /箱/);

    await page.locator(dt("tetsuko-help")).click();
    assert(await shot.isDisabled(), "The shutter is disabled while help is open");
    await page.keyboard.press("p");
    assert.equal(await note.getAttribute("data-kind"), "found", "The shortcut does not shoot through an open panel");
    await page.keyboard.press("Escape");
    if (phone) await shot.tap();
    else await shot.click();
    assert.equal(await note.getAttribute("data-kind"), "photo");
    const { result } = await leaveAndSettle(page);
    assert(result.album.some(entry => entry.moment === "box_over_bed"));
  }, phone ? { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : { reducedMotion: "reduce" });

  await check("tetsuko-feel-wish-zones-pounce-and-joy-peak", async page => {
    const screen = await open(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const caption = () => get("caption").textContent();
    const joy = async () => Number(await get("joy").getAttribute("data-value"));
    assert.equal(await screen.getAttribute("data-stage"), "3");
    assert.equal(await page.locator(".tt-heart").count(), 5, "Five hearts show how happy she is");
    // 触らなくても、数秒で頭の上に吹き出しが出て、応えられる道具が知らされる。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.wish, null, { timeout: 15000 });
    const wish = await screen.getAttribute("data-wish");
    assert(["pet", "play", "brush", "treat", "watch", "decor"].includes(wish), `She shows what she wants (${wish})`);
    assert.equal(await get("wish").isVisible(), true);
    assert.equal(await page.evaluate(() => document.querySelectorAll(".tt-act.asked, .tt-tool.asked").length), wish === "watch" ? 0 : 1, "Exactly the tool that answers is marked");
    // なでる: 触った場所で反応が変わる。しっぽは触らせてくれない（ごきげんは減らない）。擬音が出る。
    const box = await get("cat").boundingBox();
    const at = (rx, ry) => [box.x + box.width * rx, box.y + box.height * ry];
    await page.mouse.click(...at(.5, .25));
    await page.waitForFunction(() => /すり寄って/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert(await page.locator(".tt-pop").count() >= 1, "A short sound word pops beside her");
    const afterRub = await joy();
    assert(afterRub > 0);
    await page.mouse.click(...at(.5, .55));
    await page.waitForFunction(() => /あご|お気に入り|押しつけて/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert(await joy() > afterRub, "Each stroke adds a little");
    const beforeTail = await joy();
    await page.mouse.click(...at(.14, .86));
    await page.waitForFunction(() => /しっぽ/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert.equal(await joy(), beforeTail, "Touching her tail costs nothing");
    // じゃらし: 持ち替えると少し引いた画になる。3回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ。
    await get("play").click();
    assert.equal(await screen.getAttribute("data-tool"), "toy");
    await get("play").click();
    await get("play").click();
    await get("note").filter({ hasText: "はじめて前足が出た" }).waitFor();
    await get("play").click();
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-cat"]')?.dataset.at === "free", null, { timeout: 5000 });
    await page.waitForFunction(() => /抱えこんで/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 5000 });
    assert.equal(await screen.getAttribute("data-toy"), "held", "The toy stays in her arms for a moment");
    // じゃらしだけでは、その回の分は溜まりきらない。おやつ・ブラシ・なでるも合わせて、その回の分（ハート1つ）が溜まると「とっておき」:
    // 写真に撮れるしぐさが出て「今日は、もう満足らしい」。ハートは空に戻らない（来訪をまたいで溜まる）。
    const visitJoy = await page.evaluate(async () => (await import("./js/minigames/tetsuko-model.js")).VISIT_JOY);
    assert(await joy() < visitJoy, "Playing with the toy alone does not fill today's share");
    await settle(page);
    const care = ["treat", "brush", "brush", "pet", "brush", "pet", "play", "pet", "play"];
    for (let i = 0; i < 40 && await screen.getAttribute("data-peak") !== "1"; i += 1) {
      const id = care[i % care.length];
      if (await get(id).isEnabled() && !(id === "play" && await screen.getAttribute("data-toy") === "held")) await get(id).click();
      await page.waitForTimeout(450);
    }
    assert.equal(await screen.getAttribute("data-peak"), "1", "Caring for her in many ways fills today's share");
    assert.match(await caption(), /膝に乗ってきた|頭をこすりつけて/, "A special moment at the stage she trusts you");
    assert.match(await get("joy-note").textContent(), /今日は、もう満足らしい/, "She is content for today");
    assert.equal(await get("joy-note").getAttribute("data-kind"), "visit");
    assert.equal(await joy(), visitJoy, "The hearts stay: one heart today, kept for the next visit");
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-photo"]')?.matches(":enabled"));
    await get("photo").click();
    // 手帳に、ごきげんにした通算の回数が出る（前の3回＋今回）。
    await get("book").click();
    assert.match(await get("book-joy").textContent(), /4回/);
    await get("panel-close").click();
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true);
    assert.equal(result.peaks, 1);
    assert(result.found.includes("first_rub") && result.found.includes("hug_toy"));
    assert(result.album.length >= 1);
    assert.deepEqual(settled, { committed: true, stamina: 12 }, "The same settle point as before: one visit, 12 stamina");
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(flags._tetsuko_time.peaks, 4, "The lifetime count of happy peaks is kept for the notebook");
    assert.equal(flags._tetsuko_time.affection, visitJoy, "Today's heart is kept across visits");
    assert.equal(result.care, visitJoy);
    assert.equal(await screen.count(), 0);
  });

  // ハートは来訪をまたいで溜まる: 溜まった分から始まり、初めて5つそろうと「とっておき」と「ハートが5つそろった」。確定で一度だけ知らせ、
  // 5つの後は5つのまま（次の来訪でも、もう一度は知らせない）。
  await check("tetsuko-feel-hearts-carry-over-and-fill-to-five", async page => {
    await page.evaluate(async () => {
      const { on } = await import("./js/core/bus.js");
      window.__hearts = [];
      on("tetsuko-hearts", event => window.__hearts.push({ affection: event.affection, full: event.full, same: event.state === window.__tetsukoValue }));
    });
    const screen = await open(page, { record: { sessions: 6, peaks: 5, affection: 90, found: ["waiting"] } });
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const hearts = async () => [Number(await get("joy").getAttribute("data-value")), await get("joy").getAttribute("aria-label")];
    assert.deepEqual(await hearts(), [90, "ごきげん 4 / 5"], "The hearts start where the last visits left them");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tt-heart")].map(node => node.dataset.full)),
      ["true", "true", "true", "true", "false"], "Four full hearts and a half");
    await get("treat").click();
    for (let i = 0; i < 12 && await screen.getAttribute("data-peak") !== "1"; i += 1) {
      if (await screen.getAttribute("data-toy") !== "held") await get("play").click();
      await page.waitForTimeout(450);
    }
    assert.equal(await screen.getAttribute("data-peak"), "1", "Her fifth heart fills");
    assert.match(await get("joy-note").textContent(), /ハートが5つそろった！/);
    assert.equal(await get("joy-note").getAttribute("data-kind"), "full");
    assert.deepEqual(await hearts(), [100, "ごきげん 5 / 5"]);
    assert.deepEqual(await page.evaluate(() => window.__hearts), [], "Nothing is announced before she goes home");
    const first = await leaveAndSettle(page);
    assert.equal(first.flags._tetsuko_time.affection, 100);
    assert.deepEqual(await page.evaluate(() => window.__hearts), [{ affection: 100, full: true, same: true }], "Five hearts are announced once, when settled");
    // 次の来訪: 5つのまま。もう一度は知らせない。
    await open(page, { again: true });
    assert.deepEqual(await hearts(), [100, "ごきげん 5 / 5"], "Five hearts stay five");
    await get("pet").click();
    const second = await leaveAndSettle(page);
    assert.equal(second.flags._tetsuko_time.affection, 100);
    assert.equal(await page.evaluate(() => window.__hearts.length), 1, "Never announced twice");
  }, { reducedMotion: "reduce" });

  // 触らずに眺めているだけでも、隣で見守ったことになる（「そっと見守る」のボタンは無い）。てつこは自分で動き、帰ると来訪が数えられる。
  await check("tetsuko-feel-just-watching-counts-as-being-with-her", async page => {
    const screen = await open(page, { record: { sessions: 3, found: ["waiting"] } });
    assert.equal(await page.locator(dt("tetsuko-watch")).count(), 0, "No button for sitting beside her");
    assert.equal(await page.locator(dt("tetsuko-catch")).count(), 0, "No button for stopping the toy");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tt-dock .tt-act-label")].map(node => node.textContent)),
      ["なでる", "じゃらし", "ブラシ", "おやつ"], "Four tools in hand");
    await page.waitForFunction(() => /前足をそろえて|膝に乗ってきた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 40000 });
    // 寄せた舞台は画面より大きい。画面の外にかかった物へスクロールしようとしても、画面（道具・外枠）は横にずれない（2026-11-11 の不具合）。
    const shifted = await page.evaluate(async () => {
      const host = document.querySelector('[data-test="tetsuko-time-screen"]');
      document.querySelector(".tt-cam-play").scrollIntoView({ block: "end", inline: "end" });
      host.scrollLeft = 400; host.scrollTop = 200;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [host.scrollLeft, host.scrollTop];
    });
    assert.deepEqual(shifted, [0, 0], "The screen never scrolls sideways");
    // しぐさの絵はどれも右向きで、向き（data-flip）の時に左右を返す。歩く間は歩く向きが勝つ（歩きの絵が後ろ向きに進まない）。
    const facing = await page.evaluate(() => {
      const cat = document.querySelector('[data-test="tetsuko-cat"]'), pose = cat.querySelector(".tt-cat-pose");
      const keep = { walk: cat.dataset.walk, flip: cat.dataset.flip };
      const read = (walk, flip) => {
        if (walk) cat.dataset.walk = walk; else delete cat.dataset.walk;
        cat.dataset.flip = flip;
        return getComputedStyle(pose).scale;
      };
      const seen = [read("left", "false"), read("left", "true"), read("right", "true"), read("", "true"), read("", "false")];
      if (keep.walk) cat.dataset.walk = keep.walk; else delete cat.dataset.walk;
      cat.dataset.flip = keep.flip;
      return seen;
    });
    assert.deepEqual(facing, ["-1 1", "-1 1", "none", "-1 1", "none"], "Walking faces the way she walks; otherwise the art turns with her");
    assert(Number(await page.locator(dt("tetsuko-joy")).getAttribute("data-value")) > 0, "Being together fills her hearts a little");
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true, "Just watching her counts");
    assert(result.found.includes("paws_together") || result.found.includes("lap_nap"));
    assert.equal(settled.committed, true);
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(await screen.count(), 0);
  });

  // すぐ帰れば、何も確定しない（見守ったことになるのは、数秒そばにいた時だけ）。動きを減らす設定でも遊べる（跳ばずに結果だけ出る）。
  await check("tetsuko-feel-reduced-motion-plays-without-leaps", async page => {
    const screen = await open(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    assert.equal(await screen.getAttribute("data-reduced"), "true");
    for (let i = 0; i < 4; i += 1) await get("play").click();
    await page.waitForFunction(() => /抱えこんで/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 5000 });
    assert.notEqual(await get("cat").getAttribute("data-at"), "free", "She does not leap when motion is reduced");
    assert.equal(await page.locator(".tt-bit").count(), 0, "No flying bits when motion is reduced");
    assert(Number(await get("joy").getAttribute("data-value")) > 0);
    const { result } = await leaveAndSettle(page);
    assert(result.found.includes("hug_toy"));
  }, { reducedMotion: "reduce" });

  await check("tetsuko-decor-rejects-overlap-and-returns-drag", async page => {
    await open(page, { record: { sessions: 3, props: { floor: "tunnel" } } });
    await page.locator(dt("tetsuko-decor")).click();
    const box = page.locator(dt("tetsuko-item-box"));
    await box.click();
    const bed = page.locator(dt("tetsuko-slot-bed"));
    assert.equal(await bed.getAttribute("data-allowed"), "false", "A floor tunnel blocks the bed-side box");
    assert.equal(await bed.evaluate(node => getComputedStyle(node).borderTopColor), "rgb(211, 61, 54)", "Invalid spot is framed red");
    const from = await box.boundingBox(), to = await bed.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('.tt-slot[data-slot="floor"]').getAttribute("data-prop"), "tunnel", "The original prop stays put");
    assert.equal(await page.locator('.tt-slot[data-slot="bed"]').getAttribute("data-prop"), "", "Invalid drop adds nothing");
    await page.locator(dt("tetsuko-item-cushion")).click();
    await page.locator(dt("tetsuko-slot-bench")).click();
    assert.equal(await page.locator('.tt-slot[data-slot="bench"]').getAttribute("data-prop"), "cushion", "Small props still fit on the bench");
    const floor = page.locator(dt("tetsuko-slot-floor"));
    const floorRect = await floor.boundingBox(), benchRect = await page.locator(dt("tetsuko-slot-bench")).boundingBox();
    await page.mouse.move(floorRect.x + floorRect.width / 2, floorRect.y + floorRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(benchRect.x + benchRect.width / 2, benchRect.y + benchRect.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('.tt-slot[data-slot="floor"]').getAttribute("data-prop"), "tunnel", "Rejected move returns the placed prop to its floor slot");
  }, { reducedMotion: "reduce" });
});
