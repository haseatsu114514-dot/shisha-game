// Title display, landscape only: real inputs, isolated storage, no player's saves.
// DS風・スマホ縦画面モードは廃止（2026-11-04「横画面一本にして」・2026-11-10「DSモードは開発中止」オーナー決定）。
// タイトルにも CONFIG にも表示の切り替えは出さない。以前の DS風の設定（suien_title_layout）は起動時に消す。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const dir = process.env.ARTIFACT_DIR || ".codex/artifacts/title-layout";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
const key = "suien_title_layout";
const button = (p, id) => p.locator(`[data-test="${id}"]`);
async function ready(p) {
  await button(p, "title-new").waitFor({ timeout: 35000 });
  await p.locator("#boot").waitFor({ state: "detached" });
}
async function snapshot(p) {
  return p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k !== "suien_title_layout").sort().map(k => [k, localStorage.getItem(k)])));
}
async function seed(p) {
  await p.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newState(); Object.assign(s, { schema: 14, phase: "daily", day: 6, slot: 1, money: 45678, stamina: 73 });
    s.flags._morning_6 = true; s.flags._lime_tut = 1; s.flags._qa_preserved = "keep";
    s.lovers = ["hiyori"]; s.affinity.hiyori = 66; s.relationshipMemories = ["actually-read"];
    delete s.trpg.club;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(s));
    localStorage.setItem("suien_remake_slot1", JSON.stringify(s));
    localStorage.setItem("qa_unrelated", "keep");
  });
  await p.reload(); await ready(p);
}

const noDisplaySwitch = async p => {
  assert.equal(await p.locator(".title-layout-toolbar, .title-layout-options, .cfg-title-layout, [data-test^='title-layout-'], [data-test^='game-layout-']").count(), 0,
    "display switch (normal/DS) must not exist anymore");
};
async function stageIsOriginal(p) {
  // 通常表示は常に 1280×720 の固定ステージ（2026-11-09 オーナー決定・#3035。ワイド拡張 #2861 は廃止）
  const [size] = await p.locator("#stage").evaluate(n => [[n.offsetWidth, n.offsetHeight]]);
  assert.deepEqual(size, [1280, 720], "normal/unsupported screen must retain original sizing");
}
async function landscapeOnly(p) {
  assert.equal(await p.locator("body.game-ds, .title-ds-panel, .game-ds-panel").count(), 0, "no DS panels");
  assert.equal(await p.locator(".title[data-layout='ds']").count(), 0);
  assert.equal(await p.evaluate(() => document.documentElement.dataset.dsLayout ?? null), null);
  await stageIsOriginal(p);
}
async function check(name, options, run, setup = null) {
  // 重い端末では CASE_FILTER=<名前の一部> で1ケースずつ流せる（CIは全件）。
  if (process.env.CASE_FILTER && !name.includes(process.env.CASE_FILTER)) return;
  const context = await browser.newContext(options); const p = await context.newPage();
  const errors = []; p.on("pageerror", e => errors.push(e.message));
  try {
    if (setup) await setup(p);
    await p.goto(base); await ready(p); await run(p);
    assert.deepEqual(errors, [], "Unexpected browser errors");
    await p.screenshot({ path: path.join(dir, `${name}.png`) });
    results.push({ name, status: "passed" }); console.log(`PASS: ${name}`);
  } catch (e) {
    results.push({ name, status: "failed", error: e.stack }); console.error(`FAIL: ${name}\n${e.stack}`);
    await p.screenshot({ path: path.join(dir, `${name}-failed.png`) }).catch(() => {});
  } finally { await context.close(); }
}
const sizes = { pc: { viewport: { width: 1280, height: 720 } }, phone: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
try {
  for (const [device, options] of Object.entries(sizes)) {
    await check(`${device}-menus-and-reload`, options, async p => {
      await landscapeOnly(p); await noDisplaySwitch(p);
      await seed(p); const before = await snapshot(p);
      const artBefore = await p.locator(".title-art").getAttribute("data-art");
      await button(p, "title-config").focus(); await p.keyboard.press("Enter");
      await p.locator("#modal.show .cfg").waitFor(); await noDisplaySwitch(p);
      await button(p, "cfg-close").click(); await p.waitForFunction(() => !document.querySelector("#modal.show"));
      assert.equal(await p.locator(".title-art").getAttribute("data-art"), artBefore, "CONFIG must keep the approved original art");
      assert.equal(await p.locator(".title-item").count(), 4);
      assert.equal(await button(p, "title-load").isEnabled(), true);
      await p.screenshot({ path: path.join(dir, `${device}-title.png`) });
      await p.reload(); await ready(p);
      assert.deepEqual(await snapshot(p), before, "reload changed game data");
      // 縦持ちはタイトルから回転案内だけを出す（#2826）。横に戻せば操作できる。
      if (device === "phone") {
        assert.equal(await p.locator("#rotate-hint").isVisible(), false, "landscape: no guard");
        await p.setViewportSize({ width: 390, height: 844 });
        assert.equal(await p.locator("#rotate-hint").isVisible(), true, "portrait title shows only the guard");
        assert.equal(await p.evaluate(() => { const g = document.querySelector("#rotate-hint"); const h = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return g === h || g.contains(h); }), true);
        await p.setViewportSize({ width: 844, height: 390 });
      }
      // Native keyboard activation remains available.
      await button(p, "title-config").focus(); await p.keyboard.press("Enter");
      await p.locator("#modal.show .cfg").waitFor();
      await p.locator("#modal.show .modal-actions button").click();
      await button(p, "title-gallery").click();
      if (device === "phone") {
        const reachable = await p.evaluate(() => {
          const hit = node => {
            const r = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          };
          return { close: hit(document.querySelector(".gal-close")),
            noTitleSettings: !document.querySelector(".title-layout-toolbar, .title-layout-options") };
        });
        assert.deepEqual(reachable, { close: true, noTitleSettings: true }, "Gallery close must remain reachable without display settings overlapping");
        await p.screenshot({ path: path.join(dir, "normal-gallery-landscape-open.png") });
      }
      await button(p, "gallery-close").click();
      await button(p, "title-load").click(); await button(p, "slot-cancel").click();
      await button(p, "title-load").click(); await button(p, "slot-cancel").click();
      await button(p, "title-new").click(); await button(p, "cancel-new").click();
      assert.deepEqual(await snapshot(p), before, "opening/cancelling menus changed save");
      assert.equal(await button(p, "title-trpg").count(), 0);
      await landscapeOnly(p);
    });
    await check(`${device}-legacy-continue`, options, async p => {
      await seed(p);
      await button(p, "title-load").click(); await button(p, "slot-1").click();
      await p.locator("body.vn-open").waitFor();
      await landscapeOnly(p); await noDisplaySwitch(p);
      const saved = await p.evaluate(async () => {
        const { state } = await import("./js/core/state.js");
        return { money:state.money, lovers:state.lovers, memory:state.relationshipMemories, marker:state.flags._qa_preserved };
      });
      assert.deepEqual(saved, { money:45678, lovers:["hiyori"], memory:["actually-read"], marker:"keep" });
    });
  }
  // 移行: 以前に DS風（や壊れた値）を選んでいた端末でも、通常の横画面で開き、古い表示設定だけを消す。セーブは触らない。
  for (const [name, value] of [["ds", "ds"], ["normal", "normal"], ["invalid", "broken"]]) {
    await check(`legacy-${name}-preference-migrates`, sizes.phone, async p => {
      await seed(p); const before = await snapshot(p);
      await p.evaluate(v => localStorage.setItem("suien_title_layout", v), value);
      await p.reload(); await ready(p);
      await landscapeOnly(p); await noDisplaySwitch(p);
      assert.equal(await p.evaluate(() => localStorage.getItem("suien_title_layout")), null, "legacy display preference is removed");
      assert.deepEqual(await snapshot(p), before, "migration must not touch saves or other settings");
      await button(p, "title-load").click(); await button(p, "slot-1").click();
      await p.locator("body.vn-open").waitFor(); await landscapeOnly(p);
    });
  }
  // 旧「通常版で開き直す」リンク（?titleLayout=normal）や、ロード予約が残っていてもふつうに開く。
  await check("legacy-recovery-url", sizes.phone, async p => {
    await seed(p); const before = await snapshot(p);
    await p.evaluate(() => localStorage.setItem("suien_title_layout", "ds"));
    await p.goto(new URL("?titleLayout=normal", base).href); await ready(p);
    await landscapeOnly(p);
    assert.deepEqual(await snapshot(p), before);
  });
  // 古い設定の削除が失敗する端末（ストレージ禁止など）でも起動して遊べる。
  for (const operation of ["getItem", "setItem", "removeItem"]) {
    await check(`storage-${operation}-failure`, sizes.phone, async p => {
      await landscapeOnly(p); await noDisplaySwitch(p);
      await button(p, "title-config").click(); await p.locator("#modal.show .cfg").waitFor();
      await p.locator("#modal.show .modal-actions button").click();
      await button(p, "title-gallery").click(); await button(p, "gallery-close").click();
      await button(p, "title-new").click(); await p.locator("body.vn-open").waitFor(); await landscapeOnly(p);
    }, p => p.addInitScript(operation => {
      localStorage.setItem("suien_title_layout", "ds");
      const original = Storage.prototype[operation];
      Storage.prototype[operation] = function(k, ...args) {
        if (k === "suien_title_layout") throw new DOMException("blocked", "SecurityError");
        return original.call(this, k, ...args);
      };
    }, operation));
  }
  await check("image-failure", sizes.phone, async p => {
    assert.equal(await p.locator(".title-item").count(), 4);
    await p.locator(".title-logo-fallback:not([hidden])").waitFor();
    await button(p, "title-config").click(); await p.locator("#modal.show .cfg").waitFor();
    await p.locator("#modal.show .modal-actions button").click(); await landscapeOnly(p);
  }, p => p.route(/(?:title_arts\/|bg_title|ui_title_logo_rich)/, route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid-image" })));
  // #2863: スマホ横持ち（Safariのバーあり含む）で、通常版の文字は実寸11px以上・押す所は38px以上。
  // 副題（はじめから等）は残して実寸11px以上（2026-11-08 オーナー指示）。主文より小さく、主文のすぐ右の同じ行に並ぶ。
  // 下中央の操作ヒント・表示設定は出さず、メニュー行は72px以上・行間16px。
  for (const [w, h] of [[844, 390], [844, 340]]) await check(`phone-landscape-${w}x${h}-sizes`, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true }, async p => {
    for (const cycle of [false, true]) {
      if (cycle) {
        // NEXT CYCLE が出る5行でもステージ内に収まる（導線の表示だけを確かめる。開始はしない）
        await p.evaluate(async () => {
          const meta = await import("./js/core/cycle-meta.js");
          meta.saveCycleMeta({ ...meta.emptyCycleMeta(), unlocked: true });
        });
        await p.reload(); await ready(p); await button(p, "title-next-cycle").waitFor();
        assert.equal(await p.locator(".title-item").count(), 5);
      }
      const m = await p.evaluate(() => {
        // 縮み率は高さで測る（ワイドステージ #2861 では幅が1280より広がるが、高さは720のまま）
        const stage = document.querySelector("#stage").getBoundingClientRect(), k = stage.height / 720;
        const items = [...document.querySelectorAll(".title-item")].map(n => n.getBoundingClientRect());
        const shown = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && !s.clipPath.includes("inset(50%)"); };
        const texts = [...document.querySelectorAll(".title *")].filter(n => [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && shown(n))
          .map(n => ({ text: n.textContent.trim(), px: parseFloat(getComputedStyle(n).fontSize) * k }));
        return { k, texts, heights: items.map(r => r.height / k), real: items.map(r => r.height),
          gaps: items.slice(1).map((r, i) => (r.top - items[i].bottom) / k), bottom: Math.max(...items.map(r => r.bottom)) <= stage.bottom + 1,
          subtitles: [...document.querySelectorAll(".title-item")].map(n => {
            const en = n.querySelector(".ti-en"), ja = n.querySelector(".ti-ja"), a = en.getBoundingClientRect(), b = ja.getBoundingClientRect();
            return { text: ja.textContent, shown: shown(ja), px: parseFloat(getComputedStyle(ja).fontSize) * k, enPx: parseFloat(getComputedStyle(en).fontSize) * k,
              rightOfEn: b.left >= a.right - .5 && b.left - a.right <= 16 * k + 1, sameLine: b.top < a.bottom && b.bottom > a.top,
              inRow: b.right <= n.getBoundingClientRect().right + .5 && b.bottom <= n.getBoundingClientRect().bottom + .5 };
          }), foot: document.querySelectorAll(".title-foot").length,
          toolbar: document.querySelectorAll(".title-layout-toolbar, .title-layout-options").length };
      });
      assert(m.texts.length > 0 && m.texts.every(t => t.px >= 11 - 1e-6), JSON.stringify(m.texts));
      assert(m.heights.every(v => v >= 72 - .5) && m.real.every(v => v >= 38 - .5), JSON.stringify(m));
      assert(m.gaps.every(v => Math.abs(v - 16) < .5) && m.bottom, JSON.stringify(m));
      assert(m.subtitles.length === m.heights.length && m.subtitles.every(t => t.shown && t.px >= 11 - 1e-6 && t.px < t.enPx && t.rightOfEn && t.sameLine && t.inRow),
        JSON.stringify(m.subtitles));
      assert.deepEqual([m.foot, m.toolbar], [0, 0]);
    }
    // 表示設定の行（通常版／DS風）は CONFIG から消えた。CONFIG は開けて、閉じられる。
    await button(p, "title-config").tap(); await p.locator("#modal.show .cfg").waitFor();
    assert.equal(await p.locator(".cfg-title-layout, .title-layout-options, [data-test^='title-layout-']").count(), 0);
    await button(p, "cfg-close").tap(); await p.waitForFunction(() => !document.querySelector("#modal.show"));
  });
  // PC（1280×720・マウス）の副題は従来どおり15pxで、主文のすぐ右に並ぶ（スマホ用の拡大を持ち込まない）。
  await check("pc-subtitles-unchanged", sizes.pc, async p => {
    const subs = await p.locator(".title-item").evaluateAll(ns => ns.map(n => {
      const a = n.querySelector(".ti-en").getBoundingClientRect(), ja = n.querySelector(".ti-ja"), b = ja.getBoundingClientRect();
      return { px: parseFloat(getComputedStyle(ja).fontSize), gap: Math.round(b.left - a.right), sameLine: b.top < a.bottom && b.bottom > a.top, w: b.width };
    }));
    assert(subs.length === 4 && subs.every(t => t.px === 15 && t.gap === 16 && t.sameLine && t.w > 0), JSON.stringify(subs));
  });
  // 2026-11-13「タイトル画面のクオリティを上げたい」: 構図・カーソル・キー操作・「つづきから」の添え書き。
  // 台（背景の x=880）は、ロゴと人物の絵の間に見える。カーソルは開いた時からおすすめの行に1つだけ付く。
  for (const [device, options] of Object.entries(sizes)) await check(`${device}-cursor-and-composition`, options, async p => {
    const cursor = () => p.evaluate(() => [...document.querySelectorAll(".title-item.is-current")].map(n => n.dataset.test));
    await p.locator(".title-art.ready").waitFor(); await p.waitForTimeout(1300); // 人物の絵の出現（1秒）が済んでから測る
    const layout = await p.evaluate(() => {
      const stage = document.querySelector("#stage").getBoundingClientRect(), k = stage.height / 720;
      const px = n => { const r = n.getBoundingClientRect(); return { left: (r.left - stage.left) / k, right: (r.right - stage.left) / k }; };
      const bg = document.querySelector(".title-bg"), style = getComputedStyle(bg);
      return { image: style.backgroundImage, rig: 880 + parseFloat(style.backgroundPositionX), width: parseFloat(style.backgroundSize),
        art: px(document.querySelector(".title-art")), logo: px(document.querySelector(".title-logo")), menu: px(document.querySelector(".title-menu")) };
    });
    assert(layout.image.includes("bg_title") && layout.width === 1280, JSON.stringify(layout));
    assert(layout.logo.right < layout.rig && layout.rig + 70 < layout.art.left + 60 && layout.art.right <= 1280.5, `台はロゴと人物の絵の間 ${JSON.stringify(layout)}`);
    assert(layout.menu.right < layout.art.left, "メニューは人物の絵に掛からない");
    // セーブが無い: おすすめは「はじめから」。添え書きは出ない。
    assert.deepEqual(await cursor(), ["title-new"]);
    assert.equal(await p.locator(".ti-note").count(), 0);
    if (device === "pc") {
      // ↑↓は押せない行（LOAD）を飛ばして一巡し、Home／End で端へ。動かした行にフォーカスも移る。
      const focused = () => p.evaluate(() => document.activeElement?.dataset?.test ?? null);
      await p.keyboard.press("ArrowDown"); assert.deepEqual([await cursor(), await focused()], [["title-gallery"], "title-gallery"]);
      await p.keyboard.press("ArrowDown"); assert.deepEqual(await cursor(), ["title-config"]);
      await p.keyboard.press("ArrowDown"); assert.deepEqual(await cursor(), ["title-new"]);
      await p.keyboard.press("ArrowUp"); assert.deepEqual(await cursor(), ["title-config"]);
      await p.keyboard.press("Home"); assert.deepEqual(await cursor(), ["title-new"]);
      await p.keyboard.press("End"); assert.deepEqual([await cursor(), await focused()], [["title-config"], "title-config"]);
      // どこにもフォーカスが無くても、決定キーは選んでいる行を押す。小窓を開いている間はカーソルを動かさない。
      await p.evaluate(() => document.activeElement?.blur());
      await p.keyboard.press("Enter"); await p.locator("#modal.show .cfg").waitFor();
      await p.keyboard.press("ArrowUp"); assert.deepEqual(await cursor(), ["title-config"]);
      await button(p, "cfg-close").click(); await p.waitForFunction(() => !document.querySelector("#modal.show"));
      assert.deepEqual(await cursor(), ["title-config"], "閉じたあとも、選んでいた行のまま");
      // マウスを乗せた行へカーソルが移り、離しても残る（光る行はいつも1つ）。
      await button(p, "title-gallery").hover(); assert.deepEqual(await cursor(), ["title-gallery"]);
      await p.mouse.move(1100, 60); assert.deepEqual(await cursor(), ["title-gallery"]);
    }
    // セーブがある: おすすめは「つづきから」。いちばん新しいセーブの章と日付を、主文の下の行に添える。
    await seed(p);
    assert.deepEqual(await cursor(), ["title-load"]);
    const note = await p.evaluate(() => {
      const k = document.querySelector("#stage").getBoundingClientRect().height / 720;
      const row = document.querySelector('[data-test="title-load"]'), n = row.querySelector(".ti-note"), en = row.querySelector(".ti-en");
      const r = n.getBoundingClientRect(), box = row.getBoundingClientRect(), a = en.getBoundingClientRect();
      return { text: n.textContent, count: document.querySelectorAll(".ti-note").length, real: parseFloat(getComputedStyle(n).fontSize) * k, enReal: parseFloat(getComputedStyle(en).fontSize) * k,
        below: r.top >= a.bottom - 1, alignedWithMain: Math.abs(r.left - a.left) < 1, inRow: r.left >= box.left - .5 && r.right <= box.right + .5 && r.bottom <= box.bottom + .5,
        height: box.height / k, oneLine: r.height < parseFloat(getComputedStyle(n).fontSize) * k * 1.6 };
    });
    assert.match(note.text, /^第1章　DAY 6・(昼|夜)$/);
    assert(note.count === 1 && note.real >= 11 - 1e-6 && note.real < note.enReal && note.below && note.alignedWithMain && note.inRow && note.oneLine, JSON.stringify(note));
    if (device === "pc") {
      // 何も触らずに決定キーだけで「つづきから」の枠選びが開く。
      await p.keyboard.press("Enter"); await button(p, "slot-cancel").waitFor(); await button(p, "slot-cancel").click();
      await p.waitForFunction(() => !document.querySelector("#modal.show"));
      assert.deepEqual(await cursor(), ["title-load"]);
    } else {
      // スマホ（タッチ）: 押した行にカーソルが移る。添え書きが入っても行の高さと間隔は変わらない（72px以上・16px）。
      await button(p, "title-config").tap(); await p.locator("#modal.show .cfg").waitFor();
      await button(p, "cfg-close").tap(); await p.waitForFunction(() => !document.querySelector("#modal.show"));
      assert.deepEqual(await cursor(), ["title-config"]);
      const rows = await p.evaluate(() => {
        const stage = document.querySelector("#stage").getBoundingClientRect(), k = stage.height / 720;
        const items = [...document.querySelectorAll(".title-item")].map(n => n.getBoundingClientRect());
        return { heights: items.map(r => r.height / k), gaps: items.slice(1).map((r, i) => (r.top - items[i].bottom) / k), bottom: Math.max(...items.map(r => r.bottom)) <= stage.bottom + 1 };
      });
      assert(rows.heights.every(v => v >= 72 - .5) && rows.gaps.every(v => Math.abs(v - 16) < .5) && rows.bottom, JSON.stringify(rows));
    }
  });
  await check("new-game-stays-landscape", sizes.pc, async p => {
    await button(p, "title-new").click();
    await p.locator("body.vn-open").waitFor(); await landscapeOnly(p); await noDisplaySwitch(p);
  });
  await check("real-map-and-craft-stay-landscape-and-return", sizes.pc, async p => {
    await p.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); Object.assign(core.state, { phase: "daily", day: 5, slot: 1 });
      const map = await import("./js/daily/map.js");
      window.titleScopeQA = { map, pending: map.chooseSpot() };
    });
    await p.locator('#screen[data-screen="map"]').waitFor(); await landscapeOnly(p); await noDisplaySwitch(p);
    await p.evaluate(async () => {
      titleScopeQA.map.interruptMap(null); await titleScopeQA.pending;
      const { showTitle } = await import("./js/scenes/title.js"); showTitle();
    });
    await ready(p);
    await p.evaluate(async () => {
      const craft = await import("./js/craft/session.js");
      window.titleScopeQA.bench = craft.openBench(craft.newSession("rehearsal"));
    });
    await p.locator('#screen[data-screen="bench"]').waitFor(); await landscapeOnly(p); await noDisplaySwitch(p);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ base, ref:process.env.TEST_REF || null, results }, null, 2) + "\n");
}
assert(results.length > 0); assert.equal(results.filter(r => r.status === "failed").length, 0);
