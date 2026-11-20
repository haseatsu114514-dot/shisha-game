// tonari フロア営業の記号と客の影絵。コードで描く仮の絵で、Codex の絵が届いたら tonari-floor-stage.js の FLOOR_ART に
// 登録して差し替える（依頼の内容と置き場は asset_sources/ui/tonari-floor-20261120/README.md）。
import { el } from "../core/util.js";
import { buildVersioned } from "../core/asset-version.js";
import { FLOOR_ART, artUrl, personIds } from "./tonari-floor-stage.js";

// 24×24・線の太さ1.8。色は currentColor。塗りつぶす記号は fill:true。
const GLYPHS = {
  seat: '<path d="M13 4h6v16h-6"/><path d="M4 12h10m-3-3 3 3-3 3"/>',
  order: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  cook: '<path d="M5 11h14a7 7 0 0 1-14 0z"/><path d="M9 21h6M12 18v3"/><path d="M15 3l-3 8"/>',
  serve: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 8V6"/><circle cx="12" cy="5" r="1"/>',
  thin: '<path d="M9 21c-2-3 2-4 0-7s2-4 0-7"/><path d="M16 8v9m-3-3 3 3 3-3"/>',
  harsh: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 1.5-1.5 1.5-5 1-8.5z"/>',
  glass: '<path d="M7 4h10l-1.2 15a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M7.6 9h8.8"/><path d="m10 13 3-1 1 3-3 1z"/>',
  ask: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M10 9.2a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.5"/><path d="M12 14.4v.1"/>',
  focus: '<path d="M3 6c3-1 6-1 9 1 3-2 6-2 9-1v12c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 7v12"/>',
  top: '<path d="M5 12a7 7 0 0 1 12-5l2 2"/><path d="M19 5v4h-4"/><path d="M19 12a7 7 0 0 1-12 5l-2-2"/><path d="M5 19v-4h4"/>',
  consult: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/>',
  bill: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><path d="M9 8h6M9 12h6"/>',
  clean: '<path d="M9 4l1.5 4.5L15 10l-4.5 1.5L9 16l-1.5-4.5L3 10l4.5-1.5z"/><path d="M17 14l.8 2.2L20 17l-2.2.8L17 20l-.8-2.2L14 17l2.2-.8z"/>',
  alert: '<path d="M12 5v9"/><path d="M12 18v.1"/>',
  add: '<path d="M4 11l5-3 5 3v6l-5 3-5-3z"/><path d="M4 11l5 3 5-3M9 14v6"/><path d="M19 3v6m-3-3h6"/>',
  ease: '<path d="M4 11l5-3 5 3v6l-5 3-5-3z"/><path d="M4 11l5 3 5-3M9 14v6"/><path d="M16 6h6"/>',
  drink: '<path d="M7 4h10l-1.2 15a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M7.6 9h8.8"/>',
  talk: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  leave: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  lamp: '<path d="M12 2v3"/><path d="M8.5 5h7l2.5 8a6 6 0 0 1-12 0z"/><path d="M10 21h4M12 19v2"/>',
  coin: '<ellipse cx="12" cy="7" rx="6" ry="2.5"/><path d="M6 7v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M6 12v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  pause: '<path d="M9 6v12m6-12v12"/>',
  door: '<path d="M6 21V4h10v17"/><path d="M4 21h16"/><path d="M13 12v.1"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" fill="currentColor"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 13.5c1 2 6 2 7 0"/><path d="M9 9.5v.1M15 9.5v.1"/>',
  flat: '<circle cx="12" cy="12" r="8.5"/><path d="M9 14.5h6"/><path d="M9 9.5v.1M15 9.5v.1"/>',
  frown: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 15.5c1-2 6-2 7 0"/><path d="M9 9.5v.1M15 9.5v.1"/>',
  // 判定の印（◎ ○ △ ×）。接客ビューの大きな印と、卓の手応えに使う
  // 満足の顔（5段）。◎ ○ △ ▽ ◇ の形の中に顔を描く（2026-11-20 オーナー「◎○△の中に顔を描いたりとか」）。形だけでも段が分かる
  moodMax: '<circle cx="12" cy="12" r="10.200"/><circle cx="12" cy="12" r="7.600"/><path d="M8.600 11q1-1.500 2 0M13.400 11q1-1.500 2 0"/><path d="M9.300 13.300q2.700 3.200 5.400 0z"/>',
  moodGood: '<circle cx="12" cy="12" r="9.600"/><path d="M9 10.400v.100M15 10.400v.100"/><path d="M8.600 13.600q3.400 3.200 6.800 0"/>',
  moodOk: '<path d="M12 3.200 21.600 20.200H2.400z"/><path d="M9.800 13.400v.100M14.200 13.400v.100"/><path d="M9.800 16.800h4.400"/>',
  moodLow: '<path d="M2.400 3.800h19.200L12 20.800z"/><path d="M9 8.400v.100M15 8.400v.100"/><path d="M9.600 13.200q2.400-1.800 4.800 0"/>',
  moodMad: '<path d="M12 1.800 22.200 12 12 22.200 1.800 12z"/><path d="M8.400 9.600l2.400 1.200M15.600 9.600l-2.400 1.200"/><path d="M9.600 12.600v.100M14.400 12.600v.100"/><path d="M9 16l1.500-1 1.500 1 1.500-1 1.500 1"/>',
  markBest: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.8"/>',
  markGood: '<circle cx="12" cy="12" r="8.5"/>',
  markMiss: '<path d="M12 4 21 19.5H3z"/>',
  markBad: '<path d="M5.5 5.5l13 13M18.500 5.500l-13 13"/>',
};

export function glyph(name, className = "") {
  return el(`span.tf-icon${className ? "." + className : ""}`, {
    "aria-hidden": true,
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] || GLYPHS.alert}</svg>`,
  });
}

const SKIN = ["#edd0b0", "#e3bf9c", "#f1d9bf", "#d9b08c"];
const HAIR = ["#3a2a22", "#54382a", "#2c2a33", "#6d4b32", "#22201f"];
const WEAR = ["#b5805a", "#6f8794", "#8b8c5c", "#a5685f", "#5f7d6c", "#8f86a3", "#c79a4f", "#7b6a8c"];
// 髪型ごとの形。頭は (32,25) 半径 12。背中側の髪 back → 頭 → 前の髪 front の順に重ねる。
const LOOKS = {
  short: { front: '<path d="M19.6 24c-1-9 5-13 12.4-13s13.4 4 12.4 13c-2.5-3.5-5-5-9-5.5-4.5 1-9.8 1-15.8 5.500z"/>' },
  bob: { back: '<path d="M18 23c0-9 6-13.5 14-13.500S46 14 46 23v12c0 2-2 3-4 3H22c-2 0-4-1-4-3z"/>',
    front: '<path d="M19.5 24c0-8 5.5-12.5 12.5-12.500S44.5 16 44.5 24c-5-1-9-3.5-11.5-7-2.5 3.5-7 6-13.5 7z"/>' },
  long: { back: '<path d="M17.5 23c0-9 6.5-13.5 14.5-13.500S46.5 14 46.5 23v20c0 2-2 3-4 3h-21c-2 0-4-1-4-3z"/>',
    front: '<path d="M19.5 24c0-8 5.5-12.5 12.5-12.500S44.5 16 44.5 24c-6-.5-11-3-13.5-7.500C29 20.5 25 23 19.5 24z"/>' },
  pony: { back: '<path d="M43 15c6-1 10 3 9 9s-2 12-6 14c1-5 0-9-3-12z"/>',
    front: '<path d="M19.6 24c-1-9 5-13 12.4-13s13.4 4 12.4 13c-3-2.5-6-4-10-4.5-4 1-9 1.5-14.8 4.500z"/>' },
  bun: { back: '<circle cx="32" cy="9.5" r="6"/>',
    front: '<path d="M19.6 24c-1-8 5-12.5 12.4-12.500s13.4 4.5 12.4 12.500c-3-3-7-5-12.4-5s-9.4 2-12.4 5z"/>' },
  curly: { back: '<circle cx="21" cy="19" r="6"/><circle cx="43" cy="19" r="6"/><circle cx="26" cy="13" r="6"/><circle cx="38" cy="13" r="6"/><circle cx="32" cy="11" r="6"/><circle cx="19.5" cy="26" r="4.5"/><circle cx="44.5" cy="26" r="4.5"/>',
    front: '<path d="M21 22c2-5 6-7 11-7s9 2 11 7c-4-2-7-3-11-3s-7 1-11 3z"/>' },
  cap: { front: '<path d="M19.5 22c0-8 5.5-12 12.5-12s12.5 4 12.5 12z"/>', extra: '<path d="M19 22h31c1 0 1.5 1 1 2-1 1-3 1.5-6 1.500H19z" fill="var(--tf-wear-dark)"/>', capped: true },
  hat: { front: '<path d="M21.5 20c0-7 4.5-10.5 10.5-10.500S42.5 13 42.5 20z"/>', extra: '<path d="M11 21.500c0-1.5 2-2 4-2h34c2 0 4 .5 4 2s-2 2.5-4 2.500H15c-2 0-4-1-4-2.500z" fill="var(--tf-wear-dark)"/>', capped: true },
  glasses: { front: '<path d="M19.6 24c-1-9 5-13 12.4-13s13.4 4 12.4 13c-2-4-5-6-8.4-6.5-4.5.500-10.4 1-16.4 6.500z"/>',
    extra: '<path d="M22.5 25.500h8v5h-8zM33.5 25.500h8v5h-8zM30.5 27h3" fill="none" stroke="#3b2c25" stroke-width="1.4"/>' },
};

const hash = (text) => { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

/**
 * 客ひとりの影絵（顔は描かない）。key で髪・服の色を決める。
 * @param seatedBody 座った全身（胸像の下に胴と膝を足す。専用の店内画で、絵が届くまでの仮の姿）
 */
export function bust(look, key = "", seatedBody = false) {
  const h = hash(`${key}/${look}`);
  const shape = LOOKS[look] || LOOKS.short;
  const hair = look === "hat" ? "#8d8a86" : HAIR[h % HAIR.length];
  const wear = WEAR[(h >>> 4) % WEAR.length];
  const skin = SKIN[(h >>> 9) % SKIN.length];
  const tint = shape.capped ? wear : hair;
  const dark = `color-mix(in srgb, ${wear} 70%, #2a1d16)`;
  return el("span.tf-bust", {
    "aria-hidden": true, style: { "--tf-wear-dark": dark },
    html: `<svg viewBox="0 0 64 ${seatedBody ? 112 : 64}">
      <g fill="${tint}">${shape.back || ""}</g>
      ${seatedBody ? `<path d="M9 62h46l3 26H6z" fill="${wear}"/><path d="M6 86h52l2 18q0 6-6 6H10q-6 0-6-6z" fill="${dark}"/>` : ""}
      <path d="M6 64c0-12 8-19 26-19s26 7 26 19z" fill="${wear}"/>
      <path d="M26 45c2 4 10 4 12 0l-1.5-6h-9z" fill="${skin}"/>
      <path d="M22 50c3 4 17 4 20 0" fill="none" stroke="#00000022" stroke-width="2"/>
      <circle cx="32" cy="25" r="12" fill="${skin}"/>
      <g fill="${tint}">${shape.front || ""}</g>
      ${shape.extra || ""}
    </svg>`,
  });
}

/**
 * 卓の客（1〜2人）。ひとりずつ、絵の登録があれば絵、無ければ影絵。
 * @param opts.happy 満足している時の絵（登録があれば）を使う
 * @param opts.seated 座った全身で出す（専用の店内画）。省くと顔のまわり（丸い札・入口の列・伝票）
 * @param opts.art 絵の登録（検査用に差し替えられる。既定は FLOOR_ART.guests）
 */
export function guestArt(guest, { happy = false, seated = false, art = FLOOR_ART.guests } = {}) {
  const people = personIds(guest).map((id, i) => {
    const entry = art?.[id];
    const src = typeof entry === "string" ? entry : (happy && entry?.happy) || entry?.idle;
    if (!src) return el("span.tf-person", { dataset: { i } }, [bust(guest.look[i] || guest.look[0], `${guest.id}${i}`, seated)]);
    const url = artUrl(src);
    return el("span.tf-person", { dataset: { i, painted: "true" } },
      [el("img", { src: /^(data:|blob:)/.test(url) ? url : buildVersioned(url), alt: "", decoding: "async", draggable: false })]);
  });
  return el("span.tf-guest-art", { "aria-hidden": true, dataset: { party: guest.party } }, people);
}
