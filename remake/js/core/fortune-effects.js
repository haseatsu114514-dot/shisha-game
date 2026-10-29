// Fortune's one-visit affinity bonus remains in state.fortune. Sight has its own lifetime.
import { relationshipElapsedDay } from "./chapter-clock.js";

export const FORTUNE_SIGHT_DAYS = 3;
const SIGHT_KEY = '_fortune_choice_sight';
export function naruRiftActive(save) {
  const flags = save?.flags;
  return (save?.chapter || 1) >= 2 && !!(
    flags?._ch2_read_ch2_naru_confrontation
    || flags?._ch2_night_11_done
    || flags?._ch2_naru_listened
    || flags?._ch2_naru_hurt
  );
}
export function isFortuneTargetAvailable(save, charId) {
  return typeof charId === 'string' && charId.length > 0 && !(charId === 'naru' && naruRiftActive(save));
}
export function fortuneTargets(save, characters = {}) {
  return Object.keys(save?.affinity || {}).filter(
    id => save?.met?.[id] && characters?.[id] && isFortuneTargetAvailable(save, id)
  );
}
function normalizeSeenTrivia(raw, char, entries) {
  const validIds = new Set(entries.map(e => e.id));
  const seen = new Set();
  if (Array.isArray(raw)) {
    for (const id of raw) {
      if (typeof id === 'string' && validIds.has(id)) seen.add(id);
    }
  } else if (Number.isInteger(raw) && raw > 0) {
    const mask = raw & 31;
    for (let bit = 0; bit < 5; bit += 1) {
      if (mask & (1 << bit)) {
        const legacyId = `${char}_${bit + 1}`;
        if (validIds.has(legacyId)) seen.add(legacyId);
      }
    }
  }
  return seen;
}
export function activeFortuneSight(save) {
  const sight = save?.flags?.[SIGHT_KEY];
  return sight && typeof sight.char === 'string' && isFortuneTargetAvailable(save, sight.char)
    && Number.isInteger(sight.chapter) && sight.chapter <= save.chapter
    && Number.isInteger(sight.from) && sight.from > 0 && Number.isInteger(sight.until) && sight.until === sight.from + FORTUNE_SIGHT_DAYS - 1
    && relationshipElapsedDay(save) >= sight.from && relationshipElapsedDay(save) <= sight.until ? sight : null;
}
export function grantFortuneReading(save, char, trivia) {
  if (!isFortuneTargetAvailable(save, char)) return null;
  save.fortune = { char };
  const day = relationshipElapsedDay(save);
  save.flags[SIGHT_KEY] = { char, chapter: save.chapter, from: day, until: day + FORTUNE_SIGHT_DAYS - 1 };
  const entries = trivia?.characters?.[char] || [];
  if (!entries.length) return null; // Old/custom targets keep their original reading.
  const key = `_fortune_trivia_seen_${char}`;
  const seen = normalizeSeenTrivia(save.flags[key], char, entries);
  if (seen.size >= entries.length) seen.clear();
  const available = entries.filter(e => !seen.has(e.id));
  const seed = Math.abs(Math.trunc(save.seed || 0)) + save.day * 7 + [...char].reduce((n, c) => n + c.charCodeAt(0), 0);
  const picked = available[seed % available.length];
  seen.add(picked.id);
  save.flags[key] = [...seen];
  return picked;
}
export const fortuneResultId = entry => `remake_fortune_trivia_${entry.id}`;
export function registerFortuneReadings(db) {
  const base = db.dialogues?.remake_fortune_result;
  if (!base || !base.lines) return;
  for (const entries of Object.values(db.fortuneTrivia?.characters || {})) for (const entry of entries) {
    const id = fortuneResultId(entry);
    db.dialogues[id] = { ...base, dialogue_id: id, lines: [
      ...base.lines.slice(0, -1),
      { speaker: 'uranaishi', face: 'normal', text: '二つの言葉に迷ったら、あの人に届く方が赤く見える。今日を含めて三日間だよ' },
      { speaker: 'uranaishi', face: 'normal', text: entry.teller },
      { speaker: 'hajime', face: 'normal', text: entry.reaction },
    ] };
  }
  const offer = db.dialogues?.remake_fortune_offer;
  if (offer && offer.lines?.length) db.dialogues.remake_fortune_offer = { ...offer, lines: [offer.lines[0],
    { speaker: 'uranaishi', face: 'normal', text: '次に会うときの縁をひと押し。それと三日間、あの人に届く言葉が見えるおまじないだよ' }, ...offer.lines.slice(1)] };
}
// Authored response hints, never a global preference for the first option.
export function fortuneChoiceIndex(save, dialogueId, line, data) {
  const sight = activeFortuneSight(save);
  if (!sight || line?.choices?.length !== 2) return -1;
  const key = `${dialogueId}:${line.id || ''}`;
  const hint = data?.choices?.[key];
  if (!hint || hint.target !== sight.char || hint.kind === 'taste' || hint.kind === 'purchase'
    || hint.kind === 'romance' && !data.includeRomance) return -1;
  const options = line.choices.map(c => String(c.next || c.next_id || ''));
  if (!hint.options || hint.options.length !== 2 || hint.options.some((v, i) => v !== options[i])) return -1;
  const index = options.indexOf(hint.preferred);
  const c = line.choices[index];
  return !c || c.condition_type === 'money' && save.money < Number(c.threshold || 0) ? -1 : index;
}
