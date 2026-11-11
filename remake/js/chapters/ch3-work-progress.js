// 必須の店仕事で実際に選び、終えたことだけを東京の行程内に保存する。
// 好感度・味覚の回復・大会の点数とは結びつけない。旧保存の空欄は推測しない。
import { chapterThreeScenes } from "./ch3-scenes.js";
export const CH3_SERVICE_IDS = Object.freeze(["ch3_saku_mukai_visit", "ch3_saku_mukai_served"]);
const own = (value, key) => Object.hasOwn(value || {}, key);
const object = value => value && typeof value === "object" && !Array.isArray(value);
export const chapterThreeWork = value => object(value?.flags?._ch3_intro?.work) ? value.flags._ch3_intro.work : null;
const work = value => {
  const progress = value?.chapter === 3 && value.flags?._ch3_intro;
  if (!object(progress)) return null;
  if (!object(progress.work)) progress.work = {};
  return progress.work;
};
const choices = Object.freeze({
  ch3_rest_before_recovery: { id: "ch3_rest_choice", key: "rest", values: ["tea", "sit"] },
  ch3_work_without_taste: { id: "ch3_work_role", key: "shift", values: ["heat", "taste"] },
  ch3_saku_mukai_visit: { id: "ch3_service_order", key: "order", values: ["gentle", "pace"] },
});

/** 読了した場面の回答だけを採用する。再読・中断時の未確定回答は呼出し側に留める。 */
export function recordChapterThreeWorkChoice(value, sceneId, selected) {
  const spec = choices[sceneId];
  if (!spec || !spec.values.includes(selected?.[spec.id])) return false;
  const record = work(value);
  if (!record) return false;
  if (spec.key === "order") {
    if (!object(record.service)) record.service = {};
    if (record.service.introRead) return false;
    record.service.order = selected[spec.id];
  } else record[spec.key] = selected[spec.id];
  return true;
}

export const chapterThreeService = value => {
  const record = chapterThreeWork(value)?.service;
  return object(record) ? record : null;
};
export const chapterThreeServiceDue = value => value?.chapter === 3
  && chapterThreeScenes(value)[value.flags?._ch3_intro?.stage]?.id === CH3_SERVICE_IDS[0];

/** 実際の調整一回の結果。前半の制作成績や未体験の味を作らない。 */
export function recordChapterThreeServiceCare(value, cs) {
  const record = chapterThreeService(value);
  const care = cs?.careHistory?.[0];
  if (!record?.introRead || record.careDone || !care || !Number.isFinite(care.score) || cs.cancelled) return false;
  record.careDone = true;
  record.result = cs.failed ? "failed" : care.score >= 68 ? "good" : "rough";
  record.adjustment = { coals: Number.isFinite(care.coals) ? care.coals : 0,
    place: cs.careCoals?.place || "std", over: !!care.over, under: !!care.under };
  return true;
}

/** 制作完了と反応の読了を別々に保存し、反応中のLOADで一台を作り直させない。 */
export async function runChapterThreeService(value, { read, adjust, save, isCurrent = () => true }) {
  const live = () => chapterThreeServiceDue(value) && isCurrent();
  if (!live()) return false;
  const record = work(value);
  if (!record) return false;
  if (!object(record.service)) record.service = {};
  const service = record.service;
  if (service.feedbackRead) return true;
  if (!service.introRead) {
    if (!await read(CH3_SERVICE_IDS[0]) || !live()) return false;
    if (!["gentle", "pace"].includes(service.order)) return false;
    service.introRead = true;
    save();
  }
  if (!service.careDone) {
    const cs = await adjust(service.order);
    if (!live() || !recordChapterThreeServiceCare(value, cs)) return false;
    save();
  }
  if (!await read(CH3_SERVICE_IDS[1]) || !live()) return false;
  service.feedbackRead = true;
  save();
  return true;
}

/**
 * 台本の分岐を、保存に残る実体験だけで差し込む。読み取るだけでは保存を変えない。
 * 差し込む場所は台本の行の id で決める（BLC04）: before は id "ch3_work_echo" の行の直後、綾取の一台の記録（serviceNote）は
 * id "ch3_service_note" の行の直後、作戦のメモ（notes）は id "ch3_work_notes" の行の直後。印の無い台本では場面の頭に足す。
 * 以前は before を必ず頭に足していたので、返事が問いより先に出る・合図の前に内心が出る、という順番のずれがあった。
 */
export function chapterThreeWorkDialogue(value, source) {
  const record = chapterThreeWork(value), service = chapterThreeService(value);
  const branch = key => source.branches?.[key] || [];
  let before = [], notes = [], serviceNote = [];
  if (source.dialogue_id === "ch3_daily_cup_1" && ["tea", "sit"].includes(record?.rest))
    before = branch(`rest_${record.rest}_echo`);
  if (source.dialogue_id === "ch3_work_without_taste" && ["tea", "sit"].includes(record?.rest))
    before = branch(`rest_${record.rest}_echo`);
  if (source.dialogue_id === "ch3_naru_contact_before_tournament" && own(record, "shift"))
    before = branch("work_phone_echo");
  if (source.dialogue_id === "ch3_saku_mukai_served" && service?.careDone) {
    before = branch(service.result);
    if (service.result !== "failed") serviceNote = branch(service.adjustment?.coals > 0 ? "coal_changed" : "coal_kept");
  }
  if (source.dialogue_id === "ch3_strategy") {
    if (service?.feedbackRead) {
      notes.push(...branch(`service_${service.order}_echo`));
      notes.push(...branch(`service_${service.result}_echo`));
    }
    for (const id of ["saku", "steve"]) {
      const trial = value.flags?.[`_ch3_trial_${id}`];
      if (trial?.practiceDone && ["good", "rough", "failed"].includes(trial.result))
        notes.push(...branch(`trial_${id}_${trial.result}`));
    }
  }
  if (source.dialogue_id === "ch3_national_craft" && ["aroma", "light", "sweet"].includes(value.flags?._ch3_strategy))
    before = branch(`strategy_${value.flags._ch3_strategy}`);
  const inserts = { ch3_work_notes: notes, ch3_work_echo: before, ch3_service_note: serviceNote };
  const marked = id => source.lines.some(line => line.id === id);
  const lines = source.lines.flatMap(line => inserts[line.id]?.length ? [line, ...inserts[line.id]] : [line]);
  const head = [...(marked("ch3_work_echo") ? [] : before), ...(marked("ch3_service_note") ? [] : serviceNote)];
  return { ...source, lines: [...head, ...lines] };
}
