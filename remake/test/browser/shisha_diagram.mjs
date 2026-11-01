import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// スミさんの「シーシャの仕組み」解説（ch1_sumi_basics）に付いた図解（#1128）。
// 本編と同じエンジンで会話プレビューを再生し、段階表示・位置・SKIP/再開・低減モーションを確かめる。
const PREVIEW = (process.env.BASE_URL || "http://127.0.0.1:8123/remake/") + "conversation-preview.html";

const stepText = {
  show: "ガラスボトル（水入れ）を置き",
  heat: "炭の『熱』でじわじわと温める",
  smoke: "ステムを通って下のボトルに行き",
  bubble: "水をくぐると煙が冷えて",
  hose: "ホースを通って、お前の口に届く",
  hide: "グリセリンと熱の仕事だ",
};

async function selectScene(page) {
  await page.selectOption("#preview-scene", "shisha");
  await page.waitForFunction(() =>
    document.querySelector(".vn-text")?.textContent.includes("落ち着いた時間"));
}

// 目的の台詞まで会話を送る（打ち切り・連打でも図は1つだけ）。
async function advanceTo(page, substr) {
  for (let i = 0; i < 60; i++) {
    // 次の行の素材待ち中は前の文が残る。表示完了後に検査してから送る。
    await page.locator("#vn.active .vn-next.show").waitFor();
    const here = await page.evaluate(s => document.querySelector(".vn-text")?.textContent.includes(s) || false, substr);
    if (here) return;
    assert((await page.locator(".sd-diagram").count()) <= 1, "diagram never duplicates");
    await page.locator(".vn-text").click({ force: true });
    await page.waitForTimeout(70);
  }
  const reached = await page.evaluate(async () => {
    const { backlog } = await import("./js/vn/engine.js");
    return backlog().slice(-30).map(row => row.text);
  });
  throw new Error(`line not reached: ${substr}; backlog=${JSON.stringify(reached)}`);
}

const stepOf = page => page.evaluate(() => document.querySelector(".sd-diagram")?.dataset.step || null);
const count = page => page.locator(".sd-diagram").count();

await suite("shisha-diagram", async check => {
  await check("experienced-full-explanation", async page => {
    await selectScene(page);
    const before = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const { paidAction } = await import("./js/core/stats.js");
      state.day = 9;
      state.flags._craft_practice_runs = [1, 2].map(() => ({ scope: "full", success: true, served: true }));
      // 本編の自由行動と同じ成長候補の預かり・精算を使う。プレビュー単独では成長しない。
      window.__sumiReviewAction = paidAction(() => new Promise(resolve => {
        window.__finishSumiReviewAction = resolve;
      }), { consumed: () => true });
      return state.stats.technique;
    });
    // 制作経験があっても、初めての会話では全文（水と煙の説明）を読む（2026-11-01 オーナー決定）。
    await advanceTo(page, stepText.hide);
    assert.equal(await count(page), 1);
    await advanceTo(page, "はい……！ ありがとうございます、スミさん");
    for (let i = 0; i < 8; i++) {
      if (await page.evaluate(() => document.querySelector("#preview-status")?.textContent.includes("会話終了"))) break;
      await page.locator(".vn-text").click({ force: true });
      await page.waitForTimeout(70);
    }
    await page.waitForFunction(() => document.querySelector("#preview-status")?.textContent.includes("会話終了"));
    const result = await page.evaluate(async () => {
      window.__finishSumiReviewAction();
      await window.__sumiReviewAction;
      const { state } = await import("./js/core/state.js");
      const { backlog } = await import("./js/vn/engine.js");
      return { technique: state.stats.technique, memories: state.relationshipMemories,
        text: backlog().map(row => row.text).join("\n") };
    });
    assert.equal(result.technique - before, 1, "technique cue settles once as the normal action's 1P reward");
    assert.equal(result.memories.filter(id => id === "sumi_heat").length, 1, "same memory, once");
    assert.match(result.text, /蒸らす/);
    assert.match(result.text, /グリセリン/);
    assert.equal(await count(page), 0, "no diagram after the explanation ends");
  });

  await check("steps-and-cleanup", async page => {
    await selectScene(page);
    assert.equal(await count(page), 0, "no diagram before its cue");

    // show → heat → smoke → bubble → hose の順で、台詞送りに合わせて段階が進む
    const order = ["show", "heat", "smoke", "bubble", "hose"];
    for (const step of order) {
      await advanceTo(page, stepText[step]);
      await page.waitForFunction(s => document.querySelector(".sd-diagram")?.dataset.step === s, step);
      assert.equal(await stepOf(page), step, `step=${step}`);
      assert.equal(await count(page), 1, "single diagram instance");
    }

    // 凡例：ホース段階では①〜③がdone、④がactive
    const legend = await page.evaluate(() => [...document.querySelectorAll(".sd-step")]
      .map(li => ({ done: li.classList.contains("done"), active: li.classList.contains("active") })));
    assert.deepEqual(legend.map(l => l.done), [true, true, true, false]);
    assert.deepEqual(legend.map(l => l.active), [false, false, false, true]);

    // 図は会話枠(.vn-box)に重ならない位置・大きさ
    const geo = await page.evaluate(() => {
      const d = document.querySelector(".sd-diagram").getBoundingClientRect();
      const box = document.querySelector(".vn-box").getBoundingClientRect();
      const stage = document.getElementById("stage").getBoundingClientRect();
      return { overlap: d.bottom > box.top, inStage: d.right <= stage.right + 1 && d.top >= stage.top - 1 };
    });
    assert(!geo.overlap, "diagram does not cover the dialogue box");
    assert(geo.inStage, "diagram stays within the stage");

    // hide の合図で片付く
    await advanceTo(page, stepText.hide);
    await page.waitForFunction(() => document.querySelector(".sd-diagram") === null);
    assert.equal(await count(page), 0, "diagram removed on hide cue");

    // 別の場面へ移っても残らない（会話終了のcleanup）
    await page.selectOption("#preview-scene", "narration");
    await page.waitForFunction(() => document.querySelector(".vn-box.narration"));
    assert.equal(await count(page), 0, "diagram gone after leaving the scene");
  });

  await check("skip-and-restart", async page => {
    await selectScene(page);
    // SKIP（早送り）で一気に送っても二重に出ない
    await page.locator('[data-test="vn-skip"]').click();
    for (let i = 0; i < 40; i++) {
      assert((await count(page)) <= 1, "no duplicate diagram during skip");
      const ended = await page.evaluate(() =>
        document.querySelector("#preview-status")?.textContent.includes("会話終了"));
      if (ended) break;
      await page.locator(".vn-text").click({ force: true });
      await page.waitForTimeout(40);
    }
    // 終わったら図は残らない
    await page.waitForFunction(() => document.querySelector(".sd-diagram") === null);

    // 「もう一度」で再生し直す＝play()の入口で前の図を消す（LOADと同じ経路）
    await page.locator("#preview-restart").click();
    await page.waitForFunction(() =>
      document.querySelector(".vn-text")?.textContent.includes("落ち着いた時間"));
    assert.equal(await count(page), 0, "restart starts with no stale diagram");
    await advanceTo(page, stepText.heat);
    assert.equal(await stepOf(page), "heat");
    assert.equal(await count(page), 1);
  });

  await check("reduced-motion", async page => {
    await selectScene(page);
    await advanceTo(page, stepText.smoke);
    await page.waitForFunction(() => document.querySelector(".sd-diagram")?.dataset.step === "smoke");
    const r = await page.evaluate(() => {
      const d = document.querySelector(".sd-diagram");
      const dot = d.querySelector(".sd-smoke-dot");
      return { still: d.classList.contains("sd-still"), anim: getComputedStyle(dot).animationName };
    });
    assert(r.still, "reduced motion uses the still diagram");
    assert.equal(r.anim, "none", "no animation under reduced motion");
    assert.equal(await stepOf(page), "smoke", "step still advances when motion is reduced");
  }, { reducedMotion: "reduce" });

  // 部位ラベル（炭・フレーバー・ステム・水・ホース）が初見でも分かるよう常に出ている
  await check("part-labels", async page => {
    await selectScene(page);
    await advanceTo(page, stepText.show);
    await page.waitForFunction(() => document.querySelector(".sd-diagram")?.dataset.step === "show");
    const tags = await page.evaluate(() =>
      [...document.querySelectorAll(".sd-diagram .sd-tag")].map(t => t.textContent.trim()));
    for (const label of ["炭", "フレーバー", "ステム", "水", "ホース"]) {
      assert(tags.includes(label), `part label present: ${label}`);
    }
    // ラベルは図カード（.sd-art）の枠内に収まり、切れていない
    const fits = await page.evaluate(() => {
      const art = document.querySelector(".sd-art").getBoundingClientRect();
      return [...document.querySelectorAll(".sd-diagram .sd-tag")].every(t => {
        const b = t.getBoundingClientRect();
        return b.left >= art.left - 1 && b.right <= art.right + 1;
      });
    });
    assert(fits, "part labels stay within the diagram art box");
  });

  // スマホ縦（390x844）：図が台詞枠・名前欄と重ならず、ステージ内に収まる
  await check("portrait-layout", async page => {
    await selectScene(page);
    const order = ["show", "heat", "smoke", "bubble", "hose"];
    for (const step of order) {
      await advanceTo(page, stepText[step]);
      await page.waitForFunction(s => document.querySelector(".sd-diagram")?.dataset.step === s, step);
      const geo = await page.evaluate(() => {
        const d = document.querySelector(".sd-diagram").getBoundingClientRect();
        const box = document.querySelector(".vn-box").getBoundingClientRect();
        const name = document.querySelector(".vn-name:not([hidden])")?.getBoundingClientRect();
        const stage = document.getElementById("stage").getBoundingClientRect();
        return {
          overlapBox: d.bottom > box.top && d.right > box.left && d.left < box.right,
          overlapName: !!name && name.width > 0 && d.bottom > name.top && d.right > name.left && d.left < name.right,
          inStage: d.right <= stage.right + 1 && d.top >= stage.top - 1 && d.left >= stage.left - 1,
          single: document.querySelectorAll(".sd-diagram").length === 1,
        };
      });
      assert(!geo.overlapBox, `portrait: diagram clear of dialogue box at ${step}`);
      assert(!geo.overlapName, `portrait: diagram clear of name plate at ${step}`);
      assert(geo.inStage, `portrait: diagram within stage at ${step}`);
      assert(geo.single, `portrait: single diagram at ${step}`);
    }
  }, { viewport: { width: 390, height: 844 } });
}, { entry: PREVIEW, readySelector: "#preview-scene:not([disabled])" });
