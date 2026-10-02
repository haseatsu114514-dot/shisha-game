// 作業台の絵作り。assets/ui/making の素材を「中身の範囲（bbox）」基準で置くので、
// 素材ごとのキャンバス余白の差を気にせずレイアウトできる。煙・水・泡・熾きはコードで描く。
import { el, rand } from "../core/util.js";
import { DB, makingUrl } from "../core/data.js";

/** 素材の中身（bbox）を幅 w px で置いたときの高さ */
export function artHeight(name, w) {
  const box = DB.manifest.makingBox?.[name];
  if (!box) return w;
  const [l, t, r, b, aspect] = box;
  return ((w / (r - l)) / aspect) * (b - t);
}

/**
 * 素材の絵そのものが幅 w px になる要素を返す（高さは縦横比から決まる）。
 * opts.h: 高さを指定して縦だけ潰す（斜め俯瞰の角度をボウルの口に合わせる等）
 * opts.cropTop: 絵の上から何 px を切り落とすか（長いステムを見える分だけ使う等）
 */
export function artImg(name, w, cls = "", { h = null, cropTop = 0 } = {}) {
  const url = makingUrl(name);
  const box = DB.manifest.makingBox?.[name];
  if (!url || !box) return el(`div.art-missing${cls ? "." + cls : ""}`, { style: { width: `${w}px`, height: `${w}px` } });
  const [l, t, r, b, aspect] = box;
  const fullW = w / (r - l);
  const natH = (fullW / aspect) * (b - t);
  const sy = h ? h / natH : 1;
  const fullH = (fullW / aspect) * sy;
  return el(`div.art${cls ? "." + cls : ""}`, {
    style: {
      width: `${w}px`,
      height: `${(h || natH) - cropTop}px`,
      backgroundImage: `url("${url}")`,
      backgroundSize: `${fullW}px ${fullH}px`,
      backgroundPosition: `${-l * fullW}px ${-t * fullH - cropTop}px`,
    },
  });
}

// フレーバーの色（煙・ボウルの層・ジャーのラベル）。カテゴリで大まかに、代表的なものは個別に
export const FLAVOR_COLORS = {
  mint: "#7fe0c2", double_apple: "#c9463a", blueberry: "#5a6fd8", strawberry: "#ef5a7a", vanilla: "#f0dca0",
  pineapple: "#f2cf4a", coconut: "#efe8da", mango: "#f5a23a", lemon: "#f4ec5a", peach: "#f7a98c", orange: "#f28a2e",
  grape: "#8a4fc0", melon: "#9fe07a", watermelon: "#f25c64", banana: "#f3dc6a", cinnamon: "#b0602c", rose: "#e67aa4",
  lychee: "#f2c6d0", nightside_earlgrey: "#8c7aa8",
};
const CAT_COLORS = { cooling: "#7fe0c2", sweet: "#f0c890", fruit: "#f28a6a", spice: "#c06a3a", floral: "#d98ac0" };
export const flavorColor = (id) => FLAVOR_COLORS[id] || CAT_COLORS[DB.flavorById[id]?.category] || "#c9a070";

/** mix（{id: g}）の色を重さで混ぜた代表色 */
export function mixColor(mix) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const [id, grams] of Object.entries(mix || {})) {
    if (!grams) continue;
    const c = flavorColor(id).replace("#", "");
    r += parseInt(c.slice(0, 2), 16) * grams;
    g += parseInt(c.slice(2, 4), 16) * grams;
    b += parseInt(c.slice(4, 6), 16) * grams;
    n += grams;
  }
  if (!n) return "#d8d0e8";
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

// ---------------------------------------------------------------- 一台（リグ）

/**
 * 作業台左の「組み上がっていく一台」。工程に応じて部品が乗り、煙が立つ。
 * update(cs) を呼ぶたびに今の状態を反映する。
 */
// ボウルの種類 → 素材。rim=口（楕円）の上端〜中心までの高さ比（素材を実測）。
// 素焼きは「詰めた」差分が無いので、空の器に葉の色の楕円を重ねる
const BOWL_ART = {
  silicone_bowl: { empty: "bowl_empty_silicone.png", packed: (p) => `bowl_packed_${p}.png`, w: 116, rim: 0.12 },
  hagal_80beat: { empty: "bowl_empty_phunnel.png", packed: (p) => `bowl_packed_phunnel_${p}.png`, w: 150, rim: 0.27 },
  suyaki_hagal: { empty: "bowl_empty_clay.png", packed: null, w: 150, rim: 0.24 },
};
const PACK_ART = { fluffy: "airy", normal: "normal", firm: "firm" };

// 一台の寸法（px・リグの箱の下端から）。ガラス台 → ステム（首に差し込む）→ トレイ → ボウル → アルミ → 炭
const RIG = { baseW: 190, stemW: 25, stemShow: 112, stemInside: 30, trayW: 150 };

/**
 * 作業台左の「組み上がっていく一台」。工程に応じて部品が乗り、煙が立つ。
 * update(cs) を呼ぶたびに今の状態を反映する。
 */
export function buildRig() {
  const coalName = (charcoal, st) => (charcoal === "cube_charcoal" ? `coal_${st}.png` : `coal_flat_${st}.png`);
  const root = el("div.rig");
  const smoke = el("div.rig-smoke");
  const baseH = artHeight("hookah_base.png", RIG.baseW);
  const base = artImg("hookah_base.png", RIG.baseW, "rig-base");
  const water = el("div.rig-water", [el("i"), el("i"), el("i"), el("i")]);
  // ステムは長いので、首から上に見える分＋差し込み分だけを下から使う（上端はボウルの下に隠れる）
  const stemNat = artHeight("hookah_stem.png", RIG.stemW);
  const stemH = RIG.stemInside + RIG.stemShow + 12;
  const stem = artImg("hookah_stem.png", RIG.stemW, "rig-stem", { cropTop: Math.max(0, stemNat - stemH) });
  const stemBottom = baseH - RIG.stemInside;
  const bowlBottom = baseH + RIG.stemShow;
  const trayH = artHeight("hookah_tray.png", RIG.trayW);
  const tray = artImg("hookah_tray.png", RIG.trayW, "rig-tray");
  const bowl = el("div.rig-bowl");
  const foil = el("div.rig-foil");
  const coals = el("div.rig-coals");
  const leaf = el("div.rig-leaf");
  Object.assign(base.style, { bottom: "0px" });
  Object.assign(water.style, { bottom: `${baseH * 0.06}px`, width: `${RIG.baseW * 0.62}px`, height: `${baseH * 0.34}px` });
  Object.assign(stem.style, { bottom: `${stemBottom}px` });
  Object.assign(tray.style, { bottom: `${bowlBottom - trayH * 0.55}px` });
  Object.assign(bowl.style, { bottom: `${bowlBottom}px` });
  root.append(smoke, stem, water, base, tray, bowl, foil, leaf, coals);

  let smokeTimer = 0;
  const api = {
    root,
    update(cs) {
      const spec = BOWL_ART[cs.equip?.bowl] || BOWL_ART.silicone_bowl;
      const packed = !!cs.pack;
      const name = packed && spec.packed ? spec.packed(PACK_ART[cs.pack] || "normal") : spec.empty;
      const bw = spec.w;
      const bh = artHeight(name, bw);
      bowl.replaceChildren(artImg(name, bw, "rig-bowl-img"));
      // 口（リム）の楕円の中心の高さ。ここにアルミ・葉・炭を合わせる
      const rimTop = bowlBottom + bh;
      const rimMid = rimTop - bh * spec.rim;
      const rimW = bw * 0.94;
      const hasMix = Object.values(cs.mix || {}).some(Boolean);
      // 葉: 詰めた差分が無い器（素焼き）と、配合したが詰める前の状態は色の楕円で見せる
      const showLeaf = hasMix && (!packed || !spec.packed) && !cs.holes;
      Object.assign(leaf.style, { width: `${rimW * 0.76}px`, height: `${rimW * 0.19}px`, bottom: `${rimMid - rimW * 0.12}px`, "--leaf": mixColor(cs.mix) });
      leaf.classList.toggle("show", showLeaf);
      // アルミ: 素材の斜め俯瞰がボウルより浅いので、口の楕円に合わせて縦を潰す
      foil.replaceChildren();
      if (cs.holes) {
        const fw = rimW * 1.08;
        const fh = fw * 0.36;
        const img = artImg("foil_surface.png", fw, "rig-foil-img", { h: fh });
        const dots = el("div.rig-foil-dots", (cs.holes.dots || []).slice(0, 60).map(([x, y]) =>
          el("i", { style: { left: `${50 + x * 44}%`, top: `${50 + (y / 0.34) * 40}%` } })));
        Object.assign(dots.style, { width: `${fw * 0.8}px`, height: `${fh * 0.5}px` });
        foil.append(img, dots);
        Object.assign(foil.style, { bottom: `${rimMid - fh * 0.62}px`, width: `${fw}px`, height: `${fh}px` });
      }
      foil.classList.toggle("show", !!cs.holes);
      // 炭: アルミの上面に三角（4個なら菱形）に並べる。位置だけ中心へ20%寄せ、寸法は保つ
      const n = cs.place === "four" ? 4 : cs.place ? 3 : 0;
      const cw = rimW * 0.27;
      const slots = n === 4
        ? [[-0.27, 0.05], [0.27, 0.05], [0, -0.14], [0, 0.22]]
        : [[-0.24, 0.1], [0.24, 0.1], [0, -0.12]];
      coals.replaceChildren(...slots.slice(0, n).sort((a, b) => a[1] - b[1]).map(([dx, dy]) => {
        const c = artImg(coalName(cs.equip?.charcoal, cs.heat?.just ? "just" : "red"), cw * (1 - dy * 0.4), "rig-coal");
        Object.assign(c.style, { left: `calc(50% + ${dx * rimW * 0.8}px)`, bottom: `${-dy * rimW * 0.5 * 0.8}px` });
        return c;
      }));
      Object.assign(coals.style, { bottom: `${rimMid + 2}px` });
      smoke.style.bottom = `${rimMid + 10}px`;
      root.classList.toggle("lit", !!cs.place);
      this.smoke(cs.place ? (cs.pullDone ? 3 : cs.steam ? 2 : 1) : 0, mixColor(cs.mix));
    },
    smoke(level, color) {
      clearInterval(smokeTimer);
      smoke.replaceChildren();
      if (!level) return;
      smokeTimer = setInterval(() => {
        if (!root.isConnected) { clearInterval(smokeTimer); return; }
        const p = el("i", { style: { left: `${50 + rand(-6, 6)}%`, "--drift": `${rand(-40, 40)}px`, "--tint": color, animationDuration: `${rand(2.6, 4.2)}s` } });
        smoke.append(p);
        setTimeout(() => p.remove(), 4300);
      }, 700 / level);
    },
    bubble(on) { water.classList.toggle("bubbling", !!on); },
    destroy() { clearInterval(smokeTimer); },
  };
  return api;
}
