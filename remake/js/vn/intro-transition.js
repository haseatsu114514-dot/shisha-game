// 会話の立ち絵から、グラフィック絵柄の登場カットインへ「変身」するつなぎ（2026-11-02 試作）。
// オーナー「急にあの立ち絵からこれになるにはトランジションで自然な転移が要る」（CIG07）→
// 「もっと滑らかでスタイリッシュで自然なアニメーションにしたい」。3案を同じ仕組みで切り替えて比べる。
//
//   none  : 今まで通り（既定）。つなぎ無しでカットインが出る
//   morph : 立ち絵がテーマ色の影になり、影がカメラへ迫りながらカットインの人物の位置へ移り、
//           斜めの閃きで影の中からポスター調の本人が現れる。影はそのまま人物の落ち影になる
//   card  : 立ち絵の上半身を四角い札が切り取り、札が手前へ飛びながら裏返る。裏面がポスター調の本人
//   slash : 本人が一瞬テーマ色に光り、斜めの一閃が画面を右から左へ走って、通った跡がカットインになる
//
// 全部、動きは transform / opacity / clip-path だけ（コンポジタで動く）。時間は MOTIONS の hold に足し、
// 読む時間は削らない。「動きを減らす」では短いフェードだけにする。設定は config.introTransition。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";

export const TRANSITIONS = ["none", "morph", "card", "slash"];
/** tools/intro_graphic_frames.py と同じ、画面上の頭の位置（グラフィック絵柄の人物） */
const HEAD = { top: 16, height: 280, faceX: 268 };
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
  return { top: bodyTop, height: headH, x: rect.left + p.ax * rect.width };
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
  const box = stageBox(ctx.fx);
  const node = el(`div.ci-transition.${kind}`, {
    "aria-hidden": "true",
    style: `--k:${box.k};--tr-color:${ctx.colors.color};--tr-secondary:${ctx.colors.secondary};--tr-shadow:${ctx.colors.shadow}`,
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
function headTransform(rect, p) {
  const head = headOf(rect, p);
  const s = HEAD.height / head.height;
  return {
    origin: `${head.x - rect.left}px ${head.top - rect.top}px`,
    to: `translate(${HEAD.faceX - head.x}px, ${HEAD.top - head.top}px) scale(${s.toFixed(4)})`,
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

// ---------------------------------------------------------------- morph: 影になって迫り、閃きの中から現れる

function morph(ctx) {
  if (!ctx.standing) return slash(ctx); // 立ち絵が無ければ一閃だけ
  const { rect, p } = ctx.standing;
  const nodes = [];
  let unmount = null;
  const run = [];
  const keep = (a) => { run.push(a); return a; };
  return {
    skip: new Set(["background", "portrait"]),
    async enter() {
      const under = layer(ctx, "under"), over = layer(ctx, "over");
      nodes.push(under, over);
      const dim = el("div.ci-tr-dim.desat"); under.append(dim);
      const sil = silhouette(ctx, rect); over.append(sil);
      const ink = sil.firstElementChild;
      const edge = el("div.ci-tr-edge"); over.append(edge);
      const t = headTransform(rect, p);
      sil.style.transformOrigin = t.origin;

      // ① 世界の色が抜け、本人の足元から色が満ちて影になる。満ちきった所で本人の絵は影の下に消える（0〜320ms）
      keep(animate(dim, [{ opacity: 0 }, { opacity: .7 }], { duration: 380 }));
      keep(animate(ink, [{ transform: "translateY(101%)" }, { transform: "translateY(0)" }], { duration: 320, easing: EASE.inOut }));
      if (rect.img?.isConnected) keep(animate(rect.img, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 260 }));
      // ② 影がカメラへ迫りながら、カットインの人物の位置へ（260〜660ms）
      keep(animate(sil, [{ transform: "none" }, { transform: t.to }], { duration: 400, delay: 260, easing: EASE.inOut }));
      setTimeout(() => SE.whoosh(), 260);
      await sleep(560);

      // ③ カットインを影の下に置く。背景は奥から寄ってくる
      unmount = ctx.mount();
      ctx.host.classList.add("ci-staged");
      const bg = ctx.host.querySelector(".ci-art-background"), portrait = ctx.host.querySelector(".ci-portrait");
      keep(animate(bg, [{ opacity: 0, transform: "scale(1.06)" }, { opacity: 1, transform: "none" }], { duration: 720 }));
      // ④ 斜めの一閃が影を横切り、通った所からポスター調の本人が見える。影は薄れて消える（620〜900ms）
      const x0 = HEAD.faceX + 520, x1 = HEAD.faceX - 560;
      keep(animate(portrait, [{ clipPath: slashClip(x0) }, { clipPath: slashClip(x1) }], { duration: 260, delay: 70, easing: EASE.inOut }));
      keep(sweepEdge(edge, x0, x1, 300, 50));
      keep(animate(sil, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 110, easing: "ease-in" }));
      await sleep(90);
      return unmount; // ここから名前・二つ名・一言（animateIntro）
    },
    async exit() {
      const sil = nodes[1]?.querySelector(".ci-tr-sil"), dim = nodes[0]?.querySelector(".ci-tr-dim");
      const host = ctx.host;
      if (!sil || !dim) return;
      const ink = sil.firstElementChild;
      const parts = host.querySelectorAll(".ci-ribbon,.ci-accent-line,.ci-quote-area,.ci-art-background");
      // 文字と帯が消え、本人が影に戻り、影が元の立ち絵の場所へ戻って色が抜ける
      parts.forEach((n) => keep(animate(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE.in })));
      keep(animate(sil, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
      keep(animate(host.querySelector(".ci-portrait"), [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 40 }));
      await sleep(180);
      keep(animate(sil, [{ transform: headTransform(rect, p).to }, { transform: "none" }], { duration: 340, easing: EASE.inOut }));
      await sleep(300);
      // 影から色が抜け落ちて、元の立ち絵に戻る
      if (rect.img?.isConnected) keep(animate(rect.img, [{ opacity: 0 }, { opacity: 1 }], { duration: 60 }));
      keep(animate(ink, [{ transform: "translateY(0)" }, { transform: "translateY(101%)" }], { duration: 240, easing: EASE.in }));
      keep(animate(dim, [{ opacity: .7 }, { opacity: 0 }], { duration: 320 }));
      await sleep(340);
      this.cancel();
    },
    cancel() { run.forEach((a) => a.cancel()); nodes.forEach((n) => n.remove()); nodes.length = 0; },
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
      unmount = ctx.mount();
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
      unmount = ctx.mount();
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
