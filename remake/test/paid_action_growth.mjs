// 実際の台本・訪問・バイトを通して、無料成長と重複報酬の偏りを検証。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  const report = await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), stats = await import("./js/core/stats.js");
    const vn = await import("./js/vn/engine.js"), spots = await import("./js/daily/spots.js");
    const tonari = await import("./js/daily/tonari.js"), shop = await import("./js/daily/shop.js");
    const hours = await import("./js/daily/spot-hours.js");
    const reel = await import("./js/daily/reel.js"), craft = await import("./js/craft/session.js");
    vn.vnTest.turbo = true; craft.craftTest.auto = "good";
    function reset() { core.newGame(); core.state.phase = "daily"; core.state.day = 8;
      core.state.reel.installed = true; core.state.reel.introDone = true; core.state.slot = 1; core.state.weatherSeed = 4; }
    const xp = () => Object.values(core.state.stats).reduce((sum, n) => sum + n - 10, 0);
    reset(); const money = core.state.money;
    stats.earnStat("guts", 8); stats.applyStats({ technique: 8 });
    await vn.play("remake_tutorial_result");
    await vn.play("remake_day1_errand_shop");
    await spots.visitRival(spots.spotById("naru")); // 強制偵察: 消耗しても自由行動の外
    const forced = { xp: xp(), before: JSON.stringify(core.state.reel) };
    reel.onAction();
    forced.sameReel = forced.before === JSON.stringify(core.state.reel); delete forced.before;
    const cases = [];
    let rinRefusal = null;
    for (const [name, run] of [
      ["naru", () => spots.visitRival(spots.spotById("naru"))],
      ["adam", () => spots.visitRival(spots.spotById("adam"))],
      ["minto", () => spots.visitRival(spots.spotById("minto"))],
      ["rin", () => shop.visitRin()], ["tsumugi", () => tonari.tonariCustomer()],
      ["choizap", () => spots.visitSpot(spots.spotById("choizap"))],
      ["c_station", () => spots.visitSpot(spots.spotById("c_station"))],
      ["cafe", () => spots.visitSpot(spots.spotById("cafe"))],
      ["kannon", () => spots.visitSpot(spots.spotById("kannon"))],
      ["rest", () => spots.restAtHome(spots.spotById("rest"))],
    ]) {
      reset(); core.state.stamina = 80;
      if (name === "cafe") core.state.slot = 0; // 喫茶こはくの営業時間内で回復を検証。
      // つむぎは固定回(day1/3)の読了後、day8の昼枠(slot 0)で在店する（tsumugi-schedule.js の tsumugiAtTonari）。
      if (name === "tsumugi") { core.state.slot = 0; core.state.flags._tsumugi_contest_research = true; core.state.flags._tsumugi_contest_progress = true; }
      const previous = { ...core.state.stats };
      const { spent } = await stats.paidAction(run);
      const perStat = Object.fromEntries(core.STAT_KEYS.map(k => [k, core.state.stats[k] - previous[k]]));
      const earned = xp(); reel.onAction({ spent });
      cases.push({ name, spent, earned, perStat, spins: core.state.reel.count });
      if (spent > 0) {
        if (name === "rin") {
          const snapshot = JSON.stringify(core.state), count = core.state.reel.count;
          const refused = await stats.paidAction(run);
          reel.onAction({ spent: refused.spent });
          rinRefusal = { spent: refused.spent, unchanged: snapshot === JSON.stringify(core.state), spins: core.state.reel.count - count };
          // 同日再訪の拒否を確認し、既存の再訪報酬assertは次の営業夜で実行する。
          for (let i = 0; i < 7 && hours.rinUnavailable(core.state); i++) core.state.day++;
          if (hours.rinUnavailable(core.state)) throw new Error("No available Rin night in the next week");
        }
        const before = xp();
        const previous = { ...core.state.stats };
        const repeat = await stats.paidAction(run);
        const perStat = Object.fromEntries(core.STAT_KEYS.map(k => [k, core.state.stats[k] - previous[k]]));
        const repeatEarned = xp() - before, count = core.state.reel.count;
        reel.onAction({ spent: repeat.spent });
        cases.push({ name: `repeat:${name}`, spent: repeat.spent, earned: repeatEarned, perStat, spins: core.state.reel.count - count });
      }
    }
    // B05: 必須のスミ会話を読んでから退勤する。給料・物語と成長枠を確認。
    reset();
    const timer = setInterval(() => {
      document.querySelector('[data-test="shift-order-0"]')?.click();
      document.querySelector('[data-test="after-none"]')?.click();
    }, 20);
    try {
      const before = core.state.money;
      const { spent } = await stats.paidAction(() => tonari.doBaito());
      const earned = xp(); reel.onAction({ spent });
      cases.push({ name: "baito:mandatory-sumi", spent, earned, pay: core.state.money - before, spins: core.state.reel.count });
    } finally { clearInterval(timer); }
    // 誘いは会話の後払いでも成長する。低体力で実消耗ゼロなら経験値も付かない。
    reset();
    const invitation = await stats.paidAction(async () => {
      await vn.play({ dialogue_id: "__paid_invite", metadata: { add_stat: { insight: 9 } },
        growth_stats: { insight: 9 }, lines: [{ text: "……【技術】が少し上がった。" },
          { type: "apply", stats: { insight: 9 } }] });
      stats.addStamina(-10);
    });
    const invitationXp = xp();
    const invitationSave = JSON.stringify({ stats: core.state.stats, carry: core.state.statXp });
    core.save(); core.newGame(); core.load();
    const carrySaved = invitationSave === JSON.stringify({ stats: core.state.stats, carry: core.state.statXp });
    reset(); core.state.stamina = 0;
    const zero = await stats.paidAction(async () => { stats.applyStats({ technique: 20 }); stats.addStamina(-24); });
    const zeroXp = xp(); reel.onAction({ spent: zero.spent }); const zeroSpins = core.state.reel.count;
    reset();
    await stats.paidAction(async () => { stats.applyStats({ technique: 1 }); stats.addStamina(-8); });
    const smallXp = xp();
    // 好感度と混在する旧キューは能力文だけ省略し、好感度の加算・ログは維持。
    reset(); vn.hooks.contextChar = "naru";
    await vn.play({ dialogue_id: "__mixed_reward", lines: [
      { text: "……【技術】と【好感度】が少し上がった。" }, { text: "次の場面へ。" }] });
    const mixed = { xp: xp(), affinity: core.state.affinity.naru,
      text: vn.backlog().slice(-2).map(l => l.text).join(" ") };
    // 既存セーブの残高を初期金額で置き換えない。
    reset(); core.state.money = 12345; core.save(); core.newGame(); core.load();
    return { money, forced, cases, rinRefusal, carrySaved, invitationSpent: invitation.spent, invitationXp, zeroXp, zeroSpins, smallXp, mixed,
      restoredMoney: core.state.money };
  });
  assert.equal(report.money, 30000); assert.equal(report.restoredMoney, 12345);
  assert.deepEqual(report.forced, { xp: 0, sameReel: true });
  assert.deepEqual(report.rinRefusal, { spent: 0, unchanged: true, spins: 0 });
  for (const entry of report.cases) {
    const recovery = entry.name === "rest";
    assert.equal(entry.spins > 0, !recovery, JSON.stringify(entry));
    if (recovery) assert.equal(entry.earned, 0);
    else {
      assert(entry.spent > 0);
      assert(entry.earned >= 1 && entry.earned <= 2, JSON.stringify(entry));
      if (entry.perStat) assert(Object.values(entry.perStat).every(n => n === 0 || n === 1), JSON.stringify(entry));
    }
    if (entry.pay !== undefined) assert(entry.pay >= 8000);
  }
  assert(report.carrySaved); assert.equal(report.invitationSpent, 10); assert.equal(report.invitationXp, 2);
  assert.equal(report.zeroXp, 0); assert.equal(report.zeroSpins, 0); assert.equal(report.smallXp, 1);
  assert.equal(report.mixed.xp, 0); assert(report.mixed.affinity > 0);
  assert.match(report.mixed.text, /【好感度】が少し上がった。/);
  assert.doesNotMatch(report.mixed.text, /【技術】/);
  assert.deepEqual(errors, []);
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(report, null, 2));
  console.log("[paid growth] PASS", JSON.stringify(report));
} finally { await browser.close(); }
