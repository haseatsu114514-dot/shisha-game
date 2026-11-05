import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const storage = new Map();
const context = vm.createContext({ console, setTimeout, clearTimeout, localStorage: {
  getItem: k => storage.get(k) ?? null,
  setItem: (k,v) => storage.set(k,v),
} });
const modules = new Map();
async function module(path) {
  if (modules.has(path)) return modules.get(path);
  const m = new vm.SourceTextModule(await read(path), { context, identifier: path });
  modules.set(path,m);
  await m.link(async (specifier, parent) => {
    const target = new URL(specifier, `file:///${parent.identifier}`).pathname.slice(1);
    if (target === 'js/core/portrait-style.js') return module(target);
    const source = await read(parent.identifier);
    const statement = source.split('\n').find(line => line.includes(`from "${specifier}"`));
    const exports = statement.match(/\{([^}]+)\}/)[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]);
    return new vm.SyntheticModule(exports, function () { for (const name of exports) this.setExport(name, () => {}); }, {context});
  });
  await m.evaluate(); return m;
}
const state = (await module('js/core/state.js')).namespace;
const data = (await module('js/core/data.js')).namespace;
const style = (await module('js/core/portrait-style.js')).namespace;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
const legacy = {faces:['normal','smile','serious','ura_normal','ura_smile'],h:.8,b:0,ax:.4,aspect:.75};
data.DB.manifest.portraits = {tsumugi:legacy,minto:legacy};
data.DB.manifest.portraitVariants = {new:{tsumugi:{faces:['normal','smile'],h:.7,b:.1,ax:.6,aspect:.8}}};
data.DB.characters.tsumugi = {spriteScale:.88, spriteScaleVariants:{new:.9}};
test('default remains classic at original scale', () => { const p=data.portraitInfo('tsumugi','normal');assert.equal(p.style,'classic');assert.equal(p.scale,.88); });
test('new uses separate image and measurements', () => {
 state.config.portraitStyle='new'; const p=data.portraitInfo('tsumugi','normal');
 assert.equal(p.src,'../assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png');
 assert.equal(p.h,.7); assert.equal(p.b,.1); assert.equal(p.ax,.6); assert.equal(p.scale,.9);
});
test('speaker alias and expression alias retained', () => assert.equal(data.portraitInfo('tumugi','excited').face,'smile'));
test('missing new expression retains classic expression', () => {const p=data.portraitInfo('tsumugi','serious');assert.equal(p.style,'classic');assert.equal(p.face,'serious');assert.equal(p.b,.02);assert.equal(p.scale,.88);});
test('missing character variant falls back to classic', () => assert.equal(data.portraitInfo('minto','smile').style,'classic'));
test('unknown character stays absent', () => assert.equal(data.portraitInfo('missing'),null));
test('private outfit never becomes public outfit', () => {const p=data.portraitInfo('oneesan','smile');assert.equal(p.face,'ura_smile');assert.match(p.src,/chr_minto_ura_smile/);});
test('new public Minto cannot replace private Minto', () => {
 data.DB.manifest.portraitVariants.new.minto={faces:['normal'],h:.7};
 assert.equal(data.portraitInfo('oneesan','normal').style,'classic');
});
test('private missing fallback remains private or absent', () => {
 const saved=legacy.faces;legacy.faces=['normal'];assert.equal(data.portraitInfo('oneesan','smile'),null);legacy.faces=saved;
});
test('explicit comparison does not change saved preference', () => {assert.equal(data.portraitInfo('tsumugi','normal','classic').style,'classic');assert.equal(state.config.portraitStyle,'new');});
test('config survives reload independently of game state', () => {
 state.config.portraitStyle='new';state.saveConfig();state.config.portraitStyle='classic';state.loadConfig();assert.equal(state.config.portraitStyle,'new');assert.equal(state.state,null);
});
test('old config without key defaults to classic on boot', () => {
 storage.set(state.CONFIG_KEY,'{}');state.config.portraitStyle='classic';state.loadConfig();assert.equal(style.portraitStyle(),'classic');
});
test('invalid saved preference normalizes', () => {storage.set(state.CONFIG_KEY,'{"portraitStyle":"invalid"}');state.loadConfig();assert.equal(state.config.portraitStyle,'classic');});
test('missing variant manifest is backward compatible', () => {delete data.DB.manifest.portraitVariants;state.config.portraitStyle='new';assert.equal(data.portraitInfo('tsumugi','normal').style,'classic');});
// Execute production openConfig with a tiny DOM adapter, without importing unrelated scenes.
const titleSource = await read('js/scenes/title.js');
let modalArgs, saves=0, changed;
function el(selector,attrs={},children=[]) {
 if(Array.isArray(attrs)){children=attrs;attrs={};}
 return {selector,...attrs,children};
}
const configCtx = vm.createContext({config:state.config,document:{body:{dataset:{screen:'vn'}}},el,
 saveConfig(){saves++;},applyVolumes(){},createUiThemeSelect(){return {};},
 modal(args){modalArgs=args;return Promise.resolve(true);}});
vm.runInContext(titleSource.slice(titleSource.indexOf('export async function openConfig')).replace('export async function','async function')+';globalThis.openConfig=openConfig;',configCtx);
await configCtx.openConfig({onChange:(key,value)=>changed=[key,value]});
const find = (node,test) => node?.dataset?.test===test ? node : (node?.children||[]).map(n=>find(n,test)).find(Boolean);
const control=find(modalArgs.body,'cfg-portrait-style');
test('settings expose independent classic/new control',()=>{assert.ok(control);assert.equal(control.children.length,2);assert.ok(find(modalArgs.body,'cfg-intro-art'));});
test('changing settings persists and notifies current VN',()=>{control.onchange({target:{value:'new'}});assert.equal(saves,1);assert.deepEqual(changed,['portraitStyle','new']);});
configCtx.document.body.dataset.screen='preview';control.onchange({target:{value:'classic'}});
test('isolated preview does not write user settings',()=>assert.equal(saves,1));
// Run production VN settings refresh against two retained portrait nodes.
const engineSource=await read('js/vn/engine.js');
const start=engineSource.indexOf('async function openSettings()');
const end=engineSource.indexOf('\nexport const isPlaying',start);
const images=[{dataset:{speaker:'tsumugi',face:'smile'},src:'old-a'}, {dataset:{speaker:'minto',face:'serious'},src:'old-b'}];
let framed=0, resolved=0, kicked=0;
const vnContext=vm.createContext({SE:{select(){}},clearTimeout(){},autoTimer:null,running:{typing:false},vnModalOpen:0,
 openVnConfig:async opts=>{opts.onChange('portraitStyle');},
 dom:{portraits:{querySelectorAll:()=>images}},portraitInfo:(speaker,face)=>{resolved++;return {src:`new-${speaker}-${face}`};},
 frame(){framed++;},nameFit:null,config:state.config,completeTyping(){},document:{activeElement:null},startTypingInterval(){},kickAuto(){kicked++;}});
vm.runInContext(engineSource.slice(start,end)+';globalThis.openSettings=openSettings;',vnContext);
await vnContext.openSettings();
test('VN refresh updates speaker and silent companion in place',()=>{assert.equal(resolved,2);assert.equal(framed,2);assert.equal(images[0].src,'new-tsumugi-smile');assert.equal(images[1].src,'new-minto-serious');assert.equal(kicked,1);assert.equal(vnContext.vnModalOpen,0);});
console.log(`FINAL ${passed}/${passed} passed`);
