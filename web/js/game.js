// ブラウザ版 — ゲーム進行（日常ループ → 大会）。第1章＋第2章
"use strict";

const D = window.GAME_DATA;
const SAVE_KEY = "shisha_ch1_save_v1";
const MAX_DAYS = 14; // 大会まで毎回14日間の準備期間
const AFFINITY_CAP = 5; // 好感度は5段階。5でロマンス対象は告白イベント
const VISIT_COST = 3000;

// 恋愛発展できるキャラ（5段階目で「付き合うか」のイベントが入る）。
// confession.json に告白シーンがあるキャラのうち、現章までに登場済みのもの
const ROMANCEABLE = ["tsumugi", "minto", "rin", "ageha"];

// ============ 名前の開示（？？？）システム（master_spec #1/#8） ============
// 未紹介キャラはネームプレート・LIME・マップ等すべてで「？？？」。
// 名乗り（dialogue内の set_flag _met_xxx）か紹介イベントで解禁する。
// モブ・最初から知っている相手（師匠等）は常時表示
const ALWAYS_KNOWN = new Set([
  "hajime", "hazime", "sumi", "salaryman", "kako", "rira", "oneesan",
  "shop_clerk", "old_man", "customer", "everyone", "staff_choizap", "pakki", "???",
]);
function isMet(id) {
  return !state || !!state.flags[`_met_${id}`];
}
function markMet(id) {
  if (state && id) state.flags[`_met_${id}`] = true;
}
function displayName(id) {
  if (!id) return "";
  const real = SPEAKER_NAMES[id] || (D.char_names || {})[id] || id;
  if (ALWAYS_KNOWN.has(id) || isMet(id)) return real;
  return "？？？";
}

// ============ 好感度ポイント（二層化 master_spec #23） ============
// 内部ポイント（隠し数値）が閾値を超えると段階（state.affinity = ランク0..5）が上がる。
// 選択肢をそこそこ当てて7〜8回会うと最大段階に届くバランス
const AFFINITY_RANK_PTS = [0, 9, 20, 33, 48, 66]; // ランク1..5 の必要ポイント
const AFFINITY_PTS = { visit: 6, repeat: 3, lime: 3, event: 5, invite: 9, date: 10, quick: 3 };
function rankFromPts(pts) {
  let r = 0;
  for (let i = 1; i < AFFINITY_RANK_PTS.length; i++) if (pts >= AFFINITY_RANK_PTS[i]) r = i;
  return r;
}

// ============ 体力（スタミナ）system（master_spec #6） ============
// 「若いので甘め。ただし無理を重ねると寝込む」。数値は非表示でゲージのみ
const STAMINA_LOW = 25;        // ここ未満でシーシャ系行動 → 警告→強行で酸欠
const STAMINA_COST = { baito: 18, visit: 10, talk: 5, practice: 8, rin: 10, date: 6, homePuff: 8, gym: 6 };
// 体力は蓄積制(#41): 夜の自然回復(sleep)はやや控えめ＝疲労が緩く溜まる（普通の混在プレイは持つが、無理は溜まる）。
// フル回復は「家で休む」、恋人会いは好感度に応じて
const STAMINA_GAIN = { rest: 35, cafe: 12, kannon: 12, sleep: 25 };
function stamina() { return state.stamina ?? 100; }
function addStamina(n) {
  state.stamina = Math.max(0, Math.min(100, stamina() + n));
  updateHud();
}
function staminaLow() { return stamina() < STAMINA_LOW; }

// シーシャ系の行動前ガード。体力が低いと警告し、強行すると酸欠（ヤニクラ）で
// その日の残り行動を失う。無理を重ねる（2回strikes）と翌朝は風邪で1日休み
function shishaGuard(proceed, cancel) {
  if (!staminaLow()) return proceed();
  playCustom({
    dialogue_id: "stamina_warning",
    lines: [
      { speaker: "", face: "", text: "（……正直、体が重い。このまま煙を吸ったら、確実にクラる気がする。）" },
      { type: "choice", choices: [
        { text: "やめておく（今日は無理しない）", next: "stay" },
        { text: "構わず続ける", next: "go" },
      ] },
    ],
    branches: {
      stay: [{ speaker: "", face: "", text: "（……無理は、しない。それも仕込みのうちだ。）" }],
      go: [{ type: "set_flag", flag: "_stamina_push" }],
    },
  }, () => {
    if (state.flags._stamina_push) {
      delete state.flags._stamina_push;
      return yaniKura();
    }
    cancel ? cancel() : showMap();
  });
}

// 酸欠（ヤニクラ）。半日〜1日が飛ぶ
function yaniKura() {
  state.flags._overwork = (state.flags._overwork || 0) + 1;
  playCustom({
    dialogue_id: "yani_kura",
    metadata: { bg: "res://assets/backgrounds/bg_home.png" },
    lines: [
      { speaker: "", face: "", text: "数口で、視界の端が白くなった。耳の奥で、自分の心臓だけが大きい。" },
      { speaker: "hajime", face: "sad", text: "（……まずい。クラった——酸欠だ）" },
      { speaker: "", face: "", text: "壁に手をついて、ずるずると座り込む。気づけば、1時間がどこかへ消えていた。\n今日はもう、何もできそうにない。" },
    ],
  }, () => {
    state.stamina = Math.max(stamina(), 40);
    state.ap = 1;
    endAction(); // 残り行動を失って夜→帰宅へ
  });
}

// ============ 定休日・臨時休業（master_spec #5の補完） ============
// 通い詰めのワンパターン化防止。スケジュールは決定的（セーブ&ロードで変わらない）
const SHOP_CLOSURES = { naru: 3, adam: 5, minto: 6 }; // state.day % 7 がこの値の日は定休日
const RIN_AWAY_CYCLE = 2; // 凛は day % 7 === 2 の日は出張で不在（店は開いている）
function closureInfo(spotId) {
  if (!state) return null;
  const cyc = SHOP_CLOSURES[spotId];
  if (cyc === undefined) return null;
  if (state.day % 7 === cyc) return "定休日";
  // 臨時休業（約1割・章と日付から決定的に決まる）
  const h = ((state.chapter || 1) * 131 + state.day * 31 + spotId.charCodeAt(0) * 7) % 10;
  if (h === 0) return "臨時休業";
  return null;
}

// 章ごとの大会情報。stageDays は大会の試合日（14日制の中に予選〜決勝を配置）
const CHAPTERS = {
  1: { cup: "SMOKE CROWN CUP", stageDays: { 14: "final" } },
  2: { cup: "HAZE: OPEN CLOUD", stageDays: { 8: "qual", 11: "semi", 14: "final" } },
};
const CH2_STAGE_LABEL = { qual: "予選ブロック", semi: "準決勝", final: "決勝" };

function chapterInfo() { return CHAPTERS[(state && state.chapter) || 1]; }
function cupName() { return chapterInfo().cup; }
// 次の試合日（ch1は決勝のみ＝14日目）
function nextStageDay() {
  const days = Object.keys(chapterInfo().stageDays).map(Number).sort((a, b) => a - b);
  return days.find((d) => d >= state.day) ?? days[days.length - 1];
}

// ---------------------------------------------------------------- state
let state = null;

// 初期所持機材（各タイプの基本品。上位機材はショップで買う）
const STARTER_EQUIPMENT = ["silicone_bowl", "lotos_hagal", "flat_charcoal"];

function newState() {
  return {
    chapter: 1,
    day: 1,
    ap: 2,
    money: 30000,
    stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    statsBaseline: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    affinity: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0, ageha: 0 },
    affinityPts: {},       // 好感度の内部ポイント（隠し数値。閾値で affinity の段階が上がる）
    visits: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0, ageha: 0, kumicho: 0, rei: 0, volk: 0 },
    stamina: 100,          // 体力（数値は非表示・ゲージのみ）
    dayVisited: {},        // 店ごとの最終訪問日（同じ店は1日1回まで）
    lovers: [],            // 付き合っているキャラ（複数なら浮気状態）
    loveLevel: {},         // 恋愛関係後の絆レベル（恋人Lv 0〜5）
    lovePts: {},           // 恋人Lvの内部ポイント
    lastDate: {},          // 恋人ごとの最終デート日（誘いLIMEのクールダウン）
    loverEventsSeen: [],   // 再生済みの恋人マイルストーンイベントID
    loverQuickDay: 0,      // 「恋人とちょい会い」を使った日（1日1回・コマ消費なし）
    guilt: 0,              // うしろめたさ（非表示。浮気リスクシステムの内部値）
    usedBaito: [],
    gymMember: false,
    owned: STARTER_EQUIPMENT.slice(),
    limeDone: [],          // 既読のLIMEメッセージID
    limeContacts: [],      // 連絡先を交換済みのキャラ（LIME配信のゲート）
    kuji: {},              // くじのボックス状態（grade別: box順・drawn・空にした日）
    goods: [],             // くじ等で得た売却可グッズ [{name, sell}]
    pendingLimeNight: null, // 夜に約束したLIMEイベント {event, sender}
    practiceBest: {},      // 練習ドリルの自己ベスト（0〜2）。大会本番のボーナスになる
    customerNotes: {},     // 常連ノート: {event_id: {first, count}} バイトで会った客の記録
    // 日常スロット（パッキー＝理由は語られない謎のマスコット兼司会）。アプリ演出は出さない
    reel: (typeof REEL !== "undefined" ? Object.assign(REEL.newReelState(), { introDone: true }) : null),
    flags: {},
    phase: "opening", // opening | daily | tournament | cleared
  };
}

function save() {
  state.savedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* file:// 等で失敗しても続行 */ }
}
// ---------------------------------------------------------------- helpers
const $ = (sel) => document.querySelector(sel);

// 顔ドット絵アイコン（tools/make_face_icons.py 生成・data.js に埋め込み）。
// 無いキャラは null を返し、呼び出し側が文字バッジ等にフォールバックする
function faceIconHtml(charId, cls = "pixel-face") {
  const src = (D.face_icons || {})[charId];
  return src ? `<img class="${cls}" src="${src}" alt="">` : null;
}

// 16:9 (1280x720) のステージを画面サイズに合わせて等倍スケール
function fitStage() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  $("#game").style.transform = `scale(${scale})`;
}

// タッチ端末か（スマホ用うっすらパッドの表示判定）
const IS_TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("active");
  $(id).classList.add("active");
  // スマホでは会話画面にうっすら操作パッドを浮かべる
  $("#touch-pad").classList.toggle("show", IS_TOUCH && id === "#screen-dialogue");
  // タイトルではHUD・DAYカードを隠す
  const isTitle = id === "#screen-title";
  $("#hud").classList.toggle("hidden", isTitle);
  if (isTitle) $("#hud-day-card").classList.remove("show");
  // マップでは場所チップを隠す（場所＝マップ自身。DAYカードと重なるのも防ぐ）
  $("#hud-location").classList.toggle("hidden", id === "#screen-map");
  // 大会・敗北画面ではDAYカードを消す
  if (id !== "#screen-map") $("#hud-day-card").classList.remove("show");
  else if (state && state.phase === "daily") $("#hud-day-card").classList.add("show");
  // 画面を移ったら AUTO/SKIP を解除（ダイアログ専用）
  if (id !== "#screen-dialogue") stopAutoSkip();
  if (state) updateDayCard();
}

function toast(msg) {
  const box = $("#toasts");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("show"), 16);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2600);
}

// ============ 経験値バナー（Persona風） ============
// kind: "stat" | "affinity" | "money-plus" | "money-minus" | "item"
// badge: バッジ内に出す1文字（漢字や記号）
// labelTop: 上の小さい英字ラベル（"STATUS UP" など）
// labelMain: メインのキャラ／ステータス名や金額
// labelSub: 補足（"少し上がった" 等）
const gainQueue = [];
let gainShowing = 0;
function gainBanner({ kind = "stat", badge = "+", labelTop = "STATUS UP", labelMain = "", labelSub = "" }) {
  gainQueue.push({ kind, badge, labelTop, labelMain, labelSub });
  flushGainQueue();
}
function flushGainQueue() {
  if (!gainQueue.length) return;
  if (gainShowing >= 3) return; // 同時表示は最大3枚まで（積みすぎ防止）
  const item = gainQueue.shift();
  const box = $("#gain-banner");
  const card = document.createElement("div");
  card.className = `gain-card ${item.kind}`;
  card.innerHTML =
    `<div class="badge">${item.badge}</div>` +
    `<div class="meta">` +
      `<span class="label-top">${item.labelTop}</span>` +
      `<span class="label-main">${item.labelMain}</span>` +
      (item.labelSub ? `<span class="label-sub">${item.labelSub}</span>` : "") +
    `</div>`;
  box.appendChild(card);
  gainShowing++;
  // SE
  if (window.SFX) {
    if (item.kind === "affinity") SFX.select();
    else if (item.kind === "money-plus") SFX.coin();
    else if (item.kind === "stat") SFX.stamp();
  }
  // CSSアニメは合計約2.3s（in 0.45s + 待機 1.4s + out 0.45s）
  setTimeout(() => {
    card.remove();
    gainShowing--;
    flushGainQueue();
  }, 2350);
  // 次のバナーは少しずらして見せる
  setTimeout(flushGainQueue, 280);
}

function stars(value) {
  const n = Math.max(1, Math.min(5, Math.ceil(value / 20)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// 数値プレイヤーには見せない仕様だが、伸びた実感は欲しいので
// バッジには漢字一字、サブには「少し上がった」等の抽象表現を出す
const STAT_BADGE = { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "観" };

// 章ごとのステータス育成ソフトキャップ（#42）。ch1で上限に張り付かないよう抑え、
// 5章で全100＝完全攻略を狙えるカーブにする。数値は非表示なので体感は「★がゆっくり伸びる」
function statSoftCap() {
  // 上限を少し上げてスロット大当たりでも章途中でカンストしにくく（オーナー指摘）。ch5=100は維持
  return ({ 1: 48, 2: 66, 3: 82, 4: 96, 5: 100 })[state ? state.chapter : 1] || 100;
}

function gainStat(en, amount) {
  if (!(en in state.stats) || amount <= 0) return;
  const cap = statSoftCap();
  // 対象がその章の上限なら、未到達のステータスへ振り替える（伸び続ける実感を保つ）
  if (state.stats[en] >= cap) {
    const open = Object.keys(state.stats).filter((k) => state.stats[k] < cap);
    if (!open.length) return; // 全ステが章上限なら、今章はこれ以上伸びない
    en = open[Math.floor(Math.random() * open.length)];
  }
  const before = state.stats[en];
  state.stats[en] = Math.max(0, Math.min(cap, before + amount));
  if (state.stats[en] === before) return; // 実際に増えなかったら通知しない
  if (typeof REEL !== "undefined") REEL.noteStat(en, state.stats[en] - before); // 直近の伸びをスロットのアンコール抽選に記録
  const label = amount >= 5 ? "大きく上がった" : amount >= 3 ? "上がった" : "少し上がった";
  gainBanner({
    kind: "stat",
    badge: STAT_BADGE[en] || "上",
    labelTop: "STATUS UP",
    labelMain: STAT_KEYS[en],
    labelSub: label,
  });
}

// 恋人とのデート文脈でだけ恋人Lvが上がる（絆はプライベートで深める）
let dateContext = false;

// 好感度ポイントを加算し、段階が上がったらバナーを出す。
// 戻り値: 何かしら付与できたか（呼び出し側の報酬フォールバック判定に使う）
function gainAffinity(charId, kind = "visit") {
  if (!(charId in state.affinity)) return false;
  markMet(charId); // ポイントが動く＝面識がある
  const name = displayName(charId);
  const badge = faceIconHtml(charId) || (name.match(/[一-龯ぁ-んァ-ヴa-zA-Z]/) || ["♡"])[0];
  const pts = AFFINITY_PTS[kind] ?? AFFINITY_PTS.visit;
  // ---- 恋人: プライベート（デート/ちょい会い）でだけ恋人Lvポイントが動く
  if ((state.lovers || []).includes(charId)) {
    if (!dateContext) return false; // 店で会っても絆は深まらない（master_spec #24）
    if ((state.loveLevel[charId] || 0) >= AFFINITY_CAP) return false;
    state.lovePts[charId] = (state.lovePts[charId] || 0) + pts;
    const next = rankFromPts(state.lovePts[charId]);
    if (next > (state.loveLevel[charId] || 0)) {
      state.loveLevel[charId] = next;
      gainBanner({ kind: "affinity", badge, labelTop: "BOND UP", labelMain: name, labelSub: `恋人との絆が深まった（Lv.${next}）` });
    } else {
      gainBanner({ kind: "affinity", badge, labelTop: "BOND", labelMain: name, labelSub: "心の距離が少し近づいた" });
    }
    return true;
  }
  // ---- 通常: 内部ポイント加算 → 閾値で段階アップ
  if (state.affinity[charId] >= AFFINITY_CAP) return false;
  state.affinityPts[charId] = (state.affinityPts[charId] || 0) + pts;
  const rank = rankFromPts(state.affinityPts[charId]);
  if (rank > state.affinity[charId]) {
    state.affinity[charId] = rank;
    gainBanner({ kind: "affinity", badge, labelTop: "AFFINITY UP", labelMain: name, labelSub: "距離が縮まった気がする" });
  } else {
    gainBanner({ kind: "affinity", badge, labelTop: "AFFINITY", labelMain: name, labelSub: "少し打ち解けた気がする" });
  }
  // 好感度MAX到達 → 次にマップへ戻ったタイミングで告白イベント
  if (
    state.affinity[charId] >= AFFINITY_CAP &&
    ROMANCEABLE.includes(charId) &&
    !state.flags[`_friend_${charId}`] &&
    !(state.lovers || []).includes(charId)
  ) {
    state.flags._confession_due = charId;
  }
  return true;
}

// ---------------------------------------------------------------- romance
function becomeLovers(charId) {
  if (!state.lovers.includes(charId)) state.lovers.push(charId);
  state.loveLevel[charId] = state.loveLevel[charId] || 1;
  state.lovePts[charId] = Math.max(state.lovePts[charId] || 0, AFFINITY_RANK_PTS[1]);
  markMet(charId);
  gainBanner({
    kind: "affinity",
    badge: faceIconHtml(charId) || "♥",
    labelTop: "NEW RELATIONSHIP",
    labelMain: displayName(charId),
    labelSub: "恋人になった",
  });
  smokeRings(4); // 恋人成立の華
  // 2人目以降＝浮気状態。うしろめたさが積もり始める（ch3の修羅場の種）
  if (state.lovers.length >= 2) state.guilt = (state.guilt || 0) + 2;
  save();
}

// 行動の区切りで呼ぶ。好感度MAXのロマンス対象がいれば告白イベントを開始する。
// あげは以外は「主人公が踏み出すかどうか」の選択から始まる（master_spec #11）。
// next は告白イベント終了後の続き（昼夜の進行）
function maybeStartConfession(next) {
  const charId = state.flags._confession_due;
  if (!charId || state.phase !== "daily") return false;
  // 「まだ今は」を選んだ日はしばらく寝かせる（2日後に再打診）
  if ((state.flags._confession_wait || 0) > state.day) return false;
  delete state.flags._confession_due;
  if (state.lovers.includes(charId) || state.flags[`_friend_${charId}`]) return false;
  const done = () => { save(); next ? next() : showMap(); };
  const play = () => playDialogue(`confession_${charId}`, done);
  // あげはだけは向こうから来る（キャラ性として例外）。他は主人公の決断から
  const start = charId === "ageha" ? play : () => {
    playCustom({
      dialogue_id: `confession_gate_${charId}`,
      lines: [
        { speaker: "", face: "", text: `（……${displayName(charId)}のことを考えると、胸の奥がずっと落ち着かない。）` },
        { speaker: "", face: "", text: "（この気持ちに、名前をつけるなら——）" },
        { type: "choice", choices: [
          { text: "今日、想いを伝えよう", next: "go" },
          { text: "……まだ、今は胸にしまっておく", next: "wait" },
        ] },
      ],
      branches: {
        go: [{ type: "set_flag", flag: "_confession_go" }],
        wait: [{ speaker: "", face: "", text: "（大会のこと、店のこと。……今は目の前のことに集中しよう。でも、いつかきっと。）" }],
      },
    }, () => {
      if (state.flags._confession_go) {
        delete state.flags._confession_go;
        play();
      } else {
        // 後日もう一度きっかけが来る
        state.flags._confession_due = charId;
        state.flags._confession_wait = state.day + 2;
        done();
      }
    });
  };
  // すでに恋人がいる場合は、応える前に警告を挟む
  if (state.lovers.length > 0) {
    const current = state.lovers.map((id) => displayName(id)).join("、");
    playCustom({
      dialogue_id: `cheat_warning_${charId}`,
      lines: [
        { speaker: "", face: "", text: `（……今、${current}と付き合っている。）` },
        { speaker: "", face: "", text: "（この気持ちに応えれば──隠しごとがひとつ、増えることになる。それでも？）" },
        { type: "choice", choices: [
          { text: "それでも、気持ちに応えたい", next: "go" },
          { text: "……今は、目の前の人を大切にする", next: "stay" },
        ] },
      ],
      branches: {
        go: [{ speaker: "", face: "", text: "（胸の奥が、少しだけ重くなった気がした。）" }],
        stay: [{ speaker: "", face: "", text: "（気づかないふりをした。……この想いには、まだ答えを出さない。）" }],
      },
    }, () => {
      if (state.flags._cheat_go) {
        delete state.flags._cheat_go;
        state.guilt = (state.guilt || 0) + 1;
        play();
      } else {
        done();
      }
    });
    return true;
  }
  start();
  return true;
}

function addMoney(amount) {
  state.money = Math.max(0, state.money + amount);
  if (amount > 0) {
    gainBanner({
      kind: "money-plus",
      badge: "￥",
      labelTop: "MONEY",
      labelMain: `+${amount.toLocaleString()}円`,
      labelSub: "を受け取った",
    });
  } else if (amount < 0) {
    gainBanner({
      kind: "money-minus",
      badge: "￥",
      labelTop: "PAYMENT",
      labelMain: `-${(-amount).toLocaleString()}円`,
      labelSub: "を支払った",
    });
  }
  updateHud();
}

// 大会賞金は章が上がるほど桁が増える（世界に近づくほど一台の価値が跳ねる）。
// ch2は予選/準決の進出ボーナス（小額）＋決勝＝CHAPTER_PRIZE[2]。ch3/ch4は実装時に自動で効く
const CHAPTER_PRIZE = { 1: 30000, 2: 50000, 3: 100000, 4: 500000, 5: 0 };

// ---------- HUD ----------
const LOCATION_FROM_BG = {
  tonari_inside: ["シーシャラウンジ『tonari』", ""],
  tonari_outside: ["tonari 外", ""],
  tonari_night: ["シーシャラウンジ『tonari』", "夜"],
  tonari_day: ["シーシャラウンジ『tonari』", "昼"],
  shop: ["C.STATION", "大会会場"],
  tournament_stage: ["C.STATION", "本戦ステージ"],
  street_day: ["街中", "昼"],
  street_night: ["街中", "夜"],
  naru_shop: ["KEMURIKUSA", "なるの店"],
  adam_shop: ["EDEN", "アダムの店"],
  home: ["自宅", ""],
  map_local_day: ["栄エリア", "昼"],
  map_local_night: ["栄エリア", "夜"],
  title: ["タイトル", ""],
  kemurikusa: ["KEMURIKUSA", "なるの店"],
  eden: ["EDEN", "アダムの店"],
  pepermint: ["PEPERMINT", "みんとの店"],
};
function setLocationFromBg(rel) {
  const m = String(rel || "").match(/bg_([\w_]+?)\.png|^([\w_]+)\.png/);
  let key = "";
  if (m) key = (m[1] || m[2] || "").replace(/_(day|night)$/, (_, t) => t);
  // 末尾の day/night を別途分離
  const bgName = String(rel).split("/").pop() || "";
  const cleanName = bgName.replace(".png", "").replace(/^bg_/, "");
  const found = LOCATION_FROM_BG[cleanName];
  if (found) {
    $("#hud-location-main").textContent = found[0];
    $("#hud-location-sub").textContent = found[1];
  } else {
    $("#hud-location-main").textContent = "—";
    $("#hud-location-sub").textContent = "";
  }
}

function levelProxy() {
  // 5ステータスの平均から擬似レベルを出す（10〜100 → Lv.1〜10）
  const s = state ? state.stats : { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 };
  const avg = (s.technique + s.sense + s.guts + s.charm + s.insight) / 5;
  return Math.max(1, Math.min(99, Math.floor(avg / 10) + 1));
}

function updateHud() {
  if (!state) return;
  const hud = $("#hud");
  // タイトルではHUD非表示
  if (state.phase === "opening") { hud.classList.add("hidden"); return; }
  hud.classList.remove("hidden");

  // 行動回数の表示（旧 hud-day の場所）
  const hudDay = $("#hud-day");
  if (state.phase === "tournament") {
    const stage = state.chapter === 2 ? `・${CH2_STAGE_LABEL[state.ch2Stage] || ""}` : "";
    hudDay.textContent = `${cupName()} 当日${stage}`;
    hudDay.classList.remove("hidden");
  } else {
    const stageDay = nextStageDay();
    const left = daysUntilTournament();
    const what = state.chapter === 2 ? CH2_STAGE_LABEL[chapterInfo().stageDays[stageDay]] : "大会";
    hudDay.textContent = `DAY ${state.day} ／ ${what}まであと${left}日`;
    // ダイアログ中だけ薄く出す（マップでは大きな day-card に任せる）
    const isMap = document.querySelector("#screen-map.active");
    hudDay.classList.toggle("hidden", !!isMap);
  }
  // 体力ゲージ（数値は出さない。色で危険度を伝える）
  const stFill = $("#hud-stamina-fill");
  if (stFill) {
    const st = stamina();
    stFill.style.width = `${st}%`;
    stFill.classList.toggle("warn", st < 50 && st >= STAMINA_LOW);
    stFill.classList.toggle("danger", st < STAMINA_LOW);
  }
  // レベル
  const lv = levelProxy();
  $("#hud-level-text").textContent = `Lv.${lv}`;
  const s = state.stats;
  const avg = (s.technique + s.sense + s.guts + s.charm + s.insight) / 5;
  const pct = Math.min(100, ((avg / 10) - Math.floor(avg / 10)) * 100);
  $("#hud-level-fill").style.width = `${pct}%`;
  // マップ用 DAY カード
  updateDayCard();
}

// 大会まであと何日か。HUD・台詞・LIME の数字をここに一本化し、カレンダー（MAX_DAYS）が
// 変わっても表示が矛盾しないようにする（旧7日制の名残で台詞の日数がズレていた #35）
function daysUntilTournament() {
  if (!state || state.phase === "tournament" || state.phase === "cleared") return 0;
  const stageDay = nextStageDay();
  const left = state.chapter === 2 ? stageDay - state.day : stageDay + 1 - state.day;
  return Math.max(0, left);
}

// 台詞・LIME テキスト内の {daysLeft} トークンを実数に置換する。
// 静的な会話JSONに「あと3日」と直書きせず、ここで現在のカレンダーに合わせて差し込む
function interpolate(text) {
  if (text == null) return text;
  let t = String(text);
  if (t.indexOf("{daysLeft}") !== -1) t = t.split("{daysLeft}").join(String(daysUntilTournament()));
  return t;
}

// 日替わりの客のリクエスト傾向（バイトのオーダーチャレンジのテーマになる）
function dailyTheme() {
  return THEMES[(state.day - 1) % THEMES.length];
}

// DAYカードに出すスミさんの日替わりの一言（締切感の演出。day7/13の夜イベントを予告する）
const SUMI_QUOTES = [
  "初日から飛ばすな。一台ずつ、丁寧にな",
  "炭の置き方ひとつで味は変わるぞ",
  "迷ったら基本に戻れ。トライアングルだ",
  "人の煙を見るのも練習のうちだ",
  "たまには外の空気も吸え。出会いも仕込みのうちだ",
  "昨日と同じ一台を、今日も作れるか？　それが基礎だ",
  "今夜、お前の素の一台を見せてもらう",
  "折り返しだ。弱点から逃げるなよ",
  "疲れは煙に出る。今日は無理するな",
  "道具を磨け。腕より先に、道具が腐るぞ",
  "客の顔を思い出せ。誰に吸わせたい一台だ？",
  "そろそろ仕上げを意識しろ",
  "今夜は通しのリハーサルだ。そのつもりでな",
  "前日だ。新しいことはするな。いつも通りにやれ",
];
// 第2章のDAYカード（スミさんは焦るはじめを横目に、短く釘を刺す）
const CH2_SUMI_QUOTES = [
  "会場が変わったって、やることは変わらねえぞ",
  "周りを見るのはいい。睨むのは違う",
  "苺は熱に弱い。覚えとけ",
  "……最近のお前の煙、迷ってるな",
  "失敗は経験値だ。腐るのは別の話だがな",
  "お前の感情、煙に出てるぞ。お前の煙は正直だからな",
  "明日から本番だ。寝ろ",
  "勝った日ほど、丁寧に片付けろ",
  "誰のために作ってるか、忘れんなよ",
  "舌より先に、手が覚えてる。信じてやれ",
  "明日は二戦目か。──落ち着いていけ",
  "勝ち続けてる顔じゃねえな。……飯、食ってるか",
  "決勝前夜だ。客席なんか見るな。煙だけ見ろ",
  "──行ってこい",
];

function updateDayCard() {
  const isMap = document.querySelector("#screen-map.active");
  const card = $("#hud-day-card");
  card.classList.toggle("show", !!isMap && state && state.phase === "daily");
  if (!isMap || !state) return;
  $("#dc-day").textContent = state.day;
  // 大会最終日（章ごとに可変）を分母にする。7日固定だった旧UIの修正
  const dcMax = $("#dc-max");
  if (dcMax) dcMax.textContent = "/" + Math.max(...Object.keys(chapterInfo().stageDays).map(Number));
  $("#dc-week").textContent = state.ap === 2 ? "DAY" : "NIGHT";
  $("#dc-ap").textContent = (state.ap === 2 ? "昼" : "夜") + ` ${state.ap}`;
  $("#dc-money").textContent = state.money.toLocaleString();
  // 「今日の客層」は廃止（master_spec #18）。枠は体力の気配表示に転用
  const st = stamina();
  $("#dc-request").textContent = st >= 70 ? "体は軽い" : st >= STAMINA_LOW ? "すこし疲れ気味" : "かなり疲れている";
  const quotes = state.chapter === 2 ? CH2_SUMI_QUOTES : SUMI_QUOTES;
  $("#dc-quote").textContent = `スミ「${quotes[Math.min(Math.max(state.day, 1), quotes.length) - 1]}」`;
}

// 判定スタンプ演出
function showStamp(container, result) {
  const labels = { perfect: "PERFECT!", good: "GOOD", miss: "MISS…", just: "ジャスト！" };
  const st = document.createElement("div");
  st.className = `stamp stamp-${result}`;
  st.textContent = labels[result] || result;
  (container || $("#game")).appendChild(st);
  if (window.SFX) { SFX.stamp(); setTimeout(() => SFX[result] && SFX[result](), 120); }
  setTimeout(() => st.remove(), 950);
}

// メニュー選択時の「煙に包まれる」演出。煙の煤を画面下から立ちのぼらせて
// シーン切替を覆い隠す。完了は then(onMid) で受け取り、煙のピーク中で実行する
function engulfInSmoke(onMid) {
  const veil = $("#smoke-veil");
  veil.innerHTML = "";
  // 12個の煙パフを下からランダムに散らす
  for (let i = 0; i < 12; i++) {
    const p = document.createElement("div");
    p.className = "puff";
    const size = 280 + Math.random() * 380;
    p.style.width = p.style.height = `${size}px`;
    p.style.left = `${i * 8 + Math.random() * 14 - 8}%`;
    p.style.bottom = `${-30 - Math.random() * 18}%`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 16}vw`);
    p.style.animationDelay = `${i * 0.03 + Math.random() * 0.1}s`;
    veil.appendChild(p);
  }
  veil.classList.remove("engulf");
  void veil.offsetWidth;
  veil.classList.add("engulf");
  if (window.SFX) SFX.smoke();
  // 白く包まれてからひと呼吸おいて onMid（晴れていく中で次の画面が現れる）
  if (onMid) setTimeout(onMid, 1050);
  setTimeout(() => veil.classList.remove("engulf"), 2650);
}
// 煙ワイプの汎用API（master_spec #20）。pointer-events:none なので操作は止めない
function smokeWipe(onMid) { engulfInSmoke(onMid); }

// スモークリングのフラッシュ（勝利・ランクアップの華）。中央から輪が連続で抜ける
function smokeRings(n = 3) {
  const box = $("#smoke-veil");
  for (let i = 0; i < n; i++) {
    const ring = document.createElement("div");
    ring.className = "smoke-ring";
    ring.style.animationDelay = `${i * 0.22}s`;
    box.appendChild(ring);
    setTimeout(() => ring.remove(), 1600 + i * 220);
  }
}

// 日替わりカード（演出のみ・操作は止めない）
function showDayCard(big, sub) {
  const card = $("#day-card");
  card.querySelector(".day-big").textContent = big;
  card.querySelector(".day-sub").textContent = sub;
  card.classList.add("show");
  setTimeout(() => card.classList.remove("show"), 1400);
}

// ---------------------------------------------------------------- dialogue
// バックログ（LOG ボタンで参照）。直近 200 行を保持
const dialogueLog = [];
function pushLog(name, text) {
  if (!text) return;
  dialogueLog.push({ name, text });
  if (dialogueLog.length > 200) dialogueLog.shift();
}
function showLog() {
  const list = $("#log-list");
  list.innerHTML = "";
  if (!dialogueLog.length) {
    list.innerHTML = `<p class="log-empty">まだログがありません。</p>`;
  }
  for (const entry of dialogueLog) {
    const row = document.createElement("div");
    row.className = "log-row";
    row.innerHTML =
      (entry.name ? `<span class="log-name">${entry.name}</span>` : `<span class="log-name narration">──</span>`) +
      `<span class="log-text">${formatText(entry.text)}</span>`;
    list.appendChild(row);
  }
  $("#log-overlay").classList.add("visible");
  list.scrollTop = list.scrollHeight;
  if (window.SFX) SFX.open();
}

// 用語集（シーシャを知らない人向けの解説。data/glossary.json）
function showGlossary() {
  const groups = D.glossary || [];
  const tabs = $("#glossary-tabs");
  const list = $("#glossary-list");
  // グループをタブで切り替え、1グループずつ表示する（縦スクロールせず1画面に収める）
  const renderGroup = (gi) => {
    list.innerHTML = "";
    const group = groups[gi];
    if (!group) return;
    for (const t of (group.terms || [])) {
      const row = document.createElement("div");
      row.className = "glossary-row";
      row.innerHTML = `<span class="glossary-term">${t.term}</span><span class="glossary-desc">${t.desc}</span>`;
      list.appendChild(row);
    }
    list.scrollTop = 0;
    if (tabs) [...tabs.children].forEach((b, i) => b.classList.toggle("active", i === gi));
  };
  if (tabs) {
    tabs.innerHTML = "";
    groups.forEach((group, gi) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "glossary-tab";
      b.textContent = group.title;
      b.addEventListener("click", () => { if (window.SFX) SFX.select(); renderGroup(gi); });
      tabs.appendChild(b);
    });
  }
  renderGroup(0);
  $("#glossary-overlay").classList.add("visible");
  if (window.SFX) SFX.open();
}

// ---------------------------------------------------------------- config
const CONFIG_KEY = "shisha_config_v1";
const config = { textSpeed: 2, autoSpeed: 2, bgmVol: 100, sfxVol: 100, reelFx: "full" };

function loadConfig() {
  try { Object.assign(config, JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}")); } catch (e) { /* 壊れた設定は既定値で続行 */ }
  applyConfig();
}
function applyConfig() {
  if (window.SFX) {
    SFX.setBgmVolume(config.bgmVol / 100);
    SFX.setSfxVolume(config.sfxVol / 100);
  }
}
function saveConfig() {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (e) { /* file:// 等で失敗しても続行 */ }
}

function showConfig() {
  const body = $("#config-body");
  body.innerHTML = "";
  const seg = (label, key, opts) => {
    const row = document.createElement("div");
    row.className = "config-row";
    row.innerHTML = `<span class="config-label">${label}</span>`;
    const grp = document.createElement("div");
    grp.className = "config-seg";
    for (const [val, text] of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.classList.toggle("on", config[key] === val);
      b.addEventListener("click", () => {
        config[key] = val;
        saveConfig();
        for (const x of grp.children) x.classList.remove("on");
        b.classList.add("on");
        if (window.SFX) SFX.click();
      });
      grp.appendChild(b);
    }
    row.appendChild(grp);
    body.appendChild(row);
  };
  const slider = (label, key) => {
    const row = document.createElement("div");
    row.className = "config-row";
    row.innerHTML = `<span class="config-label">${label}</span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0"; input.max = "100"; input.value = String(config[key]);
    input.addEventListener("input", () => { config[key] = Number(input.value); saveConfig(); applyConfig(); });
    input.addEventListener("change", () => { if (window.SFX) SFX.click(); });
    row.appendChild(input);
    body.appendChild(row);
  };
  seg("テキスト速度", "textSpeed", [[1, "遅い"], [2, "普通"], [3, "速い"], [4, "瞬間"]]);
  seg("オート速度", "autoSpeed", [[1, "ゆっくり"], [2, "普通"], [3, "せっかち"]]);
  seg("スロット演出", "reelFx", [["full", "フル"], ["lite", "簡易"], ["off", "OFF"]]);
  slider("BGM音量", "bgmVol");
  slider("効果音 音量", "sfxVol");
  $("#config-overlay").classList.add("visible");
  if (window.SFX) SFX.open();
}

// ---------------------------------------------------------------- gallery
// CGの閲覧記録はセーブとは別に端末単位で持つ（周回しても消えない）
const GALLERY_KEY = "shisha_gallery_v1";
function gallerySeenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]")); } catch (e) { return new Set(); }
}
function galleryRecord(cgId) {
  const s = gallerySeenSet();
  if (s.has(cgId)) return;
  s.add(cgId);
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify([...s])); } catch (e) { /* 続行 */ }
}
function showGallery() {
  const grid = $("#gallery-grid");
  grid.innerHTML = "";
  const all = (D.cgs || []).slice().sort();
  if (!all.length) {
    grid.innerHTML = `<p class="gallery-empty">CGはまだ準備中……物語の更新をお楽しみに。</p>`;
  }
  const seen = gallerySeenSet();
  for (const id of all) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "gallery-cell";
    if (seen.has(id)) {
      const img = document.createElement("img");
      img.src = assetUrl(`assets/cgs/${id}.png`);
      img.alt = id;
      cell.appendChild(img);
      cell.addEventListener("click", () => {
        const v = $("#gallery-viewer");
        v.style.backgroundImage = `url('${assetUrl(`assets/cgs/${id}.png`)}')`;
        v.classList.add("visible");
        if (window.SFX) SFX.open();
      });
    } else {
      cell.classList.add("locked");
      cell.textContent = "？？？";
      cell.disabled = true;
    }
    grid.appendChild(cell);
  }
  $("#gallery-overlay").classList.add("visible");
  if (window.SFX) SFX.open();
}

// ---------------------------------------------------------------- save slots
const SAVE_SLOTS = [
  { key: SAVE_KEY, label: "オートセーブ", auto: true },
  { key: "shisha_ch1_slot1", label: "スロット 1" },
  { key: "shisha_ch1_slot2", label: "スロット 2" },
  { key: "shisha_ch1_slot3", label: "スロット 3" },
];
function readSlot(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    return data && data.day ? data : null;
  } catch (e) { return null; }
}
function showSaveLoad(mode) {
  $("#saveload-title").textContent = mode === "save" ? "セーブ" : "ロード";
  const box = $("#saveload-slots");
  box.innerHTML = "";
  for (const slot of SAVE_SLOTS) {
    const data = readSlot(slot.key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "saveslot";
    const when = data && data.savedAt ? new Date(data.savedAt).toLocaleString("ja-JP") : "";
    const info = data
      ? `DAY ${data.day} ／ ¥${(data.money || 0).toLocaleString()}${data.phase === "cleared" ? " ／ クリア済" : data.phase === "tournament" ? " ／ 大会当日" : ""}`
      : "── 空きスロット ──";
    btn.innerHTML =
      `<span class="saveslot-label">${slot.label}</span>` +
      `<span class="saveslot-info">${info}</span>` +
      `<span class="saveslot-date">${when}</span>`;
    if (mode === "save") {
      if (slot.auto) { btn.disabled = true; btn.classList.add("dim"); }
      else btn.addEventListener("click", () => {
        try { localStorage.setItem(slot.key, JSON.stringify({ ...state, savedAt: Date.now() })); } catch (e) { /* 続行 */ }
        if (window.SFX) SFX.select();
        toast(`${slot.label} にセーブした`);
        showSaveLoad("save"); // スロット表示を更新
      });
    } else {
      if (!data) { btn.disabled = true; btn.classList.add("dim"); }
      else btn.addEventListener("click", () => {
        $("#saveload-overlay").classList.remove("visible");
        toggleStatus(false);
        if (window.SFX) SFX.select();
        engulfInSmoke(() => {
          if (window.SFX) SFX.bgm("daily_part");
          continueGame(data);
        });
      });
    }
    box.appendChild(btn);
  }
  $("#saveload-overlay").classList.add("visible");
  if (window.SFX) SFX.open();
}

let engine = null;
let cueFiredInDialogue = false;
let visitContextChar = null; // 好感度キューの対象キャラ
let autoMode = false;
let skipMode = false;
let autoTimer = 0;

function stopAutoSkip() {
  autoMode = false; skipMode = false;
  clearInterval(autoTimer); autoTimer = 0;
  $("#vn-auto").classList.remove("on");
  $("#vn-skip").classList.remove("on");
  $("#tp-auto").classList.remove("on");
  $("#tp-skip").classList.remove("on");
  $("#touch-pad").classList.remove("lit");
}

function toggleAuto() {
  if (autoMode) { stopAutoSkip(); return; }
  stopAutoSkip();
  autoMode = true;
  $("#vn-auto").classList.add("on");
  $("#tp-auto").classList.add("on");
  $("#touch-pad").classList.add("lit");
  autoTimer = setInterval(() => {
    if (!engine || !$("#screen-dialogue").classList.contains("active")) return stopAutoSkip();
    if (engine.waitingChoice) return; // 選択肢で停止
    if (engine.typing) return; // タイプ中は待つ
    engine.next();
  }, { 1: 2200, 2: 1400, 3: 800 }[config.autoSpeed] || 1400);
}

function toggleSkip() {
  if (skipMode) { stopAutoSkip(); return; }
  stopAutoSkip();
  skipMode = true;
  $("#vn-skip").classList.add("on");
  $("#tp-skip").classList.add("on");
  $("#touch-pad").classList.add("lit");
  autoTimer = setInterval(() => {
    if (!engine || !$("#screen-dialogue").classList.contains("active")) return stopAutoSkip();
    if (engine.waitingChoice) return stopAutoSkip();
    if (engine.typing) engine.completeTyping();
    else engine.next();
  }, 60);
}

function parseTextCue(text) {
  if (!text.includes("上がった")) return;
  const m = text.match(/(技術|センス|根性|魅力|洞察|好感度)/g);
  if (!m) return;
  const big = text.includes("大きく上がった");
  const small = text.includes("少し上がった");
  const amount = big ? 5 : small ? 2 : 3;
  for (const ja of new Set(m)) {
    if (ja === "好感度") {
      if (visitContextChar) gainAffinity(visitContextChar);
      cueFiredInDialogue = true;
    } else if (STAT_JA2EN[ja]) {
      gainStat(STAT_JA2EN[ja], amount);
      cueFiredInDialogue = true;
    }
  }
}

function initEngine() {
  engine = new DialogueEngine(
    {
      bg: $("#vn-bg"),
      portraits: $("#vn-portraits"),
      nameLabel: $("#vn-name"),
      textLabel: $("#vn-text"),
      box: $("#vn-box"),
      choices: $("#vn-choices"),
      cg: $("#vn-cg"),
      advance: $("#vn-advance"),
    },
    {
      getStat: (en) => state.stats[en] || 0,
      interpolate: (t) => interpolate(t),
      onSceneEnd: () => { if (skipMode) stopAutoSkip(); }, // 会話が終わったらSKIP解除（シーン転換を飛ばさない・T29）
      portraitFaces: D.portraits,
      portraitTrims: D.portrait_trims,
      portraitScales: D.portrait_scales,
      charNames: D.char_names,
      getName: (id) => displayName(id),
      setFlag: (flag) => { state.flags[flag] = true; },
      // stat 以外の condition（ending.json の恋愛分岐など）の評価
      evalCondition: (line) => {
        if (line.condition_type === "has_romance_and_max_affection") {
          const id = String(line.char_id || "");
          return (state.lovers || []).includes(id) && (state.affinity[id] || 0) >= AFFINITY_CAP;
        }
        return false;
      },
      hasCg: (cgId) => (D.cgs || []).includes(cgId),
      getTextSpeed: () => config.textSpeed,
      onCg: galleryRecord,
      onLine: pushLog,
      onTextCue: parseTextCue,
      onChoice: handleDialogueChoice,
      onApply: (line) => {
        if (line.stats) for (const [k, v] of Object.entries(line.stats)) gainStat(k, v);
        if (line.money) addMoney(line.money);
        if (line.affinity) gainAffinity(line.affinity);
        cueFiredInDialogue = true;
      },
      onGameOver: () => {
        // 大会敗北の game_over は再挑戦できる敗北画面へ
        if (state && state.phase === "tournament" && tt) showDefeat(tt.rank || 4);
        else showScreen("#screen-gameover");
      },
      findDialogue: (id) => D.dialogues[id] || null,
      onBackgroundChange: (rel) => setLocationFromBg(rel),
    }
  );
  $("#vn-click-layer").addEventListener("click", () => {
    // 手動クリックは AUTO/SKIP を解除して次へ
    if (autoMode || skipMode) stopAutoSkip();
    if (window.SFX) SFX.click();
    engine.next();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && $("#screen-dialogue").classList.contains("active")) {
      e.preventDefault();
      engine.next();
    }
  });
}

function handleDialogueChoice(dialogueId, choiceId, branchKey, nextId) {
  // チョイザップ入会: 4,000円を支払いジム会員になる
  const isJoin =
    (dialogueId === "ch1_choizap_first" && branchKey === "register") ||
    (dialogueId === "choizap_retry" && branchKey === "go");
  if (isJoin) {
    addMoney(-4000);
    state.gymMember = true;
  }
  // 浮気警告: 「それでも応える」を選んだ
  if (dialogueId.startsWith("cheat_warning_") && branchKey === "go") state.flags._cheat_go = true;
  // 家シーシャ: 吸った夜を記録（連夜は効果が落ちる）
  if (dialogueId === "home_shisha_night" && branchKey === "puff") {
    state.homePuffLast = { chapter: state.chapter, day: state.day };
    addStamina(-STAMINA_COST.homePuff);
  }
  // 告白の結果（confession.json は next_id で accept/reject に分岐する）
  const m = /^confession_(\w+)_(accept|reject)$/.exec(nextId || "");
  if (m) {
    if (m[2] === "accept") becomeLovers(m[1]);
    else state.flags[`_friend_${m[1]}`] = true; // 友達のまま（以後この告白は出ない）
  }
}

function playDialogue(id, onDone, bgOverride) {
  const d = D.dialogues[id];
  if (!d) { console.warn("dialogue not found:", id); if (onDone) onDone(); return; }
  playCustom(d, onDone, bgOverride);
}

function playCustom(dialogue, onDone, bgOverride) {
  showScreen("#screen-dialogue");
  cueFiredInDialogue = false;
  if (bgOverride) engine.setBackground(bgOverride);
  if (state) updateHud();
  engine.start(dialogue, () => {
    engine.hideCg();
    if (onDone) onDone();
  });
}

// ---------------------------------------------------------------- daily loop
// tonari統合(#9): バイト・練習・スミさん・常連席(つむぎ) は「tonari」1スポットに集約（場所で管理）。
// マップでは tonari ピン → サブメニュー（showTonari）でどれをするか選ぶ。
const TONARI_SPOTS = [
  { id: "baito", label: "tonariでバイト", desc: "接客で稼ぐ。基本給＋オーダーの出来で売上ボーナス", cost: 0 },
  { id: "practice", label: "シーシャの練習", desc: "tonariの隅で腕を磨く", cost: 0 },
  { id: "sumi", label: "スミさんと話す", desc: "師匠の昔話と教え", cost: 0, charId: "sumi" },
  { id: "tsumugi", label: "常連席（つむぎ）", desc: "tonari常連の彼女の席へ", cost: 0, charId: "tsumugi" },
];
const SPOTS = [
  { id: "tonari", label: "tonari（お店）", desc: "バイト・練習・スミさん・常連席。今日は店で何をする？", cost: 0 },
  { id: "naru", label: "なるの店へ行く", desc: "ライバル店を偵察", cost: VISIT_COST, charId: "naru", chapter: 1 },
  { id: "adam", label: "アダムの店へ行く", desc: "ダブルアップル職人の店", cost: VISIT_COST, charId: "adam", chapter: 1 },
  { id: "minto", label: "みんとの店へ行く", desc: "コンカフェ風シーシャ屋へ", cost: VISIT_COST, charId: "minto", chapter: 1 },
  // 第2章のライバル店（章で出し分け）。神崎煙草店は2回通うと0分立ち上げ解放
  { id: "kumicho", label: "神崎煙草店へ行く", desc: "暖簾の奥にシーシャ。組長が一人で回す老舗", cost: VISIT_COST, charId: "kumicho", chapter: 2 },
  { id: "ageha", label: "アゲハの店へ行く", desc: "繁華街の派手な店。SNSで人気のギャル店主", cost: VISIT_COST, charId: "ageha", chapter: 2 },
  { id: "rei", label: "零-ZERO-へ行く", desc: "重いロックが鳴る薄暗い店", cost: VISIT_COST, charId: "rei", chapter: 2 },
  { id: "volk", label: "鉄の煙へ行く", desc: "計器だらけ。無愛想なロシア人の店", cost: VISIT_COST, charId: "volk", chapter: 2 },
  { id: "choizap", label: "チョイザップ", desc: "みんとに教えてもらったジム", cost: 0, requiresMet: "minto" },
  { id: "kannon", label: "観音堂", desc: "アダムに教えてもらった静かな場所", cost: 0, requiresMet: "adam" },
  { id: "cafe", label: "カフェ", desc: "なるおすすめのスパイスラテ", cost: 800, requiresMet: "naru" },
  { id: "c_station", label: "C.STATION", desc: "大会会場の下見に行く", cost: 0 },
  { id: "shop", label: "Dr.fookah", desc: "卸直営のショップ。機材・フレーバーが揃い、1階の試飲席で一応吸える（時間はかからない）", cost: 0 },
  { id: "rest", label: "家で休む", desc: "しっかり寝て明日に備える", cost: 0 },
];

// まだ会っていない店主・常連は名前を出さない（店名は看板で分かる）
const SPOT_UNKNOWN = {
  naru: { label: "KEMURIKUSAを覗く", desc: "隣町の人気店。若い店主が一人で回しているらしい" },
  adam: { label: "EDENを覗く", desc: "下町の店。焼き林檎みたいな甘い匂いが漏れている" },
  minto: { label: "PEPERMINTを覗く", desc: "繁華街のポップな店。SNSで人気らしい" },
  tsumugi: { label: "常連の子と話す", desc: "カウンターの奥、いつも同じ席にいる女の子" },
  kumicho: { label: "神崎煙草店を覗く", desc: "暖簾の奥にシーシャの気配。古い佇まいの老舗" },
  ageha: { label: "派手な店を覗く", desc: "繁華街の目立つ店。ギャルっぽい店主がいるらしい" },
  rei: { label: "零-ZERO-を覗く", desc: "重低音が漏れる薄暗い店。タトゥーの店主の噂" },
  volk: { label: "鉄の煙を覗く", desc: "計器だらけの不思議な店。外国人がやっているらしい" },
};

// 報酬キューが鳴らなかった場合の保険（全イベントに必ず報酬を付ける）
// キャラ別の「絡むと伸びる」主要ステータス（master_spec 新要望 / ch1〜4の配分）。
// 事前ヒント・訪問報酬・繰り返し報酬すべてこの表を正とする。全体では5種が満遍なく伸び、
// 通うキャラを偏らせれば特化もできる。ch1の6人だけで5種を一通りカバーする配分
const CHAR_STAT = {
  // ch1
  sumi: "technique", tsumugi: "sense", naru: "insight", adam: "guts", minto: "charm", rin: "sense",
  // ch2
  ageha: "sense", kumicho: "guts", rei: "charm", dr_kemuri: "insight",
  // ch3
  mashiro: "sense", mukai_master: "charm", nandi: "technique", steve: "insight", volk: "guts",
  // ch4
  master_hookah: "technique", sheikh: "charm", da_silva: "sense",
};
const SPOT_FALLBACK_STAT = {
  // 施設スポット（キャラ以外）。ch1で5種をさらに補完する
  kannon: "guts", cafe: "sense", c_station: "insight", choizap: "charm",
  // キャラは CHAR_STAT に委譲（このオブジェクトに無いキーは下のProxyで解決）
};
// スポット/キャラの主要ステータスを解決（CHAR_STAT→SPOT_FALLBACK_STAT→insight）
function spotStat(id) { return CHAR_STAT[id] || SPOT_FALLBACK_STAT[id] || "insight"; }

const VISIT_SEQUENCES = {
  sumi: ["ch1_sumi_tutorial", "ch1_sumi_basics", "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final"],
  tsumugi: ["ch1_tsumugi_first", "ch1_tsumugi_second", "ch1_tsumugi_third", "ch1_tsumugi_fourth", "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color"],
  naru: ["ch1_naru_first", "ch1_naru_second", "ch1_naru_third", "ch1_naru_fourth", "ch1_naru_fifth"],
  adam: ["ch1_adam_first", "ch1_adam_second", "ch1_adam_third", "ch1_adam_fourth", "ch1_adam_fifth"],
  minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_fourth", "ch1_minto_fifth"],
  // 第2章ライバル店（通うと交流が進む。神崎は2回目=ch2_kumicho_second で0分立ち上げ解放）
  ageha: ["ch2_ageha_first", "ch2_ageha_second", "ch2_ageha_third", "ch2_ageha_fourth", "ch2_ageha_fifth"],
  kumicho: ["ch2_kumicho_first", "ch2_kumicho_second", "ch2_kumicho_third", "ch2_kumicho_fourth"],
  rei: ["ch2_rei_first", "ch2_rei_second", "ch2_rei_third", "ch2_rei_fourth", "ch2_rei_fifth"],
  volk: ["ch2_volk_first", "ch2_volk_second", "ch2_volk_third", "ch2_volk_fourth"],
};

// 通い切ったあとの繰り返し訪問（必ず何かしらの報酬を付ける）
const REPEAT_VISIT = {
  sumi: { text: "スミさんの手元を眺めながら、何気ない話をした。炭の切り方ひとつにも年季がにじんでいる。", stats: { technique: 2 } },
  tsumugi: { text: "つむぎの席の近くで、煙の形の話をした。彼女の見ている世界は、少しだけ自分と違う。", stats: { sense: 2 } },
  naru: { text: "なるの店で一服。スピード勝負の段取りを盗み見る。鼻の良さに毎回気づかされる。", stats: { insight: 2 } },
  adam: { text: "アダムの店で一服。ダブルアップル一筋の頑固さに、芯の強さを感じる。", stats: { guts: 2 } },
  minto: { text: "みんとの店で一服。客あしらいの軽やかさは、やっぱり真似できない。", stats: { charm: 2 } },
  ageha: { text: "アゲハの店で一服。明るさに当てられて、こっちまで肩の力が抜ける。", stats: { sense: 2 } },
  kumicho: { text: "神崎煙草店で一服。組長と黙って同じ煙を吸うだけで、不思議と腹が据わる。", stats: { guts: 2 } },
  rei: { text: "零-ZERO-で一服。爆音の中、REIは何も言わない。でも、煙はやさしい。", stats: { charm: 2 } },
  volk: { text: "鉄の煙で一服。ヴォルクの精密な手つきを盗み見る。数字の裏に、職人の勘がある。", stats: { guts: 2 } },
};

// ============ LIME（朝のスマホ演出） ============
// data/lime_messages.json を朝（日付が変わった直後）にスマホUIで届ける。
// 招待(invitation)は受けると行動を消費せずイベントが起きる。

// LIMEを交換済みとみなす訪問回数（会話内で交換シーンがあるキャラはその回）
const LIME_EXCHANGE_VISITS = { naru: 2, adam: 3, minto: 1, tsumugi: 2, sumi: 1, rin: 2 };

// 連絡先を交換済みか（master_spec #26）。LIME配信は必ずこのゲートを通す。
// 交換は作中の出来事（訪問を重ねて親しくなる＝交換イベント相当）として起こる。
// 一度交換したら state.limeContacts に永続記録（訪問回数が0に戻っても保持）
function hasLimeContact(id) {
  if (!state) return false;
  if ((state.limeContacts || []).includes(id)) return true;
  // 会話内の明示的な交換ビート（set_flag _lime_contact_xxx）も交換成立とみなす
  if (state.flags[`_lime_contact_${id}`]) {
    state.limeContacts = state.limeContacts || [];
    if (!state.limeContacts.includes(id)) { state.limeContacts.push(id); save(); }
    return true;
  }
  // 訪問が交換のしきい値に達していれば交換成立（その瞬間に記録）
  if ((state.visits[id] || 0) >= (LIME_EXCHANGE_VISITS[id] || 1)) {
    state.limeContacts = state.limeContacts || [];
    if (!state.limeContacts.includes(id)) { state.limeContacts.push(id); save(); }
    return true;
  }
  return false;
}

// 恋人からのデートの誘い（プライベートで絆を深める。master_spec #24）。
// 行ける時間帯は昼/夜交互。受けても行動コマは消費しない
const DATE_INVITE_LINES = {
  tsumugi: ["あの……", "今度、よその店の煙、見に行きませんか", "はじめさんと……一緒がいい、です"],
  minto: ["ねえ、はじめくん", "……今度、その……二人で、よそのお店、行かない……？", "や、やっぱり迷惑だったら、いいの……！"],
  rin: ["モルモットくん、業務連絡", "よその店の煙を吸うのも勉強のうち。……付き合いなさい", "…………ま、ただのデートよ"],
  ageha: ["ハジメっち！！", "気になる店みつけた！ガチで雰囲気いいらしい！", "今日いこ！！バイブス上げてこ！！"],
};
const DATE_DECLINE_LINES = {
  tsumugi: "……はい。お忙しい、ですもんね。また、今度……",
  minto: "そ、そっか……うん、大丈夫。……また、誘うね……？",
  rin: "ふうん。……サンプルのくせに生意気。また連絡する",
  ageha: "りょ！またさそうわ！むりはだめだぞ〜！",
};
function makeDateInvite(charId, id) {
  return {
    id,
    sender: charId,
    type: "invitation",
    time_slot: state.day % 2 === 0 ? "night" : "noon",
    accept_event: `date_${charId}`,
    messages: DATE_INVITE_LINES[charId] || ["今日、少し会えない？"],
    decline_response: { text: DATE_DECLINE_LINES[charId] || "また今度ね" },
  };
}

function limeDueMessages(tournamentDay) {
  const due = [];
  for (const m of D.lime_messages || []) {
    const sender = m.sender;
    const cond = m.trigger_condition;
    // 噂（rumor）のうち、知り合い（affinity管理外＝業界の重鎮など）からのものだけ
    // ゲート無しで届く。知り合いからの噂は通常のLIME条件（交換済み等）に従う
    const outsiderRumor = m.type === "rumor" && !(sender in state.affinity);
    if (!outsiderRumor) {
      if (!(sender in state.affinity)) continue; // 登場済みキャラのみ
      // 連絡先を交換したキャラからしか届かない（master_spec #26 のガード）
      if (!hasLimeContact(sender)) continue;
    }
    // 章が違うメッセージは出さない（指定なしは第1章扱い。ch2_started 等は当該章扱い。
    // ch2の通常LIMEは離反演出のため流用しない）
    const msgChapter = m.chapter || (cond === "ch2_started" ? 2 : cond === "ch3_started" ? 3 : 1);
    if (msgChapter !== (state.chapter || 1)) continue;
    if (state.limeDone.includes(m.id)) continue;
    if (cond === "lime_exchanged") {
      // 指定日以降なら届く（同じ朝に同一人物から複数届く場合は翌朝以降へ繰り越す）
      if (tournamentDay || state.day < (m.trigger_day || 1)) continue;
    } else if (cond === "affinity_level") {
      if (tournamentDay || state.affinity[sender] < (m.trigger_value || 99)) continue;
    } else if (cond === "tournament_day") {
      if (!tournamentDay) continue;
    } else if (cond === "flag") {
      // デート（outing）翌朝のフォローLIMEなど、フラグ起動のメッセージ
      if (tournamentDay || !state.flags[m.trigger_flag]) continue;
    } else if (cond === "ch2_started" || cond === "ch3_started") {
      // 章開始トリガの噂LIME。trigger_day 指定があればその日以降の朝に届く
      if (tournamentDay) continue;
      if (m.trigger_day && state.day < m.trigger_day) continue;
    } else {
      continue; // 未対応の条件
    }
    due.push(m);
  }
  // 恋人からのデートの誘い（試合の朝には来ない）
  if (!tournamentDay) {
    for (const id of state.lovers || []) {
      if ((state.loveLevel[id] || 0) >= AFFINITY_CAP) continue;
      const last = state.lastDate[id] ?? -9;
      if (state.day - last < 3) continue; // 数日おき
      if (chapterInfo().stageDays[state.day]) continue;
      const inviteId = `_date_inv_${id}_d${state.day}`;
      if (state.limeDone.includes(inviteId)) continue;
      due.push(makeDateInvite(id, inviteId));
    }
  }
  // 同一キャラからは1日1話題まで（master_spec #7）。あふれた分は翌朝以降に繰り越し
  const seen = new Set();
  return due.filter((m) => {
    if (m.ignoreDailyLimit) return true;
    if (seen.has(m.sender)) return false;
    seen.add(m.sender);
    return true;
  });
}

let limeQueue = [];
let limeOnDone = null;
let limeAcceptedNoon = [];

// スマホUIを開くたびに前回の吹き出し・操作ボタン・未読/相手表示を消してから開く。
// （後日また開いた時、前日のスレッドが一瞬残って“そこから”始まって見える不具合の解消）
function resetPhoneDom() {
  const chat = $("#lime-chat");
  if (chat) { chat.innerHTML = ""; chat.scrollTop = 0; }
  if ($("#lime-actions")) $("#lime-actions").innerHTML = "";
  if ($("#lime-unread")) $("#lime-unread").textContent = "";
  if ($("#lime-peer-name")) $("#lime-peer-name").textContent = "";
  if ($("#lime-avatar")) $("#lime-avatar").innerHTML = "";
}

function morningPhone(onDone, opts = {}) {
  stopAutoSkip(); // LIMEはAUTO/SKIPで読み飛ばさせない（スキップがLIMEまで貫通する問題の解消）
  const due = limeDueMessages(!!opts.tournamentDay);
  if (!due.length) { if (onDone) onDone(); return; }
  limeQueue = due;
  limeOnDone = onDone || null;
  limeAcceptedNoon = [];
  $("#phone-time").textContent = opts.tournamentDay ? "AM 8:00" : "AM 7:30";
  $("#phone-day").textContent = opts.tournamentDay ? "大会当日" : `DAY ${state.day}`;
  resetPhoneDom(); // 前回のスレッドが800msの間チラ見えするのを防ぐ
  const ov = $("#phone-overlay");
  ov.classList.add("show");
  if (window.SFX) { SFX.open(); setTimeout(() => SFX.bubble(), 200); } // 通知音風
  setTimeout(nextLimeThread, 800);
}

function nextLimeThread() {
  const m = limeQueue.shift();
  if (!m) return closePhone();
  state.limeDone.push(m.id);
  save();
  $("#lime-chat").innerHTML = "";
  $("#lime-actions").innerHTML = "";
  $("#lime-peer-name").textContent = displayName(m.sender);
  $("#lime-avatar").innerHTML = faceIconHtml(m.sender, "lime-face") || "";
  $("#lime-unread").textContent = limeQueue.length ? `未読 ${limeQueue.length}` : "";
  const bubbles = (m.messages || []).map((b) => (typeof b === "string" ? b : b.text));
  let i = 0;
  const pump = () => {
    if (!$("#phone-overlay").classList.contains("show")) return;
    if (i < bubbles.length) {
      addLimeBubble("peer", bubbles[i++], m.sender);
      setTimeout(pump, 820);
      return;
    }
    showLimeActions(m);
  };
  setTimeout(pump, 350);
}

function addLimeBubble(side, text, sender) {
  const chat = $("#lime-chat");
  const row = document.createElement("div");
  row.className = `lime-row ${side}`;
  const avatar = side === "peer" && sender ? faceIconHtml(sender, "lime-face sm") || "" : "";
  row.innerHTML = `${avatar}<div class="lime-bubble">${formatText(interpolate(String(text)))}</div>`;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  if (window.SFX) SFX.bubble();
}

function addLimeNote(text) {
  const chat = $("#lime-chat");
  const note = document.createElement("div");
  note.className = "lime-note";
  note.textContent = text;
  chat.appendChild(note);
  chat.scrollTop = chat.scrollHeight;
}

function limeReplyButtons(list) {
  const box = $("#lime-actions");
  box.innerHTML = "";
  for (const item of list) {
    const btn = document.createElement("button");
    btn.className = "lime-reply";
    btn.type = "button";
    btn.textContent = item.text;
    btn.addEventListener("click", () => {
      if (window.SFX) SFX.select();
      box.innerHTML = "";
      item.onPick();
    });
    box.appendChild(btn);
  }
}

function showLimeActions(m) {
  if (m.type === "invitation") {
    // 初回だけ「システムの声」でルールを説明（誘いの透明性）
    if (!state.flags._sysnote_invite) {
      state.flags._sysnote_invite = true;
      addLimeNote("〜 誘いに乗ると行動を1回使う。そのぶん、ふつうに会いに行くより仲が深まりやすい。断っても嫌われたりはしない 〜");
    }
    limeReplyButtons([
      {
        text: "行く！（行動を1回使う）",
        onPick: () => {
          addLimeBubble("me", "行く！");
          if (m.time_slot === "night") {
            state.pendingLimeNight = { event: m.accept_event, sender: m.sender };
            save();
            setTimeout(() => { addLimeNote("今夜の約束ができた"); setTimeout(nextLimeThread, 1100); }, 600);
          } else {
            limeAcceptedNoon.push({ event: m.accept_event, sender: m.sender });
            setTimeout(() => { addLimeNote("このあと向かうことにした"); setTimeout(nextLimeThread, 1100); }, 600);
          }
        },
      },
      {
        text: "ごめん、今日は難しい",
        onPick: () => {
          addLimeBubble("me", "ごめん、今日は難しい");
          // デートの誘いを断ったら、少し間を置いてまた誘ってくれる
          if (String(m.accept_event || "").startsWith("date_")) {
            state.lastDate[m.sender] = state.day - 1;
          }
          const res = m.decline_response;
          setTimeout(() => {
            if (res) addLimeBubble("peer", res.text, m.sender);
            setTimeout(nextLimeThread, 1500);
          }, 800);
        },
      },
    ]);
    return;
  }
  if (Array.isArray(m.replies) && m.replies.length) {
    limeReplyButtons(m.replies.map((r) => ({
      text: r.text,
      onPick: () => {
        addLimeBubble("me", r.text);
        setTimeout(() => {
          addLimeBubble("peer", r.response, m.sender);
          // 返信は好感度ポイントになる（付与できない相手は魅力に振り替え）
          if (!gainAffinity(m.sender, "lime")) gainStat("charm", 2);
          setTimeout(nextLimeThread, 1700);
        }, 800);
      },
    })));
    return;
  }
  // 業界の噂（rumor）: 読むと洞察が伸びる（世界観のクロスオーバー演出）
  if (m.type === "rumor") {
    limeReplyButtons([
      {
        text: m.close_label || "へえ……（覚えておこう）",
        onPick: () => {
          gainStat("insight", 2);
          setTimeout(nextLimeThread, 500);
        },
      },
    ]);
    return;
  }
  // 返信無しのメッセージ（大会朝の応援など）: 読むだけで気合が入る
  limeReplyButtons([
    {
      text: m.close_label || "……よし",
      onPick: () => {
        if (!m.no_reward) gainStat("guts", 2);
        setTimeout(nextLimeThread, 500);
      },
    },
  ]);
}

// 任意のスレッドをスマホUIで見せる（朝以外のストーリー演出用）
function phoneShowCustom(threads, onDone, header = {}) {
  limeQueue = threads.slice();
  limeOnDone = onDone || null;
  limeAcceptedNoon = [];
  $("#phone-time").textContent = header.time || "PM 9:12";
  $("#phone-day").textContent = header.day || "";
  resetPhoneDom(); // 開く前に前回のスレッドを消す
  $("#phone-overlay").classList.add("show");
  if (window.SFX) { SFX.open(); setTimeout(() => SFX.bubble(), 200); }
  setTimeout(nextLimeThread, 800);
}

// 優勝の夜のスマホ: スミさんの採点表どんでん →「？？？」の不穏な通知。
// 「実力で勝った」という自己認識を、師匠の口から最初に揺らす。ch2の転落と
// ch5のチャコール博士まで効く縦糸を張る（突きつけ役をなる→スミさんへ・オーナー指定）
function postClearPhone(onDone) {
  phoneShowCustom([
    {
      id: "_sys_sumi_scoresheet",
      sender: "sumi",
      type: "chat",
      messages: [
        "おう。優勝、見事だった",
        "……で、だ。開示された採点表、もう見たか",
        "技術点も個性点も、お前は4人の中で下位だ。なるにも負けてる",
        "お前を勝たせたのは、南雲さんの「総合印象点」ひとつ。あの人が、お前にだけ満点をつけた",
        "勝ちは勝ちだ。今日のお前の煙が美味かったのも、嘘じゃない。──だが「実力で勝った」とは思うな",
        "あの一票が何だったのか。次の舞台までに、自分で答えを出せ",
      ],
      close_label: "……はい。ありがとうございます、スミさん",
      no_reward: true,
    },
    {
      id: "_sys_unknown_recorded",
      sender: "???",
      type: "chat",
      messages: [
        "SMOKE CROWN CUP 優勝、おめでとうございます。",
        "本日のあなたの試合データは、すべて記録させていただきました。",
        "炭の配置、蒸らし時間、引きの圧、提供時の所作。──実に興味深い。",
        "また、お会いしましょう。",
      ],
      close_label: "……誰？",
      no_reward: true,
    },
  ], onDone, { time: "PM 11:47", day: "優勝の夜" });
}

function closePhone() {
  $("#phone-overlay").classList.remove("show");
  if (window.SFX) SFX.close();
  const accepted = limeAcceptedNoon.slice();
  limeAcceptedNoon = [];
  const done = limeOnDone;
  limeOnDone = null;
  // 昼の約束はスマホを閉じた足でそのまま向かう。誘いに乗ると行動を1コマ使う
  // （そのぶん好感度が大きく上がる）。コマが尽きたら夜→翌日へ流れる
  const chain = (i) => {
    if (i >= accepted.length) { if (done) done(); return; }
    playLimeEvent(accepted[i].event, accepted[i].sender, () => {
      if (typeof REEL !== "undefined") REEL.onAction(); // 昼の誘いに乗った行動もスロットを回す(#33)
      state.ap = Math.max(0, state.ap - 1);
      updateHud();
      save();
      if (i + 1 < accepted.length && state.ap > 0) return chain(i + 1);
      if (state.ap <= 0) return endDay();
      if (done) done();
    }, true);
  };
  chain(0);
}

// LIME経由のイベント再生。会話内の報酬キューに加えて必ず好感度を付ける
function playLimeEvent(dialogueId, sender, after, viaInvite) {
  stopAutoSkip(); // 直前の会話でSKIP中でも、誘い/デート等のイベントは飛ばさず頭から見せる
  visitContextChar = sender;
  markMet(sender);
  // 誘い/イベントでそのキャラに会った日は、同じ店（spot）への通常訪問を不可にする
  // （誘いがあった日に同じ店へ2回行けてしまう問題の修正・#8）
  if (sender) state.dayVisited[sender] = state.day;
  // 恋人とのデート（date_xxx は動的生成、outing_xxx は既存イベント）は絆が深まる時間
  const isDate = dialogueId.startsWith("date_") || dialogueId.startsWith("outing_");
  if (isDate && (state.lovers || []).includes(sender)) dateContext = true;
  if (dialogueId.startsWith("date_")) {
    return playLoverDate(sender, () => {
      dateContext = false;
      visitContextChar = null;
      if (after) after();
    });
  }
  playDialogue(dialogueId, () => {
    const got = gainAffinity(sender, viaInvite ? "invite" : "event");
    if (!cueFiredInDialogue && !got) gainStat("insight", 2);
    // デート（outing）後は翌朝のフォローLIMEが届く
    if (dialogueId.startsWith("outing_")) state.flags[`_outing_done_${sender}`] = true;
    // 「教わった技」として大会本番の小ボーナスに使う
    state.flags[`_ev_${dialogueId}`] = true;
    dateContext = false;
    visitContextChar = null;
    if (after) after();
  });
}

// ============ 恋人とのデート（よその店を二人で巡る。コマ消費なし） ============
const DATE_VENUES = [
  { id: "kemurikusa", name: "KEMURIKUSA", bg: "kemurikusa.png", note: "スピード勝負の店の、迷いのない煙" },
  { id: "eden", name: "EDEN", bg: "eden.png", note: "ダブルアップル一筋の店の、深く甘い香り" },
  { id: "pepermint", name: "PEPERMINT", bg: "pepermint.png", note: "ポップな内装に、意外と丁寧な一台" },
  { id: "hideaway", name: "裏通りの隠れ家ラウンジ", bg: "bg_street_night.png", note: "看板のない店。常連だけが知る静けさ" },
];
// キャラの台詞（venue共通の骨格に、キャラの声を差し込む）
const DATE_SCENES = {
  tsumugi: {
    arrive: { face: "normal", text: "……来て、くれた。うれしい、です" },
    mid: { face: "smile", text: "（煙を目で追いながら）……ここの煙は、淡い水色。はじめさんの煙とは、ぜんぜん違う色……" },
    choiceQ: "（つむぎは煙の色の話を、ぽつりぽつりと続けている。）",
    optA: { text: "「俺の煙は、何色だった？」と聞く", line: "……内緒、です。……でも、好きな色", stat: "sense" },
    optB: { text: "黙って、同じ煙を目で追う", line: "（しばらくして）……一緒の煙、見てるの、いいですね", stat: "insight" },
    close: { face: "smile", text: "今日のこと……ノートに、描いてもいいですか。……二人の、記録" },
  },
  minto: {
    arrive: { face: "ura_normal", text: "……き、来ちゃった。えへへ……今日は、その、栞の方で……いい？" },
    mid: { face: "ura_normal", text: "（小さな声で）……お店のみんとだと、こういうの、できないから……。普通にデートって、初めてかも……" },
    choiceQ: "（隣の彼女は、店のテンションが嘘みたいに静かだ。）",
    optA: { text: "「素の栞さんの方が、好きだよ」と伝える", line: "～～っ。……そういうの、ほんとに、心臓に悪い……っ", stat: "charm" },
    optB: { text: "「店のみんとも栞さんも、どっちも本物でしょ」と言う", line: "……っ、う。……うん。……ありがと。……どっちも、私……", stat: "insight" },
    close: { face: "ura_smile", text: "……今日、誘ってよかった。……また、誘っても、いい……？" },
  },
  rin: {
    arrive: { face: "normal", text: "時間ぴったり。……ん、合格。じゃ、行くよモルモットくん" },
    mid: { face: "normal", text: "（一服して）……ふうん。立ち上げ早いのに香りが残ってる。盗みなさい、こういうのは" },
    choiceQ: "（凛さんは仕事の顔で煙を観察して——ふと、こちらを見た。）",
    optA: { text: "「今日は仕事抜きで、って言いませんでした？」とからかう", line: "……言ったわね。……じゃあ今のは無し。……隣、座って", stat: "charm" },
    optB: { text: "言われた通り、煙の立ち上げを観察する", line: "……真面目。……そういうとこ、嫌いじゃないけど。今日は私も見てよね", stat: "technique" },
    close: { face: "smile", text: "……今日のデータは上々。another sample, please——また付き合いなさい、って意味" },
  },
  ageha: {
    arrive: { face: "normal", text: "ハジメっち！こっちこっち！もう頼んじゃった！" },
    mid: { face: "smile", text: "見て見て、この煙の量！ヤバくない！？……でもハジメっちのが美味いわ、ガチで" },
    choiceQ: "（あげははホースを差し出してきた。「はい、回し吸い！」）",
    optA: { text: "受け取って、ゆっくり一服する", line: "……ふふ、間接……てのは置いといて！どう？この店のバイブス！", stat: "guts" },
    optB: { text: "「フィルター越しでも味は分かるよ」と職人ぶる", line: "でた職人モード！そういうとこ好きだけどね！ガチで！", stat: "sense" },
    close: { face: "smile", text: "今日チョー楽しかった！次はアタシが見つけたタコパもいくよ！覚悟しといて！" },
  },
};

function playLoverDate(charId, after) {
  const sc = DATE_SCENES[charId] || DATE_SCENES.tsumugi;
  // 行き先はデート回数でローテーション（自分の店・働く店は除外）
  const exclude = { minto: "pepermint", rin: "drfookah" }[charId];
  const venues = DATE_VENUES.filter((v) => v.id !== exclude);
  const venue = venues[((state.loveLevel[charId] || 1) + (state.lastDate[charId] || 0)) % venues.length];
  state.lastDate[charId] = state.day;
  const name = displayName(charId);
  playCustom({
    dialogue_id: `date_${charId}`,
    metadata: { bg: `res://assets/backgrounds/${venue.bg}` },
    lines: [
      { speaker: "", face: "", text: `約束の店——『${venue.name}』。${venue.note}。\n店先で、${name}が待っていた。` },
      { speaker: charId, face: sc.arrive.face, text: sc.arrive.text },
      { speaker: "", face: "", text: "二人で一台を頼んで、向かい合う。よその店の煙を、よその客として吸う時間。" },
      { speaker: charId, face: sc.mid.face, text: sc.mid.text },
      { speaker: "", face: "", text: sc.choiceQ },
      { type: "choice", choices: [
        { text: sc.optA.text, next: "a" },
        { text: sc.optB.text, next: "b" },
      ] },
      { speaker: charId, face: sc.close.face, text: sc.close.text },
      { speaker: "", face: "", text: "（よその店の煙も、隣にこの人がいると、ぜんぶ思い出の味になる。）" },
    ],
    branches: {
      a: [
        { speaker: charId, face: sc.arrive.face, text: sc.optA.line },
        { type: "apply", stats: { [sc.optA.stat]: 2 } },
      ],
      b: [
        { speaker: charId, face: sc.arrive.face, text: sc.optB.line },
        { type: "apply", stats: { [sc.optB.stat]: 2 } },
      ],
    },
  }, () => {
    const before = state.loveLevel[charId] || 0;
    gainAffinity(charId, "date");
    addStamina(-STAMINA_COST.date);
    save();
    // 恋人Lvが上がったら、そのレベルのマイルストーン恋愛イベントを解禁・再生
    maybeLoverMilestone(charId, before, after);
  });
}

// 恋人Lvが上がった節目に、固有の恋愛イベント（lover_events.json）を再生する。
// 2本目スロット（_b）があれば交互に。無ければ素通り
function maybeLoverMilestone(charId, beforeLv, after) {
  const lv = state.loveLevel[charId] || 0;
  if (lv <= beforeLv) { if (after) after(); return; }
  state.loverEventsSeen = state.loverEventsSeen || [];
  const candidates = [`lover_${charId}_lv${lv}`, `lover_${charId}_lv${lv}_b`];
  const id = candidates.find((c) => D.dialogues[c] && !state.loverEventsSeen.includes(c));
  if (!id) { if (after) after(); return; }
  state.loverEventsSeen.push(id);
  save();
  dateContext = true; // 恋愛イベント内の好感度キューも絆として扱う
  playDialogue(id, () => {
    dateContext = false;
    save();
    if (after) after();
  });
}

// 「恋人とちょい会い」: 1日1回・コマ消費なしの短い触れ合い（master_spec #24）
const LOVER_QUICK_LINES = {
  tsumugi: ["……顔、見れた。それだけで、今日はいい日です", "（隣に座って、しばらく同じ煙を見ていた。）"],
  minto: ["……えへへ。来てくれた。……それだけで、その、うれしい……", "（手をつなぐだけの、短い時間だった。）"],
  rin: ["なに、顔見に来ただけ？　……ふうん。悪くない習慣ね", "（5分だけ、と言いながら、コーヒーを出してくれた。）"],
  ageha: ["きた！！すきぴの顔！今日もかわちい！", "（写真を3枚撮られた。「待ち受けにする」らしい。）"],
};
function loverQuickMeet(charId) {
  state.loverQuickDay = state.day;
  dateContext = true;
  const lines = LOVER_QUICK_LINES[charId] || ["少しだけ、顔を見て話した。"];
  playCustom({
    dialogue_id: `lover_quick_${charId}`,
    lines: [
      { speaker: "", face: "", text: "（少しだけ、恋人の顔を見に行く。行動の合間の、ささやかな時間。）" },
      { speaker: charId, face: "smile", text: lines[0] },
      { speaker: "", face: "", text: lines[1] || "短い時間でも、会えるとぜんぜん違う。" },
    ],
  }, () => {
    gainAffinity(charId, "quick");
    // 恋人に会うと好感度に応じて体力が回復する（#41・コマは使わない）
    addStamina(12 + (state.affinity[charId] || 0) * 5);
    dateContext = false;
    save();
    showMap();
  });
}

// 行き先ピンの短い見出し。キャラのいる場所は顔ドット絵を優先し、
// 施設は日本語の略号（顔アイコンが無い場合のフォールバックも兼ねる）
const SPOT_ICONS = {
  tonari: "店", baito: "労", practice: "練", sumi: "師", tsumugi: "紬",
  naru: "鳴", adam: "亜", minto: "緑", choizap: "筋",
  kumicho: "崎", ageha: "蝶", rei: "零", volk: "鉄",
  kannon: "観", cafe: "珈", c_station: "C", shop: "店", rest: "休",
};
const SPOT_FACE = { tonari: "sumi", sumi: "sumi", tsumugi: "tsumugi", naru: "naru", adam: "adam", minto: "minto" };

// マップ上のピン位置（%）と短いラベル名
const SPOT_LAYOUT = {
  tonari:    { x: 16, y: 50, theme: "baito",   short: "tonari",     area: "tonari" },
  naru:      { x: 42, y: 22, theme: "rival",   short: "KEMURIKUSA", area: "繁華街" },
  adam:      { x: 56, y: 30, theme: "rival",   short: "EDEN",       area: "下町" },
  minto:     { x: 70, y: 22, theme: "rival",   short: "PEPERMINT",  area: "繁華街" },
  kumicho:   { x: 40, y: 24, theme: "rival",   short: "神崎煙草店", area: "旧市街" },
  ageha:     { x: 58, y: 20, theme: "rival",   short: "AGEHA",      area: "繁華街" },
  rei:       { x: 72, y: 32, theme: "rival",   short: "零-ZERO-",   area: "ライブ通り" },
  volk:      { x: 50, y: 38, theme: "rival",   short: "鉄の煙",     area: "工業地区" },
  choizap:   { x: 50, y: 50, theme: "shop",    short: "チョイザップ", area: "ジム" },
  kannon:    { x: 78, y: 56, theme: "park",    short: "観音堂",     area: "古町" },
  cafe:      { x: 64, y: 64, theme: "cafe",    short: "カフェ",     area: "繁華街" },
  c_station: { x: 84, y: 36, theme: "stadium", short: "C.STATION",  area: "会場" },
  shop:      { x: 36, y: 40, theme: "shop",    short: "Dr.fookah",  area: "問屋街" },
  rest:      { x: 88, y: 60, theme: "rest",    short: "家",         area: "自宅" },
};

function showMap(opts = {}) {
  state.phase = "daily";
  if (window.SFX) SFX.bgm("daily_part");
  showScreen("#screen-map");
  const night = state.ap <= 1;
  $("#map-image").style.backgroundImage =
    `url('${assetUrl(`assets/backgrounds/bg_map_local_${night ? "night" : "day"}.png`)}')`;
  $("#map-time-toggle").textContent = night ? "夜 / 栄" : "昼 / 栄";
  updateHud();

  const pins = $("#map-pins");
  pins.innerHTML = "";
  for (const spot of SPOTS) {
    if (spot.chapter && spot.chapter !== state.chapter) continue; // 章限定スポット（ch1/ch2でライバル店を出し分け）
    const layout = SPOT_LAYOUT[spot.id];
    if (!layout) continue;
    const btn = document.createElement("button");
    btn.className = `spot-pin spot-btn pin-${layout.theme}`;
    btn.style.left = `${layout.x}%`;
    btn.style.top = `${layout.y}%`;
    // テキストは「{label}」を含む（テストで hasText 検索される）
    const locked = spot.requiresMet && state.visits[spot.requiresMet] === 0;
    const tooPoor = spot.cost > state.money;
    const closed = closureInfo(spot.id);
    const visited = spot.charId && state.dayVisited[spot.charId] === state.day;
    const known = !spot.charId || isMet(spot.charId);
    const un = !known && SPOT_UNKNOWN[spot.id];
    if (locked) {
      btn.classList.add("locked");
      btn.innerHTML = `<div class="shield"><div class="ico">？</div><div class="label">？？？</div></div>`;
      btn.disabled = true;
      btn.dataset.label = "未開放";
    } else {
      const face = known && SPOT_FACE[spot.id] && faceIconHtml(SPOT_FACE[spot.id], "pin-face");
      const subText = closed ? `本日${closed}` : visited ? "今日はもう行った" : (un ? un.label : spot.label);
      btn.innerHTML =
        `<div class="shield">` +
          `<div class="ico">${face || (un ? "煙" : SPOT_ICONS[spot.id] || "")}</div>` +
          `<div class="label">${layout.short}</div>` +
        `</div>` +
        `<div class="sub-label${closed || visited ? " closed-tag" : ""}">${subText}</div>`;
      if (tooPoor || closed || visited) btn.disabled = true;
      if (closed || visited) btn.classList.add("closed");
    }
    btn.addEventListener("mouseenter", () => updateMapInfo(spot, locked, tooPoor, closed, visited));
    btn.addEventListener("focus", () => updateMapInfo(spot, locked, tooPoor, closed, visited));
    btn.addEventListener("click", () => { if (!btn.disabled) selectSpot(spot); });
    pins.appendChild(btn);
  }
  // 恋人とのちょい会い（1日1回・行動コマを使わない）
  if ((state.lovers || []).length && state.loverQuickDay !== state.day) {
    const quick = document.createElement("button");
    quick.className = "lover-quick-btn";
    quick.id = "lover-quick";
    quick.innerHTML = `<span class="lq-heart">♥</span><span>恋人に会いに行く<small>コマを使わない・1日1回</small></span>`;
    quick.addEventListener("click", () => {
      const lovers = state.lovers.slice();
      if (lovers.length === 1) return loverQuickMeet(lovers[0]);
      // 複数恋人（浮気状態）なら誰に会うか選ぶ
      playCustom({
        dialogue_id: "lover_quick_pick",
        lines: [
          { speaker: "", face: "", text: "（……少しだけ顔を見に行こう。誰のところへ？）" },
          { type: "choice", choices: lovers.map((id, i) => ({ text: displayName(id), next: `l${i}` })) },
        ],
        branches: Object.fromEntries(lovers.map((id, i) => [`l${i}`, [{ type: "set_flag", flag: `_lq_${id}` }]])),
      }, () => {
        const picked = lovers.find((id) => state.flags[`_lq_${id}`]);
        for (const id of lovers) delete state.flags[`_lq_${id}`];
        if (picked) loverQuickMeet(picked);
        else showMap();
      });
    });
    pins.appendChild(quick);
  }
  updateMapInfo(null);
  save();
  // たまったスロット結果をマップ表示時に精算（非ブロッキング）。
  // skipReel 指定時は精算を保留（advanceDay が朝のLIMEの後で回す #34）。
  // DAYカード表示中は被るので、カードが消えてから回す（#11 「DAY表示中にスロットが回る」）
  if (!opts.skipReel && typeof REEL !== "undefined") {
    // 夜のスロットは「日付変更画面（DAYカード）」が消えてから回す＝被って見えない問題の解消(#34/T30)。
    // カードが出ている間はポーリングで待ち、消えたら回す
    const drainReel = () => {
      if (document.querySelector("#day-card.show")) { setTimeout(drainReel, 250); return; }
      REEL.onMapShown();
    };
    drainReel();
  }
  mapTutorial(); // 初回だけマップの使い方を点滅で案内（#36）
}

// 初めてマップに出たときだけ、機能を点滅つきで一度だけ説明する（#36）。
// クリックを邪魔しない（pointer-events:none・タップか数秒で消える）＝自動テストも止めない
function mapTutorial() {
  if (!state || state.flags._map_tutorial_done) return;
  const screen = document.querySelector("#screen-map");
  if (!screen || !screen.classList.contains("active")) return;
  state.flags._map_tutorial_done = true; save();
  // 主要ピンを点滅させて注意を引く
  screen.querySelectorAll("#map-pins .spot-pin:not(:disabled)").forEach((p, i) => {
    if (i < 4) { p.classList.add("tut-pulse"); setTimeout(() => p.classList.remove("tut-pulse"), 6200); }
  });
  const ov = document.createElement("div");
  ov.id = "map-tutorial";
  ov.innerHTML =
    `<div class="mt-card">` +
    `<p class="mt-title">ここがマップ</p>` +
    `<p class="mt-body">行きたい場所をタップして、1日2回うごこう。<br>` +
    `<b>バイト</b>でお金、<b>練習</b>でスキル、<b>人に会う</b>と好感度。<br>` +
    `行ける場所は明るいピン、暗いピンはまだ解放前。大会の日までに、できることを。</p>` +
    `<p class="mt-tap">（タップで閉じる）</p></div>`;
  screen.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("show"));
  const close = () => { ov.classList.remove("show"); setTimeout(() => ov.remove(), 350); screen.removeEventListener("click", close, true); };
  setTimeout(close, 7000);
  setTimeout(() => screen.addEventListener("click", close, true), 400); // 少し置いてからタップで閉じられる
}

function updateMapInfo(spot, locked, tooPoor, closed, visited) {
  if (!spot) {
    $("#map-info-title").textContent = state.ap === 2 ? "今日はどうする？" : "夜の時間";
    $("#map-info-desc").textContent = "気になる場所をタップ。残り行動と所持金に注意。";
    $("#map-info-cost").textContent = "";
    const tired = staminaLow() ? "　⚠ 体が重い。今日は無理しない方がいい" : "";
    $("#map-info-hint").textContent =
      (state.ap === 2 ? "昼 — 今日は2回動ける" : "夜 — 今日はあと1回動ける") + tired;
    return;
  }
  const layout = SPOT_LAYOUT[spot.id] || {};
  const known = !spot.charId || isMet(spot.charId);
  const un = !known && SPOT_UNKNOWN[spot.id];
  $("#map-info-title").textContent = locked ? "？？？" : (layout.area || spot.label);
  $("#map-info-desc").textContent = locked
    ? "まだ知らない場所。誰かに教えてもらえそうな気がする。"
    : (un ? un.desc : spot.desc);
  $("#map-info-cost").textContent = locked
    ? ""
    : (spot.cost > 0 ? `所持金から ¥${spot.cost.toLocaleString()} 必要` : "");
  $("#map-info-hint").textContent = locked
    ? "ロック中"
    : closed ? `今日は${closed}。また明日にしよう`
    : visited ? "今日はもう顔を出した。また明日"
    : tooPoor ? "所持金が足りない"
    : `タップして移動: ${un ? un.label : spot.label}`;
  // 事前に「何が伸びそうか」を主人公の見立てとして示す（master_spec 新要望）
  const hintStat = !locked && (CHAR_STAT[spot.id] || SPOT_FALLBACK_STAT[spot.id]);
  const growEl = $("#map-info-grow");
  if (growEl) {
    if (hintStat && !visited && !closed) {
      const allMax = Object.values(state.stats).every((v) => v >= 100);
      growEl.textContent = allMax
        ? "（ここで学べることは、もう全部わが身になった）"
        : CHAR_STAT[spot.id]
          ? `（ここに通うと【${STAT_KEYS[hintStat]}】が伸びそうだ）`
          : `（集中特訓だから、人に会うより【${STAT_KEYS[hintStat]}】がぐっと伸びる）`;
      growEl.style.display = "";
    } else {
      growEl.style.display = "none";
    }
  }
}

function selectSpot(spot) {
  const proceed = () => {
    if (spot.cost > 0) addMoney(-spot.cost);
    switch (spot.id) {
      case "tonari": return showTonari(); // tonari統合(#9): 中で何をするか選ぶ（行動はサブ選択時に消費）
      case "baito": return shishaGuard(() => doBaito());
      case "practice": return shishaGuard(() => startPractice());
      case "choizap": return doChoizap();
      case "kannon": return doSpotDialogue("kannon", "ch1_kannon_visit", "bg_street_day.png");
      case "cafe": return doSpotDialogue("cafe", "ch1_cafe_visit", "bg_street_day.png");
      case "c_station": return doSpotDialogue("c_station", "ch1_c_station_visit", "bg_shop.png");
      case "shop": return showFookahMenu(); // Dr.fookah: 物販利用 or 凛＋ブース を選ぶ(T28)
      case "rest": return doRest();
      default: {
        // よその店での一服は体力を使う（tonari内のスミさん・つむぎとの会話は軽い）
        const heavySmoke = ["naru", "adam", "minto", "kumicho", "ageha", "rei", "volk"].includes(spot.id);
        return heavySmoke ? shishaGuard(() => doVisit(spot.id)) : doVisit(spot.id);
      }
    }
  };
  // キャラ訪問: 好感度が上限まで来ていたら、行く前にひと言（master_spec の最大警告）
  if (spot.charId) return maybeVisitWarning(spot.charId, proceed, () => showMap());
  proceed();
}

// tonari統合(#9): tonari の中で「バイト/練習/スミさん/常連席」を選ぶサブメニュー。
// マップ上にオーバーレイで出す（pointer-eventsは効かせる＝選ぶ）。選んだら selectSpot に委譲＝既存の流儀・警告・行動消費をそのまま使う
function showTonari() {
  document.getElementById("tonari-menu")?.remove();
  const screen = document.querySelector("#screen-map");
  if (!screen) return;
  if (window.SFX) SFX.open();
  const ov = document.createElement("div");
  ov.id = "tonari-menu";
  ov.innerHTML =
    `<div class="tn-menu-card">` +
    `<p class="tn-menu-title">tonari ── 今日は店で何をする？</p>` +
    `<div class="tn-menu-list" id="tonari-list"></div>` +
    `<button class="primary-btn ghost tn-close" id="tonari-close">← マップに戻る</button>` +
    `</div>`;
  screen.appendChild(ov);
  const list = ov.querySelector("#tonari-list");
  for (const spot of TONARI_SPOTS) {
    const visited = spot.charId && state.dayVisited[spot.charId] === state.day;
    const known = !spot.charId || isMet(spot.charId);
    // つむぎは未紹介でも「常連席」の場所は分かる（名前だけ伏せる）＝ラベルに常連席を残す
    const label = (spot.id === "tsumugi" && !known) ? "常連席（いつもの常連の子）" : spot.label;
    const desc = visited ? "今日はもう行った" : (!known && SPOT_UNKNOWN[spot.id] ? SPOT_UNKNOWN[spot.id].desc : spot.desc);
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML = `<span class="spot-name">${label}</span><span class="spot-desc">${desc}</span>`;
    if (visited) btn.disabled = true;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      ov.remove();
      selectSpot(spot);
    });
    list.appendChild(btn);
  }
  ov.querySelector("#tonari-close").addEventListener("click", () => { if (window.SFX) SFX.close(); ov.remove(); });
  requestAnimationFrame(() => ov.classList.add("show"));
}

// 好感度MAX/恋人の店に通おうとした時の事前確認。
// 特別イベント（告白due等）が控えている場合は黙って通す
function maybeVisitWarning(charId, proceed, cancel) {
  if (!(charId in (state.affinity || {}))) return proceed();
  const seq = VISIT_SEQUENCES[charId];
  const seqDone = !seq || state.visits[charId] >= seq.length;
  if (!seqDone) return proceed(); // 未読の会話が残っているなら止めない
  if (state.flags._confession_due === charId) return proceed();
  const isLover = (state.lovers || []).includes(charId);
  const maxed = (state.affinity[charId] || 0) >= AFFINITY_CAP;
  if (!isLover && !maxed) return proceed();
  const name = displayName(charId);
  const msg = isLover
    ? `（${name}は恋人だ。でも店では、店員と客。ここで会っても絆は深まらない——\n絆を深めるなら、プライベートの時間だ。それでも顔を見たい気持ちはあるけど。）`
    : `（${name}との仲は、もう十分に深い。ここから先、通っても好感度はこれ以上上がらない。）`;
  playCustom({
    dialogue_id: `visit_warning_${charId}`,
    lines: [
      { speaker: "", face: "", text: msg },
      { type: "choice", choices: [
        { text: "それでも顔を見に行く（学びはある）", next: "go" },
        { text: "やめておく", next: "stay" },
      ] },
    ],
    branches: {
      go: [{ type: "set_flag", flag: "_visit_warn_go" }],
      stay: [{ speaker: "", face: "", text: "（……今日は別のことをしよう。）" }],
    },
  }, () => {
    if (state.flags._visit_warn_go) {
      delete state.flags._visit_warn_go;
      proceed();
    } else {
      cancel ? cancel() : showMap();
    }
  });
}

function doSpotDialogue(spotId, dialogueId, bg) {
  visitContextChar = null;
  // シーシャと無関係の場所は息抜きになる（体力小回復）
  if (STAMINA_GAIN[spotId]) addStamina(STAMINA_GAIN[spotId]);
  playDialogue(dialogueId, () => {
    if (!cueFiredInDialogue) gainStat(spotStat(spotId), 2);
    // 施設スポット＝「集中特訓」: 好感度は付かない代わりに、人に会うより伸びが大きい（#23）
    gainStat(spotStat(spotId), 3);
    endAction();
  }, `res://assets/backgrounds/${bg}`);
}

function endAction() {
  // 1行動=1回転（パッキーの謎スロット）。結果はこの場で確定し、直後の save() に乗る＝引き直し不可（#12）
  if (typeof REEL !== "undefined") REEL.onAction();
  state.ap -= 1;
  updateHud();
  save();
  const resume = () => {
    if (state.ap > 0) {
      // LIMEで「夜に行く」と約束していたら、夜はその約束に向かう（夜のコマを使う）
      if (state.pendingLimeNight) {
        const p = state.pendingLimeNight;
        state.pendingLimeNight = null;
        save();
        // 昼の用事が終わってから夜の約束へ。即切り替えると唐突なので時間が流れる一拍を挟む（違和感の解消）
        showDayCard("夕暮れ", "約束の時間だ");
        return setTimeout(() => playLimeEvent(p.event, p.sender, () => {
          if (typeof REEL !== "undefined") REEL.onAction(); // 夜の約束もひとつの行動＝スロットを回す(#33)
          state.ap = 0;
          save();
          endDay();
        }, true), 1500);
      }
      return showMap();
    }
    endDay();
  };
  // 好感度MAXのロマンス対象がいれば、行動の区切りで告白イベント（行動は消費しない）
  if (maybeStartConfession(resume)) return;
  resume();
}

// 翌朝へ進める共通処理（試合日の判定を含む）。ch2の試合後にも使う
function advanceDay() {
  if (state.chapter === 1 && state.day >= MAX_DAYS) {
    // ch1 大会当日の朝: 応援LIMEが届く
    return morningPhone(() => startTournament(), { tournamentDay: true });
  }
  // 就寝の自然回復。寝る前に空っぽ＋無理を重ねていたら翌朝は風邪で1日休み
  const exhausted = stamina() <= 0 || (state.flags._overwork || 0) >= 2;
  addStamina(STAMINA_GAIN.sleep);
  state.day += 1;
  state.ap = 2;
  delete state.flags._rested_today; // 「体力に余裕」は日をまたいだらリセット
  save();
  if (exhausted) {
    state.flags._overwork = 0;
    showDayCard(`DAY ${state.day}`, "……熱っぽい");
    return playCustom({
      dialogue_id: "sick_day",
      metadata: { bg: "res://assets/backgrounds/bg_home.png" },
      lines: [
        { speaker: "", face: "", text: "朝。喉の奥が痛い。額に手を当てると、じんわり熱い。——風邪だ。" },
        { speaker: "hajime", face: "sad", text: "（……無理が祟った。今日は、休むしかない）" },
        { speaker: "", face: "", text: "水だけ飲んで、布団に戻る。スマホを枕元に置いて、目を閉じた。\n一日、ゆっくり眠った。" },
        { type: "apply", stats: { guts: 2 } },
      ],
    }, () => {
      state.stamina = Math.max(stamina(), 80);
      state.ap = 0;
      endDay();
    });
  }
  // ch2: 試合日（予選・準決勝・決勝）は行動なしでそのまま会場へ
  const stage = state.chapter === 2 ? chapterInfo().stageDays[state.day] : null;
  if (stage) {
    // すぐ会場の会話へ移る（マップを操作可能なまま放置しない）。DAYカードは上に重なる
    showDayCard(`DAY ${state.day}`, `${cupName()} ${CH2_STAGE_LABEL[stage]} 当日`);
    return startCh2Stage(stage);
  }
  const stageDay = nextStageDay();
  // ch2の試合はその日のうちに行われる（行動なし）ので残日数は前日基準
  const left = daysUntilTournament();
  const what = state.chapter === 2 ? CH2_STAGE_LABEL[chapterInfo().stageDays[stageDay]] : cupName();
  showDayCard(`DAY ${state.day}`, left === 1 ? `${what} 前日` : `${what}まで あと${left}日`);
  // 昨日の行動のスロットは、DAYカード→朝のLIMEを消化してから回す（被って見えない問題の解消 #34/#23）
  showMap({ skipReel: true });
  morningPhone(showMap); // 朝のLIME（無ければ即 showMap がスロットを精算）
}

// #16: 強制イベントの前に「マップに戻る→スロット精算→自動で次イベント」の一拍を挟む（オーナー指定）。
// 行動の結果画面からシームレスに夜イベントへ飛ぶ「急に画面が変わった」感を消す。
// 非操作のオーバーレイで一拍置き、タップで早送り可。テストは #map-beat を検出して飛ばす。
function mapBeat(onDone) {
  if (!state) return onDone();
  showMap(); // マップ表示＋スロット精算（REEL.onMapShown）
  const screen = document.querySelector("#screen-map");
  if (!screen) return onDone();
  document.getElementById("map-beat")?.remove();
  const ov = document.createElement("div");
  ov.id = "map-beat";
  ov.innerHTML = `<div class="map-beat-card"><span class="mb-dots">……</span><span class="mb-sub">タップで次へ</span></div>`;
  screen.appendChild(ov);
  let done = false;
  const go = () => { if (done) return; done = true; ov.remove(); onDone(); };
  ov.addEventListener("click", go);
  setTimeout(go, 2100);
}

function endDay() {
  // 夜の締め: 必ず家に帰って1日を終える（master_spec #3）。
  // 家シーシャ（第2章〜・一式所持時）はその帰宅シーンの中で選択肢になる
  const finishDay = () => maybeNightcap(advanceDay);
  // 夜の強制イベントは mapBeat（つなぎの一拍）を通してから再生する（#16）
  const pd = (id, cb, bg) => mapBeat(() => playDialogue(id, cb, bg));
  const pc = (obj, cb) => mapBeat(() => playCustom(obj, cb));
  const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
  // ---- 第2章の夜の固定イベント（嫉妬と転落の進行）
  if (state.chapter === 2) {
    if (state.day === 2 && !state.flags._ev2_abyss) {
      state.flags._ev2_abyss = true;
      return pd("ch2_abyss_baito", finishDay, TONARI);
    }
    if (state.day === 4 && !state.flags._ev2_sofa) {
      state.flags._ev2_sofa = true;
      return pd("ch2_sofa_burn", finishDay, TONARI);
    }
    if (state.day === 5 && !state.flags._ev2_slump) {
      state.flags._ev2_slump = true;
      // 味覚スランプ発症: 以後、ミックス画面の味の記憶がノイズ混じりになる
      return pd("ch2_slump_taste", () => { state.flags._taste_slump = true; save(); finishDay(); }, TONARI);
    }
    // DAY6: 全編モチーフ「店の匂い」のch2配置（炭落とし事故の匂いが店に残る）
    if (state.day === 6 && !state.flags._ev2_smell) {
      state.flags._ev2_smell = true;
      return pd("ch2_lingering_smell", finishDay);
    }
    if (state.day === 7 && !state.flags._ev2_ageha) {
      state.flags._ev2_ageha = true;
      return pd("ch2_pre_tournament_realisation", finishDay, "res://assets/backgrounds/bg_tournament_stage.png");
    }
    // DAY10: スミさんの沈黙（連勝が始まった頃。ch4特訓「同じ顔をさせたくなかった」の前振り）
    if (state.day === 10 && !state.flags._ev2_sumi) {
      state.flags._ev2_sumi = true;
      return pd("ch2_sumi_silence", finishDay);
    }
    if (state.day === 12 && !state.flags._ev2_minto) {
      state.flags._ev2_minto = true;
      return pd("ch2_minto_warning", finishDay);
    }
    if (state.day === 13 && !state.flags._ev2_tsumugi) {
      state.flags._ev2_tsumugi = true;
      return pd("ch2_tsumugi_color", finishDay, TONARI);
    }
    return finishDay();
  }
  // ---- 第1章の夜の固定イベント
  if (state.day === 2 && !state.flags._ev_salaryman) {
    state.flags._ev_salaryman = true;
    return pd("ch1_salaryman_regular", finishDay, TONARI);
  }
  // DAY4: あげはカメオ（謎のギャルが荷物を拾ってくれる）。ホワイトグミベアの残り香が
  // ch2初対面（ch2_rivals_first_sight）で回収される伏線
  if (state.day === 4 && !state.flags._ev_ageha_cameo) {
    state.flags._ev_ageha_cameo = true;
    return pd("ch1_ageha_encounter", finishDay, "res://assets/backgrounds/bg_street_night.png");
  }
  // DAY7夜（折り返し）: 中間チェック。スミさんが「素の一台」を講評し、残り日数に目的を作る
  if (state.day === 7 && !state.flags._ev_day3_check) {
    state.flags._ev_day3_check = true;
    return pc({
      dialogue_id: "ch1_day3_check",
      metadata: { bg: TONARI },
      lines: [
        { speaker: "", face: "", text: "夜、tonariに顔を出すと、スミさんが作業台を顎で指した。" },
        { speaker: "sumi", face: "normal", text: "一台作ってみろ。練習でも本番でもない、今のお前の素の一台だ" },
        { speaker: "", face: "", text: "黙って組む。詰めて、熾して、置いて、待つ。スミさんは何も言わずに見ている。\n──完成。ホースを渡す。スミさんは目を閉じて、長い一服。" },
        { type: "condition", stat: "技術", threshold: 22, next_true: "mid_good", next_false: "mid_rough" },
        { speaker: "sumi", face: "serious", text: "大会まで、ちょうど折り返しだ。どこを磨くかは、お前が決めろ。──ただし、寝ること。それも仕込みのうちだ" },
        { speaker: "hajime", face: "normal", text: "はい。（あと{daysLeft}日。……何を、どこまで持っていけるか）" },
        { type: "apply", stats: { insight: 2 } },
      ],
      branches: {
        mid_good: [
          { speaker: "sumi", face: "smile", text: "……腕、上げたな。初日のお前の煙じゃない" },
          { speaker: "sumi", face: "normal", text: "ここからは弱点を潰せ。引きか、熱か、詰めか。自分で分かってるだろ" },
        ],
        mid_rough: [
          { speaker: "sumi", face: "normal", text: "……悪くない。けど、本番でこれだと埋もれるな" },
          { speaker: "sumi", face: "normal", text: "焦るな。まだ{daysLeft}日ある。基礎の反復が一番効く時期だ" },
        ],
      },
    }, finishDay);
  }
  if (state.day === 5 && !state.flags._ev_day5) {
    state.flags._ev_day5 = true;
    return pd("ch1_day5_sumi_story", finishDay, TONARI);
  }
  // DAY13夜（大会前々日）: 前日リハーサル（通し）。出来が本番の小ボーナスになる
  if (state.day === 13 && !state.flags._ev_day6_rehearsal) {
    state.flags._ev_day6_rehearsal = true;
    afterRehearsal = finishDay;
    return pc({
      dialogue_id: "ch1_day6_rehearsal",
      metadata: { bg: TONARI },
      lines: [
        { speaker: "sumi", face: "normal", text: "明後日が本番だ。今夜は通しでやるぞ。テーマ決めから引きまで、店の作業台を本番だと思え" },
        { speaker: "sumi", face: "serious", text: "リハーサルってのはな、失敗するためにやるんだ。今夜失敗した分だけ、本番で落ち着ける" },
        { speaker: "hajime", face: "normal", text: "はい。（……手が少し冷たい。本番前夜って、こういう感じなのか）" },
      ],
    }, () => beginMaking("rehearsal"));
  }
  if (state.day === 14 && !state.flags._ev_day7) {
    state.flags._ev_day7 = true;
    return pd("ch1_day7_last_night", finishDay, TONARI);
  }
  finishDay();
}

// --- バイト
function doBaito(afterCameo) {
  visitContextChar = null;
  if (window.SFX) SFX.bgm("tonari");
  if (!afterCameo) addStamina(-STAMINA_COST.baito); // 接客はけっこう体力を使う
  // 2回目のバイトに一度だけ: 後の章のライバル（零-REI-）が正体を伏せたV系の客として来店。
  // ch2決勝・ch3で「あの時の客」と繋がるカメオ伏線
  if (state.chapter === 1 && !state.flags._ev_rei_cameo && (state.usedBaito || []).length >= 1) {
    state.flags._ev_rei_cameo = true;
    return playDialogue("ch1_rei_cameo", () => doBaito(true), "res://assets/backgrounds/bg_tonari_inside.png");
  }
  let pool = D.baito_events.filter((e) => !state.usedBaito.includes(e.id));
  if (pool.length === 0) { state.usedBaito = []; pool = D.baito_events.slice(); }
  const ev = pool[Math.floor(Math.random() * pool.length)];
  state.usedBaito.push(ev.id);
  if (!state.customerNotes) state.customerNotes = {};
  if (!state.customerNotes[ev.id]) state.customerNotes[ev.id] = { first: state.day || 1, count: 0 };
  state.customerNotes[ev.id].count++;
  const basePay = Math.max(8000, ev.base_pay || D.baito_settings.base_pay || 8000); // 給料は最低8,000円（master_spec #21）

  const lines = [
    afterCameo
      ? { speaker: "", face: "", text: "──不思議な客を見送って、シフトに戻る。" }
      : { speaker: "", face: "", text: "今日はtonariでバイト。エプロンを締めて、カウンターに立つ。" },
    { speaker: "", face: "", text: ev.text },
  ];
  const branches = {};
  const choices = [];
  ev.choices.forEach((c, i) => {
    const key = `c${i}`;
    choices.push({ text: c.text, next: key });
    const branchLines = String(c.result || "").split("\n").filter(Boolean)
      .map((t) => ({ speaker: "", face: "", text: t }));
    branchLines.push({ type: "apply", stats: c.stats || {}, money: basePay + (c.money_bonus || 0) });
    if (ev.customer_chat_snippet) branchLines.push({ speaker: "", face: "", text: ev.customer_chat_snippet });
    branches[key] = branchLines;
  });
  lines.push({ type: "choice", id: ev.id, choices });

  // バイト後: オーダーチャレンジ（1台作る）か自主練か帰るか
  const pw = D.baito_settings.post_work_practice;
  if (pw && pw.enabled) {
    lines.push({ speaker: "", face: "", text: "シフトの終わり際、新しいお客さんが入ってきた。\nスミさん「始、最後の一台、任せていいか」" });
    lines.push({
      type: "choice", id: "post_work", choices: [
        { text: "オーダーに挑戦する（一台作る）", next: "pw_order" },
        { text: "今日は裏で自主練する", next: "pw_yes" },
        { text: "上がらせてもらう", next: "pw_no" },
      ],
    });
    branches.pw_order = [
      { speaker: "", face: "", text: "エプロンを締め直して、作業台の前に立つ。大会の練習にもなるはずだ。" },
      { type: "set_flag", flag: "_baito_order_go" },
    ];
    branches.pw_yes = [
      { speaker: "", face: "", text: pw.accept_result },
      { type: "apply", stats: pw.accept_stats || {} },
    ];
    branches.pw_no = [{ speaker: "", face: "", text: pw.decline_result }];
  }

  playCustom(
    { dialogue_id: "baito_" + ev.id, metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" }, lines, branches },
    () => {
      if (state.flags._baito_order_go) {
        delete state.flags._baito_order_go;
        return beginMaking("baito");
      }
      endAction();
    }
  );
}

// --- キャラ訪問
const VISIT_BG = {
  naru: "kemurikusa.png", adam: "eden.png", minto: "pepermint.png",
  sumi: "bg_tonari_inside.png", tsumugi: "bg_tonari_inside.png",
};

function doVisit(charId) {
  visitContextChar = charId;
  const seq = VISIT_SEQUENCES[charId];
  const idx = state.visits[charId];
  const bg = VISIT_BG[charId] || "bg_tonari_inside.png";
  state.dayVisited[charId] = state.day; // 同じ店は1日1回まで
  addStamina(-(["naru", "adam", "minto", "kumicho", "ageha", "rei", "volk"].includes(charId) ? STAMINA_COST.visit : STAMINA_COST.talk));
  const after = () => {
    markMet(charId); // 会話を終えた＝面識ができた（名乗りの set_flag の保険）
    visitContextChar = null;
    endAction();
  };
  if (idx < seq.length) {
    state.visits[charId] += 1;
    playDialogue(seq[idx], () => {
      // 会話内に報酬キューが無くても、必ず好感度かステータスを付与する
      const got = gainAffinity(charId, "visit");
      if (!cueFiredInDialogue && !got) gainStat(spotStat(charId), 2);
      after();
    }, `res://assets/backgrounds/${bg}`);
  } else {
    const rep = REPEAT_VISIT[charId];
    playCustom(
      {
        dialogue_id: `repeat_${charId}`,
        metadata: { bg: `res://assets/backgrounds/${bg}` },
        lines: [
          { speaker: "", face: "", text: rep.text },
          { type: "apply", stats: rep.stats },
        ],
      },
      () => {
        gainAffinity(charId, "repeat"); // 通い続ける積み重ねも少しずつ効く
        after();
      }
    );
  }
}

// --- チョイザップ
function doChoizap() {
  visitContextChar = null;
  if (!state.flags._choizap_seen) {
    state.flags._choizap_seen = true;
    playDialogue("ch1_choizap_first", endAction, "res://assets/backgrounds/bg_street_day.png");
    return;
  }
  if (!state.gymMember) {
    playCustom({
      dialogue_id: "choizap_retry",
      metadata: { bg: "res://assets/backgrounds/bg_street_day.png" },
      lines: [
        { speaker: "", face: "", text: "チョイザップの前まで来た。" },
        { type: "choice", id: "choizap_again", choices: [
          { text: "会員登録する（4,000円）", next: "go" },
          { text: "やめておく", next: "no" },
        ] },
      ],
      branches: {
        go: [
          { speaker: "", face: "", text: "アプリから会員登録した。月額4,000円が引き落とされた。早速ひと汗かいていく。" },
          { type: "apply", stats: { charm: 2 } },
        ],
        no: [{ speaker: "", face: "", text: "今日はやめておこう。ウィンドウ越しにダンベルを眺めて帰った。" }],
      },
    }, endAction);
    return;
  }
  addStamina(-STAMINA_COST.gym);
  doSpotDialogue("choizap", "ch1_choizap_visit", "bg_street_day.png");
}

// Dr.fookah を選んだら、物販利用か凛さんに会うかを選ぶ（T28・場所で管理）。
// 物販=買い物のみ(無料・コマ不要)／凛=吸えるブースで一服＋会う(2,500円・コマを使う。物販もやってる分、他店3,000円より少し安い)
function showFookahMenu() {
  document.getElementById("fookah-menu")?.remove();
  const screen = document.querySelector("#screen-map");
  if (!screen) return;
  if (window.SFX) SFX.open();
  const rinDone = !!state.flags[`_rin_d${state.day}`];
  const broke = state.money < FOOKAH_BOOTH_FEE;
  const rinOff = rinDone || broke;
  const ov = document.createElement("div");
  ov.id = "fookah-menu";
  ov.innerHTML =
    `<div class="tn-menu-card">` +
    `<p class="tn-menu-title">Dr.fookah ── どうする？</p>` +
    `<div class="tn-menu-list">` +
    `<button class="spot-btn" id="fookah-shop"><span class="spot-name">物販を利用する</span><span class="spot-cost">無料・コマ不要</span><span class="spot-desc">機材とフレーバーの買い物だけ。時間はかからない</span></button>` +
    `<button class="spot-btn" id="fookah-rin"${rinOff ? " disabled" : ""}><span class="spot-name">${isMet("rin") ? "凛さんに会う＋ブースで一服" : "ブースで一服する"}</span><span class="spot-cost">${rinDone ? "今日はもう行った" : broke ? "所持金が足りない（2,500円）" : "2,500円・コマを使う"}</span><span class="spot-desc">吸えるブースつき。物販もやってる分、他店より少し安い（3,000円→2,500円）</span></button>` +
    `</div>` +
    `<button class="primary-btn ghost tn-close" id="fookah-close">← マップに戻る</button>` +
    `</div>`;
  screen.appendChild(ov);
  ov.querySelector("#fookah-shop").addEventListener("click", () => { ov.remove(); showShop(); });
  const rinBtn = ov.querySelector("#fookah-rin");
  if (!rinOff) rinBtn.addEventListener("click", () => { ov.remove(); doRinVisit(); });
  ov.querySelector("#fookah-close").addEventListener("click", () => { if (window.SFX) SFX.close(); ov.remove(); });
  requestAnimationFrame(() => ov.classList.add("show"));
}

// --- ショップ（行動を消費しない）
function showShop() {
  visitContextChar = null;
  // ch2の初回来店時に一度だけ: ch3ライバル・スティーブが客としてカメオ
  // （Dr.fookahは海外メーカー代理店＝国際勢の自然な立ち寄り先）
  if (state.chapter === 2 && state.phase === "daily" && !state.flags._ev_steve_cameo) {
    state.flags._ev_steve_cameo = true;
    return playDialogue("ch2_steve_cameo", () => showShop(), "res://assets/backgrounds/bg_shop.png");
  }
  showScreen("#screen-shop");
  if (window.SFX) SFX.open();
  $("#shop-money").textContent = `所持金 ${state.money.toLocaleString()}円`;
  const list = $("#shop-list");
  list.innerHTML = "";
  // 家シーシャ一式は第2章から店頭に並ぶ
  const TYPE_ORDER = state.chapter >= 2 ? ["bowl", "hms", "charcoal", "homeware"] : ["bowl", "hms", "charcoal"];
  for (const type of TYPE_ORDER) {
    const label = document.createElement("p");
    label.className = "setup-group-label";
    label.textContent = EQUIP_TYPE_LABELS[type];
    list.appendChild(label);
    const grid = document.createElement("div");
    grid.className = "spot-list";
    for (const e of D.equipment.filter((x) => x.type === type && (x.chapter_min || 1) <= state.chapter)) {
      const ownedAlready = state.owned.includes(e.id);
      const price = e.price || 0;
      const btn = document.createElement("button");
      btn.className = "spot-btn";
      btn.innerHTML =
        `<span class="spot-name">${e.name}</span>` +
        `<span class="spot-cost">${ownedAlready ? "購入済み" : `${price.toLocaleString()}円`}</span>` +
        `<span class="spot-desc">${e.description || ""}</span>`;
      if (ownedAlready || price > state.money) btn.disabled = true;
      btn.addEventListener("click", () => {
        if (state.owned.includes(e.id) || e.price > state.money) return;
        addMoney(-e.price);
        state.owned.push(e.id);
        save();
        if (window.SFX) SFX.coin();
        toast(`${e.name} を手に入れた`);
        showShop(); // 表示を更新
      });
      grid.appendChild(btn);
    }
    list.appendChild(grid);
  }
  // フレーバー入荷（Dr.fookah）。その章の解放可能フレーバーを買うとミックスで使える＝パレットが広がる(#くじ/ショップにフレーバー)。
  // 基本フレーバーは常時使える。買わなくても本番はスミさんがお情けで分けてくれる(#44)。
  {
    const flLabel = document.createElement("p");
    flLabel.className = "setup-group-label";
    flLabel.textContent = "フレーバー入荷（Dr.fookah）";
    list.appendChild(flLabel);
    const flGrid = document.createElement("div");
    flGrid.className = "spot-list";
    const stockable = D.flavors.filter((f) => f.unlockable && (f.chapter_min || 1) <= state.chapter);
    for (const f of stockable) {
      const owned = !!state.flags[f.requires_flag];
      const price = f.price || 0;
      const btn = document.createElement("button");
      btn.className = "spot-btn";
      btn.innerHTML =
        `<span class="spot-name">${f.short_name || f.name}</span>` +
        `<span class="spot-cost">${owned ? "入荷済み" : `${price.toLocaleString()}円`}</span>` +
        `<span class="spot-desc">${f.description || ""}</span>`;
      if (owned || price > state.money) btn.disabled = true;
      btn.addEventListener("click", () => {
        if (state.flags[f.requires_flag] || price > state.money) return;
        addMoney(-price);
        state.flags[f.requires_flag] = true;
        state.flags._flavor_stocked = true; // 本番持参の救済条件(#44)も満たす
        save();
        if (window.SFX) SFX.coin();
        toast(`${f.short_name || f.name} を入荷した`);
        showShop();
      });
      flGrid.appendChild(btn);
    }
    if (!stockable.length) {
      const none = document.createElement("p");
      none.className = "tn-tutor";
      none.textContent = "新しいフレーバーは、また後日入荷予定。";
      flGrid.appendChild(none);
    }
    list.appendChild(flGrid);
  }
  // 売却（中古買取）: 機材のみ買値の50%で売れる。フレーバー系は開封済み扱いで不可（master_spec #21）
  const sellLabel = document.createElement("p");
  sellLabel.className = "setup-group-label";
  sellLabel.textContent = "買取カウンター（機材のみ・買値の約50%）";
  const sellGrid = document.createElement("div");
  sellGrid.className = "spot-list";
  const sellable = state.owned.filter((id) => {
    const e = D.equipment.find((x) => x.id === id);
    return e && !STARTER_EQUIPMENT.includes(id) && (e.price || 0) > 0;
  });
  if (!sellable.length) {
    const none = document.createElement("p");
    none.className = "tn-hint";
    none.textContent = "（売れる機材は持っていない。初期装備と消耗品は買取対象外）";
    sellGrid.appendChild(none);
  }
  for (const id of sellable) {
    const e = D.equipment.find((x) => x.id === id);
    const price = Math.round((e.price || 0) * 0.5);
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML = `<span class="spot-name">${e.name} を売る</span><span class="spot-cost">+${price.toLocaleString()}円</span>`;
    btn.addEventListener("click", () => {
      state.owned = state.owned.filter((x) => x !== id);
      addMoney(price);
      save();
      toast(`${e.name} を売った`);
      showShop();
    });
    sellGrid.appendChild(btn);
  }
  // くじで得た売却可グッズ（限定グッズ等）も買取対象
  (state.goods || []).forEach((g) => {
    if (!g.sell) return;
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML = `<span class="spot-name">${g.name} を売る</span><span class="spot-cost">+${g.sell.toLocaleString()}円</span>`;
    btn.addEventListener("click", () => {
      state.goods = state.goods.filter((x) => x !== g);
      addMoney(g.sell);
      save();
      toast(`${g.name} を売った`);
      showShop();
    });
    sellGrid.appendChild(btn);
  });
  list.append(sellLabel, sellGrid);

  // シーシャくじコーナー（master_spec #25 / A2）
  renderKujiSection(list);

  // 2階: 凛さんのショールーム（NIGHTSIDE日本代理店）。会いに行くと行動を1回使う
  const rinWrap = document.createElement("div");
  rinWrap.className = "spot-list";
  const visitedToday = !!state.flags[`_rin_d${state.day}`];
  const rinAway = state.day % 7 === RIN_AWAY_CYCLE;
  const label = document.createElement("p");
  label.className = "setup-group-label";
  label.textContent = "2階";
  const rinBtn = document.createElement("button");
  rinBtn.className = "spot-btn";
  rinBtn.id = "shop-rin";
  rinBtn.innerHTML =
    state.visits.rin === 0
      ? `<span class="spot-name">2階から視線を感じる……</span><span class="spot-cost">2,500円・行動を1回使う</span><span class="spot-desc">階段の上に、誰かいる。ブース付き</span>`
      : `<span class="spot-name">2階のショールーム＋ブース（${displayName("rin")}）</span>` +
        `<span class="spot-cost">${rinAway ? "今日は出張で不在" : visitedToday ? "今日はもう顔を出した" : "2,500円・会いに行く（行動を1回使う）"}</span>` +
        `<span class="spot-desc">NIGHTSIDE日本代理店。吸えるブースつき（他店より少し安い）。買い物だけなら時間はかからない</span>`;
  rinBtn.disabled = visitedToday || rinAway || state.money < FOOKAH_BOOTH_FEE; // ブース料が払えないと不可（T28）
  rinBtn.addEventListener("click", doRinVisit);
  rinWrap.appendChild(rinBtn);
  list.append(label, rinWrap);
}

// ============ シーシャくじ（master_spec #25 / A2） ============
// ボックス制・上位集約の期待値。リセマラ防止: ボックスは生成時に並びを確定して
// セーブし、引くたびに先頭から取り出す。引いた直後に save（結果を見てからのロード無効）。
function kujiGrades() {
  const data = (D.kuji && D.kuji.grades) || {};
  return Object.entries(data)
    .filter(([, g]) => (g.chapterMin || 1) <= (state.chapter || 1))
    .map(([id, g]) => ({ id, ...g }));
}

// ボックスを生成（賞品を枚数ぶん展開→シャッフル→保存）。決定的にしたいので一度だけ
function buildKujiBox(gradeId) {
  const g = D.kuji.grades[gradeId];
  const pool = [];
  g.prizes.forEach((p, pi) => { for (let i = 0; i < p.count; i++) pool.push(pi); });
  // Fisher–Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { order: pool, drawn: 0, emptyDay: null };
}

function kujiBoxState(gradeId) {
  const st = state.kuji[gradeId];
  // 補充: 空にしてから refillDays 経過したら新ボックス
  if (st && st.drawn >= D.kuji.grades[gradeId].boxSize) {
    const refill = (D.kuji.meta.refillDays || 3);
    if (st.emptyDay != null && state.day - st.emptyDay >= refill) {
      state.kuji[gradeId] = buildKujiBox(gradeId);
      save();
    }
    return state.kuji[gradeId];
  }
  if (!st) { state.kuji[gradeId] = buildKujiBox(gradeId); save(); }
  return state.kuji[gradeId];
}

function renderKujiSection(list) {
  const grades = kujiGrades();
  if (!grades.length) return;
  const label = document.createElement("p");
  label.className = "setup-group-label";
  label.textContent = "シーシャくじ（仮）";
  list.appendChild(label);
  const prov = document.createElement("p");
  prov.className = "tn-hint";
  // 初回だけ凛の口すべり（在庫処分のほのめかし＋運任せの忠告）
  if (!state.flags._kuji_seen) {
    const note = document.createElement("p");
    note.className = "tn-hint";
    note.textContent = `${displayName("rin")}「これ、実は在庫しょぶ……なんでもない。まあ、引きは引き。悩んでも結果は変わらないから、直感で行きなさい」`;
    list.appendChild(note);
  }
  const wrap = document.createElement("div");
  wrap.className = "spot-list";
  for (const g of grades) {
    const box = kujiBoxState(g.id);
    const left = g.boxSize - box.drawn;
    const empty = left <= 0;
    const refill = D.kuji.meta.refillDays || 3;
    const sinceEmpty = empty && box.emptyDay != null ? state.day - box.emptyDay : 0;
    const btn = document.createElement("button");
    btn.className = "spot-btn kuji-btn";
    const status = empty
      ? `売り切れ（あと${Math.max(0, refill - sinceEmpty)}日で補充）`
      : `のこり ${left} / ${g.boxSize} 枚`;
    btn.innerHTML =
      `<span class="spot-name">${g.label}</span>` +
      `<span class="spot-cost">${empty ? status : `${g.price.toLocaleString()}円 ・ ${status}`}</span>` +
      `<span class="spot-desc">${empty ? "箱が空っぽだ。新しい箱を待とう。" : (left === 1 ? "次がラスト1枚！ ラストワン賞つき" : "上位賞は1箱に1つだけ。")}</span>`;
    btn.disabled = empty || g.price > state.money;
    btn.addEventListener("click", () => drawKuji(g.id));
    wrap.appendChild(btn);
  }
  list.appendChild(wrap);
  state.flags._kuji_seen = true;
}

function drawKuji(gradeId) {
  const g = D.kuji.grades[gradeId];
  const box = kujiBoxState(gradeId);
  if (box.drawn >= g.boxSize || g.price > state.money) return;
  addMoney(-g.price);
  const prizeIdx = box.order[box.drawn];
  box.drawn += 1;
  const isLast = box.drawn >= g.boxSize;
  if (isLast) box.emptyDay = state.day;
  save(); // 引いた直後に保存（結果を見てからのロード無効）
  const prize = g.prizes[prizeIdx];
  grantKujiPrize(prize);
  const extras = isLast && g.lastOne ? [g.lastOne] : [];
  for (const ex of extras) grantKujiPrize(ex);
  save();
  revealKuji(prize, extras, () => showShop());
}

// 賞品を実体化。equipId は所持機材へ（重複は売値ぶん現金化）。goods は売却可在庫へ
function grantKujiPrize(prize) {
  if (prize.equipId) {
    if ((state.owned || []).includes(prize.equipId)) {
      if (prize.sell) addMoney(Math.round(prize.sell * 0.5)); // ダブりは控えめに現金化
    } else {
      state.owned.push(prize.equipId);
    }
    return;
  }
  // フレーバー賞: ミックスで使えるように解放（その章のフレーバーが当たる）。本番持参の救済条件も満たす(#44)
  if (prize.type === "flavor" && prize.flavorId) {
    state.flags["_flavor_" + prize.flavorId] = true;
    state.flags._flavor_stocked = true;
    return;
  }
  if (prize.type === "goods" && prize.sell) {
    state.goods.push({ name: prize.name, sell: prize.sell });
  }
  // consumable は使用価値（このゲームでは抽象）。獲得演出のみ
}

// 引き演出: 箱→ティケット→ランク開封。上位賞は煙＋スモークリング
function revealKuji(prize, extras, done) {
  const ov = $("#kuji-overlay");
  const card = $("#kuji-card");
  ov.classList.add("show");
  card.className = "kuji-card drawing";
  card.innerHTML = `<div class="kuji-ticket">？</div>`;
  if (window.SFX) SFX.open();
  const top = prize.rank === "S" || prize.rank === "LAST";
  setTimeout(() => {
    card.className = `kuji-card reveal rank-${prize.rank}`;
    card.innerHTML =
      `<div class="kuji-rank">${prize.rank}</div>` +
      `<div class="kuji-prize-name">${prize.name}</div>` +
      `<div class="kuji-prize-desc">${prize.desc || ""}</div>`;
    if (window.SFX) { SFX.stamp(); if (top && SFX.perfect) SFX.perfect(); }
    if (top) { engulfInSmoke(); smokeRings(4); }
    for (const ex of extras) toast(`${ex.name} を手に入れた！`);
  }, 700);
  const close = () => {
    ov.classList.remove("show");
    ov.removeEventListener("click", onClick);
    if (done) done();
  };
  const onClick = () => { if (card.classList.contains("reveal")) close(); };
  ov.addEventListener("click", onClick);
  // 自動で閉じない（プレイヤーがクリックで閉じる）が、保険で長めのタイムアウト
  setTimeout(() => { if (ov.classList.contains("show")) close(); }, 6000);
}

// 凛さんのショールーム（会いに行くと1コマ消費。買い物だけなら消費なし。1日1回）
const RIN_SEQUENCE = ["ch1_rin_first", "ch1_rin_second", "ch1_rin_third"];
const FOOKAH_BOOTH_FEE = 2500; // ブース利用料（物販もやってる分、他店3,000円より少し安い）(T28)
function doRinVisit() {
  if (state.flags[`_rin_d${state.day}`]) return;
  const play = () => shishaGuard(() => {
    if (state.money < FOOKAH_BOOTH_FEE) { toast(`ブース利用は${FOOKAH_BOOTH_FEE.toLocaleString()}円。所持金が足りない`); return showShop(); }
    addMoney(-FOOKAH_BOOTH_FEE);
    state.flags[`_rin_d${state.day}`] = true;
    visitContextChar = "rin";
    addStamina(-STAMINA_COST.rin);
    const idx = state.visits.rin;
    const after = () => {
      markMet("rin");
      visitContextChar = null;
      save();
      endAction(); // 凛に会うのは1コマ（行けば行くほど得、を防ぐ）
    };
    if (idx < RIN_SEQUENCE.length) {
      state.visits.rin += 1;
      playDialogue(RIN_SEQUENCE[idx], () => {
        const got = gainAffinity("rin", "visit");
        if (!cueFiredInDialogue && !got) gainStat("sense", 2);
        after();
      }, "res://assets/backgrounds/bg_shop.png");
    } else {
      playDialogue("ch1_rin_repeat", () => { gainAffinity("rin", "repeat"); after(); }, "res://assets/backgrounds/bg_shop.png");
    }
  }, () => showShop());
  maybeVisitWarning("rin", play, () => showShop());
}

// --- 休む
function doRest() {
  visitContextChar = null;
  state.flags._rested_today = true; // 体力に余裕がある日（家シーシャの効きが良くなる）
  // 家で休む＝フル回復（#41）。溜まった疲労（overwork）もリセット＝「あえて休む」選択に意味
  state.stamina = 100;
  state.flags._overwork = 0;
  updateHud();
  playCustom({
    dialogue_id: "rest_home",
    metadata: { bg: "res://assets/backgrounds/bg_home.png" },
    lines: [
      { speaker: "", face: "", text: "今日は家でゆっくり休んだ。湯船に浸かって、早めに布団に入る。\n……体の芯から、疲れがすっかり抜けていった。" },
      { speaker: "hajime", face: "normal", text: "（大会まで、あと少し。……やれるだけのことは、やろう）" },
      { type: "apply", stats: { guts: 2 } },
    ],
  }, endAction);
}

// --- 家シーシャ（第2章〜・home_rig_set 所持時）
// 寝る前の一服でステータスが少し伸びる。作る工程は遊ばせない（一服の演出だけ）。
// バランス: 葉代600円／連夜は効果減（毎晩吸うのが最適にならない）／
// その日「家で休む」を選んでいれば体力に余裕があり効果増。バイトの有無では縛らない
// 1日の終わり: 帰宅して眠る（「夜の行動後にまた店にいる」感の解消）。
// 家シーシャ条件を満たす夜はそちらが帰宅演出を兼ねる
const HOMECOMING_LINES = [
  "店明かりの落ちた商店街を抜けて、家に帰る。\n熱いシャワーを浴びると、今日一日の煙の匂いが流れていった。",
  "帰り道、夜風が少しだけ煙の匂いを連れていく。\n布団に入ると、すぐに眠気がやってきた。",
  "家に着く頃には、日付が変わりかけていた。\nスマホを枕元に置いて、目を閉じる。",
];
function maybeNightcap(next) {
  const canPuff = state.chapter >= 2 && (state.owned || []).includes("home_rig_set") && state.money >= 600 && !staminaLow();
  if (canPuff) return maybeHomeShisha(next);
  playCustom({
    dialogue_id: "night_homecoming",
    metadata: { bg: "res://assets/backgrounds/bg_home.png" },
    lines: [
      { speaker: "", face: "", text: `${HOMECOMING_LINES[state.day % HOMECOMING_LINES.length]}\n——DAY ${state.day}、おわり。` },
    ],
  }, next);
}

function maybeHomeShisha(next) {
  if (state.chapter < 2 || !(state.owned || []).includes("home_rig_set") || state.money < 600) return next();
  const consecutive =
    state.homePuffLast &&
    state.homePuffLast.chapter === state.chapter &&
    state.homePuffLast.day === state.day - 1;
  const rested = !!state.flags._rested_today;
  const amount = consecutive ? 1 : rested ? 3 : 2;
  // 伸びるのは技術/センス/洞察のうち一番低いもの（詰み防止の追い上げ枠）
  const stat = ["technique", "sense", "insight"].sort((a, b) => state.stats[a] - state.stats[b])[0];
  const flavor = consecutive
    ? "昨日も吸った。今夜のは、ただの習慣の煙だ。……発見は少ない。それでも、悪くない。"
    : rested
      ? "今日は体に余裕がある。煙の立ち方が、いつもよりよく見える。──ひとつ、いい気づきがあった。"
      : "ゆっくり一服。自分の煙を、自分のためだけに吸う時間。";
  playCustom({
    dialogue_id: "home_shisha_night",
    metadata: { bg: "res://assets/backgrounds/bg_home.png" },
    lines: [
      { speaker: "", face: "", text: "帰宅。部屋の隅で、自分の台が待っている。" },
      { type: "choice", choices: [
        { text: "寝る前に一服していく（葉代600円）", next: "puff" },
        { text: "今日はもう寝る", next: "sleep" },
      ] },
    ],
    branches: {
      puff: [
        { speaker: "", face: "", text: "自分の台に火を入れる。誰のためでもない、寝る前の一杯。" },
        { speaker: "", face: "", text: flavor },
        { type: "apply", stats: { [stat]: amount }, money: -600 },
      ],
      sleep: [
        { speaker: "", face: "", text: "台にカバーを掛けて、布団に入った。" },
      ],
    },
  }, next);
}

// ---------------------------------------------------------------- 練習ミニゲーム
// 練習＝本番の部分練習。大会の実ミニゲームをそのまま1種選んで反復する。
// 自己ベスト（practiceBest 0〜2）は大会本番のスコアボーナスになる
const PRACTICE_DRILLS = [
  { id: "foil", label: "穴あけ反復", desc: "本番と同じリズムで6つ穴を開ける", stats: ["technique", "sense"] },
  { id: "coalfire", label: "炭起こしの見極め", desc: "芯がピカッと閃く瞬間を見極めて取り上げる", stats: ["guts", "technique"] },
  { id: "steam", label: "蒸らしの胆力", desc: "蒸らしの待ち時間を見切り、最後の一手を合わせる訓練", stats: ["insight", "guts"] },
  { id: "pull", label: "吸い出しの温度感", desc: "上げ吸い・下げ吸いを使い分けて適温に合わせる", stats: ["sense", "technique"] },
  { id: "focus", label: "集中トレーニング", desc: "雑念を振り払う訓練。本番の野次対策", stats: ["insight", "guts"] },
  { id: "serve", label: "提供イメトレ", desc: "お客さんへの出し方・佇まいを組み立てる", stats: ["charm", "insight"] },
];

let gauge = { raf: 0, pos: 0, dir: 1, speed: 0.9, running: false, onStop: null, zone: [0.56, 0.78] };

function startGauge(zone, speed, onStop) {
  gauge.zone = zone;
  gauge.speed = speed;
  gauge.pos = 0;
  gauge.dir = 1;
  gauge.running = true;
  gauge.onStop = onStop;
  const zoneEl = $("#gauge-zone");
  zoneEl.style.left = `${zone[0] * 100}%`;
  zoneEl.style.width = `${(zone[1] - zone[0]) * 100}%`;
  let last = performance.now();
  const tick = (now) => {
    if (!gauge.running) return;
    const dt = (now - last) / 1000;
    last = now;
    gauge.pos += gauge.dir * gauge.speed * dt;
    if (gauge.pos >= 1) { gauge.pos = 1; gauge.dir = -1; }
    if (gauge.pos <= 0) { gauge.pos = 0; gauge.dir = 1; }
    $("#gauge-needle").style.left = `${gauge.pos * 100}%`;
    gauge.raf = requestAnimationFrame(tick);
  };
  gauge.raf = requestAnimationFrame(tick);
}

function stopGauge() {
  if (!gauge.running) return null;
  gauge.running = false;
  cancelAnimationFrame(gauge.raf);
  const [a, b] = gauge.zone;
  const center = (a + b) / 2;
  const half = (b - a) / 2;
  if (Math.abs(gauge.pos - center) <= half * 0.4) return "perfect";
  if (gauge.pos >= a && gauge.pos <= b) return "good";
  return "miss";
}

function startPractice() {
  visitContextChar = null;
  if (window.SFX) SFX.bgm("tonari");
  showScreen("#screen-practice");
  $("#practice-title").textContent = "今日は何を練習する？";
  $("#practice-gauge-area").classList.add("hidden");
  $("#practice-result").textContent = "シーシャ作りの各工程を個別に練習できる。自己ベスト（★）は大会本番のスコアに上乗せされる。";
  const menu = $("#practice-menu");
  menu.classList.remove("hidden");
  menu.innerHTML = "";
  for (const item of PRACTICE_DRILLS) {
    const best = (state.practiceBest || {})[item.id] || 0;
    const stars = best ? `自己ベスト: ${"★".repeat(best)}${"☆".repeat(2 - best)}` : "自己ベスト: ──";
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML =
      `<span class="spot-name">${item.label}</span>` +
      `<span class="spot-cost">${stars}</span>` +
      `<span class="spot-desc">${item.desc}</span>`;
    btn.addEventListener("click", () => {
      if (item.id === "serve") return runPracticeGauge(item);
      startDrill(item.id); // 本番と同じミニゲームで練習する
    });
    menu.appendChild(btn);
  }
}

function runPracticeGauge(item) {
  $("#practice-menu").classList.add("hidden");
  $("#practice-title").textContent = item.label;
  $("#practice-result").textContent = "";
  const area = $("#practice-gauge-area");
  area.classList.remove("hidden");
  $("#gauge-hint").textContent = "ちょうどいい熱の入り方になる場所で止めろ！";
  if (DRILL_TIPS[item.id]) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = DRILL_TIPS[item.id];
    $("#gauge-hint").after(tip);
  }
  const stopBtn = $("#gauge-stop");
  stopBtn.disabled = false;
  stopBtn.textContent = "止める！";
  // 技術が高いほど針がわずかに遅くなる（そこそこ有利、程度）
  const speed = Math.max(0.65, 1.0 - state.stats.technique / 400);
  startGauge([0.56, 0.78], speed, null);
  stopBtn.onclick = () => {
    const result = stopGauge();
    stopBtn.disabled = true;
    showStamp($("#screen-practice .panel"), result);
    const gains = { perfect: [4, 3], good: [3, 2], miss: [1, 0] }[result];
    const msgs = {
      perfect: "──完璧だ。煙がまとまって、香りの輪郭がはっきり見える。",
      good: "──悪くない。手応えのある仕上がりになった。",
      miss: "──熱が入りすぎた。少し焦げた匂い。でも、失敗からも学ぶことはある。",
    };
    $("#practice-result").textContent = msgs[result];
    gainStat(item.stats[0], gains[0]);
    if (gains[1] > 0) gainStat(item.stats[1], gains[1]);
    // 自己ベスト更新（提供イメトレも本番ボーナス対象）
    const tier = { perfect: 2, good: 1, miss: 0 }[result] || 0;
    if (tier > (state.practiceBest[item.id] || 0)) {
      state.practiceBest[item.id] = tier;
      toast("自己ベスト更新！ 本番に効くはずだ");
    }
    const done = document.createElement("button");
    done.className = "primary-btn";
    done.textContent = "練習を終える";
    done.addEventListener("click", endAction);
    $("#practice-result").appendChild(document.createElement("br"));
    $("#practice-result").appendChild(done);
  };
}

// ---------------------------------------------------------------- 大会 SMOKE CROWN CUP
const THEMES = [
  { id: "relax", label: "リラックス", desc: "ゆったり吸える、落ち着いた一台", best: ["cooling", "sweet"] },
  { id: "high_heat", label: "高火力", desc: "熱に負けない、力強い煙", best: ["cooling", "spice"] },
  { id: "fruity", label: "フルーティ", desc: "果実感の輪郭で勝負する", best: ["fruit", "sweet"] },
  { id: "aftertaste", label: "余韻", desc: "吸い終わったあとに残る香り", best: ["spice", "sweet"] },
];
const PACKS = [
  { id: "fluffy", label: "ふんわり", desc: "空気を含ませて軽く詰める" },
  { id: "normal", label: "ノーマル", desc: "基本に忠実な詰め方" },
  { id: "firm", label: "かため", desc: "ぎゅっと密度を出す" },
];
const COALS = [
  { id: "triangle", label: "トライアングル", desc: "基本の三角配置（3個）。安定の熱まわり" },
  { id: "four", label: "炭4個", desc: "3個よりかなり熱が上がる高火力。焦げのリスクと隣り合わせ" },
];
// 蒸らし中に飛んでくる「雑念」（弾幕の弾の文言）。ch2+は離反/味覚喪失の影が混じる
const DODGE_WORDS = [
  "手元、見られてる……", "時間が足りないかも", "隣の煙、もう上がってる",
  "失敗したらどうしよう", "パッキーの野次", "審査員の視線", "炭、熾きてたかな",
  "詰めすぎたか？", "灰、落ちないか", "客の咳ばらい", "温度、大丈夫か",
  "香り、飛んでないか", "手が、汗ばむ", "時計の秒針", "深呼吸、わすれてた",
  "ボウル、熱いな", "煙、薄い気がする", "スミさんなら…", "隣のジャスト音",
];
const DODGE_WORDS_CH2 = [
  "ヴォルクの精度", "組長の覚悟", "あげはのバイブス", "なるの配合ノート",
  "“誰の煙だ？”", "採点表", "正解はどれだ", "味が、思い出せない",
  "なるの背中", "勝てば、いいのか", "客の顔が見えない", "ましろなら…",
  "この味で合ってる？", "上手いだけの煙", "舌が、遠い", "勝ち筋をなぞる",
  "本当に、好きか", "誰かの正解", "拍手が、遠い",
];
const STEAMS = [
  { id: 0, label: "0分", desc: "吸いながら一気に立ち上げる型破りな技。神崎竜二との交友で解放", unlock: "kumicho" },
  { id: 3, label: "3分", desc: "早めに立ち上げる。香りは軽く、温度合わせが忙しい" },
  { id: 5, label: "5分", desc: "基本の蒸らし。香りの輪郭を残しやすい" },
  { id: 8, label: "8分", desc: "じっくり待つ。甘さと余韻が開く" },
  { id: 10, label: "10分", desc: "攻めた長めの蒸らし。重い煙には効くが、焦げの気配も近い" },
];
// ch1ライバルの基礎点。実力（statScore+craft）だけでは普通3〜4位・最良でも2位に収まり、
// 1位は南雲の総合印象点（craft基準超えで一括投入）だけが生む。逆転を「効かせる」ための難度設定。
const RIVALS = [
  { id: "naru", name: "なる", base: 82 },
  { id: "adam", name: "アダム", base: 74 },
  { id: "minto", name: "みんと", base: 67 },
];

const EQUIP_TYPE_LABELS = { bowl: "ボウル", hms: "ヒートマネジメント", charcoal: "炭", homeware: "家シーシャ" };
const FOCUS_WORDS = [
  "手元、見られてる……",
  "パッキーの野次がうるさい",
  "時間が足りないかも……",
  "なるの煙、もう上がってる",
  "失敗したらどうしよう",
];

let tt = null; // tournament temp state
const rigState = { smokeTimer: 0, bubbleTimer: 0 };

// --- パッキー実況ティッカー: ミニゲームの判定に即反応する実況テロップ（大会本番のみ）
const PAKKI_TICKER = {
  perfect: [
    "うおーっと！　完璧だァ！　とんでもない手際です！",
    "ぷぷぷっ！　今の見た！？　お手本みたいな仕事だよ！",
    "会場どよめいてます！　審査員も身を乗り出したーっ！",
  ],
  good: [
    "おっ、いい流れ！　会場の鼻がスンスンし始めた！",
    "悪くない悪くない！　このまま行っちゃう！？",
  ],
  miss: [
    "あらら〜♪　これは痛い！　でも勝負はまだわかんないよ！",
    "おっと手元が乱れたか！？　審査員の眉がピクッとしました！",
  ],
};
let tickerTimer = 0;
function ticker(text) {
  const el = $("#tn-ticker");
  if (!el) return;
  el.textContent = `🎤 パッキー「${text}」`;
  el.classList.remove("show");
  void el.offsetWidth; // アニメーション再起動
  el.classList.add("show");
  clearTimeout(tickerTimer);
  tickerTimer = setTimeout(() => el.classList.remove("show"), 3600);
}
function pakkiLive(result) {
  if (!tt || tt.mode !== "tournament") return;
  const pool = PAKKI_TICKER[result] || [];
  if (pool.length) ticker(pool[Math.floor(Math.random() * pool.length)]);
}

// ============================================================================
// 大会の生放送レイヤー（本番のみ）:
//   #24 可視スコア（体感スコア「+N P」ポップ）＋ニコ動風コメント
//   #20 工程ブロックの頭でMCが前振り ／ #26 ライバルのリアルタイム実況
// 審査員の持ち点とは別系統の「観客ウケ」を可視化して気持ちよさを出す。
// ============================================================================
const NICO_POOL = {
  perfect: ["うますぎｗ", "神業ｷﾀ━(ﾟ∀ﾟ)━!", "完璧すぎる", "もう優勝でいいだろ", "手元ブレなさすぎ", "プロかよ", "88888888", "ファッ!?", "鳥肌たった", "うおおお"],
  good:    ["いいぞいいぞ", "おっ", "安定してる", "丁寧だなぁ", "うまい", "ここから上げてけ", "ナイス", "おちついてる"],
  miss:    ["あー", "おしいっ", "ドンマイ", "巻き返せ！", "緊張してる？", "まだいける", "がんば", "ここから"],
  serve:   ["もう完成したの!?", "提供はやっ", "早ぇｗ", "段取りいいな", "迷いがない", "仕事はやい"],
  block:   ["きたきた", "次の工程だ", "見せ場ｷﾀ", "ここ大事", "おっ動いた", "ふむふむ"],
  rival:   ["ライバルも本気だ", "他のもいい匂いしそう", "接戦になりそう", "向こうも仕上げてる"],
};

function broadcastActive() { return !!(tt && tt.mode === "tournament"); }

function ensureBroadcast() {
  if (!broadcastActive()) return null;
  const stage = $("#screen-tournament");
  let lane = document.getElementById("tn-comments");
  if (!lane) { lane = document.createElement("div"); lane.id = "tn-comments"; stage.appendChild(lane); }
  let feel = document.getElementById("tn-feel");
  if (!feel) {
    feel = document.createElement("div"); feel.id = "tn-feel";
    feel.innerHTML = `<span class="tf-label">体感スコア</span><span class="tf-num" id="tn-feel-num">0</span><span class="tf-p">P</span>`;
    stage.appendChild(feel);
  }
  return { lane, feel };
}

function resetBroadcast() {
  if (tt) tt.feelScore = 0;
  const lane = document.getElementById("tn-comments"); if (lane) lane.innerHTML = "";
  const num = document.getElementById("tn-feel-num"); if (num) num.textContent = "0";
  const feel = document.getElementById("tn-feel"); if (feel) feel.classList.remove("show");
}

// ニコ動風コメントを1本流す（右→左）
function nicoComment(text, opts = {}) {
  const b = ensureBroadcast(); if (!b) return;
  const c = document.createElement("div");
  c.className = "nico" + (opts.cls ? " " + opts.cls : "");
  c.textContent = text;
  const row = opts.row != null ? (opts.row % 6) : Math.floor(Math.random() * 6);
  c.style.top = `${5 + row * 13}%`;
  const dur = opts.dur || (4.2 + Math.random() * 1.8);
  c.style.animationDuration = `${dur}s`;
  b.lane.appendChild(c);
  setTimeout(() => c.remove(), dur * 1000 + 250);
}

function nicoBurst(kind, n) {
  const pool = NICO_POOL[kind] || [];
  if (!pool.length) return;
  n = n != null ? n : (kind === "perfect" ? 3 : kind === "miss" ? 2 : 2);
  for (let i = 0; i < n; i++) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => nicoComment(t, { cls: kind === "perfect" || kind === "miss" || kind === "rival" ? kind : "", row: i }), i * 170);
  }
}

// 体感スコア加点＋「+N P」ポップ
function feelPop(pts, label) {
  const b = ensureBroadcast(); if (!b || !(pts > 0)) return;
  tt.feelScore = (tt.feelScore || 0) + pts;
  const num = document.getElementById("tn-feel-num");
  if (num) { num.textContent = String(tt.feelScore); num.classList.remove("bump"); void num.offsetWidth; num.classList.add("bump"); }
  b.feel.classList.add("show");
  const pop = document.createElement("div");
  pop.className = "feel-pop";
  pop.innerHTML = `+${pts}<span class="fp-p">P</span>${label ? `<small>${label}</small>` : ""}`;
  b.feel.appendChild(pop);
  setTimeout(() => pop.remove(), 1150);
}

// 判定（perfect/just/great/good/miss）→ 体感スコアとコメントへ一括反映
const FEEL_PTS = { perfect: 12, just: 11, great: 10, good: 6, miss: 0 };
const FEEL_NICO = { perfect: "perfect", just: "perfect", great: "perfect", good: "good", miss: "miss" };
function broadcastJudge(result, label) {
  if (!broadcastActive()) return;
  const pts = FEEL_PTS[result] != null ? FEEL_PTS[result] : 6;
  if (pts > 0) feelPop(pts, label || (FEEL_PTS[result] != null && pts >= 10 ? "GREAT" : ""));
  nicoBurst(FEEL_NICO[result] || "good");
}

// #20 工程ブロックの頭でMCが前振り＋数ブロックに一度ライバルの動きも実況（#26）
const MC_BLOCK = {
  theme:    "さあ、はじめ選手！　まずはコンセプト決めだ！",
  mix:      "配合に入ったァ！　どんな一台を組む！？",
  pack:     "詰めの工程！　ここで密度が決まるぞ！",
  foil:     "アルミ巻きィ！　穴あけのリズムに注目だ！",
  coalfire: "炭起こし！　芯がピカッと閃く瞬間を狙えっ！",
  steam:    "蒸らしに入った……ここはじっくり待つ！",
  adjust:   "第2ラウンド、調整だ！　今の温度を読めるか！？",
  pull:     "いよいよ吸い出し──提供はもう目前だァ！",
};
// #26 ライバル実況フィード: 工程が進むほど「どのライバルが何を完了したか」が順に流れる＝ライブ感。
// 実際のライバル制作は数値だけだが、提供までの進行を台本で見せる（はじめより少し速い緊張感）
const RIVAL_FEED = [
  "おっと、なる選手はもう配合を終えた！　速いィ！",
  "アダム選手、ダブルアップルを詰め始めたぞ！",
  "みんと選手、丁寧にアルミを巻いている！",
  "なる選手、炭を置いたァ！　手際がいい！",
  "アダム選手、蒸らしに入りました……勝負所だ！",
  "なる選手、早くも吸い出し——提供間近か！？",
  "みんと選手、危なげなく仕上げてきた！",
  "アダム選手、提供完了ッ！　会場がどよめく！",
];
let rivalFeedIdx = 0;
function mcBlockIntro(step) {
  if (!broadcastActive()) return;
  const line = MC_BLOCK[step];
  if (!line) return;
  ticker(line);
  nicoBurst("block", 1);
  // 各ブロックでライバルの進行を順に1つ流す＝はじめと並走している実況感（#26）
  if (rivalFeedIdx < RIVAL_FEED.length) {
    const r = RIVAL_FEED[rivalFeedIdx++];
    setTimeout(() => { if (broadcastActive()) { ticker(r); nicoBurst("rival", 1); } }, 2700);
  }
}

// 大会は3ラウンド制: R1=組み立て（setup〜steam）→ R2=調整（adjust＋focus）→ R3=提供（吸い出し）。
// ラウンドの切れ目で ch1_tournament_r1〜r3_end の会話が挟まる。
// プレゼン工程は廃止（2026-06-12 オーナー決定）。提供の佇まいは魅力としてスコアに残る
const STEP_FLOW = [
  ["setup_bowl", "SETUP"], ["setup_hms", "SETUP"], ["setup_charcoal", "SETUP"],
  ["theme", "FLAVOR"], ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"],
  ["coal", "SET"], ["coalfire", "HEAT"], ["steam", "STEAM"],
  ["adjust", "ROUND2"], ["focus", "FOCUS"], ["pull", "PULL"],
];
// 前日リハーサル: 短縮の通し（穴あけ・炭起こし・集中は無難な値で省略）
const REHEARSAL_FLOW = [
  ["theme", "THEME"], ["mix", "MIX"], ["pack", "PACK"], ["coal", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
// 練習ドリル: 本番ミニゲームを単体で回す
const DRILL_FLOWS = {
  foil: [["foil", "FOIL"]],
  coalfire: [["coalfire", "COAL"]],
  steam: [["steam", "STEAM"]],
  pull: [["pull", "PULL"]],
  focus: [["focus", "FOCUS"]],
};

const FLAVOR_COLORS = {
  mint: "#8fe3c0", double_apple: "#d96a6a", blueberry: "#7d8df0",
  vanilla: "#f0e3b0", pineapple: "#f0d060", coconut: "#f3f3ef",
  strawberry: "#e9687c", grape: "#9b71dc", rose: "#e78bb4",
  nightside_earlgrey: "#b78d4e",
};

const MAKING_WORKBENCH_STEPS = new Set([
  "setup_bowl", "setup_hms", "setup_charcoal", "theme", "mix", "pack", "foil",
  "coal", "coalfire", "steam", "adjust", "focus", "pull",
]);
const MAKING_SCENE = {
  setup_bowl: "setup", setup_hms: "setup", setup_charcoal: "setup",
  theme: "theme", mix: "mix", pack: "pack", foil: "foil",
  coal: "coal", coalfire: "coalfire", steam: "steam",
  adjust: "adjust", focus: "focus", pull: "pull",
};
const MAKING_PANEL_SKIP = /審査|中間発表|FLAVOR TRIAL|講評|結果|練習結果/;

function hasMakingAsset(name) {
  return !!(name && (D.making_assets || []).includes(name));
}
function setMakingAsset(el, name) {
  if (!el || !name) return;
  el.dataset.asset = name.replace(/\.png$/, "");
  if (hasMakingAsset(name)) {
    el.style.backgroundImage = `url('${assetUrl(`assets/ui/making/${name}`)}')`;
    el.classList.remove("missing");
  } else {
    el.classList.add("missing");
  }
}
function makingLayer(name, cls) {
  const el = document.createElement("div");
  el.className = `making-layer ${cls || ""}`;
  setMakingAsset(el, name);
  return el;
}
function bowlMakingAsset(filled = false) {
  if (filled && tt && tt.pack) {
    return ({ fluffy: "bowl_packed_airy.png", normal: "bowl_packed_normal.png", firm: "bowl_packed_firm.png" })[tt.pack] || "bowl_packed_normal.png";
  }
  if (tt && String(tt.bowl || "").includes("suyaki")) return "bowl_empty_clay.png";
  if (tt && tt.bowl === "hagal_80beat") return "bowl_empty_phunnel.png";
  return "bowl_empty_silicone.png";
}
function mixTotalGrams() {
  return tt ? Object.values(tt.mix || {}).reduce((a, b) => a + b, 0) : 0;
}
function leafPileAsset(total = mixTotalGrams()) {
  if (total <= 0) return "";
  if (total < 4) return "leaf_pile_1.png";
  if (total < 8) return "leaf_pile_2.png";
  if (total < 12) return "leaf_pile_3.png";
  return "leaf_pile_4.png";
}
function coalHeatAsset() {
  if (!tt || tt.step === "coal") return "coal_cold.png";
  if (tt.coalFire === "perfect") return "coal_white.png";
  if (tt.coalFire === "miss") return "coal_cold.png";
  return "coal_red.png";
}
function zeroSteamUnlocked() {
  if (!state) return false;
  return !!(
    state.flags._kumicho_zero_steam ||
    (state.affinity && (state.affinity.kumicho || 0) > 0) ||
    (state.affinityPts && (state.affinityPts.kumicho || 0) > 0) ||
    (state.visits && (state.visits.kumicho || 0) >= 2)
  );
}
function availableSteamOptions() {
  return STEAMS.filter((s) => s.id !== 0 || zeroSteamUnlocked());
}
function renderMakingWorkbench(step, opts = {}) {
  const scene = MAKING_SCENE[step] || "setup";
  const stage = document.createElement("div");
  stage.className = `making-stage making-${scene}`;
  stage.dataset.step = scene;
  stage.appendChild(makingLayer("bench_base.png", "bench-base"));
  if (["steam", "focus", "pull"].includes(scene)) stage.appendChild(makingLayer("vignette_focus.png", "bench-vignette"));

  if (scene === "theme" || scene === "setup") {
    stage.appendChild(makingLayer("bench_note.png", "bench-note"));
    stage.appendChild(makingLayer(bowlMakingAsset(false), "bench-bowl"));
    stage.appendChild(makingLayer("jar_pour.png", "bench-jar idle"));
  } else if (scene === "mix") {
    stage.appendChild(makingLayer("mix_scale.png", "mix-scale"));
    stage.appendChild(makingLayer(bowlMakingAsset(false), "mix-bowl"));
    const pile = leafPileAsset();
    if (pile) stage.appendChild(makingLayer(pile, "mix-leaf-pile"));
    const jar = makingLayer("jar_pour.png", `mix-jar${opts.pour ? " pouring" : ""}`);
    stage.appendChild(jar);
    const display = document.createElement("div");
    display.className = "scale-display";
    display.textContent = `${mixTotalGrams().toFixed(1)}g`;
    stage.appendChild(display);
  } else if (scene === "pack") {
    stage.appendChild(makingLayer(bowlMakingAsset(true), "pack-bowl"));
    stage.appendChild(makingLayer(tt && tt.pack === "firm" ? "hand_press.png" : "hand_fork.png", "pack-hand"));
  } else if (scene === "foil") {
    stage.appendChild(makingLayer("foil_surface.png", "foil-sheet"));
    if (tt && tt.foilHits > 0) stage.appendChild(makingLayer("hole_punched.png", "foil-holes"));
    stage.appendChild(makingLayer("hand_pin.png", "foil-hand"));
  } else if (scene === "coal" || scene === "coalfire") {
    stage.appendChild(makingLayer("stove_coil.png", "stove-coil"));
    stage.appendChild(makingLayer(coalHeatAsset(), "stove-coal coal-a"));
    stage.appendChild(makingLayer(coalHeatAsset(), "stove-coal coal-b"));
    if ((tt && tt.coal) !== "two") stage.appendChild(makingLayer(coalHeatAsset(), "stove-coal coal-c"));
    if (tt && tt.coal === "four") stage.appendChild(makingLayer(coalHeatAsset(), "stove-coal coal-d"));
    stage.appendChild(makingLayer(scene === "coalfire" ? "hand_tongs_closed.png" : "hand_tongs_open.png", "tongs-hand"));
  } else if (scene === "steam") {
    stage.appendChild(makingLayer("steam_wait_bg.png", "steam-rig"));
    stage.appendChild(makingLayer("heat_glow.png", "heat-glow"));
    const pulse = document.createElement("div");
    pulse.className = "heartbeat-focus";
    stage.appendChild(pulse);
  } else if (scene === "adjust" || scene === "focus") {
    stage.appendChild(makingLayer("steam_wait_bg.png", "steam-rig"));
    stage.appendChild(makingLayer("heat_glow.png", "heat-glow soft"));
    stage.appendChild(makingLayer("hand_tongs_open.png", "tongs-hand adjust"));
  } else if (scene === "pull") {
    stage.appendChild(makingLayer("serve_hose.png", "serve-hose"));
    stage.appendChild(makingLayer("hose_tip.png", "hose-tip"));
    stage.appendChild(makingLayer("smoke_thick.png", "pull-smoke"));
  }
  return stage;
}
function refreshMakingWorkbench(opts = {}) {
  const old = document.querySelector("#tn-body .making-stage");
  if (!old || !tt) return;
  old.replaceWith(renderMakingWorkbench(tt.step, opts));
}
function playMakingMotion(cls, ms = 700) {
  const stage = document.querySelector("#tn-body .making-stage");
  if (!stage) return;
  stage.classList.remove(cls);
  void stage.offsetWidth;
  stage.classList.add(cls);
  setTimeout(() => stage.classList.remove(cls), ms);
}
function isMakingWorkbenchPanel(title) {
  return !!(tt && MAKING_WORKBENCH_STEPS.has(tt.step) && !MAKING_PANEL_SKIP.test(title || ""));
}

// うしろめたさ（guilt）の段階。数値は見せず、リグの煙の濁りだけで表現する。
// つむぎの「……今日の色、わたしの知らない色」検知と同じものを、プレイヤーだけが先に見ている
function guiltTier() {
  const g = (state && state.guilt) || 0;
  return g >= 5 ? 3 : g >= 3 ? 2 : g >= 1 ? 1 : 0;
}

function buildRig() {
  const rig = $("#tn-rig");
  rig.innerHTML = `
    <div class="rig-label">WORKBENCH</div>
    <div class="rig${guiltTier() ? ` guilt-${guiltTier()}` : ""}">
      <div class="rig-smokes"></div>
      <div class="rig-coals"></div>
      <div class="rig-foil">${'<span class="rig-hole"></span>'.repeat(6)}</div>
      <div class="rig-bowl"><div class="rig-flavor"></div></div>
      <div class="rig-tray"></div>
      <div class="rig-stem"></div>
      <div class="rig-hose"></div>
      <div class="rig-base"><div class="rig-water"></div></div>
    </div>`;
}

function updateRig() {
  if (!tt) return;
  // フレーバーの充填
  const total = Object.values(tt.mix).reduce((a, b) => a + b, 0);
  const fl = $("#tn-rig .rig-flavor");
  if (fl) {
    fl.style.height = `${Math.round((total / 12) * 88)}%`;
    const entries = Object.entries(tt.mix);
    if (entries.length === 1) {
      fl.style.background = FLAVOR_COLORS[entries[0][0]] || "#c77";
    } else if (entries.length > 1) {
      let acc = 0;
      const stops = entries.map(([id, g]) => {
        const from = (acc / total) * 100;
        acc += g;
        const to = (acc / total) * 100;
        return `${FLAVOR_COLORS[id] || "#c77"} ${from}% ${to}%`;
      });
      fl.style.background = `linear-gradient(to top, ${stops.join(", ")})`;
    }
  }
  // アルミ
  const foil = $("#tn-rig .rig-foil");
  if (foil) {
    foil.classList.toggle("on", tt.foilDone === true);
    foil.querySelectorAll(".rig-hole").forEach((h, i) => h.classList.toggle("lit", i < tt.foilHits));
  }
  // 炭
  const coals = $("#tn-rig .rig-coals");
  if (coals) {
    const n = tt.coal === "two" ? 2 : tt.coal === "four" ? 4 : tt.coal === "triangle" ? 3 : 0;
    coals.innerHTML = '<span class="rig-coal"></span>'.repeat(n);
    coals.classList.toggle("on", n > 0 && tt.coalFire !== null);
  }
}

function spawnSmokePuff() {
  const layer = $("#tn-rig .rig-smokes");
  if (!layer) return;
  const puff = document.createElement("div");
  puff.className = "smoke-puff";
  const size = 18 + Math.random() * 26;
  puff.style.width = puff.style.height = `${size}px`;
  puff.style.left = `${70 + (Math.random() * 40 - 20)}px`;
  puff.style.top = `${40 + Math.random() * 14}px`;
  layer.appendChild(puff);
  setTimeout(() => puff.remove(), 2700);
}

function startRigSmoke(rate) {
  clearInterval(rigState.smokeTimer);
  rigState.smokeTimer = setInterval(spawnSmokePuff, rate);
}

function spawnBubbles(count) {
  const base = $("#tn-rig .rig-base");
  if (!base) return;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const b = document.createElement("div");
      b.className = "rig-bubble";
      b.style.left = `${20 + Math.random() * 70}px`;
      base.appendChild(b);
      setTimeout(() => b.remove(), 950);
    }, i * 90);
  }
}

function stopRigEffects() {
  clearInterval(rigState.smokeTimer);
  clearInterval(rigState.bubbleTimer);
  rigState.smokeTimer = 0;
  rigState.bubbleTimer = 0;
}

// #27 入場演出: プロレス風にライバル→主人公を順に紹介。各ライバルのカードに、スミさんの
// 事前ブリーフィング（対戦相手の特徴解説）を重ねる。お祈り/立ち絵の専用画像は生成待ちのため、
// 顔アイコン（あれば）＋名前＋異名＋スミさんの一言で骨組み。クリックでも自動でも進む（テスト安全）。
const ENTRANCE = {
  naru:  { ring: "孤高の探求者", note: "なる……人格者だが、煙は別人だ。基礎が異常に堅い。崩れねえぞ。" },
  adam:  { ring: "ダブルアップルの匠", note: "アダムは一点突破。ダブルアップル一本で会場を甘さに沈める。正面から殴り合うな。" },
  minto: { ring: "甘い嵐", note: "みんと……年齢は知らん。だが緩急で揺さぶる老獪さがある。乗せられるな。" },
  hajime: { ring: "tonari の新星", note: "" },
};
function entranceIntro(onDone) {
  showScreen("#screen-tournament");
  // 直前の工程（チュートリアル/バイト）の残骸を消す。残しておくと入場中に古いボタン/見出しが
  // 見えてしまい、自動操作（playTnStep）も古い見出しに反応して詰まる
  $("#tn-title").textContent = ""; $("#tn-progress").textContent = ""; $("#tn-hint").textContent = "";
  $("#tn-body").innerHTML = "";
  let ov = document.getElementById("tn-entrance");
  if (!ov) { ov = document.createElement("div"); ov.id = "tn-entrance"; $("#screen-tournament").appendChild(ov); }
  ov.className = "tn-entrance show";
  const list = [...RIVALS, { id: "hajime", name: "はじめ" }]; // ライバル紹介 → 主人公が最後に入場
  let i = 0;
  const showOne = () => {
    if (i >= list.length) { ov.className = "tn-entrance"; ov.innerHTML = ""; if (onDone) onDone(); return; }
    const c = list[i++];
    const e = ENTRANCE[c.id] || { ring: c.name, note: "" };
    const isMe = c.id === "hajime";
    const face = faceIconHtml(c.id, "ent-face") || `<span class="ent-face-ph">${isMe ? "あなた" : "？"}</span>`;
    ov.innerHTML =
      `<div class="ent-card${isMe ? " me" : ""}">` +
        `<div class="ent-cut">${face}<span class="ent-cut-tag">${isMe ? "CHALLENGER" : "RIVAL"}</span></div>` +
        `<div class="ent-meta">` +
          `<div class="ent-ring">${e.ring || ""}</div>` +
          `<div class="ent-name">${c.name}<small>選手</small></div>` +
          `<div class="ent-note">${e.note ? `スミ「${e.note}」` : (isMe ? "スミ「──行ってこい。お前の煙を見せてやれ」" : "")}</div>` +
        `</div></div>`;
    const card = ov.querySelector(".ent-card");
    requestAnimationFrame(() => card.classList.add("in"));
    if (window.SFX) (isMe ? SFX.fanfare() : SFX.select());
    let advanced = false;
    const adv = () => { if (advanced) return; advanced = true; ov.removeEventListener("click", adv); clearTimeout(timer); showOne(); };
    ov.addEventListener("click", adv);
    const timer = setTimeout(adv, isMe ? 2400 : 2000);
  };
  showOne();
}

function startTournament() {
  state.phase = "tournament";
  // 会場ではMCが出場者と審査員を紹介する（名前の開示）
  for (const id of ["naru", "adam", "minto", "nagumo", "maezono"]) markMet(id);
  updateHud();
  save();
  // 出発前に「持参フレーバー」を確認。未仕入れならスミさんがお情けで分けてくれる（#44）
  flavorBringIn(() =>
    // 会場へ歩み入る瞬間を煙ワイプで（master_spec #20）
    smokeWipe(() => playDialogue("ch1_tournament_arrival", () =>
      playDialogue("ch1_tournament_opening", () => entranceIntro(() => beginMaking()), "res://assets/backgrounds/bg_tournament_stage.png")
    ))
  );
}

// 大会前の持参フレーバー確認（#44 持参制）。仕入れ済み＝持参、未仕入れ＝スミさんのお情け（強制購入はしない）
function flavorBringIn(next) {
  if (state.chapter !== 1) return next();
  const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
  if (state.flags._flavor_stocked) {
    return playCustom({
      dialogue_id: "flavor_brought",
      metadata: { bg: TONARI },
      lines: [
        { speaker: "", face: "", text: "会場へ向かう前に、仕入れておいた本番用のフレーバーをケースに並べていく。……準備は、できている。" },
      ],
    }, next);
  }
  state.flags._flavor_rescued = true;
  return playCustom({
    dialogue_id: "flavor_rescue",
    metadata: { bg: TONARI },
    lines: [
      { speaker: "", face: "", text: "会場へ向かおうとして、気づく。……本番用のフレーバーを、仕入れ忘れていた。" },
      { speaker: "hajime", face: "sad", text: "（やってしまった……手持ちが、ほとんどない）" },
      { speaker: "sumi", face: "normal", text: "……持ってきてねえのか。しょうがねえ奴だな" },
      { speaker: "", face: "", text: "スミさんが棚の奥から小さな缶を出して、ぽんと寄越した。" },
      { speaker: "sumi", face: "normal", text: "ダブルアップル、一回分だ。足りる範囲でやりくりしろ。……次はちゃんと仕入れてから来い" },
      { speaker: "hajime", face: "normal", text: "……すみません。ありがとうございます" },
    ],
  }, next);
}

// mode: "tournament"（既定）| "tutorial"（開幕の通し体験）| "baito"（オーダーチャレンジ）
//       | "rehearsal"（DAY6夜の前日リハーサル）
function beginMaking(mode) {
  mode = mode || "tournament";
  rivalFeedIdx = 0; // ライバル実況フィードを頭出し（#26）
  tt = {
    mode,
    bowl: null, hms: null, charcoal: null,
    theme: null, mix: {}, pack: null,
    foilHits: 0, foilDone: false, holeResult: null, coalFire: null, coalResult: null, coal: null, steam: null,
    steamHits: null, focusCleared: 0, pull: null, temp: null, pullCount: 0, step: "",
  };
  stopRigEffects();
  buildRig();
  resetBroadcast(); // 体感スコア・ニコ動コメントを初期化（本番のみ実体が出る）
  if (mode === "baito") {
    // お客さんのリクエスト（テーマ）は日替わり。大会同様のフル工程で作る
    tt.theme = dailyTheme();
    tt.focusCleared = 3; // 接客中なので集中ミニゲームは無し
    return tournamentStep("mix");
  }
  if (mode === "rehearsal") {
    tt.foilHits = 5;
    tt.coalFire = "good";
    tt.focusCleared = 3;
    return tournamentStep("theme");
  }
  tournamentStep(mode === "tutorial" ? "theme" : "setup_bowl");
}

// 練習ドリル: 本番のミニゲームを1種だけ回す
function startDrill(kind) {
  addStamina(-STAMINA_COST.practice);
  tt = {
    mode: "drill", drill: kind,
    bowl: null, hms: null, charcoal: null,
    theme: THEMES[0], mix: {}, pack: null,
    foilHits: 0, foilDone: false, holeResult: null, coalFire: null, coalResult: null, coal: null, steam: null,
    steamHits: null, focusCleared: 0, pull: null, temp: null, pullCount: 0, step: "",
  };
  stopRigEffects();
  buildRig();
  tournamentStep(kind);
}

function makingFlow() {
  if (!tt) return STEP_FLOW;
  if (tt.mode === "tutorial") return TUTORIAL_FLOW;
  if (tt.mode === "baito") return BAITO_FLOW;
  if (tt.mode === "rehearsal") return REHEARSAL_FLOW;
  if (tt.mode === "drill") return DRILL_FLOWS[tt.drill] || STEP_FLOW;
  return STEP_FLOW;
}

// フロー定義に沿って次の工程へ。終端ならモード別の締めへ
function tnNext(cur) {
  const flow = makingFlow();
  const i = flow.findIndex(([k]) => k === cur);
  if (i >= 0 && i < flow.length - 1) return tournamentStep(flow[i + 1][0]);
  if (tt.mode === "tutorial") return finishTutorial();
  if (tt.mode === "baito") return finishBaitoOrder();
  if (tt.mode === "drill") return finishDrill();
  if (tt.mode === "rehearsal") return finishRehearsal();
  return finishTournament();
}

function tnPanel(title, hint) {
  showScreen("#screen-tournament");
  const workbench = isMakingWorkbenchPanel(title);
  $("#screen-tournament").classList.toggle("making-workbench", workbench);
  $("#screen-tournament").dataset.makingStep = workbench && tt ? (MAKING_SCENE[tt.step] || tt.step) : "";
  const flow = makingFlow();
  const idx = flow.findIndex(([k]) => k === (tt && tt.step));
  const head =
    tt && tt.mode === "tutorial" ? "TUTORIAL "
    : tt && tt.mode === "baito" ? "ORDER "
    : tt && tt.mode === "drill" ? "DRILL "
    : tt && tt.mode === "rehearsal" ? "REHEARSAL "
    : "STEP ";
  $("#tn-progress").innerHTML = idx >= 0
    ? `${head}${idx + 1}/${flow.length}・${flow[idx][1]} <span class="tn-steps">${flow.map(([, t], i) => (i <= idx ? "●" : "○")).join("")}</span>`
    : "RESULT";
  $("#tn-title").textContent = title;
  $("#tn-hint").textContent = hint || "";
  const oldTutor = document.querySelector("#tn-layout .tn-tutor");
  if (oldTutor) oldTutor.remove();
  // チュートリアルはスミさんのアドバイス、バイトはお客さんのリクエストを添える
  if (tt && tt.mode === "tutorial" && TUTORIAL_TIPS[tt.step]) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = TUTORIAL_TIPS[tt.step];
    $("#tn-hint").after(tip);
  } else if (tt && tt.mode === "drill" && DRILL_TIPS[tt.step]) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = DRILL_TIPS[tt.step];
    $("#tn-hint").after(tip);
  } else if (tt && tt.mode === "baito" && tt.theme) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = `お客さん「${tt.theme.label}な感じでお任せします」`;
    $("#tn-hint").after(tip);
  }
  const body = $("#tn-body");
  body.innerHTML = "";
  updateRig();
  if (!workbench) return body;
  body.appendChild(renderMakingWorkbench(tt.step));
  const controls = document.createElement("div");
  controls.className = `making-controls making-controls-${MAKING_SCENE[tt.step] || tt.step}`;
  body.appendChild(controls);
  return controls;
}

function optionButton(label, desc, onClick) {
  const btn = document.createElement("button");
  btn.className = "spot-btn";
  btn.innerHTML = `<span class="spot-name">${label}</span><span class="spot-desc">${desc || ""}</span>`;
  btn.addEventListener("click", onClick);
  return btn;
}

function tournamentStep(step) {
  if (tt) tt.step = step;
  mcBlockIntro(step); // #20 工程ブロックの頭でMC実況（本番のみ・対象ブロックのみ）
  if (step === "setup_bowl" || step === "setup_hms" || step === "setup_charcoal") return stepSetup(step);
  if (step === "theme") {
    const body = tnPanel("テーマ選択", "今日の一台のコンセプトを決めろ。フレーバー選びの軸になる。");
    for (const t of THEMES) body.appendChild(optionButton(t.label, t.desc, () => { tt.theme = t; tnNext("theme"); }));
    return;
  }
  if (step === "mix") return stepMix();
  if (step === "pack") {
    const body = tnPanel("パッキング", "煙の密度と質感が決まる。フレーバーの重さと相談だ。");
    for (const p of PACKS) body.appendChild(optionButton(p.label, p.desc, () => {
      tt.pack = p.id;
      tnNext("pack");
    }));
    return;
  }
  if (step === "foil") return stepFoil();
  if (step === "coalfire") return stepCoalFire();
  if (step === "coal") {
    const body = tnPanel("炭をコンロにセット", "何個の炭を熾すか決める。ここでコンロに乗せ、焼けたら次の工程で取り上げる。多いほど高火力だが焦げやすい。基本はトライアングル(3個)。");
    for (const c of COALS) body.appendChild(optionButton(c.label, c.desc, () => { tt.coal = c.id; tnNext("coal"); }));
    return;
  }
  if (step === "steam") {
    const body = tnPanel("蒸らし時間", "0/3/5/8/10分から選ぶ。0分は神崎竜二との交友で覚える、吸いながら立ち上げる型破りな技だ。");
    for (const s of availableSteamOptions()) body.appendChild(optionButton(s.label, s.desc, () => {
      tt.steam = s.id;
      if (window.SFX) SFX.select();
      // 蒸らしは湯気を出さず、タイマーと鼓動で待つ。最後に覚悟の一手を入れる
      runSteamDodge(s, () => {
        // 大会以外・ch2の各試合は観客の会話なし（ラウンド会話はch1専用テキスト）
        if (tt.mode !== "tournament" || state.chapter !== 1) return tnNext("steam");
        // ラウンド1（組み立て）終了 → 観客の会話 → R1講評 → 中間発表 → ラウンド2（調整）へ
        playDialogue("ch1_tournament_match", () =>
          playDialogue("ch1_tournament_r1_end", () => showStandings(1, () => tournamentStep("adjust")), "res://assets/backgrounds/bg_tournament_stage.png"),
          "res://assets/backgrounds/bg_tournament_stage.png");
      });
    }));
    return;
  }
  if (step === "adjust") return stepAdjust();
  if (step === "focus") return stepFocus();
  if (step === "pull") return stepPull();
}

// --- 中間発表（R1/R2後）。審査は厳しめスタートで、南雲の総合印象点が入る
// 最終結果までは、どれだけ上手くやっても1位には届かない（最大2位）
function showStandings(round, next) {
  const body = tnPanel(`ラウンド${round} 中間発表`, "技術点・個性点の暫定集計。総合印象点は最終発表で加算される。");
  const partial = craftScore().score;
  const rows = RIVALS.map((r) => ({ name: r.name, score: r.base * (round === 1 ? 0.55 : 0.8) + Math.random() * 4 }));
  rows.push({ name: "はじめ", score: partial * (round === 1 ? 0.5 : 0.72), me: true });
  rows.sort((a, b) => b.score - a.score);
  // 南雲票が入るまでは1位に行かせない（演出上のキャップ。最終採点には影響しない）
  const meIdx = rows.findIndex((r) => r.me);
  if (meIdx === 0) { const [me] = rows.splice(0, 1); rows.splice(1, 0, me); }
  const table = document.createElement("div");
  table.className = "result-table";
  rows.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "result-row" + (r.me ? " me" : "");
    row.innerHTML = `<span class="result-rank">${i + 1}位</span><span>${r.name}</span>`;
    table.appendChild(row);
  });
  const myRank = rows.findIndex((r) => r.me) + 1;
  // 審査員持ち点投入制: 各審査員は持ち点10を、大会中の好きなタイミングで投入できる
  const judges = document.createElement("p");
  judges.className = "tn-hint";
  judges.textContent = round === 1
    ? "実況パネル: 前園、R1でなるに持ち点3を投入。──南雲の持ち点は、まだ動かない（残10）。"
    : "実況パネル: 前園、残り持ち点をアダムとみんとへ。──南雲、依然ゼロ投入。持ち点10、まるごと温存。";
  const comment = document.createElement("p");
  comment.className = "tn-hint";
  comment.textContent = round === 1
    ? (myRank <= 2
        ? "前園「悪くないんだけどねぇ……決め手がもう一声、かなぁ」。──評価は渋い。でも、食らいついてはいる。"
        : "前園「うーん、まだ硬いねえ」。──思ったより、点が伸びない。会場の空気が遠い。")
    : (myRank <= 2
        ? "あの人が最後まで持ち点を残すのは「もう一口吸いたい一台」に全部入れるためだ──と、誰かが囁いた。"
        : "順位は重い。でも、南雲の持ち点10はまだ誰のものでもない。最後の吸い出しと提供で全部が変わる。");
  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.textContent = round === 1 ? "ラウンド2へ" : "最終ラウンドへ";
  btn.addEventListener("click", next);
  body.append(table, comment, btn);
  if (window.SFX) SFX.stamp();
}

// --- ラウンド2: 炭替え・調整。一箇所だけ作りを直せる
// ラウンド2（中盤の調整）: 一度組んだら詰め直し・蒸らし直しは物理的に無理。
// 動かせるのは炭の位置と数だけ（温度の最終調整は提供前の吸い出しで作る）#15
// ラウンド2: 今の温度を見て、適温（テーマ依存）からズレてたら炭で寄せる（#45/#46）。
// 詰め直し・蒸らし直しは不可。炭は新しく替えてもいいし、あえて前の炭のまま（非推奨）でもいい。
function stepAdjust() {
  const body = tnPanel("ラウンド2：炭替え・調整",
    "今の温度を見ろ。適温からズレてたら炭で寄せる。詰め直し・蒸らし直しはできない（温度の最終調整は提供前の吸い出しで）。");
  const target = pullTargetZone();
  const tw = document.createElement("div");
  tw.className = "temp-wrap";
  tw.innerHTML =
    `<div class="temp-labels"><span>ぬるい</span><span>適温</span><span>焦げる</span></div>` +
    `<div class="temp-bar"><div class="temp-zone"></div><div class="temp-marker"></div></div>` +
    `<div class="adjust-read" id="adjust-read"></div>`;
  tw.querySelector(".temp-zone").style.left = `${target[0] * 100}%`;
  tw.querySelector(".temp-zone").style.width = `${(target[1] - target[0]) * 100}%`;
  const marker = tw.querySelector(".temp-marker");
  const read = tw.querySelector("#adjust-read");
  const refresh = () => {
    const t = projectedTemp();
    marker.style.left = `${Math.round(t * 100)}%`;
    const inZone = t >= target[0] && t <= target[1];
    read.textContent = inZone ? "◎ 今の温度は適温に乗っている。" : t < target[0] ? "▽ 少しぬるい。炭を増やすと温まる。" : "△ 少し熱い。炭を減らすと落ち着く。";
    read.className = `adjust-read ${inZone ? "ok" : "warn"}`;
  };
  body.appendChild(tw);
  refresh();
  const coalRow = document.createElement("div");
  coalRow.className = "adjust-coals";
  const mark = (sel) => [...coalRow.children].forEach((x) => x.classList.toggle("sel", x === sel));
  for (const c of COALS) {
    const b = optionButton(`炭を${c.label}に替える`, c.desc, () => {
      tt.coal = c.id; if (window.SFX) SFX.select(); updateRig(); refresh(); mark(b);
    });
    if (tt.coal === c.id) b.classList.add("sel");
    coalRow.appendChild(b);
  }
  body.appendChild(coalRow);
  // 確定（炭を替えないのも手＝前の炭のまま・非推奨でも進める）。テスト互換のため「このままでいく」を残す
  body.appendChild(optionButton("このままでいく", "今の温度で勝負する", () => {
    if (window.SFX) SFX.select();
    tnNext("adjust");
  }));
}

function redoAdjust(kind) {
  const defs = {
    pack: { title: "調整：パッキング", list: PACKS, set: (v) => { tt.pack = v.id; } },
    coal: { title: "調整：炭の配置", list: COALS, set: (v) => { tt.coal = v.id; } },
    steam: { title: "調整：蒸らし", list: availableSteamOptions(), set: (v) => { tt.steam = v.id; } },
  }[kind];
  const body = tnPanel(defs.title, "やり直すならここしかない。");
  for (const v of defs.list) body.appendChild(optionButton(v.label, v.desc, () => {
    defs.set(v);
    if (window.SFX) SFX.select();
    updateRig();
    tnNext("adjust");
  }));
}

// --- 機材選択（SETUP）
function stepSetup(step) {
  const type = step.replace("setup_", "");
  const nextStep = { bowl: "setup_hms", hms: "setup_charcoal", charcoal: "theme" }[type];
  const hints = {
    bowl: "持ち込んだ機材から選ぶ。ボウルは味の土台になる。",
    hms: "熱の伝わり方が決まる。ボウルとの相性も考えろ。",
    charcoal: "炭の種類で熱の性格が変わる。",
  };
  const body = tnPanel(`機材選択 — ${EQUIP_TYPE_LABELS[type]}`, hints[type]);
  const owned = Array.isArray(state.owned) ? state.owned : STARTER_EQUIPMENT;
  for (const e of D.equipment.filter((x) => x.type === type && owned.includes(x.id))) {
    const btn = optionButton(e.name, e.description, () => { tt[type] = e.id; tournamentStep(nextStep); });
    // タヌキッシュリッドは素焼きサイズには使えない
    if (e.id === "tanukish_lid" && tt.bowl === "suyaki_hagal") {
      btn.disabled = true;
      btn.querySelector(".spot-desc").textContent = "素焼きハガルには使えない。";
    }
    body.appendChild(btn);
  }
}

// 汎用ゲージ: コンテナにゲージを作り、コントローラを返す
function buildGauge(container, zone, speed) {
  const wrap = document.createElement("div");
  wrap.className = "gauge-wrap";
  wrap.innerHTML = `<div class="gauge-bar"><div class="gauge-zone"></div><div class="gauge-needle"></div></div>`;
  container.appendChild(wrap);
  const zoneEl = wrap.querySelector(".gauge-zone");
  zoneEl.style.left = `${zone[0] * 100}%`;
  zoneEl.style.width = `${(zone[1] - zone[0]) * 100}%`;
  const needle = wrap.querySelector(".gauge-needle");
  const g = { pos: 0, dir: 1, running: true, raf: 0, zone };
  let last = performance.now();
  const tick = (now) => {
    if (!g.running) return;
    const dt = (now - last) / 1000;
    last = now;
    g.pos += g.dir * speed * dt;
    if (g.pos >= 1) { g.pos = 1; g.dir = -1; }
    if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
    needle.style.left = `${g.pos * 100}%`;
    g.raf = requestAnimationFrame(tick);
  };
  g.raf = requestAnimationFrame(tick);
  g.judge = () => {
    const [a, b] = g.zone;
    const center = (a + b) / 2, half = (b - a) / 2;
    if (Math.abs(g.pos - center) <= half * 0.4) return "perfect";
    return g.pos >= a && g.pos <= b ? "good" : "miss";
  };
  g.stop = () => { g.running = false; cancelAnimationFrame(g.raf); };
  return { wrap, gauge: g };
}

// ============================================================================
// HOLE RHYTHM BATTLE（アルミ穴あけ・円周カーソル式）— master_spec 第2部 #1
// アルミ盤の上をカーソルが円周状に回り、タップで穴を開ける。評価の主軸は「均等度」。
// 外周→中周→内周の3リング。各リングの役割（熱拡散/ドロー/抜け）で完成品ステータスが変わる。
// 出力: tt.foilHits（0-6・既存craftScore互換）＋ tt.holeResult（FLAVOR TRIAL用の詳細）
// ============================================================================
const HOLE_RINGS = [
  { key: "outer", label: "外周", r: 0.80, target: 8, role: "熱拡散・安定", hue: 28 },
  { key: "middle", label: "中周", r: 0.55, target: 6, role: "ドロー・煙量", hue: 200 },
  { key: "inner", label: "内周", r: 0.30, target: 4, role: "抜け・攻め", hue: 330 },
];
// 角度ギャップの均等度（0..1）。穴が円周に均等なら1に近い
function ringEvenness(angles) {
  if (angles.length < 2) return angles.length === 1 ? 0.5 : 0;
  const s = [...angles].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 0; i < s.length; i++) gaps.push(((s[(i + 1) % s.length] - s[i] + 360) % 360) || 360);
  const ideal = 360 / s.length;
  let dev = 0;
  for (const g of gaps) dev += Math.abs(g - ideal);
  // 平均ズレを ideal で正規化。0ズレ=1.0、ideal分ズレ=0
  return Math.max(0, 1 - dev / gaps.length / ideal);
}

function stepFoil() {
  const body = tnPanel("HOLE RHYTHM BATTLE ── アルミ穴あけ",
    "カーソルは何周でも回せる（周回数での減点はなし）。大事なのは穴の“均等さ”。穴が多いほど煙は抜けるが外気も吸い、少ないほど熱がこもる──狙いに合わせて。");
  const isDrill = tt.mode === "drill";

  const arena = document.createElement("div");
  arena.className = "hole-arena";
  arena.innerHTML = `
    <div class="hole-board" id="hole-board">
      <div class="hole-ring r-outer"></div>
      <div class="hole-ring r-middle"></div>
      <div class="hole-ring r-inner"></div>
      <div class="hole-core"></div>
      <div class="hole-cursor" id="hole-cursor"><i></i></div>
      <div class="hole-aim" id="hole-aim"></div>
      <div class="hole-dots" id="hole-dots"></div>
      <div class="hole-callout" id="hole-callout"></div>
    </div>
    <div class="hole-side">
      <div class="hole-readout">
        <div class="hole-ringname" id="hole-ringname">外周</div>
        <div class="hole-rolename" id="hole-rolename">熱拡散・安定</div>
        <div class="hole-meter"><span>均等度</span><i class="hole-meter-bar"><b id="hole-even"></b></i></div>
        <div class="hole-count" id="hole-count"></div>
      </div>
      <button class="primary-btn hole-punch" id="hole-punch">穴を開ける</button>
      <button class="primary-btn ghost hole-advance" id="hole-advance">次の周へ ▶</button>
      <button class="primary-btn ghost hole-finish" id="hole-finish">ここで切り上げる ▶</button>
    </div>`;
  body.appendChild(arena);
  const result = document.createElement("div");
  result.className = "practice-result";
  body.appendChild(result);

  const board = arena.querySelector("#hole-board");
  const cursor = arena.querySelector("#hole-cursor");
  const aim = arena.querySelector("#hole-aim");
  const dotsEl = arena.querySelector("#hole-dots");
  const calloutEl = arena.querySelector("#hole-callout");
  const punchBtn = arena.querySelector("#hole-punch");
  const advBtn = arena.querySelector("#hole-advance");
  const finishBtn = arena.querySelector("#hole-finish"); // 1週/2週で切り上げる（#28）

  const ringData = HOLE_RINGS.map((r) => ({ ...r, angles: [] }));
  let ringIdx = 0;
  let angle = -90;            // 現在のカーソル角（度）
  const speed = 150 - Math.min(70, state.stats.technique * 0.7); // 技術が高いほどゆっくり=狙いやすい（deg/s）
  let raf = 0, last = performance.now(), running = true;

  const callout = (text, cls) => {
    calloutEl.textContent = text;
    calloutEl.className = `hole-callout show ${cls || ""}`;
    setTimeout(() => calloutEl.classList.remove("show"), 620);
  };
  const setRingUI = () => {
    const r = ringData[ringIdx];
    arena.querySelector("#hole-ringname").textContent = r.label;
    arena.querySelector("#hole-rolename").textContent = r.role;
    board.dataset.ring = r.key;
    advBtn.textContent = ringIdx < ringData.length - 1 ? "次の周へ ▶" : "穴あけを仕上げる ▶";
    // 最終リングは advBtn 自体が仕上げる＝切り上げボタンは不要。1周/2周で切り上げたい時だけ出す
    finishBtn.style.display = ringIdx < ringData.length - 1 ? "" : "none";
    refreshMeter();
  };
  const refreshMeter = () => {
    const r = ringData[ringIdx];
    const even = ringEvenness(r.angles);
    arena.querySelector("#hole-even").style.width = `${Math.round(even * 100)}%`;
    arena.querySelector("#hole-count").textContent = `穴 ${r.angles.length} / ${r.target}`;
    advBtn.disabled = r.angles.length < 1;
    finishBtn.disabled = r.angles.length < 1;
  };

  const tick = (now) => {
    if (!running) return;
    const dt = (now - last) / 1000; last = now;
    angle = (angle + speed * dt) % 360;
    cursor.style.transform = `rotate(${angle}deg)`;
    // いま穴があく位置（アクティブなリング上の狙い）を可視化（#11）
    const ar = ringData[ringIdx].r * 50;
    aim.style.left = `${50 + Math.cos((angle - 90) * Math.PI / 180) * ar}%`;
    aim.style.top = `${50 + Math.sin((angle - 90) * Math.PI / 180) * ar}%`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const placeDot = (ringR, a, hue) => {
    const dot = document.createElement("span");
    dot.className = "hole-dot";
    const pr = ringR * 50; // %半径（盤の半径=50%）
    const x = 50 + Math.cos((a - 90) * Math.PI / 180) * pr;
    const y = 50 + Math.sin((a - 90) * Math.PI / 180) * pr;
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.style.setProperty("--hue", hue);
    dotsEl.appendChild(dot);
    requestAnimationFrame(() => dot.classList.add("on"));
  };

  punchBtn.addEventListener("click", () => {
    if (!running) return;
    const r = ringData[ringIdx];
    if (r.angles.length >= 16) { callout("もう十分だ", "warn"); return; } // 物理上限のみ
    if (r.angles.length >= r.target + 2) callout("TOO MANY", "warn"); // 開けすぎは均等度・焦げリスクに響く（開けるのは自由）
    // 近すぎる穴チェック（過密ペナルティの気づき）
    const tooClose = r.angles.some((x) => { const d = Math.abs(((x - angle + 540) % 360) - 180); return (180 - d) < 14; });
    r.angles.push(angle);
    placeDot(r.r, angle, r.hue);
    if (window.SFX) SFX.foil();
    if (tooClose) callout("TOO CLOSE", "warn");
    else if (r.angles.length === r.target && ringEvenness(r.angles) > 0.8) callout("BEAUTIFUL RING", "great");
    else callout("PUNCH", "");
    refreshMeter();
    if (r.angles.length >= r.target) advBtn.classList.add("ready");
  });

  const finishRing = () => {
    const r = ringData[ringIdx];
    const even = ringEvenness(r.angles);
    if (even > 0.82 && r.angles.length >= r.target) { callout("RING COMPLETE", "great"); showStamp(board, "just"); feelPop(6, "RING"); nicoBurst("good", 1); }
    else callout("AIR FLOW", even > 0.6 ? "" : "warn");
    advBtn.classList.remove("ready");
    if (ringIdx < ringData.length - 1) {
      ringIdx++;
      setRingUI();
    } else {
      finishHole();
    }
  };
  advBtn.addEventListener("click", finishRing);
  finishBtn.addEventListener("click", finishHole); // 今のリングで切り上げ（#28）

  function finishHole() {
    running = false; cancelAnimationFrame(raf);
    punchBtn.disabled = true; advBtn.disabled = true;
    // ---- 評価: 仕上がりは「均等度」だけで見る。周回数(リング数)・穴の数による減点はしない（T22-B）。
    //      穴の数は減点ではなく「抜け⇄熱のこもり」のトレードオフとして温度/審査に効く。
    let evenSum = 0, totalHoles = 0, doneRings = 0;
    const per = { outer: { holes: 0, evenness: 0 }, middle: { holes: 0, evenness: 0 }, inner: { holes: 0, evenness: 0 } };
    for (const r of ringData) {
      const ev = ringEvenness(r.angles);
      if (r.angles.length > 0) { evenSum += ev; doneRings++; } // 開けた周だけで均等度を平均（何周でも自由）
      totalHoles += r.angles.length;
      per[r.key] = { holes: r.angles.length, evenness: Math.round(ev * 100) };
    }
    const nDone = Math.max(1, doneRings);
    const evenAvg = evenSum / nDone;
    const quality = evenAvg; // 職人の腕＝均等度。何周開けても、開けた周がきれいなら高評価（周回減点なし）
    // 既存craftScore互換: foilHits 0-6
    tt.foilHits = Math.round(quality * 6);
    tt.foilDone = true;
    // FLAVOR TRIAL / 温度用の詳細。穴の数 = 抜け⇄熱のトレードオフ（基準は中庸の18穴）
    tt.holeResult = {
      score: Math.round(quality * 100),
      evenness: Math.round(evenAvg * 100),
      totalHoles,
      outerHoles: per.outer.holes, middleHoles: per.middle.holes, innerHoles: per.inner.holes,
      draw: Math.min(100, totalHoles * 5),               // 穴が多いほど煙が抜けやすい
      outsideAir: Math.max(0, (totalHoles - 18) * 7),    // 開けすぎ＝外気を吸いやすい
      heatRetention: Math.max(0, (16 - totalHoles) * 6), // 少なめ＝熱がこもりやすい
      burnRisk: Math.max(0, (per.inner.holes - 4) * 12),
      heatSpread: per.outer.evenness,
    };
    const rank = quality >= 0.85 ? "perfect" : quality >= 0.6 ? "good" : "miss";
    showStamp(board, rank === "perfect" ? "just" : rank);
    pakkiLive(rank);
    broadcastJudge(rank, "穴あけ");
    if (rank === "perfect") smokeRings(3);
    const heatNote = totalHoles <= 13 ? "穴は少なめ──熱がこもりやすい一台だ。"
      : totalHoles >= 22 ? "穴は多め──よく抜けるが、外気も吸いやすい。"
      : "抜けと熱が、ちょうどいい穴数だ。";
    result.innerHTML =
      (quality >= 0.85 ? "──寸分違わぬ円。どのリングも穴が均等に散って、空気の通り道が整った。"
      : quality >= 0.6 ? "──悪くない穴あけ。空気はちゃんと通る。"
      : "──穴が偏った。空気の流れにムラが出そうだ……。") + heatNote +
      `<div class="hole-summary">均等度 ${Math.round(evenAvg*100)}％ ／ 穴 計${totalHoles}（外${per.outer.holes}・中${per.middle.holes}・内${per.inner.holes}）</div>`;
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = isDrill ? "結果を見る" : "次へ";
    next.addEventListener("click", () => tnNext("foil"));
    result.appendChild(next);
  }

  setRingUI();
}

// ============================================================================
// HEAT IGNITION（炭起こし・観察＆ジャスト発火）— master_spec 第2部 #2
// コンロの3つの炭を「目で見て」最適なタイミングで取り上げる。ゲージ停止ゲームではない。
// 黒→赤→赤熱→ピカン(芯が一瞬閃く)→白熱→灰かぶり と色が変化し、ピカンで取ると最高評価。
// 出力: tt.coalFire（"perfect"/"good"/"miss"・既存craftScore互換）＋ tt.coalResult（FLAVOR TRIAL用の詳細）
// ============================================================================
const HEAT_COUNT = 3;
// 炭の芯温(heat)に対する見た目。pos昇順の多段補間で色を作る
const HEAT_STOPS = [
  [0.00, [40, 38, 44]],    // 冷たい黒
  [0.26, [74, 28, 22]],    // 端がうっすら赤い
  [0.50, [156, 42, 20]],   // 赤
  [0.72, [228, 84, 28]],   // 赤熱
  [0.90, [255, 168, 96]],  // ピカン（赤さを残したまま白い芯が閃く＝炭らしさを保つ・#52）
  [1.04, [255, 232, 198]], // 白熱（焼きすぎ寄り＝ここで白くなる）
  [1.30, [176, 170, 158]], // 灰かぶり
];
function heatRGB(h) {
  const s = HEAT_STOPS;
  if (h <= s[0][0]) return s[0][1];
  if (h >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (h <= s[i][0]) {
      const p0 = s[i - 1][0], c0 = s[i - 1][1], p1 = s[i][0], c1 = s[i][1];
      const u = (h - p0) / (p1 - p0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * u));
    }
  }
  return s[s.length - 1][1];
}
// heat→評価ゾーン。JUST窓の上端は根性でわずかに広がる（そこそこ有利）
function heatZone(h, justHi) {
  if (h < 0.30) return "black";   // 生焼け
  if (h < 0.58) return "early";   // 早取り
  if (h < 0.84) return "ready";   // 適温前（赤熱）
  if (h <= justHi) return "just"; // ジャスト
  if (h <= 1.18) return "hot";    // 攻め焼き（白熱）
  return "ash";                   // 焼きすぎ（灰かぶり）
}
// 各ゾーンの品質係数と性能影響（master_spec 第2部 #2「性能影響の数値例」を踏襲）
const HEAT_GRADE = {
  black: { q: 0.15, label: "CORE BLACK",      sub: "生焼け",   heatPower: -30, heatStability: -10, startupSpeed: -30, burnRisk: -10, aromaRetention: 0 },
  early: { q: 0.40, label: "EARLY",           sub: "早取り",   heatPower: -20, heatStability: -10, startupSpeed: -20, burnRisk: -15, aromaRetention: 10 },
  ready: { q: 0.74, label: "HEAT STABLE",     sub: "適温前",   heatPower: 5,   heatStability: 15,  startupSpeed: 5,   burnRisk: -5,  aromaRetention: 20 },
  just:  { q: 1.00, label: "JUST IGNITION!!", sub: "ジャスト", heatPower: 20,  heatStability: 30,  startupSpeed: 15,  burnRisk: 0,   aromaRetention: 15 },
  hot:   { q: 0.62, label: "OVER REACH",      sub: "攻め焼き", heatPower: 25,  heatStability: -5,  startupSpeed: 20,  burnRisk: 20,  aromaRetention: -10 },
  ash:   { q: 0.10, label: "OVER HEAT",       sub: "焼きすぎ", heatPower: 35,  heatStability: -10, startupSpeed: 25,  burnRisk: 30,  aromaRetention: -20 },
};

// タイミング系ミニゲームの開始前カウントダウン（3・2・1・スタート）。
// 開始直後のシビアな判定で理不尽に外れるのを防ぐ（T22-C・必須）。onStart で本編の時計を回す
function miniCountdown(container, onStart) {
  if (!container) { onStart(); return; }
  const ov = document.createElement("div");
  ov.className = "mini-countdown";
  container.appendChild(ov);
  const seq = ["3", "2", "1", "スタート！"];
  let i = 0;
  const step = () => {
    if (i >= seq.length) { ov.remove(); onStart(); return; }
    ov.textContent = seq[i];
    ov.classList.toggle("go", i === seq.length - 1);
    ov.classList.remove("pop"); void ov.offsetWidth; ov.classList.add("pop");
    if (window.SFX) { if (i < 3) SFX.click && SFX.click(); else SFX.perfect && SFX.perfect(); }
    i++;
    setTimeout(step, i <= 3 ? 460 : 380);
  };
  step();
}

function stepCoalFire() {
  const body = tnPanel("HEAT IGNITION ── 炭起こし",
    "炭はもうコンロで赤く熾きかけている。芯がピカッと閃く、その一瞬で取り上げろ。遅れれば灰をかぶる。");
  const isDrill = tt.mode === "drill";

  const arena = document.createElement("div");
  arena.className = "heat-arena";
  arena.innerHTML = `
    <div class="heat-burner" id="heat-burner">
      <div class="heat-grate"></div>
      <div class="heat-coals" id="heat-coals"></div>
      <div class="heat-callout" id="heat-callout"></div>
    </div>
    <div class="heat-side">
      <div class="heat-readout">
        <div class="heat-title-s">IGNITION</div>
        <div class="heat-sub-s">芯の閃きを見極めろ</div>
        <div class="heat-count" id="heat-count"></div>
      </div>
    </div>`;
  body.appendChild(arena);
  const result = document.createElement("div");
  result.className = "practice-result";
  body.appendChild(result);

  const coalsEl = arena.querySelector("#heat-coals");
  const calloutEl = arena.querySelector("#heat-callout");
  const countEl = arena.querySelector("#heat-count");

  // 炭の数は前工程「炭をコンロにセット」での選択に従う（2個/トライアングル3個/4個）
  const count = tt.coal === "two" ? 2 : tt.coal === "four" ? 4 : 3;
  // 根性が高いほどジャスト窓が広く、温度上昇がわずかに緩やか（数値は見せない）
  const guts = state.stats.guts;
  const justHi = 0.96 + Math.min(0.12, guts / 900);
  const baseRate = 0.235 - Math.min(0.075, guts / 1300);

  const coals = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("button");
    el.className = "heat-coal";
    el.id = `heat-coal-${i}`;
    el.innerHTML = `<span class="heat-core"></span><span class="heat-badge"></span>`;
    coalsEl.appendChild(el);
    // 既にコンロで7割ほど焼けた状態からスタート（生焼けの待ち時間は無し）。
    // どの炭が先に熱が入るかはランダム＝立ち上がりと速度を炭ごとにばらつかせる（#51）
    coals.push({ el, core: el.querySelector(".heat-core"), badge: el.querySelector(".heat-badge"),
                 heat: 0.66 - Math.random() * 0.17, rate: baseRate * (0.9 + Math.random() * 0.36),
                 taken: false, inJust: false, grade: null, zone: null });
    el.addEventListener("click", () => takeCoal(i));
  }

  const callout = (text, cls) => {
    calloutEl.textContent = text;
    calloutEl.className = `heat-callout show ${cls || ""}`;
    setTimeout(() => calloutEl.classList.remove("show"), 720);
  };
  const updateCount = () => {
    countEl.textContent = `取った炭 ${coals.filter((c) => c.taken).length} / ${count}`;
  };
  updateCount();

  const paint = (c) => {
    const [r, g, b] = heatRGB(c.heat);
    const edge = `rgb(${r},${g},${b})`;
    const mid = `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 30)},${Math.min(255, b + 24)})`;
    c.el.style.background = `radial-gradient(circle at 50% 36%, ${mid}, ${edge} 72%)`;
    const glow = c.heat < 0.22 ? 0 : c.heat <= 1.04 ? (c.heat - 0.22) * 46 : Math.max(5, (1.42 - c.heat) * 46);
    c.el.style.boxShadow =
      `0 0 ${glow.toFixed(0)}px rgba(255,${Math.round(120 + glow)},60,${Math.min(0.85, glow / 40).toFixed(2)}),` +
      ` inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -6px 12px rgba(0,0,0,0.5)`;
    // 芯: ジャスト窓では白く閃く（in-just時はCSSアニメが上書き）
    const z = heatZone(c.heat, justHi);
    c.core.style.opacity = z === "just" ? "1" : (z === "ready" || z === "hot") ? "0.5" : "0.15";
  };

  let raf = 0, last = performance.now(), running = false; // カウントダウン中は停止（炭は熱が入らない）
  const tick = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const c of coals) {
      if (c.taken) continue;
      c.heat = Math.min(1.42, c.heat + c.rate * dt);
      const inJust = heatZone(c.heat, justHi) === "just";
      if (inJust && !c.inJust) { c.el.classList.add("flash"); if (window.SFX) SFX.spark(); }
      else if (!inJust && c.inJust) c.el.classList.remove("flash");
      c.el.classList.toggle("in-just", inJust);
      c.inJust = inJust;
      paint(c);
    }
    raf = requestAnimationFrame(tick);
  };
  for (const c of coals) paint(c); // 初期状態を見せて待たせる
  // 3・2・1 を挟んでから炭が熱を持ち始める（開始直後の理不尽な判定を防ぐ・T22-C）
  miniCountdown(arena, () => { running = true; last = performance.now(); raf = requestAnimationFrame(tick); });

  function takeCoal(i) {
    const c = coals[i];
    if (!running || c.taken) return;
    const z = heatZone(c.heat, justHi);
    c.taken = true; c.zone = z; c.grade = HEAT_GRADE[z];
    c.el.classList.add("taken"); c.el.classList.remove("flash", "in-just");
    c.el.disabled = true;
    c.badge.textContent = c.grade.sub;
    c.badge.className = `heat-badge show z-${z}`;
    paint(c);
    if (window.SFX) { SFX.coal(); if (z === "just") SFX.spark(); }
    callout(c.grade.label, z === "just" ? "great" : (z === "black" || z === "ash") ? "warn" : "");
    updateCount();
    if (coals.every((x) => x.taken)) finishHeat();
  }

  function finishHeat() {
    running = false; cancelAnimationFrame(raf);
    let qSum = 0, justCount = 0, readyCount = 0, earlyCount = 0, overheatCount = 0;
    const acc = { heatPower: 0, heatStability: 0, startupSpeed: 0, burnRisk: 0, aromaRetention: 0 };
    for (const c of coals) {
      qSum += c.grade.q;
      if (c.zone === "just") justCount++;
      else if (c.zone === "ready") readyCount++;
      else if (c.zone === "black" || c.zone === "early") earlyCount++;
      else overheatCount++; // hot / ash
      for (const k in acc) acc[k] += c.grade[k];
    }
    const qAvg = qSum / coals.length;
    for (const k in acc) acc[k] = Math.round(acc[k] / coals.length);
    // 既存craftScore互換: 文字列1値に集約
    tt.coalFire = qAvg >= 0.8 ? "perfect" : qAvg >= 0.45 ? "good" : "miss";
    // FLAVOR TRIAL 用の詳細（性能影響は 0..100 スケール・基準50 に寄せる）
    const sc = (v) => Math.max(0, Math.min(100, 50 + v));
    tt.coalResult = {
      score: Math.round(qAvg * 100),
      justCount, readyCount, earlyCount, overheatCount,
      heatPower: sc(acc.heatPower), heatStability: sc(acc.heatStability),
      startupSpeed: sc(acc.startupSpeed), aromaRetention: sc(acc.aromaRetention),
      burnRisk: sc(acc.burnRisk), coalFlashSuccess: justCount >= 1,
    };
    const rank = tt.coalFire;
    showStamp(arena.querySelector("#heat-burner"), rank === "perfect" ? "just" : rank);
    pakkiLive(rank);
    broadcastJudge(rank, "炭");
    if (rank === "perfect") smokeRings(3);
    result.innerHTML =
      (justCount >= 2 ? "──三つの芯が、ほぼ同時にピカッと閃いた。火力も香りも申し分ない熾きだ。"
      : qAvg >= 0.45 ? "──悪くない熾き。炭はちゃんと使える熱を持っている。"
      : overheatCount >= 2 ? "──焼きすぎた。灰をかぶった炭は熱が暴れて、香りを飛ばしてしまう……。"
      : "──芯が黒い。火力が立ち上がりきらないかもしれない……。") +
      `<div class="heat-summary">ジャスト ${justCount} ／ 適温 ${readyCount} ／ 早取り ${earlyCount} ／ 焼きすぎ ${overheatCount}</div>`;
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = isDrill ? "結果を見る" : "次へ";
    next.addEventListener("click", () => tnNext("coalfire"));
    result.appendChild(next);
  }

  // テスト用フック: 各炭の温度・取り頃を読む（自動プレイ用）
  window.__heatDebug = () => coals.map((c, i) => ({
    i, heat: c.heat, taken: c.taken, zone: heatZone(c.heat, justHi),
    justNow: !c.taken && heatZone(c.heat, justHi) === "just",
    goodNow: !c.taken && c.heat >= 0.58 && c.heat <= 1.18,
  }));
}

// --- 集中（雑念タップ）
function stepFocus() {
  const body = tnPanel("集中", "雑念が頭をよぎる──タップして振り払え！");
  const arena = document.createElement("div");
  arena.className = "focus-arena";
  const result = document.createElement("div");
  result.className = "practice-result";
  body.append(arena, result);
  const lifetime = 1300 + state.stats.insight * 10; // 洞察が高いほど落ち着いて払える
  let index = 0;
  const finish = () => {
    result.textContent =
      tt.focusCleared >= 5 ? "──雑念が消えた。手元だけがクリアに見える。"
      : tt.focusCleared >= 3 ? "──なんとか集中を保った。"
      : "──ざわめきが頭から離れない……。";
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = "仕上げに入る";
    next.addEventListener("click", () => {
      // ch1大会ではR2終了の会話と中間発表を挟む（テキストがch1専用のため）
      if (tt.mode === "tournament" && state.chapter === 1) {
        playDialogue("ch1_tournament_r2_end", () => showStandings(2, () => tournamentStep("pull")), "res://assets/backgrounds/bg_tournament_stage.png");
      } else {
        tnNext("focus");
      }
    });
    result.appendChild(document.createElement("br"));
    result.appendChild(next);
  };
  const spawn = () => {
    if (index >= FOCUS_WORDS.length) return finish();
    const word = document.createElement("button");
    word.className = "focus-word";
    word.textContent = FOCUS_WORDS[index++];
    word.style.left = `${8 + Math.random() * 55}%`;
    word.style.top = `${10 + Math.random() * 65}%`;
    arena.appendChild(word);
    const timer = setTimeout(() => { word.remove(); setTimeout(spawn, 250); }, lifetime);
    word.addEventListener("click", () => {
      clearTimeout(timer);
      if (window.SFX) SFX.select();
      word.remove();
      tt.focusCleared++;
      setTimeout(spawn, 250);
    });
  };
  // 3・2・1 を挟んでから雑念が湧き始める（開始直後の理不尽を防ぐ・T22-C）
  miniCountdown(arena, () => spawn());
}

// 章ごとの大会レギュレーション（指定フレーバー）。ch1 = SMOKE CROWN CUP はミント指定。
// 大会本番と前日リハーサルに適用される（バイト・チュートリアル・ドリルは自由）
const CH1_REGULATION = { flavor: "mint", min: 2, label: "課題フレーバー「ミント」を2g以上使うこと" };
// ch2 = HAZE: OPEN CLOUD はストロベリー指定（県特産タイアップ・輪郭の見えにくい高難度）
const CH2_REGULATION = { flavor: "strawberry", min: 2, label: "課題フレーバー「ストロベリー」を2g以上使うこと" };
function chapterRegulation() { return state.chapter === 2 ? CH2_REGULATION : CH1_REGULATION; }

// バイト専用課題（お客さんのリクエスト）。大会の課題とは別物で、日替わり3種:
// テーマ希望のみ／指名フレーバー（しっかり効かせて）／ミント抜き（苦手なお客さん）
function baitoRequest() {
  if (state.day % 3 === 0) return { flavor: "mint", max: 0, label: "お客さん「あ、ミントは苦手で……抜きでお願いします」" };
  if (state.day % 3 === 2) return { flavor: "blueberry", min: 2, label: "お客さん「ブルーベリー、しっかり効かせてほしいな」" };
  return null; // テーマの希望だけの日
}

function activeRegulation() {
  if (!tt) return null;
  if (tt.mode === "tournament" || tt.mode === "rehearsal") return chapterRegulation();
  if (tt.mode === "baito") return baitoRequest();
  return null;
}

// 選択中ボウルの容量（g）。詰める量の上限になる。未選択（バイト・チュートリアル等）は基本の12g
function bowlCapacity() {
  const b = D.equipment.find((e) => e.id === tt.bowl);
  return (b && b.capacity) || 12;
}
// 葉代（1gあたり）。パック価格の1/10を目安に丸める。価格0（凛のサンプル等）は無償
function mixGramCost(f) {
  return Math.round((f.price || 0) / 10 / 5) * 5;
}

function stepMix() {
  const reg = activeRegulation();
  const cap = bowlCapacity();
  // 葉は自前で買って持ち込む（大会のみ）。店の仕込みで作るバイト等は店持ち
  const charged = tt.mode === "tournament";
  const body = tnPanel(
    "フレーバー選択 & ミックス",
    (reg ? `レギュレーション: ${reg.label}　` : "") +
      `合計12g〜${cap}g・1〜3種類。多く詰むほど味の持ちは良くなるが、その分の熱${charged ? "と葉代" : ""}が要る。`
  );
  const regFlavorName = reg ? ((D.flavors.find((f) => f.id === reg.flavor) || {}).short_name || reg.flavor).replace(/^AF /, "") : "";
  if (reg) {
    const note = document.createElement("p");
    note.className = "tn-tutor";
    note.textContent = tt.mode === "baito"
      ? reg.label
      : `パッキー「今大会の課題フレーバーは${regFlavorName}！ 入ってない一台は審査対象外ですよ〜♪」`;
    body.appendChild(note);
  }
  // 味覚スランプ（ch2）: 味の記憶がノイズ混じりになり、説明文が霞む
  const tasteSlump = state.chapter === 2 && state.flags._taste_slump && tt.mode !== "drill";
  if (tasteSlump) {
    const slump = document.createElement("p");
    slump.className = "tn-tutor taste-slump";
    slump.textContent = "（……味の記憶が、霞んでいる。どの香りも、輪郭を結ばない）";
    body.appendChild(slump);
  }
  const garble = (text) => text.replace(/[^、。！？♪]/g, (ch, i) => (((i * 7 + text.length) % 3) === 0 ? "▒" : ch));
  const total = () => Object.values(tt.mix).reduce((a, b) => a + b, 0);
  const list = document.createElement("div");
  list.className = "mix-list";
  const footer = document.createElement("div");
  footer.className = "mix-footer";
  const totalLabel = document.createElement("div");
  totalLabel.className = "mix-total";
  const goBtn = document.createElement("button");
  goBtn.className = "primary-btn";
  goBtn.textContent = "この配合でいく";
  const regGrams = () => (reg ? tt.mix[reg.flavor] || 0 : 0);
  const regOk = () => !reg || (regGrams() >= (reg.min || 0) && regGrams() <= (reg.max ?? 99));
  const mixCost = () =>
    Object.entries(tt.mix).reduce((sum, [id, g]) => {
      const f = D.flavors.find((x) => x.id === id);
      return sum + (f ? mixGramCost(f) * g : 0);
    }, 0);
  const valid = () => total() >= 12 && total() <= cap && regOk();
  goBtn.addEventListener("click", () => {
    if (!valid()) return;
    if (charged && mixCost() > 0) addMoney(-mixCost()); // 葉代（買って持ち込んだ分）
    tnNext("mix");
  });

  const regName = reg ? ((D.flavors.find((f) => f.id === reg.flavor) || {}).short_name || reg.flavor) : "";
  const refresh = () => {
    let regText = "";
    if (reg) regText = reg.max === 0 ? `　${regName}: 入れない約束` : `　${regName} ${regGrams()}/${reg.min}g`;
    const costText = charged ? `　葉代 ${mixCost().toLocaleString()}円` : "";
    totalLabel.textContent = `合計 ${total()}g / ${cap}g` + regText + costText;
    totalLabel.classList.toggle("ok", valid());
    goBtn.disabled = !valid();
    goBtn.textContent =
      !regOk() && total() >= 12
        ? (tt.mode === "baito" ? "リクエストと違う……" : "課題フレーバーが足りない")
        : total() < 12 ? "最低12gまで詰む"
        : "この配合でいく";
  };

  // 限定フレーバー（凛のサンプル等）はフラグ解放後にだけ並ぶ。
  // 主人公の配合はブロンドリーフのみ（ダーク/シガーは用語・他キャラの演出専用）
  // 大会(tournament/rehearsal)では competition_legal:false、接客(baito)では serve_legal:false を除外。
  // 凛の未発売サンプルは練習/ドリル等の試香でのみ使える（大会・店では出せない）
  const compMode = tt.mode === "tournament" || tt.mode === "rehearsal";
  const serveMode = tt.mode === "baito";
  const flavors = D.flavors.filter((f) =>
    (!f.requires_flag || state.flags[f.requires_flag]) &&
    (!f.leaf || f.leaf === "blond") &&
    !(compMode && f.competition_legal === false) &&
    !(serveMode && f.serve_legal === false));
  for (const f of flavors) {
    const row = document.createElement("div");
    row.className = "mix-row";
    const info = document.createElement("div");
    info.className = "mix-info";
    const priceTag = charged && mixGramCost(f) ? ` <span class="mix-price">${mixGramCost(f)}円/g</span>` : charged ? ` <span class="mix-price free">提供品</span>` : "";
    info.innerHTML = `<span class="spot-name">${f.short_name || f.name}${priceTag}</span><span class="spot-desc">${tasteSlump ? garble(f.description) : f.description}</span>`;
    const ctrl = document.createElement("div");
    ctrl.className = "mix-ctrl";
    const minus = document.createElement("button");
    minus.textContent = "−";
    const grams = document.createElement("span");
    grams.className = "mix-grams";
    const plus = document.createElement("button");
    plus.textContent = "＋";
    const update = () => { grams.textContent = `${tt.mix[f.id] || 0}g`; refresh(); };
    minus.addEventListener("click", () => {
      tt.mix[f.id] = Math.max(0, (tt.mix[f.id] || 0) - 1);
      if (tt.mix[f.id] === 0) delete tt.mix[f.id];
      if (window.SFX) SFX.click();
      update();
      updateRig();
      refreshMakingWorkbench();
    });
    plus.addEventListener("click", () => {
      const kinds = Object.keys(tt.mix);
      if (!tt.mix[f.id] && kinds.length >= 3) { toast("ミックスは3種類まで"); return; }
      if (total() >= cap) { toast(`このボウルは${cap}gまで`); return; }
      tt.mix[f.id] = (tt.mix[f.id] || 0) + 1;
      if (window.SFX) SFX.pour();
      update();
      updateRig();
      refreshMakingWorkbench({ pour: true });
      setTimeout(() => refreshMakingWorkbench(), 520);
    });
    ctrl.append(minus, grams, plus);
    row.append(info, ctrl);
    list.appendChild(row);
    update();
  }
  footer.append(totalLabel, goBtn);
  body.append(list, footer);
  refresh();
}

// --- 蒸らし待ち: 湯気は出さず、タイマーと鼓動で「待つ」緊張を作る。
// 最後に一度だけ覚悟の締めを入れ、タイミングが craft に響く。
// --- 蒸らし: 雑念弾幕（アンダーテール風の回避）。オーナー指定で「覚悟＋締め」から
// 弾幕回避へ差し戻し（現デザインのタイマー＋鼓動の枠は維持）。心(♥)を動かして
// 雑念弾を躱す。被弾が少ないほど craft が上がる（tt.steamHits を採点が読む）。
// 0分(神崎流)は蒸らさない＝雑念ビート無しで即立ち上げ。
function runSteamDodge(steamOpt, onDone) {
  if (steamOpt.id === 0) {
    const body = tnPanel("蒸らし: 0分スタイル", "蒸らさない。吸いながら一気に立ち上げる──神崎竜二の型破りなやり方だ。");
    tt.steamHits = 0; tt.steamFinish = "perfect";
    showStamp($("#tn-layout .panel"), "perfect");
    pakkiLive("perfect"); broadcastJudge("perfect", "蒸らし");
    if (window.SFX) SFX.perfect();
    const result = document.createElement("div");
    result.className = "practice-result";
    result.textContent = "──腹を決めて、吸いながら一気に立ち上げた。雑念の入る隙もない。";
    const next = document.createElement("button");
    next.className = "primary-btn"; next.textContent = "次へ";
    next.addEventListener("click", onDone);
    result.appendChild(document.createElement("br")); result.appendChild(next);
    body.append(result);
    window.__steamDebug = () => ({ dodge: true, hits: 0, done: true, end: () => {} });
    return;
  }
  // 蒸らしが長いほど雑念に晒される時間も長い（蒸らし時間の選択に意味を持たせる）
  const duration = Math.min(12, 4.5 + steamOpt.id * 0.6);
  const slump = state.chapter === 2 && state.flags._taste_slump && tt.mode !== "drill";
  const body = tnPanel(
    "蒸らし中 ── 雑念を躱せ",
    slump
      ? "頭の中が、ざわつく。借り物の言葉が雑念になって飛んでくる──煙のことだけ考えろ。"
      : "心（♥）をドラッグ（または矢印キー）で動かして雑念を躱せ。被弾するほど煙が落ち着かない。"
  );
  const words = slump || (state.chapter === 2 && tt.mode === "tournament") ? DODGE_WORDS_CH2 : DODGE_WORDS;
  // 現デザイン維持: 上部にタイマー＋鼓動、その下に回避アリーナ
  const wrap = document.createElement("div");
  wrap.className = "steam-wait";
  wrap.innerHTML = `
    <div class="steam-timer">
      <span class="steam-timer-label" id="steam-timer-label"></span>
      <div class="steam-timer-bar"><div class="steam-timer-fill" id="steam-timer-fill"></div></div>
    </div>
    <div class="steam-heart"><span></span><span></span><span></span></div>`;
  const arena = document.createElement("div");
  arena.className = "dodge-arena";
  const soul = document.createElement("div");
  soul.className = "dodge-soul";
  soul.textContent = "♥";
  arena.appendChild(soul);
  const result = document.createElement("div");
  result.className = "practice-result";
  body.append(wrap, arena, result);

  const label = wrap.querySelector("#steam-timer-label");
  const fill = wrap.querySelector("#steam-timer-fill");
  let W = 760, H = 220;
  let sx = W / 2, sy = H * 0.62;
  let hits = 0, invuln = 0, remain = duration, last = performance.now();
  let spawnIn = 0.6, raf = 0, ended = false;
  const bullets = [];
  const keys = {};
  // 洞察が高いほど雑念の湧きがわずかに穏やか（そこそこ有利、程度）
  const spawnEvery = (slump ? 0.42 : 0.54) + Math.min(0.14, state.stats.insight / 500);
  const bulletSpeed = slump ? 130 : 110;

  const measure = () => { W = arena.clientWidth || W; H = arena.clientHeight || H; sx = Math.min(sx, W - 12); sy = Math.min(sy, H - 12); };
  const onPointer = (e) => {
    const r = arena.getBoundingClientRect();
    sx = Math.max(10, Math.min(W - 10, e.clientX - r.left));
    sy = Math.max(10, Math.min(H - 10, e.clientY - r.top));
    e.preventDefault();
  };
  const onKeyDown = (e) => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) { keys[e.key] = true; e.preventDefault(); } };
  const onKeyUp = (e) => { delete keys[e.key]; };
  arena.addEventListener("pointermove", onPointer);
  arena.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // 弾の生成（共通）。文言はランダムな雑念
  const addBullet = (x, y, vx, vy, word) => {
    const el = document.createElement("span");
    el.className = "dodge-bullet";
    el.textContent = word || words[Math.floor(Math.random() * words.length)];
    arena.appendChild(el);
    bullets.push({ el, x, y, vx, vy });
  };
  const edgePoint = () => {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: -30, y: Math.random() * H };
    if (side === 1) return { x: W + 30, y: Math.random() * H };
    if (side === 2) return { x: Math.random() * W, y: -20 };
    return { x: Math.random() * W, y: H + 20 };
  };
  // 弾幕パターン（アンダーテール/東方風の遊び）。位相ごとに切り替えて単調さを消す
  let spiralAng = Math.random() * 6.28;
  const PATTERNS = {
    // 狙い撃ち: 四辺から心へ（±ブレ）
    aim: () => { const p = edgePoint(); const a = Math.atan2(sy - p.y, sx - p.x) + (Math.random() * 0.8 - 0.4); const sp = bulletSpeed * (0.8 + Math.random() * 0.5); addBullet(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp); },
    // 扇: 一辺から心へ3way
    fan: () => { const p = edgePoint(); const base = Math.atan2(sy - p.y, sx - p.x); const sp = bulletSpeed * 0.95; for (const d of [-0.34, 0, 0.34]) addBullet(p.x, p.y, Math.cos(base + d) * sp, Math.sin(base + d) * sp); },
    // スパイラル: 中央上から回転しながら放射（2本の腕）
    spiral: () => { spiralAng += 0.42; const cx = W / 2, cy = H * 0.34, sp = bulletSpeed * 0.82; for (const k of [0, Math.PI]) addBullet(cx, cy, Math.cos(spiralAng + k) * sp, Math.sin(spiralAng + k) * sp); },
    // 雨: 上から落下（横に流れる）
    rain: () => { for (let i = 0; i < 2; i++) addBullet(Math.random() * W, -20, (Math.random() * 2 - 1) * 36, bulletSpeed * (0.7 + Math.random() * 0.3)); },
    // 横薙ぎ: 左右どちらかから水平に
    sweep: () => { const fromLeft = Math.random() < 0.5; const sp = bulletSpeed * (0.9 + Math.random() * 0.4); addBullet(fromLeft ? -24 : W + 24, Math.random() * H, (fromLeft ? 1 : -1) * sp, (Math.random() * 2 - 1) * 18); },
  };
  const PK = Object.keys(PATTERNS);
  let patternKey = PK[Math.floor(Math.random() * PK.length)];
  let phaseRemain = 2.4 + Math.random() * 1.2;
  let ringIn = 2.2;
  // 見せ場: 心と反対側から全方位リングバースト（蒸らしが長いほど頻繁・弾多め）
  const ringBurst = () => {
    const cx = (sx < W / 2 ? W * 0.66 : W * 0.34) + (Math.random() * 40 - 20);
    const cy = (sy < H / 2 ? H * 0.66 : H * 0.34) + (Math.random() * 30 - 15);
    const count = 9 + Math.round(steamOpt.id / 3), sp = bulletSpeed * 0.66;
    for (let i = 0; i < count; i++) { const a = (i / count) * 6.283 + Math.random() * 0.12; addBullet(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp); }
  };
  const spawnStep = (dt) => {
    phaseRemain -= dt;
    if (phaseRemain <= 0) { let k; do { k = PK[Math.floor(Math.random() * PK.length)]; } while (k === patternKey && PK.length > 1); patternKey = k; phaseRemain = 2.4 + Math.random() * 1.2; }
    spawnIn -= dt;
    if (spawnIn <= 0) { spawnIn = spawnEvery; PATTERNS[patternKey](); }
    ringIn -= dt;
    if (ringIn <= 0) { ringIn = 2.8 - Math.min(0.9, steamOpt.id * 0.07) + Math.random() * 0.9; ringBurst(); }
  };

  const end = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    for (const b of bullets) b.el.remove();
    bullets.length = 0;
    soul.classList.add("done");
    tt.steamHits = hits;
    const grade = hits === 0 ? "perfect" : hits <= 2 ? "good" : "miss";
    tt.steamFinish = grade;
    showStamp($("#tn-layout .panel"), grade);
    pakkiLive(grade);
    broadcastJudge(grade, "蒸らし");
    if (window.SFX) (grade === "perfect" ? SFX.perfect() : grade === "good" ? SFX.good() : SFX.miss());
    result.textContent =
      hits === 0 ? "──雑念ゼロ。蒸らしの間、煙のことだけを見ていられた。"
      : hits <= 2 ? "──少し心がざわついた。でも、致命傷じゃない。"
      : hits <= 4 ? "──雑念に何度か捕まった。煙が少し落ち着かない。"
      : "──頭の中が騒がしいまま、蒸らしが終わってしまった……。";
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = "次へ";
    next.addEventListener("click", onDone);
    result.appendChild(document.createElement("br"));
    result.appendChild(next);
  };

  const tick = (now) => {
    if (ended) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    measure();
    remain -= dt;
    invuln = Math.max(0, invuln - dt);
    const ratio = Math.max(0, remain / duration);
    const dispSec = Math.max(0, Math.round(steamOpt.id * 60 * ratio));
    label.textContent = `蒸らし残り ${Math.floor(dispSec / 60)}:${String(dispSec % 60).padStart(2, "0")}`;
    fill.style.width = `${ratio * 100}%`;
    const v = 240 * dt;
    if (keys.ArrowLeft || keys.a) sx -= v;
    if (keys.ArrowRight || keys.d) sx += v;
    if (keys.ArrowUp || keys.w) sy -= v;
    if (keys.ArrowDown || keys.s) sy += v;
    sx = Math.max(10, Math.min(W - 10, sx));
    sy = Math.max(10, Math.min(H - 10, sy));
    soul.style.transform = `translate(${sx - 8}px, ${sy - 9}px)`;
    spawnStep(dt);
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
      if (b.x < -80 || b.x > W + 80 || b.y < -60 || b.y > H + 60) { b.el.remove(); bullets.splice(i, 1); continue; }
      if (invuln <= 0 && Math.hypot(b.x - sx, b.y - sy) < 17) {
        hits++;
        invuln = 0.85;
        soul.classList.add("hit");
        arena.classList.add("flash");
        setTimeout(() => { soul.classList.remove("hit"); arena.classList.remove("flash"); }, 320);
        if (window.SFX) SFX.click();
        b.el.remove();
        bullets.splice(i, 1);
      }
    }
    if (remain <= 0) return end();
    raf = requestAnimationFrame(tick);
  };
  // テストフック: 弾幕を即終了して結果へ（無操作なら被弾0＝perfect）
  window.__steamDebug = () => ({ dodge: true, hits, remain, end });
  requestAnimationFrame((now) => { last = now; measure(); raf = requestAnimationFrame(tick); });
}

// --- 吸い出し（提供前の温度立ち上げ）: 炭を置いて蒸らした後、提供前に何度か吸って
// ボウルの温度を整える工程。左右に走るゲージを止めた位置で吸い方が決まる——
// 左側=上げ吸い（温度UP）／中央=キープ／右側=下げ吸い（温度DOWN）。
// 最低2回・3回まではノーペナルティ。4回目以降も吸えるが葉が痩せる（craft減点）。
// やめ時はプレイヤーが選ぶ
const PULL_MIN = 2, PULL_MAX = 5, PULL_SAFE = 3;
// ジャスト帯（master_spec #13）: 各ゾーン中央の細い帯。
// キープのジャスト=ブレほぼ消滅／上げ下げのジャスト=通常より強く効く
const PULL_JUST = { up: [0.14, 0.205], keep: [0.468, 0.532], down: [0.795, 0.86] };
// 適温ゾーンは客の需要（テーマ/コンセプト）で変わる（#38）。
// リラックスは高温にしすぎない／高火力は高め／フルーティは香りを飛ばさない中温
function pullTargetZone() {
  return ({
    relax: [0.44, 0.60], high_heat: [0.70, 0.86], fruity: [0.55, 0.71], aftertaste: [0.64, 0.80],
  })[tt && tt.theme ? tt.theme.id : ""] || [0.62, 0.78];
}
const PULL_DELTA = 0.13; // 1回の吸いで動かせる最大温度

// 今の仕込み（炭/炭起こし/蒸らし/葉量）から決まる温度。決定論なので R2の表示と吸い出しの起点で共有（#45）
function projectedTemp() {
  const totalG = Object.values(tt.mix).reduce((a, b) => a + b, 0) || 12;
  let t = 0.5;
  t += { triangle: 0, four: 0.14 }[tt.coal] ?? 0; // 炭3個=基準／4個でかなり上がる（#50）
  t += { flat_charcoal: -0.03, cube_charcoal: 0.06 }[tt.charcoal] ?? 0; // フラット炭/キューブ炭でも温度差（#50）
  t += { perfect: 0.04, good: 0, miss: -0.07 }[tt.coalFire] ?? 0;
  t += { 0: -0.12, 3: -0.05, 5: 0, 8: 0.03, 10: 0.06 }[tt.steam] ?? 0;
  t -= Math.max(0, totalG - 12) * 0.012; // 葉が多いほど温まりは遅い
  // アルミの穴の数（T22-B）: 少ないほど熱がこもり(温度↑)、多いほど抜けて下がる。基準は中庸の18穴
  if (tt.holeResult && typeof tt.holeResult.totalHoles === "number") {
    t += (18 - tt.holeResult.totalHoles) * 0.005;
  }
  return Math.max(0.16, Math.min(0.9, t));
}
function pullStartTemp() {
  return Math.max(0.16, Math.min(0.9, projectedTemp() + (Math.random() * 0.06 - 0.03)));
}

function stepPull() {
  const PULL_TARGET = pullTargetZone(); // 適温はテーマ依存（#38）
  // 温度コントロールは技術・センスで上達する（オーナー指定。旧「保留」だったステ連動を実装）。
  // ステが低いうちは1吸いで動く温度が小さい＝手数がかかり、ジャストを狙う価値が高い。
  // 上がるほど1吸いの効きとジャスト帯が広がり、少ない手数で適温に寄せられる（＝上達の実感）。
  // ※ PULL_DELTA / PULL_JUST はここでモジュール定数を上書き（__pullDebug もこの値を参照）
  const ctrl = ((state.stats.technique || 10) + (state.stats.sense || 10)) / 2; // 温度コントロール力 0〜100
  const PULL_DELTA = 0.05 + (ctrl / 100) * 0.07; // 0.05(低ステ)〜0.12(満) ／ 1吸いで動かせる最大温度（旧固定0.13をナーフ＋ステ連動）
  const _jhw = 0.012 + (ctrl / 100) * 0.013;      // ジャスト帯の半幅: 低ステほど狭く、上達で広がる
  const PULL_JUST = {
    up:   [0.1725 - _jhw, 0.1725 + _jhw],
    keep: [0.5 - _jhw, 0.5 + _jhw],
    down: [0.8275 - _jhw, 0.8275 + _jhw],
  };
  const tempNote = (tt && tt.theme) ? ({
    relax: "　今日はリラックス系——高温にしすぎないのが適温だ。",
    high_heat: "　今日は高火力系——しっかり高温まで上げろ。",
    fruity: "　今日はフルーティ——香りを飛ばさない中温が適温。",
    aftertaste: "　今日は余韻系——やや高めの適温で香りを伸ばせ。",
  })[tt.theme.id] || "" : "";
  const body = tnPanel(
    "吸い出し（温度合わせ）",
    "提供前に何度か吸って、ボウルの温度を立ち上げる。左で止めれば上げ吸い、右なら下げ吸い、真ん中はキープ。" +
      `最低${PULL_MIN}回・${PULL_SAFE}回までは無傷、それ以上は葉が痩せる。` + tempNote
  );
  tt.temp = pullStartTemp();
  tt.pullCount = 0;

  const tempWrap = document.createElement("div");
  tempWrap.className = "temp-wrap";
  tempWrap.innerHTML = `
    <div class="temp-labels"><span>ぬるい</span><span>適温</span><span>焦げる</span></div>
    <div class="temp-bar"><div class="temp-zone"></div><div class="temp-marker"></div></div>`;
  const zoneEl = tempWrap.querySelector(".temp-zone");
  zoneEl.style.left = `${PULL_TARGET[0] * 100}%`;
  zoneEl.style.width = `${(PULL_TARGET[1] - PULL_TARGET[0]) * 100}%`;
  const marker = tempWrap.querySelector(".temp-marker");

  const wrap = document.createElement("div");
  wrap.className = "gauge-wrap";
  wrap.innerHTML = `
    <div class="pull-bar">
      <div class="pull-zone up"><span>上げ吸い</span></div>
      <div class="pull-zone keep"><span>キープ</span></div>
      <div class="pull-zone down"><span>下げ吸い</span></div>
      <div class="pull-just" style="left:${PULL_JUST.up[0] * 100}%;width:${(PULL_JUST.up[1] - PULL_JUST.up[0]) * 100}%"></div>
      <div class="pull-just" style="left:${PULL_JUST.keep[0] * 100}%;width:${(PULL_JUST.keep[1] - PULL_JUST.keep[0]) * 100}%"></div>
      <div class="pull-just" style="left:${PULL_JUST.down[0] * 100}%;width:${(PULL_JUST.down[1] - PULL_JUST.down[0]) * 100}%"></div>
      <div class="gauge-needle" id="tn-pull-needle"></div>
    </div>
    <p class="tn-hint">細い光の帯で止めると<span class="tx-hint">ジャスト</span>——上げ下げは強く効き、キープはブレがほぼ消える。狙わない自由もある。</p>
    <p class="tn-hint" id="tn-pull-count"></p>
    <button class="primary-btn" id="tn-pull-go">吸う！</button>
    <button class="primary-btn ghost" id="tn-pull-serve" disabled></button>
    <div class="practice-result" id="tn-pull-result"></div>`;
  body.append(tempWrap, wrap);

  const needle = wrap.querySelector("#tn-pull-needle");
  const countEl = wrap.querySelector("#tn-pull-count");
  const goBtn = wrap.querySelector("#tn-pull-go");
  const serveBtn = wrap.querySelector("#tn-pull-serve");
  const result = wrap.querySelector("#tn-pull-result");
  serveBtn.textContent =
    { tutorial: "スミさんに出す", rehearsal: "スミさんに出す", baito: "お客さんに出す", drill: "結果を見る" }[tt.mode] || "提供する";

  const updateTemp = () => { marker.style.left = `${Math.max(0, Math.min(1, tt.temp)) * 100}%`; };
  const updateCount = () => {
    countEl.textContent =
      `吸い出し ${tt.pullCount} / ${PULL_MAX} 回（最低${PULL_MIN}回・${PULL_SAFE}回までは無傷）` +
      (tt.pullCount >= PULL_SAFE ? "　⚠ ここから先は葉が痩せる" : "");
    countEl.classList.toggle("tx-warn", tt.pullCount >= PULL_SAFE);
    serveBtn.disabled = tt.pullCount < PULL_MIN;
  };
  updateTemp();
  updateCount();

  // ゲージは左→右に走り、右端まで行ったらまた左から（折り返さない）
  let pos = 0, running = true, raf = 0, last = performance.now();
  // 針速度: ベースをややシビアに固定（T23・達成感）。ステによる緩和は落とし所を設計してから（保留）
  const speed = 0.52;
  const tick = (now) => {
    if (!running) return;
    const dt = (now - last) / 1000;
    last = now;
    pos += speed * dt;
    if (pos > 1) pos -= 1;
    needle.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // テスト用フック: 自動プレイが針位置と狙いゾーンを読むためのデバッグ窓
  window.__pullDebug = () => {
    const center = (PULL_TARGET[0] + PULL_TARGET[1]) / 2;
    const need = Math.max(-PULL_DELTA, Math.min(PULL_DELTA, center - tt.temp));
    let want;
    if (need > 0.005) want = 0.35 * (1 - need / PULL_DELTA);
    else if (need < -0.005) want = 0.65 + 0.35 * (-need / PULL_DELTA);
    else want = 0.5;
    return {
      pos, temp: tt.temp, count: tt.pullCount,
      canServe: tt.pullCount >= PULL_MIN,
      tempOk: tt.temp >= PULL_TARGET[0] && tt.temp <= PULL_TARGET[1],
      wantZone: [Math.max(0, want - 0.08), Math.min(1, want + 0.08)],
    };
  };

  goBtn.addEventListener("click", () => {
    if (tt.pullCount >= PULL_MAX) return;
    tt.pullCount++;
    // 止めた位置で吸い方が決まる: 左=上げ／中央=キープ／右=下げ。
    // 各ゾーン中央の細い帯=ジャスト（上げ下げは強く効き、キープはブレが大幅減）
    const inBand = (band) => pos >= band[0] && pos <= band[1];
    let delta = 0, jitter = 0.012, just = false, label = "キープ。温度は動かさない";
    let pullKind = "keep", motionMs = 760;
    if (pos < 0.35) {
      pullKind = "up"; motionMs = 520;
      delta = ((0.35 - pos) / 0.35) * PULL_DELTA;
      label = "上げ吸い！　炭の熱がボウルに乗る";
      if (inBand(PULL_JUST.up)) { just = true; delta = PULL_DELTA * 2.0; label = "ジャスト上げ！　ひと吸いで一気に熱が立つ"; }
    } else if (pos > 0.65) {
      pullKind = "down"; motionMs = 1120;
      delta = -((pos - 0.65) / 0.35) * PULL_DELTA;
      label = "下げ吸い。熱を逃して落ち着かせる";
      if (inBand(PULL_JUST.down)) { just = true; delta = -PULL_DELTA * 2.0; label = "ジャスト下げ！　狙いどおりに熱が抜ける"; }
    } else if (inBand(PULL_JUST.keep)) {
      just = true; jitter = 0.003; // ジャストキープでも完全固定にはしない
      label = "ジャストキープ。煙が、ほとんど揺れない";
    }
    if (just) {
      tt.pullJust = (tt.pullJust || 0) + 1;
      showStamp($("#tn-layout .panel"), "just");
      feelPop(8, "JUST"); nicoBurst("perfect", 1);
      if (window.SFX) SFX.perfect && SFX.perfect();
    }
    tt.temp = Math.max(0, Math.min(1, tt.temp + delta + (Math.random() * 2 - 1) * jitter));
    updateTemp();
    updateCount();
    result.textContent = `──${label}`;
    // 4回目以降は吸いすぎ: 提供前に葉が痩せていく（craftScore で減点）
    if (tt.pullCount > PULL_SAFE) result.textContent += "　（……吸いすぎだ。味の厚みが、少しずつ逃げていく）";
    playMakingMotion(`pull-${pullKind}`, motionMs);
    if (window.SFX) SFX.bubble();
    spawnBubbles(7);
    startRigSmoke(620);
    if (tt.pullCount >= PULL_MAX) {
      goBtn.disabled = true;
      result.textContent += "　もう提供するしかない。";
    }
  });

  serveBtn.addEventListener("click", () => {
    running = false;
    cancelAnimationFrame(raf);
    goBtn.disabled = true;
    serveBtn.disabled = true;
    const [a, b] = PULL_TARGET;
    const center = (a + b) / 2, half = (b - a) / 2;
    tt.pull = Math.abs(tt.temp - center) <= half * 0.45 ? "perfect" : tt.temp >= a && tt.temp <= b ? "good" : "miss";
    if (window.SFX) SFX.bubble();
    spawnBubbles(tt.pull === "perfect" ? 14 : tt.pull === "good" ? 9 : 4);
    startRigSmoke(tt.pull === "miss" ? 900 : 320);
    showStamp($("#tn-layout .panel"), tt.pull);
    pakkiLive(tt.pull);
    broadcastJudge(tt.pull, "提供");
    nicoBurst("serve", 1); // 提供スピード感のウケ
    result.textContent = {
      perfect: "──完璧な温度。煙が重く、甘く、まとまっている。",
      good: "──いい温度だ。狙った味に近い。",
      miss: tt.temp < a
        ? "──少しぬるい。甘さが眠ったまま……それでも、出すしかない。"
        : "──熱が走りすぎた。焦げの気配が混じる……それでも、出すしかない。",
    }[tt.pull];
    const nextBtn = document.createElement("button");
    nextBtn.className = "primary-btn";
    nextBtn.textContent = "次へ";
    nextBtn.addEventListener("click", () => {
      if (tt.mode === "tournament") {
        // 提供 → FLAVOR TRIAL（審査）→ 結果発表（#13）
        if (state.chapter === 2) return flavorTrial(finishCh2Stage);
        return playDialogue("ch1_tournament_r3_end", () => flavorTrial(finishTournament), "res://assets/backgrounds/bg_tournament_stage.png");
      }
      tnNext("pull");
    });
    wrap.appendChild(nextBtn);
  });
}

// --- 採点
function mixProfile() {
  const total = Object.values(tt.mix).reduce((a, b) => a + b, 0) || 1;
  let heat = 0, weight = 0;
  const cats = new Set();
  for (const [id, g] of Object.entries(tt.mix)) {
    const f = D.flavors.find((x) => x.id === id);
    if (!f) continue;
    heat += f.heat_tolerance * g;
    weight += f.smoke_weight * g;
    cats.add(f.category);
  }
  return { heat: heat / total, weight: weight / total, cats };
}

function craftScore() {
  const p = mixProfile();
  let score = 50;
  const detail = [];
  const kinds = Object.keys(tt.mix).length;
  // 機材の相性
  const bowlBonus = { silicone_bowl: 2, hagal_80beat: 4, suyaki_hagal: kinds === 1 ? 5 : 1 };
  score += bowlBonus[tt.bowl] || 0;
  if (tt.bowl === "suyaki_hagal" && kinds === 1) detail.push("素焼きハガルが、一途なフレーバーの輪郭を太くした。");
  if (tt.hms === "lotos_hagal") score += 2;
  else if (tt.hms === "tanukish_lid") score += 3;
  else if (tt.hms === "amaburst_hms") {
    if (p.heat >= 1.05) { score += 5; detail.push("アマバーストの高火力が、耐熱フレーバーと噛み合った。"); }
    else { score -= 3; detail.push("アマバーストの熱に、フレーバーが少し焼けた。"); }
  }
  if (tt.charcoal === "flat_charcoal") score += 3;
  else if (tt.charcoal === "cube_charcoal") {
    if (p.weight >= 1.0) { score += 4; detail.push("キューブ炭の火力が、重い煙を底から支えた。"); }
    else { score -= 2; detail.push("キューブ炭には、煙が軽すぎたかもしれない。"); }
  }
  // アルミ穴あけ
  score += Math.max(0, (tt.foilHits - 2) * 2);
  if (tt.foilHits <= 2) detail.push("アルミの穴が乱れ、空気の通りにムラが出た。");
  else if (tt.foilHits >= 6) detail.push("均等な穴あけが、煙の通り道を整えた。");
  // 炭起こし
  score += { perfect: 6, good: 3, miss: -2 }[tt.coalFire] || 0;
  if (tt.coalFire === "miss") detail.push("熾きの甘い炭が、立ち上がりを鈍らせた。");
  // 集中
  score += tt.focusCleared * 1.6;
  // テーマとフレーバーカテゴリの噛み合い
  const matched = tt.theme.best.filter((c) => p.cats.has(c)).length;
  if (matched >= 2) { score += 12; detail.push("テーマとフレーバーの相性は抜群だった。"); }
  else if (matched === 1) { score += 7; detail.push("テーマとフレーバーはよく噛み合っていた。"); }
  else { detail.push("テーマとフレーバーが、どこか噛み合っていない。"); }
  // 高火力テーマは耐熱が必要
  if (tt.theme.id === "high_heat" && p.heat < 1.0) { score -= 6; detail.push("熱にフレーバーが負けてしまった。"); }
  // パッキング × 煙の重さ
  if (tt.pack === "normal") score += 6;
  else if (tt.pack === "fluffy") score += p.weight < 1.0 ? 9 : 3;
  else if (tt.pack === "firm") score += p.weight >= 1.0 ? 9 : 3;
  // 葉の量（12g基準）× 熱の収支。多く詰むほど味の持ちは良くなるが、必要な熱も増える
  const totalG = Object.values(tt.mix).reduce((a, b) => a + b, 0) || 12;
  const extraG = Math.max(0, totalG - 12);
  const heatPower =
    ({ two: 2, triangle: 3, four: 4 }[tt.coal] || 3) +
    (tt.charcoal === "cube_charcoal" ? 1 : 0) +
    (tt.hms === "amaburst_hms" ? 1 : 0) +
    (tt.coalFire === "perfect" ? 0.5 : tt.coalFire === "miss" ? -0.5 : 0);
  const needHeat = totalG <= 13 ? 2 : totalG <= 16 ? 3 : 4;
  if (extraG > 0) {
    if (heatPower >= needHeat) {
      score += Math.min(9, extraG * 1.2);
      detail.push("多めに詰んだ葉が、味の劣化をゆっくりにした。最後の一口まで輪郭が残る。");
    } else {
      score -= 6;
      detail.push("葉の量に熱が追いつかない。多めに詰んだ分が、温まりきらないまま埋もれた。");
    }
  }
  // 炭の配置
  if (tt.coal === "triangle") { score += 8; detail.push("トライアングルの炭が、安定した熱を作った。"); }
  else if (tt.coal === "two") score += 3;
  else if (tt.coal === "four") {
    // 葉が多いボウルは高火力を受け止められる
    if (p.heat >= 1.05 || totalG >= 15) { score += 7; detail.push("高火力に耐える一台が、力強い煙を生んだ。"); }
    else { score -= 4; detail.push("炭が多すぎた。焦げの気配が混じる。"); }
  }
  // 蒸らし
  if (tt.steam === 5 || tt.steam === 8) {
    score += 10;
    detail.push("蒸らしはちょうどいい。香りがきれいに開いた。");
  } else if (tt.steam === 3) {
    score += tt.theme && tt.theme.id === "fruity" ? 6 : 3;
    detail.push("短めの蒸らしで、香りの立ち上がりは軽い。");
  } else if (tt.steam === 10) {
    if (p.weight >= 1.0 || (tt.theme && tt.theme.id === "aftertaste")) { score += 6; detail.push("長めの蒸らしが、重い煙と余韻を引き出した。"); }
    else { score -= 2; detail.push("長めに待ったぶん、軽い香りが少し飛んだ。"); }
  } else if (tt.steam === 0) {
    if (zeroSteamUnlocked()) { score += tt.theme && tt.theme.id === "high_heat" ? 8 : 4; detail.push("神崎竜二譲りの0分スタイルで、吸いながら温度を立ち上げた。"); }
    else { score -= 6; detail.push("蒸らしを飛ばしたことで、立ち上がりが粗くなった。"); }
  }
  // 蒸らしの締め（一手のタイミング）
  if (typeof tt.steamHits === "number") {
    if (tt.steamHits === 0) { score += 6; detail.push("蒸らし中、雑念に一度も捕まらなかった。煙に芯が立つ。"); }
    else if (tt.steamHits <= 2) score += 3;
    else { score -= 4; detail.push("蒸らし終わりの一手が乱れ、煙の芯が少し揺れた。"); }
  }
  // 吸い出し（提供時の温度）
  score += { perfect: 12, good: 6, miss: 0 }[tt.pull];
  // 吸いすぎペナルティ: 4回目以降の吸い出しは提供前に葉を痩せさせる
  const overPulls = Math.max(0, (tt.pullCount || 0) - 3);
  if (overPulls > 0) {
    score -= overPulls * 3;
    detail.push("提供前に吸いすぎた。葉が痩せて、最初の一口の厚みが削れている。");
  }
  // ---- 準備の成果（大会本番のみ）----
  if (tt.mode === "tournament") {
    // 練習ドリルの自己ベスト（最大+8）
    const pb = state.practiceBest || {};
    const practiceBonus = Math.min(8, Object.values(pb).reduce((a, b) => a + b, 0));
    if (practiceBonus > 0) {
      score += practiceBonus;
      detail.push(practiceBonus >= 6 ? "積み重ねた練習が、手に馴染んでいる。" : "練習の感覚が、ふと手元に戻ってくる。");
    }
    // 仲間から教わった技（LIMEイベントの学び）
    const f = state.flags;
    if (f._ev_interaction_naru_night_01 && (tt.steam === 5 || tt.steam === 8)) {
      score += 3;
      detail.push("『蒸らしの最後に炭をひとつ外す』。なるの技が一口目を整えた。");
    }
    if (f._ev_outing_naru_1) {
      score += 2;
      detail.push("機材の理屈が頭に入っている。なるとの買い出しが効いた。");
    }
    if (f._ev_interaction_minto_noon_01 && (tt.theme.id === "relax" || tt.theme.id === "fruity")) {
      score += 3;
      detail.push("『時間帯で濃さを変える』。みんとの教えが昼の会場に合った。");
    }
    // 前日リハーサル
    const rt = f._rehearsal_tier;
    if (rt) {
      score += { great: 4, good: 3, rough: 2 }[rt] || 2;
      detail.push("前日のリハーサルが、体の力みを抜いてくれた。");
    }
  }
  return { score, detail };
}

// ============================================================================
// FLAVOR TRIAL（審査）— master_spec 第2部 #3。CLAUDE.mdの「プレゼン工程は廃止」を本仕様が上書き。
// コンセプト(=tt.theme/制作前の方針) と、制作結果から自動生成したアピールポイント(=実績)を、
// 審査員のザワザワ(疑問)に「ぶつける」。実績で裏打ちされた一致=納得↑／口だけ=「香ってない！」／
// 見当違い=「ズレてる！」。正式用語=コンセプト/アピールポイント/ぶつける（弾丸系は使わない・#17）。
// ============================================================================
// cat: aroma(香り) / smoke(煙量) / craft(仕上げ) / burn(焦げにくさ)
function buildAppeals() {
  const hr = tt.holeResult || {}, cr = tt.coalResult || {}, prof = mixProfile();
  const themeMatch = tt.theme ? tt.theme.best.filter((c) => prof.cats.has(c)).length >= 1 : false;
  return [
    { id: "hole_even", label: "外周の穴が均等に開いてる", cat: "craft", backed: (hr.heatSpread || 0) >= 62 || (hr.evenness || 0) >= 70 },
    { id: "hole_a", label: "穴あけはA評価の通り", cat: "craft", backed: (hr.score || 0) >= 76 },
    { id: "inner_low", label: "内周は攻めすぎていない", cat: "burn", backed: (hr.innerHoles || 0) <= 4 },
    { id: "just_coal", label: "炭はジャストで取り上げた", cat: "aroma", backed: (cr.justCount || 0) >= 1 },
    { id: "flash", label: "炭の芯をピカンで仕留めた", cat: "craft", backed: !!cr.coalFlashSuccess },
    { id: "heat_stable", label: "火力は安定している", cat: "smoke", backed: (cr.heatStability || 0) >= 62 },
    { id: "low_burn", label: "焦げリスクは低めに収めた", cat: "burn", backed: (cr.burnRisk == null ? 50 : cr.burnRisk) <= 48 },
    { id: "smoke_a", label: "煙量はしっかり出ている", cat: "smoke", backed: prof.weight >= 0.95 },
    { id: "aroma_on", label: "狙った香りが芯まで乗ってる", cat: "aroma", backed: themeMatch && (cr.aromaRetention || 50) >= 55 },
  ];
}
const TRIAL_DOUBTS = [
  { need: "aroma", text: "……この一台、狙った香りはちゃんと芯まで残っているのか？" },
  { need: "smoke", text: "悪くない。だが、煙量が少し物足りなく感じるな。" },
  { need: "craft", text: "急いで仕上げた分、詰めや穴に粗さは出ていないか？" },
];

function flavorTrial(onDone) {
  if (tt) tt.step = "trial";
  const appeals = buildAppeals();
  let gauge = 50, round = 0, successCount = 0, lieCount = 0;

  const render = () => {
    const body = tnPanel("審査 ── FLAVOR TRIAL",
      "審査員のザワザワに、自分の“アピールポイント”をぶつけて納得させろ。実績の伴わない強気は「香ってない！」と返される。");
    const d = TRIAL_DOUBTS[round];
    const arena = document.createElement("div");
    arena.className = "trial-arena";
    arena.innerHTML =
      `<div class="trial-gauge"><span>納得ゲージ</span><i class="trial-gauge-bar"><b id="trial-gauge-b" style="width:${gauge}%"></b></i></div>` +
      `<div class="trial-doubt" id="trial-doubt" data-need="${d.need}">「${d.text}」<span class="trial-zawa">ザワ…ザワ…</span></div>` +
      `<div class="trial-concept">あなたのコンセプト: <b>${tt.theme ? tt.theme.label : "—"}</b>　── これを証明する一手をぶつけろ</div>` +
      `<div class="trial-hand" id="trial-hand"></div>` +
      `<div class="trial-feedback" id="trial-feedback"></div>`;
    body.appendChild(arena);
    const hand = arena.querySelector("#trial-hand");
    for (const a of appeals) {
      const btn = document.createElement("button");
      btn.className = "trial-appeal" + (a.backed ? " backed" : " weak");
      btn.dataset.cat = a.cat; btn.dataset.backed = a.backed ? "1" : "0";
      btn.innerHTML = `<span class="ta-label">${a.label}</span><span class="ta-badge">${a.backed ? "✓実績" : "強気"}</span>`;
      btn.addEventListener("click", () => hit(a));
      hand.appendChild(btn);
    }
  };

  const hit = (a) => {
    const d = TRIAL_DOUBTS[round];
    document.querySelectorAll(".trial-appeal").forEach((b) => (b.disabled = true));
    let res, cls, delta;
    if (a.cat === d.need && a.backed) { res = "ぶつけた──「確かに、言う通りだ！」　FLAVOR SYNC!!"; cls = "good"; delta = 18; successCount++; }
    else if (a.cat === d.need && !a.backed) { res = "「香ってない！ それは口だけだ！」　SESSION BREAK"; cls = "bad"; delta = -14; lieCount++; }
    else { res = "「それは……今の話とズレてる！」"; cls = "bad"; delta = -7; }
    gauge = Math.max(0, Math.min(100, gauge + delta));
    const gb = $("#trial-gauge-b"); if (gb) gb.style.width = `${gauge}%`;
    const fb = $("#trial-feedback");
    fb.innerHTML = `<span class="trial-line">${res}</span>`;
    fb.className = `trial-feedback show ${cls}`;
    if (window.SFX) (delta > 0 ? SFX.perfect : SFX.miss)();
    if (delta > 0) { showStamp($("#tn-layout .panel"), "just"); if (tt.mode === "tournament") { pakkiLive("perfect"); broadcastJudge("perfect", "SYNC"); } }
    else if (tt.mode === "tournament") nicoBurst("miss", 1);
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = round < TRIAL_DOUBTS.length - 1 ? "次のザワザワへ ▶" : "審査を終える ▶";
    next.addEventListener("click", () => { round++; (round < TRIAL_DOUBTS.length) ? render() : finishTrial(); });
    fb.appendChild(next);
  };

  const finishTrial = () => {
    tt.presentationResult = { score: Math.round(gauge), convinceGauge: Math.round(gauge), successCount, lieCount };
    const body = tnPanel("FLAVOR TRIAL ── 講評", "");
    const r = document.createElement("div");
    r.className = "practice-result";
    r.innerHTML =
      (gauge >= 75 ? "──審査員が深く頷いた。「言ったことと、煙が、ちゃんと一致している」"
      : gauge >= 45 ? "──審査員は半分だけ納得した様子だ。「悪くはない」"
      : "──審査員の眉根は寄ったままだ。「言葉は立派だが……香ってこない」") +
      `<div class="hole-summary">納得 ${Math.round(gauge)}％ ／ 一致 ${successCount} ／ 乖離 ${lieCount}</div>`;
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = "結果発表へ ▶";
    next.addEventListener("click", () => onDone());
    r.appendChild(next);
    body.appendChild(r);
  };

  render();
}

function finishTournament() {
  // 生放送レイヤーの流れるコメントは結果発表前に片付ける（体感スコアtt.feelScoreは保持＝#25で使う）
  const lane = document.getElementById("tn-comments"); if (lane) lane.innerHTML = "";
  const feelEl = document.getElementById("tn-feel"); if (feelEl) feelEl.classList.remove("show");
  const s = state.stats;
  const statScore = (s.technique * 1.2 + s.sense * 1.0 + s.guts * 0.6 + s.charm * 0.8 + s.insight * 1.0) / 4.6;
  const craft = craftScore();
  // プレゼン工程は廃止。提供の所作・佇まいが魅力としてわずかに乗る
  let serveBonus = s.charm / 10;
  if (state.flags._ev_outing_adam_1) {
    serveBonus += 2;
    craft.detail.push("『その煙で誰に何を伝えたいのか』。アダムの問いが、提供の一杯に芯を通した。");
  }
  if (state.flags._ev_outing_minto_1) {
    serveBonus += 2;
    craft.detail.push("みんと直伝の空気の作り方が、提供の瞬間、審査員の表情を柔らかくした。");
  }
  // FLAVOR TRIAL（審査）の納得ゲージをわずかに上乗せ（master_spec §7のプレゼン枠・±で効く）
  const pres = tt.presentationResult ? (tt.presentationResult.convinceGauge - 50) / 6 : 0;
  if (tt.presentationResult) {
    if (tt.presentationResult.convinceGauge >= 70) craft.detail.push("審査で、コンセプトとアピールポイントがぴたりと噛み合った。");
    else if ((tt.presentationResult.lieCount || 0) >= 2) craft.detail.push("審査では、実績を伴わないアピールが見抜かれ「香ってない」と返された。");
  }
  const base = statScore * 0.55 + craft.score * 0.45 + serveBonus + pres;

  const results = RIVALS.map((r) => ({
    id: r.id, name: r.name,
    score: r.base + (Math.random() * 8 - 4),
  }));
  const topRival = Math.max(...results.map((r) => r.score));

  // 審査員持ち点投入制: 南雲は持ち点を最後まで温存する。一台の出来（craft）が
  // 基準を超えたときだけ、最終発表で全持ち点を一括投入して逆転が起きる。
  // 基準未達なら持ち点は動かず、暫定順位のまま＝普通に敗北する
  const NAGUMO_CRAFT_BAR = 80;
  let playerScore = base;
  if (craft.score >= NAGUMO_CRAFT_BAR) {
    playerScore = Math.max(base + 16, topRival + 1.2);
    craft.detail.push("──最終発表。それまで一度も動かなかった南雲修二が、温存していた持ち点10を、すべてこの一台に投入した。");
  } else {
    craft.detail.push("……南雲修二の持ち点は、最後まで動かなかった。「もう一口」を引き出せなかった、ということだ。");
  }

  results.push({ id: "hajime", name: "はじめ", score: playerScore });
  results.sort((a, b) => b.score - a.score);
  const rank = results.findIndex((r) => r.id === "hajime") + 1;

  showResult(results, rank, craft.detail);
}

// RESULT 10 COUNT（結果発表の10カウント演出）— master_spec 第2部 #4
// 集計中…→会場ざわめき→10…0→プチュン(1位確定)/パリン(2位以下)。カウント中はカットインを挟む。
// プレミア時は2〜3秒残しでフライングプチュン。プチュンは必ず1位、パリンは2位以下。
// 出場者が作った一台（シーシャ）の色。はじめは配合の主役フレーバー、ライバルは仮の代表色。
const RIVAL_SHISHA = {
  naru: "#8fe3c0", adam: "#d96a6a", minto: "#e89ad0",
  kumicho: "#b69cff", rei: "#9ab8ff", ageha: "#ffc46a",
  nandi: "#e0b060", steve: "#90c0d0", volk: "#c0c8d8",
  sheikh: "#e8c878", master_hookah: "#d0a0ff", shisha_9000: "#7de8ff",
};
function contestantShishaColor(id) {
  if (id === "hajime") {
    const top = Object.entries(tt.mix || {}).sort((a, b) => b[1] - a[1])[0];
    return (top && FLAVOR_COLORS[top[0]]) || (tt.theme && tt.theme.best && FLAVOR_COLORS[tt.theme.best[0]]) || "#cdb98a";
  }
  return RIVAL_SHISHA[id] || "#bda0e0";
}

// RESULT 10 COUNT（結果発表“前”のbuildup・#14/#48）。中央のカウントの周りに、
// 出場者の「お祈りカット」と作った一台を並べる＝カット割。お祈り/立ち絵の専用画像は生成待ちのため、
// 顔アイコン（あれば）＋名前＋一台の色で仮組み。プレミア(#47)は暗転→プチュンのフライング。
function runResultCountdown(rank, premium, onDone, contestants) {
  let ov = document.getElementById("result-count");
  if (!ov) { ov = document.createElement("div"); ov.id = "result-count"; $("#game").appendChild(ov); }
  const list = (contestants && contestants.length) ? contestants : [{ id: "hajime", name: "はじめ" }, ...RIVALS];
  const cards = list.map((c) => {
    const pray = faceIconHtml(c.id, "rc-pray-face") || `<span class="rc-pray-ph">🙏</span>`;
    return `<div class="rc-card${c.id === "hajime" ? " me" : ""}" data-id="${c.id}">` +
      `<div class="rc-pray">${pray}<span class="rc-pray-tag">祈</span></div>` +
      `<div class="rc-bowl" style="--cc:${contestantShishaColor(c.id)}"></div>` +
      `<div class="rc-card-name">${c.name}</div></div>`;
  }).join("");
  ov.className = "rc show";
  ov.innerHTML =
    `<div class="rc-cards">${cards}</div>` +
    `<div class="rc-num" id="rc-num"></div>` +
    `<div class="rc-msg" id="rc-msg">集計中……</div>`;
  const numEl = ov.querySelector("#rc-num");
  const msgEl = ov.querySelector("#rc-msg");
  const cardEls = [...ov.querySelectorAll(".rc-card")];
  // カット割: カウント中、ランダムな出場者の「お祈り」にカットを切り替える（緊張の高まり）
  const flashCut = () => {
    if (!cardEls.length) return;
    const pick = cardEls[Math.floor(Math.random() * cardEls.length)];
    cardEls.forEach((el) => el.classList.remove("cut"));
    pick.classList.add("cut");
    setTimeout(() => pick.classList.remove("cut"), 330);
  };
  const finish = (cls, msg, sfx, smoke) => {
    numEl.textContent = ""; msgEl.textContent = "";
    ov.classList.add(cls);
    if (window.SFX && sfx) sfx();
    if (smoke) smokeRings(4);
    const t = document.createElement("div");
    t.className = `rc-final ${cls}`;
    t.textContent = msg;
    ov.appendChild(t);
    setTimeout(() => { ov.className = "rc"; ov.innerHTML = ""; onDone(); }, 1650);
  };
  const doPuchun = () => finish("puchun", "PERFECT SESSION!!", () => { SFX.bubble(); setTimeout(() => SFX.fanfare(), 220); }, true);
  const puchun = () => {
    // #47 プレミアは暗転(ブラックアウト)→プチュンのフライング
    if (premium) {
      ov.classList.add("blackout");
      if (window.SFX) SFX.click();
      return setTimeout(() => { ov.classList.remove("blackout"); doPuchun(); }, 380);
    }
    doPuchun();
  };
  const parin = () => finish("parin", "SESSION BREAK", () => SFX.miss(), false);
  let n = 10;
  const premiumAt = premium ? 3 : -1; // プレミアは少し残してフライング
  setTimeout(function tick() {
    if (n <= 0) { msgEl.textContent = "──結果発表！"; return rank === 1 ? puchun() : parin(); }
    if (rank === 1 && n === premiumAt) { msgEl.textContent = "……!?"; return puchun(); } // フライング（1位のみ）
    msgEl.textContent = n > 6 ? "まもなく、結果発表……" : "結果発表まで、あと";
    numEl.textContent = String(n);
    numEl.classList.remove("pop"); void numEl.offsetWidth; numEl.classList.add("pop");
    if (window.SFX) SFX.click();
    if (n % 2 === 0) flashCut();
    n--;
    setTimeout(tick, 360);
  }, 520);
}

// 大会後リザルトの工程内訳（#25）。各工程をA/B/Cで採点し、低い工程に“次への手がかり”を添える。
function gradeLetter(tier) { return tier >= 2 ? "A" : tier === 1 ? "B" : "C"; }
function tournamentBreakdown() {
  const items = [];
  const add = (label, tier, hint) => items.push({ label, grade: gradeLetter(tier), tier, hint });
  add("穴あけ", tt.foilHits >= 6 ? 2 : tt.foilHits >= 4 ? 1 : 0, "リングの均等度を上げると煙の通りが整う");
  add("炭起こし", tt.coalFire === "perfect" ? 2 : tt.coalFire === "good" ? 1 : 0, "芯がピカッと閃く“取り頃”で取ると熱が乗る");
  if (typeof tt.steamHits === "number") add("蒸らし", tt.steamHits === 0 ? 2 : tt.steamHits <= 2 ? 1 : 0, "蒸らし中の雑念を躱しきると煙の芯が立つ");
  add("集中", tt.focusCleared >= 5 ? 2 : tt.focusCleared >= 3 ? 1 : 0, "集中を保つと手元のブレが減る");
  add("吸い出し", tt.pull === "perfect" ? 2 : tt.pull === "good" ? 1 : 0, "適温の窓でJUSTを重ねると一気に伸びる");
  const p = mixProfile();
  const matched = tt.theme && tt.theme.best ? tt.theme.best.filter((c) => p.cats.has(c)).length : 0;
  add("テーマ相性", matched >= 2 ? 2 : matched === 1 ? 1 : 0, "コンセプトに合うカテゴリを2つ以上揃える");
  if (tt.presentationResult) {
    const g = tt.presentationResult.convinceGauge;
    add("審査", g >= 75 ? 2 : g >= 45 ? 1 : 0, "実績の伴うアピールを“ぶつける”と納得が伸びる");
  }
  return items;
}
function buildBreakdownPanel() {
  const items = tournamentBreakdown();
  const el = document.createElement("div");
  el.className = "result-breakdown";
  const lows = items.filter((it) => it.tier < 2).slice(0, 3);
  el.innerHTML =
    `<div class="rb-head">出来の内訳<span class="rb-sub">── 次への手がかり</span>` +
    (tt.feelScore ? `<span class="rb-feel">観客の体感スコア <b>${tt.feelScore}</b> P</span>` : "") + `</div>` +
    `<div class="rb-grid">` +
    items.map((it) => `<div class="rb-item g-${it.grade}"><span class="rb-label">${it.label}</span><span class="rb-grade">${it.grade}</span></div>`).join("") +
    `</div>` +
    `<div class="rb-hints">` +
    (lows.length ? lows.map((it) => `<p>・${it.label}: ${it.hint}</p>`).join("")
      : `<p>・どの工程も高水準。次は他のテーマでも安定を狙おう。</p>`) +
    `</div>`;
  return el;
}

function showResult(results, rank, detail, opts = {}) {
  const reveal = () => {
  const body = tnPanel("審査結果", "");
  $("#tn-title").textContent = opts.title || `${cupName()} — 審査結果`;
  $("#tn-progress").textContent = "RESULT";
  const note = document.createElement("div");
  note.className = "result-note";
  note.innerHTML = detail.map((d) => `<p>${d}</p>`).join("");
  const table = document.createElement("div");
  table.className = "result-table";
  const topScore = Math.max(...results.map((r) => r.score));
  const rows = results.map((r, i) => {
    const row = document.createElement("div");
    row.className = "result-row" + (r.id === "hajime" ? " me" : "") + ` rank-${i + 1}`;
    row.innerHTML =
      `<div class="result-bar"></div>` +
      `<span class="result-rank">${i + 1}位</span><span class="result-name">${r.name}</span>` +
      `<span class="result-score">${r.score.toFixed(1)}</span>`;
    table.appendChild(row);
    return row;
  });
  // 4位から順にリビール
  rows.slice().reverse().forEach((row, i) => {
    setTimeout(() => {
      row.classList.add("show");
      if (window.SFX) SFX.click();
      const bar = row.querySelector(".result-bar");
      const r = results[rows.indexOf(row)];
      requestAnimationFrame(() => { bar.style.width = `${(r.score / topScore) * 100}%`; });
      if (rows.indexOf(row) === 0 && results[0].id === "hajime" && window.SFX) {
        setTimeout(() => SFX.fanfare(), 450);
      }
    }, 500 + i * 750);
  });
  // 出来の内訳（#25）。順位リビールが終わってから、ボタンと一緒にふわっと出す
  const breakdown = (tt && tt.mode === "tournament") ? buildBreakdownPanel() : null;
  if (breakdown) { breakdown.style.opacity = "0"; breakdown.style.transition = "opacity 0.5s"; }
  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.style.opacity = "0";
  btn.style.transition = "opacity 0.4s";
  setTimeout(() => { if (breakdown) breakdown.style.opacity = "1"; btn.style.opacity = "1"; }, 500 + rows.length * 750 + 400);
  if (rank === 1) {
    btn.textContent = "──表彰のあとへ ▶";
    btn.addEventListener("click", opts.onWin || (() => {
      addMoney(CHAPTER_PRIZE[1]); // 優勝賞金（章別スケーリング）
      // 審査(judging)・発表(reveal)は既にカウント前後で流したので、ここは表彰後の余韻だけ
      playDialogue("ch1_tournament_after", () => postClearPhone(() => showClear()), "res://assets/backgrounds/bg_tournament_stage.png");
    }));
  } else {
    btn.textContent = "……結果を受け止める";
    btn.addEventListener("click", opts.onLose || (() => {
      // 1位のみ進出。2位以下はゲームオーバー（賞金なし・やり直す/タイトルへ）
      tt.rank = rank;
      playDialogue("ch1_tournament_defeat", () => showDefeat(rank), "res://assets/backgrounds/bg_tournament_stage.png");
    }));
  }
  if (breakdown) body.append(note, table, breakdown, btn);
  else body.append(note, table, btn);
  };
  // 大会の結果発表だけ、RESULT 10 COUNT（プチュン=1位/パリン=2位以下）を先に挟む（#14）。
  // カウント中は大会画面に切り替えて中身を空にする（直前の会話画面を active に残さない＝
  // 自動操作・プレイヤーが消えた会話レイヤーを触ってしまうのを防ぐ）
  if (tt && tt.mode === "tournament" && !opts.skipCountdown) {
    showScreen("#screen-tournament");
    $("#tn-title").textContent = "";
    $("#tn-progress").textContent = "RESULT";
    $("#tn-body").innerHTML = "";
    const premium = rank === 1 && tt.foilHits >= 6 && tt.coalFire === "perfect";
    const BG = "res://assets/backgrounds/bg_tournament_stage.png";
    // ch1優勝ルートだけ、順番を整える（#16/#48）: 審査(南雲の二口)→「もうだめだ」→
    // 10カウント(buildup)→ 総合印象点の満点で逆転発表。負け/ch2は従来どおり。
    if (state.chapter === 1 && rank === 1) {
      return playDialogue("ch1_tournament_judging",
        () => runResultCountdown(rank, premium,
          () => playDialogue("ch1_tournament_reveal", reveal, BG), results), BG);
    }
    return runResultCountdown(rank, premium, reveal, results);
  }
  reveal();
}

function showClear() {
  stopRigEffects();
  if (window.SFX) SFX.fanfare();
  state.phase = "cleared";
  save();
  showScreen("#screen-end");
  $("#screen-end").classList.remove("gameover");
  $("#end-title").textContent = "第1章クリア！";
  $("#end-sub").textContent = "SMOKE CROWN CUP 優勝 ── 地区大会 HAZE: OPEN CLOUD へ。";
  renderStatusInto($("#end-status"));
  const goCh2 = document.createElement("button");
  goCh2.className = "primary-btn";
  goCh2.textContent = "第2章へ進む";
  goCh2.addEventListener("click", () => { if (window.SFX) SFX.select(); startChapter2(); });
  $("#end-status").appendChild(goCh2);
}

function showDefeat(rank) {
  stopRigEffects();
  showScreen("#screen-end");
  $("#screen-end").classList.add("gameover");
  $("#end-title").textContent = "GAME OVER";
  $("#end-sub").textContent = state.chapter === 2
    ? `結果は${rank}位。${CH2_STAGE_LABEL[state.ch2Stage] || ""}敗退──1位だけが、先へ進める。ここで終わりだ。`
    : `結果は${rank}位。優勝だけが次への切符だった。ここで、終わってしまった。`;
  renderStatusInto($("#end-status"));
  const btns = document.createElement("div");
  btns.className = "gameover-actions";
  const retry = document.createElement("button");
  retry.className = "primary-btn";
  retry.textContent = "もう一度挑戦する";
  retry.addEventListener("click", () => { $("#screen-end").classList.remove("gameover"); beginMaking(); });
  const toTitle = document.createElement("button");
  toTitle.className = "primary-btn ghost";
  toTitle.textContent = "タイトルに戻る";
  toTitle.addEventListener("click", () => {
    $("#screen-end").classList.remove("gameover");
    if (window.SFX) SFX.bgm("title");
    showScreen("#screen-title");
  });
  btns.append(retry, toTitle);
  $("#end-status").appendChild(btns);
}

// ---------------------------------------------------------------- 第2章 HAZE: OPEN CLOUD
// 14日制の中に予選(DAY8)→準決勝(DAY11)→決勝(DAY14)を配置。
// 1位のみ通過。名前付きライバルは別ブロックを勝ち上がって決勝で当たる
const CH2_STAGES = {
  qual: {
    rivals: [
      { id: "q1", name: "東部エリア代表", base: 56 },
      { id: "q2", name: "湾岸エリア代表", base: 61 },
      { id: "q3", name: "港町の老舗代表", base: 53 },
    ],
    bar: 58,
    prize: 5000,
    after: "ch2_adam_distance",
    winDetail: "──予選通過。審査席の端で、白衣の男が小さくペンを走らせた。",
    loseDetail: "……札は伸びなかった。地区上位の「普通」は、地元の「上出来」より上にある。",
  },
  semi: {
    rivals: [
      { id: "ageha", name: "あげは", base: 69 },
      { id: "s1", name: "北部ブロック覇者", base: 64 },
      { id: "s2", name: "南部ブロック覇者", base: 66 },
    ],
    bar: 70,
    prize: 10000,
    after: "ch2_naru_confrontation",
    winDetail: "──審査席のチャコール博士が、はじめの欄に何かを長く書き込んでいる。「データに入らない強さ」、と。",
    loseDetail: "……あと一歩、届かない。借り物の理屈では、ここから先の壁は破れない。",
  },
  final: {
    rivals: [
      { id: "rei", name: "零-REI-", base: 76 },
      { id: "kumicho", name: "神崎竜二", base: 73 },
      { id: "f1", name: "西地区ブロック覇者", base: 70 },
    ],
    bar: 80,
    prize: CHAPTER_PRIZE[2], // 決勝＝章別優勝賞金
    winDetail: "──最終発表。審査員たちの残り持ち点が、音を立ててこの一台に注がれていく。自分史上、もっとも綺麗にまとまった煙だった。",
    loseDetail: "……持ち点は動かなかった。綺麗なだけの煙では、頂点の「もう一口」は引き出せない。",
  },
};

function startChapter2() {
  state.chapter = 2;
  state.statsBaseline = { ...state.stats }; // 章開始時の値を成長の起点として記録
  state.day = 1;
  state.ap = 2;
  state.phase = "daily";
  state.pendingLimeNight = null;
  delete state.ch2Stage;
  save();
  engulfInSmoke(() => {
    showChapterTitle(
      { no: "第二章", num: "Ⅱ", name: "才能の壁", read: "ジェラシー・ヘイズ ── JEALOUSY HAZE", sub: "HAZE: OPEN CLOUD 編" },
      () => {
        if (window.SFX) SFX.bgm("daily_part");
        playDialogue("ch2_opening", () =>
          playDialogue("ch2_rivals_first_sight", () => {
            save();
            showDayCard("DAY 1", "HAZE: OPEN CLOUD 予選まで あと7日");
            showMap();
          })
        );
      }
    );
  });
}

// 試合日の開始。stage: "qual" | "semi" | "final"
function startCh2Stage(stage) {
  state.phase = "tournament";
  // 地区大会の組み合わせ発表で対戦相手の名前が判明する
  if (stage === "semi") markMet("ageha");
  if (stage === "final") { markMet("rei"); markMet("kumicho"); }
  state.ch2Stage = stage;
  updateHud();
  save();
  const BG = "res://assets/backgrounds/bg_tournament_stage.png";
  if (stage === "final") {
    // 決勝の朝（スミさんのLIME〜返信を打てない）は ch2_empty_victory の前半を使う
    const ev = D.dialogues.ch2_empty_victory || { lines: [] };
    return playCustom({
      dialogue_id: "ch2_final_morning",
      metadata: { bg: BG },
      lines: ev.lines.slice(0, 4),
    }, () => beginMaking());
  }
  const intro = stage === "qual"
    ? [
        { speaker: "", face: "", text: "──HAZE: OPEN CLOUD、予選ブロック当日。C.STATIONの天井は、地方会場の倍も高い。" },
        { speaker: "pakki", face: "normal", text: "ぷぷぷっ！　地区の煙自慢が勢ぞろい！　今大会の課題フレーバーは──ストロベリー！　県特産の苺を2g以上、しっかり使ってね♪" },
        { speaker: "hajime", face: "serious", text: "（苺……シーシャのストロベリーは、想像する甘さと違う。輪郭の見えにくい、いちばん難しい果実だ）" },
      ]
    : [
        { speaker: "", face: "", text: "──準決勝。客席が、予選の倍に膨らんでいる。" },
        { speaker: "pakki", face: "normal", text: "勝ち残ったのは各ブロックの猛者だけ！　課題は変わらずストロベリー！　それじゃあ──火を入れて！" },
        { speaker: "hajime", face: "normal", text: "（……勝ってる。勝ててしまっている。借り物の理屈で）" },
      ];
  playCustom({ dialogue_id: `ch2_${stage}_intro`, metadata: { bg: BG }, lines: intro }, () => beginMaking());
}

function finishCh2Stage() {
  const stage = state.ch2Stage || "qual";
  const cfg = CH2_STAGES[stage];
  const s = state.stats;
  const statScore = (s.technique * 1.2 + s.sense * 1.0 + s.guts * 0.6 + s.charm * 0.8 + s.insight * 1.0) / 4.6;
  const craft = craftScore();
  const serveBonus = s.charm / 10; // プレゼン廃止後は提供の佇まいだけが乗る
  const base = statScore * 0.55 + craft.score * 0.45 + serveBonus;
  const results = cfg.rivals.map((r) => ({ id: r.id, name: r.name, score: r.base + (Math.random() * 6 - 3) }));
  const topRival = Math.max(...results.map((r) => r.score));
  let playerScore = base;
  if (craft.score >= cfg.bar) {
    playerScore = Math.max(base + 10, topRival + 1.0);
    craft.detail.push(cfg.winDetail);
  } else {
    craft.detail.push(cfg.loseDetail);
  }
  results.push({ id: "hajime", name: "はじめ", score: playerScore });
  results.sort((a, b) => b.score - a.score);
  const rank = results.findIndex((r) => r.id === "hajime") + 1;
  showResult(results, rank, craft.detail, {
    title: `HAZE: OPEN CLOUD ${CH2_STAGE_LABEL[stage]} — 審査結果`,
    onWin: () => {
      addMoney(cfg.prize);
      stopRigEffects();
      state.phase = "daily";
      save();
      if (stage === "final") {
        // 誰もいない優勝（ch2_empty_victory の後半）→ 章クリア
        const ev = D.dialogues.ch2_empty_victory || { lines: [] };
        return playCustom({
          dialogue_id: "ch2_empty_victory_post",
          metadata: { bg: "res://assets/backgrounds/bg_tournament_stage.png" },
          lines: ev.lines.slice(4),
        }, () => showCh2Clear());
      }
      // 勝った夜に、仲間がひとり離れていく
      playDialogue(cfg.after, () => advanceDay());
    },
    onLose: () => {
      tt.rank = rank;
      showDefeat(rank);
    },
  });
}

function showCh2Clear() {
  stopRigEffects();
  state.phase = "cleared";
  save();
  showScreen("#screen-end");
  $("#screen-end").classList.remove("gameover");
  $("#end-title").textContent = "第2章クリア";
  $("#end-sub").textContent = "HAZE: OPEN CLOUD 優勝──誰もいない頂点。物語は第3章「東京編」へ続く。";
  renderStatusInto($("#end-status"));
}

// ---------------------------------------------------------------- status
// 抽象ランク呼称（master_spec #19-a。レーダー化はFable側A4で。ここでは一言ラベル）
const STAT_RANK_LABELS = {
  technique: ["見習い", "様になってきた", "一人前", "職人肌", "神業"],
  sense:     ["ふつう", "光るものがある", "冴えてる", "唯一無二", "天才肌"],
  guts:      ["三日坊主", "粘り気味", "へこたれない", "不屈", "鋼メンタル"],
  charm:     ["影うすい", "親しみやすい", "華がある", "目が離せない", "カリスマ"],
  insight:   ["鈍め", "気が利く", "よく見てる", "見抜く目", "千里眼"],
};
function statRankLabel(en) {
  const v = state.stats[en] || 0;
  const i = Math.max(0, Math.min(4, Math.ceil(v / 20) - 1));
  return (STAT_RANK_LABELS[en] || [])[v <= 0 ? 0 : i] || "";
}

// 関係性タブの中身（人間関係）
function relationsHtml() {
  const rows = Object.entries(state.affinity)
    .map(([id, lv]) => {
      if (!ALWAYS_KNOWN.has(id) && !isMet(id) && lv <= 0) return "";
      const name = displayName(id);
      const face = faceIconHtml(id, "rel-face");
      const avatar = face || `<span class="rel-face rel-face-txt">${(name[0] || "?")}</span>`;
      if ((state.lovers || []).includes(id)) {
        const bond = state.loveLevel[id] || 0;
        return `<div class="status-row rel-row"><span class="rel-name">${avatar}${name} <span class="lover-badge">恋人</span></span>` +
          `<span class="hearts bond">${"♥".repeat(bond)}${"♡".repeat(AFFINITY_CAP - bond)}</span></div>`;
      }
      const pts = (state.affinityPts || {})[id] || 0;
      const lo = AFFINITY_RANK_PTS[lv] ?? 0;
      const hi = AFFINITY_RANK_PTS[lv + 1];
      const pct = hi === undefined ? 100 : Math.min(100, Math.round(((pts - lo) / (hi - lo)) * 100));
      const gauge = lv >= AFFINITY_CAP ? "" : `<i class="aff-next"><i style="width:${pct}%"></i></i>`;
      return `<div class="status-row rel-row"><span class="rel-name">${avatar}${name}</span><span class="hearts">${"♥".repeat(lv)}${"♡".repeat(AFFINITY_CAP - lv)}${gauge}</span></div>`;
    })
    .filter(Boolean)
    .join("");
  return rows || `<p class="status-empty">まだ誰とも親しくなっていない。</p>`;
}

// 持ち物タブ（所持機材＋家シーシャ一式）
const CUSTOMER_ENTRIES = {
  baito_beginner_01: { name: "初シーシャの女の子", memo: "おすすめを聞いてきた。好みの飲み物からフレーバーを推理する楽しさを教えてくれた" },
  baito_couple_time: { name: "初心者カップル", memo: "二人で一緒に吸うのかと聞いてきた。シェアの楽しみ方を提案できた" },
  baito_trouble_01: { name: "不満顔のサラリーマン", memo: "「全然煙出ない」と苦情。炭の管理の大切さを痛感した" },
  baito_rush_01: { name: "ピーク時の3卓", memo: "同時コールの嵐。手を止めずに回す修行だった" },
  baito_mob_flavor_police: { name: "認可チェックのおじさん", memo: "フレーバーの認可を気にする慎重派。知識が試された" },
  baito_mob_insta: { name: "映え狙いの女性客", memo: "一口も吸わず写真だけ撮り続けていた。炭の管理が地味に大変だった" },
  baito_regular_01: { name: "おっちゃん（常連）", memo: "メニューも見ずに座る。「いつもの」で通じる、tonariの顔" },
  baito_drunk_01: { name: "酔っぱらいのおじさん", memo: "「俺にも作らせろ」と絡んできた。接客の胆力が鍛えられた" },
  baito_body_bad_01: { name: "「体に悪い？」のカップル", memo: "彼氏が不安そうだった。正しい知識で安心してもらうことも仕事" },
  baito_closing_smoke: { name: "閉店後の一服", memo: "スミさんと二人、閉店後のtonari。フレーバーの残り香が一日の終わりを告げる" },
  baito_smoke_ring: { name: "リング職人のおっちゃん", memo: "煙で綺麗な輪っかを作る常連。いつか追いつきたい技" },
  baito_foreign_tourist: { name: "外国人観光客", memo: "言葉は通じなくても、煙の美味しさは世界共通だった" },
  baito_regulars_chat: { name: "常連の夜（3人）", memo: "おっちゃんたちが顔を合わせた珍しい夜。tonariの空気が温かかった" },
  baito_rainy_day: { name: "雨の日のtonari", memo: "雨音とゴボゴボの音。静かな店内で、シーシャの香りがいつもより濃く感じた" },
  baito_closing_late: { name: "閉店間際のスーツ", memo: "「1杯だけ」と滑り込んできた。疲れた顔が、帰る頃には少し柔らかくなっていた" },
  baito_mysterious_customer: { name: "謎の女性客", memo: "落ち着いた雰囲気の女性。どこかで会ったことがあるような……" },
  baito_jiro_call: { name: "ガタイのいい常連", memo: "「煙多め、濃いめ、熱め」。注文がシンプルで潔い" },
  baito_mob_01: { name: "初シーシャの大学生4人組", memo: "元気がいい。全員違うフレーバーにすると回し吸いで盛り上がる" },
  baito_mob_02: { name: "誕生日パーティーの6人組", memo: "煙の演出でサプライズ。シーシャにはこういう使い方もある" },
  baito_mob_03: { name: "おっちゃんの友達連れ", memo: "紹介した側の顔を立てるのも、いい接客のひとつ" },
  baito_atmosphere_01: { name: "金曜の満席", memo: "スミさんの背中を追いかけた夜。自己最多記録の台数を作った" },
  baito_atmosphere_02: { name: "午後の静けさ", memo: "光がボトルのガラスを通って虹を落としていた。tonariの匂いを意識した日" },
  baito_atmosphere_03: { name: "閉店後のスミさん", memo: "「まだ下手だ」──一拍置いて──「3ヶ月前よりはマシだけどな」" },
  baito_trouble_02: { name: "注文違いの女性客", memo: "ブルーベリーとグレープを間違えた。ミスの後のリカバリーが大事" },
  baito_trouble_03: { name: "ボトル転倒の客", memo: "赤い炭が床を転がった。安全第一。炭→水→復旧の優先順位を学んだ" },
  baito_trouble_04: { name: "焦げ臭い苦情の客", memo: "ヒートマネジメントの失敗。炭の位置ひとつで味が変わる" },
  baito_regular_02: { name: "サラリーマン田中さん", memo: "毎週来る。ネクタイを緩める仕草が来店の合図" },
  baito_regular_03: { name: "フリーランスのお兄さん", memo: "いつもはMacで仕事。たまに本を読んでいる日がある" },
  baito_regular_04: { name: "常連3人の同時来店", memo: "おっちゃん、田中さん、フリーランスのお兄さん。同時は珍しい" },
  baito_rush_02: { name: "土曜夜の行列", memo: "入口に2組。待ち時間の案内も大事な仕事" },
  baito_rush_03: { name: "3卓同時リクエスト", memo: "フレーバー変更、灰掃除、追加注文が同時に来た" },
  baito_rush_04: { name: "退勤ラッシュの4組", memo: "10分で4組。ボウルの在庫が足りなくなりかけた" },
};

function customerNotesHtml() {
  const notes = state.customerNotes || {};
  const total = Object.keys(CUSTOMER_ENTRIES).length;
  const found = Object.keys(notes).filter((id) => CUSTOMER_ENTRIES[id]).length;
  let html = `<div class="status-block"><h3>常連ノート</h3>` +
    `<p class="note-progress">${found} / ${total} 人</p>`;
  const entries = Object.entries(CUSTOMER_ENTRIES);
  for (const [id, entry] of entries) {
    if (notes[id]) {
      const count = notes[id].count || 1;
      html += `<div class="note-entry found"><span class="note-name">${entry.name}</span>` +
        `<span class="note-count">×${count}</span>` +
        `<p class="note-memo">${entry.memo}</p></div>`;
    } else {
      html += `<div class="note-entry locked"><span class="note-name">？？？</span></div>`;
    }
  }
  html += `</div>`;
  return html;
}

function inventoryHtml() {
  const owned = (state.owned || []).map((id) => {
    const e = (D.equipment || []).find((x) => x.id === id);
    return e ? `<div class="status-row"><span>${e.name}</span><span class="inv-type">${EQUIP_TYPE_LABELS[e.type] || ""}</span></div>` : "";
  }).filter(Boolean).join("");
  const money = `<div class="status-row"><span>所持金</span><span class="inv-money">¥${state.money.toLocaleString()}</span></div>`;
  return `<div class="status-block"><h3>所持金</h3>${money}</div>` +
    `<div class="status-block"><h3>機材</h3>${owned || '<p class="status-empty">手持ちの機材はない。</p>'}</div>`;
}

// 五角形レーダーチャート（master_spec #19-a）。SVGで現在値と章開始時を重ね描き。
// 数値は出さない（CLAUDE.mdルール）。形・★・ランク呼称で成長を見せる
const RADAR_AXES = ["technique", "sense", "guts", "charm", "insight"];
function radarPoint(cx, cy, R, i, v) {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const r = R * Math.max(0.04, Math.min(1, v / 100));
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}
function buildRadarSVG() {
  const cx = 130, cy = 122, R = 92;
  const base = state.statsBaseline || state.stats;
  let grid = "";
  for (let g = 1; g <= 4; g++) {
    const pts = RADAR_AXES.map((_, i) => radarPoint(cx, cy, R * (g / 4), i, 100).join(",")).join(" ");
    grid += `<polygon points="${pts}" class="radar-grid"/>`;
  }
  let axes = "";
  RADAR_AXES.forEach((_, i) => {
    const [x, y] = radarPoint(cx, cy, R, i, 100);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar-axis"/>`;
  });
  const curPts = RADAR_AXES.map((en, i) => radarPoint(cx, cy, R, i, state.stats[en]).join(",")).join(" ");
  const basePts = RADAR_AXES.map((en, i) => radarPoint(cx, cy, R, i, base[en]).join(",")).join(" ");
  const grew = RADAR_AXES.some((en) => (state.stats[en] || 0) > (base[en] || 0));
  let badges = "";
  RADAR_AXES.forEach((en, i) => {
    const [x, y] = radarPoint(cx, cy, R + 18, i, 100);
    const up = (state.stats[en] || 0) > (base[en] || 0) ? '<tspan class="radar-up"> \u2191</tspan>' : "";
    const anchor = Math.abs(x - cx) < 6 ? "middle" : x < cx ? "end" : "start";
    badges += `<text x="${x}" y="${y - 2}" text-anchor="${anchor}" class="radar-label">${STAT_KEYS[en]}${up}</text>` +
      `<text x="${x}" y="${y + 11}" text-anchor="${anchor}" class="radar-rank">${statRankLabel(en)}</text>`;
  });
  return `<svg class="radar-svg" viewBox="0 0 260 244" role="img" aria-label="ステータス レーダー">` +
    grid + axes +
    (grew ? `<polygon points="${basePts}" class="radar-base"/>` : "") +
    `<polygon points="${curPts}" class="radar-cur"/>` +
    badges +
    `</svg>`;
}

// メインのステータスタブ（数値は出さず★とランク呼称・体力・大会の歩み）
function mainStatusHtml() {
  const radar = `<div class="radar-wrap">${buildRadarSVG()}<p class="radar-legend">明るい面＝今／暗い面＝章のはじめ。広がったぶんが成長。</p></div>`;
  const statRows = Object.entries(STAT_KEYS)
    .map(([en, ja]) => `<div class="status-row stat-row"><span class="stat-name">${ja}</span>` +
      `<span class="stars">${stars(state.stats[en])}</span>` +
      `<span class="stat-rank">${statRankLabel(en)}</span></div>`)
    .join("");
  const st = stamina();
  const stLabel = st >= 70 ? "好調" : st >= STAMINA_LOW ? "疲れ気味" : "限界が近い";
  const stCls = st >= 70 ? "" : st >= STAMINA_LOW ? "warn" : "danger";
  const cond = `<div class="status-row"><span>体力</span><span class="stamina-cell"><i class="st-bar"><i class="${stCls}" style="width:${st}%"></i></i> ${stLabel}</span></div>`;
  // 大会の歩み（既存データから導出。新パラメータは作らない）
  const chapName = { 1: "SMOKE CROWN CUP（地方）", 2: "HAZE: OPEN CLOUD（地区）" }[state.chapter] || `第${state.chapter}章`;
  const progress = state.phase === "cleared" ? "優勝・クリア" : state.phase === "tournament" ? "大会本番" : `DAY ${state.day} / 準備中`;
  const tour = `<div class="status-row"><span>挑戦中の大会</span><span>${chapName}</span></div>` +
    `<div class="status-row"><span>状況</span><span>${progress}</span></div>`;
  return `<div class="status-block"><h3>ステータス</h3>${radar}${statRows}</div>` +
    `<div class="status-block"><h3>コンディション</h3>${cond}${tour}</div>`;
}

// el に描画。opts.tabbed=true でタブUI（日常メニュー）、false で従来の積み上げ（クリア画面）
function renderStatusInto(el, opts = {}) {
  el.innerHTML = "";
  if (!opts.tabbed) {
    // クリア画面など: ステータス＋人間関係を素朴に積む
    const wrap = document.createElement("div");
    wrap.innerHTML = mainStatusHtml() + `<div class="status-block"><h3>人間関係</h3>${relationsHtml()}</div>`;
    el.append(...wrap.childNodes);
    return;
  }
  const tabs = [
    { id: "main", label: "ステータス", html: mainStatusHtml },
    { id: "rel", label: "人間関係", html: () => `<div class="status-block"><h3>人間関係</h3>${relationsHtml()}</div>` },
    { id: "inv", label: "持ち物", html: inventoryHtml },
    { id: "note", label: "常連ノート", html: customerNotesHtml },
  ];
  const bar = document.createElement("div");
  bar.className = "status-tabs";
  const body = document.createElement("div");
  body.className = "status-tabbody";
  const show = (id) => {
    const t = tabs.find((x) => x.id === id) || tabs[0];
    body.innerHTML = t.html();
    for (const b of bar.children) b.classList.toggle("on", b.dataset.tab === id);
  };
  for (const t of tabs) {
    const b = document.createElement("button");
    b.className = "status-tab";
    b.dataset.tab = t.id;
    b.textContent = t.label;
    b.addEventListener("click", () => { if (window.SFX) SFX.select(); show(t.id); });
    bar.appendChild(b);
  }
  el.append(bar, body);
  show("main");
}

function toggleStatus(show) {
  const ov = $("#status-overlay");
  if (show) { renderStatusInto($("#status-body"), { tabbed: true }); ov.classList.add("visible"); }
  else ov.classList.remove("visible");
}

// ---------------------------------------------------------------- title
// 一人称視点なので主人公は出さず、ヒロイン・ライバル・店の面々から日替わりで選ぶ。
// アート一枚絵を煙マスクの窓（#title-chara-window）にコンシューマー風に表示する
const TITLE_CHARA_POOL = ["tsumugi", "sumi", "packii", "naru", "adam", "minto"];

function setupTitleLogo() {
  const img = $("#title-logo-img");
  img.src = assetUrl("assets/ui/ui_title_logo.png");
  // ロゴ画像が無い環境ではテキスト版にフォールバック
  img.onerror = () => {
    img.classList.add("hidden");
    $(".title-logo").classList.remove("hidden");
    $(".title-en").classList.remove("hidden");
  };
}

// タイトルの専用キービジュアル: build_data.py が assets/ui/title_arts/ を
// 走査して D.title_arts に詰める。1枚以上あればランダムで1枚表示し、
// 無ければキャラランダム表示にフォールバック。
function setupTitleKeyVisual(onMiss) {
  const frame = $("#title-art-frame");
  const img = $("#title-art");
  const arts = (D && D.title_arts) || [];
  if (!arts.length) { frame.style.display = "none"; if (onMiss) onMiss(); return; }
  const name = arts[Math.floor(Math.random() * arts.length)];
  img.onerror = () => { frame.style.display = "none"; if (onMiss) onMiss(); };
  img.onload = () => {
    frame.classList.add("show");
    $("#title-chara-window").style.display = "none";
  };
  img.src = assetUrl(`assets/ui/title_arts/${name}`);
}

function setupTitleChara() {
  const img = $("#title-chara");
  const win = $("#title-chara-window");
  const pool = TITLE_CHARA_POOL.filter((id) => (D.portraits || {})[id]);
  if (!pool.length) { win.style.display = "none"; return; }
  const id = pool[Math.floor(Math.random() * pool.length)];
  const faces = D.portraits[id] || [];
  const face = faces.includes("normal") ? "normal" : faces[0];
  const t = ((D.portrait_trims || {})[id] || {})[face] || {};
  img.onerror = () => { win.style.display = "none"; };
  img.onload = () => {
    // 実コンテンツ(bbox)が窓を覆うように配置（cover相当）。
    // 顔が来るbbox上部1/3あたりを窓のやや上に合わせる
    const ww = win.clientWidth, wh = win.clientHeight;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!ww || !iw) return;
    const bw = iw * (t.w || 1);
    const bh = ih * (t.h || 1);
    const bx = iw * (t.l || 0);
    const by = ih * (1 - (t.b || 0)) - bh;
    // cover を基本に、細身の切り抜き（全身立ち絵）が極端にズームされないよう
    // 「高さフィットの1.35倍」を上限にする。横が余れば星雲が透けて見える
    const cover = Math.max(ww / bw, wh / bh);
    const scale = Math.min(cover, (wh / bh) * 1.35) * 1.08; // Ken Burns の余白ぶん
    img.style.width = `${iw * scale}px`;
    img.style.height = "auto";
    const focusX = (bx + bw * 0.5) * scale;
    const focusY = (by + bh * 0.32) * scale;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lo = (full, view) => Math.min(0, view - full);
    const hi = (full, view) => Math.max(0, view - full);
    img.style.left = `${clamp(ww * 0.5 - focusX, lo(iw * scale, ww), hi(iw * scale, ww))}px`;
    img.style.top = `${clamp(wh * 0.42 - focusY, lo(ih * scale, wh), hi(ih * scale, wh))}px`;
  };
  img.src = assetUrl(`assets/sprites/characters/${id}/chr_${id}_${face}.png`);
}

function startTitleBgm() {
  if (window.SFX && $("#screen-title").classList.contains("active")) SFX.bgm("title");
}

// ---------------------------------------------------------------- tutorial
// 大会に出ろと言われた直後、tonariの作業台で一度シーシャ作りを通しで体験する
const TUTORIAL_FLOW = [
  ["theme", "THEME"], ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"],
  ["coal", "SET"], ["coalfire", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
// バイト中のオーダーチャレンジ: お客さんのリクエスト（日替わり）に合わせて
// 大会同様のフル工程で1台作る（テーマと集中だけ接客中なので省略）
const BAITO_FLOW = [
  ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"], ["coal", "SET"],
  ["coalfire", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
const TUTORIAL_TIPS = {
  theme: "スミさん「まずは一台のコンセプトだ。今日は好きに選んでいい」",
  mix: "スミさん「基本は12g。ボウルの容量までは盛れるが、多く詰む分は熱も葉代も食うぞ」",
  pack: "スミさん「迷ったらノーマル。フレーバーの重さで変えるんだ」",
  foil: "スミさん「穴は均等に。リズムで開けると揃う」",
  coalfire: "スミさん「炭の芯が一瞬ピカッと閃く。その瞬間に取り上げろ。早すぎりゃ生焼け、遅けりゃ灰だ」",
  coal: "スミさん「基本はトライアングル。熱が均等に回る」",
  steam: "スミさん「蒸らしは0/3/5/8/10分から選ぶ。基本は5〜8分、0分は神崎の型だ」",
  pull: "スミさん「提供前の吸い出しで温度を作る。左で止めれば上げ、右なら下げだ。最低2回」",
};
const DRILL_TIPS = {
  foil: "💡 アルミホイルに穴を開ける工程。穴の数と配置で熱の通り方が決まる。均等に開けるほど味がブレにくい",
  coalfire: "💡 専用の炭を火で炙って使う。外は赤いのに中が黒い「生焼け」だと嫌な味が出る。芯まで火を通すのが大事",
  steam: "💡 炭を置いた後、すぐに吸わず数分待つ。葉に熱を行き渡らせる「蒸らし」で、味の立ち上がりが変わる",
  pull: "💡 お客さんに出す前に自分で何度か吸って温度を整える。吸い方の強弱で温度を上げ下げできる",
  focus: "💡 大会中は観客の声援や野次が飛ぶ。集中を切らさず自分のペースを守る精神力の訓練",
  serve: "💡 完成したシーシャをお客さんに出す瞬間。温度・煙量・香りがベストなタイミングを見極める",
};

function startTutorial() {
  if (state.flags._tutorial_done) return showMap();
  playCustom({
    dialogue_id: "tutorial_intro",
    metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" },
    lines: [
      { speaker: "sumi", face: "normal", text: "おい、始。大会に出るって決めたなら、まず一回、通しで作ってみろ。" },
      { speaker: "sumi", face: "smile", text: "ウチの作業台を貸してやる。テーマ決めから引きまで、本番と同じ流れだ。" },
      { speaker: "hajime", face: "smile", text: "はい。（……ふふ、ちょっと腕の見せどころかも）" },
    ],
  }, () => beginMaking("tutorial"));
}

// 練習ドリルの結果。出来でステータス＋自己ベスト更新（本番ボーナス）
function finishDrill() {
  stopRigEffects();
  const kind = tt.drill;
  let tier;
  if (kind === "foil") tier = tt.foilHits >= 6 ? 2 : tt.foilHits >= 4 ? 1 : 0;
  else if (kind === "coalfire") tier = { perfect: 2, good: 1, miss: 0 }[tt.coalFire] || 0;
  else if (kind === "steam") tier = tt.steamHits === 0 ? 2 : tt.steamHits <= 2 ? 1 : 0;
  else if (kind === "pull") tier = { perfect: 2, good: 1, miss: 0 }[tt.pull] || 0;
  else tier = tt.focusCleared >= 5 ? 2 : tt.focusCleared >= 3 ? 1 : 0;
  const drill = PRACTICE_DRILLS.find((d) => d.id === kind) || { label: "練習", stats: ["technique", "sense"] };
  const gains = [[1, 0], [3, 2], [4, 3]][tier];
  const msgs = [
    "──まだ体が覚えていない。でも、失敗の感触も練習のうちだ。",
    "──悪くない手応え。本番でもこの感覚を思い出せれば。",
    "──完璧だ。目を閉じてもできそうなくらい、手に馴染んだ。",
  ];
  const body = tnPanel("練習結果", drill.label);
  const text = document.createElement("p");
  text.className = "practice-result";
  text.textContent = msgs[tier];
  body.appendChild(text);
  gainStat(drill.stats[0], gains[0]);
  if (gains[1] > 0) gainStat(drill.stats[1], gains[1]);
  const prev = state.practiceBest[kind] || 0;
  if (tier > prev) {
    state.practiceBest[kind] = tier;
    const best = document.createElement("p");
    best.className = "tn-hint";
    best.textContent = `自己ベスト更新！（${"★".repeat(tier)}）この手応えは本番のスコアに乗る。`;
    body.appendChild(best);
    if (window.SFX) SFX.fanfare();
  }
  const done = document.createElement("button");
  done.className = "primary-btn";
  done.textContent = "練習を終える";
  done.addEventListener("click", endAction);
  body.appendChild(done);
  save();
}

// 前日リハーサルの結果。出来に応じてスミさんの講評＋本番の小ボーナス
let afterRehearsal = null;
function finishRehearsal() {
  stopRigEffects();
  const craft = craftScore();
  const tier = craft.score >= 92 ? "great" : craft.score >= 72 ? "good" : "rough";
  state.flags._rehearsal_tier = tier;
  const comment = {
    great: { face: "surprise", text: "……完璧だ。今夜のこれが本番で出せたら、誰にも文句は言わせない。あとは寝るだけだな" },
    good: { face: "smile", text: "上出来だ。流れは体に入ってる。本番は緊張するだろうが、今夜の手順だけ思い出せ" },
    rough: { face: "normal", text: "……硬いな。手順を追うのに精一杯で、煙を見てない。でもいい。今夜失敗した分、本番は落ち着ける" },
  }[tier];
  const cont = afterRehearsal || showMap;
  afterRehearsal = null;
  playCustom({
    dialogue_id: "ch1_day6_rehearsal_result",
    metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" },
    lines: [
      { speaker: "", face: "", text: "──通し、終了。スミさんに一服出す。長い沈黙。" },
      { speaker: "sumi", face: comment.face, text: comment.text },
      { speaker: "sumi", face: "normal", text: "リハーサルの出来は、本番の落ち着きになる。──おやすみ。明日はよく食って、よく寝ろ" },
      { speaker: "", face: "", text: "……【根性】が上がった。" },
    ],
  }, cont);
}

// バイトのオーダーチャレンジの結果。出来に応じて売上ボーナス（店から）とステータス
function finishBaitoOrder() {
  stopRigEffects();
  const craft = craftScore();
  const tier = craft.score >= 92 ? "great" : craft.score >= 72 ? "good" : "rough";
  // リクエスト（指名・苦手抜き）に応えた日は店からのボーナスが増える
  const reqBonus = baitoRequest() ? 500 : 0;
  const tip = { great: 5000, good: 2500, rough: 500 }[tier] + reqBonus;
  const reaction = {
    great: "「……うわ、何これ。雲みたい」お客さんは目を丸くして、ゆっくり煙を吐いた。常連になってくれそうな顔だ。",
    good: "「うん、おいしい」お客さんは満足げに煙をくゆらせている。",
    rough: "「……まあ、こんな感じよね」お客さんの表情は読めない。次はもっとうまく作りたい。",
  }[tier];
  playCustom({
    dialogue_id: "baito_order_result",
    metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" },
    lines: [
      { speaker: "", face: "", text: "──完成。トレイに乗せて、お客さんの席へ運ぶ。" },
      { speaker: "", face: "", text: reaction },
      // ch2: 慢心と転落の可視化——出来は良くても、客の顔が頭に残らなくなっていく
      ...(state.chapter === 2
        ? [{ speaker: "hajime", face: "normal", text: "（……あれ。いま帰ったお客さんの顔、もう思い出せない。出来は悪くなかった、はずなのに）" }]
        : []),
      { speaker: "", face: "", text: tier === "great" ? "閉店後、スミさんが黙って親指を立てて、その日の給料に売上ボーナスを乗せてくれた。" : tier === "good" ? "スミさんが「上出来だ」と、給料に少し色をつけてくれた。" : "スミさんは何も言わなかったが、まかないがいつもより少しだけ豪華だった。" },
      { type: "apply", stats: { technique: 2 }, money: tip },
    ],
  }, endAction);
}

function finishTutorial() {
  state.flags._tutorial_done = true;
  stopRigEffects();
  const craft = craftScore();
  const grade = craft.score >= 90 ? "great" : craft.score >= 70 ? "good" : "rough";
  const comment = {
    great: { face: "surprise", text: "……驚いたな。バイト3ヶ月でこの煙か。お前、本当に筋がいいぞ。" },
    good: { face: "smile", text: "悪くない。3ヶ月ならむしろ上出来だ。あとは数をこなすだけだな。" },
    rough: { face: "normal", text: "まあ、こんなもんだ。どこで味が決まるか、体で覚えただろう。" },
  }[grade];
  playCustom({
    dialogue_id: "tutorial_result",
    metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" },
    lines: [
      { speaker: "", face: "", text: "──煙を一口、スミさんに渡す。ゆっくりと吐き出して、しばらく目を閉じた。" },
      { speaker: "sumi", face: comment.face, text: comment.text },
      { speaker: "sumi", face: "normal", text: "それと、ひとつだけ覚えとけ。──技は盗め。ただし、誰から盗んだかは忘れるな" },
      { speaker: "sumi", face: "serious", text: `本番までの${MAX_DAYS}日間、店も練習台も好きに使え。……優勝してこい。` },
      { speaker: "", face: "", text: "……【技術】と【センス】が上がった。" },
    ],
  }, () => {
    // チュートリアル直後: 私服のみんと（お姉さん）が客として来る。正体は明かさない
    playDialogue("ch1_tutorial_oneesan", () => {
      save();
      showDayCard("DAY 1", `SMOKE CROWN CUP まで あと${MAX_DAYS}日`);
      showMap();
    }, "res://assets/backgrounds/bg_tonari_inside.png");
  });
}

// ---------------------------------------------------------------- boot
// 章タイトルのカットイン（黒地＋金罫＋大ローマ数字の透かし）。章開始時に挟む
function showChapterTitle(opts, onDone) {
  const el = document.createElement("div");
  el.id = "chapter-title";
  el.innerHTML =
    (opts.num ? `<div class="ct-watermark">${opts.num}</div>` : "") +
    `<div class="ct-inner">` +
    `<p class="ct-no"><span class="ct-rule"></span><span class="ct-no-text">${opts.no}</span><span class="ct-rule"></span></p>` +
    `<h2 class="ct-name">${[...String(opts.name)].map((c, i) => `<span class="ct-ch" style="transition-delay:${0.65 + i * 0.14}s">${c}</span>`).join("")}</h2>` +
    (opts.read ? `<p class="ct-read">${opts.read}</p>` : "") +
    (opts.sub ? `<p class="ct-sub">${opts.sub}</p>` : "") +
    `</div>` +
    `<div class="ct-frame"></div>`;
  $("#game").appendChild(el);
  if (window.SFX) SFX.smoke();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
  setTimeout(() => el.classList.add("out"), 3800);
  setTimeout(() => { el.remove(); if (onDone) onDone(); }, 4800);
}

function startNewGame() {
  state = newState();
  updateHud();
  // コールドオープン: ch4ドバイ決勝の一瞬（顔も会場も見せない・暗転＋煙）
  // → 白煙 → 章タイトル →「1年前」のtonariへ。本番背景ができたら差し替える
  $("#vn-bg").style.backgroundImage = "none";
  playDialogue("ch1_cold_open", () => {
    engulfInSmoke(() => {
      showChapterTitle(
        { no: "第一章", num: "Ⅰ", name: "一吸目", read: "ファーストドロー ── FIRST DRAW", sub: "SMOKE CROWN CUP 編" },
        () => {
          if (window.SFX) SFX.bgm("tonari");
          playDialogue("ch1_opening", () => {
            state.phase = "daily";
            save();
            startTutorial();
          }, "res://assets/backgrounds/bg_tonari_inside.png");
        }
      );
    });
  });
}

function continueGame(saved) {
  state = saved;
  // 旧セーブの互換: ショップ導入前のセーブには owned が無い
  if (!Array.isArray(state.owned)) state.owned = STARTER_EQUIPMENT.slice();
  // 旧セーブの互換: LIME導入前のセーブ
  if (!Array.isArray(state.limeDone)) state.limeDone = [];
  if (state.pendingLimeNight === undefined) state.pendingLimeNight = null;
  if (!state.practiceBest) state.practiceBest = {};
  if (!state.customerNotes) state.customerNotes = {};
  // 日常スロット導入前のセーブ互換（アプリ説明は出さない）
  if (!state.reel && typeof REEL !== "undefined") state.reel = Object.assign(REEL.newReelState(), { introDone: true });
  // 凛（問屋街の代理店）導入前のセーブ互換
  if (!("rin" in state.affinity)) { state.affinity.rin = 0; state.visits.rin = 0; }
  // 第2章・恋愛システム導入前のセーブ互換
  if (!state.chapter) state.chapter = 1;
  if (!("ageha" in state.affinity)) { state.affinity.ageha = 0; state.visits.ageha = 0; }
  // 第2章ライバル店（神崎竜二/REI/ヴォルク）導入前のセーブ互換。
  // ※ affinity には入れない＝噂LIME（outsiderRumor）のゲート無し配信を保つため。
  //    rivalは恋愛対象外なので、訪問報酬は gainStat フォールバックで付く
  for (const _id of ["kumicho", "rei", "volk"]) {
    if (!(_id in state.visits)) state.visits[_id] = 0;
  }
  if (!Array.isArray(state.lovers)) state.lovers = [];
  if (!state.loveLevel) state.loveLevel = {};
  if (typeof state.guilt !== "number") state.guilt = 0;
  // 体力・好感度二層化・名前開示・恋人デート導入前のセーブ互換
  if (typeof state.stamina !== "number") state.stamina = 100;
  if (!state.statsBaseline) state.statsBaseline = { ...state.stats };
  if (!state.dayVisited) state.dayVisited = {};
  if (!state.lastDate) state.lastDate = {};
  if (!state.lovePts) state.lovePts = {};
  if (typeof state.loverQuickDay !== "number") state.loverQuickDay = 0;
  if (!Array.isArray(state.loverEventsSeen)) state.loverEventsSeen = [];
  if (!state.kuji) state.kuji = {};
  if (!Array.isArray(state.goods)) state.goods = [];
  if (!Array.isArray(state.limeContacts)) {
    // 既存セーブ: 訪問しきい値を超えているキャラを交換済みとして引き継ぐ
    state.limeContacts = [];
    for (const [id, v] of Object.entries(state.visits || {})) {
      if (v >= (LIME_EXCHANGE_VISITS[id] || 1)) state.limeContacts.push(id);
    }
  }
  if (!state.affinityPts) {
    // 既存の段階値を相当ポイントへ変換して引き継ぐ（master_spec #23）
    state.affinityPts = {};
    for (const [id, rank] of Object.entries(state.affinity)) {
      state.affinityPts[id] = AFFINITY_RANK_PTS[Math.max(0, Math.min(5, rank))] || 0;
      if (rank > 0) markMet(id); // 好感度があるなら面識済み
    }
    for (const [id, v] of Object.entries(state.visits || {})) if (v > 0) markMet(id);
  }
  updateHud();
  if (state.phase === "tournament") {
    if (state.chapter === 2) startCh2Stage(state.ch2Stage || "qual");
    else startTournament();
  } else if (state.phase === "cleared") {
    if (state.chapter === 2) showCh2Clear();
    else showClear();
  } else {
    showMap();
  }
}

function init() {
  fitStage();
  window.addEventListener("resize", fitStage);
  loadConfig();
  initEngine();
  setupTitleLogo();
  // キービジュアルがあればそれを最優先、無ければキャラランダム表示
  setupTitleKeyVisual(() => setupTitleChara());
  // タイトルBGM: 自動再生がブロックされたら最初の操作で再試行する
  startTitleBgm();
  window.addEventListener("pointerdown", startTitleBgm, { once: true });
  window.addEventListener("keydown", startTitleBgm, { once: true });
  // NEW GAME はまず注意書き（フィクション／演出の断り）を挟んでから本編へ。
  // 承知ボタンは設けず、Enter / Space / クリックで本編へ進める。
  let disclaimerProceeding = false;
  $("#btn-new").addEventListener("click", () => {
    if (window.SFX) SFX.select();
    disclaimerProceeding = false;
    $("#disclaimer-overlay").classList.add("visible");
  });
  function proceedFromDisclaimer() {
    if (disclaimerProceeding) return;
    if (!$("#disclaimer-overlay").classList.contains("visible")) return;
    disclaimerProceeding = true;
    if (window.SFX) SFX.select();
    $("#disclaimer-overlay").classList.remove("visible");
    engulfInSmoke(() => {
      localStorage.removeItem(SAVE_KEY);
      if (window.SFX) SFX.bgmStop(); // コールドオープンは無音で（tonariのBGMは日常から）
      startNewGame();
    });
  }
  $("#disclaimer-overlay").addEventListener("click", proceedFromDisclaimer);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && $("#disclaimer-overlay").classList.contains("visible")) {
      e.preventDefault();
      proceedFromDisclaimer();
    }
  });
  $("#btn-mute").addEventListener("click", () => {
    const m = !SFX.isMuted();
    SFX.setMuted(m);
    const b = $("#btn-mute");
    b.textContent = m ? "BGM OFF" : "BGM ON";
    b.classList.toggle("off", m);
  });
  // LOADはスロット選択画面を開く（オートセーブ＋手動スロット3つ）
  const contBtn = $("#btn-continue");
  const anySave = SAVE_SLOTS.some((s) => { const d = readSlot(s.key); return d && d.phase !== "opening"; });
  if (anySave) {
    contBtn.classList.remove("hidden");
    contBtn.addEventListener("click", () => {
      if (window.SFX) SFX.select();
      showSaveLoad("load");
    });
  }
  $("#btn-gallery").addEventListener("click", () => showGallery());
  $("#btn-config").addEventListener("click", () => showConfig());
  $("#config-close").addEventListener("click", () => { if (window.SFX) SFX.close(); $("#config-overlay").classList.remove("visible"); });
  $("#gallery-close").addEventListener("click", () => { if (window.SFX) SFX.close(); $("#gallery-overlay").classList.remove("visible"); });
  $("#gallery-viewer").addEventListener("click", () => $("#gallery-viewer").classList.remove("visible"));
  $("#saveload-close").addEventListener("click", () => { if (window.SFX) SFX.close(); $("#saveload-overlay").classList.remove("visible"); });
  $("#menu-save").addEventListener("click", () => showSaveLoad("save"));
  $("#menu-load").addEventListener("click", () => showSaveLoad("load"));
  $("#menu-config").addEventListener("click", () => showConfig());
  $("#menu-glossary").addEventListener("click", () => { toggleStatus(false); showGlossary(); });
  $("#btn-status").addEventListener("click", () => toggleStatus(true));
  $("#status-close").addEventListener("click", () => toggleStatus(false));
  $("#shop-close").addEventListener("click", () => { if (window.SFX) SFX.close(); showMap(); });
  $("#btn-gameover-title").addEventListener("click", () => location.reload());
  // ダイアログ右下ツール
  $("#vn-auto").addEventListener("click", toggleAuto);
  $("#vn-skip").addEventListener("click", toggleSkip);
  $("#vn-log").addEventListener("click", showLog);
  $("#glossary-close").addEventListener("click", () => {
    if (window.SFX) SFX.close();
    $("#glossary-overlay").classList.remove("visible");
  });
  $("#log-close").addEventListener("click", () => {
    if (window.SFX) SFX.close();
    $("#log-overlay").classList.remove("visible");
  });
  $("#vn-menu").addEventListener("click", () => toggleStatus(true));
  // スマホ用うっすらパッド（会話画面のみ表示）
  $("#tp-next").addEventListener("click", () => {
    if (autoMode || skipMode) stopAutoSkip();
    if (window.SFX) SFX.click();
    engine.next();
  });
  $("#tp-auto").addEventListener("click", toggleAuto);
  $("#tp-skip").addEventListener("click", toggleSkip);
  // タイトルメニューのフォーカス・hover演出 + ホバーSE
  let lastHoverSfx = 0;
  for (const item of document.querySelectorAll(".title-menu-item")) {
    item.addEventListener("focus", () => {
      for (const x of document.querySelectorAll(".title-menu-item.focus")) x.classList.remove("focus");
      item.classList.add("focus");
    });
    item.addEventListener("mouseenter", () => {
      if (item.disabled) return;
      const now = performance.now();
      if (now - lastHoverSfx < 90) return; // 連続ホバーで鳴りすぎないように
      lastHoverSfx = now;
      if (window.SFX) SFX.pageTurn();
    });
  }
  showScreen("#screen-title");
}

document.addEventListener("DOMContentLoaded", init);
