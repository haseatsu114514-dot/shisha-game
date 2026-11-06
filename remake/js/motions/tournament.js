// 大会まわりの小さな動き（#2688 A16・A17・A18・A20）。画像は使わず、CSS の図形だけで描く。
// どれも場面の側から一行で呼ぶ。外すときはその呼び出しを消せば、元の流れに戻る（保存・票・既読には触れない）。
//   A16 tournamentRound／venueWipe: 第1章の ROUND の横帯と会場入りの暗い煙ワイプを、第2〜4章の大会でも使う（#2031）。
//   A17 は作業台から読むので別ファイル（motions/step-stroke.js）。
//   A18 victoryRings: 優勝の 10 カウント → プチュンのあと、紙吹雪の前に煙の輪が3つ中心から抜ける（約 1.2 秒）。
//   A20 focusBand: 第4章の四人同時の制作で、名前と二つ名の小さな横帯が流れて視線を移す（ROUND 帯の小型版）。
// SKIP／自動では短く、動きを減らす設定ではその場のフェードだけにする。
import { el, sleep, nextFrame } from "../core/util.js";
import { layers, roundCut, smokeWipe } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { reducedMotion, holdKeys } from "../core/transition-kit.js";
import { realName } from "../core/data.js";
import { ENTRANCE_CARDS } from "../chapters/tournament-entrance.js";
import { vnTest } from "../vn/engine.js";

const autoRun = () => Boolean(window.__remake?.craftTest?.auto || vnTest.turbo);
const skipping = () => autoRun() || !!document.body?.classList.contains("vn-skip");
const finished = node => Promise.all(node.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {})));

// ---------------------------------------------------------------- A16: ROUND の横帯・会場入り

// 共通の制作工程（0〜10）のうち、第1章が ROUND の帯を出す区切り。準備／吸い出し・提供／調整2回。
const ROUNDS = new Map([
  [0, ["ROUND 1", "準備"]],
  [8, ["ROUND 2", "吸い出し・提供"]],
  [9, ["ROUND 3", "調整 1回目"]],
  [10, ["ROUND 4", "調整 2回目"]],
]);
export const roundForStep = step => ROUNDS.get(step) || null;

/** 第2〜4章の制作 runner から、工程の作業台を開く前に呼ぶ。区切りでない工程では何もしない */
export async function tournamentRound(step) {
  const round = roundForStep(step);
  if (!round) return false;
  await roundCut(round[0], round[1], { hold: autoRun() ? 120 : 1300 });
  return true;
}

/** 会場へ入るときの暗い煙ワイプ（第1章 ch1.js の会場入りと同じ） */
export function venueWipe(mid = null) {
  return smokeWipe(mid, { color: "dark" });
}

// ---------------------------------------------------------------- A18: 優勝の煙の輪

/** 優勝の盤（host）の中心から煙の輪を3つ続けて抜く。終わるまで待つ（紙吹雪はこの後） */
export async function victoryRings(host) {
  if (!host?.isConnected) return;
  const fast = skipping();
  const calm = reducedMotion();
  const box = el("div.tm-rings", { "aria-hidden": "true" });
  host.append(box);
  const release = holdKeys();
  try {
    await nextFrame();
    SE.whoosh();
    const gap = fast ? 60 : 240;
    const ms = fast ? 320 : 640;
    for (let i = 0; i < 3; i++) {
      const ring = el("i.tm-ring");
      box.append(ring);
      ring.animate(calm
        ? [{ opacity: 0 }, { opacity: 0.6 }, { opacity: 0 }]
        : [{ transform: "translate(-50%, -50%) scale(.15)", opacity: 0, filter: "blur(1px)" },
          { transform: "translate(-50%, -50%) scale(.6)", opacity: 0.85, offset: 0.25 },
          { transform: "translate(-50%, -50%) scale(2.1)", opacity: 0, filter: "blur(6px)" }],
      { duration: ms, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      if (i < 2) await sleep(gap);
    }
    await Promise.race([finished(box), sleep(ms + 200)]);
  } finally {
    box.remove();
    release();
  }
}

// ---------------------------------------------------------------- A20: 第4章の視点を移す横帯

const NAME = { master_hookah: "王 煙楼" };
const ringOf = (id, chapter = 4) => ENTRANCE_CARDS[chapter]?.find(card => card.id === id)?.ring || "";

/** 名前と二つ名の小さな横帯。流れ込み 0.4 秒 → 読む間 → 抜ける。覆っている間は Enter・Space を止める */
export async function focusBand(id, { chapter = 4 } = {}) {
  if (!id || !layers?.fx) return;
  const fast = skipping();
  const calm = reducedMotion();
  const band = el("div.tm-focus", { "aria-hidden": "true", dataset: { focus: id } }, [
    el("small", { text: ringOf(id, chapter) }),
    el("b", { text: NAME[id] || realName(id) }),
  ]);
  const release = holdKeys();
  layers.fx.append(band);
  try {
    await nextFrame();
    SE.whoosh();
    const enter = calm ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translateX(-105%)" }, { transform: "translateX(0)" }];
    const leave = calm ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "translateX(0)" }, { transform: "translateX(105%)" }];
    await band.animate(enter, { duration: fast ? 140 : 400, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }).finished.catch(() => {});
    await sleep(fast ? 80 : 560);
    await band.animate(leave, { duration: fast ? 120 : 260, easing: "cubic-bezier(.55,0,.85,.35)", fill: "both" }).finished.catch(() => {});
  } finally {
    band.remove();
    release();
  }
}
