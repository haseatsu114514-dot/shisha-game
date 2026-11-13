// REL01〜03・06・07: 街の人同士のつながりを、実際の施設・店の来店で読む。
// 喫茶こはく（なると凛想）→ ケムリクサと2階の続き、観音堂（なるとアダム）→ EDENの続き、
// SHISHARK（みんとの開店祝い）→ ぺぱーみんとの続き、第5章の Dr.fookah の2階（凛想がなるにお茶を出す）、
// ぺぱーみんとのひよりの相席。施設の遭遇は好感度を動かさず、店の来店はいつもの来店と同じだけ。どれも一度きり。
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

  // REL06: 第5章の Dr.fookah の2階。最初の通いの小会話の次の来店で、いつもの会話の代わりに一度だけ。巡回の順番は進めない
  for (const lover of [false, true]) {
    await check(`ch5-showroom-tea-once-after-the-first-talk${lover ? "-lover" : ""}`, async page => {
      const r = await page.evaluate(async lover => {
        const core = await import("./js/core/state.js"), vn = await import("./js/vn/engine.js");
        const shops = await import("./js/chapters/ch5-shops.js"), ui = await import("./js/core/ui.js");
        // 本編は「新しく始める」「続きから」で会話の共通フック（恋人の分岐など）を入れる。ここでも同じものを入れる
        (await import("./js/chapters/ch1.js")).setupHooks();
        const s = core.newGame();
        Object.assign(s, { chapter: 5, phase: "daily", day: 52, slot: 1, money: 60000, stamina: 100, lovers: lover ? ["rio"] : [] });
        Object.assign(s.flags, { _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true, _ch2_region: "home",
          _spot_follow_rio_naru: true });
        Object.assign(s.met, { rio: true, naru: true });
        s.affinity.rio = 40;
        Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
        vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
        ui.showScreen("map", document.createElement("div"));
        const trace = [], enter = vn.hooks.onEnter;
        vn.hooks.onEnter = (id, dlg) => { enter?.(id, dlg); trace.push(id); };
        const rows = [];
        try {
          for (let n = 0; n < 3; n++) {
            vn.clearLog(); trace.length = 0;
            const before = s.affinity.rio;
            const visit = await shops.performChapterFiveShop(shops.chapterFiveShowroom(s), { staminaGuard: async () => true });
            rows.push({ visit, scene: trace[0], lines: vn.backlog().map(l => l.text), gained: s.affinity.rio - before });
            s.day += 1;
          }
        } finally { vn.hooks.onEnter = enter; }
        return { rows, seen: !!s.flags._talk_seen_ch5_rio_naru_tea, talks: s.flags._ch5_shop_talks?.ch5_rio_showroom };
      }, lover);
      assert.deepEqual(r.rows.map(row => row.scene), ["ch5_rio_shop", "ch5_rio_naru_tea", "ch5_rio_shop_b"], "the tea comes once, then the usual rotation resumes");
      for (const row of r.rows) assert.deepEqual(row.visit, { used: true, exerted: true });
      // いつもの小会話と同じ +5（恋人の好感度は店では深まらないので、恋人は両方とも 0）
      assert.equal(r.rows[1].gained, r.rows[0].gained, "the same visit affinity as the usual talk");
      assert.equal(r.rows[0].gained > 0, !lover);
      assert(r.seen); assert.equal(r.talks, 2, "the rotation count only counts the usual talks");
      const tea = r.rows[1].lines;
      assert(tea.some(t => t.includes("円頓寺さん")) && tea.some(t => t.includes("六分もった")));
      assert(tea.some(t => t.includes("三分で帰る")), "the earlier chapter-one remark is remembered when it was heard");
      assert.equal(tea.some(t => t.includes("大事にしろよ")), lover);
      assert.equal(tea.some(t => t.includes("数えてないけどね")), lover);
      assert.equal(tea.some(t => t.includes("十分を目指して")), !lover);
    });
  }

  // REL07: ぺぱーみんとでの、ひよりの相席。いつもの相席の代わりに一度だけ。ほかの店ではいつもの相席
  await check("hiyori-at-peppermint-meets-minto-once", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state, data = E.data, hiyori = await import("./js/daily/hiyori.js");
      await data.loadDeferredDialogues();
      Object.assign(s.flags, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true, _hiyori_message_delivered: true,
        _hiyori_cracks_done: true, _hiyori_clockout_done: true, _intro_hiyori: true, known_name_hiyori: true, _axe_bar_legacy_access: true });
      s.met.hiyori = true; s.affinity.hiyori = 20;
      const bg = "res://assets/backgrounds/peppermint.png";
      const run = async id => {
        E.clear(); const before = s.affinity.hiyori, count = s.flags._hiyori_repeat_count || 0;
        const ok = await hiyori.visitHiyoriAtShop(E.spots.spotById(id), { scheduledSpot: id, bg });
        const row = { ok, trace: E.trace, lines: E.lines(), names: E.vn.backlog().map(l => l.name).filter(Boolean),
          gained: s.affinity.hiyori - before, counted: (s.flags._hiyori_repeat_count || 0) - count };
        s.day += 1; return row;
      };
      const adam = await run("adam"), minto = await run("minto"), again = await run("minto");
      return { adam, minto, again, done: !!s.flags._hiyori_minto_seat_done };
    });
    assert(r.adam.ok && /^hiyori_shop_repeat_/.test(r.adam.trace[0]), "another shop keeps the usual seat");
    assert(r.minto.ok); assert.deepEqual(r.minto.trace, ["hiyori_shop_minto"]); assert(r.done);
    assert(r.minto.lines.some(t => t.includes("好きな自分で来てくれるお客さん")));
    assert(r.minto.names.includes("みんと") && r.minto.names.includes("ひより"), JSON.stringify(r.minto.names));
    // いつもの相席と同じ gainAffinity("hiyori", 10)。段階の上限の端数で実増加は1違うことがある
    assert(r.minto.gained > 0 && r.adam.gained > 0, "the same affinity as the usual seat");
    assert.equal(r.minto.counted, 0, "the usual seats keep their order");
    assert(r.again.ok && /^hiyori_shop_repeat_/.test(r.again.trace[0]), "only once");
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
