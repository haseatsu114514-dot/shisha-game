// 店の発見・匿名の目撃・正式な初対面は別の記録。判定だけでは状態を変えない。
export const axeBarDiscovered = s => !!s && (s.flags?._axe_bar_legacy_access === true || s.flags?._axe_bar_rumor_done === true);

export const axeBarRumorDue = s => !!s && [1, 2].includes(s.chapter) && s.phase === "daily"
  && !s.met?.hiyori && !s.flags?._hiyori_meeting_done && !axeBarDiscovered(s);

export const axeBarSightingDue = s => !!s && [1, 2].includes(s.chapter) && s.phase === "daily"
  && axeBarDiscovered(s) && !s.met?.hiyori && !s.flags?._hiyori_meeting_done && !s.flags?._axe_bar_sighting_done;

/** 旧保存の導線と対面済みの交流は維持。新規だけ実目撃の翌日以降を初対面の条件にする。 */
export function hiyoriFirstMeetingReady(s) {
  if (!s) return false;
  if (s.flags?._axe_bar_legacy_access === true || s.met?.hiyori || s.flags?._hiyori_meeting_done) return true;
  const day = s.flags?._axe_bar_sighting_day;
  return s.flags?._axe_bar_sighting_done === true && Number.isInteger(day) && day > 0 && s.day > day;
}
