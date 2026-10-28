// スミさんの「シーシャの仕組み」解説に合わせて段階表示する図解（Issue #1128）。
// 台詞行の "diagram" キー（engine の showLine）から呼ぶ。段階は絶対指定なので、
// SKIP・AUTO・連打・LOAD で飛んでも、その行に対応する段階へそのまま切り替わる（重なり・取りこぼしなし）。
// 新規画像は使わず SVG で店の図として描く。水は煙を冷やして吸いやすくする（有害物質への効果は諸説あり）とだけ図に添え、断定しない。
import { layers } from "../core/ui.js";

// 段階の順番（凡例の番号と、段階インジケータに使う）
const STEPS = [
  { id: "heat",   mark: "①", label: "炭の熱" },
  { id: "smoke",  mark: "②", label: "煙がステムを下へ" },
  { id: "bubble", mark: "③", label: "水の中で泡" },
  { id: "hose",   mark: "④", label: "ホースから口へ" },
];

let root = null; // 表示中の図（1つだけ。二重に出さない）

// 装置の線画（炭→ボウル→ステム→ダウンステム→ボトルの水→ホース）。viewBox 0 0 300 340。
// 左右の余白に部位ラベル（炭・フレーバー・ステム・水・ホース）を置き、初見でも「どこで何が起きるか」分かるようにする。
const APPARATUS = `
<svg class="sd-art" viewBox="0 0 300 340" aria-hidden="true">
  <defs>
    <marker id="sd-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="currentColor"/>
    </marker>
    <clipPath id="sd-water"><path d="M70 300 Q70 262 110 262 Q150 262 150 300 L150 312 Q110 322 70 312 Z"/></clipPath>
  </defs>

  <!-- 本体の線画 -->
  <g class="sd-body" fill="none" stroke="#efe7d2" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <!-- ボウル（フレーバーを詰める器）とフレーバー -->
    <path d="M94 46 L126 46 L120 30 L100 30 Z" fill="#8a5a33" stroke="#efe7d2"/>
    <!-- ステム（上の細い管） -->
    <path d="M106 46 L106 128 M114 46 L114 128"/>
    <!-- トレイ（受け皿） -->
    <path d="M70 128 L150 128"/>
    <!-- 本体の膨らみ -->
    <path d="M106 128 Q96 150 106 170 M114 128 Q124 150 114 170"/>
    <!-- ボトル（水入れ） -->
    <path d="M96 170 L96 188 Q66 196 66 250 Q66 318 110 322 Q154 318 154 250 Q154 196 124 188 L124 170 Z"/>
    <!-- ダウンステム（水の中へ伸びる管） -->
    <path d="M110 176 L110 300" stroke-width="3"/>
  </g>

  <!-- 炭（ボウルの上） -->
  <g class="sd-coal">
    <rect x="97" y="18" width="11" height="11" rx="2" fill="#2a2320"/>
    <rect x="112" y="18" width="11" height="11" rx="2" fill="#2a2320"/>
    <rect class="sd-coal-glow" x="97" y="18" width="11" height="11" rx="2" fill="#ff5a3c"/>
    <rect class="sd-coal-glow" x="112" y="18" width="11" height="11" rx="2" fill="#ff5a3c"/>
  </g>

  <!-- ボトルの水 -->
  <path class="sd-liquid" d="M70 300 Q70 262 110 262 Q150 262 150 300 L150 312 Q110 322 70 312 Z" fill="#3fa9e0" opacity="0.85"/>

  <!-- ① 炭の熱が下へ -->
  <g class="sd-flow sd-flow-heat" stroke="#ff6a3c" color="#ff6a3c" stroke-width="4" stroke-linecap="round">
    <line class="sd-heat-ray" x1="110" y1="34" x2="110" y2="60" marker-end="url(#sd-arrow)"/>
  </g>

  <!-- ② 煙がステム→ダウンステムを下へ -->
  <g class="sd-flow sd-flow-smoke">
    <circle class="sd-smoke-dot" cx="110" cy="70" r="5"/>
    <circle class="sd-smoke-dot d2" cx="110" cy="70" r="5"/>
    <circle class="sd-smoke-dot d3" cx="110" cy="70" r="5"/>
  </g>

  <!-- ③ 水の中で泡 -->
  <g class="sd-flow sd-flow-bubble" clip-path="url(#sd-water)">
    <circle class="sd-bubble b1" cx="96"  cy="305" r="4"/>
    <circle class="sd-bubble b2" cx="118" cy="308" r="5"/>
    <circle class="sd-bubble b3" cx="128" cy="302" r="3"/>
    <circle class="sd-bubble b4" cx="104" cy="310" r="3"/>
  </g>

  <!-- ④ 冷えた煙がホースを通って口へ -->
  <path class="sd-hose" d="M122 150 Q182 150 188 206 Q192 262 150 300" fill="none" stroke="#2a2320" stroke-width="9" stroke-linecap="round"/>
  <rect class="sd-mouthpiece" x="142" y="300" width="20" height="9" rx="3" fill="#2a2320"/>
  <path class="sd-flow sd-flow-hose" d="M122 150 Q182 150 188 206 Q192 262 150 300" fill="none" stroke="#d7d2e0" stroke-width="4" stroke-linecap="round"/>

  <!-- 部位ラベル（初見でも「どこで何が起きるか」分かるように。段階に関わらず常に表示） -->
  <g class="sd-tags">
    <!-- 炭（ボウルの上） -->
    <line class="sd-lead" x1="124" y1="23" x2="152" y2="23"/>
    <text class="sd-tag" x="156" y="27" text-anchor="start">炭</text>
    <!-- フレーバー（ボウルの中身） -->
    <line class="sd-lead" x1="98" y1="40" x2="64" y2="40"/>
    <text class="sd-tag" x="60" y="44" text-anchor="end">フレーバー</text>
    <!-- ステム（上の細い管） -->
    <line class="sd-lead" x1="104" y1="92" x2="64" y2="92"/>
    <text class="sd-tag" x="60" y="96" text-anchor="end">ステム</text>
    <!-- 水（ボトルの中） -->
    <line class="sd-lead" x1="78" y1="298" x2="52" y2="298"/>
    <text class="sd-tag" x="48" y="302" text-anchor="end">水</text>
    <!-- ホース（横の口） -->
    <line class="sd-lead" x1="188" y1="200" x2="214" y2="190"/>
    <text class="sd-tag" x="218" y="194" text-anchor="start">ホース</text>
  </g>
</svg>`;

function build(host) {
  const box = document.createElement("div");
  box.className = "sd-diagram";
  box.setAttribute("aria-hidden", "true");
  const legend = STEPS.map(
    (s) => `<li class="sd-step" data-step="${s.id}"><b>${s.mark}</b><span>${s.label}</span></li>`
  ).join("");
  box.innerHTML = `
    <div class="sd-card">
      <p class="sd-title">シーシャの仕組み</p>
      ${APPARATUS}
      <ol class="sd-legend">${legend}</ol>
      <p class="sd-note">※水は煙を冷やして、吸いやすくしている（有害物質への効果は諸説あり）</p>
    </div>`;
  host.append(box);
  return box;
}

/**
 * 図解を出す／次の段階へ進める。
 * @param {string} step  "show"（装置だけ）／"heat"/"smoke"/"bubble"/"hose"／"hide"（片付け）
 * @param {{still?: boolean, host?: Element}} opts  still=true で静止図＋段階表示（低減モーション・SKIP）
 */
export function showShishaDiagram(step, opts = {}) {
  if (step === "hide" || !step) { hideShishaDiagram(); return; }
  const host = opts.host || layers?.vn;
  if (!host) return;
  // すでに出ているときは作り直さない（連打・再入でも二重に出さない）
  if (!root || !root.isConnected) root = build(host);
  root.classList.toggle("sd-still", !!opts.still);
  root.dataset.step = step;
  const idx = STEPS.findIndex((s) => s.id === step);
  root.querySelectorAll(".sd-step").forEach((li, i) => {
    li.classList.toggle("done", idx >= 0 && i < idx);
    li.classList.toggle("active", idx >= 0 && i === idx);
  });
}

/** 図解を片付ける（会話終了・LOAD・場面転換で必ず呼ぶ） */
export function hideShishaDiagram() {
  root?.remove();
  root = null;
}
