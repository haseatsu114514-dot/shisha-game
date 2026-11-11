// 占いの札の表（#3278・TMG44）: めくった札の表に、占った相手の大アルカナが表の枠の窓に入って出ること。
// 相手ごとに正しい札と札の名前の帯（番号と名前だけ・相手の名前は出さない＝CI110）、札の無い相手と絵が読めないときは
// 従来の光だけの表に戻ること、会話の先読みで札の絵を読み始めること、別案 b でも同じ札が出ることを確かめる。
// node remake/test/browser/tarot_arcana.mjs（プレビューサーバーが必要）。SHOTS=<フォルダ> で、めくった直後の画面を残す。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, baseURL } from "./support.mjs";

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
// オーナー決定の対応表（#3278 本文の表・11-11 に19枚とも採用）
const EXPECTED = {
  sumi: ["09-hermit", "IX", "隠者"], naru: ["01-magician", "I", "魔術師"], adam: ["06-lovers", "VI", "恋人"],
  minto: ["03-empress", "III", "女帝"], tsumugi: ["17-star", "XVII", "星"], rio: ["02-high-priestess", "II", "女教皇"],
  hiyori: ["08-strength", "VIII", "力"], samechan: ["10-wheel", "X", "運命の輪"], ageha: ["19-sun", "XIX", "太陽"],
  kumicho: ["05-hierophant", "V", "教皇"], rei: ["18-moon", "XVIII", "月"], saku: ["00-fool", "0", "愚者"],
  steve: ["14-temperance", "XIV", "節制"], volk: ["04-emperor", "IV", "皇帝"], mashiro: ["12-hanged", "XII", "吊るされた男"],
  da_silva: ["20-judgement", "XX", "審判"], sheikh: ["21-world", "XXI", "世界"], master_hookah: ["11-justice", "XI", "正義"],
  noor: ["07-chariot", "VII", "戦車"],
};

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const motions = await import("./js/core/scene-motions.js");
    const arcana = await import("./js/core/tarot-arcana.js");
    const engine = await import("./js/vn/engine.js");
    window.T = { core, ui, data, motions, arcana, engine };
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_street", "night"), { instant: true });
    window.keys = 0;
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") keys++; });
  });
}

/** めくって帯が出きった瞬間の様子（光だけの表のときは、裏返し終わった瞬間） */
async function flip(page, charId, { label = charId, expectArt = true } = {}) {
  await page.evaluate((charId) => {
    window.keys = 0;
    window.flipDone = false;
    window.flipRun = T.motions.tarotFlip(charId).then(() => { window.flipDone = true; });
  }, charId);
  await page.waitForSelector(".mo-tarot");
  if (expectArt) {
    await page.waitForFunction(() => {
      const band = document.querySelector(".mo-tarot-band");
      return band && Number(getComputedStyle(band).opacity) > 0.99 && band.getAnimations().every((a) => a.playState !== "running");
    }, null, { timeout: 8000 });
  } else {
    await page.waitForFunction(() => {
      const flipper = document.querySelector(".mo-tarot-front")?.parentElement;
      return flipper && new DOMMatrix(getComputedStyle(flipper).transform).m11 < -0.99;
    }, null, { timeout: 8000 });
  }
  const seen = await page.evaluate((charId) => {
    const front = document.querySelector(".mo-tarot-front, .mo-tb-face.front");
    const frontImg = front.querySelector("img.mo-tarot-pic");
    const card = front.closest(".mo-tarot-card, .mo-tb-card");
    const band = document.querySelector(".mo-tarot-band");
    const stage = document.getElementById("stage").getBoundingClientRect();
    const rect = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const names = charId ? [T.data.displayName(charId, T.core.state), T.data.DB.characters?.[charId]?.name].filter(Boolean) : [];
    return {
      art: front.classList.contains("art"),
      front: frontImg ? { file: new URL(frontImg.src).pathname.split("/").pop(), complete: frontImg.complete, w: frontImg.naturalWidth, h: frontImg.naturalHeight } : null,
      frontBackground: front.style.background || "",
      backs: [...document.querySelectorAll(".mo-tarot-back img, .mo-tb-face.back img")].map((img) => ({ file: new URL(img.src).pathname.split("/").pop(), complete: img.complete && img.naturalWidth === 1024 })),
      facing: new DOMMatrix(getComputedStyle(front.parentElement.matches(".mo-tarot-flip") ? front.parentElement : card).transform).m11,
      band: band ? { no: band.querySelector("b").textContent, name: band.querySelector("span").textContent, text: band.textContent, rect: rect(band), font: getComputedStyle(band).fontFamily } : null,
      card: rect(card), stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom },
      names,
    };
  }, charId);
  if (shots) await page.screenshot({ path: path.join(shots, `tarot-${label}.png`) });
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => keys), 0, `${label}: Enter leaked through the motion`);
  await page.waitForFunction(() => window.flipDone, null, { timeout: 12000 });
  await page.evaluate(() => window.flipRun);
  const after = await page.evaluate(() => ({ leftovers: document.querySelectorAll(".mo").length, loading: document.querySelectorAll(".vn-loading").length }));
  assert.deepEqual(after, { leftovers: 0, loading: 0 }, `${label}: motion left something behind`);
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => keys), 1, `${label}: input stayed blocked after the motion`);
  return seen;
}

/** 相手の札が表の枠ごと出て、帯は札の名前だけ・札と重ならず画面に収まる */
function assertArcana(seen, charId, label = charId) {
  const [file, no, name] = EXPECTED[charId];
  assert.equal(seen.art, true, `${label}: front is not the arcana card`);
  assert.deepEqual(seen.front, { file: `${file}.webp`, complete: true, w: 540, h: 888 }, `${label}: wrong or unloaded card`);
  assert(seen.backs.length >= 3 && seen.backs.every((b) => b.file === "card-back.webp" && b.complete), `${label}: card backs ${JSON.stringify(seen.backs)}`);
  assert(seen.facing < -0.99, `${label}: card did not turn to its face (${seen.facing})`);
  assert.deepEqual([seen.band?.no, seen.band?.name], [no, name], `${label}: band shows the wrong card name`);
  assert.equal(seen.band.text, `${no}${name}`, `${label}: band has extra text`);
  for (const person of seen.names) assert(!seen.band.text.includes(person), `${label}: band shows the person's name ${person}`);
  assert.match(seen.band.font, /Suien Name/, `${label}: band is not set in the title mincho`);
  const inside = (r) => r.left >= seen.stage.left - 1 && r.right <= seen.stage.right + 1 && r.top >= seen.stage.top - 1 && r.bottom <= seen.stage.bottom + 1;
  assert(inside(seen.card), `${label}: card is outside the stage ${JSON.stringify(seen.card)}`);
  assert(inside(seen.band.rect), `${label}: band is outside the stage ${JSON.stringify(seen.band.rect)}`);
  assert(seen.band.rect.top >= seen.card.bottom - 2, `${label}: band overlaps the card (${seen.band.rect.top} < ${seen.card.bottom})`);
}

function assertLightOnly(seen, label) {
  assert.equal(seen.art, false, `${label}: unexpected arcana card`);
  assert.equal(seen.front, null, `${label}: unexpected card picture`);
  assert.deepEqual(seen.backs, [], `${label}: unexpected card-back picture`);
  assert.match(seen.frontBackground, /radial-gradient/, `${label}: front lost the light-only face`);
  assert.equal(seen.band, null, `${label}: band without a card`);
  assert(seen.facing < -0.99, `${label}: card did not turn (${seen.facing})`);
}

await suite("tarot-arcana", async (check) => {
  await check("mapping", async (page) => {
    const result = await page.evaluate(async () => {
      const { TAROT_ARCANA, arcanaUrl, TAROT_BACK_URL, tarotArcana, tarotArtUrls } = await import("./js/core/tarot-arcana.js");
      const { DB } = await import("./js/core/data.js");
      const size = (src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
        img.onerror = () => resolve(null);
        img.src = src;
      });
      const table = Object.fromEntries(Object.entries(TAROT_ARCANA).map(([id, arc]) => [id, [arc.file, arc.no, arc.name]]));
      const sizes = Object.fromEntries(await Promise.all(Object.values(TAROT_ARCANA).map(async (arc) => [arc.file, await size(arcanaUrl(arc))])));
      return {
        table, sizes, back: await size(TAROT_BACK_URL),
        unknown: Object.keys(TAROT_ARCANA).filter((id) => !DB.characters[id]),
        none: [tarotArcana("emil"), tarotArcana(undefined), tarotArcana("toString"), tarotArtUrls("emil").length],
        urls: tarotArtUrls("adam").map((u) => new URL(u).pathname.split("/").slice(-2).join("/")),
      };
    });
    assert.deepEqual(result.table, EXPECTED, "card table differs from the owner's #3278 table");
    assert.deepEqual(result.unknown, [], "card for an unknown character");
    assert.equal(new Set(Object.values(result.table).map((c) => c[0])).size, 19, "the same card is used twice");
    for (const [file, size] of Object.entries(result.sizes)) assert.deepEqual(size, [540, 888], `${file}: not the 540x888 game card`);
    assert.deepEqual(result.back, [1024, 1536]);
    assert.deepEqual(result.none, [null, null, null, 0], "characters without a card must fall back");
    assert.deepEqual(result.urls, ["tarot/card-back.webp", "arcana/06-lovers.webp"]);
  });

  // 採用の a で、何人か（光の強い札・名前の長い札・数字の 0・ID に下線のある相手）
  for (const charId of ["tsumugi", "adam", "saku", "mashiro", "master_hookah"]) {
    await check(`a-${charId}`, async (page) => {
      await prepare(page);
      assertArcana(await flip(page, charId, { label: `pc-a-${charId}` }), charId);
    });
  }

  await check("a-mobile", async (page) => {
    await prepare(page);
    assertArcana(await flip(page, "samechan", { label: "mobile-a-samechan" }), "samechan", "mobile samechan");
  }, { viewport: { width: 844, height: 390 }, hasTouch: true });

  // 札の無い相手（エミル・相手不明）は、従来の光だけの表
  await check("no-card", async (page) => {
    await prepare(page);
    assertLightOnly(await flip(page, "emil", { label: "pc-a-emil", expectArt: false }), "emil");
    assertLightOnly(await flip(page, undefined, { label: "pc-a-none", expectArt: false }), "no target");
  });

  // 札の絵が遅いときは、札を出す前に「準備しています」を出して待ち、絵の抜けた札をめくらない
  await check("slow-load", async (page) => {
    await page.route("**/transitions/tarot/arcana/*.webp", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await prepare(page);
    await page.evaluate(() => {
      window.sawLoading = false;
      new MutationObserver(() => { if (document.querySelector('[data-test="module-loading"]')) window.sawLoading = true; })
        .observe(document.body, { childList: true, subtree: true });
    });
    assertArcana(await flip(page, "minto", { label: "pc-a-slow-minto" }), "minto", "slow minto");
    assert.equal(await page.evaluate(() => window.sawLoading), true, "slow card art did not show the preparing notice");
  });

  // 札の絵が読めないときも止まらず、光だけの表で続ける
  await check("load-failure", async (page) => {
    await page.route("**/transitions/tarot/arcana/*.webp", (route) => route.fulfill({ status: 404, body: "test missing card" }));
    await prepare(page);
    assertLightOnly(await flip(page, "tsumugi", { label: "pc-a-missing", expectArt: false }), "missing card");
  }, { ignoreFailedResource: (failure) => /\/transitions\/tarot\/arcana\//.test(failure) });

  // 別案 b（?movar=b）でも同じ札と帯
  await check("b-adam", async (page) => {
    await prepare(page);
    assertArcana(await flip(page, "adam", { label: "pc-b-adam" }), "adam", "b adam");
  }, { pageEntry: `${baseURL}?movar=b` });

  // 会話の先読み: 結果の会話を始めた時点（めくる前）で、相手の札の裏と表を読み始めている
  await check("prefetch", async (page) => {
    await prepare(page);
    await page.evaluate(() => {
      T.core.state.fortune = { char: "rio" };
      T.engine.play("remake_fortune_result");
    });
    await page.waitForSelector(".vn-text");
    // 1行目を読んでいる間（まだめくる前）に、相手の札の裏と表の取得が済む
    await page.waitForFunction(() => performance.getEntriesByType("resource").filter((e) => /\/tarot\/(card-back|arcana\/02-high-priestess)\.webp$/.test(e.name)).length >= 2, null, { timeout: 5000 });
    const before = await page.evaluate(() => ({
      motion: document.querySelectorAll(".mo-tarot").length,
      requested: performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname.split("/").slice(-2).join("/"))
        .filter((n) => /^(arcana\/|tarot\/card-back)/.test(n)),
    }));
    assert.equal(before.motion, 0, "the motion started before the first line");
    assert.deepEqual([...new Set(before.requested)].sort(), ["arcana/02-high-priestess.webp", "tarot/card-back.webp"]);
    for (let i = 0; i < 6 && !(await page.locator(".mo-tarot").count()); i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
    }
    await page.waitForSelector(".mo-tarot-front.art img[src$='02-high-priestess.webp']");
    await page.waitForSelector(".mo-tarot", { state: "detached", timeout: 12000 });
  });
});
