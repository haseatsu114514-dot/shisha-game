// ライバルの小窓（CFX04）。大会の作業台で、同じ時間に隣の台で作っているライバルを小さな札で見せる。
// はじめが工程を終えるたび、各ライバルの同じ工程の灯が少し遅れて順に灯る。輝く出来の瞬間は札が光り、観客が沸く。
// 灯の明るさは章ごとの大会データ（ライバルの出来）から決める。数字・順位は出さない（表示だけの部品）。
// 第5章（9000との一騎打ち・採点を見せない章）と大会以外では出さない。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { faceIconUrl, displayName } from "../core/data.js";
import { state } from "../core/state.js";
import { CH1_RIVALS } from "./ch1-votes.js";
import { RIVAL_QUALITY as CH2_RIVALS } from "../chapters/ch2-tournament-state.js";
import { RIVAL_QUALITY as CH3_RIVALS } from "../chapters/ch3-tournament-state.js";
import { CH4_RIVAL_CURVE } from "../chapters/ch4-tournament-state.js";
import { RECORD_STEPS, recordTier } from "./rig-record.js";
import { sparks, fxMode } from "./fx.js";

const STEP_IDS = RECORD_STEPS.map(([id]) => id);
const flat = (q) => () => q;

/**
 * 章ごとのライバルと、工程（holes/heat/steam/pull/care と care1・care2）ごとの出来。
 * 第1章は工程ごとの値（穴あけ・炭・提供・調整1・調整2）。蒸らしは評価の対象外なので提供の値で灯す。
 * 第2・3章は一台の出来（全工程同じ）。第4章は投票の4回分の推移を工程に割り当てる。
 */
export const RIVAL_LINEUPS = Object.freeze({
  1: Object.entries(CH1_RIVALS).map(([id, r]) => ({ id, score: (step) =>
    ({ holes: r[0], heat: r[1], steam: r[2], pull: r[2], care: r[4], care1: r[3], care2: r[4] })[step] })),
  2: Object.entries(CH2_RIVALS).map(([id, q]) => ({ id, score: flat(q) })),
  3: Object.entries(CH3_RIVALS).map(([id, q]) => ({ id, score: flat(q) })),
  4: Object.entries(CH4_RIVAL_CURVE).map(([id, c]) => ({ id, score: (step) =>
    ({ holes: c[0], heat: c[0], steam: c[1], pull: c[2], care: c[3], care1: c[3], care2: c[3] })[step] })),
});

export const rivalLineup = (cs) => (cs?.mode === "tournament" ? RIVAL_LINEUPS[cs.chapter] || null : null);
const lampOf = (key) => (/^care\d*$/.test(key) ? "care" : key);

export function buildRivalWindows(cs) {
  const lineup = rivalLineup(cs);
  if (!lineup?.length) return null;
  const cards = lineup.map((rival) => {
    const lamps = new Map(STEP_IDS.map((id) => [id, el("i.rival-lamp", { dataset: { step: id, tier: "off" } })]));
    const icon = faceIconUrl(rival.id, state);
    const card = el("div.rival-card", { dataset: { rival: rival.id, test: `rival-${rival.id}` } }, [
      el("span.rival-face", icon ? [el("img", { src: icon, alt: "", draggable: "false" })] : []),
      el("b.rival-name", { text: displayName(rival.id, state) }),
      el("span.rival-lamps", [...lamps.values()]),
    ]);
    return { rival, card, lamps };
  });
  const root = el("div.rival-windows", { "aria-hidden": "true", dataset: { test: "rival-windows" } }, cards.map((c) => c.card));
  const timers = new Set();
  let cheered = 0;
  const light = (c, key) => {
    const step = lampOf(key), lamp = c.lamps.get(step), score = c.rival.score(key);
    if (!lamp || !Number.isFinite(score) || !root.isConnected) return;
    const tier = recordTier(score);
    lamp.dataset.tier = tier;
    if (tier !== "brilliant") return;
    // 決めた瞬間: 札が光り、観客が沸く（歓声は一度の工程で一回まで）
    c.card.classList.remove("flash"); void c.card.offsetWidth; c.card.classList.add("flash");
    sparks(c.card, { x: "22px", y: "50%", n: 6, color: "#ffc21a", spread: 34 });
    if (cheered++ === 0 && fxMode() !== "off") SE.crowd?.();
  };
  return {
    root,
    /** はじめが工程を終えたとき。ライバルの灯を少しずつずらして灯す（quiet は作り直しの復元） */
    mark(key, { quiet = false } = {}) {
      if (!STEP_IDS.includes(lampOf(key))) return;
      cheered = 0;
      cards.forEach((c, i) => {
        if (quiet || fxMode() === "off") { const t = c.lamps.get(lampOf(key)); const s = c.rival.score(key); if (t && Number.isFinite(s)) t.dataset.tier = recordTier(s); return; }
        const timer = setTimeout(() => { timers.delete(timer); light(c, key); }, 450 + i * 380);
        timers.add(timer);
      });
    },
    /** 作業台を作り直したとき、はじめが終えた工程の分だけライバルの灯も戻す */
    restore(record) {
      for (const id of STEP_IDS) if (record?.tierOf(id)) this.mark(id, { quiet: true });
    },
    dispose() { for (const t of timers) clearTimeout(t); timers.clear(); },
  };
}
