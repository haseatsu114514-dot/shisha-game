// 煙の見本（docs/owner_requests.md の KMR）: 流体シミュレーション（WebGL2）。本編には未接続。
// 空気の流れ（速度）を解いて煙の濃さを流す。同じ煙を「リアル」「ドット×リアル」「セル画」の3つの見た目で描き分ける。
// 座標: 位置は画面に対する 0〜1（y は下向き）。速さ・半径は「画面の高さ＝1」の単位。

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
`;

const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
out vec2 vUv;
void main() { vec2 p = P[gl_VertexID]; vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }
`;

const NOISE = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(hash12(i), hash12(i + vec2(1., 0.)), f.x), mix(hash12(i + vec2(0., 1.)), hash12(i + vec2(1., 1.)), f.x), f.y);
}
// 重ねるたびに向きを回して、升目に沿った模様が出ないようにする
float fbm(vec2 p) {
  const mat2 R = mat2(1.6, 1.2, -1.2, 1.6);
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = R * p + 17.1; a *= .5; }
  return v / .9375;
}
`;

const SHADERS = {
  // 流れに沿って運ぶ。画面の外から来る分は「何もない空気」。
  advect: `${HEAD}
uniform sampler2D uVel, uSrc; uniform float uDt, uAspect, uKeep, uEdge;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  vec2 c = vUv - uDt * vec2(v.x / uAspect, v.y);
  vec4 s = texture(uSrc, c);
  if (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.) s = vec4(0.);
  float e = 1.;
  if (uEdge > 0.) {
    float side = min(vUv.x, 1. - vUv.x) * uAspect * 4.;
    e = smoothstep(0., uEdge, min(side, 1. - vUv.y)) * smoothstep(0., uEdge * .3, vUv.y);
  }
  o = s * uKeep * e;
}`,
  curl: `${HEAD}
uniform sampler2D uVel; uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.)).y, R = texture(uVel, vUv + vec2(uTexel.x, 0.)).y;
  float B = texture(uVel, vUv - vec2(0., uTexel.y)).x, T = texture(uVel, vUv + vec2(0., uTexel.y)).x;
  o = vec4(.5 * (R - L - T + B), 0., 0., 1.);
}`,
  // 渦を保つ力・煙の浮力・部屋の空気のゆらぎ
  force: `${HEAD}${NOISE}
uniform sampler2D uVel, uCurl, uDye; uniform vec2 uTexel, uWind;
uniform float uDt, uVort, uBuoy, uTurb, uTime, uAspect, uKeep;
vec2 curlNoise(vec2 p, float t) {
  const float e = .09;
  vec2 q = p + vec2(t * .11, -t * .07);
  float a = fbm(q + vec2(0., e)) - fbm(q - vec2(0., e));
  float b = fbm(q + vec2(e, 0.)) - fbm(q - vec2(e, 0.));
  return vec2(a, -b) / (2. * e);
}
void main() {
  vec2 v = texture(uVel, vUv).xy;
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.)).x, R = texture(uCurl, vUv + vec2(uTexel.x, 0.)).x;
  float B = texture(uCurl, vUv - vec2(0., uTexel.y)).x, T = texture(uCurl, vUv + vec2(0., uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + 1e-4; f *= uVort * C; f.y *= -1.;
  float d = texture(uDye, vUv).a;
  vec2 p = vUv * vec2(uAspect, 1.);
  vec2 turb = curlNoise(p * 2.6, uTime) + .55 * curlNoise(p * 6.3 + 11., uTime * 1.4);
  v += (f + vec2(0., uBuoy * min(d, 2.)) + turb * uTurb * (.3 + min(d, 1.2)) + uWind) * uDt;
  o = vec4(v * uKeep, 0., 1.);
}`,
  divergence: `${HEAD}
uniform sampler2D uVel; uniform vec2 uTexel;
void main() {
  float L = texture(uVel, vUv - vec2(uTexel.x, 0.)).x, R = texture(uVel, vUv + vec2(uTexel.x, 0.)).x;
  float B = texture(uVel, vUv - vec2(0., uTexel.y)).y, T = texture(uVel, vUv + vec2(0., uTexel.y)).y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
}`,
  // 画面の外は圧力0（開いた窓）。煙が端で跳ね返らずに出ていく。
  pressure: `${HEAD}
uniform sampler2D uP, uDiv; uniform vec2 uTexel;
float P(vec2 c) { return (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.) ? 0. : texture(uP, c).x; }
void main() {
  float s = P(vUv - vec2(uTexel.x, 0.)) + P(vUv + vec2(uTexel.x, 0.)) + P(vUv - vec2(0., uTexel.y)) + P(vUv + vec2(0., uTexel.y));
  o = vec4((s - texture(uDiv, vUv).x) * .25, 0., 0., 1.);
}`,
  gradient: `${HEAD}
uniform sampler2D uP, uVel; uniform vec2 uTexel;
float P(vec2 c) { return (c.x < 0. || c.x > 1. || c.y < 0. || c.y > 1.) ? 0. : texture(uP, c).x; }
void main() {
  vec2 g = vec2(P(vUv + vec2(uTexel.x, 0.)) - P(vUv - vec2(uTexel.x, 0.)), P(vUv + vec2(0., uTexel.y)) - P(vUv - vec2(0., uTexel.y)));
  o = vec4(texture(uVel, vUv).xy - .5 * g, 0., 1.);
}`,
  scale: `${HEAD}
uniform sampler2D uSrc; uniform float uK;
void main() { o = texture(uSrc, vUv) * uK; }`,
  // 煙・風を足す（1回の描画で最大12か所）。煙は生まれたときからムラを持たせる。
  splat: `${HEAD}${NOISE}
#define N 12
uniform sampler2D uSrc; uniform int uCount; uniform vec3 uPR[N]; uniform vec4 uVal[N];
uniform float uAspect, uNoise, uSeed, uFreq;
void main() {
  vec4 acc = vec4(0.);
  for (int i = 0; i < N; i++) {
    if (i >= uCount) break;
    vec2 d = vUv - uPR[i].xy; d.x *= uAspect;
    float r = uPR[i].z;
    acc += uVal[i] * exp(-dot(d, d) / (r * r));
  }
  float n = 1.;
  if (uNoise > 0.) n = mix(1., 2.3 * smoothstep(.24, .8, fbm(vUv * vec2(uAspect, 1.) * uFreq + vec2(uSeed, uSeed * .37))), uNoise);
  o = texture(uSrc, vUv) + acc * n;
}`,
  // はじめから店に漂っている薄い煙
  haze: `${HEAD}${NOISE}
uniform sampler2D uSrc; uniform vec4 uColor; uniform float uAspect, uSeed;
void main() {
  vec2 p = vUv * vec2(uAspect, 1.);
  // 横に長い筋が、目の高さより上に層になって溜まる
  float n = fbm(p * vec2(1.1, 3.4) + uSeed) * (.45 + .9 * fbm(p * vec2(2.6, 7.) + uSeed * 1.7 + 4.));
  float band = smoothstep(.2, .62, vUv.y) * smoothstep(1.02, .7, vUv.y) * smoothstep(0., .12, vUv.x) * smoothstep(1., .88, vUv.x);
  o = texture(uSrc, vUv) + uColor * smoothstep(.2, .62, n) * 1.5 * band;
}`,
};

// ---------------------------------------------------------------- 見た目（描画）

const VIEW_COMMON = `
uniform sampler2D uDye, uBg; uniform vec2 uRes, uLight; uniform vec3 uTintA, uTintB;
uniform float uAspect, uDensK, uShadowK, uSceneLight, uHasBg;
float dens(vec2 uv) { return max(texture(uDye, uv).a, 0.); }
// 光の来る側へ少しずつ進んで、手前の煙がどれだけ光をさえぎるかを測る（煙の厚みの影）
float occl(vec2 uv, float stepLen) {
  vec2 s = vec2(uLight.x / uAspect, uLight.y) * stepLen; float a = 0.;
  for (int i = 1; i <= 6; i++) a += dens(uv + s * float(i));
  return a / 6.;
}
// 光の側とその反対側の濃さの差（煙のふくらみの向き）。正＝光の反対側で影、負＝光の当たる縁
float relief(vec2 uv, float span) {
  vec2 s = vec2(uLight.x / uAspect, uLight.y) * span;
  float a = dens(uv + s), b = dens(uv - s), c = dens(uv);
  return clamp((a - b) / (c + .5 * (a + b) + .04), -1., 1.);
}
vec3 baseColor(vec4 dye) { return clamp(dye.rgb / max(dye.a, 1e-4), 0., 1.); }
`;

const VIEWS = {
  // リアル: 濃さ→透け具合、厚みの影、店の灯りの色を拾う
  real: `${HEAD}${NOISE}${VIEW_COMMON}
void main() {
  vec4 dye = texture(uDye, vUv); float d = max(dye.a, 0.);
  float op = 1. - exp(-d * uDensK);
  if (op < .003) { o = vec4(0.); return; }
  vec3 base = baseColor(dye);
  float sh = exp(-occl(vUv, .011) * uShadowK);
  vec3 amb = vec3(1.), glow = vec3(0.);
  if (uHasBg > .5) {
    vec2 buv = vec2(vUv.x, 1. - vUv.y);
    // 大きくぼかした背景＝その辺りの灯りの色。細かく拾うと、濃い煙が「背景のぼかし」に見えてしまう
    vec3 wide = textureLod(uBg, buv, 8.5).rgb, near = textureLod(uBg, buv, 5.).rgb;
    amb = mix(vec3(1.), wide + .64, uSceneLight * .8);
    glow = near * near * uSceneLight * .5 * op * (1. - op);
  }
  vec3 lit = base * amb;
  vec3 shade = lit * vec3(.64, .62, .76);
  float full = smoothstep(.93, 1., op);
  vec3 col = mix(shade, lit, clamp(.6 + .4 * mix(sh, .75, full) - .46 * relief(vUv, .012) * (1. - .75 * full), .1, 1.12));
  col = mix(col * vec3(.9, .94, 1.05), col, smoothstep(0., .55, op)) + glow;
  col += (hash12(gl_FragCoord.xy) - .5) * (2. / 255.);
  o = vec4(clamp(col, 0., 1.) * op, op);
}`,
  // ドット×リアル: 同じ煙を升目で拾い、白に近い数色と4段の透けで描く（網点は使わない）
  pixel: `${HEAD}${VIEW_COMMON}
uniform float uPx, uTones, uAlpha, uGain;
vec3 ramp(vec3 base, float t) {
  vec3 dark = base * vec3(.74, .72, .88);
  vec3 mid = mix(base * vec3(.90, .89, .97), vec3(1.), .25);
  vec3 hi = mix(base, vec3(1.), .92);
  return t < .5 ? mix(dark, mid, t * 2.) : mix(mid, hi, t * 2. - 1.);
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPx);
  vec2 uv = (cell + .5) * uPx / uRes;
  vec4 dye = texture(uDye, uv); float d = max(dye.a, 0.);
  float op = 1. - exp(-d * uDensK);
  // 薄いところは、升目ごと薄くする
  float lv = floor(clamp(op * uGain, 0., 1.) * 4. + .5) * .25;
  if (lv <= 0.) { o = vec4(0.); return; }
  float sh = exp(-occl(uv, .013) * uShadowK);
  float v = clamp(((.62 - .5 * relief(uv, .02)) * (.8 + .2 * sh) + .1 * op) * 1.12, 0., 1.);
  v = mix(v, .8, smoothstep(.95, 1., op));
  float n = uTones - 1.;
  float t = clamp(floor(v * n + .5), 0., n) / n;
  vec3 base = baseColor(dye);
  vec3 ab = uTintB - uTintA; float len = dot(ab, ab);
  if (len > 1e-4) { float w = clamp(dot(base - uTintA, ab) / len, 0., 1.); base = mix(uTintA, uTintB, floor(w * 2. + .5) * .5); }
  else base = uTintA;
  float a = lv * uAlpha;
  o = vec4(ramp(base, t) * a, a);
}`,
  // セル画: ドット×リアルと同じ塗り分けを、升目なしのなめらかな境目で。透けは3段、色は影・中間・明るい面の3色
  cel: `${HEAD}${VIEW_COMMON}
uniform float uLine, uSolid;
float blurD(vec2 uv, float r) {
  vec2 e = vec2(r / uAspect, r);
  float s = dens(uv) * .25;
  s += (dens(uv + vec2(e.x, 0.)) + dens(uv - vec2(e.x, 0.)) + dens(uv + vec2(0., e.y)) + dens(uv - vec2(0., e.y))) * .125;
  s += (dens(uv + e) + dens(uv - e) + dens(uv + vec2(e.x, -e.y)) + dens(uv + vec2(-e.x, e.y))) * .0625;
  return s;
}
void main() {
  const float R = .009;
  float d = blurD(vUv, R);
  float op = 1. - exp(-d * uDensK);
  float w = fwidth(op) * .9 + 1e-4;
  float a1 = smoothstep(.12 - w, .12 + w, op), a2 = smoothstep(.32 - w, .32 + w, op), a3 = smoothstep(.56 - w, .56 + w, op);
  float alpha = a1 * .3 + a2 * .32 + a3 * (.33 + .05 * uSolid);
  if (alpha < .004) { o = vec4(0.); return; }
  vec2 s = vec2(uLight.x / uAspect, uLight.y) * .02;
  float a = blurD(vUv + s, R), b = blurD(vUv - s, R);
  float rl = clamp((a - b) / (d + .5 * (a + b) + .04), -1., 1.);
  float sh = exp(-(a + blurD(vUv + s * 2.2, R)) * .5 * uShadowK);
  float v = clamp((.62 - .5 * rl) * (.8 + .2 * sh) + .1 * op, 0., 1.);
  v = mix(v, .7, smoothstep(.95, 1., op));
  float aa = fwidth(v) * .8 + 1e-4;
  vec3 base = baseColor(texture(uDye, vUv));
  vec3 dark = base * vec3(.50, .48, .70) + vec3(.02, .0, .05);
  vec3 mid = mix(base * vec3(.84, .82, .94), vec3(1.), .14);
  vec3 hi = mix(base, vec3(1., .995, .97), .86);
  vec3 col = mix(dark, mid, smoothstep(.4 - aa, .4 + aa, v));
  col = mix(col, hi, smoothstep(.56 - aa, .56 + aa, v));
  // いちばん外の縁に細い線（uLine は線の太さ。0で線なし）
  float edge = (op - .12) / max(length(vec2(dFdx(op), dFdy(op))), 1e-5);
  col = mix(col, base * vec3(.42, .38, .62), (1. - smoothstep(uLine - .7, uLine + .7, edge)) * step(.01, uLine) * .7);
  o = vec4(col * alpha, alpha);
}`,
};

const MAX_SPLATS = 12;

export function createFluid(canvas, { simH = 128, dyeH = 432 } = {}) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const program = (frag) => {
    const p = gl.createProgram();
    gl.attachShader(p, vert); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    const locs = new Map();
    return { p, u: (name) => { if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name)); return locs.get(name); } };
  };
  let progs, views;
  try {
    progs = Object.fromEntries(Object.entries(SHADERS).map(([k, src]) => [k, program(src)]));
    views = Object.fromEntries(Object.entries(VIEWS).map(([k, src]) => [k, program(src)]));
  } catch (err) {
    console.warn("smoke-styles: shader", err);
    return null;
  }

  const target = (w, h, internal, format) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return ok ? { tex, fbo, w, h } : null;
  };
  const pair = (w, h, internal, format) => {
    let a = target(w, h, internal, format), b = target(w, h, internal, format);
    if (!a || !b) return null;
    return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, w, h };
  };

  const aspect = 16 / 9;
  const simW = Math.round(simH * aspect), dyeW = Math.round(dyeH * aspect);
  // 2成分の半精度に描けない端末は4成分で代用する
  const rg = target(4, 4, gl.RG16F, gl.RG) ? [gl.RG16F, gl.RG] : [gl.RGBA16F, gl.RGBA];
  const r1 = target(4, 4, gl.R16F, gl.RED) ? [gl.R16F, gl.RED] : [gl.RGBA16F, gl.RGBA];
  const vel = pair(simW, simH, ...rg), prs = pair(simW, simH, ...r1);
  const div = target(simW, simH, ...r1), curl = target(simW, simH, ...r1);
  const dye = pair(dyeW, dyeH, gl.RGBA16F, gl.RGBA), held = target(dyeW, dyeH, gl.RGBA16F, gl.RGBA);
  if (!vel || !prs || !div || !curl || !dye || !held) return null;
  const simTexel = [1 / simW, 1 / simH];

  const bg = gl.createTexture();
  let hasBg = false, time = 0;
  const queue = { vel: [], dye: [] };

  const use = (prog) => { gl.useProgram(prog.p); return prog; };
  const bind = (prog, name, unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u(name), unit); };
  const draw = (t) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    if (t) gl.viewport(0, 0, t.w, t.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const flush = (list, buf, noise) => {
    const p = use(progs.splat);
    gl.uniform1f(p.u("uAspect"), aspect);
    gl.uniform1f(p.u("uNoise"), noise);
    for (let i = 0; i < list.length; i += MAX_SPLATS) {
      const part = list.slice(i, i + MAX_SPLATS);
      const pr = new Float32Array(MAX_SPLATS * 3), val = new Float32Array(MAX_SPLATS * 4);
      part.forEach((s, j) => { pr.set([s.x, 1 - s.y, s.r], j * 3); val.set(s.v, j * 4); });
      gl.uniform1i(p.u("uCount"), part.length);
      // ムラの細かさは口の大きさに合わせる（細い煙には細かいムラ）
      gl.uniform1f(p.u("uFreq"), Math.max(7, Math.min(24, .3 / (part.reduce((a, s) => a + s.r, 0) / part.length))));
      gl.uniform3fv(p.u("uPR[0]"), pr); gl.uniform4fv(p.u("uVal[0]"), val);
      gl.uniform1f(p.u("uSeed"), time * 1.3); // ムラは少しずつ流れる（コマごとに変えると平均されて消える）
      bind(p, "uSrc", 0, buf.read.tex);
      draw(buf.write); buf.swap();
    }
    list.length = 0;
  };

  const api = {
    // その場面の空気の性質（app.mjs の SCENES から入れる）
    params: { dyeFade: .4, velFade: .9, buoy: .1, vort: 22, turb: .05, wind: [0, 0], densK: 2.2, shadowK: 1.5, sceneLight: .7, dotGain: 1.5, solid: false },
    light: [-.48, .88],

    /** 吐く口（emitter）から、このコマのぶんの煙と風を足す。k は吐く強さ 0〜1 */
    emit(e, k, dt) {
      if (!e.rate) return;
      const n = e.splats || 2, col = e.colors;
      for (let i = 0; i < n; i++) {
        const side = Math.random() - .5;
        const a = e.angle + (Math.random() - .5) * e.spread;
        const sp = e.speed * k * (.5 + Math.random());
        // 口の幅は吐く向きに直角
        const x = e.x + (-Math.sin(e.angle) * side * (e.width || 0)) / aspect + (Math.random() - .5) * e.radius * .6 / aspect;
        const y = e.y + Math.cos(e.angle) * side * (e.width || 0) + (Math.random() - .5) * e.radius * .6;
        const r = e.radius * (.7 + .6 * Math.random());
        const c = col[col.length > 1 && side > 0 ? 1 : 0];
        // 吐き始めは、空気が動き出すまで煙を控える（止まった空気に溜まると、先頭だけ濃い輪になる）
        const amt = (e.rate * k * Math.min(1, e.t / .2) * dt) / n;
        queue.vel.push({ x, y, r: Math.max(r * 1.3, .022), v: [Math.cos(a) * sp * (e.push || 14) * dt, -Math.sin(a) * sp * (e.push || 14) * dt, 0, 0] });
        queue.dye.push({ x, y, r: r * (e.dyeWide || 1), v: [c[0] * amt, c[1] * amt, c[2] * amt, amt] });
      }
    },

    /** 店に漂う薄い煙を一面に置く */
    seedHaze(color, amount) {
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      const p = use(progs.haze);
      gl.uniform1f(p.u("uAspect"), aspect); gl.uniform1f(p.u("uSeed"), Math.random() * 40);
      gl.uniform4f(p.u("uColor"), color[0] * amount, color[1] * amount, color[2] * amount, amount);
      bind(p, "uSrc", 0, dye.read.tex);
      draw(dye.write); dye.swap();
    },

    step(dt) {
      const P = api.params;
      time += dt;
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      if (queue.vel.length) flush(queue.vel, vel, 0);
      if (queue.dye.length) flush(queue.dye, dye, .85);

      let p = use(progs.curl);
      gl.uniform2fv(p.u("uTexel"), simTexel); bind(p, "uVel", 0, vel.read.tex); draw(curl);

      p = use(progs.force);
      gl.uniform2fv(p.u("uTexel"), simTexel); gl.uniform2fv(p.u("uWind"), P.wind);
      gl.uniform1f(p.u("uDt"), dt); gl.uniform1f(p.u("uVort"), P.vort); gl.uniform1f(p.u("uBuoy"), P.buoy);
      gl.uniform1f(p.u("uTurb"), P.turb); gl.uniform1f(p.u("uTime"), time); gl.uniform1f(p.u("uAspect"), aspect);
      gl.uniform1f(p.u("uKeep"), Math.exp(-P.velFade * dt));
      bind(p, "uVel", 0, vel.read.tex); bind(p, "uCurl", 1, curl.tex); bind(p, "uDye", 2, dye.read.tex);
      draw(vel.write); vel.swap();

      p = use(progs.divergence);
      gl.uniform2fv(p.u("uTexel"), simTexel); bind(p, "uVel", 0, vel.read.tex); draw(div);

      p = use(progs.scale);
      gl.uniform1f(p.u("uK"), .8); bind(p, "uSrc", 0, prs.read.tex); draw(prs.write); prs.swap();

      p = use(progs.pressure);
      gl.uniform2fv(p.u("uTexel"), simTexel); bind(p, "uDiv", 1, div.tex);
      for (let i = 0; i < 22; i++) { bind(p, "uP", 0, prs.read.tex); draw(prs.write); prs.swap(); }

      p = use(progs.gradient);
      gl.uniform2fv(p.u("uTexel"), simTexel); bind(p, "uP", 0, prs.read.tex); bind(p, "uVel", 1, vel.read.tex);
      draw(vel.write); vel.swap();

      p = use(progs.advect);
      gl.uniform1f(p.u("uDt"), dt); gl.uniform1f(p.u("uAspect"), aspect);
      gl.uniform1f(p.u("uKeep"), 1); gl.uniform1f(p.u("uEdge"), 0);
      bind(p, "uVel", 0, vel.read.tex); bind(p, "uSrc", 1, vel.read.tex); draw(vel.write); vel.swap();
      gl.uniform1f(p.u("uKeep"), Math.exp(-P.dyeFade * dt)); gl.uniform1f(p.u("uEdge"), .02);
      bind(p, "uVel", 0, vel.read.tex); bind(p, "uSrc", 1, dye.read.tex); draw(dye.write); dye.swap();
    },

    /** コマ打ち用: いまの煙を1コマぶん写し取っておく */
    hold() {
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      const p = use(progs.scale);
      gl.uniform1f(p.u("uK"), 1); bind(p, "uSrc", 0, dye.read.tex); draw(held);
    },

    /** parts: [{ look, x0, x1, stepped, px, tones, tintA, tintB, line }]。x0〜x1 は画面の左からの割合 */
    render(parts) {
      const W = canvas.width, H = canvas.height, P = api.params;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      for (const part of parts) {
        const x0 = Math.round(part.x0 * W), x1 = Math.round(part.x1 * W);
        if (x1 <= x0) continue;
        gl.scissor(x0, 0, x1 - x0, H);
        const p = use(views[part.look]);
        bind(p, "uDye", 0, part.stepped ? held.tex : dye.read.tex);
        bind(p, "uBg", 1, bg);
        gl.uniform2f(p.u("uRes"), W, H); gl.uniform2fv(p.u("uLight"), api.light);
        gl.uniform3fv(p.u("uTintA"), part.tintA); gl.uniform3fv(p.u("uTintB"), part.tintB || part.tintA);
        gl.uniform1f(p.u("uAspect"), aspect); gl.uniform1f(p.u("uDensK"), P.densK);
        gl.uniform1f(p.u("uShadowK"), P.shadowK); gl.uniform1f(p.u("uSceneLight"), P.sceneLight);
        gl.uniform1f(p.u("uHasBg"), hasBg ? 1 : 0);
        if (part.look === "pixel") {
          gl.uniform1f(p.u("uPx"), Math.max(1, Math.round(part.px * W / 1280)));
          gl.uniform1f(p.u("uTones"), part.tones || 5); gl.uniform1f(p.u("uAlpha"), P.solid ? 1 : .92);
          gl.uniform1f(p.u("uGain"), P.dotGain); // 透けの段の上がりやすさ（薄く漂う場面では控える）
        }
        if (part.look === "cel") { gl.uniform1f(p.u("uLine"), (part.line ?? 1.3) * W / 1280); gl.uniform1f(p.u("uSolid"), P.solid ? 1 : 0); }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.SCISSOR_TEST);
    },

    /** 背景の絵。煙が店の灯りの色を拾うのに使う */
    setBackground(img) {
      gl.bindTexture(gl.TEXTURE_2D, bg);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        hasBg = true;
      } catch { hasBg = false; }
    },

    clear() {
      queue.vel.length = 0; queue.dye.length = 0;
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      for (const t of [vel.read, vel.write, prs.read, prs.write, dye.read, dye.write, held]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.clear(gl.COLOR_BUFFER_BIT); }
    },

    resize(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } },
    get lost() { return gl.isContextLost(); },
  };
  return api;
}
