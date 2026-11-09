// TRPG の音の割り当てが実在するファイルを指し、出典・CC0 の記録と一致することを確かめる。
// node remake/test/trpg_audio_cues.mjs
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { TRPG_SE, TRPG_THEME_BGM, TRPG_SHELF_BGM } from "../js/trpg/audio-cues.js";

const root = new URL("../../", import.meta.url);
const json = async rel => JSON.parse(await readFile(new URL(rel, root), "utf8"));
const sha = async rel => createHash("sha256").update(await readFile(new URL(rel, root))).digest("hex");
const manifest = await json("remake/data/manifest.json");
const catalog = await json("data/trpg_catalog.json");
const games = await json("asset_sources/music/trpg-audio/game_files.json");
const sources = await json("asset_sources/music/trpg-audio/sources.json");
const recorded = new Map(games.map(row => [row.file, row]));

// 1) どのシナリオのテーマにも BGM があり、その曲が manifest（= bgmUrl で引ける）にある。
const themes = new Set();
for (const entry of catalog.scenarios) {
  const scenario = await json("data/" + entry.file);
  const theme = scenario.presentation?.theme;
  assert.ok(theme, entry.id + " にテーマが無い");
  themes.add(theme);
  assert.ok(TRPG_THEME_BGM[theme], entry.id + "（" + theme + "）の BGM が未割り当て");
}
assert.deepEqual([...themes].sort(), Object.keys(TRPG_THEME_BGM).sort(), "使われていないテーマの割り当てを残さない");
for (const key of new Set([...Object.values(TRPG_THEME_BGM), TRPG_SHELF_BGM])) {
  const file = [key + ".bgm", key + ".mp3"].find(name => manifest.bgm.includes(name));
  assert.ok(file, key + " が manifest.bgm に無い");
  const size = (await stat(new URL("assets/audio/bgm/" + file, root))).size;
  assert.ok(size > 1000, file + " が空またはプレースホルダ");
  if (key.startsWith("bgm_trpg_")) {
    const row = recorded.get("assets/audio/bgm/" + file);
    assert.ok(row, file + " が game_files.json に無い");
    assert.equal(await sha("assets/audio/bgm/" + file), row.sha256, file + " のハッシュが記録と違う");
  }
}

// 2) 効果音はすべて assets/audio/se/trpg/ に実在し、記録したハッシュと一致する。
const seFiles = [...new Set(Object.values(TRPG_SE).flat())];
assert.ok(seFiles.length > 0);
for (const name of seFiles) {
  const rel = "assets/audio/se/trpg/" + name;
  const row = recorded.get(rel);
  assert.ok(row, rel + " が game_files.json に無い");
  assert.equal(await sha(rel), row.sha256, rel + " のハッシュが記録と違う");
  assert.ok(row.duration_seconds > 0.05 && row.duration_seconds < 2, rel + " は短いSEのはず");
}
// ダイスの判定で鳴らす種類はすべて録音がある。
for (const kind of ["roll" in TRPG_SE ? "roll" : "shake", "land", "rethrow", "success", "mixed", "trouble", "critical", "fumble", "ending"]) {
  assert.ok(TRPG_SE[kind]?.length, kind + " の録音が無い");
}

// 3) 出典はすべて CC0。記録したゲーム用ファイルは割り当て済みのものだけ。
assert.equal(sources.license, "CC0-1.0");
for (const original of sources.originals) {
  assert.equal(original.license, "CC0-1.0", original.id);
  assert.match(original.source_url, /^https:\/\/opengameart\.org\/content\//, original.id);
  assert.match(original.sha256, /^[0-9a-f]{64}$/, original.id);
}
const used = new Set([...seFiles.map(n => "assets/audio/se/trpg/" + n),
  ...Object.values(TRPG_THEME_BGM).filter(k => k.startsWith("bgm_trpg_")).map(k => "assets/audio/bgm/" + k + ".mp3")]);
assert.deepEqual([...recorded.keys()].sort(), [...used].sort(), "game_files.json と割り当てが一致しない");
console.log("trpg audio cues ok:", seFiles.length, "SE,", new Set(Object.values(TRPG_THEME_BGM)).size, "BGM");
