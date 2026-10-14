import assert from "node:assert/strict";
import test from "node:test";
import { RINGS, BULLS, KILLS, MODES, POWER, scoreAt, resolveThrow, gaugeAt, axisAt, swayAt, releaseAimAt, totalOf, gradeOf, canCall, killState } from "../js/minigames/axe-model.js";
import { reaction } from "../js/minigames/axe-companions.js";
import { TARGET, CAMERA, AXE, FLIGHT, flightPose, impactPose, projectAxePoint, worldPoint } from "../js/minigames/axe-flight.js";
import { projectedAxe } from "../js/minigames/axe-geometry.js";
const shot = (x = 0, y = 0, power = POWER.ideal, called = null, history = []) => resolveThrow({ x, y, power, called }, history);
test("painted circles match scores; black boundaries use lower neighbouring zones", () => {
  assert.deepEqual(RINGS.map(r => r.score), [6, 5, 4, 3, 2, 1]);
  for (const [radius, score] of [[0,6],[.1,6],[.10001,5],[.22999,5],[.23,4],[.4,3],[.62,2],[.8,1],[1,0]]) {
    assert.equal(scoreAt(radius, 0), score); assert.equal(scoreAt(0, radius), score);
  }
  for (const b of BULLS) { assert.equal(scoreAt(b.x,b.y),6); assert.equal(scoreAt(b.x + .1,b.y),5); }
});
test("three independently stopped gauges determine aim and strength deterministically", () => {
  assert.equal(axisAt(.5),0); assert.equal(axisAt(0),-1.08); assert.equal(axisAt(1),1.08);
  const input = Object.freeze({ x: 0, y: 0, power: .62 });
  assert.deepEqual(resolveThrow(input),resolveThrow(input)); assert.equal(resolveThrow(input).score,6);
  assert.equal(shot(1,1).score,0); assert.notEqual(shot(0,.105,.45).score,shot(0,.105,.7).score);
  assert.notEqual(shot(0,0,.45).rotation,shot(0,0,.7).rotation);
});
test("underpowered and overrotated axes drop rather than earning center points", () => {
  for (const [power,reason] of [[0,"weak"],[.41999,"weak"],[.82001,"rotation"],[1,"rotation"]]) {
    const r=shot(0,0,power); assert.equal(r.score,0); assert(!r.stuck); assert.equal(r.dropReason,reason);
  }
  for (const power of [.42,.54,.62,.70,.82]) assert(shot(0,0,power).stuck);
});
test("called Killshot inner 8 / outer 7, misses zero; uncalled blue is an ordinary ring", () => {
  for (const k of KILLS) {
    assert.equal(shot(k.x,k.y,.62,k.id).score,8);
    assert.equal(shot(k.x + .07,k.y,.62,k.id).score,7);
    assert.equal(shot(0,0,.62,k.id).score,0);
    assert.equal(shot(k.x,k.y).score,1);
    assert.equal(shot(k.x,k.y,.1,k.id).score,0);
  }
});
test("successful Killshot closes both at its height, persists across half; calls consumed by misses and drops", () => {
  const upper=KILLS[0], lower=KILLS[2], history=[shot(upper.x,upper.y,.62,upper.id)];
  assert.deepEqual(killState(history),{remaining:1,closed:["upper"]});
  assert(!canCall(KILLS[1].id,history)); assert(canCall(lower.id,history));
  history.push(...Array.from({length:4},()=>shot())); assert(!canCall(upper.id,history));
  history.push(shot(lower.x,lower.y,.62,lower.id,history)); assert.equal(killState(history).remaining,0);
  assert.throws(()=>shot(0,0,.62,upper.id,history),RangeError);
  const missed=[shot(0,0,.62,upper.id),shot(0,0,.1,lower.id)];
  assert.deepEqual(killState(missed),{remaining:0,closed:[]}); assert(!canCall(upper.id,missed));
});
test("3 and 10 throw maximums include two different-height Killshots, without invented rewards", () => {
  const a=KILLS[0],b=KILLS[2], history=[shot(a.x,a.y,.62,a.id)]; history.push(shot(b.x,b.y,.62,b.id,history));
  assert.equal(totalOf([...history,shot()]),MODES.practice.max);
  assert.equal(totalOf([...history,...Array.from({length:8},()=>shot())]),MODES.league.max);
  assert.equal(MODES.league.throws,10); assert.equal(gradeOf(45,64),"great"); assert.equal(gradeOf(20,64),"again");
});
test("horizontal, vertical and strength gauges traverse both directions", () => {
  for (const cycle of [3200,3600,2400]) for (const [fraction,value] of [[0,0],[.25,.5],[.5,1],[.75,.5],[1,0]])
    assert.equal(gaugeAt(cycle*fraction,cycle),value);
});
test("companion reacts to actual result, with canonical voice and distinct expressions", () => {
  for (const id of ["hiyori","shark"]) {
    assert.notEqual(reaction(id,"choice",[],null).text,reaction(id,"choice",[],KILLS[0].id).text);
    for (const outcome of ["bull","hit","killshot","killshot-miss","miss","drop"])
      assert.equal(typeof reaction(id,"result",[{outcome}],null).text,"string");
    assert.notEqual(reaction(id,"result",[{outcome:"bull"}],null).face,reaction(id,"result",[{outcome:"drop"}],null).face);
  }
  assert.match(reaction("shark","summary",[],null).text,/お主/);
  assert.doesNotMatch(reaction("shark","summary",[],null).text,/波多野|なぎさ|泳/);
});
test("invalid input cannot produce NaN or illegally call a closed target", () => {
  for (const input of [{x:NaN,y:0,power:.6},{x:0,y:Infinity,power:.6},{x:0,y:0,power:2},{x:2,y:0,power:.6},{x:0,y:0,power:.6,called:"fake"}])
    assert.throws(()=>resolveThrow(input),RangeError);
  assert.throws(()=>scoreAt(NaN,0),RangeError); assert.throws(()=>gaugeAt(0,0),RangeError);
});
test("waiting and overgripping increase visible sway; focus genuinely reduces it", () => {
  assert(swayAt(9000).amplitude > swayAt(1000).amplitude * 2);
  assert(swayAt(9000,.8).amplitude > swayAt(9000,.62).amplitude);
  const normal=swayAt(9000,.62,2),focused=swayAt(9000,.62,2,true);
  assert(Math.hypot(focused.x,focused.y) < Math.hypot(normal.x,normal.y) / 4);
  assert.deepEqual(swayAt(9000,.62,2),normal,"Replay uses the same visible movement, without hidden random error");
  assert.notDeepEqual(swayAt(9000,.62,3),normal,"Each throw has its own visible rhythm");
});
test("a locked center is no longer an automatic bull; timely focus restores precision", () => {
  let misses=0;
  for(let ms=3500;ms<9000;ms+=100){
    const input={x:0,y:0}, moving=releaseAimAt(input,ms,.62,0,false),steady=releaseAimAt(input,ms,.62,0,true);
    if(resolveThrow({...moving,power:.62}).score<6)misses++;
    assert.equal(resolveThrow({...steady,power:.62}).score,6);
    assert.deepEqual(input,{x:0,y:0},"Sway does not move the player's locked aim");
  }
  assert(misses>10,"Holding still on the gauge must require reading the moving blade");
});
test("visible release positions remain finite and legal at the edges", () => {
  for(const x of [-1.08,1.08])for(const y of [-1.08,1.08])for(const power of [0,.62,1]){
    const aim=releaseAimAt({x,y},8000,power,9,false);
    assert(Math.abs(aim.x)<=1.08&&Math.abs(aim.y)<=1.08);assert(Number.isFinite(resolveThrow({...aim,power}).score));
  }
  assert.throws(()=>swayAt(-1),RangeError);assert.throws(()=>swayAt(1,.62,.5),RangeError);
  assert.throws(()=>releaseAimAt({x:2,y:0},1,.62,0,false),RangeError);
});
test("flight shrinks toward the board and contacts the scored blade point without a pose jump", () => {
  for (const x of [-1.08,0,1.08]) for (const y of [-1.08,0,1.08]) for (const power of [.42,.62,.82]) {
    const result=shot(x,y,power),end=impactPose(result),arrival=flightPose(result,FLIGHT.travel);
    assert.equal(arrival.x,end.x); assert(Math.abs(arrival.y-end.y)<1e-9);
    assert.equal(arrival.pitch,end.pitch); assert.equal(arrival.scale,end.scale);
    assert(Math.abs(arrival.bladeX-(TARGET.x+result.landing.x*TARGET.radius))<1e-9);
    assert(Math.abs(arrival.bladeY-(TARGET.y+result.landing.y*TARGET.radius))<1e-9);
    assert(arrival.done); const first=flightPose(result,0);
    for(let ms=0;ms<=FLIGHT.travel;ms+=40){const pose=flightPose(result,ms);
      assert(pose.scale<=first.scale&&pose.scale>=end.scale);
      assert(pose.z>=first.z&&pose.z<=end.z,"The axe travels toward the board in depth");
    }
  }
  assert(AXE.blade.y!==0||AXE.blade.z!==0,"Spin pivot must differ from cutting edge");
});
test("first-person forward tumble shortens the handle, reverses it, then embeds the front cutting edge", () => {
  const result=shot(),poses=[0,.25,.5,.75,1].map(t=>flightPose(result,FLIGHT.travel*t));
  const length=pose=>projectAxePoint(pose,AXE.handleTip).y-projectAxePoint(pose,AXE.blade).y;
  assert(poses[0].pixelY<TARGET.y&&poses[0].pixelX>TARGET.x,"Release begins above/right of the player's eyes");
  assert(length(poses[0])>0&&length(poses[2])<0&&length(poses[4])>0,"Handle tips toward/away from the viewer, rather than rolling sideways");
  assert(Math.abs(length(poses[1]))<Math.abs(length(poses[0]))/2,"Quarter-turn is foreshortened");
  assert(worldPoint(poses[1],AXE.handleTip).z<poses[1].z,"Forward pitch brings the handle butt toward the camera");
  assert(Math.abs(worldPoint(poses[4],AXE.blade).z-CAMERA.boardDepth)<1e-9,"The forward-facing cutting edge reaches the board plane");
});
test("frontal mesh swaps visible steel/wood faces during the pitch and keeps depth ordering", () => {
  const poses=[0,.25,.5,.75,1].map(t=>flightPose(shot(),FLIGHT.travel*t));
  const seen=poses.map(p=>projectedAxe(p).polygons.map(f=>f.id));
  assert(seen[0].includes('head-rear')&&!seen[0].includes('blade-front'),'Initial view sees the axe spine, not the broad side picture');
  assert(seen[1].includes('handle-end'),'Quarter-turn looks along the wooden handle');
  assert(seen[2].includes('blade-front'),'Half-turn exposes the cutting face');
  for(const pose of poses){const {polygons}=projectedAxe(pose);assert(polygons.length>0);
    polygons.forEach((f,i)=>{assert(f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));if(i)assert(polygons[i-1].depth>=f.depth);});
  }
});
test("missed rotation visibly falls after contact; stuck axes keep their final pose", () => {
  for(const power of [.1,.95]){const result=shot(0,0,power),contact=flightPose(result,FLIGHT.travel);
    assert(contact.contact&&!contact.done);const falling=flightPose(result,FLIGHT.travel+FLIGHT.fall/2);
    assert(falling.y>contact.y&&falling.opacity>0&&falling.opacity<1);
    const gone=flightPose(result,FLIGHT.travel+FLIGHT.fall);assert(gone.done&&gone.opacity===0);
    assert.equal(result.score,0);
  }
  const result=shot();assert.deepEqual(flightPose(result,FLIGHT.travel),flightPose(result,FLIGHT.travel+FLIGHT.fall));
});
