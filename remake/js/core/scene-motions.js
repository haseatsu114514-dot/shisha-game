// 場面ごとの一度きりのモーショングラフィックス（CI107〜CI109）。中身は remake/js/motions/ の場面ごとのファイル。
// チェキ（PEPPERMINT）／占いのタロット／締めくくりの贈り物／バイトの終わり／サメちゃんとの出会い／つむぎのスケッチ。
// 各場面に a／b の2パターン（?movar=b か __remake.dev.motionVariant("b")）、配色は紫1色／場面ごとの色（?mopal=free）。
// SKIP中と動きを減らす設定では省く（背景を替える mid() だけは呼ぶ）。
import { state } from "./state.js";
import { DB } from "./data.js";
import { reducedMotion } from "./transition-kit.js";
import { motionVariant } from "./mg-kit.js";

// 場面のファイルは使うときに読む（一つの場面の不具合がほかの場面やゲームの起動を止めないように）
const cheki = () => import("../motions/cheki.js");
const tarot = () => import("../motions/tarot.js");
const gift = () => import("../motions/gift.js");
const shift = () => import("../motions/shift.js");
const shark = () => import("../motions/shark.js");
const sketch = () => import("../motions/sketch.js");

const skipMotion = () => reducedMotion() || document.body.classList.contains("vn-skip");
/** 今のパターンの関数。読めなかったときは null（演出を省いて先へ進む） */
const variant = async (load) => {
  const mod = await load().catch((e) => { console.error(e); return null; });
  return mod && (motionVariant() === "b" ? mod.b : mod.a);
};

/** placeCg(): 写真が仕上がった瞬間に会話のCGを同じ位置へ置く（省いたときは会話側がふつうに置く） */
export async function chekiShot(url, placeCg = null) {
  const run = skipMotion() || !url ? null : await variant(cheki);
  if (run) await run(url, placeCg);
}

export async function tarotFlip(charId = state?.fortune?.char) {
  const run = skipMotion() ? null : await variant(tarot);
  if (run) await run(charId);
}

export async function giftOpen(giftId) {
  const gear = DB.equipById?.[giftId];
  const run = skipMotion() || !gear ? null : await variant(gift);
  if (run) await run(gear);
}

export async function shiftClose() {
  const run = skipMotion() ? null : await variant(shift);
  if (run) await run();
}

/** mid(): 覆っている間に次の背景へ替える */
export async function sharkSwim(mid) {
  const run = skipMotion() ? null : await variant(shark);
  if (run) await run(mid);
  else await mid?.();
}

/** mid(): 覆っている間に背景を替える。bgUrl はその背景の絵（線画の元） */
export async function sketchIn(mid, bgUrl) {
  const run = skipMotion() || !bgUrl ? null : await variant(sketch);
  if (run) await run(mid, bgUrl);
  else await mid?.();
}
