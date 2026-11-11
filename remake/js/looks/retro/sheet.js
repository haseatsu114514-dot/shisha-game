// シート: 全画面 MENU・LIME・小窓（設定・用語集・セーブ／ロード・規則の紙・確認の問い）・会話の LOG を、外枠の中へ写す。
// 画面ごとに作り込まず、現行の DOM を読んで、ドット調の部品（見出し・文・一覧・ボタン・入力・絵）へ置き換える汎用の写し。
//   - 元の要素と写しの要素を対で覚え（cache）、中身が変わったら同じ写しの要素を使い回して書き直す
//     （押している途中のボタンを作り直さない。スクロールの位置も保つ）
//   - 写しのボタンを押すと元の要素の click()、範囲・チェック・選択は元の入力へ値を入れて input / change を送る
//     （保存・反映は元の処理がそのまま行う。進行・判定・セーブには触れない）
//   - 元の CSS は #stage の中でしか効かないので、写しは look-retro.css の .retro-sheet の規則だけで組む。
//     元のクラスは「s-元の名前」として写しに付ける（画面ごとの見た目の調整に使う）
// 置き方:
//   MENU … 上画面にタブに合った絵（ステータスははじめ、人間関係は選んだ相手の立ち絵。ほかは背景を暗く）、
//          下画面に今のタブの中身、本体のボタンに4つのタブと「閉じる」。
//   LIME・小窓・LOG … 上画面と下画面をつないだ1枚の縦長のシート（見出し・中身（送れる）・下のボタン）。
import { el } from "../../core/util.js";
import { portraitInfo, realName } from "../../core/data.js";
import { readBackgrounds, stageMetrics, STAGE_W } from "./stage-read.js";

const SKIP_TAGS = new Set(["script", "style", "svg", "canvas", "video", "audio", "iframe", "template", "noscript", "rt", "rp", "dialog"]);
// 写さない飾り（新版の MENU の人物の絵・端末の枠・幕・入力中の点々の顔の空き）
const SKIP = ".neo-figure, .phone-notch, .phone-status, .modal-backdrop, .dm-backdrop, .lime-face.gap, .modal-ghost";
const INTERACTIVE = "button, a[href], [role='button'], [role='tab'], [role='radio'], [role='switch'], summary";
// 絵文字（アイコン代わりの記号）は写さない。♥♡★☆♪ は文字として残す
const PICTO = /(?![♡♥★☆♪])[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const clean = (value) => String(value || "").replace(PICTO, "");
const text = (node) => clean(node?.textContent || "").replace(/\s+/g, " ").trim();
const shown = (node) => !!node && node.getClientRects().length > 0;
// 写しに引き継ぐ状態（押している・選んでいる・開いている）
const STATE_ATTRS = ["aria-pressed", "aria-checked", "aria-selected", "aria-expanded", "aria-current"];

/** いま写す物。kind: "menu" | "lime" | "modal" | "log"。 */
function liveSheet() {
  const modal = document.getElementById("modal");
  if (modal?.classList.contains("show")) {
    const menu = modal.querySelector(":scope > .dmenu");
    if (menu) return { kind: "menu", root: menu, viewer: modal.querySelector(":scope > .keepsake-viewer") };
    const phone = modal.querySelector(":scope > .phone-overlay");
    if (phone) return { kind: "lime", root: phone };
    const box = modal.querySelector(":scope > .modal-box");
    if (box) return { kind: "modal", root: box };
  }
  const log = document.querySelector("#vn .vn-log.show");
  if (log) return { kind: "log", root: log };
  return null;
}

/** 写しの部品の種類と並べ方を、元の要素から決める。写さない物は null。 */
function describe(src) {
  if (src.hidden || SKIP_TAGS.has(src.localName) || src.matches(SKIP)) return null;
  const cs = getComputedStyle(src);
  if (cs.display === "none" || cs.visibility === "hidden") return null;
  const tag = src.localName;
  if (src.getAttribute("aria-hidden") === "true") {
    // 飾りは写さない。ただしゲージ（幅で量を見せる帯）は写す
    return src.querySelector("[style*='width']") ? { kind: "gauge" } : null;
  }
  if (tag === "br") return { kind: "br" };
  if (src.style.getPropertyValue("--v")) return { kind: "gauge" };
  if (tag === "img") return { kind: "img" };
  if (tag === "input") return src.type === "range" ? { kind: "range" } : src.type === "checkbox" ? { kind: "check" } : null;
  if (tag === "select") return { kind: "select" };
  if (src.getAttribute("role") === "img") return { kind: "pips" };
  if (src.matches(INTERACTIVE)) return { kind: "btn", flow: flowOf(cs) };
  if (/^h[1-6]$/.test(tag)) return { kind: "h", level: Number(tag[1]) };
  if (cs.display.startsWith("inline") || cs.display === "contents" || cs.display.startsWith("ruby")) {
    return cs.display === "inline-flex" || cs.display === "inline-grid" ? { kind: "blk", flow: flowOf(cs), inline: true } : { kind: "inl" };
  }
  return { kind: "blk", flow: flowOf(cs) };
}
/** 横並び（flex の row・2列以上の grid）か、縦並びか。 */
function flowOf(cs) {
  if (cs.display.includes("flex")) return cs.flexDirection.startsWith("row") ? "row" : "col";
  if (cs.display.includes("grid")) return cs.gridTemplateColumns.split(" ").filter(Boolean).length > 1 ? "row" : "col";
  return "col";
}

/**
 * 写しの部品を作る・書き直す道具。relay: 元の要素へ操作を中継する（押す・値を入れる）。
 * cache: 元の要素 → 写しの要素（同じ元の要素には同じ写しを使い回す）。
 */
function createMirror({ testPrefix = "sheet-", onRelay = () => {} } = {}) {
  let cache = new WeakMap();

  // 中継の後は写し直す（チェックや範囲の値のように、DOM の属性が変わらない変化もあるため）
  const relayClick = (src) => { if (src.isConnected && !src.disabled) src.click(); onRelay(); };
  const relayValue = (src, value) => {
    if (!src.isConnected || src.disabled) return;
    src.value = value;
    src.dispatchEvent(new Event("input", { bubbles: true }));
    src.dispatchEvent(new Event("change", { bubbles: true }));
    onRelay();
  };

  function setChildren(parent, list) {
    const now = parent.childNodes;
    if (now.length === list.length && list.every((node, i) => now[i] === node)) return;
    parent.replaceChildren(...list);
  }
  function setAttr(node, name, value) {
    if (value == null || value === false) { if (node.hasAttribute(name)) node.removeAttribute(name); return; }
    const v = value === true ? "" : String(value);
    if (node.getAttribute(name) !== v) node.setAttribute(name, v);
  }
  function classes(src, spec) {
    const own = [`rs-${spec.kind}`];
    if (spec.flow) own.push(`rs-${spec.flow}`);
    if (spec.inline) own.push("rs-inline");
    if (spec.level) own.push(`rs-h${Math.min(spec.level, 4)}`);
    for (const name of src.classList) own.push(`s-${name}`);
    return own.join(" ");
  }

  function textNode(src) {
    const data = clean(src.data);
    let node = cache.get(src);
    if (!node || node.nodeType !== Node.TEXT_NODE) { node = document.createTextNode(data); cache.set(src, node); }
    else if (node.data !== data) node.data = data;
    return node;
  }

  function create(src, spec) {
    switch (spec.kind) {
      case "btn": return el("button", { type: "button", onclick: (event) => { event.stopPropagation(); relayClick(src); } });
      case "range": return el("input", { type: "range", oninput: (event) => relayValue(src, event.target.value) });
      case "check": return el("button", { type: "button", role: "switch", onclick: (event) => { event.stopPropagation(); relayClick(src); } });
      case "select": return el("div", { role: "radiogroup" });
      case "img": return el("img", { alt: "", draggable: "false", decoding: "async" });
      case "br": return document.createElement("br");
      case "gauge": case "pips": case "inl": return document.createElement("span");
      default: return document.createElement(spec.inline ? "span" : "div");
    }
  }

  /** 元の要素1つ（とその中身）を写す。写さない物は null。 */
  function mirror(src) {
    if (src.nodeType === Node.TEXT_NODE) return textNode(src);
    if (src.nodeType !== Node.ELEMENT_NODE) return null;
    const spec = describe(src);
    if (!spec) return null;
    let node = cache.get(src);
    if (!node || node.dataset?.kind !== spec.kind || (spec.kind === "blk" && node.localName !== (spec.inline ? "span" : "div"))) {
      node = create(src, spec);
      node.dataset.kind = spec.kind;
      cache.set(src, node);
    }
    const cls = classes(src, spec);
    if (node.className !== cls) node.className = cls;
    if (src.dataset.test) setAttr(node, "data-test", `${testPrefix}${src.dataset.test}`);
    for (const name of STATE_ATTRS) setAttr(node, name, src.getAttribute(name));
    fill(node, src, spec);
    return node;
  }

  const children = (src) => [...src.childNodes].map(mirror).filter(Boolean);

  function fill(node, src, spec) {
    switch (spec.kind) {
      case "btn": {
        setAttr(node, "disabled", !!src.disabled || src.getAttribute("aria-disabled") === "true");
        setAttr(node, "value", src.getAttribute("value"));
        const list = children(src);
        // 絵文字だけのボタン（ミュートの切り替えなど）は、名前（aria-label）を文字で出す
        const hasText = list.some((child) => (child.textContent || "").trim() || child.localName === "img" || child.querySelector?.("img"));
        if (!hasText) {
          const name = clean(src.getAttribute("aria-label") || src.title || "");
          if (name) list.push(labelNode(node, name));
        }
        setAttr(node, "aria-label", src.getAttribute("aria-label") && hasText ? clean(src.getAttribute("aria-label")) : null);
        setChildren(node, list);
        return;
      }
      case "range": {
        for (const name of ["min", "max", "step"]) setAttr(node, name, src.getAttribute(name));
        setAttr(node, "disabled", src.disabled);
        // 指で動かしている間は書き戻さない
        if (document.activeElement !== node && node.value !== src.value) node.value = src.value;
        const label = src.closest("label")?.querySelector("span")?.textContent || src.getAttribute("aria-label") || "";
        setAttr(node, "aria-label", label);
        return;
      }
      case "check": {
        setAttr(node, "aria-checked", String(!!src.checked));
        setAttr(node, "disabled", src.disabled);
        const label = src.closest("label")?.querySelector("span")?.textContent || src.getAttribute("aria-label") || "";
        setAttr(node, "aria-label", label);
        setChildren(node, [labelNode(node, src.checked ? "ON" : "OFF")]);
        return;
      }
      case "select": {
        const options = [...src.options];
        const list = options.map((option, index) => {
          const key = `option-${index}`;
          let button = node.querySelector(`:scope > [data-option="${key}"]`);
          if (!button) {
            button = el("button.rs-btn.rs-option", { type: "button", role: "radio", dataset: { option: key },
              onclick: (event) => { event.stopPropagation(); relayValue(src, src.options[index]?.value); } });
          }
          setAttr(button, "aria-checked", String(option.selected));
          if (button.textContent !== option.textContent) button.textContent = clean(option.textContent);
          return button;
        });
        setAttr(node, "aria-label", src.getAttribute("aria-label"));
        setChildren(node, list);
        return;
      }
      case "img": {
        const url = src.currentSrc || src.src || "";
        if (node.getAttribute("src") !== url) node.src = url;
        return;
      }
      case "gauge": {
        // ゲージ: 幅を持つ子（量）を、同じ幅の帯で写す（セーブの枠の能力の帯は --v の値）
        const own = src.style.getPropertyValue("--v");
        const sources = own ? [{ classList: [], width: own }] : [...src.querySelectorAll("[style*='width']")].map((part) => ({ classList: [...part.classList], width: part.style.width }));
        const parts = sources.map((part, index) => {
          const key = `fill-${index}`;
          let bar = node.querySelector(`:scope > [data-fill="${key}"]`);
          if (!bar) bar = el("i.rs-fill", { dataset: { fill: key } });
          const cls = `rs-fill ${part.classList.map((name) => `s-${name}`).join(" ")}`.trim();
          if (bar.className !== cls) bar.className = cls;
          if (bar.style.width !== part.width) bar.style.width = part.width;
          return bar;
        });
        setChildren(node, parts);
        return;
      }
      case "pips": {
        // 段の丸・好感度のハート（role="img"）: 子の数だけ小さな印。中身が無ければ名前（aria-label）を文字で
        const marks = [...src.children];
        const list = marks.length ? marks.map((mark, index) => {
          const key = `pip-${index}`;
          let pip = node.querySelector(`:scope > [data-pip="${key}"]`);
          if (!pip) pip = el("i.rs-pip", { dataset: { pip: key } });
          const fillValue = parseFloat(mark.style.getPropertyValue("--fill"));
          const on = mark.classList.contains("on") || (Number.isFinite(fillValue) && fillValue >= 50);
          const cls = `rs-pip${on ? " on" : ""}${mark.classList.contains("ui-heart") ? " heart" : ""}`;
          if (pip.className !== cls) pip.className = cls;
          return pip;
        }) : [labelNode(node, clean(src.getAttribute("aria-label") || ""))];
        setAttr(node, "aria-label", clean(src.getAttribute("aria-label") || ""));
        setAttr(node, "role", "img");
        setChildren(node, list);
        return;
      }
      default:
        setChildren(node, children(src));
    }
  }

  /** 部品に付ける文字（同じ文字なら同じ text node を使い回す）。 */
  function labelNode(owner, value) {
    const first = owner.firstChild;
    if (first?.nodeType === Node.TEXT_NODE && owner.childNodes.length === 1) { if (first.data !== value) first.data = value; return first; }
    return document.createTextNode(value);
  }

  return {
    mirror,
    /** 元の要素の中身（子）を写した一覧。 */
    childrenOf: (src) => (src ? children(src) : []),
    reset() { cache = new WeakMap(); },
  };
}

/** MENU の上画面に出す人（ステータスははじめ、人間関係は開いた相手か一覧の先頭）。looks/neo/menu-figure.js と同じ選び方。 */
function menuSubject(menu) {
  const tab = menu.dataset.tab;
  if (tab === "status") return { id: "hajime", name: realName("hajime") };
  if (tab !== "people") return null;
  const rows = [...menu.querySelectorAll(".dm-panel .dm-person[data-person]")];
  const row = rows.find((node) => node.getAttribute("aria-expanded") === "true") || rows[0];
  return row ? { id: row.dataset.person, name: text(row.querySelector(".dm-name")) } : null;
}

/** 今の背景の絵（#bg）。MENU の上画面の下地にする。 */
function backgroundUrl() {
  for (const layer of readBackgrounds(stageMetrics())) {
    const part = layer.parts.find((p) => p.url && (p.type === "cover" || p.type === "image"));
    if (part) return part.url;
  }
  return "";
}

export function createSheetScene(shell, painter) {
  const head = el("div.rs-region.rs-head", { dataset: { test: "retro-sheet-head" } });
  const body = el("div.rs-region.rs-body", { dataset: { test: "retro-sheet-body" } });
  const foot = el("div.rs-region.rs-foot", { dataset: { test: "retro-sheet-foot" } });
  const pane = el("div.retro-pane.retro-sheet", { hidden: true, dataset: { test: "retro-sheet" } }, [head, body, foot]);
  let live = null, kind = "", identity = null, version = 0, drawn = -1, pressing = false, pressAt = 0;
  const mirror = createMirror({ onRelay: () => { version++; pressing = false; } });
  let observer = null;
  let picture = [];

  const watch = () => {
    observer?.disconnect();
    observer = new MutationObserver(() => { version++; });
    for (const id of ["modal", "vn"]) {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  };
  // 指が触れている間は書き直さない（押した要素を差し替えて click を失わないように）
  pane.addEventListener("pointerdown", () => { pressing = true; pressAt = performance.now(); });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) pane.addEventListener(type, () => { pressing = false; });

  /** 縦長のシートは上画面の上端から下画面の下端まで。MENU は下画面だけ。 */
  function place(tall) {
    const device = shell.top.parentElement;
    const host = tall ? device : shell.bottom;
    if (pane.parentElement !== host) host.append(pane);
    pane.dataset.tall = String(tall);
    if (!tall) { pane.style.cssText = ""; return; }
    const top = shell.top.offsetTop, bottom = shell.bottom.offsetTop + shell.bottom.offsetHeight;
    const css = `left:${shell.top.offsetLeft}px;top:${top}px;width:${shell.top.offsetWidth}px;height:${bottom - top}px`;
    if (pane.style.cssText.replace(/\s/g, "") !== css) pane.style.cssText = css;
  }

  /** 送れる所の位置を保って書き直す。stick: 一番下にいたら（または初めて）一番下へ（LIME の会話・LOG）。 */
  function render(parts, { fresh, stick }) {
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 6;
    const keep = body.scrollTop;
    const setRegion = (region, sources) => {
      const list = sources.flatMap((source) => source.whole ? [mirror.mirror(source.node)] : mirror.childrenOf(source.node)).filter(Boolean);
      const now = region.childNodes;
      if (!(now.length === list.length && list.every((node, i) => now[i] === node))) region.replaceChildren(...list);
      region.hidden = !list.length;
    };
    setRegion(head, parts.head);
    setRegion(body, parts.body);
    setRegion(foot, parts.foot);
    if (fresh) body.scrollTop = stick ? body.scrollHeight : 0;
    else if (stick && atBottom) body.scrollTop = body.scrollHeight;
    else if (body.scrollTop !== keep) body.scrollTop = keep;
  }

  /** 写す範囲（見出し・中身・下のボタン）と、外枠の状態の行・本体のボタン・上画面の絵。 */
  function partsOf(sheet) {
    const root = sheet.root;
    const node = (selector) => root.querySelector(selector);
    const src = (n, whole = false) => (n ? [{ node: n, whole }] : []);
    if (sheet.kind === "menu") {
      const tabs = [...root.querySelectorAll(".dm-tab")];
      const panel = node(".dm-panel");
      const active = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
      return {
        tall: false,
        status: [[text(node(".dm-title > span")) || "MENU", text(node(".dm-cycle"))].filter(Boolean).join(" ・ "), text(active?.querySelector(".dm-label"))],
        head: [], foot: [],
        // チェキの拡大中は、その絵（タップで閉じる）だけ
        body: sheet.viewer ? src(sheet.viewer, true) : [...src(node(".dm-summary"), true), ...src(panel)],
        identity: sheet.viewer || `${root.dataset.tab}|${panel?.firstElementChild?.className || ""}`,
        keys: [
          ...tabs.map((tab) => ({
            id: `tab-${tab.dataset.tab}`, label: text(tab.querySelector(".dm-label")) || text(tab), pressed: tab.getAttribute("aria-selected") === "true",
            run: () => { liveSheet()?.viewer?.click(); liveSheet()?.root.querySelector(`.dm-tab[data-tab="${tab.dataset.tab}"]`)?.click(); },
          })),
          { id: "close", label: "閉じる", run: () => { const s = liveSheet(); if (s?.viewer) s.viewer.click(); else s?.root.querySelector(".dm-close")?.click(); } },
        ],
      };
    }
    if (sheet.kind === "lime") {
      const back = node(".lime-header .lime-back"), close = node('[data-test="phone-close"]');
      return {
        tall: true,
        status: ["LIME", [...root.querySelectorAll(".phone-status > span:not(.phone-batt)")].map(text).filter(Boolean).join(" ・ ")],
        head: src(node(".lime-header")), body: src(node(".lime-chat")), foot: src(node(".lime-actions")),
        identity: text(node(".lime-header")), stick: true,
        keys: [
          ...(back ? [{ id: "back", label: "もどる", run: () => liveSheet()?.root.querySelector(".lime-header .lime-back")?.click() }] : []),
          ...(close ? [{ id: "close", label: "閉じる", run: () => liveSheet()?.root.querySelector('[data-test="phone-close"]')?.click() }] : []),
        ],
      };
    }
    if (sheet.kind === "log") {
      const close = node(".log-head button");
      return {
        tall: true, status: ["LOG", ""],
        head: src(node(".log-head")), body: src(node(".log-list")), foot: [],
        identity: root, stick: true,
        keys: close ? [{ id: "close", label: "閉じる", run: () => liveSheet()?.root.querySelector(".log-head button")?.click() }] : [],
      };
    }
    // 小窓: 見出し（h3）・本文（送れる）・選択肢のボタン
    const title = node(":scope > h3");
    return {
      tall: true, status: [text(title), ""],
      head: src(title, true),
      body: [...root.children].filter((child) => child !== title && !child.matches(".modal-actions")).map((child) => ({ node: child, whole: true })),
      foot: src(node(":scope > .modal-actions")),
      identity: root, keys: [],
    };
  }

  /** MENU の上画面: チェキの拡大中はその絵、ステータス・人間関係は立ち絵、ほかは暗くした背景。 */
  function menuPicture(sheet) {
    const out = [];
    if (sheet.viewer) {
      const url = sheet.viewer.querySelector("img")?.currentSrc || sheet.viewer.querySelector("img")?.src;
      if (url) out.push({ url, x: 0, y: -120, w: STAGE_W, h: 960, fit: "contain", pos: "50% 50%", opacity: 1 });
      return { images: out, name: clean(sheet.viewer.querySelector("img")?.alt || "") };
    }
    const who = menuSubject(sheet.root);
    const bg = backgroundUrl();
    if (bg) out.push({ url: bg, x: 0, y: -120, w: STAGE_W, h: 960, fit: "cover", pos: "50% 50%", opacity: who ? 0.5 : 0.32 });
    const info = who ? portraitInfo(who.id, "normal") : null;
    if (info) {
      // 頭の上を枠の上端の少し下へ、体の中心を真ん中へ（会話の立ち絵と同じ寸法の読み方）
      const h = Math.min(1.5 * (info.scale || 1) / info.h, 2.4) * 720;
      const headroom = Math.max(0, 1 - info.b - info.h - (info.topOverhang || 0));
      const w = h * (info.aspect || 0.75);
      out.push({ url: info.src, x: Math.round(STAGE_W / 2 - w * (info.ax ?? 0.5)), y: Math.round(24 - h * headroom), w: Math.round(w), h: Math.round(h), opacity: 1 });
    }
    return { images: out, name: info ? who.name : "" };
  }

  function sync() {
    const sheet = liveSheet();
    if (!sheet) return;
    const parts = partsOf(sheet);
    place(parts.tall);
    pane.dataset.kind = sheet.kind;
    kind = sheet.kind;
    const fresh = live !== sheet.root || identity !== parts.identity;
    const due = fresh || drawn !== version;
    // 押している途中は書き直しを少し待つ（長く押したままなら書き直す）
    if (due && (!pressing || performance.now() - pressAt > 1200)) {
      drawn = version;
      render(parts, { fresh, stick: !!parts.stick });
      live = sheet.root;
      identity = parts.identity;
    }
    shell.setStatus(parts.status[0] || "", parts.status[1] || "");
    shell.setKeys(parts.keys);
    if (sheet.kind === "menu") {
      const { images, name } = menuPicture(sheet);
      picture = images;
      shell.setCaption("", name);
    } else {
      picture = [];
      shell.setCaption("");
    }
  }

  return {
    pane,
    sync,
    // 縦長のシートは上画面を覆うので描かない。MENU は上画面にタブに合った絵
    paint: (now) => (kind === "menu" ? painter.paintCover(now, picture) : false),
    enter() {
      live = null; identity = null; drawn = -1; version = 0; kind = ""; pressing = false;
      watch();
    },
    leave() {
      observer?.disconnect();
      observer = null;
      head.replaceChildren(); body.replaceChildren(); foot.replaceChildren();
      mirror.reset();
      if (pane.parentElement !== shell.bottom) shell.bottom.append(pane);
      pane.style.cssText = "";
      delete pane.dataset.kind; delete pane.dataset.tall;
      live = null; identity = null; kind = ""; picture = [];
    },
    get kind() { return kind; },
  };
}
