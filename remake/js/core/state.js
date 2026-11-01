// ゲーム状態（単一の state）とセーブ。
// 旧版と localStorage を共有しないよう、キーはリメイク専用。
// 状態の形を変えたら SCHEMA を上げ、migrate() に1段足す（互換コードはここだけに置く）。

import { MAX_MONEY, TOURNAMENT_DAY } from "./rules.js";
import { MASTERY_THRESHOLDS, learnFlavorStory } from "./flavor-mastery.js";
import { emit } from "./bus.js";
import { recordGalleryProgress } from "./gallery-progress.js";

export const SAVE_KEY = "suien_remake_save";
export const CONFIG_KEY = "suien_remake_config";
export const SCHEMA = 24; // 24: 凛の味の話を第4回へ移し、旧セーブの不足分を補う / 23: 味の話を第4回へ移し、読了済みセーブの不足分を補う / 22: 周回（NG+）の周回数・周回ID・開始時能力・引き継ぎ選択 / 21: フレーバー熟練度・まかない在庫 / 20: 東京訪問の旅程と自由時間 / 19: ダブルアップルの受取を卓上台と同時に移す / 18: 第1章の大会開始資源 / 17: 第1章の敗北回数・今回限りの操作補助 / 16: 斧Barの旧保存利用許可 / 15: TRPG部活の設立・入部 / 14: TRPGの入荷・購入・卓の記録 / 13: サメちゃんのID統一 / 12: 当日休養・延期した夜の予定 / 11: チェキ等の記念品 / 10: C.STATIONでスロット導入 / 2: スロット・くじ・恋人 / 3: LIME の受信箱 / 4: グラム在庫・天気 / 5: 交流の記憶 / 6: 好感度の端数・LIME返信と予約 / 7: 恋人の端数・接客履歴 / 8: 隠し恋愛値・交友の締めくくり / 9: 通常1P・成長の端数を進捗率へ

export const STAT_KEYS = ["technique", "sense", "guts", "charm", "insight"];
export const STAT_JA = { technique: "技術", sense: "センス", guts: "根性", charm: "魅力", insight: "洞察" };
export const STAT_EN = Object.fromEntries(Object.entries(STAT_JA).map(([en, ja]) => [ja, en]));

export const STARTER_EQUIPMENT = ["silicone_bowl", "lotos_hagal", "flat_charcoal"];

/** 現在の状態。load()/newGame() で差し替わる。各モジュールは常にこの参照を読む */
export let state = null;

/** 周回ごとの一意なID。真エンド記録の冪等化と誤ロード防止に使う（設計書 §1.1） */
export function newCycleId() {
  return `c${Date.now().toString(36)}_${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

export function newState() {
  return {
    schema: SCHEMA,
    cycle: 1,                  // 周回数（1周目=1）。真エンド到達で次の周回が解放される
    cycleId: newCycleId(),     // この周回の識別子
    cycleStartStats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 }, // 周回開始時に確定する5能力（難易度の入力）
    carryOptions: null,        // 引き継ぎのグループ選択（1周目は null）
    tokyoVisits: emptyTokyoVisits(),
    chapter: 1,
    phase: "opening",          // opening | daily | tournament | aftermath | cleared
    day: 1,
    slot: 0,                   // 0=昼 1=夜 2=その日の行動は終了
    money: 30000,
    stamina: 100,
    stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    statXp: {},
    statsAtChapterStart: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    flags: {},
    restDay: null,             // {chapter, day, fullDay, illnessHealth}: 発病日の状態は当日だけ維持
    deferredNightEvents: [],   // {id, chapter, originalDay, deferredOn, reason, prerequisites, doneKeys}
    met: {},                   // 名乗りを受けたキャラ（名前表示の解禁）
    affinityCarry: {}, // 普通の好感度の小数分。既存ポイントは減らさない
    loveCarry: {}, // 恋人の絆の半ポイントを持ち越す
    baitoRecent: [], // 直近4回の接客の客・日付
    affinity: {},              // キャラ -> 好感度ポイント（段階は stats.js で換算）
    story: {},                 // キャラ -> 固有会話の消化数
    visits: {},                // スポット -> 訪問回数
    visitedDay: {},            // スポット -> 最後に訪れた日（同じ店は1日1回）
    owned: STARTER_EQUIPMENT.slice(),
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    flavors: [], // 一度でも手に入れたフレーバー（図鑑的な記録）。使えるかどうかは flavorStock で決まる
    flavorMastery: {}, // 味の系統 -> 経験値（Lv.1〜5）
    flavorLessons: [], // 熟練度を受け取った会話
    staffPractice: null, // その日のまかない使用量
    flavorStock: {}, // フレーバーの在庫（g）。1箱50g。家の試作・店の持ち込み・大会の課題以外の葉で消費（課題は大会が支給＝減らない）
    weatherSeed: Math.floor(Math.random() * 100000), // 雨の日の抽選種（セーブごとに違う）
    baitoCount: 0,
    lastBaitoDay: 0,           // 最後にシフトに入った日（スミさんのバイト誘いの判定）
    usedBaito: [],
    contacts: ["sumi"],        // 上司のスミさんとは勤務開始時からLIME交換済み
    limeRead: [],              // 既読の LIME id
    pendingInvite: null, // day/slot/originIdつきの予約
    inbox: [],                 // LIME の受信箱 [{id, day, msg, read, done, log}]（朝に届き、好きなときに読む）
    relationshipMemories: [],   // 読んだ交流だけを残す。人数・恋愛・大会の加点には使わない
    trpg: { stock: [], owned: [], cleared: {}, shifts: [], club: { founded: null, members: {} } },
    recipes: {},               // 発見したレシピ
    keepsakes: [],             // 購入・入手した記念品のID（売却しない）
    best: {},                  // 練習ドリルの自己ベスト（0..2）
    rehearsal: null,           // 前日リハーサルの出来（great/good/rough）
    tournament: { attempts: 0, lastRank: null, losses: 0, lastLossAttempt: null, retryAssist: false },
    // MOKUMOKUパッキー（日常スロット）。抽選は seed＋総回転数の決定論＝ロードしても結果は変わらない
    reel: {
      seed: (Math.random() * 0x100000000) >>> 0,
      count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0,
      recent: [],              // 直近30回転の当たり記録（1=ペカ）。最近の不調の補いに使う（#1281）。旧セーブは空から数える
      pending: [],             // 演出待ちの結果（報酬は確定・適用済み）
      installed: false,        // C.STATIONの初回来場・参加登録で導入
      introDone: false,
      lastChapter: 0,
      note: {},                // パッキースロットノート（役ごとの回数・ハマり・当たり履歴・フリーズ殿堂入り）
      setting: 0,              // 設定1〜6（0=未決定。シードから決める）。観音堂で引き直す（#621）
      settingDraws: 0,         // 設定の引き直し回数
      settingSince: null,      // 今の設定になった日 {chapter, day}。7日で自動で変わる
      settingNotice: false,    // 次に筐体が出たとき「設定変更完了〜」を見せる（"kannon"／"weekly"）
      resetNext: false,        // 設定変更直後の1回転でガックン
      lock: null,              // 文字色予告を出した次ゲームの抽選結果
      settingGuideDone: false, // 設定のシステム説明を見た（新規は初回説明の中、旧セーブは一度だけの通知）
    },
    kuji: {},                  // くじの箱（grade -> {order, drawn, emptyDay}）
    goods: [],                 // くじ等で得た売れる小物 [{name, sell}]
    // 恋人（master_spec #24）: 好感度MAX→告白→付き合う/友達のまま。恋人の絆はデート等でだけ深まる
    lovers: [],
    loveLevel: {},             // 恋人 -> 絆Lv（1..5）
    lovePts: {},               // 恋人 -> 絆ポイント
    loverSince: {},            // 恋人 -> 付き合い始めた日（記念日LIMEの起点）
    lastDate: {},              // 恋人 -> 最後にデートした日
    loverEventsSeen: [],       // 見た恋愛イベント（lover_events.json）
    guilt: 0,                  // うしろめたさ（非表示）。2人以上と付き合うと積もる
    // 交友の締めくくり（daily/bonds.js）。恋愛の答えは実際に選んだものだけ。好感度・訪問回数から推測しない
    romance: {},               // 隠し恋愛値（キャラ -> 恋愛寄りに答えた数）。プレイヤーには見せない
    romanceChoices: {},        // 答えた質問（選択肢 id -> {char, value, day}）。同じ id は一度だけ数える
    finales: {},               // 読んだ好感度MAXの締めくくり（キャラ -> {day, chapter, route: lover|romance|friend}）
    friendHangouts: {},        // 友人とのシーシャのお誘いに乗った回数（キャラ -> 回数）
    seed: Math.floor(Math.random() * 1e6),
    playMs: 0,
  };
}

/** スキーマ12以前のキャラIDを、予約内の台本・選択肢・読了記録も含めて引き継ぐ。 */
function migrateSamechanIdentity(value) {
  // 旧名はこのセーブ互換処理だけで扱う。新しく届く台本や素材には使わない。
  const rename = text => text.replace(/kafuka/g, "samechan").replace(/Kafuka/g, "Samechan")
    .replace(/KAFUKA/g, "SAMECHAN").replace(/カフカ|かふか/g, "サメちゃん");
  if (typeof value === "string") return rename(value);
  if (Array.isArray(value)) return value.map(migrateSamechanIdentity);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value);
  // 移行途中のデータに新旧キーが同居していても、明示された現行キーを優先する。
  const legacy = entries.filter(([key]) => rename(key) !== key);
  const current = entries.filter(([key]) => rename(key) === key);
  return Object.fromEntries([...legacy, ...current].map(([key, item]) => [rename(key), migrateSamechanIdentity(item)]));
}

/** 旧スキーマのセーブを現行の形にそろえる（互換処理はここに集約） */
function migrate(s) {
  // 配列など、状態として解釈できない形は移行せず読み込み不可にする。
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const oldSchema = Number(s.schema) || 0;
  // 未来版は解釈・再保存せず、保存元とプレイ中の状態を保ったまま読込失敗にする。
  if (oldSchema > SCHEMA) return null;
  // 欠落キーの補完は「キーが無い場合」だけを見るため、null や型の違う値が残ると
  // 後段の移行処理が例外で落ちる。新規の形と突き合わせ、型の合わない値は既定値へ戻す。
  // （解釈できる部分はそのまま進め、解釈できない部分だけを無効化する）
  const fresh = newState();
  for (const k of Object.keys(fresh)) {
    if (!(k in s)) continue;
    const def = fresh[k];
    if (def === null) continue; // null が正規の値（restDay・pendingInvite 等）は個別処理で検証する
    if (Array.isArray(def)) {
      if (!Array.isArray(s[k])) s[k] = def;
    } else if (typeof def === "object") {
      if (!s[k] || typeof s[k] !== "object" || Array.isArray(s[k])) s[k] = def;
    } else if (typeof s[k] !== typeof def) {
      s[k] = def;
    }
  }
  // 能力値の中身が数値でない場合も、表示や計算で NaN が広がらないよう既定値へ戻す。
  for (const key of STAT_KEYS) {
    if (s.stats && !Number.isFinite(s.stats[key])) s.stats[key] = fresh.stats[key];
    if (s.statsAtChapterStart && !Number.isFinite(s.statsAtChapterStart[key])) s.statsAtChapterStart[key] = fresh.statsAtChapterStart[key];
  }
  if (oldSchema < 13) {
    s = migrateSamechanIdentity(s);
    for (const key of ["contacts", "lovers", "limeRead", "loverEventsSeen", "relationshipMemories"]) {
      if (Array.isArray(s[key])) s[key] = [...new Set(s[key])];
    }
  }
  if (oldSchema < 9) {
    // 以前の経験値は★帯のコストを割って、次の1Pまでの進捗率として引き継ぐ。
    // 能力の現在値は減らさず、ロードだけで増やさない。旧端数が通常1Pを膨らませない。
    const oldCosts = [1, 1.5, 2, 3, 4];
    s.statXp = Object.fromEntries(STAT_KEYS.map((key) => {
      const cost = oldCosts[Math.max(0, Math.min(4, Math.ceil((s.stats?.[key] || 0) / 20) - 1))];
      const xp = Number(s.statXp?.[key]) || 0;
      return [key, Math.max(0, Math.min(1 - Number.EPSILON, xp / cost))];
    }));
  }
  if (!s.flags || typeof s.flags !== "object" || Array.isArray(s.flags)) s.flags = {};
  delete s.notes; // 常連ノートは廃止。旧セーブの残存キーを捨てる
  // #577: 旧保存は未訪問でもBAR利用と従来の初対面を維持する。噂・目撃・面識は補わない。
  // 現行schemaで再保存してもこの許可を保持し、新規ゲームには付けない。
  if (oldSchema < 16) s.flags._axe_bar_legacy_access = true;
  // スキーマ12。古いセーブの延期は空から始め、読了を推測しない。
  const nightIds = new Set();
  s.deferredNightEvents = (Array.isArray(s.deferredNightEvents) ? s.deferredNightEvents : []).filter((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id || !Number.isInteger(entry.chapter) || entry.chapter < 1
      || !Number.isInteger(entry.originalDay) || entry.originalDay < 1 || !Number.isInteger(entry.deferredOn)) return false;
    const key = `${entry.chapter}:${entry.id}`;
    if (nightIds.has(key)) return false;
    nightIds.add(key);
    return true;
  });
  if (!s.restDay || s.restDay.chapter !== s.chapter || s.restDay.day !== s.day) s.restDay = null;
  else s.restDay = { chapter: s.chapter, day: s.day, fullDay: s.restDay.fullDay === true,
    illnessHealth: ["green", "yellow", "red"].includes(s.restDay.illnessHealth) ? s.restDay.illnessHealth : null };
  s.loveCarry = Object.fromEntries(Object.entries(s.loveCarry && typeof s.loveCarry === "object" ? s.loveCarry : {})
    .filter(([, v]) => Number.isFinite(v) && v >= 0 && v < 1));
  s.baitoRecent = (Array.isArray(s.baitoRecent) ? s.baitoRecent : [])
    .filter((entry) => entry && typeof entry.id === "string" && entry.id && Number.isInteger(entry.chapter) && entry.chapter > 0
      && Number.isInteger(entry.day) && entry.day > 0)
    .map((entry) => ({ id: entry.id, chapter: entry.chapter, day: entry.day,
      customers: [...new Set((Array.isArray(entry.customers) ? entry.customers : []).filter((id) => typeof id === "string" && id))] }))
    .slice(-4);
  s.affinityCarry = Object.fromEntries(Object.entries(s.affinityCarry && typeof s.affinityCarry === "object" ? s.affinityCarry : {})
    .filter(([, v]) => Number.isFinite(v) && v >= 0 && v < 1));
  // 旧版は私服デートを店舗訪問の6回目で再生していた。読んだ保存を重ねて再生しない。
  if (oldSchema < 6 && (s.story?.minto || 0) >= 6) {
    s.story.minto -= 1;
    s.flags._minto_fifth_done = true;
  }
  if (oldSchema < 6 && (s.story?.adam || 0) >= 5) {
    s.story.adam -= 1;
    s.flags._adam_arcade_done = true;
  }
  s.inbox = (Array.isArray(s.inbox) ? s.inbox : []).filter((i) => i && typeof i.id === "string" && i.msg && typeof i.msg === "object");
  for (const item of s.inbox) {
    // 再案内の一意IDを元の約束IDとして保存した旧ロードの誤記録も修復する。
    item.originId = item.msg.origin_id || item.originId || item.id;
    if (!["waiting", "replied", "expired", "none"].includes(item.replyState)) {
      const replyable = item.msg.type === "invitation" || !!item.msg.replies?.length;
      item.replyState = !replyable ? "none" : !item.done ? "waiting"
        : item.result === "expired" || item.expired ? "expired" : "replied";
    }
  }
  if (oldSchema < 6) {
    // 旧版の店舗招待で誤って付いた外出完了は、実際の外出の承諾と完了が残る場合だけ引き継ぐ。
    for (const id of ["minto", "naru", "adam", "tsumugi", "ageha"]) {
      if (s.flags[`_outing_done_${id}`] && !s.inbox.some((i) => i.result === "accepted" && i.msg.accept_event === `outing_${id}_1`)) {
        delete s.flags[`_outing_done_${id}`];
      }
    }
  }
  if (s.pendingInvite && (typeof s.pendingInvite !== "object" || Array.isArray(s.pendingInvite))) s.pendingInvite = null;
  if (s.pendingInvite && typeof s.pendingInvite === "object") {
    const inv = s.pendingInvite;
    const candidates = [...s.inbox].reverse().filter((i) => i.msg.sender === inv.sender && i.msg.accept_event === inv.event);
    const item = inv.originId
      ? candidates.find((i) => i.id === inv.originId || i.originId === inv.originId)
      : candidates[0];
    inv.day ??= s.day;
    inv.originId = item?.originId || inv.originId || null;
    inv.afterClose ??= !!item?.msg.after_close;
  }
  // 隠し恋愛値・締めくくり（スキーマ8）。壊れた値は捨て、無いものは空から始める（読んでいない質問を埋めない）
  const record = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
  s.romance = Object.fromEntries(Object.entries(record(s.romance)).filter(([, v]) => Number.isInteger(v) && v > 0));
  s.romanceChoices = Object.fromEntries(Object.entries(record(s.romanceChoices))
    .filter(([, a]) => a && typeof a.char === "string" && Number.isInteger(a.value) && a.value >= 0));
  s.finales = Object.fromEntries(Object.entries(record(s.finales))
    .filter(([, f]) => f && ["lover", "romance", "friend"].includes(f.route)));
  if (oldSchema < 8) {
    // 旧版は好感度MAXだけで告白を自動予約していた。恋愛の答えが無い予約は残さない（既存の恋人関係はそのまま）
    delete s.flags._confession_due;
    delete s.flags._confession_wait;
  }
  // 訪問・好感度から、新しい台詞を読んだと推測しない。オート・手動枠に同じ処理を使う。
  s.relationshipMemories = Array.isArray(s.relationshipMemories)
    ? [...new Set(s.relationshipMemories.filter((id) => typeof id === "string"))]
    : [];
  // グラム在庫の導入前のセーブ: 持っていたフレーバーは1箱（50g）ぶんとして引き継ぐ
  if (!s.flavorStock) {
    s.flavorStock = Object.fromEntries((s.flavors || ["double_apple"]).map((id) => [id, 50]));
    if (s.flags?._rin_sample) s.flavorStock.nightside_earlgrey = 50;
  }
  // スキーマ14。旧無料プレビューの試遊から購入・クリアを推測しない。
  const trpg = record(s.trpg);
  const ids = value => [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === "string" && id))];
  // スキーマ15。MAXや過去の卓から設立・入部を推測せず、購入とクリアは保持する。
  const club = record(trpg.club);
  const clubDate = v => v && Number.isInteger(v.chapter) && v.chapter >= 2 && Number.isInteger(v.day) && v.day > 0;
  const founded = clubDate(club.founded) ? club.founded : null;
  s.trpg = { stock: ids(trpg.stock), owned: ids(trpg.owned),
    cleared: Object.fromEntries(Object.entries(record(trpg.cleared)).filter(([, v]) => v && typeof v.ending === "string"
      && Number.isInteger(v.chapter) && v.chapter >= 2 && Number.isInteger(v.day) && v.day > 0
      && typeof v.gm === "string" && Array.isArray(v.participants))),
    shifts: (Array.isArray(trpg.shifts) ? trpg.shifts : []).filter(v => v && typeof v.id === "string"
      && Number.isInteger(v.chapter) && Number.isInteger(v.day) && [0, 1].includes(v.slot) && typeof v.busy === "boolean"),
    club: { founded, members: founded ? Object.fromEntries(Object.entries(record(club.members))
      .filter(([id, date]) => id && !["sumi", "naru"].includes(id) && clubDate(date)
        && (date.chapter > founded.chapter || date.chapter === founded.chapter && date.day >= founded.day))) : {} },
  };
  for (const k of Object.keys(fresh)) if (!(k in s)) s[k] = fresh[k];
  // 旧/現行セーブで欠落した上司の連絡先だけを補い、交流やひよりの読了は推測しない。
  if (!Array.isArray(s.contacts)) s.contacts = [];
  if (!s.contacts.includes("sumi")) s.contacts.push("sumi");
  s.reel = { ...fresh.reel, ...s.reel };
  // reel の中身に null が残ると、<10 の導入判定や後段の演出で落ちる。形だけ先にそろえる。
  if (!Array.isArray(s.reel.pending)) s.reel.pending = [];
  if (!s.reel.note || typeof s.reel.note !== "object" || Array.isArray(s.reel.note)) s.reel.note = {};
  s.keepsakes = [...new Set((Array.isArray(s.keepsakes) ? s.keepsakes : []).filter((id) => typeof id === "string"))];
  if (oldSchema < 10) {
    s.reel.installed = !!(s.reel.introDone || s.reel.count || s.reel.pending.length || s.spotVisits?.c_station);
  }
  if (s.reel.installed) s.flags.pakki_app_installed = true; // 導入済みの旧セーブも観音堂の会話の条件を満たす
  // 廃止パイプ（pipe_middle / pipe_high / pipe_highest）は買値で全額返金し、所持・装備から外す。
  const pipeRefunds = { pipe_middle: 30000, pipe_high: 100000, pipe_highest: 300000 };
  if (Array.isArray(s.owned) && s.owned.some((id) => id in pipeRefunds)) {
    let refund = 0;
    for (const id of new Set(s.owned)) {
      if (id in pipeRefunds) refund += pipeRefunds[id];
    }
    s.owned = s.owned.filter((id) => !(id in pipeRefunds));
    s.money = (Number(s.money) || 0) + refund;
  }
  if (s.equip && typeof s.equip === "object" && s.equip.pipe in pipeRefunds) {
    s.equip.pipe = "harry_the_moon";
  }
  s.money = Math.min(MAX_MONEY, Math.max(0, Math.round(s.money)));
  // 旧版は冒頭で50gを所持していた。消費済み・売却済みの分も渡し直さず、
  // 現在の在庫と進行を保つ。新規19の受取は home-rig.js で一度だけ確定する。
  if (oldSchema < 19) s.flags._sumi_double_apple_received = true;
  // 家シーシャ（#638）: スミさんが卓上台を譲る中間準備（第1章 DAY7）を終えた旧セーブにも台を渡す（能力はさかのぼらない）
  const midDone = !!(s.flags?._ev_midcheck || s.flags?._ch1_mid?.feedbackRead) || (Number(s.chapter) || 1) >= 2;
  if (midDone && Array.isArray(s.owned) && !s.owned.includes("home_rig_set")) s.owned.push("home_rig_set");
  // 以前のDAY15大会セーブも、進行状況を保って正しい大会日に揃える。
  if (s.chapter === 1 && s.day > TOURNAMENT_DAY) s.day = TOURNAMENT_DAY;
  s.tournament ||= { attempts: 0, lastRank: null };
  s.tournament.losses ??= 0;
  s.tournament.lastLossAttempt ??= null;
  s.tournament.retryAssist ??= false;
  if (oldSchema < 18 && s.chapter === 1 && s.phase === "tournament"
    && !s.tournament.entryResources && s.tournament.stockSnap
    && Number.isFinite(s.stamina)) {
    // 失われた開始体力は逆算しない。移行時の現在値を一度固定し、再保存後も維持する。
    s.tournament.entryResources = {
      version: 1, flavorStock: { ...s.tournament.stockSnap },
      stamina: s.stamina, source: "legacy-load",
    };
  }
  s.tokyoVisits = restoreTokyoVisits(oldSchema < 20 ? null : s.tokyoVisits);
  s.flavorMastery = Object.fromEntries(Object.entries(record(s.flavorMastery))
    .filter(([id, xp]) => /^[a-z0-9_]+$/.test(id) && Number.isFinite(xp) && xp >= 0)
    .map(([id, xp]) => [id, Math.min(MASTERY_THRESHOLDS.at(-1), xp)]));
  s.flavorLessons = Array.isArray(s.flavorLessons) ? [...new Set(s.flavorLessons.filter(x => typeof x === "string"))] : [];
  // アダムのダブルアップルの話は第3回から第4回へ移した（#1466）。第3回で受け取った旧セーブに第4回で二重付与しない。
  if (s.flavorLessons.includes("ch1_adam_third") && !s.flavorLessons.includes("ch1_adam_fourth")) s.flavorLessons.push("ch1_adam_fourth");
  // 第4回を読了済みの旧セーブは再生できないため、受け取り済みの旧回を除いた不足分だけ補う。
  if (oldSchema < 23) {
    const readFourth = [
      [(s.story?.naru || 0) >= 5, "ch1_naru_fourth", { vanilla: 1 }],
      [!!s.flags?._ch2_read_ch2_kumicho_fourth, "ch2_kumicho_fourth", { dragonfruit: 1 }],
      [!!s.flags?._ch2_read_ch2_rei_fourth, "ch2_rei_fourth", { rose: 1 }],
    ];
    for (const [read, dialogue_id, flavor_lesson] of readFourth) {
      if (read) learnFlavorStory(s, { dialogue_id, metadata: { flavor_lesson } });
    }
  }
  // 第4回読了済みの旧セーブは再生できない。第2回・反復回で受け取った分を除き、未取得分だけ補う。
  if (oldSchema < 24 && (s.story?.rin || 0) >= 4) {
    learnFlavorStory(s, {
      dialogue_id: "ch1_rin_fourth",
      metadata: { flavor_lesson: { rose: 1, lychee: 1, blueberry: 1 } },
    });
  }
  if (!s.staffPractice || typeof s.staffPractice.day !== "string") s.staffPractice = null;
  else s.staffPractice.used = Object.fromEntries(Object.entries(record(s.staffPractice.used))
    .filter(([, g]) => Number.isFinite(g) && g >= 0).map(([id, g]) => [id, Math.min(6, g)]));
  if (oldSchema < 21 && s.chapter === 1 && s.phase === "tournament") s.flags._legacy_mint_tournament = true;
  // スキーマ22。周回（NG+）の土台。既存セーブはすべて1周目で、既存の値は変えない。
  // cycleId は欠けているときだけ発行する（移行を冪等に保ち、再読込でIDが揺れないようにする）。
  if (oldSchema < 22) {
    s.cycle = 1;
    if (typeof s.cycleId !== "string" || !s.cycleId) s.cycleId = newCycleId();
    s.cycleStartStats = Object.fromEntries(STAT_KEYS.map((k) => [k, 10]));
    s.carryOptions = null;
  }
  // 壊れた周回メタは、開始時能力（難易度の入力になる）を守るため初期値側へ倒す。
  if (!Number.isInteger(s.cycle) || s.cycle < 1) s.cycle = 1;
  if (typeof s.cycleId !== "string" || !s.cycleId) s.cycleId = newCycleId();
  if (!s.cycleStartStats || typeof s.cycleStartStats !== "object" || Array.isArray(s.cycleStartStats)
    || STAT_KEYS.some((k) => !Number.isFinite(s.cycleStartStats[k]))) {
    s.cycleStartStats = Object.fromEntries(STAT_KEYS.map((k) => [k, 10]));
  }
  if (s.carryOptions !== null && (typeof s.carryOptions !== "object" || Array.isArray(s.carryOptions))) s.carryOptions = null;
  s.schema = SCHEMA;
  return s;
}

export function setState(s) {
  state = s;
  emit("hud"); // ロード・はじめからでも、前の残量と通知を画面に持ち越さない。
  return state;
}

export function newGame() {
  return setState(newState());
}

let lastComplementedAutosaveRaw = null;

function writeSave(target = state) {
  if (!target) return { raw: null, saved: false };
  // 初回の旧slot LOADでも、上書き前のオートセーブにある実績を先に補完する。
  try {
    const oldRaw = localStorage.getItem(SAVE_KEY);
    if (oldRaw && oldRaw !== lastComplementedAutosaveRaw) {
      const oldSave = JSON.parse(oldRaw);
      if (oldSave && typeof oldSave === "object") recordGalleryProgress(oldSave);
      lastComplementedAutosaveRaw = oldRaw;
    }
  } catch { /* 旧記録の補完失敗で現在の保存を妨げない */ }
  recordGalleryProgress(target);
  target.savedAt = Date.now();
  let raw = null;
  try {
    raw = JSON.stringify(target);
    localStorage.setItem(SAVE_KEY, raw);
    lastComplementedAutosaveRaw = raw;
    return { raw, saved: true };
  } catch {
    /* プライベートウィンドウ等で失敗しても遊べるようにする */
    return { raw, saved: false };
  }
}

export function save() {
  return writeSave().saved;
}

export function peekSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

export function load() {
  const s = peekSave();
  if (!s) return null;
  // 移行で想定外の例外が出ても、タイトルやブートを巻き込まず読み込み失敗にする。
  let migrated = null;
  try { migrated = migrate(s); } catch { migrated = null; }
  return migrated ? setState(migrated) : null;
}

// ---------------------------------------------------------------- 手動セーブ枠（オートセーブとは別に3枠）

export const SAVE_SLOTS = [
  { key: SAVE_KEY, label: "オートセーブ", auto: true },
  { key: "suien_remake_slot1", label: "スロット 1" },
  { key: "suien_remake_slot2", label: "スロット 2" },
  { key: "suien_remake_slot3", label: "スロット 3" },
];
const BOOT_LOAD_KEY = "suien_remake_boot_load";

/** 枠の中身（無い・壊れている→null） */
export function readSlot(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    return s && typeof s === "object" && s.day ? s : null;
  } catch {
    return null;
  }
}
/** 全枠のうち savedAt が最新のセーブ（同点・欠落は SAVE_SLOTS 順で先のもの）。無ければ null */
export function peekLatestSave() {
  let best = null, bestAt = -Infinity;
  for (const slot of SAVE_SLOTS) {
    const s = readSlot(slot.key);
    if (!s) continue;
    const at = Number.isFinite(s.savedAt) ? s.savedAt : -Infinity;
    if (!best || at > bestAt) { best = s; bestAt = at; }
  }
  return best;
}
export const anySlotSaved = () => SAVE_SLOTS.some((s) => readSlot(s.key));

/** 今の状態を手動の枠に書く（オートセーブも同時に更新） */
export function saveToSlot(key) {
  const { raw } = writeSave();
  try {
    localStorage.setItem(key, raw === null ? JSON.stringify(state) : raw);
    return true;
  } catch {
    return false;
  }
}

/** 枠から読み込んで今の状態にする。以後のオートセーブもこのデータから続く */
export function loadFromSlot(key) {
  const s = readSlot(key);
  if (!s) return null;
  // 移行で想定外の例外が出ても、進行中の状態と保存元を保ったまま読み込み失敗にする。
  let migrated = null;
  try { migrated = migrate(s); } catch { migrated = null; }
  if (!migrated) return null;
  // 保存の成否が決まるまで候補を公開しない。hud購読者は旧画面を破棄しうる。
  const { saved } = writeSave(migrated);
  // 手動枠を書き継げないと、再起動後に古いオートセーブへ戻ってしまう。
  if (!saved && key !== SAVE_KEY) return null;
  return setState(migrated);
}

/** ゲーム中にロードしたとき: いったん読み直して、タイトルを飛ばしてそのまま再開する */
export function requestResumeOnBoot() {
  try { sessionStorage.setItem(BOOT_LOAD_KEY, "1"); } catch { /* noop */ }
}
export function consumeResumeOnBoot() {
  try {
    const v = sessionStorage.getItem(BOOT_LOAD_KEY);
    sessionStorage.removeItem(BOOT_LOAD_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export function wipeSave() {
  recordGalleryProgress(peekSave());
  try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
}

// ---------------------------------------------------------------- 設定（セーブとは別）
export const config = {
  uiTheme: "paper",    // 会話枠と共通UI。ゲームの進行とは別の端末設定（既定は紙とラベンダー・DUI08）。
  mute: false,       // すべての音を一時的に消す（旧キー muted は読み込み時に mute へ統一）
  bgmVolume: 0.5,
  seVolume: 0.7,
  textSpeed: 2,      // 1=ゆっくり 2=ふつう 3=はやい 4=瞬時
  autoSpeed: 2,      // 1=ゆっくり 2=ふつう 3=はやい
  skipSeenOnly: false, // 旧来の全スキップを維持し、設定で既読のみへ切替
  reduceShake: false,
  voiceBlip: true,   // 文字送りの声（キャラ別の音程）
  // 一度見た演出（連絡先交換・シフト終了）を2回目以降だけ短くする。初回は必ずフルで見せる。
  // 既定オフ＝現状どおり。くじ・チェキ・MG(#1081 H05)は短縮しない。既読判定は state.flags を使う。
  shortSeen: false,
  statEffectColors: true, // 作り画面の能力補正を色と漢字で示す
  introArtStyle: "graphic", // 登場カットインの絵柄。"classic" で旧（立ち絵）に戻す（2026-10-31）
};

export function loadConfig() {
  try {
    Object.assign(config, JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"));
  } catch { /* noop */ }
  if ("muted" in config) { config.mute = !!(config.mute || config.muted); delete config.muted; }
  return config;
}

export function saveConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* noop */ }
}

// ---------------------------------------------------------------- 小さな共通操作
export const flag = (name) => !!(state && state.flags[name]);
export const setFlag = (name, v = true) => { if (state) state.flags[name] = v; };
export const markMet = (id) => { if (state && id) state.met[id] = true; };
export const timeOfDay = () => (state && state.slot >= 1 ? "night" : "day");

export const emptyTokyoVisits = () => ({ version: 1, plans: [], offers: {}, closedSlots: [], chats: {} });

/** 保存の構造だけを検査。旧セーブから訪問・読了・関係を推測しない。 */
function restoreTokyoVisits(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.plans)) return emptyTokyoVisits();
  const restored = emptyTokyoVisits();
  const seenIds = new Set();
  restored.closedSlots = [...new Set((Array.isArray(raw.closedSlots) ? raw.closedSlots : [])
    .filter(id => /^d\d+-(noon|night)$/.test(id)))];
  const validTime = time => time && Number.isInteger(time.day) && time.day > 0 && [0, 1].includes(time.slot)
    && /^d\d+-(noon|night)$/.test(time.id);
  for (const plan of raw.plans) {
    if (!plan || typeof plan.id !== "string" || typeof plan.characterId !== "string"
      || !["booked", "arrived", "staying", "returned"].includes(plan.status)
      || !Number.isInteger(plan.arrivalDay) || !Number.isInteger(plan.returnDay) || plan.arrivalDay >= plan.returnDay
      || !validTime(plan.meetup) || !validTime(plan.date) || plan.meetup.day !== plan.arrivalDay
      || (plan.meetup.day * 2 + plan.meetup.slot) >= (plan.date.day * 2 + plan.date.slot) || plan.date.day >= plan.returnDay
      || typeof plan.met !== "boolean" || typeof plan.dateDone !== "boolean"
      || seenIds.has(plan.id)) continue;
    restored.plans.push(structuredClone(plan));
    seenIds.add(plan.id);
  }
  if (raw.chats && typeof raw.chats === "object" && !Array.isArray(raw.chats)) {
    restored.chats = Object.fromEntries(Object.entries(raw.chats).filter(([, day]) => typeof day === "string"));
  }
  if (raw.offers && typeof raw.offers === "object" && !Array.isArray(raw.offers)) {
    restored.offers = Object.fromEntries(Object.entries(raw.offers).filter(([id, offer]) => offer
      && offer.characterId === id && Number.isInteger(offer.arrivalDay) && Number.isInteger(offer.returnDay)
      && offer.arrivalDay < offer.returnDay && validTime(offer.meetup) && validTime(offer.date)
      && offer.meetup.day === offer.arrivalDay && offer.date.day < offer.returnDay
      && (offer.meetup.day * 2 + offer.meetup.slot) < (offer.date.day * 2 + offer.date.slot)));
  }
  return restored;
}
