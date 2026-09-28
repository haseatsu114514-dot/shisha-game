// アルミ穴あけ ── HOLE RHYTHM BATTLE（master_spec 第2部 §1）
// 円周を回るカーソルがリング上の「理想の位置」に重なった瞬間に打つと PERFECT。
// メイン評価は均等度。穴数・リング配置は後工程の性能（抜け・熱の広がり・焦げ）に効く。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshRig, tickerSay } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";

// 外周=熱拡散・安定／中周=ドロー・煙量／内周=抜け・攻め（焦げリスク）
export const RINGS = [
  { id: "outer", label: "外周", r: 0.8, targets: 12, period: 6.4, weight: 0.5, role: "熱の広がり・安定感" },
  { id: "middle", label: "中周", r: 0.54, targets: 8, period: 5.2, weight: 0.3, role: "ドロー・煙量" },
  { id: "inner", label: "内周", r: 0.28, targets: 4, period: 3.8, weight: 0.2, role: "抜け感（開けすぎ注意）" },
];
const TIME_LIMIT = 32;
const DEG = Math.PI / 180;

export async function runHoles(cs) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel("holes", "アルミ穴あけ ── HOLE RHYTHM", "カーソルが光る目印に重なった瞬間にタップ（Space）。均等に並ぶほど高評価");
  const slow = skill.slow() * (tutorial ? 1.3 : 1);
  const perfWin = 4.2 * skill.window() * (tutorial ? 1.5 : 1);
  const goodWin = 11 * (tutorial ? 1.3 : 1);
  const limit = tutorial ? 48 : TIME_LIMIT;

  // ---- 画面
  const D = 430;
  const disc = el("div.foil", { style: { width: `${D}px`, height: `${D}px` }, dataset: { test: "foil" } });
  const ringEls = RINGS.map((rg) => el("div.foil-ring", { style: { width: `${rg.r * 100}%`, height: `${rg.r * 100}%` }, dataset: { ring: rg.id } }));
  const markers = el("div.foil-markers");
  const holesLayer = el("div.foil-holes");
  const cursor = el("div.foil-cursor");
  disc.append(...ringEls, markers, holesLayer, cursor);
  const ringLabel = el("div.hr-ring");
  const timeBar = el("i.hr-time-bar", [el("b")]);
  const scoreEl = el("div.hr-score");
  const comboEl = el("div.hr-combo");
  const role = el("div.hr-role");
  const punchBtn = el("button.btn.primary.hr-punch", { dataset: { test: "hole-punch" } }, [el("span.btn-label", { text: "穴を開ける" })]);
  const nextBtn = el("button.btn.small", { text: "次のリングへ", dataset: { test: "hole-next" } });
  const doneBtn = el("button.btn.small.ghost", { text: "完成", dataset: { test: "hole-done" } });
  panel.append(el("div.holes", [
    el("div.hr-stage", [disc]),
    el("div.hr-side", [ringLabel, role, el("div.hr-time", [el("span", { text: "TIME" }), timeBar]), scoreEl, comboEl, punchBtn, el("div.hr-row", [nextBtn, doneBtn])]),
  ]));

  // ---- 状態
  const state = RINGS.map((rg) => ({
    ...rg,
    phase: rand(0, Math.PI * 2),
    taken: new Array(rg.targets).fill(false),
    holes: [], // {a, d}
    extra: 0,
  }));
  let ri = 0;
  let t0 = 0;
  let elapsed = 0;
  let score = 0;
  let combo = 0;
  const tally = { perfect: 0, good: 0, miss: 0, tooClose: 0, blank: 0, tooMany: 0 };
  let finished = false;
  let raf = 0;

  const targetAngle = (ring, k) => ring.phase + (k * 2 * Math.PI) / ring.targets;
  const cursorAngle = () => {
    const ring = state[ri];
    return ring.phase + ((2 * Math.PI) * elapsed) / (ring.period * slow);
  };
  const posOf = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  const place = (node, a, r) => {
    const [x, y] = posOf(a, r);
    node.style.left = `${50 + x * 50}%`;
    node.style.top = `${50 + y * 50}%`;
  };
  const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

  const drawMarkers = () => {
    markers.replaceChildren();
    state.forEach((ring, idx) => {
      ring.taken.forEach((tk, k) => {
        if (tk) return;
        const m = el(`i.foil-marker${idx === ri ? ".cur" : ""}`);
        place(m, targetAngle(ring, k), ring.r);
        markers.append(m);
      });
    });
    ringEls.forEach((e, idx) => e.classList.toggle("cur", idx === ri));
    ringLabel.textContent = `${state[ri].label}（${state[ri].taken.filter(Boolean).length}/${state[ri].targets}）`;
    role.textContent = state[ri].role;
  };
  const addHoleDot = (a, r, kind) => {
    const h = el(`i.foil-hole.${kind}`);
    place(h, a, r);
    holesLayer.append(h);
  };
  const hud = () => {
    scoreEl.textContent = `SCORE ${score}`;
    comboEl.textContent = combo >= 2 ? `${combo} COMBO` : "";
  };

  const closeRing = (ring) => {
    if (ring.closed) return;
    ring.closed = true;
    const left = ring.taken.filter((x) => !x).length;
    tally.blank += left;
    return left;
  };
  const advanceRing = () => {
    if (finished) return;
    if (closeRing(state[ri])) popStamp(panel, "BLANK SPACE", "miss", "36%", "30%");
    if (ri < state.length - 1) { ri++; drawMarkers(); SE.whoosh(); }
    else finish();
  };

  const punch = () => {
    if (finished || !t0) return;
    const ring = state[ri];
    const a = cursorAngle();
    SE.punch();
    // 一番近い「まだ開けていない目印」
    let best = -1, bestD = Infinity;
    ring.taken.forEach((tk, k) => {
      const d = angDiff(a, targetAngle(ring, k));
      if (!tk && d < bestD) { bestD = d; best = k; }
    });
    const dDeg = bestD / DEG;
    // 既に開けた穴のすぐ隣か
    const near = ring.holes.some((h) => angDiff(h.a, a) / DEG < goodWin * 0.8);
    let kind;
    if (best >= 0 && dDeg <= perfWin) kind = "perfect";
    else if (best >= 0 && dDeg <= goodWin) kind = "good";
    else if (near) kind = "close";
    else kind = "miss";
    if (kind === "perfect" || kind === "good") {
      ring.taken[best] = true;
      ring.holes.push({ a, d: dDeg });
      tally[kind]++;
      combo++;
      score += kind === "perfect" ? 120 + combo * 10 : 60;
      popStamp(panel, kind === "perfect" ? "PERFECT" : "GOOD", kind, "36%", "18%");
      kind === "perfect" ? SE.perfect() : SE.good();
    } else {
      ring.holes.push({ a, d: goodWin * 1.5 });
      ring.extra++;
      combo = 0;
      if (kind === "close") { tally.tooClose++; popStamp(panel, "TOO CLOSE", "bad", "36%", "18%"); }
      else { tally.miss++; popStamp(panel, "ズレた…", "miss", "36%", "18%"); }
      if (ring.id === "inner") { tally.tooMany++; popStamp(panel, "RISKY", "bad", "36%", "30%"); }
      SE.miss();
    }
    addHoleDot(a, ring.r, kind);
    if (ring.taken.every(Boolean)) {
      const clean = ring.holes.every((h) => h.d <= perfWin) && ring.extra === 0;
      popStamp(panel, clean ? "BEAUTIFUL RING" : "RING COMPLETE", "just", "36%", "44%");
      if (ring.id === "middle") popStamp(panel, "AIR FLOW UP", "good", "36%", "56%");
      SE.just();
      tickerSay(clean ? "パッキー「きれいに揃ったーッ！ 見てくださいこの輪！」" : "パッキー「リング完成！ 手が止まりませんね〜♪」");
      setTimeout(advanceRing, 350);
    }
    drawMarkers();
    hud();
  };

  const loop = (now) => {
    if (finished) return;
    elapsed = (now - t0) / 1000;
    const a = cursorAngle();
    place(cursor, a, state[ri].r);
    timeBar.querySelector("b").style.width = `${clamp(100 - (elapsed / limit) * 100, 0, 100)}%`;
    if (elapsed >= limit) return finish();
    raf = requestAnimationFrame(loop);
  };

  let done;
  const finishedP = new Promise((r) => { done = r; });
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    unkey();
    state.forEach(closeRing);
    done();
  };

  // ---- 入力
  disc.addEventListener("pointerdown", (e) => { e.preventDefault(); punch(); });
  punchBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); punch(); });
  nextBtn.addEventListener("click", advanceRing);
  doneBtn.addEventListener("click", finish);
  const unkey = keys({ " ": punch, Space: punch, Enter: finish });

  drawMarkers();
  hud();
  place(cursor, state[0].phase, state[0].r);
  await countdown();
  t0 = performance.now();
  raf = requestAnimationFrame(loop);

  const auto = autoSkill();
  if (auto) simulate(auto);
  await finishedP;

  // ---- 採点（均等度50/円形精度20/穴サイズ15/リング完成10/残り時間5）
  const res = evaluate(state, tally, Math.max(0, limit - elapsed) / limit, goodWin);
  cs.holes = res;
  refreshRig();
  await sleep(300);
  await resultCard(panel, {
    title: "穴あけ 結果",
    grade: res.grade,
    lines: [
      `均等度 ${Math.round(res.evenness * 100)}%　／　円形精度 ${Math.round(res.precision * 100)}%`,
      `外周 ${res.outer}・中周 ${res.middle}・内周 ${res.inner}（計 ${res.total} 穴）`,
      res.innerExcess ? "内周を開けすぎた。焦げやすくなるかもしれない" : res.outerEven > 0.8 ? "外周がきれいに揃った。熱が全体に回りそうだ" : "",
      tally.blank ? `開け残し ${tally.blank} か所（BLANK SPACE）` : "",
    ],
  });

  // 自動操作（テスト）: 次に回ってくる目印の時刻まで時計を進めて打つ（上手=ぴったり／下手=ズレる＋開け残す）
  function simulate(level) {
    (async () => {
      await sleep(80);
      while (!finished) {
        const ring = state[ri];
        if (ring.taken.every(Boolean) || (level === "bad" && ring.taken.filter(Boolean).length >= Math.ceil(ring.targets * 0.55))) {
          if (!ring.taken.every(Boolean)) advanceRing();
          await sleep(level === "bad" ? 30 : 400);
          continue;
        }
        const omega = (2 * Math.PI) / (ring.period * slow);
        const err = level === "good" ? 0 : rand(5, 10) * DEG;
        const cur = (omega * elapsed) % (2 * Math.PI);
        let wait = Infinity;
        ring.taken.forEach((tk, k) => {
          if (tk) return;
          const want = ((2 * Math.PI * k) / ring.targets + err) % (2 * Math.PI);
          wait = Math.min(wait, ((want - cur + 4 * Math.PI) % (2 * Math.PI)) / omega);
        });
        t0 -= wait * 1000;
        elapsed += wait;
        punch();
        await sleep(25);
      }
    })();
  }
}

export function evaluate(rings, tally, timeRatio, goodWin) {
  const per = rings.map((ring) => {
    const angles = ring.holes.map((h) => h.a).sort((a, b) => a - b);
    const n = angles.length;
    let even = 0;
    if (n >= 2) {
      const gaps = angles.map((a, i) => (i === n - 1 ? angles[0] + 2 * Math.PI - a : angles[i + 1] - a));
      const ideal = (2 * Math.PI) / ring.targets;
      const dev = Math.sqrt(gaps.reduce((s, g) => s + (g - ideal) ** 2, 0) / n) / ideal;
      even = clamp(1 - dev * 1.1, 0, 1);
    }
    const acc = ring.holes.length ? ring.holes.reduce((s, h) => s + clamp(1 - h.d / goodWin, 0, 1), 0) / ring.holes.length : 0;
    return { id: ring.id, count: n, even, acc, taken: ring.taken.filter(Boolean).length, targets: ring.targets, extra: ring.extra };
  });
  const w = Object.fromEntries(rings.map((r) => [r.id, r.weight]));
  const evenness = per.reduce((s, p) => s + p.even * w[p.id], 0);
  const precision = per.reduce((s, p) => s + p.acc * w[p.id], 0);
  const completion = per.reduce((s, p) => s + p.taken, 0) / per.reduce((s, p) => s + p.targets, 0);
  const sizeStab = clamp(0.92 - tally.tooClose * 0.08 - tally.miss * 0.03, 0.4, 1);
  const score = Math.round(100 * (evenness * 0.5 + precision * 0.2 + sizeStab * 0.15 + completion * 0.1 + clamp(timeRatio * 2.5, 0, 1) * 0.05));
  const get = (id) => per.find((p) => p.id === id);
  const total = per.reduce((s, p) => s + p.count, 0);
  const innerExcess = Math.max(0, get("inner").count - 4);
  // リグの絵に使う穴の位置（アルミを斜めから見た楕円に落とす）
  const dots = rings.flatMap((ring) => ring.holes.map((h) => [Math.cos(h.a) * ring.r, Math.sin(h.a) * ring.r * 0.34]));
  return {
    score, grade: gradeOf(score), evenness, precision, completion, sizeStab, timeRatio,
    outer: get("outer").count, middle: get("middle").count, inner: get("inner").count, total, innerExcess,
    outerEven: get("outer").even, tally: { ...tally }, dots,
  };
}
