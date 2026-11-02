// A solid hatchet viewed from behind the thrower: the cutting edge points along +Z.
// The polygons are projected from rigid 3D vertices, rather than rotating a side-view picture.
import { svg } from "../core/transition-kit.js";
import { AXE, AXE_SCALE, CAMERA, projectPoint, projectAxePoint, worldPoint, poseTransform } from "./axe-flight.js";
const faces = [];
const face = (id, vertices, color) => faces.push({ id, vertices, color });
const point = (x, y, z) => ({ x: x * AXE_SCALE, y: (y - 28) * AXE_SCALE, z: z * AXE_SCALE });
function box(id, front, back, color) {
  face(id + "-rear", [...back].reverse(), color);
  face(id + "-front", front, color);
  for (let i = 0; i < 4; i++) face(id + "-" + i, [back[i], back[(i + 1) % 4], front[(i + 1) % 4], front[i]], color);
}
const rectangle = (width, height, z) => [point(-width,-height,z),point(width,-height,z),point(width,height,z),point(-width,height,z)];
box("head", rectangle(10,22,24), rectangle(10,22,-42), [128,138,152]);
box("blade", rectangle(1,46,62), rectangle(10,22,24), [214,222,230]);
const rings = [[12,8,8,0],[145,7,7,-2],[188,10,8,-3]].map(([y,rx,rz,z]) =>
  Array.from({ length: 8 }, (_, i) => point(rx * Math.cos(i * Math.PI / 4), y, z + rz * Math.sin(i * Math.PI / 4))));
face("handle-top", rings[0], [170,106,50]);
face("handle-end", [...rings.at(-1)].reverse(), [218,164,94]);
for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 8; i++)
  face("handle-" + j + "-" + i, [rings[j][i],rings[j + 1][i],rings[j + 1][(i + 1) % 8],rings[j][(i + 1) % 8]], [176,112,55]);
function normal(points) {
  const n = { x: 0, y: 0, z: 0 };
  points.forEach((a, i) => { const b = points[(i + 1) % points.length];
    n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y);
  });
  const length = Math.hypot(n.x,n.y,n.z);
  return { x: n.x / length, y: n.y / length, z: n.z / length };
}
export function projectedAxe(pose) {
  const center = projectPoint(pose);
  const polygons = faces.map(f => {
    const world = f.vertices.map(p => worldPoint(pose,p));
    const middle = world.reduce((m,p) => ({ x:m.x+p.x/world.length, y:m.y+p.y/world.length, z:m.z+p.z/world.length }), {x:0,y:0,z:0});
    const n = normal(world), visible = n.x * -middle.x + n.y * -middle.y + n.z * (-CAMERA.focal - middle.z) > 0;
    const diffuse = Math.max(0, n.x * -.35 + n.y * -.6 + n.z * -.72);
    const light = .45 + .55 * diffuse;
    return { id:f.id, visible, depth:middle.z, fill:"rgb(" + f.color.map(c=>Math.round(c*light)).join(",") + ")",
      points:world.map(projectPoint).map(p=>({x:p.x-center.x,y:p.y-center.y})) };
  }).filter(p=>p.visible).sort((a,b)=>b.depth-a.depth);
  const blade = projectAxePoint(pose, AXE.blade);
  return { polygons, blade: {x:blade.x-center.x,y:blade.y-center.y} };
}
export function createAxe() { return svg("g", { "data-model": "first-person-3d" }); }
export function renderAxe(node, pose) {
  const {polygons,blade} = projectedAxe(pose);
  node.setAttribute("transform", poseTransform(pose)); node.setAttribute("data-pitch", pose.pitch); node.setAttribute("data-depth", pose.z);
  node.replaceChildren(...polygons.map(p=>svg("polygon", { "data-face":p.id,
    points:p.points.map(v=>v.x+","+v.y).join(" "), fill:p.fill, stroke:"#15171b", "stroke-width":1.1, "stroke-linejoin":"round" })),
    svg("circle", { class:"axe-cut-contact", cx:blade.x, cy:blade.y, r:.5, opacity:0 }));
}
