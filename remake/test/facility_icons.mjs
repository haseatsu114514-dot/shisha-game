import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { FACILITY_ICONS, FACILITY_ICON_SIZES, FACILITY_SHEET, FACILITY_EXTRA_SHEET, hasFacilityIcon, facilityIconLayout } from '../js/daily/facility-icons.js';

const source = new URL('../../asset_sources/store-logos/ch1-issue470/ingame-qa/pin-cutout-546/facilities-source.png', import.meta.url);
const bytes = fs.readFileSync(source);
const published = new URL('../../assets/ui/map-facilities-579.webp', import.meta.url);
assert.equal(FACILITY_SHEET, published.href);
const master = new URL('../../assets/ui/map-facilities-579.png', import.meta.url);
const copy = fs.readFileSync(master);
assert.deepEqual(copy, bytes, 'Published sheet must remain byte-identical to the original');
for (const data of [bytes, copy]) {
  assert.equal(createHash('sha256').update(data).digest('hex'), '7289b74ffe67290a444f2e6e95dee7be209ec31ae33d31cd26b39903ed51a284');
  assert.equal(createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex'), '76fea0c4c5d0fd46364b9ed5df5fa0826d11eda4');
}
assert.deepEqual(Object.entries(FACILITY_ICONS).map(([id, { label }]) => [id, label]),
  [['rojiura_cinema', '路地裏シネマ'], ['kannondo', '観音堂'], ['home', '自宅'], ['kohaku', '喫茶こはく'], ['axe_bar', '斧投げBar'],
    ['choizap', 'CHOI-ZAP'], ['fortune', '路上占い'], ['trpg_bar', 'ボドゲカフェ']]);
for (const id of ['kannon', 'rest', 'cafe', 'rojiura_cinema', 'axe_bar', 'choizap', 'fortune', 'trpg_bar']) assert(hasFacilityIcon(id));
for (const id of ['tonari', 'naru', 'adam', 'minto', 'shop', 'c_station', '__proto__']) assert(!hasFacilityIcon(id), 'Store logos must keep their own role');
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
const entries = Object.values(FACILITY_ICONS).filter(entry => !entry.extra && !entry.src);
for (const [index, entry] of entries.entries()) {
  const [x, y, w, h] = entry.rect, [left, top, right, bottom] = observed.bounds[index];
  assert(x <= left - 2 && y <= top - 2 && x + w >= right + 2 && y + h >= bottom + 2, 'Source art clipped');
  assert(x >= 0 && y >= 0 && x + w <= 2172 && y + h <= 724);
  for (const [other, bounds] of observed.bounds.entries()) {
    if (other !== index) assert(x + w <= bounds[0] || x >= bounds[2], 'Neighbor art leaks into crop');
  }
}
const extraAnalysis = spawnSync('python3', ['-c', `
from PIL import Image
import json,sys
source=Image.open(sys.argv[1]); runtime=Image.open(sys.argv[2]); assert source.size==runtime.size==(1536,1024)
assert source.getchannel('A').tobytes()==runtime.getchannel('A').tobytes(), 'alpha changed in WebP encoding'
a=runtime.getchannel('A'); bounds=[]
for x,y,right,bottom in [(0,0,768,512),(768,0,1536,512),(0,512,768,1024),(768,512,1536,1024)]:
 b=a.crop((x,y,right,bottom)).point(lambda v:255 if v>2 else 0).getbbox(); bounds.append([b[0]+x,b[1]+y,b[2]+x,b[3]+y])
for p in [(0,0),(767,511),(1535,1023)]: assert a.getpixel(p)<=2, 'opaque square backing'
print(json.dumps(bounds))
`, new URL('../../asset_sources/map-facilities-579/generated.png', import.meta.url).pathname,
new URL('../../assets/ui/map-facilities-extra-579.webp', import.meta.url).pathname], { encoding: 'utf8' });
assert.equal(extraAnalysis.status, 0, extraAnalysis.stderr);
const extraBounds = JSON.parse(extraAnalysis.stdout);
assert.deepEqual(extraBounds, [[58,16,709,507], [846,51,1475,506], [83,515,711,1007], [823,514,1483,1004]]);
for (const [index, entry] of Object.values(FACILITY_ICONS).filter(e => e.extra).entries()) {
  const [x,y,w,h] = entry.rect, [left,top,right,bottom] = extraBounds[index];
  assert(x <= left - 2 && y <= top - 2 && x+w >= right + 2 && y+h >= bottom + 2, 'Supplement clipped');
  for (const [other,b] of extraBounds.entries()) if (other !== index) assert(x+w <= b[0] || x >= b[2] || y+h <= b[1] || y >= b[3], 'Supplement neighbor leaks');
}
assert(fs.statSync(new URL('../../assets/ui/map-facilities-extra-579.webp', import.meta.url)).size < 512000);
// A transparent rectangular corner is not a valid event attachment point.
const anchors = spawnSync('python3', ['-c', `
from PIL import Image
import json,sys
sheets=[Image.open(p).getchannel('A') for p in sys.argv[1:4]]
for entry in json.loads(sys.argv[4]).values():
 a=sheets[2 if entry.get('src') else (1 if entry.get('extra') else 0)]; x,y=entry['badge']; left,top,w,h=entry['rect']
 assert left<=x<left+w and top<=y<top+h
 assert a.getpixel((x,y))>=128, 'event anchor is transparent'
 assert all(a.getpixel((xx,y))<128 for xx in range(x+1,left+w)), 'anchor is inside the artwork rather than at its right contour'
`, new URL('../../assets/ui/map-facilities-579.png', import.meta.url).pathname,
new URL('../../assets/ui/map-facilities-extra-579.webp', import.meta.url).pathname,
new URL('../../assets/ui/map-rojiura-cinema.webp', import.meta.url).pathname,
JSON.stringify(FACILITY_ICONS)], { encoding: 'utf8' });
assert.equal(anchors.status, 0, anchors.stderr);
for (const id of Object.keys(FACILITY_ICONS)) for (const size of FACILITY_ICON_SIZES) {
  const entry = FACILITY_ICONS[id], l = facilityIconLayout(id, size), [x, y, w, h] = entry.rect;
  const [sw,sh] = entry.sheetSize || (entry.extra ? [1536,1024] : [2172,724]);
  assert(Math.abs(Math.max(l.width, l.height) - size) < 1e-10);
  assert(Math.abs(l.width / l.height - w / h) < 1e-10, 'Distorted aspect');
  assert(Math.abs(-l.left / l.sheetWidth * sw - x) < 1e-10);
  assert(Math.abs(-l.top / l.sheetHeight * sh - y) < 1e-10);
  assert.equal(l.src, entry.src || (entry.extra ? FACILITY_EXTRA_SHEET : FACILITY_SHEET));
}
for (const id of ['missing', '__proto__', 'constructor']) assert.throws(() => facilityIconLayout(id), RangeError);
for (const size of [0, -1, NaN, Infinity, '48', 33]) assert.throws(() => facilityIconLayout('home', size), RangeError);
console.log('PASS: original/published byte equality and blob/hash, facility mapping, alpha bounds, neighbor exclusion, layout and invalid inputs');
