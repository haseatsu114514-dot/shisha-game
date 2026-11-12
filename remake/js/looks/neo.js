// 新版（現行の画面を磨き上げた様式・LK02）。見た目は css/look-neo.css、ここは絵の光・動きなど CSS だけでは足りない分。
// setActive(false) では、足した要素・監視・クラスをすべて片付けて現行へ戻す。
// 全画面 MENU の人物の絵は neo/menu-figure.js（ここから一緒に出し入れする）。
//
// 会話に足すのは次の3つだけ（どれも会話の DOM か背景が変わった時にだけ動く。毎フレームの処理は無い）:
//   1. 場面の光: 立ち絵（.vn-portraits > img.portrait）1枚ごとに、同じ位置・同じ大きさの <i class="neo-light"> を直後へ置く。
//      立ち絵の絵を型（mask）にして、色は CSS が soft-light で重ねる。立ち絵の img 自体には触らない。
//   2. 名前の縦線の色: 話している人の色（characters.json の intro_cutin.color）を #vn の --neo-speaker へ入れる。
//   3. 場所の光（BGU01）: 光の層のすぐ後ろへ、同じ型の <i class="neo-amb"> を置く。色は、いまの背景の絵の
//      立ち絵が立つあたりの平均色から決め（neo/ambient.js）、#vn の --neo-amb へ入れて CSS が乗算で重ねる。
//      暗い店・夜道では人物も少し暗く、その場所の色へ寄る。背景が替わった時に一度だけ測る（同じ絵は測り直さない）。
// 会話エンジン（vn/engine.js）は立ち絵を img だけで数え、登場を img.getAnimations() で待つ。
// そのため img には要素もクラスも動きも足さない（呼吸は CSS が .vn-portraits の層ごと動かす）。
import { DB, realName } from "../core/data.js";
import { setActive as setMenuFigure } from "./neo/menu-figure.js";
import { ambientColor, ambientCss, sampleBackground } from "./neo/ambient.js";

// 縦持ち（LK11）: 縦長の画面（スマホの縦持ち・縦長の PC の窓）では、DS風の外枠＋高解像度の上画面＋ドット調の下画面で見せる。
// 外枠の部品は looks/retro.js を高解像度（hd）・縦長だけの条件で動かす。縦長になった時に初めて読み込む
// （横長だけで遊ぶ端末には、外枠のコードを読み込ませない）。横長に戻すと外枠は自分で引っ込む。
const PORTRAIT = "(orientation: portrait)";
let portraitQuery = null, portraitShell = null, portraitLoad = 0;
function startPortrait() {
  if (portraitShell || !portraitQuery?.matches) return;
  const mine = ++portraitLoad;
  import("./retro.js").then((retro) => {
    if (mine !== portraitLoad || !active || portraitShell) return;
    portraitShell = retro.startShell({ paint: "hd", mode: "portrait" });
  }).catch((error) => console.error("[look] 縦持ちの表示を読み込めませんでした", error));
}
function setPortrait(on) {
  if (on) {
    if (typeof window.matchMedia !== "function") return;
    portraitQuery = window.matchMedia(PORTRAIT);
    portraitQuery.addEventListener?.("change", startPortrait);
    startPortrait();
    return;
  }
  portraitQuery?.removeEventListener?.("change", startPortrait);
  portraitQuery = null;
  portraitLoad++;
  portraitShell?.stop();
  portraitShell = null;
}

const LIGHT = "neo-light";
const AMBIENT = "neo-amb";
const SPEAKER_VAR = "--neo-speaker";
const MASK_VAR = "--neo-mask";
const AMBIENT_VAR = "--neo-amb";

let active = false;
let host = null;          // #vn
let portraits = null;     // .vn-portraits
let nameTag = null;       // .vn-name
let hostObserver = null;
let portraitObserver = null;
let nameObserver = null;
let nameIndex = null;     // 表示名 → キャラID（立ち絵の無い話者の色を引く）
const lights = new Map(); // img → { light: 場面の光の層, ambient: 場所の光の層 }
let bgHost = null;        // #bg
let bgObserver = null;
let ambientKey = null;    // いま色を決めた背景（絵の URL と色調補正）
let ambientRun = 0;

const canMask = () => typeof CSS !== "undefined"
  && (CSS.supports("mask-image", "none") || CSS.supports("-webkit-mask-image", "none"))
  && CSS.supports("mix-blend-mode", "soft-light") && CSS.supports("mix-blend-mode", "multiply");

function setIfChanged(node, name, value) {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

/** 立ち絵1枚ぶんの光の層（場面の光・場所の光のどちらも）を、立ち絵の今の状態（位置・大きさ・表情の絵・話者かどうか）に合わせる。 */
function syncLight(img, light, name) {
  const cls = `${name}${img.classList.contains("active") ? " active" : ""}${img.classList.contains("enter") ? " enter" : ""}`;
  if (light.className !== cls) light.className = cls;
  const pos = img.dataset.pos || "";
  if (light.dataset.pos !== pos) light.dataset.pos = pos;
  // 誰の光か（猫だけ座る高さが違う）。engine.js が話者で立ち絵を探す data-speaker とは別の名前にする。
  const of = img.dataset.speaker || "";
  if (light.dataset.of !== of) light.dataset.of = of;
  setIfChanged(light, "height", img.style.height);
  setIfChanged(light, "bottom", img.style.bottom);
  setIfChanged(light, "--ax", img.style.getPropertyValue("--ax"));
  const src = img.currentSrc || img.src || "";
  const ready = !!src && img.complete && img.naturalWidth > 0;
  // 型（立ち絵の絵）がまだ無い間は出さない（型が無いと四角い色の板になる）。読めたら load で呼び直される。
  // 表情の差し替えで一瞬読み込み中になった時は、前の表情の型のまま待つ（光を点滅させない）。
  if (!ready) {
    if (!light.style.getPropertyValue(MASK_VAR)) setIfChanged(light, "display", "none");
    return;
  }
  setIfChanged(light, "display", "");
  setIfChanged(light, "aspect-ratio", `${img.naturalWidth} / ${img.naturalHeight}`);
  setIfChanged(light, MASK_VAR, `url("${src.replace(/["\\\n]/g, encodeURIComponent)}")`);
}

function syncLights() {
  if (!portraits) return;
  const imgs = [...portraits.querySelectorAll(":scope > img.portrait")];
  for (const [img, pair] of lights) {
    if (imgs.includes(img)) continue;
    pair.light.remove();
    pair.ambient.remove();
    lights.delete(img);
  }
  for (const img of imgs) {
    let pair = lights.get(img);
    if (!pair) {
      pair = { light: document.createElement("i"), ambient: document.createElement("i") };
      pair.light.setAttribute("aria-hidden", "true");
      pair.ambient.setAttribute("aria-hidden", "true");
      lights.set(img, pair);
    }
    // 重なりの順を立ち絵に合わせる（光は自分の立ち絵のすぐ上、次の立ち絵より下）。
    if (img.nextSibling !== pair.light) img.after(pair.light);
    if (pair.light.nextSibling !== pair.ambient) pair.light.after(pair.ambient);
    syncLight(img, pair.light, LIGHT);
    syncLight(img, pair.ambient, AMBIENT);
  }
  // 自分の書き換えで監視を回し続けない。
  portraitObserver?.takeRecords();
}

function clearLights() {
  for (const pair of lights.values()) {
    pair.light.remove();
    pair.ambient.remove();
  }
  lights.clear();
  portraits?.querySelectorAll(`.${LIGHT}, .${AMBIENT}`).forEach((node) => node.remove());
}

/** いま見えている背景の絵の要素。煙でほどけて消えていく途中の前の絵は数えない。 */
function currentBg() {
  const nodes = [...bgHost.querySelectorAll(":scope > .bg-img")];
  return nodes.filter((node) => !node.dataset.dissolving).pop() || nodes.pop() || null;
}

/** 背景の要素から絵の URL を取る（小物を重ねる場面は、絵が中の svg に入っている。core/scene-art.js）。 */
function bgUrl(node) {
  const match = /url\((["']?)(.*?)\1\)/.exec(node.style.backgroundImage || "");
  return match?.[2] || node.querySelector(":scope > .scene-art > image")?.getAttribute("href") || "";
}

/** 場所の光の色を、いまの背景に合わせる。背景の層が出入りした時にだけ呼ばれ、同じ背景なら何もしない。 */
function syncAmbient() {
  if (!host || !bgHost) return;
  const node = currentBg();
  const url = node ? bgUrl(node) : "";
  const tint = node?.dataset.tint || "";
  const key = `${url}|${tint}`;
  if (key === ambientKey) return;
  ambientKey = key;
  const run = ++ambientRun;
  sampleBackground(url).then((mean) => {
    if (run !== ambientRun || !active || !host) return;
    // 絵が無い（暗転）・測れない時は色を外す（CSS の既定は白＝人物をそのまま見せる）。
    if (mean) setIfChanged(host, AMBIENT_VAR, ambientCss(ambientColor(mean, tint)));
    else host.style.removeProperty(AMBIENT_VAR);
  });
}

const colorOf = (id) => DB.characters?.[id]?.intro_cutin?.color || "";

function buildNameIndex() {
  const index = new Map();
  for (const [id, character] of Object.entries(DB.characters || {})) {
    if (!colorOf(id)) continue;
    for (const name of [realName(id), character.private_name]) if (name && !index.has(name)) index.set(name, id);
  }
  return index;
}

/** 名前札が書き換わった時に呼ぶ（その時点で、話者の立ち絵には .active が付いている）。 */
function syncSpeaker() {
  if (!host || !nameTag) return;
  const name = (nameTag.textContent || "").replace(/（LIME）$/, "");
  nameIndex ||= buildNameIndex();
  // 名前で引けない相手（まだ名前を知らない「？？？」など）は、話している立ち絵から引く。
  const id = nameIndex.get(name) || portraits?.querySelector(":scope > img.portrait.active")?.dataset.speaker || "";
  const color = colorOf(id);
  if (color) setIfChanged(host, SPEAKER_VAR, color);
  else host.style.removeProperty(SPEAKER_VAR);
}

const onPortraitLoad = (event) => { if (event.target?.matches?.("img.portrait")) syncLights(); };

function detachParts() {
  portraitObserver?.disconnect();
  nameObserver?.disconnect();
  portraitObserver = nameObserver = null;
  portraits?.removeEventListener("load", onPortraitLoad, true);
  clearLights();
  portraits = nameTag = null;
}

/** 会話の DOM（engine.js の buildDom が最初の会話で作る）へ監視を掛ける。作り直されたら掛け直す。 */
function attachParts() {
  const nextPortraits = host.querySelector(":scope > .vn-portraits");
  const nextName = host.querySelector(":scope > .vn-box > .vn-name");
  if (nextPortraits === portraits && nextName === nameTag) return;
  detachParts();
  portraits = nextPortraits;
  nameTag = nextName;
  if (portraits && canMask()) {
    portraitObserver = new MutationObserver(syncLights);
    portraitObserver.observe(portraits, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "src", "data-pos", "data-speaker"] });
    portraits.addEventListener("load", onPortraitLoad, true);
    syncLights();
  }
  if (nameTag) {
    nameObserver = new MutationObserver(syncSpeaker);
    nameObserver.observe(nameTag, { childList: true, characterData: true, subtree: true });
    syncSpeaker();
  }
}

export function setActive(on) {
  if (active === !!on) return;
  active = !!on;
  setMenuFigure(active);
  setPortrait(active);
  if (active) {
    host = document.getElementById("vn");
    if (!host) return;
    hostObserver = new MutationObserver(attachParts);
    hostObserver.observe(host, { childList: true });
    attachParts();
    bgHost = document.getElementById("bg");
    if (bgHost && canMask()) {
      bgObserver = new MutationObserver(syncAmbient);
      bgObserver.observe(bgHost, { childList: true });
      syncAmbient();
    }
    return;
  }
  hostObserver?.disconnect();
  hostObserver = null;
  bgObserver?.disconnect();
  bgObserver = null;
  bgHost = null;
  ambientKey = null;
  ambientRun++;
  detachParts();
  host?.style.removeProperty(SPEAKER_VAR);
  host?.style.removeProperty(AMBIENT_VAR);
  if (host && !host.getAttribute("style")) host.removeAttribute("style");
  host = null;
  nameIndex = null;
}
