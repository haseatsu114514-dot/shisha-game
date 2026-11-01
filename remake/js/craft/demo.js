// 実プレイ映像と、撮影し直さず直せる字幕・矢印のキューシート。
export const STEP_DEMOS = Object.freeze({
  holes: {
    title: "穴あけのお手本",
    src: "./media/demo-holes.mp4",
    cues: [
      { from: 0, to: 3.4, text: "穴あけだ。まず配置を選べ。外周と中周に、均等な穴を作る", arrow: { x: .80, y: .24, rotate: 90 } },
      { from: 3.4, to: 6.5, text: "光を見ろ。カウントのあと、目印の周りを回りだす", arrow: { x: .36, y: .42, rotate: 135 } },
      { from: 6.5, to: 14.5, text: "光が目印に重なったら、押せ。穴の位置は目印が教える", arrow: { x: .36, y: .42, rotate: 135 } },
      { from: 14.5, to: 16.5, text: "外周が揃った。次のリングへ進め", arrow: { x: .79, y: .80, rotate: 0 } },
      { from: 16.5, to: 25, text: "次は内側。中心へ熱を通す穴を、一つずつ", arrow: { x: .36, y: .42, rotate: 135 } },
      { from: 25, to: Infinity, text: "よし、開通。結果を見て、間隔を確かめろ", arrow: { x: .865, y: .78, rotate: 0 } },
    ],
  },
  place: {
    title: "炭の配置のお手本",
    src: "./media/demo-place.mp4",
    cues: [
      { from: 0, to: 3, text: "炭の配置だ。右の選択肢を見ろ", arrow: { x: .63, y: .065, rotate: 180 } },
      { from: 3, to: 9.36, text: "『トライアングル（3個）』を押せ", arrow: { x: .63, y: .065, rotate: 180 } },
      { from: 9.36, to: Infinity, text: "炭焼きの画面に切り替わった。配置を選ぶ操作はここまでだ", arrow: { x: .30, y: .45, rotate: 0 } },
    ],
  },
});

export function demoFor(step) { return STEP_DEMOS[step] || null; }

export function openDemoSheet(root, step) {
  const demo = demoFor(step);
  if (!demo || !root?.isConnected) return Promise.resolve(false);
  const doc = root.ownerDocument;
  const sheet = doc.createElement("div");
  sheet.className = "bench-demo-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", demo.title);
  const heading = doc.createElement("h2");
  heading.textContent = demo.title;
  const skip = doc.createElement("button");
  skip.type = "button"; skip.className = "bench-demo-skip"; skip.textContent = "とばす";
  const stage = doc.createElement("div");
  stage.className = "bench-demo-stage";
  const video = doc.createElement("video");
  video.src = demo.src; video.playsInline = true; video.controls = true;
  video.muted = true; video.preload = "auto";
  const arrow = doc.createElement("div");
  arrow.className = "bench-demo-arrow"; arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "➜";
  stage.append(video, arrow);
  const caption = doc.createElement("p");
  caption.className = "bench-demo-caption"; caption.setAttribute("aria-live", "off");
  const finish = doc.createElement("button");
  finish.type = "button"; finish.className = "bench-demo-finish"; finish.textContent = "作業へ進む";
  const head = doc.createElement("div"); head.className = "bench-demo-head"; head.append(heading, skip);
  const card = doc.createElement("div"); card.className = "bench-demo-card";
  card.append(head, stage, caption, finish); sheet.append(card);
  const previousInert = root.querySelector(".bench-panel")?.inert;
  const panel = root.querySelector(".bench-panel");
  if (panel) panel.inert = true;
  root.dataset.demoPaused = "true";
  root.append(sheet);
  const update = () => {
    const cue = demo.cues.find(item => video.currentTime >= item.from && video.currentTime < item.to);
    caption.textContent = cue?.text || "";
    arrow.hidden = !cue?.arrow;
    if (cue?.arrow) {
      arrow.style.left = `${cue.arrow.x * 100}%`;
      arrow.style.top = `${cue.arrow.y * 100}%`;
      arrow.style.rotate = `${cue.arrow.rotate}deg`;
    }
  };
  video.addEventListener("timeupdate", update);
  video.addEventListener("seeked", update);
  update();
  return new Promise(resolve => {
    const close = () => {
      video.pause(); video.removeAttribute("src"); video.load(); sheet.remove();
      if (panel?.isConnected) panel.inert = previousInert;
      delete root.dataset.demoPaused;
      resolve(true);
    };
    skip.addEventListener("click", close, { once: true });
    finish.addEventListener("click", close, { once: true });
    video.play().catch(() => { /* ブラウザが自動再生を止めた場合は動画の再生ボタンを使う。 */ });
    skip.focus();
  });
}
