import { spendableMoney } from "../core/travel-budget.js";
// Campaign rules only. All mutations are explicit; this module has no DOM/storage.
const clone = value => JSON.parse(JSON.stringify(value));
const excluded = new Set(["sumi", "naru"]);
export const emptyTrpgProgress = () => ({ stock: [], owned: [], cleared: {}, club: { founded: null, members: {} } });

export function foundTrpgClub(state, catalog) {
  if (!state || state.chapter < catalog.unlockChapter || state.phase !== "daily" || state.trpg?.club?.founded) return false;
  state.trpg ||= emptyTrpgProgress();
  state.trpg.club = { founded: { chapter: state.chapter, day: state.day }, members: {} };
  return true;
}

/** Recruitment requires a real conversation; work schedules only affect the later table. */
export function recruitmentStatus(state, person, catalog) {
  if (!state || state.chapter < catalog.unlockChapter) return { ok: false, reason: "第2章から勧誘できる" };
  if (state.phase !== "daily") return { ok: false, reason: "街で会った時に誘おう" };
  if (!state.trpg?.club?.founded) return { ok: false, reason: "バーで部活を作ろう" };
  if (!person || excluded.has(person.id) || person.interested !== true) return { ok: false, reason: "参加対象外" };
  if (state.trpg.club.members?.[person.id]) return { ok: false, reason: "入部済み" };
  if (!state.met?.[person.id]) return { ok: false, reason: "まだ知り合っていない" };
  if (!(state.lovers || []).includes(person.id) && (state.affinity?.[person.id] || 0) < person.maxAffinity) {
    return { ok: false, reason: "好感度MAXになったら誘おう" };
  }
  return { ok: true, reason: "会った時に、部活へ誘える" };
}

export function joinTrpgClub(state, catalog, id) {
  const person = catalog.participants.find(p => p.id === id);
  if (!recruitmentStatus(state, person, catalog).ok) return false;
  state.trpg.club.members[id] = { chapter: state.chapter, day: state.day };
  return true;
}

export function participantStatus(state, person) {
  if (excluded.has(person.id)) return { ok: false, reason: "参加対象外" };
  if (!state.met?.[person.id]) return { ok: false, reason: "まだ知り合っていない" };
  if (!state.trpg?.club?.founded) return { ok: false, reason: "バーで部活を作ろう" };
  if (person.interested !== true || !state.trpg.club.members?.[person.id]) return { ok: false, reason: "会って部活へ勧誘しよう" };
  const override = (state.trpg?.shifts || []).find(s => s.id === person.id && s.chapter === state.chapter
    && s.day === state.day && s.slot === state.slot);
  const temporaryClosed = state.flags?.[`_temporary_closed_${person.id}`] === `${state.chapter}:${state.day}`;
  // 夜の卓は各店の営業が終わるまで待つ。通常シフトは昼だけを遮り、個別の予定は夜も優先する。
  const shift = override ? override.busy : state.slot === 0 && !temporaryClosed && (person.shifts || []).some(s =>
    s.slot === state.slot && s.days.includes(state.day % 7));
  if (shift) return { ok: false, reason: override?.reason || person.workLabel || "シフト中" };
  const invite = state.pendingInvite;
  if (invite?.sender === person.id && (invite.day ?? state.day) === state.day) return { ok: false, reason: "別の約束がある" };
  return { ok: true, reason: "今夜、参加できる" };
}

export function tableStatus(state, catalog, { nightBusy = false } = {}) {
  if (!state || state.chapter < (catalog.unlockChapter || 2)) return { ok: false, reason: "第2章から遊べる" };
  if (state.phase !== "daily") return { ok: false, reason: "街で過ごせる日に遊ぼう" };
  if (!state.trpg?.club?.founded) return { ok: false, reason: "まずは、この店で部活を作ろう" };
  if (state.slot !== 1) return { ok: false, reason: "卓を囲むのは夜の1枠" };
  if (nightBusy || state.pendingInvite && (state.pendingInvite.day ?? state.day) === state.day && state.pendingInvite.slot === 1) {
    return { ok: false, reason: "今夜は先に決まった予定がある" };
  }
  // #1045 B03: 卓は開けるが、仲間か本が欠けていると遊べない。今の不足と次の目標を一行で示す。
  const hasCompanion = (catalog?.participants || []).some(p => participantStatus(state, p).ok);
  const hasBook = (catalog?.scenarios || []).some(b => !state.trpg.cleared?.[b.id]
    && (state.trpg.owned?.includes(b.id) || state.trpg.stock?.includes(b.id)));
  if (!hasCompanion && !hasBook) return { ok: true, reason: "今は招集できる仲間／遊べる本がない。知り合いとの交流を深めよう" };
  if (!hasCompanion) return { ok: true, reason: "今夜来られる部員がいない。知り合いとの交流を深めよう" };
  if (!hasBook) return { ok: true, reason: "今は遊べる本がない。部員が増えると入荷する" };
  return { ok: true, reason: "今夜の卓を囲もう" };
}

/** Stock persists after the first eligible visit; a work shift never removes a book. */
export function syncTrpgStock(state, catalog) {
  if (!state || state.chapter < catalog.unlockChapter || !state.trpg?.club?.founded) return false;
  state.trpg ||= emptyTrpgProgress();
  let changed = false;
  for (const book of catalog.scenarios) {
    const ready = book.stockRequires.every(id => {
      const p = catalog.participants.find(p => p.id === id);
      return p && !excluded.has(id) && p.interested === true && !!state.trpg.club.members?.[id];
    });
    if (ready && !state.trpg.stock.includes(book.id)) { state.trpg.stock.push(book.id); changed = true; }
  }
  return changed;
}

export function buyTrpgBook(state, catalog, id) {
  const book = catalog.scenarios.find(b => b.id === id);
  if (!book || state.chapter < catalog.unlockChapter || !state.trpg?.stock.includes(id)
    || state.trpg.owned.includes(id) || !Number.isInteger(book.price) || book.price < 0 || spendableMoney(state) < book.price) return false;
  state.money -= book.price;
  state.trpg.owned.push(id);
  return true;
}

/** Deterministic casting: mandatory seats first, then free compatible companions. */
export function castTrpgTable(state, catalog, scenario, options = {}) {
  const ready = tableStatus(state, catalog, options);
  if (!ready.ok) return ready;
  if (state.trpg?.cleared?.[scenario.id]) return { ok: false, reason: "遊び終えた物語" };
  if (!state.trpg?.owned?.includes(scenario.id)) return { ok: false, reason: "本棚に加えると遊べる" };
  const available = new Set(catalog.participants.filter(p => participantStatus(state, p).ok).map(p => p.id));
  available.add("hajime");
  const used = new Set();
  const assignments = {};
  for (const seat of scenario.campaign.seats) {
    const id = seat.candidates.find(id => available.has(id) && !used.has(id) && !excluded.has(id));
    if (!id && seat.required) return { ok: false, reason: "今夜はGMの都合がつかない" };
    assignments[seat.actor] = id || null;
    if (id) used.add(id);
  }
  return { ok: true, assignments, participants: [...used], gm: assignments[scenario.cast.find(c => c.part === "GM").id] };
}

/** Authored alternatives are required for any replacement actor; never reuse another person's voice. */
export function materializeTrpgCast(scenario, assignments) {
  const table = clone(scenario);
  const gm = scenario.cast.find(c => c.part === "GM").id;
  if (!assignments[gm] || assignments.hajime !== "hajime") throw new Error("Missing required TRPG participant");
  if (Object.values(assignments).some(id => excluded.has(id))) throw new Error("Excluded TRPG participant");
  // PC sheets stay keyed by the authored seat: the character exists even when the GM plays an empty seat.
  table.sheets = Object.fromEntries(scenario.cast.filter(c => c.sheet).map(c => [c.id, c.sheet]));
  table.cast = table.cast.filter(c => assignments[c.id]).map(c => {
    const id = assignments[c.id];
    return { ...c, ...(c.alternatives?.[id] || {}), id, seat: c.id };
  });
  table.consult = Object.fromEntries(Object.entries(table.consult).filter(([id]) => assignments[id])
    .map(([id, value]) => [assignments[id], value]));
  for (const check of Object.values(table.checks)) {
    check.helper = assignments[check.helper] || null;
    // A declared approach follows its player; an empty seat's PC is voiced by the GM (npc).
    check.approaches = (check.approaches || []).map(approach => {
      const seat = approach.sheet || approach.actor;
      return { ...approach, sheet: seat, actor: assignments[approach.actor] || assignments[gm], npc: !assignments[approach.actor] };
    });
  }
  const present = new Set(Object.values(assignments).filter(Boolean));
  for (const block of table.dialogues) {
    // A companion's character-making talk is written in that player's own voice: keep it only when they are at the table.
    if (block.metadata?.making) { block.lines = block.lines.filter(line => present.has(line.speaker)); continue; }
    block.lines = block.lines.flatMap(line => {
      const id = assignments[line.speaker];
      if (!id) return [];
      if (id !== line.speaker && !line.variants?.[id]) throw new Error("Missing authored TRPG voice: " + id);
      const updated = { ...line, ...(line.variants?.[id] || {}), speaker: id };
      delete updated.variants;
      if (updated.castIntro) {
        updated.text = table.cast.length < scenario.cast.length ? updated.smallTableText : updated.text;
        delete updated.castIntro; delete updated.smallTableText;
      }
      return [updated];
    });
  }
  table.presentation.prepareIdle = "準備を選ぼう。仲間がいれば、切り札も頼める";
  table.presentation.endingIdle = "この晩の話は、ここまで。みんなとの記録を本棚に残そう";
  table.presentation.exitText = "中断した物語は、また遊べます。今夜の行動は使いません。";
  return table;
}

/** Commits once, after all ending dialogue is read; includes the action in the same save. */
export function completeTrpgTable(state, catalog, scenario, ticket, result, options = {}) {
  if (result?.cancelled || result?.scenarioId !== scenario.id || !scenario.endings[result?.ending]
    || state.chapter !== ticket.chapter || state.day !== ticket.day || state.slot !== ticket.slot) return false;
  const current = castTrpgTable(state, catalog, scenario, options);
  if (!current.ok || JSON.stringify(current.assignments) !== JSON.stringify(ticket.assignments)) return false;
  state.trpg.cleared[scenario.id] = {
    chapter: state.chapter, day: state.day, gm: current.gm, participants: [...current.participants],
    ending: result.ending, endingTitle: scenario.endings[result.ending].title,
    variant: result.variant, plan: clone(result.plan), version: scenario.version,
    ...(Number.isInteger(result.rating?.stars) ? { stars: result.rating.stars } : {}),
    ...(Number.isInteger(result.heat?.value) ? { heat: result.heat.value, night: result.heat.night } : {}),
    // The player's own character, as built for this table: name, origin, look and stats.
    ...(result.pc && typeof result.pc.name === "string" ? { pc: clone(result.pc) } : {}),
  };
  state.slot++;
  return true;
}
