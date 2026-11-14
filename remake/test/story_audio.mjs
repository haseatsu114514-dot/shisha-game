// 本編の仮BGM／SE対応表。実ファイルがあり、スタッフロールと台帳にクレジットがあること。
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STORY_BGM, STORY_SE, storyBgm, chapterHubBgm, cityBgm, homeBgm } from "../js/core/story-audio.js";
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
assert.equal(chapterHubBgm(2), STORY_BGM.yuzugaya); // 第2章の朝・地図は柚ヶ谷の曲（J04・仮曲）
assert.equal(STORY_BGM.yuzugaya, "bgm_yuzugaya");
// 店や施設から街へ戻る時: 第2章だけ柚ヶ谷、ほかは今までどおり日常の曲。
assert.equal(cityBgm(2), STORY_BGM.yuzugaya);
for (const chapter of [1, 3, 4, 5]) assert.equal(cityBgm(chapter), STORY_BGM.dailyCity, `chapter ${chapter}`);
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

const newKeys = ["map", "tournamentWait", "resultWin", "rivalShop", "dubai", "worldStage", "smokeLab", "ch5Duel", "ending", "yuzugaya"];
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
  "Desert theme": "yd",
  "Mocha Frapp": "Pro Sensory",
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

// 曲のキーをその場に書いている所（import を足さない書き方）が、対応表と同じ曲を鳴らすこと。
const source = path => readFileSync(join(root, path), "utf8");
const pick = (code, vars) => new Function(...Object.keys(vars), `return ${code};`)(...Object.values(vars));
const morning = source("remake/js/daily/calendar.js").match(/playBgm\((state\.chapter === 2 \? [^;]+)\);/)?.[1];
assert(morning, "calendar.js morning track expression");
for (const chapter of [1, 2, 3, 4, 5]) assert.equal(pick(morning, { state: { chapter } }), chapterHubBgm(chapter), `morning of chapter ${chapter}`);
const afterTrpg = source("remake/js/daily/trpg.js").match(/playBgm\((state\.chapter === 2 \? [^)]+)\);/)?.[1];
const atCounter = source("remake/js/daily/shop.js").match(/playBgm\((stockChapter === 2 \? [^)]+)\);/)?.[1];
assert(afterTrpg && atCounter, "trpg.js / shop.js town track expressions");
for (const chapter of [1, 2, 3, 4, 5]) {
  assert.equal(pick(afterTrpg, { state: { chapter } }), cityBgm(chapter), `after the board-game cafe in chapter ${chapter}`);
  assert.equal(pick(atCounter, { stockChapter: chapter }), cityBgm(chapter), `shop counter of chapter ${chapter}`);
}
// 家に帰る・家で休む時は、店の曲（tonari・ライバル店）を持ち帰らず、街の曲へ戻す（オーナー「店の音楽が家に帰っても流れてる」）。
const homeExpr = file => [...source(file).matchAll(/playBgm\((state\.chapter === 2 \? [^;]+)\);/g)].map(m => m[1]);
const homecoming = homeExpr("remake/js/daily/calendar.js")[1];
const resting = homeExpr("remake/js/daily/spots.js")[0];
assert(homecoming && resting, "calendar.js homecoming / spots.js rest track expressions");
assert(/const athome = [^\n]+\n[^\n]+\n[^\n]+\n\s+playBgm\(state\.chapter === 2/.test(source("remake/js/daily/calendar.js")), "homecoming switches the track before the walk home");
assert(/export async function restAtHome[^\n]+\n\s+const owner = state;\n[^\n]+\n\s+playBgm\(/.test(source("remake/js/daily/spots.js")), "resting at home switches the track first");
for (const chapter of [1, 2, 3, 4, 5]) {
  assert.equal(pick(homecoming, { state: { chapter } }), homeBgm(chapter), `homecoming in chapter ${chapter}`);
  assert.equal(pick(resting, { state: { chapter } }), homeBgm(chapter), `rest at home in chapter ${chapter}`);
  assert.notEqual(homeBgm(chapter), STORY_BGM.shopHome, `no shop music at home in chapter ${chapter}`);
  assert.notEqual(homeBgm(chapter), STORY_BGM.rivalShop, `no rival shop music at home in chapter ${chapter}`);
}
assert.match(source("remake/js/chapters/ch2.js"), new RegExp(`const CITY_BGM = "${STORY_BGM.yuzugaya}";`), "chapter 2 town track");

const storySrc = readFileSync(join(root, "remake/js/core/story-audio.js"), "utf8");
assert(!/camel-race|camel_race|dj-club|assets\/audio\/dj/.test(storySrc), "mapping must not touch camel race or DJ audio");

console.log("[story audio] PASS: mapping, files, credits, default ON");
