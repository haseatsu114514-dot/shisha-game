// 公開版は頻繁に更新されるため、ゲームの応答を Cache Storage に保存しない。
// 制御中のページが読む ../data/ の台詞も同一オリジンならここを通る。
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(new Request(request, { cache: "no-store" })));
});
