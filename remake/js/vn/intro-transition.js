// 会話の立ち絵から、グラフィック絵柄の登場カットインへ「変身」するつなぎ（2026-11-02 試作）。
// オーナー「急にあの立ち絵からこれになるにはトランジションで自然な転移が要る」（CIG07）→
// 「もっと滑らかでスタイリッシュで自然なアニメーションにしたい」。3案を同じ仕組みで切り替えて比べる。
//
//   none  : つなぎ無しでカットインが出る（設定で選べる）
//   morph : 立ち絵がテーマ色の影になり、影がカメラへ迫って頭の位置を合わせ、影の形そのものが
//           カットインのポーズへ変わって（intro-shape-morph.js）、白く光ってポスター調の本人にほどける。
//           終わりは逆再生せず、文字→本人と背景の順に溶けて、元の立ち絵と場面の色が戻る。2026-11-02 オーナー採用（既定）
//   card  : 立ち絵の上半身を四角い札が切り取り、札が手前へ飛びながら裏返る。裏面がポスター調の本人
//   slash : 本人が一瞬テーマ色に光り、斜めの一閃が画面を右から左へ走って、通った跡がカットインになる
//
// 動きは transform / opacity / clip-path（コンポジタで動く）。morph の形の変化だけは低解像度のキャンバスに描く。時間は MOTIONS の hold に足し、
// 読む時間は削らない。「動きを減らす」では短いフェードだけにする。設定は config.introTransition。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { prepareShapeMorph } from "./intro-shape-morph.js";

export const TRANSITIONS = ["none", "morph", "card", "slash"];
/** tools/intro_graphic_frames.py と同じ、画面上の頭の位置（グラフィック絵柄の人物） */
const HEAD = { top: 16, height: 280, faceX: 268 };
// data/portrait_metrics.json の通常立ち絵 (896px) における両目の中心。
// 配置用の ax は顔の中心とは限らず、これを顔として合わせるとキャラごとに影が横へずれる。
// oneesan は同じ minto の立ち絵を使う。pakki はマスコットの両目の中点を画像で測った。
const STANDING_FACE_X = {
  adam: 430.5, ageha: 477.5, da_silva: 504.5, dr_kemuri: 398, emil: 474,
  hajime: 544.5, hiyori: 419, kumicho: 482.5, kuze: 421.5, maezono: 413,
  maki: 479, mashiro: 443, master_hookah: 413.5, minto: 485, mukai_master: 410.5,
  nagumo: 407, naru: 450.5, noor: 400.5, pakki: 488, rei: 465, rin: 404, sai: 466.5,
  samechan: 460.5, sheikh: 426, steve: 493.5, sumi: 432, tsumugi: 428,
  uranaishi: 406.5, volk: 478, yoru: 411.5,
};
// asset_sources/character-intros/graphic-20261031/heads.json の顔中心 (1024px)。
// 完成絵の frame に当てはめて着地点を出す。個別の安全余白で顔が右へずれる絵にも追従する。
// pakki は前髪で目が隠れるため口の中心を画像で測った。
const GRAPHIC_FACE_X = {
  adam: 490, ageha: 536, da_silva: 520, dr_kemuri: 448, emil: 520,
  hajime: 576, hiyori: 400, kumicho: 512, kuze: 528, maezono: 496,
  maki: 528, mashiro: 496, master_hookah: 500, minto: 512, mukai_master: 535,
  nagumo: 448, naru: 464, noor: 470, oneesan: 480, pakki: 520, rei: 496,
  rin: 512, sai: 512, samechan: 528, sheikh: 505, steve: 560, sumi: 480,
  tsumugi: 512, uranaishi: 480, volk: 544, yoru: 520,
};
const targetFaceX = (id, frame) => frame.left + frame.width * (GRAPHIC_FACE_X[id] ?? 512) / 1024;
const EASE = {
  out: "cubic-bezier(.16,1,.3,1)",      // 到着: 速く入って静かに止まる
  inOut: "cubic-bezier(.7,0,.2,1)",     // 移動: ためてから一気に、最後に減速
  in: "cubic-bezier(.7,0,.84,0)",       // 退場: ゆっくり出て加速
};
const SLASH_LEAN = 360; // 一閃の傾き（上端と下端の x の差。720px の高さに対して）

export const reducedMotion = (config) => matchMedia("(prefers-reduced-motion: reduce)").matches || !!config?.reduceShake;

/**
 * 画面にいる本人の立ち絵を、カットインと同じ 1280×720 の座標で測る。
 * 無ければ null（台本で立ち絵より先にカットインを出す場合など）。
 */
export function measureStanding(id, fx) {
  const img = document.querySelector(`.vn-portraits img.portrait[data-speaker="${id}"]`);
  if (!img || !img.complete || !img.naturalWidth) return null;
  const box = stageBox(fx);
  const r = img.getBoundingClientRect();
  if (r.width < 2) return null;
  return {
    img, src: img.currentSrc || img.src,
    left: (r.left - box.left) / box.k, top: (r.top - box.top) / box.k,
    width: r.width / box.k, height: r.height / box.k,
  };
}

/** FX レイヤーの中で、1280×720 の絵が収まる枠（intro-fit と同じ縮尺） */
function stageBox(fx) {
  const r = fx.getBoundingClientRect();
  const k = Math.min(r.width / 1280, r.height / 720) || 1;
  return { k, left: r.left + (r.width - 1280 * k) / 2, top: r.top + (r.height - 720 * k) / 2 };
}

/** 立ち絵の頭のおおよその位置（本体の高さの約16%を頭とみなす） */
function headOf(rect, p) {
  const bodyTop = rect.top + (1 - p.b - p.h) * rect.height;
  const headH = p.h * rect.height * 0.16;
  const face = STANDING_FACE_X[p.folder];
  const anchor = face == null ? p.ax : face / rect.img.naturalWidth;
  return { top: bodyTop, height: headH, x: rect.left + anchor * rect.width };
}

function animate(node, frames, options) {
  return node.animate(frames, { fill: "both", easing: EASE.out, ...options });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const finished = (animation) => animation.finished.catch(() => {});

/**
 * つなぎを作る。enter() はカットインを置いて、文字の登場（animateIntro）を始めてよい時に解決する。
 * exit() は読み終わった後の退場。cancel() は途中で片づける。
 * @param ctx { id, fx, host, mount(): unmount, frame, standing: { rect, p } | null, colors: { color, secondary, shadow }, config }
 */
export function createTransition(variant, ctx) {
  if (!TRANSITIONS.includes(variant) || variant === "none") return plain(ctx);
  if (reducedMotion(ctx.config)) return fade(ctx);
  if (variant === "morph") return morph(ctx);
  if (variant === "card") return card(ctx);
  return slash(ctx);
}

// ---------------------------------------------------------------- 共通の部品

function plain(ctx) {
  let unmount = null;
  return {
    skip: new Set(),
    enter: async () => { unmount = ctx.mount(); return unmount; },
    exit: null,
    cancel: () => {},
  };
}

function layer(ctx, kind) {
  // intro-fit.js と同じ親レイヤー内の縮尺を使う。getBoundingClientRect() は
  // #stage 自体の縮小を含むので、ここで使うとモバイルで二重に縮小される。
  const k = Math.min(ctx.fx.clientWidth / 1280, ctx.fx.clientHeight / 720) || 1;
  const node = el(`div.ci-transition.${kind}`, {
    "aria-hidden": "true",
    style: `--k:${k};--tr-color:${ctx.colors.color};--tr-secondary:${ctx.colors.secondary};--tr-shadow:${ctx.colors.shadow}`,
  });
  ctx.fx.append(node);
  return node;
}

/** 動きを減らす設定: 暗転とフェードだけ */
function fade(ctx) {
  let under = null, unmount = null;
  return {
    skip: new Set(),
    enter: async () => {
      under = layer(ctx, "under");
      const dim = el("div.ci-tr-dim"); under.append(dim);
      await finished(animate(dim, [{ opacity: 0 }, { opacity: .6 }], { duration: 180 }));
      unmount = ctx.mount();
      return unmount;
    },
    exit: async () => {
      animate(ctx.host, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      await sleep(220);
      under?.remove();
    },
    cancel: () => under?.remove(),
  };
}

/** つなぎの中でカットインを置く。通常のフェードインを待たず、すぐ見える状態にする（つなぎが見せ方を担う） */
function showCutin(ctx) {
  const unmount = ctx.mount();
  ctx.host.style.transition = "none";
  ctx.host.classList.add("in");
  return unmount;
}

/** カットインの人物の、画面上の正方形の枠 */
function targetSquare(frame) {
  return { left: frame.left, top: frame.top, size: frame.width };
}

/** 立ち絵の影（テーマ色で塗った同じ形）。ink は中を下から満たす色 */
function silhouette(ctx, rect) {
  const sil = el("div.ci-tr-sil", {
    style: `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` +
      `-webkit-mask-image:url("${rect.src}");mask-image:url("${rect.src}")`,
  }, [el("div.ci-tr-ink")]);
  return sil;
}

/** 影を「頭が目標の位置・大きさになる」ように動かす変換 */
function headTransform(rect, p, frame, id) {
  const head = headOf(rect, p);
  // 影が到着先の人物より広がらない範囲で拡大し、頭の残りは形の変化中に合わせる。
  const s = Math.min(HEAD.height / head.height, Math.max(1, frame.width / rect.width));
  return {
    origin: `${head.x - rect.left}px ${head.top - rect.top}px`,
    to: `translate(${targetFaceX(id, frame) - head.x}px, ${HEAD.top - head.top}px) scale(${s.toFixed(4)})`,
  };
}

/** 斜めの一閃（右上→左下に傾いた光の線）を from から to へ走らせる。x は線が y=0 を横切る位置 */
function sweepEdge(edge, from, to, duration, delay = 0) {
  const lean = SLASH_LEAN * 200 / 720 - 11, deg = Math.atan2(SLASH_LEAN, 720) * 180 / Math.PI;
  return animate(edge, [
    { transform: `translateX(${from + lean}px) rotate(${deg}deg)`, opacity: 0 },
    { opacity: 1, offset: .08 }, { opacity: 1, offset: .9 },
    { transform: `translateX(${to + lean}px) rotate(${deg}deg)`, opacity: 0 },
  ], { duration, delay, easing: EASE.inOut });
}
/** 一閃で現れる範囲（線より右側） */
const slashClip = (x) => `polygon(${x}px 0px, 1400px 0px, 1400px 720px, ${x - SLASH_LEAN}px 720px)`;

// ---------------------------------------------------------------- morph: 影になって迫り、形を変えて本人になる

/** 立ち絵を、頭がカットインの頭（HEAD）に重なるよう拡大して置いた矩形 */
function alignedRect(rect, p, frame, id) {
  const head = headOf(rect, p), s = Math.min(HEAD.height / head.height, Math.max(1, frame.width / rect.width));
  return {
    left: targetFaceX(id, frame) + s * (rect.left - head.x), top: HEAD.top + s * (rect.top - head.top),
    width: s * rect.width, height: s * rect.height,
  };
}

const easeInOutCubic = (u) => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function morph(ctx) {
  if (!ctx.standing) return slash(ctx); // 立ち絵が無ければ一閃だけ
  const { rect, p } = ctx.standing;
  const dialogue = document.querySelector("#vn");
  const nodes = [], run = [];
  const keep = (a) => { run.push(a); return a; };
  let unmount = null, shape = null, raf = 0;
  const t = headTransform(rect, p, ctx.frame, ctx.id);
  /** requestAnimationFrame で u を 0→1 に進める（距離場の変形は CSS では動かせないため） */
  const tween = (duration, step) => new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const u = Math.min(1, (now - start) / duration);
      step(u);
      if (u < 1) raf = requestAnimationFrame(frame); else resolve();
    };
    raf = requestAnimationFrame(frame);
  });
  return {
    skip: new Set(["background", "portrait"]),
    async enter() {
      const under = layer(ctx, "under"), over = layer(ctx, "over");
      dialogue?.classList.add("intro-morph-dialog-hidden");
      nodes.push(under, over);
      const dim = el("div.ci-tr-dim.desat"); under.append(dim);
      const sil = silhouette(ctx, rect); over.append(sil);
      const ink = sil.firstElementChild;
      const edge = el("div.ci-tr-edge"); over.append(edge);
      sil.style.transformOrigin = t.origin;
      // 変形の距離場は、影が満ちて迫っている間に作る（合成側の動きは止まらない）
      const target = new Image();
      target.src = ctx.host.querySelector(".ci-portrait").src;
      const ready = sleep(16).then(() => target.decode()).then(() => prepareShapeMorph(
        { img: rect.img, ...alignedRect(rect, p, ctx.frame, ctx.id) }, { img: target, ...ctx.frame }, ctx.colors,
      )).catch(() => null);

      // ① 世界の色が抜け、本人の足元から色が満ちて影になる（0〜320ms）
      keep(animate(dim, [{ opacity: 0 }, { opacity: .7 }], { duration: 380 }));
      keep(animate(ink, [{ transform: "translateY(101%)" }, { transform: "translateY(0)" }], { duration: 320, easing: EASE.inOut }));
      if (rect.img?.isConnected) keep(animate(rect.img, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 260 }));
      // ② 影がカメラへ迫り、頭の位置をカットインに合わせる（260〜600ms）
      keep(animate(sil, [{ transform: "none" }, { transform: t.to }], { duration: 340, delay: 260, easing: "cubic-bezier(.45,0,.2,1)" }));
      setTimeout(() => SE.whoosh(), 260);
      await sleep(600);
      shape = await ready;

      const mountCutin = () => {
        unmount = showCutin(ctx);
        // 器の暗い地が一度に出ると場面が急に暗く沈むので、影の下で薄く重ねていく
        keep(animate(ctx.host, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" }));
        ctx.host.classList.add("ci-staged");
        ctx.host.querySelector(".ci-portrait").style.opacity = "0";
        keep(animate(ctx.host.querySelector(".ci-art-background"), [{ opacity: 0, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }], { duration: 720 }));
      };
      if (!shape) {
        // 距離場が作れなかった時（画像の読み込み失敗など）: 影のまま一閃で本人を出す
        mountCutin();
        const portrait = ctx.host.querySelector(".ci-portrait");
        portrait.style.opacity = "";
        const x0 = HEAD.faceX + 520, x1 = HEAD.faceX - 560;
        keep(animate(portrait, [{ clipPath: slashClip(x0) }, { clipPath: slashClip(x1) }], { duration: 260, easing: EASE.inOut }));
        keep(sweepEdge(edge, x0, x1, 300));
        keep(animate(sil, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 60, easing: "ease-in" }));
        await sleep(90);
        return unmount;
      }
      // ③ 影の形が、立ち絵のポーズからカットインのポーズへ変わる。終わりに白く光る（600〜1060ms）
      over.insertBefore(shape.canvas, edge);
      shape.draw(0);
      keep(animate(shape.canvas, [{ opacity: 0 }, { opacity: 1 }], { duration: 70 }));
      keep(animate(sil, [{ opacity: 1 }, { opacity: 0 }], { duration: 70, delay: 30 }));
      let mounted = false;
      await tween(460, (u) => {
        shape.draw(easeInOutCubic(u), Math.max(0, (u - .6) / .4) * .9);
        if (!mounted && u > .5) { mounted = true; mountCutin(); }
      });
      if (!mounted) mountCutin();
      // ④ 光った影が、ポスター調の本人にほどける。斜めの光が一度だけ通る（1060〜1300ms）
      const portrait = ctx.host.querySelector(".ci-portrait");
      portrait.style.opacity = "";
      keep(animate(portrait, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }));
      keep(animate(shape.canvas, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: 40, easing: "ease-in" }));
      keep(sweepEdge(edge, HEAD.faceX + 420, HEAD.faceX - 520, 300));
      await sleep(100);
      return unmount; // ここから名前・二つ名・一言（animateIntro）
    },
    async exit() {
      // 終わりは逆再生せず、すっと会話へ戻す（2026-11-02 オーナー「終わり際が少し気持ち悪い」）。
      // 文字と帯が先に消え、ポスター調の本人と背景が溶けるように消えて、元の立ち絵と場面の色が戻る
      const dim = nodes[0]?.querySelector(".ci-tr-dim"), host = ctx.host;
      if (!dim) return;
      host.querySelectorAll(".ci-ribbon,.ci-accent-line,.ci-quote-area").forEach((n) =>
        keep(animate(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE.in })));
      // カットインの器（暗い地・ベール）ごと薄くする。部品だけ消すと、器の地が一瞬平らな暗い画面として残る
      const portrait = host.querySelector(".ci-portrait");
      if (portrait) keep(animate(portrait, [{ transform: "none" }, { transform: "translateY(10px) scale(.985)" }], { duration: 420, delay: 100, easing: EASE.in }));
      keep(animate(host, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 120, easing: "ease-in-out" }));
      // 縦長・横長の画面で余白を埋める面（intro-fit の surface）も同じく薄くする
      const surface = host.previousElementSibling?.classList.contains("intro-fit-surface") ? host.previousElementSibling : null;
      if (surface) keep(animate(surface, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: 120, easing: "ease-in-out" }));
      if (rect.img?.isConnected) keep(animate(rect.img, [{ opacity: 0 }, { opacity: 1 }], { duration: 340, delay: 240, easing: "ease-out" }));
      keep(animate(dim, [{ opacity: .7 }, { opacity: 0 }], { duration: 420, delay: 260, easing: "ease-out" }));
      await sleep(700);
      this.cancel();
    },
    cancel() {
      cancelAnimationFrame(raf);
      run.forEach((a) => a.cancel());
      nodes.forEach((n) => n.remove()); nodes.length = 0;
      dialogue?.classList.remove("intro-morph-dialog-hidden");
    },
  };
}

// ---------------------------------------------------------------- card: 札が切り取って、裏返る

function card(ctx) {
  if (!ctx.standing) return slash(ctx);
  const { rect, p } = ctx.standing;
  const nodes = [], run = [];
  const keep = (a) => { run.push(a); return a; };
  const head = headOf(rect, p);
  // 本人の上半身を囲む正方形の札。頭の高さの約3.4倍、顔の少し上から
  const side = Math.max(240, head.height * 3.4);
  const a = { left: head.x - side / 2, top: head.top - head.height * .55, size: side };
  const b = targetSquare(ctx.frame);
  const s = b.size / a.size;
  const move = `translate(${(b.left + b.size / 2) - (a.left + a.size / 2)}px, ${(b.top + b.size / 2) - (a.top + a.size / 2)}px)`;
  let unmount = null, wrap = null;
  const build = (over) => {
    wrap = el("div.ci-tr-persp"); over.append(wrap);
    const cardEl = el("div.ci-tr-card", { style: `left:${a.left}px;top:${a.top}px;width:${a.size}px;height:${a.size}px` });
    const front = el("div.face.front", {}, [el("img", {
      src: rect.src, alt: "", draggable: "false",
      style: `left:${rect.left - a.left}px;top:${rect.top - a.top}px;width:${rect.width}px;height:${rect.height}px`,
    })]);
    const back = el("div.face.back", {}, [el("img", { src: ctx.host.querySelector(".ci-portrait").src, alt: "", draggable: "false", style: "left:0;top:0;width:100%;height:100%" })]);
    cardEl.append(front, back);
    wrap.append(cardEl);
    return cardEl;
  };
  return {
    skip: new Set(["background", "portrait"]),
    async enter() {
      const under = layer(ctx, "under"), over = layer(ctx, "over");
      nodes.push(under, over);
      const dim = el("div.ci-tr-dim"); under.append(dim);
      const cardEl = build(over);
      // ① 札が本人を切り取る（周りが暗くなり、札の中だけ明るいまま）
      keep(animate(dim, [{ opacity: 0 }, { opacity: .6 }], { duration: 260 }));
      keep(animate(cardEl, [{ opacity: 0, transform: "scale(1.08)" }, { opacity: 1, transform: "none" }], { duration: 240 }));
      await sleep(220);
      // ② 札が手前へ飛びながら裏返る。裏面がポスター調の本人（220〜660ms）
      setTimeout(() => SE.whoosh(), 0);
      keep(animate(cardEl, [{ transform: "none" }, { transform: `${move} scale(${s.toFixed(4)}) rotateY(180deg)` }], { duration: 440, easing: EASE.inOut }));
      await sleep(300);
      // ③ 裏返りきる少し前に、カットインを札の下に置く。背景は奥から
      unmount = showCutin(ctx);
      ctx.host.classList.add("ci-staged");
      const bg = ctx.host.querySelector(".ci-art-background"), portrait = ctx.host.querySelector(".ci-portrait");
      portrait.style.opacity = "0";
      keep(animate(bg, [{ opacity: 0, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }], { duration: 640 }));
      await sleep(150);
      // ④ 札の裏面と同じ位置にある本物の人物へ切り替え、札の枠だけ消える
      portrait.style.opacity = "";
      keep(animate(cardEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 40 }));
      return unmount;
    },
    async exit() {
      const host = ctx.host, dim = nodes[0]?.querySelector(".ci-tr-dim"), cardEl = wrap?.querySelector(".ci-tr-card");
      if (!cardEl || !dim) return;
      const parts = host.querySelectorAll(".ci-ribbon,.ci-accent-line,.ci-quote-area,.ci-art-background");
      parts.forEach((n) => keep(animate(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE.in })));
      keep(animate(cardEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 }));
      await sleep(120);
      host.querySelector(".ci-portrait").style.opacity = "0";
      keep(animate(cardEl, [{ transform: `${move} scale(${s.toFixed(4)}) rotateY(180deg)` }, { transform: "none" }], { duration: 420, easing: EASE.inOut }));
      await sleep(420);
      keep(animate(cardEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }));
      keep(animate(dim, [{ opacity: .6 }, { opacity: 0 }], { duration: 260 }));
      await sleep(270);
      this.cancel();
    },
    cancel() { run.forEach((a) => a.cancel()); nodes.forEach((n) => n.remove()); nodes.length = 0; },
  };
}

// ---------------------------------------------------------------- slash: 一閃が通った跡がカットイン

function slash(ctx) {
  const nodes = [], run = [];
  const keep = (a) => { run.push(a); return a; };
  let unmount = null;
  const x0 = 1280 + SLASH_LEAN + 40, x1 = -40;
  return {
    skip: new Set(["background", "portrait"]),
    async enter() {
      const under = layer(ctx, "under"), over = layer(ctx, "over");
      nodes.push(under, over);
      const dim = el("div.ci-tr-dim"); under.append(dim);
      keep(animate(dim, [{ opacity: 0 }, { opacity: .5 }], { duration: 260 }));
      // ① 本人が一瞬テーマ色に光る（立ち絵がある時だけ）
      if (ctx.standing) {
        const sil = silhouette(ctx, ctx.standing.rect); over.append(sil);
        keep(animate(sil, [{ opacity: 0 }, { opacity: .95, offset: .35 }, { opacity: 0 }], { duration: 260, easing: "ease-out" }));
      }
      await sleep(120);
      // ② 一閃が右から左へ走り、通った跡にカットインが残る（120〜560ms）
      unmount = showCutin(ctx);
      ctx.host.classList.add("ci-staged");
      const edge = el("div.ci-tr-edge"); over.append(edge);
      SE.whoosh();
      keep(animate(ctx.host, [{ clipPath: slashClip(x0) }, { clipPath: slashClip(x1) }], { duration: 440, easing: EASE.inOut }));
      keep(sweepEdge(edge, x0, x1, 440));
      const bg = ctx.host.querySelector(".ci-art-background");
      keep(animate(bg, [{ transform: "scale(1.05)" }, { transform: "none" }], { duration: 900 }));
      await sleep(200);
      return unmount;
    },
    async exit() {
      const dim = nodes[0]?.querySelector(".ci-tr-dim"), over = nodes[1];
      if (!dim || !over) return;
      const edge = el("div.ci-tr-edge"); over.append(edge);
      keep(animate(ctx.host, [{ clipPath: slashClip(x1) }, { clipPath: slashClip(x0) }], { duration: 360, easing: EASE.inOut }));
      keep(sweepEdge(edge, x1, x0, 360));
      keep(animate(dim, [{ opacity: .5 }, { opacity: 0 }], { duration: 260, delay: 180 }));
      await sleep(440);
      this.cancel();
    },
    cancel() { run.forEach((a) => a.cancel()); nodes.forEach((n) => n.remove()); nodes.length = 0; },
  };
}
