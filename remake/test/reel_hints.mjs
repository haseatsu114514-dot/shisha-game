// パッキースロットの設定示唆・説明・示唆履歴（#634）。
// node --experimental-vm-modules remake/test/reel_hints.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const context = vm.createContext({ Math, Map, Set, JSON, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) || null } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: noop, toast: noop },
  "core/data.js": { DB: {}, faceIconUrl: noop },
  "core/audio.js": { SE: {} },
};
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const path = url.href.slice(root.href.length), values = mocks[path];
  const mod = values ? new vm.SyntheticModule(Object.keys(values), function () {
    for (const [k, v] of Object.entries(values)) this.setExport(k, v);
  }, { context, identifier: url.href }) : new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, mod); await mod.link((s) => load(new URL(s, url))); return mod;
}
const reelModule = await load(new URL("daily/reel.js", root)); await reelModule.evaluate();
const reel = reelModule.namespace;
const core = modules.get(new URL("core/state.js", root).href).namespace;
// vm の別領域で作られた配列・オブジェクトを、比べる前に普通の値へ
const plain = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

// 偶奇の台詞はオーナー承認の文言だけ。分類ごとの出やすさは従来どおり
const kind = (id) => reel.SETTING_HINTS.find((h) => h.id === id);
eq(kind("odd").lines, ["いち、さん、ご！ 今日はこのリズムが好き♪", "今日は奇数が気になるな〜"]);
eq(kind("even").lines, ["に、よん、ろく！ 今日はこのリズムが好き♪", "今日は偶数が気になるな〜"]);
const weights = Object.fromEntries(reel.SETTING_HINTS.map((h) => [h.id, [1, 2, 3, 4, 5, 6].map((s) => h.w(s))]));
eq(weights, {
  neutral: [40, 40, 40, 40, 40, 40], odd: [16, 6, 16, 6, 16, 6], even: [6, 16, 6, 16, 6, 16],
  low: [14, 14, 7, 7, 3, 3], high: [3, 3, 7, 7, 14, 14], ge2: [0, 4, 4, 4, 4, 4], ge4: [0, 0, 0, 4, 4, 4], six: [0, 0, 0, 0, 0, 5],
});
const allHintText = reel.SETTING_HINTS.flatMap((h) => h.lines).join("\n");
assert(!/きれいにそろ|ふたつに分け/.test(allHintText), "使わない比喩");

// 確率・設定配分は変えない
eq(reel.core.SETTINGS, {
  1: { weight: 30, reg: 0.85, big: 0.92, bell: 24 }, 2: { weight: 25, reg: 0.92, big: 0.96, bell: 26 },
  3: { weight: 20, reg: 1, big: 1, bell: 28 }, 4: { weight: 12, reg: 1.12, big: 1.05, bell: 30 },
  5: { weight: 8, reg: 1.25, big: 1.1, bell: 32 }, 6: { weight: 5, reg: 1.45, big: 1.18, bell: 36 },
});

// 説明（遊び方カード・#639）: 場所を明かさない・固定曜日と書かない・確定ではないことを伝える・文字は短く
const help = reel.GUIDE.map((g) => `${g.head} ${g.body}`).join("\n");
assert(!/観音|お参り|曜日|毎週|週替わり|金|虹/.test(help), "場所・固定曜日・金/虹の予告を書かない");
for (const must of ["1〜6", "必ず当たるわけではない", "7日", "章が変わる", "同じ設定", "低い設定", "特定のスポットでも設定が変わることがあるよ。街を歩いて見つけてみてね！", "確定ではない", "次のゲーム"]) {
  assert(help.includes(must), must);
}
for (const g of reel.GUIDE) assert([...g.body].length <= 40, `ラミネートのように短く: ${g.body}`);
eq(reel.core.CUE_ORDER, ["blue", "green", "red"]);

// 示唆の履歴: 設定変更ごとに分け、同じ日の変更でも前の示唆を今の設定の証拠にしない
const s = core.newGame();
Object.assign(s, { phase: "daily", chapter: 1, day: 3 });
s.reel.installed = true;
reel.rememberHint("前の示唆");
eq(reel.splitHints(s.reel).current.map((h) => h.text), ["前の示唆"]);
reel.changeSetting(); // 同じ日に設定が変わる
reel.rememberHint("今の示唆");
let split = reel.splitHints(s.reel);
eq(split.current.map((h) => h.text), ["今の示唆"]);
eq(split.past.map((h) => h.text), ["前の示唆"]);
// SAVE/LOAD しても同じ分け方
split = reel.splitHints(JSON.parse(JSON.stringify(s.reel)));
eq([split.current.map((h) => h.text), split.past.map((h) => h.text)], [["今の示唆"], ["前の示唆"]]);
// 章が変わって次にスロットが回る行動で選び直すと、その前の示唆は前の設定になる
s.reel.settingSince = { chapter: 1, day: 3 };
Object.assign(s, { chapter: 2, day: 15 });
const before = s.reel.settingDraws;
reel.onAction({ spent: 10 });
assert.equal(s.reel.settingDraws, before + 1);
assert.equal(reel.splitHints(s.reel).current.length, 0);
assert(reel.splitHints(s.reel).past.some((h) => h.text === "今の示唆"));
// 旧セーブ（period の無い記録・lastHint だけ）は、今の設定の証拠として扱わない
eq(reel.splitHints({ settingDraws: 0, note: { hints: [{ text: "旧", chapter: 1, day: 2 }] } }).current, []);
eq(reel.splitHints({ note: { lastHint: "もっと旧" } }).past.map((h) => h.text), ["もっと旧"]);
// ノートの表示用まとめも同じ分け方
const summary = reel.noteSummary(s.reel);
assert.equal(summary.currentHints.length, 0);
// 設定示唆の取得（フォールバックと安全確認）
for (const setting of [1, 2, 3, 4, 5, 6, 0, undefined, null, NaN]) {
  const line = reel.settingHint(setting);
  assert(typeof line === "string" && line.length > 0, `settingHint must return non-empty string for setting=${setting}`);
  assert(allHintText.includes(line), `settingHint line must belong to known hint lines: ${line}`);
}
console.log("[reel hints] PASS: approved odd/even lines, unchanged weights and settings, spoiler-free guide, period-separated history across same-day change, SAVE/LOAD, chapter redraw and legacy saves, guarded settingHint");

