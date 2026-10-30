import { waterComfort } from "./water.js";

const COMFORT_LINES = Object.freeze({
  ideal: "吸い心地：すっきり（水ちょうど）",
  deep: "吸い心地：重い（水が多い）",
  shallow: "吸い心地：喉に当たる（水が少ない）",
  none: "吸い心地：スカスカで冷えない（ステムが水に届いていない）",
});

/** 吸い出し・熱管理の結果表示。区分は採点と共通の水量判定を使う。 */
export function waterComfortLine(q) {
  return COMFORT_LINES[waterComfort(q).band];
}
