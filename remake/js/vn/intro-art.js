// PR226の採用組版。文言・表情は正本から受け取り、配色と人物配置は目録から読む。
import { el } from "../core/util.js";

export function illustratedIntro(id, variant, intro, main, portrait, art, background) {
  const frame = art.frames[portrait.face] || art.frames[intro.face] || art.frames.normal;
  return el("div.cutin.art-intro", {
    dataset: { char: id, variant },
    style: `--accent:${art.color};--secondary:${art.secondary};--portrait-bg:${art.shadow};--ci:${art.color}`,
    role: "dialog", "aria-label": `${main}の紹介`,
  }, [
    el("img.ci-art-background", { src: background, alt: "", draggable: "false" }),
    el("div.ci-art-veil", { "aria-hidden": "true" }),
    el("div.ci-accent-line", { "aria-hidden": "true" }),
    el("div.ci-ribbon", [
      el("div.ci-art-meta", [
        el("div.ci-title", { text: intro.title || "" }),
        el("div.ci-name-line", [el("span.ci-name", { text: main })]),
      ]),
    ]),
    el("img.ci-portrait", {
      src: portrait.src, alt: "", draggable: "false",
      style: `width:${frame.width}px;left:${frame.left}px;top:${frame.top}px`,
    }),
    el("div.ci-quote-area", [
      el("div.ci-quote-rule", { "aria-hidden": "true" }),
      el("div.ci-line", { text: `「${intro.line || ""}」` }),
    ]),
  ]);
}

export function layoutIntro(host, id, variant, intro) {
  const name = host.querySelector(".ci-name");
  let size = 150;
  name.style.fontSize = `${size}px`;
  while (name.offsetWidth * .86 > 596 && size > 60) name.style.fontSize = `${--size}px`;
  const title = host.querySelector(".ci-title");
  size = 28;
  title.style.fontSize = `${size}px`;
  while (title.scrollWidth > 580 && size > 20) title.style.fontSize = `${--size}px`;
  const quote = host.querySelector(".ci-line"), text = intro.line || "";
  const preferred = {
    adam: text.indexOf("。") + 1, minto: text.indexOf(" ") + 1,
    sumi: text.indexOf("、") + 1, naru: text.indexOf("全部"),
    pakki: text.indexOf(" ") + 1, ageha_unknown: text.indexOf(" ") + 1,
  }[variant ? `${id}_${variant}` : id];
  if (quote.offsetHeight > parseFloat(getComputedStyle(quote).lineHeight) + 1 && preferred > 0) {
    quote.replaceChildren(
      el("span", { text: `「${text.slice(0, preferred)}` }),
      el("span", { text: `${text.slice(preferred)}」` }),
    );
  }
}

export function animateIntro(host, id) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return [];
  const animations = [];
  const animate = (selector, frames, options) => animations.push(host.querySelector(selector).animate(frames, {
    duration: 600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both", ...options,
  }));
  animate(".ci-art-background", [{ opacity: 0, transform: "scale(1.035)" }, { opacity: 1, transform: "none" }], { duration: 700 });
  animate(".ci-ribbon", [{ transform: "translateX(1480px) rotate(4deg)" }, { transform: "rotate(4deg)" }], { duration: id === "adam" ? 340 : 480, delay: 130 });
  animate(".ci-accent-line", [{ transform: "translateX(-1480px) rotate(4deg)" }, { transform: "rotate(4deg)" }], { duration: 510, delay: 180 });
  const frames = ["kafuka", "pakki"].includes(id)
    ? [{ opacity: 0, transform: "translate(-100px,20px)" }, { opacity: 1, transform: "translate(5px,-4px)", offset: .8 }, { opacity: 1, transform: "none" }]
    : [{ opacity: 0, transform: "translateX(-130px)" }, { opacity: 1, transform: "none" }];
  animate(".ci-portrait", frames, { duration: id === "adam" ? 430 : 620, delay: 160 });
  for (const [selector, delay] of [[".ci-title", 470], [".ci-name-line", 510], [".ci-quote-area", 810]]) {
    animate(selector, [{ opacity: 0, transform: "translateX(30px)" }, { opacity: 1, transform: "none" }], { duration: 440, delay });
  }
  return animations;
}
