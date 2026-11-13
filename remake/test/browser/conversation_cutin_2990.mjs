// 会話カットイン（立ち絵版・#2990）を本編の会話エンジンと実際の台本で確かめる。
// 置いた行で、はじめの既存の立ち絵（new）の切り抜きが左側に出て、次の行で消える（案4は薄れて消える・2c は0.9秒で消える）。
// LOG・SKIP で即座に消え、SKIP 中は出さない。置き場と条件の表は remake/test/conversation_cutin.mjs が見る。
// #3417: 同じ型の別場面（第2〜5章へ広げた置き場など）も、実際の台本の再生で出て次の行で片付くことを1件ずつ確かめる。
import assert from "node:assert/strict";
import path from "node:path";
import { suite } from "./support.mjs";

const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;

/** 置き場の行の少し前から本物の台本を再生し、カットインの層の出入りを時刻つきで記録する。id は案の番号か CUES の添字 */
async function start(page, id) {
  await page.evaluate(async (id) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js");
    const vn = await import("./js/vn/engine.js"), intro = await import("./js/vn/intro.js"), cut = await import("./js/vn/conversation-cutin.js");
    core.newGame();
    ui.clearScreen();
    Object.assign(core.config, { textSpeed: 4, skipSeenOnly: false, bgmVolume: 0, seVolume: 0, voiceBlip: false, portraitStyle: "new" });
    vn.vnTest.turbo = false;
    const cue = typeof id === "number" ? cut.CUES[id] : cut.CUES.find((c) => c.id === id);
    // 第2〜5章の台本は章に入る時に読む。ここでは本物の JSON をそのまま登録する
    for (const file of ["ch2_isolation", "ch2_main", "ch2_tournament", "ch3_main", "ch3_volk", "ch4_main", "ch4_dubai_daily", "ch5_main"]) {
      if (data.DB.dialogues[cue.dialogue]) break;
      const json = await (await fetch(`../data/dialogue/${file}.json`)).json();
      for (const d of json.dialogues || []) data.DB.dialogues[d.dialogue_id] ??= d;
    }
    const dlg = data.DB.dialogues[cue.dialogue];
    const at = dlg.lines.findIndex((l) => cut.conversationCutinCue(cue.dialogue, l) === cue);
    // 初登場カットインに入らないよう、出てくる人物は面識あり・紹介済みにしておく
    for (const l of dlg.lines) for (const who of [l.speaker, l.portrait]) if (typeof who === "string" && who && who !== "hajime") { core.markMet(who); intro.markIntroSeen(who); }
    window.cutinQA = { core, vn, cue, events: [], controller: new AbortController(), openedAt: performance.now() };
    const layer = () => document.querySelector(".vn-cutin-layer");
    vn.play(cue.dialogue, { fromLine: Math.max(0, at - 6), toLine: at + 2, signal: cutinQA.controller.signal });
    await new Promise((r) => requestAnimationFrame(r));
    new MutationObserver((records) => {
      for (const rec of records) {
        for (const n of rec.addedNodes) cutinQA.events.push({ t: performance.now(), type: "add", cue: n.dataset?.cue, text: document.querySelector(".vn-text").textContent });
        for (const n of rec.removedNodes) cutinQA.events.push({ t: performance.now(), type: "remove", cue: n.dataset?.cue });
        if (rec.type === "attributes" && rec.target.classList?.contains("leave")) cutinQA.events.push({ t: performance.now(), type: "leave", cue: rec.target.dataset.cue });
      }
    }).observe(layer(), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }, id);
}
/** 行を送りながら、置き場の行の文を出し終えるまで進める */
async function reachCue(page) {
  for (let i = 0; i < 12; i++) {
    await page.locator(".vn-next.show").waitFor();
    await page.waitForFunction(() => performance.now() - cutinQA.openedAt > 340);
    const atCue = await page.evaluate(() => cutinQA.events.some((e) => e.type === "add"));
    if (atCue) return;
    await page.locator(".vn-box").click();
  }
  throw new Error("置き場の行まで届かない");
}
const nowShown = (page) => page.evaluate(() => {
  const n = document.querySelector(".vn-cutin");
  if (!n) return null;
  // 舞台 1280×720 の座標（出入りの動きの途中でも変わらない offset で測る）
  const img = n.querySelector("img");
  return { cue: n.dataset.cue, src: img.src, decoded: img.complete && img.naturalWidth > 0, right: n.offsetLeft + n.offsetWidth, bottom: n.offsetTop + n.offsetHeight };
});

await suite("conversation-cutin-2990", async (check) => {
  for (const id of ["2a", "5", "5b", "4m", "3"]) {
    await check(`${id}：置いた行で出て、次の行で消える`, async (page) => {
      await start(page, id);
      await reachCue(page);
      await page.waitForFunction(() => document.querySelector(".vn-cutin img")?.complete);
      const shown = await nowShown(page);
      assert.equal(shown.cue, id);
      assert(shown.decoded, "立ち絵が読めている");
      assert.match(shown.src, /character_variants\/new\/hajime\/chr_hajime_/, "既存の new の立ち絵");
      assert(shown.right <= 640 && shown.bottom <= 526, `左側・本文欄より上（右端 ${shown.right}・下端 ${shown.bottom}）`);
      const add = await page.evaluate(() => cutinQA.events.find((e) => e.type === "add"));
      assert.equal(add.cue, id);
      if (SHOTS) {
        await page.waitForFunction(() => document.querySelector(".vn-cutin")?.getAnimations().every((a) => a.playState === "finished"));
        await page.screenshot({ path: path.join(SHOTS, `cutin-${id}.png`) });
      }
      await page.locator(".vn-box").click();
      await page.waitForFunction(() => !document.querySelector(".vn-cutin"));
      assert.equal(await page.evaluate(() => cutinQA.events.filter((e) => e.type === "add").length), 1, "1会話1回");
      await page.evaluate(() => cutinQA.controller.abort());
    });
  }

  // 同じ型の別場面（各案の先頭は上で詳しく見る）。置いた行で正しい案が1回出て、次の行（2c は0.9秒）で片付く
  const others = await (async () => {
    const { CUES } = await import("../../js/vn/conversation-cutin.js");
    return CUES.map((cue, index) => ({ ...cue, index })).filter((cue) => CUES.findIndex((c) => c.id === cue.id) !== cue.index);
  })();
  for (const cue of others) {
    await check(`${cue.id}（${cue.dialogue}）：置いた行で出て、片付く`, async (page) => {
      await start(page, cue.index);
      await reachCue(page);
      await page.waitForFunction(() => document.querySelector(".vn-cutin img")?.complete);
      const shown = await nowShown(page);
      assert.equal(shown?.cue, cue.id);
      assert(shown.decoded, "立ち絵が読めている");
      assert.match(shown.src, new RegExp(`chr_hajime_${cue.face}\\.`), `表情 ${cue.face}`);
      if (cue.id !== "2c") await page.locator(".vn-box").click();
      await page.waitForFunction(() => !document.querySelector(".vn-cutin"), null, { timeout: 5000 });
      assert.equal(await page.evaluate(() => cutinQA.events.filter((e) => e.type === "add").length), 1, "1会話1回");
      await page.evaluate(() => cutinQA.controller.abort());
    });
  }

  await check("4：次の行で0.3秒かけて薄れて消える", async (page) => {
    await start(page, "4");
    await reachCue(page);
    if (SHOTS) { await page.waitForFunction(() => document.querySelector(".vn-cutin img")?.complete); await page.screenshot({ path: path.join(SHOTS, "cutin-4.png") }); }
    await page.locator(".vn-box").click();
    await page.waitForFunction(() => cutinQA.events.some((e) => e.type === "remove"));
    const ev = await page.evaluate(() => cutinQA.events);
    const leave = ev.find((e) => e.type === "leave"), gone = ev.find((e) => e.type === "remove");
    assert(leave, "薄れる印が付く");
    assert(gone.t - leave.t >= 250, `薄れてから消える（${Math.round(gone.t - leave.t)}ms）`);
    await page.evaluate(() => cutinQA.controller.abort());
  });

  await check("2c：送らなくても0.9秒で消え、台詞はそのまま", async (page) => {
    await start(page, "2c");
    await reachCue(page);
    const text = await page.locator(".vn-text").textContent();
    await page.waitForFunction(() => cutinQA.events.some((e) => e.type === "remove"), null, { timeout: 5000 });
    const ev = await page.evaluate(() => cutinQA.events);
    const add = ev.find((e) => e.type === "add"), gone = ev.find((e) => e.type === "remove");
    assert.equal(add.cue, "2c");
    // setTimeout は負荷で遅れる向きにしか揺れない。下限だけ厳密に見る
    assert(gone.t - add.t >= 850, `0.9秒で消える（${Math.round(gone.t - add.t)}ms）`);
    assert.equal(await page.locator(".vn-text").textContent(), text, "台詞は送られない");
    await page.evaluate(() => cutinQA.controller.abort());
  });

  await check("LOG・SKIP で即座に消え、SKIP 中は出さない", async (page) => {
    await start(page, "5");
    await reachCue(page);
    assert(await page.locator(".vn-cutin").count());
    await page.locator('[data-test="vn-log"]').click();
    assert.equal(await page.locator(".vn-cutin").count(), 0, "LOG で消える");
    await page.locator(".log-head button").click();
    await page.evaluate(() => cutinQA.controller.abort());
    // SKIP しながら同じ行を通ると出さない
    await start(page, "5");
    await page.locator(".vn-next.show").waitFor();
    await page.locator('[data-test="vn-skip"]').click();
    await page.waitForFunction(() => !window.cutinQA.vn.isPlaying() || document.querySelector('[data-test="choice-0"]'), null, { timeout: 8000 }).catch(() => {});
    assert.equal(await page.evaluate(() => cutinQA.events.filter((e) => e.type === "add").length), 0, "SKIP 中は出さない");
    await page.evaluate(() => cutinQA.controller.abort());
  });
});
