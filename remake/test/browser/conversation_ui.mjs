import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

await suite("conversation-ui", async check => {
  await check("paper-safe-area-and-work-costume", async page => {
    // The preview omits phone-density.css. Exercise the real game with a home-bar inset.
    await page.goto(baseURL);
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); core.state.chapter = 5; core.config.textSpeed = 4; core.config.portraitStyle = "new";
      document.documentElement.dataset.uiTheme = "paper";
      const { DB } = await import("./js/core/data.js");
      for (const file of ["ch5_main", "ch1_tsumugi"]) {
        const data = await (await fetch(`../data/dialogue/${file}.json`)).json();
        for (const dialogue of data.dialogues) DB.dialogues[dialogue.dialogue_id] = dialogue;
      }
      (await import("./js/core/ui.js")).clearScreen();
    });
    const playLine = async (id, fromLine) => {
      await page.evaluate(async ({ id, fromLine }) => {
        void (await import("./js/vn/engine.js")).play(id, {
          fromLine, bg: "res://assets/backgrounds/bg_tonari_inside_night.png",
        });
      }, { id, fromLine });
      await page.locator(".vn-next.show").waitFor();
    };
    const cdp = await page.context().newCDPSession(page);
    for (const [width, height, bottom] of [[1280, 720, 0], [844, 390, 0], [844, 340, 21], [780, 301, 21], [780, 301, 34]]) {
      await page.setViewportSize({ width, height });
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom } });
      // The owner's first line and the longer narration two lines later, unchanged from the script.
      for (const fromLine of [0, 2]) {
        await playLine("ch5_bridge_after_return", fromLine);
        const layout = await page.evaluate(() => {
          const boxEl = document.querySelector(".vn-box");
          const box = boxEl.getBoundingClientRect();
          const frameTop = parseFloat(getComputedStyle(boxEl, "::before").top);
          const text = document.querySelector(".vn-text");
          const range = document.createRange(); range.selectNodeContents(text);
          const rows = [...range.getClientRects()];
          const buttons = [...document.querySelectorAll(".vn-ctl")];
          const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
          const scale = box.width / document.querySelector(".vn-box").offsetWidth;
          const labels = buttons.map(button => {
            const r = document.createRange(); r.selectNodeContents(button); return r.getBoundingClientRect();
          });
          return {
            // Check hit targets, not only their labels: tapping the text must still advance it.
            clear: rows.every(row => buttons.every(button => !intersects(row, button.getBoundingClientRect()))),
            contained: rows.every(row => row.left >= box.left && row.right <= box.right && row.top >= box.top && row.bottom <= box.bottom),
            // The baked-in horizontal rule lies about 45 stage px below the box top.
            header: labels.every(r => r.top >= box.top + frameTop * scale && r.bottom <= box.top + 45 * scale),
            taps: buttons.every(b => b.getBoundingClientRect().height >= 38),
          };
        });
        assert(layout.clear && layout.contained && layout.header && layout.taps,
          `${width}x${height}, safe-bottom=${bottom}, line=${fromLine}: ${JSON.stringify(layout)}`);
      }
    }
    for (const [id, line, face] of [
      ["ch5_bridge_after_return", 8, "baito_normal"],
      ["ch5_bridge_after_return", 11, "baito_smile"],
      ["ch5_tsumugi_serving", 4, "baito_smile"],
      ["ch1_tsumugi_first", 17, "normal"],
    ]) {
      await playLine(id, line);
      const portrait = page.locator('.portrait.active');
      await portrait.waitFor();
      assert((await portrait.getAttribute("src")).endsWith(`/tsumugi/chr_tsumugi_${face}.webp`), `${id}: ${face}`);
      await page.waitForFunction(() => [...document.querySelectorAll(".portrait.active")].every(img => img.complete && img.naturalWidth > 0));
    }
  });
  await check("money-choice-reason", async page => {
    const originalMoney = await page.evaluate(async () => (await import("./js/core/state.js")).state.money);
    const show = async (money, theme, text, hinted = null) => {
      await page.evaluate(async ({ money, theme, text, hinted }) => {
        const { state } = await import("./js/core/state.js");
        const { DB } = await import("./js/core/data.js");
        const vn = await import("./js/vn/engine.js");
        state.money = money;
        document.documentElement.dataset.uiTheme = theme;
        if (hinted) {
          const { relationshipElapsedDay } = await import("./js/core/chapter-clock.js");
          const from = relationshipElapsedDay(state);
          if (hinted === "fortune") state.flags._fortune_choice_sight = { char: "minto", chapter: state.chapter, from, until: from + 2 };
          else {
            delete state.flags._fortune_choice_sight;
            state.growth ??= { nodes: [], learned: [] };
            state.growth.nodes.push("K07");
          }
          DB.fortuneHints.choices["__money_choice_reason:money_reason"] = {
            kind: "conversation", target: "minto", options: ["pay", "free"], preferred: "free",
          };
        }
        window.moneyChoicePlay = vn.play({ dialogue_id: "__money_choice_reason", lines: [{ type: "choice", id: "money_reason", choices: [
          { text, next: "pay", condition_type: "money", threshold: 1000 }, { text: "やめておく", next: "free" },
        ] }], branches: { pay: [], free: [] } }, { growthScene: hinted === "growth" });
      }, { money, theme, text, hinted });
      await page.locator(".vn-choices.show .vn-choice").first().waitFor();
    };
    const short = "購入する（1,000円）";
    const long = "みんとのチェキを一枚買ってみる（1,000円）";
    for (const theme of ["classic", "paper"]) for (const [money, text] of [[999, short], [999, long], [1000, short], [1001, long]]) {
      await show(money, theme, text);
      const paid = page.locator('[data-test="choice-0"]');
      const reason = paid.locator(".vn-choice-reason");
      if (money < 1000) {
        assert.equal(await paid.getAttribute("aria-disabled"), "true");
        assert.equal(await reason.textContent(), "所持金不足（あと1円）");
        assert.equal(await paid.getAttribute("aria-describedby"), await reason.getAttribute("id"));
        const spoken = await paid.ariaSnapshot();
        assert(spoken.indexOf(text) >= 0 && spoken.indexOf(text) < spoken.indexOf("所持金不足（あと1円）"), "読み上げ情報は本文のあとに不足理由が続く");
        await paid.focus();
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-0", "不足理由にキーボードで到達できる");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(".vn-choices.show .vn-choice").count(), 2, "不足項目は実行されない");
        await page.keyboard.press("1");
        assert.equal(await page.locator(".vn-choices.show .vn-choice").count(), 2, "数字キーでも購入しない");
      } else {
        assert.equal(await paid.getAttribute("aria-disabled"), null);
        assert.equal(await reason.count(), 0);
      }
      const metrics = await paid.evaluate(button => {
        const text = button.firstChild;
        const range = document.createRange(); range.selectNodeContents(text);
        const cs = getComputedStyle(button);
        const scale = button.getBoundingClientRect().width / button.offsetWidth;
        return { size: parseFloat(cs.fontSize), reasonSize: button.querySelector(".vn-choice-reason") && parseFloat(getComputedStyle(button.querySelector(".vn-choice-reason")).fontSize),
          fits: range.getBoundingClientRect().width <= button.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) * scale + 1 };
      });
      assert(metrics.fits && metrics.size >= 18, `本文が収まる: ${JSON.stringify(metrics)}`);
      if (money < 1000) {
        assert.equal(metrics.reasonSize, 15, "補足の字は本文の縮小と独立する");
        assert(await reason.evaluate(el => {
          const box = el.getBoundingClientRect(), button = el.closest("button").getBoundingClientRect();
          return box.top >= button.top && box.bottom <= button.bottom;
        }), "補足が選択肢の枠内に見える");
      }
      await page.locator('[data-test="choice-1"]').click();
      await page.locator(".vn-choices.show").waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).state.money), money, "料金・購入処理を変更しない");
    }
    await show(999, "paper", short, "fortune");
    assert.equal(await page.locator('[data-test="choice-1"]').getAttribute("aria-label"), "やめておく（占いの予感）");
    assert.equal(await page.locator('[data-test="choice-1"]').evaluate(el => el.classList.contains("fortune-hint")), true, "占いヒントを残す");
    assert.equal(await page.locator('[data-test="choice-0"] .vn-choice-reason').textContent(), "所持金不足（あと1円）");
    await page.locator('[data-test="choice-1"]').click();
    await show(999, "classic", short, "growth");
    assert.equal(await page.locator('[data-test="choice-1"]').getAttribute("aria-label"), "やめておく（会話の気配）");
    assert.equal(await page.locator('[data-test="choice-1"]').evaluate(el => el.classList.contains("growth-hint")), true, "成長ヒントを残す");
    assert.equal(await page.locator('[data-test="choice-0"] .vn-choice-reason').textContent(), "所持金不足（あと1円）");
    await page.locator('[data-test="choice-1"]').click();
    await page.evaluate(async money => { (await import("./js/core/state.js")).state.money = money; }, originalMoney);
  });
  await check("choice-modal-log-keyboard", async page => {
    const saved = await storageSnapshot(page);
    await page.locator('[data-test="vn-log"]').focus();
    await page.keyboard.press("Enter");
    await page.locator(".vn-log.show").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".vn-log.show").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "vn-log");

    const openModal = () => page.evaluate(async () => {
      const { modal } = await import("./js/core/ui.js");
      window.keyboardModal = modal({ title: "Keyboard", options: [
        { label: "Cancel", value: "cancel" }, { label: "Confirm", value: "confirm", primary: true },
      ] });
    });
    await openModal();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Confirm");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.keyboardModal), "cancel");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "vn-log");
    await openModal();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.keyboardModal), "confirm");

    const showChoices = async () => {
      if (await page.locator("#preview-scene").inputValue() === "choices") await page.locator("#preview-restart").click();
      else await page.selectOption("#preview-scene", "choices");
      if (await page.locator('[data-test="vn-skip"]').getAttribute("aria-pressed") === "false") {
        await page.locator('[data-test="vn-skip"]').click();
      }
      await page.locator('[data-test="choice-0"]').waitFor();
    };
    await showChoices();
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-0");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-1");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-0");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "choice-1");
    await page.keyboard.press("Enter");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    await showChoices();
    await page.keyboard.press("2");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    await showChoices();
    await page.keyboard.press("3");
    assert.equal(await page.locator(".vn-choice").count(), 2, "Missing numbered choice does nothing");
    await page.keyboard.press("1");
    await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
    assert.deepEqual(await storageSnapshot(page), saved);
  });
  await check("keyboard-controls", async page => {
    await page.locator(".vn-next.show").waitFor();
    const saved = await storageSnapshot(page);
    const text = await page.locator(".vn-text").textContent();
    for (const key of ["Enter", "Space"]) {
      const log = page.locator('[data-test="vn-log"]');
      await log.focus(); await page.keyboard.press(key);
      await page.locator(".vn-log.show").waitFor();
      assert.equal(await page.locator(".vn-text").textContent(), text, `${key} opens LOG without advancing dialogue`);
      await page.locator(".vn-log button").press(key);
      await page.locator(".vn-log.show").waitFor({ state: "hidden" });
      for (const control of ["vn-glossary", "vn-config"]) {
        await page.locator(`[data-test="${control}"]`).focus();
        await page.keyboard.press(key);
        await page.locator("#modal.show").waitFor();
        assert.equal(await page.locator(".vn-text").textContent(), text, `${key} opens ${control} without advancing`);
        await page.locator("#modal .modal-actions button").last().press(key);
        await page.locator("#modal.show").waitFor({ state: "hidden" });
      }
      const auto = page.locator('[data-test="vn-auto"]');
      await auto.focus(); await page.keyboard.press(key);
      assert.equal(await auto.getAttribute("aria-pressed"), "true");
      await page.keyboard.press(key);
      assert.equal(await auto.getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator(".vn-text").textContent(), text, "AUTO activation does not consume a dialogue line");
    }
    // Native form controls also keep their own activation semantics during a conversation.
    await page.locator("#preview-scene").focus();
    await page.keyboard.press("Space"); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".vn-text").textContent(), text);
    // Unfocused Enter/Space still advance normally.
    await page.locator("#preview-scene").evaluate(el => el.blur());
    await page.keyboard.press("Enter");
    await page.waitForFunction(old => document.querySelector(".vn-text").textContent !== old, text);
    await page.locator(".vn-next.show").waitFor();
    const second = await page.locator(".vn-text").textContent();
    await page.keyboard.press("Space");
    await page.waitForFunction(old => document.querySelector(".vn-text").textContent !== old, second);
    for (const key of ["Enter", "Space"]) {
      await page.selectOption("#preview-scene", "choices");
      const skip = page.locator('[data-test="vn-skip"]');
      await skip.focus(); await page.keyboard.press(key);
      assert.equal(await skip.getAttribute("aria-pressed"), "true");
      await page.locator('[data-test="choice-0"]').waitFor();
      await skip.focus(); await page.keyboard.press(key);
      assert.equal(await skip.getAttribute("aria-pressed"), "false");
      await page.locator('[data-test="choice-0"]').press(key);
      await page.locator('[data-test="choice-0"]').waitFor({ state: "hidden" });
      await page.locator(".vn-next.show").waitFor();
      await page.keyboard.press(key);
      await page.waitForFunction(() => document.querySelector("#preview-status").textContent.includes("会話終了"));
    }
    assert.deepEqual(await storageSnapshot(page), saved, "Keyboard controls must not change saved games/config");
  });
  for (const [label, viewport] of [["desktop", { width: 1280, height: 768 }], ["landscape", { width: 844, height: 438 }]]) {
    await check(label, async page => {
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
      const saved = await storageSnapshot(page);
      const geometry = await page.evaluate(() => {
        const box = document.querySelector(".vn-box").getBoundingClientRect();
        const controls = document.querySelector(".vn-controls").getBoundingClientRect();
        const name = document.querySelector(".vn-name");
        return { aligned:Math.abs((name.getBoundingClientRect().top+name.getBoundingClientRect().height/2)-(controls.top+controls.height/2))/(box.width/1216), font: getComputedStyle(name).fontFamily,
          nameTop: parseFloat(getComputedStyle(name).top),
          buttons: [...document.querySelectorAll(".vn-ctl")].map(el => parseFloat(getComputedStyle(el).minHeight)) };
      });
      assert(Math.abs(geometry.aligned-16)<=.5,"commands sit 16px above the name tab");
      assert(geometry.font.includes("Suien Name"));
      assert.equal(geometry.nameTop, -36);
      assert(geometry.buttons.every(height => height >= 44));
      await page.locator('[data-test="vn-auto"]').click();
      assert(await page.locator('[data-test="vn-auto"]').evaluate(el => el.classList.contains("on")));
      await page.locator('[data-test="vn-auto"]').click();
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-inner")?.textContent.includes("よし、今のはかなり儚い。決まった"));
      const fits = await page.locator(".vn-inner").evaluate(el => el.getBoundingClientRect().bottom <= el.closest(".vn-box").getBoundingClientRect().bottom - 5);
      assert(fits, "Inner voice must remain inside dialogue frame");
      await page.locator('[data-test="vn-log"]').click();
      await page.locator(".vn-log.show").waitFor();
      await page.locator(".vn-log button").click();
      await page.locator('[data-test="vn-glossary"]').click();
      await page.getByText("用語集", { exact: true }).waitFor();
      await page.getByRole("button", { name: "閉じる", exact: true }).last().click();
      await page.selectOption("#preview-scene", "choices");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……今日はどうしようか");
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator('[data-test="choice-0"]').waitFor();
      const modes = () => page.evaluate(() => ({
        auto: document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed"),
        skip: document.querySelector('[data-test="vn-skip"]').getAttribute("aria-pressed"),
        fast: document.body.classList.contains("vn-skip"),
      }));
      await page.locator('[data-test="vn-auto"]').click();
      assert.deepEqual(await modes(), { auto: "true", skip: "false", fast: false });
      await page.locator('[data-test="vn-skip"]').click();
      assert.deepEqual(await modes(), { auto: "false", skip: "true", fast: true });
      await page.locator('[data-test="vn-auto"]').click();
      await page.keyboard.down("Control");
      assert.deepEqual(await modes(), { auto: "false", skip: "true", fast: true });
      await page.locator('[data-test="vn-auto"]').click();
      await page.keyboard.up("Control");
      assert.deepEqual(await modes(), { auto: "true", skip: "false", fast: false });
      await page.locator('[data-test="vn-auto"]').click();
      assert.deepEqual(await modes(), { auto: "false", skip: "false", fast: false });
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator('[data-test="choice-0"]').click();
      await page.waitForFunction(() => document.querySelector("#preview-status").textContent.includes("会話終了"));
      await page.selectOption("#preview-scene", "names");
      await page.waitForFunction(() => document.querySelector(".vn-name.show")?.textContent === "アダム");
      await page.locator(".vn-next.show").waitFor();
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-name.show")?.textContent === "はじめ");
      await page.selectOption("#preview-scene", "narration");
      await page.locator(".vn-box.narration").waitFor();
      assert.equal(await page.locator(".vn-name.show").count(), 0);
      const frameStyle = () => page.locator(".vn-box").evaluate(box => ({
        frame: getComputedStyle(box, "::before").backgroundImage,
        top: getComputedStyle(box, "::before").top,
        paintedHeight: parseFloat(getComputedStyle(box, "::before").height),
        nameHidden: getComputedStyle(box.querySelector(".vn-name")).display === "none",
        height: box.offsetHeight,
      }));
      const narration = await frameStyle();
      assert(narration.frame.includes("narration.svg"), "Narration must use the flat, nameless frame");
      assert(narration.nameHidden);
      await page.locator(".vn-next.show").waitFor();
      // A newly opened scene rejects input for 320ms, even if its text is ready.
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.locator(".vn-box.thought").waitFor();
      assert.deepEqual(await frameStyle(), narration, "Inner monologue must use the same nameless frame");
      assert.deepEqual(await storageSnapshot(page), saved, "Preview must not change saved games/config");
      await page.selectOption("#preview-scene", "hiyori");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "……また見つかっちゃった");
      await page.locator(".vn-next.show").waitFor();
      const dialogue = await frameStyle();
      assert.equal(dialogue.frame,narration.frame,"speaker visibility does not replace or resize the panel");
      assert.equal(dialogue.nameHidden, false);
      assert.equal(dialogue.height, narration.height, "Switching frames must preserve text layout");
      assert.equal(dialogue.paintedHeight,narration.paintedHeight,"speech and narration retain the same painted height");
      assert.equal(dialogue.top,narration.top,"speech and narration retain the same top edge");
    }, { viewport });
  }
}, { entry: new URL("conversation-preview.html?theme=classic", baseURL).href, readySelector: ".vn-box" });
