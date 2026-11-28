// 縦画面「煙の舞台」（C案）の様式（2026-11-27 オーナー「第1章を今日作った縦UIで作って」・要望台帳 VPN）。
// 試作 remake/previews/portrait-stage/ で詰めた縦の画面（上に絵・真ん中にテロップ・下に補助ボタンの段と大きなパッド）で、本編の第1章を遊ぶ。
// 作り: 本編の画面（#stage・1280×720）は動かしたまま見えなくし、その内容を縦の外枠へ写して、押す・選ぶは本編へ中継する
//（DS風の外枠 looks/neo/portrait-shell.js と同じ仕組み。場面の見分けは looks/neo/portrait-shell/detect.js を共用）。進行・判定・報酬・保存は本編のまま。
// 写す場面: タイトル・会話と返事・登場カットイン（縦のポスター）・地図・tonari の行動選びなどのボタンの画面・確かめの小窓・
//   MENU・LIME・設定・セーブ／ロード・LOG・店・章のクリア（シート）・場面転換や日付の札などの覆い・
//   シーシャ作りのうち縦の画面がある工程（作る場面。いまは水入れ・詰め方・穴あけ・炭焼き・蒸らし時間・VPN30・VPN31。vertical/craft.js の登録表）。
// 大会の会場会話・投票・幕間・表彰は本編の演出で進める。
// まだ縦にしていない場面（シーシャ作りのほかの工程・店番・ミニゲームなど。別の作業で縦の画面を作っている）は、回転案内を出して横で遊ぶ。
// 縦持ちの間だけ動く。横持ちにすると外枠を引っ込め、本編の今の画面（旧版）で遊べる。setActive(false) で足した物をすべて片付ける。
import { state } from "../core/state.js";
import { el } from "../core/util.js";
import { detectState, isLoading, topDialogOpen } from "./neo/portrait-shell/detect.js";
import { withMinigameStyles } from "../minigames/minigame-styles.js";
import { createFrame } from "./vertical/frame.js";
import { createTalkScene } from "./vertical/talk.js";
import { createMapScene } from "./vertical/map.js";
import { createMenuScene } from "./vertical/menu.js";
import { createTitleScene } from "./vertical/title.js";
import { createCoverScene } from "./vertical/cover.js";
import { createSheetScene } from "./vertical/sheet.js";
import { createBoardScene, boardOpen } from "./vertical/board.js";
import { createCraftScene, craftOpen } from "./vertical/craft.js";
import { livePortraitScene, setLivePortraitScene } from "./vertical/live-stage.js";
import { createMotionLayer } from "./vertical/motion-layer.js";

import { createTournamentResultScene } from "./vertical/tournament-result.js";

const PORTRAIT = "(orientation: portrait)";
const DETECT_MS = 110;      // 場面の確認は 1 秒に 9 回ほど
const SYNC_MS = 250;        // 変化の通知が無くても、この間隔で写し直す
const HOLD_MS = 600;        // 短い場面転換の間は回転案内を出さない
const GAP_MS = 3000;        // 場面と場面のあいだの何も出ていない間は、ここまで外枠のまま待つ
const STUCK_MS = 6000;      // 何も写せない覆いがタップを待ったままなら、回転案内へ切り替える
const COVER_MAX_MS = 20000; // 覆いの中身が変わらないまま続く上限
const HINT_MAIN = "この場面は横向きで遊びます";
const HINT_SUB = "この場面では端末を横向きにしてください";

let active = false, query = null, session = null;

/** 様式「縦画面」の出し入れ（looks/index.js から呼ばれる）。縦持ちの間だけ外枠を動かす。 */
export function setActive(on) {
  if (active === !!on) return;
  active = !!on;
  if (active) {
    if (typeof window.matchMedia !== "function") return;
    query = window.matchMedia(PORTRAIT);
    query.addEventListener?.("change", syncOrientation);
    syncOrientation();
    return;
  }
  query?.removeEventListener?.("change", syncOrientation);
  query = null;
  syncOrientation();
}

let loadToken = 0;
async function syncOrientation() {
  const want = active && !!query?.matches;
  if (!want) { loadToken++; session?.stop(); session = null; return; }
  if (session) return;
  const mine = ++loadToken;
  // 見た目の CSS は縦画面を使う時だけ読み込む（index.html の styles-look-vertical。ほかの端末には読ませない）
  try {
    await withMinigameStyles("look-vertical", null, () => {
      if (mine !== loadToken || !active || !query?.matches || session) return;
      session = start();
    });
  } catch (error) {
    console.error("[look] 縦画面の見た目を読み込めませんでした", error);
  }
}

function start() {
  const root = document.documentElement;
  root.dataset.vt = "on"; // 本編の会話の箱を縦のテロップと同じ比にする（css/look-vertical.css）
  root.dataset.vtHint = "hold"; // 最初の確認までは回転案内を出さない（出すかは evaluate() が決める）
  let scene = null, sceneName = "";
  const frame = createFrame({
    dir: (dir) => { scene?.dir?.(dir); wake(400); },
    a: () => { scene?.a?.(); wake(400); },
    chip: (id) => { scene?.chip?.(id); wake(400); },
    tapPicture: () => { scene?.tap?.(); wake(400); },
    tapTelop: () => { scene?.tap?.(); wake(400); },
  });
  // タイトルからのロードでは本編の煙そのものを縦の舞台に重ねる。時計も SE も本編が所有する。
  const resumeSmoke = el("div.vt-resume-smoke", { "aria-hidden": "true" });
  document.body.append(resumeSmoke);
  // 演出（モーショングラフィックス）の縦の舞台（VPO02）。場面の確認・中継・DOM の見張りでは、外枠と同じく自分の物として除く
  const motionLayer = createMotionLayer();
  const own = [frame.root, resumeSmoke, motionLayer.root];
  const scenes = {
    // CONTINUE は本編の文字・ボタン・アニメーションを直接表示する。
    continue: { native: true }, tournament: { native: true }, tournamentResult: createTournamentResultScene(),
    interlude: { native: true },
    title: createTitleScene(frame), vn: createTalkScene(frame), map: createMapScene(frame), menu: createMenuScene(frame),
    sheet: createSheetScene(frame), cover: createCoverScene(frame, own), board: createBoardScene(frame), craft: createCraftScene(frame),
  };
  frame.over.addEventListener("click", (event) => {
    if (sceneName === "cover" && !event.target.closest("button")) scenes.cover.overTap();
  });
  frame.mount();
  motionLayer.mount();
  // 回転案内の文を差し替える（元の文は CSS で隠すだけで、書き換えない）
  const hint = document.getElementById("rotate-hint");
  const hintText = hint ? el("div.vt-hint", { dataset: { test: "vt-hint" } }, [
    el("i.vt-hint-device", { "aria-hidden": "true" }), el("p.vt-hint-main", { text: HINT_MAIN }), el("p.vt-hint-sub", { text: HINT_SUB }),
  ]) : null;
  if (hintText) hint.append(hintText);
  window.__verticalLook = { scene: () => sceneName }; // 確認・検査用

  let stopped = false, frameId = 0, timer = 0;
  let dirty = true, detectSoon = true, lastDetect = 0, lastSync = 0;
  let candidate = null, streak = 0, fresh = true;
  let holdSince = 0, pressable = false, gap = false, noneSince = 0, hold = false, coverBlocked = false;

  function setScene(next) {
    if ((next || "") === sceneName) return;
    scene?.leave?.();
    frame.reset();
    sceneName = next || "";
    scene = next ? scenes[next] : null;
    frame.root.dataset.scene = sceneName;
    frame.root.dataset.layout = scene?.layout || ""; // "full": 下画面を出さない場面（試作どおりのタイトルなど）
    frame.root.hidden = !scene || !!scene.native;
    root.toggleAttribute("data-vt-continue", next === "continue");
    root.toggleAttribute("data-vt-tournament", next === "tournament");
    root.toggleAttribute("data-vt-result", next === "tournamentResult");
    root.toggleAttribute("data-vt-interlude", next === "interlude");
    if (next !== "cover") holdSince = 0; // 覆いを待つ時間は、覆いに入るたびに数え直す（前の転換から数えると、すぐ待ちすぎと判断してしまう）
    if (scene && !scene.native) {
      root.dataset.vtShell = "on";
      scene.enter();
      dirty = true;
    } else {
      delete root.dataset.vtShell;
      frame.setNotices([]);
    }
    window.dispatchEvent(new Event("resize")); // 回転案内の出し入れを rotate-guard に測り直させる
  }

  /** 定期の確認（1 秒に 9 回ほど）。DOM の変化を受けた臨時の確認では、外枠を引っ込める・つなぐ判断だけを行う。 */
  function evaluate(now, periodic) {
    const wipe = document.querySelector("#wipe.resume");
    if (wipe) resumeSmoke.append(...wipe.querySelectorAll(".wipe-smoke, .wipe-haze"));
    // 大会入場は全章で同じ縦ポスターを使う。日付や幕の札は第1章だけを全面に出す。
    const frontMotion = motionLayer.root.lastElementChild;
    const frontFx = document.getElementById("fx")?.lastElementChild;
    const entrance = !frontMotion && frontFx?.matches(".entrance");
    const chapterOneCard = state?.chapter === 1 && (frontMotion ? frontMotion.matches(".day-card, .tr-dawn") :
      frontFx?.matches('.beat, .round-cut, .day-card, .tr-dawn, .chapter-poem[data-poem="poem_ch1"]'));
    const interlude = (entrance || chapterOneCard) && !isLoading() && !topDialogOpen() && !document.querySelector("#modal.show");
    let found = interlude ? { kind: "scene", name: "interlude" } : boardOpen() ? { kind: "scene", name: "board" } : detectState(wipe ? [...own, wipe] : own);
    // 作業台に重なった大会中継・投票は、前面の大会用レイアウトで操作する。
    const tournament = found.name === "tournament" || found.name === "tournamentResult";
    const live = !interlude && !tournament && livePortraitScene();
    if (live) {
      root.dataset.vtHint = "hold";
      setScene(null);
      setLivePortraitScene(live);
      candidate = null; streak = 0; noneSince = 0; fresh = true;
      return;
    }
    setLivePortraitScene("");
    if (found.variant === "end" && document.querySelector('#screen > .gameover[data-layout="manga"]:not(.done)')) {
      found = { kind: "scene", name: "continue" };
    }
    // シーシャ作り: 作業台の今の工程に縦の画面があれば、作る場面として写す（会話・写せる小窓が上に出ている間と、画面の一番上の小窓の間は除く）
    if (found.kind !== "scene" && !topDialogOpen() && craftOpen()) found = { kind: "scene", name: "craft" };
    // 地図のピンが現れる演出・地図の上のスロットの間も、地図のまま写す
    if (found.kind === "none" && document.querySelector("#screen > .map:not(.done) .map-pins > .spot-pin") && !document.getElementById("modal")?.classList.contains("show")
      && !document.querySelector("#fx > :is(.gboard, .reel-intro, .kuji-overlay)")) found = { kind: "scene", name: "map" };
    const dialogOpen = found.kind === "none" && topDialogOpen();
    if (found.kind !== "none") noneSince = 0;
    if (found.kind === "scene" || found.kind === "none") coverBlocked = false;
    hold = false;
    // 縦の舞台で演出（モーショングラフィックス）が出ている間は、外枠を引っ込めない（回転案内を演出の上に出さない・VPO02）。
    // 演出の下が場面の切り替えの途中でも待ちすぎと判断しないよう、待つ時間は演出が終わってから数え直す
    const motionOn = motionLayer.root.childElementCount > 0;
    if (motionOn) { noneSince = 0; if (holdSince) holdSince = now; coverBlocked = false; }
    if (scene) {
      if (found.kind === "scene") setScene(found.name);
      else if (found.kind === "cover" || found.kind === "gap") {
        if (!holdSince || gap !== (found.kind === "gap")) holdSince = now;
        gap = found.kind === "gap";
        pressable = !!found.pressable;
        const cover = scenes.cover;
        const since = now - Math.max(holdSince, sceneName === "cover" ? cover.activeAt() : 0);
        const limit = gap ? GAP_MS : pressable && !(sceneName === "cover" && cover.hasContent()) ? STUCK_MS : COVER_MAX_MS;
        if (since > limit) coverBlocked = true;
        setScene(since > limit ? null : "cover");
      } else if (dialogOpen) setScene(null);
      else {
        // 未対応の場面でも、すぐには引っ込めない。短い間は外枠のまま（暗くして）待ち、続いたら回転案内へ
        noneSince ||= now;
        hold = now - noneSince < HOLD_MS;
        setScene(hold ? "cover" : null);
      }
      candidate = null; streak = 0;
    } else if (found.kind === "scene") {
      // 未対応からの復帰は、定期の確認で2回続けて同じ場面と判定してから（切り替えのちらつきを避ける）
      if (found.name !== candidate) { candidate = found.name; streak = 0; }
      if (periodic) streak++;
      if (interlude || fresh || streak >= 2) { setScene(found.name); candidate = null; streak = 0; fresh = false; }
    } else if (!coverBlocked && (found.kind === "gap" || (found.kind === "cover" && found.base))) {
      if (found.kind !== candidate) { candidate = found.kind; streak = 0; }
      if (periodic) streak++;
      if (streak >= 2) {
        holdSince = now; gap = found.kind === "gap"; pressable = !!found.pressable;
        setScene("cover");
        candidate = null; streak = 0;
      }
    } else if (motionOn) {
      // 回転案内の場面で演出が始まった（または演出の下が写せない場面）: 演出の間だけ外枠の覆いで待つ
      hold = true;
      setScene("cover");
      candidate = null; streak = 0;
    } else { candidate = null; streak = 0; }
    // 外枠を出している間と、読み込みの画面（縦持ち用の配置を持つ）の間は回転案内を隠す
    const holdHint = !!scene || isLoading() || dialogOpen;
    if ((root.dataset.vtHint === "hold") !== holdHint) {
      if (holdHint) root.dataset.vtHint = "hold"; else delete root.dataset.vtHint;
      window.dispatchEvent(new Event("resize"));
    }
  }

  /** 本編のトースト・報酬の札を、上の知らせとして写す。 */
  function syncNotices() {
    const lines = [];
    for (const toast of document.querySelectorAll("#toasts > .toast")) lines.push(toast.textContent.trim());
    for (const card of document.querySelectorAll("#banners > .gain-card:not(.out)")) {
      const part = (selector) => card.querySelector(selector)?.textContent.trim() || "";
      lines.push([part(".gc-main"), part(".gc-points"), part(".gc-sub")].filter(Boolean).join(" "));
    }
    for (const cut of document.querySelectorAll("#fx > .lvup:not(.out)")) if (cut.dataset.line) lines.push(cut.dataset.line);
    frame.setNotices(lines);
  }

  function runStep(now, fromTimer = false) {
    const periodic = fromTimer || now - lastDetect >= DETECT_MS;
    if (detectSoon || periodic) {
      detectSoon = false;
      if (periodic) lastDetect = now;
      evaluate(now, periodic);
    }
    if (!scene?.sync) return;
    if (dirty || now - lastSync >= SYNC_MS) {
      dirty = false;
      lastSync = now;
      scene.sync?.({ pressable, gap, hold });
      syncNotices();
    }
  }

  function schedule() {
    if (stopped || document.hidden || timer) return;
    timer = setTimeout(poll, scene ? Math.min(SYNC_MS, DETECT_MS) : DETECT_MS);
  }
  function poll() {
    timer = 0;
    if (stopped || document.hidden) return;
    runStep(performance.now(), true);
    schedule();
  }
  function wake() {
    if (stopped || document.hidden) return;
    if (frameId) return;
    frameId = requestAnimationFrame((now) => { frameId = 0; if (!stopped) { runStep(now, false); schedule(); } });
  }

  // 本編の DOM の変化を見張る。自分の外枠の中の変化は数えない。会話の文字送りだけの変化は、同じフレームのうちに写す
  const observer = new MutationObserver((records) => {
    let typed = false, other = false;
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target === motionLayer.root && record.type === "childList") { dirty = true; other = true; continue; }
      if (!target || own.some((mine) => mine.contains(target)) || hint?.contains(target)) continue;
      dirty = true;
      if (target.closest?.(".vn-text, .vn-inner")) typed = true;
      else other = true;
    }
    if (other) detectSoon = true;
    if (typed && scene?.sync && !stopped && !other) {
      dirty = false;
      lastSync = performance.now();
      scene.sync?.({ pressable, gap, hold });
      return;
    }
    if (dirty) wake();
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["class", "hidden", "style", "src", "disabled", "aria-disabled", "aria-pressed", "data-screen", "data-revealing", "data-slot", "data-health", "data-tab", "aria-selected", "aria-expanded", "aria-checked", "title", "data-rain", "open", "data-step"],
  });

  const onResize = () => { motionLayer.relayout(); scene?.relayout?.(); detectSoon = true; dirty = true; wake(); };
  const onVisibility = () => {
    if (stopped) return;
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; clearTimeout(timer); timer = 0; return; }
    detectSoon = true; dirty = true; wake();
  };
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  wake();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      setLivePortraitScene("");
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      setScene(null);
      frame.unmount();
      document.getElementById("wipe")?.append(...resumeSmoke.children);
      resumeSmoke.remove();
      motionLayer.unmount();
      hintText?.remove();
      delete window.__verticalLook;
      delete root.dataset.vt;
      delete root.dataset.vtShell;
      delete root.dataset.vtHint;
      window.dispatchEvent(new Event("resize")); // 回転案内と会話の箱を現行どおりに戻す
    },
  };
}
