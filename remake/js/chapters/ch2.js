// 第2章「才能の壁」初日。第1章の状態を引き継ぎ、読んだ場面の区切りだけを保存する。
import { DB, bgUrl } from "../core/data.js";
import { el, yen } from "../core/util.js";
import { storeLogo } from "../core/store-logos.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { chapterDay, chapterDaysLeft } from "../core/chapter-clock.js";
import { layers, showScreen, setBg, imageReady, chapterTitle, modal } from "../core/ui.js";
import { showHud } from "../daily/hud.js";
import { openStatus } from "../daily/status.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play } from "../vn/engine.js";
import { MAP, STATION, STOPS, ROOMS, loadChapterTwoDialogues, loadPreparationDialogues } from "./ch2-city-data.js";
import { advanceToChapterTwo, dayOneProgress, cityVisits, recordCityVisit } from "./ch2-progress.js";

let session = null;
let watchingHistory = false;
const current = owner => session === owner && owner.active && state === owner.state;
const test = name => `ch2-main-${name}`;
const progress = () => dayOneProgress(state);

function button(label, name, action, primary = false, disabled = false) {
  return el(`button.btn${primary ? ".primary" : ""}`, { type: "button", text: label, dataset: { test: test(name) }, disabled: session?.busy || disabled, onclick: () => perform(action) });
}
function focus(name) { requestAnimationFrame(() => layers.screen.querySelector(`[data-test="${test(name)}"]`)?.focus()); }
function busy(value) {
  session.busy = value;
  layers.screen.setAttribute("aria-busy", String(value));
  for (const node of layers.screen.querySelectorAll("button")) node.disabled = value || node.dataset.locked === "true";
}
async function perform(action) {
  if (!session || session.busy || !current(session)) return;
  const owner = session;
  busy(true);
  try { await action(); }
  catch (error) {
    if (current(owner)) {
      console.error("[ch2]", error);
      renderError(() => openChapter(state.chapter === 1));
    }
  } finally { if (current(owner)) busy(false); }
}

export function beginChapterTwo() {
  if (state.chapter !== 1 || state.phase !== "cleared") return false;
  return openChapter(true);
}
export function resumeChapterTwo() { return openChapter(false); }

async function openChapter(advance) {
  if (session) { session.active = false; session.controller?.abort(); }
  session = { state, active: true, busy: false, controller: null, scene: "loading", mapAvailable: false };
  document.body.classList.remove("ch2-tournament");
  document.body.classList.add("ch2-city");
  showHud(false);
  if (!watchingHistory) {
    watchingHistory = true;
    window.addEventListener("pagehide", () => {
      if (!session) return;
      session.active = false;
      session.controller?.abort();
    });
    window.addEventListener("pageshow", event => {
      if (event.persisted && state?.chapter === 2) { requestResumeOnBoot(); location.reload(); }
    });
    window.__ch2Main = { get scene() { return session?.scene; } };
  }
  showScreen("ch2-loading", el("main.ch2-shell.ch2-loading", [el("h1", { text: "第二章・才能の壁" }), el("p", { text: "街の台本を準備しています…", role: "status" })]));
  await perform(async () => {
    const owner = session;
    if (!advance && state.chapter === 2 && (chapterDay(state) >= 14 || state.flags._ch2_tournament)) {
      await tournament(); return;
    }
    await loadChapterTwoDialogues();
    if (!current(owner)) return;
    // 必要台本を読み込めた後で初めて保存を次章へ進める。通信失敗でクリア記録を失わない。
    if (advance) {
      if (!advanceToChapterTwo(state)) return;
      save();
    }
    if (state.chapter !== 2) return;
    if (chapterDay(state) > 1 || state.flags._ch2_preparation_started) await continuePreparation();
    else await continueDayOne();
  });
}

async function checkpoint(stage) {
  progress().stage = stage;
  state.phase = ["departure", "arrival"].includes(stage) ? "opening" : "daily";
  save();
}

async function scene(id, label, background) {
  const owner = session;
  if (!DB.dialogues[id]) throw new Error(`台本がありません: ${id}`);
  owner.scene = id;
  if (background) {
    await setBg(background, { instant: true });
    if (!current(owner)) return false;
  }
  showScreen("none", null);
  layers.hud.replaceChildren(el("div.ch2-vn-label", { text: `第2章・DAY ${chapterDay(state)} ／ ${label}` }));
  const controller = new AbortController();
  owner.controller = controller;
  const result = await play(id, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  if (!current(owner)) return false;
  layers.hud.replaceChildren();
  return !!result && !result.cancelled;
}

async function mapBackground() {
  const owner = session;
  const ready = await imageReady(MAP.day, 15000);
  if (!current(owner)) return false;
  owner.mapAvailable = ready;
  await setBg(ready ? MAP.day : null, { instant: true });
  return current(owner);
}

async function continueDayOne() {
  const owner = session;
  for (;;) {
    if (!current(owner)) return;
    const stage = progress().stage;
    if (stage === "departure") {
      if (!progress().titleSeen) {
        await setBg(bgUrl("bg_tonari_inside", "day"), { instant: true });
        await chapterTitle({ no: "第二章", name: "才能の壁", read: "ホロウ・クラウン ── Hollow Crown", sub: "HAZE: OPEN CLOUD 編" });
        if (!current(owner)) return;
        progress().titleSeen = true;
        save();
      }
      if (!await scene("remake_ch2_departure", "隣町へ出発", bgUrl("bg_tonari_inside", "day"))) return;
      await checkpoint("arrival");
    } else if (stage === "arrival") {
      const ready = await imageReady(STATION, 15000);
      if (!current(owner)) return;
      if (!await scene("ch2_city_arrival", "隣町の駅前", ready ? STATION : MAP.day)) return;
      await checkpoint("map");
    } else if (stage === "map") {
      if (!await mapBackground()) return;
      renderMap();
      focus(cityVisits(state).has("c_station") ? "return" : "pin-c_station");
      return;
    } else if (stage === "return") {
      if (!await scene("ch2_city_return", "地元へ帰る列車", MAP.night)) return;
      state.slot = 1;
      await checkpoint("tonari");
    } else if (stage === "tonari") {
      if (!await scene("remake_ch2_day1_night", "tonariへ戻る", bgUrl("bg_tonari_inside", "night"))) return;
      state.slot = 2;
      await checkpoint("complete");
    } else if (stage === "complete") {
      await setBg(bgUrl("bg_tonari_inside", "night"), { instant: true });
      if (!current(owner)) return;
      renderComplete();
      focus("menu");
      return;
    } else throw new Error(`初日の保存地点を確認してください: ${stage}`);
  }
}

async function visit(stop) {
  if (!await scene(`ch2_city_${stop.id}`, stop.sceneLabel || stop.name)) return;
  recordCityVisit(state, stop.id);
  save();
  if (ROOMS[stop.id]) renderStop(stop);
  else { renderMap(); focus("return"); }
}

function renderStop(stop, failed = false) {
  session.scene = "stop";
  showScreen("ch2-stop", el("main.ch2-shell.ch2-stop", { dataset: { test: test("stop"), stop: stop.id } }, [el("div.ch2-stop-card", [
    el("p.ch2-kicker", { text: "第2章・DAY1 / 街の顔合わせ" }),
    storeLogo(`ch2_${stop.id}`, { width: 240, height: 140 }),
    el("h1", { text: stop.sceneLabel || stop.name }),
    el("p", { text: "少し中を見せてもらうか、次の場所へ向かおう。" }),
    failed ? el("p.ch2-room-warning", { role: "status", text: "室内を読み込めませんでした。再読み込みするか、地図へ戻れます。" }) : null,
    el("div.ch2-actions", [
      button(failed ? "室内を再読み込み" : "店内をのぞく", "inside", async () => {
        const owner = session;
        const ready = await imageReady(ROOMS[stop.id], 15000);
        if (!current(owner)) return;
        if (!ready) { renderStop(stop, true); return; }
        if (!await scene(`ch2_city_${stop.id}_inside`, stop.sceneLabel || stop.name, ROOMS[stop.id])) return;
        state.flags[`_ch2_city_inside_${stop.id}`] = true;
        save();
        if (!await mapBackground()) return;
        renderMap(); focus(`pin-${stop.id}`);
      }, true),
      button("地図へ戻る", "back-map", async () => { if (await mapBackground()) { renderMap(); focus(`pin-${stop.id}`); } }),
    ]),
  ])]));
  focus("inside");
}

async function returnHome() {
  if (!cityVisits(state).has("c_station")) return;
  await checkpoint("return");
  await continueDayOne();
}

function renderMap() {
  session.scene = "map";
  layers.hud.replaceChildren();
  const visited = cityVisits(state), canReturn = visited.has("c_station");
  const pin = (stop, index) => el("li", { style: { left: `${stop.x}%`, top: `${stop.y}%` } }, [
    el("button.ch2-pin", { type: "button", class: `${visited.has(stop.id) ? "read " : ""}${stop.id === "c_station" ? "c-station" : stop.id}`, disabled: session.busy,
      dataset: { test: test(`pin-${stop.id}`), read: String(visited.has(stop.id)) }, onclick: () => perform(() => visit(stop)),
      "aria-label": `${stop.name}、${visited.has(stop.id) ? "もう一度話す" : "初めて訪れる"}` }, [
      el("span.ch2-pin-num", { text: visited.has(stop.id) ? "✓" : String(index + 1), "aria-hidden": "true" }),
      el("span.ch2-pin-title", { text: stop.name }), el("span.ch2-pin-caption", { text: visited.has(stop.id) ? "もう一度話す" : "初めて訪れる" }),
    ]),
  ]);
  const home = button("駅へ戻る", "return", returnHome, canReturn, !canReturn);
  home.dataset.locked = String(!canReturn);
  const station = el("button.ch2-pin.station", { type: "button", disabled: session.busy || !canReturn, dataset: { test: test("station"), locked: String(!canReturn) }, onclick: () => perform(returnHome), "aria-label": canReturn ? "駅から地元へ戻る" : "先に県大会ホールを確認する" }, [
    el("span.ch2-pin-num", { text: "↖", "aria-hidden": "true" }), el("span.ch2-pin-title", { text: "駅へ戻る" }), el("span.ch2-pin-caption", { text: "地元へ戻る" }),
  ]);
  const map = el("main.ch2-shell.ch2-map.ch2-map-main", { class: session.mapAvailable ? "" : "is-map-missing", dataset: { test: test("map"), phase: session.mapAvailable ? "ready" : "unavailable" } }, [
    el("header.ch2-map-header", [
      el("div", [el("p.ch2-kicker", { text: `第二章・DAY ${chapterDay(state)} / 本番まであと${chapterDaysLeft(state)}日` }), el("h1", { text: "ワイドハンガ街" }), el("p", { text: "まずは県大会ホールを確認しよう。店へ寄る順番は自由です。" })]),
      button("MENU", "menu", openMenu),
    ]),
    el("ul.ch2-map-pins", { "aria-label": "行き先" }, [...STOPS.map(pin), el("li", { style: { left: "15%", top: "34%" } }, [station])]),
    el("aside.ch2-map-summary", [el("h2", { text: canReturn ? "会場までの道を覚えた" : "県大会ホールを確かめよう" }),
      el("div.ch2-progress", { dataset: { test: test("progress") } }, [`${visited.size} / ${STOPS.length}`, el("small", { text: "か所で挨拶" })]),
      el("p", { text: canReturn ? "気になる店を訪ねてからでも、今日はここで地元へ戻っても大丈夫。" : "C.STATIONと同じビルのイベントホール。入口と搬入場所を見ておこう。" }), home]),
    el("footer.ch2-map-footer", [el("p", { text: "初日の街歩き・顔合わせ" }), el("span", { text: `所持金 ${yen(state.money)}` })]),
  ]);
  if (!session.mapAvailable) map.append(el("div.ch2-map-warning", { role: "status" }, [el("span", { text: "地図の絵を読み込めませんでした。行き先は選べます。" }), button("再読み込み", "retry-map", async () => { if (await mapBackground()) renderMap(); })]));
  showScreen("ch2-map", map);
}

async function openMenu() {
  const owner = session;
  const choice = await modal({ title: "MENU", body: `第${state.chapter}章・DAY ${chapterDay(state)} ／ 場面の区切りで自動セーブしています。`, options: [
    { label: "セーブ", value: "save", test: test("save") }, { label: "ロード", value: "load", test: test("load") },
    { label: "ステータス・人間関係", value: "status", test: test("status") }, { label: "タイトルへ戻る", value: "title", test: test("title") },
    { label: "閉じる", value: null, primary: true },
  ] });
  if (!current(owner)) return;
  if (choice === "save") await saveFlow();
  if (choice === "load") {
    const key = await loadFlow({ inGame: true });
    if (key && loadFromSlot(key)) { requestResumeOnBoot(); location.reload(); }
  }
  if (choice === "status") await openStatus();
  if (choice === "title") { save(); location.reload(); }
}

function renderComplete() {
  session.scene = "complete";
  layers.hud.replaceChildren();
  showScreen("ch2-complete", el("main.ch2-shell.ch2-end", { dataset: { test: test("complete") } }, [el("div.ch2-end-card", [
    el("p.ch2-kicker", { text: "第二章・DAY1 / 地元へ戻って" }), el("h1", { text: "次に持っていく、一台。" }),
    el("p.ch2-end-description", { text: "会場までの道を覚えて、tonariへ戻った。鞄の中には、大会の案内。初めての街で見たものを、少しずつ整理していこう。" }),
    el("p.ch2-preview-note", { text: "明日からは地元と隣町で自由に過ごせます。大会前夜のDAY13まで、行動と交流、物語が続きます。DAY14は県大会本戦です。" }),
    el("div.ch2-actions", [button("翌日へ", "next-day", continuePreparation, true), button("セーブ・メニュー", "menu", openMenu)]),
  ])]));
}

async function continuePreparation() {
  const owner = session;
  // 追加台本に失敗しても、初日の完了保存や翌日の日付を進めない。
  let runChapterTwoPreparation;
  try {
    owner.scene = "preparation-loading";
    await loadPreparationDialogues();
    ({ runChapterTwoPreparation } = await import("./ch2-preparation.js"));
  } catch (error) {
    if (current(owner)) { console.error("[ch2 preparation]", error); renderError(continuePreparation); }
    return;
  }
  if (!current(owner)) return;
  document.body.classList.remove("ch2-city");
  owner.scene = "preparation";
  layers.screen.removeAttribute("aria-busy"); // 日常の地図は入力待ち。章のロード中として読み上げを止めない。
  await runChapterTwoPreparation();
  if (!current(owner)) return;
  await tournament();
}

async function tournament() {
  session.scene = "tournament";
  showHud(false);
  await (await import("./ch2-tournament.js")).runChapterTwoTournament();
}

function renderError(retry) {
  session.scene = "error";
  layers.hud.replaceChildren();
  showScreen("ch2-error", el("main.ch2-shell.ch2-error", { dataset: { test: test("error") } }, [el("div.ch2-error-card", [
    el("h1", { text: "第2章を読み込めませんでした" }), el("p", { text: "通信を確認して、もう一度お試しください。最後に保存した進み具合から再開できます。" }),
    el("div.ch2-actions", [button("もう一度試す", "retry", retry, true), button("セーブ・ロード", "menu", openMenu)]),
  ])]));
  focus("retry");
}
