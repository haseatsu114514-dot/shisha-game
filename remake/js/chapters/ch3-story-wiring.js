// 第3章の任意場面と大会前夜を、data/story_routes.json の選択関数（core/story-routes.js）へつなぐ
// DOMを持たないアダプタ（#1176 GAP 3-B）。再生・保存・UIは ch3.js が担う。
import { canReadOptionalStory, selectStoryEvening } from "../core/story-routes.js";
import { characterRegion, dueTokyoVisit, visitContacts } from "../core/tokyo-visits.js";
import { chapterThreeScenes, chapterThreeProgress } from "./ch3-progress.js";
import { confessionLanded } from "./ch3-romance-entry.js";

/**
 * 仮置き（Q未決）: 渡航予定を持たず、第3章のあいだ東京にいる人物。面識（state.met）があれば前夜の present に加える。
 * steve=東京在住のライバル（near_conflict の茶化し役）、mashiro=mukaiの店員でただ一人の東京在住ヒロイン。
 * 差し替え・削除はこの定数だけ。
 */
export const TOKYO_RESIDENT_IDS = Object.freeze(["steve", "mashiro"]);

/** 前夜の自由時間ウィンドウ（tokyo-clock.js）。訪問デートと前夜デートはここで一本化する。 */
export const EVENING_WINDOW = "d13-night";
export const optionalReadFlag = id => `_ch3_read_${id}`;

// 任意場面の置き場。file=台詞ファイル、after=この必須/既読場面を読み終えてから、met=面識がある人物だけ。
// afterとmetは story_routes.json の optional_requirements に足す、この章のカード上の置き方（台本は変えない）。
// away=その人物が東京に来ている間は出さない（遠くからの連絡の場面）。
// unsettled=その人物との関係が告白の返事でまだ着地していない間だけ出す（恋人・友達のままなら出さない）。
export const CH3_OPTIONAL_SCENES = Object.freeze({
  ch3_minto_small_lies: { file: "ch3_double_apple", label: "みんとからの夜の通話", location: "mukaiの裏口", bg: "bg_street_night" },
  // ましろの名乗りはむかい到着の場面。到着前に、彼女の出る噂話を置かない。
  ch3_cigarman_rumor: { file: "ch3_mukai", label: "客席の噂話", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mukai_arrival"] },
  // 台本が「大会後」。大会後のmukaiは ch3-aftermath.js 側の面で、今のカードからは出ない（GAP 3-C）。
  ch3_cigarman_trace: { file: "ch3_mukai", label: "大会後の客席", location: "mukai", bg: "bg_mukai_shop" },
  // エミルは大会当日に初めて名乗る審査員。面識ができる前に体験会を置かない。
  ch3_emil_workshop: { file: "ch3_rivals", label: "エミルの体験会", location: "東京", bg: "bg_street_day", met: ["emil"] },
  ch3_mashiro_play_1: { file: "ch3_mashiro", label: "休みの日の配合メモ", location: "mukai", bg: "bg_mukai_shop" },
  ch3_mashiro_play_2: { file: "ch3_mashiro", label: "問屋のティーカップ", location: "東京の問屋", bg: "bg_street_day" },
  ch3_mashiro_play_3: { file: "ch3_mashiro", label: "休憩中の約束", location: "mukai", bg: "bg_mukai_shop" },
  // 台本が「東京のシーシャ店で感じた差」を受けている。違う店の手つきを見た後に置く。
  ch3_mashiro_practice: { file: "ch3_mashiro", label: "閉店後の練習", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_tokyo_shop_gap"] },
  // 久世とましろの過去。ましろ側はレモンケーキの客を見た煙幕の初訪問後、久世側はmukaiへ客として来た後。
  ch3_kuze_mashiro_tea_tin: { file: "ch3_kuze_mashiro", label: "茶缶の半分", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_kuze_first"] },
  ch3_kuze_mashiro_soon_back: { file: "ch3_kuze_mashiro", label: "すぐ戻るの嘘", location: "煙幕", bg: "bg_yohaku_shop",
    after: ["ch3_kuze_mukai_visit"] },
  // ひよりルートの tokyo_contact（#1434 決定B）。route.events と同じ条件に、mukai到着後・東京滞在中でないことを足す。
  // ましろの告白（#1930 仮置き）。任意4場面を読み終えた後の休日に、彼女の部屋で。返事が交際／友人の着地になる。
  confession_mashiro: { file: "confession", label: "ましろちゃんの部屋でお茶", location: "ましろの部屋", bg: "bg_home_day",
    after: ["ch3_mashiro_play_3", "ch3_mashiro_practice"], unsettled: ["mashiro"] },
  hiyori_tokyo_contact: { file: "hiyori", label: "ひよりからの夜の通話", location: "閉店後のmukaiの前", bg: "bg_street_night",
    after: ["ch3_mukai_arrival"], met: ["hiyori"], away: ["hiyori"] },
});

// loadIntroDialogues が読む追加分（ファイル→場面ID）。routes の全任意場面・前夜場面と一致させる（story_routes.mjs で照合）。
export const CH3_STORY_DIALOGUE_FILES = Object.freeze({
  ch3_double_apple: ["ch3_minto_small_lies"],
  ch3_mukai: ["ch3_cigarman_rumor", "ch3_cigarman_trace"],
  ch3_rivals: ["ch3_emil_workshop"],
  ch3_mashiro: ["ch3_mashiro_play_1", "ch3_mashiro_play_2", "ch3_mashiro_play_3", "ch3_mashiro_practice"],
  ch3_kuze_mashiro: ["ch3_kuze_mashiro_tea_tin", "ch3_kuze_mashiro_soon_back"],
  hiyori: ["hiyori_tokyo_contact"],
  // 返事の場面は告白の選択肢の next_id で入る（ch3_read_confession_mashiro は返事まで読んだ時だけ立つ）。
  confession: ["confession_mashiro", "confession_mashiro_accept", "confession_mashiro_reject"],
  // 第3章で再生しうるのは date_min_chapter が3以下の恋人だけ（あげはは第4章から）。
  tournament_dates: ["tournament_date_tsumugi", "tournament_date_minto", "tournament_date_rin",
    "tournament_date_mashiro", "tournament_date_samechan", "tournament_date_hiyori"],
  relationship_conflicts: ["ch3_shuraba_open", "ch3_shuraba_tsumugi", "ch3_shuraba_minto", "ch3_shuraba_rin",
    "ch3_shuraba_mashiro", "ch3_shuraba_samechan", "ch3_shuraba_hiyori", "ch3_shuraba_steve", "tournament_evening_overlap"],
});

let routesTask = null;
/** 正本 data/story_routes.json。読み込みに失敗したら次回また取りに行く。 */
export function loadStoryRoutes() {
  routesTask ||= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("../data/story_routes.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`story_routes: HTTP ${response.status}`);
      const routes = await response.json();
      if (!Array.isArray(routes.heroine_ids) || !Array.isArray(routes.chapters?.["3"]?.optional)
        || !routes.romance || !routes.near_conflict) throw new Error("story_routes: 形式を確認してください");
      return routes;
    } finally { clearTimeout(timer); }
  })().catch(error => { routesTask = null; throw error; });
  return routesTask;
}

/**
 * canReadOptionalStory に渡す「読み終えた場面」。実際の記録だけから組み立て、好感度や所在からは作らない。
 * - 必須場面: stage より前（章の進行が正本）。
 * - confession_minto: 返事の場面 accept が lovers へ、reject が _friend_minto へだけ書く（daily/romance.js）。
 * - ch3_national_result: 読了後に大会ランナーが立てる _ch3_tournament_won。
 * - hiyori_work_talk: ひよりルートの読了フラグ _hiyori_work_talk_done（第1〜2章で読む仕事の相談）。
 */
export function chapterThreeCompletedScenes(value) {
  const done = new Set(chapterThreeScenes(value).slice(0, chapterThreeProgress(value).stage).map(scene => scene.id));
  const flags = value.flags || {};
  if (flags._ch3_registration_read) done.add("ch3_registration");
  if (flags._ch3_tournament_won) done.add("ch3_national_result");
  if ((value.lovers || []).includes("minto") || flags._friend_minto) done.add("confession_minto");
  if (flags._hiyori_work_talk_done) done.add("hiyori_work_talk");
  for (const id of Object.keys(CH3_OPTIONAL_SCENES)) if (flags[optionalReadFlag(id)]) done.add(id);
  return [...done];
}

/** いま読める未読の任意場面（routesの並び順）。 */
export function availableOptionalScenes(routes, value) {
  if (value?.chapter !== 3 || !value.flags?._ch3_intro) return [];
  const completedScenes = chapterThreeCompletedScenes(value);
  return routes.chapters["3"].optional.filter(id => {
    const place = CH3_OPTIONAL_SCENES[id];
    return place && !value.flags[optionalReadFlag(id)]
      && canReadOptionalStory(routes, value, id, { completedScenes })
      && (place.after || []).every(scene => completedScenes.includes(scene))
      && (place.met || []).every(who => value.met?.[who])
      && (place.away || []).every(who => characterRegion(value, { characters: {} }, who) !== "tokyo")
      && (place.unsettled || []).every(who => !confessionLanded(value, who));
  }).map(id => ({ id, ...CH3_OPTIONAL_SCENES[id] }));
}

/**
 * 任意場面の読了を確定する。
 * 仮置き（Q未決）: 任意場面は自由時間ウィンドウ・日付・時間帯を消費しない。必須進行（stage/day/slot）と
 * 訪問の約束には触れず、既読だけを残す。消費させる方針に変わったら、差し替えるのはこの関数だけ。
 */
export function commitOptionalRead(value, id) {
  value.flags[optionalReadFlag(id)] = true;
}

/**
 * 前夜の context（location_contract 準拠）。渡航予定・好感度だけから恋人や到着を作らない。
 * - present: 前夜の時点で実際に東京へ到着・滞在中のヒロイン（characterRegion）。
 *   仮置き: 東京在住のスティーブとましろは、面識があれば加える（TOKYO_RESIDENT_IDS）。
 * - selected/accepted: 前夜のウィンドウに会う約束が成立している恋人（tokyo-visits の plan）。前夜は一人だけ。
 * - unresolved: 第3章は常に空。本格的な修羅場はエンディング後（deferred は _ch3_evening に別記録）。
 */
export function chapterThreeEveningContext(value, definitions, window) {
  const present = Object.keys(definitions.characters).filter(id => characterRegion(value, definitions, id) === "tokyo");
  for (const id of TOKYO_RESIDENT_IDS) if (value.met?.[id] && !present.includes(id)) present.push(id);
  const plan = window ? dueTokyoVisit(value, window) : null;
  const selected = plan?.met && plan.date.id === EVENING_WINDOW && plan.date.id === window.id
    && visitContacts(value, definitions).includes(plan.characterId) ? plan.characterId : null;
  return { present, selected, accepted: selected ? [selected] : [], unresolved: [] };
}

export function selectChapterThreeEvening(routes, value, definitions, window = null) {
  return selectStoryEvening(routes, value, chapterThreeEveningContext(value, definitions, window));
}

/**
 * 前夜の解決記録（保存用）。deferred は near_conflict で茶化して保留にした恋人で、
 * エンディング後の本格的な修羅場が使う _story_shuraba_unresolved とは別の記録として残す。
 */
export const eveningRecord = result => ({ kind: result.kind, participants: [...result.participants],
  deferred: [...(result.deferred || [])] });
