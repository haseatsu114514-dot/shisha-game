// タイトルの EXTRA（あそびば・要望台帳 EXT01〜）。本編で遊んだミニゲームを、タイトルからいつでも遊び直す。
// 選ぶ画面は専用の全画面で、ミニゲームを1つずつ横にスライドして選ぶ（EXT05。2026-11-28 オーナー「実際のミニゲームのスクショ使いたい
// 枠でイメージ画像何個か見せて　ミニゲームタイトルと　横スライド式でミニゲーム選択」）。各スライドは、枠の中で実際の画面の写真3枚を
// 切り替えて見せ（下の小さな絵で選べる）、ミニゲームのタイトル（題字のロゴがある遊びはロゴ）と一言・段などの札・「あそぶ」を添える。
// まだ遊んでいない遊びは「？？？」に鍵の印（写真は暗くぼかし、あそぶは押せない）。下の並びで、全部の数と今どこかが分かる。
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

/** 英字の見出し（題字のロゴが無い遊びの題）と一言（2行まで・VPL29）。 */
const INFO = {
  axe: { kicker: "AXE THROWING", line: "的の真ん中を狙って、斧を投げる。" },
  trpg: { kicker: "BOARD GAME CAFE", line: "部員と卓を囲んで、物語を遊ぶ。" },
  dj: { kicker: "DJ MIX", line: "曲をつないで、フロアを沸かせる。" },
  camel: { kicker: "CAMEL RACE", line: "ロボット騎手のラクダで、大会に挑む。" },
  desert: { kicker: "SANDBOARD", line: "夕日の砂丘を、ボードで滑り降りる。" },
};
/**
 * 枠で見せる実際の画面（3枚ずつ）。斧投げと砂丘は遊び方の写真（実際の画面から撮ったもの）、ほかは EXTRA のために撮ったもの
 * （img/ui/extra/shots/。撮り方は asset_sources/ui/extra-cards-20261127/shots/capture.mjs）。
 */
const SHOTS = {
  axe: ["axe_throw/howto/how_aim", "axe_throw/howto/how_throw", "axe_throw/howto/how_score"],
  trpg: ["extra/shots/trpg-1", "extra/shots/trpg-2", "extra/shots/trpg-3"],
  dj: ["extra/shots/dj-1", "extra/shots/dj-2", "extra/shots/dj-3"],
  camel: ["extra/shots/camel-1", "extra/shots/camel-2", "extra/shots/camel-3"],
  desert: ["desert_ride_howto/how_boost", "desert_ride_howto/how_jump", "desert_ride_howto/how_spin"],
};
const shot = (path) => `img/ui/${path}.webp`;
/** ゲームの題字のロゴ（あるものだけ。無い遊びは英字の見出しを題字の代わりに出す）。 */
const LOGO = { camel: "img/ui/camel_race/ui/logo.webp", desert: "img/ui/desert_ride/logo.webp" };
const SHOT_MS = 2800;
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
  let current = -1, resolve = null, timer = 0, scrollTimer = 0;
  const picks = {}, shotAt = {};
  const finish = (value) => { const done = resolve; resolve = null; done?.(value); };
  const reduced = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!config.reduceShake;

  const amb = el("img.xs-amb-img", { alt: "", "aria-hidden": "true" });
  const slides = EXTRA_GAMES.map((game, index) => {
    const open = played.has(game.id);
    const shots = SHOTS[game.id].map((path, n) => el(`img.xs-shot${n ? "" : ".on"}`, { src: shot(path), alt: open ? `${game.label}の画面 ${n + 1}` : "", draggable: "false", loading: index < 2 ? "eager" : "lazy" }));
    const frame = el("div.xs-frame", { dataset: { test: `extra-frame-${game.id}` } }, [
      ...shots, el("span.xs-frame-glint", { "aria-hidden": "true" }),
      ...(open ? [] : [el("span.xs-lock", { "aria-hidden": "true" }), el("span.xs-frame-q", { text: "？？？" })]),
    ]);
    const thumbs = open ? el("div.xs-thumbs", { role: "group", "aria-label": "画面を選ぶ" }, SHOTS[game.id].map((path, n) =>
      el(`button.xs-thumb${n ? "" : ".on"}`, { type: "button", "aria-label": `画面 ${n + 1}`, dataset: { test: `extra-thumb-${game.id}-${n + 1}` },
        onclick: () => { SE.click?.(); showShot(index, n); restartTimer(); } }, [el("img", { src: shot(path), alt: "", draggable: "false", loading: "lazy" })]))) : null;
    const title = open
      ? (LOGO[game.id] ? el("img.xs-logo", { src: LOGO[game.id], alt: INFO[game.id].kicker, draggable: "false" }) : el("b.xs-title-text", { text: INFO[game.id].kicker }))
      : el("b.xs-title-text.is-locked", { text: "LOCKED" });
    const chipRow = el("div.xs-chips", { dataset: { test: `extra-chips-${game.id}` } });
    const play = el("button.xs-play", { type: "button", disabled: !open, dataset: { test: `extra-play-${game.id}` }, onclick: () => start(index) },
      [el("span", { text: "あそぶ" }), el("i", { "aria-hidden": "true" })]);
    const node = el(`section.xs-slide${open ? "" : ".is-locked"}`, { role: "group", "aria-roledescription": "スライド",
      "aria-label": `${index + 1} / ${EXTRA_GAMES.length} ${open ? game.label : "まだ遊んでいないミニゲーム"}`, dataset: { test: `extra-slide-${game.id}`, game: game.id } }, [
      el("div.xs-stage", [frame, thumbs]),
      el("div.xs-info", [
        el("div.xs-title", [title]),
        el("h2.xs-name", { text: open ? game.label : "？？？", dataset: { test: `extra-name-${game.id}` } }),
        el("p.xs-line", { text: open ? INFO[game.id].line : "本編で遊ぶと、ここでいつでも遊べるようになります。" }),
        chipRow,
        el("div.xs-info-foot", [el("p.xs-note", { text: open ? "進み具合はセーブから。遊んだ結果はセーブに残りません。" : "" }), play]),
      ]),
    ]);
    shotAt[game.id] = 0;
    renderChips(game, open, chipRow);
    return { node, frame, shots, thumbs, game, open };
  });

  function renderChips(game, open, row) {
    const chips = open ? chipsFor(game.id, progress) : [];
    if (!(game.id in picks)) picks[game.id] = firstPick(chips);
    row.replaceChildren(...chips.map((chip) => {
      const selectable = chip.pick != null && chip.open;
      const on = selectable && picks[game.id] === chip.pick;
      return el(`${selectable ? "button" : "span"}.xs-chip${chip.open ? "" : ".is-locked"}${chip.cleared ? ".is-cleared" : ""}${on ? ".is-on" : ""}${selectable ? ".is-pick" : ""}`, {
        ...(selectable ? { type: "button", "aria-pressed": String(on), onclick: () => { SE.click?.(); picks[game.id] = chip.pick; renderChips(game, open, row); } } : {}),
        dataset: { test: `extra-chip-${game.id}-${chip.pick ?? chip.label}` } }, [
        el("b", { text: chip.label }),
        chip.open ? (chip.note ? el("small", { text: chip.note }) : null) : el("small", { text: chip.lock || "まだ" }),
      ]);
    }));
    row.hidden = !chips.length;
  }
  function showShot(index, n) {
    const slide = slides[index];
    const at = (n + slide.shots.length) % slide.shots.length;
    shotAt[slide.game.id] = at;
    slide.shots.forEach((img, i) => img.classList.toggle("on", i === at));
    slide.thumbs?.querySelectorAll(".xs-thumb").forEach((thumb, i) => { thumb.classList.toggle("on", i === at); thumb.setAttribute("aria-pressed", String(i === at)); });
    if (index === current) amb.src = slide.shots[at].src;
  }
  function restartTimer() {
    clearInterval(timer);
    timer = 0;
    const slide = slides[current];
    if (!slide?.open || root.hidden || reduced()) return;
    timer = setInterval(() => showShot(current, shotAt[slide.game.id] + 1), SHOT_MS);
  }

  const track = el("div.xs-track", { role: "region", "aria-roledescription": "カルーセル", "aria-label": "ミニゲーム", dataset: { test: "extra-track" } }, slides.map((s) => s.node));
  const prev = el("button.xs-nav.xs-prev", { type: "button", "aria-label": "前のミニゲーム", dataset: { test: "extra-prev" }, onclick: () => go(current - 1, { sound: true }) }, [el("i", { "aria-hidden": "true" })]);
  const next = el("button.xs-nav.xs-next", { type: "button", "aria-label": "次のミニゲーム", dataset: { test: "extra-next" }, onclick: () => go(current + 1, { sound: true }) }, [el("i", { "aria-hidden": "true" })]);
  const pager = el("nav.xs-pager", { "aria-label": "ミニゲームの一覧", dataset: { test: "extra-pager" } }, EXTRA_GAMES.map((game, index) =>
    el(`button.xs-dot${played.has(game.id) ? "" : ".is-locked"}`, { type: "button", dataset: { test: `extra-${game.id}` },
      "aria-label": played.has(game.id) ? game.label : "まだ遊んでいないミニゲーム", onclick: () => go(index, { sound: true }) }, [
      el("i", { "aria-hidden": "true" }), el("span", { text: played.has(game.id) ? game.label : "？？？" })])));
  const close = el("button.xs-close", { type: "button", dataset: { test: "extra-close" }, "aria-label": "とじる", onclick: () => { SE.cancel?.(); finish(null); } },
    [el("i", { "aria-hidden": "true" }), el("span", { text: "とじる" })]);
  const root = el("div.extra-screen", { role: "dialog", "aria-modal": "true", "aria-label": "EXTRA あそびば", dataset: { test: "extra-screen" } }, [
    el("div.xs-amb", { "aria-hidden": "true" }, [amb]), el("div.xs-veil", { "aria-hidden": "true" }),
    el("header.xs-head", [
      el("div.xs-brand", [el("b", { text: "EXTRA" }), el("span", { text: "あそびば" })]),
      el("p.xs-count", { dataset: { test: "extra-count" } }, [el("span", { text: "遊んだミニゲーム" }), el("b", { text: String(count) }), el("span", { text: `/ ${EXTRA_GAMES.length}` })]),
      close,
    ]),
    el("div.xs-body", [prev, track, next]),
    pager,
  ]);

  /** 今のスライドを決める（スライドの位置・下の並び・背景・写真の切り替え）。 */
  function setCurrent(index) {
    if (index === current) return;
    current = index;
    slides.forEach((slide, i) => {
      slide.node.classList.toggle("is-current", i === current);
      slide.node.toggleAttribute("inert", i !== current);
    });
    pager.querySelectorAll(".xs-dot").forEach((dot, i) => { dot.classList.toggle("is-current", i === current); dot.setAttribute("aria-current", String(i === current)); });
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    root.dataset.game = slides[current].game.id;
    root.classList.toggle("is-locked", !slides[current].open);
    amb.src = slides[current].shots[shotAt[slides[current].game.id]].src;
    restartTimer();
  }
  function go(index, { sound = false, smooth = true } = {}) {
    const to = Math.max(0, Math.min(slides.length - 1, index));
    if (sound && to !== current) SE.click?.();
    trackWidth = track.clientWidth;
    track.scrollTo({ left: to * trackWidth, behavior: smooth && !reduced() ? "smooth" : "auto" });
    setCurrent(to);
  }
  // 指で横に流した時は、止まった所のスライドを今のスライドにする
  track.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { if (track.clientWidth) setCurrent(Math.round(track.scrollLeft / track.clientWidth)); }, 90);
  }, { passive: true });
  // 画面の幅が変わったら（回転など）、今のスライドの位置へ合わせ直す。幅が同じ時は何もしない（スマホは流すだけで resize が来ることがある）
  let trackWidth = 0;
  const onResize = () => {
    const width = track.clientWidth;
    if (current < 0 || !width || width === trackWidth) return;
    trackWidth = width;
    track.scrollTo({ left: current * width, behavior: "auto" });
  };
  globalThis.addEventListener?.("resize", onResize);

  function start(index = current) {
    const slide = slides[index];
    if (!slide.open) { SE.cancel?.(); toast("本編で遊ぶと開きます"); return; }
    SE.select?.();
    finish({ id: slide.game.id, pick: picks[slide.game.id] ?? null });
  }
  const onKey = (event) => {
    if (!resolve || root.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") { event.preventDefault(); SE.cancel?.(); finish(null); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) { event.preventDefault(); go(current + step, { sound: true }); return; }
    const chips = [...slides[current].node.querySelectorAll(".xs-chip.is-pick")];
    const chipStep = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (chipStep && chips.length) {
      event.preventDefault();
      const at = chips.findIndex((chip) => chip.classList.contains("is-on"));
      chips[Math.max(0, Math.min(chips.length - 1, at + chipStep))].click();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !event.repeat && document.activeElement?.closest?.(".xs-chip, .xs-close, .xs-thumb, .xs-dot, .xs-nav")) return;
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) { event.preventDefault(); start(); }
  };
  document.addEventListener("keydown", onKey, true);

  return {
    root,
    choose() {
      root.hidden = false;
      const first = current < 0 ? Math.max(0, EXTRA_GAMES.findIndex((game) => played.has(game.id))) : current;
      requestAnimationFrame(() => { go(first, { smooth: false }); restartTimer(); slides[first].node.querySelector(".xs-play:not(:disabled)")?.focus({ preventScroll: true }); });
      return new Promise((done) => { resolve = done; });
    },
    hide() { root.hidden = true; clearInterval(timer); timer = 0; },
    destroy() { clearInterval(timer); clearTimeout(scrollTimer); document.removeEventListener("keydown", onKey, true); globalThis.removeEventListener?.("resize", onResize); root.remove(); },
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
