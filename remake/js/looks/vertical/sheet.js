// 縦画面「煙の舞台」: シート（全画面 MENU・LIME・小窓（設定・用語集・セーブ／ロード・規則の紙・確認の問い）・会話の LOG・店・
// LIME の初回の案内・章のクリアの画面）。DS風と同じ汎用の写し（looks/neo/portrait-shell/sheet.js: 本編の DOM を読み、押す・入力するは本編へ中継）を、
// 縦の外枠の上半分〜テロップの所に重ねて出す。見た目は css/look-vertical.css が、写しの部品（rs-*）を縦C案の色と字に置き直す。
// 本体のボタン（MENU のタブ・閉じる・もどる・店の売り場）は補助ボタンの段へ並べる。
import { el } from "../../core/util.js";
import { createSheetScene as createRetroSheet } from "../neo/portrait-shell/sheet.js";

const ICON_OF = { close: "close", back: "back", lime: "chat", "tab-status": "heart", "tab-people": "chat", "tab-items": "list", "tab-system": "gear" };

export function createSheetScene(frame) {
  // 写しの部品の規則（look-neo-portrait.css の .retro-shell .retro-sheet …）をそのまま効かせるため、入れ物に retro-shell を付ける
  const host = el("div.retro-shell.vt-sheet-host", { dataset: { paint: "hd", scene: "sheet", test: "vt-sheet-host" } });
  const top = el("div.vt-sheet-top");
  const bottom = el("div.vt-sheet-bottom");
  host.append(top, bottom);
  let keys = [], title = "";
  const adapter = {
    top, bottom,
    setStatus(left) { title = left || ""; },
    setKeys(items) { keys = items; },
    setCaption() {},
  };
  const painter = { paintCover: () => false };
  const inner = createRetroSheet(adapter, painter);
  bottom.append(inner.pane);

  function sync(state) {
    inner.sync(state);
    host.dataset.kind = inner.kind || "";
    frame.root.dataset.sheet = inner.kind || "";
    // LIME は試作どおり（VPM07・VPM10・VPN15）スマホのアプリの画面いっぱいに出し、十字キーと丸ボタンは置かない（戻る・閉じるは画面の中）
    frame.root.dataset.layout = inner.kind === "lime" ? "full" : "";
    // 「閉じる」は丸ボタンに任せる（補助ボタンの段には並べない）
    frame.setChips(keys.filter((key) => key.id !== "close").map((key) => ({
      id: key.id, icon: ICON_OF[key.id] || (key.id.startsWith("tab-") ? "dots" : key.id.startsWith("shop-") ? "list" : "dots"),
      label: key.label, on: key.pressed == null ? undefined : !!key.pressed, badge: key.badge || "", name: key.name || key.label, disabled: !!key.disabled,
    })));
    const close = keys.find((key) => key.id === "close");
    frame.setPad({ dirs: ["up", "down"], marks: {}, a: close ? { face: "close", label: "閉じる" } : null });
    frame.setHud("place", { place: title });
  }

  return {
    name: "sheet",
    enter() {
      frame.picture.dataset.kind = "stage";
      frame.over.append(host);
      frame.over.hidden = false;
      inner.pane.hidden = false;
      inner.enter();
    },
    leave() { inner.leave(); inner.pane.hidden = true; delete frame.root.dataset.sheet; frame.root.dataset.layout = ""; keys = []; },
    sync,
    dir(dir) {
      const body = host.querySelector(".rs-body");
      if (body) body.scrollBy({ top: (dir === "up" ? -1 : 1) * body.clientHeight * 0.6, behavior: "smooth" });
    },
    a() { keys.find((key) => key.id === "close")?.run?.(); },
    chip(id) { keys.find((key) => key.id === id)?.run?.(); },
    tap() {},
    get kind() { return inner.kind; },
  };
}
