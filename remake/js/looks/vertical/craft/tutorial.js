// 縦画面の作る場面: スミさんの説明のスポットライト（チュートリアル・2026-11-28 VPN32）。
// 本編の「操作の説明」（工程の初回の explainStepOnce と「？」。craft/session.js の .bench-guide）が開いている間、画面全体を暗くし、
// スミさんの一言（顔と吹き出し）と、その一言が指す所だけを明るく抜いて見せる。一言は段に分け、画面のどこを押しても次の段へ進む
// （前の段へは戻らない）。最後の段の「やってみる」で本編の「説明を閉じて進む」へ中継する（本編の時計はそこから動く）。
// 段は工程の画面の定義（craft/<工程>.js の書き出し）の tutorial が決める:
//   tutorial(guide) => [{ target, say, label? }]（配列をそのまま書いてもよい）。無い工程・null を返した時は、本編の説明の文を「。」で区切った段にし、
//   どの段も操作の段（ctrl）全体を指す（あとから足す工程も、tutorial を書く前からそのまま動く）。
//   guide … 本編の説明の文: { text: 本文（「スミ「…」」の括弧を外す）, lines: 本文を段に分けた文の並び, extras: 補足（本編が「？」へ足す
//           一覧の行は { label: 名前, say }、段落は { say }）, mode: 一台の種類（tutorial・practice・tournament など） }
//   target … 明るく抜く所。"pic"（真ん中の絵）・"ctrl"（いちばん下の操作）・"thermo"（右の温度計）・工程の画面が spots に持たせた名前・
//            (view) => 要素（要素の配列なら全部を囲む）。配列は「見えている最初の物」（例: ["thermo", "lcd"]＝温度計が無ければ液晶）。
//            どれも見えなければ ctrl、それも無ければ抜かずに暗くするだけ。
//   say    … 一言（台詞なので末尾に「。」を付けない・2行まで。text-style）。label は一覧の行の名前（吹き出しの上に小さく出す）。
//            行は本編の組版（vn/layout.js の paginateForBox）が吹き出しの幅で折る。2行に収まらなければ字を一段小さくする。
// 見せ方は試作の店番のチュートリアル（previews/portrait-stage/floor.mjs・floor.css。VPM03 のやる所が光る形と、スミさんの言葉の吹き出し・
// 送りの印）を、試作の作る場面の色（金の --acc と暗い紫）にそろえたもの。
import { el } from "../../../core/util.js";
import { paginateForBox } from "../../../vn/layout.js";

/** 「スミ「…」」の括弧を外す（本編の説明の本文は、スミさんの台詞として書いてある）。 */
export const speech = (text) => String(text || "").trim().replace(/^スミ「([\s\S]*)」$/, "$1").trim();

/**
 * 説明の文を段に分ける: 「。」で区切り（末尾の「。」は付けない）、続けて読んでも短い2文（合わせて room 字まで）は1つの段にまとめる。
 * 段の文を増やさず、区切り方だけを変える。
 */
export function sayLines(text, room = 20) {
  const out = [];
  for (const part of String(text || "").split("。").map((s) => s.trim()).filter(Boolean)) {
    const last = out.at(-1);
    if (last && !last.includes("。") && last.length + part.length + 1 <= room) out[out.length - 1] = `${last}。${part}`;
    else out.push(part);
  }
  return out;
}

const plain = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";

/** 本編の説明の箱（.bench-guide-tip）から、段にする文を読む。お手本の入口・一台の記録・注記と閉じるボタンは読まない。 */
export function readGuide(tip, mode = "") {
  const text = speech(plain(tip?.querySelector(":scope > p")));
  const extras = [];
  for (const box of tip?.querySelectorAll(":scope > .bench-guide-extra") || []) {
    if (box.hidden) continue;
    for (const node of box.querySelectorAll("li, p")) {
      const inItem = node.tagName !== "LI" && node.closest("li"); // 一覧の行の中の段落は、行として読む
      if (node.hidden || inItem) continue;
      if (node.tagName === "LI") {
        const name = node.querySelector(":scope > b");
        const rest = [...node.childNodes].filter((child) => child !== name).map(plain).filter(Boolean).join(" ");
        if (rest) extras.push({ label: plain(name), say: speech(rest).replace(/。$/, "") });
      } else for (const say of sayLines(speech(plain(node)))) extras.push({ say });
    }
  }
  return { text, lines: sayLines(text), extras, mode };
}

/** 工程の画面の定義（def）と本編の説明の文（guide）から段を作る。 */
export function tutorialSteps(def, guide) {
  const own = typeof def?.tutorial === "function" ? def.tutorial(guide) : def?.tutorial;
  const steps = own || [...guide.lines.map((say) => ({ say })), ...guide.extras].map((line) => ({ target: "ctrl", ...line }));
  return steps.filter((step) => step?.say);
}

const visible = (node) => !!node?.isConnected && node.getClientRects().length > 0
  && (({ width, height }) => width > 1 && height > 1)(node.getBoundingClientRect());

/**
 * スポットライトを作る。
 *   face   … スミさんの顔の絵（作る場面の一言と同じ物）
 *   pick(target) … 名前・関数の target を、明るく抜く要素（か要素の配列）にする（craft.js が今の工程の画面から引く）
 *   onClose()    … 最後の段の「やってみる」（本編の説明を閉じて進む）
 */
export function createSpotlight({ face, pick, onClose }) {
  const hole = el("i.vtc-tut-hole", { "aria-hidden": "true", dataset: { test: "vt-craft-tut-hole" } });
  const label = el("b.vtc-tut-label", { hidden: true });
  const say = el("span.vtc-tut-text");
  const dots = el("span.vtc-tut-dots", { "aria-hidden": "true", dataset: { test: "vt-craft-tut-dots" } });
  const next = el("button.vtc-tut-next", { type: "button", "aria-label": "次へ", dataset: { test: "vt-craft-tut-next" } });
  const go = el("button.vtc-tut-go", { type: "button", text: "やってみる", dataset: { test: "vt-craft-tut-go" } });
  const card = el("div.vtc-tut-card", [
    el("p.vtc-tut-say", { "aria-live": "polite", dataset: { test: "vt-craft-tut-say" } }, [label, say]),
    el("div.vtc-tut-foot", [dots, next, go]),
  ]);
  const coach = el("div.vtc-tut-coach", { dataset: { test: "vt-craft-tut-coach" } }, [el("img", { src: face, alt: "", draggable: "false" }), card]);
  const root = el("div.vtc-tut", { hidden: true, role: "dialog", "aria-modal": "true", "aria-label": "スミさんの説明", dataset: { test: "vt-craft-tut" } }, [hole, coach]);

  let steps = [], index = 0, key = null, placed = "", nudgeTimer = 0, fitted = "";

  /** 一言を吹き出しの幅で2行に折る（本編の組版。収まらなければ一段小さく）。 */
  function fit() {
    const text = steps[index]?.say || "";
    const sig = `${index}|${text}|${say.clientWidth}`;
    if (sig === fitted) return;
    say.classList.remove("small");
    say.textContent = text;
    fitted = `${index}|${text}|${say.clientWidth}`;
    if (!text || !say.clientWidth) return;
    let pages = paginateForBox(text, say);
    if (pages.length > 1) { say.classList.add("small"); pages = paginateForBox(text, say); }
    if (pages.length > 1) { console.warn("[縦の作る場面] スミさんの説明が2行に収まらない:", text); return; }
    say.replaceChildren(...pages[0].split("\n").flatMap((line, i) => (i ? [el("br"), line] : [line])));
  }

  /** 今の段の、明るく抜く要素（見えている物）。target の配列は見えている最初の物、どれも無ければ ctrl。 */
  function targets(target) {
    for (const option of [...[].concat(target ?? []), "ctrl"]) {
      const nodes = [].concat(pick(option) || []).filter(visible);
      if (nodes.length) return nodes;
    }
    return [];
  }

  /** 抜く所と吹き出しを置く（段が替わった・画面の大きさが変わった・絵が読み込まれて形が変わった時）。 */
  function place() {
    if (root.hidden) return;
    const box = root.getBoundingClientRect();
    if (!box.width || !box.height) return;
    fit(); // 画面の大きさが変わった時は、吹き出しの幅で折り直す
    const u = box.width / 39, nodes = targets(steps[index]?.target);
    let rect = null, radius = 1.6 * u;
    if (nodes.length) {
      const rs = nodes.map((node) => node.getBoundingClientRect());
      const pad = 0.7 * u, edge = 0.4 * u;
      const left = Math.max(edge, Math.min(...rs.map((r) => r.left)) - box.left - pad);
      const top = Math.max(edge, Math.min(...rs.map((r) => r.top)) - box.top - pad);
      const right = Math.min(box.width - edge, Math.max(...rs.map((r) => r.right)) - box.left + pad);
      const bottom = Math.min(box.height - edge, Math.max(...rs.map((r) => r.bottom)) - box.top + pad);
      rect = { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      // 丸いボタン1つなら丸く、角の丸い札などはその丸みに余白を足す
      if (nodes.length === 1) {
        const css = getComputedStyle(nodes[0]).borderTopLeftRadius, own = parseFloat(css) || 0;
        const r = css.endsWith("%") ? Math.min(rs[0].width, rs[0].height) * own / 100 : own;
        radius = Math.max(1.2 * u, r + pad);
      }
      radius = Math.min(radius, Math.min(rect.width, rect.height) / 2);
    }
    const coachH = coach.offsetHeight, gap = 1.2 * u, margin = u;
    let top, side = "middle";
    if (!rect) top = (box.height - coachH) / 2;
    else {
      // 吹き出しは抜いた所を隠さない側（上と下の空いている方）へ
      const bottom = rect.top + rect.height, above = rect.top - margin, below = box.height - bottom - margin;
      side = below >= above ? "below" : "above";
      top = side === "below" ? Math.min(bottom + gap, box.height - margin - coachH) : Math.max(margin, rect.top - gap - coachH);
    }
    const sig = JSON.stringify([rect && Object.values(rect).map((v) => v.toFixed(1)), radius.toFixed(1), top.toFixed(1)]);
    if (sig === placed) return;
    placed = sig;
    hole.dataset.empty = String(!rect);
    Object.assign(hole.style, rect ? { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: `${radius}px` }
      : { left: "50%", top: "50%", width: "0px", height: "0px", borderRadius: "0px" });
    coach.style.top = `${top}px`;
    coach.dataset.side = side;
  }

  /** i 番目の段を見せる。 */
  function show(i) {
    index = i;
    const step = steps[index];
    const last = index >= steps.length - 1;
    label.textContent = step?.label || "";
    label.hidden = !step?.label;
    dots.replaceChildren(...steps.map((_, n) => el(`i${n === index ? ".on" : n < index ? ".done" : ""}`)));
    next.hidden = last;
    go.hidden = !last;
    root.dataset.index = String(index + 1);
    root.dataset.count = String(steps.length);
    root.dataset.target = [].concat(step?.target ?? "ctrl").map((t) => typeof t === "function" ? "custom" : t).join("|");
    coach.classList.remove("pop"); void coach.offsetWidth; coach.classList.add("pop");
    place();
    (last ? go : next).focus({ preventScroll: true });
  }

  /** 抜く所を滑らかに動かさずに置く（出した時・画面の大きさが変わった時）。 */
  function snap(run) {
    root.dataset.snap = "";
    run();
    void hole.offsetWidth; // 動きを止めたまま新しい位置を決めてから、次の描画で動きを戻す
    requestAnimationFrame(() => { delete root.dataset.snap; });
  }

  function nudge() {
    for (const node of [coach, go]) { node.classList.remove("nudge"); void node.offsetWidth; node.classList.add("nudge"); }
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => { coach.classList.remove("nudge"); go.classList.remove("nudge"); }, 600);
  }

  function hide() {
    if (root.hidden) return;
    root.hidden = true;
    key = null; placed = ""; fitted = ""; steps = [];
    clearTimeout(nudgeTimer);
    root.closest(".vtc")?.removeAttribute("data-tut");
  }

  // 画面のどこを押しても次の段へ。最後の段は「やってみる」だけで閉じる（ほかを押すと、顔と「やってみる」が揺れて知らせる）
  root.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target.closest(".vtc-tut-go")) { hide(); onClose(); return; }
    if (index < steps.length - 1) show(index + 1);
    else nudge();
  });

  return {
    root,
    get showing() { return !root.hidden; },
    /** 段を出す。同じ説明（nextKey）が開いたままなら、今の段のまま置き直すだけ。 */
    open(nextKey, nextSteps) {
      if (!root.hidden && nextKey === key) { place(); return; }
      key = nextKey; steps = nextSteps; placed = ""; fitted = "";
      const first = root.hidden;
      root.hidden = false;
      root.closest(".vtc")?.setAttribute("data-tut", "on");
      if (first) snap(() => show(0)); // 出した時は、抜く所を動かさずにその場へ置く
      else show(0);
    },
    place,
    /** 画面の大きさが変わった時: 抜く所と吹き出しを、動かさずに置き直す。 */
    relayout() { if (!root.hidden) snap(place); },
    hide,
  };
}
