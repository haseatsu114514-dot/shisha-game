// 公開版は頻繁に更新されるため、コードと台詞を Cache Storage に保存しない。
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // 画像・音声は通常のブラウザ経路を保つ。毎回 SW から取り直す必要はなく、
  // 画像の失敗・遅延を扱う呼び出し側の通信にも介入しない。
  if (request.mode !== "navigate" && !/\.(?:html?|m?js|css|json)$/i.test(url.pathname)) return;
  // core/data.js・chapter-data.js・trpg は no-cache で必ず再検証する。
  // すでに鮮度を指定した通信は再発行せず、その cache・signal 等を尊重する。
  if (["no-cache", "no-store", "reload"].includes(request.cache)) return;
  event.respondWith(fetch(new Request(request, { cache: "no-store" })));
});
