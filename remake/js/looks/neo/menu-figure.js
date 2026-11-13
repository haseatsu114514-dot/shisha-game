// 新版（neo）の全画面 MENU に人物の立ち絵を置く。
//   ステータスのタブ: はじめ。人間関係のタブ: 選んだ（開いた）相手。誰も開いていなければ一覧の先頭の人。
//   持ち物・システムのタブでは出さない（面は全幅を使う）。
// MENU（daily/menu.js）の DOM は読むだけで、足すのは .dm-sheet の中の <div class="neo-figure"> ひとつだけ。
// 立ち絵の絵は会話と同じ解決（core/data.js の portraitInfo。設定の「会話の立ち絵」の画風に従う）を使う。
// 置き方・大きさ・縁のぼかしは css/look-neo.css。setActive(false) で要素と監視をすべて片付ける。
import { DB, portraitInfo, realName } from "../../core/data.js";

const FIGURE = "neo-figure";
// 立ち絵の体の高さ（ステージの高さ 720px に対する比）。会話（1.675）より少し引いて、頭から腰の下までを見せる。
const BODY = 1.5;
const TOP = 20; // 枠の上端から頭の上までの余白（px）

let active = false;
let host = null;        // #modal
let hostObserver = null;
let menu = null;        // .dmenu
let menuObserver = null;
let figure = null, picture = null, caption = null;
let shown = "";         // いま出している人の ID

/** いまのタブで見せる人の ID と名前。出さないタブでは null。 */
function subject() {
  const tab = menu.dataset.tab;
  if (tab === "status") return { id: "hajime", name: realName("hajime") };
  if (tab !== "people") return null;
  const rows = [...menu.querySelectorAll(".dm-panel .dm-person[data-person]")];
  const row = rows.find((node) => node.getAttribute("aria-expanded") === "true") || rows[0];
  return row ? { id: row.dataset.person, name: row.querySelector(".dm-name")?.textContent || "" } : null;
}

/** 立ち絵の透過の余白を除いて、頭の上を枠の上端にそろえ、体の中心を枠の中央に置く（会話の frame() と同じ考え方）。 */
function place(info) {
  // ステージは常に 1280×720 の px で組む（画面への当てはめは #stage の拡大縮小）。
  const height = Math.min(BODY * (info.scale || 1) / info.h, 2.4) * 720;
  const headroom = Math.max(0, 1 - info.b - info.h - (info.topOverhang || 0));
  picture.style.height = `${Math.round(height)}px`;
  picture.style.top = `${Math.round(TOP - height * headroom)}px`;
  picture.style.setProperty("--ax", `${-(info.ax * 100)}%`);
}

function sync() {
  if (!menu?.isConnected) return;
  const sheet = menu.querySelector(":scope > .dm-sheet");
  if (!sheet) return;
  const who = subject();
  const info = who ? portraitInfo(who.id, "normal") : null;
  if (!info) {
    figure?.classList.remove("show");
    shown = "";
    menuObserver?.takeRecords();
    return;
  }
  if (!figure) {
    picture = document.createElement("img");
    picture.alt = "";
    picture.draggable = false;
    picture.decoding = "async";
    picture.addEventListener("load", () => picture.classList.add("in"));
    // 絵が読めない時は、枠ごと出さない（面は全幅に戻る）。
    picture.addEventListener("error", () => { figure?.classList.remove("show"); shown = ""; });
    // 絵は下と左右を面に溶かす枠（-art）の中、名前はその外（溶かさない）。
    const art = document.createElement("div");
    art.className = `${FIGURE}-art`;
    art.append(picture);
    caption = document.createElement("span");
    caption.className = `${FIGURE}-name`;
    figure = document.createElement("div");
    figure.className = FIGURE;
    figure.setAttribute("aria-hidden", "true");
    figure.append(art, caption);
  }
  if (figure.parentNode !== sheet) sheet.append(figure);
  if (shown !== who.id || picture.getAttribute("src") !== info.src) {
    shown = who.id;
    figure.dataset.who = who.id;
    if (picture.getAttribute("src") !== info.src) {
      picture.classList.remove("in");
      picture.src = info.src;
      if (picture.complete && picture.naturalWidth > 0) picture.classList.add("in");
    }
    place(info);
    const color = DB.characters?.[info.folder]?.intro_cutin?.color || DB.characters?.[who.id]?.intro_cutin?.color || "";
    if (color) figure.style.setProperty("--neo-speaker", color);
    else figure.style.removeProperty("--neo-speaker");
  }
  if (caption.textContent !== who.name) caption.textContent = who.name;
  figure.classList.add("show");
  // 自分の書き換えで監視を回し続けない。
  menuObserver?.takeRecords();
}

function detach() {
  menuObserver?.disconnect();
  menuObserver = null;
  figure?.remove();
  figure = picture = caption = null;
  menu = null;
  shown = "";
}

/** #modal に MENU が開いたら絵を置き、閉じたら片付ける。 */
function attach() {
  const next = host.querySelector(":scope > .dmenu");
  if (next === menu) return;
  detach();
  if (!next) return;
  menu = next;
  menuObserver = new MutationObserver(sync);
  menuObserver.observe(menu, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-tab", "aria-expanded"] });
  sync();
}

export function setActive(on) {
  if (active === !!on) return;
  active = !!on;
  if (active) {
    host = document.getElementById("modal");
    if (!host) return;
    hostObserver = new MutationObserver(attach);
    hostObserver.observe(host, { childList: true });
    attach();
    return;
  }
  hostObserver?.disconnect();
  hostObserver = null;
  detach();
  // 閉じる動きの写し（.modal-ghost）に残った分も消す。
  document.querySelectorAll(`.${FIGURE}`).forEach((node) => node.remove());
  host = null;
}
