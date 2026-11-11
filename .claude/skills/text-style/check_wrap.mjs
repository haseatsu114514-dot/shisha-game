#!/usr/bin/env node
// 書いた台詞が本編でどう折れるかを見て、改行の規範（SKILL.md「改行・改ページのルール」）から外れるものを知らせる。
// 折り方は本編と同じ remake/js/vn/text.js をそのまま使う（ここに別の折り返しを持たない）。
//
//   node .claude/skills/text-style/check_wrap.mjs            # main から足した・変えた台詞だけ（data/dialogue/*.json。未コミットも含む）
//   node .claude/skills/text-style/check_wrap.mjs "台詞" …   # その文を直接
//   node .claude/skills/text-style/check_wrap.mjs --all      # 全台詞
//   --strict を付けると、知らせが1件でもあれば終了コード1（既定は0。知らせるだけ）
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "../../..");
const { paginate } = await import(path.join(root, "remake/js/vn/text.js"));
const args = process.argv.slice(2);
const strict = args.includes("--strict"), all = args.includes("--all");
// コマンドラインで書いた「\n」は改行として読む（データの JSON では本物の改行になっている）
const direct = args.filter((a) => !a.startsWith("--")).map((a) => a.replaceAll("\\n", "\n"));

const strip = (s) => s.replace(/\[\/?[a-z]+\]/g, "");
const width = (s) => [...strip(s)].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
// 行やページの終わりとして自然な文字（文末・閉じ括弧・余韻）
const ENDS = /[。！？!?…‥」』）♡♪〜ー]$/;

function textsOf(json, file) {
  const out = [];
  (function walk(node, id) {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, id));
    if (!node || typeof node !== "object") return;
    const did = node.dialogue_id || id;
    if (typeof node.text === "string" && node.text.trim()) out.push({ file, id: did || "", speaker: node.speaker || "", text: node.text });
    for (const [k, v] of Object.entries(node)) if (k !== "text" && v && typeof v === "object") walk(v, did);
  })(json, "");
  return out;
}

const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const dialogueDir = path.join(root, "data/dialogue");

function collect() {
  if (direct.length) return direct.map((text, i) => ({ file: "(直接)", id: String(i + 1), speaker: "", text }));
  const files = fs.readdirSync(dialogueDir).filter((f) => f.endsWith(".json"));
  const current = (f) => textsOf(JSON.parse(fs.readFileSync(path.join(dialogueDir, f), "utf8")), f);
  if (all) return files.flatMap(current);
  let base;
  try { base = git("merge-base", "HEAD", "origin/main"); } catch {
    try { base = git("rev-parse", "HEAD"); } catch { console.log("git の比べる相手が見つからないので全台詞を見る"); return files.flatMap(current); }
  }
  const changed = new Set([
    ...git("diff", "--name-only", base, "--", "data/dialogue").split("\n"),
    ...git("ls-files", "--others", "--exclude-standard", "--", "data/dialogue").split("\n"),
  ].filter((p) => p.endsWith(".json")).map((p) => path.basename(p)));
  const out = [];
  for (const f of [...changed].filter((f) => fs.existsSync(path.join(dialogueDir, f)))) {
    let before = new Set();
    try { before = new Set(textsOf(JSON.parse(git("show", `${base}:data/dialogue/${f}`)), f).map((t) => t.text)); } catch { /* 新しいファイル */ }
    out.push(...current(f).filter((t) => !before.has(t.text)));
  }
  return out;
}

function problems(text) {
  const found = [], pages = paginate(text);
  if (text.includes("\n")) found.push("手で改行している（改行はゲームに任せる。演出で折る時だけ、1行を全角24字以内に）");
  if (pages.length > 1) {
    found.push(`${pages.length}ページに分かれる（全角48字以内に縮めるか、台詞を2つに分ける）`);
    pages.slice(0, -1).forEach((page, i) => {
      if (!ENDS.test(strip(page).replace(/\s+$/, ""))) found.push(`${i + 1}ページ目が文の途中で切れる`);
    });
  }
  for (const page of pages) {
    const rows = page.split("\n");
    if (rows.length !== 2) continue;
    const [a, b] = rows.map(width);
    // 「長い文。／短い2文目」は規範どおりなので知らせない
    if (b <= 5 && !/[。！？!?♡♪][\s　]*$/.test(strip(rows[0]))) found.push(`2行目だけ短い（「${strip(rows[1])}」。言い換えるか、読点の位置を変える）`);
    if (a <= 4 && b >= 16 && !/[。！？!?…‥」』）♡♪][\s　]*$/.test(strip(rows[0]))) found.push(`1行目だけ短い（「${strip(rows[0])}」）`);
  }
  return { pages, found };
}

const texts = collect();
let flagged = 0;
for (const t of texts) {
  const { pages, found } = problems(t.text);
  if (!found.length && !direct.length) continue;
  if (found.length) flagged++;
  const who = t.speaker ? ` ${t.speaker}` : "";
  console.log(`${found.length ? "要確認" : "OK"}  ${t.file} ${t.id}${who}`);
  console.log(`      ${pages.map((p) => p.replaceAll("\n", "／")).join("  ‖  ")}`);
  for (const f of found) console.log(`      - ${f}`);
}
const scope = direct.length ? "指定した文" : all ? "全台詞" : "main から足した・変えた台詞";
console.log(`\n${scope} ${texts.length}件を確認。要確認 ${flagged}件（／は改行、‖ はページの切れ目）`);
if (strict && flagged) process.exit(1);
