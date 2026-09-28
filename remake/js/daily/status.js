// ステータス画面（master_spec #19 / #19-a）。数値は見せず、★・呼称・レーダーの形で伸びを見せる。
import { el, yen } from "../core/util.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { modal } from "../core/ui.js";
import { state, STAT_KEYS, STAT_JA } from "../core/state.js";
import { star, starText, rankLabel, affinityLevel, maxStamina } from "../core/stats.js";
import { ownsFlavor, SHOP_FLAVORS } from "./shop.js";

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** 五角形レーダー。今の面と章開始時の面を重ね、伸びた差分を明るく見せる */
export function radar(stats, baseline, size = 340) {
  const c = size / 2;
  const R = size * 0.36;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const poly = (vals) => vals.map((v, i) => pt(i, R * Math.max(0.06, v / 100)).join(",")).join(" ");
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar" });
  for (let k = 1; k <= 5; k++) {
    svg.append(svgEl("polygon", { points: [0, 1, 2, 3, 4].map((i) => pt(i, (R * k) / 5).join(",")).join(" "), class: "radar-grid" }));
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = pt(i, R);
    svg.append(svgEl("line", { x1: c, y1: c, x2: x, y2: y, class: "radar-axis" }));
  }
  svg.append(svgEl("polygon", { points: poly(STAT_KEYS.map((k) => baseline[k])), class: "radar-base" }));
  const now = svgEl("polygon", { points: poly(STAT_KEYS.map((k) => stats[k])), class: "radar-now" });
  svg.append(now);
  STAT_KEYS.forEach((k, i) => {
    // 頂点の外側に名前、その真下に★（横に並べると隣の文字と重なる）
    const [x, y] = pt(i, R + 30);
    const t = svgEl("text", { x, y: y - 8, class: "radar-label", "text-anchor": "middle", "dominant-baseline": "middle" });
    t.textContent = STAT_JA[k];
    svg.append(t);
    const s = svgEl("text", { x, y: y + 11, class: "radar-star", "text-anchor": "middle", "dominant-baseline": "middle" });
    s.textContent = "★".repeat(star(k));
    svg.append(s);
  });
  return svg;
}

export function openStatus() {
  const tabs = el("div.st-tabs");
  const body = el("div.st-body");
  const show = (id) => {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    body.replaceChildren(id === "me" ? meTab() : id === "people" ? peopleTab() : itemsTab());
  };
  for (const [id, label] of [["me", "ステータス"], ["people", "人間関係"], ["items", "持ち物"]]) {
    tabs.append(el("button.st-tab", { text: label, dataset: { tab: id }, onclick: () => show(id) }));
  }
  show("me");
  return modal({ title: "STATUS", body: el("div.status", [tabs, body]), className: "status-modal", options: [{ label: "閉じる", value: true, primary: true, test: "status-close" }] });
}

function meTab() {
  const rows = STAT_KEYS.map((k) => el("div.st-row", [
    el("span.st-name", { text: STAT_JA[k] }),
    el("span.st-stars", { text: starText(k) }),
    el("span.st-rank", { text: `「${rankLabel(k)}」` }),
    state.stats[k] > (state.statsAtChapterStart[k] || 0) ? el("span.st-up", { text: "↑" }) : null,
  ]));
  const r = state.stamina / maxStamina();
  return el("div.st-me", [
    el("div.st-radar", [radar(state.stats, state.statsAtChapterStart)]),
    el("div.st-side", [
      ...rows,
      el("div.st-misc", [
        el("div", { text: `所持金 ${yen(state.money)}` }),
        el("div", { text: `体力 ${r > 0.7 ? "元気" : r > 0.4 ? "ふつう" : r > 0.2 ? "疲れ気味" : "限界が近い"}` }),
      ]),
      el("p.st-note", { text: "淡い面は章のはじめ。明るい面が今の自分。" }),
    ]),
  ]);
}

const PEOPLE = ["sumi", "tsumugi", "naru", "adam", "minto", "rin"];
function peopleTab() {
  const rows = PEOPLE.filter((id) => state.met[id] || id === "sumi").map((id) => {
    const lv = affinityLevel(id);
    const face = faceIconUrl(id);
    return el("div.pp-row", [
      face ? el("img.pp-face", { src: face, alt: "" }) : el("span.pp-face.ph", { text: displayName(id, state)[0] }),
      el("span.pp-name", { text: displayName(id, state) }),
      el("span.pp-hearts", { text: "♥".repeat(lv) + "♡".repeat(5 - lv) }),
      state.contacts.includes(id) ? el("span.pp-lime", { text: "LIME" }) : null,
    ]);
  });
  return el("div.st-people", rows.length ? rows : [el("p", { text: "まだ誰とも親しくなっていない。" })]);
}

function itemsTab() {
  const eq = state.owned.map((id) => DB.equipById[id]).filter(Boolean);
  const fl = [...SHOP_FLAVORS, "nightside_earlgrey"].filter(ownsFlavor).map((id) => DB.flavorById[id]).filter(Boolean);
  const inUse = new Set(Object.values(state.equip));
  return el("div.st-items", [
    el("h4", { text: "機材" }),
    el("div.chips", eq.map((e) => el(`span.chip${inUse.has(e.id) ? ".on" : ""}`, { text: e.name }))),
    el("h4", { text: "フレーバー" }),
    el("div.chips", fl.map((f) => el("span.chip", { text: f.short_name || f.name }))),
    el("h4", { text: "レシピ帳" }),
    el("div.chips", DB.recipes.filter((r) => state.recipes[r.id]).map((r) => el("span.chip.gold", { text: r.name })).concat(
      Object.keys(state.recipes).length ? [] : [el("span.chip.dim", { text: "まだ白紙" })])),
  ]);
}
