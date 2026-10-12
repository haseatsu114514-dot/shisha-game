import assert from 'node:assert/strict';
import { DOORS, FLOOR, project, unproject, constrain } from '../street/model.js';
for(const x of [-.98,0,.98]) for(const z of [0,.04,.4,FLOOR.depth]) {
  const p=project({x,z}), q=unproject(p.x,p.y);
  assert(Math.abs(q.x-x)<1e-9 && Math.abs(q.z-z)<1e-9, 'tap inverse must preserve the floor position');
}
for(const d of DOORS) {
  const q=project(constrain(unproject(...d.foot)));
  assert(Math.hypot(q.x-d.foot[0],q.y-d.foot[1])<.01, `${d.id}: door approach is outside the walkable floor`);
}
assert(project({x:0,z:1}).scale<project({x:0,z:.04}).scale, 'far character must be smaller');
assert(project({x:.98,z:1}).x<project({x:.98,z:.04}).x, 'walkable corridor narrows with depth');
assert(DOORS.find(d=>d.id==='kemurikusa').foot[1]<DOORS.find(d=>d.id==='cafe').foot[1], 'KEMURIKUSA stays at the district outskirts');
console.log('street_projection: tap inverse, 12 floor points, all 3 door approaches and depth scale PASS');
