// 章の入りと物語の要所の一度きりの絵（#2688 A1・A2・A3・A5・A6・A7・A8／#2735）。実ブラウザで、
// 出る・覆っている間は Enter を止める・終わったら片付く・SKIP で短く・動きを減らす設定でフェードだけ・高速送りで省く、を確かめる。
// 会話の motion 行（龍の煙・SHISHA-9000 の走査）は実 VN で再生し、台本に置いた位置も確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const TALLY = { first: { hajime: 19, machine: 21 }, second: { hajime: 23, machine: 17 } };
// [呼ぶ関数, 層の名前, 引数, 設計上の長さ(ms)]。CIや混んだ機械では1コマが遅く、時計で測ると描画待ちの分だけ伸びるので、
// 時計の長さは設計の3倍までを許し（止まらないことの確認）、SKIPの短縮は演出が組んだアニメーションの長さの合計で比べる。
const CASES = [
  ["smokeThread", "smoke-thread", [], 900],
  ["lightsOut", "lights-out", [], 2500],
  ["leafWave", "leaf-wave", "mid", 1800],
  ["dragonSmoke", "dragon-smoke", [], 2000],
  ["scanName", "scan", ["SHISHA-9000"], 1500],
  ["seatLights", "seat-lights", [TALLY], 2800],
  ["mixingSmoke", "mixing-smoke", [["#ff8fc8", "#6aa8ff", "#ffb35c"]], 2800],
];

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
    const story = await import("./js/core/story-motions.js");
    // 場面のファイルを先に読み、タイトル画面の入りの動き（同じ入力止めを使う）が終わってから始める
    await Promise.all(["smoke-thread", "lights-out", "leaf-wave", "dragon-smoke", "scan", "seat-lights", "mixing-smoke"].map((n) => import(`./js/motions/${n}.js`)));
    await new Promise((r) => setTimeout(r, 2500));
    core.newGame(); core.save();
    // 下の画面の Enter が届いたかを数える（覆っている間は 0 のまま）
    const T = window.T = { core, ui, story, underKeys: 0 };
    const FADE_KEYS = new Set(["opacity", "offset", "easing", "composite", "computedOffset"]); // フェードだけの動きのキー
    // 本物のキーと同じく body に届ける（window の capture で止まる）。window 自身へ送ると同じ対象のリスナーは登録順に呼ばれてしまう
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") T.underKeys++; });
    T.run = async (name, args) => {
      const out = { mid: 0, midCovered: null, peak: null, total: 0, fadeOnly: true, anims: 0 };
      const started = performance.now();
      const mid = async () => { out.mid++; out.midCovered = !!ui.layers.fx.querySelector(".mo"); };
      const task = args === "mid" ? story[name](mid) : story[name](...args);
      let done = false;
      task.then(() => { done = true; });
      // 演出が組んだアニメーションを、層が消えるまで毎コマ集める（終わりの時刻＝設計上の長さ・動きの種類）
      const seen = new Set();
      let entered = false, shown = null;
      while (!done) {
        const node = ui.layers.fx.querySelector(".mo");
        if (node) {
          out.peak ||= node.dataset.motion;
          shown ??= performance.now();
          for (const a of node.getAnimations({ subtree: true })) {
            if (seen.has(a)) continue;
            seen.add(a);
            out.total += a.effect.getComputedTiming().endTime;
            for (const frame of a.effect.getKeyframes()) for (const key of Object.keys(frame)) if (!FADE_KEYS.has(key)) out.fadeOnly = false;
          }
          if (!entered && seen.size) {
            entered = true;
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
          }
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      out.anims = seen.size;
      out.ms = performance.now() - (shown ?? started);
      out.result = await task;
      out.left = ui.layers.fx.querySelectorAll(".mo").length;
      out.underKeys = T.underKeys;
      return out;
    };
  });
}

await suite("story-motions", async (check) => {
  await check("each-motion-plays-holds-input-and-cleans-up", async (page) => {
    await setup(page);
    for (const [name, motion, args, limit] of CASES) {
      const out = await page.evaluate(([n, a]) => T.run(n, a), [name, args]);
      assert.equal(out.result, true, `${name} played`);
      assert.equal(out.peak, motion, `${name} shows its own layer`);
      assert.equal(out.underKeys, 0, `${name} holds Enter while showing`);
      assert.equal(out.left, 0, `${name} removes its layer`);
      assert.ok(out.anims > 0 && !out.fadeOnly, `${name} moves (not just a fade)`);
      assert.ok(out.ms <= limit * 3, `${name} ends (${Math.round(out.ms)}ms, design ${limit}ms)`);
      if (args === "mid") assert.deepEqual([out.mid, out.midCovered], [1, true], `${name} swaps the scene while covered`);
      console.log(`  ${name}: ${Math.round(out.ms)}ms on this machine (design ${limit}ms) / ${out.anims} animations`);
    }
    // 終わった後は Enter が下の画面へ届く（止めっぱなしにしない）
    const after = await page.evaluate(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      return T.underKeys;
    });
    assert.equal(after, 1, "Enter reaches the page again after the motions");
  });

  await check("skip-shortens-without-dropping", async (page) => {
    await setup(page);
    for (const [name, , args] of CASES) {
      const full = await page.evaluate(([n, a]) => T.run(n, a), [name, args]);
      await page.evaluate(() => document.body.classList.add("vn-skip"));
      const short = await page.evaluate(([n, a]) => T.run(n, a), [name, args]);
      await page.evaluate(() => document.body.classList.remove("vn-skip"));
      assert.equal(short.result, true, `${name}: SKIP still shows the one-time motion (#1081 H05)`);
      assert.ok(short.total <= full.total * 0.6, `${name}: SKIP is shorter (${Math.round(short.total)} <= ${Math.round(full.total)} x0.6)`);
    }
  });

  await check("reduced-motion-fades-only", async (page) => {
    await setup(page);
    for (const [name, motion, args] of CASES) {
      const out = await page.evaluate(([n, a]) => T.run(n, a), [name, args]);
      assert.equal(out.peak, motion, `${name} still shows a fade`);
      assert.equal(out.left, 0);
      assert.equal(out.fadeOnly, true, `${name} only fades`);
      assert.ok(out.total <= 2400 && out.ms <= 3600, `${name} fade is short (${Math.round(out.total)}ms of fades, ${Math.round(out.ms)}ms here)`);
      if (args === "mid") assert.equal(out.mid, 1, `${name} still swaps the scene`);
    }
  }, { reducedMotion: "reduce" });


  await check("turbo-and-disabled-skip-but-still-swap", async (page) => {
    await setup(page);
    const out = await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      vn.vnTest.turbo = true;
      const turbo = await T.run("leafWave", "mid");
      vn.vnTest.turbo = false;
      T.story.ENABLED.leafWave = false;
      const off = await T.run("leafWave", "mid");
      return { turbo, off };
    });
    for (const [label, r] of Object.entries(out)) {
      assert.equal(r.result, false, `${label}: not shown`);
      assert.equal(r.peak, null, `${label}: no layer`);
      assert.equal(r.mid, 1, `${label}: background still changes`);
    }
  });

  await check("lime-header-scan-keeps-the-name", async (page) => {
    await setup(page);
    const out = await page.evaluate(async () => {
      const header = document.createElement("div");
      header.className = "lime-header";
      const name = document.createElement("span");
      name.className = "lime-name"; name.textContent = "？？？";
      header.append(name);
      T.ui.layers.fx.append(header);
      T.story.scanHeader(header);
      for (let i = 0; i < 100 && header.children.length < 2; i++) await new Promise((r) => setTimeout(r, 10));
      const during = { text: name.textContent, overlay: header.children.length > 1 };
      for (let i = 0; i < 300 && header.children.length > 1; i++) await new Promise((r) => setTimeout(r, 10));
      const after = { text: name.textContent, overlay: header.children.length, opacity: name.style.opacity };
      header.remove();
      return { during, after };
    });
    assert.deepEqual(out.during, { text: "？？？", overlay: true }, "the real name text stays while the look scrambles");
    assert.deepEqual(out.after, { text: "？？？", overlay: 1, opacity: "" }, "the overlay is removed");
  });

  await check("dialogue-motion-lines-play-in-vn", async (page) => {
    await setup(page);
    const placed = await page.evaluate(async () => {
      const read = async (file, id) => (await (await fetch(`../data/dialogue/${file}.json`)).json()).dialogues.find((d) => d.dialogue_id === id);
      const wang = await read("ch4_main", "ch4_wang_reception"), opening = await read("ch5_main", "ch5_opening");
      const dragon = Object.values(wang.branches).map((lines) => {
        const at = lines.findIndex((l) => l.type === "motion" && l.id === "dragon_smoke");
        return at > 0 && lines[at - 1].text.startsWith("長い呼吸から、龍のような煙が立ち上がる。");
      }).filter(Boolean).length;
      const at = opening.lines.findIndex((l) => l.type === "motion" && l.id === "scan");
      return { dragon, scan: at > 0 && opening.lines[at + 1].text.startsWith("SHISHA-9000。") && opening.lines[at].label };
    });
    assert.deepEqual(placed, { dragon: 3, scan: "SHISHA-9000" }, "motion lines sit right after the dragon narration and before 9000's name");
    // 実 VN: 地の文 → 龍の煙 → 次の行
    await page.evaluate(async () => {
      const vn = await import("./js/vn/engine.js");
      T.seen = [];
      T.done = false;
      T.task = vn.play({ dialogue_id: "qa_story_motion", lines: [
        { speaker: "", face: "", text: "長い呼吸から、龍のような煙が立ち上がる。" },
        { type: "motion", id: "dragon_smoke" },
        { speaker: "", face: "", text: "次の行" },
      ] }).then((r) => { T.done = true; return r; });
    });
    const motion = page.locator('#fx .mo[data-motion="dragon-smoke"]');
    await page.waitForFunction(() => document.querySelector("#vn")?.textContent.includes("長い呼吸から"), null, { timeout: 30000 });
    // 文字送りを終えて次へ（混んだ機械でも演出が出るまで押す）
    for (let i = 0; i < 20 && !(await motion.count()); i++) { await page.mouse.click(640, 600); await page.waitForTimeout(400); }
    await motion.waitFor({ state: "attached", timeout: 15000 });
    await page.mouse.click(640, 600); // 演出中のクリックは下の会話へ届かない
    await page.keyboard.press("Enter");
    const advanced = await page.evaluate(() => !!document.querySelector('#fx .mo[data-motion="dragon-smoke"]') && document.querySelector("#vn").textContent.includes("次の行"));
    assert.equal(advanced, false, "the dialogue waits while the dragon smoke covers it");
    await motion.waitFor({ state: "detached", timeout: 20000 });
    await page.waitForFunction(() => document.querySelector("#vn")?.textContent.includes("次の行"), null, { timeout: 15000 });
    for (let i = 0; i < 10 && !(await page.evaluate(() => T.done)); i++) { await page.mouse.click(640, 600); await page.waitForTimeout(400); }
    assert.equal(await page.evaluate(() => T.done), true, "the dialogue finishes after the motion");
  });
});
