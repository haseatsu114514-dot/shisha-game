// 会話の「間」の一服（docs/owner_requests.md の KMR11・KMR23〜）。台本の {"type":"fx","id":"exhale"} で、立ち絵の口元から煙を吐く。
//   who   … 吐く人（話者の id）。省くと、いま話している人（いなければ出ている一人）
//   style … 吐き方: "long"＝細く長く／"twice"＝小さく二度／"up"＝ふわっと上へ／""＝ひと息。省くと人物ごとの身ぶり
//   side  … 吐く向き（1＝右、-1＝左）。省くと、その人の顔の向いている側（決めていない人は、立ち位置から空いている側）
// 煙は、画面に見えている人の口元からだけ出す（吐く人が画面にいない場面では出さない。機材からも出さない）。
// 口元では細く、顔の外へ流れてからふくらみ、透けたまま消える。顔は覆わない。描き方は core/smoke.js（もこもこの房・細かい升目）。
// 早送り・「動きを減らす」・DS風の表示中は出さない（DS風は現行の画面を写す方式で、足した層は写らない）。
import { portraitInfo, faceFrame } from "../core/data.js";
import { smokeLayer, smokeAllowed, mouthBreath } from "../core/smoke.js";

/** 人物ごとの吐き方（身ぶり）。ここに無い人は、ひと息 */
export const BREATH_STYLE = Object.freeze({ sumi: "long", minto: "twice", tsumugi: "up" });
/** 人物ごとの顔の向き（立ち絵で顔が向いている側。1＝右、-1＝左）。煙は顔の向いている側へ吐く（後ろ頭の側へは流さない） */
export const BREATH_SIDE = Object.freeze({ sumi: -1, minto: -1, tsumugi: -1 });
/** 吐いてから次の行へ進むまでの「間」（ミリ秒）。煙が口元を離れるのを見せてから、地の文へ進む */
export const BREATH_HOLD = 500;

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

/**
 * 煙を吐く。戻り値は、次の行へ進む前に待つ時間（ミリ秒）。出さなかったら 0。
 * host は会話の層（#vn）、portraits は立ち絵の入れ物。
 */
export function vnBreath(line, { host, portraits }) {
  if (!host || !smokeAllowed() || document.documentElement.dataset.retroShell === "on") return 0;
  const imgs = [...(portraits?.querySelectorAll("img.portrait") || [])];
  const img = line.who ? imgs.find((i) => i.dataset.speaker === line.who) : imgs.find((i) => i.classList.contains("active")) || (imgs.length === 1 ? imgs[0] : null);
  if (!img || img.classList.contains("enter")) return 0;
  const speaker = img.dataset.speaker;
  const mouth = mouthInPortrait(speaker, img.dataset.face);
  const box = img.getBoundingClientRect(), stage = host.getBoundingClientRect();
  if (!mouth || !box.width || !stage.width) return 0;
  const x = (box.left + box.width * mouth.x - stage.left) / stage.width, y = (box.top + box.height * mouth.y - stage.top) / stage.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return 0;
  const side = line.side ? Math.sign(line.side) : BREATH_SIDE[speaker] ?? (img.dataset.pos === "right" ? -1 : 1);
  const scale = Math.max(.7, Math.min(2.2, (mouth.face * box.height / stage.height) / FACE_BASE));
  smokeLayer(host, { zIndex: 4, className: "vn-breath" }).breathe(fit(mouthBreath(line.style ?? BREATH_STYLE[speaker] ?? "", { x, y, side }), scale));
  return BREATH_HOLD;
}
