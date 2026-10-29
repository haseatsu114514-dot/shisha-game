// LIME交換（#931）。実際の連絡先交換を読んだ直後だけ、はじめのスマホの画面で見せる。
// 友だち追加の画面 →「追加」をタップ → 友だち一覧に1行増える。端末・色・アカウント名はゲーム内のLIME（daily/phone.js）と同じ。
// a: アイコンが一覧のいちばん上へ飛んで収まる／b: 画面ごと横にスライドし、新しい行が上から入る（?movar=b）。
// 友だち一覧はこの演出の中だけの画面で、ゲーム内のLIME（トーク一覧）は変えない。
// DOMの初期値は「終わった画面」。動きは最初にまとめて予約し、fill で途中の見た目を作る（動きを減らす設定はそのまま見せる）。
import { el, sleep } from "../core/util.js";
import { state } from "../core/state.js";
import { DB, displayName, faceIconUrl } from "../core/data.js";
import { customLimeIconUrl } from "../daily/lime-icons.js";
import { imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { move, svg } from "../core/transition-kit.js";
import { MG_EASE as E, motionVariant } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// 器はスマホとその周りだけ。横長はPCと同じ大きさ、縦長のDSでも端末を大きく見せる。
export const BOX_W = 560, BOX_H = 720;
const ROWS = 6; // 一覧に見せる行（新しい1行を含む）
const ROW_H = 76;
// 画面（ステータスバーの下）の中の位置。lime.css と同じ値
const ICON = { x: 109, y: 170, size: 136 }; // 友だち追加の画面の大きなアイコン
const ROW_ICON = { x: 16, y: 48 + 12, size: 52 }; // 一覧のいちばん上の行のアイコン
const FLY = {
  x: ROW_ICON.x + ROW_ICON.size / 2 - (ICON.x + ICON.size / 2),
  y: ROW_ICON.y + ROW_ICON.size / 2 - (ICON.y + ICON.size / 2),
  scale: ROW_ICON.size / ICON.size,
};
const SLIDE = 354; // 画面の幅（b の横スライド）

// お仕事用と私用でアカウントが分かれる相手（daily/phone.js の PRIVATE_ACCOUNTS と同じ）
const PRIVATE_FACE = { minto: "oneesan" };

/** トーク一覧と同じアカウント名（daily/phone.js の limeName と同じ規則）。private は私用のアカウント */
function accountName(id, context) {
  const c = DB.characters?.[id];
  if (context === "private") return c?.private_name || displayName(id, state, { context });
  return c?.lime_name || displayName(id, state, { context: "private" });
}
const faceOf = (id, context) => (context !== "private" && customLimeIconUrl(id)) || faceIconUrl(context === "private" && PRIVATE_FACE[id] || id, state, { context });

/** 交換の前からつながっていた相手（新しい順）。今つながった相手は含めない */
function earlierFriends(charId, context) {
  const ids = [...(state.contacts || [])];
  for (const [flag, on] of Object.entries(state.flags || {})) {
    const m = on && /^_lime_contact_(.+)$/.exec(flag);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  const list = ids.filter((id) => id !== charId || context === "private").map((id) => ({ id, context: null }));
  if (state.flags?._lime_exchange_shown_minto_private && !(charId === "minto" && context === "private")) {
    list.push({ id: "minto", context: "private" });
  }
  return list.filter((f) => f.id === "sumi" || state.met?.[f.id]).reverse();
}

function face(cls, url, name) {
  if (!url) return el(`span.${cls}.blank`, { text: [...name][0] || "？" });
  const custom = url.includes("/ui/lime/");
  return el(`img.${cls}${custom ? ".custom" : ""}`, { src: url, alt: "", onerror: (e) => e.currentTarget.replaceWith(el(`span.${cls}.blank`, { text: [...name][0] || "？" })) });
}

function friendRow(friend, isNew) {
  const name = accountName(friend.id, friend.context);
  const icon = face("mo-lime-face", isNew ? friend.url : faceOf(friend.id, friend.context), name);
  // 長いアカウント名（みんと＠ぺぱーみんと）は省略せず、字を縮めて行に収める（NEWの札がある行は狭い）
  const room = isNew ? 182 : 256, size = Math.max(16, Math.min(22, Math.floor(room / [...name].length)));
  const label = el("b", { text: name, style: size < 22 ? { fontSize: `${size}px` } : {} });
  const tag = isNew ? el("span.mo-lime-new", { text: "NEW" }) : null;
  return { node: el(`div.mo-lime-row${isNew ? ".new" : ""}`, [icon, label, tag]), icon, label, tag };
}

/** 端末の部品をまとめて組む（終わった画面の状態） */
function buildPhone(charId, context, url) {
  const name = accountName(charId, context);
  const earlier = earlierFriends(charId, context);
  const chars = [...name].map((ch) => el("span", { text: ch }));
  const nameLine = el("div.mo-lime-name", { style: chars.length > 9 ? { fontSize: `${Math.max(18, Math.floor(290 / chars.length))}px` } : {} }, chars);
  const ring = el("div.mo-lime-ring");
  const sparks = [[-92, -50, "#ffffff"], [86, -78, "#d8ffc0"], [96, 30, "#ffffff"], [-84, 54, "#d8ffc0"]].map(([dx, dy, color]) =>
    el("i.mo-lime-spark", { style: { left: `${ICON.x + ICON.size / 2 + dx - 11}px`, top: `${ICON.y + ICON.size / 2 + dy - 11}px`, background: color } }));
  const label = el("span.mo-lime-add-label", { text: "追加" });
  const ripple = el("i.mo-lime-ripple");
  const check = svgCheck();
  const addButton = el("div.mo-lime-add", [ripple, label, check.svg]);
  const profile = el("div.mo-lime-page.profile", [
    el("div.mo-lime-bar", [el("span.mo-lime-back", { text: "‹" }), el("span", { text: "友だち追加" })]),
    el("div.mo-lime-cover"), ring, ...sparks, nameLine, addButton,
  ]);

  const fresh = friendRow({ id: charId, context, url }, true);
  const rows = earlier.slice(0, ROWS - 1).map((f) => friendRow(f, false));
  const total = earlier.length + 1;
  const oldCount = el("span.old", { text: String(total - 1) });
  const newCount = el("span.now", { text: String(total) });
  const friends = el("div.mo-lime-page.friends", [
    el("div.mo-lime-bar", [el("span.mo-lime-logo", { text: "LIME" }), el("span", [
      "友だち ", el("span.mo-lime-count", [oldCount, newCount]),
    ])]),
    el("div.mo-lime-rows", [fresh.node, ...rows.map((r) => r.node)]),
  ]);
  const big = face("mo-lime-icon", url, name);
  const toast = el("div.mo-lime-toast", { text: "友だちに追加しました" });
  const pages = el("div.mo-lime-pages", [friends, profile, big, toast]);
  const phone = el("div.mo-lime-phone", [
    el("div.mo-lime-notch"),
    el("div.mo-lime-status", [el("span", { text: state.slot >= 1 ? "夜" : "昼" }), el("span"), el("span", { text: "●●●▱" })]),
    pages,
  ]);
  const finger = el("div.mo-lime-finger");
  return { phone, finger, profile, friends, big, ring, sparks, chars, addButton, label, ripple, check, fresh, rows, oldCount, newCount, toast };
}

function svgCheck() {
  const path = svg("path", { d: "M6 18 L14 26 L29 9", fill: "none", stroke: "#fff", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1 });
  return { svg: svg("svg", { viewBox: "0 0 34 34", class: "mo-lime-check" }, [path]), path };
}

// 動きの予約。fill:"both" は始まる前の見た目も作る（初期値が終わった画面の部品）、"forwards" は始まるまで初期値のまま
const at = (node, frames, ms, delay, { fill = "both", easing = E.out } = {}) => move(node, frames, ms, { delay, fill, easing });

/** 共通の前半: スマホが上がる → アイコン・名前・ボタンが出る → 指でタップ → ✓。✓の音を鳴らす時刻（ms）を返す */
function playProfile(back, ui) {
  at(back, [{ opacity: 0 }, { opacity: 1 }], 300, 0, { easing: "linear" });
  at(ui.phone, [{ transform: "translateY(740px)" }, { transform: "none" }], 560, 0);
  at(ui.profile, [{ opacity: 1 }, { opacity: 1 }], 1, 0);
  at(ui.big, [
    { opacity: 1, transform: "translate(0px, 0px) scale(0)" },
    { opacity: 1, transform: "translate(0px, 0px) scale(1.08)", offset: 0.65, easing: "cubic-bezier(.33,1,.68,1)" },
    { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
  ], 460, 420, { easing: E.back });
  at(ui.ring, [{ opacity: 0.9, transform: "scale(.7)" }, { opacity: 0, transform: "scale(1.6)" }], 560, 470, { fill: "forwards" });
  ui.sparks.forEach((s, i) => at(s, [
    { opacity: 0, transform: "scale(0) rotate(0deg)" },
    { opacity: 1, transform: "scale(1) rotate(45deg)", offset: 0.4 },
    { opacity: 0, transform: "scale(0) rotate(90deg)" },
  ], 620, 520 + i * 70, { fill: "forwards", easing: "linear" }));
  ui.chars.forEach((c, i) => at(c, [{ opacity: 0, transform: "translateY(.6em)" }, { opacity: 1, transform: "none" }], 380, 600 + i * 36));
  at(ui.addButton, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], 340, 760);
  // 指先が「追加」を押す
  at(ui.finger, [
    { opacity: 0, transform: "translate(150px, 210px)" },
    { opacity: 1, transform: "none", offset: 0.34, easing: "cubic-bezier(.2,.8,.3,1)" },
    { opacity: 1, transform: "scale(.82)", offset: 0.44 },
    { opacity: 1, transform: "none", offset: 0.56 },
    { opacity: 1, transform: "none", offset: 0.7 },
    { opacity: 0, transform: "translate(46px, 70px)" },
  ], 720, 1140, { fill: "forwards", easing: "linear" });
  at(ui.addButton, [{ transform: "none" }, { transform: "scale(.95)", offset: 0.4 }, { transform: "none" }], 200, 1380, { fill: "forwards" });
  at(ui.ripple, [{ opacity: 0.5, transform: "scale(0)" }, { opacity: 0, transform: "scale(1)" }], 460, 1400, { fill: "forwards" });
  at(ui.label, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.7)" }], 140, 1440);
  at(ui.check.path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 320, 1480);
  return 1500; // ✓ を描き始める時刻（音）
}

/** a: アイコンが一覧のいちばん上へ飛び、ほかの行が1段下がる */
function scheduleA(ui) {
  const T = 1840;
  at(ui.profile, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.97)" }], 320, T, { fill: "forwards" });
  at(ui.friends, [{ opacity: 0 }, { opacity: 1 }], 300, T, { easing: "linear" });
  at(ui.big, [
    { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
    { opacity: 1, transform: `translate(${FLY.x}px, ${FLY.y}px) scale(${FLY.scale})` },
  ], 480, T, { fill: "forwards", easing: E.inOut });
  const land = T + 480;
  at(ui.big, [{ opacity: 1 }, { opacity: 0 }], 1, land, { fill: "forwards" });
  at(ui.fresh.icon, [{ opacity: 0 }, { opacity: 1 }], 1, land);
  at(ui.fresh.node, [{ backgroundColor: "#ffffff" }, { backgroundColor: "#d7f5df", offset: 0.3 }, { backgroundColor: "#f1faf3" }], 700, land, { fill: "forwards" });
  return finishList(ui, T + 60, land);
}

/** b: 画面ごと横にスライドし、新しい行が上から入る */
function scheduleB(ui) {
  const T = 1840;
  at(ui.profile, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-90px)" }], 380, T, { fill: "forwards", easing: E.inOut });
  at(ui.big, [{ opacity: 1, transform: "translate(0px, 0px) scale(1)" }, { opacity: 0, transform: "translate(-90px, 0px) scale(1)" }], 380, T, { fill: "forwards", easing: E.inOut });
  at(ui.friends, [{ transform: `translateX(${SLIDE}px)` }, { transform: "none" }], 380, T, { easing: E.inOut });
  const drop = T + 420;
  at(ui.fresh.node, [
    { opacity: 0, transform: `translateY(-${ROW_H * 0.6}px)` },
    { opacity: 1, transform: "none" },
  ], 360, drop + 80);
  at(ui.fresh.icon, [
    { transform: "scale(0)" },
    { transform: "scale(1.14)", offset: 0.6 },
    { transform: "none" },
  ], 420, drop + 160, { easing: E.back });
  return finishList(ui, drop, drop + 160);
}

/** 共通の後半: ほかの行が1段下がり、名前とNEW、友だちの数、通知の帯。帯が出きる時刻（ms）を返す */
function finishList(ui, shift, land) {
  ui.rows.forEach((r, i) => at(r.node, [{ transform: `translateY(-${ROW_H}px)` }, { transform: "none" }], 420, shift + i * 26));
  at(ui.fresh.label, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], 300, land + 40);
  if (ui.fresh.tag) at(ui.fresh.tag, [{ opacity: 0, transform: "scale(0)" }, { opacity: 1, transform: "scale(1.15)", offset: 0.6 }, { opacity: 1, transform: "none" }], 340, land + 120, { easing: E.back });
  at(ui.oldCount, [{ transform: "none" }, { transform: "translateY(-100%)" }], 300, land + 80);
  at(ui.newCount, [{ transform: "translateY(100%)" }, { transform: "none" }], 300, land + 80);
  const toast = land + 260;
  at(ui.toast, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], 280, toast);
  return toast + 280;
}

export async function exchange(charId, context = null, { still = false } = {}) {
  const owner = state;
  const url = faceOf(charId, context);
  const ready = url && await imageReady(url, 3000);
  if (state !== owner) return;
  await stagePlay("lime", async (node) => {
    // stagePlayも最初のフレームを待つため、画面を組む直前にLOADを再確認する。
    if (state !== owner) return;
    const ui = buildPhone(charId, context, ready ? url : null);
    const scene = el("div.mo-lime-scene", { style: {
      position: "absolute", left: "50%", top: "50%", width: `${BOX_W}px`, height: `${BOX_H}px`,
      transformOrigin: "center",
    } }, [ui.phone, ui.finger]);
    const fit = () => {
      const scale = Math.min(node.clientWidth / BOX_W, node.clientHeight / BOX_H);
      scene.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    const back = backdrop("rgba(5, 4, 10, 0.62)");
    node.append(back, scene);
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(node);
    try {
      if (still) {
        // 動きを減らす設定: 友だちに追加し終えた画面をそのまま見せて消す。
        SE.phone();
        await sleep(1500);
        return;
      }
      const ding = playProfile(back, ui);
      const shown = motionVariant("lime") === "b" ? scheduleB(ui) : scheduleA(ui);
      await sleep(ding);
      SE.phone();
      await sleep(shown - ding + 560);
      await Promise.all([
        move(ui.phone, [{ transform: "none" }, { transform: "translateY(740px)" }], 380, { easing: E.in, fill: "forwards" }),
        move(node, [{ opacity: 1 }, { opacity: 0 }], 380, { fill: "forwards" }),
      ]);
    } finally {
      resize.disconnect();
    }
  });
}
