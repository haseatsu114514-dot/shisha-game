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
let checked = 0;
for (const [style, portraits] of [['classic', manifest.portraits], ...Object.entries(manifest.portraitVariants || {})]) {
  for (const [folder, metrics] of Object.entries(portraits)) {
    const scale = (style === 'new' && chars[folder]?.spriteScaleVariants?.new) || chars[folder]?.spriteScale || 1;
    const p = { ...metrics, folder, scale };
    const result = render(p);
    const target = (folder === 'tetsuko' ? .34 : folder === 'pakki' ? .94 : 1.675) * scale;
    assert.ok(Math.abs(result.body - target) < 1e-9, `${style}/${folder}: body height/scale changed or hit image cap`);
    assert.ok(result.top >= .03 - 1e-9, `${style}/${folder}: head clipped`);
    assert.equal(result.style['--ax'], `${-metrics.ax * 100}%`, `${style}/${folder}: horizontal anchor changed`);
    for (const face of metrics.faces) {
      assert.deepEqual(render(p).style, result.style, `${style}/${folder}/${face}: expression shifts`);
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
// Preserve the reporting tool's game-pixel measurements without changing icon proportions.
const reportTarget = Number(read('tools/portrait_metrics.py').match(/FRAMING_TARGET = ([\d.]+)/)?.[1]);
assert.equal(reportTarget, context.framing.target);
assert.ok(source.includes('Math.max(0, contentTop - 97)'), 'retain tall-head safety');
console.log(`portrait_framing: ${checked} classic/new expression entries, reference zoom, padding, height scales and mascot placement passed`);
