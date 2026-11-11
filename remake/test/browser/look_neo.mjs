// 見た目の様式「新版」（neo・LK02）の検査。1280×720 と横持ちスマホ（844×390 タッチ）の両方で確かめる。
//   1. 会話: 本文が2行（本心つきは1行＋1行）収まり、本文・名前・操作の札・選択肢が重ならずステージ内にあり、
//      操作と選択肢が実際に押せる。操作の札は帯の名前の行の右端（金の罫線のすぐ上）にあり、
//      立ち絵の顔・名前（長い名前・「？？？」）・本文に掛からない。
//   2. 設定から 現行→新版→現行 と切り替えると、足した要素・クラス・style が残らず、
//      会話・地図・HUD・MENU の計算済みスタイルが最初から現行だった時と一致する。
//   3. 「揺れ・閃光を減らす」と端末の「動きを減らす」で、立ち絵の呼吸などの動きが止まる。
//   4. 配色テーマ7種のどれでも、会話の帯・名前・操作・選択肢が同じ見た目になる。
//   5. MENU のタブが絵文字ではなく線画の絵記号になり、現行へ戻すと絵文字に戻る。
//   6. css/look-neo.css の全規則が :root[data-look="neo"] の中にある（現行の見た目に触れない）。
//   7. 地図と HUD: 板・LIME／MENU・ピンがステージ内で押せて、料金・「!」・休みの印・未読数などの情報が現行と同じだけ残る。
//      ピンどうし・ピンと HUD が重ならない。行き先を選ぶ→案内の板→店の中の行動の選択まで進める。
//   8. 全画面 MENU: 4タブが収まり、ステータスと人間関係に人物の立ち絵が読み込めて出る。閉じられる。
//   9. モーダル（設定・セーブ／ロード・確認の問い）: 収まり、段ボタン・スライダー・枠が操作できる。
//  10. タイトル: メニューの札が収まり、押せる大きさが現行以上。選んだ行に金の線。
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
  // セレクタの並びを、かっこの外のカンマで分ける（:is(.a, .b:not(.c)) のような入れ子のかっこの中では分けない）。
  const selectors = (prelude) => {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < prelude.length; i++) {
      if (prelude[i] === "(") depth++;
      else if (prelude[i] === ")") depth--;
      else if (prelude[i] === "," && depth === 0) { parts.push(prelude.slice(start, i)); start = i + 1; }
    }
    parts.push(prelude.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  };
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
const measure = (page) => page.evaluate(async () => {
  const data = await import("./js/core/data.js");
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
  const boxRect = px(box.getBoundingClientRect());
  // 立ち絵の頭の矩形: 顔アイコンと同じ顔の枠（立ち絵 896×1200 の画素）を、髪・帽子・角のぶん上と左右へ広げる。
  const heads = [...document.querySelectorAll(".vn-portraits > img.portrait")].map((img) => {
    const r = px(img.getBoundingClientRect());
    const style = /character_variants\/new\//.test(img.currentSrc || img.src) ? "new" : "classic";
    const frame = data.faceFrame(data.SPEAKER_ALIAS[img.dataset.speaker] || img.dataset.speaker, style);
    if (!frame) return { speaker: img.dataset.speaker, left: r.left + r.width * .25, right: r.right - r.width * .25, top: r.top, bottom: r.top + r.height * .45 };
    const [x, y, side] = frame.box;
    return { speaker: img.dataset.speaker, left: r.left + (x - side * .2) / 896 * r.width, right: r.left + (x + side * 1.2) / 896 * r.width,
      top: r.top + (y - side * .5) / 1200 * r.height, bottom: r.top + (y + side * 1.05) / 1200 * r.height };
  });
  return {
    k, look: document.documentElement.dataset.look,
    stage: { scrollable: stageEl.scrollHeight > stageEl.clientHeight || stageEl.scrollWidth > stageEl.clientWidth, scrollTop: stageEl.scrollTop },
    box: boxRect, rule: boxRect.top + parseFloat(getComputedStyle(box, "::after").top), heads,
    band: getComputedStyle(box, "::before").backgroundImage, boxFace: getComputedStyle(box).backgroundImage, boxFrame: getComputedStyle(box).borderImageSource,
    text: { rows: rows(text), rect: px(text.getBoundingClientRect()), fontSize: parseFloat(type.fontSize), lineHeight, color,
      lines: Math.round(text.scrollHeight / lineHeight), breaks: text.querySelectorAll("br").length,
      overflow: text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1 },
    inner: { rows: rows(inner), shown: !inner.hidden, overflow: !inner.hidden && inner.scrollWidth > inner.clientWidth + 1 },
    name: { shown: name.classList.contains("show") && getComputedStyle(name).display !== "none", rows: name.classList.contains("show") && getComputedStyle(name).display !== "none" ? rows(name) : [],
      bar: getComputedStyle(name, "::before").backgroundColor, face: getComputedStyle(name).backgroundImage, text: name.textContent,
      fontSize: parseFloat(getComputedStyle(name).fontSize), clipped: name.scrollWidth > name.clientWidth + 1 },
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
  // 操作は帯の名前の行の右端（金の罫線のすぐ上）に並ぶ札。画面の上や人物の顔には掛けない。
  // 押せる大きさは現行（44px・スマホは規格の 72px＝実寸 38px 以上）を下回らない。
  assert.deepEqual(m.controls.map((c) => c.id), ["vn-auto", "vn-skip", "vn-log", "vn-glossary", "vn-config"]);
  for (const c of m.controls) {
    assert(c.top >= m.box.top - 0.75 && c.bottom <= m.rule + 0.75 && c.left > 480 && c.right <= 1280 - 166 + 0.75,
      `${label}: 操作は帯の名前の行の右端 ${JSON.stringify(c)} 帯の上端 ${m.box.top}・罫線 ${m.rule}`);
    assert(c.height >= (phone ? 72 : 44) - 0.5 && c.width >= 64 && c.realHeight >= 38, `${label}: 操作の押せる大きさ ${JSON.stringify(c)}`);
    for (const head of m.heads) assert(!intersects(c, head), `${label}: 操作の札が${head.speaker}の顔に掛からない ${JSON.stringify([c, head])}`);
  }
  assert(Math.abs(m.controls.at(-1).right - (1280 - 166)) < 1.5, `${label}: 札の右端は本文の右端 ${m.controls.at(-1).right}`);
  assert(m.rule - Math.max(...m.controls.map((c) => c.bottom)) <= 12, `${label}: 札は罫線のすぐ上`);
  // 名前は札の手前で止まる（札との間は 12px 以上）。
  for (const row of m.name.rows) assert(row.right <= m.controls[0].left - 12 + 0.75, `${label}: 名前が操作の札の手前で止まる ${JSON.stringify(row)}`);
  assert(!m.name.shown || !m.name.clipped, `${label}: 名前が欠けない`);
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
  // LOG の面の上に、操作の札を覗かせない（現行では紙の下に隠れている）。
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


/** 名前の長さ: 「？？？」・（LIME）つきの名前・とても長い名前でも、名前が操作の札の手前で止まり、欠けない。 */
async function names(page, { phone }) {
  await start(page, { dialogue_id: "__look_neo_unknown", lines: [
    { speaker: "???", text: "……誰か、いるのか" },
    { speaker: "sumi", face: "normal", text: "構わん。客の顔を載せる時は、本人に聞けよ" },
  ] });
  await settle(page);
  let m = await measure(page);
  assertLayout(m, "名前を知らない相手", { phone });
  assert.equal(m.name.text, "？？？");
  const size = phone ? 30 : 28;
  assert.equal(m.name.fontSize, size, "短い名前は字を縮めない");
  // 立ち絵が右寄り（帽子のある人）でも、札は顔・帽子に掛からない（assertLayout が頭の矩形と比べる）。
  await advance(page, "構わん。客の顔を載せる時は、本人に聞けよ");
  await settle(page);
  m = await measure(page);
  assertLayout(m, "帽子の人", { phone });
  assert.deepEqual(m.heads.map((head) => head.speaker), ["sumi"]);
  await press(page, page.locator(".vn-text"));
  await page.evaluate(() => window.lookNeoRun);

  // LIME の場面では名前に（LIME）が付く。
  await start(page, { dialogue_id: "__look_neo_lime", metadata: { contact_channel: "lime" }, lines: [
    { speaker: "tsumugi", portrait: false, text: "……これ、応募してもいいですか。" },
  ] });
  await settle(page);
  m = await measure(page);
  assertLayout(m, "（LIME）つきの名前", { phone });
  assert.equal(m.name.text, "つむぎ（LIME）");
  assert.equal(m.name.fontSize, size, "ふつうの長さの名前は字を縮めない");
  // とても長い名前は、札の手前に収まるよう字を縮める（name-fit.js）。
  await page.evaluate(() => {
    document.querySelector(".vn-name").textContent = "とても長い名前の人がここに来ました（LIME）";
    window.dispatchEvent(new Event("resize"));
  });
  m = await measure(page);
  assertLayout(m, "とても長い名前", { phone });
  assert(m.name.fontSize < size && m.name.fontSize >= 14, `長い名前は縮めて収める ${m.name.fontSize}`);
  assert.equal(m.name.rows.length, 1, "名前は1行");
}

// ---------------------------------------------------------------- 会話の外（地図と HUD・MENU・モーダル・タイトル）

/** 第1章 DAY5 の地図（本物の runDaily）を出す。full: 第1章の施設をすべて開けた地図（看板がいちばん混む）。 */
async function openDaily(page, { full = false } = {}) {
  await page.evaluate(async (full) => {
    const core = await import("./js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(state.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) state.met[id] = true;
    state.contacts.push("minto", "naru", "tsumugi");
    Object.assign(state.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    state.lovers = ["tsumugi"];
    if (full) state.spotVisits = { cafe: 1, kannon: 1, choizap: 1, c_station: 1 };
    core.save(); core.load();
    (await import("./js/core/look.js")).refreshLook();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.lookNeoDaily = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.lookNeoDailyError = String(error.stack || error); });
  }, full);
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  // 新しく開いた施設の「NEW」の余韻が終わるまで待つ。
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"], .spot-pin.newly-revealed, .pin-reveal-label'), null, { timeout: 15000 });
  await page.waitForTimeout(450); // HUD と看板の出現（0.4 秒）
}

const setLook = (page, look) => page.evaluate(async (look) => (await import("./js/core/look.js")).setLook(look), look);

/** ステージ上の px で矩形を返す関数を、ページの中へ用意する（測る関数の先頭で呼ぶ）。 */
const STAGE_PX = `(() => {
  const stageEl = document.getElementById("stage"), stage = stageEl.getBoundingClientRect(), k = stage.width / stageEl.offsetWidth;
  const px = (node) => { const r = node.getBoundingClientRect(); return { left: (r.left - stage.left) / k, top: (r.top - stage.top) / k,
    right: (r.right - stage.left) / k, bottom: (r.bottom - stage.top) / k, width: r.width / k, height: r.height / k, real: r.height }; };
  const shown = (node) => { if (!node) return false; const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > .05; };
  const text = (node) => (node ? node.textContent.replace(/\\s+/g, "") : null);
  const rgb = (value) => (value.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  return { px, shown, text, rgb, k };
})()`;

/** 地図と HUD の部品を測る。 */
const measureMap = (page) => page.evaluate((helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  const q = (selector, root = document) => root.querySelector(selector);
  const pins = [...document.querySelectorAll(".map-pins .spot-pin")].map((pin) => {
    const label = q(".sub-label", pin), cost = q(".pin-cost", pin), status = q(".pin-status", pin), badge = q(".evt-badge", pin);
    const shield = q(".shield", pin), facility = q(".facility-icon-crop", pin);
    const people = [...pin.querySelectorAll(".pin-person")];
    // 重なりを見る部品: 看板（施設は絵そのもの）・帯・状態の札・居る人の顔。
    const parts = [[facility || shield, "看板"], [label, "店名"], [cost, "料金"], [status, "状態"], ...people.map((node) => [node, "顔"])]
      .filter(([node]) => node && shown(node)).map(([node, what]) => ({ what, ...px(node) }));
    return {
      id: pin.dataset.spot, classes: [...pin.classList], rect: px(pin), parts, shield: px(facility || shield),
      label: text(label), labelShown: shown(label), labelColor: label ? rgb(getComputedStyle(label).color) : null,
      cost: text(cost), costShown: cost ? shown(cost) : null,
      band: label ? { label: px(label), cost: cost ? px(cost) : null, labelFace: rgb(getComputedStyle(label).backgroundColor),
        costFace: cost ? rgb(getComputedStyle(cost).backgroundColor) : null, frame: getComputedStyle(label).borderImageSource } : null,
      badge: text(badge), badgeShown: badge ? shown(badge) : null,
      status: status ? status.title : null, statusShown: status ? shown(status) : null, statusRect: status ? px(status) : null,
      closedMark: status?.classList.contains("pin-closed") ? getComputedStyle(status, "::before").content : null,
      people: people.map((node) => node.title), peopleShown: people.every(shown),
      plate: getComputedStyle(shield, "::before").backgroundColor,
    };
  });
  const card = q("#hud .hud-card"), lime = q("#hud .hud-lime"), menu = q("#hud .hud-menu"), limeBadge = q("#hud .hud-lime .badge");
  const cardStyle = getComputedStyle(card);
  const hud = {
    card: px(card), cardFace: cardStyle.backgroundImage, cardFrame: cardStyle.borderImageSource, cardColor: rgb(cardStyle.color),
    day: text(q("#hud .dc-day")), dayShown: shown(q("#hud .dc-day b")), dayColor: rgb(getComputedStyle(q("#hud .dc-day b")).color),
    slot: text(q("#hud .dc-slot")), slotShown: shown(q("#hud .dc-slot")),
    money: text(q("#hud .dc-row.money b")), moneyShown: shown(q("#hud .dc-row.money b")), moneySize: parseFloat(getComputedStyle(q("#hud .dc-row.money b")).fontSize),
    moneyColor: rgb(getComputedStyle(q("#hud .dc-row.money b")).color),
    stamina: px(q("#hud .hud-stamina .hud-bar")), staminaShown: shown(q("#hud .hud-stamina .hud-bar")), staminaFill: px(q("#hud .hud-stamina .hud-bar b")).width,
    exp: text(q("#hud .hud-exp .hx-lv")), expShown: shown(q("#hud .hud-exp .hx-bar")), expBar: px(q("#hud .hud-exp .hx-bar")),
    inside: [...card.querySelectorAll(".dc-day, .dc-slot, .dc-row.money b, .hud-bar, .hx-lv, .hx-bar")].filter(shown).map((node) => px(node)),
    lime: px(lime), limeRadius: getComputedStyle(lime).borderRadius, limeLabel: text(q("span", lime)), limeLabelShown: shown(q("span", lime)),
    menu: px(menu), menuRadius: getComputedStyle(menu).borderRadius, menuIcon: shown(q("i", menu)),
    limeBadge: text(limeBadge), limeBadgeShown: shown(limeBadge), limeBadgeRect: px(limeBadge),
  };
  const info = q("#screen .map .map-info");
  return { look: document.documentElement.dataset.look, pins, hud,
    info: info && shown(info) ? { rect: px(info), selected: info.classList.contains("spot-selected"), go: info.dataset.test === "map-go",
      banner: text(q(".mi-banner", info)), face: getComputedStyle(info).backgroundImage, frame: getComputedStyle(info).borderImageSource } : null };
}, STAGE_PX);

/** 様式が変わっても残っていなければならない情報（文字と印）だけを抜き出す。 */
const mapFacts = (m) => ({
  pins: m.pins.map((pin) => ({ id: pin.id, label: pin.label, cost: pin.cost, badge: pin.badge, status: pin.status, closedMark: pin.closedMark, people: pin.people,
    shown: [pin.labelShown, pin.costShown, pin.badgeShown, pin.statusShown, pin.peopleShown].every((flag) => flag !== false) })),
  hud: { day: m.hud.day, slot: m.hud.slot, money: m.hud.money, exp: m.hud.exp, limeBadge: m.hud.limeBadge,
    shown: [m.hud.dayShown, m.hud.slotShown, m.hud.moneyShown, m.hud.staminaShown, m.hud.expShown, m.hud.limeBadgeShown, m.hud.limeLabelShown, m.hud.menuIcon].every(Boolean) },
});

const dark = (color) => color.slice(0, 3).reduce((sum, v) => sum + v, 0) < 240 && (color[3] ?? 1) > .5;
const light = (color) => color.slice(0, 3).reduce((sum, v) => sum + v, 0) > 600;

async function dailyMap(page, { phone }) {
  await openDaily(page, { full: true });
  await page.evaluate(async () => (await import("./js/daily/hud.js")).setPhoneBadge(3));
  await page.mouse.move(640, 700); // 看板の上にポインタを置かない
  await page.waitForTimeout(250);
  const m = await measureMap(page);
  assert.equal(m.look, "neo");
  const tap = phone ? 72 : 48;

  // HUD: 紙の箱ではなく、夜紫の半透明の細い板。日付・残り・所持金・体力・Lv が1行に並び、数字は白く大きい。
  assert(inside(m.hud.card, STAGE), `HUD の板がステージの中 ${JSON.stringify(m.hud.card)}`);
  assert(m.hud.card.height <= (phone ? 64 : 50), `HUD は細い板 ${m.hud.card.height}`);
  assert.equal(m.hud.cardFrame, "none", "HUD に紙の枠の絵を使わない");
  assert(m.hud.cardFace.includes("linear-gradient") && m.hud.cardFace.includes("rgba("), `HUD は半透明の面 ${m.hud.cardFace}`);
  assert(light(m.hud.dayColor) && light(m.hud.moneyColor), "HUD の数字は白");
  assert.equal(m.hud.day, "5/14");
  assert.match(m.hud.slot, /残り2$/);
  assert.equal(m.hud.money, "42,000円");
  assert(m.hud.moneySize >= (phone ? 24 : 20), `所持金の数字の大きさ ${m.hud.moneySize}`);
  assert.equal(m.hud.exp, "Lv.1");
  assert(Math.abs(m.hud.stamina.width - 120) < 1 && Math.abs(m.hud.expBar.width - 120) < 1, "体力と Lv のゲージは現行と同じ長さ（120px）");
  assert(m.hud.staminaFill > 60, "体力の中身が出ている");
  for (const rect of m.hud.inside) assert(inside(rect, m.hud.card, 1), `HUD の中身が板に収まる ${JSON.stringify(rect)}`);
  const centers = m.hud.inside.map((rect) => (rect.top + rect.bottom) / 2);
  assert(Math.max(...centers) - Math.min(...centers) <= m.hud.card.height / 2, "HUD は1行");
  // LIME と MENU: 同じ大きさの丸い札。未読の数は残す。
  for (const [name, rect, radius] of [["LIME", m.hud.lime, m.hud.limeRadius], ["MENU", m.hud.menu, m.hud.menuRadius]]) {
    assert(inside(rect, STAGE), `${name} がステージの中`);
    assert(Math.abs(rect.width - rect.height) < .5 && rect.width >= tap - .5 && rect.real >= 38, `${name} の押せる大きさ ${JSON.stringify(rect)}`);
    assert.equal(radius, "50%", `${name} は丸い札`);
    assert(!intersects(rect, m.hud.card), `${name} が HUD の板に重ならない`);
  }
  assert(Math.abs(m.hud.lime.width - m.hud.menu.width) < .5 && Math.abs(m.hud.lime.top - m.hud.menu.top) < .5, "LIME と MENU は同じ形・同じ高さ");
  assert(!intersects(m.hud.lime, m.hud.menu));
  assert.equal(m.hud.limeBadge, "3");
  assert(m.hud.limeBadgeShown && m.hud.limeBadgeRect.width >= (phone ? 20 : 19), "未読の数の印が残る");

  // 看板: ロゴの札＋その下の夜紫の1枚の帯（店名・料金）。料金・「!」・休みの印・居る人の顔が残る。
  assert.deepEqual(m.pins.map((pin) => pin.id).sort(), ["adam", "c_station", "cafe", "choizap", "kannon", "minto", "naru", "rest", "shop", "tonari"]);
  for (const pin of m.pins) {
    for (const part of pin.parts) assert(inside(part, STAGE), `${pin.id}: ${part.what}がステージの中 ${JSON.stringify(part)}`);
    assert(pin.labelShown && pin.label, `${pin.id}: 店名が出ている`);
    assert.equal(pin.band.frame, "none", `${pin.id}: 帯に紙の絵を使わない`);
    // 休み・選べない店の帯は字を薄くする（読める明るさは保つ）。それ以外は白い字。
    const off = pin.classes.includes("off") || pin.classes.includes("closed");
    const ink = pin.labelColor.slice(0, 3).reduce((sum, v) => sum + v, 0);
    assert(dark(pin.band.labelFace) && (off ? ink > 480 && ink < 600 : light(pin.labelColor)), `${pin.id}: 帯は夜紫に白い字（休みは薄い字） ${pin.band.labelFace} / ${pin.labelColor}`);
    assert(pin.band.label.height * m.hud.lime.real / m.hud.lime.height >= 11, `${pin.id}: 店名が読める大きさ`);
    if (pin.cost !== null) {
      assert(pin.costShown, `${pin.id}: 料金が出ている`);
      assert.match(pin.cost, /^¥[\d,]+$/, `${pin.id}: 料金の表記`);
      // 店名と料金は1枚の帯: 同じ幅・すき間なし・同じ面の色。
      const { label, cost } = pin.band;
      assert(Math.abs(label.left - cost.left) < 1 && Math.abs(label.right - cost.right) < 1 && Math.abs(cost.top - label.bottom) < 1,
        `${pin.id}: 店名と料金が1枚の帯 ${JSON.stringify(pin.band)}`);
      assert.deepEqual(pin.band.costFace, pin.band.labelFace, `${pin.id}: 帯の面の色が同じ`);
    }
    if (pin.badge !== null) assert(pin.badgeShown, `${pin.id}: 「!」が出ている`);
    assert(pin.peopleShown, `${pin.id}: 居る人の顔が出ている`);
  }
  assert.deepEqual(m.pins.filter((pin) => pin.cost).map((pin) => [pin.id, pin.cost]).sort(),
    [["adam", "¥3,000"], ["c_station", "¥2,500"], ["cafe", "¥800"], ["minto", "¥3,000"], ["naru", "¥3,000"]]);
  assert(m.pins.some((pin) => pin.badge === "!"), "新しいイベントの「!」がある");
  assert(m.pins.some((pin) => pin.people.length), "居る人の顔がある");
  // 定休日（DAY5 は EDEN）: 看板の右上の角に「休」の印。
  const closed = m.pins.find((pin) => pin.id === "adam");
  assert(closed.classes.includes("closed") && closed.status === "本日定休日" && closed.statusShown, "EDEN は定休日の印つき");
  assert.equal(closed.closedMark, '"休"');
  assert(Math.abs((closed.statusRect.left + closed.statusRect.right) / 2 - closed.shield.right) <= closed.statusRect.width / 2 + 2
    && Math.abs((closed.statusRect.top + closed.statusRect.bottom) / 2 - closed.shield.top) <= closed.statusRect.height / 2 + 2,
  `「休」の印は看板の右上の角 ${JSON.stringify([closed.statusRect, closed.shield])}`);
  // 看板どうし・看板と HUD が重ならない。
  for (let i = 0; i < m.pins.length; i++) {
    for (const part of m.pins[i].parts) {
      for (const [name, rect] of [["HUD の板", m.hud.card], ["LIME", m.hud.lime], ["MENU", m.hud.menu]]) {
        assert(!intersects(part, rect), `${m.pins[i].id} の${part.what}が${name}に重ならない ${JSON.stringify([part, rect])}`);
      }
      for (let j = i + 1; j < m.pins.length; j++) for (const other of m.pins[j].parts) {
        assert(!intersects(part, other), `${m.pins[i].id} の${part.what}と ${m.pins[j].id} の${other.what}が重ならない ${JSON.stringify([part, other])}`);
      }
    }
  }

  // 情報は現行と同じだけ残る（同じ地図を現行で測り直して比べる）。
  await setLook(page, "classic");
  await page.waitForTimeout(450);
  const classic = await measureMap(page);
  assert.equal(classic.look, "classic");
  assert.deepEqual(mapFacts(m), mapFacts(classic), "店名・料金・「!」・休みの印・居る人・日付・残り・所持金・Lv・未読数が現行と同じ");
  assert(mapFacts(m).pins.every((pin) => pin.shown) && mapFacts(m).hud.shown, "どれも見えている");
  // 押せる大きさは現行以上。
  assert(m.hud.lime.width >= classic.hud.lime.width - .5 && m.hud.menu.width >= classic.hud.menu.width - .5 && m.hud.menu.height >= classic.hud.menu.height - .5,
    `LIME・MENU は現行以上の大きさ ${JSON.stringify([m.hud.lime, classic.hud.lime, m.hud.menu, classic.hud.menu])}`);
  for (const pin of m.pins) {
    const before = classic.pins.find((other) => other.id === pin.id);
    assert(pin.shield.width >= before.shield.width - 1 && pin.shield.height >= before.shield.height - 1, `${pin.id}: 看板の大きさは現行以上`);
    assert(pin.rect.width >= before.rect.width - .75 && pin.rect.height >= before.rect.height - .75,
      `${pin.id}: 押せる範囲は現行以上 ${JSON.stringify([pin.rect, before.rect])}`);
    // 看板の位置は現行と同じ場所を指す（横の中心は同じ。施設の絵は絵そのものが同じ位置）。
    assert(Math.abs((pin.rect.left + pin.rect.right) / 2 - (before.rect.left + before.rect.right) / 2) < 1, `${pin.id}: 看板の横の位置は現行と同じ`);
    if (pin.classes.includes("facility-pin")) assert(Math.abs(pin.shield.top - before.shield.top) < 1 && Math.abs(pin.shield.left - before.shield.left) < 1, `${pin.id}: 施設の絵の位置は現行と同じ`);
    else assert(Math.abs(pin.rect.bottom - before.rect.bottom) < 1, `${pin.id}: 看板の下端（指す場所）は現行と同じ`);
  }
  await setLook(page, "neo");
  await page.waitForTimeout(450);

  // 行き先を選ぶ → 選択が見た目で分かる → 案内の板（押して移動）。
  const tonari = page.locator('[data-test="pin-tonari"]');
  const plate = () => tonari.locator(".shield").evaluate((node) => getComputedStyle(node, "::before").boxShadow);
  const idle = await plate();
  await press(page, tonari);
  await page.locator('#screen .map .map-info.spot-selected[data-test="map-go"]').waitFor();
  await page.mouse.move(640, 700);
  await page.waitForTimeout(350);
  assert(await tonari.evaluate((node) => node.classList.contains("sel")));
  assert.notEqual(await plate(), idle, "選んだ看板は金の輪で分かる");
  const selected = await measureMap(page);
  assert(selected.info.go && inside(selected.info.rect, STAGE), `案内の板がステージの中 ${JSON.stringify(selected.info)}`);
  assert.match(selected.info.banner, /^tonari/);
  assert.equal(selected.info.frame, "none", "案内の板に紙の枠の絵を使わない");
  assert(selected.info.face.includes("linear-gradient"), "案内の板は夜紫の面");
  for (const [name, rect] of [["LIME", selected.hud.lime], ["MENU", selected.hud.menu], ["HUD の板", selected.hud.card]]) assert(!intersects(selected.info.rect, rect), `案内の板が${name}に重ならない`);

  // LIME と MENU が実際に開いて閉じる。
  await press(page, page.locator('[data-test="hud-phone"]'));
  await page.locator(".phone-overlay").waitFor();
  await press(page, page.locator('[data-test="phone-close"]'));
  await page.locator(".phone-overlay").waitFor({ state: "detached" });
  await press(page, page.locator('[data-test="hud-menu"]'));
  await page.locator(".dmenu .dm-tab").nth(3).waitFor();
  await press(page, page.locator('[data-test="menu-close"]'));
  await page.locator(".dmenu").waitFor({ state: "detached" });

  // 案内の板を押して店へ → 店の中の行動の選択（夜紫の板・選択肢は現行以上の大きさ）→ 地図へ戻る。
  if (!(await page.locator('#screen .map .map-info[data-test="map-go"]').count())) await press(page, tonari);
  await press(page, page.locator('#screen .map .map-info[data-test="map-go"]'));
  await page.waitForFunction(() => document.querySelector("#screen .sub-menu") || document.querySelector("#vn.active .vn-next.show"), null, { timeout: 20000 });
  for (let i = 0; i < 12 && !(await page.locator("#screen .sub-menu").count()); i++) {
    await press(page, page.locator(".vn-text")).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.locator("#screen .sub-menu .big-choice").first().waitFor();
  await page.mouse.move(640, 700);
  await page.waitForTimeout(500); // 板の出現（0.35 秒）
  const sub = await page.evaluate((helpers) => {
    const { px, rgb } = (0, eval)(helpers);
    const menu = document.querySelector("#screen .sub-menu"), style = getComputedStyle(menu);
    return { rect: px(menu), face: style.backgroundImage, frame: style.borderImageSource, color: rgb(style.color),
      title: px(menu.querySelector(".sub-title")), titleColor: rgb(getComputedStyle(menu.querySelector(".sub-title")).color),
      choices: [...menu.querySelectorAll(".big-choice")].map((node) => ({ ...px(node), face: rgb(getComputedStyle(node).backgroundColor), color: rgb(getComputedStyle(node).color), frame: getComputedStyle(node).borderImageSource })),
      back: px(menu.querySelector(".sub-back")) };
  }, STAGE_PX);
  assert(inside(sub.rect, STAGE), `行動の選択がステージの中 ${JSON.stringify(sub.rect)}`);
  assert.equal(sub.frame, "none");
  assert(sub.face.includes("linear-gradient") && light(sub.titleColor), "行動の選択は夜紫の面に白い見出し");
  assert(sub.choices.length >= 2);
  for (const choice of sub.choices) {
    assert(inside(choice, sub.rect) && choice.width >= 600 && choice.height >= 72 && choice.real >= 38, `行動の選択肢の大きさ ${JSON.stringify(choice)}`);
    assert(dark(choice.face) && light(choice.color), "選択肢は夜紫の札に白い字");
  }
  assert(inside(sub.back, sub.rect) && sub.back.real >= (phone ? 38 : 30), "戻るボタンが板の中");
  await press(page, page.locator("#screen .sub-menu .sub-back"));
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  assert.equal(await page.evaluate(() => window.lookNeoDailyError || ""), "");
}

/** 開いている MENU を測る。 */
const measureMenu = (page) => page.evaluate(async (helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  const data = await import("./js/core/data.js");
  const menu = document.querySelector("#modal > .dmenu"), sheet = menu.querySelector(".dm-sheet"), panel = menu.querySelector(".dm-panel");
  const figure = menu.querySelector(".neo-figure.show"), picture = figure?.querySelector("img");
  let head = null;
  if (picture) {
    const r = px(picture);
    const style = /character_variants\/new\//.test(picture.currentSrc || picture.src) ? "new" : "classic";
    const frame = data.faceFrame(figure.dataset.who, style);
    if (frame) { const [x, y, side] = frame.box; head = { left: r.left + x / 896 * r.width, right: r.left + (x + side) / 896 * r.width, top: r.top + y / 1200 * r.height, bottom: r.top + (y + side) / 1200 * r.height }; }
  }
  const sheetStyle = getComputedStyle(sheet);
  return {
    tab: menu.dataset.tab, sheet: px(sheet), sheetFace: sheetStyle.backgroundImage, ink: rgb(getComputedStyle(menu).color),
    side: px(menu.querySelector(".dm-side")), head: px(menu.querySelector(".dm-head")), panel: px(panel), close: px(menu.querySelector(".dm-close")),
    title: text(menu.querySelector(".dm-title")), summary: text(menu.querySelector(".dm-summary")),
    summaryRows: [...menu.querySelectorAll(".dm-summary > .dm-sum")].map((node) => px(node)),
    tabs: [...menu.querySelectorAll(".dm-tab")].map((node) => ({ id: node.dataset.tab, on: node.classList.contains("on"), ...px(node), label: px(node.querySelector(".dm-label")) })),
    overflowX: panel.scrollWidth > panel.clientWidth + 1, scrollY: panel.scrollHeight - panel.clientHeight,
    // 面の中の札・ボタン・行が、面の左右からはみ出さない。
    blocks: [...panel.querySelectorAll(".dm-heading, .dm-card, .dm-btn, .dm-chip:not(.blank), .dm-person, .dm-row, .dm-keepsake, .dm-flavor, .dm-note:not([hidden])")].filter(shown)
      .map((node) => ({ what: node.className, ...px(node) })),
    figure: figure ? { rect: px(figure), who: figure.dataset.who, name: text(figure.querySelector(".neo-figure-name")), nameRect: px(figure.querySelector(".neo-figure-name")),
      picture: px(picture), loaded: picture.complete && picture.naturalWidth > 0, natural: picture.naturalWidth, opacity: getComputedStyle(picture).opacity,
      src: picture.getAttribute("src"), head, transition: getComputedStyle(picture).transitionDuration } : null,
    figures: document.querySelectorAll(".neo-figure").length,
    people: [...panel.querySelectorAll(".dm-person")].map((row) => ({ id: row.dataset.person, open: row.getAttribute("aria-expanded") === "true", rect: px(row),
      parts: [...row.querySelectorAll(".dm-face, .dm-name, .heart-row, .dm-chip:not(.blank)")].map((node) => ({ what: node.className, ...px(node), text: text(node) })) })),
  };
}, STAGE_PX);

async function dailyMenu(page, { phone }) {
  await openDaily(page);
  await press(page, page.locator('[data-test="hud-menu"]'));
  await page.locator(".dmenu .dm-tab").nth(3).waitFor();
  await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));
  const figureReady = (who) => page.waitForFunction((who) => {
    const figure = document.querySelector(".dmenu .neo-figure.show"), picture = figure?.querySelector("img.in");
    // 絵が読み込めて、出入りの動き（0.3 秒）も終わっている。
    return figure?.dataset.who === who && picture?.complete && picture.naturalWidth > 0 && picture.getAnimations().length === 0;
  }, who, { timeout: 15000 });
  const common = (m, label) => {
    assert(inside(m.sheet, STAGE), `${label}: MENU の面がステージの中 ${JSON.stringify(m.sheet)}`);
    assert(m.sheetFace.includes("gradient") && !m.sheetFace.includes("url("), `${label}: 紙の絵ではなく夜紫の面 ${m.sheetFace}`);
    assert(light(m.ink), `${label}: 文字は白`);
    for (const [name, rect] of [["左の帯", m.side], ["上の帯", m.head], ["中身", m.panel], ["閉じる", m.close]]) assert(inside(rect, m.sheet, 1), `${label}: ${name}が面の中 ${JSON.stringify(rect)}`);
    assert(!m.overflowX, `${label}: 中身が横にはみ出さない`);
    for (const block of m.blocks) assert(block.left >= m.panel.left - 1 && block.right <= m.panel.right + 1, `${label}: ${block.what} が面の左右に収まる ${JSON.stringify(block)}`);
    assert.equal(m.title, "MENU");
    for (const part of ["DAY5/14", "あと9日", "体力", "所持金42,000円"]) assert(m.summary.includes(part), `${label}: 上の帯に ${part} が残る（${m.summary}）`);
    for (const row of m.summaryRows) assert(inside(row, m.head, 1) && row.right <= m.close.left, `${label}: 上の帯の項目が「閉じる」に掛からない ${JSON.stringify(row)}`);
    assert.deepEqual(m.tabs.map((tab) => tab.id), ["status", "people", "items", "system"]);
    for (const tab of m.tabs) {
      assert(inside(tab, m.side, 1) && tab.height >= 80 - .5 && tab.real >= 38, `${label}: タブ ${tab.id} の大きさ ${JSON.stringify(tab)}`);
      assert(inside(tab.label, tab, 1), `${label}: タブの名前がタブに収まる`);
    }
    assert(m.close.height >= (phone ? 72 : 44) - .5 && m.close.real >= 38, `${label}: 「閉じる」の押せる大きさ ${JSON.stringify(m.close)}`);
  };
  const withFigure = (m, label, who, name) => {
    assert(m.figure, `${label}: 人物の絵が出ている`);
    assert.equal(m.figure.who, who, `${label}: 絵の人`);
    assert.equal(m.figure.name, name, `${label}: 絵の人の名前`);
    assert(m.figure.loaded && m.figure.natural >= 400 && Number(m.figure.opacity) > .9, `${label}: 立ち絵が読み込めている ${JSON.stringify(m.figure)}`);
    assert(m.figure.src.includes(`chr_${who}_normal`), `${label}: 会話と同じ立ち絵の絵 ${m.figure.src}`);
    // 絵は左、一覧は右。絵は左の帯・上の帯・中身に掛からず、ステージの中。
    assert(m.figure.rect.left >= m.side.right - 1 && m.figure.rect.right <= m.panel.left + 1 && m.figure.rect.top >= m.head.bottom - 8 && m.figure.rect.bottom <= 720.75,
      `${label}: 絵は左の帯と中身のあいだ ${JSON.stringify([m.figure.rect, m.side, m.panel])}`);
    assert(m.figure.rect.width >= 300 && m.figure.rect.height >= 560 && m.figure.picture.height >= 1000, `${label}: 絵が主役の大きさ ${JSON.stringify(m.figure)}`);
    assert(m.figure.head && inside(m.figure.head, m.figure.rect, 2), `${label}: 顔が枠の中に入る ${JSON.stringify([m.figure.head, m.figure.rect])}`);
    assert(inside(m.figure.nameRect, m.figure.rect, 2) && !intersects(m.figure.nameRect, m.figure.head), `${label}: 名前が絵の枠の中で、顔に掛からない`);
    assert(m.panel.width >= 600, `${label}: 一覧の幅 ${m.panel.width}`);
    assert.equal(m.figures, 1);
  };

  // ステータス: 左にはじめの立ち絵。
  await figureReady("hajime");
  let m = await measureMenu(page);
  assert.equal(m.tab, "status");
  common(m, "ステータス");
  withFigure(m, "ステータス", "hajime", "はじめ");
  assert.equal(m.scrollY <= 1, true, "ステータスは1画面に収まる");
  assert.notEqual(m.figure.transition, "0s", "絵の出入りは短い動き");
  // 「揺れ・閃光を減らす」と端末の「動きを減らす」では、絵の出入りを動かさない。
  await page.evaluate(() => document.body.classList.add("reduce-shake"));
  assert.equal((await measureMenu(page)).figure.transition, "0s", "揺れ・閃光を減らす設定で絵の出入りを止める");
  await page.evaluate(() => document.body.classList.remove("reduce-shake"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal((await measureMenu(page)).figure.transition, "0s", "prefers-reduced-motion で絵の出入りを止める");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // 動きを戻すと、MENU の面の出現（現行の dm-in）がもう一度走る。終わるまで待ってから測る。
  await page.waitForTimeout(50);
  await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));

  // 人間関係: 未選択なら先頭の人、行を選ぶとその人の立ち絵。一覧は右。
  await press(page, page.locator('[data-test="menu-tab-people"]'));
  await page.waitForFunction(() => document.querySelector(".dmenu")?.dataset.tab === "people");
  await figureReady("sumi");
  m = await measureMenu(page);
  common(m, "人間関係");
  withFigure(m, "人間関係（未選択）", "sumi", "スミさん");
  assert.deepEqual(m.people.map((row) => row.id).slice(0, 2), ["sumi", "tsumugi"]);
  assert(m.people.every((row) => !row.open));
  for (const row of m.people) {
    assert(row.rect.real >= 38, `人の行の押せる大きさ ${JSON.stringify(row.rect)}`);
    for (let i = 0; i < row.parts.length; i++) {
      assert(inside(row.parts[i], row.rect, 1), `${row.id}: ${row.parts[i].what} が行に収まる`);
      for (let j = i + 1; j < row.parts.length; j++) assert(!intersects(row.parts[i], row.parts[j]), `${row.id}: ${row.parts[i].what} と ${row.parts[j].what} が重ならない`);
    }
  }
  const chips = Object.fromEntries(m.people.map((row) => [row.id, row.parts.filter((part) => part.what.includes("dm-chip")).map((part) => part.text)]));
  assert.deepEqual(chips.tsumugi, ["恋人", "LIME"], "関係の札と LIME の札が残る");
  assert(chips.minto.includes("LIME") && chips.naru.includes("LIME") && !chips.adam.includes("LIME"));
  await press(page, page.locator('[data-test="menu-person-tsumugi"]'));
  await figureReady("tsumugi");
  await page.waitForTimeout(350);
  m = await measureMenu(page);
  common(m, "人間関係（選択）");
  withFigure(m, "人間関係（選択）", "tsumugi", "つむぎ");
  assert(m.people.find((row) => row.id === "tsumugi").open);
  assert(await page.locator('[data-test="menu-person-detail-tsumugi"]').isVisible(), "選んだ人の思い出が開く");
  // もう一度押すと閉じて、絵は先頭の人へ戻る。
  await press(page, page.locator('[data-test="menu-person-tsumugi"]'));
  await figureReady("sumi");

  // 持ち物・システム: 人物の絵は出さず、同じ面を全幅で使う。
  for (const [tab, label] of [["items", "持ち物"], ["system", "システム"]]) {
    await press(page, page.locator(`[data-test="menu-tab-${tab}"]`));
    await page.waitForFunction((tab) => document.querySelector(".dmenu")?.dataset.tab === tab && !document.querySelector(".dmenu .neo-figure.show"), tab);
    m = await measureMenu(page);
    common(m, label);
    assert.equal(m.figure, null, `${label}: 人物の絵は出さない`);
    assert(m.panel.width >= 1000, `${label}: 面を全幅で使う ${m.panel.width}`);
  }
  const system = await page.locator(".dmenu .dm-system > button").evaluateAll((nodes) => nodes.map((node) => {
    const r = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { test: node.dataset.test, real: r.height, frame: style.borderImageSource, face: style.backgroundImage + style.backgroundColor, color: style.color };
  }));
  assert.deepEqual(system.map((button) => button.test).slice(0, 6), ["menu-save", "menu-load", "menu-config", "menu-glossary", "menu-rules", "menu-title"]);
  for (const button of system) assert(button.real >= 38 && button.frame === "none" && !button.face.includes("url("), `システムのボタン ${JSON.stringify(button)}`);

  // 閉じられる。閉じた後に人物の絵（閉じる動きの写しも含む）を残さない。
  await press(page, page.locator('[data-test="menu-tab-status"]'));
  await figureReady("hajime");
  await press(page, page.locator('[data-test="menu-close"]'));
  await page.locator(".dmenu").waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector(".neo-figure") && getComputedStyle(document.getElementById("hud")).visibility === "visible");
  // 開き直しても1枚だけ出る。
  await press(page, page.locator('[data-test="hud-menu"]'));
  await figureReady("hajime");
  assert.equal(await page.locator(".neo-figure").count(), 1);
  await page.keyboard.press("Escape");
  await page.locator(".dmenu").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => window.lookNeoDailyError || ""), "");
}

/** いま開いているモーダルの箱を測る。 */
const measureModal = (page) => page.evaluate((helpers) => {
  const { px, shown, rgb } = (0, eval)(helpers);
  const box = document.querySelector("#modal .modal-box"), style = getComputedStyle(box);
  return { rect: px(box), face: style.backgroundImage, frame: style.borderImageSource, color: rgb(style.color),
    title: rgb(getComputedStyle(box.querySelector("h3")).color), rule: getComputedStyle(box.querySelector("h3")).backgroundImage,
    buttons: [...box.querySelectorAll(".modal-actions .btn")].filter(shown).map((node) => ({ ...px(node), primary: node.classList.contains("primary"),
      frame: getComputedStyle(node).borderImageSource, face: getComputedStyle(node).backgroundImage, ink: rgb(getComputedStyle(node).color) })) };
}, STAGE_PX);

function assertModal(m, label, { phone }) {
  assert(inside(m.rect, STAGE), `${label}: モーダルがステージの中 ${JSON.stringify(m.rect)}`);
  assert.equal(m.frame, "none", `${label}: 紙の枠の絵を使わない`);
  assert(m.face.includes("linear-gradient") && m.face.includes("rgba("), `${label}: 夜紫の半透明の面 ${m.face}`);
  assert(light(m.color) && light(m.title), `${label}: 白い文字`);
  assert(m.rule.includes("linear-gradient") && m.rule.includes("227, 189, 110"), `${label}: 見出しの下に金の罫線 ${m.rule}`);
  assert(m.buttons.length >= 1);
  for (const button of m.buttons) {
    assert(inside(button, m.rect, 1) && button.real >= 38 && button.height >= (phone ? 72 : 44) - .5, `${label}: ボタンの大きさ ${JSON.stringify(button)}`);
    assert.equal(button.frame, "none");
    // 主のボタンは金に墨の字、ほかは夜紫に白い字。
    assert(button.primary ? button.face.includes("linear-gradient") && !light(button.ink) : light(button.ink), `${label}: ボタンの色 ${JSON.stringify(button)}`);
  }
}

async function modals(page, { phone }) {
  await openDaily(page);
  const system = async (id) => {
    await press(page, page.locator('[data-test="hud-menu"]'));
    await press(page, page.locator('[data-test="menu-tab-system"]'));
    await press(page, page.locator(`[data-test="menu-${id}"]`));
    await page.locator("#modal.show .modal-box").waitFor();
    await page.waitForTimeout(350); // 出現（pop-in 0.3 秒）
  };
  const closed = () => page.locator("#modal.show").waitFor({ state: "hidden" });

  // 設定: 段ボタン・スライダー・チェック・ミュートが操作でき、選んでいる段が見た目で分かる。
  await system("config");
  assertModal(await measureModal(page), "設定", { phone });
  const seg = (value) => page.locator(`[data-test="cfg-auto-speed"] button[value="${value}"]`);
  const segLook = (value) => seg(value).evaluate((node) => { const style = getComputedStyle(node); const r = node.getBoundingClientRect();
    return { checked: node.getAttribute("aria-checked"), face: style.backgroundImage, ink: style.color, real: r.height }; });
  const picked = (await page.locator('[data-test="cfg-auto-speed"] button[aria-checked="true"]').getAttribute("value"));
  const other = picked === "3" ? "1" : "3";
  await seg(other).scrollIntoViewIfNeeded();
  const before = await segLook(other);
  assert.equal(before.checked, "false");
  assert.equal(before.face, "none", "選んでいない段は塗らない");
  assert(before.real >= 38, `段ボタンの押せる大きさ ${before.real}`);
  await press(page, seg(other));
  await page.mouse.move(640, 5);
  const after = await segLook(other);
  assert.equal(after.checked, "true", "段ボタンを押すと選ばれる");
  assert(after.face.includes("linear-gradient") && after.ink !== before.ink, `選んだ段は金で塗る ${JSON.stringify(after)}`);
  assert.equal((await segLook(picked)).checked, "false");
  assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.autoSpeed), Number(other), "設定に反映される");
  await press(page, seg(picked)); // 元へ戻す
  const slider = page.locator('[data-test="cfg-se-volume"]');
  await slider.scrollIntoViewIfNeeded();
  const volume = Number(await slider.inputValue());
  await slider.focus();
  await page.keyboard.press(volume >= 1 ? "ArrowLeft" : "ArrowRight");
  assert.notEqual(Number(await slider.inputValue()), volume, "スライダーが動く");
  const track = await slider.evaluate((node) => ({ real: node.getBoundingClientRect().height, scheme: getComputedStyle(node).colorScheme }));
  assert(track.real >= 38 && track.scheme.includes("dark"), `スライダーの押せる大きさと暗い面向けの描き方 ${JSON.stringify(track)}`);
  const check = page.locator('[data-test="cfg-short-seen"]');
  await check.scrollIntoViewIfNeeded();
  const checked = await check.isChecked();
  await press(page, check);
  assert.equal(await check.isChecked(), !checked, "チェックが切り替わる");
  await press(page, check);
  const mute = page.locator('[data-test="cfg-mute"]');
  await mute.scrollIntoViewIfNeeded();
  await press(page, mute);
  assert.equal(await mute.getAttribute("aria-pressed"), "true");
  await press(page, mute);
  assert.equal(await mute.getAttribute("aria-pressed"), "false");
  await press(page, page.locator("#modal .modal-actions button").last());
  await closed();

  // セーブ: 枠が収まり、手動の枠へ書き込める。
  await system("save");
  assertModal(await measureModal(page), "セーブ", { phone });
  const slots = () => page.locator("#modal .save-slot").evaluateAll((nodes, helpers) => {
    const { px, rgb } = (0, eval)(helpers);
    return nodes.map((node) => ({ test: node.dataset.test, ...px(node), off: node.disabled, blank: node.classList.contains("blank"),
      frame: getComputedStyle(node).borderImageSource, face: rgb(getComputedStyle(node).backgroundColor), ink: rgb(getComputedStyle(node).color), label: node.querySelector(".ss-label").textContent }));
  }, STAGE_PX);
  let list = await slots();
  let box = (await measureModal(page)).rect;
  assert.deepEqual(list.map((slot) => [slot.test, slot.off, slot.blank]), [["slot-0", true, false], ["slot-1", false, true]]);
  for (const slot of list) {
    assert(inside(slot, box, 1) && slot.real >= 38, `セーブの枠が収まる ${JSON.stringify(slot)}`);
    assert(slot.frame === "none" && light(slot.ink) && slot.face.slice(0, 3).reduce((sum, v) => sum + v, 0) < 300, `セーブの枠は夜紫の札 ${JSON.stringify(slot)}`);
  }
  assert(!intersects(list[0], list[1]));
  await press(page, page.locator('[data-test="slot-1"]'));
  await closed();
  const toast = page.locator("#toasts .toast.good");
  await toast.waitFor();
  await page.waitForTimeout(400);
  const notice = await toast.evaluate((node, helpers) => {
    const { px, rgb } = (0, eval)(helpers); const style = getComputedStyle(node);
    return { rect: px(node), text: node.textContent, frame: style.borderImageSource, face: style.backgroundImage, ink: rgb(style.color) };
  }, STAGE_PX);
  assert.match(notice.text, /保存した/);
  assert(inside(notice.rect, STAGE) && notice.frame === "none" && notice.face.includes("linear-gradient") && notice.ink.reduce((sum, v) => sum + v, 0) > 480,
    `通知は夜紫の札 ${JSON.stringify(notice)}`);

  // ロード: 書き込んだ枠が並ぶ。選ぶと確認の問い（やめる／ロードする）。やめれば地図のまま。
  await system("load");
  assertModal(await measureModal(page), "ロード", { phone });
  list = await slots();
  box = (await measureModal(page)).rect;
  assert.deepEqual(list.map((slot) => [slot.test, slot.off, slot.blank]), [["slot-0", false, false], ["slot-1", false, false]]);
  for (const slot of list) assert(inside(slot, box, 1), `ロードの枠が収まる ${JSON.stringify(slot)}`);
  await press(page, page.locator('[data-test="slot-1"]'));
  await page.locator('#modal.show [data-test="confirm-load"]').waitFor();
  await page.waitForTimeout(350);
  const confirm = await measureModal(page);
  assertModal(confirm, "確認の問い", { phone });
  assert.deepEqual(confirm.buttons.map((button) => button.primary), [false, true]);
  assert(!intersects(confirm.buttons[0], confirm.buttons[1]));
  await press(page, page.locator("#modal .modal-actions button").first()); // やめる
  await closed();
  assert(await page.locator("#screen .map:not(.done)").isVisible(), "やめれば地図のまま");

  // 用語集と大会の規則も同じ面。規則の紙は配られた紙なので、紙の上の字は墨のまま読める。
  await system("glossary");
  assertModal(await measureModal(page), "用語集", { phone });
  const tabs = page.locator("#modal .gl-tab");
  assert((await tabs.count()) >= 2);
  await press(page, tabs.nth(1));
  assert(await tabs.nth(1).evaluate((node) => node.classList.contains("on") && getComputedStyle(node).backgroundImage.includes("linear-gradient")), "用語集の分類が切り替わり、選んだ札が分かる");
  await press(page, page.locator("#modal .modal-actions button").last());
  await closed();
  await system("rules");
  assertModal(await measureModal(page), "大会の規則", { phone });
  const paper = await page.locator("#modal .rule-sheet").evaluate((node) => ({ heading: getComputedStyle(node.querySelector(".rule-article h3")).color, body: getComputedStyle(node.querySelector(".rule-article p")).color }));
  for (const color of Object.values(paper)) assert(color.match(/[\d.]+/g).slice(0, 3).reduce((sum, v) => sum + Number(v), 0) < 300, `規則の紙の字は墨 ${JSON.stringify(paper)}`);
  await press(page, page.locator("#modal .modal-actions button").last());
  await closed();
  assert.equal(await page.evaluate(() => window.lookNeoDailyError || ""), "");
}

const measureTitle = (page) => page.evaluate((helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  return { look: document.documentElement.dataset.look,
    items: [...document.querySelectorAll(".title-menu .title-item")].map((node) => ({ test: node.dataset.test, ...px(node), disabled: node.disabled, label: text(node),
      face: getComputedStyle(node).backgroundImage, frame: getComputedStyle(node).borderImageSource, ink: rgb(getComputedStyle(node.querySelector(".ti-en")).color),
      bar: getComputedStyle(node, "::before").backgroundColor, barWidth: parseFloat(getComputedStyle(node, "::before").width) || 0,
      mark: getComputedStyle(node.querySelector(".ti-en"), "::before").content, focused: document.activeElement === node,
      en: px(node.querySelector(".ti-en")), ja: px(node.querySelector(".ti-ja")), jaShown: shown(node.querySelector(".ti-ja")) })),
    logo: px(document.querySelector(".title-logo")), logoSrc: document.querySelector(".title-logo").getAttribute("src"),
    art: px(document.querySelector(".title-art")), artImage: getComputedStyle(document.querySelector(".title-art")).backgroundImage };
}, STAGE_PX);

async function title(page, { phone }) {
  await page.locator(".title-art.ready").waitFor();
  await page.mouse.move(900, 400); // メニューの上にポインタを置かない
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(1300); // タイトルの絵の出現（1 秒）
  const m = await measureTitle(page);
  assert.equal(m.look, "neo");
  assert.deepEqual(m.items.map((item) => item.test), ["title-new", "title-load", "title-gallery", "title-config"]);
  for (const [index, item] of m.items.entries()) {
    assert(inside(item, STAGE) && item.height >= 72 - .5 && item.real >= 38 && item.width >= 300, `${item.test}: 札の押せる大きさ ${JSON.stringify(item)}`);
    assert(item.face.includes("linear-gradient") && item.frame === "none", `${item.test}: 控えめな夜紫の札 ${item.face}`);
    assert(inside(item.en, item, 1) && item.jaShown && inside(item.ja, item, 1), `${item.test}: 主文と副題が札に収まる`);
    assert.equal(item.mark, "none", "選んだ印は「◆」ではなく金の線");
    if (index) assert(item.top - m.items[index - 1].bottom >= 15.5, `${item.test}: 行の間隔は現行と同じ（16px）`);
  }
  assert(m.items[1].disabled, "セーブが無ければ LOAD は押せない");
  // 絵とロゴは変えない（現行で測り直して比べる）。行の高さ・間隔も現行以上。
  await setLook(page, "classic");
  await page.waitForTimeout(300);
  const classic = await measureTitle(page);
  assert.equal(classic.look, "classic");
  assert.deepEqual([m.logo, m.logoSrc, m.art, m.artImage], [classic.logo, classic.logoSrc, classic.art, classic.artImage], "絵とロゴは現行と同じ");
  for (const [index, item] of m.items.entries()) {
    const before = classic.items[index];
    assert.equal(item.label, before.label);
    assert(item.height >= before.height - .5 && item.width >= before.width - .5 && Math.abs(item.top - before.top) < .75, `${item.test}: 行の位置と大きさは現行以上 ${JSON.stringify([item, before])}`);
  }
  await setLook(page, "neo");
  // 選んでいる行（キーボードの移動）に金の線が出る。
  await page.locator('[data-test="title-new"]').focus();
  await page.keyboard.press("Tab"); // LOAD は押せないので GALLERY へ
  await page.waitForTimeout(350);
  const focused = await measureTitle(page);
  const on = focused.items.find((item) => item.focused);
  assert.equal(on?.test, "title-gallery");
  assert.equal(on.bar, "rgb(227, 189, 110)", "選んでいる行の左に金の線");
  assert(on.barWidth > focused.items[0].barWidth, "金の線はふだんの線より太い");
  assert.notEqual(focused.items[0].bar, on.bar);
  assert.notDeepEqual(on.ink, focused.items[0].ink, "選んでいる行の字の色が変わる");
  for (const item of focused.items) assert(inside(item, STAGE), `${item.test}: 選んだ時もステージの中`);
  // 札が実際に押せる（設定が開く）。閉じてもタイトルのまま。
  await press(page, page.locator('[data-test="title-config"]'));
  await page.locator("#modal.show .cfg-modal").waitFor();
  await page.waitForTimeout(350);
  assertModal(await measureModal(page), "タイトルからの設定", { phone });
  await press(page, page.locator("#modal .modal-actions button").last());
  await page.locator("#modal.show").waitFor({ state: "hidden" });
  await page.locator('[data-test="title-new"]').waitFor();
  assert.equal((await measureTitle(page)).items.length, 4);
}

/** 指定した部品の計算済みスタイル（疑似要素を含む）。 */
const stylesOf = (page, targets) => page.evaluate((targets) => {
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
}, targets);

const ALL = ["", "::before", "::after"];
const MAP_PARTS = [["#hud .hud", [""]], ["#hud .hud-card", ALL], ["#hud .dc-main", [""]], ["#hud .dc-area", [""]], ["#hud .dc-day", [""]], ["#hud .dc-day b", [""]], ["#hud .dc-day small", [""]],
  ["#hud .dc-slot", [""]], ["#hud .dc-meta", [""]], ["#hud .dc-row.money", ALL], ["#hud .dc-row.money b", [""]], ["#hud .hud-stamina", ALL], ["#hud .hud-stamina .hud-bar", [""]],
  ["#hud .hud-stamina .gauge-track", [""]], ["#hud .hud-stamina .hud-bar b", [""]], ["#hud .hud-exp", [""]], ["#hud .hx-lv", [""]], ["#hud .hx-bar", ALL], ["#hud .hx-settled", [""]],
  ["#hud .hud-right", [""]], ["#hud .hud-lime", ALL], ["#hud .hud-lime span", ALL], ["#hud .hud-lime .badge", [""]], ["#hud .hud-menu", ALL], ["#hud .hud-menu i", ALL],
  ["#screen .map", ALL], ['[data-test="pin-minto"]', [""]], ['[data-test="pin-minto"] .pin-visual', [""]], ['[data-test="pin-minto"] .shield', ALL], ['[data-test="pin-minto"] .ico', [""]],
  ['[data-test="pin-minto"] .sub-label', [""]], ['[data-test="pin-minto"] .pin-cost', [""]], ['[data-test="pin-minto"] .pin-person', [""]], ['[data-test="pin-minto"] .evt-badge', [""]],
  ['[data-test="pin-adam"]', [""]], ['[data-test="pin-adam"] .shield', ALL], ['[data-test="pin-adam"] .sub-label', [""]], ['[data-test="pin-adam"] .pin-cost', [""]], ['[data-test="pin-adam"] .pin-status', ALL],
  ['[data-test="pin-rest"]', [""]], ['[data-test="pin-rest"] .shield', ALL], ['[data-test="pin-rest"] .sub-label', [""]], ['[data-test="pin-kannon"] .evt-badge', [""]],
  ['[data-test="pin-tonari"] .shield', ALL], ['[data-test="pin-tonari"] .sub-label', [""]], ["#screen .map .map-info", ALL], ["#screen .map .mi-banner", [""]], ["#screen .map .mi-preview", [""]]];
const MENU_PARTS = [["#modal > .dmenu", [""]], [".dmenu .dm-backdrop", [""]], [".dmenu .dm-sheet", ALL], [".dmenu .dm-side", [""]], [".dmenu .dm-title", [""]], [".dmenu .dm-tabs", [""]],
  [".dmenu .dm-tab.on", ALL], [".dmenu .dm-tab:not(.on)", ALL], [".dmenu .dm-tab .dm-icon", [""]], [".dmenu .dm-tab .dm-label", [""]], [".dmenu .dm-head", [""]], [".dmenu .dm-summary", [""]],
  [".dmenu .dm-sum > small", [""]], [".dmenu .dm-sum > b", [""]], [".dmenu .dm-health > b", [""]], [".dmenu .dm-help", ALL], [".dmenu .dm-close", [""]], [".dmenu .dm-panel", [""]],
  [".dmenu .dm-heading h3", [""]], [".dmenu .dm-card", [""]], [".dmenu .dm-person-item:first-child .dm-person", [""]], [".dmenu .dm-person-item:nth-child(2) .dm-person", [""]],
  [".dmenu .dm-face", [""]], [".dmenu .dm-name", [""]], [".dmenu .dm-person-status", [""]], [".dmenu .heart-row", [""]], [".dmenu .dm-chip.lime", ALL], [".dmenu .dm-chip.rel-lover", [""]], [".dmenu .dm-chip.blank", [""]]];

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

  // ---- 会話の外: 地図と HUD・全画面 MENU・モーダル・タイトル（PC と横持ちスマホ）
  const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
  const onPhone = (body) => async (page) => {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.density), "phone", "横持ちスマホの規格で確かめる");
    touchPages.add(page);
    await body(page, { phone: true });
  };
  await check("conversation-names-desktop", (page) => names(page, { phone: false }), { pageEntry: NEO });
  await check("conversation-names-phone", onPhone(names), { pageEntry: NEO, ...PHONE });
  await check("map-desktop", (page) => dailyMap(page, { phone: false }), { pageEntry: NEO });
  await check("map-phone", onPhone(dailyMap), { pageEntry: NEO, ...PHONE });
  await check("menu-desktop", (page) => dailyMenu(page, { phone: false }), { pageEntry: NEO });
  await check("menu-phone", onPhone(dailyMenu), { pageEntry: NEO, ...PHONE });
  await check("modals-desktop", (page) => modals(page, { phone: false }), { pageEntry: NEO });
  await check("modals-phone", onPhone(modals), { pageEntry: NEO, ...PHONE });
  await check("title-desktop", (page) => title(page, { phone: false }), { pageEntry: NEO });
  await check("title-phone", onPhone(title), { pageEntry: NEO, ...PHONE });

  await check("restore-classic-daily", async (page) => {
    // 最初から現行（neo.js をまだ読んでいない）で地図と MENU を出し、基準を取る。
    await openDaily(page, { full: true });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
    assert.deepEqual(await neoTraces(page), []);
    const tonari = page.locator('[data-test="pin-tonari"]');
    await tonari.click();
    await page.locator('#screen .map .map-info.spot-selected').waitFor();
    await page.mouse.move(640, 700);
    await page.waitForTimeout(500);
    const mapBefore = await stylesOf(page, MAP_PARTS);
    assert(mapBefore["#hud .hud-card"] && mapBefore['[data-test="pin-adam"] .pin-status::before'] && mapBefore["#screen .map .map-info"], "基準の部品が取れている");
    const openMenu = async () => {
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-tab-people"]').click();
      await page.locator('[data-test="menu-person-tsumugi"]').waitFor();
      await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));
      await page.mouse.move(700, 712);
      await page.locator('[data-test="menu-tab-people"]').evaluate((node) => node.blur());
      await page.waitForTimeout(300);
    };
    await openMenu();
    const menuBefore = await stylesOf(page, MENU_PARTS);
    assert(menuBefore[".dmenu .dm-sheet"] && menuBefore[".dmenu .dm-chip.lime::before"] && menuBefore[".dmenu .dm-person-status"], "MENU の基準の部品が取れている");

    // 新版へ: 人物の絵が出て、見た目が変わる。
    await setLook(page, "neo");
    await page.locator(".dmenu .neo-figure.show img.in").waitFor();
    await page.waitForTimeout(500);
    const menuNeo = await stylesOf(page, MENU_PARTS);
    assert.notDeepEqual(menuNeo[".dmenu .dm-sheet"], menuBefore[".dmenu .dm-sheet"], "新版では MENU の面が変わる");
    assert.notEqual(menuNeo[".dmenu .dm-person-status"].display, menuBefore[".dmenu .dm-person-status"].display);

    // 現行へ: 足した要素・クラス・style を残さず、計算済みスタイルが最初から現行の時と一致する。
    await setLook(page, "classic");
    await page.waitForTimeout(600);
    assert.deepEqual(await neoTraces(page), [], "現行へ戻したら、MENU の人物の絵を残さない");
    const menuAfter = await stylesOf(page, MENU_PARTS);
    for (const key of Object.keys(menuBefore)) assert.deepEqual(menuAfter[key], menuBefore[key], `${key} の計算済みスタイルが最初から現行の時と一致する`);
    await page.locator('[data-test="menu-close"]').click();
    await page.locator(".dmenu").waitFor({ state: "detached" });

    // 地図と HUD も同じ（MENU を閉じた状態で 新版→現行）。
    await setLook(page, "neo");
    await page.mouse.move(640, 700);
    await page.waitForTimeout(500);
    const mapNeo = await stylesOf(page, MAP_PARTS);
    for (const key of ["#hud .hud-card", "#hud .hud-menu", '[data-test="pin-minto"] .sub-label', '[data-test="pin-minto"] .shield::before', "#screen .map .map-info"]) {
      assert.notDeepEqual(mapNeo[key], mapBefore[key], `新版では ${key} が変わる`);
    }
    await setLook(page, "classic");
    await page.waitForTimeout(600);
    assert.deepEqual(await neoTraces(page), []);
    const mapAfter = await stylesOf(page, MAP_PARTS);
    for (const key of Object.keys(mapBefore)) assert.deepEqual(mapAfter[key], mapBefore[key], `${key} の計算済みスタイルが最初から現行の時と一致する`);
    // 新版の MENU を開いたまま閉じて現行へ戻しても、閉じる動きの写しに絵を残さない。
    await setLook(page, "neo");
    await openMenu();
    await page.locator(".dmenu .neo-figure.show").waitFor();
    await page.locator('[data-test="menu-close"]').click();
    await setLook(page, "classic");
    assert.deepEqual(await neoTraces(page), []);
    assert.equal(await page.evaluate(() => window.lookNeoDailyError || ""), "");
  }, { pageEntry: `${baseURL}?look=classic` });
});
