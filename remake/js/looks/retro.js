// DS風（上下2画面・256×192 のレトロな様式・LK03）。見た目は css/look-retro.css。
// 現行の画面（#stage）は動かしたまま隠し、その内容を低い解像度の2画面へ写して操作を中継する。進行・判定・セーブには触れない。
// 対応している場面はタイトル・会話と選択肢・日常の地図・ボタンが並ぶだけの画面（tonari の行動選びなど）。
// 全画面 MENU・LIME・小窓（設定・用語集・セーブ／ロード・規則の紙・確認の問い）・会話の LOG は、シート（retro/sheet.js）で写す。
// 場面転換・日付の札・章タイトル・詩・登場カットインなどの「見るだけの覆い」は、外枠のまま暗くして文字と絵だけを写す。
// それ以外（シーシャ作り・店・ミニゲーム…）では外枠を引っ込めて現行の画面をそのまま見せる。
// 横持ちのタッチ端末では外枠を出さない。
// setActive(false) では、足した要素・監視・タイマー・属性をすべて片付けて現行へ戻す。
//
// 同じ外枠を、新版の縦持ち（LK11）も使う（looks/neo.js が startShell({ paint: "hd", mode: "portrait" }) で動かす）。
//   paint: "dot"（DS風のドット絵・retro/painter.js）／"hd"（新版と同じ高解像度の絵・retro/painter-hd.js）
//   mode:  "retro"（DS風の条件: 縦長の画面か PC）／"portrait"（縦長の画面だけ）
// 新版の縦持ちでは、未対応の場面（店・シーシャ作り・ミニゲーム…）で小さい横長の画面を見せず、
// 回転案内（#rotate-hint）を出す（タッチでない縦長の窓では案内が出ないので、DS風と同じく小さい画面＋一言）。
// どちらの描き方かは <html data-retro-paint="dot|hd"> と外枠の data-paint で分かる。
import { createShell } from "./retro/shell.js";
import { createPainter } from "./retro/painter.js";
import { createHdPainter } from "./retro/painter-hd.js";
import { engageState, detectState, isPortrait, isLoading, topDialogOpen } from "./retro/detect.js";
import { createVnScene } from "./retro/vn.js";
import { createMapScene } from "./retro/map.js";
import { createTitleScene } from "./retro/title.js";
import { createMenuScene } from "./retro/menu.js";
import { createCoverScene } from "./retro/cover.js";
import { createSheetScene } from "./retro/sheet.js";
import { el } from "../core/util.js";

const DETECT_MS = 110;      // 場面の確認は 1 秒に 9 回ほど
const SYNC_MS = 250;        // 変化の通知が無くても、この間隔で写し直す
const NOTE_DELAY_MS = 600;  // 短い場面転換の間は「横向きにすると…」を出さない
const GAP_MS = 3000;        // 場面と場面のあいだの何も出ていない間は、ここまで外枠のまま（背景を出して）待つ
const STUCK_MS = 6000;      // 何も写せない覆いがタップを待ったままなら、安全のため現行の画面へ切り替える
const COVER_MAX_MS = 20000; // 覆いの中身が変わらないまま続く上限（外枠が暗いまま止まらないように）
const NOTE_UNSUPPORTED = "この場面は横向きにすると大きく表示されます";
// 新版の縦持ちで回転案内を出している間の文（元の文は隠して、外枠を止めたら戻す）
const HINT_MAIN = "この画面は横向きで表示します", HINT_SUB = "端末を横にしてください";

let lookSession = null; // 様式「DS風」の外枠
let current = null;     // いま動いている外枠（同時に1つだけ）

/** 様式「DS風」の出し入れ（looks/index.js から呼ばれる）。 */
export function setActive(on) {
  if (!!lookSession === !!on) return;
  if (on) lookSession = startShell({ paint: "dot", mode: "retro" });
  else { lookSession.stop(); lookSession = null; }
}

/** 外枠を動かす。戻り値の stop() で、足した要素・監視・属性をすべて片付ける（何度呼んでもよい）。 */
export function startShell(options = {}) {
  current?.stop();
  const session = start(options);
  const handle = { stop() { if (current === handle) current = null; session.stop(); } };
  current = handle;
  return handle;
}

function start({ paint = "dot", mode = "retro" } = {}) {
  const root = document.documentElement;
  const hd = paint === "hd";
  const shell = createShell({ paint });
  const painter = hd ? createHdPainter(shell.canvas, { dotScale: shell.dotScale }) : createPainter(shell.canvas);
  root.dataset.retroPaint = paint;
  // 新版の縦持ち: 回転案内の文を差し替える（元の文は CSS で隠すだけで、書き換えない）
  const hint = hd ? document.getElementById("rotate-hint") : null;
  const hintText = hint ? el("div.retro-hint", { dataset: { test: "retro-hint" } }, [
    el("i.retro-hint-device", { "aria-hidden": "true" }),
    el("p.retro-hint-main", { text: HINT_MAIN }),
    el("p.retro-hint-sub", { text: HINT_SUB }),
  ]) : null;
  if (hintText) hint.append(hintText);
  const own = [shell.root, shell.note];
  const scenes = {
    title: createTitleScene(shell, painter), vn: createVnScene(shell, painter), map: createMapScene(shell, painter),
    menu: createMenuScene(shell, painter), cover: createCoverScene(shell, painter, own), sheet: createSheetScene(shell, painter),
  };
  for (const scene of Object.values(scenes)) shell.bottom.append(scene.pane);
  shell.mount();
  window.__retroLook = { stats: painter.stats, paint, mode }; // 確認・検査用（重い処理の回数と時間）

  let stopped = false, frame = 0;
  let engaged = "off", scene = null, candidate = null, streak = 0;
  let fresh = true; // 起動・向きの切り替えの直後。最初に見つけた対応済みの場面は待たずに出す（現行の画面を一瞬見せない）
  let dirty = true, detectSoon = true, lastDetect = 0, lastSync = 0, unsupportedSince = 0;
  let holdSince = 0, pressable = false, gap = false; // 覆い・あいだの待ちに入った時刻、覆いがタップを待っているか、あいだの待ちか
  let noneSince = 0, hold = false; // 新版の縦持ち: 未対応の場面になってから、回転案内を出すまで外枠のまま待つ間
  let coverBlocked = false;        // 待ちすぎて引っ込めた覆い（場面が変わるまで外枠へ戻さない）

  /** 回転案内（#rotate-hint）の出し入れを変えたら、core/rotate-guard.js に測り直させる。 */
  function setEngaged(next) {
    if (next === engaged) return;
    engaged = next;
    fresh = true;
    if (next === "on") root.dataset.retro = "on";
    else delete root.dataset.retro;
    window.dispatchEvent(new Event("resize"));
  }

  /** 新版の縦持ち: 外枠を出している間は回転案内を隠す。引っ込めたら案内を出す（タッチ端末の縦持ちだけ。base.css の条件）。 */
  function setHintHold(on) {
    if (!hd) return;
    if ((root.dataset.retroHint === "hold") === on) return;
    if (on) root.dataset.retroHint = "hold";
    else delete root.dataset.retroHint;
    window.dispatchEvent(new Event("resize"));
  }
  const hintShown = () => !!hint && getComputedStyle(hint).display !== "none";

  function setScene(next) {
    if (next === scene) return;
    const previous = scene;
    if (scene) { scenes[scene].leave(); scenes[scene].pane.hidden = true; }
    scene = next;
    shell.root.dataset.scene = next || "";
    shell.root.hidden = !next;
    shell.maphead.hidden = shell.markers.hidden = next !== "map";
    if (next !== "cover") holdSince = 0;
    if (next) {
      root.dataset.retroShell = "on";
      scenes[next].pane.hidden = false;
      scenes[next].enter();
      if (shell.layout()) painter.refresh();
      painter.enter(!!previous); // 外枠が出たままの切り替えは、今の絵から網点のコマ送りでつなぐ
      shell.setNotices([]);
      dirty = true;
    } else {
      delete root.dataset.retroShell;
      shell.setNotices([]);
      shell.setCaption("");
    }
  }

  /** periodic: 定期の確認（1 秒に 9 回ほど）。DOM の変化を受けた臨時の確認では、外枠を引っ込める・つなぐ判断だけを行う。 */
  function evaluate(now, periodic) {
    setEngaged(engageState(mode));
    const found = engaged === "on" ? detectState(own, { extended: hd }) : { kind: "none" };
    // 新版の縦持ち: 一番上の層に開いた <dialog>（第3章の東京の地図など）は、自分の作りで縦にも並ぶので、
    // 外枠を引っ込めて回転案内も出さず、そのまま見せる（案内は dialog の下に隠れて、音や制作の時計だけを止めてしまうため）
    const dialogOpen = hd && engaged === "on" && found.kind === "none" && topDialogOpen();
    if (found.kind !== "none" || engaged !== "on") noneSince = 0;
    if (found.kind === "scene" || found.kind === "none") coverBlocked = false;
    hold = false;
    if (scene) {
      // 外枠を出している間: 覆い・あいだの待ちは、外枠のままつなぐ
      if (found.kind === "scene") setScene(found.name);
      else if (found.kind === "cover" || found.kind === "gap") {
        if (!holdSince || gap !== (found.kind === "gap")) holdSince = now;
        gap = found.kind === "gap";
        pressable = !!found.pressable;
        const cover = scenes.cover;
        const since = now - Math.max(holdSince, scene === "cover" ? cover.activeAt() : 0);
        const limit = gap ? GAP_MS : pressable && !(scene === "cover" && cover.hasContent()) ? STUCK_MS : COVER_MAX_MS;
        if (since > limit) coverBlocked = true; // 待ちすぎて引っ込めた覆いへは、場面が変わるまで戻らない
        setScene(since > limit ? null : "cover");
      } else if (dialogOpen) {
        setScene(null);
      } else if (hd && engaged === "on") {
        // 新版の縦持ち: 未対応の場面でも、すぐには引っ込めない。短い間は外枠のまま（暗くして）待ち、続いたら回転案内へ
        noneSince ||= now;
        hold = now - noneSince < NOTE_DELAY_MS;
        setScene(hold ? "cover" : null);
      } else setScene(null);
      candidate = null; streak = 0;
    } else if (found.kind === "scene") {
      // 未対応からの復帰は、定期の確認で2回続けて同じ場面と判定してから（切り替えのちらつきを避ける）
      if (found.name !== candidate) { candidate = found.name; streak = 0; }
      if (periodic) streak++;
      if (fresh || streak >= 2) { setScene(found.name); candidate = null; streak = 0; fresh = false; }
    } else if (hd && engaged === "on" && !coverBlocked && (found.kind === "gap" || (found.kind === "cover" && found.base))) {
      // 新版の縦持ち: 回転案内から、場面転換・あいだの待ちになったら（その下が写せる場面なら）外枠へ戻して暗くつなぐ。
      // 定期の確認で2回続けてから（短いちらつきで案内と外枠が行き来しないように）
      if (found.kind !== candidate) { candidate = found.kind; streak = 0; }
      if (periodic) streak++;
      if (streak >= 2) {
        holdSince = now; gap = found.kind === "gap"; pressable = !!found.pressable;
        setScene("cover");
        candidate = null; streak = 0;
      }
    } else { candidate = null; streak = 0; }
    // 外枠を出していない間の一言
    let note = "";
    if (engaged === "on" && !scene && isPortrait() && !isLoading()) {
      unsupportedSince ||= now;
      // 新版の縦持ちで回転案内が出ている時は、案内が全面を覆うので一言は出さない
      if (now - unsupportedSince >= NOTE_DELAY_MS && !hintShown() && !dialogOpen) note = NOTE_UNSUPPORTED;
    }
    if (scene || engaged !== "on") unsupportedSince = 0;
    // 新版の縦持ち: 外枠を出している間と、読み込みの画面（縦持ち用の配置を持つ）の間は回転案内を隠す
    setHintHold(!!scene || (engaged === "on" && (isLoading() || dialogOpen)));
    if (shell.note.textContent !== note) shell.note.textContent = note;
    shell.note.hidden = !note;
  }

  /** 現行のトースト・報酬の札を、上画面の知らせとして文字で写す。 */
  function syncNotices() {
    const lines = [];
    for (const toast of document.querySelectorAll("#toasts > .toast")) lines.push(toast.textContent.trim());
    for (const card of document.querySelectorAll("#banners > .gain-card:not(.out)")) {
      const part = (selector) => card.querySelector(selector)?.textContent.trim() || "";
      lines.push([part(".gc-main"), part(".gc-points"), part(".gc-sub")].filter(Boolean).join(" "));
    }
    // その場のレベルアップ・ご褒美の火種（演出の層の短い札・SBD122）も、同じ知らせに文字で出す
    for (const cut of document.querySelectorAll("#fx > .lvup:not(.out)")) if (cut.dataset.line) lines.push(cut.dataset.line);
    shell.setNotices(lines);
  }

  function tick(now) {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    const periodic = now - lastDetect >= DETECT_MS;
    if (detectSoon || periodic) {
      detectSoon = false;
      if (periodic) lastDetect = now;
      evaluate(now, periodic);
    }
    if (!scene) return;
    if (dirty || now - lastSync >= SYNC_MS) {
      dirty = false;
      lastSync = now;
      scenes[scene].sync({ pressable, gap, hold });
      syncNotices();
    }
    scenes[scene].paint(now);
  }

  // 現行の DOM の変化を見張る。自分の外枠の中の変化は数えない。会話の文字送りだけの変化では場面の確認を急がない。
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (!target || own.some((mine) => mine.contains(target))) continue;
      dirty = true;
      if (!target.closest?.(".vn-text, .vn-inner")) detectSoon = true;
    }
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["class", "hidden", "style", "src", "disabled", "aria-disabled", "aria-pressed", "data-screen", "data-revealing", "data-slot", "data-health", "data-tab", "aria-selected", "aria-expanded", "aria-checked", "title"],
  });

  const onResize = () => { if (shell.layout()) painter.refresh(); detectSoon = true; dirty = true; };
  const onTopTap = () => { if (scene) scenes[scene].tapTop?.(); };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  shell.top.addEventListener("click", onTopTap);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      shell.top.removeEventListener("click", onTopTap);
      setScene(null);
      shell.unmount();
      painter.dispose();
      delete window.__retroLook;
      const wasEngaged = engaged === "on";
      engaged = "off";
      hintText?.remove();
      delete root.dataset.retro;
      delete root.dataset.retroShell;
      delete root.dataset.retroHint;
      delete root.dataset.retroPaint;
      if (wasEngaged || hd) window.dispatchEvent(new Event("resize")); // 回転案内を現行どおりに戻す
    },
  };
}
