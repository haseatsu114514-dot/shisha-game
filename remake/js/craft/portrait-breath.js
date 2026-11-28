import { workerBreath, ringBreath, smokeTint } from "../core/smoke.js";

// 吸い出しで吐く煙を、温度から連続して決める（VPL93・VPL94・VPL95）。本編 workerBreath の「適温」の吐き方を元に、項目ごとに温度で動かす。
// 煙の「量」と「濃さ・白さ」を分けて決める:
//   量……温度そのもので増える（熱いほど葉から多く出る）。低い＝少し、最適温＝たっぷり、高すぎ＝爆煙
//   濃さ・白さ……最適温に近いほど白く濃い。外れるとどちらへも薄くなる（低い＝薄くて少ない／高すぎ＝薄くて大きすぎる）
// 熱に強い葉（ミントなど）の配合は帯が上にずれ、最適温が高いぶん、白く濃いまま量も多くなる（VPL95）
const SMOKE_GRAY = [0.74, 0.72, 0.7];
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
function smokeByTemp(t, b, { x, y, color, danger }) {
  const [lo, hi] = b.zone, mid = (b.best[0] + b.best[1]) / 2, base = workerBreath("good", { x, y })[0];
  // 帯の位置で決まる量の倍率（基準の配合＝1.04。ミント多め≒1.25。スイカ・ストロベリー多めでも 0.9 まで）
  const heat = lerp(0.9, 1.3, (mid - 0.47) / 0.2);
  if (t < lo) { // 低い: 薄くて少ない。帯の下端へ近づくほど増える
    const k = (t - 0.12) / (lo - 0.12);
    return { quality: "thin", nice: 0, heat, breaths: [{ ...base, colors: [smokeTint(color, 0.3)], rate: lerp(6, 12, k), size: lerp(0.022, 0.03, k), dur: lerp(0.65, 1.05, k), life: lerp(1.3, 1.9, k),
      alpha: lerp(0.42, 0.6, k), hold: lerp(0.26, 0.36, k), speed: lerp(0.24, 0.36, k), spread: lerp(0.32, 0.42, k) }] };
  }
  if (t <= hi) { // 帯の中: 最適温に近いほど白く濃く、量も増える。帯の上の方ほど量は多め
    const q = 1 - Math.abs(t - mid) / Math.max(mid - lo, hi - mid), up = (t - lo) / (hi - lo);
    const best = t >= b.best[0] && t <= b.best[1], more = heat * lerp(0.88, 1.15, up);
    return { quality: best ? "best" : "good", nice: q, heat, breaths: [{ ...base, colors: [smokeTint(color, lerp(0.28, 0.07, q))], rate: lerp(12, 27, q) * more, size: lerp(0.03, 0.05, q) * Math.sqrt(more),
      dur: lerp(1.1, 1.95, q), life: lerp(2, 3.4, q), alpha: lerp(0.6, 1, q), hold: lerp(0.36, 0.54, q), speed: lerp(0.38, 0.46, q), turb: lerp(0.1, 0.05, q), spread: lerp(0.42, 0.34, q) }] };
  }
  // 高すぎ: 量は爆煙だが、薄くて大きすぎる（濃さは5段で塗るので、0.64〜0.8 で最適温の 1 より2段ほど薄い）。荒れてちぎれて横に散り、白さも抜けて早く崩れる（いい煙ではない）。熱いほどむせた短い煙も混ざる
  const h = (t - hi) / (danger - hi), pale = smokeTint(color, 0.2).map((v, i) => lerp(v, SMOKE_GRAY[i], 0.15 + 0.3 * h));
  const plume = { ...base, colors: [pale], rate: lerp(26, 64, h) * heat, size: lerp(0.055, 0.115, h), dur: lerp(1.7, 2.4, h), life: lerp(2.3, 1.8, h), alpha: lerp(0.8, 0.64, h), hold: lerp(0.34, 0.24, h),
    speed: lerp(0.6, 0.86, h), spread: lerp(0.55, 0.85, h), turb: lerp(0.12, 0.2, h), drag: lerp(1.5, 1.8, h), sway: 0, flat: true, lean: true };
  const breaths = [plume];
  if (h > 0.35) breaths.push({ ...plume, dur: 0.22, rate: 30, size: 0.03, life: 0.9, speed: 0.7, spread: 1.2, delay: 0.15 }, { ...plume, dur: 0.22, rate: 30, size: 0.03, life: 0.9, speed: 0.58, spread: 1.2, angle: plume.angle - 0.25, delay: 0.65 });
  return { quality: "harsh", nice: 0, heat, breaths };
}
// 煙の輪（本編 craft/fx.js の RING と同じ: 口元から右へ吹いた縦長の輪）
const SMOKE_RING = { radius: .03, size: .012, squash: [.55, 1], grow: .03, drift: .085, rise: .05, life: 1.7 };

export function portraitBreath(temp, bands, { x, y, color, last, danger }) {
  const { quality, nice, heat, breaths: raw } = smokeByTemp(temp, bands, { x, y, color, danger });
  // 本編のはじめは横向き（煙は顔の前へ出る）。縦の絵は正面向きなので、口元から少し右下へ吐き、顔の外へ出てから昇らせる（目元にかけない）。
  // 横への広がりは、いい煙ほど細くまとめ、熱すぎる煙は荒れたまま散らす
  const breaths = raw.map((s) => ({ ...s, angle: s.angle + 0.34, buoy: s.buoy * 0.35, speed: s.speed * 1.3, spread: quality === "harsh" ? s.spread : Math.min(s.spread, 0.34) }));
  if (last && quality === "best") breaths.push(...ringBreath({ ...SMOKE_RING, x: x + .035, y: y - .012, colors: [smokeTint(color, .08)], delay: 1.9 }));
  return { quality, nice, heat, breaths };
}
