// 実プレイ映像と、撮影し直さず直せる字幕・矢印のキューシート。
export const STEP_DEMOS = Object.freeze({
  // 2026-11-13 に今の画面（一枚の舞台・リングの自動送り）で撮り直した（CRN）。時刻は撮った時の出来事から
  holes: {
    title: "穴あけのお手本",
    src: "./media/demo-holes.mp4",
    cues: [
      { from: 0, to: 3.6, text: "穴あけだ。まず配置を選べ。外周と中周に、均等な穴を作る", arrow: { x: .72, y: .75, rotate: 0 } },
      { from: 3.6, to: 5.7, text: "光を見ろ。カウントのあと、目印の近くを針が動きだす", arrow: { x: .30, y: .50, rotate: 0 } },
      { from: 5.7, to: 14.4, text: "光が目印に重なったら押す。押す長さで深さが決まる。短すぎると浅く、長く押すほど大きい穴になるぞ", arrow: { x: .30, y: .50, rotate: 0 } },
      { from: 14.4, to: 16.4, text: "外周が揃った。埋まったら次のリングへ進む", arrow: { x: .30, y: .50, rotate: 0 } },
      { from: 16.4, to: 24.3, text: "次は中周。熱を通す穴を、一つずつ", arrow: { x: .30, y: .50, rotate: 0 } },
      { from: 24.3, to: Infinity, text: "よし、開通。結果を見て、間隔を確かめろ", arrow: { x: .80, y: .93, rotate: 0 } },
    ],
  },
  pull: {
    title: "吸い出しのお手本",
    src: "./media/demo-pull.mp4",
    cues: [
      { from: 0, to: 2.1, text: "吸い出しだ。針が左右に動く。右で止めると熱が入り、左で止めると熱が逃げる", arrow: { x: .654, y: .2, rotate: 90 } },
      { from: 2.1, to: 4.0, text: "止める前に、針の下の「止めると →」と温度計の点線で、行き先を見ろ", arrow: { x: .54, y: .78, rotate: 0 } },
      { from: 4.0, to: 5.2, text: "ぬるい時は、右の白い帯（芯）で止めると大きく熱が入る", arrow: { x: .95, y: .42, rotate: 180 } },
      { from: 5.2, to: 6.7, text: "吸っている間は待つ。半円の外の弧が、吸い終わりまでの残り" },
      { from: 6.7, to: 10.4, text: "次は行き先が「適温」になる所で止める。温度計の虹に入れば最適だ", arrow: { x: .36, y: .45, rotate: 180 } },
      { from: 10.4, to: 12.1, text: "適温になったら「提供する」で仕上げる", arrow: { x: .69, y: .77, rotate: 90 } },
      { from: 12.1, to: Infinity, text: "結果を見て、次の調整に備えろ", arrow: { x: .80, y: .94, rotate: 0 } },
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
