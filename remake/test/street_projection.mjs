import assert from 'node:assert/strict';
import { DOORS, FLOOR, CHARACTER_HEIGHT, camera, toScreen, fromScreen, project, unproject, constrain } from '../street/model.js';
for(const x of [-.98,0,.98]) for(const z of [0,.04,.4,FLOOR.depth]) {
  const p=project({x,z}), q=unproject(p.x,p.y);
  assert(Math.abs(q.x-x)<1e-9 && Math.abs(q.z-z)<1e-9, 'tap inverse must preserve the floor position');
  const cam=camera({x,z}),screen=toScreen(p.x,p.y,cam),back=fromScreen(screen.x,screen.y,cam);
  assert(Math.hypot(back.x-p.x,back.y-p.y)<1e-9,'following camera must preserve the tap inverse');
  assert(CHARACTER_HEIGHT*p.scale*cam.zoom>=90,'character must remain readable at maximum depth');
  assert(cam.tx<=0&&cam.ty<=0&&cam.tx+1280*cam.zoom>=1280&&cam.ty+720*cam.zoom>=720,
    'camera must not expose an empty image edge');
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
console.log('street_projection: 12 floor/camera inverses, image edges, readable actor, all 3 door height ratios PASS');
