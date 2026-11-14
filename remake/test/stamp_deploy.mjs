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
// Keep the retention regression in the existing quick CI suite.
execFileSync("python3", [path.join(remake, "test/deploy_history.py")], { stdio: "inherit" });
const site = fs.mkdtempSync(path.join(os.tmpdir(), "stamp-deploy-"));
// ミニゲームなどの試遊ページ（2026-11-11 オーナー「試遊リンクだと過去の仕様になってしまう」）。本編と同じ名札を付ける
const TRIAL_PAGES = ["desert-ride.html", "camel-race.html", "axe-throw.html", "ichidai.html", "trpg-preview.html", "trpg-campaign-preview.html"];
const out = path.join(site, "remake");
try {
  fs.mkdirSync(path.join(out, "js/core"), { recursive: true });
  fs.copyFileSync(path.join(remake, "index.html"), path.join(out, "index.html"));
  for (const page of TRIAL_PAGES) fs.copyFileSync(path.join(remake, page), path.join(out, page));
  fs.copyFileSync(path.join(remake, "conversation-preview.html"), path.join(out, "conversation-preview.html"));
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
  // CSS はバンドル化されているので、本数は bundles.json の区間の数と一致する
  const bundleCount = JSON.parse(fs.readFileSync(path.join(remake, "css/bundles.json"), "utf8")).segments.length;
  assert.equal(links.length, bundleCount);
  for (const href of links) assert.match(href, /^css\/[\w./-]+\.css\?v=abc1234$/, href);
  assert.match(html, /href="fonts\/ZenKakuGothicNew-Medium\.woff2"/);
  assert.match(html, /url\("img\/ui\/loading\/loading_bg\.webp"\)/);

  // CSS の @import も版付き。画像・フォントの url() はそのまま
  const trpg = fs.readFileSync(path.join(out, "css/trpg.css"), "utf8");
  assert.match(trpg, /@import url\("venue-host\.css\?v=abc1234"\)/);
  const base = fs.readFileSync(path.join(out, "css/base.css"), "utf8");
  assert.match(base, /url\("\.\.\/fonts\/ZenKakuGothicNew-Medium\.woff2"\)/);
  assert.doesNotMatch(base, /\?v=/);

  // 試遊ページ: 版の meta・CSS と起動スクリプトの ?v=。本体は page-boot.js が js-<版>/ から読む
  for (const page of TRIAL_PAGES) {
    const source = fs.readFileSync(path.join(remake, page), "utf8");
    assert.match(source, /<meta name="suien-build" content="dev" data-built="">/, `${page}: 手元は dev のまま`);
    assert.match(source, /<script src="js\/page-boot\.js" data-page="js\/[\w./-]+\.js"><\/script>/, `${page}: page-boot.js から起動する`);
    assert.doesNotMatch(source, /<script type="module" src="js\//, `${page}: 本体を直接読まない（古い版がキャッシュから混ざる）`);
    const stamped = fs.readFileSync(path.join(out, page), "utf8");
    assert.match(stamped, /<meta name="suien-build" content="abc1234" data-built="2026-11-06 21:00">/, page);
    assert.match(stamped, /<script src="js\/page-boot\.js\?v=abc1234" data-page="js\/[\w./-]+\.js"><\/script>/, page);
    const css = [...stamped.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
    assert(css.length >= 3, page);
    for (const href of css) assert.match(href, /^css\/[\w./-]+\.css\?v=abc1234$/, `${page}: ${href}`);
  }
  // 版の meta を持たない開発用のページは触らない
  assert.equal(fs.readFileSync(path.join(out, "conversation-preview.html"), "utf8"), fs.readFileSync(path.join(remake, "conversation-preview.html"), "utf8"));

  // 書き方が変わって名札を付けられないときは、黙って公開せず失敗する
  fs.writeFileSync(path.join(out, "index.html"), html.replace('import("./js-abc1234/main.js")', 'import("./app.js")'));
  const broken = spawnSync("python3", [script, site, "--build", "def5678"], { encoding: "utf8" });
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /本体の import/);
  fs.copyFileSync(path.join(remake, "index.html"), path.join(out, "index.html"));
  fs.writeFileSync(path.join(out, "camel-race.html"), fs.readFileSync(path.join(remake, "camel-race.html"), "utf8").replace(/<script src="js\/page-boot\.js"[^>]*><\/script>/, '<script type="module" src="js/camel-race-page.js"></script>'));
  const brokenPage = spawnSync("python3", [script, site, "--build", "def5678"], { encoding: "utf8" });
  assert.notEqual(brokenPage.status, 0, "a trial page that lost page-boot.js is not published silently");
  assert.match(brokenPage.stderr, /camel-race\.html/);
  console.log("stamp_deploy: PASS");
} finally {
  fs.rmSync(site, { recursive: true, force: true });
}

