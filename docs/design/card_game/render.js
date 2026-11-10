// rulebook.html の図と一覧を cards.js から組み立てる。
(function () {
  const byId = Object.fromEntries(FLAVORS.map((f) => [f.id, f]));
  const supByName = Object.fromEntries(SUPPORT.map((s) => [s.n, s]));

  function zone(f, h) {
    if (h >= f.s) return 'scorch';
    if (f.j.includes(h)) return 'just';
    if (h >= f.lo && h <= f.hi) return 'band';
    if (h === f.lo - 1 || h === f.hi + 1) return 'off';
    return 'cold';
  }
  function strip(f, cls, now) {
    let h = `<div class="strip ${cls || ''}">`;
    for (let i = 0; i <= 10; i++) {
      const z = zone(f, i);
      h += `<i class="z-${z}${now && now.includes(i) ? ' now' : ''}">${z === 'just' ? '★' : i}</i>`;
    }
    return h + '</div>';
  }
  const kind = (k) => `<span class="kind ${k}">${KIND[k].k}</span>`;
  function costHtml(c) {
    if (c === '—') return '—';
    if (typeof c === 'string' && c[0] === 'B') return `<span class="fire burn">${c.slice(1)}</span>`;
    return `<span class="fire">${c}</span>`;
  }

  function flavorCard(f) {
    return `<div class="card ${f.k}">
      <div class="top"><span class="kind ${f.k}" style="background:rgba(0,0,0,.28)">${KIND[f.k].k}</span>
        <div class="nm" style="${f.n.length > 7 ? 'font-size:7.2pt' : ''}"><small>${f.b}</small>${f.n}</div><div class="gram">1g</div></div>
      <div class="art"><span class="glyph">${KIND[f.k].k}</span><div class="taste"><small>味</small>${f.t}</div></div>
      <div class="body"><div class="lbl">温度の帯</div>${strip(f, 'mini')}
        <div class="pair"><span style="color:var(--ink2)">相性</span>${f.pair === 'none' ? '<span class="kind none">—</span> なし' : kind(f.pair) + ' ' + KIND[f.pair].n}</div>
        <div class="txt">${f.ab || '<span style="color:#a79b8d">（能力なし）</span>'}</div></div></div>`;
  }
  function supCard(s) {
    const burn = typeof s.cost === 'string' && s.cost[0] === 'B';
    const c = s.cost === '—' ? '炭' : burn ? s.cost.slice(1) : s.cost;
    return `<div class="card sup">
      <div class="top"><div class="cost" style="${burn ? 'background:#fff;color:var(--ember)' : ''}${s.cost === '—' ? 'font-size:7pt' : ''}">${c}</div><div class="nm">${s.n}</div></div>
      <div class="art"><span class="glyph" style="font-size:20pt;color:rgba(243,154,60,.85)">${s.type}</span></div>
      <div class="body"><div style="margin-top:.6mm"><span class="type">${s.type}</span><span class="when">${s.when === '炭' ? '炭として置く' : s.when}</span></div>
        <div class="txt" style="margin-top:1.4mm">${s.tx}</div></div></div>`;
  }
  function setCard(kindName, o) {
    return `<div class="card sup set">
      <div class="top"><div class="nm"><small>セッティング／${kindName}</small>${o.n}</div>${o.cap ? `<div class="gram" style="color:var(--brass);width:8.4mm;height:8.4mm;font-size:6pt;line-height:1;flex-direction:column"><span style="font-size:4pt">容量</span>${o.cap}g</div>` : ''}</div>
      <div class="art" style="background:linear-gradient(135deg,#d6b46a,#8f6a22)"><span class="glyph">${kindName === 'ボウル' ? '器' : '蓋'}</span></div>
      <div class="body"><div class="txt" style="margin-top:1.6mm">${o.ab}</div></div></div>`;
  }

  document.querySelectorAll('[data-card]').forEach((el) => { el.outerHTML = wrap(el, flavorCard(byId[el.dataset.card])); });
  document.querySelectorAll('[data-sup]').forEach((el) => { el.outerHTML = wrap(el, supCard(supByName[el.dataset.sup])); });
  document.querySelectorAll('[data-back]').forEach((el) => { el.outerHTML = wrap(el, '<div class="card back"><div class="emb"></div></div>'); });
  document.querySelectorAll('[data-set]').forEach((el) => {
    const [t, i] = el.dataset.set.split(':');
    el.outerHTML = wrap(el, setCard(t === 'bowl' ? 'ボウル' : 'HMD', (t === 'bowl' ? BOWLS : HMDS)[+i]));
  });
  // 元の要素の style（回転や拡大）をカードに引き継ぐ
  function wrap(el, html) {
    const st = el.getAttribute('style');
    return st ? html.replace('class="card', `style="${st}" class="card`) : html;
  }
  document.querySelectorAll('[data-strip]').forEach((el) => {
    const now = el.dataset.now ? el.dataset.now.split(',').map(Number) : null;
    el.outerHTML = strip(byId[el.dataset.strip], el.dataset.cls, now);
  });

  const add = (id, rows) => { const t = document.getElementById(id); if (t) t.insertAdjacentHTML('beforeend', rows.join('')); };
  add('tbl-flavors', FLAVORS.map((f) => `<tr><td class="c">${kind(f.k)}</td><td class="nw"><b>${f.n}</b>　<span class="small">${f.b}</span></td>
    <td class="c"><b style="font-size:10.5pt;line-height:1">${f.t}</b></td><td>${strip(f)}</td><td class="c">${f.pair === 'none' ? '<span class="kind none">—</span>' : kind(f.pair)}</td>
    <td style="font-size:.9em;line-height:1.35">${f.ab}</td></tr>`));
  add('tbl-bowls', BOWLS.map((b) => `<tr><td class="nw"><b>${b.n}</b></td><td class="c">${b.cap}g</td><td>${b.ab}</td></tr>`));
  add('tbl-hmds', HMDS.map((b) => `<tr><td class="nw"><b>${b.n}</b></td><td>${b.ab}</td></tr>`));
  add('tbl-support', SUPPORT.map((s) => `<tr><td class="c"><span class="tag ${s.type === '技' ? 'k' : s.type === '器具' ? 'b' : s.type === '人物' ? 'g' : s.type === '炭' ? 'k' : ''}" style="margin:0">${s.type}</span></td>
    <td class="nw"><b>${s.n}</b></td><td class="c">${costHtml(s.cost)}</td><td class="c nw small">${s.when === '炭' ? '—' : s.when}</td><td style="line-height:1.35">${s.tx}</td></tr>`));
  add('tbl-judges', JUDGES.map((j) => `<tr><td class="nw"><b>${j.n}</b></td><td>${j.t}</td><td>${j.tx}</td></tr>`));
  const deck = (id, d) => { const u = document.getElementById(id); if (u) u.innerHTML = d.map(([n, c]) => `<li>${n}<span>×${c}</span></li>`).join(''); };
  deck('deck-a', DECK_A); deck('deck-b', DECK_B);

  // 熱の動き（適温4〜6の葉を、短い大会で通した例）
  const hf = document.getElementById('heatfig');
  if (hf) {
    const seq = [3, 3, 3, 3, 6, 7, 7, 7, 6, 5, 4, 7, 6, 5, 4, 7, 6, 5, 4]; // 準備8 + (3ターン + 調整)…
    const kinds = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 's', 's', 's', 'a', 's', 's', 's', 'a', 's', 's', 's'];
    const W = 680, H = 132, L = 34, R = 8, T = 8, B = 26, n = seq.length;
    const x = (i) => L + (W - L - R) * (i + 0.5) / n, y = (v) => T + (H - T - B) * (1 - v / 10);
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">`;
    s += `<rect x="${L}" y="${y(6.5)}" width="${W - L - R}" height="${y(3.5) - y(6.5)}" fill="#7fbd66" opacity=".35"/>`;
    s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${y(7.5) - T}" fill="#b5302a" opacity=".16"/>`;
    for (const v of [0, 2, 4, 6, 8, 10]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#cdbda2" stroke-width=".6"/><text x="${L - 6}" y="${y(v) + 3.5}" font-size="9.5" text-anchor="end" fill="#5d5148">${v}</text>`;
    const seg = [[0, 8, '準備（8ターン）', '#a8802f'], [8, 11, '提供 1', '#e2591f'], [11, 12, '調整', '#6d6258'], [12, 15, '提供 2', '#e2591f'], [15, 16, '調整', '#6d6258'], [16, 19, '提供 3', '#e2591f']];
    for (const [a, b, t, c] of seg) { const xa = L + (W - L - R) * a / n, xb = L + (W - L - R) * b / n;
      s += `<rect x="${xa + 1}" y="${H - 20}" width="${xb - xa - 2}" height="14" rx="3" fill="${c}"/><text x="${(xa + xb) / 2}" y="${H - 9.5}" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">${t}</text>`; }
    s += `<polyline fill="none" stroke="#1f1b19" stroke-width="2.2" stroke-linejoin="round" points="${seq.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
    seq.forEach((v, i) => { const k = kinds[i];
      s += `<circle cx="${x(i)}" cy="${y(v)}" r="${k === 's' ? 6.5 : 4}" fill="${k === 's' ? '#f5ad14' : k === 'a' ? '#6d6258' : '#fff'}" stroke="#1f1b19" stroke-width="1.6"/>`;
      if (k === 's') s += `<text x="${x(i)}" y="${y(v) + 3.4}" font-size="8.5" font-weight="900" text-anchor="middle" fill="#1f1b19">${v}</text>`; });
    s += `<text x="${L + 5}" y="${y(5.6) + 3.5}" font-size="9.5" font-weight="700" fill="#3f7a2c">適温 4〜6</text><text x="${L + 5}" y="${y(9) + 3.5}" font-size="9.5" font-weight="700" fill="#b5302a">焦げ 8〜</text>`;
    hf.innerHTML = s + '</svg><p class="small" style="margin:1mm 0 0">適温4〜6の葉を、短い大会で通した例。準備で熱7まで上げ、提供では毎ターン1ずつ下がり、調整で3枚足して戻します。丸の数字が一口の判定熱です。</p>';
  }

  const sup = document.getElementById('supply');
  if (sup) {
    const first = ['lemon', 'mint', 'peach', 'white_gummy_bear', 'vanilla', 'double_apple', 'cinnamon', 'black_tea', 'rose', 'spring_water'];
    sup.innerHTML = first.map((id) => { const f = byId[id];
      return `<div style="background:var(--${f.k});border-radius:1mm;height:11mm;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-weight:700;font-size:5pt;line-height:1.2;border:.3mm solid #000;box-shadow:.5mm .5mm 0 #000,1mm 1mm 0 rgba(255,255,255,.25)">${f.n.replace('スプリングウォーター', 'スプリング<br>ウォーター').replace('ホワイトグミベア', 'ホワイト<br>グミベア').replace('ダブルアップル', 'ダブル<br>アップル').replace('ブラックティー', 'ブラック<br>ティー')}</div>`; }).join('');
  }
})();
