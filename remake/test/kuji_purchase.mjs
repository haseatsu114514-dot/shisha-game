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
const [kuji, core, util, stats, data, travelBudget, galleryProgress, kujiTickets, equipment, kujiReveal] = await Promise.all([
  read("../js/daily/kuji.js"), read("../js/core/state.js"), read("../js/core/util.js"),
  read("../js/core/stats.js"), read("../../data/kuji.json"), read("../js/core/travel-budget.js"),
  read("../js/core/gallery-progress.js"), read("../js/daily/kuji-tickets.js"), read("../../data/equipment.json"),
  read("../js/daily/kuji-reveal.js"), // 結果の札（賞・景品名・重複の表示）。ガラガラと粒子は高速送りでは読み込まない
]);
// くじ限定の台（KJ05）だけ実データを渡す（重複でくじ券に替わるかの判定に使う）
const kujiOnly = Object.fromEntries(JSON.parse(equipment).equipment.filter(e => e.kuji_only).map(e => [e.id, e]));
const html = `<!doctype html><meta charset="utf-8"><div id="screen"></div><div id="modal"></div><script>
${strip(util)}
${strip(travelBudget)}
let moneyEvents = 0, saves = 0, flavorGrants = 0, renders = 0, reentry = null;
const MAX_MONEY = 999999999, TOURNAMENT_DAY = 14, KUJI_TICKET_MAX = 99;
const emit = event => {
  if (event === 'money') { moneyEvents++; const callback=reentry; reentry=null; callback?.(); }
};
const setPortraitStyleSource = () => {}; // state.js registers a config reader at module level; unrelated to kuji.
${strip(galleryProgress)}
${strip(core).replace('function save()', 'function persistState()')}
function save() { saves++; persistState(); }
${strip(stats.match(/export function addMoney\(n\) \{[\s\S]*?\n\}/)[0])}
const DB = {kuji:${data}, equipById:${JSON.stringify(kujiOnly)}}, displayName = () => 'リン';
const layers = {screen:document.querySelector('#screen'), modal:document.querySelector('#modal')};
const toast = () => {}, SE = new Proxy({}, {get: () => () => {}}), prizeArt = () => null; // 音と景品の絵はこの検査の対象外
const vnTest = {turbo:true}, FLAVOR_BOX_GRAMS = 50, RIO_AWAY_DAY = 3;
function addFlavorStock(id, grams) {
  flavorGrants++;
  state.flavorStock[id] = (state.flavorStock[id] || 0) + grams;
  if (!state.flavors.includes(id)) state.flavors.push(id);
}
${strip(kujiTickets)}
${strip(kujiReveal)}
${strip(kuji)}
let root, old, oldTicket, shop = 'home';
// くじは店ごとに1種類（KJ11）。調べる等級を置いている店を開く。
function paint() { renders++; root.replaceChildren(...kujiRows(paint, shop)); }
function prepare(options = {}) {
  layers.modal.replaceChildren(); layers.modal.classList.remove('show');
  const want = DB.kuji.grades[options.grade || 'g1000'];
  shop = want.shop;
  newGame(); Object.assign(state, {phase:'daily', chapter:options.chapter || Math.max(2, want.chapterMin), day:9});
  state.owned.push('home_rig_set'); // A valid chapter-2 save already has its home rig.
  state.flags._kuji_seen = true;
  root = el('section.shop'); layers.screen.replaceChildren(root); paint();
  // Deterministic valid box order, preserving the production prize counts/snapshots.
  for (const box of Object.values(state.kuji)) {
    box.order = box.prizes.flatMap((p,i) => Array(p.count).fill(i));
  }
  const grade = options.grade || 'g1000';
  if (options.legacy) state.kuji[grade] = {
    order:DB.kuji.legacyGrades[grade].prizes.flatMap((p,i)=>Array(p.count).fill(i)), drawn:0, emptyDay:null,
  };
  const box = state.kuji[grade];
  if (options.last) box.drawn = box.order.length - 1;
  if (options.remaining) box.drawn = box.order.length - options.remaining;
  if (options.empty) { box.drawn = box.order.length; box.emptyDay = state.day; }
  if (options.money != null) state.money = options.money;
  if (options.tickets != null) state.kujiTickets = options.tickets;
  if (options.owned) state.owned.push(...options.owned);
  paint(); saves = moneyEvents = flavorGrants = renders = 0;
  old = root.querySelector('[data-test="kuji-' + grade + '"]');
  oldTicket = root.querySelector('[data-test="kuji-' + grade + '-ticket"]');
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
  reenter:()=>{reentry=()=>force(old);},
  rows:()=>[...root.querySelectorAll('.kuji-row')].map(row=>row.dataset.test),
  detach:()=>root.remove(), retire:()=>root.classList.add('done'),
  changeDay:()=>{state.day++;}, changeBox:()=>{state.kuji.g1000=structuredClone(state.kuji.g1000);},
  changeOrder:()=>{state.kuji.g1000.order=state.kuji.g1000.order.slice();},
  changeDrawn:()=>{state.kuji.g1000.drawn++;},
  saveLoad:()=>{persistState(); load(); return snapshot();},
  load:()=>{load(); return snapshot();},
  abandon:()=>{layers.modal.replaceChildren(); layers.modal.classList.remove('show');},
  refill:()=>{state.day+=3;paint();return snapshot();},
  ticket:()=>root.querySelector('[data-test="kuji-g20000-ticket"]'),
  ticketText:()=>root.querySelector('[data-test="kuji-g20000-ticket"]')?.textContent,
  ticketDisabled:()=>root.querySelector('[data-test="kuji-g20000-ticket"]')?.disabled,
  ticketClick:()=>oldTicket.click(), ticketForceOld:()=>force(oldTicket),
  ticketBurst:()=>{for(let i=0;i<5;i++) force(oldTicket);},
  revealText:()=>layers.modal.textContent,
  // 値下げ前（KJ17 より前）に作った箱: 値下げ前の景品20枚を持ち、price を持たない。drawn 枚だけ引いた状態にして描き直す
  oldBox:(grade, drawn)=>{
    const prizes=[{rank:'S',name:'ステンレス削り出しの台',equipId:'stand_stainless',type:'stand',sell:15000,count:1},
      {rank:'C',name:'ドバジ ミルク（25g）',type:'flavor',flavorId:'milk',grams:25,sell:0,count:19}];
    state.kuji[grade]={order:prizes.flatMap((p,i)=>Array(p.count).fill(i)).reverse(),drawn,emptyDay:null,version:2,prizes,lastOne:null};
    paint(); old=root.querySelector('[data-test="kuji-'+grade+'"]');
    return {text:root.querySelector('.kuji-row').textContent, button:old.textContent, box:JSON.parse(JSON.stringify(state.kuji[grade]))};
  },
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
  // 本店（シーシャくじ）と柚ヶ谷店（機材くじ）。店に並ぶくじは1種類だけ（KJ11）。
  for (const [grade, top] of [["g1000","home_rig_pro"],["g3000","stand_stainless"]]) {
    const before = await run(`K.prepare({grade:'${grade}'})`);
    assert.deepEqual(await run("K.rows()"), [`kuji-row-${grade}`], `${grade}: その店のくじは1種類`);
    await run("K.reenter(); K.click(); K.burst();");
    const bought = await run("K.snapshot()");
    assert.equal(bought.state.money, before.state.money - JSON.parse(data).grades[grade].price, `${grade}: one debit`);
    assert.equal(bought.state.kuji[grade].drawn,1,`${grade}: one ticket`);
    assert.equal(bought.saves,1); assert.equal(bought.moneyEvents,1); assert.equal(bought.overlays,1);
    assert.equal(bought.state.owned.filter(id=>id===top).length,1,`${grade}: S賞の台が持ち物に1つ`);
    assert.deepEqual(bought.state.kuji[grade].order,before.state.kuji[grade].order);
    await run("K.finish()");
    const finished = await run("K.snapshot()");
    assert.equal(finished.renders,1,"one completion render");
    await run("K.forceOld(); K.forceOld()");
    assert.deepEqual(await run("K.snapshot()"), finished,"old rendered button cannot buy again");
    assert.deepEqual((await run("K.load()")).state,bought.state,"normal purchase survives real SAVE/LOAD");
    console.log(`PASS ${grade}: rapid input / re-entry / old button`);
  }
  await run("K.prepare()");
  // Real native Enter activation + browser autorepeat, rather than JS key dispatch.
  for (let i=0;i<6;i++) await rpc("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",
    windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,autoRepeat:i>0,text:"\r"},sessionId);
  await rpc("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13},sessionId);
  assert.equal((await run("K.snapshot()")).state.kuji.g1000.drawn,1,"Enter repeat buys once");
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
  assert.equal(last.state.kuji.g1000.drawn,last.state.kuji.g1000.order.length);
  assert.equal(last.state.kuji.g1000.emptyDay,last.state.day);
  assert.equal(last.state.owned.filter(id=>id==='nightside_premier_hagal').length,1);
  assert.equal(last.flavorGrants,1); assert.equal(last.saves,1);
  await run("K.finish()");
  const loaded = await run("K.load()");
  assert.deepEqual(loaded.state,last.state,"real SAVE/LOAD preserves charged ticket and both prizes");
  await run("K.forceOld()");
  assert.deepEqual((await run("K.snapshot()")).state,last.state);
  const refilled = await run("K.refill()");
  assert.equal(refilled.state.kuji.g1000.drawn,0); assert.equal(refilled.state.kuji.g1000.emptyDay,null);
  assert.equal(refilled.state.kuji.g1000.price,500,"新しい箱は今の1回の値段を持つ");
  console.log("PASS last ticket / last-one / real save-load / refill");
  for (const opts of [{money:499},{empty:true}]) { // 1回500円に1円足りない／売り切れ
    const before = await run(`K.prepare(${JSON.stringify(opts)})`);
    await run("K.forceOld()");
    assert.deepEqual(await run("K.snapshot()"),before,"empty/poor: no purchase, save or reveal");
  }
  await run("K.prepare(); K.click()");
  const saved = await run("K.snapshot()");
  await run("K.load(); K.repaint(); K.forceOld()");
  assert.deepEqual((await run("K.snapshot()")).state,saved.state,"load during reveal cannot buy through old button");
  // Replacing the abandoned reveal must not leave a permanent purchase lock.
  await run("K.abandon(); document.querySelector('[data-test=kuji-g1000]').click()");
  assert.equal((await run("K.snapshot()")).state.kuji.g1000.drawn,2);
  await run("K.finish()");
  console.log("PASS insufficient money / empty / load during reveal / new-session purchase");
  for (const grade of ['g1000']) {
    const before = await run(`K.prepare({grade:'${grade}',legacy:true})`);
    await run("K.click(); K.burst()");
    const after = await run("K.snapshot()");
    // 古い箱（景品の控えを持たない12枚の箱）は、中身も1回の値段も当時のまま（値下げ前の1,000円・KJ17）
    assert.equal(after.state.money,before.state.money-JSON.parse(data).grades[grade].priceWas);
    assert.equal(after.state.kuji[grade].price,1000);
    assert.equal(after.state.kuji[grade].drawn,1);
    assert.deepEqual(after.state.kuji[grade].order,before.state.kuji[grade].order);
    assert.equal(after.saves,1);
    await run("K.finish()");
    assert.deepEqual((await run("K.load()")).state,after.state,'legacy box survives real load');
  }
  console.log("PASS legacy 12-ticket order and save-load");
  // KJ17: 値下げ前に作った柚ヶ谷店の箱（20枚・1回3,000円）。まだ引いていなければ、今の箱（60枚・1回1,000円）に入れ替える。
  {
    await run("K.prepare({grade:'g3000'})");
    const fresh = await run("K.oldBox('g3000', 0)");
    assert.equal(fresh.box.order.length, 60, "未開封の旧箱は今の箱に入れ替わる");
    assert.equal(fresh.box.price, 1000); assert.equal(fresh.box.drawn, 0);
    assert.match(fresh.text, /機材くじ（1回1,000円）[\s\S]*のこり 60 \/ 60 枚/);
    assert.doesNotMatch(fresh.text, /旧箱/);
    // 引き途中の旧箱は、当時の景品と当時の値段（1回3,000円）のまま引き切る。安くなった値段で前の中身は引けない。
    const before = await run("K.prepare({grade:'g3000',money:10000})");
    const kept = await run("K.oldBox('g3000', 3)");
    assert.equal(kept.box.order.length, 20, "引き途中の旧箱はそのまま");
    assert.equal(kept.box.price, 3000, "1回の値段は値下げ前のもの");
    assert.match(kept.text, /機材くじ（1回3,000円）[\s\S]*のこり 17 \/ 20 枚[\s\S]*（旧箱・次回は60枚で1回1,000円）/);
    assert.equal(kept.button, "×1 ¥3,000");
    await run("K.click()");
    const drawn = await run("K.snapshot()");
    assert.equal(drawn.state.money, before.state.money - 3000, "旧箱は1回3,000円を払う");
    assert.equal(drawn.state.kuji.g3000.drawn, 4);
    await run("K.finish()");
    assert.deepEqual((await run("K.load()")).state.kuji.g3000, drawn.state.kuji.g3000, "旧箱の値段は保存される");
    console.log("PASS pre-price-cut box: untouched → new box, in progress → old contents at the old price");
  }
  for (const count of [5, 10]) {
    const before = await run("K.prepare({grade:'g1000'})");
    await run(`K.batch('g1000', ${count}); K.batch('g1000', ${count});`);
    const bought = await run("K.snapshot()");
    assert.equal(bought.state.kuji.g1000.drawn, count);
    assert.equal(bought.state.money, before.state.money - 500 * count);
    assert.equal(bought.saves, count, "every ticket saved immediately");
    assert.equal((await run("K.batchResults()")).length, count);
    await run("K.finishBatch()");
    assert.equal((await run("K.snapshot()")).overlays, 0, "batch result closes");
    assert.deepEqual((await run("K.load()")).state, bought.state, "batch survives real save/load");
  }
  const beforeLastBatch = await run("K.prepare({grade:'g1000',remaining:3})");
  await run("K.batch('g1000', 5)");
  const lastBatch = await run("K.snapshot()");
  assert.equal(lastBatch.state.kuji.g1000.drawn, beforeLastBatch.state.kuji.g1000.drawn + 3);
  assert.equal(lastBatch.state.money, beforeLastBatch.state.money - 1500);
  assert.equal(lastBatch.state.owned.filter(id=>id==='nightside_premier_hagal').length, 1);
  assert.equal(lastBatch.saves, 3);
  assert.equal((await run("K.batchResults()")).length, 4, "last-one appears beside three tickets");
  console.log("PASS 5/10 batch charge, immediate saves, last-one result and load");
  // KJ05: 限定台くじは第5章だけ。くじ券1枚で1回（お金は使わない）、連打・古いボタンでも1枚だけ。0枚では押せない。
  {
    await run("K.prepare({grade:'g1000',chapter:4})");
    assert.equal(await run("K.ticket()"), null, "第4章には限定台くじもくじ券の行も無い");
    assert.deepEqual(await run("K.rows()"), ["kuji-row-g1000"], "第4章までの本店はシーシャくじ");
    const before = await run("K.prepare({grade:'g20000',chapter:5,tickets:1})");
    assert.deepEqual(await run("K.rows()"), ["kuji-row-g20000"], "第5章の本店は限定台くじに入れ替わる（KJ11）");
    assert.equal(await run("K.ticketText()"), "くじ券で引く（残り1枚）");
    assert.equal(await run("K.ticketDisabled()"), false);
    await run("K.ticketClick(); K.ticketBurst(); K.click();");
    const used = await run("K.snapshot()");
    assert.equal(used.state.kujiTickets, 0, "くじ券を1枚使った");
    assert.equal(used.state.money, before.state.money, "お金は使わない");
    assert.equal(used.state.kuji.g20000.drawn, 1, "1回だけ引いた");
    assert(used.state.owned.includes("stand_custom_melty"), "S賞の限定の台が持ち物に入る");
    assert.equal(used.saves, 1); assert.equal(used.moneyEvents, 0); assert.equal(used.overlays, 1);
    await run("K.finish()");
    const done = await run("K.snapshot()");
    assert.equal(await run("K.ticketText()"), "くじ券で引く（残り0枚）");
    assert.equal(await run("K.ticketDisabled()"), true, "0枚では押せない");
    await run("K.ticketForceOld(); K.ticketForceOld()");
    assert.deepEqual(await run("K.snapshot()"), done, "古いくじ券のボタンでは引けない");
    assert.deepEqual((await run("K.load()")).state, used.state, "くじ券で引いた結果は SAVE/LOAD で残る");
  }
  {
    // 持っている限定の台が当たったら、お金ではなくくじ券1枚。そのくじ券で次の1回を引ける。
    const before = await run("K.prepare({grade:'g20000',chapter:5,owned:['stand_custom_melty'],money:100000})");
    await run("K.click(); K.burst()");
    const dupe = await run("K.snapshot()");
    assert.equal(dupe.state.money, before.state.money - 10000, "1回10,000円だけ払い、買い取りのお金は無い");
    assert.equal(dupe.state.kujiTickets, 1);
    assert.equal(dupe.state.owned.filter(id => id === "stand_custom_melty").length, 1);
    assert.match(await run("(async()=>{await sleep(500);return K.revealText();})()"), /持っているので、くじ券を1枚受け取った/, "結果のカードにくじ券と出す");
    await run("K.finish()");
    assert.equal(await run("K.ticketText()"), "くじ券で引く（残り1枚）");
    await run("K.ticket().click()");
    const second = await run("K.snapshot()");
    assert.equal(second.state.kujiTickets, 0);
    assert.equal(second.state.money, dupe.state.money);
    assert.equal(second.state.kuji.g20000.drawn, 2);
    assert(second.state.owned.includes("stand_custom_tosu"));
    await run("K.finish()");
    assert.deepEqual((await run("K.load()")).state, second.state, "くじ券と箱の状態は SAVE/LOAD で残る");
  }
  console.log("PASS ch5 limited tier: ticket draw once / no money / disabled at 0 / dupe → ticket / save-load");
  console.log("PASS kuji purchase guard (isolated real DOM; turbo reveal; actual state save/load)");
} finally {
  clearTimeout(watchdog); child.kill(); await exited;
  await new Promise(resolve => server.close(resolve));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
