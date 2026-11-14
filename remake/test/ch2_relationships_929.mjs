// 第2章のオーナー採用改稿（#929）: なるとだけ本当に傷つき、あげは・神崎・クラウドは見捨てない。
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
// #2720: 「返事はまだない」は、DAY12に休みの店の前で送ったLIMEを読んだ時だけ。送っていなければ約束だけを思い出す
const listened = echoes.remake_ch2_eve_choices.branches;
const sentCheck = listened.listened.find((l) => l.type === "condition");
assert.deepEqual([sentCheck.flag, sentCheck.next_true, sentCheck.next_false], ["_ch2_read_ch2_naru_window", "listened_sent", "listened_promise"]);
assert.match(listened.listened_sent.map((l) => l.text).join("\n"), /今どこにいますか[\s\S]*返事はまだない/);
assert.doesNotMatch(listened.listened_promise.map((l) => l.text).join("\n"), /返事|送った/);
assert.doesNotMatch(listened.listened.map((l) => l.text || "").join("\n"), /返事/);

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

// DAY14: あげはは消えない。悔しさと祝福を両立し、関係は続く。神崎・クラウドも勝者を認める
const farewell = text(tournament.ch2_tournament_farewell);
assert.doesNotMatch(farewell, /理由は、聞かないで|消えた|もう帰るんですか/);
assert.match(farewell, /悔しい/); assert.match(farewell, /おめでと、ハジメっち/); assert.match(farewell, /うちの店/);
for (const id of ["kumicho", "rei", "ageha"]) assert(tournament.ch2_tournament_farewell.lines.some((l) => l.speaker === id), id);
assert(tournament.ch2_tournament_farewell.lines.some((l) => l.flag === "_ch2_ageha_secret"), "手の震えは秘密を知る保存だけ");
assert.doesNotMatch(tournament.ch2_tournament_farewell.lines.map((l) => l.text || "").join("\n"), /震え/);
assert.doesNotMatch(text(tournament.ch2_tournament_lobby), /帰って|来ないで/);
const waiting = craft.tournament_craft_waiting_2.lines;
for (const id of ["kumicho", "rei", "ageha"]) assert(waiting.some((l) => l.speaker === id), `制作中の ${id}`);
assert(waiting.some((l) => ["maezono", "dr_kemuri", "sui"].includes(l.speaker)), "審査員の短い反応");
assert.doesNotMatch(waiting.map((l) => l.text).join("\n"), /やもん|決めてん/);

// クラウド再訪: 一回目は分からなかったと言ってから、曲の感想に具体的に答え、同じ空返事を繰り返さない（2026-11-13 はじめは詳しくない）
const rei = prep.remake_ch2_rei_repeat.lines.filter((l) => l.speaker === "hajime").map((l) => l.text);
assert.match(rei[1], /サビ|音/); assert.equal(new Set(rei).size, rei.length);

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

// 全体講評（2026-11-11）S6: 優勝目当ての客。DAY3に大会の一台を半分残し、DAY6に軽い一台を最後まで吸う。
// 夜は増やさず、既存の夜の場面として足す。DAY3を見ていない保存には、続きの場面を足さない
assert.deepEqual(ids(3), ["ch2_naru_warm", "remake_ch2_ageha_scout", "ch2_title_customer_half"]);
assert.equal(night(3).steps[2].flag, "_stk_title_customer_half");
assert.deepEqual(ids(6), ["ch2_title_customer_back", "ch2_coal_together", "ch2_lingering_smell"]);
assert.equal(night(6).steps[0].flag, "_stk_title_customer_back");
assert(!when(6, "ch2_title_customer_back", {}), "DAY3の場面を見ていない保存には足さない");
assert(when(6, "ch2_title_customer_back", { _stk_title_customer_half: true }));
assert(!when(6, "ch2_title_customer_back", { _stk_title_customer_half: true, _ch2_read_ch2_coal_together: true }), "炭替えの後へ差し込まない");
const half = main.ch2_title_customer_half, back = main.ch2_title_customer_back, thermo = main.ch2_kemuri_thermometer;
const metCheck = half.lines.find((l) => l.type === "condition" && l.flag === "_stk_title_customer_met");
assert(metCheck && half.branches[metCheck.next_true].length && half.branches[metCheck.next_false].length, "第1章末を見た保存・見ていない保存の両方で読める");
assert.match(half.branches[metCheck.next_false].map((l) => l.text).join("\n"), /初めて見る顔[\s\S]*大会のやつ、頼める/);
// 第1章末で一度頼んでいる保存は二度目の来店。初めてのようには頼ませず、前回は帰ったあとの台を見ていなかったと受けてから、半分残った絵へ
const knownText = half.branches[metCheck.next_true].map((l) => l.text).join("\n");
assert.match(knownText, /優勝した人の店だよね[\s\S]*この前の、もう一回頼める/); assert.doesNotMatch(knownText, /初めて/);
assert(!half.lines.some((l) => l.speaker === "customer" && /頼める/.test(l.text)), "注文の言い方は面識で分ける");
const tableCheck = half.lines.filter((l) => l.type === "condition" && l.flag === "_stk_title_customer_met")[1];
assert(tableCheck && !tableCheck.next_false, "面識のない保存は、初めての客の文のまま");
assert.match(half.branches[tableCheck.next_true].map((l) => l.text).join("\n"), /この前は、帰ったあとの台を見ていなかった/);
assert.equal(half.lines.indexOf(tableCheck) + 1, half.lines.findIndex((l) => /葉は、半分残っている/.test(l.text || "")), "台を見ていなかった一行の直後に、半分残った絵を置く");
assert.match(half.lines.map((l) => l.text || "").join("\n"), /葉は、半分残っている[\s\S]*すごいのは、分かるんだけど[\s\S]*聞かなかった[\s\S]*組み直す/);
assert.match(text(back), /半分残した人[\s\S]*最後までいけた[\s\S]*点をつけた/);
assert.doesNotMatch(text(back), /おいし|甘|美味/, "味が遠い日のはじめに、味を語らせない");
for (const scene of [half, back]) {
  assert(all(scene).filter((l) => l.speaker && l.speaker !== "hajime").every((l) => l.speaker === "customer" && l.face === "normal"),
    `${scene.dialogue_id}: 客は名無しの customer（第3章の帰郷の客と同じ）`);
}
// DAY4の事故は、半分残された一台の居残りから続く（DAY3を見た保存だけ一行で受ける）
const practice = main.ch2_sofa_burn.lines.find((l) => l.type === "condition" && l.flag === "_stk_title_customer_half");
assert(practice && !practice.next_false, "見ていない保存は元の場面のまま");
assert.match(main.ch2_sofa_burn.branches[practice.next_true].map((l) => l.text).join("\n"), /残って、半分残された一台/);
assert(main.ch2_sofa_burn.lines.indexOf(practice) < main.ch2_sofa_burn.lines.findIndex((l) => /炭を、落とした/.test(l.text || "")));

// S13: DAY9の開場前、博士が吸う間隔から不調に気づき、温度計を貸そうとする。選択は記録だけ（効果なし）
assert.deepEqual(ids(9), ["ch2_kemuri_thermometer", "remake_ch2_ageha_tasting", "ch2_strawberry_sample"]);
assert(when(9, "ch2_kemuri_thermometer", {}) && !when(9, "ch2_kemuri_thermometer", { _ch2_read_remake_ch2_ageha_tasting: true }), "試煙会の後へ差し込まない");
const doctor = all(thermo).filter((l) => l.speaker === "dr_kemuri");
assert(doctor.length >= 3 && doctor.every((l) => ["normal", "smile"].includes(l.face)), "博士に悪い顔をさせない");
assert.match(doctor.map((l) => l.text).join("\n"), /吸う間隔[\s\S]*逢縁くん[\s\S]*温度計/);
assert.doesNotMatch(doctor.map((l) => l.text).join("\n"), /俺|私の舌|おいし|甘/, "博士は自分の舌の事情も、味の感想も言わない");
assert.match(text(thermo), /台は頼まず/, "博士は吸わない");
const offer = all(thermo).find((l) => l.type === "choice");
assert.deepEqual(offer.choices.map((c) => c.next), ["borrow", "decline"]);
const thermoFlags = (branch) => thermo.branches[branch].filter((l) => l.type === "set_flag").map((l) => l.flag);
assert.deepEqual(thermoFlags("borrow"), ["_stk_kemuri_thermo_borrowed"]);
assert.deepEqual(thermoFlags("decline"), ["_stk_kemuri_thermo_declined"]);
// 選んだ後に中断しても、LOADで逆の記録を重ねない（DAY6の分担と同じ型）
const borrowed = thermo.lines.find((l) => l.type === "condition" && l.flag === "_stk_kemuri_thermo_borrowed");
assert.equal(borrowed.next_true, "borrow");
const declined = thermo.branches[borrowed.next_false].find((l) => l.type === "condition" && l.flag === "_stk_kemuri_thermo_declined");
assert.equal(declined.next_true, "decline");
assert.equal(thermo.branches[declined.next_false][0], offer);
for (const scene of [half, back, thermo]) {
  assert(!all(scene).some((l) => ["apply", "note", "remember"].includes(l.type) || l.affinity || l.stats), `${scene.dialogue_id}: 強制場面に報酬を付けない`);
  assert(!scene.metadata?.add_affinity && !scene.metadata?.add_stat && !scene.growth_stats, `${scene.dialogue_id}: metadata の報酬もなし`);
  assert.doesNotMatch(text(scene), /が(少し|かなり|大きく)?上がった/, `${scene.dialogue_id}: 報酬の文を置かない`);
}

// C4: 顔色に気づいて水を出す役は、つむぎとクラウドだけ。アダムは続けてきた人の言葉で返し、スミの訓示は手の動きへ
const adam = isolation.ch2_adam_distance;
assert.doesNotMatch(text(adam), /水|グラス|何点/);
assert.match(text(adam), /また分かる日に吸え/, "第3章・第5章で回収する一言を残す");
assert.match(text(adam), /昨日の正解/);
assert.doesNotMatch(text(main.ch2_pre_tournament_realisation), /お茶|缶/);
assert.match(text(isolation.ch2_tsumugi_color), /お水を飲みませんか/);
assert.match(text(ageha.remake_ch2_ageha_tasting), /……水。一口目、強かったろ/);
assert.doesNotMatch(text(main.ch2_slump_taste), /寝てるか|休むのも仕事|切り上げろ/);
assert.match(text(main.ch2_slump_taste), /医者に診てもらえ[\s\S]*鞄をカウンターへ置いた/);
assert.match(text(main.ch2_lingering_smell), /飯はうちで食ってけ[\s\S]*夕飯/, "食事の話は6日目の夕飯に残す");
assert.doesNotMatch(text(remake.remake_ch2_day1_night), /休め/);

// 食い違い4: みんとは、実際には交わしていないLIMEの返信を引かない。目の前で起きたことを言う
const minto = isolation.ch2_minto_warning;
assert.doesNotMatch(text(minto), /LIME|大会前なので|何も悪くない/);
assert(!all(minto).some((l) => l.type === "condition"), "連絡先の有無で事実を変えない");
assert.match(text(minto), /ミント祭り[\s\S]*本番も、絶対[\s\S]*素通り[\s\S]*頼みたかった/);

// DAY14の入場後: 4台の前の掛け合い。神崎はあげはを『千代子の姉貴』と呼び、応援席は前夜の選択に従う。震えは秘密を知る保存だけ
const stations = tournament.ch2_tournament_stations;
assert.match(text(stations), /千代子の姉貴[\s\S]*本名で呼ぶな/);
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

// 第3章のライバルの偵察（#929）: 名乗らない「？？？」が顔だけ見せて現れる。第2章では名前・面識・会話を持たせない。
// 目撃は試煙会と大会の客席の2回（全体講評S18・C4）。前夜は出さず、クラウドの一曲からあげはの場面へそのまま続ける
for (const scene of [ageha.remake_ch2_ageha_tasting, tournament.ch2_tournament_entrance]) {
  const lines = all(scene), said = lines.filter((l) => l.speaker === "volk").map((l) => l.text);
  assert(said.length >= 1 && said.every((t) => t === "……"), `${scene.dialogue_id}: 台詞は無言だけ`);
  assert(!lines.some((l) => l.flag === "_met_volk" || l.type === "intro"), `${scene.dialogue_id}: 面識・紹介を付けない`);
  assert.doesNotMatch(text(scene), /ヴォルク|鉄の煙|ロシア|Железный/, `${scene.dialogue_id}: 名前と正体を出さない`);
  const hide = lines.findIndex((l) => l.type === "hide_portrait" && l.char_id === "volk");
  assert(hide > lines.findIndex((l) => l.speaker === "volk"), `${scene.dialogue_id}: 去ったら立ち絵を下げる`);
}
assert(ageha.remake_ch2_ageha_tasting.lines.some((l) => l.type === "set_flag" && l.flag === "_ch2_scout_seen"), "第3章の面識判定は、必ず読む試煙会の目撃で立つ");
assert(!all(remake.remake_ch2_eve_rei).some((l) => l.speaker === "volk" || l.char_id === "volk" || l.flag === "_ch2_scout_seen"), "前夜に偵察の男を出さない");
assert.match(remake.remake_ch2_eve_rei.lines.at(-1).text, /^クラウドは.*歩いていった。$/, "一曲の余韻のまま、あげはの場面へ続く");
assert.doesNotMatch(text(main.ch2_pre_tournament_realisation), /背の高い|うちの店にも来てた|メモだけ/, "前夜のあげはの噂話も外す");
assert(!all(main.ch2_pre_tournament_realisation).some((l) => /^_ch2_scout/.test(l.flag || "")), "前夜は偵察の記録で分岐しない");
assert.doesNotMatch(text(tournament.ch2_tournament_entrance), /会場の外/, "入場の独白は前夜の目撃を前提にしない");
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

console.log("[ch2 relationships 929] PASS: Naru rupture on screen, choice depth, no forced arrogance, burn safety, Ageha stays, Kanzaki/クラウド moments, ch3 bridge, new forced nights, Ageha\'s last inner voice, anonymous scout");
