// 場面ごとの一度きりのモーショングラフィックス（CI107〜CI109）。中身は remake/js/motions/ の場面ごとのファイル。
// チェキ（PEPPERMINT）／占いのタロット／締めくくりの贈り物／バイトの終わり／サメちゃんとの出会い／つむぎのスケッチ。
// 各場面に a／b の2パターンがあり、本編は場面ごとの採用（mg-kit.js の ADOPTED_VARIANT）。比べるときは ?movar=b か __remake.dev.motionVariant("b")、配色は紫1色／場面ごとの色（?mopal=free）。
// 動きを減らす設定では省く（背景を替える mid() だけは呼ぶ）。SKIP中は省かず最後まで見せる（#1081 H05・一度きりの演出を飛ばして見逃さない）。
import { state, config } from "./state.js";
import { DB } from "./data.js";
import { reducedMotion } from "./transition-kit.js";
import { motionVariant } from "./mg-kit.js";
import { withLoadingNotice } from "./module-loading.js";
import { loadingNotice } from "./ui.js";

// A10後半: 「見た演出を短く」設定（config.shortSeen、既定オフ）。初回は必ずフルで見せ、見た記録を
// state.flags._motion_seen_<key> に付ける。2回目以降は設定がオンのときだけ短縮する。記録は設定と
// 独立に付く（後で設定をオンにしても過去に見た演出は短くなる）。くじ・チェキ・MG(#1081 H05)は対象外。
// 記録は演出を見せ終えてから付ける（途中でLOADされた演出はセーブを書き換えない）。
const seenFlag = (key) => `_motion_seen_${key}`;
const shortenSeen = (key) => !!(state && state.flags[seenFlag(key)]) && !!config.shortSeen;
const markSeen = (key) => { if (state) state.flags[seenFlag(key)] = true; };

// 場面のファイルは使うときに読む（一つの場面の不具合がほかの場面やゲームの起動を止めないように）
const cheki = () => import("../motions/cheki.js");
const tarot = () => import("../motions/tarot.js");
const gift = () => import("../motions/gift.js");
const shift = () => import("../motions/shift.js");
const shark = () => import("../motions/shark.js");
const sketch = () => import("../motions/sketch.js");
const lime = () => import("../motions/lime.js");
const train = () => import("../motions/train.js");
const shinkansen = () => import("../motions/shinkansen.js");
const purikura = () => import("../motions/purikura.js");

// 連絡先の交換は一度きり（交換済みの記録が先に付く）。SKIP中でも見せ、動きを減らす設定では
// 動かないカードで見せる。省くと二度と見られない（#833）。
export async function limeExchange(charId, context = null) {
  const owner = state;
  const mod = await withLoadingNotice(lime(), { ...loadingNotice("LIME演出を準備しています…"), delayMs: 500 })
    .catch((e) => { console.error(e); return null; });
  if (state !== owner) return; // 読み込み中のLOADから、前のセーブの交換を始めない。
  const reduce = reducedMotion();
  // 2回目以降の連絡先交換は、設定がオンなら「追加し終えた画面だけ」の短い表示にする（still と同じ）。
  const short = !reduce && shortenSeen("lime");
  await mod?.exchange(charId, context, { still: reduce || short });
  if (!reduce && state === owner) markSeen("lime"); // 見せ終えてから記録（LOADで中断したら残さない）
}

// 演出を省くのは動きを減らす設定のときだけ。SKIP中は一度きりの演出を飛ばさず最後まで再生する（#1081 H05）。
const omitMotion = () => reducedMotion();
/** 今のパターンの関数。読めなかったときは null（演出を省いて先へ進む） */
const variant = async (scene, load) => {
  const mod = await withLoadingNotice(load(), { ...loadingNotice("演出を準備しています…"), delayMs: 500 })
    .catch((e) => { console.error(e); return null; });
  return mod && (motionVariant(scene) === "b" ? mod.b : mod.a);
};

/** placeCg(): 写真が仕上がった瞬間に会話のCGを同じ位置へ置く（省いたときは会話側がふつうに置く） */
export async function chekiShot(url, placeCg = null) {
  const owner = state;
  const run = omitMotion() || !url ? null : await variant("cheki", cheki);
  if (state !== owner) return; // 読み込み中のLOADから、前のセーブのチェキを始めない。
  if (run) await run(url, placeCg);
}

/** あげはの店のプリクラ（#939）。会話の {"type": "motion", "id": "purikura"} から呼ぶ */
export async function purikuraShot() {
  if (omitMotion()) return;
  const owner = state;
  const run = await variant("purikura", purikura);
  if (state !== owner) return; // 読み込み中のLOADから、前のセーブのプリクラを始めない。
  if (run) await run();
}

export async function tarotFlip(charId = state?.fortune?.char) {
  const run = omitMotion() ? null : await variant("tarot", tarot);
  if (run) await run(charId);
}

export async function giftOpen(giftId) {
  const gear = DB.equipById?.[giftId];
  const run = omitMotion() || !gear ? null : await variant("gift", gift);
  if (run) await run(gear);
}

export async function shiftClose() {
  if (omitMotion()) return;
  const owner = state;
  // 2回目以降のシフト終了は、設定がオンなら CLOSED の札だけを短く見せる（brief）。
  const short = shortenSeen("shift");
  const mod = await shift().catch((e) => { console.error(e); return null; });
  if (!mod || state !== owner) return;
  const run = short ? mod.brief : (motionVariant("shift") === "b" ? mod.b : mod.a);
  if (run) await run();
  if (state === owner) markSeen("shift"); // 見せ終えてから記録
}

/** mid(): 覆っている間に次の背景へ替える */
export async function sharkSwim(mid) {
  const run = omitMotion() ? null : await variant("shark", shark);
  if (run) await run(mid);
  else await mid?.();
}

/** 電車に乗る（Issue #891）。mid(): 車内の絵が覆っている間に次の背景へ替える。tone: "day"|"night"（省略で今の時間帯） */
export async function trainRide(mid, opts = {}) {
  // テストの高速送りでも省く（engine の vnTest は window.__remake 経由で見る。循環 import を避ける）
  const mod = omitMotion() || window.__remake?.vnTest?.turbo ? null : await train().catch((e) => { console.error(e); return null; });
  if (mod) await mod.a(mid, opts);
  else await mid?.();
}

/** 新幹線に乗る（Issue #1059）。mid(): 車窓が覆っている間に次の背景へ替える。
 * opts.from/to: "home"|"tokyo"。第2章の隣町行き電車(#891 trainRide)とは別の演出。 */
export async function shinkansenRide(mid, opts = {}) {
  const mod = omitMotion() || window.__remake?.vnTest?.turbo ? null : await shinkansen().catch((e) => { console.error(e); return null; });
  if (mod) await mod.a(mid, opts);
  else await mid?.();
}

/** mid(): 覆っている間に背景を替える。bgUrl はその背景の絵（線画の元） */
export async function sketchIn(mid, bgUrl) {
  const run = omitMotion() || !bgUrl ? null : await variant("sketch", sketch);
  if (run) await run(mid, bgUrl);
  else await mid?.();
}
