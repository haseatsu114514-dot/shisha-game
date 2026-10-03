// リメイクの実際の会話エンジンで、交流の記憶・振り返り・セーブ互換を確認する。
// リポジトリルートで http.server 8123 を起動してから実行（BASE_URL で変更可）。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/", { waitUntil: "load" });
  await page.waitForSelector('[data-test="title-new"]', { timeout: 20000 });
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const relationships = await import("./js/core/relationships.js");
    const vn = await import("./js/vn/engine.js");
    const chapter = await import("./js/chapters/ch1.js");
    core.newGame();
    chapter.setupHooks();
    vn.vnTest.turbo = true;
    const read = async (dialogue, choices = []) => {
      vn.backlog().length = 0;
      let index = 0;
      vn.vnTest.choose = () => choices[index++] || 0;
      await vn.play(dialogue);
      return vn.backlog().map((l) => l.text);
    };
    // 自動送りだけを速め、会話・状態・報酬・保存は本番の処理を使う。
    window.relationshipProbe = { core, relationships, vn, read };
  });

  // 訪問回数・好感度のある旧セーブも、読んでいない新しい台詞は記憶しない。
  const old = await page.evaluate(() => {
    const { core, relationships } = window.relationshipProbe;
    const saved = core.newState();
    saved.schema = 4;
    delete saved.relationshipMemories;
    saved.visits.tsumugi = 5;
    saved.affinity.tsumugi = 80;
    saved.story.tsumugi = 5;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(saved));
    const auto = core.load();
    const reflection = relationships.relationshipReflectionLines();
    localStorage.setItem("suien_remake_slot1", JSON.stringify(saved));
    const manual = core.loadFromSlot("suien_remake_slot1");
    const corrupt = { ...saved, relationshipMemories: { tsumugi: 5 } };
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(corrupt));
    const repaired = core.load();
    return { auto: auto.relationshipMemories, manual: manual.relationshipMemories,
      repaired: repaired.relationshipMemories, schema: auto.schema, expected: core.SCHEMA, reflection };
  });
  assert.deepEqual(old.auto, []);
  assert.deepEqual(old.manual, []);
  assert.deepEqual(old.repaired, []);
  assert.equal(old.schema, old.expected);
  assert.equal(old.reflection.length, 1);
  assert(!JSON.stringify(old.reflection).includes("つむぎ"));

  // 現在遊べる第1章の6人。誰か一人だけを選んでも、その相手の記憶が戻る。
  const firstScenes = {
    sumi: "ch1_sumi_basics", naru: "ch1_naru_first", adam: "ch1_adam_first",
    minto: "ch1_minto_first", tsumugi: "ch1_tsumugi_first", rin: "ch1_rin_first",
  };
  for (const [character, scene] of Object.entries(firstScenes)) {
    const result = await page.evaluate(async ({ scene }) => {
      const { core, read } = window.relationshipProbe;
      core.newGame();
      core.state.phase = "daily";
      const first = await read(scene);
      const memories = core.state.relationshipMemories.slice();
      const before = JSON.stringify(core.state);
      const reflection = await read({ dialogue_id: "reflection_test", lines: [{ type: "reflection" }] });
      return { memories, characters: memories.map((id) => window.__remake.DB.relationshipMemories[id].char_id),
        first, reflection, noBonus: before === JSON.stringify(core.state), lovers: core.state.lovers };
    }, { scene });
    assert.equal(result.memories.length, 1, scene);
    assert.deepEqual(result.characters, [character], scene);
    assert.equal(result.reflection.length, 3, scene);
    assert(result.noBonus, `Reflection changed state: ${scene}`);
    assert.deepEqual(result.lovers, [], scene);
    if (character === "tsumugi") assert(!result.first.some((t) => /約[5５]万/.test(t)), "SNS revealed too early");
  }

  // 選ばなかった分岐・存在しないIDは残らず、同じ会話を再読しても増えない。
  const branch = await page.evaluate(async () => {
    const { core, read } = window.relationshipProbe;
    core.newGame();
    const probe = {
      dialogue_id: "branch_memory_test",
      lines: [{ type: "choice", id: "pick", choices: [
        { text: "なる", next: "naru" }, { text: "みんと", next: "minto" },
      ] }],
      branches: {
        naru: [{ type: "remember", memory_id: "naru_hands" }],
        minto: [{ type: "remember", memory_id: "minto_welcome" }],
      },
    };
    const before = JSON.stringify({ ...core.state, relationshipMemories: [] });
    await read(probe, [1]);
    await read(probe, [1]);
    await read({ dialogue_id: "invalid_memory_test", lines: [
      { type: "remember", memory_id: "unknown_id" },
      { type: "remember", memory_id: "__proto__" },
      { type: "remember", memory_id: null },
    ] });
    return { memories: core.state.relationshipMemories,
      noBonus: before === JSON.stringify({ ...core.state, relationshipMemories: [] }) };
  });
  assert.deepEqual(branch.memories, ["minto_welcome"]);
  assert(branch.noBonus, "Remember added a reward");

  // 同じ相手は最新の言葉。四人以上と会っても直近の三人分だけを返す。
  const mixed = await page.evaluate(async () => {
    const { core, relationships, read } = window.relationshipProbe;
    core.newGame();
    core.state.phase = "daily";
    await read("ch1_tsumugi_first");
    const third = await read("ch1_tsumugi_third");
    await read("ch1_tsumugi_fourth", [1, 1]);
    await read("ch1_tsumugi_fifth", [1, 1]);
    await read("ch1_minto_first");
    await read("ch1_naru_first");
    const before = JSON.stringify(core.state);
    const three = await read({ dialogue_id: "three_people", lines: [{ type: "reflection" }] });
    const noBonus = before === JSON.stringify(core.state);
    await read("ch1_adam_first");
    const four = relationships.relationshipReflectionLines();
    const night = await read("ch1_day7_last_night", [2]);
    core.saveToSlot("suien_remake_slot2");
    return { third, three, four, night, noBonus, saved: core.state.relationshipMemories.slice() };
  });
  assert(mixed.third.some((t) => /約[5５]万/.test(t)), "SNS count not interpolated");
  assert(!mixed.third.some((t) => t.includes("{tsumugiFollowers}")));
  assert.equal(mixed.three.length, 5);
  assert(mixed.three.some((t) => t.includes("見てきたものが混ざって")));
  assert(!mixed.three.some((t) => t.includes("葉っぱがない日の猫も")), "Older memory repeated");
  assert(mixed.noBonus, "Mixed reflection changed state");
  assert.equal(mixed.four.length, 5);
  assert(!mixed.four.some((l) => l.text.includes("つむぎ")), "Fourth person retained over the newest three");
  assert(mixed.night.some((t) => t.includes("みんとの店")), "Night-before reflection missing");

  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('[data-test="title-new"]', { timeout: 20000 });
  const persisted = await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const auto = core.load().relationshipMemories.slice();
    core.newGame();
    const manual = core.loadFromSlot("suien_remake_slot2").relationshipMemories.slice();
    return { auto, manual };
  });
  assert.deepEqual(persisted.auto, mixed.saved);
  assert.deepEqual(persisted.manual, mixed.saved);
  assert.deepEqual(errors, []);
  console.log("[remake relationships] 6 solo routes, branches, re-read, invalid IDs, latest 3 people, SNS, save/old slots: PASS");
} finally {
  await browser.close();
}
