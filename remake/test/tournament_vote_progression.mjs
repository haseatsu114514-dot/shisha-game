// Actual result module; unrelated rendering ports must not be called in this pure vote regression.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=process.env.A1044_SOURCE_ROOT?pathToFileURL(path.resolve(process.env.A1044_SOURCE_ROOT)+'/'):new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('remake/js/craft/result.js',root),'utf8');
const context=vm.createContext({});
const module=new vm.SourceTextModule(source,{context});
await module.link(spec=>{
  const match=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].find(m=>m[2]===spec);assert(match,spec);
  const names=match[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0]);
  return new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n==='state'?{}:n==='NAGUMO_BAR'?75:()=>{throw Error('Unexpected rendering port '+n);});},{context});
});await module.evaluate();
const {pointTable,interimPointTable}=module.namespace;
// Baseline's actual in-function literal is evaluated only to demonstrate its withdrawn vote.
function interim(round){
  if(interimPointTable)return interimPointTable(round);
  const literal=source.slice(source.indexOf('  const table = round === 1',source.indexOf('export async function showStandings')),source.indexOf('\n  const values =',source.indexOf('export async function showStandings')));
  return vm.runInNewContext('(function(round){'+literal+';return table;})')(round);
}
const clone=v=>JSON.parse(JSON.stringify(v));
// #1282（オーナー決定 2026-10-28）: 第1章の逆転優勝を廃止。はじめは上園・博士からも点が入り票前から首位で競り、
// 南雲の10点は最後の一票。凍結値はこの形に合わせて更新した（南雲の10点配分自体は不変）。
const frozenFinal={
  1:{maezono:{hajime:4,naru:2,adam:2,minto:2},dr_kemuri:{hajime:3,adam:3,naru:3,minto:1},nagumo:{hajime:10}},
  3:{maezono:{naru:4,adam:3,hajime:2,minto:1},dr_kemuri:{adam:5,minto:2,hajime:2,naru:1},nagumo:{naru:10}},
  4:{maezono:{naru:4,adam:3,minto:1,hajime:2},dr_kemuri:{adam:5,minto:3,naru:1,hajime:1},nagumo:{naru:10}}
};
for(const rank of [1,3,4]){
  assert.deepEqual(clone(pointTable(rank)),frozenFinal[rank],'Final votes match the frozen table (updated for #1282 no-reversal); Nagumo ten points unchanged');
  let previous={};
  for(const current of [interim(1),interim(2),interim(3),pointTable(rank)]){
    for(const judge of ['maezono','dr_kemuri','nagumo']){
      assert(Object.values(current[judge]).reduce((a,b)=>a+b,0)<=10);
      for(const id of ['naru','adam','minto','hajime'])assert((current[judge][id]||0)>=(previous[judge]?.[id]||0),`${judge}/${id}: allocated votes cannot return (rank ${rank})`);
    }previous=current;
  }
}
for(const round of [1,2,3])assert.equal(Object.values(interim(round).nagumo).reduce((a,b)=>a+b,0),0);
if(interimPointTable){assert.match(source,/const table = interimPointTable\(round\)/);assert.doesNotMatch(source,/チャコール博士が最後の持ち点を投入/);}
console.log(JSON.stringify({groups:3,ranks:[1,3,4],scope:'actual vote module with controlled unused render ports; no browser',result:'interim votes monotonic through all unchanged final tables; per-judge <=10; Nagumo held'},null,2));

// #2190 P22: exercise the actual standings/graphics/DOM builder with a controlled
// clock and DOM lifecycle. Browser geometry and native key activation live in
// browser/ch1_tournament.mjs; this adapter does not claim to emulate a browser.
async function standingsHarness(auto = null) {
  let now = 0, timerId = 0, selections = 0;
  const timers = new Map(), observers = new Set(), hud = new Set(), listeners = new Map();
  let doc;
  const later = (fn, ms = 0) => { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id; };
  const unlater = id => timers.delete(id);
  const notifyRemoval = () => queueMicrotask(() => { for (const observer of [...observers]) observer.callback(); });
  class TestNode {
    constructor(tag = "div", text = "") {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.dataset = {};
      this.attributes = {}; this.events = new Map(); this.text = text; this.disabled = false;
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) };
      this.style = { setProperty(name, value) { this[name] = value; } };
    }
    get isConnected() { return this === body || !!this.parentNode?.isConnected; }
    get disabled() { return this._disabled; }
    set disabled(value) { this._disabled = value; if (value && doc?.activeElement === this) doc.activeElement = body; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
    set textContent(value) { this.text = String(value); this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { for (const child of children) { this.children.push(child); child.parentNode = this; } }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null; notifyRemoval();
    }
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, new Set()); this.events.get(type).add(fn); }
    removeEventListener(type, fn) { this.events.get(type)?.delete(fn); }
    click() { if (!this.disabled) for (const fn of [...(this.events.get("click") || [])]) fn({ target: this }); }
    focus() { doc.activeElement = this; }
  }
  const body = new TestNode("body"), fx = new TestNode(), previous = new TestNode("button");
  body.append(fx, previous);
  doc = { body, activeElement: previous, createElement: tag => new TestNode(tag), createTextNode: text => new TestNode("#text", text) };
  const window = {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const ctx = vm.createContext({ document: doc, window, Node: TestNode, MutationObserver: Observer, DOMException,
    setTimeout: later, clearTimeout: unlater });
  let game = { flags: {}, marker: "original" }, statePort;
  const ports = {
    layers: { fx }, SE: { crowd() {}, select() { selections++; } }, NAGUMO_BAR: 75,
    displayName: id => id, faceIconUrl: () => null, portraitInfo: () => null,
    evaluationOf: () => ({ tone: "good", mark: "○" }), craftRecognition: () => ({ summary: "制作の記録" }),
    autoSkill: () => auto,
    on: (type, fn) => { assert.equal(type, "hud"); hud.add(fn); return () => hud.delete(fn); },
  };
  const modules = new Map();
  async function link(spec) {
    if (modules.has(spec)) return modules.get(spec);
    let mod;
    if (spec === "../core/util.js" || spec === "./tournament-graphics.js") {
      const file = spec === "../core/util.js" ? "remake/js/core/util.js" : "remake/js/craft/tournament-graphics.js";
      mod = new vm.SourceTextModule(fs.readFileSync(new URL(file, root), "utf8"), { context: ctx });
    } else {
      const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].find(match => match[2] === spec);
      assert(imports, `Unexpected dependency ${spec}`);
      const names = imports[1].split(",").map(name => name.trim().split(/\s+as\s+/)[0]);
      mod = new vm.SyntheticModule(names, function () {
        for (const name of names) this.setExport(name, name === "state" ? game : ports[name] ?? (() => { throw Error(`Unexpected rendering port ${name}`); }));
      }, { context: ctx });
      if (spec === "../core/state.js") statePort = mod;
    }
    modules.set(spec, mod);
    if (mod instanceof vm.SourceTextModule) await mod.link(link);
    return mod;
  }
  const result = new vm.SourceTextModule(source, { context: ctx });
  await result.link(link); await result.evaluate();
  const nodes = (host, predicate) => [host, ...host.children.flatMap(child => nodes(child, predicate))].filter(predicate);
  const find = test => nodes(fx, node => node.dataset.test === test)[0];
  const classNodes = cls => nodes(fx, node => node.classList.contains(cls));
  async function tick(ms) {
    const target = now + ms;
    for (;;) {
      await Promise.resolve(); await Promise.resolve();
      const due = [...timers].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    now = target; await Promise.resolve(); await Promise.resolve();
  }
  return { result: result.namespace, find, classNodes, tick, doc, previous,
    owner: () => game,
    replaceOwner() { game = { flags: {}, marker: "loaded" }; statePort.setExport("state", game); for (const fn of [...hud]) fn(); },
    pagehide() { for (const fn of [...(listeners.get("pagehide") || [])]) fn(); },
    selections: () => selections,
    assertClean() {
      assert.equal(fx.children.length, 0); assert.equal(timers.size, 0); assert.equal(observers.size, 0); assert.equal(hud.size, 0);
      assert.equal([...listeners.values()].reduce((count, fns) => count + fns.size, 0), 0);
    },
  };
}

for (const round of [1, 2, 3]) {
  const h = await standingsHarness();
  const cs = { mix: { lemon: 10, mint: 2 }, heat: { score: 90 } };
  const before = JSON.stringify([h.owner(), cs]);
  let completed = false;
  const task = h.result.showStandings(round, 60, cs).then(() => { completed = true; });
  await h.tick(60_000);
  assert.equal(completed, false, `ROUND ${round}: reading must not time out`);
  const board = h.find("standings"), next = h.find("standings-next");
  assert(board?.isConnected && board.classList.contains("show"));
  assert(next && !next.disabled && next.style.pointerEvents === "auto");
  assert.equal(h.doc.activeElement, next);
  assert.equal(h.classNodes("sd-feed-lines")[0].children.length, 2);
  const expected = round === 1 ? { naru: 2, adam: 1, minto: 1, hajime: 1 } : { adam: 5, naru: 3, hajime: 3, minto: 2 };
  assert.deepEqual(Object.fromEntries(h.classNodes("sd-row").map(row => [row.dataset.id, Number(row.children.at(-1).textContent.replace("pt", ""))])), expected);
  assert.equal(JSON.stringify([h.owner(), cs]), before, "Reading cannot change game state or craft results");
  board.click(); await h.tick(1000); assert.equal(completed, false, "Only the button advances");
  next.click(); next.click(); assert.equal(h.selections(), 1, "Double activation advances once");
  await h.tick(399); assert.equal(completed, false, "Keep the exit transition");
  await h.tick(1); await task;
  assert.equal(h.doc.activeElement, h.previous); h.assertClean();
  assert.equal(JSON.stringify([h.owner(), cs]), before);
  next.click(); assert.equal(h.selections(), 1, "Detached controls cannot act");
}
for (const reason of ["owner-before-show", "owner-waiting", "board-removed", "dim-removed", "pagehide", "owner-closing"]) {
  const h = await standingsHarness();
  let advanced = false;
  const task = h.result.showStandings(2, 60).then(() => { advanced = true; return null; }, error => error);
  if (reason !== "owner-before-show") await h.tick(40);
  const next = h.find("standings-next");
  if (reason === "owner-closing") next.click();
  if (reason.startsWith("owner-")) h.replaceOwner();
  else if (reason === "pagehide") h.pagehide();
  else if (reason === "board-removed") h.find("standings").remove();
  else h.classNodes("fx-dim")[0].remove();
  await h.tick(60_000);
  assert.equal((await task)?.name, "AbortError", reason);
  assert.equal(advanced, false, `${reason}: old tournament cannot resume`);
  if (reason.startsWith("owner-") && reason !== "owner-before-show") assert.notEqual(h.doc.activeElement, h.previous, "Old owner cannot restore focus after LOAD");
  h.assertClean();
  const clicks = h.selections(); next?.click(); assert.equal(h.selections(), clicks);
}
{
  const h = await standingsHarness();
  const task = h.result.showStandings(1, 60);
  await h.tick(40); h.find("standings-next").click();
  const other = h.doc.createElement("button"); h.doc.body.append(other); other.focus();
  await h.tick(400); await task;
  assert.equal(h.doc.activeElement, other, "Closing standings cannot steal newly moved focus");
  h.assertClean();
}
for (const auto of ["good", "bad"]) {
  const h = await standingsHarness(auto);
  const task = h.result.showStandings(1, 60);
  await h.tick(740); await task;
  assert.equal(h.selections(), 1); h.assertClean();
}
console.log("standings reading gate: R1/R2/R3 hold; one-shot continuation; owner/removal/pagehide cancellation; explicit developer auto; lifecycle cleanup");
