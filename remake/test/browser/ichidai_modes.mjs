// カードゲーム「一台勝負」（ICG）の遊び方の種類: ガイド（次にすることの案内・炭が自動で弱る・消えるときの印）と、4人対戦（1:1:1:1）。
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
  // ターンのはじめに炭が弱るのは自動で進み、炭が灰になるときはその場所に印が出る
  await check("guide-points-the-next-step-and-cools-by-itself", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    await page.locator(t("ichi-vs")).waitFor();
    await page.locator(t("ichi-vs")).click();
    await page.locator(t("ichi-foe")).waitFor();
    assert.equal(await page.locator(t("ichi-assist")).getAttribute("aria-pressed"), "true", "ガイドは、はじめから入っている");
    // はじめの炭: 「つぎ」に1手が出て、選ぶ札が光り、「ここ」の矢印が付く
    const next = page.locator(t("ichi-next-step"));
    await next.waitFor();
    assert.equal(await next.getAttribute("data-action"), "embers");
    assert.match(await next.innerText(), /手札から3枚えらんで「炭を置く」/);
    // 案内の札は、上から「流れ」（このターンの順番と、いまどこか）・「ねらい」（何を目ざすか）・「つぎ」
    assert.deepEqual([await page.locator(`${t("ichi-steps")} span`).allInnerTexts().then((x) => x.map((y) => y.replace(/\s+/g, ""))), await page.locator(t("ichi-steps")).getAttribute("data-now")], [["1炭にする札を選ぶ", "2"], "0"]); // 名前を出すのは、いまの段だけ（ほかは番号と title）
    assert.deepEqual(await page.locator(`${t("ichi-steps")} span`).evaluateAll((list) => list.map((n) => n.title)), ["炭にする札を選ぶ", "炭を置く"]);
    assert.match(await page.locator(t("ichi-goal")).innerText(), /ねらい[\s\S]*炭3枚[\s\S]*熱は0から/);
    const order = await page.evaluate(() => ["ichi-steps", "ichi-goal", "ichi-next-step"].map((n) => document.querySelector(`[data-test="${n}"]`).getBoundingClientRect().top));
    assert.ok(order[0] < order[1] && order[1] < order[2], "流れ → ねらい → つぎ の順に並ぶ");
    assert.equal(await page.locator(`${t("ichi-hand")} .ichi-hand-card.is-hint`).count(), 3, "選ぶとよい3枚が光る");
    assert.ok(await page.locator(t("ichi-pointer")).count() >= 1, "押す場所に矢印が出る");
    // 光っている札を自分で選ぶと、こんどは「炭を置く」が光る（案内が1手ぶん進む）
    const hinted = await page.locator(`${t("ichi-hand")} .ichi-hand-card.is-hint`).evaluateAll((list) => list.map((n) => n.dataset.test));
    for (const name of hinted) await page.locator(t(name)).click(); // 押すたびに光る札が減るので、先に名前を控えてから押す
    assert.equal(await page.locator(`${t("ichi-embers")}.is-hint`).count(), 1, "選び終えたら、決めるボタンが光る");
    assert.equal(await page.locator(t("ichi-steps")).getAttribute("data-now"), "1", "流れも「炭を置く」へ進む");
    // 準備の最初の自分のターン: ねらいは葉の枚数（ボウルいっぱいまで）。葉の盆の見出しに、選んだ枚数と、ボウルの残りが字で出る
    await page.locator(t("ichi-embers")).click();
    await page.waitForFunction(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.phase === "prep" && g.dataset.turn === "me" && g.dataset.input === "1"; }, null, { timeout: 30000 });
    assert.match(await page.locator(t("ichi-guide")).innerText(), /準備 1\/4/);
    assert.deepEqual(await page.locator(`${t("ichi-steps")} span`).evaluateAll((list) => list.map((n) => n.title)), ["葉を詰める", "炭を置く・足す", "終える"], "準備の流れ: 同じターンに、葉を詰めて、炭にも触れる");
    assert.deepEqual([await page.locator(t("ichi-goal")).getAttribute("data-leaves"), await page.locator(t("ichi-goal")).getAttribute("data-want")], ["0", "16"]);
    assert.match(await page.locator(t("ichi-goal")).innerText(), /葉0\/16枚[\s\S]*ダブルアップル0/);
    assert.match(await page.locator(t("ichi-market-head")).innerText(), /葉を選ぶ：0\/4枚[\s\S]*ボウルは16枚まで（いま0枚）。葉は一口ごとに1枚減る/);
    assert.equal(await page.locator(t("ichi-steam")).count(), 0, "「蒸らす」のボタンは無い（熱は、ターンの終わりにひとりでに上がる）");
    const fit = await page.evaluate(() => { const g = document.querySelector('[data-test="ichi-guide"]').getBoundingClientRect(), m = document.querySelector('[data-test="ichi-market"]').getBoundingClientRect(); return g.bottom <= m.top + 1; });
    assert.equal(fit, true, "案内の札は、葉の盆に隠れない");
    // 葉を選んで「詰める」と、葉の盆が下がり、同じターンのうちに炭の手へ進む（することが無ければ、そのまま相手の番へ）
    const picks = await page.locator(`${t("ichi-market")} .ichi-pile-main.is-hint`).count();
    assert.ok(picks >= 1, "詰めるとよい葉が光る");
    for (let k = 0; k < 4 && !(await page.locator(`${t("ichi-pack")}.is-hint`).count()); k++) await page.locator(`${t("ichi-market")} .ichi-pile-main.is-hint`).first().click();
    const heat0 = await page.evaluate(() => window.__ichidai.game.P[0].heat);
    await page.locator(t("ichi-pack")).click();
    await page.locator(t("ichi-market")).waitFor({ state: "detached" });
    assert.equal(heat0, 0, "熱は0から");
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
    for (const need of ["pack", "end"]) assert.ok(acts.includes(need), `案内に ${need} が出る（${acts.join(",")}）`);
    assert.ok(!acts.includes("steam"), "「蒸らす」という手は無い");
    // 準備の4ターンで、熱は0から上がっている（蒸らし: ターンの終わりに、火力へ1近づく）
    assert.ok(await page.evaluate(() => window.__ichidai.game.P[0].heat) >= 3, "最初の審査までに、熱が上がっている");
    // 提供では、流れが「炭が弱る → 炭を足す・外す → カード1枚 → 終える」、ねらいは熱（いまいくつ・次にいくつ・あといくつ）
    assert.ok(acts.some((x) => ["place", "puton", "charge"].includes(x)), `炭の手も案内に出る（${acts.join(",")}）`);
    const seen = await page.evaluate(() => window.__ichiSeen);
    assert.equal(seen.manualCool, 0, "炭が弱るのは自動で進む（炭を選ばせない）");
    assert.ok(seen.last.some((x) => /炭が弱る：火力\d+→\d+/.test(x)), `どう弱ったかが案内に出る: ${JSON.stringify(seen.last)}`);
    assert.ok(seen.burn.includes("ash:cool"), `炭が灰になるときに、その場所に印が出る: ${JSON.stringify(seen.burn)}`);
    assert.deepEqual(await overflowed(page), [], "案内を出しても、文字が枠からはみ出さない");
    await page.locator(t("ichi-next")).click();
    // ガイドを切ると、案内・光・おすすめのボタンが消える（炭が弱るのは、切っても自動）
    await page.waitForFunction(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.turn === "me" && g.dataset.wait === "main" && document.querySelector(".ichi-sheet").hidden; }, null, { timeout: 30000 });
    await page.locator(t("ichi-next-step")).waitFor();
    assert.deepEqual(await page.locator(`${t("ichi-steps")} span`).evaluateAll((list) => list.map((n) => n.title)), ["炭が弱る", "炭を足す・外す", "カード1枚", "終える"]);
    assert.equal((await page.locator(`${t("ichi-steps")} span`).allInnerTexts()).filter((x) => /[^\s✓\d]/.test(x)).length, 1, "名前が出るのは、いまの段だけ");
    assert.equal(await page.locator(`${t("ichi-steps")} span.is-done`).count() >= 1, true, "炭が弱るは済み");
    const goal = await page.locator(t("ichi-goal")).evaluate((n) => ({ ...n.dataset, text: n.innerText.replace(/\s+/g, "") }));
    assert.match(goal.text, /^ねらい熱\d+★?いま\d+([▲▼]\d+)?・(あと\+\d+|\d+高い|ぴったり)/, `ねらいの熱が出る: ${goal.text}`);
    const mine = await page.evaluate(() => { const p = window.__ichidai.game.P[0], f = p.zone.reduce((a, c) => a + c.f, 0); return { heat: p.heat, fire: f, next: p.heat + Math.sign(Math.min(10, f) - p.heat) }; });
    assert.deepEqual([Number(goal.now), Number(goal.next)], [mine.heat, mine.next], "ねらいの「いま」は熱、矢印の先は、このターンを終えたあとの熱");
    // 熱の向かう先は HUD にも出る（▲上がる・▼下がる・＝そのまま）。火力（炭の火の合計）は別の数
    assert.deepEqual([await page.locator(t("ichi-trend")).getAttribute("data-next"), await page.locator(t("ichi-fire")).getAttribute("data-n"), await page.locator(t("ichi-pillar")).getAttribute("data-heat")], [String(mine.next), String(mine.fire), String(mine.heat)]);
    await page.locator(t("ichi-assist")).click();
    assert.equal(await page.locator(t("ichi-assist")).getAttribute("aria-pressed"), "false");
    assert.deepEqual([await page.locator(t("ichi-next-step")).count(), await page.locator(".is-hint").count(), await page.locator(t("ichi-do-hint")).count(), await page.locator(t("ichi-pointer")).count(),
      await page.locator(t("ichi-steps")).count(), await page.locator(t("ichi-goal")).count()], [0, 0, 0, 0, 0, 0], "ガイドを切ると、案内は出ない");
    await page.locator(t("ichi-end")).click();
    // ガイドを切っても、炭が弱るのは自動で進む（2026-11-13 オーナー「プレイヤーにやらせず自動処理なところは自動でいい」）。
    // 次の自分の番まで待つ。あいだに審査の結果が出たら「次へ」。弱る炭を選ぶ場面は来ない
    const myMain = () => page.evaluate(() => { const g = document.querySelector('[data-test="ichi-game"]'); return g.dataset.turn === "me" && g.dataset.wait === "main" && g.dataset.input === "1" && document.querySelector(".ichi-sheet").hidden; });
    const logs = await page.evaluate(() => window.__ichidai.game.log.length);
    for (let guard = 0; guard < 300 && !(await myMain()); guard++) {
      if (await page.locator(t("ichi-next")).count()) await page.locator(t("ichi-next")).click();
      else await page.waitForTimeout(100);
    }
    assert.ok(await myMain(), "ガイドなしでも、炭が弱ったあとの自分の番まで進む");
    assert.ok(await page.evaluate((n) => window.__ichidai.game.log.slice(n).some((l) => l.who === 0 && l.text.startsWith("炭が弱る：")), logs), "自分の炭が、自動で弱った");
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
    await page.evaluate(() => { const G = window.__ichidai.game, me = G.P[0]; me.hand[0] = "hype"; me.cardsUsed = 0; me.heat = 6; me.zone = [{ id: "cube", up: true, f: 3 }, { id: "cube", up: true, f: 2 }, { id: "flat", up: true, f: 1 }]; me.stove = [{ id: "flat", stage: 0 }, { id: "cube", stage: 1 }, { id: "flat", stage: 2 }];
      for (const i of [1, 2, 3]) G.P[i].zone = [{ id: "cube", up: true, f: 3 }, { id: "flat", up: true, f: 1 }, { id: "read", up: false, f: 1 }]; window.__ichidai.manual(); });
    // 炭の焼け具合（2026-11-13 オーナー「炭が焼けても色変わらないの気になる」）: 札の上に、いまの状態の炭の絵が重なる。
    // 自分の火力ゾーン（新品＝hot・弱った＝warm・火1＝ember）・炭焼き場（置いたばかり＝cold・火がまわる＝warm・焼けた＝hot）・相手の小さな札。
    // 絵は札に収まる大きさ（相手の小さな札で、絵が元の大きさのまま出て卓を覆ったことがある）
    await page.waitForFunction(() => { const list = [...document.querySelectorAll(".ichi-coal-sprite")]; return list.length >= 12 && list.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000 });
    const sprites = await page.locator(".ichi-coal-sprite").evaluateAll((list) => list.map((n) => {
      const b = n.getBoundingClientRect(), box = n.parentElement.getBoundingClientRect(), k = document.querySelector("#stage").getBoundingClientRect().width / 1280;
      return { state: [...n.classList].find((c) => c.startsWith("is-")).slice(3), file: n.getAttribute("src").split("/").pop().split("?")[0], w: Math.round(b.width / k), fits: b.width <= box.width + 2,
        where: n.closest(".ichi-stove-coal") ? "stove" : n.closest('[data-test="ichi-zone"]') ? "zone" : "rival" };
    }));
    const of = (where) => sprites.filter((x) => x.where === where).map((x) => `${x.state}:${x.file}`);
    assert.deepEqual(of("zone"), ["hot:coal_just.webp", "warm:coal_red.webp", "ember:coal_flat_white.webp"], "火力ゾーン: 新品のキューブ炭・弱ったキューブ炭・火1のフラット炭");
    assert.deepEqual(of("stove"), ["cold:coal_flat_cold.webp", "warm:coal_red.webp", "hot:coal_flat_just.webp"], "炭焼き場: 置いたばかり・火がまわる・焼けた");
    assert.equal(of("rival").length, 6, "相手3人の表向きの炭（2つずつ）にも絵が重なる。種火は札の裏のまま");
    assert.ok(sprites.every((x) => x.fits && x.w >= 16 && x.w <= 64), `炭の絵は札に収まる大きさ: ${JSON.stringify(sprites.map((x) => `${x.where}:${x.w}`))}`);
    // 第0.5版: このラウンドの審査カードは、はじめにめくってある。左上と卓の山の横に出て、「ねらい」の熱にも入る
    const nowJudge = await page.locator(t("ichi-now-judge")).evaluate((n) => ({ dh: n.dataset.dh, text: n.innerText.replace(/\s+/g, "") }));
    assert.match(nowJudge.text, /^.+吸う[±+−]\d$|^温度を測る[±+−]\d$/, "吸い方と、熱の変化だけ（見出しは出さない）");
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

  // 入門の一局（第0.7版。2026-11-13 オーナー「入門モードも作りつつ」）: 設定の画面の「基本」の棚の先頭から始める。
  // 一台は詰めてあり、炭も置いてあり、熱3まで温まっている。準備は炭を焼く2ターンだけ、提供は6ラウンド。一票・印象・決め手は出ない。
  // 案内の「つぎ」の下に「なぜ」が付き、遊び方は3ページ。終わると「基本の一式へ」
  await check("intro-match-is-short-and-teaches-coals-only", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    await page.locator(t("ichi-intro-start")).click();
    await page.waitForFunction(() => document.querySelector('[data-test="ichi-game"]')?.dataset.input === "1", null, { timeout: 30000 });
    assert.deepEqual([await data(page, "phase"), await data(page, "wait"), await data(page, "turn")], ["prep", "prep", "me"], "葉を詰めるところと、はじめの炭を選ぶところは無く、炭を焼くところから");
    const info = await page.evaluate(() => { const G = window.__ichidai.game, me = G.P[0]; return { rounds: G.tour.sessions * 3, bowl: me.bowl, zone: me.zone.length, heat: me.heat, kits: G.P.map((p) => p.kit), level: G.P[1].level, prep: G.R.prepTurns }; });
    assert.deepEqual(info, { rounds: 6, bowl: { blueberry: 8, ice_grape: 4 }, zone: 3, heat: 3, kits: ["s0", "s0"], level: 0, prep: 2 });
    assert.equal(await page.locator(t("ichi-market")).count(), 0, "葉の盆は出ない（詰めてある）");
    assert.match(await page.locator(t("ichi-phase")).innerText(), /準備 1\/2/);
    assert.match(await page.locator(".ichi-guide").innerText(), /準備 1\/2：炭を焼いて、熱を上げる/);
    // 「つぎ」の下に「なぜ」
    const why = page.locator(t("ichi-next-why"));
    assert.ok((await why.innerText()).length > 10, "手の理由が1行付く");
    assert.deepEqual(await overflowed(page), [], "入門の画面で、文字が枠からはみ出していない");
    // 遊び方は3ページだけ
    await page.locator(t("ichi-help")).click();
    assert.match(await page.locator(`${t("ichi-help-sheet")} header`).innerText(), /遊び方 1\/3[\s\S]*勝ち方/);
    await page.locator(t("ichi-help-close")).click();
    // 「おすすめで進める」だけで、提供の最初の自分のターンまで進める
    for (let n = 0; n < 60 && !(await data(page, "phase") === "serve" && await data(page, "wait") === "main" && await data(page, "turn") === "me"); n++) {
      if (await data(page, "turn") === "me" && await page.locator(`${t("ichi-do-hint")}:not([disabled])`).count()) await page.locator(t("ichi-do-hint")).click();
      else await page.waitForTimeout(150);
    }
    assert.deepEqual([await data(page, "phase"), await data(page, "wait"), await data(page, "turn")], ["serve", "main", "me"]);
    // 一票・印象・決め手は出ない。炭の灯（足す・外す）は出る
    assert.deepEqual([await page.locator(t("ichi-impression")).count(), await page.locator(".ichi-leader-votes").count(), await page.locator('[data-test^="ichi-chase-"]').count()], [0, 0, 0]);
    assert.equal(await page.locator(t("ichi-coal-left")).count(), 1);
    assert.equal(await page.locator(t("ichi-standing")).count(), 1, "点差は出る");
    // 最後まで: 6ラウンドで終わり、次の一歩を案内する
    await page.evaluate(() => window.__ichidai.autoplay(40));
    const end = page.locator(t("ichi-end-sheet"));
    await end.waitFor({ timeout: 90000 });
    assert.deepEqual(await page.evaluate(() => { const G = window.__ichidai.game; return [G.round, G.result.votes, G.result.bonus.length]; }), [5, [0, 0], 0]);
    assert.match(await page.locator(t("ichi-end-next")).innerText(), /基本の一式/);
    assert.doesNotMatch(await end.locator(".ichi-end-scores").innerText(), /票/, "点の欄に、票の数は出ない");
    await page.locator(t("ichi-again")).click();
    assert.deepEqual([await page.locator(t("ichi-tier-basic")).getAttribute("aria-pressed"), await page.locator(t("ichi-kit-s1")).getAttribute("aria-pressed")], ["true", "true"], "入門のあとは、基本の一式の1つ目が選ばれている");
  }, page1("seed=11&speed=6"));
});
