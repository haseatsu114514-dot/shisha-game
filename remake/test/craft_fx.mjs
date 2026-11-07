// 制作の演出部品（craft/fx.js）: 出し方の切り替えと、ヒットストップが「見た目だけ」止める印を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/craft/fx.js", import.meta.url), "utf8");

class Node {
  constructor(cls = "") { this.cls = cls; this.children = []; this.dataset = {}; this.style = {}; this.anims = 0; this.parent = null; }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  querySelector(sel) { return sel.includes(".fx-layer") ? this.children.find(c => c.cls === "fx-layer") || null : null; }
  closest(sel) { let n = this; while (n) { if (sel === ".bench" && n.cls === "bench") return n; n = n.parent; } return null; }
  animate() { this.anims++; return { finished: new Promise(() => {}) }; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

async function load({ dom = true, reduced = false, calm = false, auto = null, turbo = false } = {}) {
  let now = 1000;
  const g = {
    performance: { now: () => now },
    window: { __remake: { craftTest: { auto }, vnTest: { turbo } } },
  };
  if (dom) Object.assign(g, {
    matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ position: "relative" }),
    document: { body: { classList: { contains: c => calm && c === "reduce-shake" } } },
  });
  const context = vm.createContext(g);
  const util = { el: (spec) => new Node(spec.split(".")[1] || ""), rand: (a, b) => (a + b) / 2 };
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(spec => {
    assert.equal(spec, "../core/util.js", `Unexpected import ${spec}`);
    return new vm.SyntheticModule(Object.keys(util), function () { for (const [k, v] of Object.entries(util)) this.setExport(k, v); }, { context });
  });
  await mod.evaluate();
  const bench = new Node("bench"), host = new Node("plane"), zoom = new Node("disc");
  bench.append(host, zoom);
  return { fx: mod.namespace, bench, host, zoom, tick: ms => { now += ms; } };
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

console.log("[craft-fx] PASS: full/calm/still/off modes, visual-only hit stop marker, extend-not-shorten, good/miss tiers");
