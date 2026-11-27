// 縦画面「煙の舞台」: 日常の地図。本編の地図（daily/map.js の .map と .spot-pin）を読み、縦の絵に街を大きく映して、
// 選んだ店が画面の真ん中へ来るように動かす（試作 VPL06・VPL10）。左右キー・点・札を払う＝地図の左から右の順に隣の店へ、
// 上＝全体を見る／寄る、下＝行き先の一覧。決定＝その店へ行く。選ぶ・行くは本編のピンへの click として中継する
// （本編は1回目で選び、選んでいるピンをもう一度押すと行く）。行けるかどうか・料金・体力の判定は本編のまま。
import { el } from "../../core/util.js";
import { state } from "../../core/state.js";
import { gaugeInfo, growthEnabled, growthView } from "../../core/growth.js";
import { icon, escapeHtml, textOf, shown, liveBackground, cssUrl } from "./frame.js";
import { readHud } from "../retro/hud.js";

const ACC = "#c3b0ff";
let spotsModule = null;
import("../../daily/spots.js").then((module) => { spotsModule = module; }).catch(() => {});
const spotDef = (id) => { try { return spotsModule?.spotById(id) || null; } catch { return null; } };

const liveMap = () => document.querySelector("#screen > .map:not(.done)");
const livePins = () => [...(liveMap()?.querySelectorAll(".map-pins > .spot-pin") || [])].filter((pin) => pin.style.visibility !== "hidden");
const livePin = (id) => livePins().find((pin) => pin.dataset.spot === id);

/** 本編のステージの拡縮（1280×720 を画面に合わせる倍率）。見えないまま動いているので、レイアウトの大きさから測れる。 */
function stageScale() {
  const stage = document.getElementById("stage");
  const rect = stage?.getBoundingClientRect();
  return rect?.width && stage.offsetWidth ? rect.width / stage.offsetWidth : 1;
}

/**
 * ピンの看板の絵（VPN10: 元の横画面の地図と同じく、店のロゴ・施設の絵を地図の中に小さく出す）。
 * 本編のピンの絵（core/store-logos.js の店のロゴ・daily/facility-icons.js の施設の絵）を、ステージ上の見た目の大きさと一緒に読む。
 */
function readArt(pin, k) {
  const node = pin.querySelector(".ico > .store-logo, .ico > .facility-icon");
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    node, kind: node.classList.contains("store-logo") ? "logo" : "facility",
    key: node.dataset.storeLogo || node.dataset.facility || "",
    dark: node.classList.contains("on-dark"),
    w: rect.width / k, h: rect.height / k, // ステージ（1280 幅）の上での大きさ
  };
}

function readPins() {
  const k = stageScale();
  return livePins().map((pin) => {
    const name = textOf(pin.querySelector(".sub-label"));
    const def = spotDef(pin.dataset.spot);
    const badge = pin.querySelector(".evt-badge");
    return {
      art: readArt(pin, k),
      lesson: textOf(pin.querySelector(".lesson-badge")),
      id: pin.dataset.spot || "",
      name,
      status: textOf(pin.querySelector(".pin-status")),
      badge: badge ? textOf(badge) : "",
      hidane: !!badge?.classList.contains("hidane-badge"),
      off: pin.classList.contains("off") || pin.classList.contains("guided-off"),
      closed: pin.classList.contains("closed"),
      locked: pin.classList.contains("pin-locked"),
      guide: pin.classList.contains("guide"),
      sel: pin.classList.contains("sel"),
      people: [...pin.querySelectorAll(".pin-people .pin-person")].map((person) => ({
        src: person.localName === "img" ? person.currentSrc || person.src : "", name: person.getAttribute("alt") || person.getAttribute("aria-label") || "",
      })),
      glyph: def?.glyph || [...name][0] || "・",
      area: def?.area || "",
      cost: def?.cost && !pin.classList.contains("pin-locked") ? def.cost : 0,
      x: parseFloat(pin.style.left) || 0,
      y: parseFloat(pin.style.top) || 0,
      speech: pin.getAttribute("aria-label") || name,
    };
  });
}

const yen = (n) => `${Number(n).toLocaleString("ja-JP")}`;

export function createMapScene(frame) {
  const pan = el("div.vt-map-pan");
  const mapImg = el("img.vt-map-img", { alt: "", draggable: "false" });
  const pins = el("div.vt-map-pins");
  pan.append(mapImg, pins);
  const view = el("div.vt-map", { dataset: { test: "vt-map" } }, [pan, el("i.vt-rain", { "aria-hidden": "true" })]);
  const guide = el("div.vt-guide", { hidden: true, dataset: { test: "vt-map-guide" } });
  const name = el("div.vt-name.place", { dataset: { test: "vt-map-name" } });
  const card = el("div.vt-glass.vt-dest", { dataset: { test: "vt-dest" } });
  const actions = el("div.vt-choices.vt-map-actions", { hidden: true });
  const sheet = el("div.vt-sheet", { hidden: true, dataset: { test: "vt-map-list" } });

  let list = [], sel = null, overview = false, listOpen = false, cam = null, viewBox = null;
  let pinSig = "", cardSig = "", sheetSig = "", actionSig = "", lastLiveSel = null;

  // 左から右の順（右を押すと画面も右へ動く）
  const order = () => [...list].sort((a, b) => a.x - b.x || a.y - b.y);
  const current = () => list.find((pin) => pin.id === sel) || null;

  /** 本編のピンを「選んだ」状態にする（本編の行き先の札・押した音も本編のまま）。 */
  function selectLive(id) {
    const pin = livePin(id);
    if (pin && !pin.classList.contains("sel")) pin.click();
  }

  function select(id, { keepView = false } = {}) {
    if (!id) return;
    sel = id;
    if (overview && !keepView) overview = false;
    cam = null;
    selectLive(id);
    render();
    camera(true);
  }

  function step(by) {
    const ordered = order();
    if (!ordered.length) return;
    const at = ordered.findIndex((pin) => pin.id === sel);
    const next = ordered[(at + by + ordered.length) % ordered.length];
    select(next.id, { keepView: overview });
  }

  /** 選んだ店が見える位置へ地図を動かす（寄り）。全体表示では地図の幅を画面に合わせる。 */
  function camera(animate = true) {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    const mh = h * 1.12, mw = mh * 16 / 9;
    pan.style.width = `${mw}px`; pan.style.height = `${mh}px`;
    const spot = current();
    let x, y, scale = 1;
    if (overview) {
      scale = w / mw; x = 0; y = h * 0.47 - mh * scale / 2;
    } else if (cam) ({ x, y } = cam);
    else {
      x = w / 2 - mw * (spot?.x ?? 50) / 100;
      y = h * 0.4 - mh * (spot?.y ?? 45) / 100;
    }
    if (!overview) { x = Math.min(0, Math.max(w - mw, x)); y = Math.min(0, Math.max(h * 0.86 - mh, y)); }
    const resized = !viewBox || viewBox.mw !== mw;
    viewBox = { x, y, scale, w, h, mw, mh };
    if (resized) renderPins();
    pan.classList.toggle("no-anim", !animate);
    pan.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    pan.style.setProperty("--inv", String(1 / scale));
    if (!animate) { void pan.offsetWidth; pan.classList.remove("no-anim"); }
    view.classList.toggle("overview", overview);
    markUnder();
  }

  /** 上の表示の下に入ったピンは薄くする（重なって読みにくくならないように）。 */
  function markUnder() {
    if (!viewBox) return;
    for (const node of pins.children) {
      const pin = list.find((item) => item.id === node.dataset.spot);
      if (!pin) continue;
      const py = viewBox.y + viewBox.mh * viewBox.scale * pin.y / 100;
      node.classList.toggle("under", pin.id !== sel && py < viewBox.w * 0.2);
    }
  }

  const avatar = (pin) => pin.people[0]?.src
    ? `<img src="${escapeHtml(pin.people[0].src)}" alt="">`
    : `<i>${escapeHtml(pin.glyph)}</i>`;

  /**
   * 看板の絵: 本編のピンの絵をそのまま写し、地図の縮尺（地図の絵の幅 / 1280）に合わせて縮める。絵の無い行き先は一文字の丸。
   * 店のロゴの札は、元の地図と同じく全店同じ大きさ（幅 90・高さ 58。ロゴは 82×46 の窓に収めて真ん中に置く。VPN12）。
   */
  function signOf(pin, mapK) {
    if (!pin.art) return el("span.vt-pin-dot", [el("i", { text: pin.glyph })]);
    const w = pin.art.w * mapK, h = pin.art.h * mapK;
    const plate = pin.art.kind === "logo" ? { width: `${(90 * mapK).toFixed(1)}px`, height: `${(58 * mapK).toFixed(1)}px` } : null;
    const copy = pin.art.node.cloneNode(true);
    const layoutW = pin.art.node.offsetWidth || pin.art.w, layoutH = pin.art.node.offsetHeight || pin.art.h;
    copy.removeAttribute("role");
    Object.assign(copy.style, { position: "absolute", left: "0", top: "0", transformOrigin: "0 0", transform: `scale(${(w / layoutW).toFixed(4)}, ${(h / layoutH).toFixed(4)})` });
    return el(`span.vt-pin-sign.${pin.art.kind}${pin.art.dark ? ".dark" : ""}`, { "aria-hidden": "true", style: plate || {} }, [
      el("span.vt-pin-art", { style: { width: `${w.toFixed(1)}px`, height: `${h.toFixed(1)}px` } }, [copy]),
    ]);
  }

  function renderPins() {
    const mapK = (viewBox?.mw || 0) / 1280 || 0.7;
    const sig = JSON.stringify([mapK.toFixed(3), list.map((pin) => [pin.id, pin.x, pin.y, pin.badge, pin.off, pin.closed, pin.people.map((p) => p.src), pin.id === sel, pin.guide, pin.art?.key, pin.art?.w, pin.lesson])]);
    if (sig === pinSig) return;
    pinSig = sig;
    pins.replaceChildren(...list.map((pin) => el(`div.vt-pin${pin.off ? ".off" : ""}${pin.closed ? ".closed" : ""}${pin.guide ? ".guide" : ""}${pin.art ? ".has-art" : ""}`, {
      style: { left: `${pin.x}%`, top: `${pin.y}%` }, dataset: { spot: pin.id }, "aria-current": String(pin.id === sel),
    }, [
      el("i.vt-pin-ring"),
      el("span.vt-pin-body", [
        signOf(pin, mapK),
        // 居る人の顔は、看板の左上に小さく（元の地図の顔の列と同じ役割）
        pin.art && pin.people.length ? el("span.vt-pin-faces", pin.people.slice(0, 2).map((person) => person.src ? el("img", { src: person.src, alt: "" }) : el("i", { text: "?" }))) : null,
        pin.closed ? el("em.vt-pin-badge.off", { text: "休" }) : pin.badge ? el(`em.vt-pin-badge${pin.hidane ? ".hidane" : ""}`, { text: pin.badge }) : null,
        pin.lesson ? el("em.vt-pin-lesson", { text: pin.lesson }) : null,
      ]),
      el("button.vt-pin-hit", { type: "button", "aria-label": pin.speech, dataset: { test: `vt-pin-${pin.id}` },
        onclick: (event) => { event.stopPropagation(); if (pin.id === sel && !overview) go(); else select(pin.id); } }),
    ])));
    markUnder();
  }

  function renderCard() {
    const pin = current();
    const ordered = order();
    const sig = JSON.stringify([pin, ordered.map((item) => [item.id, !!item.badge])]);
    if (sig === cardSig) return;
    cardSig = sig;
    name.innerHTML = `<b>${escapeHtml(pin?.name || "")}</b>`;
    if (!pin) { card.replaceChildren(); return; }
    const who = pin.people.length ? pin.people.map((person) => person.name).filter(Boolean).join("・") : pin.area || pin.name;
    const perk = pin.closed || pin.off
      ? el("span.vt-perk.stop", { text: pin.status || "いまは行けない" })
      : pin.cost ? el("span.vt-perk", { html: `${icon("coin")}<b>${yen(pin.cost)}</b>` })
      : pin.status ? el("span.vt-perk", [el("small", { text: pin.status })]) : null;
    card.classList.toggle("closed", pin.closed || pin.off);
    card.replaceChildren(
      el("div.vt-who", { html: `<span class="vt-ava">${avatar(pin)}</span><b></b>` }),
      perk || el("span"),
      el("div.vt-dots", ordered.map((item) => el(`button${item.badge ? ".mark" : ""}`, {
        type: "button", "aria-current": String(item.id === sel), "aria-label": item.name,
        onclick: (event) => { event.stopPropagation(); select(item.id); },
      }))),
    );
    card.querySelector(".vt-who b").textContent = who;
  }

  function renderSheet() {
    sheet.hidden = !listOpen;
    if (!listOpen) return;
    const sig = JSON.stringify([order().map((pin) => [pin.id, pin.name, pin.badge, pin.cost, pin.status, pin.off]), sel]);
    if (sig === sheetSig) return;
    sheetSig = sig;
    sheet.replaceChildren(
      el("header", { html: `${icon("list")}<span>行き先</span>` }, [el("button", { type: "button", text: "閉じる", onclick: (event) => { event.stopPropagation(); listOpen = false; render(); } })]),
      el("div.vt-rows", order().map((pin) => el(`button.vt-row${pin.off || pin.closed ? ".closed" : ""}`, {
        type: "button", "aria-current": String(pin.id === sel), dataset: { test: `vt-row-${pin.id}` },
        onclick: (event) => { event.stopPropagation(); listOpen = false; select(pin.id); },
      }, [
        el("span.vt-ava", { html: avatar(pin) }),
        el("span.vt-row-main", [el("b", { text: pin.name }), el("small", { text: pin.people.map((p) => p.name).join("・") || pin.area })]),
        el("span.vt-row-side", { html: `${pin.badge ? `<em>${escapeHtml(pin.badge)}</em>` : ""}${pin.off || pin.closed ? `<small class="stop">${escapeHtml(pin.status || "×")}</small>` : pin.cost ? `<small>${yen(pin.cost)}</small>` : ""}` }),
      ]))),
    );
    sheet.querySelector('.vt-row[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }

  /** 地図の案内の箱に出たボタン（駅の行き先・配達メモなど）。選んだ店へ「行く」1つだけのボタンは決定に任せる。 */
  const infoButtons = () => [...(liveMap()?.querySelectorAll(".map-info button") || [])].filter(shown);
  const goButton = () => {
    const buttons = infoButtons();
    return buttons.length === 1 && buttons[0].matches(".mi-go") && liveMap()?.querySelector(".map-pins > .spot-pin.sel") ? buttons[0] : null;
  };
  function renderActions() {
    const single = goButton();
    const buttons = infoButtons().filter((button) => button !== single);
    const sig = buttons.map((button) => `${textOf(button)}|${button.disabled}`).join("\n");
    if (sig === actionSig) return;
    actionSig = sig;
    actions.hidden = !buttons.length;
    actions.replaceChildren(...buttons.map((button, index) => el("button.vt-choice", {
      type: "button", disabled: button.disabled, style: { "--i": String(index) },
      onclick: (event) => { event.stopPropagation(); infoButtons().filter((b) => b !== goButton())[index]?.click(); },
    }, [el("i"), el("span", [el("b", { text: textOf(button) })])])));
  }

  function canGo() {
    const pin = current();
    if (!pin || pin.off || pin.locked) return false;
    const info = liveMap()?.querySelector(".map-info");
    const single = goButton();
    return info?.dataset.test === "map-go" || (single ? !single.disabled : true);
  }

  function go() {
    const pin = current();
    if (!pin || !canGo()) return;
    const single = goButton();
    const live = livePin(pin.id);
    if (!live) return;
    if (!live.classList.contains("sel")) { live.click(); }
    // 店へ寄る動き（試作の enterShop）。本編の場面転換が始まると、外枠は覆いの写しへ移る
    if (viewBox) {
      const s = 1.7, { w, h, mw, mh } = viewBox;
      pan.style.transform = `translate(${w / 2 - mw * s * pin.x / 100}px, ${h * 0.4 - mh * s * pin.y / 100}px) scale(${s})`;
    }
    frame.root.classList.add("vt-leaving");
    setTimeout(() => frame.root.classList.remove("vt-leaving"), 900);
    if (single) single.click(); else live.click();
  }

  function render() {
    renderPins();
    renderCard();
    renderSheet();
    renderActions();
    const pin = current();
    const marks = list.filter((item) => item.badge && !item.hidane).length;
    const hud = readHud();
    const lime = shown(document.querySelector("#hud .hud-lime")), menu = shown(document.querySelector("#hud .hud-menu"));
    const reel = liveMap()?.querySelector(".reel-widget .rw-lamp-wrap");
    frame.setChips([
      lime ? { id: "lime", icon: "chat", label: "LIME", badge: hud?.unread || "", name: hud?.unread ? `LIME（未読${hud.unread}件）` : "LIME" } : null,
      menu ? { id: "menu", icon: "menu", label: "MENU", badge: hud?.hidane || "" } : null,
      marks ? { id: "next", icon: "bang", label: "用事", badge: String(marks), name: "用事のある店へ" } : null,
      reel ? { id: "reel", icon: "slot", label: "スロット" } : null,
      { id: "wide", icon: overview ? "near" : "wide", label: overview ? "寄る" : "全体", on: overview, name: overview ? "寄る" : "全体を見る" },
    ].filter(Boolean));
    frame.setPad(listOpen
      ? { dirs: ["up", "down"], a: { face: "ok", label: "選ぶ" } }
      : {
        dirs: ["up", "down", "left", "right"],
        marks: { up: overview ? ["near", "寄る"] : ["wide", "全体を見る"], down: ["list", "一覧"] },
        a: pin ? (canGo() ? { face: "go", label: `${pin.name}へ行く` } : { face: "rest", label: pin.status || "いまは行けない", disabled: true }) : { face: "ok", disabled: true },
      });
  }

  function sync() {
    const map = liveMap();
    if (!map) return;
    list = readPins();
    // 本編で選ばれているピン（本編側で選び直された時も追いかける）
    const liveSel = list.find((pin) => pin.sel)?.id || null;
    if (liveSel && liveSel !== lastLiveSel) { sel = liveSel; cam = null; }
    lastLiveSel = liveSel;
    if (!list.some((pin) => pin.id === sel)) {
      sel = liveSel || list.find((pin) => pin.guide)?.id || list.find((pin) => pin.badge && !pin.off)?.id || order().find((pin) => !pin.off)?.id || list[0]?.id || null;
      if (sel) selectLive(sel);
      cam = null;
    }
    // 地図の絵（本編の背景の層。昼夜で替わる）
    const bg = liveBackground();
    const url = bg ? cssUrl(getComputedStyle(bg).backgroundImage) : "";
    if (url && mapImg.getAttribute("src") !== url) mapImg.src = url;
    frame.setAmbient(url);
    view.classList.toggle("rain", map.dataset.rain === "true");
    // 案内（チュートリアルの一言）
    const guideText = textOf(map.querySelector(".map-guide span")) || textOf(map.querySelector(".map-guide"));
    guide.hidden = !guideText;
    if (guide.textContent !== guideText) guide.textContent = guideText;
    render();
    if (!viewBox || viewBox.w !== view.clientWidth || viewBox.h !== view.clientHeight) camera(false);
    else camera(true);
    // 上の表示: 章・日付・レベル・体力・お金（VPL16）
    const hud = readHud();
    const gauge = growthEnabled() && state ? gaugeInfo(growthView()) : null;
    frame.setHud("map", {
      place: `第${state?.chapter || 1}章`, sub: hud?.day ? `DAY ${hud.day}${hud.night ? "・夜" : ""}` : "",
      level: gauge?.level || 0, xp: gauge?.now ?? 0,
      hasStamina: !!hud?.hasStamina, stamina: hud?.stamina ?? 0, track: hud?.track ?? 1, health: hud?.health || "",
      money: hud?.money ? hud.money : "",
    });
  }

  // 指で地図をずらす（選び直すと選んだ店へ戻る）
  let drag = null;
  view.addEventListener("pointerdown", (event) => {
    if (overview || event.target.closest(".vt-pin-hit") || !viewBox) return;
    drag = { x: event.clientX, y: event.clientY, sx: viewBox.x, sy: viewBox.y, moved: false };
  });
  view.addEventListener("pointermove", (event) => {
    if (!drag || !viewBox) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    cam = { x: drag.sx + dx, y: drag.sy + dy };
    camera(false);
  });
  const endDrag = () => { drag = null; };
  view.addEventListener("pointerup", endDrag);
  view.addEventListener("pointercancel", endDrag);
  // 札を左右に払って前後の店へ
  let swipe = null;
  card.addEventListener("pointerdown", (event) => { swipe = { x: event.clientX, y: event.clientY }; });
  card.addEventListener("pointerup", (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  });

  return {
    name: "map",
    enter() {
      frame.picture.dataset.kind = "map";
      frame.picture.append(view);
      frame.telop.append(guide, actions, name, card);
      frame.over.append(sheet);
      frame.over.hidden = false;
      frame.setAccent(ACC);
      pinSig = cardSig = sheetSig = actionSig = "";
      viewBox = null; cam = null; overview = false; listOpen = false; lastLiveSel = null; sel = null;
    },
    leave() { sheet.hidden = true; listOpen = false; frame.root.classList.remove("vt-leaving"); },
    sync,
    relayout() { camera(false); },
    dir(dir) {
      if (listOpen) {
        const ordered = order();
        const at = ordered.findIndex((pin) => pin.id === sel);
        const next = ordered[(at + (dir === "up" ? -1 : dir === "down" ? 1 : 0) + ordered.length) % ordered.length];
        if (next) { sel = next.id; selectLive(sel); cam = null; render(); camera(true); }
        return;
      }
      if (dir === "left") step(-1);
      else if (dir === "right") step(1);
      else if (dir === "up") { overview = !overview; cam = null; render(); camera(true); }
      else if (dir === "down") { listOpen = true; render(); }
    },
    a() {
      if (listOpen) { listOpen = false; render(); return; }
      if (overview) { overview = false; cam = null; render(); camera(true); return; }
      go();
    },
    chip(id) {
      if (id === "lime") document.querySelector("#hud .hud-lime")?.click();
      else if (id === "menu") document.querySelector("#hud .hud-menu")?.click();
      else if (id === "reel") liveMap()?.querySelector(".reel-widget .rw-lamp-wrap")?.click();
      else if (id === "wide") { overview = !overview; listOpen = false; cam = null; render(); camera(true); }
      else if (id === "next") {
        const marked = order().filter((pin) => pin.badge && !pin.hidane);
        if (!marked.length) return;
        const at = marked.findIndex((pin) => pin.id === sel);
        select(marked[(at + 1) % marked.length].id);
      }
    },
    tap() {},
  };
}
