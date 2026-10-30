// 画面の土台: 背景・画面切替・煙ワイプ・トースト・ステ通知・モーダル・カウントダウン・スタンプ。
import { $, el, sleep, nextFrame } from "./util.js";
import { on } from "./bus.js";
import { SE, setRainAmbience } from "./audio.js";
import { state, STAT_KEYS } from "./state.js";
import { DB, displayName, faceIconUrl, allFaceIconUrls, assetUrl } from "./data.js";
import { AFFINITY_RANK_PTS } from "./stats.js";
import { nextStepProgress } from "./stat-progress.js";
import { renderSceneArt, sceneArtUrls } from "./scene-art.js";
import { rainScene, weatherSkyTone, weatherViewKind, renderWeatherLayer } from "../daily/weather.js";
import { createSceneCurtain, nightToMorning, isCovering, takeSceneArrival } from "./transitions.js";
import { allStoreLogoUrls } from "./store-logos.js";
import { chapterTitleArt } from "./chapter-title-art.js";
import { uiThemeFrame } from "./ui-theme.js";
import { withLoadingNotice } from "./module-loading.js";
import { loadingPrefetch, prepareImage } from "./loading-prefetch.js";

export const layers = {};

export function initLayers() {
  if (!$("#weather")) $("#stage").insertBefore(el("div#weather", { "aria-hidden": "true" }), $("#screen"));
  layers.weather = $("#weather");
  document.addEventListener("visibilitychange", refreshWeather);
  window.addEventListener("pagehide", () => setRainAmbience(null));
  window.addEventListener("pageshow", refreshWeather);
  for (const id of ["bg", "screen", "vn", "hud", "fx", "toasts", "banners", "wipe", "modal"]) {
    layers[id] = $(`#${id}`);
  }
  // 報酬カード（旧版の Persona 風カードを踏襲）。ステはステ色の漢字バッジ、好感度は顔＋ハート
  on("stat-gain", ({ key, total, name, starUp: stepped, star: currentStep }) => {
    const fx = stepped ? DB.statusTexts?.statTierFx?.[key]?.[currentStep - 1] : "";
    const progress = nextStepProgress(key);
    gainCard({ kind: "stat", stat: key, points: stepped ? 0 : total, badge: STAT_BADGE[key], top: stepped ? "STEP UP" : "STATUS UP",
      main: stepped ? `${name} ${currentStep}段に上がった` : name, evolution: stepped, fx, progress });
  });
  on("affinity-gain", ({ id, level, levelUp, prevPts, pts, bond }) => {
    if (!id || id === "???" || !state?.met?.[id]) return;
    gainCard({
      kind: "affinity",
      bond: !!bond,
      face: faceIconUrl(id, state, { context: bond ? "private" : null }),
      badge: [...displayName(id, state, { context: bond ? "private" : null })][0],
      top: bond ? (levelUp ? "BOND UP" : "BOND") : levelUp ? "AFFINITY UP" : "AFFINITY",
      main: displayName(id, state, { context: bond ? "private" : null }), // 恋人の絆は私的な場面でだけ深まる
      sub: bond
        ? (levelUp ? "恋人との絆が深まった" : "心の距離が少し近づいた")
        : levelUp ? `仲が深まった（♥${level}）` : "好感度が少し上がった",
      // The private growth remains hidden; lovers' ordinary hearts stay full.
      hearts: bond ? { from: Array(5).fill(100), to: Array(5).fill(100) }
        : { from: heartState(prevPts), to: heartState(pts) },
    });
  });
  on("notice", ({ text }) => toast(text, { ms: 3000 }));
  on("lovers", ({ id }) => {
    gainCard({ kind: "affinity", bond: true, face: faceIconUrl(id, state, { context: "private" }), badge: "♥", top: "NEW RELATIONSHIP", main: displayName(id, state, { context: "private" }), sub: "恋人になった" });
  });
}

// ---------------------------------------------------------------- 背景（クロスフェード）

let bgNow = "";
let bgTask = Promise.resolve();
let bgAssetsReady = Promise.resolve();
let activeCurtain = null;
let weatherBg = "";
let weatherTint = "";
let weatherKey = "";
const bgReady = new Map(); // url -> Promise（一度読んだ絵は即座に出す）
const expiredImageWaits = new WeakMap(); // 同じ通信に対し、使い切った待ち時間を繰り返さない

const keptImages = []; // 何度も出るUIの小さな絵は Image を持ち続ける（デコード済みのまま置いておく）

/** 画像を読み込み＋デコードし終えるまで待つ（最大 ms）。成功時 true、失敗・時間切れは false。 */
export function imageReady(url, ms = 1500, { keep = false } = {}) {
  if (!url) return Promise.resolve(false);
  let p = bgReady.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const i = new Image();
      if (keep) keptImages.push(i);
      i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true));
      i.onerror = () => { bgReady.delete(url); resolve(false); };
      i.src = url;
    });
    bgReady.set(url, p);
  }
  if (expiredImageWaits.has(p) && expiredImageWaits.get(p) >= ms) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      expiredImageWaits.set(p, Math.max(ms, expiredImageWaits.get(p) || 0));
      resolve(false);
    }, ms);
    // 通信は継続する。遅れて届いた画像は通常のキャッシュへ戻し、通信失敗後の再試行も妨げない。
    p.then((loaded) => { expiredImageWaits.delete(p); clearTimeout(timer); resolve(loaded); });
  });
}

// ---------------------------------------------------------------- UIの絵の先読み

// 会話枠・ボタン・看板・ハート・ゲージ・通知の生成画像とスロットの図柄・枠は CSS の背景なので、
// 画面に初めて出た瞬間に読み込みが始まり、枠や図柄が遅れて出ていた。顔アイコン（地図の看板・LIME・
// スロットのランプ・通知）も同じ（GUI20・21）。起動時に並行して読み、手放さずに置いておく。
const LOUNGE_ART = ["panel", "button", "map-pin", "heart", "reward-clean", "gauge-frame", "gauge-fill"].map((n) => `img/ui/lounge/${n}.webp`);
const SLOT_ART = ["symbols", "symbols-premium", "bezel"].map((n) => `img/ui/pakki-slot/${n}.webp`);
/** 設定・ギャラリーの窓と最初の会話の枠・ボタン（タイトルの絵と一緒に、幕を開ける前に待つ） */
export const FRAME_ART = LOUNGE_ART.slice(0, 2);
let uiArt = null;
let uiArtDone = false;
let uiStores = null;
let uiStoresDone = false;

/** 店ロゴだけをまとめて読む（一度だけ）。初めて要るのはマップ画面なので本体とは分けてある。 */
export function warmStoreLogos() {
  if (!uiStores) {
    const urls = [...new Set(allStoreLogoUrls())];
    uiStores = Promise.all(urls.map((u) => loadingPrefetch.warm(u, () => prepareImage(u, { timeoutMs: 15000 }))))
      .then(() => { uiStoresDone = true; });
  }
  return uiStores;
}

/** 店ロゴが出る画面の前に呼ぶ。読み終わっていれば null（待たない）、まだなら最大 ms 待つ Promise */
export function storeLogosReady(ms = 2000) {
  if (uiStoresDone) return null;
  return Promise.race([warmStoreLogos(), sleep(ms)]);
}

// タイトル直後は帯域を取り合わないよう、店ロゴはアイドル時に回す（遅くとも4秒で必ず始める）。
function deferStoreLogos() {
  if (uiStores) return;
  const start = () => warmStoreLogos();
  if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}

/** UIの絵・顔アイコンと選択中の会話枠を読む（店ロゴは含まない。一度だけ） */
function warmCoreArt() {
  if (!uiArt) {
    const urls = [...LOUNGE_ART, ...SLOT_ART, chapterTitleArt("第一章"), ...allFaceIconUrls()];
    uiArt = Promise.all(urls.map((u) => imageReady(u, 15000, { keep: true }))).then(() => { uiArtDone = true; });
  }
  // 選ばれた会話枠も先読みする。設定変更後は新しい枠だけを追加で読む。
  return Promise.all([uiArt, imageReady(uiThemeFrame(document.documentElement.dataset.uiTheme), 15000, { keep: true })]);
}

/** UIの絵と顔アイコンをまとめて読む（一度だけ。全部そろうか、遅い回線では15秒で解決）
 *  deferStores: タイトル表示直後の呼び出しだけ true。店ロゴをアイドル時へ遅らせる。 */
export function warmUiArt({ deferStores = false } = {}) {
  const core = warmCoreArt();
  if (deferStores) {
    deferStoreLogos();
    return core;
  }
  // 前段の成否にかかわらず店ロゴを後段で読む。通常呼び出しの完了には店ロゴも含める。
  return core.then(() => warmStoreLogos(), () => warmStoreLogos());
}

/** 顔アイコンやスロットが出る画面の前に呼ぶ。読み終わっていれば null（待たない）、まだなら最大 ms 待つ Promise */
export function uiArtReady(ms = 2000) {
  if (uiArtDone) return null;
  return Promise.race([warmCoreArt(), sleep(ms)]);
}

/**
 * 背景を差し替える。新しい絵が読み込めてからクロスフェードする（読み込み中に黒や前の絵のまま
 * 新しい場面が始まって見えるのを防ぐ）。戻り値は画像の用意と幕が開き終わるまで待つ。
 * assetsReady は画像の取得・デコードだけを待つ。読み込み表示と操作解禁の条件を混同しない。
 */
export function setBg(url, { instant = false, tint = null, fast = false, brief = false, ready = [], homeRigs = true } = {}) {
  const host = layers.bg;
  const art = { homeRigs };
  const key = `${url}|${tint || ""}|${sceneArtUrls(url, art).join("|")}`;
  const sceneArrival = takeSceneArrival(); // consume even on redraw; never carry an entry into a later scene
  if (key === bgNow) {
    refreshWeather();
    const assetsReady = Promise.all([bgAssetsReady, ...ready.map((u) => imageReady(u, 15000))]);
    return Object.assign(Promise.all([bgTask, assetsReady]), { assetsReady });
  }
  const coveredElsewhere = layers.wipe?.classList.contains("black") || layers.wipe?.classList.contains("cover") || isCovering();
  const curtain = !instant && bgNow && !coveredElsewhere ? createSceneCurtain(layers.fx, { fast: brief || document.body.classList.contains("vn-skip"), sceneArrival }) : null;
  if (curtain) activeCurtain = curtain;
  bgNow = key;
  bgAssetsReady = Promise.all([...sceneArtUrls(url, art), ...ready].map((u) => imageReady(u, 15000)));
  bgTask = Promise.all([curtain?.covered, bgAssetsReady]).then(() => {
    if (bgNow !== key) return; // 待っている間に別の背景が指定された
    const next = el("div.bg-img");
    renderSceneArt(next, url, art);
    if (!url) next.classList.add("black");
    if (fast) next.classList.add("fast");
    if (tint) next.dataset.tint = tint;
    host.append(next);
    curtain?.commitArrival?.(url);
    if (!curtain) sceneArrival.commitArrival(url);
    weatherBg = url || "";
    weatherTint = tint || "";
    refreshWeather();
    const olds = [...host.children].slice(0, -1);
    if (instant || curtain || coveredElsewhere) {
      next.classList.add("show");
      olds.forEach((o) => o.remove());
      return;
    }
    requestAnimationFrame(() => next.classList.add("show"));
    setTimeout(() => olds.forEach((o) => o.remove()), fast ? 260 : 700);
  }).finally(async () => {
    if (curtain) {
      try { await curtain.release(); }
      finally { if (activeCurtain === curtain) activeCurtain = null; }
    }
  });
  return Object.assign(bgTask, { assetsReady: bgAssetsReady });
}

/** 背景だけに雨を重ねる。窓は1280×720の背景座標に限定する。 */
export function refreshWeather() {
  if (!layers.weather) return;
  const scene = document.hidden ? null : rainScene(weatherBg, document.body.dataset.screen);
  const sky = scene ? weatherSkyTone(weatherBg, weatherTint) : "none";
  const view = scene ? weatherViewKind(weatherBg, scene) : "none";
  document.body.dataset.weather = scene?.mode || "none";
  document.body.dataset.weatherSky = sky;
  setRainAmbience(scene?.mode || null);
  const key = scene ? JSON.stringify({ scene, sky, view }) : "";
  if (key === weatherKey) return;
  weatherKey = key;
  renderWeatherLayer(layers.weather, scene, { sky, view, el });
}

// ---------------------------------------------------------------- 画面

/** 画面を差し替える。name は CSS の data-screen（見た目の切替）とテスト用 */
let screenRevision = 0;
export function showScreen(name, node) {
  const host = layers.screen;
  const revision = ++screenRevision;
  const commit = () => {
    if (revision !== screenRevision) return;
    host.dataset.screen = name;
    host.replaceChildren(node || el("div"));
    document.body.dataset.screen = name;
    refreshWeather();
  };
  if (activeCurtain && name !== "none") {
    // 覆ったところで古い地図を片付け、開いている戸口には背景だけを見せる。
    // 後から別の画面が指定されたときは、古い予約で消したり差し替えたりしない。
    activeCurtain.covered.then(() => { if (revision === screenRevision) host.replaceChildren(); });
    bgTask.then(commit);
  } else commit();
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
  const effect = { "charm-bonus": ["魅", "魅力"], "insight-hint": ["察", "洞察"] }[kind];
  const t = el(`div.toast${kind ? "." + kind : ""}`, effect
    ? [el("span.toast-badge", { text: effect[0], "aria-label": `${effect[1]}の効果` }), el("span", { text })]
    : { text });
  layers.toasts.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, ms);
}

/**
 * 動的 import など、画面が無反応になりがちな待ちに添える軽量ロード表示。
 * 会話中の .vn-loading と同じ見た目。show / hide を withLoadingNotice に渡して、
 * 500ms超で出し、完了・失敗のどちらでも消す（速い読み込みでは出さない）。
 */
export function loadingNotice(label = "読み込んでいます…") {
  const notice = el("div.vn-loading", { role: "status", "aria-live": "polite", text: label, dataset: { test: "module-loading" } });
  return { onShow: () => layers.fx.append(notice), onHide: () => notice.remove() };
}

/** VN開始前などの画像待ちにだけ添える通知。play()自体は包まない。 */
export function withScenePreparation(task) {
  return withLoadingNotice(task, loadingNotice("場面を準備しています…"));
}

// ステ上昇などのバナー（右上から順に積む・同時に出すのは数枚まで）
const STAT_BADGE = { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "察" };
const AFF_PTS = AFFINITY_RANK_PTS; // stats.js の AFFINITY_RANK_PTS と同じ段階
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
 * @param o.source "slot" の場合だけ当たりの枠の光と専用音。通知位置・報酬の適用は変えない。
 */
export function gainCard(o) {
  const statEvolution = o.kind === "stat" && typeof o.evolution === "string" && o.evolution;
  bannerQueue.push({ ...o,
    ...(statEvolution ? { main: `${o.main} ${statEvolution}`, evolution: true } : {}),
    ...(o.kind === "stat" ? { progress: o.progress || nextStepProgress(o.stat) } : {}),
    owner: state });
  pumpBanners();
}

/** 同じ生成ハートを報酬通知と交友一覧で使う。中身の進み具合だけをDOMで変える。 */
export function heartRow(values, { className = "gc-hearts", label = "好感度", bond = false } = {}) {
  return el(`span.${className}${bond ? ".bond" : ""}`, { role: "img", "aria-label": label },
    values.map((fill) => el("i.ui-heart", { "aria-hidden": "true", style: { "--fill": `${fill}%` } })));
}

export function statBadge(key, className = "gc-badge") {
  return el(`div.${className}`, { text: STAT_BADGE[key], "aria-hidden": "true" });
}

function pumpBanners() {
  while (bannerBusy < 3 && bannerQueue.length) {
    const o = bannerQueue.shift();
    if (o.owner !== state) continue;
    bannerBusy++;
    const hearts = o.hearts ? heartRow(o.hearts.from, { bond: !!o.bond, label: o.bond ? "恋人（♥5）" : "好感度" }) : null;
    const heading = o.top || (o.kind === "stat" ? "STATUS UP" : "");
    const b = el(`div.gain-card.${o.kind}${o.bond ? ".bond" : ""}${o.stat ? `.st-${o.stat}` : ""}${o.evolution ? ".evolved" : ""}${o.source === "slot" ? ".slot-bonus" : ""}`, [
      o.face ? el("img.gc-badge.face", { src: o.face, alt: "" }) : o.stat ? statBadge(o.stat) : el("div.gc-badge", { text: o.badge || "+" }),
      el("div.gc-meta", [
        heading ? el("span.gc-top", { text: heading, "aria-hidden": o.top ? "false" : "true" }) : null,
        el("div.gc-title", [el("span.gc-main", { text: o.main }),
          o.kind === "stat" && o.points > 0 ? el("span.gc-earned", { text: "今回" }) : null,
          o.points > 0 ? el("span.gc-points", { "aria-label": o.kind === "stat" ? `今回の増加 +${o.points}P` : null }, o.kind === "stat" ? [
            el("span.gc-count", { text: `+${o.points}` }), el("small.gc-unit", { text: "P" }),
          ] : [el("span", { text: `+${o.points}P` })]) : null]),
        typeof o.evolution === "string" && o.evolution ? el("strong.gc-evolution", { text: o.evolution }) : null,
        o.kind !== "stat" && o.sub ? el("span.gc-sub", { text: o.sub }) : null,
        o.fx && o.kind !== "stat" ? el("span.gc-fx", { text: o.fx }) : null,
        hearts,
      ]),
      o.kind === "stat" && o.progress ? el(`div.gc-next${o.progress.capped ? ".capped" : ""}`, { title: `${o.progress.label}${o.fx ? `。${o.fx}` : ""}` }, [
        el("span", { text: o.progress.label }), el("i", [el("b", { style: { width: `${o.progress.fill}%` } })]),
      ]) : null,
    ]);
    layers.banners.append(b);
    const owner = state;
    if (o.kind === "stat" && o.points > 0) setTimeout(() => {
      if (b.isConnected && owner === state) flyStatGain(b, o);
    }, 650);
    if (o.kind === "stat") {
      if (o.source === "slot") SE.slotBonus();
      else SE.select();
    }
    requestAnimationFrame(() => {
      b.classList.add("show");
      // 1拍おいてから今の値へ → ハートの中身が「ぐいーん」と伸びる
      if (hearts) setTimeout(() => hearts.querySelectorAll("i").forEach((h, i) => h.style.setProperty("--fill", `${o.hearts.to[i]}%`)), 260);
    });
    const hold = o.evolution ? 4200 : o.fx ? 3200 : o.hearts && o.hearts.to.join() !== o.hearts.from.join() ? 2600 : 2200;
    setTimeout(() => {
      b.classList.remove("show");
      b.classList.add("out");
      setTimeout(() => { b.remove(); bannerBusy--; pumpBanners(); }, 420);
    }, hold);
  }
}

/** 通知の光を、増えた能力に対応するHUDグラフの頂点へ運ぶ。拡縮後もステージ座標で計算する。 */
function flyStatGain(card, { stat, points }) {
  const index = STAT_KEYS.indexOf(stat);
  const radar = document.querySelector(".hud-radar");
  const hud = radar?.closest("#hud");
  if (index < 0 || !hud || Number(getComputedStyle(hud).opacity) < 0.1) return;
  const stage = document.querySelector("#stage").getBoundingClientRect();
  const target = radar.getBoundingClientRect();
  const source = card.querySelector(".gc-badge").getBoundingClientRect();
  if (!stage.width || !target.width) return;
  const vertices = radar.querySelector(".hr-fill")?.points;
  if (!vertices || vertices.numberOfItems <= index) return;
  const { x: tx, y: ty } = vertices.getItem(index);
  const scaleX = stage.width / 1280, scaleY = stage.height / 720;
  const from = [(source.x + source.width / 2 - stage.x) / scaleX, (source.y + source.height / 2 - stage.y) / scaleY];
  const to = [(target.x + target.width * tx / 48 - stage.x) / scaleX, (target.y + target.height * ty / 48 - stage.y) / scaleY];
  const color = getComputedStyle(card).getPropertyValue("--gc").trim();
  const pulse = () => {
    if (!radar.isConnected) return;
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    for (const [key, value] of Object.entries({ class: "hr-gain", cx: tx, cy: ty, r: 3, fill: color })) dot.setAttribute(key, value);
    radar.append(dot);
    dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650 }).finished.finally(() => dot.remove());
    radar.animate([{ filter: "brightness(1)" }, { filter: `brightness(1.8) drop-shadow(0 0 4px ${color})`, offset: 0.3 }, { filter: "brightness(1)" }], { duration: 650 });
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { pulse(); return; }
  const control = [(from[0] + to[0]) / 2 + 46, Math.max(8, Math.min(from[1], to[1]) - 28)];
  const count = 2 + Math.min(points, 4);
  for (let i = 0; i < count; i++) {
    const spark = el("i.stat-flight", { "aria-hidden": "true", dataset: { stat }, style: { "--gain-color": color } });
    layers.fx.append(spark);
    const frames = Array.from({ length: 9 }, (_, step) => {
      const t = step / 8, u = 1 - t;
      const x = u * u * from[0] + 2 * u * t * control[0] + t * t * to[0];
      const y = u * u * from[1] + 2 * u * t * control[1] + t * t * to[1];
      return { transform: `translate(${x}px, ${y}px) scale(${1 - i * 0.1})`, opacity: step === 0 || step === 8 ? 0 : 1 };
    });
    const animation = spark.animate(frames, { duration: 650, delay: i * 65, easing: "ease-in-out", fill: "both" });
    animation.finished.then(() => { if (i === count - 1) pulse(); }).finally(() => spark.remove());
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
    const previousFocus = document.activeElement;
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
    const close = () => {
      window.removeEventListener("keydown", onKeyDown);
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
    const buttons = [...box.querySelectorAll(".modal-actions button")];
    const primary = buttons.find((button) => button.classList.contains("primary")) || buttons[0];
    const dismiss = [...buttons].reverse().find((button) => !button.classList.contains("primary")) || primary;
    const onKeyDown = (e) => {
      if (!layers.modal.classList.contains("show") || e.repeat) return;
      if (e.key === "Escape") { e.preventDefault(); dismiss?.click(); }
      if (e.key === "Enter" && !e.target?.closest?.("button, a[href], input, select, textarea, [contenteditable]")) {
        e.preventDefault(); primary?.click();
      }
    };
    layers.modal.replaceChildren(el("div.modal-backdrop"), box);
    layers.modal.classList.add("show");
    window.addEventListener("keydown", onKeyDown);
    primary?.focus();
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
  // 読込中も前場面を見せたまま、クリック・タップ・会話送りキーを吸収する。
  const swallow = event => { event.preventDefault(); event.stopPropagation(); };
  const blockAdvance = event => {
    if (["Enter", " ", "Control"].includes(event.key)) swallow(event);
  };
  const shield = el("div.chapter-title-shield", {
    onpointerdown: swallow, onpointerup: swallow, onclick: swallow, dataset: { motion: "chapter" },
  });
  layers.fx.append(shield);
  window.addEventListener("keydown", blockAdvance, true);
  // Controlのkeyupは既存SKIP解除へ通す。押しっぱなし状態を次の会話へ残さない。
  const blockRelease = event => { if (event.key !== "Control") blockAdvance(event); };
  window.addEventListener("keyup", blockRelease, true);
  try {
    const art = chapterTitleArt(no);
    const copy = el("div.cc-copy", [
      el("div.cc-no", { text: no }),
      el("div.cc-name", { text: name }),
      el("div.cc-read", { text: read }),
      sub ? el("div.cc-sub", { text: sub }) : null,
    ]);
    const card = el("div.chapter-card", { dataset: { chapter: no, art: "text" } }, [copy]);
    // 動き（motions/chapter-title.js）が読めなければ、従来の静止表示のまま進める。
    const motion = await import("../motions/chapter-title.js").catch(() => null);
    let play = null;
    // 画像が準備できるまでは本編の上に空白のカードを出さない。
    // 失敗・タイムアウト時は既存の文字表示で章進行を続ける。
    if (art && await imageReady(art, 15000)) {
      copy.hidden = true; // 章名は採用画像に含まれているため重ねて描かない。
      card.classList.add("illustrated");
      card.dataset.art = "ready";
      const full = el("img.cc-art", { src: art, alt: [no, name, read, sub].filter(Boolean).join("　") });
      card.append(full);
      // 分けたレイヤーが一枚でも欠けたら、採用画像の静止表示にする。
      const extra = motion?.chapterArtUrls(no) || [];
      if (extra.length && (await Promise.all(extra.map(url => imageReady(url, 15000)))).every(Boolean)) {
        play = motion.mountChapterTitle(card, { no, full });
      }
    } else if (motion) {
      play = motion.mountChapterTitle(card, { no });
    }
    shield.append(card);
    // 単一rAFだけでは追加とshowが同じ初回描画にまとまり、画像が突然現れる。
    // 透明な初期スタイルを確定してから既存のopacityトランジションを開始する。
    void card.offsetWidth;
    SE.jingle();
    await nextFrame();
    card.classList.add("show");
    // 動きは退場してよい時刻まで待つ。動きの不具合で章進行を止めない。
    if (play) await Promise.race([play().catch(() => {}), sleep(7000)]);
    else await sleep(3200);
    card.classList.add("out");
    // タイマーだけで消すと最後の描画より先にremoveされる。動き軽減や背景タブでも待ち続けない。
    await Promise.race([
      Promise.all(card.getAnimations().map(animation => animation.finished.catch(() => {}))),
      sleep(1100),
    ]);
  } finally {
    shield.remove();
    window.removeEventListener("keydown", blockAdvance, true);
    window.removeEventListener("keyup", blockRelease, true);
  }
}

/** DAYカード（日付の区切り）。クリックを吸い込み、読み終わるまで待つ。weather は小見出しの後ろに出す天気（sun／cloud／rain） */
export async function dayCard(title, sub, { ms = 1900, weather = null } = {}) {
  const wx = weather ? (await import("../motions/dawn-weather.js").catch(() => null))?.weatherBadge(weather, "dc-weather", "currentColor") : null;
  const card = el("div.day-card", [el("div.dc-title", { text: title }), sub ? el("div.dc-sub", [sub, wx?.badge]) : null]);
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

/** 就寝→翌朝。mid() で日付を進め、DAYと残り日数をめくって見せる（transitions.nightToMorning） */
export function dayTurn(mid) {
  return nightToMorning(layers.fx, mid);
}
