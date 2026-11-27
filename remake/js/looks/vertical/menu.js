// 縦画面「煙の舞台」: ボタンが並ぶだけの画面（tonari の行動選びなど daily/tonari.js の .sub-menu、文と選択肢だけの確かめの小窓、
// 第2章以降の場面カード・店頭カード）。上の絵はその場の背景のまま、下に問いのテロップと返事と同じ札を並べる。
// 押したら本編のボタンへの click として中継する（判定・消費・進行は本編のまま）。
import { el } from "../../core/util.js";
import { mirrorBackground, textOf, shown, placeOf } from "./frame.js";
import { readHud } from "../retro/hud.js";

/** いま写す画面と、その中の部品の読み方（looks/retro/menu.js と同じ見分け）。 */
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

function choicesOf(menu) {
  if (!menu) return [];
  const pick = (selector) => [...menu.root.querySelectorAll(selector)].filter(shown);
  if (menu.kind === "sub") return pick(".sub-choices .big-choice");
  if (menu.kind === "dialog") return pick(":scope > .modal-actions > button");
  if (menu.kind === "stop") return pick(".ch2-actions button");
  return [...pick(".ch3-wayfinding .ch3-wayfinding-map"), ...pick(":scope > .ch2-contest-actions button")];
}

function wordsOf(menu) {
  const root = menu.root;
  if (menu.kind === "sub") return { title: textOf(root.querySelector(".sub-title")), lead: textOf(root.querySelector(".sub-lead")) };
  if (menu.kind === "dialog") return { title: textOf(root.querySelector(":scope > h3")), lead: textOf(root.querySelector(":scope > .modal-body")) };
  if (menu.kind === "stop") {
    const card = root.querySelector(".ch2-stop-card");
    return { title: textOf(card?.querySelector("h1")), lead: [...(card?.querySelectorAll(":scope > p:not(.ch2-kicker)") || [])].map(textOf).filter(Boolean).join(" ") };
  }
  return { title: textOf(root.querySelector(".ch2-contest-header h1")), lead: textOf(root.querySelector(":scope > .ch2-contest-description")) };
}

export function createMenuScene(frame) {
  const bg = el("div.vt-bg");
  const name = el("div.vt-name.place");
  const lead = el("p.vt-text");
  const glass = el("div.vt-glass.ask", [lead]);
  const choices = el("div.vt-choices", { dataset: { test: "vt-menu-choices" } });
  let pick = 0, sig = "";

  const usable = (button) => !!button && !button.disabled && button.getAttribute("aria-disabled") !== "true";
  function renderPick() {
    for (const node of choices.children) node.setAttribute("aria-current", String(Number(node.dataset.index) === pick));
  }
  choices.addEventListener("click", (event) => {
    const node = event.target.closest(".vt-choice");
    if (!node) return;
    event.stopPropagation();
    pick = Number(node.dataset.index);
    const live = choicesOf(liveMenu())[pick];
    if (usable(live)) live.click(); else renderPick();
  });

  function sync() {
    const menu = liveMenu();
    if (!menu) return;
    const list = choicesOf(menu);
    const words = wordsOf(menu);
    const next = `${menu.kind}\n${words.title}\n${words.lead}\n${list.map((b) => `${b.dataset.test}|${b.disabled}|${b.className}|${b.textContent}`).join("\n")}`;
    if (next !== sig) {
      sig = next;
      pick = Math.max(0, list.findIndex(usable));
      name.innerHTML = "<b></b>";
      name.querySelector("b").textContent = words.title;
      name.hidden = !words.title;
      lead.textContent = words.lead;
      glass.hidden = !words.lead;
      choices.replaceChildren(...list.map((button, index) => {
        const label = textOf(button.querySelector("b")) || textOf(button);
        const sub = textOf(button.querySelector("small"));
        return el(`button.vt-choice${button.classList.contains("primary") ? ".primary" : ""}`, {
          type: "button", style: { "--i": String(index) }, "aria-disabled": usable(button) ? null : "true",
          dataset: { index: String(index), test: `vt-${button.dataset.test || `option-${index}`}` },
        }, [el("i"), el("span", [el("b", { text: label }), sub ? el("small", { text: sub }) : null])]);
      }));
      renderPick();
    }
    const url = mirrorBackground(bg);
    frame.setAmbient(url);
    frame.root.dataset.menu = menu.kind;
    const back = menu.kind === "sub" ? menu.root.querySelector(".sub-back") : null;
    const hud = readHud();
    frame.setChips([
      back ? { id: "back", icon: "back", label: "もどる", name: textOf(back) } : null,
      menu.kind === "sub" && shown(document.querySelector("#hud .hud-lime")) ? { id: "lime", icon: "chat", label: "LIME", badge: hud?.unread || "" } : null,
      menu.kind === "sub" && shown(document.querySelector("#hud .hud-menu")) ? { id: "menu", icon: "menu", label: "MENU", badge: hud?.hidane || "" } : null,
    ].filter(Boolean));
    frame.setPad({ dirs: list.length > 1 ? ["up", "down"] : [], a: { face: "ok", disabled: !usable(list[pick]) } });
    frame.setHud("place", { place: menu.kind === "sub" ? placeOf(url) : "" });
  }

  function move(by) {
    const list = choicesOf(liveMenu());
    if (!list.length) return;
    pick = (pick + by + list.length) % list.length;
    renderPick();
    sync();
  }

  return {
    name: "menu",
    enter() {
      frame.picture.dataset.kind = "stage";
      frame.picture.append(bg);
      frame.telop.append(name, glass, choices);
      sig = "\u0000"; bg.dataset.sig = "";
    },
    leave() { delete frame.root.dataset.menu; },
    sync,
    dir(dir) { if (dir === "up") move(-1); else if (dir === "down") move(1); },
    a() { const live = choicesOf(liveMenu())[pick]; if (usable(live)) live.click(); },
    chip(id) {
      if (id === "back") liveMenu()?.root.querySelector(".sub-back")?.click();
      else if (id === "lime") document.querySelector("#hud .hud-lime")?.click();
      else if (id === "menu") document.querySelector("#hud .hud-menu")?.click();
    },
    tap() {},
  };
}
