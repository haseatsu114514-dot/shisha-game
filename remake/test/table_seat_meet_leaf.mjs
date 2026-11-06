// #2688 F13「卓へ座る」（ミニゲームの入口・出口）と A11「ゆっくり開口」（人に会う夜の入り）を実ブラウザで確かめる。
// 覆っている間は Enter・Space を止める／入口→ゲーム→出口の間に素の画面が出ない／続けて遊ぶときは幕を引き継ぐ／
// 動きを減らす設定ではフェード／高速送りでは出さない／中断では幕を残さない／緑のテーマ色は紫に置き換える。
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame(); core.state.day = 4;
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const seat = await import("./js/motions/table-seat.js");
    const meet = await import("./js/motions/meet-leaf.js");
    const transitions = await import("./js/core/transitions.js");
    window.T = { core, ui, data, seat, meet, transitions };
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_tonari_inside", "night"), { instant: true });
  });
}

/** 偽のミニゲーム: 少し遅れて #stage に画面を作り、ms 後に自分で片付けてから結果を返す */
const fakeGameSource = `(id, ms) => async () => {
  await new Promise((r) => setTimeout(r, 60));
  const root = document.createElement("div");
  root.id = id; root.className = "fake-game";
  root.style.cssText = "position:absolute;inset:0;background:#222;z-index:60";
  document.getElementById("stage").append(root);
  await new Promise((r) => setTimeout(r, ms));
  root.remove();
  return { completed: true, id };
}`;

async function runSeats(page, count) {
  return page.evaluate(async ({ count, src }) => {
    const fake = eval(src);
    const frames = [];
    let stop = false, blocked = 0, passed = 0;
    const sample = () => {
      if (stop) return;
      const cover = document.querySelector('[data-test="table-seat"]');
      frames.push({ cover: !!cover, type: cover?.dataset.transition || null, game: !!document.querySelector(".fake-game"), covering: T.transitions.isCovering() });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const onKey = (e) => { if (e.key === "Enter") passed++; };
    window.addEventListener("keydown", onKey);
    const tryEnter = () => { if (document.querySelector('[data-test="table-seat"]')) { const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); window.dispatchEvent(ev); if (ev.defaultPrevented) blocked++; } };
    const pokes = setInterval(tryEnter, 40);
    const results = [];
    for (let i = 0; i < count; i++) results.push(await T.seat.seated("TEST GAME", fake(`g${i}`, 2000))());
    await new Promise((r) => setTimeout(r, 1500));
    clearInterval(pokes); stop = true; window.removeEventListener("keydown", onKey);
    return { frames, results, blocked, passedWhileCovered: passed - 0, leftovers: document.querySelectorAll('[data-test="table-seat"]').length, covering: T.transitions.isCovering() };
  }, { count, src: fakeGameSource });
}

/** 入口が出てから出口が終わるまでに、幕もゲームもない素の場面の描画が挟まらないか */
function gaps(frames) {
  const first = frames.findIndex((f) => f.cover);
  const last = frames.map((f) => f.cover).lastIndexOf(true);
  return frames.slice(first, last + 1).filter((f) => !f.cover && !f.game).length;
}

await suite("table-seat-meet-leaf", async (check) => {
  await check("seat-normal", async (page) => {
    await prepare(page);
    const r = await runSeats(page, 1);
    assert.deepEqual(r.results, [{ completed: true, id: "g0" }], "ゲームの結果がそのまま返らない");
    assert.ok(r.frames.some((f) => f.cover && f.type === "table-seat"), "入口・出口の幕が出なかった");
    assert.ok(r.frames.some((f) => f.game && !f.cover), "ゲームが幕の下に隠れたまま遊べない");
    assert.equal(gaps(r.frames), 0, "入口から出口の間に素の場面が見えた");
    assert.ok(r.blocked > 0, "覆っている間の Enter を止めていない");
    assert.equal(r.leftovers, 0); assert.equal(r.covering, false);
    // 出口の幕はゲームが片付いた直後に出る（2回目の幕）
    const covers = r.frames.reduce((n, f, i) => n + (f.cover && !r.frames[i - 1]?.cover ? 1 : 0), 0);
    assert.equal(covers, 2, `入口と出口の2回の幕にならない（${covers}回）`);
  });

  await check("seat-chain-takes-over", async (page) => {
    await prepare(page);
    const r = await runSeats(page, 2);
    assert.equal(r.results.length, 2);
    assert.equal(gaps(r.frames), 0, "続けて遊ぶとき、出口と次の入口の間に素の場面が見えた");
    const covers = r.frames.reduce((n, f, i) => n + (f.cover && !r.frames[i - 1]?.cover ? 1 : 0), 0);
    assert.equal(covers, 3, `レッスン→本番の幕が引き継がれていない（${covers}回）`);
    assert.equal(r.leftovers, 0); assert.equal(r.covering, false);
  });

  await check("seat-reduced-fade", async (page) => {
    await prepare(page);
    const r = await runSeats(page, 1);
    assert.ok(r.frames.some((f) => f.cover), "動きを減らす設定でも入口が分かる形で出す");
    assert.ok(r.frames.filter((f) => f.cover).every((f) => f.type === "fade"), "動きを減らす設定でフェード以外が出た");
    assert.equal(r.leftovers, 0); assert.equal(r.covering, false);
  }, { reducedMotion: "reduce" });

  await check("seat-turbo-and-abort", async (page) => {
    await prepare(page);
    const r = await page.evaluate(async (src) => {
      const fake = eval(src);
      window.__remake ||= {}; window.__remake.vnTest = { ...(window.__remake.vnTest || {}), turbo: true };
      let seen = false;
      const obs = new MutationObserver(() => { if (document.querySelector('[data-test="table-seat"]')) seen = true; });
      obs.observe(document.getElementById("stage"), { childList: true, subtree: true });
      await T.seat.seated("TEST GAME", fake("t0", 50))();
      window.__remake.vnTest.turbo = false;
      let error = null;
      try { await T.seat.seated("TEST GAME", async () => { throw new Error("aborted"); })(); } catch (e) { error = e.message; }
      await new Promise((r) => setTimeout(r, 1200));
      obs.disconnect();
      return { seenTurbo: seen, error, leftovers: document.querySelectorAll('[data-test="table-seat"]').length, covering: T.transitions.isCovering() };
    }, fakeGameSource);
    assert.equal(r.seenTurbo, true, "中断の確認用に、高速送り後の通常の入口は出る");
    assert.equal(r.error, "aborted", "中断の例外を呼び出し側へ返していない");
    assert.equal(r.leftovers, 0, "中断で幕が残った"); assert.equal(r.covering, false, "中断で入力が止まったまま");
    const turboOnly = await page.evaluate(async (src) => {
      const fake = eval(src);
      window.__remake.vnTest.turbo = true;
      let seen = false;
      const obs = new MutationObserver(() => { if (document.querySelector('[data-test="table-seat"]')) seen = true; });
      obs.observe(document.getElementById("stage"), { childList: true, subtree: true });
      await T.seat.seated("TEST GAME", fake("t1", 50))();
      await new Promise((r) => setTimeout(r, 300));
      obs.disconnect(); window.__remake.vnTest.turbo = false;
      return seen;
    }, fakeGameSource);
    assert.equal(turboOnly, false, "テストの高速送りで幕が出た");
  });

  for (const mode of ["normal", "reduced"]) {
    await check(`meet-leaf-${mode}`, async (page) => {
      await prepare(page);
      const r = await page.evaluate(async () => {
        const t0 = performance.now();
        let cleared = false;
        const types = new Set();
        let stop = false;
        const sample = () => { if (stop) return; const n = document.querySelector('[data-test="meet-leaf"]'); if (n) types.add(n.dataset.transition); requestAnimationFrame(sample); };
        requestAnimationFrame(sample);
        await T.meet.meetLeaf(T.ui.layers.fx, "仕事を終え、LIMEで約束した場所へ。", { who: "ageha", clear: async () => { cleared = true; await T.ui.setBg(null, { instant: true }); } });
        const back = performance.now() - t0;
        const after = { line: document.querySelector('[data-test="meet-leaf"] .beat')?.textContent || "", covering: T.transitions.isCovering(), cover: !!document.querySelector('[data-test="meet-leaf"]') };
        // 次の場面の背景が置かれたら開く。覆っている間の背景替えは標準の幕を重ねない
        await T.ui.setBg(T.data.bgUrl("bg_shop", "night"));
        const stroke = !!document.querySelector(".scene-curtain");
        const t1 = performance.now();
        while (document.querySelector('[data-test="meet-leaf"]') && performance.now() - t1 < 4000) await new Promise((r) => setTimeout(r, 30));
        stop = true;
        return { back, cleared, after, stroke, types: [...types], leftovers: document.querySelectorAll('[data-test="meet-leaf"]').length, covering: T.transitions.isCovering(),
          colors: ["minto", "sai", "ageha", "naru", "sui", "nobody"].map((id) => T.meet.meetColor(id)) };
      });
      assert.equal(r.cleared, true, "覆っている間に前の場面を片付けていない");
      assert.equal(r.after.cover, true, "一行を読ませたあと、次の場面まで覆ったままになっていない");
      assert.equal(r.after.covering, true, "覆っている間の入力を止めていない");
      assert.equal(r.stroke, false, "覆っている間の背景替えで標準の幕が重なった");
      assert.equal(r.leftovers, 0); assert.equal(r.covering, false);
      assert.deepEqual(r.types, [mode === "reduced" ? "fade" : "meet-leaf"]);
      if (mode === "normal") assert.ok(r.back >= 1500 && r.back <= 2600, `ゆっくり開口の長さが想定外（${Math.round(r.back)}ms）`);
      // 緑寄り（ミント・サイ）は紫へ、不明は紫、ピンク・黄・青灰（須井）はそのまま
      assert.deepEqual(r.colors, ["#6b4fb0", "#6b4fb0", "#e956a5", "#eada39", "#afbccc", "#6b4fb0"]);
      console.log(`  meet-leaf ${mode}: 一行まで ${Math.round(r.back)} ms`);
    }, { reducedMotion: mode === "reduced" ? "reduce" : "no-preference" });
  }
});
