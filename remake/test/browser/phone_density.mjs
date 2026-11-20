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

// 店・MENU: ステージ端の「← 街に戻る」「← 店を出る」「閉じる」も規格の対象にする。
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

// ギャラリー（タイトルの GALLERY）: #3726 A-2 の巡回で文字が実寸 6.5〜9.8px だった
async function openGalleryScreen(page) {
  await page.evaluate(async () => {
    (await import("./js/core/ui.js")).clearScreen();
    window.PD = (await import("./js/scenes/gallery.js")).openGallery();
  });
  await page.locator(".gal-close").waitFor();
  await settle(page);
}

// セーブ画面（地図の SAVE）: 空き枠の「── 空き ──」が実寸 8.7px だった（#3726 A-2）
async function openSaveScreen(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    Object.assign(core.newGame(), { phase: "daily", day: 5, slot: 0 });
    core.save();
    (await import("./js/core/ui.js")).clearScreen();
    window.PD = (await import("./js/scenes/saves.js")).saveFlow();
  });
  await page.locator(".saveload-modal .ss-list").waitFor();
  await settle(page);
}

// 会話の送り記号「▼」: #3726 A-2 の巡回で実寸 9.8px だった。1枚目を打ち終えて、送り記号が出ている間に測る
async function openConversationNext(page) {
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    window.PD = vn.play({ dialogue_id: "__phone_density_next", lines: [
      { speaker: "sumi", portrait: false, text: "送り記号の確認。" },
      { speaker: "sumi", portrait: false, text: "二枚目。" },
    ] });
  });
  await page.locator(".vn-next.show").waitFor();
  await settle(page);
}

// くじの黒板（ガラガラの横の看板）: #3726 A-2 の巡回で「ラストワン賞あり」が実寸 7.3px だった。
// 開発用のプレビュー（景品は渡さない）で抽選器の舞台を出す。動きを減らす設定で、カメラの寄り・フェードを止めて測る
// 動きを減らす設定の舞台は 0.9 秒で札へ移り、黒板ごと消える（motions/garagara.js の sleep(900)）。
// 遅い CI では測る前に消えて「文字を測る部品が見えていない」になるため、ページの時計を止めて黒板を出したままにする。
// 時計を止めても黒板は描かれる（舞台は時刻を待たずに組み立てる）。止めたまま検査を終える（くじは最後に開く）
// 止める時刻は 1 秒先に取る。入れた時計は止めるまで進み続けるので、近すぎる時刻（以前は 10ms 先）だと負荷の高い時に
// 止める前に過ぎて "Cannot fast-forward to the past" になった。先へ進めた分はくじを開く前なので、黒板の 0.9 秒には掛からない
async function openKuji(page, spec) {
  await page.evaluate(async () => (await import("./js/core/ui.js")).clearScreen());
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.evaluate(async spec => {
    window.PD = (await import("./js/daily/kuji.js")).previewReveal(spec);
  }, spec);
  await page.locator(".mo-garagara .kj-sign-text").waitFor();
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
  // MENU の「?」（体力・見出しの説明）: #3726 A-2 の巡回で実寸 10.8px（Safari のバーで 9.4px）だった。押せる範囲は透明な ::before なので文字だけ見る
  { id: "menu", open: openMenu, targets: ['[data-test="menu-close"]'], texts: [".dmenu .dm-help"], required: [".dmenu .dm-help"] },
  { id: "gallery", open: openGalleryScreen, targets: [".gal-tabs > .gal-tab", ".gal-close"],
    texts: [".gal-head", ".gal-characters", ".gal-note", "#gallery-items"] },
  { id: "save-screen", open: openSaveScreen, targets: [], texts: [".saveload-modal .ss-list"] },
  { id: "conversation-next", open: openConversationNext, targets: [], texts: [".vn-next"], required: [".vn-next"] },
  // 黒板の字は大きくしても書ける面（.kj-sign-text）からはみ出さない（fits）
  { id: "kuji-sign", open: page => openKuji(page, "C@g1000"), targets: [], texts: [".mo-garagara .kj-sign-text"],
    required: [".kj-sign-title", ".kj-sign-row", ".kj-sign-note"], fits: ".mo-garagara .kj-sign-text", reducedMotion: "reduce" },
  { id: "kuji-sign-last", open: page => openKuji(page, "LAST@g1000"), targets: [], texts: [".mo-garagara .kj-sign-text"],
    required: [".kj-sign-title", ".kj-sign-note"], fits: ".mo-garagara .kj-sign-text", reducedMotion: "reduce" },
];

// ノッチ（safe-area）の模擬（#3001）。headless では env(safe-area-inset-*) が 0 なので、base.css の --stage-safe-l/r と同じ式で
// env() の所だけを固定値（実寸 px）に置き換える。iPhone の横持ちは左右とも、機種によりおよそ 47〜59px。
const NOTCHES = [0, 47, 59];
const NOTCH_PHONES = [...PHONES, ["iphone-pro-max-landscape", { width: 932, height: 430 }]];
// ステージ端の部品: 左は HUD の札・店の「← 街に戻る」「← 店を出る」、右は LIME・MENU と MENU の「閉じる」
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
function measure({ targets, texts, required = [], fits = null }) {
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
  // required: 文字を測る部品が見えていること（見えずに測り漏れるのを防ぐ）
  const missing = required.filter(selector => ![...document.querySelectorAll(selector)].some(node => shown(node) && textNodesUnder(node).length));
  // fits: 囲み（書ける面）の中身がはみ出していない。縦は中の段（子要素の行の高さの箱）、横は文字の行そのもので見る
  // （文字の行の箱は書体の上下の余白を含み、詰めた行の高さより縦に少し大きいので、縦には使わない）
  const overflow = [];
  const fmt = r => [r.left, r.top, r.right, r.bottom].map(v => v.toFixed(1)).join(",");
  for (const box of fits ? document.querySelectorAll(fits) : []) {
    const outer = box.getBoundingClientRect(), out = (a, b) => a < b - 0.5;
    for (const child of box.children) {
      const r = child.getBoundingClientRect();
      if (out(r.left, outer.left) || out(outer.right, r.right) || out(r.top, outer.top) || out(outer.bottom, r.bottom)) overflow.push(`${label(child)} ${fmt(r)} ⊄ ${fmt(outer)}`);
    }
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      for (const r of range.getClientRects()) if (out(r.left, outer.left) || out(outer.right, r.right)) overflow.push(`「${t.textContent.trim()}」 ${fmt(r)} ⊄ ${fmt(outer)}`);
    }
  }
  return { k, density: document.documentElement.dataset.density ?? null, taps, fonts, gaps, missing, overflow };
}

// #4035 B4: 文字は舞台上24px、タップは縦横とも縮小後39px。ノートの縦スクロールは許容する。
async function checkSlotDensity(page) {
  const checkLayout = async (root, { targets = [], required, fits } = {}) => {
    await page.waitForFunction(selector => document.querySelector(selector)?.checkVisibility({
      visibilityProperty: true, opacityProperty: true,
    }), root);
    const m = await page.evaluate(measure, { targets, texts: [root], required, fits });
    if (process.env.PD_DUMP) console.log(JSON.stringify({ root, ...m }, null, 1));
    assert.equal(m.density, "phone", root);
    assert.ok(m.fonts.length, `${root} の文字が測れていない`);
    assert.deepEqual(m.missing, [], root);
    assert.deepEqual(m.fonts.filter(f => f.px / m.k < 23.99), [], `${root} の文字が舞台上24px未満`);
    assert.deepEqual(m.taps.filter(t => t.missing || Math.min(t.h, t.w) < 38.99), [], `${root} のタップ部品が実寸39px未満`);
    assert.deepEqual(m.overflow, [], `${root} のカードから文字がはみ出している`);
    assert.ok(await page.locator(root).evaluate(node => {
      const box = node.getBoundingClientRect();
      const stage = document.querySelector("#screen").getBoundingClientRect();
      return node.scrollWidth <= node.clientWidth + 1
        && box.left >= stage.left - 0.5 && box.right <= stage.right + 0.5
        && box.top >= stage.top - 0.5 && box.bottom <= stage.bottom + 0.5;
    }), `${root} が舞台からはみ出しているか、横スクロールがある`);
  };
  await page.evaluate(async () => {
    const { newGame } = await import("./js/core/state.js");
    const { clearScreen } = await import("./js/core/ui.js");
    newGame();
    clearScreen();
    void (await import("./js/daily/reel.js")).installReel();
  });

  const next = '[data-test="reel-intro-next"]';
  await checkLayout(".reel-intro .ri-panel", { targets: [next], required: [".ri-text"] });
  for (let i = 0; i < 5; i++) {
    assert.equal(await page.locator(next).textContent(), "次へ");
    await page.locator(next).tap();
  }
  await checkLayout(".ri-panel.sys", { targets: [next], required: [".rn-tile-head", ".rn-tile-body", ".cue-chip"], fits: ".rn-tile" });
  // 844×390ではカードの末尾と閉じるボタンまで一度に見える。
  assert.ok(await page.locator(".ri-panel.sys").evaluate(node => node.scrollHeight <= node.clientHeight + 1));
  await page.locator(next).tap();
  await checkLayout(".reel-night.show .rn-label");
  await page.locator(".reel-night").waitFor({ state: "detached" });

  await page.evaluate(async () => {
    const { state } = await import("./js/core/state.js");
    const { layers } = await import("./js/core/ui.js");
    const { mountReel } = await import("./js/daily/reel.js");
    state.reel.settingDraws = 1;
    Object.assign(state.reel.note, {
      history: [{ kind: "BIG", games: 12345, chapter: 5, day: 123 }],
      freezeLog: [{ chapter: 4, day: 123, spin: 123456 }],
      periods: { 0: { spins: 148, big: 2, reg: 1, bell: 6 } },
    });
    void mountReel(layers.screen);
  });
  const lamp = page.locator('[data-test="reel-lamp"]');
  // ランプは見た目より当たり判定が広い。中心から上下左右19.5pxの点が同じ操作先かを見る。
  assert.ok(await lamp.evaluate(node => {
    const r = node.getBoundingClientRect();
    return [[-19.5, 0], [19.5, 0], [0, -19.5], [0, 19.5]].every(([dx, dy]) =>
      document.elementFromPoint(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy)?.closest(".rw-lamp-wrap") === node.parentElement);
  }), "ランプの当たり判定が実寸39px未満");
  await lamp.tap();

  const close = '[data-test="reel-note-close"]';
  const notePages = [
    [".rn-table", ".rn-history small", ".rn-hall"],
    [".rn-card .cue-chip"],
    [".rn-setting small", ".rn-hint-head"],
  ];
  for (const [index, required] of notePages.entries()) {
    // 末尾のページ送りまでスクロールし、実際のタップで次のページへ進む。
    if (index > 0) await page.locator(".reel-note .ri-next").tap();
    await checkLayout(".reel-note .rn-panel", { targets: [close], required, fits: ".rn-tile" });
  }
  await page.locator(close).tap();
  await page.locator(".reel-note").waitFor({ state: "detached" });

  await page.evaluate(async () => (await import("./js/daily/reel.js")).force("big", "before"));
  await checkLayout(".rc-board", { required: [".rc-aim", ".rc-label"] });
  await page.locator(".reel-cutin").waitFor({ state: "detached" });
  await checkLayout(".rw-bubble.show");

  await page.evaluate(async () => (await import("./js/daily/reel.js")).force("freeze"));
  await checkLayout(".rc-freeze-text");
  await checkLayout(".rc-freeze-sub");
  assert.ok(await page.locator(".rc-freeze-label").evaluate(node => {
    const animation = node.getAnimations()[0];
    // 文字が現れ始める瞬間は、終了時より大きく横にはみ出しやすい。
    if (animation) animation.currentTime = 1;
    const rect = node.getBoundingClientRect();
    const frame = node.closest(".rc-freeze").getBoundingClientRect();
    return rect.left >= frame.left - 0.5 && rect.right <= frame.right + 0.5;
  }), "FREEZE BONUS の出現時に文字が切れている");
}

await suite("phone-density", async check => {
  await check("iphone-landscape-slot", checkSlotDensity, { viewport: PHONES[0][1], ...touch });
  for (const [name, viewport] of PHONES) {
    for (const screen of SCREENS) {
      await check(`${name}-${screen.id}`, async page => {
        await screen.open(page);
        const m = await page.evaluate(measure, { targets: screen.targets, texts: screen.texts, required: screen.required, fits: screen.fits });
        if (process.env.PD_DUMP) console.log(JSON.stringify(m, null, 1));
        assert.equal(m.density, "phone", `--k=${m.k} でスマホ規格が立っていない`);
        assert.deepEqual(m.taps.filter(t => t.missing).map(t => t.where), [], "測る部品が見えていない");
        assert.deepEqual(m.missing, [], "文字を測る部品が見えていない");
        assert.deepEqual(m.taps.filter(t => t.h < MIN_TAP).map(t => `${t.where} ${t.h.toFixed(1)}px`), [], `タップ部品の実寸が ${MIN_TAP}px 未満`);
        assert.deepEqual(m.fonts.filter(f => f.px < MIN_TEXT).map(f => `${f.where} ${f.px.toFixed(1)}px`), [], `文字の実寸が ${MIN_TEXT}px 未満`);
        assert.deepEqual(m.gaps.filter(g => g.stage < MIN_GAP_STAGE - 0.5).map(g => `${g.where} ${g.stage.toFixed(1)}px`), [], `隣のタップ部品との間隔がステージ上 ${MIN_GAP_STAGE}px 未満`);
        assert.deepEqual(m.overflow, [], "文字が書ける面からはみ出している");
      }, { viewport, ...touch, ...(screen.reducedMotion ? { reducedMotion: screen.reducedMotion } : {}) });
    }
  }

  // 端の部品は固定ステージ（1280×720）の内側に収まり、ノッチにも掛からない（2026-11-09 オーナー決定・#3035）。
  // 横長画面ではステージの左右に余白（ぼかし）ができ、その幅がノッチより広いので端の部品は自然に内側へ寄る。
  // ワイド拡張（#2861・#3001: 部品を余白へ出す方式）は廃止した。
  for (const [name, viewport] of NOTCH_PHONES) {
    await check(`${name}-edge-parts-notch`, async page => {
      const problems = [];
      for (const scene of EDGE_SCENES) {
        await scene.open(page);
        for (const notch of NOTCHES) {
          await setNotch(page, notch);
          const m = await page.evaluate(edgeBoxes, { left: scene.left, right: scene.right });
          const where = `${scene.id}・ノッチ${notch}px`;
          if (m.wide) problems.push(`${where}: ワイドステージになっている（固定ステージ方針・#3035）`);
          for (const part of [...m.left, ...m.right]) if (part.missing) problems.push(`${where}: ${part.selector} が見えていない`);
          for (const part of m.left.filter(p => !p.missing)) {
            if (part.left < notch - 0.5) problems.push(`${where}: ${part.selector} の左端 ${part.left.toFixed(1)} がノッチ（${notch}）にかかる`);
            if (part.left < m.center.left - 0.5) problems.push(`${where}: ${part.selector} がステージの外（左端 ${part.left.toFixed(1)}・ステージ ${m.center.left.toFixed(1)}〜）`);
          }
          for (const part of m.right.filter(p => !p.missing)) {
            if (part.right > m.width - notch + 0.5) problems.push(`${where}: ${part.selector} の右端 ${part.right.toFixed(1)} がノッチ（${m.width - notch}〜）にかかる`);
            if (part.right > m.center.right + 0.5) problems.push(`${where}: ${part.selector} がステージの外（右端 ${part.right.toFixed(1)}・ステージ〜${m.center.right.toFixed(1)}）`);
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
    // #3100 / #3103: 紙テーマの操作文字はPCでも22px。タップ領域と選択肢位置は維持。
    assert.equal(vn, "44px 22px 254px");
    // #3726 A-2 で大きくした MENU の「?」・送り記号・くじの黒板は、PC では従来の大きさのまま
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".vn-next")).fontSize), "18px");
    await openMenu(page);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll(".dmenu .dm-help")].map(n => { const s = getComputedStyle(n); return `${s.fontSize} ${s.width}`; }).join("|")), "16px 26px|16px 26px");
    await page.locator('[data-test="menu-close"]').click();
    await openKuji(page, "C@g1000");
    assert.equal(await page.evaluate(() => [".kj-sign-title", ".kj-sign-row", ".kj-sign-note"].map(sel => getComputedStyle(document.querySelector(`.mo-garagara ${sel}`)).fontSize).join(" ")), "21px 20px 13px");
  }, { viewport: { width: 1280, height: 720 } });
});
