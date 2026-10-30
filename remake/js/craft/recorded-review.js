import { el } from "../core/util.js";
import { goodPointOf, improvementOf } from "./advice.js";

/** 保存済みの一台から表示だけを作る。初期値や採点の既定値を実績として扱わない。 */
export function recordedReviewLines(cs) {
  if (!cs) return [];
  const parts = {};
  const recorded = result => Number.isFinite(result?.score) && !result.skipped;
  for (const key of ["holes", "heat"]) {
    if (recorded(cs[key])) parts[key] = cs[key].score;
  }
  if (recorded(cs.pull) && Number.isFinite(cs.parts?.shisha)) parts.shisha = cs.parts.shisha;
  for (let i = 0; i < 2; i++) {
    if (recorded(cs.careHistory?.[i])) parts[`care${i + 1}`] = cs.careHistory[i].score;
  }
  return [goodPointOf(cs), improvementOf({ ...cs, parts })].filter(Boolean);
}

export function recordedReview(cs, test) {
  const lines = recordedReviewLines(cs);
  if (!lines.length) return null;
  return el("section.ch2-contest-reason", { dataset: { test } }, [
    el("b.ch2-contest-reason-tag", { text: "制作の振り返り" }),
    ...lines.map(text => el("p", { text })),
  ]);
}
