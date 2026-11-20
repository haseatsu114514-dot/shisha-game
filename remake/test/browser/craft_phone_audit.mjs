// スマホ横持ちの作業台の機械検査（ページの中で動かす関数）。craft_phone_layout.mjs が使う。
// 文字・押す所・切れたら困る絵が、ステージの外へ出ない／入れ物に切られない／小さすぎない／別の部品に覆われない。
/** いま見えている作業台（開いていれば説明・ダイアログ）を調べ、見つけた問題を文字の配列で返す。 */
export const audit = () => {
  const stage = document.getElementById('stage'), sr = stage.getBoundingClientRect(), k = sr.width / 1280;
  const bench = document.querySelector('.bench:not(.done)');
  if (!bench) return ['no bench'];
  const modal = document.querySelector('#modal.show'), guide = bench.querySelector('.bench-guide[open] .bench-guide-tip');
  const scope = modal || guide || bench;
  // 動く・一瞬だけ出る・読ませる文字ではない部品は対象外
  const SKIP = '.dodge, .nico, .stamp, .countdown, .thermo-pop, .craft-rank-burst, .craft-rank-status, .thermal-haze-defs, .foil-target-plane, .clock-value, .coal-carrier-coals, .heat-picks, svg, .worker-punch, .bench-worker-stage, .pull-draw-status, .panel-smoke';
  const name = n => `${n.tagName.toLowerCase()}${n.dataset?.test ? `[${n.dataset.test}]` : ''}.${[...n.classList].slice(0, 3).join('.')}`;
  const text = n => (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 14);
  const shown = n => {
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < .05) return false;
    }
    const closed = n.closest('details:not([open])');
    if (closed && !n.closest('summary')) return false; // 閉じた details の中身は描かれない
    const r = n.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  // 絶対・固定配置の部品の、置き場所の基準になる祖先（そこより内側の祖先は、その部品を切り抜かない）
  const anchor = e => {
    const p = getComputedStyle(e).position;
    if (p !== 'absolute' && p !== 'fixed') return null;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' || /paint|layout|strict|content/.test(c.contain)) return a;
      if (p === 'absolute' && c.position !== 'static') return a;
    }
    return document.body;
  };
  // 祖先の切り抜き（スクロールする入れ物も含む）を重ねた、実際に見えている範囲
  const seen = (n, r) => {
    let box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, scrolled = false, clipper = null, over = 0, until = anchor(n);
    for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) {
      if (until) { if (e !== until) continue; until = null; }
      const next = anchor(e);
      const cs = getComputedStyle(e);
      if (cs.display === 'contents') { until = next; continue; }
      const o = cs.overflowX + cs.overflowY;
      if (!/(hidden|clip|auto|scroll)/.test(o)) { until = next; continue; }
      const c = e.getBoundingClientRect();
      const cut = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top), right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) };
      const lost = Math.max(cut.left - box.left, cut.top - box.top, box.right - cut.right, box.bottom - cut.bottom);
      if (lost > 1) { if (/(auto|scroll)/.test(o)) scrolled = true; else if (!clipper) { clipper = e; over = lost; } }
      box = cut; until = next;
    }
    return { box, area: Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top), scrolled, clipper, over };
  };
  // 字が無くても、欠けたら読めなくなる絵（葉の持ちの炎・選ぶ札の絵・量のゲージ・吸い出しの集計）
  const WHOLE = '.mix-life-leaves, .opt-art, .lcd, .craft-water-meter, .pull-summary';
  const card = bench.querySelector('.bench-panel > .result-card'); // 結果カードが出ている間、下になる工程の中身は対象外
  const out = [];
  for (const n of scope.querySelectorAll('*')) {
    if (n.closest(SKIP) || !shown(n) || (card && n.closest('.bench-panel') && !card.contains(n))) continue;
    const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    const isText = [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()) && parseFloat(cs.fontSize) > 0;
    const isTap = n.matches('button, summary, a[href], [role="button"], .dodge-pad') && !n.disabled;
    const isWhole = n.matches(WHOLE);
    if (!isText && !isTap && !isWhole) continue;
    // 箱が縮んでも字は縮まない。自分の箱からあふれた字（自分では切らない場合）も含めた範囲で、祖先に切られていないかを見る
    let ink = r;
    if (isText && !/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
      const range = document.createRange(); range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width > 2 && q.height > 2)
        ink = { left: Math.min(ink.left, q.left), top: Math.min(ink.top, q.top), right: Math.max(ink.right, q.right), bottom: Math.max(ink.bottom, q.bottom) };
    }
    const label = `${name(n)} "${text(n)}"`, vis = seen(n, ink);
    // スクロールする入れ物の中で、いま送られて見えていない分は対象外（送れば読める）
    if (vis.scrolled && vis.area < r.width * r.height * .6) continue;
    const o = vis.scrolled ? vis.box : r; // 送れる入れ物の端で一部だけ見えている部品は、見えている範囲で見る
    if (o.left < sr.left - 1 || o.right > sr.right + 1 || o.top < sr.top - 1 || o.bottom > sr.bottom + 1)
      out.push(`[OUT] ${label} ${Math.round((r.left - sr.left) / k)},${Math.round((r.top - sr.top) / k)} ${Math.round(r.width / k)}x${Math.round(r.height / k)}`);
    if (vis.clipper && vis.over > 1.5) out.push(`[CLIPPED] ${label} by ${name(vis.clipper)} over ${Math.round(vis.over / k)}`);
    // 省略記号（…）で意図して詰めた1行は数えない。それ以外で箱から字があふれていたら切れ
    const cutByOwnBox = isText && /(hidden|clip)/.test(cs.overflowX + cs.overflowY) && cs.textOverflow !== 'ellipsis' && cs.webkitLineClamp === 'none'
      && (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + parseFloat(cs.fontSize) * .45);
    if (cutByOwnBox) out.push(`[TEXTCUT] ${label} ${n.scrollWidth}x${n.scrollHeight} > ${n.clientWidth}x${n.clientHeight}`);
    if (isText && parseFloat(cs.fontSize) * k < 11.4) out.push(`[SMALLTEXT] ${label} ${(parseFloat(cs.fontSize) * k).toFixed(1)}px`);
    if (isTap && isText) { // ボタンの字が3行以上に折れるのは、幅が足りていない
      const range = document.createRange(); range.selectNodeContents(n);
      const lines = new Set([...range.getClientRects()].filter(q => q.width > 2).map(q => Math.round(q.top / 4))).size;
      if (lines >= 3) out.push(`[WRAP${lines}] ${label}`);
    }
    // タイマーのボタンは絵の上の実寸、炭は絵そのものが押す所（別の検査が見る）
    if (isTap && Math.min(r.width, r.height) < 43.4 && !n.matches('.timer-button, .coal')) out.push(`[SMALLTAP] ${label} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    if (!isText && !isTap) continue; // 絵の部品は「外へ出ない・切られない」まで
    const vb = vis.box, vw = vb.right - vb.left, vh = vb.bottom - vb.top;
    if (vw < 2 || vh < 2) continue;
    for (const [fx, fy] of isTap ? [[.5, .5]] : [[.12, .5], [.5, .5], [.88, .5]]) {
      const x = vb.left + vw * fx, y = vb.top + vh * fy;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (!top || top === n || n.contains(top) || top.contains(n)) continue;
      if (vis.scrolled || n.closest('.bench-guide-tip, .modal-body')) { // 送れる入れ物の端に貼り付く部品（閉じるボタン）の下は、送れば読める
        let sticky = false;
        for (let e = top; e && e !== document.body && !sticky; e = e.parentElement) sticky = getComputedStyle(e).position === 'sticky';
        if (sticky) continue;
      }
      const tcs = getComputedStyle(top);
      const paints = top.matches('img, canvas, video') || tcs.backgroundImage !== 'none' || tcs.borderImageSource !== 'none' || !/rgba\(.*, 0\)|transparent/.test(tcs.backgroundColor);
      if (isTap || paints) { out.push(`[COVERED] ${label} by ${name(top)} "${text(top)}"`); break; }
    }
  }
  return [...new Set(out)];
};
