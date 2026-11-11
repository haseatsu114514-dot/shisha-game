// 見た目の様式「新版」（neo・LK02）の会話画面の検査。
//   1. 1280×720 と横持ちスマホ（844×390 タッチ）で、本文が2行（本心つきは1行＋1行）収まり、
//      本文・名前・操作の札・選択肢が重ならずステージ内にあり、操作と選択肢が実際に押せる。
//   2. 設定から 現行→新版→現行 と切り替えると、足した要素・クラス・style が残らず、
//      会話の部品の計算済みスタイルが最初から現行だった時と一致する。
//   3. 「揺れ・閃光を減らす」と端末の「動きを減らす」で、立ち絵の呼吸が止まる。
//   4. 配色テーマ7種のどれでも、会話の帯・名前・操作・選択肢が同じ見た目になる。
//   5. MENU のタブが絵文字ではなく線画の絵記号になり、現行へ戻すと絵文字に戻る。
//   6. css/look-neo.css の全規則が :root[data-look="neo"] の中にある（現行の見た目に触れない）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, baseURL } from "./support.mjs";

const NEO = `${baseURL}?look=neo`;
const BG = "res://assets/backgrounds/bg_tonari_inside_night.png";
const THEMES = ["paper", "smoke", "smoke-purple", "cut-paper", "amber", "tissue", "classic"];
const LONG = "あーっ！ はじめくんっ！ おかえりなさーいっ♡ 今日もみんとに会いに来てくれたの？";
const CHOICE_26 = "全角二十六文字ちょうどの長い選択肢も一行に収まるかな";
assert.equal([...CHOICE_26].length, 26, "選択肢の上限（GUI22: 全角26字）で確かめる");

// 6. 新版のスタイルシートは、様式が neo の時にしか効かない書き方だけを許す。
{
  const css = fs.readFileSync(new URL("../../css/look-neo.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = (text) => {
    const found = [];
    let depth = 0, start = 0, prelude = "";
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "{") { if (depth++ === 0) { prelude = text.slice(start, i).trim(); start = i + 1; } }
      else if (text[i] === "}" && --depth === 0) { found.push([prelude, text.slice(start, i)]); start = i + 1; }
    }
    return found;
  };
  const selectors = (prelude) => prelude.split(/,(?![^()]*\))/).map((part) => part.trim()).filter(Boolean);
  let count = 0;
  const walk = (text) => {
    for (const [prelude, body] of blocks(text)) {
      if (prelude.startsWith("@keyframes")) assert.match(prelude, /^@keyframes neo-/, `動きの名前は neo- で始める: ${prelude}`);
      else if (prelude.startsWith("@media")) walk(body);
      else {
        assert(!prelude.startsWith("@"), `想定外の @ 規則: ${prelude}`);
        for (const selector of selectors(prelude)) {
          count++;
          assert(selector.startsWith(':root[data-look="neo"]'), `:root[data-look="neo"] で始まらない規則: ${selector}`);
        }
      }
    }
  };
  walk(css);
  assert(count > 50, "look-neo.css の規則を読めている");
  assert(!/!important/.test(css), "look-neo.css は !important に頼らない");
}

const SCRIPT = {
  dialogue_id: "__look_neo",
  lines: [
    { speaker: "minto", face: "normal", text: LONG },
    { speaker: "hiyori", portrait: false, text: "……また見つかっちゃった", inner: "よし、今のはかなり儚い。決まった" },
    { speaker: "", text: "店の奥で、炭のはぜる小さな音がした。" },
    { speaker: "tsumugi", face: "normal", text: "……これ、応募してもいいですか。" },
    { speaker: "minto", face: "smile", text: "みんとのチャームポイント、教えてあげよっか？" },
    { type: "choice", id: "pick", choices: [
      { text: "チャームポイント？", next: "ask" },
      { text: "（話の展開が早い……！）", next: "fast" },
      { text: CHOICE_26, next: "fast" },
    ] },
  ],
  branches: {
    ask: [{ speaker: "minto", face: "smile", text: "えへへ、それはね……ひみつっ♡" }],
    fast: [{ speaker: "minto", face: "smile", text: "あれっ、はじめくん、置いてけぼり？" }],
  },
};

/** 第1章の状態で会話を始め、最初の行が出そろうまで待つ。 */
async function start(page, script = SCRIPT) {
  await page.evaluate(async ({ script, bg }) => {
    const core = await import("./js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { phase: "daily", chapter: 1, day: 6, slot: 1 });
    for (const id of ["minto", "tsumugi", "sumi", "hiyori"]) state.met[id] = true;
    core.config.textSpeed = 4;
    (await import("./js/core/look.js")).refreshLook();
    (await import("./js/core/ui.js")).clearScreen();
    const vn = await import("./js/vn/engine.js");
    window.lookNeoRun = vn.play(script, { bg });
  }, { script, bg: BG });
  await page.locator("#vn.active .vn-next.show").waitFor();
}

// タッチ端末の検査では、マウスのクリックではなくタップで押す。
const touchPages = new WeakSet();
const press = (page, locator) => (touchPages.has(page) ? locator.tap() : locator.click());

/** 本文をタップして次の行へ送り、その行が出そろうまで待つ。 */
async function advance(page, expected) {
  await press(page, page.locator(".vn-text"));
  await page.waitForFunction((text) => document.querySelector(".vn-text")?.textContent.replace(/\s/g, "").includes(text)
    && document.querySelector(".vn-next.show"), expected.replace(/\s/g, ""));
}

/** 立ち絵の登場・名前札・光の移動が落ち着くまで待つ（transition は最長 0.35 秒）。 */
const settle = (page) => page.waitForTimeout(600);

/** 画面の部品をステージ上の px で測る。 */
const measure = (page) => page.evaluate(() => {
  const stageEl = document.getElementById("stage");
  const stage = stageEl.getBoundingClientRect();
  const k = stage.width / stageEl.offsetWidth;
  const px = (r) => ({ left: (r.left - stage.left) / k, top: (r.top - stage.top) / k, right: (r.right - stage.left) / k,
    bottom: (r.bottom - stage.top) / k, width: r.width / k, height: r.height / k });
  const rows = (node) => {
    if (!node || node.hidden || !node.textContent) return [];
    const range = document.createRange(); range.selectNodeContents(node);
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(px);
  };
  const box = document.querySelector(".vn-box"), text = document.querySelector(".vn-text"), inner = document.querySelector(".vn-inner");
  const name = document.querySelector(".vn-name"), choices = document.querySelector(".vn-choices");
  const type = getComputedStyle(text);
  const lineHeight = parseFloat(type.lineHeight);
  const color = type.color.match(/[\d.]+/g).slice(0, 3).map(Number);
  const vn = document.getElementById("vn");
  return {
    k, look: document.documentElement.dataset.look,
    stage: { scrollable: stageEl.scrollHeight > stageEl.clientHeight || stageEl.scrollWidth > stageEl.clientWidth, scrollTop: stageEl.scrollTop },
    box: px(box.getBoundingClientRect()),
    band: getComputedStyle(box, "::before").backgroundImage, boxFace: getComputedStyle(box).backgroundImage, boxFrame: getComputedStyle(box).borderImageSource,
    text: { rows: rows(text), rect: px(text.getBoundingClientRect()), fontSize: parseFloat(type.fontSize), lineHeight, color,
      lines: Math.round(text.scrollHeight / lineHeight), breaks: text.querySelectorAll("br").length,
      overflow: text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1 },
    inner: { rows: rows(inner), shown: !inner.hidden, overflow: !inner.hidden && inner.scrollWidth > inner.clientWidth + 1 },
    name: { shown: name.classList.contains("show") && getComputedStyle(name).display !== "none", rows: name.classList.contains("show") && getComputedStyle(name).display !== "none" ? rows(name) : [],
      bar: getComputedStyle(name, "::before").backgroundColor, face: getComputedStyle(name).backgroundImage, text: name.textContent },
    speaker: vn.style.getPropertyValue("--neo-speaker"),
    controls: [...document.querySelectorAll(".vn-ctl")].map((node) => ({ id: node.dataset.test, ...px(node.getBoundingClientRect()), realHeight: node.getBoundingClientRect().height })),
    choices: choices.classList.contains("show") ? [...choices.querySelectorAll(".vn-choice")].map((node) => ({ ...px(node.getBoundingClientRect()),
      fontSize: parseFloat(getComputedStyle(node).fontSize), shrunk: node.style.fontSize, face: getComputedStyle(node).backgroundImage })) : [],
    portraits: [...document.querySelectorAll(".vn-portraits > img.portrait")].map((img) => {
      const light = img.nextElementSibling?.classList.contains("neo-light") ? img.nextElementSibling : null;
      const a = img.getBoundingClientRect(), b = light?.getBoundingClientRect();
      return { speaker: img.dataset.speaker, active: img.classList.contains("active"), filter: getComputedStyle(img).filter,
        endless: img.getAnimations().some((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
        light: !!light, lightActive: light?.classList.contains("active"), lightBlend: light && getComputedStyle(light).mixBlendMode,
        lightMask: light ? light.style.getPropertyValue("--neo-mask").includes(new URL(img.currentSrc || img.src).pathname.split("/").pop()) : false,
        lightOff: b ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) / k : null };
    }),
    lights: document.querySelectorAll(".neo-light").length,
    breathe: getComputedStyle(document.querySelector(".vn-portraits")).animationName,
  };
});

const intersects = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
const inside = (r, outer, slack = 0.75) => r.left >= outer.left - slack && r.top >= outer.top - slack && r.right <= outer.right + slack && r.bottom <= outer.bottom + slack;
const STAGE = { left: 0, top: 0, right: 1280, bottom: 720 };

/** 本文・名前・操作・選択肢が互いに重ならず、ステージの中にある。本文は帯の中で、行数の上限を守る。 */
function assertLayout(m, label, { lines = 2, phone = false } = {}) {
  assert.equal(m.look, "neo", `${label}: 新版が効いている`);
  assert(!m.stage.scrollable && m.stage.scrollTop === 0, `${label}: ステージにスクロール領域を作らない ${JSON.stringify(m.stage)}`);
  assert(m.text.rows.length > 0, `${label}: 本文が出ている`);
  assert(m.text.lines <= lines && m.text.breaks <= lines - 1 && !m.text.overflow && !m.inner.overflow,
    `${label}: 本文は${lines}行に収まる ${JSON.stringify({ ...m.text, rows: undefined })}`);
  const groups = { text: [...m.text.rows, ...m.inner.rows], name: m.name.rows, controls: m.controls, choices: m.choices };
  for (const [key, rects] of Object.entries(groups)) {
    for (const rect of rects) assert(inside(rect, STAGE), `${label}: ${key} がステージの中にある ${JSON.stringify(rect)}`);
  }
  for (const rect of groups.text) assert(inside(rect, m.box), `${label}: 本文が帯の中にある ${JSON.stringify(rect)} / ${JSON.stringify(m.box)}`);
  const names = Object.keys(groups);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    for (const a of groups[names[i]]) for (const b of groups[names[j]]) {
      assert(!intersects(a, b), `${label}: ${names[i]} と ${names[j]} が重ならない ${JSON.stringify([a, b])}`);
    }
  }
  // 白い箱ではなく、下から立ち上がる半透明の帯に明るい文字。
  assert(m.band.includes("linear-gradient") && m.band.includes("rgba(18, 9, 30"), `${label}: 帯は夜紫のグラデーション ${m.band}`);
  assert.equal(m.boxFace, "none", `${label}: 会話窓に面の絵を敷かない`);
  assert.equal(m.boxFrame, "none", `${label}: 会話窓に枠の絵を使わない`);
  assert(m.text.color.reduce((sum, v) => sum + v, 0) > 600, `${label}: 本文は明るい色 ${m.text.color}`);
  assert(Math.abs(m.box.left) < 0.75 && Math.abs(m.box.right - 1280) < 0.75 && Math.abs(m.box.bottom - 720) < 0.75, `${label}: 帯は画面の下いっぱい ${JSON.stringify(m.box)}`);
  assert(m.text.fontSize >= (phone ? 33 : 29) && m.text.fontSize <= (phone ? 36 : 32), `${label}: 本文の大きさ ${m.text.fontSize}`);
  assert(Math.abs(m.text.lineHeight / m.text.fontSize - 1.7) <= 0.08, `${label}: 行間 ${m.text.lineHeight / m.text.fontSize}`);
  // 操作は右上の札。押せる大きさは現行（44px・スマホは規格の 72px＝実寸 38px 以上）を下回らない。
  assert.deepEqual(m.controls.map((c) => c.id), ["vn-auto", "vn-skip", "vn-log", "vn-glossary", "vn-config"]);
  for (const c of m.controls) {
    assert(c.top < 120 && c.left > 640 && c.bottom < m.box.top, `${label}: 操作は右上 ${JSON.stringify(c)}`);
    assert(c.height >= (phone ? 72 : 44) - 0.5 && c.width >= 64 && c.realHeight >= 38, `${label}: 操作の押せる大きさ ${JSON.stringify(c)}`);
  }
  for (const p of m.portraits) {
    assert(!p.endless, `${label}: 立ち絵の img に終わらない動きを付けない（会話エンジンが登場の完了を待てなくなる）`);
    assert(p.filter.includes("drop-shadow"), `${label}: 立ち絵の輪郭の外に影 ${p.filter}`);
    assert(p.light && p.lightMask && p.lightBlend === "soft-light" && p.lightActive === p.active && p.lightOff <= 1.5,
      `${label}: 場面の光が立ち絵と同じ位置・同じ形で重なる ${JSON.stringify(p)}`);
  }
  assert.equal(m.lights, m.portraits.length, `${label}: 光の層は立ち絵と同じ数`);
}

const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const charColor = (page, id) => page.evaluate(async (id) => (await import("./js/core/data.js")).DB.characters[id].intro_cutin.color, id);

async function conversation(page, { phone }) {
  await start(page);
  await settle(page);
  // 1行目: 長い台詞（2行）。名前の縦線はみんとの色。
  let m = await measure(page);
  assertLayout(m, "長い台詞", { phone });
  assert.equal(m.text.lines, 2, "長い台詞は2行に折り返す");
  assert.equal(m.portraits.length, 1);
  assert.equal(m.name.text, "みんと");
  assert.equal(m.name.face, "none", "名前札は箱にしない");
  const minto = await charColor(page, "minto");
  assert.equal(m.speaker, minto, "名前の縦線の色はデータの色（intro_cutin.color）");
  assert.equal(m.name.bar, rgb(minto));
  assert.equal(m.breathe, "neo-breathe", "立ち絵がゆっくり呼吸する");

  // 2行目: ひよりの本心（本文1行＋本心1行）。立ち絵を出さない行なので、色は名前から引く。
  await advance(page, "……また見つかっちゃった");
  await settle(page);
  m = await measure(page);
  assertLayout(m, "本心つき", { lines: 1, phone });
  assert(m.inner.shown && m.inner.rows.length > 0, "本心が出ている");
  assert(m.inner.rows.every((row) => row.top >= m.text.rows[0].bottom - 12), "本心は本文の下の行");
  assert.equal(m.speaker, await charColor(page, "hiyori"), "立ち絵の無い話者の色は名前から引く");

  // 3行目: 地の文（名前なし）。
  await advance(page, "店の奥で、炭のはぜる小さな音がした。");
  await settle(page);
  m = await measure(page);
  assertLayout(m, "地の文", { phone });
  assert(!m.name.shown, "地の文では名前を出さない");

  // 4行目: 二人目が登場する（登場を待つ処理が止まらない）。話していない人は暗いまま。
  await advance(page, "……これ、応募してもいいですか。");
  await settle(page);
  m = await measure(page);
  assertLayout(m, "二人", { phone });
  assert.deepEqual(m.portraits.map((p) => [p.speaker, p.active]), [["minto", false], ["tsumugi", true]]);
  assert(m.portraits[0].filter.includes("brightness(0.62)") && m.portraits[1].filter.includes("brightness(1)"), "話していない人だけ暗くする");
  assert.equal(m.speaker, await charColor(page, "tsumugi"));

  // 5行目→選択肢。
  await advance(page, "みんとのチャームポイント、教えてあげよっか？");
  await press(page, page.locator(".vn-text"));
  await page.locator(".vn-choices.show .vn-choice").nth(2).waitFor();
  await page.waitForTimeout(700); // 選択肢の登場（choice-in 0.35 秒＋ずらし）
  m = await measure(page);
  assertLayout(m, "選択肢", { phone });
  assert.equal(m.choices.length, 3);
  for (const c of m.choices) {
    // 現行の押せる大きさ（PC 720×73・スマホ 880×78）以上。全角26字でも字を縮めない。
    assert(c.width >= (phone ? 880 : 720) && c.height >= (phone ? 78 : 73), `選択肢の押せる大きさ ${JSON.stringify(c)}`);
    assert.equal(c.shrunk, "", "選択肢の字を縮めない");
    assert(c.face.includes("linear-gradient"), "選択肢は白い長方形ではない");
  }
  assert(m.choices.every((c) => c.bottom <= m.box.top), "選択肢は帯より上");
  const numbers = await page.locator(".vn-choice").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node, "::before").content));
  assert.deepEqual(numbers, ['counter(neo-choice)', 'counter(neo-choice)', 'counter(neo-choice)'], "左に番号を出す");

  // 操作の札が実際に押せる（AUTO・SKIP の点灯、LOG）。選択肢の間は自動で進まない。
  for (const id of ["vn-auto", "vn-skip"]) {
    const button = page.locator(`[data-test="${id}"]`);
    const face = () => button.evaluate((node) => getComputedStyle(node, "::after").backgroundImage);
    const off = await face();
    await press(page, button);
    assert.equal(await button.getAttribute("aria-pressed"), "true", `${id} を押すと点灯する`);
    assert(await button.evaluate((node) => node.classList.contains("on")));
    assert.notEqual(await face(), off, `${id} の点灯が見た目で分かる`);
    await press(page, button);
    assert.equal(await button.getAttribute("aria-pressed"), "false");
  }
  await press(page, page.locator('[data-test="vn-log"]'));
  await page.locator(".vn-log.show").waitFor();
  // LOG の紙の上に、右上の札を覗かせない（現行では紙の下に隠れている）。
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".vn-controls")).opacity === "0");
  await press(page, page.locator(".vn-log .log-head button"));
  await page.locator(".vn-log.show").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".vn-choices.show .vn-choice").count(), 3, "操作を押しても選択肢は選ばれない");

  // 選択肢が実際に押せて、選んだ枝へ進む。
  await press(page, page.locator('[data-test="choice-1"]'));
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("置いてけぼり") && document.querySelector(".vn-next.show"));
  assert.equal(await page.locator(".vn-choices.show").count(), 0);
  m = await measure(page);
  assertLayout(m, "選んだ後", { phone });
  // 最後の行を送ると会話が終わり、光の層も片付く。
  await press(page, page.locator(".vn-text"));
  await page.evaluate(() => window.lookNeoRun);
  assert.equal(await page.locator(".neo-light").count(), 0, "会話が終わったら光の層を残さない");
}

/** 会話の部品の計算済みスタイル（疑似要素を含む）。動いている最中の値を拾わないよう、送りの印（▼）は見ない。 */
const styleSnapshot = (page) => page.evaluate(() => {
  const targets = [["#vn", ["", "::before", "::after"]], [".vn-box", ["", "::before", "::after"]], [".vn-name", ["", "::before", "::after"]],
    [".vn-text", [""]], [".vn-inner", [""]], [".vn-controls", ["", "::before", "::after"]],
    ['[data-test="vn-auto"]', ["", "::before", "::after"]], ['[data-test="vn-skip"]', ["", "::before", "::after"]], ['[data-test="vn-config"]', ["", "::before", "::after"]],
    [".vn-portraits", [""]], [".vn-portraits > img.portrait", [""]], [".vn-effect", [""]], [".vn-choices", [""]], [".vn-cg", [""]],
    ["#bg", [""]], ["#bg > .bg-img:last-child", [""]], ["#stage", [""]]];
  const snapshot = {};
  for (const [selector, pseudos] of targets) {
    const node = document.querySelector(selector);
    if (!node) { snapshot[selector] = null; continue; }
    for (const pseudo of pseudos) {
      const style = getComputedStyle(node, pseudo || null);
      const values = {};
      for (const property of style) values[property] = style.getPropertyValue(property);
      snapshot[selector + pseudo] = values;
    }
  }
  return snapshot;
});

/** 新版が足したものの痕跡（要素・クラス・属性・インラインの変数）。現行へ戻したら空になる。 */
const neoTraces = (page) => page.evaluate(() => [
  ...[...document.querySelectorAll("*")].flatMap((node) => [
    ...[...node.classList].filter((name) => name.startsWith("neo")).map((name) => `class ${name} on <${node.localName}>`),
    ...[...node.attributes].filter((attribute) => attribute.name.includes("neo") && attribute.name !== "data-look").map((attribute) => `attr ${attribute.name} on <${node.localName}>`),
    ...(/--neo-/.test(node.getAttribute("style") || "") ? [`style ${node.getAttribute("style")} on <${node.localName}>`] : []),
  ]),
  ...(document.getElementById("vn").hasAttribute("style") ? [`#vn style="${document.getElementById("vn").getAttribute("style")}"`] : []),
]);

async function pickLook(page, look) {
  await page.locator('[data-test="vn-config"]').click();
  await page.locator("#modal.show").waitFor();
  await page.locator(`[data-test="cfg-look"] button[value="${look}"]`).click();
  await page.waitForFunction((look) => document.documentElement.dataset.look === look, look);
  await page.locator("#modal .modal-actions button").last().click();
  await page.locator("#modal.show").waitFor({ state: "hidden" });
}

await suite("look-neo", async (check) => {
  await check("conversation-desktop", (page) => conversation(page, { phone: false }), { pageEntry: NEO });
  await check("conversation-phone", async (page) => {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.density), "phone", "横持ちスマホの規格で確かめる");
    touchPages.add(page);
    await conversation(page, { phone: true });
  }, { pageEntry: NEO, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  await check("restore-classic", async (page) => {
    // 最初から現行（neo.js をまだ読んでいない）で会話を出し、基準を取る。
    const script = { dialogue_id: "__look_neo_restore", lines: [
      { speaker: "minto", face: "normal", text: "今日はゆっくり吸っていってね！" },
      { speaker: "minto", face: "smile", text: "えへへ" },
    ] };
    await start(page, script);
    await settle(page);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
    assert.deepEqual(await neoTraces(page), []);
    await page.mouse.move(640, 300); // 操作や選択肢の上にポインタを置かない（hover の見た目を拾わない）
    const before = await styleSnapshot(page);
    const text = await page.locator(".vn-text").textContent();

    await pickLook(page, "neo");
    await page.locator(".neo-light").first().waitFor({ state: "attached" });
    await page.mouse.move(640, 300);
    await settle(page);
    const neo = await measure(page);
    assertLayout(neo, "設定から新版へ");
    assert.equal(neo.speaker, await charColor(page, "minto"));
    assert.notDeepEqual((await styleSnapshot(page))[".vn-box::before"], before[".vn-box::before"], "新版では会話窓の見た目が変わる");

    await pickLook(page, "classic");
    await page.mouse.move(640, 300);
    await settle(page);
    assert.deepEqual(await neoTraces(page), [], "現行へ戻したら、足した要素・クラス・style を残さない");
    assert.equal(await page.locator(".vn-text").textContent(), text, "切り替えで会話は進まない");
    const after = await styleSnapshot(page);
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${key} の計算済みスタイルが最初から現行の時と一致する`);

    // 現行へ戻した後も会話はそのまま進む。もう一度 新版→現行 と往復しても同じ。
    await page.locator(".vn-text").click();
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("えへへ") && document.querySelector(".vn-next.show"));
    await pickLook(page, "neo");
    await page.locator(".neo-light").first().waitFor({ state: "attached" });
    await pickLook(page, "classic");
    assert.deepEqual(await neoTraces(page), []);
  }, { pageEntry: `${baseURL}?look=classic` });

  await check("reduced-motion-stops-breathing", async (page) => {
    await start(page);
    const breathe = () => page.evaluate(() => getComputedStyle(document.querySelector(".vn-portraits")).animationName);
    assert.equal(await breathe(), "neo-breathe");
    // 設定「揺れ・閃光を減らす」
    await page.evaluate(() => document.body.classList.add("reduce-shake"));
    assert.equal(await breathe(), "none", "揺れ・閃光を減らす設定で呼吸を止める");
    await page.evaluate(() => document.body.classList.remove("reduce-shake"));
    assert.equal(await breathe(), "neo-breathe");
    // 端末の「動きを減らす」
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await breathe(), "none", "prefers-reduced-motion で呼吸を止める");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // SKIP 中も止める（立ち絵が次々替わる間は動かさない）。
    await page.evaluate(() => document.body.classList.add("vn-skip"));
    assert.equal(await breathe(), "none");
    await page.evaluate(() => document.body.classList.remove("vn-skip"));
  }, { pageEntry: NEO });

  await check("same-in-every-ui-theme", async (page) => {
    await start(page, { dialogue_id: "__look_neo_theme", lines: [
      { speaker: "minto", face: "normal", text: LONG },
      { type: "choice", id: "pick", choices: [{ text: "チャームポイント？", next: "end" }, { text: CHOICE_26, next: "end" }] },
    ], branches: { end: [] } });
    await page.locator(".vn-text").click();
    await page.locator(".vn-choices.show .vn-choice").nth(1).waitFor();
    await page.waitForTimeout(700);
    // 見た目を決める値だけを比べる（配色テーマの変数そのものは、会話の外の画面で使うので変わってよい）。
    const look = () => page.evaluate(() => {
      const pick = (selector, pseudo, properties) => {
        const style = getComputedStyle(document.querySelector(selector), pseudo || null);
        return Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
      };
      const face = ["background-image", "background-color", "border-top-width", "border-image-source", "border-radius", "box-shadow", "clip-path", "filter"];
      const type = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color", "text-shadow"];
      const place = ["left", "top", "width", "height", "padding-left", "padding-top"];
      return {
        box: pick(".vn-box", "", [...face, ...place]), band: pick(".vn-box", "::before", [...face, "top", "height", "opacity"]),
        rule: pick(".vn-box", "::after", [...face, "content", "top", "height"]),
        name: pick(".vn-name", "", [...face, ...type, ...place]), bar: pick(".vn-name", "::before", [...face, "width", "height"]), nameAfter: pick(".vn-name", "::after", ["content"]),
        text: pick(".vn-text", "", [...type, "width", "height"]), next: pick(".vn-next", "", ["color", "right", "bottom", "font-size"]),
        controls: pick(".vn-controls", "", [...face, ...place]), controlsBefore: pick(".vn-controls", "::before", ["content"]),
        auto: pick('[data-test="vn-auto"]', "", [...face, ...type, "width", "height"]), autoIcon: pick('[data-test="vn-auto"]', "::before", [...face, "width", "height", "mask-image"]),
        autoFace: pick('[data-test="vn-auto"]', "::after", [...face, "top", "height"]),
        config: pick('[data-test="vn-config"]', "", [...face, ...type, "width", "height"]), configIcon: pick('[data-test="vn-config"]', "::before", [...face, "width", "height"]),
        choices: pick(".vn-choices", "", ["bottom", "row-gap"]), choice: pick('[data-test="choice-1"]', "", [...face, ...type, "width", "height", "padding-left"]),
        number: pick('[data-test="choice-1"]', "::before", [...type, "content", "left"]),
      };
    });
    await page.evaluate(() => { document.documentElement.dataset.uiTheme = "paper"; document.activeElement?.blur(); });
    await page.waitForTimeout(250);
    const paper = await look();
    for (const theme of THEMES.slice(1)) {
      await page.evaluate((theme) => { document.documentElement.dataset.uiTheme = theme; }, theme);
      await page.waitForTimeout(250);
      const themed = await look();
      for (const key of Object.keys(paper)) assert.deepEqual(themed[key], paper[key], `${theme}: ${key} が紙とラベンダーの時と同じ`);
    }
  }, { pageEntry: NEO });

  await check("menu-tab-icons", async (page) => {
    // 第1章の地図（本物の runDaily）から MENU を開く。
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const state = core.newGame();
      Object.assign(state, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
      Object.assign(state.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
        _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
      for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) state.met[id] = true;
      core.save(); core.load();
      (await import("./js/chapters/ch1.js")).setupHooks();
      (await import("./js/core/ui.js")).clearScreen();
      window.lookNeoDaily = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
        .catch((error) => { window.lookNeoDailyError = String(error.stack || error); });
    });
    await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
    await page.locator('[data-test="hud-menu"]').first().click();
    await page.locator(".dmenu .dm-tab").nth(3).waitFor();
    await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));
    const icons = () => page.locator(".dmenu .dm-tab").evaluateAll((tabs) => tabs.map((tab) => {
      const icon = tab.querySelector(".dm-icon"), label = tab.querySelector(".dm-label");
      const style = getComputedStyle(icon);
      const a = icon.getBoundingClientRect(), b = label.getBoundingClientRect(), t = tab.getBoundingClientRect();
      return { tab: tab.dataset.tab, mask: style.maskImage || style.webkitMaskImage, indent: parseFloat(style.textIndent), width: a.width, height: a.height,
        fill: style.backgroundColor, color: getComputedStyle(tab).color,
        inside: a.left >= t.left && a.right <= t.right && a.top >= t.top && a.bottom <= t.bottom, aboveLabel: a.bottom <= b.top + 0.5, tabHeight: t.height };
    }));
    const neo = await icons();
    assert.deepEqual(neo.map((i) => i.tab), ["status", "people", "items", "system"]);
    for (const icon of neo) {
      assert(icon.mask.includes("data:image/svg+xml"), `${icon.tab}: 線画の絵記号（インライン SVG）`);
      assert(icon.indent < -20, `${icon.tab}: 絵文字の字は見せない`);
      assert(Math.abs(icon.width - icon.height) < 0.5 && icon.width >= 22, `${icon.tab}: 絵記号の大きさ ${icon.width}×${icon.height}`);
      assert.equal(icon.fill, icon.color, `${icon.tab}: 絵記号はタブの文字色で塗る`);
      assert(icon.inside && icon.aboveLabel, `${icon.tab}: 絵記号はタブの中・名前の上 ${JSON.stringify(icon)}`);
    }
    assert.equal(new Set(neo.map((i) => i.mask)).size, 4, "4つのタブは別々の絵記号");
    // タブは今までどおり押せる。
    await page.locator('[data-test="menu-tab-people"]').click();
    await page.waitForFunction(() => document.querySelector(".dmenu")?.dataset.tab === "people");
    // 現行へ戻すと絵文字に戻り、タブの高さも変わらない。
    await page.evaluate(async () => (await import("./js/core/look.js")).setLook("classic"));
    const classic = await icons();
    for (const [index, icon] of classic.entries()) {
      assert.equal(icon.mask, "none", `${icon.tab}: 現行は絵文字のまま`);
      assert.equal(icon.indent, 0);
      assert.equal(icon.tabHeight, neo[index].tabHeight, `${icon.tab}: タブの高さは同じ`);
    }
  }, { pageEntry: NEO });
});
