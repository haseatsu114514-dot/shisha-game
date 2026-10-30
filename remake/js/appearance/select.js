import { el } from "../core/util.js";
import { APPEARANCE_CATEGORIES, appearanceOptions, normalizeAppearance } from "./model.js";

const SOURCE = new URL("../../../asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json", import.meta.url);

export async function loadAppearanceOptions() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(SOURCE, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error("Appearance catalog could not be loaded");
    return appearanceOptions(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

// Draft changes are local until confirmation. No image, geometry or equipment edit.
export function chooseAppearance(panel, current, options) {
  return new Promise(resolve => {
    const draft = normalizeAppearance(current, options);
    panel.append(el("p", { text: "選択はSAVE時に保存され、制作中の作業台に表示されます。" }));
    const fields = el("div", { style: { display: "grid", gap: "12px" } });
    for (const category of APPEARANCE_CATEGORIES) {
      const select = el("select.btn", {
        style: { width: "100%", minWidth: "0" },
        dataset: { test: `appearance-${category}` },
        onchange: () => { draft[category] = select.value || null; },
      }, [
        el("option", { value: "", text: "未選択" }),
        ...options[category].map(item => el("option", { value: item.id, text: item.name })),
      ]);
      select.value = draft[category] || "";
      fields.append(el("label", { style: { display: "grid", gap: "4px" } }, [category === "handle" ? "ハンドル" : "マウスピース", select]));
    }
    panel.append(fields);
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    panel.append(el("div.modal-actions", [
      el("button.btn", { text: "変更しない", dataset: { test: "appearance-cancel" }, onclick: () => finish(null) }),
      el("button.btn.primary", { text: "選択を確定", dataset: { test: "appearance-confirm" },
        onclick: () => finish(normalizeAppearance(draft, options)) }),
    ]));
  });
}

export async function configureAppearance(state, panelFactory, loadOptions = loadAppearanceOptions) {
  const options = await loadOptions();
  const selected = await chooseAppearance(panelFactory(), state.appearance, options);
  if (selected === null) return false;
  // Existing save/load serializes state fields; no schema or equipment migration.
  state.appearance = selected;
  return true;
}
