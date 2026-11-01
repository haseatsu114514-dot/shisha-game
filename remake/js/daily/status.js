import { masteryLabel } from "../core/flavor-mastery.js";
// ステータス画面（master_spec #19 / #19-a）。数値は見せず、★・呼称・レーダーの形で伸びを見せる。
import { el, yen } from "../core/util.js";
import { DB, displayName, faceIconUrl, cgUrl } from "../core/data.js";
import { modal, heartRow, statBadge, layers } from "../core/ui.js";
import { state, STAT_KEYS, STAT_JA } from "../core/state.js";
import { cycleBadgeText } from "../core/cycle-display.js";
import { step, RANK_LABELS, affinityLevel, currentCondition } from "../core/stats.js";
import { nextStepProgress, stepOfValue } from "../core/stat-progress.js";
import { flavorStock, ownedFlavorIds } from "./shop.js";
import { relationshipStatus, recentMemoryEcho } from "./relationship-status.js";
import { KEEPSAKES } from "../core/keepsakes.js";
import { triedLater, comboName } from "./cafe-ideas.js";
import { growthEnabled, ensureGrowth } from "../core/growth.js";
import { growthCraftMemo } from "../core/growth-memory.js";
import { BOARD_KEYS, BOARD_JA, BOARD_HEAD, BOARD_WHERE, STAT_SQUARES, statCount, statRatio, perkTotals } from "../core/growth-board.js";

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
    s.textContent = `${stepOfValue(stats[k])}段`;
    svg.append(s);
  });
  return svg;
}

/**
 * 心得の盤の三角のグラフ（2026-10-30 オーナー「9段とか10段みたいな概念は無くす。盤の伸びをステータスグラフに」SBD63）。
 * 才能・感覚・理論の3つの角。灯した能力のマスの割合だけ伸びる。段の文字は出さない。
 */
export function boardTriangle(ratios, size = 340) {
  const c = size / 2, R = size * 0.38;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; return [c + Math.cos(a) * r, c + 12 + Math.sin(a) * r]; };
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "radar board-radar", "data-test": "board-radar" });
  for (let k = 1; k <= 4; k++) svg.append(svgEl("polygon", { points: [0, 1, 2].map((i) => pt(i, (R * k) / 4).join(",")).join(" "), class: "radar-grid" }));
  for (let i = 0; i < 3; i++) { const [x, y] = pt(i, R); svg.append(svgEl("line", { x1: c, y1: c + 12, x2: x, y2: y, class: "radar-axis" })); }
  svg.append(svgEl("polygon", { points: BOARD_KEYS.map((k, i) => pt(i, R * Math.max(0.05, ratios[k])).join(",")).join(" "), class: "radar-now" }));
  BOARD_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, R + 26);
    const t = svgEl("text", { x, y, class: `radar-label rb-${k}`, "text-anchor": "middle", "dominant-baseline": "middle" });
    t.textContent = BOARD_JA[k];
    svg.append(t);
  });
  return svg;
}

/** 盤を使う時のステータス（段なし）: 三角のグラフと、盤ごとの灯した数・恩恵の合計 */
function boardMeTab() {
  const lit = new Set(ensureGrowth().nodes);
  const note = el("p.st-note", { text: "心得の盤で灯した分だけ三角が広がる。項目をタップすると、何に効くかが分かる。" });
  const rows = BOARD_KEYS.map((k) => {
    const count = statCount(k, lit), sums = perkTotals(k, lit).filter((p) => p.sum);
    return el(`div.st-row.st-b-${k}`, {
      dataset: { test: `st-board-${k}` },
      onclick: (e) => {
        e.currentTarget.parentNode.querySelectorAll(".st-row").forEach((r) => r.classList.toggle("sel", r === e.currentTarget));
        note.textContent = `【${BOARD_JA[k]}】${BOARD_WHERE[k]}`;
      },
    }, [
      el("span.st-board-head", { text: BOARD_HEAD[k], "aria-hidden": "true" }),
      el("div.st-info", [
        el("div.st-line", [el("span.st-name", { text: BOARD_JA[k] }), el("span.st-count", { text: `${count}/${STAT_SQUARES[k]}` })]),
        el("span.st-fx", { text: sums.length ? sums.map((p) => p.text).join("・") : "まだ灯していない" }),
        el("i.st-next-track", { "aria-hidden": "true" }, [el("b", { style: { width: `${Math.round((count / STAT_SQUARES[k]) * 100)}%` } })]),
      ]),
    ]);
  });
  const condition = currentCondition();
  return el("div.st-me", [
    el("div.st-radar", [boardTriangle(Object.fromEntries(BOARD_KEYS.map((k) => [k, statRatio(k, lit)])))]),
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

export function openStatus() {
  const tabs = el("div.st-tabs");
  const body = el("div.st-body");
  const show = (id) => {
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    body.replaceChildren(id === "me" ? meTab() : id === "people" ? peopleTab() : itemsTab(showRecipe));
  };
  const showRecipe = (id) => {
    // ヒントだけの配合や、旧セーブに残った未知のIDから詳細を開かない。
    const recipe = DB.recipes.find((r) => r.id === id && state.recipes?.[r.id]);
    if (!recipe) return;
    const scroller = body.closest(".modal-body");
    const scrollTop = scroller.scrollTop;
    const back = el("button.btn", { text: "レシピ帳へ戻る", dataset: { test: "recipe-back" }, onclick: () => {
      show("items");
      body.querySelectorAll("[data-recipe]").forEach((button) => {
        if (button.dataset.recipe === id) button.focus({ preventScroll: true });
      });
      scroller.scrollTop = scrollTop;
    } });
    body.replaceChildren(recipeDetails(recipe), back);
    scroller.scrollTop = 0;
    back.focus({ preventScroll: true });
  };
  for (const [id, label] of [["me", "ステータス"], ["people", "人間関係"], ["items", "持ち物"]]) {
    tabs.append(el("button.st-tab", { text: label, dataset: { tab: id }, onclick: () => show(id) }));
  }
  show("me");
  // 周回数の表示はステータス見出しとセーブ枠だけ（HUDには出さない）。2周目以降のみ・小さく（設計 §3.6）
  const badge = cycleBadgeText(state);
  return modal({ title: "STATUS", body: el("div.status", [badge ? el("div.st-cycle", { text: badge, dataset: { test: "status-cycle" } }) : null, tabs, body]), className: "status-modal", options: [{ label: "閉じる", value: true, primary: true, test: "status-close" }] });
}


/** 今の段で効いていること。文は W2 の10段表を読む。 */
export function tierFx(k) {
  return DB.statusTexts?.statTierFx?.[k]?.[step(k) - 1] || "";
}

function meTab() {
  if (growthEnabled()) return boardMeTab();
  const note = el("p.st-note", { text: "項目をタップすると、何に効くかが分かる。淡い面は章のはじめ、明るい面が今の自分。" });
  const rows = STAT_KEYS.map((k) => {
    const progress = nextStepProgress(k);
    return el(`div.st-row.st-${k}`, {
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
        el("span.st-pips", { role: "img", "aria-label": `${step(k)}段` }, Array.from({ length: 10 }, (_, i) => el(`i${i < step(k) ? ".on" : ""}`, { "aria-hidden": "true" }))),
        el("span.st-rank", { text: `${step(k)}段・${RANK_LABELS[k][Math.floor((step(k) - 1) / 2)]}` }),
        state.stats[k] > (state.statsAtChapterStart[k] || 0) ? el("span.st-up", { text: "↑" }) : null,
      ]),
      el("span.st-fx", { text: tierFx(k) }),
      el(`div.st-next${progress.capped ? ".capped" : ""}`, { text: progress.label }),
      el(`i.st-next-track${progress.capped ? ".capped" : ""}`, { "aria-hidden": "true" }, [el("b", { style: { width: `${progress.fill}%` } })]),
    ]),
  ]); });
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

const PEOPLE = ["sumi", "tsumugi", "naru", "adam", "minto", "rin", "hiyori", "samechan", "ageha", "kumicho", "rei", "mashiro"];
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
    el("p.pp-guide", { text: "♥は親しさ。交流の進み方は相手によって異なる。恋愛・友情の分岐がある相手は♥3で方向を選ぶ。特別なイベントと贈り物がある相手は♥5でその節目へ（恋愛・友情のどちらでも受け取れる）。恋愛ルートはまだ交際前で、付き合うと「恋人」に変わる。LIMEの連絡先があれば、友達・恋人になった後も交流は続く。" }),
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

function craftMemoRows(id) {
  const memo = growthCraftMemo(state, id);
  if (!memo) return [];
  const mix = Object.entries(memo.mix).map(([id,g]) => `${DB.flavorById[id]?.short_name || DB.flavorById[id]?.name || id} ${g}g`).join(" ／ ");
  const diff = Number.isFinite(memo.previousTotal) ? memo.total - memo.previousTotal : null;
  return [el("p", { text: `作った配合：${mix}` }),
    el("p", { text: `直近の一台：${memo.total.toFixed(1)}点${diff == null ? "" : `（前回比 ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}）`}` })];
}

function recipeDetails(recipe) {
  const name = (id) => String(DB.flavorById[id]?.short_name || DB.flavorById[id]?.name || id).split(" ").pop();
  const day = state.recipes[recipe.id]?.day;
  return el("div.recipe-detail", { dataset: { test: "recipe-detail" } }, [
    el("h4", { text: recipe.name }),
    el("div.recipe-detail-text", [
      el("p", { text: `材料：${recipe.flavors.map(name).join(" ／ ")}` }),
      el("p", { text: recipe.golden
        ? `黄金比：${Object.entries(recipe.golden).map(([id, weight]) => `${name(id)} ${weight}`).join("：")}（割合）`
        : "黄金比：未設定" }),
      el("p.st-note", { text: growthCraftMemo(state,recipe.id) ? "同じ系統の銘柄でも作れる。作った配合と点をメモしている。" : "同じ系統の銘柄でも作れる。発見時のグラム数は記録していない。" }),
      ...craftMemoRows(recipe.id),
      el("p", { text: `発見日：${Number.isInteger(day) && day > 0 ? `DAY ${day}` : "記録なし"}` }),
      recipe.memo ? el("p", { text: recipe.memo }) : null,
    ]),
  ]);
}

function itemsTab(showRecipe) {
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
    growthCraftMemo(state,"_free") ? el("div.recipe-detail", { dataset: { test: "craft-memo-free" } }, [
      el("h4", { text: "レシピ名のない一台のメモ" }), ...craftMemoRows("_free"),
    ]) : null,
    el("p.st-note", { text: "名前をタップすると、材料・黄金比・発見日を確認できる。" }),
    el("div.chips", (() => {
      const found = DB.recipes.filter((r) => state.recipes?.[r.id]);
      return found.length ? found.map((r) => el("button.chip.gold.recipe-chip", {
        text: r.name, dataset: { recipe: r.id, test: `recipe-${r.id}` }, onclick: () => showRecipe(r.id),
      })) : [el("span.chip.dim", { text: "まだ白紙" })];
    })()),
    // 喫茶こはくで思いついた・ライバルから聞いた、まだ作っていない配合
    ...(() => {
      const later = triedLater(state, DB.recipes);
      return later.length ? [el("h4", { text: "試したい配合" }),
        el("div.chips", later.map((r) => el("span.chip", { text: comboName(r, DB.flavors) })))] : [];
    })(),
  ]);
}
