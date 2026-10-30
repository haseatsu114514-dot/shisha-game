// 大会コンティニュー: スミさんがプレイヤーに直接語りかける。
// タイムラインと音声を分離し、後から録音音声・口パク素材に差し替えられる。
import { prepareContinueScript, normalizeContinueContext } from "./continue-context.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { choosePremiumContinue, PREMIUM_CONTINUE_SCRIPTS } from "./continue-premium.js";
import { createContinueAudio, preloadBgm } from "../core/audio.js";
import { DB, img, portraitInfo } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { createContinueView } from "./continue-view.js";


// at = 開始からの秒数。全体の台詞表示は約20秒。テロップは1キュー1行（全角22字以内）に小分けする。
// reactions の text も1行ずつの配列で、順に表示する。
// audio: 完成した合成音声を置く場合だけ ../assets/audio/voice/continue/... を指定。
// cues のタイミングは完成音声の実測に合わせて調整可能。
export const SUMI_CONTINUE_SCRIPTS = [
  {
    id: "together", title: "共同責任", duration: 20, audio: null,
    reactions: {
      retry: { text: ["よし。トング持て。一緒に戻るぞ！"], faces: ["surprise", "smile"], effect: "rally", word: "最後まで付き合うぞ！" },
      quit: { text: ["……おう。今日はここまでだ。お疲れ"], faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ" },
    },
    cues: [
      {"at": 0, "face": "serious", "text": "……届かなかったか"},
      {"at": 1.8, "face": "serious", "text": "なら、次は一つだけ変えてみよう"},
      {"at": 4.2, "face": "surprise", "text": "ちょっと待て！ 俺もまだ帰らねえぞ！"},
      {"at": 7.0, "face": "serious", "text": "お前だけの負けにすんな"},
      {"at": 10.3, "face": "normal", "text": "俺は、お前と勝ちてえんだよ"},
      {"at": 13.6, "face": "normal", "text": "トングはまだ、ここにある"},
      {"at": 16.5, "face": "normal", "text": "……どうする、はじめ？"},
    ],
  },
  {
    id: "disaster", title: "世界の終わり", duration: 20, audio: null,
    reactions: {
      retry: { text: ["よし、カルダモン絶滅回避だ！"], faces: ["surprise", "smile"], effect: "rally", word: "カルダモン絶滅回避！" },
      quit: { text: ["……新聞は休刊だ。よくやったな"], faces: ["surprise", "normal"], effect: "farewell", word: "よく頑張ったな" },
    },
    cues: [
      {"at": 0, "face": "serious", "text": "……届かなかったか"},
      {"at": 1.8, "face": "serious", "text": "なら、次は一つだけ変えてみよう"},
      {"at": 4.2, "face": "surprise", "text": "このままじゃ、カルダモンが絶滅だ！"},
      {"at": 7.0, "face": "normal", "text": "……するわけねえだろ"},
      {"at": 10.3, "face": "normal", "text": "だが、悔しいのは本当だ"},
      {"at": 13.6, "face": "normal", "text": "次の一台も、俺に見せてくれ"},
      {"at": 16.5, "face": "normal", "text": "……もう一度、やるか？"},
    ],
  },
  {
    id: "meeting", title: "反対多数", duration: 20, audio: null,
    reactions: {
      retry: { text: ["可決ッ！ では、俺たちの大会へ！"], faces: ["surprise", "smile"], effect: "vote", word: "全会一致ッ！！" },
      quit: { text: ["……本日は閉会。お疲れ、はじめ"], faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ、はじめ" },
    },
    cues: [
      {"at": 0, "face": "serious", "text": "……届かなかったか"},
      {"at": 1.8, "face": "serious", "text": "なら、次は一つだけ変えてみよう"},
      {"at": 4.2, "face": "surprise", "text": "では、緊急会議を始める！"},
      {"at": 7.0, "face": "serious", "text": "議題は『俺たちは、まだやれるか』"},
      {"at": 10.3, "face": "normal", "text": "俺は賛成だ。お前はどうだ？"},
      {"at": 13.6, "face": "normal", "text": "勝手に一人で、終わらせんな"},
      {"at": 16.5, "face": "normal", "text": "……返事、聞かせろ"},
    ],
  },
];

/** 大会中に準備。抽選やセーブを動かさず、登場し得る相手の全表情とUIをデコードする。 */
export function warmGameOver() {
  const scripts = [...SUMI_CONTINUE_SCRIPTS,
    ...(state?.lovers || []).map(id => PREMIUM_CONTINUE_SCRIPTS[id]).filter(Boolean)];
  const urls = new Set((DB.manifest.continueUI || []).map(file => img(`ui/continue/${file}`)));
  for (const script of scripts) {
    const faces = [...script.cues.map(cue => cue.face),
      ...Object.values(script.reactions).flatMap(reaction => reaction.faces)];
    for (const face of faces) {
      const url = portraitInfo(script.speaker || "sumi", face)?.src;
      if (url) urls.add(url);
    }
  }
  return Promise.all([preloadBgm("bgm_continue_urgent"), ...[...urls].map(url => imageReady(url, 15000))]);
}

// 試作と同じ26文字/秒。短いキューは既存の枠内で全文を出し、反応の保持時間は変えない。
const typeTime = (text, slot) => Math.max(.01, Math.min([...text].length / 26, slot * .6));
const lineTime = text => Math.max(1.1, [...text].length * .07 + .55);
const DECISION_SECONDS = 20;

let nextScript = 0;
let previousContinueSpeaker = null;
// 初回はカウント演出だけを見せ、選択期限を設けない。再挑戦以降は20秒で終了する。
export function buildGameOver({ reason = "rank", rank = 0, variant = null, onRetry, onTitle,
  soundEffects = true, reducedMotion = false, layout = "neon", background = "stage", context = null } = {}) {
  const standard = SUMI_CONTINUE_SCRIPTS[Number.isInteger(variant) && variant >= 0
    ? variant % SUMI_CONTINUE_SCRIPTS.length : nextScript++ % SUMI_CONTINUE_SCRIPTS.length];
  const forced = typeof variant === "string" && variant.startsWith("premium:")
    ? PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)] : null;
  const baseScript = forced || (variant == null
    ? choosePremiumContinue(state?.lovers || [], state?.chapter || 1, Math.random, previousContinueSpeaker) : null) || standard;
  const detail = normalizeContinueContext(context || { reason, rank });
  const script = prepareContinueScript(baseScript, detail);
  const repeated = detail.lossOrdinal >= 2;
  const timed = repeated;
  const speaker = script.speaker || "sumi";
  if (variant == null) previousContinueSpeaker = speaker;
  const audio = createContinueAudio({ enabled: soundEffects });
  let active = true, started = false;
  let pauseReasons = new Set(["not-connected"]);
  const view = createContinueView({ script, speaker, character: script.name || "スミさん",
    premium: speaker !== "sumi", layout, background,
    onType: () => { if (active && started && !pauseReasons.size) audio.voice(speaker); } });
  const { root } = view;
  const owner = state;
  root.continueVariant = speaker === "sumi" ? SUMI_CONTINUE_SCRIPTS.indexOf(baseScript) : `premium:${speaker}`;
  root.dataset.reason = detail.reason;
  root.dataset.lossOrdinal = String(detail.lossOrdinal);
  root.dataset.timeLimit = timed ? "20" : "none";
  root.dataset.skipEntry = String(detail.lossOrdinal >= 3);
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reduce = reducedMotion || !!motion?.matches;
  let start = 0, speechStart = 0, cueIndex = -1, ticker = 0, entry = 0, frame = 0, deadline = 0;
  let currentInstant = false, pausedAt = null, reactionAt = null, choice = null, secondFace = false, exit = 0;
  let boundary = 0, leavingAt = null, connectedOnce = false;
  let reactionLine = -1, reactionLineAt = 0, reactionInstant = false;
  const counted = new Set();
  const observer = new MutationObserver(availabilityChanged);
  const layoutObserver = new MutationObserver(availabilityChanged);
  const offOwner = on("hud", () => { if (state !== owner) cleanup(); });
  const visible = node => !!node && getComputedStyle(node).display !== "none"
    && getComputedStyle(node).visibility !== "hidden" && node.getClientRects().length > 0;
  function available() {
    if (!active) return false;
    if (state !== owner || (connectedOnce && !root.isConnected)) { cleanup(); return false; }
    connectedOnce ||= root.isConnected;
    pauseReasons = new Set();
    if (!root.isConnected) pauseReasons.add("not-connected");
    if (document.hidden) pauseReasons.add("hidden");
    if (visible(document.getElementById("rotate-hint"))) pauseReasons.add("rotation");
    if (visible(document.getElementById("modal"))) pauseReasons.add("menu");
    const paused = String(pauseReasons.size > 0);
    if (root.dataset.paused !== paused) root.dataset.paused = paused;
    if (pauseReasons.size) {
      if (started && pausedAt == null) {
        pausedAt = performance.now();
        clearTimeout(deadline); clearTimeout(boundary); clearTimeout(exit); clearTimeout(entry);
        audio.pause();
      }
      return false;
    }
    if (started && pausedAt != null) {
      const gap = performance.now() - pausedAt;
      start += gap; speechStart += gap;
      if (reactionAt != null) { reactionAt += gap; reactionLineAt += gap; }
      if (leavingAt != null) leavingAt += gap;
      pausedAt = null;
      audio.resume();
      armDeadline();
      armExit();
    }
    return true;
  }
  function availabilityChanged() {
    if (!started) begin();
    else if (available()) tick();
  }
  function setMotion() {
    reduce = reducedMotion || !!motion?.matches;
    root.dataset.reducedMotion = String(reduce);
    if (reduce) view.reveal();
  }
  setMotion();
  motion?.addEventListener?.("change", setMotion);

  // 字幕だけをフレームごとに更新。台本・残り時間・反応の保持時間は既存の時計を使う。
  function revealCaption(elapsed = (performance.now() - speechStart) / 1000) {
    if (!active || !started || pauseReasons.size || choice === "timeout") return;
    if (choice) {
      const text = script.reactions[choice].text[reactionLine];
      const seconds = (performance.now() - reactionLineAt) / 1000;
      view.reveal(reactionInstant || reduce ? 1 : Math.min(1, seconds / typeTime(text, lineTime(text))));
    } else if (cueIndex >= 0) {
      const cue = script.cues[cueIndex];
      const slot = (script.cues[cueIndex + 1]?.at ?? script.duration) - cue.at;
      view.reveal(currentInstant || reduce || elapsed >= script.duration ? 1
        : Math.min(1, Math.max(0, elapsed - cue.at) / typeTime(cue.text, slot)));
    }
  }
  function animateCaption() {
    if (!active || !root.isConnected) return;
    available();
    if (!active) return;
    revealCaption();
    frame = requestAnimationFrame(animateCaption);
  }

  function sync(at, sound = true, countAt = at) {
    const elapsed = Math.min(script.duration, Math.max(0, at));
    const index = Math.max(0, script.cues.findLastIndex(c => c.at <= elapsed));
    const cue = script.cues[index];
    if (index !== cueIndex) {
      // 表情が変わる区切りだけ人物を弾ませ、低い拍を鳴らす。小分けの行送りでは鳴らさない。
      const turn = index === 0 || cue.face !== script.cues[cueIndex]?.face;
      cueIndex = index;
      currentInstant = false;
      root.dataset.cue = String(index);
      root.dataset.lastCue = String(index === script.cues.length - 1);
      view.setCaption(cue.text, cue.emphasis);
      view.announce(cue.text);
      view.face(cue.face, turn && !reduce && !(detail.lossOrdinal >= 3 && index === 0));
      if (sound && index > 0 && turn) audio.beat();
    }
    if (elapsed >= 10.3 && root.dataset.quiet !== "true") {
      root.dataset.quiet = "true";
      audio.quiet();
    }
    revealCaption(elapsed);
    const remaining = Math.max(0, Math.ceil(DECISION_SECONDS - countAt));
    view.setCount(!timed && remaining === 0 ? "∞" : remaining, countAt / DECISION_SECONDS);
    root.classList.toggle("go-urgent", timed && remaining > 0 && remaining <= 5);
    root.classList.toggle("go-done", timed && remaining === 0);
    soundCount(remaining); // 字幕送りのsound=falseでも、期限時計の境界は同じ。
    view.next.disabled = view.dialogue.disabled = index === script.cues.length - 1 && view.isRevealed();
    if (timed && remaining === 0) expire();
  }
  function soundCount(remaining) {
    if (counted.has(remaining)) return;
    counted.add(remaining);
    if (!timed && remaining === 0) view.announceTime("初回は時間制限がありません。いつでも選べます。");
    else if (remaining === 5 && timed) view.announceTime("残り5秒です");
    if (remaining > 5) audio.tick();
    else if (timed) audio.count(remaining);
  }
  function armBoundary() {
    clearTimeout(boundary);
    if (!active || !started || choice || pauseReasons.size) return;
    const elapsed = performance.now() - start;
    const next = (Math.floor(elapsed / 1000) + 1) * 1000;
    boundary = window.setTimeout(() => { tick(); armBoundary(); }, Math.max(1, next - elapsed));
  }
  function armDeadline() {
    clearTimeout(deadline);
    if (active && started && !choice && !pauseReasons.size) {
      if (timed) deadline = window.setTimeout(expire, Math.max(0, DECISION_SECONDS * 1000 - (performance.now() - start)));
      armBoundary();
    }
  }
  function expire() {
    if (!timed || !available() || !started || choice) return;
    if (performance.now() - start < DECISION_SECONDS * 1000) return armDeadline();
    choice = "timeout";
    clearTimeout(entry); clearTimeout(deadline); clearTimeout(boundary); clearInterval(ticker);
    root.dataset.phase = "gameover";
    root.dataset.timedOut = "true";
    root.classList.remove("go-urgent");
    root.classList.add("go-done");
    view.setCount(0, 1);
    view.gameOver();
    soundCount(0);
    audio.expire();
    reactionAt = performance.now();
    ticker = window.setInterval(tick, 50);
  }
  function cleanup() {
    if (!active) return;
    active = false;
    clearInterval(ticker); clearTimeout(entry); clearTimeout(deadline); clearTimeout(boundary); clearTimeout(exit); cancelAnimationFrame(frame);
    observer.disconnect();
    layoutObserver.disconnect();
    offOwner();
    document.removeEventListener("visibilitychange", availabilityChanged);
    for (const event of ["resize", "orientationchange", "display-layout-change"]) window.removeEventListener(event, availabilityChanged);
    window.removeEventListener("pagehide", cleanup);
    root.removeEventListener("keydown", keyboardDown, true);
    root.removeEventListener("keyup", keyboardUp, true);
    motion?.removeEventListener?.("change", setMotion);
    audio.cleanup();
  }
  function finish() {
    if (!available() || !choice || root.dataset.phase === "leaving") return;
    root.dataset.phase = "leaving";
    view.proceed.disabled = true;
    clearInterval(ticker); ticker = 0;
    // 一度だけ明るく抜ける／静かに暗転。軽減モードはフェードのみ。
    root.classList.add("go-leaving");
    audio.cleanup();
    leavingAt = performance.now();
    armExit();
  }
  function armExit() {
    clearTimeout(exit);
    if (!active || leavingAt == null || pauseReasons.size) return;
    exit = window.setTimeout(() => {
      if (!available()) return;
      const callback = choice === "retry" ? onRetry : onTitle;
      cleanup();
      callback?.();
    }, Math.max(0, 240 - (performance.now() - leavingAt)));
  }
  function tick() {
    if (!available() || !started || leavingAt != null) return;
    if (choice) {
      const elapsed = performance.now() - reactionAt;
      if (choice === "timeout") {
        if (elapsed >= 1600) finish();
        return;
      }
      // 選択した枠を180ms残してから、同じ下段領域を反応送りへ渡す。
      if (elapsed >= 180) view.showProceed();
      view.proceed.setAttribute("aria-disabled", String(elapsed < 450));
      const reaction = script.reactions[choice];
      if (!secondFace && elapsed >= 480) {
        secondFace = true;
        view.face(reaction.faces.at(-1), false);
      }
      const lines = reaction.text;
      const lineElapsed = (performance.now() - reactionLineAt) / 1000;
      const hold = Math.min(repeated ? 1.4 : 2.2, Math.max(.55 + [...lines[reactionLine]].length / 26, 1.1));
      revealCaption();
      if (lineElapsed >= hold) {
        if (reactionLine < lines.length - 1) showReactionLine(reactionLine + 1);
        else finish();
      }
    } else sync((performance.now() - speechStart) / 1000, true, (performance.now() - start) / 1000);
  }
  function showReactionLine(index) {
    reactionLine = index;
    reactionLineAt = performance.now();
    reactionInstant = false;
    const data = script.reactions[choice];
    view.setCaption(data.text[index], data.word);
    view.reveal(reduce ? 1 : 0);
  }
  function decide(value) {
    if (!available() || choice) return;
    if (!started) begin();
    if (!started) return;
    if (timed && performance.now() - start >= DECISION_SECONDS * 1000) return expire();
    choice = value; // どちらのボタンも、この時点で分岐を確定して二重発火を止める。
    clearTimeout(entry); clearTimeout(deadline); clearTimeout(boundary); clearInterval(ticker);
    root.dataset.phase = "reaction";
    root.classList.remove("go-urgent", "go-done");
    view.reaction(script.reactions[value], value);
    view.proceed.textContent = value === "retry" ? "大会へ進む" : "タイトルへ";
    view.proceed.setAttribute("aria-disabled", "true");
    view.announce(script.reactions[value].text.join(""));
    reactionAt = performance.now();
    showReactionLine(0);
    audio.choose(value, script.reactions[value].effect);
    ticker = window.setInterval(tick, 50);
  }
  function begin() {
    if (started) return;
    cancelAnimationFrame(frame);
    if (!available()) {
      // CSS media queries can change the actual hint without a DOM mutation.
      // Keep checking an attached, initially blocked screen until it can start.
      if (active && root.isConnected) frame = requestAnimationFrame(begin);
      return;
    }
    started = true;
    start = speechStart = performance.now();
    view.retry.focus({ preventScroll: true });
    observer.disconnect();
    observer.observe(root.parentNode, { childList: true });
    audio.start();
    view.announceTime(timed ? "20秒以内に選択。時間切れでタイトルへ戻ります。" : "初回は時間制限がありません。カウント後も選べます。");
    sync(0, false);
    entry = window.setTimeout(() => { if (available() && !choice) audio.title(); }, 400);
    ticker = window.setInterval(tick, 70);
    armDeadline();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(animateCaption);
  }
  view.retry.addEventListener("click", () => decide("retry"));
  view.quit.addEventListener("click", () => decide("quit"));
  // ネイティブbuttonのEnter/Space確定は残し、前画面からの長押しと
  // retry→反応送りへfocusが移った後の同じ押下だけを止める。
  let spaceTarget = null;
  function blockKey(event) { event.preventDefault(); event.stopPropagation(); }
  function keyboardDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      if (event.repeat || !available()) { blockKey(event); return; }
      if (event.key === " ") spaceTarget = event.target;
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight")
      && !choice && available() && [view.retry, view.quit].includes(event.target)) {
      blockKey(event);
      (event.key === "ArrowLeft" ? view.retry : view.quit).focus({ preventScroll: true });
    }
  }
  function keyboardUp(event) {
    if (event.key !== " ") return;
    // Spaceはkeyupでclickになる。前画面で押し始めたSpaceの解放も確定にしない。
    if (event.target !== spaceTarget || !available()) blockKey(event);
    spaceTarget = null;
  }
  root.addEventListener("keydown", keyboardDown, true);
  root.addEventListener("keyup", keyboardUp, true);
  function advanceSpeech() {
    if (!available() || choice) return;
    if (!started) begin();
    if (!started) return;
    if (timed && performance.now() - start >= DECISION_SECONDS * 1000) return expire();
    if (!view.isRevealed()) { currentInstant = true; view.reveal(); return; }
    const elapsed = (performance.now() - speechStart) / 1000;
    const at = script.cues.find(c => c.at > elapsed + .05)?.at ?? script.duration;
    speechStart = performance.now() - at * 1000;
    sync(at, false, (performance.now() - start) / 1000);
  }
  view.next.addEventListener("click", advanceSpeech);
  view.dialogue.addEventListener("click", advanceSpeech);
  view.proceed.addEventListener("click", () => {
    // 押した瞬間の連打で反応字幕を消さない。追加タップで1行ずつ送り、最後の行で抜ける。
    if (!available() || !choice || choice === "timeout" || performance.now() - reactionLineAt < 450) return;
    const lines = script.reactions[choice].text;
    if (!view.isRevealed()) { reactionInstant = true; view.reveal(); }
    else if (reactionLine < lines.length - 1) showReactionLine(reactionLine + 1);
    else finish();
  });
  view.setCaption(script.cues[0].text);
  view.reveal(reduce ? 1 : 0);
  // 幕の終わりまでshowScreenが挿入を待つ場合にも、実際に表示されてから20秒。
  // 接続を待つ間だけ広く観測し、開始後は親だけに切り替える。画面離脱で両方を破棄する。
  observer.observe(document.body, { childList: true, subtree: true });
  // CSSの縦横条件を複製せず、実際の案内/MENUと表示レイアウトを読む。
  for (const node of [document.documentElement, document.body, document.getElementById("viewport"),
    document.getElementById("stage"), document.getElementById("rotate-hint"), document.getElementById("modal")]) {
    if (node) layoutObserver.observe(node, { attributes: true, attributeFilter: ["class", "style", "hidden", "data-game-layout"],
      childList: node.id === "modal" || node === document.body });
  }
  document.addEventListener("visibilitychange", availabilityChanged);
  for (const event of ["resize", "orientationchange", "display-layout-change"]) window.addEventListener(event, availabilityChanged);
  window.addEventListener("pagehide", cleanup);
  frame = requestAnimationFrame(begin);
  root.cleanupContinue = cleanup;
  root.setContinueSoundEffects = audio.setEnabled;
  return root;
}
