// Selected A/C compositions. Cues are limited to the two existing previewed lines;
// no automatic reaction detection, dialogue edits, new taps, or state writes.
const CUES = new Map([
  ['なんか、いいな。煙をそんなふうに見てくれる人がいるって', 'a'],
  ['えっ、見てないのに、わかるの？', 'c'],
]);
export function replyCutinCue(dialogueId, line) {
  return dialogueId === 'ch1_tsumugi_second' && line?.speaker === 'hajime'
    && !line.type && !line.portrait && line.portrait !== false ? CUES.get(line.text) || null : null;
}
export function replyCutinAllowed(context) {
  return context.portraitCount === 1 && !context.protagonistVisible && !context.cg
    && !context.choices && !context.log && !context.intro && !context.skip;
}
export const REPLY_COMPOSITIONS = Object.freeze({
  a: Object.freeze({ x:36, y:192, width:300, height:334, polygon:'0,23 300,0 264,334 0,334', imageHeight:1087.5, headY:10, anchorX:154 }),
  c: Object.freeze({ x:0, y:308, width:480, height:218, polygon:'0,31 480,0 425,195 0,218', imageHeight:1500, headY:-22, anchorX:198 }),
});
export function replyImagePlacement(info, kind) {
  const c = REPLY_COMPOSITIONS[kind];
  if (!c || !info?.src || ![info.h,info.b,info.ax,info.aspect].every(Number.isFinite) || info.h <= 0 || info.aspect <= 0) return null;
  const top = Math.max(0,1-info.b-info.h-(info.topOverhang || 0));
  return { src:info.src, height:c.imageHeight, width:c.imageHeight*info.aspect,
    top:c.headY-top*c.imageHeight, left:c.anchorX-info.ax*c.imageHeight*info.aspect };
}
const STYLE = `
.vn-reply-layer {position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
#vn:not(.active) .vn-reply-layer {visibility:hidden}
.vn-reply-cutin {position:absolute;pointer-events:none;animation:vn-reply-enter .22s ease-out both}
.vn-reply-cutin svg {position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.vn-reply-cutin .reply-image {position:absolute;max-width:none;max-height:none}
.vn-reply-cutin .reply-clip {position:absolute;inset:0;overflow:hidden;background:repeating-linear-gradient(128deg,transparent 0 23px,#e7d3f21a 23px 24px),linear-gradient(135deg,#685272,#34253f)}
.vn-reply-cutin[data-kind=c] {animation-duration:.14s}
.vn-reply-cutin[data-still=true] {animation:none}
#vn.sepia .vn-reply-layer {filter:sepia(.75) contrast(.95) brightness(.92)}
#vn.flashback .vn-reply-layer {filter:grayscale(1) contrast(.92)}
@keyframes vn-reply-enter {from {opacity:0;transform:translateX(-24px)} to {opacity:1;transform:translateX(0)}}
@media(prefers-reduced-motion:reduce) {.vn-reply-cutin {animation:none}}
`;
export function createReplyCutin(host, { document=globalThis.document, schedule=globalThis.setTimeout, cancel=globalThis.clearTimeout } = {}) {
  const surface=document.createElement('div');surface.className='vn-reply-layer';surface.setAttribute('aria-hidden','true');host.append(surface);
  if (!document.getElementById('vn-reply-style')) {
    const style=document.createElement('style');style.id='vn-reply-style';style.textContent=STYLE;document.head.append(style);
  }
  let node=null,image=null,kind=null,timer=null,generation=0;
  const clear=()=>{generation++;if(timer!==null)cancel(timer);timer=null;node?.remove();node=image=kind=null;};
  const refresh=(info, options={})=>{
    const p=replyImagePlacement(info,kind);if(!node)return false;if(!p){clear();return false;}
    const current=++generation;
    if(options.still!==undefined)node.dataset.still=String(!!options.still);
    // A previous image request's error must not remove a replacement expression.
    const next=document.createElement('img');next.className='reply-image';next.alt='';next.draggable=false;
    next.onerror=()=>{if(current===generation)clear();};
    for(const key of ['left','top','width','height'])next.style[key]=`${p[key]}px`;
    next.src=p.src;image?.remove();node.querySelector('.reply-clip').append(next);image=next;return true;
  };
  const show=(cue,context,info)=>{
    clear();if(!replyCutinAllowed(context)||!replyImagePlacement(info,cue))return false;
    kind=cue;const c=REPLY_COMPOSITIONS[kind];node=document.createElement('div');node.className='vn-reply-cutin';node.dataset.kind=kind;node.dataset.still=String(!!context.still);
    for(const key of ['left','top','width','height'])node.style[key]=`${c[{left:'x',top:'y'}[key]||key]}px`;
    const clip=document.createElement('div');clip.className='reply-clip';
    clip.style.clipPath=`polygon(${c.polygon.split(' ').map(pair=>pair.split(',').map(v=>`${v}px`).join(' ')).join(',')})`;node.append(clip);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${c.width} ${c.height}`);
    const border=document.createElementNS('http://www.w3.org/2000/svg','polygon');border.setAttribute('points',c.polygon);border.setAttribute('fill','none');border.setAttribute('stroke','#c9b491');border.setAttribute('stroke-width','2.5');svg.append(border);node.append(svg);
    surface.append(node);refresh(info);
    if(kind==='c'){const ownNode=node;timer=schedule(()=>{if(node===ownNode)clear();},900);}
    return true;
  };
  return {show,clear,refresh};
}
