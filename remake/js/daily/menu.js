// 全画面MENU（DUI03・#2097。設計 docs/design/daily-ui-menu-design.md §4）。
// ステータス／人間関係／持ち物／システムの4タブ。中身は保存データを読むだけで、
// 書き換えるのはシステムタブの操作（セーブ・ロード・タイトルへ戻る）だけ。
// 日常パート（calendar.js の runDaily）の HUD の MENU から開く。章別のMENUもここへ寄せていく。
import { el, yen } from "../core/util.js";
import { layers, modal, toast, heartRow, statBadge, ghostOut } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { DB, displayName, faceIconUrl, cgUrl } from "../core/data.js";
import { state, save, requestResumeOnBoot, STAT_KEYS, STAT_JA } from "../core/state.js";
import { step, RANK_LABELS, affinityLevel, currentCondition, staminaRatio } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { nextStepProgress } from "../core/stat-progress.js";
import { chapterDay, chapterFinalDay, chapterDaysLeft, chapterGoalLabel } from "../core/chapter-clock.js";
import { cycleBadgeText } from "../core/cycle-display.js";
import { masteryLevel } from "../core/flavor-mastery.js";
import { KEEPSAKES } from "../core/keepsakes.js";
import { HOBBY_GEAR } from "../core/hobby-gear.js";
import { growthEnabled, gaugeAt, hidaneTotal, openGrowthBoard } from "../core/growth.js";
import { BOARD_KEYS, BOARD_JA, BOARD_HEAD, BOARD_WHERE, statTotal, statCount, perkTotals } from "../core/growth-board.js";
import { saveFlow, loadWithRecovery } from "../scenes/saves.js";
import { glossaryPanel } from "../vn/glossary.js";
import { isRainy } from "./weather.js";
import { flavorStock, ownedFlavorIds } from "./shop.js";
import { relationshipStatus, recentMemoryEcho } from "./relationship-status.js";
import { triedLater, comboName } from "./cafe-ideas.js";
import { tierFx, STATUS_PEOPLE, giftNote, recipeDetails } from "./status.js";
import { fullscreenButton } from "../scenes/save-transfer.js";

export const MENU_TABS = Object.freeze([
  { id: "status", icon: "👤", label: "ステータス" },
  { id: "people", icon: "💬", label: "人間関係" },
  { id: "items", icon: "🎒", label: "持ち物" },
  { id: "system", icon: "⚙", label: "システム" },
]);

const SAVE_RULE = "手動セーブは、地図で行き先を選んでいる時にできる。";
let busy = false;

/** タブの見出し。常に出していた説明・注意書きは見出し横の「?」に寄せ、押した時だけ見出しの下に開く（#2717〜#2719 の方針・2026-11-08 オーナー指示「説明の分量を減らす」）。
 *  lines が空なら「?」は出さない。開閉は体力の「?」と同じ（Esc でも閉じる）。 */
function tabHeading(title, lines, id) {
  const shown = lines.filter(Boolean);
  if (!shown.length) return [el("div.dm-heading", [el("h3", { text: title })])];
  const tip = el("div.dm-tab-help", { id: `dm-help-${id}`, hidden: true, dataset: { test: `menu-help-text-${id}` } }, shown.map((text) => el("p", { text })));
  const help = el("button.dm-help", { type: "button", text: "?", "aria-label": `${title}の説明`, "aria-expanded": "false", "aria-controls": `dm-help-${id}`,
    dataset: { test: `menu-help-${id}` }, onclick: () => {
      const open = tip.hidden;
      SE.click();
      tip.hidden = !open;
      help.setAttribute("aria-expanded", String(open));
    } });
  return [el("div.dm-heading", [el("h3", { text: title }), help]), tip];
}
const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
const pips = (n, total, label) => el("span.dm-pips", { role: "img", "aria-label": label },
  Array.from({ length: total }, (_, i) => el(`i${i < n ? ".on" : ""}`, { "aria-hidden": "true" })));

/**
 * 全画面MENUを開き、閉じるか選んだ操作が終わるまで待つ。戻り値は選んだ操作（閉じただけなら null）。
 * @param o.tab 最初に開くタブ（status / people / items / system）
 * @param o.canSave () => boolean。手動セーブ・タイトルへ戻る前の保存ができる時か（日常では地図で行き先を選んでいる時）
 * @param o.current () => boolean。開いた場面がまだ続いているか（違えば操作を走らせない）
 * @param o.leave () => void。ロード・タイトルへ戻るで再読み込みする直前の後片付け
 */
export async function openMenu({ tab = "status", canSave = () => true, current = () => true, leave = () => {} } = {}) {
  if (busy || !state || !layers.modal) return null;
  busy = true;
  const owner = state;
  try {
    SE.select();
    // 紙の絵（img/ui/paper/menu-bg.webp）は起動時に他のUIの絵と一緒に読んである（core/ui.js）。読めなくても同じ色の紙と帯で開く。
    const action = await showMenu(MENU_TABS.some((t) => t.id === tab) ? tab : "status", { saveOk: !!canSave() });
    if (!action || state !== owner || !current()) return null;
    await runAction(action, { canSave, leave });
    return action;
  } finally { busy = false; }
}

async function runAction(action, { canSave, leave }) {
  if (action === "save") {
    // 会話や作業の途中の状態は残さない（#638）。ボタンは無効にしてあるが、開いた後に状況が変わった時も守る。
    if (!canSave()) { toast(SAVE_RULE); return; }
    await saveFlow();
  }
  if (action === "load") {
    if (await loadWithRecovery({ inGame: true })) { leave(); requestResumeOnBoot(); location.reload(); }
  }
  if (action === "board") await openGrowthBoard();
  if (action === "config") await (await import("../scenes/title.js")).openConfig();
  if (action === "glossary") await modal({ title: "用語集", body: glossaryPanel(), className: "glossary-modal", options: [{ label: "閉じる", value: true, primary: true }] });
  if (action === "rules") await (await import("../scenes/rule-sheet.js")).openRuleSheet();
  // タイトルへ戻る時も、手動セーブと同じ時だけ保存する。途中の状態は残さず、行動前のオートセーブへ戻す（#638）。
  if (action === "title") { if (canSave()) save(); leave(); location.reload(); }
}

/** MENUボタンの中心（#modal の座標）。開閉の小さな開口の起点（#2688 A13）。ボタンが見えない画面では null */
function menuOrigin() {
  const button = layers.hud?.querySelector(".hud-menu"), host = layers.modal;
  if (!button || !host?.offsetWidth) return null;
  const b = button.getBoundingClientRect(), h = host.getBoundingClientRect();
  if (!b.width || !h.width) return null;
  const k = h.width / host.offsetWidth;
  return { x: Math.round((b.left + b.width / 2 - h.left) / k), y: Math.round((b.top + b.height / 2 - h.top) / k) };
}

function showMenu(initial, { saveOk }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const tabs = new Map();
    let active = initial;
    const panel = el("div.dm-panel", { id: "dm-panel", role: "tabpanel", tabindex: "-1", dataset: { test: "menu-panel" } });
    const root = el("div.dmenu", { role: "dialog", "aria-modal": "true", "aria-label": "MENU", dataset: { test: "menu", tab: initial } });

    const finish = (value) => {
      window.removeEventListener("keydown", onKey, true);
      // 閉じるときは、紙の面がMENUボタンへ縮みながら消える（開いたときの逆）。ボタンが無い画面ではふつうに消える
      const origin = menuOrigin();
      ghostOut([...layers.modal.childNodes], origin ? [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.82)" }] : [{ opacity: 1 }, { opacity: 0 }], origin ? 200 : 160, { origin, box: ".dm-sheet" });
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const choose = (value) => { SE.select(); finish(value); };
    const close = () => { SE.cancel(); finish(null); };

    const show = (id, { focus = false } = {}) => {
      active = id;
      root.dataset.tab = id;
      for (const [key, button] of tabs) {
        const on = key === id;
        button.classList.toggle("on", on);
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
      }
      panel.setAttribute("aria-labelledby", `dm-tab-${id}`);
      panel.replaceChildren(...render(id).filter(Boolean));
      panel.scrollTop = 0;
      if (focus) tabs.get(id)?.focus({ preventScroll: true });
    };

    // レシピ帳の詳細は持ち物タブの中で開き、戻ると元の位置へ。
    const openRecipe = (id) => {
      const recipe = DB.recipes.find((r) => r.id === id && state.recipes?.[r.id]);
      if (!recipe) return;
      const scrollTop = panel.scrollTop;
      const back = el("button.dm-btn", { type: "button", text: "レシピ帳へ戻る", dataset: { test: "recipe-back" }, onclick: () => {
        SE.cancel();
        show("items");
        panel.querySelector(`[data-recipe="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
        panel.scrollTop = scrollTop;
      } });
      panel.replaceChildren(el("div.dm-recipe", [recipeDetails(recipe), back]));
      panel.scrollTop = 0;
      back.focus({ preventScroll: true });
    };

    const render = (id) => id === "people" ? peopleTab()
      : id === "items" ? itemsTab(openRecipe)
      : id === "system" ? systemTab(choose, saveOk)
      : statusTab(choose);

    const tablist = el("div.dm-tabs", { role: "tablist", "aria-label": "メニューのタブ", "aria-orientation": "vertical" },
      MENU_TABS.map((t, i) => {
        const button = el("button.dm-tab", {
          type: "button", role: "tab", id: `dm-tab-${t.id}`, "aria-controls": "dm-panel",
          title: `${t.label}（${i + 1}）`, dataset: { tab: t.id, test: `menu-tab-${t.id}` },
          onclick: () => { if (active !== t.id) { SE.click(); show(t.id); } },
        }, [el("span.dm-icon", { text: t.icon, "aria-hidden": "true" }), el("span.dm-label", { text: t.label })]);
        tabs.set(t.id, button);
        return button;
      }));

    const onKey = (e) => {
      if (!root.isConnected) return;
      if (e.target?.closest?.("input, select, textarea, [contenteditable]")) return;
      const viewer = layers.modal.querySelector(".keepsake-viewer");
      if (e.key === "Escape" || e.key === "m" || e.key === "M") {
        e.preventDefault(); e.stopPropagation();
        if (e.repeat) return;
        if (viewer) { viewer.click(); return; }
        const help = root.querySelector('.dm-help[aria-expanded="true"]');
        if (help && e.key === "Escape") { help.click(); return; }
        const back = panel.querySelector('[data-test="recipe-back"]');
        if (back && e.key === "Escape") { back.click(); return; }
        close();
        return;
      }
      if (viewer) return;
      const index = MENU_TABS.findIndex((t) => t.id === active);
      const arrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && e.target?.closest?.(".dm-tab");
      let next = null;
      if (e.key === "q" || e.key === "Q") next = index - 1;
      else if (e.key === "e" || e.key === "E") next = index + 1;
      else if (/^[1-4]$/.test(e.key)) next = Number(e.key) - 1;
      else if (arrow) next = index + (e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1);
      if (next === null || (e.repeat && !arrow)) return;
      e.preventDefault(); e.stopPropagation();
      const target = MENU_TABS[(next + MENU_TABS.length) % MENU_TABS.length].id;
      if (target !== active) SE.click();
      show(target, { focus: true });
    };

    const cycle = cycleBadgeText(state);
    root.append(
      el("div.dm-backdrop", { "aria-hidden": "true" }),
      el("section.dm-sheet", [
        el("nav.dm-side", [
          el("h2.dm-title", [el("span", { text: "MENU" }), cycle ? el("small.dm-cycle", { text: cycle, dataset: { test: "menu-cycle" } }) : null]),
          tablist,
        ]),
        el("header.dm-head", [
          summary(),
          el("button.dm-close", { type: "button", text: "閉じる", dataset: { test: "menu-close" }, onclick: close }),
        ]),
        panel,
      ]),
    );
    layers.modal.replaceChildren(root);
    layers.modal.classList.add("show");
    // MENUボタンの位置から広がって開く（#2688 A13）。押し判定と見た目がずれないよう、切り抜きではなく拡大で見せる。
    // 動きを減らす設定・2画面表示では、紙のシートの短いフェード（css/daily-menu.css）だけ
    const origin = menuOrigin();
    const sheet = root.querySelector(".dm-sheet");
    if (origin && sheet && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // 起点はシートの座標に直す（#modal 全体の座標 − シートの位置）
      const host = layers.modal.getBoundingClientRect(), box = sheet.getBoundingClientRect(), k = host.width / layers.modal.offsetWidth || 1;
      sheet.style.transformOrigin = `${origin.x - (box.left - host.left) / k}px ${origin.y - (box.top - host.top) / k}px`;
      sheet.animate([{ opacity: 0, transform: "scale(.82)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" });
    }
    window.addEventListener("keydown", onKey, true);
    show(initial, { focus: true });
  });
}

// ---------------------------------------------------------------- 上の帯（HUDと同じ値の要約）
// MENU を開いている間は HUD を隠し、この帯だけで日付・残り日数・体力・所持金を見せる（#2859。css/daily-menu.css）。
// 体力の説明は常に出さず、横の「?」を押した時だけ帯の下に開く。

function summary() {
  const finalDay = chapterFinalDay(state);
  const left = chapterDaysLeft(state);
  const night = state.slot >= 1;
  const slot = state.phase === "tournament" ? "大会当日" : state.slot >= 2 ? "帰宅" : `${night ? "夜" : "昼"}${isRainy() ? "・雨" : ""}`;
  const condition = conditionForRatio(staminaRatio());
  const now = currentCondition();
  const item = (label, value, cls = "", extra = null) => el(`span.dm-sum${cls}`, [el("small", { text: label }), value, extra]);
  const tip = el("p.dm-health-tip", { id: "dm-health-tip", hidden: true, dataset: { test: "menu-condition" } }, [
    el("b", { text: `体力 ${now.label}` }),
    ` ── ${now.hint}。眠ると回復し、外出すると行き先に応じて疲れる。`,
  ]);
  const help = el("button.dm-help", { type: "button", text: "?", "aria-label": "体力の説明", "aria-expanded": "false", "aria-controls": "dm-health-tip",
    dataset: { test: "menu-condition-help" }, onclick: () => {
      const open = tip.hidden;
      SE.click();
      tip.hidden = !open;
      help.setAttribute("aria-expanded", String(open));
    } });
  return el("div.dm-summary", { dataset: { test: "menu-summary" } }, [
    item("DAY", el("b", [String(chapterDay(state)), finalDay === null ? null : el("small", { text: `/${finalDay}` })])),
    el("span.dm-sum.dm-slot", { text: slot }),
    item(chapterGoalLabel(state), el("b.dm-amber", { text: left === null ? "未定" : `あと${left}日` })),
    item("体力", el("b", { text: now.label }), `.dm-health.h-${condition.health}`, help),
    item("所持金", el("b", { text: yen(state.money) })),
    tip,
  ]);
}

// ---------------------------------------------------------------- ステータス

function statusTab(choose) {
  // 行をタップした時だけ、何に効くかをここに出す（タップの案内は「?」へ）
  const note = el("p.dm-note", { hidden: true });
  const select = (row, text) => {
    SE.click();
    row.parentNode.querySelectorAll(".dm-row").forEach((r) => r.classList.toggle("sel", r === row));
    note.textContent = text;
    note.hidden = false;
  };
  return [
    ...tabHeading("ステータス", growthEnabled()
      ? ["経験値は寝る前に精算する。ゲージの濃い紫が精算済み、薄い紫が今日の分。", "レベルが上がると火種が届く。灯すと才能・感覚・理論の盤が広がる。", "項目をタップすると、何に効くかが分かる。"]
      : ["↑はこの章のはじめから伸びた能力。", "項目をタップすると、何に効くかが分かる。"], "status"),
    ...(growthEnabled() ? growthCards(choose, select) : [statRows(select)]),
    note,
  ];
}

/** 心得の盤を使う時（SPEC 6.1）: Lv と EXP、火種、才能・感覚・理論の横ゲージ。三角・五角形のグラフは出さない（DUI03・04） */
function growthCards(choose, select) {
  const g = state.growth && typeof state.growth === "object" ? state.growth : null; // 見るだけ。無ければ作らない
  const gauge = g ? gaugeAt(g.level, g.settledXp, g.xp) : gaugeAt(1, 0, 0);
  const hidane = hidaneTotal(g);
  const lit = new Set(Array.isArray(g?.nodes) ? g.nodes : []);
  const left = gauge.max ? "MAX" : `次のレベルまで EXP ${gauge.left}`;
  return [
    el("div.dm-grid.dm-grid-2", [
      el("section.dm-card.dm-level", { dataset: { test: "menu-level" } }, [
        el("div.dm-level-line", [el("span.dm-lv", [el("small", { text: "Lv." }), el("b", { text: String(gauge.level) })]), el("span.dm-level-left", { text: left })]),
        el("i.dm-gauge.dm-exp", { "aria-hidden": "true" }, [el("b.today", { style: { width: pct(gauge.now) } }), el("b.settled", { style: { width: pct(gauge.settled) } })]),
      ]),
      el("section.dm-card.dm-hidane", { dataset: { test: "menu-hidane" } }, [
        el("div.dm-hidane-line", [el("b.dm-big.dm-amber", { text: String(hidane) }), el("span.dm-strong", { text: "火種" }),
          hidane > 0 ? el("span.dm-chip.new", { text: "心得の盤に灯せる" }) : null]),
      ]),
    ]),
    el("section.dm-card.dm-board", [
      ...BOARD_KEYS.map((k) => {
        const count = statCount(k, lit), total = statTotal(k) || 1;
        const sums = perkTotals(k, lit).filter((p) => p.sum);
        const row = el(`button.dm-row.dm-board-row.b-${k}`, { type: "button", dataset: { test: `menu-board-${k}` },
          onclick: () => select(row, `【${BOARD_JA[k]}】${BOARD_WHERE[k]}`) }, [
          el("span.dm-board-head", { text: BOARD_HEAD[k], "aria-hidden": "true" }),
          el("span.dm-strong.dm-board-name", { text: BOARD_JA[k] }),
          el("span.dm-board-bar", [
            el("i.dm-gauge", { "aria-hidden": "true" }, [el("b.settled", { style: { width: pct(count / total) } })]),
            el("small.dm-sub", { text: sums.length ? sums.map((p) => p.text).join("・") : "まだ灯していない" }),
          ]),
          el("span.dm-count", { text: `${count} / ${total}` }),
        ]);
        return row;
      }),
      el("div.dm-actions", [el("button.dm-btn.primary", { type: "button", text: hidane ? `心得の盤を見る（火種 ${hidane}）` : "心得の盤を見る",
        dataset: { test: "menu-board" }, onclick: () => choose("board") })]),
    ]),
  ];
}

/** 盤の公開前（GROWTH_BOARD=false）: 旧5能力の段と呼称を同じ紙の行で出す（設計 §4）。レーダーは出さない */
function statRows(select) {
  return el("section.dm-card.dm-stats", STAT_KEYS.map((k) => {
    const progress = nextStepProgress(k);
    const grown = state.stats[k] > (state.statsAtChapterStart?.[k] || 0);
    const row = el(`button.dm-row.dm-stat.s-${k}`, { type: "button", dataset: { test: `menu-stat-${k}` },
      onclick: () => select(row, `【${STAT_JA[k]}】${DB.statusTexts?.statPurpose?.[k] || ""}`) }, [
      // 行はボタンなので、札も span で置く（文字は報酬カードと同じ漢字1字）。
      el("span.dm-badge", { text: statBadge(k).textContent, "aria-hidden": "true" }),
      el("span.dm-stat-main", [
        el("span.dm-stat-line", [
          // 読む順は 能力名 → 段位 → 丸（段の進み）。次の段までは右（狭い画面では下）の帯で続ける。
          el("span.dm-strong", { text: STAT_JA[k] }),
          el("span.dm-rank", { text: `${step(k)}段・${RANK_LABELS[k][Math.floor((step(k) - 1) / 2)]}` }),
          grown ? el("span.dm-up", { text: "↑", title: "この章で伸びた" }) : null,
          pips(step(k), 10, `${step(k)}段`),
        ]),
        el("span.dm-fx", { text: tierFx(k) }),
      ]),
      el(`span.dm-next${progress.capped ? ".capped" : ""}`, [
        el("small", { text: progress.label }),
        el("i.dm-gauge", { "aria-hidden": "true" }, [el("b.settled", { style: { width: `${progress.fill}%` } })]),
      ]),
    ]);
    return row;
  }));
}

// ---------------------------------------------------------------- 人間関係

function peopleTab() {
  const ids = STATUS_PEOPLE.filter((id) => state.met[id] || id === "sumi");
  const owned = (state.owned || []).map((id) => DB.equipById[id]).filter(Boolean);
  const rows = ids.map((id) => {
    const lv = affinityLevel(id);
    const lover = (state.lovers || []).includes(id);
    const relation = relationshipStatus(id);
    const face = faceIconUrl(id);
    const name = displayName(id, state);
    const memory = recentMemoryEcho(id);
    const hint = !lover && relation.label !== "友達" && relation.hint ? relation.hint : null;
    const gifts = owned.filter((e) => e.gift?.from === id).map((e) => e.name);
    const detail = el("div.dm-person-detail", { hidden: true, dataset: { test: `menu-person-detail-${id}` } }, [
      memory ? el("p.dm-memory", { text: memory }) : null,
      hint ? el("p.dm-hint", { text: hint }) : null,
      gifts.length ? el("p.dm-gift", { text: `贈り物：${gifts.join("・")}` }) : null,
      !memory && !hint && !gifts.length ? el("p.dm-hint", { text: "まだ思い出は少ない。" }) : null,
    ]);
    const row = el(`button.dm-person${lover ? ".lover" : ""}`, {
      type: "button", "aria-expanded": "false", dataset: { test: `menu-person-${id}`, person: id, relation: relation.kind },
      onclick: () => {
        const open = row.getAttribute("aria-expanded") !== "true";
        row.closest(".dm-people").querySelectorAll(".dm-person").forEach((r) => {
          const on = r === row && open;
          r.setAttribute("aria-expanded", String(on));
          r.nextElementSibling.hidden = !on;
        });
      },
    }, [
      face ? el("img.dm-face", { src: face, alt: "" }) : el("span.dm-face.ph", { text: [...name][0] || "?", "aria-hidden": "true" }),
      el("span.dm-strong.dm-name", { text: name }),
      el("span.dm-person-status", [
        heartRow(Array.from({ length: 5 }, (_, i) => i < lv ? 100 : 0), { className: "heart-row", bond: lover, label: lover ? "恋人（♥5）" : `好感度 ♥${lv}` }),
        el(`span.dm-chip.rel-${relation.kind}`, { text: relation.label }),
      ]),
      state.contacts?.includes(id) ? el("span.dm-chip.lime", { text: "LIME" }) : el("span.dm-chip.blank", { "aria-hidden": "true" }),
    ]);
    return el("div.dm-person-item", { role: "listitem" }, [row, detail]);
  });
  return [
    ...tabHeading("人間関係", [
      "行をタップすると、直近の思い出と贈り物が分かる。",
      "♥は親しさ。交流の進み方は相手によって異なる。恋愛・友情の分岐がある相手は♥3で方向を選ぶ。特別なイベントと贈り物がある相手は♥5でその節目へ（恋愛・友情のどちらでも受け取れる）。",
      "恋愛ルートはまだ交際前で、付き合うと「恋人」に変わる。LIMEの連絡先があれば、友達・恋人になった後も交流は続く。",
    ], "people"),
    el("section.dm-card.dm-people", { role: "list", dataset: { test: "menu-people" } },
      rows.length ? rows : [el("p.dm-empty", { text: "まだ誰とも親しくなっていない。" })]),
  ];
}

// ---------------------------------------------------------------- 持ち物

function itemsTab(openRecipe) {
  const flavors = [...new Set([...ownedFlavorIds(), ...Object.keys(state.flavorMastery || {})])].map((id) => DB.flavorById[id]).filter(Boolean);
  const equipment = (state.owned || []).map((id) => DB.equipById[id]).filter(Boolean);
  const inUse = new Set(Object.values(state.equip || {}));
  const gifts = equipment.filter((e) => e.gift);
  const gear = [...new Set(state.owned || [])].map((id) => HOBBY_GEAR[id]).filter(Boolean);
  const recipes = DB.recipes.filter((r) => state.recipes?.[r.id]);
  const later = triedLater(state, DB.recipes);
  const keepsakes = (state.keepsakes || []).filter((id) => KEEPSAKES[id]);
  const card = (title, children, test) => el("section.dm-card", { dataset: test ? { test } : {} }, [
    el("div.dm-card-head", [el("span.dm-strong", { text: title })]), ...children]);
  return [
    ...tabHeading("持ち物", [
      "フレーバーは1箱50g。自宅の試作・店への持ち込み・大会の課題以外の葉で消費。大会の課題フレーバーは支給され、本番中は好きなだけ使える（在庫は減らない）。熟練度はLv.5まで。",
      "機材は紫の札が今使っているもの。点線の札は贈り物。",
      recipes.length ? "レシピ帳は名前をタップすると、材料・黄金比・発見日を確認できる。" : null,
    ], "items"),
    el("div.dm-grid.dm-items", [
      card("フレーバー", [
        el("div.dm-flavors", flavors.length ? flavors.map((f) => {
          const level = masteryLevel(state, f.id, DB.flavorById);
          return el("div.dm-flavor", { dataset: { test: `menu-flavor-${f.id}` } }, [
            el("span.dm-strong.dm-flavor-name", { text: f.short_name || f.name }),
            el("span.dm-grams", { text: `${flavorStock(f.id)}g` }),
            pips(level, 5, `熟練度 Lv.${level}`),
            el("span.dm-mastery", { text: level >= 5 ? "MAX" : `Lv.${level}` }),
          ]);
        }) : [el("p.dm-empty", { text: "まだ持っていない" })]),
      ], "menu-flavors"),
      el("div.dm-col", [
        card("機材", [
          el("div.dm-chips", equipment.length ? equipment.map((e) => el(`span.dm-chip${inUse.has(e.id) ? ".on" : ""}${e.gift ? ".gift" : ""}`, { text: e.name })) : [el("span.dm-empty", { text: "まだ持っていない" })]),
          gifts.length ? el("div.dm-gifts", gifts.map(giftNote)) : null,
        ], "menu-equipment"),
        gear.length ? card("遊びの道具", [
          el("div.dm-chips", { dataset: { test: "menu-hobby-gear" } }, gear.map((g) => el("span.dm-chip", [g.short, el("small", { text: g.effect })]))),
        ]) : null,
        card("レシピ帳", [
          el("div.dm-chips", recipes.length ? recipes.map((r) => el("button.dm-chip.recipe", {
            type: "button", text: r.name, dataset: { recipe: r.id, test: `recipe-${r.id}` }, onclick: () => { SE.click(); openRecipe(r.id); },
          })) : [el("span.dm-empty", { text: "まだ白紙" })]),
          later.length ? el("div.dm-later", [el("span.dm-strong", { text: "試したい配合" }),
            el("div.dm-chips", later.map((r) => el("span.dm-chip", { text: comboName(r, DB.flavors) })))]) : null,
        ], "menu-recipes"),
        card("記念品", [
          el("div.dm-keepsakes", keepsakes.length ? keepsakes.map((id) => {
            const item = KEEPSAKES[id];
            const opener = el("button.dm-keepsake", { type: "button", dataset: { test: `keepsake-${id}` }, onclick: () => {
              SE.click();
              const viewer = el("button.keepsake-viewer", { type: "button", "aria-label": "チェキを閉じる",
                onclick: () => { viewer.remove(); opener.focus({ preventScroll: true }); } },
                [el("img", { src: cgUrl(item.cg), alt: item.name }), el("span", { text: "タップで閉じる" })]);
              layers.modal.append(viewer);
              viewer.focus({ preventScroll: true });
            } }, [el("img", { src: cgUrl(item.cg), alt: "" }), el("span", [el("b", { text: item.name }), el("small", { text: item.description })])]);
            return opener;
          }) : [el("span.dm-empty", { text: "まだ持っていない" })]),
        ], "menu-keepsakes"),
      ]),
    ]),
  ];
}

// ---------------------------------------------------------------- システム

const SYSTEM = [
  { id: "save", label: "セーブ", primary: true },
  { id: "load", label: "ロード" },
  { id: "config", label: "設定" },
  { id: "glossary", label: "用語集" },
  { id: "rules", label: "大会の規則" },
  { id: "title", label: "タイトルへ戻る" },
];

/** 全画面ボタンはタイトルの部品（.btn.xfer-btn）なので、MENUのほかの操作と同じ札の見た目にそろえる（#3555）。 */
function systemFullscreenButton() {
  const button = fullscreenButton();
  if (!button) return [];
  button.className = "dm-btn dm-sys";
  return [button];
}

function systemTab(choose, saveOk) {
  return [
    ...tabHeading("システム", ["行動のたびに自動でセーブされている。", SAVE_RULE, "タイトルへ戻ると、行動前のオートセーブから再開する。"], "system"),
    el("div.dm-system", SYSTEM.map((s) => el(`button.dm-btn.dm-sys${s.primary ? ".primary" : ""}`, {
      type: "button", text: s.label, dataset: { test: `menu-${s.id}` },
      disabled: s.id === "save" && !saveOk,
      onclick: () => choose(s.id),
    })).concat(systemFullscreenButton())),
    // セーブできない時だけ理由を出す（いつも自動で保存されている説明は「?」へ）
    saveOk ? null : el("p.dm-note", { dataset: { test: "menu-save-note" }, text: `今はセーブできない。${SAVE_RULE}` }),
  ];
}

