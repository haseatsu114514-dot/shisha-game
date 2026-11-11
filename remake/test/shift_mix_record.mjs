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

async function run(seed, choice, { cancelled = false, switchAt = null, flags = {}, chapter = 1 } = {}) {
  const owner = { chapter, day: 2, weatherSeed: seed, flags };
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
// 会話演出の印（[pause] 等。#2828）は表示に出ないので、外して比べる
const lines = after.lines.map(line => (line.text || "").replace(/\[\/?[a-z]+\]/g, ""));
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

// 章ごとの注文: 第1章は従来の4種だけ、第2〜5章はその章の専用の注文だけ（#2020 E で第3〜5章を足した）。
// 章付きの注文が無い章（第6章など想定外の値）は、従来の4種へ戻る。
{
  const ch2Orders = ["ch2_after_work", "ch2_strawberry_light", "ch2_night_deep", "ch2_tropical_compare"];
  const byChapter = {
    1: orders, 2: ch2Orders,
    3: ["ch3_cant_say", "ch3_prefectural_fan", "ch3_send_off"],
    4: ["ch4_saw_nationals", "ch4_returning_citrus", "ch4_returning_after_work"],
    5: ["ch5_tsumugi_explain", "ch5_tsumugi_advise", "ch5_tsumugi_sumi_words", "ch5_world_viewer"],
    6: orders,
  };
  const seenByChapter = Object.fromEntries(Object.keys(byChapter).map(chapter => [chapter, new Set()]));
  for (const chapter of Object.keys(byChapter).map(Number)) for (let seed = 0; seed < 64; seed++) for (const choice of [0, 1]) {
    const { owner, calls } = await run(seed, choice, { chapter });
    const mixKey = Object.keys(owner.flags).find(k => k.startsWith("_shift_mix_"));
    assert(mixKey, `chapter ${chapter} seed ${seed}: mix missing`);
    const id = mixKey.slice("_shift_mix_".length);
    seenByChapter[chapter].add(id);
    assert.equal(owner.flags[mixKey], choice);
    assert.equal(owner.flags[`_shift_order_${chapter}:2`], true);
    const modal = calls.find(c => c.type === "modal");
    assert.equal(modal.options.options.length, 2);
    assert(dialogues[calls.find(c => c.type === "play").id], `chapter ${chapter}: reaction dialogue exists`);
  }
  for (const [chapter, ids] of Object.entries(byChapter)) assert.deepEqual([...seenByChapter[chapter]].sort(), [...ids].sort(), `chapter ${chapter}`);
  for (const id of [2, 3, 4, 5].flatMap(chapter => byChapter[chapter])) for (const kind of ["same", "diff"]) {
    const recall = dialogues[`shift_recall_${id}_${kind}`];
    assert(recall && recall.lines.length === 1 && recall.lines[0].speaker === "hajime" && /^（.+）$/.test(recall.lines[0].text), `${id}_${kind}`);
  }
  for (const id of ch2Orders) {
    const prev = 0;
    const { calls } = await run(0, 1, { chapter: 2, flags: { [`_shift_mix_${id}`]: prev } });
    const shown = calls.find(c => c.type === "play");
    if (!shown.id.includes(id)) continue;
    assert.deepEqual(shown.lines[0], dialogues[`shift_recall_${id}_diff`].lines[0]);
  }
}

// #2020 E: 第3章以降は任される中身が変わる（何を聞くか・どう受け取るか・どう伝えるか）。窓の見出し・前置き・問いは注文ごと。
{
  const seedFor = async (chapter, id) => {
    for (let seed = 0; seed < 256; seed++) {
      const { owner } = await run(seed, 0, { chapter });
      if (Object.hasOwn(owner.flags, `_shift_mix_${id}`)) return seed;
    }
    throw new Error(`no seed for ${id}`);
  };
  // 注文表: 二択で、配合は実在の葉・合計12g。選択肢は1行に収まる短さ（26字以内）。反応・思い出しの台詞がある。
  const table = vm.runInNewContext(`${tonari.slice(orderStart, functionStart)}\nSHIFT_ORDERS`, {});
  const flavors = new Set(JSON.parse(read("data/flavors.json")).flavors.map(flavor => flavor.id));
  for (const order of table) {
    assert.equal(order.labels.length, 2, order.id);
    for (const label of order.labels) assert([...label].length <= 26, `${order.id}: ${label}`);
    for (const mix of order.mixes) {
      assert.equal(Object.values(mix).reduce((sum, grams) => sum + grams, 0), 12, `${order.id}: 12g`);
      for (const id of Object.keys(mix)) assert(flavors.has(id), `${order.id}: unknown flavor ${id}`);
    }
    for (const id of order.reactions) assert(dialogues[id]?.lines?.length, id);
    if (order.returning) for (const index of [0, 1]) assert(dialogues[`shift_return_${order.id}_${index}`], `${order.id}_${index}`);
  }
  const body = async (chapter, id) => (await run(await seedFor(chapter, id), 0, { chapter })).calls.find(c => c.type === "modal").options;
  const first = await body(1, "citrus");
  assert.equal(first.title, "今日の注文");
  assert.match(first.body, /^前のお客さんを見送って、次の卓につく。<br>「.+」 店の葉で一台を作る。$/, "the first chapter keeps the old wording");
  const ask = await body(3, "ch3_cant_say");
  assert.match(ask.body, /「好みを聞かれても、うまく言えないんだよな」 作る前に、一つ聞いてみる。$/);
  assert.deepEqual([...ask.options.map(o => o.label)], ["最近おいしかった飲み物を聞く", "苦手な味を聞く"]);
  for (const id of ["ch5_tsumugi_explain", "ch5_tsumugi_advise", "ch5_tsumugi_sumi_words"]) {
    const junior = await body(5, id);
    assert.equal(junior.title, "つむぎの相談", `${id}: the junior asks, not a customer's order`);
    assert(!junior.body.startsWith("前のお客さんを見送って"), id);
  }
  // 第5章のつむぎは店員（#2606）。バイト姿の表情だけを使う。
  for (const suffix of ["explain_image", "explain_spices", "advise_remove_coal", "advise_edge_wait", "sumi_words_wait", "sumi_words_face"]) {
    const scene = dialogues[`shift_flavor_ch5_tsumugi_${suffix}`];
    const said = scene.lines.filter(line => line.speaker === "tsumugi");
    assert(said.length && said.every(line => line.face.startsWith("baito_")), suffix);
  }
  // スミさんの教えは、はじめの言い方で渡す（プロローグのように台詞をそのまま繰り返さない）。どちらの渡し方でもスミさんが気づく。
  for (const suffix of ["wait", "face"]) {
    const scene = dialogues[`shift_flavor_ch5_tsumugi_sumi_words_${suffix}`];
    assert(scene.lines.some(line => line.speaker === "sumi"), suffix);
    assert(!scene.lines.some(line => line.speaker === "hajime" && /燃やす|蒸らす/.test(line.text)), suffix);
  }
  // ダブルアップルの説明は正史どおり（林檎そのものの味にしない・アニスとリコリス）。
  const explain = dialogues.shift_flavor_ch5_tsumugi_explain_spices.lines.map(line => line.text).join("");
  assert(explain.includes("アニス") && explain.includes("リコリス"));
  assert(!/果汁|林檎飴/.test(dialogues.shift_flavor_ch5_tsumugi_explain_image.lines.map(line => line.text).join("")));

  // 前に接客した客: その客の前の注文（第1・2章）を受けた記録があれば、反応の前に何を出したかを思い出す。
  const reaction = calls => calls.find(c => c.type === "play");
  for (const [id, returning] of [["ch4_returning_citrus", "citrus"], ["ch4_returning_after_work", "ch2_after_work"]]) {
    const seed = await seedFor(4, id);
    const plain = reaction((await run(seed, 1, { chapter: 4 })).calls);
    assert.deepEqual(plain.lines, dialogues[plain.id].lines, `${id}: no record, no extra line`);
    for (const before of [0, 1]) {
      const { owner, calls } = await run(seed, 1, { chapter: 4, flags: { [`_shift_mix_${returning}`]: before } });
      const shown = reaction(calls);
      const welcome = dialogues[`shift_return_${id}_${before}`];
      assert(welcome && welcome.lines.length === 1 && welcome.lines[0].speaker === "hajime" && /^（.+）$/.test(welcome.lines[0].text), `${id}_${before}`);
      assert.deepEqual(shown.lines[0], welcome.lines[0], `${id}: remembers the earlier mix ${before}`);
      assert.equal(shown.lines.length, dialogues[shown.id].lines.length + 1);
      assert.equal(owner.flags[`_shift_mix_${returning}`], before, "the earlier record is only read");
      assert.equal(owner.flags[`_shift_mix_${id}`], 1);
    }
    // 今日の注文そのものを前にも受けていれば、そちらの一行だけ（二行重ねない）。
    const again = reaction((await run(seed, 1, { chapter: 4, flags: { [`_shift_mix_${returning}`]: 0, [`_shift_mix_${id}`]: 0 } })).calls);
    assert.deepEqual(again.lines[0], dialogues[`shift_recall_${id}_diff`].lines[0]);
    assert.equal(again.lines.length, dialogues[again.id].lines.length + 1);
    // 範囲外の記録は読まない
    const broken = reaction((await run(seed, 1, { chapter: 4, flags: { [`_shift_mix_${returning}`]: 7 } })).calls);
    assert.deepEqual(broken.lines, dialogues[broken.id].lines);
  }
  console.log("chapter 3-5 shift orders (#2020 E): OK");
}
