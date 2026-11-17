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
  // なる・アダムは店（daily/spots.js の visitChar・第2〜4章の準備・第5章の街の店）、つむぎは tonari の客（daily/tonari.js の tonariCustomer）、
  // スミさんはバイト上がりの会話（daily/tonari.js の afterShiftSumiTalk）で出す
  naru: entry("naru", {
    scenes: [{ id: "bond_after_naru_1", requires: "suyaki_naru" }, "bond_after_naru_2", "bond_after_naru_3",
      "bond_after_naru_4", "bond_after_naru_5"],
    shorts: ["bond_after_naru_short_a", "bond_after_naru_short_b", "bond_after_naru_short_c", "bond_after_naru_short_d"],
  }),
  adam: entry("adam", {
    scenes: [{ id: "bond_after_adam_1", requires: "suyaki_adam" }, "bond_after_adam_2", "bond_after_adam_3",
      "bond_after_adam_4", "bond_after_adam_5"],
    shorts: ["bond_after_adam_short_a", "bond_after_adam_short_b", "bond_after_adam_short_c", "bond_after_adam_short_d"],
  }),
  tsumugi: entry("tsumugi", {
    scenes: [{ id: "bond_after_tsumugi_1", requires: "suyaki_tsumugi" }, "bond_after_tsumugi_2", "bond_after_tsumugi_3",
      "bond_after_tsumugi_4", "bond_after_tsumugi_5"],
    shorts: ["bond_after_tsumugi_short_a", "bond_after_tsumugi_short_b", "bond_after_tsumugi_short_c", "bond_after_tsumugi_short_d"],
  }),
  sumi: entry("sumi", {
    scenes: [{ id: "bond_after_sumi_1", requires: "suyaki_sumi" }, "bond_after_sumi_2", "bond_after_sumi_3",
      "bond_after_sumi_4", "bond_after_sumi_5"],
    shorts: ["bond_after_sumi_short_a", "bond_after_sumi_short_b", "bond_after_sumi_short_c", "bond_after_sumi_short_d"],
  }),
  // ヒロインの友人ルート: みんと（visitChar・第5章のPEPPERMINT）・凛想（visitRio→visitChar・第5章の2階）・
  // サメちゃん（daily/samechan.js の visitSamechan・第5章のSHISHARK）・ひより（daily/hiyori.js の他店の相席と約束した店。
  // 素焼きの一台は友人の一服 friends.json が描くので、一本目に前提を置かない）
  minto: entry("minto", {
    scenes: [{ id: "bond_after_minto_1", requires: "suyaki_minto" }, "bond_after_minto_2", "bond_after_minto_3",
      "bond_after_minto_4", "bond_after_minto_5"],
    shorts: ["bond_after_minto_short_a", "bond_after_minto_short_b", "bond_after_minto_short_c", "bond_after_minto_short_d"],
  }),
  rio: entry("rio", {
    scenes: [{ id: "bond_after_rio_1", requires: "suyaki_rio" }, "bond_after_rio_2", "bond_after_rio_3",
      "bond_after_rio_4", "bond_after_rio_5"],
    shorts: ["bond_after_rio_short_a", "bond_after_rio_short_b", "bond_after_rio_short_c", "bond_after_rio_short_d"],
  }),
  samechan: entry("samechan", {
    scenes: [{ id: "bond_after_samechan_1", requires: "suyaki_samechan" }, "bond_after_samechan_2", "bond_after_samechan_3",
      "bond_after_samechan_4", "bond_after_samechan_5"],
    shorts: ["bond_after_samechan_short_a", "bond_after_samechan_short_b", "bond_after_samechan_short_c", "bond_after_samechan_short_d"],
  }),
  hiyori: entry("hiyori", {
    scenes: ["bond_after_hiyori_1", "bond_after_hiyori_2", "bond_after_hiyori_3",
      "bond_after_hiyori_4", "bond_after_hiyori_5"],
    shorts: ["bond_after_hiyori_short_a", "bond_after_hiyori_short_b", "bond_after_hiyori_short_c", "bond_after_hiyori_short_d"],
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
/**
 * 台本を DB へ読み込む（足りない時だけ）。失敗したら投げる（呼出元は代金も行動も使わずに戻る）。
 * 同時の呼び出しは一つの読み込みを待つ。読み込みが済んだら次の呼び出しは台本の有無から見直す（DB が入れ替わっても読み直せる）。
 */
export async function loadBondAfterScenes(DB) {
  if (BOND_AFTER_SCENE_IDS.every(scene => DB.dialogues[scene]?.lines?.length)) return;
  loading ||= readDialogues(BOND_AFTER_FILE, BOND_AFTER_SCENE_IDS).finally(() => { loading = null; });
  Object.assign(DB.dialogues, await loading);
}
