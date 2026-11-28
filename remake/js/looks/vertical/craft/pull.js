// 半円の帯と針は本編の成功帯・針位置をそのまま表示する。
import { el } from "../../../core/util.js";
import { portraitBreath } from "../../../craft/portrait-breath.js";
import { smokeAllowed, smokeLayer } from "../../../core/smoke.js";
import { setAttr, setFlag, setText } from "../../../core/dom-write.js";

import { meterHtml, meterNeedle, meterViewBox, portraitTools } from "./art.js";

export const pullView = {
  id: "pull", step: "pull", intro: true,
  match: panel => !!panel.querySelector(".pull, :scope > .result-card"),
  create() {
    const art = new URL("previews/portrait-stage/img/", document.baseURI);
    const pic = el("div.vtc-pull-art", ["hold", "rest"].map((pose, i) =>
      el("img." + pose, { src: new URL(i ? "craft-pull-hajime-exhale.webp" : "craft-pull-hajime.webp", art).href, alt: "" })));
    const smoke = el("div.vtc-pull-smoke");
    pic.append(smoke);
    const bands = el("div.vtc-pull-bands", { html: meterHtml(undefined, false) });
    const pointer = el("div.vtc-pull-pointer", { "aria-hidden": "true",
      html: `<svg viewBox="${meterViewBox}">${meterNeedle}</svg>` });
    const gauge = el("div.vtc-pull-dial", [bands, pointer]);
    const legend = el("div.vtc-pull-legend", [
      el("span", { text: "下げ吸い" }),
      el("span", { text: "キープ" }),
      el("span", { text: "上げ吸い" }),
    ]);
    const life = el("span.vtc-pull-life", { role: "img" });
    let leafSignature = "", bandSignature = "", needleObserver;
    const actions = el("div.vtc-pull-actions");
    const ctrl = el("div.vtc-pull-controls", [legend, gauge, life, actions]);
    let panel, sourceBench, buttons = [], sourceDial, sourcePlay, layer, poseTimer;
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
        needleObserver?.disconnect();
        sourceBench?.removeAttribute("data-portrait-pull");
        sourcePlay?.removeEventListener("pull-exhale", exhale);
        sourcePlay?.removeEventListener("pull-inhale", endPose);
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
          sourcePlay?.removeEventListener("pull-inhale", endPose);
          sourceBench = play.closest(".bench");
          sourceBench.setAttribute("data-portrait-pull", "");
          sourcePlay = play;
          play.addEventListener("pull-inhale", endPose);
          play.addEventListener("pull-exhale", exhale);
          sourceDial = dial;
          bandSignature = "";
          needleObserver?.disconnect();
          const needle = dial.querySelector(".pg-needle");
          const aim = () => { pointer.style.transform = `rotate(${Number(needle.dataset.pos) * 1.8 - 90}deg)`; };
          needleObserver = new MutationObserver(aim);
          needleObserver.observe(needle, { attributes: true, attributeFilter: ["data-pos"] });
          aim();
          buttons = [...play.querySelectorAll(".pull-btns button")].map(source => {
            const timed = source.dataset.test === "pull-stop" || source.dataset.test === "pull-deep";
            const available = () => source.isConnected && !source.disabled && !source.closest("[inert]");
            const button = el("button.vtc-bench-button", { type: "button", dataset: { test: "vt-" + source.dataset.test },
              onclick: event => {
                if ((!timed || event.detail === 0) && available()) source.click();
              } });
            // 全ボタンに本編の click 入口がある。座標を読まず、指を置いた瞬間に同じ判定を呼ぶ。
            if (timed) button.addEventListener("pointerdown", event => {
              if (event.button === 0 && available()) { event.preventDefault(); source.click(); }
            });
            const kind = source.dataset.test;
            const tool = kind === "pull-stop" ? "mouthpiece" : kind === "pull-serve" ? "serve" : null;
            if (tool) button.append(el("span.vtc-pull-icon", { html: portraitTools[tool] }));
            const label = el("span"), dots = el("span.vtc-pull-pips", { "aria-hidden": "true" });
            const slots = kind === "pull-stop" ? play.querySelectorAll(".pull-pip").length
              : kind === "pull-serve" ? Number(source.dataset.minPulls) : 0;
            for (let i = 0; i < slots; i++) dots.append(el("i"));
            button.append(label, dots);
            return { source, button, label, dots, kind };
          });
          actions.replaceChildren(...buttons.map(item => item.button));
        }
        const bounds = [...dial.querySelectorAll(".pg-just")].flatMap(z => [Number(z.dataset.from), Number(z.dataset.to)]);
        const { downEnd, keepEnd } = dial.parentElement.dataset;
        const edges = [Number(downEnd), Number(keepEnd)];
        const nextBands = String([...edges, ...bounds]);
        if (nextBands !== bandSignature) {
          bandSignature = nextBands;
          bands.innerHTML = meterHtml(bounds, false, edges);
        }
        const leaves = play.querySelector(".leaf-icon");
        if (leaves) {
          const stages = [...leaves.children].map(n => n.dataset.stage).join(",");
          if (stages !== leafSignature) {
            leafSignature = stages;
            life.replaceChildren(...[...leaves.children].map(node => node.cloneNode(true)));
            setAttr(life, "aria-label", leaves.getAttribute("aria-label") || "葉の持ち " + leaves.dataset.hp);
          }
        }
        const pips = [...play.querySelectorAll(".pull-pip")];
        const count = pips.filter(pip => pip.classList.contains("on")).length;
        for (const { source, button, label, dots, kind } of buttons) {
          const text = source.querySelector(".btn-label")?.firstChild?.textContent || source.textContent;
          setText(label, kind === "pull-stop" ? "吸う" : kind === "pull-serve" ? "提供" : text);
          setAttr(button, "aria-label", text + (dots.children.length ? " " + count + "口" : ""));
          [...dots.children].forEach((dot, i) => dot.classList.toggle("on", i < count));
          setFlag(button, "disabled", source.disabled);
          if (source.hasAttribute("aria-pressed")) setAttr(button, "aria-pressed", source.getAttribute("aria-pressed"));
        }
      },
    };
  },
};
