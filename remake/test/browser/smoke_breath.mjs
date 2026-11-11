// 人が吐く煙（KMR11）と、店に漂う煙（KMR21）を本編で確かめる。
// 会話の一服（{"type":"fx","id":"exhale"}）／吸い出しの山場（craft/fx.js の exhale）／結果発表の審査員の一服／シーシャ屋の店内の薄い煙。
// 煙は 640×360 の canvas 1枚で、消えきったら自分で外れる。早送り・「動きを減らす」・自動操作では出さない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const END = { type: "choice", choices: [{ text: "終える" }] };
const TONARI = "res://assets/backgrounds/bg_tonari_inside_night.png";

async function startVn(page, lines, { turbo = false } = {}) {
  await page.evaluate(async ({ lines, turbo, bg }) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), vn = await import("./js/vn/engine.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 1, slot: 1 });
    s.met.sumi = true;
    (await import("./js/vn/intro.js")).markIntroSeen?.("sumi");
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0, voiceBlip: false, textSpeed: 2 });
    ui.clearScreen();
    vn.vnTest.turbo = turbo;
    window.breath = { result: null, openedAt: performance.now() };
    vn.play({ dialogue_id: `breath-${Date.now()}`, lines }, { bg }).then((r) => { breath.result = r; });
  }, { lines, turbo, bg: TONARI });
}
const shown = (page, want) => page.waitForFunction((want) => document.querySelector(".vn-text")?.textContent === want && document.querySelector(".vn-next.show"), want);
const tap = async (page) => {
  await page.waitForFunction(() => performance.now() - breath.openedAt > 340); // 開始直後のクリックは本編が無視する
  await page.locator(".vn-box").click();
};
/** 煙の canvas の今の状態: 塗られた升目の数と、その重心（画面に対する割合） */
const smokeOf = (page, selector) => page.evaluate((selector) => {
  const c = document.querySelector(selector);
  if (!c) return null;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0, sx = 0, sy = 0;
  for (let i = 3, p = 0; i < d.length; i += 4, p++) if (d[i]) { n++; sx += p % c.width; sy += Math.floor(p / c.width); }
  return { n, x: n ? sx / n / c.width : 0, y: n ? sy / n / c.height : 0, width: c.width, height: c.height };
}, selector);
const waitSmoke = (page, selector, min) => page.waitForFunction(([selector, min]) => {
  const c = document.querySelector(selector);
  if (!c) return false;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
  return n >= min;
}, [selector, min]);

await suite("smoke-breath", async (check) => {
  await check("vn-exhale-from-the-mouth", async (page) => {
    await startVn(page, [{ speaker: "sumi", face: "normal", text: "一服する" }, { type: "fx", id: "exhale", who: "sumi" }, { speaker: "", text: "煙が流れた。" }, END]);
    await shown(page, "一服する");
    const mouth = await page.evaluate(async () => {
      const { mouthInPortrait } = await import("./js/vn/breath.js");
      const img = document.querySelector('#vn img.portrait[data-speaker="sumi"]');
      const m = mouthInPortrait("sumi", "normal"), box = img.getBoundingClientRect(), stage = document.getElementById("vn").getBoundingClientRect();
      return { x: (box.left + box.width * m.x - stage.left) / stage.width, y: (box.top + box.height * m.y - stage.top) / stage.height };
    });
    await tap(page);
    await page.locator("canvas.vn-breath").waitFor({ state: "attached" });
    // 吐いた直後は、まだ次の行へ進んでいない（煙が広がる「間」）
    assert.equal(await page.locator(".vn-text").textContent(), "一服する", "煙を吐いた直後は、前の行のまま待つ");
    await waitSmoke(page, "canvas.vn-breath", 300);
    const first = await smokeOf(page, "canvas.vn-breath");
    assert.deepEqual([first.width, first.height], [640, 360], "煙の升目は 640×360");
    assert.ok(Math.abs(first.x - mouth.x) < .12 && Math.abs(first.y - mouth.y) < .12, `煙は口元から出る（口 ${mouth.x.toFixed(2)},${mouth.y.toFixed(2)} 煙 ${first.x.toFixed(2)},${first.y.toFixed(2)}）`);
    assert.ok(first.x > mouth.x - .02, "空いている側（右）へ流れる");
    await shown(page, "煙が流れた。"); // 間のあと、自分で次の行へ進む
    // 会話の層の中で、台詞の箱より下・立ち絵より上に載る。DS風の判定に掛からないよう、会話の部品として扱われる
    const z = await page.evaluate(() => ({ canvas: +getComputedStyle(document.querySelector("canvas.vn-breath")).zIndex, box: +getComputedStyle(document.querySelector(".vn-box")).zIndex, pointer: getComputedStyle(document.querySelector("canvas.vn-breath")).pointerEvents }));
    assert.ok(z.canvas < z.box && z.pointer === "none", `煙は台詞の箱の下で、操作を通す（${JSON.stringify(z)}）`);
    // 消えきったら canvas は自分で外れる
    await page.waitForFunction(() => !document.querySelector("canvas.vn-breath"), null, { timeout: 12000 });
  });

  await check("vn-exhale-skipped-when-fast", async (page) => {
    // 早送り（テストの瞬時表示）では、煙も間も出さない
    // 瞬時表示は選択肢も自分で選んで最後まで進む。煙は出てから数秒は残るので、終わった直後に無ければ、出ていない
    await startVn(page, [{ speaker: "sumi", face: "normal", text: "一服する" }, { type: "fx", id: "exhale", who: "sumi" }, { speaker: "", text: "煙が流れた。" }, END], { turbo: true });
    await page.waitForFunction(() => breath.result);
    assert.equal(await page.locator("canvas.vn-breath").count(), 0);
    await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = false; });
  });

  await check("vn-exhale-without-a-portrait-is-quiet", async (page) => {
    // 立ち絵が出ていない人を指しても、止まらずに次の行へ進む（煙は出ない）
    await startVn(page, [{ speaker: "", text: "店は静かだ。" }, { type: "fx", id: "exhale", who: "tsumugi" }, { speaker: "", text: "次の行。" }, END]);
    await shown(page, "店は静かだ。");
    await tap(page);
    await shown(page, "次の行。");
    assert.equal(await page.locator("canvas.vn-breath").count(), 0);
  });

  await check("vn-exhale-reduced-motion", async (page) => {
    await startVn(page, [{ speaker: "sumi", face: "normal", text: "一服する" }, { type: "fx", id: "exhale", who: "sumi" }, { speaker: "", text: "煙が流れた。" }, END]);
    await shown(page, "一服する");
    await tap(page);
    await shown(page, "煙が流れた。");
    assert.equal(await page.locator("canvas.vn-breath").count(), 0, "端末の「動きを減らす」では煙を出さない");
  }, { reducedMotion: "reduce" });

  await check("craft-exhale-tells-how-it-went", async (page) => {
    // 吸い出しの山場: 出来で煙の量が変わる（最適 ＞ ぬるい）。消えきったら層ごと外れる
    await page.evaluate(async () => {
      (await import("./js/core/state.js")).newGame();
      const session = await import("./js/craft/session.js");
      const cs = session.newSession("tournament");
      session.openBench(cs);
      window.fxmod = await import("./js/craft/fx.js");
    });
    await page.locator(".bench").waitFor();
    const peak = async (opts) => {
      await page.evaluate((opts) => { window.fxdone = false; fxmod.exhale(document.querySelector(".bench"), opts).then(() => { window.fxdone = true; }); }, opts);
      await page.locator(".bench > .fx-exhale canvas.smoke-layer").waitFor({ state: "attached" });
      let most = 0;
      for (let i = 0; i < 12; i++) { await page.waitForTimeout(150); most = Math.max(most, (await smokeOf(page, ".bench > .fx-exhale canvas.smoke-layer"))?.n || 0); }
      const quality = await page.evaluate(() => document.querySelector(".bench > .fx-exhale")?.dataset.quality);
      await page.waitForFunction(() => window.fxdone, null, { timeout: 12000 });
      assert.equal(await page.locator(".bench > .fx-exhale").count(), 0, "煙が晴れたら層を外す");
      return { most, quality };
    };
    const best = await peak({ color: "#b07967", grand: true }), thin = await peak({ color: "#b07967", quality: "thin" });
    assert.equal(best.quality, "best"); assert.equal(thin.quality, "thin");
    assert.ok(best.most > 640 * 360 * .2, `最適温の煙は画面を満たす（${best.most}）`);
    assert.ok(best.most > thin.most * 3, `ぬるい煙は小さい（最適 ${best.most}／ぬるい ${thin.most}）`);
  });

  // ---- 店に漂う煙（KMR21）。自動操作のブラウザでは既定で出さないので、localStorage の印で明示して出す
  const showBg = (page, name, { time = "night", screen = "" } = {}) => page.evaluate(async ([name, time, screen]) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js");
    if (!core.state) core.newGame();
    core.state.slot = time === "night" ? 1 : 0;
    const bg = data.sceneBg(`res://assets/backgrounds/${name}.png`, time);
    await ui.setBg(bg.url, { instant: true, tint: bg.tint });
    if (screen) ui.showScreen(screen, document.createElement("div")); else ui.clearScreen();
  }, [name, time, screen]);
  const hazeGone = (page) => page.waitForFunction(() => !document.querySelector("#haze canvas"), null, { timeout: 6000 });

  await check("shop-haze-only-in-shisha-shops", async (page) => {
    await showBg(page, "bg_tonari_inside");
    assert.equal(await page.locator("#haze canvas").count(), 0, "自動操作のブラウザでは、既定では出さない");
    await page.evaluate(() => localStorage.setItem("suien_shop_haze", "on"));
    await showBg(page, "bg_home");
    await showBg(page, "bg_tonari_inside");
    await page.locator("#haze canvas.smoke-haze").waitFor({ state: "attached" });
    // 入った時点で、もう漂っている。小さな房だけで、台詞の箱のあたりには溜まらない
    const night = await smokeOf(page, "#haze canvas");
    assert.ok(night.n > 0 && night.n < 640 * 360 * .15, `うっすら（${(night.n / 2304).toFixed(1)}%）`);
    assert.ok(night.y < .5, `部屋の上半分に溜まる（重心の高さ ${night.y.toFixed(2)}）`);
    const look = await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1500)); // ふわっと出てくるのを待つ
      const host = document.getElementById("haze"), canvas = host.querySelector("canvas"), stage = [...document.getElementById("stage").children];
      return { opacity: +getComputedStyle(canvas).opacity, pointer: getComputedStyle(host).pointerEvents, z: +getComputedStyle(host).zIndex,
        order: [stage.indexOf(document.getElementById("bg")), stage.indexOf(host), stage.indexOf(document.getElementById("screen"))],
        zs: ["bg", "screen", "vn"].map((id) => +getComputedStyle(document.getElementById(id)).zIndex) };
    });
    assert.ok(look.opacity > .04 && look.opacity <= .071, `濃すぎない（${look.opacity}）`);
    assert.equal(look.pointer, "none");
    assert.ok(look.zs[0] < look.z && look.z < look.zs[1] && look.z < look.zs[2], `背景より上、画面・立ち絵より下（${JSON.stringify(look)}）`);
    // 昼は控えめ
    await showBg(page, "bg_tonari_inside", { time: "day" });
    await page.waitForFunction(() => +document.querySelector("#haze canvas").style.opacity < .06);
    assert.equal(await page.locator("#haze canvas").count(), 1, "同じ店の昼と夜は、同じ煙のまま濃さだけ変える");
    // 作業台の画面では出さない。シーシャ屋でない場所でも出さない
    await showBg(page, "bg_tonari_inside", { screen: "bench" });
    await hazeGone(page);
    await showBg(page, "bg_tonari_inside");
    await page.locator("#haze canvas").waitFor({ state: "attached" });
    await showBg(page, "bg_home");
    await hazeGone(page);
  });

  await check("shop-haze-reduced-motion", async (page) => {
    await page.evaluate(() => localStorage.setItem("suien_shop_haze", "on"));
    await showBg(page, "bg_tonari_inside");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#haze canvas").count(), 0, "端末の「動きを減らす」では出さない");
  }, { reducedMotion: "reduce" });

  await check("result-breath-covers-then-clears", async (page) => {
    // 結果発表（1位）: 暗転のあと、審査員の吐いた煙が画面を覆い、次の画面の上で晴れる
    await page.evaluate(async () => {
      (await import("./js/core/state.js")).newGame();
      const session = await import("./js/craft/session.js"), result = await import("./js/craft/result.js");
      const cs = session.newSession("tournament");
      cs.mix = { double_apple: 12 };
      window.resultRun = result.resultCountdown(cs, "premium").then(() => { window.resultDone = true; });
    });
    await page.locator('[data-test="result-count"]').waitFor();
    await page.locator("#fx canvas.result-breath").waitFor({ state: "attached", timeout: 15000 });
    await waitSmoke(page, "#fx canvas.result-breath", 640 * 360 * .97);
    await page.waitForFunction(() => window.resultDone, null, { timeout: 8000 });
    assert.ok((await smokeOf(page, "#fx canvas.result-breath")).n > 640 * 360 * .9, "発表が次へ進む瞬間は、まだ煙が画面を覆っている");
    await page.evaluate(async () => { (await import("./js/core/ui.js")).retireScreen(); });
    await page.waitForFunction(() => !document.querySelector("#fx canvas.result-breath"), null, { timeout: 12000 });
  });
});
