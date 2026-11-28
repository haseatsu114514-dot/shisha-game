// 縦画面「煙の舞台」: 会話と返事。本編の会話（#vn）を読み、上の絵に背景と立ち絵、下にテロップと返事の札を出す。
// 送る・選ぶは本編の会話へ中継する（進行・判定・報酬・既読・LOG は本編のまま）。
// 本文は本編の会話エンジンが、縦のテロップと同じ字数の幅で2行ずつにページを分ける（css/look-vertical.css が、縦画面の間だけ
// 本編の .vn-text をテロップと同じ比の幅・字の大きさにする）。ここでは本編が今出しているページをそのまま写す。
// 立ち位置: 1人は中央で少し寄り（身長差は半分だけ）、2人は左右（24%・76%）で身長差そのまま、話す側が手前で明るい。
import { el } from "../../core/util.js";
import { DB, portraitInfo } from "../../core/data.js";
import { icon, mirrorBackground, textOf, cssUrl, placeOf } from "./frame.js";
import { portraitStillUrl } from "./stills.js";
import { FRAMES } from "../../vn/conversation-cutin.js";

const DEFAULT_ACC = "#c3b0ff";
/** 人物の色（登場カットインの色を少し明るくした物）。会話の名前の線・送りの印・返事の光に使う。 */
export function accentOf(id) {
  const color = DB.manifest?.introArt?.[id]?.color || DB.characters?.[id]?.intro_cutin?.color;
  return color ? `color-mix(in srgb, ${color} 70%, #fff)` : DEFAULT_ACC;
}

/** 本編の会話へ「送る」を中継する。本編は #vn の pointerup で進む（vn/engine.js の buildDom）。 */
export function advanceVn() {
  const box = document.querySelector("#vn.active .vn-box");
  if (!box) return;
  const init = { bubbles: true, cancelable: true, view: window };
  box.dispatchEvent(typeof PointerEvent === "function"
    ? new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "touch", isPrimary: true })
    : new MouseEvent("pointerup", init));
}

const liveChoices = () => [...document.querySelectorAll("#vn .vn-choices.show > .vn-choice")];
const usable = (button) => button && button.getAttribute("aria-disabled") !== "true" && !button.disabled;

export function createTalkScene(frame) {
  const bg = el("div.vt-bg");
  const actors = el("div.vt-actors");
  const cg = el("div.vt-cg", { hidden: true });
  // 会話カットイン（本編の vn/conversation-cutin.js が #vn の中に出す帯）を、縦の絵の場所へ写す層（VPT13）
  const cutin = el("div.vt-cutin", { "aria-hidden": "true", dataset: { test: "vt-cutin" } });
  let cutinSig = "";
  const name = el("div.vt-name", { dataset: { test: "vt-name" } });
  const text = el("p.vt-text", { dataset: { test: "vt-text" } });
  const inner = el("p.vt-inner", { hidden: true });
  const next = el("i.vt-next", { hidden: true, "aria-hidden": "true" });
  const glass = el("div.vt-glass", [text, inner, next]);
  const choices = el("div.vt-choices", { hidden: true, dataset: { test: "vt-choices" } });
  let pick = 0, choiceSig = "", nameSig = "", castSig = "", acc = DEFAULT_ACC;

  choices.addEventListener("click", (event) => {
    const button = event.target.closest(".vt-choice");
    if (!button) return;
    event.stopPropagation();
    const index = Number(button.dataset.index);
    pick = index;
    const live = liveChoices()[index];
    if (usable(live)) live.click();
    else renderPick();
  });

  function renderPick() {
    for (const button of choices.children) button.setAttribute("aria-current", String(Number(button.dataset.index) === pick));
  }

  /** 立ち絵: 本編の立ち絵（同じ絵・同じ表情）を、縦の絵の場所の大きさで置き直す。 */
  function layoutActors(force = false) {
    const imgs = [...document.querySelectorAll("#vn .vn-portraits img.portrait")]
      .filter((img) => img.complete && img.naturalWidth && (parseFloat(getComputedStyle(img).opacity) || 0) > 0.02)
      .sort((a, b) => Number(a.dataset.slot || 0) - Number(b.dataset.slot || 0));
    const w = actors.clientWidth, h = actors.clientHeight;
    const speaking = imgs.find((img) => img.classList.contains("active"))?.dataset.speaker || null;
    const sig = JSON.stringify([w, h, speaking, imgs.map((img) => [img.dataset.speaker, img.currentSrc || img.src])]);
    if (!force && sig === castSig) return speaking;
    castSig = sig;
    if (!w || !h) return speaking;
    const pair = imgs.length >= 2;
    const body = h * (pair ? 1.08 : 1.3);     // 身長比 1.0 の人の「頭の先〜足元」の長さ
    const feet = h * (pair ? 1.28 : 1.46);    // 足元の高さ（絵の下にはみ出す）
    const safeTop = h * (pair ? 0.13 : 0.07); // 頭がこれより上へ行かない
    const keep = new Set();
    imgs.forEach((source, index) => {
      const id = source.dataset.speaker;
      keep.add(id);
      const info = portraitInfo(id, source.dataset.face || "normal") || {};
      const c = { h: info.h || 0.9, b: info.b ?? 0.05, ax: info.ax ?? 0.5, scale: info.scale || 1 };
      const aspect = source.naturalWidth / source.naturalHeight || 896 / 1200;
      const scale = pair ? c.scale : 1 + (c.scale - 1) * 0.5;
      const content = body * scale, imgH = content / c.h, imgW = imgH * aspect;
      const head = Math.max(safeTop, feet - content);
      const top = head - (1 - c.b - c.h) * imgH;
      const slot = pair ? (index === 0 ? 0.24 : 0.76) : 0.5;
      let img = actors.querySelector(`img[data-id="${id}"]`);
      const src = source.currentSrc || source.src;
      if (!img) {
        img = el("img.vt-actor.enter", { alt: "", draggable: "false", dataset: { id } });
        img.src = src;
        actors.append(img);
        requestAnimationFrame(() => requestAnimationFrame(() => img.classList.remove("enter")));
      } else if (img.getAttribute("src") !== src) {
        img.src = src;
        img.classList.remove("hop"); void img.offsetWidth; img.classList.add("hop");
      }
      if (source.style.transform.includes("scaleX(-1)") || /matrix\(-/.test(getComputedStyle(source).transform)) img.classList.add("flip");
      else img.classList.remove("flip");
      Object.assign(img.style, { height: `${imgH}px`, left: `${w * slot - imgW * c.ax}px`, top: `${top}px` });
      const active = id === speaking;
      img.classList.toggle("active", active);
      img.classList.toggle("back", pair && speaking !== null && !active);
      img.classList.toggle("hush", speaking === null);
    });
    for (const img of [...actors.children]) if (!keep.has(img.dataset.id)) img.remove();
    return speaking;
  }

  /** 会話の一枚絵。縦に作り直した絵（stills.js）があればそれを幅いっぱいに（VPT12）、無ければ横長の絵を縦の絵の場所に収め、余白はぼかした同じ絵で埋める。 */
  function syncCg() {
    const node = document.querySelector("#vn .vn-cg");
    const cs = node ? getComputedStyle(node) : null;
    const landscape = cs ? cssUrl(cs.backgroundImage) : "";
    const portrait = portraitStillUrl(node?.dataset.portraitCg || node?.dataset.cg);
    const portraitOnly = !!(node?.dataset.portraitCg && portrait);
    const opacity = cs ? (portraitOnly ? 1 : parseFloat(cs.opacity)) * parseFloat(getComputedStyle(node.parentElement).opacity) : 0;
    const on = !!(landscape || portraitOnly) && opacity > 0.05;
    const url = portrait || landscape;
    cg.hidden = !on;
    actors.hidden = on;
    if (on && cg.dataset.url !== url) {
      cg.dataset.url = url;
      cg.classList.toggle("tall", !!portrait); // "portrait" は本編の立ち絵のクラス名なので使わない
      cg.replaceChildren(el("i.vt-cg-fill", { style: { backgroundImage: `url("${url}")` } }), el("i.vt-cg-art", { style: { backgroundImage: `url("${url}")` } }));
    }
    if (on) cg.style.opacity = String(Math.min(1, opacity));
  }

  /**
   * 会話カットイン（VPT13。オーナー「縦画面でも会話中にカットインとかたまに入る演出復活させたい」）。
   * 本編の帯（舞台 1280×720 の座標）をそのまま写し、縦の絵の場所の大きさに縮めて置く。出し方・消え方の動きは本編の CSS（css/vn/conversation-cutin.css）のまま。
   * 寄りの帯は左端から、絵の場所の幅の 68% で、下端（テロップのすぐ上）に。大会の目元の帯は幅いっぱいで、絵の場所の真ん中より少し上に。
   */
  function syncCutin() {
    const layer = document.querySelector("#vn .vn-cutin-layer");
    const parts = layer ? [...layer.children] : [];
    const band = parts.find((n) => n.classList.contains("vn-cutin"));
    const sig = parts.map((n) => `${n.className}|${n.dataset.cue || ""}|${n.dataset.art || ""}|${n.dataset.leave || ""}`).join("\n");
    if (sig === cutinSig) return;
    cutinSig = sig;
    if (!band) { cutin.replaceChildren(); cutin.hidden = true; delete cutin.dataset.frame; return; }
    const f = FRAMES[band.dataset.frame] || FRAMES.band;
    const W = frame.picture.clientWidth, H = frame.picture.clientHeight;
    const wide = band.dataset.frame === "eyes";
    // 目元の帯は、幅に合わせると縦画面では細すぎる（高さ 162 → 50px ほど）ので、高さを絵の場所の 3 割にして、顔を真ん中に左右を切る
    // 寄りの帯は絵の場所の幅の 68%（2026-11-28 オーナー「少し大きすぎかも　もう一回り小さく」で 80% から縮めた）
    const s = wide ? (H * 0.3) / f.h : (W * 0.68) / f.w;
    const top = wide ? H * 0.38 - (f.h * s) / 2 : H * 0.78 - f.h * s;
    const left = wide ? W / 2 - f.face[0] * s : 0;
    const holder = el("div.vt-cutin-band", { style: { width: `${f.w}px`, height: `${f.h}px`, transform: `translate(${left}px, ${top}px) scale(${s})` } });
    holder.append(band.cloneNode(true));
    const dim = parts.find((n) => n.classList.contains("vn-cutin-dim"));
    cutin.replaceChildren(...(dim ? [el(`i.vt-cutin-dim${dim.classList.contains("leave") ? ".leave" : ""}`)] : []), holder);
    cutin.dataset.frame = band.dataset.frame;
    cutin.hidden = false;
  }

  function syncText(box = document.querySelector("#vn .vn-box")) {
    if (!box) return;
    const source = box.querySelector(".vn-text"), voice = box.querySelector(".vn-inner");
    const visible = !!voice && !voice.hidden && !!voice.textContent;
    inner.hidden = !visible;
    for (const [from, to] of [[source, text], [visible ? voice : null, inner]]) {
      if (from?.childNodes.length === 1 && from.firstChild.nodeType === Node.TEXT_NODE
        && to.childNodes.length === 1 && to.firstChild.nodeType === Node.TEXT_NODE) {
        if (to.firstChild.data !== from.firstChild.data) to.firstChild.data = from.firstChild.data;
      } else if (to.innerHTML !== (from?.innerHTML || "")) {
        to.replaceChildren(...Array.from(from?.childNodes || [], node => node.cloneNode(true)));
      }
    }
  }

  function sync() {
    const box = document.querySelector("#vn .vn-box");
    if (!box) return;
    // 上の絵: 背景と立ち絵（一枚絵の間は一枚絵だけ）
    const url = mirrorBackground(bg);
    frame.setAmbient(url);
    syncCg();
    syncCutin();
    const speaking = layoutActors();

    // 名前と色
    const srcName = box.querySelector(".vn-name");
    const nameText = srcName?.classList.contains("show") ? textOf(srcName) : "";
    const kind = box.classList.contains("reward") ? "reward" : box.classList.contains("thought") ? "thought" : box.classList.contains("narration") ? "narration" : "say";
    if (speaking) acc = accentOf(speaking);
    frame.setAccent(acc);
    const nextName = `${kind}|${nameText}`;
    if (nextName !== nameSig) {
      nameSig = nextName;
      name.className = `vt-name ${kind}`;
      name.innerHTML = kind === "thought" ? `${icon("think")}<b></b>` : "<b></b>";
      name.querySelector("b").textContent = nameText;
      name.hidden = !nameText && kind !== "thought";
    }

    syncText(box);
    glass.dataset.kind = kind;
    next.hidden = !box.querySelector(".vn-next")?.classList.contains("show");

    // 返事
    const list = liveChoices();
    const nextChoices = list.map((button) => `${button.getAttribute("aria-disabled")}|${button.className}|${button.innerHTML}`).join("\n");
    if (nextChoices !== choiceSig) {
      choiceSig = nextChoices;
      pick = Math.max(0, list.findIndex(usable));
      choices.replaceChildren(...list.map((source, index) => {
        const reason = source.querySelector(".vn-choice-reason");
        const main = [...source.childNodes].filter((node) => node !== reason).map((node) => node.textContent).join("").replace(/\s+/g, " ").trim();
        const button = el("button.vt-choice", {
          type: "button", style: { "--i": String(index) },
          dataset: { index: String(index), test: `vt-choice-${index}`, hint: source.matches(".fortune-hint") ? "fortune" : source.matches(".growth-hint") ? "growth" : "" },
          "aria-disabled": usable(source) ? null : "true",
        }, [el("i"), el("span", [el("b", { text: main }), reason ? el("small", { text: textOf(reason) }) : null])]);
        return button;
      }));
      renderPick();
    }
    const choosing = list.length > 0;
    choices.hidden = !choosing;
    glass.classList.toggle("ask", choosing);
    frame.root.dataset.choosing = String(choosing);

    // 補助ボタン: 本編の操作（AUTO・SKIP・LOG・用語・設定）。並びは試作と同じ（LOG・AUTO・SKIP・用語・設定）
    const control = (test) => document.querySelector(`#vn .vn-controls button.vn-ctl[data-test="${test}"]`);
    const pressed = (test) => control(test)?.getAttribute("aria-pressed") === "true";
    frame.setChips([
      { id: "vn-log", icon: "log", label: "LOG" },
      { id: "vn-auto", icon: "auto", label: "AUTO", on: pressed("vn-auto") },
      { id: "vn-skip", icon: "skip", label: "SKIP", on: pressed("vn-skip") },
      { id: "vn-glossary", icon: "book", label: "用語" },
      { id: "vn-config", icon: "gear", label: "設定" },
    ].filter((item) => control(item.id)));
    frame.setPad(choosing
      ? { dirs: list.length > 1 ? ["up", "down"] : [], a: { face: "ok", disabled: !usable(list[pick]) } }
      : { dirs: [], a: { face: "next" } });

    // 中継の光・帯は liveFrame の実物を使う。連続する会話での更新・撤去は本編が行う。
    const vn = box.parentElement;
    const back = vn.querySelector(":scope > .ts-live-back");
    const front = vn.querySelector(":scope > .ts-live-front");
    if (back) actors.before(back);
    if (front) cutin.before(front);
    frame.picture.classList.toggle("vt-live-hidden", vn.matches(".flashback, .sepia") || !cg.hidden);
    // 上の表示: 場所の名前だけ（VPL12）
    frame.setHud("place", { place: placeOf(url) });
  }

  function move(by) {
    const list = liveChoices();
    if (!list.length) return;
    pick = (pick + by + list.length) % list.length;
    renderPick();
    sync();
  }

  return {
    name: "vn",
    enter() {
      frame.picture.dataset.kind = "stage";
      frame.picture.append(bg, actors, cg, cutin);
      cutin.replaceChildren(); cutin.hidden = true; cutinSig = "";
      frame.telop.append(name, glass, choices);
      nameSig = castSig = choiceSig = "\u0000";
      actors.replaceChildren();
      bg.dataset.sig = "";
    },
    leave() {
      const vn = document.getElementById("vn");
      const back = frame.picture.querySelector(".ts-live-back");
      const front = frame.picture.querySelector(".ts-live-front");
      if (back) vn.prepend(back);
      if (front) vn.append(front);
      frame.picture.classList.remove("vt-live-hidden");
      actors.replaceChildren();
      cg.hidden = true; delete cg.dataset.url;
      cutin.replaceChildren(); cutin.hidden = true; cutinSig = "";
      frame.root.dataset.choosing = "false";
    },
    sync, syncText,
    relayout() { layoutActors(true); cutinSig = ""; syncCutin(); },
    dir(dir) { if (dir === "up") move(-1); else if (dir === "down") move(1); },
    a() {
      const list = liveChoices();
      if (list.length) { if (usable(list[pick])) list[pick].click(); return; }
      advanceVn();
    },
    chip(id) { document.querySelector(`#vn .vn-controls button.vn-ctl[data-test="${id}"]`)?.click(); },
    tap() { if (!liveChoices().length) advanceVn(); },
  };
}
