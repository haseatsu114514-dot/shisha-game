// プリクラの「自分でらくがき」（要望台帳 VPO22）。2026-11-28 オーナー「自分でスマホのキーボードで文字入れたり好きにやれるようにもしたい。
// フォントや色とかも選べて　こだわりたい人は　スタンプ入れたりとか」→ 確認の答え「落書き無しの写真を作り直す」「2回目以降の撮影だけ」。
// 続けて「らくがきの時点で立ち絵ではなく文字が入ってない版のそのプリにする／背景選んだりプリクラらしさも入れたい」（VPO24・VPO25）。
// 確かめること:
//   背景: 描く画面は「背景をえらんでね♪」から始まり、柄を2コマとも／上のコマ／下のコマに敷ける。グリーンバックで抜いた写真の後ろに敷く。
//         もじ・スタンプ・ペンに移ると「らくがきタイム♪」と残り時間の札が出る。「できた！」で「プリント中♪」のあと閉じる。
//   縦持ち: 描く画面（daily/purikura-studio.js）が縦の舞台（#vt-motion）に縦の並べ方で出て、写真・道具・ボタンが画面に収まり、押す所が小さすぎない。
//           文字（キーボードで入力・Enter で置く・書体・色・ふち）、スタンプ、指でずらす、大きさ、消す、ペン、1つ戻すが効き、「できた！」で落書きの中身が返る。
//   横持ち: 本編のステージ（#fx）に横の並べ方で出て、ステージに収まる。「あげはにおまかせ」は null。
//   本編: 2回目からの撮影の受け取りで「自分でらくがき」→ 描く → 受け取りの写真が落書き無しの写真＋自分の落書きになり、「らくがきし直す」は前の落書きから、
//         「おまかせに戻す」で今の写真に戻る。受け取ると撮影の記録に落書きが残り、ギャラリーの一覧と拡大表示でも自分の落書きで見え、おまかせの絵にも切り替えられる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const withLook = (look) => `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=${look}`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const t = (id) => `[data-test="${id}"]`;
const CG = "cg_purikura_ageha_gyarupi";

const openStudio = (page, opts = {}) => page.evaluate(async ({ cg, opts }) => {
  const { purikuraKey } = await import("./js/core/purikura-data.js");
  window.__pks = import("./js/daily/purikura-studio.js").then((m) => m.openPurikuraStudio({ photo: purikuraKey(cg), title: "今日のプリクラ", ...opts }));
}, { cg: CG, opts });
const inside = (box, area, slack = 1) => box && box.x >= area.x - slack && box.y >= area.y - slack
  && box.x + box.width <= area.x + area.width + slack && box.y + box.height <= area.y + area.height + slack;

/** 写真の上の物（文字・スタンプ）を、指でずらす */
async function dragItem(page, index, dx, dy) {
  const box = await page.locator(`${t("pks-layer")} .pkd-item[data-index="${index}"]`).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
  await page.mouse.up();
}
async function drawLine(page) {
  const box = await page.locator(t("pks-layer")).boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * (0.7 + (i % 2) * 0.03));
  await page.mouse.up();
}

await suite("purikura-studio", async (check) => {
  await check("portrait-studio-text-stamp-pen", async (page) => {
    await page.waitForFunction(() => window.__verticalLook?.scene?.() === "title", null, { timeout: 20000 });
    await openStudio(page, { owned: ["home_rig_pro"] });
    const root = page.locator(`#vt-motion > ${t("pks")}`);
    await root.waitFor();
    assert.match(await root.getAttribute("class"), /\btall\b/, "縦持ちは縦の並べ方");
    const screen = await page.evaluate(() => ({ x: 0, y: 0, width: innerWidth, height: innerHeight }));
    for (const id of ["pks-photo", "pks-tab-text", "pks-bg-pink", "pks-bg-neon", "pks-done", "pks-auto", "pks-undo"]) {
      assert(inside(await page.locator(t(id)).boundingBox(), screen), `${id} が画面に収まる`);
    }
    const photo = await page.locator(t("pks-photo")).boundingBox();
    assert(photo.width >= screen.width * 0.5, `写真が画面の幅の半分以上 ${JSON.stringify(photo)}`);
    assert.equal(await root.evaluate((n) => n.scrollWidth <= n.clientWidth + 1), true, "横にはみ出さない（入力欄に触れても画面がずれない）");

    // 背景: 「背景をえらんでね♪」から。2コマともヒョウ柄 → 下のコマだけキラキラ。抜いた写真の後ろに、コマごとの柄が敷かれる
    assert.equal(await page.locator(t("pks-title")).textContent(), "背景をえらんでね♪");
    assert.equal(await page.locator(t("pks-timer")).isVisible(), false, "背景を選んでいる間は時間を数えない");
    assert.match(await page.locator(`${t("pks-photo")} img.pks-shot`).getAttribute("src"), /purikura-key\/cg_purikura_ageha_gyarupi\.webp$/);
    for (const id of ["pks-bg-target-top", "pks-bg-leopard"]) {
      const box = await page.locator(t(id)).boundingBox();
      assert(box.height >= 32 && box.width >= 32, `${id} は指で押せる大きさ ${JSON.stringify(box)}`);
    }
    await page.locator(t("pks-bg-leopard")).click();
    await page.locator(t("pks-bg-target-bottom")).click();
    await page.locator(t("pks-bg-sparkle")).click();
    assert.equal(await page.locator(`${t("pks-bg-sparkle")}[aria-checked="true"]`).count(), 1, "選んだ柄に印");
    assert.equal(await page.locator(`${t("pks-photo")} .pkd-backdrop > rect`).count() >= 2, true, "コマの背景が敷かれる");
    const order = await page.locator(t("pks-photo")).evaluate((n) => [...n.children].map((c) => c.getAttribute("class")));
    assert.deepEqual(order, ["pkd-backdrop", "pks-shot", "pks-layer"], "下から 背景 → 抜いた写真 → 落書き");

    assert.equal(await page.locator(t("pks-bg-flavor-double-apple")).count(), 1, "既存のフレーバー背景を選べる");
    await page.locator(t("pks-tab-rig")).click();
    await page.locator(t("pks-rig")).selectOption("home_rig_pro");
    assert.match(await page.locator(`${t("pks-layer")} .pkd-rig`).getAttribute("href"), /shisha_home_pro/);

    // もじ: キーボードで入れて Enter で置く。書体・色・ふちは、置いた文字にもそのまま効く
    await page.locator(t("pks-tab-text")).click();
    assert.equal(await page.locator(t("pks-title")).textContent(), "らくがきタイム♪");
    await page.locator(t("pks-timer")).waitFor();
    assert.match(await page.locator(t("pks-timer")).textContent(), /のこり(120|119)秒/, "らくがきタイムの残り時間");
    for (const id of ["pks-input", "pks-place-text", "pks-timer"]) assert(inside(await page.locator(t(id)).boundingBox(), screen), `${id} が画面に収まる`);
    for (const id of ["pks-tab-stamp", "pks-place-text", "pks-done", "pks-font-mincho", "pks-text-color-blue"]) {
      const box = await page.locator(t(id)).boundingBox();
      assert(box.height >= 32 && box.width >= 32, `${id} は指で押せる大きさ ${JSON.stringify(box)}`);
    }
    await page.locator(t("pks-input")).fill("うちら最強");
    await page.locator(t("pks-input")).press("Enter");
    await page.locator(`${t("pks-layer")} .pkd-text`).waitFor();
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-text text`).last().textContent(), "うちら最強");
    assert.equal(await page.locator(t("pks-selbar")).isVisible(), true, "置いた文字を選んで、大きさ・傾き・消すが出る");
    await page.locator(t("pks-font-mincho")).click();
    await page.locator(t("pks-text-color-blue")).click();
    await page.locator(t("pks-edge-black")).click();
    await page.locator(t("pks-size")).fill("1.6");

    // スタンプ: 置いて、指でずらす。もう1つ置いて消す
    await page.locator(t("pks-tab-stamp")).click();
    await page.locator(t("pks-stamp-heart")).click();
    await dragItem(page, 1, 40, -30);
    await page.locator(t("pks-stamp-bowl")).click();
    assert.match(await page.locator(`${t("pks-layer")} .pkd-item[data-index="2"] image`).getAttribute("href"), /lotos_hagal/);
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-item`).count(), 3);
    await page.locator(t("pks-remove")).click();
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-item`).count(), 2, "選んだスタンプを消せる");

    // ペン: なぞって描く。1つ戻すと消え、もう一度描ける
    await page.locator(t("pks-tab-pen")).click();
    await drawLine(page);
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-stroke`).count(), 1);
    await page.locator(t("pks-undo")).click();
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-stroke`).count(), 0, "1つ戻すと線が消える");
    await page.locator(t("pks-pen-color-yellow")).click();
    await page.locator(t("pks-pen-l")).click();
    await drawLine(page);

    await page.locator(t("pks-done")).click();
    await page.locator(t("pks-print")).waitFor();
    const doodle = await page.evaluate(() => window.__pks);
    assert.equal(doodle.v, 1);
    assert.equal(doodle.rig, "home_rig_pro", "持ち込んだ台が印刷した写真に残る");
    assert.deepEqual(doodle.bg, ["leopard", "sparkle"], "コマごとの背景が残る");
    const [text, heart] = doodle.items;
    assert.deepEqual([text.t, text.text, text.f, text.c, text.e, text.s], ["text", "うちら最強", "mincho", "blue", "black", 1.6], "文字の書体・色・ふち・大きさ");
    assert.equal(heart.id, "heart");
    assert(heart.x !== 320 || heart.y !== 960, `ずらしたスタンプの位置が変わる ${JSON.stringify(heart)}`);
    assert.equal(doodle.strokes.length, 1);
    assert.deepEqual([doodle.strokes[0].c, doodle.strokes[0].w], ["yellow", "l"]);
    assert(doodle.strokes[0].p.length >= 8, "線は点の並びで残る");
    const normalized = await page.evaluate(async (d) => (await import("./js/core/purikura-doodle.js")).normalizeDoodle(d), doodle);
    assert.deepEqual(normalized, doodle, "返る落書きは保存の形のまま");
    assert.equal(await page.locator("#vt-motion > *").count(), 0, "閉じたら縦の舞台は空");
  }, { ...TALL, pageEntry: withLook("vertical") });

  await check("landscape-studio-and-auto", async (page) => {
    await openStudio(page);
    const root = page.locator(`#fx > ${t("pks")}`);
    await root.waitFor();
    assert.match(await root.getAttribute("class"), /\bwide\b/, "本編のステージは横の並べ方");
    const stage = await page.locator("#stage").boundingBox();
    for (const id of ["pks-photo", "pks-bg-pink", "pks-bg-neon", "pks-done", "pks-auto", "pks-clear"]) {
      assert(inside(await page.locator(t(id)).boundingBox(), stage), `${id} がステージに収まる`);
    }
    await page.locator(t("pks-bg-night")).click();
    await page.locator(t("pks-tab-stamp")).click();
    await page.locator(t("pks-stamp-crown")).click();
    await page.locator(t("pks-auto")).click();
    assert.equal(await page.evaluate(() => window.__pks), null, "おまかせは null（今の写真のまま）");
    assert.equal(await page.locator(t("pks")).count(), 0);
  });

  await check("revisit-photo-self-doodle-to-gallery", async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); const v = core.newGame();
      Object.assign(v, { chapter: 2, phase: "daily", day: 16, slot: 0, money: 12345, stamina: 80 });
      v.met = { hajime: true, ageha: true };
      Object.assign(v.flags, { _ch2_day1: { startDay: 15 }, _ageha_first_purikura: true });
      __remake.vnTest.turbo = true;
      await (await import("./js/chapters/ch2-city-data.js")).loadChapterTwoDialogues();
      const { offerAgehaPurikura } = await import("./js/chapters/ch2-purikura.js");
      const { ROOMS } = await import("./js/chapters/ch2-city-data.js");
      window.__photoDone = false;
      void offerAgehaPurikura(ROOMS.ageha).then(() => { window.__photoDone = true; });
    });
    // 一人で初めて撮る回（solo_first・落書き無しの写真がある）
    await page.locator(t("purikura-shoot")).click();
    await page.locator(t("purikura-solo")).click();
    await page.locator(t("purikura-doodle-self")).click();
    await page.locator(t("pks")).waitFor();
    await page.locator(t("pks-bg-sky")).click();
    await page.locator(t("pks-tab-text")).click();
    await page.locator(t("pks-input")).fill("ソロぷり");
    await page.locator(t("pks-place-text")).click();
    await page.locator(t("pks-done")).click();
    // 受け取りの写真は、落書き無しの写真＋自分の落書き
    const own = page.locator(`${t("purikura-photo")}[data-doodle="own"]`);
    await own.waitFor();
    assert.equal(await own.locator("img").getAttribute("src"), "img/cgs/purikura-key/cg_purikura_solo_first.webp");
    assert.equal(await own.locator(".pkd-backdrop > rect").count() >= 2, true, "受け取りの写真にも選んだ背景");
    assert.equal(await own.locator(".pkd-text text").last().textContent(), "ソロぷり");
    // らくがきし直すと前の落書きから。おまかせに戻すと今の写真
    await page.locator(t("purikura-doodle-self")).click();
    await page.locator(t("pks")).waitFor();
    assert.equal(await page.locator(`${t("pks-layer")} .pkd-text`).count(), 1, "描き直しは前の落書きから");
    assert.equal(await page.locator(t("pks-auto")).textContent(), "おまかせに戻す");
    await page.locator(t("pks-auto")).click();
    await page.locator(`${t("purikura-photo")}[data-cg="cg_purikura_solo_first"]:not([data-doodle])`).waitFor();
    // もう一度描いて受け取る
    await page.locator(t("purikura-doodle-self")).click();
    await page.locator(t("pks-tab-stamp")).click();
    await page.locator(t("pks-stamp-crown")).click();
    await page.locator(t("pks-done")).click();
    await own.waitFor();
    await page.locator(t("purikura-receive")).click();
    await page.waitForFunction(() => window.__photoDone);
    const v = await page.evaluate(() => structuredClone(__remake.state));
    assert.equal(v.money, 12345 - 400, "自分でらくがきしても料金は1回400円");
    const row = v.flags._ageha_purikura_history.at(-1);
    assert.deepEqual([row.mode, row.cg], ["solo", "cg_purikura_solo_first"]);
    assert.deepEqual(row.doodle.items.map((it) => it.id || it.text), ["crown"], "撮影の記録に受け取った時の落書きが残る");
    assert.deepEqual(row.doodle.bg, ["pink", "pink"], "おまかせに戻してから描き直した時の背景（初めの柄）");

    // ギャラリー: 一覧の小さな絵と拡大表示が自分の落書き。おまかせの絵にも切り替えられる
    await page.evaluate(async () => {
      (await import("./js/core/gallery-progress.js")).recordGalleryProgress(__remake.state);
      window.__gallery = (await import("./js/scenes/gallery.js")).openGallery();
    });
    const cell = page.locator(t("gal-cg_purikura_solo_first"));
    await cell.waitFor();
    assert.equal(await cell.locator(".gal-doodle-thumb .pkd-stamp").count(), 1, "一覧の小さな絵は自分の落書き");
    await cell.click();
    await page.locator(`.gal-viewer ${t("purikura-photo")}[data-doodle="own"] .pkd-stamp`).waitFor();
    await page.locator(t("gallery-doodle-auto")).click();
    assert.equal(await page.locator(".gal-viewer img.gal-media-image").getAttribute("src"), "img/cgs/cg_purikura_solo_first.webp", "おまかせの絵に切り替わる");
    await page.locator(t("gallery-doodle-own")).click();
    await page.locator(`.gal-viewer ${t("purikura-photo")}[data-doodle="own"]`).waitFor();
  });
});
