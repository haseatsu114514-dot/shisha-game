// ボタンが並ぶだけの画面（tonari の行動選びなど。daily/tonari.js の .sub-menu）。
// 上画面にその場所の背景と一言、下画面にボタンの一覧を出し、押したら現行のボタンへの click として中継する。
import { el } from "../../core/util.js";
import { readHud } from "./hud.js";

const text = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";
const STAGE_W = 1280;
const VIEW = Object.freeze({ x: Math.round((STAGE_W - 640 * 4 / 3) / 2), y: 0, w: Math.round(640 * 4 / 3 * 10) / 10, h: 640 });

export function createMenuScene(shell, painter) {
  const list = el("div.retro-list.retro-menu-list", { dataset: { test: "retro-menu-list" } });
  const pane = el("div.retro-pane.retro-map.retro-submenu", { hidden: true, dataset: { test: "retro-menu" } }, [list]);
  const liveMenu = () => document.querySelector("#screen > .sub-menu:not(.done)");
  const liveChoices = () => [...(liveMenu()?.querySelectorAll(".sub-choices .big-choice") || [])];
  let sig = "";

  function sync() {
    const menu = liveMenu();
    if (!menu) return;
    const choices = liveChoices();
    const next = choices.map((button) => `${button.dataset.test}|${button.disabled}|${button.textContent}`).join("\n");
    if (next !== sig) {
      sig = next;
      list.replaceChildren(...choices.map((button, index) => el("button.retro-option", {
        type: "button", disabled: button.disabled, dataset: { test: `retro-${button.dataset.test || `option-${index}`}` },
        onclick: () => liveChoices()[index]?.click(),
      }, [el("b", { text: text(button.querySelector("b")) || text(button) }), el("small", { text: text(button.querySelector("small")) })])));
      list.scrollTop = 0;
    }
    const hud = readHud();
    shell.setStatus(text(menu.querySelector(".sub-title")), hud?.day ? `DAY ${hud.day} ・ ${hud.night ? "夜" : "昼"}` : "");
    shell.setCaption(text(menu.querySelector(".sub-lead")));
    const back = menu.querySelector(".sub-back");
    shell.setKeys([
      ...(back ? [{ id: "back", label: "もどる", name: text(back), run: () => liveMenu()?.querySelector(".sub-back")?.click() }] : []),
      { id: "lime", label: "LIME", badge: hud?.unread, run: () => document.querySelector('[data-test="hud-phone"]')?.click() },
      { id: "menu", label: "MENU", badge: hud?.hidane, run: () => document.querySelector('[data-test="hud-menu"]')?.click() },
    ]);
  }

  return {
    pane,
    sync,
    paint: (now) => painter.paintMap(now, VIEW, false),
    enter() { sig = "\u0000"; },
    leave() {},
  };
}
