// #3500 C-21/C-22: 文字送りの描画を「増えた文字だけ足す」「描画フレームに合わせて送る」に変えても、
// (1) 各時点の DOM が従来の innerHTML = sliceHtml(html, n) と同じであること（実際の台本の全行・装飾・心の声の枠つき）、
// (2) 速度1〜3の「1秒あたりの文字数」が従来の間隔（46／26／12ms ごとに step 文字）どおりであること、を確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("vn-typed-html", async (check) => {
  await check("same-dom-as-slicehtml", async (page) => {
    const result = await page.evaluate(async () => {
      const { createTypedHtml } = await import("./js/vn/typed-html.js");
      const { formatHtml, sliceHtml, visibleLength } = await import("./js/vn/text.js");
      const texts = new Set();
      for (const dlg of Object.values(window.__remake.DB.dialogues)) {
        for (const lines of [dlg.lines, ...Object.values(dlg.branches || {})]) {
          for (const line of lines || []) {
            if (typeof line.text === "string") texts.add(line.text);
            if (typeof line.inner === "string") texts.add(line.inner);
          }
        }
      }
      // 装飾・改行・記号の混ざる行を必ず含める
      texts.add("[imp]大事[/imp]な話\n二行目[red]赤[/red]と[shiver]震え\n続き[/shiver]&<>\"'の行[pause]止まる");
      const root = document.createElement("div"), expected = document.createElement("div");
      document.body.append(root, expected);
      const write = createTypedHtml(root);
      let checked = 0, mismatch = null, random = 1;
      const rand = () => (random = (random * 48271) % 2147483647) / 2147483647;
      for (const raw of texts) {
        for (const html of [formatHtml(raw), `<span class="tx-voice">${formatHtml(raw)}</span>`]) {
          const total = visibleLength(html);
          // 1文字ずつ・数文字ずつ飛ばす・途中で外から書き換える・文字数が戻る、を混ぜて確かめる
          let n = 0;
          while (n <= total + 1) {
            if (rand() < 0.03) root.innerHTML = "<b>外から</b>";
            write(html, n);
            expected.innerHTML = sliceHtml(html, n);
            checked++;
            if (root.innerHTML !== expected.innerHTML || root.childNodes.length !== expected.childNodes.length) {
              mismatch = { raw, n, got: root.innerHTML, want: expected.innerHTML };
              break;
            }
            n += rand() < 0.1 ? 1 + Math.floor(rand() * 6) : 1;
            if (rand() < 0.02) n = Math.max(0, n - 4);
          }
          if (mismatch) break;
        }
        if (mismatch) break;
      }
      root.remove(); expected.remove();
      return { lines: texts.size, checked, mismatch };
    });
    assert.equal(result.mismatch, null, JSON.stringify(result.mismatch));
    assert(result.lines > 1000, `too few dialogue lines checked: ${result.lines}`);
    console.log(`[vn-typed-html] ${result.lines} lines, ${result.checked} prefixes identical to sliceHtml`);
  });

  await check("typing-rate", async (page) => {
    const rows = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), vn = await import("./js/vn/engine.js");
      const { formatHtml, visibleLength } = await import("./js/vn/text.js");
      core.newGame();
      Object.assign(core.config, { autoSpeed: 3, skipSeenOnly: false, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      vn.vnTest.turbo = false;
      const text = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ";
      const total = visibleLength(formatHtml(text));
      const rows = [];
      for (const speed of [1, 2, 3]) {
        core.config.textSpeed = speed;
        const controller = new AbortController();
        const run = vn.play({ dialogue_id: `typed-rate-${speed}-${Date.now()}`, lines: [{ speaker: "hajime", text }, { speaker: "hajime", text: "終わり。" }] }, { signal: controller.signal });
        const node = await new Promise((resolve) => {
          const find = () => document.querySelector("#vn .vn-text") ? resolve(document.querySelector("#vn .vn-text")) : requestAnimationFrame(find);
          find();
        });
        const times = await new Promise((resolve) => {
          let first = null;
          const observer = new MutationObserver(() => {
            const shown = node.textContent.length;
            if (shown > 0 && first === null) first = { t: performance.now(), shown };
            if (shown >= total) { observer.disconnect(); resolve({ first, last: performance.now() }); }
          });
          observer.observe(node, { subtree: true, childList: true, characterData: true });
        });
        controller.abort();
        await run;
        const interval = { 1: 46, 2: 26, 3: 12 }[speed], step = Math.max(1, Math.round(total / 90));
        // 最初に見えた送りから最後の送りまでの送りの回数と、その間の経過時間
        const ticks = Math.ceil((total - times.first.shown) / step);
        rows.push({ speed, total, ticks, interval, measured: times.last - times.first.t, nominal: ticks * interval });
      }
      return rows;
    });
    for (const row of rows) {
      console.log(`[vn-typed-html] speed ${row.speed}: ${row.ticks} steps in ${row.measured.toFixed(0)}ms (nominal ${row.nominal}ms)`);
      // 速くはならない。最初に見えた送りは、その送りの間隔のどこで描かれたかで最大1間隔ぶん揺れる。遅れは負荷によるもので、上限は緩めに見る。
      assert(row.measured >= row.nominal - row.interval - 5, `speed ${row.speed} typed faster than the nominal rate: ${JSON.stringify(row)}`);
      assert(row.measured <= row.nominal * 1.5 + 200, `speed ${row.speed} typed far slower than the nominal rate: ${JSON.stringify(row)}`);
    }
  });
});
