// 一台の記録（CFX03「一台が育つ」）。工程を終えるたび、左の作業風景の隅に灯をひとつ点け、
// 出来が良いほど明るく灯す。灯った分だけ作業風景に暖かい気配（オーラ）が満ちていく。
// 表示だけの部品。点数・ランク・勝敗・保存には触れない（数字も文字の評価も出さない）。
import { el } from "../core/util.js";
import { sparks, shockRing } from "./fx.js";

/** 灯の並び。キーは scoreStep の工程名（care1/care2 は care にまとめる） */
export const RECORD_STEPS = Object.freeze([
  ["holes", "穴", "穴あけ"], ["heat", "炭", "炭焼き"], ["steam", "蒸", "蒸らし"], ["pull", "吸", "吸い出し"], ["care", "整", "熱管理"],
]);

/** 点数（0〜100）→ 灯の段階。大会の観客の反応（broadcast の judgeOf）と同じ境目 */
export const recordTier = (score) => (score >= 88 ? "brilliant" : score >= 74 ? "great" : score >= 55 ? "good" : "dim");
const TIER_GLOW = { brilliant: 1, great: .7, good: .4, dim: 0 };
const TIER_LABEL = { brilliant: "輝いている", great: "よく灯った", good: "灯った", dim: "かすかに灯った" };
const stepOf = (key) => (/^care\d*$/.test(key) ? "care" : key);

export function buildRigRecord() {
  const lamps = new Map(RECORD_STEPS.map(([id, glyph, label]) => [id, el("i.rig-lamp", {
    dataset: { step: id, tier: "off" }, title: label, "aria-hidden": "true",
  }, [el("b", { text: glyph })])]));
  const root = el("div.rig-record", { role: "img", "aria-label": "一台の記録：まだ灯っていない", dataset: { test: "rig-record" } }, [...lamps.values()]);
  const aura = el("i.rig-aura", { "aria-hidden": "true" });
  const tiers = new Map();
  const describe = () => {
    const lit = RECORD_STEPS.filter(([id]) => tiers.has(id)).map(([id, , label]) => `${label}${TIER_LABEL[tiers.get(id)]}`);
    root.setAttribute("aria-label", lit.length ? `一台の記録：${lit.join("、")}` : "一台の記録：まだ灯っていない");
  };
  const glow = () => {
    // 灯った工程の明るさの平均。全工程が輝けば 1
    const values = [...tiers.values()].map((t) => TIER_GLOW[t]);
    const level = values.length ? values.reduce((a, b) => a + b, 0) / RECORD_STEPS.length : 0;
    aura.style.setProperty("--rig-aura", level.toFixed(3));
    aura.dataset.full = String(values.length === RECORD_STEPS.length && values.every((v) => v === 1));
  };
  return {
    root, aura,
    /** 工程の点数を記録する。同じ工程の2回目（熱管理の2回目など）は灯を付け直す。quiet は作り直し時の復元用（動きなし） */
    mark(key, score, { quiet = false } = {}) {
      const step = stepOf(key), lamp = lamps.get(step);
      if (!lamp || !Number.isFinite(score)) return;
      const tier = recordTier(score);
      tiers.set(step, tier);
      lamp.dataset.tier = tier;
      if (!quiet) { lamp.classList.remove("lit"); void lamp.offsetWidth; lamp.classList.add("lit"); }
      if (!quiet && (tier === "brilliant" || tier === "great")) {
        const host = root.parentElement || root;
        const color = tier === "brilliant" ? "#ffc21a" : "#ff9a3a";
        sparks(host, { ...lampCenter(host, lamp), n: tier === "brilliant" ? 10 : 5, color, spread: 46 });
        if (tier === "brilliant") shockRing(host, { ...lampCenter(host, lamp), color, size: 70 });
      }
      describe(); glow();
    },
    tierOf: (step) => tiers.get(step) || null,
    /** 作業台を作り直したとき、一台に残っている各工程の結果から灯を戻す */
    restore(cs) {
      for (const [id] of RECORD_STEPS) {
        const score = Number(cs?.[id]?.score);
        if (cs?.[id] && Number.isFinite(score)) this.mark(id, score, { quiet: true });
      }
    },
  };
}

function lampCenter(host, lamp) {
  const h = host.getBoundingClientRect?.(), r = lamp.getBoundingClientRect?.();
  if (!h?.width || !r?.width) return { x: "50%", y: "50%" };
  // 作業風景は stage の拡大縮小の中にあるので、見た目の比率で返す
  return { x: `${((r.left + r.width / 2 - h.left) / h.width) * 100}%`, y: `${((r.top + r.height / 2 - h.top) / h.height) * 100}%` };
}
