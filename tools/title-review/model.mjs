// Review data is independent of every production game save and asset manifest.
export const STORAGE_KEY = 'shisha-title-review-v4';
export const STATES = { unreviewed: '未判定', candidate: '採用候補', hold: '保留', reject: '見送り' };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseImport(value, catalog) {
  if (!plain(value) || value.application !== 'shisha-title-review' || value.version !== 1 || !plain(value.decisions)) {
    throw Error('選別JSONの形式またはバージョンが違います。');
  }
  const ids = new Set(catalog.items.map(a => a.id));
  const decisions = {};
  for (const [id, d] of Object.entries(value.decisions)) {
    if (!ids.has(id)) throw Error('目録にない画像IDが含まれています。元の目録を確認してください。');
    if (!plain(d) || !Object.hasOwn(STATES, d.status) || typeof d.note !== 'string' || d.note.length > 4000 || (d.updatedAt !== undefined && (typeof d.updatedAt !== 'string' || !Number.isFinite(Date.parse(d.updatedAt))))) {
      throw Error('判定・メモ・更新日時が不正です。変更は取り込んでいません。');
    }
    decisions[id] = { status: d.status, note: d.note, ...(d.updatedAt ? { updatedAt: d.updatedAt } : {}) };
  }
  return decisions;
}

export function exportData(decisions, catalog) {
  return { application: 'shisha-title-review', version: 1, exportedAt: new Date().toISOString(), decisions,
    images: catalog.items.filter(a => Object.hasOwn(decisions, a.id)).map(a => ({ id: a.id, sha256: a.sha256, character: a.character, label: a.label, current: a.current, sources: a.sources })) };
}

export function migrateLegacy(value, catalog) {
  if (!plain(value)) throw Error('旧保存の形式が不正です。');
  const map = new Map(catalog.items.flatMap(a => a.sources.map(p => [p, a.id])));
  const states = { adopt: 'candidate', hold: 'hold', reject: 'reject' };
  const decisions = {};
  for (const [source, state] of Object.entries(value)) {
    if (!map.has(source) || !states[state]) throw Error('旧保存に不明な画像または判定があります。旧データは保持しています。');
    const id = map.get(source);
    if (decisions[id] && decisions[id].status !== states[state]) throw Error('同じ原画の旧判定が一致しません。旧JSONを確認してください。');
    decisions[id] = { status: states[state], note: 'PR #387試作の判定から移行（正式採用の意味ではありません）' };
  }
  return decisions;
}

export const REVIEW_URL = 'https://haseatsu114514-dot.github.io/shisha-game/tools/title-review/';
const githubSource = p => 'https://github.com/haseatsu114514-dot/shisha-game/blob/main/' + p.split('/').map(encodeURIComponent).join('/');
export function correctionMemo(art, decision, catalog) {
  const note = decision?.note || '';
  if (!note.trim()) throw Error('修正したい点をメモに入力してください。');
  return [
    `## ${catalog.characters[art.character]} / ${art.label}`,
    `- 内部ID: ${art.character}`,
    `- 原画SHA256: ${art.sha256}`,
    `- 選別判定: ${STATES[decision.status] || STATES.unreviewed}`,
    `- 本編の使用: ${art.current ? '使用中' : '未使用'}`,
    `- 系統: ${art.groups.join(' / ')}`,
    `- 比較・選別画面: ${REVIEW_URL}`,
    `- 表示画像: ${REVIEW_URL}${art.image}`,
    '- 原画:', ...art.sources.map(p => `  - ${githubSource(p)}`),
    '', '### 修正したい点', note,
    '', '画像の正式採用と本編反映はオーナー判断。元原画は保持してください。',
  ].join('\n');
}
export function correctionText(decisions, catalog, ids) {
  const items = catalog.items.filter(a => (!ids || ids.includes(a.id)) && (decisions[a.id]?.note || '').trim());
  if (!items.length) throw Error('書き出せるメモがありません。画像を開いて修正したい点を入力してください。');
  return [
    '# タイトルCGの修正依頼メモ',
    '', '以下の画像別メモをGitHub Issueに整理してください。原画・既存Issueを確認し、同じ修正依頼があれば追記し、重複作成を避けてください。',
    'まずIssueへの保存を行い、画像の修正・生成・本編採用は別の依頼として扱ってください。',
    `対象リポジトリ: https://github.com/haseatsu114514-dot/shisha-game`,
    `メモ件数: ${items.length}`, '',
    ...items.map(a => correctionMemo(a, decisions[a.id], catalog)), '',
  ].join('\n\n');
}
export function correctionIssueDraft(art, decision, catalog) {
  const title = `[CG修正] ${catalog.characters[art.character]}：${art.label}`;
  const body = correctionMemo(art, decision, catalog);
  const url = new URL('https://github.com/haseatsu114514-dot/shisha-game/issues/new');
  url.searchParams.set('title', title); url.searchParams.set('body', body);
  // Encoded Japanese text can exceed URL limits on browsers/proxies. Never truncate a note.
  return { title, body, url: url.href.length <= 6000 ? url.href : null };
}
