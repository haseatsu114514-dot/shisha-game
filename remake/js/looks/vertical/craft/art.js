// 縦試作と本編で共用する絵記号。
export const GENRES = {
  fruit: { name: "フルーティ", color: "#ff8f6b", icon: '<path d="M12 8.2c-1.7-1.3-4.7-1.1-6.1 1.1-1.6 2.5-.6 6.8 1.7 9.3 1.3 1.5 2.9 1.6 4.4.7 1.5.9 3.1.8 4.4-.7 2.3-2.5 3.3-6.8 1.7-9.3-1.4-2.2-4.4-2.4-6.1-1.1z" fill="currentColor"/><path d="M12 8.2c0-2.2 1-3.9 3.2-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
  sweet: { name: "スイート", color: "#f7a8d8", icon: '<circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M7.6 12 3 8.2v7.6zM16.4 12 21 8.2v7.6z" fill="currentColor"/>' },
  fresh: { name: "刺激", color: "#7fd8e8", icon: '<path d="M10.5 3H19l-5.6 7.1H18L4.7 21l4.4-8H4.6z" fill="currentColor"/>' },
  deep: { name: "リラックス", color: "#b9a6ff", icon: '<path d="M19.6 14.9A8.2 8.2 0 1 1 9.1 4.4a6.6 6.6 0 0 0 10.5 10.5z" fill="currentColor"/>' },
};
export const portraitTools = {
  mouthpiece: `<svg class="tool-svg tool-mouthpiece" viewBox="0 0 100 100" aria-hidden="true"><g class="gl-mp"><g transform="translate(0 -5) rotate(-45 50 50) translate(50 50) scale(0.74) translate(-50 -50)">
    <rect x="-4" y="45" width="16" height="10" rx="4"/><rect x="13.5" y="43.3" width="7.5" height="13.4" rx="1.6"/>
    <path d="M22.5 42.8L78 45Q82 45.3 82 48.2V51.8Q82 54.7 78 55L22.5 57.2Z"/><path class="gl-ring" d="M31 43.6V56.4M72 45V55"/>
    <rect class="gl-tip" x="84" y="46.4" width="20" height="7.2" rx="2.6"/></g></g></svg>`,
  serve: `<svg class="tool-svg tool-serve" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="27" r="6"/><path d="M17 72A33 33 0 0 1 83 72Z"/><rect x="8" y="77" width="84" height="8" rx="4"/></svg>`,
  slow: `<svg class="tool-svg tool-slow" viewBox="0 0 100 100" aria-hidden="true"><circle class="gl-ring" cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="6"/><path class="gl-ticks" d="M50 14v14M50 72v14M14 50h14M72 50h14"/></svg>`,
  bomb: `<svg class="tool-svg tool-bomb" viewBox="0 0 100 100" aria-hidden="true">
    <path class="gl-heart" d="M50 60C42.500 54.500 37 50 37 44.500A6.500 6.500 0 0 1 50 41.500 6.500 6.500 0 0 1 63 44.500C63 50 57.500 54.500 50 60Z"/>
    <circle class="gl-wave" cx="50" cy="50" r="23"/><circle class="gl-wave2" cx="50" cy="50" r="34"/>
    <g class="gl-out"><circle cx="13" cy="17" r="4"/><circle cx="88" cy="16" r="3.400"/><circle cx="10" cy="84" r="3.400"/><circle cx="89" cy="85" r="4"/>
    <path d="M19 23l5 5M82 22l-5 5M16 78l5-5M83 79l-5-5"/></g></svg>`,
  attack: `<svg class="tool-svg tool-attack" viewBox="0 0 100 100" aria-hidden="true"><path class="gl-arc" d="M18 70C26 38 52 20 84 18"/><path d="M84 18L70 14 76 28Z"/><path class="gl-arc2" d="M30 80C38 58 54 44 76 38"/></svg>`,
};

export const meterViewBox = "-6 -2 212 112";
export const meterNeedle = '<g class="needle"><path d="M100 10L103.2 96L96.8 96Z"/></g>';

export function meterHtml([cold, coldEnd, center, centerEnd, hot, hotEnd] = [.13, .2, .44, .56, .8, .87], withNeedle = true) {
  const C = 100, RO = 92, RI = 60;
  const pt = (t, r) => { const a = Math.PI * (1 - t); return [C + r * Math.cos(a), C - r * Math.sin(a)]; };
  const band = (t0, t1, cls, style = "") => {
    const [x0, y0] = pt(t0, RO), [x1, y1] = pt(t1, RO), [x2, y2] = pt(t1, RI), [x3, y3] = pt(t0, RI);
    return `<path class="${cls}" ${style ? `style="${style}"` : ""} d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${RO} ${RO} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${RI} ${RI} 0 0 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z"/>`;
  };
  const steps = (t0, t1, cls, n, from, to) => Array.from({ length: n }, (_, i) => band(t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n + 0.002, cls, `--mix:${Math.round(from + (to - from) * i / (n - 1))}%`)).join("");
  return `<svg class="meter" viewBox="${meterViewBox}" role="img" aria-label="吸い出しのメーター">
    ${band(0, cold, "z z-cold")}${band(cold, coldEnd, "z z-keep")}${steps(coldEnd, center, "z z-cool", 6, 100, 0)}
    ${band(center, centerEnd, "z z-just")}${steps(centerEnd, hot, "z z-warm", 6, 0, 100)}${band(hot, hotEnd, "z z-keep")}${band(hotEnd, 1, "z z-hot")}
    ${withNeedle ? meterNeedle : ""}
  </svg>`;
}
