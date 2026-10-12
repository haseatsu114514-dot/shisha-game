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
