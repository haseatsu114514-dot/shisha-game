// ライバルの小窓（craft/rival-windows.js）: 章ごとの顔ぶれが大会データと一致すること、灯の割り当て、
// 大会以外・第5章では出さないこと、作り直しの静かな復元を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.window ??= globalThis;
const real = {
  "./ch1-votes.js": await import("../js/craft/ch1-votes.js"),
  "../chapters/ch2-tournament-state.js": await import("../js/chapters/ch2-tournament-state.js"),
  "../chapters/ch3-tournament-state.js": await import("../js/chapters/ch3-tournament-state.js"),
  "../chapters/ch4-tournament-state.js": await import("../js/chapters/ch4-tournament-state.js"),
  "./rig-record.js": null, // 下で vm 内に読み込む（fx.js の差し替えを共有するため）
};
const source = fs.readFileSync(new URL("../js/craft/rival-windows.js", import.meta.url), "utf8");
const recordSource = fs.readFileSync(new URL("../js/craft/rig-record.js", import.meta.url), "utf8");

class Node {
  constructor(cls = "") { this.cls = cls; this.children = []; this.dataset = {}; this.isConnected = true; this._c = new Set();
    this.style = { setProperty(k, v) { this[k] = v; } }; }
  append(...kids) { this.children.push(...kids); }
  get classList() { const c = this._c; return { add: x => c.add(x), remove: x => c.delete(x), contains: x => c.has(x) }; }
  get offsetWidth() { return 0; }
  get parentElement() { return null; }
  get firstChild() { return this.children[0] || null; }
  setAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
}
const find = (n, pred, out = []) => { if (pred(n)) out.push(n); for (const c of n.children || []) find(c, pred, out); return out; };

async function load({ chapter = 1, mode = "tournament", fx = "full" } = {}) {
  const timers = [], cheers = [], sparkCalls = [];
  const context = vm.createContext({ setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {} });
  const el = (spec, a, b) => {
    const n = new Node(spec.split(".")[1] || "");
    const opts = Array.isArray(a) ? {} : a || {}, kids = Array.isArray(a) ? a : b || [];
    Object.assign(n.dataset, opts.dataset || {}); n.text = opts.text; n.src = opts.src;
    n.append(...kids.filter(Boolean)); return n;
  };
  const stubs = {
    "../core/util.js": { el },
    "../core/audio.js": { SE: { crowd: () => cheers.push(1) } },
    "../core/data.js": { faceIconUrl: id => `face_${id}.png`, displayName: id => id.toUpperCase() },
    "../core/state.js": { state: {} },
    "./fx.js": { sparks: (...a) => sparkCalls.push(a), shockRing() {}, fxMode: () => fx },
  };
  const synth = (values) => new vm.SyntheticModule(Object.keys(values), function () { for (const [k, v] of Object.entries(values)) this.setExport(k, v); }, { context });
  const record = new vm.SourceTextModule(recordSource, { context });
  const mod = new vm.SourceTextModule(source, { context });
  const cache = new Map();
  const link = spec => {
    if (spec === "./rig-record.js") return record;
    if (!cache.has(spec)) {
      const values = stubs[spec] || (real[spec] && { ...real[spec] });
      assert(values, `Unexpected import ${spec}`);
      cache.set(spec, synth(values));
    }
    return cache.get(spec);
  };
  await record.link(link); await mod.link(link);
  await record.evaluate(); await mod.evaluate();
  const cs = { mode, chapter };
  return { m: mod.namespace, rig: record.namespace, cs, timers, cheers, sparkCalls, run: () => { while (timers.length) timers.shift()(); } };
}

const tiersOf = (root) => Object.fromEntries(find(root, n => n.cls === "rival-card").map(card =>
  [card.dataset.rival, find(card, n => n.cls === "rival-lamp").map(l => l.dataset.tier).join(",")]));

// 顔ぶれは各章の大会データのライバルと一致（はじめを除く）
{
  const { m } = await load();
  assert.deepEqual(Array.from(m.RIVAL_LINEUPS[1], r => r.id), real["./ch1-votes.js"].CH1_CONTESTANTS.filter(id => id !== "hajime"));
  assert.deepEqual(Array.from(m.RIVAL_LINEUPS[2], r => r.id), real["../chapters/ch2-tournament-state.js"].CONTESTANTS.filter(id => id !== "hajime"));
  assert.deepEqual(Array.from(m.RIVAL_LINEUPS[3], r => r.id), [...real["../chapters/ch3-tournament-state.js"].CONTESTANTS].filter(id => id !== "hajime"));
  assert.deepEqual(Array.from(m.RIVAL_LINEUPS[4], r => r.id), [...real["../chapters/ch4-tournament-state.js"].CH4_CONTESTANTS].filter(id => id !== "hajime"));
  assert.equal(m.RIVAL_LINEUPS[5], undefined, "chapter 5 (one-on-one, no scoring UI) has no rival windows");
}

// 大会以外・第5章では作らない
for (const opts of [{ mode: "practice" }, { mode: "rehearsal", chapter: 4 }, { chapter: 5 }]) {
  const h = await load(opts);
  assert.equal(h.m.buildRivalWindows(h.cs), null, JSON.stringify(opts));
}

// 第1章: 工程ごとの値で灯る（穴=r0、炭=r1、蒸らし・提供=r2、調整1=r3、調整2=r4）。少し遅れて順に灯り、輝けば札が光って歓声は一回
{
  const h = await load();
  const w = h.m.buildRivalWindows(h.cs);
  const R = real["./ch1-votes.js"].CH1_RIVALS, tier = h.rig.recordTier;
  const imgs = () => find(w.root, n => n.cls === "" && n.src).map(n => n.src);
  assert.deepEqual(imgs(), [], "face icons are not requested while the bench is getting ready");
  w.showFaces(); w.showFaces();
  assert.deepEqual(Array.from(imgs()), ["face_naru.png", "face_adam.png", "face_minto.png"], "faces load once, later");
  w.mark("holes");
  assert.equal(tiersOf(w.root).naru.split(",")[0], "off", "rival lamps light after a short delay");
  assert.equal(h.timers.length, 3, "one delayed light per rival");
  h.run();
  for (const id of ["naru", "adam", "minto"]) assert.equal(tiersOf(w.root)[id].split(",")[0], tier(R[id][0]));
  const brilliant = ["naru", "adam", "minto"].filter(id => tier(R[id][0]) === "brilliant").length;
  assert.equal(h.cheers.length, brilliant ? 1 : 0, "one cheer per step at most");
  assert.equal(h.sparkCalls.length, brilliant);
  w.mark("care1"); h.run();
  assert.equal(tiersOf(w.root).naru.split(",")[4], tier(R.naru[3]));
  w.mark("care2"); h.run();
  assert.equal(tiersOf(w.root).naru.split(",")[4], tier(R.naru[4]));
  w.mark("mix"); w.mark("heat:2");
  assert.equal(h.timers.length, 0, "mix and sub-steps do not light rival lamps");
}

// 第2章: 一台の出来がそのまま全工程の灯。自動操作中は遅らせず静かに灯す
{
  const h = await load({ chapter: 2, fx: "off" });
  const w = h.m.buildRivalWindows(h.cs);
  w.mark("pull");
  assert.equal(h.timers.length, 0);
  const Q = real["../chapters/ch2-tournament-state.js"].RIVAL_QUALITY;
  assert.equal(tiersOf(w.root).kumicho.split(",")[3], h.rig.recordTier(Q.kumicho));
  assert.equal(h.cheers.length, 0);
}

// 作り直し: はじめの灯が付いている工程の分だけ、ライバルの灯も静かに戻す
{
  const h = await load({ chapter: 4 });
  const w = h.m.buildRivalWindows(h.cs);
  const record = h.rig.buildRigRecord();
  record.mark("holes", 90, { quiet: true }); record.mark("pull", 70, { quiet: true });
  w.restore(record);
  assert.equal(h.timers.length, 0, "restoring is immediate");
  const t = tiersOf(w.root).sheikh.split(",");
  assert.notEqual(t[0], "off"); assert.equal(t[1], "off"); assert.notEqual(t[3], "off"); assert.equal(t[4], "off");
  assert.equal(h.cheers.length, 0);
}

console.log("[craft-rival-windows] PASS: lineups match tournament data, no windows outside tournaments/ch5, delayed per-rival lighting with one cheer, ch1 per-step and care rounds, flat ch2 quality, quiet restore, deferred faces");
