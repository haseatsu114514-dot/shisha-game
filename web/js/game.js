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
const STAMINA_GAIN = { rest: 35, cafe: 12, kannon: 12, sleep: 28 };
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
    affinity: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0, ageha: 0 },
    affinityPts: {},       // 好感度の内部ポイント（隠し数値。閾値で affinity の段階が上がる）
    visits: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0, ageha: 0 },
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

function gainStat(en, amount) {
  if (!(en in state.stats) || amount <= 0) return;
  state.stats[en] = Math.max(0, Math.min(100, state.stats[en] + amount));
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
    const left = state.chapter === 2 ? stageDay - state.day : stageDay + 1 - state.day;
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
  "全国だからって、やることは変わらねえぞ",
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
  const list = $("#glossary-list");
  list.innerHTML = "";
  for (const group of D.glossary || []) {
    const h = document.createElement("h3");
    h.className = "glossary-group";
    h.textContent = group.title;
    list.appendChild(h);
    for (const t of group.terms) {
      const row = document.createElement("div");
      row.className = "glossary-row";
      row.innerHTML = `<span class="glossary-term">${t.term}</span><span class="glossary-desc">${t.desc}</span>`;
      list.appendChild(row);
    }
  }
  $("#glossary-overlay").classList.add("visible");
  if (window.SFX) SFX.open();
}

// ---------------------------------------------------------------- config
const CONFIG_KEY = "shisha_config_v1";
const config = { textSpeed: 2, autoSpeed: 2, bgmVol: 100, sfxVol: 100 };

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
const SPOTS = [
  { id: "baito", label: "tonariでバイト", desc: "接客で稼ぐ。基本給＋オーダーの出来で売上ボーナス", cost: 0 },
  { id: "practice", label: "シーシャの練習", desc: "tonariの隅で腕を磨く", cost: 0 },
  { id: "sumi", label: "スミさんと話す", desc: "師匠の昔話と教え", cost: 0, charId: "sumi" },
  { id: "tsumugi", label: "つむぎと話す", desc: "tonari常連の彼女の席へ", cost: 0, charId: "tsumugi" },
  { id: "naru", label: "なるの店へ行く", desc: "ライバル店を偵察", cost: VISIT_COST, charId: "naru" },
  { id: "adam", label: "アダムの店へ行く", desc: "ダブルアップル職人の店", cost: VISIT_COST, charId: "adam" },
  { id: "minto", label: "みんとの店へ行く", desc: "コンカフェ風シーシャ屋へ", cost: VISIT_COST, charId: "minto" },
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
};

// 報酬キューが鳴らなかった場合の保険（全イベントに必ず報酬を付ける）
const SPOT_FALLBACK_STAT = {
  kannon: "guts", cafe: "sense", c_station: "insight",
  sumi: "technique", tsumugi: "sense", naru: "insight", adam: "insight", minto: "insight",
};

const VISIT_SEQUENCES = {
  sumi: ["ch1_sumi_tutorial", "ch1_sumi_basics", "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final"],
  tsumugi: ["ch1_tsumugi_first", "ch1_tsumugi_second", "ch1_tsumugi_third", "ch1_tsumugi_fourth", "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color"],
  naru: ["ch1_naru_first", "ch1_naru_second", "ch1_naru_third", "ch1_naru_fourth", "ch1_naru_fifth"],
  adam: ["ch1_adam_first", "ch1_adam_second", "ch1_adam_third", "ch1_adam_fourth", "ch1_adam_fifth"],
  minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_fourth", "ch1_minto_fifth"],
};

// 通い切ったあとの繰り返し訪問（必ず何かしらの報酬を付ける）
const REPEAT_VISIT = {
  sumi: { text: "スミさんの手元を眺めながら、何気ない話をした。炭の切り方ひとつにも年季がにじんでいる。", stats: { technique: 2 } },
  tsumugi: { text: "つむぎの席の近くで、煙の形の話をした。彼女の見ている世界は、少しだけ自分と違う。", stats: { sense: 2 } },
  naru: { text: "なるの店で一服。スピード勝負の段取りを盗み見る。", stats: { technique: 2 } },
  adam: { text: "アダムの店で一服。ダブルアップル一筋の頑固さに、芯の強さを感じる。", stats: { guts: 2 } },
  minto: { text: "みんとの店で一服。客あしらいの軽やかさは、やっぱり真似できない。", stats: { charm: 2 } },
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

function morningPhone(onDone, opts = {}) {
  const due = limeDueMessages(!!opts.tournamentDay);
  if (!due.length) { if (onDone) onDone(); return; }
  limeQueue = due;
  limeOnDone = onDone || null;
  limeAcceptedNoon = [];
  $("#phone-time").textContent = opts.tournamentDay ? "AM 8:00" : "AM 7:30";
  $("#phone-day").textContent = opts.tournamentDay ? "大会当日" : `DAY ${state.day}`;
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
  row.innerHTML = `${avatar}<div class="lime-bubble">${formatText(String(text))}</div>`;
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
  $("#phone-overlay").classList.add("show");
  if (window.SFX) { SFX.open(); setTimeout(() => SFX.bubble(), 200); }
  setTimeout(nextLimeThread, 800);
}

// 優勝の夜のスマホ: なるの採点表どんでん →「？？？」の不穏な通知。
// 「実力で勝った」という自己認識を最初から揺らし、ch2の転落と
// ch5のチャコール博士まで効く縦糸を張る
function postClearPhone(onDone) {
  phoneShowCustom([
    {
      id: "_sys_naru_scoresheet",
      sender: "naru",
      type: "chat",
      messages: [
        "今日はマジでおめでとう。……で、なんだけど",
        "家帰ってから、開示された採点表をずっと見直してた",
        "技術点も個性点も、お前は4人の中で下位だ。俺にも負けてる",
        "お前を優勝させたのは、南雲さんの「総合印象点」ひとつだけ。あの人、お前にだけ満点つけてる",
        "おめでとうは取り消さない。今日のお前の煙が美味かったのも本当だ。……でも「実力で勝った」とはまだ言わせない",
        "あの一票が何だったのか──全国までに、お互い答えを持っていこうぜ",
      ],
      close_label: "……うん。ありがとう、なるさん",
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
  visitContextChar = sender;
  markMet(sender);
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
    dateContext = false;
    save();
    showMap();
  });
}

// 行き先ピンの短い見出し。キャラのいる場所は顔ドット絵を優先し、
// 施設は日本語の略号（顔アイコンが無い場合のフォールバックも兼ねる）
const SPOT_ICONS = {
  baito: "労", practice: "練", sumi: "師", tsumugi: "紬",
  naru: "鳴", adam: "亜", minto: "緑", choizap: "筋",
  kannon: "観", cafe: "珈", c_station: "C", shop: "店", rest: "休",
};
const SPOT_FACE = { sumi: "sumi", tsumugi: "tsumugi", naru: "naru", adam: "adam", minto: "minto" };

// マップ上のピン位置（%）と短いラベル名
const SPOT_LAYOUT = {
  baito:     { x: 14, y: 32, theme: "baito",   short: "バイト",     area: "tonari" },
  practice:  { x: 22, y: 50, theme: "shisha",  short: "練習",       area: "tonari" },
  sumi:      { x: 12, y: 64, theme: "mentor",  short: "スミさん",   area: "tonari" },
  tsumugi:   { x: 26, y: 70, theme: "shisha",  short: "常連席",     area: "tonari" },
  naru:      { x: 42, y: 22, theme: "rival",   short: "KEMURIKUSA", area: "繁華街" },
  adam:      { x: 56, y: 30, theme: "rival",   short: "EDEN",       area: "下町" },
  minto:     { x: 70, y: 22, theme: "rival",   short: "PEPERMINT",  area: "繁華街" },
  choizap:   { x: 50, y: 50, theme: "shop",    short: "チョイザップ", area: "ジム" },
  kannon:    { x: 78, y: 56, theme: "park",    short: "観音堂",     area: "古町" },
  cafe:      { x: 64, y: 64, theme: "cafe",    short: "カフェ",     area: "繁華街" },
  c_station: { x: 84, y: 36, theme: "stadium", short: "C.STATION",  area: "会場" },
  shop:      { x: 36, y: 40, theme: "shop",    short: "Dr.fookah",  area: "問屋街" },
  rest:      { x: 88, y: 76, theme: "rest",    short: "家",         area: "自宅" },
};

function showMap() {
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
}

function selectSpot(spot) {
  const proceed = () => {
    if (spot.cost > 0) addMoney(-spot.cost);
    switch (spot.id) {
      case "baito": return shishaGuard(() => doBaito());
      case "practice": return shishaGuard(() => startPractice());
      case "choizap": return doChoizap();
      case "kannon": return doSpotDialogue("kannon", "ch1_kannon_visit", "bg_street_day.png");
      case "cafe": return doSpotDialogue("cafe", "ch1_cafe_visit", "bg_street_day.png");
      case "c_station": return doSpotDialogue("c_station", "ch1_c_station_visit", "bg_shop.png");
      case "shop": return showShop();
      case "rest": return doRest();
      default: {
        // よその店での一服は体力を使う（tonari内のスミさん・つむぎとの会話は軽い）
        const heavySmoke = ["naru", "adam", "minto"].includes(spot.id);
        return heavySmoke ? shishaGuard(() => doVisit(spot.id)) : doVisit(spot.id);
      }
    }
  };
  // キャラ訪問: 好感度が上限まで来ていたら、行く前にひと言（master_spec の最大警告）
  if (spot.charId) return maybeVisitWarning(spot.charId, proceed, () => showMap());
  proceed();
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
    if (!cueFiredInDialogue) gainStat(SPOT_FALLBACK_STAT[spotId] || "insight", 2);
    endAction();
  }, `res://assets/backgrounds/${bg}`);
}

function endAction() {
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
        return playLimeEvent(p.event, p.sender, () => {
          state.ap = 0;
          save();
          endDay();
        }, true);
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
  const left = state.chapter === 2 ? stageDay - state.day : stageDay + 1 - state.day;
  const what = state.chapter === 2 ? CH2_STAGE_LABEL[chapterInfo().stageDays[stageDay]] : cupName();
  showDayCard(`DAY ${state.day}`, left === 1 ? `${what} 前日` : `${what}まで あと${left}日`);
  showMap();
  morningPhone(showMap); // 朝のLIME（無ければ何もしない）
}

function endDay() {
  // 夜の締め: 必ず家に帰って1日を終える（master_spec #3）。
  // 家シーシャ（第2章〜・一式所持時）はその帰宅シーンの中で選択肢になる
  const finishDay = () => maybeNightcap(advanceDay);
  const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
  // ---- 第2章の夜の固定イベント（嫉妬と転落の進行）
  if (state.chapter === 2) {
    if (state.day === 2 && !state.flags._ev2_abyss) {
      state.flags._ev2_abyss = true;
      return playDialogue("ch2_abyss_baito", finishDay, TONARI);
    }
    if (state.day === 4 && !state.flags._ev2_sofa) {
      state.flags._ev2_sofa = true;
      return playDialogue("ch2_sofa_burn", finishDay, TONARI);
    }
    if (state.day === 5 && !state.flags._ev2_slump) {
      state.flags._ev2_slump = true;
      // 味覚スランプ発症: 以後、ミックス画面の味の記憶がノイズ混じりになる
      return playDialogue("ch2_slump_taste", () => { state.flags._taste_slump = true; save(); finishDay(); }, TONARI);
    }
    // DAY6: 全編モチーフ「店の匂い」のch2配置（炭落とし事故の匂いが店に残る）
    if (state.day === 6 && !state.flags._ev2_smell) {
      state.flags._ev2_smell = true;
      return playDialogue("ch2_lingering_smell", finishDay);
    }
    if (state.day === 7 && !state.flags._ev2_ageha) {
      state.flags._ev2_ageha = true;
      return playDialogue("ch2_pre_tournament_realisation", finishDay, "res://assets/backgrounds/bg_tournament_stage.png");
    }
    // DAY10: スミさんの沈黙（連勝が始まった頃。ch4特訓「同じ顔をさせたくなかった」の前振り）
    if (state.day === 10 && !state.flags._ev2_sumi) {
      state.flags._ev2_sumi = true;
      return playDialogue("ch2_sumi_silence", finishDay);
    }
    if (state.day === 12 && !state.flags._ev2_minto) {
      state.flags._ev2_minto = true;
      return playDialogue("ch2_minto_warning", finishDay);
    }
    if (state.day === 13 && !state.flags._ev2_tsumugi) {
      state.flags._ev2_tsumugi = true;
      return playDialogue("ch2_tsumugi_color", finishDay, TONARI);
    }
    return finishDay();
  }
  // ---- 第1章の夜の固定イベント
  if (state.day === 2 && !state.flags._ev_salaryman) {
    state.flags._ev_salaryman = true;
    return playDialogue("ch1_salaryman_regular", finishDay, TONARI);
  }
  // DAY4: あげはカメオ（謎のギャルが荷物を拾ってくれる）。ホワイトグミベアの残り香が
  // ch2初対面（ch2_rivals_first_sight）で回収される伏線
  if (state.day === 4 && !state.flags._ev_ageha_cameo) {
    state.flags._ev_ageha_cameo = true;
    return playDialogue("ch1_ageha_encounter", finishDay, "res://assets/backgrounds/bg_street_night.png");
  }
  // DAY7夜（折り返し）: 中間チェック。スミさんが「素の一台」を講評し、残り日数に目的を作る
  if (state.day === 7 && !state.flags._ev_day3_check) {
    state.flags._ev_day3_check = true;
    return playCustom({
      dialogue_id: "ch1_day3_check",
      metadata: { bg: TONARI },
      lines: [
        { speaker: "", face: "", text: "夜、tonariに顔を出すと、スミさんが作業台を顎で指した。" },
        { speaker: "sumi", face: "normal", text: "一台作ってみろ。練習でも本番でもない、今のお前の素の一台だ" },
        { speaker: "", face: "", text: "黙って組む。詰めて、熾して、置いて、待つ。スミさんは何も言わずに見ている。\n──完成。ホースを渡す。スミさんは目を閉じて、長い一服。" },
        { type: "condition", stat: "技術", threshold: 22, next_true: "mid_good", next_false: "mid_rough" },
        { speaker: "sumi", face: "serious", text: "大会まで、ちょうど折り返しだ。どこを磨くかは、お前が決めろ。──ただし、寝ること。それも仕込みのうちだ" },
        { speaker: "hajime", face: "normal", text: "はい。（あと7日。……何を、どこまで持っていけるか）" },
        { type: "apply", stats: { insight: 2 } },
      ],
      branches: {
        mid_good: [
          { speaker: "sumi", face: "smile", text: "……腕、上げたな。初日のお前の煙じゃない" },
          { speaker: "sumi", face: "normal", text: "ここからは弱点を潰せ。引きか、熱か、詰めか。自分で分かってるだろ" },
        ],
        mid_rough: [
          { speaker: "sumi", face: "normal", text: "……悪くない。けど、本番でこれだと埋もれるな" },
          { speaker: "sumi", face: "normal", text: "焦るな。まだ7日ある。基礎の反復が一番効く時期だ" },
        ],
      },
    }, finishDay);
  }
  if (state.day === 5 && !state.flags._ev_day5) {
    state.flags._ev_day5 = true;
    return playDialogue("ch1_day5_sumi_story", finishDay, TONARI);
  }
  // DAY13夜（大会前々日）: 前日リハーサル（通し）。出来が本番の小ボーナスになる
  if (state.day === 13 && !state.flags._ev_day6_rehearsal) {
    state.flags._ev_day6_rehearsal = true;
    afterRehearsal = finishDay;
    return playCustom({
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
    return playDialogue("ch1_day7_last_night", finishDay, TONARI);
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
  addStamina(-(["naru", "adam", "minto"].includes(charId) ? STAMINA_COST.visit : STAMINA_COST.talk));
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
      if (!cueFiredInDialogue && !got) gainStat(SPOT_FALLBACK_STAT[charId] || "insight", 2);
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
  (state.goods || []).forEach((g, gi) => {
    if (!g.sell) return;
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML = `<span class="spot-name">${g.name} を売る</span><span class="spot-cost">+${g.sell.toLocaleString()}円</span>`;
    btn.addEventListener("click", () => {
      state.goods.splice(gi, 1);
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
      ? `<span class="spot-name">2階から視線を感じる……</span><span class="spot-cost">行動を1回使う</span><span class="spot-desc">階段の上に、誰かいる</span>`
      : `<span class="spot-name">2階のショールーム（${displayName("rin")}）</span>` +
        `<span class="spot-cost">${rinAway ? "今日は出張で不在" : visitedToday ? "今日はもう顔を出した" : "会いに行く（行動を1回使う）"}</span>` +
        `<span class="spot-desc">NIGHTSIDE日本代理店。買い物だけなら時間はかからない</span>`;
  rinBtn.disabled = visitedToday || rinAway;
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
  prov.textContent = "※システム・抽選演出の試作です。賞品アイテムや専用演出は今後の実装で本実装されます。";
  list.appendChild(prov);
  // 初回だけ凛のメタ発言（在庫の口すべり＋リセマラ無効の予告）
  if (!state.flags._kuji_seen) {
    const note = document.createElement("p");
    note.className = "tn-hint";
    note.textContent = `${displayName("rin")}「これ、実は在庫しょぶ……なんでもない。あ、セーブしてやり直しても出るもの同じだから。そういうふうにできてるの」`;
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
  if (prize.type === "goods" && prize.sell) {
    state.goods.push({ name: prize.name, sell: prize.sell });
  }
  // flavor / consumable は使用価値（このゲームでは抽象）。獲得演出のみ
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
function doRinVisit() {
  if (state.flags[`_rin_d${state.day}`]) return;
  const play = () => shishaGuard(() => {
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
  addStamina(STAMINA_GAIN.rest);
  playCustom({
    dialogue_id: "rest_home",
    metadata: { bg: "res://assets/backgrounds/bg_home.png" },
    lines: [
      { speaker: "", face: "", text: "今日は家でゆっくり休んだ。湯船に浸かって、早めに布団に入る。" },
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
  { id: "coalfire", label: "炭起こしの見極め", desc: "全体が熾きた一瞬を逃さず乗せる", stats: ["guts", "technique"] },
  { id: "steam", label: "蒸らしの胆力", desc: "蒸らしの間、雑念の弾幕を躱し続ける訓練", stats: ["insight", "guts"] },
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
  $("#practice-result").textContent = "自己ベスト（★）は大会本番のスコアに上乗せされる。";
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
  { id: "two", label: "炭2個", desc: "低めの熱でじっくり" },
  { id: "triangle", label: "トライアングル", desc: "基本の三角配置。安定の熱まわり" },
  { id: "four", label: "炭4個", desc: "高火力。焦げのリスクと隣り合わせ" },
];
const STEAMS = [
  { id: 2, label: "2分", desc: "せっかち。立ち上がりが不安定", dodge: 6 },
  { id: 5, label: "5分", desc: "基本の蒸らし", dodge: 9 },
  { id: 8, label: "8分", desc: "じっくり。香りが開く", dodge: 12 },
  { id: 12, label: "12分", desc: "長すぎるかもしれない", dodge: 16 },
];
// 蒸らし中の雑念弾幕（東方/Undertale風の回避ゲーム）に流れる言葉。
// 第2章はスランプ期の嫉妬ワードに差し替わる
const DODGE_WORDS = [
  "手元、見られてる……", "時間が足りないかも", "隣の煙、もう上がってる",
  "失敗したらどうしよう", "パッキーの野次", "審査員の視線", "炭、熾きてたかな",
];
const DODGE_WORDS_CH2 = [
  "ヴォルクの精度", "組長の覚悟", "あげはのバイブス", "なるの配合ノート",
  "“誰の煙だ？”", "採点表", "正解はどれだ", "味が、思い出せない",
];
const RIVALS = [
  { id: "naru", name: "なる", base: 72 },
  { id: "adam", name: "アダム", base: 67 },
  { id: "minto", name: "みんと", base: 62 },
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

// 大会は3ラウンド制: R1=組み立て（setup〜steam）→ R2=調整（adjust＋focus）→ R3=提供（吸い出し）。
// ラウンドの切れ目で ch1_tournament_r1〜r3_end の会話が挟まる。
// プレゼン工程は廃止（2026-06-12 オーナー決定）。提供の佇まいは魅力としてスコアに残る
const STEP_FLOW = [
  ["setup_bowl", "SETUP"], ["setup_hms", "SETUP"], ["setup_charcoal", "SETUP"],
  ["theme", "FLAVOR"], ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"],
  ["coalfire", "COAL"], ["coal", "HEAT"], ["steam", "STEAM"],
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
  nightside_earlgrey: "#b78d4e",
};

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

function startTournament() {
  state.phase = "tournament";
  // 会場ではMCが出場者と審査員を紹介する（名前の開示）
  for (const id of ["naru", "adam", "minto", "nagumo", "maezono"]) markMet(id);
  updateHud();
  save();
  // 会場へ歩み入る瞬間を煙ワイプで（master_spec #20）
  smokeWipe(() => playDialogue("ch1_tournament_arrival", () =>
    playDialogue("ch1_tournament_opening", () => beginMaking(), "res://assets/backgrounds/bg_tournament_stage.png")
  ));
}

// mode: "tournament"（既定）| "tutorial"（開幕の通し体験）| "baito"（オーダーチャレンジ）
//       | "rehearsal"（DAY6夜の前日リハーサル）
function beginMaking(mode) {
  mode = mode || "tournament";
  tt = {
    mode,
    bowl: null, hms: null, charcoal: null,
    theme: null, mix: {}, pack: null,
    foilHits: 0, foilDone: false, coalFire: null, coal: null, steam: null,
    steamHits: null, focusCleared: 0, pull: null, temp: null, pullCount: 0, step: "",
  };
  stopRigEffects();
  buildRig();
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
    foilHits: 0, foilDone: false, coalFire: null, coal: null, steam: null,
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
  } else if (tt && tt.mode === "baito" && tt.theme) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = `お客さん「${tt.theme.label}な感じでお任せします」`;
    $("#tn-hint").after(tip);
  }
  const body = $("#tn-body");
  body.innerHTML = "";
  updateRig();
  return body;
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
    const body = tnPanel("炭の配置", "熱の入り方が決まる。基本はトライアングル。");
    for (const c of COALS) body.appendChild(optionButton(c.label, c.desc, () => { tt.coal = c.id; tnNext("coal"); }));
    return;
  }
  if (step === "steam") {
    const body = tnPanel("蒸らし時間", "スミさんの教え:「蒸らしは基本5〜8分。焦るな」 ──蒸らしの間、雑念に捕まらないこと。");
    for (const s of STEAMS) body.appendChild(optionButton(s.label, s.desc, () => {
      tt.steam = s.id;
      if (window.SFX) SFX.smoke();
      startRigSmoke(750);
      // 蒸らしの間は「雑念の弾幕」回避。長い蒸らしほど雑念との我慢比べも長い
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
function stepAdjust() {
  const body = tnPanel("ラウンド2：炭替え・調整", "中盤戦。煙の様子を見て、一箇所だけ調整できる。どこを触る？");
  const cur = (list, id) => (list.find((x) => x.id === id) || {}).label || "-";
  body.appendChild(optionButton("このままでいく", "今の仕上がりを信じる", () => {
    if (window.SFX) SFX.select();
    tnNext("adjust");
  }));
  body.appendChild(optionButton("パッキングを直す", `現在: ${cur(PACKS, tt.pack)}`, () => redoAdjust("pack")));
  body.appendChild(optionButton("炭の配置を変える", `現在: ${cur(COALS, tt.coal)}`, () => redoAdjust("coal")));
  body.appendChild(optionButton("蒸らしを取り直す", `現在: ${tt.steam}分`, () => redoAdjust("steam")));
}

function redoAdjust(kind) {
  const defs = {
    pack: { title: "調整：パッキング", list: PACKS, set: (v) => { tt.pack = v.id; } },
    coal: { title: "調整：炭の配置", list: COALS, set: (v) => { tt.coal = v.id; } },
    steam: { title: "調整：蒸らし", list: STEAMS, set: (v) => { tt.steam = v.id; } },
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

// --- アルミ穴あけ（リズム6連打）
function stepFoil() {
  const body = tnPanel("アルミ穴あけ", "リズムよく6つ穴を開けろ。ゾーンに入った瞬間に押す！");
  const counter = document.createElement("p");
  counter.className = "tn-hint";
  const zoneW = 0.14 + state.stats.technique / 700;
  const left = 0.45 - zoneW / 2 + Math.random() * 0.2;
  const { wrap, gauge } = buildGauge(body, [left, left + zoneW], Math.max(0.9, 1.25 - state.stats.technique / 300));
  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.textContent = "穴を開ける！";
  const result = document.createElement("div");
  result.className = "practice-result";
  let attempts = 0;
  const update = () => { counter.textContent = `穴: ${tt.foilHits} / 6（残り ${6 - attempts} 回）`; };
  update();
  btn.addEventListener("click", () => {
    if (attempts >= 6) return;
    attempts++;
    const r = gauge.judge();
    if (window.SFX) SFX.foil();
    if (r !== "miss") tt.foilHits++;
    updateRig();
    update();
    if (attempts >= 6) {
      gauge.stop();
      btn.disabled = true;
      tt.foilDone = true;
      updateRig();
      const foilResult = tt.foilHits >= 6 ? "perfect" : tt.foilHits >= 4 ? "good" : "miss";
      showStamp($("#tn-layout .panel"), foilResult);
      pakkiLive(foilResult);
      result.textContent =
        tt.foilHits >= 6 ? "──美しい六角形。空気の通り道が完璧に揃った。"
        : tt.foilHits >= 4 ? "──まずまずの穴あけ。空気はちゃんと通る。"
        : "──穴が乱れた。空気の流れにムラが出そうだ……。";
      const next = document.createElement("button");
      next.className = "primary-btn";
      next.textContent = "次へ";
      next.addEventListener("click", () => tnNext("foil"));
      result.appendChild(document.createElement("br"));
      result.appendChild(next);
    }
  });
  body.insertBefore(counter, wrap);
  wrap.appendChild(btn);
  body.appendChild(result);
}

// --- 炭起こし（一発タイミング）
function stepCoalFire() {
  const body = tnPanel("炭起こし", "コンロの炭をじっと見る。全体が赤く熾った、その瞬間に乗せろ！");
  const zoneW = 0.10 + state.stats.guts / 900;
  const left = 0.55 + Math.random() * 0.15;
  const { wrap, gauge } = buildGauge(body, [left, left + zoneW], Math.max(1.0, 1.45 - state.stats.guts / 250));
  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.textContent = "今だ！乗せる！";
  const result = document.createElement("div");
  result.className = "practice-result";
  btn.addEventListener("click", () => {
    gauge.stop();
    btn.disabled = true;
    tt.coalFire = gauge.judge();
    if (window.SFX) SFX.coal();
    showStamp($("#tn-layout .panel"), tt.coalFire);
    pakkiLive(tt.coalFire);
    result.textContent = {
      perfect: "──完璧な熾き。炭全体が均一な赤に染まっている。",
      good: "──十分に熾きた。問題ない熱だ。",
      miss: "──少し早かったか……。炭の片面がまだ黒い。",
    }[tt.coalFire];
    const next = document.createElement("button");
    next.className = "primary-btn";
    next.textContent = "次へ";
    next.addEventListener("click", () => tnNext("coalfire"));
    result.appendChild(document.createElement("br"));
    result.appendChild(next);
  });
  body.append(result);
  wrap.appendChild(btn);
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
  spawn();
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
  const flavors = D.flavors.filter((f) =>
    (!f.requires_flag || state.flags[f.requires_flag]) && (!f.leaf || f.leaf === "blond"));
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
    });
    plus.addEventListener("click", () => {
      const kinds = Object.keys(tt.mix);
      if (!tt.mix[f.id] && kinds.length >= 3) { toast("ミックスは3種類まで"); return; }
      if (total() >= cap) { toast(`このボウルは${cap}gまで`); return; }
      tt.mix[f.id] = (tt.mix[f.id] || 0) + 1;
      if (window.SFX) SFX.pour();
      update();
      updateRig();
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

// --- 蒸らし弾幕（雑念よけ）: 蒸らしタイマーが切れるまで、心（♥）を動かして
// 雑念ワードの弾幕を躱し続ける。実時間は短縮し、画面のタイマーは蒸らし時間を早回しで表示。
// 被弾は蓄積（tt.steamHits）し、煙の落ち着き＝craftスコアに響く
function runSteamDodge(steamOpt, onDone) {
  const duration = steamOpt.dodge || 9;
  const slump = state.chapter === 2 && state.flags._taste_slump && tt.mode !== "drill";
  const body = tnPanel(
    "蒸らし中 ── 雑念を躱せ",
    slump
      ? "頭の中が、ざわつく。借り物の言葉が雑念になって飛んでくる──煙のことだけ考えろ。"
      : "心（♥）をドラッグ（または矢印キー）で動かして雑念を躱せ。被弾するほど煙が落ち着かない。"
  );
  const words = slump || (state.chapter === 2 && tt.mode === "tournament") ? DODGE_WORDS_CH2 : DODGE_WORDS;
  const timer = document.createElement("div");
  timer.className = "dodge-timer";
  timer.innerHTML = `<span class="dodge-timer-label"></span><div class="dodge-timer-bar"><div class="dodge-timer-fill"></div></div>`;
  const arena = document.createElement("div");
  arena.className = "dodge-arena";
  const soul = document.createElement("div");
  soul.className = "dodge-soul";
  soul.textContent = "♥";
  arena.appendChild(soul);
  const result = document.createElement("div");
  result.className = "practice-result";
  body.append(timer, arena, result);

  const label = timer.querySelector(".dodge-timer-label");
  const fill = timer.querySelector(".dodge-timer-fill");
  let W = 760, H = 230;
  let sx = W / 2, sy = H * 0.62;
  let hits = 0, invuln = 0, remain = duration, last = performance.now();
  let spawnIn = 0.6, raf = 0, ended = false;
  const bullets = [];
  const keys = {};
  // 洞察が高いほど、雑念の湧きがわずかに穏やか（そこそこ有利、程度）
  const spawnEvery = (slump ? 0.4 : 0.52) + Math.min(0.14, state.stats.insight / 500);
  const bulletSpeed = slump ? 132 : 112;

  const measure = () => {
    W = arena.clientWidth || W;
    H = arena.clientHeight || H;
    sx = Math.min(sx, W - 12);
    sy = Math.min(sy, H - 12);
  };
  const onPointer = (e) => {
    const r = arena.getBoundingClientRect();
    sx = Math.max(10, Math.min(W - 10, e.clientX - r.left));
    sy = Math.max(10, Math.min(H - 10, e.clientY - r.top));
    e.preventDefault();
  };
  const onKeyDown = (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
      keys[e.key] = true;
      e.preventDefault();
    }
  };
  const onKeyUp = (e) => { delete keys[e.key]; };
  arena.addEventListener("pointermove", onPointer);
  arena.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  const spawnBullet = () => {
    const el = document.createElement("span");
    el.className = "dodge-bullet";
    el.textContent = words[Math.floor(Math.random() * words.length)];
    arena.appendChild(el);
    // 四辺のどこかから、心の位置めがけて（±ブレ）流れてくる
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -30; y = Math.random() * H; }
    else if (side === 1) { x = W + 30; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = -20; }
    else { x = Math.random() * W; y = H + 20; }
    const ang = Math.atan2(sy - y, sx - x) + (Math.random() * 0.9 - 0.45);
    const sp = bulletSpeed * (0.75 + Math.random() * 0.6);
    bullets.push({ el, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
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
    showStamp($("#tn-layout .panel"), grade);
    pakkiLive(grade);
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
    // タイマー表示は「蒸らしn分」を早回しした残り時間
    const dispSec = Math.max(0, Math.round(steamOpt.id * 60 * (remain / duration)));
    label.textContent = `蒸らし残り ${Math.floor(dispSec / 60)}:${String(dispSec % 60).padStart(2, "0")}`;
    fill.style.width = `${Math.max(0, (remain / duration) * 100)}%`;
    // キー移動
    const v = 240 * dt;
    if (keys.ArrowLeft || keys.a) sx -= v;
    if (keys.ArrowRight || keys.d) sx += v;
    if (keys.ArrowUp || keys.w) sy -= v;
    if (keys.ArrowDown || keys.s) sy += v;
    sx = Math.max(10, Math.min(W - 10, sx));
    sy = Math.max(10, Math.min(H - 10, sy));
    soul.style.transform = `translate(${sx - 8}px, ${sy - 9}px)`;
    // 弾の生成と移動
    spawnIn -= dt;
    if (spawnIn <= 0) { spawnIn = spawnEvery; spawnBullet(); }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
      if (b.x < -80 || b.x > W + 80 || b.y < -60 || b.y > H + 60) {
        b.el.remove();
        bullets.splice(i, 1);
        continue;
      }
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
const PULL_TARGET = [0.63, 0.79]; // 温度バー上の適温ゾーン（0..1）
const PULL_DELTA = 0.13; // 1回の吸いで動かせる最大温度

function pullStartTemp() {
  const totalG = Object.values(tt.mix).reduce((a, b) => a + b, 0) || 12;
  let t = 0.5;
  t += { two: -0.07, triangle: 0, four: 0.07 }[tt.coal] ?? -0.04;
  t += { perfect: 0.04, good: 0, miss: -0.07 }[tt.coalFire] ?? 0;
  t += { 2: -0.08, 5: 0, 8: 0.03, 12: 0.07 }[tt.steam] ?? 0;
  t -= Math.max(0, totalG - 12) * 0.012; // 葉が多いほど温まりは遅い
  t += Math.random() * 0.06 - 0.03;
  return Math.max(0.16, Math.min(0.9, t));
}

function stepPull() {
  const body = tnPanel(
    "吸い出し（温度合わせ）",
    "提供前に何度か吸って、ボウルの温度を立ち上げる。左で止めれば上げ吸い、右なら下げ吸い、真ん中はキープ。" +
      `最低${PULL_MIN}回・${PULL_SAFE}回までは無傷、それ以上は葉が痩せる。やめ時は自分で決めろ。`
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
  const speed = Math.max(0.42, 0.56 - state.stats.technique / 600); // 技術が高いほど少し遅い
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
    if (pos < 0.35) {
      delta = ((0.35 - pos) / 0.35) * PULL_DELTA;
      label = "上げ吸い！　炭の熱がボウルに乗る";
      if (inBand(PULL_JUST.up)) { just = true; delta = PULL_DELTA * 1.5; label = "ジャスト上げ！　ひと吸いで一気に熱が立つ"; }
    } else if (pos > 0.65) {
      delta = -((pos - 0.65) / 0.35) * PULL_DELTA;
      label = "下げ吸い。熱を逃して落ち着かせる";
      if (inBand(PULL_JUST.down)) { just = true; delta = -PULL_DELTA * 1.5; label = "ジャスト下げ！　狙いどおりに熱が抜ける"; }
    } else if (inBand(PULL_JUST.keep)) {
      just = true; jitter = 0.003; // ジャストキープでも完全固定にはしない
      label = "ジャストキープ。煙が、ほとんど揺れない";
    }
    if (just) {
      tt.pullJust = (tt.pullJust || 0) + 1;
      showStamp($("#tn-layout .panel"), "just");
      if (window.SFX) SFX.perfect && SFX.perfect();
    }
    tt.temp = Math.max(0, Math.min(1, tt.temp + delta + (Math.random() * 2 - 1) * jitter));
    updateTemp();
    updateCount();
    result.textContent = `──${label}`;
    // 4回目以降は吸いすぎ: 提供前に葉が痩せていく（craftScore で減点）
    if (tt.pullCount > PULL_SAFE) result.textContent += "　（……吸いすぎだ。味の厚みが、少しずつ逃げていく）";
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
        if (state.chapter === 2) return finishCh2Stage();
        // ラウンド3終了の会話を挟んで結果発表へ
        return playDialogue("ch1_tournament_r3_end", () => finishTournament(), "res://assets/backgrounds/bg_tournament_stage.png");
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
  if (tt.steam === 5 || tt.steam === 8) { score += 10; detail.push("蒸らしはちょうどいい。香りがきれいに開いた。"); }
  else if (tt.steam === 12) score += 4;
  else { score -= 5; detail.push("蒸らしが短すぎた。立ち上がりが粗い。"); }
  // 蒸らし中の雑念（弾幕の被弾数）
  if (typeof tt.steamHits === "number") {
    if (tt.steamHits === 0) { score += 6; detail.push("蒸らしの間、心は静かだった。雑念のない煙はまっすぐ立つ。"); }
    else if (tt.steamHits <= 2) score += 3;
    else if (tt.steamHits >= 5) { score -= 4; detail.push("蒸らしの間の雑念が、煙に出てしまった。"); }
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

function finishTournament() {
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
  const base = statScore * 0.55 + craft.score * 0.45 + serveBonus;

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

function showResult(results, rank, detail, opts = {}) {
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
  const btn = document.createElement("button");
  btn.className = "primary-btn";
  btn.style.opacity = "0";
  btn.style.transition = "opacity 0.4s";
  setTimeout(() => { btn.style.opacity = "1"; }, 500 + rows.length * 750 + 400);
  if (rank === 1) {
    btn.textContent = "結果発表へ";
    btn.addEventListener("click", opts.onWin || (() => {
      addMoney(50000); // 優勝賞金（master_spec #21）
      playDialogue("ch1_tournament_result", () =>
        playDialogue("ch1_tournament_after", () => postClearPhone(() => showClear()), "res://assets/backgrounds/bg_tournament_stage.png"), "res://assets/backgrounds/bg_tournament_stage.png"
      );
    }));
  } else {
    btn.textContent = "……結果を受け止める";
    btn.addEventListener("click", opts.onLose || (() => {
      tt.rank = rank;
      addMoney({ 2: 20000, 3: 10000, 4: 3000 }[rank] || 0); // 順位別賞金（4位は参加賞）
      playDialogue("ch1_tournament_defeat", () => showDefeat(rank), "res://assets/backgrounds/bg_tournament_stage.png");
    }));
  }
  body.append(note, table, btn);
}

function showClear() {
  stopRigEffects();
  if (window.SFX) SFX.fanfare();
  state.phase = "cleared";
  save();
  showScreen("#screen-end");
  $("#end-title").textContent = "第1章クリア！";
  $("#end-sub").textContent = "SMOKE CROWN CUP 優勝 ── 全国大会 HAZE: OPEN CLOUD へ。";
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
  $("#end-title").textContent = "敗北……";
  $("#end-sub").textContent = state.chapter === 2
    ? `結果は${rank}位。${CH2_STAGE_LABEL[state.ch2Stage] || ""}敗退──1位だけが、先へ進める。`
    : `結果は${rank}位。優勝だけが次への切符だった。`;
  renderStatusInto($("#end-status"));
  const retry = document.createElement("button");
  retry.className = "primary-btn";
  retry.textContent = "もう一度挑戦する";
  retry.addEventListener("click", () => beginMaking());
  $("#end-status").appendChild(retry);
}

// ---------------------------------------------------------------- 第2章 HAZE: OPEN CLOUD
// 14日制の中に予選(DAY8)→準決勝(DAY11)→決勝(DAY14)を配置。
// 1位のみ通過。名前付きライバルは別ブロックを勝ち上がって決勝で当たる
const CH2_STAGES = {
  qual: {
    rivals: [
      { id: "q1", name: "関東第二代表", base: 56 },
      { id: "q2", name: "湾岸エリア代表", base: 61 },
      { id: "q3", name: "港町の老舗代表", base: 53 },
    ],
    bar: 58,
    prize: 10000,
    after: "ch2_adam_distance",
    winDetail: "──予選通過。審査席の端で、白衣の男が小さくペンを走らせた。",
    loseDetail: "……札は伸びなかった。全国の「普通」は、地方の「上出来」より上にある。",
  },
  semi: {
    rivals: [
      { id: "ageha", name: "あげは", base: 69 },
      { id: "s1", name: "北信越ブロック覇者", base: 64 },
      { id: "s2", name: "九州ブロック覇者", base: 66 },
    ],
    bar: 70,
    prize: 15000,
    after: "ch2_naru_confrontation",
    winDetail: "──審査席のチャコール博士が、はじめの欄に何かを長く書き込んでいる。「データに入らない強さ」、と。",
    loseDetail: "……あと一歩、届かない。借り物の理屈では、ここから先の壁は破れない。",
  },
  final: {
    rivals: [
      { id: "rei", name: "零-REI-", base: 76 },
      { id: "kumicho", name: "神崎竜二", base: 73 },
      { id: "f1", name: "西日本ブロック覇者", base: 70 },
    ],
    bar: 80,
    prize: 30000,
    winDetail: "──最終発表。審査員たちの残り持ち点が、音を立ててこの一台に注がれていく。自分史上、もっとも綺麗にまとまった煙だった。",
    loseDetail: "……持ち点は動かなかった。綺麗なだけの煙では、頂点の「もう一口」は引き出せない。",
  },
};

function startChapter2() {
  state.chapter = 2;
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
  // 全国大会の組み合わせ発表で対戦相手の名前が判明する
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
        { speaker: "pakki", face: "normal", text: "ぷぷぷっ！　全国の煙自慢が勢ぞろい！　今大会の課題フレーバーは──ストロベリー！　県特産の苺を2g以上、しっかり使ってね♪" },
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
function inventoryHtml() {
  const owned = (state.owned || []).map((id) => {
    const e = (D.equipment || []).find((x) => x.id === id);
    return e ? `<div class="status-row"><span>${e.name}</span><span class="inv-type">${EQUIP_TYPE_LABELS[e.type] || ""}</span></div>` : "";
  }).filter(Boolean).join("");
  const money = `<div class="status-row"><span>所持金</span><span class="inv-money">¥${state.money.toLocaleString()}</span></div>`;
  return `<div class="status-block"><h3>所持金</h3>${money}</div>` +
    `<div class="status-block"><h3>機材</h3>${owned || '<p class="status-empty">手持ちの機材はない。</p>'}</div>`;
}

// メインのステータスタブ（数値は出さず★とランク呼称・体力・大会の歩み）
function mainStatusHtml() {
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
  const chapName = { 1: "SMOKE CROWN CUP（地方）", 2: "HAZE: OPEN CLOUD（全国）" }[state.chapter] || `第${state.chapter}章`;
  const progress = state.phase === "cleared" ? "優勝・クリア" : state.phase === "tournament" ? "大会本番" : `DAY ${state.day} / 準備中`;
  const tour = `<div class="status-row"><span>挑戦中の大会</span><span>${chapName}</span></div>` +
    `<div class="status-row"><span>状況</span><span>${progress}</span></div>`;
  return `<div class="status-block"><h3>ステータス</h3>${statRows}</div>` +
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
  ["coalfire", "COAL"], ["coal", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
// バイト中のオーダーチャレンジ: お客さんのリクエスト（日替わり）に合わせて
// 大会同様のフル工程で1台作る（テーマと集中だけ接客中なので省略）
const BAITO_FLOW = [
  ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"], ["coalfire", "COAL"],
  ["coal", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
const TUTORIAL_TIPS = {
  theme: "スミさん「まずは一台のコンセプトだ。今日は好きに選んでいい」",
  mix: "スミさん「基本は12g。ボウルの容量までは盛れるが、多く詰む分は熱も葉代も食うぞ」",
  pack: "スミさん「迷ったらノーマル。フレーバーの重さで変えるんだ」",
  foil: "スミさん「穴は均等に。リズムで開けると揃う」",
  coalfire: "スミさん「炭は全体が赤く熾きてからだ。焦るな」",
  coal: "スミさん「基本はトライアングル。熱が均等に回る」",
  steam: "スミさん「蒸らしは5〜8分。待つ間、余計なことを考えるな。雑念は煙に出る」",
  pull: "スミさん「提供前の吸い出しで温度を作る。左で止めれば上げ、右なら下げだ。最低2回」",
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
    great: { face: "surprise", text: "……驚いたな。初めての通しでこの煙か。お前、本当に筋がいいぞ。" },
    good: { face: "smile", text: "悪くない。初めての通しなら上出来だ。あとは数をこなすだけだな。" },
    rough: { face: "normal", text: "まあ、最初はこんなもんだ。どこで味が決まるか、体で覚えただろう。" },
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
        { no: "第一章", num: "Ⅰ", name: "一吸目", read: "ファーストパフ ── FIRST PUFF", sub: "SMOKE CROWN CUP 編" },
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
  // 凛（問屋街の代理店）導入前のセーブ互換
  if (!("rin" in state.affinity)) { state.affinity.rin = 0; state.visits.rin = 0; }
  // 第2章・恋愛システム導入前のセーブ互換
  if (!state.chapter) state.chapter = 1;
  if (!("ageha" in state.affinity)) { state.affinity.ageha = 0; state.visits.ageha = 0; }
  if (!Array.isArray(state.lovers)) state.lovers = [];
  if (!state.loveLevel) state.loveLevel = {};
  if (typeof state.guilt !== "number") state.guilt = 0;
  // 体力・好感度二層化・名前開示・恋人デート導入前のセーブ互換
  if (typeof state.stamina !== "number") state.stamina = 100;
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
  $("#btn-new").addEventListener("click", () => {
    if (window.SFX) SFX.select();
    engulfInSmoke(() => {
      localStorage.removeItem(SAVE_KEY);
      if (window.SFX) SFX.bgmStop(); // コールドオープンは無音で（tonariのBGMは日常から）
      startNewGame();
    });
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
  $("#btn-status").addEventListener("click", () => toggleStatus(true));
  $("#status-close").addEventListener("click", () => toggleStatus(false));
  $("#shop-close").addEventListener("click", () => { if (window.SFX) SFX.close(); showMap(); });
  $("#btn-gameover-title").addEventListener("click", () => location.reload());
  // ダイアログ右下ツール
  $("#vn-auto").addEventListener("click", toggleAuto);
  $("#vn-skip").addEventListener("click", toggleSkip);
  $("#vn-log").addEventListener("click", showLog);
  $("#vn-glossary").addEventListener("click", showGlossary);
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
