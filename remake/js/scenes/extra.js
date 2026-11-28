// タイトルの EXTRA（あそびば・要望台帳 EXT01〜）。本編で遊んだミニゲームを、タイトルからいつでも遊び直す。
// 選ぶ画面は専用の全画面（EXT03。2026-11-27 オーナー「エクストラのミニゲームを選ぶ画面はビジュアルも凝りたい　生成してもいいかも」）。
// 遊びごとに生成したカード絵（remake/img/ui/extra/。原画は asset_sources/ui/extra-cards-20261127/）を並べ、選んだカードの下に
// 遊び方の一言と、段（初級・中級・上級）・大会・セット・本棚の進み具合を出す。まだ遊んでいない遊びは「？？？」に鍵の印（押せない）。
// 進み具合はセーブから読む（EXT04・scenes/extra-progress.js）。斧投げの段と DJ のセットはここで選ぶ（本編では店の画面で選ぶもの）。
// ラクダの大会と砂丘の段は、本編と同じくゲームの中の札で選ぶ（開いている札はセーブのとおり）。
// 画面は #stage の外に画面いっぱいで重ねる（横の画面・縦画面・DS風のどれでも同じ。縦持ちは縦の並べ方）。遊んでいる間は隠す。
// 遊びの始め方は DBG のミニゲーム一覧（dev/minigame-launcher.js）と同じで、本編の状態には触れず、結果は捨てる（記録・お金・好感度・
// セーブは変わらない）。各遊びの「やめる」（DJ は中の出口、ボドゲカフェは「EXTRAへ戻る」）で抜けると、この画面に戻る。
import { el } from "../core/util.js";
import { toast } from "../core/ui.js";
import { config } from "../core/state.js";
import { playBgm, stopBgm, SE } from "../core/audio.js";
import { EXTRA_GAMES, extraPlayed } from "../core/extra-games.js";
import { TIER_LABEL } from "../core/play-tiers.js";
import { withMinigameStyles } from "../minigames/minigame-styles.js";
import { extraSaves, loadExtraProgress } from "./extra-progress.js";

/** カードの絵と、選んだ時に出す英字の見出し・一言（2行まで・VPL29）。 */
const INFO = {
  axe: { kicker: "AXE THROWING", line: "的の真ん中を狙って、斧を投げる。" },
  trpg: { kicker: "BOARD GAME CAFE", line: "部員と卓を囲んで、物語を遊ぶ。" },
  dj: { kicker: "DJ", line: "曲をつないで、フロアを沸かせる。" },
  camel: { kicker: "CAMEL RACE", line: "ロボット騎手のラクダで、大会に挑む。" },
  desert: { kicker: "SANDBOARD", line: "夕日の砂丘を、ボードで滑り降りる。" },
};
const art = (id) => `img/ui/extra/card-${id}.webp`;
const DIVISION_NAME = { easy: "レク", normal: "アマ", hard: "プロ" };
const copy = (value) => JSON.parse(JSON.stringify(value));

/**
 * 選んだカードの下に並べる札。pick のある札は押して選べる（斧投げの段・DJ のセット）。
 * pick の無い札は進み具合の表示（ラクダの大会・砂丘の段・ボドゲカフェの本棚。選ぶのはゲームの中）。
 */
function chipsFor(id, progress) {
  const p = progress?.[id];
  if (!p) return [];
  if (id === "axe") return [
    { pick: "practice", label: "練習", note: "3投", open: true },
    ...p.tiers.map((t) => ({ pick: t.tier, label: t.label, note: `10投・${DIVISION_NAME[t.tier]}`, open: t.open, cleared: t.cleared, lock: t.lock })),
  ];
  if (id === "dj") return p.sets.map((set) => ({ pick: set.id, label: set.name, note: set.best ? `ベスト ${set.best}` : String(set.label || "").replace(/^(入門|本命|上級)・/, ""),
    open: set.open, cleared: p.tiers.find((t) => t.tier === set.tier)?.cleared, lock: set.lock }));
  if (id === "camel") {
    const names = { practice: "練習レース", rookie: "入門大会", standard: "標準大会", expert: "上級大会" };
    return Object.entries(names).map(([cup, label]) => ({ label, open: p.cups.includes(cup),
      cleared: cup !== "practice" && !!p.record?.cups?.[cup]?.qualified, lock: cup === "standard" ? "入門で3位以内" : cup === "expert" ? "標準で3位以内" : "" }));
  }
  if (id === "desert") return [
    ...p.tiers.map((t) => ({ label: t.label, open: t.open, cleared: t.cleared, lock: t.lock })),
    { label: "なると勝負", open: p.rivals.includes("naru"), lock: "上級クリアで来る" },
  ];
  // ボドゲカフェは、セーブの本棚のまま開く。部を作っていないセーブは「部を作ったばかり」の始め方（店の常連と遊ぶ本から）
  if (id === "trpg") return p.club ? [
    { label: `本 ${p.books}冊`, note: "持っている本", open: true },
    { label: `物語 ${p.cleared}`, note: "遊び終えた", open: true },
  ] : [{ label: "部を作ったばかり", note: "店の常連と遊ぶ本から", open: true }];
  return [];
}
/** 最初に選んでおく札: 開いている中でいちばん上。 */
const firstPick = (chips) => [...chips].reverse().find((chip) => chip.pick != null && chip.open)?.pick ?? null;

const START = {
  axe: async (host, signal, pick) => {
    const [{ runAxeThrow }, { AXE_TIER_DIVISION }] = await Promise.all([import("../minigames/axe.js"), import("../daily/axe-bar-tiers.js")]);
    if (signal.aborted) return;
    playBgm("bgm_axe");
    const league = pick && pick !== "practice";
    return runAxeThrow({ host, signal, mode: league ? "league" : "practice", division: league ? AXE_TIER_DIVISION[pick] : "rec", opponent: null });
  },
  // ボドゲカフェは、いちばん進んだセーブの本棚・部員のまま、使い捨ての写しで開く（trpg/trial.js の from）
  trpg: async (host, signal, _pick, progress) => {
    const { mountTrpgTrial } = await import("../trpg/trial.js");
    if (signal.aborted) return;
    playBgm("bgm_trpg");
    const owner = progress?.trpg?.owner;
    return mountTrpgTrial(host, { from: owner ? copy(owner) : null, preset: "fresh", signal, exitLabel: "EXTRAへ戻る" }).finished;
  },
  dj: async (host, signal, pick) => {
    const { runDjSet } = await import("../minigames/dj.js");
    if (signal.aborted) return;
    return runDjSet({ host, signal, set: pick || 1, muted: !!(config.mute || config.muted), volume: config.bgmVolume });
  },
  // ラクダは、出られる大会と自己ベストをセーブから渡し、大会はゲームの中の札で選ぶ
  camel: async (host, signal, _pick, progress) => {
    const { runCamelRace } = await import("../minigames/camel-race.js");
    if (signal.aborted) return;
    const { cups, record } = progress?.camel || { cups: ["practice", "rookie"], record: { cups: {} } };
    return runCamelRace({ host, signal, tutorial: false, cups, best: record.best || null,
      cupRecords: { ...record.cups, ...(record.practiceBest ? { practice: { best: record.practiceBest } } : {}) } });
  },
  // 砂丘は、開いている段・自己ベスト・来てくれる相手をセーブから渡し、段はゲームの中の札で選ぶ
  desert: async (host, signal, _pick, progress) => {
    const [{ runDesertRide }, { defaultTier }] = await Promise.all([import("../minigames/desert-ride.js"), import("../core/play-tiers.js")]);
    if (signal.aborted) return;
    if (!progress?.desert) return runDesertRide({ host, signal, tutorial: false, rivals: ["noor"], tiers: ["easy"], tier: "easy" });
    const { owner, tiers, rivals, records } = progress.desert;
    return runDesertRide({ host, signal, tutorial: false, rivals,
      tiers: tiers.filter((t) => t.open).map((t) => t.tier), cleared: tiers.filter((t) => t.cleared).map((t) => t.tier), tier: defaultTier(owner, "desert"),
      best: records.best, legacyBest: records.legacyBest || null, easyBest: records.easyBest || null, bests: records.bests || null });
  },
};

/** 遊んだことのある遊び（端末の記録と、各セーブ枠・遊んでいる最中の state から拾った分）。 */
export function extraPlayedNow() {
  return extraPlayed(extraSaves());
}

/** 1つの遊びを、本編の画面の上で遊ぶ。終わるか「やめる」で戻る。 */
async function play(id, pick, progress) {
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
  try { await START[id](host, controller.signal, pick, progress); }
  catch (error) { console.error(`[extra] ${id} を開始できませんでした`, error); toast("遊びを始められませんでした。もう一度お試しください"); }
  finally { controller.abort(); host.remove(); }
}

/** 選ぶ画面。choose() で遊びと札を選ぶまで待つ（とじるなら null）。 */
function extraScreen(played, progress) {
  const count = EXTRA_GAMES.filter((game) => played.has(game.id)).length;
  let current = Math.max(0, EXTRA_GAMES.findIndex((game) => played.has(game.id)));
  const picks = {};
  let resolve = null;
  const finish = (value) => { const done = resolve; resolve = null; done?.(value); };

  const amb = el("img.xs-amb-img", { alt: "", "aria-hidden": "true" });
  const cards = EXTRA_GAMES.map((game, index) => {
    const open = played.has(game.id);
    const tiers = progress?.[game.id]?.tiers;
    const node = el(`button.xs-card${open ? "" : ".is-locked"}`, { type: "button", role: "option", style: { "--i": String(index) },
      "aria-label": open ? game.label : "まだ遊んでいないミニゲーム", dataset: { test: `extra-${game.id}` },
      onclick: () => { if (index === current && open) start(); else select(index, { sound: true }); } }, [
      el("img.xs-art", { src: art(game.id), alt: "", draggable: "false", loading: "eager" }),
      el("span.xs-shade", { "aria-hidden": "true" }),
      open ? null : el("span.xs-lock", { "aria-hidden": "true" }),
      el("span.xs-card-foot", [
        el("span.xs-card-name", { text: open ? game.label : "？？？" }),
        open && tiers ? el("span.xs-pips", { title: "クリアした段", "aria-label": `クリアした段 ${tiers.filter((t) => t.cleared).length}/3` },
          tiers.map((t) => el(`i${t.cleared ? ".on" : ""}`))) : null,
        open && game.id === "trpg" && progress?.trpg ? el("span.xs-card-sub", { text: `物語 ${progress.trpg.cleared}` }) : null,
      ]),
    ]);
    return node;
  });
  const kicker = el("p.xs-kicker"), name = el("h2.xs-name", { dataset: { test: "extra-detail-name" } }), line = el("p.xs-line");
  const chipRow = el("div.xs-chips", { dataset: { test: "extra-chips" } });
  const playButton = el("button.xs-play", { type: "button", dataset: { test: "extra-play" }, onclick: () => start() }, [el("span", { text: "あそぶ" }), el("i", { "aria-hidden": "true" })]);
  const note = el("p.xs-note", { text: "進み具合はセーブから。遊んだ結果はセーブに残りません。" });
  const detail = el("section.xs-detail", { dataset: { test: "extra-detail" }, "aria-live": "polite" }, [
    el("div.xs-detail-text", [kicker, name, line]), chipRow, el("div.xs-detail-foot", [note, playButton])]);
  const close = el("button.xs-close", { type: "button", dataset: { test: "extra-close" }, "aria-label": "とじる", onclick: () => { SE.cancel?.(); finish(null); } },
    [el("i", { "aria-hidden": "true" }), el("span", { text: "とじる" })]);
  const root = el("div.extra-screen", { role: "dialog", "aria-modal": "true", "aria-label": "EXTRA あそびば", dataset: { test: "extra-screen" } }, [
    el("div.xs-amb", { "aria-hidden": "true" }, [amb]), el("div.xs-veil", { "aria-hidden": "true" }),
    el("header.xs-head", [
      el("div.xs-brand", [el("b", { text: "EXTRA" }), el("span", { text: "あそびば" })]),
      el("p.xs-count", { dataset: { test: "extra-count" } }, [el("span", { text: "遊んだミニゲーム" }), el("b", { text: String(count) }), el("span", { text: `/ ${EXTRA_GAMES.length}` })]),
      close,
    ]),
    el("div.xs-cards", { role: "listbox", "aria-label": "ミニゲーム", dataset: { test: "extra-cards" } }, cards),
    detail,
  ]);

  function renderDetail() {
    const game = EXTRA_GAMES[current], open = played.has(game.id);
    for (const [index, card] of cards.entries()) { card.classList.toggle("is-current", index === current); card.setAttribute("aria-selected", String(index === current)); }
    root.dataset.game = game.id;
    root.classList.toggle("is-locked", !open);
    amb.src = art(game.id);
    kicker.textContent = open ? INFO[game.id].kicker : "LOCKED";
    name.textContent = open ? game.label : "？？？";
    line.textContent = open ? INFO[game.id].line : "本編で遊ぶと、ここでいつでも遊べるようになります。";
    const chips = open ? chipsFor(game.id, progress) : [];
    if (!(game.id in picks)) picks[game.id] = firstPick(chips);
    chipRow.replaceChildren(...chips.map((chip) => {
      const selectable = chip.pick != null && chip.open;
      const on = selectable && picks[game.id] === chip.pick;
      return el(`${selectable ? "button" : "span"}.xs-chip${chip.open ? "" : ".is-locked"}${chip.cleared ? ".is-cleared" : ""}${on ? ".is-on" : ""}${selectable ? ".is-pick" : ""}`, {
        ...(selectable ? { type: "button", "aria-pressed": String(on), onclick: () => { SE.click?.(); picks[game.id] = chip.pick; renderDetail(); } } : {}),
        dataset: { test: `extra-chip-${chip.pick ?? chip.label}` } }, [
        el("b", { text: chip.label }),
        chip.open ? (chip.note ? el("small", { text: chip.note }) : null) : el("small", { text: chip.lock || "まだ" }),
      ]);
    }));
    chipRow.hidden = !chips.length;
    playButton.disabled = !open;
  }
  function select(index, { sound = false, focus = false } = {}) {
    const next = (index + cards.length) % cards.length;
    if (next !== current && sound) SE.click?.();
    current = next;
    renderDetail();
    cards[current].scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
    if (focus) cards[current].focus({ preventScroll: true });
  }
  function start() {
    const game = EXTRA_GAMES[current];
    if (!played.has(game.id)) { SE.cancel?.(); toast("本編で遊ぶと開きます"); return; }
    SE.select?.();
    finish({ id: game.id, pick: picks[game.id] ?? null });
  }
  const onKey = (event) => {
    if (!resolve || root.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") { event.preventDefault(); SE.cancel?.(); finish(null); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) { event.preventDefault(); select(current + step, { sound: true, focus: true }); return; }
    const chips = [...chipRow.querySelectorAll(".xs-chip.is-pick")];
    const chipStep = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (chipStep && chips.length) {
      event.preventDefault();
      const at = chips.findIndex((chip) => chip.classList.contains("is-on"));
      chips[Math.max(0, Math.min(chips.length - 1, at + chipStep))].click();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !event.repeat && document.activeElement?.closest?.(".xs-chip, .xs-close")) return;
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); start(); }
  };
  document.addEventListener("keydown", onKey, true);
  renderDetail();

  return {
    root,
    choose() {
      root.hidden = false;
      requestAnimationFrame(() => cards[current]?.focus({ preventScroll: true }));
      return new Promise((done) => { resolve = done; });
    },
    hide() { root.hidden = true; },
    destroy() { document.removeEventListener("keydown", onKey, true); root.remove(); },
  };
}

/**
 * EXTRA の画面。とじるまで、遊ぶ → 画面 を繰り返す。
 * @param reopenTitle 遊びが画面ごと入れ替えた後にタイトルを出し直す関数。戻った後はタイトルの上に開き直す。
 */
export async function openExtra({ reopenTitle } = {}) {
  const saves = extraSaves();
  const played = extraPlayed(saves);
  let progress = null;
  try { progress = await loadExtraProgress(saves); } catch (error) { console.error("[extra] 進み具合を読めませんでした", error); }
  try { await withMinigameStyles("extra", null, () => {}); } catch { /* 見た目の読み込みに失敗しても、文字だけで選べる */ }
  const screen = extraScreen(played, progress);
  document.body.append(screen.root);
  document.body.classList.add("extra-open");
  try {
    for (;;) {
      const pick = await screen.choose();
      if (!pick) return;
      screen.hide();
      document.body.classList.remove("extra-open");
      await play(pick.id, pick.pick, progress);
      if (document.body.dataset.screen !== "title") await reopenTitle?.();
      playBgm("title");
      document.body.classList.add("extra-open");
    }
  } finally {
    screen.destroy();
    document.body.classList.remove("extra-open");
  }
}
