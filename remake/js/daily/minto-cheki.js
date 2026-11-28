// PEPPERMINTで頼むみんとのチェキ（PFC14・15・#3941）。来店の会話のあとに、頼むかどうかを選ぶ。
// 頼むチェキ（ソロ）は持っていないものから無作為に1枚（被りなし）。2ショットは頼んで出るものではなく、
// 来店の会話の流れで撮って渡してくれる回（daily/spots.js の MINTO_TWOSHOT_EVENTS・PFC17）。正体がつながり、本名を本人から聞いた後は、
// 頼むとたまに、閉店後に撮った私服の一枚をトレイの下からこっそりくれる（お代はいらない）。
// 私服のチェキのサインは本名なので、本名を聞く前には出さない（data/characters.json の minto の private_name）。
// 持っている写真は state.keepsakes（記念品）に入り、ギャラリーにも残る。台本は data/dialogue/ch1_minto.json。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { play } from "../vn/engine.js";
import { MINTO_CHEKIS, MINTO_SECRET_CHEKIS } from "../core/minto-cheki-data.js";

export const MINTO_CHEKI_ASK = "minto_cheki_ask";
export const MINTO_CHEKI_TAKE = "minto_cheki_take";
/** 正体と本名を知った後、頼んだときに私服の一枚が出る確率（普通のチェキを集め終えた後は必ず） */
export const SECRET_CHEKI_CHANCE = 0.25;

const owned = (s, id) => Array.isArray(s?.keepsakes) && s.keepsakes.includes(id);
export const mintoChekisLeft = (s = state) => MINTO_CHEKIS.filter((c) => !owned(s, c.id));
export const secretChekiOpen = (s = state) => !!s?.flags?._minto_identity_revealed && !!s?.flags?._minto_name_known;
export const secretChekisLeft = (s = state) => secretChekiOpen(s) ? MINTO_SECRET_CHEKIS.filter((c) => !owned(s, c.id)) : [];

/** 次に頼んだときの一枚。どちらも持っていないものからだけ選ぶ。 */
export function pickMintoCheki(s = state, rand = Math.random) {
  const normal = mintoChekisLeft(s), secret = secretChekisLeft(s);
  const pool = secret.length && (!normal.length || rand() < SECRET_CHEKI_CHANCE) ? secret : normal;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] : null;
}

/** 頼める来店か。初来店（台本の中に記念のチェキがある）の後で、まだもらえる写真が残っているとき。 */
export const mintoChekiOfferDue = (s = state) => (s?.story?.minto || 0) >= 1
  && (mintoChekisLeft(s).length > 0 || secretChekisLeft(s).length > 0)
  && !!DB.dialogues?.[MINTO_CHEKI_ASK]?.lines?.length;

/**
 * 頼むかを選ぶ → 頼んだら1枚撮る（または、こっそりもらう）。もらえたら true。
 * 代金は台本の buy_keepsake が払う（私服の一枚は0円）。保存は来店の後の通常の保存に任せる。
 */
export async function offerMintoCheki({ signal = null, rand = Math.random } = {}) {
  const owner = state;
  if (!mintoChekiOfferDue(owner) || signal?.aborted) return false;
  const live = (result) => state === owner && !signal?.aborted && !!result && !result.cancelled;
  const asked = await play(MINTO_CHEKI_ASK, { signal });
  if (!live(asked) || !asked.visited?.includes(MINTO_CHEKI_TAKE)) return false;
  const pick = pickMintoCheki(owner, rand);
  if (!pick || !DB.dialogues[pick.scene]) return false;
  await play(pick.scene, { signal });
  return state === owner && owned(owner, pick.id);
}
