// CONTINUEの描画。台本・抽選・遷移から独立させ、1行のテロップを文字ごとに出す。
// 2026-11-13 オーナー決定（#2524・CV61）: 本編の既定は C 漫画の大ゴマ（layout:"manga"・continue-looks.js）。
// 前の版の neon（筆文字・円形HUD・鋭角ボタン）と保留中の A 熾火（ember）も残す。立ち絵は continuePortraitStyle で新バージョン。
import { el } from "../core/util.js";
import { createNeonClock, createNeonAtmosphere } from "./continue-neon.js";
import { CONTINUE_LOOKS, decorateContinueLook } from "./continue-looks.js";
import { DB, img, portraitInfo } from "../core/data.js";

/**
 * CONTINUEで使う立ち絵の画風。新版（portraitVariants.new）に台本の全表情と顔の測定値がそろう人物だけ新版を使い、
 * 1表情でも欠ける人物は現行で統一する（表情ごとに画風が混ざらないようにする）。#2524 オーナー「キャラも新バージョンを出したい」。
 * 顔の測定値は manifest.continuePortraitVariants.new（remake/tools/build_manifest.py）。
 */
export function continuePortraitStyle(speaker, faces, style = "new") {
  const folder = speaker === "oneesan" ? "minto" : speaker;
  const variant = DB.manifest.portraitVariants?.[style]?.[folder];
  const framing = DB.manifest.continuePortraitVariants?.[style]?.[folder];
  const list = Array.isArray(faces) && faces.length ? faces : ["normal"];
  return variant && framing && list.every(face => variant.faces?.includes(face) && framing[face]) ? style : "classic";
}
export function continueFraming(info) {
  if (!info) return null;
  const table = info.style && info.style !== "classic" ? DB.manifest.continuePortraitVariants?.[info.style] : DB.manifest.continuePortraits;
  return table?.[info.folder]?.[info.face] || null;
}

const EMPHASIS = ["俺たち全員", "俺たちはまだやれる", "断固反対", "カルダモンが絶滅", "まだ終わってねえ", "お前と勝ちてえ", "勝手に", "ちょっと待て", "ずっと、見てますから", "何枚も何枚も", "もう一回だけ", "ぎゅってする", "次の香り", "ワンチャン", "コンティニュー", "王命じゃ", "もう一度見たい", "もう一台", "はじめのシーシャ", "諦める"];
// 顔の高さ(px)。テロップを1行にした分、人物を大きく映す（2026-10-10）。
const FACE_PX = 256;
const HEAD_PADDING = 24;
// #590 採用C。neonだけ、最初から顔bboxを2.05倍・同じ中心へ揃える。
const NEON_FACE_PX = 524.8;
const NEON_FACE_CENTER_Y = 273;

export function createContinueView({ script, speaker, character, lover = speaker !== "sumi", layout = "neon", background = "stage", onType = null }) {
  // C 漫画（manga・本編の既定）と A 熾火（ember・保留）（CV58〜CV61）。部品の組み方は neon と同じで、飾りと CSS だけが違う。
  const look = CONTINUE_LOOKS.includes(layout) ? layout : null;
  const neon = layout === "neon" || !!look;
  // #2524 「記憶の暗室」（layout:"inner"）。2026-11-06 に一度既定（#2713）にしたが、2026-11-07 オーナー決定で neon に戻し、比較用に残す。
  // 筆文字・円形HUD・鋭角ボタンを使わず、細い活字・上端の時計バー・文字だけの2択で構成する。
  // 顔の大きさと中心（524.8px・Y273）は採用Cを共有し、中心Xだけ左（400）へ寄せる。
  const inner = layout === "inner";
  const bigFace = neon || inner;
  const classicBack = neon || layout === "bottom-back-count";
  const backCount = layout === "back-count" || classicBack;
  const topActions = layout === "top" || layout === "back-count";
  const art = name => img(`ui/continue/${name}.png`);
  const faces = [...new Set([...script.cues.map(cue => cue.face), ...Object.values(script.reactions || {}).flatMap(r => r.faces || [])])];
  const style = continuePortraitStyle(speaker, faces);
  const portrait = portraitInfo(speaker, script.cues[0].face, style);
  const image = portrait
    ? el("img.go-sumi-img", { src: portrait.src, alt: character, draggable: "false" })
    : el("div.go-sumi-fallback", { text: character });
  function framePortrait(info) {
    if (!info) return;
    // 正規画像の顔の範囲を計測し、画像全体を拡大・配置する。画像や色は加工しない。
    const framing = continueFraming(info);
    const faceSize = framing?.size || info.h * .2;
    const height = (bigFace ? NEON_FACE_PX : FACE_PX) / faceSize, width = height * info.aspect;
    // neon・innerは顔bbox中心を固定。比較用レイアウトは従来の頭上端基準を保つ。
    const top = 1 - info.h - info.b;
    const imageTop = bigFace ? NEON_FACE_CENTER_Y - ((framing?.top ?? top) + faceSize / 2) * height
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
  const bar = inner ? el("i.go-inner-bar", { "aria-hidden": "true" }) : null;
  const clock = hud?.clock || el("span.go-clock", { "aria-hidden": "true" }, [count]);
  const echo = backCount ? el("span.go-count-echo", { text: "20" }) : null;
  const echoLayer = backCount ? el("div.go-count-back", { "aria-hidden": "true" }, [echo]) : null;
  const next = el("button.go-next", { type: "button", text: "›", "aria-label": "台詞を送る", dataset: { test: "continue-next" } });
  const proceed = el("button.go-proceed", { type: "button", text: "進む →", hidden: true, dataset: { test: "continue-proceed" } });
  // セリフと区別できる2択ボタン。見た目はCSS、文言は実テキストで表示する。
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
  const heading = neon || inner ? "コンティニューする？" : "コンティニュー？";
  const titleLabel = el("span.go-title-label", { text: heading });
  // 終了ロゴも開始時に読み込み、0秒で画像取得を待たない。
  const finalImage = el("img.go-title-art", { src: art(neon ? "neon_game_over" : "game_over_title"), alt: "", "aria-hidden": "true", hidden: true, draggable: "false" });
  const titleImage = neon ? el("img.go-neon-title", { src: art("neon_title"), alt: "", "aria-hidden": "true", draggable: "false" }) : null;
  const subLabel = inner ? el("span.go-inner-sub", { text: "CONTINUE?", "aria-hidden": "true" }) : null;
  const title = el("h1.go-title", { "aria-label": heading }, [...(subLabel ? [subLabel] : []), titleLabel, ...(titleImage ? [titleImage] : []), finalImage]);
  const root = el("div.end-screen.gameover", { role: "region", "aria-label": "大会のコンティニュー",
    dataset: { test: "game-over", variant: script.id, speaker, lover: String(lover), portraitStyle: portrait?.style || "classic",
      layout: look || (neon ? "neon" : inner ? "inner" : classicBack ? "bottom-back-count" : backCount ? "back-count" : topActions ? "top" : "bottom"),
      background: background === "stage" ? "stage" : "purple", phase: "speaking" } }, [
    el("div.go-veil", { "aria-hidden": "true" }),
    ...((neon && !look) || inner ? createNeonAtmosphere() : []),
    ...(bar ? [bar] : []),
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
  if (look) decorateContinueLook(root, look, { character });
  // CSS変数内の相対URLは使用するCSSファイル基準になるため、ページ基準で解決する。
  root.style.setProperty("--go-backdrop", `url("${new URL(art(background === "stage" ? "backdrop_stage" : "backdrop"), document.baseURI).href}")`);
  function setCount(remaining, progress = 0) {
    const text = String(remaining);
    if (count.textContent !== text) {
      count.textContent = text;
      // 初回の時間制限なしで「∞」になったとき（C 漫画は「あと」「秒」を消す）。
      clock.classList.toggle("go-count-endless", text === "∞");
      if (neon) {
        count.classList.remove("go-count-tick");
        void count.offsetWidth;
        count.classList.add("go-count-tick");
      }
    }
    const elapsed = Math.min(1, Math.max(0, progress));
    hud?.setProgress(elapsed);
    if (bar) root.style.setProperty("--go-progress", String(elapsed));
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
    const info = portraitInfo(speaker, name, style);
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
    if (!neon && !inner) showProceed();
  }
  function showProceed() {
    if (!proceed.hidden) return;
    if (neon || inner) actions.hidden = true;
    proceed.hidden = false;
    proceed.focus({ preventScroll: true });
  }
  function gameOver() {
    titleLabel.textContent = "GAME OVER";
    // innerはロゴ画像を使わず、同じ活字でGAME OVERを出す。
    titleLabel.hidden = !inner;
    if (subLabel) subLabel.hidden = true;
    title.setAttribute("aria-label", "GAME OVER");
    finalImage.hidden = inner;
    if (bar) bar.hidden = true;
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
