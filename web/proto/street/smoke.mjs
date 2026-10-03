// 通りの試作（web/proto/street/）のスモークテスト。本編のテスト一覧には入れない（試作専用）。
//   python3 -m http.server 8123   # リポジトリルートで
//   node web/proto/street/smoke.mjs
// 1回目は生成画像で、2回目は画像を全部404にした仮素材で、同じ流れを最後まで通す。
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/";
const PAGE = `${BASE}web/proto/street/index.html`;
let failed = 0;
const ok = (cond, label, detail = "") => {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
};

const browser = await chromium.launch({ headless: true });

async function run(label, { blockImages }) {
  console.log(`\n== ${label}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (blockImages) {
    await page.route(/assets\/proto_(street|walk)\//, (route) => route.fulfill({ status: 404, body: "" }));
  }
  const st = () => page.evaluate(() => window.__street.state());
  const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 8000 });
  const idle = () => until(() => !window.__street.state().busy);
  const press = async (key, ms = 0) => {
    await page.keyboard.down(key);
    if (ms) await page.waitForTimeout(ms);
    await page.keyboard.up(key);
  };
  // メッセージを最後まで送る
  const readAll = async () => {
    const seen = [];
    for (let i = 0; i < 10 && (await st()).msg; i++) {
      seen.push((await st()).msg);
      await press("KeyZ");             // 1回目: 全文表示
      await page.waitForTimeout(40);
      if ((await st()).msg === seen[seen.length - 1]) await press("KeyZ"); // 2回目: 次へ
      await page.waitForTimeout(40);
    }
    return seen;
  };

  await page.goto(`${PAGE}?reset=1`);
  await until(() => window.__street && window.__street.state().ready);
  let s = await st();
  ok(s.mode === "map", "最初はエリアマップ", s.mode);
  ok(blockImages ? s.missing.length > 0 : s.missing.length === 0, blockImages ? "画像なし→仮素材" : "生成画像を全部読めた", s.missing.join(",") || "なし");
  ok(await page.locator(".pin.off").count() >= 3, "他のエリアは準備中");

  // 1) エリアマップ → 繁華街
  await page.click(".pin.on");
  await until(() => window.__street.state().mode === "walk");
  await idle();
  s = await st();
  ok(s.x < 40, "通りの左端に降り立つ", `x=${s.x}`);

  // 2) 右へ2秒 → カメラが動く
  await press("ArrowRight", 2000);
  s = await st();
  ok(s.camX > 0 && s.x > 100, "右へ歩くとカメラが横に追従", `x=${s.x} camX=${s.camX}`);

  // 3) 歩ける帯から出られない（上下に押し続ける）
  await press("ArrowUp", 900);
  const top = (await st()).y;
  await press("ArrowDown", 1200);
  const bottom = (await st()).y;
  ok(top >= 117 && bottom <= 152, "歩ける帯の中に収まる", `y ${top}〜${bottom}`);

  // 4) ベンチの奥と手前を通れる（奥: y=119 / 手前: y=146 で左右に横切る。x=254 は自販機のすぐ右）
  for (const [y, name] of [[119, "奥"], [146, "手前"]]) {
    await page.evaluate((yy) => window.__street.place(254, yy, "right"), y);
    await press("ArrowRight", 900);
    s = await st();
    ok(s.x > 290, `ベンチの${name}を横切れる`, `x=${s.x} y=${s.y}`);
  }
  // ベンチの正面から上へは進めない（ぶつかる）
  await page.evaluate(() => window.__street.place(268, 140, "up"));
  await press("ArrowUp", 800);
  s = await st();
  ok(s.y > 126, "ベンチには正面からぶつかる", `y=${s.y}`);

  // 5) しらべる（ベンチ）
  ok(s.focus === "object:bench", "ベンチの前で「！」の対象になる", s.focus);
  await press("KeyZ");
  await page.waitForTimeout(80);
  let lines = await readAll();
  ok(lines.some((l) => l.startsWith("木のベンチ")), "ベンチをしらべる", lines[0]);

  // 6) 通行人（大学生）に話す → 振り向く → 2回目は別の台詞
  await page.evaluate(() => window.__street.place(334, 140, "up"));
  await page.waitForTimeout(60);
  s = await st();
  ok(s.focus === "npc:mob_student", "大学生が対象になる", s.focus);
  await press("KeyZ");
  await page.waitForTimeout(80);
  s = await st();
  const student = s.npcs.find((n) => n.id === "mob_student");
  ok(student.dir === "down" && student.talking, "話しかけると大学生がこちらを向く", student.dir);
  lines = await readAll();
  ok(lines[0] && lines[0].includes("SNSで見て来た"), "大学生の1回目", lines[0]);
  await press("KeyZ");
  await page.waitForTimeout(80);
  lines = await readAll();
  ok(lines[0] && lines[0].includes("写真映え"), "大学生の2回目以降", lines[0]);

  // 7) タップ: 自販機を押すと前まで歩いてしらべる
  await page.evaluate(() => window.__street.place(160, 140, "right"));
  await page.waitForTimeout(400);
  const vend = await page.evaluate(() => {
    const s = window.__street.state();
    return { x: (236 - s.camX) * 4, y: (118 - 18) * 4 };
  });
  await page.mouse.click(vend.x, vend.y);
  await until(() => !!window.__street.state().msg);
  s = await st();
  ok(s.msg && s.msg.startsWith("自販機"), "自販機をタップ→歩いてしらべる", s.msg);
  await readAll();

  // 8) 入店→外に出る（KEMURIKUSA）
  await page.evaluate(() => window.__street.warp("kemurikusa"));
  await page.waitForTimeout(60);
  ok((await st()).focus === "door:kemurikusa", "KEMURIKUSAの入口が対象になる");
  await press("KeyZ");
  await until(() => window.__street.state().mode === "interior" && !!window.__street.state().msg);
  s = await st();
  ok(s.interior === "kemurikusa" && s.msg.startsWith("KEMURIKUSAに入った"), "店内に入る", s.msg);
  lines = await readAll();
  ok(lines.length === 2 && lines[1].includes("（試作）"), "入店メッセージ2行", String(lines.length));
  await page.waitForSelector("#btn-out:not(.hidden)");
  await press("KeyZ");
  await until(() => window.__street.state().mode === "walk");
  await idle();
  s = await st();
  ok(s.dir === "down" && Math.abs(s.x - 788.5) < 2 && s.visited.kemurikusa, "外に出ると入口の前（下向き）", `x=${s.x} dir=${s.dir}`);

  // 9) ファストトラベル: 訪問済みだけ選べる
  await press("KeyM");
  await until(() => window.__street.state().mode === "menu");
  s = await st();
  const labels = s.travel.map((t) => `${t.label}${t.off ? "(×)" : ""}`).join(" / ");
  ok(s.travel[0].label === "通りの入口" && !s.travel[0].off, "通りの入口はいつでも選べる", labels);
  ok(s.travel.filter((t) => t.off && t.label === "？？？").length === 2, "未訪問の2店は？？？で選べない", labels);
  await page.click('#travel li:has-text("通りの入口")');
  await until(() => window.__street.state().mode === "walk" && !window.__street.state().busy);
  ok((await st()).x < 40, "通りの入口へ移動");
  await press("KeyM");
  await until(() => window.__street.state().mode === "menu");
  await page.click("#travel li[data-door='kemurikusa']");
  await until(() => window.__street.state().mode === "walk" && !window.__street.state().busy);
  s = await st();
  ok(Math.abs(s.x - 788.5) < 2, "訪問済みのKEMURIKUSAの前へ移動", `x=${s.x}`);

  // 10) 左端からエリアマップへ戻る
  await page.evaluate(() => window.__street.place(30, 132, "left"));
  await press("ArrowLeft", 800);
  await until(() => window.__street.state().mode === "map");
  ok(true, "左端へ歩くとエリアマップへ戻る");
  await idle();

  // 11) 訪問記録は残る／?reset=1 で消える
  await page.goto(PAGE);
  await until(() => window.__street && window.__street.state().ready);
  ok((await st()).visited.kemurikusa === true, "再読み込み後も訪問記録が残る");
  await page.goto(`${PAGE}?reset=1`);
  await until(() => window.__street && window.__street.state().ready);
  ok(!(await st()).visited.kemurikusa, "?reset=1 で訪問記録が消える");

  // 12) 夜
  await page.goto(`${PAGE}?night=1&area=hankagai`);
  await until(() => window.__street && window.__street.state().mode === "walk");
  await page.waitForTimeout(200);
  ok((await st()).night, "?night=1 で夜の通り");

  ok(errors.length === 0, "ページのエラーなし", errors.join(" | "));
  await page.close();
}

await run("生成画像", { blockImages: false });
await run("仮素材（画像なし）", { blockImages: true });

// 歩行テストのページも動く（生成画像に切り替わっている）
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}web/proto/walk/index.html`);
  await page.waitForFunction(() => window.__walk && window.__walk.state().source[32] === "image", null, { timeout: 8000 }).catch(() => {});
  const s = await page.evaluate(() => window.__walk.state());
  console.log("\n== 歩行テスト");
  ok(s.source[32] === "image" && s.source[48] === "image", "歩行テストが生成画像で動く", JSON.stringify(s.source));
  ok(errors.length === 0, "歩行テストのエラーなし", errors.join(" | "));
  await page.close();
}

await browser.close();
console.log(failed ? `\n${failed} 件失敗` : "\n全部OK");
process.exit(failed ? 1 : 0);
