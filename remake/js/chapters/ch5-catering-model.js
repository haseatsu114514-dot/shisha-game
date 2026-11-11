// 第5章の出張シーシャの依頼（DLV・2026-11-07 司令塔／ミューズの仮判断「A. 出張シーシャの依頼」。オーナーが後から変えられる）。
// 状態を読む・記録するだけの純粋な決まり（LIME・地図・場面は chapters/ch5-catering.js）。単体で読めるよう import しない。
//
// 流れ: 第5章の自由行動の日（博士との勝負の日が決まる前）に、数日おきに tonari の店のLIMEへ出張の頼みが来て、スミさんが
//   はじめへ回す（送り主はスミさん。依頼主は名前の無い客）。同時に来る依頼は一つだけ。返事は「引き受けます／今回は見送ります」。
//   引き受けると、翌日から JOB_DAYS 日のうちに、地元の地図の「出張シーシャ」から向かえる（昼の会・夜の会は時間帯が決まっている）。
//   現地では客の様子を見て、依頼の条件に合う葉の組み合わせを三つから一つ選ぶ（第3章の mukai・tonari の「今日の注文」の二択を広げた形）。
// 報酬: お金ではなく、限定台くじのくじ券（渡すのは ch5-catering.js）。ぴったり＝2枚・合う＝1枚・外した＝0枚（外しても叱られない）。
//   行動は1回・体力は mukai のシフトと同じ。経験値は普通の行動と同じ（体力を使った行動の経験値と、初めての場所。日常ループが付ける）。
//   火種・心得の盤・大会・エンディング・進行の条件にはつながない（#2455）。周回では依頼の記録を持ち越さない（core/carry.js）。
//
// 保存（flags._ch5_catering）:
//   next   : 次の依頼が届く日（通算日。この日の朝から）。無い保存は第5章の FIRST_REQUEST_DAY 日目
//   offers : 届いた依頼の数（依頼の巡回の順に使う）
//   offer  : 今の依頼 { id, msg, day, accepted, until } か null。accepted＝引き受けた日（未返事は null）、until＝返事か作りに行ける最後の日
//   served : 作りに行った回数（依頼ごと）
//   last   : 最後に作りに行った結果 { id, day, fit, tickets }（確認用）

export const CATERING_FLAG = "_ch5_catering";
export const CATERING_SPOT_ID = "ch5_catering";
/** 最初の依頼が届く、第5章の日（startDay を1日目として数える）。 */
export const FIRST_REQUEST_DAY = 3;
/** 依頼が片付いた日（作った・断った・期限が過ぎた）から、次の依頼が届くまでの日数。 */
export const REQUEST_GAP_DAYS = 3;
/** 返事ができる日数（届いた日とその翌日）。 */
export const REPLY_DAYS = 2;
/** 引き受けた翌日から、作りに行ける日数。 */
export const JOB_DAYS = 3;
/** 体力（mukai のシフトと同じ）。 */
export const CATERING_STAMINA = -14;
/** くじ券の枚数。ぴったり／合う／外した。 */
export const CATERING_TICKETS = Object.freeze({ best: 2, ok: 1, off: 0 });
/** 地元の地図のピンの位置（左下の境内の手前。ほかの行き先・占い師の出る場所・右下の案内の枠と重ならない）。 */
export const CATERING_PIN = Object.freeze({ x: 22, y: 86 });

const option = (label, mix, fit) => Object.freeze({ label, mix: Object.freeze(mix), fit });
const request = fields => Object.freeze({ ...fields, conditions: Object.freeze(fields.conditions), options: Object.freeze(fields.options),
  lime: Object.freeze(fields.lime) });

/**
 * 依頼の一覧。slot は 0＝昼の会・1＝夜の会。bg は既存の背景の仮置き（専用の背景は未制作）。
 * conditions は現地で葉を選ぶときの手がかり（依頼の文面と客の様子から）。options は ぴったり（best）・合う（ok）・外した（off）が一つずつ。
 * lime はスミさんのLIMEの本文（最初の一行「店のLIMEに……」は ch5-catering.js が付ける）。台詞は data/dialogue/ch5_catering.json。
 */
export const CATERING_REQUESTS = Object.freeze([
  request({ id: "wedding_party", title: "結婚式の二次会", client: "二次会の幹事", place: "駅前のレストラン", slot: 1, bg: "bg_cafe",
    lime: ["結婚式の二次会の幹事からだ。駅前のレストランを、夜に貸し切るらしい", "新婦はミントがだめで、甘いのが苦手な客も多いってよ"],
    conditions: ["ミントは抜き（新婦さんが苦手）", "甘すぎない方がいい", "初めて吸う人が半分"],
    options: [
      option("グレープフルーツ＋レモン", { grapefruit: 8, lemon: 4 }, "ok"),
      option("ブラックティー＋オレンジ", { black_tea: 8, orange: 4 }, "best"),
      option("レモン＋ミント", { lemon: 9, mint: 3 }, "off"),
    ] }),
  request({ id: "office_wrapup", title: "会社の打ち上げ", client: "設計事務所の人", place: "駅裏のレンタルラウンジ", slot: 1, bg: "bg_hideaway",
    lime: ["駅裏のラウンジで、設計事務所の打ち上げだ。夜の会な", "甘い派とさっぱり派で、割れてるらしい"],
    conditions: ["甘い派とさっぱり派が半々", "仕事明けで、頭をすっきりさせたい", "苦いのは苦手な人が多い"],
    options: [
      option("エスプレッソ＋ダークチョコ", { espresso: 8, dark_chocolate: 4 }, "off"),
      option("ピーチ＋ミント", { peach: 9, mint: 3 }, "best"),
      option("レモン＋ミント", { lemon: 9, mint: 3 }, "ok"),
    ] }),
  request({ id: "birthday_home", title: "誕生日の家飲み", client: "主役の友だち", place: "友だちの部屋", slot: 1, bg: "bg_home",
    lime: ["友だちの部屋で、誕生日の家飲みをやるそうだ。夜の会な", "主役はストロベリーが好きだと。ケーキのあとに吸うらしい"],
    conditions: ["主役はストロベリーが好き", "ケーキを食べたあとに吸う", "部屋に香りが残りすぎないもの"],
    options: [
      option("ストロベリー＋バニラ", { strawberry: 8, vanilla: 4 }, "ok"),
      option("シナモン＋クローブ", { cinnamon: 8, clove: 4 }, "off"),
      option("ストロベリー＋レモン", { strawberry: 9, lemon: 3 }, "best"),
    ] }),
  request({ id: "housewarming", title: "引っ越し祝い", client: "新居に越した夫婦", place: "新しい部屋のベランダ", slot: 0, bg: "bg_home",
    lime: ["引っ越し祝いだ。新しい部屋のベランダで、昼の会な", "親父さんが、混ぜすぎた味は苦手らしい。葉は三種までだと"],
    conditions: ["お祝いに来る両親は、甘い香りが好き", "外で吸うので、香りが風に飛びやすい", "混ぜる葉は三種まで（お父さんの頼み）"],
    options: [
      option("マンゴー＋パッションフルーツ", { mango: 8, passion_fruit: 4 }, "best"),
      option("マンゴー＋ピーチ＋バニラ＋ココナッツ", { mango: 4, peach: 3, vanilla: 3, coconut: 2 }, "off"),
      option("ジャスミン＋ピーチ", { jasmine: 8, peach: 4 }, "ok"),
    ] }),
  request({ id: "festival_rest", title: "町内のお祭り", client: "町内会の世話役", place: "観音堂の境内", slot: 0, bg: "bg_kannon",
    lime: ["町内会からだ。観音堂のお祭りの休憩所に、昼だけ台を出してほしいと", "年配の客が多い。ミントは喉に来るって声があったそうだ"],
    conditions: ["年配の人が多く、昔ながらの味が好き", "一口ずつ回すので、最初の一口で分かる味", "ミントは入れない（喉に来るという声）"],
    options: [
      option("ダブルアップル＋ミント", { double_apple: 10, mint: 2 }, "off"),
      option("ダブルアップル＋オレンジ", { double_apple: 9, orange: 3 }, "ok"),
      option("ダブルアップル単体", { double_apple: 12 }, "best"),
    ] }),
  request({ id: "shotengai_cleanup", title: "商店街の大掃除", client: "商店街の青年部の人", place: "商店街の路地", slot: 0, bg: "bg_street",
    lime: ["商店街の青年部からだ。大掃除のあと、路地で一服したいと。昼の会な", "店の連中だ。甘いのが好きなのも混ざってる"],
    conditions: ["大掃除のあと。みんな、すっきりしたい", "甘いのが好きな人も混ざっている", "通りは風があって、香りが飛びやすい"],
    options: [
      option("レモン＋ミント", { lemon: 9, mint: 3 }, "ok"),
      option("スイカ＋ミント", { watermelon: 9, mint: 3 }, "best"),
      option("ラベンダー＋カモミール", { lavender: 8, chamomile: 4 }, "off"),
    ] }),
  request({ id: "retirement", title: "定年のお祝い", client: "定年を迎える人の娘さん", place: "駅向こうの喫茶店", slot: 0, bg: "bg_cafe",
    lime: ["定年のお祝いだ。娘さんが、駅向こうの喫茶店を昼だけ借りたらしい", "親父さんはコーヒー好きで、家族はみんな初めてだと"],
    conditions: ["お父さんは、ずっとコーヒー好き", "家族はみんな、シーシャが初めて", "重すぎない一台"],
    options: [
      option("カプチーノ＋ヘーゼルナッツ", { cappuccino: 8, hazelnut: 4 }, "best"),
      option("ブルーベリー＋ミント", { blueberry: 9, mint: 3 }, "off"),
      option("コーヒー＋ダークチョコ", { coffee: 8, dark_chocolate: 4 }, "ok"),
    ] }),
  request({ id: "stargazing", title: "流れ星を見る会", client: "天文サークルの大学生", place: "観音堂の裏の高台", slot: 1, bg: "bg_kannon",
    lime: ["大学の天文サークルからだ。観音堂の裏の高台で、流れ星を見る夜の会な", "解説役が一晩しゃべり通しだから、喉にきついのは困るってよ"],
    conditions: ["流れ星を待って、明け方まで長く回す", "眠気をごまかせる、すっとする味がほしい", "解説役の先輩はしゃべり通し。喉にきついのは困る"],
    options: [
      option("レモンティー＋ハニー", { lemon_tea: 8, honey: 4 }, "ok"),
      option("デスバイアイス＋クールミント", { death_by_ice: 8, cool_mint: 4 }, "off"),
      option("グレープ＋ミント", { grape: 9, mint: 3 }, "best"),
    ] }),
]);

export const cateringRequestById = id => CATERING_REQUESTS.find(entry => entry.id === id) || null;
/** 場面の台本ID（導入・結果）。 */
export const cateringSceneId = (id, part) => `ch5_catering_${id}_${part}`;
/** スミさんの締めの台本ID（結果ごとに2本を巡回）。 */
export const cateringCloseId = (fit, index) => `ch5_catering_close_${fit}_${["a", "b"][index % 2]}`;
export const CATERING_SCENE_IDS = Object.freeze([
  ...CATERING_REQUESTS.flatMap(entry => ["intro", "best", "ok", "off"].map(part => cateringSceneId(entry.id, part))),
  ...["best", "ok", "off"].flatMap(fit => [0, 1].map(index => cateringCloseId(fit, index))),
]);

const integer = value => Number.isInteger(value);
const startDay = value => integer(value?.flags?._ch5?.startDay) ? value.flags._ch5.startDay : value?.day ?? 1;
const awayFromHome = value => ["tokyo", "dubai"].includes(value?.flags?._ch2_region);

/** 依頼の記録（無い・壊れた保存は空の記録として読む。書き換えない）。 */
export function cateringState(value) {
  const raw = value?.flags?.[CATERING_FLAG];
  const plain = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const offer = plain.offer && typeof plain.offer === "object" && cateringRequestById(plain.offer.id)
    && integer(plain.offer.day) && integer(plain.offer.until)
    ? { ...plain.offer, accepted: integer(plain.offer.accepted) ? plain.offer.accepted : null } : null;
  return {
    next: integer(plain.next) ? plain.next : startDay(value) + FIRST_REQUEST_DAY - 1,
    offers: integer(plain.offers) && plain.offers >= 0 ? plain.offers : 0,
    offer,
    served: plain.served && typeof plain.served === "object" && !Array.isArray(plain.served) ? plain.served : {},
    last: plain.last ?? null,
  };
}
const store = (value, record) => { value.flags[CATERING_FLAG] = record; return record; };

/** 依頼が動く時期か: 第5章の自由行動（勝負の日が決まる前）だけ。 */
export function cateringSeason(value) {
  const progress = value?.flags?._ch5;
  return value?.chapter === 5 && progress?.part === "free" && !integer(progress.matchDay);
}

/** 返事を待っている依頼（届いて未返事）。 */
export const cateringWaiting = value => { const { offer } = cateringState(value); return offer && offer.accepted === null ? offer : null; };

/**
 * 期限の過ぎた依頼を片付ける（毎朝。日付は朝にしか進まない）。
 * 戻り値: 片付けた依頼 { id, msg, accepted }（無ければ null）。次の依頼は期限の最後の日から REQUEST_GAP_DAYS 日後。
 */
export function expireCatering(value) {
  const record = cateringState(value);
  const { offer } = record;
  if (!offer || value.day <= offer.until) return null;
  store(value, { ...record, offer: null, next: Math.max(record.next, offer.until + REQUEST_GAP_DAYS) });
  return { id: offer.id, msg: offer.msg, accepted: offer.accepted !== null };
}

/** 今朝、新しい依頼が届くか（届くなら依頼の定義）。地元にいる時だけ（東京・ドバイにいる間は、帰ってから届く）。 */
export function cateringRequestDue(value) {
  if (!cateringSeason(value) || awayFromHome(value)) return null;
  const record = cateringState(value);
  if (record.offer || value.day < record.next) return null;
  return nextCateringRequest(value);
}

/** 次に届く依頼（周回ごとの種で始まりをずらし、届いた順に巡回する。断った・期限が過ぎた依頼も、また巡ってくる）。 */
export function nextCateringRequest(value) {
  const seed = Math.abs(Math.trunc(Number(value?.seed) || 0));
  return CATERING_REQUESTS[(seed + cateringState(value).offers) % CATERING_REQUESTS.length];
}

/** 依頼が届いた（LIMEを受信箱に入れた後に記録する）。msg＝受信箱の項目ID。 */
export function recordCateringOffer(value, id, msg) {
  const record = cateringState(value);
  if (record.offer || !cateringRequestById(id)) return false;
  store(value, { ...record, offers: record.offers + 1,
    offer: { id, msg, day: value.day, accepted: null, until: value.day + REPLY_DAYS - 1 } });
  return true;
}

/** 引き受けた。翌日から JOB_DAYS 日のうちに作りに行ける。 */
export function acceptCatering(value, msg) {
  const record = cateringState(value);
  const { offer } = record;
  if (!offer || offer.msg !== msg || offer.accepted !== null || value.day > offer.until || !cateringSeason(value)) return false;
  store(value, { ...record, offer: { ...offer, accepted: value.day, until: value.day + JOB_DAYS } });
  return true;
}

/** 見送った（叱られない。次の依頼は REQUEST_GAP_DAYS 日後）。 */
export function declineCatering(value, msg) {
  const record = cateringState(value);
  const { offer } = record;
  if (!offer || offer.msg !== msg || offer.accepted !== null) return false;
  store(value, { ...record, offer: null, next: value.day + REQUEST_GAP_DAYS });
  return true;
}

/** 今日、作りに行ける依頼（引き受けた翌日から until まで。地元の地図に出す）。時間帯は見ない（cateringSlotBlock）。 */
export function cateringJob(value) {
  if (!cateringSeason(value)) return null;
  const { offer } = cateringState(value);
  if (!offer || offer.accepted === null || value.day <= offer.accepted || value.day > offer.until) return null;
  return cateringRequestById(offer.id);
}

/** 時間帯が合わない理由（合えば null）。昼の会は昼だけ、夜の会は夜だけ。 */
export function cateringSlotBlock(entry, value) {
  if (!entry || (value?.slot ?? 0) === entry.slot) return null;
  return entry.slot === 1 ? { why: "夜の会なので、夜に向かう", tag: "夜の会" } : { why: "昼の会なので、昼のうちに向かう", tag: "昼の会" };
}

/** 選んだ組み合わせの合い方（best・ok・off）。範囲外は null。 */
export function cateringFit(entry, index) {
  return Number.isInteger(index) ? entry?.options?.[index]?.fit ?? null : null;
}

/**
 * 作りに行った結果を確定する。grant(n) はくじ券を渡して実際に増えた枚数を返す（ch5-catering.js が渡す）。
 * お金・火種・好感度は動かさない。戻り値 { fit, tickets } か null（今日作りに行ける依頼でない・選択が範囲外）。保存は呼び出し側。
 */
export function settleCatering(value, index, grant) {
  const entry = cateringJob(value);
  const fit = cateringFit(entry, index);
  if (!fit) return null;
  const record = cateringState(value);
  const want = CATERING_TICKETS[fit];
  const tickets = want > 0 ? Math.max(0, grant(want) | 0) : 0;
  store(value, { ...record, offer: null, next: value.day + REQUEST_GAP_DAYS,
    served: { ...record.served, [entry.id]: (record.served[entry.id] || 0) + 1 },
    last: { id: entry.id, day: value.day, fit, tickets } });
  return { fit, tickets };
}

/** スミさんの締めの巡回に使う、これまでに作りに行った回数の合計。 */
export const cateringServedTotal = value => Object.values(cateringState(value).served).reduce((sum, n) => sum + (integer(n) ? n : 0), 0);
