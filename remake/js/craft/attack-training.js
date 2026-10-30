// 授業の完了だけを根拠にする。旧授業・好感度・物語の消化数からは推定しない。
export const ATTACK_UNLOCK = "_sumi_attack_learned";
export const hasAttackTraining = flags => flags?.[ATTACK_UNLOCK] === true;
export const ATTACK_LOCK_REASON = "未習得：スミさんの蒸らしアタックの授業で解放";
