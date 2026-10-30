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
const musicBytes = fs.statSync(fileURLToPath(new URL("../../assets/audio/bgm/title.mp3", import.meta.url))).size;
const scriptBytes = fs.statSync(fileURLToPath(new URL("../js/main.js", import.meta.url))).size;
const request = (id, url, extra = {}) => cdp.emit("Network.requestWillBeSent", { requestId: id,
  request: { url: `http://localhost/shisha-game/${url}`, headers: extra.headers || {} }, ...extra });
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

request("audio", "assets/audio/bgm/title.mp3", { headers: { Range: "bytes=0-" } });
response("audio", { status: 206, headers: { "Content-Range": `bytes 0-${musicBytes - 1}/${musicBytes}` } });
cdp.emit("Network.dataReceived", { requestId: "audio", dataLength: 16384, encodedDataLength: 0 });
request("gzip", "remake/js/main.js"); response("gzip", { headers: { "Content-Encoding": "gzip" } });
cdp.emit("Network.dataReceived", { requestId: "gzip", dataLength: 1000, encodedDataLength: 200 });
p = load.snapshot("partial");
assert.equal(p.resources.find((r) => r.category === "audio").networkBodyBytes, 16384);
assert.equal(p.resources.find((r) => r.url.endsWith("main.js")).networkBodyBytes, 200);
assert.equal(p.unfinishedRequests, 2);
assert.equal(p.resources.find((r) => r.category === "audio").range, "bytes=0-");
assert.equal(p.resources.find((r) => r.category === "audio").contentRange, `bytes 0-${musicBytes - 1}/${musicBytes}`);
assert.equal(p.resources.find((r) => r.category === "audio").sourceBytes, musicBytes, "A partial music buffer must still report the full referenced asset separately");
assert.equal(p.uniqueSourceBytes, source + musicBytes + scriptBytes);

request("redirect", "redirect"); response("redirect", { status: 302 });
request("redirect", "remake/", { timestamp: 123, redirectResponse: { encodedDataLength: 100 } });
response("redirect"); finish("redirect", source + 100);
request("missing", "missing.json"); response("missing", { status: 404 }); finish("missing", 104);
p = load.snapshot("redirect-and-failure");
assert.equal(p.resources.filter((r) => r.url.endsWith("/redirect"))[0].complete, true);
assert.equal(p.failures.length, 1); assert.equal(p.failures[0].status, 404);
assert.equal(p.resources.find((r) => r.url.endsWith("missing.json")).sourceBytes, null);
cdp.emit("Network.loadingFailed", { requestId: "audio", errorText: "net::ERR_ABORTED" });
request("broken-audio", "assets/audio/bgm/title.mp3");
cdp.emit("Network.loadingFailed", { requestId: "broken-audio", errorText: "net::ERR_CONNECTION_RESET" });
p = load.snapshot("audio-switch-and-real-failure");
assert.equal(p.abortedAudioRequests, 1);
assert.equal(p.failures.length, 2, "Normal BGM switches must not hide real audio/HTTP failures");
assert.equal(p.resources.find((r) => r.range).networkBodyBytes, 16384, "Aborted buffering still consumed bytes");
cdp.emit("Network.requestWillBeSent", { requestId: "external", request: { url: "https://example.org/music.mp3" } });
response("external", { encodedDataLength: 0, headers: { "Content-Length": "1000" } });
finish("external", 1010);
p = load.snapshot("external-http2");
assert.equal(p.externalRequests, 1); assert.equal(p.externalNetworkBodyBytes, 1000);
assert.equal(p.resources.find((r) => r.external).sourceBytes, null, "External audio must not masquerade as a bundled file");
console.log("PASS load recorder: body bytes, cache/304, ranges, partial/aborted audio, gzip, unique sizes, redirects and failures");
