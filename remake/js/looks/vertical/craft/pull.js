// SVG の use で本編の針と成功帯を参照する。縦側には別の時計を持たない。
import { el } from "../../../core/util.js";
import { setText } from "../../../core/dom-write.js";

export const pullView = {
  id: "pull", step: "pull", intro: true,
  match: panel => !!panel.querySelector(".pull, :scope > .result-card"),
  create({ relay }) {
    const art = new URL("previews/portrait-stage/img/", document.baseURI);
    const pic = el("div.vtc-pull-art", ["hold", "rest"].map((pose, i) =>
      el("img." + pose, { src: new URL(i ? "craft-pull-hajime-exhale.webp" : "craft-pull-hajime.webp", art).href, alt: "" })));
    const gauge = el("div.vtc-pull-dial", { html: '<svg viewBox="0 0 480 240" aria-hidden="true"><use/></svg>' });
    const status = el("div.vtc-pull-status");
    const actions = el("div.vtc-pull-actions");
    const ctrl = el("div.vtc-pull-controls", [gauge, status, actions]);
    let panel, buttons = [], sourceDial;
    return {
      pic, ctrl,
      coach: bench => bench.querySelector(".bench-hint")?.textContent || "",
      thermo: () => ({ node: panel?.querySelector(".pull .thermo"), mode: "live" }),
      sync(next) {
        panel = next;
        const play = panel.querySelector(".pull-play");
        if (!play) return;
        const dial = play.querySelector(".pull-dial > svg");
        if (sourceDial !== dial) {
          sourceDial = dial;
          dial.id = "vt-source-" + dial.querySelector("linearGradient").id;
          gauge.querySelector("use").setAttribute("href", "#" + dial.id);
          buttons = [...play.querySelectorAll(".pull-btns button")].map(source => {
            const timed = source.dataset.test === "pull-stop" || source.dataset.test === "pull-deep";
            const available = () => source.isConnected && !source.disabled && !panel.inert;
            const button = el("button.vtc-bench-button", { type: "button", dataset: { test: "vt-" + source.dataset.test },
              onclick: event => {
                if ((!timed || event.detail === 0) && available()) relay(source);
              } });
            if (timed) button.addEventListener("pointerdown", event => {
              if (event.button === 0 && available()) { event.preventDefault(); relay(source); }
            });
            return { source, button };
          });
          actions.replaceChildren(...buttons.map(item => item.button));
        }
        pic.classList.toggle("drawing", !!play.dataset.draw);
        setText(status, [play.querySelector(".pull-current-zone > b"), play.querySelector(".pull-count-num"),
          play.querySelector(".pull-destination")].map(node => node?.textContent).filter(Boolean).join("　"));
        for (const { source, button } of buttons) {
          setText(button, source.textContent);
          button.disabled = source.disabled;
          if (source.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", source.getAttribute("aria-pressed"));
        }
      },
    };
  },
};
