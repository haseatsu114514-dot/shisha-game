// DS風の外枠（上画面の canvas・下画面・本体のボタン）。見た目は css/look-retro.css。
// 1ドット = --dpx。2画面は必ず 4:3（256×192）で、「幅いっぱい」か「高さに収まる最大」の小さい方に合わせる。
// ドットを均一にするため、1ドットが実機の画素の整数倍になる大きさを優先する（layout）。
import { el } from "../../core/util.js";

export const SCREEN_W = 256, SCREEN_H = 192;
// 外枠の寸法（ドット）。幅は画面 256 + 左右の縁、高さは 状態の行 + 画面2枚 + 継ぎ目 + 本体のボタン の最小構成。
const DEVICE_W = 268, DEVICE_MIN_H = 458, BRAND_H = 20;
// 整数倍へそろえる時に許す幅の損。スマホは 1 割まで。PC は窓が大きいので 2 割 5 分まで（均一なドットを優先する）。
const LOSS_TOUCH = 0.1, LOSS_DESKTOP = 0.25;

/**
 * paint: "dot"（DS風。1ドット＝実機の画素の整数倍にそろえる）／"hd"（新版の縦持ち。上画面は高解像度の絵で、
 * 大きさは幅いっぱい（または高さに収まる最大）のまま。canvas の裏画面は CSS の大きさ × devicePixelRatio）。
 */
export function createShell({ paint = "dot" } = {}) {
  const hd = paint === "hd";
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
  const root = el("div.retro-shell", { hidden: true, dataset: { test: "retro-shell", scene: "", paint } }, [device]);
  const note = el("div.retro-note", { hidden: true, role: "status", dataset: { test: "retro-note" } });

  let dotScale = 1; // 1ドットが実機の何画素か（高解像度の描き方が、顔のアイコンなどの大きさを決めるのに使う）

  /**
   * 画面（ノッチ・ホームバーを除いた内側）に収まる 1ドットの大きさを決め、外枠を置く。
   * 1ドット＝実機の画素の整数 n 個にできる時は、上画面の canvas を 256n×192n の裏画面にして、CSS の大きさと 1:1 にそろえる
   * （image-rendering に頼らずにドットが均一になる）。外枠の位置も実機の画素の境目へ合わせる。
   * 整数にすると小さくなりすぎる端末だけ、幅いっぱい＋image-rendering: pixelated（裏画面は 256×192）。
   * 戻り値は canvas の大きさを変えたかどうか（変えたら描き直す）。
   */
  function layout() {
    if (!root.isConnected) return false;
    const cs = getComputedStyle(root);
    const pad = (side) => parseFloat(cs[`padding${side}`]) || 0;
    const viewport = window.visualViewport;
    const fullW = viewport?.width > 0 ? Math.min(viewport.width, window.innerWidth) : window.innerWidth;
    const fullH = viewport?.height > 0 ? Math.min(viewport.height, window.innerHeight) : window.innerHeight;
    const w = Math.max(1, fullW - pad("Left") - pad("Right"));
    const h = Math.max(1, fullH - pad("Top") - pad("Bottom"));
    const ratio = window.devicePixelRatio || 1;
    const ideal = Math.max(0.5, Math.min(w / DEVICE_W, h / DEVICE_MIN_H));
    const exact = ideal * ratio, down = Math.floor(exact + 1e-4), up = down + 1;
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    let n = 0;
    // 切り上げても2画面と本体のボタンが収まるなら大きい方、そうでなければ切り下げ（損が許す範囲の時だけ）
    if (hd) n = 0;
    else if (up / ratio * SCREEN_W <= w - 4 && up / ratio * DEVICE_MIN_H <= h) n = up;
    else if (down >= 1 && down >= exact * (1 - (touch ? LOSS_TOUCH : LOSS_DESKTOP))) n = down;
    const dpx = n ? n / ratio : ideal;
    const slack = Math.max(0, h / dpx - DEVICE_MIN_H);
    // 余った高さは、行の間・継ぎ目・本体のボタンへ整数ドットで配る（画面の位置が画素の境目からずれないように）
    const gaps = {
      status: 5 + Math.min(4, Math.floor(slack * 0.04)),
      hinge: 13 + Math.min(5, Math.floor(slack * 0.05)),
      keys: 27 + Math.min(9, Math.floor(slack * 0.1)),
      "keys-gap": 9 + Math.min(10, Math.floor(slack * 0.12)),
      "brand-gap": 5 + Math.min(12, Math.floor(slack * 0.1)),
    };
    brand.hidden = slack < BRAND_H + 8;
    const height = 13 + gaps.status + SCREEN_H + gaps.hinge + SCREEN_H + gaps["keys-gap"] + gaps.keys + 3 + (brand.hidden ? 0 : gaps["brand-gap"] + 8);
    const snap = (value) => (n ? Math.round(value * ratio) / ratio : value);
    root.style.setProperty("--dpx", `${dpx.toFixed(6)}px`);
    for (const [name, dots] of Object.entries(gaps)) root.style.setProperty(`--gap-${name}`, String(dots));
    device.style.left = `${snap(pad("Left") + (w - DEVICE_W * dpx) / 2)}px`;
    device.style.top = `${snap(pad("Top") + Math.max(0, (h - height * dpx) / 2))}px`;
    root.dataset.pixel = hd ? "hd" : n ? "integer" : "fit";
    dotScale = dpx * ratio;
    let width = SCREEN_W * (n || 1), tall = SCREEN_H * (n || 1);
    if (hd) {
      // 高解像度: 裏画面を実機の画素の大きさにする（CSS の大きさ × devicePixelRatio）
      width = Math.max(SCREEN_W, Math.round(SCREEN_W * dpx * ratio));
      tall = Math.max(SCREEN_H, Math.round(SCREEN_H * dpx * ratio));
      delete canvas.dataset.scale;
    } else canvas.dataset.scale = String(n || 1);
    if (canvas.width === width && canvas.height === tall) return false;
    canvas.width = width; canvas.height = tall;
    return true;
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
    root, note, canvas, top, bottom, maphead, markers, layout, setStatus, setKeys, setNotices, setCaption, paint,
    dotScale: () => dotScale,
    mount() { document.body.append(root, note); layout(); },
    unmount() { root.remove(); note.remove(); },
  };
}
