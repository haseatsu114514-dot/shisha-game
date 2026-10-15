import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { FACILITY_ICONS, FACILITY_ICON_SIZES, FACILITY_SHEET, facilityIconLayout } from '../js/daily/facility-icons.js';

const source = new URL(FACILITY_SHEET);
const bytes = fs.readFileSync(source);
assert.equal(createHash('sha256').update(bytes).digest('hex'), '7289b74ffe67290a444f2e6e95dee7be209ec31ae33d31cd26b39903ed51a284');
assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), '76fea0c4c5d0fd46364b9ed5df5fa0826d11eda4');
assert.deepEqual(Object.entries(FACILITY_ICONS).map(([id, { label }]) => [id, label]),
  [['kannondo', '観音堂'], ['home', '自宅'], ['kohaku', '喫茶こはく']]);
// Inspect source alpha independently of layout math; a mistaken equal-third crop fails here.
const analysis = spawnSync('python3', ['-c', `
from PIL import Image
from collections import Counter
import json,sys
im=Image.open(sys.argv[1]); assert im.size==(2172,724) and im.mode=='RGBA'
a=im.getchannel('A'); bounds=[]
for lo,hi in [(0,839),(839,1528),(1528,2172)]:
 b=a.crop((lo,0,hi,724)).point(lambda v:255 if v>2 else 0).getbbox()
 bounds.append([b[0]+lo,b[1],b[2]+lo,b[3]])
c=Counter(a.get_flattened_data() if hasattr(a,'get_flattened_data') else a.getdata())
print(json.dumps({'bounds':bounds,'alpha252':c[252],'alpha253':c[253]}))
`, source.pathname], { encoding: 'utf8' });
assert.equal(analysis.status, 0, analysis.stderr);
const observed = JSON.parse(analysis.stdout);
assert.deepEqual(observed.bounds, [[23, 89, 834, 646], [844, 127, 1503, 679], [1554, 106, 2118, 641]]);
assert.equal(observed.alpha252, 188024); assert.equal(observed.alpha253, 476313);
const entries = Object.values(FACILITY_ICONS);
for (const [index, entry] of entries.entries()) {
  const [x, y, w, h] = entry.rect, [left, top, right, bottom] = observed.bounds[index];
  assert(x <= left - 2 && y <= top - 2 && x + w >= right + 2 && y + h >= bottom + 2, 'Source art clipped');
  assert(x >= 0 && y >= 0 && x + w <= 2172 && y + h <= 724);
  for (const [other, bounds] of observed.bounds.entries()) {
    if (other !== index) assert(x + w <= bounds[0] || x >= bounds[2], 'Neighbor art leaks into crop');
  }
}
for (const id of Object.keys(FACILITY_ICONS)) for (const size of FACILITY_ICON_SIZES) {
  const l = facilityIconLayout(id, size), [x, y, w, h] = FACILITY_ICONS[id].rect;
  assert(Math.abs(Math.max(l.width, l.height) - size) < 1e-10);
  assert(Math.abs(l.width / l.height - w / h) < 1e-10, 'Distorted aspect');
  assert(Math.abs(-l.left / l.sheetWidth * 2172 - x) < 1e-10);
  assert(Math.abs(-l.top / l.sheetHeight * 724 - y) < 1e-10);
}
for (const id of ['missing', '__proto__', 'constructor']) assert.throws(() => facilityIconLayout(id), RangeError);
for (const size of [0, -1, NaN, Infinity, '48', 33]) assert.throws(() => facilityIconLayout('home', size), RangeError);
console.log('PASS: original blob/hash, facility mapping, alpha bounds, neighbor exclusion, layout and invalid inputs');
