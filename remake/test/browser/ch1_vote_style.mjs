// 第1章の大会の審査の方式（SKR04）: 桜井式（試作）といままでの切替・攻めの帯・途中経過の票読み・競技規則の第四条。
// 既定はプレイヤーの端末が桜井式、自動操作のブラウザ（この検査を含むブラウザテスト）がいままで（core/vote-style.js）。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const CONFIG_KEY = "suien_remake_config";
const t = (id) => `[data-test="${id}"]`;
const titleReady = (page) => page.locator(t("title-new")).waitFor({ timeout: 40000 });
const checkedStyle = (page) => page.locator(`${t("cfg-vote-style")} button[aria-checked="true"]`).getAttribute("value");
const LONG = 150000;

/** 新しい試合の規則（rulesVersion 2）で第1章の大会を始める。開発ジャンプは旧規則になるため、ここで版を付ける。 */
async function startTournament(page, { aim = null } = {}) {
  await page.evaluate((aim) => {
    window.__remake.vnTest.turbo = true;
    window.__remake.craftTest.auto = "good";
    window.__remake.craftTest.aim = aim;
    window.__ch1VoteStyleRun = (async () => {
      const { newGame } = await import("./js/core/state.js");
      const ch1 = await import("./js/chapters/ch1.js");
      newGame();
      const s = window.__remake.state;
      Object.assign(s, { phase: "tournament", day: 14, flavors: ["double_apple", "mint", "blueberry", "lemon"],
        flavorStock: { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 } });
      s.tournament.rulesVersion = 2;
      return ch1.devTournament();
    })();
  }, aim);
}
const voteAttempt = (page) => page.evaluate(() => structuredClone(window.__remake.state.tournament?.voteAttempt ?? null));
const ruleText = (page) => page.evaluate(async () => (await import("./js/scenes/rule-sheet.js")).ruleSheetPanel(1).textContent);

await suite("ch1-vote-style", async (check) => {
  await check("defaults-and-choice-persist", async (page) => {
    assert.equal(await page.evaluate(() => navigator.webdriver), true, "この検査は自動操作のブラウザで動く");
    await page.locator(t("title-config")).click();
    assert.deepEqual(await page.locator(`${t("cfg-vote-style")} button`).allTextContents(), ["桜井式（試作）", "いままで"]);
    assert.equal(await checkedStyle(page), "classic", "自動操作のブラウザの既定はいままで");
    // プレイヤーの端末（自動操作の印を外す）は桜井式。いままでへ戻すと保存され、次に開いても戻ったまま。
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false, configurable: true }));
    await page.evaluate((key) => localStorage.removeItem(key), CONFIG_KEY);
    await page.reload(); await titleReady(page);
    await page.locator(t("title-config")).click();
    assert.equal(await checkedStyle(page), "sakurai", "プレイヤーの端末の既定は桜井式");
    await page.locator(`${t("cfg-vote-style")} button[value="classic"]`).click();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).voteStyle, CONFIG_KEY), "classic");
    await page.reload(); await titleReady(page);
    await page.locator(t("title-config")).click();
    assert.equal(await checkedStyle(page), "classic", "戻した方式は保たれる");
    assert(!(await ruleText(page)).includes("第四条"), "いままでの審査の規則に審査の条は無い");
    await page.locator(`${t("cfg-vote-style")} button[value="sakurai"]`).click();
    assert.match(await ruleText(page), /第四条　審査.*その回に仕上げた工程だけ.*攻めの帯/);
  });

  await check("sakurai-match-attack-band-and-board", async (page) => {
    // 途中経過の札（審査員ごとの見る所）は自動送りで短く出るので、始める前から待っておく。
    const focus = page.locator(t("judge-focus")).first().waitFor({ state: "attached", timeout: LONG }).then(() => true, (error) => error);
    await startTournament(page, { aim: "attack" });
    await page.locator(t("attack-band")).waitFor({ state: "visible", timeout: LONG });
    const band = await page.locator(t("attack-band")).evaluate((node) => ({ low: Number(node.dataset.low), high: Number(node.dataset.high), h: node.getBoundingClientRect().height }));
    assert(band.high > band.low && band.h >= 8, `攻めの帯が見える高さで出る ${JSON.stringify(band)}`);
    assert.equal(await page.locator(t("attack-band-note")).textContent(), "攻め");
    assert.equal(await focus, true, "途中経過に審査員ごとの見る所が出る");
    await page.waitForFunction(() => window.__remake.state.tournament?.voteAttempt?.result, null, { timeout: LONG, polling: 200 });
    const p = await voteAttempt(page);
    assert.equal(p.style, "sakurai"); assert.equal(p.rulesVersion, 3);
    assert.deepEqual(p.attacks, [false, true, true, true], "提供・調整2回とも攻めの帯で終えた");
    assert.equal(p.lastPoint, "hajime", "攻めた2回目の調整が千須の最後の1点を取る");
    assert.equal(p.result.rank, 1);
    for (const round of [1, 2, 3]) for (const judge of ["maezono", "dr_kemuri", "sui"])
      assert(p.views[round][judge].hajime >= 4, "攻めた回の評価に上積みが入っている");
    assert.match(await ruleText(page), /第四条　審査/, "桜井式の試合中の規則に審査の条がある");
  }, { pageEntry: `${baseURL}?vote=sakurai` });

  await check("classic-match-has-no-attack-band", async (page) => {
    await startTournament(page);
    await page.locator(t("pull-temperature")).waitFor({ state: "visible", timeout: LONG });
    assert.equal(await page.locator(t("attack-band")).count(), 0, "いままでの審査では攻めの帯を出さない");
    const p = await voteAttempt(page);
    assert.equal(p.rulesVersion, 2); assert.equal(p.style, undefined);
  });

  await check("url-overrides-setting", async (page) => {
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ voteStyle: "classic" })), CONFIG_KEY);
    await page.goto(`${baseURL}?vote=sakurai`, { waitUntil: "load" }); await titleReady(page);
    await startTournament(page);
    await page.locator(t("attack-band")).waitFor({ state: "attached", timeout: LONG });
    assert.equal((await voteAttempt(page)).style, "sakurai", "?vote=sakurai は設定より優先");
  });
});
