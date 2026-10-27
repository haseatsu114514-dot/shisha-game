import assert from 'node:assert/strict';
import { DOORS, FLOOR, SPAWN, CHARACTER_HEIGHT, WALK_SPEED, RUN_SPEED, SIDE_SPEED, DEPTH_SPEED, camera, moveOnFloor, walkingPoint, toScreen, fromScreen, project, unproject, constrain } from '../street/model.js';
import { drawWalker, walkerFrame } from '../street/gait.js';
for(const x of [-.98,0,.98]) for(const z of [0,.04,.4,FLOOR.depth]) {
  const p=project({x,z}), q=unproject(p.x,p.y);
  assert(Math.abs(q.x-x)<1e-9 && Math.abs(q.z-z)<1e-9, 'tap inverse must preserve the floor position');
  const cam=camera({x,z}),screen=toScreen(p.x,p.y,cam),back=fromScreen(screen.x,screen.y,cam);
  assert(Math.hypot(back.x-p.x,back.y-p.y)<1e-9,'following camera must preserve the tap inverse');
  assert(CHARACTER_HEIGHT*p.scale*cam.zoom>=90,'character must remain readable at maximum depth');
  const vanishing=toScreen(FLOOR.cx,FLOOR.horizon,cam);
  assert(Math.abs(vanishing.x-FLOOR.cx)<1e-9&&Math.abs(vanishing.y-FLOOR.horizon)<1e-9,
    'camera must not pull the vanishing point towards the player');
  assert(cam.tx<=0&&cam.ty<=0&&cam.tx+1280*cam.zoom>=1280&&cam.ty+720*cam.zoom>=720,
    'camera must not expose an empty image edge');
}
let previousHeight=Infinity;
for(let n=1;n<=400;n++) {
  const p={x:0,z:n/400*FLOOR.depth},height=CHARACTER_HEIGHT*project(p).scale*camera(p).zoom;
  assert(height<=previousHeight,'actor must never grow when walking away');
  assert(height>=90,'far actor must remain readable');previousHeight=height;
}
for(const z of [.04,.2,.5,.9])for(const [dx,dy] of [[1,0],[0,-1],[1,1],[-1,-1],[0,1]])for(const run of [false,true]) {
  const start={x:0,z},before=walkingPoint(start),m=moveOnFloor(start,dx,dy,1/120,run),after=walkingPoint(m.player);
  const apparent=Math.hypot(after.x-before.x,after.y-before.y)/((before.scale+after.scale)/2);
  const length=Math.hypot(dx,dy),nx=dx/length,ny=dy/length;
  const expected=(run?RUN_SPEED:WALK_SPEED)/Math.hypot(nx/SIDE_SPEED,ny/DEPTH_SPEED)/120;
  assert(Math.abs(apparent-expected)<.03,
    `actor-relative screen speed must match the direction at z=${z}, run=${run}`);
  assert(Math.abs(m.distance-(run?RUN_SPEED:WALK_SPEED)/120)<.04,
    'walk-cycle cadence must remain consistent across directions');
  assert(Math.abs((after.x-before.x)*ny-(after.y-before.y)*nx)<.0001,
    'walking must preserve the requested screen direction');
}
function timeToEdge(start,dx,dy,run=false) {
  let player={...start};
  for(let tick=1;tick<1200;tick++) {
    player=moveOnFloor(player,dx,dy,1/120,run).player;
    if(Math.abs(player.x)>=.98-1e-8||player.z<=1e-8||player.z>=FLOOR.depth-1e-8)return tick/120;
  }
  throw Error('walker never reached the corridor edge');
}
const upTime=timeToEdge(SPAWN,0,-1),sideTime=timeToEdge(SPAWN,1,0);
assert(upTime>1.1&&upTime<1.25&&sideTime>=.975&&sideTime<=1.025,
  `sideways walking must reach the edge in about 1s while depth keeps its pace: ${upTime}, ${sideTime}`);
console.log(`street_projection: center-to-edge walk ${sideTime.toFixed(3)}s, depth ${upTime.toFixed(3)}s`);
for(const [dx,dy] of [[0,-1],[1,0]]) {
  const walk=timeToEdge(SPAWN,dx,dy),run=timeToEdge(SPAWN,dx,dy,true);
  assert(Math.abs(run/walk-WALK_SPEED/RUN_SPEED)<.02,'dash must speed up either direction consistently');
}
assert.equal(walkerFrame(0,false),1,'idle must use the standing sprite');
assert.deepEqual([0,.25,.5,.75].map(phase=>walkerFrame(phase,true)),[1,2,3,0],
  'walking must cycle through all four source poses');
const spriteRows=[];
const drawContext={drawImage:(_sprite,_sx,sy,_sw,_sh,_dx,_dy,_dw,_dh)=>spriteRows.push(sy)};
for(const phase of [0,.25,.5,.75]) drawWalker(drawContext,{}, {cell:[108,148]},2,phase,true);
assert.deepEqual(spriteRows,[148,296,444,0], 'walking must draw each complete source frame');
for(const d of DOORS) {
  const q=project(constrain(unproject(...d.foot)));
  assert(Math.hypot(q.x-d.foot[0],q.y-d.foot[1])<.01, `${d.id}: door approach is outside the walkable floor`);
  const ratio=CHARACTER_HEIGHT*q.scale/d.rect[3];
  assert(ratio>.8&&ratio<.9,`${d.id}: character height must fit the door at the approach`);
  for (const run of [false,true]) for (const dt of [1/120,1/30]) {
    let player={...SPAWN},arrived=false;
    for(let n=0;n<600&&!arrived;n++) {
      const here=walkingPoint(player),there=walkingPoint(unproject(...d.foot));
      const moved=moveOnFloor(player,there.x-here.x,there.y-here.y,dt,run,{x:d.foot[0],y:d.foot[1]});
      player=moved.player;arrived=moved.arrived;
    }
    assert(arrived&&Math.hypot(project(player).x-d.foot[0],project(player).y-d.foot[1])<.01,
      `${d.id}: movement must reach the tapped entrance exactly (run=${run}, dt=${dt})`);
  }
  // 30fpsのダッシュでも入口の決定キーを受け付ける区間が複数フレーム残る。
  const goal=project(unproject(...d.foot));
  let player=unproject(goal.x-100*goal.scale,goal.y),selectable=0;
  for(let n=0;n<20;n++) {
    const p=project(player);
    if(Math.hypot(p.x-goal.x,p.y-goal.y)<Math.max(12,55*p.scale))selectable++;
    player=moveOnFloor(player,1,0,1/30,true).player;
  }
  assert(selectable>=2,`${d.id}: dash must leave time to select the entrance`);
}
for(const [player,dx,dy] of [[{x:.98,z:.5},1,0],[{x:-.98,z:.5},-1,0],[{x:0,z:0},0,1],[{x:0,z:FLOOR.depth},0,-1]]) {
  const moved=moveOnFloor(player,dx,dy,1/60);
  assert(moved.distance<1e-6&&Math.hypot(moved.player.x-player.x,moved.player.z-player.z)<1e-6,
    'walking into a corridor edge must stop');
}
assert(project({x:0,z:1}).scale<project({x:0,z:.04}).scale, 'far character must be smaller');
assert(project({x:.98,z:1}).x<project({x:.98,z:.04}).x, 'walkable corridor narrows with depth');
assert(DOORS.find(d=>d.id==='kemurikusa').foot[1]<DOORS.find(d=>d.id==='cafe').foot[1], 'KEMURIKUSA stays at the district outskirts');
console.log('street_projection: inverses/edges, 400 monotonic camera steps, direction-preserving walk/dash and edge times, 4 sprite poses, 3 tap targets PASS');
