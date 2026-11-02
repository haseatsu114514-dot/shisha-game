// 制作の表示名は、共用する実行モードよりも今回の練習目的を優先する。
export function craftMode(cs, defaults) {
  if (cs.eventTitle) return cs.eventTitle;
  return cs.practiceKind && cs.practiceKind !== "rehearsal" && cs.mode !== "tutorial"
    ? "PRACTICE" : defaults[cs.mode] || "";
}

export function craftModeNote(cs, defaults) {
  return cs.eventNote || (cs.mode !== "tutorial" && cs.practiceKind
    ? cs.practiceKind === "rehearsal" ? "大会前のリハーサル"
      : cs.practiceKind === "midcheck" ? "手順の中間チェック" : "一台を作る練習"
    : defaults[cs.mode] || "");
}
