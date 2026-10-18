import { el } from "../core/util.js";
import { modal, toast } from "../core/ui.js";
import { config, saveConfig } from "../core/state.js";
import { applyVolumes } from "../core/audio.js";

export function applyTextSize() {
  document.documentElement.dataset.textSize = config.textSize === "large" ? "large" : "normal";
}
export function openConfig() {
  const persist = () => { applyVolumes(); applyTextSize(); if (!saveConfig()) toast("設定を保存できませんでした。この画面では変更が反映されます。", { kind: "warn" }); };
  const row = (label, input) => el("label.cfg-row", [el("span", { text: label }), input]);
  const range = key => el("input", { type: "range", min: 0, max: 1, step: .05, value: config[key],
    oninput: e => { config[key] = Number(e.target.value); persist(); } });
  const select = (key, values, number = false) => el("select", { dataset: { test: `config-${key}` },
    onchange: e => { config[key] = number ? Number(e.target.value) : e.target.value; persist(); } }, values.map(([value, text]) => {
    const option = el("option", { value, text }); option.selected = String(config[key]) === value; return option;
  }));
  const voice = el("input", { type: "checkbox", onchange: e => { config.voiceBlip = e.target.checked; persist(); } });
  voice.checked = config.voiceBlip;
  return modal({ title: "設定", className: "settings-modal", body: el("div.cfg", [
    row("BGM 音量", range("bgmVolume")), row("効果音 音量", range("seVolume")),
    row("文字の速さ", select("textSpeed", [["1", "ゆっくり"], ["2", "ふつう"], ["3", "はやい"], ["4", "瞬間表示"]], true)),
    row("日常UIの文字", select("textSize", [["normal", "標準"], ["large", "大きく"]])),
    row("文字送りの声", voice),
  ]), options: [{ label: "閉じる", value: true, primary: true, test: "config-close" }] });
}
