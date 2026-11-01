// 通常のマス・色の台座の実効値。仮置きは含めず、確定した有効なIDを一度だけ数える。
import { growthEnabled } from "./growth-mode.js";
import { NODE_BY_ID } from "./growth-board-layout.js";
import { SQUARE_PERKS, PERK_TIERS, GATE_TIER, NOTABLES, SKILLS, LESSONS } from "./growth-board-data.js";
import { STAMINA_CONDITIONS } from "./condition.js";

/** 調整用の初期値。通常マスの百分率とは別に重ねる（SPEC 2.5）。 */
export const SKILL_TUNING = Object.freeze({ sleep: .1, first: .2, mastery: .2, leaf: .2, holesSeconds: 6, strain: .75,
  coalReplacement: .2, forecastRead: .15, bargain: .1, critical: 1.5, criticalCap: 3, momentum: 2, smokeRing: 1, afterglowSeconds: 3, afterglowSpeed: .65 });
const skillIds = new Set(SKILLS.map(s => s.id));
const lessonIds = new Set(LESSONS.map(s => s.id));
export const LESSON_TUNING = Object.freeze({ stamina: 20, mix: 4, cardamomPenalty: .5, lavenderSleep: .2, single: 4 });
/** 授業は盤に灯すだけでは発動しない。対面で相談を終えた記録も必要。 */
export const growthLesson = (s, id) => growthEnabled() && lessonIds.has(id)
  && Array.isArray(s?.growth?.nodes) && s.growth.nodes.includes(id)
  && Array.isArray(s?.growth?.learned) && s.growth.learned.includes(id);
export const growthSkill = (s, id) => growthEnabled() && skillIds.has(id)
  && Array.isArray(s?.growth?.nodes) && s.growth.nodes.includes(id);
export const densePackAvailable = s => !growthEnabled() || growthSkill(s,"K18") || s?.flags?._dense_pack_legacy === true;

/** 執筆済みの普通の返答だけを示す。告白・関係の質問・強制場面・未知の選択肢へ正解を作らない。 */
export function growthChoiceIndex(s, dialogueId, line, hints, optional = false) {
  if (!optional || !growthSkill(s,"K07") || line?.choices?.length !== 2
    || /bond|confess|finale|lover|feelings/.test(dialogueId)) return -1;
  const hint = hints?.choices?.[`${dialogueId}:${line.id || ""}`];
  if (hint?.kind !== "conversation" || hint.options?.length !== 2) return -1;
  const options = line.choices.map(c => String(c.next || c.next_id || ""));
  if (hint.options.some((id,i) => id !== options[i])) return -1;
  const index = options.indexOf(hint.preferred), choice = line.choices[index];
  return !choice || choice.condition_type === "money" && s.money < Number(choice.threshold || 0) ? -1 : index;
}

/** 機能付きの通常マス。旧能力由来の解放は各使用箇所のOR条件で保持する。 */
export const growthFeature = (s, key) => growthEnabled() && Array.isArray(s?.growth?.nodes)
  && s.growth.nodes.some(id => typeof id === "string" && Object.hasOwn(NODE_BY_ID, id) && NODE_BY_ID[id].feature === key);

/** 大一番の胆力は本番の一台だけ。現在体力や日常の体調には書き戻さない。 */
export function growthCraftCondition(s, mode, condition) {
  if (mode !== "tournament" || !growthSkill(s, "K12")) return condition;
  return STAMINA_CONDITIONS[{ red: "yellow", yellow: "green", green: "green" }[condition.health]] || condition;
}

/** 表示と処理が共有する帯・要の倍率。 */
export const perkMultiplier = node => (node.kind === "gate" ? GATE_TIER.mult : PERK_TIERS[node.band]?.mult || 1)
  * (node.notable ? NOTABLES[node.notable]?.bonus || 1 : 1);

export function boardPerks(nodes = []) {
  const sums = { stamina: 0, sleep: 0, charm: 0, stage: 0, heat: 0, pull: 0,
    dodge: 0, breath: 0, gauge: 0, leaf: 0, tongue: 0, coal: 0 };
  for (const id of new Set(Array.isArray(nodes) ? nodes : [])) {
    if (typeof id !== "string" || !Object.hasOwn(NODE_BY_ID, id)) continue;
    const node = NODE_BY_ID[id];
    if (!node || !["stat", "gate"].includes(node.kind)) continue;
    const def = SQUARE_PERKS[node.board], perk = !node.peak && def.perks[node.perk];
    if (perk) {
      const unit = Number(/\{([\d.]+)\}/.exec(perk.text)?.[1] || 0);
      if (Object.hasOwn(sums, node.perk)) sums[node.perk] += unit * perkMultiplier(node);
    } else if (node.kind === "stat") {
      // 極みの「基礎」。通常マスとは別の複合効果（盤データの base）。
      const base = { body: { stamina: 1, sleep: 1 }, sense: { dodge: 1, heat: .5, pull: .5 },
        wisdom: { gauge: .5, leaf: 1 } }[node.board];
      for (const [key, value] of Object.entries(base)) sums[key] += value * perkMultiplier(node);
    }
  }
  return sums;
}

/** 旧能力の保存値は保持し、確定済みの盤の恩恵を各使用箇所で加算する。 */
export const growthPerks = s => growthEnabled() ? boardPerks(s?.growth?.nodes) : null;

/** 会心は実際のジャスト帯の中央2割。自動落下・教材・無効な時刻は対象にしない。 */
export function growthCritical(s, error, width, { tutorial = false, automatic = false } = {}) {
  return !tutorial && !automatic && growthSkill(s,"K15") && Number.isFinite(error)
    && Number.isFinite(width) && width > 0 && Math.abs(error) <= width * .1 + 1e-9;
}

/** 一つ前の確定工程の手応えだけを読む。基礎点を一台へ保存し、再評価・LOADで積み増さない。 */
export function settleGrowthPhase(s, cs, key, result, precise = false) {
  if (!growthSkill(s,"K16") || cs.mode !== "tournament" || !result || !Number.isFinite(result.score)) return result?.score;
  const sequence = ["mix", ...(cs.holes?.skipped ? [] : ["holes"]), "heat", "steam", "pull", "care1", "care2"];
  const index = sequence.indexOf(key);
  if (index < 0) return result.score;
  const base = Number.isFinite(result.growthBaseScore) ? result.growthBaseScore : result.score;
  cs.growthPhases ??= {};
  const previous = cs.growthPhases[sequence[index-1]];
  const bonus = !result.failed && base > 0 && previous?.precise === true ? SKILL_TUNING.momentum : 0;
  result.growthBaseScore = base;
  result.growthPhaseBonus = bonus;
  result.score = Math.min(100, Math.max(0, base + bonus));
  if (Object.hasOwn(result,"grade")) result.grade = result.score >= 90 ? "S" : result.score >= 80 ? "A" : result.score >= 65 ? "B" : result.score >= 50 ? "C" : "D";
  cs.growthPhases[key] = { precise: !result.failed && !!precise, base, bonus, score: result.score };
  return result.score;
}

/** 保険は本番の一台で一度だけ。記録をcsへ残すので熱管理・LOADをまたいでも戻らない。 */
export function useGrowthInsurance(s, cs, kind) {
  if (cs?.mode !== "tournament" || cs.growthInsuranceUsed || !["burnt","cold","leaf"].includes(kind) || !growthFeature(s,"insurance")) return false;
  cs.growthInsuranceUsed = true; cs.growthInsuranceKind = kind;
  return true;
}
