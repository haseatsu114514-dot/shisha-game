// シーシャくじのガラガラ（福引きの回転抽選器）。店のカウンターに置いた木と黒い鉄の抽選器を正面から見せ、
// ハンドルを一度引いてから回す。止まると胴の右下の小さな蓋から賞の色の玉が出て、受け皿へ落ち、弾んで止まる。
// 玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白・ラストワン＝黒地に銀の輪）。終わると kuji-reveal.js が賞の札を出す。
//
// 2026-11-11 オーナー「ソシャゲのガチャや10連ガチャみたいなリッチな演出に」→「CSS感がすごい・祭り感が店に合わない」:
// - 舞台は今いる店の中（motions/garagara-stage.js）。道具は1つずつ別の部品で、描いた絵（kuji-art.js）に差し替えられる。
// - 回すあいだ火花が散り、上位の賞は玉が出る前に「溜め」が入る（暗くなって蓋から賞の色の光が漏れる）。
// - 玉が受け皿に落ちると賞の色の光の輪・きらめき。S賞とラストワン賞は光の柱と紙吹雪、係の人の鐘。
// - 連続で引くと（ranks を配列で渡す）、玉が次々に出て手前の玉置きに並ぶ。並んだ色が結果の予告になる。
// - 右下の SKIP で演出を飛ばせる。動きを減らす設定では、止まった抽選器と玉だけを短く見せる。
// 2026-11-11 オーナー「くじのランクによってガラガラの見た目を変えたり豪華に」「抽選演出豪華にしたい」（GCH16・GCH17）:
// - 抽選器は店のくじごとに素材が変わる（kuji-art.js の KUJI_LOOKS。上の店ほど豪華で、灯りの中のほこり・きらめき・後ろの光も増える）。
// - 登場で天井の灯りが点き、回すと抽選器の後ろに光の筋（後光）が差して、速いほど明るく回る。胴には回転の残像。
// - 止まると蓋が白く光り、賞が上がるたびに青 → 赤 → 金（→ ラストワンは銀紫）と一段ずつ色が上がる（何段まで上がるかで賞が分かる）。
// - A賞以上の玉はゆっくり飛び、S賞・ラストワン賞は受け皿に落ちた瞬間に一瞬止まって、皿の後ろから賞の色の光が広がる。
// - 連続では、S賞・ラストワン賞の玉が出る瞬間だけ全体がゆっくりになり、蓋へ寄る。
// 動かすのは部品の位置・回転・濃さ（CSS の変形）だけで、絵は描き直さない。動きは1本の requestAnimationFrame で時刻から決める。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { svg, reducedMotion, calmFlash, H } from "../core/transition-kit.js";
import { stageParts, ballPart, railPart, grad, BALL, RANK_LIGHT, SHOP, AX, AY, R, BALL_R, EXIT, LAND, REST } from "./garagara-stage.js";
import { artPart } from "./kuji-art.js";
import { createFx } from "./kuji-fx.js";

export { BALL };

// 時刻（ms）。登場 → ためて引く → 2.6回転 → 止まる →（上位は溜め）→ 玉が出る → 受け皿 → 止まる → 札へ
const T = { ant: 300, spin: 580, stop: 2060, pop: 2330, out: 2420, land: 2760, rest: 3380, accent: 3280, fade: 3800, end: 4140 };
const HOLD_AT = T.stop + 150; // 溜めを入れる時刻（胴が止まった直後）
const TURN = 936; // 回す角度（2.6回転）
const PULL = 22; // ハンドルを引く角度
const HANDLE_AT = 148; // 止まったときのハンドルの向き（度。左下）

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const outCubic = (k) => 1 - (1 - k) ** 3;
const outQuart = (k) => 1 - (1 - k) ** 4;
const inOutSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const seg = (t, a, b) => clamp((t - a) / (b - a));

/** 回転の速さの山（立ち上がりは速く、止まり際は摩擦のように長く）。0〜1 の進み具合の表 */
const SPIN_TABLE = (() => {
  const n = 400, out = [0];
  let s = 0;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const v = (k < 0.18 ? Math.sin((Math.PI / 2) * (k / 0.18)) ** 2 : 1) * (k < 0.36 ? 1 : (1 - (k - 0.36) / 0.64) ** 1.7);
    s += v; out.push(s);
  }
  return out.map((v) => v / s);
})();
const spinAt = (k) => { const f = clamp(k) * (SPIN_TABLE.length - 1), i = Math.floor(f); return i >= SPIN_TABLE.length - 1 ? 1 : lerp(SPIN_TABLE[i], SPIN_TABLE[i + 1], f - i); };

/** 時刻 t（ms）の胴の角度（1回引き）。ためて引く → 回す → 止まり際に揺れ戻る → 玉が抜けて小さく揺れる */
function angleAt(t) {
  const start = -TURN;
  if (t < T.ant) return start;
  if (t < T.spin) return start - PULL * inOutSine(seg(t, T.ant, T.spin));
  if (t < T.stop) return start - PULL + (TURN + PULL) * spinAt(seg(t, T.spin, T.stop));
  const d = t - T.stop;
  const settle = -6 * Math.exp(-d / 110) * Math.sin((2 * Math.PI * d) / 240);
  const jolt = t > T.pop ? -2.2 * Math.exp(-(t - T.pop) / 120) * Math.sin((2 * Math.PI * (t - T.pop)) / 200) : 0;
  return settle + jolt;
}

/**
 * 実際の時刻と演出の時刻の対応（折れ線）。marks は演出の時刻の順に [始まり, 終わり, 速さ] か [時刻, 時刻, 0, 止める長さms]。
 * 速さ 0.5 ならその区間を半分の速さで進め、止める区間では演出の時刻が進まない。at(実際) → 演出、real(演出) → 実際（止める区間は終わり側）。
 */
function timeWarp(marks) {
  const pts = [[0, 0]], slows = [];
  let real = 0, tm = 0;
  for (const [a, b, rate, ms = 0] of marks) {
    if (a < tm) continue; // 重なる区間は先のものを優先
    real += a - tm;
    pts.push([real, a]);
    if (b > a && rate < 1) slows.push([real, real + (b - a) / rate]);
    real += b > a ? (b - a) / rate : ms;
    pts.push([real, b]);
    tm = b;
  }
  const walk = (v, from, to) => {
    for (let i = pts.length - 1; i >= 0; i--) {
      if (v < pts[i][from]) continue;
      const next = pts[i + 1];
      if (!next || next[from] === pts[i][from]) return (next || pts[i])[to] + (next ? 0 : v - pts[i][from]);
      return pts[i][to] + ((next[to] - pts[i][to]) * (v - pts[i][from])) / (next[from] - pts[i][from]);
    }
    return v;
  };
  return { at: (r) => walk(r, 0, 1), real: (t) => walk(t, 1, 0), slowAt: (r) => slows.some(([a, b]) => r >= a && r < b) };
}

// 玉が出る前の予告: 蓋の光が、賞が上がるたびに一段ずつ色を上げる（白 → 青 → 赤 → 金 → 銀紫）。何段まで上がるかで賞が分かる
const STEPS = { C: [], B: ["B"], A: ["B", "A"], S: ["B", "A", "S"], LAST: ["B", "A", "S", "LAST"] };
const STEP_MS = 300, STEP_TOP_MS = 620; // 一段の長さ。S賞・ラストワン賞の最後の一段は長く溜める

/** 係の人の手持ちの鐘の下絵（真鍮の鐘に木の柄）。箱 140×300、柄の上が手首 */
function bellSketch() {
  const C = SHOP, defs = svg("defs");
  const wood = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.wood0], [0.35, C.wood3], [0.75, C.wood1], [1, C.wood0]]);
  const metal = grad(defs, "linearGradient", { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, C.brass0], [0.28, C.brass2], [0.5, C.brass1], [0.82, C.brass0], [1, C.brass0]]);
  const MY = 268;
  return svg("svg", { viewBox: "-70 0 140 300", class: "kj-sketch" }, [defs,
    svg("path", { d: "M -8 0 L -8 110 C -12 126, -12 142, -8 154 L 8 154 C 12 142, 12 126, 8 110 L 8 0 Z", fill: wood }),
    svg("rect", { x: -11, y: 154, width: 22, height: 10, rx: 2, fill: metal }),
    svg("path", { d: `M -18 164 C -30 164, -32 174, -33 190 C -34 222, -40 248, -56 ${MY} L 56 ${MY} C 40 248, 34 222, 33 190 C 32 174, 30 164, 18 164 Z`, fill: metal }),
    svg("path", { d: `M -48 ${MY - 14} C -20 ${MY - 8}, 20 ${MY - 8}, 48 ${MY - 14}`, fill: "none", stroke: C.brass0, "stroke-width": 1.5, "stroke-opacity": 0.7 }),
    svg("ellipse", { cx: 0, cy: MY, rx: 56, ry: 11, fill: C.brass0 }),
    svg("circle", { cx: 4, cy: MY + 2, r: 7.5, fill: C.wood0 }),
    svg("ellipse", { cx: 0, cy: MY, rx: 56, ry: 11, fill: "none", stroke: C.brass2, "stroke-width": 2.2 }),
  ]);
}

// 鐘の出番の長さ（ms）。手で下ろす → 振る → 上げる
const BELL = { down: 280, ring: 700, up: 320 };
const BELL_X = 1010, BELL_Y = -70; // 手首の位置（柄の上は画面の外）

const isTop = (r) => r === "S" || r === "LAST";
// 賞ごとの光の強さ（落ちた瞬間の染まり・そのあとの染まり・玉のにじみ）
const MOOD = { S: [1, 0.6, 1], LAST: [1, 0.6, 1], A: [0.8, 0.34, 0.8], B: [0.42, 0.14, 0.5], C: [0, 0, 0.22] };

/**
 * host に全面の層を置いてガラガラを回し、賞の玉を出す。終わると層を外す。
 * rankOrRanks が配列（2つ以上）なら連続で引く演出になり、玉が順に出て手前の玉置きに並ぶ。
 * onHandoff は消え始めに一度呼ぶ（くじの札を下で開いて、重ねながら受け渡す）。SKIP を押した時もすぐ呼ぶ。
 * 1回引きで "LAST"（ラストワン賞）のときは、黒板がラストワン賞の案内に変わり、最初に係の人が鐘を鳴らしてから回す。
 * 動きを減らす設定では、止まった抽選器と玉だけを短く見せる。
 * look はそのくじの抽選器の見た目（kuji-art.js の KUJI_LOOKS。上の店ほど豪華）、title は黒板に書くくじの名前。
 */
export async function garagara(host, rankOrRanks = "C", { onHandoff, look, title } = {}) {
  const ranks = (Array.isArray(rankOrRanks) ? rankOrRanks : [rankOrRanks]).map((r) => (BALL[r] ? r : "C"));
  const multi = ranks.length > 1;
  const reduced = reducedMotion();
  const calm = calmFlash();
  const rank = ranks[0];
  const last = !multi && rank === "LAST";
  const top = !multi && isTop(rank);
  const set = stageParts({ last, look, title });
  const balls = ranks.map((r) => ballPart(r));
  const rail = multi ? railPart(ranks.length) : null;
  const bell = artPart("bell", "kj-bell", bellSketch);
  // 抽選器の置き方: 1回引きは大きく、連続は手前の玉置きのぶん少し上へ小さく
  const ZOOM = multi ? 0.9 : 1.04, ZX = AX, ZY = 600, DX = multi ? 60 : 30, DY = multi ? -42 : -6;
  const lay = ([x, y]) => [ZX + (x - ZX) * ZOOM + DX, ZY + (y - ZY) * ZOOM + DY];
  const toLocal = ([x, y]) => [(x - DX - ZX) / ZOOM + ZX, (y - DY - ZY) / ZOOM + ZY];
  const machine = el("div.kj-machine", { style: { transformOrigin: `${ZX}px ${ZY}px`, transform: `translate(${DX}px, ${DY}px) scale(${ZOOM})` } },
    [...set.machine, ...balls.map((b) => b.node)]);
  set.placeLights(lay([AX, AY]), lay(REST), ZOOM);
  const cam = el("div.kj-cam", [...set.scene, ...set.lights, ...(rail ? [rail.node] : []), machine]);
  const flash = el("div.kj-flash", { "aria-hidden": "true" });
  let skipped = false;
  const skip = el("button.kj-skip", { type: "button", text: "SKIP", "aria-label": "演出をとばす", dataset: { test: "kuji-skip" },
    onclick: (e) => { e.stopPropagation(); skipped = true; SE.click(); } });
  const node = el("div.mo-garagara", { dataset: { motion: "garagara", mode: multi ? "multi" : "single", rank: last ? "LAST" : "", look: set.look } },
    [cam, ...set.overlays, bell, flash, ...(reduced ? [] : [skip])]);
  if (!reduced) node.style.opacity = "0";
  host.append(node);
  const fx = reduced ? null : createFx(node);
  if (fx) node.insertBefore(fx.canvas, flash);

  /** 玉を置く（抽選器の座標）。伸び縮みは玉の下端を支点に */
  const place = (ball, [x, y], sx = 1, sy = sx) => {
    ball.node.style.transform = `translate(${(x - 17).toFixed(1)}px, ${(y - 17 + BALL_R * (1 - sy)).toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  };
  const show = (ball, halo) => { ball.node.style.opacity = "1"; if (halo != null) ball.halo.style.opacity = halo.toFixed(3); };
  const turn = (th) => {
    set.drum.style.setProperty("--th", `${th.toFixed(2)}deg`);
    set.handle.style.transform = `rotate(${(th + HANDLE_AT).toFixed(2)}deg)`;
  };
  // 画面の座標（粒子はカメラの外の canvas に描くので、寄りを掛けた位置へ直す）
  let camSc = 1, camOx = AX, camOy = H / 2;
  const onScreen = (local) => { const [x, y] = lay(local); return [camOx + (x - camOx) * camSc, camOy + (y - camOy) * camSc]; };
  /** カメラ: (ox, oy) を中心に sc 倍 */
  const aim = (sc, ox, oy) => {
    camSc = sc; camOx = ox; camOy = oy;
    cam.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
    cam.style.transform = `scale(${sc.toFixed(4)})`;
  };
  const flashNow = (color, strength = 0.8, ms = 420) => {
    if (calm) return;
    flash.style.background = color;
    flash.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
  const poseBell = (x, y, ang) => { bell.style.transform = `translate(${(x - 70).toFixed(1)}px, ${y.toFixed(1)}px) rotate(${ang.toFixed(2)}deg)`; };
  const RAIL_SC = 17 / BALL_R; // 玉置きに並んだ玉の大きさ

  let raf = 0;
  try {
    turn(0);
    if (reduced) {
      if (multi) { rail.count(balls.length); balls.forEach((b, i) => { place(b, toLocal(rail.at(i)), RAIL_SC / ZOOM); show(b, MOOD[b.rank][2] * 0.6); }); }
      else { place(balls[0], REST); show(balls[0], MOOD[rank][2] * 0.6); }
      if (ranks.some(isTop)) { poseBell(BELL_X, BELL_Y, 0); bell.style.opacity = "1"; SE.just(); }
      await sleep(900);
      return;
    }
    // ここから先は時刻だけで決める（音と粒子は時刻を一度だけ越えたときに出す）
    const fired = new Set();
    const once = (key, at, t, fn) => { if (t >= at && !fired.has(key)) { fired.add(key); fn(); } };
    let prevTh = 0, prevT = 0, om = 0, rattle = 0, sparkAcc = 0, kickAt = -1e9, kickAmp = 0;
    const kick = (amp, now) => { if (!calm) { kickAt = now; kickAmp = amp; } };
    // 抽選器の豪華さ（0〜4。上の店ほど、灯りの中のほこり・金属のきらめき・後ろの光が増える）
    const lux = set.lux;
    const GLINT = { walnut: [SHOP.brass2, "#ffffff"], steel: ["#e6f0ff", "#ffffff"], brass: ["#ffe08a", "#ffffff"], marble: ["#fff3c2", "#ffffff", "#a8ffd8"], lacquer: ["#ffd76a", "#ffffff", "#e0a8ff"] }[set.look];
    fx.motes([GLINT[0], "#ffe9c4"], 4 + lux * 3);
    let auraDeg = 0, auraFlare = -1e9, auraTint = null, glintAcc = 0, landDeg = 0;
    /** 後ろの光・回転の残像・金属のきらめきを、回る速さ（om 度/秒）から決める。extra は場面ごとに足す明るさ */
    const ambience = (all, dms, extra = 0) => {
      const speed = clamp(Math.abs(om) / 900);
      const flare = Math.exp(-(all - auraFlare) / 480);
      auraDeg += dms * (0.006 + 0.05 * speed + 0.03 * flare);
      set.aura(clamp(smooth(seg(all, 140, 620)) * (0.08 + 0.06 * lux) + 0.7 * speed + extra + 0.6 * flare), auraDeg, 1 + 0.1 * speed + 0.16 * flare, auraTint || set.auraColor);
      set.blur(clamp((Math.abs(om) - 260) / 520) * 0.92);
      // 登場: 暗い所に天井の灯りが点く
      const lit = seg(all, 140, 420);
      set.spot(0.15 + 0.85 * smooth(lit));
      // 止まっているあいだも、金属がときどききらめく（上の店ほど頻繁に）
      if (lux > 0) {
        glintAcc += dms;
        const every = 1000 - lux * 170;
        while (glintAcc > every) {
          glintAcc -= every;
          const a = Math.random() * Math.PI * 2, far = Math.random() < 0.35;
          const [x, y] = onScreen(far ? [AX + (Math.random() - 0.5) * 240, AY + 150 + Math.random() * 130] : [AX + R * 0.96 * Math.cos(a), AY + R * 0.96 * Math.sin(a)]);
          fx.stars(x, y, { n: 1, colors: GLINT, rx: 6, ry: 6, size: [9, 16 + lux * 3], delay: 0 });
        }
      }
      return 0.5 * (1 - smooth(lit)); // 登場の暗がり
    };
    /** 灯りが点いた合図（上の店は、点いた瞬間に抽選器のまわりがきらめく） */
    const lightOn = () => {
      SE.kujiFlip();
      if (lux < 2) return;
      SE.kujiShimmer(2 + lux * 2);
      const [x, y] = onScreen([AX, AY + 60]);
      fx.stars(x, y, { n: lux * 4, colors: GLINT, rx: 250, ry: 260, size: [10, 24], delay: 0.5 });
    };
    /** 胴を角度 th に置き、速さから震え・ふちの火花・中の玉の音を出す */
    const spinDrum = (th, all, rise, rattling) => {
      const dt = Math.max(1, all - prevT);
      om = lerp(om, ((th - prevTh) / dt) * 1000, 0.35);
      rattle = rattling ? rattle + Math.abs(th - prevTh) : 0;
      prevTh = th; prevT = all;
      const tremor = clamp(Math.abs(om) / 700) * 1.3;
      const kd = all - kickAt, kk = kd < 400 ? kickAmp * Math.exp(-kd / 90) : 0;
      set.rig.style.transform = `translate(${(Math.sin(all * 0.09) * tremor + kk * Math.sin(kd * 0.085)).toFixed(2)}px, ${(rise + Math.cos(all * 0.13) * tremor * 0.6 + kk * Math.cos(kd * 0.11)).toFixed(2)}px)`;
      turn(th);
      if (rattle > 70) { rattle = 0; SE.crackle(); }
      sparkAcc += clamp((Math.abs(om) - 380) / 600) * dt * 0.04;
      while (sparkAcc >= 1) {
        sparkAcc -= 1;
        const a = Math.random() * Math.PI * 2, streak = Math.random() < 0.6;
        const [x, y] = onScreen([AX + R * Math.cos(a), AY + R * Math.sin(a)]);
        fx.burst(x, y, { n: 1, colors: [SHOP.brass2, "#ffffff", "#ffd27a"], kind: streak ? "streak" : "spark", speed: [180, 420], angle: a + (Math.PI / 2) * Math.sign(om || 1), spread: 0.4, gravity: 520, life: [0.2, 0.45], size: streak ? [1.4, 2.6] : [6, 13] });
      }
    };
    // 鐘（上位の賞で係の人が振る）。rings は鳴らし始める時刻（全体の時刻）
    const HZ = 5; // 振る速さ（往復/秒）
    const ringBell = (all, rings) => {
      for (let i = 0; i < rings.length; i++) {
        const d = all - rings[i];
        if (d < 0 || d > BELL.down + BELL.ring + BELL.up) continue;
        bell.style.opacity = "1";
        if (d < BELL.down) { // 手で下ろす（下ろし切る手前でゆるむ）
          const k = outCubic(d / BELL.down);
          poseBell(BELL_X, lerp(BELL_Y - 300, BELL_Y, k), -7 * (1 - k));
          return;
        }
        const r = d - BELL.down;
        if (r < BELL.ring) { // 手首で振る。振り始めと終わりは小さく
          const ph = 2 * Math.PI * HZ * (r / 1000), env = clamp(r / 90) * (1 - 0.35 * (r / BELL.ring));
          poseBell(BELL_X + 7 * Math.sin(ph + 0.5) * env, BELL_Y + 3 * Math.abs(Math.sin(ph)) * env, 19 * Math.sin(ph) * env);
          const hit = Math.floor((r / 1000) * HZ * 2 + 0.5); // 振り切るたびに舌が当たる
          if (hit % 2 === 1) once(`bell${i}-${hit}`, 0, 1, () => (hit === 1 ? SE.just : SE.reelWin)());
          return;
        }
        const k = inOutSine((r - BELL.ring) / BELL.up); // 上げる
        poseBell(BELL_X, lerp(BELL_Y, BELL_Y - 320, k), 4 * (1 - k) * Math.sin(k * 6));
        return;
      }
      bell.style.opacity = "0";
    };
    const handoff = () => { if (onHandoff) once("handoff", 0, 1, onHandoff); };
    const OUT = [EXIT[0] + 12, EXIT[1] + 10]; // 蓋から押し出された位置

    // ---- 1回引き ----
    const playSingle = () => new Promise((resolve) => {
      const ball = balls[0], light = ball.light, mood = MOOD[rank];
      const OFF = last ? 760 : 0; // ラストワンは先に鐘を鳴らすぶん遅らせる
      // 玉が出る前の予告（蓋の光が一段ずつ色を上げる）。steps[i] は i 段目の賞、stepAt[i] は溜めの始まりからの時刻
      const steps = STEPS[rank];
      const stepMs = steps.map((_, i) => (top && i === steps.length - 1 ? STEP_TOP_MS : STEP_MS));
      const stepAt = stepMs.map((_, i) => stepMs.slice(0, i).reduce((sum, ms) => sum + ms, 0));
      const HOLD = stepMs.reduce((sum, ms) => sum + ms, 0); // 玉が出る前の溜め
      // 時刻の進み: 溜めで止まり、A賞以上の玉はゆっくり飛び、S賞・ラストワン賞は受け皿に落ちた瞬間に一瞬止まる
      const warp = timeWarp([
        ...(HOLD ? [[HOLD_AT, HOLD_AT, 0, HOLD]] : []),
        ...(top || rank === "A" ? [[T.out, T.land, top ? 0.5 : 0.72]] : []),
        ...(top ? [[T.land, T.land, 0, 90]] : []),
      ]);
      const hops = [
        { t0: T.land, t1: T.land + 170, h: 24 },
        { t0: T.land + 170, t1: T.land + 280, h: 9 },
        { t0: T.land + 280, t1: T.land + 340, h: 3 },
      ];
      const settle = hops[2].t1;
      const hopAt = (k) => [lerp(LAND[0], REST[0], k), LAND[1]];
      const HOP_K = [0, 0.42, 0.62, 0.72]; // 弾みごとの進み具合（残りは転がって止まる）
      /** 時刻 t の玉の位置と大きさ */
      const ballAt = (t) => {
        if (t < T.pop) return null;
        if (t < T.out) { // 蓋から押し出される
          const k = outCubic(seg(t, T.pop, T.out));
          return { p: [lerp(EXIT[0] - 10, OUT[0], k), lerp(EXIT[1] - 8, OUT[1], k)], sc: lerp(0.5, 1, k) };
        }
        if (t < T.land) { // 弧を描いて受け皿へ落ちる
          const k = seg(t, T.out, T.land);
          return { p: [lerp(OUT[0], LAND[0], k), OUT[1] - 46 * k + (LAND[1] - OUT[1] + 46) * k * k], sc: 1 };
        }
        for (let i = 0; i < hops.length; i++) {
          const hp = hops[i];
          if (t < hp.t1) {
            const k = seg(t, hp.t0, hp.t1), [x, y] = hopAt(lerp(HOP_K[i], HOP_K[i + 1], k));
            return { p: [x, y - hp.h * 4 * k * (1 - k)], sc: 1 };
          }
        }
        // 少し転がって止まる
        const k = lerp(HOP_K[3], 1, outQuart(seg(t, settle, T.rest)));
        return { p: [lerp(LAND[0], REST[0], k), lerp(LAND[1], REST[1], k)], sc: 1 };
      };
      // 着地の潰れと戻り（強さは落ちた高さに比例）
      const impacts = [[T.land, 0.16], [hops[0].t1, 0.08], [hops[1].t1, 0.035]];
      const squash = (t) => {
        let sx = 1, sy = 1;
        for (const [at, amp] of impacts) {
          const d = (t - at) / 1000;
          if (d < 0 || d > 0.22) continue;
          const v = amp * Math.exp(-d * 22) * Math.cos(d * 48);
          sy -= v; sx += v * 0.75;
        }
        return [sx, sy];
      };
      // 鐘を鳴らす時刻（ラストワンは最初にも）。上位の玉が受け皿に落ちたところで
      const rings = top ? [...(last ? [80] : []), OFF + warp.real(T.land) - 40] : [];
      const [ax, ay] = lay(REST), [ex, ey] = lay(EXIT);
      const END = OFF + warp.real(T.end);
      let teaseAcc = 0, twinkleAcc = 0, trailAcc = 0, prevAll = 0, stepPulse = -1e9;
      const t0 = performance.now();
      SE.kujiCharge((OFF + T.stop - 200) / 1000);
      const frame = (now) => {
        const all = now - t0;
        if (skipped) { handoff(); resolve(); return; }
        const dms = all - prevAll; prevAll = all;
        const raw = all - OFF;
        const holding = HOLD > 0 && raw >= HOLD_AT && raw < HOLD_AT + HOLD;
        const held = HOLD > 0 && raw >= HOLD_AT + HOLD;
        const holdK = HOLD ? seg(raw, HOLD_AT, HOLD_AT + HOLD) : 0;
        const t = raw < 0 ? raw : warp.at(raw); // 抽選器の時刻（溜めのあいだは止まり、当たりの玉が飛ぶあいだはゆっくり進む）
        // いま何段目の光か（-1＝まだ白）。最後の一段だけ長い
        let si = -1;
        if (holding) for (let i = 0; i < steps.length; i++) if (raw - HOLD_AT >= stepAt[i]) si = i;
        if (held) si = steps.length - 1;
        const finalStep = holding && si === steps.length - 1;
        const finalK = finalStep ? seg(raw - HOLD_AT, stepAt[si], HOLD) : 0;
        const pulse = Math.exp(-(all - stepPulse) / 150); // 色が上がった瞬間の脈
        // 登場: 全体がふっと見え（前の札の上に重なって入れ替わる）、台がわずかに沈んで据わる
        const inK = seg(all, 0, 420);
        const fadeIn = smooth(seg(all, 0, 300));
        // カメラ: 回すあいだじわりと寄り、溜めで一段ごとに蓋へ寄って、玉が受け皿へ向かうと皿へ寄る（寄り切ってから少し沈む）
        const push = inOutSine(seg(t, T.out, T.rest + 260));
        const hand = smooth(seg(t, T.fade, T.end));
        const toExit = holding ? smooth(clamp(holdK * 2.2)) : held ? 1 - smooth(seg(t, T.pop, T.out + 120)) : 0;
        const lean = 0.04 * smooth(seg(t, T.spin, T.stop)) + (holding ? 0.035 * (si + 1) + 0.03 * pulse + 0.05 * finalK : 0);
        const fly = top ? 0.07 * Math.sin(Math.PI * seg(t, T.out, T.land)) : 0; // 当たりの玉を追って少し寄る
        aim(1 + lean * (1 - push) + 0.2 * push + fly + 0.07 * hand, lerp(lerp(AX + 110, ex, toExit * 0.7), ax, push), lerp(lerp(H / 2 + 20, ey, toExit * 0.7), ay, push));
        // 胴の角度。溜めのあいだは小さく震える（段が上がるほど強く）
        let th = angleAt(Math.max(0, t));
        if (holding) th += (0.9 + 0.5 * (si + 1)) * Math.sin(all * 0.085) * Math.sin(Math.PI * holdK) + 1.4 * pulse * Math.sin(all * 0.3);
        spinDrum(th, all, 8 * (1 - outCubic(clamp(inK))), t >= T.spin && t < T.stop + 100);
        once("light", 140, all, lightOn);
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 40, t, () => SE.whoosh());
        once("stop", T.stop, t, () => SE.reelStop());
        // 予告: 止まると蓋が白く光り、賞が上がるたびに一段ずつ色が上がる。S賞・ラストワン賞の最後の一段は暗くなって長く溜める
        const stepRank = si >= 0 ? steps[si] : null, stepLight = stepRank ? RANK_LIGHT[stepRank] : ["#ffffff", "#ffffff", "#ffe9c4"];
        const preGlow = 0.6 * smooth(seg(t, T.stop + 40, HOLD_AT));
        set.exitGlow.style.setProperty("--kj-halo", stepLight[0]);
        set.exitGlow.style.opacity = (holding ? 0.6 + 0.4 * clamp((si + 1) / 2) : held || !HOLD ? (HOLD ? 1 : preGlow) * (1 - seg(t, T.pop, T.out + 160)) : preGlow).toFixed(3);
        set.exitGlow.style.transform = `scale(${(1 + (holding ? 0.22 * (si + 1) + 0.5 * pulse : 0)).toFixed(3)})`;
        steps.forEach((r, i) => once(`step${i}`, HOLD_AT + stepAt[i], raw, () => {
          const c = RANK_LIGHT[r], [hx, hy] = onScreen(EXIT), finale = top && i === steps.length - 1;
          stepPulse = all;
          SE.kujiNote(3 + i * 2);
          SE.kujiShimmer(3 + i * 3);
          kick(1.5 + i, all);
          fx.ring(hx, hy, { color: c[1], r1: 70 + 34 * i, width: 3 + 1.5 * i, life: 0.4 });
          fx.burst(hx, hy, { n: 8 + 6 * i, colors: c, speed: [90, 260 + 90 * i], spread: Math.PI, gravity: 160, life: [0.3, 0.7], size: [8, 18] });
          fx.stars(hx, hy, { n: 2 + 2 * i, colors: [c[1], c[0]], rx: 40 + 22 * i, ry: 36 + 18 * i, size: [10, 20 + 6 * i], delay: 0.15 });
          if (finale) { SE.heartbeat(); auraTint = c[0]; auraFlare = all; flashNow(c[1], 0.3, 260); }
        }));
        if (holding) {
          teaseAcc += dms;
          const every = Math.max(40, 90 - 14 * si);
          while (teaseAcc > every) {
            teaseAcc -= every;
            const [hx, hy] = onScreen(EXIT);
            fx.stars(hx, hy, { n: 1, colors: [stepLight[1], stepLight[0]], rx: 26 + 60 * holdK, ry: 22 + 50 * holdK, size: [8, 14 + 16 * holdK], delay: 0 });
            fx.burst(hx, hy, { n: finalStep && top ? 2 : 1, colors: stepLight, speed: [60, 220 + 200 * holdK], angle: 0.6, spread: 1.4, gravity: 120, life: [0.3, 0.7], size: [8, 18] });
          }
        }
        if (HOLD) once("release", HOLD_AT + HOLD, raw, () => {
          if (!top) return;
          SE.kujiImpact();
          flashNow(light[1], 0.42, 320);
          kick(5, all);
          auraFlare = all;
          const [hx, hy] = onScreen(EXIT);
          fx.burst(hx, hy, { n: 30, colors: light, kind: "streak", speed: [260, 620], spread: Math.PI, gravity: 200, life: [0.25, 0.5], size: [1.6, 3] });
        });
        once("pop", T.pop, t, () => {
          SE.punch();
          const [hx, hy] = onScreen(EXIT);
          fx.ring(hx, hy, { color: light[1], r1: 46 + 60 * mood[0], width: 2 + 3 * mood[0], life: 0.32, alpha: 0.8 });
          fx.burst(hx, hy, { n: top ? 26 : rank === "A" ? 16 : 8, colors: light, speed: [80, 300], angle: 0.5, spread: 1.2, gravity: 320, life: [0.3, 0.7], size: [8, 18] });
          if (top || rank === "A") SE.kujiShimmer(top ? 9 : 5);
        });
        impacts.forEach(([at], i) => once(`hit${i}`, at, t, () => SE.click()));
        // 玉と、賞の色のにじみ
        const b = ballAt(t);
        if (b) {
          const [sx, sy] = squash(t);
          place(ball, b.p, b.sc * sx, b.sc * sy);
          const shown = top || rank === "A" ? 1 : seg(t, T.land - 40, T.land + 120);
          show(ball, mood[2] * shown * (0.82 + 0.18 * Math.sin(all * 0.011)));
          // 上位の玉は光の尾を引き、通った跡にきらめきが残る
          if ((top || rank === "A") && t < T.land) {
            const [bx, by] = onScreen(b.p);
            fx.burst(bx, by, { n: 1, colors: light, speed: [10, 60], spread: Math.PI, gravity: 60, life: [0.25, 0.5], size: [8, 16] });
            trailAcc += dms;
            while (trailAcc > (top ? 55 : 95)) {
              trailAcc -= top ? 55 : 95;
              fx.stars(bx, by, { n: 1, colors: [light[1], light[0]], rx: 10, ry: 10, size: [9, top ? 24 : 17], delay: 0 });
            }
          }
        }
        // 着地: 賞の色の光の輪ときらめき。上位は皿の後ろからの光・光の柱・紙吹雪・画面の揺れ
        once("land", T.land, t, () => {
          const [lx, ly] = onScreen(LAND);
          fx.ring(lx, ly + 14, { color: light[1], r1: 60 + 90 * mood[0], width: 4 + 6 * mood[0], life: 0.45, flat: 0.3 });
          fx.burst(lx, ly, { n: Math.round(6 + 46 * mood[0]), colors: light, speed: [90, 240 + 380 * mood[0]], angle: -Math.PI / 2, spread: 1.25, gravity: 520, life: [0.4, 1], size: [8, 20] });
          if (rank === "C") { SE.good(); return; }
          fx.stars(lx, ly - 10, { n: Math.round(3 + 12 * mood[0]), colors: [light[1], light[0]], rx: 60 + 80 * mood[0], ry: 50 + 60 * mood[0], size: [10, 30], delay: 0.5 });
          if (rank === "B") { SE.reelWin(); return; }
          auraTint = light[0]; auraFlare = all;
          fx.ring(lx, ly + 14, { color: light[0], r1: 220, width: 5, life: 0.7, flat: 0.3, alpha: 0.5 });
          kick(top ? 7 : 3.5, all);
          flashNow(light[1], top ? 0.7 : 0.35, top ? 460 : 300);
          SE.kujiRare();
          if (!top) return;
          SE.kujiImpact(); SE.kujiShimmer(14);
          fx.ring(lx, ly, { color: light[1], r1: 420, width: 7, life: 0.8, alpha: 0.6 });
          fx.burst(lx, ly, { n: 34, colors: [light[1], "#ffffff"], kind: "streak", speed: [320, 820], spread: Math.PI, gravity: 140, life: [0.3, 0.6], size: [1.6, 3.2] });
          fx.confetti([light[0], light[1], light[2], "#ffffff", "#e9d8b4"], { seconds: 1.6, perSecond: 52 });
        });
        once("accent", T.accent, t, () => { if (top) SE.crowd(1.2); });
        // 止まった玉のまわりのきらめき（上位ほど多い）
        if (t > T.land + 200 && rank !== "C") {
          twinkleAcc += dms;
          const every = top ? 90 : rank === "A" ? 150 : 300;
          while (twinkleAcc > every) {
            twinkleAcc -= every;
            const [bx, by] = onScreen(REST);
            fx.stars(bx, by - 6, { n: 1, colors: [light[1], light[0]], rx: 80 + 70 * mood[0], ry: 60 + 60 * mood[0], size: [8, 22 + 10 * mood[0]], delay: 0 });
          }
        }
        // 後ろの光: 回すと明るく回り、予告の段が上がるほど強くなる。登場の暗がりと溜めの暗がりは濃い方を使う
        const intro = ambience(all, dms, holding ? 0.1 * (si + 1) + 0.2 * finalK : held && t < T.land ? 0.12 * steps.length : t >= T.land ? 0.5 * mood[1] : 0);
        set.dim(Math.max(intro, top && finalStep ? 0.5 * Math.sin(Math.PI * Math.min(1, finalK * 1.1)) ** 0.7 : 0));
        // 受け皿の後ろの光（A賞以上。落ちた瞬間に広がって、回りながら残る）
        if (mood[0] > 0.7 && t >= T.land) {
          landDeg += dms * 0.02;
          const d = t - T.land;
          set.landRays(smooth(seg(d, 0, 160)) * (top ? 0.8 + 0.2 * Math.exp(-d / 420) : 0.4 + 0.25 * Math.exp(-d / 420)) * (0.9 + 0.1 * Math.sin(all * 0.006)),
            landDeg, (top ? 1 : 0.7) * (0.55 + 0.45 * outCubic(seg(d, 0, 320))), top ? light[1] : light[0]);
        }
        // 舞台の染まり: 予告の段が上がるたびにその色が差し、落ちた瞬間にいちばん強くなって落ち着く
        const landK = t >= T.land ? Math.exp(-(t - T.land) / 520) : 0;
        const base = holding && si >= 0 ? (0.16 + 0.14 * si) * (0.7 + 0.3 * pulse) + (top ? 0.3 * finalK : 0) : held && t < T.land ? (top ? 0.55 : 0.18 * steps.length) : 0;
        set.mood(Math.max(base, t >= T.land ? mood[1] + (mood[0] - mood[1]) * landK : 0), t >= T.land || held ? light[0] : stepLight[0]);
        if (top) {
          set.pillar.style.setProperty("--kj-halo", light[0]);
          set.pillar.style.setProperty("--kj-halo-hi", light[1]);
          set.pillar.style.opacity = (smooth(seg(t, T.land, T.land + 180)) * (0.78 + 0.22 * Math.sin(all * 0.013))).toFixed(3);
        }
        ringBell(all, rings);
        // 札への受け渡し: 白く光って全体がほどけ、その下で賞の札が開く
        once("handoff", T.fade + 60, t, () => {
          flashNow("#ffffff", top ? 0.9 : rank === "A" ? 0.6 : 0.3, 380);
          onHandoff?.();
        });
        set.paintLights();
        node.style.opacity = String(fadeIn * (1 - hand));
        if (all >= END) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });

    // ---- 連続で引く ----
    const playMulti = () => new Promise((resolve) => {
      const n = ranks.length;
      const best = ranks.includes("S") ? "S" : ranks.includes("LAST") ? "LAST" : ranks.includes("A") ? "A" : null;
      const bestLight = best ? RANK_LIGHT[best] : null;
      const INT = n > 6 ? 280 : 340; // 玉が出る間隔（1回転で1つ）
      const FIRST = T.spin + 760; // 最初の玉が出る時刻
      const OM = 360 / INT; // 回る速さ（度/ms）
      const popAt = (i) => FIRST + i * INT;
      const LASTPOP = popAt(n - 1);
      const RAMP = T.spin + 400, DECEL = 560;
      const lineAt = (t) => OM * (t - FIRST); // 一定の速さで回るあいだの角度（玉が出る時刻に蓋が右下へ来る）
      const A0 = lineAt(RAMP) - (OM * (RAMP - T.spin)) / 2;
      const angle = (t) => {
        if (t >= LASTPOP) { const d = Math.min(DECEL, t - LASTPOP); return lineAt(LASTPOP) + OM * (d - (d * d) / (2 * DECEL)); }
        if (t >= RAMP) return lineAt(t);
        if (t >= T.spin) { const d = RAMP - t; return lineAt(RAMP) - OM * d + (OM * d * d) / (2 * (RAMP - T.spin)); }
        return A0 + PULL * (1 - inOutSine(seg(t, T.ant, T.spin)));
      };
      // 玉1つの動き（出てからの ms）。蓋 → 受け皿でひと弾み → 弧を描いて玉置きへ
      const B = { out: 80, land: 360, hop: 520, go: 570, into: 960 };
      const HOPPED = [lerp(LAND[0], REST[0], 0.6), LAND[1]];
      const track = (i, tau) => {
        if (tau < B.out) { const k = outCubic(tau / B.out); return { p: [lerp(EXIT[0] - 10, OUT[0], k), lerp(EXIT[1] - 8, OUT[1], k)], sc: lerp(0.5, 1, k) }; }
        if (tau < B.land) { const k = seg(tau, B.out, B.land); return { p: [lerp(OUT[0], LAND[0], k), OUT[1] - 46 * k + (LAND[1] - OUT[1] + 46) * k * k], sc: 1 }; }
        if (tau < B.hop) { const k = seg(tau, B.land, B.hop); return { p: [lerp(LAND[0], HOPPED[0], k), LAND[1] - 22 * 4 * k * (1 - k)], sc: 1 }; }
        if (tau < B.go) return { p: HOPPED, sc: 1 };
        const to = toLocal(rail.at(i)), k = seg(tau, B.go, B.into), e = inOutSine(k);
        const mx = (HOPPED[0] + to[0]) / 2, my = Math.min(HOPPED[1], to[1]) - 150;
        const q = (a, c, b) => (1 - e) * (1 - e) * a + 2 * (1 - e) * e * c + e * e * b;
        return { p: [q(HOPPED[0], mx, to[0]), q(HOPPED[1], my, to[1])], sc: lerp(1, RAIL_SC / ZOOM, e), flying: k < 1 };
      };
      const ARRIVED = LASTPOP + B.into; // 最後の玉が並ぶ時刻
      const WAVE = ARRIVED + 140; // 並んだ玉が順にはずむ
      const END = WAVE + n * 45 + 620;
      // S賞・ラストワン賞の玉が出る瞬間は、全体がゆっくりになる（蓋から受け皿に落ちるまで）
      const SLOW = 0.42;
      const hotPops = ranks.flatMap((r, i) => (isTop(r) ? [popAt(i)] : []));
      const warp = timeWarp(hotPops.map((at) => [at - 30, at + B.land + 40, SLOW]));
      const rings = ranks.flatMap((r, i) => (isTop(r) ? [warp.real(popAt(i) + B.into - 160)] : []));
      const [ex, ey] = lay(EXIT), [lx0, ly0] = lay(LAND);
      let pulseAt = -1e9, pulseColor = bestLight?.[0] || "#fff", teaseAcc = 0, prevAll = 0, slowK = 0, hotLand = -1e9, hotColor = "#fff";
      const t0 = performance.now();
      SE.kujiCharge((FIRST - 100) / 1000);
      const frame = (now) => {
        const all = now - t0, t = warp.at(all); // t は演出の時刻（当たりの玉が出るあいだはゆっくり進む）
        if (skipped) { handoff(); resolve(); return; }
        const dms = all - prevAll; prevAll = all;
        const inK = seg(all, 0, 420);
        const fadeIn = smooth(seg(all, 0, 300));
        const hand = smooth(seg(t, END - 320, END));
        // カメラ: 玉が並ぶにつれてじわりと寄り、当たりの玉が出るあいだは蓋と受け皿のあいだへ寄る
        slowK = lerp(slowK, warp.slowAt(all) ? 1 : 0, 1 - Math.exp(-dms / 110));
        const drift = 0.03 * smooth(seg(t, FIRST, ARRIVED));
        aim(1 + drift + 0.13 * slowK + 0.05 * hand, lerp(AX + 140, (ex + lx0) / 2, slowK), lerp(H / 2, (ey + ly0) / 2, slowK));
        spinDrum(angle(t), all, 8 * (1 - outCubic(clamp(inK))), t >= T.spin && t < LASTPOP + DECEL);
        once("light", 140, all, lightOn);
        once("lever", T.ant, t, () => SE.reelLever());
        once("go", T.spin + 40, t, () => SE.whoosh());
        once("stop", LASTPOP + DECEL, t, () => SE.reelStop());
        // 当たりが入っている回は、玉が出る前から舞台に賞の色が差し、胴のまわりがきらめく
        if (best) {
          once("omen", T.spin + 160, t, () => { SE.kujiShimmer(best === "A" ? 5 : 12); if (best !== "A") SE.heartbeat(); });
          if (t > T.spin + 160 && t < FIRST) {
            teaseAcc += dms;
            while (teaseAcc > (best === "A" ? 110 : 60)) {
              teaseAcc -= best === "A" ? 110 : 60;
              const a = Math.random() * Math.PI * 2, rr = R * (0.9 + Math.random() * 0.5);
              const [x, y] = onScreen([AX + rr * Math.cos(a), AY + rr * Math.sin(a)]);
              fx.stars(x, y, { n: 1, colors: [bestLight[1], bestLight[0]], rx: 10, ry: 10, size: [10, 26], delay: 0 });
            }
          }
        }
        balls.forEach((ball, i) => {
          const tau = t - popAt(i);
          if (tau < 0) return;
          const light = ball.light, mood = MOOD[ball.rank], hot = isTop(ball.rank);
          // 玉置きに並んだあとは、はずむ時（WAVE）のほかは動かさない
          const waving = t > WAVE + i * 45 && t < WAVE + i * 45 + 300;
          if (tau < B.into + 60 || waving || !fired.has(`set${i}`)) {
            const b = track(i, tau);
            const sc = waving ? b.sc * (1 + 0.2 * Math.sin(Math.PI * seg(t, WAVE + i * 45, WAVE + i * 45 + 260))) : b.sc;
            place(ball, b.p, sc);
            if (b.flying && mood[0] > 0.7) {
              const [bx, by] = onScreen(b.p);
              fx.burst(bx, by, { n: 1, colors: light, speed: [10, 70], spread: Math.PI, gravity: 80, life: [0.25, 0.5], size: [8, 16] });
            }
            if (tau >= B.into + 60 && !waving) fired.add(`set${i}`);
          }
          once(`pop${i}`, 0, tau, () => {
            show(ball, mood[0] > 0.7 ? mood[2] : 0);
            SE.punch();
            const [hx, hy] = onScreen(EXIT);
            fx.burst(hx, hy, { n: hot ? 20 : ball.rank === "A" ? 12 : 5, colors: light, speed: [80, 280], angle: 0.5, spread: 1.2, gravity: 320, life: [0.25, 0.6], size: [8, 16] });
            if (hot) {
              SE.kujiImpact(); SE.kujiShimmer(9); flashNow(light[1], 0.55, 320); kick(6, all); pulseAt = all; pulseColor = light[0];
              auraTint = light[0]; auraFlare = all;
              fx.ring(hx, hy, { color: light[1], r1: 150, width: 5, life: 0.5 });
              fx.burst(hx, hy, { n: 24, colors: light, kind: "streak", speed: [240, 560], spread: Math.PI, gravity: 200, life: [0.25, 0.5], size: [1.6, 3] });
            } else if (ball.rank === "A") { auraFlare = all - 260; fx.ring(hx, hy, { color: light[1], r1: 80, width: 3, life: 0.35, alpha: 0.7 }); }
          });
          // 当たりの玉は、飛んでいるあいだきらめきを残す
          if (hot && tau < B.land) once(`trail${i}-${Math.floor(tau / 45)}`, 0, 1, () => {
            const [bx, by] = onScreen(track(i, tau).p);
            fx.stars(bx, by, { n: 1, colors: [light[1], light[0]], rx: 10, ry: 10, size: [9, 22], delay: 0 });
          });
          once(`land${i}`, B.land, tau, () => {
            ball.halo.style.opacity = mood[2].toFixed(3);
            SE.click();
            const [lx, ly] = onScreen(LAND);
            fx.ring(lx, ly + 14, { color: light[1], r1: 50 + 60 * mood[0], width: 3 + 4 * mood[0], life: 0.35, flat: 0.3 });
            if (!hot) return;
            hotLand = all; hotColor = light[0];
            SE.kujiRare();
            fx.burst(lx, ly, { n: 30, colors: light, speed: [120, 520], angle: -Math.PI / 2, spread: 1.3, gravity: 520, life: [0.4, 0.9], size: [8, 20] });
            fx.stars(lx, ly - 10, { n: 10, colors: [light[1], light[0]], rx: 110, ry: 80, size: [10, 28], delay: 0.3 });
          });
          once(`in${i}`, B.into, tau, () => {
            SE.kujiNote(i);
            rail.count(i + 1);
            ball.halo.style.opacity = (mood[2] * 0.55).toFixed(3); // 並んだ玉のにじみは控えめに（隣の玉や数字にかぶせない）
            const [sx, sy] = onScreen(toLocal(rail.at(i)));
            fx.ring(sx, sy, { color: light[0], r1: 30 + 22 * mood[0], width: 2 + 2 * mood[0], life: 0.4, alpha: 0.7 });
            if (ball.rank === "C") return;
            fx.stars(sx, sy - 4, { n: Math.round(1 + 9 * mood[0]), colors: [light[1], light[0]], rx: 26 + 40 * mood[0], ry: 26 + 40 * mood[0], size: [8, 24], delay: 0.3 });
            if (ball.rank === "B") return;
            fx.burst(sx, sy, { n: Math.round(22 * mood[0]), colors: light, speed: [80, 340], angle: -Math.PI / 2, spread: 1.3, gravity: 480, life: [0.4, 0.9], size: [8, 18] });
            if (hot) { SE.kujiRare(); SE.kujiShimmer(10); fx.confetti([light[0], light[1], light[2], "#ffffff", "#e9d8b4"], { seconds: 1.2, perSecond: 44 }); }
            else SE.perfect();
          });
        });
        once("wave", WAVE, t, () => {
          SE.jingle();
          // 並び終わり: 後ろの光がふくらみ、玉置きの上をきらめきが走る
          auraFlare = all;
          for (let i = 0; i < n; i++) { const [sx, sy] = onScreen(toLocal(rail.at(i))); fx.stars(sx, sy - 8, { n: 1, colors: [balls[i].light[1], "#ffffff"], rx: 8, ry: 8, size: [10, 22], delay: 0.02 + i * 0.045 }); }
          if (best) SE.kujiShimmer(best === "A" ? 6 : 12);
        });
        // 舞台の染まり: 当たりの予告と、当たりの玉が出た瞬間
        const omen = best ? (best === "A" ? 0.3 : 0.5) * smooth(seg(t, T.spin + 160, FIRST - 80)) : 0;
        const pulse = Math.exp(-(all - pulseAt) / 520);
        set.mood(Math.max(omen, 0.95 * pulse), pulse > omen ? pulseColor : (bestLight?.[0] || "#fff"));
        // 後ろの光（当たりが入っている回は、玉が出る前から少し明るい）と、登場の暗がり
        set.dim(ambience(all, dms, omen * 0.3));
        // 当たりの玉が受け皿に落ちたときの、皿の後ろの光（すぐ消える）
        const landed = all - hotLand;
        if (landed < 1400) {
          landDeg += dms * 0.03;
          set.landRays(0.8 * smooth(seg(landed, 0, 140)) * (1 - smooth(seg(landed, 500, 1400))), landDeg, 0.6 + 0.4 * outCubic(seg(landed, 0, 300)), hotColor);
        }
        ringBell(all, rings);
        once("handoff", END - 300, t, () => { flashNow("#ffffff", best && best !== "A" ? 0.9 : 0.5, 380); onHandoff?.(); });
        set.paintLights();
        node.style.opacity = String(fadeIn * (1 - hand));
        if (t >= END) resolve();
        else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });

    await (multi ? playMulti() : playSingle());
  } finally {
    cancelAnimationFrame(raf);
    fx?.destroy();
    for (const a of node.getAnimations({ subtree: true })) a.cancel();
    node.remove();
  }
}
