// 煙の見本（docs/owner_requests.md の KMR）: 丸い房を重ねて描く「もこもこ」の煙（Canvas 2D）。本編には未接続。
// 手描きのドット絵の煙と同じ組み立て: 大小の丸をまとめた「房」をいくつも重ねて雲の形を作る。
// 丸ごとに塗り分けず、重ねた丸を「高さの地図」にして、光の当たる縁を明るく、反対側の縁と房の谷間を暗く塗る
// （房の境目が、淡い色の違いとして中に出る）。升目ごとに決まった数色へそろえ、網点は使わない。
// 消えるときは、縮みながら全体が薄くなり、ちぎれる。
//   fine   … 繊細ドット: 細かい升目・白に近い4色・輪郭線なし・半透明
//   bold   … ドット絵もくもく: 粗めの升目・はっきりした4色・濃い輪郭線
//   smooth … アニメもくもく: 細かく描いて、なめらかに拡大する
// 座標: 位置は画面に対する 0〜1（y は下向き）。速さ・大きさは「画面の高さ＝1」の単位。

const TAU = Math.PI * 2;
const ASPECT = 16 / 9;

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

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const mul = (a, b) => a.map((v, i) => v * b[i]);

// 煙の色から塗りの色を作る。並びは [影, 中間, 明るい面, いちばん明るい縁, 輪郭線]
const TONES = {
  fine: (c) => [mul(c, [.84, .82, .94]), mix(mul(c, [.93, .92, .985]), [1, 1, 1], .3), mix(c, [1, 1, 1], .7), mix(c, [1, 1, 1], .95), mul(c, [.74, .72, .86])],
  bold: (c) => [mul(c, [.56, .54, .78]), mix(mul(c, [.86, .84, .95]), [1, 1, 1], .2), mix(c, [1, .995, .97], .72), mix(c, [1, 1, 1], .95), mul(c, [.36, .32, .56])],
};
const MODES = {
  fine: { tones: TONES.fine, outline: false, soft: 1.5, layer: .84, steps: 5 },
  bold: { tones: TONES.bold, outline: true, soft: 1.1, layer: 1, steps: 3 },
  smooth: { tones: TONES.bold, outline: true, soft: 1.2, layer: .97, steps: 4 },
};
const LIGHT = (() => { const v = [-.55, -.62, .56], n = Math.hypot(...v); return v.map((x) => x / n); })();

export function createPuffs(canvas, { mode = "fine" } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const M = MODES[mode];
  let parts = [], time = 0, colors = [[.93, .91, .96]], lut = [], api = null;
  let W = 0, H = 0, z, al, pl, image, px;

  // 色の表: [色の番号][塗り 0〜4][濃さの段] → 32bit の色（ImageData と同じ並び）
  const buildLut = () => {
    const layer = api?.params.solid ? 1 : M.layer;
    lut = colors.map((c) => M.tones(c).map((t) => {
      const [r, g, b] = t.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
      return Array.from({ length: M.steps + 1 }, (_, s) => ((Math.round(255 * layer * s / M.steps) << 24) | (b << 16) | (g << 8) | r) >>> 0);
    }));
  };

  const size = (p) => {
    const k = p.age / p.life;
    const grow = p.born ? 1 : 1 - (1 - Math.min(1, k / .18)) ** 3;
    const hold = api.params.hold, shrink = k < hold ? 1 : 1 - ((k - hold) / (1 - hold)) ** 1.7;
    return p.R * grow * (1 + .45 * k) * shrink;
  };
  // 房: 芯の丸いくつか・まわりの中くらいの丸・縁の小さな丸。大きな丸1つにせず、細かいふくらみの集まりにする。
  // まわりの丸は少し遅れてふくらむ（もこもこ育つ）。並びは [x, y, 大きさ, ふくらみ始める時期]
  const cluster = () => {
    const list = [], a0 = Math.random() * TAU;
    const ring = (n, dist, spread, size, vary, wait) => {
      const turn = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = a0 + turn + (i / n) * TAU + (Math.random() - .5) * 1.1 / n * TAU, d = dist + spread * Math.random();
        list.push([Math.cos(a) * d, Math.sin(a) * d, size + vary * Math.random(), wait * Math.random()]);
      }
    };
    list.push([0, 0, .62, 0]);
    ring(4, .3, .16, .46, .16, .08);
    ring(7, .62, .2, .3, .14, .26);
    ring(7, .9, .22, .15, .1, .34);
    return list;
  };
  const spawn = (x, y, vx, vy, R, life, pal, born = false) => parts.push({ x, y, vx, vy, R, life, pal, born, age: 0, seed: Math.random() * 40,
    spin: (Math.random() - .5) * .6, rot: Math.random() * TAU, disks: cluster(), split: born });

  api = {
    // hold: 寿命のどこまで縮まずにいるか。solid: 透かさずに塗る（画面を覆う場面）。fade: 消えぎわに薄くする
    params: { life: 2.4, buoy: .06, drag: 1.6, turb: .2, hold: .5, solid: false, fade: true },
    get count() { return parts.length; },

    /** 色と場面の性質（params）を入れたあとに呼ぶ */
    setColors(list) { colors = list; buildLut(); },

    emit(e, k, dt) {
      e.puffAcc = (e.puffAcc || 0) + (e.puffRate || 0) * k * dt;
      while (e.puffAcc >= 1) {
        e.puffAcc -= 1;
        const side = Math.random() - .5;
        const a = e.angle + (Math.random() - .5) * (e.puffSpread ?? e.spread);
        const sp = (e.puffSpeed ?? e.speed) * k * (.5 + .6 * Math.random());
        const s = .45 + .9 * Math.random() ** 1.5;
        // 大きい房ほど長く残る（縁の小さい房から先に消えて、芯が残る）
        const wide = e.puffWidth ?? e.width ?? 0;
        spawn(e.x + (-Math.sin(e.angle) * side * wide) / ASPECT, (e.puffY ?? e.y) + Math.cos(e.angle) * side * wide,
          Math.cos(a) * sp, Math.sin(a) * sp, e.puffSize * s, api.params.life * (e.puffEven ? .92 + .16 * Math.random() : .5 + .5 * s + .2 * Math.random()),
          colors.length > 1 && side > 0 ? 1 : 0);
      }
    },

    step(dt) {
      const P = api.params, old = parts;
      parts = [];
      time += dt;
      for (const p of old) {
        p.age += dt;
        if (p.age >= p.life) continue;
        // 大きな房は消えぎわに小さな房へちぎれる
        if (!p.split && p.age > p.life * .62 && p.R > .028) {
          p.split = true;
          const r = size(p);
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * TAU;
            spawn(p.x + Math.cos(a) * r * .7 / ASPECT, p.y + Math.sin(a) * r * .7, p.vx + Math.cos(a) * .04, p.vy + Math.sin(a) * .04,
              r * (.4 + .2 * Math.random()), p.life * (.35 + .2 * Math.random()), p.pal, true);
          }
        }
        const [fu, fv] = flow(p.x * ASPECT * 1.2 + p.seed * .02, p.y * 1.2, time * .6);
        const drag = Math.exp(-P.drag * dt);
        p.vx = p.vx * drag + fu * P.turb * dt * .5;
        p.vy = p.vy * drag + (fv * P.turb * .5 - P.buoy) * dt;
        p.x += (p.vx + fu * P.turb * .2) * dt / ASPECT;
        p.y += (p.vy + fv * P.turb * .2) * dt;
        p.rot += p.spin * dt;
        parts.push(p);
      }
    },

    draw() {
      if (canvas.width !== W || canvas.height !== H || !z) {
        W = canvas.width; H = canvas.height;
        z = new Float32Array(W * H); al = new Float32Array(W * H); pl = new Uint8Array(W * H);
        image = ctx.createImageData(W, H); px = new Uint32Array(image.data.buffer);
      }
      z.fill(0); al.fill(0);
      const unit = H / 360; // 高さの単位（升目の細かさが変わっても、同じ見え方にする）
      // 1) 丸を「てっぺんが平らな丘」として重ね、升目ごとにいちばん高い丘を残す
      for (const p of parts) {
        const R = size(p) * H;
        if (R < 1) continue;
        const k = p.age / p.life, c = Math.cos(p.rot), s = Math.sin(p.rot);
        const alpha = api.params.fade ? Math.min(1, (1 - k) * 2.3) : 1;
        for (const [ox, oy, rr, wait] of p.disks) {
          const g = p.born ? 1 : Math.min(1, Math.max(0, (k - wait) / .16));
          const r = R * rr * (1 - (1 - g) ** 2);
          if (r < .7) continue;
          const cx = p.x * W + (ox * c - oy * s) * R, cy = p.y * H + (ox * s + oy * c) * R;
          const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
          const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
          const inv = 1 / (r * r), top = 2.5 * unit + .3 * r, lift = 0;
          for (let y = y0; y <= y1; y++) {
            const dy = y + .5 - cy, dy2 = dy * dy;
            for (let x = x0, i = y * W + x0; x <= x1; x++, i++) {
              const dx = x + .5 - cx, t2 = (dx * dx + dy2) * inv;
              if (t2 >= 1) continue;
              const h = lift + top * (1 - t2 * t2 * t2) + .01; // てっぺんはほぼ平ら、縁に向かって丸く落ちる
              if (h > z[i]) { z[i] = h; pl[i] = p.pal; }
              if (alpha > al[i]) al[i] = alpha; // 透けは、重なった丸のうちいちばん濃いものに合わせる（丸ごとの濃淡を出さない）
            }
          }
        }
      }
      // 2) 丘の傾きから、光の当たり方で4色に塗り分ける
      const [lx, ly, lz] = LIGHT, s2 = 2 * M.soft * unit, flat = s2 * lz, steps = M.steps;
      for (let y = 0, i = 0; y < H; y++) {
        for (let x = 0; x < W; x++, i++) {
          const zc = z[i];
          if (zc <= 0) { px[i] = 0; continue; }
          const zl = x > 0 ? z[i - 1] : 0, zr = x < W - 1 ? z[i + 1] : 0, zu = y > 0 ? z[i - W] : 0, zd = y < H - 1 ? z[i + W] : 0;
          const edge = zl <= 0 || zr <= 0 || zu <= 0 || zd <= 0;
          const gx = (zr > 0 ? zr : zc) - (zl > 0 ? zl : zc), gy = (zd > 0 ? zd : zc) - (zu > 0 ? zu : zc);
          const lam = (-gx * lx - gy * ly + flat) / Math.sqrt(gx * gx + gy * gy + s2 * s2);
          let tone = lam >= .8 ? 3 : lam >= .44 ? 2 : lam >= .16 ? 1 : 0;
          if (M.outline && edge) tone = 4;
          px[i] = lut[pl[i] < lut.length ? pl[i] : 0][tone][Math.max(1, Math.round(al[i] * steps))];
        }
      }
      ctx.putImageData(image, 0, 0);
    },

    clear() { parts = []; ctx.clearRect(0, 0, canvas.width, canvas.height); },
    resize(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } },
  };
  buildLut();
  return api;
}
