// 帰国後の tonari の打ち上げ（オーナー指定 2026-11-02）: 誰の隣に座るかと、恋人の人数での振り分け。
// node remake/test/ch5_party.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { partyBeforeSeat, partyGuests, partyScenes, partyTrigger, SEAT_LABELS } from "../js/chapters/ch5-party-plan.js";

const root = new URL("../../", import.meta.url);
const routes = JSON.parse(fs.readFileSync(new URL("data/story_routes.json", root), "utf8"));
const dialogues = Object.fromEntries(["ch5_party", "relationship_conflicts"].flatMap(file =>
  JSON.parse(fs.readFileSync(new URL(`data/dialogue/${file}.json`, root), "utf8")).dialogues.map(d => [d.dialogue_id, d])));
const save = (met, lovers = []) => ({ met: Object.fromEntries(met.map(id => [id, true])), lovers, flags: {} });

// 席の選択肢: 会ったことのあるヒロインだけ。呼び方は八人ぶんそろっている（ヌールは名前の表だけで、席には座らない）。
for (const id of routes.heroine_ids) assert(SEAT_LABELS[id], `${id}: seat label`);
assert.deepEqual(partyGuests(routes, save(["tsumugi", "naru"])).present, ["tsumugi"], "Only met heroines sit at the party");

// 恋人がいない: 選んだ席の場面と、締め。
assert.deepEqual(partyScenes(routes, save(["tsumugi"]), "tsumugi").scenes, ["ch5_party_seat_friend", "ch5_party_close"]);
assert.deepEqual(partyScenes(routes, save(["tsumugi"]), "sumi").scenes, ["ch5_party_seat_sumi", "ch5_party_close"]);

// 恋人が1人: その人の隣なら穏やかに。別の人の隣なら視線だけ（修羅場にしない）。
assert.deepEqual(partyScenes(routes, save(["tsumugi", "rio"], ["rio"]), "rio"),
  { kind: "lover", participants: [], scenes: ["ch5_party_seat_lover", "ch5_party_close"] });
assert.deepEqual(partyScenes(routes, save(["tsumugi", "rio"], ["rio"]), "tsumugi").scenes,
  ["ch5_party_seat_friend", "ch5_party_seat_away", "ch5_party_close"]);

// 恋人が2人以上その場にいる: どの席でも修羅場。恋人ごとの反応と謝罪（未解決の印）へ。会っていない恋人は数えない。
const two = partyScenes(routes, save(["tsumugi", "minto", "rio"], ["tsumugi", "minto"]), "minto");
assert.equal(two.kind, "conflict");
assert.deepEqual(two.participants, ["tsumugi", "minto"]);
// 2026-11-11 演出: 席ごとの引き金 → 打ち明け → 反応 → 謝罪 → お開き。隣に座った恋人の反応は最後（記録する並びは変えない）。
assert.deepEqual(two.scenes, ["ch5_party_trigger_minto", "ch5_party_shuraba_open", "shuraba_tsumugi", "shuraba_minto", "shuraba_accountability", "ch5_party_shuraba_close"]);
assert.deepEqual(two.reactions, ["shuraba_tsumugi", "shuraba_minto"]);
assert.deepEqual(two.remote, []);
const three = save(["tsumugi", "minto", "rio", "ageha"], ["tsumugi", "minto", "rio"]);
const seated = partyScenes(routes, three, "tsumugi");
assert.deepEqual(seated.participants, ["tsumugi", "minto", "rio"], "The recorded order does not depend on the seat");
assert.deepEqual(seated.scenes, ["ch5_party_trigger_tsumugi", "ch5_party_shuraba_open", "shuraba_minto", "shuraba_rio", "shuraba_tsumugi",
  "shuraba_accountability", "ch5_party_shuraba_close"], "The lover next to Hajime speaks last");
assert.equal(partyScenes(routes, three, "sumi").scenes[0], "ch5_party_trigger_sumi");
assert.equal(partyScenes(routes, three, "ageha").scenes[0], "ch5_party_trigger_friend", "A friend's seat has its own trigger");
assert.deepEqual(partyScenes(routes, three, "ageha").reactions, ["shuraba_tsumugi", "shuraba_minto", "shuraba_rio"]);
assert.equal(partyTrigger(["rio"], "rio"), "ch5_party_trigger_rio");
assert.equal(partyScenes(routes, save(["tsumugi"], ["tsumugi", "minto"]), "tsumugi").kind, "lover", "An unmet lover is not at the party");

// DSR20: ドバイに住むヌールは席に座らない（打ち上げにはテレビ電話で加わる）。恋人がヌールだけなら、お祝いのテレビ電話。
// ヌールと席にいる恋人が合わせて2人以上なら修羅場で、ヌールはテレビ電話の画面から反応する（shuraba_noor）。
assert.deepEqual(partyGuests(routes, save(["tsumugi", "noor"])).present, ["tsumugi"], "Noor has no seat");
assert.deepEqual(partyGuests(routes, save(["tsumugi", "noor"], ["noor"])).remote, ["noor"]);
assert.deepEqual(partyGuests(routes, save(["tsumugi", "noor"])).remote, [], "only a lover calls in");
assert.deepEqual(partyScenes(routes, save(["tsumugi", "noor"], ["noor"]), "tsumugi"),
  { kind: "lover", participants: [], scenes: ["ch5_party_seat_friend", "ch5_party_noor_call", "ch5_party_close"] });
const call = partyScenes(routes, save(["tsumugi", "noor"], ["noor", "tsumugi"]), "sumi");
assert.equal(call.kind, "conflict");
assert.deepEqual(call.participants, ["noor", "tsumugi"]);
assert.deepEqual(call.scenes, ["ch5_party_trigger_sumi", "ch5_party_shuraba_open", "shuraba_noor", "shuraba_tsumugi", "shuraba_accountability", "ch5_party_shuraba_close"]);
assert.deepEqual(call.remote, ["noor"], "Noor looks on through the video call (gaze cut-in)");
assert.match(dialogues.shuraba_noor.lines[0].text + dialogues.shuraba_noor.lines[1].text, /テレビ電話/, "Noor joins by video call");
assert.match(dialogues.ch5_party_noor_call.lines[0].text, /スマホ/);
// #2815: 修羅場になる打ち上げでは、ヌールの着信を席を選ぶ前（打ち明けより前）に読む。反応の「つながったまま」「聞こえてた」と合わせる。
// 修羅場にならない打ち上げ（ヌールだけが恋人）は、従来どおり席の後の途中で着信する。地元の恋人だけの修羅場には着信を挟まない。
assert.deepEqual(partyBeforeSeat(routes, save(["tsumugi", "noor"], ["noor", "tsumugi"])), ["ch5_party_noor_call"]);
assert.deepEqual(partyBeforeSeat(routes, save(["tsumugi", "noor"], ["noor"])), [], "a calm call stays after the seat");
assert.deepEqual(partyBeforeSeat(routes, save(["tsumugi", "minto"], ["tsumugi", "minto"])), [], "no call among local lovers");
assert.deepEqual(partyBeforeSeat(routes, save(["tsumugi", "minto", "noor"], ["tsumugi", "minto"])), [], "Noor calls in only as a lover");
assert(!call.scenes.includes("ch5_party_noor_call"), "the call is not read twice");
assert.match(dialogues.shuraba_noor.lines.map(line => line.text).join(""), /つながったまま[\s\S]*聞こえてた/);

// 台本: 振り分けに出るすべての場面があり、謝罪は未解決の印を立てる。報酬行は置かない。
const all = new Set([...Object.keys(dialogues).filter(id => id.startsWith("ch5_party_")),
  ...routes.heroine_ids.map(id => routes.romance[id].conflict), routes.conflict.close]);
for (const id of all) assert(dialogues[id]?.lines?.length, `${id}: scene exists`);
assert(dialogues.shuraba_accountability.lines.some(line => line.type === "set_flag" && line.flag === "_story_shuraba_unresolved"));
for (const id of Object.keys(dialogues).filter(id => id.startsWith("ch5_party_")))
  assert(!dialogues[id].lines.some(line => line.type === "apply" || line.affinity), `${id}: no reward lines`);

// 2026-11-11 演出: 引き金の場面は、席に座るヒロイン全員ぶんと、スミさんの隣・友人の隣がある（ヌールは席に座らない）。
const seats = routes.heroine_ids.filter(id => !routes.romance[id].resident);
for (const id of ["sumi", "friend", ...seats]) assert(dialogues[`ch5_party_trigger_${id}`]?.lines?.length, `${id}: trigger scene`);
assert(!dialogues.ch5_party_trigger_noor, "Noor has no seat, so no trigger of her own");
for (const id of seats) {
  const speakers = new Set(dialogues[`ch5_party_trigger_${id}`].lines.map(line => line.speaker).filter(Boolean));
  assert(speakers.has(id) && [...speakers].every(speaker => speaker === id || speaker === "hajime"), `${id}: only she and Hajime speak in her trigger`);
}
// 打ち明け: 視線のカットイン → 選択肢（先頭はそのまま打ち明ける。ごまかす・黙るも同じ打ち明けに着く）→ 打ち明けの2行。
const open = dialogues.ch5_party_shuraba_open;
const kinds = open.lines.map(line => line.type === "motion" ? `motion:${line.id}` : line.type || "line");
assert(kinds.indexOf("motion:gaze") >= 0 && kinds.indexOf("motion:gaze") < kinds.indexOf("choice"), "The stares land before the question");
const answer = open.lines.find(line => line.type === "choice");
assert.equal(answer.choices[0].next, undefined, "The first choice goes straight to the confession");
for (const choice of answer.choices.slice(1)) assert(open.branches[choice.next]?.length, `${choice.next}: branch exists`);
for (const branch of Object.values(open.branches)) assert(!branch.some(line => line.type === "choice" || line.type === "jump"), "No branch leaves the scene");
const after = open.lines.slice(open.lines.indexOf(answer) + 1).map(line => line.text);
assert.deepEqual(after.slice(0, 2), ["……付き合ってます。一人だけじゃ、ありません", "黙ってたのは、俺です"], "Every answer reaches the same confession");
// スタッフロールの後の開始にも視線のカットイン。こちらは自分から向き合う場面なので、選択肢は置かない。
assert(dialogues.shuraba_open.lines.some(line => line.type === "motion" && line.id === "gaze"));
assert(!dialogues.shuraba_open.lines.some(line => line.type === "choice"));
// 反応は、いつもの顔（normal）だけで読ませない。山場の一行で曲が沈む（duck）。台詞の文面は 2026-11-11 の演出で変えていない。
for (const id of routes.heroine_ids) {
  const lines = dialogues[routes.romance[id].conflict].lines.filter(line => line.speaker === id);
  assert(lines.some(line => line.duck), `${id}: a line ducks the music`);
  if (id !== "noor") assert(lines.some(line => !/normal$/.test(line.face)), `${id}: not only the everyday face`); // ヌールは表情が3種だけ
}
assert.equal(dialogues.shuraba_ageha.lines[3].text, "今、いつもみたいに笑うのは、無理");
assert.notEqual(dialogues.shuraba_ageha.lines[3].face, "normal", "Ageha does not smile while saying she cannot");
console.log("ch5 party: ok");
