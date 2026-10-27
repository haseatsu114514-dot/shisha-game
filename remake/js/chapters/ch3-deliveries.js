// Mukai勤務の顔合わせ。既存DAY2内で、配達と自主来店の読了を分ける。
export const MUKAI_DELIVERY_STEPS = Object.freeze([
  { id: "ch3_mukai_intro", flag: "_ch3_mukai_work_intro_read", bg: "bg_mukai_shop" },
  { id: "ch3_delivery_offer", flag: "_ch3_delivery_offer", bg: "bg_mukai_shop" },
  { id: "ch3_delivery_kuze", flag: "_ch3_delivery_kuze", person: "kuze", bg: "bg_yohaku_shop" },
  { id: "ch3_delivery_steve", flag: "_ch3_delivery_steve", person: "steve", bg: "bg_steve_shop" },
  { id: "ch3_delivery_volk", flag: "_ch3_delivery_volk", person: "volk", bg: "bg_volk_shop" },
  { id: "ch3_delivery_return", flag: "_ch3_delivery_return", bg: "bg_mukai_shop" },
]);
const active = new WeakSet();

function identityCheckpoint(value, id) {
  if (!id) return () => {};
  const hadMet = Object.hasOwn(value.met, id), met = value.met[id];
  const tracked = key => key === `_met_${id}` || key === `_intro_${id}` || key.startsWith(`_intro_${id}_`);
  const flags = Object.fromEntries(Object.entries(value.flags).filter(([key]) => tracked(key)));
  return () => {
    if (hadMet) value.met[id] = met; else delete value.met[id];
    for (const key of Object.keys(value.flags)) if (tracked(key)) delete value.flags[key];
    Object.assign(value.flags, flags);
  };
}

/** readは既存readSceneの正常完読boolean。料金/成長/日付/自主来店flagsには触れない。 */
export async function runMukaiDeliveryWork(value, { read, save, isCurrent, signal = null }) {
  if (value?.chapter !== 3 || value.flags?._ch3_intro?.stage !== 2
    || active.has(value) || signal?.aborted || !isCurrent()) return false;
  const stamp = `${value.chapter}:${value.day}:${value.slot}:${value.flags._ch3_intro.stage}`;
  const current = () => isCurrent() && !signal?.aborted
    && `${value.chapter}:${value.day}:${value.slot}:${value.flags?._ch3_intro?.stage}` === stamp;
  active.add(value);
  try {
    for (const step of MUKAI_DELIVERY_STEPS) {
      if (!current()) return false;
      if (value.flags[step.flag]) continue;
      const restore = identityCheckpoint(value, step.person);
      let complete = false;
      try {
        if (await read(step) !== true || !current()) return false;
        complete = true;
      } finally {
        // VNの登場演出が途中で書いたidentityだけを戻す。他の既済配達は保持する。
        if (!complete) restore();
      }
      if (step.person) {
        value.met[step.person] = true;
        value.flags[`_met_${step.person}`] = true;
      }
      value.flags[step.flag] = true;
      save();
    }
    return current();
  } finally { active.delete(value); }
}
