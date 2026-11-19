// tonari の営業盤。状態・伝票金額はモデルから読み、日常の資源には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, retire } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { buildVersioned } from "../core/asset-version.js";
import { createFloorShift, floorActions, stepFloorShift, floorSummary } from "./tonari-floor-model.js";

const AREA_NAMES = ["窓際・手前", "窓際・奥", "奥のソファ", "奥の小卓", "カウンター左", "カウンター右"];
const PHASE = {
  empty: ["空席", "empty"], seated: ["注文を聞く", "order"], ordered: ["仕込み待ち", "order"],
  cooking: ["仕込み中", "cook"], ready: ["提供できる", "ready"], lounging: ["滞在中", "served"],
  checkout: ["会計待ち", "bill"], dirty: ["片付け待ち", "clean"],
};
const GLYPHS = {
  empty: '<path d="M5 12h14"/>',
  order: '<path d="M7 3h10v18l-5-3-5 3z M10 8h4m-4 4h4"/>',
  cook: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-4 2-5 0 2 1 3 2 3 1-1 2-4 1-8z"/>',
  ready: '<path d="M4 16h16m-14-2a6 6 0 0 1 12 0m-6-8V4"/>',
  served: '<path d="M6 18c-3-4 5-5 2-9m4 9c-3-4 5-5 2-9m4 9c-3-4 5-5 2-9"/>',
  bill: '<path d="M7 4h10v16H7z M10 8h4m-4 4h4m-4 4h4"/>',
  clean: '<path d="M5 18l7-7m1-7v4m-2-2h4m1 6v6m-3-3h6"/>',
  call: '<path d="M12 4v11m0 4h.01"/>',
  lobby: '<path d="M6 3h12v18H6z M11 12h5m-2-2 2 2-2 2"/>',
  wait: '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z m0 3v5l3 2"/>',
};
const icon = (key) => el("span.tf-icon", {
  "aria-hidden": true,
  html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (GLYPHS[key] ?? GLYPHS.empty) + "</svg>",
});
const tag = (text) => el("span.tf-tag", { text });
const compact = (value) => Array.isArray(value) ? value.join("・") : (value ?? "");
const test = (key) => ({ test: "tonari-floor-" + key });

function stylesheet() {
  if (document.querySelector("link[data-tonari-floor]")) return;
  const href = buildVersioned(new URL("../../css/tonari-floor.css", import.meta.url).href);
  document.head.append(el("link", { rel: "stylesheet", href, "data-tonari-floor": true }));
}

function customerName(guest) {
  return guest?.name || "お客さん";
}

function tableState(table) {
  return table.request
    ? [compact(table.request), "call"]
    : (PHASE[table.phase] || PHASE.empty);
}

function tableArt(table) {
  return el("span.tf-diagram", { "aria-hidden": true, dataset: { area: table.id > 4 ? "bar" : "sofa" } }, [
    el("i.tf-diagram-seat"), el("i.tf-diagram-top"), el("i.tf-diagram-linen"),
    el("i.tf-diagram-coaster"),
    table.guest ? el("i.tf-diagram-guest") : null,
    table.guest?.party > 1 ? el("i.tf-diagram-guest.pair") : null,
  ]);
}

function tableCard(table, selected, turn, choose) {
  const [status, glyph] = tableState(table);
  const t = table.id;
  const details = table.guest ? compact(table.guest.preference) : "";
  const deadline = Number.isFinite(table.due) && table.due >= turn
    && (table.request || ["seated", "ordered", "cooking", "ready"].includes(table.phase))
    ? (table.due === turn ? "今の手" : `あと${table.due - turn}手`) : null;
  return el("button.tf-table", {
    type: "button", onclick: choose, "aria-pressed": selected ? "true" : "false",
    "aria-label": `卓${t} ${AREA_NAMES[t - 1]}、${status}${details ? "、" + details : ""}${deadline ? "、" + deadline : ""}`,
    dataset: { ...test("table-" + t), phase: table.phase, active: String(selected), signal: glyph === "call" ? "call" : "", due: deadline && table.due <= turn + 1 ? "soon" : "" },
  }, [
    tableArt(table),
    el("span.tf-table-number", { text: String(t).padStart(2, "0") }),
    el("span.tf-table-name", { text: AREA_NAMES[t - 1] }),
    deadline ? el("span.tf-deadline", { "aria-hidden": true, text: deadline }) : null,
    el("span.tf-table-status", [icon(glyph), el("b", { text: status })]),
    el("span.tf-table-taste", { text: details || (table.phase === "dirty" ? "次の組のために整える" : table.guest ? customerName(table.guest) : "ご案内できます") }),
  ]);
}

function stat(label, value, glyph, options = {}) {
  return el("div.tf-station", { dataset: { ...test(options.key || glyph), active: String(!!options.active) } }, [
    icon(glyph),
    el("span.tf-station-title", { text: label }),
    el("b.tf-station-value", { text: value }),
  ]);
}

function guestFlags(guest) {
  if (!guest) return [];
  return [`${guest.party || 1}名`, guest.party > 1 ? "1台をシェア" : null,
    guest.quiet ? "静かに過ごす" : null, guest.short ? "短い滞在" : null,
    guest.firstTime ? "初めて" : null].filter(Boolean).map(tag);
}

function actionButton(action, invoke, isPrimary = false) {
  return el("button.tf-action", {
    type: "button", onclick: invoke,
    dataset: { ...test("action-" + action.kind), action: action.id, kind: action.kind, primary: String(isPrimary) },
  }, [
    el("strong", { text: action.label }),
    action.detail ? el("small", { text: compact(action.detail) }) : null,
  ]);
}

function receiptRows(summary) {
  return [
    ["提供した初回注文", `${summary.served || 0}組`],
    ["希望に合った提供", `${summary.matched || 0}組`],
    ["無料ケア", `${summary.care || 0}件`],
    ["有料の追加提供", `${summary.extras || 0}件`],
    ["未提供・お見送り", `${summary.missed || 0}組`],
  ].map(([label, value]) => el("div.tf-receipt-line", [el("dt", { text: label }), el("dd", { text: value })]));
}

/** 表示中は1確定＝1手。DOM の切替、休憩、別タブへの移動で状態を進めない。 */
export function runTonariFloor({
  seed, orders, anchorOrderId, isCurrent = () => true, signal = null, artUrl = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  stylesheet();
  let state = createFloorShift({ seed, orders, anchorOrderId });
  let selected = 1;
  let overlay = null;
  let receiptDetail = false;
  let active = true;
  let focusAfterRender = null;
  const art = el("div.tf-art", { "aria-hidden": true });
  if (artUrl) art.append(el("img", { src: artUrl, alt: "", decoding: "async" }));
  const host = el("section.tonari-floor", { "aria-label": "tonariの営業盤", dataset: { ...test("screen"), customArt: String(!!artUrl) } });
  const frame = el("div.tf-frame");
  const announce = el("p.tf-sr", { "aria-live": "polite", "aria-atomic": "true" });
  host.append(art, frame, announce);

  return new Promise((resolve) => {
    function settle(result) {
      if (!active) return;
      active = false;
      signal?.removeEventListener("abort", cancel);
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("keydown", keyboard);
      retire(host);
      resolve(result);
    }
    function cancel() { settle(null); }

    function changeOverlay(next) {
      overlay = next;
      focusAfterRender = next ? "resume" : "pause";
      render();
    }

    function visibility() {
      if (!document.hidden || state.done || overlay || !active || !host.isConnected) return;
      changeOverlay("pause");
    }

    function keyboard(event) {
      if (!active || state.done) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        changeOverlay(overlay ? null : "pause");
      } else if (overlay && event.key === "Tab") {
        const buttons = frame.querySelectorAll(".tf-pause-actions button");
        if (buttons.length !== 2 || document.activeElement !== buttons[event.shiftKey ? 0 : 1]) return;
        event.preventDefault();
        buttons[event.shiftKey ? 1 : 0].focus();
      } else if (!overlay && event.target instanceof HTMLButtonElement && event.target.classList.contains("tf-table")) {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
        if (!delta) return;
        const next = selected + delta;
        if (next < 1 || next > 6) return;
        event.preventDefault();
        frame.querySelector(`[data-test="tonari-floor-table-${next}"]`)?.click();
      }
    }

    function perform(action, basis) {
      if (!active || signal?.aborted || !isCurrent()) return cancel();
      // 別の手番で同じ座席を使い直しても、取り外されたボタンから処理を確定しない。
      if (state !== basis || overlay || document.hidden) return;
      const next = stepFloorShift(state, action.id);
      if (next === state) return;
      SE.select();
      state = next;
      announce.textContent = `手番${state.turn}。${state.notice || ""}`;
      focusAfterRender = state.done ? "continue" : `table-${selected}`;
      render();
    }

    function finish() {
      if (!active || signal?.aborted || !isCurrent()) return cancel();
      const action = floorActions(state).find((entry) => entry.kind === "finish");
      if (!action) return;
      overlay = null;
      perform(action, state);
    }

    function renderPause() {
      const leave = overlay === "delegate";
      return el("section.tf-pause", {
        role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-pause-heading",
        dataset: test(leave ? "delegate-panel" : "pause-panel"),
      }, [
        el("div.tf-pause-card", [
          el("p.tf-eyebrow", { text: "TONARI / FLOOR SERVICE" }),
          el("h2#tf-pause-heading", { text: leave ? "残りをスミさんに任せる？" : "ひと休み" }),
          el("p", { text: leave
            ? "提供済みの分だけ会計し、残りはスミさんに引き継ぎます。シフトの日当は変わりません。"
            : "選んで確定したときだけ、店内が1手進みます。読むだけではお客さんを待たせません。" }),
          !leave ? el("p.tf-pause-note", { text: "端末を閉じた場合は、前回保存した場所から再開します。" }) : null,
          el("div.tf-pause-actions", [
            el("button.tf-action", { type: "button", text: leave ? "営業に戻る" : "つづける",
              onclick: () => changeOverlay(null), dataset: { ...test("resume"), primary: "true" } }),
            el("button.tf-action", { type: "button", text: leave ? "引き継いで締める" : "残りを任せる",
              onclick: leave ? finish : () => changeOverlay("delegate"), dataset: test(leave ? "confirm-delegate" : "delegate") }),
          ]),
        ]),
      ]);
    }

    function renderReceipt() {
      const summary = floorSummary(state);
      return el("section.tf-receipt", { "aria-label": "今日の営業結果", dataset: test("receipt") }, [
        el("div.tf-receipt-paper", [
          el("p.tf-eyebrow", { text: "TONARI / SALES SLIP" }),
          el("h2", { text: "営業の締め伝票" }),
          el("div.tf-receipt-total", [el("span", { text: "担当卓の売上" }), el("strong", { text: yen(summary.sales), dataset: test("final-sales") })]),
          receiptDetail
            ? el("dl.tf-receipt-items", { "aria-label": "卓ごとの会計明細" }, summary.ledger.length
              ? summary.ledger.map((row) => el("div.tf-receipt-line", [
                el("dt", { text: `卓${row.tableId}・${row.party}名${row.handedOff ? "（引継ぎ）" : ""}` }),
                el("dd", { text: yen(row.total) }),
              ])) : el("div.tf-receipt-line", [el("dt", { text: "お会計なし" }), el("dd", { text: "0円" })]))
            : el("dl", receiptRows(summary)),
          el("p.tf-receipt-note", { text: "この売上は、はじめの所持金には入りません。日当は通常どおりです。" }),
          el("div.tf-receipt-actions", [
            el("button.tf-action", { type: "button", text: receiptDetail ? "まとめを見る" : "会計明細を見る",
              onclick: () => {
                receiptDetail = !receiptDetail;
                focusAfterRender = "receipt-detail";
                render();
              }, dataset: test("receipt-detail") }),
            el("button.tf-action", { type: "button", onclick: () => settle(isCurrent() && !signal?.aborted ? summary : null),
              text: "シフトを終える", dataset: { ...test("continue"), primary: "true" } }),
          ]),
        ]),
      ]);
    }

    function renderBoard() {
      const basis = state;
      const { standing, running } = {
        standing: state.waiting[0],
        running: state.bench,
      };
      const at = (id) => state.tables.find((table) => table.id === id);
      const activeTable = at(selected);
      const activeGuest = activeTable.guest || (activeTable.phase === "empty" ? standing : null);
      const actions = floorActions(state);
      const available = actions.filter((action) => action.tableId === selected);
      const globalWait = actions.find((action) => action.kind === "wait");
      const anyReady = state.shelf?.tableId;
      const recipeOf = (id) => state.recipes.find((recipe) => recipe.id === id);
      const recipe = recipeOf(activeTable.recipeId);
      const updatedPhase = tableState(activeTable)[0];
      const line = available.some((action) => action.kind === "order") ? activeGuest?.quote : activeTable.note || activeGuest?.quote;
      const nextGuestAt = Number.isFinite(state.nextArrival) ? `次は${state.nextArrival}手目` : "来店予定なし";
      const benchStatus = running
        ? `卓${running.tableId}・${running.readyAt <= state.turn ? "棚待ち" : "あと" + (running.readyAt - state.turn) + "手"}`
        : "空き";
      const helper = !available.length
        ? activeTable.phase === "empty" ? "入口にお客さんが来たら、ここへご案内できます。"
          : activeTable.phase === "cooking" ? "作業台で準備中。その間にほかの卓へ。"
          : activeTable.guest?.quiet ? "必要な合図があるまでは、そっとしておこう。" : "対応できる用件ができたら、ここに表示されます。"
        : null;
      const board = [
        el("header.tf-header", [
          el("div.tf-title", [el("span.tf-eyebrow", { text: "FLOOR SERVICE" }), el("h1", ["tonari", el("span", { text: "営業中" })])]),
          el("div.tf-clock", [
            el("div", [el("b", { text: "手番 " + state.turn }), el("span", { text: " / " + state.maxTurns })]),
            el("progress", { value: state.turn, max: state.maxTurns, "aria-label": "営業時間" }),
          ]),
          el("div.tf-ledger", [el("span", { text: "担当卓の売上" }), el("strong", { text: yen(state.sales) })]),
          el("button.tf-pause-button", { type: "button", text: "ひと休み", onclick: () => changeOverlay("pause"), dataset: test("pause") }),
        ]),
        el("div.tf-stations", [
          stat("入口", standing ? `${state.waiting.length}組待ち` : nextGuestAt, "lobby", { active: standing, key: "entrance" }),
          stat("作業台", benchStatus, "cook", { active: running, key: "bench" }),
          stat("受渡棚", anyReady ? `卓${anyReady}へ提供` : "空き", "ready", { active: anyReady, key: "shelf" }),
        ]),
        el("div.tf-workspace", [
          el("div.tf-tables", { role: "group", "aria-label": "全6卓" },
            state.tables.map((table) => tableCard(table, table.id === selected, state.turn, () => {
              if (!active || !isCurrent() || overlay) return;
              selected = table.id;
              SE.select();
              focusAfterRender = `table-${selected}`;
              render();
            }))),
          el("section.tf-ticket", {
            "aria-label": `卓${selected}の伝票`, dataset: test("ticket"),
          }, [
            el("div.tf-ticket-head", [
              el("span.tf-ticket-number", { text: String(selected).padStart(2, "0") }),
              el("div", [el("h2", { text: AREA_NAMES[selected - 1] }), el("p", {
                text: activeTable.guest ? customerName(activeTable.guest) + "・" + updatedPhase
                  : standing && activeTable.phase === "empty" ? "入口のお客さん" : updatedPhase,
              })]),
            ]),
            activeGuest ? el("div.tf-ticket-profile", [
              compact(activeGuest.preference) ? el("p.tf-preference", { text: "好み　" + compact(activeGuest.preference) }) : null,
              el("div.tf-tags", guestFlags(activeGuest)),
            ]) : null,
            line ? el("p.tf-ticket-quote", { text: line }) : null,
            recipe && !available.some((action) => ["order", "redo"].includes(action.kind))
              ? el("p.tf-ticket-recipe", { text: "伝票　" + recipe.label }) : null,
            helper ? el("p.tf-helper", { text: helper }) : null,
            el("div.tf-actions", { dataset: { split: String(available.length > 1) } }, available.map((action, i) => actionButton(action, () => perform(action, basis),
              i === 0 && !["order", "redo", "decline"].includes(action.kind)))),
          ]),
        ]),
        el("footer.tf-footer", [
          el("div.tf-log", [el("span.tf-eyebrow", { text: "FLOOR NOTE" }), el("p", { text: state.notice || "空席を選び、お客さんをご案内。" })]),
          globalWait ? el("button.tf-wait", { type: "button", onclick: () => perform(globalWait, basis), dataset: test("wait") },
            [icon("wait"), el("span", { text: "一手見守る" })]) : null,
        ]),
      ];
      return el("div.tf-board", { inert: overlay ? true : null }, board);
    }

    function render() {
      if (!active || !isCurrent() || signal?.aborted) return cancel();
      frame.replaceChildren(state.done ? renderReceipt() : renderBoard(), overlay ? renderPause() : "");
      if (focusAfterRender) {
        frame.querySelector(`[data-test="tonari-floor-${focusAfterRender}"]`)?.focus({ preventScroll: true });
        focusAfterRender = null;
      }
    }

    signal?.addEventListener("abort", cancel, { once: true });
    document.addEventListener("visibilitychange", visibility);
    host.addEventListener("keydown", keyboard);
    render();
    showScreen("tonari-floor", host);
    // ポインターでの操作を邪魔せず、キーボードと読み上げの開始位置を盤の先頭へ。
    requestAnimationFrame(() => {
      if (active && host.isConnected && !host.contains(document.activeElement)) {
        frame.querySelector('[data-test="tonari-floor-table-1"]')?.focus({ preventScroll: true });
      }
    });
  });
}
