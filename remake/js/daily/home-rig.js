// 家シーシャの台（#638）。スミさんの卓上台（第1章 DAY2以降の帰宅前に譲られる）と、くじの大会公式モデルの台。
// 寝る前の一服の流れは home-shisha.js。ここは台の持ち物・受け取りと、その夜の自室でのお披露目。
import { DB, img } from "../core/data.js";
import { state, save } from "../core/state.js";
import { chapterFeatureEnabled } from "../core/chapter-features.js";
import { emit } from "../core/bus.js";
import { el } from "../core/util.js";
import { imageReady, modal, withScenePreparation } from "../core/ui.js";
import { play, vnTest } from "../vn/engine.js";

export const SUMI_RIG = "home_rig_set";   // ミャア 卓上台（試作の熟練度経験値6）
export const PRO_RIG = "home_rig_pro";    // 大会公式モデルの台（試作の熟練度経験値7.5・くじの景品）
export const RIG_SCENE = "ch1_sumi_home_rig";
export const RIG_HOME_SCENE = "ch1_sumi_home_rig_homecoming";
// #640で採用済み。scene-art.jsが自室の机上に置くものと同じ台。
export const SUMI_RIG_IMAGE = "ui/scene_props/shisha_home_tabletop.png";
const FALLBACK_GROWTH = { [SUMI_RIG]: 0.5, [PRO_RIG]: 0.75 };

/** 家で使う台（両方あれば伸びのいい大会公式モデル）。なければ null */
export function homeRig(s = state) {
  const owned = s?.owned || [];
  const id = [PRO_RIG, SUMI_RIG].find((rig) => owned.includes(rig));
  if (!id) return null;
  const gear = DB.equipById?.[id];
  return { id, name: gear?.name || id, growth: Number(gear?.home_growth) || FALLBACK_GROWTH[id] };
}

/** スミさんから卓上台を受け取る（一度だけ）。DAY2の帰宅前に呼ぶ。中間準備は未受領セーブのフォールバック */
export async function giveSumiRig({ bg = null, deferSave = false } = {}) {
  if (state.owned?.includes(SUMI_RIG)) return false;
  const owner = state;
  const name = DB.equipById?.[SUMI_RIG]?.name || "卓上台";
  if (DB.dialogues[RIG_SCENE]) {
    const result = await play(RIG_SCENE, bg ? { bg } : {});
    if (state !== owner || result?.cancelled) return false;
    if (!vnTest.turbo) {
      const url = img(SUMI_RIG_IMAGE);
      const loaded = await withScenePreparation(imageReady(url, 15000));
      if (state !== owner) return false;
      if (loaded) {
        await modal({ title: name, className: "home-rig-gift",
          body: el("img", { src: url, alt: name, style: {
            display: "block", width: "300px", height: "300px", maxWidth: "100%", objectFit: "contain", margin: "0 auto",
          } }),
          options: [{ label: "受け取る", value: true, primary: true, test: "home-rig-gift-close" }],
        });
        if (state !== owner) return false;
      }
    }
  }
  state.owned ||= [];
  if (!state.owned.includes(SUMI_RIG)) state.owned.push(SUMI_RIG);
  state.flags._sumi_rig_received_day = `${state.chapter}:${state.day}`;
  emit("notice", { text: `「${name}」をもらった。体力に余裕がある夜は、寝る前に家シーシャができる` });
  if (!deferSave) save(); // 有料訪問は calendar の支払い・行動確定と同時に保存する
  return true;
}

/** 実際に受け取った当日の夜だけ。受領済みの旧セーブへ日付を推測して足さない。 */
export function sumiRigHomecomingDue(s = state) {
  return !!s?.owned?.includes(SUMI_RIG) && !s.flags?._sumi_rig_home_seen
    && s.flags?._sumi_rig_received_day === `${s.chapter}:${s.day}`;
}

/** 帰宅後・家シーシャの誘いの前。表示中のSAVE/LOADや再入室でも繰り返さない。 */
export async function showSumiRigAtHome() {
  if (!sumiRigHomecomingDue() || !DB.dialogues[RIG_HOME_SCENE]) return false;
  const owner = state;
  state.flags._sumi_rig_home_seen = true;
  save();
  const result = await play(RIG_HOME_SCENE);
  return state === owner && !result?.cancelled;
}

/** DAY2から、体調を崩していない夜にお下がりを渡す。旧セーブでも次の夜に受け取れる。 */
export async function giveEarlyHomeRig() {
  if (!chapterFeatureEnabled(state.chapter, "earlyHomeRig") || state.day < 2 || state.day >= 14 || state.restDay?.fullDay
      || state.owned?.includes(SUMI_RIG)) return;
  await giveSumiRig({ bg: "res://assets/backgrounds/bg_tonari_inside.png" });
}
