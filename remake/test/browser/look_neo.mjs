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
//  11. 第2〜5章（LK13）: 各章の保存から実際の再開で地図と HUD を出し、情報が現行と同じ・押せる・ステージ内・HUD や札と重ならない・
//      現行に無い看板の重なりを作らないことを見る。「出発まで」「勝負の日まで」は板の下の札、横持ちスマホは体力と Lv を上下2段。
//      章ごとに増える MENU の上の帯。第3〜5章の場面カード（行程の札・東京の街の地図を含む）は夜紫の面と金の罫線で、文とボタンは現行と同じ。
//      現行へ戻すと、場面カードと残り日数の札の計算済みスタイルが最初から現行の時と一致する。
//  12. ショップ（入口・売り場・問い）・レベルアップ（全面の札・短い帯）・ギャラリー（一覧・閲覧の帯）:
//      夜紫の面と金の罫線で、文字（値段・所持・収集率）と押せる大きさは現行と同じ。実際に買える・開閉できる。
//      現行へ戻すと計算済みスタイルが最初から現行の時と一致する。
//  13. LIME（一覧・トーク・朝の通知・HUD の印）は、実際のスマホのアプリをまねた見た目なので新版でも紫にしない（LK20）:
//      緑の見出し・白い一覧・緑の自分の吹き出しのまま、計算済みスタイルが旧版と一致する。返信できる・開閉できる。
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
      const amb = light?.nextElementSibling?.classList.contains("neo-amb") ? light.nextElementSibling : null;
      const a = img.getBoundingClientRect(), b = light?.getBoundingClientRect(), c = amb?.getBoundingClientRect();
      const file = new URL(img.currentSrc || img.src).pathname.split("/").pop();
      return { speaker: img.dataset.speaker, active: img.classList.contains("active"), filter: getComputedStyle(img).filter,
        endless: img.getAnimations().some((animation) => animation.effect?.getComputedTiming().iterations === Infinity),
        light: !!light, lightActive: light?.classList.contains("active"), lightBlend: light && getComputedStyle(light).mixBlendMode,
        lightMask: light ? light.style.getPropertyValue("--neo-mask").includes(new URL(img.currentSrc || img.src).pathname.split("/").pop()) : false,
        lightOff: b ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) / k : null,
        amb: !!amb, ambActive: amb?.classList.contains("active"), ambBlend: amb && getComputedStyle(amb).mixBlendMode,
        ambMask: amb ? amb.style.getPropertyValue("--neo-mask").includes(file) : false,
        ambOff: c ? Math.max(Math.abs(a.left - c.left), Math.abs(a.top - c.top), Math.abs(a.width - c.width), Math.abs(a.height - c.height)) / k : null };
    }),
    lights: document.querySelectorAll(".neo-light").length,
    ambs: document.querySelectorAll(".neo-amb").length,
    breathe: getComputedStyle(document.querySelector(".vn-portraits")).animationName,
  };
});

/** 枠の絵（border-image）は、無いか、制作・大会と同じ夜紫の絵の部品（img/ui/craft-night。LK19）。紙の絵は使わない。 */
const noPaperFrame = (frame) => frame === "none" || (/img\/ui\/craft-night\//.test(frame) && !/ui\/paper/.test(frame));
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
    assert(p.amb && p.ambMask && p.ambBlend === "multiply" && p.ambActive === p.active && p.ambOff <= 1.5,
      `${label}: 場所の光が場面の光のすぐ後ろで、立ち絵と同じ位置・同じ形で重なる ${JSON.stringify(p)}`);
  }
  assert.equal(m.lights, m.portraits.length, `${label}: 光の層は立ち絵と同じ数`);
  assert.equal(m.ambs, m.portraits.length, `${label}: 場所の光の層は立ち絵と同じ数`);
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
  // 背景のぼかしは控えめ（LK10: 5px では奥の物の形が分からず「ぼんやりしすぎ」）。人物がいる間だけ掛かる。
  const bgBlur = await page.evaluate(() => {
    const node = document.querySelector("#bg > .bg-img.show") || document.querySelector("#bg > .bg-img:last-child");
    const match = /blur\(([\d.]+)px\)/.exec(getComputedStyle(node).filter);
    return match ? Number(match[1]) : 0;
  });
  assert(bgBlur > 0 && bgBlur <= 2, `背景のぼかしは 0 より大きく 2px 以下: ${bgBlur}px`);
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
  assert.equal(await page.locator(".neo-amb").count(), 0, "会話が終わったら場所の光の層を残さない");
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
  // 色の数値（0〜255 と不透明度）。color-mix() の計算値は color(srgb 0〜1 …) の書き方で返るので 255 倍する。
  const rgb = (value) => { const n = (value.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
    return /^color\\(srgb/.test(value) ? [...n.slice(0, 3).map((v) => Math.round(v * 255)), ...n.slice(3)] : n; };
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
    // 読み上げ用に残した札が、見た目では 1px 以下に畳まれているか（MAP06）。
    slotHidden: ((node) => !!node && node.getBoundingClientRect().width <= 1 && node.getBoundingClientRect().height <= 1)(q("#hud .dc-slot")),
    money: text(q("#hud .dc-row.money b")), moneyShown: shown(q("#hud .dc-row.money b")), moneySize: parseFloat(getComputedStyle(q("#hud .dc-row.money b")).fontSize),
    moneyColor: rgb(getComputedStyle(q("#hud .dc-row.money b")).color),
    stamina: px(q("#hud .hud-stamina .hud-bar")), staminaShown: shown(q("#hud .hud-stamina .hud-bar")), staminaFill: px(q("#hud .hud-stamina .hud-bar b")).width,
    exp: text(q("#hud .hud-exp .hx-lv")), expShown: shown(q("#hud .hud-exp .hx-bar")), expBar: px(q("#hud .hud-exp .hx-bar")),
    inside: [...card.querySelectorAll(".dc-day, .dc-slot, .dc-row.money b, .hud-bar, .hx-lv, .hx-bar")].filter(shown).map((node) => px(node)),
    lime: px(lime), limeRadius: getComputedStyle(lime).borderRadius, limeLabel: text(q("span", lime)), limeLabelShown: shown(q("span", lime)),
    limeFace: rgb(getComputedStyle(lime).backgroundColor), limeBubble: rgb(getComputedStyle(q("span", lime)).backgroundColor), limeInk: rgb(getComputedStyle(q("span", lime)).color),
    menu: px(menu), menuRadius: getComputedStyle(menu).borderRadius, menuIcon: shown(q("i", menu)),
    limeBadge: text(limeBadge), limeBadgeShown: shown(limeBadge), limeBadgeRect: px(limeBadge),
    // 「出発まで」「勝負の日まで」の行（第3・4章の出発前・第5章だけ）。新版では板の下の札。
    goal: shown(q("#hud .dc-row.goal")) ? { text: text(q("#hud .dc-row.goal")), rect: px(q("#hud .dc-row.goal")), value: px(q("#hud .dc-row.goal b")),
      color: rgb(getComputedStyle(q("#hud .dc-row.goal b")).color), face: rgb(getComputedStyle(q("#hud .dc-row.goal")).backgroundColor) } : null,
    staminaRow: px(q("#hud .hud-stamina")), expRow: px(q("#hud .hud-exp")),
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
  hud: { day: m.hud.day, slot: m.hud.slot, money: m.hud.money, exp: m.hud.exp, limeBadge: m.hud.limeBadge, goal: m.hud.goal?.text ?? null,
    // 時間帯・残りの行動の札（☀残り2）は画面に出さない（MAP06）ので、出ているものの一覧に入れない。
    shown: [m.hud.dayShown, m.hud.moneyShown, m.hud.staminaShown, m.hud.expShown, m.hud.limeBadgeShown, m.hud.limeLabelShown, m.hud.menuIcon].every(Boolean), slotHidden: m.hud.slotHidden },
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
  assert(noPaperFrame(m.hud.cardFrame), "HUD に紙の枠の絵を使わない");
  assert(m.hud.cardFace.includes("linear-gradient") && m.hud.cardFace.includes("rgba("), `HUD は半透明の面 ${m.hud.cardFace}`);
  assert(light(m.hud.dayColor) && light(m.hud.moneyColor), "HUD の数字は白");
  assert.equal(m.hud.day, "5/14");
  assert.match(m.hud.slot, /残り2$/, "読み上げ用の文は残る");
  assert(m.hud.slotHidden, "時間帯・残りの行動の札（☀残り2）は画面に出さない（MAP06）");
  assert.equal(m.hud.money, "42,000円");
  assert(m.hud.moneySize >= (phone ? 24 : 20), `所持金の数字の大きさ ${m.hud.moneySize}`);
  assert.equal(m.hud.exp, "Lv.1");
  assert(Math.abs(m.hud.stamina.width - 120) < 1 && Math.abs(m.hud.expBar.width - 120) < 1, "体力と Lv のゲージは現行と同じ長さ（120px）");
  assert(m.hud.staminaFill > 60, "体力の中身が出ている");
  for (const rect of m.hud.inside) assert(inside(rect, m.hud.card, 1), `HUD の中身が板に収まる ${JSON.stringify(rect)}`);
  const centers = m.hud.inside.map((rect) => (rect.top + rect.bottom) / 2);
  assert(Math.max(...centers) - Math.min(...centers) <= m.hud.card.height / 2, "HUD は1行");
  // LIME と MENU: 同じ大きさで並ぶ。MENU は丸い札。LIME は実際のスマホのアプリの印のオマージュ（緑の角丸四角・LK20）なので丸くしない。未読の数は残す。
  for (const [name, rect, radius] of [["LIME", m.hud.lime, m.hud.limeRadius], ["MENU", m.hud.menu, m.hud.menuRadius]]) {
    assert(inside(rect, STAGE), `${name} がステージの中`);
    assert(Math.abs(rect.width - rect.height) < .5 && rect.width >= tap - .5 && rect.real >= 38, `${name} の押せる大きさ ${JSON.stringify(rect)}`);
    if (name === "MENU") assert.equal(radius, "50%", "MENU は丸い札");
    else assert(parseFloat(radius) > 6 && parseFloat(radius) < rect.width * .3 && !radius.includes("%"), `LIME は角丸の四角 ${radius}`);
    assert(!intersects(rect, m.hud.card), `${name} が HUD の板に重ならない`);
  }
  assert(m.hud.limeFace[0] < 40 && m.hud.limeFace[1] > 180 && m.hud.limeFace[2] < 40, `LIME の印は緑の地 ${m.hud.limeFace}`);
  assert(light(m.hud.limeBubble) && m.hud.limeInk[1] > 150 && m.hud.limeInk[0] < 40, `LIME の印は白い吹き出しに緑の字 ${JSON.stringify([m.hud.limeBubble, m.hud.limeInk])}`);
  assert(Math.abs(m.hud.lime.width - m.hud.menu.width) < .5 && Math.abs(m.hud.lime.top - m.hud.menu.top) < .5, "LIME と MENU は同じ形・同じ高さ");
  assert(!intersects(m.hud.lime, m.hud.menu));
  assert.equal(m.hud.limeBadge, "3");
  assert(m.hud.limeBadgeShown && m.hud.limeBadgeRect.width >= (phone ? 20 : 19), "未読の数の印が残る");

  // 看板: ロゴの札＋その下の夜紫の1枚の帯（店名・料金）。料金・「!」・休みの印・居る人の顔が残る。
  assert.deepEqual(m.pins.map((pin) => pin.id).sort(), ["adam", "c_station", "cafe", "choizap", "kannon", "minto", "naru", "rest", "shop", "tonari"]);
  for (const pin of m.pins) {
    for (const part of pin.parts) assert(inside(part, STAGE), `${pin.id}: ${part.what}がステージの中 ${JSON.stringify(part)}`);
    assert(pin.labelShown && pin.label, `${pin.id}: 店名が出ている`);
    assert(noPaperFrame(pin.band.frame), `${pin.id}: 帯に紙の絵を使わない`);
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
  // 料金はピンに出さず、右下のプレビューで見る（MAP05）。
  assert.deepEqual(m.pins.filter((pin) => pin.cost).map((pin) => [pin.id, pin.cost]), [], "ピンに料金を出さない（MAP05）");
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
  assert(noPaperFrame(selected.info.frame), "案内の板に紙の枠の絵を使わない");
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
  assert(noPaperFrame(sub.frame));
  assert(sub.face.includes("linear-gradient") && light(sub.titleColor), "行動の選択は夜紫の面に白い見出し");
  assert(sub.choices.length >= 2);
  for (const choice of sub.choices) {
    assert(inside(choice, sub.rect) && choice.width >= 600 && choice.height >= 72 && choice.real >= 38, `行動の選択肢の大きさ ${JSON.stringify(choice)}`);
    assert(dark(choice.face) && light(choice.color), "選択肢は夜紫の札に白い字");
  }
  assert(inside(sub.back, sub.rect) && sub.back.real >= (phone ? 38 : 30), "戻るボタンが板の中");
  await press(page, page.locator("#screen .sub-menu .sub-back"));
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });

  // 獲得の通知（能力・好感度・お知らせのカード）も、紙ではなく夜紫の札に白い字。
  await page.evaluate(async () => (await import("./js/core/ui.js")).gainCard({ kind: "info", badge: "!", top: "NEW", main: "レシピを覚えた", sub: "スミさんの基本形" }));
  const card = page.locator("#banners .gain-card.show");
  await card.waitFor();
  await page.waitForTimeout(700); // 出現（0.45 秒）
  const gain = await card.evaluate((node, helpers) => {
    const { px, rgb } = (0, eval)(helpers); const style = getComputedStyle(node);
    return { rect: px(node), frame: style.borderImageSource, face: style.backgroundImage, main: rgb(getComputedStyle(node.querySelector(".gc-main")).color),
      badge: rgb(getComputedStyle(node.querySelector(".gc-badge")).color), badgeFace: rgb(getComputedStyle(node.querySelector(".gc-badge")).backgroundColor) };
  }, STAGE_PX);
  assert(inside(gain.rect, STAGE) && noPaperFrame(gain.frame) && gain.face.includes("linear-gradient") && light(gain.main), `獲得の通知は夜紫の札 ${JSON.stringify(gain)}`);
  assert(light(gain.badge) && dark(gain.badgeFace), `通知の印は暗い札に明るい字 ${JSON.stringify(gain)}`);
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
    assert(m.sheetFace.includes("gradient") && !/ui\/paper/.test(m.sheetFace), `${label}: 紙の絵ではなく夜紫の面 ${m.sheetFace}`);
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
  for (const button of system) assert(button.real >= 38 && noPaperFrame(button.frame) && !/ui\/paper/.test(button.face), `システムのボタン ${JSON.stringify(button)}`);

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
  assert(noPaperFrame(m.frame), `${label}: 紙の枠の絵を使わない`);
  assert(m.face.includes("linear-gradient") && m.face.includes("rgba("), `${label}: 夜紫の半透明の面 ${m.face}`);
  assert(light(m.color) && light(m.title), `${label}: 白い文字`);
  assert(m.rule.includes("linear-gradient") && m.rule.includes("227, 189, 110"), `${label}: 見出しの下に金の罫線 ${m.rule}`);
  assert(m.buttons.length >= 1);
  for (const button of m.buttons) {
    assert(inside(button, m.rect, 1) && button.real >= 38 && button.height >= (phone ? 72 : 44) - .5, `${label}: ボタンの大きさ ${JSON.stringify(button)}`);
    assert(noPaperFrame(button.frame));
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
    assert(noPaperFrame(slot.frame) && light(slot.ink) && slot.face.slice(0, 3).reduce((sum, v) => sum + v, 0) < 300, `セーブの枠は夜紫の札 ${JSON.stringify(slot)}`);
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
  assert(inside(notice.rect, STAGE) && noPaperFrame(notice.frame) && notice.face.includes("linear-gradient") && notice.ink.reduce((sum, v) => sum + v, 0) > 480,
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
    assert(item.face.includes("linear-gradient") && noPaperFrame(item.frame), `${item.test}: 控えめな夜紫の札 ${item.face}`);
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
// ---------------------------------------------------------------- 第2〜5章（LK13・2026-11-11 オーナー「新版を広げる」）
// 地図と HUD・章の場面カード・東京の街の地図を、各章の保存から実際の再開の流れで出して確かめる（PC と横持ちスマホ）。

/** 章の保存を作り、タイトルの LOAD から再開する（章の側の再開の流れで地図やカードへ入る）。会話は早送り、選択肢は先頭。 */
async function loadSeeded(page, seed, arg = null) {
  await page.evaluate(seed, arg);
  await page.reload();
  await press(page, page.locator('[data-test="title-load"]'));
  await page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
  await press(page, page.locator('[data-test="slot-0"]'));
}
/** 保存の共通の下ごしらえ（辻占のオババの出現は済み・文字は即時・音なし）。page.evaluate の中で使う。 */
const SEED_COMMON = `async (core, value, chapter) => {
  const plan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter });
  value.flags._fortune_wander = { chapter, shown: plan.map(() => null), used: plan.map(() => true) };
  Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
  core.saveConfig();
}`;
/** 地図が出そろい、新しい行き先のお披露目と HUD・看板の出現が終わるまで待つ。 */
async function mapSettled(page, pin) {
  await page.waitForFunction((pin) => document.querySelector(`#screen .map:not(.done) [data-test="pin-${pin}"]`) && !document.querySelector("#modal.show")
    && !document.querySelector('.map[data-revealing], .spot-pin.newly-revealed, .pin-reveal-label'), pin, { timeout: 90000 });
  await page.mouse.move(640, 700);
  await page.waitForTimeout(500);
}

/** 各章の地図。expect: その章の状態で出ているはずのもの（正しい章の地図を測っていることの確かめ）。 */
const CHAPTER_MAPS = {
  // 第2章: 地元（橙須）の朝 → 地図。
  ch2: { expect: { day: "2/14", goal: null, pins: ["station", "tonari", "naru", "minto"] }, async open(page) {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 2, phase: "daily", day: 15, slot: 2, money: 36000, stamina: 100, weatherSeed: 7, lastBaitoDay: 15 });
      value.flags = { _rei_trpg_introduced: true, _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
        _ch2_city_visit_c_station: true, _lime_tut: 1, _lime_opened: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true };
      value.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true, ageha: true, kumicho: true, rei: true, volk: true };
      value.contacts = ["sumi", "naru"];
      for (const id of ["ageha", "kumicho", "rei"]) value.flags[`_intro_${id}`] = true;
      core.save();
      window.__remake.vnTest.turbo = true;
      (await import("./js/chapters/ch1.js")).setupHooks();
      void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
    });
    await press(page, page.locator('[data-test="ch2-morning-home"]'));
    await mapSettled(page, "tonari");
  } },
  // 第3章の出発前の3日（地元の地図・HUD に「出発まで」）。
  ch3prep: { expect: { day: "1/3", goal: "出発まであと3日", pins: ["naru", "rest", "station"], menu: ["DAY1/3", "出発まであと3日", "所持金30,000円"] }, async open(page) {
    await loadSeeded(page, async (common) => {
      const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch3-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5, contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1, _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
      for (const who of ["ageha", "kumicho", "rei", "hajime", "sumi"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { ageha: true, kumicho: true, rei: true, naru: true, adam: true, minto: true });
      if (!progress.advanceToChapterThree(value)) throw new Error("第3章へ入れない");
      value.flags._ch3_prep.step = 3;
      Object.assign(value.flags._ch3_intro, { titleSeen: true, routeVersion: 2 });
      await (0, eval)(common)(core, value, 3);
      Object.assign(core.state, value); core.save();
    }, SEED_COMMON);
    await mapSettled(page, "rest");
  } },
  // 第3章の東京（DAY1 の受付と規則の紙 → DAY2 の夜の地図）。
  ch3tokyo: { expect: { day: "2/14", goal: null, pins: ["ch3_tokyo_mukai", "ch3_tokyo_shop", "ch3_tokyo_park"] }, async open(page) {
    await loadSeeded(page, async (common) => {
      const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch3-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5, contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
        _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1, _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
      for (const who of ["hajime", "sumi", "pakki", "maezono", "dr_kemuri", "sui"]) value.flags[`_intro_${who}`] = true;
      if (!progress.advanceToChapterThree(value)) throw new Error("第3章へ入れない");
      value.day += 3;
      if (!progress.departChapterThree(value)) throw new Error("東京へ出発できない");
      value.flags._ch3_intro.titleSeen = true;
      await (0, eval)(common)(core, value, 3);
      Object.assign(core.state, value); core.save();
    }, SEED_COMMON);
    await page.locator('[data-test="rule-sheet"]').waitFor({ timeout: 90000 });
    await press(page, page.locator('[data-test="rule-sheet-close"]'));
    await mapSettled(page, "ch3_tokyo_mukai");
  } },
  // 第4章のドバイ DAY5（上端の FESTA に居る人の顔がある。HUD の板が長いと顔に掛かる）。
  ch4: { expect: { day: "5/14", goal: null, pins: ["ch4_dubai_festa", "ch4_dubai_inn", "ch4_dubai_souq"], people: "ch4_dubai_festa", menu: ["DAY5/14", "所持金50,000円"] }, async open(page) {
    await loadSeeded(page, async (common) => {
      const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, da_silva: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("第4章へ入れない");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("ドバイへ出発できない");
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_stranger_second", "ch4_dubai_cafe", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1; p.secondDay = 3;
      value.day = p.startDay + 4; value.slot = 0; p.day = 5;
      await (0, eval)(common)(core, value, 4);
      Object.assign(core.state, value); core.save();
    }, SEED_COMMON);
    await mapSettled(page, "ch4_dubai_inn");
  } },
  // 第5章の地元（HUD に「勝負の日まで」）。
  ch5: { expect: { day: "3", goal: "勝負の日まで未定", pins: ["tonari", "c_station", "ch5_to_dubai"], menu: ["DAY3", "勝負の日まで未定", "所持金50,000円"] }, async open(page) {
    await loadSeeded(page, async (common) => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, seed: 0, lovers: [], contacts: ["sumi"], kujiTickets: 0 });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
        _ch2_preparation_started: true, _ch2_region: "home", _lime_opened: true, _lime_tut: 1,
        _ch5: { startDay: 49, stage: 2, part: "free", titleSeen: true, read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null,
          aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null },
        _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true, _spot_guide_naru: true,
        _ch5_catering: { next: 81, offers: 0, offer: null, served: {}, last: null } };
      Object.assign(value.met, { naru: true, adam: true, minto: true, ageha: true, kumicho: true, rei: true, steve: true, volk: true });
      await (0, eval)(common)(core, value, 5);
      core.save();
    }, SEED_COMMON);
    await mapSettled(page, "tonari");
  } },
};

/** 看板どうしの重なり（看板の組）。縁が触れる程度（どちらかの向きに 3px 以下）は数えない。 */
function pinOverlaps(m) {
  const pairs = new Set();
  for (let i = 0; i < m.pins.length; i++) for (let j = i + 1; j < m.pins.length; j++) {
    for (const a of m.pins[i].parts) for (const b of m.pins[j].parts) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 3 && h > 3) pairs.add([m.pins[i].id, m.pins[j].id].sort().join(" × "));
    }
  }
  return pairs;
}

async function chapterMap(page, { phone, chapter }) {
  const spec = CHAPTER_MAPS[chapter];
  await spec.open(page);
  const m = await measureMap(page);
  const label = `${chapter}${phone ? "（スマホ）" : ""}`;
  assert.equal(m.look, "neo", `${label}: 新版が効いている`);
  assert.equal(m.hud.day, spec.expect.day, `${label}: その章の地図を測っている`);
  for (const id of spec.expect.pins) assert(m.pins.some((pin) => pin.id === id), `${label}: ${id} の看板がある`);
  const tap = phone ? 72 : 48;

  // HUD: 夜紫の細い板1本。板が長くなりすぎない（上端近くの看板と居る人の顔に掛けない）。
  assert(inside(m.hud.card, STAGE) && m.hud.card.height <= (phone ? 64 : 50), `${label}: HUD は細い板 ${JSON.stringify(m.hud.card)}`);
  assert(m.hud.card.right <= (phone ? 640 : 720), `${label}: HUD の板が長くなりすぎない ${m.hud.card.right}`);
  assert(noPaperFrame(m.hud.cardFrame) && m.hud.cardFace.includes("linear-gradient") && light(m.hud.dayColor) && light(m.hud.moneyColor), `${label}: HUD は夜紫の板に白い数字`);
  for (const rect of m.hud.inside) assert(inside(rect, m.hud.card, 1), `${label}: HUD の中身が板に収まる ${JSON.stringify(rect)}`);
  assert(Math.abs(m.hud.stamina.width - 120) < 1 && Math.abs(m.hud.expBar.width - 120) < 1, `${label}: ゲージは現行と同じ長さ`);
  if (phone) {
    // 横持ちスマホは体力と Lv を1つの区画に上下2段。2つのゲージの始まりはそろう。
    assert(m.hud.expRow.top >= m.hud.staminaRow.bottom - 1 && Math.abs(m.hud.expRow.left - m.hud.staminaRow.left) < 1
      && Math.abs(m.hud.stamina.left - m.hud.expBar.left) < 1.5, `${label}: 体力と Lv は上下2段 ${JSON.stringify([m.hud.staminaRow, m.hud.expRow, m.hud.stamina, m.hud.expBar])}`);
  } else {
    assert(Math.abs(m.hud.staminaRow.top - m.hud.expRow.top) < 1 && m.hud.expRow.left >= m.hud.staminaRow.right - 1, `${label}: PC は体力と Lv が横に並ぶ`);
  }
  for (const [name, rect, radius] of [["LIME", m.hud.lime, m.hud.limeRadius], ["MENU", m.hud.menu, m.hud.menuRadius]]) {
    assert(inside(rect, STAGE) && Math.abs(rect.width - rect.height) < .5 && rect.width >= tap - .5 && rect.real >= 38 && (name === "LIME" ? !radius.includes("%") : radius === "50%"),
      `${label}: ${name} の札（MENU は丸、LIME はアプリの印の角丸四角） ${JSON.stringify(rect)} ${radius}`);
    assert(!intersects(rect, m.hud.card), `${label}: ${name} が HUD の板に重ならない`);
  }
  // 「出発まで」「勝負の日まで」: 板の下の小さな札（板を伸ばさない）。夜紫に明るい字。
  if (spec.expect.goal) {
    assert(m.hud.goal, `${label}: 残り日数の札が出ている`);
    assert.equal(m.hud.goal.text, spec.expect.goal);
    const pill = m.hud.goal.rect;
    assert(inside(pill, STAGE) && pill.top >= m.hud.card.bottom && pill.top - m.hud.card.bottom <= 10 && pill.left >= m.hud.card.left - .5 && pill.right <= m.hud.card.right,
      `${label}: 残り日数の札は板のすぐ下 ${JSON.stringify([pill, m.hud.card])}`);
    assert(m.hud.goal.value.real >= 10 && light(m.hud.goal.color) && dark(m.hud.goal.face), `${label}: 残り日数が読める ${JSON.stringify(m.hud.goal)}`);
  } else assert.equal(m.hud.goal, null, `${label}: 残り日数の札は出ない`);

  // 看板: ステージの中。帯は夜紫に白い字。HUD・LIME・MENU・残り日数の札に掛からない（居る人の顔も）。
  const fixed = [["HUD の板", m.hud.card], ["LIME", m.hud.lime], ["MENU", m.hud.menu], ...(m.hud.goal ? [["残り日数の札", m.hud.goal.rect]] : [])];
  for (const pin of m.pins) {
    for (const part of pin.parts) {
      assert(inside(part, STAGE), `${label}: ${pin.id} の${part.what}がステージの中 ${JSON.stringify(part)}`);
      for (const [name, rect] of fixed) assert(!intersects(part, rect), `${label}: ${pin.id} の${part.what}が${name}に重ならない ${JSON.stringify([part, rect])}`);
    }
    assert(pin.labelShown && pin.label && noPaperFrame(pin.band.frame), `${label}: ${pin.id} の店名の帯`);
    const off = pin.classes.includes("off") || pin.classes.includes("closed");
    const ink = pin.labelColor.slice(0, 3).reduce((sum, v) => sum + v, 0);
    assert(dark(pin.band.labelFace) && (off ? ink > 480 : light(pin.labelColor)), `${label}: ${pin.id} の帯は夜紫に白い字 ${pin.band.labelFace} / ${pin.labelColor}`);
    if (pin.cost !== null) assert(pin.costShown && /^¥[\d,]+$/.test(pin.cost), `${label}: ${pin.id} の料金`);
    if (pin.badge !== null) assert(pin.badgeShown, `${label}: ${pin.id} の「!」`);
    assert(pin.peopleShown, `${label}: ${pin.id} の居る人の顔`);
  }
  if (spec.expect.people) assert(m.pins.find((pin) => pin.id === spec.expect.people).people.length, `${label}: ${spec.expect.people} に居る人の顔がある`);

  // 現行と比べる: 情報は同じだけ残り、押せる範囲は現行以上、指す場所は同じ。看板どうしの重なりを新しく作らない。
  await setLook(page, "classic");
  await page.waitForTimeout(450);
  const classic = await measureMap(page);
  assert.equal(classic.look, "classic");
  assert.deepEqual(mapFacts(m), mapFacts(classic), `${label}: 店名・料金・「!」・休み・居る人・日付・残り・所持金・Lv・残り日数・未読数が現行と同じ`);
  assert(mapFacts(m).pins.every((pin) => pin.shown) && mapFacts(m).hud.shown, `${label}: どれも見えている`);
  assert(m.hud.lime.width >= classic.hud.lime.width - .5 && m.hud.menu.width >= classic.hud.menu.width - .5, `${label}: LIME・MENU は現行以上の大きさ`);
  for (const pin of m.pins) {
    const before = classic.pins.find((other) => other.id === pin.id);
    assert(pin.rect.width >= before.rect.width - .75 && pin.rect.height >= before.rect.height - .75, `${label}: ${pin.id} の押せる範囲は現行以上 ${JSON.stringify([pin.rect, before.rect])}`);
    assert(Math.abs((pin.rect.left + pin.rect.right) / 2 - (before.rect.left + before.rect.right) / 2) < 1, `${label}: ${pin.id} の横の位置は現行と同じ`);
    if (pin.classes.includes("facility-pin")) assert(Math.abs(pin.shield.top - before.shield.top) < 1, `${label}: ${pin.id} の施設の絵の位置は現行と同じ`);
    else assert(Math.abs(pin.rect.bottom - before.rect.bottom) < 1, `${label}: ${pin.id} の看板の下端は現行と同じ`);
  }
  const allowed = pinOverlaps(classic);
  for (const pair of pinOverlaps(m)) assert(allowed.has(pair), `${label}: 新版で新しく重なる看板 ${pair}（現行: ${[...allowed].join(", ") || "なし"}）`);
  await setLook(page, "neo");
  await page.waitForTimeout(450);

  // 行き先を選ぶと案内の板（夜紫の面）が出て、HUD・LIME・MENU に掛からない。
  const target = spec.expect.pins.find((id) => id !== "station") || spec.expect.pins[0];
  await press(page, page.locator(`[data-test="pin-${target}"]`));
  await page.locator("#screen .map .map-info.spot-selected").waitFor();
  await page.mouse.move(640, 700);
  await page.waitForTimeout(350);
  const selected = await measureMap(page);
  assert(selected.info && inside(selected.info.rect, STAGE) && noPaperFrame(selected.info.frame) && selected.info.face.includes("linear-gradient"), `${label}: 案内の板 ${JSON.stringify(selected.info)}`);
  for (const [name, rect] of [["LIME", selected.hud.lime], ["MENU", selected.hud.menu], ["HUD の板", selected.hud.card]]) assert(!intersects(selected.info.rect, rect), `${label}: 案内の板が${name}に重ならない`);
  if (spec.expect.menu) await chapterMenu(page, label, spec.expect.menu, { phone });
}

/** 章ごとに増える MENU の上の帯（「出発まで」「勝負の日まで」）と人間関係の一覧が、面に収まる。 */
async function chapterMenu(page, label, parts, { phone }) {
  await press(page, page.locator('[data-test="hud-menu"]'));
  await page.locator(".dmenu .dm-tab").nth(3).waitFor();
  await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));
  const fits = (m, tab) => {
    assert(inside(m.sheet, STAGE) && m.sheetFace.includes("gradient") && !/ui\/paper/.test(m.sheetFace) && light(m.ink), `${label} MENU ${tab}: 夜紫の面`);
    for (const part of parts) assert(m.summary.includes(part), `${label} MENU: 上の帯に ${part}（${m.summary}）`);
    for (const row of m.summaryRows) assert(inside(row, m.head, 1) && row.right <= m.close.left, `${label} MENU: 上の帯の項目が「閉じる」に掛からない ${JSON.stringify(row)}`);
    assert(!m.overflowX, `${label} MENU ${tab}: 中身が横にはみ出さない`);
    for (const block of m.blocks) assert(block.left >= m.panel.left - 1 && block.right <= m.panel.right + 1, `${label} MENU ${tab}: ${block.what} が面に収まる`);
    assert(m.close.height >= (phone ? 72 : 44) - .5 && m.close.real >= 38, `${label} MENU: 「閉じる」の押せる大きさ`);
  };
  fits(await measureMenu(page), "ステータス");
  await press(page, page.locator('[data-test="menu-tab-people"]'));
  await page.waitForFunction(() => document.querySelector(".dmenu")?.dataset.tab === "people" && document.querySelector(".dmenu .neo-figure.show img.in"), null, { timeout: 15000 });
  await page.waitForTimeout(350);
  const people = await measureMenu(page);
  fits(people, "人間関係");
  assert(people.people.length >= 3 && people.figure?.who === people.people[0].id, `${label} MENU: 人間関係の先頭の人の絵 ${people.figure?.who}`);
  for (const row of people.people.filter((row) => row.rect.bottom <= people.panel.bottom)) {
    for (const part of row.parts) assert(inside(part, row.rect, 1), `${label} MENU: ${row.id} の ${part.what} が行に収まる`);
  }
  await press(page, page.locator('[data-test="menu-close"]'));
  await page.locator(".dmenu").waitFor({ state: "detached" });
}

/** 章の場面カード（main.ch2-contest）を測る。 */
const measureCard = (page) => page.evaluate((helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  const card = document.querySelector("#screen .ch2-contest"), style = getComputedStyle(card), header = card.querySelector(".ch2-contest-header");
  const color = (node) => rgb(getComputedStyle(node).color);
  return { look: document.documentElement.dataset.look, rect: px(card), face: style.backgroundImage, fill: rgb(style.backgroundColor), border: style.borderTopWidth, color: color(card),
    heading: text(header.querySelector("p")), headingColor: color(header.querySelector("p")), title: text(header.querySelector("h1")), titleColor: color(header.querySelector("h1")),
    rule: getComputedStyle(header).backgroundImage, description: text(card.querySelector(".ch2-contest-description")),
    descriptionColor: color(card.querySelector(".ch2-contest-description")),
    wayfinding: card.querySelector(".ch3-wayfinding") ? { rect: px(card.querySelector(".ch3-wayfinding")), fill: rgb(getComputedStyle(card.querySelector(".ch3-wayfinding")).backgroundColor),
      next: rgb(getComputedStyle(card.querySelector(".ch3-wayfinding-stop.next") || card.querySelector(".ch3-wayfinding-stop")).borderLeftColor),
      strong: color(card.querySelector(".ch3-wayfinding-stop strong")) } : null,
    buttons: [...card.querySelectorAll("button")].filter(shown).map((node) => ({ test: node.dataset.test, label: text(node), ...px(node), primary: node.classList.contains("primary"),
      face: getComputedStyle(node).backgroundImage, fill: rgb(getComputedStyle(node).backgroundColor), ink: color(node), frame: getComputedStyle(node).borderImageSource })) };
}, STAGE_PX);

const gold = (color) => color[0] > 200 && color[1] > 160 && color[2] < 170;

function assertCard(m, label, classic, { phone }) {
  assert.equal(m.look, "neo", `${label}: 新版が効いている`);
  assert(inside(m.rect, STAGE), `${label}: カードがステージの中 ${JSON.stringify(m.rect)}`);
  // 紺の箱ではなく夜紫の半透明の面。見出しの下に金の細い罫線。章の名前は金、題と本文は白。
  assert(m.face.includes("linear-gradient") && m.face.includes("rgba(36, 22, 55"), `${label}: 夜紫の面 ${m.face}`);
  assert.equal(m.border, "0px", `${label}: 紺の箱の枠線を使わない`);
  assert(m.rule.includes("227, 189, 110"), `${label}: 見出しの下に金の罫線 ${m.rule}`);
  assert(gold(m.headingColor) && light(m.titleColor) && light(m.descriptionColor) && light(m.color), `${label}: 文字の色 ${JSON.stringify([m.headingColor, m.titleColor, m.descriptionColor])}`);
  assert.deepEqual([m.heading, m.title, m.description], [classic.heading, classic.title, classic.description], `${label}: 文は現行と同じ`);
  assert.deepEqual(m.buttons.map((button) => button.label), classic.buttons.map((button) => button.label), `${label}: ボタンは現行と同じ`);
  assert(m.buttons.some((button) => button.primary), `${label}: 主のボタンがある`);
  for (const [index, button] of m.buttons.entries()) {
    const before = classic.buttons[index];
    assert(inside(button, m.rect, 1) && button.real >= 38 && button.height >= before.height - 2.5 && button.width >= before.width - 2.5,
      `${label}: ${button.label} の押せる大きさは現行と同じ ${JSON.stringify([button, before])}`);
    assert(noPaperFrame(button.frame));
    // 主のボタンは金に墨の字、ほかは夜紫に白い字。
    assert(button.primary ? button.face.includes("linear-gradient") && !light(button.ink) : dark(button.fill) && light(button.ink), `${label}: ${button.label} の色 ${JSON.stringify(button)}`);
  }
  for (let i = 0; i < m.buttons.length; i++) for (let j = i + 1; j < m.buttons.length; j++) assert(!intersects(m.buttons[i], m.buttons[j]), `${label}: ボタンが重ならない`);
  if (m.wayfinding) {
    assert(inside(m.wayfinding.rect, m.rect, 1) && dark(m.wayfinding.fill.length === 4 ? [...m.wayfinding.fill.slice(0, 3), 1] : m.wayfinding.fill)
      && light(m.wayfinding.strong) && gold(m.wayfinding.next), `${label}: 東京の行程は夜紫の札、次の場面は金の線 ${JSON.stringify(m.wayfinding)}`);
  }
  if (phone) assert(m.buttons.every((button) => button.real >= 38), `${label}: スマホでも押せる大きさ`);
}

/** 第4章のドバイ到着の場面カード（第4・5章の共通のカード）。 */
async function openDubaiCard(page) {
  await loadSeeded(page, async (common) => {
    const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { naru: true });
    if (!progress.advanceToChapterFour(value)) throw new Error("第4章へ入れない");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("ドバイへ出発できない");
    await (0, eval)(common)(core, value, 4);
    Object.assign(core.state, value); core.save();
  }, SEED_COMMON);
  await page.locator('[data-test="ch4-scene"][data-scene="ch4_opening"]').waitFor({ timeout: 90000 });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
}

/** 第3章の東京の行程カード（場面カードの東京・作業中の旧セーブの行程）と、東京の街の地図。 */
async function openTokyoCard(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 25, phase: "cleared", money: 20000, stamina: 80 });
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
    if (!progress.advanceToChapterThree(value)) throw new Error("第3章へ入れない");
    value.day += 3;
    if (!progress.departChapterThree(value)) throw new Error("東京へ出発できない");
    Object.assign(value.flags._ch3_intro, { routeVersion: 2, titleSeen: true, prologueStep: 4 });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save(); core.requestResumeOnBoot();
  });
  await page.reload();
  await page.locator('[data-test="ch3-intro-scene"]').waitFor({ timeout: 90000 });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
}

async function chapterCards(page, { phone }) {
  const label = phone ? "（スマホ）" : "";
  // 第4章のドバイ到着: カードの見た目・文・ボタン。現行と比べてから、「続きを読む」で次の場面へ進む。
  await openDubaiCard(page);
  const neo = await measureCard(page);
  await setLook(page, "classic");
  await page.waitForTimeout(300);
  const classic = await measureCard(page);
  assert.equal(classic.look, "classic");
  assert(!classic.face.includes("rgba(36, 22, 55"), "現行は紺の箱のまま");
  await setLook(page, "neo");
  await page.waitForTimeout(300);
  assertCard(neo, `ドバイ到着の場面カード${label}`, classic, { phone });
  await press(page, page.locator('[data-test="ch4-continue"]'));
  await page.locator('[data-test="ch4-scene"][data-scene="ch4_arrival_inn"]').waitFor({ timeout: 60000 });

  // 第3章の東京の行程カード: 行程の札と、東京の街の地図（ステージの外のダイアログ）。
  await openTokyoCard(page);
  const tokyo = await measureCard(page);
  await setLook(page, "classic");
  await page.waitForTimeout(300);
  const tokyoClassic = await measureCard(page);
  await setLook(page, "neo");
  await page.waitForTimeout(300);
  assertCard(tokyo, `東京の行程カード${label}`, tokyoClassic, { phone });
  assert(tokyo.wayfinding, "東京の行程の札がある");
  await press(page, page.locator('[data-test="ch3-map-open"]'));
  await page.locator('[data-test="ch3-map"]').waitFor();
  await page.waitForTimeout(300);
  const dialog = await page.evaluate(() => {
    const node = document.querySelector('[data-test="ch3-map"]'), style = getComputedStyle(node), r = node.getBoundingClientRect();
    const close = node.querySelector('[data-test="ch3-map-close"]'), cr = close.getBoundingClientRect();
    return { face: style.backgroundImage, border: style.borderTopWidth, inView: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      close: { height: cr.height, inView: cr.left >= r.left - 1 && cr.right <= r.right + 1 && cr.bottom <= r.bottom + 1, fill: getComputedStyle(close).backgroundColor, ink: getComputedStyle(close).color },
      title: getComputedStyle(node.querySelector(".ch3-map-header h2")).color };
  });
  assert(dialog.face.includes("linear-gradient") && dialog.face.includes("rgba(36, 22, 55") && dialog.border === "0px" && dialog.inView, `東京の街の地図は夜紫の面${label} ${JSON.stringify(dialog)}`);
  assert(dialog.close.inView && dialog.close.height >= (phone ? 34 : 38) && dialog.title === "rgb(255, 255, 255)", `東京の街の地図の「閉じる」${label} ${JSON.stringify(dialog)}`);
  assert(dark(dialog.close.fill.match(/[\d.]+/g).slice(0, 3).map(Number)) && light(dialog.close.ink.match(/[\d.]+/g).slice(0, 3).map(Number)), `「閉じる」は夜紫の札に白い字 ${JSON.stringify(dialog.close)}`);
  await press(page, page.locator('[data-test="ch3-map-close"]'));
  await page.locator('[data-test="ch3-map"]').waitFor({ state: "detached" });
}

const CARD_PARTS = [["#screen .ch2-contest", ALL], ["#screen .ch2-contest-header", ALL], ["#screen .ch2-contest-header p", [""]], ["#screen .ch2-contest-header h1", [""]],
  ["#screen .ch2-contest-description", [""]], ["#screen .ch2-contest-actions .btn", ALL], ["#screen .ch2-contest-header .btn", ALL]];
const GOAL_MAP_PARTS = [["#hud .hud-card", ALL], ["#hud .dc-main", [""]], ["#hud .dc-meta", [""]], ["#hud .dc-row.money", ALL], ["#hud .dc-row.goal", ALL], ["#hud .dc-row.goal b", [""]],
  ["#hud .hud-stamina", ALL], ["#hud .hud-stamina .hud-bar", [""]], ["#hud .hud-exp", [""]], ["#hud .hx-lv", [""]], ["#hud .hx-bar", ALL],
  ['[data-test="pin-c_station"] .sub-label', [""]], ['[data-test="pin-c_station"] .pin-cost', [""]], ['[data-test="pin-ch5_to_dubai"]', [""]], ['[data-test="pin-ch5_to_dubai"] .shield', ALL]];

// ---------------------------------------------------------------- ショップ・LIME・レベルアップ・ギャラリー（LK05 の残り）

/** 1F ショップを開く（店の入口を経ずに売り場へ）。所持の葉と装備中の機材がある状態。 */
async function openShopCounter(page, opts = { direct: true }) {
  await page.evaluate(async (opts) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 12800, stamina: 100 });
    s.flavorStock = { mint: 15, double_apple: 50, vanilla: 20 }; s.flavors = Object.keys(s.flavorStock);
    ui.clearScreen(); hud.initHud({}); hud.showHud();
    window.lookNeoShop = (await import("./js/daily/shop.js")).openShop(opts);
  }, opts);
  await page.locator(opts.direct ? ".shop .shop-tabs" : '[data-test="shop-enter"]').waitFor();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
}

/** 売り場を測る（面・タブ・行・数量・下の帯）。 */
const measureShop = (page) => page.evaluate((helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  const root = document.querySelector("#screen .shop-paper"), style = getComputedStyle(root);
  const look = (node) => { const cs = getComputedStyle(node); return { ...px(node), face: cs.backgroundImage, fill: rgb(cs.backgroundColor), ink: rgb(cs.color), frame: cs.borderImageSource }; };
  const rows = [...root.querySelectorAll(".shop-body .shop-row.product")].filter((row) => row.getBoundingClientRect().top < root.querySelector(".shop-body").getBoundingClientRect().bottom - 30).slice(0, 4);
  return { look: document.documentElement.dataset.look, rect: px(root), face: style.backgroundImage, ink: rgb(style.color), frame: style.borderImageSource,
    head: rgb(getComputedStyle(root.querySelector(".shop-head h2")).color), rule: getComputedStyle(root.querySelector(".shop-head")).backgroundImage,
    money: text(root.querySelector(".shop-money")),
    tabs: [...root.querySelectorAll(".shop-tab")].map((node) => ({ id: node.dataset.tab, on: node.classList.contains("on"), ...look(node) })),
    rows: rows.map((row) => ({ name: text(row.querySelector(".shop-main b")), price: text(row.querySelector(".shop-price")), stock: text(row.querySelector(".shop-stock")),
      art: look(row.querySelector(".shop-product-art")), img: shown(row.querySelector(".shop-product-art img")), name_ink: rgb(getComputedStyle(row.querySelector(".shop-main b")).color),
      price_ink: rgb(getComputedStyle(row.querySelector(".shop-price")).color), rect: px(row),
      steps: [...row.querySelectorAll(".shop-step")].map((node) => ({ test: node.dataset.test, ...look(node) })) })),
    back: look(root.querySelector(".shop-back")), summary: text(root.querySelector(".shop-summary")), checkout: { ...look(root.querySelector(".shop-checkout")), disabled: root.querySelector(".shop-checkout").disabled, label: text(root.querySelector(".shop-checkout")) } };
}, STAGE_PX);

async function shopScreen(page, { phone }) {
  await openShopCounter(page);
  const m = await measureShop(page);
  // 現行の売り場（紙）と比べるために、同じ状態を現行で測り直す。
  await setLook(page, "classic");
  await page.waitForTimeout(300);
  const classic = await measureShop(page);
  await setLook(page, "neo");
  await page.waitForTimeout(300);
  assert.equal(m.look, "neo");
  assert(inside(m.rect, STAGE) && noPaperFrame(m.frame) && m.face.includes("linear-gradient") && m.face.includes("rgba(36, 22, 55"), `ショップは夜紫の面 ${m.face}`);
  assert(light(m.ink) && light(m.head) && m.rule.includes("227, 189, 110"), "店名は白、見出しの下に金の罫線");
  assert(!classic.face.includes("rgba(36, 22, 55"), "現行は紙のまま");
  // 情報（所持金・タブ・商品名・値段・所持数・購入の札）は現行と同じ。
  assert.equal(m.money, classic.money);
  assert.deepEqual(m.tabs.map((tab) => tab.id), classic.tabs.map((tab) => tab.id));
  assert.deepEqual(m.rows.map(({ name, price, stock }) => [name, price, stock]), classic.rows.map(({ name, price, stock }) => [name, price, stock]), "商品名・値段・所持数が現行と同じ");
  assert.equal(m.summary, classic.summary);
  // 押せる大きさ（タブ・− ＋・店を出る・購入）は現行以上で、ステージの中。
  for (const [index, tab] of m.tabs.entries()) {
    assert(inside(tab, m.rect, 1) && tab.width >= classic.tabs[index].width - 1 && tab.height >= classic.tabs[index].height - 1 && tab.real >= 38, `タブ ${tab.id} の大きさ ${JSON.stringify(tab)}`);
    assert(tab.on ? !light(tab.ink) && tab.face.includes("linear-gradient") : light(tab.ink), `タブ ${tab.id}: 選んだ売り場は金、ほかは白い字`);
  }
  assert(m.rows.length >= 3);
  for (const [index, row] of m.rows.entries()) {
    const before = classic.rows[index];
    assert(light(row.name_ink) && light(row.price_ink), `${row.name}: 商品名と値段は白`);
    // 商品の絵は生成りの札に載る（明るい台紙向けの絵が暗い面で沈まない）。絵そのものは出ている。
    assert(light(row.art.fill) && row.img, `${row.name}: 商品の絵の札 ${JSON.stringify(row.art)}`);
    assert(Math.abs(row.rect.height - before.rect.height) < 1, `${row.name}: 行の高さは現行と同じ`);
    for (const [k, step] of row.steps.entries()) {
      assert(step.width >= before.steps[k].width - .5 && step.height >= before.steps[k].height - .5 && step.real >= 38, `${row.name}: ${step.test} の押せる大きさ ${JSON.stringify([step, before.steps[k]])}`);
      assert(dark(step.fill) || step.fill.slice(0, 3).reduce((a, b) => a + b, 0) < 420, `${row.name}: ${step.test} は夜紫の札 ${step.fill}`);
    }
  }
  for (const key of ["back", "checkout"]) {
    assert(inside(m[key], m.rect, 1) && m[key].height >= classic[key].height - .5 && m[key].width >= classic[key].width - .5 && m[key].real >= 38, `${key} の押せる大きさ ${JSON.stringify([m[key], classic[key]])}`);
  }
  assert(light(m.back.ink) && m.checkout.disabled, "店を出るは白い字、選ぶまで購入は押せない");

  // 実際に選んで買える（＋ → 合計 → 購入）。購入の札は金。
  const before = await page.evaluate(async () => (await import("./js/core/state.js")).state.money);
  await press(page, page.locator('[data-test="buy-mint"]'));
  await press(page, page.locator('[data-test="buy-mint"]'));
  await page.mouse.move(2, 2);
  let after = await measureShop(page);
  assert(!after.checkout.disabled && after.checkout.face.includes("linear-gradient") && !light(after.checkout.ink), `購入の札は金に墨の字 ${JSON.stringify(after.checkout)}`);
  assert.match(after.checkout.label, /^2箱を購入する/);
  // 選んだ品の確認（.shop-dialog）もモーダルと同じ夜紫の面。
  await press(page, page.locator('[data-test="shop-summary"]'));
  await page.locator("#modal.show .shop-dialog").waitFor();
  await page.waitForTimeout(350);
  assertModal(await measureModal(page), "選択した商品", { phone });
  await press(page, page.locator("#modal .modal-actions button").last());
  await page.locator("#modal.show").waitFor({ state: "hidden" });
  // 商品の詳細: 葉の特徴の字と棒が暗い面の上で読める。
  await press(page, page.locator('[data-test="detail-mint"]'));
  await page.locator("#modal.show .shop-dialog").waitFor();
  await page.waitForTimeout(350);
  assertModal(await measureModal(page), "商品の詳細", { phone });
  const guide = await page.evaluate(() => {
    const label = document.querySelector("#modal .flavor-axis-label"), bar = document.querySelector("#modal .flavor-axis-track i"), art = document.querySelector("#modal .shop-detail .shop-product-art");
    const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    return { label: rgb(getComputedStyle(label).color), bar: rgb(getComputedStyle(bar).backgroundColor), art: rgb(getComputedStyle(art).backgroundColor) };
  });
  assert(light(guide.label) && gold(guide.bar) && light(guide.art), `葉の特徴は白い字に金の棒、絵は生成りの札 ${JSON.stringify(guide)}`);
  await press(page, page.locator('[data-test="shop-detail-close"]'));
  await page.locator("#modal.show").waitFor({ state: "hidden" });
  await press(page, page.locator('[data-test="shop-checkout"]'));
  await page.waitForFunction((before) => window.__remake.state.money < before, before);
  after = await measureShop(page);
  assert.equal(after.rows.find((row) => row.name.includes("ミント")).stock, "所持115g", "買った分が所持に入る");
  // 売り場を移っても同じ面（機材・くじ・売却）。くじの景品の札も夜紫。
  for (const tab of ["equip", "kuji", "sell"]) {
    await press(page, page.locator(`.shop-tab[data-tab="${tab}"]`));
    await page.waitForTimeout(250);
    const on = await page.locator(`.shop-tab[data-tab="${tab}"]`).evaluate((node) => node.classList.contains("on") && getComputedStyle(node).backgroundImage.includes("linear-gradient"));
    assert(on, `${tab} の売り場へ移れる`);
  }
  await press(page, page.locator('.shop-tab[data-tab="kuji"]'));
  const lineup = await page.locator(".kuji-lineup-item").first().evaluate((node) => ({ fill: getComputedStyle(node).backgroundColor, ink: getComputedStyle(node.querySelector(".kuji-lineup-name")).color }));
  assert(light(lineup.ink.match(/[\d.]+/g).slice(0, 3).map(Number)), `くじの景品の名前は白 ${JSON.stringify(lineup)}`);
  // 店を出る。
  await press(page, page.locator('[data-test="shop-leave"]'));
  await page.waitForFunction(() => !document.querySelector("#screen .shop-paper") || document.querySelector("#screen .shop-paper.done"));
  assert.equal(await page.evaluate(() => window.lookNeoShop.then((r) => r ?? "left")), "left");
}

/** 店の入口（1F・2F）。写真はそのまま、名前の帯と階の札が夜紫と金。 */
async function shopEntry(page, { phone }) {
  await openShopCounter(page, {});
  const entry = await page.evaluate((helpers) => {
    const { px, rgb } = (0, eval)(helpers);
    const root = document.querySelector("#screen .shop-entry");
    return { face: getComputedStyle(root).backgroundImage, floors: [...root.querySelectorAll(".shop-floor")].map((node) => ({ ...px(node), disabled: node.disabled,
      caption: rgb(getComputedStyle(node.querySelector(".shop-floor-caption b")).color), photo: px(node.querySelector(".shop-floor-picture img")) })),
    back: px(root.querySelector(".shop-back")) };
  }, STAGE_PX);
  assert(entry.face.includes("rgba(36, 22, 55"), "店の入口も夜紫の面");
  assert.equal(entry.floors.length, 2);
  for (const floor of entry.floors) assert(inside(floor, STAGE) && floor.real >= 38 && light(floor.caption) && floor.photo.height > 100, `階の札 ${JSON.stringify(floor)}`);
  assert(entry.back.real >= 38, "街に戻るが押せる");
  await press(page, page.locator('[data-test="shop-enter"]'));
  await page.locator(".shop .shop-tabs").waitFor();
  await press(page, page.locator('[data-test="shop-leave"]'));
}

/** LIME: 端末の枠・トーク一覧・トーク・返信の札。 */
const measureLime = (page) => page.evaluate((helpers) => {
  const { px, shown, text, rgb } = (0, eval)(helpers);
  const phone = document.querySelector(".phone"), chat = phone.querySelector(".lime-chat");
  const look = (node) => node && { ...px(node), fill: rgb(getComputedStyle(node).backgroundColor), face: getComputedStyle(node).backgroundImage, ink: rgb(getComputedStyle(node).color), text: text(node) };
  return { look: document.documentElement.dataset.look, phone: look(phone), header: look(phone.querySelector(".lime-header")), headerLine: getComputedStyle(phone.querySelector(".lime-header")).borderBottomColor,
    screen: rgb(getComputedStyle(chat).backgroundColor), screenFace: getComputedStyle(chat).backgroundImage, list: chat.classList.contains("list"),
    rows: [...chat.querySelectorAll(".lime-chat-row")].map((node) => ({ ...look(node), name: text(node.querySelector(".lcr-name")), nameInk: rgb(getComputedStyle(node.querySelector(".lcr-name")).color), dot: shown(node.querySelector(".lcr-dot")), tag: text(node.querySelector(".lcr-tag")) })),
    peer: [...chat.querySelectorAll(".lime-row.peer:not(.typing) .lime-bubble")].map(look), me: [...chat.querySelectorAll(".lime-row.me .lime-bubble")].map(look),
    replies: [...phone.querySelectorAll(".lime-actions .lime-reply")].filter(shown).map((node) => ({ ...look(node), ghost: node.classList.contains("ghost") })) };
}, STAGE_PX);

/** 地図の状態に、トークを2件（返事を選べる雑談・ふつうの連絡）入れておく。 */
const seedLime = (page) => page.evaluate(async () => {
  const core = await import("./js/core/state.js");
  const item = (id, sender, messages, replies = null) => ({ id, originId: id, day: core.state.day, chapter: core.state.chapter, read: false, done: false,
    replyState: replies ? "waiting" : "none", log: [], msg: { id, sender, type: "message", messages, ...(replies ? { replies } : {}) } });
  core.state.inbox.push(
    item("qa_neo_lime_chat", "tsumugi", ["……昨日の絵、少し描き足しました。", "見てもらえますか。"],
      [{ text: "もちろん、見たい", response: "……ありがとうございます。" }, { text: "また今度ね", response: "はい。" }]),
    item("qa_neo_lime_note", "minto", ["今日は新作のフレーバー入ってるよ〜！"]));
  core.save();
});

// LIME は実際のスマホのメッセージアプリをまねた画面（緑の見出し・白い一覧・緑の自分の吹き出し。台帳 DUI06・LK20）。
// わざと紫にしていないので、新版でも旧版と同じ見た目のままにする。
const LIME_LIST_PARTS = [[".phone", ALL], [".phone-status", [""]], [".lime-header", ALL], [".lime-logo", [""]], [".lime-chat", [""]], [".lime-chat-row", ALL], [".lcr-name", [""]], [".lcr-preview", [""]],
  [".lcr-side small", [""]], [".lime-actions", [""]], [".lime-reply.ghost", [""]]];
const LIME_TALK_PARTS = [[".phone", ALL], [".lime-header", ALL], [".lime-chat", [""]], [".lime-row.peer .lime-bubble", ALL], [".lime-note", [""]], [".lime-actions", [""]],
  [".lime-reply:not(.ghost)", [""]]];
const LIME_PUSH_PARTS = [["#toasts .lime-push", ALL], ["#toasts .lime-push .lp-text", [""]], ["#toasts .lime-push .lp-top", [""]], ["#toasts .lime-push .lp-icon", [""]]];
/** 計算済みスタイルから、色の定義の変数（様式ごとに違ってよい）を除く。 */
const withoutVariables = (styles) => Object.fromEntries(Object.entries(styles).map(([key, values]) =>
  [key, values && Object.fromEntries(Object.entries(values).filter(([property]) => !property.startsWith("--")))]));
/** 新版と旧版で、同じ部品の計算済みの見た目が同じこと。 */
async function assertSameAsClassic(page, parts, label) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "neo");
  const neo = withoutVariables(await stylesOf(page, parts));
  for (const [selector] of parts) assert(neo[selector] !== null, `${label}: 比べる部品がある ${selector}`);
  await setLook(page, "classic");
  await page.waitForTimeout(400);
  const classic = withoutVariables(await stylesOf(page, parts));
  await setLook(page, "neo");
  await page.waitForTimeout(400);
  for (const key of Object.keys(classic)) assert.deepEqual(neo[key], classic[key], `${label}: ${key} は新版でも旧版と同じ見た目（LIME は紫にしない）`);
}

async function limeScreen(page, { phone }) {
  await openDaily(page);
  await seedLime(page);
  await press(page, page.locator('[data-test="hud-phone"]'));
  await page.locator(".phone-overlay.show .lime-chat.list .lime-chat-row").first().waitFor();
  await page.waitForTimeout(500);
  const list = await measureLime(page);
  assert.equal(list.look, "neo");
  // 端末とトーク一覧: 緑の見出しに白い一覧（濃い字）。
  assert(inside(list.phone, STAGE) && list.list && light(list.screen), `トーク一覧の画面は白 ${list.screen}`);
  assert(/rgb\((\d+), (1[5-9]\d|2\d\d), (\d+)\)/.test(list.header.face) || (list.header.fill[1] > 150 && list.header.fill[0] < 80), `見出しは LIME の緑 ${JSON.stringify(list.header)}`);
  for (const row of list.rows) assert(!light(row.nameInk) && light(row.fill) && inside(row, list.phone, 1), `${row.name}: 白い行に濃い名前 ${JSON.stringify(row)}`);
  assert(list.rows.length >= 2 && list.rows.every((row) => row.dot), "未読の点が出る");
  await assertSameAsClassic(page, LIME_LIST_PARTS, "トーク一覧");

  // トーク: 相手の吹き出しは白に濃い字。
  await press(page, page.locator(".phone-overlay .lime-chat-row", { hasText: "つむぎ" }));
  await page.locator(".phone-overlay .lime-actions .lime-reply").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  const talk = await measureLime(page);
  assert(!talk.list && talk.peer.length >= 1, "トークの画面");
  for (const bubble of talk.peer) assert(light(bubble.fill) && !light(bubble.ink) && inside(bubble, talk.phone, 1), `相手の吹き出しは白に濃い字 ${JSON.stringify(bubble)}`);
  assert(talk.replies.filter((reply) => !reply.ghost).length >= 1, "返信の札が出る");
  for (const reply of talk.replies) assert(inside(reply, talk.phone, 1) && reply.height >= (phone ? 30 : 34), `返信の札の大きさ ${JSON.stringify(reply)}`);
  await assertSameAsClassic(page, LIME_TALK_PARTS, "トーク");
  // 返信して自分の吹き出しが出る（LIME の緑）。
  await press(page, page.locator(".phone-overlay .lime-reply:not(.ghost)", { hasText: "もちろん、見たい" }));
  await page.locator(".phone-overlay .lime-row.me .lime-bubble, .phone-overlay .lime-note").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const replied = await measureLime(page);
  assert(replied.me.length >= 1, "自分の吹き出しが出る");
  for (const bubble of replied.me) assert(bubble.fill[1] > 180 && bubble.fill[1] > bubble.fill[0] + 20 && bubble.fill[1] > bubble.fill[2] + 40 && !light(bubble.ink), `自分の吹き出しは緑に濃い字 ${JSON.stringify(bubble)}`);
  await assertSameAsClassic(page, [[".lime-row.me .lime-bubble", ALL]], "自分の吹き出し");
  await press(page, page.locator(".phone-overlay .lime-back").first()).catch(() => {});
  await page.locator(".phone-overlay .lime-chat.list").waitFor({ timeout: 15000 });
  await press(page, page.locator('[data-test="phone-close"]'));
  await page.locator(".phone-overlay").waitFor({ state: "detached" });

  // 朝の通知の札も、スマホの通知をまねた見た目のまま。
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    core.state.inbox.push({ id: "qa_neo_push", originId: "qa_neo_push", day: core.state.day, read: false, done: false, replyState: "none", log: [], msg: { sender: "minto", type: "message", messages: ["おはよ！"] } });
    (await import("./js/daily/phone.js")).pushNotice(1, { onOpen: () => {} });
  });
  await page.locator("#toasts .lime-push.show").waitFor();
  await page.waitForTimeout(500);
  const push = await page.locator("#toasts .lime-push").evaluate((node, helpers) => {
    const { px } = (0, eval)(helpers);
    return { ...px(node) };
  }, STAGE_PX);
  assert(inside(push, STAGE), `朝の通知の札がステージの中 ${JSON.stringify(push)}`);
  await assertSameAsClassic(page, LIME_PUSH_PARTS, "朝の通知");
  assert.equal(await page.evaluate(() => window.lookNeoDailyError || ""), "");
}

/** レベルアップ（経験値が届いたその場で、画面の上に出る短い札。SBD122）。 */
async function levelUp(page, { phone }) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js"), hud = await import("./js/daily/hud.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    ui.showScreen("map", document.createElement("div"));
    await ui.setBg(data.bgUrl("bg_home", "night"), { fast: true });
    hud.initHud({ phone() {}, status() {}, menu() {} });
    hud.showHud(true);
    const g = await import("./js/core/growth.js");
    g.setGrowthPreview(true);
    g.gainExp(g.totalExpFor(3) + 10);
  });
  await page.locator('[data-test="levelup"].show').waitFor();
  await page.waitForTimeout(700);
  const card = await page.locator('[data-test="levelup"]').evaluate((node, helpers) => {
    const { px, rgb } = (0, eval)(helpers);
    const plate = node.querySelector(".lvup-plate"), lv = node.querySelector(".lvup-lv b"), count = node.querySelector(".lvup-fire b");
    return { plate: { ...px(plate), face: getComputedStyle(plate).backgroundImage }, lv: { ...px(lv), ink: rgb(getComputedStyle(lv).color) }, count: px(count),
      text: plate.innerText, line: node.dataset.line, events: getComputedStyle(node).pointerEvents };
  }, STAGE_PX);
  assert(inside(card.plate, STAGE) && card.plate.face.includes("rgba(36, 22, 55"), `レベルアップの札は夜紫の面で、画面に収まる ${JSON.stringify(card.plate)}`);
  assert(light(card.lv.ink) && inside(card.lv, card.plate, 1) && inside(card.count, card.plate, 1), `レベルと火種の数は札の中 ${JSON.stringify(card)}`);
  assert(card.lv.real >= (phone ? 20 : 30) && card.count.real >= (phone ? 16 : 24), `数字は大きく ${JSON.stringify([card.lv, card.count])}`);
  assert.match(card.text, /LEVEL UP[\s\S]*Lv\.3[\s\S]*×4/);
  assert.equal(card.line, "LEVEL UP Lv.3　白火 ＋4");
  assert.equal(card.events, "none", "押せない飾り（操作を止めない）");
  assert.equal(await page.locator('.levelup-backdrop, .levelup-band, [data-test="levelup-ok"]').count(), 0, "止めて見せる画面は無い");
  await page.locator('[data-test="levelup"]').waitFor({ state: "detached", timeout: 15000 });
}

/** ギャラリー（タイトルから）。一覧の面・タブ・閉じる・閲覧の帯。 */
const measureGallery = (page) => page.evaluate((helpers) => {
  const { px, rgb, text } = (0, eval)(helpers);
  const box = document.querySelector(".gal"), look = (node) => ({ ...px(node), face: getComputedStyle(node).backgroundImage, fill: rgb(getComputedStyle(node).backgroundColor), ink: rgb(getComputedStyle(node).color), text: text(node) });
  return { look: document.documentElement.dataset.look, box: look(box), frame: getComputedStyle(box).borderImageSource, title: rgb(getComputedStyle(box.querySelector("h2")).color),
    rule: getComputedStyle(box.querySelector(".gal-head")).backgroundImage, rate: text(box.querySelector(".gal-rate")),
    tabs: [...box.querySelectorAll(".gal-tab")].map((node) => ({ ...look(node), selected: node.getAttribute("aria-selected") === "true" })), close: look(box.querySelector(".gal-close")),
    cells: [...box.querySelectorAll(".gal-cell")].slice(0, 8).map((node) => ({ ...px(node), locked: node.classList.contains("locked"), text: text(node) })) };
}, STAGE_PX);

async function galleryScreen(page, { phone }) {
  await page.evaluate(() => localStorage.setItem("suien_remake_gallery", JSON.stringify(["cg_ch1_sumi_training"])));
  await press(page, page.locator('[data-test="title-gallery"]'));
  await page.locator(".gal").waitFor();
  await page.waitForTimeout(500);
  const m = await measureGallery(page);
  await setLook(page, "classic");
  await page.waitForTimeout(300);
  const classic = await measureGallery(page);
  await setLook(page, "neo");
  await page.waitForTimeout(300);
  assert.equal(m.look, "neo");
  assert(inside(m.box, STAGE) && noPaperFrame(m.frame) && m.box.face.includes("rgba(36, 22, 55") && light(m.box.ink) && light(m.title), `ギャラリーは夜紫の面 ${JSON.stringify(m.box)}`);
  assert(m.rule.includes("227, 189, 110"), "見出しの下に金の罫線");
  // 収集率・タブ・枠の中身は現行と同じ。押せる大きさも同じ。
  assert.equal(m.rate, classic.rate);
  assert.deepEqual(m.tabs.map((tab) => tab.text), classic.tabs.map((tab) => tab.text));
  assert.deepEqual(m.cells.map(({ locked, text }) => [locked, text]), classic.cells.map(({ locked, text }) => [locked, text]));
  for (const [index, tab] of m.tabs.entries()) {
    assert(tab.width >= classic.tabs[index].width - .5 && tab.height >= classic.tabs[index].height - .5 && inside(tab, m.box, 1), `タブ ${tab.text} の大きさは現行以上`);
    assert(tab.selected ? tab.face.includes("linear-gradient") && !light(tab.ink) : dark(tab.fill) && light(tab.ink), `タブ ${tab.text}: 選んだ札は金、ほかは夜紫に白い字`);
  }
  assert(m.close.height >= classic.close.height - .5 && light(m.close.ink), "閉じるの大きさと色");
  for (const [index, cell] of m.cells.entries()) assert(Math.abs(cell.width - classic.cells[index].width) < 1 && Math.abs(cell.height - classic.cells[index].height) < 1, "枠の大きさは現行と同じ");
  // タブが押せる。見た絵を開くと閲覧の帯（夜紫）、絵はそのまま。
  await press(page, page.locator('[data-test="gallery-tab-cheki"]'));
  assert(await page.locator('[data-test="gallery-tab-cheki"]').evaluate((node) => node.getAttribute("aria-selected") === "true"));
  await press(page, page.locator('[data-test="gallery-tab-all"]'));
  await press(page, page.locator(".gal button.gal-cell").first());
  await page.locator(".gal-viewer.show").waitFor();
  await page.waitForTimeout(400);
  const viewer = await page.evaluate((helpers) => {
    const { px, rgb } = (0, eval)(helpers);
    const tools = document.querySelector(".gal-viewer-tools"), button = tools.querySelector(".btn");
    return { tools: { ...px(tools), face: getComputedStyle(tools).backgroundImage }, button: { ...px(button), ink: rgb(getComputedStyle(button).color), fill: rgb(getComputedStyle(button).backgroundColor) },
      content: getComputedStyle(document.querySelector(".gal-viewer")).backgroundColor };
  }, STAGE_PX);
  assert(viewer.tools.face.includes("227, 189, 110") && light(viewer.button.ink) && dark(viewer.button.fill) && viewer.button.real >= (phone ? 30 : 30), `閲覧の帯 ${JSON.stringify(viewer)}`);
  await press(page, page.locator(".gal-viewer-tools .btn").last());
  await page.locator(".gal-viewer.show").waitFor({ state: "hidden" });
  await press(page, page.locator('[data-test="gallery-close"]'));
  await page.locator(".gal-overlay").waitFor({ state: "detached" });
}

const SHOP_PARTS = [["#screen .shop-paper", ALL], ["#screen .shop-head", ALL], ["#screen .shop-head h2", [""]], ["#screen .shop-money", [""]], ['#screen .shop-tab[data-tab="flavor"]', ALL],
  ['#screen .shop-tab[data-tab="equip"]', [""]], ["#screen .shop-filter.on", [""]], ["#screen .shop-row.product", ALL], ["#screen .shop-row.product .shop-product-art", [""]],
  ["#screen .shop-row.product .shop-main b", [""]], ["#screen .shop-row.product .shop-price", [""]], ["#screen .shop-row.product .shop-step.plus", ALL], ["#screen .shop-foot", [""]],
  ["#screen .shop-back", [""]], ["#screen .shop-checkout", [""]]];
const LIME_PARTS = [[".phone", ALL], [".phone-status", [""]], [".lime-header", [""]], [".lime-logo", [""]], [".lime-chat", [""]], [".lime-chat-row", [""]], [".lcr-name", [""]], [".lcr-preview", [""]],
  [".lime-actions", [""]], [".lime-reply", [""]]];
const GALLERY_PARTS = [[".gal-overlay", [""]], [".gal", ALL], [".gal-head", [""]], [".gal-head h2", [""]], [".gal-tab[aria-selected=\"true\"]", [""]], [".gal-tab[aria-selected=\"false\"]", [""]],
  [".gal-close", [""]], [".gal-cell.locked", [""]], [".gal-cell.locked span", [""]]];

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

  // 場所の光（BGU01）: 背景の絵から立ち絵へ重ねる色を決める。暗い店では少し暗く・その店の色へ寄せ、明るい場所ではほぼそのまま。
  // 会話の途中で背景が替われば、色も替わる。色の規則そのものは test/neo_ambient.mjs。
  await check("place-light-follows-background", async (page) => {
    const script = { dialogue_id: "__look_neo_place_light", lines: [
      { speaker: "minto", face: "normal", text: "夜のとなりは落ち着くね。" },
      { type: "bg", bg: "res://assets/backgrounds/bg_dubai_cafe_day.png" },
      { speaker: "minto", face: "smile", text: "こっちは明るい！" },
      { type: "bg", bg: "res://assets/backgrounds/bg_dubai_cafe_day.png" },
      { speaker: "minto", face: "normal", text: "夜になったね。" },
    ] };
    // 時間帯（昼＝0・夜＝1）。夜は、夜の絵が無い場所の昼の絵に夜の色調補正（data-tint="night"）が掛かる。
    const setSlot = (slot) => page.evaluate(async (slot) => { (await import("./js/core/state.js")).state.slot = slot; }, slot);
    const changed = (before) => page.waitForFunction((before) => {
      const now = document.getElementById("vn").style.getPropertyValue("--neo-amb");
      return now && now !== before;
    }, `rgb(${before.join(", ")})`);
    const read = () => page.evaluate(() => /^rgb\((\d+), (\d+), (\d+)\)$/.exec(document.getElementById("vn").style.getPropertyValue("--neo-amb"))?.slice(1).map(Number) || null);
    const painted = () => page.evaluate(() => getComputedStyle(document.querySelector(".vn-portraits > .neo-amb")).backgroundColor);
    await start(page, script);
    await page.waitForFunction(() => document.getElementById("vn").style.getPropertyValue("--neo-amb"));
    const dark = await read();
    assert(dark, "夜の店内: 場所の光の色が決まる");
    assert(Math.max(...dark) < 250 && Math.min(...dark) >= 128, `夜の店内: 人物を少し暗くする（暗くしすぎない） ${dark}`);
    assert(dark[0] >= dark[1] && dark[1] >= dark[2] && dark[0] > dark[2], `暖色の店内: 暖色へ寄せる ${dark}`);
    await page.waitForTimeout(700); // 色の移り変わり（0.6 秒）
    assert.equal(await painted(), `rgb(${dark.join(", ")})`, "層に色が乗る");

    await setSlot(0);
    await advance(page, "こっちは明るい");
    await changed(dark);
    const bright = await read();
    assert(Math.min(...bright) >= 235, `明るい昼のカフェ: 人物はほぼそのまま ${bright}`);
    await page.waitForTimeout(700);
    assert.equal(await painted(), `rgb(${bright.join(", ")})`, "背景が替わると層の色も替わる");
    assertLayout(await measure(page), "背景が替わった後");

    // 同じ絵でも、夜の色調補正が掛かれば人物も暗く・紺へ寄る。
    await setSlot(1);
    await advance(page, "夜になったね");
    await changed(bright);
    const night = await read();
    assert.equal(await page.evaluate(() => document.querySelector("#bg > .bg-img:last-child").dataset.tint), "night", "昼の絵に夜の色調補正が掛かっている");
    assert(Math.max(...night) < Math.min(...bright) && night[2] >= night[0], `夜の色調補正: 昼より暗く、紺へ寄る ${night}`);
  }, { pageEntry: NEO });

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

  // ---- 第2〜5章（LK13）: 地図と HUD・MENU、章の場面カード、旧版へ戻した時の痕跡（PC と横持ちスマホ）
  for (const chapter of Object.keys(CHAPTER_MAPS)) {
    await check(`chapter-map-${chapter}-desktop`, (page) => chapterMap(page, { phone: false, chapter }), { pageEntry: NEO });
    await check(`chapter-map-${chapter}-phone`, onPhone((page, options) => chapterMap(page, { ...options, chapter })), { pageEntry: NEO, ...PHONE });
  }
  await check("chapter-cards-desktop", (page) => chapterCards(page, { phone: false }), { pageEntry: NEO });
  await check("chapter-cards-phone", onPhone(chapterCards), { pageEntry: NEO, ...PHONE });
  await check("restore-classic-chapters", async (page) => {
    touchPages.add(page);
    // 最初から現行で、第4章の場面カードと第5章の地図（残り日数の行・スマホの HUD）を出し、基準を取る。
    const roundTrip = async (parts, changed) => {
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
      assert.deepEqual(await neoTraces(page), []);
      const before = await stylesOf(page, parts);
      for (const [selector] of parts) assert(before[selector] !== null, `基準の部品がある: ${selector}`);
      await setLook(page, "neo");
      await page.waitForTimeout(600);
      const neo = await stylesOf(page, parts);
      for (const key of changed) assert.notDeepEqual(neo[key], before[key], `新版では ${key} が変わる`);
      await setLook(page, "classic");
      await page.waitForTimeout(600);
      assert.deepEqual(await neoTraces(page), [], "現行へ戻したら、足した要素・クラス・style を残さない");
      const after = await stylesOf(page, parts);
      for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${key} の計算済みスタイルが最初から現行の時と一致する`);
    };
    await openDubaiCard(page);
    await roundTrip(CARD_PARTS, ["#screen .ch2-contest", "#screen .ch2-contest-header", "#screen .ch2-contest-actions .btn"]);
    await CHAPTER_MAPS.ch5.open(page);
    await roundTrip(GOAL_MAP_PARTS, ["#hud .hud-card", "#hud .dc-meta", "#hud .dc-row.goal", '[data-test="pin-c_station"] .sub-label']);
  }, { pageEntry: `${baseURL}?look=classic`, ...PHONE });

  // ---- ショップ・LIME・レベルアップ・ギャラリー（LK05 の残り）
  await check("shop-desktop", (page) => shopScreen(page, { phone: false }), { pageEntry: NEO });
  await check("shop-phone", onPhone(shopScreen), { pageEntry: NEO, ...PHONE });
  await check("shop-entry-desktop", (page) => shopEntry(page, { phone: false }), { pageEntry: NEO });
  await check("shop-entry-phone", onPhone(shopEntry), { pageEntry: NEO, ...PHONE });
  await check("lime-desktop", (page) => limeScreen(page, { phone: false }), { pageEntry: NEO });
  await check("lime-phone", onPhone(limeScreen), { pageEntry: NEO, ...PHONE });
  await check("levelup-desktop", (page) => levelUp(page, { phone: false }), { pageEntry: NEO });
  await check("levelup-phone", onPhone(levelUp), { pageEntry: NEO, ...PHONE });
  await check("gallery-desktop", (page) => galleryScreen(page, { phone: false }), { pageEntry: NEO });
  await check("gallery-phone", onPhone(galleryScreen), { pageEntry: NEO, ...PHONE });
  await check("restore-classic-extras", async (page) => {
    // 最初から現行で、ショップ・LIME・ギャラリーを開いて基準を取り、新版→現行と往復しても計算済みスタイルと痕跡が戻ること。
    const roundTrip = async (parts, changed) => {
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
      assert.deepEqual(await neoTraces(page), []);
      const before = await stylesOf(page, parts);
      for (const [selector] of parts) assert(before[selector] !== null, `基準の部品がある: ${selector}`);
      await setLook(page, "neo");
      await page.waitForTimeout(500);
      const neo = await stylesOf(page, parts);
      for (const key of changed) assert.notDeepEqual(neo[key], before[key], `新版では ${key} が変わる`);
      await setLook(page, "classic");
      await page.waitForTimeout(500);
      assert.deepEqual(await neoTraces(page), [], "現行へ戻したら、足した要素・クラス・style を残さない");
      const after = await stylesOf(page, parts);
      for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${key} の計算済みスタイルが最初から現行の時と一致する`);
    };
    await page.evaluate(() => localStorage.setItem("suien_remake_gallery", JSON.stringify(["cg_ch1_sumi_training"])));
    await page.locator('[data-test="title-gallery"]').click();
    await page.locator(".gal").waitFor();
    await roundTrip(GALLERY_PARTS, [".gal", ".gal-tab[aria-selected=\"true\"]", ".gal-close"]);
    await page.locator('[data-test="gallery-close"]').click();
    await page.locator(".gal-overlay").waitFor({ state: "detached" });
    await openShopCounter(page);
    await roundTrip(SHOP_PARTS, ["#screen .shop-paper", '#screen .shop-tab[data-tab="flavor"]', "#screen .shop-row.product .shop-step.plus", "#screen .shop-checkout"]);
    await page.locator('[data-test="shop-leave"]').click();
    await openDaily(page);
    await seedLime(page);
    await page.locator('[data-test="hud-phone"]').click();
    await page.locator(".phone-overlay.show .lime-chat-row").first().waitFor();
    await page.waitForTimeout(500);
    // LIME は新版でも見た目を変えない（往復しても、途中の新版でも、最初の旧版と同じ）。
    await roundTrip(LIME_PARTS, []);
    await setLook(page, "neo");
    await page.waitForTimeout(500);
    const limeBefore = withoutVariables(await stylesOf(page, LIME_PARTS));
    await setLook(page, "classic");
    await page.waitForTimeout(500);
    const limeAfter = withoutVariables(await stylesOf(page, LIME_PARTS));
    for (const key of Object.keys(limeAfter)) assert.deepEqual(limeBefore[key], limeAfter[key], `${key}: LIME は新版でも旧版と同じ見た目`);
  }, { pageEntry: `${baseURL}?look=classic` });

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
