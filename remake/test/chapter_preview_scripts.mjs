// 章末予告の台本（data/chapter_previews/*.json）の構造・出典・原文一致を検査する。
// 抜粋の原則は「原データの台詞行と完全一致」。第1章台本の旧編集だけ、文境界までの
// 前方一致（文の途中で切らない抜粋）を許し、書き換えた1件は例外として明記する。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT_DIR = path.join(ROOT, "data/chapter_previews");
const KINDS = new Set(["prologue", "slate", "image", "title", "echo"]);
const CUES = new Set(["intro", "slate", "build", "title", "echo"]);

// 完全一致から外れる個別事情（各台本の source_notes にも理由を残すこと。新規の安易な追加は禁止）。
// - ch5 の same-return: DESIGN 4-3 が反復カットに原文の断片を指定したもの（台本化で3種から1種を選択）。
const EXCERPT_EXCEPTIONS = new Map([
  ["ch5.json:same-return", "DESIGN 4-3 の反復指定による原文の断片「同じところで——」"],
]);

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const normalize = text => String(text ?? "").replace(/\s+/g, "");

const dialogueCache = new Map();
function dialogueLines(file, dialogueId) {
  if (!dialogueCache.has(file)) {
    try { dialogueCache.set(file, JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"))); }
    catch { dialogueCache.set(file, null); }
  }
  const data = dialogueCache.get(file);
  if (!data) return null;
  const entry = (data.dialogues || []).find(d => d.dialogue_id === dialogueId);
  return entry ? entry.lines.map(l => l.text).filter(t => typeof t === "string") : null;
}

function excerptMatches(text, lines) {
  const target = normalize(text);
  return lines.some(line => {
    const source = normalize(line);
    if (source === target) return true;
    // 文境界までの前方一致: 行が抜粋で始まり、抜粋が文末（。）で終わっている場合だけ。
    return target.endsWith("。") && source.startsWith(target);
  });
}

const scriptFiles = fs.readdirSync(SCRIPT_DIR).filter(f => f.endsWith(".json")).sort();
if (!scriptFiles.length) fail("chapter_previews", "台本が1つも無い");

const scripts = new Map();
for (const file of scriptFiles) {
  const where = `data/chapter_previews/${file}`;
  let script;
  try { script = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, file), "utf8")); }
  catch (e) { fail(where, `JSON として読めない: ${e.message}`); continue; }
  scripts.set(file, script);
  if (!Array.isArray(script.frames) || !script.frames.length) { fail(where, "frames が無い"); continue; }
  const ids = new Set();
  let sum = 0;
  for (const frame of script.frames) {
    const at = `${where}#${frame.id ?? "?"}`;
    if (!frame.id || ids.has(frame.id)) fail(at, "カット id が無いか重複している");
    ids.add(frame.id);
    if (!KINDS.has(frame.kind)) fail(at, `kind が不正: ${frame.kind}`);
    if (!(frame.duration > 0)) fail(at, "duration が正でない");
    sum += frame.duration || 0;
    if (frame.cue !== undefined && !CUES.has(frame.cue)) fail(at, `cue が不正: ${frame.cue}`);
    if (frame.kind === "image" && !frame.art) fail(at, "image カットに art が無い");
    if (!frame.source) continue;
    const [sourceFile, dialogueId] = String(frame.source).split("#");
    const lines = dialogueLines(sourceFile, dialogueId);
    if (!lines) { fail(at, `出典が見つからない: ${frame.source}`); continue; }
    const exception = EXCERPT_EXCEPTIONS.get(`${file}:${frame.id}`);
    if (!excerptMatches(frame.text, lines) && !exception) {
      fail(at, `抜粋が原文と一致しない: ${frame.source}`);
    }
  }
  if (script.duration !== sum) fail(where, `duration の合計が合わない: 宣言 ${script.duration} / 実測 ${sum}`);
}

// 登録表（PREVIEWS）に載っている予告は、台本と素材の実在まで確認する。
// 共通プレイヤー（PR1）がまだ無い枝ではこの節を飛ばす。main に PR1 が入れば常時有効になる。
const playerPath = path.join(ROOT, "remake/js/chapters/chapter-preview.js");
let registeredCount = 0;
if (!fs.existsSync(playerPath)) {
  console.log("note: chapter-preview.js が無いため登録表の確認を省略（台本自体の検査は実施済み）");
} else {
const playerSource = fs.readFileSync(playerPath, "utf8");
const previewsBlock = playerSource.slice(playerSource.indexOf("export const PREVIEWS"));
const entries = [...previewsBlock.matchAll(/\n {2}(\w+): \{([\s\S]*?)\n {2}\},/g)];
if (!entries.length) fail("chapter-preview.js", "登録表 PREVIEWS の項目が読めない");
const tracked = new Set(
  execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean),
);
for (const [, key, block] of entries) {
  registeredCount++;
  const scriptUrl = block.match(/scriptUrl: "([^"]+)"/)?.[1];
  const assetDir = block.match(/assetDir: "([^"]+)"/)?.[1];
  if (!scriptUrl || !assetDir) { fail(`PREVIEWS.${key}`, "scriptUrl / assetDir が無い"); continue; }
  const scriptRel = path.posix.normalize(path.posix.join("remake", scriptUrl));
  const script = scripts.get(path.posix.basename(scriptRel));
  if (!script) { fail(`PREVIEWS.${key}`, `台本が見つからない: ${scriptRel}`); continue; }
  for (const frame of script.frames) {
    if (!frame.art) continue;
    const artRel = path.posix.normalize(path.posix.join("remake", assetDir, `${frame.art}.webp`));
    if (!fs.existsSync(path.join(ROOT, artRel)) && !tracked.has(artRel)) {
      fail(`PREVIEWS.${key}`, `素材が見つからない: ${artRel}`);
    }
  }
}
}

if (errors.length) {
  console.error(`chapter preview scripts: ${errors.length} problem(s)`);
  errors.forEach(e => console.error(`- ${e}`));
  process.exit(1);
}
console.log(`PASS chapter preview scripts: ${scriptFiles.length} scripts, ${registeredCount} registered previews, structure/source/excerpt verified`);
