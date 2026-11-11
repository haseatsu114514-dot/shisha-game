// 新版（現行の画面を磨き上げた様式・LK02）。見た目は css/look-neo.css、ここは絵の光・動きなど CSS だけでは足りない分。
// setActive(false) では、足した要素・監視・クラスをすべて片付けて現行へ戻す。
//
// ここで足すのは次の2つだけ（どちらも会話の DOM が変わった時にだけ動く。毎フレームの処理は無い）:
//   1. 場面の光: 立ち絵（.vn-portraits > img.portrait）1枚ごとに、同じ位置・同じ大きさの <i class="neo-light"> を直後へ置く。
//      立ち絵の絵を型（mask）にして、色は CSS が soft-light で重ねる。立ち絵の img 自体には触らない。
//   2. 名前の縦線の色: 話している人の色（characters.json の intro_cutin.color）を #vn の --neo-speaker へ入れる。
// 会話エンジン（vn/engine.js）は立ち絵を img だけで数え、登場を img.getAnimations() で待つ。
// そのため img には要素もクラスも動きも足さない（呼吸は CSS が .vn-portraits の層ごと動かす）。
import { DB, realName } from "../core/data.js";

const LIGHT = "neo-light";
const SPEAKER_VAR = "--neo-speaker";
const MASK_VAR = "--neo-mask";

let active = false;
let host = null;          // #vn
let portraits = null;     // .vn-portraits
let nameTag = null;       // .vn-name
let hostObserver = null;
let portraitObserver = null;
let nameObserver = null;
let nameIndex = null;     // 表示名 → キャラID（立ち絵の無い話者の色を引く）
const lights = new Map(); // img → 光の層

const canMask = () => typeof CSS !== "undefined"
  && (CSS.supports("mask-image", "none") || CSS.supports("-webkit-mask-image", "none"))
  && CSS.supports("mix-blend-mode", "soft-light");

function setIfChanged(node, name, value) {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

/** 立ち絵1枚ぶんの光を、立ち絵の今の状態（位置・大きさ・表情の絵・話者かどうか）に合わせる。 */
function syncLight(img, light) {
  const cls = `${LIGHT}${img.classList.contains("active") ? " active" : ""}${img.classList.contains("enter") ? " enter" : ""}`;
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
  for (const [img, light] of lights) {
    if (imgs.includes(img)) continue;
    light.remove();
    lights.delete(img);
  }
  for (const img of imgs) {
    let light = lights.get(img);
    if (!light) {
      light = document.createElement("i");
      light.setAttribute("aria-hidden", "true");
      lights.set(img, light);
    }
    // 重なりの順を立ち絵に合わせる（光は自分の立ち絵のすぐ上、次の立ち絵より下）。
    if (img.nextSibling !== light) img.after(light);
    syncLight(img, light);
  }
  // 自分の書き換えで監視を回し続けない。
  portraitObserver?.takeRecords();
}

function clearLights() {
  for (const light of lights.values()) light.remove();
  lights.clear();
  portraits?.querySelectorAll(`.${LIGHT}`).forEach((node) => node.remove());
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
  if (active) {
    host = document.getElementById("vn");
    if (!host) return;
    hostObserver = new MutationObserver(attachParts);
    hostObserver.observe(host, { childList: true });
    attachParts();
    return;
  }
  hostObserver?.disconnect();
  hostObserver = null;
  detachParts();
  host?.style.removeProperty(SPEAKER_VAR);
  if (host && !host.getAttribute("style")) host.removeAttribute("style");
  host = null;
  nameIndex = null;
}
