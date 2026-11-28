// 縦画面の作る場面: 右の温度計（試作 app.mjs の thermoHtml と同じ見た目・VPL61・VPL103）。
// 本編の温度計（craft/thermometer.js の .thermo）が持つ帯・色・温度・蒸らし後の目安の幅を読んで描くだけ（温度の計算はしない）。
// 色の意味は本編と同じ: 管の色＝本編の目盛りの色、白い刻みの帯＝適温の目安、虹＝理想の温度、上の炎＝焦げる。
// 見せ方（view.thermo の mode）: "bands"＝加熱前の帯だけ（詰め方）、"forecast"＝蒸らし後の目安の幅と針（蒸らし時間）、"live"＝今の温度の線と針。
import { el } from "../../../core/util.js";

const THERMO = '<path d="M10 14.5v-9a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v8"/>';
const FLAME = '<path d="M12 3.5c1 3.5 5 5.2 5 9.7a5 5 0 0 1-10 0c0-2 1-3.3 2-4.6.3 1.6 1 2.5 2 2.9-.3-2.9.2-5.4 1-8z"/>';

/** icon: 絵記号の SVG を返す関数（craft.js の craftIcon）。 */
export function createThermo(icon) {
  const zone = el("i.vtc-th-zone"), best = el("i.vtc-th-best"), danger = el("i.vtc-th-danger", { html: icon(FLAME) });
  const dim = el("i.vtc-th-dim"), now = el("i.vtc-th-now"), range = el("i.vtc-th-range", { hidden: true });
  const bar = el("span.vtc-th-bar", [zone, best, danger, dim, now, range]);
  const pointer = el("i.vtc-th-pointer");
  const note = el("small.vtc-th-note");
  const root = el("div.vtc-thermo", { hidden: true, role: "img", dataset: { test: "vt-craft-thermo" } }, [
    el("span.vtc-th-icon", { html: icon(THERMO) }), el("span.vtc-th-tube", [bar, pointer]), note,
  ]);
  let sig = "";

  /** spec: { node: 本編の .thermo, mode, label, note }。null なら隠す。 */
  function sync(spec) {
    const live = spec?.node;
    if (!live) { root.hidden = true; sig = ""; return; }
    const part = (selector) => live.querySelector(selector);
    const zoneLive = part(".thermo-zone"), bestLive = part(".thermo-optimal"), dangerLive = part(".thermo-danger"), rangeLive = part(".thermo-range");
    const selected = live.dataset.selected !== "false";
    const forecast = spec.mode === "forecast" && !!rangeLive && !rangeLive.hidden;
    const temp = forecast ? (Number(rangeLive.dataset.low) + Number(rangeLive.dataset.high)) / 2
      : spec.mode === "live" ? Number(live.getAttribute("aria-valuenow")) : NaN;
    const box = (node) => node && !node.hidden ? [node.style.bottom, node.style.height] : null;
    const next = JSON.stringify([spec.mode, selected, live.style.getPropertyValue("--thermo-gradient"), box(zoneLive), box(bestLive), dangerLive?.style.bottom,
      forecast ? box(rangeLive) : null, Number.isFinite(temp) ? temp.toFixed(3) : "", spec.label || live.getAttribute("aria-label"), spec.note || "", { ...live.dataset }]);
    root.hidden = false;
    if (next === sig) return;
    sig = next;
    root.dataset.mode = spec.mode;
    root.dataset.selected = String(spec.mode === "forecast" ? forecast : selected);
    bar.style.background = live.style.getPropertyValue("--thermo-gradient") || "";
    const place = (node, from) => {
      node.hidden = !from || from.hidden;
      if (!node.hidden) { node.style.bottom = from.style.bottom; node.style.height = from.style.height; }
    };
    place(zone, zoneLive);
    place(best, bestLive);
    danger.hidden = !dangerLive || dangerLive.hidden;
    if (!danger.hidden) danger.style.bottom = dangerLive.style.bottom;
    place(range, forecast ? rangeLive : null);
    const shown = Number.isFinite(temp);
    root.style.setProperty("--t", shown ? temp.toFixed(4) : "0");
    pointer.hidden = !shown;
    now.hidden = dim.hidden = spec.mode !== "live" || !shown;
    // 針の所の温度で、上の印の色を替える（適温の帯＝緑、虹＝虹色、焦げる＝赤）。帯の数値は本編の温度計の印から読む
    const d = live.dataset, dangerAt = parseFloat(dangerLive?.style.bottom) / 100;
    const within = (low, high) => temp >= Number(low) && temp <= Number(high);
    root.dataset.state = !shown ? "" : temp >= dangerAt ? "burn" : within(d.rainbowLow, d.rainbowHigh) ? "best" : within(d.idealLow, d.idealHigh) ? "ok" : "";
    root.setAttribute("aria-label", spec.label || live.getAttribute("aria-label") || "温度計");
    note.textContent = spec.note || "";
  }

  return { root, sync };
}
