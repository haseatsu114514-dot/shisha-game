// 店番ゲーム（フロア営業）の本編シフト共通ランナー（mukai・ドバイ中心地のカフェ共用。Issue #4254）。
// 画面の呼び出し・手当計算・心得の盤（floorRare / floorTop / floorMatch と店番のスキル。SBD157）・進み具合の保存・日当支給・中断/LOAD時の巻き戻しを揃える。
// tonari.js の既存境界テスト（remake/test/tonari_floor_shift.mjs）に影響させないため、別モジュールとして切り出している。
import { CHARM_BONUS } from "../core/stat-step-tables.js";
import { callingSalesBonus, growthFloorPerks } from "../core/growth-effects.js";
import { on } from "../core/bus.js";
import { bgUrl } from "../core/data.js";
import { toast } from "../core/ui.js";
import { state, config } from "../core/state.js";
import { addMoney, addStamina, step, currentCondition, affinityLevel } from "../core/stats.js";
import { playBgm } from "../core/audio.js";
import { isRainy } from "./weather.js";
import { dirhamText } from "../chapters/ch4-dubai-local.js";
import {
  floorVenue, floorVenueShiftPay, floorVenueCommissionPercent, floorVenueProgress, recordFloorVenueProgress, floorVenueVisitor,
} from "./floor-venues.js";

const activeVenueShifts = new WeakSet();

/** 店舗・日付・章からその日の営業種を作る。 */
export function venueShiftSeed(s = state, venueId = "tonari") {
  let salt = 0;
  for (const ch of String(venueId)) salt = Math.imul(salt ^ ch.charCodeAt(0), 16777619);
  return ((s.weatherSeed || 0) ^ Math.imul((s.day || 0) + (s.chapter || 1) * 31, 0x45d9f3b) ^ salt) >>> 0;
}

/**
 * 指定店舗の店番シフトを1回実行する。
 * 完走したら { result, pay, allowances } を返す。中断・LOAD・導入キャンセルは null（体力・所持金・進み具合は巻き戻す）。
 */
export async function runVenueFloorShift({
  venue = "mukai",
  owner = state,
  called = false,
  intro = null,
  signal = null,
  staminaCost = null,
  night = null,
  dusk = null,
  art = null,
  artNight = null,
  extraVisitorIds = [],
  loadView = () => import("./tonari-floor-view.js"),
} = {}) {
  if (!owner || state !== owner || activeVenueShifts.has(owner) || signal?.aborted) return null;
  const v = floorVenue(venue);
  activeVenueShifts.add(owner);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const off = on("hud", () => { if (state !== owner) controller.abort(); });
  const current = () => state === owner && !controller.signal.aborted;
  const startStamina = owner.stamina;
  const startSlot = owner.slot;
  let completed = false;
  try {
    if (intro) {
      const ok = await intro();
      if (!ok || !current()) return null;
    }
    const cost = Math.max(0, staminaCost ?? v.entry.stamina ?? 0);
    const firstHalf = Math.floor(cost / 2);
    if (firstHalf > 0) addStamina(-firstHalf);
    const condition = currentCondition();
    const shiftKey = `${owner.chapter}:${owner.day}:${owner.slot}:${v.id}`;
    const callingBonus = owner.flags._minto_calling_paid === shiftKey ? 0 : callingSalesBonus(owner, condition);
    const extra = called ? (v.entry.calledBonus || 0) : 0;
    let allowanceCache = null;
    const getAllowances = () => {
      if (allowanceCache) return allowanceCache;
      const bonus = Math.round(CHARM_BONUS[step("charm") - 1] * condition.bonusRate);
      allowanceCache = {
        bonus,
        extra,
        callingBonus,
        shiftBonus: condition.shiftBonus,
        total: bonus + extra + condition.shiftBonus + callingBonus,
      };
      return allowanceCache;
    };

    const seed = venueShiftSeed(owner, v.id);
    const progress = floorVenueProgress(owner, v);
    const floorPerks = growthFloorPerks(owner);
    const visitor = floorVenueVisitor(owner, v, seed, progress.nights, floorPerks?.floorRare || 0, {
      affinityLevel,
      extraVisitorIds,
    });
    const isDusk = dusk ?? !!v.entry.dusk;
    const isNight = night ?? (isDusk ? false : owner.slot >= 1);
    const dayArt = art ?? bgUrl(v.bg.day, isNight ? "night" : "day");
    const nightArt = artNight ?? (isDusk ? bgUrl(v.bg.night, "night") : null);
    if (v.bgm) playBgm(v.bgm);

    let view = null;
    try {
      view = await loadView();
    } catch {
      if (!current()) return null;
      toast("店番の画面を読み込めなかった。今日は歩合なしで勤務を終える", { kind: "warn" });
      view = null;
    }
    if (!current()) return null;

    let result;
    if (view) {
      void import("../core/extra-games.js").then((m) => m.recordExtraPlay("floor")).catch(() => {}); // タイトルの EXTRA（EXT01）
      result = await view.runTonariFloor({
        venue: v.id,
        seed,
        level: progress.nights,
        chapter: owner.chapter,
        fans: progress.fans,
        topSales: progress.top,
        getAllowances: () => getAllowances().total,
        visitor,
        floorPerks,
        rainy: v.nightPool?.rain ? isRainy() : false,
        night: isNight,
        dusk: isDusk,
        art: dayArt,
        artNight: nightArt,
        offerTutorial: false,
        isCurrent: current,
        signal: controller.signal,
      });
    } else {
      result = { sales: 0, fallback: true };
    }
    if (!result || !current()) return null;

    const secondHalf = cost - firstHalf;
    if (secondHalf > 0) addStamina(-secondHalf);
    if (!result.fallback) recordFloorVenueProgress(owner, v, result);
    const detail = getAllowances();
    // 売り上手（K28。SBD157）: 歩合の率に足す。営業の精算と同じ値（営業を開いた時の盤）を使う
    const commissionBonus = result.fallback ? 0 : result.commissionBonus || 0;
    const pay = floorVenueShiftPay(v, owner.chapter, result.sales || 0, detail.total, commissionBonus);
    addMoney(pay.total);
    if (detail.callingBonus) owner.flags._minto_calling_paid = shiftKey;
    const allowanceNote = pay.allowances ? `＋手当${pay.allowances.toLocaleString("ja-JP")}円` : "";
    const aedNote = v.currency === "aed" ? `（${dirhamText(pay.total)}）` : "";
    toast(`${v.name}のシフト日当 +${pay.total.toLocaleString("ja-JP")}円${aedNote}（基本給${pay.base.toLocaleString("ja-JP")}円＋歩合${pay.commission.toLocaleString("ja-JP")}円${allowanceNote}）`, { kind: "good" });
    if (detail.callingBonus) toast(`呼び込みの手当 +${detail.callingBonus.toLocaleString("ja-JP")}円`, { kind: "good" });
    if (detail.bonus) toast(`指名ボーナス（魅力）+${detail.bonus.toLocaleString("ja-JP")}円`, { kind: config.statEffectColors !== false ? "charm-bonus" : "good" });
    if (detail.extra) toast(`急なシフトの上乗せ +${detail.extra.toLocaleString("ja-JP")}円`, { kind: "good" });
    if (detail.shiftBonus) toast(`仕上げは好調。手当 +${detail.shiftBonus.toLocaleString("ja-JP")}円`, { kind: "good" });
    const commissionExtra = pay.commission - floorVenueShiftPay(v, owner.chapter, result.sales || 0, 0).commission;
    if (commissionExtra > 0) toast(`売り上手。歩合は売上の${floorVenueCommissionPercent(v, commissionBonus)}%（+${commissionExtra.toLocaleString("ja-JP")}円）`, { kind: "good" });
    if (condition.health === "red" && (detail.bonus > 0 || detail.callingBonus > 0)) {
      toast("疲れで仕上げが不安定。指名・呼び込みのボーナスは半額", { kind: "warn" });
    }
    completed = true;
    return { result, pay, allowances: detail };
  } finally {
    if (!completed && state === owner) {
      addStamina(startStamina - owner.stamina);
      owner.slot = startSlot;
    }
    signal?.removeEventListener("abort", abort);
    off();
    controller.abort();
    activeVenueShifts.delete(owner);
  }
}
