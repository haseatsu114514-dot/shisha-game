// 第5章の小会話。元の3本の順を保ち、後ろに5本を足す。
const SUFFIXES = ["", "_b", "_c", "_d", "_e", "_f", "_g", "_h"];
export const chapterFiveTalkIds = base => SUFFIXES.map(suffix => base + suffix);
