import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const tonari = read("remake/js/daily/tonari.js");
const orderStart = tonari.indexOf("const SHIFT_ORDERS = [");
const functionStart = tonari.indexOf("async function serveShiftOrder()");
const functionEnd = tonari.indexOf("\n}\n", functionStart) + 2;
assert(orderStart >= 0 && functionStart > orderStart && functionEnd > functionStart);
const source = `${tonari.slice(orderStart, functionStart)}\n${tonari.slice(functionStart, functionEnd)}\nserveShiftOrder`;
const orders = ["citrus", "fruit_mint_free", "sweet_round", "double_apple"];
const dialogues = Object.fromEntries(JSON.parse(read("data/dialogue/remake_ch1.json")).dialogues.map(d => [d.dialogue_id, d]));

async function run(seed, choice, { cancelled = false, switchAt = null, flags = {} } = {}) {
  const owner = { chapter: 1, day: 2, weatherSeed: seed, flags };
  const calls = [];
  const context = { state: owner, TONARI_BG: "tonari", DB: { dialogues },
    modal: async options => {
      calls.push({ type: "modal", options });
      if (switchAt === "modal") context.state = { ...owner, flags: {} };
      return choice;
    },
    play: async dlg => {
      calls.push({ type: "play", id: typeof dlg === "string" ? dlg : dlg.dialogue_id, lines: typeof dlg === "string" ? dialogues[dlg].lines : dlg.lines });
      if (switchAt === "play") context.state = { ...owner, flags: {} };
      return { cancelled };
    } };
  const serve = vm.runInNewContext(source, context);
  await serve();
  return { owner, calls, serve };
}

const seen = new Set();
for (let seed = 0; seed < 64; seed++) {
  for (const choice of [0, 1]) {
    const { owner, calls, serve } = await run(seed, choice);
    const reaction = calls.find(c => c.type === "play")?.id;
    assert(reaction, `seed ${seed}: reaction missing`);
    const id = orders.find(order => reaction.startsWith(`shift_flavor_${order === "fruit_mint_free" ? "fruit" : order === "sweet_round" ? "sweet" : order}_`));
    assert(id, `unknown reaction ${reaction}`);
    seen.add(id);
    assert.equal(owner.flags[`_shift_mix_${id}`], choice);
    assert.equal(owner.flags["_shift_order_1:2"], true);
    await serve();
    assert.equal(calls.length, 2, "same-day revisit must not replay or overwrite");
    assert.equal(owner.flags[`_shift_mix_${id}`], choice);
  }
}
assert.deepEqual([...seen].sort(), [...orders].sort());
for (const choice of [null, -1, 2, 1.5]) {
  const { owner, calls } = await run(0, choice);
  assert.equal(calls.some(c => c.type === "play"), false);
  assert.deepEqual(owner.flags, {});
}
for (const opts of [{ cancelled: true }, { switchAt: "modal" }, { switchAt: "play" }]) {
  const { owner } = await run(0, 0, opts);
  assert.deepEqual(owner.flags, {});
}
{
  const flags = { _shift_mix_citrus: 1 };
  const { owner } = await run(0, 0, { cancelled: true, flags });
  assert.equal(owner.flags._shift_mix_citrus, 1, "cancellation must preserve previous mix");
}

// #1415: 同じ注文が前にもあったら、反応の前にはじめの心の声を一行足す。前回と同じか違うかで変える。
{
  const first = (await run(0, 0)).calls.find(c => c.type === "play");
  const orderId = Object.keys((await run(0, 0)).owner.flags).find(k => k.startsWith("_shift_mix_")).slice("_shift_mix_".length);
  assert.notEqual(first.lines[0].speaker, "hajime", "first visit has no recall line");
  for (const [prev, choice, kind] of [[0, 0, "same"], [1, 1, "same"], [0, 1, "diff"], [1, 0, "diff"]]) {
    const { owner, calls } = await run(0, choice, { flags: { [`_shift_mix_${orderId}`]: prev } });
    const shown = calls.find(c => c.type === "play");
    const recall = dialogues[`shift_recall_${orderId}_${kind}`];
    assert(recall, `recall ${orderId}_${kind}`);
    assert(shown.id.startsWith("shift_flavor_"), "reaction keeps its own dialogue id");
    assert.deepEqual(shown.lines[0], recall.lines[0]);
    assert.equal(shown.lines.length, recall.lines.length + dialogues[shown.id].lines.length);
    assert.equal(owner.flags[`_shift_mix_${orderId}`], choice);
  }
}
for (const id of orders) for (const kind of ["same", "diff"]) {
  const recall = dialogues[`shift_recall_${id}_${kind}`];
  assert(recall && recall.lines.length === 1 && recall.lines[0].speaker === "hajime" && /^（.+）$/.test(recall.lines[0].text), `${id}_${kind}`);
}

const remake = JSON.parse(read("data/dialogue/remake_ch1.json"));
const expected = new Map([
  ["citrus_lemon_mint", ["レモン", "ミント", "レモンがはっきりしてる。後味は涼しいね"]],
  ["citrus_orange_lemon", ["オレンジ", "レモン", "オレンジの香り、いいね。酸味もあって、重く残らない"]],
  ["fruit_blueberry_peach", ["ブルーベリー", "ピーチ", "桃の香りもする。ミントなしで、この感じがいい"]],
  ["fruit_grape_orange", ["グレープ", "オレンジ", "ぶどうの甘い香りに、オレンジの感じもあるね"]],
  ["sweet_vanilla_coconut", ["バニラ", "ココナッツ", "バニラとココナッツか。甘い香りで、ほっとする"]],
  ["sweet_peach_vanilla", ["ピーチ", "バニラ", "桃の香りだ。お菓子っぽいのに、果物の感じも残るんだね"]],
  ["double_apple_mint", ["ダブルアップル", "ミント", "アニスの香りはそのままで、少しだけ涼しい。これくらいがいい"]],
  ["double_apple_solo", ["ダブルアップル", "だけ", "アニスの香りが、しっかりする。今日はこれがいいな"]],
]);
const openings = new Set();
for (const [suffix, [first, second, response]] of expected) {
  const scene = remake.dialogues.find(d => d.dialogue_id === `shift_flavor_${suffix}`);
  assert(scene, suffix);
  assert.equal(scene.lines.length, 3);
  const opening = scene.lines[0].text;
  assert(opening.includes(first) && opening.includes(second), suffix);
  assert(!openings.has(opening), `duplicate opening: ${suffix}`);
  openings.add(opening);
  assert.equal(scene.lines[1].speaker, "customer");
  assert.equal(scene.lines[1].text, response);
  const trailing = suffix.startsWith("citrus_") ? "客はホースを持ち直し、もう一口吸った。"
    : suffix.startsWith("fruit_") ? "客は煙の香りをもう一度確かめて、小さく笑った。"
      : suffix.startsWith("sweet_") ? "客は小さく頷いて、ホースを置いた。"
        : "客は目を細めて、ゆっくり煙を吐いた。";
  assert.equal(scene.lines[2].text, trailing);
}
assert.equal(openings.size, 8);

const tournament = JSON.parse(read("data/dialogue/ch1_tournament.json"));
const after = tournament.dialogues.find(d => d.dialogue_id === "ch1_tournament_after");
assert(after);
const lines = after.lines.map(line => line.text || "");
assert(lines.includes("……今日の煙、すごかったです。きれいでした、……でも"));
assert(lines.includes("……最後の方の、はじめさんの顔。少しだけ、浮かれて見えました"));
assert(lines.includes("ドアベルが鳴って、彼女は夜に消えた。浮かれてた？ 優勝した日の、俺の顔が？"));
assert(!lines.some(text => text.includes("濁ってた") || text.includes("優勝した日の煙が")));
for (const flag of ["_met_tsumugi", "_tsumugi_contest_submitted"]) {
  assert(after.lines.some(line => line.type === "condition" && line.condition_type === "flag" && line.flag === flag));
}
for (const branch of ["ta_tsumugi_named", "ta_tsumugi_unnamed", "ta_tsumugi_today", "ta_tsumugi_no_draft", "ta_growth_echo", "iv_pride", "iv_honest"]) {
  assert(Array.isArray(after.branches[branch]), branch);
}
console.log("shift mix record, dialogue, and tournament feedback: OK");
