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

/**
 * 稲妻の折れ線。両端は動かさず、あいだを半分に割るたびに中点を線の左右へ振る（割るほど振れ幅を半分に）。
 * 大きな曲がりと細かいギザギザが両方出て、本物の稲妻らしくなる。disp＝最初の振れ幅、minLen＝これより短くなったら割らない
 */
export function bolt(x1, y1, x2, y2, disp = 60, minLen = 12) {
  const out = [[x1, y1]];
  const split = (ax, ay, bx, by, d) => {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < minLen) { out.push([bx, by]); return; }
    const off = (Math.random() * 2 - 1) * d, mx = (ax + bx) / 2 - ((by - ay) / len) * off, my = (ay + by) / 2 + ((bx - ax) / len) * off;
    split(ax, ay, mx, my, d / 2); split(mx, my, bx, by, d / 2);
  };
  split(x1, y1, x2, y2, disp);
  return out;
}
const points = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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
  // 1本の電撃＝太い光と細い芯の「主の筋」と、少しずれて走る「副の筋」。枝は主の筋の途中から斜めに分かれる。
  // まわりに火花が散り、「VS」の文字のまわりにも小さな放電がまとわりつく（2026-11-11 オーナー「稲妻をビリビリさせたい」）
  const strand = (cls) => ({ glow: svg("polyline", { class: `is-glow ${cls}` }), core: svg("polyline", { class: `is-core ${cls}` }) });
  const lines = layout.bolts.map(() => ({ main: strand("is-main"), sub: strand("is-sub"), twigs: Array.from({ length: 5 }, () => svg("polyline", { class: "is-twig" })) }));
  const sparks = Array.from({ length: 18 }, () => svg("line", { class: "is-spark" }));
  const arcs = layout.mark.map(() => Array.from({ length: 4 }, () => svg("polyline", { class: "is-arc" })));
  for (const l of lines) bolts.append(l.sub.glow, l.main.glow, ...l.twigs, l.sub.core, l.main.core);
  bolts.append(...arcs.flat(), ...sparks);
  const markSize = { 2: 260, 3: 136, 4: 210 }[n] || 200;
  const strike = () => {
    const along = [];
    layout.bolts.forEach(([x1, y1, x2, y2], k) => {
      const l = lines[k], len = Math.hypot(x2 - x1, y2 - y1), dir = Math.atan2(y2 - y1, x2 - x1);
      const main = bolt(x1, y1, x2, y2, len * 0.09), sub = bolt(x1 + (Math.random() - 0.5) * 60, y1, x2 + (Math.random() - 0.5) * 60, y2, len * 0.12, 16);
      l.main.glow.setAttribute("points", points(main)); l.main.core.setAttribute("points", points(main));
      l.sub.glow.setAttribute("points", points(sub)); l.sub.core.setAttribute("points", points(sub));
      // 副の筋はときどき消える（明滅）
      const showSub = Math.random() < 0.7;
      l.sub.glow.style.opacity = showSub ? "" : "0"; l.sub.core.style.opacity = showSub ? "" : "0";
      for (const twig of l.twigs) {
        const [sx, sy] = main[1 + Math.floor(Math.random() * (main.length - 2))], a = dir + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.9), r = 40 + Math.random() * 150;
        twig.setAttribute("points", points(bolt(sx, sy, sx + Math.cos(a) * r, sy + Math.sin(a) * r, r * 0.3, 8)));
        twig.style.opacity = Math.random() < 0.8 ? "" : "0";
      }
      along.push(...main);
    });
    for (const sp of sparks) {
      const [x, y] = pick(along), a = Math.random() * Math.PI * 2, r1 = 6 + Math.random() * 18, r2 = r1 + 8 + Math.random() * 26;
      sp.setAttribute("x1", (x + Math.cos(a) * r1).toFixed(1)); sp.setAttribute("y1", (y + Math.sin(a) * r1).toFixed(1));
      sp.setAttribute("x2", (x + Math.cos(a) * r2).toFixed(1)); sp.setAttribute("y2", (y + Math.sin(a) * r2).toFixed(1));
    }
    layout.mark.forEach(([cx, cy], m) => {
      for (const arc of arcs[m]) {
        const a = Math.random() * Math.PI * 2, b = a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.9), rx = markSize * 0.62, ry = markSize * 0.42;
        arc.setAttribute("points", points(bolt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cx + Math.cos(b) * rx, cy + Math.sin(b) * ry, markSize * 0.18, 7)));
        arc.style.opacity = Math.random() < 0.75 ? "" : "0";
      }
    });
    // 全体の明るさも、ちらつかせる（たまに一瞬消える）
    bolts.style.setProperty("--zap", Math.random() < 0.08 ? "0.15" : (0.72 + Math.random() * 0.28).toFixed(2));
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
      timers.forEach(clearTimeout); clearTimeout(flicker);
      node.remove(); resolve();
    };
    // ビリビリ: 電撃の形を、短くて不ぞろいな間隔で引き直す
    let flicker = 0;
    const buzz = () => { strike(); flicker = setTimeout(buzz, (28 + Math.random() * 46) / Math.max(1, speed)); };
    if (!reduced) flicker = setTimeout(buzz, 40);
    node.addEventListener("pointerdown", (e) => { e.preventDefault(); finish(); });
    node.addEventListener("keydown", (e) => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); finish(); } });
    signal?.addEventListener("abort", finish, { once: true });
    node.focus({ preventScroll: true });
    if (reduced) { at(1400, finish); return; }
    sfx("whoosh");
    at(340, () => { node.classList.add("is-clash"); sfx("hit"); sfx("crackle"); });
    for (const t of [620, 900, 1180, 1460, 1720]) at(t, () => { sfx("crackle"); node.classList.remove("is-spark"); void node.offsetWidth; node.classList.add("is-spark"); });
    at(1950, () => node.classList.add("is-out"));
    at(2250, finish);
  });
}
