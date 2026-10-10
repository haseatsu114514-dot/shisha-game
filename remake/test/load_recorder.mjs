// 通信本文・キャッシュ・未完の音声・実際に参照したファイル容量を混同しないための検査。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { recordLoad } from "../tools/load-recorder.mjs";

const cdp = new EventEmitter(); cdp.send = async () => ({});
const page = { context: () => ({ newCDPSession: async () => cdp }) };
const load = await recordLoad(page, "http://localhost/shisha-game/remake/");
const source = fs.statSync(fileURLToPath(new URL("../index.html", import.meta.url))).size;
const request = (id, url, extra = {}) => cdp.emit("Network.requestWillBeSent", { requestId: id,
  request: { url: `http://localhost/shisha-game/${url}` }, ...extra });
const response = (id, extra = {}) => cdp.emit("Network.responseReceived", { requestId: id,
  response: { status: 200, encodedDataLength: 100, headers: {}, ...extra } });
const finish = (id, bytes) => cdp.emit("Network.loadingFinished", { requestId: id, encodedDataLength: bytes });

request("cold", "remake/"); response("cold"); finish("cold", source + 100);
let p = load.snapshot("cold");
assert.equal(p.networkBodyBytes, source, "HTTP headers must not count as game bytes");
assert.equal(p.uniqueSourceBytes, source, "A Pages subdirectory must resolve to the local index.html");

request("cache", "remake/"); cdp.emit("Network.requestServedFromCache", { requestId: "cache" });
response("cache"); finish("cache", source);
// ExtraInfoの304通知はrequestイベントより早く届く場合もある。
cdp.emit("Network.responseReceivedExtraInfo", { requestId: "304", statusCode: 304 });
request("304", "remake/"); response("304"); finish("304", source + 100);
p = load.snapshot("warm");
assert.equal(p.networkBodyBytes, source); assert.equal(p.cachedRequests, 2);
assert.equal(p.uniqueSourceBytes, source, "Cached copies must not duplicate the resource footprint");

request("audio", "assets/audio/bgm/title.mp3"); response("audio");
cdp.emit("Network.dataReceived", { requestId: "audio", dataLength: 16384, encodedDataLength: 0 });
request("gzip", "remake/js/main.js"); response("gzip", { headers: { "Content-Encoding": "gzip" } });
cdp.emit("Network.dataReceived", { requestId: "gzip", dataLength: 1000, encodedDataLength: 200 });
p = load.snapshot("partial");
assert.equal(p.resources.find((r) => r.category === "audio").networkBodyBytes, 16384);
assert.equal(p.resources.find((r) => r.url.endsWith("main.js")).networkBodyBytes, 200);
assert.equal(p.unfinishedRequests, 2);
assert.ok(p.uniqueSourceBytes > source + 6000000, "A partial music buffer must still report the full referenced asset separately");

request("redirect", "redirect"); response("redirect", { status: 302 });
request("redirect", "remake/", { timestamp: 123, redirectResponse: { encodedDataLength: 100 } });
response("redirect"); finish("redirect", source + 100);
request("missing", "missing.json"); response("missing", { status: 404 }); finish("missing", 104);
p = load.snapshot("redirect-and-failure");
assert.equal(p.resources.filter((r) => r.url.endsWith("/redirect"))[0].complete, true);
assert.equal(p.failures.length, 1); assert.equal(p.failures[0].status, 404);
assert.equal(p.resources.find((r) => r.url.endsWith("missing.json")).sourceBytes, null);
console.log("PASS load recorder: response bodies, cache/304, partial audio, gzip, unique asset sizes, redirects and failures");
