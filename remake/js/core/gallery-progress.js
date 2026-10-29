// コレクションの記録はセーブ枠と別。明示的なクリア・実際に受け取った写真だけを残す。
export const GALLERY_PROGRESS_KEY = "suien_remake_gallery_progress";
export const PHOTO_KEEPSAKES = {
  minto_first_cheki: "cg_minto_first_cheki",
  ageha_first_purikura: "cg_ageha_first_purikura",
  ryuji_purikura: "cg_ryuji_purikura",
};

const chapter = n => Number.isInteger(n) && n >= 1 && n <= 5;
const list = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(value)];

const charIdValid = id => typeof id === "string" && /^[a-z][a-z0-9_]*$/.test(id);
const eventStageValid = stage => typeof stage === "number" && Number.isFinite(stage)
  || typeof stage === "string" && stage.length > 0;
const emptyRouteRecord = () => ({ becameLover: false, eventsSeen: [], trueEndAsLover: false });

function routeRecords(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id]) => charIdValid(id)).flatMap(([id, record]) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const normalized = {
      becameLover: record.becameLover === true,
      eventsSeen: unique(list(record.eventsSeen).filter(eventStageValid)),
      trueEndAsLover: record.trueEndAsLover === true,
    };
    return normalized.becameLover || normalized.eventsSeen.length || normalized.trueEndAsLover
      ? [[id, normalized]] : [];
  }));
}

function photo(value) {
  if (!value || !chapter(value.chapter) || !Number.isInteger(value.day) || value.day < 1
    || ![0, 1, 2].includes(value.slot) || !["solo", "pair", "guest"].includes(value.mode)) return null;
  const people = list(value.people);
  if (people[0] !== "hajime" || people.length !== (value.mode === "solo" ? 1 : 2)
    || people.some(id => typeof id !== "string" || !/^[a-z][a-z0-9_]*$/.test(id))
    || unique(people).length !== people.length || value.mode === "pair" && people[1] !== "ageha") return null;
  return { chapter: value.chapter, day: value.day, slot: value.slot, mode: value.mode, people: [...people],
    ...(Number.isInteger(value.chapterDay) && value.chapterDay > 0 ? { chapterDay: value.chapterDay } : {}),
  };
}
export const purikuraId = p => ["purikura", p.chapter, p.day, p.slot, p.mode, ...p.people].join("-");

// 直近に読み込んだ保存文字列と、その parse 結果。save() の二重記録や
// ギャラリー表示時の全枠走査など、連続した readGalleryProgress() で
// parse を繰り返さないための控え。書き込みはすべてこのモジュール経由
// なので、保存のたびに無効化すれば実データとずれることはない。
let progressCacheRaw;
let progressCacheValue = null;
function invalidateProgressCache() {
  progressCacheRaw = undefined;
  progressCacheValue = null;
}

export function readGalleryProgress() {
  let raw = null;
  try { raw = localStorage.getItem(GALLERY_PROGRESS_KEY); } catch { /* 初回・保存不可 */ }
  if (progressCacheValue && progressCacheRaw === raw) return progressCacheValue;
  let value;
  try { value = JSON.parse(raw || "null"); } catch { /* 初回・保存不可 */ }
  const result = {
    completeAnnounced: value?.completeAnnounced === true,
    clearedChapters: unique(list(value?.clearedChapters).filter(chapter)).sort(),
    keepsakes: unique(list(value?.keepsakes).filter(id => Object.hasOwn(PHOTO_KEEPSAKES, id))),
    purikura: [...new Map(list(value?.purikura).map(photo).filter(Boolean).map(p => [purikuraId(p), p])).values()],
    routeRecords: routeRecords(value?.routeRecords),
  };
  progressCacheRaw = raw;
  progressCacheValue = result;
  return result;
}

export function recordGalleryProgress(value) {
  if (!value || typeof value !== "object") return;
  const before = readGalleryProgress();
  const cleared = [];
  for (let n = 1; n <= 5; n++) {
    if (value.flags?.["_ch" + n + "_cleared"] === true
      || value.flags?.["_ch" + n + "_cleared"] === 1) cleared.push(n);
  }
  // 接続済みの章の旧セーブ。章番号・日数・大会勝利・予告視聴だけではクリアとしない。
  if ([1, 2].includes(value.chapter) && value.phase === "cleared") cleared.push(value.chapter);
  const photos = list(value.flags?._ageha_purikura_history).map(photo).filter(Boolean).map(p => {
    // この写真を持つセーブの開始日だけを使う。別セーブの写真を推測で換算しない。
    const start = p.chapter === 2 ? value.flags?._ch2_day1?.startDay
      : p.chapter === 3 ? value.flags?._ch3_intro?.startDay : null;
    if (!p.chapterDay && (p.chapter === 1 || Number.isInteger(start) && start > 0 && p.day >= start)) {
      p.chapterDay = p.chapter === 1 ? p.day : p.day - start + 1;
    }
    return p;
  });
  const merged = new Map(before.purikura.map(p => [purikuraId(p), p]));
  for (const p of photos) {
    const id = purikuraId(p);
    merged.set(id, { ...merged.get(id), ...p }); // 日付のない旧セーブで補完済みの日付を消さない
  }
  const next = {
    completeAnnounced: before.completeAnnounced,
    clearedChapters: unique([...before.clearedChapters, ...cleared]).sort(),
    keepsakes: unique([...before.keepsakes, ...list(value.keepsakes).filter(id => Object.hasOwn(PHOTO_KEEPSAKES, id))]),
    purikura: [...merged.values()],
    routeRecords: before.routeRecords,
  };
  if (JSON.stringify(before) === JSON.stringify(next)) return;
  try { localStorage.setItem(GALLERY_PROGRESS_KEY, JSON.stringify(next)); invalidateProgressCache(); } catch { /* ゲームの保存は妨げない */ }
}

function saveRouteProgress(before, next) {
  if (JSON.stringify(before) === JSON.stringify(next)) return;
  try { localStorage.setItem(GALLERY_PROGRESS_KEY, JSON.stringify(next)); invalidateProgressCache(); } catch { /* ゲームの保存は妨げない */ }
}

export function shouldAnnounceCompletion(stats, progress) {
  return stats?.total > 0 && stats.unlocked === stats.total && progress?.completeAnnounced !== true;
}

export function markCompletionAnnounced() {
  const before = readGalleryProgress();
  if (before.completeAnnounced) return;
  saveRouteProgress(before, { ...before, completeAnnounced: true });
}

export function recordRouteLover(charId) {
  if (!charIdValid(charId)) return;
  const before = readGalleryProgress();
  const record = Object.hasOwn(before.routeRecords, charId) ? before.routeRecords[charId] : emptyRouteRecord();
  const next = { ...before, routeRecords: { ...before.routeRecords, [charId]: { ...record, becameLover: true } } };
  saveRouteProgress(before, next);
}

export function recordRouteEvent(charId, eventStage) {
  if (!charIdValid(charId) || !eventStageValid(eventStage)) return;
  const before = readGalleryProgress();
  const record = Object.hasOwn(before.routeRecords, charId) ? before.routeRecords[charId] : emptyRouteRecord();
  const next = { ...before, routeRecords: { ...before.routeRecords,
    [charId]: { ...record, eventsSeen: unique([...record.eventsSeen, eventStage]) },
  } };
  saveRouteProgress(before, next);
}

export function recordRouteTrueEnd(loversAtEnd) {
  if (!Array.isArray(loversAtEnd)) return;
  const before = readGalleryProgress();
  const records = { ...before.routeRecords };
  for (const charId of loversAtEnd) {
    if (!charIdValid(charId)) continue;
    const record = Object.hasOwn(records, charId) ? records[charId] : emptyRouteRecord();
    records[charId] = { ...record, trueEndAsLover: true };
  }
  const next = { ...before, clearedChapters: unique([...before.clearedChapters, 5]).sort(), routeRecords: records };
  saveRouteProgress(before, next);
}
