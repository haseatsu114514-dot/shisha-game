// 制作の演出部品（craft/fx.js）: 出し方の切り替えと、ヒットストップが「見た目だけ」止める印を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/craft/fx.js", import.meta.url), "utf8");
const smokeSource = fs.readFileSync(new URL("../js/core/smoke.js", import.meta.url), "utf8");
const recordSource = fs.readFileSync(new URL("../js/craft/rig-record.js", import.meta.url), "utf8");

class Node {
  constructor(cls = "") { this.cls = cls; this.children = []; this.dataset = {}; this.anims = 0; this.parent = null;
    this.style = { setProperty(k, v) { this[k] = v; } }; }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  get parentElement() { return this.parent; }
  get offsetWidth() { return 0; }
  get classList() { const n = this; n._cls ??= new Set(); return { add: c => n._cls.add(c), remove: c => n._cls.delete(c), contains: c => n._cls.has(c) }; }
  setAttribute(k, v) { this.attrs = { ...this.attrs, [k]: v }; }
  querySelector(sel) {
    if (sel.includes(".fx-layer")) return this.children.find(c => c.cls === "fx-layer") || null;
    // 作業風景の、見えている工程の絵（口の位置つき）
    return null;
  }
  // 作業風景の、見えている工程の絵
  querySelectorAll(sel) {
    if (!sel.includes(".worker-action")) return [];
    const out = [], walk = n => { if (n.cls === "worker-action" && !n.hidden) out.push(n); n.children.forEach(walk); };
    walk(this); return out;
  }
  closest(sel) { let n = this; while (n) { if (sel === `.${n.cls}`) return n; n = n.parent; } return null; }
  animate() { this.anims++; return { finished: new Promise(() => {}) }; }
  getBoundingClientRect() { const [left, top, width, height] = this.rect || [0, 0, 100, 100]; return { left, top, width, height, right: left + width, bottom: top + height }; }
}

async function load({ dom = true, reduced = false, calm = false, auto = null, turbo = false } = {}) {
  let now = 1000;
  const g = {
    performance: { now: () => now }, setTimeout: () => 0,
    window: { __remake: { craftTest: { auto }, vnTest: { turbo } } },
  };
  if (dom) Object.assign(g, {
    matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ position: "relative", objectPosition: "50% 75%" }),
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    document: {
      body: { classList: { contains: c => calm && c === "reduce-shake" } },
      // 煙の層（core/smoke.js）が作る canvas。className をこの偽ノードの cls に写す
      createElement: () => {
        const n = new Node();
        Object.defineProperty(n, "className", { set(v) { n.cls = String(v).split(" ")[0]; }, get() { return n.cls; } });
        n.isConnected = true;
        n.getContext = () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} });
        return n;
      },
    },
  });
  const context = vm.createContext(g);
  const util = { el: (spec, a, b) => {
    const n = new Node(spec.split(".")[1] || "");
    const opts = Array.isArray(a) ? {} : a || {}, kids = Array.isArray(a) ? a : b || [];
    Object.assign(n.dataset, opts.dataset || {}); Object.assign(n.style, opts.style || {}); n.text = opts.text; n.title = opts.title;
    if (opts["aria-label"]) n.setAttribute("aria-label", opts["aria-label"]);
    n.append(...kids.filter(Boolean)); return n;
  }, rand: (a, b) => (a + b) / 2 };
  const utilMod = new vm.SyntheticModule(Object.keys(util), function () { for (const [k, v] of Object.entries(util)) this.setExport(k, v); }, { context });
  const mod = new vm.SourceTextModule(source, { context });
  const record = new vm.SourceTextModule(recordSource, { context });
  const smoke = new vm.SourceTextModule(smokeSource, { context });
  const link = spec => {
    if (spec === "../core/util.js") return utilMod;
    if (spec === "../core/smoke.js") return smoke;
    if (spec === "./fx.js") return mod;
    throw Error(`Unexpected import ${spec}`);
  };
  await mod.link(link); await record.link(link);
  await mod.evaluate(); await record.evaluate();
  const bench = new Node("bench"), host = new Node("plane"), zoom = new Node("disc");
  bench.append(host, zoom);
  // 作業風景の窓（作業台 1280×720 の左側）と、はじめの吸い出しの絵（横長 3:2。口の位置は fx.js が絵に対する割合で持つ）
  const stage = new Node("bench-worker-stage"), actor = new Node("worker-action");
  bench.rect = [0, 0, 1280, 720]; stage.rect = [0, 80, 400, 600]; actor.rect = [0, 110, 330, 570];
  Object.assign(actor, { naturalWidth: 1280, naturalHeight: 853 }); actor.dataset.scene = "pull";
  stage.append(actor);
  return { fx: mod.namespace, rig: record.namespace, bench, host, zoom, stage, actor, worker: () => bench.append(stage), tick: ms => { now += ms; } };
}

const layer = host => host.children.find(c => c.cls === "fx-layer");

// 本番の通常表示: 止め＋寄り＋閃光・輪・火の粉
{
  const h = await load();
  assert.equal(h.fx.fxMode(), "full");
  h.fx.impact(h.host, "perfect", { zoomNode: h.zoom });
  assert.equal(Number(h.bench.dataset.hitStopUntil), 1000 + h.fx.IMPACT.perfect.ms);
  assert.equal(h.zoom.anims, 1, "the board zooms once");
  assert.equal(layer(h.host).children.length, 2 + h.fx.IMPACT.perfect.sparks, "flash, ring and sparks");
  assert.equal(h.fx.fxHolding(h.host), true);
  h.tick(h.fx.IMPACT.perfect.ms + 1);
  assert.equal(h.fx.fxHolding(h.host), false, "the picture resumes after the stop");
  // 重なった止めは終わりだけ延ばし、短くしない
  h.fx.hitStop(h.zoom, 200); h.tick(50); h.fx.hitStop(h.zoom, 20);
  assert.equal(Number(h.bench.dataset.hitStopUntil), 1000 + h.fx.IMPACT.perfect.ms + 1 + 200);
  // GOOD は止めない・寄らない。ミスは何も出さない
  const g = await load();
  g.fx.impact(g.host, "good", { zoomNode: g.zoom });
  assert.equal(g.bench.dataset.hitStopUntil, undefined);
  assert.equal(g.zoom.anims, 0);
  assert.equal(layer(g.host).children.length, g.fx.IMPACT.good.sparks);
  g.fx.impact(g.host, "miss");
  assert.equal(layer(g.host).children.length, g.fx.IMPACT.good.sparks);
}

// 設定「揺れ・閃光を減らす」: 止めと火の粉だけ（寄り・輪・閃光なし）
{
  const h = await load({ calm: true });
  assert.equal(h.fx.fxMode(), "calm");
  h.fx.impact(h.host, "big", { zoomNode: h.zoom });
  assert.equal(h.zoom.anims, 0);
  assert.equal(layer(h.host).children.length, h.fx.IMPACT.big.sparks);
  assert(h.fx.fxHolding(h.host));
}

// 端末の「動きを減らす」: 止めだけ
{
  const h = await load({ reduced: true });
  assert.equal(h.fx.fxMode(), "still");
  h.fx.impact(h.host, "big", { zoomNode: h.zoom });
  assert.equal(h.zoom.anims, 0);
  assert.equal(layer(h.host), undefined, "no particles");
  assert(h.fx.fxHolding(h.host));
}

// 自動操作・会話の早送り・DOM の無い環境: 何もしない
for (const opts of [{ auto: "good" }, { turbo: true }, { dom: false }]) {
  const h = await load(opts);
  assert.equal(h.fx.fxMode(), "off");
  h.fx.impact(h.host, "big", { zoomNode: h.zoom });
  assert.equal(h.bench.dataset.hitStopUntil, undefined);
  assert.equal(layer(h.host), undefined);
  assert.equal(h.fx.fxHolding(h.host), false);
}

// 吸い出しの山場: はじめの口元から吐く。煙の canvas は作業風景の窓の中に1枚（計器や結果の札の上には載せない）。
// 止めだけの設定・自動操作・はじめの絵が出ていないときは、何も出さずにすぐ返す
{
  const smokeIn = n => n.children.filter(c => c.cls === "smoke-layer");
  const h = await load();
  // 口の位置: 絵は枠（幅330・高さ570）に全体が収まる大きさ（幅330・高さ約220）で、縦は 75% の位置に置かれる
  h.worker();
  const mouth = h.fx.workerMouth(h.bench);
  const drawn = 853 * (330 / 1280), top = 110 + (570 - drawn) * .75;
  assert.ok(Math.abs(mouth.x - 330 * .457 / 1280) < 1e-6 && Math.abs(mouth.y - (top + drawn * .39) / 720) < 1e-6, `mouth sits on the drawn picture (${mouth.x}, ${mouth.y})`);
  assert.equal(mouth.stage, h.stage);
  h.fx.exhale(h.bench, { color: "rgb(12,200,255)" });
  assert.equal(smokeIn(h.stage).length, 1, "one smoke canvas inside the worker window");
  assert.equal(smokeIn(h.bench).length, 0, "nothing is laid over the gauges or the result card");
  const canvas = smokeIn(h.stage)[0];
  // canvas は窓の中に置くが、作業台と同じ枠（＝同じ細かさの升目）に合わせる
  assert.deepEqual([canvas.style.left, canvas.style.top, canvas.style.width, canvas.style.height], ["0.000%", "-13.333%", "320.000%", "120.000%"]);
  assert.equal(canvas.dataset.quality, "good");
  assert.equal(canvas.dataset.ring, "");
  for (const quality of ["thin", "harsh"]) {
    const q = await load(); q.worker();
    q.fx.exhale(q.bench, { quality });
    assert.equal(smokeIn(q.stage)[0].dataset.quality, quality, "the smoke shows how the heat went");
  }
  const g = await load(); g.worker();
  g.fx.exhale(g.bench, { grand: true });
  assert.equal(smokeIn(g.stage)[0].dataset.quality, "best");
  assert.equal(smokeIn(g.stage)[0].dataset.ring, "1", "grand adds a smoke ring");
  // 煙の輪: はじめの口元から吹く（吐く煙と同じ層）。出せない設定では false（呼び出し側が線の輪を見せる）
  assert.equal(g.fx.smokeRing(g.host), true);
  assert.equal(smokeIn(g.stage).length, 1, "the ring shares the worker's smoke layer");
  assert.equal(smokeIn(g.bench).length, 0);
  for (const opts of [{ reduced: true }, { auto: "good" }]) {
    const q = await load(opts); q.worker();
    assert.equal(await q.fx.exhale(q.bench), false);
    assert.equal(q.fx.smokeRing(q.host), false);
    assert.equal(smokeIn(q.stage).length + smokeIn(q.bench).length, 0);
  }
  // 吸い出しのはじめの絵が出ていない（窓が無い・絵が隠れている・別の工程の絵・口が窓の外）ときは、煙を出さない
  for (const setup of [q => {}, q => { q.worker(); q.actor.hidden = true; }, q => { q.worker(); q.actor.dataset.scene = "heat"; }, q => { q.worker(); q.actor.rect = [0, 900, 330, 570]; }]) {
    const q = await load(); setup(q);
    assert.equal(q.fx.workerMouth(q.bench), null);
    assert.equal(await q.fx.exhale(q.bench), false);
    assert.equal(q.fx.smokeRing(q.host), false);
    assert.equal(smokeIn(q.stage).length + smokeIn(q.bench).length, 0);
  }
  assert.deepEqual(["rgb(12,200,255)", "#abc", "#a1b2c3", "red"].map(h.fx.hex6), ["#0cc8ff", "#aabbcc", "#a1b2c3", "#d9d2e6"]);
}

// 一台の記録: 段階の境目、care1/care2 を「整」へ、気配の平均、全工程が輝くと満ちる、作り直しの復元は静かに
{
  const h = await load();
  const { buildRigRecord, recordTier, RECORD_STEPS } = h.rig;
  assert.deepEqual([100, 88, 87.9, 74, 73.9, 55, 54.9, 0].map(recordTier), ["brilliant", "brilliant", "great", "great", "good", "good", "dim", "dim"]);
  const r = buildRigRecord();
  const stage = new Node("stage"); stage.append(r.aura, r.root);
  const lamp = id => r.root.children.find(c => c.dataset.step === id);
  assert.equal(lamp("holes").dataset.tier, "off");
  r.mark("holes", 95);
  assert.equal(lamp("holes").dataset.tier, "brilliant");
  assert(layer(stage).children.length > 0, "brilliant lamp throws sparks");
  r.mark("care1", 60); r.mark("care2", 80);
  assert.equal(lamp("care").dataset.tier, "great", "the second care round relights the same lamp");
  r.mark("heat:2", 100); r.mark("mix", 100);
  assert.equal(r.tierOf("heat"), null, "sub-steps and unrecorded steps leave no lamp");
  // 気配＝灯った工程の明るさの合計÷5（穴=1、整=.7）
  assert.equal(r.aura.style["--rig-aura"], ((1 + .7) / 5).toFixed(3));
  assert.equal(r.aura.dataset.full, "false");
  for (const [id] of RECORD_STEPS) r.mark(id, 99);
  assert.equal(r.aura.dataset.full, "true");
  const again = buildRigRecord(); const stage2 = new Node("stage"); stage2.append(again.aura, again.root);
  again.restore({ holes: { score: 90 }, heat: { score: 40 }, pull: null, steam: { score: "x" } });
  assert.equal(again.tierOf("holes"), "brilliant"); assert.equal(again.tierOf("heat"), "dim");
  assert.equal(again.tierOf("pull"), null); assert.equal(again.tierOf("steam"), null);
  assert.equal(layer(stage2), undefined, "restoring is quiet");
}

console.log("[craft-fx] PASS: full/calm/still/off modes, visual-only hit stop marker, extend-not-shorten, good/miss tiers, exhale puffs/ring/off, colour normalising, rig record tiers/care lamp/aura/restore");
