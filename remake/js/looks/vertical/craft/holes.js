// 縦画面の作る場面: 穴あけ（試作の holes・VPL27・VPL58・VPL80・VPL90）。上の絵＝アルミ（本編の foil_interactive_top）に、
// まだ開けていない目印の点・次の目印（ひし形と、ちょうどいい穴の大きさの点線の丸）・開けた穴・針先（水色の輪）。押している間は針先で穴が育つ。
// 下＝真ん中に大きな「刺す」（押すと色が下から満ち、満ちたら金＝離す時、深すぎると赤）と、その周りの点（開けた穴の数。金＝ちょうどいい穴）、左下に開けた数。
// 本編の runHoles（craft/holes.js）の画面を読んで描く: 目印・穴・針の位置（本編の .foil-target-plane の中の %）、押している長さ（針の --press と
// data-depth）、穴の判定（.foil-hole の種類と深さ）、判定の文字（.stamp）。「刺す」は本編の「穴を開ける」（data-test hole-punch）へ長押しのまま
// 中継する（押し始めと離す。押す長さの判定・穴の位置・テンプレート・制限時間は本編のまま）。
// 本編が出す前段と後段も同じ画面で写す: 穴の配置（テンプレート）を選ぶ札と「決定」（hole-template-*・hole-reuse・hole-start。前回の穴の開け直しは
// 絵の穴を押す）、チュートリアルの試し刺しの「穴あけを始める」（hole-warmup-start）、桜井版の「次のリングへ」「結果へ」（hole-next・hole-done）。
import { el } from "../../../core/util.js";
import { textOf } from "../frame.js";
import { PRESS } from "../../../craft/holes_logic.js";
import { HOLE_TEMPLATES, ringsForTemplate } from "../../../craft/holes_templates.js";

const FOIL = new URL("../../../../img/ui/making/foil_interactive_top.webp", import.meta.url).href;
// 箔の上の穴の半径（箔の幅を200とした値。試作の HOLE_R）。本編の穴の深さ（.foil-hole の shallow・small・wide・large）ごと
const HOLE_R = { shallow: 1.3, small: 3, wide: 4, large: 5 };
const DEPTHS = Object.keys(HOLE_R);
// 「刺す」の白い図形（試作の TOOL_SVG.needle）: 穴あけの道具を少し斜めに。押し具合（--level）で先の方へ突き出る
const NEEDLE_SVG = `<svg class="vtc-tool vtc-tool-needle" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(32 50 50)"><g class="vtc-gl-needle">
  <path d="M39.5 22C39.5 13.5 44 8 50 8S60.5 13.5 60.5 22V35C60.5 39.5 58 42 55.5 43H44.5C42 42 39.5 39.5 39.5 35Z"/><rect x="43" y="45.5" width="14" height="6" rx="1.5"/><path d="M46.8 53.5H53.2L52.3 82 50 92 47.7 82Z"/></g></g></svg>`;
const HOLES_ICON = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="7.3" r="1.1" class="f"/><circle cx="16.3" cy="10.5" r="1.1" class="f"/><circle cx="14.7" cy="15.7" r="1.1" class="f"/><circle cx="9.3" cy="15.7" r="1.1" class="f"/><circle cx="7.7" cy="10.5" r="1.1" class="f"/>';
// 本編の盤（.foil-target-plane）の中の % → 絵の SVG（-100〜100）
const at = (node) => [(parseFloat(node.style.left) - 50) * 2, (parseFloat(node.style.top) - 50) * 2];
const fixed = (v) => (Number.isFinite(v) ? v : 0).toFixed(1);
const depthOf = (node) => DEPTHS.find((depth) => node.classList.contains(depth)) || "small";
const goodHole = (node) => (node.classList.contains("perfect") || node.classList.contains("good")) && !node.classList.contains("shallow");
const live = (node) => node && !node.disabled && !node.closest("[inert]") ? node : null;
/** 押している長さ（本編の深さ）→ 「刺す」の色（浅い＝白・ちょうどいい＝金・深すぎ＝赤） */
const ZONES = { shallow: "under", small: "good", wide: "over", large: "over" };
/** テンプレートの札の小さな絵（本編のテンプレートのリングと穴の数から。箔の丸に点） */
function patternSvg(id) {
  const template = HOLE_TEMPLATES.find((item) => item.id === id);
  const dots = template ? ringsForTemplate(template).flatMap(({ r, targets }) => Array.from({ length: targets }, (_, i) => {
    const a = 2 * Math.PI * i / targets - Math.PI / 2;
    return `<circle cx="${(24 + 19 * r * Math.cos(a)).toFixed(2)}" cy="${(24 + 19 * r * Math.sin(a)).toFixed(2)}" r="1.3"/>`;
  })).join("") : "";
  return `<svg class="vtc-ht-mark" viewBox="0 0 48 48" aria-hidden="true"><circle class="vtc-ht-disc" cx="24" cy="24" r="21"/>${dots}</svg>`;
}

export const holesView = {
  id: "holes",
  step: "holes",
  // 蓋の通気（stepVent。同じ holes の工程）とは、穴あけの部品（配置の札・アルミ）があるかで見分ける。結果の札だけの時も穴あけ（通気は結果を出さない）
  match: (panel) => !!panel.querySelector('[data-test="hole-start"], [data-test="hole-punch"], [data-test="foil"]')
    || !!panel.querySelector(":scope > .result-card"),
  intro: (bench) => bench.querySelector(".bench-title")?.textContent.trim() === "アルミ穴あけ", // チュートリアルの初回の説明
  persist: true, // 配置選び→穴あけ→結果で本編が部品を作り直しても、同じ画面のまま描き替える（結果の間も開けた穴を残す）
  create({ hold, relay, icon }) {
    const marks = el("div.vtc-foil-plane", { html: '<svg class="vtc-foil-marks" viewBox="-100 -100 200 200" aria-hidden="true"></svg>' });
    const svg = marks.firstElementChild;
    const dots = el("div.vtc-foil-dots"); // 前回の穴の開け直しで押す穴
    const judges = el("div.vtc-judges", { "aria-live": "polite", dataset: { test: "vt-holes-judge" } });
    const foil = el("div.vtc-foil", { dataset: { test: "vt-holes-foil" } }, [el("img", { src: FOIL, alt: "", draggable: "false" }), marks, dots, judges]);
    const pic = el("div.vtc-holes-pic", [foil]);

    // ---- 配置選び
    const cards = el("div.vtc-ht-cards", { role: "group", "aria-label": "穴の配置" });
    const infoName = el("b"), infoText = el("span");
    const info = el("div.vtc-packinfo.vtc-ht-info", { role: "status", "aria-live": "polite", dataset: { test: "vt-holes-info" } }, [infoName, infoText]);
    const start = el("button.vtc-ok.vtc-ht-ok", { type: "button", "aria-label": "この配置で穴あけを始める", dataset: { test: "vt-holes-start" } }, [el("span.vtc-ok-t", { text: "決定" })]);
    const choose = el("div.vtc-ht", [cards, info, start]);
    // ---- 穴あけ
    const pips = el("div.vtc-pips", { html: '<svg viewBox="-50 -50 100 100" aria-hidden="true"></svg>', dataset: { test: "vt-holes-pips" } });
    const poke = el("button.vtc-ok.vtc-hold.vtc-poke", { type: "button", "aria-label": "刺す（長押し）", dataset: { test: "vt-holes-poke" } }, [
      el("i.vtc-fill"), el("i.vtc-fill-line"), el("span.vtc-ok-t.vtc-tool-t", { html: NEEDLE_SVG }), el("small.vtc-lab", { text: "刺す" }),
    ]);
    const countNum = el("b"), countAll = el("small");
    const count = el("span.vtc-hole-count", { "aria-hidden": "true", html: icon(HOLES_ICON) }, [countNum, countAll]);
    const next = el("button.vtc-pill.vtc-hole-next", { type: "button", hidden: true, dataset: { test: "vt-holes-next" } });
    const punch = el("div.vtc-hp", [pips, poke, count, next]);
    const ctrl = el("div.vtc-holes-ctrl", [choose, punch]);

    let panel = null, phase = "", drawSig = "", pipSig = "", cardSig = "", ctrlSig = "", stampSig = "", holeCount = -1;
    let pressedAt = 0, raf = 0, sentDone = false;
    const one = (selector) => panel?.querySelector(selector) || null;
    const plane = () => one('[data-test="foil"] .foil-target-plane') || one('[data-test="hole-preview"] .foil-target-plane');

    hold(poke, () => live(one('[data-test="hole-punch"]')));
    start.addEventListener("click", () => { const target = live(one('[data-test="hole-start"]')); if (target) relay(target); });
    next.addEventListener("click", () => {
      const target = live(one('[data-test="hole-warmup-start"]')) || live(one('[data-test="hole-next"]')) || live(one('[data-test="hole-done"]'));
      if (!target) return;
      // 「結果へ」は本編が結果の札を出すまで少し間がある（その間も本編のボタンは押せる形のまま）。二度押さないよう、押したら隠す
      if (target.dataset.test === "hole-done") { sentDone = true; next.hidden = true; }
      relay(target);
    });
    cards.addEventListener("click", (event) => {
      const card = event.target.closest(".vtc-card");
      const target = card && live(one(`[data-test="${card.dataset.live}"]`));
      if (target) relay(target);
    });
    dots.addEventListener("click", (event) => {
      const dot = event.target.closest(".vtc-redo");
      const target = dot && live(one(`[data-test="${dot.dataset.live}"]`));
      if (target) relay(target);
    });

    /** 絵: 目印・穴・針先（本編の盤から）。前回の穴の開け直しの穴は押せるボタンにする。 */
    function drawFoil() {
      const host = plane();
      if (!host) return; // 結果の札だけの間などは、最後に描いた箔を残す
      const markers = [...host.querySelectorAll(".foil-marker")];
      const holes = [...host.querySelectorAll(".foil-holes > .foil-hole")];
      const redo = [...host.querySelectorAll(".foil-reuse-dot")];
      const sig = JSON.stringify([markers.map((node) => [node.style.left, node.style.top, node.className]), holes.map((node) => [node.style.left, node.style.top, node.className]),
        redo.map((node) => [node.style.left, node.style.top, node.getAttribute("aria-pressed"), node.querySelector(".foil-hole")?.className])]);
      if (sig === drawSig) return;
      drawSig = sig;
      const parts = [];
      for (const hole of holes) {
        const [x, y] = at(hole);
        parts.push(`<circle class="vtc-hole${goodHole(hole) ? " good" : ""}" cx="${fixed(x)}" cy="${fixed(y)}" r="${HOLE_R[depthOf(hole)]}"/>`);
      }
      for (const marker of markers) {
        const [x, y] = at(marker);
        if (marker.classList.contains("next")) {
          parts.push(`<g class="vtc-target" transform="translate(${fixed(x)} ${fixed(y)})"><rect x="-6.2" y="-6.2" width="12.4" height="12.4" transform="rotate(45)"/><circle class="vtc-ideal" r="${HOLE_R.small}"/></g>`);
        } else parts.push(`<circle class="vtc-todo${marker.classList.contains("cur") || marker.classList.contains("planned") ? "" : " later"}" cx="${fixed(x)}" cy="${fixed(y)}" r="1.3"/>`);
      }
      svg.innerHTML = `${parts.join("")}<circle class="vtc-grow" r="0"/><circle class="vtc-tip" r="5.2"/>`;
      dots.replaceChildren(...redo.map((dot) => {
        const hole = dot.querySelector(".foil-hole");
        return el("button.vtc-redo", { type: "button", style: { left: dot.style.left, top: dot.style.top }, "aria-pressed": dot.getAttribute("aria-pressed") || "false",
          "aria-label": dot.getAttribute("aria-label") || "開け直す", dataset: { live: dot.dataset.test, depth: hole ? depthOf(hole) : "small" } }, [el("i")]);
      }));
    }

    /** 毎フレーム: 針先・押している長さ（本編の針の位置と --press・data-depth）。 */
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const host = plane();
      const cursor = host?.querySelector(".foil-cursor");
      const tip = svg.querySelector(".vtc-tip"), grow = svg.querySelector(".vtc-grow");
      const showTip = !!cursor && !cursor.hidden && phase === "punch";
      if (tip) {
        tip.style.display = showTip ? "" : "none";
        if (showTip) {
          const [x, y] = at(cursor);
          tip.setAttribute("cx", fixed(x)); tip.setAttribute("cy", fixed(y));
          tip.classList.toggle("resting", cursor.classList.contains("resting"));
        }
      }
      const pressing = showTip && cursor.classList.contains("pressing");
      if (pressing && !pressedAt) pressedAt = now;
      if (!pressing) pressedAt = 0;
      const depth = pressing ? cursor.dataset.depth || "shallow" : "";
      const zone = ZONES[depth] || "";
      // 色が満ちるまでの間は本編の「浅い」の長さ（PRESS.shallow）。満ちたら金＝離す時
      const t = pressing ? (depth === "shallow" ? Math.min(1, (now - pressedAt) / (PRESS.shallow * 1000)) : 1) : 0;
      const level = pressing ? 1 - (1 - t) ** 2 : 0;
      const fill = pressing ? Math.max(0, Math.min(1, parseFloat(cursor.style.getPropertyValue("--press")) || 0)) : 0;
      poke.style.setProperty("--level", level.toFixed(3));
      poke.style.setProperty("--fill", fill.toFixed(3));
      if (poke.dataset.zone !== zone) poke.dataset.zone = zone;
      poke.classList.toggle("live-press", pressing);
      if (grow && tip) {
        grow.setAttribute("cx", tip.getAttribute("cx") || "0"); grow.setAttribute("cy", tip.getAttribute("cy") || "0");
        grow.setAttribute("r", pressing ? (depth === "shallow" ? HOLE_R.shallow * level : HOLE_R[depth] || HOLE_R.small).toFixed(2) : "0");
        grow.setAttribute("class", `vtc-grow ${zone}`);
      }
    }
    raf = requestAnimationFrame(frame);

    /** 「刺す」の周りの点（開けた穴の数。金＝ちょうどいい穴）と左下の数。 */
    function drawPips(holes, total, warmup) {
      const made = warmup ? [] : holes;
      const sig = JSON.stringify([made.map(goodHole), total]);
      if (sig === pipSig) return;
      pipSig = sig;
      pips.firstElementChild.innerHTML = Array.from({ length: total }, (_, i) => {
        const a = (i * 360 / total - 90) * Math.PI / 180, hole = made[i];
        return `<circle class="vtc-pip${hole ? (goodHole(hole) ? " good" : " done") : ""}" cx="${(46 * Math.cos(a)).toFixed(1)}" cy="${(46 * Math.sin(a)).toFixed(1)}" r="2.6"/>`;
      }).join("");
      pips.setAttribute("aria-label", `開けた穴 ${made.length}/${total}`);
      countNum.textContent = String(made.length);
      countAll.textContent = `/${total}`;
    }

    /** 穴が1つ増えた時、「刺す」を光らせる（ちょうどいい穴＝金の光、そのほか＝小さく揺れる）と、判定の文字。 */
    function react(holes) {
      if (holeCount >= 0 && holes.length > holeCount) {
        const hole = holes.at(-1);
        const good = goodHole(hole) && depthOf(hole) === "small";
        poke.classList.remove("res-good", "res-off"); void poke.offsetWidth;
        poke.classList.add(good ? "res-good" : "res-off");
      }
      holeCount = holes.length;
      const stamp = [...(panel?.querySelectorAll(".foil-target-plane > .stamp, .hr-feedback .stamp") || [])].at(-1);
      const text = textOf(stamp);
      const sig = stamp ? `${text}|${holes.length}` : "";
      if (!stamp || sig === stampSig) return;
      stampSig = sig;
      const kind = /EXCELLENT|BEAUTIFUL/.test(text) ? "excellent" : /GOOD|COMPLETE/.test(text) ? "good" : "miss";
      const tag = el(`b.vtc-jtag.${kind}`, { text });
      judges.replaceChildren(tag);
      setTimeout(() => tag.classList.add("out"), 1200);
      setTimeout(() => tag.remove(), 2400);
    }

    return {
      pic, ctrl,
      coach: () => ({
        choose: "配置を選んで、始めろ",
        warmup: "試し刺しで、押す長さを覚えろ",
        next: "埋まったら、次のリングへ",
        done: "開け終えたら、結果へ",
      })[ctrlSig.split("|")[0]] || "目印で押し、満ちたら離せ",
      thermo: () => null, // 試作の穴あけは温度計を出さない（箔を真ん中に大きく）
      sync(livePanel) {
        panel = livePanel;
        const choosing = !!one('[data-test="hole-start"]');
        if (choosing) sentDone = false; // 同じ工程のやり直し
        const punching = !!one('[data-test="hole-punch"]');
        phase = choosing ? "choose" : punching ? "punch" : phase || "idle";
        ctrl.dataset.phase = pic.dataset.phase = phase;
        choose.hidden = phase !== "choose";
        punch.hidden = phase === "choose";
        drawFoil();
        if (phase === "choose") {
          const options = [...panel.querySelectorAll(".ht-option, .hole-reuse")];
          const items = options.map((node) => ({ live: node.dataset.test, name: textOf(node.querySelector(".btn-label")) || textOf(node), on: node.getAttribute("aria-pressed") === "true", off: !live(node),
            id: (node.dataset.test || "").replace(/^hole-template-/, "") }));
          const nextCards = JSON.stringify(items.map((item) => [item.live, item.name]));
          if (nextCards !== cardSig) {
            cardSig = nextCards;
            cards.replaceChildren(...items.map((item) => el("button.vtc-card.vtc-ht-card", { type: "button", dataset: { live: item.live, test: `vt-${item.live}` }, "aria-label": item.name }, [
              el("span.vtc-ht-art", { html: item.live === "hole-reuse" ? patternSvg("") : patternSvg(item.id) }), el("b", { text: item.name }),
            ])));
          }
          items.forEach((item, i) => { cards.children[i].disabled = item.off; cards.children[i].setAttribute("aria-pressed", String(item.on)); });
          const chosen = items.find((item) => item.on);
          infoName.textContent = chosen?.name || "";
          infoText.textContent = [textOf(one('[data-test="hole-template-counts"]')), textOf(one(".ht-description"))].filter(Boolean).join("。");
          const go = one('[data-test="hole-start"]');
          start.disabled = !live(go);
          start.setAttribute("aria-label", textOf(go?.querySelector(".btn-label")) || "この配置で穴あけを始める");
          ctrlSig = "choose|";
          return;
        }
        const host = plane();
        if (host) {
          const holes = [...host.querySelectorAll(".foil-holes > .foil-hole")];
          const warmup = !!one('[data-test="hole-warmup-start"]');
          const total = (warmup ? 0 : holes.length) + host.querySelectorAll(".foil-markers > .foil-marker").length;
          drawPips(holes, total, warmup);
          react(holes);
          // 試し刺しの「穴あけを始める」、桜井版の「次のリングへ」「結果へ」（本編で押せる時だけ、右下に出す）
          const warm = live(one('[data-test="hole-warmup-start"]')), ring = live(one('[data-test="hole-next"]')), done = live(one('[data-test="hole-done"]'));
          const which = warm ? "warmup" : ring ? "next" : done ? "done" : warmup ? "warmup" : "";
          const label = warm ? textOf(warm) : ring ? textOf(ring) : done && !sentDone ? "結果へ" : "";
          ctrlSig = `${which}|${label}`;
          next.hidden = !label;
          if (next.textContent !== label) next.textContent = label;
          next.dataset.kind = which;
          // 押している間は止めない（押しすぎで本編が先に刺し抜けても、指を離すまでボタンを生かす）
          poke.disabled = !live(one('[data-test="hole-punch"]')) && !poke.classList.contains("pressing");
        } else poke.disabled = !poke.classList.contains("pressing");
      },
      leave() { cancelAnimationFrame(raf); raf = 0; panel = null; },
    };
  },
};
