// Diagnostic snapshot uses the same five hit points as the tabletop assertions.
export function layoutSnapshot() {
 const describe = el => {
  if (!el) return null;
  const s=getComputedStyle(el);
  return {tag:el.tagName,id:el.id,classes:el.className,role:el.getAttribute('role'),hidden:el.hidden,inert:el.inert,
   pointerEvents:s.pointerEvents,visibility:s.visibility,opacity:s.opacity,zIndex:s.zIndex,transform:s.transform,
   display:s.display,box:el.getBoundingClientRect().toJSON()};
 };
 const ancestry=el=>{const a=[];for(;el;el=el.parentElement)a.push(describe(el));return a;};
 return {time:performance.now(),viewport:{width:innerWidth,height:innerHeight,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height},
  coarse:matchMedia('(pointer:coarse)').matches,scale:document.getElementById('stage').style.getPropertyValue('--k'),
  stage:describe(document.getElementById('stage')),rotate:describe(document.getElementById('trpg-rotate')),
  animations:document.getAnimations().map(a=>({state:a.playState,currentTime:a.currentTime,timing:a.effect.getComputedTiming(),target:describe(a.effect.target)})),
  actions:[...document.querySelectorAll('.trpg-modal-actions button')].map(el=>{
   const r=el.getBoundingClientRect();return {control:ancestry(el),points:[[6,6],[r.width-6,6],[6,r.height-6],[r.width-6,r.height-6],[r.width/2,r.height/2]].map(([x,y])=>{
    const px=r.left+x,py=r.top+y,h=document.elementFromPoint(px,py);return {x:px,y:py,hit:!!h&&(el===h||el.contains(h)),target:ancestry(h)};
   })};
  })};
}

// setViewportSize resolves before the page's resize listeners necessarily run.
// Wait for preview.fit's two outputs, never for successful hit tests.
export async function settledPreview(page, timeout=5000) {
 await page.waitForFunction(() => {
  const width=visualViewport?.width||innerWidth,height=visualViewport?.height||innerHeight;
  const k=Math.min(width/1280,height/720),stage=document.getElementById('stage'),rotate=document.getElementById('trpg-rotate');
  return Math.abs(width-innerWidth)<.1 && Math.abs(height-innerHeight)<.1 &&
   Math.abs(Number(stage.style.getPropertyValue('--k'))-k)<1e-9 &&
   Math.abs(stage.getBoundingClientRect().width-1280*k)<.1 &&
   rotate.hidden===!(matchMedia('(pointer:coarse)').matches&&height>width) &&
   (!document.querySelector('.trpg-roll-stage')||getComputedStyle(rotate).display==='none');
 },null,{polling:'raf',timeout});
}
