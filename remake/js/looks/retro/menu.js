// ボタンが並ぶだけの画面。上画面にその場所の背景と一言、下画面にボタンの一覧を出し、押したら現行のボタンへの click として中継する。
// 写せる画面（retro/detect.js が見分ける）:
//   tonari の行動選びなど（daily/tonari.js の .sub-menu）
//   第3〜5章の場面カード・大会の案内カード（main.ch2-contest）、第2章の店頭カード（main.ch2-stop）
//   文と選択肢だけの確かめの小窓（core/ui.js の modal。#modal の .modal-box）
//   どれも DS風・新版の縦持ちの両方で写す（LK21）
import { el } from "../../core/util.js";
import { readHud } from "./hud.js";

const text = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";
const STAGE_W = 1280;
const VIEW = Object.freeze({ x: Math.round((STAGE_W - 640 * 4 / 3) / 2), y: 0, w: Math.round(640 * 4 / 3 * 10) / 10, h: 640 });
const shown = (node) => !!node && node.getClientRects().length > 0;
/** これより長い説明は、上画面の一言ではなく下画面の一覧の先頭に出す（字数） */
const LONG_LEAD = 90;

/** いま写す画面と、その中の部品の読み方。 */
function liveMenu() {
  const dialog = document.querySelector("#modal.show > .modal-box");
  if (dialog) return { kind: "dialog", root: dialog };
  const live = document.querySelector("#screen > :not(.done)");
  if (!live) return null;
  if (live.matches(".sub-menu")) return { kind: "sub", root: live };
  if (live.matches("main.ch2-contest")) return { kind: "card", root: live };
  if (live.matches("main.ch2-stop")) return { kind: "stop", root: live };
  return null;
}

/** 押せるボタンの一覧（並びは画面の順）。 */
function choicesOf(menu) {
  if (!menu) return [];
  const pick = (selector) => [...menu.root.querySelectorAll(selector)].filter(shown);
  if (menu.kind === "sub") return pick(".sub-choices .big-choice");
  if (menu.kind === "dialog") return pick(":scope > .modal-actions > button");
  if (menu.kind === "stop") return pick(".ch2-actions button");
  // 場面カード: 行程の「東京の地図」と、下の操作のボタン
  return [...pick(".ch3-wayfinding .ch3-wayfinding-map"), ...pick(":scope > .ch2-contest-actions button")];
}

/** 画面の見出し・一言（上画面の下端に出す）・下画面の右上の印。 */
function wordsOf(menu) {
  const root = menu.root;
  if (menu.kind === "sub") return { title: text(root.querySelector(".sub-title")), lead: text(root.querySelector(".sub-lead")) };
  if (menu.kind === "dialog") return { title: text(root.querySelector(":scope > h3")) || "確認", lead: text(root.querySelector(":scope > .modal-body")) };
  if (menu.kind === "stop") {
    const card = root.querySelector(".ch2-stop-card");
    return { title: text(card?.querySelector("h1")), lead: [...(card?.querySelectorAll(":scope > p:not(.ch2-kicker)") || [])].map(text).filter(Boolean).join(" ") };
  }
  const next = root.querySelector(".ch3-wayfinding-stop.next");
  return {
    title: text(root.querySelector(".ch2-contest-header h1")),
    lead: [
      text(root.querySelector(":scope > .ch2-contest-description")),
      ...[...root.querySelectorAll(":scope > .ch2-contest-reason p, :scope > .ch2-contest-note")].map(text),
      next ? `つぎ：${text(next.querySelector("strong"))}（${text(next.querySelector("span"))}）` : "",
    ].filter(Boolean).join(" "),
  };
}

export function createMenuScene(shell, painter) {
  const list = el("div.retro-list.retro-menu-list", { dataset: { test: "retro-menu-list" } });
  const pane = el("div.retro-pane.retro-map.retro-submenu", { hidden: true, dataset: { test: "retro-menu" } }, [list]);
  let sig = "", kind = "";

  function sync() {
    const menu = liveMenu();
    if (!menu) return;
    const choices = choicesOf(menu);
    const words = wordsOf(menu);
    // 長い説明（場面カード・小窓の本文）は上画面の一言に収まらないので、下画面の一覧の先頭に紙で出す（一覧と一緒に送れる）
    const longLead = menu.kind !== "sub" && [...words.lead].length > LONG_LEAD ? words.lead : "";
    const next = `${menu.kind}\n${longLead}\n${choices.map((button) => `${button.dataset.test}|${button.disabled}|${button.className}|${button.textContent}`).join("\n")}`;
    if (next !== sig) {
      sig = next;
      kind = menu.kind;
      pane.dataset.kind = menu.kind;
      // 選択肢が多い・長い時・長い説明を先頭に出す時は、字を 12 ドットにして一覧に収める（tonari の行動選びは今のまま）
      const long = choices.some((button) => [...(text(button.querySelector("b")) || text(button))].length > 12);
      pane.dataset.dense = String(menu.kind !== "sub" && (choices.length > 3 || long || !!longLead));
      const lead = longLead ? [el("p.retro-menu-lead", { text: longLead, dataset: { test: "retro-menu-lead" } })] : [];
      list.replaceChildren(...lead, ...choices.map((button, index) => {
        const label = text(button.querySelector("b")) || text(button);
        const sub = text(button.querySelector("small"));
        return el(`button.retro-option${button.classList.contains("primary") ? ".primary" : ""}`, {
          type: "button", disabled: button.disabled, dataset: { test: `retro-${button.dataset.test || `option-${index}`}` },
          onclick: () => choicesOf(liveMenu())[index]?.click(),
        }, [el("b", { text: label }), sub ? el("small", { text: sub }) : null]);
      }));
      list.scrollTop = 0;
    }
    const hud = readHud();
    const day = hud?.day ? `DAY ${hud.day} ・ ${hud.night ? "夜" : "昼"}` : "";
    shell.setStatus(words.title, menu.kind === "sub" ? day : "");
    shell.setCaption(longLead ? "" : words.lead);
    const back = menu.kind === "sub" ? menu.root.querySelector(".sub-back") : null;
    // 場面カードの右上の MENU（現行の章の MENU）。日常の画面は HUD の LIME・MENU
    const cardMenu = menu.kind === "card" ? menu.root.querySelector(".ch2-contest-header button") : null;
    const hudMenu = document.querySelector('[data-test="hud-menu"]');
    shell.setKeys([
      ...(back ? [{ id: "back", label: "もどる", name: text(back), run: () => liveMenu()?.root.querySelector(".sub-back")?.click() }] : []),
      ...(menu.kind === "sub" ? [
        { id: "lime", label: "LIME", badge: hud?.unread, run: () => document.querySelector('[data-test="hud-phone"]')?.click() },
        { id: "menu", label: "MENU", badge: hud?.hidane, run: () => document.querySelector('[data-test="hud-menu"]')?.click() },
      ] : []),
      ...(cardMenu ? [{ id: "menu", label: "MENU", run: () => liveMenu()?.root.querySelector(".ch2-contest-header button")?.click() }] : []),
      ...(menu.kind === "stop" && shown(hudMenu) ? [{ id: "menu", label: "MENU", run: () => document.querySelector('[data-test="hud-menu"]')?.click() }] : []),
    ]);
  }

  return {
    pane,
    sync,
    paint: (now) => painter.paintMap(now, VIEW, false),
    enter() { sig = "\u0000"; kind = ""; },
    leave() { delete pane.dataset.kind; delete pane.dataset.dense; list.replaceChildren(); sig = ""; },
    get kind() { return kind; },
  };
}
