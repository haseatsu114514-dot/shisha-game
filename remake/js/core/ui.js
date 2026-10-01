// 画面の土台: 背景・画面切替・煙ワイプ・トースト・ステ通知・モーダル・カウントダウン・スタンプ。
import { $, el, sleep, nextFrame } from "./util.js";
import { on } from "./bus.js";
import { SE } from "./audio.js";
import { state } from "./state.js";
import { DB, displayName, faceIconUrl } from "./data.js";
import { renderSceneArt, sceneArtUrls } from "./scene-art.js";

export const layers = {};

export function initLayers() {
  for (const id of ["bg", "screen", "vn", "hud", "fx", "toasts", "banners", "wipe", "modal"]) {
    layers[id] = $(`#${id}`);
  }
  // 報酬カード（旧版の Persona 風カードを踏襲）。ステはステ色の漢字バッジ、好感度は顔＋ハート
  on("stat-gain", ({ key, name, word, starUp, rank, star }) => {
    // ★が上がったら、何が楽になったかを一言添える（旧版の★UP効果トースト）
    const fx = starUp ? DB.statusTexts?.statTierFx?.[key]?.[star - 1] : "";
    gainCard({ kind: "stat", stat: key, badge: STAT_BADGE[key], top: starUp ? `RANK UP ★${star}` : "STATUS UP", main: name, sub: starUp ? `${word} ──「${rank}」` : word, fx });
  });
  on("affinity-gain", ({ id, level, levelUp, prevPts, pts, bond }) => {
    if (!id || id === "???" || !state?.met?.[id]) return;
    gainCard({
      kind: "affinity",
      face: faceIconUrl(id),
      badge: [...displayName(id, state)][0],
      top: bond ? (levelUp ? "BOND UP" : "BOND") : levelUp ? "AFFINITY UP" : "AFFINITY",
      main: displayName(id, state),
      sub: bond
        ? (levelUp ? `恋人との絆が深まった（Lv.${level}）` : "心の距離が少し近づいた")
        : levelUp ? `好感度が ♥${level} に上がった！` : "少し打ち解けた気がする",
      hearts: { from: heartState(prevPts), to: heartState(pts) },
    });
  });
  on("notice", ({ text }) => toast(text, { ms: 3000 }));
  on("lovers", ({ id }) => {
    gainCard({ kind: "affinity", face: faceIconUrl(id), badge: "♥", top: "NEW RELATIONSHIP", main: displayName(id, state), sub: "恋人になった" });
  });
}

// ---------------------------------------------------------------- 背景（クロスフェード）

let bgNow = "";
const bgReady = new Map(); // url -> Promise（一度読んだ絵は即座に出す）

/** 画像を読み込み＋デコードし終えるまで待つ（最大 ms）。失敗しても先へ進む */
export function imageReady(url, ms = 1500) {
  if (!url) return Promise.resolve();
  let p = bgReady.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const i = new Image();
      i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(resolve);
      i.onerror = resolve;
      i.src = url;
    });
    bgReady.set(url, p);
  }
  return Promise.race([p, sleep(ms)]);
}

/**
 * 背景を差し替える。新しい絵が読み込めてからクロスフェードする（読み込み中に黒や前の絵のまま
 * 新しい場面が始まって見えるのを防ぐ）。戻り値の Promise で「絵が出た」を待てる
 */
export function setBg(url, { instant = false, tint = null, fast = false } = {}) {
  const host = layers.bg;
  const key = `${url}|${tint || ""}`;
  if (key === bgNow) return Promise.resolve();
  bgNow = key;
  return Promise.all(sceneArtUrls(url).map((u) => imageReady(u))).then(() => {
    if (bgNow !== key) return; // 待っている間に別の背景が指定された
    const next = el("div.bg-img");
    renderSceneArt(next, url);
    if (!url) next.classList.add("black");
    if (fast) next.classList.add("fast");
    if (tint) next.dataset.tint = tint;
    host.append(next);
    const olds = [...host.children].slice(0, -1);
    if (instant) {
      next.classList.add("show");
      olds.forEach((o) => o.remove());
      return;
    }
    requestAnimationFrame(() => next.classList.add("show"));
    setTimeout(() => olds.forEach((o) => o.remove()), fast ? 260 : 700);
  });
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

/** 今出ている画面を「済み」にする（次の会話・画面で片付く） */
export function retireScreen() {
  layers.screen.querySelectorAll(":scope > :not(.done)").forEach((n) => n.classList.add("done"));
}

/** 選択が済んだ（retire した）画面を片付ける。会話が始まるときに呼ぶ＝前の画面が会話の後ろに残らない */
export function dropRetired() {
  layers.screen.querySelectorAll(":scope > .done").forEach((n) => n.remove());
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
const STAT_BADGE = { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "観" };
const AFF_PTS = [0, 9, 20, 33, 48, 66]; // stats.js の AFFINITY_RANK_PTS と同じ段階
/** 好感度ポイント → 5つのハートそれぞれの塗り率（%） */
function heartState(pts = 0) {
  let lv = 0;
  for (let i = 1; i < AFF_PTS.length; i++) if (pts >= AFF_PTS[i]) lv = i;
  const frac = lv >= 5 ? 1 : (pts - AFF_PTS[lv]) / (AFF_PTS[lv + 1] - AFF_PTS[lv]);
  return [0, 1, 2, 3, 4].map((i) => (i < lv ? 100 : i === lv ? Math.round(frac * 100) : 0));
}

const bannerQueue = [];
let bannerBusy = 0;
/** 汎用の短い通知（見出し＋補足） */
export function banner(title, sub = null) {
  gainCard({ kind: "info", badge: "!", top: "NOTICE", main: title, sub });
}
/**
 * 報酬カード。kind: stat | affinity | info
 * @param o.badge 丸バッジの一字 / o.face 顔ドット絵（あればバッジの代わり）/ o.hearts {from:[%×5], to:[%×5]}
 */
export function gainCard(o) {
  bannerQueue.push(o);
  pumpBanners();
}
function pumpBanners() {
  while (bannerBusy < 3 && bannerQueue.length) {
    const o = bannerQueue.shift();
    bannerBusy++;
    const hearts = o.hearts ? el("div.gc-hearts", o.hearts.from.map((f) => el("i", { style: { "--fill": `${f}%` } }))) : null;
    const b = el(`div.gain-card.${o.kind}${o.stat ? `.st-${o.stat}` : ""}`, [
      o.face ? el("img.gc-badge.face", { src: o.face, alt: "" }) : el("div.gc-badge", { text: o.badge || "+" }),
      el("div.gc-meta", [
        el("span.gc-top", { text: o.top }),
        el("span.gc-main", { text: o.main }),
        o.sub ? el("span.gc-sub", { text: o.sub }) : null,
        o.fx ? el("span.gc-fx", { text: o.fx }) : null,
        hearts,
      ]),
    ]);
    layers.banners.append(b);
    if (o.kind === "stat") SE.select();
    requestAnimationFrame(() => {
      b.classList.add("show");
      // 1拍おいてから今の値へ → ハートの中身が「ぐいーん」と伸びる
      if (hearts) setTimeout(() => hearts.querySelectorAll("i").forEach((h, i) => h.style.setProperty("--fill", `${o.hearts.to[i]}%`)), 260);
    });
    const hold = o.fx ? 3200 : o.hearts && o.hearts.to.join() !== o.hearts.from.join() ? 2600 : 2200;
    setTimeout(() => {
      b.classList.remove("show");
      b.classList.add("out");
      setTimeout(() => { b.remove(); bannerBusy--; pumpBanners(); }, 420);
    }, hold);
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
