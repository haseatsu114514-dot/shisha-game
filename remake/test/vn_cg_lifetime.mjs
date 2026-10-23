// Actual VN module with controlled image/motion/animation ports; no browser or assets.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sourcePath = process.argv[2] || new URL('../js/vn/engine.js', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
async function runCase(kind) {
  const writes = [], hooks = [], image = deferred(), animation = deferred(), shot = deferred();
  let shutter;
  const classes = new Set();
  const cg = {dataset: {}, style: {}, classList: {add: x => {writes.push(x); classes.add(x);}, contains: x => classes.has(x)}, getAnimations: () => [{finished:animation.promise}]};
  const context = vm.createContext({console, setTimeout, clearTimeout, setInterval, clearInterval, performance});
  const modules = new Map();
  const overrides = {cgUrl: id => '/'+id+'.png', imageReady: () => image.promise,
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
for(const kind of ['normal','normal-cheki','image-cancel','cheki','cheki-abort','animation-cancel']) {
 try {await runCase(kind);console.log('PASS',kind);} catch(e){failures++;console.log('FAIL',kind,e.message);}
}
process.exitCode=failures?1:0;
