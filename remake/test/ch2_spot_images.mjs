// 第2章のスポット・店の背景が、採用済みの実ファイルを指し、Git LFS ポインタのままでないことを確かめる。
// #1081 A02（神崎の室内が bg_yuzugaya_kumicho.webp へ逸れて読込失敗）/ A03（銭湯ほかの画像読込）/ #1044 A04 の再発防止。
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROOMS, MAP, STATION } from "../js/chapters/ch2-city-data.js";
import { CITY_OUTINGS, CITY_SHOP, CITY_CHAIN } from "../js/chapters/ch2-outings.js";

// すべての相対パスは remake/ を基準にした `../assets/...`。remake/test/ からは remake/ が親。
const remakeDir = new URL("../", import.meta.url);
const LFS_POINTER = "version https://git-lfs.github.com/spec/v1";

function assertRealImage(label, relPath) {
  assert.equal(typeof relPath, "string", `${label}: 背景パスが文字列でない (${relPath})`);
  const file = fileURLToPath(new URL(relPath, remakeDir));
  assert.ok(existsSync(file), `${label}: 参照先の画像が存在しない (${relPath})`);
  const head = readFileSync(file).subarray(0, 64).toString("latin1");
  assert.ok(!head.startsWith(LFS_POINTER), `${label}: Git LFS ポインタのまま（実体を取得していない）(${relPath})`);
}

// A02: 神崎の室内は採用済み内装 bg_ch2_kumicho_entry.webp を使う（街の店舗画像に逸れない）。
assert.equal(ROOMS.kumicho, "../assets/backgrounds/bg_ch2_kumicho_entry.webp", "ROOMS.kumicho が採用内装を指していない");
for (const id of ["ageha", "kumicho", "rei"]) assertRealImage(`ROOMS.${id}`, ROOMS[id]);

// 街の地図・駅。
assertRealImage("MAP.day", MAP.day);
assertRealImage("MAP.night", MAP.night);
assertRealImage("STATION", STATION);

// A03: 銭湯ほかの外出・支店・用品店のプレビュー背景。
for (const outing of CITY_OUTINGS) if (outing.previewUrl) assertRealImage(`outing ${outing.id}`, outing.previewUrl);
assertRealImage(`shop ${CITY_SHOP.id}`, CITY_SHOP.previewUrl);
assertRealImage(`chain ${CITY_CHAIN.id}`, CITY_CHAIN.previewUrl);

console.log("ch2_spot_images: OK — 第2章のスポット背景は実体を指し、LFS ポインタではない");
