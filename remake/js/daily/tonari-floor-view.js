// tonari の五卓営業ステージ。状態・金額はモデルから読むだけで、日常の資源には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, retire, toast } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { buildVersioned } from "../core/asset-version.js";
import { createFloorShift, floorActions, stepFloorShift, floorSummary, FLOOR_TABLE_COUNT } from "./tonari-floor-model.js";

// The coordinates are the *tabletops* measured in the 16:9 room artwork, never a CSS card grid.
const TABLES = [
  [26.2, 36.4, "奥の窓際"], [50, 36.4, "奥の青いソファ"], [73.4, 36.4, "奥の丸卓"],
  [31.4, 67.5, "入口側の角卓"], [68.9, 67.5, "作業台側の角卓"],

];
const ROOM_FALLBACK = new URL("../../img/stages/tonari-five.svg", import.meta.url).href;
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

// These are drawn from the side at seated height. The same drawing is reflected left/right,
// never rotated from a portrait. Open cheek/eyeline reads from the fixed room camera.
function patron(table, secondary = false) {
  const guest = table.guest;
  const variant = (Number(guest.id.slice(1)) - 1 + (secondary ? 2 : 0)) % GUEST_COLORS.length;
  const [shirt, hair] = GUEST_COLORS[variant];
  const [side, profile] = [
    ["right", true], ["right", false], ["left", true], ["right", true], ["left", true],
  ][table.id - 1];
  const faceRight = secondary && table.id < 4 ? side !== "right" : side === "right";
  const strictProfile = profile && !secondary;
  const facing = faceRight ? "right" : "left";
  const gesture = !secondary && (table.request || table.phase === "checkout") ? "call" : guest.quiet ? "read" : "rest";
  const hands = gesture === "call"
    ? `<path d="M39 52q14 1 20-7l6-13 6 2-3 16q-7 14-21 12" fill="${shirt}" stroke="#3f3028" stroke-width="1.5"/>
       <path d="M64 31q-2-7 1-11l2 2 2-6q1-2 3 0v8q4-4 5-1-1 6-6 11z" fill="#dcb699" stroke="#745440" stroke-width="1.1"/>`
    : gesture === "read"
      ? '<path d="M41 59l17-8 13 4-3 15-19 1z" fill="#debc8d" stroke="#60432f" stroke-width="1.3"/><path d="m58 51-2 18" stroke="#b48162" stroke-width="1.2"/>'
      : '<path d="M48 60q10 4 18 0l7 1q3 4-2 6l-12 1-10-1z" fill="#dcb699" stroke="#805d49" stroke-width=".8"/>';
  return el("span.tf-patron" + (secondary ? ".pair" : ""), {
    "aria-hidden": true, dataset: { facing, profile: strictProfile ? "side" : "quarter", gesture },
    html: `<svg viewBox="0 0 90 92" xmlns="http://www.w3.org/2000/svg">
      <g${faceRight ? "" : ' transform="translate(90 0) scale(-1 1)"'}>
        <ellipse cx="39" cy="76" rx="30" ry="8" fill="#211a15" opacity=".28"/>
        <path d="M23 62q1-8 16-8l17 5 13 11q5 6-2 10l-8 2-14-9-15 6-14-5z" fill="#32333b" stroke="#26282c" stroke-width="1.1"/>
        <path d="M35 75l13-4 10 10q-9 5-24 3l-10-6z" fill="#41444a"/>
        <path d="M31 37q11-2 17 7l6 16-10 6-16 2q-7-1-8-13l4-16z" fill="${shirt}" stroke="#493a30" stroke-width="1.4"/>
        <path d="M28 44q6 10 2 18l-7 3-1-17z" fill="#342720" opacity=".2"/>
        <path d="M30 38l4-10 12 3-1 11-5 5z" fill="#c89b7c" stroke="#6b4e3f" stroke-width=".9"/>
        <path d="M33 44q7 2 8 7l9 8-3 8q-15-2-19-14-2-6 5-9" fill="${shirt}" stroke="#4d3d32" stroke-width="1.25"/>
        ${hands}
        ${strictProfile ? `
          <path d="M30 14q3-8 14-8 11 1 13 9l-1 6 5 5q1 1-5 3l-1 4-2 1-3 6q-11 2-17-8l-5-7z" fill="#dcb699" stroke="#644939" stroke-width="1.5"/>
          <path d="M30 36q-6-6-6-16 0-13 10-17 17-6 23 8l-3 7-5-7q-3 7-12 9l-1 13z" fill="${hair}" stroke="#44322a" stroke-width="1"/>
          <path d="M37 23q-4-1-4 4 1 5 5 4" fill="#c78e72" stroke="#92705a" stroke-width=".9"/>
          <path d="m49 22 5 0m-1 10 2 .2" stroke="#4d3c33" stroke-width="1.6" stroke-linecap="round"/>
        ` : `
          <path d="M29 13q5-8 17-7 11 1 12 12l-2 5 3 4-4 2-2 7-7 4-12-4-7-12z" fill="#dcb699" stroke="#644939" stroke-width="1.4"/>
          <path d="M29 34q-9-9-5-20 4-12 16-12 13 0 18 9l-5 7-4-5q-4 5-16 5l-1 14z" fill="${hair}" stroke="#44322a" stroke-width="1"/>
          <path d="M32 23q-4 0-2 5l4 2m7-7 5 .3m6-2 3-.7m-8 10q2 2 5 0" stroke="#614839" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        `}
      </g>
    </svg>`,
  });
}

// Percent coordinates share the room and hit area projection. Vertical movement from the rear centre can reach either side of the aisle.
function tableInDirection(id, key) {
  const heading = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!heading) return null;
  const [x, y] = TABLES[id - 1];
  const [hx, hy] = heading;
  let best = Infinity;
  let target = null;
  TABLES.forEach(([tx, ty], i) => {
    const dx = (tx - x) * 12.8;
    const dy = (ty - y) * 7.2;
    const along = dx * hx + dy * hy;
    const across = Math.abs(dx * hy - dy * hx);
    if (along <= 0 || across > along * (hy ? 1.2 : .8)) return;
    const rank = along + across * 2;
    if (rank < best) { best = rank; target = i + 1; }
  });
  return target;
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
      row: table.id > 3 ? "near" : "far", side: table.id === 4 ? "left" : table.id === 5 ? "right" : "",
      party: occupied ? table.guest.party : 0,
      signal: glyph === "call" ? "call" : "", due: deadline && table.due <= turn + 1 ? "soon" : "",
    },
  }, [
    occupied ? patron(table) : null,
    occupied && table.guest.party > 1 ? patron(table, true) : null,
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
  let leaving = false;
  let active = true;
  let focusAfterRender = null;
  const customArt = ROOM_ART[night ? "night" : "day"];
  const art = el("div.tf-art", { "aria-hidden": true });
  const room = el("div.tf-room", { style: { "--tf-room": `url("${buildVersioned(ROOM_FALLBACK)}")` } });
  art.append(room);
  if (customArt) room.append(el("img", {
    src: buildVersioned(customArt), alt: "", decoding: "async", onerror: (event) => event.currentTarget.remove(),
  }));
  const host = el("section.tonari-floor", { "aria-label": "tonari 五卓営業", dataset: {
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
        const next = tableInDirection(selected, event.key);
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
          tab: "system", canSave: () => false, current: () => active && isCurrent(),
          leave: () => {
            // Resolving the shift before reload would release calendar's save guard.
            // The visibility autosave during unload must never persist unpaid shift changes.
            leaving = true;
            retire(host);
          },
          saveRule: "営業中は保存しません。最後に保存した勤務前の場所から再開できます。",
        });
      } catch {
        if (active && isCurrent()) toast("本編メニューを開けませんでした。", { kind: "warn" });
      } finally {
        if (!leaving) {
          outerMenu = false;
          focusAfterRender = "menu";
          render();
        }
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
          el("h1.tf-title", ["tonari", el("span", { text: "五卓営業" })]),
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
        el("div.tf-tables", { role: "group", "aria-label": `全${FLOOR_TABLE_COUNT}卓。矢印キーで選ぶ` },
          state.tables.map((table) => tableControl(table, table.id === selected, state.turn, effect, (event) => {
            if (!active || !isCurrent() || overlay) return;
            if (selected === table.id) {
              // Enter / Space inspects the current order; only a separate action advances play.
              if (event.detail === 0) {
                (frame.querySelector(".tf-ticket .tf-action") || frame.querySelector(".tf-ticket-copy"))?.focus({ preventScroll: true });
              }
              return;
            }
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
