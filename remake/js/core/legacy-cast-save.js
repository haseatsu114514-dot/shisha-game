// 2026-11-05版で使った2人のID。セーブ枠・周回・ギャラリーの記録はいずれも同じIDを持つ。
const aliases = {
  kuyuri: "rio",
  suhail: "faris",
};
const oldId = new RegExp(Object.keys(aliases).join("|"));
const token = new RegExp(`(?<![A-Za-z0-9])(${Object.keys(aliases).join("|")})(?![A-Za-z0-9])`, "g");
const idList = new Set(["owned", "contacts", "lovers", "loversAtEnd", "keepsakes", "members", "eventsSeen",
  "flavorLessons", "limeRead", "relationshipMemories", "loverEventsSeen", "usedBaito"]);
const literalFields = new Set(["text", "title", "label", "name", "body", "caption", "description", "cycleId", "fromCycleId"]);

function currentId(id) {
  return oldId.test(id) && /^[a-zA-Z0-9_./:-]+$/.test(id) ? id.replace(token, match => aliases[match]) : id;
}

/** 旧IDがある記録だけ、複合IDと入れ子（LIME・装備・写真・引き継ぎ等）も現行のIDで読む。 */
export function parseCastSave(raw) {
  if (!oldId.test(raw)) return JSON.parse(raw);
  return JSON.parse(raw, (key, value) => {
    if (typeof value === "string") return literalFields.has(key) ? value : currentId(value);
    if (Array.isArray(value)) return idList.has(key) ? [...new Set(value)] : value;
    if (value && typeof value === "object") {
      for (const from of Object.keys(value)) {
        const to = currentId(from);
        if (to === from) continue;
        if (!Object.hasOwn(value, to)) value[to] = value[from];
        delete value[from];
      }
    }
    return value;
  });
}
