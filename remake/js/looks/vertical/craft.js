// 縦画面「煙の舞台」: シーシャ作り（作る場面・2026-11-28 VPN30・VPN31）。見た目は試作（remake/previews/portrait-stage/ の app.mjs の craftHtml・
//   craftTelopHtml・craftCtrlHtml・thermoHtml・rankHtml、style.css の作る場面の部分）と同じ:
//   上＝工程の並び（絵記号の丸。今の工程が光る・名前の文字は出さない VPL31）と制作ランク、真ん中＝工程の絵と温度計、
//   下＝スミさんの顔と一言・「？」、いちばん下＝工程ごとの操作。日付・体力・お金は出さない（VPL12）。外枠の十字キーと丸ボタンは使わず、
//   画面いっぱいに組む（layout "full"。下画面の操作は工程ごとに形が違うため）。
// 作り: 本編の作業台（craft/session.js の openBench・stepPanel と各工程の関数）は裏でそのまま動かし、その DOM（工程の並び・ランク・温度計・
//   「?」の説明・工程の部品）を読んで描き、押した操作は本編の要素へ中継する（タップは frame.js の relayTap、長押しは relayPress）。
//   規則・数値・採点・チュートリアル・自動の検査（craftTest）は本編のまま。試作の写しの計算は持ち込まない。
//   どの工程にも共通の、始まりの 3・2・1・GO!（core/ui.js の countdown）と工程の結果の札（craft/common.js の resultCard）もここで写す。
// 工程ごとの画面は looks/vertical/craft/<工程>.js に分け、下の登録表（VIEWS）から呼ぶ。登録の無い工程（まだ縦にしていない工程）では
//   この場面にせず、今までどおり回転案内を出す（vertical.js の evaluate）。途中の工程だけ縦、で構わない。
import { el } from "../../core/util.js";
import { relayTap, relayPress, mirrorBackground, cssUrl, liveBackground, textOf } from "./frame.js";
import { createThermo } from "./craft/thermo.js";
import { waterView } from "./craft/water.js";
import { packView } from "./craft/pack.js";
import { holesView } from "./craft/holes.js";
import { timerView } from "./craft/timer.js";

/**
 * 工程ごとの縦の画面の登録表。工程を足す時は craft/<工程>.js に同じ形の物を作り、ここへ足す（並びは本編の工程の順）。
 *   id     … 外枠での名前（.vtc の data-step。css/look-vertical-craft.css の切り替え）
 *   step   … 本編の作業台の data-step（stepPanel の id）
 *   match(panel) … 本編のその工程の部品が出ているか（同じ data-step の別の画面と見分ける。蒸らしは時間決めと雑念回避が同じ "steam"）
 *   intro  … true なら、工程の部品を出す前の初回の「操作の説明」（パネルが空で説明が開いている間）もこの画面で写す
 *            （同じ data-step の工程のうち、部品の前に説明を開くのは1つだけ。蒸らしでは時間決め。雑念回避は場を出してから説明する）。
 *            同じ data-step のほかの工程も部品の前に説明を開く時は、関数 intro(bench) で見分ける（水入れと機材は作業台の見出し）
 *   persist … true なら、本編がその工程の部品を作り直しても外枠の画面を作り直さず、同じ画面のまま描き替える
 *            （穴あけ: 配置選び→穴あけ→結果で本編がパネルの中身を替える。結果の間も開けた穴を絵に残す）
 *   create(kit)  … 画面を作る。{ pic, ctrl, coach(bench), thermo(bench), sync(panel, bench), leave() } を返す
 *                  （pic＝真ん中の絵、ctrl＝いちばん下の操作、coach＝スミさんの一言、
 *                   thermo＝写す本編の温度計と見せ方 { node, mode: "bands"|"forecast"|"live", label, note }（無ければ null で温度計を出さない）。
 *                   押す操作は kit.relay(本編の要素) で中継する。長押しは kit.hold(外枠のボタン, () => 本編の要素) で、
 *                   押した時に本編の要素へ pointerdown、離した時に pointerup を送る）
 */
const VIEWS = [waterView, packView, holesView, timerView];

const IMG = new URL("../../../img/", import.meta.url).href;
const SUMI_FACE = `${IMG}ui/face_icons/new/face_sumi.webp`;
const GRADES = ["D", "C", "B", "A", "S", "SS", "SSS"]; // 本編の制作ランク（craft/rank-hud.js の CRAFT_GRADES）。絵は img/ui/craft-rank/
// 演出の層に出ていると、作る場面を写さない物（自分で操作する画面・ボタンのある覆い。結果の札など）。
// 工程の結果の札（common.js の resultCard。パネルの中の .result-card）は作る場面の上に写す
const FX_BLOCKERS = ".gboard, .reel-intro, .lime-coach, .kuji-overlay";
const CONTROLS = "button, input, select, textarea, a[href]";

// 工程の並びの絵記号（試作の ICONS と同じ 24×24 の線画）。本編の工程（craft/progress.js の PHASES）ごと
const STEP_ICONS = {
  pack: '<path d="M5 8h14l-1.5 5.5a4 4 0 0 1-3.9 3h-3.2a4 4 0 0 1-3.9-3zM9 20h6M12 16.5V20"/>',
  heat: '<path d="M12 3.5c1 3.5 5 5.2 5 9.7a5 5 0 0 1-10 0c0-2 1-3.3 2-4.6.3 1.6 1 2.5 2 2.9-.3-2.9.2-5.4 1-8z"/>',
  steam: '<path d="M7 20c-2-2.5 2-4.5 0-7s2-4.5 0-7M12 20c-2-2.5 2-4.5 0-7s2-4.5 0-7M17 20c-2-2.5 2-4.5 0-7s2-4.5 0-7"/>',
  pull: '<path d="M3 9.5h10a3 3 0 1 0-3-3M3 14.5h14a3 3 0 1 1-3 3"/>',
  serve: '<circle cx="12" cy="6.6" r="1.4" class="f"/><path d="M4.2 17.3a7.8 7.8 0 0 1 15.6 0z"/><path d="M2.6 20.2h18.8"/>',
  care: '<path d="M3.5 18h17M5.5 18a6.5 6.5 0 0 1 13 0M12 9v2.5"/><circle cx="12" cy="7.6" r="1.3"/>',
};
export const craftIcon = (paths, viewBox = "0 0 24 24") => `<svg class="vtc-ic" viewBox="${viewBox}" aria-hidden="true">${paths}</svg>`;

/** 写してよい作業台（表示中で、上に小窓・読み込み・操作する覆いが無い）。無ければ null。 */
function liveBench() {
  const bench = document.querySelector("#screen > .bench:not(.done)");
  if (!bench || !bench.getClientRects().length) return null;
  if (document.getElementById("modal")?.classList.contains("show") || document.querySelector(".loading-gate")) return null;
  if (bench.dataset.demoPaused === "true" || bench.querySelector(".bench-demo-sheet")) return null;
  for (const node of document.getElementById("fx")?.children || []) {
    if (node.matches(FX_BLOCKERS) || node.querySelector(CONTROLS)) return null;
  }
  return bench;
}
function viewFor(bench) {
  const panel = bench?.querySelector(".bench-panel");
  if (!panel) return null;
  const mine = VIEWS.filter((view) => view.step === bench.dataset.step);
  const shown = mine.find((view) => view.match(panel));
  if (shown) return shown;
  // 工程の初回の「操作の説明」（craft/session.js の explainStepOnce）は、工程の部品を出す前に開く。読む間も作る場面に写す
  const intro = !panel.firstElementChild && bench.querySelector(".bench-guide")?.open;
  return intro ? mine.find((view) => view.intro === true || (typeof view.intro === "function" && view.intro(bench))) || null : null;
}

/**
 * 外枠のボタンを長押しのボタンにする（試作の「注ぐ」「こぼす」「刺す」）。押している間 .pressing を付け、本編の要素へ
 * pointerdown を送り、離した（指が外れた・キーを離した）時に pointerup を送る。live() は押した時の本編の要素（押せなければ null）。
 */
function holdButton(button, live) {
  let release = null, pointer = null;
  const start = (who) => {
    if (release) return;
    const target = live();
    if (!target) return;
    pointer = who;
    release = relayPress(target);
    button.classList.add("pressing");
  };
  const end = () => {
    if (!release) return;
    const done = release;
    release = null; pointer = null;
    button.classList.remove("pressing");
    done();
  };
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || release) return;
    event.preventDefault();
    try { button.setPointerCapture(event.pointerId); } catch { /* 捕まえられない指でも、離した時の pointerup は届く */ }
    start(event.pointerId);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(type, (event) => { if (event.pointerId === pointer) end(); });
  }
  button.addEventListener("keydown", (event) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start("key"); }
  });
  button.addEventListener("keyup", (event) => {
    if ((event.key === " " || event.key === "Enter") && pointer === "key") { event.preventDefault(); end(); }
  });
  button.addEventListener("blur", end);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  return { end };
}

/** 作業台が見えていて、今の工程に縦の画面があるか（vertical.js の evaluate が見る）。 */
export const craftOpen = () => !!viewFor(liveBench());

export function createCraftScene(frame) {
  const bgHost = el("div.vtc-bg");
  const pic = el("div.vtc-pic", { dataset: { test: "vt-craft-pic" } }, [bgHost]);
  const veil = el("i.vtc-veil", { "aria-hidden": "true" });
  const steps = el("ol.vtc-steps", { "aria-label": "工程", dataset: { test: "vt-craft-steps" } });
  const rankArt = el("img", { alt: "", draggable: "false" });
  const rankBar = el("i");
  const rank = el("div.vtc-rank", { hidden: true, role: "img", dataset: { test: "vt-craft-rank" } }, [
    el("span.vtc-rank-box", [rankArt]), el("i.vtc-rank-meter", [rankBar]),
  ]);
  const thermo = createThermo(craftIcon);
  const sayText = el("span.vtc-say-text");
  const coach = el("button.vtc-coach", { type: "button", "aria-label": "スミさんの一言", dataset: { test: "vt-craft-coach" } }, [
    el("img", { src: SUMI_FACE, alt: "", draggable: "false" }), el("span.vtc-say", [sayText]),
  ]);
  const help = el("button.vtc-help", { type: "button", text: "?", "aria-label": "操作の説明", dataset: { test: "vt-craft-help" } });
  const ctrl = el("div.vtc-ctrl", { dataset: { test: "vt-craft-ctrl" } });
  const body = el("div.vtc-body", [el("div.vtc-telop", [coach, help]), ctrl]);
  // 本編の「?」の説明（工程の初回の「操作の説明」も同じ箱）を写す。閉じるは本編の「説明を閉じて進む」へ中継
  const guideTitle = el("b"), guideText = el("div.vtc-guide-text"), guideNote = el("small");
  const guideClose = el("button.vtc-guide-close", { type: "button", dataset: { test: "vt-craft-guide-close" } });
  const guide = el("div.vtc-guide", { hidden: true, role: "dialog", "aria-modal": "true", "aria-label": "操作の説明", dataset: { test: "vt-craft-guide" } }, [
    el("div.vtc-guide-card", [guideTitle, guideText, guideNote, guideClose]),
  ]);
  // 工程の結果の札（本編の .result-card）: 下の段の代わりに出し、「確認して次の工程へ」は本編のボタンへ中継する
  const resultMark = el("b.vtc-result-mark"), resultTitle = el("b.vtc-result-title"), resultLines = el("div.vtc-result-lines");
  const resultNext = el("button.vtc-result-next", { type: "button", dataset: { test: "vt-craft-result-next" } });
  const result = el("div.vtc-result", { hidden: true, role: "dialog", "aria-label": "工程の結果", dataset: { test: "vt-craft-result" } }, [
    el("div.vtc-result-card", [el("div.vtc-result-head", [resultMark, resultTitle]), resultLines, resultNext]),
  ]);
  // 始まりの 3・2・1・GO!（本編の .countdown）を絵の真ん中に写す
  const count = el("b.vtc-count", { hidden: true, "aria-live": "assertive", dataset: { test: "vt-craft-count" } });
  const root = el("div.vtc", { dataset: { test: "vt-craft" } }, [pic, veil, steps, rank, thermo.root, count, body, result, guide]);

  let bench = null, view = null, viewDef = null, panel = null, content = null;
  let stepSig = "", rankSig = "", guideSig = "", resultSig = "", countSig = "", coachText = null;

  const kit = { relay: relayTap, hold: holdButton, icon: craftIcon, img: IMG };
  const liveGuide = () => bench?.querySelector(".bench-guide");

  help.addEventListener("click", () => {
    const summary = liveGuide()?.querySelector(":scope > summary");
    if (summary) relayTap(summary);
  });
  coach.addEventListener("click", () => coach.classList.toggle("quiet"));
  resultNext.addEventListener("click", () => {
    const button = panel?.querySelector(":scope > .result-card:not(.done) .rc-next");
    if (button && !button.disabled) relayTap(button);
  });
  guideClose.addEventListener("click", () => {
    const live = liveGuide();
    const button = live?.querySelector('[data-test="bench-guide-close"]');
    if (button) relayTap(button);
    else if (live) live.open = false;
  });

  /** 工程の画面を差し替える（工程が替わった・本編の部品が作り直された時）。 */
  function mount(nextDef, nextPanel) {
    view?.leave?.();
    view?.pic.remove();
    viewDef = nextDef; panel = nextPanel;
    view = nextDef ? nextDef.create(kit) : null;
    root.dataset.step = nextDef?.id || "";
    coach.classList.remove("quiet");
    coachText = null;
    if (view) pic.append(view.pic);
    ctrl.replaceChildren(...(view ? [view.ctrl] : []));
  }

  /** 工程の並び（本編の .bench-phase。今の工程は .now、終えた工程は .seen）。 */
  function syncSteps() {
    const phases = [...bench.querySelectorAll(".bench-progress .bench-phase")];
    const state = (node) => node.classList.contains("now") ? "now" : node.classList.contains("seen") ? "done" : "";
    const sig = phases.map((node) => `${node.dataset.step}:${state(node)}`).join(",");
    if (sig === stepSig) return;
    stepSig = sig;
    steps.replaceChildren(...phases.map((node) => {
      const name = textOf(node.querySelector(".bench-phase-copy b")) || node.dataset.step;
      const paths = STEP_ICONS[node.dataset.step];
      const mark = paths ? craftIcon(paths) : craftIcon(node.querySelector("svg")?.innerHTML || "", "0 0 36 36");
      return el(`li${state(node) ? `.${state(node)}` : ""}`, {
        "aria-label": name, "aria-current": state(node) === "now" ? "step" : null, dataset: { step: node.dataset.step }, html: mark,
      });
    }));
  }

  /** 制作ランク（本編の .craft-rank。未計測・ランクの無い一台では出さない）。 */
  function syncRank() {
    const live = bench.querySelector(".craft-rank");
    const grade = GRADES.includes(live?.dataset.grade) ? live.dataset.grade : "";
    const meter = live?.querySelector(".craft-rank-meter");
    const progress = meter && !meter.hidden ? Math.max(0, Math.min(1, Number(meter.getAttribute("aria-valuenow")) / 100 || 0)) : 0;
    const sig = `${grade}|${progress.toFixed(3)}`;
    if (sig === rankSig) return;
    rankSig = sig;
    rank.hidden = !grade;
    if (!grade) return;
    const src = `${IMG}ui/craft-rank/rank-${grade}.webp`;
    if (rankArt.getAttribute("src") !== src) rankArt.src = src;
    rank.setAttribute("aria-label", `制作ランク ${grade}`);
    rank.style.setProperty("--p", progress.toFixed(3));
  }

  /** 本編の「?」の説明を写す。開いている間は、上に重ねて閉じるまで工程の操作を止める（本編も同じ間は操作を止めている）。 */
  function syncGuide() {
    const live = liveGuide();
    help.hidden = !live || live.hidden;
    const open = !!live?.open && !live.hidden;
    if (!open) {
      if (!guide.hidden) { guide.hidden = true; guideSig = ""; }
      return;
    }
    const tip = live.querySelector(".bench-guide-tip");
    const title = tip?.querySelector(":scope > b"), note = tip?.querySelector(":scope > small");
    const close = tip?.querySelector('[data-test="bench-guide-close"]');
    // 段落と補足（詰め方の一覧など）だけ。お手本の入口と、一台の仕上がりの記録は写さない
    const blocks = [...(tip?.children || [])].filter((node) => node !== title && node !== note && !node.hidden
      && !node.matches("button, .bench-demo-link, .craft-record-review"));
    const sig = JSON.stringify([textOf(title), blocks.map((node) => node.textContent), textOf(note), textOf(close)]);
    guide.hidden = false;
    if (sig === guideSig) return;
    guideSig = sig;
    guideTitle.textContent = textOf(title) || "操作の説明";
    guideText.replaceChildren(...blocks.map(plainCopy).filter(Boolean));
    guideNote.textContent = textOf(note);
    guideNote.hidden = !guideNote.textContent;
    guideClose.textContent = textOf(close) || "閉じる";
  }

  /** 工程の結果の札。題・評価の印・まとめ（無ければ詳しい行の先頭）と、次へ進むボタン。 */
  function syncResult() {
    const card = panel?.querySelector(":scope > .result-card:not(.done)");
    const button = card?.querySelector(".rc-next");
    if (!card || !button) {
      if (!result.hidden) { result.hidden = true; resultSig = ""; delete root.dataset.result; }
      return;
    }
    const summary = [...card.querySelectorAll(".rc-summary p")].map(textOf).filter(Boolean);
    const lines = summary.length ? summary : [...card.querySelectorAll(".rc-lines li")].map(textOf).filter(Boolean).slice(0, 3);
    const mark = card.querySelector(".rc-evaluation");
    const sig = JSON.stringify([textOf(card.querySelector(".rc-title")), textOf(mark), lines, textOf(button), button.disabled]);
    result.hidden = false;
    root.dataset.result = "on";
    if (sig === resultSig) return;
    resultSig = sig;
    resultTitle.textContent = textOf(card.querySelector(".rc-title"));
    resultMark.textContent = textOf(mark);
    resultMark.hidden = !mark;
    resultMark.dataset.tone = ["bright", "warm", "quiet"].find((tone) => mark?.classList.contains(tone)) || "";
    if (mark) resultMark.setAttribute("aria-label", mark.getAttribute("aria-label") || ""); else resultMark.removeAttribute("aria-label");
    resultLines.replaceChildren(...lines.map((text) => el("p", { text })));
    resultNext.textContent = textOf(button) || "次へ";
    resultNext.disabled = button.disabled;
  }

  /** 始まりの数え（本編の .countdown。穴あけは演出の層、炭焼きは炭壺の欄に出る）。 */
  function syncCount() {
    const live = document.querySelector("#fx > .countdown") || bench?.querySelector(".countdown");
    const text = textOf(live);
    count.hidden = !text;
    if (text === countSig) return;
    countSig = text;
    count.textContent = text;
    count.classList.toggle("go", /GO/.test(text));
    if (text) { count.classList.remove("pop"); void count.offsetWidth; count.classList.add("pop"); }
  }

  function sync() {
    bench = liveBench();
    const nextDef = viewFor(bench);
    const nextPanel = bench?.querySelector(".bench-panel") || null;
    // 本編の工程の部品を作り直した時（やり直し・同じ工程の2回目）も、外枠の画面を作り直す
    const nextContent = nextPanel?.firstElementChild || null;
    if (nextDef !== viewDef || nextPanel !== panel || (nextContent !== content && !nextDef?.persist)) mount(nextDef, nextPanel);
    content = nextContent;
    if (!bench || !view) return;
    const bg = liveBackground();
    frame.setAmbient(bg ? cssUrl(getComputedStyle(bg).backgroundImage) : "");
    mirrorBackground(bgHost, { focusX: 30, focusY: 50 });
    syncSteps();
    syncRank();
    view.sync(panel, bench);
    const say = view.coach(bench);
    if (say !== coachText) { coachText = say; sayText.textContent = say; }
    thermo.sync(view.thermo?.(bench) || null);
    syncCount();
    syncResult();
    syncGuide();
  }

  return {
    name: "craft",
    layout: "full", // 下画面（十字キーと丸ボタン）を出さず、工程ごとの操作を画面いっぱいの中に置く
    enter() {
      frame.over.append(root);
      frame.over.hidden = false;
      frame.setHud("none");
      frame.setAccent("#ffc978");
      stepSig = rankSig = guideSig = resultSig = countSig = ""; coachText = null;
      guide.hidden = true;
      result.hidden = true; delete root.dataset.result;
      count.hidden = true;
      sync();
    },
    leave() { mount(null, null); content = null; bench = null; delete bgHost.dataset.sig; },
    sync,
    relayout() {},
    dir() {}, a() {}, chip() {}, tap() {},
  };
}

// 説明の文の写しに使う要素（本編のクラスや属性は持ち込まない。本編の CSS が外枠に効かないように）
const PLAIN_TAGS = new Set(["P", "UL", "OL", "LI", "B", "STRONG", "SPAN", "SMALL", "EM", "BR", "DIV"]);
/** 本編の説明の段落・箇条書きを、文と並びだけ写す。 */
function plainCopy(node) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE || node.hidden || node.getAttribute("aria-hidden") === "true") return null;
  const tag = PLAIN_TAGS.has(node.tagName) ? node.tagName.toLowerCase() : "span";
  const copy = document.createElement(tag === "div" ? "div" : tag);
  for (const child of node.childNodes) {
    const part = plainCopy(child);
    if (part) copy.append(part);
  }
  return copy.childNodes.length ? copy : null;
}
