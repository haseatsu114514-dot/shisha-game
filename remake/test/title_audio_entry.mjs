// Device-free regression: production audio/title modules, controlled browser boundaries.
// node --experimental-vm-modules remake/test/title_audio_entry.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const read = path => fs.readFile(new URL(path, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function load(code, values, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  // Static imports and destructured dynamic imports share the same value mocks.
  const namesFor = spec => [...new Set([
    ...[...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(m => m[2] === spec),
    ...[...code.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*await\s+import\s*\(\s*["']([^"']+)["']\s*\)/g)].filter(m => m[2] === spec),
  ].flatMap(m => m[1].split(",").map(n => n.trim())))];
  const synthetic = spec => {
    const names = namesFor(spec);
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => {}));
    }, { context });
  };
  const mod = new vm.SourceTextModule(code, { context, importModuleDynamically: async spec => {
    const dep = synthetic(spec);
    await dep.link(() => { throw new Error(`unexpected nested import from ${spec}`); });
    await dep.evaluate();
    return dep;
  } });
  await mod.link(spec => synthetic(spec));
  await mod.evaluate();
  return mod.namespace;
}
const audioCode = await read("../js/core/audio.js");
async function audioFixture() {
  const media = [], frames = [], resumes = [];
  let ctx, now = 0, rejectPlay = false;
  const config = { bgmVolume: .5, seVolume: 0 };
  class AudioContext {
    constructor() { ctx = this; }
    state = "suspended"; destination = {};
    createGain() { return { gain: { value: 0, cancelScheduledValues() {} }, connect() {} }; }
    resume() { return new Promise((resolve, reject) => resumes.push({ resolve, reject })); }
  }
  class Audio {
    constructor(src) { this.src = src; this.volume = 0; this.plays = 0; media.push(this); }
    addEventListener() {}
    play() {
      this.plays++;
      if (rejectPlay) return Promise.reject(new Error("autoplay blocked"));
      this.paused = false; return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  const audio = await load(audioCode, { config, bgmUrl: k => `/${k}.mp3` }, {
    Audio, window: { AudioContext }, document: { hidden: false },
    performance: { now: () => now }, requestAnimationFrame: fn => frames.push(fn),
  });
  return { audio, config, media, resumes,
    finishResume() { ctx.state = "running"; resumes.splice(0).forEach(r => r.resolve()); },
    rejectPlay(value) { rejectPlay = value; },
    frame(ms = 1500) { now += ms; frames.splice(0).forEach(fn => fn()); },
  };
}
for (const action of ["start", "stop", "replace", "repeat", "reject-resume"]) {
  const f = await audioFixture(), a = f.audio;
  a.playBgm("title");
  assert.equal(f.media.length, 0, "no playback before a permitted gesture");
  a.unlockAudio();
  if (action === "stop") a.stopBgm(0);
  if (action === "replace") a.playBgm("tonari");
  if (action === "repeat") a.unlockAudio();
  if (action === "reject-resume") {
    f.resumes.splice(0).forEach(r => r.reject(new Error("blocked")));
    await flush(); assert.equal(f.media.length, 0);
    a.unlockAudio();
  }
  f.finishResume(); await flush(); f.frame();
  assert.equal(f.media.length, action === "stop" ? 0 : 1, action);
  if (action !== "stop") {
    assert.equal(f.media[0].src, action === "replace" ? "/tonari.mp3" : "/title.mp3");
    assert.equal(f.media[0].plays, 1, "one first gesture completion creates one player");
    a.unlockAudio(); a.playBgm(a.currentBgm());
    assert.equal(f.media.length, 1, "repeated gestures never duplicate playing BGM");
    for (const key of ["mute", "muted"]) {
      f.config[key] = true; a.applyVolumes(); f.frame(); assert.equal(f.media[0].volume, 0);
      f.config[key] = false;
    }
    f.config.bgmVolume = 0; a.applyVolumes(); f.frame(); assert.equal(f.media[0].volume, 0);
    f.config.bgmVolume = .25; a.applyVolumes(); assert.equal(f.media[0].volume, .25);
    a.stopBgm(0); await flush(); assert.equal(f.media[0].paused, true);
  }
}
// A track being faded out is still audible and must obey silence settings immediately.
for (const setting of ["mute", "muted", "bgmVolume"]) {
  for (const replace of [false, true]) {
    const f = await audioFixture(), a = f.audio;
    a.playBgm("title"); a.unlockAudio(); f.finishResume(); await flush(); f.frame();
    const outgoing = f.media[0];
    if (replace) a.playBgm("tonari");
    else a.stopBgm(1);
    f.frame(100);
    assert.ok(outgoing.volume > 0, "outgoing track is still fading");
    f.config[setting] = setting === "bgmVolume" ? 0 : true;
    a.applyVolumes();
    assert.equal(outgoing.volume, 0, `${setting}: silence outgoing track without waiting for a frame`);
    assert.equal(outgoing.paused, true, "silent outgoing track releases playback immediately");
    f.frame(100);
    assert.equal(outgoing.volume, 0, "an old animation frame cannot restore sound");
    f.config[setting] = setting === "bgmVolume" ? .5 : false;
    a.applyVolumes(); f.frame(1500); await flush();
    assert.equal(outgoing.paused, true, "restoring volume does not revive a stopped track");
    if (replace) {
      assert.equal(f.media[1].volume, .5, "replacement track keeps its fade and volume control");
      assert.equal(f.media[1].paused, false);
    }
  }
}
{
  const f = await audioFixture(), a = f.audio;
  a.playBgm("title"); a.unlockAudio(); f.finishResume(); await flush(); f.frame();
  a.playBgm("tonari"); f.frame(200);
  a.playBgm("map"); f.frame(100);
  assert.ok(f.media[0].volume > 0 && f.media[1].volume > 0, "rapid switches can leave two retiring tracks");
  f.config.bgmVolume = 0; a.applyVolumes();
  for (const old of f.media.slice(0, 2)) {
    assert.equal(old.volume, 0); assert.equal(old.paused, true);
  }
  f.config.bgmVolume = .5; a.applyVolumes(); f.frame(); await flush();
  a.stopBgm(1); f.frame(500);
  assert.equal(f.media[2].volume, .25, "ordinary stop retains its requested fade duration");
  f.frame(500); await flush();
  assert.equal(f.media[2].volume, 0); assert.equal(f.media[2].paused, true);
}
console.log("PASS: outgoing BGM obeys mute/zero volume immediately, stale frames and rapid replacements stay silent, ordinary fades preserved");
// Media autoplay rejection also remains pending until the next allowed gesture.
{
  const f = await audioFixture(); f.rejectPlay(true);
  f.audio.playBgm("title"); f.audio.unlockAudio(); f.finishResume(); await flush();
  assert.equal(f.audio.currentBgm(), null);
  f.rejectPlay(false); f.audio.unlockAudio(); await flush();
  assert.equal(f.audio.currentBgm(), "title");
  assert.equal(f.media.length, 2); assert.equal(f.media[1].plays, 1);
}
console.log("PASS: first gesture, deferred/rejected resume, stop/replacement races, deduplication, mute/volume and autoplay retry");

// Production title callbacks: cancelled/closed subviews redraw reusing the current art
// (title.js keeps currentArt across menu redraws; a new pick happens only on boot/reload);
// accepted exits do not redraw.
let buttons = new Map(), selectedSlot = null, confirm = false, renders = 0, picks = 0, wipes = 0;
const events = [], hudClasses = new Set(["show"]), galleryCloses = [], configCloses = [];
const body = { dataset: { screen: "title" } };
function el(selector, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const node = { selector, children: [...children], ...attrs, dataset: attrs.dataset || {}, style: {},
    classList: { add() {} }, complete: true, naturalWidth: 1,
    append(...nodes) { this.children.push(...nodes); }, addEventListener() {},
    querySelector(sel) {
      const match = n => sel.startsWith(".") ? n.selector?.split(".").includes(sel.slice(1)) : n.selector?.split(".")[0] === sel;
      const walk = n => match(n) ? n : n.children?.map(walk).find(Boolean);
      return this.children.map(walk).find(Boolean);
    },
  };
  if (attrs.dataset?.test) buttons.set(attrs.dataset.test, node);
  return node;
}
const title = await load(await read("../js/scenes/title.js"), {
  el, bgUrl: () => "title-bg", layers: { hud: { classList: { remove: k => hudClasses.delete(k) } } },
  showScreen: name => { body.dataset.screen = name; renders++; }, peekSave: () => ({}), anySlotSaved: () => true,
  playBgm: k => events.push(k), stopBgm: fade => events.push(`stop:${fade}`),
  SE: { select() {} }, smokeWipe: fn => fn(),
  modal: options => options.title === "設定" ? new Promise(resolve => configCloses.push(resolve)) : Promise.resolve(confirm),
  loadFlow: async () => selectedSlot, loadFromSlot: () => true,
  wipeSave: () => wipes++,
  resumeGame: () => events.push("resume"), startNewGame: () => events.push("new"),
  openGallery: () => new Promise(resolve => galleryCloses.push(resolve)),
  pickTitleArt: () => ({ ready: true, file: `art-${++picks}`, character: `character-${picks}`, url: "test" }),
  createUiThemeSelect: () => el("select"),
  config: {},
}, { document: { body }, performance: { now: () => 0 }, window: {} });
const art = { ready: true, file: "test", character: "test", url: "test" };
const show = () => { buttons = new Map(); title.showTitle(art); };
const click = async id => { buttons.get(id).onclick(); await flush(); };
show(); assert.equal(body.dataset.screen, "title"); assert.equal(hudClasses.has("show"), false);
assert.deepEqual([...buttons.keys()], ["title-new", "title-load", "title-gallery", "title-config"]);
for (const [id, closes] of [["title-gallery", galleryCloses], ["title-config", configCloses]]) {
  const before = renders, beforePicks = picks;
  await click(id); assert.equal(renders, before, "keep title until subview closes");
  closes.shift()(); await flush();
  assert.equal(renders, before + 1); assert.equal(picks, beforePicks, "closing a subview reuses the current art");
}
for (const id of ["title-new", "title-load"]) {
  const before = renders, beforePicks = picks;
  await click(id);
  assert.equal(renders, before + 1); assert.equal(picks, beforePicks, "cancelling reuses the current art");
  assert.equal(wipes, 0, "cancelling must not erase saves");
}
for (const [id, expected] of [["title-load", "resume"], ["title-new", "new"]]) {
  show(); await click("title-gallery");
  selectedSlot = "slot1"; confirm = true;
  const before = renders, beforePicks = picks;
  await click(id); assert.deepEqual(events.slice(-2), ["stop:0", expected]);
  // Even while the wipe still has data-screen=title, the outgoing title is retired.
  galleryCloses.shift()(); await flush();
  assert.equal(renders, before); assert.equal(picks, beforePicks, "accepted exit never rebuilds title");
}
// A previous title's late close cannot replace a newer title or an outside screen.
show(); await click("title-gallery"); show();
let before = renders; galleryCloses.shift()(); await flush(); assert.equal(renders, before);
await click("title-config"); body.dataset.screen = "map";
before = renders; configCloses.shift()(); await flush(); assert.equal(renders, before);
hudClasses.add("show"); show(); assert.equal(hudClasses.has("show"), false);
console.log("PASS: four retained menus, gallery/config return, NEW/LOAD cancel rotation, accepted exits and stale-close guards");

// First narration must be entered even when the cold-open decoration is still decoding.
let mounted = false, firstDialogue = null;
const chapter = await load(await read("../js/chapters/ch1.js"), {
  state: { flags: {} }, hooks: {}, CRAFT_STEPS: [],
  DB: { dialogues: { ch1_cold_open: { dialogue_id: "ch1_cold_open", metadata: { effect: "smoke" }, lines: [] } } },
  setBg: async () => {},
  mountColdOpen: () => { mounted = true; return { ready: new Promise(() => {}), stop() {} }; },
  play: dialogue => { firstDialogue = dialogue; return new Promise(() => {}); },
});
void chapter.startNewGame(); await flush();
assert.equal(mounted, true);
assert.equal(firstDialogue?.dialogue_id, "ch1_cold_open", "decoration decode must not gate first narration");
assert.equal(firstDialogue.metadata.effect, "", "the existing cold-open scene still owns the presentation");
console.log("PASS: pending decorative assets do not block the initial dialogue call");
// Display behavior still requires an actual browser; this assertion only protects the guard's presence.
const css = await read("../css/daily.css");
assert.match(css, /body\[data-screen="boot"\] #hud, body\[data-screen="title"\] #hud \{ display: none; \}/);
