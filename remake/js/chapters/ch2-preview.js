// 第2章の街歩きだけを独立して試遊する。本編の起動・進行フック・保存APIを呼ばない。
import { DB, loadAll } from "../core/data.js";
import { newState, setState, state } from "../core/state.js";
import { el } from "../core/util.js";
import { storeLogo } from "../core/store-logos.js";
import { TRAIN_ICON_SVG } from "../core/train-icon.js";
import { initLayers, layers, setBg, imageReady } from "../core/ui.js";
import { unlockAudio } from "../core/audio.js";
import { play, vnTest, keepSeenLinesInMemory } from "../vn/engine.js";

import { MAP, STATION, STOPS, ROOMS, loadCityDialogues } from "./ch2-city-data.js";
const visited = new Set();
let arrivalRead = false;
let scene = "loading";
let time = "day";
let busy = false;
let initialized = false;
let mapAvailable = false;
let liveStatus;
let activeScene = null;
let pageActive = true;
let previewEpoch = 0;

function fitStage() {
  const width = window.visualViewport?.width || innerWidth;
  const height = window.visualViewport?.height || innerHeight;
  document.getElementById("stage").style.setProperty("--k", String(Math.min(width / 1280, height / 720)));
}

function resetPreview() {
  const scratch = newState();
  scratch.chapter = 2;
  scratch.phase = "opening";
  // 第1章を終えた主人公の既知の顔。第2章の新しい訪問先の相手は名乗るまで未知。
  for (const id of ["hajime", "sumi", "naru", "adam", "minto", "tsumugi", "rin", "dr_kemuri", "pakki", "nagumo"]) {
    scratch.met[id] = true;
    scratch.flags[`_intro_${id}`] = true;
  }
  setState(scratch); // メモリ参照の差替えだけ。既存save/config/手動枠には触れない。
  keepSeenLinesInMemory(); // 会話の既読も本編の端末保存へ書かない
  visited.clear();
  arrivalRead = false;
  time = "day";
}

function say(text) { if (liveStatus) liveStatus.textContent = text; }
function stillCurrent(owner) { return pageActive && previewEpoch === owner; }
function focusTest(test) {
  requestAnimationFrame(() => layers.screen.querySelector(`[data-test="${test}"]`)?.focus());
}
function button(label, test, action, className = "btn") {
  return el("button", { type: "button", class: className, text: label, dataset: { test }, onclick: action, disabled: busy });
}
function setBusy(value) {
  busy = value;
  if (!layers.screen) return; // 初回bootでinitLayersするまでは、操作できる画面はまだない。
  layers.screen.setAttribute("aria-busy", String(value));
  for (const btn of layers.screen.querySelectorAll("button")) btn.disabled = value;
}
async function perform(action) {
  if (busy) return;
  const owner = previewEpoch;
  setBusy(true);
  try { await action(); }
  catch (error) {
    if (!stillCurrent(owner)) return;
    console.error("[ch2-preview]", error);
    renderActionError(action);
  } finally { if (stillCurrent(owner)) setBusy(false); }
}

async function showMapBackground() {
  const owner = previewEpoch;
  const url = MAP[time];
  const available = await imageReady(url, 15000);
  if (!stillCurrent(owner)) return false;
  mapAvailable = available;
  await setBg(mapAvailable ? url : null, { instant: true });
  return stillCurrent(owner);
}

function renderEntry() {
  scene = "entry";
  layers.hud.replaceChildren();
  layers.screen.replaceChildren(el("main.ch2-shell.ch2-entry", { dataset: { test: "ch2-preview-entry" } }, [
    el("div.ch2-entry-card", [
      el("p.ch2-kicker", { text: "水煙前線 -EN:CODE- / CHAPTER 02" }),
      el("h1", [el("small", { text: "第2章・街歩き試遊" }), "柚ヶ谷"]),
      el("p.ch2-entry-description", { text: "地元の大会の、その先へ。隣町の大きな駅を出ると、人の流れと、まだ知らない煙が待っている。" }),
      el("p.ch2-preview-note", { text: "街と4つの訪問先・県大会ホールの挨拶、準備中の室内見学を遊べます。あげはも県大会のライバルです。日常の続きと県大会は未収録。本編と別に進み、本編のセーブは変更せず、再読み込みでリセットされます。" }),
      el("div.ch2-actions", [button("隣町へ向かう", "ch2-preview-start", () => perform(startPreview), "btn primary"), el("a.ch2-text-link", { href: "index.html", text: "本編タイトルへ" })]),
      el("p.ch2-entry-controls", { text: "会話：クリック・タップ・Enter ／ 地図：行き先を選ぶ" }),
    ]),
  ]));
  focusTest("ch2-preview-start");
}

async function playScene(id, label) {
  const generation = previewEpoch;
  scene = id;
  if (!DB.dialogues[`ch2_city_${id}`]) throw new Error(`試遊の場面が見つかりません: ${id}`);
  layers.hud.replaceChildren(el("div.ch2-vn-label", { text: `第2章・街歩き試遊 ／ ${label}` }));
  const owner = new AbortController();
  activeScene = owner;
  const result = await play(`ch2_city_${id}`, { signal: owner.signal });
  if (activeScene === owner) activeScene = null;
  layers.hud.replaceChildren();
  return !!result && !result.cancelled && stillCurrent(generation);
}

async function startPreview() {
  const owner = previewEpoch;
  const stationAvailable = await imageReady(STATION, 15000);
  if (!stillCurrent(owner)) return;
  if (stationAvailable) await setBg(STATION, { instant: true });
  else if (!await showMapBackground()) return;
  if (!stillCurrent(owner)) return;
  if (!await playScene("arrival", stationAvailable ? "隣町の駅前" : "隣町の駅前（街の地図を表示中）")) return;
  if (!await showMapBackground()) return;
  arrivalRead = true;
  state.phase = "daily";
  renderMap();
  say("柚ヶ谷に到着しました。地図から行き先を選んでください。");
  focusTest("ch2-preview-pin-ageha");
}

function mapPin(stop, index) {
  const read = visited.has(stop.id);
  const pin = el("button.ch2-pin", {
    type: "button", class: `${read ? "read " : ""}${stop.id === "c_station" ? "c-station" : stop.id}`,
    disabled: busy, dataset: { test: `ch2-preview-pin-${stop.id}`, read: String(read) },
    "aria-label": `${stop.name}、${read ? "挨拶を読了、もう一度話す" : "初めて訪れる"}`,
    onclick: () => perform(async () => {
      if (!await playScene(stop.id, stop.sceneLabel || `${stop.name}の入口`)) return;
      visited.add(stop.id);
      state.flags[`_ch2_city_visit_${stop.id}`] = true;
      if (stop.id !== "c_station") state.flags._ch2_city_met_shop = true;
      if (ROOMS[stop.id]) renderStopMenu(stop);
      else renderMap();
      say(`${stop.name}での挨拶を読みました。${visited.size}か所、全${STOPS.length}か所。`);
      focusTest(ROOMS[stop.id] ? "ch2-preview-inside" : (allRead() ? "ch2-preview-station" : `ch2-preview-pin-${stop.id}`));
    }),
  }, [
    el("span.ch2-pin-num", { text: read ? "✓" : String(index + 1), "aria-hidden": "true" }),
    el("span.ch2-pin-title", { text: stop.name }),
    el("span.ch2-pin-caption", { text: read ? "もう一度話す" : "初めて訪れる" }),
  ]);
  return el("li", { style: { left: `${stop.x}%`, top: `${stop.y}%` } }, [pin]);
}

function renderStopMenu(stop, imageFailed = false) {
  scene = `${stop.id}_visit`;
  layers.screen.replaceChildren(el("main.ch2-shell.ch2-stop", { dataset: { test: "ch2-preview-stop", stop: stop.id } }, [
    el("div.ch2-stop-card", [
      el("p.ch2-kicker", { text: "CHAPTER 02 / はじめての顔合わせ" }),
      storeLogo(`ch2_${stop.id}`, { width: 240, height: 140 }),
      el("h1", { text: stop.sceneLabel || stop.name }),
      el("p", { text: "挨拶を終えた。少し中を見せてもらってから、次の場所へ向かおう。" }),
      imageFailed ? el("p.ch2-room-warning", { role: "status", text: "店内の背景を読み込めませんでした。再読み込みするか、地図へ戻れます。" }) : null,
      el("div.ch2-actions", [
        button(imageFailed ? "室内の背景を再読み込み" : "店内をのぞく", "ch2-preview-inside", () => perform(() => visitInside(stop)), "btn primary"),
        button("地図へ戻る", "ch2-preview-back-map", () => perform(async () => {
          if (!await showMapBackground()) return;
          renderMap();
          focusTest(`ch2-preview-pin-${stop.id}`);
        })),
      ]),
    ]),
  ]));
}

async function visitInside(stop) {
  const owner = previewEpoch;
  const available = await imageReady(ROOMS[stop.id], 15000);
  if (!stillCurrent(owner)) return;
  if (!available) {
    renderStopMenu(stop, true);
    say("店内の背景を読み込めませんでした。再読み込み、または地図へ戻るを選んでください。");
    focusTest("ch2-preview-inside");
    return;
  }
  layers.screen.replaceChildren();
  await setBg(ROOMS[stop.id], { instant: true });
  if (!stillCurrent(owner)) return;
  if (!await playScene(`${stop.id}_inside`, `${stop.sceneLabel || stop.name}・準備中の室内`)) return;
  state.flags[`_ch2_city_inside_${stop.id}`] = true;
  if (!await showMapBackground()) return;
  renderMap();
  say(`${stop.name}の見学を終えました。`);
  focusTest(allRead() ? "ch2-preview-station" : `ch2-preview-pin-${stop.id}`);
}

function allRead() { return arrivalRead && visited.size === STOPS.length; }

function renderMap() {
  scene = "map";
  layers.hud.replaceChildren();
  const station = el("li", { style: { left: "15%", top: "34%" } }, [
    el("button.ch2-pin.station", { type: "button", disabled: busy, dataset: { test: "ch2-preview-station" }, "aria-label": "駅へ戻り、試遊を終える", onclick: () => perform(returnHome) }, [
      el("span.ch2-pin-num.train-icon", { html: TRAIN_ICON_SVG }),
      el("span.ch2-pin-title", { text: "駅へ戻る" }),
      el("span.ch2-pin-caption", { text: "地元へ戻る" }),
    ]),
  ]);
  const map = el("main.ch2-shell.ch2-map", { class: mapAvailable ? "" : "is-map-missing", dataset: { test: "ch2-preview-map", time, phase: mapAvailable ? "ready" : "unavailable" } }, [
    el("header.ch2-map-header", [
      el("div", [
        el("p.ch2-kicker", { text: "CHAPTER 02 / 同じ県の、隣町へ" }),
        el("h1", { text: "柚ヶ谷" }),
        el("p", { text: `${time === "day" ? "昼" : "夜"}の駅前　｜　気になる店の入口へ。訪問の順番は自由です。` }),
      ]),
      el("div.ch2-time-control", { role: "group", "aria-label": "街の昼夜を切り替える" }, [
        ...[["day", "昼"], ["night", "夜"]].map(([value, label]) => el("button", {
          type: "button", text: label, disabled: busy, "aria-pressed": String(time === value), dataset: { test: `ch2-preview-${value}` },
          onclick: () => { if (time !== value) perform(() => changeTime(value)); },
        })),
      ]),
    ]),
    el("ul.ch2-map-pins", { "aria-label": "行き先" }, [...STOPS.map(mapPin), station]),
    el("aside.ch2-map-summary", [
      el("h2", { text: allRead() ? "初めての顔合わせを終えた" : "街の入口を、ひと巡り" }),
      el("div.ch2-progress", { dataset: { test: "ch2-preview-progress" }, "aria-label": `読了した訪問先は${STOPS.length}か所中${visited.size}か所` }, [
        `${visited.size} / ${STOPS.length}`, el("small", { text: "か所読了" }),
      ]),
      el("p", { text: allRead() ? "今日はここまで。駅へ戻り、地元の店へ持ち帰ろう。" : "店と会場で短い挨拶ができます。途中でも、駅から地元へ戻れます。" }),
    ]),
    el("footer.ch2-map-footer", [
      el("p", { text: "第2章・街歩き試遊　｜　初日の街歩き・県大会未収録・セーブ変更なし" }),
      el("a.ch2-text-link", { href: "index.html", text: "本編タイトルへ" }),
    ]),
  ]);
  if (!mapAvailable) {
    map.append(el("div.ch2-map-warning", { role: "status" }, [
      el("span", { text: "街の背景を読み込めませんでした。行き先は引き続き選べます。" }),
      button("再読み込み", "ch2-preview-retry-map", () => perform(async () => {
        if (!await showMapBackground()) return;
        renderMap();
        say(mapAvailable ? "街の背景を読み込みました。" : "街の背景を読み込めませんでした。");
        focusTest(mapAvailable ? "ch2-preview-pin-ageha" : "ch2-preview-retry-map");
      })),
    ]));
  }
  layers.screen.replaceChildren(map);
}

async function changeTime(value) {
  time = value;
  state.slot = time === "night" ? 1 : 0;
  if (!await showMapBackground()) return;
  renderMap();
  say(`${time === "day" ? "昼" : "夜"}の街に切り替えました。`);
  focusTest(`ch2-preview-${time}`);
}

async function returnHome() {
  if (!await playScene("return", "地元へ帰る列車")) return;
  renderEnd();
  say("街歩きの試遊を終了しました。");
  focusTest("ch2-preview-restart");
}

function renderEnd() {
  scene = "end";
  const complete = allRead();
  layers.screen.replaceChildren(el("main.ch2-shell.ch2-end", { dataset: { test: "ch2-preview-end", complete: String(complete) } }, [
    el("div.ch2-end-card", [
      el("p.ch2-kicker", { text: "CHAPTER 02 / 街歩き試遊" }),
      el("p.ch2-end-badge", { text: complete ? "すべての入口で、顔合わせを終えた" : "今日は、ここまで" }),
      el("h1", { text: "知らない煙を、地元へ。" }),
      el("p.ch2-end-description", { text: "駅前の光が、列車の窓を流れていく。新しい街に、また訪ねたい場所ができた。第2章の続きは、ここから。" }),
      el("p.ch2-end-progress", { text: `訪問した入口　${visited.size} / ${STOPS.length}か所` }),
      el("p.ch2-preview-note", { text: "今回は街・挨拶・準備中の室内見学までです。新登場3人は通常立ち絵を制作しました。日常の続き・県大会・表情差分は今後制作します。この試遊では本編のセーブは変更していません。" }),
      el("div.ch2-actions", [
        button("もう一度、街を訪れる", "ch2-preview-restart", () => perform(async () => {
          resetPreview();
          if (!await showMapBackground()) return;
          renderEntry();
        }), "btn primary"),
        el("a.ch2-text-link", { href: "index.html", text: "本編タイトルへ" }),
      ]),
    ]),
  ]));
}

function renderLoading(message = "街の台本を読み込んでいます…") {
  scene = "loading";
  layers.screen.replaceChildren(el("main.ch2-shell.ch2-loading", [
    el("h1", { text: "第2章・街歩き試遊" }), el("p", { text: message, role: "status" }),
  ]));
}

function renderActionError(retry) {
  scene = "error";
  layers.hud.replaceChildren();
  layers.screen.replaceChildren(el("main.ch2-shell.ch2-error", [
    el("div.ch2-error-card", [
      el("p.ch2-kicker", { text: "CHAPTER 02 / 街歩き試遊" }),
      el("h1", { text: "試遊を読み込めませんでした" }),
      el("p", { text: "通信を確認して、もう一度お試しください。本編のセーブは変更していません。" }),
      el("div.ch2-actions", [
        button("もう一度試す", "ch2-preview-retry", () => perform(retry), "btn primary"),
        el("a.ch2-text-link", { href: "index.html", text: "本編タイトルへ" }),
      ]),
    ]),
  ]));
  say("試遊を読み込めませんでした。もう一度試すボタンで再試行できます。");
  focusTest("ch2-preview-retry");
}

export async function boot() {
  if (!initialized) {
    initialized = true;
    fitStage();
    window.addEventListener("resize", fitStage);
    window.visualViewport?.addEventListener("resize", fitStage);
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("pagehide", () => {
      pageActive = false;
      previewEpoch++;
      activeScene?.abort();
    });
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      previewEpoch++;
      pageActive = true;
      // ブラウザ履歴から戻った場合は、中断した会話を完走扱いにしない。
      resetPreview();
      setBusy(false);
      renderEntry();
    });
    initLayers();
    liveStatus = el("div.ch2-live-status", { role: "status", "aria-live": "polite", "aria-atomic": "true" });
    document.getElementById("stage").append(liveStatus);
    window.__ch2Preview = {
      get state() { return state; },
      get visited() { return [...visited]; },
      get scene() { return scene; },
      vnTest,
    };
  }
  const generation = previewEpoch;
  renderLoading();
  resetPreview();
  await loadAll();
  if (!stillCurrent(generation)) return;
  await loadCityDialogues();
  if (!stillCurrent(generation)) return;
  await document.fonts.ready;
  if (!stillCurrent(generation)) return;
  renderLoading("街の背景を準備しています…");
  if (!await showMapBackground()) return;
  renderEntry();
}

await perform(boot);
