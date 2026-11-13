// セーブ引っ越しのスロット外記録。設定・本文既読・現在のstateには触れない。
import { GALLERY_PROGRESS_KEY, normalizeGalleryProgress, purikuraId } from "./gallery-progress.js";
import { CYCLE_META_KEY, CYCLE_META_VERSION, normalizeCycleMeta } from "./cycle-meta.js";

const CG_KEY = "suien_remake_gallery";
export const TRANSFER_PROGRESS_KEYS = [CG_KEY, GALLERY_PROGRESS_KEY, CYCLE_META_KEY];
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const union = (a, b) => [...new Set([...a, ...b])];

function normalize(key, value) {
  if (key === CG_KEY) {
    if (!Array.isArray(value) || value.some(id => typeof id !== "string")) throw Error("invalid CG record");
    return union([], value);
  }
  if (!object(value)) throw Error("invalid progress record");
  if (key === CYCLE_META_KEY) {
    if (value.version !== CYCLE_META_VERSION) throw Error("unsupported cycle record");
    return normalizeCycleMeta(value);
  }
  return normalizeGalleryProgress(value);
}

/** 不正・未来形式は欠落と見なさず失敗させる。呼出側は何も書き込まない。 */
export function parseTransferProgress(value) {
  if (!object(value)) throw Error("invalid progress envelope");
  return Object.fromEntries(Object.entries(value).map(([key, raw]) => {
    if (!TRANSFER_PROGRESS_KEYS.includes(key) || typeof raw !== "string") throw Error("unknown progress key");
    return [key, normalize(key, JSON.parse(raw))];
  }));
}

export function exportTransferProgress() {
  const raw = {};
  for (const key of TRANSFER_PROGRESS_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) raw[key] = value;
  }
  // 壊れた記録を黙って落とした書き出しを作らない。
  parseTransferProgress(raw);
  return raw;
}

function mergeGallery(a, b) {
  const photos = new Map(a.purikura.map(p => [purikuraId(p), p]));
  for (const p of b.purikura) {
    const old = photos.get(purikuraId(p));
    photos.set(purikuraId(p), { ...p, ...old, ...(old?.chapterDay ? {} : p.chapterDay ? { chapterDay: p.chapterDay } : {}) });
  }
  const routes = { ...a.routeRecords };
  for (const [id, r] of Object.entries(b.routeRecords)) {
    const old = routes[id];
    routes[id] = { becameLover: r.becameLover || old?.becameLover === true,
      eventsSeen: union(old?.eventsSeen || [], r.eventsSeen), trueEndAsLover: r.trueEndAsLover || old?.trueEndAsLover === true };
  }
  return { completeAnnounced: a.completeAnnounced || b.completeAnnounced,
    clearedChapters: union(a.clearedChapters, b.clearedChapters).sort(), keepsakes: union(a.keepsakes, b.keepsakes),
    purikura: [...photos.values()], routeRecords: routes };
}

function mergeCycle(a, b) {
  const ends = new Map(a.trueEnds.map(e => [e.cycleId, e]));
  for (const e of b.trueEnds) {
    const old = ends.get(e.cycleId);
    ends.set(e.cycleId, old ? { ...old, loversAtEnd: union(old.loversAtEnd, e.loversAtEnd) } : e);
  }
  const time = p => Date.parse(p?.at);
  const newer = a.carryPackage && b.carryPackage && Number.isFinite(time(a.carryPackage))
    && Number.isFinite(time(b.carryPackage)) && time(b.carryPackage) > time(a.carryPackage);
  return { version: CYCLE_META_VERSION, unlocked: a.unlocked || b.unlocked, trueEnds: [...ends.values()],
    highestCycleStarted: Math.max(a.highestCycleStarted, b.highestCycleStarted),
    // 同時刻・日時不明は移行先を保持。複数パッケージの能力・所持品を足し合わせない。
    carryPackage: !a.carryPackage || newer ? b.carryPackage : a.carryPackage,
    // 周回別の内訳が保存されていないため、足して重複計上しない。
    lifetime: { tournamentWins: Math.max(a.lifetime.tournamentWins, b.lifetime.tournamentWins),
      tournamentAttempts: Math.max(a.lifetime.tournamentAttempts, b.lifetime.tournamentAttempts) } };
}

/** 現在の保存領域と統合した書込み計画。失敗時は例外にし、呼出側で書込み前に止める。 */
export function mergedTransferProgress(progress) {
  return Object.entries(progress).map(([key, incoming]) => {
    const raw = localStorage.getItem(key);
    const old = raw === null ? null : normalize(key, JSON.parse(raw));
    const value = old === null ? incoming : key === CG_KEY ? union(old, incoming)
      : key === GALLERY_PROGRESS_KEY ? mergeGallery(old, incoming) : mergeCycle(old, incoming);
    return { key, raw: JSON.stringify(value) };
  });
}
