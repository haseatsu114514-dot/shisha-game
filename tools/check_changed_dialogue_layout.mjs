// Explicit inputs only. Browser uses the runtime's layout/text modules; no corpus traversal.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));

export function dialogueRecords(value, file = "input.json") {
  const records = [];
  function visit(node, pointer, id) {
    if (!node || typeof node !== "object") return;
    id = node.dialogue_id || id;
    if (typeof node.text === "string" || typeof node.inner === "string") {
      records.push({ file, id: id || "", path: pointer, text: node.text || "", inner: node.inner || "",
        speaker: node.speaker, type: node.type });
    }
    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object") visit(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, id);
    }
  }
  visit(value, "", "");
  return records;
}
export function changedRecords(base, current) {
  const old = new Map(base.map(r => [`${r.file}:${r.id}:${r.path}`, r]));
  return current.filter(r => {
    const prior = old.get(`${r.file}:${r.id}:${r.path}`);
    return !prior || ["text", "inner", "speaker", "type"].some(k => prior[k] !== r[k]);
  });
}

export async function checkRecords(records, { output, executablePath, playwrightModule } = {}) {
  if (!output) throw new Error("output directory required");
  fs.mkdirSync(output, { recursive: true });
  for (const record of records) {
    if (!["file", "id", "path", "text"].every(key => typeof record[key] === "string")) throw new Error("Each record needs string file/id/path/text");
  }
  if (!records.length) {
    const report = { scope:"changed records only", records:0, results:[], errors:[] };
    fs.writeFileSync(path.join(output,"results.json"), JSON.stringify(report, null, 2) + "\n");
    return report;
  }
  const { chromium } = createRequire(import.meta.url)(playwrightModule || "playwright");
  const allowed = new Set(["remake/css/base.css", "remake/css/ui-art.css", "remake/css/ui-inner.css", "remake/css/vn.css", "remake/js/vn/text.js", "remake/js/vn/budoux_ja.js",
    "remake/js/vn/layout.js", "remake/js/vn/inner.js", "remake/fonts/ZenKakuGothicNew-Medium.woff2", "remake/fonts/ZenKakuGothicNew-Bold.woff2"]);
  const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${["base", "vn", "ui-art", "ui-inner"].map(name => `<link rel="stylesheet" href="/remake/css/${name}.css">`).join("")}
    <style>:root{--art-panel:none}</style>
    <div id="viewport"><div id="stage"><div id="vn" class="active"><div class="vn-box">
    <div class="vn-name show">組版検査</div><div class="vn-text"></div><div class="vn-inner" hidden></div>
    <div class="vn-next show">▼</div></div></div></div></div></html>`;
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, "http://localhost").pathname.slice(1);
    if (!name) { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); return; }
    if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "font/woff2");
    res.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results = [], errors = [];
  try {
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext(); // fresh isolated, no existing browser/account
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    for (const mode of [
      { name: "normal", width: 998, viewport: {width:1280,height:720} },
      { name: "mobile", width: 998, viewport: {width:844,height:390} },
      { name: "narrow", width: 520, viewport: {width:844,height:390} },
      { name: "inner", width: 700, viewport: {width:1280,height:720}, forceInner: true },
    ]) {
      await page.setViewportSize(mode.viewport);
      await page.goto(origin);
      await page.evaluate(async () => {
        document.querySelector("#stage").style.setProperty("--k", Math.min(innerWidth / 1280, innerHeight / 720));
        await Promise.all([500,700].map(w => document.fonts.load(`${w} 32px "Suien Gothic"`, "水煙念のため")));
        await document.fonts.ready;
      });
      for (const [index, record] of records.entries()) {
        const result = await page.evaluate(async ({record, mode}) => {
          const { dialoguePages, paginateForBox } = await import("/remake/js/vn/layout.js");
          const { paginate, formatHtml, wrapDiagnostics, WRAP_LIMIT } = await import("/remake/js/vn/text.js");
          const { playerInner } = await import("/remake/js/vn/inner.js");
          const text = document.querySelector(".vn-text"), inner = document.querySelector(".vn-inner");
          const box = document.querySelector(".vn-box"), stage = document.querySelector("#stage");
          const syntheticWidth = ["narrow", "inner"].includes(mode.name);
          text.style.width = inner.style.width = syntheticWidth ? `${mode.width}px` : "";
          // Force-inner mode exercises one-line speech with an explicitly marked fixture thought.
          const thought = playerInner(record) || (mode.forceInner ? "（検査用の本心）" : "");
          box.classList.toggle("has-inner", !!thought);
          box.classList.toggle("narration", !record.speaker);
          const pages = dialoguePages(record.text, thought, text, inner);
          let diagnostics = [];
          paginateForBox(record.text, text, (value, layout) => {
            diagnostics = wrapDiagnostics(value, WRAP_LIMIT, layout).map(d => ({field:"text", ...d}));
            return paginate(value, layout);
          }, thought ? 1 : 2);
          if (thought) paginateForBox(thought, inner, (value, layout) => {
            const adjusted = {...layout, measure: s => layout.measure(`（${s}）`)};
            diagnostics.push(...wrapDiagnostics(value.slice(1,-1), WRAP_LIMIT - 2, adjusted).map(d => ({field:"inner", ...d})));
            return [];
          });
          const renders = pages.map(p => {
            text.innerHTML = formatHtml(p.text); inner.hidden = !p.inner; inner.innerHTML = formatHtml(p.inner);
            const b = box.getBoundingClientRect();
            const contents = [text, ...(p.inner ? [inner] : [])];
            return { ...p, fits: contents.every(el => {
              const r = el.getBoundingClientRect();
              return el.scrollWidth <= el.clientWidth + 1 && r.left >= b.left - 1 && r.right <= b.right + 1 && r.bottom <= b.bottom + 1;
            }) };
          });
          text.innerHTML = formatHtml(pages[0].text); inner.hidden = !pages[0].inner; inner.innerHTML = formatHtml(pages[0].inner);
          const rect = el => { const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
          const stageRect = rect(stage), boxRect = rect(box);
          const viewportFits = [stageRect, boxRect].every(r => r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1) &&
            document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight;
          return { pages: renders, diagnostics, width:text.clientWidth, font:getComputedStyle(text).fontFamily,
            fontReady:document.fonts.check('500 32px "Suien Gothic"') && document.fonts.check('700 32px "Suien Gothic"'),
            syntheticWidth, stage:stageRect, box:boxRect, viewportFits, scale:Math.min(innerWidth/1280,innerHeight/720),
            syntheticInner: !!mode.forceInner && !playerInner(record) };
        }, {record, mode});
        const key = `${record.file}:${record.id}:${record.path}`;
        const screenshot = `${mode.name}-${index}-${createHash("sha256").update(key).digest("hex").slice(0,10)}.png`;
        await page.screenshot({ path:path.join(output, screenshot) });
        const png = fs.readFileSync(path.join(output, screenshot));
        const screenshotSize = { width:png.readUInt32BE(16), height:png.readUInt32BE(20) };
        results.push({ key, mode:mode.name, viewport:mode.viewport, screenshot, screenshotSize, ...result });
      }
    }
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  const report = { scope:"changed records, isolated shared-layout harness; no full game boot", records:records.length, results, errors };
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), get = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  const read = name => JSON.parse(fs.readFileSync(name, "utf8"));
  let records;
  if (args.includes("--records")) records = read(get("--records"));
  else if (args.includes("--base") && args.includes("--current")) {
    const file = get("--current");
    records = changedRecords(dialogueRecords(read(get("--base")), file), dialogueRecords(read(file), file));
  } else throw new Error("Use --records changed-records.json OR --base old.json --current new.json; --output directory required");
  const report = await checkRecords(records, { output:get("--output"), executablePath:process.env.CHROME_EXECUTABLE_PATH,
    playwrightModule:process.env.PLAYWRIGHT_MODULE });
  const suspicious = report.results.reduce((n, r) => n + r.diagnostics.length, 0);
  console.log(JSON.stringify({records:report.records, renders:report.results.length, suspicious, errors:report.errors}));
  if (report.errors.length || report.results.some(r => !r.fontReady || !r.viewportFits || r.screenshotSize.width !== r.viewport.width || r.screenshotSize.height !== r.viewport.height || r.pages.some(p => !p.fits))) process.exitCode = 1;
}
