// Read-only developer inspection helpers. Never mutate state, flags, or save data.
export function createDevInspector(getState, getDialogues) {
  const snapshot = () => {
    const state = getState();
    if (!state) return null;
    return JSON.parse(JSON.stringify({
      schema: state.schema, chapter: state.chapter, phase: state.phase,
      day: state.day, slot: state.slot, money: state.money,
      stamina: state.stamina, stats: state.stats, flags: state.flags,
      affinity: state.affinity, lovers: state.lovers, story: state.story,
    }));
  };
  const events = (query = "", limit = 100) => {
    const q = String(query).toLowerCase();
    const max = Math.min(500, Math.max(0, Number(limit) || 0));
    return Object.keys(getDialogues() || {})
      .filter(id => id.toLowerCase().includes(q))
      .sort()
      .slice(0, max);
  };
  const eventInfo = id => {
    const scene = (getDialogues() || {})[id];
    if (!scene) return null;
    return {
      id, lines: Array.isArray(scene.lines) ? scene.lines.length : 0,
      branches: Object.keys(scene.branches || {}),
      metadata: JSON.parse(JSON.stringify(scene.metadata || {})),
    };
  };
  const exportSnapshot = () => JSON.stringify(snapshot(), null, 2);
  return Object.freeze({ snapshot, events, eventInfo, exportSnapshot });
}
