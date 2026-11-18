import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { COSTUME_KEYS, resolvedCostumeKey } from "../js/trpg/costumes.js";
import { FACE_FRAC, EYE_Y, NPC_FRAMES, PORTRAIT_FRAMES, EXTRA_PORTRAIT_FRAMES, circleFaceStyle, npcBustStyle, npcFaceFrame, portraitFaceFrame } from "../js/trpg/face-crops.js";

const frames = JSON.parse(await readFile(new URL("../img/ui/trpg/costumes/frames.json", import.meta.url), "utf8"));
const CAST = ["hajime", "hiyori", "samechan", "tsumugi", "ageha", "adam", "rei", "sumi", "salaryman"];

function cropStats(frame) {
  const box = frame.box_exact || frame.box;
  const side = box[2] - box[0];
  const cheek = frame.face.w / side;
  const eye = (frame.face.eye_y - box[1]) / side;
  const cx = (frame.face.cx - box[0]) / side;
  return { side, cheek, eye, cx };
}

test("costume frames cover every wired role with a consistent face scale", () => {
  assert.equal(frames.length, 99);
  const keys = new Set(frames.map(f => `${f.scenario}/${f.character}/${f.role_id}`));
  for (const key of COSTUME_KEYS) {
    assert.ok(keys.has(key), `missing crop for ${key}`);
  }
  for (const rec of frames) {
    const s = cropStats(rec);
    assert.ok(Math.abs(s.cheek - FACE_FRAC) < 0.03, `${rec.file} cheek frac ${s.cheek}`);
    assert.ok(Math.abs(s.eye - EYE_Y) < 0.03, `${rec.file} eye line ${s.eye}`);
    assert.ok(Math.abs(s.cx - 0.5) < 0.03, `${rec.file} face center ${s.cx}`);
  }
});

test("TRPG seat portraits share the same cheek scale and eye line in both styles", () => {
  for (const style of ["classic", "new"]) {
    for (const id of CAST) {
      const frame = portraitFaceFrame(id, style);
      assert.ok(frame, `${style}/${id} has a crop`);
      const s = cropStats(frame);
      assert.ok(Math.abs(s.cheek - FACE_FRAC) < 0.03, `${style}/${id} cheek frac ${s.cheek}`);
      assert.ok(Math.abs(s.eye - EYE_Y) < 0.03, `${style}/${id} eye line ${s.eye}`);
      assert.ok(Math.abs(s.cx - 0.5) < 0.03, `${style}/${id} face center ${s.cx}`);
    }
  }
  assert.equal(Object.keys(PORTRAIT_FRAMES.new).sort().join(), CAST.slice().sort().join());
});

test("circleFaceStyle fills the parent with the crop and keeps the face centered", () => {
  const frame = portraitFaceFrame("samechan", "new");
  const style = circleFaceStyle(frame);
  assert.ok(style);
  const side = frame.box_exact[2] - frame.box_exact[0];
  const widthPct = parseFloat(style.width);
  assert.ok(Math.abs(widthPct - (frame.src[0] / side) * 100) < 0.01);
  const topPct = parseFloat(style.top);
  assert.ok(Math.abs(topPct - (-frame.box_exact[1] / side) * 100) < 0.01);
  assert.match(style.transform, /translateX\(-/);
  // Samechan's shark hood must not be the crop: the face crop is tighter than 400px.
  assert.ok(side < 400, `samechan crop side ${side}`);
});

// オーナー 2026-11-13「キャラの拡大率とかなんか統一感がまだない。アイコンにした時とか並べた時に」（TRF26）
test("costume busts: one character keeps nearly one zoom across costumes, and every cast member lands on the shared frame", async () => {
  const { BUST, bustTypicalWidths, bustCheekWidth } = await import("../js/trpg/face-crops.js");
  const keyed = Object.fromEntries(frames.map(f => [`${f.scenario}/${f.character}/${f.role_id}`, { face: f.face }]));
  const typical = bustTypicalWidths(keyed);
  assert.deepEqual(Object.keys(typical).sort(), [...new Set(frames.map(f => f.character))].sort());
  const zooms = {}, raw = {};
  for (const f of frames) {
    const cheek = bustCheekWidth(f.face, f.character, typical[f.character]);
    assert.ok(cheek > 0 && Number.isFinite(cheek), f.file);
    // The zoom is how many times the art is enlarged so the cheeks fill BUST.face of the card.
    (zooms[f.character] ||= []).push(BUST.face * f.src[0] / cheek);
    (raw[f.character] ||= []).push(BUST.face * f.src[0] / f.face.w);
  }
  for (const [id, list] of Object.entries(zooms)) {
    const spread = Math.max(...list) / Math.min(...list), before = Math.max(...raw[id]) / Math.min(...raw[id]);
    assert.ok(spread <= 1.18, `${id}: the same character is drawn at ${spread.toFixed(2)}x different sizes across costume cards`);
    assert.ok(spread <= before + 1e-9, `${id}: the damping never widens the spread`);
  }
  // 測った頬の幅だけで決めていた時は、はじめの札は 1.4 倍以上ばらついていた。
  assert.ok(Math.max(...raw.hajime) / Math.min(...raw.hajime) > 1.4);
  // A character with a single measured costume, or one missing from the table, falls back to its own measurement.
  assert.equal(bustCheekWidth({ w: 90 }, "nobody", undefined), 90);
  assert.equal(bustCheekWidth({ w: 90 }, "nobody", 90), 90);
  // The eye line leaves room for the hair above it: the top of the head is not cut off for an ordinary haircut.
  assert.ok(BUST.eye >= 0.38 && BUST.eye <= 0.45 && BUST.face > 0.2 && BUST.face < 0.3 && BUST.damp > 0 && BUST.damp < 1);
});

test("NPC frames share the standard circular crop metrics and speaker bust framing", async () => {
  const { SPEAKER_NPC_BUST } = await import("../js/trpg/face-crops.js");
  const { TRPG_NPC_IDS } = await import("../js/trpg/presentation.js");
  const ids = Object.keys(NPC_FRAMES).sort();
  assert.deepEqual(ids, [...TRPG_NPC_IDS].sort(), "NPC_FRAMES matches every wired TRPG NPC portrait");
  assert.equal(ids.length, 24);
  for (const id of ids) {
    const frame = npcFaceFrame(id);
    assert.ok(frame, `missing NPC frame for ${id}`);
    const s = cropStats(frame);
    assert.ok(Math.abs(s.cheek - FACE_FRAC) < 0.03, `npc/${id} cheek frac ${s.cheek}`);
    assert.ok(Math.abs(s.eye - EYE_Y) < 0.03, `npc/${id} eye line ${s.eye}`);
    assert.ok(Math.abs(s.cx - 0.5) < 0.03, `npc/${id} face center ${s.cx}`);
    const bust = npcBustStyle(id);
    assert.ok(bust, `missing npcBustStyle for ${id}`);
    const widthPct = parseFloat(bust.width);
    const drawnCheekFrac = (frame.face.w / frame.src[0]) * (widthPct / 100);
    assert.ok(Math.abs(drawnCheekFrac - SPEAKER_NPC_BUST.face) < 1e-6, `npc/${id} bust cheek frac ${drawnCheekFrac}`);
    assert.equal(bust.top, `${SPEAKER_NPC_BUST.eye * 100}%`);
    assert.match(bust.transform, /^translate\(-[\d.]+%, -[\d.]+%\)$/);
  }
  assert.equal(npcFaceFrame("unknown_npc"), null);
  assert.equal(npcBustStyle("unknown_npc"), null);
});

test("extended cast (sai, regulars), regular-table costume aliases, speaker bust framing, and expression shifts share one eye line and center", async () => {
  const { bustTypicalWidths, bustFrameStyle, PORTRAIT_FACE_SHIFTS } = await import("../js/trpg/face-crops.js");
  const { portraitBoxStyle } = await import("../js/trpg/presentation.js");
  const manifest = JSON.parse(await readFile(new URL("../data/manifest.json", import.meta.url), "utf8"));
  for (const style of ["classic", "new"]) {
    for (const id of ["sai", "regulara", "regularb"]) {
      assert.ok(EXTRA_PORTRAIT_FRAMES[style]?.[id]);
      const frame = portraitFaceFrame(id, style, manifest);
      assert.ok(frame, `${style}/${id} resolves via portraitFaceFrame`);
      const s = cropStats(frame);
      assert.ok(Math.abs(s.cheek - FACE_FRAC) < 0.03, `${style}/${id} cheek frac ${s.cheek}`);
      assert.ok(Math.abs(s.eye - EYE_Y) < 0.03, `${style}/${id} eye line ${s.eye}`);
      assert.ok(Math.abs(s.cx - 0.5) < 0.03, `${style}/${id} face center ${s.cx}`);
    }
  }
  assert.equal(resolvedCostumeKey("regular-mail", "hajime", "watch"), "leaf-mail/hajime/watch");
  assert.equal(resolvedCostumeKey("regular-harbor", "hajime", "sailor"), "ordinary-cup/hajime/sailor");

  const keyed = Object.fromEntries(frames.map(f => [`${f.scenario}/${f.character}/${f.role_id}`, f]));
  const typical = bustTypicalWidths(keyed);
  for (const f of frames) {
    const st = bustFrameStyle(f.face, f.character, typical[f.character], { faceFrac: 0.24, eyeFrac: 0.4, forImg: true });
    const wPx = 232 * parseFloat(st.width) / 100;
    const figTop = 318 * parseFloat(st.top) / 100 - (f.face.eye_y - f.face.figtop) * (wPx / f.src[0]);
    assert.ok(figTop >= 0, `${f.file} head/hat clipped in 232x318 dock: ${figTop}`);
    const match = /translate\(-([\d.]+)%,/.exec(st.transform);
    assert.ok(match && Math.abs(parseFloat(match[1]) - (f.face.cx / f.src[0] * 100)) < 0.01);
  }

  for (const id of [...CAST, "sai", "regulara", "regularb"]) {
    const base = portraitBoxStyle(manifest, id, { face: "normal", faceFrac: 0.245, eyeFrac: 0.35 });
    assert.equal(base.top, "35%");
    const exprs = PORTRAIT_FACE_SHIFTS.new?.[id] || {};
    for (const face of Object.keys(exprs)) {
      const shifted = portraitBoxStyle(manifest, id, { face, faceFrac: 0.245, eyeFrac: 0.35 });
      assert.equal(shifted.top, "35%");
      assert.equal(shifted.width, base.width);
      assert.notEqual(shifted.transform, base.transform, `new/${id}/${face} compensates canvas offset`);
    }
  }
});
