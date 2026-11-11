// 煙の見本（docs/owner_requests.md の KMR）: 丸の集まりで描く「もくもく」の煙（Canvas 2D）。本編には未接続。
// 手描きの煙と同じ組み立て: 大小の丸をまとめた「房」をいくつも重ねて雲の形を作り、
// 形ぜんたいを 輪郭→影→中間→明るい面 の順に光の側へずらして塗る（丸ごとには塗り分けない）。
// 大きな房には、ふくらみを示す短い弧を描き足す。薄くして消さず、縮んで、ちぎれて消える。
// smooth=false は粗い升目に描いて色数を絞る（ドット絵）。
// 座標: 位置は画面に対する 0〜1（y は下向き）。速さ・大きさは「画面の高さ＝1」の単位。

const TAU = Math.PI * 2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
const ASPECT = 16 / 9;

/** 部屋の空気のゆらぎ（渦のある流れ）。流れの関数 ψ を sin の重ね合わせで作り、その回転を速度にする */
function flow(x, y, t) {
  let u = 0, v = 0;
  const W = [[5.1, 3.3, .9, 0], [-3.7, 6.2, 1.3, 2.1], [8.3, -4.9, 1.9, 4.4], [2.2, 9.1, .7, 1.2]];
  for (const [kx, ky, w, ph] of W) {
    const c = Math.cos(kx * x + ky * y + w * t + ph) / Math.hypot(kx, ky);
    u += ky * c; v -= kx * c;
  }
  return [u, v];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const to255 = (c) => c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));

/** 煙の色から 輪郭・影・中間・明るい面 の4色を作る（影は青紫へ寄せ、明るい側は白へ寄せる） */
export function tones(base) {
  return [
    [base[0] * .36, base[1] * .32, base[2] * .56],
    [base[0] * .56 + .02, base[1] * .54, base[2] * .76 + .05],
    mix([base[0] * .86, base[1] * .84, base[2] * .95], [1, 1, 1], .2),
    mix(base, [1, .995, .97], .86),
  ].map(to255);
}

const KEY = [40, 110, 180, 250]; // 升目に描くときの色の番号（赤の値）

export function createPuffs(canvas, { smooth = false } = {}) {
  const ctx = canvas.getContext("2d", { willReadFrequently: !smooth });
  if (!ctx) return null;
  let parts = [], time = 0, palettes = [tones([.93, .91, .96])];

  const scale = (p) => {
    const k = p.age / p.life;
    const grow = p.born ? 1 : 1 - (1 - Math.min(1, k / .2)) ** 3;
    const hold = api.params.hold, shrink = k < hold ? 1 : 1 - ((k - hold) / (1 - hold)) ** 1.8;
    return p.R * grow * (1 + .4 * k) * shrink;
  };
  // 房: まん中の丸のまわりに、小さめの丸を3〜5個くっつける
  const cluster = () => {
    const n = 3 + Math.floor(Math.random() * 3), a0 = Math.random() * TAU, list = [[0, 0, 1]];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + (Math.random() - .5) * .7, rr = .42 + .36 * Math.random();
      list.push([Math.cos(a) * (.5 + .35 * Math.random()), Math.sin(a) * (.5 + .35 * Math.random()), rr]);
    }
    return list;
  };
  const spawn = (x, y, vx, vy, R, life, pal, born = false) => parts.push({ x, y, vx, vy, R, life, pal, born, age: 0, seed: Math.random() * 40,
    spin: (Math.random() - .5) * .5, rot: 0, disks: cluster(), split: born });

  const api = {
    params: { life: 2.4, buoy: .06, drag: 1.6, turb: .2, hold: .5 }, // hold: 寿命のどこまで縮まずにいるか
    light: [-.62, -.78],
    get count() { return parts.length; },

    setColors(colors) { palettes = colors.map(tones); },

    emit(e, k, dt) {
      e.puffAcc = (e.puffAcc || 0) + (e.puffRate || 0) * k * dt;
      while (e.puffAcc >= 1) {
        e.puffAcc -= 1;
        const side = Math.random() - .5;
        const a = e.angle + (Math.random() - .5) * e.spread;
        const sp = (e.puffSpeed ?? e.speed) * k * (.5 + .6 * Math.random());
        const size = .4 + .95 * Math.random() ** 1.5;
        // 大きい房ほど長く残る（縁の小さい房から先に消えて、芯が残る）
        spawn(e.x + (-Math.sin(e.angle) * side * (e.width || 0)) / ASPECT, (e.puffY ?? e.y) + Math.cos(e.angle) * side * (e.width || 0),
          Math.cos(a) * sp, Math.sin(a) * sp, e.puffSize * size, api.params.life * (e.puffEven ? .92 + .16 * Math.random() : .5 + .5 * size + .2 * Math.random()),
          palettes.length > 1 && side > 0 ? 1 : 0);
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
        if (!p.split && p.age > p.life * .6 && p.R > .03) {
          p.split = true;
          const r = scale(p);
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
      const w = canvas.width, h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      const [lx, ly] = api.light, edge = smooth ? Math.max(1.5, h / 360) : 1;
      // 房をほどいて、丸の一覧にする（px 単位）
      const disks = [];
      let sum = 0;
      for (const p of parts) {
        const R = scale(p) * h, c = Math.cos(p.rot), s = Math.sin(p.rot);
        if (R < 1) continue;
        // ドット絵は消えぎわを網点で散らす。なめらかな方は縮むだけ。
        const alpha = smooth ? 1 : Math.min(1, (1 - p.age / p.life) * 3);
        for (const [ox, oy, rr] of p.disks) disks.push({ x: p.x * w + (ox * c - oy * s) * R, y: p.y * h + (ox * s + oy * c) * R, r: R * rr, pal: p.pal, alpha, arc: rr === 1 && p.seed < 22 });
        sum += R;
      }
      const mean = parts.length ? sum / parts.length : 1;
      const color = (tone, pal) => { const c = smooth ? palettes[pal][tone] : [KEY[tone], pal ? 255 : 0, 0]; return `rgb(${c[0]},${c[1]},${c[2]})`; };
      // 形ぜんたいを1つの雲として塗る。影より上の色は、雲の内側にだけ、光の側へずらして重ねる。
      const layer = (tone, shift, k, grow, op) => {
        ctx.globalCompositeOperation = op;
        for (let pal = 0; pal < palettes.length; pal++) {
          ctx.fillStyle = color(tone, pal);
          for (const d of disks) {
            if (d.pal !== pal) continue;
            ctx.globalAlpha = op === "source-over" ? d.alpha : 1;
            ctx.beginPath();
            ctx.arc(d.x + lx * shift, d.y + ly * shift, Math.max(.5, d.r * k + grow), 0, TAU);
            ctx.fill();
          }
        }
      };
      layer(0, 0, 1, edge, "source-over");
      layer(1, 0, 1, 0, "source-over");
      layer(2, mean * .22, .97, 0, "source-atop");
      layer(3, mean * .62, .88, 0, "source-atop");
      // ふくらみの弧: 大きな房の、光と反対側に短い線
      ctx.globalCompositeOperation = "source-atop"; ctx.globalAlpha = 1;
      ctx.lineCap = "round";
      const away = Math.atan2(-ly, -lx);
      for (const d of disks) {
        if (!d.arc || d.r < mean * .8 || d.r < (smooth ? 16 : 5)) continue;
        ctx.strokeStyle = color(2, d.pal);
        ctx.lineWidth = Math.max(smooth ? 2 : 1, d.r * .09);
        ctx.beginPath(); ctx.arc(d.x + lx * d.r * .12, d.y + ly * d.r * .12, d.r * .66, away - .95, away + .75); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      if (smooth) return;
      // 升目ごとに「透明／4色のどれか」へそろえる（半端な色・半透明を残さない）
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (let y = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i += 4) {
          const a = d[i + 3] / 255;
          if (a < .2 + BAYER[(y & 3) * 4 + (x & 3)] * .78) { d[i + 3] = 0; continue; }
          const r = d[i], c = palettes[d[i + 1] > 127 && palettes.length > 1 ? 1 : 0][r < 75 ? 0 : r < 145 ? 1 : r < 215 ? 2 : 3];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 250;
        }
      }
      ctx.putImageData(img, 0, 0);
    },

    clear() { parts = []; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); },
    resize(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } },
  };
  return api;
}
