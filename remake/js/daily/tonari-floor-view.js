// tonari の六卓営業ステージ。状態・金額はモデルから読むだけで、日常の資源には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, retire, toast } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { buildVersioned } from "../core/asset-version.js";
import { createFloorShift, floorActions, stepFloorShift, floorSummary } from "./tonari-floor-model.js";

// The coordinates are the *tabletops* measured in the 16:9 room artwork, never a CSS card grid.
const TABLES = [
  [26.2, 36.4, "奥の窓際"], [50, 36.4, "奥の青いソファ"], [73.4, 36.4, "奥の丸卓"],
  [28.6, 70.4, "入口側の角卓"], [51.4, 69.1, "手前の丸卓"], [74.9, 71.0, "作業台側の角卓"],
];
const ROOM_FALLBACK = new URL("../../img/stages/tonari-floor.svg", import.meta.url).href;
const ROOM_ART = { day: null, night: null }; // Add dedicated WebPs only once their Git LFS objects are published.
const GUEST_COLORS = [
  ["#b69776", "#473729"], ["#697f8f", "#292a26"], ["#93905f", "#4a3026"],
  ["#9b6d62", "#392b28"], ["#647e71", "#372e28"], ["#9694a0", "#702f27"],
];
const PHASE = {
  empty: ["空席", "empty"], seated: ["注文を聞く", "order"], ordered: ["仕込み待ち", "order"],
  cooking: ["仕込み中", "cook"], ready: ["提供できる", "ready"], lounging: ["滞在中", "served"],
  checkout: ["会計待ち", "bill"], dirty: ["片付け待ち", "clean"],
};
const SHORT_PHASE = {
  seated: "注文", ordered: "仕込待ち", cooking: "仕込み", ready: "配膳",
  checkout: "会計", dirty: "片付け",
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
  pause: '<path d="M9 6v12m6-12v12"/>',
  wait: '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z m0 3v5l3 2"/>',
};
const icon = (key) => el("span.tf-icon", {
  "aria-hidden": true,
  html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (GLYPHS[key] ?? GLYPHS.empty) + "</svg>",
});
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

// Small original, non-interactive seated silhouettes. Furniture and lighting stay in the room image.
function patron(guest, secondary = false) {
  const variant = (Number(guest.id.slice(1)) - 1 + (secondary ? 2 : 0)) % GUEST_COLORS.length;
  const [shirt, hair] = GUEST_COLORS[variant];
  return el("span.tf-patron" + (secondary ? ".pair" : ""), { "aria-hidden": true,
    html: `<svg viewBox="0 0 70 86" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="34" cy="68" rx="29" ry="9" fill="#20190f" opacity=".34"/>
      <path d="M15 56q-4 13 4 14h35q8-2 2-13l-9-9H24z" fill="#282c2a"/>
      <path d="M23 28q-7 4-11 14L9 51q-2 7 5 9l15 1v-8l-10-1 7-8 1 14h18l-1-14 8 9-8 2v7l14-2q8-2 4-10l-5-11q-4-8-12-11z" fill="${shirt}" stroke="#382e26" stroke-width="1.1"/>
      <path d="M29 27v8q6 7 13 0v-9zM21 52l9 1q7 0 6 4l-4 3-11-1zm28 2-8 1q-5 2-1 5h9z" fill="#d7ab83"/>
      <path d="M24 16q-1-13 12-13 12 0 13 11l-1 11q-2 8-11 8-9-1-12-9z" fill="#d9af8e" stroke="#543e30" stroke-width="1"/>
      <path d="M24 21q-7-6-2-14t16-6q11 1 13 10l-2 7-4-10-5 5-11 2-2 9z" fill="${hair}"/>
      <path d="m31 21 2 1m8-1 2-1m-9 7q3 2 6-1" stroke="#755442" stroke-width="1" fill="none"/>
      <path d="m29 36 7 4 7-5" stroke="#fff1cd" stroke-opacity=".4" fill="none"/>
    </svg>` });
}

function tableControl(table, selected, turn, effect, choose) {
  const [status, glyph] = tableState(table);
  const [x, y, name] = TABLES[table.id - 1];
  const details = table.guest ? compact(table.guest.preference) : "";
  const deadline = Number.isFinite(table.due) && table.due >= turn
    && (table.request || ["seated", "ordered", "cooking", "ready"].includes(table.phase))
    ? (table.due === turn ? "今の手" : `あと${table.due - turn}手`) : null;
  const occupied = table.guest && table.phase !== "dirty";
  return el("button.tf-table", {
    type: "button", onclick: choose, tabIndex: selected ? 0 : -1, "aria-pressed": String(selected),
    "aria-label": `卓${table.id} ${name}、${status}${details ? "、" + details : ""}${deadline ? "、" + deadline : ""}`,
    style: { "--x": x + "%", "--y": y + "%" },
    dataset: {
      ...test("table-" + table.id), phase: table.phase, active: String(selected),
      row: table.id > 3 ? "near" : "far", party: occupied ? table.guest.party : 0,
      signal: glyph === "call" ? "call" : "", due: deadline && table.due <= turn + 1 ? "soon" : "",
    },
  }, [
    occupied ? patron(table.guest) : null,
    occupied && table.guest.party > 1 ? patron(table.guest, true) : null,
    el("span.tf-ring", { "aria-hidden": true }),
    el("span.tf-marker", [
      el("span.tf-table-number", { text: String(table.id) }),
      el("span.tf-table-status", [icon(glyph), el("b", { text: table.request ? status : SHORT_PHASE[table.phase] ?? status })]),
      deadline ? el("span.tf-deadline", { text: deadline }) : null,
    ]),
    effect?.id === table.id ? el("span.tf-beat", {
      "aria-hidden": true, text: effect.label, dataset: { kind: effect.kind },
    }) : null,
  ]);
}

function stat(label, value, glyph, options = {}) {
  return el("div.tf-station", { dataset: { ...test(options.key || glyph), active: String(!!options.active) } }, [
    icon(glyph),
    el("span.tf-station-title", { text: label }),
    el("b.tf-station-value", { text: value }),
  ]);
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
  seed, orders, anchorOrderId, night = false, isCurrent = () => true, signal = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  stylesheet();
  let state = createFloorShift({ seed, orders, anchorOrderId });
  let selected = 1;
  let overlay = null;
  let receiptDetail = false;
  let effect = null;
  let outerMenu = false;
  let active = true;
  let focusAfterRender = null;
  const customArt = ROOM_ART[night ? "night" : "day"];
  const art = el("div.tf-art", { "aria-hidden": true });
  const room = el("div.tf-room", { style: { "--tf-room": `url("${buildVersioned(ROOM_FALLBACK)}")` } });
  art.append(room);
  if (customArt) room.append(el("img", {
    src: buildVersioned(customArt), alt: "", decoding: "async", onerror: (event) => event.currentTarget.remove(),
  }));
  const host = el("section.tonari-floor", { "aria-label": "tonari 六卓営業", dataset: {
    ...test("screen"), night: String(night),
  } });
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
      if (outerMenu) return;
      effect = null;
      overlay = next;
      focusAfterRender = next ? "resume" : "pause";
      render();
    }

    function visibility() {
      if (!document.hidden || state.done || overlay || !active || !host.isConnected) return;
      changeOverlay("pause");
    }

    function keyboard(event) {
      if (!active || state.done || outerMenu) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        changeOverlay(overlay ? null : "pause");
      } else if (overlay && event.key === "Tab") {
        const buttons = frame.querySelectorAll(".tf-pause-actions button");
        const end = event.shiftKey ? 0 : buttons.length - 1;
        if (!buttons.length || document.activeElement !== buttons[end]) return;
        event.preventDefault();
        buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
      } else if (!overlay && event.target instanceof HTMLButtonElement && event.target.classList.contains("tf-table")) {
        const neighbours = {
          ArrowLeft: selected % 3 === 1 ? null : selected - 1,
          ArrowRight: selected % 3 === 0 ? null : selected + 1,
          ArrowUp: selected > 3 ? selected - 3 : null,
          ArrowDown: selected <= 3 ? selected + 3 : null,
        };
        const next = neighbours[event.key];
        if (!next) return;
        event.preventDefault();
        frame.querySelector(`[data-test="tonari-floor-table-${next}"]`)?.click();
      }
    }

    async function gameMenu() {
      if (outerMenu || !active || !isCurrent()) return;
      outerMenu = true;
      render();
      try {
        const { openMenu } = await import("./menu.js");
        if (!active || !isCurrent()) return;
        await openMenu({
          tab: "system", canSave: () => false, current: () => active && isCurrent(), leave: cancel,
          saveRule: "営業中は保存しません。最後に保存した勤務前の場所から再開できます。",
        });
      } catch {
        if (active && isCurrent()) toast("本編メニューを開けませんでした。", { kind: "warn" });
      } finally {
        outerMenu = false;
        focusAfterRender = "menu";
        render();
      }
    }

    function perform(action, basis) {
      if (!active || signal?.aborted || !isCurrent()) return cancel();
      // 別の手番で同じ座席を使い直しても、取り外されたボタンから処理を確定しない。
      if (state !== basis || overlay || document.hidden) return;
      const next = stepFloorShift(state, action.id);
      if (next === state) return;
      SE.select();
      const beat = {
        seat: "ご案内", serve: "配膳", care: "ケア完了", clear: "片付け",
        checkout: next.sales > state.sales ? `＋${yen(next.sales - state.sales)}` : "会計",
      }[action.kind];
      effect = beat ? { id: action.tableId, kind: action.kind, label: beat } : null;
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
        role: "dialog", "aria-modal": outerMenu ? null : "true", "aria-labelledby": "tf-pause-heading",
        inert: outerMenu ? true : null,
        dataset: test(leave ? "delegate-panel" : "pause-panel"),
      }, [
        el("div.tf-pause-card", [
          el("p.tf-eyebrow", { text: "tonari" }),
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
            !leave ? el("button.tf-action", { type: "button", text: "本編メニュー", onclick: gameMenu, dataset: test("menu") }) : null,
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
          el("h1.tf-title", ["tonari", el("span", { text: "六卓営業" })]),
          el("div.tf-clock", [
            el("div", [el("span", { text: "手番" }), el("b", { text: ` ${state.turn} / ${state.maxTurns}` })]),
            el("progress", { value: state.turn, max: state.maxTurns, "aria-label": "営業時間" }),
          ]),
          el("div.tf-ledger", [el("span", { text: "店の売上" }), el("strong", { text: yen(state.sales) })]),
          el("button.tf-pause-button", {
            type: "button", onclick: () => changeOverlay("pause"), dataset: test("pause"),
          }, [icon("pause"), el("span", { text: "休止" })]),
        ]),
        el("div.tf-entry", [
          stat("入口", standing ? `${state.waiting.length}組待ち` : nextGuestAt, "lobby", { active: standing, key: "entrance" }),
        ]),
        el("div.tf-pass", [
          stat("作業台", benchStatus, "cook", { active: running, key: "bench" }),
          stat("受渡棚", anyReady ? `卓${anyReady}へ提供` : "空き", "ready", { active: anyReady, key: "shelf" }),
        ]),
        el("div.tf-tables", { role: "group", "aria-label": "全6卓。矢印キーで選ぶ" },
          state.tables.map((table) => tableControl(table, table.id === selected, state.turn, effect, () => {
            if (!active || !isCurrent() || overlay || selected === table.id) return;
            selected = table.id;
            effect = null;
            SE.select();
            focusAfterRender = `table-${selected}`;
            render();
          }))),
        el("footer.tf-dock", [
          el("section.tf-ticket", {
            "aria-label": `卓${selected}の伝票`, dataset: test("ticket"),
          }, [
            el("div.tf-ticket-info", [
              el("div.tf-ticket-head", [
                el("span.tf-ticket-number", { text: `${selected}卓` }),
                el("h2", { text: activeTable.guest ? customerName(activeTable.guest)
                  : standing && activeTable.phase === "empty" ? "入口のお客さん" : TABLES[selected - 1][2] }),
                activeGuest ? el("span.tf-party", { text: `${activeGuest.party}名`, title: [
                  activeGuest.party > 1 ? "1台をシェア" : null, activeGuest.quiet ? "静かに過ごす" : null,
                  activeGuest.short ? "短い滞在" : null, activeGuest.firstTime ? "初めて" : null,
                ].filter(Boolean).join("・") }) : null,
              ]),
              activeGuest?.preference ? el("p.tf-preference", { text: "好み　" + compact(activeGuest.preference) }) : null,
              el("div.tf-ticket-copy", { tabindex: 0, role: "region", "aria-label": "卓の注文と様子" }, [
                activeTable.guest && activeTable.request ? el("span.tf-copy-state", { text: updatedPhase + "　" }) : null,
                line ? el("span", { text: line }) : null,
                recipe && !available.some((action) => ["order", "redo"].includes(action.kind))
                  ? el("span", { text: `　伝票：${recipe.label}` }) : null,
                helper ? el("span", { text: `　${helper}` }) : null,
              ]),
            ]),
            el("div.tf-actions", { dataset: { count: available.length } },
              available.map((action, i) => actionButton(action, () => perform(action, basis),
                i === 0 && !["order", "redo", "decline"].includes(action.kind)))),
          ]),
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
