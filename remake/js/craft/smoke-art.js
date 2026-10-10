// 吸い出し・熱管理の右ウインドウに漂う煙（TH88）。線の模様ではなく、ゆがめたノイズで作る柔らかい煙。
// 画像は一度だけ描いて使い回し、動きは上へ昇って薄れる2枚の重ねで出す（重い毎フレームの描画をしない）。
import { el } from "../core/util.js";

const urls = new Map();

function noiseOf(seed) {
  let s = (seed * 9301 + 49297) % 2147483647;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  for (let i = 0; i < 256; i++) G[i] = rnd();
  const ease = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = ease(x - xi), v = ease(y - yi), X = xi & 255, Y = yi & 255;
    const a = G[P[P[X] + Y]], b = G[P[P[X + 1] + Y]], c = G[P[P[X] + Y + 1]], d = G[P[P[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, octaves = 4) => {
    let v = 0, amp = .5, f = 1;
    for (let i = 0; i < octaves; i++) { v += amp * noise(x * f, y * f); f *= 2.02; amp *= .5; }
    return v / (1 - .5 ** octaves);
  };
}

/** 下から立ちのぼり、上で広がって消える一筋の煙。res<1で粗く描いてCSSで拡大する（煙は柔らかいので目立たない）。 */
function paintWisp({ w, h, seed, scale = .012, sway = .2, lean = 0, alpha = .55, res = .5, freq = 5.2, curl = .8, base = .05 }) {
  const cw = Math.max(8, Math.round(w * res)), ch = Math.max(8, Math.round(h * res));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(cw, ch), data = img.data, fbm = noiseOf(seed), k = scale / res;
  for (let y = 0; y < ch; y++) {
    const t = 1 - y / ch;
    for (let x = 0; x < cw; x++) {
      const px = x * k, py = y * k;
      // 二重にゆがめた座標で、渦と細い筋をつくる。
      const qx = fbm(px + 1.7, py + 9.2), qy = fbm(px + 8.3, py + 2.8);
      const r = fbm(px + 3 * qx + 4.1, py + 3 * qy + 1.3);
      const bend = Math.sin(t * freq + seed) + .45 * Math.sin(t * freq * 2.3 + seed * 1.7);
      const center = cw * (.5 + lean * (t - .5)) + bend * cw * sway * (.25 + t) + (qx - .5) * cw * curl * t;
      const dist = Math.abs(x - center) / (cw * (base + .3 * t ** 1.2));
      let body = Math.max(0, 1 - dist);
      body = body * body * (3 - 2 * body);
      const ridge = 1 - Math.abs(2 * r - 1);
      const density = body * (.35 + .9 * ridge ** 3) * Math.min(1, t * 6) * (1 - t) ** 1.3 * (.6 + .8 * qy);
      const i = (y * cw + x) * 4;
      data[i] = 238; data[i + 1] = 230; data[i + 2] = 245; data[i + 3] = Math.min(1, density * 1.4) * alpha * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

const WISPS = {
  title: { w: 90, h: 120, seed: 5, scale: .028, sway: .2, freq: 7, curl: .5, base: .1, alpha: .85, res: 1 },
  corner: { w: 280, h: 340, seed: 11, sway: .16, lean: -.5, alpha: .42, curl: 1 },
  left: { w: 300, h: 360, seed: 3, sway: .14, lean: .45, alpha: .4, curl: 1 },
  right: { w: 260, h: 320, seed: 17, sway: .15, lean: -.45, alpha: .38, curl: 1 },
};

export function smokeUrl(key) {
  if (!urls.has(key)) urls.set(key, paintWisp(WISPS[key]));
  return urls.get(key);
}

/** 右ウインドウの奥の煙の層。表示はCSSで吸い出し・熱管理だけに限る。 */
export function buildPanelSmoke(host) {
  const parts = ["corner", "left", "right"].map((key) => el(`i.panel-smoke-wisp.w-${key}`, { "aria-hidden": "true" }));
  const root = el("div.panel-smoke", { "aria-hidden": "true" }, parts);
  // 開いた直後の描画を止めないよう、少し後に描く。
  setTimeout(() => {
    host.style.setProperty("--smoke-title", `url("${smokeUrl("title")}")`);
    parts.forEach((part, i) => part.style.setProperty("--smoke", `url("${smokeUrl(["corner", "left", "right"][i])}")`));
    root.classList.add("ready");
  }, 0);
  return root;
}
