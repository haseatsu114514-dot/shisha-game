// カードゲーム「一台勝負」（ICG）の遊び方の種類: ガイド（次にすることの案内・自動で冷める・消えるときの印）と、4人対戦（1:1:1:1）。
// 1対1の通しの流れ・本編の入口は ichidai.mjs。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { overflowed } from "./ichidai_support.mjs";

const t = (name) => `[data-test="${name}"]`;
const page1 = (query) => ({ pageEntry: `${baseURL}ichidai.html?${query}`, pageReadySelector: t("ichi-menu-start") });
const data = (page, key) => page.locator(t("ichi-game")).getAttribute(`data-${key}`);

await suite("ichidai-modes", async (check) => {
  // ガイド（2026-11-11 オーナー「熱が冷めるのが自動で処理されなかったり」「急に消えたり」「あまりカード慣れてない人には自動でガイドが進み
  // 遊びやすいよう。次何をすればいいか」）: 既定で入っている。次の1手を言葉と光る場所で示し、1手打つたびに次へ進む。
  // ターンのはじめに冷めるのは自動で進み、炭が灰になるときはその場所に印が出る
  await check("guide-points-the-next-step-and-cools-by-itself", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    await page.locator(t("ichi-vs")).waitFor();
    await page.locator(t("ichi-vs")).click();
    await page.locator(t("ichi-foe")).waitFor();
    assert.equal(await page.locator(t("ichi-assist")).getAttribute("aria-pressed"), "true", "ガイドは、はじめから入っている");
    // 最初の火: 「つぎ」に1手が出て、選ぶ札が光り、「ここ」の矢印が付く
    const next = page.locator(t("ichi-next-step"));
    await next.waitFor();
    assert.equal(await next.getAttribute("data-action"), "embers");
    assert.match(await next.innerText(), /手札から3枚えらんで「立ち上げる」/);
    // 案内の札は、上から「流れ」（このターンの順番と、いまどこか）・「ねらい」（何を目ざすか）・「つぎ」
    assert.deepEqual([await page.locator(`${t("ichi-steps")} span`).allInnerTexts().then((x) => x.map((y) => y.replace(/\s+/g, ""))), await page.locator(t("ichi-steps")).getAttribute("data-now")], [["1炭にする札を選ぶ", "2立ち上げる"], "0"]);
    assert.match(await page.locator(t("ichi-goal")).innerText(), /ねらい[\s\S]*熱3/);
    const order = await page.evaluate(() => ["ichi-steps", "ichi-goal", "ichi-next-step"].map((n) => document.querySelector(`[data-test="${n}"]`).getBoundingClientRect().top));
    assert.ok(order[0] < order[1] && order[1] < order[2], "流れ → ねらい → つぎ の順に並ぶ");
    assert.equal(await page.locator(`${t("ichi-hand")} .ichi-hand-card.is-hint`).count(), 3, "選ぶとよい3枚が光る");
    assert.ok(await page.locator(t("ichi-pointer")).count() >= 1, "押す場所に矢印が出る");
    // 光っている札を自分で選ぶと、こんどは「立ち上げる」が光る（案内が1手ぶん進む）
    const hinted = await page.locator(`${t("ichi-hand")} .ichi-hand-card.is-hint`).evaluateAll((list) => list.map((n) => n.dataset.test));
    for (const name of hinted) await page.locator(t(name)).click(); // 押すたびに光る札が減るので、先に名前を控えてから押す
    assert.equal(await page.locator(`${t("ichi-embers")}.is-hint`).count(), 1, "選び終えたら、決めるボタンが光る");
    assert.equal(await page.locator(t("ichi-steps")).getAttribute("data-now"), "1", "流れも「立ち上げる」へ進む");
    // 準備の最初の自分のターン: ねらいは葉の枚数と配合。葉の盆の見出しに、選んだ枚数と、蒸らせない理由が字で出る
    await page.locator(t("ichi-embers")).click();
    await page.waitForFunction(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.phase === "prep" && g.dataset.turn === "me" && g.dataset.input === "1"; }, null, { timeout: 30000 });
    assert.match(await page.locator(t("ichi-guide")).innerText(), /準備 1\/6/);
    assert.deepEqual([await page.locator(t("ichi-goal")).getAttribute("data-leaves"), await page.locator(t("ichi-goal")).getAttribute("data-want")], ["0", "12"]);
    assert.match(await page.locator(t("ichi-goal")).innerText(), /葉0\/12枚[\s\S]*ダブルアップル0\/12/);
    assert.match(await page.locator(t("ichi-market-head")).innerText(), /葉を選ぶ：0\/\d枚（2種類まで）[\s\S]*蒸らすには：葉が8枚以上要る/);
    const fit = await page.evaluate(() => { const g = document.querySelector('[data-test="ichi-guide"]').getBoundingClientRect(), m = document.querySelector('[data-test="ichi-market"]').getBoundingClientRect(); return g.bottom <= m.top + 1; });
    assert.equal(fit, true, "案内の札は、葉の盆に隠れない");
    // 葉を選んで「詰める」と、ほかにすることが無ければ、そのまま相手の番へ進む（「ターンを終える」を押さなくてよい）
    const picks = await page.locator(`${t("ichi-market")} .ichi-pile-main.is-hint`).count();
    assert.ok(picks >= 1, "詰めるとよい葉が光る");
    for (let k = 0; k < 4 && !(await page.locator(`${t("ichi-pack")}.is-hint`).count()); k++) await page.locator(`${t("ichi-market")} .ichi-pile-main.is-hint`).first().click();
    const usable = await page.evaluate(() => document.querySelectorAll('[data-test="ichi-hand"] .ichi-hand-card.can[data-card]:not([data-card="flat"]):not([data-card="cube"]):not([data-card="dense_flat"])').length);
    await page.locator(t("ichi-pack")).click();
    if (!usable) await page.waitForFunction(() => document.querySelector('[data-test="ichi-game"]').dataset.turn !== "me" || document.querySelector('[data-test="ichi-game"]').dataset.wait !== "prep" || !document.querySelector('[data-test="ichi-end"]'), null, { timeout: 8000 });
    // 炭が灰になる印と、案内の「起きたこと」を見張る
    await page.evaluate(() => {
      window.__ichiSeen = { burn: [], last: [], manualCool: 0 };
      const root = document.querySelector('[data-test="ichi-game"]');
      new MutationObserver(() => {
        for (const n of root.querySelectorAll('[data-test="ichi-burn"]')) { const k = `${n.dataset.kind}:${n.dataset.why}`; if (!window.__ichiSeen.burn.includes(k)) window.__ichiSeen.burn.push(k); }
        const last = root.querySelector('[data-test="ichi-last"]')?.textContent; if (last && !window.__ichiSeen.last.includes(last)) window.__ichiSeen.last.push(last);
        // 冷めるところで、自分が炭を選ぶのを待っていないこと（選べる炭のボタンが出ない）
        if (root.dataset.wait === "cool" && root.dataset.turn === "me" && root.querySelector('[data-test="ichi-zone"] .ichi-coal-btn.can')) window.__ichiSeen.manualCool++;
      }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-wait"] });
    });
    // あとは「おすすめで進める」だけで、最初の審査まで進める
    const acts = [];
    for (let guard = 0; guard < 400 && !(await page.locator(t("ichi-result")).count()); guard++) {
      // 見つけるのと押すのを、画面の中で一度に行う（見つけたあとに番が替わってボタンが消えると、押すのを待ち続けてしまうため）
      const did = await page.evaluate(() => {
        const g = document.querySelector('[data-test="ichi-game"]'), b = document.querySelector('[data-test="ichi-do-hint"]:not([disabled])');
        if (g.dataset.turn !== "me" || !b || !document.querySelector(".ichi-sheet").hidden) return null;
        const action = document.querySelector('[data-test="ichi-next-step"]')?.dataset.action || "?";
        b.click();
        return action;
      });
      if (did) acts.push(did);
      await page.waitForTimeout(did ? 60 : 90);
    }
    assert.equal(await page.locator(t("ichi-result")).count(), 1, `おすすめだけで最初の審査まで進む（打った手: ${acts.join(",")}）`);
    for (const need of ["pack", "steam", "end"]) assert.ok(acts.includes(need), `案内に ${need} が出る（${acts.join(",")}）`);
    // 提供では、流れが「冷める → 熱を合わせる → カード1枚 → 終える」、ねらいは熱（いまいくつ・あといくつ）
    assert.ok(acts.some((x) => ["place", "puton", "charge"].includes(x)), `炭の手も案内に出る（${acts.join(",")}）`);
    const seen = await page.evaluate(() => window.__ichiSeen);
    assert.equal(seen.manualCool, 0, "冷めるのは自動で進む（炭を選ばせない）");
    assert.ok(seen.last.some((x) => /冷めた：熱\d+→\d+/.test(x)), `どう冷めたかが案内に出る: ${JSON.stringify(seen.last)}`);
    assert.ok(seen.burn.includes("ash:cool"), `炭が灰になるときに、その場所に印が出る: ${JSON.stringify(seen.burn)}`);
    assert.deepEqual(await overflowed(page), [], "案内を出しても、文字が枠からはみ出さない");
    await page.locator(t("ichi-next")).click();
    // ガイドを切ると、案内・光・おすすめのボタンが消え、冷ます炭を自分で選ぶ流れに戻る
    await page.waitForFunction(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.turn === "me" && g.dataset.wait === "main" && document.querySelector(".ichi-sheet").hidden; }, null, { timeout: 30000 });
    await page.locator(t("ichi-next-step")).waitFor();
    assert.deepEqual(await page.locator(`${t("ichi-steps")} span`).allInnerTexts().then((x) => x.map((y) => y.replace(/[\s✓\d]+/g, ""))), ["冷める", "熱を合わせる", "カード枚", "終える"]);
    assert.equal(await page.locator(`${t("ichi-steps")} span.is-done`).count() >= 1, true, "冷めるは済み");
    const goal = await page.locator(t("ichi-goal")).evaluate((n) => ({ ...n.dataset, text: n.innerText.replace(/\s+/g, "") }));
    assert.match(goal.text, /^ねらい熱\d+★?いま\d+・(あと\+\d+|\d+下げる|ぴったり)/, `ねらいの熱が出る: ${goal.text}`);
    assert.equal(Number(goal.now), await page.evaluate(() => window.__ichidai.game.P[0].zone.reduce((a, c) => a + c.f, 0)));
    await page.locator(t("ichi-assist")).click();
    assert.equal(await page.locator(t("ichi-assist")).getAttribute("aria-pressed"), "false");
    assert.deepEqual([await page.locator(t("ichi-next-step")).count(), await page.locator(".is-hint").count(), await page.locator(t("ichi-do-hint")).count(), await page.locator(t("ichi-pointer")).count(),
      await page.locator(t("ichi-steps")).count(), await page.locator(t("ichi-goal")).count()], [0, 0, 0, 0, 0, 0], "ガイドを切ると、案内は出ない");
    await page.locator(t("ichi-end")).click();
    // 次の自分の番（冷めるところ）まで待つ。あいだに審査の結果が出たら「次へ」
    // data-input="1"＝進行が人の入力を待っている（審査の演出の途中は "0"。卓はもう次の番の見た目になっているので、これで見分ける）
    const myCool = () => page.evaluate(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.turn === "me" && g.dataset.wait === "cool" && g.dataset.input === "1" && document.querySelector(".ichi-sheet").hidden; });
    for (let guard = 0; guard < 300 && !(await myCool()); guard++) {
      if (await page.locator(t("ichi-next")).count()) await page.locator(t("ichi-next")).click();
      else await page.waitForTimeout(100);
    }
    const pick = page.locator(`${t("ichi-zone")} .ichi-coal-btn.can`);
    await pick.first().waitFor({ timeout: 8000 }); // ガイドを切ると、冷ます炭を自分で選ぶ
    assert.match(await page.locator(t("ichi-guide")).innerText(), /冷める：火を下げる炭を選ぶ/);
    assert.equal(await page.evaluate(() => window.__ichidai.game.wait.left), 1, "冷めるのは1ターンに1段階（第0.5版）");
    // 演出の途中（炭の印を出している間）に押した操作も、捨てずに受け付ける（以前は、画面は押せる見た目なのに黙って捨てられていた）
    const left = await page.evaluate(() => window.__ichidai.game.wait.left);
    await pick.first().click();
    if (left > 1) { await page.waitForTimeout(70); await pick.first().click(); }
    await page.waitForFunction(() => { const w = window.__ichidai.game.wait; return w?.type === "main" && w.player === 0; }, null, { timeout: 6000 });
  }, page1("kit=b&tournament=practice&level=1&seed=33&foe=a"));

  // 4人対戦（1:1:1:1。2026-11-11 オーナー「みんなのやると狭くなるからライバルは簡易的にUIして表情やセリフメインに」）:
  // 相手3人は卓の奥に顔を並べ、数字は顔の横の小さな札だけ。卓の奥には相手ごとの炭と一口だけ。自分の側は1対1と同じ
  await check("four-players-rivals-are-faces-and-lines", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    const vs = page.locator(t("ichi-vs"));
    await vs.waitFor();
    assert.equal(await vs.getAttribute("data-count"), "4", "VS は4人");
    assert.deepEqual(await vs.locator(".ichi-vs-player > b").allInnerTexts(), ["はじめ", "スミさん", "なる", "アダム"]);
    await vs.click();
    await page.locator(t("ichi-rivals")).waitFor();
    assert.equal(await data(page, "players"), "4");
    // 相手は3つの席（顔）。1対1の相手の札・相手の半分は出さない
    assert.deepEqual([await page.locator(`${t("ichi-game")} .ichi-seat.is-rival`).count(), await page.locator(t("ichi-foe")).count(), await page.locator(".ichi-foe-panel").count(), await page.locator(t("ichi-foe-zone")).count()], [3, 0, 0, 0]);
    assert.deepEqual(await page.locator(".ichi-rival-name").allInnerTexts(), ["スミさん", "なる", "アダム"]);
    for (const i of [1, 2, 3]) {
      assert.equal(await page.locator(t(`ichi-rival-bust-${i}`)).count(), 1, `相手${i}はバストアップ（立ち絵）で出る`);
      assert.equal(await page.locator(t(`ichi-rival-score-${i}`)).getAttribute("data-score"), "0");
      assert.equal(await page.locator(t(`ichi-rival-mat-${i}`)).count(), 1, "卓の奥に、その人の炭と一口の置き場");
    }
    assert.deepEqual([await page.locator(`${t("ichi-standings")} li`).count(), await page.locator(`${t("ichi-order")} .ichi-order-chip`).count()], [4, 4], "順位と手番の順は4人ぶん");
    // 席・小さな札は、左上のラウンドの札・右上の案内・ボタンに重ならない。顔は画面の中
    const lay = await page.evaluate(() => {
      const r = (n) => n.getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const plates = [...document.querySelectorAll(".ichi-rival-plate")].map(r), faces = [...document.querySelectorAll(".ichi-seat.is-rival .ichi-foe-bust img")].map(r);
      const others = [".ichi-clock", ".ichi-guide", ".ichi-actions > *", ".ichi-head-buttons > *"].flatMap((q) => [...document.querySelectorAll(q)].map(r));
      const stage = r(document.querySelector("#stage"));
      return { overlaps: plates.filter((p) => others.some((o) => hit(p, o))).length, pairs: plates.filter((p, i) => plates.some((q, j) => j > i && hit(p, q))).length,
        inside: plates.every((p) => p.left >= stage.left && p.right <= stage.right && p.top >= stage.top), faces: faces.length };
    });
    assert.deepEqual(lay, { overlaps: 0, pairs: 0, inside: true, faces: 3 }, "相手の札はほかのUIにも、となりの札にも重ならない");
    // 対戦の始め: 相手が順にひとこと。吹き出しは、その人の顔の下（となりの相手の顔には重ねない）
    const say = page.locator(`${t("ichi-say")}.is-below`).first();
    await say.waitFor({ timeout: 8000 });
    assert.match(await say.getAttribute("data-line"), /^ichidai_(sumi|naru|adam)_start$/);
    const cover = await page.evaluate(() => {
      const s = document.querySelector('[data-test="ichi-say"]').getBoundingClientRect(), who = document.querySelector('[data-test="ichi-say"]').dataset.line.split("_")[1];
      const eyes = [...document.querySelectorAll(".ichi-seat.is-rival")].map((n) => { const b = n.getBoundingClientRect(); return { x: b.left + 58 * (b.width / 200), y: b.top + 50 * (b.height / 172) }; });
      return { who, onFace: eyes.filter((e) => e.x > s.left && e.x < s.right && e.y > s.top && e.y < s.bottom).length };
    });
    assert.equal(cover.onFace, 0, `吹き出しは、だれの顔（目）にも重ならない: ${JSON.stringify(cover)}`);
    assert.deepEqual(await overflowed(page), [], "4人の卓でも、文字が枠からはみ出さない");
    // 顔を押すと、その人の一台（点・票・手札・炭まで）が開く
    await page.locator(t("ichi-seat-2")).click();
    assert.match(await page.locator(`${t("ichi-info-sheet")} h2`).innerText(), /なるの一台/);
    await page.locator(t("ichi-info-close")).click();
    // 自分の番まで自動で進め、相手を1人ねらうカードを使う: だれに使うかを選べる
    await page.evaluate(() => { const h = window.__ichidai; h.autoplay(4); const id = setInterval(() => { const G = h.game; if (G && G.phase === "serve" && G.round >= 1 && G.wait?.player === 0 && G.wait.type === "main") { h.manual(); clearInterval(id); window.__stopped = true; } }, 1); });
    await page.waitForFunction(() => window.__stopped, null, { timeout: 120000 });
    await page.evaluate(() => { const G = window.__ichidai.game, me = G.P[0]; me.hand[0] = "hype"; me.cardsUsed = 0; me.zone = [{ id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 3 }]; window.__ichidai.manual(); });
    // 第0.5版: このラウンドの審査カードは、はじめにめくってある。左上と卓の山の横に出て、「ねらい」の熱にも入る
    const nowJudge = await page.locator(t("ichi-now-judge")).evaluate((n) => ({ dh: n.dataset.dh, text: n.innerText.replace(/\s+/g, "") }));
    assert.match(nowJudge.text, /^今回の審査.+[±+−]\d$/);
    assert.equal(await page.locator(t("ichi-open-puff")).count(), 1, "めくった審査カードが、山の横に表向きで置いてある");
    assert.equal(await page.locator(t("ichi-goal")).getAttribute("data-dh"), nowJudge.dh, "ねらいの熱は、今回の吸い方を入れた数");
    assert.equal(await page.evaluate(() => { const G = window.__ichidai.game; return G.judge.dh === Number(document.querySelector('[data-test="ichi-now-judge"]').dataset.dh) && G.pile.length + G.shown.length === 12; }), true);
    await page.locator(t("ichi-hand-0")).click();
    assert.deepEqual(await page.locator(`${t("ichi-detail")} .ichi-btn.is-primary`).allInnerTexts(), ["スミさん", "なる", "アダム"], "だれに使うかを選ぶボタンが出る");
    await page.locator(t("ichi-do-play-3")).click();
    await page.waitForFunction(() => window.__ichidai.game.P[3].pend === 1, null, { timeout: 8000 });
    assert.deepEqual(await page.evaluate(() => window.__ichidai.game.P.map((p) => p.pend)), [0, 0, 0, 1], "選んだ相手にだけ効く");
    await page.locator(`${t("ichi-seat-3")} .ichi-chip.is-warn`).waitFor();
    // 審査の結果は4人ぶん。最後まで進めると、順位が付く
    await page.locator(t("ichi-end")).click();
    await page.locator(t("ichi-result")).waitFor({ timeout: 60000 });
    assert.equal(await page.locator(`${t("ichi-result")} .ichi-result-row`).count(), 4, "審査の結果は4人ぶん");
    assert.deepEqual(await overflowed(page), [], "4人ぶんの結果でも、文字が枠からはみ出さない");
    await page.evaluate(() => window.__ichidai.autoplay(40));
    const end = page.locator(t("ichi-end-sheet"));
    await end.waitFor({ timeout: 120000 });
    assert.equal(await end.locator(".ichi-end-scores.n-4 > div").count(), 4, "終わりの札に4人の点が順位の順で並ぶ");
    assert.match(await end.getAttribute("data-rank"), /^[1-4]$/);
    const ranks = await end.locator(".ichi-end-scores.n-4 > div b").allInnerTexts();
    assert.deepEqual(ranks.map(Number), ranks.map(Number).slice().sort((x, y) => y - x), "点の高い順");
    assert.match(await end.locator("h2").innerText(), /^(勝ち|引き分け|[234]位)$/);
  }, page1("players=4&kit=a&tournament=open_cloud&level=1&seed=5"));
});
