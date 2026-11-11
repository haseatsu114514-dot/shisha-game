// 観音堂の導入完読・LOAD・取消の境界。保存と盤の規則は実物、UIのみ差し替える。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("../js/", import.meta.url), storage = new Map(), modules = new Map();
let core, growth, sceneHook = null, modalHook = null, importHook = null, cardHook = null, choice = "reflect", scenes = [], opened = [], cards = [];
const context = vm.createContext({ console, Math, Map, Set, JSON, Date,
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
});
const mocks = {
  "core/stats.js": { affinityLevel: () => 0, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], maxStamina: () => 100, setExpHooks() {} },
  "core/ui.js": { modal: async () => { modalHook?.(); return choice; }, gainCard: card => { cards.push(card); cardHook?.(); } },
  "vn/engine.js": { play: async id => {
    scenes.push(id);
    return sceneHook ? sceneHook(id) : { id, visited: [id] };
  } },
  "daily/growth-board-screen.js": { openBoard: async ({ place }) => { opened.push(place); return []; } },
};
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const mock = mocks[url.href.slice(root.href.length)];
  const mod = mock ? new vm.SyntheticModule(Object.keys(mock), function () {
    for (const [key,value] of Object.entries(mock)) this.setExport(key,value);
  }, { context }) : new vm.SourceTextModule(fs.readFileSync(url,"utf8"), {
    context, identifier: url.href, importModuleDynamically: async (specifier, parent) => {
      await importHook?.(specifier);
      const child = await load(new URL(specifier,parent.identifier));
      if (child.status === "linked") await child.evaluate();
      return child;
    },
  });
  modules.set(url.href,mod); await mod.link((s) => load(new URL(s,url))); return mod;
}
async function ns(path) { const m = await load(new URL(path,root)); await m.evaluate(); return m.namespace; }
core = await ns("core/state.js"); growth = await ns("core/growth.js");
assert.equal((await ns("core/carry.js")).flagVerdict("_kannon_growth_intro_done"), "carry");
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const s = core.newGame(); Object.assign(s,{ phase:"daily", day:3, slot:0, stamina:80 });
  growth.setGrowthPreview(true); growth.ensureGrowth().hidane.any = 2;
  choice="reflect"; scenes=[]; opened=[]; cards=[]; sceneHook=null; modalHook=null; importHook=null; cardHook=null;
  return s;
}
const resources = s => plain({ day:s.day, slot:s.slot, stamina:s.stamina, stats:s.stats, reel:s.reel, growth:s.growth });
let s = setup(), before = resources(s);
assert.equal(await growth.reflectAtSpot("kannon"),true);
assert.deepEqual(scenes,["kannon_growth_intro","reflect_kannon"]);
assert.deepEqual(opened,["kannon"]);
assert.equal(s.flags._kannon_growth_intro_done,true);
assert.deepEqual(resources(s),before,"導入だけでは時間・体力・経験値・火種・旧能力・スロットを変えない");
core.load(); scenes=[]; opened=[];
await growth.reflectAtSpot("kannon");
assert.deepEqual(scenes,["reflect_kannon"],"保存後の再訪は導入を繰り返さない");
for (const result of [undefined, { id:"kannon_growth_intro",visited:[],cancelled:true }, { id:"other",visited:["other"] }]) {
  s=setup(); sceneHook=() => result;
  await growth.reflectAtSpot("kannon");
  assert.equal(s.flags._kannon_growth_intro_done,undefined);
  assert.deepEqual(opened,[],"欠落・中断・別台本の結果では盤へ進まない");
}
for (const where of ["modal","intro"]) {
  s=setup(); core.save();
  if (where === "modal") modalHook=() => core.load();
  else sceneHook=id => { core.load(); return { id,visited:[id] }; };
  await growth.reflectAtSpot("kannon");
  assert.notEqual(core.state,s);
  assert.equal(core.state.flags._kannon_growth_intro_done,undefined);
  assert.deepEqual(opened,[],"LOAD後の古い継続処理は盤を開かない");
}
for (const selected of ["visit",null]) {
  s=setup(); choice=selected;
  assert.equal(await growth.reflectAtSpot("kannon"),selected !== "visit");
  assert.deepEqual(scenes,[]); assert.deepEqual(opened,[]);
  assert.equal(s.flags._kannon_growth_intro_done,undefined);
}
s=setup(); growth.setGrowthPreview(false);
assert.equal(await growth.reflectAtSpot("kannon"),false);
assert.deepEqual(scenes,[]); assert.deepEqual(opened,[]);
console.log("[kannon growth] PASS: first completion, reload, no resource/reel changes, missing/cancelled scene, owner changes at modal/intro, visit/back and flag off");

// 相談候補を調べてからVN/UIを読み込む間にも、LOAD・中断・条件変更が起こりうる。
for (const boundary of ["../vn/engine.js", "./ui.js"]) {
  for (const interrupt of ["load", "abort", "off", "hearts"]) {
    s=setup();
    const id = interrupt === "hearts" ? "M-B4" : "M-W1";
    s.growth.nodes=[id];
    if (interrupt === "hearts") { s.cycle=2; s.affinity.hiyori=66; }
    core.save();
    const controller = new AbortController();
    importHook = specifier => {
      if (specifier !== boundary) return;
      importHook=null;
      if (interrupt === "load") core.load();
      if (interrupt === "abort") controller.abort();
      if (interrupt === "off") growth.setGrowthPreview(false);
      if (interrupt === "hearts") s.affinity.hiyori=0;
    };
    const result = await growth.consultLessons(interrupt === "hearts" ? "hiyori" : "sumi", { signal: controller.signal });
    assert.deepEqual(plain(result), []);
    assert.deepEqual(scenes, [], `${boundary}で${interrupt}になった古い相談は再生しない`);
    assert.deepEqual(cards, []);
    assert.equal(core.state.growth.learned.includes(id), false);
    assert.equal(s.growth.learned.includes(id), false);
    assert.deepEqual(plain(core.state.growth.nodes), [id]);
    assert.equal(core.state.growth.hidane.any, 2);
    assert.equal(core.state.day,3); assert.equal(core.state.slot,0); assert.equal(core.state.stamina,80);
  }
}
s=setup(); s.growth.nodes=["M-W1"];
const controller = new AbortController(); controller.abort();
assert.deepEqual(plain(await growth.consultLessons("sumi", { signal: controller.signal })), []);
assert.deepEqual(scenes, [], "中断済みなら最初から相談に入らない");
s=setup(); s.growth.nodes=["M-W1"];
const during = new AbortController();
sceneHook = id => { during.abort(); return { id, visited:[id] }; };
assert.deepEqual(plain(await growth.consultLessons("sumi", { signal:during.signal })), []);
assert.deepEqual(plain(s.growth.learned), [], "中断後の遅い完了通知では習得しない");
assert.deepEqual(cards, []);
s=setup(); s.growth.nodes=["M-W1","M-W2"]; core.save();
cardHook=()=>{cardHook=null;core.load();};
assert.deepEqual(plain(await growth.consultLessons("sumi")).map(l=>l.id), ["M-W1"]);
assert.deepEqual(scenes, ["ch1_sumi_cube_coals"], "一つ目の通知中にLOADしたら次の授業を再生しない");
assert.deepEqual(plain(core.state.growth.learned), ["M-W1"]);
s=setup(); s.growth.nodes=["M-W1"]; before=resources(s);
assert.deepEqual(plain(await growth.consultLessons("sumi")).map(l=>l.id), ["M-W1"]);
assert.equal(cards.length,1);
assert.deepEqual(plain(await growth.consultLessons("sumi")), []);
assert.equal(cards.length,1);
assert.deepEqual({day:s.day,slot:s.slot,stamina:s.stamina},{day:before.day,slot:before.slot,stamina:before.stamina});
assert.deepEqual(plain(s.growth.hidane),before.growth.hidane);
console.log("[lesson imports] PASS: LOAD/abort/off/hearts during both imports, pre-abort, late completion, inter-lesson LOAD and normal completion once");
