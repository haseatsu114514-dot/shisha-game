// #3653: スケッチの線画をワーカー（motions/sketch-lines-worker.js）で作っても、これまでの SVG フィルタ
// （sketch.js の sketchFilter を canvas に掛けたもの）と見た目が同じであること。
// 絵は LFS に依らないよう、その場で描いた模様（グラデーション・図形・細い線・ノイズ）を使う。
// node remake/test/browser/sketch_lines_3653.mjs（プレビューサーバーが必要）
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("sketch-lines-3653", async check => {
  await check("worker line art matches the SVG filter", async page => {
    const results = await page.evaluate(async () => {
      const { W, H, svg, stageSvg } = await import("./js/core/transition-kit.js");
      // 模様の絵（背景と同じ 1920×1080）
      const src = document.createElement("canvas"); src.width = 1920; src.height = 1080;
      const g = src.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 1920, 1080); grad.addColorStop(0, "#3a2a6e"); grad.addColorStop(0.5, "#e7c08c"); grad.addColorStop(1, "#5fb3a1");
      g.fillStyle = grad; g.fillRect(0, 0, 1920, 1080);
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `hsl(${rnd() * 360} ${30 + rnd() * 60}% ${20 + rnd() * 60}%)`;
        if (i % 3) g.fillRect(rnd() * 1920, rnd() * 1080, 20 + rnd() * 200, 20 + rnd() * 160);
        else { g.beginPath(); g.arc(rnd() * 1920, rnd() * 1080, 10 + rnd() * 90, 0, 7); g.fill(); }
      }
      g.strokeStyle = "#101018"; g.lineWidth = 1.5;
      for (let i = 0; i < 80; i++) { g.beginPath(); g.moveTo(rnd() * 1920, rnd() * 1080); g.lineTo(rnd() * 1920, rnd() * 1080); g.stroke(); }
      const noise = g.getImageData(0, 0, 1920, 1080);
      for (let p = 0; p < noise.data.length; p += 4) { const n = (rnd() - 0.5) * 18; for (let c = 0; c < 3; c++) noise.data[p + c] += n; }
      g.putImageData(noise, 0, 0);
      const img = new Image();
      img.src = URL.createObjectURL(await new Promise((r) => src.toBlob(r, "image/png")));
      await img.decode();

      const draw = (ctx) => {
        const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      };
      const out = [];
      // gray: 輝度を canvas の filter で済ませる本来の経路／false: filter が使えない環境の代わりの計算
      for (const [ink, clear, gray] of [["#2b2d36", true, true], ["#3d2a78", true, true], ["#3a3a44", false, true], ["#2b2d36", true, false]]) {
        const [r, gg, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255);
        const tone = clear ? `0 0 0 0 ${r}  0 0 0 0 ${gg}  0 0 0 0 ${b}  -1 0 0 0 1` : `${1 - r} 0 0 0 ${r}  ${1 - gg} 0 0 0 ${gg}  ${1 - b} 0 0 0 ${b}  0 0 0 1 0`;
        const id = `t3653-${out.length}`;
        // sketch.js の sketchFilter と同じフィルタ
        const defs = stageSvg([svg("defs", {}, [svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
          svg("feColorMatrix", { type: "saturate", values: "0" }),
          svg("feConvolveMatrix", { order: "3", kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true" }),
          svg("feComponentTransfer", {}, ["R", "G", "B"].map((c) => svg(`feFunc${c}`, { type: "linear", slope: "-3.2", intercept: "1" }))),
          svg("feColorMatrix", { type: "matrix", values: tone }),
        ])])]);
        document.body.append(defs);
        const a = document.createElement("canvas"); a.width = W; a.height = H;
        const actx = a.getContext("2d"); actx.filter = `url(#${id})`; draw(actx);
        const ref = actx.getImageData(0, 0, W, H).data;
        defs.remove();
        // ワーカーで作る（sketch.js の renderLinesOffThread と同じ渡し方）
        const b0 = document.createElement("canvas"); b0.width = W; b0.height = H;
        const bctx = b0.getContext("2d", { willReadFrequently: true });
        if (gray) { bctx.filter = "saturate(0)"; if (bctx.filter !== "saturate(0)") { out.push({ ink, clear, gray, skipped: true }); continue; } }
        draw(bctx);
        const pixels = bctx.getImageData(0, 0, W, H).data;
        const worker = new Worker(new URL("./js/motions/sketch-lines-worker.js", location.href), { type: "module" });
        const reply = await new Promise((resolve) => { worker.onmessage = (e) => resolve(e.data); worker.onerror = (e) => resolve({ error: e.message }); worker.postMessage({ w: W, h: H, pixels, ink: [r, gg, b].map((v) => Math.round(v * 255)), clear, gray }, [pixels.buffer]); });
        worker.terminate();
        if (!reply.blob) { out.push({ ink, clear, gray, error: reply.error || "no blob" }); continue; }
        const got = new Image(); got.src = URL.createObjectURL(reply.blob); await got.decode();
        const c = document.createElement("canvas"); c.width = W; c.height = H;
        const cctx = c.getContext("2d"); cctx.drawImage(got, 0, 0);
        const mine = cctx.getImageData(0, 0, W, H).data;
        // 白い紙の上に置いた見た目で比べる（線の色 × 濃さ）。外周2pxはフィルタ領域の端の扱いが違うので除く
        let sum = 0, cnt = 0, over8 = 0, lines = 0, max = 0;
        for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
          const p = (y * W + x) * 4;
          if (ref[p + 3] > 128) lines++;
          for (let ch = 0; ch < 3; ch++) {
            const v = (d) => (d[p + ch] * d[p + 3] + 255 * (255 - d[p + 3])) / 255;
            const diff = Math.abs(v(ref) - v(mine)); sum += diff; cnt++; if (diff > 8) over8++; if (diff > max) max = diff;
          }
        }
        out.push({ ink, clear, gray, max, mean: sum / cnt, over8Ratio: over8 / cnt, lineRatio: lines / ((W - 4) * (H - 4)) });
      }
      return out;
    });
    assert(results.some((r) => r.gray && !r.skipped), "the canvas filter path really ran");
    for (const r of results) {
      if (r.skipped) continue;
      assert(!r.error, `worker failed: ${JSON.stringify(r)}`);
      if (r.clear) assert(r.lineRatio > 0.01, `the pattern really has lines to compare ${JSON.stringify(r)}`);
      // 本来の経路はほぼビット一致。代わりの計算は輝度の 0.5 ちょうどの丸めで、まれに1段ずれる
      assert(r.mean < (r.gray ? 0.3 : 0.6), `mean difference from the SVG filter ${JSON.stringify(r)}`);
      if (r.gray) assert(r.max <= 4, `the canvas filter path differs only by rounding ${JSON.stringify(r)}`);
      else assert(r.over8Ratio < 0.003, `pixels differing by more than 8/255 ${JSON.stringify(r)}`);
    }
    console.log(JSON.stringify(results.map((r) => ({ ink: r.ink, clear: r.clear, gray: r.gray, max: r.max && Math.round(r.max), mean: +r.mean.toFixed(3), over8: +(r.over8Ratio * 100).toFixed(3) + "%", lines: +(r.lineRatio * 100).toFixed(1) + "%" }))));
  });
});
console.log("PASS sketch-lines-3653: worker line art matches the SVG filter (canvas-filter path: rounding only)");
