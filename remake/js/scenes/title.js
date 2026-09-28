// タイトル画面。はじめから／つづきから／用語集／設定。
import { el, yen } from "../core/util.js";
import { bgUrl, assetUrl } from "../core/data.js";
import { showScreen, setBg, smokeWipe, modal } from "../core/ui.js";
import { peekSave, load, newGame, wipeSave, config, saveConfig } from "../core/state.js";
import { playBgm, SE, applyVolumes } from "../core/audio.js";
import { glossaryPanel } from "../vn/glossary.js";
import { startNewGame, resumeGame } from "../chapters/ch1.js";

const PHASE_LABEL = { opening: "プロローグ", daily: "日常", tournament: "SMOKE CROWN CUP 当日", cleared: "第1章クリア" };

export function showTitle() {
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
        options: [{ label: "やめる", value: false }, { label: "はじめから遊ぶ", value: true, primary: true, test: "confirm-new" }],
      }))) return;
      wipeSave();
      newGame();
      smokeWipe(() => { startNewGame(); }, { color: "dark" }); // 煙で覆った瞬間に開始（ゲーム本体の完了は待たない）
    }, "title-new"),
    item("CONTINUE", "つづきから", () => {
      if (!load()) return;
      smokeWipe(() => { resumeGame(); }, { color: "dark" });
    }, "title-continue", !saved),
    item("GLOSSARY", "用語集", () => modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] }), "title-glossary"),
    item("CONFIG", "設定", openConfig, "title-config"),
  );

  const saveInfo = saved
    ? el("div.title-save", { text: `つづき: DAY ${saved.day}・${PHASE_LABEL[saved.phase] || ""}・所持金 ${yen(saved.money || 0)}` })
    : null;

  const root = el("div.title", [
    el("div.title-art", { style: { backgroundImage: `url("${assetUrl("assets/ui/title_arts/title_art_keyvisual_01.png")}")` } }),
    el("div.title-smoke", [el("i"), el("i"), el("i")]),
    el("div.title-left", [
      el("img.title-logo", { src: assetUrl("assets/ui/ui_title_logo.png"), alt: "水煙前線 -EN:CODE-" }),
      el("div.title-badge", { text: "REMAKE EDITION" }),
      menu,
      saveInfo,
    ]),
    el("div.title-foot", { text: "TAP / CLICK / ENTER ── CH.01 SMOKE CROWN CUP" }),
    el("div.title-old", [el("a", { href: "../web/", text: "旧バージョンはこちら →" })]),
  ]);
  showScreen("title", root);
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
