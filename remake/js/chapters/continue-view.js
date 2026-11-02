// CONTINUEの描画。台本・抽選・遷移から独立させ、1行のテロップを文字ごとに出す。
import { el } from "../core/util.js";
import { createNeonClock, createNeonAtmosphere } from "./continue-neon.js";
import { DB, img, portraitInfo } from "../core/data.js";

const EMPHASIS = ["俺たち全員", "俺たちはまだやれる", "断固反対", "カルダモンが絶滅", "まだ終わってねえ", "お前と勝ちてえ", "勝手に", "ちょっと待て", "ずっと、見てますから", "何枚も何枚も", "もう一回だけ", "ぎゅってする", "次の香り", "ワンチャン", "コンティニュー", "王命じゃ", "もう一度見たい", "もう一台", "はじめのシーシャ", "諦める"];
// 顔の高さ(px)。テロップを1行にした分、人物を大きく映す（2026-10-10）。
const FACE_PX = 256;
const HEAD_PADDING = 24;
// #590 採用C。neonだけ、最初から顔bboxを2.05倍・同じ中心へ揃える。
const NEON_FACE_PX = 524.8;
const NEON_FACE_CENTER_Y = 273;

export function createContinueView({ script, speaker, character, premium, layout = "neon", background = "stage", onType = null }) {
  const neon = layout === "neon";
  const classicBack = neon || layout === "bottom-back-count";
  const backCount = layout === "back-count" || classicBack;
  const topActions = layout === "top" || layout === "back-count";
  const art = name => img(`ui/continue/${name}.png`);
  const portrait = portraitInfo(speaker, script.cues[0].face);
  const image = portrait
    ? el("img.go-sumi-img", { src: portrait.src, alt: character, draggable: "false" })
    : el("div.go-sumi-fallback", { text: character });
  function framePortrait(info) {
    if (!info) return;
    // 正規画像の顔の範囲を計測し、画像全体を拡大・配置する。画像や色は加工しない。
    const framing = DB.manifest.continuePortraits?.[info.folder]?.[info.face];
    const faceSize = framing?.size || info.h * .2;
    const height = (neon ? NEON_FACE_PX : FACE_PX) / faceSize, width = height * info.aspect;
    // neonは顔bbox中心を固定。比較用レイアウトは従来の頭上端基準を保つ。
    const top = 1 - info.h - info.b;
    const imageTop = neon ? NEON_FACE_CENTER_Y - ((framing?.top ?? top) + faceSize / 2) * height
      : HEAD_PADDING - top * height;
    Object.assign(image.style, { height: `${height}px`, width: `${width}px`,
      left: `calc(50% + ${(0.5 - (framing?.cx ?? .5)) * width}px)`, top: `${imageTop}px` });
  }
  framePortrait(portrait);
  const caption = el("p.go-speech-text", { "aria-hidden": "true" });
  const timerLive = el("p.go-a11y.go-time-announcement", { "aria-live": "polite", "aria-atomic": "true" });
  const description = el("p.go-a11y.go-return-description", { id: "continue-return", text: "大会の最初から作り直します。在庫と体力は保存された大会開始時の値に戻ります。救済を選ぶと体力が最大まで回復します。" });
  const live = el("p.go-a11y", { "aria-live": "polite", "aria-atomic": "true" });
  const dialogue = el("button.go-dialogue", { type: "button", "aria-label": "台詞を送る", dataset: { test: "continue-caption" } }, [caption]);
  const count = el("span.go-count", { text: "20" });
  const hud = neon ? createNeonClock(count) : null;
  const clock = hud?.clock || el("span.go-clock", { "aria-hidden": "true" }, [count]);
  const echo = backCount ? el("span.go-count-echo", { text: "20" }) : null;
  const echoLayer = backCount ? el("div.go-count-back", { "aria-hidden": "true" }, [echo]) : null;
  const next = el("button.go-next", { type: "button", text: "›", "aria-label": "台詞を送る", dataset: { test: "continue-next" } });
  const proceed = el("button.go-proceed", { type: "button", text: "進む →", hidden: true, dataset: { test: "continue-proceed" } });
  // セリフと区別できる2択ボタン。見た目はCSS、文言は実テキストで表示する。
  const retry = el("button.go-choice.go-retry", { type: "button", "aria-label": "最初から再挑戦", dataset: { test: "retry" } },
    [...(neon ? choiceFrames() : []),
      el("span.go-choice-label", { text: topActions ? "する" : "最初から再挑戦" })]);
  const quit = el("button.go-choice.go-quit", { type: "button", "aria-label": "諦める・タイトルへ戻る", dataset: { test: "game-over-title" } },
    [...(neon ? choiceFrames() : []),
      el("span.go-choice-label", { text: "諦める" })]);
  function choiceFrames() {
    return [el("img.go-choice-frame", { src: art("neon_quit_frame"), alt: "", "aria-hidden": "true", draggable: "false" }),
      el("img.go-choice-frame.go-choice-frame-selected", { src: art("neon_retry_frame"), alt: "", "aria-hidden": "true", draggable: "false" })];
  }
  const actions = el("div.end-actions", [retry, quit]);
  retry.setAttribute("aria-describedby", "continue-return");
  quit.setAttribute("aria-describedby", "continue-return");
  const effectWord = el("span.go-effect-word", { "aria-hidden": "true" });
  const heading = neon ? "コンティニューする？" : "コンティニュー？";
  const titleLabel = el("span.go-title-label", { text: heading });
  // 終了ロゴも開始時に読み込み、0秒で画像取得を待たない。
  const finalImage = el("img.go-title-art", { src: art(neon ? "neon_game_over" : "game_over_title"), alt: "", "aria-hidden": "true", hidden: true, draggable: "false" });
  const titleImage = neon ? el("img.go-neon-title", { src: art("neon_title"), alt: "", "aria-hidden": "true", draggable: "false" }) : null;
  const title = el("h1.go-title", { "aria-label": heading }, [titleLabel, ...(titleImage ? [titleImage] : []), finalImage]);
  const root = el("div.end-screen.gameover", { role: "region", "aria-label": "大会のコンティニュー",
    dataset: { test: "game-over", variant: script.id, speaker, premium: String(premium),
      layout: neon ? "neon" : classicBack ? "bottom-back-count" : backCount ? "back-count" : topActions ? "top" : "bottom",
      background: background === "stage" ? "stage" : "purple", phase: "speaking" } }, [
    el("div.go-veil", { "aria-hidden": "true" }),
    ...(neon ? createNeonAtmosphere() : []),
    ...(echoLayer ? [echoLayer] : []),
    el("header.go-heading", [title, clock, ...(topActions ? [actions] : [])]),
    el("p.go-limit-note", { text: "初回は時間制限なし（カウントは演出です）", "aria-hidden": "true" }),
    el("div.go-left", [el("div.go-portrait", [image])]),
    el("div.go-right", [
      ...(!topActions ? [actions] : []),
      dialogue, live, timerLive, description,
      el("div.go-playback", [el("div.go-caption-controls", [next, proceed])]),
    ]),
    el("div.go-effect", { "aria-hidden": "true" }, [effectWord,
      el("img.go-approval", { src: art("approval_stamp"), alt: "可決", draggable: "false" }), el("i.go-pencil"), el("i.go-scan"),
      el("i.go-wave"), el("i.go-stars", { text: "✧　·　✦" })]),
    el("div.go-exit", { "aria-hidden": "true" }),
  ]);
  // CSS変数内の相対URLは使用するCSSファイル基準になるため、ページ基準で解決する。
  root.style.setProperty("--go-backdrop", `url("${new URL(art(background === "stage" ? "backdrop_stage" : "backdrop"), document.baseURI).href}")`);
  function setCount(remaining, progress = 0) {
    const text = String(remaining);
    if (count.textContent !== text) {
      count.textContent = text;
      if (neon) {
        count.classList.remove("go-count-tick");
        void count.offsetWidth;
        count.classList.add("go-count-tick");
      }
    }
    const elapsed = Math.min(1, Math.max(0, progress));
    hud?.setProgress(elapsed);
    if (echo) {
      if (echo.textContent !== text) echo.textContent = text;
      // 台詞送りとは独立した実際の残り時間に合わせる。停止中も拡大しない。
      root.style.setProperty("--go-count-scale", String(classicBack ? .75 + 1.05 * elapsed : .65 + .9 * elapsed));
    }
  }
  let letters = [], shown = -1;
  // 表示済みの文字だけを中央へ並べる。文字や行を拡大せず、1行のまま出す。
  function setCaption(text, emphasis = null) {
    const word = [emphasis, ...EMPHASIS].find(w => w && text.includes(w));
    const start = word ? text.indexOf(word) : -1;
    let offset = 0;
    letters = Array.from(text, char => {
      const strong = start >= 0 && offset >= start && offset < start + word.length;
      offset += char.length;
      return el(strong ? "mark.go-letter" : "span.go-letter", { text: char });
    });
    caption.replaceChildren(...letters);
    shown = -1;
    reveal(0);
  }
  function reveal(fraction = 1) {
    const n = Math.min(letters.length, Math.floor(letters.length * Math.max(0, fraction)) + 1);
    if (n === shown) return;
    const typed = shown >= 0 && n > shown && n - shown <= 4;
    letters.forEach((letter, i) => { letter.classList.toggle("go-on", i < n); });
    // 日常の会話と同じく、文字が出るたびに話者の声を鳴らす。一括表示では鳴らさない。
    if (typed && Math.floor(n / 2) > Math.floor(shown / 2)) onType?.();
    shown = n;
  }
  function face(name, beat = true) {
    const info = portraitInfo(speaker, name);
    if (info && portrait && image.getAttribute("src") !== info.src) { image.src = info.src; framePortrait(info); }
    root.dataset.emotion = name;
    if (beat) {
      image.classList.remove("go-beat");
      void root.offsetWidth;
      image.classList.add("go-beat");
    }
  }
  function reaction(data, choice) {
    root.dataset.choice = choice;
    root.dataset.effect = data.effect;
    face(data.faces[0], root.dataset.reducedMotion !== "true");
    effectWord.textContent = choice === "retry"
      ? ({ cheer: "っしゃあ！", shark: "ジャバーン！", scan: "再計測" }[data.effect] || "") : "";
    [retry, quit, next, dialogue].forEach(button => { button.disabled = true; });
    next.hidden = true;
    if (!neon) showProceed();
  }
  function showProceed() {
    if (!proceed.hidden) return;
    if (neon) actions.hidden = true;
    proceed.hidden = false;
    proceed.focus({ preventScroll: true });
  }
  function gameOver() {
    titleLabel.textContent = "GAME OVER";
    titleLabel.hidden = true;
    title.setAttribute("aria-label", "GAME OVER");
    finalImage.hidden = false;
    if (titleImage) titleImage.hidden = true;
    clock.hidden = actions.hidden = true;
    if (echoLayer) echoLayer.hidden = true;
    live.textContent = "GAME OVER";
    [retry, quit, next, dialogue, proceed].forEach(button => { button.disabled = true; });
    proceed.hidden = true;
  }
  // 読み上げ支援には文字ごとでなく、台詞のまとまりを一度だけ通知する。
  const announce = text => { live.textContent = text; };
  return { root, caption, dialogue, count, next, proceed, retry, quit,
    announceTime: text => { timerLive.textContent = text; }, setCaption, reveal, face, reaction, showProceed, gameOver, announce, setCount, isRevealed: () => shown >= letters.length };
}
