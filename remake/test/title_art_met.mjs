// #1243: タイトル右側アートは、最新セーブで出会った「好感度のあるキャラ」の専用キービジュアルだけに絞る。
// 判定・対応表は core/title-art-unlock.js、セーブ選択は core/state.js の peekLatestSave で検証する。
// pickTitleArt 本体は scenes/title-art.js（UI 依存）のため、ここでは「表示候補が空＝キービジュアルへ
// フォールバックする」という title-art.js 側の分岐条件までを担保する。
import assert from "node:assert/strict";
import fs from "node:fs";
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const { TITLE_ART_CHARACTERS, TITLE_KEY_VISUALS, titleArtCharacters, titleArtDisplayCharacters } = await import("../js/core/title-art-unlock.js");
const { peekLatestSave, SAVE_KEY } = await import("../js/core/state.js");

const ROSTER = ["ageha", "hiyori", "samechan", "mashiro", "minto", "rin", "tsumugi", "sumi", "naru", "adam"];
const MAPPED = ["ageha", "hiyori", "samechan", "mashiro", "minto", "rin", "tsumugi", "sumi", "naru", "adam"];
const sv = (extra = {}) => ({ day: 3, met: {}, flags: {}, contacts: [], story: {}, ...extra });
const sorted = a => [...a].sort();
let count = 0;
function check(label, run) { storage.clear(); run(); count++; console.log(`[title art met] PASS ${label}`); }

check("roster is the affinity cast (10)", () => assert.deepEqual(TITLE_ART_CHARACTERS, ROSTER));
check("no save -> whole roster unlocked, display limited to mapped key visuals", () => {
  assert.deepEqual(titleArtCharacters(null, TITLE_ART_CHARACTERS), ROSTER);
  assert.deepEqual(titleArtDisplayCharacters(null), MAPPED);
});
check("met minto only", () => {
  assert.deepEqual(titleArtCharacters(sv({ met: { minto: true } }), TITLE_ART_CHARACTERS), ["minto"]);
  assert.deepEqual(titleArtDisplayCharacters(sv({ met: { minto: true } })), ["minto"]);
});
check("multiple met matches the set (non-roster and false are ignored)", () =>
  assert.deepEqual(sorted(titleArtCharacters(sv({ met: { rin: true, ageha: true, kumicho: true, mashiro: false } }), TITLE_ART_CHARACTERS)), ["ageha", "rin"]));
check("auxiliary signals unlock", () => {
  assert.deepEqual(titleArtCharacters(sv({ flags: { _hiyori_meeting_done: true } }), TITLE_ART_CHARACTERS), ["hiyori"]);
  assert.deepEqual(titleArtCharacters(sv({ contacts: ["samechan"] }), TITLE_ART_CHARACTERS), ["samechan"]);
  assert.deepEqual(titleArtCharacters(sv({ flags: { _samechan_nickname_known: true } }), TITLE_ART_CHARACTERS), ["samechan"]);
  assert.deepEqual(titleArtCharacters(sv({ flags: { _lime_contact_samechan: true } }), TITLE_ART_CHARACTERS), ["samechan"]);
  assert.deepEqual(titleArtCharacters(sv({ story: { tsumugi: 1 } }), TITLE_ART_CHARACTERS), ["tsumugi"]);
  assert.deepEqual(titleArtCharacters(sv({ contacts: ["sumi"] }), TITLE_ART_CHARACTERS), ["sumi"], "上司は開始時から知っている相手");
  assert.deepEqual(titleArtCharacters(sv({ contacts: ["tsumugi", "minto"] }), TITLE_ART_CHARACTERS), [], "補助シグナルは前例のあるキャラだけ");
});
check("save with nobody met -> no candidates (title-art.js falls back to keyvisual)", () => {
  assert.deepEqual(titleArtCharacters(sv({ met: { kumicho: true } }), TITLE_ART_CHARACTERS), []);
  localStorage.setItem(SAVE_KEY, JSON.stringify(sv({ met: { kumicho: true } })));
  assert.deepEqual(titleArtDisplayCharacters(peekLatestSave()), []);
});
check("fresh save (only sumi known) -> her adopted key visual is displayable", () => {
  assert.deepEqual(titleArtCharacters(sv({ contacts: ["sumi"] }), TITLE_ART_CHARACTERS), ["sumi"]);
  assert.deepEqual(titleArtDisplayCharacters(sv({ contacts: ["sumi"] })), ["sumi"]);
});
check("key visual table matches the roster and the real manifest", () => {
  assert.deepEqual(sorted(Object.keys(TITLE_KEY_VISUALS)), sorted(ROSTER));
  const manifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
  const byFile = new Map(manifest.titleArts.map(a => [a.file, a.character]));
  for (const [id, file] of Object.entries(TITLE_KEY_VISUALS)) {
    if (file === null) continue;
    assert.equal(byFile.get(file), id, `${id} の採用ファイルが manifest の同キャラ素材を指している`);
  }
  assert.deepEqual(sorted(Object.entries(TITLE_KEY_VISUALS).filter(([, f]) => f === null).map(([id]) => id)), [], "全員に専用キービジュアルが割り当て済み");
});
check("latest save selection", () => {
  const slot = "suien_remake_slot2";
  localStorage.setItem(SAVE_KEY, JSON.stringify(sv({ savedAt: 100, met: { minto: true } })));
  localStorage.setItem(slot, JSON.stringify(sv({ savedAt: 200, met: { rin: true } })));
  assert.deepEqual(peekLatestSave().met, { rin: true }, "手動枠が新しい");
  localStorage.setItem(slot, JSON.stringify(sv({ savedAt: 50, met: { rin: true } })));
  assert.deepEqual(peekLatestSave().met, { minto: true }, "オートが新しい");
  localStorage.setItem(slot, JSON.stringify(sv({ met: { rin: true } })));
  assert.deepEqual(peekLatestSave().met, { minto: true }, "欠落はオート優先");
});
check("pure: input save is not mutated", () => {
  const s = sv({ met: { minto: true }, contacts: ["samechan", "sumi"], story: { tsumugi: 2 } });
  const before = JSON.stringify(s); titleArtDisplayCharacters(s);
  assert.equal(JSON.stringify(s), before);
});
console.log(`[title art met] ${count} checks passed`);
