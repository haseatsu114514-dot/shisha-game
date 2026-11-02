// 交流で実際に読んだ言葉・見た手つきを残す。知識ノートや数値の報酬とは独立。
import { DB } from "./data.js";
import { state } from "./state.js";

/** remember 行に到達した時だけ残す。未知のID・再読では増やさない。 */
export function rememberRelationship(id) {
  if (!state || typeof id !== "string" || !Object.hasOwn(DB.relationshipMemories, id)) return false;
  if (!Array.isArray(state.relationshipMemories)) state.relationshipMemories = [];
  if (state.relationshipMemories.includes(id)) return false;
  state.relationshipMemories.push(id);
  return true;
}

const REFLECTION_LEAD = "トングを持つ。誰かと過ごした時間が、ふとよみがえった。";

/**
 * 最新の交流から相手ごとに一つ、最大三人分を短い内心へ返す。
 * reflection 行に text があれば、導入の地の文をその場面に合わせて差し替える（空文字なら導入を出さず、直前の地の文に任せる）。
 */
export function relationshipReflectionLines(line = {}) {
  const ids = Array.isArray(state?.relationshipMemories) ? state.relationshipMemories : [];
  const characters = new Set();
  const selected = [];
  for (let i = ids.length - 1; i >= 0 && selected.length < 3; i--) {
    const id = ids[i];
    if (typeof id !== "string" || !Object.hasOwn(DB.relationshipMemories, id)) continue;
    const memory = DB.relationshipMemories[id];
    if (characters.has(memory.char_id)) continue;
    characters.add(memory.char_id);
    selected.unshift(memory);
  }
  if (!selected.length) return [
    { speaker: "hajime", face: "normal", text: "（まず、今の一台を確かめよう。急がなくていい）" },
  ];
  const lead = typeof line?.text === "string" ? line.text : REFLECTION_LEAD;
  return [
    ...(lead ? [{ speaker: "", face: "", text: lead }] : []),
    ...selected.map((memory) => ({ speaker: "hajime", face: "normal", text: memory.echo })),
    { speaker: "hajime", face: "normal", text: state.chapter === 1
      ? "（一緒に過ごした時間も、今の俺に残っている）"
      : "（誰かにもらったものまで、消さなくていい）" },
  ];
}
