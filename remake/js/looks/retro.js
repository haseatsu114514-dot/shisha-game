// DS風（上下2画面・256×192 のレトロな様式・LK03）。見た目は css/look-retro.css。
// 現行の画面（#stage）は動かしたまま隠し、その内容を低い解像度の2画面へ写して操作を中継する。進行・判定・セーブには触れない。
// 対応している場面はタイトル・会話と選択肢・日常の地図。それ以外（MENU・LIME・設定・ロード・場面転換・シーシャ作り…）では
// 外枠を引っ込めて現行の画面をそのまま見せる。横持ちのタッチ端末では外枠を出さない。
// setActive(false) では、足した要素・監視・タイマー・属性をすべて片付けて現行へ戻す。
import { createShell } from "./retro/shell.js";
import { createPainter } from "./retro/painter.js";
import { engageState, detectScene, isPortrait, isLoading } from "./retro/detect.js";
import { createVnScene } from "./retro/vn.js";
import { createMapScene } from "./retro/map.js";
import { createTitleScene } from "./retro/title.js";

const DETECT_MS = 110;      // 場面の確認は 1 秒に 9 回ほど
const SYNC_MS = 250;        // 変化の通知が無くても、この間隔で写し直す
const NOTE_DELAY_MS = 600;  // 短い場面転換の間は「横向きにすると…」を出さない
const NOTE_UNSUPPORTED = "この場面は横向きにすると大きく表示されます";
const NOTE_OLD_LAYOUT = "表示設定を通常版にするとDS風が使えます";

let session = null;

export function setActive(on) {
  if (!!session === !!on) return;
  if (on) session = start();
  else { session.stop(); session = null; }
}

function start() {
  const root = document.documentElement;
  const shell = createShell();
  const painter = createPainter(shell.canvas);
  const scenes = { title: createTitleScene(shell, painter), vn: createVnScene(shell, painter), map: createMapScene(shell, painter) };
  for (const scene of Object.values(scenes)) shell.bottom.append(scene.pane);
  shell.mount();
  const own = [shell.root, shell.note];

  let stopped = false, frame = 0;
  let engaged = "off", scene = null, candidate = null, streak = 0;
  let fresh = true; // 起動・向きの切り替えの直後。最初に見つけた対応済みの場面は待たずに出す（現行の画面を一瞬見せない）
  let dirty = true, detectSoon = true, lastDetect = 0, lastSync = 0, unsupportedSince = 0;

  /** 回転案内（#rotate-hint）の出し入れを変えたら、core/rotate-guard.js に測り直させる。 */
  function setEngaged(next) {
    if (next === engaged) return;
    engaged = next;
    fresh = true;
    if (next === "on") root.dataset.retro = "on";
    else delete root.dataset.retro;
    window.dispatchEvent(new Event("resize"));
  }

  function setScene(next) {
    if (next === scene) return;
    if (scene) { scenes[scene].leave(); scenes[scene].pane.hidden = true; }
    scene = next;
    shell.root.dataset.scene = next || "";
    shell.root.hidden = !next;
    shell.maphead.hidden = shell.markers.hidden = next !== "map";
    if (next) {
      root.dataset.retroShell = "on";
      scenes[next].pane.hidden = false;
      scenes[next].enter();
      painter.invalidate();
      shell.layout();
      dirty = true;
    } else {
      delete root.dataset.retroShell;
      shell.setNotices([]);
      shell.setCaption("");
    }
  }

  /** periodic: 定期の確認（1 秒に 9 回ほど）。DOM の変化を受けた臨時の確認では、外枠を引っ込める判断だけを行う。 */
  function evaluate(now, periodic) {
    setEngaged(engageState());
    const found = engaged === "on" ? detectScene(own) : null;
    if (!found) {
      candidate = null; streak = 0;
      if (scene) setScene(null);
    } else if (found !== scene) {
      // 未対応からの復帰は、定期の確認で2回続けて同じ場面と判定してから（切り替えのちらつきを避ける）
      if (found !== candidate) { candidate = found; streak = 0; }
      if (periodic) streak++;
      if (scene || fresh || streak >= 2) { // scene: 対応済みの場面どうしの移り変わりは待たない
        setScene(found);
        candidate = null; streak = 0; fresh = false;
      }
    }
    // 外枠を出していない間の一言
    let note = "";
    if (engaged === "old") note = NOTE_OLD_LAYOUT;
    else if (engaged === "on" && !scene && isPortrait() && !isLoading()) {
      unsupportedSince ||= now;
      if (now - unsupportedSince >= NOTE_DELAY_MS) note = NOTE_UNSUPPORTED;
    }
    if (scene || engaged !== "on") unsupportedSince = 0;
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
      scenes[scene].sync();
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
    attributeFilter: ["class", "hidden", "style", "src", "disabled", "aria-disabled", "aria-pressed", "data-screen", "data-revealing", "data-game-layout", "data-layout", "data-slot", "data-health", "title"],
  });

  const onResize = () => { shell.layout(); detectSoon = true; dirty = true; };
  const onTopTap = () => { if (scene) scenes[scene].tapTop?.(); };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  shell.top.addEventListener("click", onTopTap);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
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
      const wasEngaged = engaged === "on";
      engaged = "off";
      delete root.dataset.retro;
      delete root.dataset.retroShell;
      if (wasEngaged) window.dispatchEvent(new Event("resize")); // 回転案内を現行どおりに戻す
    },
  };
}
