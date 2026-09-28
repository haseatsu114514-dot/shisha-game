// 作業台の絵作り。assets/ui/making の素材を「中身の範囲（bbox）」基準で置くので、
// 素材ごとのキャンバス余白の差を気にせずレイアウトできる。煙・水・泡・熾きはコードで描く。
import { el, rand } from "../core/util.js";
import { DB, makingUrl } from "../core/data.js";

/** 素材の絵そのものが幅 w px になる要素を返す（高さは縦横比から決まる） */
export function artImg(name, w, cls = "") {
  const url = makingUrl(name);
  const box = DB.manifest.makingBox?.[name];
  if (!url || !box) return el(`div.art-missing${cls ? "." + cls : ""}`, { style: { width: `${w}px`, height: `${w}px` } });
  const [l, t, r, b, aspect] = box;
  const fullW = w / (r - l);
  const fullH = fullW / aspect;
  const h = fullH * (b - t);
  return el(`div.art${cls ? "." + cls : ""}`, {
    style: {
      width: `${w}px`,
      height: `${h}px`,
      backgroundImage: `url("${url}")`,
      backgroundSize: `${fullW}px ${fullH}px`,
      backgroundPosition: `${-l * fullW}px ${-t * fullH}px`,
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
export function buildRig() {
  const coalName = (charcoal, state) => (charcoal === "cube_charcoal" ? `coal_${state}.png` : `coal_flat_${state}.png`);
  const root = el("div.rig");
  const smoke = el("div.rig-smoke");
  const base = artImg("hookah_base.png", 250, "rig-base");
  const water = el("div.rig-water", [el("i"), el("i"), el("i"), el("i")]);
  const stem = artImg("hookah_stem.png", 34, "rig-stem");
  const bowl = el("div.rig-bowl", [artImg("bowl_empty_clay.png", 150, "rig-bowl-img")]);
  const leaf = el("div.rig-leaf");
  const foil = el("div.rig-foil");
  const coals = el("div.rig-coals");
  bowl.append(leaf, foil, coals);
  root.append(smoke, base, water, stem, bowl);

  let smokeTimer = 0;
  const api = {
    root,
    update(cs) {
      const packed = !!cs.pack;
      bowl.replaceChildren(artImg(packed ? `bowl_packed_${{ fluffy: "airy", normal: "normal", firm: "firm" }[cs.pack]}.png` : "bowl_empty_clay.png", 150, "rig-bowl-img"), leaf, foil, coals);
      leaf.style.background = mixColor(cs.mix);
      leaf.classList.toggle("show", Object.values(cs.mix || {}).some(Boolean) && !packed);
      foil.classList.toggle("show", !!cs.holes);
      foil.replaceChildren(...(cs.holes?.dots || []).slice(0, 60).map(([x, y]) => el("i", { style: { left: `${50 + x * 46}%`, top: `${50 + y * 46}%` } })));
      const n = cs.place === "four" ? 4 : cs.place ? 3 : 0;
      coals.replaceChildren(...Array.from({ length: n }, (_, i) => {
        const c = artImg(coalName(cs.equip?.charcoal, cs.heat?.just ? "just" : "red"), 30, "rig-coal");
        c.style.setProperty("--i", String(i));
        return c;
      }));
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
