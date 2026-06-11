// 第1章ブラウザ版 — ゲーム進行（日常ループ → SMOKE CROWN CUP）
"use strict";

const D = window.GAME_DATA;
const SAVE_KEY = "shisha_ch1_save_v1";
const MAX_DAYS = 7;
const AFFINITY_CAP = 3; // 第1章の好感度上限
const VISIT_COST = 3000;

// ---------------------------------------------------------------- state
let state = null;

// 初期所持機材（各タイプの基本品。上位機材はショップで買う）
const STARTER_EQUIPMENT = ["silicone_bowl", "lotos_hagal", "flat_charcoal"];

function newState() {
  return {
    day: 1,
    ap: 2,
    money: 30000,
    stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    affinity: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0 },
    visits: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0, rin: 0 },
    usedBaito: [],
    gymMember: false,
    owned: STARTER_EQUIPMENT.slice(),
    limeDone: [],          // 既読のLIMEメッセージID
    pendingLimeNight: null, // 夜に約束したLIMEイベント {event, sender}
    practiceBest: {},      // 練習ドリルの自己ベスト（0〜2）。大会本番のボーナスになる
    flags: {},
    phase: "opening", // opening | daily | tournament | cleared
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* file:// 等で失敗しても続行 */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
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

function gainAffinity(charId) {
  if (!(charId in state.affinity)) return;
  if (state.affinity[charId] >= AFFINITY_CAP) return;
  state.affinity[charId] += 1;
  const name = SPEAKER_NAMES[charId] || charId;
  // バッジは顔ドット絵（無いキャラのみ頭文字にフォールバック）
  gainBanner({
    kind: "affinity",
    badge: faceIconHtml(charId) || (name.match(/[一-龯ぁ-んァ-ヴa-zA-Z]/) || ["♡"])[0],
    labelTop: "AFFINITY UP",
    labelMain: name,
    labelSub: "距離が縮まった気がする",
  });
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
    hudDay.textContent = "SMOKE CROWN CUP 当日";
    hudDay.classList.remove("hidden");
  } else {
    const left = MAX_DAYS + 1 - state.day;
    hudDay.textContent = `DAY ${state.day} ／ 大会まであと${left}日`;
    // ダイアログ中だけ薄く出す（マップでは大きな day-card に任せる）
    const isMap = document.querySelector("#screen-map.active");
    hudDay.classList.toggle("hidden", !!isMap);
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

// DAYカードに出すスミさんの日替わりの一言（締切感の演出。day3/6の夜イベントを予告する）
const SUMI_QUOTES = [
  "初日から飛ばすな。一台ずつ、丁寧にな",
  "炭の置き方ひとつで味は変わるぞ",
  "今夜、お前の素の一台を見せてもらう",
  "人の煙を見るのも練習のうちだ",
  "疲れは煙に出る。今日は無理するな",
  "今夜は通しのリハーサルだ。そのつもりでな",
  "前日だ。新しいことはするな。いつも通りにやれ",
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
  $("#dc-request").textContent = dailyTheme().label;
  $("#dc-quote").textContent = `スミ「${SUMI_QUOTES[Math.min(Math.max(state.day, 1), 7) - 1]}」`;
}

// 判定スタンプ演出
function showStamp(container, result) {
  const labels = { perfect: "PERFECT!", good: "GOOD", miss: "MISS…" };
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
  }, 1400);
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
      charNames: D.char_names,
      setFlag: (flag) => { state.flags[flag] = true; },
      hasCg: (cgId) => (D.cgs || []).includes(cgId),
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

function handleDialogueChoice(dialogueId, choiceId, branchKey) {
  // チョイザップ入会: 4,000円を支払いジム会員になる
  const isJoin =
    (dialogueId === "ch1_choizap_first" && branchKey === "register") ||
    (dialogueId === "choizap_retry" && branchKey === "go");
  if (isJoin) {
    addMoney(-4000);
    state.gymMember = true;
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
  { id: "sumi", label: "スミさんと話す", desc: "師匠の昔話と教え", cost: 0 },
  { id: "tsumugi", label: "つむぎと話す", desc: "tonari常連の彼女の席へ", cost: 0 },
  { id: "naru", label: "なるの店へ行く", desc: "ライバル店を偵察", cost: VISIT_COST },
  { id: "adam", label: "アダムの店へ行く", desc: "ダブルアップル職人の店", cost: VISIT_COST },
  { id: "minto", label: "みんとの店へ行く", desc: "自称20歳の店へ", cost: VISIT_COST },
  { id: "choizap", label: "チョイザップ", desc: "みんとに教えてもらったジム", cost: 0, requiresMet: "minto" },
  { id: "kannon", label: "観音堂", desc: "アダムに教えてもらった静かな場所", cost: 0, requiresMet: "adam" },
  { id: "cafe", label: "カフェ", desc: "なるおすすめのスパイスラテ", cost: 800, requiresMet: "naru" },
  { id: "c_station", label: "C.STATION", desc: "大会会場の下見に行く", cost: 0 },
  { id: "shop", label: "Dr.fookah", desc: "卸直営のショップ。機材・フレーバーが揃い、1階の試飲席で一応吸える（時間はかからない）", cost: 0 },
  { id: "rest", label: "家で休む", desc: "しっかり寝て明日に備える", cost: 0 },
];

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
const LIME_EXCHANGE_VISITS = { naru: 2, adam: 3, minto: 1, tsumugi: 1, sumi: 1, rin: 2 };

function limeDueMessages(tournamentDay) {
  const due = [];
  for (const m of D.lime_messages || []) {
    const sender = m.sender;
    if (!(sender in state.affinity)) continue; // 第1章の登場キャラのみ
    if (state.limeDone.includes(m.id)) continue;
    if (state.visits[sender] < (LIME_EXCHANGE_VISITS[sender] || 1)) continue;
    const cond = m.trigger_condition;
    if (cond === "lime_exchanged") {
      if (tournamentDay || m.trigger_day !== state.day) continue;
    } else if (cond === "affinity_level") {
      if (tournamentDay || state.affinity[sender] < (m.trigger_value || 99)) continue;
    } else if (cond === "tournament_day") {
      if (!tournamentDay) continue;
    } else if (cond === "flag") {
      // デート（outing）翌朝のフォローLIMEなど、フラグ起動のメッセージ
      if (tournamentDay || !state.flags[m.trigger_flag]) continue;
    } else {
      continue; // ch2以降の条件（ch2_started 等）
    }
    due.push(m);
  }
  return due;
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
  $("#lime-peer-name").textContent = SPEAKER_NAMES[m.sender] || (D.char_names || {})[m.sender] || m.sender;
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
    limeReplyButtons([
      {
        text: "行く！",
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
          // 好感度が上限なら代わりに魅力を伸ばす（イベント報酬ルール）
          if ((state.affinity[m.sender] || 0) >= AFFINITY_CAP) gainStat("charm", 2);
          else gainAffinity(m.sender);
          setTimeout(nextLimeThread, 1700);
        }, 800);
      },
    })));
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
  // 昼の約束はスマホを閉じた足でそのまま向かう（行動は消費しない）。
  // 遅延を挟むとその隙にマップ操作ができてしまうので、即座に遷移する
  const chain = (i) => {
    if (i >= accepted.length) { if (done) done(); return; }
    playLimeEvent(accepted[i].event, accepted[i].sender, () => chain(i + 1));
  };
  chain(0);
}

// LIME経由のイベント再生。会話内の報酬キューに加えて必ず好感度を1つ付ける
function playLimeEvent(dialogueId, sender, after) {
  visitContextChar = sender;
  playDialogue(dialogueId, () => {
    gainAffinity(sender);
    if (!cueFiredInDialogue) gainStat("insight", 2);
    // デート（outing）後は翌朝のフォローLIMEが届く
    if (dialogueId.startsWith("outing_")) state.flags[`_outing_done_${sender}`] = true;
    // 「教わった技」として大会本番の小ボーナスに使う
    state.flags[`_ev_${dialogueId}`] = true;
    visitContextChar = null;
    if (after) after();
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
  tsumugi:   { x: 26, y: 70, theme: "shisha",  short: "つむぎ",     area: "tonari" },
  naru:      { x: 42, y: 22, theme: "rival",   short: "なるの店",   area: "繁華街" },
  adam:      { x: 56, y: 30, theme: "rival",   short: "アダムの店", area: "下町" },
  minto:     { x: 70, y: 22, theme: "rival",   short: "みんとの店", area: "繁華街" },
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
    if (locked) {
      btn.classList.add("locked");
      btn.innerHTML = `<div class="shield"><div class="ico">？</div><div class="label">？？？</div></div>`;
      btn.disabled = true;
      btn.dataset.label = "未開放";
    } else {
      const face = SPOT_FACE[spot.id] && faceIconHtml(SPOT_FACE[spot.id], "pin-face");
      btn.innerHTML =
        `<div class="shield">` +
          `<div class="ico">${face || SPOT_ICONS[spot.id] || ""}</div>` +
          `<div class="label">${layout.short}</div>` +
        `</div>` +
        `<div class="sub-label">${spot.label}</div>`;
      if (tooPoor) btn.disabled = true;
    }
    btn.addEventListener("mouseenter", () => updateMapInfo(spot, locked, tooPoor));
    btn.addEventListener("focus", () => updateMapInfo(spot, locked, tooPoor));
    btn.addEventListener("click", () => { if (!btn.disabled) selectSpot(spot); });
    pins.appendChild(btn);
  }
  updateMapInfo(null);
  save();
}

function updateMapInfo(spot, locked, tooPoor) {
  if (!spot) {
    $("#map-info-title").textContent = state.ap === 2 ? "今日はどうする？" : "夜の時間";
    $("#map-info-desc").textContent = "気になる場所をタップ。残り行動と所持金に注意。";
    $("#map-info-cost").textContent = "";
    $("#map-info-hint").textContent =
      state.ap === 2 ? "昼 — 今日は2回動ける" : "夜 — 今日はあと1回動ける";
    return;
  }
  const layout = SPOT_LAYOUT[spot.id] || {};
  $("#map-info-title").textContent = locked ? "？？？" : (layout.area || spot.label);
  let desc = spot.desc;
  if (!locked && spot.id === "baito") desc += `／今日の客は「${dailyTheme().label}」狙いが多いらしい`;
  $("#map-info-desc").textContent = locked
    ? "まだ知らない場所。誰かに教えてもらえそうな気がする。"
    : desc;
  $("#map-info-cost").textContent = locked
    ? ""
    : (spot.cost > 0 ? `所持金から ¥${spot.cost.toLocaleString()} 必要` : "");
  $("#map-info-hint").textContent = locked
    ? "ロック中"
    : tooPoor ? "所持金が足りない" : `タップして移動: ${spot.label}`;
}

function selectSpot(spot) {
  if (spot.cost > 0) addMoney(-spot.cost);
  switch (spot.id) {
    case "baito": return doBaito();
    case "practice": return startPractice();
    case "choizap": return doChoizap();
    case "kannon": return doSpotDialogue("kannon", "ch1_kannon_visit", "bg_street_day.png");
    case "cafe": return doSpotDialogue("cafe", "ch1_cafe_visit", "bg_street_day.png");
    case "c_station": return doSpotDialogue("c_station", "ch1_c_station_visit", "bg_shop.png");
    case "shop": return showShop();
    case "rest": return doRest();
    default: return doVisit(spot.id);
  }
}

function doSpotDialogue(spotId, dialogueId, bg) {
  visitContextChar = null;
  playDialogue(dialogueId, () => {
    if (!cueFiredInDialogue) gainStat(SPOT_FALLBACK_STAT[spotId] || "insight", 2);
    endAction();
  }, `res://assets/backgrounds/${bg}`);
}

function endAction() {
  state.ap -= 1;
  updateHud();
  save();
  if (state.ap > 0) {
    // LIMEで「夜に行く」と約束していたら、夜の頭に行動を消費せず遊びに行く
    if (state.pendingLimeNight) {
      const p = state.pendingLimeNight;
      state.pendingLimeNight = null;
      save();
      return playLimeEvent(p.event, p.sender, showMap);
    }
    return showMap();
  }
  endDay();
}

function endDay() {
  const finishDay = () => {
    if (state.day >= MAX_DAYS) {
      // 大会当日の朝: 応援LIMEが届く
      return morningPhone(() => startTournament(), { tournamentDay: true });
    }
    state.day += 1;
    state.ap = 2;
    save();
    const left = MAX_DAYS + 1 - state.day;
    showDayCard(`DAY ${state.day}`, left === 1 ? "SMOKE CROWN CUP 前日" : `大会まで あと${left}日`);
    showMap();
    morningPhone(showMap); // 朝のLIME（無ければ何もしない）
  };
  // 夜の固定イベント
  const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
  if (state.day === 2 && !state.flags._ev_salaryman) {
    state.flags._ev_salaryman = true;
    return playDialogue("ch1_salaryman_regular", finishDay, TONARI);
  }
  // DAY3夜: 中間チェック。スミさんが「素の一台」を講評し、残り日数に目的を作る
  if (state.day === 3 && !state.flags._ev_day3_check) {
    state.flags._ev_day3_check = true;
    return playCustom({
      dialogue_id: "ch1_day3_check",
      metadata: { bg: TONARI },
      lines: [
        { speaker: "", face: "", text: "閉店後。片付けをしていると、スミさんが作業台を顎で指した。" },
        { speaker: "sumi", face: "normal", text: "一台作ってみろ。練習でも本番でもない、今のお前の素の一台だ" },
        { speaker: "", face: "", text: "黙って組む。詰めて、熾して、置いて、待つ。スミさんは何も言わずに見ている。\n──完成。ホースを渡す。スミさんは目を閉じて、長い一服。" },
        { type: "condition", stat: "技術", threshold: 22, next_true: "mid_good", next_false: "mid_rough" },
        { speaker: "sumi", face: "serious", text: "大会まであと4日。どこを磨くかは、お前が決めろ。──ただし、寝ること。それも仕込みのうちだ" },
        { speaker: "hajime", face: "normal", text: "はい。（あと4日。……何を、どこまで持っていけるか）" },
        { type: "apply", stats: { insight: 2 } },
      ],
      branches: {
        mid_good: [
          { speaker: "sumi", face: "smile", text: "……腕、上げたな。3日前のお前の煙じゃない" },
          { speaker: "sumi", face: "normal", text: "ここからは弱点を潰せ。引きか、熱か、詰めか。自分で分かってるだろ" },
        ],
        mid_rough: [
          { speaker: "sumi", face: "normal", text: "……悪くない。けど、本番でこれだと埋もれるな" },
          { speaker: "sumi", face: "normal", text: "焦るな。まだ4日ある。基礎の反復が一番効く時期だ" },
        ],
      },
    }, finishDay);
  }
  if (state.day === 5 && !state.flags._ev_day5) {
    state.flags._ev_day5 = true;
    return playDialogue("ch1_day5_sumi_story", finishDay, TONARI);
  }
  // DAY6夜: 前日リハーサル（通し）。出来が本番の小ボーナスになる
  if (state.day === 6 && !state.flags._ev_day6_rehearsal) {
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
  if (state.day === 7 && !state.flags._ev_day7) {
    state.flags._ev_day7 = true;
    return playDialogue("ch1_day7_last_night", finishDay, TONARI);
  }
  finishDay();
}

// --- バイト
function doBaito() {
  visitContextChar = null;
  if (window.SFX) SFX.bgm("tonari");
  let pool = D.baito_events.filter((e) => !state.usedBaito.includes(e.id));
  if (pool.length === 0) { state.usedBaito = []; pool = D.baito_events.slice(); }
  const ev = pool[Math.floor(Math.random() * pool.length)];
  state.usedBaito.push(ev.id);
  const basePay = ev.base_pay || D.baito_settings.base_pay || 2500;

  const lines = [
    { speaker: "", face: "", text: "今日はtonariでバイト。エプロンを締めて、カウンターに立つ。" },
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
  const after = () => {
    visitContextChar = null;
    endAction();
  };
  if (idx < seq.length) {
    state.visits[charId] += 1;
    playDialogue(seq[idx], () => {
      // 会話内に報酬キューが無くても、必ず好感度かステータスを付与する
      gainAffinity(charId);
      if (!cueFiredInDialogue) gainStat(SPOT_FALLBACK_STAT[charId] || "insight", 2);
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
      after
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
  doSpotDialogue("choizap", "ch1_choizap_visit", "bg_street_day.png");
}

// --- ショップ（行動を消費しない）
function showShop() {
  visitContextChar = null;
  showScreen("#screen-shop");
  if (window.SFX) SFX.open();
  $("#shop-money").textContent = `所持金 ${state.money.toLocaleString()}円`;
  const list = $("#shop-list");
  list.innerHTML = "";
  const TYPE_ORDER = ["bowl", "hms", "charcoal"];
  for (const type of TYPE_ORDER) {
    const label = document.createElement("p");
    label.className = "setup-group-label";
    label.textContent = EQUIP_TYPE_LABELS[type];
    list.appendChild(label);
    const grid = document.createElement("div");
    grid.className = "spot-list";
    for (const e of D.equipment.filter((x) => x.type === type)) {
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
  // 2階: 凛さんのショールーム（NIGHTSIDE日本代理店）。1日1回・行動は消費しない
  const rinWrap = document.createElement("div");
  rinWrap.className = "spot-list";
  const visitedToday = !!state.flags[`_rin_d${state.day}`];
  const label = document.createElement("p");
  label.className = "setup-group-label";
  label.textContent = "2階";
  const rinBtn = document.createElement("button");
  rinBtn.className = "spot-btn";
  rinBtn.id = "shop-rin";
  rinBtn.innerHTML =
    state.visits.rin === 0
      ? `<span class="spot-name">2階から視線を感じる……</span><span class="spot-desc">階段の上に、誰かいる</span>`
      : `<span class="spot-name">2階のショールーム（凛さん）</span>` +
        `<span class="spot-cost">${visitedToday ? "今日はもう顔を出した" : ""}</span>` +
        `<span class="spot-desc">NIGHTSIDE日本代理店。試香モニターの呼び出しがあるかもしれない</span>`;
  rinBtn.disabled = visitedToday;
  rinBtn.addEventListener("click", doRinVisit);
  rinWrap.appendChild(rinBtn);
  list.append(label, rinWrap);
}

// 凛さんのショールーム（行動を消費しない。1日1回）
const RIN_SEQUENCE = ["ch1_rin_first", "ch1_rin_second", "ch1_rin_third"];
function doRinVisit() {
  if (state.flags[`_rin_d${state.day}`]) return;
  state.flags[`_rin_d${state.day}`] = true;
  visitContextChar = "rin";
  const idx = state.visits.rin;
  const after = () => {
    visitContextChar = null;
    save();
    showShop();
  };
  if (idx < RIN_SEQUENCE.length) {
    state.visits.rin += 1;
    playDialogue(RIN_SEQUENCE[idx], () => {
      gainAffinity("rin");
      if (!cueFiredInDialogue) gainStat("sense", 2);
      after();
    }, "res://assets/backgrounds/bg_shop.png");
  } else {
    playDialogue("ch1_rin_repeat", after, "res://assets/backgrounds/bg_shop.png");
  }
}

// --- 休む
function doRest() {
  visitContextChar = null;
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

// ---------------------------------------------------------------- 練習ミニゲーム
// 練習＝本番の部分練習。大会の実ミニゲームをそのまま1種選んで反復する。
// 自己ベスト（practiceBest 0〜2）は大会本番のスコアボーナスになる
const PRACTICE_DRILLS = [
  { id: "foil", label: "穴あけ反復", desc: "本番と同じリズムで6つ穴を開ける", stats: ["technique", "sense"] },
  { id: "coalfire", label: "炭起こしの見極め", desc: "全体が熾きた一瞬を逃さず乗せる", stats: ["guts", "technique"] },
  { id: "pull", label: "引きの精度", desc: "仕上げの一服をゾーンで止める", stats: ["sense", "technique"] },
  { id: "focus", label: "集中トレーニング", desc: "雑念を振り払う訓練。本番の野次対策", stats: ["insight", "guts"] },
  { id: "serve", label: "提供イメトレ", desc: "お客さんへの出し方・説明を組み立てる", stats: ["charm", "insight"] },
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
  { id: 2, label: "2分", desc: "せっかち。立ち上がりが不安定" },
  { id: 5, label: "5分", desc: "基本の蒸らし" },
  { id: 8, label: "8分", desc: "じっくり。香りが開く" },
  { id: 12, label: "12分", desc: "長すぎるかもしれない" },
];
const PRESENTS = [
  { id: "taste", label: "味で語る", theme: "fruity" },
  { id: "smoke", label: "煙の質で語る", theme: "high_heat" },
  { id: "ease", label: "吸いやすさで語る", theme: "relax" },
  { id: "unique", label: "余韻と独自性で語る", theme: "aftertaste" },
];
const RIVALS = [
  { id: "naru", name: "なる", base: 72 },
  { id: "adam", name: "アダム", base: 67 },
  { id: "minto", name: "みんと", base: 62 },
];

const EQUIP_TYPE_LABELS = { bowl: "ボウル", hms: "ヒートマネジメント", charcoal: "炭" };
const FOCUS_WORDS = [
  "手元、見られてる……",
  "パッキーの野次がうるさい",
  "時間が足りないかも……",
  "なるの煙、もう上がってる",
  "失敗したらどうしよう",
];

let tt = null; // tournament temp state
const rigState = { smokeTimer: 0, bubbleTimer: 0 };

// 大会は3ラウンド制: R1=組み立て（setup〜steam）→ R2=調整（adjust＋focus）→ R3=提供（pull/present）。
// ラウンドの切れ目で ch1_tournament_r1〜r3_end の会話が挟まる
const STEP_FLOW = [
  ["setup_bowl", "SETUP"], ["setup_hms", "SETUP"], ["setup_charcoal", "SETUP"],
  ["theme", "FLAVOR"], ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"],
  ["coalfire", "COAL"], ["coal", "HEAT"], ["steam", "STEAM"],
  ["adjust", "ROUND2"], ["focus", "FOCUS"], ["pull", "PULL"], ["present", "PRESENT"],
];
// 前日リハーサル: 短縮の通し（穴あけ・炭起こし・集中は無難な値で省略）
const REHEARSAL_FLOW = [
  ["theme", "THEME"], ["mix", "MIX"], ["pack", "PACK"], ["coal", "HEAT"], ["steam", "STEAM"], ["pull", "PULL"],
];
// 練習ドリル: 本番ミニゲームを単体で回す
const DRILL_FLOWS = {
  foil: [["foil", "FOIL"]],
  coalfire: [["coalfire", "COAL"]],
  pull: [["pull", "PULL"]],
  focus: [["focus", "FOCUS"]],
};

const FLAVOR_COLORS = {
  mint: "#8fe3c0", double_apple: "#d96a6a", blueberry: "#7d8df0",
  vanilla: "#f0e3b0", pineapple: "#f0d060", coconut: "#f3f3ef",
  nightside_earlgrey: "#b78d4e",
};

function buildRig() {
  const rig = $("#tn-rig");
  rig.innerHTML = `
    <div class="rig-label">WORKBENCH</div>
    <div class="rig">
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
  updateHud();
  save();
  playDialogue("ch1_tournament_arrival", () =>
    playDialogue("ch1_tournament_opening", () => beginMaking(), "res://assets/backgrounds/bg_tournament_stage.png")
  );
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
    focusCleared: 0, pull: null, present: null, step: "",
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
  tt = {
    mode: "drill", drill: kind,
    bowl: null, hms: null, charcoal: null,
    theme: THEMES[0], mix: {}, pack: null,
    foilHits: 0, foilDone: false, coalFire: null, coal: null, steam: null,
    focusCleared: 0, pull: null, present: null, step: "",
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
    const body = tnPanel("蒸らし時間", "スミさんの教え:「蒸らしは基本5〜8分。焦るな」");
    for (const s of STEAMS) body.appendChild(optionButton(s.label, s.desc, () => {
      tt.steam = s.id;
      if (window.SFX) SFX.smoke();
      startRigSmoke(750);
      if (tt.mode !== "tournament") return tnNext("steam"); // 大会以外は観客の会話なし
      // ラウンド1（組み立て）終了 → 観客の会話 → R1講評 → 中間発表 → ラウンド2（調整）へ
      playDialogue("ch1_tournament_match", () =>
        playDialogue("ch1_tournament_r1_end", () => showStandings(1, () => tournamentStep("adjust")), "res://assets/backgrounds/bg_tournament_stage.png"),
        "res://assets/backgrounds/bg_tournament_stage.png");
    }));
    return;
  }
  if (step === "adjust") return stepAdjust();
  if (step === "focus") return stepFocus();
  if (step === "pull") return stepPull();
  if (step === "present") {
    const body = tnPanel("プレゼンテーション", "完成・提供のあとはプレゼン。審査員に何を語る？");
    for (const p of PRESENTS) body.appendChild(optionButton(p.label, "", () => {
      tt.present = p;
      // ラウンド3終了の会話を挟んで結果発表へ
      playDialogue("ch1_tournament_r3_end", () => finishTournament(), "res://assets/backgrounds/bg_tournament_stage.png");
    }));
    return;
  }
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
        : "順位は重い。でも、南雲の持ち点10はまだ誰のものでもない。最後の引きとプレゼンで全部が変わる。");
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
      showStamp($("#tn-layout .panel"), tt.foilHits >= 6 ? "perfect" : tt.foilHits >= 4 ? "good" : "miss");
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
      // 大会ではR2終了の会話と中間発表を挟む
      if (tt.mode === "tournament") {
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

// バイト専用課題（お客さんのリクエスト）。大会の課題とは別物で、日替わり3種:
// テーマ希望のみ／指名フレーバー（しっかり効かせて）／ミント抜き（苦手なお客さん）
function baitoRequest() {
  if (state.day % 3 === 0) return { flavor: "mint", max: 0, label: "お客さん「あ、ミントは苦手で……抜きでお願いします」" };
  if (state.day % 3 === 2) return { flavor: "blueberry", min: 2, label: "お客さん「ブルーベリー、しっかり効かせてほしいな」" };
  return null; // テーマの希望だけの日
}

function activeRegulation() {
  if (!tt) return null;
  if (tt.mode === "tournament" || tt.mode === "rehearsal") return CH1_REGULATION;
  if (tt.mode === "baito") return baitoRequest();
  return null;
}

function stepMix() {
  const reg = activeRegulation();
  const body = tnPanel(
    "フレーバー選択 & ミックス",
    reg ? `合計12g・1〜3種類。レギュレーション: ${reg.label}` : "合計12gになるように配合しろ。1〜3種類まで。"
  );
  if (reg) {
    const note = document.createElement("p");
    note.className = "tn-tutor";
    note.textContent = tt.mode === "baito"
      ? reg.label
      : "パッキー「今大会の課題フレーバーはミント！ 入ってない一台は審査対象外ですよ〜♪」";
    body.appendChild(note);
  }
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
  const valid = () => total() === 12 && regOk();
  goBtn.addEventListener("click", () => { if (valid()) tnNext("mix"); });

  const regName = reg ? ((D.flavors.find((f) => f.id === reg.flavor) || {}).short_name || reg.flavor) : "";
  const refresh = () => {
    let regText = "";
    if (reg) regText = reg.max === 0 ? `　${regName}: 入れない約束` : `　${regName} ${regGrams()}/${reg.min}g`;
    totalLabel.textContent = `合計 ${total()} / 12g` + regText;
    totalLabel.classList.toggle("ok", valid());
    goBtn.disabled = !valid();
    goBtn.textContent =
      !regOk() && total() === 12
        ? (tt.mode === "baito" ? "リクエストと違う……" : "課題フレーバーが足りない")
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
    info.innerHTML = `<span class="spot-name">${f.short_name || f.name}</span><span class="spot-desc">${f.description}</span>`;
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
      if (total() >= 12) return;
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

function stepPull() {
  const body = tnPanel("引き（PULL）", "煙の仕上がりを確かめる最後の一服。ゾーンで止めろ！");
  const wrap = document.createElement("div");
  wrap.className = "gauge-wrap";
  wrap.innerHTML = `
    <div class="gauge-bar"><div class="gauge-zone" id="tn-gauge-zone"></div><div class="gauge-needle" id="tn-gauge-needle"></div></div>
    <button class="primary-btn" id="tn-gauge-stop">止める！</button>
    <div class="practice-result" id="tn-gauge-result"></div>`;
  body.appendChild(wrap);
  // センスが高いほどゾーンが広い
  const width = 0.16 + state.stats.sense / 800;
  const left = 0.5 + (Math.random() * 0.2 - 0.1) - width / 2;
  const zone = [left, left + width];
  const zoneEl = wrap.querySelector("#tn-gauge-zone");
  zoneEl.style.left = `${zone[0] * 100}%`;
  zoneEl.style.width = `${(zone[1] - zone[0]) * 100}%`;
  let pos = 0, dir = 1, running = true, raf = 0;
  const speed = Math.max(0.8, 1.15 - state.stats.technique / 350);
  const needle = wrap.querySelector("#tn-gauge-needle");
  let last = performance.now();
  const tick = (now) => {
    if (!running) return;
    const dt = (now - last) / 1000;
    last = now;
    pos += dir * speed * dt;
    if (pos >= 1) { pos = 1; dir = -1; }
    if (pos <= 0) { pos = 0; dir = 1; }
    needle.style.left = `${pos * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  wrap.querySelector("#tn-gauge-stop").addEventListener("click", (e) => {
    running = false;
    cancelAnimationFrame(raf);
    e.target.disabled = true;
    const center = (zone[0] + zone[1]) / 2, half = (zone[1] - zone[0]) / 2;
    tt.pull = Math.abs(pos - center) <= half * 0.4 ? "perfect" : pos >= zone[0] && pos <= zone[1] ? "good" : "miss";
    if (window.SFX) SFX.bubble();
    spawnBubbles(tt.pull === "perfect" ? 14 : tt.pull === "good" ? 9 : 4);
    startRigSmoke(tt.pull === "miss" ? 900 : 320);
    showStamp($("#tn-layout .panel"), tt.pull);
    const msgs = {
      perfect: "──完璧な一服。煙が重く、甘く、まとまっている。",
      good: "──いい煙だ。狙った味に近い。",
      miss: "──少しズレた。煙が軽い。……それでも、出すしかない。",
    };
    wrap.querySelector("#tn-gauge-result").textContent = msgs[tt.pull];
    const nextBtn = document.createElement("button");
    nextBtn.className = "primary-btn";
    nextBtn.textContent =
      { tutorial: "スミさんに出す", rehearsal: "スミさんに出す", drill: "結果を見る" }[tt.mode] || "提供する";
    nextBtn.addEventListener("click", () => tnNext("pull"));
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
  // 炭の配置
  if (tt.coal === "triangle") { score += 8; detail.push("トライアングルの炭が、安定した熱を作った。"); }
  else if (tt.coal === "two") score += 3;
  else if (tt.coal === "four") {
    if (p.heat >= 1.05) { score += 7; detail.push("高火力に耐えるフレーバーが、力強い煙を生んだ。"); }
    else { score -= 4; detail.push("炭が多すぎた。焦げの気配が混じる。"); }
  }
  // 蒸らし
  if (tt.steam === 5 || tt.steam === 8) { score += 10; detail.push("蒸らしはちょうどいい。香りがきれいに開いた。"); }
  else if (tt.steam === 12) score += 4;
  else { score -= 5; detail.push("蒸らしが短すぎた。立ち上がりが粗い。"); }
  // 引き
  score += { perfect: 12, good: 6, miss: 0 }[tt.pull];
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
  let presentBonus = s.charm / 8;
  if (tt.present.theme === tt.theme.id) presentBonus += 8;
  // 仲間から教わったプレゼンの学び
  if (state.flags._ev_outing_adam_1) {
    presentBonus += 2;
    craft.detail.push("『その煙で誰に何を伝えたいのか』。アダムの問いがプレゼンに芯を通した。");
  }
  if (state.flags._ev_outing_minto_1) {
    presentBonus += 2;
    craft.detail.push("みんと直伝の空気の作り方が、審査員の表情を柔らかくした。");
  }
  const base = statScore * 0.55 + craft.score * 0.45 + presentBonus;

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

function showResult(results, rank, detail) {
  const body = tnPanel("審査結果", "");
  $("#tn-title").textContent = "SMOKE CROWN CUP — 審査結果";
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
    btn.addEventListener("click", () => {
      addMoney(30000);
      playDialogue("ch1_tournament_result", () =>
        playDialogue("ch1_tournament_after", () => postClearPhone(() => showClear()), "res://assets/backgrounds/bg_tournament_stage.png"), "res://assets/backgrounds/bg_tournament_stage.png"
      );
    });
  } else {
    btn.textContent = "……結果を受け止める";
    btn.addEventListener("click", () => {
      tt.rank = rank;
      addMoney({ 2: 15000, 3: 5000, 4: 0 }[rank] || 0);
      playDialogue("ch1_tournament_defeat", () => showDefeat(rank), "res://assets/backgrounds/bg_tournament_stage.png");
    });
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
  $("#end-sub").textContent = "SMOKE CROWN CUP 優勝 ── 物語は第2章「東京編」へ続く。";
  renderStatusInto($("#end-status"));
}

function showDefeat(rank) {
  stopRigEffects();
  showScreen("#screen-end");
  $("#end-title").textContent = "敗北……";
  $("#end-sub").textContent = `結果は${rank}位。優勝だけが次への切符だった。`;
  renderStatusInto($("#end-status"));
  const retry = document.createElement("button");
  retry.className = "primary-btn";
  retry.textContent = "もう一度挑戦する";
  retry.addEventListener("click", () => beginMaking());
  $("#end-status").appendChild(retry);
}

// ---------------------------------------------------------------- status
function renderStatusInto(el) {
  el.innerHTML = "";
  const statBox = document.createElement("div");
  statBox.className = "status-block";
  statBox.innerHTML = "<h3>ステータス</h3>" + Object.entries(STAT_KEYS)
    .map(([en, ja]) => `<div class="status-row"><span>${ja}</span><span class="stars">${stars(state.stats[en])}</span></div>`)
    .join("");
  const affBox = document.createElement("div");
  affBox.className = "status-block";
  affBox.innerHTML = "<h3>好感度</h3>" + Object.entries(state.affinity)
    .map(([id, lv]) => {
      const name = SPEAKER_NAMES[id] || id;
      return `<div class="status-row"><span>${name}</span><span class="hearts">${"♥".repeat(lv)}${"♡".repeat(AFFINITY_CAP - lv)}</span></div>`;
    })
    .join("");
  el.append(statBox, affBox);
}

function toggleStatus(show) {
  const ov = $("#status-overlay");
  if (show) { renderStatusInto($("#status-body")); ov.classList.add("visible"); }
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
  mix: "スミさん「合計12g。最初は2種類くらいが扱いやすいぞ」",
  pack: "スミさん「迷ったらノーマル。フレーバーの重さで変えるんだ」",
  foil: "スミさん「穴は均等に。リズムで開けると揃う」",
  coalfire: "スミさん「炭は全体が赤く熾きてからだ。焦るな」",
  coal: "スミさん「基本はトライアングル。熱が均等に回る」",
  steam: "スミさん「蒸らしは5〜8分。ここで味が決まる」",
  pull: "スミさん「最後は自分の肺で確かめろ」",
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
      { speaker: "sumi", face: "serious", text: "本番までの7日間、店も練習台も好きに使え。……優勝してこい。" },
      { speaker: "", face: "", text: "……【技術】と【センス】が上がった。" },
    ],
  }, () => {
    // チュートリアル直後: 私服のみんと（お姉さん）が客として来る。正体は明かさない
    playDialogue("ch1_tutorial_oneesan", () => {
      save();
      showDayCard("DAY 1", "SMOKE CROWN CUP まで あと7日");
      showMap();
    }, "res://assets/backgrounds/bg_tonari_inside.png");
  });
}

// ---------------------------------------------------------------- boot
function startNewGame() {
  state = newState();
  updateHud();
  // コールドオープン: ch4ドバイ決勝の一瞬（顔も会場も見せない・暗転＋煙）
  // → 白煙 →「1年前」のtonariへ。本番背景ができたら差し替える
  $("#vn-bg").style.backgroundImage = "none";
  playDialogue("ch1_cold_open", () => {
    engulfInSmoke(() => {
      if (window.SFX) SFX.bgm("tonari");
      playDialogue("ch1_opening", () => {
        state.phase = "daily";
        save();
        startTutorial();
      }, "res://assets/backgrounds/bg_tonari_inside.png");
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
  updateHud();
  if (state.phase === "tournament") startTournament();
  else if (state.phase === "cleared") showClear();
  else showMap();
}

function init() {
  fitStage();
  window.addEventListener("resize", fitStage);
  initEngine();
  setupTitleLogo();
  // キービジュアルがあればそれを最優先、無ければキャラランダム表示
  setupTitleKeyVisual(() => setupTitleChara());
  // タイトルBGM: 自動再生がブロックされたら最初の操作で再試行する
  startTitleBgm();
  window.addEventListener("pointerdown", startTitleBgm, { once: true });
  window.addEventListener("keydown", startTitleBgm, { once: true });
  const saved = loadSave();
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
  const contBtn = $("#btn-continue");
  if (saved && saved.phase !== "opening") {
    contBtn.classList.remove("hidden");
    contBtn.addEventListener("click", () => {
      if (window.SFX) SFX.select();
      engulfInSmoke(() => {
        if (window.SFX) SFX.bgm("daily_part");
        continueGame(saved);
      });
    });
  }
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
