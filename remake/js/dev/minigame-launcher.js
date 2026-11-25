// The debug menu calls the current game implementations directly. Results live only in memory.
import { config, newState } from "../core/state.js";
import { bgmDuckLevel, duckBgm, playBgm, requestedBgm, stopBgm } from "../core/audio.js";
import { DJ_SETS, djUrl } from "../minigames/dj.js";
import { CAMEL_CUPS } from "../minigames/camel-race-model.js";

const GAMES = [
  { id: "axe", label: "斧投げ", start: async (host, signal) => {
    const { runAxeThrow } = await import("../minigames/axe.js");
    if (signal.aborted) return;
    playBgm("bgm_axe");
    return runAxeThrow({ host, signal, mode: "practice", opponent: null });
  } },
  { id: "camel", label: "ラクダレース", start: async (host, signal) => {
    const { runCamelRace } = await import("../minigames/camel-race.js");
    if (signal.aborted) return;
    return runCamelRace({ host, signal, cups: CAMEL_CUPS.map(cup => cup.id) });
  } },
  // 砂丘はヌールにもなる（好敵手）にも挑める（本編ではヌールに勝つと来る。2026-11-25 オーナー「デバッグからなると対戦できるようにしたい」）
  { id: "desert", label: "DESERT RIDE（砂丘）", start: async (host, signal) => {
    const { runDesertRide } = await import("../minigames/desert-ride.js");
    if (signal.aborted) return;
    return runDesertRide({ host, signal, rivals: ["noor", "naru"] });
  } },
  { id: "desert-naru", label: "DESERT RIDE（なると勝負）", start: async (host, signal) => {
    const { runDesertRide } = await import("../minigames/desert-ride.js");
    if (signal.aborted) return;
    return runDesertRide({ host, signal, rivals: ["noor", "naru"], startRival: "naru" });
  } },
  // DJ だけ iframe で開く。iPhone の Safari では、拡大縮小（transform）された #stage の中にある iframe が
  // 真っ黒に描かれてしまうことがあるため、デバッグでは stage の外（body 直下・画面いっぱい）に出して開く。
  ...DJ_SETS.map(set => ({ id: `dj-${set.id}`, label: `DJ ${set.name}`, fixed: true, djSet: set.id, start: async (host, signal) => {
    const { runDjSet } = await import("../minigames/dj.js");
    if (signal.aborted) return;
    return runDjSet({ host, signal, set: set.id, muted: !!(config.mute || config.muted), volume: config.bgmVolume });
  } })),
  { id: "ichidai", label: "一台勝負（カード）", start: async (host, signal) => {
    const { runIchidai } = await import("../minigames/ichidai.js");
    if (signal.aborted) return;
    return runIchidai({ host, signal, opponent: { id: "sumi", name: "スミさん" } });
  } },
  // tonari フロア営業（バイトのワンオペ営業）。本編の状態には触れず、結果は捨てる。客の並びは開くたびに変わる。
  // はじめて＝進め方つきのゆっくりした営業／いつもの夜＝本編の人物が一人遊びに来る／満席の日＝いちばん忙しい営業
  ...[
    ["floor-first", "フロア営業（はじめて）", { level: 0 }],
    ["floor", "フロア営業（いつもの夜）", { level: 1, visitor: true }],
    ["floor-full", "フロア営業（満席の日）", { level: 6, kind: "full", chapter: 2 }], // 第2章のミックス（ミルク系など）も並ぶ
  ].map(([id, label, opts]) => ({ id, label, start: async (host, signal) => {
    const [{ runTonariFloor, FLOOR_VISITORS }, { bgUrl }] = await Promise.all([import("../daily/tonari-floor-view.js"), import("../core/data.js")]);
    if (signal.aborted) return;
    playBgm("tonari");
    const seed = Date.now() >>> 0;
    const visitors = Object.keys(FLOOR_VISITORS);
    return runTonariFloor({
      mount: host, signal, seed, level: opts.level, kind: opts.kind || null, chapter: opts.chapter || 1, night: true,
      visitor: opts.visitor ? visitors[seed % visitors.length] : null,
      art: bgUrl("res://assets/backgrounds/bg_tonari_inside.png", "night"),
    });
  } })),
  { id: "tetsuko", label: "てつこといっしょ", start: async (_host, signal) => {
    const value = newState();
    value.chapter = 3; value.phase = "daily"; value.day = 5;
    const { openTetsukoTime } = await import("../minigames/tetsuko-time.js");
    if (signal.aborted) return;
    return openTetsukoTime({ value, visitKey: "debug", signal });
  } },
  // ボドゲカフェは、本編と同じ本棚と卓を使い捨ての状態で開く試遊（TRF21。URL の ?trial=trpg と同じもの）。
  // 入口は1つに統一し、夜・物語（ready）から始める。昼（noon）は中の「試遊の設定」から選び直せる。
  { id: "trpg", label: "ボドゲカフェ（TRPG）", start: async (host, signal) => {
    const { mountTrpgTrial } = await import("../trpg/trial.js");
    if (signal.aborted) return;
    playBgm("bgm_trpg");
    return mountTrpgTrial(host, { preset: "ready", signal, exitLabel: "試遊を閉じる" }).finished;
  } },
];

export const DEBUG_MINIGAMES = Object.freeze(GAMES.map(({ id, label }) => ({ id, label })));

export function mountMiniGameDebug() {
  const row = document.createElement("div");
  row.className = "dbg-row";
  let current = null;
  let epoch = 0;
  let bgmBefore = null;
  let duckBefore = 1;
  let screenBefore = null;
  let screenLost = false;

  const restoreAudio = () => {
    const key = bgmBefore;
    const duck = duckBefore;
    bgmBefore = null;
    duckBefore = 1;
    if (key) {
      playBgm(key);
      duckBgm(duck, 0);
    } else {
      stopBgm(0);
    }
  };

  for (const game of GAMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = game.label;
    button.dataset.test = `debug-minigame-${game.id}`;
    button.onclick = async () => {
      const stage = document.getElementById("stage");
      const panel = document.querySelector("[data-test='debug-panel']");
      const toggle = document.querySelector("[data-test='debug-toggle']");
      if (!stage || !panel) return;
      epoch += 1;
      if (!current) {
        bgmBefore = requestedBgm();
        duckBefore = bgmDuckLevel();
        screenBefore = document.body?.dataset?.screen || null;
        screenLost = false;
      }
      current?.abort();
      document.querySelector("[data-test='debug-minigame-host']")?.remove();
      document.querySelector("[data-test='debug-minigame-close']")?.remove();
      stopBgm(0);
      if (game.id === "tetsuko") screenLost = true;
      const controller = new AbortController();
      current = controller;
      const host = document.createElement("div");
      host.dataset.test = "debug-minigame-host";
      if (game.fixed) {
        // stage の拡大縮小の外に出す。ノッチ回避の幅は、stage 上のpxではなく画面のpxで渡す（dj.js の枠が参照する）。
        Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "2147482000", background: "#100d18" });
        host.style.setProperty("--stage-safe-l", "env(safe-area-inset-left, 0px)");
        host.style.setProperty("--stage-safe-r", "env(safe-area-inset-right, 0px)");
        document.body.append(host);
      } else {
        Object.assign(host.style, { position: "absolute", inset: "0", zIndex: "100", background: "#100d18" });
        if (game.id !== "tetsuko") stage.append(host);
      }
      const close = document.createElement("button");
      close.type = "button";
      const returnsToTitle = screenBefore === "title" || screenLost;
      close.textContent = returnsToTitle ? "ミニゲームを閉じる（タイトルへ）" : "ミニゲームを閉じる（元の画面へ）";
      close.dataset.test = "debug-minigame-close";
      close.style.marginBottom = "8px";
      close.onclick = async () => {
        controller.abort();
        host.remove();
        close.remove();
        if (current !== controller) return;
        const closeEpoch = ++epoch;
        current = null;
        panel.hidden = true;
        if (toggle) toggle.textContent = "DBG";
        if (screenLost) {
          const toTitle = screenBefore === "title";
          screenLost = false;
          screenBefore = null;
          if (toTitle) {
            const prevBgm = bgmBefore, prevDuck = duckBefore;
            bgmBefore = null;
            duckBefore = 1;
            try {
              const { showTitle } = await import("../scenes/title.js");
              if (current || epoch !== closeEpoch) return;
              showTitle();
              if (!prevBgm) stopBgm(0);
              else {
                if (prevBgm !== "title") playBgm(prevBgm);
                duckBgm(prevDuck, 0);
              }
              return;
            } catch {
              if (!current && epoch === closeEpoch) location.reload();
              return;
            }
          }
          restoreAudio();
          location.reload();
          return;
        }
        screenBefore = null;
        restoreAudio();
      };
      panel.prepend(close);
      if (toggle) toggle.textContent = "DBG・終了";
      panel.hidden = true;
      // DJ の iframe が読み込まれなかった場合の見張り: 真っ黒なまま放置せず、直接開くリンクを出す。
      let watchTimer = null;
      if (game.djSet) {
        const deadline = Date.now() + 10000;
        const checkFrame = () => {
          if (controller.signal.aborted || !host.isConnected) return;
          let loaded = false;
          try { loaded = !!host.querySelector("iframe")?.contentDocument?.querySelector("#dj-stage"); } catch { loaded = false; }
          if (loaded) return;
          if (Date.now() < deadline) { watchTimer = setTimeout(checkFrame, 500); return; }
          host.replaceChildren();
          const note = document.createElement("p");
          note.style.cssText = "color:#f4f0e6;font:14px/1.6 system-ui,sans-serif;padding:24px 16px 8px;margin:0";
          note.textContent = "DJ の画面を読み込めませんでした。通信状態を確認するか、下のリンクから直接開いてください。";
          const link = document.createElement("a");
          link.href = djUrl(game.djSet, { muted: !!(config.mute || config.muted), volume: config.bgmVolume });
          link.textContent = "DJ を直接開く";
          link.style.cssText = "color:#a6e9e4;font:700 15px system-ui,sans-serif;padding:8px 16px";
          host.append(note, link);
        };
        watchTimer = setTimeout(checkFrame, 500);
      }
      try { await game.start(host, controller.signal); }
      catch (error) { if (!controller.signal.aborted) { host.textContent = `開始できませんでした: ${error.message}`; if (!host.isConnected) (game.fixed ? document.body : stage).append(host); } return; }
      finally { if (watchTimer) clearTimeout(watchTimer); }
      if (current === controller && !controller.signal.aborted) close.click();
    };
    row.append(button);
  }
  return row;
}
