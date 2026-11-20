// 会話カットイン（はじめの顔の帯。#2990・2026-11-20 再設計 CCR）を本編の会話エンジンと実際の台本で確かめる。
// 置いた行で、カットイン専用の絵（img/ui/conversation_cutin/）を入れた帯が出て、次の行で消える（重い型・沈む・受け取るは薄れて消える、
// 軽い型・決意は自分から消える）。相手の行の型は台詞が出切ってから出る。LOG・SKIP で即座に消え、SKIP 中は出さない。
// 置き場と条件の表は remake/test/conversation_cutin.mjs が見る。
// #3417: 同じ型の別場面（第2〜5章へ広げた置き場など）も、実際の台本の再生で出て次の行で片付くことを1件ずつ確かめる。
import assert from "node:assert/strict";
import path from "node:path";
import { suite } from "./support.mjs";

const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;

/** 置き場の行の少し前から本物の台本を再生し、カットインの層の出入りを時刻つきで記録する。id は案の番号か CUES の添字 */
async function start(page, id, { textSpeed = 4 } = {}) {
  await page.evaluate(async ({ id, textSpeed }) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js");
    const vn = await import("./js/vn/engine.js"), intro = await import("./js/vn/intro.js"), cut = await import("./js/vn/conversation-cutin.js");
    core.newGame();
    ui.clearScreen();
    Object.assign(core.config, { textSpeed, skipSeenOnly: false, bgmVolume: 0, seVolume: 0, voiceBlip: false, portraitStyle: "new" });
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
    // fromLine より前の set_flag は再生されないので、置いた行の手前の状態だけ先に揃える
    const from = Math.max(0, at - 6);
    for (const l of dlg.lines.slice(0, from)) {
      if (l.type === "set_flag" && l.flag) {
        core.state.flags[l.flag] = true;
        const met = /^_met_(.+)$/.exec(l.flag);
        if (met) { core.markMet(met[1]); intro.markIntroSeen(met[1]); }
      }
    }
    window.cutinQA = { core, vn, cue, events: [], controller: new AbortController(), openedAt: performance.now() };
    const layer = () => document.querySelector(".vn-cutin-layer");
    vn.play(cue.dialogue, { fromLine: Math.max(0, at - 6), toLine: at + 2, signal: cutinQA.controller.signal });
    await new Promise((r) => requestAnimationFrame(r));
    new MutationObserver((records) => {
      for (const rec of records) {
        // 出た瞬間の位置と絵を記録する（軽い型・決意は自分から消えるので、後から測ると消えていることがある）
        for (const n of rec.addedNodes) {
          if (!n.classList?.contains("vn-cutin")) continue;
          const img = n.querySelector("img");
          cutinQA.events.push({
            t: performance.now(), type: "add", cue: n.dataset.cue, frame: n.dataset.frame, art: n.dataset.art, src: img?.src,
            text: document.querySelector(".vn-text").textContent, next: !!document.querySelector(".vn-next.show"),
            left: n.offsetLeft, right: n.offsetLeft + n.offsetWidth, bottom: n.offsetTop + n.offsetHeight,
          });
        }
        for (const n of rec.removedNodes) if (n.classList?.contains("vn-cutin")) cutinQA.events.push({ t: performance.now(), type: "remove", cue: n.dataset?.cue });
        if (rec.type === "attributes" && rec.target.classList?.contains("vn-cutin") && rec.target.classList.contains("leave")) cutinQA.events.push({ t: performance.now(), type: "leave", cue: rec.target.dataset.cue });
      }
    }).observe(layer(), { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }, { id, textSpeed });
}
/** 行を送りながら、置き場の行の文を出し終えるまで進める */
async function waitAdvanceReady(page) {
  // raf 待ち（waitForFunction の既定）は、画面の動きが重いときに進まないことがあるので、
  // evaluate で定期的に見る。選択肢の行では .vn-next.show が出ない。
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const kind = await page.evaluate(() => {
      if (document.querySelector('[data-test="choice-0"]')) return "choice";
      if (document.querySelector(".vn-next.show")) return "next";
      return "";
    });
    if (kind) return kind;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("送り待ちが切れた");
}
async function reachCue(page) {
  // 置き場の少し前から再生するため、途中の選択肢（例: ch1_tsumugi_first の出し方）も進める。
  for (let i = 0; i < 20; i++) {
    const kind = await waitAdvanceReady(page);
    await page.evaluate(async () => {
      while (performance.now() - (window.cutinQA?.openedAt || 0) <= 340) {
        await new Promise((r) => setTimeout(r, 20));
      }
    });
    const atCue = await page.evaluate(() => cutinQA.events.some((e) => e.type === "add"));
    if (atCue) return;
    if (kind === "choice") {
      await page.locator('[data-test="choice-0"]').click();
      continue;
    }
    await page.locator(".vn-box").click();
  }
  throw new Error("置き場の行まで届かない");
}
/** 帯の位置: 寄りの帯は左側だけ、全幅は決意だけ。どちらも本文欄（y526〜）より上 */
function assertPlaced(add) {
  const wide = add.frame === "eyes";
  assert(add.left >= 0 && add.right <= (wide ? 1280 : 520) && add.bottom <= 526, `${add.cue}: 帯の位置（${add.frame}・右端 ${add.right}・下端 ${add.bottom}）`);
}
/** 絵が読める（専用の絵のフォルダの、置き場の絵） */
const decodes = (page, src) => page.evaluate((src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = src; }), src);
const firstAdd = (page) => page.evaluate(() => cutinQA.events.find((e) => e.type === "add"));

await suite("conversation-cutin-2990", async (check) => {
  for (const id of ["2a", "2c", "5", "5b", "4m", "3"]) {
    await check(`${id}：置いた行で出て、片付く`, async (page) => {
      await start(page, id);
      await reachCue(page);
      const add = await firstAdd(page);
      assert.equal(add.cue, id);
      assert.match(add.src, /img\/ui\/conversation_cutin\/hajime_(flustered|downcast|grateful|resolve)\.webp$/, "カットイン専用の絵");
      assert(await decodes(page, add.src), "絵が読める");
      assertPlaced(add);
      if (SHOTS && !["2c", "3"].includes(id)) {
        await page.waitForFunction(() => document.querySelector(".vn-cutin")?.getAnimations({ subtree: true }).every((a) => a.playState === "finished"));
        await page.screenshot({ path: path.join(SHOTS, `cutin-${id}.png`) });
      }
      // 軽い型・決意は送らなくても消える。ほかは次の行で消える
      if (!["2c", "3"].includes(id)) await page.locator(".vn-box").click();
      await page.waitForFunction(() => !document.querySelector(".vn-cutin, .vn-cutin-dim"), null, { timeout: 5000 });
      assert.equal(await page.evaluate(() => cutinQA.events.filter((e) => e.type === "add").length), 1, "1会話1回");
      await page.evaluate(() => cutinQA.controller.abort());
    });
  }

  // 同じ型の別場面（各型の先頭は上で詳しく見る）。置いた行で正しい型・絵が1回出て、片付く
  const others = await (async () => {
    const { CUES } = await import("../../js/vn/conversation-cutin.js");
    return CUES.map((cue, index) => ({ ...cue, index })).filter((cue) => CUES.findIndex((c) => c.id === cue.id) !== cue.index);
  })();
  for (const cue of others) {
    await check(`${cue.id}（${cue.dialogue}）：置いた行で出て、片付く`, async (page) => {
      await start(page, cue.index);
      await reachCue(page);
      const add = await firstAdd(page);
      assert.equal(add?.cue, cue.id);
      assert.match(add.src, new RegExp(`hajime_${cue.art}\\.webp$`), `絵 ${cue.art}`);
      assert(await decodes(page, add.src), "絵が読める");
      assertPlaced(add);
      if (!["2c", "3"].includes(cue.id)) await page.locator(".vn-box").click();
      await page.waitForFunction(() => !document.querySelector(".vn-cutin, .vn-cutin-dim"), null, { timeout: 5000 });
      assert.equal(await page.evaluate(() => cutinQA.events.filter((e) => e.type === "add").length), 1, "1会話1回");
      await page.evaluate(() => cutinQA.controller.abort());
    });
  }

  await check("相手の行：台詞が出切ってから出る", async (page) => {
    // 文字を1文字ずつ出す速さで、相手が「その顔」と言う行まで進める
    await start(page, "2a", { textSpeed: 2 });
    await reachCue(page);
    const add = await firstAdd(page);
    const cue = await page.evaluate(() => cutinQA.cue.text);
    assert.equal(add.text, cue.replace(/\n/g, ""), "出た時には台詞が最後まで出ている");
    assert(add.next, "送りの印（▼）と同時");
    await page.evaluate(() => cutinQA.controller.abort());
  });

  await check("沈む：次の行で0.3秒かけて薄れて消える", async (page) => {
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

  await check("2c：送らなくても約1秒で消え、台詞はそのまま", async (page) => {
    await start(page, "2c");
    await reachCue(page);
    const text = await page.locator(".vn-text").textContent();
    await page.waitForFunction(() => cutinQA.events.some((e) => e.type === "remove"), null, { timeout: 5000 });
    const ev = await page.evaluate(() => cutinQA.events);
    const add = ev.find((e) => e.type === "add"), gone = ev.find((e) => e.type === "remove");
    assert.equal(add.cue, "2c");
    // setTimeout は負荷で遅れる向きにしか揺れない。下限だけ厳密に見る（出ている1.15秒＋閉じる0.18秒）
    assert(gone.t - add.t >= 1280, `約1秒出てから閉じる（${Math.round(gone.t - add.t)}ms）`);
    assert.equal(await page.locator(".vn-text").textContent(), text, "台詞は送られない");
    await page.evaluate(() => cutinQA.controller.abort());
  });

  await check("3：決意は全幅の帯で、帯より上を暗くし、送らなくても消える", async (page) => {
    await start(page, "3");
    await reachCue(page);
    const add = await firstAdd(page);
    assert.equal(add.frame, "eyes");
    assert.equal(add.right, 1280, "全幅");
    await page.waitForFunction(() => !document.querySelector(".vn-cutin, .vn-cutin-dim"), null, { timeout: 5000 });
    const ev = await page.evaluate(() => cutinQA.events);
    const gone = ev.find((e) => e.type === "remove");
    assert(gone.t - add.t >= 900, `0.8秒出てから閉じる（${Math.round(gone.t - add.t)}ms）`);
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
