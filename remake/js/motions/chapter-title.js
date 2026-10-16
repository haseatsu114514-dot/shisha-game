// 章タイトルの動き。どの章も、採用した一枚絵とまったく同じ構図で止まる（最後に元の絵へ差し替える）。
// 第一章: 題字と6人を透過レイヤーに分けた（assets/ui/chapters/ch1_layers）。はじめが一人で歩き、
//   後ろから仲間が一人ずつ歩いて加わって列になる。題字は行ごと・大見出しは1文字ずつ浮かぶ。
// 第二・四・五章: 一枚絵は切らない。ぼけた下地から右（人物）→左（題字）へピントが送られ、
//   ゆっくりした寄りが収まり、最後に題字の形にだけ光が一筋走る。
// 第三章など絵の無い章: 文字の行を順に浮かべる（CSSのみ）。
import { el, sleep } from "../core/util.js";
import { reducedMotion } from "../core/transition-kit.js";

const img = (file) => new URL(`../../img/ui/chapters/${file}.webp`, import.meta.url).href;

// 区間ごとの緩急（長い移動に強い曲線を掛けない）
const DECEL = "cubic-bezier(.25,.46,.45,.94)"; // 歩いて来て、所定の位置で歩みをゆるめる
const SOFT = "cubic-bezier(.22,.61,.36,1)";
const SINE = "cubic-bezier(.37,0,.63,1)";
const RISE = "cubic-bezier(.3,0,.5,1)";
const FALL = "cubic-bezier(.5,0,.7,1)";

// ---------------------------------------------------------------- 第一章（レイヤー）

// 位置は ch1-title.webp の座標そのまま（assets/ui/chapters/ch1_layers/layers.json）
const CH1_TITLE = [
  { id: "title-logo", x: 537, y: 24, at: 800 },
  { id: "title-rule", x: 566, y: 52, at: 1000, rule: true },
  { id: "title-chapter", x: 568, y: 86, at: 1200 },
  { id: "title-subtitle", x: 561, y: 230, at: 2900 },
];
const CH1_GLYPHS = [[403, 129], [500, 142], [565, 159], [650, 140], [730, 151], [794, 128]];
const GLYPH_AT = 1700, GLYPH_GAP = 110;
// 煙（白い霧）から歩み出る幅。人物は自分の幅＋この分だけ左から歩いて来る
const MIST = 150;
// 加わる順。右端のはじめが先に歩き、その左隣へ順に並ぶ（歩く途中で誰とも重ならない）
const CH1_PEOPLE = [
  { id: "hajime", x: 1061, y: 287, w: 188, sx: 1067, at: 300 },
  { id: "sumi", x: 845, y: 262, w: 206, sx: 850, at: 1050 },
  { id: "tsumugi", x: 663, y: 330, w: 166, sx: 666, at: 1420 },
  { id: "adam", x: 440, y: 285, w: 209, sx: 446, at: 1790 },
  { id: "naru", x: 216, y: 279, w: 214, sx: 221, at: 2160 },
  { id: "minto", x: 43, y: 319, w: 154, sx: 43, at: 2530 },
].map((p) => ({ ...p, from: p.w + MIST, ms: 1300 }));
const CH1_SHADOW_Y = 618;
const CH1_TOTAL = 5800; // 退場の前まで（全員がそろった絵を約2秒見せる）
const ch1Urls = () => [
  ...CH1_TITLE.map((t) => img(`ch1/${t.id}`)),
  ...CH1_GLYPHS.map((_, i) => img(`ch1/title-name${i}`)),
  ...CH1_PEOPLE.flatMap((p) => [img(`ch1/${p.id}`), img(`ch1/${p.id}-shadow`)]),
];

const layerImg = (cls, id, x, y) => el(`img.${cls}`, { src: img(`ch1/${id}`), alt: "", draggable: "false", style: { left: `${x}px`, top: `${y}px` } });

/** 歩幅の上下。横移動の減速（ease-out quad）に合わせて、一歩の間隔も終わりへ向けて伸ばす */
function bobFrames(steps, lift, form = (y) => `translateY(${y.toFixed(2)}px)`) {
  const at = (p) => 1 - Math.sqrt(1 - p); // 進んだ割合 p に届く時刻
  const frames = [{ offset: 0, transform: form(0), easing: RISE }];
  for (let k = 0; k < steps; k++) {
    const amp = lift * (1 - (k / steps) ** 2 * 0.7);
    frames.push({ offset: at((k + 0.5) / steps), transform: form(-amp), easing: FALL });
    frames.push({ offset: at((k + 1) / steps), transform: form(0), easing: RISE });
  }
  return frames;
}

function mountCh1(card, full) {
  const stage = el("div.ct-stage.ct-pixel");
  const title = [];
  for (const t of CH1_TITLE) title.push({ node: layerImg("ct-layer", t.id, t.x, t.y), ...t });
  CH1_GLYPHS.forEach(([x, y], i) => title.push({ node: layerImg("ct-layer", `title-name${i}`, x, y), at: GLYPH_AT + i * GLYPH_GAP, glyph: true }));
  const people = CH1_PEOPLE.map((p) => {
    const body = layerImg("ct-body", p.id, p.x, p.y);
    const shadow = layerImg("ct-shadow", `${p.id}-shadow`, p.sx, CH1_SHADOW_Y);
    const walker = el("div.ct-walker", [shadow, body]);
    // 止まる位置のすぐ左に動かない霧の縁を置き、歩く人は体の前から順に霧を抜けて現れる
    const edge = p.x - MIST + 10;
    // 濃さは加速して上げる（つま先だけが白地に先に浮かないように）
    const lane = el("div.ct-lane", { style: { "--ct-mist": `linear-gradient(90deg, transparent ${edge}px, rgba(0,0,0,.1) ${edge + 45}px, rgba(0,0,0,.45) ${edge + 82}px, #000 ${edge + MIST - 30}px)` } }, [walker]);
    // 霧の縁に立つ薄い煙。上下にずらした2つの塊が、歩み出た後ろへ立ちのぼってほどける
    const h = 720 - 76 - p.y;
    const puffs = [[0.34, 0, 240], [0.74, 26, 280]].map(([r, dx, pw]) => el("i.ct-puff", { style: {
      left: `${edge + 30 - dx}px`, top: `${p.y + h * r}px`, "--ct-pw": `${pw}px`,
    } }));
    return { ...p, body, shadow, walker, lane, puffs };
  });
  stage.append(...people.flatMap((p) => [p.lane, ...p.puffs]), ...title.map((t) => t.node));
  full.classList.add("ct-final");
  card.classList.add("ct-layered", "ct-ch1");
  card.append(stage);
  for (const t of title) t.node.style.opacity = "0";
  for (const p of people) p.walker.style.opacity = "0"; // 動き出すまで（霧の外に体の端が残らないように）

  return async () => {
    for (const p of people) {
      const opt = { delay: p.at, fill: "both" };
      // 横移動は1区間の減速。歩いて来て、所定の位置で歩みをゆるめる
      p.walker.style.opacity = "";
      p.walker.animate([{ transform: `translateX(${-p.from}px)`, easing: DECEL }, { transform: "translateX(0px)" }], { ...opt, duration: p.ms });
      const steps = Math.max(3, Math.round(p.ms / 300));
      p.body.animate(bobFrames(steps, 3.2), { ...opt, duration: p.ms, easing: "linear" });
      // 足が地面を蹴るたびに影がわずかに縮む（本体の上下と同じ間）
      p.shadow.animate(bobFrames(steps, 3.2, (y) => `scaleX(${(1 + y * 0.012).toFixed(3)})`), { ...opt, duration: p.ms, easing: "linear" });
      p.puffs.forEach((puff, i) => puff.animate([
        { transform: "translate(-50%, -50%) scale(.6) rotate(0deg)", opacity: 0, easing: SOFT },
        { transform: "translate(-58%, -62%) scale(.95) rotate(-6deg)", opacity: 1, offset: 0.32, easing: SINE },
        { transform: "translate(-80%, -96%) scale(1.35) rotate(-14deg)", opacity: 0 },
      ], { delay: Math.max(0, p.at - 160) + i * 140, duration: 1700, fill: "both" })); // 煙が先に立ち、そこから歩み出る
    }
    for (const t of title) {
      const opt = { delay: t.at, fill: "both" };
      t.node.style.opacity = "";
      if (t.rule) {
        // 細い罫は中央から左右へ引かれる
        t.node.animate([{ transform: "scaleX(0)", opacity: 0, easing: "cubic-bezier(.65,0,.35,1)" }, { transform: "scaleX(1)", opacity: 1 }], { ...opt, duration: 900 });
      } else if (t.glyph) {
        // 大見出しは1文字ずつ、ぼけから少し沈んで落ち着く（行きすぎて戻る）
        t.node.animate([
          { transform: "translateY(16px)", opacity: 0, filter: "blur(6px)", easing: "cubic-bezier(.22,1,.36,1)" },
          { transform: "translateY(-2px)", opacity: 1, filter: "blur(0px)", offset: 0.7, easing: SINE },
          { transform: "translateY(0px)", opacity: 1, filter: "blur(0px)" },
        ], { ...opt, duration: 900 });
      } else {
        t.node.animate([
          { transform: "translateY(8px)", opacity: 0, easing: "cubic-bezier(.22,1,.36,1)" },
          { transform: "translateY(0px)", opacity: 1 },
        ], { ...opt, duration: 800 });
      }
    }
    await sleep(Math.max(...people.map((p) => p.at + p.ms), GLYPH_AT + GLYPH_GAP * 5 + 900) + 120);
    // 組み上がった構図を、元の一枚絵そのものに差し替える（レイヤーの継ぎ目を残さない）
    full.classList.add("ct-shown");
    requestAnimationFrame(() => requestAnimationFrame(() => stage.remove()));
    await sleep(Math.max(0, CH1_TOTAL - (CH1_PEOPLE.at(-1).at + CH1_PEOPLE.at(-1).ms + 120)));
  };
}

// ---------------------------------------------------------------- 第二・四・五章（一枚絵）

// glint は題字だけを白く抜いたマスク（assets/ui/chapters/chN-title-glint.png）の位置。origin は寄りの中心
const PAINTED = {
// tint は光のにじみ、core は帯の芯の色（暗い題字の第四章は白ではなく夕日の金）
  第二章: { key: "ch2", glint: { x: 50, y: 170, w: 425, h: 130 }, origin: "66% 42%", tint: "255,150,205", core: "255,255,255", glow: 0.85 },
  第四章: { key: "ch4", glint: { x: 50, y: 215, w: 465, h: 145 }, origin: "64% 40%", tint: "255,196,120", core: "255,226,160", glow: 0.7 },
  第五章: { key: "ch5", glint: { x: 45, y: 178, w: 437, h: 312 }, origin: "70% 44%", tint: "190,160,255", core: "255,255,255", glow: 0.9 },
};
const PAINT_TOTAL = 4400;
const SWAP_AT = 3800; // 採用画像へ溶かし始める時刻（寄りはここでほぼ収まっている）

function mountPainted(card, full, spec) {
  const src = full.getAttribute("src");
  const plate = el("img.ct-plate", { src, alt: "", draggable: "false" });
  const sharp = el("img.ct-sharp", { src, alt: "", draggable: "false" });
  const sweep = el("div.ct-sweep");
  const g = spec.glint;
  const band = el("i");
  const glint = el("div.ct-glint-wrap", {
    style: { left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px`, "--ct-mask": `url("${img(`${spec.key}-title-glint`)}")` },
  }, [el("div.ct-glint", [band])]);
  const cam = el("div.ct-cam", { style: { transformOrigin: spec.origin, "--ct-tint": spec.tint, "--ct-core": spec.core } }, [plate, sharp, sweep, glint]);
  full.classList.add("ct-final");
  card.classList.add("ct-layered", "ct-painted");
  card.append(cam);

  return async () => {
    // ゆっくりした寄りが収まる（全体を通して1区間）
    cam.animate([{ transform: "scale(1.075)", easing: "cubic-bezier(.3,.1,.25,1)" }, { transform: "scale(1)" }], { duration: 4000, fill: "both" });
    // ピント送り: 右の人物から左の題字へ。境目に淡い光が付いて行く
    cam.animate([{ "--ct-wipe": "122%", easing: "cubic-bezier(.42,0,.25,1)" }, { "--ct-wipe": "-22%" }], { duration: 2000, delay: 200, fill: "both" });
    plate.animate([{ filter: "blur(16px) brightness(.38) saturate(.85)", easing: SOFT }, { filter: "blur(14px) brightness(.62) saturate(.9)" }], { duration: 900, fill: "both" });
    sweep.animate([{ opacity: 0, easing: SOFT }, { opacity: 1, offset: 0.25, easing: SINE }, { opacity: 1, offset: 0.7, easing: SINE }, { opacity: 0 }], { duration: 2000, delay: 200, fill: "both" });
    // 題字の形にだけ光が一筋走る
    band.animate([{ transform: "translateX(-60%)", easing: "cubic-bezier(.55,.1,.35,1)" }, { transform: `translateX(${g.w + 40}px)` }], { duration: 1050, delay: 2200, fill: "both" });
    glint.animate([{ opacity: 0, easing: SOFT }, { opacity: spec.glow, offset: 0.2, easing: SINE }, { opacity: spec.glow, offset: 0.75, easing: SINE }, { opacity: 0 }], { duration: 1050, delay: 2200, fill: "both" });
    await sleep(SWAP_AT);
    // 寄りの合成層は採用画像よりわずかに柔らかいので、切り替えは一瞬で替えず重ねて溶かす
    full.classList.add("ct-shown");
    setTimeout(() => cam.remove(), 700);
    await sleep(PAINT_TOTAL - SWAP_AT);
  };
}

// ---------------------------------------------------------------- 入口

/** 本編の一枚絵のほかに読み込む絵（動き軽減では使わない） */
export function chapterArtUrls(no) {
  if (reducedMotion()) return [];
  if (no === "第一章") return ch1Urls();
  const spec = PAINTED[no];
  return spec ? [img(`${spec.key}-title-glint`)] : [];
}

/**
 * 章タイトルのカードに動きを組み込む。戻り値の play() は退場（フェードアウト）を始めてよい時刻まで待つ。
 * full は採用画像の img.cc-art（最後にこれへ差し替える）。絵が無い章は full を省く。
 */
export function mountChapterTitle(card, { no, full = null } = {}) {
  if (reducedMotion()) return null;
  if (!full) {
    card.classList.add("ct-text");
    return () => sleep(3600);
  }
  if (no === "第一章") return mountCh1(card, full);
  const spec = PAINTED[no];
  return spec ? mountPainted(card, full, spec) : null;
}
