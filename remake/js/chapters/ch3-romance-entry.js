// 第3章で恋愛ルートを着地させる、あげは・ましろの告白の入口（#1930）。DOMを持たない純粋ロジック。
// 二人には交友の締めくくり（daily/bonds.js）・恋愛／友情の質問・専用ハガルの正式原稿がまだ無い。
// 仮置き（仕様未決・#1930）: 既存の告白台本の中の返事（付き合う／友達のまま）を実回答にし、
// 関係の節目を読み終えた後にだけ入口を開く。好感度・訪問回数からは開かない。
// - ましろ: 第3章の任意4場面（ch3_mashiro_*）の後の寄り道 confession_mashiro（ch3-story-wiring.js）。
// - あげは: 後日談の最後の再会 ch3_ageha_reunion の直後、帰り際の confession_ageha（ch3-aftermath.js）。
// 締めくくりの正式原稿が入ったら、この入口を BOND_FINALES の流れへ差し替える。

export const CH3_CONFESSION_IDS = Object.freeze(["ageha", "mashiro"]);
export const AGEHA_CONFESSION_SCENES = Object.freeze(["confession_ageha", "confession_ageha_accept", "confession_ageha_reject"]);

/** 告白の返事で着地済みか（恋人／友達のまま）。旧セーブの成立済みの関係もそのまま着地扱い。 */
export const confessionLanded = (value, id) => (value?.lovers || []).includes(id) || !!value?.flags?.[`_friend_${id}`];

/** あげはの告白を待つ保存か: 第3章の後日談を読み終え（再会まで読了）、まだ着地していない。第4章へは進めない。 */
export const agehaConfessionDue = value => value?.chapter === 3 && value.flags?._ch3_cleared === true
  && !confessionLanded(value, "ageha");

/** 読み終えた告白の中で実際に入った返事の場面（confession_<id>_accept|reject）。無ければ null。 */
export function confessionAnswer(visited, id) {
  const re = new RegExp(`^confession_${id}_(accept|reject)$`);
  return [...(visited || [])].reverse().find(scene => re.test(scene)) || null;
}
