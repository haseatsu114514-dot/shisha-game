// Fortune's one-visit affinity bonus remains in state.fortune. Sight has its own lifetime.
import { relationshipElapsedDay } from "./chapter-clock.js";

export const FORTUNE_SIGHT_DAYS = 3;
const SIGHT_KEY = '_fortune_choice_sight';
export function activeFortuneSight(save) {
  const sight = save?.flags?.[SIGHT_KEY];
  return sight && typeof sight.char === 'string' && Number.isInteger(sight.chapter) && sight.chapter <= save.chapter
    && Number.isInteger(sight.from) && sight.from > 0 && Number.isInteger(sight.until) && sight.until === sight.from + FORTUNE_SIGHT_DAYS - 1
    && relationshipElapsedDay(save) >= sight.from && relationshipElapsedDay(save) <= sight.until ? sight : null;
}
export function grantFortuneReading(save, char, trivia) {
  save.fortune = { char };
  const day = relationshipElapsedDay(save);
  save.flags[SIGHT_KEY] = { char, chapter: save.chapter, from: day, until: day + FORTUNE_SIGHT_DAYS - 1 };
  const entries = trivia?.characters?.[char] || [];
  if (!entries.length) return null; // Old/custom targets keep their original reading.
  const key = `_fortune_trivia_seen_${char}`;
  let mask = Number.isInteger(save.flags[key]) ? save.flags[key] & 31 : 0;
  if (mask === 31) mask = 0;
  const available = entries.map((_, i) => i).filter(i => !(mask & (1 << i)));
  const seed = Math.abs(Math.trunc(save.seed || 0)) + save.day * 7 + [...char].reduce((n, c) => n + c.charCodeAt(0), 0);
  const index = available[seed % available.length];
  save.flags[key] = mask | (1 << index);
  return entries[index];
}
export const fortuneResultId = entry => `remake_fortune_trivia_${entry.id}`;
export function registerFortuneReadings(db) {
  const base = db.dialogues.remake_fortune_result;
  if (!base) return;
  for (const entries of Object.values(db.fortuneTrivia?.characters || {})) for (const entry of entries) {
    const id = fortuneResultId(entry);
    db.dialogues[id] = { ...base, dialogue_id: id, lines: [
      ...base.lines.slice(0, -1),
      { speaker: 'uranaishi', face: 'normal', text: '二つの言葉に迷ったら、あの人に届く方が赤く見える。今日を含めて三日間だよ' },
      { speaker: 'uranaishi', face: 'smile', text: entry.teller },
      { speaker: 'hajime', face: 'normal', text: entry.reaction },
    ] };
  }
  const offer = db.dialogues.remake_fortune_offer;
  if (offer) db.dialogues.remake_fortune_offer = { ...offer, lines: [offer.lines[0],
    { speaker: 'uranaishi', face: 'smile', text: '次に会うときの縁をひと押し。それと三日間、あの人に届く言葉が見えるおまじないだよ' }, ...offer.lines.slice(1)] };
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
