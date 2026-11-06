// A5 第4章 前夜祭「龍の煙」（#2688・#2735）。王煙楼の台から、煙のリボンがS字に二度うねって輪になり、
// 金の縁取りで一瞬止まってから散る。約1.8秒。顔・鱗は描かない抽象形（CI122）。輪＝達成（CI101）の変形。
// 台本の「長い呼吸から、龍のような煙が立ち上がる。」の直後に {"type":"motion","id":"dragon_smoke"} で出す。
// 動きを減らす設定では、輪の形の煙の薄いフェードだけ。
import { sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E, MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const GOLD = "#f0c66e";
const RING = { x: 650, y: 300, r: 150 };
// 台の位置（下）からS字に二度うねって輪の左上へ入り、そのまま一周する
const RIBBON = "M 600 800 C 380 690, 900 610, 690 520 C 470 430, 420 330, 520 225"
  + " A 150 150 0 1 1 780 375 A 150 150 0 1 1 520 225";

export async function play({ pace = 1, still = false } = {}) {
  await stagePlay("dragon-smoke", async (node) => {
    const t = (ms) => Math.round(ms * pace);
    const veil = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.ink, opacity: 0 });
    const defs = svg("defs", {}, [
      svg("filter", { id: "mo-dragon-soft", x: "-30%", y: "-30%", width: "160%", height: "160%" }, [svg("feGaussianBlur", { stdDeviation: 12 })]),
      svg("filter", { id: "mo-dragon-edge", x: "-10%", y: "-10%", width: "120%", height: "120%" }, [svg("feGaussianBlur", { stdDeviation: 1.6 })]),
    ]);
    const ribbon = (width, color, opacity, filter) => svg("path", {
      d: RIBBON, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round",
      opacity, filter: `url(#${filter})`, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1,
    });
    const body = ribbon(46, MONO.mid, 0.55, "mo-dragon-soft");
    const core = ribbon(12, MONO.white, 0.95, "mo-dragon-edge");
    const gold = svg("circle", { cx: RING.x, cy: RING.y, r: RING.r + 26, fill: "none", stroke: GOLD, "stroke-width": 5, opacity: 0, class: "tr-scale" });
    const smoke = svg("g", { class: "tr-scale" }, [body, core]);
    node.append(stageSvg([defs, veil, smoke, gold]));
    if (still) {
      [body, core].forEach((p) => p.setAttribute("stroke-dashoffset", 0));
      move(veil, [{ opacity: 0 }, { opacity: 0.4, offset: 0.4 }, { opacity: 0 }], 900, { easing: "linear" });
      await move(smoke, [{ opacity: 0 }, { opacity: 0.8, offset: 0.4 }, { opacity: 0 }], 900, { easing: "linear" });
      return;
    }
    // 1. 客席が少し暗くなり、台から煙が立ちのぼってS字に二度うねり、輪になる
    move(veil, [{ opacity: 0 }, { opacity: 0.42 }], t(260), { easing: "linear" });
    SE.whoosh();
    const draw = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];
    move(body, draw, t(900), { easing: "cubic-bezier(.35,.05,.25,1)" });
    await move(core, draw, t(900), { easing: "cubic-bezier(.35,.05,.25,1)" });
    // 2. 金の縁取りで一瞬止まる
    await move(gold, [{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "scale(1)" }], t(180), { easing: E.out });
    await sleep(t(240));
    // 3. 散る: 輪はほどけて広がり、煙は上へ薄れる
    move(gold, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.35)" }], t(420), { easing: E.out });
    move(smoke, [{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(-40px) scale(1.12)" }], t(460), { easing: E.out });
    await move(veil, [{ opacity: 0.42 }, { opacity: 0 }], t(460), { easing: "linear" });
  });
}
