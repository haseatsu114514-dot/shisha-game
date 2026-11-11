// 日程前の一場面へ、実際に読み終えた日常だけを短く返す。未読の場面は記憶にしない。
export function chapterFiveUnrecordedDialogue(value, source) {
  if (!source || source.dialogue_id !== "ch5_unrecorded_day") return source;
  const progress = value?.flags?._ch5;
  const read = progress?.read || {};
  const branch = key => source.branches?.[key] || [];
  const echoes = [];
  if (read.ch5_free_mashiro_visit === true) echoes.push(...branch("mashiro_seen"));
  if (read.ch5_free_first_visitor === true) echoes.push(...branch("visitor_seen"));
  if (read.ch5_free_tonari_practice === true && typeof progress.prep?.adjusted === "boolean")
    echoes.push(...branch("practice_seen"));
  return { ...source, lines: source.lines.flatMap(line => line.id === "ch5_counter_work" ? [line, ...echoes] : [line]) };
}
