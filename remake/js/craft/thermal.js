// 温度のイメージ。実際の温度だけを読み、採点・雑念・機材には干渉しない。
// 参照映像の斜めの四角模様 → 赤い炎 → 紫／黄緑の炎・黒煙を描く。
import { el, clamp } from "../core/util.js";
import { IDEAL } from "./conditions.js";

const BANDS = [
  { id: "cold", label: "まだぬるい", until: .30, colors: ["#ffda08", "#ffb600"], ink: "#fff26b" },
  { id: "warming", label: "熱が入っていく", until: IDEAL[0], colors: ["#ffc600", "#ff8500"], ink: "#ffe749" },
  { id: "ready", label: "適温", until: IDEAL[1], colors: ["#ffab08", "#ed5900"], ink: "#ffd431" },
  { id: "hot", label: "熱が強い", until: .76, colors: ["#ff7300", "#d82105"], ink: "#ffba13" },
  { id: "fire", label: "過熱", until: .90, colors: ["#e52005", "#970314"], ink: "#ffdc19" },
  { id: "inferno", label: "灼熱", until: Infinity, colors: ["#920ac6", "#3e046e"], ink: "#b5ff45" },
];
export function thermalBand(temp) {
  const t = clamp(Number.isFinite(temp) ? temp : 0, 0, 1);
  // 適温の上端は温度計と同じく適温に含める。
  return BANDS.find(b => t < b.until || (b.id === "ready" && t === IDEAL[1]));
}

export function buildThermalAtmosphere(host, worker) {
  const canvas = el("canvas.thermal-backdrop", { width: 960, height: 540, "aria-hidden": "true", dataset: { test: "thermal-background" } });
  const ctx = canvas.getContext("2d");
  const label = el("span.thermal-label", { hidden: true, dataset: { test: "thermal-label" } });
  const picture = el("div.thermal-picture", { "aria-hidden": "true", html: `<svg viewBox="0 0 160 200">
    <g class="thermal-wisps" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round">
      <path d="M70 184C17 143 132 116 65 79S69 30 85 12"/>
      <path d="M92 181C143 149 53 111 109 72S103 25 118 5"/>
      <path d="M55 170C2 135 60 108 34 82"/>
    </g>
    <g class="thermal-flame"><path fill="currentColor" d="M80 198C5 198 18 139 40 116C32 155 61 136 53 102C45 69 87 51 77 8C140 65 94 100 120 128C126 98 137 100 138 80C173 148 150 199 80 198Z"/>
      <path fill="#fff4a1" d="M80 193C43 189 55 163 73 145C85 130 75 111 87 95C107 120 96 144 111 158C118 181 105 197 80 193Z"/>
    </g></svg>` });
  host.prepend(canvas);
  worker.root.querySelector(".worker-equipment").append(picture);
  worker.footer.append(label);
  let active = false, paused = false, temp = 0, phase = "", raf = 0, last = 0, time = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function flame(x, base, height, width, bend, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - width, base);
    ctx.bezierCurveTo(x - width * 1.2, base - height * .45, x + bend - width, base - height * .45, x + bend, base - height);
    ctx.bezierCurveTo(x + bend + width * .7, base - height * .6, x + width * 1.5, base - height * .25, x + width, base);
    ctx.closePath(); ctx.fill();
  }
  function draw() {
    if (!ctx) return;
    const band = thermalBand(temp), w = canvas.width, h = canvas.height;
    const t = reduced.matches ? 0 : time;
    const gradient = ctx.createLinearGradient(0, 0, w * .4, h);
    band.colors.forEach((color, i) => gradient.addColorStop(i, color));
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    // 大小の四角と枠が斜めへ流れる。画面全体で温度帯の色が変わる。
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.2);
    const travel = (t * (12 + temp * 25)) % 90;
    for (let y = -450; y < 450; y += 90) for (let x = -660; x < 660; x += 90) {
      ctx.globalAlpha = .13; ctx.strokeStyle = band.ink; ctx.lineWidth = 4;
      ctx.strokeRect(x + travel, y + travel, 56, 56);
      ctx.globalAlpha = .32; ctx.fillStyle = band.ink;
      ctx.fillRect(x + 66 + travel, y + 60 + travel, 13, 13);
    }
    ctx.restore();
    if (temp >= .76) {
      const extreme = band.id === "inferno", strength = clamp((temp - .70) / .3, 0, 1);
      for (let i = 0; i < 23; i++) {
        const x = i * 45 - 15, sway = Math.sin(t * 2.6 + i * 2) * 16;
        const height = (90 + strength * 135) * (1 + .23 * Math.sin(t * 3.1 + i * 1.7));
        flame(x, h + 15, height, 33, sway, extreme ? "#59d888" : "#ff7900");
        flame(x, h + 18, height * .73, 23, -sway, extreme ? "#c6ff5b" : "#ffdd17");
        flame(x, h + 20, height * .4, 13, sway * .5, "#fff5a0");
      }
      // かなり高温では、燃える絵の上へ黒煙と火の粉が昇る。
      for (let i = 0; i < 16; i++) {
        const rise = (t * (38 + strength * 32) + i * 43) % 430;
        const x = (i * 137) % w + Math.sin(t + i) * 18;
        ctx.globalAlpha = (.12 + strength * .18) * (1 - rise / 450);
        ctx.fillStyle = extreme ? "#23172e" : "#3a1722";
        ctx.beginPath(); ctx.arc(x, h - rise, 14 + rise * .075, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .8; ctx.fillStyle = band.ink;
        ctx.fillRect((x + 53) % w, h - (rise * 1.5) % h, 5, 8);
      }
      ctx.globalAlpha = 1;
    }
  }
  function loop(now) {
    raf = 0;
    if (!active || !host.isConnected || host.classList.contains("done")) return;
    if (!paused && !document.hidden && now - last >= 50) {
      time += Math.min(.1, (now - last) / 1000); last = now; draw();
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  return {
    setStep(step) {
      active = ["steam", "pull", "care", "trial"].includes(step);
      paused = false; host.classList.toggle("thermal-active", active);
      host.dataset.thermalPaused = "false"; label.hidden = !active;
      if (!active) { cancelAnimationFrame(raf); raf = 0; delete host.dataset.thermalBand; }
      else { phase = ""; this.update(temp); start(); }
    },
    update(value) {
      temp = clamp(Number.isFinite(value) ? value : 0, 0, 1);
      if (!active) return;
      const band = thermalBand(temp);
      if (phase !== band.id) {
        phase = band.id; host.dataset.thermalBand = phase;
        host.style.setProperty("--thermal-ink", band.ink);
        label.textContent = `熱のイメージ · ${band.label}`;
        draw();
      }
      canvas.dataset.temperature = temp.toFixed(4);
      // ベンチが会話から再接続された場合も再開する。
      start();
    },
    pause(value) { paused = value; host.dataset.thermalPaused = String(value); last = performance.now(); },
  };
}
