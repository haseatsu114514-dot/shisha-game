import assert from 'node:assert/strict';
import { DOORS, FLOOR, SPAWN, CHARACTER_HEIGHT, WALK_SPEED, camera, moveOnFloor, toScreen, fromScreen, project, unproject, constrain } from '../street/model.js';
import { legPose } from '../street/gait.js';
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
for(const z of [.2,.5,.9])for(const [dx,dy] of [[1,0],[0,-1],[1,1],[-1,-1],[0,1]]) {
  let p={x:0,z},distance=0;
  for(let n=0;n<20;n++){const m=moveOnFloor(p,dx,dy,1/120);p=m.player;distance+=m.distance;}
  assert(Math.abs(distance-WALK_SPEED/6)<.3,'relative speed must stay equal at near/mid/far and diagonals');
}
for(let col=0;col<5;col++)for(let n=0;n<120;n++) {
  const a=legPose(n/120,col,0),b=legPose(n/120,col,1);
  assert.equal(a.planted,!b.planted,'legs must alternate contact and swing');
  assert.equal(a.hip.y,104);assert.equal(b.hip.y,104);
}
for(const d of DOORS) {
  const q=project(constrain(unproject(...d.foot)));
  assert(Math.hypot(q.x-d.foot[0],q.y-d.foot[1])<.01, `${d.id}: door approach is outside the walkable floor`);
  const ratio=CHARACTER_HEIGHT*q.scale/d.rect[3];
  assert(ratio>.8&&ratio<.9,`${d.id}: character height must fit the door at the approach`);
}
assert(project({x:0,z:1}).scale<project({x:0,z:.04}).scale, 'far character must be smaller');
assert(project({x:.98,z:1}).x<project({x:.98,z:.04}).x, 'walkable corridor narrows with depth');
assert(DOORS.find(d=>d.id==='kemurikusa').foot[1]<DOORS.find(d=>d.id==='cafe').foot[1], 'KEMURIKUSA stays at the district outskirts');
console.log('street_projection: inverses/edges, 400 monotonic camera steps, near/mid/far diagonal speeds, alternating planted/swing legs, 3 door ratios PASS');
