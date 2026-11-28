// SVG の use で本編の針と成功帯を参照する。縦側には別の時計を持たない。
import { el } from "../../../core/util.js";
import { portraitBreath } from "../../../craft/portrait-breath.js";
import { smokeAllowed, smokeLayer } from "../../../core/smoke.js";
import { setAttr, setFlag, setText } from "../../../core/dom-write.js";

export const pullView = {
  id: "pull", step: "pull", intro: true,
  match: panel => !!panel.querySelector(".pull, :scope > .result-card"),
  create({ relay }) {
    const art = new URL("previews/portrait-stage/img/", document.baseURI);
    const pic = el("div.vtc-pull-art", ["hold", "rest"].map((pose, i) =>
      el("img." + pose, { src: new URL(i ? "craft-pull-hajime-exhale.webp" : "craft-pull-hajime.webp", art).href, alt: "" })));
    const smoke = el("div.vtc-pull-smoke");
    pic.append(smoke);
    const gauge = el("div.vtc-pull-dial", { html: '<svg viewBox="0 0 480 240" aria-hidden="true"><use/></svg>' });
    const status = el("div.vtc-pull-status");
    const life = el("span.vtc-pull-life");
    const actions = el("div.vtc-pull-actions");
    const ctrl = el("div.vtc-pull-controls", [gauge, status, life, actions]);
    let panel, buttons = [], sourceDial, sourcePlay, layer, poseTimer;
    function endPose() {
      clearTimeout(poseTimer);
      pic.classList.remove("exhaling");
    }
    function exhale({ detail }) {
      endPose();
      pic.classList.add("exhaling");
      const { breaths } = portraitBreath(detail.temp, detail, { ...detail, x: .34, y: .62 });
      const duration = Math.max(...breaths.map(b => (b.delay || 0) + (b.dur || 0)));
      poseTimer = setTimeout(endPose, duration * 1000 + 1100);
      if (smokeAllowed() && !document.body.classList.contains("reduce-shake")) {
        layer = smokeLayer(smoke, { zIndex: 1, className: "pull-smoke", gridScale: .5 });
        layer.breathe(breaths);
      }
    }
    return {
      pic, ctrl,
      leave() {
        endPose();
        layer?.destroy();
        sourcePlay?.removeEventListener("pull-exhale", exhale);
      },
      coach: bench => bench.querySelector(".bench-hint")?.textContent || "",
      thermo: () => ({ node: panel?.querySelector(".pull .thermo"), mode: "live" }),
      sync(next) {
        panel = next;
        const play = panel.querySelector(".pull-play");
        if (!play) return;
        const dial = play.querySelector(".pull-dial > svg");
        if (sourceDial !== dial) {
          sourcePlay?.removeEventListener("pull-exhale", exhale);
          sourcePlay = play;
          play.addEventListener("pull-exhale", exhale);
          sourceDial = dial;
          dial.id = "vt-source-" + dial.querySelector("linearGradient").id;
          gauge.querySelector("use").setAttribute("href", "#" + dial.id);
          buttons = [...play.querySelectorAll(".pull-btns button")].map(source => {
            const timed = source.dataset.test === "pull-stop" || source.dataset.test === "pull-deep";
            const available = () => source.isConnected && !source.disabled && !source.closest("[inert]");
            const button = el("button.vtc-bench-button", { type: "button", dataset: { test: "vt-" + source.dataset.test },
              onclick: event => {
                if ((!timed || event.detail === 0) && available()) relay(source);
              } });
            if (timed) button.addEventListener("pointerdown", event => {
              if (event.button === 0 && available()) { event.preventDefault(); relay(source); }
            });
            const icon = source.querySelector(".pull-btn-icon, .pull-serve-icon")?.cloneNode(true);
            const label = el("span");
            if (icon) button.append(icon);
            button.append(label);
            return { source, button, label };
          });
          actions.replaceChildren(...buttons.map(item => item.button));
        }
        if (play.dataset.draw) endPose();
        const leaves = play.querySelector(".leaf-icon");
        setText(life, leaves ? `葉の持ち　${leaves.dataset.hp}/${leaves.childElementCount}` : "");
        if (leaves) life.title = leaves.getAttribute("aria-label") || "";
        setText(status, [play.querySelector(".pull-current-zone > b"), play.querySelector(".pull-count-num"),
          play.querySelector(".pull-destination")].map(node => node?.textContent).filter(Boolean).join("　"));
        for (const { source, button, label } of buttons) {
          const main = source.querySelector(".btn-label");
          setText(label, main?.firstChild?.textContent || source.textContent);
          setFlag(button, "disabled", source.disabled);
          if (source.hasAttribute("aria-pressed")) setAttr(button, "aria-pressed", source.getAttribute("aria-pressed"));
        }
      },
    };
  },
};
