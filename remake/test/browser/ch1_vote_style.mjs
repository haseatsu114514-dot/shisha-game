// シーシャ作りの版（CRN16）と第1章の大会の審査の方式（SKR04）: 設定の「シーシャ作りの版」で、リニューアル（新しい作業台＋いままでの審査）と
// 桜井版（リニューアル前の作業台＋桜井式の審査）を切り替える。攻めの帯・途中経過の票読み・競技規則の第四条。
// 何も選んでいない端末はリニューアル（core/craft-version.js）。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const CONFIG_KEY = "suien_remake_config";
const t = (id) => `[data-test="${id}"]`;
const titleReady = (page) => page.locator(t("title-new")).waitFor({ timeout: 40000 });
const checkedVersion = (page) => page.locator(`${t("cfg-craft-version")} button[aria-checked="true"]`).getAttribute("value");
const benchVersion = (page) => page.locator(".bench").first().getAttribute("data-craft-version");
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
    await page.locator(t("title-config")).click();
    assert.deepEqual(await page.locator(`${t("cfg-craft-version")} button`).allTextContents(), ["リニューアル", "桜井版"]);
    assert.equal(await page.locator(t("cfg-vote-style")).count(), 0, "審査の方式だけの設定は無い（版で決まる）");
    assert.equal(await checkedVersion(page), "renewal", "何も選んでいない端末はリニューアル");
    assert(!(await ruleText(page)).includes("第四条"), "リニューアル（いままでの審査）の規則に審査の条は無い");
    // 桜井版を選ぶと保存され、次に開いても桜井版のまま。競技規則に桜井式の審査の条が出る。
    await page.locator(`${t("cfg-craft-version")} button[value="sakurai"]`).click();
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).craftVersion, CONFIG_KEY), "sakurai");
    await page.reload(); await titleReady(page);
    await page.locator(t("title-config")).click();
    assert.equal(await checkedVersion(page), "sakurai", "選んだ版は保たれる");
    assert.match(await ruleText(page), /第四条　審査.*その回に仕上げた工程だけ.*攻めの帯/);
    await page.locator(`${t("cfg-craft-version")} button[value="renewal"]`).click();
    assert(!(await ruleText(page)).includes("第四条"), "リニューアルへ戻すと、いままでの規則");
  });

  await check("sakurai-match-attack-band-and-board", async (page) => {
    // 途中経過の札（審査員ごとの見る所）は自動送りで短く出るので、始める前から待っておく。
    const focus = page.locator(t("judge-focus")).first().waitFor({ state: "attached", timeout: LONG }).then(() => true, (error) => error);
    await startTournament(page, { aim: "attack" });
    await page.locator(t("attack-band")).waitFor({ state: "visible", timeout: LONG });
    assert.equal(await benchVersion(page), "sakurai", "桜井版の試合は、リニューアル前の作業台で作る");
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
  }, { pageEntry: `${baseURL}?craft=sakurai` });

  await check("classic-match-has-no-attack-band", async (page) => {
    await startTournament(page);
    await page.locator(t("pull-temperature")).waitFor({ state: "visible", timeout: LONG });
    assert.equal(await page.locator(t("attack-band")).count(), 0, "いままでの審査では攻めの帯を出さない");
    assert.equal(await benchVersion(page), "renewal", "リニューアルの試合は、新しい作業台で作る");
    const p = await voteAttempt(page);
    assert.equal(p.rulesVersion, 2); assert.equal(p.style, undefined);
  });

  await check("url-overrides-setting", async (page) => {
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ craftVersion: "renewal" })), CONFIG_KEY);
    await page.goto(`${baseURL}?craft=sakurai`, { waitUntil: "load" }); await titleReady(page);
    await startTournament(page);
    await page.locator(t("attack-band")).waitFor({ state: "attached", timeout: LONG });
    assert.equal((await voteAttempt(page)).style, "sakurai", "?craft=sakurai は設定より優先");
    assert.equal(await benchVersion(page), "sakurai");
  });
});
