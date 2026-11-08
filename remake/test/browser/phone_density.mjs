// #2851 スマホ規格（html[data-density="phone"]）: 横持ちスマホで共通部品の文字・タップ部品が実寸で読める・押せる大きさか。
// 画面を足すときは SCREENS に { id, open(page), targets, texts } を1件足す（優先3以降の各画面 Issue もここへ追加する）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 実寸（CSS px）の下限。ステージ上の 22px / 72px を --k ≒ 0.54 で縮めた値。
const MIN_TEXT = 11, MIN_TAP = 38, MIN_GAP_STAGE = 12;
const PHONES = [
  ["iphone-landscape", { width: 844, height: 390 }],
  ["iphone-landscape-safari-bar", { width: 844, height: 340 }],
];
const touch = { isMobile: true, hasTouch: true };

async function openMap(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js"), { el } = await import("./js/core/util.js");
    ui.showScreen("map", el("div.pd-actions", { style: "position:absolute;left:60px;bottom:60px;display:flex;gap:12px" }, [
      el("button.btn", { dataset: { test: "pd-btn" } }, [el("span", { text: "店へ行く" }), el("span.btn-desc", { text: "説明の補助文" })]),
      el("button.btn.primary", { text: "決める", dataset: { test: "pd-primary" } }),
      el("button.btn.small", { text: "閉じる", dataset: { test: "pd-close" } }),
    ]));
    hud.initHud({ menu: () => {}, phone: () => {} }); hud.showHud(true);
  });
  await page.locator('[data-test="hud-menu"]').waitFor();
}

async function openConversation(page) {
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    window.PD = vn.play({ dialogue_id: "__phone_density", lines: [
      { speaker: "sumi", portrait: false, text: "スマホ規格の確認。" },
      { type: "choice", choices: [{ text: "ひとつめ", next: "end" }, { text: "ふたつめ", next: "end" }, { text: "みっつめ", next: "end" }] },
    ], branches: { end: [] } });
  });
  await page.locator(".vn-next.show").waitFor();
  // 会話の開始直後 320ms はタップを受け付けない（engine.js の openLockUntil）。短い行は先に打ち終わるので、選択肢が出るまでタップし直す。
  const choice = page.locator(".vn-choices.show .vn-choice").last();
  for (let i = 0; i < 5 && !(await choice.isVisible()); i++) {
    await page.locator(".vn-text").click();
    await choice.waitFor({ timeout: 2000 }).catch(() => {});
  }
  await choice.waitFor();
  await settle(page);
}

async function openModal(page) {
  await page.evaluate(async () => {
    const { modal } = await import("./js/core/ui.js");
    void modal({ title: "確認", body: "本文の確認。", options: [{ label: "やめる", value: false }, { label: "決める", value: true, primary: true }] });
  });
  await page.locator(".modal-actions .btn").first().waitFor();
  await settle(page);
}

// 店・MENU（#3001）: ワイドステージで端へ出した「← 街に戻る」「← 店を出る」「閉じる」（css/wide-screens.css）も規格の対象にする。
async function openShopEntry(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js");
    Object.assign(core.newGame(), { phase: "daily", day: 5, slot: 0, money: 12800, stamina: 100 });
    ui.clearScreen(); hud.initHud({ menu: () => {}, phone: () => {} }); hud.showHud(true);
    window.PD = (await import("./js/daily/shop.js")).openShop({});
  });
  await page.locator('[data-test="shop-entry-back"]').waitFor();
  await settle(page);
}

async function enterShopFloor(page) {
  await page.locator('[data-test="shop-enter"]').click();
  await page.locator('[data-test="shop-leave"]').waitFor();
  await settle(page);
}

async function openShopFloor(page) {
  await openShopEntry(page);
  await enterShopFloor(page);
}

async function openMenu(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    if (core.state?.phase !== "daily") Object.assign(core.newGame(), { phase: "daily", day: 5, slot: 0, money: 12800, stamina: 100 });
    window.PD = (await import("./js/daily/menu.js")).openMenu({ tab: "system", canSave: () => false });
  });
  await page.locator('[data-test="menu-close"]').waitFor();
  await settle(page);
}

// 開く・閉じる演出（無限に回る飾りは除く）が終わるまで待つ
function settle(page) {
  return page.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
}

// targets: 押す部品（実寸の高さ・文字・隣との間隔を見る）／ texts: 読ませる文字（実寸の文字だけ見る）
const SCREENS = [
  { id: "map-hud", open: openMap,
    targets: ['[data-test="hud-menu"]', '[data-test="hud-phone"]', ".pd-actions > .btn"],
    texts: [".hud-card", ".pd-actions"] },
  { id: "conversation", open: openConversation,
    targets: [".vn-controls > .vn-ctl", ".vn-choices > .vn-choice"],
    texts: [".vn-text", ".vn-name"] },
  { id: "modal", open: openModal, targets: [".modal-actions > .btn"], texts: [".modal-box"] },
  { id: "shop-entry", open: openShopEntry, targets: ['[data-test="shop-entry-back"]'], texts: [] },
  { id: "shop-floor", open: openShopFloor, targets: ['[data-test="shop-leave"]'], texts: [] },
  { id: "menu", open: openMenu, targets: ['[data-test="menu-close"]'], texts: [] },
];

// ノッチ（safe-area）の模擬（#3001）。headless では env(safe-area-inset-*) が 0 なので、base.css の --stage-safe-l/r と同じ式で
// env() の所だけを固定値（実寸 px）に置き換える。iPhone の横持ちは左右とも、機種によりおよそ 47〜59px。
const NOTCHES = [0, 47, 59];
const NOTCH_PHONES = [...PHONES, ["iphone-pro-max-landscape", { width: 932, height: 430 }]];
// 端へ出す部品（#2861）: 左は HUD の札・店の「← 街に戻る」「← 店を出る」、右は LIME・MENU と MENU の「閉じる」
const EDGE_SCENES = [
  { id: "map", open: openMap, left: [".hud-card"], right: ['[data-test="hud-phone"]', '[data-test="hud-menu"]'] },
  { id: "shop-entry", open: openShopEntry, left: ['[data-test="shop-entry-back"]'], right: [] },
  { id: "shop-floor", open: enterShopFloor, left: ['[data-test="shop-leave"]'], right: [] },
  { id: "menu", open: openMenu, left: [], right: ['[data-test="menu-close"]'] },
];

async function setNotch(page, px) {
  await page.evaluate(px => {
    const style = document.getElementById("pd-notch") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "pd-notch" }));
    const safe = `max(0px, calc((${px}px - var(--stage-bar, 0px)) / var(--k, 1)))`;
    style.textContent = px ? `html #stage[data-wide] { --stage-safe-l: ${safe} !important; --stage-safe-r: ${safe} !important; }` : "";
  }, px);
  await settle(page); // 位置の切り替えに演出（transition）があっても、終わってから測る
}

// 端の部品の左右の位置（画面 px）と、中央 1280（#screen）の左右の端
function edgeBoxes({ left, right }) {
  const box = selector => {
    const node = [...document.querySelectorAll(selector)].find(n => n.getClientRects().length > 0);
    if (!node) return { selector, missing: true };
    const r = node.getBoundingClientRect();
    return { selector, left: r.left, right: r.right };
  };
  const screen = document.getElementById("screen").getBoundingClientRect();
  return {
    wide: document.getElementById("stage").hasAttribute("data-wide"), width: innerWidth,
    center: { left: screen.left, right: screen.right },
    left: left.map(box), right: right.map(box),
  };
}

// 見えている要素だけ、実寸（getBoundingClientRect は拡縮後）と文字の実寸を集める。
function measure({ targets, texts }) {
  const k = Number(getComputedStyle(document.querySelector("#stage")).getPropertyValue("--k"));
  const shown = node => node.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && node.getClientRects().length > 0;
  const label = node => `${node.className || node.tagName}「${node.textContent.trim().slice(0, 12)}」`;
  const textNodesUnder = root => {
    const out = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const host = t.parentElement;
      if (!t.textContent.trim() || !host || !shown(host)) continue;
      out.push({ where: label(host), px: parseFloat(getComputedStyle(host).fontSize) * k });
    }
    return out;
  };
  const taps = [], fonts = [], gaps = [];
  for (const selector of targets) {
    const nodes = [...document.querySelectorAll(selector)].filter(shown);
    if (!nodes.length) taps.push({ where: selector, missing: true });
    nodes.forEach((node, i) => {
      const r = node.getBoundingClientRect();
      taps.push({ where: label(node), h: r.height, w: r.width });
      fonts.push(...textNodesUnder(node));
      const next = nodes[i + 1]?.getBoundingClientRect();
      if (next) {
        const gap = Math.max(next.left - r.right, next.top - r.bottom, r.left - next.right, r.top - next.bottom);
        gaps.push({ where: label(node), stage: gap / k });
      }
    });
  }
  for (const selector of texts) document.querySelectorAll(selector).forEach(node => shown(node) && fonts.push(...textNodesUnder(node)));
  return { k, density: document.documentElement.dataset.density ?? null, taps, fonts, gaps };
}

await suite("phone-density", async check => {
  for (const [name, viewport] of PHONES) {
    for (const screen of SCREENS) {
      await check(`${name}-${screen.id}`, async page => {
        await screen.open(page);
        const m = await page.evaluate(measure, { targets: screen.targets, texts: screen.texts });
        if (process.env.PD_DUMP) console.log(JSON.stringify(m, null, 1));
        assert.equal(m.density, "phone", `--k=${m.k} でスマホ規格が立っていない`);
        assert.deepEqual(m.taps.filter(t => t.missing).map(t => t.where), [], "測る部品が見えていない");
        assert.deepEqual(m.taps.filter(t => t.h < MIN_TAP).map(t => `${t.where} ${t.h.toFixed(1)}px`), [], `タップ部品の実寸が ${MIN_TAP}px 未満`);
        assert.deepEqual(m.fonts.filter(f => f.px < MIN_TEXT).map(f => `${f.where} ${f.px.toFixed(1)}px`), [], `文字の実寸が ${MIN_TEXT}px 未満`);
        assert.deepEqual(m.gaps.filter(g => g.stage < MIN_GAP_STAGE - 0.5).map(g => `${g.where} ${g.stage.toFixed(1)}px`), [], `隣のタップ部品との間隔がステージ上 ${MIN_GAP_STAGE}px 未満`);
      }, { viewport, ...touch });
    }
  }

  // 端の部品は、ノッチが無ければ中央 1280 の外（黒帯だった側）へ出て、ノッチがあればその内側に収まる（#2861・#3001）。
  // 実機の safe-area の効き方そのものはオーナーの実機確認（#2928）。ここは CSS が --stage-safe-l/r を使っているかを見る。
  for (const [name, viewport] of NOTCH_PHONES) {
    await check(`${name}-edge-parts-notch`, async page => {
      const problems = [];
      for (const scene of EDGE_SCENES) {
        await scene.open(page);
        for (const notch of NOTCHES) {
          await setNotch(page, notch);
          const m = await page.evaluate(edgeBoxes, { left: scene.left, right: scene.right });
          const where = `${scene.id}・ノッチ${notch}px`;
          if (!m.wide) problems.push(`${where}: ワイドステージになっていない`);
          for (const part of [...m.left, ...m.right]) if (part.missing) problems.push(`${where}: ${part.selector} が見えていない`);
          for (const part of m.left.filter(p => !p.missing)) {
            if (part.left < notch - 0.5) problems.push(`${where}: ${part.selector} の左端 ${part.left.toFixed(1)} がノッチ（${notch}）にかかる`);
            if (!notch && part.left >= m.center.left) problems.push(`${where}: ${part.selector} が中央1280の中（左端 ${part.left.toFixed(1)}・中央 ${m.center.left.toFixed(1)}〜）`);
          }
          for (const part of m.right.filter(p => !p.missing)) {
            if (part.right > m.width - notch + 0.5) problems.push(`${where}: ${part.selector} の右端 ${part.right.toFixed(1)} がノッチ（${m.width - notch}〜）にかかる`);
            if (!notch && part.right <= m.center.right) problems.push(`${where}: ${part.selector} が中央1280の中（右端 ${part.right.toFixed(1)}・中央〜${m.center.right.toFixed(1)}）`);
          }
        }
        await setNotch(page, 0);
      }
      assert.deepEqual(problems, []);
    }, { viewport, ...touch });
  }

  // HUD の日数の行: 「次の大会まで」はスマホ・PC とも出さない（#3033・オーナー指示 2026-11-09、行自体が無い）。
  // 出発前の「出発まで」・第5章の「勝負の日まで」は出す（オーナー指示 2026-11-08、大会の日程とは別の情報）。
  const goalRows = page => page.evaluate(async () => {
    const core = await import("./js/core/state.js"), hud = await import("./js/daily/hud.js"), s = core.state;
    const read = () => { const row = document.querySelector('[data-test="hud-goal"]'); return row ? `${row.dataset.goal}:${row.getClientRects().length > 0 ? "shown" : "hidden"}` : "tournament:absent"; };
    const out = [];
    s.chapter = 1; hud.updateHud(); out.push(read());
    s.chapter = 3; s.day = 30; s.flags._ch3_prep = { startDay: 29, days: 3 }; hud.updateHud(); out.push(read());
    s.chapter = 5; delete s.flags._ch3_prep; hud.updateHud(); out.push(read());
    return out;
  });
  await check("goal-row-phone", async page => {
    await openMap(page);
    assert.deepEqual(await goalRows(page), ["tournament:absent", "departure:shown", "final:shown"]);
  }, { viewport: PHONES[0][1], ...touch });
  await check("goal-row-desktop", async page => {
    await openMap(page);
    assert.deepEqual(await goalRows(page), ["tournament:absent", "departure:shown", "final:shown"]);
  }, { viewport: { width: 1280, height: 720 } });

  // PC（1280×720）では規格が立たず、共通部品の寸法は従来どおり。
  await check("desktop-unchanged", async page => {
    const read = () => page.evaluate(() => {
      const css = (sel, ...props) => { const s = getComputedStyle(document.querySelector(sel)); return props.map(p => s[p]).join(" "); };
      return {
        density: document.documentElement.dataset.density ?? null,
        btn: css('[data-test="pd-btn"]', "fontSize", "minHeight", "paddingTop"),
        desc: css('[data-test="pd-btn"] .btn-desc', "display", "fontSize"),
        small: css('[data-test="pd-close"]', "fontSize", "paddingTop"),
        menu: css('[data-test="hud-menu"]', "height", "fontSize"),
        lime: css('[data-test="hud-phone"]', "width", "height"),
      };
    });
    await openMap(page);
    assert.deepEqual(await read(), {
      density: null, btn: "18px auto 13px", desc: "block 15px", small: "15px 8px", menu: "40px 14px", lime: "48px 48px",
    });
    await openConversation(page);
    const vn = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector(".vn-ctl")), c = getComputedStyle(document.querySelector(".vn-choices"));
      return `${s.minHeight} ${s.fontSize} ${c.bottom}`;
    });
    assert.equal(vn, "44px 16px 254px");
  }, { viewport: { width: 1280, height: 720 } });
});
