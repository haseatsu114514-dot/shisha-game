// TRPGを横持ちで読む・押す（#3199・2026-11-20 の再実測）。本編と同じ画面当て（core/stage-fit.js）で、
// スマホ横持ち 844×390・Safari のバーが出た 844×340・PC 1280×720 に残っていた
// 「読めない（実寸 11px 未満）・押せない（39px 未満）・下へ送らないと見えない」所の回帰検査。
// 試遊ページ（trpg-preview.html）と本編（index.html）の使い捨ての状態だけを使い、プレイヤーの保存は開かない。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, baseURL } from "./support.mjs";

const PHONE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" };
const LOW = { width: 844, height: 340 }; // Safari のバーが出た横持ち
const PC = { viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" };
const MIN_TEXT = 10.95, MIN_TAP = 38.5; // 規格（css/phone-density.css）: 補足 11.5px・押す所 39px（実寸）
const preview = query => ({ pageEntry: new URL("trpg-preview.html?" + query, baseURL).href, pageReadySelector: '[data-test="trpg-start"]' });
const catalog = JSON.parse(fs.readFileSync(new URL("../../../data/trpg_catalog.json", import.meta.url), "utf8"));
const book = id => JSON.parse(fs.readFileSync(new URL("../../../data/" + catalog.scenarios.find(s => s.id === id).file, import.meta.url), "utf8"));

const control = (page, id) => page.locator(`[data-test="${id}"]`);
async function hit(page, target) {
  const locator = typeof target === "string" ? control(page, target) : target;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap(); else await locator.click();
}
async function lines(page) {
  for (let n = 0; n < 80 && await control(page, "trpg-next").isVisible(); n++) await hit(page, "trpg-next");
}
async function declare(page) {
  const card = page.locator("button.trpg-approach").first();
  if (await card.count() && await card.isVisible()) { await hit(page, card); await lines(page); }
}
async function rollAndSettle(page) {
  await declare(page); await hit(page, "trpg-roll"); await control(page, "trpg-settle").waitFor(); await hit(page, "trpg-settle"); await lines(page);
}
const phase = page => page.evaluate(() => window.__trpg.snapshot().phase);
async function toExplore(page) {
  await hit(page, "trpg-start"); await lines(page); await rollAndSettle(page);
  for (let n = 0; n < 2; n++) {
    const topic = page.locator('[data-test^="trpg-topic-"]:not([disabled]):not(.selected)').first();
    if (!await topic.count()) break;
    await hit(page, topic); await lines(page);
  }
  if (await control(page, "trpg-interview-done").count()) await hit(page, "trpg-interview-done");
  await page.waitForFunction(() => window.__trpg.snapshot().phase === "explore");
}
async function toPrepareRoll(page, id) {
  const story = book(id);
  await toExplore(page);
  for (const spot of story.spots.slice(0, 3)) { await hit(page, "trpg-spot-" + spot.id); await lines(page); }
  await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-" + story.hypotheses[0].id); await lines(page);
  const tactic = page.locator('[data-test^="trpg-plan-tactic-"]').first();
  if (await tactic.count()) { await hit(page, tactic); await hit(page, "trpg-twist-open"); await rollAndSettle(page); }
  for (const field of story.flow?.prepare || ["aroma", "seat"]) await hit(page, "trpg-plan-" + field + "-" + story.options[field][0].id);
  await hit(page, "trpg-prepare-open"); await declare(page);
  await control(page, "trpg-roll").waitFor();
}
async function resize(page, size) {
  await page.setViewportSize(size);
  // 画面当て（--k と data-density）が新しい大きさに追いつくまで待つ
  await page.waitForFunction(({ width, height }) => {
    const k = Math.min(width / 1280, height / 720), stage = document.getElementById("stage");
    return innerWidth === width && innerHeight === height && Math.abs(Number(stage.style.getPropertyValue("--k")) - k) < 1e-6;
  }, size);
}

/** scope の中で見えている文字の実寸（px）と、押せるボタンの実寸。 */
async function measure(page, scope) {
  return page.evaluate(scope => {
    const root = document.querySelector(scope);
    if (!root) return null;
    const k = Number(document.getElementById("stage").style.getPropertyValue("--k")) || 1;
    const visible = n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && n.getClientRects().length > 0;
    const texts = [], taps = [];
    for (const n of root.querySelectorAll("*")) {
      if (n instanceof SVGElement || !visible(n)) continue;
      const own = [...n.childNodes].filter(c => c.nodeType === Node.TEXT_NODE).map(c => c.textContent.trim()).join("");
      if (own) {
        const r = n.getBoundingClientRect(), scale = n.offsetWidth > 4 ? r.width / n.offsetWidth : k;
        texts.push({ text: own.slice(0, 30), px: Math.round(parseFloat(getComputedStyle(n).fontSize) * scale * 10) / 10 });
      }
      if (n.matches("button:not(:disabled)")) {
        const r = n.getBoundingClientRect();
        taps.push({ text: n.textContent.trim().slice(0, 30), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
      }
    }
    return { texts, taps };
  }, scope);
}
async function assertReadable(page, scope, label, { taps = true } = {}) {
  const found = await measure(page, scope);
  assert(found?.texts.length, `${label}: nothing to read in ${scope}`);
  assert.deepEqual(found.texts.filter(t => t.px < MIN_TEXT), [], `${label}: text below 11px on screen`);
  if (taps) assert.deepEqual(found.taps.filter(t => t.h < MIN_TAP || t.w < MIN_TAP), [], `${label}: tap targets below 39px`);
  return found;
}

await suite("trpg-reading", async check => {
  // 試遊の部活提案は、背の低い横画面で2つ目の返事が画面下へ押し出されていた。
  const campaignProposal = {
    pageEntry: new URL("trpg-campaign-preview.html?harness=1", baseURL).href,
    pageReadySelector: '[data-test="trpg-club-proposal"]',
  };
  async function assertProposalChoicesFit(page, label) {
    await page.evaluate(() => document.fonts.ready);
    const choices = await control(page, "trpg-club-proposal").locator("button").evaluateAll(buttons => {
      const stage = document.getElementById("stage").getBoundingClientRect();
      return buttons.map(button => {
        const rect = button.getBoundingClientRect();
        const center = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          test: button.dataset.test,
          w: rect.width, h: rect.height,
          inside: rect.left >= stage.left && rect.right <= stage.right &&
            rect.top >= stage.top && rect.bottom <= stage.bottom,
          reachable: button.contains(center),
        };
      });
    });
    assert.equal(choices.length, 2);
    assert.deepEqual(choices.filter(b => !b.inside || !b.reachable || b.w < 39 || b.h < 39), [],
      `${label}: both responses must fit and be at least 39px without scrolling`);
  }
  await check("club-proposal-phone", async page => {
    await assertProposalChoicesFit(page, "844x390");
    await resize(page, LOW);
    await assertProposalChoicesFit(page, "844x340");
    await hit(page, "trpg-club-choice-people");
    await control(page, "trpg-club-founded").waitFor();
  }, { ...PHONE, ...campaignProposal });
  await check("club-proposal-pc", async page => {
    await assertProposalChoicesFit(page, "1280x720");
    await hit(page, "trpg-club-choice-time");
    await control(page, "trpg-club-founded").waitFor();
  }, { ...PC, ...campaignProposal });

  // 本棚（過去プレイを再生）と店の「？」: 紙の本文が実寸 8〜9px、「閉じる」「次へ」などの札が 26〜29px だった。
  await check("bookshelf-and-shop-help-phone", async page => {
    const record = { play: 1, chapter: 2, day: 2, title: "世界一普通の一台", ending: "雨音のある一台", endingLine: "普通とは、何も求められずに過ごせる時間だった。",
      participants: ["はじめ", "ひより", "アダム", "つむぎ"], choices: ["質問：好きな飲み物", "調べた場所：手書きのメニュー", "見立て：静かな一台", "香り：紅茶"],
      rolls: ["旅人の言葉を待つ · 様子を見る · 12 ＋ 7 ＋ 補正4 ＝ 23 · ひと手間かかる", "選んだ香りを、一台にする · 14 ＋ 12 ＋ 補正6 ＝ 32 · うまくいった"],
      lines: [["六角サイ · ゲームマスター", "雨はまだ止まない。"], ["はじめ · フィン", "どうぞ、普通の一台です。"]],
      stages: [["聞き込み", 0, 0, 0], ["質問", 0, 1, -1], ["調査", 1, 2, -1], ["見立て", 2, 3, -1], ["一台を用意する", 3, 4, 1]] };
    await page.evaluate(async record => {
      const core = await import("./js/core/state.js"), s = core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 3, slot: 1, money: 3000, stamina: 52 });
      for (const id of ["hiyori", "samechan", "tsumugi", "adam"]) { s.met[id] = true; s.affinity[id] = 66; s.flags[`_trpg_topic_${id}`] = true; }
      s.trpg.club = { founded: { chapter: 2, day: 1 }, members: Object.fromEntries(["hiyori", "samechan", "tsumugi", "adam"].map(id => [id, { chapter: 2, day: 2 }])) };
      Object.assign(s.flags, { _kuraudo_trpg_introduced: true, _intro_sai: true, _trpg_tutorial_seen: true });
      s.trpg.stock = ["ordinary-cup"]; s.trpg.owned = ["ordinary-cup"];
      s.trpg.cleared["ordinary-cup"] = { chapter: 2, day: 2, gm: "hiyori", participants: ["hajime", "hiyori", "adam", "tsumugi"], ending: "quiet",
        endingTitle: "雨音のある一台", variant: "smooth", plan: {}, version: 1, stars: 3, heat: 9, night: "盛り上がった夜", endingsSeen: ["quiet"], plays: 1, records: [record] };
      core.config.textSpeed = 4; core.config.bgmVolume = 0; core.saveConfig();
      (await import("./js/daily/trpg.js")).openTrpgBar({ nightBusy: () => false });
    }, record);
    await control(page, "trpg-bookshelf-open").waitFor({ timeout: 30000 });
    for (const size of [PHONE.viewport, LOW]) {
      await resize(page, size);
      const label = `${size.width}x${size.height}`;
      await assertReadable(page, '[data-test="trpg-bookshelf-open"]', label + " shelf button", { taps: false });
      await hit(page, "trpg-campaign-help");
      await assertReadable(page, ".trpg-shelf-help", label + " shop help");
      await hit(page, "trpg-campaign-help-close");
      await hit(page, "trpg-bookshelf-open");
      await assertReadable(page, ".trpg-shelf-help", label + " bookshelf list");
      await hit(page, "trpg-shelf-run-ordinary-cup-1");
      await assertReadable(page, ".trpg-shelf-help", label + " replay scene");
      for (let n = 0; n < 6 && await control(page, "trpg-replay-next").isEnabled(); n++) await hit(page, "trpg-replay-next");
      await assertReadable(page, ".trpg-shelf-help", label + " replay ending");
      await hit(page, "trpg-bookshelf-close");
      assert.equal(await page.locator(".trpg-shelf-help").count(), 0);
    }
  }, PHONE);

  // 探索: 危機（アンコール・霧晴れ）の数が実寸 7px。上の札は 820px 固定で、長い題の物語では文字が札の外へはみ出した。
  // 調べる場所の名札は、長いと札の外へはみ出し、画面の端の印（肖像画・回廊）では画面の外へ切れた。シートの役の名前も 844×340 で 10.4px。
  for (const id of ["moonflower-encore", "mist-kingdom"]) await check("explore-readable-phone-" + id, async page => {
    await toExplore(page);
    for (const size of [PHONE.viewport, LOW]) {
      await resize(page, size);
      const label = `${id} ${size.width}x${size.height}`;
      const cue = await page.locator(".trpg-stage-cue").evaluate(cue => {
        const r = cue.getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
        const risk = cue.querySelector(".trpg-stage-risk");
        return { overflow: cue.scrollWidth - cue.clientWidth,
          outside: [...cue.children].filter(n => n.checkVisibility()).filter(n => { const b = n.getBoundingClientRect();
            return b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1; }).map(n => n.textContent),
          inStage: r.left >= stage.left - 1 && r.right <= stage.right + 1,
          risk: risk && parseFloat(getComputedStyle(risk).fontSize) * risk.getBoundingClientRect().width / risk.offsetWidth };
      });
      assert(cue.risk >= MIN_TEXT, `${label}: the pressure count is readable ${JSON.stringify(cue)}`);
      assert(cue.overflow <= 1 && !cue.outside.length && cue.inStage, `${label}: the scene line stays inside its plate ${JSON.stringify(cue)}`);
      await assertReadable(page, ".trpg-stage-cue", label + " scene line", { taps: false });
      const labels = await page.locator(".trpg-room.interactive .trpg-spot > span").evaluateAll(nodes => {
        const stage = document.getElementById("stage").getBoundingClientRect();
        return nodes.filter(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).map(n => { const r = n.getBoundingClientRect();
          return { text: n.textContent, over: n.scrollWidth - n.clientWidth, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 }; });
      });
      assert.equal(labels.length, book(id).spots.length, `${label}: every place to look at is named on touch`);
      assert.deepEqual(labels.filter(l => l.over > 1 || !l.inside), [], `${label}: spot names fit their plates and the screen`);
      await hit(page, "trpg-sheets");
      await assertReadable(page, ".trpg-sheet-grid", label + " character sheets", { taps: false });
      await hit(page, "trpg-sheets-close");
    }
  }, { ...PHONE, ...preview(`scenario=${id}&seed=9`) });
  // PC は名札をポインタを乗せた時に出す。画面の端の印でも、名札は画面の中に収まる。
  for (const [id, spot] of [["mist-kingdom", "corridor"], ["moonflower-encore", "portrait"]]) await check("edge-spot-name-pc-" + id, async page => {
    await toExplore(page);
    await page.waitForTimeout(400);
    await control(page, "trpg-spot-" + spot).hover();
    await page.waitForFunction(id => Number(getComputedStyle(document.querySelector(`[data-test="trpg-spot-${id}"] > span`)).opacity) > .95, spot);
    const name = await page.locator(`[data-test="trpg-spot-${spot}"] > span`).evaluate(n => {
      const r = n.getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect();
      return { text: n.textContent, over: n.scrollWidth - n.clientWidth, left: r.left, right: r.right, stage: [stage.left, stage.right] };
    });
    assert(name.left >= name.stage[0] - 1 && name.right <= name.stage[1] + 1 && name.over <= 1, `${id}: the name of an edge spot stays on screen ${JSON.stringify(name)}`);
  }, { ...PC, ...preview(`scenario=${id}&seed=9`) });

  // チュートリアルの図: 図の下の説明と GM・PL の札が実寸 8〜9px だった。図は台詞の窓に重ならない。
  for (const size of [PHONE.viewport, LOW]) await check(`tutorial-diagrams-${size.width}x${size.height}`, async page => {
    const seen = new Set();
    for (let n = 0; n < 60 && await control(page, "trpg-next").isVisible(); n++) {
      const kind = await page.locator(".trpg-tutorial-panel").getAttribute("data-panel").catch(() => null);
      if (kind && !seen.has(kind)) {
        seen.add(kind);
        await assertReadable(page, ".trpg-tutorial-panel", `tutorial ${kind}`, { taps: false });
        const gap = await page.evaluate(() => document.querySelector(".trpg-speech").getBoundingClientRect().top - document.querySelector(".trpg-tutorial-panel").getBoundingClientRect().bottom);
        assert(gap >= 0, `tutorial ${kind}: the diagram stays above the dialogue (${gap})`);
      }
      await hit(page, "trpg-next");
    }
    for (const kind of ["table", "declare", "roll", "aid", "fail"]) assert(seen.has(kind), `tutorial shows the ${kind} diagram`);
  }, { ...PHONE, viewport: size, ...preview("scenario=ordinary-cup&seed=9&tutorial=1"), pageReadySelector: '[data-test="trpg-tutorial-panel"]' });

  // 判定の卓「判定の詳細」: PC では見通しの表がトレイと切り札の札の下に積まれ、卓の中を下へ送らないと見えなかった。
  async function assertDetailsFit(page, label) {
    if (!await control(page, "trpg-roll-details").evaluate(n => n.open)) await hit(page, "trpg-details-toggle");
    await control(page, "trpg-forecast").waitFor();
    const layout = await page.locator(".trpg-roll-stage").evaluate(box => {
      const body = box.querySelector(".trpg-modal-body"), b = body.getBoundingClientRect();
      const cells = [...box.querySelectorAll(".trpg-odds > div")].map(cell => {
        const r = cell.getBoundingClientRect(), number = cell.querySelector("strong"), size = parseFloat(getComputedStyle(number).fontSize);
        return { text: cell.textContent, inside: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1,
          lines: number.getBoundingClientRect().height / (size * number.getBoundingClientRect().width / number.offsetWidth) };
      });
      return { scroll: body.scrollHeight - body.clientHeight, cells };
    });
    assert(layout.scroll <= 1, `${label}: the roll details fit without scrolling ${JSON.stringify(layout)}`);
    assert.equal(layout.cells.length, 3);
    assert(layout.cells.every(cell => cell.inside && cell.lines < 1.8), `${label}: all three odds are visible on one line ${JSON.stringify(layout)}`);
  }
  await check("roll-details-pc", async page => {
    await hit(page, "trpg-start"); await lines(page); await declare(page);
    await assertDetailsFit(page, "listen");
    await hit(page, "trpg-details-toggle");
    await hit(page, "trpg-roll"); await control(page, "trpg-settle").waitFor(); await hit(page, "trpg-settle"); await lines(page);
    for (let n = 0; n < 2; n++) {
      const topic = page.locator('[data-test^="trpg-topic-"]:not([disabled]):not(.selected)').first();
      if (!await topic.count()) break;
      await hit(page, topic); await lines(page);
    }
    if (await control(page, "trpg-interview-done").count()) await hit(page, "trpg-interview-done");
    const story = book("ordinary-cup");
    for (const spot of story.spots.slice(0, 3)) { await hit(page, "trpg-spot-" + spot.id); await lines(page); }
    await hit(page, "trpg-interpret"); await hit(page, "trpg-hypothesis-" + story.hypotheses[0].id); await lines(page);
    const tactic = page.locator('[data-test^="trpg-plan-tactic-"]').first();
    if (await tactic.count()) { await hit(page, tactic); await hit(page, "trpg-twist-open"); await rollAndSettle(page); }
    for (const field of story.flow?.prepare || ["aroma", "seat"]) await hit(page, "trpg-plan-" + field + "-" + story.options[field][0].id);
    await hit(page, "trpg-prepare-open"); await declare(page); await control(page, "trpg-roll").waitFor();
    assert.equal(await page.locator(".trpg-roll-stage .trpg-aid").count(), 1, "the preparation check offers a companion's card");
    await assertDetailsFit(page, "prepare with a companion card");
  }, { ...PC, ...preview("scenario=ordinary-cup&seed=9") });
  // スマホの低い画面: 見立ての加点がまだ分からない判定は見込みが「約29〜48%」の幅になり、数字が2行に折れて表が切れていた。
  // 同じ卓を結末まで進め、結末の評価の名前と一文も読める大きさか確かめる。
  await check("roll-details-and-ending-low-phone", async page => {
    await toPrepareRoll(page, "shark-last-order");
    assert.match(await control(page, "trpg-odds-success").textContent(), /〜/, "this seed's preparation check shows a range");
    await assertDetailsFit(page, "shark prepare 844x340");
    await hit(page, "trpg-details-toggle");
    await hit(page, "trpg-roll"); await control(page, "trpg-settle").waitFor(); await hit(page, "trpg-settle"); await lines(page);
    const story = book("shark-last-order");
    for (const field of story.flow?.serve || ["approach"]) await hit(page, "trpg-plan-" + field + "-" + story.options[field][0].id);
    await hit(page, "trpg-serve-open"); await rollAndSettle(page);
    await control(page, "trpg-ending-title").waitFor();
    assert.equal(await phase(page), "ending");
    await assertReadable(page, ".trpg-ending", "ending 844x340", { taps: false });
  }, { ...PHONE, viewport: LOW, ...preview("scenario=shark-last-order&seed=11") });

  // キャラ作り「能力を自分で振る」: スマホでは4つ目の能力が箱の下に切れて、中を送らないと押せなかった。
  // 「残り N 点」は深緑の箱の時の淡い色のままで、紙の上では読めなかった（PC も同じ）。
  async function assertBuilder(page, label, { phone }) {
    const layout = await page.locator(".trpg-builder-stage").evaluate(box => {
      const body = box.querySelector(".trpg-modal-body"), r = body.getBoundingClientRect();
      return { scroll: body.scrollHeight - body.clientHeight,
        buttons: [...box.querySelectorAll('.trpg-builder-stat-rows .trpg-button')].map(n => { const b = n.getBoundingClientRect();
          return { test: n.dataset.test, inside: b.top >= r.top - 1 && b.bottom <= r.bottom + 1, h: b.height, w: b.width }; }) };
    });
    assert(layout.scroll <= 1, `${label}: the four abilities fit without scrolling ${JSON.stringify(layout)}`);
    assert.equal(layout.buttons.length, 8);
    assert.deepEqual(layout.buttons.filter(b => !b.inside), [], `${label}: every − / ＋ is on screen`);
    if (phone) assert.deepEqual(layout.buttons.filter(b => b.h < MIN_TAP || b.w < MIN_TAP), [], `${label}: − / ＋ keep a 39px target`);
    const contrast = await control(page, "trpg-stat-points").evaluate(points => {
      const rgb = text => [...text.matchAll(/rgba?\(([^)]+)\)/g)].map(m => m[1].split(",").slice(0, 3).map(Number));
      const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
        .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const ink = lum(rgb(getComputedStyle(points.querySelector("strong")).color)[0]);
      const paper = rgb(getComputedStyle(points.closest("section")).backgroundImage).map(lum);
      return Math.min(...paper.map(p => (Math.max(p, ink) + .05) / (Math.min(p, ink) + .05)));
    });
    assert(contrast >= 4.5, `${label}: the points left read on the paper (contrast ${contrast.toFixed(2)})`);
  }
  await check("builder-advanced-phone", async page => {
    await hit(page, "trpg-build"); await hit(page, "trpg-builder-advanced");
    for (const size of [PHONE.viewport, LOW]) {
      await resize(page, size);
      await assertBuilder(page, `${size.width}x${size.height} 0 left`, { phone: true });
      await hit(page, page.locator('.trpg-builder-stat-rows [data-test$="-down"]:not([disabled])').first());
      await assertBuilder(page, `${size.width}x${size.height} 1 left`, { phone: true });
      await hit(page, page.locator('.trpg-builder-stat-rows [data-test$="-up"]:not([disabled])').first());
    }
  }, { ...PHONE, ...preview("scenario=ordinary-cup&seed=9") });
  await check("builder-advanced-pc", async page => {
    await hit(page, "trpg-build"); await hit(page, "trpg-builder-advanced");
    await assertBuilder(page, "pc 0 left", { phone: false });
    await hit(page, page.locator('.trpg-builder-stat-rows [data-test$="-down"]:not([disabled])').first());
    await assertBuilder(page, "pc 1 left", { phone: false });
  }, { ...PC, ...preview("scenario=ordinary-cup&seed=9") });
});
