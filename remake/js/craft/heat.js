// 炭焼き ── HEAT IGNITION（master_spec 第2部 §2）
// ゲージ停止ではなく、炭の見た目（黒→赤→赤熱→ピカン→白熱→灰かぶり）を観察して取る。
// ジャストの瞬間だけ、炭の芯そのものが一瞬光る。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown, flash } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshRig, tickerSay } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, popStamp } from "./common.js";
import { artImg } from "./art.js";

// 取り上げた瞬間の状態 → 性能（spec の数値例を6段階に拡張）
export const HEAT_GRADES = {
  raw: { label: "生焼け", stamp: "CORE BLACK", kind: "bad", score: 15, hp: -35, hs: -20, su: -30, br: -15, ar: 0 },
  early: { label: "早取り", stamp: "CORE BLACK", kind: "miss", score: 45, hp: -20, hs: -10, su: -20, br: -15, ar: 10 },
  pre: { label: "適温前", stamp: "赤熱一閃", kind: "good", score: 78, hp: 0, hs: 12, su: -5, br: -8, ar: 14 },
  just: { label: "ジャスト", stamp: "JUST IGNITION!!", kind: "just", score: 100, hp: 20, hs: 30, su: 15, br: 0, ar: 15 },
  hot: { label: "攻め焼き", stamp: "HOT!", kind: "good", score: 62, hp: 30, hs: 4, su: 22, br: 18, ar: -8 },
  over: { label: "焼きすぎ", stamp: "OVER HEAT", kind: "bad", score: 28, hp: 35, hs: -10, su: 25, br: 30, ar: -20 },
};

/** 経過比 p（1.0 でジャスト開始）と、ジャストの幅 jw から状態を返す */
function phaseOf(p, jw) {
  if (p < 0.35) return "raw";
  if (p < 0.7) return "early";
  if (p < 1) return "pre";
  if (p < 1 + jw) return "just";
  if (p < 1.3 + jw) return "hot";
  return "over";
}

export async function runHeat(cs) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel("heat", "炭焼き ── HEAT IGNITION", "炭の色をよく見て。芯が一瞬ピカッと光ったら、その炭をタップして取り上げる");
  const cube = cs.equip?.charcoal === "cube_charcoal";
  const img = (st) => (cube ? `coal_${st}.png` : `coal_flat_${st}.png`);
  const justSec = 0.5 * skill.window() * (tutorial ? 1.5 : 1);
  const clarity = skill.clarity();

  const stove = el("div.stove", [artImg("stove_coil.png", 520, "stove-img")]);
  // コイルの上に三角に並べる（中心座標はコンロ素材の中身に対する比。奥の炭ほど少し小さい）
  const SPOTS = [[0.35, 0.45, 1], [0.62, 0.34, 0.9], [0.6, 0.62, 1.06]]
    .map(([x, y, k]) => [0.5 + (x - 0.5) * 0.8, 0.45 + (y - 0.45) * 0.8, k]); // 寸法を保ち、コイルの中央へ20%寄せる
  const coals = [0, 1, 2].map((i) => {
    const [cx, cy, k] = SPOTS[i];
    const node = el("button.coal", {
      dataset: { test: `coal-${i}` },
      style: { left: `${cx * 100}%`, top: `${cy * 100}%`, "--k": String(k), zIndex: String(Math.round(cy * 10)) },
    }, [
      artImg(img("cold"), 118, "c-cold"),
      artImg(img("red"), 118, "c-red"),
      artImg(img("just"), 118, "c-hot"),
      artImg(img("white"), 118, "c-ash"),
      el("i.c-core"),
      el("i.c-burst"),
    ]);
    stove.append(node);
    return {
      node,
      tj: rand(4.2, 7.4) * (tutorial ? 1.25 : 1), // ジャストまでの秒数（炭ごとに焼けるスピードが違う）
      picked: null,
      p: 0,
    };
  });
  const info = el("div.heat-info", [
    el("div.hi-row", [el("b", { text: "見極め" }), el("span", { text: "黒い芯 → 端から赤 → 全体が赤熱 → 芯が光る（ここ）→ 白っぽく → 灰かぶり" })]),
  ]);
  panel.append(el("div.heat", [stove, info]));

  let t0 = 0;
  let raf = 0;
  let finished = false;
  let done;
  const finishedP = new Promise((r) => { done = r; });

  const pick = (c) => {
    if (c.picked || finished || !t0) return;
    const jw = justSec / c.tj;
    const g = phaseOf(c.p, jw);
    c.picked = g;
    const G = HEAT_GRADES[g];
    c.node.classList.add("picked", `g-${g}`);
    popStamp(panel, G.stamp, G.kind, `${22 + coals.indexOf(c) * 22}%`, "28%");
    if (g === "just") { SE.just(); flash("gold"); tickerSay("パッキー「出たーッ！ EXCELLENT！ 芯まで焼けたーッ！」"); }
    else if (g === "pre" || g === "hot") SE.good();
    else SE.miss();
    SE.coalSnip();
    if (coals.every((x) => x.picked)) finish();
  };

  const loop = (now) => {
    if (finished) return;
    const t = (now - t0) / 1000;
    for (const c of coals) {
      if (c.picked) continue;
      c.p = t / c.tj;
      const jw = justSec / c.tj;
      const ph = phaseOf(c.p, jw);
      const n = c.node;
      // 見た目: 素材の重ね合わせで色を移ろわせる
      const red = clamp((c.p - 0.3) / 0.45, 0, 1);
      const hot = clamp((c.p - 0.85) / 0.3, 0, 1);
      const ash = clamp((c.p - (1.15 + jw)) / 0.35, 0, 1);
      n.style.setProperty("--red", red.toFixed(3));
      n.style.setProperty("--hot", hot.toFixed(3));
      n.style.setProperty("--ash", ash.toFixed(3));
      n.dataset.phase = ph;
      // 洞察★: ジャスト直前にかすかな揺らぎ（読みやすさ）
      n.classList.toggle("soon", clarity > 0 && ph === "pre" && c.p > 1 - 0.1 * clarity);
      if (ph === "just" && !n.classList.contains("pikan")) { n.classList.add("pikan"); SE.tick(); }
      if (ph !== "just") n.classList.remove("pikan");
      if (c.p > 1.75) pick(c); // 放っておくと灰になって勝手に落ちる
    }
    raf = requestAnimationFrame(loop);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    done();
  };

  coals.forEach((c) => c.node.addEventListener("pointerdown", (e) => { e.preventDefault(); pick(c); }));

  await countdown();
  SE.crackle();
  t0 = performance.now();
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) {
    (async () => {
      for (const c of coals) {
        // 上手=ジャストの真ん中／下手=早取りか焼きすぎ
        const target = auto === "good" ? c.tj * (1 + (justSec / c.tj) / 2) : c.tj * (Math.random() < 0.5 ? 0.55 : 1.55);
        const shift = target - (performance.now() - t0) / 1000;
        t0 -= Math.max(0, shift) * 1000;
        c.p = target / c.tj;
        pick(c);
        await sleep(40);
      }
    })();
  }
  await finishedP;

  const picks = coals.map((c) => c.picked);
  const avg = (k) => picks.reduce((s, g) => s + HEAT_GRADES[g][k], 0) / picks.length;
  const score = Math.round(avg("score"));
  const res = {
    score, grade: gradeOf(score), picks,
    just: picks.filter((g) => g === "just").length,
    early: picks.filter((g) => g === "raw" || g === "early").length,
    over: picks.filter((g) => g === "over").length,
    heatPower: clamp(50 + avg("hp"), 0, 100),
    heatStability: clamp(50 + avg("hs"), 0, 100),
    startup: clamp(50 + avg("su"), 0, 100),
    burnRisk: clamp(30 + avg("br"), 0, 100),
    aromaRetention: clamp(55 + avg("ar"), 0, 100),
    flash: picks.includes("just"),
  };
  cs.heat = res;
  refreshRig();
  await sleep(350);
  if (res.heatStability >= 70) popStamp(panel, "HEAT STABLE", "good", "50%", "60%");
  if (res.aromaRetention >= 68) popStamp(panel, "AROMA KEEP", "good", "50%", "70%");
  await resultCard(panel, {
    title: "炭焼き 結果",
    grade: res.grade,
    lines: [
      picks.map((g) => HEAT_GRADES[g].label).join("・"),
      res.just === 3 ? "三つとも芯が光った瞬間に取れた。火が素直だ" : res.just ? "光った瞬間を掴めた炭がある" : "光る瞬間を逃した。火力が読みにくい",
      res.over ? "焼きすぎの炭がある。香りが飛びやすいかもしれない" : res.early ? "早取りの炭がある。立ち上がりが遅れそうだ" : "",
    ],
  });
}
