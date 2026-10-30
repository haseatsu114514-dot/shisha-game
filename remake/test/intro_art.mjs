// 採用した登場イラスト・DAY4の未知アゲハ・新人物PNG・昼夜マップの本編接続。
// 8123でpreviewを起動後: CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/intro_art.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  const faces = await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), { DB } = await import("./js/core/data.js");
    const intro = await import("./js/vn/intro.js"), vn = await import("./js/vn/engine.js");
    const map = await import("./js/daily/map.js"), worker = await import("./js/craft/worker.js");
    core.newGame();
    window.T = { core, DB, intro, vn, map, worker, seen: [] };
    new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => {
      if (n.classList?.contains("cutin")) T.seen.push(`${n.dataset.char}:${n.dataset.variant || ""}`);
    }))).observe(document.querySelector("#fx"), { childList: true });
    assertArt();
    function assertArt() {
      const missing = ["hajime", "sumi", "tsumugi", "oneesan", "naru", "adam", "minto", "rin", "samechan", "nagumo", "maezono", "dr_kemuri", "pakki", "ageha", "hiyori", "kumicho", "rei"].filter(id => !DB.manifest.introArt[id]);
      if (missing.length) throw new Error(`採用済みの登場背景がない: ${missing.join(", ")}`);
    }
    return Object.fromEntries(["hajime", "adam", "naru", "dr_kemuri", "samechan"].map((id) => [id, DB.manifest.portraits[id].faces]));
  });

  // DAY4の実台本を高速送りしても初登場は消えず、名前も職業もまだ開示しない。
  await page.evaluate(() => { T.talk = T.vn.play("ch1_ageha_encounter"); });
  await page.waitForSelector("#vn.active");
  await page.keyboard.down("Control");
  await page.waitForSelector('.cutin.in[data-char="ageha"][data-variant="unknown"]');
  await page.waitForTimeout(1300);
  const unknown = await page.evaluate(() => {
    const host = document.querySelector(".cutin");
    return {
      name: host.querySelector(".ci-name").textContent,
      title: host.querySelector(".ci-title").textContent,
      line: host.querySelector(".ci-line").textContent,
      face: host.querySelector(".ci-portrait").src,
      text: host.textContent,
      met: !!T.core.state.met.ageha,
      initialSeen: !!T.core.state.flags._intro_ageha_unknown,
      namedSeen: !!T.core.state.flags._intro_ageha,
      backgroundLoaded: host.querySelector(".ci-art-background").naturalWidth > 0,
    };
  });
  assert.equal(unknown.name, "？？？");
  assert.equal(unknown.title, "通りすがりのギャル");
  assert.equal(unknown.line.replace(/\s/g, ""), "「大丈夫？ケガしてない？」");
  assert(unknown.face.split("?")[0].endsWith("chr_ageha_smile.webp"));
  assert(!unknown.text.includes("バイブス"));
  assert(!unknown.met && unknown.initialSeen && !unknown.namedSeen && unknown.backgroundLoaded);
  if (shots) await page.screenshot({ path: `${shots}/ageha_unknown_in_story.png` });
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".cutin:not(.out)").count(), 1);
  await page.evaluate(() => T.talk);
  await page.keyboard.up("Control");
  assert.deepEqual(await page.evaluate(() => T.seen), ["ageha:unknown"]);

  // セーブ・ロード後にも未知版の既読だけを維持。再生済みの場面で再表示しない。
  await page.evaluate(() => { T.core.save(); T.core.load(); T.seen.length = 0; T.talk = T.vn.play("ch1_ageha_encounter"); });
  await page.waitForSelector("#vn.active");
  await page.keyboard.down("Control");
  await page.evaluate(() => T.talk);
  await page.keyboard.up("Control");
  assert.deepEqual(await page.evaluate(() => T.seen), []);
  assert.equal(await page.evaluate(() => !!T.core.state.flags._intro_ageha), false);

  // 第2章用は同じレンダラーへ接続済み。目を開いたnormalと指定の一言を別既読で出す。
  await page.evaluate(() => {
    T.core.markMet("ageha");
    if (!T.intro.needsIntro("ageha")) throw new Error("未知版の既読で名乗り版まで消えた");
    T.done = T.intro.playIntro("ageha");
  });
  await page.waitForSelector('.cutin.in[data-char="ageha"][data-variant=""]');
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".cutin .ci-name").textContent(), "あげは");
  assert.equal(await page.locator(".cutin .ci-title").textContent(), "バイブスの天才");
  assert.equal(await page.locator(".cutin .ci-line").textContent(), "「うち超感覚派なんだよね〜」");
  assert((await page.locator(".cutin .ci-portrait").getAttribute("src")).split("?")[0].endsWith("chr_ageha_normal.webp"));
  if (shots) await page.screenshot({ path: `${shots}/ageha_professional.png` });
  await page.evaluate(() => T.done);
  assert.equal(await page.evaluate(() => T.intro.needsIntro("ageha")), false);

  // 小さな横画面・動きを減らす設定でも、文字は切れず、時間を短縮しない。
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { T.done = T.intro.playIntro("ageha", { variant: "unknown" }); });
  await page.waitForSelector(".cutin.in");
  const boxes = await page.evaluate(() => {
    const stage = document.querySelector("#stage").getBoundingClientRect();
    return [".ci-name", ".ci-title", ".ci-line"].map((sel) => {
      const b = document.querySelector(`.cutin ${sel}`).getBoundingClientRect();
      return { sel, fits: b.left >= stage.left && b.right <= stage.right && b.top >= stage.top && b.bottom <= stage.bottom };
    });
  });
  boxes.forEach(({ sel, fits }) => assert(fits, `${sel}が小さい画面ではみ出す`));
  assert.equal(await page.evaluate(() => document.querySelector(".cutin").getAnimations({ subtree: true }).length), 0);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".cutin:not(.out)").count(), 1);
  if (shots) await page.screenshot({ path: `${shots}/ageha_unknown_mobile.png` });
  await page.evaluate(() => T.done);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // 新しい26表情は会話エンジンが実画像を読み、同じ枠で表情を切り替える。
  let count = 0;
  for (const [id, variants] of Object.entries(faces)) {
    for (const face of variants) {
      count++;
      await page.evaluate(({ id, face }) => {
        T.core.markMet(id); T.intro.markIntroSeen(id);
        T.talk = T.vn.play({ dialogue_id: "__adopted_portrait", lines: [{ speaker: id, face, text: `${id}:${face}` }] });
      }, { id, face });
      await page.waitForFunction((text) => document.querySelector(".vn-text")?.textContent.includes(text), `${id}:${face}`);
      if (id === "hajime") {
        assert.equal(await page.locator(".vn-portraits img").count(), 0, "通常会話で主人公の立ち絵が出た");
      } else {
        await page.waitForFunction((suffix) => [...document.querySelectorAll(".vn-portraits img")].some((im) => im.src.endsWith(suffix) && im.complete && im.naturalWidth > 0), `chr_${id}_${face}.webp`);
      }
      await page.keyboard.press("Enter");
      await page.waitForTimeout(330);
      await page.keyboard.press("Enter");
      await page.evaluate(() => T.talk);
    }
  }
  const workerFaces = await page.evaluate(async () => {
    const w = T.worker.buildWorkerScene({ mode: "practice" });
    document.querySelector("#screen").replaceChildren(w.root);
    await w.ready; // 表情の事前読み込みによるsrc変更が終わってからdecodeする。
    const result = [];
    for (const level of ["steady", "unsteady", "shaken"]) {
      w.setMental(level);
      const im = w.root.querySelector(".worker-actor");
      await im.decode();
      result.push(im.src.split("/").pop());
    }
    w.root.remove(); return result;
  });
  assert.deepEqual(workerFaces, ["chr_hajime_serious.webp", "chr_hajime_sad.webp", "chr_hajime_surprise.webp"]);

  // 昼夜とも新マップを表示し、既存の全スポットを元の座標に残す。
  const pins = JSON.parse(await readFile(new URL("../../asset_sources/backgrounds/osu-sakae-map-remaster-v1/pin-layout.json", import.meta.url))).spots;
  for (const slot of [0, 1]) {
    const tod = slot ? "night" : "day";
    await page.evaluate((slot) => {
      T.core.state.phase = "daily"; T.core.state.day = 13; T.core.state.slot = slot; // 13日目: 6日目と同じ曜日（占いの出店日）で、seed 0 では晴れ（6日目は雨で占いが閉店する）
      T.core.state.weatherSeed = 0;
      for (const id of ["naru", "adam", "minto"]) T.core.state.flags[`_spot_guide_${id}`] = true;
      T.core.state.flags._cafe_introduced = true; // 座標確認は紹介を読了したマップで行う。
      T.core.state.flags._fortune_rumor_heard = true; // 占いピンは噂を聞き終えた後だけマップに出る（#780 fortune-schedule）
      T.mapTask = T.map.chooseSpot();
    }, slot);
    await page.waitForSelector(`.map[data-night="${!!slot}"]`);
    await page.waitForFunction((tod) => [...document.querySelectorAll("#bg > div")].some((node) => node.style.backgroundImage.includes(`bg_osu_map_${tod}.webp`) && node.classList.contains("show")), tod);
    await page.waitForFunction(() => !document.querySelector(".scene-curtain") && getComputedStyle(document.querySelector("#bg > div:last-child")).opacity === "1");
    for (const pin of pins) {
      const position = await page.locator(`.map [data-spot="${pin.id}"]`).evaluate((node) => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) }));
      const moved = { cafe: { x: 72, y: 45 }, kannon: { x: 18, y: 57 }, choizap: { x: 20, y: 24 }, fortune: { x: 63, y: 69 }, rest: { x: 89, y: 44 } };
      const expected = moved[pin.id] || { x: pin.x_percent, y: pin.y_percent }; // mainでHUDを避けて移動済みの施設を反映。
      assert.deepEqual(position, expected, `${tod}:${pin.id}の座標が変わった`);
    }
    if (shots) await page.screenshot({ path: `${shots}/map_${tod}.png` });
    await page.evaluate(() => T.map.interruptMap("__test_done"));
    await page.evaluate(() => T.mapTask);
  }
  assert.deepEqual(errors, []);
  console.log(`OK intro_art: DAY4未知版・別既読/ロード・第2章用normal・小画面/静止・${count}表情・昼夜マップの全ピン`);
} finally { await browser.close(); }
