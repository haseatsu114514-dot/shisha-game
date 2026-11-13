// TRPGの試遊を、本編の画面で開く（TRF21）。本編のボドゲカフェ（daily/trpg.js の openTrpgBar）と同じ店の画面・同じ曲で、
// 中身は使い捨ての状態（trpg/trial.js）。本編のセーブ・進行には触れない。入口は main.js の `?trial=trpg`。
import { CITY_BACKGROUNDS } from "../core/city-locations.js";

/** 試遊の本棚が画面に出たら解決する。返り値の finished は、試遊を閉じた時に解決する。 */
export async function openTrpgTrial({ preset = "ready", exitLabel = "タイトルへ戻る" } = {}) {
  const [{ el }, { showScreen, enterScene }, { playBgm }, { mountTrpgTrial }, { showHud }] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"), import("../trpg/trial.js"), import("./hud.js"),
  ]);
  const host = el("section.trpg-screen", { "aria-label": "ボドゲカフェの試遊", dataset: { test: "trpg-tryout" } });
  showHud(false);
  await enterScene(CITY_BACKGROUNDS.trpg);
  showScreen("trpg", host); playBgm("bgm_trpg");
  const trial = mountTrpgTrial(host, { preset, exitLabel });
  window.__trpgTrial = Object.freeze({ snapshot: () => trial.snapshot(), get ready() { return trial.ready; } });
  await trial.ready;
  return { finished: trial.finished };
}
