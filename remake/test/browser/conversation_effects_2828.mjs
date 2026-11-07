// 会話演出の採用5件（#2828）を本編の会話エンジンで確かめる。
// 1 溜めの一拍（beat）／29 BGMの息継ぎ（duck）／3 文中ポーズ（[pause]）／7 心の声の薄墨（「（」始まり）／8 震え文字（[shiver]）。
// どれも印のある行だけで動き、SKIP・瞬間表示では省き、揺れは「揺れ・閃光を減らす」・端末の「動きを減らす」で止まる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const END = { type: "choice", choices: [{ text: "終える" }] };

/** 会話を始めて、最初の行を出し終えるまで待つ */
async function start(page, lines, config = {}) {
  await page.evaluate(async ({ lines, config }) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
    const vn = await import("./js/vn/engine.js"), audio = await import("./js/core/audio.js");
    if (!window.convfx) {
      core.newGame();
      ui.clearScreen();
      window.convfx = { core, vn, audio, blips: 0 };
      audio.SE.blip = () => { convfx.blips++; };
    }
    Object.assign(core.config, { textSpeed: 2, autoSpeed: 3, skipSeenOnly: false, bgmVolume: 0, seVolume: 0, voiceBlip: false, ...config });
    vn.vnTest.turbo = false;
    convfx.controller = new AbortController();
    convfx.result = null;
    vn.play({ dialogue_id: `convfx-2828-${Date.now()}`, lines }, { signal: convfx.controller.signal }).then(r => { convfx.result = r; });
  }, { lines, config });
  await page.locator(".vn-next.show").waitFor();
}
const text = page => page.locator(".vn-text").textContent();
const advance = page => page.locator(".vn-box").click();
const finished = page => page.locator(".vn-next.show").waitFor();
async function end(page) {
  for (let i = 0; i < 4 && !await page.locator('[data-test="choice-0"]').count(); i++) {
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-next.show") || document.querySelector('[data-test="choice-0"]'));
  }
  await page.locator('[data-test="choice-0"]').click();
  await page.waitForFunction(() => convfx.result);
}

await suite("conversation-effects-2828", async check => {
  await check("beat-holds-before-typing", async page => {
    await start(page, [{ text: "前の行。" }, { text: "……悪くない", beat: 800 }, { text: "次の行。", beat: 800 }, END]);
    await advance(page);
    await page.waitForTimeout(350); // 溜めが無ければ6字は約0.16秒で出終わる
    assert.equal(await text(page), "", "溜めの間は台詞欄が空");
    assert.equal(await page.locator(".vn-next.show").count(), 0, "溜めの間は▼を出さない");
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "……悪くない");
    await finished(page);
    // 溜めの途中のクリックは本文を最後まで出すだけで、次の行へは進まない
    await advance(page);
    await page.waitForTimeout(200); // 次の行の溜め（0.8秒）の途中
    await advance(page);
    assert.equal(await text(page), "次の行。");
    await finished(page);
    await end(page);
  });

  await check("pause-stops-without-marker", async page => {
    await start(page, [{ text: "前の行。" }, { text: "レモンは[pause]2グラム、です。" }, { text: "次の行。" }, END]);
    await page.evaluate(() => {
      convfx.samples = [];
      const box = document.querySelector(".vn-text"), next = document.querySelector(".vn-next");
      convfx.observer = new MutationObserver(() => convfx.samples.push({ t: performance.now(), text: box.textContent, next: next.classList.contains("show") }));
      convfx.observer.observe(document.querySelector("#vn"), { subtree: true, childList: true, characterData: true, attributes: true });
    });
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "レモンは2グラム、です。");
    await finished(page);
    const stop = await page.evaluate(() => {
      convfx.observer.disconnect();
      const at = convfx.samples.findIndex(s => s.text === "レモンは");
      const after = convfx.samples.findIndex((s, i) => i > at && s.text !== "レモンは");
      return { found: at >= 0, held: convfx.samples[after].t - convfx.samples[at].t,
        marker: convfx.samples.slice(at, after).some(s => s.next) };
    });
    assert.ok(stop.found, "[pause] の位置で一度止まる");
    assert.ok(stop.held >= 300, `約0.4秒止まる（${Math.round(stop.held)}ms）`);
    assert.equal(stop.marker, false, "止まっている間に▼を出さない");
    assert.doesNotMatch(await page.locator(".vn-text").innerHTML(), /pause/);
    await end(page);
  });

  await check("pause-click-completes-line", async page => {
    await start(page, [{ text: "前の行。" }, { text: "レモンは[pause]2グラム、です。" }, { text: "次の行。" }, END]);
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "レモンは");
    await advance(page);
    assert.equal(await text(page), "レモンは2グラム、です。", "止まっている間のクリックは本文を出し切る");
    await finished(page);
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "次の行。");
    await finished(page);
    await end(page);
  });

  await check("inner-voice-pale-small-silent", async page => {
    await start(page, [{ text: "声のある行です。少し長めに話します。" }, { text: "（……言えなかった。言えばよかった）" }, END]);
    assert.ok(await page.evaluate(() => convfx.blips) > 0, "ふつうの行は文字送りの音が鳴る");
    assert.equal(await page.locator(".vn-text .tx-voice").count(), 0);
    await page.evaluate(() => { convfx.blips = 0; });
    await advance(page);
    await finished(page);
    assert.equal(await page.evaluate(() => convfx.blips), 0, "心の声は文字送りの音を鳴らさない");
    const style = await page.evaluate(() => {
      const box = getComputedStyle(document.querySelector(".vn-text")), voice = getComputedStyle(document.querySelector(".vn-text .tx-voice"));
      return { box: parseFloat(box.fontSize), voice: parseFloat(voice.fontSize), color: voice.color, boxColor: box.color };
    });
    assert.ok(style.voice < style.box, `少し小さい（${style.voice}px < ${style.box}px）`);
    assert.notEqual(style.color, style.boxColor, "薄墨の色");
    assert.equal(await text(page), "（……言えなかった。言えばよかった）");
    await end(page);
  });

  await check("shiver-moves-and-calms", async page => {
    await start(page, [{ text: "[shiver]さ、さむい……[/shiver]\n路地の風、冷たいね。" }, END]);
    const motion = () => page.evaluate(() => getComputedStyle(document.querySelector(".vn-text .tx-shiver")).animationName);
    assert.equal(await page.locator(".vn-text .tx-shiver").count(), 1);
    assert.equal(await page.locator(".vn-text .tx-shiver").textContent(), "さ、さむい……");
    assert.equal(await motion(), "tx-shiver");
    await page.evaluate(() => document.body.classList.add("reduce-shake"));
    assert.equal(await motion(), "none", "揺れ・閃光を減らす設定で止まる");
    await page.evaluate(() => document.body.classList.remove("reduce-shake"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await motion(), "none", "端末の「動きを減らす」で止まる");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => document.body.classList.add("vn-skip"));
    assert.equal(await motion(), "none", "SKIP中は止まる");
    await page.evaluate(() => document.body.classList.remove("vn-skip"));
    await end(page);
  });

  await check("duck-dips-holds-and-returns", async page => {
    await start(page, [{ text: "前の行。" }, { text: "息継ぎの行。", duck: true }, { text: "続けて息継ぎ。", duck: true }, { text: "戻る行。" },
      { text: "最後も息継ぎ。", duck: true }, END]);
    const level = () => page.evaluate(() => convfx.audio.bgmDuckLevel());
    assert.equal(await level(), 1);
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "息継ぎの行。");
    assert.equal(await level(), 0.5, "duck の行で約 −6dB");
    await finished(page);
    await page.evaluate(() => { convfx.levels = []; convfx.sampler = setInterval(() => convfx.levels.push(convfx.audio.bgmDuckLevel()), 4); });
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "続けて息継ぎ。");
    await finished(page);
    assert.deepEqual([...new Set(await page.evaluate(() => { clearInterval(convfx.sampler); return convfx.levels; }))], [0.5], "続く duck の行では戻さない");
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "戻る行。");
    assert.equal(await level(), 1, "duck の無い行で戻る");
    await finished(page);
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "最後も息継ぎ。");
    await finished(page);
    assert.equal(await level(), 0.5);
    await end(page);
    assert.equal(await level(), 1, "選択肢へ進むところで戻す");
  });

  await check("duck-released-on-abort", async page => {
    await start(page, [{ text: "息継ぎの行。", duck: true }, END]);
    assert.equal(await page.evaluate(() => convfx.audio.bgmDuckLevel()), 0.5);
    await page.evaluate(async () => { convfx.controller.abort(); await new Promise(r => setTimeout(r, 50)); });
    assert.equal(await page.evaluate(() => convfx.result?.cancelled), true);
    assert.equal(await page.evaluate(() => convfx.audio.bgmDuckLevel()), 1, "中断でも戻す");
  });

  await check("skip-and-instant-drop-effects", async page => {
    // 瞬間表示: 溜め・文中ポーズを待たずに出し切る
    await start(page, [{ text: "前の行。" }, { text: "溜めて[pause]止まる行。", beat: 800, duck: true }, END], { textSpeed: 4 });
    await advance(page);
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "溜めて止まる行。", null, { timeout: 300 });
    await end(page);
    // SKIP: 溜め・ポーズ・息継ぎを省いて最後まで送る
    await start(page, [{ text: "前の行。" }, { text: "溜めの行。", beat: 800, duck: true }, { text: "止まる[pause]行。", duck: true }, END]);
    await page.evaluate(() => { convfx.levels = []; convfx.sampler = setInterval(() => convfx.levels.push(convfx.audio.bgmDuckLevel()), 4); convfx.t0 = performance.now(); });
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator('[data-test="choice-0"]').waitFor();
    const run = await page.evaluate(() => { clearInterval(convfx.sampler); return { levels: [...new Set(convfx.levels)], ms: performance.now() - convfx.t0 }; });
    assert.deepEqual(run.levels, [1], "SKIP中は息継ぎしない");
    assert.ok(run.ms < 1500, `SKIPは溜めを待たない（${Math.round(run.ms)}ms）`);
    await end(page);
  });
});
