import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 横持ちスマホの心得の盤（#3121）: 盤全体の補助文字は実効 11.5px 以上、
// 詳細本文と倍率ボタンは 12.5px 以上。全体は見渡せるまま、マス選択時に 1.2 倍へ寄せる。
const t = (name) => `[data-test="${name}"]`;
const MIN_FONT = 11.4;
const MIN_TAP = 39;
const phone = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function openBoard(page, { view = true } = {}) {
  await page.evaluate(async () => {
    (await import("./js/core/growth.js")).setGrowthPreview(true);
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    const g = (await import("./js/core/growth.js")).ensureGrowth(s);
    Object.assign(g, { xp: 520, level: 3, settledXp: 480, hidane: { any: 2 }, nodes: ["B1", "B2", "S1"] });
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.menuRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.menuError = String(error.stack || error); });
  });
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  if (!view) return;
  await page.locator(t("hud-menu")).click();
  await page.locator(t("menu-board")).click();
  await page.locator(`${t("growth-board")}[data-mode="view"]`).waitFor({ timeout: 20000 });
  await page.locator(`${t("growth-board")}[data-art]`).waitFor({ timeout: 15000 }).catch(() => {});
}

const scanText = (minFont) => {
  const root = document.querySelector(".gboard");
  const stage = document.querySelector("#stage");
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const small = [];
  for (const node of root.querySelectorAll("*")) {
    if (![...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim())) continue;
    if (node.closest(".gb-sr")) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = node.getBoundingClientRect();
    const effective = parseFloat(style.fontSize) * k;
    if (!box.width || !box.height || effective === 0 || effective >= minFont) continue;
    small.push(`${node.tagName.toLowerCase()}.${String(node.className).replace(/ /g, ".")} "${node.textContent.trim().slice(0, 8)}" ${effective.toFixed(1)}px`);
  }
  return small;
};

// 支払い・今の状態の一行（.gb-p-state。「白火1で払う」など）が、右の説明の下端に置いた「灯す／目標にする」の後ろに隠れず、
// 枠の中で見えていること（#3987）。行の上の9点を elementFromPoint で叩き、いちばん上に描かれているのが行そのものかを見る。
const paymentLine = () => {
  const side = document.querySelector(".gb-side");
  const state = side.querySelector(".gb-p-state"), actions = side.querySelector(".gb-side-actions");
  const stage = document.querySelector("#stage");
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const cs = getComputedStyle(side), p = side.getBoundingClientRect(), s = state.getBoundingClientRect(), a = actions.getBoundingClientRect();
  const top = p.top + parseFloat(cs.borderTopWidth) * k, bottom = p.bottom - parseFloat(cs.borderBottomWidth) * k;
  const covered = [];
  for (const fx of [0.03, 0.5, 0.97]) for (const fy of [0.2, 0.5, 0.8]) {
    const hit = document.elementFromPoint(s.left + s.width * fx, s.top + s.height * fy);
    if (hit !== state && !state.contains(hit)) covered.push(`${fx},${fy}:${hit ? `${hit.tagName}.${String(hit.className).replace(/ /g, ".")}` : "none"}`);
  }
  return {
    text: state.textContent, actions: [...actions.children].map((b) => b.textContent),
    font: +(parseFloat(getComputedStyle(state).fontSize) * k).toFixed(2),
    stateBottom: +s.bottom.toFixed(1), actionsTop: +a.top.toFixed(1), height: +s.height.toFixed(1),
    inside: s.top >= top - 0.5 && s.bottom <= bottom + 0.5, covered,
    // 説明が下端の枠の後ろへ続いているか（送れば読める）と、その印
    cut: side.scrollHeight - side.scrollTop - side.clientHeight > 1, more: side.dataset.more ?? null,
  };
};

await suite("board-phone-text", async (check) => {
  await check("first-light-tutorial-keeps-the-effect-and-payment-visible", async page => {
    await page.evaluate(async () => {
      localStorage.removeItem("suien_board_tutorial");
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 3 });
      const { openBoard } = await import("./js/daily/growth-board-screen.js");
      void openBoard({ place: "kannon" });
    });
    for (let step = 0; step < 4; step++) await page.locator(t("board-tutorial-next")).tap();
    const node = page.locator(t("board-node-B1"));
    await node.tap();
    const bubble = page.locator(".gb-tutorial-bubble");
    await bubble.getByRole("heading", { name: "灯す", exact: true }).waitFor();
    const panel = page.locator(t("board-preview"));
    const [explanation, preview] = await Promise.all([bubble.boundingBox(), panel.boundingBox()]);
    assert(explanation.x + explanation.width <= preview.x, "The tutorial bubble must stay to the left of the details");
    assert.match(await panel.innerText(), /最大体力\s*＋8/);
    assert.deepEqual((await page.evaluate(paymentLine)).covered, []);
    await page.locator(t("board-light")).tap();
    assert.equal(await node.getAttribute("data-status"), "pending");
  }, { ...phone, reducedMotion: "reduce" });

  // #3987 実プレイ: DAY3 に感覚の「かわし」(S1) を灯し、DAY7 の観音堂で「火加減」(S4) を選ぶと、844×390 で
  // 右下の支払い行「白火1で払う」が固定の「灯す（火種1）／目標にする」の後ろに隠れた。説明の長いマス・授業・スキルも同じに見る
  const PAY_CASES = [
    ["phone-844x390", phone],
    ["phone-844x340", { ...phone, viewport: { width: 844, height: 340 } }],
    ["phone-932x430", { ...phone, viewport: { width: 932, height: 430 } }],
    ["pc-1280x720", {}],
  ];
  for (const [label, profile] of PAY_CASES) {
    await check(`payment-line-not-hidden-${label}`, async (page) => {
      const isPhone = label.startsWith("phone");
      await openBoard(page, { view: false });
      await page.evaluate(() => { void import("./js/daily/growth-board-screen.js").then((m) => m.openBoard({ place: "kannon" })); });
      await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
      await page.locator(`${t("growth-board")}[data-art]`).waitFor({ timeout: 15000 }).catch(() => {});
      await page.locator(t("board-tab-sense")).click();
      for (const id of ["S4", "S5", "S6", "K15", "M-S2"]) {
        await page.locator(t(`board-node-${id}`)).evaluate((node) => node.click());
        await page.locator(".gb-side").evaluate((side) => { side.scrollTop = 0; side.dispatchEvent(new Event("scroll")); });
        const line = await page.evaluate(paymentLine);
        const where = `${label} ${id} ${JSON.stringify(line)}`;
        if (id === "S4") {
          assert.equal(line.text, "白火1で払う", where);
          assert.deepEqual(line.actions, ["灯す（火種1）", "目標にする"], where);
        }
        assert.deepEqual(line.covered, [], `支払い行の上に別の部品が重なる: ${where}`);
        assert(line.stateBottom <= line.actionsTop + 0.5, `支払い行がボタンの上端より下に食い込む: ${where}`);
        assert(line.inside, `支払い行が右の説明の枠からはみ出す: ${where}`);
        if (isPhone) {
          assert(line.font >= 12.4, `支払い行は実寸12.5px以上: ${where}`);
          // 説明が枠の後ろへ続く時だけ印を出す。送り切ると消える
          assert.equal(line.more, String(line.cut), `説明の続きの印: ${where}`);
          if (line.cut) {
            const end = await page.locator(".gb-side").evaluate((side) => {
              side.scrollTop = side.scrollHeight;
              side.dispatchEvent(new Event("scroll"));
              return side.dataset.more;
            });
            assert.equal(end, "false", `送り切ったら印は消える: ${where}`);
            assert.deepEqual((await page.evaluate(paymentLine)).covered, [], `送った後も支払い行は見える: ${where}`);
          }
        }
      }
    }, { ...profile, reducedMotion: "reduce" });
  }

  await check("phone-844x390", async (page) => {
    await openBoard(page);
    assert.deepEqual(await page.evaluate(scanText, MIN_FONT), [], "board: small text");
    const chrome = await page.evaluate((minTap) => {
      const small = [];
      for (const name of ["board-zoom-in", "board-zoom-out", "board-zoom-fit", "board-help", "board-close"]) {
        const node = document.querySelector(`[data-test="${name}"]`);
        const box = node.getBoundingClientRect();
        if (Math.min(box.width, box.height) + 0.05 < minTap) small.push(`${name} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
      }
      return small;
    }, MIN_TAP);
    assert.deepEqual(chrome, [], "board: small chrome taps");
    const zoomHeight = await page.locator(t("board-zoom-in")).evaluate((node) => node.getBoundingClientRect().height);
    assert(zoomHeight >= 43.9, `zoom buttons should be 44px high, got ${zoomHeight}`);

    const before = await page.evaluate(() => {
      const n = document.querySelector('[data-test="board-node-B1"]');
      const r = n.getBoundingClientRect();
      return { hit: document.querySelector('[data-test="board-viewport"]').dataset.hit, w: r.width, h: r.height };
    });
    assert.equal(before.hit, "tight");
    assert(before.w >= 38.9, `default zoom should offer a 39px hit, got ${before.w}`);

    await page.locator(t("board-zoom-fit")).click();
    const fit = await page.locator(t("board-node-B1")).boundingBox();
    assert(fit.width >= 26, `fit view should keep non-overlapping node hits, got ${fit.width}`);
    await page.locator(t("board-node-B1")).evaluate((node) => node.click());
    assert(Number(await page.locator(t("board-viewport")).getAttribute("data-zoom")) >= 1.2,
      "selecting from fit should zoom toward the chosen node");
    const detailFont = await page.locator(".gb-side p").first().evaluate((node) => {
      const stage = document.querySelector("#stage");
      return parseFloat(getComputedStyle(node).fontSize) * stage.getBoundingClientRect().width / stage.offsetWidth;
    });
    assert(detailFont >= 12.4, `detail text should be at least 12.5px, got ${detailFont}`);
    await page.locator(t("board-zoom-in")).click();
    const after = await page.evaluate(() => {
      const viewport = document.querySelector('[data-test="board-viewport"]');
      const nodes = [...document.querySelectorAll(".gb-node")].map((n) => n.getBoundingClientRect());
      let minGap = Infinity;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (a.left + a.right) / 2 - (b.left + b.right) / 2;
        const dy = (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2;
        const gap = Math.hypot(dx, dy) - (Math.max(a.width, a.height) + Math.max(b.width, b.height)) / 2;
        if (gap < minGap) minGap = gap;
      }
      const n = document.querySelector('[data-test="board-node-B1"]').getBoundingClientRect();
      return { hit: viewport.dataset.hit, zoom: viewport.dataset.zoom, w: +n.width.toFixed(1), h: +n.height.toFixed(1), minGap: +minGap.toFixed(1) };
    });
    assert.equal(after.hit, "wide", JSON.stringify(after));
    assert(after.w + 0.05 >= 43 && after.h + 0.05 >= 43, `zoomed node hit should be 44px effective, got ${JSON.stringify(after)}`);
    assert(after.minGap >= -0.5, `zoomed node hits must not overlap, gap ${after.minGap}`);
  }, phone);

  // #3121 の受入（844×340・932×430 も）: 文字の実寸の下限、倍率・？・×の押す大きさ、通常倍率のマスの押す大きさ、詳細本文
  for (const viewport of [{ width: 844, height: 340 }, { width: 932, height: 430 }]) {
    await check(`phone-${viewport.width}x${viewport.height}-sizes`, async (page) => {
      await openBoard(page);
      const where = `${viewport.width}x${viewport.height}`;
      assert.deepEqual(await page.evaluate(scanText, MIN_FONT), [], `${where} board: small text`);
      const small = await page.evaluate((minTap) => ["board-zoom-in", "board-zoom-out", "board-zoom-fit", "board-help", "board-close", "board-node-B1"]
        .map((name) => [name, document.querySelector(`[data-test="${name}"]`).getBoundingClientRect()])
        .filter(([, box]) => Math.min(box.width, box.height) + 0.05 < minTap)
        .map(([name, box]) => `${name} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`), MIN_TAP);
      assert.deepEqual(small, [], `${where} board: small taps`);
      await page.locator(t("board-node-B1")).evaluate((node) => node.click());
      const fonts = await page.locator(".gb-side p").evaluateAll((nodes) => {
        const stage = document.querySelector("#stage");
        const k = stage.getBoundingClientRect().width / stage.offsetWidth;
        return nodes.filter((node) => node.getClientRects().length).map((node) => +(parseFloat(getComputedStyle(node).fontSize) * k).toFixed(2));
      });
      assert(fonts.length && Math.min(...fonts) >= 12.4, `${where} detail text should be at least 12.5px, got ${fonts}`);
    }, { ...phone, viewport });
  }

  await check("phone-844x340-long-lesson", async (page) => {
    await openBoard(page);
    await page.locator(t("board-tab-sense")).click();
    await page.locator(t("board-node-M-S2")).evaluate((node) => node.click());
    const first = await page.evaluate(() => {
      const side = document.querySelector(".gb-side");
      const actions = side.querySelector(".gb-side-actions");
      const sideBox = side.getBoundingClientRect(), actionBox = actions.getBoundingClientRect();
      return { text: side.innerText, scrollable: side.scrollHeight > side.clientHeight,
        actionVisible: actionBox.top >= sideBox.top && actionBox.bottom <= sideBox.bottom };
    });
    // 授業は、ながれの図（出会う → ♥5 → 盤で灯す → 会って習う）と、今の手順の一文で伝える（SBD139）
    assert(first.text.includes("単体で勝負") && first.text.includes("♥5まで仲良くなる"), "lesson meaning is present");
    assert.deepEqual(await page.locator(`${t("board-lesson-flow")} li`).evaluateAll((steps) => steps.map((step) => step.querySelector(".gb-lf-label").textContent)),
      ["出会う", "♥5まで", "盤で灯す", "会って習う"], "授業のながれが出る");
    assert.equal(await page.locator(t("board-lesson-flow")).getAttribute("data-now"), "heart", "今の手順は ♥5");
    assert(first.scrollable, "long lesson should scroll in the short viewport");
    assert(first.actionVisible, "lesson action should stay inside the panel");
    const last = await page.locator(".gb-side").evaluate((side) => {
      side.scrollTop = side.scrollHeight;
      const action = side.querySelector(".gb-side-actions").getBoundingClientRect();
      const state = side.querySelector(".gb-p-state").getBoundingClientRect();
      return { actionTop: action.top, stateBottom: state.bottom };
    });
    assert(last.stateBottom < last.actionTop, "the last explanation remains readable above the actions");
  }, { ...phone, viewport: { width: 844, height: 340 } });

  await check("phone-zoom-controls", async (page) => {
    await openBoard(page, { view: false });
    for (const mode of ["normal", "fit", "max"]) {
      await page.evaluate(() => { void import("./js/daily/growth-board-screen.js").then((m) => m.openBoard({ place: "kannon" })); });
      await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
      if (mode === "fit") await page.locator(t("board-zoom-fit")).click();
      if (mode === "max") {
        const plus = page.locator(t("board-zoom-in"));
        while (!(await plus.isDisabled())) await plus.click();
      }
      const id = await page.evaluate(() => document.querySelector(".gb-node.s-available")?.dataset.test);
      assert(id, `${mode}: no available node on the active board`);
      await page.locator(t(id)).evaluate((node) => node.click());
      const viewport = page.locator(t("board-viewport"));
      const zoom = Number(await viewport.getAttribute("data-zoom"));
      assert(zoom >= (mode === "max" ? 1.5 : 1.2), `${mode}: node selection zoom ${zoom}`);
      const before = await viewport.evaluate((node) => [node.scrollLeft, node.scrollTop]);
      const box = await viewport.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 50, box.y + box.height / 2 - 35, { steps: 5 });
      await page.mouse.up();
      const after = await viewport.evaluate((node) => [node.scrollLeft, node.scrollTop]);
      assert(after.some((value, i) => Math.abs(value - before[i]) > 5), `${mode}: pan did not move`);
      await page.locator(t("board-light")).evaluate((node) => node.click());
      await page.locator(t(id)).evaluate((node) => node.click());
      await page.locator(t("board-undo")).waitFor();
      await page.locator(t("board-undo")).evaluate((node) => node.click());
      await page.locator(t("board-light")).waitFor();
      if (mode === "max") await page.locator(t("board-light")).evaluate((node) => node.click());
      await page.locator(t("board-decide")).evaluate((node) => node.click());
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      if (mode === "max") {
        const committed = await page.evaluate(async (nodeId) => (await import("./js/core/growth.js")).ensureGrowth((await import("./js/core/state.js")).state).nodes.includes(nodeId.slice("board-node-".length)), id);
        assert(committed, "max: decision should save the lit node");
      }
    }
  }, { ...phone, reducedMotion: "reduce" });
}, { acknowledgeGrowth: false, freshBrowserPerCase: true });
