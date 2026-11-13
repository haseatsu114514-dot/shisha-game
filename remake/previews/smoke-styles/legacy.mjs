// 煙の見本（docs/owner_requests.md の KMR）: 「いま」の描き方の写し。比べるための基準で、本編のコードは読み込まない。
// 本編の煙はどれも「ぼかした丸を拡大しながら薄くして消す」作り。数値は本編からそのまま持ってきた:
//   吐く煙＝ js/craft/fx.js の exhale ／ 画面を覆う煙＝ css/base.css の #wipe ／ 小さな煙＝ css/craft.css の .rig-smoke ／ 漂う煙＝ css/daily.css の .title-smoke
// 1280×720 の面に置き、見本の画面の幅に合わせて縮める。

const rand = (a, b) => a + Math.random() * (b - a);
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");

export function createLegacy(host) {
  const root = document.createElement("div");
  root.className = "legacy";
  host.append(root);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const add = (style, parent = root) => {
    const i = document.createElement("i");
    Object.assign(i.style, { position: "absolute", pointerEvents: "none" }, style);
    parent.append(i);
    return i;
  };
  const run = (node, frames, opts) => {
    const anim = node.animate(frames, { fill: "both", ...opts });
    anim.finished.then(() => node.remove(), () => node.remove());
    return anim;
  };
  let colors = [[.85, .82, .9]], drift = null;

  const api = {
    setColors(c) { colors = c; },

    /** 吐き始めに一度だけ呼ばれる。大きな演出はここで丸ごと流す */
    begin(e) {
      const color = hex(colors[0]);
      if (e.kind === "first") {
        // js/craft/fx.js exhale（COUNT 10・1600ms）
        const D = 1600;
        const veil = add({ inset: "0", background: `radial-gradient(150% 110% at 50% 105%, ${color}d0, ${color}66 50%, transparent 82%)` });
        run(veil, [{ opacity: 0 }, { opacity: .8, offset: .35 }, { opacity: .55, offset: .6 }, { opacity: 0 }], { duration: D, easing: "ease-in-out" });
        for (let i = 0; i < 10; i++) {
          const size = rand(520, 860), dx = (i - 4.5) * rand(90, 140), rise = rand(300, 520), delay = i * 55;
          const p = add({
            left: "50%", top: "100%", width: `${size}px`, height: `${size * .78}px`, borderRadius: "50%", filter: "blur(18px)",
            background: `radial-gradient(closest-side, #fffdf8f5, #fffdf8b0 22%, ${color}aa 50%, ${color}44 72%, transparent)`,
          });
          run(p, [
            { transform: "translate(-50%,-50%) scale(.25)", opacity: 0 },
            { transform: `translate(calc(-50% + ${dx * .6}px), calc(-50% - ${rise * .55}px)) scale(1)`, opacity: .95, offset: .4 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(1.45)`, opacity: 0 },
          ], { duration: D - delay, delay, easing: "cubic-bezier(.2,.65,.35,1)" });
        }
      }
      if (e.kind === "cover" && e.lead) {
        // css/base.css #wipe（覆う 0.62秒 → 晴れる 0.7秒）。間の待ちは、見本の背景の入れ替えに合わせて少し長い
        const spots = [[-300, -200, 0], [250, -350, 40], [650, -150, 80], [-100, 150, 60], [500, 180, 100]];
        for (const [left, top, delay] of spots) {
          const p = add({
            left: `${left}px`, top: `${top}px`, width: "900px", height: "900px", borderRadius: "50%", filter: "blur(18px)",
            background: "radial-gradient(circle, rgba(246,242,250,1) 0%, rgba(236,230,244,.96) 45%, rgba(230,222,240,0) 70%)",
          });
          run(p, [
            { transform: "scale(.2)", opacity: 0, easing: "cubic-bezier(.7,0,.2,1)" },
            { transform: "scale(1.5)", opacity: 1, offset: .365 },
            { transform: "scale(1.5)", opacity: 1, offset: .59 },
            { transform: "scale(2.4) translateY(-120px)", opacity: 0 },
          ], { duration: 1700, delay });
        }
      }
    },

    /** 吐いている間、毎コマ呼ばれる。小さな煙は .rig-smoke の丸を並べる */
    emit(e, k, dt) {
      if (e.kind === "first" || e.kind === "cover") return;
      e.legacyAcc = (e.legacyAcc || 0) + (e.kind === "seat" ? 4 : 9) * k * dt;
      while (e.legacyAcc >= 1) {
        e.legacyAcc -= 1;
        const size = 60 * (e.radius / .016) ** .7;
        const a = e.angle + rand(-.5, .5) * e.spread;
        const reach = 150 * e.speed + rand(0, 60);
        const p = add({
          left: `${e.x * 1280}px`, top: `${e.y * 720}px`, width: `${size}px`, height: `${size}px`, margin: `${-size / 2}px 0 0 ${-size / 2}px`,
          borderRadius: "50%", filter: "blur(6px)", background: `radial-gradient(circle, color-mix(in srgb, ${hex(colors[0])} 35%, #fff) 0%, transparent 70%)`,
        });
        run(p, [
          { opacity: 0, transform: "translate(0,0) scale(.4)" },
          { opacity: .55, offset: .2 },
          { opacity: 0, transform: `translate(${Math.cos(a) * reach + rand(-40, 40)}px, ${Math.sin(a) * reach - 200}px) scale(2.6)` },
        ], { duration: rand(2600, 4200), easing: "ease-out" });
      }
    },

    /** 店に漂う煙: .title-smoke の大きなぼかし3枚がゆっくり行き来する */
    setAmbient(on) {
      drift?.remove(); drift = null;
      if (!on) return;
      drift = document.createElement("div");
      Object.assign(drift.style, { position: "absolute", inset: "0" });
      root.append(drift);
      const spots = [[{ left: "-200px", bottom: "-120px" }, 18, 1], [{ left: "300px", bottom: "-200px" }, 24, 1], [{ left: "80px", top: "-160px" }, 30, .6]];
      for (const [pos, sec, opacity] of spots) {
        const i = add({ ...pos, width: "700px", height: "420px", borderRadius: "50%", filter: "blur(30px)", opacity,
          background: "radial-gradient(ellipse, rgba(240,230,250,.16), transparent 70%)" }, drift);
        if (!reduced()) i.animate([{ transform: "translateX(-6%) translateY(0)" }, { transform: "translateX(6%) translateY(-6%)" }],
          { duration: sec * 1000, direction: "alternate", iterations: Infinity, easing: "ease-in-out" });
      }
    },

    step() {}, draw() {},
    clear() { for (const n of [...root.children]) if (n !== drift) n.remove(); },
    destroy() { root.remove(); },
  };
  return api;
}
