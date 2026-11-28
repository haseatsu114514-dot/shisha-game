// 葉・手持ち・課題と使える操作は、いま本編が並べているものを使う。
import { el } from "../../../core/util.js";
import { setText } from "../../../core/dom-write.js";

export const mixView = {
  id: "mix", step: "mix", intro: true,
  match: panel => !!panel.querySelector(".mix"),
  create({ relay, hold }) {
    const art = new URL("previews/portrait-stage/img/", document.baseURI);
    const bowl = el("img.vtc-scale-bowl", { src: new URL("ui-bowl-empty.webp", art).href, alt: "" });
    const grams = el("b.vtc-scale-digits");
    const pic = el("div.vtc-scale", [el("img.vtc-scale-base", { src: new URL("ui-scale.webp", art).href, alt: "" }), bowl, grams]);
    const shelf = el("div.vtc-leaves");
    const actions = el("div.vtc-mix-tools");
    const ok = el("button.vtc-bench-button", { type: "button", disabled: true });
    const reg = el("span");
    const ctrl = el("div.vtc-mix-controls", [shelf, el("div.vtc-mix-footer", [reg, ok])]);
    let panel, rows = [], extras = [];
    const holds = [];
    const available = source => source?.isConnected && !source.disabled && !source.closest("[inert]");
    function tap(button) {
      if (available(button)) relay(button);
    }
    ok.onclick = () => tap(panel?.querySelector('[data-test="mix-ok"]'));
    function proxy(source, repeat = false) {
      function click(detail) {
        // 本編の holdRepeat が長押し後の click を除外できるよう detail を渡す。
        if (available(source)) source.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
      }
      const button = el("button.vtc-bench-button", { type: "button", text: source.textContent,
        "aria-label": source.getAttribute("aria-label"), dataset: { test: "vt-" + source.dataset.test },
        onclick: event => {
          if (!repeat) tap(source);
          else click(event.detail);
        } });
      if (repeat) holds.push(hold(button, () => available(source) ? source : null, () => click(1)));
      return button;
    }
    return {
      pic, ctrl,
      leave() { holds.forEach(binding => binding.end()); },
      coach: bench => bench.querySelector(".bench-hint")?.textContent || "",
      thermo: () => ({ node: panel?.querySelector(".mix-temperature-preview .thermo"), mode: "bands" }),
      sync(next) {
        panel = next;
        const live = panel.querySelector(".mix");
        if (!live) return;
        if (!rows.length) {
          extras = [...live.querySelectorAll(".mix-list-head button")].map(source => ({ source, button: proxy(source) }));
          actions.replaceChildren(...extras.map(item => item.button));
          rows = [...live.querySelectorAll(".flavor-row")].map(row => {
            const amount = el("b"), info = proxy(row.querySelector(".fr-feature"));
            const image = row.querySelector(".fr-package img");
            if (image) info.prepend(el("img", { src: image.src, alt: "" }));
            const [minus, plus] = [...row.querySelectorAll(".fr-btn")].map(source => proxy(source, true));
            const note = row.querySelector(".fr-reg, .fr-stock, .fr-name > small");
            const name = el("div.vtc-leaf-name", [info, el("small", { text: note?.textContent || "" })]);
            return { row, amount, node: el("div.vtc-leaf", [name, minus, amount, plus]) };
          });
          shelf.replaceChildren(actions, ...rows.map(item => item.node));
        }
        for (const { row, amount } of rows) setText(amount, row.querySelector(".fr-g").textContent);
        for (const { source, button } of extras) {
          button.disabled = source.disabled;
          if (source.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", source.getAttribute("aria-pressed"));
        }
        const total = live.querySelector(".lcd").textContent;
        setText(grams, total.split("/")[0].trim());
        const filled = live.querySelector(".mix-vessel").dataset.filled;
        if (bowl.dataset.filled !== filled) {
          bowl.dataset.filled = filled;
          bowl.src = new URL(filled === "true" ? "ui-bowl-normal.webp" : "ui-bowl-empty.webp", art).href;
        }
        setText(reg, [total, live.querySelector(".reg-line").textContent].filter(Boolean).join("　"));
        const confirm = live.querySelector('[data-test="mix-ok"]');
        setText(ok, confirm.textContent);
        ok.disabled = confirm.disabled;
      },
    };
  },
};
