// 場面の切り替えの型。標準の切り替え＝煙のにじみ（TMG45。前の背景を覆わず煙の形でほどく）／就寝から翌朝＝夜明け（TMG47。部屋の絵が窓から明ける）／
// マップから場所への移動（transition-moves.js・TMG46）／敗北と再挑戦（#2688 A19）。
// 2026-11-11 からの作り直しの方針（ゲームの絵で作る・紫の面で覆わない）は remake/previews/motion-direction/ と台帳 TMG35〜。
// 紫の図形の型（一筆・波）は、作り直しが済むまでの旧型。旧型の一覧は asset_sources/transitions/scene-plan-20261009/README.md。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";
import { W, H, COLOR, EASE, reducedMotion, svg, stageSvg, move, holdKeys } from "./transition-kit.js";
import { moveCurtain, moveStyle } from "./transition-moves.js";
import { state } from "./state.js";
import { createEntrySound } from "./entry-sound.js";
import { withStoreArrival } from "./store-arrival.js";

// 全面を覆う型の数。覆っている間の背景切り替えは、別の幕を出さずに差し替える（ui.setBg）
let covering = 0;
export const isCovering = () => covering > 0;
export function holdCover() {
  covering++;
  const release = holdKeys();
  let done = false;
  return () => { if (done) return; done = true; covering--; release(); };
}

// 次の背景切り替えで使う型の予約。マップで押したピンの位置や行き先の名前を渡す。古い予約は使わない
let cue = null;
export function cueTransition(kind, opts = {}) {
  cue = { kind, opts, at: performance.now() };
}
/** 入店前の体力確認などで待った場合も、同じ行き先の予約を実際の入店に使う。 */
export function refreshPlaceCue(spotId) {
  if (cue?.kind === "place" && cue.opts.spotId === spotId) cue.at = performance.now();
}
/** 入店前に街へ戻った場合は、その店の入店演出を次の移動へ持ち越さない。 */
export function cancelPlaceCue(spotId) {
  if (cue?.kind === "place" && cue.opts.spotId === spotId) cue = null;
}
function takeCue() {
  const c = cue;
  cue = null;
  return c && performance.now() - c.at < 3000 ? c : null;
}

export function takeSceneArrival() {
  const cued = takeCue();
  return { cued, commitArrival: createEntrySound(cued?.kind === "place" ? cued.opts : null, state?.chapter, () => SE.doorbell()) };
}

// ---------------------------------------------------------------- 一筆: 指定のない背景の切り替え（標準の幕）

// S字の縁を持つ帯（ローカル座標: x方向に波打ち、y方向に進む）。scene-plan-20261009 の一筆を1280×720へ縮めた形
function sBand(y0, y1, amp = 136, w = 1240) {
  return `M ${-w} ${y0} C ${-w / 2} ${y0 - amp}, ${-w / 5} ${y0 - amp}, 0 ${y0} S ${w / 2} ${y0 + amp}, ${w} ${y0} ` +
    `L ${w} ${y1} C ${w / 2} ${y1 + amp}, ${w / 5} ${y1 + amp}, 0 ${y1} S ${-w / 2} ${y1 - amp}, ${-w} ${y1} Z`;
}
// 帯の進み: 画面の外（右下）→ 画面を覆う → 画面の外（左上）。帯の長さ2000、画面の対角の半分は約734
export const STROKE = { from: 900, cover: -900, to: -3000, angle: -32 };

/** 紫の一筆の帯。先頭と後尾にラベンダーの縁、中ほどに細い筋が一本 */
export function strokeBand({ angle = STROKE.angle, fill = COLOR.purple, edge = COLOR.lav } = {}) {
  const mov = svg("g", {}, [
    svg("path", { d: sBand(0, 56), fill: edge }),
    svg("path", { d: sBand(56, 1944), fill }),
    svg("path", { d: sBand(884, 916), fill: edge, "fill-opacity": ".55" }),
    svg("path", { d: sBand(1944, 2000), fill: edge }),
  ]);
  mov.style.transform = `translateY(${STROKE.from}px)`;
  const art = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg", preserveAspectRatio: "xMidYMid slice" }, [
    svg("g", { transform: `translate(${W / 2} ${H / 2}) rotate(${angle})` }, [mov]),
  ]);
  return { art, mov };
}

// ---------------------------------------------------------------- 煙のにじみ: 標準の場面の切り替え（TMG44・A）

// 前の背景を幕で覆わず、煙の形の境目で下から上へほどいて、下に置いた次の背景を見せる。境目と一緒に薄い煙が昇る。
// マスクと煙は計算で作った小さな画像（asset_sources/transitions/smoke-dissolve-20261111/make_masks.py）。
// 紫の一筆（下の strokeBand）は、DS風の2画面（黒の暗転）と再挑戦（retryStroke）だけに残る。
let smokeUrls = null;
/** マスク2枚と煙の絵の URL（js-<版>/ へ写しても同じ深さなので、このファイルからの相対で引く） */
export function smokeArt() {
  if (!smokeUrls) {
    const dir = new URL("../../img/ui/transitions/smoke/", import.meta.url).href;
    smokeUrls = { a: `${dir}wipe-a.webp`, b: `${dir}wipe-b.webp`, haze: `${dir}haze.webp` };
  }
  return smokeUrls;
}
let smokeReady = null; // null＝まだ読んでいない、Promise＝読み込み中、true／false＝結果
const smokeImages = []; // デコード済みの3枚を保持し、GC後の切り替えでも再取得させない
const canMask = () => typeof CSS !== "undefined" && !!CSS.supports
  && (CSS.supports("mask-image", 'url("x.png")') || CSS.supports("-webkit-mask-image", 'url("x.png")'));
/** マスクと煙の絵を先に読む（このファイルを読み込んだ時に一度）。読めるまでの切り替えは、前の背景を薄くするだけ */
export function warmSmoke() {
  if (smokeReady !== null) return smokeReady;
  if (typeof Image !== "function" || !canMask()) { smokeReady = false; return false; }
  smokeReady = Promise.all(Object.entries(smokeArt()).map(([key, src]) => {
    const img = new Image();
    // CSS の mask-image は CORS で取りに行く。先読みも同じ取り方にしないと、ほどくたびに取り直す（煙の絵は普通の背景なのでそのまま）
    if (key !== "haze") img.crossOrigin = "anonymous";
    smokeImages.push(img);
    img.src = src;
    return img.decode();
  })).then(() => (smokeReady = true), () => { smokeImages.length = 0; return (smokeReady = false); });
  return smokeReady;
}
// 起動の早い段階（ui.js がこのファイルを読む時）に読み始める。ブラウザでないテストの環境では何もしない。
if (typeof window !== "undefined" && typeof document !== "undefined") warmSmoke();

const MASK = (pos) => ({ maskPosition: pos, webkitMaskPosition: pos });

/**
 * 場面の切り替え（smokeCurtain）と同じ煙のにじみで、node を下から上へほどいて消す（TMG58〜）。
 * 煙の絵がまだ読めない・使えない環境では薄くするだけ。消し終えても node は残す（片付けは呼び出し側）。
 */
export async function smokeOut(node, ms = 780) {
  const ready = await Promise.race([Promise.resolve(warmSmoke()), sleep(300).then(() => false)]);
  if (ready !== true) return move(node, [{ opacity: 1 }, { opacity: 0 }], Math.round(ms * 0.6), { easing: "ease" });
  const art = smokeArt();
  const mask = `url("${art.a}"), url("${art.b}")`;
  Object.assign(node.style, {
    maskImage: mask, webkitMaskImage: mask, maskSize: "100% 300%", webkitMaskSize: "100% 300%",
    maskRepeat: "no-repeat", webkitMaskRepeat: "no-repeat", maskComposite: "intersect", webkitMaskComposite: "source-in",
  });
  return move(node, [MASK("50% 0%, 50% 0%"), { ...MASK("50% 46%, 50% 56%"), offset: 0.5 }, MASK("50% 100%, 50% 100%")], ms, { easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
}

/**
 * 煙のにじみの幕。覆わないので covered はすぐ解決し、ui.setBg が次の背景を前の背景の下に置いて dissolve() で前の背景を渡す。
 * release() で前の背景を煙の形にほどいて消す。通常 約0.8秒、SKIP中・短い幕（brief）は 約0.42秒、
 * 動きを減らす設定やマスクが使えない時は、前の背景を薄くするだけ（約0.22秒）。ほどけている間は Enter・Space を受け付けない。
 */
function smokeCurtain(host, { fast = false, reduced = false } = {}) {
  const masked = !reduced && smokeReady === true;
  const ms = !masked ? (reduced ? 220 : 320) : fast ? 420 : 780;
  const node = el("div.scene-curtain.smoke", { "aria-hidden": "true", dataset: { transition: masked ? "smoke" : "fade" } });
  const art = masked ? smokeArt() : null;
  const haze = masked ? el("i.smoke-haze", { style: { backgroundImage: `url("${art.haze}")` } }) : null;
  if (haze) node.append(haze);
  const unhold = holdKeys();
  host.append(node);
  const covered = nextFrame();
  let olds = [];
  let released = false;
  return {
    covered,
    /** ui.setBg から: 次の背景の上に残した前の背景（いちばん上だけをほどき、下に隠れている分はすぐ片付ける） */
    dissolve(nodes) { olds = nodes; },
    async release() {
      if (released) return;
      released = true;
      try {
        await covered;
        // 次の背景・画面・台詞を描いてから、前の背景をほどき始める。
        await nextFrame(); await nextFrame();
        const old = olds.at(-1);
        olds.slice(0, -1).forEach((o) => o.remove());
        if (!old) return;
        old.dataset.dissolving = "1";
        if (!masked) {
          await move(old, [{ opacity: 1 }, { opacity: 0 }], ms, { easing: "ease" });
        } else {
          const mask = `url("${art.a}"), url("${art.b}")`;
          Object.assign(old.style, {
            maskImage: mask, webkitMaskImage: mask,
            maskSize: "100% 300%", webkitMaskSize: "100% 300%",
            maskRepeat: "no-repeat", webkitMaskRepeat: "no-repeat",
            maskComposite: "intersect", webkitMaskComposite: "source-in",
          });
          const easing = "cubic-bezier(.45,0,.55,1)";
          // 2枚のマスクを少しずらして送り、境目の形を変えながら昇らせる。煙は境目の高さについていく。
          const wipe = move(old, [MASK("50% 0%, 50% 0%"), { ...MASK("50% 46%, 50% 56%"), offset: 0.5 }, MASK("50% 100%, 50% 100%")], ms, { easing, fill: "forwards" });
          move(haze, [{ top: "125%", opacity: 0 }, { top: "23%", opacity: 0.55, offset: 0.5 }, { top: "-75%", opacity: 0 }], ms, { easing, fill: "forwards" });
          await wipe;
        }
        old.remove();
      } finally {
        olds.forEach((o) => o.isConnected && o.remove());
        node.remove();
        unhold();
      }
    },
  };
}

/**
 * 背景を替えるときの標準の切り替え。煙のにじみ（smokeCurtain・TMG44）。
 * DS風の2画面では黒の暗転（game-ds.css。中身の紫の一筆は見せない）。マップ→場所は移動の型（transition-moves.js）。
 * 素材の読み込みを待つ間は、前の背景のまま待つ（ui.setBg）。
 */
export function createSceneCurtain(host, { fast = false, sceneArrival = takeSceneArrival() } = {}) {
  const reduced = reducedMotion();
  const { cued, commitArrival: entry } = sceneArrival;
  const arrival = (curtain) => Object.assign(curtain, { commitArrival: entry });
  if (cued?.kind === "place" && !fast && !reduced) return arrival(withStoreArrival(host, moveCurtain(host, moveStyle(cued.opts), cued.opts), cued.opts, { fast, reduced }));
  if (!(typeof document !== "undefined" && document.body?.classList.contains("game-ds"))) {
    warmSmoke();
    const smoke = smokeCurtain(host, { fast, reduced });
    return arrival(cued?.kind === "place" ? withStoreArrival(host, smoke, cued.opts, { fast, reduced }) : smoke);
  }
  const coverMs = reduced ? 90 : fast ? 150 : 340;
  const revealMs = reduced ? 90 : fast ? 170 : 400;
  const node = el("div.scene-curtain.stroke", { "aria-hidden": "true", style: { "--st-ms": `${coverMs}ms` }, dataset: { transition: reduced ? "fade" : "stroke" } });
  const band = reduced ? null : strokeBand();
  if (band) node.append(band.art);
  else node.classList.add("veil");
  const unhold = holdKeys();
  host.append(node);
  const covered = (async () => {
    await nextFrame();
    node.classList.add("cover");
    if (band) await move(band.mov, [{ transform: `translateY(${STROKE.from}px)` }, { transform: `translateY(${STROKE.cover}px)` }], coverMs, { easing: EASE.in });
    else await move(node, [{ opacity: 0 }, { opacity: 1 }], coverMs, { easing: "ease" });
  })();
  let released = false;
  const curtain = { covered, async release() {
    if (released) return;
    released = true;
    try {
      await covered;
      // 次の背景・画面・台詞を幕の内側で描いてから開く。
      await nextFrame(); await nextFrame();
      node.classList.add("reveal");
      if (band) await move(band.mov, [{ transform: `translateY(${STROKE.cover}px)` }, { transform: `translateY(${STROKE.to}px)` }], revealMs, { easing: EASE.out });
      else await move(node, [{ opacity: 1 }, { opacity: 0 }], revealMs, { easing: "ease" });
    } finally {
      node.remove();
      unhold();
    }
  } };
  return arrival(cued?.kind === "place" ? withStoreArrival(host, curtain, cued.opts, { fast, reduced }) : curtain);
}

// ---------------------------------------------------------------- 覆ったまま次の場面へ渡す

// 時間が過ぎる波などが画面を覆ったまま、次の背景が出るまで待つ（#2688 F3 の時間経過の型）。次の ui.setBg がこの幕を受け取り、
// 新しい背景を描いてから開く。次の背景が来なければ、受け取り待ちの上限で自分から開く。
let parked = null;
export function parkCover(release, { maxMs = 1500 } = {}) {
  takeParkedCover()?.();
  let done = false;
  const once = async () => { if (done) return; done = true; clearTimeout(timer); if (parked === once) parked = null; await release(); };
  const timer = setTimeout(once, maxMs);
  parked = once;
}
/** 受け取る側（ui.setBg）。預かっている幕があれば、その開く関数を返して預かりを空にする。 */
export function takeParkedCover() {
  const release = parked;
  parked = null;
  return release;
}

// ---------------------------------------------------------------- 波: 時間が過ぎる（つなぎの一行・CI101）

// 右の縁が3つの丸いこぶで膨らむ帯。左へ幅 w だけ伸びる（1280×720 の座標）
function bumpBand(w = 2100, bulge = 190) {
  const n = 3, step = 800 / n;
  let d = `M ${-w} -40 L 0 -40 `;
  for (let i = 0; i < n; i++) {
    const y = -40 + i * step;
    d += `C ${bulge} ${y}, ${bulge} ${y + step}, 0 ${y + step} `;
  }
  d += `L ${-w} 760 `;
  for (let i = n - 1; i >= 0; i--) {
    const y = -40 + i * step;
    d += `C ${-w + bulge} ${y + step}, ${-w + bulge} ${y}, ${-w} ${y} `;
  }
  return d + "Z";
}
const WAVE = { from: -300, cover: 1320, to: 3480 };

/**
 * つなぎの一行（「夜、tonariに顔を出す──」など）を、丸い波に乗せて見せる（#2688 F3 の時間経過の型）。
 * 選別（#2809）で A9 のつなぎの一行への適用は外したので、今は呼び出し元がない（calendar.js の beat は暗転＋文字）。
 * 夕方のピンクを先頭にした波が左から流れて画面を覆い、一行が波の上を滑ってくる。読み終えたら波は覆ったまま
 * 次の場面へ預ける（parkCover）。dusk: false で夜の帰り道の色（ピンクなし・ゆっくり）。
 * 戻り値は覆っている間に呼ぶ mid() の結果。動きを減らす設定では、紫の面と一行のフェード。
 */
export async function waveBeat(host, text, mid = null, { dusk = true } = {}) {
  const reduced = reducedMotion();
  const unhold = holdCover();
  const node = el("div.tr-wave", { "aria-hidden": "true", dataset: { transition: "wave" } });
  const line = el("div.tr-wave-line", { text, dataset: { test: "beat-line" } });
  host.append(node);
  let release = null;
  try {
    let mov = null;
    if (reduced) {
      node.classList.add("veil");
      await move(node, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
    } else {
      mov = svg("g", {}, [
        svg("g", { transform: "translate(90 0)" }, [svg("path", { d: bumpBand(), fill: dusk ? COLOR.dusk : COLOR.lav })]),
        svg("path", { d: bumpBand(), fill: dusk ? COLOR.purple : COLOR.deep }),
      ]);
      mov.style.transform = `translateX(${WAVE.from}px)`;
      node.append(svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg", preserveAspectRatio: "xMidYMid slice" }, [mov]));
      await nextFrame();
      await move(mov, [{ transform: `translateX(${WAVE.from}px)` }, { transform: `translateX(${WAVE.cover}px)` }], dusk ? 480 : 620, { easing: EASE.in });
    }
    const result = mid ? await mid() : undefined;
    node.append(line);
    await move(line, [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }], reduced ? 200 : 380, { easing: EASE.out });
    await sleep(reduced ? 1100 : 950);
    await move(line, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: reduced ? "none" : "translateX(40px)" }], 260, { easing: EASE.in });
    line.remove();
    release = async () => {
      try {
        await nextFrame(); await nextFrame();
        if (mov) await move(mov, [{ transform: `translateX(${WAVE.cover}px)` }, { transform: `translateX(${WAVE.to}px)` }], dusk ? 560 : 700, { easing: EASE.out });
        else await move(node, [{ opacity: 1 }, { opacity: 0 }], 200, { easing: "ease" });
      } finally { node.remove(); unhold(); }
    };
    parkCover(release);
    return result;
  } finally {
    // 途中で例外が出た場合だけ、ここで片付ける（通常は預けた幕が開くときに片付く）
    if (!release) { node.remove(); unhold(); }
  }
}

// ---------------------------------------------------------------- 敗北と再挑戦（#2688 A19・作り直し TMG59）

/**
 * 大会の敗北から GAME OVER へ入る手前。画面の中心から色が抜けて灰色になり、会場の照明が外側から段々に落ちる（約1.9秒）。
 * 白い線の煙はやめた（TMG59）。覆ったまま返すので、後ろに GAME OVER の画面を出してから、戻り値の関数で灰色を薄れさせる。
 * 動きを減らす設定では何もしない。
 */
export async function defeatFade(host = document.getElementById("fx")) {
  if (!host || reducedMotion()) return async () => {};
  const unhold = holdCover();
  const node = el("div.tr-defeat", { "aria-hidden": "true", dataset: { transition: "defeat" } });
  const gray = el("div.tr-defeat-gray");
  const dim = el("div.tr-defeat-dim");
  node.append(gray, dim);
  host.append(node);
  try {
    move(gray, [{ clipPath: "circle(0% at 50% 55%)" }, { clipPath: "circle(80% at 50% 55%)" }], 1000, { easing: EASE.snap });
    await sleep(320);
    // 照明が3段で落ちる（落ちるたびに少し揺り戻す）
    await move(dim, [
      { opacity: 0 }, { opacity: 0.42, offset: 0.12 }, { opacity: 0.36, offset: 0.26 },
      { opacity: 0.68, offset: 0.42 }, { opacity: 0.62, offset: 0.58 }, { opacity: 0.88, offset: 0.76 }, { opacity: 0.86 },
    ], 1500, { easing: "linear" });
  } catch (error) { node.remove(); unhold(); throw error; }
  return async () => {
    try { await move(node, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: "ease" }); }
    finally { node.remove(); unhold(); }
  };
}

/**
 * 再挑戦: 暗転して、覆っている間に mid() で大会の頭へ戻す。戻った場面は色の抜けた灰色で現れ、
 * 煙のにじみで色が戻る（TMG59・見本1の仕組み。紫の一筆はやめた）。
 */
export async function retryStroke(mid, host = document.getElementById("fx")) {
  if (!host || reducedMotion()) { await mid?.(); return; }
  const unhold = holdCover();
  const node = el("div.tr-retry", { "aria-hidden": "true", dataset: { transition: "retry" } });
  const veil = el("div.tr-retry-veil");
  node.append(veil);
  host.append(node);
  try {
    await move(veil, [{ opacity: 0 }, { opacity: 1 }], 340, { easing: "ease" });
    await mid?.();
    await nextFrame(); await nextFrame();
    const pic = bgSnapshot();
    if (pic) {
      pic.classList.add("tr-retry-gray");
      pic.style.filter = `${pic.style.filter || ""} grayscale(1) brightness(.72)`.trim();
      node.append(pic);
      await nextFrame();
      veil.remove();
      await sleep(260);
      await smokeOut(pic, 1000);
    } else {
      await move(veil, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: "ease" });
    }
  } finally { node.remove(); unhold(); }
}

// ---------------------------------------------------------------- 夜明け: 就寝 → 翌朝（TMG47・見本 remake/previews/motion-direction/ の3）

// 紫の夜の面とラベンダーの地平線をやめ、ゲームの絵で作る。眠る前の部屋の絵が暗く沈み、左下に日付の題字が出て、
// 窓から差す光で朝の部屋の絵に替わる。天気は図形ではなく、窓の光（晴れ）・青みと曇りの絵（くもり）・窓の雨（雨）で伝える。

function flipNumber(value) {
  // 日付はすでに更新済み。送りの両面を朝の値にし、前日の数字を朝の案内に混ぜない。
  const span = el("span.tr-flip", [el("i", { text: String(value) }), el("i", { text: String(value) })]);
  span.lastChild.style.transform = "translateY(100%)";
  return span;
}
/** 数字を下から送り入れる（両面とも朝の値）。中断されても朝の数字が見えたまま残る */
async function flip(span) {
  const [before, after] = span.children;
  await Promise.all([
    move(before, [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], 460, { easing: EASE.inOut }),
    move(after, [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], 460, { easing: EASE.inOut }),
  ]);
  // WAAPIの中断後も朝の数字が残るよう、最終状態をDOMにも確定する。
  before.remove();
  after.style.transform = "translateY(0)";
  after.style.opacity = "1";
}

/** いま見えている背景（#bg のいちばん上の絵）の写し。夜明けの幕の中で、眠る前と朝の場面として使う。
 *  無い時と DS風の2画面（背景は上画面だけ・幕は両画面）では null（暗い面だけで明ける） */
function bgSnapshot() {
  const host = typeof document !== "undefined" && !document.body?.classList?.contains("game-ds") ? document.getElementById?.("bg") : null;
  const top = host ? [...host.children].filter((n) => n.classList?.contains("bg-img")).at(-1) : null;
  if (!top?.cloneNode) return null;
  const copy = top.cloneNode(true);
  copy.classList.add("tr-dawn-pic");
  copy.style.transition = "none";
  copy.style.opacity = "1";
  const filter = typeof getComputedStyle === "function" ? getComputedStyle(top).filter : "";
  if (filter && filter !== "none") copy.style.filter = filter; // 天気・夜の色づけ（#bg の下でだけ効く指定）を写す
  return copy;
}
/** 自室の絵なら窓の位置（光の出どころ）。ほかの絵は上の真ん中から明ける */
const isHome = (pic) => /bg_home/.test(`${pic?.style?.backgroundImage || ""} ${pic?.dataset?.sceneBg || ""} ${pic?.dataset?.homeScene || ""}`);

/**
 * 眠る前の部屋の絵が暗く沈み、朝の日付（DAYと残り日数）が左下に出て数字が送られ、窓から差す光で朝の部屋の絵に替わる。
 * mid() は暗く沈んだ間に日付を進めて朝の背景にし、{ day, left, weather, sick, forecast, … } を返す。
 */
export async function nightToMorning(host, mid) {
  const reduced = reducedMotion();
  const unhold = holdCover();
  const node = el("div.tr-dawn", { "aria-hidden": "true", dataset: { transition: "dawn" } });
  host.append(node);
  try {
    // 1. 眠る前の絵（写し）の上で灯りが落ちる。写しは元の絵と同じなので、上に出ていた画面だけが消えていく
    const night = bgSnapshot() || el("div.tr-dawn-pic.blank");
    const grade = el("div.tr-dawn-grade");
    node.append(night, grade);
    await nextFrame();
    move(night, [{ opacity: 0 }, { opacity: 1 }], reduced ? 200 : 320, { easing: "ease" });
    await move(grade, [{ opacity: 0 }, { opacity: 0.9 }], reduced ? 260 : 460, { easing: "ease" });
    const info = await mid();
    if (!info) return;
    // 2. 朝の絵（mid() が #bg に置いた朝の背景の写し）。窓を中心に広がる光の形で見せる
    const day = bgSnapshot();
    const home = isHome(day);
    const weather = info.sick ? null : info.weather ?? (info.rain ? "rain" : null);
    if (info.sick) node.classList.add("sick");
    if (day) {
      day.classList.add("day");
      if (!reduced) day.classList.add("masked"); // 窓から広がる光の形（css: .tr-dawn-pic.day.masked）
      node.style.setProperty?.("--dawn-at", home ? "61% 31%" : "50% 22%");
      node.insertBefore?.(day, grade);
    }
    if (info.eve) {
      // 大会・勝負の前夜の当日版（#2688 F3 の時間経過の型）: 日付は出さず、長い夜のあとゆっくり明ける。DAYは当日の場面が出す。
      // 選別（#2809）で A10 の大会前夜への適用は外したので、今は info.eve を渡す呼び出し元がない（前夜は暗転のまま）。
      await sleep(reduced ? 700 : 900);
      await dawnReveal(node, day, grade, { reduced, slow: 1.5 });
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 400, { easing: "ease" });
      return;
    }
    // 3. 日付の題字（左下）。最終日が決まっていない章（第5章の日程未定）は残り日数を送らず、章の一言だけ出す
    const dayFlip = flipNumber(info.day);
    const leftFlip = info.left === null || info.left === undefined ? null : flipNumber(info.left);
    const label = weather ? (await import("../daily/weather.js").catch(() => ({}))).WEATHER_LABEL?.[weather] : null;
    const sub = info.sick
      ? el("div.tr-dawn-sub", [el("span", { text: "……熱っぽい" })])
      : !leftFlip ? el("div.tr-dawn-sub", [el("span", { text: info.undatedNote || "" })])
      : el("div.tr-dawn-sub", [el("span", { text: `${info.tournamentName || "SMOKE CROWN CUP"} まで あと` }), leftFlip, el("span", { text: "日" })]);
    if (label) sub.append(el("span.tr-dawn-wx", { text: label, dataset: { weather } }));
    const rule = el("i.tr-dawn-rule");
    const card = el("div.tr-dawn-card", { dataset: { test: "dawn-card" } }, [el("div.tr-dawn-day", [el("small", { text: info.dayLabel || "DAY" }), dayFlip]), rule, sub]);
    if (info.forecast) card.append(el("small.tr-dawn-sub.tr-dawn-forecast", { text: `明日は${info.forecast}`, dataset: { test: "dawn-forecast" } }));
    node.append(card);
    if (reduced) {
      [dayFlip, leftFlip].filter(Boolean).forEach((s) => { s.firstChild.remove(); s.firstChild.style.transform = ""; s.firstChild.style.opacity = ""; });
      await move(card, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      await dawnReveal(node, day, grade, { reduced });
      await sleep(1100);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" });
      return;
    }
    move(card, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], 380, { easing: EASE.out });
    move(rule, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 640, { delay: 120, easing: EASE.out });
    if (info.sick) {
      card.animate([
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
        { transform: "skewX(3deg) scale(1.02)", filter: "blur(1.2px)" },
        { transform: "skewX(-2deg) scale(.99)", filter: "blur(.4px)" },
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
      ], { duration: 900, iterations: Infinity, easing: "ease-in-out" });
    }
    await sleep(380);
    SE.tick();
    await Promise.all([flip(dayFlip), info.sick || !leftFlip ? null : sleep(90).then(() => flip(leftFlip))]);
    await sleep(info.sick ? 650 : 160);
    // 4. 窓から朝が広がる。天気は窓の光・青み・窓の雨で。晴れた朝は小鳥の声（雨・曇り・寝込んだ朝は鳴らさない）
    if (weather === "sun") SE.birds?.();
    await dawnReveal(node, day, grade, { weather, home, slow: weather && weather !== "sun" ? 1.2 : 1 });
    // 5. 日付が抜けて朝の場面へ（写しは #bg と同じ絵なので、上の画面だけが戻ってくる）
    move(card, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-12px)" }], 340, { easing: EASE.in });
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 120, easing: "ease" });
  } finally {
    node.remove();
    unhold();
  }
}

/** 朝の絵を窓から広げ、暗さを引く。晴れは窓の光と差し込む筋、くもり・雨は青み、雨は窓に雨（自室の絵のときだけ） */
async function dawnReveal(node, day, grade, { reduced = false, weather = null, home = false, slow = 1 } = {}) {
  if (reduced || !day) {
    if (day) await move(day, [{ opacity: 0 }, { opacity: 1 }], 260, { easing: "ease" });
    move(grade, [{ opacity: 0.9 }, { opacity: 0 }], reduced ? 260 : 700, { easing: "ease" });
    return;
  }
  const fx = [];
  if (weather === "sun") {
    fx.push([el("i.tr-dawn-sun"), [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], 1600]);
    if (home) for (const b of ["b1", "b2"]) fx.push([el(`i.tr-dawn-beam.${b}`), [{ opacity: 0 }, { opacity: 0.8, offset: 0.4 }, { opacity: 0 }], 1600]);
  } else if (weather) {
    fx.push([el("i.tr-dawn-cool"), [{ opacity: 0 }, { opacity: 0.4, offset: 0.4 }, { opacity: 0 }], 1700]);
  }
  if (weather === "rain" && home) fx.push([el("i.tr-dawn-rainpane"), [{ opacity: 0, backgroundPosition: "0 0" }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.6, offset: 0.8 }, { opacity: 0, backgroundPosition: "-80px 340px" }], 2000]);
  fx.forEach(([n]) => node.insertBefore?.(n, grade.nextSibling));
  fx.forEach(([n, frames, ms], i) => move(n, frames, ms, { delay: i * 120, easing: "ease-out" }));
  move(grade, [{ opacity: 0.9 }, { opacity: 0 }], 800 * slow, { easing: EASE.inOut });
  await move(day, [{ maskSize: "0% 0%", webkitMaskSize: "0% 0%" }, { maskSize: "420% 420%", webkitMaskSize: "420% 420%" }], 1000 * slow, { easing: EASE.inOut });
}
