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
// スキル（仲間の助力・振り直し）を使った判定は、投げる前に「SKILL!」のカットインで誰の何が発動したかを見せる。
// スキルを使うか・振り直すかは、劇場の中の選ぶ札（showRollChoice）で選ぶ。呼び出し側が rerollHint を渡した時だけ、
// 評価のあとに「○○の「△△」で振り直せる！」と知らせる。
// タップ・Enter・Space・Escape で結果まで飛ばせる。動きを減らす設定と、本番のDOM以外（単体テストの簡易DOM）では null を返し、
// 呼び出し側がこれまでどおり卓の窓の中で見せる。揺れを減らす設定（body.reduce-shake）では揺れ・閃光・寄りを省く。
import { el } from "../core/util.js";
import { createD20, pose, randomAxis, restPose } from "./dice3d.js";

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
// 評価のロゴ（Codex 作・#4082・asset_sources/trpg-roll-logos/）。評価の色（tone）→ 絵の名前。
const LOGO_FILES = Object.freeze({ critical: "critical", fumble: "fumble", success: "success", mixed: "partial", trouble: "miss", skill: "skill" });
const logoUrl = kind => LOGO_FILES[kind] ? new URL(`../../img/ui/trpg/roll-logos/${LOGO_FILES[kind]}.webp`, import.meta.url).href : "";
// スキルのカットインは投げた直後に出るので、スキルを選べる時だけ先に読む。
// 評価のロゴは、出目が決まった時に劇場の img が必要な1枚を読み始める。
let skillLogoRequested = false;
export function preloadSkillLogo() {
  if (skillLogoRequested || typeof Image !== "function" || calm()) return;
  skillLogoRequested = true;
  const img = new Image();
  img.decoding = "async";
  img.src = logoUrl("skill");
}
const live = host => typeof document?.createElement === "function" && typeof host?.animate === "function" && host.isConnected !== false;
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** 劇場を出せるか（動きを減らす設定・簡易DOMでは出さない）。出せない時、呼び出し側は今までどおり卓の窓で選ばせる。 */
export function rollShowReady(host) { return live(host) && !calm(); }
// スマホ（横持ち・data-density="phone"）では、紙吹雪と火花の数を半分にし、評価時のぼかしを省く。
// iPhone では演出の山場（クリティカル等）で描画が限界を超えてページごと落ちることがあるための軽量化で、
// 見せ場の流れと PC の見た目は変えない。影と全面フィルター側の軽量化は trpg-roll-show.css の phone 上書き。
const phoneLite = () => typeof document !== "undefined" && document.documentElement?.dataset?.density === "phone";
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = list => list[Math.floor(Math.random() * list.length)];

/** 言葉の札。太い縁取りと厚み（本体）の上に、金属の塗り（::after）を重ねる。 */
function word(text, cls = "") {
  // 言葉は1続きの文字として描く（縁を全部先に、塗りを全部あとに）。1文字ずつ分けると、隣の字の黒い縁どうしが重なって見えた。
  const t = String(text);
  return el("span.trpg-rs-word" + (cls ? "." + cls : ""), [el("span.c", { dataset: { c: t }, text: t })]);
}

/**
 * @param host 判定の窓を載せている幕（.trpg-overlay）。演出はその上に重なり、終わると自分で片付く。
 * @param show { title, who, rule, dice: [a, b], thrown: 振り直した1個の番号（最初の判定は null）, bonus, bonusLabel, total, goal, mixed,
 *               grade, special, label, sub, sound(kind), onVerdict: 評価が出た瞬間（一度だけ）, onDone: 片付いた後,
 *               skill: { kind: "support"|"reroll", who, name, effect, face: Node } 発動したスキル（無ければ無し）,
 *               rerollHint: 評価のあとに「振り直せる！」の下へ添える、誰の何か（無ければ出さない）,
 *               seamless: 直前まで劇場の幕（showRollChoice）が出ていた時。幕の入りの動きを省いて、続けて見せる,
 *               keepUp: 終わりに幕を薄くせず、そのまま onDone へ（続けて劇場の中で選ばせる時。VPG29） }
 * @returns { playing, cancel(), skip() } 。演出しない環境では null。
 */
export function playRollShow(host, show) {
  if (!live(host) || calm()) return null;
  const { dice, thrown = null, grade = "mixed", special = "", goal = 30, mixed = 19, bonus = 0, total = 0 } = show;
  const tone = special === "critical" || special === "fumble" ? special : grade;
  const still = !!document.body?.classList.contains("reduce-shake");
  const lite = phoneLite();
  const count = n => lite ? Math.ceil(n / 2) : n;
  const sound = kind => { try { show.sound?.(kind); } catch { /* 音が出なくても演出は続ける */ } };
  const animations = [], timers = [];
  let frameId = null;
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
    value === 20 && grade === "success" ? el("i.trpg-rs-halo") : null, el("i.trpg-rs-shadow"),
    el("div.trpg-rs-spin", [el("canvas.trpg-rs-d3")]),
    el("i.trpg-rs-ring"), el("b.trpg-rs-num", { text: String(value), dataset: { digits: String(String(value).length) } }),
    el("span.trpg-rs-crack", { html: CRACK }),
  ]));
  const plus = [el("span.trpg-rs-plus.a", { text: "+" }), el("span.trpg-rs-plus.b", { text: "+" })];
  // 補正がいくつか重なる時（能力＋助力など）は、何が足されて＋N になったかを丸の中に書く（劇場の中でスキルを選ぶ時に bonusParts を渡す。VPG30）
  const parts = Array.isArray(show.bonusParts) && show.bonusParts.length > 1 ? show.bonusParts : null;
  const chip = el("div.trpg-rs-chip", { dataset: { parts: parts ? String(parts.length) : "" } },
    [el("small", { text: parts ? parts.join("\n") : show.bonusLabel || "補正" }), el("b", { text: "＋" + bonus })]); // 内訳は1つずつ改行（丸の中で語の途中で折れない）
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
  // ロゴの絵が読めていれば、評価はロゴを叩きつけ、日本語の読みは下に小さく添える。読めていなければ今の大文字。
  const verdictLogo = el("img.trpg-rs-logo", { src: logoUrl(tone), alt: "", decoding: "async" });
  const verdict = el("div.trpg-rs-verdict", [verdictMega, verdictLogo, el("div.trpg-rs-verdict-line", [el("strong", [verdictWord]), verdictSub].filter(Boolean))]);
  const camera = el("div.trpg-rs-camera", [head, goalNode, plus[0], ...dieNodes, plus[1], chip, needNode, sum, meter, verdict]);
  // スキルのカットイン（誰の・技の名前・効き目の3行）は読める長さ出す（2026-11-25 オーナー「振り直しスキルがすぐ消える」で980→1900ms。タップで飛ばせる）
  const skill = show.skill || null, lead = skill ? 1900 : 0;
  const skillNode = skill ? el("div.trpg-rs-skill", { dataset: { kind: skill.kind } }, [
    el("i.trpg-rs-skill-band"),
    el("div.trpg-rs-skill-inner", [
      el("span.trpg-rs-skill-face", skill.face ? [skill.face] : []),
      el("div.trpg-rs-skill-copy", [
        el("div.trpg-rs-skill-kicker", [el("img.trpg-rs-skill-logo", { src: logoUrl("skill"), alt: "", decoding: "async" }), el("small", { text: (skill.who || "") + "のスキル" })]),
        el("strong", [word("「" + skill.name + "」", "skill")]),
        el("em", { text: skill.effect || "" }),
      ]),
    ]),
  ]) : null;
  const hintNode = show.rerollHint ? el("div.trpg-rs-hint", [el("b", { text: "SKILL" }), el("strong", { text: "振り直せる！" }), el("span", { text: show.rerollHint })]) : null;
  if (skillNode) {
    camera.append(skillNode);
    // ロゴの絵が読めない時は、文字の「SKILL!」に戻す。
    const skillLogo = skillNode.querySelector(".trpg-rs-skill-logo"), skillWho = skillNode.querySelector(".trpg-rs-skill-kicker > small");
    skillLogo?.addEventListener?.("error", () => { skillLogo.hidden = true; skillWho.textContent = "SKILL!  " + skillWho.textContent; });
  }
  if (hintNode) camera.append(hintNode);
  const rays = tone === "success" || tone === "critical" ? el("i.trpg-rs-rays") : null;
  const lines = el("i.trpg-rs-lines"), vignette = el("i.trpg-rs-vignette"), tint = el("i.trpg-rs-tint");
  const burst = el("div.trpg-rs-burst"), flash = el("i.trpg-rs-flash");
  const hint = el("small.trpg-rs-skip", { text: "タップでスキップ" });
  const fitBox = el("div.trpg-rs-fit", [camera]);
  const node = el("div.trpg-roll-show", { "aria-hidden": "true", dataset: { grade, special, tone, phase: "throw", ...(thrown === null ? {} : { thrown: String(thrown) }) } },
    [el("i.trpg-rs-veil"), tint, rays, lines, fitBox, vignette, burst, flash, hint]);

  const animate = (target, frames, options) => {
    if (!target) return null;
    // 1文字の札（.c）の動きは、終わったら効果を残さない。残すと字ごとに重ね順の箱ができ、縁が隣の字の塗りにかぶる。
    const animation = target.animate(frames, { fill: target.classList?.contains("c") ? "backwards" : "both", ...options });
    animations.push(animation);
    return animation;
  };
  const after = (ms, fn) => { timers.push(setTimeout(() => { if (!done) fn(); }, ms)); };
  function cleanup() {
    done = true; handle.playing = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
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
  // 幕（ステージの単位）が 1280×720 より小さい時は、枠ごと縮めて画面の外へ出さない。
  const fit = Math.min(1, (node.clientWidth || 1280) / 1280, (node.clientHeight || 720) / 720);
  if (fit < 1) fitBox.style.transform = `scale(${fit})`;
  after(320, () => { armed = true; });

  // ---- 立体のダイス（TRF36・dice3d.js） ----
  // 最後の姿勢（出目の面がこちらを向く）から、軸まわりに何回転かさせた姿勢で投げ、着地でちょうど最後の姿勢に戻す。
  // Canvas が使えない環境では null のまま、これまでの絵（d20-rest／d20-tumble）で見せる。
  const pixelRatio = (typeof devicePixelRatio === "number" ? devicePixelRatio : 1) * (node.getBoundingClientRect?.().width / (node.offsetWidth || 1) || 1) * fit;
  const solids = dieNodes.map((die, i) => {
    const d3 = createD20(die.querySelector(".trpg-rs-d3"));
    if (!d3) {
      die.querySelector(".trpg-rs-spin").prepend(el("span.trpg-rs-body"));
      return null;
    }
    d3.resize(SIZE, pixelRatio);
    die.dataset.render = "3d";
    const solid = { d3, R: restPose(dice[i]), axis: randomAxis(), turns: (i ? -1 : 1) * Math.PI * (6 + Math.random() * 3), progress: () => 1 };
    d3.draw(pose(solid.R, solid.axis, solid.turns));
    return solid;
  });

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
  const zooms = [];
  function zoom(scale, ms, origin = "50% 50%", easing = EASE.out) {
    if (still) return;
    camera.style.transformOrigin = origin;
    zooms.push(animate(camera, [{ scale: String(camScale) }, { scale: String(scale) }], { duration: ms, easing }));
    camScale = scale;
  }
  /** 寄りを全部やめて等倍へ戻す。寄ったまま残ると、画面の左右が切れる。 */
  function unzoom() {
    for (const animation of zooms.splice(0)) { try { animation?.cancel(); } catch { /* already gone */ } }
    camScale = 1;
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
    const solid = solids[i];
    if (solid) {
      solid.d3.tone(hot ? "critical" : cold ? "fumble" : "ivory");
      solid.d3.draw(solid.R);
      solid.atRest = true;
      if (!quiet) animate(die.querySelector(".trpg-rs-d3"), [{ filter: "brightness(1.9)" }, { filter: "brightness(1)" }], { duration: big ? 420 : 300, easing: "ease-out", fill: "none" });
    }
    if (quiet) return;
    const num = die.querySelector(".trpg-rs-num");
    animate(num, [{ opacity: 0, filter: "brightness(3) blur(3px)" }, { opacity: 1, filter: "brightness(1.8) blur(0px)", offset: .35 }, { opacity: 1, filter: "brightness(1) blur(0px)" }],
      { duration: big ? 420 : 320, easing: "ease-out" });
    animate(die.querySelector(".trpg-rs-spin"), [{ scale: "1.22 .78" }, { scale: ".92 1.1", offset: .45 }, { scale: "1 1" }], { duration: 260, easing: EASE.soft, fill: "none" });
    animate(die.querySelector(".trpg-rs-ring"), [{ opacity: 1, scale: ".3" }, { opacity: 0, scale: hot ? "3.6" : big ? "2.8" : "2.1" }],
      { duration: hot ? 760 : 480, easing: EASE.out });
    sparks(die, count(hot ? 22 : big ? 14 : 9), hot ? ["#ffe08a", "#fff", "#ffb84a"] : cold ? ["#8ea2c4", "#c9d6ee"] : ["#fff3c9", "#ffd76a"], hot ? [160, 320] : [110, 220]);
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
  if (!show.seamless) {
    animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "linear" });
    animate(node.querySelector(".trpg-rs-veil"), [{ clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" }, { clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" }], { duration: 300, easing: EASE.out });
  }
  animate(lines, [{ opacity: 0 }, { opacity: .32, offset: .3 }, { opacity: .14 }], { duration: 900, easing: "ease-out" });
  animate(head, [{ opacity: 0, transform: "translateX(-120px) skewX(-20deg)" }, { opacity: 1, transform: "none" }], { duration: 360, delay: 80, easing: EASE.out });
  animate(goalNode, [{ opacity: 0, scale: "2.4", rotate: "20deg" }, { opacity: 1, scale: "1", rotate: "0deg" }], { duration: 380, delay: 200, easing: EASE.back });
  animate(hint, [{ opacity: 0 }, { opacity: .75 }], { duration: 300, delay: 600 });
  // カットインの間は印を立てる（この間はサイコロの間の「＋」を隠す。VPG33）
  if (skillNode) { node.dataset.cutin = "true"; playSkill(); }
  after(lead, main);

  /** スキル発動のカットイン: 金の帯が斜めに走り、使った人の顔と技の名前が叩きつけられる。ダイスはその後に投げ込まれる。 */
  function playSkill() {
    sound("skill");
    animate(skillNode, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration: lead + 120, easing: "linear" });
    // 帯は真ん中から左右へ伸び、顔と文字は1つの塊のまま入る（部品ごとに別々に動かすと、止まった時に並びがずれて見えた）。
    animate(skillNode.querySelector(".trpg-rs-skill-band"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 240, easing: EASE.out });
    animate(skillNode.querySelector(".trpg-rs-skill-inner"), [{ opacity: 0, translate: "-120px 0" }, { opacity: 1, translate: "0 0" }], { duration: 300, delay: 90, easing: EASE.out });
    after(330, () => { shake(8, 260, .6); blink(["#fff", "#2a1600", "#fff4c2"], 260, .5); });
    animate(lines, [{ opacity: .1 }, { opacity: .55 }, { opacity: .14 }], { duration: lead, easing: "ease-out" });
  }

  function main() {
  delete node.dataset.cutin;
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
    if (die.dataset.render !== "3d") animate(die.querySelector(".trpg-rs-spin"), spins.map(([t, r]) => ({ offset: t / end, rotate: r + "deg" })), { duration: end, easing: "linear" });
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
    // 立体のダイスの回り方: 宙では速く、「ため」の間はゆっくり、叩きつけでまた速くなって、着地の瞬間に出目の面で止まる。
    if (solids[last]) {
      const h1 = hoverAt + hover;
      solids[last].progress = t => t <= hoverAt ? .55 * (1 - (1 - t / hoverAt) ** 2)
        : t <= h1 ? .55 + .1 * (t - hoverAt) / hover
        : t < slamAt ? .65 + .35 * (1 - (1 - (t - h1) / (slamAt - h1)) ** 1.5) : 1;
      solids[last].landAt = slamAt;
    }
    // 宙で「ため」ている間は、コマ送りもゆっくり（スローモーション）。叩きつける直前に速さが戻る。
    after(hoverAt, () => { if (dieNodes[last].dataset.state === "tumbling") dieNodes[last].dataset.state = "hover"; });
    after(hoverAt + hover, () => { if (dieNodes[last].dataset.state === "hover") dieNodes[last].dataset.state = "tumbling"; });
  }

  if (solids[first]) {
    if (thrown === null) {
      solids[first].progress = t => t >= firstRest ? 1 : 1 - (1 - t / firstRest) ** 2.4;
      solids[first].landAt = firstRest;
    } else solids[first].progress = () => 1;
  }
  // 投げ込みからの経過時間で回す。performance.now と rAF の時刻はデバッグの倍速にも一緒に追従する。
  if (solids.some(Boolean)) {
    const t0 = performance.now();
    const frame = now => {
      frameId = null;
      if (done) return;
      const t = Math.max(0, now - t0);
      let moving = false;
      for (const solid of solids) {
        if (!solid) continue;
        const e = Math.min(1, Math.max(0, solid.progress(t)));
        let theta = solid.turns * (1 - e), axis = solid.axis;
        const after = solid.landAt != null ? t - solid.landAt : -1;
        if (after >= 0 && after < 360) { theta = .1 * Math.sin(after / 360 * Math.PI * 3) * (1 - after / 360); axis = [1, 0, 0]; }
        if (e < 1 || (after >= 0 && after < 360)) moving = true;
        // 先に止まったダイスと、振り直しで残したダイスは同じ絵を保つ。
        if (theta || !solid.atRest) solid.d3.draw(pose(solid.R, axis, theta));
        solid.atRest = theta === 0;
      }
      if (moving) frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
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
      const from = camScale;
      unzoom();
      camera.style.transformOrigin = `${REST[last][0]}px ${REST[last][1]}px`;
      zooms.push(animate(camera, [{ scale: String(from) }, { scale: "1.13", offset: .25 }, { scale: ".98", offset: .7 }, { scale: "1" }], { duration: 420, easing: EASE.out, fill: "backwards" }));
      after(440, unzoom);
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
    sparks(meter, count(12), ["#ffe08a", "#fff", "#ffb84a"], [60, 140]);
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
    const logo = verdictLogo.complete && verdictLogo.naturalWidth > 0;
    animate(verdict, [{ opacity: 0 }, { opacity: 1 }], { duration: 60 });
    if (logo) {
      verdict.dataset.logo = "true";
      slamLogo();
      chars.forEach((c, n) => animate(c, [{ opacity: 0, translate: "0 16px" }, { opacity: 1, translate: "0 0" }], { duration: 200, delay: 360 + n * 28, easing: EASE.out }));
    }
    // 中央寄せ（CSS の translate: -50% -50%）を保ったまま、右から入って少しずつ流れる。
    animate(verdictMega, [{ opacity: 0, translate: "-30% -50%" }, { opacity: 1, translate: "-50% -50%", offset: .25 }, { opacity: 1, translate: "-53% -50%" }], { duration: 2200, easing: EASE.out });
    // サイコロは少し退いて、言葉を主役に（合計とゲージは届いたかを見せるので、そのまま）。
    // スマホではぼかしを省き、暗くするだけにする（ぼかしの再描画が一番重い）。
    for (const part of [...dieNodes, ...plus, chip, needNode]) {
      animate(part, lite ? [{ filter: "brightness(1)" }, { filter: "brightness(.5)" }]
        : [{ filter: "brightness(1) blur(0px)" }, { filter: "brightness(.5) blur(2px)" }], { duration: 260, easing: "ease-out" });
    }
    dieNodes.forEach(die => animate(die, [{ scale: "1" }, { scale: ".9" }], { duration: 320, easing: EASE.out }));
    animate(tint, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
    if (logo) {
      // 動きは slamLogo() が付けた。光と後光だけここで。
      if (tone === "critical" || tone === "success") animate(rays, [{ opacity: 0, scale: ".3" }, { opacity: tone === "critical" ? 1 : .75, scale: "1.1" }], { duration: 500, easing: EASE.out });
    } else if (tone === "critical") {
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
          { duration: 700, delay: 760 + n * 70, easing: "cubic-bezier(.5,0,.8,.4)", composite: "add", fill: "both" });
      });
      after(120, () => { shake(18, 560, .8); blink(["#000", "#c9d6ee", "#000", "#3b4a63"], 520, .8); sound("boom"); });
      if (!still) animate(camera, [{ rotate: "0deg" }, { rotate: "2.6deg" }], { duration: 1400, delay: 500, easing: EASE.soft });
    }
    // ロゴの時は札を読みの右に置く（CSS の translate を保つため、動きは大きさと濃さだけ）。
    if (verdictSub) animate(verdictSub, logo ? [{ opacity: 0, scale: ".6" }, { opacity: 1, scale: "1" }] : [{ opacity: 0, translate: "0 24px", scale: ".6" }, { opacity: 1, translate: "0 0", scale: "1" }],
      { duration: 280, delay: logo ? 520 : chars.length * 50 + 200, easing: EASE.back });
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
  /** ロゴを評価ごとの動きで叩きつける。クリティカルは回りながら巨大な所から、ファンブルは出たあとにずり落ちて傾く。 */
  function slamLogo() {
    const L = verdictLogo;
    if (tone === "critical") {
      animate(L, [{ opacity: 0, scale: "4", rotate: "-24deg" }, { opacity: 1, scale: ".9", rotate: "3deg", offset: .7 }, { opacity: 1, scale: "1", rotate: "0deg" }], { duration: 460, easing: EASE.out });
      after(300, () => { shake(26, 700, .55); blink(["#fff", "#3a2000", "#fff6cf", "#ffe08a"], 440, .78); sound("boom"); });
      animate(L, [{ scale: "1" }, { scale: "1.05" }, { scale: "1" }], { duration: 900, delay: 700, iterations: 2, easing: "ease-in-out", composite: "add", fill: "none" });
    } else if (tone === "success") {
      animate(L, [{ opacity: 0, scale: "3", translate: "0 -80px" }, { opacity: 1, scale: ".92", translate: "0 6px", offset: .7 }, { opacity: 1, scale: "1", translate: "0 0" }], { duration: 340, easing: EASE.out });
      after(240, () => { shake(14, 480, .5); blink(["#fff", "#120c00", "#fff7d6"], 300, .6); });
    } else if (tone === "mixed") {
      animate(L, [{ opacity: 0, translate: "420px 0", rotate: "8deg" }, { opacity: 1, translate: "-14px 0", rotate: "-2deg", offset: .75 }, { opacity: 1, translate: "0 0", rotate: "0deg" }], { duration: 380, easing: EASE.out });
      after(300, () => shake(7, 300, .3));
    } else if (tone === "trouble") {
      animate(L, [{ opacity: 0, translate: "0 -560px", rotate: "0deg" }, { opacity: 1, translate: "0 0", rotate: "0deg", offset: .5, easing: "ease-out" },
        { translate: "0 -44px", rotate: "-2deg", offset: .68, easing: "ease-in" }, { translate: "0 0", rotate: "3deg", offset: .84 }, { opacity: 1, translate: "0 0", rotate: "5deg" }],
      { duration: 760, easing: "cubic-bezier(.5,0,1,.6)" });
      after(380, () => shake(12, 420, 1));
      if (!still) animate(camera, [{ rotate: "0deg" }, { rotate: "-1.6deg" }], { duration: 700, delay: 300, easing: EASE.out });
    } else if (tone === "fumble") {
      // 出た直後は堂々としているのに、悪魔のささやきでずり落ちて傾く。
      animate(L, [{ opacity: 0, scale: "1.7" }, { opacity: 1, scale: "1" }], { duration: 220, easing: EASE.out });
      animate(L, [{ translate: "0 0", rotate: "0deg" }, { translate: "-6px 34px", rotate: "-7deg" }], { duration: 900, delay: 800, easing: "cubic-bezier(.5,0,.6,1.4)" });
      after(120, () => { shake(18, 560, .8); blink(["#000", "#c9d6ee", "#000", "#3b4a63"], 520, .8); sound("boom"); });
      if (!still) animate(camera, [{ rotate: "0deg" }, { rotate: "2.6deg" }], { duration: 1400, delay: 500, easing: EASE.soft });
    }
  }
  /** 評価ごとの紙吹雪: 成功は中央から弾け、クリティカルは左右の下から噴き上がる。うまくいかない時は、静かに降るだけ。 */
  function confetti() {
    const colors = CONFETTI[tone], pieces = [];
    const add = (count, make) => { for (let n = 0; n < count; n++) pieces.push(make(n, count)); };
    if (tone === "success" || tone === "critical") {
      add(count(tone === "critical" ? 64 : 52), () => { const a = rand(0, Math.PI * 2), r = rand(220, 700); return { x: 50, y: 48, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .6 - 140, fall: rand(160, 360) }; });
      if (tone === "critical") for (const side of [-1, 1]) add(count(42), () => ({ x: side < 0 ? 3 : 97, y: 104, dx: -side * rand(120, 700), dy: -rand(380, 760), fall: rand(300, 560), late: rand(250, 700) }));
    } else if (tone === "mixed") {
      add(count(18), () => { const a = rand(Math.PI, Math.PI * 2), r = rand(140, 340); return { x: 50, y: 50, dx: Math.cos(a) * r, dy: Math.sin(a) * r * .7, fall: rand(60, 160) }; });
    } else {
      // 落ちてくる冷たい雨。
      add(count(tone === "fumble" ? 46 : 26), () => ({ x: rand(2, 98), y: -6, dx: rand(-30, 10), dy: rand(420, 760), fall: 0, late: rand(0, 900), rain: true }));
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
  // 「振り直せる！」の札が出る時は、読めるよう1秒長く残す（同上）
  const hold = (special === "critical" ? 2300 : grade === "success" ? 1800 : special === "fumble" ? 2100 : 1500) + (hintNode ? 1000 : 0);
  const endAt = verdictAt + hold;
  if (!show.keepUp) after(endAt - 240, () => animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-in" }));
  after(endAt, () => handle.skip());
  }
  return handle;
}

/**
 * 劇場の中でスキルを使うか選ぶ（VPG29。2026-11-27 オーナー「スキルはダイス劇場内で発動選ぶ」。縦の試作から横の本編にも当てた）。
 * 劇場と同じ幕・見出し・目標の盾の上に、選ぶ札を置いて、押されるまで待つ。投げる前（助力を使うか）と、
 * 出目が出た後（振り直すか）の両方に使う。判定・確率・回数は呼び出し側が決めた値をそのまま書き、ここでは何も決めない。
 * @param host 判定の窓を載せている幕（.trpg-overlay）
 * @param opts { title, who, goal, dice: [a, b] | null（投げる前は null）, total, bonus, bonusParts: 補正の内訳（例 ["手際＋2", "助力＋7"]）, label: 評価の一言, tone,
 *               prompt: 問いかけの一言, choices: [{ face: Node, owner, name, text, odds, test }], keep: { text, test },
 *               onPick(index), onKeep() }
 * @returns { node, cancel() } 。押す・やめるのどちらかで片付き、onPick / onKeep を一度だけ呼ぶ。
 */
export function showRollChoice(host, opts) {
  const { goal = 30, dice = null, tone = "" } = opts;
  let done = false;
  const finish = fn => () => { if (done) return; done = true; cleanup(); fn(); };
  const head = el("header.trpg-rs-head", [el("strong", { text: opts.title || "" }), opts.who ? el("span", { text: opts.who }) : null].filter(Boolean));
  const goalNode = el("div.trpg-rs-goal", [el("b", { text: String(goal) }), el("span", { text: "以上で成功" })]);
  // 出目（出た後）か、まだ投げていない2個のサイコロ
  const dieNodes = [0, 1].map(i => {
    const value = dice ? dice[i] : 20;
    const die = el("div.trpg-rs-die", { dataset: { i: String(i), state: "rest", landed: dice ? "true" : "false" }, style: { left: REST[i][0] - SIZE / 2 + "px", top: REST[i][1] - SIZE / 2 + "px" } }, [
      el("i.trpg-rs-shadow"), el("div.trpg-rs-spin", [el("canvas.trpg-rs-d3")]),
      el("b.trpg-rs-num", { text: dice ? String(value) : "?", dataset: { digits: dice ? String(String(value).length) : "1" } }),
    ]);
    return { die, value };
  });
  // 出目の後は、合計が出目と補正の足し算だと分かる式を出す（2026-11-27 オーナー「ダイスが19と1で29になってるけどバグ？」VPG30）。
  // 劇場の本体と同じく、2つのサイコロの間に「＋」、補正は真鍮の丸（何が足されたか＋N）で。
  const bonus = Number(opts.bonus) || 0, parts = Array.isArray(opts.bonusParts) ? opts.bonusParts : [];
  const plus = dice ? el("span.trpg-rs-plus.a.trpg-rs-choice-plus", { text: "+", "aria-hidden": "true" }) : null;
  const verdict = dice ? el("div.trpg-rs-choice-verdict", { dataset: { tone }, "aria-label": dice[0] + " ＋ " + dice[1] + (bonus ? " ＋ 補正" + bonus : "") + " ＝ 合計 " + opts.total + (opts.label ? "。" + opts.label : "") }, [
    el("div.trpg-rs-choice-eq", { dataset: { test: "trpg-show-equation" } }, [
      el("span.trpg-rs-eq-num", { text: String(dice[0]) }), el("i", { text: "＋" }), el("span.trpg-rs-eq-num", { text: String(dice[1]) }),
      bonus ? el("i", { text: "＋" }) : null,
      bonus ? el("span.trpg-rs-eq-chip", [el("small", { text: parts.length ? parts.join("・\u200b") : "補正" }), el("b", { text: String(bonus) })]) : null, // 折れる時は「・」の後だけ
      el("i", { text: "＝" }),
      el("strong", { text: String(opts.total) }),
    ].filter(Boolean)),
    opts.label ? el("span.trpg-rs-choice-label", { text: String(opts.label) }) : null,
  ].filter(Boolean)) : null;
  const cards = opts.choices.map((choice, index) => el("button.trpg-rs-pick", { type: "button", dataset: { test: choice.test }, onclick: finish(() => opts.onPick(index)) }, [
    el("span.trpg-rs-pick-face", { "aria-hidden": "true" }, choice.face ? [choice.face] : []),
    el("span.trpg-rs-pick-copy", [
      el("small", [el("b", { text: "SKILL" }), (choice.owner || "") + "の「" + (choice.name || "") + "」"]),
      el("strong", { text: choice.text }),
    ]),
    el("em.trpg-rs-pick-odds", { text: choice.odds || "" }),
  ]));
  const keep = el("button.trpg-rs-keep", { type: "button", dataset: { test: opts.keep?.test || "trpg-show-keep" }, onclick: finish(() => opts.onKeep()) }, [opts.keep?.text || "このまま"]);
  // data-picks: 札の数（横の舞台は、札と「このまま」を1列に並べる。trpg-roll-show.css）
  const panel = el("div.trpg-rs-choose", { role: "group", "aria-label": opts.prompt || "スキル", dataset: { picks: String(cards.length) } }, [el("p.trpg-rs-choose-prompt", { text: opts.prompt || "" }), ...cards, keep]);
  const camera = el("div.trpg-rs-camera", [head, goalNode, ...dieNodes.map(d => d.die), plus, verdict, panel].filter(Boolean));
  const node = el("div.trpg-roll-show.trpg-rs-choosing", { dataset: { phase: "choose", tone, rolled: String(!!dice) } },
    [el("i.trpg-rs-veil"), el("i.trpg-rs-lines"), el("div.trpg-rs-fit", [camera]), el("i.trpg-rs-vignette")]);
  function onKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault(); event.stopPropagation();
    keep.click();
  }
  function cleanup() { host.removeEventListener("keydown", onKey, true); node.remove(); }
  host.addEventListener("keydown", onKey, true);
  host.append(node);
  const fit = Math.min(1, (node.clientWidth || 1280) / 1280, (node.clientHeight || 720) / 720);
  if (fit < 1) node.querySelector(".trpg-rs-fit").style.transform = `scale(${fit})`;
  // 立体のダイス（劇場と同じ絵）。投げる前は、20の面を少し傾けて置いておく
  const pixelRatio = (typeof devicePixelRatio === "number" ? devicePixelRatio : 1) * fit;
  dieNodes.forEach(({ die, value }, i) => {
    const d3 = createD20(die.querySelector(".trpg-rs-d3"));
    if (!d3) { die.querySelector(".trpg-rs-spin").prepend(el("span.trpg-rs-body")); return; }
    d3.resize(SIZE, pixelRatio);
    die.dataset.render = "3d";
    d3.draw(dice ? restPose(value) : pose(restPose(value), randomAxis(), (i ? -1 : 1) * .5));
  });
  if (typeof node.animate === "function") {
    cards.forEach((card, n) => card.animate([{ opacity: 0, translate: "0 40px" }, { opacity: 1, translate: "0 0" }], { duration: 260, delay: 80 + n * 70, easing: EASE.back, fill: "backwards" }));
  }
  (cards[0] || keep).focus?.({ preventScroll: true });
  return { node, cancel() { if (!done) { done = true; cleanup(); } } };
}
