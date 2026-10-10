// チェキ（PEPPERMINT 初来店・ch1_minto_first の cheki_taken の show_cg effect:"cheki"）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- a: チェキ: ファインダー → シャッター → フィルム → 写真だけ現像 → 落書きを書いていく

const CHEKI = { bg: "#2a2238", deep: "#17111f", main: "#ff7aa8", mid: "#6ee7c8", light: "#fff6e5", white: "#ffffff" };
const PHOTO = "inset(8.08% 10.47% 22.22% 10.57%)"; // 写真の範囲（元画像の実測）
// 余白の落書き。書いていく順に [始まりの切り抜き, 書き終えた切り抜き]
const DOODLES = [
  ["inset(16% 89.4% 84% 3.5%)", "inset(16% 89.4% 21% 3.5%)"], // 左の余白（上から下へ）
  ["inset(16% 3.5% 84% 89.4%)", "inset(16% 3.5% 21% 89.4%)"], // 右の余白
  ["inset(77.6% 95% 13.4% 4%)", "inset(77.6% 4% 13.4% 4%)"], // 1行目（左から右へ）
  ["inset(86.6% 95% 2.5% 4%)", "inset(86.6% 4% 2.5% 4%)"], // 2行目と名前
];

/** 会話のCGレイヤーと同じ位置・大きさ（vn.css の縦型チェキ: 高さ 100%-230px、上から18px） */
function chekiBox(img) {
  const h = H - 230;
  const w = Math.round(h * (img.naturalWidth / img.naturalHeight || 0.63));
  return { left: (W - w) / 2, top: 18, width: w, height: h };
}

/** placeCg(): 書き終えた瞬間に会話のCGを同じ位置へ置く（重ねたフィルムを外す前に呼ぶ） */
export async function a(url, placeCg = null) {
  const P = pick(CHEKI);
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  await stagePlay("cheki", async (node) => {
    const box = chekiBox(img);
    const back = backdrop(P.bg);
    back.style.opacity = "0";
    const stripes = el("div.mo-stripes", { style: { "--c": P.main } });
    const art = stageSvg();
    // ファインダー: 四隅のカギと、合焦する小さな枠
    const fx = 400, fy = 40, fw = 480, fh = 470, k = 70;
    const corners = [[fx, fy + k, fx, fy, fx + k, fy], [fx + fw - k, fy, fx + fw, fy, fx + fw, fy + k], [fx, fy + fh - k, fx, fy + fh, fx + k, fy + fh], [fx + fw - k, fy + fh, fx + fw, fy + fh, fx + fw, fy + fh - k]]
      .map(([x1, y1, x2, y2, x3, y3]) => svg("path", { d: `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`, fill: "none", stroke: P.white, "stroke-width": 7, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }));
    const focus = svg("rect", { x: 610, y: 200, width: 64, height: 46, fill: "none", stroke: P.white, "stroke-width": 4, class: "tr-scale" });
    art.append(...corners, focus);
    const blades = stageSvg([...Array(6)].map((_, i) => svg("g", { transform: `rotate(${i * 60 + 18} ${W / 2} ${H / 2})` }, [
      svg("rect", { x: W / 2 - 1000, y: H / 2 - 760 - 1100, width: 2000, height: 1100, fill: i % 2 ? P.deep : P.bg, stroke: P.main, "stroke-width": 3, class: "mo-blade" }),
    ])));
    const flash = el("div.mo-flash");
    // フィルム: 白い台紙（写真の形で切り抜き）→ 写真だけ現像 → 落書きを書く
    const film = el("div.mo-film", { style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` } });
    const card = el("i.mo-film-card", { style: { "-webkit-mask-image": `url("${url}")`, maskImage: `url("${url}")` } });
    const photo = el("img.mo-film-layer", { src: url, alt: "", style: { clipPath: PHOTO } });
    const inks = DOODLES.map(([from]) => el("img.mo-film-layer", { src: url, alt: "", style: { clipPath: from } }));
    const full = el("img.mo-film-layer", { src: url, alt: "", style: { opacity: "0" } });
    const pen = el("i.mo-pen", { style: { background: P.main } });
    film.append(card, photo, ...inks, full, pen);
    film.style.opacity = "0";
    node.append(back, stripes, art, blades, flash, film);
    // 1. ファインダーの四隅が描かれ、枠が迷ってから合う
    corners.forEach((c, i) => move(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 300, { easing: E.out, delay: i * 40 }));
    await move(focus, [{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(0.85)", opacity: 1, offset: 0.5 }, { transform: "scale(1.1)", offset: 0.75 }, { transform: "scale(1)" }], 620, { easing: E.out });
    focus.setAttribute("stroke", P.mid);
    ring(art, 642, 223, { r: 70, color: P.mid, width: 5, dur: 420 });
    await sleep(220);
    // 2. シャッターの羽根が閉じてフラッシュ
    SE.punch();
    await Promise.all([...blades.querySelectorAll(".mo-blade")].map((b) => move(b, [{ transform: "translate(0,0)" }, { transform: "translate(0, 770px)" }], 150, { easing: E.in })));
    back.style.opacity = "1";
    art.replaceChildren();
    move(flash, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: E.out });
    move(blades, [{ opacity: 1 }, { opacity: 0 }], 160);
    move(stripes, [{ opacity: 0 }, { opacity: 1 }], 500);
    // 3. フィルムが下から伸びて出てくる
    SE.pour();
    film.style.opacity = "";
    await move(film, [{ transform: "translateY(118%) rotate(-7deg) scaleY(1.12)" }, { transform: "translateY(0) rotate(-2deg) scaleY(1)" }], 680, { easing: E.out });
    burst(art, W / 2, box.top + box.height + 6, { n: 6, r0: 30, r1: 90, color: P.light, width: 5, turn: Math.PI / 6 });
    // 4. 写真だけが白っぽいところから現像される（台紙の余白はまだ白いまま）
    move(photo, [{ filter: "brightness(2.3) saturate(0) contrast(0.22)" }, { filter: "brightness(1.4) saturate(0.4) contrast(0.6)", offset: 0.45 }, { filter: "none" }], 1300, { easing: "ease-out" });
    [[-40, 120], [box.width + 40, 260], [-30, 380]].forEach(([dx, dy], i) => twinkle(art, box.left + dx, box.top + dy, { color: P.light, size: 14, delay: 300 + i * 260 }));
    await sleep(1350);
    // 5. 余白に落書きが書かれていく（ペン先が先頭を走る）
    for (const [i, [from, to]] of DOODLES.entries()) {
      const vertical = i < 2;
      const dur = vertical ? 300 : 440;
      const x0 = i === 1 ? 93 : 7, y0 = vertical ? 16 : i === 2 ? 82 : 91;
      pen.style.opacity = "1";
      move(pen, vertical
        ? [{ left: `${x0}%`, top: `${y0}%` }, { left: `${x0}%`, top: "79%" }]
        : [{ left: "4%", top: `${y0}%` }, { left: "96%", top: `${y0}%` }], dur, { easing: "ease-in-out" });
      SE.tick();
      await move(inks[i], [{ clipPath: from }, { clipPath: to }], dur, { easing: "ease-in-out" });
    }
    pen.style.opacity = "0";
    full.style.opacity = "1";
    twinkle(art, box.left + box.width - 30, box.top + box.height - 70, { color: P.main, size: 22 });
    twinkle(art, box.left + 26, box.top + box.height - 40, { color: P.mid, size: 16, delay: 90 });
    await move(film, [{ transform: "rotate(-2deg)" }, { transform: "rotate(0deg)" }], 320, { easing: E.back });
    // 6. 背景を会話のCGと同じ黒へ戻し、同じ位置にCGを置く
    move(stripes, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(back, [{ backgroundColor: P.bg }, { backgroundColor: "#0b0812" }], 320);
    placeCg?.();
  });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b(url, placeCg = null) {
  return a(url, placeCg);
}
