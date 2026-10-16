// 共通のデート画面。条件・料金・日付の確定は呼出し側が持つ。
import { DB, callName } from "../core/data.js";
import { state } from "../core/state.js";
import { relationshipElapsedDay } from "../core/chapter-clock.js";

export const relationshipDayTotal = () => relationshipElapsedDay(state);

export function dateVenue(id, savedId = null) {
  const exclude = { minto: "pepermint", rin: "drfookah", samechan: "shishark" }[id];
  const venues = (DB.lover?.venues || []).filter(v => v.id !== exclude);
  return venues.find(v => v.id === savedId)
    || venues[((state.loveLevel[id] || 1) + (state.lastDate[id] || 0)) % venues.length];
}

export function dateScene(id, venue, { choice = null, choiceFlags = null, growth = true } = {}) {
  const sc = DB.lover.dates[id];
  const name = callName(id, state, { context: "private" });
  const maxed = (state.loveLevel[id] || 0) >= 5;
  const branches = Object.fromEntries(["a", "b"].map(key => {
    const option = sc[key === "a" ? "optA" : "optB"];
    return [key, [
      ...(choiceFlags ? [{ type: "set_flag", flag: choiceFlags[key] }] : []),
      { speaker: id, face: sc.arrive.face, text: option.line, inner: option.inner },
      ...(growth ? [{ type: "apply", stats: { [option.stat]: 2 } }] : []),
    ]];
  }));
  return {
    dialogue_id: `remake_date_${id}`,
    metadata: { bg: `res://assets/backgrounds/${venue.bg}`, private_scene: true,
      ...(id === "samechan" ? { min_chapter: 2, bgm: "sweets_or_sweets", bgm_on_speaker: id } : {}) },
    lines: [
      { speaker: "", text: `${state.slot === 0 ? "定休日の午後。" : "それぞれの仕事を終えてから。"}約束の店——『${venue.name}』。${venue.note}。店先で、${name}が待っていた。` },
      { speaker: id, face: sc.arrive.face, text: sc.arrive.text, inner: sc.arrive.inner },
      { speaker: "", text: "２人で１台を頼んで、向かい合う。よその店の煙を、よその客として吸う時間。" },
      { speaker: id, face: sc.mid.face, text: sc.mid.text, inner: sc.mid.inner },
      { speaker: "", text: sc.choiceQ },
      ...(choice ? branches[choice] : [{ type: "choice", choices: [
        { text: sc.optA.text, next: "a" }, { text: sc.optB.text, next: "b" },
      ] }]),
      { speaker: id, face: sc.close.face, text: sc.close.text, inner: sc.close.inner },
      { speaker: "", text: maxed
        ? "（もう何も進めなくていい。ただ隣にいる——それだけの時間が、いちばん贅沢だ）"
        : "（よその店の煙も、隣にこの人がいると、ぜんぶ思い出の味になる）" },
    ], branches,
  };
}
