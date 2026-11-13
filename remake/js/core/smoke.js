// 人が吐く煙（docs/owner_requests.md の KMR）。もこもこした房を重ね、細かい升目と白に近い4色で描く。
// ・升目は 640×360（1280×720 のステージでドット1つが 2px）。網点は使わず、全体を少し透かす。
// ・大小の丸をまとめた「房」をいくつも重ねて雲の形を作る。丸ごとには塗り分けず、重ねた丸を「高さの地図」にして、
//   房の境目と光の向きで 影・中間・明るい面・いちばん明るい縁 の4色に塗る（房の境目が、淡い色の違いとして中に出る）。
// ・消えるときは、縮みながら全体が薄くなり、ちぎれる。コマ打ち（毎秒12コマ）で手描きの間にする。
// ・煙の出どころは、画面に見えている人の口元だけ（docs/shisha_reference.md）。機材からは出さず、吐く人が画面にいない煙も出さない。
// ・吐く煙は顔や計器を覆わない: 口元では細く、顔の向いている側へ流れてからふくらむ（KMR23〜）。
// 座標: 位置は煙を載せる面に対する 0〜1（y は下向き）、向きは 右が0・上が -π/2、速さ・大きさは「面の高さ＝1」の単位。
// 前半（createSmokeField）は DOM に触れない計算だけで、単体テスト（test/smoke_field.mjs）から直接呼ぶ。

const TAU = Math.PI * 2;
export const GRID_W = 640, GRID_H = 360;
const ASPECT = GRID_W / GRID_H;
const STEP = 1 / 60;          // 計算の刻み
const FRAME = 1 / 12;         // 描く間隔（コマ打ち）
const ALPHA_STEPS = 5;        // 透けの段
const LAYER_ALPHA = .84;      // 煙ぜんたいの濃さ（solid の煙は 1）
const LIGHT = (() => { const v = [-.55, -.62, .56], n = Math.hypot(...v); return v.map((x) => x / n); })();
/** 煙の色を指定しないときの白（ほんの少し藤色） */
export const SMOKE_WHITE = Object.freeze([.93, .91, .96]);

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mul = (a, b) => a.map((v, i) => v * b[i]);
/** 煙の色から塗りの4色を作る。並びは [影, 中間, 明るい面, いちばん明るい縁]。vivid は白へ寄せる量を減らして色を残す（色が主役の煙） */
const tonesOf = (c, vivid = false) => vivid
  ? [mul(c, [.8, .78, .9]), mix(c, [1, 1, 1], .12), mix(c, [1, 1, 1], .38), mix(c, [1, 1, 1], .7)]
  : [mul(c, [.84, .82, .94]), mix(mul(c, [.93, .92, .985]), [1, 1, 1], .3), mix(c, [1, 1, 1], .7), mix(c, [1, 1, 1], .95)];

/** "#abc"・"#aabbcc"・"rgb(r,g,b)" を 0〜1 の [r,g,b] にする。読めなければ null */
export function parseColor(color) {
  const c = String(color || "").trim();
  const rgb = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return rgb.slice(1, 4).map((v) => Math.max(0, Math.min(255, +v)) / 255);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((h) => h + h).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** 葉や人物の色を、煙にうっすら移した色にする（煙は白が基本で、色は香りづけ程度）。暗い色は明るくしてから移す（煙をくすませない） */
export function smokeTint(color, amount = .42) {
  const c = Array.isArray(color) ? color : parseColor(color);
  if (!c) return [...SMOKE_WHITE];
  const top = Math.max(...c, 1e-3);
  return mix(SMOKE_WHITE, c.map((v) => v / top), amount);
}

/** 部屋の空気のゆらぎ（渦のある流れ）。流れの関数 ψ を sin の重ね合わせで作り、その回転を速度にする */
function flow(x, y, t) {
  let u = 0, v = 0;
  const W = [[5.1, 3.3, .9, 0], [-3.7, 6.2, 1.3, 2.1], [8.3, -4.9, 1.9, 4.4], [2.2, 9.1, .7, 1.2], [13.1, 7.7, 2.3, .6]];
  for (const [kx, ky, w, ph] of W) {
    const c = Math.cos(kx * x + ky * y + w * t + ph) / Math.hypot(kx, ky);
    u += ky * c; v -= kx * c;
  }
  return [u, v];
}

// 吐く口（breath）の既定値。場面ごとの値は下の BREATH で上書きする
const DEFAULTS = {
  x: .5, y: .5, angle: -.3, spread: .85, speed: .5, width: .006, dur: 1.5, delay: 0,
  rate: 19,        // 房の数（毎秒）
  size: .05,       // 房の大きさ
  life: 2.5,       // 房の寿命（秒。大きい房ほど長く残る）
  buoy: .028,      // 昇る力
  drag: 1.9,       // 空気の抵抗（大きいほど口元に留まる）
  turb: .09,       // ゆらぎ
  hold: .45,       // 寿命のどこまで縮まずにいるか
  fade: true,      // 消えぎわに薄くする
  solid: false,    // 透かさずに塗る
  alpha: 1,        // 濃さ（薄い煙は 1 より小さく）
  even: false,     // 寿命をそろえる（煙の輪）
  flat: false,     // 吐く強さを一定にする（既定は、すっと強くなって尾を引く。尾の弱い房は口元に留まる）
  sway: 0,         // 吐く向きの揺れ
  colors: null,    // [[r,g,b]]（2色まで）。無ければ白
  vivid: false,    // 色を主役にする（白へ寄せる量を減らす）
  jitter: 1,       // 房ごとの速さ・大きさのばらつき（0 でそろえる。煙の輪）
  swell: .3,       // 房がふくらみきるまでの秒数（漂う煙はゆっくり）
  soft: false,     // 縁へ向かって段々に薄くする（漂う煙。人が吐く煙は縁をくっきり）
  lean: false,     // 房を少ない丸で作る（大きな房が何重にも重なる煙で、描く量を半分にする）
  move: null,      // (breath, 進み 0〜1) => void  口の位置を動かす
};

/**
 * 煙の計算の本体（DOM に触れない）。breath() で吐く口を足し、step() で進め、paint() で升目に描く。
 * random を渡すと、同じ乱数列で同じ煙になる（テスト用）。
 */
export function createSmokeField({ random = Math.random } = {}) {
  let parts = [], breaths = [], time = 0, nextId = 1;
  const palettes = [], paletteIndex = new Map(), alive = new Map();
  let z = null, al = null, pl = null, bufW = 0, bufH = 0;

  // 色の表: [色の番号][塗り 0〜3][濃さの段] → 32bit の色（ImageData と同じ並び）
  const paletteFor = (color, solid, vivid) => {
    const key = color.map((v) => Math.round(v * 255)).join(",") + (solid ? "s" : "") + (vivid ? "v" : "");
    if (paletteIndex.has(key)) return paletteIndex.get(key);
    const layer = solid ? 1 : LAYER_ALPHA;
    palettes.push(tonesOf(color, vivid).map((t) => {
      const [r, g, b] = t.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
      return Array.from({ length: ALPHA_STEPS + 1 }, (_, s) => ((Math.round(255 * layer * s / ALPHA_STEPS) << 24) | (b << 16) | (g << 8) | r) >>> 0);
    }));
    paletteIndex.set(key, palettes.length - 1);
    return palettes.length - 1;
  };

  const size = (p) => {
    const k = p.age / p.life;
    const grow = p.born ? 1 : 1 - (1 - Math.min(1, p.age / p.swell)) ** 3; // 既定は0.3秒でふくらみきる（口元から離れる前に形になる）
    const shrink = k < p.hold ? 1 : 1 - ((k - p.hold) / (1 - p.hold)) ** 1.7;
    return p.R * grow * (1 + .45 * k) * shrink;
  };
  // 房: 芯の丸いくつか・まわりの中くらいの丸・縁の小さな丸。大きな丸1つにせず、細かいふくらみの集まりにする。
  // まわりの丸は少し遅れてふくらむ（もこもこ育つ）。並びは [x, y, 大きさ, ふくらみ始める時期]
  const cluster = (lean) => {
    const list = [[0, 0, lean ? .78 : .62, 0]], a0 = random() * TAU;
    const ring = (n, dist, spread, r, vary, wait) => {
      const turn = random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + turn + (i / n) * TAU + (random() - .5) * 1.1 / n * TAU, d = dist + spread * random();
        list.push([Math.cos(a) * d, Math.sin(a) * d, r + vary * random(), wait * random()]);
      }
    };
    if (lean) { ring(6, .66, .18, .3, .14, .2); ring(5, .95, .2, .15, .1, .3); return list; }
    ring(4, .3, .16, .46, .16, .08);
    ring(7, .62, .2, .3, .14, .26);
    ring(7, .9, .22, .15, .1, .34);
    return list;
  };
  const spawn = (b, x, y, vx, vy, R, life, pal, born) => {
    parts.push({ x, y, vx, vy, R, life, pal, born, age: 0, id: b.id, seed: random() * 40, spin: (random() - .5) * .6, rot: random() * TAU,
      disks: cluster(b.lean), split: born, buoy: b.buoy, drag: b.drag, turb: b.turb, hold: b.hold, fade: b.fade, alpha: b.alpha, swell: b.swell, soft: b.soft, lean: b.lean });
    alive.set(b.id, (alive.get(b.id) || 0) + 1);
  };
  const envelope = (b, u) => b.flat ? 1 : u < .28 ? .35 + .65 * (u / .28) : 1 - .7 * ((u - .28) / .72);

  return {
    /** 吐く口を1つ足す。戻り値はその煙の番号（done(番号) で、吐き終わって消えきったかを見る） */
    breath(spec = {}) {
      const b = { ...DEFAULTS, ...spec, id: nextId++, t: -(spec.delay || 0), acc: 0, phase: random() * TAU };
      b.angle0 = b.angle;
      b.pals = (b.colors?.length ? b.colors : [SMOKE_WHITE]).slice(0, 2).map((c) => paletteFor(c, b.solid, b.vivid));
      breaths.push(b);
      alive.set(b.id, alive.get(b.id) || 0);
      return b.id;
    },
    done(id) { return !breaths.some((b) => b.id === id) && !(alive.get(id) > 0); },
    get busy() { return breaths.length > 0 || parts.length > 0; },
    get count() { return parts.length; },

    step(dt = STEP) {
      time += dt;
      for (const b of breaths) {
        b.t += dt;
        const u = b.t / b.dur;
        if (u < 0 || u >= 1) continue;
        b.move?.(b, u);
        if (b.sway) b.angle = b.angle0 + Math.sin(b.t * 5.3 + b.phase) * b.sway;
        const k = envelope(b, u);
        b.acc += b.rate * k * dt;
        while (b.acc >= 1) {
          b.acc -= 1;
          const side = random() - .5;
          const a = b.angle + (random() - .5) * b.spread;
          const sp = b.speed * k * (1 + b.jitter * (.6 * random() - .5));
          const s = 1 + b.jitter * (.9 * random() ** 1.5 - .55);
          // 大きい房ほど長く残る（縁の小さい房から先に消えて、芯が残る）
          spawn(b, b.x + (-Math.sin(b.angle) * side * b.width) / ASPECT, b.y + Math.cos(b.angle) * side * b.width,
            Math.cos(a) * sp, Math.sin(a) * sp, b.size * s, b.life * (b.even ? .92 + .16 * random() : .5 + .5 * s + .2 * random()),
            b.pals[b.pals.length > 1 && side > 0 ? 1 : 0], false);
        }
      }
      breaths = breaths.filter((b) => b.t < b.dur);
      const old = parts;
      parts = [];
      for (const p of old) {
        p.age += dt;
        if (p.age >= p.life) { alive.set(p.id, alive.get(p.id) - 1); continue; }
        // 大きな房は消えぎわに小さな房へちぎれる
        if (!p.split && p.age > p.life * .62 && p.R > .028) {
          p.split = true;
          const r = size(p);
          for (let i = 0; i < 2; i++) {
            const a = random() * TAU;
            spawn(p, p.x + Math.cos(a) * r * .7 / ASPECT, p.y + Math.sin(a) * r * .7, p.vx + Math.cos(a) * .04, p.vy + Math.sin(a) * .04,
              r * (.4 + .2 * random()), p.life * (.35 + .2 * random()), p.pal, true);
          }
        }
        const [fu, fv] = flow(p.x * ASPECT * 1.2 + p.seed * .02, p.y * 1.2, time * .6);
        const drag = Math.exp(-p.drag * dt);
        p.vx = p.vx * drag + fu * p.turb * dt * .5;
        p.vy = p.vy * drag + (fv * p.turb * .5 - p.buoy) * dt;
        p.x += (p.vx + fu * p.turb * .2) * dt / ASPECT;
        p.y += (p.vy + fv * p.turb * .2) * dt;
        p.rot += p.spin * dt;
        parts.push(p);
      }
    },

    /** いまの煙を、幅 W・高さ H の升目（Uint32Array。ImageData と同じ並び）へ描く。戻り値は塗った升目の数 */
    paint(px, W = GRID_W, H = GRID_H) {
      if (bufW !== W || bufH !== H) { z = new Float32Array(W * H); al = new Float32Array(W * H); pl = new Uint8Array(W * H); bufW = W; bufH = H; }
      z.fill(0); al.fill(0);
      const unit = H / 360; // 高さの単位（升目の細かさが変わっても、同じ見え方にする）
      // 1) 丸を「てっぺんがほぼ平らな丘」として重ね、升目ごとにいちばん高い丘を残す
      for (const p of parts) {
        const R = size(p) * H;
        if (R < 1) continue;
        const k = p.age / p.life, c = Math.cos(p.rot), s = Math.sin(p.rot);
        // 消えぎわは薄くする。ゆっくりふくらむ煙（漂う煙）は、生まれぎわも薄くから
        const alpha = (p.fade ? Math.min(1, (1 - k) * 2.3) : 1) * (p.swell > 1 && !p.born ? Math.min(1, .25 + p.age / p.swell) : 1) * p.alpha;
        for (const [ox, oy, rr, wait] of p.disks) {
          const g = p.born ? 1 : Math.min(1, Math.max(0, (k - wait) / .16));
          const r = R * rr * (1 - (1 - g) ** 2);
          if (r < .7) continue;
          const cx = p.x * W + (ox * c - oy * s) * R, cy = p.y * H + (ox * s + oy * c) * R;
          const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
          const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
          const inv = 1 / (r * r), top = 2.5 * unit + .3 * r;
          for (let y = y0; y <= y1; y++) {
            const dy = y + .5 - cy, dy2 = dy * dy;
            for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
              const dx = x + .5 - cx, t2 = (dx * dx + dy2) * inv;
              if (t2 >= 1) continue;
              const h = top * (1 - t2 * t2 * t2) + .01;
              if (h > z[i]) { z[i] = h; pl[i] = p.pal; }
              // 透けは、重なった丸のうちいちばん濃いものに合わせる（丸ごとの濃淡を出さない）。soft の煙は縁へ向かって薄くする
              const a = p.soft ? alpha * Math.min(1, (1 - t2) * 1.7) : alpha;
              if (a > al[i]) al[i] = a;
            }
          }
        }
      }
      // 2) 丘の傾きから、光の当たり方で4色に塗り分ける。雲の外周は塗り分けない（外へ落ちる傾きを数えない）
      const [lx, ly, lz] = LIGHT, s2 = 3 * unit, flat = s2 * lz;
      let painted = 0;
      for (let y = 0, i = 0; y < H; y++) {
        for (let x = 0; x < W; x++, i++) {
          const zc = z[i];
          if (zc <= 0) { px[i] = 0; continue; }
          const zl = x > 0 ? z[i - 1] : 0, zr = x < W - 1 ? z[i + 1] : 0, zu = y > 0 ? z[i - W] : 0, zd = y < H - 1 ? z[i + W] : 0;
          const gx = (zr > 0 ? zr : zc) - (zl > 0 ? zl : zc), gy = (zd > 0 ? zd : zc) - (zu > 0 ? zu : zc);
          const lam = (-gx * lx - gy * ly + flat) / Math.sqrt(gx * gx + gy * gy + s2 * s2);
          const tone = lam >= .8 ? 3 : lam >= .44 ? 2 : lam >= .16 ? 1 : 0;
          const step = Math.round(Math.min(1, al[i]) * ALPHA_STEPS);
          if (!step) { px[i] = 0; continue; } // soft の煙の、いちばん外の縁
          px[i] = palettes[pl[i]][tone][step];
          painted++;
        }
      }
      return painted;
    },

    clear() { parts = []; breaths = []; alive.clear(); },
  };
}

// ---------------------------------------------------------------- 吐き方（場面ごとの決まり）

const UP = -Math.PI / 2;

/**
 * 作業風景のはじめが吐く煙（吸い出しの山場）。口元（x・y）から、顔の向いている右へ細く出て、ふくらみながら昇る。
 * 作業風景の窓の中に収まる大きさにとどめる（計器や結果の札には掛けない）。出来で煙の姿が変わる（煙が成績表になる）:
 *   "best"…最適温・会心。たっぷり、長く残る ／ "good"…適温 ／ "thin"…ぬるい。薄く、小さく、すぐ消える ／
 *   "harsh"…熱すぎ。むせて、短くちぎれた煙が二度出る
 */
export function workerBreath(quality = "good", { x = .09, y = .66, colors = null } = {}) {
  const base = { x, y, angle: -.26, spread: .46, speed: .42, width: .004, dur: 1.25, rate: 15, size: .034, life: 2.2, buoy: .05, drag: 1.5, turb: .1, hold: .4, alpha: .86, swell: .5, sway: .1, colors };
  if (quality === "best") return [{ ...base, dur: 1.6, rate: 18, size: .04, life: 2.8, speed: .43, hold: .46 }];
  if (quality === "thin") return [{ ...base, dur: .8, rate: 8, size: .024, life: 1.4, speed: .3, alpha: .58, hold: .3 }];
  if (quality === "harsh") {
    const cough = { ...base, dur: .24, rate: 30, size: .026, life: 1.0, speed: .62, spread: 1.0, turb: .3, drag: 2.3, hold: .25, alpha: .8, flat: true, sway: 0 };
    return [cough, { ...cough, delay: .5, speed: .5, angle: -.5 }];
  }
  return [base];
}

/**
 * 煙の輪。小さな房を輪に並べ、形を保ったまま、ゆっくり広がりながら進ませる（スモークリング K21・龍の煙 M-S7）。
 * squash は輪のつぶれ方 [横, 縦]: 既定の [1, .42] は真上へ昇る輪（下から見上げた横長）、[.5, 1] は横へ吹いた輪（縦長）。
 * rise は昇る速さ、drift は横へ流れる速さ（右が正）
 */
export function ringBreath({ x = .5, y = .62, radius = .07, colors = null, delay = 0, grow = .05, rise = .13, drift = 0, life = 1.9, size = .024, squash = [1, .42], alpha = 1 } = {}) {
  const n = 18, [sx, sy] = squash;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU, vx = Math.cos(a) * grow * sx + drift, vy = Math.sin(a) * grow * sy - rise;
    // 1つの口から房を1つだけ出す。速さ・大きさをそろえ、空気のゆらぎを切って、輪の形を崩さない
    return { x: x + Math.cos(a) * radius * sx / ASPECT, y: y + Math.sin(a) * radius * sy, angle: Math.atan2(vy, vx), spread: 0, speed: Math.hypot(vx, vy), width: 0,
      dur: .1, delay, rate: 15, size, life, buoy: 0, drag: .25, turb: 0, hold: .55, flat: true, even: true, jitter: 0, alpha, colors };
  });
}

/**
 * 立ち絵の口元から吐く煙（会話の「間」の一服）。口元では細く、顔の外へ流れてからふくらみ、透けたまま消える
 * （顔を覆わない。煙ごしに表情が見える濃さ）。吐き方を人物の身ぶりにする:
 *   "long"…細く長く ／ "twice"…小さく二度 ／ "up"…ふわっと上へ ／ 既定…ひと息
 * side は吐く向き（1＝右へ、-1＝左へ）。顔の向いている側へ吐かせる
 */
export function mouthBreath(style = "", { x, y, side = 1, colors = null } = {}) {
  const dir = (a) => (side >= 0 ? a : Math.PI - a);
  // 口元から扇の形に広がる、ひとつながりの息にする: 房は小さく数を多く、向きと速さをそろえ、進むほどふくらませる。
  // 吐く強さは一定（flat）: 吐き終わりに弱い房を残すと、口元に留まって顔の前を昇ってしまう
  const base = { x, y, angle: dir(-.08), spread: .22, speed: .5, width: .003, dur: 1.2, rate: 21, size: .021, life: 1.5, buoy: .02, drag: 1.6, turb: .05, hold: .3, alpha: .7, swell: 1, jitter: .6, sway: .05, soft: true, flat: true, colors };
  if (style === "long") return [{ ...base, spread: .16, speed: .58, dur: 1.7, size: .02, life: 1.6 }];
  if (style === "twice") return [{ ...base, dur: .4, rate: 24, size: .019, life: 1.2, speed: .42 }, { ...base, dur: .45, delay: .75, rate: 24, size: .021, life: 1.3, speed: .46, angle: dir(-.24) }];
  // 上へ: 口元からは横へ出し、顔の外へ出てから浮かせる（斜め上へ吐くと、煙が目もとを横切る）
  if (style === "up") return [{ ...base, angle: dir(.1), spread: .26, speed: .46, buoy: .13, drag: 1.5, life: 2, hold: .4 }];
  return [base];
}

/**
 * 店にうっすら漂う煙のひとかたまり（KMR21）。部屋の中ほどより上に、ゆっくりふくらんで横へ流れ、長く残る。
 * 人が吐く煙より薄く・遅く。濃さは載せる層の透け具合（hazeLayer）で決める。
 */
export function hazeBreath(random = Math.random) {
  const right = random() < .5;
  return { x: .04 + .92 * random(), y: .12 + .27 * random(), angle: (right ? 0 : Math.PI) + (random() - .5) * .7, spread: 1.4, speed: .04, width: .1,
    dur: 1.6, rate: 1.8, size: .09, life: 11, buoy: .003, drag: .5, turb: .05, hold: .5, alpha: .8, swell: 3, soft: true };
}

// ---------------------------------------------------------------- 画面に載せる層

/** 煙を出してよいか。自動操作（テスト）・会話の早送り・「動きを減らす」では出さない（craft/fx.js の fxMode と同じ考え方） */
export function smokeAllowed() {
  const g = globalThis, remake = g.window?.__remake;
  if (remake?.craftTest?.auto || remake?.vnTest?.turbo) return false;
  if (typeof g.matchMedia !== "function" || typeof g.document?.createElement !== "function") return false;
  return !g.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const layers = new WeakMap();

/**
 * host いっぱいに煙の層（640×360 の canvas を拡大）を載せて返す。同じ host には1枚だけ作る。
 * cover を渡すと、canvas を cover の枠に合わせて host の中に置く（位置の 0〜1 は cover に対する割合になる）。
 * 煙が全部消えたら自分で止まり、canvas を外す。host は position が static 以外であること（ステージの層や画面の箱）。
 */
export function smokeLayer(host, { zIndex = 30, className = "", cover = null } = {}) {
  const had = layers.get(host);
  if (had?.canvas.isConnected) return had;
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W; canvas.height = GRID_H;
  canvas.className = `smoke-layer${className ? " " + className : ""}`;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", imageRendering: "pixelated", zIndex: String(zIndex) });
  // cover: canvas を host ではなく cover の枠に合わせる（host が cover の中の小さな窓のとき。煙は窓で切り抜かれ、升目は cover と同じ細かさ）
  const h = cover ? host.getBoundingClientRect() : null, c = cover?.getBoundingClientRect();
  if (h?.width && h.height && c?.width && c.height) {
    const pct = (v) => `${(v * 100).toFixed(3)}%`;
    Object.assign(canvas.style, { inset: "auto", left: pct((c.left - h.left) / h.width), top: pct((c.top - h.top) / h.height), width: pct(c.width / h.width), height: pct(c.height / h.height) });
  }
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const field = createSmokeField();
  const image = ctx ? ctx.createImageData(GRID_W, GRID_H) : null, px = image ? new Uint32Array(image.data.buffer) : null;
  const waits = [];
  let raf = 0, last = 0, acc = 0, sinceDraw = FRAME, dead = false;

  const settle = () => {
    for (let i = waits.length - 1; i >= 0; i--) if (dead || waits[i].ids.every((id) => field.done(id))) waits.splice(i, 1)[0].resolve();
  };
  const destroy = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    field.clear(); settle();
    canvas.remove();
    if (layers.get(host) === layer) layers.delete(host);
  };
  const tick = (now) => {
    if (dead) return;
    if (!canvas.isConnected) { destroy(); return; }
    const dt = Math.min(.1, (now - last) / 1000 || 0);
    last = now; acc += dt; sinceDraw += dt;
    let n = 0;
    while (acc >= STEP && n < 4) { field.step(STEP); acc -= STEP; n++; }
    if (acc > STEP * 4) acc = 0;
    if (sinceDraw >= FRAME) { sinceDraw = 0; field.paint(px); ctx.putImageData(image, 0, 0); }
    settle();
    if (field.busy) raf = requestAnimationFrame(tick);
    else destroy();
  };
  const layer = {
    canvas, field,
    /** 吐き方（上の *Breath が返す配列、または1つ）を足す。煙が消えきったら解決する Promise を返す */
    breathe(specs) {
      if (dead || !ctx) return Promise.resolve(false);
      const ids = [].concat(specs).map((s) => field.breath(s));
      const done = new Promise((resolve) => waits.push({ ids, resolve: () => resolve(true) }));
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      return done;
    },
    destroy,
  };
  layers.set(host, layer);
  return layer;
}

const HAZE_FRAME = 1 / 8; // 漂う煙は動きが遅いので、描くのは毎秒8コマ
const hazeLayers = new WeakMap();

/**
 * host いっぱいに、店に漂う煙の層を載せる（KMR21）。level（0〜1）で濃さと量を決める。開いた時点で、もう漂っている状態から始める。
 * 戻り値の setLevel で濃さを変え、stop でゆっくり消して外す。host は position が static 以外であること。
 */
export function hazeLayer(host, { level = 1, random = Math.random } = {}) {
  hazeLayers.get(host)?.destroy(); // 場面を素早く替えても、消えかけの煙を重ねない
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W; canvas.height = GRID_H;
  canvas.className = "smoke-layer smoke-haze";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", imageRendering: "pixelated", opacity: "0", transition: "opacity 1.2s ease" });
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  const field = createSmokeField({ random });
  const image = ctx ? ctx.createImageData(GRID_W, GRID_H) : null, px = image ? new Uint32Array(image.data.buffer) : null;
  let timer = 0, fadeTimer = 0, raf = 0, last = 0, wait = 0, dead = false, stopping = false;
  const emit = (dt) => {
    wait -= dt;
    if (wait > 0 || stopping) return;
    wait = (2.8 + 2.4 * random()) / Math.max(.35, level);
    field.breath(hazeBreath(random));
  };
  const draw = () => { if (ctx) { field.paint(px); ctx.putImageData(image, 0, 0); } };
  const destroy = () => {
    if (dead) return;
    dead = true;
    clearTimeout(timer); clearTimeout(fadeTimer); cancelAnimationFrame(raf);
    field.clear(); canvas.remove();
    if (hazeLayers.get(host) === layer) hazeLayers.delete(host);
  };
  const tick = (now) => {
    if (dead || stopping) return;
    if (!canvas.isConnected || document.hidden) { destroy(); return; }
    const dt = Math.min(.25, (now - last) / 1000 || 0);
    last = now;
    // 背景の煙は計算も8コマに合わせる。復帰時に遅れた時間を一気に計算しない。
    emit(dt); field.step(dt); draw();
    timer = setTimeout(() => tick(performance.now()), HAZE_FRAME * 1000);
  };
  // 最も濃い夜でも層は7%。背景を白く覆わず、気づく程度の薄さにする。
  const apply = () => { canvas.style.opacity = String(stopping ? 0 : .04 + .03 * level); };
  const layer = {
    canvas, field,
    get level() { return level; },
    setLevel(value) { if (dead || stopping) return; level = value; apply(); },
    /** ゆっくり消して外す */
    stop() {
      if (dead || stopping) return;
      stopping = true;
      clearTimeout(timer); cancelAnimationFrame(raf); field.clear();
      apply(); // 最後の絵を薄くするだけ。退場中の煙の計算は止める
      fadeTimer = setTimeout(destroy, 1300);
    },
    destroy,
  };
  hazeLayers.set(host, layer);
  if (!ctx) { destroy(); return layer; }
  // 入店時は小さな一房だけを育てる。14秒ぶんの空気を毎回計算して入力を止めない。
  for (let t = 0; t < 3; t += HAZE_FRAME) { emit(HAZE_FRAME); field.step(HAZE_FRAME); }
  draw();
  last = performance.now();
  raf = requestAnimationFrame(() => { if (!dead && !stopping) apply(); });
  timer = setTimeout(() => tick(performance.now()), HAZE_FRAME * 1000);
  return layer;
}
