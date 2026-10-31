// 第3章で恋愛ルートを着地させる、あげは・ましろの告白の入口（#1930）。DOMを持たない純粋ロジック。
// 二人には交友の締めくくり（daily/bonds.js）・専用ハガルの正式原稿が無い。
// 仮置き（#1930）: 既存の告白台本の中の返事（付き合う／友達のまま）を実回答にする。好感度・訪問回数だけからは開かない。
// - ましろ: 第3章の任意4場面（ch3_mashiro_*）の後の寄り道 confession_mashiro（ch3-story-wiring.js）。
// - あげは（#1988・master_spec §24）: 他のヒロインと同じく、第2章の♥3の分岐（ch2_ageha_bond_question）で恋愛寄りに答え、
//   ♥5に達した場合だけ。帰郷後の再会 ch3_ageha_reunion の翌日、帰り際の confession_ageha（ch3-aftermath.js）。
//   満たさなければ告白は起きず、再会の後そのまま第3章完へ進む。
// 締めくくりの正式原稿が入ったら、この入口を BOND_FINALES の流れへ差し替える。
// このモジュールは import を持たない（ch3_menu_bgm.mjs の harness が実物を直接読む）。

export const CH3_CONFESSION_IDS = Object.freeze(["ageha", "mashiro"]);
export const AGEHA_CONFESSION_SCENES = Object.freeze(["confession_ageha", "confession_ageha_accept", "confession_ageha_reject"]);
/** あげはの♥3の分岐の選択肢 id（data/dialogue/ch2_ageha_story.json・core/stats.js AFFINITY_GATE_CHOICES と同じ）。 */
export const AGEHA_ROUTE_CHOICE = "bond_q1_ageha";
/** 告白は再会（dayAfterWin 3）の翌日の昼。再会と同じ日には起こさない（#1988）。 */
export const AGEHA_CONFESSION_DAY_AFTER_WIN = 4;
/** ♥5の下限ポイント（core/stats.js の AFFINITY_RANK_PTS[5] と同じ値。ch3_aftermath.mjs が一致を確認する）。 */
export const AGEHA_HEART_MAX_PTS = 66;

/** 告白の返事で着地済みか（恋人／友達のまま）。旧セーブの成立済みの関係もそのまま着地扱い。 */
export const confessionLanded = (value, id) => (value?.lovers || []).includes(id) || !!value?.flags?.[`_friend_${id}`];

/** ♥3の分岐で恋愛寄りに答えたか。未回答・友情寄り・友達のままで着地した保存は恋愛と推測しない。 */
export function agehaRomanceChosen(value) {
  const answer = value?.romanceChoices?.[AGEHA_ROUTE_CHOICE];
  return !!answer && answer.char === "ageha" && Number.isFinite(answer.value) && answer.value > 0
    && !value.flags?._friend_ageha;
}

/** ♥5（好感度MAX）に達しているか。恋人は好感度MAX扱い（affinityLevel と同じ）。 */
export const agehaHeartsMax = value => (value?.lovers || []).includes("ageha")
  || (value?.affinity?.ageha || 0) >= AGEHA_HEART_MAX_PTS;

/**
 * あげはの告白を待つ保存か: 第3章の後日談を読み終え（再会まで読了）、♥3の分岐で恋愛寄り・♥5で、まだ着地していない。
 * 条件を満たす間は第4章へ進めない。満たさない保存は告白を飛ばして第3章完へ。
 */
export const agehaConfessionDue = value => value?.chapter === 3 && value.flags?._ch3_cleared === true
  && !confessionLanded(value, "ageha") && agehaRomanceChosen(value) && agehaHeartsMax(value);

/**
 * 告白の日（再会の翌日の昼）へ時計を進める。すでに進んでいれば何もしない（戻さない）。
 * 呼び出し側（ch3-aftermath.js）が true のとき syncTokyoVisits と保存を行う。
 * @returns 日時を変えたか
 */
export function beginAgehaConfessionDay(value) {
  if (!agehaConfessionDue(value)) return false;
  const winDay = value.flags._ch3_aftermath?.winDay;
  if (!Number.isInteger(winDay)) return false;
  const day = winDay + AGEHA_CONFESSION_DAY_AFTER_WIN;
  if (value.day >= day) return false;
  value.day = day;
  value.slot = 0;
  return true;
}

/** 読み終えた告白の中で実際に入った返事の場面（confession_<id>_accept|reject）。無ければ null。 */
export function confessionAnswer(visited, id) {
  const re = new RegExp(`^confession_${id}_(accept|reject)$`);
  return [...(visited || [])].reverse().find(scene => re.test(scene)) || null;
}
