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
  if (amount > 0) toast(`¥${amount.toLocaleString()} を受け取った`);
  else if (amount < 0) toast(`¥${(-amount).toLocaleString()} を支払った`);
  updateHud();
}

function updateHud() {
  $("#hud-day").textContent = state.phase === "tournament" ? "大会当日" : `DAY ${state.day} / ${MAX_DAYS}`;
  $("#hud-ap").textContent = state.phase === "daily" ? `行動 残り${state.ap}` : "";
  $("#hud-money").textContent = `¥${state.money.toLocaleString()}`;
}

// ---------------------------------------------------------------- dialogue
let engine = null;
let cueFiredInDialogue = false;
let visitContextChar = null; // 好感度キューの対象キャラ

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
    }
  );
  $("#vn-click-layer").addEventListener("click", () => engine.next());
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

function showMap() {
  state.phase = "daily";
  updateHud();
  showScreen("#screen-map");
  const list = $("#map-spots");
  list.innerHTML = "";
  for (const spot of SPOTS) {
    const btn = document.createElement("button");
    btn.className = "spot-btn";
    // まだ会っていないキャラのおすすめスポットは行き先として知らない
    if (spot.requiresMet && state.visits[spot.requiresMet] === 0) {
      btn.innerHTML = `<span class="spot-name">？？？</span><span class="spot-desc">まだ知らない場所。誰かに教えてもらえそうな気がする。</span>`;
      btn.disabled = true;
      list.appendChild(btn);
      continue;
    }
    const costLabel = spot.cost > 0 ? `<span class="spot-cost">¥${spot.cost.toLocaleString()}</span>` : "";
    btn.innerHTML = `<span class="spot-name">${spot.label}</span>${costLabel}<span class="spot-desc">${spot.desc}</span>`;
    if (spot.cost > state.money) btn.disabled = true;
    btn.addEventListener("click", () => selectSpot(spot));
    list.appendChild(btn);
  }
  save();
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

function startTournament() {
  state.phase = "tournament";
  updateHud();
  save();
  playDialogue("ch1_tournament_arrival", () =>
    playDialogue("ch1_tournament_opening", () => beginMaking(), "res://assets/backgrounds/bg_tournament_stage.png")
  );
}

function beginMaking() {
  tt = {
    bowl: null, hms: null, charcoal: null,
    theme: null, mix: {}, pack: null,
    foilHits: 0, coalFire: null, coal: null, steam: null,
    focusCleared: 0, pull: null, present: null,
  };
  tournamentStep("setup_bowl");
}

function tnPanel(title, hint) {
  showScreen("#screen-tournament");
  $("#tn-title").textContent = title;
  $("#tn-hint").textContent = hint || "";
  const body = $("#tn-body");
  body.innerHTML = "";
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
    if (r !== "miss") tt.foilHits++;
    update();
    if (attempts >= 6) {
      gauge.stop();
      btn.disabled = true;
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
      update();
    });
    plus.addEventListener("click", () => {
      const kinds = Object.keys(tt.mix);
      if (!tt.mix[f.id] && kinds.length >= 3) { toast("ミックスは3種類まで"); return; }
      if (total() >= 12) return;
      tt.mix[f.id] = (tt.mix[f.id] || 0) + 1;
      update();
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
    const msgs = {
      perfect: "──完璧な一服。煙が重く、甘く、まとまっている。",
      good: "──いい煙だ。狙った味に近い。",
      miss: "──少しズレた。煙が軽い。……それでも、出すしかない。",
    };
    wrap.querySelector("#tn-gauge-result").textContent = msgs[tt.pull];
    const nextBtn = document.createElement("button");
    nextBtn.className = "primary-btn";
    nextBtn.textContent = "提供する";
    nextBtn.addEventListener("click", () => tournamentStep("present"));
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
  const note = document.createElement("div");
  note.className = "result-note";
  note.innerHTML = detail.map((d) => `<p>${d}</p>`).join("");
  const table = document.createElement("div");
  table.className = "result-table";
  results.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "result-row" + (r.id === "hajime" ? " me" : "");
    row.innerHTML = `<span class="result-rank">${i + 1}位</span><span class="result-name">${r.name}</span>`;
    table.appendChild(row);
  });
  const btn = document.createElement("button");
  btn.className = "primary-btn";
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
  state.phase = "cleared";
  save();
  showScreen("#screen-end");
  $("#end-title").textContent = "第1章クリア！";
  $("#end-sub").textContent = "SMOKE CROWN CUP 優勝 ── 物語は第2章「東京編」へ続く。";
  renderStatusInto($("#end-status"));
}

function showDefeat(rank) {
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

// ---------------------------------------------------------------- boot
function startNewGame() {
  state = newState();
  updateHud();
  playDialogue("ch1_opening", () => {
    state.phase = "daily";
    save();
    showMap();
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
  const saved = loadSave();
  $("#btn-new").addEventListener("click", () => {
    localStorage.removeItem(SAVE_KEY);
    startNewGame();
  });
  const contBtn = $("#btn-continue");
  if (saved && saved.phase !== "opening") {
    contBtn.classList.remove("hidden");
    contBtn.addEventListener("click", () => continueGame(saved));
  }
  $("#btn-status").addEventListener("click", () => toggleStatus(true));
  $("#status-close").addEventListener("click", () => toggleStatus(false));
  $("#btn-gameover-title").addEventListener("click", () => location.reload());
  showScreen("#screen-title");
}

document.addEventListener("DOMContentLoaded", init);
