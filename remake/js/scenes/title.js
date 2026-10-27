// タイトル画面。用語集は会話画面・ゲーム中のメニューから開く。
import { el } from "../core/util.js";
import { bgUrl } from "../core/data.js";
import { layers, showScreen, setBg, smokeWipe, modal } from "../core/ui.js";
import { peekSave, newGame, wipeSave, config, saveConfig, anySlotSaved, loadFromSlot } from "../core/state.js";
import { playBgm, stopBgm, SE, applyVolumes } from "../core/audio.js";
import { startNewGame, resumeGame } from "../chapters/ch1.js";
import { openGallery } from "./gallery.js";
import { loadFlow } from "./saves.js";
import { pickTitleArt, prepareTitleArt } from "./title-art.js";
import { mountTitleLayout } from "./title-layout.js";

let titleRevision = 0;
// 直近に表示したキャラアート。メニューを閉じて再描画するだけのときは同じ絵を使い回し、
// 読込待ちや無駄な抽選切替を起こさない。新しい絵はブート/タイトル復帰（reload）でだけ選ぶ。
let currentArt = null;

export function showTitle(preparedArt = null) {
  const revision = ++titleRevision;
  let leaving = false;
  const current = () => !leaving && revision === titleRevision && document.body.dataset.screen === "title";
  const refresh = () => { if (current()) showTitle(); };
  layers.hud.classList.remove("show");
  setBg(bgUrl("bg_title"), { instant: true });
  playBgm("title");
  const saved = peekSave();
  const menu = el("nav.title-menu");
  const item = (en, ja, fn, test, disabled = false) =>
    el("button.title-item", { disabled: disabled || null, dataset: { test }, onclick: () => { SE.select(); fn(); } }, [
      el("span.ti-en", { text: en }),
      el("span.ti-ja", { text: ja }),
    ]);

  menu.append(
    item("NEW GAME", "はじめから", async () => {
      if (saved && !(await modal({
        title: "はじめから",
        body: "今のセーブデータは上書きされます。よろしいですか？",
        options: [{ label: "はじめから遊ぶ", value: true, primary: true, test: "confirm-new" }, { label: "やめる", value: false, test: "cancel-new" }],
      }))) { refresh(); return; }
      if (!current()) return;
      leaving = true;
      wipeSave();
      newGame();
      smokeWipe(() => { stopBgm(0); startNewGame(); }, { color: "dark" }); // 煙で覆った瞬間に開始（ゲーム本体の完了は待たない）
    }, "title-new"),
    item("LOAD", "つづきから", async () => {
      const key = await loadFlow();
      if (!current()) return;
      if (!key || !loadFromSlot(key)) { refresh(); return; }
      leaving = true;
      smokeWipe(() => { stopBgm(0); resumeGame(); }, { color: "dark" });
    }, "title-load", !anySlotSaved()),
    item("GALLERY", "ギャラリー", () => openGallery().then(refresh), "title-gallery"),
    item("CONFIG", "設定", () => openConfig().then(refresh), "title-config"),
  );

  const art = preparedArt || currentArt || pickTitleArt();
  // メニューを閉じただけの再描画（同じ絵の使い回し）は、フェードを繰り返さずそのまま置く。
  const reused = art === currentArt;
  const artNode = el("div.title-art", { "aria-hidden": "true", dataset: { character: art.character } });
  const root = el("div.title", [
    artNode,
    el("div.title-smoke", [el("i"), el("i"), el("i")]),
    el("div.title-left", [
      el("div.title-brand", [
        el("div.title-logo-smoke", { "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i")]),
        el("img.title-logo", { src: "img/ui/ui_title_logo_rich.webp", alt: "水煙前線 -EN:CODE-" }),
      ]),
      menu,
    ]),
    el("div.title-foot", { text: "TAP / CLICK / ENTER ── CH.01 SMOKE CROWN CUP" }),
  ]);
  showScreen("title", root);
  const brand = root.querySelector(".title-brand");
  const fallback = el("strong.title-logo-fallback", { text: "水煙前線 — EN:CODE", hidden: true });
  brand.append(fallback);
  const logo = brand.querySelector("img");
  const fallbackLogo = () => { logo.hidden = true; fallback.hidden = false; };
  logo.addEventListener("error", fallbackLogo);
  if (logo.complete && !logo.naturalWidth) fallbackLogo();
  mountTitleLayout(root, { art: artNode, brand, menu, left: root.querySelector(".title-left"), background: bgUrl("bg_title") });
  const requested = performance.now();
  const place = (loaded) => {
    // 幕の終了待ちでrootが未接続のときも、そのrootへ絵を準備する。
    currentArt = { character: loaded.character, file: loaded.file, url: loaded.url, ready: true };
    artNode.dataset.character = loaded.character;
    artNode.dataset.art = loaded.file;
    artNode.style.backgroundImage = `url("${loaded.url}")`;
    if (reused) artNode.classList.add("shown");
    artNode.classList.add("ready");
    // 「読込待ち」と「アニメ時間」を分けて計測し、window.__titleArtTiming で参照できるようにする。
    const loadWaitMs = Math.round(performance.now() - requested);
    const timing = { character: loaded.character, file: loaded.file, loadWaitMs, animMs: null };
    window.__titleArtTiming = timing;
    artNode.addEventListener("animationstart", (e) => {
      if (e.animationName === "title-art-in") timing._animStart = performance.now();
    });
    artNode.addEventListener("animationend", (e) => {
      if (e.animationName === "title-art-in" && timing._animStart != null) timing.animMs = Math.round(performance.now() - timing._animStart);
    });
  };
  if (art.ready) place(art);
  else prepareTitleArt(art).then(place);
}

export async function openConfig(opts = {}) {
  const { createUiThemeSelect } = await import("../core/ui-theme.js");
  const persist = () => {
    if (document.body?.dataset?.screen !== "preview") saveConfig();
  };
  const row = (label, input) => el("label.cfg-row", [el("span", { text: label }), input]);
  const range = (key, min, max, step, test) =>
    el("input", {
      type: "range", min, max, step, value: config[key],
      dataset: { test },
      oninput: (e) => { config[key] = Number(e.target.value); applyVolumes(); persist(); opts.onChange?.(key, config[key]); },
    });
  const speed = el("select", {
    dataset: { test: "cfg-text-speed" },
    onchange: (e) => { config.textSpeed = Number(e.target.value); persist(); opts.onChange?.("textSpeed", config.textSpeed); },
  }, [["1", "ゆっくり"], ["2", "ふつう"], ["3", "はやい"], ["4", "瞬間表示"]].map(([v, t]) => {
    const o = el("option", { value: v, text: t });
    if (Number(v) === config.textSpeed) o.selected = true;
    return o;
  }));
  const blip = el("input", {
    type: "checkbox",
    dataset: { test: "cfg-voice-blip" },
    onchange: (e) => { config.voiceBlip = e.target.checked; persist(); opts.onChange?.("voiceBlip", config.voiceBlip); },
  });
  blip.checked = config.voiceBlip;
  return modal({
    title: "設定",
    body: el("div.cfg", [
      row("UIデザイン", createUiThemeSelect(config.uiTheme, value => { config.uiTheme = value; persist(); opts.onChange?.("uiTheme", value); })),
      row("BGM 音量", range("bgmVolume", 0, 1, 0.05, "cfg-bgm-volume")),
      row("効果音 音量", range("seVolume", 0, 1, 0.05, "cfg-se-volume")),
      row("文字の速さ", speed),
      row("文字送りの声", blip),
    ]),
    options: [{ label: "閉じる", value: true, primary: true, test: "cfg-close" }],
  });
}
