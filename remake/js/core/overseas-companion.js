// 海外（第4章ドバイ）同行の正本。同行は恋人1名または「同行なし」。他の恋人・ましろは別便の応援として別に持つ。
// 保存は flags._overseas_companion（SCHEMA は変えない。キーが無い旧セーブは「未選択＝同行なし」として読む）。
// 好感度・恋人状態・複数交際は一切変更しない。辞退・連絡不足・遠距離による好感度低下や破局は起こさない。
import { tokyoVisitState, syncTokyoVisits } from "./tokyo-visits.js";

// data/story_routes.json の heroine_ids と同じ順（テストで一致を確認）。
export const OVERSEAS_HEROINES = Object.freeze(["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan", "hiyori"]);
// 恋愛状態に関係なくドバイへ来る唯一のキャラ（第3章クリアが条件。gameplay_agent_reference.md の登場条件表）。
const ALWAYS_SUPPORT = "mashiro";
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

/** 別便で応援に来る人。恋人（同行者を除く）とましろ（第3章クリア済みなら恋人でなくても）。同行者とは重ならない。 */
export function overseasSupportVisitors(value, companion = null) {
  const lovers = new Set(value?.lovers || []);
  return OVERSEAS_HEROINES.filter(id => id !== companion
    && (lovers.has(id) || (id === ALWAYS_SUPPORT && value?.flags?._ch3_cleared === true)));
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
  value.flags[KEY] = { decided: true, companion: id, supports: overseasSupportVisitors(value, id) };
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
