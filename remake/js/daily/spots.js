// 第1章のスポット定義と「行く」の中身（訪問・施設・休む）。
// どの行動にも必ず報酬（好感度・ステ・体力・お金のどれか）が付く。
import { state, markMet } from "../core/state.js";
import { DB } from "../core/data.js";
import { gainStat, gainAffinity, addStamina, addMoney, affinityLevel } from "../core/stats.js";
import { play } from "../vn/engine.js";
import { playBgm } from "../core/audio.js";

export const VISIT_COST = 3000;

// キャラ別の「通うと伸びる」主要ステ（ch1の6人で5種を一通りカバー）
export const CHAR_STAT = { sumi: "technique", tsumugi: "sense", naru: "insight", adam: "guts", minto: "charm", rin: "sense" };

// 固有会話の順番。特別回（常連回・総督回など）は関係ができた頃合いに一度だけ挟む
export const VISIT_SEQ = {
  sumi: ["ch1_sumi_tutorial", "ch1_sumi_basics", "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final"],
  tsumugi: ["ch1_tsumugi_first", "ch1_tsumugi_second", "ch1_tsumugi_third", "ch1_tsumugi_fourth", "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color"],
  naru: ["ch1_naru_first", "ch1_naru_second", "ch1_naru_third", "ch1_naru_group_regulars", "ch1_naru_fourth", "ch1_naru_fifth"],
  adam: ["ch1_adam_first", "ch1_adam_second", "ch1_adam_group_soutoku", "ch1_adam_third", "ch1_adam_outing_dagurikura", "ch1_adam_fourth", "ch1_adam_fifth"],
  minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_group_regulars", "ch1_minto_fourth", "ch1_minto_fifth", "ch1_minto_phantom_smell"],
  rin: ["ch1_rin_first", "ch1_rin_second", "ch1_rin_third"],
};
const REPEAT_POOL = {
  rin: ["ch1_rin_repeat", "ch1_rin_repeat_b", "ch1_rin_repeat_c"],
};
// 固有会話をいくつ見たら LIME を交換済みとみなすか（交換シーンは固有会話の中にある）
const LIME_EXCHANGE = { naru: 2, adam: 3, minto: 1, tsumugi: 2, sumi: 1, rin: 2 };

// 背景（訪問先）
export const VISIT_BG = {
  sumi: "bg_tonari_inside", tsumugi: "bg_tonari_inside",
  naru: "kemurikusa", adam: "bg_eden_shop", minto: "peppermint", rin: "bg_fookah_showroom",
};

/**
 * マップのスポット。x/y はマップ（bg_osu_map）上の位置（%）で、看板ピンのしっぽの先が指す地点。
 * 配置は旧版の SPOT_LAYOUT（O19/F4 で押しやすさと情報パネルとの被りを調整済み）を踏襲する。
 * kind: tonari（サブメニュー）/ rival（店主に会う）/ shop / spot（施設）/ rest
 * theme: 看板の色 / glyph: 顔ドット絵が無いときの一文字 / face: 看板に出す顔（面識があれば）
 * sub: 看板の下の札（店主に会う前は unknownSub）
 * closedOn: day % 7 がこの値の日は定休日
 */
export const SPOTS = [
  { id: "tonari", kind: "tonari", label: "tonari", area: "バイト先", x: 86, y: 36, theme: "baito", glyph: "店", face: "sumi", sub: "tonari（お店）",
    desc: "バイト先のシーシャラウンジ。客として一服するか、シフトに入るか。" },
  { id: "naru", kind: "rival", charId: "naru", label: "KEMURIKUSA", area: "商店街の外れ", x: 70, y: 24, theme: "rival", glyph: "煙", face: "naru", cost: VISIT_COST, closedOn: 3,
    sub: "なるの店へ行く", unknownSub: "KEMURIKUSAを覗く",
    desc: "焼き菓子みたいな甘い匂いの人気店。若い店主が一人で回しているらしい。", stamina: -16 },
  { id: "adam", kind: "rival", charId: "adam", label: "EDEN", area: "下町", x: 46, y: 48, theme: "rival", glyph: "煙", face: "adam", cost: VISIT_COST, closedOn: 5,
    sub: "アダムの店へ行く", unknownSub: "EDENを覗く",
    desc: "焼き林檎みたいな匂いが漏れてくる店。注文はなぜかいつも一種類。", stamina: -16 },
  { id: "minto", kind: "rival", charId: "minto", label: "PEPPERMINT", area: "繁華街", x: 28, y: 62, theme: "rival", glyph: "煙", face: "minto", cost: VISIT_COST, closedOn: 6,
    sub: "みんとの店へ行く", unknownSub: "PEPPERMINTを覗く",
    desc: "SNSで人気のポップな店。コンカフェ風の接客らしい。", stamina: -16 },
  { id: "shop", kind: "shop", label: "Dr.fookah", area: "問屋街", x: 36, y: 30, theme: "shop", glyph: "卸", sub: "機材・フレーバー",
    desc: "卸直営のショップ。フレーバーや機材の売り買いは時間を使わない。2階はショールーム。" },
  { id: "cafe", kind: "spot", label: "カフェ", area: "繁華街", x: 72, y: 54, theme: "cafe", glyph: "珈", sub: "スパイスラテで一息", cost: 800, requiresMet: "naru", stat: "sense", stamina: 12,
    first: "ch1_cafe_visit", pool: ["cafe_herb_tea", "cafe_counter_watch", "cafe_crowd", "cafe_naru_break", "cafe_master_quiz"], bg: "bg_cafe",
    desc: "なるおすすめの喫茶。スパイスラテでひと息つける。" },
  { id: "kannon", kind: "spot", label: "観音堂", area: "古町", x: 12, y: 56, theme: "park", glyph: "観", sub: "静かな境内", requiresMet: "adam", stat: "guts", stamina: 12,
    first: "ch1_kannon_visit", pool: ["kannon_cat", "kannon_sweep", "kannon_adam", "kannon_oldman"], bg: "bg_kannon_day",
    desc: "アダムに教えてもらった静かな場所。頭が空っぽになる。" },
  { id: "choizap", kind: "spot", label: "チョイザップ", area: "ジム", x: 20, y: 36, theme: "gym", glyph: "筋", sub: "体を動かす", requiresMet: "minto", stat: "charm", stamina: -8,
    first: "ch1_choizap_first", pool: ["choizap_lesson", "choizap_mirror", "choizap_oldman", "choizap_minto"], bg: "bg_choizap",
    desc: "みんとに教えてもらったジム。「見た目も武器だよ」とのこと。" },
  { id: "c_station", kind: "spot", label: "C.STATION", area: "大会会場", x: 54, y: 66, theme: "stadium", glyph: "C", sub: "大会会場", cost: 2500, stat: "insight", stamina: -10,
    first: "ch1_c_station_visit", pool: ["cs_staff_greeting", "cs_customer_rumor", "cs_stage_setup", "cs_regular_chat", "cs_nagumo_glimpse", "cs_kemuri_solo", "cs_maezono_taste", "cs_pakki_rehearsal", "cs_prep_line"], bg: "bg_c_station",
    desc: "大会会場になる大型チェーン店。噂や大会情報が集まる。" },
  { id: "rest", kind: "rest", label: "家", area: "自宅", x: 89, y: 52, theme: "rest", glyph: "休", sub: "家に帰る", stamina: 55,
    desc: "1行動使って体を休める。体力が大きく戻る。" },
];
/** 行き先の中の様子（マップ右下のプレビュー）。入ったときの背景と同じ絵を指す */
export const SPOT_PREVIEW = {
  tonari: "bg_tonari_inside", naru: "kemurikusa", adam: "bg_eden_shop", minto: "peppermint",
  shop: "bg_fookah_showroom", cafe: "bg_cafe", kannon: "bg_kannon_day", choizap: "bg_choizap",
  c_station: "bg_c_station", rest: "bg_home",
};
export const spotById = (id) => SPOTS.find((s) => s.id === id);

// ---------------------------------------------------------------- 状態の読み取り

export const storyCount = (id) => state.story[id] || 0;

export function hasNewStory(charId) {
  return storyCount(charId) < (VISIT_SEQ[charId] || []).length;
}

export function isClosed(spot) {
  return spot.closedOn !== undefined && state.day % 7 === spot.closedOn;
}

export function visitedToday(spotId) {
  return state.visitedDay[spotId] === state.day;
}

export function isUnlocked(spot) {
  return !spot.requiresMet || !!state.met[spot.requiresMet];
}

/** マップに出す名前（店主に会う前は店名の看板だけ） */
export function spotLabel(spot) {
  return spot.label;
}

export function hasContact(id) {
  if (state.contacts.includes(id)) return true;
  if (state.flags[`_lime_contact_${id}`] || storyCount(id) >= (LIME_EXCHANGE[id] || 99)) {
    state.contacts.push(id);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- 訪問

const bgRef = (name) => `res://assets/backgrounds/${name}.png`;

/**
 * キャラに会う。固有会話が残っていれば次の1本、尽きたら通い訪問の小会話。
 * 報酬: 固有会話=好感度+10・主要ステ+2 / 通い=好感度+5（ステは小会話側の apply）
 */
export async function visitChar(charId) {
  state.visits[charId] = (state.visits[charId] || 0) + 1;
  const seq = VISIT_SEQ[charId] || [];
  const idx = storyCount(charId);
  const bg = bgRef(VISIT_BG[charId] || "bg_tonari_inside");
  if (idx < seq.length && DB.dialogues[seq[idx]]) {
    state.story[charId] = idx + 1;
    await play(seq[idx], { bg });
    gainAffinity(charId, 10);
    gainStat(CHAR_STAT[charId], 2);
  } else {
    const pool = REPEAT_POOL[charId] || [0, 1, 2, 3].map((i) => `remake_repeat_${charId}_${i}`);
    const n = (state.visits[charId] || 1) - 1;
    const id = pool[n % pool.length];
    await play(id, { bg });
    gainAffinity(charId, 5);
    if (!DB.dialogues[id]?.lines?.some((l) => l.type === "apply")) gainStat(CHAR_STAT[charId], 2);
  }
  markMet(charId);
  hasContact(charId); // 交換済みの判定をこの場で記録
}

export async function visitRival(spot) {
  addMoney(-(spot.cost || 0));
  addStamina(spot.stamina || -16);
  playBgm("tonari");
  await visitChar(spot.charId);
}

/** 施設スポット（一人の時間）。好感度は付かない代わりに、人に会うより伸びが大きい */
export async function visitSpot(spot) {
  if (spot.cost) addMoney(-spot.cost);
  addStamina(spot.stamina || 0);
  state.spotVisits = state.spotVisits || {};
  const n = (state.spotVisits[spot.id] = (state.spotVisits[spot.id] || 0) + 1);
  let id = spot.first;
  if (spot.id === "choizap") {
    id = state.flags._gym_member ? spot.pool[(n - 1) % spot.pool.length] : spot.first;
  } else if (n > 1 && spot.pool) {
    id = spot.pool[(n - 2) % spot.pool.length];
  }
  // お忍び客の回収: tonari で覆面レビュアーを接客していたら、2回目以降の来店で記事の噂を聞く
  if (spot.id === "c_station" && n > 1 && state.notes?.baito_incognito_reviewer && !state.flags._ev_reviewer_payoff && DB.dialogues.ch1_reviewer_payoff) {
    state.flags._ev_reviewer_payoff = true;
    id = "ch1_reviewer_payoff";
  }
  await play(id, { bg: bgRef(spot.bg) }); // bgUrl が昼夜差分（_day/_night）を選ぶ
  gainStat(spot.stat, 3);
}

export async function restAtHome(spot) {
  addStamina(spot.stamina);
  state.flags._home_tonight = state.slot >= 1;
  await play("remake_rest");
}

/** 好感度の段階（♥の数） */
export const hearts = (id) => affinityLevel(id);
