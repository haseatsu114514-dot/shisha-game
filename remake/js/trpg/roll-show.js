// 判定のダイス劇場（TRF29）。サイコロを振った瞬間から結果が出るまでを、卓の窓ではなく画面いっぱいで見せる。
// 見た目だけ: 出目・補正・評価は呼び出し側（session）が決めた値をそのまま描き、ここでは何も決めない。
//
// 流れ（ためて、一気に解く）:
//   1. 2個の大きな20面ダイスが画面の外から投げ込まれる。先に1個が止まって目が入る。
//   2. 残りの1個は宙で回り続け（スローモーション・心音）、画面に「あと 14 以上で成功！」。20の目がある時は20を、
//      ファンブルの時は1を最後に残す（いちばん揺さぶれる順）。
//   3. 叩きつけるように着地 → 一瞬止まって明暗のフラッシュ → 目が入り「とどいた!!／とどかない…」。
//   4. 補正のチップが入り、目標までのゲージが伸びる。30の旗を越えたら旗が弾け飛ぶ。届かなければ「あと N」が残る。
//   5. 評価の大文字が叩きつけられる。成功＝金・紙吹雪・集中線、クリティカル＝四方から文字が飛んでくる・金の噴水・大揺れ、
//      ひと手間＝緑、思わぬ出来事＝落ちてくる重い文字・画面が沈む、ファンブル＝ダイスが割れ・青く暗く・文字が崩れる。
// スキル（仲間の切り札・振り直し）を使った判定は、投げる前に「SKILL!」のカットインで誰の何が発動したかを見せる。
// 振り直せる時は、評価のあとに「○○の「△△」で振り直せる！」と知らせる。
// タップ・Enter・Space・Escape で結果まで飛ばせる。動きを減らす設定と、本番のDOM以外（単体テストの簡易DOM）では null を返し、
// 呼び出し側がこれまでどおり卓の窓の中で見せる。揺れを減らす設定（body.reduce-shake）では揺れ・閃光・寄りを省く。
import { el } from "../core/util.js";

const EASE = {
  out: "cubic-bezier(.16,1,.3,1)", back: "cubic-bezier(.2,1.6,.4,1)", soft: "cubic-bezier(.3,.7,.4,1)",
  rise: "cubic-bezier(.2,.6,.4,1)", fall: "cubic-bezier(.55,0,.9,.45)", slam: "cubic-bezier(.7,0,1,.6)",
};
// ダイスの止まる場所（ステージ 1280×720 の座標・中心）と大きさ。
const REST = [[430, 300], [790, 300]], SIZE = 300;
const MEGA = { success: "SUCCESS", critical: "CRITICAL!!", mixed: "PARTIAL", trouble: "MISS", fumble: "FUMBLE" };
const CONFETTI = {
  success: ["#ffd76a", "#fff3c9", "#7fe0b0", "#ff6f7d", "#fff", "#f2a83a"],
  critical: ["#ffe08a", "#ffffff", "#ffbf3c", "#ff7a59", "#8ff0d0", "#ff5f8f", "#b7a4ff"],
  mixed: ["#a6f0c6", "#e4f7d0", "#5fc79a"],
  trouble: ["#d48a70", "#8a6f66", "#5d6f80"],
  fumble: ["#8ea2c4", "#5d6f80", "#3b4a63", "#c0cbe0"],
};
const CRACK = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M50 8 44 30 54 38 40 56 50 64 36 92"/><path d="M44 30 30 34 22 26"/><path d="M54 38 70 40 78 52"/><path d="M40 56 26 62"/><path d="M50 64 64 74 70 90"/></svg>';
const live = host => typeof document?.createElement === "function" && typeof host?.animate === "function" && host.isConnected !== false;
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = list => list[Math.floor(Math.random() * list.length)];

/** 1文字ずつの札にした言葉。字ごとに金属の塗り（::after）と太い縁取り（本体）を重ね、字ごとに動かせる。 */
function word(text, cls = "") {
  return el("span.trpg-rs-word" + (cls ? "." + cls : ""), [...String(text)].map((c, i) =>
    el("span.c", { class: c === "…" ? "dot" : null, dataset: { c: c === " " ? " " : c }, style: { "--i": String(i) }, text: c === " " ? " " : c })));
}

/**
 * @param host 判定の窓を載せている幕（.trpg-overlay）。演出はその上に重なり、終わると自分で片付く。
 * @param show { title, who, rule, dice: [a, b], thrown: 振り直した1個の番号（最初の判定は null）, bonus, bonusLabel, total, goal, mixed,
 *               grade, special, label, sub, sound(kind), onVerdict: 評価が出た瞬間（一度だけ）, onDone: 片付いた後,
 *               skill: { kind: "support"|"reroll", who, name, effect, face: Node } 発動したスキル（無ければ無し）,
 *               rerollHint: 評価のあとに「振り直せる！」の下へ添える、誰の何か（無ければ出さない） }
 * @returns { playing, cancel(), skip() } 。演出しない環境では null。
 */
export function playRollShow(host, show) {
  if (!live(host) || calm()) return null;
  const { dice, thrown = null, grade = "mixed", special = "", goal = 30, mixed = 19, bonus = 0, total = 0 } = show;
  const tone = special === "critical" || special === "fumble" ? special : grade;
  const still = !!document.body?.classList.contains("reduce-shake");
  const sound = kind => { try { show.sound?.(kind); } catch { /* 音が出なくても演出は続ける */ } };
  const animations = [], timers = [];
  let done = false, judged = false;

  // ---- どのダイスを最後に残すか: 振り直しは投げた1個。20の目・ファンブルの1は最後に（いちばん揺さぶれる順）。 ----
  const last = thrown !== null ? thrown
    : dice.indexOf(20) >= 0 && dice[0] !== dice[1] ? dice.indexOf(20)
    : special === "fumble" && dice[0] !== dice[1] ? dice.indexOf(1) : 1;
  const first = 1 - last, firstValue = dice[first];
  const need = goal - bonus - firstValue;
  // 最初の1個が止まった時点で決まっているか（20の目＝必ず成功、合計が最低でも届く）。決まっていれば宙の「ため」は短く。
  const decided = firstValue === 20 ? "critical" : need <= 1 ? "success" : "";
  const hover = decided ? 260 : 820;

  // ---- 部品 ----
  const dieNodes = dice.map((value, i) => el("div.trpg-rs-die", { dataset: { i: String(i) }, style: { left: REST[i][0] - SIZE / 2 + "px", top: REST[i][1] - SIZE / 2 + "px" } }, [
    el("i.trpg-rs-halo"), el("i.trpg-rs-shadow"),
    el("div.trpg-rs-spin", el("span.trpg-rs-body")),
    el("i.trpg-rs-ring"), el("b.trpg-rs-num", { text: String(value), dataset: { digits: String(String(value).length) } }),
    el("span.trpg-rs-crack", { html: CRACK }),
  ]));
  const plus = [el("span.trpg-rs-plus.a", { text: "+" }), el("span.trpg-rs-plus.b", { text: "+" })];
  const chip = el("div.trpg-rs-chip", [el("small", { text: show.bonusLabel || "補正" }), el("b", { text: "＋" + bonus })]);
  const head = el("header.trpg-rs-head", [
    el("small.trpg-rs-kicker", { text: thrown === null ? "DICE ROLL" : "RE-ROLL" }),
    el("strong", { text: show.title }), show.who ? el("span", { text: show.who + (show.bonusLabel && show.bonusLabel !== "補正" ? " · " + show.bonusLabel : "") }) : null,
  ].filter(Boolean));
  const goalStamp = el("i.trpg-rs-stamp");
  const goalNode = el("div.trpg-rs-goal", [el("small", { text: "TARGET" }), el("b", { text: String(goal) }), el("span", { text: "以上で成功" }), goalStamp]);
  const needNode = el("div.trpg-rs-need", { dataset: { state: "wait" } });
  const sumNumber = el("strong", [word("0", "sum")]);
  const sum = el("div.trpg-rs-sum", [el("small", { text: "TOTAL" }), sumNumber]);
  // 目標までのゲージ: 左端＝出目の最小の合計、右端＝最大の合計。19と30で色が変わり、30に旗。
  const lo = 2 + bonus, hi = 40 + bonus, at = value => Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const fill = el("i.trpg-rs-fill"), head2 = el("i.trpg-rs-tip");
  const flag = el("span.trpg-rs-flag", { style: { left: at(goal) * 100 + "%" } }, [el("b", { text: String(goal) })]);
  const gap = el("span.trpg-rs-gap");
  const meter = el("div.trpg-rs-meter", { style: { "--mixed": at(mixed) * 100 + "%", "--goal": at(goal) * 100 + "%" } }, [
    el("i.trpg-rs-track"), fill, head2, gap, el("i.trpg-rs-tick", { style: { left: at(mixed) * 100 + "%" } }), flag,
  ]);
  const verdictWord = word(String(show.label).replace(/…+$/, ""), "verdict");
  const verdictMega = el("span.trpg-rs-mega", { text: MEGA[tone] || "" });
  const verdictSub = show.sub ? el("em", { text: show.sub }) : null;
  const verdict = el("div.trpg-rs-verdict", [verdictMega, el("strong", [verdictWord]), verdictSub].filter(Boolean));
  const camera = el("div.trpg-rs-camera", [head, goalNode, plus[0], ...dieNodes, plus[1], chip, needNode, sum, meter, verdict]);
  const skill = show.skill || null, lead = skill ? 980 : 0;
  const skillNode = skill ? el("div.trpg-rs-skill", { dataset: { kind: skill.kind } }, [
    el("i.trpg-rs-skill-band"),
    el("span.trpg-rs-skill-face", skill.face ? [skill.face] : []),
    el("div.trpg-rs-skill-copy", [
      el("small", { text: "SKILL!  " + (skill.who || "") + "の切り札" }),
      el("strong", [word("「" + skill.name + "」", "skill")]),
      el("em", { text: skill.effect || "" }),
    ]),
  ]) : null;
  const hintNode = show.rerollHint ? el("div.trpg-rs-hint", [el("b", { text: "SKILL" }), el("strong", { text: "振り直せる！" }), el("span", { text: show.rerollHint })]) : null;
  if (skillNode) camera.append(skillNode);
  if (hintNode) camera.append(hintNode);
  const lines = el("i.trpg-rs-lines"), rays = el("i.trpg-rs-rays"), vignette = el("i.trpg-rs-vignette"), tint = el("i.trpg-rs-tint");
  const burst = el("div.trpg-rs-burst"), flash = el("i.trpg-rs-flash");
  const hint = el("small.trpg-rs-skip", { text: "タップでスキップ" });
  const node = el("div.trpg-roll-show", { "aria-hidden": "true", dataset: { grade, special, tone, phase: "throw", ...(thrown === null ? {} : { thrown: String(thrown) }) } },
    [el("i.trpg-rs-veil"), tint, rays, lines, camera, vignette, burst, flash, hint]);

  const animate = (target, frames, options) => {
    if (!target) return null;
    const animation = target.animate(frames, { fill: "both", ...options });
    animations.push(animation);
    return animation;
  };
  const after = (ms, fn) => { timers.push(setTimeout(() => { if (!done) fn(); }, ms)); };
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
  after(320, () => { armed = true; });

  // ---- 画面の手応え: 揺れ（大→小に収束・少しランダム）、明暗のフラッシュ、寄り ----
  function shake(amp, ms = 420, vertical = .45) {
    if (still || amp <= 0) return;
    const steps = 9, frames = [];
    for (let n = 0; n <= steps; n++) {
      const k = n === steps ? 0 : (1 - n / steps) ** 1.6 * (n % 2 ? -1 : 1);
      frames.push({ translate: `${(k * amp + rand(-1, 1) * amp * .15).toFixed(1)}px ${(Math.abs(k) * amp * vertical * (n % 3 ? 1 : -1)).toFixed(1)}px`, offset: n / steps });
    }
    animate(camera, frames, { duration: ms, easing: "linear", fill: "none", composite: "add" });
  }
  function blink(colors, ms = 360, peak = .85) {
    if (still) return;
    const frames = colors.map((color, n) => ({ background: color, opacity: n === colors.length - 1 ? 0 : peak * (1 - n / colors.length * .5), offset: n / (colors.length - 1) }));
    animate(flash, frames, { duration: ms, easing: "linear", fill: "none" });
  }
  let camScale = 1;
  function zoom(scale, ms, origin = "50% 50%", easing = EASE.out) {
    if (still) return;
    camera.style.transformOrigin = origin;
    animate(camera, [{ scale: String(camScale) }, { scale: String(scale) }], { duration: ms, easing });
    camScale = scale;
  }
  function sparks(die, count, colors, reach = [110, 220]) {
    for (let n = 0; n < count; n++) {
      const angle = n / count * Math.PI * 2 + rand(-.3, .3), r = rand(...reach), long = rand(.8, 2.4);
      const spark = el("i.trpg-rs-spark", { style: { background: pick(colors), width: (8 * long).toFixed(0) + "px", rotate: angle + "rad" } });
      die.append(spark);
      animate(spark, [{ opacity: 1, translate: "-50% -50%", scale: "1.4" },
        { opacity: 0, translate: `calc(-50% + ${(Math.cos(angle) * r).toFixed(0)}px) calc(-50% + ${(Math.sin(angle) * r).toFixed(0)}px)`, scale: ".2" }],
      { duration: rand(360, 620), easing: EASE.out });
    }
  }
  /** 目が入る: 叩きつけるように大きく入り、光の輪と火花。20は金の後光、ファンブルの1はひびと冷たい色。 */
  function reveal(i, { quiet = false, big = false } = {}) {
    const die = dieNodes[i], value = dice[i];
    const hot = value === 20 && grade === "success", cold = value === 1 && special === "fumble";
    die.dataset.state = "rest";
    die.dataset.landed = "true";
    if (hot) die.dataset.glow = "critical"; else if (cold) die.dataset.glow = "fumble";
    if (quiet) return;
    const num = die.querySelector(".trpg-rs-num");
    animate(num, [{ opacity: 0, scale: big ? "3.6" : "2.6", rotate: "-14deg" }, { opacity: 1, scale: ".9", rotate: "3deg", offset: .62 }, { opacity: 1, scale: "1", rotate: "0deg" }],
      { duration: big ? 340 : 260, easing: EASE.out });
    animate(die.querySelector(".trpg-rs-spin"), [{ scale: "1.22 .78" }, { scale: ".92 1.1", offset: .45 }, { scale: "1 1" }], { duration: 260, easing: EASE.soft, fill: "none" });
    animate(die.querySelector(".trpg-rs-ring"), [{ opacity: 1, scale: ".3" }, { opacity: 0, scale: hot ? "3.6" : big ? "2.8" : "2.1" }],
      { duration: hot ? 760 : 480, easing: EASE.out });
    sparks(die, hot ? 22 : big ? 14 : 9, hot ? ["#ffe08a", "#fff", "#ffb84a"] : cold ? ["#8ea2c4", "#c9d6ee"] : ["#fff3c9", "#ffd76a"], hot ? [160, 320] : [110, 220]);
    if (hot) {
      animate(die.querySelector(".trpg-rs-halo"), [{ opacity: 0, scale: ".2" }, { opacity: 1, scale: "1.15", offset: .4 }, { opacity: .85, scale: "1" }], { duration: 520, easing: EASE.out });
      blink(["#fff", "#2a1600", "#fff4c2", "#ffe08a"], 380, .78);
      shake(16, 520, .5);
      sound("critical-hit");
    } else if (cold) {
      die.querySelectorAll(".trpg-rs-crack path").forEach((path, n) => animate(path, [{ strokeDashoffset: "120" }, { strokeDashoffset: "0" }], { duration: 260, delay: 90 + n * 40, easing: EASE.out }));
      blink(["#0b1222", "#c9d6ee", "#0b1222"], 380, .7);
      shake(11, 460, .3);
      sound("crack");
    } else {
      shake(big ? 10 : 5, big ? 380 : 260, big ? .5 : 1);
      if (big) blink(["#fff", "#000", "#fff"], 300, .55);
    }
  }

  // ---- 1. 幕と見出し ----
  animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear" });
  animate(node.querySelector(".trpg-rs-veil"), [{ clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" }, { clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" }], { duration: 300, easing: EASE.out });
  animate(lines, [{ opacity: 0 }, { opacity: .32, offset: .3 }, { opacity: .14 }], { duration: 900, easing: "ease-out" });
  animate(head, [{ opacity: 0, transform: "translateX(-120px) skewX(-20deg)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 80, easing: EASE.out });
  animate(goalNode, [{ opacity: 0, scale: "2.4", rotate: "20deg" }, { opacity: 1, scale: "1", rotate: "0deg" }], { duration: 380, delay: 200, easing: EASE.back });
  animate(hint, [{ opacity: 0 }, { opacity: .75 }], { duration: 300, delay: 600 });
  if (skillNode) playSkill();
  after(lead, main);

  /** スキル発動のカットイン: 金の帯が斜めに走り、使った人の顔と技の名前が叩きつけられる。ダイスはその後に投げ込まれる。 */
  function playSkill() {
    sound("skill");
    animate(skillNode, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration: lead + 120, easing: "linear" });
    animate(skillNode.querySelector(".trpg-rs-skill-band"), [{ transform: "skewY(-6deg) scaleX(0)" }, { transform: "skewY(-6deg) scaleX(1)" }], { duration: 260, easing: EASE.out });
    animate(skillNode.querySelector(".trpg-rs-skill-face"), [{ opacity: 0, translate: "-260px 0", rotate: "-30deg" }, { opacity: 1, translate: "0 0", rotate: "0deg" }], { duration: 320, delay: 80, easing: EASE.back });
    const chars = [...skillNode.querySelectorAll(".trpg-rs-word > .c")];
    chars.forEach((c, n) => animate(c, [{ opacity: 0, scale: "2.6", translate: "0 -30px" }, { opacity: 1, scale: "1", translate: "0 0" }], { duration: 240, delay: 180 + n * 40, easing: EASE.out }));
    animate(skillNode.querySelector(".trpg-rs-skill-copy em"), [{ opacity: 0, translate: "60px 0" }, { opacity: 1, translate: "0 0" }], { duration: 240, delay: 260 + chars.length * 40, easing: EASE.out });
    after(200 + chars.length * 40, () => { shake(8, 260, .6); blink(["#fff", "#2a1600", "#fff4c2"], 260, .5); });
    animate(lines, [{ opacity: .1 }, { opacity: .55 }, { opacity: .14 }], { duration: lead, easing: "ease-out" });
  }

  function main() {
  sound("shake");

  // ---- 2. 投げ込み ----
  /** 宙の道筋: [時刻ms, 横, 縦, 大きさ]。止まる場所からのずれ。大きいほど手前（カメラに近い）。 */
  function fly(i, points, spins, { state = "tumbling" } = {}) {
    const die = dieNodes[i], end = points[points.length - 1][0];
    die.dataset.state = state;
    animate(die, points.map(([t, x, y, s], n) => ({
      offset: t / end, transform: `translate(${x}px, ${y}px) scale(${s})`,
      easing: n === points.length - 1 ? "linear" : points[n + 1][2] === 0 ? EASE.slam : y === 0 ? EASE.rise : EASE.soft,
    })), { duration: end });
    animate(die, [{ opacity: 0 }, { opacity: 1 }], { duration: 80, composite: "replace" });
    animate(die.querySelector(".trpg-rs-spin"), spins.map(([t, r]) => ({ offset: t / end, rotate: r + "deg" })), { duration: end, easing: "linear" });
    animate(die.querySelector(".trpg-rs-shadow"), points.map(([t, , y, s]) => ({ offset: t / end, opacity: Math.max(.08, .6 + y / 500), scale: String(Math.max(.4, 1 - Math.abs(y) / 420) * s), translate: `0 ${-y}px` })), { duration: end });
  }
  // 先に止まる1個: 左下の手前から投げ込まれ、跳ねて止まる。
  const firstRest = 880;
  if (thrown === null) {
    const side = first === 0 ? -1 : 1;
    fly(first, [[0, side * 820, 320, 1.9], [300, side * 300, -220, 1.36], [540, 0, 0, 1], [660, 0, -70, 1.06], [770, 0, 0, 1], [830, 0, -12, 1.01], [firstRest, 0, 0, 1]],
      [[0, side * -980], [540, side * -140], [770, side * -18], [firstRest, 0]]);
    after(540, () => { shake(6, 220, 1); sound("die"); });
    after(firstRest, () => reveal(first));
  } else {
    // 振り直し: 残した1個は目を見せたまま卓にいて、少し沈んでいる。
    dieNodes[first].dataset.held = "true";
    reveal(first, { quiet: true });
    animate(dieNodes[first], [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  }
  // 最後の1個: 高く放られて宙で回り続け、ためてから叩きつける。
  const hoverAt = thrown === null ? firstRest + 40 : 520, slamAt = hoverAt + hover + 300;
  {
    const side = last === 0 ? -1 : 1;
    // 着地の後 90ms は動かさない（止め）。それから小さく跳ねて落ち着く。
    fly(last, [[0, side * 860, 340, 1.95], [380, side * 320, -230, 1.45], [hoverAt, side * 70, -190, 1.3],
      [hoverAt + hover / 2, side * 40, -205, 1.32], [hoverAt + hover, side * 15, -195, 1.34], [hoverAt + hover + 110, 0, -235, 1.42], [slamAt, 0, 0, 1],
      [slamAt + 90, 0, 0, 1], [slamAt + 190, 0, -30, 1.03], [slamAt + 290, 0, 0, 1]],
    [[0, side * 1100], [380, side * 420], [hoverAt, side * 150], [hoverAt + hover, side * 60], [slamAt, 0], [slamAt + 290, 0]]);
    // 宙で「ため」ている間は、コマ送りもゆっくり（スローモーション）。叩きつける直前に速さが戻る。
    after(hoverAt, () => { if (dieNodes[last].dataset.state === "tumbling") dieNodes[last].dataset.state = "hover"; });
    after(hoverAt + hover, () => { if (dieNodes[last].dataset.state === "hover") dieNodes[last].dataset.state = "tumbling"; });
  }

  // ---- 3. ため: 「あと N 以上で成功！」・心音・寄り ----
  const needAt = thrown === null ? firstRest + 60 : 380;
  function needCopy() {
    if (decided === "critical") return { tone: "critical", kicker: "20の目", big: "確定", text: "クリティカル!!" };
    if (decided === "success") return { tone: "success", kicker: "もう", big: "届く", text: "成功確定！" };
    if (need > 20) return { tone: "danger", kicker: "LAST HOPE", big: "20", text: "が出れば…！" };
    return { tone: firstValue === 1 ? "danger" : "need", kicker: "NEED", big: String(need), text: need === 20 ? "を出せ！" : "以上で成功！" };
  }
  after(needAt, () => {
    const copy = needCopy();
    needNode.dataset.state = copy.tone;
    needNode.replaceChildren(el("small", { text: copy.kicker }), el("b", [word(copy.big, "need")]), el("span", { text: copy.text }),
      ...(firstValue === 1 && !decided ? [el("em", { text: "1の目… ファンブルの危機！" })] : []));
    animate(needNode, [{ opacity: 0, translate: "-260px 0", scale: "1 .2" }, { opacity: 1, translate: "0 0", scale: "1 1" }], { duration: 300, easing: EASE.out });
    if (!decided) {
      sound("tension");
      node.dataset.phase = "tension";
      zoom(1.07, hover + 260, `${REST[last][0]}px ${REST[last][1] - 120}px`, "ease-in");
      animate(vignette, [{ opacity: 0 }, { opacity: .9 }], { duration: hover, easing: "ease-in" });
      animate(lines, [{ opacity: .14 }, { opacity: .5 }], { duration: hover, easing: "ease-in" });
      const beats = Math.max(1, Math.floor(hover / 380));
      for (let n = 0; n < beats; n++) after(n * 380 + 40, () => {
        sound("beat");
        animate(needNode.querySelector(".trpg-rs-word"), [{ scale: "1" }, { scale: "1.22" }, { scale: "1" }], { duration: 260, easing: EASE.out, fill: "none" });
        animate(vignette, [{ scale: "1" }, { scale: "1.06" }, { scale: "1" }], { duration: 300, easing: EASE.out, fill: "none", composite: "add" });
      });
    }
  });

  // ---- 4. 叩きつけ: 一瞬止まって、目が入り、届いたか分かる ----
  after(slamAt - 90, () => sound("whoosh"));
  after(slamAt, () => {
    node.dataset.phase = "slam";
    reveal(last, { big: true });
    sound("die");
    if (!still) {
      camera.style.transformOrigin = `${REST[last][0]}px ${REST[last][1]}px`;
      animate(camera, [{ scale: decided ? "1" : "1.07" }, { scale: "1.13", offset: .25 }, { scale: ".98", offset: .7 }, { scale: "1" }], { duration: 420, easing: EASE.out });
    }
    animate(vignette, [{ opacity: decided ? 0 : .9 }, { opacity: 0 }], { duration: 400, easing: "ease-out" });
    const reached = grade === "success";
    const copy = special === "critical" ? ["CRITICAL", "20!!", "必ず成功！"] : special === "fumble" ? ["FUMBLE", "1…", "ファンブル…"]
      : reached ? ["CLEAR", "とどいた", "!!"] : grade === "mixed" ? ["あと", String(goal - total), "…届かない"] : ["MISS", "とどかない", "…"];
    needNode.dataset.state = "result-" + tone;
    needNode.replaceChildren(el("small", { text: copy[0] }), el("b", [word(copy[1], "need")]), el("span", { text: copy[2] }));
    animate(needNode, [{ scale: "1.3", filter: "brightness(2.4)" }, { scale: "1", filter: "brightness(1)" }], { duration: 300, easing: EASE.out });
    animate(lines, [{ opacity: .7 }, { opacity: tone === "success" || tone === "critical" ? .3 : .06 }], { duration: 500, easing: "ease-out" });
  });

  // ---- 5. 補正のチップと、目標までのゲージ ----
  const sumAt = slamAt + 380, meterAt = sumAt + 160, meterMs = 620, verdictAt = meterAt + meterMs + 200;
  after(sumAt, () => {
    node.dataset.phase = "sum";
    animate(needNode, [{ opacity: 1, translate: "0 0" }, { opacity: 0, translate: "160px 0" }], { duration: 150, easing: "ease-in" });
    animate(chip, [{ opacity: 0, translate: "420px -60px", rotate: "160deg", scale: "1.6" }, { opacity: 1, translate: "0 0", rotate: "0deg", scale: "1" }], { duration: 300, easing: EASE.out });
    plus.forEach((sign, n) => animate(sign, [{ opacity: 0, scale: "0" }, { opacity: 1, scale: "1" }], { duration: 220, delay: n * 70, easing: EASE.back }));
    animate(sum, [{ opacity: 0, translate: "0 40px" }, { opacity: 1, translate: "0 0" }], { duration: 220, delay: 150, easing: EASE.out });
    animate(meter, [{ opacity: 0, scale: ".6 1" }, { opacity: 1, scale: "1 1" }], { duration: 240, easing: EASE.out });
    sound("chip");
  });
  // ゲージは ease-out（3乗）で伸びる。合計の数字も同じ速さで数え上がり、30の旗を越えた瞬間に旗が弾ける。
  const shown = special === "critical" ? Math.max(total, goal + 2) : total;
  const ease = t => 1 - (1 - t) ** 3, timeAt = p => 1 - Math.cbrt(1 - p);
  const filled = at(total), surge = special === "critical" && total < goal;
  after(meterAt, () => {
    animate(fill, [{ scale: "0 1" }, { scale: `${filled} 1` }], { duration: meterMs, easing: "cubic-bezier(.33,1,.68,1)" });
    animate(head2, [{ left: "0%" }, { left: filled * 100 + "%" }], { duration: meterMs, easing: "cubic-bezier(.33,1,.68,1)" });
    const steps = 14;
    for (let n = 1; n <= steps; n++) after(meterMs * n / steps, () => {
      const value = Math.round(lo + (total - lo) * ease(n / steps));
      sumNumber.replaceChildren(word(n === steps ? total : value, "sum"));
      sum.dataset.zone = value >= goal ? "success" : value >= mixed ? "mixed" : "trouble";
      meter.dataset.zone = sum.dataset.zone;
    });
    if (total >= goal) {
      after(meterMs * timeAt(Math.min(1, (at(goal) - 0) / Math.max(filled, .001))), breakFlag);
    } else if (!surge) {
      after(meterMs + 40, () => {
        gap.style.left = filled * 100 + "%"; gap.style.width = (at(goal) - filled) * 100 + "%";
        gap.dataset.label = "あと " + (goal - total);
        meter.dataset.short = "true";
        animate(gap, [{ opacity: 0, scale: "0 1" }, { opacity: 1, scale: "1 1" }], { duration: 260, easing: EASE.out });
        animate(head2, [{ translate: "-50% -50%" }, { translate: "calc(-50% - 7px) -50%" }, { translate: "calc(-50% + 7px) -50%" }, { translate: "-50% -50%" }], { duration: 260, iterations: 2, fill: "none" });
        sound("short");
      });
    }
    if (surge) {
      // 20の目: 合計が届かなくても、金の光がゲージを旗の先まで押し上げる。
      after(meterMs + 60, () => {
        meter.dataset.surge = "true";
        animate(fill, [{ scale: `${filled} 1` }, { scale: `${at(shown)} 1` }], { duration: 240, easing: EASE.out });
        animate(head2, [{ left: filled * 100 + "%" }, { left: at(shown) * 100 + "%" }], { duration: 240, easing: EASE.out });
        after(140, breakFlag);
      });
    }
  });
  function breakFlag() {
    meter.dataset.cleared = "true";
    animate(flag, [{ translate: "-50% 0", rotate: "0deg", opacity: 1 }, { translate: "40px -90px", rotate: "38deg", opacity: 1, offset: .6 }, { translate: "70px -60px", rotate: "60deg", opacity: 0 }],
      { duration: 520, easing: EASE.out });
    sparks(meter, 12, ["#ffe08a", "#fff", "#ffb84a"], [60, 140]);
    meter.querySelectorAll(".trpg-rs-spark").forEach(spark => { spark.style.left = at(goal) * 100 + "%"; spark.style.top = "50%"; });
    shake(6, 240, 1);
    sound("clear");
  }

  // ---- 6. 評価: 大文字が叩きつけられる ----
  after(verdictAt, () => {
    node.dataset.phase = "verdict";
    judge();
    sound("slam");
    const chars = [...verdictWord.children];
    animate(verdict, [{ opacity: 0 }, { opacity: 1 }], { duration: 60 });
    // 中央寄せ（CSS の translate: -50% -50%）を保ったまま、右から入って少しずつ流れる。
    animate(verdictMega, [{ opacity: 0, translate: "-30% -50%" }, { opacity: 1, translate: "-50% -50%", offset: .25 }, { opacity: 1, translate: "-53% -50%" }], { duration: 2200, easing: EASE.out });
    // サイコロは少し退いて、言葉を主役に（合計とゲージは届いたかを見せるので、そのまま）。
    for (const part of [...dieNodes, ...plus, chip, needNode]) {
      animate(part, [{ filter: "brightness(1) blur(0px)" }, { filter: "brightness(.5) blur(2px)" }], { duration: 260, easing: "ease-out" });
    }
    dieNodes.forEach(die => animate(die, [{ scale: "1" }, { scale: ".9" }], { duration: 320, easing: EASE.out }));
    animate(tint, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
    if (tone === "critical") {
      chars.forEach((c, n) => {
        const a = rand(0, Math.PI * 2);
        animate(c, [{ opacity: 0, translate: `${Math.cos(a) * 900}px ${Math.sin(a) * 600}px`, rotate: rand(-540, 540) + "deg", scale: "3" },
          { opacity: 1, translate: "0 0", rotate: "0deg", scale: "1" }], { duration: 380, delay: n * 45, easing: EASE.out });
      });
      after(chars.length * 45 + 300, () => { shake(26, 700, .55); blink(["#fff", "#3a2000", "#fff6cf", "#ffe08a"], 440, .78); sound("boom"); });
      animate(rays, [{ opacity: 0, scale: ".3" }, { opacity: 1, scale: "1.1" }], { duration: 500, easing: EASE.out });
    } else if (tone === "success") {
      chars.forEach((c, n) => animate(c, [{ opacity: 0, scale: "3.2", translate: "0 -60px", rotate: rand(-24, 24) + "deg" },
        { opacity: 1, scale: ".9", translate: "0 6px", rotate: "0deg", offset: .7 }, { opacity: 1, scale: "1", translate: "0 0" }], { duration: 300, delay: n * 55, easing: EASE.out }));
      after(chars.length * 55 + 160, () => { shake(14, 480, .5); blink(["#fff", "#120c00", "#fff7d6"], 300, .6); });
      animate(rays, [{ opacity: 0, scale: ".4" }, { opacity: .75, scale: "1" }], { duration: 460, easing: EASE.out });
    } else if (tone === "mixed") {
      chars.forEach((c, n) => animate(c, [{ opacity: 0, translate: "240px 0", transform: "skewX(-30deg)" }, { opacity: 1, translate: "0 0", transform: "none" }], { duration: 280, delay: n * 38, easing: EASE.out }));
      after(chars.length * 38 + 200, () => shake(7, 300, .3));
    } else if (tone === "trouble") {
      chars.forEach((c, n) => animate(c, [{ opacity: 0, translate: "0 -420px" }, { opacity: 1, translate: "0 0", offset: .55, easing: "ease-out" },
        { translate: "0 -36px", offset: .72, easing: "ease-in" }, { translate: "0 0", offset: .86 }, { translate: "0 -8px", offset: .93 }, { opacity: 1, translate: "0 0" }],
      { duration: 640, delay: n * 60, easing: "cubic-bezier(.5,0,1,.6)" }));
      after(chars.length * 60 + 300, () => { shake(10, 420, 1); });
      if (!still) animate(camera, [{ rotate: "0deg" }, { rotate: "-1.6deg" }], { duration: 700, delay: 300, easing: EASE.out });
    } else if (tone === "fumble") {
      chars.forEach((c, n) => {
        animate(c, [{ opacity: 0, scale: "1.8" }, { opacity: 1, scale: "1" }], { duration: 200, delay: n * 40, easing: EASE.out });
        // 字が力尽きて、ばらばらに崩れ落ちる。
        animate(c, [{ translate: "0 0", rotate: "0deg" }, { translate: `${rand(-14, 14)}px ${rand(30, 70)}px`, rotate: rand(-28, 28) + "deg" }],
          { duration: 700, delay: 760 + n * 70, easing: "cubic-bezier(.5,0,.8,.4)", composite: "add" });
      });
      after(120, () => { shake(18, 560, .8); blink(["#000", "#c9d6ee", "#000", "#3b4a63"], 520, .8); sound("boom"); });
      if (!still) animate(camera, [{ rotate: "0deg" }, { rotate: "2.6deg" }], { duration: 1400, delay: 500, easing: EASE.soft });
    }
    if (verdictSub) animate(verdictSub, [{ opacity: 0, translate: "0 24px", scale: ".6" }, { opacity: 1, translate: "0 0", scale: "1" }],
      { duration: 280, delay: chars.length * 50 + 200, easing: EASE.back });
    if (grade === "success") {
      goalNode.dataset.result = "clear";
      animate(goalStamp, [{ opacity: 0, scale: "3", rotate: "-30deg" }, { opacity: 1, scale: "1", rotate: "-12deg" }], { duration: 260, delay: 300, easing: EASE.back });
    } else {
      goalNode.dataset.result = "miss";
      animate(goalStamp, [{ opacity: 0, scale: "3" }, { opacity: 1, scale: "1" }], { duration: 240, delay: 300, easing: EASE.out });
    }
    confetti();
    if (hintNode) {
      animate(hintNode, [{ opacity: 0, translate: "80px 0", scale: ".7" }, { opacity: 1, translate: "0 0", scale: "1" }], { duration: 300, delay: 700, easing: EASE.back });
      after(700, () => sound("chip"));
    }
  });
  /** 評価ごとの紙吹雪: 成功は中央から弾け、クリティカルは左右の下から噴き上がる。うまくいかない時は、静かに降るだけ。 */
  function confetti() {
    const colors = CONFETTI[tone], pieces = [];
    const add = (count, make) => { for (let n = 0; n < count; n++) pieces.push(make(n, count)); };
    if (tone === "success" || tone === "critical") {
      add(tone === "critical" ? 64 : 52, () => { const a = rand(0, Math.PI * 2), r = rand(220, 700); return { x: 50, y: 48, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .6 - 140, fall: rand(160, 360) }; });
      if (tone === "critical") for (const side of [-1, 1]) add(42, () => ({ x: side < 0 ? 3 : 97, y: 104, dx: -side * rand(120, 700), dy: -rand(380, 760), fall: rand(300, 560), late: rand(250, 700) }));
    } else if (tone === "mixed") {
      add(18, () => { const a = rand(Math.PI, Math.PI * 2), r = rand(140, 340); return { x: 50, y: 50, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .7, fall: rand(60, 160) }; });
    } else {
      // 落ちてくる冷たい雨。
      add(tone === "fumble" ? 46 : 26, () => ({ x: rand(2, 98), y: -6, dx: rand(-30, 10), dy: rand(420, 760), fall: 0, late: rand(0, 900), rain: true }));
    }
    for (const piece of pieces) {
      const size = rand(9, 18), spin = rand(-900, 900);
      const bit = el("i", { dataset: { kind: piece.rain ? "rain" : Math.random() < .25 ? "star" : "paper" },
        style: { left: piece.x + "%", top: piece.y + "%", width: piece.rain ? "3px" : size + "px", height: piece.rain ? rand(28, 60) + "px" : size * rand(.45, 1) + "px", background: pick(colors) } });
      burst.append(bit);
      animate(bit, piece.rain ? [
        { opacity: 0, translate: "0 0" }, { opacity: .7, offset: .2 }, { opacity: 0, translate: `${piece.dx}px ${piece.dy}px` },
      ] : [
        { opacity: 0, translate: "0 0", rotate: "0deg", easing: EASE.out },
        { opacity: 1, translate: `${piece.dx * .8}px ${piece.dy}px`, rotate: spin * .6 + "deg", offset: .38, easing: "ease-in" },
        { opacity: 0, translate: `${piece.dx}px ${piece.dy + piece.fall}px`, rotate: spin + "deg" },
      ], { duration: piece.rain ? rand(600, 900) : rand(1000, 1700), delay: piece.late || rand(0, 90) });
    }
  }
  const hold = special === "critical" ? 2300 : grade === "success" ? 1800 : special === "fumble" ? 2100 : 1500;
  const endAt = verdictAt + hold;
  after(endAt - 240, () => animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-in" }));
  after(endAt, () => handle.skip());
  }
  return handle;
}
