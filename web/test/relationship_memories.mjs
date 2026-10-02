// 交流を実際に読んだ時だけ記憶し、恋人・人数・勝敗に依存せず振り返る。
// リポジトリルートで http.server 8123 を起動してから実行。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/web/", { waitUntil: "load" });
  await page.waitForSelector("#screen-title.active");
  await page.evaluate(() => {
    // 本番のエンジンと報酬・セーブ処理を使い、文字送りだけ即完了する。
    window.readRelationshipScene = (dialogue, choices = []) => {
      const text = [];
      const original = engine.ctx.onLine;
      engine.ctx.onLine = (speaker, line) => {
        text.push(line);
        original(speaker, line);
      };
      let done = false, choice = 0;
      try {
        playCustom(typeof dialogue === "string" ? D.dialogues[dialogue] : dialogue, () => { done = true; });
        for (let step = 0; step < 1000 && !done; step++) {
          if (engine.waitingChoice) {
            const buttons = document.querySelectorAll("#vn-choices .choice-btn");
            buttons[choices[choice++] || 0].click();
          } else {
            engine.completeTyping();
            engine.next();
          }
        }
        if (!done) throw new Error(`Dialogue did not finish: ${engine.dialogueId}`);
        return text;
      } finally { engine.ctx.onLine = original; }
    };
  });

  // 訪問・好感度があっても未読の新しい台詞を捏造しない。旧セーブの移行。
  const old = await page.evaluate(() => {
    const saved = newState();
    delete saved.relationshipMemories;
    saved.phase = "daily";
    saved.flags._tutorial_done = true;
    saved.visits.tsumugi = 5;
    saved.affinity.tsumugi = 5;
    continueGame(saved);
    return { memories: state.relationshipMemories, reflection: relationshipReflectionLines() };
  });
  assert.deepEqual(old.memories, []);
  assert.equal(old.reflection.length, 1);
  assert(!JSON.stringify(old.reflection).includes("つむぎ"));

  // 各訪問先だけを選ぶプレイでも、その相手の交流が内心に残る（恋人なし）。
  const firstScenes = {
    sumi: "ch1_sumi_basics", naru: "ch1_naru_first", adam: "ch1_adam_first",
    minto: "ch1_minto_first", tsumugi: "ch1_tsumugi_first", rin: "ch1_rin_first",
    ageha: "ch2_ageha_first", kumicho: "ch2_kumicho_first", rei: "ch2_rei_first", volk: "ch2_volk_first",
  };
  for (const [character, scene] of Object.entries(firstScenes)) {
    const result = await page.evaluate(({ character, scene }) => {
      state = newState();
      state.phase = "daily";
      state.chapter = scene.startsWith("ch2") ? 2 : 1;
      readRelationshipScene(scene);
      const memories = state.relationshipMemories.slice();
      const stats = JSON.stringify([state.stats, state.statXp, state.affinity]);
      const text = readRelationshipScene({ dialogue_id: "reflection_test", lines: [{ type: "reflection" }] });
      return { memories, characters: memories.map(id => D.relationship_memories[id].char_id), text,
        noBonus: stats === JSON.stringify([state.stats, state.statXp, state.affinity]), lovers: state.lovers };
    }, { character, scene });
    assert(result.memories.length > 0, scene);
    assert.deepEqual(result.characters, [character], scene);
    assert.equal(result.text.length, 3, scene);
    assert(result.noBonus, `Reflection added a reward: ${scene}`);
    assert.deepEqual(result.lovers, [], scene);
  }

  // 選ばなかった分岐の記憶は増えない。再読は重複しない。
  const branch = await page.evaluate(() => {
    state = newState(); state.phase = "daily";
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
    readRelationshipScene(probe, [1]); readRelationshipScene(probe, [1]);
    rememberRelationship("unknown_id");
    return state.relationshipMemories;
  });
  assert.deepEqual(branch, ["minto_welcome"]);

  // 深い交流の最新の言葉が残り、複数の相手を過剰な一覧にしない。
  const mixed = await page.evaluate(() => {
    state = newState(); state.phase = "daily"; state.flags._tutorial_done = true;
    readRelationshipScene("ch1_tsumugi_first");
    const early = state.relationshipMemories.slice();
    const third = readRelationshipScene("ch1_tsumugi_third");
    readRelationshipScene("ch1_tsumugi_fourth", [1, 1]);
    readRelationshipScene("ch1_tsumugi_fifth", [1, 1]);
    readRelationshipScene("ch1_minto_first"); readRelationshipScene("ch1_naru_first");
    const reflection = relationshipReflectionLines();
    const stats = JSON.stringify([state.stats, state.statXp, state.affinity]);
    const rendered = readRelationshipScene("ch1_day7_last_night", [1]);
    save();
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const before = saved.relationshipMemories.slice();
    state = newState(); continueGame(saved);
    return { early, third, reflection, rendered, before, after: state.relationshipMemories,
      noRomance: state.lovers.length === 0, statsBeforeNight: stats };
  });
  assert.deepEqual(mixed.early, ["tsumugi_creature"]);
  assert(mixed.third.some(t => t.includes("約5万")), "SNS follower count was not interpolated");
  assert(!mixed.third.some(t => t.includes("{tsumugiFollowers}")));
  assert.equal(mixed.reflection.length, 5);
  assert(mixed.reflection.some(l => l.text.includes("見てきたものが混ざって")));
  assert(!mixed.reflection.some(l => l.text.includes("葉っぱがない日の猫も")), "Older memory repeated");
  assert(mixed.rendered.some(t => t.includes("みんとの店")));
  assert.deepEqual(mixed.after, mixed.before);
  assert(mixed.noRomance);
  assert.deepEqual(errors, []);
  console.log("[relationships] 10 solo routes, unseen branches, re-read, mixed reflection, SNS reveal, save/old save: OK");
} finally { await browser.close(); }
