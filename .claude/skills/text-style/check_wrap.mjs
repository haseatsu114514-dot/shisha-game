#!/usr/bin/env node
// 書いた台詞が本編でどう折れるかを見て、改行の規範（SKILL.md「改行・改ページのルール」）から外れるものを知らせる。
// 折り方は本編と同じ remake/js/vn/text.js をそのまま使う（ここに別の折り返しを持たない）。
//
//   node .claude/skills/text-style/check_wrap.mjs            # main から足した・変えた台詞だけ（data/dialogue/*.json。未コミットも含む）
//   node .claude/skills/text-style/check_wrap.mjs "台詞" …   # その文を直接
//   node .claude/skills/text-style/check_wrap.mjs --all      # 全台詞
//   --strict を付けると、止める問題（error）が1件でもあれば終了コード1（既定は0。知らせるだけ）
// 判定の中身は remake/test/text_wrap_rules.mjs（CI の text_wrap.mjs と同じもの）。error は CI でも止まる。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "../../..");
const { paginate } = await import(path.join(root, "remake/js/vn/text.js"));
const { wrapProblems, dialogueTexts: textsOf } = await import(path.join(root, "remake/test/text_wrap_rules.mjs"));
const args = process.argv.slice(2);
const strict = args.includes("--strict"), all = args.includes("--all");
// コマンドラインで書いた「\n」は改行として読む（データの JSON では本物の改行になっている）
const direct = args.filter((a) => !a.startsWith("--")).map((a) => a.replaceAll("\\n", "\n"));

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

const texts = collect();
let flagged = 0, errors = 0;
for (const t of texts) {
  const { pages, problems } = wrapProblems(t.text, paginate);
  if (!problems.length && !direct.length) continue;
  const bad = problems.some((p) => p.level === "error");
  if (problems.length) flagged++;
  if (bad) errors++;
  const who = t.speaker ? ` ${t.speaker}` : "";
  console.log(`${bad ? "要修正" : problems.length ? "要確認" : "OK"}  ${t.file} ${t.id}${who}`);
  console.log(`      ${pages.map((p) => p.replaceAll("\n", "／")).join("  ‖  ")}`);
  for (const p of problems) console.log(`      - ${p.level === "error" ? "【直す】" : ""}${p.message}`);
}
const scope = direct.length ? "指定した文" : all ? "全台詞" : "main から足した・変えた台詞";
console.log(`\n${scope} ${texts.length}件を確認。要修正 ${errors}件（CI で止まる）・要確認 ${flagged - errors}件（／は改行、‖ はページの切れ目）`);
if (strict && errors) process.exit(1);
