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
    if (target === 'js/core/portrait-style.js' || target === 'js/core/portrait-resolver.js') return module(target);
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
const resolver = (await module('js/core/portrait-resolver.js')).namespace;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
const legacy = {faces:['normal','smile','serious','ura_normal','ura_smile'],h:.8,b:0,ax:.4,aspect:.75};
data.DB.manifest.portraits = {tsumugi:legacy,minto:legacy};
data.DB.manifest.portraitVariants = {new:{tsumugi:{faces:['normal','smile'],h:.7,b:.1,ax:.6,aspect:.8}}};
data.DB.characters.tsumugi = {spriteScale:.88, spriteScaleVariants:{new:.9}};
test('default is adopted new version', () => { const p=data.portraitInfo('tsumugi','normal');assert.equal(p.style,'new');assert.equal(p.scale,.9); });
test('classic remains available at original scale', () => { const p=data.portraitInfo('tsumugi','normal','classic');assert.equal(p.style,'classic');assert.equal(p.scale,.88); });
test('new uses separate image and measurements', () => {
 state.config.portraitStyle='new'; const p=data.portraitInfo('tsumugi','normal');
 assert.equal(p.src,'../assets/sprites/character_variants/new/tsumugi/chr_tsumugi_normal.png');
 assert.equal(p.h,.7); assert.equal(p.b,.1); assert.equal(p.ax,.6); assert.equal(p.scale,.9);
});
test('speaker alias and expression alias retained', () => assert.equal(data.portraitInfo('tumugi','excited').face,'smile'));
test('missing expression retains same-style normal and framing', () => {const p=data.portraitInfo('tsumugi','serious');assert.equal(p.style,'new');assert.equal(p.face,'normal');assert.equal(p.b,.1);assert.equal(p.scale,.9);});
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
test('old config without key migrates to new without touching other settings', () => {
 storage.set(state.CONFIG_KEY,'{"mute":true,"bgmVolume":0.25}');state.config.portraitStyle='classic';state.loadConfig();
 assert.equal(style.portraitStyle(),'new');assert.equal(state.config.mute,true);assert.equal(state.config.bgmVolume,.25);assert.equal(state.state,null);
});
test('old classic default migrates once and later classic choice persists', () => {
 storage.set(state.CONFIG_KEY,'{"portraitStyle":"classic"}');state.loadConfig();assert.equal(state.config.portraitStyle,'new');
 state.config.portraitStyle='classic';state.saveConfig();state.config.portraitStyle='new';state.loadConfig();
 assert.equal(state.config.portraitStyle,'classic');assert.equal(style.portraitStyle(),'classic');
});
test('invalid saved preference uses new', () => {storage.set(state.CONFIG_KEY,'{"portraitStyle":"invalid","portraitStyleVersion":1}');state.loadConfig();assert.equal(state.config.portraitStyle,'new');});
test('retired nanami preference migrates to new even after migration', () => {
 data.DB.manifest.portraitVariants.nanami={tsumugi:{faces:['normal'],h:.65,b:.05,ax:.55}};
 for(const version of [undefined,1]) {
  storage.set(state.CONFIG_KEY,JSON.stringify({portraitStyle:'nanami',portraitStyleVersion:version}));state.loadConfig();
  assert.equal(state.config.portraitStyle,'new');assert.equal(style.portraitStyle(),'new');
  const p=data.portraitInfo('tsumugi','serious');assert.equal(p.style,'new');assert.equal(p.face,'normal');assert.equal(p.h,.7);
 }
});
test('explicit retired style cannot activate archived art', () => {
 const p=data.portraitInfo('tsumugi','normal','nanami');assert.equal(p.style,'new');assert.match(p.src,/character_variants\/new\//);
 assert.equal(data.DB.manifest.portraitVariants.nanami.tsumugi.h,.65,'Archived metadata remains intact');
});
test('unregistered costumes never use another costume normal', () => {
 const old=legacy.faces;legacy.faces=[...old,'office_angry'];
 assert.equal(data.portraitInfo('minto','office_angry','new').style,'classic');legacy.faces=old;
});
test('new-only costume keeps same-costume expressions and missing-face fallback', () => {
 data.DB.manifest.portraitVariants.new.tsumugi.faces.push('baito_normal','baito_smile');
 assert.equal(data.portraitInfo('tsumugi','baito_smile','new').face,'baito_smile');
 assert.equal(data.portraitInfo('tsumugi','baito_surprise','new').face,'baito_normal');
 assert.equal(data.portraitInfo('tsumugi','baito_smile','classic').face,'normal');
});
test('missing variant manifest is backward compatible', () => {delete data.DB.manifest.portraitVariants;state.config.portraitStyle='new';assert.equal(data.portraitInfo('tsumugi','normal').style,'classic');});
test('mini-game portraits adopt future Noor and Rio manifest entries without file paths', () => {
 const manifest = {portraits:{noor:legacy,rio:legacy},portraitVariants:{new:{
  noor:{faces:['normal','smile'],h:.9,b:.05,ax:.51,aspect:.75},
  rio:{faces:['normal','smile'],h:.88,b:.06,ax:.49,aspect:.75}}}};
 for(const id of ['noor','rio']) {
  assert.equal(resolver.resolvePortrait(manifest,id,'smile','new').style,'new');
  assert.match(resolver.resolvePortrait(manifest,id,'smile','new').rel,/character_variants\/new/);
  assert.equal(resolver.resolvePortrait(manifest,id,'smile','classic').style,'classic');
 }
});
// 2026-11-06 顔アイコンも会話の立ち絵と同じ画風にする（新バージョンの顔アイコンがある人だけ新バージョン）。
test('face icons follow the selected portrait style', () => {
 data.DB.manifest.faceIcons=['face_tsumugi.png','face_rio.png','face_minto.png','face_minto_private.png'];
 data.DB.manifest.faceIconVariants={new:['face_tsumugi.png','face_minto.png','face_minto_private.png']};
 const classic=name=>`../assets/ui/face_icons/${name}`, fresh=name=>`../assets/ui/face_icons/new/${name}`;
 state.config.portraitStyle='classic';
 assert.equal(data.faceIconUrl('tsumugi'),classic('face_tsumugi.png'));
 assert.equal(data.faceIconUrl('oneesan'),classic('face_minto_private.png'));
 state.config.portraitStyle='new';
 assert.equal(data.faceIconUrl('tsumugi'),fresh('face_tsumugi.png'));
 assert.equal(data.faceIconUrl('tumugi'),fresh('face_tsumugi.png'),'speaker alias');
 assert.equal(data.faceIconUrl('oneesan'),fresh('face_minto_private.png'),'private Minto uses the new private face');
 assert.equal(data.faceIconUrl('minto',{flags:{_minto_name_known:true}},{context:'private'}),fresh('face_minto_private.png'));
 assert.equal(data.faceIconUrl('minto'),fresh('face_minto.png'),'public Minto keeps the public face');
 assert.equal(data.faceIconUrl('rio'),classic('face_rio.png'),'no new portrait: classic face, same as the conversation');
 assert.equal(data.faceIconUrl('missing'),null);
 assert.equal(data.faceIconUrl('tsumugi',null,{style:'classic'}),classic('face_tsumugi.png'),'explicit style wins');
 assert.deepEqual(data.allFaceIconUrls(),[fresh('face_tsumugi.png'),classic('face_rio.png'),fresh('face_minto.png'),fresh('face_minto_private.png')]);
 state.config.portraitStyle='nanami';
 assert.equal(data.faceIconUrl('tsumugi'),fresh('face_tsumugi.png'),'retired Nanami preference is normalized to the new style');
 delete data.DB.manifest.faceIconVariants;state.config.portraitStyle='new';
 assert.equal(data.faceIconUrl('tsumugi'),classic('face_tsumugi.png'),'manifest without variants is backward compatible');
 state.config.portraitStyle='classic';
});
test('face frames are looked up per portrait style', () => {
 data.DB.manifest.faceFrames={classic:{sui:{box:[1,2,3]}},new:{sui:{box:[4,5,6],eye:[7,8],unit:9}}};
 assert.deepEqual(data.faceFrame('sui').box,[1,2,3]);
 assert.deepEqual(data.faceFrame('sui','new').box,[4,5,6]);
 assert.equal(data.faceFrame('sui','nanami'),null);
 assert.equal(data.faceFrame('missing','new'),null);
});
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
test('settings expose independent classic/new control',()=>{assert.ok(control);assert.deepEqual(Array.from(control.children,option=>option.value),['new','classic']);assert.ok(find(modalArgs.body,'cfg-intro-art'));});
test('changing settings persists and notifies current VN',()=>{control.onchange({target:{value:'new'}});assert.equal(saves,1);assert.deepEqual(changed,['portraitStyle','new']);});
configCtx.document.body.dataset.screen='preview';control.onchange({target:{value:'classic'}});
test('isolated preview does not write user settings',()=>assert.equal(saves,1));
const previewSource=await read('js/vn/conversation-preview.js');
const previewStart=previewSource.indexOf('const portraitStyleSelect=');
const previewEnd=previewSource.indexOf('const faceSelect=',previewStart);
for(const [query,expected] of [['','new'],['?portraitStyle=nanami','new'],['?portraitStyle=classic','classic'],['?portraitStyle=invalid','new']]) {
 const ctx=vm.createContext({previewQuery:new URLSearchParams(query),document:{createElement(){return {options:[],setAttribute(){},addEventListener(){},append(option){this.options.push(option);}};}},characterSelect:{after(){}},start(){}});
 vm.runInContext(previewSource.slice(previewStart,previewEnd)+';globalThis.select=portraitStyleSelect;',ctx);
 test(`preview ${query || 'default'} uses ${expected} and offers only adopted styles`,()=>{
  assert.equal(ctx.select.value,expected);assert.deepEqual(Array.from(ctx.select.options,option=>option.value),['new','classic']);
 });
}
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
// CONTINUE picks its portrait style by coverage (#2524): the new version only when every face of the script has
// new-version art AND a measured close-up frame (continuePortraitVariants); otherwise the measured classic art.
const continueSource=await read('js/chapters/continue-view.js');
const styleStart=continueSource.indexOf('export function continuePortraitStyle(');
const styleEnd=continueSource.indexOf('export function continueFraming(',styleStart);
const styleSource=continueSource.slice(styleStart,styleEnd).replace('export function','function')+';globalThis.continuePortraitStyle=continuePortraitStyle;';
const initialStart=continueSource.indexOf('  const faces = [...new Set(');
const initialEnd=continueSource.indexOf('  const image =',initialStart);
const faceStart=continueSource.indexOf('  function face(');
const faceEnd=continueSource.indexOf('  function reaction(',faceStart);
function runContinue(manifest){
 const calls=[];
 const ctx=vm.createContext({script:{cues:[{face:'normal'}],reactions:{retry:{faces:['smile']}}},speaker:'sumi',DB:{manifest},portraitInfo(...args){calls.push(args);return null;},root:{dataset:{}}});
 vm.runInContext(styleSource,ctx);
 vm.runInContext(continueSource.slice(initialStart,initialEnd),ctx);
 vm.runInContext(continueSource.slice(faceStart,faceEnd)+';face("smile",false);',ctx);
 return calls;
}
const fullNew={portraitVariants:{new:{sumi:{faces:['normal','smile']}}},continuePortraitVariants:{new:{sumi:{normal:{cx:.5,top:.1,size:.2},smile:{cx:.5,top:.1,size:.2}}}}};
test('CONTINUE uses the new version only when every face and its measured frame exist',()=>{
 assert.deepEqual(runContinue(fullNew),[['sumi','normal','new'],['sumi','smile','new']]);
 assert.deepEqual(runContinue({portraitVariants:{new:{sumi:{faces:['normal']}}},continuePortraitVariants:{new:{sumi:{normal:{}}}}}),[['sumi','normal','classic'],['sumi','smile','classic']],'a missing expression keeps the whole screen classic');
 assert.deepEqual(runContinue({portraitVariants:{new:{sumi:{faces:['normal','smile']}}},continuePortraitVariants:{new:{}}}),[['sumi','normal','classic'],['sumi','smile','classic']],'a missing measured frame keeps the whole screen classic');
 assert.deepEqual(runContinue({}),[['sumi','normal','classic'],['sumi','smile','classic']]);
});
const gameoverSource=await read('js/chapters/gameover.js');
const warmStart=gameoverSource.indexOf('export function warmGameOver()');
const warmEnd=gameoverSource.indexOf('\n//',warmStart);
for(const [style,expected] of [['classic','classic'],['new','new']]){
 const warmCalls=[];
 const warmCtx=vm.createContext({SUMI_CONTINUE_SCRIPTS:[{cues:[{face:'normal'}],reactions:{retry:{faces:['smile']}}}],LOVER_CONTINUE_SCRIPTS:{},state:{lovers:[]},DB:{manifest:{}},
  scriptFaces:script=>[...new Set([...script.cues.map(c=>c.face),...Object.values(script.reactions).flatMap(r=>r.faces)])],continuePortraitStyle:()=>style,
  portraitInfo(...args){warmCalls.push(args);return {src:`${style}-image`};},preloadBgm:async()=>{},imageReady:async()=>{}});
 vm.runInContext(gameoverSource.slice(warmStart,warmEnd).replace('export function','function')+';this.warm=warmGameOver;',warmCtx);
 await warmCtx.warm();
 test(`CONTINUE warmup preloads the same ${expected} artwork the screen will show`,()=>assert.deepEqual(warmCalls,[['sumi','normal',expected],['sumi','smile',expected]]));
}
// The standing image in an intro morph is the current VN portrait, not always classic.
const transitionSource=await read('js/vn/intro-transition.js');
const metricStart=transitionSource.indexOf('const STANDING_FACE_X =');
const metricEnd=transitionSource.indexOf('\n};',metricStart)+3;
const headStart=transitionSource.indexOf('function headOf(');
const headEnd=transitionSource.indexOf('\nfunction animate(',headStart);
const headCtx=vm.createContext({});
vm.runInContext(transitionSource.slice(metricStart,metricEnd)+'\n'+transitionSource.slice(headStart,headEnd)+';this.head=headOf;',headCtx);
const manifest=JSON.parse(await read('data/manifest.json'));
data.DB.manifest.portraits=manifest.portraits;
data.DB.manifest.portraitVariants=manifest.portraitVariants;
data.DB.manifest.faceFrames=manifest.faceFrames;
test('intro morph uses the eye measurements of the displayed style',()=>{
 const rect={left:100,top:20,width:448,height:600,img:{naturalWidth:896}};
 for(const choice of ['new','classic']) {
  state.config.portraitStyle=choice;
  const p=data.portraitInfo('hajime','normal');
  const head=headCtx.head(rect,p);
  assert.equal(p.style,choice);
  assert.equal(head.x,100+448*((choice==='classic'?544.5:483.5)/896));
  assert.equal(head.top,20+(1-p.b-p.h)*600);
  assert.equal(head.height,p.h*600*.16);
  assert.equal(state.config.portraitStyle,choice,'Measuring the transition never changes the preference');
 }
});
// Run the authored craft layouts with the real portrait resolver under either setting.
function layoutNode(selector,attrs={},children=[]) {
 if(Array.isArray(attrs)){children=attrs;attrs={};}
 const node={selector,...attrs,dataset:{...attrs.dataset},style:{...attrs.style,setProperty(k,v){this[k]=v;}},children:[],classList:{add(){},remove(){}},
  append(...xs){this.children.push(...xs.filter(Boolean));},prepend(...xs){this.children.unshift(...xs.filter(Boolean));},
  setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];},querySelector(){return null;},replaceChildren(...xs){this.children=xs;}};
 node.append(...children);return node;
}
const executable=source=>source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const audienceSource=await read('js/craft/audience.js');
for(const choice of ['new','classic']) {
 state.config.portraitStyle=choice;
 const calls=[],loaded=[],nodes=[];
 const layoutEl=(...args)=>{const n=layoutNode(...args);nodes.push(n);return n;};
 const ctx=vm.createContext({el:layoutEl,state:{chapter:1},performance:{now:()=>0},getComputedStyle:()=>({fontSize:'16px'}),
  displayName:id=>id,portraitInfo:(...args)=>{calls.push(args);return data.portraitInfo(...args);},faceIconUrl:()=>null,faceFrame:data.faceFrame,
  imageReady:async url=>loaded.push(url),growthSkill:()=>false,innerVoiceLine:()=>'',watchLine:()=>'',autoWrap:text=>text});
 vm.runInContext(executable(audienceSource)+';this.api={buildAudience,faceCrop};',ctx);
 for(const id of ['hajime','sumi','sui','maezono','dr_kemuri','emil','pakki','da_silva']) {
  ctx.api.buildAudience({mode:'tutorial',audienceIds:[id]});
  // #2680: 審査員の顔は設定中の画風の絵を、その画風の絵で測った枠で出す（新版が無い人は現行）。
  const image=nodes.filter(n=>n.selector==='img').at(-1),p=data.portraitInfo(id,id==='sui'?'serious':'normal');
  assert.equal(image.src,p.src);
  if(choice==='classic') assert.equal(p.style,'classic');
  const crop=ctx.api.faceCrop(p);
  if(!['da_silva'].includes(id)) assert(crop,`${id}: measured face crop for ${p.style}`);
  if(crop) {
   assert.equal(image.style.width,`${80/crop[2]}px`);
   assert.equal(image.style.left,`${-crop[0]*(80/crop[2])}px`);
   assert.equal(image.style.top,`${-crop[1]*(80/crop[2])}px`);
  }
  assert(loaded.includes(image.src),'Displayed audience expression is preloaded');
 }
 test(`craft audience ${choice} setting shows the selected style with its measured crop`,()=>{
  assert(calls.length>8 && calls.every(args=>args[2]===undefined));
  assert.equal(state.config.portraitStyle,choice);
 });
}
const workerSource=await read('js/craft/worker.js');
for(const choice of ['new','classic']) {
 state.config.portraitStyle=choice;
 const calls=[],loaded=[],nodes=[];
 const layoutEl=(...args)=>{const n=layoutNode(...args);nodes.push(n);return n;};
 const ctx=vm.createContext({el:layoutEl,portraitInfo:(...args)=>{calls.push(args);return data.portraitInfo(...args);},
  bgUrl:()=>null,makingUrl:()=>null,timeOfDay:()=> 'day',artHeight:()=>20,artImg:()=>layoutEl('img.art'),
  buildWorkerActions:()=>({root:layoutEl('div.actions'),ready:Promise.resolve(),show:()=>null,prepare:async()=>{}}),
  buildWorkerHoles:()=>({root:layoutEl('div.holes'),ready:Promise.resolve(),show(){},reset(){},prepare:async()=>{}}),
  imageReady:async url=>{loaded.push(url);return true;},workerSceneKey:()=>null,sceneArtUrls:()=>[],readyWorkerImage:async()=>true});
 vm.runInContext(executable(workerSource)+';this.build=buildWorkerScene;',ctx);
 const worker=ctx.build({mode:'practice'});await worker.ready;
 const actor=nodes.find(n=>n.selector==='img.worker-actor');
 for(const [mental,face] of [['steady','serious'],['unsteady','sad'],['shaken','surprise']]) {
  worker.setMental(mental);
  assert.equal(actor.src,data.portraitInfo('hajime',face,'classic').src);
  assert(loaded.includes(actor.src),'Displayed worker expression is preloaded');
 }
 worker.setMental('steady');worker.setFatigue(1);
 assert.equal(actor.src,data.portraitInfo('hajime','normal','classic').src);
 test(`craft worker ${choice} setting keeps fixed face overlays on measured art`,()=>{
  assert(calls.length>5 && calls.every(args=>args[2]==='classic'));
  assert.equal(state.config.portraitStyle,choice);
 });
}
const readinessSource=await read('js/craft/readiness.js');
const readinessCtx=vm.createContext({makingUrl:()=>null,bgUrl:()=>null,faceIconUrl:()=>null,audienceAssetUrls:()=>[],WORKER_SCENES:{},
 portraitInfo:(...args)=>data.portraitInfo(...args)});
vm.runInContext(executable(readinessSource)+';this.urls=craftAssetUrls;',readinessCtx);
test('craft readiness warms the same measured worker artwork',()=>{
 state.config.portraitStyle='new';
 assert.deepEqual(Array.from(readinessCtx.urls('practice')),[data.portraitInfo('hajime','serious','classic').src]);
 assert.equal(state.config.portraitStyle,'new');
});
console.log(`FINAL ${passed}/${passed} passed`);

