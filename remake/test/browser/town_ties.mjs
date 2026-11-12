// REL01〜03: 街の人同士のつながりを、実際の施設・店の来店で読む。
// 喫茶こはく（なると凛想）→ ケムリクサと2階の続き、観音堂（なるとアダム）→ EDENの続き、
// SHISHARK（みんとの開店祝い）→ ぺぱーみんとの続き。好感度・恋愛は動かさず、どれも一度きり。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";

const shots = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser/town-ties");
fs.mkdirSync(shots, { recursive: true });

async function setup(page) {
  await page.evaluate(async () => {
    window.E = {
      core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      stats: await import("./js/core/stats.js"), vn: await import("./js/vn/engine.js"),
      spots: await import("./js/daily/spots.js"), weather: await import("./js/daily/weather.js"),
      chapter: await import("./js/chapters/ch1.js"), intro: await import("./js/vn/intro.js"),
    };
    E.chapter.setupHooks(); E.vn.vnTest.turbo = true; E.core.config.textSpeed = 4;
    const s = E.core.newGame();
    // DAY8 の昼: 凛想が街にいて（出張の日ではない）、どの店も定休日ではない
    Object.assign(s, { phase: "daily", day: 8, slot: 0, stamina: 70, money: 60000,
      affinity: { naru: 20, adam: 20, minto: 30, rio: 20 }, story: { naru: 6, adam: 6, minto: 6, rio: 6 }, contacts: [] });
    for (const id of ["naru", "adam", "minto", "sumi", "rio"]) { E.core.markMet(id, { known: true }); E.intro.markIntroSeen(id); }
    Object.assign(s.flags, { _gym_member: true, _lime_tut: true, _errand_scout_done: true, _delivery_adam_done: true,
      _delivery_minto_done: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true, _cafe_introduced: true,
      _minto_identity_revealed: true, _minto_side_seat_done: true, _minto_quiet_hello_done: true,
      _minto_timer_hand_done: true, _minto_cheki_keep_done: true });
    for (let seed = 0; seed < 100; seed++) { s.weatherSeed = seed; if (!E.weather.isRainy()) break; }
    E.clear = () => { E.vn.backlog().length = 0; E.trace = []; };
    E.clear();
    const previous = E.vn.hooks.onLine;
    E.vn.hooks.onLine = (id, line) => { previous?.(id, line); if (E.trace.at(-1) !== id) E.trace.push(id); };
    E.relationship = () => { const v = E.core.state; return JSON.stringify([v.affinity, v.romance, v.lovers, v.finales, v.story, v.contacts]); };
    E.facility = id => { const spot = E.spots.spotById(id);
      return E.stats.paidAction(() => E.spots.visitSpot(spot), { ...E.spots.facilityGrowth(spot), consumed: () => true, exp: { key: spot.id, place: spot.id } }); };
    E.shop = id => E.stats.paidAction(() => E.spots.visitRival(E.spots.spotById(id)));
    E.lines = () => E.vn.backlog().map(line => line.text);
  });
}

await suite("town-ties", async check => {
  await check("naru-and-rio-at-the-cafe-then-both-shops-once", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.spotVisits = { cafe: 3 }; s.flags._spot_seen_cafe_naru_break = true; s.flags._spot_follow_naru = true;
      const before = E.relationship();
      await E.facility("cafe"); const cafe = { trace: E.trace, lines: E.lines(), names: E.vn.backlog().map(l => l.name) };
      const unchanged = before === E.relationship(), seen = !!s.flags._spot_seen_cafe_naru_rio;
      E.clear(); await E.shop("naru"); const naru = { trace: E.trace, lines: E.lines() };
      E.clear(); s.day = 11; await E.shop("naru"); const naruAgain = E.trace;
      E.clear(); s.slot = 1; await E.spots.visitChar("rio"); const rio = { trace: E.trace, lines: E.lines() };
      E.clear(); s.day = 12; await E.spots.visitChar("rio"); const rioAgain = E.trace;
      return { cafe, unchanged, seen, naru, naruAgain, rio, rioAgain, flags: [s.flags._spot_follow_naru_rio, s.flags._spot_follow_rio_naru] };
    });
    assert.deepEqual(r.cafe.trace, ["cafe_naru_rio"]); assert(r.unchanged && r.seen, "施設の遭遇は好感度を動かさない");
    assert(r.cafe.lines.some(t => t.includes("ケムリクサさん")) && r.cafe.lines.some(t => t.includes("円頓寺さん")));
    assert(r.cafe.names.includes("なる") && r.cafe.names.includes("凛想"), JSON.stringify(r.cafe.names));
    assert.equal(r.naru.trace[0], "cafe_naru_rio_followup"); assert(r.naru.lines.some(t => t.includes("誰にも言うなよ")), "恋人でなければ内緒の話");
    assert(!r.naruAgain.includes("cafe_naru_rio_followup"));
    assert.equal(r.rio.trace[0], "cafe_naru_rio_followup_rio"); assert(r.rio.lines.some(t => t.includes("怖いのかな")));
    assert(!r.rioAgain.includes("cafe_naru_rio_followup_rio")); assert.deepEqual(r.flags, [true, true]);
  });

  await check("naru-steps-back-when-rio-is-the-players-lover", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.lovers = ["rio"];
      Object.assign(s.flags, { _spot_seen_cafe_naru_break: true, _spot_follow_naru: true, _spot_seen_cafe_naru_rio: true });
      await E.shop("naru"); return { trace: E.trace, lines: E.lines() };
    });
    assert.equal(r.trace[0], "cafe_naru_rio_followup");
    assert(r.lines.some(t => t.includes("付き合ってんだろ")) && r.lines.some(t => t.includes("泣かすなよ")));
    assert(!r.lines.some(t => t.includes("誰にも言うなよ")));
  });

  await check("naru-feeds-adam-at-the-temple-then-the-box-at-eden", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.spotVisits = { kannon: 3 };
      Object.assign(s.flags, { _spot_seen_kannon_adam: true, _spot_follow_adam: true });
      const before = E.relationship();
      await E.facility("kannon"); const kannon = { trace: E.trace, lines: E.lines() };
      const unchanged = before === E.relationship();
      E.clear(); await E.shop("adam"); const eden = { trace: E.trace, lines: E.lines() };
      E.clear(); s.day = 11; await E.shop("adam"); const again = E.trace;
      return { kannon, unchanged, eden, again };
    });
    assert.deepEqual(r.kannon.trace, ["kannon_adam_lunch"]); assert(r.unchanged);
    assert(r.kannon.lines.some(t => t.includes("ダブルアップルの、次に")));
    assert.equal(r.eden.trace[0], "kannon_adam_lunch_followup"); assert(r.eden.lines.some(t => t.includes("鳴切の箱だ")));
    assert(!r.again.includes("kannon_adam_lunch_followup"));
  });

  await check("minto-talks-about-the-shark-shop-after-the-gift-was-seen", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.flags._spot_seen_samechan_shop_minto_gift = true; s.flags._spot_follow_minto = true;
      await E.shop("minto"); const first = { trace: E.trace, lines: E.lines(), names: E.vn.backlog().map(l => l.name).filter(Boolean) };
      E.clear(); s.day = 11; await E.shop("minto");
      return { first, again: E.trace };
    });
    assert.equal(r.first.trace[0], "samechan_minto_followup"); assert(r.first.lines.some(t => t.includes("自分が転ばない道")));
    assert(!r.again.includes("samechan_minto_followup"));
  });

  // 表示の確認: 実際の速度で喫茶こはくの場面を読み、なるが敬語になる台詞の画面を残す。途中で送っても最後まで読めば既読になる
  await check("cafe-scene-reads-through-at-normal-speed", async page => {
    await setup(page);
    await page.evaluate(() => {
      const s = E.core.state; s.spotVisits = { cafe: 3 }; s.flags._spot_seen_cafe_naru_break = true;
      E.vn.vnTest.turbo = false; E.pending = E.facility("cafe");
    });
    await page.locator("#vn.active").waitFor();
    for (let i = 0; i < 40; i++) {
      const text = await page.evaluate(() => E.lines().at(-1) || "");
      if (text.includes("円頓寺さん")) break;
      await page.keyboard.press("Enter"); await page.waitForTimeout(350);
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(shots, "cafe_naru_rio.png") });
    await page.evaluate(async () => { E.vn.vnTest.turbo = true; });
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => !!E.core.state.flags._spot_seen_cafe_naru_rio)) break;
      await page.keyboard.press("Enter"); await page.waitForTimeout(120);
    }
    await page.evaluate(() => E.pending);
    assert(await page.evaluate(() => !!E.core.state.flags._spot_seen_cafe_naru_rio));
  });
});
