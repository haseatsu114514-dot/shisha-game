// 新版の「場所の光」（BGU01）。いまの背景の絵から、立ち絵の立つあたりの平均色を測り、
// 立ち絵に乗算で重ねる色（白＝何も変えない）へ直す。層を置くのは looks/neo.js、見た目は css/look-neo.css。
//
// 背景は場所ごとに明るさも色も違う（暖色の暗い店・夜道・昼のカフェ）が、立ち絵はどこでも同じ白い光で描いてある。
// そのままだと暗い場所で人物だけが明るく浮くので、場所の暗さと色かぶりを少しだけ人物へ移す。
// 人物は主役なので、暗くするのは FLOOR まで、色を寄せるのは CAST まで（背景と同じ色・同じ暗さにはしない）。

/** 暗い場所でも、人物の明るさはこの割合より下げない。 */
export const AMBIENT_FLOOR = 0.72;
/** 色かぶりの強さ。0 で色を変えない。いちばん弱い色の成分でも 1 - CAST 倍までしか落とさない。 */
export const AMBIENT_CAST = 0.3;
/** この明るさ（0〜255 の輝度）以上の場所では、人物を暗くしない。 */
const BRIGHT = 128;
/** 真っ暗な場所での明るさの割合（FLOOR で止める前の値）。 */
const DARK = 0.62;
/** いちばん強い色の成分がこの値以上なら、色味を信じて CAST まで寄せる。 */
const COLOR_SURE = 32;
/** 夜の色調補正（css/base.css の .bg-img[data-tint="night"]）が絵に重ねる紺。 */
const NIGHT_VEIL = [12, 14, 48];

const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** 背景に掛かる色調補正（昼の絵を夜に見せる night・暗転の dim）を、測った平均色にも掛ける。 */
function tinted(mean, tint) {
  if (tint === "night") {
    const gray = luma(mean);
    return mean.map((v, i) => (gray + (v - gray) * 0.7) * 0.7 * 0.5 + NIGHT_VEIL[i] * 0.5);
  }
  if (tint === "dim") return mean.map((v) => v * 0.45);
  return mean;
}

/**
 * 背景の平均色（0〜255 の [r, g, b]）から、立ち絵へ乗算で重ねる色（0〜255 の整数 [r, g, b]）を返す。
 * 明るい場所では [255, 255, 255]（何も変えない）。暗い場所ほど暗く、色の付いた場所ほどその色へ寄る。
 */
export function ambientColor(mean, tint = "") {
  const color = tinted(mean.map((v) => Math.min(255, Math.max(0, Number(v) || 0))), tint);
  const top = Math.max(...color);
  const exposure = Math.min(1, Math.max(AMBIENT_FLOOR, DARK + (1 - DARK) * luma(color) / BRIGHT));
  // ほぼ真っ黒な場所は色味が当てにならない（わずかな差が強い色に見える）ので、暗いほど色かぶりを弱める。
  const cast = AMBIENT_CAST * Math.min(1, top / COLOR_SURE);
  return color.map((v) => Math.round(255 * exposure * (1 - cast * (top ? 1 - v / top : 0))));
}

/** CSS の色の書き方へ。 */
export const ambientCss = (rgb) => `rgb(${rgb.join(", ")})`;

// ---------------------------------------------------------------- 背景の絵を測る（ブラウザだけ）
const W = 32, H = 18;
// 立ち絵が立つあたり: 左右は中央の 7 割、上下は上から 2/3（下 1/3 は会話の帯で隠れる）。
const AREA = { x: 5, y: 1, w: 22, h: 11 };
const samples = new Map(); // 絵の URL → Promise<[r, g, b] | null>

/** 背景の絵（同じ配信元の URL）の、立ち絵が立つあたりの平均色。読めない・測れない時は null。同じ絵は一度しか測らない。 */
export function sampleBackground(url) {
  if (!url) return Promise.resolve(null);
  let task = samples.get(url);
  if (task) return task;
  task = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(AREA.x, AREA.y, AREA.w, AREA.h);
        const sum = [0, 0, 0];
        for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
        resolve(sum.map((v) => v / (data.length / 4)));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }).then((mean) => {
    // 読めなかった絵は覚えない（通信が戻れば次の場面で測り直す）。
    if (!mean) samples.delete(url);
    return mean;
  });
  samples.set(url, task);
  return task;
}
