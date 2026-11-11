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
