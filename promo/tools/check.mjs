#!/usr/bin/env node
// 公式サイト（promo/）の点検。リポジトリのルートで: node promo/tools/check.mjs
//  1. index.html と site.css が指す絵・フォント・CSS・JS が全部そろっている（Git LFS のポインタのままも不可）
//  2. ページ内リンク（#story など）の行き先がある
//  3. サイトが promo/ の中だけで完結している（外へ出るのは「遊ぶ」のゲームへのリンクだけ）
// CIは絵を取得しない軽い作業場所で動くので、手元に無いファイルは Git の一覧（git ls-files）で確かめる。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const promo = path.join(root, "promo");
const html = readFileSync(path.join(promo, "index.html"), "utf8");
const css = readFileSync(path.join(promo, "css/site.css"), "utf8");

let tracked = new Set();
try {
  tracked = new Set(execFileSync("git", ["ls-files", "promo"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean));
} catch { /* Git の外（配布物の確認など）では、手元のファイルだけで確かめる */ }

const problems = [];
const seen = new Set();
const PLAY_LINK = "../remake/"; // ゲーム本体。公開先では promo/ の隣に置かれる

function checkFile(ref, from, baseDir) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return;
  if (/^(https?:|mailto:|data:)/.test(clean)) return;
  if (clean === PLAY_LINK) return;
  const abs = path.resolve(baseDir, clean);
  const rel = path.relative(root, abs).split(path.sep).join("/");
  if (!rel.startsWith("promo/")) { problems.push(`${from}: promo/ の外を指しています → ${ref}`); return; }
  if (seen.has(rel)) return;
  seen.add(rel);
  if (existsSync(abs)) {
    if (statSync(abs).size < 200 && /\.(webp|png|jpe?g|woff2)$/.test(rel)) problems.push(`${from}: Git LFS のポインタか壊れたファイルです → ${rel}`);
    return;
  }
  if (!tracked.has(rel)) problems.push(`${from}: ファイルがありません → ${rel}`);
}

// HTML: src / href / data-src / data-full / srcset
for (const match of html.matchAll(/\s(?:src|href|data-src|data-full)="([^"]+)"/g)) {
  const ref = match[1].replace(/&amp;/g, "&");
  if (ref.startsWith("#")) continue;
  checkFile(ref, "index.html", promo);
}
for (const match of html.matchAll(/\ssrcset="([^"]+)"/g)) {
  for (const part of match[1].split(",")) checkFile(part.trim().split(/\s+/)[0], "index.html", promo);
}
// CSS: url(...)
for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) checkFile(match[1], "css/site.css", path.join(promo, "css"));

// ページ内リンク
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const match of html.matchAll(/\s(?:href|aria-controls)="#?([^"]+)"/g)) {
  const raw = match[0];
  if (raw.includes('href="#')) { if (!ids.has(match[1])) problems.push(`index.html: ページ内リンクの行き先がありません → #${match[1]}`); }
  else if (raw.includes("aria-controls") && !ids.has(match[1])) problems.push(`index.html: aria-controls の行き先がありません → ${match[1]}`);
}

// 人物・店の切り替え: ボタンと中身が1対1でそろっている
for (const [button, panel, label] of [["cast-tab", "cast", "人物"], ["pin", "shop", "店"]]) {
  const key = panel === "cast" ? "data-cast" : "data-shop";
  const buttons = [...html.matchAll(new RegExp(`class="${button}[^"]*"[^>]*${key}="([^"]+)"`, "g"))].map((m) => m[1]);
  const panels = [...html.matchAll(new RegExp(`<article class="${panel}"[^>]*${key}="([^"]+)"`, "g"))].map((m) => m[1]);
  if (buttons.join() !== panels.join()) problems.push(`index.html: ${label}のボタンと中身の並びが合いません（ボタン ${buttons.length}／中身 ${panels.length}）`);
  if (!panels.length) problems.push(`index.html: ${label}の中身が見つかりません`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n公式サイトの点検: ${problems.length} 件の問題`);
  process.exit(1);
}
console.log(`公式サイトの点検: 問題なし（参照 ${seen.size} 件・ページ内の行き先 ${ids.size} 件）`);
