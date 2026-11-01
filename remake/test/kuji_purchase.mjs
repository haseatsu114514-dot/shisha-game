// Isolated native-button regression: actual kuji + save/load, no game/assets/dependencies.
// CHROME_EXECUTABLE_PATH=/path/to/chrome node remake/test/kuji_purchase.mjs
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const read = file => readFile(new URL(file, import.meta.url), "utf8");
const strip = source => source.replace(/^import .*;\s*$/gm, "").replace(/\bexport /g, "");
const [kuji, core, util, stats, data, travelBudget, galleryProgress] = await Promise.all([
  read("../js/daily/kuji.js"), read("../js/core/state.js"), read("../js/core/util.js"),
  read("../js/core/stats.js"), read("../../data/kuji.json"), read("../js/core/travel-budget.js"),
  read("../js/core/gallery-progress.js"),
]);
const html = `<!doctype html><meta charset="utf-8"><div id="screen"></div><div id="modal"></div><script>
${strip(util)}
${strip(travelBudget)}
let moneyEvents = 0, saves = 0, flavorGrants = 0, renders = 0, reentry = null;
const MAX_MONEY = 999999999, TOURNAMENT_DAY = 14;
const emit = event => {
  if (event === 'money') { moneyEvents++; const callback=reentry; reentry=null; callback?.(); }
};
${strip(galleryProgress)}
${strip(core).replace('function save()', 'function persistState()')}
function save() { saves++; persistState(); }
${strip(stats.match(/export function addMoney\(n\) \{[\s\S]*?\n\}/)[0])}
const DB = {kuji:${data}}, displayName = () => 'リン';
const layers = {screen:document.querySelector('#screen'), modal:document.querySelector('#modal')};
const toast = () => {}, SE = {select(){},click(){},stamp(){},fanfare(){}};
const vnTest = {turbo:true}, FLAVOR_BOX_GRAMS = 50, RIN_AWAY_DAY = 3;
function addFlavorStock(id, grams) {
  flavorGrants++;
  state.flavorStock[id] = (state.flavorStock[id] || 0) + grams;
  if (!state.flavors.includes(id)) state.flavors.push(id);
}
${strip(kuji)}
let root, old;
function paint() { renders++; root.replaceChildren(...kujiRows(paint)); }
function prepare(options = {}) {
  layers.modal.replaceChildren(); layers.modal.classList.remove('show');
  newGame(); Object.assign(state, {phase:'daily', chapter:2, day:9});
  state.owned.push('home_rig_set'); // A valid chapter-2 save already has its home rig.
  state.flags._kuji_seen = true;
  root = el('section.shop'); layers.screen.replaceChildren(root); paint();
  // Deterministic valid box order, preserving the production prize counts/snapshots.
  for (const box of Object.values(state.kuji)) {
    box.order = box.prizes.flatMap((p,i) => Array(p.count).fill(i));
  }
  const grade = options.grade || 'g500';
  if (options.legacy) state.kuji[grade] = {
    order:DB.kuji.legacyGrades[grade].prizes.flatMap((p,i)=>Array(p.count).fill(i)), drawn:0, emptyDay:null,
  };
  const box = state.kuji[grade];
  if (options.last) box.drawn = box.order.length - 1;
  if (options.remaining) box.drawn = box.order.length - options.remaining;
  if (options.empty) { box.drawn = box.order.length; box.emptyDay = state.day; }
  if (options.money != null) state.money = options.money;
  paint(); saves = moneyEvents = flavorGrants = renders = 0;
  old = root.querySelector('[data-test="kuji-' + (options.grade || 'g500') + '"]');
  old.focus();
  return snapshot();
}
function snapshot() {
  return JSON.parse(JSON.stringify({state, saves, moneyEvents, flavorGrants, renders,
    overlays:layers.modal.children.length}));
}
const force = button => button.dispatchEvent(new MouseEvent('click', {bubbles:true}));
async function finish() {
  // Existing turbo result card waits 300ms; leave all reveal code/timing untouched.
  await sleep(850);
  layers.modal.firstElementChild?.click();
  await sleep(0);
}
window.K = {prepare, snapshot, finish, forceOld:()=>force(old),
  click:()=>old.click(), repaint:paint,
  batch:(grade, count)=>root.querySelector('[data-test="kuji-' + grade + '-' + count + '"]')?.click(),
  batchResults:()=>[...layers.modal.querySelectorAll('.kuji-short')].map(card=>card.textContent),
  finishBatch:()=>layers.modal.querySelector('.kuji-multi-panel button')?.click(),
  burst:()=>{for(let i=0;i<5;i++) force(old);},
  reenter:()=>{reentry=()=>force(root.querySelector('[data-test="kuji-g1000"]'));},
  crossGrade:()=>force(root.querySelector('[data-test="kuji-g1000"]')),
  detach:()=>root.remove(), retire:()=>root.classList.add('done'),
  changeDay:()=>{state.day++;}, changeBox:()=>{state.kuji.g500=structuredClone(state.kuji.g500);},
  changeOrder:()=>{state.kuji.g500.order=state.kuji.g500.order.slice();},
  changeDrawn:()=>{state.kuji.g500.drawn++;},
  saveLoad:()=>{persistState(); load(); return snapshot();},
  load:()=>{load(); return snapshot();},
  abandon:()=>{layers.modal.replaceChildren(); layers.modal.classList.remove('show');},
  refill:()=>{state.day+=3;paint();return snapshot();},
};
</script>`;

const server = createServer((_, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const profile = await mkdtemp(path.join(tmpdir(), "kuji817-"));
const chrome = process.env.CHROME_EXECUTABLE_PATH || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "chromium");
const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-background-networking", "--disable-component-update",
  "--disable-sync", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`,
  "--remote-debugging-pipe", "about:blank"], {stdio:["ignore","ignore","pipe","pipe","pipe"]});
let seq = 0, buffer = "";
const pending = new Map();
child.stderr.on("data", () => {});
const exited = new Promise(resolve => child.once("exit", resolve));
child.on("error", error => { for (const p of pending.values()) p.reject(error); pending.clear(); });
child.on("exit", () => { for (const p of pending.values()) p.reject(new Error("Chrome exited")); pending.clear(); });
child.stdio[4].on("data", data => {
  buffer += data;
  for (let end; (end = buffer.indexOf("\0")) >= 0;) {
    const raw = buffer.slice(0,end); buffer = buffer.slice(end+1); if (!raw) continue;
    const msg = JSON.parse(raw), p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
  }
});
function rpc(method, params = {}, sessionId) {
  return new Promise((resolve,reject) => {
    const id = ++seq; pending.set(id,{resolve,reject});
    child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId ? {sessionId} : {})}) + "\0");
  });
}
const watchdog = setTimeout(() => child.kill(), 30000);
try {
  const {targetId} = await rpc("Target.createTarget", {url:"about:blank"});
  const {sessionId} = await rpc("Target.attachToTarget", {targetId,flatten:true});
  await rpc("Page.enable",{},sessionId);
  await rpc("Page.navigate",{url:`http://127.0.0.1:${server.address().port}`},sessionId);
  async function run(expression) {
    const r = await rpc("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},sessionId);
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  await run(`(async()=>{while(!window.K)await new Promise(r=>setTimeout(r,10));})()`);
  for (const grade of ["g500","g1000"]) {
    const before = await run(`K.prepare({grade:'${grade}'})`);
    await run("K.reenter(); K.click(); K.burst(); K.crossGrade();");
    const bought = await run("K.snapshot()");
    assert.equal(bought.state.money, before.state.money - JSON.parse(data).grades[grade].price, `${grade}: one debit`);
    assert.equal(bought.state.kuji[grade].drawn,1,`${grade}: one ticket`);
    assert.equal(bought.saves,1); assert.equal(bought.moneyEvents,1); assert.equal(bought.overlays,1);
    if (grade === 'g500') {
      assert.deepEqual(bought.state.goods,[{name:JSON.parse(data).grades.g500.prizes[0].name,sell:6000}]);
    } else assert.equal(bought.state.owned.filter(id=>id==='home_rig_pro').length,1);
    assert.deepEqual(bought.state.kuji[grade].order,before.state.kuji[grade].order);
    await run("K.finish()");
    const finished = await run("K.snapshot()");
    assert.equal(finished.renders,1,"one completion render");
    await run("K.forceOld(); K.forceOld()");
    assert.deepEqual(await run("K.snapshot()"), finished,"old rendered button cannot buy again");
    assert.deepEqual((await run("K.load()")).state,bought.state,"normal purchase survives real SAVE/LOAD");
    console.log(`PASS ${grade}: rapid input / cross-grade / old button`);
  }
  await run("K.prepare()");
  // Real native Enter activation + browser autorepeat, rather than JS key dispatch.
  for (let i=0;i<6;i++) await rpc("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",
    windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,autoRepeat:i>0,text:"\r"},sessionId);
  await rpc("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13},sessionId);
  assert.equal((await run("K.snapshot()")).state.kuji.g500.drawn,1,"Enter repeat buys once");
  await run("K.finish()");
  console.log("PASS native Enter / autorepeat");
  for (const action of ["detach","retire","repaint","changeDay","changeBox","changeOrder","changeDrawn","saveLoad"]) {
    await run(`K.prepare(); K.${action}()`);
    const before = await run("K.snapshot()");
    await run("K.forceOld()");
    assert.deepEqual(await run("K.snapshot()"),before,`${action}: stale purchase rejected`);
  }
  console.log("PASS detached / retired / repainted / changed day, box, drawn, save");
  const beforeLast = await run("K.prepare({last:true})");
  await run("K.click(); K.burst()");
  const last = await run("K.snapshot()");
  assert.equal(last.state.money,beforeLast.state.money-500);
  assert.equal(last.state.kuji.g500.drawn,last.state.kuji.g500.order.length);
  assert.equal(last.state.kuji.g500.emptyDay,last.state.day);
  assert.equal(last.state.owned.filter(id=>id==='nightside_premier_hagal').length,1);
  assert.equal(last.flavorGrants,1); assert.equal(last.saves,1);
  await run("K.finish()");
  const loaded = await run("K.load()");
  assert.deepEqual(loaded.state,last.state,"real SAVE/LOAD preserves charged ticket and both prizes");
  await run("K.forceOld()");
  assert.deepEqual((await run("K.snapshot()")).state,last.state);
  const refilled = await run("K.refill()");
  assert.equal(refilled.state.kuji.g500.drawn,0); assert.equal(refilled.state.kuji.g500.emptyDay,null);
  console.log("PASS last ticket / last-one / real save-load / refill");
  for (const opts of [{money:499},{empty:true}]) {
    const before = await run(`K.prepare(${JSON.stringify(opts)})`);
    await run("K.forceOld()");
    assert.deepEqual(await run("K.snapshot()"),before,"empty/poor: no purchase, save or reveal");
  }
  await run("K.prepare(); K.click()");
  const saved = await run("K.snapshot()");
  await run("K.load(); K.repaint(); K.forceOld()");
  assert.deepEqual((await run("K.snapshot()")).state,saved.state,"load during reveal cannot buy through old button");
  // Replacing the abandoned reveal must not leave a permanent purchase lock.
  await run("K.abandon(); document.querySelector('[data-test=kuji-g500]').click()");
  assert.equal((await run("K.snapshot()")).state.kuji.g500.drawn,2);
  await run("K.finish()");
  console.log("PASS insufficient money / empty / load during reveal / new-session purchase");
  for (const grade of ['g500','g1000']) {
    const before = await run(`K.prepare({grade:'${grade}',legacy:true})`);
    await run("K.click(); K.burst()");
    const after = await run("K.snapshot()");
    assert.equal(after.state.money,before.state.money-JSON.parse(data).grades[grade].price);
    assert.equal(after.state.kuji[grade].drawn,1);
    assert.deepEqual(after.state.kuji[grade].order,before.state.kuji[grade].order);
    assert.equal(after.saves,1);
    await run("K.finish()");
    assert.deepEqual((await run("K.load()")).state,after.state,'legacy box survives real load');
  }
  console.log("PASS legacy 20/12-ticket order and save-load");
  for (const count of [5, 10]) {
    const before = await run("K.prepare({grade:'g500'})");
    await run(`K.batch('g500', ${count}); K.batch('g500', ${count});`);
    const bought = await run("K.snapshot()");
    assert.equal(bought.state.kuji.g500.drawn, count);
    assert.equal(bought.state.money, before.state.money - 500 * count);
    assert.equal(bought.saves, count, "every ticket saved immediately");
    assert.equal((await run("K.batchResults()")).length, count);
    await run("K.finishBatch()");
    assert.equal((await run("K.snapshot()")).overlays, 0, "batch result closes");
    assert.deepEqual((await run("K.load()")).state, bought.state, "batch survives real save/load");
  }
  const beforeLastBatch = await run("K.prepare({grade:'g500',remaining:3})");
  await run("K.batch('g500', 5)");
  const lastBatch = await run("K.snapshot()");
  assert.equal(lastBatch.state.kuji.g500.drawn, beforeLastBatch.state.kuji.g500.drawn + 3);
  assert.equal(lastBatch.state.money, beforeLastBatch.state.money - 1500);
  assert.equal(lastBatch.state.owned.filter(id=>id==='nightside_premier_hagal').length, 1);
  assert.equal(lastBatch.saves, 3);
  assert.equal((await run("K.batchResults()")).length, 4, "last-one appears beside three tickets");
  console.log("PASS 5/10 batch charge, immediate saves, last-one result and load");
  console.log("PASS kuji purchase guard (isolated real DOM; turbo reveal; actual state save/load)");
} finally {
  clearTimeout(watchdog); child.kill(); await exited;
  await new Promise(resolve => server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
