import { CH2_CITY_NAME, CH2_CITY_EN } from "../core/city-locations.js";
// 第2章「才能の壁」初日。第1章の状態を引き継ぎ、読んだ場面の区切りだけを保存する。
import { DB, bgUrl } from "../core/data.js";
import { el, yen } from "../core/util.js";
import { storeLogo } from "../core/store-logos.js";
import { state, save, loadFromSlot, requestResumeOnBoot } from "../core/state.js";
import { chapterDay, chapterDaysLeft } from "../core/chapter-clock.js";
import { layers, showScreen, setBg, imageReady, chapterTitle, modal, withScenePreparation, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { showHud } from "../daily/hud.js";
import { openStatus } from "../daily/status.js";
import { saveFlow, loadFlow } from "../scenes/saves.js";
import { play } from "../vn/engine.js";
import { glossaryPanel } from "../vn/glossary.js";
import { MAP, STATION, STOPS, ROOMS, loadChapterTwoDialogues, loadPreparationDialogues } from "./ch2-city-data.js";
import { trainRide } from "../core/scene-motions.js";
import { playBgm } from "../core/audio.js";
import { TRAIN_ICON_SVG } from "../core/train-icon.js";
import { advanceToChapterTwo, dayOneProgress, cityVisits, recordCityVisit } from "./ch2-progress.js";

import { acceptChapterTwoDeliveries, deliveryPending, finishChapterTwoDelivery, chapterTwoDeliveriesDone, DELIVERY_STOPS, snapshotDeliveryIdentity, confirmDeliveryIdentity, reconcileDeliveryIdentity } from "./ch2-deliveries.js";
import { openShop } from "../daily/shop.js";
import { openTrpgBar } from "../daily/trpg.js";
import { CITY_OUTINGS, CITY_SHOP, knownCityOutings, introduceCitySpot } from "./ch2-outings.js";

import { offerAgehaPurikura } from "./ch2-purikura.js";

let session = null;
let watchingHistory = false;
const current = owner => session === owner && owner.active && state === owner.state;
const test = name => `ch2-main-${name}`;
const progress = () => dayOneProgress(state);
// 通常の日常・買物と同じ既存曲。J04の街用新曲選定とは分ける。
const CITY_BGM = "kansetsu_shomei_to_black_coffee";

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
  document.body.classList.add("ch2-city", "ch2-main");
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
    // 既存SAVE（配達済みで面識が付いていない）を読んだときに「？」を自然へ直す。
    if (reconcileDeliveryIdentity(state)) save();
    const preparing = chapterDay(state) > 1 || state.flags._ch2_preparation_started;
    playBgm(!preparing && ["departure", "tonari", "complete"].includes(progress().stage) ? "tonari" : CITY_BGM);
    if (preparing) await continuePreparation();
    else await continueDayOne();
  });
}

async function checkpoint(stage) {
  progress().stage = stage;
  state.phase = ["departure", "arrival"].includes(stage) ? "opening" : "daily";
  save();
}

async function scene(id, label, background, dialogue = id) {
  const owner = session;
  showHud(false);
  if (!DB.dialogues[id]) throw new Error(`台本がありません: ${id}`);
  owner.scene = id;
  if (background) {
    await withScenePreparation(setBg(background, { instant: true }));
  }
  if (!current(owner)) return false;
  playBgm(background?.includes("bg_tonari_inside") ? "tonari" : CITY_BGM);
  showScreen("none", null);
  layers.hud.replaceChildren(el("div.ch2-vn-label", { text: `第2章・DAY ${chapterDay(state)} ／ ${label}` }));
  const controller = new AbortController();
  owner.controller = controller;
  const result = await play(dialogue, { signal: controller.signal });
  if (owner.controller === controller) owner.controller = null;
  if (!current(owner)) return false;
  layers.hud.replaceChildren();
  return !!result && !result.cancelled;
}

async function mapBackground() {
  const owner = session;
  const ready = await withScenePreparation(imageReady(MAP.day, 15000));
  if (!current(owner)) return false;
  owner.mapAvailable = ready;
  await withScenePreparation(setBg(ready ? MAP.day : null, { instant: true }));
  if (!current(owner)) return false;
  playBgm(CITY_BGM);
  return true;
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
      if (!state.flags._ch2_deliveries) {
        if (!await scene("remake_ch2_delivery_offer", "スミさんからの配達", bgUrl("bg_tonari_inside", "day"))) return;
        acceptChapterTwoDeliveries(state); save();
      }
      // 電車で隣町へ。車内が通り過ぎる間に駅前へ替える（駅前の絵が遅いときは地図の昼）
      await trainRide(async () => { await setBg(await imageReady(STATION, 15000) ? STATION : MAP.day, { instant: true }); }, { from: "home", to: "widehanga" });
      if (!current(owner)) return;
      await checkpoint("arrival");
    } else if (stage === "arrival") {
      const ready = await withScenePreparation(imageReady(STATION, 15000));
      if (!current(owner)) return;
      if (!await scene("ch2_city_arrival", "隣町の駅前", ready ? STATION : MAP.day)) return;
      await checkpoint("map");
    } else if (stage === "map") {
      if (!await mapBackground()) return;
      renderMap();
      focus(cityVisits(state).has("c_station") ? "station" : "pin-c_station");
      return;
    } else if (stage === "return") {
      if (!await scene("ch2_city_return", "地元へ帰る列車", MAP.night)) return;
      await trainRide(() => setBg(bgUrl("bg_tonari_inside", "night"), { instant: true }), { from: "widehanga", to: "home" });
      if (!current(owner)) return;
      state.slot = 1;
      await checkpoint("tonari");
    } else if (stage === "tonari") {
      // 配達の報告は夜の会話の中で読む（#1706）。締めの後に「それと」で報告を継ぎ足さない。
      if (!await scene("remake_ch2_day1_night", "tonariへ戻る", bgUrl("bg_tonari_inside", "night"))) return;
      if (state.flags._ch2_deliveries?.accepted && !state.flags._ch2_deliveries.reported) {
        state.flags._ch2_deliveries.reported = true; save();
      }
      state.slot = 2;
      await checkpoint("complete");
    } else if (stage === "complete") {
      // 配達報告後は第1章と同じ帰宅・就寝へ。旧版の初日完了SAVEもここから再開する。
      await continuePreparation();
      return;
    } else throw new Error(`初日の保存地点を確認してください: ${stage}`);
  }
}

// 配達で来た初対面は、挨拶の別れ際（ch2_city_<id>_farewell）を読まずに受け渡しへ続ける（#1706）。
// 店内の場面が締めを持つので、別れてから「それと」で呼び止める順にしない。
function greetingWithoutFarewell(id) {
  const dialogue = DB.dialogues[id];
  const first = dialogue?.branches?.first;
  if (!first) return id;
  const farewell = `${id}_farewell`;
  return { ...dialogue, branches: { ...dialogue.branches, first: first.filter(line => !(line.type === "jump" && line.next_id === farewell)) } };
}

async function introduceStop(id, background) {
  const outing = CITY_OUTINGS.find(item => item.introducedBy === id);
  if (!outing || state.flags[outing.flag]) return true;
  // 旧版ですでにTRPGを遊んだ人にも紹介台詞を読める。進捗を消さない。
  if (!await scene(outing.introduction, "街のおすすめ", background)) return false;
  introduceCitySpot(state, id); save();
  return true;
}

async function visit(stop) {
  const owner = session;
  const delivering = deliveryPending(state, stop.id);
  const tracked = DELIVERY_STOPS.includes(stop.id);
  // 顔合わせ挨拶。初対面なら台詞中で名乗り（set_flag _met_）、面識済みなら短い再会。
  // 完読まで面識を確定しない（SKIP/LOAD/中断で面識だけ先に付くのを防ぐ）。
  const restore = tracked ? snapshotDeliveryIdentity(state, stop.id) : null;
  const greeting = `ch2_city_${stop.id}`;
  if (!await scene(greeting, stop.sceneLabel || stop.name, undefined, delivering ? greetingWithoutFarewell(greeting) : greeting)) { restore?.(); return; }
  // 完読したので面識と名前表示を確定する（台詞の set_flag が失われても整合させる保険・idempotent）。
  if (tracked) confirmDeliveryIdentity(state, stop.id);
  recordCityVisit(state, stop.id); save();
  if (stop.id === "c_station" && !state.flags._ch2_rules_read) {
    await (await import("../scenes/rule-sheet.js")).openRuleSheet();
    if (!current(owner)) return;
    state.flags._ch2_rules_read = true; save();
  }
  // 配達と街の紹介は挨拶と同じ店頭（背景を替えない）で読む。室内の絵は店内の場面で初めて出す（#1706）。
  if (delivering) {
    if (!await scene(`remake_ch2_delivery_${stop.id}`, "配達とご挨拶")) return;
    finishChapterTwoDelivery(state, stop.id); save();
  }
  if (!await introduceStop(stop.id)) return;
  // J05: 配達で来たら、そのまま店内へ入って店主と話す（「店内をのぞく」は出さない）。
  // 室内の絵が間に合わないときだけ、通常訪問と同じ店頭カード（再読み込みできる）に落とす。
  if (delivering && ROOMS[stop.id]) {
    const ready = await withScenePreparation(imageReady(ROOMS[stop.id], 15000));
    if (!current(owner)) return;
    if (ready) {
      if (!await scene(`ch2_city_${stop.id}_inside`, stop.sceneLabel || stop.name, ROOMS[stop.id])) return;
      state.flags[`_ch2_city_inside_${stop.id}`] = true; save();
      // あげはのプリクラは入口の機械なので、店内に入ってから撮る。
      if (stop.id === "ageha" && !await offerAgehaPurikura(ROOMS.ageha)) return;
      if (!await mapBackground()) return;
      renderMap(); focus(`pin-${stop.id}`);
      return;
    }
  }
  if (stop.id === "ageha" && !await offerAgehaPurikura(ROOMS.ageha)) return;
  if (ROOMS[stop.id]) renderStop(stop);
  else { await mapBackground(); renderMap(); focus("return"); }
}

function renderStop(stop, failed = false) {
  session.scene = "stop";
  showScreen("ch2-stop", el("main.ch2-shell.ch2-stop", { dataset: { test: test("stop"), stop: stop.id } }, [el("div.ch2-stop-card.panel", [
    el("p.ch2-kicker", { text: "第2章・DAY1 / 配達とご挨拶" }),
    storeLogo(`ch2_${stop.id}`, { width: 240, height: 140 }),
    el("h1", { text: stop.sceneLabel || stop.name }),
    el("p", { text: "少し中を見せてもらうか、次の場所へ向かおう。" }),
    failed ? el("p.ch2-room-warning", { role: "status", text: "室内を読み込めませんでした。再読み込みするか、地図へ戻れます。" }) : null,
    el("div.ch2-actions", [
      button(failed ? "室内を再読み込み" : "店内をのぞく", "inside", async () => {
        const owner = session;
        const ready = await withScenePreparation(imageReady(ROOMS[stop.id], 15000));
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
  if (!cityVisits(state).has("c_station") || !chapterTwoDeliveriesDone(state)) return;
  await checkpoint("return");
  await continueDayOne();
}

function renderMap() {
  session.scene = "map";
  const visited = cityVisits(state);
  const deliveries = state.flags._ch2_deliveries;
  const delivered = DELIVERY_STOPS.filter(id => deliveries?.done?.[id]).length;
  const canReturn = visited.has("c_station") && chapterTwoDeliveriesDone(state);
  const info = el("aside.map-info", { "aria-live": "polite" });
  let selected = null;
  const pins = [];
  const outingStops = knownCityOutings(state).map(spot => ({ ...spot, name: spot.label, outing: true }));
  const stops = [...STOPS.map(stop => ({ ...stop, ...(stop.id === "c_station" ? { y: 26 } : stop.id === "ageha" ? { y: 50 } : {}) })), CITY_SHOP, ...outingStops, { id: "station", name: "駅へ戻る", x: 15, y: 34 }];
  const progressText = () => deliveries?.accepted
    ? `配達 ${delivered} / 3 ・ 会場 ${visited.has("c_station") ? "確認済み" : "未確認"}`
    : `挨拶 ${visited.size} / ${STOPS.length}`;
  const returnNote = !visited.has("c_station") ? "県大会ホールの入口と搬入場所も確認しよう。"
    : !chapterTwoDeliveriesDone(state) ? "残りの包みを届けてから、スミさんへ報告しよう。" : deliveries?.accepted ? "三軒への配達と会場の確認を終えた。駅からtonariへ戻ろう。" : "会場までの道を覚えた。駅からtonariへ戻ろう。";
  const go = stop => perform(async () => {
    if (stop.id === "station") return returnHome();
    if (stop.shop) {
      showHud(false);
      await openShop({ branch: "widehanga" });
      if (await mapBackground()) renderMap();
      return;
    }
    if (stop.id === "trpg_bar") {
      // 初日の夜は帰店の物語がある。昼の見学・部活設立は通常と同じ。
      await openTrpgBar({ nightBusy: () => true });
      if (await mapBackground()) renderMap();
      return;
    }
    if (stop.outing) {
      if (!await scene(stop.look, stop.label, stop.previewUrl || MAP.day)) return;
      state.flags[`_ch2_looked_${stop.id}`] = true; save();
      if (await mapBackground()) renderMap();
      return;
    }
    return visit(stop);
  });
  const select = (stop, pin) => {
    selected = stop;
    for (const other of pins) { other.classList.toggle("sel", other === pin); other.setAttribute("aria-pressed", String(other === pin)); }
    const pending = deliveryPending(state, stop.id);
    const isStation = stop.id === "station";
    info.replaceChildren(
      el("h2.mi-banner", { text: stop.name }),
      el("p.mi-desc", { text: isStation ? returnNote : stop.outing || stop.shop ? stop.dayOneDesc || stop.desc
        : stop.id === "c_station" ? "C.STATIONと同じビルの県大会ホール。入口と搬入場所を確認する。"
        : pending ? "tonariから預かった包みを渡して、ご挨拶しよう。" : "顔を見て挨拶した店。中をのぞくこともできます。" }),
      el("p.mi-foot", { text: stop.outing ? "今日は下見。配達の合間に立ち寄れます。" : "初日の配達・下見は代金と行動を使いません。" }),
      isStation && !canReturn ? el("p.mi-no", { text: returnNote })
        : el("button.mi-go", { type: "button", dataset: { test: test("go") }, disabled: session.busy,
          text: isStation ? "tonariへ戻る" : pending ? "配達して挨拶する" : stop.shop ? "仕入れに行く" : stop.outing ? "立ち寄る" : "ここへ行く", onclick: () => go(stop) }),
    );
  };
  for (const stop of stops) {
    const done = deliveries?.done?.[stop.id];
    const logo = stop.id === "station" ? null : storeLogo(ROOMS[stop.id] ? `ch2_${stop.id}` : stop.id, { width: 68, height: 42 });
    const pin = el(`button.spot-pin.${stop.id === "station" ? "pin-station" : "pin-store"}${logo ? ".branded" : ""}`, { type: "button", style: { left: `${stop.x}%`, top: `${stop.y}%` },
      dataset: { test: test(stop.id === "station" ? "station" : `pin-${stop.id}`), read: String(visited.has(stop.id)), spot: stop.id },
      "aria-pressed": "false", "aria-label": `${stop.name}${deliveryPending(state, stop.id) ? "・配達先" : ""}`,
      onclick: () => selected === stop ? go(stop) : select(stop, pin) }, [
      el("div.shield", [el("span.ico", [stop.id === "station"
        ? el("span.train-icon", { html: TRAIN_ICON_SVG })
        : logo || el("span", { text: stop.glyph || (stop.id === "c_station" ? "会" : ""), "aria-hidden": "true" })])]),
      el("span.sub-label", { text: stop.name }),
      el("small.pin-status", { text: deliveryPending(state, stop.id) ? "配達先" : done ? "お届け済み" : visited.has(stop.id) ? "確認済み" : stop.outing ? "教えてもらった場所" : "" }),
    ]);
    pins.push(pin);
  }
  info.append(el("h2.mi-banner", { text: "配達しながら、街を知ろう" }),
    el("p.mi-desc", { text: deliveries?.accepted ? "三つの包みを届けて、会場を下見しよう。回る順番は自由です。行き先を選ぼう。" : "会場の確認と、新しい店へのご挨拶。行き先を選ぼう。" }));
  if (!deliveries) info.append(button("スミさんの配達メモ", "delivery-offer", async () => {
    if (!await scene("remake_ch2_delivery_offer", "スミさんからの配達", MAP.day)) return;
    acceptChapterTwoDeliveries(state); save();
    if (await mapBackground()) renderMap();
  }));
  const root = el("main.map.ch2-shell.ch2-map.ch2-map-main", { class: session.mapAvailable ? "" : "is-map-missing", dataset: { test: test("map"), phase: session.mapAvailable ? "ready" : "unavailable" } }, [
    el("div.map-pins", { "aria-label": `${CH2_CITY_NAME}の行き先` }, pins), info,
    el("aside.map-notice.ch2-route-note", [el("strong", { text: "進み具合" }), el("span", { text: progressText(), dataset: { test: test("route-progress") } }),
      el("span", { text: canReturn ? "地図の駅から地元へ戻れます。" : returnNote })]),
  ]);
  if (!session.mapAvailable) root.append(el("div.map-notice.ch2-map-warning", { role: "status" }, [el("span", { text: "地図の絵を読み込めませんでした。行き先は選べます。" }), button("再読み込み", "retry-map", async () => { if (await mapBackground()) renderMap(); })]));
  showScreen("map", root);
  layers.hud.replaceChildren(el("div.hud", [
    el("div.hud-card", [el("div.dc-main", [el("div.dc-area", { text: CH2_CITY_EN }), el("div.dc-day", [el("b", { text: chapterDay(state) }), el("small", { text: "/14" })]), el("div.dc-slot", { text: "配達" })]),
      el("div.dc-meta", [el("div.dc-row.money", [el("span", { text: "所持金" }), el("b", { text: yen(state.money) })]), el("div.dc-row", [el("span", { text: "次の大会まで" }), el("b", { text: `あと${chapterDaysLeft(state)}日` })])])]),
    el("div.hud-right", [el("button.hud-menu", { type: "button", dataset: { test: test("menu") }, onclick: () => perform(openMenu) }, [el("i"), el("span", { text: "MENU" })])]),
  ]));
  showHud(true);
}

async function openMenu() {
  const owner = session;
  const choice = await modal({ title: "MENU", body: `第${state.chapter}章・DAY ${chapterDay(state)} ／ 場面の区切りで自動セーブしています。`, options: [
    { label: "セーブ", value: "save", test: test("save") }, { label: "ロード", value: "load", test: test("load") },
    { label: "設定", value: "config", test: test("config") }, { label: "用語集", value: "glossary", test: test("glossary") },
    { label: "ステータス・人間関係", value: "status", test: test("status") },
    { label: "大会の規則", value: "rules", test: test("rules") },
    { label: "タイトルへ戻る", value: "title", test: test("title") },
    { label: "閉じる", value: null, primary: true },
  ] });
  if (!current(owner)) return;
  if (choice === "save") await saveFlow();
  if (choice === "config") await (await import("../scenes/title.js")).openConfig();
  if (choice === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
  if (choice === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
  if (choice === "load") {
    const key = await loadFlow({ inGame: true });
    if (key && loadFromSlot(key)) { requestResumeOnBoot(); location.reload(); }
  }
  if (choice === "status") await openStatus();
  if (choice === "title") { save(); location.reload(); }
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
  document.body.classList.remove("ch2-city", "ch2-main");
  owner.scene = "preparation";
  showScreen("none", null);
  layers.screen.removeAttribute("aria-busy"); // 日常の地図は入力待ち。章のロード中として読み上げを止めない。
  await runChapterTwoPreparation();
  if (!current(owner)) return;
  await tournament();
}

async function tournament() {
  session.scene = "tournament";
  showHud(false);
  const mod = await withLoadingNotice(import("./ch2-tournament.js"), loadingNotice("第2章の大会を準備しています…"));
  await mod.runChapterTwoTournament();
}

function renderError(retry) {
  session.scene = "error";
  layers.hud.replaceChildren();
  showScreen("ch2-error", el("main.ch2-shell.ch2-error", { dataset: { test: test("error") } }, [el("div.ch2-error-card.panel", [
    el("h1", { text: "第2章を読み込めませんでした" }), el("p", { text: "通信を確認して、もう一度お試しください。最後に保存した進み具合から再開できます。" }),
    el("div.ch2-actions", [button("もう一度試す", "retry", retry, true), button("セーブ・ロード", "menu", openMenu)]),
  ])]));
  focus("retry");
}
