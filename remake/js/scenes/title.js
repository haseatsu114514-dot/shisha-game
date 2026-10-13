// タイトル画面。用語集は会話画面・ゲーム中のメニューから開く。
import { el } from "../core/util.js";
import { bgUrl } from "../core/data.js";
import { showScreen, setBg, smokeWipe, modal } from "../core/ui.js";
import { peekSave, newGame, wipeSave, config, saveConfig, anySlotSaved, loadFromSlot } from "../core/state.js";
import { playBgm, SE, applyVolumes } from "../core/audio.js";
import { startNewGame, resumeGame } from "../chapters/ch1.js";
import { openGallery } from "./gallery.js";
import { loadFlow } from "./saves.js";
import { pickTitleArt, prepareTitleArt } from "./title-art.js";
import { openTrpgRoom } from "./trpg-room.js";

export function showTitle(preparedArt = null) {
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
      }))) return;
      wipeSave();
      newGame();
      smokeWipe(() => { startNewGame(); }, { color: "dark" }); // 煙で覆った瞬間に開始（ゲーム本体の完了は待たない）
    }, "title-new"),
    item("LOAD", "つづきから", async () => {
      const key = await loadFlow();
      if (!key || !loadFromSlot(key)) return;
      smokeWipe(() => { resumeGame(); }, { color: "dark" });
    }, "title-load", !anySlotSaved()),
    item("PLAY ROOM", "遊び場", () => openTrpgRoom(() => {
      showTitle(art);
      document.querySelector('[data-test="title-trpg"]')?.focus({ preventScroll: true });
    }), "title-trpg"),
    item("GALLERY", "ギャラリー", openGallery, "title-gallery"),
    item("CONFIG", "設定", openConfig, "title-config"),
  );

  const art = preparedArt || pickTitleArt();
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
  const place = (loaded) => {
    // 幕の終了待ちでrootが未接続のときも、そのrootへ絵を準備する。
    artNode.dataset.character = loaded.character;
    artNode.dataset.art = loaded.file;
    artNode.style.backgroundImage = `url("${loaded.url}")`;
    artNode.classList.add("ready");
  };
  if (art.ready) place(art);
  else prepareTitleArt(art).then(place);
}

function openConfig() {
  const row = (label, input) => el("label.cfg-row", [el("span", { text: label }), input]);
  const range = (key, min, max, step) =>
    el("input", {
      type: "range", min, max, step, value: config[key],
      oninput: (e) => { config[key] = Number(e.target.value); applyVolumes(); saveConfig(); },
    });
  const speed = el("select", {
    onchange: (e) => { config.textSpeed = Number(e.target.value); saveConfig(); },
  }, [["1", "ゆっくり"], ["2", "ふつう"], ["3", "はやい"], ["4", "瞬間表示"]].map(([v, t]) => {
    const o = el("option", { value: v, text: t });
    if (Number(v) === config.textSpeed) o.selected = true;
    return o;
  }));
  const blip = el("input", { type: "checkbox", onchange: (e) => { config.voiceBlip = e.target.checked; saveConfig(); } });
  blip.checked = config.voiceBlip;
  modal({
    title: "設定",
    body: el("div.cfg", [
      row("BGM 音量", range("bgmVolume", 0, 1, 0.05)),
      row("効果音 音量", range("seVolume", 0, 1, 0.05)),
      row("文字の速さ", speed),
      row("文字送りの声", blip),
    ]),
    options: [{ label: "閉じる", value: true, primary: true }],
  });
}
