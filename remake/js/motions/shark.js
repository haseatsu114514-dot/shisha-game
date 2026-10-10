// サメちゃんとの夜道の出会い（kafuka.js の playKafukaEncounter）。覆っている間に mid() で SHISHARK の店先へ替える。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

/** サメちゃんの色（SHISHARK の看板の青・歯ぐきの桃色）。紫1色は濃淡だけで同じ役割を描く */
const SHARK = { skin: "#3d82e6", shade: "#2457ad", belly: "#eaf6ff", bellyShade: "#bcdcf7", gum: "#ff8fb0", tooth: "#ffffff", throat: "#5c1d47", line: "#d6f3ff" };
const MONO_SHARK = { skin: "#6b4fb0", shade: "#4f3596", belly: "#ded3f7", bellyShade: "#b9a8e6", gum: "#9a82d8", tooth: "#f7f3ff", throat: "#150e30", line: "#ded3f7" };

/** 丸みのある三角の歯（根元が y=0、先が +y へ len） */
const tooth = (hw, len, color) => svg("path", {
  d: `M ${-hw} 0 Q ${-hw * 0.82} ${len * 0.55} 0 ${len} Q ${hw * 0.82} ${len * 0.55} ${hw} 0 Z`,
  fill: color, stroke: color, "stroke-width": 6, "stroke-linejoin": "round",
});

// ---------------------------------------------------------------- a: がぶり: 上下のあごがのぞき、ひと呼吸開いてから閉じる。もぐもぐの間に店先へ替え、大きく開いて去る

const GAP = 152; // 歯の間隔

/** 上あご（歯ぐきの縁が y=0、上へ画面の外まで）。lower は下あご用: 白いおなかの色で、歯を半分ずらす（上下は呼び出し側で返す） */
function jaw(P, lower) {
  const xs = [];
  for (let x = -GAP + (lower ? GAP / 2 : 0); x < W + GAP; x += GAP) xs.push(x);
  const teeth = xs.map((x) => svg("g", { transform: `translate(${x} -14)` }, [tooth(48, 96, P.tooth)]));
  const [skin, shade] = lower ? [P.belly, P.bellyShade] : [P.skin, P.shade];
  // 歯ぐき: 歯の上で丸くふくらむ縁
  let gum = `M ${xs[0] - GAP / 2} -46 L ${xs[0] - GAP / 2} -4`;
  for (const x of xs) gum += ` Q ${x} 26 ${x + GAP / 2} -4`;
  gum += ` L ${xs[xs.length - 1] + GAP / 2} -46 Z`;
  return svg("g", {}, [
    svg("rect", { x: -GAP * 2, y: -H - 200, width: W + GAP * 4, height: H + 160, fill: skin }),
    svg("rect", { x: -GAP * 2, y: -62, width: W + GAP * 4, height: 22, fill: shade }),
    ...teeth,
    svg("path", { d: gum, fill: P.gum }),
    svg("line", { x1: -GAP * 2, y1: -76, x2: W + GAP * 2, y2: -76, stroke: lower ? shade : P.line, "stroke-width": 4, "stroke-dasharray": "2 18", "stroke-linecap": "round", opacity: 0.6 }),
  ]);
}

export async function a(mid) {
  const P = pick(SHARK, MONO_SHARK);
  await stagePlay("shark", async (node) => {
    const cy = H / 2, shut = 34; // 閉じたときの歯ぐきの縁（中心から上下に）
    // 閉じている間だけ、歯のすき間を口の中の色でふさぐ
    const seal = svg("rect", { x: -80, y: cy - 70, width: W + 160, height: 140, fill: P.throat, opacity: 0 });
    const top = svg("g", {}, [jaw(P, false)]);
    const bottom = svg("g", {}, [svg("g", { transform: "scale(1 -1)" }, [jaw(P, true)])]);
    const fx = svg("g");
    const art = stageSvg([seal, top, bottom, fx]);
    const chars = [..."がぶっ！"].map((ch) => el("span.mo-gabu-ch", { text: ch }));
    const word = el("div.mo-gabu", { style: { color: P.tooth, "--o": P.shade } }, chars);
    node.append(art, word);
    // 上下のあごの縁の位置を記録しながら動かす
    const pos = { up: -150, low: H + 150 };
    const place = (y) => ({ transform: `translateY(${y}px)` });
    top.style.transform = `translateY(${pos.up}px)`;
    bottom.style.transform = `translateY(${pos.low}px)`;
    const bite = (up, low, ms, easing) => {
      const from = { ...pos };
      Object.assign(pos, { up, low });
      return Promise.all([
        move(top, [place(from.up), place(up)], ms, { easing }),
        move(bottom, [place(from.low), place(low)], ms, { easing }),
      ]);
    };
    // 1. 上下からあごがのぞく
    SE.whoosh();
    await bite(150, H - 150, 420, E.out);
    // 2. ひと呼吸、もう少し大きく開く（ため）
    await bite(96, H - 96, 260, "cubic-bezier(.25,.1,.25,1)");
    // 3. がぶっと閉じる。揺れ・放射線・文字
    await bite(cy - shut, cy + shut, 150, E.in);
    seal.setAttribute("opacity", 1);
    SE.hit();
    SE.punch();
    move(art, [{ transform: "translate(0,0)" }, { transform: "translate(12px,-8px)" }, { transform: "translate(-9px,6px)" }, { transform: "translate(6px,-3px)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }], 340, { easing: "linear" });
    burst(fx, W / 2, cy, { n: 12, r0: 110, r1: 230, color: P.line, width: 7, dur: 520 });
    ring(fx, W / 2, cy, { r: 260, color: P.line, width: 8 });
    chars.forEach((c, i) => move(c, [
      { transform: "translateY(50px) scale(0) rotate(-24deg)" },
      { transform: `translateY(-6px) scale(1.18) rotate(${i % 2 ? 8 : -8}deg)`, offset: 0.6 },
      { transform: "translateY(0) scale(1) rotate(0deg)" },
    ], 380, { easing: E.out, delay: 40 + i * 55 }));
    await bite(cy - shut + 8, cy + shut - 8, 80, E.out);
    await bite(cy - shut, cy + shut, 120, E.out);
    // 4. 覆っている間: もぐもぐしながら店先へ替える
    const chew = async () => {
      await sleep(260);
      for (let i = 0; i < 2; i++) {
        await bite(cy - shut - 22, cy + shut + 22, 150, E.out);
        await bite(cy - shut, cy + shut, 120, E.in);
      }
    };
    await Promise.all([mid?.(), chew()]);
    // 5. 大きく開いて新しい場面を見せ（行きすぎて戻る）、上下へ去る
    move(word, [{ opacity: 1, transform: "translateX(-50%) rotate(-6deg) scale(1)" }, { opacity: 0, transform: "translateX(-50%) rotate(-6deg) scale(0.6)" }], 200, { easing: E.in });
    seal.setAttribute("opacity", 0);
    SE.whoosh();
    ring(fx, W / 2, cy, { r: 360, color: P.line, width: 6, dur: 700 });
    await bite(70, H - 70, 560, E.back);
    twinkle(fx, 300, 210, { size: 22, color: P.line, dur: 560 });
    twinkle(fx, 990, 520, { size: 18, color: P.line, delay: 60, dur: 540 });
    await sleep(240);
    await bite(-160, H + 160, 380, E.in);
  }, { cover: true });
}

// ---------------------------------------------------------------- b: 逆に開く: 背びれが横切って画面を塗り、サメちゃんの顔に。口が細い線から大きく開いて店先が見える

let serial = 0;
const MW = 440, HU = 120, HL = 230; // 口の半分の幅・上唇と下唇のふくらみ（開ききったとき）
const ZOOM = 7; // 口の中へ寄りきるときの倍率

/** 2次ベジェ上の点と向き（度） */
function onCurve(t, p0, c, p2) {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * t * u * c[0] + t * t * p2[0];
  const y = u * u * p0[1] + 2 * t * u * c[1] + t * t * p2[1];
  const dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]);
  const dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]);
  return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
}
/** ms の間、毎フレーム f(イージングした進み) を呼ぶ */
function tween(ms, ease, f) {
  return new Promise((done) => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      f(ease(p));
      if (p < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
}
const backOut = (p) => 1 + 2.4 * (p - 1) ** 3 + 1.4 * (p - 1) ** 2;

export async function b(mid) {
  const P = pick(SHARK, MONO_SHARK);
  await stagePlay("shark", async (node) => {
    const id = `mo-shark-${++serial}`;
    const cy = H / 2;
    // 1. 背びれが横切り、その後ろの楔形の面が画面を塗る（真ん中に切り込みの線）
    const reach = 560;
    const wake = svg("path", { d: `M ${-W - reach - 240} -80 L ${-reach} -80 L 0 ${cy} L ${-reach} ${H + 80} L ${-W - reach - 240} ${H + 80} Z`, fill: P.skin });
    const cut = svg("line", { x1: -W - reach - 240, y1: cy, x2: -40, y2: cy, stroke: P.throat, "stroke-width": 12, "stroke-linecap": "round" });
    const fin = svg("path", { d: "M 96 2 C 64 -96, -8 -172, -100 -210 C -74 -136, -92 -58, -166 2 Z", fill: P.line });
    const sweep = svg("g", {}, [wake, cut, svg("g", { transform: `translate(0 ${cy})` }, [fin])]);
    sweep.style.transform = "translateX(-90px)";
    const streaks = svg("g", { stroke: P.line, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85 });
    // 顔（口の中心が原点。寄るときの軸は口の中ほど）
    const box = { x: -1000, y: -700, width: 2000, height: 1400 };
    const hole = svg("path", { d: "", fill: "#000" });
    const field = svg("rect", { ...box, fill: P.skin, mask: `url(#${id})` });
    const teethU = Array.from({ length: 6 }, () => svg("g", {}, [tooth(26, 58, P.tooth)]));
    const teethL = Array.from({ length: 7 }, () => svg("g", {}, [tooth(24, 54, P.tooth)]));
    const gum = svg("path", { d: "", fill: "none", stroke: P.gum, "stroke-width": 26, "stroke-linejoin": "round", opacity: 0 });
    const slit = svg("line", { x1: -MW, y1: 0, x2: MW, y2: 0, stroke: P.throat, "stroke-width": 12, "stroke-linecap": "round", class: "tr-scale" });
    const eye = (x) => {
      const dot = svg("g", {}, [svg("circle", { r: 36, fill: P.throat }), svg("circle", { cx: 12, cy: -13, r: 12, fill: P.tooth })]);
      const smile = svg("path", { d: "M -34 10 Q 0 -34 34 10", fill: "none", stroke: P.throat, "stroke-width": 11, "stroke-linecap": "round", opacity: 0 });
      const g = svg("g", { class: "tr-scale" }, [dot, smile]);
      g.style.transform = "scale(0)";
      return { g, dot, smile, wrap: svg("g", { transform: `translate(${x} -215)` }, [g]) };
    };
    const eyes = [eye(-210), eye(210)];
    const blush = [-330, 330].map((x) => {
      const c = svg("ellipse", { cx: x, cy: -104, rx: 36, ry: 15, fill: P.gum, class: "tr-scale" });
      c.style.transform = "scale(0)";
      return c;
    });
    const face = svg("g", { transform: `translate(${W / 2} ${cy + 55}) scale(1) translate(0 -55)`, opacity: 0 }, [
      svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...box }, [svg("rect", { ...box, fill: "#fff" }), hole])]),
      field, ...teethU, ...teethL, gum, slit, ...eyes.map((e) => e.wrap), ...blush,
    ]);
    const fx = svg("g");
    node.append(stageSvg([face, sweep, streaks, fx]));
    /** 口の開き o（0＝細い線、1＝開ききり）と、寄りの倍率 s で描き直す */
    const draw = (o, s = 1) => {
      const hu = HU * o, hl = HL * o;
      const d = `M ${-MW} 0 Q 0 ${-2 * hu} ${MW} 0 Q 0 ${2 * hl} ${-MW} 0 Z`;
      hole.setAttribute("d", d);
      gum.setAttribute("d", d);
      const k = Math.max(0, Math.min(1, o * 1.6)); // 歯は口が開くにつれて生える
      teethU.forEach((t, i) => {
        const [x, y, r] = onCurve(0.1 + (0.8 * (i + 0.5)) / teethU.length, [-MW, 0], [0, -2 * hu], [MW, 0]);
        t.setAttribute("transform", `translate(${x} ${y}) rotate(${r}) scale(${k})`);
      });
      teethL.forEach((t, i) => {
        const [x, y, r] = onCurve(0.08 + (0.84 * (i + 0.5)) / teethL.length, [MW, 0], [0, 2 * hl], [-MW, 0]);
        t.setAttribute("transform", `translate(${x} ${y}) rotate(${r}) scale(${k})`);
      });
      face.setAttribute("transform", `translate(${W / 2} ${cy + 55}) scale(${s}) translate(0 -55)`);
    };
    draw(0);
    SE.whoosh();
    [[cy - 120, 180], [cy + 110, 300], [cy - 60, 430], [cy + 170, 520]].forEach(([y, at]) => setTimeout(() => {
      const x = 160 + at * 1.5;
      const line = svg("line", { x1: x, y1: y, x2: x - 220, y2: y, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
      streaks.append(line);
      move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 380, { easing: E.out }).then(() => line.remove());
    }, at));
    move(fin, [{ transform: "rotate(0deg)" }, { transform: "rotate(-8deg)", offset: 0.5 }, { transform: "rotate(0deg)" }], 760, { easing: "ease-in-out" });
    await move(sweep, [{ transform: "translateX(-90px)" }, { transform: `translateX(${W + reach + 90}px)` }], 760, { easing: "cubic-bezier(.5,0,.25,1)" });
    // 2. 覆った。切り込みの線が縮んで口になり、目とほっぺが出てまばたき（この間に店先へ替える）
    face.setAttribute("opacity", 1);
    sweep.remove();
    const greet = async () => {
      move(slit, [{ transform: "scaleX(1.6)" }, { transform: "scaleX(1)" }], 420, { easing: E.out });
      eyes.forEach((e, i) => move(e.g, [{ transform: "scale(0)" }, { transform: "scale(1)" }], 380, { easing: E.back, delay: 140 + i * 70 }));
      blush.forEach((c, i) => move(c, [{ transform: "scale(0)" }, { transform: "scale(1)" }], 360, { easing: E.back, delay: 260 + i * 70 }));
      await sleep(760);
      SE.tick();
      await Promise.all(eyes.map((e) => move(e.g, [{ transform: "scale(1, 1)" }, { transform: "scale(1.1, 0.12)" }, { transform: "scale(1, 1)" }], 200, { easing: "ease-in-out" })));
      await sleep(120);
    };
    await Promise.all([mid?.(), greet()]);
    // 3. 口がきゅっと締まってから（ため）、細い線から大きく開く。目はにっこり
    await move(slit, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.86)" }], 140, { easing: E.out });
    slit.remove();
    gum.setAttribute("opacity", 1);
    SE.punch();
    SE.select();
    eyes.forEach((e) => {
      e.dot.setAttribute("opacity", 0);
      e.smile.setAttribute("opacity", 1);
      move(e.g, [{ transform: "scale(1.3)" }, { transform: "scale(1)" }], 320, { easing: E.back });
    });
    burst(fx, W / 2, cy - 160, { n: 10, r0: 300, r1: 380, color: P.line, width: 6, dur: 520 });
    await tween(560, backOut, (o) => draw(o));
    twinkle(fx, 270, 150, { size: 22, color: P.line });
    twinkle(fx, 1010, 140, { size: 18, color: P.line, delay: 100 });
    await sleep(300);
    // 4. 口の中へ一気に寄って、顔が画面の外へ抜ける（倍率は掛け算で加速）
    SE.whoosh();
    await tween(560, (p) => p ** 3, (k) => draw(1, ZOOM ** k));
    face.remove();
    ring(fx, W / 2, cy, { r: 420, color: P.line, width: 8, dur: 520 });
    await sleep(540);
  }, { cover: true });
}
