// 立体の20面ダイス（TRF36）。正二十面体を Canvas 2D で描く（外部ライブラリなし）。
// 20面すべてに数字（向かい合う面の和が21）、左上からの光・面ごとの陰影・金の縁。
// 向き（姿勢）は「最後に出る面がこちらを向いた姿勢」から、ある軸まわりに θ だけ回した形で表す。θ を 0 へ寄せていけば、
// 回りながら必ず本当の出目の面で止まる（出目は呼び出し側が決めた値。ここでは何も決めない）。
const PHI = (1 + Math.sqrt(5)) / 2;
const V = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]];
const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
const RADIUS = Math.hypot(1, PHI);

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(...a));
/** 3x3 の行列（行の配列）。 */
const mm = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const transpose = A => [0, 1, 2].map(i => [0, 1, 2].map(j => A[j][i]));
/** 軸 a（単位ベクトル）まわりに θ 回す（ロドリゲスの式）。 */
function axisRot(a, t) {
  const [x, y, z] = a, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}
const rotX = t => axisRot([1, 0, 0], t), rotY = t => axisRot([0, 1, 0], t);

// 面ごとの重心・法線、向かい合う面、数字（向かい合う面の和が21）。
const FACES = F.map(f => {
  const c = mul(add(add(V[f[0]], V[f[1]]), V[f[2]]), 1 / 3);
  return { v: f, c, n: norm(c) };
});
{
  let k = 1;
  FACES.forEach((face, i) => {
    if (face.num) return;
    const opposite = FACES.findIndex(g => dot(g.n, face.n) < -0.99);
    face.num = k; FACES[opposite].num = 21 - k; k++;
    void i;
  });
}
// 面の上の数字の向き: 頂点 v[0] を「上」に、残りの2つは左右（面の外から見て左が bl）。
for (const face of FACES) {
  const u = norm(sub(V[face.v[0]], face.c)), w = cross(face.n, u);
  face.u = u; face.w = w;
  const [a, b] = [face.v[1], face.v[2]];
  // 正面から見た時に w は画面の左を向く（最後の姿勢の作り方）。w 側の頂点が左下。
  face.order = dot(sub(V[a], face.c), w) > 0 ? [face.v[0], a, b] : [face.v[0], b, a];
}
// 止まった時の傾きは浅く（出目の面がほぼ正面。深くすると隣の面も同じくらい正面を向き、どれが出目か迷う）。
const TILT = mm(rotX(-0.1), rotY(0.08));

/** 出目 value の面がこちらを向き、数字がまっすぐ立つ姿勢（少しだけ傾けて立体に見せる）。 */
export function restPose(value) {
  const face = FACES.find(f => f.num === value) || FACES[0];
  // R * [u w n] = [ey, -ex, ez] になる R。
  const Fm = transpose([face.u, face.w, face.n]); // 列が u, w, n
  const T = transpose([[0, 1, 0], [-1, 0, 0], [0, 0, 1]]);
  return mm(TILT, mm(T, transpose(Fm)));
}
export function randomAxis() {
  const z = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), r * Math.sin(t), z];
}

// 光は正面のやや左上から（出目の面がいちばん明るい）。
const LIGHT = norm([-0.3, 0.42, 0.86]), HALF = norm(add(LIGHT, [0, 0, 1]));
const PALETTE = {
  ivory: { base: [246, 234, 206], shade: [196, 182, 140], edge: "#b8862c", glint: "#f8e3a2", ink: "#3a2608" },
  critical: { base: [255, 216, 112], shade: [214, 130, 30], edge: "#fff1b8", glint: "#ffffff", ink: "#6a2000" },
  fumble: { base: [150, 160, 182], shade: [70, 84, 110], edge: "#4a5a7a", glint: "#c9d6ee", ink: "#0e1830" },
};
// 数字の型: 一辺100の正三角形（重心が原点）。小さすぎる文字の大きさは端末によって潰れるので、100倍の座標で描く。
const CANON = [[0, -57.74], [-50, 28.87], [50, 28.87]];

/**
 * canvas に1個のダイスを描く部品。Canvas 2D が使えない環境では null。
 * draw(M) で姿勢 M（3x3）を描く。tone("ivory" | "critical" | "fumble") で色を変える。
 */
export function createD20(canvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx || typeof ctx.setTransform !== "function") return null;
  let tone = "ivory", scale = 1;
  const font = getComputedStyle?.(canvas)?.fontFamily || "sans-serif";
  function resize(cssSize, pixelRatio) {
    scale = Math.max(1, Math.min(3, pixelRatio));
    canvas.width = canvas.height = Math.round(cssSize * scale);
  }
  function draw(M) {
    const W = canvas.width, cx = W / 2, cy = W / 2, D = 7, K = W * 0.42 / RADIUS;
    const P = V.map(v => {
      const p = mv(M, v), s = D / (D - p[2]);
      return { x: cx + p[0] * s * K, y: cy - p[1] * s * K, z: p[2] };
    });
    const pal = PALETTE[tone];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.lineJoin = "round";
    const visible = [];
    for (const face of FACES) {
      const n = mv(M, face.n), c = mv(M, face.c);
      if (dot(n, sub([0, 0, D], c)) <= 0) continue;
      visible.push({ face, n });
    }
    // 面の塗り: 環境光＋拡散光＋鏡面の照り。光の当たらない面には、下のフェルトの緑がうっすら映る。
    for (const { face, n } of visible) {
      const diffuse = Math.max(0, dot(n, LIGHT)), spec = Math.pow(Math.max(0, dot(n, HALF)), 26);
      const k = 0.56 + 0.42 * diffuse, shadeMix = (1 - diffuse) * 0.45;
      const rgb = pal.base.map((v, i) => Math.min(255, Math.round((v * (1 - shadeMix) + pal.shade[i] * shadeMix) * k + spec * 55)));
      const [a, b, c] = face.order.map(i => P[i]);
      const grad = ctx.createLinearGradient(a.x, a.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      grad.addColorStop(0, `rgb(${rgb.map(v => Math.min(255, v + 10)).join(",")})`);
      grad.addColorStop(1, `rgb(${rgb.map(v => Math.max(0, v - 8)).join(",")})`);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    // 数字: 面の三角へ、正三角形の型を当てはめて描く（面と一緒に傾き、縮む）。
    for (const { face, n } of visible) {
      const inkAlpha = Math.min(1, (n[2] - 0.5) * 2.1);
      if (inkAlpha <= 0) continue;
      const [p0, p1, p2] = face.order.map(i => P[i]);
      const [c0, c1, c2] = CANON;
      const dx1 = [c1[0] - c0[0], c1[1] - c0[1]], dx2 = [c2[0] - c0[0], c2[1] - c0[1]];
      const dp1 = [p1.x - p0.x, p1.y - p0.y], dp2 = [p2.x - p0.x, p2.y - p0.y];
      const det = dx1[0] * dx2[1] - dx2[0] * dx1[1];
      const a = (dp1[0] * dx2[1] - dp2[0] * dx1[1]) / det, cc = (dp2[0] * dx1[0] - dp1[0] * dx2[0]) / det;
      const b = (dp1[1] * dx2[1] - dp2[1] * dx1[1]) / det, d = (dp2[1] * dx1[0] - dp1[1] * dx2[0]) / det;
      const e = p0.x - (a * c0[0] + cc * c0[1]), f = p0.y - (b * c0[0] + d * c0[1]);
      ctx.setTransform(a, b, cc, d, e, f);
      const label = String(face.num), size = label.length > 1 ? 34 : 42;
      ctx.font = `900 ${size}px ${font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      // 正面の面（出目）ほど濃く、斜めを向いた面ほど薄く。小さく描いても出目が読めるように。
      ctx.globalAlpha = inkAlpha;
      ctx.fillStyle = pal.ink;
      ctx.fillText(label, 0, 4);
      // 6 と 9 は下に線（上下の見分け）。
      if (face.num === 6 || face.num === 9) ctx.fillRect(-9, 4 + size * 0.42, 18, 2.5);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 稜線: 金の縁。外側を太く暗く、内側に細い照り。
    const edges = new Set();
    for (const { face } of visible) for (let i = 0; i < 3; i++) {
      const a = face.v[i], b = face.v[(i + 1) % 3], key = a < b ? a + "-" + b : b + "-" + a;
      if (edges.has(key)) continue;
      edges.add(key);
      ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y);
      ctx.strokeStyle = pal.edge; ctx.lineWidth = W * 0.014; ctx.stroke();
      ctx.strokeStyle = pal.glint; ctx.lineWidth = W * 0.005; ctx.stroke();
    }
  }
  return {
    resize, draw,
    tone(value) { tone = PALETTE[value] ? value : "ivory"; },
    get scale() { return scale; },
  };
}

/** 姿勢: 最後の姿勢 R に、軸 axis まわり θ の回転を（ダイスの体の中で）先に掛けたもの。θ=0 で最後の姿勢。 */
export function pose(R, axis, theta) {
  return theta ? mm(R, axisRot(axis, theta)) : R;
}
