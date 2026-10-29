import { masteryLabel } from "../core/flavor-mastery.js";
// ステータス画面（master_spec #19 / #19-a）。数値は見せず、★・呼称・レーダーの形で伸びを見せる。
import { el, yen } from "../core/util.js";
import { DB, displayName, faceIconUrl, cgUrl } from "../core/data.js";
import { modal, heartRow, statBadge, layers } from "../core/ui.js";
import { state, STAT_KEYS, STAT_JA } from "../core/state.js";
import { cycleBadgeText } from "../core/cycle-display.js";
import { step, starText, rankLabel, affinityLevel, currentCondition } from "../core/stats.js";
import { flavorStock, ownedFlavorIds } from "./shop.js";
import { relationshipStatus, recentMemoryEcho } from "./relationship-status.js";
import { KEEPSAKES } from "../core/keepsakes.js";
import { triedLater, comboName } from "./cafe-ideas.js";

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
    const s = svgEl("text", { x, y: y + 11, class: `radar-star rs-${k}`, "text-anchor": "middle", "dominant-baseline": "middle" });
    s.textContent = "★".repeat(step(k));
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
  // 周回数の表示はステータス見出しとセーブ枠だけ（HUDには出さない）。2周目以降のみ・小さく（設計 §3.6）
  const badge = cycleBadgeText(state);
  return modal({ title: "STATUS", body: el("div.status", [badge ? el("div.st-cycle", { text: badge, dataset: { test: "status-cycle" } }) : null, tabs, body]), className: "status-modal", options: [{ label: "閉じる", value: true, primary: true, test: "status-close" }] });
}


/** 今の段で効いていること（段が上がるたびに変わる一言） */
export function tierFx(k) {
  return DB.statusTexts?.statTierFx?.[k]?.[step(k) - 1] || "";
}

function meTab() {
  const note = el("p.st-note", { text: "項目をタップすると、何に効くかが分かる。淡い面は章のはじめ、明るい面が今の自分。" });
  const rows = STAT_KEYS.map((k) => el(`div.st-row.st-${k}`, {
    dataset: { test: `st-${k}` },
    onclick: (e) => {
      e.currentTarget.parentNode.querySelectorAll(".st-row").forEach((r) => r.classList.toggle("sel", r === e.currentTarget));
      note.textContent = `【${STAT_JA[k]}】${DB.statusTexts?.statPurpose?.[k] || ""}`;
    },
  }, [
    statBadge(k, "st-badge"),
    el("div.st-info", [
      el("div.st-line", [
        el("span.st-name", { text: STAT_JA[k] }),
        el("span.st-stars", { text: starText(k) }),
        el("span.st-rank", { text: `「${rankLabel(k)}」` }),
        state.stats[k] > (state.statsAtChapterStart[k] || 0) ? el("span.st-up", { text: "↑" }) : null,
      ]),
      el("span.st-fx", { text: tierFx(k) }),
    ]),
  ]));
  const condition = currentCondition();
  return el("div.st-me", [
    el("div.st-radar", [radar(state.stats, state.statsAtChapterStart)]),
    el("div.st-side", [
      ...rows,
      el("div.st-misc", [
        el("div", { text: `所持金 ${yen(state.money)}` }),
        el("div", { text: `体力 ${condition.label} ── ${condition.hint}。眠ると回復し、外出すると行き先に応じて疲れる。` }),
      ]),
      note,
    ]),
  ]);
}

const PEOPLE = ["sumi", "tsumugi", "naru", "adam", "minto", "rin", "hiyori", "samechan", "ageha"];
function peopleTab() {
  const rows = PEOPLE.filter((id) => state.met[id] || id === "sumi").map((id) => {
    const lv = affinityLevel(id);
    const face = faceIconUrl(id);
    const lover = (state.lovers || []).includes(id);
    const relation = relationshipStatus(id);
    // 直近の交流の思い出を前面に。無い人は中立のまま（反復する♥説明は全体ガイドへ集約）
    const memory = recentMemoryEcho(id);
    const hearts = heartRow(Array.from({ length: 5 }, (_, i) => i < lv ? 100 : 0), {
      className: "heart-row", bond: lover, label: lover ? "恋人（♥5）" : "好感度",
    });
    return el(`div.pp-row${lover ? ".lover" : ""}`, { dataset: { person: id, relation: relation.kind } }, [
      face ? el("img.pp-face", { src: face, alt: "" }) : el("span.pp-face.ph", { text: displayName(id, state)[0] }),
      el("div.pp-detail", [
        el("div.pp-heading", [
          el("span.pp-name", { text: displayName(id, state) }),
          el("span.pp-hearts", [hearts, el("span.pp-relation", { text: relation.label })]),
          state.contacts.includes(id) ? el("span.pp-lime", { text: "LIME" }) : null,
        ]),
        memory ? el("p.pp-memory", { text: memory }) : null,
        !lover && relation.label !== "友達" && relation.hint ? el("p.pp-next", { text: relation.hint }) : null,
      ]),
    ]);
  });
  return el("div.st-people", [
    el("p.pp-guide", { text: "♥は親しさ。♥3で恋愛・友情のどちらで続けるかを選び、♥5で特別なイベントと贈り物（どちらを選んでも受け取れる）。恋愛ルートはまだ交際前で、付き合うと「恋人」に変わる。友達・恋人になった後もLIMEで交流は続く。" }),
    ...(rows.length ? rows : [el("p", { text: "まだ誰とも親しくなっていない。" })]),
  ]);
}

/** 贈られた機材の札（贈り主・染み付いた香り・効き・売却不可）。1行に収める */
function giftNote(e) {
  const flavor = DB.flavorById[e.gift.flavor];
  const leaf = flavor?.short_name || flavor?.name || e.gift.flavor;
  return el("div.gift-note", { dataset: { test: `gift-${e.id}` } }, [
    el("b", { text: e.name }),
    el("small", { text: `${displayName(e.gift.from, state)}から（${e.gift.reason}）・染み付いた香り：${leaf}（${e.gift.min_grams}g以上で香りが開く）・売却不可` }),
  ]);
}

function itemsTab() {
  const eq = state.owned.map((id) => DB.equipById[id]).filter(Boolean);
  const fl = [...new Set([...ownedFlavorIds(), ...Object.keys(state.flavorMastery || {})])].map(id => DB.flavorById[id]).filter(Boolean);
  const grams = (id) => `${flavorStock(id)}g · ${masteryLabel(state, id, DB.flavorById)}`;
  const inUse = new Set(Object.values(state.equip));
  const gifts = eq.filter((e) => e.gift);
  return el("div.st-items", [
    el("h4", { text: "記念品" }),
    el("div.keepsake-list", state.keepsakes?.length ? state.keepsakes.map((id) => {
      const item = KEEPSAKES[id];
      if (!item) return null;
      return el("button.keepsake-card", { dataset: { test: `keepsake-${id}` }, onclick: () => {
        const viewer = el("button.keepsake-viewer", { "aria-label": "チェキを閉じる", onclick: () => viewer.remove() }, [el("img", { src: cgUrl(item.cg), alt: item.name }), el("span", { text: "タップで閉じる" })]);
        layers.modal.append(viewer);
      } }, [el("img", { src: cgUrl(item.cg), alt: "" }), el("span", [el("b", { text: item.name }), el("small", { text: item.description })])]);
    }) : [el("span.chip.dim", { text: "まだ持っていない" })]),
    el("h4", { text: "機材" }),
    el("div.chips", eq.map((e) => el(`span.chip${inUse.has(e.id) ? ".on" : ""}${e.gift ? ".gift" : ""}`, { text: e.name }))),
    gifts.length ? el("div.gift-notes", gifts.map(giftNote)) : null,
    el("h4", { text: "フレーバー" }),
    el("div.chips", fl.length ? fl.map((f) => el("span.chip", [f.short_name || f.name, el("small.chip-g", { text: grams(f.id) })])) : [el("span.chip.dim", { text: "所持0" })]),
    el("p.st-note", { text: "1箱50g。自宅の試作・店への持ち込み・大会の課題以外の葉で消費。大会の課題フレーバーは支給され、本番中は好きなだけ使える（在庫は減らない）。熟練度はLv.5まで。" }),
    el("h4", { text: "レシピ帳" }),
    el("div.chips", DB.recipes.filter((r) => state.recipes[r.id]).map((r) => el("span.chip.gold", { text: r.name })).concat(
      Object.keys(state.recipes).length ? [] : [el("span.chip.dim", { text: "まだ白紙" })])),
    // 喫茶こはくで思いついた・ライバルから聞いた、まだ作っていない配合
    ...(() => {
      const later = triedLater(state, DB.recipes);
      return later.length ? [el("h4", { text: "試したい配合" }),
        el("div.chips", later.map((r) => el("span.chip", { text: comboName(r, DB.flavors) })))] : [];
    })(),
  ]);
}
