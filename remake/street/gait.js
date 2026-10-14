// 登録済みの立ち姿の服/靴を使い、脚だけを連続して動かす。
// コマごとの膝・腰・体格差や、同じ脚を繰り返し前へ出す切替を避ける。
const profiles = [
  { hips:[46,61], spread:1.5, depth:4, bend:1, parts:[[40,100,13,23,41,122,13,18,39,138,18,9],[55,100,13,23,55,122,13,18,53,138,18,9]] },
  { hips:[47,60], spread:10, depth:2.5, bend:1, parts:[[40,100,14,23,40,122,14,18,38,138,21,9],[53,100,14,23,54,122,14,18,52,138,24,9]] },
  { hips:[46,54], spread:17, depth:0, bend:-1, parts:[[38,100,14,23,38,122,14,18,36,138,23,9],[47,100,14,23,47,122,14,18,45,138,25,9]] },
  { hips:[47,60], spread:10, depth:-2.5, bend:-1, parts:[[40,100,14,23,40,122,14,18,38,138,22,9],[53,100,14,23,54,122,14,18,52,138,24,9]] },
  { hips:[46,61], spread:1.5, depth:-4, bend:-1, parts:[[40,100,13,23,41,122,13,18,39,138,18,9],[55,100,13,23,55,122,13,18,53,138,18,9]] },
];
export function legPose(phase, col, leg) {
  const p=profiles[col],t=((phase+leg*.5)%1+1)%1;
  // 半周期は接地して後ろへ、半周期は持ち上げて前へ戻る。
  const planted=t<.5,u=planted?t*2:(t-.5)*2;
  const stride=planted?1-2*u:-Math.cos(Math.PI*u);
  const lift=planted?0:Math.sin(Math.PI*u)*8;
  const hip={x:p.hips[leg],y:104};
  const ankle={x:hip.x+stride*p.spread,y:139+stride*p.depth-lift};
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y,length=Math.hypot(dx,dy);
  const half=Math.min(21,length/2),bend=Math.sqrt(Math.max(0,21*21-half*half));
  const bendDir=col===0||col===4?(leg===0?-1:1):1;
  const bendProjection=(col===0||col===4) ? .15 : col===2 ? 1 : .7;
  const knee={x:(hip.x+ankle.x)/2+bendDir*dy/length*bend*bendProjection,y:(hip.y+ankle.y)/2-bendDir*dx/length*bend*bendProjection};
  return {hip,knee,ankle,planted,parts:p.parts[leg]};
}
function bone(ctx,sprite,col,cw,ch,part,from,to) {
  const [sx,sy,w,h]=part,dx=to.x-from.x,dy=to.y-from.y;
  ctx.save();ctx.translate(from.x,from.y);ctx.rotate(Math.atan2(dy,dx)-Math.PI/2);
  ctx.drawImage(sprite,col*cw+sx,ch+sy,w,h,-w/2,-1,w,Math.hypot(dx,dy)+2);ctx.restore();
}
export function drawWalker(ctx,sprite,meta,col,phase,moving) {
  const [cw,ch]=meta.cell;
  if(!moving){ctx.drawImage(sprite,col*cw,ch,cw,ch,0,0,cw,ch);return;}
  for(const leg of [0,1]) {
    const {hip,knee,ankle,parts}=legPose(phase,col,leg);
    bone(ctx,sprite,col,cw,ch,parts.slice(0,4),hip,knee);
    bone(ctx,sprite,col,cw,ch,parts.slice(4,8),knee,ankle);
    const [sx,sy,w,h]=parts.slice(8);
    ctx.drawImage(sprite,col*cw+sx,ch+sy,w,h,ankle.x-w*.45,ankle.y-1,w,h);
  }
  // 腰の接合を同じ上半身で覆い、頭・胴の高さを固定する。
  ctx.drawImage(sprite,col*cw,ch,cw,108,0,0,cw,108);
}
