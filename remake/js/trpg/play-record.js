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
  const companions = [];
  for (const [seat, optionId] of Object.entries(result.companions || {})) {
    const player = table.cast.find(c => (c.seat || c.id) === seat && c.part !== "GM")?.id;
    const option = table.companionBuilds?.[seat]?.[player]?.find(o => o.id === optionId);
    if (option) {
      sheets[seat] = option;
      companions.push(option);
    }
  }
  if (result.pc) sheets[table.builder?.seat || PLAYER_SEAT] = result.pc;
  const text = value => String(value ?? "")
    .replace(/\{pc:([a-z]+)\}/g, (_, seat) => sheets[seat]?.name || "")
    .replace(/\{pc\}/g, sheets[PLAYER_SEAT]?.name || "")
    .replace(/\{pcTitle\}/g, sheets[PLAYER_SEAT]?.title || "")
    .replace(/\{gm\}/g, name(memory.gm));

  const ending = table.endings[result.ending];
  const scripts = new Map(table.dialogues.map(block => [block.dialogue_id, block.lines]));
  const lines = [...companions.map(option => option.aside), ending.dialogue, table.debrief?.[result.variant], table.epilogue,
    ...companions.map(option => option.after)]
    .flatMap(block => typeof block === "string" ? scripts.get(block) || [] : block || [])
    .map(frame => {
      const speaker = frame.speaker === "samechan" && frame.voice === "korochan" ? "コロちゃん" : name(frame.speaker);
      const role = text(frame.role).replace(/^(?:GM|PL|コロちゃん)／卓の会話$/, "");
      return [[speaker, role].filter(Boolean).join(" · "), text(frame.text)];
    });
  const choices = [], stages = [];
  function addChoice(label, choice) {
    if (choice) choices.push(label + "：" + text(choice));
  }

  const grade = { success: "うまくいった", mixed: "ひと手間かかる", trouble: "思わぬ出来事" };
  function rollNote(roll, title, approach) {
    return [title, text(approach), roll.dice.join(" ＋ ") + " ＋ 補正" + roll.bonus + " ＝ " + roll.total,
      grade[roll.grade], roll.rerolled && "振り直し", roll.helper && name(roll.helper) + "の助力"].filter(Boolean).join(" · ");
  }
  const checks = [...(result.checks || [])];
  if (result.search) checks.splice(1, 0, { ...result.search, kind: "search" });
  const rolls = checks.map(check => rollNote(check, check.kind === "search" ? "じっくり調べる" : table.checks[check.kind]?.title,
    table.checks[check.kind]?.approaches?.find(approach => approach.id === check.approach)?.label));

  // A scene stores an index range into choices and, when present, one settled roll.
  // Within investigation the record does not say when a closer look happened.
  function addStage(title, kind, addChoices = () => {}) {
    const first = choices.length;
    addChoices();
    const roll = checks.findIndex(check => check.kind === kind);
    if (choices.length > first || roll !== -1) stages.push([title, first, choices.length, roll]);
  }
  addStage("聞き込み", "listen");
  addStage("質問", null, () => {
    for (const id of result.asked || []) addChoice("質問", table.interview?.topics?.find(topic => topic.id === id)?.label);
  });
  addStage("調査", "search", () => {
    for (const id of result.clues || []) addChoice("調べた場所", table.spots.find(spot => spot.id === id)?.label);
  });
  addStage("見立て", null, () => {
    addChoice("見立て", table.hypotheses.find(hypothesis => hypothesis.id === result.hypothesis)?.label);
  });
  const flow = table.flow || { prepare: ["aroma", "seat"], serve: ["approach"] };
  for (const kind of ["twist", "prepare", "serve"]) {
    addStage(table.presentation.phases?.[kind]?.title || table.checks[kind]?.title, kind, () => {
      for (const field of flow[kind] || []) {
        const id = result.plan?.[field];
        addChoice(table.presentation.fields?.[field] || field, table.options[field]?.find(option => option.id === id)?.label);
      }
    });
  }

  return {
    play, chapter: memory.chapter, day: chapterDay(state), title: table.title, ending: memory.endingTitle,
    endingLine: ending.line || "", participants: memory.participants.map(name), choices, rolls, lines, stages,
  };
}

function stagedScenes(record) {
  if (!Array.isArray(record.stages)) return null;
  const scenes = [];
  let nextChoice = 0, nextRoll = 0;
  for (const stage of record.stages) {
    if (!Array.isArray(stage) || stage.length !== 4) return null;
    const [title, first, last, roll] = stage;
    if (typeof title !== "string" || !title || first !== nextChoice || !Number.isInteger(last)
      || last < first || last > record.choices.length || (first === last && roll === -1)
      || (roll !== -1 && (roll !== nextRoll || roll >= record.rolls.length))) return null;
    scenes.push({ title, choices: record.choices.slice(first, last), rolls: roll === -1 ? [] : [record.rolls[roll]] });
    nextChoice = last;
    if (roll !== -1) nextRoll++;
  }
  return nextChoice === record.choices.length && nextRoll === record.rolls.length ? scenes : null;
}

/** Older records have the saved text but not its scene grouping. Never infer order from today's script. */
export function trpgReplayScenes(record) {
  const ordered = stagedScenes(record);
  const scenes = ordered || [
    { title: "選んだこと", choices: record.choices, rolls: [] },
    { title: "判定結果", choices: [], rolls: record.rolls },
  ].filter(scene => scene.choices.length || scene.rolls.length);
  return { grouped: !ordered, scenes: [...scenes, { title: "結末・後日談", ending: true }] };
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
