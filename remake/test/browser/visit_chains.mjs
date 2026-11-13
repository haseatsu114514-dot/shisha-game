// 通いの続き（#2020 D）を本物の会話エンジンで読む: 選んだ答えの記録、条件 chain_pick / chain_fact、
// 恋愛の答えなどの既存フックを壊さないこと、交流の記憶と大会前夜の振り返り、未知の条件の警告が出ないこと。
// worktree の根で python3 -m http.server を起動してから: BASE_URL=http://127.0.0.1:8154/remake/ node remake/test/browser/visit_chains.mjs
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("visit-chains", async check => {
  await check("real-engine", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const vn = await import("./js/vn/engine.js");
      const ch1 = await import("./js/chapters/ch1.js");
      const chains = await import("./js/chapters/visit-chains.js");
      const play = await import("./js/chapters/visit-chain-play.js");
      const relationships = await import("./js/core/relationships.js");
      core.newGame();
      ch1.setupHooks();
      vn.vnTest.turbo = true;
      vn.clearVnWarnings();
      const ownHooks = { onChoice: vn.hooks.onChoice, evalCondition: vn.hooks.evalCondition };
      const state = () => core.state;
      // 1段を本物の play で読む（選択肢は picks の何番目かで選ぶ）。本文は会話ログから取る
      const readStage = async (place, choose = []) => {
        const due = await play.chainVisitDue(place);
        if (!due) return { id: null };
        let i = 0;
        vn.vnTest.choose = () => choose[i++] ?? 0;
        vn.backlog().length = 0;
        const done = await play.playChainStage(due, async id => { const r = await vn.play(id); return !!r && !r.cancelled; },
          { facts: { inn_trial: "rough" } });
        return { id: due.stage.id, done, texts: vn.backlog().map(line => line.text) };
      };
      const s = state();
      Object.assign(s, { chapter: 3, phase: "daily", day: 30, slot: 0 });
      s.flags._ch3_outings = { mukai_help: 1, mukai_steve: 1 };
      const tofu1 = await readStage("mukai", [2]);
      const same = await readStage("mukai");
      s.day += 1;
      const tofu2 = await readStage("mukai", [1]);
      s.day += 1;
      const tofu3 = await readStage("mukai");
      const reflection = relationships.relationshipReflectionLines({}).map(line => line.text);
      // 第4章: 読んでいる段の答え（chain_pick）と、呼び出し側の事実（chain_fact）
      Object.assign(s, { chapter: 4, day: 60, slot: 1 });
      s.flags._ch4_dubai_talks = { center_cafe: 3 };
      const bowl1 = await readStage("center_cafe");
      s.day += 1;
      const bowl2 = await readStage("inn", [2]);
      s.day += 1;
      const bowl3 = await readStage("center_cafe");
      return {
        tofu1, same, tofu2, tofu3, bowl1, bowl2, bowl3, reflection,
        records: { tofu: chains.chainRecord(s, "ch3_tofu"), bowl: chains.chainRecord(s, "ch4_second_bowl") },
        memories: s.relationshipMemories.slice(),
        warnings: vn.getVnWarnings(),
        hooksRestored: vn.hooks.onChoice === ownHooks.onChoice && vn.hooks.evalCondition === ownHooks.evalCondition,
        saved: JSON.parse(JSON.stringify(s.flags._visit_chains)),
      };
    });
    assert.equal(result.tofu1.id, "ch3_chain_tofu_1");
    assert(result.tofu1.done);
    assert(result.tofu1.texts.some(t => t.includes("台所のタイマーで五分")), "選んだ答え（待つ）の分岐");
    assert.equal(result.same.id, null, "同じ日は次の段を出さない");
    assert.equal(result.tofu2.id, "ch3_chain_tofu_2");
    assert(result.tofu2.texts.some(t => t.includes("仕込みの時の顔")), "2段目の答え（見ててください）");
    assert(result.tofu2.texts.some(t => t.includes("三回聞いた")), "1段目の答えが2段目に返る");
    assert(result.tofu3.texts.some(t => t.includes("家内とベランダ")) && result.tofu3.texts.some(t => t.includes("真似は")),
      "1・2段目の答えが3段目に返る");
    assert.deepEqual(result.records.tofu, { done: 3, day: 32, picks: { ch3_chain_tofu_1: "wait", ch3_chain_tofu_2: "watch" } });
    assert(result.memories.includes("tofu_regular_throat"), "交流の記憶が残る");
    assert(result.reflection.some(t => t.includes("喉が、静かだ")), "前夜の振り返りに出る");
    assert(result.bowl2.texts.some(t => t.includes("黙っていられる一台")), "読んでいる段の答え（軽い締め）で後半が変わる");
    assert(result.bowl3.texts.some(t => t.includes("締めの一台にしました")), "宿の答えがカフェに返る");
    assert(result.bowl3.texts.some(t => t.includes("冷房の風")), "宿の試作の結果（rough）が返る");
    assert(result.memories.includes("dubai_cafe_second_bowl"));
    assert.deepEqual(result.warnings.filter(w => /condition|branch/.test(w.kind)), [], "条件・分岐の警告が無い");
    assert(result.hooksRestored, "読んだ後は既存のフック（恋愛の答えなど）に戻る");
    assert.deepEqual(Object.keys(result.saved).sort(), ["ch3_tofu", "ch4_second_bowl"]);
  });
});
