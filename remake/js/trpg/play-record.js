import { chapterDay } from "../core/chapter-clock.js";
import { displayName } from "./presentation.js";
import { PLAYER_SEAT, sheetsOf } from "./session.js";

// Keep existing records when the shelf is full. These limits count JSON code units,
// so the same saves can be kept in the auto slot, manual slot, and NG+ carry package.
export const TRPG_RECORDS_PER_STORY = 6;
export const TRPG_RECORD_ARCHIVE_LIMIT = 180_000;
const RECORD_LIMIT = 12_000;

const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
export function savedTrpgRecords(memory) {
  if (!Array.isArray(memory?.records)) return [];
  return memory.records.filter(record => Number.isSafeInteger(record?.play) && record.play > 0
    && Number.isInteger(record.chapter) && Number.isInteger(record.day)
    && typeof record.title === "string" && typeof record.ending === "string" && typeof record.endingLine === "string"
    && strings(record.participants) && strings(record.choices) && strings(record.rolls)
    && Array.isArray(record.lines) && record.lines.every(line => strings(line) && line.length === 2));
}

/** Snapshot the result and the authored blocks that the ending callback has just finished. */
export function buildTrpgPlayRecord(table, result, memory, state, play, characters = []) {
  const name = id => displayName(characters, id);
  const sheets = { ...sheetsOf(table) };
  for (const [seat, optionId] of Object.entries(result.companions || {})) {
    const player = table.cast.find(c => (c.seat || c.id) === seat && c.part !== "GM")?.id;
    const option = table.companionBuilds?.[seat]?.[player]?.find(o => o.id === optionId);
    if (option) sheets[seat] = option;
  }
  if (result.pc) sheets[table.builder?.seat || PLAYER_SEAT] = result.pc;
  const text = value => String(value ?? "")
    .replace(/\{pc:([a-z]+)\}/g, (_, seat) => sheets[seat]?.name || "")
    .replace(/\{pc\}/g, sheets[PLAYER_SEAT]?.name || "")
    .replace(/\{pcTitle\}/g, sheets[PLAYER_SEAT]?.title || "")
    .replace(/\{gm\}/g, name(memory.gm));

  const ending = table.endings[result.ending];
  const scripts = new Map(table.dialogues.map(block => [block.dialogue_id, block.lines]));
  const lines = [ending.dialogue, table.debrief?.[result.variant], table.epilogue]
    .flatMap(block => typeof block === "string" ? scripts.get(block) || [] : block || [])
    .map(frame => {
      const speaker = frame.speaker === "samechan" && frame.voice === "korochan" ? "コロちゃん" : name(frame.speaker);
      const role = text(frame.role).replace(/^(?:GM|PL|コロちゃん)／卓の会話$/, "");
      return [[speaker, role].filter(Boolean).join(" · "), text(frame.text)];
    });
  const choices = [];
  function addChoice(label, choice) {
    if (choice) choices.push(label + "：" + text(choice));
  }
  for (const id of result.asked || []) addChoice("質問", table.interview?.topics?.find(topic => topic.id === id)?.label);
  for (const id of result.clues || []) addChoice("調べた場所", table.spots.find(spot => spot.id === id)?.label);
  addChoice("見立て", table.hypotheses.find(hypothesis => hypothesis.id === result.hypothesis)?.label);
  for (const [field, id] of Object.entries(result.plan || {})) {
    addChoice(table.presentation.fields?.[field] || field, table.options[field]?.find(option => option.id === id)?.label);
  }

  const grade = { success: "うまくいった", mixed: "ひと手間かかる", trouble: "思わぬ出来事" };
  function rollNote(roll, title, approach) {
    return [title, text(approach), roll.dice.join(" ＋ ") + " ＋ 補正" + roll.bonus + " ＝ " + roll.total,
      grade[roll.grade], roll.rerolled && "振り直し", roll.helper && name(roll.helper) + "の助力"].filter(Boolean).join(" · ");
  }
  const rolls = (result.checks || []).map(check => rollNote(check, table.checks[check.kind]?.title,
    table.checks[check.kind]?.approaches?.find(approach => approach.id === check.approach)?.label));
  if (result.search) rolls.splice(1, 0, rollNote(result.search, "じっくり調べる"));
  return {
    play, chapter: memory.chapter, day: chapterDay(state), title: table.title, ending: memory.endingTitle,
    endingLine: ending.line || "", participants: memory.participants.map(name), choices, rolls, lines,
  };
}

export function appendTrpgPlayRecord(cleared, scenarioId, record) {
  const prior = cleared[scenarioId]?.records;
  if (prior !== undefined && !Array.isArray(prior)) return prior;
  const records = prior || [];
  const size = JSON.stringify(record).length;
  if (records.length >= TRPG_RECORDS_PER_STORY || size > RECORD_LIMIT
    || records.some(previous => previous?.play === record.play)) return prior;

  const archiveSize = Object.values(cleared).reduce((total, memory) =>
    total + (Array.isArray(memory?.records) ? JSON.stringify(memory.records).length : 0), 0);
  if (archiveSize + size + 2 > TRPG_RECORD_ARCHIVE_LIMIT) return prior;
  return [...records, record];
}
