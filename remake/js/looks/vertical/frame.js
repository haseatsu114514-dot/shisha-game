// 縦画面「煙の舞台」（C案）の外枠。土台は上画面6：下画面4（VPN09）。上画面＝絵（背景・立ち絵・地図・盤）と、その下端に重ねる
// テロップ・札・返事。下画面＝補助ボタンの段と輪の十字キー・丸ボタンで、どの場面でも同じ位置に置く（指を置いたまま遊べるように）。
// 見た目は css/look-vertical.css（下画面の高さは --ctrl-h。試作の会話画面と同じ・VPN16）。寸法は試作（remake/previews/portrait-stage/）と同じ比で、スマホの幅 39 を 1 単位（--u）として組む。
// 中身（どの絵・どの文・どのボタン）は場面ごとの部品（looks/vertical/*.js）が入れる。ここは置き場所と押した時の振り分けだけ。
import { el } from "../../core/util.js";

// 文字の代わりに使う絵記号（24×24・線画。試作の ICONS と同じ形）
export const ICONS = {
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  list: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4.5" cy="7" r="1.3" class="f"/><circle cx="4.5" cy="12" r="1.3" class="f"/><circle cx="4.5" cy="17" r="1.3" class="f"/>',
  wide: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  near: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  bang: '<path d="M12 4.5v9.5"/><circle cx="12" cy="18.7" r="1.4" class="f"/>',
  log: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4 4.5V9h4.5"/><path d="M12 8v4.5l3 2"/>',
  auto: '<path d="M8 5.5v13l11-6.5z" class="f"/>',
  skip: '<path d="M4 6v12l8-6zM13 6v12l8-6z" class="f"/>',
  book: '<path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zM12 6.5v13"/>',
  gear: '<circle cx="12" cy="12" r="3.3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  help: '<path d="M8.5 9a3.5 3.5 0 1 1 5.6 2.8c-1.2.9-2.1 1.6-2.1 3.2"/><circle cx="12" cy="19" r="1.3" class="f"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 7.5l3.5 5 3.5-5M12 12.5V17M9 12.5h6M9 15h6"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" class="f"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  think: '<path d="M7 15a4 4 0 0 1-.5-7.9 5 5 0 0 1 9.6-.9A4.2 4.2 0 0 1 17 15z"/><circle cx="8.5" cy="18.5" r="1.2"/><circle cx="5.5" cy="21" r=".8"/>',
  board: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  slot: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M9 6v12M15 6v12"/>',
  flame: '<path d="M12 3.5c1 3.5 5 5.2 5 9.7a5 5 0 0 1-10 0c0-2 1-3.3 2-4.6.3 1.6 1 2.5 2 2.9-.3-2.9.2-5.4 1-8z"/>',
  dots: '<circle cx="5.5" cy="12" r="1.7" class="f"/><circle cx="12" cy="12" r="1.7" class="f"/><circle cx="18.5" cy="12" r="1.7" class="f"/>',
};
export const icon = (name) => `<svg class="vt-ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dots}</svg>`;
const TRI = '<svg viewBox="0 0 24 24" aria-hidden="true" class="vt-tri"><path d="M12 5l8 13H4z" fill="currentColor"/></svg>';
// 丸ボタンの顔（試作の BTN と同じ。決める時は漢字の「決定」、送る時は下向きの山）
const FACES = {
  ok: { label: "決定", text: "決定" },
  go: { label: "行く", text: "決定" },
  next: { label: "次へ", svg: '<path d="M8.5 11.5l7.5 8 7.5-8"/>' },
  rest: { label: "選べない", svg: '<path d="M20.5 5.5a11 11 0 1 0 6 15.5 9 9 0 0 1-6-15.5z"/>' },
  close: { label: "閉じる", text: "閉じる" },
};

/** 外枠を作る。handlers: { dir(dir), a(), chip(id), tapPicture(), tapTelop() } は場面の振り分け（vertical.js）が受ける。 */
export function createFrame(handlers) {
  const amb = el("img.vt-amb", { alt: "", "aria-hidden": "true", draggable: "false" });
  const picture = el("div.vt-pic", { dataset: { test: "vt-picture" } });
  const veil = el("i.vt-veil", { "aria-hidden": "true" });
  const hud = el("div.vt-hud", { dataset: { test: "vt-hud" } });
  const telop = el("div.vt-telop", { dataset: { test: "vt-telop" } });
  const chips = el("div.vt-chips", { dataset: { test: "vt-chips" } });
  const dpad = el("div.vt-dpad.idle", { role: "group", "aria-label": "十字キー", dataset: { test: "vt-dpad" } });
  const buttonA = el("button.vt-a", { type: "button", dataset: { test: "vt-a" } });
  const ctrl = el("div.vt-ctrl", [chips, dpad, buttonA]);
  const body = el("div.vt-body", [telop, ctrl]);
  const over = el("div.vt-over", { hidden: true, dataset: { test: "vt-over" } });
  const notices = el("div.vt-notices", { role: "status", dataset: { test: "vt-notices" } });
  const root = el("div.vt-shell", { hidden: true, lang: "ja", dataset: { test: "vt-shell", scene: "", kind: "" } },
    [amb, picture, veil, hud, body, over, notices]);

  // 十字キー: 4つの扇の形の押し場所。押せる向きだけ明るく、役割の絵記号を小さく添える
  const keys = {};
  for (const dir of ["up", "left", "right", "down"]) {
    keys[dir] = el(`button.vt-dp.vt-dp-${dir}`, { type: "button", dataset: { dir, test: `vt-dp-${dir}` }, "aria-label": dir });
    keys[dir].addEventListener("click", (event) => { event.stopPropagation(); if (keys[dir].classList.contains("live")) handlers.dir?.(dir); });
    dpad.append(keys[dir]);
  }
  buttonA.addEventListener("click", (event) => { event.stopPropagation(); if (!buttonA.disabled) handlers.a?.(); });
  chips.addEventListener("click", (event) => {
    const chip = event.target.closest(".vt-chip");
    if (!chip || chip.disabled) return;
    event.stopPropagation();
    handlers.chip?.(chip.dataset.id);
  });
  picture.addEventListener("click", () => handlers.tapPicture?.());
  telop.addEventListener("click", (event) => {
    if (event.target.closest("button, a, input, select, textarea")) return;
    handlers.tapTelop?.();
  });

  let ambSrc = "", chipSig = "", padSig = "", hudSig = "", noticeSig = "";

  /** 外枠全体の背景（ぼかした場の絵）。 */
  function setAmbient(url) {
    if (url === ambSrc) return;
    ambSrc = url || "";
    if (ambSrc) amb.src = ambSrc; else amb.removeAttribute("src");
    amb.hidden = !ambSrc;
  }

  /** 補助ボタンの段（案1「名前つきの段」）。items: [{ id, icon, label, name, badge, on, disabled }] */
  function setChips(items) {
    const sig = JSON.stringify(items.map((item) => [item.id, item.icon, item.label, item.badge || "", !!item.on, !!item.disabled]));
    if (sig === chipSig) return;
    chipSig = sig;
    chips.replaceChildren(...items.map((item) => el(`button.vt-chip${item.on ? ".on" : ""}`, {
      type: "button", disabled: !!item.disabled, dataset: { id: item.id, test: `vt-chip-${item.id}` }, "aria-label": item.name || item.label,
      "aria-pressed": item.on == null ? null : String(!!item.on),
      html: `${icon(item.icon)}<span>${escapeHtml(item.label)}</span>${item.badge ? `<em>${escapeHtml(String(item.badge))}</em>` : ""}`,
    })));
    root.dataset.chips = String(items.length);
  }

  /**
   * 十字キーと丸ボタン。dirs: 押せる向き（["up","down"] など）。marks: { up: ["wide","全体"] } 役割の絵記号と読み上げ名。
   * a: { face: "ok"|"go"|"next"|"rest"|"close", label, disabled, hot }。a が null なら丸ボタンを押せない形（薄く）にする（隠さない）。
   */
  function setPad({ dirs = [], marks = {}, a = null } = {}) {
    const sig = JSON.stringify([dirs, marks, a]);
    if (sig === padSig) return;
    padSig = sig;
    dpad.classList.toggle("idle", !dirs.length);
    for (const [dir, key] of Object.entries(keys)) {
      const live = dirs.includes(dir);
      key.classList.toggle("live", live);
      key.tabIndex = live ? 0 : -1;
      key.setAttribute("aria-hidden", String(!live));
      const mark = marks[dir];
      key.innerHTML = `${TRI}${mark ? icon(mark[0]) : ""}`;
      key.setAttribute("aria-label", mark?.[1] || { up: "上", down: "下", left: "左", right: "右" }[dir]);
    }
    // 丸ボタンは消さない（押せない時は薄く残す）。どの場面でも同じ所に指を置いておけるように（VPN09）
    const face = FACES[a?.face] || FACES.ok;
    buttonA.disabled = !a || !!a.disabled;
    buttonA.classList.toggle("idle", !a);
    buttonA.classList.toggle("hot", !!a?.hot);
    buttonA.setAttribute("aria-label", a?.label || face.label);
    const label = a?.text || face.text;
    buttonA.innerHTML = !a ? ""
      : face.text
      ? `<span class="vt-a-t${[...label].length > 2 ? " small" : ""}">${escapeHtml(label)}</span>`
      : `<span class="vt-a-t"><svg class="vt-glyph" viewBox="0 0 32 32" aria-hidden="true">${face.svg}</svg></span>`;
  }

  /**
   * 上の表示。kind "map": 左に章と日付、右に一列でレベル・体力・お金（試作 VPL16）。kind "place": 場所の名前だけ。"none": 出さない。
   * model: { place, sub, level, xp, stamina, track, health, money }
   */
  function setHud(kind, model = {}) {
    const sig = JSON.stringify([kind, model]);
    if (sig === hudSig) return;
    hudSig = sig;
    root.dataset.hud = kind;
    if (kind === "none" || (!model.place && kind === "place")) { hud.replaceChildren(); return; }
    const where = el("div.vt-where", [el("b", { text: model.place || "" }), model.sub ? el("small", { text: model.sub }) : null]);
    if (kind !== "map") { hud.replaceChildren(where); return; }
    const stats = el("span.vt-pill", { dataset: { test: "vt-stats" } }, [
      model.level ? el("span.vt-lv", { "aria-label": `レベル${model.level}` }, [el("small", { text: "Lv" }), el("b", { text: String(model.level) })]) : null,
      model.level ? el("span.vt-bar.xp", { style: { "--v": `${Math.round((model.xp ?? 0) * 100)}%` } }, [el("i")]) : null,
      model.hasStamina ? el("i.vt-sep") : null,
      model.hasStamina ? el("span", { html: icon("heart"), class: "vt-heart" }) : null,
      model.hasStamina ? el("span.vt-bar.st", {
        style: { "--v": `${Math.round(model.stamina ?? 0)}%`, "--track": String(model.track ?? 1) }, dataset: { health: model.health || "" },
        role: "img", "aria-label": `体力 ${Math.round(model.stamina ?? 0)}%`,
      }, [el("i")]) : null,
      model.money ? el("i.vt-sep") : null,
      model.money ? el("span", { html: icon("coin"), class: "vt-coin" }) : null,
      model.money ? el("b.vt-money", { text: model.money }) : null,
    ]);
    hud.replaceChildren(where, el("div.vt-stats", [stats]));
  }

  /** 上に重ねる知らせ（トースト・報酬の札）。 */
  function setNotices(lines) {
    const list = lines.filter(Boolean).slice(-3);
    const sig = list.join("\n");
    if (sig === noticeSig) return;
    noticeSig = sig;
    notices.replaceChildren(...list.map((text) => el("div.vt-notice", { text })));
  }

  /** 場面の色（名前の線・押せる所の光）。 */
  function setAccent(color) {
    if (root.style.getPropertyValue("--acc") !== color) root.style.setProperty("--acc", color || "#c3b0ff");
  }

  /** 場面の切り替えで、前の場面が残した物を片付ける。 */
  function reset() {
    picture.replaceChildren();
    telop.replaceChildren();
    over.replaceChildren();
    over.hidden = true;
    delete picture.dataset.kind;
    chipSig = padSig = hudSig = "";
    setChips([]);
    setPad({});
    setHud("none");
  }

  return {
    root, picture, telop, over, hud, ctrl, chips, dpad, buttonA,
    setAmbient, setChips, setPad, setHud, setNotices, setAccent, reset,
    mount() { document.body.append(root); },
    unmount() { root.remove(); },
  };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** 本編の画面の要素へタップを中継する（pointerdown → pointerup → click）。 */
export function relayTap(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
  const pointer = (type) => (typeof PointerEvent === "function"
    ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: "touch", isPrimary: true }) : new MouseEvent(type, init));
  target.dispatchEvent(pointer("pointerdown"));
  target.dispatchEvent(pointer("pointerup"));
  target.dispatchEvent(new MouseEvent("click", init));
}

// 長押しの中継に使う指の番号（本物の指・マウスの番号とぶつからない数）
const HOLD_POINTER = 0x7654;
/**
 * 本編の要素へ長押しを中継する（押した時に pointerdown を送り、返す関数を呼ぶと pointerup を送る。click は送らない）。
 * 本編のボタンは押された指を自分へ捕まえる（setPointerCapture）ことがあるが、外枠の指は外枠のボタンが捕まえているので、
 * 送る間だけ捕まえる口を空にする（本物の指が見えない本編のボタンへ移ると、指の動きで「ボタンの外へ出た」と判断されて止まる）。
 */
export function relayPress(target) {
  if (!target) return () => {};
  const send = (type) => {
    const rect = target.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: type === "pointerdown" ? 1 : 0 };
    const event = typeof PointerEvent === "function"
      ? new PointerEvent(type, { ...init, pointerId: HOLD_POINTER, pointerType: "touch", isPrimary: true }) : new MouseEvent(type, init);
    const own = Object.prototype.hasOwnProperty.call(target, "setPointerCapture");
    if (!own) target.setPointerCapture = () => {};
    try { target.dispatchEvent(event); } finally { if (!own) delete target.setPointerCapture; }
  };
  send("pointerdown");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    send("pointerup");
  };
}

/** 本編の背景の層（#bg の .bg-img）のうち、いちばん上に見えているもの。 */
export function liveBackground() {
  const layers = [...document.querySelectorAll("#bg > .bg-img")].filter((node) => (parseFloat(getComputedStyle(node).opacity) || 0) > 0.01);
  return layers.at(-1) || null;
}

/** 背景の層を、縦の絵の場所へ写す（絵を覆う大きさに置き直す。店の台を重ねた SVG もそのまま写す）。 */
export function mirrorBackground(host, { focusX = 50, focusY = 40 } = {}) {
  const node = liveBackground();
  const cs = node ? getComputedStyle(node) : null;
  const url = cs ? cssUrl(cs.backgroundImage) : "";
  const art = node?.querySelector(":scope > svg.scene-art");
  const black = !node || node.classList.contains("black");
  const sig = `${url}|${art ? art.outerHTML.length : 0}|${cs?.filter || ""}|${black}|${focusX},${focusY}`;
  if (host.dataset.sig === sig) return url;
  host.dataset.sig = sig;
  const layer = el("div.vt-bgimg");
  if (url) {
    layer.style.backgroundImage = `url("${url}")`;
    layer.style.backgroundPosition = `${focusX}% ${focusY}%`;
  }
  if (art) {
    const copy = art.cloneNode(true);
    copy.setAttribute("preserveAspectRatio", `xMidYMid slice`);
    copy.removeAttribute("width"); copy.removeAttribute("height");
    layer.append(copy);
  }
  if (cs?.filter && cs.filter !== "none") layer.style.filter = cs.filter;
  if (black) layer.classList.add("black");
  host.replaceChildren(layer);
  return url;
}

// 会話・行動選びの上の表示に出す場所の名前（試作 VPL12: 会話は場所の名前だけ）。背景の絵の名前から決める（第1章の場所）。
const PLACES = [
  [/bg_tonari/, "tonari"], [/peppermint/, "PEPPERMINT"], [/kemurikusa/, "KEMURIKUSA"], [/(^|\/)eden|bg_eden_shop/, "EDEN"],
  [/bg_shop|fookah_showroom/, "Dr.fookah"], [/bg_cafe/, "喫茶こはく"], [/bg_kannon/, "観音堂"], [/bg_choizap/, "CHOI-ZAP"],
  [/bg_c_station/, "C.STATION"], [/bg_home/, "家"], [/bg_tournament_stage/, "大会の会場"], [/bg_street|bg_toosu_park/, "橙須"],
  [/bg_rojiura_cinema/, "路地裏シネマ"], [/bg_axe_lane/, "斧投げ"], [/bg_smoke_lab/, "Dr.fookah 2階"],
];
export function placeOf(url) {
  const name = String(url || "").split("/").pop() || "";
  return PLACES.find(([pattern]) => pattern.test(name) || pattern.test(url))?.[1] || "";
}

export const cssUrl = (value) => {
  const m = /url\((['"]?)(.*?)\1\)/.exec(value || "");
  return m ? new URL(m[2], document.baseURI).href : "";
};

export const textOf = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";
export const shown = (node) => !!node && node.getClientRects().length > 0;
