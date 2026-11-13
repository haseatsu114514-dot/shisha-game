// 新版の会話: 表情が替わる間も、立ち絵に重ねた光の層（場面の光・場所の光）が消えないこと（LD08）。
// 2026-11-13 オーナー「（表情が変わる瞬間に）普通の色の後に暖色にすぐなる」。iPhone の Safari は大きな絵を型（mask）にすると
// 裏でデコードし、その間は型が空になって光が消えていた。looks/neo.js は新しい表情の絵のデコードを済ませてから型を替える。
// ここでは型に使う絵のデコードを 300ms 遅らせ（Safari の遅いデコードの代わり）、表情の差し替えのあいだ毎フレーム、
// 光の層が「出ていて」「前か新しい表情の型を持つ」ことと、デコードの後には新しい表情の型へ替わることを確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

await suite("neo-light-swap", async (check) => {
  await check("light-keeps-a-mask-while-the-face-changes", async (page) => {
    await page.goto(`${baseURL}?look=neo`);
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); core.state.chapter = 1; core.config.textSpeed = 4;
      core.state.met.sumi = true;
      (await import("./js/vn/intro.js")).markIntroSeen("sumi");
      // 型の差し替え（looks/neo.js の probe）だけを遅らせる。立ち絵そのものの準備（engine の imageReady）は遅らせない。
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function (...args) {
        const slow = !this.isConnected && /chr_sumi_smile/.test(this.src) && window.__slowMaskDecode;
        return slow ? new Promise((resolve) => setTimeout(resolve, 300)).then(() => decode.apply(this, args)) : decode.apply(this, args);
      };
      (await import("./js/core/ui.js")).clearScreen();
      window.done = (await import("./js/vn/engine.js")).play({ dialogue_id: "__neo_light_swap", metadata: { bg: "res://assets/backgrounds/bg_tonari_inside_night.png" },
        lines: [{ speaker: "sumi", face: "normal", text: "まずは通常の顔。" }, { speaker: "sumi", face: "smile", text: "次は笑顔。" }] });
    });
    await page.locator(".vn-next.show").waitFor({ timeout: 30000 });
    await page.waitForFunction(() => {
      const light = document.querySelector(".vn-portraits .neo-light");
      return light && /chr_sumi_normal/.test(light.style.getPropertyValue("--neo-mask")) && getComputedStyle(light).display !== "none";
    }, null, { timeout: 15000 });
    // 表情を替えて、型が替わるまで毎フレーム見張る。
    await page.evaluate(() => {
      window.__slowMaskDecode = true;
      window.__samples = [];
      window.__stop = false;
      const sample = () => {
        for (const kind of ["neo-light", "neo-amb"]) {
          const layer = document.querySelector(`.vn-portraits .${kind}`);
          const mask = layer?.style.getPropertyValue("--neo-mask") || "";
          window.__samples.push({ kind, present: !!layer, shown: !!layer && getComputedStyle(layer).display !== "none",
            face: /chr_sumi_smile/.test(mask) ? "smile" : /chr_sumi_normal/.test(mask) ? "normal" : "none",
            img: /chr_sumi_smile/.test(document.querySelector(".vn-portraits img.portrait")?.src || "") ? "smile" : "normal" });
        }
        if (!window.__stop) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.waitForTimeout(400); // 会話を開いた直後の誤送り防止の間を越える
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("次は笑顔"), null, { timeout: 15000 });
    await page.waitForTimeout(900);
    const frames = await page.evaluate(() => { window.__stop = true; return window.__samples; });
    assert(frames.length > 10, "見張りのコマが少なすぎる");
    assert(frames.every((f) => f.present && f.shown), `光の層が消えたコマがある: ${JSON.stringify(frames.find((f) => !f.present || !f.shown))}`);
    assert(frames.every((f) => f.face !== "none"), "型の無い光の層のコマがある");
    assert(frames.some((f) => f.img === "smile" && f.face === "normal"), "デコードを待つ間は前の表情の型のまま光を出す");
    assert.equal(frames.at(-1).face, "smile", "デコードの後は新しい表情の型へ替わる");
    assert.equal(frames.at(-2).face, "smile");
  });
});
