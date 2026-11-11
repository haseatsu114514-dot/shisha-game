// 台詞の組版（vn/text.js）を、実際の台詞データと代表例で確かめる。ブラウザ不要。
// 語の途中で折らず手前の区切りで早めに折ること、2行目だけ短い切れ端を残さないこと、禁則・2行改ページ・ページの切れ目を見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoWrap, paginate, WRAP_LIMIT, MAX_PAGE_LINES, textWidth } from "../js/vn/text.js";
import { wrapProblems } from "./text_wrap_rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const strip = (s) => s.replace(/\[\/?[a-z]+\]/g, "");
const width = (s) => [...strip(s)].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
const lines = (text) => autoWrap(text).split("\n");

// エディタの字数目安も本編のトークン計算を使う（装飾・改行・結合文字）。
assert.equal(textWidth("[imp]👩‍🍳が[/imp]\nAB"), 3);

// 1) 以前は語の途中で折れていた第1章の台詞。守る語が2行に分かれない
const keepWhole = [
  ["蒸らしの間、店内には炭が静かに弾ける音だけが鳴っている。", ["鳴っている"]],
  ["ふわっと、今まで嗅いだことのない複雑な香りが広がった。", ["広がった"]],
  ["あ、でもパッキーは祈りが通じたの見たことないんですよね〜♪ ぷぷぷっ！", ["ぷぷぷっ", "ないんですよね"]],
  ["各テーブル、まずは出だしの煙の立ち上がりを審査員がチェックしていくぞ！", ["審査員が"]],
  ["なんか、ああいうの聞くと頑張れますよね、……えへへ", ["えへへ"]],
  ["（お客さんの方から好みを言ってくれた、……ありがたい）", ["ありがたい"]],
  ["今まで見たことのない、小さくて、でも確かな笑顔だった。", ["笑顔"]],
  ["アニスとリコリスのブレンドすら完全にコントロールできない者が、他の味を語るなど……笑止千万", ["笑止千万", "コントロール"]],
  ["外は雨。こういう日は客足がまばらな代わりに、一人ひとりが長い。追加注文が続いた。", ["一人ひとり"]],
  ["パッキーね、最初からうすうす気付いてたんですよ〜？", ["ですよ"]],
];
for (const [text, words] of keepWhole) {
  const joined = lines(text).join("｜");
  for (const word of words) assert.ok(joined.includes(word), `「${word}」が折れた: ${joined}`);
}

// 2) 「♡ 」の後ろで折ったら行頭の空白は出さない。閉じ括弧＋助詞・「──」の間では折らない
for (const text of [
  "えへへ、せっかくお店に来てくれたんだもん♡ みんなに楽しい気持ちで帰ってほしいの",
  "みんと特製のオススメ作っちゃうね♡ ゆっくり味わっていってねー♡ ……あ、お水も出すから、",
]) {
  for (const line of lines(text).slice(1)) assert.ok(!/^[ 　]/.test(line), `行頭に空白: ${line}`);
}
assert.ok(!lines("アダムさんって、どうしてそこまで『原点』を極めることにこだわるんですか？").some((l) => l.startsWith("を")));
assert.ok(!lines("見えない所で──ずっと前から、積み上げてきたものがあったんだと思う").some((l) => l.startsWith("─")));

// 3) 改ページが増えないときは文末を優先し、増えるときは後ろの区切りで折って1ページに収める
assert.equal(lines("今日は早めに店を開ける。お前は炭の準備と、ホースの洗浄を頼む")[0], "今日は早めに店を開ける。");
const compact = "炭が爆ぜた。オレンジ色の照明の中で、白い煙がゆっくりほどけて、天井へ昇っていく。";
assert.equal(paginate(compact).length, 1, paginate(compact).join(" ‖ "));

// 3b) 2行になる台詞は、文末→読点→文節の順で折る位置を選び、2行目だけが短い「切れ端」を残さない
//     （2026-11-11 オーナー「二行目だけ短いとか、変な位置の改行が気になる」）。
for (const [text, expected] of [
  ["上の青に当てたら上の2つ、下なら下の2つが閉じるよ！", "上の青に当てたら上の2つ、｜下なら下の2つが閉じるよ！"],
  ["スミさんがホースを手に取り、ゆっくりと煙を吸い込んだ。", "スミさんがホースを手に取り、｜ゆっくりと煙を吸い込んだ。"],
  ["若いのに教わって入れたはいいが、使い方がまだ怪しくてね", "若いのに教わって入れたはいいが、｜使い方がまだ怪しくてね"],
  // 文末の直後に始まる「……」は次の文の頭。行頭に置いてよい
  ["こっちのお茶、甘いんだって。……僕、けっこう好きかも", "こっちのお茶、甘いんだって。｜……僕、けっこう好きかも"],
  ["（同じ工程のはずなのに。……この差は、どこにある）", "（同じ工程のはずなのに。｜……この差は、どこにある）"],
  // 短い返事の文は1行目に単独で置いてよい（切れ端ではない）
  ["うん。頭ではもう残ってないって、分かってるんだけどね", "うん。｜頭ではもう残ってないって、分かってるんだけどね"],
  // 短い2文目は文末で折ったまま（文の途中へ戻さない）
  ["原点に返れば、次にやることも見えてくる。それだけだ", "原点に返れば、次にやることも見えてくる。｜それだけだ"],
  // 句読点で折れない時は、1行目をなるべく長く保ちつつ、2行目が短くなりすぎない文節まで戻す
  ["アダムと名乗る男は無言で手際よくシーシャを作り始めた。", "アダムと名乗る男は無言で手際よく｜シーシャを作り始めた。"],
  ["シフトが終わったあと、スミさんに店で使うフレーバーの受け取りを頼まれた。", "シフトが終わったあと、スミさんに店で使う｜フレーバーの受け取りを頼まれた。"],
  // 1行に収まる「」の中では折らない。ハッシュタグは一語
  ["スマホのメモに「苺：熱を上げる前に待つ」と打ち込んだ。", "スマホのメモに｜「苺：熱を上げる前に待つ」と打ち込んだ。"],
  ["この『にぃーっ』、真似して撮ったら #みんとポーズ で上げてね♡ 八重歯はなくても大丈夫！",
    "この『にぃーっ』、真似して撮ったら #みんとポーズ｜で上げてね♡ 八重歯はなくても大丈夫！"],
]) assert.equal(lines(text).join("｜"), expected);
// 文末「、……」の「……」は前の句に付く（行頭に置かない）
assert.ok(!lines("だから、これは預けるんじゃなくて、あげる、……お礼、かな").some((l) => l.startsWith("…")));
// 3b') 規範の判定（CI で止めるもの）: 切れ端と文の途中の改ページは error、短い2文目や文末で割れる2ページは止めない
const levels = (text) => wrapProblems(text, paginate).problems.filter((p) => p.level === "error").map((p) => p.code);
assert.deepEqual(levels("それを「客の思い込み」って片づけられると、腹が立つ"), ["short-second"]);
assert.deepEqual(levels("木製の重厚なドアを開けた瞬間、暴力的なまでの甘さとアニスの香りが壁のように押し寄せてきた。"), ["mid-sentence"]);
assert.deepEqual(levels("原点に返れば、次にやることも見えてくる。それだけだ"), []);
assert.deepEqual(levels("ガラス越しにホールをのぞく。片付けの進む客席の隅に、チャコール博士が1人残っていた。"), []);
// 3c) 2ページになる長い台詞は、ページの切れ目を文末に合わせる（一文を2つの吹き出しにまたがせない）
assert.deepEqual(paginate("説明会の控室では、短く名乗ったきり黙っていた人だ。今はカウンターの奥で、片手を大きく広げている。"),
  ["説明会の控室では、\n短く名乗ったきり黙っていた人だ。", "今はカウンターの奥で、片手を大きく広げている。"]);
assert.deepEqual(paginate("凛想でいいよ、モルモットくん。じゃあ、契約成立。……さっそく最初のサンプル、試してみようか"),
  ["凛想でいいよ、モルモットくん。じゃあ、契約成立。\n……さっそく最初のサンプル、試してみようか"]);

// 4) 全台詞の不変条件: 1行は上限以内、行頭禁則・行頭の空白なし、1ページは2行まで
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const files = process.argv.includes("--fixed-only") ? [] : fs.readdirSync(path.join(root, "data/dialogue")).filter((f) => f.endsWith(".json"));
const texts = [];
function walk(node, file, id) {
  if (Array.isArray(node)) return node.forEach((x) => walk(x, file, id));
  if (!node || typeof node !== "object") return;
  const did = node.dialogue_id || id;
  if (typeof node.text === "string" && node.text.trim()) texts.push({ file, id: did, text: node.text });
  for (const [k, v] of Object.entries(node)) if (k !== "text" && typeof v === "object") walk(v, file, did);
}
for (const f of files) walk(JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", f), "utf8")), f, "");
const problems = [], rules = [];
for (const { file, id, text } of texts) {
  for (const segment of text.split("\n")) {
    autoWrap(segment).split("\n").forEach((line, i, rows) => {
      if (width(line) > WRAP_LIMIT && [...strip(line)].length > 1) problems.push(`${file}:${id} 幅超過 ${line}`);
      // 文末（。！？）の直後に始まる「……」だけは次の文の頭なので、行頭に置ける
      const sentenceLeader = /^[…‥]/.test(strip(line)) && /[。！？][ 　]*$/.test(strip(rows[i - 1] || ""));
      if (i > 0 && ((NO_LINE_START.includes([...strip(line)][0]) && !sentenceLeader) || /^[ 　]/.test(strip(line)))) {
        problems.push(`${file}:${id} 行頭禁則 ${line}`);
      }
    });
  }
  for (const page of paginate(text)) {
    if (page.split("\n").length > MAX_PAGE_LINES) problems.push(`${file}:${id} 3行のページ ${page}`);
  }
  // 改行の規範（text_wrap_rules.mjs の error）: 2行目だけ短い・文の途中でページが割れる。全台詞で0件に保つ（TXW08）
  for (const p of wrapProblems(text, paginate).problems) {
    if (p.level === "error") rules.push(`${file}:${id} ${p.message}\n    ${paginate(text).map((pg) => pg.replaceAll("\n", "／")).join("  ‖  ")}`);
  }
}
assert.deepEqual(problems, [], problems.slice(0, 20).join("\n"));
assert.deepEqual(rules, [], `改行の規範から外れた台詞が ${rules.length}件ある。言い換えるか、文を分けて直す。` +
  `確かめ方: node .claude/skills/text-style/check_wrap.mjs（text-style スキル）\n${rules.slice(0, 20).join("\n")}`);

// 本心と同じ固定枠に収める発言は1行ずつ送る。装飾・全文を失わない。
const singleLineText = "[imp]今日は、会社からの通知を切って、ゆっくり煙の香りだけを楽しみたい。[/imp]";
const singleLinePages = paginate(singleLineText, { maxLines: 1 });
assert(singleLinePages.length > 1);
assert(singleLinePages.every(page => !page.includes("\n")));
assert.equal(singleLinePages.map(strip).join(""), strip(singleLineText));
assert(singleLinePages.every(page => page.startsWith("[imp]") && page.endsWith("[/imp]")));

console.log(process.argv.includes("--fixed-only") ? "text_wrap OK: fixed cases; corpus skipped" : `text_wrap OK: ${texts.length} texts`);
