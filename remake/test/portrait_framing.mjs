// Exercise the production framing math against every classic/new manifest entry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const source = read('remake/js/vn/engine.js');
const constants = source.match(/const FRAMING = [^;]+;/)?.[0];
const start = source.indexOf('function frame(img, p)');
const end = source.indexOf('\nfunction layoutPortraits()', start);
assert.ok(constants && start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(`${constants}\n${source.slice(start, end)}\nthis.frame = frame; this.framing = FRAMING;`, context);
const render = p => {
  const style = {};
  Object.defineProperty(style, 'setProperty', { value(key, value) { this[key] = value; } });
  context.frame({ style }, p);
  const height = parseFloat(style.height) / 100;
  const bottom = parseFloat(style.bottom) / 100;
  return { style, height, bottom, top: 1 - bottom - (p.b + p.h) * height, body: p.h * height };
};
const manifest = JSON.parse(read('remake/data/manifest.json'));
const chars = Object.fromEntries(JSON.parse(read('data/characters.json')).map(c => [c.id, c]));
const data = await import('../js/core/data.js');
data.DB.manifest = manifest;
data.DB.characters = chars;
let checked = 0;
for (const [style, portraits] of [['classic', manifest.portraits], ['new', manifest.portraitVariants?.new || {}]]) {
  for (const [folder, metrics] of Object.entries(portraits)) {
    const scale = chars[folder]?.spriteScaleVariants?.[style] || chars[folder]?.spriteScale || 1;
    const p = { ...metrics, folder, scale };
    const result = render(p);
    const target = (folder === 'tetsuko' ? .34 : folder === 'pakki' ? .94 : 1.675) * scale;
    assert.ok(Math.abs(result.body - target) < 1e-9, `${style}/${folder}: body height/scale changed or hit image cap`);
    assert.ok(result.top >= .03 - 1e-9, `${style}/${folder}: head clipped`);
    assert.equal(result.style['--ax'], `${-metrics.ax * 100}%`, `${style}/${folder}: horizontal anchor changed`);
    for (const face of metrics.faces) {
      const resolved = data.portraitInfo(folder, face, style);
      assert.equal(resolved.face, face, `${style}/${folder}/${face}: expression changed`);
      assert.equal(resolved.style, style, `${style}/${folder}/${face}: wrong artwork style`);
      assert.deepEqual(render(resolved).style, result.style, `${style}/${folder}/${face}: resolved expression changes frame`);
      checked++;
    }
  }
}
const tsumugi = render({ ...manifest.portraitVariants.new.tsumugi, folder: 'tsumugi', scale: chars.tsumugi.spriteScaleVariants.new });
assert.ok(Math.abs(tsumugi.body * 720 - 1085.4583) < 1, 'reference full-body zoom must match within 1px');
assert.ok(Math.abs(tsumugi.top * 720 - 52.2516) < 1, 'reference head top must match within 1px');
for (const folder of ['pakki', 'tetsuko']) {
  const result = render({ ...manifest.portraits[folder], folder, scale: chars[folder]?.spriteScale || 1 });
  assert.ok(Math.abs((result.bottom + manifest.portraits[folder].b * result.height) - (folder === 'pakki' ? -.08 : .3)) < 1e-9, `${folder}: mascot/animal placement changed`);
}
// Canvas padding must not change the visible body's size, top or horizontal anchor.
const plain = render({ folder: 'test', scale: .9, h: .9, b: .02, ax: .48 });
const padded = render({ folder: 'test', scale: .9, h: .7, b: .12, ax: .48 });
assert.ok(Math.abs(plain.body - padded.body) < 1e-9 && Math.abs(plain.top - padded.top) < 1e-9);
// A raised prop reserves common headroom without shrinking the character.
const prop = render({ folder: 'test', scale: .9, h: .9, b: .02, ax: .48, topOverhang: .08 });
assert.equal(prop.body, plain.body);
assert.equal(prop.height, plain.height);
assert.ok(prop.top - .08 * prop.height >= .03 - 1e-9, 'raised prop clipped');
assert.ok(prop.top > plain.top, 'common prop headroom must shift down');
// Preserve the reporting tool's game-pixel measurements without changing icon proportions.
const reportTarget = Number(read('tools/portrait_metrics.py').match(/FRAMING_TARGET = ([\d.]+)/)?.[1]);
assert.equal(reportTarget, context.framing.target);
assert.equal(Number(read('tools/portrait_metrics.py').match(/CAT_TARGET = ([\d.]+)/)?.[1]), context.framing.catTarget);
assert.ok(read('tools/portrait_metrics.py').includes('CAT_TARGET if folder == "tetsuko"'));
assert.ok(source.includes('Math.max(0, contentTop - 97)'), 'retain tall-head safety');
console.log(`portrait_framing: ${checked} classic/new expression entries, reference zoom, padding, height scales and mascot placement passed`);

