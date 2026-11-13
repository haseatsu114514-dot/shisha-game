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
  querySelector(sel) { return sel.includes(".fx-layer") ? this.children.find(c => c.cls === "fx-layer") || null : null; }
  closest(sel) { let n = this; while (n) { if (sel === ".bench" && n.cls === "bench") return n; n = n.parent; } return null; }
  animate() { this.anims++; return { finished: new Promise(() => {}) }; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

async function load({ dom = true, reduced = false, calm = false, auto = null, turbo = false } = {}) {
  let now = 1000;
  const g = {
    performance: { now: () => now }, setTimeout: () => 0,
    window: { __remake: { craftTest: { auto }, vnTest: { turbo } } },
  };
  if (dom) Object.assign(g, {
    matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ position: "relative" }),
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
  return { fx: mod.namespace, rig: record.namespace, bench, host, zoom, tick: ms => { now += ms; } };
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

// 吸い出しの山場: 通常は切り抜きの層に煙の canvas を1枚載せ（出来と輪の印を持つ）、止めだけの設定・自動操作ではすぐ返す
{
  const h = await load();
  h.fx.exhale(h.host, { color: "rgb(12,200,255)" });
  const own = n => n.children.find(c => c.cls === "fx-exhale");
  assert.deepEqual(own(h.host).children.map(c => c.cls), ["smoke-layer"], "one smoke canvas in its own clipped layer");
  assert.equal(own(h.host).style.overflow, "hidden");
  assert.equal(own(h.host).dataset.quality, "good");
  assert.equal(own(h.host).dataset.ring, undefined);
  for (const quality of ["thin", "harsh"]) {
    const q = await load();
    q.fx.exhale(q.host, { quality });
    assert.equal(own(q.host).dataset.quality, quality, "the smoke shows how the heat went");
  }
  const g = await load();
  g.fx.exhale(g.host, { grand: true });
  assert.equal(own(g.host).dataset.quality, "best");
  assert.equal(own(g.host).dataset.ring, "1", "grand adds a smoke ring");
  // 煙の輪: 作業台の上の目印の位置から描く。出せない設定では false（呼び出し側が線の輪を見せる）
  assert.equal(g.fx.smokeRing(g.host), true);
  assert.ok(g.bench.children.some(c => c.cls === "smoke-layer"));
  for (const opts of [{ reduced: true }, { auto: "good" }]) {
    const q = await load(opts);
    assert.equal(await q.fx.exhale(q.host), false);
    assert.equal(q.host.children.length, 0);
    assert.equal(q.fx.smokeRing(q.host), false);
    assert.equal(q.bench.children.some(c => c.cls === "smoke-layer"), false);
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
