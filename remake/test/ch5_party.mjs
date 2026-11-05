// 帰国後の tonari の打ち上げ（オーナー指定 2026-11-02）: 誰の隣に座るかと、恋人の人数での振り分け。
// node remake/test/ch5_party.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { partyGuests, partyScenes, SEAT_LABELS } from "../js/chapters/ch5-party-plan.js";

const root = new URL("../../", import.meta.url);
const routes = JSON.parse(fs.readFileSync(new URL("data/story_routes.json", root), "utf8"));
const dialogues = Object.fromEntries(["ch5_party", "relationship_conflicts"].flatMap(file =>
  JSON.parse(fs.readFileSync(new URL(`data/dialogue/${file}.json`, root), "utf8")).dialogues.map(d => [d.dialogue_id, d])));
const save = (met, lovers = []) => ({ met: Object.fromEntries(met.map(id => [id, true])), lovers, flags: {} });

// 席の選択肢: 会ったことのあるヒロインだけ。呼び方は七人ぶんそろっている。
for (const id of routes.heroine_ids) assert(SEAT_LABELS[id], `${id}: seat label`);
assert.deepEqual(partyGuests(routes, save(["tsumugi", "naru"])).present, ["tsumugi"], "Only met heroines sit at the party");

// 恋人がいない: 選んだ席の場面と、締め。
assert.deepEqual(partyScenes(routes, save(["tsumugi"]), "tsumugi").scenes, ["ch5_party_seat_friend", "ch5_party_close"]);
assert.deepEqual(partyScenes(routes, save(["tsumugi"]), "sumi").scenes, ["ch5_party_seat_sumi", "ch5_party_close"]);

// 恋人が1人: その人の隣なら穏やかに。別の人の隣なら視線だけ（修羅場にしない）。
assert.deepEqual(partyScenes(routes, save(["tsumugi", "kuyuri"], ["kuyuri"]), "kuyuri"),
  { kind: "lover", participants: [], scenes: ["ch5_party_seat_lover", "ch5_party_close"] });
assert.deepEqual(partyScenes(routes, save(["tsumugi", "kuyuri"], ["kuyuri"]), "tsumugi").scenes,
  ["ch5_party_seat_friend", "ch5_party_seat_away", "ch5_party_close"]);

// 恋人が2人以上その場にいる: どの席でも修羅場。恋人ごとの反応と謝罪（未解決の印）へ。会っていない恋人は数えない。
const two = partyScenes(routes, save(["tsumugi", "minto", "kuyuri"], ["tsumugi", "minto"]), "minto");
assert.equal(two.kind, "conflict");
assert.deepEqual(two.participants, ["tsumugi", "minto"]);
assert.deepEqual(two.scenes, ["ch5_party_shuraba_open", "shuraba_tsumugi", "shuraba_minto", "shuraba_accountability", "ch5_party_shuraba_close"]);
assert.equal(partyScenes(routes, save(["tsumugi"], ["tsumugi", "minto"]), "tsumugi").kind, "lover", "An unmet lover is not at the party");

// 台本: 振り分けに出るすべての場面があり、謝罪は未解決の印を立てる。報酬行は置かない。
const all = new Set([...Object.keys(dialogues).filter(id => id.startsWith("ch5_party_")),
  ...routes.heroine_ids.map(id => routes.romance[id].conflict), routes.conflict.close]);
for (const id of all) assert(dialogues[id]?.lines?.length, `${id}: scene exists`);
assert(dialogues.shuraba_accountability.lines.some(line => line.type === "set_flag" && line.flag === "_story_shuraba_unresolved"));
for (const id of Object.keys(dialogues).filter(id => id.startsWith("ch5_party_")))
  assert(!dialogues[id].lines.some(line => line.type === "apply" || line.affinity), `${id}: no reward lines`);
console.log("ch5 party: ok");
