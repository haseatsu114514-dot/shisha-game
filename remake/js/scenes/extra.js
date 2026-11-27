// タイトルの EXTRA（あそびば・要望台帳 EXT01〜）。本編で遊んだミニゲームを、タイトルからいつでも遊び直す。
// 一覧は標準の小窓（core/ui.js の modal）で出す。縦画面の外枠も、この小窓をそのまま写して操作を中継する（looks/retro/detect.js の sheetKind）。
// 遊んだことのある遊びは名前を出して押せる。まだの遊びは「？？？」で押せない（数があることだけ分かる）。
// 遊びの始め方は DBG のミニゲーム一覧（dev/minigame-launcher.js）と同じで、本編の状態には触れず、結果は捨てる（記録・お金・好感度・セーブは変わらない）。
// 各遊びの「やめる」（DJ は中の出口、ボドゲカフェは「EXTRAへ戻る」）で抜けると、一覧に戻る。
import { modal } from "../core/ui.js";
import { config, state, SAVE_SLOTS, readSlot } from "../core/state.js";
import { playBgm, stopBgm } from "../core/audio.js";
import { EXTRA_GAMES, extraPlayed } from "../core/extra-games.js";

const START = {
  axe: async (host, signal) => {
    const { runAxeThrow } = await import("../minigames/axe.js");
    if (signal.aborted) return;
    playBgm("bgm_axe");
    return runAxeThrow({ host, signal, mode: "practice", opponent: null });
  },
  // ボドゲカフェは、本編と同じ本棚と卓を使い捨ての状態で開く試遊（URL の ?trial=trpg と同じもの）
  trpg: async (host, signal) => {
    const { mountTrpgTrial } = await import("../trpg/trial.js");
    if (signal.aborted) return;
    playBgm("bgm_trpg");
    return mountTrpgTrial(host, { preset: "ready", signal, exitLabel: "EXTRAへ戻る" }).finished;
  },
  dj: async (host, signal, set) => {
    const { runDjSet } = await import("../minigames/dj.js");
    if (signal.aborted) return;
    return runDjSet({ host, signal, set, muted: !!(config.mute || config.muted), volume: config.bgmVolume });
  },
  camel: async (host, signal) => {
    const [{ runCamelRace }, { CAMEL_CUPS }] = await Promise.all([import("../minigames/camel-race.js"), import("../minigames/camel-race-model.js")]);
    if (signal.aborted) return;
    return runCamelRace({ host, signal, cups: CAMEL_CUPS.map((cup) => cup.id) });
  },
  desert: async (host, signal) => {
    const { runDesertRide } = await import("../minigames/desert-ride.js");
    if (signal.aborted) return;
    return runDesertRide({ host, signal, rivals: ["noor", "naru"] });
  },
};

/** 遊んだことのある遊び（端末の記録と、各セーブ枠・遊んでいる最中の state から拾った分）。 */
export function extraPlayedNow() {
  const saves = SAVE_SLOTS.map((slot) => readSlot(slot.key)).filter(Boolean);
  if (state) saves.push(state);
  return extraPlayed(saves);
}

/** DJ は曲のセットを選ぶ。戻るなら null。 */
async function pickDjSet() {
  const { DJ_SETS } = await import("../minigames/dj.js");
  return modal({
    title: "DJ",
    body: "つなぐセットを選んでください。",
    options: [
      ...DJ_SETS.map((set, i) => ({ label: set.name, value: set.id, primary: i === 0, test: `extra-dj-${set.id}` })),
      { label: "もどる", value: null, test: "extra-dj-back" },
    ],
  });
}

/** 1つの遊びを、本編の画面の上で遊ぶ。終わるか「やめる」で戻る。 */
async function play(id, set) {
  const stage = document.getElementById("stage");
  if (!stage) return;
  const controller = new AbortController();
  const host = document.createElement("div");
  host.className = "extra-host";
  host.dataset.test = `extra-host-${id}`;
  if (id === "dj") {
    // DJ は iframe。拡大縮小された #stage の中では iPhone で真っ黒になることがあるので、画面いっぱいに外へ出す（DBG と同じ）
    Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "2147482000", background: "#100d18" });
    host.style.setProperty("--stage-safe-l", "env(safe-area-inset-left, 0px)");
    host.style.setProperty("--stage-safe-r", "env(safe-area-inset-right, 0px)");
    document.body.append(host);
  } else {
    Object.assign(host.style, { position: "absolute", inset: "0", zIndex: "100", background: "#100d18" });
    stage.append(host);
  }
  stopBgm(0);
  try { await START[id](host, controller.signal, set); }
  catch (error) { console.error(`[extra] ${id} を開始できませんでした`, error); }
  finally { controller.abort(); host.remove(); }
}

/**
 * EXTRA の一覧。とじるまで、遊ぶ → 一覧 を繰り返す。
 * @param reopenTitle 遊びが画面ごと入れ替えた後にタイトルを出し直す関数。戻った後は一覧をタイトルの上に開き直す。
 */
export async function openExtra({ reopenTitle } = {}) {
  for (;;) {
    const played = extraPlayedNow();
    const count = EXTRA_GAMES.filter((game) => played.has(game.id)).length;
    const firstOpen = EXTRA_GAMES.find((game) => played.has(game.id));
    const pick = await modal({
      title: `EXTRA ${count}/${EXTRA_GAMES.length}`,
      className: "extra-box",
      // 説明は2行まで（VPL29）。まだ遊んでいない札は「？？？」と鍵の印で分かるので、文では言わない。数は題に出す（文の中だと行をまたぐ）
      body: "遊んだミニゲームを、いつでも遊べます。結果はセーブに残りません。",
      options: [
        ...EXTRA_GAMES.map((game) => played.has(game.id)
          ? { label: game.label, value: game.id, primary: game === firstOpen, test: `extra-${game.id}` }
          : { label: "？？？", value: null, disabled: true, test: `extra-${game.id}` }),
        { label: "とじる", value: null, test: "extra-close" },
      ],
    });
    if (!pick) return;
    let set;
    if (pick === "dj") { set = await pickDjSet(); if (!set) continue; }
    await play(pick, set);
    if (document.body.dataset.screen !== "title") await reopenTitle?.();
    playBgm("title");
  }
}
