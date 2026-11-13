// タイトル画面。用語集は会話画面・ゲーム中のメニューから開く。
import { el } from "../core/util.js";
import { imgFileUrl } from "../core/img-file.js";
import { DB, bgUrl } from "../core/data.js";
import { readGalleryProgress } from "../core/gallery-progress.js";
import { galleryEntries, galleryStats } from "../core/gallery-catalog.js";
import { layers, showScreen, setBg, smokeWipe, modal } from "../core/ui.js";
import { peekSave, peekLatestSave, newGame, wipeSave, config, saveConfig, anySlotSaved, readSlot, SAVE_SLOTS } from "../core/state.js";
import { difficultyForRun } from "../core/ngplus-difficulty.js";
import { playBgm, stopBgm, SE, applyVolumes } from "../core/audio.js";
import { startNewGame, resumeGame } from "../chapters/ch1.js";
import { clearLog } from "../vn/engine.js";
import { openGallery } from "./gallery.js";
import { loadWithRecovery, saveHeadline } from "./saves.js";
import { pickTitleArt, prepareTitleArt } from "./title-art.js";
import { createUiThemeSelect } from "../core/ui-theme.js";
import { LOOKS, normalizeLook, setLook } from "../core/look.js";
import { refreshSideArea } from "../core/side-area.js";
import { fullscreenButton, saveTransferRow } from "./save-transfer.js";

let titleRevision = 0;

/** 今遊んでいる版（公開時に index.html の meta へ書かれる。手元は dev）。自分のリンクが古い版か見分ける用 */
function buildLabel() {
  const meta = globalThis.document?.querySelector?.('meta[name="suien-build"]');
  const build = meta?.content || "dev";
  const built = build === "dev" ? "" : meta.dataset.built;
  return built ? `ver. ${built} (${build})` : `ver. ${build}`;
}
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

// ---------------------------------------------------------------- メニューのカーソル（選んでいる行）
// 目立たせる行はいつも1つ（.is-current）。開いた時はおすすめの行（セーブがあれば「つづきから」、無ければ
// 「はじめから」）に置き、マウスを乗せる・Tab・↑↓で動く。Enter／Space はその行を決定する。
// メニューを閉じて描き直した時は、直前に選んでいた行へ戻す（設定を閉じたら CONFIG のまま）。
let cursorTest = null;
let keepCursor = false;
let keysBound = false;
let titleLive = () => false; // いま出ているタイトルが操作を受け付けているか（showTitle が差し替える）

const liveItems = () => [...document.querySelectorAll("#screen > .title .title-menu > .title-item")];

function setCursor(nodes, node, { focus = false } = {}) {
  if (!node || node.disabled) return;
  for (const n of nodes) n.classList.toggle("is-current", n === node);
  cursorTest = node.dataset.test;
  if (focus) node.focus?.({ preventScroll: true });
}

function bindTitleKeys() {
  if (keysBound || typeof document.addEventListener !== "function") return;
  keysBound = true;
  document.addEventListener("keydown", (e) => {
    if (!titleLive() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    // 確認・設定などの小窓や会話を開いている間は、そちらの操作（タイトルの上に重なる画面へ行くはずのキーを奪わない）
    if (document.querySelector("#modal.show") || document.body.classList.contains("vn-open")) return;
    const nodes = liveItems();
    const usable = nodes.filter((n) => !n.disabled);
    if (!usable.length) return;
    // 上に何か（起動の幕・煙の幕・DS風の外枠・回転の案内など）が掛かっていて行を押せない時は、キーでも動かさない。
    const probe = usable[0].getBoundingClientRect();
    if (!usable[0].contains(document.elementFromPoint(probe.left + probe.width / 2, probe.top + probe.height / 2))) return;
    if (e.key === "Tab") { nodes[0].closest(".title")?.setAttribute("data-nav", "key"); return; }
    const at = usable.findIndex((n) => n.classList.contains("is-current"));
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    const edge = { Home: 0, End: usable.length - 1 }[e.key];
    if (step || edge != null) {
      e.preventDefault();
      const next = usable[edge ?? (at < 0 ? 0 : (at + step + usable.length) % usable.length)];
      if (next !== usable[at]) SE.click?.();
      nodes[0].closest(".title")?.setAttribute("data-nav", "key");
      setCursor(nodes, next, { focus: true });
    } else if ((e.key === "Enter" || e.key === " ") && !e.repeat && at >= 0) {
      // ボタンにフォーカスがある時はブラウザが押してくれる。どこにも無い時だけ代わりに押す。
      const active = document.activeElement;
      if (active && active !== document.body && active.matches?.("button, a, input, select, textarea")) return;
      e.preventDefault();
      usable[at].click();
    }
  });
}

/** 「つづきから」に添える1行（いちばん新しいセーブの章・日付）。読めない時は出さない。 */
function latestSaveNote() {
  try { return saveHeadline(peekLatestSave()) || ""; } catch { return ""; }
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
  const refresh = () => { if (current()) { keepCursor = true; showTitle(); } };
  titleLive = current;
  layers.hud.classList.remove("show");
  setBg(bgUrl("bg_title"), { instant: true });
  playBgm("title");
  const saved = peekSave();
  const cyclePkg = startPackageFromMeta(cycleMetaSeen);
  const menu = el("nav.title-menu");
  // 押した行は一瞬光らせる（.is-picked。確認や煙の幕が出る前から、押せたことが分かる）。
  const item = (en, ja, fn, test, disabled = false, note = "") => {
    const node = el("button.title-item", {
      disabled: disabled || null, dataset: { test },
      onclick: () => { SE.select(); setCursor(menu.querySelectorAll(".title-item"), node); node.classList.add("is-picked"); fn(); },
      onpointerenter: (e) => { if (e.pointerType !== "touch") setCursor(menu.querySelectorAll(".title-item"), node); },
      onfocus: () => setCursor(menu.querySelectorAll(".title-item"), node),
    }, [
      el("span.ti-en", { text: en }),
      el("span.ti-ja", { text: ja }),
      note ? el("span.ti-note", { text: note }) : null,
    ]);
    return node;
  };

  menu.append(
    item("NEW GAME", "はじめから", async () => {
      // wipeSave() はオートセーブ（AUTOキー）だけを消し、newGame() も手動枠に触れない。
      // 何が消えるかを L121 の周回開始と同じ文面で明示する（#2444 item6）。
      if (saved && !(await modal({
        title: "はじめから",
        body: `現在のオートセーブ（${saved.cycle ?? 1}周目・第${saved.chapter ?? 1}章）は上書きされます。手動セーブ枠は残ります。よろしいですか？`,
        options: [{ label: "はじめから遊ぶ", value: true, primary: true, test: "confirm-new" }, { label: "やめる", value: false, test: "cancel-new" }],
      }))) { refresh(); return; }
      if (!current()) return;
      leaving = true;
      wipeSave();
      newGame();
      clearLog(); // 前の周・別セーブの会話LOGを持ち込まない（#1912）
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
      const loaded = await loadWithRecovery();
      if (!current()) return;
      if (!loaded) { refresh(); return; }
      clearLog();
      leaving = true;
      smokeWipe(() => { stopBgm(0); resumeGame(); }, { color: "dark" });
    }, "title-load", !anySlotSaved(), anySlotSaved() ? latestSaveNote() : ""),
    item(galleryLabel(), "ギャラリー", () => openGallery().then(refresh), "title-gallery"),
    item("CONFIG", "設定", () => openConfig().then(refresh), "title-config"),
  );

  // カーソルの初期位置。決定を押すだけで本編へ入れるよう、いちばん使う行に置く。
  const rows = [...menu.querySelectorAll(".title-item")];
  const byTest = (test) => rows.find((n) => n.dataset.test === test && !n.disabled);
  const remembered = keepCursor ? byTest(cursorTest) : null;
  keepCursor = false;
  setCursor(rows, remembered || byTest("title-load") || byTest("title-new"));
  bindTitleKeys();

  const art = preparedArt || currentArt || pickTitleArt();
  // メニューを閉じただけの再描画（同じ絵の使い回し）は、フェードを繰り返さずそのまま置く。
  const reused = art === currentArt;
  const artNode = el("div.title-art", { "aria-hidden": "true", dataset: { character: art.character } });
  // 背景は title が自分で描く（.title-bg）。シーシャの台をメニューと人物の絵の間に見せるため、左へ寄せて置く。
  // 共通の背景層（#bg）は、DS風の上画面が読むのでそのまま残す（通常の表示では、この絵の下に隠れる）。
  const root = el("div.title", { onpointermove: () => root.removeAttribute?.("data-nav") }, [
    el("div.title-bg", { "aria-hidden": "true", style: { backgroundImage: `url("${bgUrl("bg_title")}")` } }, [el("i.title-ember")]),
    artNode,
    el("div.title-smoke", [el("i"), el("i"), el("i")]),
    el("div.title-left", [
      el("div.title-brand", [
        el("div.title-logo-smoke", { "aria-hidden": "true" }, [el("i"), el("i"), el("i"), el("i")]),
        el("img.title-logo", { src: imgFileUrl("ui/ui_title_logo_rich.webp"), alt: "水煙前線 -EN:CODE-" }),
      ]),
      menu,
    ]),
    el("div.title-ver", { text: buildLabel() }),
  ]);
  if (!reused) root.classList.add("enter"); // 入ってきた時だけメニューを順に出す（閉じて描き直す時は動かさない）
  showScreen("title", root);
  const brand = root.querySelector(".title-brand");
  const fallback = el("strong.title-logo-fallback", { text: "水煙前線 — EN:CODE", hidden: true });
  brand.append(fallback);
  const logo = brand.querySelector("img");
  const fallbackLogo = () => { logo.hidden = true; fallback.hidden = false; };
  logo.addEventListener("error", fallbackLogo);
  if (logo.complete && !logo.naturalWidth) fallbackLogo();
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
  // 段ボタン（#2857）。押せる部品を大きくするため <select> から置き換えた。保存キーと値は旧 <select> と同じ。
  // label で包むと文言のタップが先頭の段に当たるので、行は div にして段の組へ名前を付ける。
  const segRow = (label, test, choices, current, pick) => {
    const buttons = choices.map(([value, text]) => el("button.cfg-seg-btn", {
      type: "button", role: "radio", value, text, "aria-checked": String(value === current),
      onclick: () => {
        for (const b of buttons) b.setAttribute("aria-checked", String(b.value === value));
        pick(value);
      },
    }));
    return el("div.cfg-row", [el("span", { text: label }), el("div.cfg-seg", { role: "radiogroup", "aria-label": label, dataset: { test } }, buttons)]);
  };
  const setConfig = (key, value) => { config[key] = value; persist(); opts.onChange?.(key, value); };
  const speed = segRow("文字の速さ", "cfg-text-speed", [["1", "おそい"], ["2", "ふつう"], ["3", "はやい"], ["4", "瞬間"]],
    String(config.textSpeed), (v) => setConfig("textSpeed", Number(v)));
  const autoSpeed = segRow("AUTOの速さ", "cfg-auto-speed", [["1", "おそい"], ["2", "ふつう"], ["3", "はやい"]],
    String(config.autoSpeed), (v) => setConfig("autoSpeed", Number(v)));
  const skipMode = segRow("SKIPの範囲", "cfg-skip-mode", [["seen", "既読"], ["all", "全部"]],
    config.skipSeenOnly ? "seen" : "all", (v) => setConfig("skipSeenOnly", v === "seen"));
  // 見た目の様式（LK01）。既定は新版（LK09）。新版・旧版・DS風のどれも、すべての章でいつでも切り替えられる（LK13・LK21）。
  const look = segRow("見た目", "cfg-look", LOOKS.map(({ id, label }) => [id, label]),
    normalizeLook(config.look), (v) => { setConfig("look", v); setLook(v); });
  const portraits = segRow("会話の立ち絵", "cfg-portrait-style", [["classic", "旧"], ["new", "新"]],
    config.portraitStyle === "classic" ? "classic" : "new", (v) => setConfig("portraitStyle", v));
  const introArt = segRow("登場カットインの絵柄", "cfg-intro-art", [["classic", "旧"], ["graphic", "新"]],
    config.introArtStyle === "classic" ? "classic" : "graphic", (v) => setConfig("introArtStyle", v));
  // 立ち絵から登場カットインへの「変身」（2026-11-02 オーナー採用。グラフィック絵柄のときだけ効く）
  const introTransition = segRow("登場カットインへの変身", "cfg-intro-transition", [["none", "なし"], ["morph", "変身"]],
    config.introTransition === "none" ? "none" : "morph", (v) => setConfig("introTransition", v));
  // 左右の余白（横長のスマホでステージの外に余る所・YHK）。余白が無い画面では何も変わらない。
  const sideArea = segRow("左右の余白", "cfg-side-area", [["full", "帯とボタン"], ["plain", "ぼかしだけ"]],
    config.sideArea === "plain" ? "plain" : "full", (v) => { setConfig("sideArea", v); refreshSideArea(); });
  const reduceShake = el("input", {
    type: "checkbox", dataset: { test: "cfg-reduce-shake" },
    onchange: (e) => { config.reduceShake = e.target.checked; document.body.classList.toggle("reduce-shake", config.reduceShake); persist(); opts.onChange?.("reduceShake", config.reduceShake); },
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
  // ミュートは 🔇 のトグル（#2857）。保存キーは従来どおり config.mute。
  const mute = el("button.cfg-mute", {
    type: "button", dataset: { test: "cfg-mute" }, "aria-label": "ミュート", "aria-pressed": String(!!config.mute),
    text: config.mute ? "🔇" : "🔊",
    onclick: (e) => {
      config.mute = !config.mute; delete config.muted; applyVolumes(); persist();
      e.currentTarget.setAttribute("aria-pressed", String(config.mute));
      e.currentTarget.textContent = config.mute ? "🔇" : "🔊";
      opts.onChange?.("mute", config.mute);
    },
  });
  const fullscreen = fullscreenButton();
  return modal({
    title: "設定",
    body: el("div.cfg", [
      row("UIデザイン", createUiThemeSelect(config.uiTheme, value => { config.uiTheme = value; persist(); opts.onChange?.("uiTheme", value); })),
      look,
      row("ミュート（すべての音を消す）", mute),
      row("BGM 音量", range("bgmVolume", 0, 1, 0.05, "cfg-bgm-volume")),
      row("効果音 音量", range("seVolume", 0, 1, 0.05, "cfg-se-volume")),
      speed,
      autoSpeed,
      skipMode,
      portraits,
      introArt,
      introTransition,
      sideArea,
      row("揺れ・閃光を減らす", reduceShake),
      row("文字送りの声", blip),
      row("見た演出を短く", shortSeen),
      row("能力の効き目を色で表示", effectColors),
      ...(fullscreen ? [el("div.cfg-row", [el("span", { text: "全画面" }), fullscreen])] : []),
      saveTransferRow(),
    ]),
    options: [{ label: "閉じる", value: true, primary: true, test: "cfg-close" }],
    className: "cfg-modal",
  });
}

