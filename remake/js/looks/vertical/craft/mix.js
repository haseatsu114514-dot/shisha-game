// 本編の在庫と計量ボタンを、縦試作のジャンル別の棚に並べる。
import { el } from "../../../core/util.js";
import { setText } from "../../../core/dom-write.js";
import { DB } from "../../../core/data.js";
import { FLAVORS } from "../../../daily/tonari-floor-data.js";
import { GENRES } from "./art.js";

const shelfState = new WeakMap();
const redLeaves = new Set(["double_apple", "blueberry", "strawberry", "grape", "watermelon"]);
const categoryFamily = { fruit: "fruit", sweet: "sweet", cooling: "fresh", spice: "fresh", floral: "deep" };
const art = new URL("previews/portrait-stage/img/", document.baseURI);
const image = (cls, name) => el("img." + cls, { src: new URL(name + ".webp", art).href, alt: "" });
function genre(id, named) {
  const { name, icon, color } = GENRES[id];
  return el(named ? "button.vtc-genre" : "i.vtc-genre", { type: named ? "button" : null,
    "aria-label": name, title: name, style: { "--g": color },
    html: '<svg aria-hidden="true" viewBox="0 0 24 24">' + icon + "</svg>" + (named ? "<b>" + name + "</b>" : "") });
}

// 商品画像の元の切り出し範囲を保ち、棚の高さに合わせて拡縮する。
function packageCrop(row) {
  const source = row.querySelector(".fr-package img");
  if (!source) return row.querySelector(".fr-package").cloneNode(true);
  const w = parseFloat(source.parentElement.style.width), h = parseFloat(source.parentElement.style.height);
  const pct = (prop, size) => (parseFloat(source.style[prop]) / size * 100) + "%";
  const picture = el("img", { src: source.src, alt: "", style: { width: pct("width", w), height: pct("height", h),
    left: pct("left", w), top: pct("top", h) } });
  return el("span.fr-package", [el("span.vtc-packet", { style: { aspectRatio: w + " / " + h } }, [picture])]);
}
export const mixView = {
  id: "mix", step: "mix", intro: true,
  match: panel => !!panel.querySelector(".mix"),
  create({ relay, hold }) {
    const layers = ["empty", "partial-brown", "partial", "normal-brown", "normal"].map(s => image("vtc-scale-bowl", "ui-bowl-" + s));
    const grams = el("b.vtc-scale-digits", { text: "0.0g" });
    const pic = el("div.vtc-scale", [image("vtc-scale-base", "ui-scale"), ...layers, grams]);
    const shelf = el("div.vtc-leaves"), genres = el("div.vtc-genres");
    const selected = el("div.vtc-mix-selected");
    const reg = el("span.vtc-mix-reg");
    const ok = el("button.vtc-mix-ok", { type: "button", text: "決定", disabled: true, dataset: { test: "vt-mix-ok" } });
    const details = el("details.vtc-mix-notes", [el("summary", { text: "配合メモ" })]);
    const ctrl = el("div.vtc-mix-controls", [genres, shelf, el("div.vtc-mix-footer", [selected, ok]), details]);
    let panel, selection, rows = [], chosen, sort;
    const extras = [], holds = [];
    const available = source => source?.isConnected && !source.disabled && !source.closest("[inert]");
    function proxy(source, repeat = false) {
      const button = el("button.vtc-bench-button", { type: "button", text: source.textContent,
        "aria-label": source.getAttribute("aria-label"), dataset: { test: "vt-" + source.dataset.test },
        onclick: event => {
          if (!available(source)) return;
          if (repeat) source.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: event.detail }));
          else relay(source);
        } });
      if (repeat) holds.push(hold(button, () => available(source) ? source : null, () => {
        if (available(source)) source.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      }));
      return button;
    }
    function select(item) {
      chosen?.tile.setAttribute("aria-pressed", "false");
      chosen = item;
      selection.flavor = item.id;
      item.tile.setAttribute("aria-pressed", "true");
      selected.replaceChildren(item.info, item.minus, item.amount, item.plus);
    }
    function sortBy(id) {
      sort = id;
      if (selection) selection.genre = id;
      for (const chip of genres.children) chip.setAttribute("aria-pressed", String(chip.dataset.genre === id));
      for (const item of rows) {
        const dim = !!id && !item.families.includes(id);
        item.tile.style.order = dim ? 1 : 0;
        item.tile.classList.toggle("dim", dim);
      }
      shelf.scrollTop = 0;
    }
    for (const id of Object.keys(GENRES)) {
      const chip = genre(id, true);
      chip.dataset.genre = id;
      chip.setAttribute("aria-pressed", "false");
      chip.onclick = () => sortBy(sort === id ? null : id);
      genres.append(chip);
    }
    ok.onclick = () => { const source = panel?.querySelector('[data-test="mix-ok"]'); if (available(source)) relay(source); };
    return { pic, ctrl, spots: { shelf, selected, ok },
      leave() { holds.forEach(h => h.end()); },
      coach: bench => bench.querySelector(".bench-hint")?.textContent || "",
      thermo: () => ({ node: panel?.querySelector(".mix-temperature-preview .thermo"), mode: "bands" }),
      sync(next) {
        panel = next;
        const live = panel.querySelector(".mix");
        if (!live) return;
        if (!rows.length) {
          for (const source of live.querySelectorAll(".mix-list-head button")) {
            const button = proxy(source);
            extras.push({ source, button });
            details.append(button);
          }
          details.append(reg);
          rows = [...live.querySelectorAll(".flavor-row")].map(row => {
            const id = row.dataset.flavor, f = FLAVORS[id];
            const family = categoryFamily[DB.flavorById[id]?.category];
            const families = f ? [f.family, ...f.also] : family ? [family] : [];
            if (id === "double_apple") families.push("fruit");
            const name = f?.full || row.querySelector(".fr-feature b").textContent;
            const pack = packageCrop(row);
            const badge = el("b.vtc-leaf-grams");
            const tile = el("button.vtc-leaf", { type: "button", "aria-label": name, "aria-pressed": "false",
              dataset: { test: "vt-mix-select-" + id } }, [pack, el("span", { text: name }), el("span.vtc-leaf-tags", families.map(key => genre(key, false))), badge]);
            const info = proxy(row.querySelector(".fr-feature"));
            const note = row.querySelector(".fr-reg, .fr-stock, .fr-name > small");
            if (note) info.append(el("small", { text: note.textContent }));
            const [minus, plus] = [...row.querySelectorAll(".fr-btn")].map(source => proxy(source, true));
            const item = { id, families, tile, info, minus, plus, badge, amount: el("b"), liveAmount: row.querySelector(".fr-g") };
            tile.onclick = () => select(item);
            return item;
          });
          // 少ないうちは1段の大きな箱、増えたら2段、11種以上は5列のままスクロールする。
          const count = rows.length;
          shelf.dataset.size = count <= 3 ? "large" : count <= 8 ? "medium" : "compact";
          const columns = count <= 3 ? Math.max(1, count) : Math.min(5, Math.ceil(count / 2));
          shelf.style.setProperty("--shelf-columns", columns);
          shelf.replaceChildren(...rows.map(r => r.tile));
          selection = shelfState.get(live) || {};
          shelfState.set(live, selection);
          if (rows.length) select(rows.find(item => item.id === selection.flavor) || rows[0]);
          sortBy(selection.genre || null);
        }
        let red = 0;
        for (const item of rows) {
          const amount = item.liveAmount.textContent;
          setText(item.amount, amount);
          setText(item.badge, parseFloat(amount) ? amount : "");
          if (redLeaves.has(item.id)) red += parseFloat(amount);
        }
        for (const { source, button } of extras) {
          button.disabled = source.disabled;
          if (source.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", source.getAttribute("aria-pressed"));
        }
        const lcd = live.querySelector(".lcd").textContent;
        const [total, cap] = lcd.split("/").map(parseFloat);
        const fill = total / cap, redRatio = total ? red / total : 0;
        const alpha = v => Math.max(0, Math.min(1, v));
        const partial = alpha((fill - .05) / .35), full = alpha((fill - .5) / .5);
        [1, partial, partial * redRatio, full, full * redRatio].forEach((a, i) => { layers[i].style.opacity = a.toFixed(2); });
        setText(grams, `${total.toFixed(1)}g`);
        const rule = live.querySelector(".reg-line").textContent;
        setText(reg, lcd + "　" + rule);
        const source = live.querySelector('[data-test="mix-ok"]');
        ok.disabled = source.disabled;
        ok.title = source.textContent;
      },
    };
  },
};
