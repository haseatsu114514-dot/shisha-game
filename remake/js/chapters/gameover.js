// 大会コンティニュー: スミさんがプレイヤーに直接語りかける。
// タイムラインと音声を分離し、後から録音音声・口パク素材に差し替えられる。
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { choosePremiumContinue, PREMIUM_CONTINUE_SCRIPTS } from "./continue-premium.js";
import { createContinueAudio, preloadBgm } from "../core/audio.js";
import { DB, img, portraitInfo } from "../core/data.js";
import { imageReady } from "../core/ui.js";
import { createContinueView } from "./continue-view.js";

export const GAME_OVER_TEXT = {
  burnt: { title: "シーシャが焦げてしまった", sub: "まだ、ここで終わる必要はない。" },
  cold: { title: "シーシャが冷え切ってしまった", sub: "仕切り直せば、もう一度勝負できる。" },
  leaf: { title: "フレーバーがダメになってしまった", sub: "次の一台で、俺たちの答えを出そう。" },
  rank: { title: "", sub: "この結果で、俺たちの挑戦を終わらせるのか？" },
};

// at = 開始からの秒数。全体の台詞表示は約20秒。テロップは1キュー1行（全角22字以内）に小分けする。
// reactions の text も1行ずつの配列で、順に表示する。
// audio: 完成した合成音声を置く場合だけ ../assets/audio/voice/continue/... を指定。
// cues のタイミングは完成音声の実測に合わせて調整可能。
export const SUMI_CONTINUE_SCRIPTS = [
  {
    id: "together", title: "共同責任", duration: 20, audio: null,
    reactions: {
      retry: { text: ["……そうこなくっちゃな！", "ほら、トング持て。", "俺も最後まで付き合うぞ！"], faces: ["surprise", "smile"], effect: "rally", word: "最後まで付き合うぞ！" },
      quit: { text: ["……わかった。今日はここまでだ。", "悔しさは捨てんなよ。", "……お疲れ。"], faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ" },
    },
    cues: [
      { at: 0, face: "surprise", text: "おいおいおいおい！ ちょっと待て！" },
      { at: 1.6, face: "surprise", text: "お前いま諦めようとしたな！？" },
      { at: 3, face: "surprise", text: "なあ！？" },
      { at: 3.8, face: "serious", text: "まだ終わってねえだろ！" },
      { at: 5, face: "serious", text: "俺も終わらせた覚えはねえぞ！" },
      { at: 6.4, face: "serious", text: "大会の途中で勝手に帰るな！" },
      { at: 7.8, face: "serious", text: "お前がここで降りたらな" },
      { at: 9, face: "serious", text: "お前だけじゃねえ！ 俺も！ tonariも！" },
      { at: 10.7, face: "serious", text: "俺たち全員まとめて負けなんだよ！" },
      { at: 12.2, face: "surprise", text: "俺はまだ負けたくねえ！" },
      { at: 13.4, face: "surprise", text: "お前と勝ちてえんだよ！" },
      { at: 14.6, face: "surprise", text: "だから勝手に幕を下ろすんじゃねえ！" },
      { at: 16.2, face: "normal", text: "……で、どうする？" },
      { at: 17.3, face: "normal", text: "俺はまだ、トングを置いてねえぞ。" },
    ],
  },
  {
    id: "disaster", title: "世界の終わり", duration: 20, audio: null,
    reactions: {
      retry: { text: ["よおおし！ カルダモン絶滅回避！", "行くぞ、俺たちの続きだ！"], faces: ["surprise", "smile"], effect: "rally", word: "カルダモン絶滅回避！" },
      quit: { text: ["……おう。新聞の一面は白紙にしとく。", "……よく頑張ったな。"], faces: ["surprise", "normal"], effect: "farewell", word: "よく頑張ったな" },
    },
    cues: [
      { at: 0, face: "surprise", text: "待て待て待て待て！！" },
      { at: 1.1, face: "surprise", text: "お前！ その『諦める』が" },
      { at: 2.4, face: "surprise", text: "何を意味するか分かってんのか！？" },
      { at: 3.8, face: "serious", text: "俺たちの夢が終わる！ 店の看板が泣く！" },
      { at: 5.4, face: "serious", text: "炭が冷める！ カルダモンが絶滅する！！" },
      { at: 7, face: "surprise", text: "明日の新聞の一面は決まりだ！" },
      { at: 8.4, face: "surprise", text: "『若き職人、まさかの自主撤退！』" },
      { at: 9.9, face: "surprise", text: "『師匠、号泣！』だぞ！！" },
      { at: 11.1, face: "serious", text: "ふざけるな！" },
      { at: 12.1, face: "serious", text: "俺はまだ泣く準備なんかしてねえ！" },
      { at: 13.5, face: "serious", text: "勝てるかどうかは知らん！" },
      { at: 14.8, face: "serious", text: "だが俺たちはまだやれる！" },
      { at: 16, face: "normal", text: "ほら、戻るぞ。大会に。" },
      { at: 17.2, face: "normal", text: "……カルダモンは絶滅しねえけどな。" },
    ],
  },
  {
    id: "meeting", title: "反対多数", duration: 20, audio: null,
    reactions: {
      retry: { text: ["可決ッ！！ 全会一致ッ！！", "では直ちに、大会へ復帰だ！！"], faces: ["surprise", "smile"], effect: "vote", word: "全会一致ッ！！" },
      quit: { text: ["……反対一票、撤回。今日は閉会だ。", "お疲れ、はじめ。"], faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ、はじめ" },
    },
    cues: [
      { at: 0, face: "surprise", text: "おい！ ちょっと待て！" },
      { at: 1.2, face: "surprise", text: "なんで一人で諦めようとしてんだ！？" },
      { at: 2.7, face: "surprise", text: "そんな議題聞いてねえぞ！" },
      { at: 4, face: "serious", text: "お前が大会に出た！ 俺が教えた！" },
      { at: 5.5, face: "serious", text: "ならこれは二人の戦いだろ！" },
      { at: 6.8, face: "serious", text: "勝手に一人で議決すんな！" },
      { at: 8.1, face: "surprise", text: "お前が諦めるということは" },
      { at: 9.3, face: "surprise", text: "俺も諦めたことになる！" },
      { at: 10.5, face: "surprise", text: "俺は反対だ！ 断固反対！！" },
      { at: 11.8, face: "serious", text: "敗北届は受理しねえ！ 印鑑も押さねえ！" },
      { at: 13.5, face: "serious", text: "そもそもそんな書類" },
      { at: 14.6, face: "serious", text: "この店には存在しねえ！！" },
      { at: 15.8, face: "normal", text: "全会一致じゃねえ。よって廃案だ。" },
      { at: 17.3, face: "normal", text: "……さ、俺たちの大会に戻ろうぜ。" },
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
// 選択は20秒まで。字幕送りはカウントを早めず、期限後はGAME OVERからタイトルへ戻る。
export function buildGameOver({ reason = "rank", rank = 0, variant = null, onRetry, onTitle,
  soundEffects = true, reducedMotion = false, layout = "neon", background = "stage" } = {}) {
  const standard = SUMI_CONTINUE_SCRIPTS[Number.isInteger(variant) && variant >= 0
    ? variant % SUMI_CONTINUE_SCRIPTS.length : nextScript++ % SUMI_CONTINUE_SCRIPTS.length];
  const forced = typeof variant === "string" && variant.startsWith("premium:")
    ? PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)] : null;
  const script = forced || (variant == null
    ? choosePremiumContinue(state?.lovers || [], state?.chapter || 1, Math.random, previousContinueSpeaker) : null) || standard;
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
  root.dataset.reason = reason;
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
      view.face(cue.face, turn && !reduce);
      if (sound && index > 0 && turn) audio.beat();
    }
    revealCaption(elapsed);
    const remaining = Math.max(0, Math.ceil(DECISION_SECONDS - countAt));
    view.setCount(remaining, countAt / DECISION_SECONDS);
    root.classList.toggle("go-urgent", remaining > 0 && remaining <= 5);
    root.classList.toggle("go-done", remaining === 0);
    soundCount(remaining); // 字幕送りのsound=falseでも、期限時計の境界は同じ。
    view.next.disabled = view.dialogue.disabled = index === script.cues.length - 1 && view.isRevealed();
    if (remaining === 0) expire();
  }
  function soundCount(remaining) {
    if (counted.has(remaining)) return;
    counted.add(remaining);
    if (remaining > 5) audio.tick();
    else audio.count(remaining);
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
      deadline = window.setTimeout(expire, Math.max(0, DECISION_SECONDS * 1000 - (performance.now() - start)));
      armBoundary();
    }
  }
  function expire() {
    if (!available() || !started || choice) return;
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
      const reaction = script.reactions[choice];
      if (!secondFace && elapsed >= 480) {
        secondFace = true;
        view.face(reaction.faces.at(-1), false);
      }
      const lines = reaction.text;
      const lineElapsed = (performance.now() - reactionLineAt) / 1000;
      const hold = lineTime(lines[reactionLine]);
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
    if (performance.now() - start >= DECISION_SECONDS * 1000) return expire();
    choice = value; // どちらのボタンも、この時点で分岐を確定して二重発火を止める。
    clearTimeout(entry); clearTimeout(deadline); clearTimeout(boundary); clearInterval(ticker);
    root.dataset.phase = "reaction";
    root.classList.remove("go-urgent", "go-done");
    view.reaction(script.reactions[value], value);
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
    if (performance.now() - start >= DECISION_SECONDS * 1000) return expire();
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
