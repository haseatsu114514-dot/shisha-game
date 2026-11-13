// 会話の「間」の一服（docs/owner_requests.md の KMR11）。台本の {"type":"fx","id":"exhale"} で、立ち絵の口元から煙を吐く。
//   who   … 吐く人（話者の id）。省くと、いま話している人（いなければ出ている一人）。"self" は自分（はじめ）＝画面の下から
//   style … 吐き方: "long"＝細く長く／"twice"＝小さく二度／"up"＝ふわっと上へ／""＝ひと息。省くと人物ごとの身ぶり
//   color・color2 … 煙にうっすら移す色（ふだんは白。色を付けるのは意味のある場面だけ）。tint は色の濃さ（0〜1・既定 0.5）
//   side  … 吐く向き（1＝右、-1＝左）。省くと、立ち位置から空いている側
//   x・y  … 立ち絵の口元ではなく、画面の決まった位置（0〜1）から出す（一枚絵の上に煙を立てるとき）。scale で大きさ
// 煙の描き方は core/smoke.js（もこもこの房・細かい升目・白に近い4色）。煙は口元からだけ出す。
// 早送り・「動きを減らす」・DS風の表示中は出さない（DS風は現行の画面を写す方式で、足した層は写らない）。
import { portraitInfo, faceFrame } from "../core/data.js";
import { smokeLayer, smokeAllowed, smokeTint, mouthBreath } from "../core/smoke.js";

/** 人物ごとの吐き方（身ぶり）。ここに無い人は、ひと息 */
export const BREATH_STYLE = Object.freeze({ sumi: "long", minto: "twice", tsumugi: "up" });
/** 吐いてから次の行へ進むまでの「間」（ミリ秒）。煙が顔の前に広がるのを待つ */
export const BREATH_HOLD = Object.freeze({ mouth: 650, self: 1100 });

/**
 * 立ち絵の口の位置と顔の大きさ（絵の幅・高さに対する割合）。顔アイコンと同じ顔の枠（manifest の faceFrames）から、
 * 口は頬の中央の真下・目から顔の大きさの3割下、として出す（測った3人で誤差は絵の上で数画素）。分からなければ null
 */
export function mouthInPortrait(speaker, face) {
  const info = portraitInfo(speaker, face);
  const frame = info && faceFrame(info.folder, info.style);
  // 私服（ura_）は顔の位置が別の絵なので、通常の服で測った枠は使わない
  if (!frame || String(info.face || face || "").startsWith("ura_") || speaker === "oneesan") return null;
  return { x: frame.eye[0] / 896, y: (frame.eye[1] + frame.unit * .3) / 1200, face: frame.unit / 1200 };
}

// 吐き方の数値（core/smoke.js の mouthBreath）は、顔の大きさが画面の高さの 14% のときの値。
// 立ち絵が大きく出る場面（寄り）でも煙が顔に見合うように、顔の大きさに合わせて煙の大きさ・勢い・口の幅を伸び縮みさせる
const FACE_BASE = .144;
const fit = (specs, k) => specs.map((b) => ({ ...b, size: b.size * k, speed: b.speed * Math.sqrt(k), width: b.width * k }));

/** 自分（はじめ）が吐く煙。台詞の箱の向こう（手前の下）から出て、右上へゆっくり流れ、長めに残る。部屋を透かす薄さ */
function selfBreath(colors) {
  return [{ x: .4, y: .8, angle: -1.05, spread: .7, width: .12, speed: .5, dur: 2.0, rate: 20, size: .09, life: 4.4, buoy: .035, drag: 1.2, turb: .1, hold: .45, alpha: .78, sway: .12, colors }];
}

/**
 * 煙を吐く。戻り値は、次の行へ進む前に待つ時間（ミリ秒）。出さなかったら 0。
 * host は会話の層（#vn）、portraits は立ち絵の入れ物。
 */
export function vnBreath(line, { host, portraits }) {
  if (!host || !smokeAllowed() || document.documentElement.dataset.retroShell === "on") return 0;
  // 色の濃さ: 自分の煙は葉の色を「うっすら」、それ以外で色を指定したときは、その色が分かる濃さ
  const tint = Number.isFinite(line.tint) ? line.tint : line.who === "self" ? .3 : .5;
  const colors = line.color ? [line.color, line.color2].filter(Boolean).map((c) => smokeTint(c, tint)) : null;
  const layer = () => smokeLayer(host, { zIndex: 4, className: "vn-breath" });
  if (line.who === "self") {
    layer().breathe(selfBreath(colors));
    return BREATH_HOLD.self;
  }
  if (Number.isFinite(line.x) && Number.isFinite(line.y)) {
    const k = Number.isFinite(line.scale) ? line.scale : 1;
    // 位置を決めて立てる煙は、色が主役（つむぎに見えている色）なので、色を残す塗りにする
    layer().breathe(fit(mouthBreath(line.style || "", { x: line.x, y: line.y, side: line.side ? Math.sign(line.side) : 1, colors }), k).map((b) => ({ ...b, vivid: !!colors })));
    return BREATH_HOLD.mouth;
  }
  const imgs = [...(portraits?.querySelectorAll("img.portrait") || [])];
  const img = line.who ? imgs.find((i) => i.dataset.speaker === line.who) : imgs.find((i) => i.classList.contains("active")) || (imgs.length === 1 ? imgs[0] : null);
  if (!img || img.classList.contains("enter")) return 0;
  const mouth = mouthInPortrait(img.dataset.speaker, img.dataset.face);
  const box = img.getBoundingClientRect(), stage = host.getBoundingClientRect();
  if (!mouth || !box.width || !stage.width) return 0;
  const x = (box.left + box.width * mouth.x - stage.left) / stage.width, y = (box.top + box.height * mouth.y - stage.top) / stage.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
  const side = line.side ? Math.sign(line.side) : img.dataset.pos === "right" ? -1 : 1;
  const scale = Math.max(.7, Math.min(2.2, (mouth.face * box.height / stage.height) / FACE_BASE));
  layer().breathe(fit(mouthBreath(line.style ?? BREATH_STYLE[img.dataset.speaker] ?? "", { x, y, side, colors }), scale));
  return BREATH_HOLD.mouth;
}
