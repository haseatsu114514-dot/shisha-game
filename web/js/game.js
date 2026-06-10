// 第1章ブラウザ版 — ゲーム進行（日常ループ → SMOKE CROWN CUP）
"use strict";

const D = window.GAME_DATA;
const SAVE_KEY = "shisha_ch1_save_v1";
const MAX_DAYS = 7;
const AFFINITY_CAP = 3; // 第1章の好感度上限
const VISIT_COST = 3000;

// ---------------------------------------------------------------- state
let state = null;

function newState() {
  return {
    day: 1,
    ap: 2,
    money: 30000,
    stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    affinity: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0 },
    visits: { sumi: 0, naru: 0, adam: 0, minto: 0, tsumugi: 0 },
    usedBaito: [],
    gymMember: false,
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

// 16:9 (1280x720) のステージを画面サイズに合わせて等倍スケール
function fitStage() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  $("#game").style.transform = `scale(${scale})`;
}

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.classList.remove("active");
  $(id).classList.add("active");
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

function stars(value) {
  const n = Math.max(1, Math.min(5, Math.ceil(value / 20)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function gainStat(en, amount) {
  if (!(en in state.stats) || amount <= 0) return;
  state.stats[en] = Math.max(0, Math.min(100, state.stats[en] + amount));
  const label = amount >= 5 ? "大きく上がった" : amount >= 3 ? "上がった" : "少し上がった";
  toast(`【${STAT_KEYS[en]}】が${label}`);
}

function gainAffinity(charId) {
  if (!(charId in state.affinity)) return;
  if (state.affinity[charId] >= AFFINITY_CAP) return;
  state.affinity[charId] += 1;
  const name = SPEAKER_NAMES[charId] || charId;
  toast(`${name}との距離が縮まった気がする`);
}

function addMoney(amount) {
  state.money = Math.max(0, state.money + amount);
  if (amount > 0 && window.SFX) SFX.coin();
  if (amount > 0) toast(`¥${amount.toLocaleString()} を受け取った`);
  else if (amount < 0) toast(`¥${(-amount).toLocaleString()} を支払った`);
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

function updateDayCard() {
  const isMap = document.querySelector("#screen-map.active");
  const card = $("#hud-day-card");
  card.classList.toggle("show", !!isMap && state && state.phase === "daily");
  if (!isMap || !state) return;
  $("#dc-day").textContent = state.day;
  $("#dc-week").textContent = state.ap === 2 ? "☀ DAY" : "☾ NIGHT";
  $("#dc-ap").textContent = (state.ap === 2 ? "☀" : "☾") + ` ${state.ap}`;
  $("#dc-money").textContent = state.money.toLocaleString();
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
  // ピーク（白く包まれた瞬間）で onMid を発火
  if (onMid) setTimeout(onMid, 520);
  setTimeout(() => veil.classList.remove("engulf"), 1450);
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
}

function toggleAuto() {
  if (autoMode) { stopAutoSkip(); return; }
  stopAutoSkip();
  autoMode = true;
  $("#vn-auto").classList.add("on");
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
  { id: "baito", label: "tonariでバイト", desc: "接客で稼ぐ。基本給 ¥2,500＋チップ", cost: 0 },
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

const SPOT_ICONS = {
  baito: "🫖", practice: "💨", sumi: "🪵", tsumugi: "📓",
  naru: "⚡", adam: "🍎", minto: "🌿", choizap: "💪",
  kannon: "⛩️", cafe: "☕", c_station: "🏟️", rest: "🛏️",
};

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
  rest:      { x: 88, y: 76, theme: "rest",    short: "家",         area: "自宅" },
};

function showMap() {
  state.phase = "daily";
  if (window.SFX) SFX.bgm("daily_part");
  showScreen("#screen-map");
  const night = state.ap <= 1;
  $("#map-image").style.backgroundImage =
    `url('${assetUrl(`assets/backgrounds/bg_map_local_${night ? "night" : "day"}.png`)}')`;
  $("#map-time-toggle").innerHTML =
    night ? '<span class="ico">🌙</span>夜 / 栄' : '<span class="ico">☀️</span>昼 / 栄';
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
      btn.innerHTML = `<div class="shield"><div class="ico">🔒</div><div class="label">？？？</div></div>`;
      btn.disabled = true;
      btn.dataset.label = "未開放";
    } else {
      btn.innerHTML =
        `<div class="shield">` +
          `<div class="ico">${SPOT_ICONS[spot.id] || "📍"}</div>` +
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
      state.ap === 2 ? "☀ 今日は2回動ける" : "☾ 今日はあと1回動ける";
    return;
  }
  const layout = SPOT_LAYOUT[spot.id] || {};
  $("#map-info-title").textContent = locked ? "？？？" : (layout.area || spot.label);
  $("#map-info-desc").textContent = locked
    ? "まだ知らない場所。誰かに教えてもらえそうな気がする。"
    : spot.desc;
  $("#map-info-cost").textContent = locked
    ? ""
    : (spot.cost > 0 ? `所持金から ¥${spot.cost.toLocaleString()} 必要` : "");
  $("#map-info-hint").textContent = locked
    ? "🔒 ロック中"
    : tooPoor ? "所持金が足りない" : `タップして → ${spot.label}`;
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
  if (state.ap > 0) return showMap();
  endDay();
}

function endDay() {
  const finishDay = () => {
    if (state.day >= MAX_DAYS) return startTournament();
    state.day += 1;
    state.ap = 2;
    save();
    const left = MAX_DAYS + 1 - state.day;
    showDayCard(`DAY ${state.day}`, left === 1 ? "SMOKE CROWN CUP 前日" : `大会まで あと${left}日`);
    showMap();
  };
  // 夜の固定イベント
  const TONARI = "res://assets/backgrounds/bg_tonari_inside.png";
  if (state.day === 2 && !state.flags._ev_salaryman) {
    state.flags._ev_salaryman = true;
    return playDialogue("ch1_salaryman_regular", finishDay, TONARI);
  }
  if (state.day === 5 && !state.flags._ev_day5) {
    state.flags._ev_day5 = true;
    return playDialogue("ch1_day5_sumi_story", finishDay, TONARI);
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

  // バイト後の自主練の打診
  const pw = D.baito_settings.post_work_practice;
  if (pw && pw.enabled) {
    lines.push({ speaker: "", face: "", text: pw.prompt });
    lines.push({
      type: "choice", id: "post_work", choices: [
        { text: "練習していく", next: "pw_yes" },
        { text: "今日は帰る", next: "pw_no" },
      ],
    });
    branches.pw_yes = [
      { speaker: "", face: "", text: pw.accept_result },
      { type: "apply", stats: pw.accept_stats || {} },
    ];
    branches.pw_no = [{ speaker: "", face: "", text: pw.decline_result }];
  }

  playCustom(
    { dialogue_id: "baito_" + ev.id, metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" }, lines, branches },
    endAction
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
const PRACTICE_MENU = [
  { id: "pack", label: "詰めの練習", desc: "ボウルへのフレーバーの詰め方を反復する", stats: ["technique", "sense"] },
  { id: "heat", label: "火加減トレーニング", desc: "炭の数と位置で温度を作る感覚を磨く", stats: ["technique", "guts"] },
  { id: "mix", label: "ミックス研究", desc: "フレーバーの掛け合わせをノートにまとめる", stats: ["sense", "insight"] },
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
  $("#practice-result").textContent = "";
  const menu = $("#practice-menu");
  menu.classList.remove("hidden");
  menu.innerHTML = "";
  for (const item of PRACTICE_MENU) {
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    btn.innerHTML = `<span class="spot-name">${item.label}</span><span class="spot-desc">${item.desc}</span>`;
    btn.addEventListener("click", () => runPracticeGauge(item));
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

const STEP_FLOW = [
  ["setup_bowl", "SETUP"], ["setup_hms", "SETUP"], ["setup_charcoal", "SETUP"],
  ["theme", "FLAVOR"], ["mix", "MIX"], ["pack", "PACK"], ["foil", "FOIL"],
  ["coalfire", "COAL"], ["coal", "HEAT"], ["steam", "STEAM"],
  ["focus", "FOCUS"], ["pull", "PULL"], ["present", "PRESENT"],
];

const FLAVOR_COLORS = {
  mint: "#8fe3c0", double_apple: "#d96a6a", blueberry: "#7d8df0",
  vanilla: "#f0e3b0", pineapple: "#f0d060", coconut: "#f3f3ef",
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

function beginMaking(tutorial) {
  tt = {
    tutorial: !!tutorial,
    bowl: null, hms: null, charcoal: null,
    theme: null, mix: {}, pack: null,
    foilHits: 0, foilDone: false, coalFire: null, coal: null, steam: null,
    focusCleared: 0, pull: null, present: null, step: "",
  };
  stopRigEffects();
  buildRig();
  tournamentStep(tutorial ? "theme" : "setup_bowl");
}

function tnPanel(title, hint) {
  showScreen("#screen-tournament");
  const flow = tt && tt.tutorial ? TUTORIAL_FLOW : STEP_FLOW;
  const idx = flow.findIndex(([k]) => k === (tt && tt.step));
  const head = tt && tt.tutorial ? "TUTORIAL " : "STEP ";
  $("#tn-progress").innerHTML = idx >= 0
    ? `${head}${idx + 1}/${flow.length}・${flow[idx][1]} <span class="tn-steps">${flow.map(([, t], i) => (i <= idx ? "●" : "○")).join("")}</span>`
    : "RESULT";
  $("#tn-title").textContent = title;
  $("#tn-hint").textContent = hint || "";
  // チュートリアル中はスミさんのアドバイスを添える
  const oldTutor = document.querySelector("#tn-layout .tn-tutor");
  if (oldTutor) oldTutor.remove();
  if (tt && tt.tutorial && TUTORIAL_TIPS[tt.step]) {
    const tip = document.createElement("p");
    tip.className = "tn-tutor";
    tip.textContent = TUTORIAL_TIPS[tt.step];
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
    for (const t of THEMES) body.appendChild(optionButton(t.label, t.desc, () => { tt.theme = t; tournamentStep("mix"); }));
    return;
  }
  if (step === "mix") return stepMix();
  if (step === "pack") {
    const body = tnPanel("パッキング", "煙の密度と質感が決まる。フレーバーの重さと相談だ。");
    for (const p of PACKS) body.appendChild(optionButton(p.label, p.desc, () => { tt.pack = p.id; tournamentStep("foil"); }));
    return;
  }
  if (step === "foil") return stepFoil();
  if (step === "coalfire") return stepCoalFire();
  if (step === "coal") {
    const body = tnPanel("炭の配置", "熱の入り方が決まる。基本はトライアングル。");
    for (const c of COALS) body.appendChild(optionButton(c.label, c.desc, () => { tt.coal = c.id; tournamentStep("steam"); }));
    return;
  }
  if (step === "steam") {
    const body = tnPanel("蒸らし時間", "スミさんの教え:「蒸らしは基本5〜8分。焦るな」");
    for (const s of STEAMS) body.appendChild(optionButton(s.label, s.desc, () => {
      tt.steam = s.id;
      if (window.SFX) SFX.smoke();
      startRigSmoke(750);
      if (tt.tutorial) return tournamentStep("pull"); // チュートリアルは観客も対戦相手もいない
      playDialogue("ch1_tournament_match", () => tournamentStep("focus"), "res://assets/backgrounds/bg_tournament_stage.png");
    }));
    return;
  }
  if (step === "focus") return stepFocus();
  if (step === "pull") return stepPull();
  if (step === "present") {
    const body = tnPanel("プレゼンテーション", "完成・提供のあとはプレゼン。審査員に何を語る？");
    for (const p of PRESENTS) body.appendChild(optionButton(p.label, "", () => { tt.present = p; finishTournament(); }));
    return;
  }
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
  for (const e of D.equipment.filter((x) => x.type === type)) {
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
      next.addEventListener("click", () => tournamentStep("coalfire"));
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
    next.addEventListener("click", () => tournamentStep("coal"));
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
    next.addEventListener("click", () => tournamentStep("pull"));
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

function stepMix() {
  const body = tnPanel("フレーバー選択 & ミックス", "合計12gになるように配合しろ。1〜3種類まで。");
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
  goBtn.addEventListener("click", () => { if (total() === 12) tournamentStep("pack"); });

  const refresh = () => {
    totalLabel.textContent = `合計 ${total()} / 12g`;
    totalLabel.classList.toggle("ok", total() === 12);
    goBtn.disabled = total() !== 12;
  };

  for (const f of D.flavors) {
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
    nextBtn.textContent = tt.tutorial ? "スミさんに出す" : "提供する";
    nextBtn.addEventListener("click", () => (tt.tutorial ? finishTutorial() : tournamentStep("present")));
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
  return { score, detail };
}

function finishTournament() {
  const s = state.stats;
  const statScore = (s.technique * 1.2 + s.sense * 1.0 + s.guts * 0.6 + s.charm * 0.8 + s.insight * 1.0) / 4.6;
  const craft = craftScore();
  let presentBonus = s.charm / 8;
  if (tt.present.theme === tt.theme.id) presentBonus += 8;
  const playerScore = statScore * 0.55 + craft.score * 0.45 + presentBonus;

  const results = RIVALS.map((r) => ({
    id: r.id, name: r.name,
    score: r.base + (Math.random() * 8 - 4),
  }));
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
        playDialogue("ch1_tournament_after", () => showClear(), "res://assets/backgrounds/bg_tournament_stage.png"), "res://assets/backgrounds/bg_tournament_stage.png"
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
      { speaker: "hajime", face: "normal", text: "（……やってみよう。何事も、まずは手を動かすところからだ）" },
    ],
  }, () => beginMaking(true));
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
    save();
    showDayCard("DAY 1", "SMOKE CROWN CUP まで あと7日");
    showMap();
  });
}

// ---------------------------------------------------------------- boot
function startNewGame() {
  state = newState();
  updateHud();
  playDialogue("ch1_opening", () => {
    state.phase = "daily";
    save();
    startTutorial();
  }, "res://assets/backgrounds/bg_tonari_inside.png");
}

function continueGame(saved) {
  state = saved;
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
  setupTitleChara();
  // タイトルBGM: 自動再生がブロックされたら最初の操作で再試行する
  startTitleBgm();
  window.addEventListener("pointerdown", startTitleBgm, { once: true });
  window.addEventListener("keydown", startTitleBgm, { once: true });
  const saved = loadSave();
  $("#btn-new").addEventListener("click", () => {
    if (window.SFX) SFX.select();
    engulfInSmoke(() => {
      localStorage.removeItem(SAVE_KEY);
      if (window.SFX) SFX.bgm("tonari");
      startNewGame();
    });
  });
  $("#btn-mute").addEventListener("click", () => {
    const m = !SFX.isMuted();
    SFX.setMuted(m);
    const b = $("#btn-mute");
    b.textContent = m ? "♪ OFF" : "♪ ON";
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
  $("#btn-gameover-title").addEventListener("click", () => location.reload());
  // ダイアログ右下ツール
  $("#vn-auto").addEventListener("click", toggleAuto);
  $("#vn-skip").addEventListener("click", toggleSkip);
  $("#vn-log").addEventListener("click", () => toast("ログは次回実装予定"));
  $("#vn-menu").addEventListener("click", () => toggleStatus(true));
  // タイトルメニューのフォーカス演出（hover/focus でハイライト）
  for (const item of document.querySelectorAll(".title-menu-item")) {
    item.addEventListener("focus", () => {
      for (const x of document.querySelectorAll(".title-menu-item.focus")) x.classList.remove("focus");
      item.classList.add("focus");
    });
  }
  showScreen("#screen-title");
}

document.addEventListener("DOMContentLoaded", init);
