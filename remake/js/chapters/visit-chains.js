// 通いの続きに置く、2〜3回で区切りのつく小さな出来事（#2020 D・2026-11-06 再調査の推奨案）。
// 同じ店に通っても短い会話の巡回に戻るだけだったので、巡回を一通り読んだ後に、後日へ続く出来事を一本ずつ置く。
//   第2章 銭湯: 番台を継ぐ孫の人に出会う → 決まり文句をどう言うか相談される → 自分で座れるようになった日（#3097）
//   第2章 C.STATION 柚ヶ谷店: 一人で席を任された新人に炭の替えどきを聞かれる → 「煙が薄い」の直し方 → 研修中が取れた日（#3097）
//   第2章 水族館: 出口の質問カードに書く → 掲示板に答えが貼られる（#3097）
//   第3章 mukai: 豆腐屋の常連さんの相談を聞く → 常連さんの台で一台を試す → 後日、家で作った報告を聞く
//   第4章 中心地のカフェ→宿→カフェ: ボウルだけ替える頼み方を知る → 宿で二つ目を試す → 店で感想を交わす
//   第4章 スーク: スパイス屋の店主に鼻を貸す → 強すぎた香りの直し方 → カフェの主人の礼（#3097）
//   第4章 龍龍水煙所: 毎日茶だけ飲む客に、明日の茶を選ぶ → その茶を淹れる（#4010）
//   第5章 Smoke & Glory: tonariで作った一台を覚えている客 → スティーブの台で作る → スティーブのカードの余白
//   第5章 路地裏のカフェ: いつもの一台を出してくれる店員に、閉店後の一台を渡す
//   第5章 屋敷の中庭の太陽: 庭番へ渡す旗に日本の一語を書く → 太陽の書いた同じ一語を受け取る → 太陽の旗を作る（#4010）
//   第5章 シェイクの屋敷: 誰の台か伏せて二台を出す → 選んだ客役が手で答える（#4010）
// 先の段で選んだ答え（choice の分岐名）を記録し、後の段の台本が条件 chain_pick で読む。実際の制作の結果など、その場で
// 決まる事実は呼び出し側が facts で渡し、台本は条件 chain_fact で読む（chapters/visit-chain-play.js）。
// 交流の記憶は後の段の台本の remember 行（data/relationship_memories.json）で残し、大会前夜の振り返りに出る。
// ここは DOM を持たない判定と記録だけ。再生・代金・体力・能力は各章（ch2-preparation.js・ch3-tokyo-daily.js・ch4-dubai-daily.js・
// ch5-shops.js・ch5-tokyo.js・ch5-dubai.js・daily/roamers.js）。台詞は data/dialogue/visit_chains.json。周回では持ち越さない。

export const VISIT_CHAINS_FLAG = "_visit_chains";
export const VISIT_CHAINS_FILE = "visit_chains";

const plain = value => !!value && typeof value === "object" && !Array.isArray(value);
const count = value => Math.max(0, Math.floor(Number(value) || 0));
/** 行き先ごとの巡回の回数（各章の小会話の記録をそのまま読む）。 */
const talksRead = (value, flag, key) => count(plain(value?.flags?.[flag]) ? value.flags[flag][key] : 0);

/**
 * id=台本、place=読む行き先（各章の行き先の place／id）、label=行き先の選択肢に出す言葉（選んで読む段だけ）。
 * choice=記録する選択肢の行の id、picks=記録する分岐名。night=夜だけ。free=代金を取らない（客の一台ではない段）。
 */
const stage = fields => Object.freeze({ ...fields, picks: Object.freeze([...(fields.picks || [])]) });

const chapterFiveChain = (id, place, afterTalk) => Object.freeze({
  chapter: 5,
  afterTalk,
  opens: value => value.flags?._ch5?.read?.[afterTalk] === true,
  stages: Object.freeze([1, 2].map(number => stage({ id: `ch5_chain_${id}_${number}`, place }))),
});

/**
 * chapter=その章の日常でだけ読む。opens=最初の段が開く条件（その行き先の巡回を一通り読んだ・顔なじみになった）。
 * 2段目からは、前の段を読んだ日より後（後日）に開く。
 */
export const VISIT_CHAINS = Object.freeze({
  // 第2章の柚ヶ谷（#3097）。銭湯に3回通う（初回＋再訪2回）と開く。段は再訪の会話の代わりに読み、巡回は進めない。
  // 遊び場は昼にも夜にも行けるので時刻に触れず、大会の前後どちらでも成り立つ台本にする（街の人とはじめだけ）。
  ch2_bandai: Object.freeze({
    chapter: 2,
    opens: value => count(value?.flags?._ch2_outing_visits_ch2_sento) >= 3,
    stages: Object.freeze([
      stage({ id: "ch2_chain_bandai_1", place: "ch2_sento", choice: "bandai_first", picks: ["wait", "exact"] }),
      stage({ id: "ch2_chain_bandai_2", place: "ch2_sento", choice: "bandai_word", picks: ["same", "own"] }),
      stage({ id: "ch2_chain_bandai_3", place: "ch2_sento" }),
    ]),
  }),
  // 第2章の柚ヶ谷（#3097）。C.STATION 柚ヶ谷店に3回通うと開く。銭湯と同じく、再訪の会話の代わりに読み、巡回は進めない。
  ch2_newcomer: Object.freeze({
    chapter: 2,
    opens: value => count(value?.flags?._ch2_outing_visits_ch2_c_station) >= 3,
    stages: Object.freeze([
      stage({ id: "ch2_chain_newcomer_1", place: "ch2_c_station", choice: "newcomer_coal", picks: ["yes", "wait"] }),
      stage({ id: "ch2_chain_newcomer_2", place: "ch2_c_station", choice: "newcomer_thin", picks: ["ask", "move"] }),
      stage({ id: "ch2_chain_newcomer_3", place: "ch2_c_station" }),
    ]),
  }),
  // 第2章の柚ヶ谷（#3097）。水族館に3回通うと開く。2段。
  ch2_question: Object.freeze({
    chapter: 2,
    opens: value => count(value?.flags?._ch2_outing_visits_ch2_aquarium) >= 3,
    stages: Object.freeze([
      stage({ id: "ch2_chain_question_1", place: "ch2_aquarium", choice: "question_card", picks: ["sleep", "front"] }),
      stage({ id: "ch2_chain_question_2", place: "ch2_aquarium" }),
    ]),
  }),
  // 第3章の東京（大会前の14日）。mukai で2回働く（手伝い・店番）と、常連さんの顔を覚える。
  // 第3章の東京の日常は大会の朝で終わるので、大会後の分岐は要らない。味が分からない日に読んでも成り立つ台本にする
  // （はじめは味を確かめず、炭・葉・待つ時間と、常連さんの顔で見る）。
  ch3_tofu: Object.freeze({
    chapter: 3,
    opens: value => talksRead(value, "_ch3_outings", "mukai_help") + talksRead(value, "_ch3_outings", "mukai_steve") >= 2,
    stages: Object.freeze([
      stage({ id: "ch3_chain_tofu_1", place: "mukai", label: "常連さんの相談を聞く", choice: "tofu_first", picks: ["coal", "leaf", "wait"] }),
      stage({ id: "ch3_chain_tofu_2", place: "mukai", label: "常連さんの台を見る", choice: "tofu_hands", picks: ["own", "watch"] }),
      stage({ id: "ch3_chain_tofu_3", place: "mukai", label: "常連さんの報告を聞く" }),
    ]),
  }),
  // 第4章のドバイ（DAY1〜12）。中心地のカフェの再訪の会話を3本（ホースの渡し方の回まで）読むと開く。
  // 宿の段は、道具の手入れ・試作の講評・前日リハーサルが先（ch4-dubai-daily.js）。
  ch4_second_bowl: Object.freeze({
    chapter: 4,
    opens: value => talksRead(value, "_ch4_dubai_talks", "center_cafe") >= 3,
    stages: Object.freeze([
      stage({ id: "ch4_chain_bowl_1", place: "center_cafe" }),
      stage({ id: "ch4_chain_bowl_2", place: "inn", label: "二つ目のボウルを試す", choice: "bowl_second", picks: ["same", "follow", "light"] }),
      stage({ id: "ch4_chain_bowl_3", place: "center_cafe" }),
    ]),
  }),
  // 第4章のドバイ（#3097）。スークの再訪の会話を3本読むと開く（乾燥レモンの割り方の回まで）。再訪の会話の代わりに読み、巡回は進めない。
  // 代金・体力・屋台・能力はいつものスークと同じ（ch4-dubai-daily.js）。
  ch4_spice_blend: Object.freeze({
    chapter: 4,
    opens: value => talksRead(value, "_ch4_dubai_talks", "souq") >= 3,
    stages: Object.freeze([
      stage({ id: "ch4_chain_spice_1", place: "souq", choice: "spice_pick", picks: ["cardamom", "lemon"] }),
      stage({ id: "ch4_chain_spice_2", place: "souq", choice: "spice_fix", picks: ["less", "coarse"] }),
      stage({ id: "ch4_chain_spice_3", place: "souq" }),
    ]),
  }),
  // 第4章のドバイ（#4010）。龍龍水煙所（王煙楼の店）の小会話を3本読むと開く（段階の会話・締めくくりが読める来店はそちらが先。
  // ch4-dubai-daily.js）。毎日茶だけ飲む本店の街の客に、はじめが明日の茶を選ぶ → 後日、その茶を淹れる。
  ch4_longlong_tea: Object.freeze({
    chapter: 4,
    opens: value => count(plain(value?.flags?._ch4_longlong) ? value.flags._ch4_longlong.talks : 0) >= 3,
    stages: Object.freeze([
      stage({ id: "ch4_chain_tea_1", place: "longlong", choice: "tea_pick", picks: ["home", "here"] }),
      stage({ id: "ch4_chain_tea_2", place: "longlong" }),
    ]),
  }),
  // 第5章の東京。Smoke & Glory の小会話を一通り読むと開く（♥5の締めくくりの来店はそちらが先）。
  ch5_steve_guest: Object.freeze({
    chapter: 5,
    opens: value => talksRead(value, "_ch5_tokyo_talks", "ch5_tokyo_steve") >= 3,
    stages: Object.freeze([
      stage({ id: "ch5_chain_guest_1", place: "ch5_tokyo_steve", choice: "guest_plan", picks: ["same", "now", "listen"] }),
      stage({ id: "ch5_chain_guest_2", place: "ch5_tokyo_steve", choice: "guest_timer", picks: ["timer", "face"] }),
      stage({ id: "ch5_chain_guest_3", place: "ch5_tokyo_steve" }),
    ]),
  }),
  // 第5章のドバイ。路地裏のカフェの小会話を一通り読むと開く。閉店後の段は夜だけで、客の一台ではないので代金を取らない。
  ch5_alley_gift: Object.freeze({
    chapter: 5,
    opens: value => talksRead(value, "_ch5_dubai_talks", "ch5_dubai_alley") >= 3,
    stages: Object.freeze([
      stage({ id: "ch5_chain_gift_1", place: "ch5_dubai_alley", choice: "gift_plan", picks: ["tonari", "house", "light"] }),
      stage({ id: "ch5_chain_gift_2", place: "ch5_dubai_alley", night: true, free: true }),
    ]),
  }),
  // 第5章のドバイ（#4010）。中庭の太陽の小会話を一通り読むと開く。段階の会話・締めくくりが読める来店は、そちらが先（ch5-dubai.js）。
  // 太陽に頼まれて、屋敷の庭番へ渡す旗に日本の一語を書く → 後日、旗の行き先を見て、太陽の書いた同じ一語を受け取る
  // → 配り終えた太陽の分だけ無い旗を、はじめが作る。
  ch5_taiyo_flag: Object.freeze({
    chapter: 5,
    opens: value => talksRead(value, "_ch5_dubai_talks", "ch5_dubai_taiyo") >= 3,
    stages: Object.freeze([
      stage({ id: "ch5_chain_flag_1", place: "ch5_dubai_taiyo", choice: "flag_word", picks: ["otsukare", "mata", "arigato"] }),
      stage({ id: "ch5_chain_flag_2", place: "ch5_dubai_taiyo" }),
      // 3段目（#4010）: 配り終えた太陽の分だけ無い旗を、はじめが作る（1段目と同じ一語）
      stage({ id: "ch5_chain_flag_3", place: "ch5_dubai_taiyo" }),
    ]),
  }),
  // 第5章のドバイ（#4010・#4016）。シェイクの屋敷の小会話を一通り読むと開く。段階の会話・締めくくりが読める来店は、そちらが先。
  // どちらが誰の台か伏せて二台を出し、選んだ客役（コーヒーの係／炭場の年配の人）が手で答える。
  ch5_sheikh_pair: Object.freeze({
    chapter: 5,
    opens: value => talksRead(value, "_ch5_dubai_talks", "ch5_dubai_sheikh") >= 3,
    stages: Object.freeze([
      stage({ id: "ch5_chain_pair_1", place: "ch5_dubai_sheikh", choice: "pair_taster", picks: ["coffee", "coal"] }),
      stage({ id: "ch5_chain_pair_2", place: "ch5_dubai_sheikh" }),
    ]),
  }),
  // 追加の小会話を実際に読んでから開く。旧セーブの巡回回数だけでは開かない。
  ch5_naru_towel: chapterFiveChain("naru_towel", "naru", "ch5_naru_shop_h"),
  ch5_minto_paper: chapterFiveChain("minto_paper", "minto", "ch5_minto_shop_h"),
  ch5_rio_tag: chapterFiveChain("rio_tag", "ch5_rio_showroom", "ch5_rio_shop_h"),
  ch5_samechan_tail: chapterFiveChain("samechan_tail", "shishark", "ch5_samechan_shop_h"),
  ch5_ageha_straw: chapterFiveChain("ageha_straw", "ch2_ageha", "ch5_ageha_shop_h"),
  ch5_saku_window: chapterFiveChain("saku_window", "ch5_tokyo_saku", "ch5_tokyo_saku_h"),
  ch5_volk_menu: chapterFiveChain("volk_menu", "ch5_tokyo_volk", "ch5_tokyo_volk_h"),
  ch5_adam_lid: chapterFiveChain("adam_lid", "adam", "ch5_adam_repeat_h"),
  ch5_kumicho_stone: chapterFiveChain("kumicho_stone", "ch2_kumicho", "ch5_kumicho_repeat_h"),
  ch5_rei_silence: chapterFiveChain("rei_silence", "ch2_rei", "ch5_rei_repeat_h"),
  ch5_sumi_seat: chapterFiveChain("sumi_seat", "ch5_tonari_sumi", "ch5_tonari_sumi_h"),
  ch5_tsumugi_plate: chapterFiveChain("tsumugi_plate", "ch5_tonari_tsumugi", "ch5_tonari_tsumugi_h"),
  ch5_hiyori_bag: chapterFiveChain("hiyori_bag", "ch5_roam_hiyori", "roam_hiyori_h"),
  ch5_mashiro_handle: chapterFiveChain("mashiro_handle", "ch5_tokyo_mashiro", "ch5_tokyo_mashiro_h"),
  ch5_noor_photo: chapterFiveChain("noor_photo", "ch5_dubai_noor_desk", "ch5_noor_cafe_chat_h"),
  ch5_wang_dish: chapterFiveChain("wang_dish", "ch5_tonari_master_hookah", "ch5_tonari_master_hookah_h"),
});

const OPENING_TALKS = new Set(Object.values(VISIT_CHAINS).map(chain => chain.afterTalk).filter(Boolean));
/** 読了を確定した入口だけが、既存の第5章の既読欄に記録する。 */
export function recordChapterFiveTalk(value, id) {
  const read = value?.flags?._ch5?.read;
  if (value?.chapter === 5 && plain(read) && OPENING_TALKS.has(id)) read[id] = true;
}

/** 全部の段の台本 id（data/dialogue/visit_chains.json）。 */
export const VISIT_CHAIN_DIALOGUE_IDS = Object.freeze(Object.values(VISIT_CHAINS).flatMap(chain => chain.stages.map(entry => entry.id)));

const chainOfStage = stageId => Object.entries(VISIT_CHAINS).find(([, chain]) => chain.stages.some(entry => entry.id === stageId)) || null;

/** 保存の記録 { done: 読み終えた段の数, day: 最後に読んだ通算日, picks: { 段の id: 分岐名 } }。壊れた値は未着手として読む。 */
export function chainRecord(value, chainId) {
  const chain = VISIT_CHAINS[chainId];
  const raw = plain(value?.flags?.[VISIT_CHAINS_FLAG]) && plain(value.flags[VISIT_CHAINS_FLAG][chainId]) ? value.flags[VISIT_CHAINS_FLAG][chainId] : {};
  const done = chain ? Math.min(count(raw.done), chain.stages.length) : 0;
  const day = Number.isInteger(raw.day) ? raw.day : null;
  const picks = {};
  if (chain && plain(raw.picks)) {
    for (const entry of chain.stages) {
      const pick = raw.picks[entry.id];
      if (entry.picks.includes(pick)) picks[entry.id] = pick;
    }
  }
  return { done, day, picks };
}

export const chainFinished = (value, chainId) => !!VISIT_CHAINS[chainId] && chainRecord(value, chainId).done >= VISIT_CHAINS[chainId].stages.length;

/** 今読める段（無ければ null）。読取のみで保存を変えない。 */
export function nextChainStage(value, chainId) {
  const chain = VISIT_CHAINS[chainId];
  if (!chain || value?.chapter !== chain.chapter) return null;
  const progress = value.flags?._ch5;
  if (chain.chapter === 5 && (value.flags?._ch5_match_scheduled || (progress && progress.part !== "free"))) return null;
  const record = chainRecord(value, chainId);
  const next = chain.stages[record.done];
  if (!next) return null;
  if (record.done === 0 ? !chain.opens(value) : !(Number.isInteger(value.day) && record.day !== null && value.day > record.day)) return null;
  if (next.night && !(value.slot >= 1)) return null;
  return next;
}

/** この行き先で今読める段 { id: 連なりの id, stage }。無ければ null。 */
export function chainStageAt(value, place) {
  for (const chainId of Object.keys(VISIT_CHAINS)) {
    const next = nextChainStage(value, chainId);
    if (next?.place === place) return { id: chainId, stage: next };
  }
  return null;
}

/**
 * 段を読み終えた時だけ呼ぶ。次に読むはずの段だけを一度だけ記録する（再読・順番違い・知らない段は false で何も変えない）。
 * pick は選んだ分岐名（その段の picks にあるものだけ残す）。
 */
export function recordChainStage(value, chainId, stageId, pick = null) {
  const chain = VISIT_CHAINS[chainId];
  if (!chain || !plain(value?.flags)) return false;
  const record = chainRecord(value, chainId);
  const expected = chain.stages[record.done];
  if (!expected || expected.id !== stageId) return false;
  const picks = { ...record.picks };
  if (expected.picks.includes(pick)) picks[stageId] = pick;
  const all = plain(value.flags[VISIT_CHAINS_FLAG]) ? value.flags[VISIT_CHAINS_FLAG] : {};
  value.flags[VISIT_CHAINS_FLAG] = { ...all, [chainId]: { done: record.done + 1, day: Number.isInteger(value.day) ? value.day : null, picks } };
  return true;
}

/**
 * 台本の条件（vn/engine.js の hooks.evalCondition から）。知らない型は undefined。
 *   chain_pick: { scene: 段の id, pick: 分岐名 } その段で選んだ答えか（読んでいる最中の段は pending を先に見る）
 *   chain_fact: { fact, value } 呼び出し側が渡した事実（facts）がその値か
 */
export function chainCondition(value, line, { pending = {}, facts = {} } = {}) {
  if (line?.condition_type === "chain_pick") {
    if (typeof line.scene !== "string" || typeof line.pick !== "string") return false;
    if (Object.hasOwn(pending, line.scene)) return pending[line.scene] === line.pick;
    const found = chainOfStage(line.scene);
    return !!found && chainRecord(value, found[0]).picks[line.scene] === line.pick;
  }
  if (line?.condition_type === "chain_fact") return typeof line.fact === "string" && Object.hasOwn(facts, line.fact) && facts[line.fact] === line.value;
  return undefined;
}
