// Real HTMLAudioElement preparation with a tiny generated WAV, no production audio download.
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";
const wav = Buffer.alloc(44 + 8000 * 2);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
await suite("bgm-readiness", async check => {
  await check("delayed-media", async page => {
    let requests = 0;
    await page.route("**/assets/audio/bgm/readiness_fixture.mp3", async route => {
      requests++; await new Promise(resolve => setTimeout(resolve, 900));
      await route.fulfill({ contentType: "audio/wav", body: wav });
    });
    await page.mouse.click(4, 4);
    await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js"); DB.manifest.bgm.push("readiness_fixture.mp3");
      const audio = await import("./js/core/audio.js");
      window.readinessBefore = audio.currentBgm(); window.readinessDone = false;
      window.readinessPromise = audio.preloadBgm("readiness_fixture").then(ready => {
        window.readinessDone = true; return ready;
      });
    });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => readinessDone), false, "URL resolution alone must not open the gate");
    assert.equal(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm() === readinessBefore), true, "Preload must not autoplay");
    assert.equal(await page.evaluate(() => readinessPromise), true, "The real browser must decode enough media to start");
    await page.evaluate(async () => { (await import("./js/core/audio.js")).playBgm("readiness_fixture"); });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm()), "readiness_fixture");
    assert.equal(requests, 1, "Reusing prepared media must not download a second copy");
  });
});
