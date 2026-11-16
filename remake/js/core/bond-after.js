// 好感度MAX（♥5）の締めくくりの後の会話（#3693・2026-11-15 オーナー決定
// 「1キャラ好感度マックス後も5パターンぐらい作りたい　その後は短い汎用とかにして」）。
// 締めくくりを読んだ友人の店へ来た時、いつもの小会話の代わりに、その人の♥5後の場面を一度ずつ順に出す。
// 全部読み終えたら、短い汎用（2〜3行）を巡回する。台本は data/dialogue/bond_after.json。
// - 友人ルートの人だけ（daily/bonds.js の settledFriend と同じ考え方）。恋人・恋愛ルートの人には出さない（恋人の節目が別にある・2026-11-16 オーナー決定）
// - 好感度・能力・代金は、呼出元のいつもの来店と同じ（♥5後の場面で報酬は増やさない）
// - 物語の場面・段階会話・締めくくり・一度きりの後日談が来る来店では、呼出元がそちらを優先する
// - requires: その場面の前提になる持ち物（締めくくりの贈り物など）。持っていない保存では飛ばし、汎用へ進む
// あげは（chapters/ch2-story-data.js の agehaLaterScene）が先にこの形を始めた。ほかの人は Issue #3693 の順で足していく。
import { readDialogues } from "./chapter-data.js";

export const BOND_AFTER_FILE = "bond_after";
const FLAG = "_bond_after"; // { 人のID: [読んだ場面のID…] }

const entry = (id, { scenes, shorts }) => Object.freeze({
  scenes: Object.freeze(scenes.map(scene => Object.freeze(typeof scene === "string" ? { id: scene } : scene))),
  shorts: Object.freeze(shorts),
});
/** 人ごとの♥5後の5本（順に一度ずつ）と、その後の短い汎用（巡回）。 */
export const BOND_AFTER = Object.freeze({
  kumicho: entry("kumicho", {
    scenes: [{ id: "bond_after_kumicho_1", requires: "suyaki_kumicho" }, "bond_after_kumicho_2", "bond_after_kumicho_3",
      "bond_after_kumicho_4", "bond_after_kumicho_5"],
    shorts: ["bond_after_kumicho_short_a", "bond_after_kumicho_short_b", "bond_after_kumicho_short_c", "bond_after_kumicho_short_d"],
  }),
  rei: entry("rei", {
    scenes: ["bond_after_rei_1", "bond_after_rei_2", "bond_after_rei_3", "bond_after_rei_4", "bond_after_rei_5"],
    shorts: ["bond_after_rei_short_a", "bond_after_rei_short_b", "bond_after_rei_short_c", "bond_after_rei_short_d"],
  }),
});

/** 全員の台本のID（読み込みと検証用）。 */
export const BOND_AFTER_SCENE_IDS = Object.freeze(Object.values(BOND_AFTER)
  .flatMap(item => [...item.scenes.map(scene => scene.id), ...item.shorts]));

/** 締めくくりを友人として迎えた人か（恋人・恋愛ルートは除く）。 */
export function bondAfterEligible(value, id) {
  const finale = value?.finales?.[id];
  if (!BOND_AFTER[id] || !finale) return false;
  if ((value.lovers || []).includes(id)) return false;
  return finale.route === "friend" || !!value.flags?.[`_friend_${id}`];
}

const readList = (value, id) => {
  const list = value?.flags?.[FLAG]?.[id];
  return Array.isArray(list) ? list : [];
};

/**
 * この来店で読む♥5後の場面。{ kind: "story" | "short", scene } か、対象外なら null。
 * story は未読の5本のうち、前提（requires）を満たす最初のもの。無ければ short を巡回する。
 */
export function bondAfterNext(value, id) {
  if (!bondAfterEligible(value, id)) return null;
  const item = BOND_AFTER[id], read = readList(value, id);
  const owned = value.owned || [];
  const story = item.scenes.find(scene => !read.includes(scene.id) && (!scene.requires || owned.includes(scene.requires)));
  if (story) return { kind: "story", scene: story.id };
  if (!item.shorts.length) return null;
  const shortCount = Number(value.flags?.[FLAG]?.[`${id}_short`]) || 0;
  return { kind: "short", scene: item.shorts[shortCount % item.shorts.length] };
}

/** 読み終えた時の記録（呼出元が、代金・回数と同じ境界で呼ぶ）。 */
export function markBondAfterRead(value, id, next) {
  if (!next) return;
  const record = value.flags[FLAG] ||= {};
  if (next.kind === "story") {
    const list = Array.isArray(record[id]) ? record[id] : (record[id] = []);
    if (!list.includes(next.scene)) list.push(next.scene);
  } else record[`${id}_short`] = (Number(record[`${id}_short`]) || 0) + 1;
}

let loading = null;
/** 台本を DB へ読み込む（足りない時だけ）。失敗したら投げる（呼出元は代金も行動も使わずに戻る）。 */
export async function loadBondAfterScenes(DB) {
  if (BOND_AFTER_SCENE_IDS.every(scene => DB.dialogues[scene]?.lines?.length)) return;
  loading ||= readDialogues(BOND_AFTER_FILE, BOND_AFTER_SCENE_IDS)
    .then(scenes => { Object.assign(DB.dialogues, scenes); })
    .catch(error => { loading = null; throw error; });
  await loading;
}
