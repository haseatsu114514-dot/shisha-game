// 縦画面「煙の舞台」: 見るだけの覆い（場面転換・日付の札・章タイトル・巻頭の詩・登場カットイン・読み込みの一言など）。
// 本編の覆い（#fx の中身・暗転の幕）に見えている文字と大きな絵を読み、縦の外枠の中に出す。パッドは消して、触れたら本編へ中継する。
// 登場カットインは、縦画面で決めた案A「縦のポスター」（VPL22・VPL28）に組み直す: 上に人物、真ん中に斜めの帯と名前、下に一言。
// 名前・二つ名・一言・好きなフレーバー・色・絵は、本編が出したカットイン（vn/intro-art.js の .cutin.art-intro）からそのまま読む。
// 章タイトル（タイトルコール）は VPN27 の形: 上にゲームタイトル（本編のタイトルのロゴ）、真ん中に章タイトルの横長の絵をそのまま、下の空きに章の情報。
// どの章かは本編の章タイトル（core/ui.js chapterTitle の .chapter-card）から読み、章名・英題は core/chapter-title-art.js の登録から（「〇〇編」は出さない・VPN23）。
import { el } from "../../core/util.js";
import { CHAPTER_TITLE_ART } from "../../core/chapter-title-art.js";
import { textOf, mirrorBackground, relayTap } from "./frame.js";
import { readLines as readBlockLines } from "../retro/cover.js";

const HARMLESS = ".flash, .stat-flight, .lvup, .gfx-fly, .gfx-ring, .gfx-spark";

/** 覆いの中に見えている文字を、ブロックごとの行として読む（DS風と同じ読み方。ふりがな・隠れている所は除く）。戻り値: [{ text, size }] */
function readLines(roots) {
  const lines = [];
  for (const root of roots) readBlockLines(root, 1, lines);
  return lines.filter((line, index) => lines.findIndex((other) => other.text === line.text) === index).slice(0, 8);
}

/** 画面いっぱいの絵（章タイトルの絵・漫画など）。 */
function readArt(roots) {
  const stage = document.getElementById("stage")?.getBoundingClientRect();
  const out = [];
  for (const root of roots) {
    for (const img of root.querySelectorAll("img")) {
      if (!img.complete || !img.naturalWidth) continue;
      const box = img.getBoundingClientRect();
      let opacity = 1;
      for (let node = img; node && node !== root.parentElement; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.display === "none" || cs.visibility === "hidden") { opacity = 0; break; }
        opacity *= parseFloat(cs.opacity) || 0;
      }
      if (opacity < 0.08 || !stage?.width || box.width < stage.width * 0.35) continue;
      out.push({ url: img.currentSrc || img.src, alt: img.alt || "", opacity });
    }
  }
  return out.slice(-2);
}

/** 本編の登場カットイン（絵つき）の中身。 */
function readCutin(host) {
  const cs = getComputedStyle(host);
  const name = host.querySelector(".ci-name");
  const flavor = host.querySelector(".ci-flavor");
  return {
    id: host.dataset.char || "",
    motion: host.dataset.motion || "sharp",
    color: cs.getPropertyValue("--accent").trim() || cs.getPropertyValue("--ci").trim() || "#c3b0ff",
    secondary: cs.getPropertyValue("--secondary").trim() || "#ffffff",
    shadow: cs.getPropertyValue("--portrait-bg").trim() || "#0b0812",
    art: host.querySelector("img.ci-portrait")?.currentSrc || host.querySelector("img.ci-portrait")?.src || "",
    bg: host.querySelector("img.ci-art-background")?.currentSrc || host.querySelector("img.ci-art-background")?.src || "",
    name,
    plainName: name?.getAttribute("aria-label") || textOf(name),
    title: textOf(host.querySelector(".ci-title")),
    line: textOf(host.querySelector(".ci-line")),
    flavorLabel: textOf(flavor?.querySelector(".ci-flavor-label")) || "好きなフレーバー",
    flavor: textOf(flavor?.querySelector(".ci-flavor-name")),
  };
}

/** ゲームタイトルのロゴ（本編のタイトル画面と同じ絵）。 */
const TITLE_LOGO = new URL("../../../img/ui/ui_title_logo_rich.webp", import.meta.url).href;
/**
 * 章タイトルの絵の置き方（VPN27・2026-11-27 オーナー「やはりタイトルコールは既存の横長のを使いたい　真ん中に出して上にゲームタイトル
 * 下のあいてるスペースに章情報みたいなレイアウト試して」）: 横長の絵（1280×720）を画面の幅いっぱい・縦の真ん中に、切らずに置く。
 * 第1章の絵は白地で、上に題字（ゲーム名・CHAPTER 1・章名・英題）が描き込まれているので、人物が並ぶ帯（絵の高さの割合）だけを切り出す
 * （題字は下の章の情報と同じなので、二重に出さない）。白地の絵は、同じ絵をぼかした背景を敷かない（灰色ににごるため）。
 */
const TITLE_CROP = { 1: { top: 0.36, bottom: 0.94, light: true } };

/** 覆いの中の章タイトル（本編の .chapter-title-shield の .chapter-card、第1章は専用の演出 .ch1-title-motion）。無ければ null。 */
function readChapterTitle(roots) {
  // 第1章は専用の演出（chapters/ch1-title-motion.js）。縦画面では、同じ絵（横長の章タイトル）で他の章と同じ形に組む
  const first = roots.find((node) => node.matches(".ch1-title-motion"));
  if (first) {
    if (first.dataset.phase !== "playing") return null;
    const entry = CHAPTER_TITLE_ART.find((item) => item.chapter === 1);
    return entry && { chapter: 1, no: entry.no, name: entry.name, english: String(entry.read || "").split("──").pop().trim(), art: entry.url, out: false };
  }
  const shield = roots.find((node) => node.matches(".chapter-title-shield"));
  const card = shield?.querySelector(".chapter-card");
  if (!card) return null;
  const entry = CHAPTER_TITLE_ART.find((item) => item.no === card.dataset.chapter);
  if (!entry) return null;
  const img = card.querySelector("img.cc-art");
  return {
    chapter: entry.chapter, no: entry.no, name: entry.name,
    english: String(entry.read || "").split("──").pop().trim(),
    art: card.classList.contains("illustrated") ? img?.currentSrc || img?.src || entry.url : "",
    out: card.classList.contains("out"),
  };
}

/** 名前（ふりがな付き）。本編の span.ci-ruby[data-ruby] を ruby に置き直す。 */
function nameHtml(node) {
  const out = el("div.vt-cv-name");
  for (const part of node?.childNodes || []) {
    if (part.nodeType !== Node.ELEMENT_NODE) { out.append(part.textContent); continue; }
    if (part.classList.contains("ci-name-gap")) { out.append(el("i.vt-cv-gap")); continue; }
    if (part.dataset.ruby) { out.append(el("ruby", [part.textContent, el("rt", { text: part.dataset.ruby })])); continue; }
    out.append(part.textContent);
  }
  return out;
}

export function createCoverScene(frame, own) {
  const bg = el("div.vt-bg");
  const art = el("div.vt-cover-art", { hidden: true });
  const lines = el("div.vt-cover-lines", { dataset: { test: "vt-cover-text" } });
  const wait = el("div.vt-wait", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]);
  const tip = el("div.vt-tip", { hidden: true, text: "タッチで次へ", "aria-hidden": "true" });
  const poster = el("div.vt-cv", { hidden: true, dataset: { test: "vt-cutin" } });
  const call = el("div.vt-ct", { hidden: true, dataset: { test: "vt-title-call" } });
  let sig = "", posterSig = "", callSig = "", changedAt = 0, lastTap = 0, holding = false, gap = false;

  /** 本編のステージ中央の一番上の要素へ、タップを中継する（詩の送りなど、覆いがタップを待っている時に詰まらないように）。 */
  function relay() {
    if (holding) return;
    const stage = document.getElementById("stage");
    const rect = stage?.getBoundingClientRect();
    if (!rect?.width) return;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const target = document.elementsFromPoint(x, y).find((node) => !own.some((mine) => mine.contains(node)) && !document.getElementById("rotate-hint")?.contains(node));
    if (!target) return;
    lastTap = performance.now();
    relayTap(target);
  }

  function renderPoster(card) {
    const len = [...card.plainName.replace(/\s/g, "")].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.55 : 1), 0);
    const size = Math.min(8.4, 31 / Math.max(1, len));
    poster.dataset.m = card.motion;
    poster.style.cssText = `--ci:${card.color};--ci2:${card.secondary};--ci-shadow:${card.shadow};--name-size:${size.toFixed(2)}`;
    poster.setAttribute("aria-label", `${card.plainName}の紹介`);
    poster.replaceChildren(...[ // 無い物（null）は除く
      el("i.vt-cv-flash"),
      card.bg ? el("img.vt-cv-bg", { src: card.bg, alt: "", draggable: "false" }) : null,
      el("i.vt-cv-veil"),
      card.art ? el("img.vt-cv-art", { src: card.art, alt: "", draggable: "false" }) : null,
      el("div.vt-cv-band", [el("i.vt-cv-accent"), nameHtml(card.name)]),
      card.title ? el("div.vt-cv-tag", { text: card.title }) : null,
      el("div.vt-cv-say", [
        card.line ? el("p.vt-cv-quote", { text: card.line }) : null,
        card.flavor ? el("p.vt-cv-flavor", [el("small", { text: card.flavorLabel }), el("b", { text: card.flavor })]) : null,
      ]),
    ].filter(Boolean));
  }

  /** 章タイトルを組む（VPN27）: 上にゲームタイトルのロゴ、真ん中に横長の絵、下に章の情報（CHAPTER n・章名・線・英題）。 */
  function renderCall(title) {
    const crop = TITLE_CROP[title.chapter];
    call.dataset.chapter = String(title.chapter);
    call.dataset.tone = crop?.light ? "light" : "dark";
    // 切り出す章は、枠の縦横比と絵のずらしを渡す（絵の高さ 720 のうち top〜bottom を見せる）
    call.style.cssText = crop ? `--ct-ar:${(1280 / (720 * (crop.bottom - crop.top))).toFixed(4)};--ct-shift:${(crop.top / (crop.bottom - crop.top)).toFixed(4)}` : "";
    call.setAttribute("aria-label", [title.no, title.name, title.english].filter(Boolean).join("　"));
    call.replaceChildren(...[ // 置かない物（null）は除く（replaceChildren は null を「null」という文字にしてしまう）
      title.art && !crop?.light ? el("img.vt-ct-amb", { src: title.art, alt: "", draggable: "false" }) : null,
      el("div.vt-ct-head", { "aria-hidden": "true" }, [el("img.vt-ct-logo", { src: TITLE_LOGO, alt: "", draggable: "false" })]),
      title.art ? el("div.vt-ct-pic", [el("img.vt-ct-art", { src: title.art, alt: "", draggable: "false" })]) : el("div.vt-ct-pic.empty"),
      el("div.vt-ct-copy", { "aria-hidden": "true" }, [
        el("div.vt-ct-en", { text: `CHAPTER ${title.chapter}` }),
        el(`div.vt-ct-name${[...title.name].length > 5 ? ".long" : ""}`, { text: title.name }),
        el("i.vt-ct-rule"),
        title.english ? el("div.vt-ct-read", { text: title.english }) : null,
        // 「〇〇編」は章によって有ったり無かったりするので、縦画面のタイトルコールでは出さない（VPN23）
      ]),
    ].filter(Boolean));
  }


  function sync(state = {}) {
    holding = !!state.hold;
    gap = !!state.gap;
    const roots = [...(document.getElementById("fx")?.children || [])].filter((node) => !node.matches(HARMLESS));
    const cutin = roots.find((node) => node.matches(".cutin.art-intro"));
    const title = cutin ? null : readChapterTitle(roots);
    frame.root.dataset.cover = cutin ? "cutin" : title ? "title" : gap ? "gap" : "cover";
    if (title) {
      const next = JSON.stringify([title.chapter, title.art]);
      if (next !== callSig) { callSig = next; renderCall(title); }
      call.hidden = false;
      call.classList.toggle("out", title.out);
    } else {
      call.hidden = true;
      callSig = "";
    }
    if (cutin) {
      const card = readCutin(cutin);
      const next = JSON.stringify([card.id, card.art, card.bg, card.title, card.line, card.flavor]);
      if (next !== posterSig) { posterSig = next; renderPoster(card); }
      poster.hidden = false;
    } else {
      poster.hidden = true;
      posterSig = "";
    }
    const url = mirrorBackground(bg);
    frame.setAmbient(url);
    const read = cutin || title || gap ? [] : readLines(roots.filter((node) => !node.matches(".cutin")));
    const pics = cutin || title || gap ? [] : readArt(roots);
    const next = JSON.stringify([read, pics.map((p) => p.url)]);
    if (next !== sig) {
      sig = next;
      changedAt = performance.now();
      // 字の大きさ: いちばん大きい字の行（と、それに近い短い行）を見出しの大きさで出す
      const biggest = Math.max(0, ...read.map((line) => line.size));
      const mixed = read.some((line) => line.size < biggest * 0.72);
      lines.replaceChildren(...read.map((line) => el(`div.vt-cover-line${mixed && line.size >= biggest * 0.72 && [...line.text].length <= 15 ? ".big" : ""}`, { text: line.text })));
      art.hidden = !pics.length;
      art.replaceChildren(...pics.map((pic) => el("img", { src: pic.url, alt: pic.alt, draggable: "false" })));
    }
    lines.hidden = !read.length;
    wait.hidden = !!read.length || !!pics.length || !!cutin || !!title || gap;
    tip.hidden = holding || !state.pressable || !!cutin || !!title || performance.now() - Math.max(changedAt, lastTap) < 1500;
    frame.setChips([]);
    // 下画面はそのまま（指の位置を変えない）。丸ボタンは「次へ」＝本編の覆いへタップを中継
    frame.setPad({ dirs: [], a: { face: "next", label: "次へ", disabled: holding || (!state.pressable && !gap) } });
    frame.setHud("none");
  }

  return {
    name: "cover",
    enter() {
      frame.picture.dataset.kind = "stage";
      frame.picture.append(bg);
      frame.over.append(art, lines, wait, tip, poster, call);
      frame.over.hidden = false;
      sig = posterSig = callSig = ""; changedAt = performance.now(); bg.dataset.sig = "";
    },
    leave() { poster.hidden = true; call.hidden = true; delete frame.root.dataset.cover; },
    sync,
    dir() {},
    a: relay,
    chip() {},
    tap: relay,
    overTap: relay,
    hasContent: () => !lines.hidden || !art.hidden || !poster.hidden || !call.hidden,
    activeAt: () => Math.max(changedAt, lastTap),
  };
}
