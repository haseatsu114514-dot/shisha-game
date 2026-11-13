// 会話と選択肢。現行の会話欄（#vn の .vn-box / .vn-choices / .vn-controls）を読んで下画面へ写し、タップは現行へ中継する。
// 文字送りは現行が1字ずつ増やすので、変化のたびに写せばそのまま再現される。
import { el } from "../../core/util.js";
import { autoWrap } from "../../vn/text.js";
import { readHud } from "./hud.js";

// 1行に折る全角の字数。下画面の会話窓の文字の幅は 224 ドット（16 ドットで 14 字、12 ドットで 18 字入る）。
// 16 ドットは右端に1字分の余白を残して 13 字で折る（現行の1行＝全角24字が、必ず2行に収まる）。
const COLS = 13, COLS_SMALL = 18;

const cloneInto = (target, source) => target.replaceChildren(...[...source.childNodes].map((node) => node.cloneNode(true)));

// この字で終わる行の改行は、文の切れ目としてそのまま生かす。
const LINE_END = /[。、，．！？!?…‥♡♪☆★」』）】〉》─―—〜～]$/;

/**
 * 写した文字を、下画面の幅（全角 limit 字）で折り直す。折る位置は現行と同じ組版（vn/text.js の autoWrap＝文節・禁則）に任せ、
 * その位置へ <br> を足すだけにする（文字は足さない・消さない。行頭に来て現行が表示しない空白は、見えない箱に入れる）。
 * 現行の改行（<br>）は、文の切れ目（句読点・括弧閉じなど）で終わる行ならそのまま生かす。文の途中の改行は現行の幅
 * （全角24字）に合わせた折り返しなので、つないでから下画面の幅で折り直す（「ずいぶん／違うな」のような短い行を残さない）。
 * 選択肢の補足（.vn-choice-reason）は別の行として扱う。
 */
function rewrap(target, limit) {
  const lines = [[]], joined = [];
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) lines.at(-1).push(node);
    else if (node.classList.contains("vn-choice-reason")) lines.push([]);
    else if (node.localName === "br") {
      const before = lines.at(-1).map((part) => part.data).join("");
      if (!before || LINE_END.test(before)) lines.push([]);
      else joined.push(node);
    }
  }
  for (const node of joined) node.remove();
  for (const nodes of lines) {
    const plain = nodes.map((node) => node.data).join("");
    if (!plain) continue;
    let wrapped;
    try { wrapped = autoWrap(plain, limit); } catch { continue; }
    if (!wrapped.includes("\n")) continue;
    // 折る位置（plain の何文字目の前か）と、その直後で表示しない空白の終わり
    const breaks = [];
    let at = 0, open = null;
    for (const unit of wrapped) {
      if (unit === "\n") { open = { from: at, to: at }; breaks.push(open); continue; }
      while (at < plain.length && !plain.startsWith(unit, at)) at++;
      if (open) { open.to = at; open = null; }
      at += unit.length;
    }
    for (const { from, to } of breaks.reverse()) {
      let start = 0;
      for (const node of nodes) {
        const length = node.data.length;
        if (from > start + length) { start += length; continue; }
        const tail = from - start < length ? node.splitText(from - start) : null;
        node.after(el("br.retro-br"));
        if (tail && to > from) {
          if (to - from < tail.data.length) tail.splitText(to - from);
          const gap = el("span.retro-gap");
          tail.replaceWith(gap);
          gap.append(tail);
        }
        break;
      }
    }
  }
}

export function createVnScene(shell, painter) {
  const name = el("div.retro-vn-name", { hidden: true, dataset: { test: "retro-vn-name" } });
  const text = el("div.retro-vn-text", { dataset: { test: "retro-vn-text" } });
  const inner = el("div.retro-vn-inner", { hidden: true, dataset: { test: "retro-vn-inner" }, "aria-label": "ひよりの本心（はじめには聞こえない）" });
  const next = el("i.retro-vn-next", { hidden: true, "aria-hidden": "true" });
  const win = el("div.retro-vn-win", [text, inner, next]);
  const tip = el("div.retro-vn-tip", { text: "タッチで つぎへ", "aria-hidden": "true" });
  const choices = el("div.retro-vn-choices", { hidden: true, dataset: { test: "retro-vn-choices" } });
  const pane = el("div.retro-pane.retro-vn", { hidden: true, dataset: { test: "retro-vn", size: "", kind: "", choosing: "false" } }, [name, win, tip, choices]);

  /** 現行の会話欄へ「送る」を中継する。現行は #vn の pointerup で進む（vn/engine.js の buildDom）。 */
  function advance() {
    const box = document.querySelector("#vn.active .vn-box");
    if (!box) return;
    const init = { bubbles: true, cancelable: true, view: window };
    box.dispatchEvent(typeof PointerEvent === "function"
      ? new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "touch", isPrimary: true })
      : new MouseEvent("pointerup", init));
  }
  pane.addEventListener("click", (event) => {
    if (event.target.closest(".retro-vn-choices")) return;
    advance();
  });

  const liveChoices = () => [...document.querySelectorAll("#vn .vn-choices.show > .vn-choice")];
  let srcText = null, srcInner = null, innerOn = false;
  let textSig = null, innerSig = null, choiceSig = "", grown = "", cols = COLS;

  /** 現行の本文と本心を写して、いまの字の大きさで折り直す。 */
  function renderText() {
    if (srcText) { cloneInto(text, srcText); rewrap(text, cols); } else text.replaceChildren();
    if (innerOn) { cloneInto(inner, srcInner); rewrap(inner, cols); } else inner.replaceChildren();
    inner.hidden = !innerOn;
  }
  function setSize(small) {
    const value = small ? "small" : "";
    if (pane.dataset.size === value) return false;
    pane.dataset.size = value;
    cols = small ? COLS_SMALL : COLS;
    return true;
  }

  function sync() {
    const box = document.querySelector("#vn .vn-box");
    if (!box) return;
    const srcName = box.querySelector(".vn-name"), srcNext = box.querySelector(".vn-next");
    srcText = box.querySelector(".vn-text");
    srcInner = box.querySelector(".vn-inner");

    const nameText = srcName?.classList.contains("show") ? srcName.textContent.trim() : "";
    if (name.textContent !== nameText) name.textContent = nameText;
    name.hidden = !nameText;

    const list = liveChoices();
    const sig = list.map((button) => `${button.className}|${button.getAttribute("aria-disabled")}|${button.innerHTML}`).join("\n");
    if (sig !== choiceSig) {
      choiceSig = sig;
      choices.replaceChildren(...list.map((source, index) => {
        const button = el("button.retro-choice", { type: "button", dataset: { test: `retro-choice-${index}` } });
        cloneInto(button, source);
        rewrap(button, COLS_SMALL);
        if (source.getAttribute("aria-disabled") === "true") button.setAttribute("aria-disabled", "true");
        if (source.matches(".fortune-hint, .growth-hint")) button.dataset.hint = source.classList.contains("fortune-hint") ? "fortune" : "growth";
        const label = source.getAttribute("aria-label");
        if (label) button.setAttribute("aria-label", label);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          liveChoices()[index]?.click(); // 無効（所持金不足）の判定は現行のボタンが行う
        });
        return button;
      }));
      choices.scrollTop = 0;
    }
    choices.hidden = !list.length;
    const choosing = String(list.length > 0);
    if (pane.dataset.choosing !== choosing) pane.dataset.choosing = choosing;

    innerOn = !!srcInner && !srcInner.hidden && !!srcInner.textContent;
    const html = srcText?.innerHTML ?? "", innerHtml = innerOn ? srcInner.innerHTML : "";
    const changed = html !== textSig || innerHtml !== innerSig;
    textSig = html; innerSig = innerHtml;
    // 文字は 16 ドット（14 字 × 5 行）。収まらない時と選択肢が出ている間だけ 12 ドットへ落とす。
    // 同じページの文字送りの間は、いったん落とした大きさを戻さない（途中で字の大きさが行き来しないように）。
    const plain = (srcText?.textContent || "") + (innerOn ? srcInner.textContent : "");
    const growing = grown !== "" && plain.startsWith(grown);
    grown = plain;
    const keepSmall = list.length > 0 || (growing && pane.dataset.size === "small");
    if (setSize(keepSmall) || changed) {
      renderText();
      if (!keepSmall && win.scrollHeight > win.clientHeight + 1 && setSize(true)) renderText();
    }
    next.hidden = !srcNext?.classList.contains("show");
    const kind = box.classList.contains("reward") ? "reward" : box.classList.contains("thought") ? "thought" : box.classList.contains("narration") ? "narration" : "";
    if (pane.dataset.kind !== kind) pane.dataset.kind = kind;

    // 本体のボタン: 現行の操作バー（AUTO・SKIP・LOG・用語・設定）をそのまま写す。
    const controls = [...document.querySelectorAll("#vn .vn-controls button.vn-ctl[data-test]")];
    shell.setKeys(controls.map((button) => ({
      id: button.dataset.test, label: button.textContent.trim(),
      pressed: button.hasAttribute("aria-pressed") ? button.getAttribute("aria-pressed") === "true" : null,
      run: () => document.querySelector(`#vn .vn-controls button.vn-ctl[data-test="${button.dataset.test}"]`)?.click(),
    })));

    const hud = readHud();
    shell.setStatus(hud?.day ? `DAY ${hud.day} ・ ${hud.night ? "夜" : "昼"}` : "", hud?.area || "");
    shell.setCaption("");
  }

  return {
    pane,
    sync,
    paint: (now) => painter.paintVn(now),
    tapTop: advance,
    enter() { textSig = innerSig = null; choiceSig = "\u0000"; grown = ""; },
    leave() {},
  };
}
