// rulebook.html の図と一覧を cards.js から組み立てる（第0.7版）。
(function () {
  const byId = Object.fromEntries(FLAVORS.map((f) => [f.id, f]));
  const supByName = Object.fromEntries(SUPPORT.map((s) => [s.n, s]));
  const judgeById = Object.fromEntries(JUDGES.map((j) => [j.id, j]));

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
  // 必要な熱（自分の熱がこの数以上なら使える。払わない）
  const needHtml = (n) => (n === '—' ? '—' : `<span class="nw" style="display:inline-flex;align-items:center;gap:.5mm"><span class="fire" style="vertical-align:0" title="熱${n}以上で使える">${n}</span><span class="small">以上</span></span>`);
  // 使うために落とすもの（熱を落とす／葉を減らす）と「もう1枚使える」の札。ゲームの画面と同じ「熱−1」「葉−1」
  const payShort = (s) => (s.pay?.fire ? `熱−${s.pay.fire}` : s.pay?.leaf ? `葉−${s.pay.leaf}` : '');
  const payLong = (s) => (s.pay?.fire ? `熱を${s.pay.fire}落として使う` : s.pay?.leaf ? `葉を${s.pay.leaf}枚減らして使う` : '');
  const payTag = (s) => (payShort(s) ? `<span class="paytag" title="${payLong(s)}">${payShort(s)}</span>` : '');
  const extraTag = (s) => (s.extra ? '<span class="extratag" title="このターン、カードをもう1枚使える">もう1枚</span>' : '');
  const whenTag = (w) => `<span class="when w-${w === '一口' ? 'puff' : w === '準備' ? 'prep' : w === 'いつでも' ? 'any' : 'turn'}">${w}</span>`;

  function flavorCard(f) {
    return `<div class="card ${f.k}">
      <div class="top"><span class="kind ${f.k}" style="background:rgba(0,0,0,.28)">${KIND[f.k].k}</span>
        <div class="nm" style="${f.n.length > 7 ? 'font-size:7.2pt' : ''}"><small>${f.b}</small>${f.n}</div><div class="gram">1g</div></div>
      <div class="art"><span class="glyph">${KIND[f.k].k}</span><div class="taste"><small>味</small>${f.t}</div></div>
      <div class="body"><div class="lbl">温度の帯</div>${strip(f, 'mini')}
        <div class="pair"><span style="color:var(--ink2)">相性</span>${f.pair === 'none' ? '<span class="kind none">—</span> なし' : kind(f.pair) + ' ' + KIND[f.pair].n}</div>
        <div class="txt">${f.ab || '<span style="color:#a79b8d">（能力なし）</span>'}</div></div></div>`;
  }
  function coalCard(s) {
    const cube = s.ig === 2; // キューブ炭（着火2ターン）。heat は新品の火（フラット2・キューブ3）
    return `<div class="card coal ${cube ? 'cube' : 'flat'}">
      <div class="top"><div class="nm" style="${s.n.length > 6 ? 'font-size:8pt' : ''}"><small>炭カード</small>${s.n}</div></div>
      <div class="art"><span class="lump"></span></div>
      <div class="stats"><span><small>着火</small><b>${s.ig}</b><small>ターン</small></span><span class="h"><small>火</small><b>${s.heat}</b></span></div>
      <div class="body"><div class="txt">${s.tx}</div></div></div>`;
  }
  function supCard(s) {
    if (s.type === '炭') return coalCard(s);
    return `<div class="card sup${s.when === '一口' ? ' puff' : ''}">
      <div class="top"><div class="cost" title="必要な熱${s.need}">${s.need}</div><div class="nm" style="${s.n.length > 7 ? 'font-size:8pt' : ''}">${s.n}</div></div>
      <div class="art"><span class="glyph" style="font-size:20pt;color:rgba(243,154,60,.85)">${s.type}</span></div>
      <div class="body"><div style="margin-top:.6mm"><span class="type">${s.type}</span>${whenTag(s.when)}${payTag(s)}${extraTag(s)}</div>
        <div class="txt" style="margin-top:1.4mm">${s.tx}</div></div></div>`;
  }
  function setCard(kindName, o) {
    return `<div class="card sup set">
      <div class="top"><div class="nm"><small>セッティング／${kindName}</small>${o.n}</div>${o.cap ? `<div class="gram" style="color:var(--brass);width:8.4mm;height:8.4mm;font-size:6pt;line-height:1;flex-direction:column"><span style="font-size:4pt">容量</span>${o.cap}g</div>` : ''}</div>
      <div class="art" style="background:linear-gradient(135deg,#d6b46a,#8f6a22)"><span class="glyph">${kindName === 'ボウル' ? '器' : '蓋'}</span></div>
      <div class="body"><div class="txt" style="margin-top:1.6mm">${o.ab}</div></div></div>`;
  }
  const dhMark = (q) => (q.dh > 0 ? `+${q.dh}` : q.dh < 0 ? `−${-q.dh}` : '±0');
  function puffCard(j, q) {
    return `<div class="card judge">
      <div class="top"><div class="nm"><small>審査カード／${j.n}</small>${q.style}</div></div>
      <div class="art"><span class="dh ${q.dh > 0 ? 'up' : q.dh < 0 ? 'down' : ''}">${dhMark(q)}</span></div>
      <div class="body"><div class="lbl">判定熱の変化と、この一口の決まり</div><div class="txt" style="border:none;padding-top:0">${q.stx}</div></div></div>`;
  }

  // 元の要素の style（回転や拡大）をカードに引き継ぐ
  function wrap(el, html) {
    const st = el.getAttribute('style');
    return st ? html.replace('class="card', `style="${st}" class="card`) : html;
  }
  document.querySelectorAll('[data-card]').forEach((el) => { el.outerHTML = wrap(el, flavorCard(byId[el.dataset.card])); });
  document.querySelectorAll('[data-sup]').forEach((el) => { el.outerHTML = wrap(el, supCard(supByName[el.dataset.sup])); });
  document.querySelectorAll('[data-back]').forEach((el) => { el.outerHTML = wrap(el, '<div class="card back"><div class="emb"></div></div>'); });
  document.querySelectorAll('[data-set]').forEach((el) => {
    const [t, i] = el.dataset.set.split(':');
    el.outerHTML = wrap(el, setCard(t === 'bowl' ? 'ボウル' : 'HMD', (t === 'bowl' ? BOWLS : HMDS)[+i]));
  });
  document.querySelectorAll('[data-puff]').forEach((el) => {
    const [id, i] = el.dataset.puff.split(':'); const j = judgeById[id];
    el.outerHTML = wrap(el, puffCard(j, j.puffs[+i]));
  });
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
  const typeTag = (t) => `<span class="tag ${t === '技' ? 'k' : t === '器具' ? 'b' : t === '人物' ? 'g' : t === '炭' ? 'c' : ''}" style="margin:0">${t}</span>`;
  add('tbl-support', SUPPORT.map((s) => `<tr><td class="c">${typeTag(s.type)}</td>
    <td class="nw"><b>${s.n}</b></td><td class="c">${s.type === '炭' ? `<span class="small nw">着火${s.ig}・火${s.heat}</span>` : needHtml(s.need) + payTag(s)}</td><td class="c nw">${s.when === '炭' ? '<span class="small">自分のターン</span>' : whenTag(s.when) + extraTag(s)}</td><td style="line-height:1.35">${s.tx}</td></tr>`));
  add('tbl-judges', JUDGES.map((j) => `<tr><td class="nw"><b>${j.n}</b><br><span class="small">${j.t}</span></td>
    <td>${j.puffs.map((q) => `<span class="pchip ${q.dh > 0 ? 'up' : q.dh < 0 ? 'down' : ''}"><b>${q.style}</b>×${q.c}</span>`).join(' ')}</td><td>${j.tx}</td></tr>`));
  add('tbl-puffs', Object.values(PUFF).map((q) => `<tr><td class="nw"><b>${q.style}</b></td><td class="c"><span class="pchip ${q.dh > 0 ? 'up' : q.dh < 0 ? 'down' : ''}"><b>${dhMark(q)}</b></span></td><td>${q.stx}</td></tr>`));
  add('tbl-tours', TOURNAMENTS.map((t) => `<tr><td class="nw"><b>${t.n}</b></td><td class="c">${t.s}</td><td class="c">${t.s * 3}回</td><td class="c">${t.s * 3}枚</td><td class="c">${t.min}分</td>
    <td>${t.judges.length ? t.judges.map((id) => judgeById[id].n.split(' ')[0].replace('ダ・シルヴァ太陽', '太陽').replace('エミル・ユルマズ', 'エミル')).join('・') : 'なし（審査カードを使わない）'}</td><td>${t.task ? byId[t.task].n : 'なし'}</td></tr>`));
  const deck = (id, d) => { const u = document.getElementById(id); if (u) u.innerHTML = d.map(([n, c]) => `<li${supByName[n].type === '炭' ? ' class="coal"' : ''}>${n}<span>×${c}</span></li>`).join(''); };
  deck('deck-a', DECK_A); deck('deck-b', DECK_B);

  // 熱の動き（適温4〜6の葉の例）。線=蓄えた熱、丸=判定熱
  const hf = document.getElementById('heatfig');
  if (hf) {
    const prep = [1, 2, 3, 4];                          // 第0.8版: 熱は0から。準備の4ターンで、火力へ向かって1ずつ上がる
    const heat = [5, 4, 5, 5, 6, 5, 5, 4, 5];           // 自分のターンを終えたときの熱（動くのは1ターンに1）
    const dh = [0, 1, 0, 0, -1, 0, 0, 1, 0];            // 審査カードの変化
    const seq = [...prep, ...heat], n = seq.length;
    const W = 680, H = 118, L = 34, R = 8, T = 6, B = 26;
    const x = (i) => L + (W - L - R) * (i + 0.5) / n, y = (v) => T + (H - T - B) * (1 - v / 10);
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">`;
    s += `<rect x="${L}" y="${y(6.5)}" width="${W - L - R}" height="${y(3.5) - y(6.5)}" fill="#7fbd66" opacity=".35"/>`;
    s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${y(7.5) - T}" fill="#b5302a" opacity=".16"/>`;
    for (const v of [0, 2, 4, 6, 8, 10]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#cdbda2" stroke-width=".6"/><text x="${L - 6}" y="${y(v) + 3.5}" font-size="9.5" text-anchor="end" fill="#5d5148">${v}</text>`;
    const seg = [[0, 4, '準備（4ターン）', '#a8802f'], [4, 7, 'セッション 1', '#e2591f'], [7, 10, 'セッション 2', '#c94a17'], [10, 13, 'セッション 3', '#e2591f']];
    for (const [a, b, t, c] of seg) { const xa = L + (W - L - R) * a / n, xb = L + (W - L - R) * b / n;
      s += `<rect x="${xa + 1}" y="${H - 20}" width="${xb - xa - 2}" height="14" rx="3" fill="${c}"/><text x="${(xa + xb) / 2}" y="${H - 9.5}" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">${t}</text>`; }
    s += `<polyline fill="none" stroke="#1f1b19" stroke-width="2.2" stroke-linejoin="round" points="${seq.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`;
    seq.forEach((v, i) => { s += `<circle cx="${x(i)}" cy="${y(v)}" r="3.4" fill="#fff" stroke="#1f1b19" stroke-width="1.5"/>`; });
    heat.forEach((v, k) => { const i = prep.length + k, j = v + dh[k];
      if (dh[k]) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(v)}" y2="${y(j)}" stroke="#e2591f" stroke-width="1.6" stroke-dasharray="3 2"/>`;
      s += `<circle cx="${x(i)}" cy="${y(j)}" r="6.6" fill="#f5ad14" stroke="#1f1b19" stroke-width="1.6"/><text x="${x(i)}" y="${y(j) + 3.4}" font-size="8.5" font-weight="900" text-anchor="middle" fill="#1f1b19">${j}</text>`;
      if (dh[k]) s += `<text x="${x(i) + 9}" y="${y(v + dh[k] / 2) + 3}" font-size="8.5" font-weight="900" fill="#e2591f">${dh[k] > 0 ? '+1' : '−1'}</text>`; });
    s += `<text x="${L + 5}" y="${y(5.6) + 3.5}" font-size="9.5" font-weight="700" fill="#3f7a2c">適温 4〜6</text><text x="${L + 5}" y="${y(9) + 3.5}" font-size="9.5" font-weight="700" fill="#b5302a">焦げ 8〜</text>`;
    hf.innerHTML = s + '</svg><p class="small" style="margin:1mm 0 0">適温4〜6の葉の例。黒い線は自分のターンを終えたときの熱、黄色い丸は一口の判定熱。審査カードが「長く吸う」（+1）や「ゆっくり吸う」（−1）だと、判定熱は熱からずれます。熱5にしておけば、どちらに1ずれても適温の中です。提供では毎ターン炭が冷めて熱が2下がるので、新しい炭を足して保っています。</p>';
  }

  const sup = document.getElementById('supply');
  if (sup) {
    const first = ['lemon', 'mint', 'peach', 'white_gummy_bear', 'vanilla', 'double_apple', 'cinnamon', 'black_tea', 'rose', 'spring_water'];
    sup.innerHTML = first.map((id) => { const f = byId[id];
      return `<div style="background:var(--${f.k});border-radius:1mm;height:11mm;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-weight:700;font-size:5pt;line-height:1.2;border:.3mm solid #000;box-shadow:.5mm .5mm 0 #000,1mm 1mm 0 rgba(255,255,255,.25)">${f.n.replace('スプリングウォーター', 'スプリング<br>ウォーター').replace('ホワイトグミベア', 'ホワイト<br>グミベア').replace('ダブルアップル', 'ダブル<br>アップル').replace('ブラックティー', 'ブラック<br>ティー')}</div>`; }).join('');
  }
})();
