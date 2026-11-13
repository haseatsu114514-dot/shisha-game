import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { COSTUME_KEYS } from "../js/trpg/costumes.js";
import { FACE_FRAC, EYE_Y, PORTRAIT_FRAMES, circleFaceStyle, portraitFaceFrame } from "../js/trpg/face-crops.js";

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
  assert.equal(frames.length, 95);
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
