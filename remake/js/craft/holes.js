// アルミ穴あけ ── HOLE RHYTHM BATTLE（master_spec 第2部 §1）
// 円周を回るカーソルが目印に重なった瞬間に打つと EXCELLENT。外周一周の後は穴数を選べる。
// メイン評価は均等度。穴数・リング配置は後工程の性能（抜け・熱の広がり・焦げ）に効く。
import { el, sleep, clamp, rand } from "../core/util.js";
import { countdown } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { stepPanel, refreshRig, tickerSay } from "./session.js";
import { gradeOf, autoSkill, skill, resultCard, keys, popStamp } from "./common.js";

// 外周=熱拡散・安定／中周=ドロー・煙量／内周=抜け・攻め（焦げリスク）
import { RINGS, circularAngleDistance, minimumRingComplete, evaluateFoil } from "./holes_logic.js";
export { RINGS } from "./holes_logic.js";
const TIME_LIMIT = 32;
const DEG = Math.PI / 180;

export async function runHoles(cs) {
  const tutorial = cs.mode === "tutorial";
  const panel = stepPanel("holes", "アルミ穴あけ ── HOLE RHYTHM", "まず外周を一周。光る目印でタップ（Space）。その後は好きな穴数で仕上げられる");
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
  const plan = el("div.hr-plan", { dataset: { test: "hole-plan" } });
  const punchBtn = el("button.btn.primary.hr-punch", { dataset: { test: "hole-punch" } }, [el("span.btn-label", { text: "穴を開ける" })]);
  const nextBtn = el("button.btn.small", { text: "次のリングへ", dataset: { test: "hole-next" } });
  const doneBtn = el("button.btn.small.ghost", { text: "この穴数で仕上げる", dataset: { test: "hole-done" } });
  panel.append(el("div.holes", [
    el("div.hr-stage", [disc]),
    el("div.hr-side", [ringLabel, role, el("div.hr-time", [el("span", { text: "TIME" }), timeBar]), scoreEl, comboEl, plan, punchBtn, el("div.hr-row", [nextBtn, doneBtn])]),
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
  let t0 = null;
  let elapsed = 0;
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
  const angDiff = circularAngleDistance;
  const minimumComplete = () => minimumRingComplete(state);

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
    scoreEl.textContent = `EXCELLENT ${tally.perfect} · GOOD ${tally.good} · MISS ${tally.miss + tally.tooClose}`;
    comboEl.textContent = combo >= 2 ? `${combo} COMBO` : "";
    const ready = minimumComplete();
    punchBtn.disabled = finished || state[ri].taken.every(Boolean);
    nextBtn.disabled = finished || !ready || ri === state.length - 1;
    doneBtn.disabled = finished || !ready;
    plan.textContent = !ready ? elapsed >= limit ? "時間0｜外周の1周を完成させよう" : "外周の12か所を開けて、まず1周を完成させよう"
      : "外周1周が完成。次のリングを開けるか、この穴数で仕上げられる";
  };

  const closeRing = (ring) => {
    if (ring.closed) return;
    ring.closed = true;
    const left = ring.taken.filter((x) => !x).length;
    tally.blank += left;
    return left;
  };
  const advanceRing = () => {
    if (finished || !minimumComplete()) return;
    closeRing(state[ri]);
    if (ri < state.length - 1) { ri++; drawMarkers(); hud(); place(cursor, cursorAngle(), state[ri].r); SE.whoosh(); }
    else finish();
  };

  const punch = () => {
    if (finished || t0 === null) return;
    const ring = state[ri];
    if (ring.closed || ring.taken.every(Boolean)) return;
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
      popStamp(panel, kind === "perfect" ? "EXCELLENT" : "GOOD", kind, "36%", "18%");
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
      // 自動送りはしない。完成したリングは入力を止め、次のリングか仕上げを選んでもらう。
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
    if (elapsed >= limit && minimumComplete()) return finish();
    hud();
    raf = requestAnimationFrame(loop);
  };

  let done;
  const finishedP = new Promise((r) => { done = r; });
  const finish = () => {
    if (finished || !minimumComplete()) return;
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

  // ---- 採点（実穴の均等度50/タイミング精度30/穴サイズ15/残り時間5。穴数そのものは減点しない）
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
      res.total < 24 ? "穴を控えめに仕上げた。吸い出しでは温度の動きをよく見よう" : "",
    ],
  });

  // 自動操作（テスト）: 次に回ってくる目印の時刻まで時計を進めて打つ（上手=ぴったり／下手=ズレる＋開け残す）
  function simulate(level) {
    (async () => {
      await sleep(80);
      while (!finished) {
        const ring = state[ri];
        if (ring.taken.every(Boolean) || (level === "bad" && ri > 0 && ring.taken.filter(Boolean).length >= Math.ceil(ring.targets * 0.55))) {
          advanceRing();
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
  const result = evaluateFoil(rings, tally, timeRatio, goodWin);
  return { ...result, grade: gradeOf(result.score) };
}
