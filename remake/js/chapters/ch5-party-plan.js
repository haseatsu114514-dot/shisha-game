// 打ち上げの席と振り分け（純粋。DOM・保存に触れない）。再生は chapters/ch5-party.js。
import { selectPostEndingConflict } from "../core/story-routes.js";

// はじめの呼び方（台本での呼び方に合わせる。店の外の打ち上げでも、みんとは「みんと」）
// ヌールはドバイに住むので席には座らない（打ち上げにはテレビ電話で加わる・DSR20）。名前の表として持つ。
export const SEAT_LABELS = Object.freeze({ tsumugi: "つむぎちゃん", minto: "みんと", rio: "凛想さん", ageha: "あげはさん",
  mashiro: "ましろちゃん", samechan: "サメちゃん", hiyori: "ひよりさん", noor: "ヌールさん" });

/** 遠くに住むヒロイン（data/story_routes.json の romance[id].resident）。打ち上げの席にはいない。 */
const livesAway = (routes, id) => !!routes?.romance?.[id]?.resident;

/**
 * 打ち上げにいるヒロイン（会ったことのある人）と、その中の恋人。
 * remote は遠くに住む恋人（ヌール）で、席には座らずテレビ電話で加わる（オーナー「修羅場イベントではテレビ電話で参戦」）。
 */
export function partyGuests(routes, value) {
  const met = (routes?.heroine_ids || []).filter(id => !!value?.met?.[id]);
  const present = met.filter(id => !livesAway(routes, id));
  const ordered = [...new Set(value?.lovers || [])];
  const lovers = ordered.filter(id => present.includes(id));
  const remote = ordered.filter(id => met.includes(id) && livesAway(routes, id));
  return { present, lovers, remote };
}

/** 恋人の数（席の恋人とテレビ電話の恋人）が修羅場の人数に届くか。席の選び方には左右されない。 */
const conflictBound = (routes, { lovers, remote }) => lovers.length + remote.length >= (routes.conflict?.minimum_present_lovers || 2);

/**
 * 席を選ぶ前に読む場面（純粋）。修羅場になる打ち上げでは、遠くの恋人（ヌール）のお祝いのテレビ電話をここで受ける（#2815）。
 * 反応（shuraba_noor）は「テレビ電話は、つながったまま」「聞こえてた」と、はじめの打ち明けの前につながっていた前提なので、
 * 打ち明け（ch5_party_shuraba_open）より前に置く。修羅場にならない打ち上げでは、従来どおり席の後の途中で着信する。
 */
export function partyBeforeSeat(routes, value) {
  const guests = partyGuests(routes, value);
  return conflictBound(routes, guests) ? guests.remote.map(id => `ch5_party_${id}_call`) : [];
}

/**
 * 修羅場の引き金になる場面（席ごと。2026-11-11 オーナー「最後の修羅場は演出をしっかり・やってしまった感」）。
 * 恋人の隣: その人が恋人らしく振る舞ったところを見られる（一人ずつ）。スミさんの隣・友人の隣: それぞれ共通の場面。
 */
export const partyTrigger = (lovers, seat) => seat === "sumi" ? "ch5_party_trigger_sumi"
  : lovers.includes(seat) ? `ch5_party_trigger_${seat}` : "ch5_party_trigger_friend";

/** 席を選んだ後に読む場面（純粋。テスト用に公開）。 */
export function partyScenes(routes, value, seat) {
  const { present, lovers, remote } = partyGuests(routes, value);
  // テレビ電話の恋人も数える（席にいる恋人と合わせて2人以上で修羅場）。着信は席の前（partyBeforeSeat）で済んでいる
  if (conflictBound(routes, { lovers, remote })) {
    const conflict = selectPostEndingConflict(routes, value, { present: [...present, ...remote] });
    // 隣に座った恋人の反応は最後に読む（さっきまで隣で笑っていた人が、いちばん後に口を開く）。記録する並び（participants）は変えない
    const order = [...conflict.participants.filter(id => id !== seat), ...conflict.participants.filter(id => id === seat)];
    const reactions = order.map(id => routes.romance[id].conflict);
    return { kind: "conflict", participants: conflict.participants, remote: conflict.participants.filter(id => remote.includes(id)), reactions,
      scenes: [partyTrigger(lovers, seat), "ch5_party_shuraba_open", ...reactions, routes.conflict.close, "ch5_party_shuraba_close"] };
  }
  const seatScene = seat === "sumi" ? "ch5_party_seat_sumi" : lovers.includes(seat) ? "ch5_party_seat_lover" : "ch5_party_seat_friend";
  const away = lovers.length === 1 && seat !== lovers[0] ? ["ch5_party_seat_away"] : [];
  // 恋人が遠くにいるだけなら、途中でお祝いのテレビ電話が来る
  const calls = remote.map(id => `ch5_party_${id}_call`);
  return { kind: lovers.length || remote.length ? "lover" : "none", participants: [], scenes: [seatScene, ...away, ...calls, "ch5_party_close"] };
}

