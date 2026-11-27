// てつこといっしょの手応え（docs/spec/tetsuko_time.md §10・2026-11-11）。実UIで次を確かめる:
// - 触らなくても、数秒で頭の上におねだりの吹き出しが出て、応えられる道具が知らされる
// - なでる場所で反応が変わる。しっぽは触らせてくれない（1回目は知らせるだけ。続けると、ハートが少し下がる）。擬音が猫のそばに出る
// - じゃらしは 3 回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ
// - ごきげんとなかよし（§12・2026-11-27）: 画面のハートは、その日のごきげん（来るたびに始めから。上がり下がりする。枠は、なかよしの段で3〜5つ）。
//   枠がいっぱいになると「とっておき」（切り上げにはしない）。付き合ってくれる回数（丸）を使い切ると「今日はこれぐらいにしておこう。」と切り上げ、
//   帰りの札（今日のハート → なかよしの肉球）が出る。節目なら、おみやげ。なかよし（肉球5つ）は来訪をまたいで溜まり、
//   火種の節目（肉球3つ・5つ）に届いた確定で "tetsuko-hearts" を知らせる。
// - 今日の気分は、入口の姿で分かる。ハートが3つあると撮らせてくれる。気を許した段階でハートが4つあると、膝に乗ってくる（膝ごと描いた一枚絵）。
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
async function open(page, { visits = 5, record = { sessions: 3, peaks: 3 }, again = false, day = 36 } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ visits, record, again, day }) => {
    const core = await import("./js/core/state.js");
    const data = await import("./js/core/data.js");
    const time = await import("./js/minigames/tetsuko-time.js");
    const value = again ? window.__tetsukoValue : core.newState();
    if (again) value.day += 1;
    else {
      Object.assign(value, { chapter: 3, phase: "daily", day, slot: 1 });
      value.met = { ...(value.met || {}), mashiro: true, mukai_master: true };
      value.flags = { ...(value.flags || {}), _ch3_outings: { tetsuko: visits }, _tetsuko_time: record };
    }
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
    window.__tetsukoValue = value;
    window.__tetsukoResult = null;
    time.openTetsukoTime({ value, visitKey: time.tetsukoVisitKey(value), bg: data.sceneBg?.("bg_street", "night")?.url || null })
      .then(result => { window.__tetsukoResult = result; });
  }, { visits, record, again, day });
  const screen = page.locator(dt("tetsuko-time-screen"));
  await screen.waitFor();
  await page.evaluate(() => {
    window.__visitNotices = [];
    const notice = document.querySelector('[data-test="tetsuko-visit-notice"]');
    new MutationObserver(() => {
      if (!notice.hidden) window.__visitNotices.push(notice.textContent);
    }).observe(notice, { attributes: true, childList: true, subtree: true, characterData: true });
  });
  return screen;
}
// 上の札の数字: ごきげん（0〜100）・ハートの数・ハートの枠・付き合ってくれる残りの回数。
const hud = page => page.evaluate(() => {
  const joy = document.querySelector('[data-test="tetsuko-joy"]').dataset, turns = document.querySelector('[data-test="tetsuko-turns"]').dataset;
  return { joy: Number(joy.value), hearts: Number(joy.hearts), cap: Number(joy.cap), left: Number(turns.left) };
});
// 帰って、結果を同じ確定点で確定する（本編の呼び出し側と同じ順）。
async function leaveAndSettle(page) {
  await page.locator(dt("tetsuko-time-back")).click();
  const confirm = page.locator(dt("tetsuko-quit-confirm"));
  if (await confirm.isVisible()) await confirm.click();
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
    const caption = page.locator(dt("tetsuko-caption"));
    const press = locator => (phone ? locator.tap() : locator.click());
    await open(page, { visits: 0 });
    assert(await shot.isVisible() && await shot.isDisabled(), "The shutter is visible even before there is a moment");
    await page.keyboard.press("p");
    assert.equal(await note.count(), 0, "No photo without a moment");
    const empty = await leaveAndSettle(page);
    assert.equal(empty.result.meaningful, false);
    assert.equal(empty.settled.committed, false, "Leaving immediately earns no visit reward");
    assert.equal(empty.flags._tetsuko_time.playedDay, 36, "Opening the game still uses today's play");
    await shot.waitFor({ state: "detached" });

    // なかよしが肉球5つ（ハートの枠5つ）・甘えたい日: 来た時のハートは2つ。
    await open(page, { record: { sessions: 3, affection: 100, found: ["waiting"], props: { floor: "box", bed: "bed" } } });
    const bed = page.locator(dt("tetsuko-slot-bed"));
    await bed.waitFor({ state: "visible" });
    // ベッドに注目させると、箱のしぐさ・反応・ムカイさんのセリフが同時に出る。
    await bed.dispatchEvent("click");
    const line = page.locator(".tt-line");
    await line.waitFor({ state: "visible" });
    assert.match(await line.textContent(), /そっちか/);
    await note.waitFor({ state: "visible" });
    const bounds = await page.locator(".tt-caption .tt-chips, .tt-caption .tt-caption-paper").evaluateAll(nodes =>
      nodes.map(node => { const { top, bottom } = node.getBoundingClientRect(); return { top, bottom }; }));
    assert(bounds[0].bottom < bounds[1].top && bounds[1].bottom < bounds[2].top, "The notice, reaction, and dialogue have separate rows");
    assert.match(await caption.textContent(), /箱/);

    await page.locator(dt("tetsuko-help")).click();
    assert(await shot.isDisabled(), "The shutter is disabled while help is open");
    await page.keyboard.press("p");
    assert.equal(await note.getAttribute("data-kind"), "found", "The shortcut does not shoot through an open panel");
    await page.keyboard.press("Escape");
    // ごきげんが足りない（ハート3つ未満）: しぐさは見えているが、撮らせてくれない。札に要るハートの数が出て、押すと顔をそむける。
    assert.equal(await shot.getAttribute("data-shy"), "true", "She is camera-shy until she has three hearts");
    assert.equal((await shot.locator(".tt-shot-need").innerText()).trim(), "3", "The shutter shows how many hearts she needs");
    assert(await shot.locator(".tt-shot-need").isVisible());
    const before = await hud(page);
    await press(shot);
    await page.waitForFunction(() => /カメラを向けると/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert.equal(await page.locator('.tt-toast[data-kind="photo"]').count(), 0, "No photo while she is shy");
    assert.deepEqual(await hud(page), before, "Being shy costs no hearts and no turns");
    assert(await shot.isDisabled(), "The moment is gone after she turns away");
    // おやつでハートが3つになる。もう一度しぐさを見せてもらうと、撮れる。
    await press(page.locator(dt("tetsuko-treat")));
    await page.waitForFunction(() => Number(document.querySelector('[data-test="tetsuko-joy"]')?.dataset.hearts) >= 3, null, { timeout: 15000 });
    await page.waitForFunction(() => /顔を洗い/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 15000 });
    for (let i = 0; i < 3 && (await shot.isDisabled() || await shot.getAttribute("data-shy") === "true"); i += 1) {
      await bed.dispatchEvent("click");
      await page.waitForTimeout(700);
    }
    assert.equal(await shot.getAttribute("data-shy"), "false", "With three hearts she lets you shoot");
    assert(!(await shot.locator(".tt-shot-need").isVisible()));
    await press(shot);
    await page.locator('.tt-toast[data-kind="photo"]').waitFor();
    const { result } = await leaveAndSettle(page);
    assert(result.album.length === 1 && ["box_over_bed", "box_peek", "odd_sleep"].includes(result.album[0].moment), "The photo is kept");
  }, phone ? { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : { reducedMotion: "reduce" });

  // 入口の姿で、今日の気分が分かる（文で説明しない）。気分のしるしは読み上げ用で、画面には出さない。
  await check("tetsuko-mood-shows-at-the-entrance", async page => {
    const looks = {};
    // 36日目からの気分（通算日で決まる）: 33 のんびり・46 眠い・40 遊びたい・36 甘えたい・32 ご機嫌ななめ
    for (const [mood, day, text] of [["calm", 33, /見上げている/], ["sleepy", 46, /片目だけ開けた/], ["playful", 40, /狙っている/], ["clingy", 36, /足もとまで来て/], ["grumpy", 32, /そっぽを向いて/]]) {
      const screen = await open(page, { day, record: { sessions: 3, affection: 45, found: ["waiting"] } });
      assert.equal(await screen.getAttribute("data-mood"), mood, `day ${day} is a ${mood} day`);
      const cat = page.locator(dt("tetsuko-cat"));
      assert.match(await page.locator(dt("tetsuko-caption")).textContent(), text);
      looks[mood] = [await cat.getAttribute("data-spot"), await cat.getAttribute("data-pose"), await cat.getAttribute("data-face"), await cat.getAttribute("data-flip")].join("/");
      const sign = page.locator(dt("tetsuko-mood"));
      assert((await sign.boundingBox()).width <= 2, "The mood is not written on the screen");
      assert.match(await sign.getAttribute("aria-label"), /今日は/);
      if (mood === "grumpy") {
        // ご機嫌ななめ: なでようとすると、1回目は知らせるだけ（怒りのしるし）。もう一度で、ハートが少し下がる。
        const before = await hud(page);
        await page.locator(dt("tetsuko-pet")).click();
        await page.locator(".tt-anger").waitFor();
        assert.deepEqual(await hud(page), before, "The first touch on a grumpy day is only a warning");
        await page.locator(dt("tetsuko-pet")).click();
        await page.waitForFunction(value => Number(document.querySelector('[data-test="tetsuko-joy"]').dataset.value) < value, before.joy);
        const after = await hud(page);
        assert.equal(after.joy, 0, "She had less than the drop, so the hearts are empty (never below)");
        assert.equal(after.left, before.left - 1, "A drop uses one of her turns");
      }
      await leaveAndSettle(page);
      await screen.waitFor({ state: "detached" });
    }
    assert.equal(new Set(Object.values(looks)).size, 5, `Each mood looks different at the entrance: ${JSON.stringify(looks)}`);
  }, { reducedMotion: "reduce" });

  await check("tetsuko-feel-wish-zones-pounce-and-joy-peak", async page => {
    const screen = await open(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const caption = () => get("caption").textContent();
    assert.equal(await screen.getAttribute("data-stage"), "3");
    assert.equal(await page.locator(".tt-status .tt-heart").count(), 5, "Five hearts show how happy she is");
    // なかよしが0段の時、ハートの枠は3つ（残りの2つは、まだ開いていない）。肉球のしるしは 0。
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tt-status .tt-heart")].map(node => node.dataset.locked)), ["false", "false", "false", "true", "true"]);
    assert.equal(await get("bond").getAttribute("data-level"), "0");
    assert.equal(await get("joy").getAttribute("aria-label"), "ごきげん 1 / 3");
    const turns = (await hud(page)).left;
    assert.equal(await page.locator(`${dt("tetsuko-turns")} i`).count(), turns, "One dot for each turn she will stay");
    // 触らなくても、数秒で頭の上に吹き出しが出て、応えられる道具が知らされる。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.wish, null, { timeout: 15000 });
    const wish = await screen.getAttribute("data-wish");
    assert(["pet", "play", "brush", "treat", "watch", "decor"].includes(wish), `She shows what she wants (${wish})`);
    assert.equal(await get("wish").isVisible(), true);
    assert.equal(await page.evaluate(() => document.querySelectorAll(".tt-act.asked, .tt-tool.asked").length), wish === "watch" ? 0 : 1, "Exactly the tool that answers is marked");
    // 擬音・反応の一行・怒りのしるし・こぼれるハート・とっておきを記録する。
    await screen.evaluate(node => {
      const feedback = window.__tetsukoFeedback = { pops: [], texts: [], caught: false, held: false, anger: 0, fallen: 0, peak: false };
      new MutationObserver(records => {
        for (const record of records) {
          if (record.attributeName === "data-toy" && (record.oldValue === "held" || node.dataset.toy === "held")) feedback.held = true;
          if (record.attributeName === "data-peak" && node.dataset.peak === "1") feedback.peak = true;
          for (const child of record.addedNodes) {
            if (child.matches?.(".tt-pop")) feedback.pops.push(child.textContent);
            if (child.matches?.(".tt-anger")) feedback.anger += 1;
            if (child.matches?.(".tt-fall-heart")) feedback.fallen += 1;
            if (record.target.matches?.(".tt-text")) feedback.texts.push(child.textContent);
            if (record.target.matches?.(".tt-text") && /抱えこんで/.test(child.textContent)) feedback.caught = true;
          }
        }
      }).observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-toy", "data-peak"], attributeOldValue: true });
    });
    const petAt = async (rx, ry) => {
      const box = await get("cat").boundingBox();
      await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    };
    // なでる: 触った場所で反応が変わり、ハートが増える。
    const start = await hud(page);
    await petAt(.5, .25);
    await page.waitForFunction(() => /頭を寄せて|お気に入り|目を細めた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    await page.waitForFunction(value => Number(document.querySelector('[data-test="tetsuko-joy"]').dataset.value) > value, start.joy);
    const petted = await hud(page);
    assert.equal(petted.left, start.left - 1, "Petting uses one turn");
    // しっぽ: 1回目は、じろりと見て知らせるだけ（ハートも回数も減らない）。もう一度触ると、ハートが少し下がる。
    await petAt(.14, .86);
    await page.waitForFunction(() => /じろりと見られた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert.deepEqual(await hud(page), petted, "The first touch on her tail is only a warning");
    assert(await page.evaluate(() => window.__tetsukoFeedback.anger >= 1 && window.__tetsukoFeedback.pops.includes("じろっ")), "She shows she is annoyed");
    await petAt(.14, .86);
    await page.waitForFunction(() => /ぷいと横を向いた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    const dropped = await hud(page);
    assert.equal(dropped.joy, petted.joy - 8, "Touching it again costs a little");
    assert.equal(dropped.left, petted.left - 1);
    assert(await page.evaluate(() => window.__tetsukoFeedback.fallen >= 1), "A heart falls from the row");
    // じゃらし: 持ち替えると少し引いた画になる。3回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ。
    await get("play").click();
    assert.equal(await screen.getAttribute("data-tool"), "toy");
    await get("play").click();
    await get("play").click();
    await get("note").filter({ hasText: "はじめて前足が出た" }).waitFor();
    await get("play").click();
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-cat"]')?.dataset.at === "free", null, { timeout: 5000 });
    await page.waitForFunction(() => window.__tetsukoFeedback.caught, null, { timeout: 5000 });
    assert(await page.evaluate(() => window.__tetsukoFeedback.held), "The toy stays in her arms for a moment");
    // おやつ・ブラシも合わせて、ハートの枠（3つ）がいっぱいになると「とっておき」。切り上げにはならず、回数が残っていれば続けられる。
    await settle(page);
    const care = ["treat", "brush"];
    for (let i = 0; i < 6 && !(await page.evaluate(() => window.__tetsukoFeedback.peak)); i += 1) {
      const id = care[i % care.length];
      if ((await hud(page)).hearts < 3 && await get(id).isEnabled()) await get(id).click();
      await page.waitForTimeout(900);
    }
    await page.waitForFunction(() => window.__tetsukoFeedback.peak, null, { timeout: 15000 });
    await page.waitForFunction(() => /頭をこすりつけて/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 5000 });
    const full = await hud(page);
    assert.deepEqual([full.joy, full.hearts], [60, 3], "The hearts fill up to today's limit");
    assert.equal(await screen.getAttribute("data-ended"), null, "A full row is not the end of the visit");
    assert(full.left > 0 && await get("pet").isEnabled(), "She still has turns left");
    // ごきげんが良い間は、とっておきのしぐさを撮らせてくれる。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-photo"]')?.matches(':enabled[data-shy="false"]'));
    await get("photo").click();
    await page.locator('.tt-toast[data-kind="photo"]').waitFor();
    // 手帳に、とっておきを見た通算の回数（前の3回＋今回）と、なかよしの肉球・節目のしるしが出る。
    await get("book").click();
    assert.match(await get("book-joy").textContent(), /4回/);
    assert.equal(await get("book-bond").getAttribute("data-level"), "0");
    assert.equal(await page.locator(`${dt("tetsuko-book-bond")} .tt-paw`).count(), 5);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-test="tetsuko-book-bond"] .tt-bond-mark')].map(node => `${node.dataset.mark}:${node.dataset.got}`)),
      ["acorn:false", "cap:false", "ember:false", "feather:false", "ember:false"], "The marks under the paws show what each step brings");
    // 肉球の列を押すと、右のページに、おみやげの並び（まだの物は影と「？？？」）が出る。
    await get("book-bond").click();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-test="tetsuko-book-gift-detail"] li')].map(node => `${node.dataset.gift}:${node.dataset.got}:${node.querySelector("b").textContent}`)),
      ["acorn:false:？？？", "cap:false:？？？", "feather:false:？？？"], "Keepsakes she has not brought yet stay hidden");
    await get("panel-close").click();
    // 付き合ってくれる回数を使い切ると「今日はこれぐらいにしておこう。」と切り上げ、帰りの札が出る（ハート3つ → なかよし +7）。
    for (let i = 0; i < 16 && await screen.getAttribute("data-ended") !== "turns"; i += 1) {
      if (await get("brush").isEnabled()) await get("brush").click();
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.ended === "turns", null, { timeout: 15000 });
    assert.equal((await hud(page)).left, 0);
    assert.equal(await get("turns").getAttribute("aria-label"), "あと 0 回");
    assert.equal(await page.evaluate(() => document.querySelector('[data-test="tetsuko-visit-notice"]').textContent), "今日のふれあいはおしまい");
    assert((await page.evaluate(() => window.__visitNotices)).includes("そろそろおしまい"));
    assert(await page.evaluate(() => window.__tetsukoFeedback.texts.some(text => /今日はこれぐらいにしておこう。$/.test(text))), "She wraps the day up");
    const card = get("result");
    await card.waitFor();
    assert.deepEqual([await card.getAttribute("data-hearts"), await card.getAttribute("data-gain"), await card.getAttribute("data-level"), await card.getAttribute("data-gifts")], ["3", "7", "0", ""]);
    assert.equal(await card.locator(".tt-result-gain").innerText(), "+7");
    assert.equal(await card.locator(".tt-paw").count(), 5);
    assert.equal(await get("pet").isVisible(), false, "The result card takes the place of the tools");
    // 回数を使い切った後は操作ボタンが止まり、だらだら続けられない。
    for (const id of ["pet", "play", "brush", "treat", "decor"]) {
      assert.equal(await get(id).isDisabled(), true, `${id} locks after the wrap-up`);
    }
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true);
    assert.equal(result.peaks, 1);
    assert.equal(result.affectionUp, true);
    assert.equal(result.endReason, "turns");
    assert.equal(result.hearts, 3);
    assert(result.found.includes("first_rub") && result.found.includes("hug_toy"));
    assert(result.album.length >= 1);
    assert.deepEqual(settled, { committed: true, stamina: 12 }, "The same settle point as before: one visit, 12 stamina");
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(flags._tetsuko_time.peaks, 4, "The lifetime count of happy peaks is kept for the notebook");
    assert.equal(flags._tetsuko_time.affection, 7, "Three hearts at the end grow the bond by 7");
    assert.deepEqual(flags._tetsuko_time.gifts, []);
    assert.equal(flags._tetsuko_time.playedDay, 36, "Today is marked as already played");
    assert.equal(result.care, 7);
    assert.equal(await screen.count(), 0);
  });

  // 嫌がることばかりして終わる日: しっぽを触り続けると、ハートが下がったまま回数を使い切る。なかよしは減らず、少しだけ伸びる。
  // 節目（肉球1つ＝20）をまたぐので、帰りの札に、おみやげ（どんぐり）と、次から増えるハートの枠が出る。
  await check("tetsuko-feel-bad-visit-still-grows-the-bond-a-little", async page => {
    const screen = await open(page, { record: { sessions: 3, peaks: 1, affection: 18, found: ["waiting", "first_rub"] } });
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const box = await get("cat").boundingBox();
    const start = await hud(page);
    assert.deepEqual([start.joy, start.cap], [20, 3], "A clingy day starts a little higher; three heart slots at paw level 0");
    for (let i = 0; i < 14 && await screen.getAttribute("data-ended") !== "turns"; i += 1) {
      // しっぽは体の後ろ側（向きを変えた後は反対側）。
      const flipped = await get("cat").getAttribute("data-flip") === "true";
      if (await get("pet").isEnabled()) await page.mouse.click(box.x + box.width * (flipped ? .86 : .14), box.y + box.height * .86);
      await page.waitForTimeout(300);
    }
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.ended === "turns", null, { timeout: 10000 });
    const end = await hud(page);
    assert.deepEqual([end.joy, end.hearts, end.left], [6, 0, 0], "Her hearts dropped twice (8 and 6) and then she just ignored it");
    assert.match(await get("caption").textContent(), /今日はこれぐらいにしておこう。|どんぐり/);
    const card = get("result");
    await card.waitFor();
    assert.deepEqual([await card.getAttribute("data-hearts"), await card.getAttribute("data-gain"), await card.getAttribute("data-level"), await card.getAttribute("data-up"),
      await card.getAttribute("data-cap-up"), await card.getAttribute("data-gifts")], ["0", "2", "1", "true", "true", "acorn"]);
    assert.equal(await card.getAttribute("data-embers"), "", "No ember at the first paw");
    await get("result-gift-acorn").waitFor({ timeout: 10000 });
    assert.match(await get("result-gift-acorn").innerText(), /どんぐり/);
    assert.deepEqual(await card.evaluate(node => [...node.querySelectorAll(".tt-result-hearts .tt-heart")].map(heart => heart.dataset.locked)),
      ["false", "false", "false", "false", "true"], "The fourth heart slot opens from the next visit");
    for (const id of ["pet", "play", "brush", "treat", "decor"]) {
      assert.equal(await get(id).isDisabled(), true, `${id} locks on the wrap-up`);
    }
    // 帰るを押さなくても切り上げ後に自動で閉じ、その日の来訪が確定できる。
    await page.waitForFunction(() => window.__tetsukoResult, null, { timeout: 15000 });
    const { result, settled, flags } = await page.evaluate(async () => {
      const time = await import("./js/minigames/tetsuko-time.js");
      const settled = time.settleTetsukoTime(window.__tetsukoValue, window.__tetsukoResult);
      return { result: window.__tetsukoResult, settled, flags: window.__tetsukoValue.flags };
    });
    assert.equal(result.meaningful, true);
    assert.equal(result.endReason, "turns");
    assert.deepEqual([result.hearts, result.care, result.newGifts], [0, 2, ["acorn"]]);
    assert.equal(settled.committed, true);
    assert.equal(flags._tetsuko_time.affection, 20, "The bond never goes down; a poor visit still adds a little");
    assert.deepEqual(flags._tetsuko_time.gifts, ["acorn"]);
    assert.equal(flags._tetsuko_time.playedDay, 36);
    assert.equal(await screen.count(), 0);
    // 次の日: ハートの枠が4つに増え、手帳で、おみやげを見られる。
    await open(page, { again: true });
    assert.deepEqual([(await hud(page)).cap, await get("bond").getAttribute("data-level")], [4, "1"]);
    await get("book").click();
    assert.equal(await get("book-bond").getAttribute("data-level"), "1");
    await get("book-bond").click();
    assert.equal(await get("book-bond").getAttribute("aria-pressed"), "true");
    assert.match(await get("book-gift-acorn").innerText(), /どんぐり/);
    assert.equal(await get("book-gift-acorn").getAttribute("data-got"), "true");
    assert((await get("book-gift-acorn").locator("img").getAttribute("src")).includes("gift_acorn.webp"));
    assert.equal(await get("book-gift-cap").getAttribute("data-got"), "false");
    await get("panel-close").click();
    await leaveAndSettle(page);
  }, { reducedMotion: "reduce" });

  // なかよし（肉球）は来訪をまたいで溜まる。ハート（ごきげん）は来るたびに始めから。
  // ハート3つで自分から帰ると、見送ってくれて、帰りの札が出る。肉球が5つになった確定で一度だけ知らせ、同じ日の二度目は確定しない。
  // 5つの後は5つのまま（次の来訪でも、もう一度は知らせない）。
  await check("tetsuko-feel-bond-carries-over-and-fills-to-five", async page => {
    await page.evaluate(async () => {
      const { on } = await import("./js/core/bus.js");
      window.__hearts = [];
      on("tetsuko-hearts", event => window.__hearts.push({ affection: event.affection, full: event.full, same: event.state === window.__tetsukoValue }));
    });
    const screen = await open(page, { record: { sessions: 9, peaks: 9, affection: 93, found: ["waiting"], gifts: ["acorn", "cap", "feather"] } });
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const hearts = async () => [Number(await get("joy").getAttribute("data-value")), await get("joy").getAttribute("aria-label")];
    assert.deepEqual(await hearts(), [36, "ごきげん 1 / 5"], "The hearts start fresh each visit (higher with a closer bond, and on a clingy day)");
    assert.equal(await get("bond").getAttribute("data-level"), "4", "The bond is where the last visits left it");
    assert.equal((await hud(page)).left, 10, "She stays for more turns when the bond is close");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tt-status .tt-heart")].map(node => node.dataset.locked)), ["false", "false", "false", "false", "false"]);
    await get("treat").click();
    await page.waitForFunction(() => /顔を洗い/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 15000 });
    await get("brush").click();
    await page.waitForFunction(() => Number(document.querySelector('[data-test="tetsuko-joy"]')?.dataset.hearts) >= 3, null, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => window.__hearts), [], "Nothing is announced before she goes home");
    // 自分から帰る: 見送ってくれて、帰りの札（ハート3つ → なかよし +7 で肉球5つ）が出てから閉じる。
    await get("time-back").click();
    await page.locator(dt("tetsuko-quit-confirm")).click();
    await page.waitForFunction(() => /戸の前までついてきた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    const card = get("result");
    await card.waitFor();
    assert.equal(await screen.getAttribute("data-ended"), "leave");
    assert.deepEqual([await card.getAttribute("data-hearts"), await card.getAttribute("data-gain"), await card.getAttribute("data-level"), await card.getAttribute("data-full")], ["3", "7", "5", "true"]);
    assert.equal(await card.getAttribute("data-embers"), "100", "Reaching five paws shows the white ember on the card");
    await get("result-ember-100").waitFor({ timeout: 10000 });
    assert.match(await get("result-ember-100").innerText(), /白火/);
    await page.waitForFunction(() => window.__tetsukoResult, null, { timeout: 30000 });
    const first = await page.evaluate(async () => {
      const time = await import("./js/minigames/tetsuko-time.js");
      const settled = time.settleTetsukoTime(window.__tetsukoValue, window.__tetsukoResult);
      return { result: window.__tetsukoResult, settled, flags: window.__tetsukoValue.flags };
    });
    assert.equal(first.result.endReason, null, "She was not out of turns; you chose to leave");
    assert(first.result.found.includes("see_off"), "With three hearts she sees you off");
    assert.equal(first.flags._tetsuko_time.affection, 100);
    assert.equal(first.flags._tetsuko_time.playedDay, 36);
    assert.deepEqual(await page.evaluate(() => window.__hearts), [{ affection: 100, full: true, same: true }], "Five paws are announced once, when settled");
    // 同じ日はもう遊んだ扱いになり、二重確定しない。
    const sameDay = await page.evaluate(async () => {
      const time = await import("./js/minigames/tetsuko-time.js");
      return {
        played: time.tetsukoPlayedToday(window.__tetsukoValue),
        again: time.settleTetsukoTime(window.__tetsukoValue, { ...window.__tetsukoResult, visitKey: "3:36:1:1" }),
      };
    });
    assert.equal(sameDay.played, true);
    assert.deepEqual(sameDay.again, { committed: false });
    // 次の日（のんびりの日）: 肉球は5つのまま。ハートは始めから。もう一度は知らせない。
    await open(page, { again: true });
    assert.equal(await get("bond").getAttribute("data-level"), "5", "Five paws stay five");
    assert.deepEqual(await hearts(), [30, "ごきげん 1 / 5"], "Hearts start over (from one and a half at the closest bond)");
    await get("pet").click();
    const second = await leaveAndSettle(page);
    assert.equal(second.result.care, 0, "Nothing more to add at five paws");
    assert.equal(second.flags._tetsuko_time.affection, 100);
    assert.equal(second.flags._tetsuko_time.playedDay, 37);
    assert.equal(await page.evaluate(() => window.__hearts.length), 1, "Never announced twice");
  }, { reducedMotion: "reduce" });

  // 膝の上は、重ね合わせではなく一枚絵（膝ごと描いた、てつこ）。気を許した段階で、ハートが4つ以上の時に、そばで待つと乗ってくる。
  // 乗ってきた時は起きている絵、そのまま見守ると寝ている絵。その間、猫の立ち絵・しぐさの絵は隠す。
  await check("tetsuko-lap-scene-is-one-picture", async page => {
    const screen = await open(page, { record: { sessions: 9, affection: 100, found: ["waiting", "paws_together"], gifts: ["acorn", "cap", "feather"] } });
    const get = id => page.locator(dt(`tetsuko-${id}`));
    assert.equal(await screen.getAttribute("data-art-scenes"), "lap_nap lap_sit");
    await get("treat").click();
    await page.waitForFunction(() => /顔を洗い/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 15000 });
    await get("brush").click();
    await page.waitForTimeout(800);
    await get("brush").click();
    await page.waitForTimeout(800);
    await get("pet").click();
    await page.waitForFunction(() => Number(document.querySelector('[data-test="tetsuko-joy"]')?.dataset.hearts) >= 4, null, { timeout: 15000 });
    assert.equal(await screen.getAttribute("data-lap"), "", "Not on the lap yet");
    // 触らずに待つと、隣で見守ったことになり、膝に乗ってくる。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.lap === "1", null, { timeout: 45000 });
    const art = page.locator(".tt-lap-art");
    assert.match(await art.getAttribute("src"), /scene_lap_sit\.webp/, "She is awake when she has just climbed on");
    assert.match(await get("caption").textContent(), /膝に乗ってきた/);
    assert.equal(await get("cat").getAttribute("data-scene"), "lap");
    await page.waitForFunction(() => document.querySelector(".tt-lap-art")?.complete);
    // 立ち絵は、ふっと消える（0.3秒）。消えきるのを待ってから確かめる。
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test="tetsuko-cat"] .tt-cat-body')).opacity === "0", null, { timeout: 5000 });
    const look = await page.evaluate(() => {
      const cat = document.querySelector('[data-test="tetsuko-cat"]'), art = document.querySelector(".tt-lap-art");
      const frame = document.querySelector('[data-test="tetsuko-time-screen"]').getBoundingClientRect(), box = art.getBoundingClientRect(), hit = cat.getBoundingClientRect();
      return { body: getComputedStyle(cat.querySelector(".tt-cat-body")).opacity, shadow: getComputedStyle(cat.querySelector(".tt-cat-shadow")).opacity, shown: art.naturalWidth > 0 || !art.complete,
        ratio: box.width / box.height, bottom: (box.bottom - frame.top) / frame.height, centre: (box.left + box.width / 2 - frame.left) / frame.width,
        overlap: hit.left < box.left + box.width * .6 && hit.right > box.left + box.width * .4 && hit.top < box.top + box.height * .6 && hit.bottom > box.top + box.height * .3 };
    });
    assert.deepEqual([look.body, look.shadow], ["0", "0"], "The separate cat picture is hidden while the one-piece lap picture shows");
    assert(Math.abs(look.ratio - 1400 / 900) < .02, "The picture keeps its shape");
    assert(look.bottom >= .99, "The lap runs off the bottom of the screen");
    assert(Math.abs(look.centre - .5) < .02, "She sits in the middle of the screen");
    assert(look.overlap, "Petting still lands on her (the touch area sits on the drawn cat)");
    // そのまま見守ると寝る（寝ている絵に替わる）。膝の上でなでると、起きて喉を鳴らす。
    await page.waitForFunction(() => /scene_lap_nap\.webp/.test(document.querySelector(".tt-lap-art")?.getAttribute("src")), null, { timeout: 30000 });
    assert.equal(await get("cat").getAttribute("data-face"), "sleep");
    await get("photo").click();
    await page.locator('.tt-toast[data-kind="photo"]').waitFor();
    assert.match(await page.locator('.tt-toast[data-kind="photo"] .tt-thumb img').getAttribute("src"), /scene_lap_nap\.webp/, "The photo of the lap nap uses the same picture");
    await get("pet").click();
    await page.waitForFunction(() => /scene_lap_sit\.webp/.test(document.querySelector(".tt-lap-art")?.getAttribute("src")));
    assert.match(await get("caption").textContent(), /膝の上で、低く喉を鳴らしている/);
    // ほかの遊びを始めると、膝から降りて、立ち絵に戻る。
    await get("play").click();
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.lap === "");
    assert.equal(await get("cat").getAttribute("data-scene"), "");
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-test="tetsuko-cat"] .tt-cat-body')).opacity === "1", null, { timeout: 5000 });
    const { result } = await leaveAndSettle(page);
    assert(result.found.includes("lap_nap"));
    assert(result.album.some(entry => entry.moment === "lap_nap"));
  });

  // 終わりが近づくと、終わる前に予告が出る（読み上げ用の「そろそろおしまい」。画面は、残りの回数の丸が点滅する色に変わる）。
  // 見守りだけだと回数が進まないことがあるため、ここはなでる操作で回数を重ね、予告が「おしまい」より先に記録されることを確かめる。
  await check("tetsuko-ending-notice-before-wrap-up", async page => {
    await open(page, { record: { sessions: 3, affection: 20, found: ["waiting"] } });
    const get = id => page.locator(dt(`tetsuko-${id}`));
    await get("pet").click();
    const petAt = async (rx, ry) => {
      const box = await get("cat").boundingBox();
      await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    };
    let shown = false;
    for (let i = 0; i < 8 && !shown; i += 1) {
      await petAt(.5, .25);
      await page.waitForTimeout(1200);
      shown = await page.evaluate(() => (window.__visitNotices || []).includes("そろそろおしまい"));
    }
    assert(shown, "終了前に「そろそろおしまい」の予告が出る");
    const turns = page.locator(dt("tetsuko-turns"));
    assert(await turns.isVisible(), "残りの回数の丸が見えている");
    assert.equal(await turns.getAttribute("data-low"), "true", "残り2回から、丸の色が変わる");
    assert(Number(await turns.getAttribute("data-left")) <= 2);
    const box = await turns.boundingBox();
    assert(box && box.width > 0 && box.x >= 0 && box.x + box.width <= 844, "横持ち画面内に丸が収まる");
    const dots = await turns.locator("i").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    assert(dots.every(width => width >= 4), `丸は見える大きさ（実寸 ${Math.min(...dots).toFixed(1)}px）`);
  }, { viewport: { width: 844, height: 390 }, reducedMotion: "reduce" });

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
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true, "Just watching her counts");
    assert(result.found.includes("paws_together") || result.found.includes("lap_nap"));
    assert.equal(settled.committed, true);
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(flags._tetsuko_time.playedDay, 36);
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
    const { result } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true);
    assert(result.found.includes("hug_toy"));
  }, { reducedMotion: "reduce" });

  await check("tetsuko-pounce-lands-even-with-help-open", async page => {
    const screen = await open(page);
    const cat = page.locator(dt("tetsuko-cat"));
    // 飛びつきと「？」を同じフレームで操作し、着地タイマーより先にパネルを開く。
    await screen.evaluate(node => {
      const play = node.querySelector('[data-test="tetsuko-play"]');
      for (let i = 0; i < 4; i += 1) play.click();
      node.querySelector('[data-test="tetsuko-help"]').click();
    });
    assert.equal(await screen.getAttribute("data-panel"), "help");
    await page.waitForFunction(() => {
      const caption = document.querySelector('[data-test="tetsuko-caption"]');
      return /抱えこんで|空振り/.test(caption?.textContent);
    });
    assert.notEqual(await cat.getAttribute("data-art"), "leap", "The jump sprite clears even if the landing art is still loading");
    await page.keyboard.press("Escape");
    assert.equal(await screen.getAttribute("data-panel"), "");
    assert.notEqual(await cat.getAttribute("data-art"), "leap");
  });

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
