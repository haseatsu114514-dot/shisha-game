// カードゲーム「一台勝負」の対戦前の「VS」演出。キャラが向かい合い、あいだを電撃が走る
// （2026-11-11 オーナー「対戦する前にVS演出が欲しい。1:1もあるし1:1:1:1の4人のやつとかもあるし。キャラのアイコンと
// ビリビリ電撃が走る感じで」）。人数で並べ方が変わる: 2人＝左右に向かい合う／3人＝横に3つ／4人＝四隅（2×2）。
// 絵は登場カットインのグラフィック絵柄（顔の白い人物絵）と、その人の背景を使う（同日オーナー「VSカットインは登場カットインの
// 顔白いやつ使う。躍動感あるから。背景も登場カットインのやつで」。素材と置き方は vn/intro-graphic.js）。
// その絵が無いキャラは、顔アイコンと色の面で出す。
// 先頭が自分。#stage（1280×720）の物差しで host に重ねる。タップ・クリック・Enter・Space・Esc で飛ばせる。
// 見た目は css/ichidai.css の「VS演出」の節。規則にも保存にも触れない（見せるだけ）。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { faceUrl } from "./ichidai-art.js";
import { graphicIntro } from "../vn/intro-graphic.js";

const sfx = (name) => { try { SE[name]?.(); } catch { /* 音は無くても進む */ } };
const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

// 人数ごとの並べ方。face＝顔の中心と絵の倍率 [x, y, 倍率]、name＝名前の札の中心、bolts＝電撃の走る線（[x1, y1, x2, y2]）、mark＝「VS」の位置
export const VS_LAYOUT = Object.freeze({
  2: { face: [[306, 204, 0.92], [948, 204, 0.92]], name: [[300, 628], [980, 628]], bolts: [[716, -24, 564, 744]], mark: [[640, 350]] },
  3: { face: [[204, 200, 0.8], [640, 200, 0.8], [1066, 200, 0.8]], name: [[214, 632], [640, 632], [1062, 632]], bolts: [[478, -24, 398, 744], [882, -24, 802, 744]], mark: [[438, 350], [842, 350]] },
  4: { face: [[210, 122, 0.58], [850, 122, 0.58], [210, 488, 0.58], [850, 488, 0.58]], name: [[462, 300], [1102, 300], [462, 664], [1102, 664]], bolts: [[640, -24, 640, 744], [-24, 366, 1304, 366]], mark: [[640, 366]] },
});
// 登場カットインの人物絵は、頭の高さ280px・顔の中心 (268, 156) にそろえて置かれる（tools/intro_graphic_frames.py）
const HEAD = [268, 156];

/** ギザギザの折れ線（電撃）。両端は動かさず、あいだの点を線の左右へ振る */
function jag(x1, y1, x2, y2, amp = 28, step = 46) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, n = Math.max(2, Math.round(len / step)), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, off = i === 0 || i === n ? 0 : (Math.random() * 2 - 1) * amp;
    pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
  }
  return pts;
}
const points = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/**
 * @param host 重ねる要素（1280×720 の物差し）
 * @param players [{ id（顔アイコンのキャラID）, name, sub（一式の名前など） }] 2〜4人。先頭が自分
 * @param speed 早回し。signal が止まったら片付けて終わる
 * @returns 終わった（か飛ばされた）ら解決する Promise
 */
export function playVersus({ host, players, speed = 1, signal = null } = {}) {
  const list = (players || []).slice(0, 4), n = list.length, layout = VS_LAYOUT[n];
  if (!host?.isConnected || !layout || signal?.aborted) return Promise.resolve();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const face = (p) => {
    const url = faceUrl(p.id), blank = () => el("span.ichi-vs-face.is-blank", { text: (p.name || "？").slice(0, 1) });
    return url ? el("img.ichi-vs-face", { src: url, alt: "", draggable: "false", onerror: (e) => { e.currentTarget.replaceWith(blank()); } }) : blank();
  };
  // 登場カットインの絵と背景（無ければ null → 顔アイコンと色の面）
  const art = list.map((p) => graphicIntro(p.id, "graphic"));
  const panel = (g, i) => {
    if (!g) return el(`div.ichi-vs-panel.p-${i}`, { "aria-hidden": "true" });
    const [cx, cy, k] = layout.face[i], f = g.frame;
    return el(`div.ichi-vs-panel.p-${i}.has-art`, { "aria-hidden": "true" }, [
      g.background ? el("i.ichi-vs-bg", { style: { backgroundImage: `url("${g.background}")` } }) : null,
      el("img.ichi-vs-art", { src: g.portrait, alt: "", draggable: "false", dataset: { test: `ichi-vs-art-${i}` },
        style: { width: `${(f.width * k).toFixed(1)}px`, left: `${(cx - (HEAD[0] - f.left) * k).toFixed(1)}px`, top: `${(cy - (HEAD[1] - f.top) * k).toFixed(1)}px` },
        onerror: (e) => { const host = e.currentTarget.closest(".ichi-vs"); e.currentTarget.remove(); host?.querySelector(`.ichi-vs-player.p-${i}`)?.prepend(el("span.ichi-vs-ring", face(list[i]))); } }),
    ]);
  };
  const bolts = svg("svg", { class: "ichi-vs-bolts", viewBox: "0 0 1280 720", "aria-hidden": "true" });
  // 1本の電撃＝太い光と細い芯。枝は主の線の途中から短く出る
  const lines = layout.bolts.map(() => ({ glow: svg("polyline", { class: "is-glow" }), core: svg("polyline", { class: "is-core" }), twigs: [0, 1, 2].map(() => svg("polyline", { class: "is-twig" })) }));
  for (const l of lines) bolts.append(l.glow, ...l.twigs, l.core);
  const strike = () => {
    layout.bolts.forEach(([x1, y1, x2, y2], k) => {
      const pts = jag(x1, y1, x2, y2), l = lines[k];
      l.glow.setAttribute("points", points(pts)); l.core.setAttribute("points", points(pts));
      for (const twig of l.twigs) {
        const [sx, sy] = pts[1 + Math.floor(Math.random() * (pts.length - 2))], a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 70;
        twig.setAttribute("points", points(jag(sx, sy, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 12, 24)));
      }
    });
  };
  strike();
  const node = el(`div.ichi-vs.n-${n}${reduced ? ".is-still" : ""}`, { role: "img", "aria-label": `対戦：${list.map((p) => p.name).join(" 対 ")}`, tabindex: "-1", dataset: { test: "ichi-vs", count: String(n) } }, [
    ...list.map((_, i) => panel(art[i], i)),
    bolts,
    ...list.map((p, i) => el(`div.ichi-vs-player.p-${i}${art[i] ? "" : ".no-art"}`, { style: { left: `${layout.name[i][0]}px`, top: `${layout.name[i][1]}px` }, dataset: { test: `ichi-vs-player-${i}`, id: p.id || "" } }, [
      art[i] ? null : el("span.ichi-vs-ring", face(p)), el("b", { text: p.name }), p.sub ? el("small", { text: p.sub }) : null])),
    ...layout.mark.map(([x, y]) => el("b.ichi-vs-mark", { text: "VS", style: { left: `${x}px`, top: `${y}px` } })),
    el("i.ichi-vs-flash", { "aria-hidden": "true" }),
    el("small.ichi-vs-skip", { text: "タップでとばす" }),
  ]);
  host.append(node);

  return new Promise((resolve) => {
    const timers = []; let done = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms / speed));
    const finish = () => {
      if (done) return; done = true;
      timers.forEach(clearTimeout); clearInterval(flicker);
      node.remove(); resolve();
    };
    // ビリビリ: 電撃の形を短い間隔で引き直す
    const flicker = reduced ? null : setInterval(strike, 70);
    node.addEventListener("pointerdown", (e) => { e.preventDefault(); finish(); });
    node.addEventListener("keydown", (e) => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); finish(); } });
    signal?.addEventListener("abort", finish, { once: true });
    node.focus({ preventScroll: true });
    if (reduced) { at(1400, finish); return; }
    sfx("whoosh");
    at(340, () => { node.classList.add("is-clash"); sfx("hit"); sfx("crackle"); });
    at(700, () => sfx("crackle")); at(1080, () => sfx("crackle")); at(1450, () => sfx("crackle"));
    at(1950, () => node.classList.add("is-out"));
    at(2250, finish);
  });
}
