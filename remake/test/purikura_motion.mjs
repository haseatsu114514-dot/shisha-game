// プリクラの演出（#939）をVMで動かす。ブラウザの画素は見ない（目視は __remake.dev.motion("purikura")）。
// 器の大きさ・後片付け・音の数・a/bの違い・手の震え（あげはの線だけ途中で止まる）・LOAD中の中止・会話の呼び出しを確かめる。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../js/motions/purikura.js");

async function fixture({ variant = "a", width = 1280, height = 720, cg = null, loadDuring = false, interruptMusic = false, throwDuring = false, random = 0, imageFails = false, loadBeforePrint = false } = {}) {
  const context = vm.createContext({ console, Math: Object.assign(Object.create(Math), { random: () => random }) });
  const made = [], anims = [], sounds = {}, music = [], queried = [], images = [], recorded = [];
  let elapsed = 0;
  let musicNow = "sweets_or_sweets", during = false;
  let disconnected = false, staged = 0, root = null;
  function el(selector, attrs = {}, children = []) {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    const node = { selector, attrs, style: { ...attrs.style }, children: [], append(...xs) { this.children.push(...xs); } };
    node.append(...[].concat(children).filter((c) => c != null && c !== false));
    made.push(node);
    return node;
  }
  const owner = { flags: {} }, loaded = { flags: {} };
  const values = {
    "util.js": { el, sleep: async (ms) => {
      elapsed += ms;
      if (during && loadBeforePrint && elapsed >= 7000) stateModule.setExport("state", loaded);
      if (during && interruptMusic) { stateModule.setExport("state", loaded); musicNow = "bgm_map"; }
      if (during && throwDuring) throw new Error("interrupted");
    } },
    "state.js": { state: owner },
    "gallery.js": { recordCg: (id) => recorded.push({ id, elapsed }) },
    "data.js": { cgUrl: (id) => (queried.push(id), typeof cg === "object" && cg ? cg[id] ?? null : id === "cg_ageha_first_purikura" ? cg : null), portraitInfo: (id, face) => ({ src: `${id}_${face}.webp` }) },
    "ui.js": { imageReady: async (url) => { images.push(url); if (loadDuring) stateModule.setExport("state", loaded); return !imageFails; } },
    "audio.js": { preloadBgm: async () => true, currentBgm: () => musicNow, playBgm: (key) => { music.push(key); musicNow = key; during = key?.startsWith("bgm_purikura"); }, SE: new Proxy({}, { get: (_, name) => () => { sounds[name] = (sounds[name] || 0) + 1; } }) },
    "transition-kit.js": { svg: el, move: async (node, frames, ms, opt = {}) => { anims.push({ node, frames, ms, ...opt }); } },
    "mg-kit.js": { MG_EASE: { out: "out", in: "in", inOut: "inOut", back: "back" } },
    "stage.js": {
      backdrop: () => el("backdrop"),
      stagePlay: async (name, run) => {
        staged++;
        root = el(`div.mo.mo-${name}`); root.clientWidth = width; root.clientHeight = height;
        await run(root);
      },
    },
  };
  let stateModule;
  context.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async (path) => {
    const name = path.split("/").at(-1), exports = values[name];
    assert(exports, `unexpected import ${path}`);
    const m = new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
    if (name === "state.js") stateModule = m;
    return m;
  });
  await module.evaluate();
  let error;
  try { await module.namespace[variant](); } catch (e) { if (!throwDuring) throw e; error = e; }
  const find = (selector) => made.filter((n) => n.selector === selector);
  return { queried, images, recorded, made, anims, sounds, music, musicNow, error, disconnected, staged, root, find, plans: module.namespace.PLANS };
}

// a: 毎回3・2・1、盛りを選ぶ／b: 撮影はさっと、スタンプ多め
for (const [variant, ticks, menu] of [["a", 9, 3], ["b", 3, 0]]) {
  const f = await fixture({ variant });
  assert.equal(f.staged, 1);
  assert.deepEqual(f.music, ["bgm_purikura", "sweets_or_sweets"]);
  assert(f.disconnected, "resize observer cleanup");
  const scene = f.find("div.mo-pk-scene")[0];
  assert.equal(scene.style.width, "1280px");
  assert.equal(scene.style.transform, "translate(-50%, -50%) scale(1)");
  assert.equal(f.root.children[0].selector, "backdrop", "backdrop covers the stage");
  assert.equal(f.sounds.punch, 3, "three shutters");
  assert.equal(f.sounds.tick, ticks, "countdown ticks");
  assert.equal(f.sounds.just, 1, "one glow");
  assert.equal(f.made.filter((n) => n.selector.startsWith("div.mo-pk-mori-btn")).length, menu, "only a lets Ageha pick the mori level");
  // 撮った3枚・写真の窓・印刷4枚に、ふたりの立ち絵が入る（文字は画像に焼き込まない）
  const sprites = f.find("img.mo-pk-sprite.hajime").length;
  assert.equal(sprites, 3 + 3 + 4, "poses, thumbs and printed copies use sprites while the CG is missing");
  const words = f.made.filter((n) => n.selector === "text").map((n) => n.children.join(""));
  for (const w of ["ハジメっち♡", "答え合わせ係", "あげ↑"]) assert(words.includes(w), `doodle word ${w}`);
  // 手の震え: あげはのハートは途中（1 - 0.58）で止まり、はじめの星は最後まで描く
  const dash = (node) => f.anims.filter((a) => a.node === node && a.frames.at(-1).strokeDashoffset !== undefined).map((a) => a.frames.at(-1).strokeDashoffset);
  const paths = f.find("path").filter((n) => n.attrs.pathLength === 1);
  const heart = paths.find((n) => n.attrs.stroke === "#ff3d9a"), star = paths.find((n) => n.attrs.stroke === "#ffc93c");
  assert.deepEqual(dash(heart).map((v) => +v.toFixed(2)), [0.42]);
  assert.deepEqual(dash(star), [0]);
  // ハートの線は、よれる（まっすぐな星と違い、隣り合う点の向きが細かく揺れる）
  const pts = heart.attrs.d.slice(1).split(" L").map((p) => p.split(" ").map(Number));
  assert(pts.length > 60);
  // ペン先は止まってから震え、スタンプの道具へ持ち替える。最初のスタンプはその後で、ハートの位置を覆う
  const pink = f.find("div.mo-pk-pen.pink")[0];
  const penMoves = f.anims.filter((a) => a.node === pink && a.frames.some((k) => k.transform)).map((a) => a.delay);
  assert.equal(penMoves.length, 3, "trace, tremble, lift");
  assert(penMoves[0] < penMoves[1] && penMoves[1] < penMoves[2]);
  const pops = f.anims.filter((a) => a.node.attrs?.class === "mo-pk-pop").map((a) => a.delay).sort((x, y) => x - y);
  assert(pops[0] > penMoves[2], "stamps start after Ageha puts the pen down");
  const plan = f.plans[variant];
  assert(pops.at(-1) + 300 <= plan.print, "every stamp lands before printing");
  // 予約した動きは、最後の暗転までに終わる（繰り返しの光を除く）
  const last = Math.max(...f.anims.filter((a) => a.node !== f.root).map((a) => (a.delay || 0) + a.ms * (a.iterations || 1)));
  assert(last <= plan.end + 700, `animations end before fade: ${last}`);
}

// 小さい画面でも器ごと縮める
{
  const f = await fixture({ width: 844, height: 326 });
  assert.equal(f.find("div.mo-pk-scene")[0].style.transform, `translate(-50%, -50%) scale(${Math.min(844 / 1280, 326 / 720)})`);
}
// #921 の4コマのCG（cg_ageha_first_purikura）があれば、最後に出てくるシールだけそれを使い、真ん中で左右に切る
{
  const cg = "img/cgs/cg_ageha_first_purikura.webp";
  const f = await fixture({ cg });
  const halves = f.made.filter((n) => n.selector.startsWith("div.mo-pk-half.cg."));
  assert.deepEqual(halves.map((n) => n.selector), ["div.mo-pk-half.cg.left", "div.mo-pk-half.cg.right"]);
  for (const h of halves) assert.equal(h.style.backgroundImage, `url("${cg}")`);
  const sheet = f.find("div.mo-pk-sheet.cg")[0];
  assert.deepEqual([sheet.style.width, sheet.style.height], ["374px", "560px"], "the 2:3 sheet keeps its shape");
  assert.equal(f.find("div.mo-pk-cutline")[0].style.left, "186px", "cut down the middle");
  assert.equal(f.find("img.mo-pk-sprite.hajime").length, 3 + 3, "shooting and thumbs still come from sprites");
  assert.equal(f.find("div.mo-pk-print").length, 0, "no sprite copies on the printed sheet");
  const right = halves[1];
  const slide = f.anims.find((a) => a.node === right).frames.at(-1).transform;
  assert(slide.startsWith("translate(-93.5px"), "the kept half moves to the centre");
}
// 半分こ用の縦長シール（1列分）があれば、4コマより優先し、同じ絵を左右に1枚ずつ並べる
{
  const strip = "img/cgs/cg_ch2_ageha_purikura_strip.webp";
  const f = await fixture({ cg: { cg_ch2_ageha_purikura_strip: strip, cg_ageha_first_purikura: "img/cgs/cg_ageha_first_purikura.webp" } });
  const halves = f.made.filter((n) => n.selector.startsWith("div.mo-pk-half.cg."));
  assert.deepEqual(halves.map((n) => n.selector), ["div.mo-pk-half.cg.strip.left", "div.mo-pk-half.cg.strip.right"]);
  for (const h of halves) assert.equal(h.style.backgroundImage, `url("${strip}")`);
  const sheet = f.find("div.mo-pk-sheet.cg")[0];
  assert.deepEqual([sheet.style.width, sheet.style.height], ["616px", "520px"], "two 640x1080 strips side by side");
  assert.equal(f.find("div.mo-pk-cutline")[0].style.left, "307px");
}
// 旧manifestに候補が残っていても、乱数・演出案にかかわらず採用画像だけを使う。
for (const variant of ["a", "b"]) for (const random of [0, .4, .999]) {
  const ids = ["", "_soft", "_gal"].map((s) => `cg_ch2_ageha_purikura_strip${s}`);
  const cg = Object.fromEntries(ids.map((id) => [id, `img/cgs/${id}.webp`]));
  const f = await fixture({ variant, random, cg });
  const halves = f.made.filter((n) => n.selector.startsWith("div.mo-pk-half.cg.strip."));
  assert.equal(halves.length, 2);
  for (const half of halves) assert.equal(half.style.backgroundImage, `url("${cg.cg_ch2_ageha_purikura_strip}")`);
  assert.deepEqual(f.queried, [ids[0]], "never resolve rejected candidate IDs or the old CG");
  assert.deepEqual(f.images.filter(url => url.includes("/cgs/")), [cg[ids[0]]]);
  assert.deepEqual(f.recorded.map(v => v.id), [ids[0]], "record exactly the printed CG");
  assert(f.recorded[0].elapsed >= f.plans[variant].print, "unlock after printing, not while preloading");
}
// 中断・画像失敗・立ち絵代用で採用画像を誤解放しない。
for (const opts of [{ loadDuring: true }, { loadBeforePrint: true }, { imageFails: true }]) {
  const f = await fixture({ cg: { cg_ch2_ageha_purikura_strip: "img/cgs/cg_ch2_ageha_purikura_strip.webp" }, ...opts });
  assert.deepEqual(f.recorded, []);
}
assert.deepEqual((await fixture()).recorded, []);
assert.deepEqual((await fixture({ cg: "img/cgs/cg_ageha_first_purikura.webp" })).recorded.map(v => v.id), ["cg_ageha_first_purikura"]);
// 画像を待つ間にLOADされたら、前のセーブの演出を始めない
{
  const f = await fixture({ loadDuring: true });
  assert.equal(f.staged, 0);
  assert.equal(Object.keys(f.sounds).length, 0);
}

for (const [random, expected] of [[0, "bgm_purikura"], [.4, "bgm_purikura_b"], [.999, "bgm_purikura_d"]]) {
  const f = await fixture({ random });
  assert.deepEqual(f.music, [expected, "sweets_or_sweets"], "each random bucket plays one track and restores music");
}
for (const opts of [{ interruptMusic: true }, { throwDuring: true }]) {
  const f = await fixture(opts);
  assert(f.disconnected);
  if (opts.interruptMusic) {
    assert.deepEqual(f.music, ["bgm_purikura"]);
    assert.equal(f.musicNow, "bgm_map", "LOAD's new music must survive cleanup");
  } else {
    assert.equal(f.error?.message, "interrupted");
    assert.deepEqual(f.music, ["bgm_purikura", "sweets_or_sweets"], "error restores shop music");
  }
}

// 会話: ギャル友の回の最後に一度だけ呼び、秘密を知っているかで締めの心の声が変わる
const story = JSON.parse(read("../../data/dialogue/ch2_ageha_story.json")).dialogues.find((d) => d.dialogue_id === "remake_ch2_ageha_gyaru");
const motions = story.lines.filter((l) => l.type === "motion");
assert.deepEqual(motions, [{ type: "motion", id: "purikura" }]);
const cond = story.lines.find((l) => l.type === "condition" && l.flag === "_ch2_ageha_secret");
assert(cond && story.branches[cond.next_true]?.length && story.branches[cond.next_false]?.length);
const engine = read("../js/vn/engine.js");
assert(/purikura: \(\) => purikuraShot\(\)/.test(engine), "engine runs the purikura motion line");
// 入口（scene-motions.js の purikuraShot）: 動きを減らす設定では読み込まず、SKIP中は最後まで再生し、読み込み中にLOADされたら始めない（#1081 H05）
async function wrapperCase({ skip = false, reduce = false, loadDuringImport = false } = {}) {
  const context = vm.createContext({ console, document: { body: { classList: { contains: () => skip } } } });
  const owner = { flags: {} }, loaded = { flags: {} };
  let imported = 0, played = 0, stateModule;
  const motion = new vm.SyntheticModule(["a", "b"], function () {
    this.setExport("a", async () => { played++; });
    this.setExport("b", async () => { played++; });
  }, { context });
  await motion.link(() => {}); await motion.evaluate();
  const wrapper = new vm.SourceTextModule(read("../js/core/scene-motions.js"), {
    context,
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, "../motions/purikura.js");
      imported++;
      if (loadDuringImport) stateModule.setExport("state", loaded);
      return motion;
    },
  });
  const imports = { "state.js": { state: owner, config: { shortSeen: false } }, "data.js": { DB: {} }, "transition-kit.js": { reducedMotion: () => reduce }, "mg-kit.js": { motionVariant: () => "a" }, "ui.js": { loadingNotice: () => ({}) }, "module-loading.js": { withLoadingNotice: async (task, _opts) => await task } };
  await wrapper.link(async (path) => {
    const name = path.split("/").at(-1), values = imports[name];
    const m = new vm.SyntheticModule(Object.keys(values), function () { for (const [k, v] of Object.entries(values)) this.setExport(k, v); }, { context });
    if (name === "state.js") stateModule = m;
    return m;
  });
  await wrapper.evaluate();
  await wrapper.namespace.purikuraShot();
  return { imported, played };
}
assert.deepEqual(await wrapperCase(), { imported: 1, played: 1 });
assert.deepEqual(await wrapperCase({ skip: true }), { imported: 1, played: 1 }, "SKIP plays the purikura to the end (#1081 H05)");
assert.deepEqual(await wrapperCase({ reduce: true }), { imported: 0, played: 0 }, "reduced motion skips the purikura");
assert.deepEqual(await wrapperCase({ loadDuringImport: true }), { imported: 1, played: 0 }, "LOAD during the lazy import does not start the old purikura");

console.log("[purikura] PASS: fit, cleanup, sounds, a/b, sprites/CG, doodle words, tremor stop then stamp, LOAD guard (image wait and lazy import), SKIP plays / reduced motion skips, dialogue hook");
