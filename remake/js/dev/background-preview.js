// DBG 専用。manifest の採用済み背景だけを画面に重ね、ゲームの背景・状態には触れない。
import { DB, img } from "../core/data.js";

const VARIANTS = [
  ["_overcast_day", "曇り・昼"], ["_overcast_night", "曇り・夜"],
  ["_morning", "朝"], ["_day", "昼"], ["_dusk", "夕方"], ["_night", "夜"],
];

export function backgroundLabel(name) {
  const stem = name.replace(/\.(png|webp)$/, "").replace(/^bg_/, "");
  const variant = VARIANTS.find(([suffix]) => stem.endsWith(suffix));
  return variant ? `${stem.slice(0, -variant[0].length)} / ${variant[1]}` : stem;
}

export function createBackgroundPreview() {
  const select = document.createElement("select");
  select.dataset.test = "debug-background-select";
  select.title = "背景と時間帯・状態の差分";
  const refresh = () => {
    const files = DB.manifest.backgrounds || [];
    if (select.options.length !== files.length) {
      const current = select.value;
      select.replaceChildren(...files.map(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `${backgroundLabel(name)} (${name})`;
        return option;
      }));
      if (files.includes(current)) select.value = current;
    }
    select.disabled = button.disabled = !files.length || !document.querySelector("#stage");
  };
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "全画面で試す";
  button.dataset.test = "debug-background-show";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "プレビュー終了";
  close.dataset.test = "debug-background-close";
  close.className = "dbg-preview-close";
  close.hidden = true;
  const preview = document.createElement("img");
  preview.className = "dbg-preview-image";
  preview.dataset.test = "debug-background-image";
  preview.alt = "";
  preview.hidden = true;
  document.body.append(close);
  let active = false;
  const show = () => {
    const name = select.value;
    const stage = document.querySelector("#stage");
    if (!stage || !(DB.manifest.backgrounds || []).includes(name)) return;
    if (preview.parentElement !== stage) stage.append(preview);
    preview.src = img(`backgrounds/${name}`);
    preview.hidden = false;
    close.hidden = false;
    active = true;
  };
  const stop = () => {
    preview.hidden = true;
    preview.removeAttribute("src");
    close.hidden = true;
    active = false;
  };
  button.addEventListener("click", show);
  select.addEventListener("change", () => { if (active) show(); });
  close.addEventListener("click", stop);
  const row = document.createElement("div");
  row.className = "dbg-row";
  row.append(select, button);
  refresh();
  return { row, stop, refresh };
}
