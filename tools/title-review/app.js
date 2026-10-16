import { STORAGE_KEY, STATES, parseImport, exportData, migrateLegacy, correctionText, correctionIssueDraft } from './model.mjs';
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
let catalog, decisions = {}, selected = [], pending = null, storageBroken = false;
const notice = text => { $('notice').textContent = text; $('notice').hidden = false; };
const dFor = id => decisions[id] || { status: 'unreviewed', note: '' };
const name = art => catalog.characters[art.character];
const sourceUrl = p => 'https://github.com/haseatsu114514-dot/shisha-game/blob/main/' + p.split('/').map(encodeURIComponent).join('/');

function save() {
  try {
    if (storageBroken) throw Error('破損した保存データを保護しています');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...exportData(decisions, catalog), selected, filters: filterValues() }));
    $('save-state').textContent = 'このブラウザに保存済み';
  } catch (error) {
    $('save-state').textContent = 'ブラウザ保存できません — JSONを書き出してください';
    notice('保存できません。選別内容はこの画面で保持しています。ページを閉じる前にJSONを書き出してください。' + (storageBroken ? ' 破損した既存保存は上書きしていません。' : ''));
  }
}
function filterValues() { return Object.fromEntries(['character','group','decision','current','search'].map(id => [id, $(id).value])); }
function setDecision(id, change) {
  decisions[id] = { ...dFor(id), ...change, updatedAt: new Date().toISOString() };
  save(); updateSummary(); updateNoteExport();
  document.querySelectorAll(`[data-decision-for="${id}"]`).forEach(badge => { badge.textContent = STATES[dFor(id).status]; badge.className = 'badge decision-badge ' + dFor(id).status; });
}
function image(art, thumb = false) {
  const wrap = el('div'); const im = el('img'); im.src = thumb ? art.thumbnail : art.image; im.alt = name(art) + '：' + art.label;
  if (thumb) im.loading = 'lazy'; im.decoding = 'async';
  im.onerror = () => { im.hidden = true; const error = el('p', '画像を読み込めません：' + art.label + '。再読み込みまたは原画リンクを確認してください。', 'image-error'); im.parentElement?.append(error); };
  wrap.append(im); return wrap;
}
function badges(art) {
  const row = el('div', undefined, 'badges');
  row.append(el('span', art.current ? '本編使用中' : '本編未使用', 'badge ' + (art.current ? 'live' : '')), el('span', STATES[dFor(art.id).status], 'badge decision-badge ' + dFor(art.id).status));
  row.querySelector('.decision-badge').dataset.decisionFor = art.id;
  return row;
}
function toggle(art) {
  if (selected.includes(art.id)) selected = selected.filter(id => id !== art.id);
  else if (selected.length >= 4) { notice('比較は4枚までです。選択を一つ解除してから追加してください。'); return; }
  else selected.push(art.id);
  if ($('notice').textContent.includes('比較は4枚まで')) $('notice').hidden = true;
  updateTray(); save();
}
function updateTray() {
  $('selected-count').textContent = `比較 ${selected.length} / 4枚`;
  $('compare').disabled = selected.length < 2;
  document.querySelectorAll('.card').forEach(card => {
    const active = selected.includes(card.dataset.art); card.classList.toggle('selected', active);
    const b = card.querySelector('.select-art'); b.setAttribute('aria-pressed', String(active)); b.textContent = active ? '比較から外す ✓' : '比較に追加 ＋';
  });
}
function filtered() {
  const f = filterValues(), q = f.search.toLowerCase();
  return catalog.items.filter(a => (!f.character || a.character === f.character) && (!f.group || a.groups.includes(f.group)) && (!f.decision || dFor(a.id).status === f.decision) && (!f.current || a.current === (f.current === 'yes')) && (!q || [a.label, name(a), ...a.sources, ...a.history, dFor(a.id).note].join(' ').toLowerCase().includes(q)));
}
function updateSummary() {
  const counts = Object.fromEntries(Object.keys(STATES).map(s => [s, catalog.items.filter(a => dFor(a.id).status === s).length]));
  $('progress').textContent = `選別 ${catalog.items.length - counts.unreviewed} / ${catalog.items.length}枚 · 採用候補 ${counts.candidate} · 保留 ${counts.hold} · 見送り ${counts.reject}`;
}
function render() {
  const list = filtered(); $('gallery').replaceChildren(); $('empty').hidden = list.length > 0;
  $('count').textContent = `表示 ${list.length}枚 / 全${catalog.items.length}枚（正式タイトル ${catalog.summary.current}枚）`;
  list.forEach(art => {
    const card = el('article', undefined, 'card'); card.dataset.art = art.id;
    const open = el('button', undefined, 'art-button'); open.setAttribute('aria-label', name(art) + ' ' + art.label + 'の詳細'); open.append(image(art, true)); open.onclick = () => showDetail(art);
    const body = el('div', undefined, 'card-body'); body.append(badges(art), el('h3', name(art) + ' · ' + art.label), el('p', art.groups.join(' / '), 'subtle'));
    const b = el('button', '比較に追加 ＋', 'select-art'); b.onclick = () => toggle(art); body.append(b); card.append(open, body); $('gallery').append(card);
  }); updateSummary(); updateTray(); updateNoteExport();
}
function viewport(art) {
  const box = el('div', undefined, 'image-viewport'); const button = el('button'); button.setAttribute('aria-label', '画像を拡大／縮小');
  // Keep the image directly inside the zoom button for consistent containment.
  const content = image(art); button.append(...content.childNodes); box.append(button);
  button.onclick = () => { box.classList.toggle('zoomed'); button.setAttribute('aria-pressed', String(box.classList.contains('zoomed'))); };
  return box;
}
function references(art) {
  const section = el('details'); section.append(el('summary', '正式本人の顔・衣装を参照'));
  const row = el('div', undefined, 'references');
  for (const r of catalog.references[art.character] || []) {
    const fig = el('figure'), link = el('a'); link.href = sourceUrl(r.path); link.target = '_blank'; link.rel = 'noopener';
    const im = el('img'); im.src = r.url; im.alt = name(art) + ' ' + r.label;
    im.onerror = () => fig.append(el('p','正式参照を読み込めません。リンクで原画を確認してください。','image-error'));
    link.append(im); fig.append(link, el('figcaption', r.label)); row.append(fig);
  }
  section.append(row); return section;
}
function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), link = el('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function updateNoteExport() {
  const count = catalog.items.filter(a => (dFor(a.id).note || '').trim()).length;
  $('export-notes').disabled = count === 0;
  $('export-notes').textContent = count ? `修正メモを書き出す（TXT・${count}件）` : '修正メモを書き出す（TXT）';
}
function controls(art) {
  const box = el('div'); const buttons = el('div', undefined, 'judgements');
  for (const [state, label] of Object.entries(STATES)) {
    const b = el('button', label); b.dataset.status = state; b.setAttribute('aria-pressed', String(dFor(art.id).status === state));
    b.onclick = () => { setDecision(art.id, { status: state }); buttons.querySelectorAll('button').forEach(n => n.setAttribute('aria-pressed', String(n === b))); }; buttons.append(b);
  }
  const label = el('label', '修正・選別メモ（4000文字まで）'); const input = el('textarea'); input.maxLength = 4000; input.value = dFor(art.id).note; input.setAttribute('aria-label', name(art) + ' ' + art.label + 'の選別メモ');
  const actions = el('div', undefined, 'toolbar memo-actions');
  const text = el('button', 'この画像のメモ（TXT）'), issue = el('button', 'Issue下書きを開く');
  text.dataset.action = 'memo-text'; issue.dataset.action = 'issue-draft';
  const hint = el('p', undefined, 'subtle memo-hint'); hint.setAttribute('role', 'status');
  function updateActions() {
    const hasNote = dFor(art.id).note.trim().length > 0;
    text.disabled = issue.disabled = !hasNote;
    hint.textContent = hasNote ? 'IssueはGitHubで内容を確認して投稿します。TXTはAIに渡してIssue化を依頼できます。' : '修正したい点をメモに入力すると、TXT出力とIssue下書きを使えます。';
  }
  input.oninput = () => { setDecision(art.id, { note: input.value }); updateActions(); };
  text.onclick = () => downloadText(correctionText(decisions, catalog, [art.id]), `title-cg-${art.character}-${art.id.slice(0,8)}-memo.txt`);
  issue.onclick = () => {
    const draft = correctionIssueDraft(art, dFor(art.id), catalog);
    if (!draft.url) { hint.textContent = 'メモが長いためIssueの下書きURLに入りきりません。「この画像のメモ（TXT）」で全文を書き出し、AIに渡すかGitHubの本文へ貼り付けてください。'; return; }
    const opened = window.open(draft.url, '_blank');
    if (opened) opened.opener = null;
    else hint.textContent = '新しいタブが開けませんでした。ブラウザの設定を確認するか、TXTをGitHubの本文へ貼り付けてください。';
  };
  updateActions(); actions.append(text, issue); label.append(input); box.append(buttons, label, actions, hint); return box;
}
function provenance(art) {
  const box = el('details'); box.append(el('summary', '原画・生成指示・制作履歴'));
  box.append(el('p', `原画 ${art.size.join(' × ')} · SHA256 ${art.sha256}`, 'subtle'));
  const history = el('div', undefined, 'history'); art.history.forEach(t => history.append(el('p',t))); box.append(history);
  const list = el('ul', undefined, 'source-list');
  for (const p of [...art.sources, ...art.prompts]) { const li = el('li'), a = el('a', p); a.href = sourceUrl(p); a.target = '_blank'; a.rel = 'noopener'; li.append(a); list.append(li); }
  box.append(list); return box;
}
function related(art) {
  const box = el('details'); box.open = true; box.append(el('summary', '修正前後・関連画像（押すとこの画像と比較）'));
  const row = el('div', undefined, 'related');
  for (const id of art.related) {
    const a = catalog.items.find(a => a.id === id); const b = el('button'); b.append(image(a, true), el('span', a.label));
    b.onclick = () => { selected = [art.id, id]; updateTray(); save(); showCompare(); }; row.append(b);
  }
  if (!art.related.length) row.append(el('p', '前後関係の登録なし。一覧から他の画像と比較できます。', 'subtle'));
  box.append(row); return box;
}
function openViewer(title, node) { $('viewer-title').textContent = title; $('viewer-content').replaceChildren(node); if (!$('viewer').open) $('viewer').showModal(); $('viewer').scrollTop = 0; }
function showDetail(art) {
  const layout = el('div', undefined, 'detail-layout'); layout.append(viewport(art)); const panel = el('section', undefined, 'review-panel'); panel.dataset.id = art.id;
  panel.append(badges(art), el('h3', name(art) + ' · ' + art.label), controls(art), related(art), references(art), provenance(art)); layout.append(panel); openViewer('画像の詳細', layout);
}
function showCompare() {
  const grid = el('div', undefined, 'comparison'); grid.style.setProperty('--columns', selected.length);
  for (const id of selected) {
    const art = catalog.items.find(a => a.id === id), panel = el('section', undefined, 'review-panel'); panel.dataset.id = id;
    panel.append(viewport(art), badges(art), el('h3', name(art) + ' · ' + art.label), controls(art), references(art), provenance(art)); grid.append(panel);
  }
  openViewer(`${selected.length}枚を比較`, grid);
}
async function start() {
  const response = await fetch('catalog.json'); if (!response.ok) throw Error('目録を読み込めません。HTTP配信から開き、再読み込みしてください。');
  catalog = await response.json(); if (!Array.isArray(catalog.items) || !catalog.items.length) throw Error('目録が空か不正です。');
  for (const [id,label] of Object.entries(catalog.characters)) { const o = el('option', label); o.value = id; $('character').append(o); }
  for (const group of [...new Set(catalog.items.flatMap(a => a.groups))]) { const o = el('option', group); o.value = group; $('group').append(o); }
  $('inventory').textContent = `${catalog.summary.originalPaths}原画パスを、${catalog.summary.uniqueArt}枚に整理。重複 ${catalog.summary.duplicatePaths}件。正式タイトル ${catalog.summary.current}枚。`;
  $('missing').textContent = catalog.summary.missingHistoricalSlots.map(s => `${s.slot}：${s.reason || s.status}（原画未保存。画像が存在するとは扱いません）`).join(' / ');
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw); decisions = parseImport(saved,catalog);
      selected = Array.isArray(saved.selected) ? [...new Set(saved.selected.filter(id => catalog.items.some(a => a.id === id)))].slice(0,4) : [];
      if (saved.filters && typeof saved.filters === 'object') for (const [id,v] of Object.entries(saved.filters)) { if (['character','group','decision','current','search'].includes(id) && typeof v === 'string') $(id).value = v; }
    } else {
      const legacy = localStorage.getItem('shisha-title-review-v3');
      if (legacy) { decisions = migrateLegacy(JSON.parse(legacy),catalog); notice('試作PR #387の判定を移行しました。「採用」は採用候補として扱います。旧保存は保持しています。'); }
    }
    $('save-state').textContent = 'このブラウザで保存・再開';
  } catch(error) { storageBroken = true; $('save-state').textContent = '保存の読込に失敗'; notice('保存の読込に失敗しました：' + error.message + ' 既存保存を保持し、上書きを止めています。JSONで内容を退避できます。'); }
  for (const id of ['character','group','decision','current','search']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { render(); save(); });
  $('reset').onclick = () => { ['character','group','decision','current','search'].forEach(id => $(id).value = ''); render(); save(); };
  $('clear').onclick = () => { selected = []; updateTray(); save(); };
  $('compare').onclick = showCompare; $('close-viewer').onclick = () => $('viewer').close(); $('viewer').addEventListener('close',render);
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(exportData(decisions,catalog),null,2)],{type:'application/json'}), url = URL.createObjectURL(blob), link = el('a');
    link.href = url; link.download = 'title-review-decisions.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),2000);
  };
  $('export-notes').onclick = () => downloadText(correctionText(decisions, catalog), 'title-cg-correction-memos.txt');
  $('import').onclick = () => $('file').click();
  $('file').onchange = async () => {
    const file = $('file').files[0]; $('file').value = ''; if (!file) return;
    try { if (file.size > 2000000) throw Error('JSONは2MB以内にしてください。'); pending = parseImport(JSON.parse(await file.text()),catalog); $('import-preview').textContent = `${Object.keys(pending).length}枚の判定・メモを確認しました。`; $('import-dialog').showModal(); }
    catch(error) { pending = null; notice('JSONを取り込めません：' + error.message + ' 現在の判定・保存は変更していません。'); }
  };
  $('cancel-import').onclick = () => { pending = null; $('import-dialog').close(); };
  $('apply-import').onclick = () => { if (pending) { decisions = { ...decisions, ...pending }; pending = null; save(); render(); if ($('save-state').textContent === 'このブラウザに保存済み') $('notice').hidden = true; } $('import-dialog').close(); };
  render();
}
start().catch(error => { notice(error.message); $('save-state').textContent = '読み込み失敗'; $('export').disabled = true; $('import').disabled = true; });
