// 実際に読み終えた旧LIMEにも含まれていた事実を、後の会話で初耳にしない。
import { state } from "./state.js";

export function syncMintoKnowledge() {
  if (!state) return;
  const topic = "rumor_minto_late_night";
  const read = (state.limeRead || []).includes(topic)
    || (state.inbox || []).some((item) => item.read && (item.originId || item.id) === topic);
  if (read) {
    state.flags._minto_history_shared = true;
    state.flags._minto_phantom_shared = true;
  }
}
