// 海外（第4章ドバイ）同行の正本。同行は恋人1名または「同行なし」。他の恋人・♥5の友人・ましろ・つむぎは別便の応援として別に持つ。
// ♥5の男の友人（OVERSEAS_GUESTS）は、ヒロインの応援（supports）とは分けて guests に持つ（SPC21）。
// 保存は flags._overseas_companion（SCHEMA は変えない。キーが無い旧セーブは「未選択＝同行なし」として読む）。
// 好感度・恋人状態・複数交際は一切変更しない。辞退・連絡不足・遠距離による好感度低下や破局は起こさない。
import { tokyoVisitState, syncTokyoVisits } from "./tokyo-visits.js";

// data/story_routes.json の heroine_ids と同じ順（テストで一致を確認）。ドバイに住むヌール（romance.noor.resident）は渡航しないので含めない。
export const OVERSEAS_HEROINES = Object.freeze(["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori"]);
// 恋愛状態に関係なくドバイへ来るキャラ（gameplay_agent_reference.md の登場条件表）。
// ましろは第3章クリアが条件（mukaiの視察）。つむぎは tonari の常連として、はじめの大会を見に来る（2026-11-15 オーナー決定・SPC17）。
const ALWAYS_SUPPORT = Object.freeze({ mashiro: value => value?.flags?._ch3_cleared === true, tsumugi: () => true });
// ほかのヒロインは、恋人か、友人ルートの締めくくり（♥5）を済ませた友人なら応援に来る（2026-11-15 オーナー決定・SPC17）。
// 男の友人（ヒロインではない応援）。締めくくり（♥5）を済ませた人が、それぞれの理由で来る（2026-11-15 オーナー決定・SPC21・SPC22）:
// アダムは本場のダブルアップルとはじめの卓を見に、神崎は店を部下に任せて、クラウドは店を閉めて、綾取は延長営業中の煙幕を臨時休業にして（#3676）
// （福岡の店にはバイトがいる）、スティーブは個人店を閉めて、ヴォルクはスポンサー（ナイトサイド）の関係者として。
// スミさんはtonariの留守番で来ない。なるは選手として本編で来るので含めない。
// 到着の後は砂浜（ch4-beach.js）の男の枠に入る（SPC24）。前夜の過ごし方・修羅場には出さない。
export const OVERSEAS_GUESTS = Object.freeze(["adam", "kumicho", "kuraudo", "ayatori", "steve", "volk"]);
const KEY = "_overseas_companion";

/** 保存された選択。無い・壊れている場合は未選択（decided:false、同行なし）。 */
export function overseasCompanion(value) {
  const raw = value?.flags?.[KEY];
  const heroine = id => OVERSEAS_HEROINES.includes(id);
  const valid = !!raw && typeof raw === "object" && raw.decided === true
    && (raw.companion === null || heroine(raw.companion))
    && Array.isArray(raw.supports) && raw.supports.every(heroine) && !raw.supports.includes(raw.companion);
  return valid ? { decided: true, companion: raw.companion, supports: [...raw.supports] }
    : { decided: false, companion: null, supports: [] };
}

/** 同行できるのは、成立済みの恋人だけ（サメちゃんも恋人なら可、友人なら不可）。好感度順などの自動選択はしない。 */
export function overseasCompanionCandidates(value) {
  const lovers = new Set(value?.lovers || []);
  return OVERSEAS_HEROINES.filter(id => lovers.has(id));
}

/**
 * 友人ルートの締めくくり（♥5）を済ませた友人か（daily/bonds.js の settledFriend と同じ条件）。
 * 締めくくりを読み、恋人ではなく、友情の着地か告白で「友達のまま」を選んだ人。告白を待つ恋愛ルートの相手は含めない。
 * 好感度の数値や回答からは推測しない（読了の記録だけ）。
 */
export function overseasMaxFriend(value, id) {
  const finale = value?.finales?.[id];
  if (!finale || (value?.lovers || []).includes(id)) return false;
  return finale.route === "friend" || value?.flags?.[`_friend_${id}`] === true;
}

/**
 * 別便で応援に来る人。同行者とは重ならない。
 * 恋人（同行者を除く）・友人ルートの締めくくりを済ませた友人・いつも来る人（第3章クリア済みのましろ、つむぎ）。
 * 恋人でない人は友人版の到着場面で来る（ch4-progress.js の CH4_FRIEND_ARRIVAL_SCENES）。
 */
export function overseasSupportVisitors(value, companion = null) {
  const lovers = new Set(value?.lovers || []);
  return OVERSEAS_HEROINES.filter(id => id !== companion
    && (lovers.has(id) || overseasMaxFriend(value, id) || !!ALWAYS_SUPPORT[id]?.(value)));
}

/** 別便で応援に来る男の友人（OVERSEAS_GUESTS の順）。締めくくり（♥5）を済ませた人だけ。好感度の数値だけでは来ない。 */
export function overseasGuestVisitors(value) {
  return OVERSEAS_GUESTS.filter(id => overseasMaxFriend(value, id));
}

/**
 * 出発前に確定した男の友人の応援（flags._overseas_companion.guests）。同行の選択が無い・壊れている保存や、
 * guests を持たない旧保存（SPC21 より前に出発した保存）は空。出発後の保存には足さない。
 */
export function overseasGuests(value) {
  if (!overseasCompanion(value).decided) return [];
  const raw = value.flags[KEY].guests;
  return Array.isArray(raw) && raw.every(id => OVERSEAS_GUESTS.includes(id)) && new Set(raw).size === raw.length
    ? OVERSEAS_GUESTS.filter(id => raw.includes(id)) : [];
}

/** 選択を出してよいか。第4章の導入（最初の場面の前）で、まだ決めていないときだけ。 */
export function canChooseOverseasCompanion(value) {
  const progress = value?.flags?._ch4;
  return value?.chapter === 4 && progress?.part === "prologue" && progress.stage === 0 && !overseasCompanion(value).decided;
}

/**
 * 出発前の選択を確定する唯一の入口。id は恋人1名、または null（同行なし）。
 * 決定後の変更・不正な相手・恋人でない相手は受け付けない（状態は変えない）。
 * 通常訪問の予約は、渡航中に残らないよう同時に整理する。
 */
export function chooseOverseasCompanion(value, id) {
  if (!canChooseOverseasCompanion(value)) return false;
  if (id !== null && !overseasCompanionCandidates(value).includes(id)) return false;
  value.flags[KEY] = { decided: true, companion: id, supports: overseasSupportVisitors(value, id), guests: overseasGuestVisitors(value) };
  reconcileVisitsForDeparture(value);
  return true;
}

/**
 * 渡航で成立しなくなった通常訪問（東京訪問）を、削除せず「渡航のため終了」として履歴に残す。
 * 好感度・恋人・連絡先・申し出（offers）には触れない。申し出は承諾時に再計算されるので、帰国後に安全に再調整される。
 */
export function reconcileVisitsForDeparture(value) {
  const visits = tokyoVisitState(value);
  for (const plan of visits.plans) {
    if (plan.status === "returned") continue;
    plan.status = "returned";
    plan.returnReason = "overseas_departure";
  }
  syncTokyoVisits(value);
  return visits;
}

/** 別便応援の予定として扱う人か（同行者や、条件を満たさない人は false）。 */
export const isSeparateFlightSupport = (value, id) => overseasCompanion(value).supports.includes(id);
