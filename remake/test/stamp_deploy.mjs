// 公開時の版の名札（remake/tools/stamp_deploy.py）が、本物の index.html と CSS に効くかを確かめる。
// index.html の書き方を変えて名札が付かなくなったら、公開の前にここで落とす。
// node remake/test/stamp_deploy.mjs
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const remake = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(remake, "tools/stamp_deploy.py");
const site = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-deploy-"));
const out = path.join(site, "remake");
try {
  fs.mkdirSync(path.join(out, "js/core"), { recursive: true });
  fs.copyFileSync(path.join(remake, "index.html"), path.join(out, "index.html"));
  fs.cpSync(path.join(remake, "css"), path.join(out, "css"), { recursive: true });
  fs.writeFileSync(path.join(out, "js/main.js"), 'import "./core/a.js";\nexport function boot() {}\n');
  fs.writeFileSync(path.join(out, "js/core/a.js"), "export {};\n");

  const source = fs.readFileSync(path.join(remake, "index.html"), "utf8");
  assert.match(source, /<meta name="suien-build" content="dev" data-built="">/, "手元の index.html は dev のまま");

  execFileSync("python3", [script, site, "--build", "abc1234", "--built-at", "2026-11-06 21:00"]);
  const html = fs.readFileSync(path.join(out, "index.html"), "utf8");

  // 本体はフォルダごと新しい名前で読む。プレビュー用・古い index.html のために js/ も残す
  assert.match(html, /import\("\.\/js-abc1234\/main\.js"\)/);
  assert.doesNotMatch(html, /import\("\.\/js\/main\.js"\)/);
  assert(fs.existsSync(path.join(out, "js-abc1234/core/a.js")));
  assert(fs.existsSync(path.join(out, "js/main.js")));

  // 版と公開日時（タイトル右下の ver.）
  assert.match(html, /<meta name="suien-build" content="abc1234" data-built="2026-11-06 21:00">/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "build.json"), "utf8")), { build: "abc1234", builtAt: "2026-11-06 21:00" });

  // index.html の CSS はすべて版付き。フォントの先読み・画像は変えない（CSS 側と URL がずれて二重に読まないように）
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert(links.length > 10);
  for (const href of links) assert.match(href, /^css\/[\w./-]+\.css\?v=abc1234$/, href);
  assert.match(html, /href="fonts\/ZenKakuGothicNew-Medium\.woff2"/);
  assert.match(html, /url\("img\/ui\/loading\/loading_bg\.webp"\)/);

  // CSS の @import も版付き。画像・フォントの url() はそのまま
  const trpg = fs.readFileSync(path.join(out, "css/trpg.css"), "utf8");
  assert.match(trpg, /@import url\("venue-host\.css\?v=abc1234"\)/);
  const base = fs.readFileSync(path.join(out, "css/base.css"), "utf8");
  assert.match(base, /url\("\.\.\/fonts\/ZenKakuGothicNew-Medium\.woff2"\)/);
  assert.doesNotMatch(base, /\?v=/);

  // 書き方が変わって名札を付けられないときは、黙って公開せず失敗する
  fs.writeFileSync(path.join(out, "index.html"), html.replace('import("./js-abc1234/main.js")', 'import("./app.js")'));
  const broken = spawnSync("python3", [script, site, "--build", "def5678"], { encoding: "utf8" });
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /本体の import/);
  console.log("stamp_deploy: PASS");
} finally {
  fs.rmSync(site, { recursive: true, force: true });
}
