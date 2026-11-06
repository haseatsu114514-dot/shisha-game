// Official month-day contract approved in #2465; no birth year is stored.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const characters = read("../../data/characters.json");
const samechan = read("../../data/dialogue/samechan.json").profile;
// The independent profile is installed by core/data.js when the game loads.
assert(!characters.some(c => c.id === samechan.id), "Do not duplicate the independent profile");
const profiles = [...characters, samechan];
const expected = {
  hajime: "04-08", sumi: "12-22", naru: "01-15", adam: "11-05",
  minto: "03-10", ageha: "08-01", kumicho: "10-02", rei: "05-20",
  saku: "02-01", steve: "08-20", volk: "02-09", master_hookah: "07-03",
  sheikh: "09-15", shisha_9000: "01-12", dr_kemuri: "05-08", kuyuri: "02-26",
  tsumugi: "07-12", mashiro: "12-07", hiyori: "11-01", samechan: "06-20",
  pakki: "10-10", sui: "12-16", emil: "08-25", da_silva: "06-24",
  maezono: "03-04", mukai_master: "04-13", tetsuko: "02-22", salaryman: "12-01",
  uranaishi: "02-29", maki: "04-10", sai: "06-06", yoru: "11-04",
  faris: "07-24", khalil: "10-20", noor: "09-28",
};
assert.equal(Object.keys(expected).length, 35);
const withBirthday = profiles.filter(c => Object.hasOwn(c, "birthday"));
// Exact roster excludes retired characters, aliases and unnamed roles from birthdays.
assert.deepEqual(withBirthday.map(c => c.id).sort(), Object.keys(expected).sort());
const dates = new Set();
const monthLengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
for (const { id, birthday } of withBirthday) {
  assert.equal(typeof birthday, "string", `${id}: birthday must be a string`);
  assert.match(birthday, /^\d{2}-\d{2}$/, `${id}: birthday must use MM-DD`);
  const [month, day] = birthday.split("-").map(Number);
  assert(month >= 1 && month <= 12 && day >= 1 && day <= monthLengths[month - 1],
    `${id}: invalid month-day ${birthday}`);
  assert(!dates.has(birthday), `${id}: duplicate birthday ${birthday}`);
  dates.add(birthday);
  assert.equal(birthday, expected[id], `${id}: must match the owner-approved date`);
}
console.log("PASS: 35 official birthdays match, are valid and unique, including 02-29");
