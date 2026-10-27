// 初日の配達だけを管理する。通常訪問の料金・成長・交流回数には触れない。
export const DELIVERY_STOPS = ["ageha", "kumicho", "rei"];

export function acceptChapterTwoDeliveries(value) {
  if (value.chapter !== 2 || value.flags._ch2_deliveries) return false;
  value.flags._ch2_deliveries = { accepted: true, done: {} };
  return true;
}

export function deliveryPending(value, id) {
  return DELIVERY_STOPS.includes(id) && value.flags?._ch2_deliveries?.accepted === true
    && !value.flags._ch2_deliveries.done?.[id];
}

export function finishChapterTwoDelivery(value, id) {
  if (!deliveryPending(value, id)) return false;
  (value.flags._ch2_deliveries.done ||= {})[id] = true;
  return true;
}

export function chapterTwoDeliveriesDone(value) {
  return !value.flags?._ch2_deliveries?.accepted
    || DELIVERY_STOPS.every(id => !deliveryPending(value, id));
}

// 配達の顔合わせで付く面識（met）と初登場カットイン（_intro_）だけを制御する。
// 料金・成長・交流回数・好感度には触れない。ch3-deliveries.js と同じ考え方。
function tracksIdentity(id, key) {
  return key === `_met_${id}` || key === `_intro_${id}` || key.startsWith(`_intro_${id}_`);
}

/**
 * 顔合わせ会話の開始前に面識状態を控え、巻き戻し関数を返す。
 * SKIP/LOAD/中断で「面識だけ先に付く」のを防ぐため、完読しなかったときだけ呼ぶ。
 */
export function snapshotDeliveryIdentity(value, id) {
  if (!id || !value?.met || !value?.flags) return () => {};
  const hadMet = Object.hasOwn(value.met, id), met = value.met[id];
  const flags = Object.fromEntries(Object.entries(value.flags).filter(([key]) => tracksIdentity(id, key)));
  return () => {
    if (hadMet) value.met[id] = met; else delete value.met[id];
    for (const key of Object.keys(value.flags)) if (tracksIdentity(id, key)) delete value.flags[key];
    Object.assign(value.flags, flags);
  };
}

/**
 * 顔合わせ会話を完読したときに面識と名前表示を確定する。
 * 台詞中の set_flag(_met_*) が将来の編集で失われても整合させる保険。idempotent。
 * @returns 新しく面識が付いたか（二重付与の判定用）
 */
export function confirmDeliveryIdentity(value, id) {
  if (!id || !DELIVERY_STOPS.includes(id) || !value?.met || !value?.flags) return false;
  const changed = !value.met[id];
  value.met[id] = true;
  value.flags[`_met_${id}`] = true;
  return changed;
}

/**
 * 既存SAVEの移行：配達済みなのに面識が付いていない相手を整合させる。
 * 「配達済みで『？』のまま」を読み込み時に自然へ直す。好感度は変えない。
 * @returns 変更があったか
 */
export function reconcileDeliveryIdentity(value) {
  const done = value?.flags?._ch2_deliveries?.done;
  if (!done || !value?.met || !value?.flags) return false;
  let changed = false;
  for (const id of DELIVERY_STOPS) {
    if (done[id] && !value.met[id]) {
      value.met[id] = true;
      value.flags[`_met_${id}`] = true;
      changed = true;
    }
  }
  return changed;
}
