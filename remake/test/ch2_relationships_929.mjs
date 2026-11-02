// 第2章のオーナー採用改稿（#929）: なるとだけ本当に傷つき、あげは・神崎・REIは見捨てない。
// 台本の構造で確かめる（表示・保存はブラウザの ch2_story / ch2_tournament / story_canon が確認する）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { CH2_NIGHTS } from "../js/chapters/ch2-story-data.js";
import { CITY_OUTINGS, CITY_CHAIN, outingDialogue, recordOutingVisit } from "../js/chapters/ch2-outings.js";

const read = (name) => Object.fromEntries(JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url), "utf8"))
  .dialogues.map((d) => [d.dialogue_id, d]));
const all = (scene) => [...scene.lines, ...Object.values(scene.branches || {}).flat()];
const text = (scene) => all(scene).map((l) => l.text || "").join("\n");
const isolation = read("ch2_isolation"), main = read("ch2_main"), tournament = read("ch2_tournament");
const ch3 = read("ch3_main"), prep = read("ch2_preparation"), craft = read("tournament_craft"), echoes = read("ch2_choice_echoes");
const remake = read("remake_ch2"), ageha = read("ch2_ageha_story"), ch3volk = read("ch3_volk");

// DAY11: なるの店の話を画面で読ませ、その最中にスマホの採点表へ目が落ちる。省略した会話を後から叱らない
const naru = isolation.ch2_naru_confrontation;
const at = (re) => naru.lines.findIndex((l) => re.test(l.text || ""));
assert(at(/また来る/) >= 0 && at(/約束/) > at(/また来る/), "なるが店を続ける話を実際にする");
assert(at(/採点表/) > at(/約束/), "話の最中に採点表を見る");
assert(at(/点になるのか/) > at(/採点表/));
assert.doesNotMatch(text(naru), /さっきの話、聞いてたか|頭に入らない/);
const choice = naru.lines.find((l) => l.type === "choice");
assert.deepEqual(choice.choices.map((c) => c.next), ["listen", "push"], "既存の選択順と保存フラグを維持");
const flags = (branch) => naru.branches[branch].filter((l) => l.type === "set_flag").map((l) => l.flag);
assert.deepEqual(flags("listen"), ["_ch2_naru_listened"]); assert.deepEqual(flags("push"), ["_ch2_naru_hurt"]);
assert.match(naru.branches.listen.map((l) => l.text).join("\n"), /もう一回ちゃんと話そう/, "聞いても距離はすぐゼロにならない");
assert.match(naru.branches.push.map((l) => l.text).join("\n"), /勝ち負けの話はしてない[\s\S]*帰れ[\s\S]*返事は来なかった/);
assert.doesNotMatch(naru.branches.listen.map((l) => l.text).join("\n"), /勝ったのは/, "選んでいない強気の発言を足さない");
assert.match(echoes.remake_ch2_eve_choices.branches.hurt.map((l) => l.text).join("\n"), /既読/);

// 謙虚・休養を選んだ進行にも、一律の傲慢な独白を押し付けない
assert.doesNotMatch(text(main.ch2_sumi_silence), /勝てば、全部正しくなる/);

// DAY4: 安全確認と店の対応が先、常連の冗談は後。危険を軽く扱う地の文を残さない
const burn = main.ch2_sofa_burn.lines;
const safe = burn.findIndex((l) => /けがはなかった/.test(l.text || "")), joke = burn.findIndex((l) => l.speaker === "salaryman");
assert(safe > 0 && joke > safe);
assert.doesNotMatch(text(main.ch2_sofa_burn), /起こりうるミス/);
assert.equal(text(main.ch2_slump_taste).match(/いつもの(お前|はじめ)/g)?.length, 1, "スミの同じ意味の台詞を重ねない");

// DAY13: 搬入の確認から戻るあげはを、初対面のように迎えない
const eve = main.ch2_pre_tournament_realisation.lines;
assert.match(eve[1].text, /戻ってきた/); assert.doesNotMatch(text(main.ch2_pre_tournament_realisation), /何してんの/);

// DAY14: あげはは消えない。悔しさと祝福を両立し、関係は続く。神崎・REIも勝者を認める
const farewell = text(tournament.ch2_tournament_farewell);
assert.doesNotMatch(farewell, /理由は、聞かないで|消えた|もう帰るんですか/);
assert.match(farewell, /悔しい/); assert.match(farewell, /おめでと、ハジメっち/); assert.match(farewell, /うちの店/);
for (const id of ["kumicho", "rei", "ageha"]) assert(tournament.ch2_tournament_farewell.lines.some((l) => l.speaker === id), id);
assert(tournament.ch2_tournament_farewell.lines.some((l) => l.flag === "_ch2_ageha_secret"), "手の震えは秘密を知る保存だけ");
assert.doesNotMatch(tournament.ch2_tournament_farewell.lines.map((l) => l.text || "").join("\n"), /震え/);
assert.doesNotMatch(text(tournament.ch2_tournament_lobby), /帰って|来ないで/);
const waiting = craft.tournament_craft_waiting_2.lines;
for (const id of ["kumicho", "rei", "ageha"]) assert(waiting.some((l) => l.speaker === id), `制作中の ${id}`);
assert(waiting.some((l) => ["maezono", "dr_kemuri", "nagumo"].includes(l.speaker)), "審査員の短い反応");
assert.doesNotMatch(waiting.map((l) => l.text).join("\n"), /やもん|決めてん/);

// REI再訪: 曲の感想に具体的に答え、同じ空返事を繰り返さない
const rei = prep.remake_ch2_rei_repeat.lines.filter((l) => l.speaker === "hajime").map((l) => l.text);
assert.match(rei[0], /サビ|音/); assert.equal(new Set(rei).size, rei.length);

// 第3章（未接続）: なるへははじめから連絡し、あげはとは和解ではなく続いた友情
assert.match(ch3.ch3_naru_reconcile.lines[0].text, /自分から/);
const reunion = text(ch3.ch3_ageha_reunion);
assert.doesNotMatch(reunion, /逃げ|ごめん|怒ってる/); assert.match(reunion, /約束/);
// 新しい強制イベント（#929）: DAY2・DAY8の自由夜は空けたまま、既存の夜に順序を守って足す
const night = (day) => CH2_NIGHTS.find((n) => n.day === day);
assert(!night(2) && !night(8), "自由な夜を塞がない");
const ids = (day) => night(day).steps.map((s) => s.id);
assert.deepEqual(ids(5), ["ch2_kumicho_greeting", "ch2_slump_taste"]);
assert.deepEqual(ids(12), ["ch2_minto_warning", "ch2_naru_window"]);
assert.deepEqual(ids(13).slice(0, 3), ["ch2_tsumugi_color", "remake_ch2_eve_arrival", "remake_ch2_eve_rei"]);
const when = (day, id, flags) => { const step = night(day).steps.find((s) => s.id === id); return !step.when || step.when({ flags }); };
assert(when(5, "ch2_kumicho_greeting", {}) && !when(5, "ch2_kumicho_greeting", { _ch2_read_ch2_slump_taste: true }), "味の不調のあとに挨拶を戻さない");
assert(!when(12, "ch2_naru_window", {}), "DAY11の記録がない旧セーブには足さない");
assert(when(12, "ch2_naru_window", { _ch2_naru_listened: true }) && when(12, "ch2_naru_window", { _ch2_naru_hurt: true }));
assert(!when(12, "ch2_naru_window", { _ch2_naru_hurt: true, _ch2_read_ch2_tsumugi_color: true }));
assert(when(13, "remake_ch2_eve_rei", {}) && !when(13, "remake_ch2_eve_rei", { _ch2_read_ch2_pre_tournament_realisation: true }) && !when(13, "remake_ch2_eve_rei", { _ch2_eve_done: true }));
const greeting = main.ch2_kumicho_greeting, window = isolation.ch2_naru_window, eveRei = remake.remake_ch2_eve_rei;
for (const scene of [greeting, window, eveRei]) {
  assert(!all(scene).some((l) => l.type === "apply" || l.type === "note"), `${scene.dialogue_id}: 強制の夜に報酬を付けない`);
}
const told = greeting.lines.findIndex((l) => l.speaker === "sumi" && /落とした/.test(l.text || ""));
const advice = greeting.lines.findIndex((l) => l.speaker === "kumicho" && /生焼け/.test(l.text || ""));
assert(told > 0 && advice > told, "神崎は事故を見ていない。スミから聞いてから助言する");
assert.doesNotMatch(text(greeting), /ヤクザ|組長|極道/, "素性は大会の入場で本人が明かす");
for (const [scene, id] of [[greeting, "kumicho"], [eveRei, "rei"]]) {
  const cond = scene.lines.find((l) => l.type === "condition" && l.char_id === id);
  assert(scene.branches[cond.next_false].some((l) => l.flag === `_met_${id}`), `${id}: 初対面なら名乗って面識を記録`);
}
assert.match(window.lines.map((l) => l.text || "").join("\n"), /しばらく休業[\s\S]*行き先もない/);
assert(!all(window).some((l) => l.speaker === "naru" && /明後日|来たよ/.test(l.text || "")), "休業後ははじめに会わない");
assert.match(window.branches.hurt.map((l) => l.text).join("\n"), /既読[\s\S]*電話に出なかった/);
assert.match(window.branches.listened.map((l) => l.text).join("\n"), /もう一回[\s\S]*返事が来ない/);

// DAY14の入場後: 4台の前の掛け合い。神崎はあげはを『葉子の姉貴』と呼び、応援席は前夜の選択に従う。震えは秘密を知る保存だけ
const stations = tournament.ch2_tournament_stations;
assert.match(text(stations), /葉子の姉貴[\s\S]*本名で呼ぶな/);
assert.doesNotMatch(stations.lines.map((l) => l.text || "").join("\n"), /指先|震え/, "秘密の描写は分岐の中だけ");
assert(stations.lines.some((l) => l.flag === "_ch2_ageha_secret" && l.next_true === "secret"));
assert(stations.lines.some((l) => l.flag === "_ch2_no_audience" && l.next_true === "alone" && l.next_false === "other"));
assert.equal(stations.branches.other[0].flag, "_ch2_audience_welcome");
assert.match(stations.branches.welcome.map((l) => l.text).join("\n"), /つむぎ/);
assert(!all(stations).some((l) => ["apply", "note", "set_flag"].includes(l.type) || l.affinity || l.stats), "報酬・保存フラグを足さない");

// 章の最後: はじめのいない場面で、あげはの心の声だけ。才能の壁は両側にあった（本人には言わない嫉妬）
const heart = tournament.ch2_tournament_ageha_heart;
assert(!all(heart).some((l) => l.speaker === "hajime"), "はじめはこの場にいない");
const voice = heart.lines.filter((l) => l.speaker === "ageha").map((l) => l.text);
assert(voice.length >= 4 && voice.every((t) => /^（.*）$/.test(t)), "あげはの台詞はすべて心の声");
assert.match(voice.join("\n"), /崩れ/); assert.match(voice.at(-1), /こんなの、ズルいよ/);
assert.doesNotMatch(heart.lines.map((l) => l.text || "").join("\n"), /震え/, "震えは秘密を知る保存だけ");
assert.match(heart.branches.secret.map((l) => l.text).join("\n"), /震え/);
assert(!all(heart).some((l) => ["apply", "note", "set_flag"].includes(l.type)));
assert.match(craft.tournament_craft_waiting_2.lines.map((l) => l.text).join("\n"), /あげはの目が、こっちの手元/, "制作中の小さな伏線");

// 第3章のライバルの偵察（#929）: 名乗らない「？？？」が顔だけ見せて所々に現れる。第2章では名前・面識・会話を持たせない
for (const scene of [ageha.remake_ch2_ageha_tasting, remake.remake_ch2_eve_rei, tournament.ch2_tournament_entrance]) {
  const lines = all(scene), said = lines.filter((l) => l.speaker === "volk").map((l) => l.text);
  assert(said.length >= 1 && said.every((t) => t === "……"), `${scene.dialogue_id}: 台詞は無言だけ`);
  assert(!lines.some((l) => l.flag === "_met_volk" || l.type === "intro"), `${scene.dialogue_id}: 面識・紹介を付けない`);
  assert.doesNotMatch(text(scene), /ヴォルク|鉄の煙|ロシア|Железный/, `${scene.dialogue_id}: 名前と正体を出さない`);
  const hide = lines.findIndex((l) => l.type === "hide_portrait" && l.char_id === "volk");
  assert(hide > lines.findIndex((l) => l.speaker === "volk"), `${scene.dialogue_id}: 去ったら立ち絵を下げる`);
}
for (const scene of [ageha.remake_ch2_ageha_tasting, remake.remake_ch2_eve_rei]) assert(scene.lines.some((l) => l.flag === "_ch2_scout_seen"));
assert.match(text(main.ch2_pre_tournament_realisation), /うちの店にも来てた/);
assert.match(text(ageha.remake_ch2_ageha_tasting), /人を見る訓練/);
const meet = ch3volk.ch3_volk_first;
const deliveryRecognition = meet.lines.find((l) => l.flag === "_ch3_delivery_volk" && l.next_false === "delivery_original_recognition");
assert(deliveryRecognition, "未配達なら元の面識判定へ進む");
const scoutRecognition = meet.branches[deliveryRecognition.next_false].find((l) => l.flag === "_ch2_scout_seen");
assert.equal(scoutRecognition?.next_true, "seen_in_ch2");
assert.equal(scoutRecognition?.next_false, "unseen");
assert(meet.branches.unseen.length);
assert.match(meet.branches.seen_in_ch2.map((l) => l.text).join("\n"), /偵察[\s\S]*軍/, "第3章で、軍で覚えた偵察だと分かる");
// #1735: 新規ルートはDAY2の配達で必ず先に会う。配達済みでも、第2章で見た保存は偵察を回収する
const knownRecognition = meet.lines.find((l) => l.flag === "_ch3_delivery_volk" && l.next_true === "delivery_known_recognition");
const knownScout = meet.branches[knownRecognition.next_true].find((l) => l.flag === "_ch2_scout_seen");
assert(knownScout, "配達済みでも第2章の目撃で分ける");
assert.match(meet.branches[knownScout.next_true].map((l) => l.text).join("\n"), /配達の時は気づかなかった[\s\S]*偵察[\s\S]*軍/);
assert.doesNotMatch(meet.branches[knownScout.next_false].map((l) => l.text).join("\n"), /この辺の店を回って/, "配達で話していない情報を前提にしない");

// #1653 ⑥: 水族館・銭湯・C.STATIONの再訪は、能力値を足さずに会話の変化を順に読む
const deliveries = read("ch2_deliveries");
for (const outing of [...CITY_OUTINGS.filter((o) => o.kind === "outing"), CITY_CHAIN]) {
  const flags = {}, seen = [];
  for (let i = 0; i < 5; i += 1) { seen.push(outingDialogue(outing, flags)); recordOutingVisit(flags, outing); }
  assert.equal(seen[0], outing.first, `${outing.id}: 初回`);
  assert.deepEqual(seen.slice(1, 4), outing.repeat, `${outing.id}: 再訪は順に変わる`);
  assert.equal(seen[4], outing.repeat[0], `${outing.id}: 一巡したら最初へ`);
  for (const id of seen) assert(deliveries[id]?.lines?.length, `${id} の台本がある`);
  assert.equal(outingDialogue(outing, { [`_ch2_visited_${outing.id}`]: true }), outing.repeat[0], `${outing.id}: 旧セーブ`);
}
assert.equal(CITY_OUTINGS.find((o) => o.id === "ch2_aquarium").stat, undefined, "水族館に能力値を一律で足さない");

console.log("[ch2 relationships 929] PASS: Naru rupture on screen, choice depth, no forced arrogance, burn safety, Ageha stays, Kanzaki/REI moments, ch3 bridge, new forced nights, Ageha\'s last inner voice, anonymous scout");
