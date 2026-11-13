// カードゲーム「一台勝負」のブラウザ検査（ichidai.mjs・ichidai_modes.mjs）で共有する道具。
/**
 * 対戦画面の文字が、枠からはみ出していないか・切れていないか（2026-11-11 オーナー「プレイ画面で文字が枠から飛び出してたり
 * 見づらいとこは直して」）。見えている文字だけを数える（スクロールで隠れている行は数えない）。わざと枠に重ねている印
 * （枚数の丸・枠の名前・火の数字・束の帯など）は除く。返り値は見つけたものの一覧（無ければ空）
 */
export const overflowed = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-test="ichi-game"]'), stage = document.querySelector("#stage").getBoundingClientRect(), out = [];
  const SKIP = ".ichi-count, .ichi-counter, .ichi-zone-tab, .ichi-coal-fire, .ichi-bundle-band, .ichi-bundle-band *, .ichi-rar, .ichi-say, .ichi-float, .ichi-banner *, .ichi-fly *, .ichi-vs *, .ichi-played > small, .ichi-pile-minus, .ichi-cutin-band *";
  const PANELS = ".ichi-guide, .ichi-heat-read, .ichi-foe-panel, .ichi-clock, .ichi-detail, .ichi-feed, .ichi-btn, .ichi-card, .ichi-post, .ichi-result-row, .ichi-zone-box, .ichi-market, .ichi-pile-card, .ichi-result";
  const name = (n) => `${n.tagName.toLowerCase()}.${[...n.classList].join(".")}`;
  for (const n of root.querySelectorAll("*")) {
    if (n.matches(SKIP) || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const cs = getComputedStyle(n), r0 = n.getBoundingClientRect();
    if (!r0.width || !r0.height || cs.visibility === "hidden") continue;
    let hidden = false; for (let a = n; a && a !== root; a = a.parentElement) { const o = getComputedStyle(a); if (o.display === "none" || o.opacity === "0" || a.hidden) hidden = true; }
    if (hidden) continue;
    const label = `${name(n)}「${n.textContent.trim().slice(0, 12)}」`;
    if (cs.overflowX !== "visible" && n.scrollWidth > n.clientWidth + 1) out.push(`切れ ${label}`);
    else if (cs.overflowY !== "visible" && cs.overflowY !== "auto" && n.scrollHeight > n.clientHeight + 3) out.push(`切れ ${label}`);
    const range = document.createRange(); range.selectNodeContents(n); const t = range.getBoundingClientRect();
    if (!t.width) continue;
    const outside = (b) => Math.max(b.left - t.left, t.right - b.right, b.top - t.top, t.bottom - b.bottom);
    // いちばん内側の切り抜く枠で判断する: すっかり外なら見えていない。スクロールできる枠なら送れば読める。隠す枠で一部だけ見えていれば「切れ」
    let unseen = false;
    for (let a = n.parentElement; a && a !== root.parentElement; a = a.parentElement) {
      const o = getComputedStyle(a); if (o.overflowX === "visible" && o.overflowY === "visible") continue;
      const b = a.getBoundingClientRect(); if (outside(b) <= 1) continue;
      const part = t.bottom > b.top + 2 && t.top < b.bottom - 2 && t.right > b.left + 2 && t.left < b.right - 2;
      if (part && o.overflowY !== "auto" && o.overflowY !== "scroll") out.push(`切れ（一部だけ見える） ${label} ← ${name(a)}`);
      unseen = true; break;
    }
    if (unseen) continue;
    const panel = n.closest(PANELS);
    if (panel && panel !== n && outside(panel.getBoundingClientRect()) > 1.5) out.push(`はみ出し ${label} ← ${name(panel)}`);
    if (outside(stage) > 1) out.push(`画面の外 ${label}`);
  }
  return [...new Set(out)];
});
