// Device-free regression: production audio/title modules, controlled browser boundaries.
// node --experimental-vm-modules remake/test/title_audio_entry.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const read = path => fs.readFile(new URL(path, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function load(code, values, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link(spec => {
    const names = [...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .filter(m => m[2] === spec).flatMap(m => m[1].split(",").map(n => n.trim()));
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => {}));
    }, { context });
  });
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

// Title LOAD is an in-page transition; cancellations must retain title music.
let buttons = new Map(), screen, selectedSlot = null, confirm = false;
let galleryOpens = 0, configOpens = 0;
const events = [], hudClasses = new Set(["show"]);
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
  showScreen: name => { screen = name; }, peekSave: () => ({}), anySlotSaved: () => true,
  playBgm: k => events.push(k), stopBgm: fade => events.push(`stop:${fade}`),
  SE: { select() {} }, smokeWipe: fn => fn(), modal: async options => { if (options.title === "設定") configOpens++; return confirm; },
  loadFlow: async () => selectedSlot, loadFromSlot: () => true,
  resumeGame: () => events.push("resume"), startNewGame: () => events.push("new"),
  openGallery: () => galleryOpens++,
  config: {},
}, { document: { querySelector: () => null } });
const art = { ready: true, file: "test", character: "test", url: "test" };
const show = () => { buttons = new Map(); title.showTitle(art); };
show(); assert.equal(screen, "title"); assert.equal(hudClasses.has("show"), false);
buttons.get("title-load").onclick(); await flush(); assert.deepEqual(events, ["title"]);
selectedSlot = "slot1";
buttons.get("title-load").onclick(); await flush(); assert.deepEqual(events.slice(-2), ["stop:0", "resume"]);
show(); buttons.get("title-new").onclick(); await flush(); assert.equal(events.at(-1), "title");
confirm = true; buttons.get("title-new").onclick(); await flush(); assert.deepEqual(events.slice(-2), ["stop:0", "new"]);
show();
assert.deepEqual([...buttons.keys()], ["title-new", "title-load", "title-gallery", "title-config"], "only the four retained title routes are exposed");
buttons.get("title-gallery").onclick(); buttons.get("title-config").onclick();
assert.equal(galleryOpens, 1); assert.equal(configOpens, 1);
hudClasses.add("show"); show();
assert.equal(hudClasses.has("show"), false); assert.equal(events.at(-1), "title");
console.log("PASS: title HUD reset, LOAD/new cancellation and accepted exits, retained menus and title re-entry");
// Display behavior still requires an actual browser; this assertion only protects the guard's presence.
const css = await read("../css/daily.css");
assert.match(css, /body\[data-screen="boot"\] #hud, body\[data-screen="title"\] #hud \{ display: none; \}/);
