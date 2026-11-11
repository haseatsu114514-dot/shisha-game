// ドバイの必須の仕事。実選択・済ませた仕事・読了を分け、成績や自由行動は変更しない。
export const CH4_STAFF_IDS = Object.freeze({
  notice: "ch4_staff_notice", preparation: "ch4_staff_preparation", prepared: "ch4_staff_prepared",
  notebook: "ch4_staff_notebook", order: "ch4_staff_order", returned: "ch4_staff_returned",
  echo: "ch4_staff_match_echo", cleanup: "ch4_staff_cleanup",
});
export const CH4_STAFF_SCENE_FILES = Object.freeze({ ch4_staff_work: Object.freeze(Object.values(CH4_STAFF_IDS)) });
export const CH4_STAFF_BG = "bg_dubai_grand_smoke_stage";
const object = value => !!value && typeof value === "object" && !Array.isArray(value);
const daily = value => value?.chapter === 4 && value.flags?._ch4?.routeVersion === 2
  && value.flags._ch4.part === "free" && value.phase === "daily";
const day = value => Number.isInteger(value?.flags?._ch4?.startDay)
  ? value.day - value.flags._ch4.startDay + 1 : null;
export const chapterFourStaffWork = value => object(value?.flags?._ch4?.staffWork) ? value.flags._ch4.staffWork : null;
const work = value => {
  if (value?.chapter !== 4 || !object(value.flags?._ch4)) return null;
  if (!object(value.flags._ch4.staffWork)) value.flags._ch4.staffWork = {};
  return value.flags._ch4.staffWork;
};
const read = (value, id) => value?.flags?._ch4?.read?.[id] === true;

/** 未着手の仕事は指定日だけ。古いDAY5以降の保存へ、DAY3の連絡やDAY4の面識を足さない。 */
export function chapterFourStaffNight(value) {
  if (!daily(value)) return null;
  const record = chapterFourStaffWork(value), today = day(value);
  if (today === 3 && !read(value, CH4_STAFF_IDS.notice))
    return { id: "notice", label: "明日の搬入確認", beat: "宿へ戻ると、会場から道具の受け渡しの連絡が届いていた。" };
  if (today === 4 && read(value, CH4_STAFF_IDS.notice) && !record?.preparation?.read)
    return { id: "preparation", label: "会場を開ける人たち", beat: "連絡のあった共用ブースへ、借りる道具を受け取りに向かう。" };
  if (today === 9 && record?.preparation?.read && !record.service?.read)
    return { id: "service", label: "海の向こうで、一人に出す", beat: "道具を受け取った共用ブースで、あのスタッフに声をかけられた。" };
  return null;
}

const choices = Object.freeze({
  [CH4_STAFF_IDS.preparation]: { event: "preparation", id: "ch4_staff_prep_choice", key: "preparation", values: ["tools", "seats"] },
  [CH4_STAFF_IDS.order]: { event: "service", id: "ch4_staff_order_choice", key: "service", values: ["sweetness", "strength"] },
});

/** 押した回答はすぐ保存できるが、読了や仕事の完了にはしない。同じ回答を上書きしない。 */
export function recordChapterFourStaffChoice(value, sceneId, choiceId, selected) {
  const spec = choices[sceneId];
  if (!spec || spec.id !== choiceId || !spec.values.includes(selected)
    || chapterFourStaffNight(value)?.id !== spec.event) return false;
  const record = work(value);
  if (!record) return false;
  if (!object(record[spec.key])) record[spec.key] = {};
  if (record[spec.key].choice !== undefined) return false;
  record[spec.key].choice = selected;
  return true;
}

export function chapterFourStaffSceneAllowed(value, id) {
  if (read(value, id)) return false;
  const record = chapterFourStaffWork(value), event = chapterFourStaffNight(value)?.id;
  if (id === CH4_STAFF_IDS.notice) return event === "notice";
  if (id === CH4_STAFF_IDS.preparation) return event === "preparation" && !record?.preparation?.introRead;
  if (id === CH4_STAFF_IDS.prepared) return event === "preparation" && !!record?.preparation?.introRead && !record.preparation.workDone;
  if (id === CH4_STAFF_IDS.notebook) return event === "preparation" && !!record?.preparation?.workDone && !record.preparation.read;
  if (id === CH4_STAFF_IDS.order) return event === "service" && !record?.service?.introRead;
  if (id === CH4_STAFF_IDS.returned) return event === "service" && !!record?.service?.careDone && !record.service.read;
  const tournament = value?.chapter === 4 && value.flags?._ch4?.routeVersion === 2
    && day(value) === 14 && value.flags._ch4.part === "tournament";
  if (id === CH4_STAFF_IDS.echo) return tournament && !!record?.service?.read && !value.flags._ch4.match?.result;
  if (id === CH4_STAFF_IDS.cleanup) return value?.chapter === 4 && day(value) === 14 && !!record?.preparation?.read
    && ["tournament", "resolution"].includes(value.flags._ch4.part) && !!value.flags._ch4.match?.result;
  return false;
}

/** 会話の読了だけを確定する。準備の実作業とノート、提供と客の反応は別checkpoint。 */
export function completeChapterFourStaffScene(value, id) {
  if (!chapterFourStaffSceneAllowed(value, id)) return false;
  const record = work(value);
  if (id === CH4_STAFF_IDS.preparation) {
    if (!["tools", "seats"].includes(record.preparation?.choice)) return false;
    record.preparation.introRead = true;
  }
  if (id === CH4_STAFF_IDS.prepared) record.preparation.workDone = true;
  if (id === CH4_STAFF_IDS.notebook) record.preparation.read = true;
  if (id === CH4_STAFF_IDS.order) {
    if (!["sweetness", "strength"].includes(record.service?.choice)) return false;
    record.service.introRead = true;
  }
  if (id === CH4_STAFF_IDS.returned) record.service.read = true;
  value.flags._ch4.read[id] = true;
  return true;
}

/** 一度の熱管理で実際に選んだ炭・位置と結果だけ。中断した工程・架空の成功は保存しない。 */
export function recordChapterFourStaffCare(value, cs) {
  const service = chapterFourStaffWork(value)?.service, care = cs?.careHistory?.[0];
  if (chapterFourStaffNight(value)?.id !== "service" || !service?.introRead || service.careDone
    || cs?.cancelled || !care || !Number.isFinite(care.score) || !Number.isInteger(care.coals)
    || care.coals < 0 || care.coals > 4 || (care.coals > 0 && !["outer", "std", "inner"].includes(cs.careCoals?.place))) return false;
  service.careDone = true;
  service.result = cs.failed || care.failed ? "failed" : care.score >= 68 ? "good" : "rough";
  service.adjustment = { coals: care.coals, place: care.coals ? cs.careCoals.place : null,
    over: !!care.over, under: !!care.under };
  return true;
}

/** 日常ループの固定夜から呼ぶ。未確定の工程だけを再開し、日付・slot・資源・成長へ触れない。 */
export async function runChapterFourStaffNight(value, { read: readScene, adjust, save, isCurrent = () => true }) {
  const event = chapterFourStaffNight(value);
  if (!event || !isCurrent()) return false;
  const live = () => isCurrent() && chapterFourStaffNight(value)?.id === event.id;
  const finish = async id => {
    if (read(value, id)) return true;
    if (!live() || !chapterFourStaffSceneAllowed(value, id) || !await readScene(id) || !live()) return false;
    if (!completeChapterFourStaffScene(value, id)) return false;
    save();
    return true;
  };
  if (event.id === "notice") return finish(CH4_STAFF_IDS.notice);
  if (event.id === "preparation") {
    for (const id of [CH4_STAFF_IDS.preparation, CH4_STAFF_IDS.prepared, CH4_STAFF_IDS.notebook])
      if (!await finish(id)) return false;
    return true;
  }
  if (!await finish(CH4_STAFF_IDS.order)) return false;
  if (!chapterFourStaffWork(value).service.careDone) {
    const cs = await adjust(chapterFourStaffWork(value).service.choice);
    if (!live() || !recordChapterFourStaffCare(value, cs)) return false;
    save();
  }
  return finish(CH4_STAFF_IDS.returned);
}

/** 中断後の実選択だけを復元し、後日の記憶も完了した体験から組み立てる。読み取りでは保存を変えない。 */
export function chapterFourStaffDialogue(value, source) {
  const record = chapterFourStaffWork(value), prep = record?.preparation, service = record?.service;
  const branch = key => source.branches?.[key] || [];
  const spec = choices[source.dialogue_id], chosen = spec && record?.[spec.key]?.choice;
  const replay = spec?.values.includes(chosen);
  const lines = source.lines.flatMap(line => {
    if (replay && line.type === "choice" && line.id === spec.id) return branch(chosen);
    if (line.id === "ch4_staff_prep_memory" && prep?.read) return branch(`prep_${prep.choice}`);
    if (line.id === "ch4_staff_do_preparation" && prep?.introRead) return branch(prep.choice);
    if (line.id === "ch4_staff_notebook_entry" && prep?.workDone) return branch(prep.choice);
    if (line.id === "ch4_staff_service_result" && service?.careDone) return branch(service.result);
    if (line.id === "ch4_staff_order_memory" && service?.read) return branch(service.choice);
    if (line.id === "ch4_staff_care_memory" && service?.read) {
      const adjustment = service.adjustment;
      const action = branch(adjustment.coals ? "coal_changed" : "coal_kept").map(row => ({ ...row,
        text: row.text.replaceAll("{coals}", String(adjustment.coals))
          .replaceAll("{coalPlace}", { outer: "外寄り", std: "いつもの位置", inner: "内寄り" }[adjustment.place] || "") }));
      return [...action, ...branch(service.result)];
    }
    if (line.id === "ch4_staff_rehearsal_memory") return ["great", "good", "rough", "burnt"].includes(value.flags?._ch4_rehearsal?.result) ? branch("rehearsal") : [];
    return [line];
  });
  return { ...source, lines };
}
