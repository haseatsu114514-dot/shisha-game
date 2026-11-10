// 本編の仮BGM／SE対応表。実ファイルがあり、スタッフロールと台帳にクレジットがあること。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STORY_BGM, STORY_SE, storyBgm, chapterHubBgm } from "../js/core/story-audio.js";
import { CH4_DEFAULT_BGM, CH4_SCENE_BGM } from "../js/chapters/ch4-progress.js";
import { CH5_DEFAULT_BGM, CH5_SCENE_BGM, CH5_ENDING_IDS } from "../js/chapters/ch5-progress.js";
const staffSrc = readFileSync(new URL("../js/scenes/staff-roll.js", import.meta.url), "utf8");
const stateSrc = readFileSync(new URL("../js/core/state.js", import.meta.url), "utf8");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(root, "remake/data/manifest.json"), "utf8"));
const hasBgm = key => manifest.bgm.some(file => file.replace(/\.[^.]+$/, "") === key);

assert.match(stateSrc, /mute:\s*false/, "sound defaults ON");
assert.equal(storyBgm("dubai"), "bgm_dubai");
assert.equal(storyBgm("unknown-role"), STORY_BGM.shopHome);
assert.equal(chapterHubBgm(1), STORY_BGM.dailyCity);
assert.equal(chapterHubBgm(2), STORY_BGM.dailyCity);
assert.equal(chapterHubBgm(3), STORY_BGM.dailyCity);
assert.equal(chapterHubBgm(4), STORY_BGM.dubai);
assert.equal(chapterHubBgm(5), STORY_BGM.shopHome);

assert.equal(CH4_DEFAULT_BGM, STORY_BGM.dubai);
assert.equal(CH4_SCENE_BGM.ch4_sumi_training, STORY_BGM.shopHome);
assert.equal(CH4_SCENE_BGM.ch4_strategy, STORY_BGM.shopHome);
assert.equal(CH4_SCENE_BGM.ch4_sumi_return, STORY_BGM.shopHome);
assert.equal(CH4_SCENE_BGM.ch4_two_tables, STORY_BGM.shopHome);
assert.equal(CH4_SCENE_BGM.ch4_tournament_start, STORY_BGM.worldStage);
assert.equal(CH4_SCENE_BGM.ch4_wang_reception, STORY_BGM.worldStage);
assert.equal(CH4_SCENE_BGM.ch4_festa, STORY_BGM.worldStage);
assert.equal(CH5_DEFAULT_BGM, STORY_BGM.shopHome);
assert.equal(CH5_SCENE_BGM.ch5_match_day_arrival, STORY_BGM.smokeLab);
assert.equal(CH5_SCENE_BGM.ch5_copy_first_cup, STORY_BGM.ch5Duel);
assert.equal(CH5_SCENE_BGM.ch5_relationship_before_second_cup, STORY_BGM.smokeLab);
for (const id of CH5_ENDING_IDS) assert.equal(CH5_SCENE_BGM[id], STORY_BGM.ending, id);

const newKeys = ["map", "tournamentWait", "resultWin", "rivalShop", "dubai", "worldStage", "smokeLab", "ch5Duel", "ending"];
for (const role of newKeys) {
  const key = STORY_BGM[role];
  assert(hasBgm(key), `manifest missing ${key}`);
  const mp3 = join(root, "assets/audio/bgm", `${key}.mp3`);
  assert(statSync(mp3).size > 1000, `${key} must not be an empty placeholder`);
}

const credits = {
  "Chill lofi inspired": "omfgdude",
  "Tension Theme": "Umplix",
  "Daisy": "Kistol",
  "Cool City": "MintoDog",
  "Desert Travel (Loop)": "DJ CrisP",
  "Dare The Bustloro Way": "Spring Spring",
  "Dark Horse": "Centurion_of_war",
  "The Rush": "tebruno99",
};
for (const [title, composer] of Object.entries(credits)) {
  assert(staffSrc.includes(`title: "${title}"`), `staff roll missing ${title}`);
  assert(staffSrc.includes(`composer: "${composer}"`), `staff roll missing composer ${composer} for ${title}`);
}
assert(staffSrc.includes("効果音（本編UI・場面転換）：Kenney – Interface Sounds / Music Jingles（CC0）"), "Kenney UI credited");

for (const file of ["ui_whoosh.wav", "ui_jingle.wav", "ui_card.wav"]) {
  assert(statSync(join(root, "assets/audio/se", file)).size > 100, file);
}
for (const id of ["click", "select", "cancel", "whoosh", "jingle", "card"]) {
  assert.equal(STORY_SE[id === "whoosh" ? "transition" : id === "jingle" ? "title" : id], id === "whoosh" ? "whoosh" : id === "jingle" ? "jingle" : id);
}

const storySrc = readFileSync(join(root, "remake/js/core/story-audio.js"), "utf8");
assert(!/camel-race|camel_race|dj-club|assets\/audio\/dj/.test(storySrc), "mapping must not touch camel race or DJ audio");

console.log("[story audio] PASS: mapping, files, credits, default ON");
