// 覆い（見るだけの場面）: 場面転換・日付の札・章タイトル・巻頭の詩・登場カットイン・読み込みの一言など。
// 現行の画面へは戻さず、外枠のまま上画面を暗くして、覆いの中に見えている文字と絵だけを読み取って写す。
// タップは現行ステージ中央の一番上の要素へ中継する（詩の送りなど、覆いがタップを待っている時に詰まらないように）。
import { el } from "../../core/util.js";

const SKIP_TAGS = new Set(["rt", "rp", "script", "style", "svg", "canvas", "img", "button"]);
const text = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

function stageMetrics() {
  const stage = document.getElementById("stage");
  const rect = stage.getBoundingClientRect();
  return { rect, k: rect.width / (stage.offsetWidth || 1280) || 1 };
}
const stageBox = (node, m) => {
  const b = node.getBoundingClientRect();
  return { x: Math.round((b.left - m.rect.left) / m.k), y: Math.round((b.top - m.rect.top) / m.k), w: Math.round(b.width / m.k), h: Math.round(b.height / m.k) };
};

/** 絵の見えている幅（親が overflow で切り取っていれば、その幅まで）。 */
function visibleWidth(img) {
  let width = img.getBoundingClientRect().width;
  for (let node = img.parentElement; node && node.id !== "fx"; node = node.parentElement) {
    if (getComputedStyle(node).overflow !== "visible") width = Math.min(width, node.getBoundingClientRect().width);
  }
  return width;
}

/** "rgb(…)" / "rgba(…)" を canvas の画素の並び（0xAABBGGRR）へ。透けている色は 0。 */
function solidColor(value) {
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\)/.exec(value || "");
  if (!m || (m[4] !== undefined && parseFloat(m[4]) < 0.6)) return 0;
  return (0xff000000 | (Math.round(m[3]) << 16) | (Math.round(m[2]) << 8) | Math.round(m[1])) >>> 0;
}

/** 行の中の文字（ふりがな・隠れている所は除く）。数字のめくり（.tr-flip）は新しい方だけ読む。 */
function inlineText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.data;
  if (node.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(node.localName)) return "";
  if (node.classList.contains("tr-flip")) return node.lastElementChild?.textContent || "";
  const cs = getComputedStyle(node);
  if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.3) return "";
  let out = "";
  for (const child of node.childNodes) out += inlineText(child);
  return out;
}

/**
 * 覆いの中に見えている文字を、上から順に行として読む。行は「ブロックの箱」ごと（インラインの子はつなげる）。
 * 戻り値: [{ text, size（ステージ上の字の大きさ px） }]
 */
function readLines(root, opacity, lines) {
  if (SKIP_TAGS.has(root.localName) || root.hidden) return;
  const cs = getComputedStyle(root);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const visible = opacity * (parseFloat(cs.opacity) || 0);
  if (visible < 0.3) return;
  const size = parseFloat(cs.fontSize) || 16;
  // 横並び（flex の row）の箱は、子をつなげて1行として読む（「DAY 6」「…まで あと 8 日」）
  const row = cs.display.includes("flex") && !cs.flexDirection.startsWith("column");
  let run = "";
  const flush = () => {
    const value = run.replace(/\s+/g, " ").trim();
    run = "";
    if (value && !/^[▼▽▾]+$/.test(value)) lines.push({ text: value, size });
  };
  for (const child of root.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) { run += child.data; continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (child.localName === "img") {
      // 画面いっぱいの絵に書かれている文字（章タイトルの絵など）は、代わりの文字（alt）で読む。小さな絵（店のロゴなど）の alt は読まない
      if (child.alt && visibleWidth(child) >= (document.getElementById("stage")?.getBoundingClientRect().width || Infinity) * 0.6) {
        flush();
        for (const part of child.alt.split("　")) if (part.trim()) lines.push({ text: part.trim(), size: 30 });
      }
      continue;
    }
    if (SKIP_TAGS.has(child.localName)) continue;
    const display = getComputedStyle(child).display;
    if (row) run += ` ${inlineText(child)} `;
    else if (display.startsWith("inline") || display === "contents" || display.startsWith("ruby")) run += inlineText(child);
    else { flush(); readLines(child, visible, lines); }
  }
  flush();
  // 文字が無く、読み上げ用の名前だけ持つ絵（role="img"）は、その名前を読む
  if (!lines.length && root.getAttribute("role") === "img" && root.getAttribute("aria-label")
    && root.getBoundingClientRect().width >= (document.getElementById("stage")?.getBoundingClientRect().width || Infinity) * 0.6) {
    for (const part of root.getAttribute("aria-label").split("　")) if (part.trim()) lines.push({ text: part.trim(), size: 30 });
  }
}

/** 覆いの中に見えている絵（<img>）。位置はステージ座標。 */
function readImages(roots, metrics) {
  const images = [];
  for (const root of roots) {
    for (const img of root.querySelectorAll("img")) {
      if (!img.complete || !img.naturalWidth) continue;
      let opacity = 1, clip = null, backing = null;
      for (let node = img; node && node !== root.parentElement; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.display === "none" || cs.visibility === "hidden") { opacity = 0; break; }
        opacity *= parseFloat(cs.opacity) || 0;
        // この絵だけを載せている札（店のロゴの白い札など）は、その色の面として一緒に写す
        if (node !== img && !backing && node.querySelectorAll("img").length === 1) {
          const color = solidColor(cs.backgroundColor);
          if (color) backing = { ...stageBox(node, metrics), color };
        }
        // 親が切り取っている（overflow: hidden）なら、見えている範囲を覚える
        if (node !== img && cs.overflow !== "visible") {
          const b = stageBox(node, metrics);
          const x0 = Math.max(clip?.x ?? -Infinity, b.x), y0 = Math.max(clip?.y ?? -Infinity, b.y);
          const x1 = Math.min(clip ? clip.x + clip.w : Infinity, b.x + b.w), y1 = Math.min(clip ? clip.y + clip.h : Infinity, b.y + b.h);
          clip = { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
        }
      }
      if (opacity < 0.06) continue;
      const box = stageBox(img, metrics);
      if (box.w < 8 || box.h < 8) continue;
      const cs = getComputedStyle(img);
      images.push({ url: img.currentSrc || img.src, ...box, opacity: Math.round(opacity * 20) / 20, fit: cs.objectFit, pos: cs.objectPosition, clip, backing });
    }
  }
  return images;
}

/** 登場カットイン（vn/intro.js の .cutin）の言葉: 名前（ふりがな）・肩書き・ひと言・好きなフレーバー。 */
function readCutin(cutin) {
  const name = cutin.querySelector(".ci-name");
  const flavor = cutin.querySelector(".ci-flavor");
  return {
    name: name?.getAttribute("aria-label") || text(name),
    ruby: [...(name?.querySelectorAll("[data-ruby]") || [])].map((node) => node.dataset.ruby).join(" "),
    title: text(cutin.querySelector(".ci-title")),
    line: text(cutin.querySelector(".ci-line")),
    flavorLabel: text(flavor?.querySelector(".ci-flavor-label")),
    flavor: text(flavor?.querySelector(".ci-flavor-name")),
  };
}

export function createCoverScene(shell, painter, own) {
  const topText = el("div.retro-covertext", { hidden: true, dataset: { test: "retro-cover-text" } });
  const lines = el("div.retro-cover-lines", { hidden: true });
  const profile = el("div.retro-profile", { hidden: true, dataset: { test: "retro-profile" } });
  const wait = el("div.retro-wait", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]);
  const tip = el("div.retro-vn-tip", { text: "タッチで つぎへ", hidden: true, "aria-hidden": "true" });
  const pane = el("div.retro-pane.retro-cover", { hidden: true, dataset: { test: "retro-cover" } }, [lines, profile, wait, tip]);

  /** 現行ステージ中央の一番上の要素へ、タップ（pointerdown → pointerup → click）を中継する。 */
  function relayTap() {
    const stage = document.getElementById("stage");
    const rect = stage?.getBoundingClientRect();
    if (!rect?.width) return;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const target = document.elementsFromPoint(x, y).find((node) => !own.some((mine) => mine.contains(node)));
    if (!target) return;
    lastTap = performance.now();
    const init = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    const pointer = (type) => (typeof PointerEvent === "function"
      ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: "touch", isPrimary: true }) : new MouseEvent(type, init));
    target.dispatchEvent(pointer("pointerdown"));
    target.dispatchEvent(pointer("pointerup"));
    target.dispatchEvent(new MouseEvent("click", init));
  }
  pane.addEventListener("click", relayTap);

  let images = [], sig = "", changedAt = 0, lastTap = 0, content = false;
  let gap = false; // 場面と場面のあいだ（覆いは無く、現行は背景だけを見せている）。上画面も背景のままにして待つ
  const lineNode = (line, big) => el(`div.retro-cover-line${big ? ".big" : ""}`, { text: line.text });

  function sync(state = {}) {
    if (!!state.gap !== gap) {
      gap = !!state.gap;
      painter.enter(true); // 背景のまま待つ ⇄ 暗くして覆いを写す の切り替えも、網点のコマ送りでつなぐ
    }
    const metrics = stageMetrics();
    const roots = [...(document.getElementById("fx")?.children || [])].filter((node) => !node.matches(".flash, .stat-flight"));
    const cutin = roots.find((node) => node.matches(".cutin"));
    const read = [];
    if (!cutin) for (const root of roots) readLines(root, 1, read);
    images = readImages(roots, metrics);
    const card = cutin ? readCutin(cutin) : null;
    const next = JSON.stringify([read, card, images.length > 0]);
    content = read.length > 0 || images.length > 0 || !!card;
    if (next !== sig) {
      sig = next;
      changedAt = performance.now();
      // 字の大きさ: いちばん大きい字の行（と、それに近い行）を 16 ドット、ほかを 12 ドットで出す
      const biggest = Math.max(0, ...read.map((line) => line.size));
      const nodes = read.slice(0, 9).map((line) => lineNode(line, line.size >= biggest * 0.72 && [...line.text].length <= 15));
      const below = images.length > 0; // 絵がある時は、文字を下画面へ回す
      topText.replaceChildren(...(below ? [] : nodes));
      lines.replaceChildren(...(below ? nodes : []));
      topText.hidden = below || !nodes.length;
      lines.hidden = !below || !nodes.length;
      profile.hidden = !card;
      if (card) {
        profile.replaceChildren(...[
          card.ruby ? el("div.retro-profile-ruby", { text: card.ruby }) : null,
          el("div.retro-profile-name", { text: card.name }),
          card.title ? el("div.retro-profile-title", { text: card.title }) : null,
          card.line ? el("div.retro-profile-line", { text: card.line }) : null,
          card.flavor ? el("div.retro-profile-flavor", [el("span", { text: card.flavorLabel || "好きなフレーバー" }), el("b", { text: card.flavor })]) : null,
        ].filter(Boolean));
      }
    }
    wait.hidden = !lines.hidden || !!card; // 下画面に出す物が無い間は、待っている印（点）を出す
    // 「タッチで つぎへ」は、覆いがタップを受ける状態のまま中身がしばらく変わらない時だけ出す（時間で進む場面転換では出さない）
    tip.hidden = !state.pressable || !!card || performance.now() - Math.max(changedAt, lastTap) < 1500;
    shell.setStatus("", "");
    shell.setKeys([]);
    shell.setCaption("");
  }

  return {
    pane,
    sync,
    paint: (now) => (gap ? painter.paintVn(now) : painter.paintCover(now, images)),
    tapTop: relayTap,
    /** 文字か絵を写せているか（何も写せずタップ待ちの覆いは、しばらくしたら現行の画面へ切り替える）。 */
    hasContent: () => content,
    /** 最後に中身が変わった・タップを中継した時刻。 */
    activeAt: () => Math.max(changedAt, lastTap),
    enter() {
      sig = "\u0000"; images = []; content = false; changedAt = performance.now(); gap = false;
      shell.top.querySelector(".retro-top-ui").append(topText);
    },
    leave() { topText.remove(); topText.replaceChildren(); lines.replaceChildren(); profile.replaceChildren(); },
  };
}
