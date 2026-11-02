// Production logo/DOM helpers with native error events; layout is checked in store_logo_layout.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = {};
    const classes = new Set();
    this.classList = { add: name => classes.add(name), contains: name => classes.has(name) };
    this.style = { setProperty(key, value) { this[key] = value; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  dispatchEvent(event) { this.handlers[event.type]?.(event); }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(node => node.textContent).join(''); }
}
const context = vm.createContext({ Node: Element, URL, Event,
  document: { createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('#text'), { textContent: text }) },
});
const moduleFor = path => new vm.SourceTextModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
  context, initializeImportMeta(meta) { meta.url = new URL(path, import.meta.url).href; },
});
const util = moduleFor('../js/core/util.js');
await util.link(() => { throw new Error('Unexpected util dependency'); });
await util.evaluate();
const logos = moduleFor('../js/core/store-logos.js');
await logos.link(specifier => { assert.equal(specifier, './util.js'); return util; });
await logos.evaluate();
const { storeLogo, STORE_LOGOS } = logos.namespace;

for (const [id, width, height] of [['c_station', 82, 46], ['ch2_c_station', 68, 42], ['ch3_volk', 82, 46]]) {
  const node = storeLogo(id, { width, height }), image = node.children[0], logo = STORE_LOGOS[id];
  const scale = Math.min(width / logo.frame[2], height / logo.frame[3]);
  assert.equal(node.style.width, `${logo.frame[2] * scale}px`, `${id}: normal image keeps its aspect ratio`);
  assert.equal(node.style.height, `${logo.frame[3] * scale}px`);
  assert.equal(image.tagName, 'IMG');
  assert.equal(image.attrs.src, logos.namespace.storeLogoUrl(id));
  assert.equal(image.attrs.alt, '');
  assert.equal(node.textContent, '', 'Pending/loaded logos do not render a duplicate name');
  assert.equal(node.classList.contains('missing'), false);
  const accessibleName = node.attrs['aria-label'];
  image.dispatchEvent(new Event('error'));
  assert.equal(node.classList.contains('missing'), true);
  assert.equal(node.children.length, 1);
  assert.equal(node.children[0].tagName, 'SPAN');
  assert.equal(node.textContent, logo.name, `${id}: the full adopted name survives image failure`);
  assert.equal(node.attrs['aria-label'], accessibleName, 'Fallback preserves the accessible name');
  assert.equal(node.style.width, `${width}px`, `${id}: text uses the available frame, not the narrow image crop`);
  assert.equal(node.style.height, `${height}px`);
  console.log(`PASS store-logo fallback: ${id}, full text in ${width}x${height} frame`);
}
assert.equal(storeLogo('unknown'), null);
