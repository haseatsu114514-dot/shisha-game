// 縦画面の作る場面: 詰め方（試作の pack・VPL77・VPL91）。上の絵＝選んでいる詰め方の器、下＝3枚の札（押して選ぶ）と、
// 選んでいる詰め方の説明（決定の左）・右下の「決定」。十字キーは出さない。
// 本編の stepPack（craft/steps.js）の選択肢 .pack-choice（data-test opt-fluffy／normal／firm・aria-pressed・未習得の disabled）・
// 説明 .pack-caption・決める .pack-confirm を読んで描き、札は本編の選択肢へ、決定は .pack-confirm へ中継する。
import { el } from "../../../core/util.js";
import { textOf } from "../frame.js";

const ART = new URL("../../../../img/ui/vertical-craft/", import.meta.url).href;
// 本編の詰め方の値 → 器の絵（試作の ui-bowl-*.webp）
const BOWL = { fluffy: "ui-bowl-airy.webp", normal: "ui-bowl-normal.webp", firm: "ui-bowl-firm.webp" };
// 札の印（試作の PACKS の dens・speed）: 詰まり具合の点と、熱の入りの速さの矢印。本編の詰め方の注記（熱が早い／標準／遅い）を絵にしたもの
const MARKS = { fluffy: [1, 3], normal: [2, 2], firm: [3, 1] };
const COAL = '<path d="M12 3.5c1 3.5 5 5.2 5 9.7a5 5 0 0 1-10 0c0-2 1-3.3 2-4.6.3 1.6 1 2.5 2 2.9-.3-2.9.2-5.4 1-8z"/>';
const LOCK = '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>';
const valueOf = (choice) => (choice.dataset.test || "").replace(/^opt-/, "");

export const packView = {
  id: "pack",
  step: "pack",
  match: (panel) => !!panel.querySelector(".packing .pack-choice") && !!panel.querySelector(".pack-confirm"),
  intro: true, // stepPack は札を出す前に初回の説明を開く
  create({ relay, icon }) {
    const bowl = el("img.vtc-bowl", { alt: "", draggable: "false", dataset: { test: "vt-pack-bowl" } });
    const pic = el("div.vtc-pack-pic", [bowl]);
    const cards = el("div.vtc-cards", { role: "group", "aria-label": "詰め方を見比べる" });
    const infoName = el("b"), infoText = el("span"), infoEffect = el("small", { hidden: true });
    const info = el("div.vtc-packinfo", { role: "status", "aria-live": "polite", dataset: { test: "vt-pack-info" } }, [infoName, infoText, infoEffect]);
    const ok = el("button.vtc-ok.vtc-pack-ok", { type: "button", "aria-label": "この詰め方で決める", dataset: { test: "vt-pack-ok" } }, [el("span.vtc-ok-t", { text: "決定" })]);
    const ctrl = el("div.vtc-pack", [cards, info, ok]);
    let panel = null, sig = "", cardSig = "", locked = null;

    cards.addEventListener("click", (event) => {
      const card = event.target.closest(".vtc-card");
      if (!card || card.disabled) return;
      const live = panel?.querySelector(`.pack-choice[data-test="opt-${card.dataset.value}"]`);
      if (live && !live.disabled) relay(live);
    });
    ok.addEventListener("click", () => {
      const live = panel?.querySelector(".pack-confirm");
      if (live && !live.disabled) relay(live);
    });

    return {
      pic, ctrl,
      coach: () => "見比べて選べ。迷えばノーマル",
      thermo: (bench) => ({ node: bench.querySelector(".thermo.mix-temperature"), mode: "bands" }),
      sync(livePanel) {
        panel = livePanel;
        const choices = [...panel.querySelectorAll(".pack-choice")];
        const confirm = panel.querySelector(".pack-confirm");
        // 未習得（心得の盤で覚える）の札は、決める前から押せない札。決めた後は本編がすべての札を止めるので、最初に見た時に覚える
        locked ??= new Set(confirm?.disabled ? [] : choices.filter((choice) => choice.disabled).map(valueOf));
        const caption = panel.querySelector(".pack-caption");
        const items = choices.map((choice) => ({
          value: valueOf(choice), name: textOf(choice.querySelector("b")), note: textOf(choice.querySelector("small")),
          on: choice.getAttribute("aria-pressed") === "true", off: choice.disabled,
        }));
        const next = JSON.stringify([items, textOf(caption), !!confirm?.disabled]);
        if (next === sig) return;
        sig = next;
        const chosen = items.find((item) => item.on) || items.find((item) => item.value === "normal") || items[0];
        const src = `${ART}${BOWL[chosen?.value] || BOWL.normal}`;
        if (bowl.getAttribute("src") !== src) bowl.src = src;
        pic.dataset.pack = chosen?.value || "";
        // 札は並びが変わった時だけ作り直し、選んでいる・押せるは書き換えるだけ（器の絵を読み直さない）
        const nextCards = JSON.stringify(items.map((item) => [item.value, item.name, item.note, locked.has(item.value)]));
        if (nextCards !== cardSig) {
          cardSig = nextCards;
          cards.replaceChildren(...items.map((item) => {
            const [dens, speed] = MARKS[item.value] || [2, 2];
            const isLocked = locked.has(item.value);
            return el(`button.vtc-card${isLocked ? ".locked" : ""}`, {
              type: "button", "aria-label": `${item.name}。${item.note}`, dataset: { value: item.value, test: `vt-pack-card-${item.value}` },
            }, [
              el("img", { src: `${ART}${BOWL[item.value] || BOWL.normal}`, alt: "", draggable: "false" }),
              el("b", { text: item.name }),
              el("span.vtc-dens", { "aria-hidden": "true" }, [1, 2, 3].map((n) => el(`i${n <= dens ? ".on" : ""}`))),
              el("span.vtc-heat", { "aria-hidden": "true", html: `${icon(COAL)}${[1, 2, 3].map((n) => `<i${n <= speed ? ' class="on"' : ""}></i>`).join("")}` }),
              isLocked ? el("span.vtc-lock", { "aria-hidden": "true", html: icon(LOCK) }) : null,
            ]);
          }));
        }
        items.forEach((item, i) => {
          const card = cards.children[i];
          card.disabled = item.off;
          card.setAttribute("aria-pressed", String(item.on));
        });
        infoName.textContent = textOf(caption?.querySelector("b")) || chosen?.name || "";
        infoText.textContent = textOf(caption?.querySelector("p"));
        infoEffect.textContent = textOf(caption?.querySelector(".pack-effect"));
        infoEffect.hidden = !infoEffect.textContent;
        ok.disabled = !confirm || confirm.disabled;
      },
      leave() { panel = null; },
    };
  },
};
