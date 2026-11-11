// DS風の外枠（上画面の canvas・下画面・本体のボタン）。見た目は css/look-retro.css。
// 1ドット = --dpx。2画面は必ず 4:3（256×192）で、「幅いっぱい」か「高さに収まる最大」の小さい方に合わせる。
import { el } from "../../core/util.js";

export const SCREEN_W = 256, SCREEN_H = 192;
// 外枠の寸法（ドット）。幅は画面 256 + 左右の縁、高さは 状態の行 + 画面2枚 + 継ぎ目 + 本体のボタン の最小構成。
const DEVICE_W = 268, DEVICE_MIN_H = 458, BRAND_H = 20;

export function createShell() {
  const canvas = el("canvas.retro-canvas", { width: SCREEN_W, height: SCREEN_H, "aria-hidden": "true" });
  const statusL = el("span.retro-status-l"), statusR = el("span.retro-status-r");
  const maphead = el("div.retro-maphead", { hidden: true });
  const markers = el("div.retro-markers", { hidden: true });
  const notices = el("div.retro-notices", { role: "status" });
  const caption = el("div.retro-caption", { hidden: true });
  const top = el("div.retro-screen.retro-top", { dataset: { test: "retro-top" } }, [
    canvas, el("div.retro-top-ui", [markers, maphead, caption, notices]),
  ]);
  const bottom = el("div.retro-screen.retro-bottom", { dataset: { test: "retro-bottom" } });
  const keys = el("div.retro-keys");
  const brand = el("div.retro-brand", { text: "水煙前線 -EN:CODE-", "aria-hidden": "true" });
  const device = el("div.retro-device", [
    el("div.retro-status", [statusL, statusR]),
    top,
    el("div.retro-hinge", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]),
    bottom,
    keys,
    brand,
  ]);
  const root = el("div.retro-shell", { hidden: true, dataset: { test: "retro-shell", scene: "" } }, [device]);
  const note = el("div.retro-note", { hidden: true, role: "status", dataset: { test: "retro-note" } });

  /** 画面（ノッチ・ホームバーを除いた内側）に収まる最大の 1ドットを決める。 */
  function layout() {
    if (!root.isConnected) return;
    const cs = getComputedStyle(root);
    const pad = (side) => parseFloat(cs[`padding${side}`]) || 0;
    const viewport = window.visualViewport;
    const fullW = viewport?.width > 0 ? Math.min(viewport.width, window.innerWidth) : window.innerWidth;
    const fullH = viewport?.height > 0 ? Math.min(viewport.height, window.innerHeight) : window.innerHeight;
    const w = Math.max(1, fullW - pad("Left") - pad("Right"));
    const h = Math.max(1, fullH - pad("Top") - pad("Bottom"));
    const dpx = Math.max(0.5, Math.min(w / DEVICE_W, h / DEVICE_MIN_H));
    const slack = Math.max(0, h / dpx - DEVICE_MIN_H);
    root.style.setProperty("--dpx", `${dpx.toFixed(4)}px`);
    root.style.setProperty("--slack", slack.toFixed(2));
    brand.hidden = slack < BRAND_H + 8;
  }

  /** 状態の行（左・右）。 */
  function setStatus(left, right) {
    if (statusL.textContent !== left) statusL.textContent = left;
    if (statusR.textContent !== right) statusR.textContent = right;
  }

  /** 本体のボタンを並べ直す。items: [{ id, label, pressed, badge, disabled, run }]。同じ並びなら状態だけ更新する。 */
  let keySig = "";
  const keyRuns = new Map();
  function setKeys(items) {
    const sig = items.map((item) => item.id).join("|");
    if (sig !== keySig) {
      keySig = sig;
      keys.replaceChildren(...items.map((item) => el("button.retro-key", {
        type: "button", dataset: { key: item.id, test: `retro-key-${item.id}` },
        onclick: (event) => { event.stopPropagation(); keyRuns.get(item.id)?.(); },
      }, [el("span.retro-key-label"), el("span.retro-key-badge", { hidden: true })])));
    }
    keyRuns.clear();
    items.forEach((item, i) => {
      const button = keys.children[i];
      keyRuns.set(item.id, item.run);
      const label = button.firstElementChild, badge = button.lastElementChild;
      if (label.textContent !== item.label) label.textContent = item.label;
      if (item.pressed == null) button.removeAttribute("aria-pressed");
      else if (button.getAttribute("aria-pressed") !== String(!!item.pressed)) button.setAttribute("aria-pressed", String(!!item.pressed));
      const badgeText = item.badge ? String(item.badge) : "";
      if (badge.textContent !== badgeText) badge.textContent = badgeText;
      badge.hidden = !badgeText;
      button.disabled = !!item.disabled;
      const name = item.name || item.label;
      if (button.getAttribute("aria-label") !== name) button.setAttribute("aria-label", name);
    });
  }

  /** 上画面に重ねる知らせ（トースト・報酬の文字）。 */
  let noticeSig = "";
  function setNotices(lines) {
    const list = lines.filter(Boolean).slice(-3);
    const sig = list.join("\n");
    if (sig === noticeSig) return;
    noticeSig = sig;
    notices.replaceChildren(...list.map((text) => el("div.retro-notice", { text })));
  }

  /** 上画面の下端の一言（地図の案内など）。head は金色の見出し。 */
  let captionSig = "";
  function setCaption(text, head = "") {
    const sig = `${head}\n${text}`;
    if (sig === captionSig) return;
    captionSig = sig;
    caption.replaceChildren(...[head ? el("b", { text: head }) : null, text].filter(Boolean));
    caption.hidden = !text && !head;
  }

  return {
    root, note, canvas, top, bottom, maphead, markers, layout, setStatus, setKeys, setNotices, setCaption,
    mount() { document.body.append(root, note); layout(); },
    unmount() { root.remove(); note.remove(); },
  };
}
