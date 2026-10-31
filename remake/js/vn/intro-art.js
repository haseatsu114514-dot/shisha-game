// PR226の採用組版。文言・表情は正本から受け取り、配色と人物配置は目録から読む。
import { el } from "../core/util.js";
import { introFlavor } from "./intro-flavors.js";
import { DB } from "../core/data.js";

export function flavorTag(flavor) {
  if (!flavor) return null;
  return el("div.ci-flavor", { "aria-label": `好きなフレーバー ${flavor.main}${flavor.small || ""}` }, [
    el("span.ci-flavor-label", { text: "好きなフレーバー" }),
    el("span.ci-flavor-name", [
      el("span", { text: flavor.main }),
      ...(flavor.small ? [el("span.ci-flavor-small", { text: flavor.small })] : []),
    ]),
  ]);
}

/** 苗字と名前の区切り。正本の名前（例「久世 朔（くぜ さく）」）に、表示名を空白で分けた形があれば [苗字, 名前] */
export function nameParts(id, main) {
  const full = String(DB.characters?.[id]?.name || "");
  for (const m of full.matchAll(/([^\s/（）()・]+)[ 　]([^\s/（）()・]+)/g)) {
    if (m[1] + m[2] === main) return [m[1], m[2]];
  }
  return null;
}

/** 一言の改行位置の指定「／」を除いた本文 */
export const plainLine = (text = "") => String(text).replace(/([！？♪])／/g, "$1 ").replaceAll("／", "");

/** グラフィック絵柄で名前の欄を右へ寄せる量（px）。intro.css の [data-art="graphic"] と合わせる */
export const GRAPHIC_META_SHIFT = 56;

/** 動きの型（データの motion）。未指定は従来の滑り込み */
export const MOTIONS = {
  sharp: { hold: 3600, out: 240 },  // 刃: ライバル。帯が突入し、名前を判のように押す
  soft: { hold: 4000, out: 400 },   // 余韻: 静かな人・私生活。滑らず浮かぶ
  still: { hold: 4200, out: 420 },  // 静: 審査員・王者・機械。動かずに切り替わる
  bounce: { hold: 3600, out: 280 }, // 跳: マスコット・賑やか。弾んで入る
};
export const motionOf = (intro) => (Object.hasOwn(MOTIONS, intro?.motion) ? intro.motion : "sharp");

export function illustratedIntro(id, variant, intro, main, portrait, art, background) {
  const frame = art.frames[portrait.face] || art.frames[intro.face] || art.frames.normal;
  const flavor = introFlavor(id, variant);
  return el("div.cutin.art-intro", {
    dataset: { char: id, variant, motion: motionOf(intro) },
    style: `--accent:${art.color};--secondary:${art.secondary};--portrait-bg:${art.shadow};--ci:${art.color}`,
    role: "dialog", "aria-label": `${main}の紹介`,
  }, [
    el("img.ci-art-background", { src: background, alt: "", draggable: "false" }),
    el("div.ci-art-veil", { "aria-hidden": "true" }),
    ...(id === "hiyori" ? [el("div.ci-ember-glow", { "aria-hidden": "true" })] : []),
    el("div.ci-accent-line", { "aria-hidden": "true" }),
    el("div.ci-ribbon", [
      el("div.ci-art-meta", [
        el("div.ci-title", { text: intro.title || "" }),
        el("div.ci-name-line", [nameParts(id, main)
          ? el("span.ci-name", { "aria-label": main }, nameParts(id, main).flatMap((part, i) => [...(i ? [el("span.ci-name-gap", { "aria-hidden": "true" })] : []), el("span", { text: part })]))
          : el("span.ci-name", { text: main })]),
      ]),
    ]),
    el("img.ci-portrait", {
      src: portrait.src, alt: "", draggable: "false",
      style: `width:${frame.width}px;left:${frame.left}px;top:${frame.top}px`,
    }),
    // 読む順番: 名前→二つ名→一言→好きなフレーバー（2026-10-31）
    el(`div.ci-quote-area${flavor ? ".has-flavor" : ""}`, [
      el("div.ci-quote-rule", { "aria-hidden": "true" }),
      el("div.ci-line", { text: `「${plainLine(intro.line)}」` }),
      flavorTag(flavor),
    ].filter(Boolean)),
    el("div.ci-flash", { "aria-hidden": "true" }),
  ]);
}

function fitWidth(node, max, high, low, limit) {
  node.style.fontSize = `${high}px`;
  if (node.scrollWidth <= limit && node.offsetWidth * max <= limit) return high;
  let lo = low, hi = high - 1;
  while (lo < hi) {
    const size = Math.ceil((lo + hi) / 2);
    node.style.fontSize = `${size}px`;
    if (node.offsetWidth * max > limit || node.scrollWidth > limit) hi = size - 1;
    else lo = size;
  }
  node.style.fontSize = `${lo}px`;
  return lo;
}

/** 一言は1行に収まれば42px（無理なら38px）、収まらなければ「／」で2行・36px。2行なら true */
export function layoutIntro(host, id, variant, intro) {
  // グラフィック絵柄は人物が大きいので、名前の欄を右へ寄せたぶん幅を詰める（intro.css と同じ値）
  const shift = host.dataset.art === "graphic" ? GRAPHIC_META_SHIFT : 0;
  const name = host.querySelector(".ci-name");
  fitWidth(name, .86, 150, 60, 596 - shift);
  const title = host.querySelector(".ci-title");
  title.style.fontSize = "28px";
  if (title.scrollWidth > 580 - shift) fitWidth(title, 1, 27, 20, 580 - shift);
  const quote = host.querySelector(".ci-line"), raw = intro.line || "", text = plainLine(raw);
  const oneLine = () => quote.offsetHeight <= parseFloat(getComputedStyle(quote).lineHeight) + 1;
  for (const size of [42, 38]) {
    quote.style.fontSize = `${size}px`;
    if (oneLine()) return false;
  }
  quote.style.fontSize = "36px";
  const cut = raw.indexOf("／");
  if (cut > 0) {
    quote.replaceChildren(
      el("span", { text: `「${plainLine(raw.slice(0, cut))}` }),
      el("span", { text: `${plainLine(raw.slice(cut + 1))}」` }),
    );
  } else quote.textContent = `「${text}」`;
  return true;
}

/** 型ごとの登場。戻り値は止めるための Animation の配列 */
export function animateIntro(host, id, motion = "sharp", { sound = () => {} } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { sound("reduced"); return []; }
  const animations = [];
  const animate = (selector, frames, options) => {
    const node = host.querySelector(selector);
    if (node) animations.push(node.animate(frames, { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both", ...options }));
  };
  const at = (ms, fn) => { const t = setTimeout(fn, ms); animations.push({ cancel: () => clearTimeout(t) }); };
  const textIn = (from, delays, duration, easing) => [".ci-title", ".ci-line", ".ci-flavor"].forEach((selector, i) =>
    animate(selector, from === "none" ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }],
      { duration, delay: delays[i], ...(easing ? { easing } : {}) }));
  animate(".ci-quote-rule", [{ opacity: 0, transform: "scaleX(0)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: motion === "still" ? 900 : 650 });
  if (host.querySelector(".ci-ember-glow")) {
    animate(".ci-ember-glow", [{ opacity: .15 }, { opacity: .65 }, { opacity: .2 }], { duration: 2300, iterations: Infinity, easing: "ease-in-out" });
  }
  if (motion === "soft") {
    animate(".ci-art-background", [{ opacity: 0, transform: "scale(1.008)" }, { opacity: 1, transform: "none" }], { duration: 1400 });
    for (const selector of [".ci-ribbon", ".ci-accent-line"]) {
      animate(selector, [{ opacity: 0, transform: "rotate(4deg)" }, { opacity: 1, transform: "rotate(4deg)" }], { duration: 900, delay: 150 });
    }
    animate(".ci-portrait", [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 1200, delay: 120 });
    animate(".ci-name-line", [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 500 });
    textIn("translateY(8px)", [500, 800, 1000], 700);
    return animations;
  }
  if (motion === "still") {
    animate(".ci-art-background", [{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: "ease-out" });
    for (const [selector, delay] of [[".ci-ribbon", 200], [".ci-accent-line", 260]]) {
      // 上下は広げておく: 帯の上にはみ出した二つ名を切り取らない
      animate(selector, [{ clipPath: "inset(-120px 100% -120px 0)" }, { clipPath: "inset(-120px 0 -120px 0)" }], { duration: 500, delay, easing: "cubic-bezier(.7,0,.3,1)" });
    }
    animate(".ci-portrait", [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 200, easing: "ease-out" });
    animate(".ci-name-line", [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: 600 });
    at(600, () => sound("name"));
    textIn("none", [700, 900, 1100], 500, "ease-out");
    return animations;
  }
  if (motion === "bounce") {
    animate(".ci-art-background", [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    animate(".ci-ribbon", [{ transform: "translateX(1480px) rotate(4deg)" }, { transform: "translateX(-40px) rotate(4deg)", offset: .55 },
      { transform: "translateX(14px) rotate(4deg)", offset: .8 }, { transform: "rotate(4deg)" }], { duration: 600, delay: 130, easing: "ease-out" });
    animate(".ci-accent-line", [{ transform: "translateX(-1480px) rotate(4deg)" }, { transform: "rotate(4deg)" }], { duration: 500, delay: 200 });
    animate(".ci-portrait", [{ opacity: 0, transform: "translate(-100px,40px) scale(1.06,.9)" }, { opacity: 1, transform: "translate(5px,-6px) scale(.98,1.03)", offset: .7 },
      { opacity: 1, transform: "none" }], { duration: 620, delay: 160 });
    animate(".ci-name-line", [{ opacity: 0, transform: "rotate(-2deg) scale(1.2)" }, { opacity: 1, transform: "rotate(1deg)", offset: .7 },
      { opacity: 1, transform: "none" }], { duration: 360, delay: 420 });
    at(420, () => sound("name"));
    [".ci-title", ".ci-line", ".ci-flavor"].forEach((selector, i) => animate(selector, [{ opacity: 0, transform: "translateY(26px)" },
      { opacity: 1, transform: "translateY(-6px)", offset: .7 }, { opacity: 1, transform: "none" }], { duration: 440, delay: [480, 700, 900][i] }));
    return animations;
  }
  // sharp: 帯が6px行き過ぎて戻る。着地で白い閃光と小さな揺れ、名前を判のように押す
  const fast = id === "adam";
  animate(".ci-art-background", [{ opacity: 0, transform: "scale(1.035)" }, { opacity: 1, transform: "none" }], { duration: 300 });
  animate(".ci-ribbon", [{ transform: "translateX(1480px) rotate(4deg)" }, { transform: "translateX(-6px) rotate(4deg)", offset: .85 },
    { transform: "rotate(4deg)" }], { duration: fast ? 260 : 300, delay: 130 });
  animate(".ci-accent-line", [{ transform: "translateX(-1480px) rotate(4deg)" }, { transform: "rotate(4deg)" }], { duration: 420, delay: 180 });
  animate(".ci-flash", [{ opacity: 0 }, { opacity: .5, offset: .3 }, { opacity: 0 }], { duration: 120, delay: 400, easing: "linear" });
  for (const selector of [".ci-art-background", ".ci-ribbon"]) {
    animate(selector, [{ translate: "0 0" }, { translate: "3px -2px", offset: .3 }, { translate: "-2px 1px", offset: .6 }, { translate: "0 0" }],
      { duration: 160, delay: 400, fill: "none" });
  }
  animate(".ci-portrait", [{ opacity: 0, transform: "translateX(-130px)" }, { opacity: 1, transform: "none" }], { duration: fast ? 430 : 540, delay: 160 });
  animate(".ci-name-line", [{ opacity: 0, transform: "scale(1.15)" }, { opacity: 1, transform: "none" }],
    { duration: 160, delay: 380, easing: "cubic-bezier(.1,.9,.2,1)" });
  at(380, () => sound("name"));
  textIn("translateX(30px)", [480, 700, 900], 440);
  return animations;
}

/** 型ごとの退場。終わるまでの時間（ms）を返す */
export function exitIntro(host, motion = "sharp") {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const { out } = MOTIONS[motion] || MOTIONS.sharp;
  const fade = (node, duration, delay = 0) => node?.animate([{ opacity: 1 }, { opacity: 0 }], { duration, delay, fill: "forwards" });
  if (motion === "sharp") {
    host.querySelector(".ci-ribbon")?.animate([{ transform: "rotate(4deg)" }, { transform: "translateX(1480px) rotate(4deg)" }],
      { duration: 220, easing: "cubic-bezier(.6,0,.9,.4)", fill: "forwards" });
    fade(host, out - 40, 40);
  } else if (motion === "still") {
    const flash = host.querySelector(".ci-flash");
    if (flash) { flash.style.background = "#000"; flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "steps(1,end)", fill: "forwards" }); }
    fade(host, out - 120, 120);
  } else fade(host, out);
  return out;
}
