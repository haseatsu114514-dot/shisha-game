// 場面ごとの一度きりのモーショングラフィックス（CI107〜CI109）。中身は remake/js/motions/ の場面ごとのファイル。
// チェキ（PEPPERMINT）／占いのタロット／締めくくりの贈り物／バイトの終わり／サメちゃんとの出会い／つむぎのスケッチ。
// 各場面に a／b の2パターン（?movar=b か __remake.dev.motionVariant("b")）、配色は紫1色／場面ごとの色（?mopal=free）。
// SKIP中と動きを減らす設定では省く（背景を替える mid() だけは呼ぶ）。
import { state } from "./state.js";
import { DB } from "./data.js";
import { reducedMotion } from "./transition-kit.js";
import { motionVariant } from "./mg-kit.js";
import * as cheki from "../motions/cheki.js";
import * as tarot from "../motions/tarot.js";
import * as gift from "../motions/gift.js";
import * as shift from "../motions/shift.js";
import * as shark from "../motions/shark.js";
import * as sketch from "../motions/sketch.js";

const skipMotion = () => reducedMotion() || document.body.classList.contains("vn-skip");
const variant = (mod) => (motionVariant() === "b" ? mod.b : mod.a);

/** placeCg(): 写真が仕上がった瞬間に会話のCGを同じ位置へ置く（省いたときは会話側がふつうに置く） */
export async function chekiShot(url, placeCg = null) {
  if (skipMotion() || !url) return;
  await variant(cheki)(url, placeCg);
}

export async function tarotFlip(charId = state?.fortune?.char) {
  if (skipMotion()) return;
  await variant(tarot)(charId);
}

export async function giftOpen(giftId) {
  const gear = DB.equipById?.[giftId];
  if (skipMotion() || !gear) return;
  await variant(gift)(gear);
}

export async function shiftClose() {
  if (skipMotion()) return;
  await variant(shift)();
}

/** mid(): 覆っている間に次の背景へ替える */
export async function sharkSwim(mid) {
  if (skipMotion()) { await mid?.(); return; }
  await variant(shark)(mid);
}

/** mid(): 覆っている間に背景を替える。bgUrl はその背景の絵（線画の元） */
export async function sketchIn(mid, bgUrl) {
  if (skipMotion() || !bgUrl) { await mid?.(); return; }
  await variant(sketch)(mid, bgUrl);
}
