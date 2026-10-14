// 炭焼きの見た目だけを管理。時刻・採点・温度はheat.js / heat_logic.jsを使う。
import { el } from "../core/util.js";
import { artImg, artHeight } from "./art.js";
import { timingLabel } from "./common.js";

// 生成コンロの実測bboxに対する底面の接地点。中央の空き・外縁を避ける。
const SPOTS = {
  1: [[.368, .24, "左奥"]],
  2: [[.368, .24, "左奥"], [.58, .57, "手前右"]],
  3: [[.368, .24, "奥"], [.335, .57, "手前左"], [.58, .57, "手前右"]],
  4: [[.32, .24, "左奥"], [.565, .24, "右奥"], [.32, .57, "手前左"], [.58, .57, "手前右"]],
};
export const coalSpots = count => SPOTS[count] || SPOTS[3];
export const coalSpriteFiles = type => {
  const shape = type === "cube_charcoal" ? "cube" : "flat";
  return { cold: "heat_" + shape + "_cold.png", lit: "heat_" + shape + "_lit.png" };
};
const CARRIER_SPOTS = [[.52, .80], [.39, .73], [.64, .73], [.50, .64]];

export function buildHeatView(types, { count = 3, compact = false } = {}) {
  const width = compact ? 420 : 600, coalWidth = compact ? 68 : 86;
  const stove = el("div.stove", { style: { width: width + "px" } }, [
    artImg("heat_stove.png", width, "stove-img"),
  ]);
  const coals = coalSpots(count).map(([x, y, label], i) => {
    const files = coalSpriteFiles(types[i]);
    const visual = el("div.coal-sprite", { style: {
      width: coalWidth + "px", height: artHeight(files.lit, coalWidth) + "px",
    } }, [
      artImg(files.cold, coalWidth, "c-cold"),
      artImg(files.lit, coalWidth, "c-red"),
      artImg(files.lit, coalWidth, "c-hot"),
      artImg(files.lit, coalWidth, "c-ash"),
      el("i.c-core"),
    ]);
    const node = el("button.coal", {
      dataset: { test: "coal-" + i, position: label },
      "aria-label": label + "の炭を取り出す",
      style: { left: x * 100 + "%", top: y * 100 + "%", zIndex: String(Math.round(y * 100)) },
    }, [visual, el("i.coal-corners", { "aria-hidden": "true" }),
      el("span.coal-now", { text: "今", "aria-hidden": "true" })]);
    stove.append(node);
    return { node, visual, label, width: coalWidth };
  });
  const rows = coals.map((c, i) => el("li", { dataset: { test: "coal-timing-" + i } }, [
    el("b", { text: c.label }), el("span", { text: "焼成中" }),
  ]));
  const counter = el("span.heat-collected-count", { text: "0 / " + coals.length, dataset: { test: "coal-count" } });
  const stored = el("ol.coal-carrier-coals", { "aria-hidden": "true", dataset: { test: "coal-carrier-coals" } });
  const carrier = el("div.coal-carrier-view", [
    artImg("heat_carrier.png", compact ? 164 : 195, "coal-carrier-art"), stored,
  ]);
  const feedback = el("div.heat-feedback", { "aria-live": "polite", dataset: { test: "heat-feedback" } });
  const info = el("section.heat-info", { "aria-label": "上から見た炭壺", dataset: { test: "coal-carrier" } }, [
    el("div.heat-carrier-head", [el("div", [el("h2", { text: "炭壺" }), el("small", { text: "上から" })]), counter]),
    carrier, feedback,
    el("ol.heat-picks", { "aria-label": "各炭の取り出し結果" }, rows),
  ]);
  const root = el("div.heat" + (compact ? ".heat-compact" : ""), { "aria-busy": "true" }, [stove, info]);
  return { root, stove, coals, info, feedback, rows, recordPick(index, timing) {
    const c = coals[index], [x, y] = CARRIER_SPOTS[stored.children.length];
    const sprite = c.visual.cloneNode(true);
    const scale = (compact ? 30 : 35) / c.width;
    sprite.style.transform = "translateX(-50%) scale(" + scale + ")";
    const coal = el("li.coal-stored", { style: {
      left: x * 100 + "%", top: y * 100 + "%",
      "--red": c.node.style.getPropertyValue("--red"),
      "--hot": c.node.style.getPropertyValue("--hot"),
      "--ash": c.node.style.getPropertyValue("--ash"),
    }, dataset: { test: "stored-coal-" + index, phase: timing.phase } }, [sprite]);
    stored.append(coal);
    counter.textContent = stored.children.length + " / " + coals.length;
    rows[index].replaceChildren(el("b", { text: c.label + " " + timing.rating + "（" + timing.label + "）" }),
      el("span", { text: timing.errorText + (timing.automatic ? "・自動取り出し" : "") }));
    rows[index].dataset.rating = timing.rating;
    feedback.replaceChildren(el("b.stamp." + timing.rating.toLowerCase(), { text: timingLabel(timing.rating.toLowerCase(), timing.rating) }),
      el("span.heat-error", { text: timing.errorText + (timing.automatic ? "・自動" : "") }));
  } };
}
