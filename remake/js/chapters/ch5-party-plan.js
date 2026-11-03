// 打ち上げの席と振り分け（純粋。DOM・保存に触れない）。再生は chapters/ch5-party.js。
import { selectPostEndingConflict } from "../core/story-routes.js";

// はじめの呼び方（台本での呼び方に合わせる。店の外の打ち上げでも、みんとは「みんと」）
export const SEAT_LABELS = Object.freeze({ tsumugi: "つむぎちゃん", minto: "みんと", rin: "くゆりさん", ageha: "あげはさん",
  mashiro: "ましろちゃん", samechan: "サメちゃん", hiyori: "ひよりさん" });

/** 打ち上げにいるヒロイン（会ったことのある人）と、その中の恋人。 */
export function partyGuests(routes, value) {
  const present = (routes?.heroine_ids || []).filter(id => !!value?.met?.[id]);
  const lovers = [...new Set(value?.lovers || [])].filter(id => present.includes(id));
  return { present, lovers };
}

/** 席を選んだ後に読む場面（純粋。テスト用に公開）。 */
export function partyScenes(routes, value, seat) {
  const { present, lovers } = partyGuests(routes, value);
  if (lovers.length >= (routes.conflict?.minimum_present_lovers || 2)) {
    const conflict = selectPostEndingConflict(routes, value, { present });
    return { kind: "conflict", participants: conflict.participants,
      scenes: ["ch5_party_shuraba_open", ...conflict.participants.map(id => routes.romance[id].conflict),
        routes.conflict.close, "ch5_party_shuraba_close"] };
  }
  const seatScene = seat === "sumi" ? "ch5_party_seat_sumi" : lovers.includes(seat) ? "ch5_party_seat_lover" : "ch5_party_seat_friend";
  const away = lovers.length === 1 && seat !== lovers[0] ? ["ch5_party_seat_away"] : [];
  return { kind: lovers.length ? "lover" : "none", participants: [], scenes: [seatScene, ...away, "ch5_party_close"] };
}

