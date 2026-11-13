// 画面の土台: 背景・画面切替・煙ワイプ・トースト・ステ通知・モーダル・カウントダウン・スタンプ。
import { $, el, sleep, nextFrame } from "./util.js";
import { syncBackdrop } from "./stage-fit.js";
import { on } from "./bus.js";
import { SE, setRainAmbience } from "./audio.js";
import { state, STAT_KEYS, config } from "./state.js";
import { reducedMotion } from "./transition-kit.js";
import { DB, displayName, faceIconUrl, allFaceIconUrls, assetUrl } from "./data.js";
import { AFFINITY_RANK_PTS } from "./stats.js";
import { gainSeenKey, bannerHold } from "./gain-notice.js";
import { nextStepProgress } from "./stat-progress.js";
import { renderSceneArt, sceneArtUrls } from "./scene-art.js";
import { rainScene, weatherSkyTone, weatherViewKind, renderWeatherLayer } from "../daily/weather.js";
import { syncShopHaze } from "./shop-haze.js";
import { createSceneCurtain, nightToMorning, isCovering, takeSceneArrival, takeParkedCover } from "./transitions.js";
import { allStoreLogoUrls } from "./store-logos.js";
import { chapterTitleArt } from "./chapter-title-art.js";
import { uiThemeFrame } from "./ui-theme.js";
import { withLoadingNotice } from "./module-loading.js";
import { withLoading, comicLoadingRequired } from "./loading.js";
import { gameLoadingOptions } from "./loading-context.js";
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
      chime: levelUp ? "up" : "",
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
    gainCard({ kind: "affinity", bond: true, face: faceIconUrl(id, state, { context: "private" }), badge: "♥", top: "NEW RELATIONSHIP", chime: "up", main: displayName(id, state, { context: "private" }), sub: "恋人になった" });
  });
}

// ---------------------------------------------------------------- 背景（クロスフェード）

let bgNow = "";
let bgShown = ""; // 実際に #bg へ出した背景（読めずに見送った指定は含まない）
let bgTask = Promise.resolve();
let bgAssetsReady = Promise.resolve();
let activeCurtain = null;
let weatherBg = "";
let weatherTint = "";
let weatherKey = "";
const bgReady = new Map(); // url -> { promise, image, keep }（一度読んだ絵は即座に出す）
// Retain only a bounded decoded working set. CSS/DOM own visible images separately.
const IMAGE_CACHE_ENTRIES = 128, KEPT_IMAGE_BYTES = 48 * 1024 * 1024;
function trimImages() {
  let bytes = [...bgReady.values()].reduce((n, e) => n + (e.bytes || 0), 0);
  for (const [url, entry] of bgReady) {
    if (!entry.done) continue; // never evict shared in-flight requests
    if (entry.image && bytes > KEPT_IMAGE_BYTES) {
      bytes -= entry.bytes || 0;
      entry.image = null; entry.bytes = 0;
    }
    if (bgReady.size > IMAGE_CACHE_ENTRIES) {
      bytes -= entry.bytes || 0;
      bgReady.delete(url);
    }
  }
}
const expiredImageWaits = new WeakMap(); // 同じ通信に対し、使い切った待ち時間を繰り返さない

/** 画像を読み込み＋デコードし終えるまで待つ（最大 ms）。成功時 true、失敗・時間切れは false。 */
export function imageReady(url, ms = 1500, { keep = false } = {}) {
  if (!url) return Promise.resolve(false);
  let entry = bgReady.get(url);
  if (entry) { bgReady.delete(url); bgReady.set(url, entry); }
  // 通常の場面で読んだ後に固定UIの先読みへ昇格する場合も、Image 自体を保持する。
  // すでに手放していたらここで読み直し、制作画面を開く前にデコードまで待つ。
  if (!entry || (keep && !entry.image)) {
    entry = { promise: null, image: new Image(), keep };
    bgReady.set(url, entry);
    entry.promise = new Promise((resolve) => {
      const i = entry.image;
      i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => {
        entry.done = true;
        if (!entry.keep) entry.image = null;
        else entry.bytes = (i.naturalWidth || 0) * (i.naturalHeight || 0) * 4;
        trimImages();
        resolve(true);
      });
      i.onerror = () => { bgReady.delete(url); entry.image = null; resolve(false); };
      i.src = url;
    });
  } else if (keep) entry.keep = true;
  const p = entry.promise;
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
// 紙とラベンダー（既定のUI・DUI08）の板と札、全画面MENUの紙（DUI03）。会話枠は uiThemeFrame で別に読む。
const PAPER_ART = ["panel", "lavender", "menu-bg"].map((n) => `img/ui/paper/${n}.webp`);
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
    const urls = [...LOUNGE_ART, ...PAPER_ART, ...SLOT_ART, chapterTitleArt("第一章"), ...allFaceIconUrls()];
    // Two workers instead of launching every icon/texture together. Foreground
    // imageReady calls bypass this list and share any request already in flight.
    let index = 0;
    // Preserve the old batch's 15s ceiling: serial timeouts must not multiply it.
    const deadline = Date.now() + 15000;
    const worker = async () => {
      let ok = true;
      while (index < urls.length) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return false;
        const url = urls[index++];
        if (!await imageReady(url, remaining, { keep: true })) ok = false;
      }
      return ok;
    };
    uiArt = Promise.all([worker(), worker()]).then(results => {
      uiArtDone = results.every(Boolean);
      if (!uiArtDone) uiArt = null; // retry failed assets at the next entrance
    });
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

// 余白のぼかし（#backdrop）の差し替えは共通部品 core/stage-fit.js の syncBackdrop（#3076 で共通化）。

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
  // 時間が過ぎる波（transitions.waveBeat）が覆ったまま預けた幕。新しい背景を描いてから開く（#2688 F3）
  const handoff = takeParkedCover();
  if (key === bgNow) {
    refreshWeather();
    const assetsReady = Promise.all([bgAssetsReady, ...ready.map((u) => imageReady(u, 15000))]);
    const same = Promise.all([bgTask, assetsReady]).then(async (values) => { if (handoff) await handoff(); return values; });
    return Object.assign(same, { assetsReady, covered: activeCurtain?.covered || Promise.resolve() });
  }
  const coveredElsewhere = layers.wipe?.classList.contains("black") || layers.wipe?.classList.contains("cover") || isCovering();
  const curtain = !instant && bgNow && !coveredElsewhere ? createSceneCurtain(layers.fx, { fast: brief || document.body.classList.contains("vn-skip"), sceneArrival }) : null;
  if (curtain) activeCurtain = curtain;
  bgNow = key;
  bgAssetsReady = Promise.all([...sceneArtUrls(url, art), ...ready].map((u) => imageReady(u, 15000)));
  bgTask = Promise.all([curtain?.covered, bgAssetsReady]).then(([, loaded]) => {
    if (bgNow !== key) return; // 待っている間に別の背景が指定された
    // 背景の絵そのもの（先頭）が読めなかった（通信失敗・時間切れ）ときは、前の背景を残す。読めない絵の層を重ねて
    // 前の背景を片付けると、黒一色の画面になる（#3203）。同じ背景をもう一度指定したら読み直すよう、記録は今出ている背景に戻す。
    // 背景を消す指定（url なし＝暗転）と、まだ何も出ていない最初の背景は、これまでどおり差し替える。
    const keep = !!url && loaded[0] === false && host.children.length > 0;
    const next = keep ? null : el("div.bg-img");
    if (keep) bgNow = bgShown;
    else {
      bgShown = key;
      renderSceneArt(next, url, art);
      if (!url) next.classList.add("black");
      if (fast) next.classList.add("fast");
      if (tint) next.dataset.tint = tint;
      host.append(next);
      syncBackdrop(url, tint, instant);
    }
    // 場面はここで確定する。絵が読めず前の背景を残したときも、入店の合図は落とさない（進行は止めない）。
    curtain?.commitArrival?.(url);
    if (!curtain) sceneArrival.commitArrival(url);
    if (keep) return; // 背景・余白のぼかし・雨は前の場面のまま
    weatherBg = url || "";
    weatherTint = tint || "";
    refreshWeather();
    const olds = [...host.children].slice(0, -1);
    if (curtain?.dissolve) {
      // 煙のにじみ（TMG44）: 次の背景を前の背景の下にすぐ置き、前の背景は curtain.release() で煙の形にほどく
      next.style.transition = "none";
      next.classList.add("show");
      host.insertBefore(next, olds[0] || null);
      // 前の切り替えでほどけている途中の絵は、その幕に任せる（その下にある今の背景から次の背景へほどく）
      curtain.dissolve(olds.filter((o) => !o.dataset.dissolving));
      return;
    }
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
    if (handoff) await handoff();
  });
  return Object.assign(bgTask, { assetsReady: bgAssetsReady, covered: curtain?.covered || Promise.resolve() });
}

/**
 * 章の場面を替える（#2688 F2）。第1章の会話の背景替えと同じ標準の幕（一筆）で覆い、覆ったところで前の画面を片付けて開く。
 * 地図・メニューへ戻るときは map: true で短い幕。幕の要らない所（同じ部屋の昼夜差分・別の演出が覆っている間）は setBg(..., { instant: true })。
 * 選択肢を選んで会話へ入る所は、覆うまで古いカードを残さない（押せる・同じ画面と誤認される）。先に showScreen("none") してから setBg で替える。
 */
export async function enterScene(url, { map = false, clear = true, ...opts } = {}) {
  const task = setBg(url, { brief: map, ...opts });
  if (clear) {
    await task.covered;
    showScreen("none", null);
  }
  return task;
}

/** 背景だけに雨を重ねる。窓は1280×720の背景座標に限定する。 */
export function refreshWeather() {
  if (!layers.weather) return;
  // シーシャ屋の店内には、うっすら煙を漂わせる（KMR21）。背景・画面が替わるたびに、雨と同じ所で合わせる
  syncShopHaze(weatherBg, document.body.dataset.screen, weatherTint);
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

export function toast(text, { ms = 2600, kind = "", se = "" } = {}) {
  if (se) SE[se]?.(); // 通知と一緒に鳴らす効果音（「お金が足りない」のブザーなど）
  const effect = { "charm-bonus": ["魅", "魅力"], "insight-hint": ["察", "洞察"] }[kind];
  const t = el(`div.toast${kind ? "." + kind : ""}`, effect
    ? [el("span.toast-badge", { text: effect[0], "aria-label": `${effect[1]}の効果` }), el("span", { text })]
    : { text });
  layers.toasts.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, ms);
}

/**
 * 動的 import など、画面が無反応になりがちな待ちのロード表示。show / hide を withLoadingNotice に渡して、
 * 500ms超で出し、完了・失敗のどちらでも閉じる（速い読み込みでは出さない）。
 * プレイヤーの既定では、作業台と同じ漫画つきのロード画面（core/loading.js）を出し、読み終えてタップで進む
 * （2026-11-12 オーナー「ロード画面に統一感ない。漫画はマストで出して欲しい」。onHide がその読み終わりを返す）。
 * 自動操作のブラウザ（既存の検査）と inline: true（ギャラリーの絵など、場面の切り替えではない待ち）は、従来の小さな表示。
 */
export function loadingNotice(label = "読み込んでいます…", { inline = false } = {}) {
  if (!inline && comicLoadingRequired()) return comicLoadingNotice(label);
  const notice = el("div.vn-loading", { role: "status", "aria-live": "polite", text: label, dataset: { test: "module-loading" } });
  return { onShow: () => { layers.fx.append(notice); }, onHide: () => { notice.remove(); } };
}

// The wait is already over 500 ms when onShow runs, so the gate opens at once. It never competes with
// another gate (soft). A failed wait closes it without holding the reader.
function comicLoadingNotice(label) {
  let release, gate, controller;
  return {
    onShow: () => {
      controller = new AbortController();
      const done = new Promise(resolve => { release = resolve; });
      gate = withLoading(() => done, { label, delayMs: 0, soft: true, signal: controller.signal, ...gameLoadingOptions(state) })
        .catch(() => { /* A closed or failed loading screen leaves the scene as it is. */ });
    },
    onHide: ({ failed = false } = {}) => {
      if (failed) controller?.abort();
      release?.();
      return gate;
    },
  };
}

/**
 * 章の始め・セーブからの再開（決まった場面）。プレイヤーの既定では、待ちがなくても漫画のロード画面を出す
 * （2026-11-12 オーナー「決まった場面は毎回出す」）。load の結果（章のモジュールなど）を返し、失敗はそのまま投げる。
 * 自動操作のブラウザでは従来どおり、0.5秒を超えたときだけ小さな表示を出す。
 */
export function withChapterLoading(load, label) {
  if (!comicLoadingRequired()) return withLoadingNotice(load(), loadingNotice(label));
  return withLoading(() => load(), { label, fixed: true, ...gameLoadingOptions(state) });
}

/**
 * これまで文字だけの画面（「東京の場面を準備しています…」など）で待っていた、章の始めの台本の読み込み。
 * プレイヤーの既定では、0.5秒を超えたら漫画のロード画面にする（直前の漫画を読んだばかりなら、その続きの画面で閉じる）。
 */
export function withSceneLoading(task, label) {
  return comicLoadingRequired() ? withLoadingNotice(task, loadingNotice(label)) : task;
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

/**
 * 絵の印（o.icon。心得の盤のアイコン・火種など。SBD125②）: 顔の印と同じ暗い丸に絵を載せる。
 * 絵が読めるまで・読めない時は、字の印（o.badge）のまま見える。
 */
function artBadge(src, text) {
  const badge = el("div.gc-badge.face.art", [el("span", { text: text || "+" })]);
  const img = el("img", { src, alt: "", draggable: "false" });
  img.addEventListener("load", () => badge.classList.add("has-img"));
  img.addEventListener("error", () => img.remove());
  badge.append(img);
  return badge;
}

export function statBadge(key, className = "gc-badge") {
  return el(`div.${className}`, { text: STAT_BADGE[key], "aria-hidden": "true" });
}

let lastAffinityChime = -Infinity;
function pumpBanners() {
  while (bannerBusy < 3 && bannerQueue.length) {
    const o = bannerQueue.shift();
    if (o.owner !== state) continue;
    bannerBusy++;
    const hearts = o.hearts ? heartRow(o.hearts.from, { bond: !!o.bond, label: o.bond ? "恋人（♥5）" : "好感度" }) : null;
    const heading = o.top || (o.kind === "stat" ? "STATUS UP" : "");
    const b = el(`div.gain-card.${o.kind}${o.bond ? ".bond" : ""}${o.stat ? `.st-${o.stat}` : ""}${o.evolution ? ".evolved" : ""}${o.source === "slot" ? ".slot-bonus" : ""}`, [
      o.face ? el("img.gc-badge.face", { src: o.face, alt: "" }) : o.stat ? statBadge(o.stat) : o.icon ? artBadge(o.icon, o.badge) : el("div.gc-badge", { text: o.badge || "+" }),
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
    // 好感度・恋人の絆: ハートが動くのに合わせてベル。段階が上がった時と恋人になった時は2回（SE.affinityUp）。
    // 何枚か同時に出る時は1回だけ（0.3秒あける）。
    else if (o.kind === "affinity" && performance.now() - lastAffinityChime > 300) {
      lastAffinityChime = performance.now();
      (o.chime === "up" ? SE.affinityUp : SE.affinity)();
    }
    requestAnimationFrame(() => {
      b.classList.add("show");
      // 1拍おいてから今の値へ → ハートの中身が「ぐいーん」と伸びる
      if (hearts) setTimeout(() => hearts.querySelectorAll("i").forEach((h, i) => h.style.setProperty("--fill", `${o.hearts.to[i]}%`)), 260);
    });
    const seenKey = gainSeenKey(o);
    const hold = bannerHold(o, !!(seenKey && owner.flags?.[seenKey]) && !!config.shortSeen);
    setTimeout(() => {
      // 見せ終えた通知だけ既読にする。途中のSAVE/LOADや画面除去で未完の通知を短縮しない。
      if (seenKey && owner === state && b.isConnected && owner.flags) owner.flags[seenKey] = true;
      b.classList.remove("show");
      b.classList.add("out");
      setTimeout(() => { b.remove(); bannerBusy--; pumpBanners(); }, 420);
    }, hold);
  }
}

/** 通知の光を、ステータスの入口（HUD の MENU）へ運ぶ。拡縮後もステージ座標で計算する。 */
// 五角形のステータスボタンは廃止し、ステータスは全画面MENUのタブへ移した（DUI05・#2097）。
function flyStatGain(card, { stat, points }) {
  const menu = document.querySelector("#hud .hud-menu");
  const hud = menu?.closest("#hud");
  if (!STAT_KEYS.includes(stat) || !hud || Number(getComputedStyle(hud).opacity) < 0.1) return;
  const stage = document.querySelector("#stage").getBoundingClientRect();
  const target = menu.getBoundingClientRect();
  const source = card.querySelector(".gc-badge").getBoundingClientRect();
  if (!stage.width || !target.width) return;
  const scaleX = stage.width / 1280, scaleY = stage.height / 720;
  const from = [(source.x + source.width / 2 - stage.x) / scaleX, (source.y + source.height / 2 - stage.y) / scaleY];
  const to = [(target.x + target.width / 2 - stage.x) / scaleX, (target.y + target.height / 2 - stage.y) / scaleY];
  const color = getComputedStyle(card).getPropertyValue("--gc").trim();
  const pulse = () => {
    if (!menu.isConnected) return;
    const dot = el("i.hud-gain", { "aria-hidden": "true", style: { "--gain-color": color } });
    menu.append(dot);
    dot.animate([{ opacity: 1, transform: "scale(.6)" }, { opacity: 0, transform: "scale(1.8)" }], { duration: 650 }).finished.finally(() => dot.remove());
    menu.animate([{ filter: "brightness(1)" }, { filter: `brightness(1.25) drop-shadow(0 0 6px ${color})`, offset: 0.3 }, { filter: "brightness(1)" }], { duration: 650 });
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

/**
 * 閉じた画面の出口（MENU の閉じ・#2688 A13）。閉じる箱と同じ位置・形・紙の色の面だけを短く残して薄れさせる。
 * 文字・ボタン・クラス名は写さないので、次の画面・入力・テストの判定は本物だけを見る。
 * 箱がまだ見えている間（#modal を空にする前）に呼ぶ。面は #modal の一つ下に置き、続けて開いた画面より前へ出ない。
 * origin: 縮む起点（#modal 内の座標）。box: 面にする箱のセレクタ（省略時は一番大きく塗られた箱）。
 * 動きを減らす設定では何も出さずに閉じる。
 */
export function ghostOut(nodes, frames, ms = 180, { origin = null, box: pick = null } = {}) {
  const frame = layers.modal, host = frame?.parentElement;
  if (!host || !frame.offsetWidth || reducedMotion() || !nodes.length) return;
  const f = frame.getBoundingClientRect(), k = f.width / frame.offsetWidth;
  if (!k) return;
  const shapes = [];
  for (const node of nodes) {
    const box = !(node instanceof Element) ? null : pick ? (node.matches(pick) ? node : node.querySelector(pick)) : paintedBox(node);
    const r = box?.getBoundingClientRect();
    if (!r?.width || !r.height) continue;
    const cs = getComputedStyle(box), left = (r.left - f.left) / k, top = (r.top - f.top) / k;
    const shape = el("div.modal-ghost-box");
    Object.assign(shape.style, {
      left: `${left}px`, top: `${top}px`, width: `${r.width / k}px`, height: `${r.height / k}px`,
      backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition, backgroundRepeat: cs.backgroundRepeat,
      borderStyle: cs.borderStyle, borderWidth: cs.borderWidth, borderColor: cs.borderColor, borderRadius: cs.borderRadius,
      borderImageSource: cs.borderImageSource, borderImageSlice: cs.borderImageSlice, borderImageWidth: cs.borderImageWidth,
      borderImageOutset: cs.borderImageOutset, borderImageRepeat: cs.borderImageRepeat,
      boxShadow: cs.boxShadow, transformOrigin: origin ? `${origin.x - left}px ${origin.y - top}px` : "50% 50%",
    });
    shapes.push(shape);
  }
  if (!shapes.length) return;
  const ghost = el("div.modal-ghost", { "aria-hidden": "true" }, shapes);
  ghost.inert = true;
  host.append(ghost);
  Promise.all(shapes.map((shape) => shape.animate(frames, { duration: ms, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" }).finished))
    .catch(() => {}).finally(() => ghost.remove());
}

/** 見た目の紙・枠を持つ箱（自分が塗られていなければ、中で一番大きく塗られた箱） */
function paintedBox(node) {
  const painted = (n) => {
    const cs = getComputedStyle(n);
    return cs.backgroundImage !== "none" || cs.borderImageSource !== "none" || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor);
  };
  if (painted(node)) return node;
  let best = null, area = 0;
  for (const n of [...node.querySelectorAll("*")].slice(0, 60)) {
    const r = n.getBoundingClientRect(), a = r.width * r.height;
    if (a > area && painted(n)) { best = n; area = a; }
  }
  return best;
}

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
  if (reducedMotion() || config.reduceShake) return;
  const f = el(`div.flash.${kind}`);
  layers.fx.append(f);
  setTimeout(() => f.remove(), ms + 60);
}

export function shake(target = document.getElementById("stage"), ms = 380) {
  if (reducedMotion() || config.reduceShake) return;
  target.classList.remove("shake");
  void target.offsetWidth;
  target.classList.add("shake");
  setTimeout(() => target.classList.remove("shake"), ms);
}

/** 章タイトル（採用画像1枚＋共通の出現演出。表示時間・送り入力ガードは維持） */
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
    const card = el("div.chapter-card.static-title", { dataset: { chapter: no, art: "text" } }, [copy]);
    let hold = 3200;
    // 画像が準備できるまでは本編の上に空白のカードを出さない。
    // 失敗・タイムアウト時は既存の文字表示で章進行を続ける。
    if (art && await imageReady(art, 15000)) {
      copy.hidden = true; // 章名は採用画像に含まれているため重ねて描かない。
      // 出現は共通の .ct-reveal（css/motions/chapter-title.css）。画像は動かさず、もやが晴れて現れる。
      card.classList.add("illustrated", "ct-reveal");
      card.dataset.art = "ready";
      const full = el("img.cc-art", { src: art, alt: [no, name, read, sub].filter(Boolean).join("　") });
      card.append(full);
      // 採用画像1枚のみ。旧演出の表示時間は保ち、分割・寄り・光の追加画像は読まない。
      if (!reducedMotion()) hold = no === "第一章" ? 5800 : 4400;
    } else if (!reducedMotion()) {
      // 採用画像のない章は、既存の文字フォールバックを静止表示する。
      hold = 3600;
    }
    shield.append(card);
    // 単一rAFだけでは追加とshowが同じ初回描画にまとまり、画像が突然現れる。
    // 透明な初期スタイルを確定してから既存のopacityトランジションを開始する。
    void card.offsetWidth;
    SE.jingle();
    await nextFrame();
    card.classList.add("show");
    await sleep(hold);
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
export async function dayCard(title, sub, { ms = 1900, weather = null, forecast = null } = {}) {
  const wx = weather ? (await import("../motions/dawn-weather.js").catch(() => null))?.weatherBadge(weather, "dc-weather", "currentColor") : null;
  const card = el("div.day-card", [el("div.dc-title", { text: title }), sub ? el("div.dc-sub", [sub, wx?.badge]) : null]);
  if (forecast) card.append(el("small.dc-sub", { text: `明日は${forecast}`, dataset: { test: "day-forecast" } }));
  layers.fx.append(card);
  SE.card();
  await nextFrame();
  card.classList.add("show");
  await sleep(ms);
  card.classList.add("out");
  await sleep(500);
  card.remove();
}

/** 中央の見出し帯（「ROUND 2」など）。登場カットインと同じ生成りの帯を大きく（TMG59） */
export async function roundCut(text, sub = "") {
  const c = el("div.round-cut", [el("div.round-cut-band", [sub ? el("small", { text: sub }) : null, el("b", { text })])]);
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



