// Chromiumの実通信を記録する。ゲーム側のfetch・画像解決・音声処理は変更しない。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function recordLoad(page, base) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  const origin = new URL(base).origin;
  const sitePrefix = new URL("../", base).pathname;
  const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const records = new Map();
  const phases = [];
  const pending = new Map();
  let lastActivity = Date.now();
  const get = (id) => records.get(id);
  const cleanUrl = (url) => {
    const u = new URL(url);
    return u.origin === origin ? u.pathname : u.origin + u.pathname;
  };
  const category = (url) => {
    const p = new URL(url).pathname;
    if (/\.(webp|png|svg|jpg|jpeg)$/.test(p)) return "images";
    if (/\.(woff2?|ttf|otf)$/.test(p)) return "fonts";
    if (/\.(bgm|mp3|ogg|wav)$/.test(p)) return "audio";
    if (p.endsWith(".json")) return "data";
    if (/\.(js|css|html)$/.test(p) || p.endsWith("/")) return "code";
    return "other";
  };
  cdp.on("Network.requestWillBeSent", (e) => {
    if (!/^https?:/.test(e.request.url)) return;
    // リダイレクトは同じrequestIdを再利用するので、前の応答を別件として残す。
    if (e.redirectResponse && get(e.requestId)) {
      get(e.requestId).complete = true;
      get(e.requestId).totalEncodedBytes = e.redirectResponse.encodedDataLength;
      records.set(`${e.requestId}:redirect:${e.timestamp}`, get(e.requestId));
    }
    records.set(e.requestId, {
      url: cleanUrl(e.request.url), category: category(e.request.url),
      external: new URL(e.request.url).origin !== origin,
      status: null, cached: false, revalidated: false, complete: false,
      range: e.request.headers?.Range || e.request.headers?.range || null,
      decodedBodyBytes: 0, receivedEncodedBytes: 0, headerBytes: 0,
    });
    lastActivity = Date.now();
    if (pending.has(e.requestId)) {
      get(e.requestId).revalidated = pending.get(e.requestId) === 304;
      pending.delete(e.requestId);
    }
  });
  cdp.on("Network.requestServedFromCache", (e) => { if (get(e.requestId)) get(e.requestId).cached = true; });
  cdp.on("Network.responseReceived", (e) => {
    const r = get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.contentLength = Number(e.response.headers["Content-Length"] || e.response.headers["content-length"]) || null;
    r.contentRange = e.response.headers["Content-Range"] || e.response.headers["content-range"] || null;
    r.compressed = !!(e.response.headers["Content-Encoding"] || e.response.headers["content-encoding"]);
    r.cached ||= !!(e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker);
    r.headerBytes = e.response.encodedDataLength || 0;
  });
  cdp.on("Network.responseReceivedExtraInfo", (e) => {
    const r = get(e.requestId);
    if (r) r.revalidated ||= e.statusCode === 304;
    else pending.set(e.requestId, e.statusCode);
  });
  cdp.on("Network.dataReceived", (e) => {
    const r = get(e.requestId);
    if (!r) return;
    r.decodedBodyBytes += e.dataLength;
    r.receivedEncodedBytes += e.encodedDataLength;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = get(e.requestId);
    if (!r) return;
    r.complete = true;
    r.totalEncodedBytes = e.encodedDataLength;
    lastActivity = Date.now();
  });
  cdp.on("Network.loadingFailed", (e) => {
    const r = get(e.requestId);
    if (r) { r.failed = e.errorText; r.complete = true; lastActivity = Date.now(); }
  });
  async function settle() {
    // 音声の先読みはブラウザが途中で止めることがある。画像・コードの先読みが完了し、通信が落ち着くまで待つ。
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const loading = [...records.values()].some((r) => !r.complete && r.category !== "audio");
      if (!loading && Date.now() - lastActivity >= 1000) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Non-audio resource loading did not settle in 30 seconds");
  }
  function snapshot(name) {
    const resources = [...records.values()].map(({ headerBytes, receivedEncodedBytes, totalEncodedBytes, ...r }) => {
      let sourceBytes = null;
      if (!r.external && r.url.startsWith(sitePrefix)) {
        const file = path.resolve(root, r.url.slice(sitePrefix.length) + (r.url.endsWith("/") ? "index.html" : ""));
        if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) sourceBytes = fs.statSync(file).size;
      }
      // loadingFinishedはHTTPヘッダ込み。本文と区別し、キャッシュ・304の本文を再受信として数えない。
      // 未完の非圧縮音声はencodedDataLengthに未反映の受信分があるのでdecodedも使う（途中時点の下限）。
      let body = r.cached || r.revalidated ? 0
        : Math.max(0, totalEncodedBytes == null ? Math.max(receivedEncodedBytes, r.compressed ? 0 : r.decodedBodyBytes) : totalEncodedBytes - headerBytes);
      // HTTP/2では応答イベントのヘッダ量が0でも、完了量にはプロトコルの分が含まれることがある。
      // 完了した本文のContent-Lengthが分かるときは、それを上限にする（途中の音声は膨らませない）。
      if (r.complete && !r.failed && r.contentLength) body = Math.min(body, r.contentLength);
      return { ...r, sourceBytes, networkBodyBytes: body };
    });
    const categories = {};
    for (const r of resources) {
      const group = categories[r.category] ||= { requests: 0, networkBodyBytes: 0, decodedBodyBytes: 0 };
      group.requests++;
      group.networkBodyBytes += r.networkBodyBytes;
      group.decodedBodyBytes += r.decodedBodyBytes;
    }
    // 部分先読み・再取得とは別に、実際に参照された同梱ファイルの全容量も数える。
    const unique = [...new Map(resources.filter((r) => r.sourceBytes !== null).map((r) => [r.url, r])).values()];
    const uniqueCategories = {};
    for (const r of unique) {
      const g = uniqueCategories[r.category] ||= { files: 0, sourceBytes: 0 };
      g.files++; g.sourceBytes += r.sourceBytes;
    }
    const result = {
      name, requests: resources.length,
      networkBodyBytes: resources.reduce((s, r) => s + r.networkBodyBytes, 0),
      decodedBodyBytes: resources.reduce((s, r) => s + r.decodedBodyBytes, 0),
      cachedRequests: resources.filter((r) => r.cached || r.revalidated).length,
      unfinishedRequests: resources.filter((r) => !r.complete).length,
      externalRequests: resources.filter((r) => r.external).length,
      externalNetworkBodyBytes: resources.filter((r) => r.external).reduce((s, r) => s + r.networkBodyBytes, 0),
      // BGMの切替で未完の先読みを止めるERR_ABORTEDは、通信障害とは別に残す。
      abortedAudioRequests: resources.filter((r) => r.category === "audio" && r.failed === "net::ERR_ABORTED").length,
      failures: resources.filter((r) => (r.failed && !(r.category === "audio" && r.failed === "net::ERR_ABORTED")) || r.status >= 400), categories, resources,
      uniqueSourceFiles: unique.length, uniqueSourceBytes: unique.reduce((s, r) => s + r.sourceBytes, 0), uniqueCategories,
    };
    phases.push(result);
    return result;
  }
  function write(file, metadata = {}) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      measuredAt: new Date().toISOString(), base, ...metadata,
      methodology: "Chromium CDP Network events, subtracting known response headers and capping completed bodies at Content-Length when available; cache/304 bodies count as zero network bytes. Unfinished/canceled audio is a lower bound at the snapshot, not a complete download. uniqueSourceBytes sums the full local files actually requested, once per URL, separately from external transfers and partial media buffering or cache. Interpret transfers with the chosen host's caching/compression/range behavior; local observations are not public hosting measurements.",
      phases,
    }, null, 2) + "\n");
  }
  return { snapshot, write, settle };
}
