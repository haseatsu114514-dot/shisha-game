// 任意交流だけ。必須の回復・支援・所在を好感度で制限しない。
export const MASHIRO_STORIES = Object.freeze([
  { id: "ch3_mashiro_play_1", points: 0, after: [] },
  { id: "ch3_mashiro_play_2", points: 9, after: ["ch3_mashiro_play_1"] },
  { id: "ch3_mashiro_play_3", points: 20, after: ["ch3_mashiro_play_2"] },
  { id: "ch3_mashiro_practice", points: 9, after: ["ch3_mashiro_play_2"], night: true },
]);
export const mashiroRead = (value, id) => value.flags?.[`_ch3_read_${id}`] === true;
// 本筋が占有する時間はジムと同じ既存判定で呼出元が除外する。
export function tokyoAffinityAvailable(value, window) {
  return value?.chapter === 3 && !!window && window.before !== "tournament"
    && value.met?.mashiro === true && value.flags?._ch3_intro?.stage >= 2
    && !value.flags._ch3_aftermath && !value.flags._ch3_cleared && !value.flags._ch3_tournament_won;
}
export function selectTokyoAffinityStory(value, window) {
  if (!tokyoAffinityAvailable(value, window)) return null;
  const points = (value.lovers || []).includes("mashiro") ? Infinity : (value.affinity?.mashiro || 0);
  return MASHIRO_STORIES.find(story => !mashiroRead(value, story.id) && points >= story.points
    && story.after.every(id => mashiroRead(value, id)) && (!story.night || window.slot === 1))?.id
    || "ch3_mashiro_repeat";
}
