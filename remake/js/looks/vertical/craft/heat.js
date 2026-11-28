// 縦画面の作る場面: 炭焼き（試作の coal・VPL54・VPL55・VPL57・VPL65・VPL104）。上の絵＝炭壺とトングを持つはじめ（コンロが点くと下から熱の明かり。
// 取った炭は炭壺の中へ並び、判定の札が左上に出る）。下＝寄りで写したコンロ（ui-stove-zoom.webp）の上の炭。全面が赤くなったら炭を押して取る。
// 本編の runHeat（craft/heat.js。画面は heat_view.js の buildHeatView）の画面を読んで描く: 炭の数と焼け具合（本編の炭の --red・--ash）、
// 取り頃の光（.pikan）と構え（.ready-cue）、取った炭（.picked と data-phase）、判定の文字（.heat-feedback の .stamp）、自動で落ちた炭（取り出し結果の行）、
// 始まったか（.heat の aria-busy）。炭を押すと本編のその炭へ中継する（本編と同じく押した瞬間に取る）。焼ける速さ・取り頃・採点は本編のまま。
import { el } from "../../../core/util.js";
import { relayTap, textOf, cssUrl } from "../frame.js";

const ART = new URL("../../../../img/ui/vertical-craft/", import.meta.url).href;
const MAKING = new URL("../../../../img/ui/making/", import.meta.url).href;
// コンロの上の炭の中心（寄りのコンロの絵 1536×1024 に対する割合。コイルの上）。本編の炭の数ごと（並びは本編の炭の順: 3個＝奥・手前左・手前右）
const COAL_AT = {
  1: [[0.5, 0.47]],
  2: [[0.4, 0.34], [0.6, 0.62]],
  3: [[0.5, 0.32], [0.33, 0.62], [0.67, 0.62]],
  4: [[0.35, 0.33], [0.65, 0.33], [0.35, 0.63], [0.65, 0.63]],
};
// 取った炭の置き場所（はじめの絵 1024×1536 に対する割合）: 左手に持った炭壺の口の中。取った順に置く
const POT_SLOTS = [[0.735, 0.8], [0.835, 0.8], [0.785, 0.84], [0.785, 0.765]];
const PHASES = ["raw", "early", "pre", "just", "hot", "over"];

export const heatView = {
  id: "heat",
  step: "heat",
  match: (panel) => !!panel.querySelector(".heat .stove .coal"),
  intro: true, // チュートリアルは炭を出す前に初回の説明を開く
  create() {
    const glow = el("i.vtc-heat-glow");
    const slots = el("div.vtc-slots");
    const hero = el("div.vtc-coal-hero", [el("img", { src: `${ART}craft-coal-hajime.webp`, alt: "", draggable: "false" }), slots]);
    const judges = el("div.vtc-coal-judges", { "aria-live": "polite", dataset: { test: "vt-heat-judge" } });
    const up = el("div.vtc-coal-up", [glow, hero, judges]);
    const pic = el("div.vtc-heat-pic", { dataset: { test: "vt-heat-pic" } }, [up]);
    const stove = el("div.vtc-stove", { dataset: { test: "vt-heat-stove" } }, [el("img", { src: `${ART}ui-stove-zoom.webp`, alt: "", draggable: "false" })]);
    const ctrl = el("div.vtc-heat-ctrl", [stove]);
    let panel = null, coals = [], raf = 0, stampSig = "";

    const liveCoals = () => [...(panel?.querySelectorAll(".heat .stove .coal") || [])];
    /** 本編の炭の数に合わせて、コンロの上の炭を作る（炭の絵は本編の炭と同じ種類）。 */
    function build(list) {
      const spots = COAL_AT[list.length] || COAL_AT[3];
      coals = list.map((live, i) => {
        const [x, y] = spots[i] || spots.at(-1);
        // 炭の絵は本編の炭と同じもの（本編は背景の絵で描く。フラットとキューブ）
        const art = (cls, file) => cssUrl(live.querySelector(cls)?.style.backgroundImage) || `${MAKING}${file}`;
        const cold = art(".c-cold", "heat_flat_cold.webp"), lit = art(".c-red", "heat_flat_lit.webp");
        const button = el("button.vtc-coal", { type: "button", "aria-label": live.getAttribute("aria-label") || `炭 ${i + 1}`,
          style: { left: `${x * 100}%`, top: `${y * 100}%` }, dataset: { i: String(i), test: `vt-heat-coal-${i}` } }, [
          el("i.vtc-c-seat"), el("img.vtc-c-cold", { src: cold, alt: "", draggable: "false" }), el("img.vtc-c-lit", { src: lit, alt: "", draggable: "false" }), el("i.vtc-c-ash"),
        ]);
        // 本編と同じく、押した瞬間に取る（離すまで待たない）。キーボードの決定でも取れる
        button.addEventListener("pointerdown", (event) => { if (event.button === 0) { event.preventDefault(); pick(i); } });
        button.addEventListener("click", (event) => { if (event.detail === 0) pick(i); });
        return { button, live, cold, lit, taken: false, blinked: false };
      });
      stove.replaceChildren(stove.firstElementChild, ...coals.map((coal) => coal.button));
      slots.replaceChildren();
    }
    function pick(i) {
      const coal = coals[i];
      if (!coal || coal.taken || coal.live.disabled || !coal.live.isConnected || coal.live.closest("[inert]")) return;
      relayTap(coal.live);
    }
    /** 取った炭を上の画面の炭壺の中へ（本編の取った時の焼け具合の段階で色を替える）。 */
    function place(coal, phase) {
      const [x, y] = POT_SLOTS[slots.children.length] || POT_SLOTS.at(-1);
      slots.append(el("span.vtc-slot", { style: { left: `${x * 100}%`, top: `${y * 100}%` } }, [
        el(`span.vtc-tcoal${PHASES.includes(phase) ? `.${phase}` : ""}`, [el("img", { src: coal.cold, alt: "" }), el("img.lit", { src: coal.lit, alt: "" })]),
      ]));
    }
    /** 判定の札（本編の .heat-feedback の .stamp）。炭ごとに1枚、少しすると薄くなる。 */
    function judge() {
      const stamp = panel?.querySelector(".heat-feedback .stamp");
      const taken = coals.filter((coal) => coal.taken).length;
      const text = textOf(stamp);
      const sig = stamp ? `${taken}|${text}` : "";
      if (!stamp || sig === stampSig) return;
      stampSig = sig;
      const kind = /EXCELLENT|会心/.test(text) ? "excellent" : /GOOD/.test(text) ? "good" : "miss";
      const tag = el(`b.vtc-jtag.${kind}`, { text });
      judges.append(tag);
      setTimeout(() => tag.classList.add("out"), 1200);
    }

    /** 毎フレーム: 本編の炭の焼け具合・光・取った炭を写す。 */
    function frame() {
      raf = requestAnimationFrame(frame);
      const list = liveCoals();
      if (!list.length) return;
      if (list.length !== coals.length || list.some((live, i) => coals[i].live !== live)) build(list);
      const on = panel.querySelector(".heat")?.getAttribute("aria-busy") === "false";
      stove.classList.toggle("on", on);
      up.classList.toggle("on", on);
      coals.forEach((coal, i) => {
        const { live, button } = coal;
        if (coal.taken) return;
        for (const name of ["--red", "--ash"]) {
          const value = live.style.getPropertyValue(name);
          if (button.style.getPropertyValue(name) !== value) button.style.setProperty(name, value);
        }
        button.classList.toggle("pikan", live.classList.contains("pikan"));
        button.classList.toggle("soon", live.classList.contains("soon"));
        if (!coal.blinked && live.classList.contains("ready-cue")) {
          coal.blinked = true;
          button.classList.remove("blink"); void button.offsetWidth; button.classList.add("blink");
        }
        if (live.classList.contains("picked")) {
          coal.taken = true;
          // 放っておいて自動で落ちた炭（本編の取り出し結果の行が「自動」）は、炭壺へ入れずに落とす
          const dropped = /自動/.test(textOf(panel.querySelector(`[data-test="coal-timing-${i}"]`)));
          button.classList.remove("pikan", "soon");
          button.classList.add(dropped ? "dropped" : "taken");
          button.disabled = true;
          if (!dropped) place(coal, live.dataset.phase);
        }
      });
      judge();
    }
    raf = requestAnimationFrame(frame);

    return {
      pic, ctrl,
      coach: () => "全面が赤くなったら取れ",
      thermo: () => null, // 試作の炭焼きは温度計を出さない（コンロとはじめを大きく）
      sync(livePanel) {
        panel = livePanel;
        for (const coal of coals) if (!coal.taken) coal.button.disabled = !coal.live.isConnected || coal.live.disabled || !!coal.live.closest("[inert]");
      },
      leave() { cancelAnimationFrame(raf); raf = 0; panel = null; },
    };
  },
};
