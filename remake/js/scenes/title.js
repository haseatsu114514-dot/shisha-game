// タイトル画面。用語集は会話画面・ゲーム中のメニューから開く。
import { el } from "../core/util.js";
import { imgFileUrl } from "../core/img-file.js";
import { DB, bgUrl } from "../core/data.js";
import { readGalleryProgress } from "../core/gallery-progress.js";
import { galleryEntries, galleryStats } from "../core/gallery-catalog.js";
import { layers, showScreen, setBg, smokeWipe, modal } from "../core/ui.js";
import { peekSave, newGame, wipeSave, config, saveConfig, anySlotSaved, loadFromSlot, readSlot, SAVE_SLOTS } from "../core/state.js";
import { difficultyForRun } from "../core/ngplus-difficulty.js";
import { playBgm, stopBgm, SE, applyVolumes } from "../core/audio.js";
import { startNewGame, resumeGame } from "../chapters/ch1.js";
import { openGallery } from "./gallery.js";
import { loadFlow } from "./saves.js";
import { pickTitleArt, prepareTitleArt } from "./title-art.js";
import { mountTitleLayout } from "./title-layout.js";
import { createUiThemeSelect } from "../core/ui-theme.js";

let titleRevision = 0;
// 直近に表示したキャラアート。メニューを閉じて再描画するだけのときは同じ絵を使い回し、
// 読込待ちや無駄な抽選切替を起こさない。新しい絵はブート/タイトル復帰（reload）でだけ選ぶ。
let currentArt = null;

// ---------------------------------------------------------------- NG+ 周回開始（Issue #1228 U10）
// 解放と引き継ぎパッケージの正本は周回メタ層（U2: core/cycle-meta.js）、
// 開始処理の正本は U3（core/cycle-start.js）。どちらの着地順にも依存しないよう
// 動的 import で接続し、未着・未解放の間は導線自体を出さない。
let cycleMetaSeen = null; // 直近に確認したメタ層。未確認・未解放は null
let cycleMetaSig = "none"; // 表示に効く部分（解放・パッケージ識別子）の署名

function cycleMetaSignature(meta) {
  if (!meta || meta.unlocked !== true) return "none";
  const pkg = meta.carryPackage;
  return `open|${pkg?.fromCycleId ?? ""}|${pkg?.fromCycle ?? ""}`;
}

async function loadCycleMeta(current, refresh) {
  try {
    const { readCycleMeta } = await import("../core/cycle-meta.js");
    const meta = readCycleMeta();
    cycleMetaSeen = meta;
    const sig = cycleMetaSignature(meta);
    if (sig !== cycleMetaSig) {
      cycleMetaSig = sig;
      if (current()) refresh();
    }
  } catch { /* メタ層が未着の間は導線を出さない */ }
}

/**
 * メタ層のパッケージを startNextCycle に渡す形へ展開する。
 * 外装（検証済みの fromCycle）が正本で、data の中に同名の値があっても採用しない。
 * 解放済みでも有効なパッケージがなければ null。
 */
export function startPackageFromMeta(meta) {
  const carried = meta?.unlocked === true ? meta.carryPackage : null;
  if (!carried || typeof carried !== "object") return null;
  const { fromCycle, data } = carried;
  if (!Number.isFinite(fromCycle) || fromCycle < 1) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return { ...structuredClone(data), fromCycle };
}

const CYCLE_GROUPS = [
  ["stats", "能力"],
  ["money", "所持金"],
  ["items", "所持品"],
  ["knowledge", "知識・記録"],
];
let nextCycleStarting = false;

/**
 * 周回開始のオプション選択→オートセーブ上書き確認→開始までを行う。
 * 開始したら { started: true }、それ以外は理由つきで { started: false } を返す。
 * 画面遷移は呼び出し側（タイトル）が行う。周回開始では newGame() を呼ばない。
 */
export async function openNextCycleOptions(meta) {
  if (nextCycleStarting) return { started: false, reason: "busy" };
  nextCycleStarting = true;
  try {
    const pkg = startPackageFromMeta(meta);
    if (!pkg) {
      await modal({
        title: "周回開始",
        body: "保存情報を確認できないため、周回を開始できません。",
        options: [{ label: "閉じる", value: true, primary: true, test: "cycle-nopkg-close" }],
      });
      return { started: false, reason: "no-package" };
    }
    const nextCycle = pkg.fromCycle + 1;
    const groups = Object.fromEntries(CYCLE_GROUPS.map(([key]) => [key, true]));
    const rows = CYCLE_GROUPS.map(([key, label]) => {
      const input = el("input", {
        type: "checkbox",
        dataset: { test: `cycle-group-${key}` },
        onchange: (e) => { groups[key] = e.target.checked; },
      });
      input.checked = true;
      return el("label.cfg-row", [el("span", { text: label }), input]);
    });
    const choice = await modal({
      title: `${nextCycle}周目をはじめる`,
      body: el("div.cfg", [
        el("p", { text: "能力と持ち物を引き継いで、出会いからもう一度はじめます。" }),
        el("p", { text: "好感度・恋愛や出会いの記録は引き継がれず、新しく始まります。" }),
        ...rows,
      ]),
      options: [
        { label: "はじめる", value: true, primary: true, test: "cycle-start" },
        { label: "やめる", value: false, test: "cycle-cancel" },
      ],
    });
    if (choice !== true) return { started: false, reason: "cancelled" };

    // §8.3: 周回開始でオートセーブを上書きする前に確認する（U9 と共有する文面）。
    const autoSlot = SAVE_SLOTS.find((s) => s.auto) ?? SAVE_SLOTS[0];
    const auto = readSlot(autoSlot.key);
    if (auto) {
      const ok = await modal({
        title: "周回開始",
        body: `現在のオートセーブ（${auto.cycle ?? 1}周目・第${auto.chapter ?? 1}章）は上書きされます。手動セーブ枠は残ります`,
        options: [
          { label: "上書きしてはじめる", value: true, primary: true, test: "cycle-overwrite" },
          { label: "やめる", value: false, test: "cycle-overwrite-cancel" },
        ],
      });
      if (ok !== true) return { started: false, reason: "cancelled" };
    }

    let metaModule, startNextCycle;
    try {
      metaModule = await import("../core/cycle-meta.js");
      ({ startNextCycle } = await import("../core/cycle-start.js"));
    } catch {
      await modal({
        title: "周回開始",
        body: "周回開始の準備ができていないため、開始できません。",
        options: [{ label: "閉じる", value: true, primary: true, test: "cycle-unavailable-close" }],
      });
      return { started: false, reason: "unavailable" };
    }
    // 開始直前にメタ層を読み直し、表示に使ったパッケージと同一か確かめる。
    const freshMeta = metaModule.readCycleMeta();
    const freshPkg = startPackageFromMeta(freshMeta);
    if (!freshPkg
      || freshMeta.carryPackage.fromCycleId !== meta.carryPackage.fromCycleId
      || freshMeta.carryPackage.at !== meta.carryPackage.at) {
      await modal({
        title: "周回開始",
        body: "保存情報が変わったため、周回を開始できません。タイトルからやり直してください。",
        options: [{ label: "閉じる", value: true, primary: true, test: "cycle-changed-close" }],
      });
      return { started: false, reason: "changed" };
    }
    // タイトルの有効性は呼び出し側の current() が担う（モーダル表示中は画面遷移しない）。
    startNextCycle(freshPkg, {
      groups: { ...groups },
      onCycleStarted: metaModule.recordCycleStarted,
      difficultyForRun,
    });
    return { started: true };
  } finally {
    nextCycleStarting = false;
  }
}

function galleryLabel() {
  try {
    const value = JSON.parse(localStorage.getItem("suien_remake_gallery") || "[]");
    const seenIds = new Set(Array.isArray(value) ? value.filter(id => typeof id === "string") : []);
    const stats = galleryStats(galleryEntries(DB.manifest, DB.gallery, readGalleryProgress(), seenIds));
    return stats.unlocked > 0 ? `GALLERY ${stats.rate}%` : "GALLERY";
  } catch { return "GALLERY"; }
}

export function showTitle(preparedArt = null) {
  const revision = ++titleRevision;
  let leaving = false;
  const current = () => !leaving && revision === titleRevision && document.body.dataset.screen === "title";
  const refresh = () => { if (current()) showTitle(); };
  layers.hud.classList.remove("show");
  setBg(bgUrl("bg_title"), { instant: true });
  playBgm("title");
  const saved = peekSave();
  const cyclePkg = startPackageFromMeta(cycleMetaSeen);
  const menu = el("nav.title-menu");
  const item = (en, ja, fn, test, disabled = false) =>
    el("button.title-item", { disabled: disabled || null, dataset: { test }, onclick: () => { SE.select(); fn(); } }, [
      el("span.ti-en", { text: en }),
      el("span.ti-ja", { text: ja }),
    ]);

  menu.append(
    item("NEW GAME", "はじめから", async () => {
      if (saved && !(await modal({
        title: "はじめから",
        body: "今のセーブデータは上書きされます。よろしいですか？",
        options: [{ label: "はじめから遊ぶ", value: true, primary: true, test: "confirm-new" }, { label: "やめる", value: false, test: "cancel-new" }],
      }))) { refresh(); return; }
      if (!current()) return;
      leaving = true;
      wipeSave();
      newGame();
      smokeWipe(() => { stopBgm(0); startNewGame(); }, { color: "dark" }); // 煙で覆った瞬間に開始（ゲーム本体の完了は待たない）
    }, "title-new"),
    ...(cycleMetaSeen?.unlocked === true ? [item("NEXT CYCLE", cyclePkg ? `${cyclePkg.fromCycle + 1}周目をはじめる` : "次の周目をはじめる", async () => {
      const result = await openNextCycleOptions(cycleMetaSeen);
      if (!current()) return;
      if (!result.started) { refresh(); return; }
      leaving = true;
      // 周回開始では wipeSave()/newGame() を呼ばず、startNextCycle が作った state のまま opening へ。
      smokeWipe(() => { stopBgm(0); startNewGame(); }, { color: "dark" });
    }, "title-next-cycle")] : []),
    item("LOAD", "つづきから", async () => {
      const key = await loadFlow();
      if (!current()) return;
      if (!key || !loadFromSlot(key)) { refresh(); return; }
      leaving = true;
      smokeWipe(() => { stopBgm(0); resumeGame(); }, { color: "dark" });
    }, "title-load", !anySlotSaved()),
    item(galleryLabel(), "ギャラリー", () => openGallery().then(refresh), "title-gallery"),
    item("CONFIG", "設定", () => openConfig().then(refresh), "title-config"),
  );

  const art = preparedArt || currentArt || pickTitleArt();
  // メニューを閉じただけの再描画（同じ絵の使い回し）は、フェードを繰り返さずそのまま置く。
  const reused = art === currentArt;
  const artNode = el("div.title-art", { "aria-hidden": "true", dataset: { character: art.character } });
  const root = el("div.title", [
    artNode,
    el("div.title-smoke", [el("i"), el("i"), el("i")]),
    el("div.title-left", [
      el("div.title-brand", [
        el("div.title-logo-smoke", { "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i")]),
        el("img.title-logo", { src: imgFileUrl("ui/ui_title_logo_rich.webp"), alt: "水煙前線 -EN:CODE-" }),
      ]),
      menu,
    ]),
    el("div.title-foot", { text: "TAP / CLICK / ENTER ── CH.01 SMOKE CROWN CUP" }),
  ]);
  showScreen("title", root);
  const brand = root.querySelector(".title-brand");
  const fallback = el("strong.title-logo-fallback", { text: "水煙前線 — EN:CODE", hidden: true });
  brand.append(fallback);
  const logo = brand.querySelector("img");
  const fallbackLogo = () => { logo.hidden = true; fallback.hidden = false; };
  logo.addEventListener("error", fallbackLogo);
  if (logo.complete && !logo.naturalWidth) fallbackLogo();
  mountTitleLayout(root, { art: artNode, brand, menu, left: root.querySelector(".title-left"), background: bgUrl("bg_title") });
  const requested = performance.now();
  const place = (loaded) => {
    // 幕の終了待ちでrootが未接続のときも、そのrootへ絵を準備する。
    currentArt = { character: loaded.character, file: loaded.file, url: loaded.url, ready: true };
    artNode.dataset.character = loaded.character;
    artNode.dataset.art = loaded.file;
    artNode.style.backgroundImage = `url("${loaded.url}")`;
    if (reused) artNode.classList.add("shown");
    artNode.classList.add("ready");
    // 「読込待ち」と「アニメ時間」を分けて計測し、window.__titleArtTiming で参照できるようにする。
    const loadWaitMs = Math.round(performance.now() - requested);
    const timing = { character: loaded.character, file: loaded.file, loadWaitMs, animMs: null };
    window.__titleArtTiming = timing;
    artNode.addEventListener("animationstart", (e) => {
      if (e.animationName === "title-art-in") timing._animStart = performance.now();
    });
    artNode.addEventListener("animationend", (e) => {
      if (e.animationName === "title-art-in" && timing._animStart != null) timing.animMs = Math.round(performance.now() - timing._animStart);
    });
  };
  if (art.ready) place(art);
  else prepareTitleArt(art).then(place);
  // 周回メタ層を確認し、解放状態が変わっていたら導線の表示を更新する。
  loadCycleMeta(current, refresh);
}

export async function openConfig(opts = {}) {
  const persist = () => {
    if (document.body?.dataset?.screen !== "preview") saveConfig();
  };
  const row = (label, input) => el("label.cfg-row", [el("span", { text: label }), input]);
  const range = (key, min, max, step, test) =>
    el("input", {
      type: "range", min, max, step, value: config[key],
      dataset: { test },
      oninput: (e) => { config[key] = Number(e.target.value); applyVolumes(); persist(); opts.onChange?.(key, config[key]); },
    });
  const speed = el("select", {
    dataset: { test: "cfg-text-speed" },
    onchange: (e) => { config.textSpeed = Number(e.target.value); persist(); opts.onChange?.("textSpeed", config.textSpeed); },
  }, [["1", "ゆっくり"], ["2", "ふつう"], ["3", "はやい"], ["4", "瞬間表示"]].map(([v, t]) => {
    const o = el("option", { value: v, text: t });
    if (Number(v) === config.textSpeed) o.selected = true;
    return o;
  }));
  const autoSpeed = el("select", {
    dataset: { test: "cfg-auto-speed" },
    onchange: (e) => { config.autoSpeed = Number(e.target.value); persist(); opts.onChange?.("autoSpeed", config.autoSpeed); },
  }, [["1", "ゆっくり"], ["2", "ふつう"], ["3", "はやい"]].map(([v, t]) => {
    const o = el("option", { value: v, text: t });
    if (Number(v) === config.autoSpeed) o.selected = true;
    return o;
  }));
  const skipMode = el("select", {
    dataset: { test: "cfg-skip-mode" },
    onchange: (e) => { config.skipSeenOnly = e.target.value === "seen"; persist(); opts.onChange?.("skipSeenOnly", config.skipSeenOnly); },
  }, [["all", "全スキップ"], ["seen", "既読のみスキップ"]].map(([v, t]) => {
    const o = el("option", { value: v, text: t });
    if ((v === "seen") === !!config.skipSeenOnly) o.selected = true;
    return o;
  }));
  const reduceShake = el("input", {
    type: "checkbox", dataset: { test: "cfg-reduce-shake" },
    onchange: (e) => { config.reduceShake = e.target.checked; persist(); opts.onChange?.("reduceShake", config.reduceShake); },
  });
  reduceShake.checked = !!config.reduceShake;
  const blip = el("input", {
    type: "checkbox",
    dataset: { test: "cfg-voice-blip" },
    onchange: (e) => { config.voiceBlip = e.target.checked; persist(); opts.onChange?.("voiceBlip", config.voiceBlip); },
  });
  blip.checked = config.voiceBlip;
  const shortSeen = el("input", {
    type: "checkbox",
    dataset: { test: "cfg-short-seen" },
    onchange: (e) => { config.shortSeen = e.target.checked; persist(); opts.onChange?.("shortSeen", config.shortSeen); },
  });
  shortSeen.checked = config.shortSeen;
  const effectColors = el("input", {
    type: "checkbox", dataset: { test: "cfg-stat-effect-colors" },
    onchange: (e) => { config.statEffectColors = e.target.checked; persist(); opts.onChange?.("statEffectColors", config.statEffectColors); },
  });
  effectColors.checked = config.statEffectColors !== false;
  return modal({
    title: "設定",
    body: el("div.cfg", [
      row("UIデザイン", createUiThemeSelect(config.uiTheme, value => { config.uiTheme = value; persist(); opts.onChange?.("uiTheme", value); })),
      row("BGM 音量", range("bgmVolume", 0, 1, 0.05, "cfg-bgm-volume")),
      row("効果音 音量", range("seVolume", 0, 1, 0.05, "cfg-se-volume")),
      row("文字の速さ", speed),
      row("AUTOの速さ", autoSpeed),
      row("SKIPの範囲", skipMode),
      row("揺れ・閃光を減らす", reduceShake),
      row("文字送りの声", blip),
      row("見た演出を短く", shortSeen),
      row("能力の効き目を色で表示", effectColors),
    ]),
    options: [{ label: "閉じる", value: true, primary: true, test: "cfg-close" }],
  });
}
