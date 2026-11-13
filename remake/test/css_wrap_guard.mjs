// 画面の文字の折り返しを守る（TXW08）。base.css が全体に当てている「文節で折る（word-break: auto-phrase）」を、
// 部品の CSS で打ち消していないかを調べる。LIME の吹き出しは word-break: break-word で文節を無視し、
// 「人手が足／りん」のように語の途中で折れていた（TXW05）。ブラウザ不要。
//
// 止めるもの: word-break: break-all / keep-all / break-word / normal、line-break: anywhere。
// 許すもの:
//   - 同じ規則の中で、その後に word-break: auto-phrase を書き直している（未対応ブラウザ向けの予備）
//   - 下の ALLOWED（理由つき）。足す時は理由を書く。規範は .claude/skills/text-style/SKILL.md
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWED = [
  { file: "remake/css/vn.css", selector: ".vn-text", reason: "会話の本文は vn/text.js の autoWrap が改行を入れる" },
  { file: "remake/css/look-retro.css", selector: ".retro-vn-", reason: "DS風の会話も autoWrap が改行を入れる（looks/retro/vn.js）" },
  { file: "remake/css/look-retro.css", selector: ".retro-shell", reason: "DS風（ドット書体）の外枠の既存の指定（2026-11-11 時点）。DS風の画面を変える時に見直す" },
  { file: "remake/css/craft.css", selector: ".audience-note", reason: "審査員の一言は craft/audience.js が autoWrap で改行を入れる（シーシャ作りは保留中）" },
  { file: "remake/css/daily.css", selector: ".xfer-text", reason: "セーブの引っ越しの英数字の文字列。どこで折れてもよい" },
  { file: "remake/css/daily-menu.css", selector: ".dm-flavor-name", reason: "フレーバー名を一語として保つ（overflow-wrap: anywhere で溢れだけ防ぐ）" },
];
const BAD = /(word-break\s*:\s*(break-all|keep-all|break-word|normal)|line-break\s*:\s*anywhere)\b/g;

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? cssFiles(p) : e.name.endsWith(".css") ? [p] : [];
  });
}

const found = [];
let checked = 0;
for (const abs of cssFiles(path.join(root, "remake/css"))) {
  const file = path.relative(root, abs).split(path.sep).join("/");
  const css = fs.readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectorText, body] = rule;
    const selector = selectorText.trim().replace(/\s+/g, " ");
    for (const m of body.matchAll(BAD)) {
      checked++;
      // 予備の指定の後に auto-phrase で書き直していればよい
      if (/word-break\s*:\s*auto-phrase/.test(body.slice(m.index + m[0].length))) continue;
      if (ALLOWED.some((a) => a.file === file && selector.includes(a.selector))) continue;
      const line = css.slice(0, rule.index + selectorText.length + 1 + m.index).split("\n").length;
      found.push(`${file}:${line} ${selector} { ${m[0]} }`);
    }
  }
}
assert.deepEqual(found, [], "文節の折り返しを打ち消す CSS がある。画面の文字が語の途中で折れる（例: LIME の「人手が足／りん」）。" +
  "外すか、どうしても要るなら remake/test/css_wrap_guard.mjs の ALLOWED に理由つきで足す（text-style スキル）\n" + found.join("\n"));
assert(checked > 0, "CSS を読めている");
console.log(`css_wrap_guard OK: ${checked} 件の指定を確認（許可 ${ALLOWED.length} か所）`);
