// 判定のダイス劇場（TRF29）。サイコロを振った瞬間から結果が出るまでを、卓の窓の中ではなく画面いっぱいで見せる。
// 見た目だけ: 出目・補正・評価は呼び出し側（session）が決めた値をそのまま描き、ここでは何も決めない。
// 流れ: 2個のダイスが画面の外から投げ込まれて跳ねる → 止まった瞬間に目が入る → 補正の札 → 合計が数え上がる → 評価の帯と光・紙吹雪。
// タップ・Enter・Space で結果まで飛ばせる。動きを減らす設定と、本番のDOM以外（単体テストの簡易DOM）では null を返し、
// 呼び出し側がこれまでどおり卓の窓の中で見せる。
import { el } from "../core/util.js";

const EASE = { out: "cubic-bezier(.16,1,.3,1)", back: "cubic-bezier(.2,1.5,.4,1)", rise: "cubic-bezier(.2,.6,.4,1)", fall: "cubic-bezier(.6,0,.9,.5)" };
// 投げ込みの道筋: [進み具合, 横, 縦, 大きさ]。地面に付く時刻は効果音の「カラ、カラ、カラ」（audio.js の roll）に合わせてある。
const THROWS = [
  { ms: 1000, spin: -620, path: [[0, -700, -250, 1.5], [.37, -190, 0, 1], [.52, -108, -112, 1.12], [.66, -44, 0, 1], [.77, -18, -42, 1.04], [.87, -4, 0, 1], [.94, 0, -8, 1], [1, 0, 0, 1]] },
  { ms: 1080, spin: 700, path: [[0, 720, -300, 1.5], [.41, 170, 0, 1], [.55, 96, -100, 1.1], [.68, 40, 0, 1], [.78, 15, -36, 1.03], [.86, 4, 0, 1], [.93, 0, -7, 1], [1, 0, 0, 1]] },
];
const CONFETTI = {
  success: ["#f2c44e", "#fff3c9", "#7fb894", "#c94f5d", "#f6e8c5"],
  critical: ["#ffe08a", "#ffffff", "#f2c44e", "#ff9c6b", "#8fe0c0", "#c94f5d"],
  mixed: ["#e4c79b", "#7fb894", "#f6e8c5"],
  trouble: ["#d48a70", "#8a6f66", "#5d6f80"],
  fumble: ["#8ea2c4", "#5d6f80", "#3b4a63", "#c0cbe0"],
};
const live = host => typeof document?.createElement === "function" && typeof host?.animate === "function" && host.isConnected !== false;
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * @param host 判定の窓を載せている幕（.trpg-overlay）。演出はその上に重なり、終わると自分で片付く。
 * @param show { title, who, rule, dice: [a, b], thrown: 振り直した1個の番号（最初の判定は null）, bonus, bonusLabel, total, goal,
 *               grade, special, label, sub, onVerdict: 評価が出た瞬間（一度だけ）, onDone: 片付いた後 }
 * @returns { playing, cancel(), skip() } 。演出しない環境では null。
 */
export function playRollShow(host, show) {
  if (!live(host) || calm()) return null;
  const { dice, thrown = null, grade = "mixed", special = "" } = show;
  const tone = special === "critical" || special === "fumble" ? special : grade;
  const still = !!document.body?.classList.contains("reduce-shake");
  const animations = [], timers = [];
  let done = false, judged = false;

  const dieNodes = dice.map((value, i) => el("div.trpg-rs-die", { dataset: { i: String(i) } }, [
    el("i.trpg-rs-shadow"), el("span.trpg-rs-body"), el("i.trpg-rs-ring"), el("b.trpg-rs-num", { text: String(value) }),
  ]));
  const plus = [el("span.trpg-rs-plus", { text: "＋" }), el("span.trpg-rs-plus", { text: "＋" })];
  const chip = el("div.trpg-rs-chip", [el("small", { text: show.bonusLabel || "補正" }), el("b", { text: "＋" + show.bonus })]);
  const totalNumber = el("strong", { text: "0" });
  const total = el("div.trpg-rs-total", [el("small", { text: "合計" }), totalNumber, el("span.trpg-rs-goal", { text: "目標 " + show.goal })]);
  const band = el("i.trpg-rs-band"), verdictLabel = el("strong", { text: show.label });
  const verdictSub = show.sub ? el("em", { text: show.sub }) : null;
  const verdict = el("div.trpg-rs-verdict", [band, verdictLabel, verdictSub].filter(Boolean));
  const head = el("header.trpg-rs-head", [el("small", { text: [thrown === null ? "" : "振り直し", show.who].filter(Boolean).join(" · ") }),
    el("strong", { text: show.title }), el("span", { text: show.rule })]);
  const frame = el("div.trpg-rs-frame", [head, el("div.trpg-rs-dice", [dieNodes[0], plus[0], dieNodes[1], plus[1], chip]), total, verdict]);
  const rays = el("i.trpg-rs-rays"), burst = el("div.trpg-rs-burst"), flash = el("i.trpg-rs-flash");
  const hint = el("small.trpg-rs-skip", { text: "タップでスキップ" });
  const node = el("div.trpg-roll-show", { "aria-hidden": "true", dataset: { grade, special, tone, phase: "throw" } },
    [el("i.trpg-rs-veil"), rays, el("i.trpg-rs-bar.top"), el("i.trpg-rs-bar.bottom"), frame, burst, flash, hint]);

  const animate = (target, frames, options) => {
    const animation = target.animate(frames, { fill: "both", ...options });
    animations.push(animation);
    return animation;
  };
  const at = (ms, fn) => { timers.push(setTimeout(() => { if (!done) fn(); }, ms)); };
  function cleanup() {
    done = true; handle.playing = false;
    for (const timer of timers) clearTimeout(timer);
    for (const animation of animations) { try { animation.cancel(); } catch { /* already gone */ } }
    host.removeEventListener("pointerdown", onPointer, true);
    host.removeEventListener("keydown", onKey, true);
    document.removeEventListener("visibilitychange", onHide);
    node.remove();
  }
  function judge() {
    if (judged) return;
    judged = true;
    show.onVerdict?.();
  }
  const handle = {
    playing: true,
    /** 卓を片付ける時: 何も呼ばずに消える。 */
    cancel() { if (!done) cleanup(); },
    /** 結果まで飛ばす: 評価の音は一度だけ鳴らし、結果の卓へ進む。 */
    skip() {
      if (done) return;
      cleanup(); judge(); show.onDone?.();
    },
  };
  // 振るボタンを押した指・キーがそのまま飛ばしてしまわないよう、少し待ってから受け付ける。
  let armed = false;
  function onPointer(event) { event.stopPropagation(); if (armed) handle.skip(); }
  function onKey(event) {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Escape") return;
    event.preventDefault(); event.stopPropagation();
    if (armed && !event.repeat) handle.skip();
  }
  function onHide() { if (document.hidden) handle.skip(); }
  host.addEventListener("pointerdown", onPointer, true);
  host.addEventListener("keydown", onKey, true);
  document.addEventListener("visibilitychange", onHide);
  host.append(node);
  at(320, () => { armed = true; });

  // ---- 幕と見出し ----
  animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  animate(head, [{ opacity: 0, transform: "translateY(-18px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 320, delay: 60, easing: EASE.out });
  animate(hint, [{ opacity: 0 }, { opacity: .7 }], { duration: 300, delay: 500 });

  // ---- 投げ込み ----
  const kick = power => {
    if (still) return;
    animate(frame, [{ translate: "0 " + power + "px" }, { translate: "0 " + -power * .4 + "px" }, { translate: "0 0" }], { duration: 170, easing: "ease-out", fill: "none" });
  };
  const sparks = (die, count, color) => {
    for (let n = 0; n < count; n++) {
      const angle = n / count * Math.PI * 2 + rand(-.25, .25), reach = rand(90, 170);
      const spark = el("i.trpg-rs-spark", { style: { background: color } });
      die.append(spark);
      animate(spark, [{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
        { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * reach}px), calc(-50% + ${Math.sin(angle) * reach * .7}px)) scale(.2)` }],
      { duration: rand(380, 560), easing: EASE.out });
    }
  };
  /** ダイスが止まって、目が入る。20 は金、ファンブルの 1 は冷たい色で、評価の前から分かる。 */
  const land = (i, quiet = false) => {
    const die = dieNodes[i], value = dice[i];
    const hot = value === 20 && grade === "success", cold = value === 1 && special === "fumble";
    die.dataset.landed = "true";
    if (hot) die.dataset.glow = "critical"; else if (cold) die.dataset.glow = "fumble";
    if (quiet) return;
    animate(die.querySelector(".trpg-rs-num"), [{ opacity: 0, transform: "translate(-50%,-50%) scale(2.8)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }],
      { duration: 260, easing: EASE.back });
    animate(die.querySelector(".trpg-rs-ring"), [{ opacity: .95, transform: "translate(-50%,-50%) scale(.35)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(" + (hot ? 3.4 : 2.1) + ")" }],
      { duration: hot ? 720 : 480, easing: EASE.out });
    sparks(die, hot ? 16 : 8, hot ? "#ffe08a" : cold ? "#8ea2c4" : "#fff3c9");
    kick(hot || cold ? 10 : 6);
  };
  const toss = i => {
    const die = dieNodes[i], body = die.querySelector(".trpg-rs-body"), plan = THROWS[i];
    die.dataset.state = "tumbling";
    animate(die, plan.path.map(([offset, x, y, scale], n, all) => ({
      offset, transform: `translate(${x}px, ${y}px) scale(${scale})`,
      easing: n === 0 ? EASE.fall : n === all.length - 1 ? "linear" : y === 0 ? EASE.rise : EASE.fall,
    })), { duration: plan.ms });
    animate(die, [{ opacity: 0 }, { opacity: 1 }], { duration: 90, composite: "replace" });
    animate(body, [{ rotate: plan.spin + "deg" }, { rotate: "0deg" }], { duration: plan.ms, easing: "cubic-bezier(.25,.6,.3,1)" });
    animate(die.querySelector(".trpg-rs-shadow"), plan.path.map(([offset, , y]) => ({ offset, opacity: .55 + y / 600, transform: `translate(-50%, ${-y * .9}px) scale(${1 - y / 400})` })), { duration: plan.ms });
    // 最初に卓へ当たった瞬間は、画面が小さく沈む。
    at(plan.path[1][0] * plan.ms, () => kick(4));
    at(plan.ms, () => { die.dataset.state = "rest"; land(i); });
    return plan.ms;
  };
  if (thrown !== null) node.dataset.thrown = String(thrown);
  const tossed = dice.map((_, i) => i).filter(i => thrown === null || thrown === i);
  for (const i of [0, 1]) if (!tossed.includes(i)) { dieNodes[i].dataset.state = "rest"; dieNodes[i].dataset.held = "true"; land(i, true); }
  const landedAt = Math.max(...tossed.map(toss));

  // ---- 補正の札 → 合計 → 評価 ----
  const chipAt = thrown === null ? landedAt + 230 : 0, totalAt = (thrown === null ? chipAt + 260 : landedAt + 260), countMs = 460;
  const verdictAt = totalAt + countMs + 130, endAt = verdictAt + (special === "critical" ? 1750 : grade === "success" ? 1450 : 1250);
  if (thrown === null) {
    plus.forEach((sign, n) => animate(sign, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: chipAt - 60 + n * 60 }));
    animate(chip, [{ opacity: 0, transform: "scale(.2) rotate(-40deg)" }, { opacity: 1, transform: "scale(1) rotate(0)" }], { duration: 300, delay: chipAt, easing: EASE.back });
  }
  animate(total, [{ opacity: 0, transform: "translateY(22px) scale(.8)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 220, delay: totalAt, easing: EASE.out });
  for (let step = 1; step <= 12; step++) {
    at(totalAt + countMs * step / 12, () => { totalNumber.textContent = String(Math.round(show.total * (1 - (1 - step / 12) ** 2))); });
  }
  at(verdictAt, () => {
    node.dataset.phase = "verdict";
    totalNumber.textContent = String(show.total);
    judge();
    animate(totalNumber, [{ transform: "scale(1.45)" }, { transform: "scale(1)" }], { duration: 320, easing: EASE.back, fill: "none" });
    animate(band, [{ transform: "skewX(-12deg) scaleX(0)" }, { transform: "skewX(-12deg) scaleX(1)" }], { duration: 260, easing: EASE.out });
    animate(verdictLabel, [{ opacity: 0, transform: "scale(3.2)" }, { opacity: 1, transform: "scale(1)" }], { duration: 300, delay: 60, easing: EASE.back });
    if (verdictSub) animate(verdictSub, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, delay: 320, easing: EASE.out });
    animate(verdict, [{ opacity: 0 }, { opacity: 1 }], { duration: 60 });
    if (!still) animate(flash, [{ opacity: 0 }, { opacity: tone === "critical" ? .85 : tone === "success" ? .6 : .35, offset: .12 }, { opacity: 0 }], { duration: tone === "critical" ? 700 : 480, easing: "ease-out" });
    if (grade === "success") animate(rays, [{ opacity: 0, scale: ".5" }, { opacity: special === "critical" ? .9 : .55, scale: "1" }], { duration: 420, easing: EASE.out });
    if (!still && tone !== "success" && tone !== "mixed") {
      const amp = tone === "critical" ? 12 : tone === "fumble" ? 9 : 5;
      animate(frame, [0, 1, -1, .7, -.5, .3, 0].map((k, n, all) => ({ translate: `${k * amp}px ${(n % 2 ? -1 : 1) * Math.abs(k) * amp * .4}px`, offset: n / (all.length - 1) })), { duration: 440, easing: "linear", fill: "none" });
    }
    confetti();
  });
  /** 評価ごとの紙吹雪: 成功は中央から弾け、クリティカルは左右の下からも吹き上がる。うまくいかない時は、静かに降るだけ。 */
  function confetti() {
    const colors = CONFETTI[tone], pieces = [];
    const add = (count, make) => { for (let n = 0; n < count; n++) pieces.push(make(n, count)); };
    if (tone === "success" || tone === "critical") {
      add(tone === "critical" ? 70 : 46, () => { const a = rand(0, Math.PI * 2), r = rand(180, 620); return { x: 50, y: 58, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .6 - 120, fall: rand(120, 320) }; });
      if (tone === "critical") for (const side of [-1, 1]) add(34, () => ({ x: side < 0 ? 4 : 96, y: 100, dx: -side * rand(120, 620), dy: -rand(320, 680), fall: rand(260, 520), late: rand(80, 320) }));
    } else if (tone === "mixed") {
      add(16, () => { const a = rand(Math.PI, Math.PI * 2), r = rand(120, 300); return { x: 50, y: 62, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .7, fall: rand(60, 160) }; });
    } else {
      add(tone === "fumble" ? 30 : 18, () => ({ x: rand(8, 92), y: -4, dx: rand(-40, 40), dy: rand(200, 420), fall: rand(240, 420), late: rand(0, 380), slow: true }));
    }
    for (const piece of pieces) {
      const size = rand(8, 16), spin = rand(-720, 720);
      const bit = el("i", { style: { left: piece.x + "%", top: piece.y + "%", width: size + "px", height: size * rand(.4, 1) + "px", background: colors[Math.floor(Math.random() * colors.length)] } });
      burst.append(bit);
      animate(bit, [
        { opacity: 0, transform: "translate(0, 0) rotate(0deg)", easing: EASE.out },
        { opacity: 1, transform: `translate(${piece.dx * .8}px, ${piece.dy}px) rotate(${spin * .6}deg)`, offset: piece.slow ? .5 : .38, easing: "ease-in" },
        { opacity: 0, transform: `translate(${piece.dx}px, ${piece.dy + piece.fall}px) rotate(${spin}deg)` },
      ], { duration: rand(900, 1500), delay: piece.late || rand(0, 90) });
    }
  }
  at(endAt - 220, () => animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-in" }));
  at(endAt, () => handle.skip());
  return handle;
}
