// バイトのシフト終了（tonari.js・remake_baito_end の前）。OPEN の札が裏返って CLOSED。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- a: バイトの終わり: 吊り札が下りて揺れ、くるっと回って CLOSED

const SHIFT = { bg: "#173326", deep: "#0c1c14", main: "#2f9e6b", mid: "#e5484d", light: "#fff3d6", white: "#ffffff" };
const MONO_CLOSED = "#4f3596"; // 紫1色の CLOSED の面（OPEN より濃い紫）

export async function a() {
  const P = pick(SHIFT, { mid: MONO_CLOSED });
  await stagePlay("shift", async (node) => {
    const back = backdrop(`${P.bg}d9`);
    const fxArt = stageSvg();
    const face = (cls, label, bg, fg, border) => el(`div.mo-sign-face.${cls}`, { style: { background: bg, color: fg, borderColor: border } }, [el("small", { text: "tonari" }), el("b", { text: label })]);
    const flip = el("div.mo-sign-flip", [face("open", "OPEN", P.light, P.main, P.main), face("closed", "CLOSED", P.mid, P.light, P.light)]);
    const pop = el("div.mo-sign-pop", [flip]);
    const sign = el("div.mo-sign", { style: { "--s": P.light } }, [el("i.mo-sign-string"), pop]);
    node.append(back, sign, fxArt);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 240);
    // 1. 吊り札が下りて、揺れながら止まる
    await move(sign, [{ transform: "translate(-50%, -560px) rotate(0deg)" }, { transform: "translate(-50%, 0) rotate(0deg)" }], 520, { easing: E.back });
    await move(sign, [{ transform: "translate(-50%, 0) rotate(0deg)" }, { transform: "translate(-50%, 0) rotate(7deg)" }, { transform: "translate(-50%, 0) rotate(-4deg)" }, { transform: "translate(-50%, 0) rotate(2deg)" }, { transform: "translate(-50%, 0) rotate(0deg)" }], 760, { easing: "ease-out" });
    // 2. くるっと1回半まわって裏の CLOSED へ
    SE.whoosh();
    await move(flip, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(540deg)" }], 900, { easing: E.inOut });
    SE.select();
    ring(fxArt, W / 2, 350, { r: 260, color: P.light, width: 8 });
    burst(fxArt, W / 2, 350, { n: 12, r0: 230, r1: 320, color: P.light, width: 6 });
    await move(pop, [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], 360, { easing: E.back });
    await sleep(650);
    // 3. 退場
    move(back, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 120 });
    await move(sign, [{ transform: "translate(-50%, 0)" }, { transform: "translate(-50%, -580px)" }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b() {
  return a();
}
