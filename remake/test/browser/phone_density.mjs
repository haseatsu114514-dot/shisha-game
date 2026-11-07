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
  await page.locator(".vn-text").click();
  await page.locator(".vn-choice").last().waitFor();
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
}

async function openModal(page) {
  await page.evaluate(async () => {
    const { modal } = await import("./js/core/ui.js");
    void modal({ title: "確認", body: "本文の確認。", options: [{ label: "やめる", value: false }, { label: "決める", value: true, primary: true }] });
  });
  await page.locator(".modal-actions .btn").first().waitFor();
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
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
];

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
