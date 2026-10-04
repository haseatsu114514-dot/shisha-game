// 選択肢とLIMEの返信が1行に収まるかを実ブラウザで測る（GUI22・ゲームは進めないので速い）。
// サーバーを8123で起動後: node remake/test/choice_oneline.mjs
// 文言の字数は tools/lint_dialogue.py（選択肢は全角26字まで）でも見ている。こちらは実際の書体・CSSで測る
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');

  // 会話の選択肢（台詞JSON・バイトの対応・恋人の会話）を全部、本物の選択肢の枠に並べて測る
  const measure = () => [...document.querySelectorAll(".vn-choices .vn-choice")].map((b) => {
    const cs = getComputedStyle(b);
    const range = document.createRange(); range.selectNodeContents(b);
    const k = b.getBoundingClientRect().width / b.offsetWidth;
    const inner = b.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) * k;
    const lines = range.getClientRects().length && Math.round(range.getBoundingClientRect().height / (parseFloat(cs.lineHeight) * k || parseFloat(cs.fontSize) * 1.5 * k));
    return { text: b.textContent, size: parseFloat(cs.fontSize), fits: range.getBoundingClientRect().width <= inner + 0.5, lines };
  });
  const texts = await page.evaluate(async () => {
    const { DB } = await import("./js/core/data.js");
    const out = new Set();
    const walk = (o) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o.choices)) o.choices.forEach((c) => typeof c?.text === "string" && out.add(c.text));
      for (const k of ["optA", "optB"]) if (typeof o[k]?.text === "string") out.add(o[k].text);
      Object.values(o).forEach(walk);
    };
    walk(DB.dialogues); walk(DB.baito); walk(DB.lover); walk(DB.friends);
    return [...out];
  });
  assert(texts.length > 100, `選択肢が少なすぎる（${texts.length}件）＝読み込みに失敗している`);
  const show = (choices) => page.evaluate(async (list) => {
    const vn = await import("./js/vn/engine.js");
    vn.play({ dialogue_id: "__choice_oneline", lines: [{ type: "choice", choices: list.map((text) => ({ text })) }] });
  }, choices);
  await show(texts);
  await page.waitForSelector(".vn-choices.show .vn-choice");
  const rows = await page.evaluate(measure);
  assert.equal(rows.length, texts.length);
  const bad = rows.filter((r) => r.size !== 24 || !r.fits);
  assert.deepEqual(bad.map((r) => r.text), [], `選択肢が1行の枠に入らない（全角26字まで）:\n${bad.map((r) => `  ${r.text}`).join("\n")}`);

  // 保険: 差し込み等で長くなった選択肢は、2行にせず字を縮めて1行に収める
  await page.evaluate(() => document.querySelector(".vn-choice").click());
  await page.waitForFunction(() => !document.querySelector(".vn-choices.show"));
  const long = "この選択肢はわざと長くした文言で、枠の幅を少しだけ超えてしまう"; // 全角30字
  await show([long, "短い選択肢"]);
  await page.waitForSelector(".vn-choices.show .vn-choice");
  const [shrunk, short] = await page.evaluate(measure);
  assert(shrunk.size < 24 && shrunk.size >= 18 && shrunk.fits && shrunk.lines === 1, `長い選択肢が1行に縮まない: ${JSON.stringify(shrunk)}`);
  assert(short.size === 24 && short.lines === 1, "短い選択肢まで縮んでいる");
  await page.evaluate(() => document.querySelector(".vn-choice").click());

  // LIMEの返信ボタン（スマホの枠の中・14px）も1行に入る長さか
  const lime = await page.evaluate(async () => {
    const { DB } = await import("./js/core/data.js");
    const texts = new Set();
    const walk = (o) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o.replies)) o.replies.forEach((r) => r && texts.add(r.label || r.text));
      // 誘いに乗る返事は「（行動を1回使う）」付き。{privateWhen} は phone.js が「午後」か「仕事のあと」に置き換える
      if (typeof o.accept_text === "string") texts.add(`${o.accept_text.replace("{privateWhen}", "仕事のあと")}（行動を1回使う）`);
      Object.values(o).forEach(walk);
    };
    walk(DB.lime); walk(DB.friends); walk(DB.lover);
    // phone.js の誘いの既定の返事
    ["行きます！（行動を1回使う）", "すみません、先に別の約束があって……", "ごめん、先に別の約束をしてしまった",
      "すみません、今日は難しいです……", "あとで返事する（トーク一覧へ）", "（今日はもう別の約束がある）"].forEach((t) => texts.add(t));
    const overlay = document.createElement("div"); overlay.className = "phone-overlay show";
    const phone = document.createElement("div"); phone.className = "phone";
    const actions = document.createElement("div"); actions.className = "lime-actions";
    phone.append(actions); overlay.append(phone); document.querySelector("#stage").append(overlay);
    const button = document.createElement("button"); button.className = "lime-reply"; actions.append(button);
    const cs = getComputedStyle(button);
    const inner = button.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const k = button.getBoundingClientRect().width / button.offsetWidth;
    const over = [];
    for (const t of texts) {
      button.textContent = t;
      const range = document.createRange(); range.selectNodeContents(button);
      if (range.getBoundingClientRect().width / k > inner + 0.5) over.push(t);
    }
    overlay.remove();
    return { count: texts.size, over };
  });
  assert(lime.count > 30, `LIMEの返信が少なすぎる（${lime.count}件）`);
  assert.deepEqual(lime.over, [], `LIMEの返信が1行に入らない:\n${lime.over.map((t) => `  ${t}`).join("\n")}`);
  assert.deepEqual(errors, []);
  console.log(`OK choice_oneline: 選択肢${texts.length}件・LIMEの返信${lime.count}件が1行に収まる／長い文言は縮めて1行`);
} finally {
  await browser.close();
}
