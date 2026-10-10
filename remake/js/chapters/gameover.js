// 大会コンティニュー: スミさんがプレイヤーに直接語りかける。
// タイムラインと音声を分離し、後から録音音声・口パク素材に差し替えられる。
import { state } from "../core/state.js";
import { choosePremiumContinue, PREMIUM_CONTINUE_SCRIPTS } from "./continue-premium.js";
import { createContinueAudio } from "../core/audio.js";
import { createContinueView, DEFAULT_CONTINUE_BUTTON_STYLE } from "./continue-view.js";

export const GAME_OVER_TEXT = {
  burnt: { title: "シーシャが焦げてしまった", sub: "まだ、ここで終わる必要はない。" },
  cold: { title: "シーシャが冷え切ってしまった", sub: "仕切り直せば、もう一度勝負できる。" },
  leaf: { title: "フレーバーがダメになってしまった", sub: "次の一台で、俺たちの答えを出そう。" },
  rank: { title: "", sub: "この結果で、俺たちの挑戦を終わらせるのか？" },
};

// at = 開始からの秒数。全体の台詞表示は約20秒。
// audio: 完成した合成音声を置く場合だけ ../assets/audio/voice/continue/... を指定。
// cues のタイミングは完成音声の実測に合わせて調整可能。
export const SUMI_CONTINUE_SCRIPTS = [
  {
    id: "together", title: "共同責任", duration: 20, audio: null,
    reactions: {
      retry: { text: "……そうこなくっちゃな！ ほら、トング持て。俺も最後まで付き合うぞ！", faces: ["surprise", "smile"], effect: "rally", word: "最後まで付き合うぞ！" },
      quit: { text: "……わかった。今日はここまでだ。悔しさは捨てんなよ。……お疲れ。", faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ" },
    },
    cues: [
      { at: 0, face: "surprise", text: "おいおいおいおい！ ちょっと待て！ お前いま諦めようとしたな！？ なあ！？" },
      { at: 3.6, face: "serious", text: "まだ終わってねえだろ！ 俺も終わらせた覚えはねえぞ！ 大会の途中で勝手に帰るな！" },
      { at: 7.4, face: "serious", text: "お前がここで降りたら、お前だけじゃねえ！ 俺も！ tonariも！ 俺たち全員まとめて負けなんだよ！" },
      { at: 12.3, face: "surprise", text: "俺はまだ負けたくねえ！ お前と勝ちてえんだよ！ だから勝手に幕を下ろすんじゃねえ！" },
      { at: 16.9, face: "normal", text: "……で、どうする？ 俺はまだ、トングを置いてねえぞ。" },
    ],
  },
  {
    id: "disaster", title: "世界の終わり", duration: 20, audio: null,
    reactions: {
      retry: { text: "よおおし！ カルダモン絶滅回避！ 行くぞ、俺たちの続きだ！", faces: ["surprise", "smile"], effect: "rally", word: "カルダモン絶滅回避！" },
      quit: { text: "……おう。新聞の一面は白紙にしとく。……よく頑張ったな。", faces: ["surprise", "normal"], effect: "farewell", word: "よく頑張ったな" },
    },
    cues: [
      { at: 0, face: "surprise", text: "待て待て待て待て！！ お前！ その『諦める』が何を意味するか分かってんのか！？" },
      { at: 3.9, face: "serious", text: "俺たちの夢が終わる！ 店の看板が泣く！ 炭が冷める！ カルダモンが絶滅する！！" },
      { at: 8.0, face: "surprise", text: "明日の新聞の一面は決まりだ！ 『若き職人、まさかの自主撤退！ 師匠、号泣！』だぞ！！" },
      { at: 12.3, face: "serious", text: "ふざけるな！ 俺はまだ泣く準備なんかしてねえ！ 勝てるかどうかは知らん！ だが俺たちはまだやれる！" },
      { at: 17.1, face: "normal", text: "ほら、戻るぞ。大会に。……カルダモンは絶滅しねえけどな。" },
    ],
  },
  {
    id: "meeting", title: "反対多数", duration: 20, audio: null,
    reactions: {
      retry: { text: "可決ッ！！ 全会一致ッ！！ では直ちに、大会へ復帰だ！！", faces: ["surprise", "smile"], effect: "vote", word: "全会一致ッ！！" },
      quit: { text: "……反対一票、撤回。今日は閉会だ。お疲れ、はじめ。", faces: ["surprise", "normal"], effect: "farewell", word: "お疲れ、はじめ" },
    },
    cues: [
      { at: 0, face: "surprise", text: "おい！ ちょっと待て！ なんで一人で諦めようとしてんだ！？ そんな議題聞いてねえぞ！" },
      { at: 3.8, face: "serious", text: "お前が大会に出た！ 俺が教えた！ ならこれは二人の戦いだろ！ 勝手に一人で議決すんな！" },
      { at: 8.0, face: "surprise", text: "お前が諦めるということは俺も諦めたことになる！ 俺は反対だ！ 断固反対！！" },
      { at: 12.0, face: "serious", text: "敗北届は受理しねえ！ 印鑑も押さねえ！ そもそもそんな書類この店には存在しねえ！！" },
      { at: 16.4, face: "normal", text: "全会一致じゃねえ。よって廃案だ。……さ、俺たちの大会に戻ろうぜ。" },
    ],
  },
];

let nextScript = 0;
let previousContinueSpeaker = null;
// 選択は20秒まで。字幕送りはカウントを早めず、期限後はGAME OVERからタイトルへ戻る。
export function buildGameOver({ reason = "rank", rank = 0, variant = null, onRetry, onTitle,
  soundEffects = true, reducedMotion = false, buttonStyle = DEFAULT_CONTINUE_BUTTON_STYLE } = {}) {
  const standard = SUMI_CONTINUE_SCRIPTS[Number.isInteger(variant) && variant >= 0
    ? variant % SUMI_CONTINUE_SCRIPTS.length : nextScript++ % SUMI_CONTINUE_SCRIPTS.length];
  const forced = typeof variant === "string" && variant.startsWith("premium:")
    ? PREMIUM_CONTINUE_SCRIPTS[variant.slice(8)] : null;
  const script = forced || (variant == null
    ? choosePremiumContinue(state?.lovers || [], state?.chapter || 1, Math.random, previousContinueSpeaker) : null) || standard;
  const speaker = script.speaker || "sumi";
  if (variant == null) previousContinueSpeaker = speaker;
  const view = createContinueView({ script, speaker, character: script.name || "スミさん",
    premium: speaker !== "sumi", buttonStyle });
  const { root } = view;
  root.dataset.reason = reason;
  const audio = createContinueAudio({ enabled: soundEffects });
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let reduce = reducedMotion || !!motion?.matches;
  let active = true, started = false, start = 0, speechStart = 0, cueIndex = -1, ticker = 0, entry = 0, frame = 0, deadline = 0;
  let currentInstant = false, hiddenAt = null, reactionAt = null, choice = null, secondFace = false, exit = 0;
  const counted = new Set();
  const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
  function setMotion() {
    reduce = reducedMotion || !!motion?.matches;
    root.dataset.reducedMotion = String(reduce);
    if (reduce) view.reveal();
  }
  setMotion();
  motion?.addEventListener?.("change", setMotion);

  function sync(at, sound = true, countAt = at) {
    const elapsed = Math.min(script.duration, Math.max(0, at));
    const index = Math.max(0, script.cues.findLastIndex(c => c.at <= elapsed));
    const cue = script.cues[index];
    if (index !== cueIndex) {
      cueIndex = index;
      currentInstant = false;
      root.dataset.cue = String(index);
      view.setCaption(cue.text, cue.emphasis);
      view.face(cue.face, !reduce);
      if (sound && index > 0) audio.beat();
    }
    const length = (script.cues[index + 1]?.at ?? script.duration) - cue.at;
    view.reveal(currentInstant || reduce || elapsed >= script.duration ? 1
      : Math.min(1, (elapsed - cue.at + .08) / Math.min(1.7, length * .5)));
    const remaining = Math.max(0, Math.ceil(script.duration - countAt));
    view.count.textContent = String(remaining).padStart(2, "0");
    root.classList.toggle("go-urgent", remaining > 0 && remaining <= 5);
    root.classList.toggle("go-done", remaining === 0);
    if (remaining <= 5 && !counted.has(remaining)) {
      counted.add(remaining);
      if (sound) audio.count(remaining);
    }
    view.next.disabled = view.dialogue.disabled = index === script.cues.length - 1 && view.isRevealed();
    if (remaining === 0) expire();
  }
  function armDeadline() {
    clearTimeout(deadline);
    if (active && !choice && !document.hidden) {
      deadline = window.setTimeout(expire, Math.max(0, script.duration * 1000 - (performance.now() - start)));
    }
  }
  function expire() {
    if (!active || choice || document.hidden) return;
    if (!root.isConnected) return cleanup();
    choice = "timeout";
    clearTimeout(entry); clearTimeout(deadline); clearInterval(ticker);
    root.dataset.phase = "gameover";
    root.dataset.timedOut = "true";
    root.classList.remove("go-urgent");
    root.classList.add("go-done");
    view.count.textContent = "00";
    view.gameOver();
    if (!counted.has(0)) { counted.add(0); audio.count(0); }
    audio.expire();
    reactionAt = performance.now();
    ticker = window.setInterval(tick, 50);
  }
  function cleanup() {
    if (!active) return;
    active = false;
    clearInterval(ticker); clearTimeout(entry); clearTimeout(deadline); clearTimeout(exit); cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    motion?.removeEventListener?.("change", setMotion);
    audio.cleanup();
  }
  function finish() {
    if (!active || !choice || root.dataset.phase === "leaving") return;
    if (!root.isConnected) return cleanup();
    root.dataset.phase = "leaving";
    view.proceed.disabled = true;
    clearInterval(ticker); ticker = 0;
    // 一度だけ明るく抜ける／静かに暗転。軽減モードはフェードのみ。
    root.classList.add("go-leaving");
    audio.cleanup();
    exit = window.setTimeout(() => {
      if (!active || !root.isConnected) return cleanup();
      const callback = choice === "retry" ? onRetry : onTitle;
      cleanup();
      callback?.();
    }, 240);
  }
  function tick() {
    if (!root.isConnected) return cleanup();
    if (!active || document.hidden) return;
    if (choice) {
      const elapsed = performance.now() - reactionAt;
      if (choice === "timeout") {
        if (elapsed >= 1600) finish();
        return;
      }
      const reaction = script.reactions[choice];
      if (!secondFace && elapsed >= 480) {
        secondFace = true;
        view.face(reaction.faces.at(-1), false);
      }
      if (elapsed >= 2700) finish();
    } else sync((performance.now() - speechStart) / 1000, true, (performance.now() - start) / 1000);
  }
  function decide(value) {
    if (!active || choice || !root.isConnected) return;
    if (!started) begin();
    if (document.hidden) return;
    if (performance.now() - start >= script.duration * 1000) return expire();
    choice = value; // どちらのボタンも、この時点で分岐を確定して二重発火を止める。
    clearTimeout(entry); clearTimeout(deadline); clearInterval(ticker);
    root.dataset.phase = "reaction";
    root.classList.remove("go-urgent", "go-done");
    view.reaction(script.reactions[value], value);
    reactionAt = performance.now();
    audio.choose(value, script.reactions[value].effect);
    ticker = window.setInterval(tick, 50);
  }
  function visibility() {
    if (!active || !started) return;
    if (document.hidden) {
      hiddenAt ??= performance.now();
      clearTimeout(deadline);
      audio.pause();
    } else if (hiddenAt != null) {
      const gap = performance.now() - hiddenAt;
      start += gap;
      speechStart += gap;
      if (reactionAt != null) reactionAt += gap;
      hiddenAt = null;
      audio.resume();
      armDeadline();
      tick(); // 音と字幕を同時に再開。飛ばしたカウント音をまとめて鳴らさない。
    }
  }
  function begin() {
    if (!active || started || !root.isConnected) return;
    started = true;
    start = speechStart = performance.now();
    observer.observe(root.parentNode, { childList: true });
    document.addEventListener("visibilitychange", visibility);
    audio.start();
    sync(0, false);
    entry = window.setTimeout(() => { if (active && !choice && !document.hidden) audio.title(); }, 400);
    ticker = window.setInterval(tick, 70);
    visibility();
    armDeadline();
  }
  view.retry.addEventListener("click", () => decide("retry"));
  view.quit.addEventListener("click", () => decide("quit"));
  function advanceSpeech() {
    if (!active || choice) return;
    if (!started) begin();
    if (document.hidden) return;
    if (performance.now() - start >= script.duration * 1000) return expire();
    if (!view.isRevealed()) { currentInstant = true; view.reveal(); return; }
    const elapsed = (performance.now() - speechStart) / 1000;
    const at = script.cues.find(c => c.at > elapsed + .05)?.at ?? script.duration;
    speechStart = performance.now() - at * 1000;
    sync(at, false, (performance.now() - start) / 1000);
  }
  view.next.addEventListener("click", advanceSpeech);
  view.dialogue.addEventListener("click", advanceSpeech);
  view.proceed.addEventListener("click", () => {
    // 押した瞬間の連打で反応字幕を消さない。追加タップで待ち時間を短縮できる。
    if (active && choice && choice !== "timeout" && !document.hidden && performance.now() - reactionAt >= 450) finish();
  });
  view.setCaption(script.cues[0].text);
  view.reveal(reduce ? 1 : .03);
  frame = requestAnimationFrame(begin);
  root.cleanupContinue = cleanup;
  root.setContinueSoundEffects = audio.setEnabled;
  return root;
}
