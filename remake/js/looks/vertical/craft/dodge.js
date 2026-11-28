// 心、雑念、時計と操作部品は本編と同じ要素を使う。回転・小窓・終了時は元の位置へ戻す。
import { el } from "../../../core/util.js";
import { portraitTools } from "./art.js";

export const dodgeView = {
  id: "dodge", step: "steam",
  match: panel => !!panel.querySelector(":scope > .steam"),
  tutorial: ({ lines, extras }) => [
    ...lines.map(say => ({ say, target: /リフレッシュ/.test(say) ? "refresh" : /スティック/.test(say) ? "pad" : "field" })),
    ...extras.map(line => ({ target: "controls", ...line })),
  ],
  create() {
    const pic = el("div.vtc-dodge-arena");
    const ctrl = el("div.vtc-dodge-input");
    const swap = el("button.vtc-dodge-swap", { type: "button", text: "精密に切替", hidden: true });
    const spots = { field: pic, controls: ctrl };
    let resize, source, board;
    const restores = [], icons = [];
    function move(node, parent) {
      const anchor = document.createComment("portrait");
      node.replaceWith(anchor);
      parent.append(node);
      restores.push(() => anchor.replaceWith(node));
    }
    return { pic, ctrl, spots,
      coach: () => "ハートを動かして、雑念をよけよう",
      thermo: () => null,
      sync(panel) {
        const steam = panel.querySelector(":scope > .steam");
        if (!steam || source === steam) return;
        source = steam;
        board = steam.querySelector(".dodge");
        const clock = steam.querySelector(".dodge-timer");
        const controls = steam.querySelector(".dodge-controls");
        move(board, pic);
        move(clock, board);
        move(controls, ctrl);
        spots.pad = controls.querySelector(".dodge-pad");
        spots.refresh = controls.querySelector(".dodge-refresh");
        const arrows = el("i.vtc-dodge-arrows", { "aria-hidden": "true" },
          ["▲","▶","▼","◀"].map(mark => el("i", { text: mark })));
        spots.pad.append(arrows);
        icons.push(arrows);
        const progress = el("i.vtc-dodge-time", { "aria-hidden": "true" }, [el("i")]);
        board.append(progress);
        icons.push(progress);
        const learned = controls.querySelector(".dodge-slash").dataset.locked === "false";
        controls.dataset.sub = learned ? "attack" : "slow";
        swap.hidden = !learned;
        swap.onclick = () => {
          const slow = controls.dataset.sub === "attack";
          controls.dataset.sub = slow ? "slow" : "attack";
          swap.textContent = slow ? "アタックに切替" : "精密に切替";
        };
        ctrl.append(swap);
        for (const [selector, tool] of [[".dodge-precision","slow"], [".dodge-refresh","bomb"], [".dodge-slash","attack"]]) {
          const icon = el("span.vtc-dodge-icon", { html: portraitTools[tool], "aria-hidden": "true" });
          const button = controls.querySelector(selector);
          // 元のテーマの長方形ボタン装飾は、元の作業台に戻す時に復元する。
          const skin = ["btn", "primary"].filter(name => button.classList.contains(name));
          button.classList.remove(...skin);
          restores.push(() => button.classList.add(...skin));
          button.prepend(icon);
          for (const badge of button.querySelectorAll(".action-recharge,.slash-count")) move(badge, icon);
          icons.push(icon);
        }
        const fit = () => {
          if (pic.clientWidth && pic.clientHeight) board.style.transform = 'scale(' +
            pic.clientWidth / parseFloat(board.style.width) + ',' + pic.clientHeight / parseFloat(board.style.height) + ')';
        };
        fit();
        resize = new ResizeObserver(fit);
        resize.observe(pic);
      },
      leave() {
        resize?.disconnect();
        board?.style.removeProperty("transform");
        icons.forEach(n => n.remove());
        restores.reverse().forEach(fn => fn());
      },
    };
  },
};
