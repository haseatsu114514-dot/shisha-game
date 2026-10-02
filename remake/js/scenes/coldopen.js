// コールドオープン（はじめから の最初の場面）: 1年後、世界大会の決勝の一瞬。
// 顔も会場の全景も見せない。暗い客席のシルエット越しに、スポットライトの中の一台と「一筋の煙」だけを見せる。
// 背景レイヤーに置く（会話の文字より奥）。台詞に合わせて煙が会場を満たし、「1年前」で暗転する。
import { el, rand, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { makingUrl } from "../core/data.js";
import { hooks } from "../vn/engine.js";
import { SE } from "../core/audio.js";
import { buildRig } from "../craft/art.js";

const SVG = "http://www.w3.org/2000/svg";

/** 客席のシルエット（奥の列は小さく、手前は大きく。ところどころスマホを掲げる手） */
function crowd() {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 1280 260");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("co-crowd");
  const add = (tag, attrs) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
    return n;
  };
  const row = (y, r, gap, jitter, fill) => {
    for (let x = -20; x < 1300; x += gap + rand(-jitter, jitter)) {
      const rr = r + rand(-2, 2);
      const yy = y + rand(-5, 5);
      add("ellipse", { cx: x, cy: yy + rr * 2.4, rx: rr * 2.1, ry: rr * 1.6, fill }); // 肩
      add("circle", { cx: x, cy: yy, r: rr, fill }); // 頭
      if (Math.random() < 0.09) {
        // スマホを掲げた手（画面が小さく光る）
        const hx = x + rand(-8, 8);
        add("rect", { x: hx - 3, y: yy - rr * 3.2, width: 6, height: rr * 3, fill, rx: 3 });
        add("rect", { x: hx - 7, y: yy - rr * 3.9, width: 14, height: 11, rx: 2, fill: "#cfe4ff", class: "co-phone" });
      }
    }
  };
  row(62, 12, 34, 6, "#0b0710");
  row(118, 17, 44, 8, "#060409");
  row(190, 24, 58, 10, "#020103");
  return svg;
}

/**
 * 場面を背景レイヤーに出す。戻り値の stop() で片付ける（次の背景に差し替わるときも自然に消える）
 */
export function mountColdOpen() {
  const beams = el("div.co-beams", [
    ["18%", -18, "#ffcf7a"], ["34%", -8, "#ff6fa8"], ["50%", 0, "#fff2d0"], ["66%", 8, "#7fb2ff"], ["82%", 18, "#ffcf7a"],
  ].map(([x, deg, c], i) => el("i", { style: { left: x, "--deg": `${deg}deg`, "--c": c, animationDelay: `${-i * 1.7}s` } })));
  const rig = buildRig();
  rig.update({ equip: { bowl: "silicone_bowl", charcoal: "flat_charcoal" }, pack: "normal", holes: { dots: [] }, place: "triangle", heat: { just: 1 }, steam: {}, pullDone: true, mix: { double_apple: 9, mint: 3 } });
  const plumeUrl = makingUrl("smoke_thick.png");
  const scene = el("div.cold-open.bg-img.show", [
    el("div.co-glow"),
    beams,
    el("div.co-spot"),
    el("div.co-stage", [rig.root]),
    plumeUrl ? el("img.co-plume", { src: plumeUrl, alt: "" }) : null,
    el("div.co-fog", [el("i"), el("i"), el("i"), el("i")]),
    crowd(),
    el("div.co-flashes"),
    el("div.co-vignette"),
  ]);
  layers.bg.append(scene);
  // 煙の根元をボウルの口に合わせる（レイアウトが決まってから測る）
  const plume = scene.querySelector(".co-plume");
  requestAnimationFrame(() => {
    const stage = document.getElementById("stage");
    const bowl = scene.querySelector(".rig-bowl");
    if (!stage || !bowl || !plume) return;
    const sr = stage.getBoundingClientRect();
    const k = sr.width / stage.offsetWidth || 1;
    const top = (bowl.getBoundingClientRect().top - sr.top) / k;
    plume.style.bottom = `${stage.offsetHeight - top - 22}px`;
  });

  // 客席のカメラのフラッシュ
  const flashes = scene.querySelector(".co-flashes");
  let alive = true;
  (async () => {
    while (alive) {
      await sleep(rand(180, 650));
      if (!alive || !scene.isConnected) break;
      const f = el("i", { style: { left: `${rand(3, 97)}%`, top: `${rand(62, 84)}%`, "--s": String(rand(0.6, 1.4)) } });
      flashes.append(f);
      setTimeout(() => f.remove(), 450);
    }
  })();
  // 歓声（ざわめき→どよめき）
  SE.crowd(3.2);
  const cheer = setInterval(() => SE.crowd(rand(2, 3.2)), 5200);

  // 台詞に合わせた演出: 最後の一台の提供 → 煙が会場を満たす → 煙の向こうに誰か → 「1年前」で暗転
  const prevOnLine = hooks.onLine;
  hooks.onLine = (id, line) => {
    prevOnLine?.(id, line);
    const t = String(line.text || "");
    if (/提供されます/.test(t)) scene.classList.add("serve");
    if (/煙が、ゆっくりと会場を満たして/.test(t)) scene.classList.add("fill");
    if (/誰かが立っている/.test(t)) scene.classList.add("figure");
    if (/1年前/.test(t)) scene.classList.add("out");
  };

  return {
    stop() {
      alive = false;
      clearInterval(cheer);
      rig.destroy();
      hooks.onLine = prevOnLine;
      scene.classList.add("out");
      setTimeout(() => scene.remove(), 900);
    },
  };
}
