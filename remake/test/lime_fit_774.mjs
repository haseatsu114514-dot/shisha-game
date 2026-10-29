// VM verification of production motion and the unchanged production contact control branch.
// This does not measure browser pixels or prove the reporter's encounter path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../js/motions/lime.js', import.meta.url), 'utf8');
async function fixture(width, height, fail = false) {
  const context = vm.createContext({console});
  let observer, disconnected = false, phones = 0, scene, root;
  const transforms = [];
  function el(selector, attrs = {}, children = []) {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    return {selector, style:{...attrs.style}, attrs, children, append(...nodes){this.children.push(...nodes);}};
  }
  const values = {
    'util.js': {el, sleep:async()=>{if(fail) throw Error('animation failure');}}, 'state.js':{state:{}},
    'data.js':{DB:{}, displayName:()=> 'なる', faceIconUrl:()=> 'existing-face'},
    'lime-icons.js':{customLimeIconUrl:()=> null},
    'ui.js':{imageReady:async()=>true}, 'audio.js':{SE:{phone(){phones++;}}},
    'transition-kit.js':{svg:el,move:async()=>{ transforms.push(scene?.style.transform); }},
    'mg-kit.js':{MG_EASE:{out:'out',in:'in',inOut:'inOut',back:'back'},motionVariant:()=> 'a'},
    'stage.js':{backdrop:()=>el('backdrop'),stagePlay:async(name,run)=>{
      root = el(name); root.clientWidth=width;root.clientHeight=height;
      await run(root);scene=root.children.find(n=>n.selector==='div.mo-lime-scene');
    }},
  };
  context.ResizeObserver = class {
    constructor(callback){observer=this;this.callback=callback;}
    observe(node){scene=node.children.find(n=>n.selector==='div.mo-lime-scene');assert(scene,'fit container must exist');transforms.push(scene.style.transform);}
    disconnect(){disconnected=true;}
  };
  const module = new vm.SourceTextModule(source,{context});
  await module.link(async path=>{const exports=values[path.split('/').at(-1)];assert(exports,path);
    return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context});});
  await module.evaluate();
  const run=module.namespace.exchange('naru');
  if(fail) await assert.rejects(run,/animation failure/);else await run;
  assert(disconnected,'resize observer cleanup');
  const scale=Math.min(width/560,height/720);
  assert.equal(transforms[0],`translate(-50%, -50%) scale(${scale})`);
  assert.equal(scene.style.width,'560px');assert.equal(scene.style.height,'720px');
  assert.equal(phones,fail?0:1);
  assert.equal(root.children[0].selector,'backdrop','backdrop covers the whole stage');
  if(!fail){
    root.clientWidth=844;root.clientHeight=326;observer.callback();
    assert.equal(scene.style.transform,`translate(-50%, -50%) scale(${Math.min(844/560,326/720)})`);
  }
  return {width,height,scale,phones};
}
const results=[];
for(const [w,h]of [[1280,720],[844,326],[390,622]])results.push(await fixture(w,h));
await fixture(844,326,true);
const engine=fs.readFileSync(new URL('../js/vn/engine.js',import.meta.url),'utf8');
const sceneSource=fs.readFileSync(new URL('../js/core/scene-motions.js',import.meta.url),'utf8');
const control=engine.slice(engine.indexOf('    if (type === "set_flag") {'),engine.indexOf('    if (type === "show_cg") {'));
assert(control.includes('alreadyConnected')&&control.includes('limeExchange(id)'));
async function contactCase({old=false,skip=false,reduce=false}={}) {
  let shown=0,continued=0;
  const state={flags:{},contacts:old?['naru']:[]};
  const context=vm.createContext({console,document:{body:{classList:{contains:()=>skip}}}});
  let still=null;
  const motion=new vm.SyntheticModule(['exchange'],function(){this.setExport('exchange',async(_id,_context,options)=>{shown++;still=options?.still;});},{context});
  await motion.link(()=>{});await motion.evaluate();
  const wrapper=new vm.SourceTextModule(sceneSource,{context,importModuleDynamically:async()=>motion});
  const imports={'state.js':{state,config:{shortSeen:false}},'data.js':{DB:{}},'transition-kit.js':{reducedMotion:()=>reduce},'mg-kit.js':{motionVariant:()=> 'a'},'ui.js':{loadingNotice:()=>({})},'module-loading.js':{withLoadingNotice:async(task,_opts)=>await task}};
  await wrapper.link(async path=>{const values=imports[path.split('/').at(-1)];return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await wrapper.evaluate();
  const r={queue:[],ready:true};
  Object.assign(context,{state,running:r,vnTest:{turbo:false},limeExchange:wrapper.namespace.limeExchange,next:()=>{continued++;}});
  new vm.Script('function probe(){const r=running;for(;;){const line=r.queue.shift();if(!line)return;const type=line.type;'+control+'}}').runInContext(context);
  for(let i=0;i<2;i++){r.queue.push({type:'set_flag',flag:'_lime_contact_naru'});context.probe();for(let j=0;j<20;j++)await Promise.resolve();}
  // #833: SKIP中も動きを減らす設定でも、初めての交換は一度だけ見せる（後者は動かない画面）。
  assert.equal(shown,old?0:1);
  if(!old)assert.equal(still,reduce,'reduced motion shows the still card');
  assert.equal(state.flags._lime_contact_naru,true);
  assert.equal(continued,old?0:1,'only the first new exchange waits');
  assert.deepEqual(state.contacts,old?['naru']:[],'existing control state semantics');
  return {old,skip,reduce,shown};
}
const contacts=[];
for(const options of [{},{old:true},{skip:true},{reduce:true}])contacts.push(await contactCase(options));
console.log(JSON.stringify({status:'PASS',results,contacts,observerCleanup:true,resize:true}));
