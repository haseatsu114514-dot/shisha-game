import assert from 'node:assert/strict';
import { wordCutGeometry } from '../js/craft/steam-slash.js';
const area = polygon => Math.abs(polygon.reduce((sum,[x,y],i) => {
  const [nx,ny]=polygon[(i+1)%polygon.length];return sum+x*ny-nx*y;
},0))/2;
for(const [w,h] of [[28,28],[180,30],[300,24]]) for(const x of [-90,-40,40]) {
  const b={x,y:-85,w,h};
  for(const rotation of [0,Math.PI/6,-Math.PI/3,Math.PI/2]) {
    const {normal,halves}=wordCutGeometry(b,0,0,-Math.PI/2,100,rotation);
    assert(Math.abs(Math.hypot(normal.x,normal.y)-1)<1e-9);
    assert.equal(halves.length,2);
    for(const polygon of halves) {
      assert(polygon.length>=3);
      assert(polygon.every(([x,y])=>x>=-1e-7&&x<=w+1e-7&&y>=-1e-7&&y<=h+1e-7));
      assert(Math.abs(area(polygon)-w*h/2)<1e-7,'Neither word half may be lost or duplicated');
    }
    assert(Math.abs(area(halves[0])+area(halves[1])-w*h)<1e-7);
  }
}
const left=wordCutGeometry({x:-80,y:-80,w:60,h:28},0,0,-Math.PI/2).normal;
const right=wordCutGeometry({x:20,y:-80,w:60,h:28},0,0,-Math.PI/2).normal;
assert(Math.abs(left.x*right.x+left.y*right.y)<.95,'Different parts of the curved stroke need different cut directions');
const quarter=wordCutGeometry({x:-80,y:-80,w:60,h:28},0,0,-Math.PI/2,80,Math.PI/2).normal;
assert(Math.abs(quarter.x-left.y)<1e-8&&Math.abs(quarter.y+left.x)<1e-8,'Rotated words must use the same world-space cut direction');
console.log('[word cut] PASS: curved-stroke direction, rotated words, complete complementary halves and bounded clips');
