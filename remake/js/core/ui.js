// 画面の土台: 背景・画面切替・煙ワイプ・トースト・ステ通知・モーダル・カウントダウン・スタンプ。
import { $, el, sleep, nextFrame } from "./util.js";
import { on } from "./bus.js";
import { SE } from "./audio.js";

export const layers = {};

export function initLayers() {
  for (const id of ["bg", "screen", "vn", "hud", "fx", "toasts", "banners", "wipe", "modal"]) {
    layers[id] = $(`#${id}`);
  }
  on("stat-gain", ({ name, word, starUp, rank }) => {
    banner(`【${name}】が${word}`, starUp ? `★が増えた ──「${rank}」` : null);
  });
}

// ---------------------------------------------------------------- 背景（クロスフェード）

let bgNow = "";
export function setBg(url, { instant = false, tint = null } = {}) {
  const host = layers.bg;
  const key = `${url}|${tint || ""}`;
  if (key === bgNow) return;
  bgNow = key;
  const next = el("div.bg-img", { style: { backgroundImage: url ? `url("${url}")` : "none" } });
  if (tint) next.dataset.tint = tint;
  host.append(next);
  const olds = [...host.children].slice(0, -1);
  if (instant) {
    next.classList.add("show");
    olds.forEach((o) => o.remove());
    return;
  }
  requestAnimationFrame(() => next.classList.add("show"));
  setTimeout(() => olds.forEach((o) => o.remove()), 700);
}

// ---------------------------------------------------------------- 画面

/** 画面を差し替える。name は CSS の data-screen（見た目の切替）とテスト用 */
export function showScreen(name, node) {
  const host = layers.screen;
  host.dataset.screen = name;
  host.replaceChildren(node || el("div"));
  document.body.dataset.screen = name;
  return node;
}

/** 選択が済んだ画面を操作不能にする（次の画面が出るまでの間に古いボタンを押せないように） */
export function retire(node) {
  node?.classList.add("done");
}

export function clearScreen() {
  showScreen("none", null);
}

// ---------------------------------------------------------------- 煙ワイプ（遷移の共通部品・master_spec #20）

/** 画面を白煙で覆い、覆った瞬間に mid() を実行してから晴らす */
export async function smokeWipe(mid, { color = "light" } = {}) {
  const w = layers.wipe;
  w.dataset.color = color;
  w.classList.remove("clear");
  w.classList.add("cover");
  SE.whoosh();
  await sleep(620);
  if (mid) await mid();
  await nextFrame();
  w.classList.add("clear");
  await sleep(700);
  w.classList.remove("cover", "clear");
}

export async function fadeBlack(mid, ms = 500) {
  const w = layers.wipe;
  w.dataset.color = "black";
  w.classList.add("black");
  await sleep(ms);
  if (mid) await mid();
  w.classList.remove("black");
  await sleep(ms);
}

// ---------------------------------------------------------------- トースト／通知

export function toast(text, { ms = 2600, kind = "" } = {}) {
  const t = el(`div.toast${kind ? "." + kind : ""}`, { text });
  layers.toasts.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, ms);
}

// ステ上昇などのバナー（右上から順に積む・同時に出すのは数枚まで）
const bannerQueue = [];
let bannerBusy = 0;
export function banner(title, sub = null) {
  bannerQueue.push({ title, sub });
  pumpBanners();
}
function pumpBanners() {
  while (bannerBusy < 3 && bannerQueue.length) {
    const { title, sub } = bannerQueue.shift();
    bannerBusy++;
    const b = el("div.banner", [el("b", { text: title }), sub ? el("small", { text: sub }) : null]);
    layers.banners.append(b);
    SE.select();
    requestAnimationFrame(() => b.classList.add("show"));
    setTimeout(() => {
      b.classList.remove("show");
      setTimeout(() => { b.remove(); bannerBusy--; pumpBanners(); }, 400);
    }, sub ? 2600 : 2000);
  }
}
/** バナーが全部はけるまで待つ（暗転の前などに呼ぶ） */
export async function bannersIdle() {
  await sleep(750); // 合算窓（stats の MERGE_MS）ぶんは待つ
  while (bannerBusy || bannerQueue.length) await sleep(120);
}

// ---------------------------------------------------------------- モーダル

/** 選択肢つきのモーダル。options: [{label, value, primary, test}] */
export function modal({ title = "", body = "", options = [{ label: "OK", value: true, primary: true }], className = "" }) {
  return new Promise((resolve) => {
    const box = el(`div.modal-box${className ? "." + className : ""}`, [
      title ? el("h3", { text: title }) : null,
      typeof body === "string" ? el("div.modal-body", { html: body }) : el("div.modal-body", [body]),
      el("div.modal-actions", options.map((o) =>
        el(`button.btn${o.primary ? ".primary" : ""}`, {
          text: o.label,
          dataset: { test: o.test || "" },
          onclick: () => { SE.select(); close(); resolve(o.value); },
        })
      )),
    ]);
    const close = () => { layers.modal.classList.remove("show"); layers.modal.replaceChildren(); };
    layers.modal.replaceChildren(el("div.modal-backdrop"), box);
    layers.modal.classList.add("show");
  });
}

// ---------------------------------------------------------------- 演出パーツ

/** タイミング系ミニゲームの前に必ず挟む 3・2・1（CLAUDE.md の約束） */
export async function countdown(host = layers.fx) {
  const c = el("div.countdown");
  host.append(c);
  for (const n of ["3", "2", "1"]) {
    c.textContent = n;
    c.classList.remove("pop");
    void c.offsetWidth;
    c.classList.add("pop");
    SE.tick();
    await sleep(560);
  }
  c.textContent = "GO!";
  c.classList.remove("pop");
  void c.offsetWidth;
  c.classList.add("pop", "go");
  SE.select();
  await sleep(380);
  c.remove();
}

/** 判定スタンプ（PERFECT / JUST IGNITION!! など）。host の中央に一瞬出す */
export function stamp(text, { host = layers.fx, kind = "", x = "50%", y = "42%" } = {}) {
  const s = el(`div.stamp${kind ? "." + kind : ""}`, { text, style: { left: x, top: y } });
  host.append(s);
  setTimeout(() => s.remove(), 1100);
}

export function flash(kind = "white", ms = 260) {
  const f = el(`div.flash.${kind}`);
  layers.fx.append(f);
  setTimeout(() => f.remove(), ms + 60);
}

export function shake(target = document.getElementById("stage"), ms = 380) {
  target.classList.remove("shake");
  void target.offsetWidth;
  target.classList.add("shake");
  setTimeout(() => target.classList.remove("shake"), ms);
}

/** 章タイトル（煙の中から浮かぶ） */
export async function chapterTitle({ no, name, read, sub }) {
  const card = el("div.chapter-card", [
    el("div.cc-no", { text: no }),
    el("div.cc-name", { text: name }),
    el("div.cc-read", { text: read }),
    sub ? el("div.cc-sub", { text: sub }) : null,
  ]);
  layers.fx.append(card);
  SE.jingle();
  await nextFrame();
  card.classList.add("show");
  await sleep(3200);
  card.classList.add("out");
  await sleep(900);
  card.remove();
}

/** DAYカード（日付の区切り）。クリックを吸い込み、読み終わるまで待つ */
export async function dayCard(title, sub, { ms = 1900 } = {}) {
  const card = el("div.day-card", [el("div.dc-title", { text: title }), sub ? el("div.dc-sub", { text: sub }) : null]);
  layers.fx.append(card);
  await nextFrame();
  card.classList.add("show");
  await sleep(ms);
  card.classList.add("out");
  await sleep(500);
  card.remove();
}

/** 中央の見出し帯（「ROUND 2」など） */
export async function roundCut(text, sub = "") {
  const c = el("div.round-cut", [el("b", { text }), sub ? el("small", { text: sub }) : null]);
  layers.fx.append(c);
  SE.whoosh();
  await nextFrame();
  c.classList.add("show");
  await sleep(1300);
  c.classList.add("out");
  await sleep(450);
  c.remove();
}
