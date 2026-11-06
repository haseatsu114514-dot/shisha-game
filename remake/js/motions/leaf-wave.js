// A3 第3章 章頭の公園の回想 → 現在（#2688・#2735）「落ち葉の波」。葉の形の紫の面が右から左へゆっくり流れて画面を覆い、
// 覆っている間に mid() で現在の背景へ替え、流れ去ると色のついた現在が見える。約1.5秒（到着の絵が遅い間は覆ったまま待つ）。
// 波＝時間が過ぎる（CI101）の第3章版。動きを減らす設定では紫の面のフェードで覆って替えるだけ。
import { sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const EDGE = 420; // 先頭・最後尾の葉が散らばる幅
const BODY = W + 260; // 葉の帯の、すき間のない中央の幅
const SHADES = [MONO.deep, COLOR.deep, MONO.main, COLOR.purple, MONO.mid];

/** 葉1枚（中心が原点・右向き）。len: 長さ */
const leafPath = (len, wide) => `M ${-len / 2} 0 C ${-len / 4} ${-wide}, ${len / 4} ${-wide}, ${len / 2} 0 C ${len / 4} ${wide}, ${-len / 4} ${wide}, ${-len / 2} 0 Z`;

/** 決まった並びの乱数（毎回同じ形に流れる） */
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** 帯の端に葉を散らす。side: -1 先頭（左端）、+1 最後尾（右端） */
function edgeLeaves(x0, side, rand) {
  const leaves = [];
  for (let i = 0; i < 16; i++) {
    const len = 260 + rand() * 260;
    const x = x0 + side * rand() * EDGE;
    const y = -60 + rand() * (H + 120);
    const turn = -40 + rand() * 80 + (side < 0 ? 180 : 0);
    const vein = svg("path", { d: `M ${-len * 0.42} 0 Q 0 ${len * 0.04}, ${len * 0.42} 0`, stroke: MONO.light, "stroke-width": 3, fill: "none", opacity: 0.35, "stroke-linecap": "round" });
    const g = svg("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn.toFixed(1)})` }, [
      svg("path", { d: leafPath(len, len * 0.32), fill: SHADES[i % SHADES.length] }),
      vein,
    ]);
    leaves.push(g);
  }
  return leaves;
}

export async function play({ mid = null, pace = 1, still = false } = {}) {
  await stagePlay("leaf-wave", async (node) => {
    if (still) {
      const veil = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.deep, opacity: 0 });
      node.append(stageSvg([veil]));
      await move(veil, [{ opacity: 0 }, { opacity: 1 }], 220, { easing: "linear" });
      await mid?.();
      await move(veil, [{ opacity: 1 }, { opacity: 0 }], 260, { easing: "linear" });
      return;
    }
    const t = (ms) => Math.round(ms * pace);
    const rand = seeded(2735);
    // 左端 x=0 から右へ BODY の帯。先頭（左）と最後尾（右）に葉が散る
    const body = svg("rect", { x: 0, y: -40, width: BODY, height: H + 80, fill: COLOR.deep });
    const wave = svg("g", {}, [body, ...edgeLeaves(0, -1, rand), ...edgeLeaves(BODY, 1, rand)]);
    node.append(stageSvg([wave]));
    const at = (x) => ({ transform: `translateX(${x}px)` });
    const start = W + EDGE + 40, cover = -130, end = -(BODY + EDGE + 40);
    SE.whoosh();
    // 1. 右から流れてきて覆う
    await move(wave, [at(start), at(cover)], t(620), { easing: "cubic-bezier(.3,.1,.3,1)" });
    // 2. 覆っている間に現在へ（遅い絵は覆ったまま待つ）。葉の帯はほんの少し流れ続ける
    const drift = move(wave, [at(cover), at(cover - 90)], t(260), { easing: "linear" });
    await Promise.all([mid?.(), sleep(t(260)), drift]);
    // 3. 左へ流れ去る
    await move(wave, [at(cover - 90), at(end)], t(640), { easing: "cubic-bezier(.6,0,.7,.9)" });
  }, { cover: true });
}
