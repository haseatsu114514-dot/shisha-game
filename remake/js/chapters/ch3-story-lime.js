// 本筋の電話を、正常読了のcheckpointで通話記録として残す。
// 通話内容の正本は台本のmetadata。チャットの発言や恋人の予約には変えない。
import { DB } from "../core/data.js";

export function recordChapterThreeStoryLime(value, sceneId) {
  const dialogue = DB.dialogues[sceneId];
  const history = dialogue?.metadata?.lime_history;
  if (!history?.call || value.chapter !== 3) return false;
  const id = `ch3_story_${sceneId}`;
  if ((value.inbox || []).some(item => item.id === id)) return false;
  const log = [{ note: history.call }];
  (value.inbox ||= []).push({ id, originId: id, chapter: 3, day: value.day,
    account: history.sender, read: true, done: true, replyState: "none", log,
    msg: { id, sender: history.sender, type: "chat", messages: [],
      tokyoVisit: true, chapterThreeStory: true } });
  if (!(value.limeRead ||= []).includes(id)) value.limeRead.push(id);
  return true;
}

export function chapterThreeStoryContacts(value) {
  return [...new Set((value.inbox || []).filter(item => item.chapter === 3
    && item.msg?.chapterThreeStory).map(item => item.msg.sender))];
}
