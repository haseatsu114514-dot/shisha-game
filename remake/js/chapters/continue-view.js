// CONTINUEの描画。台本・抽選・遷移から独立させ、字幕の全文を確保してから文字を出す。
import { el } from "../core/util.js";
import { DB, img, portraitInfo } from "../core/data.js";
import { autoWrap } from "../vn/text.js";

const EMPHASIS = ["俺たち全員", "俺たちはまだやれる", "断固反対", "カルダモンが絶滅", "まだ終わってねえ", "お前と勝ちてえ", "勝手に", "ちょっと待て", "ずっと、見てますから", "何枚も何枚も", "もう一回だけ", "ぎゅってする", "次の香り", "ワンチャン", "コンティニュー", "王命じゃ", "もう一度見たい", "もう一台", "はじめのシーシャ", "諦める"];
export const DEFAULT_CONTINUE_BUTTON_STYLE = "arcade";

export function createContinueView({ script, speaker, character, premium, buttonStyle = DEFAULT_CONTINUE_BUTTON_STYLE }) {
  const art = name => img(`ui/continue/${name}.png`);
  const portrait = portraitInfo(speaker, script.cues[0].face);
  const image = portrait
    ? el("img.go-sumi-img", { src: portrait.src, alt: character, draggable: "false" })
    : el("div.go-sumi-fallback", { text: character });
  function framePortrait(info) {
    if (!info) return;
    // 正規画像の顔の範囲を計測し、画像全体を拡大・配置する。画像や色は加工しない。
    const framing = DB.manifest.continuePortraits?.[info.folder]?.[info.face];
    const height = 170 / (framing?.size || info.h * .2), width = height * info.aspect;
    const top = framing?.top ?? 1 - info.h - info.b;
    Object.assign(image.style, { height: `${height}px`, width: `${width}px`,
      left: `calc(50% + ${(0.5 - (framing?.cx ?? .5)) * width}px)`, top: `${-top * height}px` });
  }
  framePortrait(portrait);
  const caption = el("p.go-speech-text", { "aria-hidden": "true" });
  const live = el("p.go-a11y", { "aria-live": "polite", "aria-atomic": "true" });
  const dialogue = el("button.go-dialogue", { type: "button", "aria-label": "台詞を送る", dataset: { test: "continue-caption" } }, [caption]);
  const count = el("span.go-count", { text: "20" });
  const next = el("button.go-next", { type: "button", text: "›", "aria-label": "台詞を送る", dataset: { test: "continue-next" } });
  const proceed = el("button.go-proceed", { type: "button", text: "進む →", hidden: true, dataset: { test: "continue-proceed" } });
  const style = ["text", "arcade", "continue"].includes(buttonStyle) ? buttonStyle : "arcade";
  const retry = el("button.go-choice.go-retry", { type: "button", "aria-label": "大会に戻る", dataset: { test: "retry" } },
    [el("span.go-choice-label", { text: style === "continue" ? "CONTINUE" : "大会に戻る" })]);
  const quit = el("button.go-choice.go-quit", { type: "button", dataset: { test: "game-over-title" } },
    [el("span.go-choice-label", { text: "諦める" })]);
  const effectWord = el("span.go-effect-word", { "aria-hidden": "true" });
  const titleLabel = el("span.go-title-label", { text: "CONTINUE?" });
  const titleImage = el("img.go-title-art", { src: art("continue_title"), alt: "", "aria-hidden": "true", draggable: "false" });
  // 終了ロゴも開始時に読み込み、0秒で画像取得を待たない。
  const finalImage = el("img.go-title-art", { src: art("game_over_title"), alt: "", "aria-hidden": "true", hidden: true, draggable: "false" });
  const title = el("h1.go-title", [titleLabel, titleImage, finalImage]);
  const root = el("div.end-screen.gameover", { role: "region", "aria-label": "大会のコンティニュー",
    dataset: { test: "game-over", variant: script.id, speaker, premium: String(premium), textOnly: "true", phase: "speaking", buttonStyle: style } }, [
    el("div.go-veil", { "aria-hidden": "true" }),
    el("header.go-heading", [title]),
    el("div.go-left", [el("div.go-portrait", [image])]),
    el("div.go-right", [
      dialogue, live,
      el("div.go-playback", [el("div.go-caption-controls", [next, proceed])]),
      el("div.end-actions", [retry, quit]),
    ]),
    el("div.go-clock", { "aria-hidden": "true" }, [count]),
    el("div.go-effect", { "aria-hidden": "true" }, [effectWord,
      el("img.go-approval", { src: art("approval_stamp"), alt: "可決", draggable: "false" }), el("i.go-pencil"), el("i.go-scan"),
      el("i.go-wave"), el("i.go-stars", { text: "✧　·　✦" })]),
    el("div.go-exit", { "aria-hidden": "true" }),
  ]);
  for (const [key, name] of [["backdrop", "backdrop"], ["retry-art", "retry_button"], ["quit-art", "quit_button"]]) {
    // CSS変数内の相対URLは使用するCSSファイル基準になるため、ページ基準で解決する。
    root.style.setProperty(`--go-${key}`, `url("${new URL(art(name), document.baseURI).href}")`);
  }
  let letters = [], shown = -1;
  function setCaption(text, emphasis = null) {
    const word = emphasis || EMPHASIS.find(w => text.includes(w));
    const wrapped = autoWrap(text, 28);
    const flat = wrapped.replace(/\n/g, "");
    const start = word ? flat.indexOf(word) : -1;
    let offset = 0;
    letters = Array.from(wrapped, char => {
      const strong = char !== "\n" && start >= 0 && offset >= start && offset < start + word.length;
      if (char !== "\n") offset += char.length;
      return el(strong ? "mark.go-letter" : "span.go-letter", { text: char });
    });
    caption.replaceChildren(...letters);
    live.textContent = text; // 読み上げ支援には文字ごとでなくキューの全文を一度だけ通知。
    shown = -1;
    reveal(0);
  }
  function reveal(fraction = 1) {
    const n = Math.ceil(letters.length * fraction);
    if (n === shown) return;
    letters.forEach((letter, i) => { letter.style.visibility = i < n ? "visible" : "hidden"; });
    shown = n;
  }
  function face(name, beat = true) {
    const info = portraitInfo(speaker, name);
    if (info && portrait) { image.src = info.src; framePortrait(info); }
    root.dataset.emotion = name;
    if (beat) {
      image.classList.remove("go-beat");
      caption.classList.remove("go-cue-pop");
      void root.offsetWidth;
      image.classList.add("go-beat");
      caption.classList.add("go-cue-pop");
    }
  }
  function reaction(data, choice) {
    root.dataset.choice = choice;
    root.dataset.effect = data.effect;
    setCaption(data.text, data.word);
    reveal();
    face(data.faces[0]);
    effectWord.textContent = choice === "retry"
      ? ({ cheer: "っしゃあ！", shark: "ジャバーン！", scan: "再計測" }[data.effect] || "") : "";
    [retry, quit, next, dialogue].forEach(button => { button.disabled = true; });
    next.hidden = true;
    proceed.hidden = false;
    proceed.focus({ preventScroll: true });
  }
  function gameOver() {
    titleLabel.textContent = "GAME OVER";
    titleImage.hidden = true;
    finalImage.hidden = false;
    live.textContent = "GAME OVER";
    [retry, quit, next, dialogue, proceed].forEach(button => { button.disabled = true; });
    proceed.hidden = true;
  }
  return { root, caption, dialogue, count, next, proceed, retry, quit,
    setCaption, reveal, face, reaction, gameOver, isRevealed: () => shown >= letters.length };
}
