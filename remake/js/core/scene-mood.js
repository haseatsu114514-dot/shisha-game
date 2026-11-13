// 場面の空気（会話をまたいで保つ見た目）。会話エンジンの fx（sepia・flashback）は会話が終わるたびに外れるので、
// いくつもの会話を続けて読む場面は、呼び出し側がここで付け外しする。見た目は css/vn.css。
//   "dread": 修羅場。背景の色を落とし、四隅を沈める（立ち絵と台詞欄は変えない）

/** 空気を切り替える。name を省くと元に戻す。 */
export function setSceneMood(name = "") {
  const body = globalThis.document?.body;
  if (!body) return;
  if (name) body.dataset.sceneMood = name;
  else delete body.dataset.sceneMood;
}

export const sceneMood = () => globalThis.document?.body?.dataset.sceneMood || "";
