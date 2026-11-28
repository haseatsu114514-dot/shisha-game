// 調整の炭交換と試し吸い。選択・針・残り時間・採点は本編の作業台が持つ。
import { el } from "../../../core/util.js";
import { textOf } from "../frame.js";

export const careView = {
  id: "care",
  step: "care",
  match: (panel) => !!panel.closest('.bench[data-chapter="1"][data-practice-kind="midcheck"]')
    && !!panel.querySelector(".pull-care, .result-card"),
  create({ relay }) {
    const info = el("p");
    const dial = el("div.vtc-care-dial");
    const pic = el("div.vtc-care-pic", [dial, info]);
    const ctrl = el("div.vtc-care-controls");
    let panel, signature;
    ctrl.addEventListener("click", (event) => {
      const key = event.target.closest("button")?.dataset.key;
      const live = key && panel?.querySelector(`[data-test="${key}"]`);
      if (live && !live.disabled) relay(live);
    });
    return {
      pic, ctrl,
      coach: (bench) => textOf(bench.querySelector(".bench-title")),
      thermo: () => ({ node: panel.querySelector(".pull-care .thermo"), mode: "live" }),
      sync(livePanel) {
        panel = livePanel;
        const choice = panel.querySelector(".care-coals");
        const svg = panel.querySelector(".pull-dial > svg");
        dial.hidden = !!choice || !svg;
        if (svg && !dial.firstChild) {
          // use は本編の針を描画フレームごとに追う。外枠の同期周期で針を間引かない。
          const id = svg.querySelector("linearGradient").id;
          svg.id = `vt-source-${id}`;
          dial.innerHTML = `<svg viewBox="0 0 480 240" aria-hidden="true"><use href="#${svg.id}"/></svg>`;
        }
        const message = textOf(panel.querySelector(choice ? ".care-coals-lead" : ".pull-current-zone"));
        if (info.textContent !== message) info.textContent = message;
        ctrl.dataset.phase = choice ? "coals" : "draw";
        const live = choice ? [...choice.querySelectorAll("button")] : [...panel.querySelectorAll('[data-test="pull-stop"], [data-test="pull-serve"]')];
        const buttons = live.map((b) => [b.dataset.test, textOf(b.querySelector(".btn-label")) || textOf(b), b.disabled, b.getAttribute("aria-pressed")]);
        const next = JSON.stringify(buttons);
        if (signature === next) return;
        signature = next;
        ctrl.replaceChildren(...buttons.map(([key, text, disabled, pressed]) => el("button", {
          type: "button", text, disabled, "aria-pressed": pressed, dataset: { key, test: `vt-${key}` },
        })));
      },
    };
  },
};
