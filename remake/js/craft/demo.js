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
});

export function demoFor(step) { return STEP_DEMOS[step] || null; }

export function openDemoSheet(root, step) {
  const demo = demoFor(step);
  if (!demo || !root?.isConnected) return Promise.resolve(false);
  const doc = root.ownerDocument;
  const previousFocus = doc.activeElement;
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
  const status = doc.createElement("p");
  status.className = "bench-demo-status"; status.setAttribute("role", "status");
  status.textContent = "動画を読み込んでいます。待たずに文字の手順を確認して、作業へ進むこともできます。";
  const instructions = doc.createElement("details");
  instructions.className = "bench-demo-instructions";
  const summary = doc.createElement("summary"); summary.textContent = "文字で手順を見る（動画と同じ説明）";
  const steps = doc.createElement("ol");
  // 字幕と同じ正本を使う。動画の取得・再生に依存せず手順を読める。
  for (const cue of demo.cues) {
    const item = doc.createElement("li"); item.textContent = cue.text; steps.append(item);
  }
  instructions.append(summary, steps);
  const finish = doc.createElement("button");
  finish.type = "button"; finish.className = "bench-demo-finish"; finish.textContent = "作業へ進む";
  const head = doc.createElement("div"); head.className = "bench-demo-head"; head.append(heading, skip);
  const card = doc.createElement("div"); card.className = "bench-demo-card";
  card.append(head, stage, caption, status, instructions, finish); sheet.append(card);
  const previousInert = root.querySelector(".bench-panel")?.inert;
  const panel = root.querySelector(".bench-panel");
  // ガイドを含む背後の作業台を操作させない。各要素の既存状態は閉じる際に戻す。
  const background = [...root.children].map(node => ({ node, inert: node.inert }));
  for (const { node } of background) node.inert = true;
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
  return new Promise(resolve => {
    let closed = false;
    // native video controls内のTab操作はブラウザへ任せ、シートの両端だけを循環させる。
    const containTab = event => {
      if (event.key !== "Tab") return;
      if (event.shiftKey && doc.activeElement === skip) {
        event.preventDefault(); finish.focus();
      } else if (!event.shiftKey && doc.activeElement === finish) {
        event.preventDefault(); skip.focus();
      }
    };
    sheet.addEventListener("keydown", containTab);
    const showInstructions = (message, broken = false) => {
      if (closed || !sheet.isConnected) return;
      status.textContent = message;
      instructions.open = true;
      if (broken) { stage.hidden = true; caption.hidden = true; }
    };
    const unavailable = () => showInstructions("動画を再生できません。下の手順を確認して、作業へ進めます。", true);
    const stalled = () => showInstructions("動画の読み込みが止まっています。下の手順を確認して、待たずに作業へ進めます。");
    const playing = () => {
      if (!closed && sheet.isConnected) status.textContent = "動画を再生中です。文字の手順でも確認できます。";
    };
    const listeners = [["timeupdate", update], ["seeked", update], ["error", unavailable],
      ["stalled", stalled], ["waiting", stalled], ["playing", playing]];
    const close = (completed = true) => {
      if (closed) return;
      closed = true;
      observer.disconnect();
      sheet.removeEventListener("keydown", containTab);
      for (const [name, handler] of listeners) video.removeEventListener(name, handler);
      video.pause(); video.removeAttribute("src"); video.load(); sheet.remove();
      for (const { node, inert } of background) if (node.isConnected) node.inert = inert;
      if (panel?.isConnected) panel.inert = previousInert;
      delete root.dataset.demoPaused;
      if (completed && previousFocus?.isConnected && root.contains(previousFocus)) previousFocus.focus();
      resolve(completed);
    };
    // LOAD・工程の中断で外された動画を再生し続けず、遅れたplay拒否も別画面へ持ち越さない。
    const observer = new MutationObserver(() => { if (!root.isConnected || !sheet.isConnected) close(false); });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    for (const [name, handler] of listeners) video.addEventListener(name, handler);
    skip.addEventListener("click", () => close(), { once: true });
    finish.addEventListener("click", () => close(), { once: true });
    update();
    if (video.error) unavailable();
    else video.play().catch(error => {
      if (closed) return;
      if (video.error || error?.name !== "NotAllowedError") unavailable();
      else showInstructions("動画を自動再生できません。動画の再生ボタンか、下の文字の手順を使ってください。");
    });
    skip.focus();
  });
}
