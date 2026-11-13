// 公開物を軽くする remake/tools/slim_deploy.py が、ゲームの読む絵を外さないかを確かめる。
// node remake/test/slim_deploy.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(repo, "remake/tools/slim_deploy.py");
const python = (args, opts = {}) => execFileSync("python3", args, { cwd: repo, encoding: "utf8", ...opts });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "slim-deploy-"));

try {
  // 1) WebP を見てから assets/ を読む「決まった場所」は、今も WebP を見ている
  const sites = JSON.parse(python(["-c", [
    "import json, sys", "sys.path.insert(0, 'remake/tools')", "import slim_deploy as s",
    "print(json.dumps({'aware': sorted(s.WEBP_AWARE), 'args': [list(k) for k in s.ARGUMENT_SITES]}))",
  ].join("\n")]));
  for (const [file, literal] of sites.aware) {
    const lines = fs.readFileSync(path.join(repo, file), "utf8").split("\n");
    const at = lines.findIndex((line) => line.includes(literal));
    assert(at >= 0, `${file} に ${literal} が無い。slim_deploy.py の WEBP_AWARE を見直す`);
    assert.match(lines.slice(Math.max(0, at - 3), at + 1).join("\n"), /webp/i,
      `${file} の ${literal} が WebP の一覧を見ていない。元PNGを公開物から外すと絵が消える`);
  }
  for (const [file, literal] of sites.args) {
    const text = fs.readFileSync(path.join(repo, file), "utf8");
    assert.equal(text.split(literal).length - 1, 1, `${file} の ${literal} は1か所だけ（引数の一覧で残す絵を決めている）`);
  }

  // 2) 本物のコードとデータで、残す絵・外す絵が想定どおり。何にでも合う書き方が増えたら落とす
  const site = path.join(temp, "site");
  const textFile = (rel) => /\.(js|mjs|css|html|json)$/.test(rel);
  const copyText = (rel) => {
    const from = path.join(repo, rel);
    if (fs.statSync(from).isDirectory()) {
      for (const name of fs.readdirSync(from)) copyText(path.join(rel, name));
    } else if (textFile(rel)) {
      fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true });
      fs.copyFileSync(from, path.join(site, rel));
    }
  };
  for (const rel of ["remake/js", "remake/css", "remake/data", "remake/previews", "data", "experiments/proto/street", "tools/title-review"]) copyText(rel);
  for (const name of fs.readdirSync(path.join(repo, "remake"))) if (name.endsWith(".html")) copyText(path.join("remake", name));
  const { kept, removable } = JSON.parse(python([script, site, "--report"]));
  for (const rel of [
    "ui/face_icons/face_faris.png", // ラクダレース: 目録の読み込み前の顔アイコン
    "backgrounds/bg_osu_map_day.png", "backgrounds/bg_osu_map_night.png", // 街歩きの地図
    "backgrounds/bg_cafe_day.png", // 街歩きの舞台データ
    "sprites/characters/sumi/chr_sumi_normal.png", "ui/face_icons/face_sumi.png", // 表題CGの選別ツールの参考画像
  ]) assert(kept.includes(rel), `${rel} は直接読まれるので残す`);
  assert(!kept.includes("ui/title_arts/title_art_keyvisual_01.png"), "選別ツールの sources は GitHub へのリンクだけ");
  assert(removable.length >= (kept.length + removable.length) * 0.9,
    `外せる元PNGが ${removable.length}/${kept.length + removable.length} しかない。何にでも合う assets/ の書き方が増えていないか`);

  // 3) 外すのは WebP 版がある元PNGだけ。直接の参照・WebP の無い絵・開発用フォルダの扱い
  const mini = path.join(temp, "mini");
  const put = (rel, text = "x") => {
    fs.mkdirSync(path.dirname(path.join(mini, rel)), { recursive: true });
    fs.writeFileSync(path.join(mini, rel), text);
  };
  put("remake/data/manifest.json", JSON.stringify({ webp: ["a/x.png", "a/y.png", "a/z.png", "a/w.png"] }));
  for (const name of ["x", "y", "z", "w"]) put(`assets/a/${name}.png`);
  for (const name of ["x", "y", "w"]) put(`remake/img/a/${name}.webp`);
  put("remake/js/m.js", 'const direct = new URL("../../../assets/a/y.png", import.meta.url);\nconst t = `../assets/a/w${n}.png`;\n');
  put("remake/test/t.mjs", "const all = `../assets/${rel}`;\n");
  put("remake/tools/u.py", "print('dev')\n");
  python([script, mini]);
  assert(!fs.existsSync(path.join(mini, "assets/a/x.png")), "WebP 版があり直接の参照が無い元PNGは外す");
  assert(fs.existsSync(path.join(mini, "assets/a/y.png")), "直接の参照がある元PNGは残す");
  assert(fs.existsSync(path.join(mini, "assets/a/w.png")), "${…} の書き方に合う元PNGは残す");
  assert(fs.existsSync(path.join(mini, "assets/a/z.png")), "WebP 版の無い元PNGは残す");
  assert(fs.existsSync(path.join(mini, "remake/img/a/x.webp")), "WebP 版は残す");
  assert(!fs.existsSync(path.join(mini, "remake/test")) && !fs.existsSync(path.join(mini, "remake/tools")), "開発用フォルダは外す");
  console.log(`slim_deploy: PASS（本物のコードで 外せる ${removable.length} / 残す ${kept.length}）`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
