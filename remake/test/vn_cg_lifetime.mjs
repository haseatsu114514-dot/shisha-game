// Actual VN module with controlled image/motion/animation ports; no browser or assets.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sourcePath = process.argv.slice(2).find(arg=>!arg.startsWith('--')) || new URL('../js/vn/engine.js', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
async function mockTitleImport(specifier, context) {
  assert.equal(specifier, '../scenes/title.js');
  const title = new vm.SyntheticModule(['openConfig'], function() { this.setExport('openConfig', async () => {}); }, { context });
  await title.link(() => { throw new Error('unexpected title import'); });
  await title.evaluate();
  return title;
}
async function runCase(kind) {
  const writes = [], hooks = [], image = deferred(), animation = deferred(), shot = deferred();
  let shutter;
  const classes = new Set();
  const cg = {dataset: {}, style: {}, classList: {add: x => {writes.push(x); classes.add(x);}, contains: x => classes.has(x)}, getAnimations: () => [{finished:animation.promise}]};
  const context = vm.createContext({console, setTimeout, clearTimeout, setInterval, clearInterval, performance});
  const modules = new Map();
  const overrides = {cgUrl: id => '/'+id+'.png', imageReady: () => image.promise, loadVnFonts: async () => [],
    nextFrame: () => Promise.resolve(), chekiShot: (_url, callback) => { shutter=callback; return shot.promise; }};
  const mod = new vm.SourceTextModule(source + '\nexport const lifetimePort = {set: (r,d) => {running=r; dom=d;}, showCg, hooks};', {context});
  await mod.link(async (specifier) => {
    if (modules.has(specifier)) return modules.get(specifier);
    const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m => m[2] === specifier).flatMap(m => m[1].split(',').map(n=>n.trim()));
    const dep = new vm.SyntheticModule(imports, function(){for(const name of imports) this.setExport(name, overrides[name] ?? (name === 'state' ? {flags:{}} : name === 'config' ? {} : () => {}));}, {context});
    modules.set(specifier,dep);return dep;
  });
  await mod.evaluate();
  const port=mod.namespace.lifetimePort, old={}, newer={};
  port.set(old,{cg}); port.hooks.onCg=id=>hooks.push(id);
  const pending=port.showCg('old',kind.includes('cheki') ? 'cheki' : '');
  if(kind === 'image-cancel') {port.set(newer,{cg});image.resolve(true);}
  else {
    image.resolve(true);
    for(let n=0;n<12;n++) await Promise.resolve();
    if(kind.includes('cheki')) {assert.equal(typeof shutter,'function');if(kind === 'cheki') port.set(newer,{cg});
      if(kind === 'cheki-abort') port.set(null,{cg});
      shutter();shot.resolve();}
    else if(kind === 'animation-cancel') {assert.equal(writes.length,1);port.set(newer,{cg});}
    animation.resolve();
  }
  await pending;
  if(kind === 'normal' || kind === 'normal-cheki') {assert.equal(writes.length,1);assert.deepEqual(hooks,['old']);}
  else if(kind === 'animation-cancel') assert.deepEqual(hooks,[], 'cancelled animation must not unlock old CG');
  else {assert.equal(writes.length,0,'cancelled CG must not write to replacement dialogue');assert.deepEqual(hooks,[]);}
}
let failures=0;
if (!process.argv.includes('--caller-only')) for(const kind of ['normal','normal-cheki','image-cancel','cheki','cheki-abort','animation-cancel']) {
 try {await runCase(kind);console.log('PASS',kind);} catch(e){failures++;console.log('FAIL',kind,e.message);}
}
process.exitCode=failures?1:0;

// Public caller coverage: no lifetimePort and no direct running assignment.
async function publicCallerCase(kind) {
  const gallery = [], image = deferred(), animation = deferred(), shot = deferred();
  let shutter = null, animationStarted = false;
  const nodes = new Map();
  function node(selector = '') {
    const classes = new Set(selector.split('.').slice(1));
    return { dataset: {}, style: {}, children: [], textContent: '',
      classList: {add: (...xs) => xs.forEach(x=>classes.add(x)), remove: (...xs) => xs.forEach(x=>classes.delete(x)),
        contains: x=>classes.has(x), toggle: (x,on=!classes.has(x)) => {if(on) classes.add(x); else classes.delete(x); return on;}},
      append(...xs) {this.children.push(...xs);}, replaceChildren(...xs) {this.children=xs;},
      setAttribute() {}, addEventListener() {}, focus() {}, querySelector() {return null;}, querySelectorAll() {return [];},
      getAnimations() {return [];}, remove() {},
    };
  }
  function el(selector, attrs = {}, children = []) {
    const n=node(selector);nodes.set(selector,n);
    if(Array.isArray(attrs)) children=attrs;
    else {Object.assign(n.dataset,attrs.dataset); Object.assign(n.style,attrs.style); n.onclick=attrs.onclick;}
    n.append(...children); return n;
  }
  const layers={vn:node(), fx:node(), modal:node()};
  const context=vm.createContext({console,setTimeout,clearTimeout,setInterval,clearInterval,performance,
    document:{body:node()},window:{addEventListener(){}}});
  const overrides={el, layers, createNameFit:()=>({fit(){}}), state:{flags:{},contacts:[]}, config:{textSpeed:4},
    DB:{dialogues:{}}, currentBgm:()=>null, cgUrl:id=>'/'+id+'.png', loadVnFonts:async()=>[],
    imageReady:url=>url==='/old.png' && kind==='image-abort' ? image.promise : Promise.resolve(true),
    nextFrame:()=>Promise.resolve(), chekiShot:(_url,cb)=>{shutter=cb;return shot.promise;},
    fortuneChoiceIndex:()=>-1,formatHtml:s=>s,stripTags:s=>s,SE:{select(){}}};
  const mod=new vm.SourceTextModule(source,{context,importModuleDynamically:specifier=>mockTitleImport(specifier,context)});
  await mod.link(async specifier=>{
    const names=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .filter(m=>m[2]===specifier).flatMap(m=>m[1].split(',').map(n=>n.trim()));
    return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,overrides[name]??(()=>{}));},{context});
  });
  await mod.evaluate();
  const engine=mod.namespace;
  engine.hooks.onCg=id=>gallery.push(id);
  const controller=new AbortController();
  const choice={type:'choice',choices:[{text:'done'}]};
  const oldScene=engine.play({dialogue_id:'old',lines:[{type:'show_cg',cg_id:'old',
    effect:kind==='animation-abort'||kind==='image-abort'?'':'cheki'},choice]}, {signal:controller.signal});
  const cg=nodes.get('div.vn-cg');
  cg.getAnimations=()=>{
    if(cg.dataset.cg==='old' && kind==='animation-abort') {animationStarted=true;return [{finished:animation.promise}];}
    return [];
  };
  const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await Promise.resolve();}assert.fail('public caller boundary not reached');};
  const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
  if(kind==='normal-cheki') {
    await until(()=>!!shutter);shutter();shot.resolve();
    await until(()=>nodes.get('div.vn-choices').children.length===1);
    assert.equal(cg.dataset.cg,'old');assert.equal(cg.classList.contains('show'),true);
    assert.deepEqual(gallery,['old']);
    nodes.get('div.vn-choices').children[0].onclick({stopPropagation(){}});
    const result=await oldScene;assert.equal(result.id,'old');assert.notEqual(result.cancelled,true);return;
  }
  if(kind==='cheki-abort')await until(()=>!!shutter);
  else if(kind==='animation-abort')await until(()=>animationStarted);
  else await flush();
  controller.abort();
  const cancelled=await oldScene;assert.equal(cancelled.cancelled,true);assert.equal(cancelled.id,'old');
  const newScene=engine.play({dialogue_id:'new',lines:[{type:'show_cg',cg_id:'new'},choice]});
  await until(()=>nodes.get('div.vn-choices').children.length===1);
  assert.equal(cg.dataset.cg,'new');assert.deepEqual(gallery,['new']);
  if(kind==='cheki-abort'){shutter();shot.resolve();}
  else if(kind==='animation-abort')animation.resolve();
  else image.resolve(true);
  await flush();
  const observed={cg:cg.dataset.cg,background:cg.style.backgroundImage,show:cg.classList.contains('show'),gallery:[...gallery]};
  // Finish through the real choice callback so the replacement scene also resolves normally.
  nodes.get('div.vn-choices').children[0].onclick({stopPropagation(){}});
  const result=await newScene;assert.equal(result.id,'new');assert.notEqual(result.cancelled,true);
  assert.deepEqual(observed,{cg:'new',background:'url("/new.png")',show:true,gallery:['new']},'aborted public play must not corrupt the next dialogue');
}
for(const kind of ['normal-cheki','image-abort','cheki-abort','animation-abort']) {
  try {await publicCallerCase(kind);console.log('PASS public-play',kind);}
  catch(e){failures++;console.log('FAIL public-play',kind,e.message);}
}
process.exitCode=failures?1:0;
