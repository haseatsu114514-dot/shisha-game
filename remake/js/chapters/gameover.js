// 大会コンティニュー: スミさんがプレイヤーに直接語りかける。
// タイムラインと音声を分離し、後から録音音声・口パク素材に差し替えられる。
import { el, clamp } from "../core/util.js";
import { portraitInfo } from "../core/data.js";
import { playBgm, stopBgm } from "../core/audio.js";

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
const VOICE_SPEED = 1.55;
const VOICE_PITCH = 0.68;

function chooseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const japanese = voices.filter(v => /^ja(?:-|_)/i.test(v.lang));
  return japanese.find(v => /Otoya|男性|male|otoko/i.test(v.name)) || japanese[0] || null;
}

/**
 * 借り物音声ではなく、端末標準の仮読み上げ。
 * 正式な渋い男性の声は音声生成後に各 script.audio へ設定する。
 */
function narrate(script, setStatus) {
  let speech = null, track = null;
  let stopped = false;
  const browserVoice = () => {
    if (stopped || !("speechSynthesis" in window)) {
      if (!stopped) setStatus("音声なし（字幕のみ）");
      return;
    }
    window.speechSynthesis.cancel();
    speech = new SpeechSynthesisUtterance(script.cues.map(c => c.text).join(" "));
    speech.lang = "ja-JP";
    speech.rate = VOICE_SPEED;
    speech.pitch = VOICE_PITCH;
    speech.volume = 1;
    const v = chooseVoice();
    if (v) speech.voice = v;
    speech.onstart = () => { if (!stopped) setStatus("仮音声を再生中"); };
    speech.onerror = () => { if (!stopped) setStatus("音声なし（字幕のみ）"); };
    speech.onend = () => { if (!stopped) setStatus("セリフ再生終了"); };
    try { window.speechSynthesis.speak(speech); }
    catch { setStatus("音声なし（字幕のみ）"); }
  };
  if (script.audio) {
    track = new Audio(script.audio);
    track.onplay = () => setStatus("生成音声を再生中");
    track.onerror = () => { track = null; browserVoice(); };
    track.play().catch(() => { track = null; browserVoice(); });
  } else browserVoice();
  return () => {
    stopped = true;
    if (track) { track.pause(); track.currentTime = 0; }
    if (speech && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };
}

export function buildGameOver({ reason = "rank", rank = 0, variant = null, onRetry, onTitle }) {
  const meta = GAME_OVER_TEXT[reason] || GAME_OVER_TEXT.rank;
  const script = SUMI_CONTINUE_SCRIPTS[
    Number.isInteger(variant) && variant >= 0
      ? variant % SUMI_CONTINUE_SCRIPTS.length
      : nextScript++ % SUMI_CONTINUE_SCRIPTS.length
  ];
  const reasonTitle = reason === "rank" ? `結果は${rank}位` : meta.title;
  const portrait = portraitInfo("sumi", script.cues[0].face);
  const portraitEl = portrait
    ? el("img.go-sumi-img", { src: portrait.src, alt: "スミさん", draggable: "false" })
    : el("div.go-sumi-fallback", { text: "スミさん" });
  const caption = el("p.go-speech-text", { text: script.cues[0].text, "aria-live": "polite" });
  const voiceStatus = el("span.go-voice-status", { text: "音声の準備中" });
  const count = el("span.go-count", { text: "20" });
  const progress = el("div.go-progress-fill");
  const voiceButton = el("button.go-voice-toggle", { type: "button", text: "音声 OFF", dataset: { test: "continue-voice" } });
  const skipButton = el("button.go-skip", { type: "button", text: "セリフを飛ばす", dataset: { test: "continue-skip" } });
  const root = el("div.end-screen.gameover", { dataset: { test: "game-over", reason, variant: script.id } }, [
    el("div.go-veil"),
    el("div.go-warning", { text: "DON'T GIVE UP!　　DON'T GIVE UP!　　DON'T GIVE UP!" }),
    el("div.go-left", [
      el("p.go-small-label", { text: "TONARI // EMERGENCY CALL" }),
      el("div.go-portrait", [portraitEl]),
      el("div.go-character", [el("span", { text: "スミさん" }), el("small", { text: "46 / tonari OWNER" })]),
    ]),
    el("div.go-right", [
      el("div.go-flag", { text: "まだ、ここで終わるな。" }),
      el("div.go-title", { "aria-label": "GAME OVER", text: "CONTINUE?" }),
      el("div.go-reason", [
        el("span.go-emblem", { class: reason, text: reason === "rank" ? `${rank}位` : ({ burnt: "炎", cold: "冷", leaf: "葉" }[reason] || "！") }),
        el("div", [
          el("p.go-reason-title", { text: reasonTitle }),
          el("p.end-sub.go-reason-sub", { text: meta.sub }),
        ]),
      ]),
      el("div.go-dialogue", [
        el("div.go-speaker", [el("strong", { text: "墨田丈一郎" }), el("span", { text: `\u25cf ${script.title}` })]),
        caption,
      ]),
      el("div.go-playback", [
        el("div.go-progress-track", [progress]),
        el("div.go-clock", [count, el("span", { text: "秒 / 再挑戦の決断" })]),
        voiceStatus, voiceButton, skipButton,
      ]),
      el("p.end-question", { text: "俺たち、もう一度やれるよな？" }),
      el("p.go-note", { text: "コンティニューすると大会の頭から。セーブ済みの大会直前の状態に戻る。" }),
      el("div.end-actions", [
        el("button.btn.primary", { text: "大会に戻る", dataset: { test: "retry" }, onclick: () => { cleanup(); onRetry?.(); } }),
        el("button.btn", { text: "諦める", dataset: { test: "game-over-title" }, onclick: () => { cleanup(); onTitle?.(); } }),
      ]),
    ]),
  ]);
  let active = true, muted = false, stopVoice = () => {}, ticker = 0;
  let start = 0, fastForward = false, cueIndex = -1;
  function sync(at) {
    const elapsed = Math.min(script.duration, at);
    const index = Math.max(0, script.cues.findLastIndex(c => c.at <= elapsed));
    if (index !== cueIndex) {
      cueIndex = index;
      const cue = script.cues[index];
      caption.textContent = cue.text;
      if (portrait) portraitEl.src = portraitInfo("sumi", cue.face)?.src || portrait.src;
      root.dataset.emotion = cue.face;
    }
    count.textContent = String(Math.ceil(script.duration - elapsed)).padStart(2, "0");
    progress.style.width = `${elapsed / script.duration * 100}%`;
    root.classList.toggle("go-done", elapsed >= script.duration);
  }
  function cleanup() {
    if (!active) return;
    active = false;
    clearInterval(ticker);
    stopVoice();
    stopBgm(0.2);
  }
  function runVoice() {
    stopVoice();
    if (!muted) stopVoice = narrate(script, (status) => { if (active) voiceStatus.textContent = status; });
    else { stopVoice = () => {}; voiceStatus.textContent = "音声 OFF"; }
  }
  voiceButton.addEventListener("click", () => {
    muted = !muted;
    voiceButton.textContent = muted ? "音声 ON" : "音声 OFF";
    runVoice();
  });
  skipButton.addEventListener("click", () => {
    fastForward = true;
    stopVoice();
    voiceStatus.textContent = "セリフをスキップ";
    sync(script.duration);
  });
  requestAnimationFrame(() => {
    if (!root.isConnected || !active) return;
    playBgm("bgm_continue_urgent");
    sync(0);
    runVoice();
    start = performance.now();
    ticker = window.setInterval(() => {
      if (!root.isConnected) return cleanup();
      if (!fastForward) sync((performance.now() - start) / 1000);
      if (fastForward || performance.now() - start >= script.duration * 1000) {
        clearInterval(ticker);
        ticker = 0;
      }
    }, 70);
  });
  root.cleanupContinue = cleanup;
  return root;
}
