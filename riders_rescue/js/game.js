(() => {
  const canvas = document.getElementById("game");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  const screenWrap = canvas.closest(".screen-wrap");

  const W = canvas.width;
  const H = canvas.height;
  const GRAVITY = 0.26;
  const MAX_FALL = 6.0;
  const VISUAL_MODE_KEY = "rrr_visual_mode";
  const VISUAL_MODES = {
    RETRO: "retro",
    CINEMATIC: "cinematic",
  };

  function loadVisualMode() {
    try {
      const saved = window.localStorage.getItem(VISUAL_MODE_KEY);
      if (saved === VISUAL_MODES.RETRO || saved === VISUAL_MODES.CINEMATIC) {
        return saved;
      }
    } catch (_e) {
      // localStorage can be blocked in private browsing or file:// contexts.
    }
    return VISUAL_MODES.CINEMATIC;
  }

  let visualMode = loadVisualMode();

  function isCinematicMode() {
    return visualMode === VISUAL_MODES.CINEMATIC;
  }

  function applyVisualMode() {
    const mode = isCinematicMode() ? VISUAL_MODES.CINEMATIC : VISUAL_MODES.RETRO;
    if (document.body) {
      document.body.dataset.visualMode = mode;
    }
    canvas.dataset.visualMode = mode;
    if (screenWrap) {
      screenWrap.dataset.visualMode = mode;
    }
  }

  function setVisualMode(mode, announce = false) {
    visualMode = mode === VISUAL_MODES.RETRO ? VISUAL_MODES.RETRO : VISUAL_MODES.CINEMATIC;
    applyVisualMode();
    try {
      window.localStorage.setItem(VISUAL_MODE_KEY, visualMode);
    } catch (_e) {
      // Ignore persistence failures and keep the in-memory mode.
    }
    if (announce) {
      hudMessage = visualMode === VISUAL_MODES.CINEMATIC
        ? "GRAPHICS: CINEMATIC"
        : "GRAPHICS: RETRO";
      hudTimer = Math.max(hudTimer, 72);
    }
  }

  function toggleVisualMode() {
    setVisualMode(
      isCinematicMode() ? VISUAL_MODES.RETRO : VISUAL_MODES.CINEMATIC,
      true
    );
  }

  applyVisualMode();

  const STATE = {
    TITLE: "title",
    TUTORIAL: "tutorial",
    CUTSCENE: "cutscene",
    STAGE_INTRO: "stage_intro",
    PRE_BOSS: "pre_boss",
    GOD_PHASE_CUTSCENE: "god_phase_cutscene",
    PLAY: "play",
    BOSS: "boss",
    DEAD: "dead",
    CLEAR: "clear",
  };

  let BOSS_ARENA = {
    minX: 8340,
    maxX: 8660,
  };
  const FINAL_STAGE_NUMBER = 3;
  const MAX_HEARTS = 5;
  const START_LIVES = 5;

  const input = {
    left: false,
    right: false,
    up: false,
    jump: false,
    down: false,
    attack: false,
    attack2: false,
    shoot: false,
    dash: false,
    weaponSwitch: false,
    burst: false,
    special: false,
    special2: false,
    taunt: false,
    start: false,
  };

  const prevInput = {
    jump: false,
    attack: false,
    attack2: false,
    shot: false,
    shoot: false,
    dash: false,
    down: false,
    weaponSwitch: false,
    burst: false,
    styleChange: false,
    special: false,
    special2: false,
    taunt: false,
    start: false,
  };

  let gameState = STATE.TITLE;
  let titleTimer = 0;
  let cutsceneTime = 0;
  let stageIntroTimer = 0;
  let preBossCutsceneTimer = 0;
  let godPhaseCutsceneTimer = 0;
  let deadTimer = 0;
  let deadTimerMax = 0;
  let clearTimer = 0;
  let deaths = 0;
  let cameraX = 0;

  let hudMessage = "";
  let hudTimer = 0;
  let deathContinueMode = "checkpoint";

  // --- Tutorial System ---
  const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  let tutorialStep = 0;
  let tutorialTimer = 0;
  let tutorialCompleted = false;
  let tutorialSkipHold = 0;
  let tutorialSuccessPulse = 0; // flashes hero when player performs correct action
  const TUTORIAL_SKIP_HOLD_TIME = 40;

  // Tutorial page navigation
  let tutorialPage = 0; // sub-page within a step (for multi-page info steps)

  // Touch/PC adaptive text helper
  function tKey(pcText, touchText) { return isTouchDevice ? touchText : pcText; }

  const TUTORIAL_STEPS = [
    // --- Phase 1: Basic Controls ---
    {
      key: "move", phase: "BASIC",
      titleJa: "移動",
      descJa: [tKey("A / D キーで左右に移動しよう", "左右ボタンで移動しよう")],
      check: () => input.left || input.right,
      requiredFrames: 40,
    },
    {
      key: "jump", phase: "BASIC",
      titleJa: "ジャンプ",
      descJa: [tKey("W / Space でジャンプ！", "JUMPボタンでジャンプ！"), "2回入力で2段ジャンプ！"],
      check: (actions) => actions.jumpPressed,
      requiredCount: 2,
    },
    {
      key: "attack", phase: "BASIC",
      titleJa: "攻撃",
      descJa: [tKey("J キーで斬撃コンボ！連打してみよう", "攻撃ボタンで斬撃コンボ！")],
      check: (actions) => actions.attackPressed,
      requiredCount: 3,
    },
    {
      key: "shoot", phase: "BASIC",
      titleJa: "銃撃",
      descJa: [tKey("K キーで銃撃！押しっぱなしで連射", "SHOOTボタンで銃撃！押しっぱなしで連射")],
      check: () => input.shoot,
      requiredFrames: 30,
    },
    {
      key: "dash", phase: "BASIC",
      titleJa: "ダッシュ回避",
      descJa: [tKey("L キーでダッシュ回避！", "DASHボタンで素早く回避！"), "敵の攻撃をかわそう"],
      check: (actions) => actions.dashPressed,
      requiredCount: 1,
    },

    // --- Phase 2: Style System ---
    {
      key: "style_intro", phase: "STYLE",
      titleJa: "スタイルチェンジ",
      descJa: [
        "このゲームには4つの戦闘スタイルがある！",
        "状況に合わせてスタイルを切り替えて戦おう",
        tKey("V キーでスタイル切替（方向+Vで直接指定）", "STYLEボタンでスタイル切替"),
      ],
      info: true,
    },
    {
      key: "style_swordmaster", phase: "STYLE",
      titleJa: "SWORDMASTER",
      descJa: [
        "近接攻撃の達人！剣技のダメージが最強",
        tKey("攻撃長押し→離す: 回転斬り SPIN ATTACK", "攻撃長押し→離す: 回転斬り"),
        tKey("方向+J: 突進斬り / W+J: 打ち上げ", "方向+攻撃: 突進斬り"),
        tKey("J+K 同時押し: リアルインパクト (溜め→壁破壊突き)", "攻撃+SHOOT 同時: リアルインパクト"),
        "DT発動時: ダメージ1.5倍・リーチ1.25倍",
      ],
      color: "#ff6644",
      info: true,
    },
    {
      key: "style_trickster", phase: "STYLE",
      titleJa: "TRICKSTER",
      descJa: [
        "超高速回避の使い手！スピード特化",
        tKey("L キーでテレポート回避（距離60）", "DASHでテレポート回避"),
        tKey("J+L 同時押し: ドッペルゲンガー召喚", "攻撃+DASH 同時: 分身召喚"),
        "回避成功でランクボーナス＆攻撃力UP",
        "DT発動時: 移動速度1.5倍・回避CD大幅短縮",
      ],
      color: "#ffcc22",
      info: true,
    },
    {
      key: "style_gunslinger", phase: "STYLE",
      titleJa: "GUNSLINGER",
      descJa: [
        "銃火器のスペシャリスト！射撃ダメージ特化",
        tKey("K長押しでチャージ: マシンガン→ショットガン→バズーカ", "SHOOT長押しでチャージ射撃"),
        tKey("停止中にJ+K 同時押し: ガンスティンガー (突進乱射)", "停止中に攻撃+SHOOT 同時"),
        "弾数制限あり（15発）・自動リロード",
        "DT発動時: 射撃ダメージ3倍・弾が貫通",
      ],
      color: "#22aaff",
      info: true,
    },
    {
      key: "style_royalguard", phase: "STYLE",
      titleJa: "ROYAL GUARD",
      descJa: [
        "鉄壁の防御！ガード＆カウンター特化",
        "敵の攻撃をタイミングよくガードしよう",
        "ジャストガード(6F以内)で高エネルギー獲得",
        tKey("↓(またはS)+J: ドレッドノート (大地叩き・金緑の衝撃波)", "↓+攻撃: ドレッドノート"),
        "DT発動時: オートガード・エネルギー全回復",
      ],
      color: "#22ff88",
      info: true,
    },
    {
      key: "style_try", phase: "STYLE",
      titleJa: "スタイルを切替えよう！",
      descJa: [tKey("V キーを押してスタイルチェンジ！", "STYLEボタンでスタイルチェンジ！")],
      check: (actions) => actions.styleChangePressed,
      requiredCount: 2,
    },

    // --- Phase 3: Battle Rank ---
    {
      key: "rank_intro", phase: "RANK",
      titleJa: "バトルランク",
      descJa: [
        "多彩な技を使い分けるとランクが上がる！",
        "同じ技の連打はランク低下の原因に…",
        "技を散らしてスタイリッシュに戦おう！",
      ],
      info: true,
    },
    {
      key: "rank_tiers", phase: "RANK",
      titleJa: "ランク一覧",
      descJa: [
        "Danger → Badass → Apocalyptic",
        "→ Savege → SS → SSS → EX",
        "高ランクで攻撃力・チャージ速度が大幅UP",
      ],
      subInfo: [
        { label: "Danger", color: "#6688ff", desc: "チャージ 0.7x" },
        { label: "Badass", color: "#44dddd", desc: "チャージ 0.9x" },
        { label: "Apocalyptic", color: "#44ff44", desc: "チャージ 1.18x" },
        { label: "Savege", color: "#ffaa22", desc: "チャージ 1.56x" },
        { label: "SS", color: "#ff6622", desc: "チャージ 2.08x" },
        { label: "SSS", color: "#ff4488", desc: "チャージ 2.88x" },
        { label: "EX", color: "#ffd700", desc: "チャージ 3.24x" },
      ],
      info: true,
    },

    // --- Phase 4: Black Flash ---
    {
      key: "blackflash", phase: "ADVANCED",
      titleJa: "黒閃 (Black Flash)",
      descJa: [
        "攻撃ヒット時にランダムで発動する強化効果",
        "発動時: ダメージ1.3倍・ランク上昇1.3倍",
        "連続発動で確率UP (8%→最大90%)",
        "SSS以上でハイモード突入！",
      ],
      color: "#222",
      info: true,
    },

    // --- Phase 5: Burst System ---
    {
      key: "burst_intro", phase: "ADVANCED",
      titleJa: "バースト & デビルトリガー",
      descJa: [
        "敵を倒すとバーストゲージが溜まる",
        "ゲージ50%以上で発動可能！",
        tKey("U キーでバースト発動", "BURSTボタンで発動"),
      ],
      info: true,
    },
    {
      key: "burst_types", phase: "ADVANCED",
      titleJa: "バーストの種類",
      descJa: [
        "デビルトリガー: スタイル別の強化状態(3〜6秒)",
        "プロテインバースト: ゲージMAXでレーザー攻撃",
        "タイムバースト: 時間停止(MAX) or 敵減速",
      ],
      subInfo: [
        { label: "剣DT", color: "#ff4422", desc: "ダメージ1.5x リーチ1.25x" },
        { label: "技DT", color: "#ffcc22", desc: "速度1.5x 回避CD 0.3x" },
        { label: "銃DT", color: "#22aaff", desc: "射撃3.0x 弾貫通" },
        { label: "盾DT", color: "#22ff88", desc: "オートガード エネ全回復" },
      ],
      info: true,
    },

    // --- Phase 6: Emergency Dodge & Items ---
    {
      key: "emergency", phase: "ADVANCED",
      titleJa: "緊急回避 & アイテム",
      descJa: [
        "致命的ダメージで緊急回避チャンス発生！",
        "成功でカウンター攻撃が2.0倍に",
        "バイク接触で無敵(10秒)・敵撃破で延長",
        "プロテイン: バーストゲージ回復",
      ],
      info: true,
    },

    // --- Phase 7: Ready ---
    {
      key: "ready", phase: "READY",
      titleJa: "準備完了！",
      descJa: [
        "全システムを理解した！いざ出陣！",
        "技を散らしてランクを上げ、スタイリッシュに戦え！",
      ],
      autoAdvance: 80,
    },
  ];

  let tutorialStepProgress = 0;
  let tutorialStepCount = 0;
  let tutorialAutoTimer = 0;
  let tutorialFadeOut = 0;

  let checkpointIndex = 0;
  let currentStageNumber = 1;
  let collectedProteinIds = new Set();
  let collectedLifeUpIds = new Set();
  let stage = buildStage();
  let player = createPlayer(stage.checkpoints[0].x, stage.checkpoints[0].y);
  let playerHearts = MAX_HEARTS;
  let playerLives = START_LIVES;
  let damageInvulnTimer = 0;
  let hurtFlashTimer = 0;
  let proteinRushTimer = 0;
  let proteinBurstGauge1 = 0;
  let proteinBurstGauge2 = 0;
  let proteinBurstTimer = 0;
  let proteinBurstBlastDone = false;
  let proteinBurstLaserTimer = 0;
  let proteinBurstLaserPhase = 0;
  let proteinBurstUsedGauge = 0;
  let proteinBurstPower = 1;
  let proteinBurstMode = "laser";
  let timeBurstTimer = 0;
  let timeBurstDuration = 0;
  let timeBurstMode = "none";
  let timeBurstSlowScale = 1;
  let timeBurstPhase = 0;
  let timeBurstStopDeadlineMs = 0;
  let invincibleTimer = 0;
  let invincibleHitCooldown = 0;
  let impactShakeTimer = 0;
  let impactShakePower = 0;
  let hitStopTimer = 0;
  let stompChainGuardTimer = 0;
  let kickCombo = 0;
  let kickComboTimer = 0;
  let kickFlashTimer = 0;
  let kickFlashPower = 0;
  let kickBurstX = 0;
  let kickBurstY = 0;
  let blackFlashChain = 0;
  let blackFlashTimer = 0;
  let blackFlashPower = 0;
  let blackFlashX = 0;
  let blackFlashY = 0;
  let blackFlashSlowTimer = 0;
  let blackFlashChanceHudTimer = 0;
  let blackFlashChanceHudText = "";
  let blackFlashSessionHits = 0;
  let blackFlashResultTimer = 0;
  let blackFlashResultText = "";
  let battleRankDefeats = 0;
  let battleRankGauge = 0;
  let battleRankIndex = 0;
  let battleRankLastStyle = "";
  let battleRankStyleStreak = 0;
  let battleRankRecentStyles = [];
  let battleRankUniqueCount = 0;      // Unique styles in recent window
  let battleRankComboVariety = 0;     // Variety combo counter
  let battleRankDodgeChain = 0;       // Consecutive successful dodges without getting hit
  let battleRankLastDodgeTime = 0;    // Frame of last dodge
  let battleRankFlashTimer = 0;
  let battleRankBreakFlashTimer = 0;
  let hammerTimer = 0;
  let gloveTimer = 0;
  let hammerHitCooldown = 0;
  let gloveHitCooldown = 0;
  let weaponHudTimer = 0;
  let dashJumpAssistTimer = 0;
  let attackCooldown = 0;
  let attackChargeTimer = 0;
  let attack2ChargeTimer = 0;
  let attackMaxHoldTimer = 0;
  let attackChargeReadyPlayed = false;
  let attack2ChargeReadyPlayed = false;
  let attackMashCount = 0;
  let attackMashTimer = 0;
  let shotChargeTimer = 0;
  let playerStyle = "swordmaster"; // "swordmaster", "trickster", "gunslinger", "royalguard"
  let shotReloadTimer = 0;

  // Gunner Ammo System
  let gunnerAmmo = 15; // Initial ammo
  let gunnerMaxAmmo = 15;
  let lastAttackPressTime = 0;
  const RELOAD_DOUBLE_TAP_TIME = 300; // ms

  // --- Swordmaster Style ---
  let swordComboStage = 0; // 0-2 for three-hit combo
  let swordComboTimer = 0; // Window to chain next hit
  let swordDoubleJumpUsed = false;
  let directionHoldTimer = 0; // How long direction key has been held (for Stinger input)
  // --- Taunt System ---
  let tauntTimer = 0;        // Active taunt animation duration
  let tauntBonusTimer = 0;   // Post-taunt rank gain bonus window
  let tauntFlashTimer = 0;   // Visual flash effect
  const TAUNT_DURATION = 40;        // ~0.67 seconds taunt animation
  const TAUNT_BONUS_DURATION = 180; // 3 seconds of bonus after taunt
  const TAUNT_RANK_MULTIPLIER = 2.5; // Rank gain multiplier during bonus
  // --- Royal Guard ---
  let royalGuardEnergy = 0;           // Stored energy from blocking
  let royalGuardBlockTimer = 0;       // Active guard frames
  const ROYAL_GUARD_BLOCK_WINDOW_BASE = 16; // Base frames of active guard
  const ROYAL_GUARD_JUST_WINDOW = 6;       // First 6 frames = Just Guard
  let royalGuardFlashTimer = 0;       // Visual flash on successful guard
  let royalGuardFlashColor = "#22ff88";
  // Royal Guard scales with battle rank
  function royalGuardBlockWindow() {
    // Base 16f → up to 28f at max rank
    return ROYAL_GUARD_BLOCK_WINDOW_BASE + battleRankIndex * 2;
  }
  function royalGuardBoxScale() {
    // Guard box grows with rank: 1.0 → 1.6 at rank 6
    return 1.0 + battleRankIndex * 0.1;
  }
  // Just Guard timing: returns guard quality 0-2
  // 2 = Just Guard (first 6f), 1 = Normal Guard (rest of window), 0 = not guarding
  function royalGuardQuality() {
    if (royalGuardBlockTimer <= 0) return 0;
    const window = royalGuardBlockWindow();
    const elapsed = window - royalGuardBlockTimer;
    if (elapsed <= ROYAL_GUARD_JUST_WINDOW) return 2; // Just Guard
    return 1; // Normal Guard
  }
  // Unified Royal Guard success effect — called from all guard locations
  function applyRoyalGuardSuccess(energyGain, rankPower, label) {
    const quality = royalGuardQuality();
    const isJust = quality >= 2;
    const gpx = player.x + player.w * 0.5;
    const gpy = player.y + player.h * 0.5;

    // Just Guard: much more energy, rank, effects
    const energyMul = isJust ? 2.0 : 1.0;
    const rankMul = isJust ? 2.0 : 1.0;
    royalGuardEnergy = Math.min(ROYAL_GUARD_MAX_ENERGY, royalGuardEnergy + energyGain * energyMul);
    battleRankDodgeChain++;

    // Guard level from chain
    const chainLevel = battleRankDodgeChain >= 4 ? 3 : battleRankDodgeChain >= 2 ? 2 : 1;
    const effectLevel = isJust ? Math.max(chainLevel, 2) : chainLevel;

    // HUD message
    if (isJust) {
      hudMessage = effectLevel >= 3 ? "PERFECT JUST GUARD!!" : "JUST GUARD!!";
    } else {
      hudMessage = effectLevel >= 3 ? "PERFECT GUARD!" : label || "GUARD!";
    }
    hudTimer = isJust ? 50 : 35;

    // Visual feedback — Just Guard is bigger
    royalGuardFlashTimer = isJust ? 20 : 12;
    royalGuardFlashColor = isJust
      ? (effectLevel >= 3 ? "#ffff00" : "#00ffff")
      : (effectLevel >= 3 ? "#ffff00" : effectLevel >= 2 ? "#44ffaa" : "#22ff88");

    const impactStr = isJust ? 4.0 + effectLevel : 2.5 + effectLevel * 0.5;
    triggerImpact(impactStr, gpx, gpy, impactStr + 1);
    hitStopTimer = Math.max(hitStopTimer, isJust ? 6 + effectLevel * 2 : 3 + effectLevel);

    // Particles — Just Guard spawns more and brighter
    const particleCount = isJust ? 12 + effectLevel * 4 : 6 + effectLevel * 2;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = (isJust ? 3.0 : 2.0) + effectLevel * 0.5;
      hitSparks.push({
        x: gpx, y: gpy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 12 + effectLevel * 3, maxLife: 12 + effectLevel * 3,
        color: royalGuardFlashColor,
      });
    }
    // Just Guard: extra sparkle ring
    if (isJust) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        hitSparks.push({
          x: gpx + Math.cos(angle) * 18, y: gpy + Math.sin(angle) * 16,
          vx: Math.cos(angle) * 0.8, vy: Math.sin(angle) * 0.8,
          life: 20, maxLife: 20, color: "#ffffff",
        });
      }
    }

    if (seStrongHit) playSound(seStrongHit, isJust ? 1.0 : 0.7, isJust ? 1.0 : 1.2);
    battleRankGainByStyle("royal_guard", rankPower * rankMul + battleRankDodgeChain * 0.4);
    damageInvulnTimer = Math.max(damageInvulnTimer, isJust ? 30 : 15);
  }
  const ROYAL_GUARD_MAX_ENERGY = 100;
  // --- Drive Charge (charged drive = Overdrive, fires multiple waves) ---
  let driveChargeTimer = 0;
  let driveChargeActive = false;
  let overdriveBurstCount = 0;        // Remaining burst waves
  let overdriveBurstDelay = 0;
  const DRIVE_CHARGE_TIME = 30;       // ~0.5s charge for Overdrive
  const OVERDRIVE_WAVES = 5;
  // --- Round Trip (sword throw) ---
  let roundTripActive = false;
  let roundTripTimer = 0;
  let roundTripX = 0;
  let roundTripY = 0;
  let roundTripVx = 0;
  let roundTripVy = 0;
  let roundTripReturning = false;
  let roundTripHitCooldown = 0;
  const ROUND_TRIP_SPEED = 6.0;
  const ROUND_TRIP_DURATION = 120;      // 2 seconds max flight
  const ROUND_TRIP_TURN_AT = 40;        // Start returning after 40 frames
  // --- Trickster Dodge ---
  let tricksterCooldown = 0;
  const TRICKSTER_COOLDOWN = 30;
  const TRICKSTER_DISTANCE = 60;        // Teleport distance
  // --- Gun Type Switch ---
  let gunType = 0; // 0=handgun, 1=shotgun, 2=grenade
  const GUN_TYPE_NAMES = ["HANDGUN", "SHOTGUN", "GRENADE"];
  let gunSwitchFlashTimer = 0;
  // --- Style Cut-in ---
  let styleCutInTimer = 0;
  let styleCutInName = "";
  let styleCutInColor = "#ffffff";
  const STYLE_CUT_IN_DURATION = 45;  // ~0.75 seconds
  let swordStingerActive = false;
  let swordStingerTimer = 0;
  let stingerCaughtEnemies = []; // Enemies being dragged by stinger
  let millionStabActive = false;
  let millionStabTimer = 0;
  let millionStabHitTimer = 0;
  const MILLION_STAB_DURATION = 45; // ~0.75 seconds of rapid stabbing
  const MILLION_STAB_HIT_INTERVAL = 4; // Hit every 4 frames
  let swordUpperActive = false;
  let swordUpperTimer = 0;
  let swordUpperHangTimer = 0; // 1-second hang time
  let swordSlamActive = false;
  let swordSlamTimer = 0;
  let swordAttackCooldown = 0;
  let swordChargeTimer = 0;
  let swordChargeReadyPlayed = false;
  // Devil Trigger (Style-specific Burst)
  let devilTriggerTimer = 0;
  let devilTriggerDuration = 0;
  let devilTriggerHitCount = 0;
  let devilTriggerResultTimer = 0;
  let devilTriggerStyle = "swordmaster"; // Style that activated DT
  let devilTriggerResultCount = 0;

  // --- Combat Dash/Dodge System ---
  let combatDashTimer = 0;
  let combatDashCooldown = 0;
  let combatDashDir = 1;
  const COMBAT_DASH_DURATION = 16;
  const COMBAT_DASH_SPEED = 8.0;
  const COMBAT_DASH_COOLDOWN = 20;
  const COMBAT_DASH_INVULN = 22;

  // --- Air Combo Tracker ---
  let airComboCount = 0;
  let airComboMaxHits = 6;
  let airComboDisplayTimer = 0;
  let airComboStage = 0; // 0=hit1, 1=hit2, 2=slam (3-stage air combo)
  let airGunHangTime = 8; // Frames of reduced gravity when shooting in air

  // --- Dedicated Gun (always available) ---
  let dedicatedGunCooldown = 0;
  const DEDICATED_GUN_RELOAD = 12;
  let bulletRainTimer = 0;     // Remaining duration (frames)
  let bulletRainCooldown = 0;  // Cooldown after use
  let bulletRainRotation = false; // Upside-down rotation during bullet rain

  // --- Real Impact (Swordmaster ↓↓+J): charge & thrust ---
  let realImpactChargeActive = false;
  let realImpactChargeTimer = 0;
  let realImpactActive = false;
  let realImpactTimer = 0;
  let realImpactDir = 1;
  const REAL_IMPACT_CHARGE_TIME = 50;   // ~0.83s charge
  const REAL_IMPACT_DURATION = 18;      // thrust duration
  const REAL_IMPACT_SPEED = 12.0;       // thrust speed

  // --- Double-tap detectors (for ↓↓ and L→L) ---
  let downTapWindowTimer = 0;           // frames until second down tap is allowed
  let doubleDownPrimedTimer = 0;        // frames the double-down state is active
  let dashTapWindowTimer = 0;           // frames until second L tap is allowed
  let doubleDashPrimedTimer = 0;        // frames the double-dash state is active
  const DOUBLE_TAP_WINDOW = 14;         // max gap between two taps
  const DOUBLE_TAP_PRIMED_WINDOW = 24;  // window after the double-tap to press the finisher

  // --- Simultaneous press detectors (J+K, J+L) ---
  let attackPressRecent = 0;
  let shootPressRecent = 0;
  let dashPressRecent = 0;
  const SIMUL_PRESS_WINDOW = 5;         // frames within which two keys count as simultaneous

  // --- GunStinger (Gunslinger →+K long press) ---
  let gunStingerCharging = false;
  let gunStingerChargeTimer = 0;
  let gunStingerReadyPlayed = false;
  let gunStingerActive = false;
  let gunStingerTimer = 0;
  let gunStingerFireTimer = 0;
  let gunStingerDir = 1;
  const GUN_STINGER_MIN_CHARGE = 22;    // min frames to charge (~0.37s)
  const GUN_STINGER_MAX_CHARGE = 42;    // auto-fire at max
  const GUN_STINGER_DURATION = 32;
  const GUN_STINGER_SPEED = 9.5;
  const GUN_STINGER_FIRE_INTERVAL = 3;

  // --- Doppelganger (Trickster L→L→J) ---
  let doppelgangers = [];
  const DOPPELGANGER_DURATION = 240;    // ~4 seconds
  const DOPPELGANGER_ATTACK_INTERVAL = 22;
  let doppelgangerCooldown = 0;
  const DOPPELGANGER_COOLDOWN = 60;

  // --- Dreadnought (Royal Guard ↓+J) ---
  let dreadnoughtCooldown = 0;
  const DREADNOUGHT_COOLDOWN = 36;

  let hyakuretsuTimer = 0;
  let hyakuretsuHitTimer = 0;
  let hyakuretsuAutoTimer = 0;
  let hyakuretsuLaneTick = 0;
  let attackEffectTimer = 0;
  let attackEffectMode = "none";
  let attackEffectPhase = 0;
  let attackEffectPower = 0;
  let waveFlashTimer = 0;
  let waveFlashPower = 0;
  let waveFlashX = 0;
  let waveFlashY = 0;
  let waveBursts = [];
  let hitSparks = [];
  let invincibleBonusPops = [];
  let deathFlashTimer = 0;
  let deathShakeTimer = 0;
  let deathJumpVy = 0;
  let deathPauseTimer = 0;
  let deathAnimActive = false;
  let deadReason = "";
  let emergencyDodgeActive = false;
  let emergencyDodgeTimer = 0;
  let emergencyDodgeReason = "";
  let emergencyDodgeOptions = {};
  let emergencyDodgeInvulnTimer = 0;
  let emergencyDodgeFlashTimer = 0;
  let emergencyDodgePhase = 0;
  let emergencyDodgeSkipNext = false;

  let voiceBurst1 = null;
  let voiceBurst2 = null;
  let voiceDeath = null;
  let voiceDodge = null;
  // New Audio Buffers
  let seGameOver = null;
  let seBurst2 = null;
  let seBlackFlash = null;
  let seBurst1Max = null;
  let seBurst1Normal = null;
  let seEvasion = null;
  let seEvasionFail = null;
  let seMorningStarTip = null;
  let seShotgun = null;
  let seStageClear = null;
  let seWhipSwing = null;
  let seHandgun = null;
  let seMachineGun = null;
  let seBazooka = null;
  let seStrongHit = null;
  let seReload = null;
  let seMachineGunHeavy = null;
  let seEmpty = null;
  let seNoAmmo = null;
  // New Audio Buffers

  // Master Volume Control (0.0 - 1.0)
  let masterVolume = 0.7;

  let audioCtx = null;
  let bgmMaster = null;
  let bgmNoiseBuffer = null;
  let stageMusic = null;
  let stageMusicPrimed = false;
  let stageMusicFadeTimer = 0;
  let stageMusicFadeDuration = 0;
  let stageMusicFadeStart = 0;
  let stageMusicFadeEnd = 0;
  let bossMusic = null;
  let bossMusicPrimed = false;
  let invincibleMusic = null;
  let invincibleMusicPrimed = false;
  let invincibleMusicFadeTimer = 0;
  let invincibleMusicFadeDuration = 0;
  let openingThemeActive = false;
  let pendingStageResumeAfterInvincible = false;
  let audioUnlockedByUser = false;
  let openingThemeMutedAutoplayTried = false;
  let timeStopSilenceActive = false;
  let timeStopClockTickTimer = 0;
  let timeStopClockTickPhase = 0;
  let rilaVoiceNextAt = 0;
  let enemyDefeatSeNextAt = 0;
  let uiSeNextAt = 0;
  let parrySeNextAt = 0;
  let jumpSeNextAt = 0;
  let landSeNextAt = 0;
  let shootSeNextAt = 0;
  let waveSeNextAt = 0;
  let waveReadySeNextAt = 0;
  let invincibleExtendSeNextAt = 0;
  let rankUpSeNextAt = 0;
  let robotVoiceCurve = null;
  let bgmStarted = false;

  const BGM_TEMPO = 146;
  const BGM_LEAD = [
    76, 79, 81, 83, 81, 79, 76, 74,
    72, 74, 76, 79, 76, 74, 72, 71,
    72, 74, 76, 79, 81, 79, 76, 74,
    72, 74, 71, 69, 71, 74, 72, 0,
  ];
  const BGM_BASS = [
    48, 0, 48, 0, 43, 0, 43, 0,
    45, 0, 45, 0, 41, 0, 41, 0,
    48, 0, 48, 0, 43, 0, 43, 0,
    45, 0, 45, 0, 41, 0, 41, 0,
  ];
  const BGM_NORMAL_VOL = 0.38;
  const BGM_DEAD_VOL = 0.14;
  const BOSS_BGM_VOL = 0.41;
  const INVINCIBLE_BGM_VOL = 0.44;
  const CLEAR_BGM_VOL = 0.4;
  const SE_GAIN_BOOST = 1.86;
  const PROTEIN_LIFE_UP_STEP = 45;
  const PINCH_ATTACK_BONUS_MAX = 0.7;
  const BLACK_FLASH_CHANCES = [0.08, 0.5, 0.6, 0.7, 0.8, 0.9];
  const BLACK_FLASH_LOW_CHANCE_RANK_BONUS_MAX = 0.04;
  const BLACK_FLASH_BURST_GAIN_MUL = 1.3;
  const BLACK_FLASH_DAMAGE_MUL = 1.3;
  const BLACK_FLASH_RANK_GAIN_MUL = 1.3;
  const BLACK_FLASH_SLOW_DURATION = 20;
  const BLACK_FLASH_SLOW_SCALE = 0.28;
  const BLACK_FLASH_ENEMY_SLOW_SCALE = 0.84;
  const BLACK_FLASH_HIGHMODE_ENEMY_SLOW_SCALE = 0.92;
  const MORNINGSTAR_TIP_BLACKFLASH_DOUBLE_HP_RATIO = 0.49;
  const MORNINGSTAR_TIP_BLACKFLASH_CHANCE_MUL = 2;
  const BOSS_HIT_INVULN_FRAMES = 60;
  const BLACK_FLASH_RESULT_DURATION = 120;
  const POLE_BREAK_MIN_RANK_INDEX = 3;
  const BATTLE_RANK_GAIN_MULT = 1.0; // Reduced from 1.8 — rank is harder to gain
  const BATTLE_RANK_DATA = [
    { short: "Danger", long: "Danger", threshold: 0, chargeMul: 0.7, color: "#8db2d9" },
    { short: "Badass", long: "Badass", threshold: 120, chargeMul: 0.9, color: "#79d9ff" },
    { short: "Apoc", long: "Apocalyptic", threshold: 280, chargeMul: 1.18, color: "#96f0b2" },
    { short: "Savege", long: "Savege", threshold: 520, chargeMul: 1.56, color: "#ffd47d" },
    { short: "SS", long: "SS sick style", threshold: 820, chargeMul: 2.08, color: "#ffa27e" },
    { short: "SSS", long: "SSS special sexy style", threshold: 1220, chargeMul: 2.88, color: "#ff5f73" },
    { short: "EX", long: "Extra Xenoid", threshold: 2140, chargeMul: 3.24, color: "#ffe489" },
  ];
  const BATTLE_RANK_SSS_INDEX = (() => {
    const idx = BATTLE_RANK_DATA.findIndex((rank) => rank.short === "SSS");
    return idx >= 0 ? idx : Math.max(0, BATTLE_RANK_DATA.length - 1);
  })();
  const BATTLE_RANK_EX_INDEX = (() => {
    const idx = BATTLE_RANK_DATA.findIndex((rank) => rank.short === "EX");
    return idx >= 0 ? idx : BATTLE_RANK_SSS_INDEX;
  })();
  const INVINCIBLE_DURATION = 600;
  const INVINCIBLE_KILL_EXTEND_FRAMES = 60;
  const INVINCIBLE_BONUS_POP_LIFE = 44;
  const INVINCIBLE_BGM_FADE_SEC = 1.2;
  const STAGE_BGM_PATH = "assets/stage_bgm.mp3";
  const BOSS_BGM_PATH = "assets/boss_bgm.mp3";
  const INVINCIBLE_BGM_PATH = "assets/invincible_bgm.mp3";
  const VOICE_BURST1_PATH = "assets/「覚悟しなさい！」.mp3";
  const VOICE_BURST2_PATH = "assets/「スキあり！」.mp3";
  const VOICE_DEATH_PATH = "assets/「きゃああーー！」.mp3";
  const VOICE_DODGE_PATH = "assets/「危ない！」.mp3";
  // New Audio Paths
  const SE_GAME_OVER_PATH = "assets/K.O..mp3";
  const SE_BURST2_PATH = "assets/制限時間タイマー.mp3"; // Burst 2
  const SE_BLACK_FLASH_PATH = "assets/K.O..mp3";
  const SE_BURST1_MAX_PATH = "assets/オーラ1.mp3";
  const SE_BURST1_NORMAL_PATH = "assets/火炎魔法2.mp3";
  const SE_EVASION_PATH = "assets/鞭を振り回す2.mp3";
  const SE_EVASION_FAIL_PATH = "assets/ロボットを強く殴る3.mp3";
  const SE_MORNING_STAR_TIP_PATH = "assets/ロボットを強く殴る3.mp3";
  const SE_SHOTGUN_PATH = "assets/ショットガン発射.mp3";
  const SE_STAGE_CLEAR_PATH = "assets/「スキあり！」.mp3";
  const SE_WHIP_SWING_PATH = "assets/鞭を振り回す2.mp3";
  // Ranged Weapon Audio
  const SE_HANDGUN_PATH = "assets/拳銃を撃つ.mp3";
  const SE_MACHINEGUN_PATH = "assets/サブマシンガン発射1.mp3";
  const SE_BAZOOKA_PATH = "assets/大砲2.mp3";
  const SE_STRONG_HIT_PATH = "assets/ロボットを強く殴る3.mp3";
  // New SE Paths (User requested)
  const SE_MACHINEGUN_HEAVY_PATH = "assets/重機関銃を乱射1.mp3";
  const SE_EMPTY_PATH = "assets/拳銃の弾切れ.mp3";
  const SE_RELOAD_PATH = "assets/shotgun_pump_simulated"; // Logic handled via pitch mod
  const SE_NO_AMMO_PATH = "assets/nc371030.mp3";

  const VOICE_VOL = 0.7;

  const EMERGENCY_DODGE_WINDOW = 120;
  const EMERGENCY_DODGE_SLOWMO_SCALE = 0.08;
  const EMERGENCY_DODGE_INVULN_DURATION = 120;
  const EMERGENCY_DODGE_CHANCE = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65];
  let emergencyDodgeCounterTimer = 0; // Post-dodge attack bonus window
  const SHOT_CHARGE_MAX = 120;
  const SHOT_TIER2_THRESHOLD = 60; // Medium charge (Shotgun)
  const SHOT_TIER1_THRESHOLD = 20; // Small charge (Machinegun)
  const WEAPON_DURATION = 600;

  // Swordmaster Constants
  const SWORD_CHARGE_MAX = 132;
  const SWORD_STINGER_THRESHOLD = 30;     // Small charge -> Stinger
  const SWORD_UPPER_THRESHOLD = 70;       // Medium charge -> Upper
  const SWORD_SLAM_THRESHOLD = 132;       // Max charge -> Slam
  const SWORD_COMBO_WINDOW = 28;          // Frames to chain combo
  const SWORD_COMBO_REACH = [22, 26, 32]; // Reach per combo stage
  const SWORD_COMBO_POWER = [1.0, 1.2, 1.8]; // Base power per stage
  const SWORD_STINGER_DURATION = 14;
  const SWORD_STINGER_SPEED = 5.5;
  const SWORD_UPPER_DURATION = 12;
  const SWORD_UPPER_HANG_TIME = 30;       // ~0.5 second hang time for air combos
  const SWORD_SLAM_DURATION = 18;
  const SWORD_SLAM_REACH = 38;
  const SWORD_SLAM_HEIGHT = 40;
  const DEVIL_TRIGGER_MAX_SEC = 6;
  const DEVIL_TRIGGER_MIN_SEC = 3;
  const PROTEIN_BURST_REQUIRE = 18;
  const PROTEIN_BURST_MIN = Math.ceil(PROTEIN_BURST_REQUIRE * 0.5);
  const PROTEIN_BURST_GAIN_PROTEIN = 0.6;
  const PROTEIN_BURST_GAIN_DEFEAT_BASE = 0.18;
  const PROTEIN_BURST1_GAIN_MUL = 0.82;
  const PROTEIN_BURST2_GAIN_MUL = 0.78;
  const PROTEIN_BURST_MODE_LASER = "laser";
  const PROTEIN_BURST_MODE_METEOR = "meteor";
  const PROTEIN_BURST_DURATION = 98;
  const PROTEIN_BURST_METEOR_DURATION = 82;
  const PROTEIN_BURST_BLAST_AT = 0.38;
  const PROTEIN_BURST_TOP_Y = 30;
  const PROTEIN_BURST_LASER_DURATION = 56;
  const PROTEIN_BURST_METEOR_COUNT_MIN = 4;
  const PROTEIN_BURST_METEOR_COUNT_MAX = 9;
  const TIME_BURST_MODE_NONE = "none";
  const TIME_BURST_MODE_SLOW = "slow";
  const TIME_BURST_MODE_STOP = "stop";
  const TIME_BURST_SLOW_MIN_DURATION = 60;
  const TIME_BURST_SLOW_MAX_DURATION = 240;
  const TIME_BURST_STOP_DURATION = 300;
  const TIME_BURST_SLOW_SCALE_MIN = 0.22;
  const TIME_BURST_SLOW_SCALE_MAX = 0.45;
  const TIME_BURST_RANK_GAIN_SLOW_MUL = 1.35;
  const TIME_BURST_RANK_GAIN_STOP_MUL = 1.7;
  const TIME_STOP_CLOCK_TICK_INTERVAL = 30;
  const OPENING_CUTSCENE_DURATION = 940;
  const STAGE_INTRO_CUTSCENE_DURATION = 340;
  const PRE_BOSS_CUTSCENE_DURATION = 460;
  const PRE_BOSS_ENTRY_DURATION = 78;
  const PRE_BOSS_MOVIE_START_AT = 230;
  const GOD_PHASE_CUTSCENE_DURATION = 210;
  const GOD_PHASE_CUTSCENE_SKIP_MIN = 24;
  const PEACOCK_BOSS_HP = 14;
  const PEACOCK_HUMAN_BOSS_HP = 18;
  const GOD_BOSS_PHASE1_HP = 23;
  const GOD_BOSS_PHASE2_HP = 31;
  const GOD_BOSS_SHOT_DENSITY_MUL = 1.28;
  const CANNON_BULLET_SPEED = 1.3;
  const CANNON_WARN_WINDOW = 24;
  const CANNON_EXTRA_COOLDOWN = 26;
  const ROUTE_ENEMY_DT_MUL = 1.08;
  const ROUTE_PROJECTILE_SPEED_MUL = 1.07;
  const ROUTE_CANNON_RATE_MUL = 1.12;
  const DASH_JUMP_MIN_SPEED = 1.2;
  const DASH_JUMP_VX_BONUS = 0.88;
  const DASH_JUMP_VY_BONUS = 0.46;
  const DASH_JUMP_ASSIST_FRAMES = 20;
  const DASH_JUMP_SPEED_CAP_MULT = 1.45;
  const DASH_JUMP_GRAVITY_MULT = 0.84;
  const ATTACK_CHARGE_MAX = 132;
  const ATTACK2_CHARGE_MAX = 110;
  const ATTACK2_BREAK_CHARGE_MIN = ATTACK2_CHARGE_MAX * 0.58;
  const ATTACK2_COOLDOWN = 26;
  const ATTACK2_COOLDOWN_CHARGED = 40;
  const HAMMER_SHARD_LIFE = 48;
  const ATTACK_WAVE_CHARGE_MIN = ATTACK_CHARGE_MAX;
  const ATTACK_MORNINGSTAR_CHARGE_MIN = ATTACK_CHARGE_MAX * 0.5;
  const ATTACK_MORNINGSTAR_LONG_MIN = ATTACK_CHARGE_MAX * 0.6;
  const ATTACK_COMBO_TAP_MAX = 14;
  const ATTACK_MORNINGSTAR_SPIN_MIN = ATTACK_COMBO_TAP_MAX + 2;
  const ATTACK_PUNCH_COOLDOWN = 10;
  const ATTACK_WAVE_COOLDOWN = 28;
  const ATTACK_MASH_WINDOW = 42;
  const ATTACK_MASH_TRIGGER = 4;
  const HYAKURETSU_DURATION = 60;
  const HYAKURETSU_COMBO_AUTO_DURATION = 60;
  const HYAKURETSU_HIT_INTERVAL = 2;
  const HYAKURETSU_POST_COOLDOWN = 10;
  const HYAKURETSU_FINISHER_CHARGE_RATIO = 0.94;
  const HYAKURETSU_FINISHER_POWER_MUL = 1.34;
  const HYAKURETSU_FINISHER_BOSS_MUL = 1.26;
  const HYAKURETSU_SHORYU_RISE_VY = 5.2;
  const HYAKURETSU_SHORYU_RISE_VY_BONUS = 1.1;
  const HYAKURETSU_SHORYU_FORWARD_BOOST = 0.46;
  const STOMP_VERTICAL_GRACE = 16;
  const STOMP_SIDE_GRACE = 6;
  const STOMP_DESCEND_MIN = -0.25;
  const STOMP_CHAIN_GUARD_FRAMES = 16;

  function proteinLevel() {
    return collectedProteinIds.size;
  }

  function powerFactor() {
    return 1;
  }

  function getBossEntities(includeDown = false) {
    if (!stage || !stage.boss || !stage.boss.active) return [];
    const bosses = [stage.boss];
    if (stage.bossTwins && stage.bossTwins.length > 0) {
      bosses.push(...stage.bossTwins);
    }
    if (includeDown) return bosses;
    return bosses.filter((b) => b && b.active && b.hp > 0);
  }

  function bossTotalHealth() {
    const bosses = getBossEntities(true);
    let hp = 0;
    let maxHp = 0;
    for (const b of bosses) {
      if (!b) continue;
      hp += Math.max(0, b.hp || 0);
      maxHp += Math.max(1, b.maxHp || 1);
    }
    return { hp, maxHp: Math.max(1, maxHp) };
  }

  function pinchRatioByHearts() {
    return clamp((MAX_HEARTS - playerHearts) / Math.max(1, MAX_HEARTS - 1), 0, 1);
  }

  function pinchAttackMultiplier() {
    return 1 + pinchRatioByHearts() * PINCH_ATTACK_BONUS_MAX;
  }

  function burstChargeTone(ratio = 0) {
    const r = clamp(ratio, 0, 1);
    const readyRatio = PROTEIN_BURST_MIN / Math.max(1, PROTEIN_BURST_REQUIRE);
    const t = r < readyRatio
      ? (r / Math.max(0.0001, readyRatio)) * 0.55
      : 0.55 + ((r - readyRatio) / Math.max(0.0001, 1 - readyRatio)) * 0.45;
    const hue = 212 - t * 170;
    const sat = 44 + t * 52;
    const light = 48 + t * 20;
    return { hue, sat, light };
  }

  function addProteinBurstGauge(amount) {
    if (proteinBurstTimer > 0) return 0;
    const baseAdd = Math.max(0, amount || 0);
    const add = baseAdd * (isBlackFlashHighMode() ? BLACK_FLASH_BURST_GAIN_MUL : 1);
    if (add <= 0) return 0;
    const before1 = proteinBurstGauge1;
    const before2 = proteinBurstGauge2;
    proteinBurstGauge1 = clamp(proteinBurstGauge1 + add * PROTEIN_BURST1_GAIN_MUL, 0, PROTEIN_BURST_REQUIRE);
    proteinBurstGauge2 = clamp(proteinBurstGauge2 + add * PROTEIN_BURST2_GAIN_MUL, 0, PROTEIN_BURST_REQUIRE);
    return (proteinBurstGauge1 - before1) + (proteinBurstGauge2 - before2);
  }

  function isTimeBurstActive() {
    return timeBurstTimer > 0 && (timeBurstMode === TIME_BURST_MODE_SLOW || timeBurstMode === TIME_BURST_MODE_STOP);
  }

  function isTimeBurstStopActive() {
    return isTimeBurstActive() && timeBurstMode === TIME_BURST_MODE_STOP;
  }

  function resetTimeBurstState() {
    timeBurstTimer = 0;
    timeBurstDuration = 0;
    timeBurstMode = TIME_BURST_MODE_NONE;
    timeBurstSlowScale = 1;
    timeBurstPhase = 0;
    timeBurstStopDeadlineMs = 0;
    timeStopClockTickTimer = 0;
    timeStopClockTickPhase = 0;
  }

  function timeBurstRankGainMultiplier() {
    if (!isTimeBurstActive()) return 1;
    return timeBurstMode === TIME_BURST_MODE_STOP
      ? TIME_BURST_RANK_GAIN_STOP_MUL
      : TIME_BURST_RANK_GAIN_SLOW_MUL;
  }

  function proteinBurstGainFromDefeat(power = 1) {
    const p = clamp(power, 0.8, 5.4);
    const rankMul = 1 + battleRankIndex * 0.14;
    const powerBonus = Math.max(0, p - 1) * 0.05;
    return (PROTEIN_BURST_GAIN_DEFEAT_BASE + powerBonus) * rankMul;
  }

  function blackFlashChanceWithRank(stageIndex = blackFlashChain) {
    const idx = clamp(stageIndex, 0, BLACK_FLASH_CHANCES.length - 1);
    const baseChance = BLACK_FLASH_CHANCES[idx];
    if (baseChance >= 0.5) {
      return clamp(baseChance, 0.01, 0.98);
    }
    const rankRatio = battleRankCoreTierRatio();
    const rankBonus = BLACK_FLASH_LOW_CHANCE_RANK_BONUS_MAX * rankRatio;
    return clamp(baseChance + rankBonus, 0.01, 0.98);
  }

  function isBlackFlashHighMode() {
    return blackFlashChain > 0;
  }

  function blackFlashRankGainMultiplier() {
    const flashMul = isBlackFlashHighMode() ? BLACK_FLASH_RANK_GAIN_MUL : 1;
    return flashMul * timeBurstRankGainMultiplier();
  }

  function formatBlackFlashChanceText(chance) {
    return `黒閃継続率 ${(chance * 100).toFixed(1)}%`;
  }

  function blackFlashChanceHudColor(chance) {
    const c = clamp(chance, 0.01, 0.98);
    if (c >= 0.9) {
      return { text: "rgba(246, 218, 255, 0.98)", barRgb: "195, 125, 255" };
    }
    if (c >= 0.8) {
      return { text: "rgba(255, 207, 224, 0.98)", barRgb: "255, 110, 156" };
    }
    if (c >= 0.7) {
      return { text: "rgba(255, 220, 174, 0.98)", barRgb: "255, 154, 94" };
    }
    if (c >= 0.6) {
      return { text: "rgba(255, 242, 176, 0.98)", barRgb: "255, 198, 108" };
    }
    if (c >= 0.5) {
      return { text: "rgba(205, 255, 219, 0.98)", barRgb: "104, 230, 144" };
    }
    return { text: "rgba(198, 239, 255, 0.98)", barRgb: "106, 198, 255" };
  }

  function resolveBlackFlashAttempt(forcedChance = null) {
    const hadHighMode = isBlackFlashHighMode();
    const stageIndex = clamp(blackFlashChain, 0, BLACK_FLASH_CHANCES.length - 1);
    const chance = typeof forcedChance === "number"
      ? clamp(forcedChance, 0.01, 0.98)
      : blackFlashChanceWithRank(stageIndex);
    const triggered = Math.random() < chance;
    if (triggered) {
      if (!hadHighMode) {
        blackFlashSessionHits = 0;
      }
      blackFlashSessionHits += 1;
      blackFlashResultTimer = 0;
      blackFlashResultText = "";
      blackFlashChain = Math.min(blackFlashChain + 1, BLACK_FLASH_CHANCES.length - 1);
    } else {
      // On miss, reset the continuation chain back to the initial chance tier.
      blackFlashChain = 0;
      if (hadHighMode) {
        const total = Math.max(0, blackFlashSessionHits);
        if (total >= 3) {
          blackFlashResultText = `黒閃合計 ${total}発`;
          blackFlashResultTimer = BLACK_FLASH_RESULT_DURATION;
        } else {
          blackFlashResultText = "";
          blackFlashResultTimer = 0;
        }
      }
      blackFlashSessionHits = 0;
      // Also clear any remaining Black Flash benefits so gameplay returns to normal immediately.
      blackFlashTimer = 0;
      blackFlashPower = 0;
      blackFlashSlowTimer = 0;
      if (hadHighMode && (gameState === STATE.PLAY || gameState === STATE.BOSS)) {
        hudMessage = "黒閃高確終了";
        hudTimer = Math.max(hudTimer, 28);
      }
    }
    return triggered;
  }

  function rollBlackFlashHit(x, y, power = 1, chanceMul = 1) {
    const chance = clamp(
      blackFlashChanceWithRank() * clamp(chanceMul, 0.25, 3),
      0.01,
      0.98
    );
    const triggered = resolveBlackFlashAttempt(chance);
    const highMode = isBlackFlashHighMode();
    blackFlashChanceHudText = formatBlackFlashChanceText(blackFlashChanceWithRank());
    blackFlashChanceHudTimer = highMode ? 180 : 0;
    if (triggered) {
      triggerBlackFlashEffect(x, y, power);
      blackFlashChanceHudTimer = 180;
      // Rank Up on Black Flash
      battleRankIndex = clamp(battleRankIndex + 1, 0, BATTLE_RANK_DATA.length - 1);
      battleRankGauge = BATTLE_RANK_DATA[battleRankIndex].threshold;
      // Play Black Flash Audio
      playSound(seBlackFlash, 1.0);
    }
    return triggered;
  }

  function resetBlackFlashState(keepChain = false) {
    if (!keepChain) {
      blackFlashChain = 0;
      blackFlashSessionHits = 0;
    }
    blackFlashTimer = 0;
    blackFlashPower = 0;
    blackFlashSlowTimer = 0;
    blackFlashChanceHudTimer = 0;
    blackFlashChanceHudText = keepChain && blackFlashChain > 0
      ? formatBlackFlashChanceText(blackFlashChanceWithRank())
      : "";
    blackFlashResultTimer = 0;
    blackFlashResultText = "";
  }

  function updateBattleRankTier() {
    let next = 0;
    for (let i = 0; i < BATTLE_RANK_DATA.length; i += 1) {
      if (battleRankGauge >= BATTLE_RANK_DATA[i].threshold) {
        next = i;
      } else {
        break;
      }
    }
    battleRankIndex = next;
  }

  function currentBattleRank() {
    return BATTLE_RANK_DATA[clamp(battleRankIndex, 0, BATTLE_RANK_DATA.length - 1)];
  }

  function battleRankCoreTierRatio(rankIdx = battleRankIndex) {
    const coreMax = Math.max(1, BATTLE_RANK_SSS_INDEX);
    return clamp(rankIdx / coreMax, 0, 1);
  }

  function isExBattleRankActive() {
    return BATTLE_RANK_EX_INDEX > BATTLE_RANK_SSS_INDEX && battleRankIndex >= BATTLE_RANK_EX_INDEX;
  }

  function battleRankExProgress() {
    if (!isExBattleRankActive()) return 0;
    const exRank = BATTLE_RANK_DATA[BATTLE_RANK_EX_INDEX];
    return clamp((battleRankGauge - exRank.threshold) / 360, 0, 1);
  }

  function battleRankChargeMultiplier() {
    const base = currentBattleRank().chargeMul;
    const tierRatio = battleRankCoreTierRatio();
    const progressBoost = battleRankProgressRatio();
    const tierBoostMul = 1 + Math.pow(tierRatio, 1.2) * 0.22;
    const flowBoostMul = 1 + progressBoost * (0.06 + tierRatio * 0.18);
    const lowRankPenalty = battleRankIndex <= 0 ? 0.92 : 1;
    const exProgress = battleRankExProgress();
    const exBoostMul = isExBattleRankActive() ? 1.06 + exProgress * 0.06 : 1;
    return base * tierBoostMul * flowBoostMul * lowRankPenalty * exBoostMul;
  }

  function battleRankAttackBoost() {
    const tierRatio = battleRankCoreTierRatio();
    const flowRatio = battleRankProgressRatio();
    const blend = clamp(tierRatio * 0.74 + flowRatio * 0.26, 0, 1);
    const exProgress = battleRankExProgress();
    const exRangeBonus = isExBattleRankActive() ? 0.04 + exProgress * 0.02 : 0;
    const exPowerBonus = isExBattleRankActive() ? 0.05 + exProgress * 0.03 : 0;
    const exKnockBonus = isExBattleRankActive() ? 0.04 + exProgress * 0.03 : 0;
    const exGimmickBonus = isExBattleRankActive() ? 0.06 + exProgress * 0.04 : 0;
    const exEffectBonus = isExBattleRankActive() ? 0.56 + exProgress * 0.24 : 0;
    return {
      blend,
      rangeMul: 1 + blend * 0.34 + exRangeBonus,
      powerMul: 1 + blend * 0.28 + exPowerBonus,
      knockMul: 1 + blend * 0.24 + exKnockBonus,
      gimmickMul: 1 + blend * 0.34 + exGimmickBonus,
      effectMul: 1 + blend * 0.64 + exEffectBonus,
    };
  }

  function battleRankProgressRatio() {
    const idx = clamp(battleRankIndex, 0, BATTLE_RANK_DATA.length - 1);
    const curr = BATTLE_RANK_DATA[idx];
    if (idx >= BATTLE_RANK_DATA.length - 1) return 1;
    const next = BATTLE_RANK_DATA[idx + 1];
    const span = Math.max(1, next.threshold - curr.threshold);
    return clamp((battleRankGauge - curr.threshold) / span, 0, 1);
  }

  // Style-specific signature moves — no spam penalty for your current style's moves
  const STYLE_SIGNATURE_MOVES = {
    swordmaster: ["prop_shredder", "overdrive", "drive", "air_slash"],
    trickster: ["trickster", "air_trick", "dodge_success"],
    gunslinger: ["twosome_time", "bullet_rain", "gun_handgun", "gun_shotgun", "gun_grenade"],
    royalguard: ["royal_guard", "royal_release"],
  };

  function battleRankGainByStyle(styleKey, power = 1) {
    const style = styleKey || "impact";
    const p = clamp(power, 0.8, 4.8);
    // Base gain reduced — raw hits give less; variety gives more
    let gain = 12 + p * 4.0;

    // Check if this is a signature move for the current style — exempt from spam penalty
    const sigMoves = STYLE_SIGNATURE_MOVES[playerStyle] || [];
    const isSignature = sigMoves.includes(style);

    const sameStyle = style === battleRankLastStyle;
    if (sameStyle && !isSignature) {
      battleRankStyleStreak += 1;
      // Heavy penalty for spamming the same move
      gain *= Math.max(0.2, 0.75 - battleRankStyleStreak * 0.15);
      battleRankComboVariety = Math.max(0, battleRankComboVariety - 1);
    } else if (sameStyle && isSignature) {
      // Signature moves: mild diminishing returns instead of penalty
      battleRankStyleStreak += 1;
      gain *= Math.max(0.6, 1.0 - battleRankStyleStreak * 0.05);
    } else {
      const seenRecent = battleRankRecentStyles.includes(style);
      battleRankStyleStreak = 0;
      if (!seenRecent) {
        // Brand new move in the window — BIG bonus
        battleRankComboVariety++;
        const varietyMul = 1.5 + battleRankComboVariety * 0.25;
        gain *= Math.min(3.5, varietyMul);
      } else {
        // Seen recently but not spammed — moderate bonus
        gain *= 1.2;
      }
    }

    // Count unique styles in recent window
    const uniqueSet = new Set(battleRankRecentStyles);
    battleRankUniqueCount = uniqueSet.size;
    // Diversity bonus: more unique moves = higher multiplier
    if (battleRankUniqueCount >= 5) gain *= 1.6;       // 5+ unique moves
    else if (battleRankUniqueCount >= 4) gain *= 1.35;  // 4 unique
    else if (battleRankUniqueCount >= 3) gain *= 1.15;  // 3 unique

    // Category mixing bonus (sword + gun + dodge = extra)
    const categories = new Set();
    for (const s of battleRankRecentStyles) {
      if (s.startsWith("gun_") || s === "bullet_rain" || s === "gun_handgun" || s === "gun_shotgun" || s === "gun_grenade") categories.add("gun");
      else if (s === "trickster" || s === "emergency_dodge" || s === "royal_guard" || s === "dodge_success") categories.add("dodge");
      else categories.add("melee");
    }
    if (categories.size >= 3) gain *= 1.4;  // Using all 3 categories
    else if (categories.size >= 2) gain *= 1.15;

    // Dodge chain bonus
    if (battleRankDodgeChain > 0) {
      gain *= 1 + battleRankDodgeChain * 0.1;
    }

    battleRankLastStyle = style;
    battleRankRecentStyles.push(style);
    if (battleRankRecentStyles.length > 8) {
      battleRankRecentStyles.shift();
    }

    if (style.includes("morning") && style.includes("tip")) {
      gain *= 1.3;
    }

    const highRankDamp = 1 - battleRankIndex * 0.03;
    gain *= Math.max(0.8, highRankDamp);
    gain *= BATTLE_RANK_GAIN_MULT;
    gain *= blackFlashRankGainMultiplier();
    if (tauntBonusTimer > 0) gain *= TAUNT_RANK_MULTIPLIER;
    return Math.max(6, gain);
  }

  function rescaleRankDrivenState(prevChargeMul, nextChargeMul) {
    if (!Number.isFinite(prevChargeMul) || !Number.isFinite(nextChargeMul) || prevChargeMul <= 0 || nextChargeMul <= 0) {
      return;
    }
    const ratio = clamp(nextChargeMul / prevChargeMul, 0.22, 1.4);
    attackChargeTimer = clamp((attackChargeTimer || 0) * ratio, 0, ATTACK_CHARGE_MAX);
    attack2ChargeTimer = clamp((attack2ChargeTimer || 0) * ratio, 0, ATTACK2_CHARGE_MAX);
    if (ratio < 1 && player) {
      // Drop current run momentum a little so speed buff doesn't linger after rank-down.
      player.vx *= clamp(0.7 + ratio * 0.3, 0.72, 1);
    }
  }

  function resetBattleRank(showBreak = false) {
    battleRankDefeats = 0;
    battleRankGauge = 0;
    battleRankIndex = 0;
    battleRankLastStyle = "";
    battleRankStyleStreak = 0;
    battleRankRecentStyles = [];
    battleRankUniqueCount = 0;
    battleRankComboVariety = 0;
    battleRankDodgeChain = 0;
    battleRankFlashTimer = 0;
    battleRankBreakFlashTimer = showBreak ? 30 : 0;

    // Full reset: clear any rank-driven combat momentum so no buff lingers after death/continue.
    attackChargeTimer = 0;
    attack2ChargeTimer = 0;
    attackMaxHoldTimer = 0;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    resetSwordmasterState();
    attackEffectTimer = 0;
    attackEffectPhase = 0;
    attackEffectMode = "none";
    attackEffectPower = 0;
    waveFlashTimer = 0;
    waveFlashPower = 0;
    if (player) {
      player.vx = 0;
    }
  }

  function dropBattleRankOnDamage(showBreak = true) {
    const prevChargeMul = battleRankChargeMultiplier();
    const maxIndex = BATTLE_RANK_DATA.length - 1;
    const currIndex = clamp(battleRankIndex, 0, maxIndex);
    // Always drop exactly 2 ranks on damage (not full reset)
    const dropSteps = 2;
    const nextIndex = Math.max(0, currIndex - dropSteps);

    battleRankIndex = nextIndex;
    battleRankGauge = BATTLE_RANK_DATA[nextIndex].threshold;
    battleRankDefeats = Math.max(0, battleRankDefeats - dropSteps);
    battleRankLastStyle = "";
    battleRankStyleStreak = 0;
    battleRankRecentStyles = [];
    battleRankUniqueCount = 0;
    battleRankComboVariety = 0;
    battleRankDodgeChain = 0;
    battleRankFlashTimer = 0;
    if (showBreak) {
      battleRankBreakFlashTimer = Math.max(battleRankBreakFlashTimer, 30);
    }
    const nextChargeMul = battleRankChargeMultiplier();
    rescaleRankDrivenState(prevChargeMul, nextChargeMul);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function seLevel(v) {
    if (timeStopSilenceActive) return 0.0001;
    return Math.max(0.0001, v * SE_GAIN_BOOST);
  }

  function overlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function createPlayer(x, y) {
    return {
      x,
      y,
      w: 14,
      h: 24,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      anim: 0,
    };
  }

  function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function buildNoiseBuffer() {
    if (!audioCtx) return null;
    const length = Math.floor(audioCtx.sampleRate * 0.08);
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const fade = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    return buffer;
  }

  function ensureStageMusic() {
    if (stageMusic) return;
    stageMusic = new Audio(STAGE_BGM_PATH);
    stageMusic.loop = true;
    stageMusic.volume = BGM_NORMAL_VOL;
    stageMusic.preload = "auto";
  }

  function ensureBossMusic() {
    if (bossMusic) return;
    bossMusic = new Audio(BOSS_BGM_PATH);
    bossMusic.loop = true;
    bossMusic.volume = BOSS_BGM_VOL;
    bossMusic.preload = "auto";
  }

  function startStageMusic(fromStart = false) {
    ensureStageMusic();
    if (!stageMusic) return;
    stageMusicFadeTimer = 0;
    stageMusicFadeDuration = 0;
    try {
      if (fromStart) {
        stageMusic.currentTime = 0;
      }
      stageMusic.volume = clamp(stageMusic.volume || BGM_NORMAL_VOL, 0, 1);
      stageMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function stopStageMusic(resetToStart = false) {
    if (!stageMusic) return;
    stageMusicFadeTimer = 0;
    stageMusicFadeDuration = 0;
    try {
      stageMusic.pause();
      if (resetToStart) {
        stageMusic.currentTime = 0;
      }
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function startBossMusic(fromStart = false) {
    ensureBossMusic();
    if (!bossMusic) return;
    try {
      if (fromStart) {
        bossMusic.currentTime = 0;
      }
      bossMusic.volume = clamp(bossMusic.volume || BOSS_BGM_VOL, 0, 1);
      bossMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function stopBossMusic(resetToStart = false) {
    if (!bossMusic) return;
    try {
      bossMusic.pause();
      if (resetToStart) {
        bossMusic.currentTime = 0;
      }
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function setMusicRate(media, targetRate, dt = 1) {
    if (!media) return;
    const safeTarget = clamp(targetRate, 0.85, 1.35);
    const blend = clamp(dt * 0.08, 0.03, 0.4);
    try {
      const current = typeof media.playbackRate === "number" ? media.playbackRate : 1;
      const next = current + (safeTarget - current) * blend;
      media.playbackRate = next;
      if ("defaultPlaybackRate" in media) media.defaultPlaybackRate = next;
      if ("preservesPitch" in media) media.preservesPitch = false;
      if ("webkitPreservesPitch" in media) media.webkitPreservesPitch = false;
      if ("mozPreservesPitch" in media) media.mozPreservesPitch = false;
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function updatePinchBgmTension(dt) {
    const stageActive = gameState === STATE.PLAY && invincibleTimer <= 0 && !openingThemeActive;
    const bossActive = gameState === STATE.BOSS && invincibleTimer <= 0 && !openingThemeActive;

    setMusicRate(stageMusic, 1, dt);
    setMusicRate(bossMusic, 1, dt);

    if (stageActive && stageMusic && stageMusic.paused) {
      try {
        stageMusic.play().catch(() => { });
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
    }

    if (bossActive && bossMusic && bossMusic.paused) {
      try {
        bossMusic.play().catch(() => { });
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
    }
  }

  function setBgmVolume(target, fadeSec = 0.08) {
    ensureStageMusic();
    if (!stageMusic) return;

    const safeTarget = clamp(target, 0, 1);
    if (fadeSec <= 0.01) {
      stageMusicFadeTimer = 0;
      stageMusicFadeDuration = 0;
      try {
        stageMusic.volume = clamp(safeTarget * masterVolume, 0, 1);
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
      return;
    }

    stageMusicFadeStart = clamp((stageMusic.volume || 0) / Math.max(0.01, masterVolume), 0, 1);
    stageMusicFadeEnd = safeTarget;
    stageMusicFadeDuration = Math.max(1, Math.round(fadeSec * 60));
    stageMusicFadeTimer = stageMusicFadeDuration;
  }

  function updateStageMusicFade(dt) {
    if (!stageMusic || stageMusicFadeTimer <= 0 || stageMusicFadeDuration <= 0) return;
    stageMusicFadeTimer = Math.max(0, stageMusicFadeTimer - dt);
    const t = 1 - stageMusicFadeTimer / stageMusicFadeDuration;
    const vol = stageMusicFadeStart + (stageMusicFadeEnd - stageMusicFadeStart) * clamp(t, 0, 1);
    try {
      stageMusic.volume = clamp(vol * masterVolume, 0, 1);
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function ensureInvincibleMusic() {
    if (invincibleMusic) return;
    invincibleMusic = new Audio(INVINCIBLE_BGM_PATH);
    invincibleMusic.loop = true;
    invincibleMusic.volume = INVINCIBLE_BGM_VOL;
    invincibleMusic.preload = "auto";
  }

  function ensureVoiceFiles() {
    if (!voiceBurst1) {
      voiceBurst1 = new Audio(VOICE_BURST1_PATH);
      voiceBurst1.volume = VOICE_VOL;
      voiceBurst1.preload = "auto";
    }
    if (!voiceBurst2) {
      voiceBurst2 = new Audio(VOICE_BURST2_PATH);
      voiceBurst2.volume = VOICE_VOL;
      voiceBurst2.preload = "auto";
    }
    if (!voiceDeath) {
      voiceDeath = new Audio(VOICE_DEATH_PATH);
      voiceDodge = new Audio(VOICE_DODGE_PATH);
      seGameOver = new Audio(SE_GAME_OVER_PATH);
      seBurst2 = new Audio(SE_BURST2_PATH);
      seBlackFlash = new Audio(SE_BLACK_FLASH_PATH);
      seBurst1Max = new Audio(SE_BURST1_MAX_PATH);
      seBurst1Normal = new Audio(SE_BURST1_NORMAL_PATH);
      seEvasion = new Audio(SE_EVASION_PATH);
      seEvasionFail = new Audio(SE_EVASION_FAIL_PATH);
      seMorningStarTip = new Audio(SE_MORNING_STAR_TIP_PATH);
      seShotgun = new Audio(SE_SHOTGUN_PATH);
      seStageClear = new Audio(SE_STAGE_CLEAR_PATH);
      seWhipSwing = new Audio(SE_WHIP_SWING_PATH);
      seHandgun = new Audio(SE_HANDGUN_PATH);
      seMachineGun = new Audio(SE_MACHINEGUN_PATH);
      seBazooka = new Audio(SE_BAZOOKA_PATH);
      seStrongHit = new Audio(SE_STRONG_HIT_PATH);
      seMachineGunHeavy = new Audio(SE_MACHINEGUN_HEAVY_PATH);
      seEmpty = new Audio(SE_EMPTY_PATH);
      seNoAmmo = new Audio(SE_NO_AMMO_PATH);
      voiceDeath.volume = VOICE_VOL;
      voiceDeath.preload = "auto";
    }
    if (!voiceDodge) {
      voiceDodge = new Audio(VOICE_DODGE_PATH);
      voiceDodge.volume = VOICE_VOL;
      voiceDodge.preload = "auto";
    }
  }

  function playVoice(audio) {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.volume = Math.min(1.0, Math.max(0, VOICE_VOL * masterVolume));
      audio.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function playSound(audio, vol = 1.0, rate = 1.0) {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.volume = Math.min(1.0, Math.max(0, vol * masterVolume));
      if ("playbackRate" in audio) {
        audio.playbackRate = rate;
      }
      audio.play().catch(() => { });
    } catch (_e) {
      // Ignore
    }
  }

  function resumeStageMusicAfterInvincible() {
    if (gameState !== STATE.PLAY) return;

    ensureStageMusic();
    stopBossMusic(false);
    if (!stageMusic) return;
    stageMusicFadeTimer = 0;
    stageMusicFadeDuration = 0;
    try {
      stageMusic.pause();
      stageMusic.currentTime = 0;
      stageMusic.muted = false;
      if ("playbackRate" in stageMusic) stageMusic.playbackRate = 1;
      if ("defaultPlaybackRate" in stageMusic) stageMusic.defaultPlaybackRate = 1;
      if ("preservesPitch" in stageMusic) stageMusic.preservesPitch = true;
      if ("webkitPreservesPitch" in stageMusic) stageMusic.webkitPreservesPitch = true;
      if ("mozPreservesPitch" in stageMusic) stageMusic.mozPreservesPitch = true;
      stageMusic.volume = 0;
      stageMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
    setBgmVolume(BGM_NORMAL_VOL, INVINCIBLE_BGM_FADE_SEC);
  }

  function stopInvincibleMusic(clearPendingResume = true) {
    if (!invincibleMusic) return;
    openingThemeActive = false;
    invincibleMusicFadeTimer = 0;
    invincibleMusicFadeDuration = 0;
    if (clearPendingResume) {
      pendingStageResumeAfterInvincible = false;
    }
    try {
      invincibleMusic.pause();
      invincibleMusic.currentTime = 0;
      invincibleMusic.muted = false;
      invincibleMusic.volume = INVINCIBLE_BGM_VOL;
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function startInvincibleMusicFadeOut(seconds = INVINCIBLE_BGM_FADE_SEC) {
    if (!invincibleMusic || invincibleMusic.paused) {
      const shouldResume = pendingStageResumeAfterInvincible;
      stopInvincibleMusic(false);
      pendingStageResumeAfterInvincible = false;
      if (shouldResume) {
        resumeStageMusicAfterInvincible();
      }
      return;
    }

    const frames = Math.max(1, Math.round(seconds * 60));
    invincibleMusicFadeDuration = frames;
    invincibleMusicFadeTimer = frames;
  }

  function updateInvincibleMusicFade(dt) {
    if (!invincibleMusic || invincibleMusicFadeTimer <= 0 || invincibleMusicFadeDuration <= 0) return;

    invincibleMusicFadeTimer = Math.max(0, invincibleMusicFadeTimer - dt);
    const ratio = clamp(invincibleMusicFadeTimer / invincibleMusicFadeDuration, 0, 1);

    try {
      invincibleMusic.volume = INVINCIBLE_BGM_VOL * ratio;
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }

    if (invincibleMusicFadeTimer <= 0) {
      const shouldResume = pendingStageResumeAfterInvincible;
      stopInvincibleMusic(false);
      pendingStageResumeAfterInvincible = false;
      if (shouldResume) {
        resumeStageMusicAfterInvincible();
      }
    }
  }

  function startInvincibleMode(duration = INVINCIBLE_DURATION) {
    if (invincibleTimer > 0) return false;
    invincibleTimer = duration;
    openingThemeActive = false;
    pendingStageResumeAfterInvincible = false;
    stopStageMusic(false);
    stopBossMusic(false);
    ensureInvincibleMusic();
    if (!invincibleMusic) return true;
    invincibleMusicFadeTimer = 0;
    invincibleMusicFadeDuration = 0;
    try {
      invincibleMusic.volume = INVINCIBLE_BGM_VOL;
      if (invincibleMusic.paused) {
        invincibleMusic.currentTime = 0;
      }
      invincibleMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
    return true;
  }

  function endInvincibleMode() {
    if (invincibleTimer > 0) return;
    pendingStageResumeAfterInvincible = false;
    resumeStageMusicAfterInvincible();
    startInvincibleMusicFadeOut(INVINCIBLE_BGM_FADE_SEC);
  }

  function startOpeningTheme() {
    if (
      gameState !== STATE.TITLE
      && gameState !== STATE.CUTSCENE
      && gameState !== STATE.STAGE_INTRO
      && gameState !== STATE.PRE_BOSS
    ) return;
    ensureInvincibleMusic();
    if (!invincibleMusic) return;
    if (!audioUnlockedByUser && openingThemeMutedAutoplayTried && invincibleMusic.paused) return;
    if (openingThemeActive && !invincibleMusic.paused) return;

    openingThemeActive = true;
    invincibleMusicFadeTimer = 0;
    invincibleMusicFadeDuration = 0;
    stopBossMusic(false);
    stopStageMusic(true);

    try {
      invincibleMusic.muted = false;
      invincibleMusic.volume = INVINCIBLE_BGM_VOL;
      invincibleMusic.currentTime = 0;
      const starting = invincibleMusic.play();
      if (starting && typeof starting.then === "function") {
        starting.catch(() => {
          if (!audioUnlockedByUser && !openingThemeMutedAutoplayTried) {
            openingThemeMutedAutoplayTried = true;
            try {
              invincibleMusic.currentTime = 0;
              invincibleMusic.muted = true;
              invincibleMusic.volume = INVINCIBLE_BGM_VOL;
              const mutedStart = invincibleMusic.play();
              if (mutedStart && typeof mutedStart.then === "function") {
                mutedStart.then(() => {
                  try {
                    invincibleMusic.muted = false;
                    invincibleMusic.volume = INVINCIBLE_BGM_VOL;
                  } catch (_e) {
                    // Ignore media errors and keep gameplay responsive.
                  }
                }).catch(() => {
                  openingThemeActive = false;
                  try {
                    invincibleMusic.muted = false;
                  } catch (_e) {
                    // Ignore media errors and keep gameplay responsive.
                  }
                });
              } else {
                invincibleMusic.muted = false;
                invincibleMusic.volume = INVINCIBLE_BGM_VOL;
              }
            } catch (_e) {
              openingThemeActive = false;
              try {
                invincibleMusic.muted = false;
              } catch (_e2) {
                // Ignore media errors and keep gameplay responsive.
              }
            }
          } else {
            openingThemeActive = false;
          }
        });
      }
    } catch (_e) {
      openingThemeActive = false;
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function startBossTheme() {
    openingThemeActive = false;
    pendingStageResumeAfterInvincible = false;
    ensureBossMusic();
    if (!bossMusic) return;
    stopInvincibleMusic();
    stopStageMusic(true);

    try {
      bossMusic.muted = false;
      bossMusic.volume = BOSS_BGM_VOL;
      bossMusic.currentTime = 0;
      bossMusic.play().catch(() => { });
    } catch (_e) {
      openingThemeActive = false;
      startBossMusic(true);
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function startClearTheme() {
    openingThemeActive = false;
    pendingStageResumeAfterInvincible = false;
    stopBossMusic(true);
    stopStageMusic(true);
    ensureInvincibleMusic();
    if (!invincibleMusic) return;
    invincibleMusicFadeTimer = 0;
    invincibleMusicFadeDuration = 0;

    try {
      invincibleMusic.pause();
      invincibleMusic.currentTime = 0;
      invincibleMusic.muted = false;
      invincibleMusic.volume = CLEAR_BGM_VOL;
      invincibleMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function playChipNote(time, note, duration, type, level) {
    if (!audioCtx || !bgmMaster || note <= 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(midiToFreq(note), time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(bgmMaster);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  function playChipNoise(time, level) {
    if (!audioCtx || !bgmMaster || !bgmNoiseBuffer) return;
    const source = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    source.buffer = bgmNoiseBuffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1800, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(bgmMaster);
    source.start(time);
    source.stop(time + 0.08);
  }

  function unlockAudio() {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    audioUnlockedByUser = true;
    openingThemeMutedAutoplayTried = false;

    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
      bgmMaster = audioCtx.createGain();
      bgmMaster.gain.value = BGM_NORMAL_VOL;
      bgmMaster.connect(audioCtx.destination);
      bgmNoiseBuffer = buildNoiseBuffer();
    }

    if (audioCtx.state !== "running") {
      audioCtx.resume();
    }

    if (!bgmStarted) {
      bgmStarted = true;
    }

    ensureStageMusic();
    if (stageMusic && !stageMusicPrimed) {
      stageMusicPrimed = true;
      try {
        if (stageMusic.paused) {
          stageMusic.muted = true;
          const priming = stageMusic.play();
          if (priming && typeof priming.then === "function") {
            priming.then(() => {
              stageMusic.pause();
              stageMusic.currentTime = 0;
              stageMusic.muted = false;
              stageMusic.volume = BGM_NORMAL_VOL;
            }).catch(() => {
              stageMusic.muted = false;
              stageMusic.volume = BGM_NORMAL_VOL;
            });
          } else {
            stageMusic.pause();
            stageMusic.currentTime = 0;
            stageMusic.muted = false;
            stageMusic.volume = BGM_NORMAL_VOL;
          }
        }
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
    }

    ensureInvincibleMusic();
    if (invincibleMusic && !invincibleMusicPrimed) {
      invincibleMusicPrimed = true;
      try {
        if (invincibleMusic.paused) {
          invincibleMusic.muted = true;
          const priming = invincibleMusic.play();
          if (priming && typeof priming.then === "function") {
            priming.then(() => {
              invincibleMusic.pause();
              invincibleMusic.currentTime = 0;
              invincibleMusic.muted = false;
            }).catch(() => {
              invincibleMusic.muted = false;
            });
          } else {
            invincibleMusic.pause();
            invincibleMusic.currentTime = 0;
            invincibleMusic.muted = false;
          }
        }
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
    }

    ensureBossMusic();
    if (bossMusic && !bossMusicPrimed) {
      bossMusicPrimed = true;
      try {
        if (bossMusic.paused) {
          bossMusic.muted = true;
          const priming = bossMusic.play();
          if (priming && typeof priming.then === "function") {
            priming.then(() => {
              bossMusic.pause();
              bossMusic.currentTime = 0;
              bossMusic.muted = false;
              bossMusic.volume = BOSS_BGM_VOL;
            }).catch(() => {
              bossMusic.muted = false;
              bossMusic.volume = BOSS_BGM_VOL;
            });
          } else {
            bossMusic.pause();
            bossMusic.currentTime = 0;
            bossMusic.muted = false;
            bossMusic.volume = BOSS_BGM_VOL;
          }
        }
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
    }

    ensureVoiceFiles();

    if (gameState === STATE.TITLE || gameState === STATE.TUTORIAL || gameState === STATE.CUTSCENE || gameState === STATE.STAGE_INTRO || gameState === STATE.PRE_BOSS) {
      startOpeningTheme();
    }
  }

  function playDeathSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;

    const tone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    tone.type = "square";
    tone.frequency.setValueAtTime(620, now);
    tone.frequency.exponentialRampToValueAtTime(140, now + 0.42);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(seLevel(0.12), now + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    tone.connect(toneGain);
    toneGain.connect(audioCtx.destination);
    tone.start(now);
    tone.stop(now + 0.48);

    if (bgmNoiseBuffer) {
      const burst = audioCtx.createBufferSource();
      const burstFilter = audioCtx.createBiquadFilter();
      const burstGain = audioCtx.createGain();
      burst.buffer = bgmNoiseBuffer;
      burstFilter.type = "bandpass";
      burstFilter.frequency.setValueAtTime(640, now);
      burstFilter.Q.setValueAtTime(0.8, now);
      burstGain.gain.setValueAtTime(0.0001, now);
      burstGain.gain.exponentialRampToValueAtTime(seLevel(0.1), now + 0.01);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      burst.connect(burstFilter);
      burstFilter.connect(burstGain);
      burstGain.connect(audioCtx.destination);
      burst.start(now);
      burst.stop(now + 0.17);
    }
  }

  function playDeathJingle() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const step = 0.12;
    const notes = [76, 72, 69, 64, 57];

    for (let i = 0; i < notes.length; i += 1) {
      const t = now + i * step;
      const freq = midiToFreq(notes[i]);

      const lead = audioCtx.createOscillator();
      const leadGain = audioCtx.createGain();
      lead.type = "square";
      lead.frequency.setValueAtTime(freq, t);
      leadGain.gain.setValueAtTime(0.0001, t);
      leadGain.gain.exponentialRampToValueAtTime(seLevel(0.11), t + 0.008);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.95);
      lead.connect(leadGain);
      leadGain.connect(audioCtx.destination);
      lead.start(t);
      lead.stop(t + step);

      const bass = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bass.type = "triangle";
      bass.frequency.setValueAtTime(freq * 0.5, t);
      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.exponentialRampToValueAtTime(seLevel(0.07), t + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9);
      bass.connect(bassGain);
      bassGain.connect(audioCtx.destination);
      bass.start(t);
      bass.stop(t + step * 0.92);
    }
  }

  function playDamageSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(0.09), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playPowerupSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(0.09), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  function playInvincibleExtendSfx(power = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < invincibleExtendSeNextAt) return;
    invincibleExtendSeNextAt = now + 0.042;
    const p = clamp(power, 0.8, 5);

    const lead = audioCtx.createOscillator();
    const leadGain = audioCtx.createGain();
    lead.type = "square";
    lead.frequency.setValueAtTime(700 + p * 58, now);
    lead.frequency.exponentialRampToValueAtTime(1280 + p * 44, now + 0.09);
    leadGain.gain.setValueAtTime(0.0001, now);
    leadGain.gain.exponentialRampToValueAtTime(seLevel(0.082), now + 0.004);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    lead.connect(leadGain);
    leadGain.connect(audioCtx.destination);
    lead.start(now);
    lead.stop(now + 0.12);

    const sparkle = audioCtx.createOscillator();
    const sparkleGain = audioCtx.createGain();
    sparkle.type = "triangle";
    sparkle.frequency.setValueAtTime(980 + p * 42, now + 0.015);
    sparkle.frequency.exponentialRampToValueAtTime(1520 + p * 36, now + 0.08);
    sparkleGain.gain.setValueAtTime(0.0001, now + 0.01);
    sparkleGain.gain.exponentialRampToValueAtTime(seLevel(0.058), now + 0.03);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(audioCtx.destination);
    sparkle.start(now + 0.01);
    sparkle.stop(now + 0.13);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(2200, now);
      bp.Q.setValueAtTime(1.2, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.032), now + 0.003);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.06);
    }
  }

  function playKickSfx(power = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const tone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    tone.type = "square";
    tone.frequency.setValueAtTime(250 + power * 60, now);
    tone.frequency.exponentialRampToValueAtTime(120 + power * 20, now + 0.07);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(seLevel(0.12), now + 0.004);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    tone.connect(toneGain);
    toneGain.connect(audioCtx.destination);
    tone.start(now);
    tone.stop(now + 0.1);

    const punch = audioCtx.createOscillator();
    const punchGain = audioCtx.createGain();
    punch.type = "triangle";
    punch.frequency.setValueAtTime(140 + power * 32, now);
    punch.frequency.exponentialRampToValueAtTime(72, now + 0.08);
    punchGain.gain.setValueAtTime(0.0001, now);
    punchGain.gain.exponentialRampToValueAtTime(seLevel(0.08), now + 0.006);
    punchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    punch.connect(punchGain);
    punchGain.connect(audioCtx.destination);
    punch.start(now);
    punch.stop(now + 0.11);

    const impact = audioCtx.createOscillator();
    const impactGain = audioCtx.createGain();
    impact.type = "sawtooth";
    impact.frequency.setValueAtTime(980 + power * 120, now + 0.002);
    impact.frequency.exponentialRampToValueAtTime(260 + power * 40, now + 0.06);
    impactGain.gain.setValueAtTime(0.0001, now + 0.001);
    impactGain.gain.exponentialRampToValueAtTime(seLevel(0.075 + power * 0.01), now + 0.005);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.072);
    impact.connect(impactGain);
    impactGain.connect(audioCtx.destination);
    impact.start(now + 0.001);
    impact.stop(now + 0.08);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1500 + power * 80, now);
      bp.Q.setValueAtTime(0.9, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.066), now + 0.003);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.06);
    }
  }

  function playBlackFlashSfx(power = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const p = clamp(power, 0.8, 4.6);

    const core = audioCtx.createOscillator();
    const coreGain = audioCtx.createGain();
    core.type = "sawtooth";
    core.frequency.setValueAtTime(180 + p * 54, now);
    core.frequency.exponentialRampToValueAtTime(86 + p * 18, now + 0.12);
    coreGain.gain.setValueAtTime(0.0001, now);
    coreGain.gain.exponentialRampToValueAtTime(seLevel(0.18 + p * 0.014), now + 0.004);
    coreGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    core.connect(coreGain);
    coreGain.connect(audioCtx.destination);
    core.start(now);
    core.stop(now + 0.15);

    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = "square";
    crack.frequency.setValueAtTime(1380 + p * 110, now + 0.008);
    crack.frequency.exponentialRampToValueAtTime(420 + p * 40, now + 0.09);
    crackGain.gain.setValueAtTime(0.0001, now + 0.004);
    crackGain.gain.exponentialRampToValueAtTime(seLevel(0.13 + p * 0.006), now + 0.014);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(now + 0.004);
    crack.stop(now + 0.12);

    const slam = audioCtx.createOscillator();
    const slamGain = audioCtx.createGain();
    slam.type = "triangle";
    slam.frequency.setValueAtTime(96 + p * 18, now);
    slam.frequency.exponentialRampToValueAtTime(46 + p * 8, now + 0.13);
    slamGain.gain.setValueAtTime(0.0001, now);
    slamGain.gain.exponentialRampToValueAtTime(seLevel(0.12 + p * 0.01), now + 0.006);
    slamGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    slam.connect(slamGain);
    slamGain.connect(audioCtx.destination);
    slam.start(now);
    slam.stop(now + 0.18);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const hp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      hp.type = "highpass";
      hp.frequency.setValueAtTime(1050 + p * 140, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.12 + p * 0.008), now + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      src.connect(hp);
      hp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.1);
    }
  }

  function triggerBlackFlashEffect(x, y, power = 1) {
    const p = clamp(power, 0.8, 4.8);
    blackFlashTimer = Math.max(blackFlashTimer, 40 + p * 4.4);
    blackFlashPower = Math.max(blackFlashPower, 2.4 + p * 0.9);
    blackFlashX = x;
    blackFlashY = y;
    blackFlashSlowTimer = Math.max(blackFlashSlowTimer, BLACK_FLASH_SLOW_DURATION + p * 2.4);
    triggerImpact(3.8 + p * 0.82, x, y, 5.8 + p * 1.05);
    for (let i = 0; i < 5; i += 1) {
      spawnWaveBurst(x, y, 0.95 + p * 0.22 + i * 0.12);
    }
    spawnHitSparks(x, y, "#ffc0c0", "#ff4747");
    spawnHitSparks(x, y, "#2a0b12", "#77111e");
    spawnHitSparks(x, y, "#ffffff", "#ff6a75");
    spawnHitSparks(x, y, "#d7f2ff", "#67a8ff");
    spawnHitSparks(x, y, "#ffe8ff", "#b671ff");
    playBlackFlashSfx(p);
    if (isBlackFlashHighMode() && blackFlashChain <= 1) {
      hudMessage = "黒閃! 高確モード突入";
    } else if (isBlackFlashHighMode()) {
      hudMessage = "黒閃継続! CRITICAL x1.3";
    } else {
      hudMessage = "黒閃! CRITICAL x1.3";
    }
    hudTimer = Math.max(hudTimer, 44);
  }

  function playBattleRankUpSfx(rankIndex = 0) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < rankUpSeNextAt) return;
    rankUpSeNextAt = now + 0.09;
    const tier = clamp(rankIndex, 0, BATTLE_RANK_DATA.length - 1);
    const base = 320 + tier * 72;

    for (let i = 0; i < 3; i += 1) {
      const t = now + i * 0.038;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = i === 2 ? "square" : "triangle";
      osc.frequency.setValueAtTime(base + i * (86 + tier * 7), t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72 + i * 38, t + 0.09);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(seLevel(0.09 + tier * 0.008), t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.11);
    }

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1100 + tier * 180, now);
      bp.Q.setValueAtTime(0.7, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.06 + tier * 0.004), now + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.08);
    }
  }

  function registerNoDamageDefeat(x, y, power = 1, styleKey = "impact") {
    const previousRank = battleRankIndex;
    battleRankDefeats += 1;
    const gaugeCap = BATTLE_RANK_DATA[BATTLE_RANK_DATA.length - 1].threshold + 360;
    battleRankGauge = Math.min(gaugeCap, battleRankGauge + battleRankGainByStyle(styleKey, power));
    updateBattleRankTier();
    battleRankFlashTimer = Math.max(battleRankFlashTimer, 9);

    if (battleRankIndex > previousRank) {
      const rank = currentBattleRank();
      battleRankFlashTimer = Math.max(battleRankFlashTimer, 56);
      battleRankBreakFlashTimer = 0;
      playBattleRankUpSfx(battleRankIndex);
      triggerImpact(1.2 + power * 0.18, x, y, 1.9 + power * 0.24);
      spawnHitSparks(x, y, "#fff4ce", "#ff7f67");
      hudMessage = `RANK UP! ${rank.long}`;
      hudTimer = Math.max(hudTimer, 40);
    }
  }

  function registerGimmickBreakRank(x, y, power = 1, styleKey = "gimmick_break") {
    const p = clamp(power, 0.8, 3.6);
    const rankPower = 0.86 + p * 0.24;
    registerNoDamageDefeat(x, y, rankPower, styleKey);
  }

  function registerNearMissRank(x, y, power = 1) {
    const previousRank = battleRankIndex;
    const p = clamp(power, 0.8, 3.6);
    const gaugeCap = BATTLE_RANK_DATA[BATTLE_RANK_DATA.length - 1].threshold + 360;
    const gain = (6.2 + p * 2.2 + battleRankIndex * 0.58) * blackFlashRankGainMultiplier();
    battleRankGauge = Math.min(gaugeCap, battleRankGauge + gain);
    updateBattleRankTier();
    battleRankFlashTimer = Math.max(battleRankFlashTimer, 6);

    if (battleRankIndex > previousRank) {
      const rank = currentBattleRank();
      battleRankFlashTimer = Math.max(battleRankFlashTimer, 40);
      battleRankBreakFlashTimer = 0;
      playBattleRankUpSfx(battleRankIndex);
      triggerImpact(0.95 + p * 0.14, x, y, 1.2 + p * 0.16);
      spawnHitSparks(x, y, "#d7f0ff", "#7ebcff");
      hudMessage = `RANK UP! ${rank.long}`;
      hudTimer = Math.max(hudTimer, 34);
    }
  }

  function registerProteinRankGain(x, y) {
    const previousRank = battleRankIndex;
    const gaugeCap = BATTLE_RANK_DATA[BATTLE_RANK_DATA.length - 1].threshold + 360;
    const rankDamp = Math.max(0.72, 1 - battleRankIndex * 0.05);
    const gain = 1.8 * rankDamp * blackFlashRankGainMultiplier();
    battleRankGauge = Math.min(gaugeCap, battleRankGauge + gain);
    updateBattleRankTier();
    battleRankFlashTimer = Math.max(battleRankFlashTimer, 4);

    if (battleRankIndex > previousRank) {
      const rank = currentBattleRank();
      battleRankFlashTimer = Math.max(battleRankFlashTimer, 32);
      battleRankBreakFlashTimer = 0;
      playBattleRankUpSfx(battleRankIndex);
      triggerImpact(0.88, x, y, 1.2);
      spawnHitSparks(x, y, "#e8f6ff", "#8ccfff");
      hudMessage = `RANK UP! ${rank.long}`;
      hudTimer = Math.max(hudTimer, 28);
    }
  }

  function registerBurstActivationRankGain(x, y, gaugeRatio = 0) {
    const previousRank = battleRankIndex;
    const g = clamp(gaugeRatio, 0, 1);
    const gaugeCap = BATTLE_RANK_DATA[BATTLE_RANK_DATA.length - 1].threshold + 360;
    const rankDamp = Math.max(0.76, 1 - battleRankIndex * 0.045);
    const gain = (8 + g * 4) * rankDamp * blackFlashRankGainMultiplier();
    battleRankGauge = Math.min(gaugeCap, battleRankGauge + gain);
    updateBattleRankTier();
    battleRankFlashTimer = Math.max(battleRankFlashTimer, 10);

    if (battleRankIndex > previousRank) {
      battleRankFlashTimer = Math.max(battleRankFlashTimer, 32);
      battleRankBreakFlashTimer = 0;
      playBattleRankUpSfx(battleRankIndex);
      triggerImpact(1.0 + g * 0.26, x, y, 1.5 + g * 0.36);
      spawnHitSparks(x, y, "#f4f6ff", "#a8d4ff");
    }
  }

  function tryRegisterProjectileGraze(projectile, hitBox, power = 1) {
    if (!projectile || projectile.grazeAwarded) return false;
    if (gameState !== STATE.PLAY && gameState !== STATE.BOSS) return false;
    if (invincibleTimer > 0 || proteinBurstTimer > 0 || damageInvulnTimer > 0) return false;
    if (!hitBox) return false;
    if (overlap(player, hitBox)) return false;

    const nearBox = {
      x: hitBox.x - 7,
      y: hitBox.y - 6,
      w: hitBox.w + 14,
      h: hitBox.h + 12,
    };
    if (!overlap(player, nearBox)) return false;

    projectile.grazeAwarded = true;
    const gx = hitBox.x + hitBox.w * 0.5;
    const gy = hitBox.y + hitBox.h * 0.5;
    registerNearMissRank(gx, gy, power);
    spawnHitSparks(gx, gy, "#d7f1ff", "#8dc6ff");
    playParrySfx();
    return true;
  }

  function playEnemyDefeatSfx(power = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < enemyDefeatSeNextAt) return;
    enemyDefeatSeNextAt = now + 0.045;
    const p = clamp(power, 0.8, 5.2);

    const lead = audioCtx.createOscillator();
    const leadGain = audioCtx.createGain();
    lead.type = "square";
    lead.frequency.setValueAtTime(390 + p * 70, now);
    lead.frequency.exponentialRampToValueAtTime(150 + p * 26, now + 0.11);
    leadGain.gain.setValueAtTime(0.0001, now);
    leadGain.gain.exponentialRampToValueAtTime(seLevel(0.095), now + 0.006);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    lead.connect(leadGain);
    leadGain.connect(audioCtx.destination);
    lead.start(now);
    lead.stop(now + 0.13);

    const bass = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bass.type = "triangle";
    bass.frequency.setValueAtTime(180 + p * 24, now);
    bass.frequency.exponentialRampToValueAtTime(84, now + 0.13);
    bassGain.gain.setValueAtTime(0.0001, now);
    bassGain.gain.exponentialRampToValueAtTime(seLevel(0.055), now + 0.01);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    bass.connect(bassGain);
    bassGain.connect(audioCtx.destination);
    bass.start(now);
    bass.stop(now + 0.15);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const hp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      hp.type = "highpass";
      hp.frequency.setValueAtTime(1200, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.045), now + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      src.connect(hp);
      hp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.07);
    }
  }

  function playParrySfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < parrySeNextAt) return;
    parrySeNextAt = now + 0.055;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(0.075), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);

    const ping = audioCtx.createOscillator();
    const pingGain = audioCtx.createGain();
    ping.type = "triangle";
    ping.frequency.setValueAtTime(1780, now + 0.003);
    ping.frequency.exponentialRampToValueAtTime(980, now + 0.05);
    pingGain.gain.setValueAtTime(0.0001, now + 0.002);
    pingGain.gain.exponentialRampToValueAtTime(seLevel(0.062), now + 0.006);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    ping.connect(pingGain);
    pingGain.connect(audioCtx.destination);
    ping.start(now + 0.002);
    ping.stop(now + 0.08);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const hp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      hp.type = "highpass";
      hp.frequency.setValueAtTime(1900, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.038), now + 0.003);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      src.connect(hp);
      hp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.06);
    }
  }

  function playCheckpointSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < uiSeNextAt) return;
    uiSeNextAt = now + 0.1;

    const notes = [660, 880, 1040];
    for (let i = 0; i < notes.length; i += 1) {
      const t = now + i * 0.045;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(seLevel(0.06), t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  function playUiStartSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < uiSeNextAt) return;
    uiSeNextAt = now + 0.11;

    const notes = [520, 700, 920];
    for (let i = 0; i < notes.length; i += 1) {
      const t = now + i * 0.03;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(seLevel(0.065), t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.065);
    }
  }

  function playBossStartSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(0.105), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(420, now);
      bp.Q.setValueAtTime(0.7, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.055), now + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.17);
    }
  }

  function playJumpSfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < jumpSeNextAt) return;
    jumpSeNextAt = now + 0.06;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(0.07), now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  function playLandSfx(intensity = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < landSeNextAt) return;
    landSeNextAt = now + 0.08;

    const p = clamp(intensity, 0.6, 2.4);
    const thump = audioCtx.createOscillator();
    const thumpGain = audioCtx.createGain();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(180 + p * 24, now);
    thump.frequency.exponentialRampToValueAtTime(72, now + 0.11);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(seLevel(0.06 + p * 0.01), now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(audioCtx.destination);
    thump.start(now);
    thump.stop(now + 0.13);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(520, now);
      bp.Q.setValueAtTime(0.8, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.03 + p * 0.006), now + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.09);
    }
  }

  function playProjectileSfx(kind = "enemy") {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < shootSeNextAt) return;
    shootSeNextAt = now + 0.03;

    const cannon = kind === "cannon";
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = cannon ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(cannon ? 280 : 760, now);
    osc.frequency.exponentialRampToValueAtTime(cannon ? 160 : 420, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(cannon ? 0.065 : 0.055), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    const whizz = audioCtx.createOscillator();
    const whizzGain = audioCtx.createGain();
    whizz.type = "triangle";
    whizz.frequency.setValueAtTime(cannon ? 1040 : 1380, now + 0.002);
    whizz.frequency.exponentialRampToValueAtTime(cannon ? 420 : 560, now + 0.055);
    whizzGain.gain.setValueAtTime(0.0001, now + 0.001);
    whizzGain.gain.exponentialRampToValueAtTime(seLevel(cannon ? 0.038 : 0.044), now + 0.004);
    whizzGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.062);
    whizz.connect(whizzGain);
    whizzGain.connect(audioCtx.destination);
    whizz.start(now + 0.001);
    whizz.stop(now + 0.07);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const bp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(cannon ? 820 : 1700, now);
      bp.Q.setValueAtTime(1.1, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(cannon ? 0.03 : 0.036), now + 0.002);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.055);
    }
  }

  function playWaveShotSfx(power = 1) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < waveSeNextAt) return;
    waveSeNextAt = now + 0.08;

    const p = clamp(power, 0.2, 1.2);
    const lead = audioCtx.createOscillator();
    const leadGain = audioCtx.createGain();
    lead.type = "sawtooth";
    lead.frequency.setValueAtTime(640 + p * 260, now);
    lead.frequency.exponentialRampToValueAtTime(240 + p * 70, now + 0.16);
    leadGain.gain.setValueAtTime(0.0001, now);
    leadGain.gain.exponentialRampToValueAtTime(seLevel(0.132), now + 0.006);
    leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    lead.connect(leadGain);
    leadGain.connect(audioCtx.destination);
    lead.start(now);
    lead.stop(now + 0.18);

    const sub = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    sub.type = "triangle";
    sub.frequency.setValueAtTime(220 + p * 70, now);
    sub.frequency.exponentialRampToValueAtTime(88, now + 0.18);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.exponentialRampToValueAtTime(seLevel(0.074), now + 0.01);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    sub.connect(subGain);
    subGain.connect(audioCtx.destination);
    sub.start(now);
    sub.stop(now + 0.2);

    const spark = audioCtx.createOscillator();
    const sparkGain = audioCtx.createGain();
    spark.type = "square";
    spark.frequency.setValueAtTime(1500 + p * 420, now);
    spark.frequency.exponentialRampToValueAtTime(620 + p * 150, now + 0.1);
    sparkGain.gain.setValueAtTime(0.0001, now);
    sparkGain.gain.exponentialRampToValueAtTime(seLevel(0.064 + p * 0.018), now + 0.004);
    sparkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    spark.connect(sparkGain);
    sparkGain.connect(audioCtx.destination);
    spark.start(now);
    spark.stop(now + 0.12);

    const flare = audioCtx.createOscillator();
    const flareGain = audioCtx.createGain();
    flare.type = "square";
    flare.frequency.setValueAtTime(2060 + p * 440, now + 0.002);
    flare.frequency.exponentialRampToValueAtTime(820 + p * 180, now + 0.08);
    flareGain.gain.setValueAtTime(0.0001, now + 0.001);
    flareGain.gain.exponentialRampToValueAtTime(seLevel(0.054 + p * 0.014), now + 0.004);
    flareGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.094);
    flare.connect(flareGain);
    flareGain.connect(audioCtx.destination);
    flare.start(now + 0.001);
    flare.stop(now + 0.1);

    if (bgmNoiseBuffer) {
      const src = audioCtx.createBufferSource();
      const hp = audioCtx.createBiquadFilter();
      const ng = audioCtx.createGain();
      src.buffer = bgmNoiseBuffer;
      hp.type = "highpass";
      hp.frequency.setValueAtTime(1400, now);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(seLevel(0.068 + p * 0.028), now + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      src.connect(hp);
      hp.connect(ng);
      ng.connect(audioCtx.destination);
      src.start(now);
      src.stop(now + 0.1);
    }
  }

  function playChargeReadySfx() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < waveReadySeNextAt) return;
    waveReadySeNextAt = now + 0.18;

    const notes = [920, 1220];
    for (let i = 0; i < notes.length; i += 1) {
      const t = now + i * 0.04;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(seLevel(0.06), t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  function playTimeStopClockTickSfx(accent = false) {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    const baseHz = accent ? 1260 : 980;
    const tone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    tone.type = "square";
    tone.frequency.setValueAtTime(baseHz, now);
    tone.frequency.exponentialRampToValueAtTime(baseHz * 0.78, now + 0.04);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.028, now + 0.003);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    tone.connect(toneGain);
    toneGain.connect(audioCtx.destination);
    tone.start(now);
    tone.stop(now + 0.07);

    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(accent ? 2100 : 1680, now);
    click.frequency.exponentialRampToValueAtTime(accent ? 1320 : 1140, now + 0.028);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.02, now + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    click.connect(clickGain);
    clickGain.connect(audioCtx.destination);
    click.start(now);
    click.stop(now + 0.05);
  }

  function getRobotVoiceCurve() {
    if (robotVoiceCurve) return robotVoiceCurve;
    const size = 257;
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      const x = (i / (size - 1)) * 2 - 1;
      curve[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.42);
    }
    robotVoiceCurve = curve;
    return curve;
  }

  function playRilaRobotVoice(type = "attack") {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    if (now < rilaVoiceNextAt) return;

    const hurt = type === "hurt";
    const duration = hurt ? 0.22 : 0.15;
    rilaVoiceNextAt = now + (hurt ? 0.2 : 0.12);

    const sampleRate = audioCtx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    let held = 0;
    const holdStep = hurt ? 9 : 7;
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      let freq;
      if (hurt) {
        if (t < 0.05) freq = 410;
        else if (t < 0.1) freq = 340;
        else if (t < 0.16) freq = 280;
        else freq = 230;
      } else {
        if (t < 0.04) freq = 890;
        else if (t < 0.08) freq = 740;
        else if (t < 0.11) freq = 980;
        else freq = 620;
      }

      phase += freq / sampleRate;
      const sq = Math.sign(Math.sin(2 * Math.PI * phase));
      const metal = Math.sin(2 * Math.PI * phase * 1.9 + Math.sin(2 * Math.PI * t * 11) * 0.8);
      let sample = sq * 0.66 + metal * 0.34;

      const attack = hurt ? 0.02 : 0.01;
      const env = t < attack
        ? t / attack
        : Math.max(0, 1 - (t - attack) / Math.max(0.001, duration - attack));

      sample *= env;
      const quant = Math.round(sample * 10) / 10;
      if (i % holdStep === 0) held = quant;
      data[i] = held;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const crusher = audioCtx.createWaveShaper();
    crusher.curve = getRobotVoiceCurve();
    crusher.oversample = "none";

    const band = audioCtx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(hurt ? 760 : 980, now);
    band.Q.setValueAtTime(1.2, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(seLevel(hurt ? 0.13 : 0.11), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(crusher);
    crusher.connect(band);
    band.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  function spawnHitSparks(x, y, colorA = "#ffeaa8", colorB = "#ff975b") {
    // Core burst: omnidirectional micro-sparks
    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.35;
      const spd = 1.0 + Math.random() * 2.2;
      hitSparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.4,
        life: 14 + Math.random() * 8,
        maxLife: 18,
        color: i % 2 === 0 ? colorA : colorB,
      });
    }
    // Streaks: fast, elongated sparks that read as punch direction
    for (let i = 0; i < 5; i += 1) {
      const ang = (Math.PI * 2 * Math.random());
      const spd = 2.4 + Math.random() * 1.8;
      hitSparks.push({
        kind: "streak",
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.6,
        life: 10 + Math.random() * 4,
        maxLife: 14,
        color: "#fff4c8",
        gravity: 0.06,
        drag: 0.9,
      });
    }
    // Radial shockwave ring
    waveBursts.push({
      x,
      y,
      life: 10,
      maxLife: 10,
      radius: 6,
      phase: Math.random() * Math.PI * 2,
      power: 0.9,
      kind: "shock",
    });
  }

  function spawnEnemyBlood(x, y, power = 1) {
    const p = clamp(power, 0.9, 5.4);
    const powerRatio = clamp((p - 0.9) / (5.4 - 0.9), 0, 1);
    const tierRatio = battleRankCoreTierRatio();
    const flowRatio = battleRankProgressRatio();
    const exRatio = battleRankExProgress();
    const exBloodBonus = isExBattleRankActive() ? 0.14 + exRatio * 0.18 : 0;
    const rankBloodMul = 1 + tierRatio * 0.55 + flowRatio * 0.2 + exBloodBonus;
    const count = clamp(
      Math.round((18 + p * 10 + p * p * 0.9) * rankBloodMul * 1.12),
      18,
      188
    );
    const palette = [
      { color: "#ff5a6e", dark: "#6f0a16" },
      { color: "#d51a2d", dark: "#560710" },
      { color: "#b70f22", dark: "#43050d" },
      { color: "#8f0a1b", dark: "#2a0308" },
    ];
    for (let i = 0; i < count; i += 1) {
      const tone = palette[Math.floor(Math.random() * palette.length)];
      const spray = Math.random();
      const speedMul = spray < 0.22 ? 1.55 : spray < 0.68 ? 1.06 : 0.78;
      const side = Math.random() * 2 - 1;
      const vx = side * speedMul * (0.9 + Math.random() * (1.55 + p * 0.42));
      const vy = -(0.9 + Math.random() * (2.1 + p * 0.5)) * speedMul;
      const bigChance = 0.16 + powerRatio * 0.26;
      const midChance = 0.56 + powerRatio * 0.16;
      const size = spray < bigChance ? 3 : spray < midChance ? 2 : 1;
      const life = 22 + Math.random() * (14 + p * 4.8);
      hitSparks.push({
        kind: "blood",
        x: x + side * (1.2 + Math.random() * 2.8),
        y: y + (Math.random() * 2 - 1) * (0.8 + p * 0.25),
        vx,
        vy,
        life,
        maxLife: life,
        size,
        stretch: 1.3 + Math.random() * 2.8 + p * 0.22,
        gravity: 0.23 + Math.random() * 0.13 + p * 0.02,
        drag: 0.89 + Math.random() * 0.05,
        splatted: false,
        poolW: 0,
        poolH: 0,
        color: tone.color,
        darkColor: tone.dark,
      });
    }

    const mistCount = clamp(
      Math.round((6 + p * 3 + p * p * 0.4) * (1 + tierRatio * 0.5 + flowRatio * 0.2 + exBloodBonus * 0.68) * 1.1),
      6,
      62
    );
    for (let i = 0; i < mistCount; i += 1) {
      const side = Math.random() * 2 - 1;
      const tone = Math.random() < 0.5 ? "#ff6a74" : "#c71326";
      const life = 9 + Math.random() * (8 + p * 1.3);
      hitSparks.push({
        kind: "blood",
        x: x + side * (0.4 + Math.random() * 1.3),
        y: y + (Math.random() * 2 - 1) * 0.7,
        vx: side * (0.8 + Math.random() * 1.5),
        vy: -(0.6 + Math.random() * 1.4),
        life,
        maxLife: life,
        size: 1,
        stretch: 0.9 + Math.random() * 1.4,
        gravity: 0.18 + Math.random() * 0.08,
        drag: 0.92 + Math.random() * 0.04,
        splatted: false,
        poolW: 0,
        poolH: 0,
        color: tone,
        darkColor: "#5c0912",
      });
    }
  }

  function spawnWaveBurst(x, y, power = 1) {
    const p = clamp(power, 0.5, 2.6);
    waveBursts.push({
      x,
      y,
      life: 18 + p * 8,
      maxLife: 18 + p * 8,
      radius: 6 + p * 9,
      phase: Math.random() * Math.PI * 2,
      power: p,
    });
  }

  function triggerImpact(intensity, x, y, hitStop = 0) {
    impactShakeTimer = Math.max(impactShakeTimer, 7 + intensity * 3.2);
    impactShakePower = Math.max(impactShakePower, 0.5 + intensity * 0.55);
    if (hitStop > 0 && !isTimeBurstStopActive()) {
      hitStopTimer = Math.max(hitStopTimer, hitStop);
    }
    spawnHitSparks(x, y);
  }

  function triggerTimeBurst() {
    if (isTimeBurstActive()) return false;
    if (proteinBurstTimer > 0) return false;
    if (proteinBurstGauge1 < PROTEIN_BURST_MIN) return false;

    const spentGauge = proteinBurstGauge1;
    const fullStop = spentGauge >= PROTEIN_BURST_REQUIRE - 0.001;
    const gaugeRatio = clamp(spentGauge / PROTEIN_BURST_REQUIRE, 0, 1);
    const slowRatio = clamp(
      (spentGauge - PROTEIN_BURST_MIN) / Math.max(1, PROTEIN_BURST_REQUIRE - PROTEIN_BURST_MIN),
      0,
      1
    );

    resetTimeBurstState();
    // Burst Mode Change: Time Stop -> Slow Motion
    // timeBurstMode = fullStop ? TIME_BURST_MODE_STOP : TIME_BURST_MODE_SLOW;
    timeBurstMode = TIME_BURST_MODE_SLOW;

    timeBurstDuration = fullStop
      ? TIME_BURST_STOP_DURATION
      : Math.round(TIME_BURST_SLOW_MIN_DURATION + (TIME_BURST_SLOW_MAX_DURATION - TIME_BURST_SLOW_MIN_DURATION) * slowRatio);
    timeBurstTimer = timeBurstDuration;

    // For "Full Stop" (now Slow Mo), use a very low scale
    timeBurstSlowScale = fullStop
      ? 0.1 // 0.1x speed instead of 0
      : clamp(TIME_BURST_SLOW_SCALE_MAX - (TIME_BURST_SLOW_SCALE_MAX - TIME_BURST_SLOW_SCALE_MIN) * slowRatio, TIME_BURST_SLOW_SCALE_MIN, TIME_BURST_SLOW_SCALE_MAX);
    timeBurstPhase = 0;
    // timeBurstStopDeadlineMs = fullStop ? performance.now() + (TIME_BURST_STOP_DURATION / 60) * 1000 : 0;
    timeBurstStopDeadlineMs = 0; // Disable stop deadline logic

    registerBurstActivationRankGain(player.x + player.w * 0.5, player.y + player.h * 0.52, gaugeRatio);
    proteinBurstGauge1 = 0;

    triggerImpact(
      fullStop ? 3.4 : 2.7 + slowRatio * 0.9,
      player.x + player.w * 0.5,
      player.y + player.h * 0.5,
      fullStop ? 5.6 : 4.2
    );
    for (let i = 0; i < 7; i += 1) {
      const ang = (Math.PI * 2 * i) / 7 + i * 0.08;
      const radius = 6 + i * 1.6;
      const sx = player.x + player.w * 0.5 + Math.cos(ang) * radius;
      const sy = player.y + player.h * 0.5 + Math.sin(ang) * radius * 0.7;
      spawnWaveBurst(sx, sy, fullStop ? 1.2 : 0.9 + slowRatio * 0.5);
    }
    playPowerupSfx();
    playKickSfx(fullStop ? 1.92 : 1.74 + slowRatio * 0.16);

    if (fullStop) {
      hudMessage = `BURST2: TIME STOP ${(TIME_BURST_STOP_DURATION / 60).toFixed(1)}s`;
      hudTimer = 72;
    } else {
      const sec = (timeBurstDuration / 60).toFixed(1);
      hudMessage = `BURST2: NEGATIVE SLOW ${sec}s`;
      hudTimer = 62;
    }
    playVoice(voiceBurst2);
    return true;
  }

  function triggerProteinBurst() {
    if (isTimeBurstActive()) return false;
    if (proteinBurstTimer > 0) return false;
    if (proteinBurstGauge1 < PROTEIN_BURST_MIN) return false;

    const spentGauge = proteinBurstGauge1;
    const fullBurst = spentGauge >= PROTEIN_BURST_REQUIRE - 0.001;
    const gaugeRatio = clamp(
      (spentGauge - PROTEIN_BURST_MIN) / Math.max(1, PROTEIN_BURST_REQUIRE - PROTEIN_BURST_MIN),
      0,
      1
    );
    proteinBurstMode = fullBurst ? PROTEIN_BURST_MODE_LASER : PROTEIN_BURST_MODE_METEOR;
    proteinBurstUsedGauge = spentGauge;
    proteinBurstPower = fullBurst
      ? (0.9 + gaugeRatio * 1.1)
      : (0.72 + gaugeRatio * 0.76);
    registerBurstActivationRankGain(player.x + player.w * 0.5, player.y + player.h * 0.52, gaugeRatio);

    proteinBurstGauge1 = 0;
    proteinBurstTimer = fullBurst ? PROTEIN_BURST_DURATION : PROTEIN_BURST_METEOR_DURATION;
    proteinBurstBlastDone = false;
    if (!stage.burstMeteors) stage.burstMeteors = [];
    stage.burstMeteors = [];
    player.vx *= 0.4;
    if (fullBurst) {
      player.vy = Math.min(player.vy, -8.1 - gaugeRatio * 1.3);
      player.onGround = false;
    } else {
      player.vy = Math.min(player.vy, -2.8 - gaugeRatio * 0.55);
    }
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    resetSwordmasterState();
    attackEffectTimer = 0;
    attackEffectPhase = 0;
    attackEffectMode = "none";
    attackEffectPower = 0;
    resetBlackFlashState();
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    playPowerupSfx();
    playKickSfx(1.96 + gaugeRatio * 0.34);
    for (let i = 0; i < 10; i += 1) {
      const ang = (Math.PI * 2 * i) / 10;
      const radius = 5 + i * 1.8;
      const sx = player.x + player.w * 0.5 + Math.cos(ang) * radius;
      const sy = player.y + player.h * 0.5 + Math.sin(ang) * radius * 0.72;
      spawnWaveBurst(sx, sy, 1.1 + gaugeRatio * 0.95);
    }
    triggerImpact(
      3.1 + proteinBurstPower * 1.15,
      player.x + player.w * 0.5,
      player.y + player.h * 0.55,
      5.1 + proteinBurstPower * 1.45
    );
    waveFlashX = player.x + player.w * 0.5;
    waveFlashY = player.y + player.h * 0.4;
    waveFlashTimer = Math.max(waveFlashTimer, 42 + gaugeRatio * 16);
    waveFlashPower = Math.max(waveFlashPower, 2.0 + gaugeRatio * 1.5);
    hudMessage = fullBurst ? "PROTEIN BURST MAX!" : "METEOR BURST!";
    hudTimer = 58;
    playVoice(voiceBurst1);
    return true;
  }

  function performProteinBurstSweep() {
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.5;
    const gaugeRatio = clamp(
      (proteinBurstUsedGauge - PROTEIN_BURST_MIN) / Math.max(1, PROTEIN_BURST_REQUIRE - PROTEIN_BURST_MIN),
      0,
      1
    );
    const sweepPower = clamp(proteinBurstPower, 0.9, 2.4);
    const crisisMul = pinchAttackMultiplier();

    let swept = 0;
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      const ex = enemy.x + enemy.w * 0.5;
      const ey = enemy.y + enemy.h * 0.45;
      registerNoDamageDefeat(ex, ey, 1.1 + gaugeRatio * 1.2, "burst_sweep");
      enemy.alive = false;
      enemy.kicked = true;
      enemy.vx = 0;
      enemy.vy = 0;
      swept += 1;
    }

    for (const bullet of stage.hazardBullets) {
      if (bullet.dead) continue;
      bullet.dead = true;
      swept += 1;
    }

    for (const shot of stage.bossShots) {
      if (shot.dead) continue;
      shot.dead = true;
      swept += 1;
    }

    stage.enemies = stage.enemies.filter((e) => e.alive);
    stage.hazardBullets = stage.hazardBullets.filter((b) => !b.dead);
    stage.bossShots = stage.bossShots.filter((s) => !s.dead);

    const bosses = getBossEntities();
    for (const boss of bosses) {
      if (boss.invuln > 0) continue;
      const hx = boss.x + boss.w * 0.5;
      const hy = boss.y + boss.h * 0.42;
      const bf = rollBlackFlashHit(hx, hy, 1.35 + gaugeRatio * 1.4);
      const bossDamage = Math.max(
        1,
        Math.round((1 + Math.floor(gaugeRatio * 2.2) + bossDamageBonus()) * crisisMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1))
      );
      boss.hp = Math.max(0, boss.hp - bossDamage);
      boss.invuln = BOSS_HIT_INVULN_FRAMES;
      boss.vx += player.facing * (0.5 + gaugeRatio * 0.95 + (bf ? 0.22 : 0));
      boss.vy = Math.min(boss.vy, -(2.0 + gaugeRatio * 1.6 + (bf ? 0.22 : 0)));
      handleBossHpZero();
    }

    triggerImpact(5.4 + sweepPower * 1.6, px, py - 24, 7.6 + sweepPower * 1.95);
    for (let i = 0; i < 1 + Math.floor(gaugeRatio * 3); i += 1) {
      const ox = (Math.random() * 2 - 1) * 6;
      const oy = (Math.random() * 2 - 1) * 4;
      spawnHitSparks(px + ox, py - 24 + oy, "#fff0b8", "#ff8d68");
    }
    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.25;
      const dist = 8 + (i % 4) * 6;
      const sx = px + Math.cos(ang) * dist;
      const sy = py - 22 + Math.sin(ang) * dist * 0.7;
      spawnWaveBurst(sx, sy, 1.1 + sweepPower * 0.44);
      if (i % 2 === 0) {
        spawnHitSparks(sx, sy, "#d7f7ff", "#87b2ff");
      }
    }
    spawnHitSparks(px, py - 24, "#d7f7ff", "#87b2ff");
    proteinBurstLaserTimer = PROTEIN_BURST_LASER_DURATION + Math.round(gaugeRatio * 24);
    proteinBurstLaserPhase = 0;
    waveFlashX = px;
    waveFlashY = py - 20;
    waveFlashTimer = Math.max(waveFlashTimer, 54 + gaugeRatio * 20);
    waveFlashPower = Math.max(waveFlashPower, 2.4 + gaugeRatio * 1.7);
    kickBurstX = px;
    kickBurstY = py - 18;
    kickFlashTimer = Math.max(kickFlashTimer, 28 + sweepPower * 7);
    kickFlashPower = Math.max(kickFlashPower, 2.2 + sweepPower * 0.8);
    playKickSfx(2.16 + gaugeRatio * 0.36);
    hudMessage = swept > 0 ? `PROTEIN BURST x${swept}` : "PROTEIN BURST!";
    hudTimer = 34;
  }

  function performProteinBurstMeteorBarrage() {
    if (!stage.burstMeteors) stage.burstMeteors = [];
    stage.burstMeteors = [];
    const gaugeRatio = clamp(
      (proteinBurstUsedGauge - PROTEIN_BURST_MIN) / Math.max(1, PROTEIN_BURST_REQUIRE - PROTEIN_BURST_MIN),
      0,
      1
    );
    const count = Math.round(
      PROTEIN_BURST_METEOR_COUNT_MIN +
      gaugeRatio * (PROTEIN_BURST_METEOR_COUNT_MAX - PROTEIN_BURST_METEOR_COUNT_MIN)
    );
    const minX = clamp(cameraX + 20, 10, stage.width - 10);
    const maxX = clamp(cameraX + W - 20, minX + 1, stage.width - 10);
    const delayStep = 4.8 - gaugeRatio * 1.4;

    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const baseX = minX + (maxX - minX) * t;
      const jitter = (Math.random() * 2 - 1) * (20 + gaugeRatio * 30);
      const x = clamp(baseX + jitter, 10, stage.width - 10);
      const power = 0.9 + gaugeRatio * 0.6 + Math.random() * 0.16;
      stage.burstMeteors.push({
        state: "warn",
        x,
        y: -18 - Math.random() * 18,
        vx: (Math.random() * 2 - 1) * 0.28,
        vy: 4.1 + gaugeRatio * 1.15 + Math.random() * 0.9,
        delay: 7 + i * delayStep + Math.random() * 5,
        pulse: Math.random() * Math.PI * 2,
        radius: 23 + power * 11.6,
        power,
        life: 0,
      });
    }

    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.45;
    triggerImpact(3.1 + gaugeRatio * 1.2, px, py - 12, 4.8 + gaugeRatio * 1.4);
    for (let i = 0; i < 8; i += 1) {
      const ang = (Math.PI * 2 * i) / 8;
      spawnWaveBurst(px + Math.cos(ang) * 7, py - 14 + Math.sin(ang) * 5, 0.9 + gaugeRatio * 0.55);
    }
    playWaveShotSfx(0.56 + gaugeRatio * 0.24);
    playKickSfx(1.72 + gaugeRatio * 0.26);
    hudMessage = `METEOR x${count}`;
    hudTimer = 40;
  }

  function applyProteinBurstMeteorImpact(meteor, gaugeRatio) {
    const crisisMul = pinchAttackMultiplier();
    const mx = meteor.x;
    const my = stage.groundY - 1;
    const radius = meteor.radius;
    const enemyPower = (0.9 + meteor.power * 0.6 + gaugeRatio * 0.36) * crisisMul * 0.98;

    let hits = 0;
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      const ex = enemy.x + enemy.w * 0.5;
      const ey = enemy.y + enemy.h * 0.45;
      if (Math.abs(ex - mx) > radius * 1.08 || Math.abs(ey - my) > radius * 0.88) continue;
      const dir = ex < mx ? -1 : 1;
      kickEnemy(enemy, dir, enemyPower, {
        immediateRemove: false,
        flyLifetime: 36,
        rankStyle: "burst_meteor",
      });
      enemy.vx = dir * (4.4 + meteor.power * 1.3);
      enemy.vy = -(3.1 + meteor.power * 0.78);
      enemy.flash = 12;
      hits += 1;
    }

    for (const bullet of stage.hazardBullets) {
      if (bullet.dead) continue;
      const bx = bullet.x + bullet.w * 0.5;
      const by = bullet.y + bullet.h * 0.5;
      if (Math.abs(bx - mx) > radius * 1.22 || Math.abs(by - my) > radius) continue;
      bullet.dead = true;
      hits += 1;
    }

    for (const shot of stage.bossShots) {
      if (shot.dead) continue;
      const sx = shot.x + shot.w * 0.5;
      const sy = shot.y + shot.h * 0.5;
      if (Math.abs(sx - mx) > radius * 1.28 || Math.abs(sy - my) > radius) continue;
      shot.dead = true;
      hits += 1;
    }

    for (const boss of getBossEntities()) {
      if (boss.hp <= 0 || boss.invuln > 0) continue;
      const hx = boss.x + boss.w * 0.5;
      const hy = boss.y + boss.h * 0.42;
      if (Math.abs(hx - mx) > radius * 1.34 || Math.abs(hy - my) > radius * 1.05) continue;
      const bf = rollBlackFlashHit(hx, hy, 0.92 + meteor.power * 0.58);
      const damageBase = 0.92 + gaugeRatio * 0.82 + bossDamageBonus() * 0.32;
      const damage = Math.max(1, Math.round(damageBase * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
      boss.hp = Math.max(0, boss.hp - damage);
      boss.invuln = BOSS_HIT_INVULN_FRAMES;
      const dir = hx < mx ? -1 : 1;
      boss.vx += dir * (0.38 + meteor.power * 0.26 + (bf ? 0.12 : 0));
      boss.vy = Math.min(boss.vy, -(1.3 + meteor.power * 0.36 + (bf ? 0.16 : 0)));
      handleBossHpZero();
      hits += 1;
    }

    triggerImpact(3.8 + meteor.power * 1.2, mx, my - 14, 5.6 + meteor.power * 1.5);
    for (let i = 0; i < 11; i += 1) {
      const ang = (Math.PI * 2 * i) / 11 + Math.random() * 0.24;
      const dist = 5 + (i % 3) * 5 + radius * 0.14;
      const sx = mx + Math.cos(ang) * dist;
      const sy = my - 12 + Math.sin(ang) * dist * 0.7;
      spawnWaveBurst(sx, sy, 0.8 + meteor.power * 0.44);
    }
    spawnHitSparks(mx, my - 14, "#ffd4a8", "#ff7a60");
    playKickSfx(1.84 + meteor.power * 0.2);

    if (hits > 0) {
      hudMessage = `METEOR HIT x${hits}`;
      hudTimer = 16;
    }

    meteor.state = "boom";
    meteor.life = 18 + meteor.power * 7;
    meteor.y = my;
  }

  function updateProteinBurstMeteors(dt) {
    if (!stage.burstMeteors || stage.burstMeteors.length === 0) return;
    const gaugeRatio = clamp(
      (proteinBurstUsedGauge - PROTEIN_BURST_MIN) / Math.max(1, PROTEIN_BURST_REQUIRE - PROTEIN_BURST_MIN),
      0,
      1
    );

    for (const meteor of stage.burstMeteors) {
      if (meteor.dead) continue;
      meteor.pulse = (meteor.pulse || 0) + dt * 0.22;

      if (meteor.state === "warn") {
        meteor.delay -= dt;
        if (meteor.delay <= 0) {
          meteor.state = "fall";
          meteor.y = -18 - Math.random() * 16;
        }
        continue;
      }

      if (meteor.state === "fall") {
        meteor.vy = Math.min(meteor.vy + (0.18 + meteor.power * 0.03) * dt, 9.2);
        meteor.x = clamp(meteor.x + meteor.vx * dt, 8, stage.width - 8);
        meteor.y += meteor.vy * dt;
        if (meteor.y >= stage.groundY - 1) {
          applyProteinBurstMeteorImpact(meteor, gaugeRatio);
        }
        continue;
      }

      if (meteor.state === "boom") {
        meteor.life -= dt;
        if (meteor.life <= 0) meteor.dead = true;
      }
    }

    stage.burstMeteors = stage.burstMeteors.filter((meteor) => !meteor.dead);
  }

  function updateProteinBurst(dt, solids, minX, maxX) {
    if (proteinBurstTimer <= 0) return false;

    const duration = proteinBurstMode === PROTEIN_BURST_MODE_METEOR
      ? PROTEIN_BURST_METEOR_DURATION
      : PROTEIN_BURST_DURATION;
    const elapsed = duration - proteinBurstTimer;
    const progress = clamp(elapsed / duration, 0, 1);
    const sweepPower = clamp(proteinBurstPower, 0.9, 2.4);
    if (!proteinBurstBlastDone && progress >= PROTEIN_BURST_BLAST_AT) {
      proteinBurstBlastDone = true;
      if (proteinBurstMode === PROTEIN_BURST_MODE_METEOR) {
        performProteinBurstMeteorBarrage();
      } else {
        performProteinBurstSweep();
      }
    }

    if (proteinBurstMode === PROTEIN_BURST_MODE_METEOR) {
      updateProteinBurstMeteors(dt);
      player.vx *= Math.pow(0.8, dt);
      if (player.onGround) {
        player.vy = Math.min(player.vy, -0.2);
      } else {
        player.vy = Math.min(player.vy + GRAVITY * 0.78 * dt, MAX_FALL);
      }
      const rumblePulse = 0.5 + Math.sin((proteinBurstLaserPhase + elapsed) * 0.3) * 0.5;
      impactShakeTimer = Math.max(impactShakeTimer, 3.2 + sweepPower * 1.7);
      impactShakePower = Math.max(impactShakePower, 0.82 + sweepPower * 0.36 + rumblePulse * 0.28);
    } else {
      player.vx *= Math.pow(0.86, dt);
      if (progress < 0.42) {
        player.vy = Math.min(player.vy - (0.22 + sweepPower * 0.06) * dt, -(4.0 + sweepPower * 0.55));
      } else {
        player.vy = Math.min(player.vy + GRAVITY * (0.84 + sweepPower * 0.03) * dt, MAX_FALL);
      }

      const rumblePulse = 0.5 + Math.sin((proteinBurstLaserPhase + elapsed) * 0.34) * 0.5;
      impactShakeTimer = Math.max(impactShakeTimer, 4 + sweepPower * 2.2);
      impactShakePower = Math.max(impactShakePower, 0.9 + sweepPower * 0.55 + rumblePulse * 0.35);
    }

    moveWithCollisions(player, solids, dt, triggerCrumble);
    player.x = clamp(player.x, minX, maxX);
    if (proteinBurstMode === PROTEIN_BURST_MODE_LASER && player.y < PROTEIN_BURST_TOP_Y) {
      player.y = PROTEIN_BURST_TOP_Y;
      if (player.vy < -0.9) {
        player.vy = -0.9;
      }
    }
    player.anim += dt * 1.2;

    proteinBurstTimer = Math.max(0, proteinBurstTimer - dt);
    if (proteinBurstTimer <= 0) {
      proteinBurstBlastDone = false;
      proteinBurstUsedGauge = 0;
      proteinBurstPower = 1;
      proteinBurstMode = PROTEIN_BURST_MODE_LASER;
      if (!stage.burstMeteors) stage.burstMeteors = [];
      stage.burstMeteors = [];
      player.vy = Math.min(player.vy, -2.7);
      hudMessage = "BURST END";
      hudTimer = 22;
    }
    return true;
  }

  function consumeBurstIfPressed(actions) {
    if (gameState !== STATE.PLAY && gameState !== STATE.BOSS) return;

    if (actions.burstPressed) {
      if (playerStyle === "berserker") {
        if (!triggerProteinBurst()) {
          if (isTimeBurstActive() || proteinBurstTimer > 0) return;
          hudMessage = `BURST: ATTACK ${Math.floor(proteinBurstGauge1)}/${PROTEIN_BURST_MIN}+`;
          hudTimer = 28;
        }
      } else if (playerStyle === "swordmaster" || playerStyle === "trickster"
              || playerStyle === "gunslinger" || playerStyle === "royalguard") {
        // All 4 main styles use Devil Trigger with style-specific effects
        const dtNames = { swordmaster: "DEVIL", trickster: "QUICK", gunslinger: "WILD", royalguard: "DREAD" };
        if (!triggerDevilTrigger()) {
          if (devilTriggerTimer > 0 || isTimeBurstActive() || proteinBurstTimer > 0) return;
          hudMessage = `BURST: ${dtNames[playerStyle]} ${Math.floor(proteinBurstGauge1)}/${PROTEIN_BURST_MIN}+`;
          hudTimer = 28;
        }
      } else {
        if (!triggerTimeBurst()) {
          if (isTimeBurstActive() || proteinBurstTimer > 0) return;
          hudMessage = `BURST: TIME ${Math.floor(proteinBurstGauge1)}/${PROTEIN_BURST_MIN}+`;
          hudTimer = 28;
        }
      }
    }
  }

  function updateTaunt(dt, actions) {
    if (tauntTimer > 0) {
      tauntTimer -= dt;
      player.vx *= 0.8; // Slow down during taunt
      if (tauntTimer <= 0) {
        tauntTimer = 0;
        tauntBonusTimer = TAUNT_BONUS_DURATION;
        hudMessage = "TAUNT BONUS!";
        hudTimer = 60;
      }
      return;
    }
    if (tauntBonusTimer > 0) {
      tauntBonusTimer -= dt;
      if (tauntBonusTimer <= 0) tauntBonusTimer = 0;
    }
    if (tauntFlashTimer > 0) {
      tauntFlashTimer -= dt;
      if (tauntFlashTimer <= 0) tauntFlashTimer = 0;
    }
    if (actions.tauntPressed && player.onGround && tauntTimer <= 0) {
      tauntTimer = TAUNT_DURATION;
      tauntFlashTimer = TAUNT_DURATION;
      player.vx = 0;
      hudMessage = "COME ON!";
      hudTimer = 40;
      triggerImpact(1.5, player.x + player.w * 0.5, player.y + player.h * 0.5, 2.0);
      // Spawn taunt flash particles
      const px = player.x + player.w * 0.5;
      const py = player.y + player.h * 0.4;
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI * 2 * i / 6;
        hitSparks.push({
          x: px, y: py,
          vx: Math.cos(angle) * 2.5,
          vy: Math.sin(angle) * 2.5,
          life: 18, maxLife: 18,
          color: "#ffdd44",
        });
      }
      if (seWhipSwing) playSound(seWhipSwing, 0.5, 0.8);
    }
  }

  function timeBurstDtScale() {
    if (!isTimeBurstActive()) return 1;
    if (timeBurstMode === TIME_BURST_MODE_STOP) return 0;
    return clamp(timeBurstSlowScale, TIME_BURST_SLOW_SCALE_MIN, TIME_BURST_SLOW_SCALE_MAX);
  }

  function updateTimeBurstState(rawDt) {
    if (!isTimeBurstActive()) return;
    if (timeBurstMode === TIME_BURST_MODE_STOP && timeBurstStopDeadlineMs > 0) {
      const remainingMs = Math.max(0, timeBurstStopDeadlineMs - performance.now());
      timeBurstTimer = Math.min(timeBurstTimer, remainingMs / 16.6667);
    } else {
      timeBurstTimer = Math.max(0, timeBurstTimer - rawDt);
    }
    timeBurstPhase += rawDt;
    if (timeBurstTimer > 0) return;

    const wasStop = timeBurstMode === TIME_BURST_MODE_STOP;
    resetTimeBurstState();
    if (wasStop) {
      timeStopSilenceActive = false;
      try {
        if (stageMusic) stageMusic.muted = false;
        if (bossMusic) bossMusic.muted = false;
        if (invincibleMusic) invincibleMusic.muted = false;
      } catch (_e) {
        // Ignore media errors and keep gameplay responsive.
      }
      if (audioCtx && bgmMaster && bgmMaster.gain) {
        try {
          bgmMaster.gain.setValueAtTime(1, audioCtx.currentTime);
        } catch (_e) {
          try {
            bgmMaster.gain.value = 1;
          } catch (_e2) {
            // Ignore gain update errors.
          }
        }
      }
      if (!openingThemeActive && invincibleTimer <= 0) {
        try {
          if (gameState === STATE.PLAY && stageMusic && stageMusic.paused) {
            stageMusic.play().catch(() => { });
          } else if (gameState === STATE.BOSS && bossMusic && bossMusic.paused) {
            bossMusic.play().catch(() => { });
          }
        } catch (_e) {
          // Ignore play errors and let schedule/audio loop recover naturally.
        }
      }
    }
    if (gameState === STATE.PLAY || gameState === STATE.BOSS) {
      hudMessage = wasStop ? "TIME FLOW RETURN" : "SLOW END";
      hudTimer = Math.max(hudTimer, 30);
    }
  }

  function updateTimeStopClockSfx(rawDt) {
    const inCombat = gameState === STATE.PLAY || gameState === STATE.BOSS;
    const ticking = inCombat && isTimeBurstActive() && timeBurstMode === TIME_BURST_MODE_STOP;
    if (!ticking) {
      timeStopClockTickTimer = 0;
      timeStopClockTickPhase = 0;
      return;
    }
    if (timeStopClockTickTimer <= 0) {
      timeStopClockTickPhase += 1;
      const accent = timeStopClockTickPhase % 2 === 0;
      playTimeStopClockTickSfx(accent);
      timeStopClockTickTimer = TIME_STOP_CLOCK_TICK_INTERVAL;
    }
    timeStopClockTickTimer = Math.max(0, timeStopClockTickTimer - rawDt);
  }

  function applyTimeStopSilence() {
    const inCombat = gameState === STATE.PLAY || gameState === STATE.BOSS;
    const shouldSilence = inCombat && isTimeBurstActive() && timeBurstMode === TIME_BURST_MODE_STOP;
    if (shouldSilence === timeStopSilenceActive) return;
    timeStopSilenceActive = shouldSilence;

    try {
      if (stageMusic) stageMusic.muted = shouldSilence;
      if (bossMusic) bossMusic.muted = shouldSilence;
      if (invincibleMusic) invincibleMusic.muted = shouldSilence;
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }

    if (audioCtx && bgmMaster && bgmMaster.gain) {
      const gainValue = shouldSilence ? 0 : 1;
      try {
        bgmMaster.gain.setValueAtTime(gainValue, audioCtx.currentTime);
      } catch (_e) {
        try {
          bgmMaster.gain.value = gainValue;
        } catch (_e2) {
          // Ignore gain update errors.
        }
      }
    }
  }

  function scheduleBGM() {
    if (!bgmStarted || !stageMusic) return;
    const stageActive = gameState === STATE.PLAY;
    if (!stageActive) return;
    if (invincibleTimer > 0 || openingThemeActive) return;
    if (!stageMusic.paused) return;
    try {
      stageMusic.play().catch(() => { });
    } catch (_e) {
      // Ignore media errors and keep gameplay responsive.
    }
  }

  function buildStage() {
    const solids = [];
    const enemies = [];
    const proteins = [];
    const heartItems = [];
    const lifeUpItems = [];
    const bikes = [];
    const weaponItems = [];
    const checkpointTokens = [];
    const staticSpikes = [];
    const popSpikes = [];
    const fallBlocks = [];
    const cannons = [];
    const breakWalls = [];

    const groundY = 160;

    const addSolid = (x, y, w, h, extra = {}) => {
      solids.push({ x, y, w, h, kind: "solid", state: "solid", timer: 0, ...extra });
    };

    const addProtein = (id, x, y) => {
      proteins.push({
        id,
        x,
        y,
        w: 10,
        h: 12,
        bob: (id * 1.37) % (Math.PI * 2),
        collected: collectedProteinIds.has(id),
      });
    };

    const addBike = (id, x, y) => {
      bikes.push({
        id,
        x,
        y,
        w: 18,
        h: 14,
        bob: (id * 1.57) % (Math.PI * 2),
        collected: false,
      });
    };

    const addHeartItem = (id, x, y) => {
      heartItems.push({
        id,
        x,
        y,
        w: 12,
        h: 12,
        bob: (id * 1.73) % (Math.PI * 2),
        collected: false,
      });
    };

    const addLifeUpItem = (id, x, y) => {
      if (collectedLifeUpIds.has(id)) return;
      lifeUpItems.push({
        id,
        x,
        y,
        w: 12,
        h: 12,
        bob: (id * 1.81) % (Math.PI * 2),
        collected: false,
      });
    };

    const addWeaponItem = (id, type, x, y) => {
      weaponItems.push({
        id,
        type,
        x,
        y,
        w: 12,
        h: 12,
        bob: (id * 1.91) % (Math.PI * 2),
        collected: false,
      });
    };

    if (currentStageNumber === 1) {
      const checkpoints = [
        { x: 34, y: 136, label: "START" },
        { x: 980, y: 136, label: "CP-A" },
        { x: 2060, y: 136, label: "CP-B" },
        { x: 3180, y: 136, label: "CP-C" },
        { x: 4380, y: 136, label: "CP-D" },
        { x: 5250, y: 136, label: "CP-E" },
      ];

      const groundSegments = [
        [0, 800],
        [850, 900],
        [1810, 950],
        [2820, 960],
        [3840, 920],
        [4820, 1220],
      ];
      for (const [x, w] of groundSegments) {
        addSolid(x, groundY, w, 24);
      }

      addSolid(710, 128, 110, 10);
      addSolid(1360, 124, 110, 10);
      addSolid(1710, 114, 120, 10, { kind: "crumble", state: "solid", collapseAt: 34 });
      addSolid(2240, 120, 120, 10);
      addSolid(2650, 112, 110, 10);
      addSolid(3140, 118, 130, 10, { kind: "crumble", state: "solid", collapseAt: 32 });
      addSolid(3560, 110, 128, 10);
      addSolid(4020, 118, 120, 10);
      addSolid(4440, 116, 120, 10);
      addSolid(4880, 110, 120, 10, { kind: "crumble", state: "solid", collapseAt: 28 });
      addSolid(5280, 106, 130, 10);
      addSolid(5710, 114, 118, 10, { kind: "crumble", state: "solid", collapseAt: 24 });

      addSolid(1510, 100, 24, 60);
      addSolid(3320, 98, 24, 62);
      addSolid(5120, 98, 24, 62);

      enemies.push(
        { x: 430, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.38, minX: 340, maxX: 540, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 920, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.42, minX: 860, maxX: 1040, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 142, hopInterval: 142 },
        { x: 1230, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.42, minX: 1130, maxX: 1330, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 1540, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.44, minX: 1450, maxX: 1660, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 1840, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.46, minX: 1730, maxX: 1940, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 132, hopInterval: 132 },
        { x: 2380, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.46, minX: 2260, maxX: 2450, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { kind: "bruiser", x: 2720, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.32, minX: 2600, maxX: 2790, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
        { x: 2860, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.48, minX: 2750, maxX: 3010, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 124, hopInterval: 124 },
        { x: 3380, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.5, minX: 3260, maxX: 3460, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 3730, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.52, minX: 3640, maxX: 3810, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 118, hopInterval: 118 },
        { x: 4010, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.52, minX: 3880, maxX: 4090, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 120, hopInterval: 120 },
        { kind: "peacock", x: 2100, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.38, minX: 1980, maxX: 2230, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.0, chargeCooldown: 76, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { kind: "peacock", x: 3620, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.4, minX: 3510, maxX: 3750, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.08, chargeCooldown: 78, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 4380, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.54, minX: 4260, maxX: 4460, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 4680, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.56, minX: 4550, maxX: 4790, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 116, hopInterval: 116, forceShooter: true },
        { kind: "peacock", x: 5010, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.42, minX: 4890, maxX: 5150, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.12, chargeCooldown: 74, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 5340, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.58, minX: 5220, maxX: 5450, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { kind: "bruiser", x: 5480, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.34, minX: 5400, maxX: 5640, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
        { x: 5670, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.6, minX: 5550, maxX: 5810, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 104, hopInterval: 104 },
        { x: 5780, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.61, minX: 5680, maxX: 5930, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { kind: "peacock", x: 5870, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.44, minX: 5740, maxX: 5960, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.2, chargeCooldown: 72, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 2510, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.47, minX: 2410, maxX: 2620, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 4180, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.54, minX: 4080, maxX: 4280, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 114, hopInterval: 114 },
        { kind: "peacock", x: 5590, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.43, minX: 5470, maxX: 5710, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.18, chargeCooldown: 76, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      );
      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        const shooterCandidate = enemy.kind !== "peacock" && enemy.kind !== "bruiser";
        enemy.shooter = shooterCandidate && (enemy.forceShooter || i === 2 || i === 7 || i === 12 || i === 16);
        enemy.shootInterval = enemy.shooter ? 176 + i * 9 : 0;
        enemy.shootCooldown = enemy.shooter ? 104 + i * 7 : 0;
        enemy.flash = 0;
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp || (enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7)));
        enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp || enemy.maxHp)));
        enemy.hitstun = 0;
      }

      fallBlocks.push(
        { x: 1180, y: 8, w: 22, h: 44, triggerX: 1120, state: "idle", vy: 0, timer: 0, warnDuration: 52 },
        { x: 2960, y: 8, w: 22, h: 44, triggerX: 2890, state: "idle", vy: 0, timer: 0, warnDuration: 48 },
        { x: 4520, y: 8, w: 22, h: 44, triggerX: 4450, state: "idle", vy: 0, timer: 0, warnDuration: 44 },
        { x: 5480, y: 8, w: 22, h: 44, triggerX: 5410, state: "idle", vy: 0, timer: 0, warnDuration: 40 }
      );
      cannons.push(
        { x: 1670, y: 142, dir: -1, triggerX: 1600, interval: 170, cool: 60, active: false },
        { x: 2510, y: 142, dir: 1, triggerX: 2440, interval: 162, cool: 56, active: false },
        { x: 3460, y: 142, dir: -1, triggerX: 3380, interval: 154, cool: 54, active: false },
        { x: 4980, y: 142, dir: -1, triggerX: 4900, interval: 148, cool: 52, active: false },
        { x: 5670, y: 142, dir: 1, triggerX: 5580, interval: 142, cool: 50, active: false }
      );
      popSpikes.push(
        { x: 1080, y: groundY - 14, w: 26, h: 14, triggerX: 1010, state: "idle", timer: 0, raise: 0, warnDuration: 44, activeDuration: 18, coolDuration: 86, warningPulse: 0 },
        { x: 2680, y: groundY - 14, w: 26, h: 14, triggerX: 2600, state: "idle", timer: 0, raise: 0, warnDuration: 42, activeDuration: 18, coolDuration: 84, warningPulse: 0 },
        { x: 4560, y: groundY - 14, w: 26, h: 14, triggerX: 4480, state: "idle", timer: 0, raise: 0, warnDuration: 40, activeDuration: 18, coolDuration: 82, warningPulse: 0 },
        { x: 5560, y: groundY - 14, w: 26, h: 14, triggerX: 5480, state: "idle", timer: 0, raise: 0, warnDuration: 38, activeDuration: 18, coolDuration: 80, warningPulse: 0 }
      );
      for (const block of fallBlocks) {
        block.destroyed = false;
        block.debrisTimer = 0;
      }
      for (const cannon of cannons) {
        cannon.destroyed = false;
        cannon.debrisTimer = 0;
        cannon.warning = false;
        cannon.muzzleFlash = 0;
      }
      for (const trap of popSpikes) {
        trap.destroyed = false;
        trap.debrisTimer = 0;
      }

      addProtein(101, 180, 136);
      addProtein(102, 430, 136);
      addProtein(103, 620, 118);
      addProtein(104, 880, 136);
      addProtein(105, 1080, 132);
      addProtein(106, 1360, 112);
      addProtein(107, 1600, 132);
      addProtein(108, 1820, 102);
      addProtein(109, 2050, 136);
      addProtein(110, 2280, 132);
      addProtein(111, 2520, 132);
      addProtein(112, 2760, 106);
      addProtein(113, 3010, 132);
      addProtein(114, 3250, 132);
      addProtein(115, 3490, 108);
      addProtein(116, 3740, 132);
      addProtein(117, 3990, 132);
      addProtein(118, 4230, 110);
      addProtein(119, 4460, 132);
      addProtein(120, 4720, 108);
      addProtein(121, 4960, 132);
      addProtein(122, 5210, 104);
      addProtein(123, 5450, 132);
      addProtein(124, 5680, 108);
      addProtein(125, 5900, 132);

      addBike(101, 2440, 108);
      // Keep heart items sparse.
      addHeartItem(103, 5010, 94);

      const checkpointTokenIds = [1, 3, 5];
      const checkpointTokenAnchors = {
        1: { x: 1010, y: 102 },
        3: { x: 3210, y: 98 },
        5: { x: 5260, y: 98 },
      };
      for (const i of checkpointTokenIds) {
        const cp = checkpoints[i];
        if (!cp) continue;
        const anchor = checkpointTokenAnchors[i] || { x: cp.x + 2, y: cp.y - 18 };
        checkpointTokens.push({
          id: i,
          x: anchor.x,
          y: anchor.y,
          w: 12,
          h: 12,
          bob: (i * 1.29) % (Math.PI * 2),
          collected: checkpointIndex >= i,
        });
      }

      return {
        id: 1,
        theme: "city_basic",
        width: 6120,
        groundY,
        solids,
        enemies,
        proteins,
        heartItems,
        lifeUpItems,
        bikes,
        weaponItems,
        checkpointTokens,
        staticSpikes,
        popSpikes,
        fallBlocks,
        cannons,
        breakWalls,
        hazardBullets: [],
        bossShots: [],
        bossTwins: [],
        godGimmicks: [],
        bossArenaControl: null,
        playerWaves: [],
        hammerShards: [],
        burstMeteors: [],
        checkpoints,
        goal: { x: 5460, y: 112, w: 24, h: 48 },
        bossArena: { minX: 5520, maxX: 6020 },
        boss: {
          kind: "peacock",
          started: false,
          active: false,
          x: 5760,
          y: 124,
          w: 24,
          h: 36,
          vx: 0,
          vy: 0,
          dir: -1,
          onGround: false,
          hp: 9,
          maxHp: 9,
          mode: "idle",
          modeTimer: 0,
          shotCooldown: 48,
          attackCycle: 0,
          spiralAngle: 0,
          invuln: 0,
        },
      };
    }

    if (currentStageNumber === 2) {
      const checkpoints = [
        { x: 34, y: 136, label: "START" },
        { x: 960, y: 136, label: "CP-A" },
        { x: 1920, y: 136, label: "CP-B" },
        { x: 2860, y: 136, label: "CP-C" },
        { x: 3780, y: 136, label: "CP-D" },
        { x: 4720, y: 136, label: "CP-E" },
        { x: 5660, y: 136, label: "CP-F" },
        { x: 6580, y: 136, label: "CP-G" },
        { x: 7480, y: 136, label: "CP-H" },
      ];

      const groundSegments = [
        [0, 760],
        [840, 780],
        [1700, 820],
        [2580, 860],
        [3500, 820],
        [4380, 840],
        [5280, 820],
        [6160, 800],
        [7020, 980],
      ];
      for (const [x, w] of groundSegments) {
        addSolid(x, groundY, w, 24);
      }

      addSolid(730, 126, 100, 10);
      addSolid(1180, 114, 110, 10);
      addSolid(1510, 106, 120, 10, { kind: "crumble", state: "solid", collapseAt: 30 });
      addSolid(2040, 120, 120, 10);
      addSolid(2440, 110, 110, 10, { kind: "crumble", state: "solid", collapseAt: 28 });
      addSolid(2960, 116, 120, 10);
      addSolid(3370, 106, 120, 10, { kind: "crumble", state: "solid", collapseAt: 25 });
      addSolid(3860, 116, 120, 10);
      addSolid(4260, 104, 130, 10, { kind: "crumble", state: "solid", collapseAt: 22 });
      addSolid(4760, 116, 120, 10);
      addSolid(5140, 106, 120, 10);
      addSolid(5540, 100, 130, 10, { kind: "crumble", state: "solid", collapseAt: 20 });
      addSolid(6020, 114, 120, 10);
      addSolid(6400, 104, 120, 10, { kind: "crumble", state: "solid", collapseAt: 18 });
      addSolid(6880, 112, 130, 10);
      addSolid(7260, 102, 120, 10, { kind: "crumble", state: "solid", collapseAt: 16 });

      addSolid(1570, 96, 24, 64);
      addSolid(3330, 100, 24, 60);
      addSolid(5100, 98, 24, 62);
      addSolid(6760, 100, 24, 60);

      enemies.push(
        { x: 400, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.48, minX: 320, maxX: 520, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 920, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.54, minX: 860, maxX: 1050, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 118, hopInterval: 118 },
        { kind: "bruiser", x: 1280, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.34, minX: 1180, maxX: 1400, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
        { kind: "peacock", x: 1760, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.44, minX: 1660, maxX: 1900, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.2, chargeCooldown: 70, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 2100, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.58, minX: 1980, maxX: 2220, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { x: 2520, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.6, minX: 2380, maxX: 2600, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 104, hopInterval: 104, forceShooter: true },
        { kind: "peacock", x: 3050, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.46, minX: 2910, maxX: 3180, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.3, chargeCooldown: 66, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 3410, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.62, minX: 3300, maxX: 3520, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { kind: "bruiser", x: 3900, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.35, minX: 3800, maxX: 4040, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
        { kind: "peacock", x: 4460, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.48, minX: 4340, maxX: 4600, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.42, chargeCooldown: 64, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 4840, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.64, minX: 4720, maxX: 4940, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 96, hopInterval: 96 },
        { x: 5280, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.66, minX: 5160, maxX: 5400, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
        { kind: "peacock", x: 5620, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.5, minX: 5480, maxX: 5760, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.5, chargeCooldown: 62, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { kind: "bruiser", x: 6060, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.36, minX: 5940, maxX: 6200, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 4, maxHp: 4 },
        { x: 6420, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.7, minX: 6300, maxX: 6540, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 90, hopInterval: 90 },
        { kind: "peacock", x: 6810, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.52, minX: 6680, maxX: 6940, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.58, chargeCooldown: 60, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { x: 7160, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.72, minX: 7040, maxX: 7300, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
        { kind: "bruiser", x: 7480, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.38, minX: 7340, maxX: 7600, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 4, maxHp: 4 },
        { x: 1470, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.56, minX: 1370, maxX: 1580, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
        { kind: "peacock", x: 2700, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.45, minX: 2600, maxX: 2820, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.26, chargeCooldown: 68, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
        { kind: "bruiser", x: 5750, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.35, minX: 5640, maxX: 5880, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
        { x: 6840, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.71, minX: 6760, maxX: 6930, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
      );
      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        const shooterCandidate = enemy.kind !== "peacock" && enemy.kind !== "bruiser";
        enemy.shooter = shooterCandidate && (enemy.forceShooter || i === 1 || i === 7 || i === 12 || i === 16);
        enemy.shootInterval = enemy.shooter ? 162 + i * 8 : 0;
        enemy.shootCooldown = enemy.shooter ? 94 + i * 7 : 0;
        enemy.flash = 0;
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp || (enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7)));
        enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp || enemy.maxHp)));
        enemy.hitstun = 0;
      }

      fallBlocks.push(
        { x: 990, y: 10, w: 22, h: 44, triggerX: 930, state: "idle", vy: 0, timer: 0, warnDuration: 46 },
        { x: 2760, y: 10, w: 22, h: 44, triggerX: 2690, state: "idle", vy: 0, timer: 0, warnDuration: 44 },
        { x: 4360, y: 10, w: 22, h: 44, triggerX: 4290, state: "idle", vy: 0, timer: 0, warnDuration: 42 },
        { x: 6200, y: 10, w: 22, h: 44, triggerX: 6130, state: "idle", vy: 0, timer: 0, warnDuration: 40 },
        { x: 7260, y: 10, w: 22, h: 44, triggerX: 7190, state: "idle", vy: 0, timer: 0, warnDuration: 36 }
      );
      cannons.push(
        { x: 1680, y: 142, dir: -1, triggerX: 1600, interval: 154, cool: 56, active: false },
        { x: 2520, y: 142, dir: 1, triggerX: 2440, interval: 148, cool: 54, active: false },
        { x: 3860, y: 142, dir: -1, triggerX: 3780, interval: 138, cool: 50, active: false },
        { x: 5320, y: 142, dir: 1, triggerX: 5240, interval: 132, cool: 48, active: false },
        { x: 6760, y: 142, dir: -1, triggerX: 6680, interval: 126, cool: 46, active: false },
        { x: 7420, y: 142, dir: -1, triggerX: 7340, interval: 118, cool: 42, active: false }
      );
      popSpikes.push(
        { x: 1420, y: groundY - 14, w: 26, h: 14, triggerX: 1340, state: "idle", timer: 0, raise: 0, warnDuration: 42, activeDuration: 18, coolDuration: 86, warningPulse: 0 },
        { x: 3220, y: groundY - 14, w: 26, h: 14, triggerX: 3140, state: "idle", timer: 0, raise: 0, warnDuration: 40, activeDuration: 18, coolDuration: 84, warningPulse: 0 },
        { x: 5060, y: groundY - 14, w: 26, h: 14, triggerX: 4980, state: "idle", timer: 0, raise: 0, warnDuration: 38, activeDuration: 18, coolDuration: 82, warningPulse: 0 },
        { x: 6460, y: groundY - 14, w: 26, h: 14, triggerX: 6380, state: "idle", timer: 0, raise: 0, warnDuration: 36, activeDuration: 18, coolDuration: 80, warningPulse: 0 },
        { x: 7280, y: groundY - 14, w: 26, h: 14, triggerX: 7210, state: "idle", timer: 0, raise: 0, warnDuration: 34, activeDuration: 18, coolDuration: 78, warningPulse: 0 }
      );
      for (const block of fallBlocks) {
        block.destroyed = false;
        block.debrisTimer = 0;
      }
      for (const cannon of cannons) {
        cannon.destroyed = false;
        cannon.debrisTimer = 0;
        cannon.warning = false;
        cannon.muzzleFlash = 0;
      }
      for (const trap of popSpikes) {
        trap.destroyed = false;
        trap.debrisTimer = 0;
      }

      let proteinId = 201;
      for (let x = 180; x <= 7340; x += 220) {
        const t = Math.floor((x - 180) / 220);
        const y = t % 5 === 0 ? 108 : t % 3 === 0 ? 116 : 132;
        addProtein(proteinId, x, y);
        proteinId += 1;
      }
      addProtein(proteinId++, 1540, 88);
      addProtein(proteinId++, 3360, 90);
      addProtein(proteinId++, 5550, 86);
      addProtein(proteinId++, 7270, 84);

      addBike(201, 3120, 100);
      addBike(202, 6220, 100);

      addHeartItem(201, 5400, 92);
      addLifeUpItem(2, 6940, 84);

      const checkpointTokenAnchors = {
        2: { x: 1940, y: 102 },
        5: { x: 4740, y: 98 },
        7: { x: 6600, y: 96 },
      };
      const checkpointTokenIds = [2, 5, 7];
      for (const i of checkpointTokenIds) {
        const cp = checkpoints[i];
        if (!cp) continue;
        const anchor = checkpointTokenAnchors[i] || { x: cp.x + 2, y: cp.y - 18 };
        checkpointTokens.push({
          id: i,
          x: anchor.x,
          y: anchor.y,
          w: 12,
          h: 12,
          bob: (i * 1.29) % (Math.PI * 2),
          collected: checkpointIndex >= i,
        });
      }

      return {
        id: 2,
        theme: "city_deluxe",
        width: 8060,
        groundY,
        solids,
        enemies,
        proteins,
        heartItems,
        lifeUpItems,
        bikes,
        weaponItems,
        checkpointTokens,
        staticSpikes,
        popSpikes,
        fallBlocks,
        cannons,
        breakWalls,
        hazardBullets: [],
        bossShots: [],
        bossTwins: [],
        godGimmicks: [],
        bossArenaControl: null,
        playerWaves: [],
        hammerShards: [],
        burstMeteors: [],
        checkpoints,
        goal: { x: 7340, y: 112, w: 24, h: 48 },
        bossArena: { minX: 7400, maxX: 7980 },
        boss: {
          kind: "peacockman",
          started: false,
          active: false,
          x: 7700,
          y: 124,
          w: 24,
          h: 36,
          vx: 0,
          vy: 0,
          dir: -1,
          onGround: false,
          hp: PEACOCK_HUMAN_BOSS_HP,
          maxHp: PEACOCK_HUMAN_BOSS_HP,
          mode: "idle",
          modeTimer: 0,
          shotCooldown: 44,
          attackCycle: 0,
          spiralAngle: 0,
          invuln: 0,
        },
      };
    }

    const checkpoints = [
      { x: 34, y: 136, label: "START" },
      { x: 980, y: 136, label: "CP-0" },
      { x: 2200, y: 136, label: "CP-1" },
      { x: 3380, y: 136, label: "CP-2" },
      { x: 4300, y: 136, label: "CP-3" },
      { x: 5200, y: 136, label: "CP-4" },
      { x: 6040, y: 136, label: "CP-5" },
      { x: 8060, y: 136, label: "CP-6" },
      { x: 9300, y: 136, label: "CP-7" },
      { x: 10180, y: 136, label: "CP-8" },
    ];

    const groundSegments = [
      [0, 560],
      [640, 350],
      [1060, 330],
      [1490, 370],
      [1960, 330],
      [2380, 340],
      [2830, 350],
      [3310, 350],
      [3780, 340],
      [4250, 340],
      [4700, 500],
      [5260, 380],
      [5720, 320],
      [6120, 340],
      [6540, 360],
      [6940, 460],
      [7420, 420],
      [7888, 372],
      [8360, 500],
      [8920, 420],
      [9400, 380],
      [9840, 420],
      [10320, 430],
      [10820, 320],
    ];

    for (const [x, w] of groundSegments) {
      addSolid(x, groundY, w, 24);
    }

    addSolid(560, 132, 80, 10);
    addSolid(980, 120, 90, 10, { kind: "crumble", state: "solid", collapseAt: 24 });
    addSolid(1390, 126, 100, 10);
    addSolid(1860, 118, 100, 10, { kind: "crumble", state: "solid", collapseAt: 22 });
    addSolid(2290, 120, 95, 10);
    addSolid(2710, 124, 120, 10);
    addSolid(3180, 112, 125, 10, { kind: "crumble", state: "solid", collapseAt: 20 });
    addSolid(3660, 120, 120, 10);
    addSolid(4120, 112, 130, 10, { kind: "crumble", state: "solid", collapseAt: 18 });
    addSolid(4590, 118, 110, 10);
    addSolid(5380, 118, 100, 10);
    addSolid(5860, 108, 110, 10, { kind: "crumble", state: "solid", collapseAt: 18 });
    addSolid(6340, 114, 120, 10);
    addSolid(6760, 104, 130, 10, { kind: "crumble", state: "solid", collapseAt: 16 });
    addSolid(7090, 116, 90, 10);
    addSolid(7320, 110, 120, 10, { kind: "crumble", state: "solid", collapseAt: 14 });
    addSolid(7570, 118, 90, 10);
    addSolid(7790, 114, 110, 10, { kind: "crumble", state: "solid", collapseAt: 14 });
    addSolid(8090, 120, 120, 10);
    addSolid(8460, 108, 120, 10, { kind: "crumble", state: "solid", collapseAt: 13 });
    addSolid(8920, 118, 110, 10);
    addSolid(9260, 108, 120, 10, { kind: "crumble", state: "solid", collapseAt: 12 });
    addSolid(9680, 114, 124, 10);
    addSolid(10060, 104, 132, 10, { kind: "crumble", state: "solid", collapseAt: 12 });
    addSolid(10460, 110, 120, 10);
    addSolid(10880, 102, 120, 10, { kind: "crumble", state: "solid", collapseAt: 11 });

    addSolid(1220, 104, 26, 56);
    addSolid(2060, 96, 20, 64);
    addSolid(3460, 100, 26, 60);
    addSolid(4360, 94, 20, 66);
    addSolid(5610, 102, 22, 58);
    addSolid(6480, 98, 24, 62);
    addSolid(8020, 100, 24, 60);
    addSolid(8420, 98, 24, 62);
    addSolid(9500, 98, 24, 62);
    addSolid(10140, 96, 24, 64);
    addSolid(10760, 98, 24, 62);

    // Break walls removed with hammer/glove abolition.

    enemies.push(
      { x: 420, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.46, minX: 340, maxX: 520, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 880, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.52, minX: 770, maxX: 950, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 124, hopInterval: 124 },
      { kind: "bruiser", x: 1100, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.32, minX: 1000, maxX: 1210, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
      { x: 1290, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.5, minX: 1130, maxX: 1360, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 1760, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.58, minX: 1550, maxX: 1830, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 102, hopInterval: 102 },
      { x: 2230, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.54, minX: 2010, maxX: 2260, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 2660, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.56, minX: 2410, maxX: 2690, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 3070, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.63, minX: 2870, maxX: 3160, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 98, hopInterval: 98 },
      { x: 3520, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.64, minX: 3380, maxX: 3610, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 3970, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.66, minX: 3810, maxX: 4070, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 4480, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.68, minX: 4310, maxX: 4560, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { kind: "peacock", x: 1620, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.44, minX: 1500, maxX: 1740, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.3, chargeCooldown: 62, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { kind: "peacock", x: 2940, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.46, minX: 2820, maxX: 3090, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.4, chargeCooldown: 64, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { kind: "peacock", x: 4210, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.48, minX: 4100, maxX: 4350, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.5, chargeCooldown: 66, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 5480, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.7, minX: 5330, maxX: 5600, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 92, hopInterval: 92 },
      { x: 5950, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.72, minX: 5820, maxX: 6030, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { kind: "bruiser", x: 6120, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.35, minX: 6010, maxX: 6240, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
      { x: 6420, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.74, minX: 6280, maxX: 6480, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 86, hopInterval: 86 },
      { kind: "peacock", x: 6640, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.5, minX: 6520, maxX: 6750, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.58, chargeCooldown: 70, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 6890, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.76, minX: 6780, maxX: 7010, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
      { x: 7210, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.72, minX: 7070, maxX: 7290, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 90, hopInterval: 90 },
      { kind: "peacock", x: 7420, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.5, minX: 7310, maxX: 7520, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.5, chargeCooldown: 72, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 7600, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.74, minX: 7480, maxX: 7680, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 7760, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.77, minX: 7680, maxX: 7890, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 84, hopInterval: 84 },
      { x: 7920, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.76, minX: 7800, maxX: 8030, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 88, hopInterval: 88 },
      { kind: "peacock", x: 8180, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.52, minX: 8060, maxX: 8290, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.6, chargeCooldown: 74, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 8440, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.78, minX: 8320, maxX: 8510, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
      { kind: "peacock", x: 8620, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.54, minX: 8500, maxX: 8720, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.65, chargeCooldown: 76, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { kind: "bruiser", x: 8820, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.37, minX: 8700, maxX: 8940, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 4, maxHp: 4 },
      { x: 9040, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.78, minX: 8940, maxX: 9160, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { kind: "peacock", x: 9300, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.54, minX: 9180, maxX: 9420, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.68, chargeCooldown: 72, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 9560, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.8, minX: 9460, maxX: 9680, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 82, hopInterval: 82 },
      { x: 9840, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.82, minX: 9730, maxX: 9960, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, forceShooter: true },
      { kind: "peacock", x: 10140, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.56, minX: 10020, maxX: 10280, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.72, chargeCooldown: 70, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 10360, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.84, minX: 10240, maxX: 10480, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { x: 10620, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.84, minX: 10520, maxX: 10750, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 78, hopInterval: 78 },
      { kind: "peacock", x: 10930, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.58, minX: 10820, maxX: 11020, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.75, chargeCooldown: 68, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 1520, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.56, minX: 1490, maxX: 1680, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 },
      { kind: "bruiser", x: 2470, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.34, minX: 2400, maxX: 2620, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 3, maxHp: 3 },
      { kind: "peacock", x: 4760, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: 1, speed: 0.5, minX: 4710, maxX: 4910, kicked: false, onGround: false, alive: true, mode: "patrol", chargeSpeed: 2.56, chargeCooldown: 70, windupTimer: 0, chargeTimer: 0, recoverTimer: 0 },
      { x: 7070, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: -1, speed: 0.76, minX: 6990, maxX: 7210, kicked: false, onGround: false, alive: true, hop: true, hopTimer: 86, hopInterval: 86 },
      { kind: "bruiser", x: 8750, y: 142, w: 16, h: 18, vx: 0, vy: 0, dir: -1, speed: 0.38, minX: 8640, maxX: 8850, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0, hp: 4, maxHp: 4 },
      { x: 10340, y: 144, w: 14, h: 16, vx: 0, vy: 0, dir: 1, speed: 0.83, minX: 10320, maxX: 10420, kicked: false, onGround: false, alive: true, hop: false, hopTimer: 0, hopInterval: 0 }
    );

    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      const shooterCandidate = enemy.kind !== "peacock" && enemy.kind !== "bruiser";
      enemy.shooter = shooterCandidate && (enemy.forceShooter || i === 2 || i === 9 || i === 15 || i === 22);
      enemy.shootInterval = enemy.shooter ? 156 + i * 10 : 0;
      enemy.shootCooldown = enemy.shooter ? 96 + i * 10 : 0;
      enemy.flash = 0;
      enemy.maxHp = Math.max(1, Math.round(enemy.maxHp || (enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7)));
      enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp || enemy.maxHp)));
      enemy.hitstun = 0;
    }

    // Spikes removed per latest request.

    fallBlocks.push(
      { x: 690, y: 16, w: 20, h: 38, triggerX: 640, state: "idle", vy: 0, timer: 0, warnDuration: 44 },
      { x: 1310, y: 10, w: 20, h: 44, triggerX: 1250, state: "idle", vy: 0, timer: 0, warnDuration: 42 },
      { x: 2140, y: 10, w: 24, h: 50, triggerX: 2090, state: "idle", vy: 0, timer: 0, warnDuration: 40 },
      { x: 2870, y: 6, w: 22, h: 46, triggerX: 2810, state: "idle", vy: 0, timer: 0, warnDuration: 40 },
      { x: 3720, y: 4, w: 24, h: 52, triggerX: 3660, state: "idle", vy: 0, timer: 0, warnDuration: 38 },
      { x: 5570, y: 6, w: 24, h: 48, triggerX: 5510, state: "idle", vy: 0, timer: 0, warnDuration: 36 },
      { x: 6460, y: 6, w: 24, h: 48, triggerX: 6400, state: "idle", vy: 0, timer: 0, warnDuration: 34 },
      { x: 7240, y: 8, w: 24, h: 48, triggerX: 7180, state: "idle", vy: 0, timer: 0, warnDuration: 32 },
      { x: 8120, y: 8, w: 24, h: 48, triggerX: 8060, state: "idle", vy: 0, timer: 0, warnDuration: 30 },
      { x: 8520, y: 8, w: 24, h: 48, triggerX: 8460, state: "idle", vy: 0, timer: 0, warnDuration: 28 },
      { x: 9180, y: 8, w: 24, h: 48, triggerX: 9110, state: "idle", vy: 0, timer: 0, warnDuration: 30 },
      { x: 10020, y: 8, w: 24, h: 48, triggerX: 9950, state: "idle", vy: 0, timer: 0, warnDuration: 28 },
      { x: 10780, y: 8, w: 24, h: 48, triggerX: 10700, state: "idle", vy: 0, timer: 0, warnDuration: 26 }
    );

    cannons.push(
      { x: 1840, y: 142, dir: -1, triggerX: 1760, interval: 156, cool: 62, active: false },
      { x: 2660, y: 142, dir: 1, triggerX: 2580, interval: 144, cool: 52, active: false },
      { x: 3470, y: 142, dir: -1, triggerX: 3390, interval: 132, cool: 48, active: false },
      { x: 4300, y: 142, dir: -1, triggerX: 4220, interval: 122, cool: 44, active: false },
      { x: 6020, y: 142, dir: -1, triggerX: 5950, interval: 118, cool: 40, active: false },
      { x: 6760, y: 142, dir: 1, triggerX: 6700, interval: 112, cool: 38, active: false },
      { x: 7360, y: 142, dir: -1, triggerX: 7300, interval: 108, cool: 36, active: false },
      { x: 8020, y: 142, dir: 1, triggerX: 7950, interval: 104, cool: 34, active: false },
      { x: 8440, y: 142, dir: -1, triggerX: 8380, interval: 100, cool: 32, active: false },
      { x: 9180, y: 142, dir: -1, triggerX: 9100, interval: 100, cool: 34, active: false },
      { x: 9940, y: 142, dir: 1, triggerX: 9860, interval: 96, cool: 32, active: false },
      { x: 10640, y: 142, dir: -1, triggerX: 10560, interval: 92, cool: 30, active: false }
    );
    popSpikes.push(
      { x: 1460, y: groundY - 14, w: 26, h: 14, triggerX: 1370, state: "idle", timer: 0, raise: 0, warnDuration: 44, activeDuration: 18, coolDuration: 88, warningPulse: 0 },
      { x: 3180, y: groundY - 14, w: 26, h: 14, triggerX: 3090, state: "idle", timer: 0, raise: 0, warnDuration: 42, activeDuration: 18, coolDuration: 84, warningPulse: 0 },
      { x: 4860, y: groundY - 14, w: 26, h: 14, triggerX: 4780, state: "idle", timer: 0, raise: 0, warnDuration: 40, activeDuration: 18, coolDuration: 84, warningPulse: 0 },
      { x: 6760, y: groundY - 14, w: 26, h: 14, triggerX: 6680, state: "idle", timer: 0, raise: 0, warnDuration: 38, activeDuration: 18, coolDuration: 82, warningPulse: 0 },
      { x: 9220, y: groundY - 14, w: 26, h: 14, triggerX: 9140, state: "idle", timer: 0, raise: 0, warnDuration: 38, activeDuration: 18, coolDuration: 82, warningPulse: 0 },
      { x: 10480, y: groundY - 14, w: 26, h: 14, triggerX: 10400, state: "idle", timer: 0, raise: 0, warnDuration: 36, activeDuration: 18, coolDuration: 80, warningPulse: 0 }
    );

    for (const block of fallBlocks) {
      block.destroyed = false;
      block.debrisTimer = 0;
    }

    for (const cannon of cannons) {
      cannon.destroyed = false;
      cannon.debrisTimer = 0;
      cannon.warning = false;
      cannon.muzzleFlash = 0;
    }
    for (const trap of popSpikes) {
      trap.destroyed = false;
      trap.debrisTimer = 0;
    }

    addProtein(1, 180, 136);
    addProtein(2, 504, 136);
    addProtein(3, 606, 108);
    addProtein(4, 940, 136);
    addProtein(5, 1020, 96);
    addProtein(6, 1430, 102);
    addProtein(7, 1900, 95);
    addProtein(8, 2260, 136);
    addProtein(9, 2340, 98);
    addProtein(10, 2790, 102);
    addProtein(11, 3218, 90);
    addProtein(12, 3710, 102);
    addProtein(13, 4146, 88);
    addProtein(14, 4520, 102);
    addProtein(15, 4890, 132);
    addProtein(16, 5000, 122);
    addProtein(17, 720, 132);
    addProtein(18, 1120, 132);
    addProtein(19, 1600, 132);
    addProtein(20, 2050, 132);
    addProtein(21, 2480, 132);
    addProtein(22, 2960, 132);
    addProtein(23, 3440, 132);
    addProtein(24, 3900, 132);
    addProtein(25, 4360, 132);
    addProtein(26, 4740, 132);
    addProtein(27, 5080, 110);
    addProtein(28, 5140, 110);
    addProtein(29, 5340, 132);
    addProtein(30, 5460, 102);
    addProtein(31, 5660, 132);
    addProtein(32, 5880, 94);
    addProtein(33, 6080, 132);
    addProtein(34, 6310, 100);
    addProtein(35, 6530, 132);
    addProtein(36, 6750, 90);
    addProtein(37, 6920, 132);
    addProtein(38, 7060, 104);
    addProtein(39, 7120, 132);
    addProtein(40, 7160, 132);
    addProtein(41, 7240, 132);
    addProtein(42, 7380, 96);
    addProtein(43, 7510, 132);
    addProtein(44, 7630, 102);
    addProtein(45, 7780, 96);
    addProtein(46, 7940, 132);
    addProtein(47, 8060, 104);
    addProtein(48, 8180, 132);
    addProtein(49, 8320, 94);
    addProtein(50, 8460, 132);
    addProtein(51, 8580, 102);
    addProtein(52, 8720, 132);
    addProtein(53, 8820, 102);
    addProtein(54, 8960, 132);
    addProtein(55, 9140, 102);
    addProtein(56, 9340, 132);
    addProtein(57, 9510, 102);
    addProtein(58, 9700, 132);
    addProtein(59, 9890, 96);
    addProtein(60, 10070, 132);
    addProtein(61, 10240, 96);
    addProtein(62, 10440, 132);
    addProtein(63, 10610, 98);
    addProtein(64, 10790, 132);
    addProtein(65, 10940, 94);
    addProtein(66, 11060, 132);

    // Bike = rare invincibility item.
    addBike(1, 3360, 102);
    addBike(2, 5660, 106);
    addBike(3, 9720, 102);

    // Rare heart recovery pickup.
    addHeartItem(4, 10140, 100);

    // Rare 1UP item (single spawn in stage).
    addLifeUpItem(1, 6488, 78);

    // Weapon items removed.

    const checkpointTokenAnchors = {
      1: { x: 1020, y: 104 },
      2: { x: 2340, y: 102 },
      3: { x: 3710, y: 102 },
      4: { x: 4590, y: 100 },
      5: { x: 5460, y: 102 },
      6: { x: 6340, y: 98 },
      7: { x: 7890, y: 92 },
      8: { x: 10220, y: 92 },
    };

    const checkpointTokenIds = [2, 5, 8];
    for (const i of checkpointTokenIds) {
      if (i >= checkpoints.length) continue;
      const cp = checkpoints[i];
      const anchor = checkpointTokenAnchors[i] || { x: cp.x + 2, y: cp.y - 18 };
      checkpointTokens.push({
        id: i,
        x: anchor.x,
        y: anchor.y,
        w: 12,
        h: 12,
        bob: (i * 1.29) % (Math.PI * 2),
        collected: checkpointIndex >= i,
      });
    }

    return {
      id: 3,
      theme: "city_deluxe",
      width: 11320,
      groundY,
      solids,
      enemies,
      proteins,
      heartItems,
      lifeUpItems,
      bikes,
      weaponItems,
      checkpointTokens,
      staticSpikes,
      popSpikes,
      fallBlocks,
      cannons,
      breakWalls,
      hazardBullets: [],
      bossShots: [],
      bossTwins: [],
      godGimmicks: [],
      bossArenaControl: null,
      playerWaves: [],
      hammerShards: [],
      burstMeteors: [],
      checkpoints,
      goal: { x: 10380, y: 112, w: 24, h: 48 },
      bossArena: { minX: 10440, maxX: 11120 },
      boss: {
        kind: "god",
        started: false,
        active: false,
        x: 10820,
        y: 124,
        w: 24,
        h: 36,
        vx: 0,
        vy: 0,
        dir: -1,
        onGround: false,
        hp: 36,
        maxHp: 36,
        mode: "idle",
        modeTimer: 0,
        shotCooldown: 56,
        attackCycle: 0,
        spiralAngle: 0,
        invuln: 0,
      },
    };
  }

  function createPartyGoon(x, minX, maxX, dir = 1) {
    return {
      kind: "partygoon",
      x,
      y: 144,
      w: 13,
      h: 16,
      vx: 0,
      vy: 0,
      dir,
      speed: 0.32,
      minX,
      maxX,
      kicked: false,
      onGround: false,
      alive: true,
      hop: false,
      hopTimer: 0,
      hopInterval: 0,
      shooter: false,
      shootInterval: 0,
      shootCooldown: 0,
      flash: 0,
    };
  }

  function bossArenaControlRatio() {
    if (!stage || !stage.bossArenaControl || !stage.bossArenaControl.active) return 0;
    const control = stage.bossArenaControl;
    const total = Math.max(1, (control.totalGimmicks || 0) + (control.totalAdds || 0));
    const cleared = (control.brokenGimmicks || 0) + (control.defeatedAdds || 0);
    return clamp(cleared / total, 0, 1);
  }

  function updateBossArenaControlState() {
    if (!stage || !stage.bossArenaControl) return;
    const control = stage.bossArenaControl;
    control.ratio = bossArenaControlRatio();
    control.bonusTier = control.ratio >= 0.78 ? 2 : (control.ratio >= 0.42 ? 1 : 0);
  }

  function registerBossArenaTargetDestroyed(kind, x, y) {
    if (gameState !== STATE.BOSS || !stage || !stage.bossArenaControl || !stage.bossArenaControl.active) return;
    const control = stage.bossArenaControl;
    if (kind === "enemy") {
      control.defeatedAdds = Math.min(control.totalAdds || 0, (control.defeatedAdds || 0) + 1);
    } else {
      control.brokenGimmicks = Math.min(control.totalGimmicks || 0, (control.brokenGimmicks || 0) + 1);
    }
    const beforeTier = control.bonusTier || 0;
    updateBossArenaControlState();
    if ((control.bonusTier || 0) > beforeTier) {
      hudMessage = control.bonusTier >= 2 ? "制圧MAX! ボス弱体化" : "制圧中! ボス弱体化";
      hudTimer = Math.max(hudTimer, 44);
      playCheckpointSfx();
      playParrySfx();
    }
    if (typeof x === "number" && typeof y === "number") {
      triggerImpact(1.05, x, y, 1.9);
    }
  }

  function setupBossArenaThreats(bossKind) {
    if (!stage || !stage.boss || !BOSS_ARENA) return;
    const minX = BOSS_ARENA.minX;
    const maxX = BOSS_ARENA.maxX;
    const span = maxX - minX;
    const center = (minX + maxX) * 0.5;
    let totalGimmicks = 0;
    let totalAdds = 0;

    const addBossCannon = (x, dir, interval, cool) => {
      stage.cannons.push({
        x: Math.floor(clamp(x, minX + 24, maxX - 24)),
        y: stage.groundY - 18,
        dir,
        triggerX: minX - 999,
        interval,
        cool,
        active: true,
        destroyed: false,
        debrisTimer: 0,
        warning: false,
        muzzleFlash: 0,
        bossArenaTarget: true,
      });
      totalGimmicks += 1;
    };

    const addBossFallBlock = (x, warnDuration) => {
      stage.fallBlocks.push({
        x: Math.floor(clamp(x, minX + 34, maxX - 54)),
        y: 8,
        w: 22,
        h: 46,
        triggerX: minX - 999,
        state: "warning",
        vy: 0,
        timer: warnDuration,
        warnDuration: warnDuration,
        destroyed: false,
        debrisTimer: 0,
        bossArenaTarget: true,
      });
      totalGimmicks += 1;
    };

    const addBossGuest = (x, minRange, maxRange, dir, shooter, speed = 0.34) => {
      const guest = createPartyGoon(
        Math.floor(clamp(x, minX + 20, maxX - 20)),
        Math.floor(clamp(minRange, minX + 10, maxX - 20)),
        Math.floor(clamp(maxRange, minX + 20, maxX - 10)),
        dir
      );
      guest.speed = speed;
      guest.bossArenaTarget = true;
      guest.bossArenaCounted = false;
      guest.flash = 0;
      if (shooter) {
        guest.shooter = true;
        guest.shootInterval = 110 + Math.random() * 18;
        guest.shootCooldown = 44 + Math.random() * 26;
      }
      stage.enemies.push(guest);
      totalAdds += 1;
    };

    if (bossKind === "peacock" || bossKind === "peacockman") {
      addBossCannon(minX + span * 0.14, 1, 126, 42);
      addBossCannon(center, -1, 138, 62);
      addBossCannon(maxX - span * 0.14, -1, 118, 34);
      addBossFallBlock(minX + span * 0.3, 20);
      addBossFallBlock(maxX - span * 0.3, 36);

      addBossGuest(minX + span * 0.2, minX + 20, center - 30, 1, true, 0.35);
      addBossGuest(center + span * 0.08, center - 20, maxX - 30, -1, false, 0.36);
      addBossGuest(maxX - span * 0.2, center + 24, maxX - 20, -1, true, 0.37);
      if (bossKind === "peacockman") {
        addBossCannon(minX + span * 0.42, 1, 114, 30);
        addBossFallBlock(center + span * 0.18, 24);
        addBossGuest(center - span * 0.14, center - 110, center + 10, 1, true, 0.38);
      }
    } else {
      for (let i = 0; i < stage.enemies.length; i += 1) {
        const enemy = stage.enemies[i];
        enemy.bossArenaTarget = true;
        enemy.bossArenaCounted = false;
        enemy.minX = clamp(enemy.minX || minX + 12, minX + 12, maxX - 22);
        enemy.maxX = clamp(enemy.maxX || maxX - 12, minX + 22, maxX - 12);
        enemy.speed = 0.32 + (i % 2) * 0.04;
        enemy.flash = 0;
        if (i % 2 === 0) {
          enemy.shooter = true;
          enemy.shootInterval = 112 + i * 8;
          enemy.shootCooldown = 42 + i * 8;
        }
      }
      totalAdds += stage.enemies.length;

      addBossGuest(minX + span * 0.24, minX + 20, center - 30, 1, true, 0.35);
      addBossGuest(maxX - span * 0.24, center + 30, maxX - 20, -1, true, 0.35);

      addBossCannon(minX + span * 0.16, 1, 112, 32);
      addBossCannon(center, -1, 128, 52);
      addBossCannon(maxX - span * 0.16, -1, 106, 30);
      addBossFallBlock(minX + span * 0.34, 18);
      addBossFallBlock(maxX - span * 0.34, 30);
    }

    stage.bossArenaControl = {
      active: true,
      totalGimmicks,
      brokenGimmicks: 0,
      totalAdds,
      defeatedAdds: 0,
      ratio: 0,
      bonusTier: 0,
    };
    updateBossArenaControlState();
  }

  function collectSolids() {
    const list = [];

    for (const s of stage.solids) {
      if (s.kind === "crumble" && s.state === "gone") continue;
      list.push(s);
    }

    for (const wall of stage.breakWalls) {
      if (wall.hp > 0) list.push(wall);
    }

    return list;
  }

  function triggerCrumble(s) {
    if (s.kind !== "crumble") return;
    if (s.state !== "solid") return;
    s.state = "warning";
    s.timer = s.collapseAt;
  }

  function updateCrumble(dt) {
    for (const s of stage.solids) {
      if (s.kind !== "crumble") continue;
      if (s.state !== "warning") continue;
      s.timer -= dt;
      if (s.timer <= 0) {
        s.state = "gone";
      }
    }
  }

  function pointInSolids(x, y, solids) {
    for (const s of solids) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  function moveWithCollisions(entity, solids, dt, onLand) {
    entity.onGround = false;

    entity.x += entity.vx * dt;
    for (const s of solids) {
      if (!overlap(entity, s)) continue;

      if (entity.vx > 0) {
        entity.x = s.x - entity.w;
      } else if (entity.vx < 0) {
        entity.x = s.x + s.w;
      }
      entity.vx = 0;
    }

    entity.y += entity.vy * dt;
    for (const s of solids) {
      if (!overlap(entity, s)) continue;

      if (entity.vy > 0) {
        entity.y = s.y - entity.h;
        entity.vy = 0;
        entity.onGround = true;
        if (onLand) onLand(s);
      } else if (entity.vy < 0) {
        entity.y = s.y + s.h;
        entity.vy = 0;
      }
    }
  }

  function canStandAt(x, y, solids) {
    const body = { x, y, w: player.w, h: player.h };
    for (const s of solids) {
      if (overlap(body, s)) return false;
    }

    const head = { x, y: y - 8, w: player.w, h: 8 };
    for (const s of solids) {
      if (overlap(head, s)) return false;
    }

    const footY = y + player.h + 1;
    const supportXs = [
      x + 2,
      x + Math.floor(player.w * 0.5),
      x + player.w - 2,
    ];
    for (const sx of supportXs) {
      if (!pointInSolids(sx, footY, solids)) return false;
    }

    return true;
  }

  function isSpawnDangerous(x, y) {
    const probe = { x: x - 6, y: y - 4, w: player.w + 12, h: player.h + 8 };

    for (const enemy of stage.enemies) {
      if (!enemy.alive) continue;
      const enemyPad = { x: enemy.x - 4, y: enemy.y - 3, w: enemy.w + 8, h: enemy.h + 6 };
      if (overlap(probe, enemyPad)) return true;
    }

    for (const block of stage.fallBlocks) {
      if (block.state === "gone") continue;
      if (overlap(probe, block)) return true;
    }

    for (const cannon of stage.cannons) {
      const dx = Math.abs((x + player.w * 0.5) - cannon.x);
      const dy = Math.abs((y + player.h * 0.5) - cannon.y);
      if (dx < 20 && dy < 24) return true;
    }

    return false;
  }

  function findSafeRespawnPoint(cp) {
    const solids = collectSolids();
    const baseX = clamp(cp.x, 2, stage.width - player.w - 2);
    const baseY = cp.y;
    const offsets = [0, -8, 8, -16, 16, -24, 24, -34, 34, -46, 46, -60, 60, -78, 78, -98, 98, -120, 120];
    const candidates = [];

    for (const offset of offsets) {
      const x = clamp(baseX + offset, 2, stage.width - player.w - 2);
      let bestY = null;
      let bestDy = Infinity;

      for (const s of solids) {
        const left = x + 2;
        const right = x + player.w - 2;
        if (left < s.x || right > s.x + s.w) continue;

        const y = s.y - player.h;
        if (y < 0 || y > H + 20) continue;

        const dy = Math.abs(y - baseY);
        if (dy > 56) continue;
        if (dy < bestDy) {
          bestDy = dy;
          bestY = y;
        }
      }

      if (bestY === null) continue;
      candidates.push({ x, y: bestY });
    }

    for (const c of candidates) {
      if (canStandAt(c.x, c.y, solids) && !isSpawnDangerous(c.x, c.y)) return c;
    }
    for (const c of candidates) {
      if (canStandAt(c.x, c.y, solids)) return c;
    }

    return { x: baseX, y: baseY };
  }

  function placePlayerAtCheckpoint(cp) {
    player = createPlayer(cp.x, cp.y);
    const safe = findSafeRespawnPoint(cp);
    player.x = safe.x;
    player.y = safe.y;
    player.vx = 0;
    player.vy = -0.8;
    player.onGround = false;
  }

  function triggerInvincibleKillBonus(x, y, power = 1) {
    if (invincibleTimer <= 0) return;
    const p = clamp(power, 0.9, 4.8);
    invincibleTimer += INVINCIBLE_KILL_EXTEND_FRAMES;
    invincibleBonusPops.push({
      x,
      y: y - 3,
      vx: (Math.random() * 2 - 1) * 0.22,
      vy: 0.33 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
      life: INVINCIBLE_BONUS_POP_LIFE,
      maxLife: INVINCIBLE_BONUS_POP_LIFE,
      power: p,
    });
    kickFlashTimer = Math.max(kickFlashTimer, 11 + p * 1.2);
    kickFlashPower = Math.max(kickFlashPower, 1.5 + p * 0.25);
    triggerImpact(1.15 + p * 0.18, x, y - 1, 1.8 + p * 0.25);
    spawnHitSparks(x, y - 4, "#fff6be", "#ffd977");
    playInvincibleExtendSfx(p);
  }

  function kickEnemy(enemy, dir, power = 1, options = {}) {
    const immediateRemove = options.immediateRemove !== false;
    const flyLifetime = options.flyLifetime || 42;
    const rankStyle = options.rankStyle || "impact";
    const freshHit = enemy.alive && !enemy.kicked;
    if (!freshHit) return;
    const hitX = enemy.x + enemy.w * 0.5;
    const hitY = enemy.y + enemy.h * 0.45;
    const hasBlackFlashOption = typeof options.blackFlash === "boolean";
    const blackFlash = freshHit
      ? (hasBlackFlashOption ? options.blackFlash : rollBlackFlashHit(hitX, hitY, 1.02 + power * 0.55))
      : false;
    const blackFlashPowerApplied = options.blackFlashPowerApplied === true;
    const effectivePower = blackFlash && !blackFlashPowerApplied ? power * BLACK_FLASH_DAMAGE_MUL : power;
    if (!enemy.maxHp) {
      enemy.maxHp = Math.max(1, Math.round(enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7));
    }
    if (!Number.isFinite(enemy.hp) || enemy.hp === undefined) {
      enemy.hp = enemy.maxHp;
    }
    // Power-based damage: scale with attack power (min 1)
    const hpDamage = Math.max(1, Math.round(effectivePower * 0.8));
    enemy.hp = Math.max(0, enemy.hp - hpDamage);
    const defeatedNow = enemy.hp <= 0;
    spawnEnemyBlood(hitX, hitY, effectivePower + (blackFlash ? 0.22 : 0));
    if (!defeatedNow) {
      enemy.hitstun = Math.max(enemy.hitstun || 0, 14 + effectivePower * 2.2);
      // Stronger knockback so enemies visibly react to hits
      enemy.vx = dir * (2.5 + effectivePower * 0.6);
      enemy.vy = Math.min(enemy.vy, -(2.0 + effectivePower * 0.5 + (blackFlash ? 0.2 : 0)));
      enemy.onGround = false;
      enemy.flash = Math.max(enemy.flash || 0, 11);
      hitStopTimer = Math.max(hitStopTimer, blackFlash ? 4.6 : 2.5);
      playKickSfx(1.03 + effectivePower * 0.08 + (blackFlash ? 0.12 : 0));
      return;
    }
    triggerInvincibleKillBonus(hitX, hitY, effectivePower);
    addProteinBurstGauge(proteinBurstGainFromDefeat(effectivePower));
    registerNoDamageDefeat(hitX, hitY, effectivePower, rankStyle);
    if (enemy.bossArenaTarget && !enemy.bossArenaCounted) {
      enemy.bossArenaCounted = true;
      registerBossArenaTargetDestroyed("enemy", hitX, hitY);
    }
    enemy.kicked = true;
    enemy.vx = dir * (4.3 + effectivePower * 1.55);
    enemy.vy = -(3.6 + effectivePower * 1.05 + (blackFlash ? 0.16 : 0));
    enemy.onGround = false;
    enemy.kickDespawn = immediateRemove ? 0 : Math.max(1, flyLifetime);
    enemy.alive = true;
    enemy.hitstun = 0;
    if (immediateRemove) {
      enemy.alive = false;
    }
    playEnemyDefeatSfx(effectivePower);
  }

  function triggerKickBurst(x, y, power = 1) {
    const p = clamp(power, 0.8, 4.8);
    kickBurstX = x;
    kickBurstY = y;
    kickFlashTimer = Math.max(kickFlashTimer, 9 + p * 3);
    kickFlashPower = Math.max(kickFlashPower, 1 + p * 0.7);
    triggerImpact(1.65 + p * 0.55, x, y, 2.6 + p * 0.8);
    playRilaRobotVoice("attack");
    spawnHitSparks(x, y, "#fff7bc", "#ff9645");
    spawnHitSparks(x, y, "#ffe8a0", "#ff5d53");
  }

  function killPlayer(reason, options = {}) {
    const ignoreInvincible = options.ignoreInvincible === true;
    const instantGameOver = options.instantGameOver === true;
    const fromBossBattle = gameState === STATE.BOSS;

    if (gameState !== STATE.PLAY && gameState !== STATE.BOSS) return;
    const burstGuard = proteinBurstTimer > 0;
    const burstRankGuard = burstGuard || isTimeBurstActive();
    if ((invincibleTimer > 0 || burstGuard) && !ignoreInvincible) {
      if (invincibleHitCooldown > 0) return;
      invincibleHitCooldown = 8;
      hudMessage = burstGuard ? "PROTEIN BURST中!" : "バイク無敵! ノーダメージ";
      hudTimer = 28;
      triggerImpact(0.9, player.x + player.w * 0.5, player.y + player.h * 0.5, 1.2);
      return;
    }

    // Devil Trigger super armor - take no damage, no knockback
    if (devilTriggerTimer > 0 && !ignoreInvincible && !instantGameOver) {
      if (invincibleHitCooldown > 0) return;
      invincibleHitCooldown = 6;
      // Royal Guard DT: counter-damage on hit absorb
      if (devilTriggerStyle === "royalguard") {
        hudMessage = "DREADNAUGHT!";
        royalGuardEnergy = Math.min(ROYAL_GUARD_MAX_ENERGY, royalGuardEnergy + 15);
        devilTriggerHitCount++;
      } else {
        hudMessage = "SUPER ARMOR!";
      }
      hudTimer = 20;
      const colors = DT_STYLE_COLORS[devilTriggerStyle] || DT_STYLE_COLORS.swordmaster;
      triggerImpact(0.7, player.x + player.w * 0.5, player.y + player.h * 0.5, 1.0);
      return;
    }

    if (!instantGameOver) {
      if (damageInvulnTimer > 0) return;
      if (emergencyDodgeInvulnTimer > 0) return;
      if (emergencyDodgeActive) return;

      if (!emergencyDodgeSkipNext) {
        let dodgeChance = EMERGENCY_DODGE_CHANCE[clamp(battleRankIndex, 0, EMERGENCY_DODGE_CHANCE.length - 1)] || 0;
        // Trickster: +20% emergency dodge chance
        if (playerStyle === "trickster") dodgeChance = Math.min(0.9, dodgeChance + 0.2);
        if (dodgeChance > 0 && Math.random() < dodgeChance) {
          emergencyDodgeActive = true;
          emergencyDodgeTimer = EMERGENCY_DODGE_WINDOW;
          emergencyDodgeReason = reason;
          emergencyDodgeOptions = options;
          emergencyDodgeFlashTimer = 18;
          emergencyDodgePhase = 0;
          hitStopTimer = Math.max(hitStopTimer, 3.0);
          playVoice(voiceDodge);
          if (seEvasion) playSound(seEvasion, 1.0);
          hudMessage = "緊急回避チャンス!";
          hudTimer = EMERGENCY_DODGE_WINDOW + 10;
          return;
        }
      }
      emergencyDodgeSkipNext = false;

      if (!burstRankGuard) {
        dropBattleRankOnDamage(true);
      }
      // Reset stylish play chains on damage
      battleRankDodgeChain = 0;
      battleRankComboVariety = 0;
      playerHearts = Math.max(0, playerHearts - 1);
      damageInvulnTimer = 84;
      hurtFlashTimer = 24;
      playDamageSfx();
      if (seEvasionFail) playSound(seEvasionFail, 1.0);
      playRilaRobotVoice("hurt");
      triggerImpact(1.2, player.x + player.w * 0.5, player.y + player.h * 0.5, 1.8);

      if (playerHearts > 0) {
        const knockDir = player.facing > 0 ? -1 : 1;
        player.vx = knockDir * 2.1;
        player.vy = -3.0;
        player.onGround = false;
        hitStopTimer = Math.max(hitStopTimer, 5.0);
        hudMessage = `${reason} -1ハート`;
        hudTimer = 66;
        return;
      }
    } else {
      resetBattleRank(true);
      playerHearts = 0;
      hurtFlashTimer = 24;
      playDamageSfx();
      playRilaRobotVoice("hurt");
      triggerImpact(1.6, player.x + player.w * 0.5, player.y + player.h * 0.5, 2.4);
    }

    playerLives = Math.max(0, playerLives - 1);
    deathContinueMode = fromBossBattle ? "boss" : "checkpoint";
    gameState = STATE.DEAD;
    playVoice(voiceDeath);
    deadTimer = playerLives > 0 ? 134 : 182;
    deadTimerMax = deadTimer;
    deathFlashTimer = 34;
    deathShakeTimer = 26;
    deathPauseTimer = 24;
    deathAnimActive = false;
    deathJumpVy = 0;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    deadReason = reason;
    stopStageMusic(true);
    emergencyDodgeActive = false;
    emergencyDodgeTimer = 0;
    emergencyDodgeInvulnTimer = 0;
    emergencyDodgeFlashTimer = 0;
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    stopInvincibleMusic();
    stopBossMusic(true);
    stopStageMusic(true);
    proteinRushTimer = 0;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    kickCombo = 0;
    kickComboTimer = 0;
    stompChainGuardTimer = 0;
    damageInvulnTimer = 0;
    hurtFlashTimer = 0;
    emergencyDodgeActive = false;
    emergencyDodgeTimer = 0;
    emergencyDodgeInvulnTimer = 0;
    emergencyDodgeFlashTimer = 0;
    emergencyDodgePhase = 0;
    emergencyDodgeSkipNext = false;
    kickFlashTimer = 0;
    kickFlashPower = 0;
    hammerTimer = 0;
    gloveTimer = 0;
    hammerHitCooldown = 0;
    gloveHitCooldown = 0;
    weaponHudTimer = 0;
    dashJumpAssistTimer = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    resetSwordmasterState();
    attackEffectTimer = 0;
    attackEffectPhase = 0;
    attackEffectMode = "none";
    attackEffectPower = 0;
    resetBlackFlashState();
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    deaths += 1;
    hudMessage = playerLives > 0 ? `${reason} / 残機 x${playerLives}` : `${reason} / 残機 0`;
    hudTimer = 80;
    playDeathSfx();
    playDeathJingle();
  }

  function stageStartMessage() {
    if (currentStageNumber === 1) {
      return "STAGE 1: 都会トレーニングエリア突破! 孔雀ボスを倒せ";
    }
    if (currentStageNumber === 2) {
      return "STAGE 2: ネオン街区を突破! 孔雀人間ボスを撃破せよ";
    }
    return "STAGE 3: マンション会場へ突入し、彼氏を救出せよ";
  }

  function startGameplay(resetDeaths, options = {}) {
    const keepLives = options.keepLives === true;
    const keepDeaths = options.keepDeaths === true;
    const keepBlackFlash = options.keepBlackFlash === true;
    const previousLives = playerLives;
    const previousDeaths = deaths;
    if (resetDeaths && !keepDeaths) {
      deaths = 0;
    }
    collectedProteinIds = new Set();
    collectedLifeUpIds = new Set();
    checkpointIndex = 0;
    deathContinueMode = "checkpoint";
    preBossCutsceneTimer = 0;
    stageIntroTimer = 0;
    godPhaseCutsceneTimer = 0;
    stage = buildStage();
    const cp = stage.checkpoints[checkpointIndex];
    placePlayerAtCheckpoint(cp);
    cameraX = 0;
    proteinRushTimer = 0;
    proteinBurstGauge1 = 0;
    proteinBurstGauge2 = 0;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    emergencyDodgeActive = false;
    emergencyDodgeTimer = 0;
    emergencyDodgeInvulnTimer = 0;
    emergencyDodgeFlashTimer = 0;
    resetTimeBurstState();
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    playerHearts = MAX_HEARTS;
    playerLives = keepLives ? Math.max(1, previousLives) : START_LIVES;
    damageInvulnTimer = 0;
    hurtFlashTimer = 0;
    emergencyDodgeActive = false;
    emergencyDodgeTimer = 0;
    emergencyDodgeInvulnTimer = 0;
    emergencyDodgeFlashTimer = 0;
    emergencyDodgePhase = 0;
    emergencyDodgeSkipNext = false;
    impactShakeTimer = 0;
    impactShakePower = 0;
    hitStopTimer = 0;
    kickCombo = 0;
    kickComboTimer = 0;
    stompChainGuardTimer = 0;
    kickFlashTimer = 0;
    kickFlashPower = 0;
    hammerTimer = 0;
    gloveTimer = 0;
    hammerHitCooldown = 0;
    gloveHitCooldown = 0;
    weaponHudTimer = 0;
    dashJumpAssistTimer = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    shotChargeTimer = 0;
    shotMachineGunCount = 0;
    shotMachineGunFrame = 0;
    shotReloadTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    resetSwordmasterState();
    attackEffectTimer = 0;
    attackEffectPhase = 0;
    attackEffectMode = "none";
    attackEffectPower = 0;
    resetBlackFlashState(keepBlackFlash);
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    hitSparks = [];
    deathFlashTimer = 0;
    deathShakeTimer = 0;
    deathPauseTimer = 0;
    deathAnimActive = false;
    deathJumpVy = 0;
    deadReason = "";
    openingThemeActive = false;
    BOSS_ARENA = stage.bossArena ? { ...stage.bossArena } : BOSS_ARENA;
    if (keepDeaths) {
      deaths = previousDeaths;
    }
    stopInvincibleMusic();
    stopBossMusic(true);
    gameState = STATE.PLAY;
    hudMessage = stageStartMessage();
    hudTimer = currentStageNumber <= 1 ? 150 : 170;
    deadTimerMax = 0;
    playUiStartSfx();
    startStageMusic(true);
    setBgmVolume(0, 0);
    setBgmVolume(BGM_NORMAL_VOL, 0.08);
  }

  function respawnFromCheckpoint() {
    preBossCutsceneTimer = 0;
    stageIntroTimer = 0;
    godPhaseCutsceneTimer = 0;
    deathContinueMode = "checkpoint";
    stage = buildStage();
    BOSS_ARENA = stage.bossArena ? { ...stage.bossArena } : BOSS_ARENA;
    const cp = stage.checkpoints[checkpointIndex];
    placePlayerAtCheckpoint(cp);
    cameraX = clamp(player.x - 120, 0, stage.width - W);
    proteinRushTimer = 0;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    playerHearts = MAX_HEARTS;
    damageInvulnTimer = 0;
    hurtFlashTimer = 0;
    emergencyDodgeActive = false;
    emergencyDodgeTimer = 0;
    emergencyDodgeInvulnTimer = 0;
    emergencyDodgeFlashTimer = 0;
    emergencyDodgePhase = 0;
    emergencyDodgeSkipNext = false;
    impactShakeTimer = 0;
    impactShakePower = 0;
    hitStopTimer = 0;
    kickCombo = 0;
    kickComboTimer = 0;
    stompChainGuardTimer = 0;
    kickFlashTimer = 0;
    kickFlashPower = 0;
    hammerTimer = 0;
    gloveTimer = 0;
    hammerHitCooldown = 0;
    gloveHitCooldown = 0;
    weaponHudTimer = 0;
    dashJumpAssistTimer = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    resetSwordmasterState();
    attackEffectTimer = 0;
    attackEffectPhase = 0;
    attackEffectMode = "none";
    attackEffectPower = 0;
    resetBattleRank();
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    hitSparks = [];
    deathFlashTimer = 0;
    deathShakeTimer = 0;
    deathPauseTimer = 0;
    deathAnimActive = false;
    deathJumpVy = 0;
    deadReason = "";
    stopInvincibleMusic();
    stopBossMusic(true);
    gameState = STATE.PLAY;
    hudMessage = `${cp.label} から再開`;
    hudTimer = 70;
    deadTimerMax = 0;
    playUiStartSfx();
    startStageMusic(true);
    setBgmVolume(0, 0);
    setBgmVolume(BGM_NORMAL_VOL, 0.08);
  }

  function findPreMansionCheckpointIndex() {
    if (!stage || !stage.checkpoints || stage.checkpoints.length === 0) return checkpointIndex;
    const goalX = stage.goal && typeof stage.goal.x === "number"
      ? stage.goal.x
      : Infinity;
    let bestIndex = 0;
    let bestX = -Infinity;
    for (let i = 0; i < stage.checkpoints.length; i += 1) {
      const cp = stage.checkpoints[i];
      if (!cp) continue;
      if (cp.x >= goalX) continue;
      if (cp.x > bestX) {
        bestX = cp.x;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  function respawnFromBossBattle() {
    checkpointIndex = findPreMansionCheckpointIndex();
    respawnFromCheckpoint();
    deathContinueMode = "checkpoint";
    hudMessage = currentStageNumber < FINAL_STAGE_NUMBER
      ? "ボスゲート前から再開"
      : "マンション前から再開";
    hudTimer = 96;
  }

  function updateCheckpointTokens(dt) {
    for (const token of stage.checkpointTokens) {
      token.bob += 0.09 * dt;
      if (token.collected) continue;

      const floatY = token.y + Math.sin(token.bob) * 1.6;
      const hit = { x: token.x, y: floatY, w: token.w, h: token.h };
      if (!overlap(player, hit)) continue;

      token.collected = true;
      checkpointIndex = Math.max(checkpointIndex, token.id);
      const cp = stage.checkpoints[token.id];
      hudMessage = `${cp.label} セーブ`;
      hudTimer = 90;
      playPowerupSfx();
      playCheckpointSfx();
      triggerImpact(1.2, token.x + token.w * 0.5, floatY + token.h * 0.5, 2.0);
    }
  }

  function updatePopSpikes(dt) {
    if (isTimeBurstStopActive()) return;
    for (const trap of stage.popSpikes) {
      if (trap.destroyed) {
        trap.debrisTimer = Math.max(0, (trap.debrisTimer || 0) - dt);
        continue;
      }

      trap.warningPulse = (trap.warningPulse || 0) + dt;
      const warnDuration = trap.warnDuration || 40;
      const activeDuration = trap.activeDuration || 18;
      const coolDuration = trap.coolDuration || 84;
      const activeRange = player.x + player.w > trap.x - 160 && player.x < trap.x + trap.w + 220;
      const state = trap.state || "idle";

      if (state === "idle") {
        trap.raise = Math.max(0, (trap.raise || 0) - 0.16 * dt);
        if (player.x + player.w > trap.triggerX) {
          trap.state = "warning";
          trap.timer = warnDuration;
        }
        continue;
      }

      if (state === "warning") {
        trap.timer = (trap.timer || warnDuration) - dt;
        trap.raise = Math.max(0, (trap.raise || 0) - 0.12 * dt);
        if (trap.timer <= 0) {
          trap.state = "active";
          trap.timer = activeDuration;
        }
        continue;
      }

      if (state === "active") {
        trap.raise = Math.min(1, (trap.raise || 0) + 0.16 * dt);
        trap.timer = (trap.timer || activeDuration) - dt;
        if (trap.timer <= 0) {
          trap.state = "cooldown";
          trap.timer = coolDuration;
        }
        continue;
      }

      trap.raise = Math.max(0, (trap.raise || 0) - 0.2 * dt);
      trap.timer = (trap.timer || coolDuration) - dt;
      if (trap.timer <= 0 && activeRange) {
        trap.state = "warning";
        trap.timer = warnDuration;
      }
    }
  }

  function updateFallBlocks(dt) {
    if (isTimeBurstStopActive()) return;
    for (const block of stage.fallBlocks) {
      if (block.destroyed) {
        block.debrisTimer = Math.max(0, (block.debrisTimer || 0) - dt);
        continue;
      }

      if (block.state === "idle" && player.x + player.w > block.triggerX) {
        block.state = "warning";
        block.timer = block.warnDuration;
      }

      if (block.state === "warning") {
        block.timer -= dt;
        if (block.timer <= 0) {
          block.state = "fall";
        }
      }

      if (block.state === "fall") {
        block.vy += 0.42 * dt;
        block.y += block.vy * dt;

        if (overlap(player, block)) {
          killPlayer("天井トラップで即死");
        }

        if (block.y > H + 70) {
          block.state = "gone";
        }
      }
    }
  }

  function updateCannons(dt) {
    if (isTimeBurstStopActive()) return;
    const routeBoost = gameState === STATE.PLAY;
    const cannonRateMul = routeBoost ? ROUTE_CANNON_RATE_MUL : 1;
    const projectileSpeedMul = routeBoost ? ROUTE_PROJECTILE_SPEED_MUL : 1;

    for (const cannon of stage.cannons) {
      if (cannon.destroyed) {
        cannon.debrisTimer = Math.max(0, (cannon.debrisTimer || 0) - dt);
        continue;
      }

      cannon.muzzleFlash = Math.max(0, (cannon.muzzleFlash || 0) - dt);
      if (!cannon.active && player.x + player.w > cannon.triggerX) {
        cannon.active = true;
      }

      if (!cannon.active) continue;

      cannon.cool -= dt * cannonRateMul;
      cannon.warning = cannon.cool > 0 && cannon.cool <= CANNON_WARN_WINDOW;
      if (cannon.cool <= 0) {
        const bx = cannon.dir < 0 ? cannon.x - 9 : cannon.x + 7;
        stage.hazardBullets.push({
          x: bx,
          y: cannon.y + 1,
          w: 9,
          h: 7,
          vx: cannon.dir * CANNON_BULLET_SPEED * projectileSpeedMul,
          kind: "cannon",
          reason: "砲台の弾に被弾",
        });
        cannon.muzzleFlash = 10;
        playProjectileSfx("cannon");
        cannon.warning = false;
        cannon.cool = cannon.interval + CANNON_EXTRA_COOLDOWN + Math.random() * 24;
      }
    }
  }

  function spawnGimmickBreakFx(x, y, power = 1) {
    const p = clamp(power, 0.8, 3.4);
    triggerImpact(1.8 + p * 0.42, x, y, 2.8 + p * 0.48);
    spawnHitSparks(x, y, "#dfe8ff", "#8ea0bc");
    spawnHitSparks(x, y, "#ffd8aa", "#8f5e4b");
    playKickSfx(1.54 + p * 0.18);
  }

  function destroyCannon(cannon, power = 1) {
    if (cannon.destroyed) return false;
    cannon.destroyed = true;
    cannon.active = false;
    cannon.warning = false;
    cannon.cool = 1e9;
    cannon.muzzleFlash = 0;
    cannon.debrisTimer = 82;

    const cx = cannon.x + (cannon.dir > 0 ? 1 : -1);
    const cy = cannon.y + 2;
    spawnGimmickBreakFx(cx, cy, 1.1 + power * 0.4);
    registerGimmickBreakRank(cx, cy, 1.05 + power * 0.22, "gimmick_cannon");
    if (cannon.bossArenaTarget) {
      registerBossArenaTargetDestroyed("gimmick", cx, cy);
    }

    for (const bullet of stage.hazardBullets) {
      if (bullet.dead || bullet.kind !== "cannon") continue;
      if (Math.abs(bullet.x - cannon.x) <= 56) {
        bullet.dead = true;
      }
    }
    return true;
  }

  function destroyFallBlock(block, power = 1) {
    if (block.destroyed || block.state === "gone") return false;
    block.destroyed = true;
    block.state = "gone";
    block.vy = 0;
    block.timer = 0;
    block.debrisTimer = 92;
    const cx = block.x + block.w * 0.5;
    const cy = block.y + block.h * 0.45;
    spawnGimmickBreakFx(cx, cy, 0.9 + power * 0.35);
    registerGimmickBreakRank(cx, cy, 0.95 + power * 0.2, "gimmick_fall");
    if (block.bossArenaTarget) {
      registerBossArenaTargetDestroyed("gimmick", cx, cy);
    }
    return true;
  }

  function destroyPopSpike(trap, power = 1) {
    if (trap.destroyed) return false;
    trap.destroyed = true;
    trap.state = "destroyed";
    trap.timer = 0;
    trap.raise = 0;
    trap.debrisTimer = 84;
    const cx = trap.x + trap.w * 0.5;
    const cy = trap.y + trap.h * 0.5;
    spawnGimmickBreakFx(cx, cy, 0.86 + power * 0.32);
    registerGimmickBreakRank(cx, cy, 0.9 + power * 0.18, "gimmick_trap");
    if (trap.bossArenaTarget) {
      registerBossArenaTargetDestroyed("gimmick", cx, cy);
    }
    return true;
  }

  function destroyCrumbleSolid(solid, power = 1) {
    if (solid.kind !== "crumble" || solid.state === "gone") return false;
    solid.state = "gone";
    solid.timer = 0;
    const cx = solid.x + solid.w * 0.5;
    const cy = solid.y + solid.h * 0.5;
    spawnGimmickBreakFx(cx, cy, 0.84 + power * 0.3);
    registerGimmickBreakRank(cx, cy, 0.88 + power * 0.17, "gimmick_crumble");
    if (solid.bossArenaTarget) {
      registerBossArenaTargetDestroyed("gimmick", cx, cy);
    }
    return true;
  }

  function hitBreakableGimmicks(hitBox, power = 1) {
    let broken = 0;
    let poleLockedTouched = false;
    const canBreakPole = battleRankIndex >= POLE_BREAK_MIN_RANK_INDEX;

    for (const cannon of stage.cannons) {
      if (cannon.destroyed) continue;
      const cannonHit = { x: cannon.x - 10, y: cannon.y - 4, w: 20, h: 13 };
      if (!overlap(hitBox, cannonHit)) continue;
      if (destroyCannon(cannon, power)) {
        broken += 1;
      }
    }

    for (const block of stage.fallBlocks) {
      if (block.destroyed || block.state === "gone") continue;
      if (!overlap(hitBox, block)) continue;
      if (destroyFallBlock(block, power)) {
        broken += 1;
      }
    }

    for (const trap of stage.popSpikes) {
      if (trap.destroyed) continue;
      const trapTop = trap.y + trap.h - Math.max(2, Math.round(trap.h * Math.max(0.15, trap.raise || 0)));
      const trapHit = { x: trap.x, y: trapTop, w: trap.w, h: Math.max(2, trap.h) };
      if (!overlap(hitBox, trapHit)) continue;
      if (!canBreakPole) {
        poleLockedTouched = true;
        continue;
      }
      if (destroyPopSpike(trap, power)) {
        broken += 1;
      }
    }

    for (const solid of stage.solids) {
      if (solid.kind !== "crumble" || solid.state === "gone") continue;
      if (!overlap(hitBox, solid)) continue;
      if (destroyCrumbleSolid(solid, power)) {
        broken += 1;
      }
    }

    if (broken > 0) {
      hudMessage = broken > 1 ? `ギミック破壊 x${broken}!` : "ギミック破壊!";
      hudTimer = Math.max(hudTimer, 34);
    } else if (poleLockedTouched) {
      hudMessage = "電撃ポールはSランク以上で破壊";
      hudTimer = Math.max(hudTimer, 24);
    }

    return broken;
  }

  function updateHazardBullets(dt, solids) {
    if (isTimeBurstStopActive()) return;
    for (const bullet of stage.hazardBullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * dt;

      const hit = bullet.kind === "cannon"
        ? { x: bullet.x + 1.5, y: bullet.y + 1.5, w: Math.max(2, bullet.w - 3), h: Math.max(2, bullet.h - 3) }
        : bullet;
      const touchingPlayer = overlap(player, hit);
      if (touchingPlayer) {
        // Royal Guard: absorb hazard bullets during block (Just Guard aware)
        if (playerStyle === "royalguard" && royalGuardBlockTimer > 0) {
          bullet.dead = true;
          applyRoyalGuardSuccess(20, 1.5, "GUARD!");
          continue;
        }
        killPlayer(bullet.reason || "飛び道具に被弾");
      } else {
        tryRegisterProjectileGraze(bullet, hit, bullet.kind === "cannon" ? 1.08 : 0.92);
      }

      if (bullet.x < -20 || bullet.x > stage.width + 20) {
        bullet.dead = true;
        continue;
      }

      for (const s of solids) {
        if (overlap(bullet, s)) {
          bullet.dead = true;
          break;
        }
      }
    }

    stage.hazardBullets = stage.hazardBullets.filter((b) => !b.dead);
  }

  function updateEnemies(dt, solids) {
    if (isTimeBurstStopActive()) return;
    const routeBoost = gameState === STATE.PLAY;
    const routeEnemyDtMul = routeBoost ? ROUTE_ENEMY_DT_MUL : 1;
    const routeProjectileMul = routeBoost ? ROUTE_PROJECTILE_SPEED_MUL : 1;
    const blackSlowRatio = clamp(
      Math.max(
        blackFlashTimer > 0 ? blackFlashTimer / 52 : 0,
        blackFlashSlowTimer > 0 ? blackFlashSlowTimer / BLACK_FLASH_SLOW_DURATION : 0
      ),
      0,
      1
    );
    const highModeSlowScale = isBlackFlashHighMode() ? BLACK_FLASH_HIGHMODE_ENEMY_SLOW_SCALE : 1;
    const enemyDt =
      dt *
      (1 - blackSlowRatio * (1 - BLACK_FLASH_ENEMY_SLOW_SCALE)) *
      highModeSlowScale *
      routeEnemyDtMul;

    for (const enemy of stage.enemies) {
      if (!enemy.alive) continue;
      enemy.flash = Math.max(0, (enemy.flash || 0) - enemyDt);
      enemy.hitstun = Math.max(0, (enemy.hitstun || 0) - enemyDt);

      if (enemy.kicked) {
        if ((enemy.kickDespawn || 0) > 0) {
          enemy.kickDespawn -= enemyDt;
          if (enemy.kickDespawn <= 0) {
            enemy.alive = false;
            continue;
          }
        }
        enemy.vy = Math.min(enemy.vy + GRAVITY * enemyDt, MAX_FALL);
        enemy.vx *= Math.pow(0.97, enemyDt);
        moveWithCollisions(enemy, solids, enemyDt);

        if (enemy.y > H + 90 || enemy.x < -90 || enemy.x > stage.width + 90) {
          enemy.alive = false;
        }
        continue;
      }

      if (enemy.hitstun > 0) {
        if (enemy.launchTimer > 0) enemy.launchTimer -= enemyDt;
        enemy.vy = Math.min(enemy.vy + GRAVITY * enemyDt, MAX_FALL);
        enemy.vx *= Math.pow(enemy.kind === "bruiser" ? 0.9 : 0.84, enemyDt);
        if (enemy.launchTimer > 0) {
          // During launch: move freely without ground collision
          enemy.x += enemy.vx * enemyDt;
          enemy.y += enemy.vy * enemyDt;
          enemy.onGround = false;
        } else {
          moveWithCollisions(enemy, solids, enemyDt);
        }
        if (enemy.x <= enemy.minX) {
          enemy.x = enemy.minX;
          enemy.dir = 1;
        } else if (enemy.x >= enemy.maxX) {
          enemy.x = enemy.maxX;
          enemy.dir = -1;
        }
        continue;
      }

      if (enemy.kind === "peacock") {
        enemy.chargeCooldown = Math.max(0, (enemy.chargeCooldown || 0) - enemyDt);
        enemy.windupTimer = Math.max(0, (enemy.windupTimer || 0) - enemyDt);
        enemy.chargeTimer = Math.max(0, (enemy.chargeTimer || 0) - enemyDt);
        enemy.recoverTimer = Math.max(0, (enemy.recoverTimer || 0) - enemyDt);

        const px = player.x + player.w * 0.5;
        const ex = enemy.x + enemy.w * 0.5;
        const lane = Math.abs((player.y + player.h * 0.5) - (enemy.y + enemy.h * 0.5)) < 30;
        const towardPlayer = (px - ex) * enemy.dir > 0;

        if (enemy.mode === "windup") {
          enemy.vx *= Math.pow(0.72, enemyDt);
          if (enemy.windupTimer <= 0) {
            enemy.mode = "charge";
            enemy.chargeTimer = 26;
            enemy.flash = 12;
          }
        } else if (enemy.mode === "charge") {
          enemy.vx = enemy.dir * enemy.chargeSpeed;
          if (enemy.chargeTimer <= 0) {
            enemy.mode = "recover";
            enemy.recoverTimer = 18;
            enemy.chargeCooldown = 98;
          }
        } else if (enemy.mode === "recover") {
          enemy.vx *= Math.pow(0.78, enemyDt);
          if (enemy.recoverTimer <= 0) {
            enemy.mode = "patrol";
          }
        } else {
          enemy.vx = enemy.speed * enemy.dir;
          if (
            enemy.onGround &&
            enemy.chargeCooldown <= 0 &&
            lane &&
            towardPlayer &&
            Math.abs(px - ex) < 170
          ) {
            enemy.mode = "windup";
            enemy.windupTimer = 24;
            enemy.vx = enemy.dir * 0.16;
            enemy.flash = 10;
          }
        }

        enemy.vy = Math.min(enemy.vy + GRAVITY * enemyDt, MAX_FALL);
        moveWithCollisions(enemy, solids, enemyDt);

        if (enemy.x <= enemy.minX) {
          enemy.x = enemy.minX;
          enemy.dir = 1;
          if (enemy.mode === "charge") {
            enemy.mode = "recover";
            enemy.recoverTimer = 14;
            enemy.chargeCooldown = 102;
          }
        } else if (enemy.x >= enemy.maxX) {
          enemy.x = enemy.maxX;
          enemy.dir = -1;
          if (enemy.mode === "charge") {
            enemy.mode = "recover";
            enemy.recoverTimer = 14;
            enemy.chargeCooldown = 102;
          }
        }

        if (enemy.onGround) {
          const frontX = enemy.dir > 0 ? enemy.x + enemy.w + 1 : enemy.x - 1;
          const footY = enemy.y + enemy.h + 1;
          if (!pointInSolids(frontX, footY, solids)) {
            enemy.dir *= -1;
            if (enemy.mode === "charge") {
              enemy.mode = "recover";
              enemy.recoverTimer = 14;
              enemy.chargeCooldown = 108;
            }
          }
        }
        continue;
      }

      enemy.vx = enemy.speed * enemy.dir;
      enemy.vy = Math.min(enemy.vy + GRAVITY * enemyDt, MAX_FALL);

      if (enemy.hop && enemy.onGround) {
        enemy.hopTimer -= enemyDt;
        if (enemy.hopTimer <= 0) {
          enemy.vy = -5.0;
          enemy.hopTimer = enemy.hopInterval;
        }
      }

      moveWithCollisions(enemy, solids, enemyDt);

      if (enemy.x <= enemy.minX) {
        enemy.x = enemy.minX;
        enemy.dir = 1;
      } else if (enemy.x >= enemy.maxX) {
        enemy.x = enemy.maxX;
        enemy.dir = -1;
      }

      if (enemy.onGround) {
        const frontX = enemy.dir > 0 ? enemy.x + enemy.w + 1 : enemy.x - 1;
        const footY = enemy.y + enemy.h + 1;
        if (!pointInSolids(frontX, footY, solids)) {
          enemy.dir *= -1;
        }
      }

      if (enemy.shooter) {
        enemy.shootCooldown -= enemyDt;
        const dx = (player.x + player.w * 0.5) - (enemy.x + enemy.w * 0.5);
        const inRange = Math.abs(dx) < 178 && Math.abs(player.y - enemy.y) < 52;
        const facingTarget = dx * enemy.dir > 0;

        if (enemy.shootCooldown <= 0 && inRange && facingTarget) {
          stage.hazardBullets.push({
            x: enemy.dir > 0 ? enemy.x + enemy.w + 1 : enemy.x - 6,
            y: enemy.y + 7,
            w: 6,
            h: 4,
            vx: enemy.dir * 1.55 * routeProjectileMul,
            kind: "enemy",
            reason: "敵の飛び道具に被弾",
          });
          enemy.shootCooldown = enemy.shootInterval + Math.random() * 36;
          enemy.flash = 8;
          playProjectileSfx("enemy");
        }
      }
    }

    stage.enemies = stage.enemies.filter((e) => e.alive);
  }

  function updateProteins(dt) {
    for (const protein of stage.proteins) {
      protein.bob += 0.08 * dt;
      if (protein.collected) continue;

      const floatY = protein.y + Math.sin(protein.bob) * 1.7;
      const hit = { x: protein.x, y: floatY, w: protein.w, h: protein.h };

      if (!overlap(player, hit)) continue;

      protein.collected = true;
      collectedProteinIds.add(protein.id);
      const pLv = proteinLevel();
      const speedPct = Math.round(pLv * 2.2);
      proteinRushTimer = Math.min(90, proteinRushTimer + 44);
      addProteinBurstGauge(PROTEIN_BURST_GAIN_PROTEIN);
      registerProteinRankGain(protein.x + protein.w * 0.5, floatY + protein.h * 0.5);
      const lifeUp = pLv % PROTEIN_LIFE_UP_STEP === 0;
      if (lifeUp) {
        playerLives = Math.min(99, playerLives + 1);
        hudMessage = `PROTEIN ${pLv}! 1UP`;
        hudTimer = 90;
        playCheckpointSfx();
      } else {
        hudMessage = `PROTEIN BOOST! SPD +${speedPct}%`;
        hudTimer = 64;
      }
      playPowerupSfx();
      triggerImpact(0.9, protein.x + protein.w * 0.5, floatY + protein.h * 0.5, 1.4);
    }
  }

  function updateHeartItems(dt) {
    for (const item of stage.heartItems) {
      item.bob += 0.09 * dt;
      if (item.collected) continue;

      const floatY = item.y + Math.sin(item.bob) * 1.5;
      const hit = { x: item.x, y: floatY, w: item.w, h: item.h };
      if (!overlap(player, hit)) continue;

      item.collected = true;
      const before = playerHearts;
      playerHearts = Math.min(MAX_HEARTS, playerHearts + 1);
      playPowerupSfx();
      playCheckpointSfx();
      triggerImpact(0.85, item.x + item.w * 0.5, floatY + item.h * 0.5, 1.2);
      if (playerHearts > before) {
        hudMessage = "ハート回復!";
        hudTimer = 56;
      } else {
        hudMessage = "ハート満タン";
        hudTimer = 38;
      }
    }
  }

  function updateLifeUpItems(dt) {
    for (const item of stage.lifeUpItems) {
      item.bob += 0.095 * dt;
      if (item.collected) continue;

      const floatY = item.y + Math.sin(item.bob) * 1.7;
      const hit = { x: item.x, y: floatY, w: item.w, h: item.h };
      if (!overlap(player, hit)) continue;

      item.collected = true;
      collectedLifeUpIds.add(item.id);
      playerLives = Math.min(99, playerLives + 1);
      playPowerupSfx();
      playCheckpointSfx();
      triggerImpact(1.15, item.x + item.w * 0.5, floatY + item.h * 0.5, 2.0);
      hudMessage = "1UP! 残機 +1";
      hudTimer = 90;
    }
  }

  function updateBikes(dt) {
    for (const bike of stage.bikes) {
      bike.bob += 0.11 * dt;
      if (bike.collected) continue;

      const floatY = bike.y + Math.sin(bike.bob) * 1.9;
      const hit = { x: bike.x, y: floatY, w: bike.w, h: bike.h };
      if (!overlap(player, hit)) continue;

      bike.collected = true;
      const started = startInvincibleMode(INVINCIBLE_DURATION);
      playPowerupSfx();
      triggerImpact(1.25, bike.x + bike.w * 0.5, floatY + bike.h * 0.5, 2.2);
      hudMessage = started ? "バイク搭乗! 10秒 無敵" : "無敵中! 時間は延長されない";
      hudTimer = 90;
    }
  }

  function updateWeaponItems(dt) {
    // Hammer/Glove abolished.
    return;
  }

  function releaseChargeAttack(chargeFrames, options = {}) {
    if (!Number.isFinite(chargeFrames)) {
      console.error("releaseChargeAttack called with invalid chargeFrames:", chargeFrames);
      return;
    }

    // Debug log for Freeze investigation
    if (playerStyle === "berserker" && chargeFrames < 10) {
      console.log("releaseChargeAttack (Small Charge):", chargeFrames, options);
    }

    const comboStage = clamp(Math.floor(options.comboStage || 0), 0, ATTACK_MASH_TRIGGER - 1);
    const comboPunch = comboStage > 0;
    const comboType = comboPunch
      ? (comboStage === 1 ? "punch" : comboStage === 2 ? "kick" : "upper")
      : "none";
    const forcePunch = options.forcePunch === true;
    const hyakuretsuFinisher = options.hyakuretsuFinisher === true;
    const shoryuFinisher = hyakuretsuFinisher;
    const chargeRatio = clamp(chargeFrames / ATTACK_CHARGE_MAX, 0, 1);
    const maxChargeMorningStar = !forcePunch && chargeFrames >= ATTACK_CHARGE_MAX - 1;
    const strongWave = false;
    const morningStarSpin = !forcePunch && !comboPunch && !maxChargeMorningStar
      && chargeFrames >= ATTACK_MORNINGSTAR_SPIN_MIN
      && chargeFrames < ATTACK_MORNINGSTAR_CHARGE_MIN;

    if (morningStarSpin && seWhipSwing) {
      playSound(seWhipSwing, 1.0);
    }

    const morningStarStrike = !forcePunch && !comboPunch && !maxChargeMorningStar
      && !morningStarSpin
      && chargeFrames >= ATTACK_MORNINGSTAR_CHARGE_MIN;
    const morningStarLong = morningStarStrike && chargeFrames >= ATTACK_MORNINGSTAR_LONG_MIN;
    const comboYOffset = comboType === "kick" ? 5 : comboType === "upper" ? 1 : 2;
    const comboBaseY = comboType === "kick" ? 11 : comboType === "upper" ? 7 : 6;
    const strikeYOffset = maxChargeMorningStar ? -8 : morningStarStrike ? 0 : comboPunch ? comboYOffset : 2;
    const strikeBaseY = morningStarStrike ? 12 : comboPunch ? comboBaseY : maxChargeMorningStar ? 4 : 6;
    const comboHitH = comboType === "kick" ? 10 + Math.floor(chargeRatio * 2) : comboType === "upper" ? 13 + Math.floor(chargeRatio * 2) : 10 + Math.floor(chargeRatio * 2);
    const comboReachBonus = comboType === "kick" ? 3 : comboType === "upper" ? 1 : 0;
    const comboPowerBonus = comboType === "kick" ? 0.16 : comboType === "upper" ? 0.22 : comboType === "punch" ? 0.08 : 0;
    const comboVxBonus = comboType === "kick" ? 0.62 : comboType === "upper" ? 0.18 : 0;
    const comboVyBonus = comboType === "upper" ? 1.05 : comboType === "kick" ? -0.22 : 0;
    const pLv = proteinLevel();
    const crisisMul = pinchAttackMultiplier();
    const rankBoost = battleRankAttackBoost();
    const rankRangeMul = rankBoost.rangeMul;
    const rankPowerMul = rankBoost.powerMul;
    const rankKnockMul = rankBoost.knockMul;
    const rankGimmickMul = rankBoost.gimmickMul;
    const rankFxMul = rankBoost.effectMul;
    const dir = player.facing;
    const px = player.x + player.w * 0.5;
    const baseSpinRadiusX = 20 + Math.floor(chargeRatio * 22);
    const baseSpinRadiusY = 15 + Math.floor(chargeRatio * 16);
    const spinRadiusX = Math.max(12, Math.floor(baseSpinRadiusX * (1 + (rankRangeMul - 1) * 0.9)));
    const spinRadiusY = Math.max(10, Math.floor(baseSpinRadiusY * (1 + (rankRangeMul - 1) * 0.85)));
    const baseReach = maxChargeMorningStar
      ? 45 + Math.floor(chargeRatio * 10) // Reduced from 55
      : morningStarStrike
        ? 20 + Math.floor(chargeRatio * 18) + (morningStarLong ? 10 : 0)
        : morningStarSpin
          ? 12 + Math.floor(chargeRatio * 12)
          : comboPunch
            ? 12 + comboStage * 4 + comboReachBonus + Math.floor(chargeRatio * 4)
            : 12 + Math.floor(chargeRatio * 50);
    const reach = Math.max(10, Math.floor((baseReach + (hyakuretsuFinisher ? 6 : 0)) * rankRangeMul));
    const rankHitHBonus = Math.max(0, Math.floor(rankBoost.blend * 4));
    let hitBox = {
      x: dir > 0 ? player.x + player.w - 1 : player.x - reach + 1,
      y: player.y + strikeBaseY + strikeYOffset,
      w: reach,
      h: (morningStarStrike ? 12 + Math.floor(chargeRatio * 4) : comboPunch ? comboHitH : 13 + Math.floor(chargeRatio * 8)) + rankHitHBonus,
    };
    const hitBoxes = [hitBox];
    if (shoryuFinisher) {
      const shoryuReach = Math.max(12, Math.floor((14 + chargeRatio * 14) * rankRangeMul));
      const shoryuHeight = Math.max(16, 18 + Math.floor(chargeRatio * 6) + rankHitHBonus);
      hitBox = {
        x: dir > 0 ? player.x + player.w - 2 : player.x - shoryuReach + 2,
        y: player.y - 8,
        w: shoryuReach,
        h: shoryuHeight,
      };
      hitBoxes.length = 0;
      hitBoxes.push(hitBox);
    }
    if (morningStarSpin) {
      const spinBox = {
        x: px - spinRadiusX,
        y: player.y + player.h * 0.5 - spinRadiusY,
        w: spinRadiusX * 2,
        h: spinRadiusY * 2,
      };
      const spinTop = {
        x: px - Math.floor(spinRadiusX * 0.7),
        y: player.y - 8,
        w: Math.floor(spinRadiusX * 1.4),
        h: 12,
      };
      const spinBottom = {
        x: px - Math.floor(spinRadiusX * 0.82),
        y: player.y + player.h - 4,
        w: Math.floor(spinRadiusX * 1.64),
        h: 12,
      };
      const spinRoot = {
        x: px - 8,
        y: player.y + 6,
        w: 16,
        h: 14,
      };
      hitBox = spinBox;
      hitBoxes.length = 0;
      hitBoxes.push(spinBox, spinTop, spinBottom, spinRoot);
    }
    if (morningStarStrike) {
      const overheadBox = {
        x: dir > 0 ? player.x + player.w - 4 : player.x - 6,
        y: player.y - 8,
        w: 10 + Math.max(0, Math.floor(rankBoost.blend * 3)),
        h: 16 + Math.max(0, Math.floor(rankBoost.blend * 3)),
      };
      hitBox = {
        x: dir > 0 ? player.x + player.w - 1 : player.x - reach + 1,
        y: player.y + 12,
        w: reach,
        h: 12 + Math.floor(chargeRatio * 3) + rankHitHBonus,
      };
      hitBoxes.length = 0;
      hitBoxes.push(overheadBox, hitBox);
    }
    const baseRankStyle = shoryuFinisher
      ? "atk1_hyakuretsu_shoryu"
      : strongWave
        ? "atk1_wave"
        : morningStarSpin
          ? "atk1_morning_spin"
          : morningStarStrike
            ? (morningStarLong ? "atk1_morning_long" : "atk1_morning")
            : comboPunch
              ? `atk1_combo_${comboType}`
              : "atk1_punch";
    const tipBoxes = [];
    if (morningStarStrike) {
      const tipW = Math.max(6, Math.floor(hitBox.w * 0.36));
      tipBoxes.push({
        x: dir > 0 ? hitBox.x + hitBox.w - tipW : hitBox.x,
        y: hitBox.y - 2,
        w: tipW,
        h: hitBox.h + 4,
      });
    } else if (maxChargeMorningStar) {
      const tipW = 20; const tipH = 20;
      const tx = dir > 0 ? hitBox.x + hitBox.w - tipW + 4 : hitBox.x - 4;
      const ty = hitBox.y + hitBox.h * 0.5 - tipH * 0.5;
      tipBoxes.push({ x: tx, y: ty, w: tipW, h: tipH });
    } else if (morningStarSpin) {
      const spinBox = hitBoxes[0];
      if (spinBox) {
        const edge = Math.max(3, Math.floor(4 + chargeRatio * 3));
        const innerH = Math.max(1, spinBox.h - edge * 2);
        tipBoxes.push(
          { x: spinBox.x, y: spinBox.y, w: spinBox.w, h: edge },
          { x: spinBox.x, y: spinBox.y + spinBox.h - edge, w: spinBox.w, h: edge },
          { x: spinBox.x, y: spinBox.y + edge, w: edge, h: innerH },
          { x: spinBox.x + spinBox.w - edge, y: spinBox.y + edge, w: edge, h: innerH }
        );
      }
    }
    const overlapsAny = (target) => hitBoxes.some((box) => overlap(box, target));
    const isMorningStarTipHit = (target) => tipBoxes.length > 0 && tipBoxes.some((box) => overlap(box, target));
    const reflectProjectileAsWave = (proj) => {
      if (!proj || !stage.playerWaves) return;
      const projCx = proj.x + (proj.w || 0) * 0.5;
      const projCy = proj.y + (proj.h || 0) * 0.5;
      const projVx = Number.isFinite(proj.vx) ? proj.vx : 0;
      const projVy = Number.isFinite(proj.vy) ? proj.vy : 0;
      const incomingDir = projVx > 0.05 ? 1 : projVx < -0.05 ? -1 : (projCx >= px ? 1 : -1);
      const reflectDir = -incomingDir;
      const waveW = Math.max(10, Math.floor((proj.w || 4) * 1.8));
      const waveH = Math.max(8, Math.floor((proj.h || 4) * 1.5));
      const waveSpeed = (2.3 + Math.abs(projVx) * 0.9 + Math.abs(projVy) * 0.28) * rankKnockMul * reflectDir;
      const waveX = projCx - waveW * 0.5;
      const waveY = projCy - waveH * 0.5;
      stage.playerWaves.push({
        x: waveX,
        y: waveY,
        w: waveW,
        h: waveH,
        vx: waveSpeed,
        ttl: 78 + Math.floor(chargeRatio * 24),
        phase: 0,
        spin: Math.random() * Math.PI * 2,
        power: clamp(0.62 + chargeRatio * 0.7 + rankBoost.blend * 0.22, 0.5, 1.8),
      });
      spawnWaveBurst(projCx, projCy, 0.78 + chargeRatio * 0.45);
      if (seShotgun) playSound(seShotgun, 1.0); // Hadouken/Wave Sound
    };

    let hits = 0;
    let parryHits = 0;
    let parryRewardHits = 0;
    let hitX = morningStarSpin
      ? px
      : morningStarStrike
        ? (dir > 0 ? hitBox.x + hitBox.w - 2 : hitBox.x + 2)
        : px + dir * (12 + reach * 0.48);
    let hitY = morningStarSpin ? player.y + player.h * 0.5 : hitBox.y + hitBox.h * 0.5;
    let parryX = hitX;
    let parryY = hitY;
    const finisherPowerMul = hyakuretsuFinisher ? HYAKURETSU_FINISHER_POWER_MUL : 1;
    const hitPower = (
      0.94
      + chargeRatio * 0.68
      + comboStage * 0.14
      + comboPowerBonus
      + (morningStarStrike ? 0.28 : 0)
      + (morningStarSpin ? 0.22 : 0)
      + pLv * 0.01
    ) * crisisMul * rankPowerMul * finisherPowerMul;
    let blackFlash = false;
    let blackFlashRolled = false;
    const tryBlackFlash = (x, y, power = 1, chanceMul = 1) => {
      if (blackFlashRolled) return blackFlash;
      blackFlashRolled = true;
      blackFlash = rollBlackFlashHit(x, y, power, chanceMul);
      return blackFlash;
    };
    let gimmickBreaks = 0;
    for (const box of hitBoxes) {
      gimmickBreaks += hitBreakableGimmicks(box, (1 + chargeRatio * 0.8) * rankGimmickMul);
    }
    if (gimmickBreaks > 0) {
      hitX = hitBox.x + hitBox.w * 0.5;
      hitY = hitBox.y + hitBox.h * 0.5;
      hits += gimmickBreaks;
    }

    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlapsAny(enemy)) continue;
      const enemyCenterX = enemy.x + enemy.w * 0.5;
      const enemyCenterY = enemy.y + enemy.h * 0.5;
      const tipHit = isMorningStarTipHit(enemy);
      const enemyHpRatio = clamp((enemy.hp || 0) / Math.max(1, enemy.maxHp || 1), 0, 1);
      const tipChanceMul = morningStarStrike && tipHit && enemyHpRatio <= MORNINGSTAR_TIP_BLACKFLASH_DOUBLE_HP_RATIO
        ? MORNINGSTAR_TIP_BLACKFLASH_CHANCE_MUL
        : 1;
      hitX = enemy.x + enemy.w * 0.5;
      hitY = enemy.y + enemy.h * (morningStarSpin ? 0.5 : morningStarStrike ? 0.42 : 0.42);
      const bf = tryBlackFlash(
        hitX,
        hitY,
        1.15 + chargeRatio * 1.4 + comboStage * 0.28 + (morningStarSpin ? 0.24 : 0) + (tipHit ? 0.12 : 0),
        tipChanceMul
      );
      const criticalPowerMul = bf ? BLACK_FLASH_DAMAGE_MUL : 1;
      const tipDamageMul = tipHit ? 1.24 : 1;
      const knockDir = morningStarSpin
        ? (enemyCenterX < px ? -1 : 1)
        : dir;
      kickEnemy(enemy, knockDir, (hitPower + 0.2 + (tipHit ? 0.24 : 0)) * criticalPowerMul * tipDamageMul, {
        immediateRemove: false,
        flyLifetime: 32 + Math.round(chargeRatio * 16),
        blackFlash: bf,
        blackFlashPowerApplied: true,
        rankStyle: tipHit ? `${baseRankStyle}_tip` : baseRankStyle,
      });
      enemy.vx = knockDir * (
        3.8
        + hitPower * 0.95 * criticalPowerMul
        + comboStage * 0.2
        + comboVxBonus
        + (shoryuFinisher ? 0.34 : 0)
        + (morningStarStrike ? 0.8 : 0)
        + (morningStarSpin ? 0.56 : 0)
        + (tipHit ? 0.48 : 0)
      ) * rankKnockMul;
      const spinVertical = morningStarSpin
        ? (enemyCenterY < player.y + player.h * 0.46 ? 0.42 : enemyCenterY > player.y + player.h * 0.64 ? -0.18 : 0.14)
        : 0;
      const liftPower = (
        shoryuFinisher
          ? 4.75 + chargeRatio * 1.12 + (bf ? 0.44 : 0)
          : morningStarStrike
            ? 2.8 + chargeRatio * 0.9 + (morningStarLong ? 0.4 : 0) + (bf ? 0.38 : 0)
            : morningStarSpin
              ? 3.1 + chargeRatio * 0.7 + spinVertical + (bf ? 0.34 : 0)
              : 3.4 + chargeRatio * 1.3 + comboStage * 0.14 + comboVyBonus + (bf ? 0.46 : 0)
      ) * (1 + (rankKnockMul - 1) * 0.82);
      enemy.vy = Math.min(
        enemy.vy,
        -(liftPower) + (tipHit ? 0.42 : 0)
      );
      enemy.flash = 12;
      hits += 1;
    }

    for (const b of stage.hazardBullets) {
      if (!overlapsAny(b)) continue;
      if (morningStarSpin) {
        parryX = b.x + b.w * 0.5;
        parryY = b.y + b.h * 0.5;
        reflectProjectileAsWave(b);
        parryRewardHits += 1;
      }
      b.dead = true;
      hits += 1;
      parryHits += 1;
    }

    for (const bs of stage.bossShots) {
      if (!overlapsAny(bs)) continue;
      if (morningStarSpin && bs.kind !== "rain_warn") {
        parryX = bs.x + bs.w * 0.5;
        parryY = bs.y + bs.h * 0.5;
        reflectProjectileAsWave(bs);
        parryRewardHits += 1;
      }
      bs.dead = true;
      hits += 1;
      parryHits += 1;
    }

    for (const boss of getBossEntities()) {
      if (!overlapsAny(boss) || boss.invuln > 0 || boss.hp <= 0) continue;
      const bossCenterX = boss.x + boss.w * 0.5;
      const tipHit = isMorningStarTipHit(boss);
      if (tipHit && seMorningStarTip) {
        playSound(seMorningStarTip, 1.0);
      }
      const bossHpRatio = clamp((boss.hp || 0) / Math.max(1, boss.maxHp || 1), 0, 1);
      const tipChanceMul = morningStarStrike && tipHit && bossHpRatio <= MORNINGSTAR_TIP_BLACKFLASH_DOUBLE_HP_RATIO
        ? MORNINGSTAR_TIP_BLACKFLASH_CHANCE_MUL
        : 1;
      hitX = bossCenterX;
      hitY = boss.y + boss.h * (morningStarSpin ? 0.5 : morningStarStrike ? 0.42 : shoryuFinisher ? 0.36 : 0.45);
      const bf = tryBlackFlash(
        hitX,
        hitY,
        1.3 + chargeRatio * 1.6 + comboStage * 0.35 + (tipHit ? 0.14 : 0),
        tipChanceMul
      );
      const bossDamageBase = 1 + bossDamageBonus();
      const bossDamage = Math.max(
        1,
        Math.round(
          bossDamageBase *
          crisisMul *
          rankPowerMul *
          (hyakuretsuFinisher ? HYAKURETSU_FINISHER_BOSS_MUL : 1) *
          (bf ? BLACK_FLASH_DAMAGE_MUL : 1) *
          (tipHit ? 1.24 : 1)
        )
      );
      boss.hp = Math.max(0, boss.hp - bossDamage);
      boss.invuln = BOSS_HIT_INVULN_FRAMES;
      const bossDir = morningStarSpin ? (bossCenterX < px ? -1 : 1) : dir;
      boss.vx += bossDir * (
        0.62
        + chargeRatio * 0.38
        + comboVxBonus * 0.45
        + (shoryuFinisher ? 0.24 : 0)
        + (morningStarStrike ? (morningStarLong ? 0.52 : 0.34) : 0)
        + (morningStarSpin ? 0.42 : 0)
        + (bf ? 0.34 : 0)
        + (tipHit ? 0.26 : 0)
      ) * rankKnockMul;
      const bossLiftPower = (
        shoryuFinisher
          ? 2.62 + chargeRatio * 0.52
          : morningStarSpin
            ? 1.86 + chargeRatio * 0.28
            : morningStarStrike
              ? 1.72 + chargeRatio * 0.24 + (morningStarLong ? 0.3 : 0)
              : 1.9 + chargeRatio * 0.36 + comboVyBonus * 0.5
      ) * (1 + (rankKnockMul - 1) * 0.76);
      boss.vy = Math.min(
        boss.vy,
        -(bossLiftPower) - (bf ? 0.24 : 0) - (tipHit ? 0.18 : 0)
      );
      hits += 1;
      handleBossHpZero();
    }

    if (morningStarSpin && parryRewardHits > 0) {
      const rewardHits = Math.min(6, parryRewardHits);
      addProteinBurstGauge(0.6 + rewardHits * 0.34);
      registerNearMissRank(parryX, parryY, 0.9 + rewardHits * 0.18);
    }

    if (maxChargeMorningStar) {
      if (seStrongHit) playSound(seStrongHit, 1.0);
      triggerImpact(2.0, hitX, hitY, 4.0);
      spawnWaveBurst(hitX, hitY, 2.5);
      hitStopTimer = 12;
      impactShakePower = 6;
      impactShakeTimer = 15;
    } else if (strongWave) {
      const waveW = Math.max(16, Math.floor((18 + Math.floor(chargeRatio * 8)) * (1 + (rankRangeMul - 1) * 0.86)));
      const waveH = Math.max(10, Math.floor((12 + Math.floor(chargeRatio * 8)) * (1 + (rankRangeMul - 1) * 0.72)));
      const waveSpeed = (2.8 + chargeRatio * 1.5) * rankKnockMul * dir;
      const waveY = player.y + 7 - Math.floor((waveH - 8) * 0.5);
      stage.playerWaves.push({
        x: dir > 0 ? player.x + player.w + 2 : player.x - waveW - 2,
        y: waveY,
        w: waveW,
        h: waveH,
        vx: waveSpeed,
        ttl: 130 + Math.floor(chargeRatio * 34) + Math.floor(rankBoost.blend * 24),
        phase: 0,
        spin: Math.random() * Math.PI * 2,
        power: clamp(chargeRatio * rankPowerMul + rankBoost.blend * 0.16, 0, 1.85),
      });
      const sx = player.x + player.w * 0.5 + dir * (10 + waveW * 0.25);
      const sy = player.y + player.h * 0.45;
      waveFlashX = sx;
      waveFlashY = sy;
      waveFlashTimer = Math.max(waveFlashTimer, 26 + chargeRatio * 12 + rankBoost.blend * 9);
      waveFlashPower = Math.max(waveFlashPower, (1.1 + chargeRatio * 1.6) * (1 + (rankFxMul - 1) * 0.58));
      spawnWaveBurst(sx, sy, (1.2 + chargeRatio) * (1 + (rankFxMul - 1) * 0.42));
      spawnWaveBurst(sx + dir * 14, sy + 2, (0.9 + chargeRatio * 0.7) * (1 + (rankFxMul - 1) * 0.34));
      playWaveShotSfx(chargeRatio);
    }

    if (hits > 0) {
      if (kickComboTimer > 0) {
        kickCombo = Math.min(99, kickCombo + hits);
      } else {
        kickCombo = hits;
      }
      kickComboTimer = 44;
    }

    triggerKickBurst(hitX, hitY, (1.6 + chargeRatio * 1.2 + comboStage * 0.32 + hits * 0.08) * (1 + (rankFxMul - 1) * 0.5));
    triggerImpact(
      (1.9 + chargeRatio * 1.4 + comboStage * 0.28 + (morningStarStrike ? (morningStarLong ? 0.72 : 0.5) : 0) + (morningStarSpin ? 0.58 : 0) + (strongWave ? 0.9 : 0)) * (1 + (rankFxMul - 1) * 0.46),
      hitX,
      hitY,
      (3.1 + chargeRatio * 1.1 + comboStage * 0.35 + (morningStarStrike ? (morningStarLong ? 0.84 : 0.62) : 0) + (morningStarSpin ? 0.72 : 0) + (strongWave ? 1.3 : 0)) * (1 + (rankFxMul - 1) * 0.54)
    );
    if (strongWave) {
      spawnWaveBurst(hitX, hitY, (1.0 + chargeRatio * 0.8) * (1 + (rankFxMul - 1) * 0.44));
    } else if (morningStarSpin) {
      spawnWaveBurst(px, player.y + player.h * 0.5, (0.95 + chargeRatio * 0.5) * (1 + (rankFxMul - 1) * 0.38));
    } else if (morningStarStrike) {
      spawnWaveBurst(hitX, hitY, (0.95 + chargeRatio * 0.5) * (1 + (rankFxMul - 1) * 0.38));
    }
    playKickSfx(1.16 + chargeRatio * 0.42 + comboStage * 0.08 + (comboType === "kick" ? 0.08 : comboType === "upper" ? 0.16 : 0) + (morningStarStrike ? 0.04 : 0) + (morningStarSpin ? 0.06 : 0) + (blackFlash ? 0.26 : 0));
    if (parryHits > 0) playParrySfx();
    playRilaRobotVoice("attack");
    if (comboPunch) {
      hudMessage = comboType === "kick" ? "2段: キック" : comboType === "upper" ? "3段: アッパー" : "1段: パンチ";
      hudTimer = Math.max(hudTimer, 18);
    } else if (shoryuFinisher) {
      hudMessage = "百裂フィニッシュ: 昇竜拳!";
      hudTimer = Math.max(hudTimer, 30);
    } else if (morningStarSpin) {
      hudMessage = "モーニングスター全方位!";
      hudTimer = Math.max(hudTimer, 20);
    }

    attackCooldown = strongWave
      ? ATTACK_WAVE_COOLDOWN
      : comboPunch
        ? Math.max(4, ATTACK_PUNCH_COOLDOWN - comboStage * 2)
        : morningStarSpin
          ? ATTACK_PUNCH_COOLDOWN + 3
          : morningStarStrike
            ? ATTACK_PUNCH_COOLDOWN + 4
            : ATTACK_PUNCH_COOLDOWN;
    if (shoryuFinisher) {
      attackCooldown = Math.max(attackCooldown, ATTACK_PUNCH_COOLDOWN + 10);
    }
    const baseEffectTimer = strongWave ? 16 : shoryuFinisher ? 18 : comboPunch ? 8 + comboStage * 2 : morningStarSpin ? 24 : morningStarStrike ? 16 : 11;
    attackEffectTimer = Math.round(baseEffectTimer + rankBoost.blend * (strongWave ? 9 : morningStarSpin ? 8 : morningStarStrike ? 6 : 5));
    attackEffectMode = strongWave ? "wave" : shoryuFinisher ? "shoryu" : comboPunch ? `combo${comboStage}` : morningStarSpin ? "morningstar_spin" : morningStarStrike ? "morningstar" : "punch";
    attackEffectPhase = shoryuFinisher
      ? 0.3 + chargeRatio * 2.2
      : comboPunch
        ? comboStage * 0.75 + chargeRatio * 0.8
        : morningStarSpin
          ? 0.8 + chargeRatio * 3.4
          : morningStarStrike
            ? 0.4 + chargeRatio * 1.7
            : chargeRatio * 2.6;
    const baseEffectPower = comboPunch
      ? clamp(0.32 + comboStage * 0.24 + chargeRatio * 0.2, 0, 1)
      : shoryuFinisher
        ? clamp(0.62 + chargeRatio * 0.55, 0, 1)
        : morningStarSpin
          ? clamp(0.56 + chargeRatio * 0.5, 0, 1)
          : morningStarStrike
            ? clamp(0.5 + chargeRatio * 0.55, 0, 1)
            : chargeRatio;
    attackEffectPower = clamp(baseEffectPower * rankFxMul + rankBoost.blend * 0.12, 0, 1.8);

    if (shoryuFinisher) {
      const riseVy = HYAKURETSU_SHORYU_RISE_VY + chargeRatio * HYAKURETSU_SHORYU_RISE_VY_BONUS;
      player.vy = Math.min(player.vy, -riseVy);
      player.vx = clamp(player.vx + dir * HYAKURETSU_SHORYU_FORWARD_BOOST, -3.2, 3.2);
      player.onGround = false;
    }
  }

  function emitHammerShards(x, y, dir, chargeRatio, crisisMul) {
    if (!stage.hammerShards) stage.hammerShards = [];
    const shardCount = 6 + Math.floor(chargeRatio * 4);
    const baseSpeed = 1.9 + chargeRatio * 0.9;
    for (let i = 0; i < shardCount; i += 1) {
      const spread = (i / Math.max(1, shardCount - 1)) * 1.22 - 0.61;
      const vx = dir * (baseSpeed + Math.abs(spread) * 0.9 + Math.random() * 0.4);
      const vy = -(1.8 + Math.max(0, 0.5 - Math.abs(spread)) * 1.4 + Math.random() * 0.4);
      stage.hammerShards.push({
        x: x + dir * (2 + Math.random() * 5),
        y: y - 2 + Math.random() * 5,
        w: 3 + (i % 2),
        h: 2 + (i % 2),
        vx,
        vy,
        ttl: HAMMER_SHARD_LIFE + Math.floor(Math.random() * 14),
        power: 1 + chargeRatio * 1.15 + (crisisMul - 1) * 0.8,
        spin: Math.random() * Math.PI * 2,
        dead: false,
      });
    }
  }

  function releaseHammerAttack(chargeFrames) {
    const chargeRatio = clamp(chargeFrames / ATTACK2_CHARGE_MAX, 0, 1);
    const chargedBreak = chargeFrames >= ATTACK2_BREAK_CHARGE_MIN;
    const pLv = proteinLevel();
    const crisisMul = pinchAttackMultiplier();
    const dir = player.facing;
    const reach = 18 + Math.floor(chargeRatio * 18);
    const sx = dir > 0 ? player.x + player.w - 2 : player.x - reach + 2;
    const sy = player.y + 5;
    const mainBox = { x: sx, y: sy, w: reach, h: 18 };
    const overheadBox = { x: player.x - 4, y: player.y - 10, w: player.w + 8, h: 16 };
    const impactBox = {
      x: (dir > 0 ? player.x + player.w - 10 : player.x - 20) - Math.floor(chargeRatio * 5),
      y: player.y + player.h - 2,
      w: 30 + Math.floor(chargeRatio * 14),
      h: 16,
    };
    const hitBoxes = chargedBreak ? [overheadBox, mainBox, impactBox] : [overheadBox, mainBox];
    const overlapsAny = (obj) => hitBoxes.some((box) => overlap(box, obj));

    let hits = 0;
    let parryHits = 0;
    let hitX = player.x + player.w * 0.5 + dir * (8 + reach * 0.44);
    let hitY = player.y + player.h * 0.6;

    let gimmickBreaks = 0;
    for (const box of hitBoxes) {
      gimmickBreaks += hitBreakableGimmicks(box, 1.45 + chargeRatio * 1.25);
    }
    if (gimmickBreaks > 0) {
      hitX = impactBox.x + impactBox.w * 0.5;
      hitY = impactBox.y + 2;
      hits += gimmickBreaks;
    }

    const enemyPower = (1.72 + chargeRatio * 1.18 + pLv * 0.016) * crisisMul;
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlapsAny(enemy)) continue;
      hitX = enemy.x + enemy.w * 0.5;
      hitY = enemy.y + enemy.h * 0.44;
      kickEnemy(enemy, dir, enemyPower + (chargedBreak ? 0.34 : 0), {
        immediateRemove: false,
        flyLifetime: 36,
        rankStyle: chargedBreak ? "atk2_break" : "atk2_hammer",
      });
      enemy.vx = dir * (4.6 + enemyPower * 1.06 + (chargedBreak ? 0.7 : 0));
      enemy.vy = Math.min(enemy.vy, -(3.9 + chargeRatio * 1.25 + (chargedBreak ? 0.5 : 0)));
      enemy.flash = 13;
      hits += 1;
    }

    for (const bullet of stage.hazardBullets) {
      if (!overlapsAny(bullet)) continue;
      bullet.dead = true;
      hits += 1;
      parryHits += 1;
    }

    for (const shot of stage.bossShots) {
      if (!overlapsAny(shot)) continue;
      shot.dead = true;
      hits += 1;
      parryHits += 1;
    }

    for (const boss of getBossEntities()) {
      if (!overlapsAny(boss) || boss.invuln > 0 || boss.hp <= 0) continue;
      hitX = boss.x + boss.w * 0.5;
      hitY = boss.y + boss.h * 0.42;
      const bf = rollBlackFlashHit(hitX, hitY, 1.28 + chargeRatio * 1.36);
      const baseDamage = 2 + bossDamageBonus() + Math.floor(chargeRatio * 2.2);
      const damage = Math.max(1, Math.round(baseDamage * crisisMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
      boss.hp = Math.max(0, boss.hp - damage);
      boss.invuln = BOSS_HIT_INVULN_FRAMES;
      boss.vx += dir * (0.88 + chargeRatio * 0.46 + (bf ? 0.28 : 0));
      boss.vy = Math.min(boss.vy, -(2.2 + chargeRatio * 0.34 + (bf ? 0.24 : 0)));
      hits += 1;
      handleBossHpZero();
    }

    if (chargedBreak) {
      emitHammerShards(impactBox.x + impactBox.w * 0.5, impactBox.y + 2, dir, chargeRatio, crisisMul);
    }

    if (hits > 0) {
      if (kickComboTimer > 0) {
        kickCombo = Math.min(99, kickCombo + hits);
      } else {
        kickCombo = hits;
      }
      kickComboTimer = 42;
    }

    triggerKickBurst(hitX, hitY, 2.2 + chargeRatio * 1.2 + (chargedBreak ? 0.65 : 0));
    triggerImpact(
      2.5 + chargeRatio * 1.5 + (chargedBreak ? 0.95 : 0),
      hitX,
      hitY,
      4.0 + chargeRatio * 1.55 + (chargedBreak ? 1.2 : 0)
    );
    spawnHitSparks(hitX, hitY, "#ffeec4", "#ff9b6d");
    spawnHitSparks(hitX, hitY, "#fff8de", "#ff6f5c");
    playKickSfx(1.58 + chargeRatio * 0.34 + (chargedBreak ? 0.32 : 0));
    if (parryHits > 0) playParrySfx();
    playRilaRobotVoice("attack");
    if (chargedBreak) {
      hudMessage = "ハンマーブレイク!";
      hudTimer = Math.max(hudTimer, 30);
    }

    attackCooldown = chargedBreak ? ATTACK2_COOLDOWN_CHARGED : ATTACK2_COOLDOWN;
    attackEffectTimer = chargedBreak ? 24 : 18;
    attackEffectMode = "hammer";
    attackEffectPhase = chargeRatio * 2.2;
    attackEffectPower = clamp(0.48 + chargeRatio * 0.6, 0, 1);
    player.vx *= chargedBreak ? 0.6 : 0.72;
  }

  function startHyakuretsuMode(duration = HYAKURETSU_DURATION, autoMode = false) {
    if (hyakuretsuTimer > 0) return;
    const activeDuration = Math.max(HYAKURETSU_HIT_INTERVAL * 2, duration || HYAKURETSU_DURATION);
    hyakuretsuTimer = activeDuration;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = autoMode ? activeDuration : 0;
    hyakuretsuLaneTick = 0;
    attackMaxHoldTimer = 0;
    attackMashCount = 0;
    attackMashTimer = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackEffectTimer = 8;
    attackEffectMode = "hyakuretsu";
    attackEffectPhase = 0;
    attackEffectPower = 0.72;
    hudMessage = autoMode ? "4段: 1秒オート百裂拳!" : "百裂拳!";
    hudTimer = 24;
    playKickSfx(1.78);
    playRilaRobotVoice("attack");
  }

  function performHyakuretsuStrike() {
    const pLv = proteinLevel();
    const crisisMul = pinchAttackMultiplier();
    const rankBoost = battleRankAttackBoost();
    const rankRangeMul = 1 + (rankBoost.rangeMul - 1) * 0.82;
    const rankPowerMul = rankBoost.powerMul;
    const rankKnockMul = rankBoost.knockMul;
    const rankFxMul = rankBoost.effectMul;
    const dir = player.facing;
    const reach = Math.max(11, Math.floor((13 + Math.min(7, Math.floor(pLv * 0.14))) * rankRangeMul));
    const laneData = [
      { key: "up", y: player.y + 4, h: 6, reach: Math.max(8, reach - 1) },
      { key: "mid", y: player.y + 10, h: 6, reach: reach + 1 },
      { key: "low", y: player.y + 16, h: 6, reach: reach },
    ];
    const laneBoxes = laneData.map((lane) => ({
      x: dir > 0 ? player.x + player.w - 2 : player.x - lane.reach + 2,
      y: lane.y,
      w: lane.reach,
      h: lane.h,
      key: lane.key,
    }));
    const activeLane = hyakuretsuLaneTick % laneBoxes.length;
    hyakuretsuLaneTick = (hyakuretsuLaneTick + 1) % 12;
    const overlapsAnyLane = (obj) => laneBoxes.some((box) => overlap(box, obj));
    const firstLaneIndexFor = (obj) => laneBoxes.findIndex((box) => overlap(box, obj));

    let hits = 0;
    let parryHits = 0;
    let hitX = player.x + player.w * 0.5 + dir * (6 + laneBoxes[activeLane].w * 0.36);
    let hitY = laneBoxes[activeLane].y + laneBoxes[activeLane].h * 0.5;
    const hitPower = (0.86 + pLv * 0.006) * crisisMul * rankPowerMul;
    let blackFlash = false;
    let blackFlashRolled = false;
    const tryBlackFlash = (x, y, power = 1) => {
      if (blackFlashRolled) return blackFlash;
      blackFlashRolled = true;
      blackFlash = rollBlackFlashHit(x, y, power);
      return blackFlash;
    };
    let gimmickBreaks = 0;
    for (const box of laneBoxes) {
      gimmickBreaks += hitBreakableGimmicks(box, (1 + pLv * 0.015) * rankBoost.gimmickMul);
    }
    if (gimmickBreaks > 0) {
      const lane = laneBoxes[activeLane];
      hitX = lane.x + lane.w * 0.5;
      hitY = lane.y + lane.h * 0.5;
      hits += gimmickBreaks;
    }

    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      const laneIndex = firstLaneIndexFor(enemy);
      if (laneIndex < 0) continue;
      hitX = enemy.x + enemy.w * 0.5;
      hitY = laneBoxes[Math.max(0, laneIndex)].y + 2;
      const bf = tryBlackFlash(hitX, hitY, 1.08 + pLv * 0.02);
      const criticalPowerMul = bf ? BLACK_FLASH_DAMAGE_MUL : 1;
      kickEnemy(enemy, dir, (hitPower + 0.15) * criticalPowerMul, {
        immediateRemove: false,
        flyLifetime: 24,
        blackFlash: bf,
        blackFlashPowerApplied: true,
        rankStyle: "atk1_hyakuretsu",
      });
      enemy.vx = dir * (4.0 + hitPower * 0.72 * criticalPowerMul) * rankKnockMul;
      const laneLift = 2.6 + hitPower * 0.5 + (laneIndex === 0 ? 0.6 : laneIndex === 1 ? 0.2 : -0.1) + (bf ? 0.24 : 0);
      enemy.vy = Math.min(enemy.vy, -(laneLift * (1 + (rankKnockMul - 1) * 0.8)));
      enemy.flash = 10;
      hits += 1;
    }

    for (const bullet of stage.hazardBullets) {
      if (!overlapsAnyLane(bullet)) continue;
      bullet.dead = true;
      parryHits += 1;
    }

    for (const shot of stage.bossShots) {
      if (!overlapsAnyLane(shot)) continue;
      shot.dead = true;
      parryHits += 1;
    }

    for (const boss of getBossEntities()) {
      if (!overlapsAnyLane(boss) || boss.invuln > 0 || boss.hp <= 0) continue;
      hitX = boss.x + boss.w * 0.5;
      hitY = boss.y + boss.h * 0.44;
      const bf = tryBlackFlash(hitX, hitY, 1.2 + pLv * 0.02);
      const baseDamage = 1 + bossDamageBonus();
      const damage = Math.max(1, Math.round(baseDamage * crisisMul * rankPowerMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
      boss.hp = Math.max(0, boss.hp - damage);
      boss.invuln = BOSS_HIT_INVULN_FRAMES;
      boss.vx += dir * (0.48 + (bf ? 0.2 : 0)) * rankKnockMul;
      boss.vy = Math.min(boss.vy, -(1.85 + (bf ? 0.2 : 0)) * (1 + (rankKnockMul - 1) * 0.66));
      hits += 1;
      handleBossHpZero();
    }

    if (hits > 0) {
      if (kickComboTimer > 0) {
        kickCombo = Math.min(99, kickCombo + hits);
      } else {
        kickCombo = hits;
      }
      kickComboTimer = 30;
    }

    if (hits > 0 || parryHits > 0) {
      triggerImpact((1.08 + Math.min(0.8, hits * 0.07)) * (1 + (rankFxMul - 1) * 0.48), hitX, hitY, 1.4 * (1 + (rankFxMul - 1) * 0.54));
      spawnHitSparks(hitX, hitY, "#fff0bc", "#ff9369");
      spawnHitSparks(hitX, hitY, "#ffe6b6", "#ff6b58");
      playKickSfx(1.36 + Math.random() * 0.18 + (blackFlash ? 0.2 : 0));
      if (Math.random() < 0.36) {
        playRilaRobotVoice("attack");
      }
    }
    if (parryHits > 0) {
      playParrySfx();
    }

    attackEffectTimer = Math.round(6 + rankBoost.blend * 4);
    attackEffectMode = "hyakuretsu";
    attackEffectPhase += 1.28;
    attackEffectPower = clamp((0.62 + hits * 0.06 + parryHits * 0.04) * rankFxMul + rankBoost.blend * 0.06, 0.62, 1.8);
  }

  function triggerHyakuretsuFinisher() {
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    attackMashCount = 0;
    attackMashTimer = 0;
    attackChargeTimer = 0;
    attackMaxHoldTimer = 0;
    attackChargeReadyPlayed = false;
    const finisherCharge = ATTACK_CHARGE_MAX * HYAKURETSU_FINISHER_CHARGE_RATIO;
    releaseChargeAttack(finisherCharge, { forcePunch: true, hyakuretsuFinisher: true });
  }

  function updatePlayerAttack(dt, actions) {
    const playable = gameState === STATE.PLAY || gameState === STATE.BOSS;
    if (!playable) {
      attackMaxHoldTimer = 0;
      if (!input.attack) {
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
      }
      if (!input.attack2) {
        attack2ChargeTimer = 0;
        attack2ChargeReadyPlayed = false;
      }
      attackMashCount = 0;
      attackMashTimer = 0;
      hyakuretsuTimer = 0;
      hyakuretsuHitTimer = 0;
      hyakuretsuAutoTimer = 0;
      return;
    }

    if (input.attack2) {
      attackChargeTimer = 0;
      attackMaxHoldTimer = 0;
      attackChargeReadyPlayed = false;
      attackMashCount = 0;
      attackMashTimer = 0;
      if (hyakuretsuTimer > 0) {
        hyakuretsuTimer = 0;
        hyakuretsuHitTimer = 0;
        hyakuretsuAutoTimer = 0;
        attackCooldown = Math.max(attackCooldown, HYAKURETSU_POST_COOLDOWN);
      }
    }

    if (hyakuretsuTimer > 0) {
      attackChargeTimer = 0;
      attackMaxHoldTimer = 0;
      attackChargeReadyPlayed = false;
      attack2ChargeTimer = 0;
      attack2ChargeReadyPlayed = false;
      if (actions.attackPressed) {
        triggerHyakuretsuFinisher();
        return;
      }
      const autoMode = hyakuretsuAutoTimer > 0;
      if (!autoMode && !input.attack) {
        hyakuretsuTimer = 0;
        hyakuretsuHitTimer = 0;
        hyakuretsuAutoTimer = 0;
        attackCooldown = Math.max(attackCooldown, HYAKURETSU_POST_COOLDOWN);
        return;
      }
      if (autoMode) {
        hyakuretsuAutoTimer = Math.max(0, hyakuretsuAutoTimer - dt);
        hyakuretsuTimer = hyakuretsuAutoTimer;
        if (hyakuretsuTimer <= 0) {
          hyakuretsuHitTimer = 0;
          hyakuretsuAutoTimer = 0;
          attackCooldown = Math.max(attackCooldown, HYAKURETSU_POST_COOLDOWN);
          return;
        }
      } else {
        hyakuretsuTimer = HYAKURETSU_DURATION;
      }
      hyakuretsuHitTimer = Math.max(0, hyakuretsuHitTimer - dt);
      if (hyakuretsuHitTimer <= 0) {
        performHyakuretsuStrike();
        hyakuretsuHitTimer = HYAKURETSU_HIT_INTERVAL;
      }
      return;
    }

    if (attackCooldown > 0) {
      if (!input.attack) {
        attackChargeTimer = 0;
        attackMaxHoldTimer = 0;
        attackChargeReadyPlayed = false;
      }
      if (!input.attack2) {
        attack2ChargeTimer = 0;
        attack2ChargeReadyPlayed = false;
      }
      return;
    }

    if (shotReloadTimer > 0) shotReloadTimer -= dt;

    // --- Swordmaster + charge spin attack ---
    updateSwordmasterAttack(dt, actions);
    return;

    // Legacy style branches (disabled)
    if (playerStyle === "gunner") {
      updateShot(dt, actions);
      attackChargeTimer = 0;
      attackChargeReadyPlayed = false;
      return;
    }
    if (playerStyle === "swordmaster") {
      attackChargeTimer = 0;
      attackChargeReadyPlayed = false;
      updateSwordmasterAttack(dt, actions);
      return;
    }

    if (input.attack2) {
      const beforeCharge2 = attack2ChargeTimer;
      const chargeMul2 = battleRankChargeMultiplier();
      attack2ChargeTimer = Math.min(ATTACK2_CHARGE_MAX, attack2ChargeTimer + dt * chargeMul2);
      if (
        !attack2ChargeReadyPlayed &&
        attack2ChargeTimer >= ATTACK2_BREAK_CHARGE_MIN &&
        beforeCharge2 < ATTACK2_BREAK_CHARGE_MIN
      ) {
        attack2ChargeReadyPlayed = true;
        playChargeReadySfx();
      }
      return;
    }

    if (actions.attack2Released && attack2ChargeTimer > 0) {
      releaseHammerAttack(attack2ChargeTimer);
    }
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;


    if (playerStyle === "berserker") {
      if (input.attack) {
        const beforeCharge = attackChargeTimer;
        const chargeMul = battleRankChargeMultiplier();
        attackChargeTimer = Math.min(ATTACK_CHARGE_MAX, attackChargeTimer + dt * chargeMul);
        attackMaxHoldTimer = 0;
        if (
          !attackChargeReadyPlayed &&
          attackChargeTimer >= ATTACK_WAVE_CHARGE_MIN &&
          beforeCharge < ATTACK_WAVE_CHARGE_MIN
        ) {
          attackChargeReadyPlayed = true;
          playChargeReadySfx();
        }
        return;
      }

      if (actions.attackReleased && attackChargeTimer > 0) {
        const quickTapCombo = attackChargeTimer <= ATTACK_COMBO_TAP_MAX;
        if (quickTapCombo) {
          attackMashCount = attackMashTimer > 0 ? Math.min(ATTACK_MASH_TRIGGER, attackMashCount + 1) : 1;
          attackMashTimer = ATTACK_MASH_WINDOW;
          if (attackMashCount >= ATTACK_MASH_TRIGGER) {
            startHyakuretsuMode(HYAKURETSU_COMBO_AUTO_DURATION, true);
          } else {
            releaseChargeAttack(attackChargeTimer, { forcePunch: true, comboStage: attackMashCount });
          }
        } else {
          attackMashCount = 0;
          attackMashTimer = 0;
          releaseChargeAttack(attackChargeTimer);
        }
      }
      attackChargeTimer = 0;
      attackMaxHoldTimer = 0;
      attackChargeReadyPlayed = false;
    } else {
      // Reset melee charge if not in berserker mode
      attackChargeTimer = 0;
      attackMaxHoldTimer = 0;
      attackChargeReadyPlayed = false;
    }

    updateShot(dt, actions);
  }

  // Ranged Weapon Logic
  let shotMachineGunCount = 0;
  let shotMachineGunFrame = 0;
  let gunnerReloadDelay = 0; // New: Reload vulnerability timer

  function updateShot(dt, actions) {
    if (gameState !== STATE.PLAY && gameState !== STATE.BOSS) return;
    if (deathAnimActive || player.hp <= 0) return;
    if (hitStopTimer > 0) return;

    // Charging - in Gunner mode, use attack button OR shot button
    // Rank Scaling for Max Ammo
    // Rank Scaling for Max Ammo
    const rankIdx = battleRankIndex;
    const baseMax = 15;
    const rankBonus = Math.min(35, Math.round(rankIdx * 35 / 6));
    gunnerMaxAmmo = baseMax + rankBonus;
    // Clamp ammo to current rank max (prevents over-ammo if rank dropped)
    if (gunnerAmmo > gunnerMaxAmmo) gunnerAmmo = gunnerMaxAmmo;

    const shotInput = playerStyle === "gunner" ? input.attack : input.shot;

    // Safety check for reload timer
    if (isNaN(shotReloadTimer)) shotReloadTimer = 0;

    // --- Reload Delay handling ---
    if (gunnerReloadDelay > 0) {
      gunnerReloadDelay -= dt;
      if (gunnerReloadDelay <= 0) {
        // Recalculate max based on current rank to prevent over-reload
        const reloadRankBonus = Math.min(35, Math.round(battleRankIndex * 35 / 6));
        const reloadMax = 15 + reloadRankBonus;
        gunnerMaxAmmo = reloadMax;
        gunnerAmmo = gunnerMaxAmmo;
        gunnerReloadDelay = 0;
        if (stage.damageTexts) {
          stage.damageTexts.push({
            x: player.x, y: player.y - 20, text: "RELOAD OK", life: 40, color: "#00ff00", vy: -1
          });
        }
      }
      return; // Block shooting while reloading
    }

    // Double Tap Reload
    if (playerStyle === "gunner" && actions && actions.attackPressed) {
      const now = performance.now();
      if (now - lastAttackPressTime < RELOAD_DOUBLE_TAP_TIME) {
        if (gunnerAmmo < gunnerMaxAmmo && gunnerReloadDelay <= 0) {
          // Play Pump Sound (Simulated via seShotgun low pitch)
          if (typeof seShotgun !== "undefined" && seShotgun) {
            playSound(seShotgun, 0.35, 0.7);
          }

          gunnerReloadDelay = 45; // ~0.75s
          if (stage.damageTexts) {
            stage.damageTexts.push({
              x: player.x, y: player.y - 20, text: "RELOADING...", life: 25, color: "#ffff00", vy: -0.5
            });
          }
          lastAttackPressTime = 0;
          return;
        }
      }
      lastAttackPressTime = now;
    }

    if (shotInput && shotReloadTimer <= 0) {
      if (playerStyle === "gunner" && gunnerAmmo <= 0) {
        // Play Empty Ammo Click (nc371030.mp3)
        if (typeof seNoAmmo !== "undefined" && seNoAmmo) {
          playSound(seNoAmmo, 1.0); // Louder
        } else if (typeof seHandgun !== "undefined" && seHandgun) {
          playSound(seHandgun, 0.7, 1.8); // High pitch click fallback, louder
        }
        shotReloadTimer = 20; // Prevent spamming click
        return;
      }
      const chargeMul = battleRankChargeMultiplier();
      shotChargeTimer = Math.min(SHOT_CHARGE_MAX, shotChargeTimer + dt * chargeMul);
    } else if (!shotInput) {
      const shotReleased = playerStyle === "gunner" ? !input.attack : !input.shot;
      if (shotChargeTimer > 0 && shotReleased) {
        let tier = 0;
        if (shotChargeTimer >= SHOT_CHARGE_MAX) tier = 3;
        else if (shotChargeTimer >= SHOT_TIER2_THRESHOLD) tier = 2;
        else if (shotChargeTimer >= SHOT_TIER1_THRESHOLD) tier = 1;

        // Initial Fire Check
        // For Machinegun (tier 1), first shot costs 1.
        // For Shotgun (tier 2), we check pellets count inside fireRangedWeapon?
        // For Grenade (tier 3), cost is 10.

        const cost = tier === 3 ? 15 : tier === 2 ? 3 : 1;

        if (gunnerAmmo >= cost) {
          if (tier === 3) {
            gunnerAmmo -= 15;
          } else if (tier === 0) {
            gunnerAmmo--;
          }

          fireRangedWeapon(tier);

          if (tier === 0) {
            const rankIdx = battleRankIndex;
            const reloadBase = rankIdx >= BATTLE_RANK_EX_INDEX ? 0 : Math.max(4, 30 - rankIdx * 4);
            shotReloadTimer = Math.floor(reloadBase * dtShotReloadMul());
          }
        } else {
          // Not enough ammo - prompt reload
          if (typeof seNoAmmo !== "undefined" && seNoAmmo) {
            playSound(seNoAmmo, 0.8);
          }
          const tierName = tier === 3 ? "BAZOOKA(15)" : tier === 2 ? "SHOTGUN" : "FIRE";
          if (stage.damageTexts) {
            stage.damageTexts.push({
              x: player.x, y: player.y - 28, text: `弾不足! RELOAD→攻撃x2`, life: 50, color: "#ffaa00", vy: -0.8
            });
          }
          shotReloadTimer = 15;
        }

        shotChargeTimer = 0;
      } else {
        shotChargeTimer = 0;
      }
    }

    // Machine Gun Burst Handling
    if (shotMachineGunCount > 0) {
      shotMachineGunFrame += dt;
      const rankIdx = battleRankIndex;
      const delay = Math.max(2, 6 - Math.floor(rankIdx * 0.6));
      if (shotMachineGunFrame >= delay) {
        shotMachineGunFrame = 0;
        if (gunnerAmmo > 0) {
          gunnerAmmo--;
          shotMachineGunCount--;
          fireRangedProjectile(1);
          // Only play SE every other bullet to reduce audio overhead
          if (shotMachineGunCount % 2 === 0 && seMachineGun) playSound(seMachineGun, 0.4);
        } else {
          shotMachineGunCount = 0;
        }
      }
    }
  }

  function fireRangedWeapon(tier) {
    if (tier === 3) { // Bazooka
      fireRangedProjectile(3);
      if (seBazooka) playSound(seBazooka, 0.8);
    } else if (tier === 2) { // Shotgun
      const rankIdx = battleRankIndex;
      let pellets = 5;  // Base increased from 3
      if (rankIdx >= BATTLE_RANK_EX_INDEX) pellets = 10;
      else if (rankIdx >= 5) pellets = 9;
      else if (rankIdx >= 3) pellets = 8;
      else if (rankIdx >= 2) pellets = 7;
      else if (rankIdx >= 1) pellets = 6;

      // Consume Ammo = Pellets
      const actualFire = Math.min(gunnerAmmo, pellets);
      if (actualFire > 0) {
        gunnerAmmo -= actualFire;
        // Loop
        // Shotgun Spread: Tighter spread, higher power
        const spreadBase = 0.55 + rankIdx * 0.12;
        const startAngle = -Math.floor(actualFire / 2);
        const dir = player.facing;
        const px = player.x + player.w * 0.5;
        const py = player.y + player.h * 0.45;

        for (let i = 0; i < actualFire; i++) {
          const ang = startAngle + i;
          stage.playerWaves.push({
            kind: "shotgun", x: px + dir * 10, y: py, w: 5, h: 5, vx: dir * 7.5, vy: ang * spreadBase, ttl: 25, power: 0.85 * dtShotPowerMul()
          });
        }
        if (seShotgun) playSound(seShotgun, 0.7);
      }
    } else if (tier === 1) { // Machine Gun
      const rankIdx = battleRankIndex;
      const baseBurst = 3;
      const extra = rankIdx >= BATTLE_RANK_EX_INDEX ? 5 : Math.min(4, rankIdx);
      shotMachineGunCount = baseBurst + extra;
      shotMachineGunFrame = 3;

      // SFX: Rank S+ uses Heavy Machinegun
      if (rankIdx >= 4) { // Rank S is index 4 usually? Check if S=4 or 5. Assuming 4.
        if (typeof seMachineGunHeavy !== "undefined" && seMachineGunHeavy) {
          playSound(seMachineGunHeavy, 0.6);
        } else if (seMachineGun) {
          playSound(seMachineGun, 0.7, 0.85); // Slightly heavier fallback
        }
      } else {
        if (seMachineGun) playSound(seMachineGun, 0.5);
      }
    } else { // Handgun
      fireRangedProjectile(0);
      if (seHandgun) playSound(seHandgun, 0.5);
    }
  }

  function fireRangedProjectile(tier) {
    const dir = player.facing;
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.45;
    const sPow = dtShotPowerMul();

    if (tier === 3) { // Bazooka / Grenade
      const powerBase = 5.5 * sPow;
      const sizeBase = 36;
      stage.playerWaves.push({
        kind: "bazooka", x: px + dir * 20, y: py - 4, w: sizeBase, h: 12, vx: dir * 4.5, vy: 0, ttl: 120, power: powerBase, spin: 0
      });
    } else if (tier === 2) {
      // Handled in fireRangedWeapon
    } else if (tier === 1) { // Machine Gun
      const rankIdx = battleRankIndex;
      const speed = 4.8 + rankIdx * 1.3;
      stage.playerWaves.push({
        kind: "bullet", x: px + dir * 15, y: py + (Math.random() - 0.5) * 6, w: 6, h: 4, vx: dir * speed, vy: (Math.random() - 0.5) * 1.5, ttl: 55, power: 0.4 * sPow
      });
    } else { // Handgun
      const rankIdx = battleRankIndex;
      const speed = 4.5 + rankIdx * 1.2;
      stage.playerWaves.push({
        kind: "bullet", x: px + dir * 15, y: py, w: 8, h: 4, vx: dir * speed, vy: 0, ttl: 65, power: 0.5 * sPow
      });
      // Gunslinger DT: extra angled shot
      if (devilTriggerTimer > 0 && devilTriggerStyle === "gunslinger") {
        stage.playerWaves.push({
          kind: "bullet", x: px + dir * 15, y: py - 4, w: 6, h: 4, vx: dir * speed, vy: -1.2, ttl: 50, power: 0.35 * sPow
        });
        stage.playerWaves.push({
          kind: "bullet", x: px + dir * 15, y: py + 4, w: 6, h: 4, vx: dir * speed, vy: 1.2, ttl: 50, power: 0.35 * sPow
        });
        if (devilTriggerTimer > 0) devilTriggerHitCount++;
      }
    }
  }

  function spawnExplosion(cx, cy, power) {
    // Explosion size scales with power
    const size = 60 + power * 20; // Base size
    stage.playerWaves.push({
      kind: "explosion",
      x: cx,
      y: cy,
      w: size,
      h: size,
      vx: 0,
      vy: 0,
      ttl: 20,
      power: power * 1.5, // High damage
      anim: 0
    });
    triggerImpact(power * 2, cx, cy, 4);
    playKickSfx(1.5); // Use existing SFX or add new one
  }

  // ========== SWORDMASTER SYSTEM ==========

  function updateSwordmasterAttack(dt, actions) {
    const playable = gameState === STATE.PLAY || gameState === STATE.BOSS;
    if (!playable) return;
    if (deathAnimActive || player.hp <= 0) return;
    if (hitStopTimer > 0) return;

    // Devil Trigger update
    if (devilTriggerTimer > 0) {
      devilTriggerTimer -= dt;
      // Royal Guard DT: maintain auto-block aura & energy regen
      if (devilTriggerStyle === "royalguard") {
        royalGuardBlockTimer = Math.max(royalGuardBlockTimer, 8);
        royalGuardEnergy = Math.min(ROYAL_GUARD_MAX_ENERGY, royalGuardEnergy + 0.15 * dt);
      }
      if (devilTriggerTimer <= 0) {
        endDevilTrigger();
      }
    }

    // Combo window decay
    if (swordComboTimer > 0) {
      swordComboTimer -= dt;
      if (swordComboTimer <= 0) {
        swordComboStage = 0;
        swordComboTimer = 0;
      }
    }

    // --- Drive charge / Overdrive burst ---
    if (overdriveBurstCount > 0) {
      overdriveBurstDelay -= dt;
      if (overdriveBurstDelay <= 0) {
        overdriveBurstDelay = 4;
        overdriveBurstCount--;
        fireOverdriveWave(overdriveBurstCount);
      }
      return; // Block other attacks during Overdrive burst
    }
    if (driveChargeActive) {
      if (input.attack && input.down && player.onGround) {
        driveChargeTimer += dt;
        player.vx *= 0.7; // Slow during charge
        if (driveChargeTimer >= DRIVE_CHARGE_TIME && !attackChargeReadyPlayed) {
          hudMessage = "OVERDRIVE READY!";
          hudTimer = 30;
          attackChargeReadyPlayed = true;
          triggerImpact(1.0, player.x + player.w * 0.5, player.y + player.h * 0.5, 2.0);
        }
      } else {
        // Released or conditions changed
        if (driveChargeTimer >= DRIVE_CHARGE_TIME) {
          // OVERDRIVE!
          overdriveBurstCount = OVERDRIVE_WAVES;
          overdriveBurstDelay = 0;
          hudMessage = isDevilTriggerActive() ? "DT OVERDRIVE!" : "OVERDRIVE!";
          hudTimer = 50;
          battleRankGainByStyle("overdrive", 3.0);
          if (seStrongHit) playSound(seStrongHit, 1.0, 0.7);
        }
        driveChargeActive = false;
        driveChargeTimer = 0;
        attackChargeReadyPlayed = false;
      }
    }

    // Track direction hold time for Stinger input (simultaneous press only)
    const movingFwd = (input.right && player.facing > 0) || (input.left && player.facing < 0);
    if (movingFwd) {
      directionHoldTimer += dt;
    } else {
      directionHoldTimer = 0;
    }

    // Real Impact charge/thrust progression — runs before attack block
    if (updateRealImpact(dt)) return;

    // Block attacks during stinger rush / million stab (handled in physics loop)
    if (swordStingerActive || millionStabActive) return;

    // Cooldown decay
    if (dreadnoughtCooldown > 0) dreadnoughtCooldown -= dt;

    // Cooldown
    if (swordAttackCooldown > 0) {
      swordAttackCooldown -= dt;
      return;
    }

    // Direction-based attack on press (DMC style)
    // W/↑/Space = up direction (shared with jump key)
    // A/D = left/right direction (shared with movement keys)
    // If GunStinger was started this frame by updateDedicatedGun, block the sword-combo path
    if (gunStingerActive) return;

    if (actions.attackPressed) {
      // Doppelganger: J+L simultaneous (Trickster) — spawn afterimage that auto-attacks
      if (playerStyle === "trickster" && actions.simulJL && doppelgangerCooldown <= 0) {
        performDoppelganger();
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
        return;
      }
      // Real Impact: J+K simultaneous (Swordmaster, on ground) — charge then burst thrust
      if (playerStyle === "swordmaster" && player.onGround && actions.simulJK) {
        startRealImpactCharge();
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
        return;
      }
      // GunStinger: J+K simultaneous (Gunslinger, on ground, stationary)
      const stationaryGS = !input.left && !input.right && Math.abs(player.vx) < 0.8;
      if (playerStyle === "gunslinger" && player.onGround && actions.simulJK
          && stationaryGS && !gunStingerActive) {
        startGunStinger(player.facing);
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
        return;
      }
      // Stinger: direction+attack (generous 12 frame window)
      const fwd = movingFwd && directionHoldTimer < 12;
      const hasDirection = fwd || input.jump || input.down;
      if (!player.onGround) {
        // Swordmaster: ↓+J in air OR any J after 2nd aerial hit = Prop Shredder
        const smPropReady = playerStyle === "swordmaster" && (input.down || airComboStage >= 2);
        if (smPropReady) {
          performPropShredder();
          airComboCount++;
          airComboDisplayTimer = 90;
          attackChargeTimer = 0;
          // Don't reset airComboStage so player can keep spinning
          return;
        }
        // --- Aerial Rave: 4-stage air combo (DMC style) ---
        // Stage 0,1: horizontal slashes with hang time
        // Stage 2: upward slash (keeps enemies airborne)
        // Stage 3: slam down (Helm Breaker)
        const maxAirStage = playerStyle === "swordmaster" ? 4 : 3;
        if (airComboStage >= maxAirStage) {
          // Final hit: slam down (Helm Breaker)
          player.vy = Math.min(player.vy, 0.2);
          performSwordSlam();
          airComboStage = 0;
        } else if (airComboStage === maxAirStage - 1) {
          // Penultimate: upward slash (Aerial Rave finisher before Helm Breaker)
          player.vy = Math.min(player.vy, -2.5); // Pop up higher
          performAirSlash(airComboStage);
          airComboStage++;
          hudMessage = "AERIAL RAVE!";
          hudTimer = 25;
        } else {
          // Regular air slashes
          player.vy = Math.min(player.vy, -0.3); // Hang in air
          performAirSlash(airComboStage);
          airComboStage++;
        }
        airComboCount++;
        airComboDisplayTimer = 90;
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
        return;
      } else if (hasDirection) {
        // --- Direction attacks (instant on press) ---
        if (input.jump || input.up) {
          performSwordUpper();  // W/↑ + J = High Time (打ち上げ)
        } else if (fwd) {
          performSwordStinger(); // D/A + J = Stinger (突進斬り)
        } else if (input.down) {
          if (playerStyle === "royalguard" && dreadnoughtCooldown <= 0) {
            performDreadnought(); // Royal Guard: ↓+J = Dreadnought (radial slam)
          } else {
            // Start Drive charge
            driveChargeActive = true;
            driveChargeTimer = 0;
            performDrive();       // Down + J = instant Drive (衝撃波)
          }
        }
        attackChargeTimer = 0;
        attackChargeReadyPlayed = false;
        return;
      }
      // No direction: start charging for spin attack (or quick tap combo)
      attackChargeTimer = 1; // Start charge
    }

    // Charge accumulation while J is held (can move while charging)
    if (input.attack && attackChargeTimer > 0) {
      const chargeMul = battleRankChargeMultiplier();
      attackChargeTimer = Math.min(ATTACK_CHARGE_MAX, attackChargeTimer + dt * chargeMul);
      // Play ready SFX when spin threshold is reached
      if (!attackChargeReadyPlayed && attackChargeTimer >= ATTACK_MORNINGSTAR_SPIN_MIN) {
        attackChargeReadyPlayed = true;
        playChargeReadySfx();
      }
      // Allow movement while charging (don't return — let movement code run)
      // But block other attack processing
    }

    // J released — check charge level
    if (actions.attackReleased && attackChargeTimer > 0) {
      if (attackChargeTimer >= ATTACK_CHARGE_MAX - 1) {
        // Max charge → Round Trip (sword throw)
        launchRoundTrip();
      } else if (attackChargeTimer >= ATTACK_MORNINGSTAR_SPIN_MIN) {
        // Charged enough → spin attack (ぐるっと回す)
        releaseChargeAttack(attackChargeTimer);
      } else {
        // Quick tap → normal combo
        performSwordCombo();
      }
      attackChargeTimer = 0;
      attackChargeReadyPlayed = false;
      return;
    }

    // Reset charge if attack not held
    if (!input.attack) {
      attackChargeTimer = 0;
      attackChargeReadyPlayed = false;
    }
  }

  function performSwordCombo() {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const stage_ = swordComboStage;
    const reach = Math.floor((SWORD_COMBO_REACH[stage_] + rankIdx * 2) * dtReachMul());
    const power = SWORD_COMBO_POWER[stage_] * (1 + rankIdx * 0.06) * dtPowerMul();
    const hitH = stage_ === 2 ? 18 : 14;
    const cooldown = Math.max(5, 12 - rankIdx * 0.8);

    const hitBox = {
      x: dir > 0 ? player.x + player.w - 2 : player.x - reach + 2,
      y: player.y + 2,
      w: reach,
      h: hitH,
    };

    swordHitEnemies(hitBox, dir, power, (stage_ === 2 ? 1.2 : 0.8) * dtKnockMul());
    swordHitBoss(hitBox, dir, power);

    const impactPow = (0.8 + stage_ * 0.4) * dtPowerMul();
    triggerImpact(impactPow, player.x + player.w * 0.5 + dir * reach * 0.5, player.y + 10, 1.5 + stage_ * 0.5);
    spawnSwordSlash(dir, stage_ + dtSparkCount());

    if (seWhipSwing) playSound(seWhipSwing, 0.6 + stage_ * 0.1, 1.2 - stage_ * 0.1);

    swordComboStage = (stage_ + 1) % 3;
    swordComboTimer = SWORD_COMBO_WINDOW;
    swordAttackCooldown = cooldown;
    attackEffectTimer = 8 + stage_ * 2;
    attackEffectMode = "sword";
  }

  function performSwordStinger() {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const reach = Math.floor((32 + rankIdx * 3) * dtReachMul());
    const power = (1.8 + rankIdx * 0.12) * dtPowerMul();

    swordStingerActive = true;
    swordStingerTimer = SWORD_STINGER_DURATION;
    damageInvulnTimer = Math.max(damageInvulnTimer, SWORD_STINGER_DURATION + 4);
    millionStabActive = false;
    millionStabTimer = 0;

    const hitBox = {
      x: dir > 0 ? player.x + player.w : player.x - reach,
      y: player.y + 2,
      w: reach,
      h: 16,
    };

    // Catch enemies in stinger — drag them along instead of knocking away
    stingerCaughtEnemies = [];
    const crisisMul = pinchAttackMultiplier();
    const effectivePower = power * crisisMul;
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlap(hitBox, enemy)) continue;
      const bf = rollBlackFlashHit(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 1.1 + power * 0.5);
      kickEnemy(enemy, dir, effectivePower * (bf ? BLACK_FLASH_DAMAGE_MUL : 1), {
        immediateRemove: false,
        flyLifetime: 38,
        rankStyle: "atk1_wave_shot",
        blackFlash: bf,
        blackFlashPowerApplied: true,
      });
      // Instead of knockback, lock enemy to player position
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.flash = 12;
      stingerCaughtEnemies.push(enemy);
      const hx = enemy.x + enemy.w * 0.5;
      const hy = enemy.y + enemy.h * 0.4;
      spawnWaveBurst(hx, hy, 0.6 + power * 0.4);
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
    }
    swordHitBoss(hitBox, dir, power);
    triggerImpact(2.5 * dtPowerMul(), player.x + dir * reach, player.y + 10, 4);
    spawnSwordSlash(dir, 3 + dtSparkCount());

    if (seStrongHit) playSound(seStrongHit, 0.8);
    swordAttackCooldown = 12;
    swordComboStage = 0;
    swordComboTimer = 0;
    attackEffectTimer = 12;
    attackEffectMode = "sword";
    hudMessage = isDevilTriggerActive() ? "DT STINGER!" : "STINGER!";
    hudTimer = 30;
  }

  function performSwordUpper() {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const reach = Math.floor((24 + rankIdx * 2) * dtReachMul());
    const power = (1.0 + rankIdx * 0.06) * dtPowerMul();
    const dtActive = isDevilTriggerActive();

    // Launch player and enemies upward
    player.vy = dtActive ? -8.5 : -7;
    player.onGround = false;

    const hitBox = {
      x: dir > 0 ? player.x + player.w - 4 : player.x - reach + 4,
      y: player.y - 14,
      w: reach,
      h: 34,
    };

    // Direct launch: skip kickEnemy damage, manually launch enemies
    const crisisMul = pinchAttackMultiplier();
    const launchVy = dtActive ? -(12.0 + power * 1.2) : -(9.0 + power * 0.8);
    const launchHistun = dtActive ? 60 : 40;
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlap(hitBox, enemy)) continue;
      if (!enemy.maxHp) {
        enemy.maxHp = Math.max(1, Math.round(enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7));
      }
      if (!Number.isFinite(enemy.hp) || enemy.hp === undefined) enemy.hp = enemy.maxHp;
      enemy.hp = Math.max(1, enemy.hp - 1);
      // Strong upward launch (DMC style) — near-vertical with minimal horizontal push
      enemy.vx = dir * 0.08;
      enemy.vy = launchVy;
      enemy.y -= 6; // Nudge up to clear ground collision
      enemy.onGround = false;
      enemy.launchTimer = 12; // Skip ground collision during initial launch
      enemy.hitstun = Math.max(enemy.hitstun || 0, launchHistun);
      enemy.flash = 14;
      const hx = enemy.x + enemy.w * 0.5;
      const hy = enemy.y + enemy.h * 0.4;
      spawnWaveBurst(hx, hy, dtActive ? 1.4 : 0.8);
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
    }
    swordHitBoss(hitBox, dir, power, true);
    swordUpperHangTimer = SWORD_UPPER_HANG_TIME;
    triggerImpact(dtActive ? 3.5 : 2.2, player.x + player.w * 0.5, player.y, 4);
    spawnSwordSlash(dir, 4 + dtSparkCount());

    if (seStrongHit) playSound(seStrongHit, 0.8, 0.8);
    swordAttackCooldown = 6;
    swordComboStage = 0;
    swordComboTimer = SWORD_COMBO_WINDOW + 30;
    attackEffectTimer = 14;
    attackEffectMode = "sword";
    hudMessage = dtActive ? "DT HIGH TIME!" : "HIGH TIME!";
    hudTimer = 40;
  }

  function performSwordSlam() {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const dtActive = isDevilTriggerActive();
    const reach = Math.floor((SWORD_SLAM_REACH + rankIdx * 3) * dtReachMul());
    const power = (3.0 + rankIdx * 0.15) * dtPowerMul();

    // Large vertical hitbox (top-to-diagonal swing)
    const hitBox = {
      x: dir > 0 ? player.x + player.w - 6 : player.x - reach + 6,
      y: player.y - SWORD_SLAM_HEIGHT * 0.5,
      w: reach,
      h: SWORD_SLAM_HEIGHT + 10,
    };

    swordHitEnemies(hitBox, dir, power, 1.8 * dtKnockMul());
    swordHitBoss(hitBox, dir, power * 1.2);
    triggerImpact(dtActive ? 5.0 : 3.5, player.x + dir * reach * 0.5, player.y, 5);

    // Spawn ground shockwave (bigger in DT)
    stage.playerWaves.push({
      kind: "swordwave",
      x: player.x + dir * 8,
      y: player.y + player.h * 0.3,
      w: reach * (dtActive ? 1.6 : 1.2),
      h: dtActive ? 22 : 16,
      vx: dir * (dtActive ? 3 : 2),
      vy: 0,
      ttl: dtActive ? 28 : 20,
      phase: 0,
      spin: 0,
      power: power * 0.6,
    });

    if (seBazooka) playSound(seBazooka, 0.6, 0.6);
    if (seStrongHit) playSound(seStrongHit, 0.9, 0.7);
    swordAttackCooldown = 22;
    swordComboStage = 0;
    swordComboTimer = 0;
    attackEffectTimer = 18;
    attackEffectMode = "sword";
    hudMessage = dtActive ? "DT HELM BREAKER!" : "HELM BREAKER!";
    hudTimer = 40;
  }

  // --- Drive: forward shockwave (↓+J on ground) ---
  function performDrive() {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const dtActive = isDevilTriggerActive();
    const power = (2.5 + rankIdx * 0.15) * dtPowerMul();
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.4;

    // Close-range slash hitbox
    const reach = Math.floor(30 * dtReachMul());
    const hitBox = {
      x: dir > 0 ? player.x + player.w - 4 : player.x - reach + 4,
      y: player.y + 2,
      w: reach,
      h: 18,
    };
    swordHitEnemies(hitBox, dir, power * 0.8, 1.2 * dtKnockMul());
    swordHitBoss(hitBox, dir, power * 0.8);

    // Launch shockwave projectile
    const waveW = dtActive ? 22 : 16;
    const waveH = dtActive ? 16 : 12;
    const waveSpeed = (3.5 + rankIdx * 0.35) * (dtActive ? 1.3 : 1);
    const waveTtl = dtActive ? 50 : 32;
    stage.playerWaves.push({
      kind: "drive",
      x: px + dir * 12,
      y: py - waveH * 0.5,
      w: waveW,
      h: waveH,
      vx: dir * waveSpeed,
      vy: 0,
      ttl: waveTtl,
      phase: 0,
      spin: 0,
      power: power,
    });
    // DT: spawn a second wave slightly offset
    if (dtActive) {
      stage.playerWaves.push({
        kind: "drive",
        x: px + dir * 20,
        y: py - waveH * 0.5 - 6,
        w: waveW * 0.8,
        h: waveH * 0.8,
        vx: dir * waveSpeed * 1.15,
        vy: 0,
        ttl: waveTtl - 10,
        phase: 0,
        spin: Math.PI * 0.5,
        power: power * 0.6,
      });
    }

    triggerImpact(dtActive ? 4.0 : 2.5, px + dir * 15, py, 4);
    spawnSwordSlash(dir, 3 + dtSparkCount());
    if (seStrongHit) playSound(seStrongHit, 0.8, 0.9);
    if (seWhipSwing) playSound(seWhipSwing, 0.7, 0.7);

    swordAttackCooldown = 18;
    swordComboStage = 0;
    swordComboTimer = 0;
    attackEffectTimer = 14;
    attackEffectMode = "sword";
    hudMessage = dtActive ? "DT DRIVE!" : "DRIVE!";
    hudTimer = 40;
    battleRankGainByStyle("drive", 1.5);
  }

  // --- Real Impact: ↓↓+J swordmaster charged thrust ---
  function startRealImpactCharge() {
    realImpactChargeActive = true;
    realImpactChargeTimer = 0;
    realImpactDir = player.facing;
    player.vx = 0;
    hudMessage = "REAL IMPACT...";
    hudTimer = 30;
    if (seWhipSwing) playSound(seWhipSwing, 0.5, 0.5);
  }

  function updateRealImpact(dt) {
    if (realImpactActive) {
      realImpactTimer -= dt;
      player.vx = realImpactDir * REAL_IMPACT_SPEED;
      damageInvulnTimer = Math.max(damageInvulnTimer, 2);
      const reach = 44 + battleRankIndex * 4;
      const hitBox = {
        x: realImpactDir > 0 ? player.x + player.w : player.x - reach,
        y: player.y - 2,
        w: reach,
        h: player.h + 4,
      };
      // Break walls/gimmicks
      hitBreakableGimmicks(hitBox, 4 + battleRankIndex);
      // Damage enemies/boss (single big hit then launch away)
      const dtActive = isDevilTriggerActive();
      const power = (6.5 + battleRankIndex * 0.5) * dtPowerMul() * (dtActive ? 1.3 : 1);
      swordHitEnemies(hitBox, realImpactDir, power, 2.6 * dtKnockMul());
      swordHitBoss(hitBox, realImpactDir, power * 1.2);
      // Light slash trail (every 4 frames) — toned down from every-frame
      if (Math.floor(realImpactTimer) % 4 === 0) {
        spawnSwordSlash(realImpactDir, 1);
      }
      if (realImpactTimer <= 0) {
        realImpactActive = false;
        triggerImpact(2.2, player.x + realImpactDir * 20, player.y + player.h * 0.5, 2.5);
        if (seStrongHit) playSound(seStrongHit, 0.75, 0.6);
        swordAttackCooldown = 24;
        attackEffectTimer = 10;
        attackEffectMode = "sword";
        battleRankGainByStyle("real_impact", 4.0);
      }
      return true;
    }
    if (!realImpactChargeActive) return false;
    realImpactChargeTimer += dt;
    player.vx *= 0.6; // lock in place
    if (realImpactChargeTimer >= REAL_IMPACT_CHARGE_TIME * 0.8 && !attackChargeReadyPlayed) {
      attackChargeReadyPlayed = true;
      playChargeReadySfx();
    }
    // Subtle spark aura while charging (every 10 frames, one spark)
    if (realImpactChargeTimer % 10 < 1) {
      const px = player.x + player.w * 0.5;
      const py = player.y + player.h * 0.5;
      hitSparks.push({
        x: px + (Math.random() - 0.5) * 10,
        y: py + (Math.random() - 0.5) * 14,
        vx: realImpactDir * (0.3 + Math.random() * 0.5),
        vy: (Math.random() - 0.5) * 0.8,
        life: 10, maxLife: 10,
        color: "#ff5533",
      });
    }
    if (realImpactChargeTimer >= REAL_IMPACT_CHARGE_TIME) {
      // Release → thrust
      realImpactChargeActive = false;
      realImpactChargeTimer = 0;
      attackChargeReadyPlayed = false;
      realImpactActive = true;
      realImpactTimer = REAL_IMPACT_DURATION;
      triggerImpact(1.8, player.x + player.w * 0.5, player.y + player.h * 0.5, 2.0);
      if (seStrongHit) playSound(seStrongHit, 0.7, 0.75);
      hudMessage = isDevilTriggerActive() ? "DT REAL IMPACT!" : "REAL IMPACT!";
      hudTimer = 40;
    }
    return true;
  }

  // --- Dreadnought: Royal Guard ↓+J heavy ground pound with shield aura ---
  function performDreadnought() {
    const rankIdx = battleRankIndex;
    const dtActive = isDevilTriggerActive();
    const power = (3.4 + rankIdx * 0.25) * dtPowerMul();
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.4;
    const groundY = player.y + player.h;
    const reach = Math.floor((56 + rankIdx * 5) * dtReachMul());

    // Radial hitbox — both left and right
    const hitBox = {
      x: player.x + player.w * 0.5 - reach,
      y: player.y - 6,
      w: reach * 2,
      h: player.h + 14,
    };
    swordHitEnemies(hitBox, 1, power, 2.4 * dtKnockMul());
    swordHitBoss(hitBox, 1, power);
    hitBreakableGimmicks(hitBox, 2 + rankIdx * 0.4);

    // Twin ground shockwaves (custom "dreadnought" kind with distinctive look)
    const waveSpeed = (3.2 + rankIdx * 0.3) * (dtActive ? 1.3 : 1);
    const ttl = dtActive ? 44 : 34;
    for (const dir of [-1, 1]) {
      stage.playerWaves.push({
        kind: "dreadnought",
        x: px + dir * 4 - 14,
        y: groundY - 18,
        w: 28,
        h: 20,
        vx: dir * waveSpeed,
        vy: 0,
        ttl,
        phase: 0,
        spin: 0,
        power: power * 0.8,
      });
    }

    // Expanding shield ring — two staggered rings for a pulse effect
    for (let r = 0; r < 2; r++) {
      stage.playerWaves.push({
        kind: "dreadnought_ring",
        x: px - 8,
        y: groundY - 18,
        w: 16,
        h: 16,
        vx: 0,
        vy: 0,
        ttl: 28 + r * 10,
        phase: r * 6,
        spin: 0,
        power: power * 0.5,
      });
    }

    // Big screen shake + tint
    triggerImpact(dtActive ? 6.0 : 4.5, px, groundY - 8, 6.0);
    waveFlashTimer = Math.max(waveFlashTimer, 14);
    waveFlashPower = 1.2;
    waveFlashX = px;
    waveFlashY = groundY - 10;
    spawnWaveBurst(px, groundY - 6, 1.8);

    // Vertical pillar of light
    for (let i = 0; i < 14; i++) {
      hitSparks.push({
        x: px + (Math.random() - 0.5) * 6,
        y: groundY - i * 3 - Math.random() * 6,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1.5 - Math.random() * 2,
        life: 18 + Math.random() * 10,
        maxLife: 28,
        color: i % 2 === 0 ? "#eaffc4" : "#22ff88",
      });
    }
    // Ground crack streaks (long horizontal tendrils)
    for (let dir = -1; dir <= 1; dir += 2) {
      for (let i = 0; i < 6; i++) {
        hitSparks.push({
          x: px + dir * (4 + i * 6),
          y: groundY - 2 + (Math.random() - 0.5) * 2,
          vx: dir * (2 + Math.random() * 1.5),
          vy: -0.2 - Math.random() * 0.6,
          life: 18 + i,
          maxLife: 24,
          color: "#ffdd55",
        });
      }
    }
    // Shield shard arc (gold diamond shards flung radially)
    for (let i = 0; i < 12; i++) {
      const ang = Math.PI + (i / 12) * Math.PI; // only upper hemisphere
      const speed = 2.8 + Math.random() * 2.2;
      hitSparks.push({
        x: px, y: groundY - 8,
        vx: -Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * -1 - 1.2,
        life: 22, maxLife: 22,
        color: i % 3 === 0 ? "#ffdd55" : "#88ffaa",
      });
    }
    // Dust burst at feet
    for (let i = 0; i < 10; i++) {
      hitSparks.push({
        x: px + (Math.random() - 0.5) * 30,
        y: groundY - Math.random() * 4,
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 1.5,
        life: 16, maxLife: 16,
        color: "#c8e7d0",
      });
    }

    if (seBazooka) playSound(seBazooka, 0.9, 0.55);
    if (seStrongHit) playSound(seStrongHit, 1.0, 0.5);
    if (seWhipSwing) playSound(seWhipSwing, 0.7, 0.6);

    // Damage bonus for Royal Guard — stores a bit of energy on Dreadnought
    royalGuardEnergy = Math.min(ROYAL_GUARD_MAX_ENERGY, royalGuardEnergy + 8);

    player.vy = Math.max(player.vy, 0);
    player.vx *= 0.4; // anchor
    swordAttackCooldown = 16;
    dreadnoughtCooldown = DREADNOUGHT_COOLDOWN;
    attackEffectTimer = 16;
    attackEffectMode = "sword";
    hudMessage = dtActive ? "DT DREADNOUGHT!" : "DREADNOUGHT!";
    hudTimer = 45;
    battleRankGainByStyle("dreadnought", 2.8);
  }

  // --- Doppelganger: Trickster L→L→J afterimage ally ---
  function performDoppelganger() {
    const dtActive = isDevilTriggerActive();
    const lifeExtend = dtActive ? 120 : 0;
    const dir = player.facing;
    const offset = 42;
    // Spawn slightly behind/beside the player
    const dop = {
      x: player.x - dir * offset,
      y: player.y,
      w: player.w,
      h: player.h,
      facing: dir,
      ttl: DOPPELGANGER_DURATION + lifeExtend,
      attackTimer: 8,
      anim: 0,
      flash: 14,
    };
    dop.x = clamp(dop.x, 0, stage.width - dop.w);
    doppelgangers.push(dop);
    doppelgangerCooldown = DOPPELGANGER_COOLDOWN;

    // Spawn spark ring
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.5;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      hitSparks.push({
        x: px, y: py,
        vx: Math.cos(ang) * 2.5,
        vy: Math.sin(ang) * 2.5,
        life: 16, maxLife: 16,
        color: dtActive ? "#ff66aa" : "#66ccff",
      });
    }
    triggerImpact(2.0, px, py, 3.0);
    if (seWhipSwing) playSound(seWhipSwing, 0.7, 1.25);
    hudMessage = dtActive ? "DT DOPPELGANGER!" : "DOPPELGANGER!";
    hudTimer = 40;
    battleRankGainByStyle("doppelganger", 2.5);
  }

  function updateDoppelgangers(dt) {
    if (doppelgangerCooldown > 0) doppelgangerCooldown -= dt;
    if (doppelgangers.length === 0) return;
    for (const d of doppelgangers) {
      d.ttl -= dt;
      d.anim += dt;
      if (d.flash > 0) d.flash -= dt;
      if (d.ttl <= 0) continue;
      // Follow the player at a distance
      const pcx = player.x + player.w * 0.5;
      const dcx = d.x + d.w * 0.5;
      const followDir = pcx > dcx ? 1 : -1;
      const followDist = Math.abs(pcx - dcx);
      const maxDist = 120;
      if (followDist > maxDist) {
        d.x += followDir * Math.min(3.0, followDist - maxDist) * dt;
      }
      // Aim at nearest enemy in a generous radius
      let target = null;
      let best = 160;
      for (const e of stage.enemies) {
        if (!e.alive || e.kicked) continue;
        const ex = e.x + e.w * 0.5;
        const ey = e.y + e.h * 0.5;
        const dd = Math.hypot(ex - (d.x + d.w * 0.5), ey - (d.y + d.h * 0.5));
        if (dd < best) { best = dd; target = e; }
      }
      if (!target && stage.boss && stage.boss.active) {
        for (const boss of getBossEntities()) {
          if (boss.hp <= 0) continue;
          const bx = boss.x + boss.w * 0.5;
          const by = boss.y + boss.h * 0.5;
          const dd = Math.hypot(bx - (d.x + d.w * 0.5), by - (d.y + d.h * 0.5));
          if (dd < best) { best = dd; target = boss; }
        }
      }
      if (target) {
        const tx = target.x + target.w * 0.5;
        d.facing = tx > (d.x + d.w * 0.5) ? 1 : -1;
        // Inch toward target if far
        if (Math.abs(tx - (d.x + d.w * 0.5)) > 40) {
          d.x += d.facing * 2.2 * dt;
        }
        // Vertical match
        d.y += ((target.y) - d.y) * 0.08 * dt;
      }
      d.attackTimer -= dt;
      if (d.attackTimer <= 0 && target) {
        d.attackTimer = DOPPELGANGER_ATTACK_INTERVAL;
        const reach = 30;
        const power = 1.4 + battleRankIndex * 0.12;
        const hitBox = {
          x: d.facing > 0 ? d.x + d.w - 4 : d.x - reach + 4,
          y: d.y + 2,
          w: reach,
          h: 18,
        };
        swordHitEnemies(hitBox, d.facing, power, 0.8);
        swordHitBoss(hitBox, d.facing, power);
        const px = d.x + d.w * 0.5 + d.facing * 12;
        const py = d.y + d.h * 0.4;
        spawnWaveBurst(px, py, 0.5);
        for (let i = 0; i < 3; i++) {
          hitSparks.push({
            x: px, y: py,
            vx: d.facing * (1 + Math.random() * 2),
            vy: (Math.random() - 0.5) * 1.5,
            life: 10, maxLife: 10,
            color: "#66ccff",
          });
        }
        if (seWhipSwing) playSound(seWhipSwing, 0.25, 1.3);
      }
      // Clamp to stage bounds
      d.x = clamp(d.x, 0, stage.width - d.w);
    }
    doppelgangers = doppelgangers.filter((d) => d.ttl > 0);
  }

  function drawDoppelgangers() {
    if (doppelgangers.length === 0) return;
    for (const d of doppelgangers) {
      const fade = clamp(d.ttl / 40, 0.25, 1);
      const sx = Math.floor(d.x - cameraX);
      const sy = Math.floor(d.y);
      ctx.save();
      ctx.globalAlpha = 0.55 * fade + 0.15 * Math.sin(d.anim * 0.35);
      // Ghost body
      ctx.fillStyle = "#66ccff";
      ctx.fillRect(sx + 2, sy + 2, d.w - 4, d.h - 4);
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = "#aadfff";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 0.5, sy + 0.5, d.w - 1, d.h - 1);
      // Sword hint
      ctx.fillStyle = "#eaffff";
      const swX = d.facing > 0 ? sx + d.w - 2 : sx - 6;
      ctx.fillRect(swX, sy + 6, 8, 2);
      ctx.restore();
    }
  }

  // --- Round Trip: throw sword that boomerangs back ---
  // --- Overdrive: fire a single wave in a burst of 5 ---
  function fireOverdriveWave(index) {
    const dir = player.facing;
    const dtActive = isDevilTriggerActive();
    const rankIdx = battleRankIndex;
    const power = (1.8 + rankIdx * 0.1) * dtPowerMul();
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.4;

    const spread = (index - 2) * 0.6; // Fan pattern: -1.2 to 1.2
    const waveSpeed = (5.0 + rankIdx * 0.4) * (dtActive ? 1.3 : 1);
    const waveW = dtActive ? 18 : 14;
    const waveH = dtActive ? 14 : 10;

    stage.playerWaves.push({
      kind: "drive",
      x: px + dir * (8 + index * 3),
      y: py - waveH * 0.5,
      w: waveW,
      h: waveH,
      vx: dir * waveSpeed,
      vy: spread * 0.8,
      ttl: dtActive ? 70 : 50,
      phase: 0,
      spin: index * 0.5,
      power: power,
    });

    triggerImpact(1.5, px + dir * 12, py, 2.0);
    spawnSwordSlash(dir, 2 + dtSparkCount());
    if (seWhipSwing) playSound(seWhipSwing, 0.5, 1.0 + index * 0.1);
    swordAttackCooldown = 4;
  }

  function launchRoundTrip() {
    if (roundTripActive) return;
    const dir = player.facing;
    const dtActive = isDevilTriggerActive();
    roundTripActive = true;
    roundTripTimer = ROUND_TRIP_DURATION;
    roundTripX = player.x + player.w * 0.5 + dir * 10;
    roundTripY = player.y + player.h * 0.4;
    roundTripVx = dir * ROUND_TRIP_SPEED * (dtActive ? 1.4 : 1);
    roundTripVy = 0;
    roundTripReturning = false;
    roundTripHitCooldown = 0;

    triggerImpact(2.0, roundTripX, roundTripY, 3);
    spawnSwordSlash(dir, 4 + dtSparkCount());
    if (seWhipSwing) playSound(seWhipSwing, 0.8, 0.6);
    hudMessage = dtActive ? "DT ROUND TRIP!" : "ROUND TRIP!";
    hudTimer = 40;
    swordAttackCooldown = 10;
    battleRankGainByStyle("round_trip", 1.8);
  }

  function updateRoundTrip(dt) {
    if (!roundTripActive) return;
    roundTripTimer -= dt;
    if (roundTripHitCooldown > 0) roundTripHitCooldown -= dt;

    // Movement
    if (!roundTripReturning && roundTripTimer < ROUND_TRIP_DURATION - ROUND_TRIP_TURN_AT) {
      roundTripReturning = true;
    }

    if (roundTripReturning) {
      // Home back to player
      const tx = player.x + player.w * 0.5;
      const ty = player.y + player.h * 0.4;
      const dx = tx - roundTripX;
      const dy = ty - roundTripY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 12 || roundTripTimer <= 0) {
        // Caught!
        roundTripActive = false;
        return;
      }
      const returnSpeed = ROUND_TRIP_SPEED * 1.3;
      roundTripVx = (dx / dist) * returnSpeed;
      roundTripVy = (dy / dist) * returnSpeed;
    }

    roundTripX += roundTripVx * dt;
    roundTripY += roundTripVy * dt;

    // Hit detection (pierces enemies — doesn't stop on hit)
    if (roundTripHitCooldown <= 0) {
      const rtBox = { x: roundTripX - 8, y: roundTripY - 8, w: 16, h: 16 };
      const power = (1.5 + battleRankIndex * 0.1) * dtPowerMul();
      const crisisMul = pinchAttackMultiplier();
      const dir = roundTripVx >= 0 ? 1 : -1;
      let hitSomething = false;

      for (const enemy of stage.enemies) {
        if (!enemy.alive || enemy.kicked) continue;
        if (!overlap(rtBox, enemy)) continue;
        kickEnemy(enemy, dir, power * crisisMul * counterAttackMul(), {
          immediateRemove: false, flyLifetime: 30, rankStyle: "round_trip",
        });
        const hx = enemy.x + enemy.w * 0.5;
        const hy = enemy.y + enemy.h * 0.4;
        spawnWaveBurst(hx, hy, 0.6);
        hitSomething = true;
        if (devilTriggerTimer > 0) devilTriggerHitCount++;
      }
      // Boss hit
      if (stage.boss && stage.boss.active) {
        for (const boss of getBossEntities()) {
          if (boss.hp <= 0 || boss.invuln > 0) continue;
          if (!overlap(rtBox, boss)) continue;
          const hx = boss.x + boss.w * 0.5;
          const hy = boss.y + boss.h * 0.4;
          const bossDmg = Math.max(1, Math.round((1 + bossDamageBonus()) * crisisMul * counterAttackMul()));
          boss.hp = Math.max(0, boss.hp - bossDmg);
          boss.invuln = BOSS_HIT_INVULN_FRAMES;
          boss.vx += dir * 0.3;
          triggerImpact(1.5, hx, hy, 2);
          spawnWaveBurst(hx, hy, 0.8);
          handleBossHpZero();
          hitSomething = true;
          if (devilTriggerTimer > 0) devilTriggerHitCount++;
          break;
        }
      }
      if (hitSomething) {
        roundTripHitCooldown = 8; // Don't hit same target too fast
        triggerImpact(1.0, roundTripX, roundTripY, 1.5);
      }
    }

    // Timeout
    if (roundTripTimer <= 0) {
      roundTripActive = false;
    }
  }

  // --- Trickster Dodge (L+direction = teleport dodge) ---
  function performTricksterDodge(dir) {
    if (tricksterCooldown > 0) return false;

    const dtActive = isDevilTriggerActive();
    const dist = TRICKSTER_DISTANCE * (dtActive ? 1.5 : 1);

    // Teleport
    const oldX = player.x;
    player.x += dir * dist;
    player.x = clamp(player.x, 0, stage.width - player.w);
    if (gameState === STATE.BOSS) {
      player.x = clamp(player.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - player.w - 2);
    }

    tricksterCooldown = Math.floor(TRICKSTER_COOLDOWN * dtTricksterCooldownMul());
    damageInvulnTimer = Math.max(damageInvulnTimer, 18);

    // Afterimage particles at old position
    const px = oldX + player.w * 0.5;
    const py = player.y + player.h * 0.5;
    for (let i = 0; i < 5; i++) {
      hitSparks.push({
        x: px + (Math.random() - 0.5) * 10,
        y: py + (Math.random() - 0.5) * 14,
        vx: -dir * (1 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 2,
        life: 12, maxLife: 12,
        color: dtActive ? "#ff66aa" : "#66ccff",
      });
    }
    // Arrival particles
    const nx = player.x + player.w * 0.5;
    for (let i = 0; i < 4; i++) {
      hitSparks.push({
        x: nx + (Math.random() - 0.5) * 8,
        y: py + (Math.random() - 0.5) * 10,
        vx: dir * (0.5 + Math.random()),
        vy: (Math.random() - 0.5) * 1.5,
        life: 10, maxLife: 10,
        color: dtActive ? "#ffaa66" : "#aaddff",
      });
    }

    triggerImpact(1.5, nx, py, 2.0);
    if (seWhipSwing) playSound(seWhipSwing, 0.5, 1.4);

    // Check if dodging near enemies/projectiles — reward stylish dodges
    let nearDanger = false;
    const dodgeBox = { x: Math.min(oldX, player.x), y: player.y - 8, w: Math.abs(player.x - oldX) + player.w, h: player.h + 16 };
    for (const enemy of stage.enemies) {
      if (!enemy.alive) continue;
      if (overlap(dodgeBox, enemy)) { nearDanger = true; break; }
    }
    if (!nearDanger) {
      for (const bullet of stage.hazardBullets) {
        if (bullet.dead) continue;
        if (overlap(dodgeBox, bullet)) { nearDanger = true; break; }
      }
    }
    if (!nearDanger) {
      for (const shot of stage.bossShots) {
        if (shot.dead) continue;
        if (overlap(dodgeBox, shot)) { nearDanger = true; break; }
      }
    }

    if (nearDanger) {
      battleRankDodgeChain++;
      const dodgePower = 1.5 + battleRankDodgeChain * 0.3;
      battleRankGainByStyle("dodge_success", Math.min(dodgePower, 4.0));
      hudMessage = battleRankDodgeChain >= 3 ? "CRAZY DODGE!" : battleRankDodgeChain >= 2 ? "STYLISH DODGE!" : "TRICK!";
      hudTimer = 30;
    } else {
      battleRankGainByStyle("trickster", 0.8);
      hudMessage = "TRICK!";
      hudTimer = 20;
    }
    return true;
  }

  // --- Trickster: Air Trick (teleport to nearest enemy in air) ---
  function performAirTrick() {
    if (tricksterCooldown > 0) return false;
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.5;
    const maxDist = 120;
    let nearest = null;
    let nearDist = maxDist;

    // Find nearest enemy
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      const ex = enemy.x + enemy.w * 0.5;
      const ey = enemy.y + enemy.h * 0.5;
      const d = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2);
      if (d < nearDist) { nearDist = d; nearest = { x: ex, y: ey, entity: enemy }; }
    }
    // Check boss
    if (stage.boss && stage.boss.active) {
      for (const boss of getBossEntities()) {
        if (boss.hp <= 0) continue;
        const bx = boss.x + boss.w * 0.5;
        const by = boss.y + boss.h * 0.5;
        const d = Math.sqrt((bx - px) ** 2 + (by - py) ** 2);
        if (d < nearDist) { nearDist = d; nearest = { x: bx, y: by, entity: boss }; }
      }
    }

    if (!nearest) return false;

    // Teleport above the target — ready for immediate enemy step
    const oldX = player.x;
    const oldY = player.y;
    const dir = nearest.x > px ? 1 : -1;
    player.x = nearest.x - dir * (player.w * 0.5);
    player.y = nearest.y - player.h - 6; // Position above enemy
    player.x = clamp(player.x, 0, stage.width - player.w);
    player.y = Math.max(0, player.y);
    player.facing = dir;
    player.vy = 0.5; // Slight downward = ready for stomp
    player.onGround = false;
    stompChainGuardTimer = Math.max(stompChainGuardTimer, 12); // Assist stomp window

    tricksterCooldown = Math.floor(TRICKSTER_COOLDOWN * dtTricksterCooldownMul());
    damageInvulnTimer = Math.max(damageInvulnTimer, 12);

    // Trail particles from old to new position
    const nx = player.x + player.w * 0.5;
    const ny = player.y + player.h * 0.5;
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      hitSparks.push({
        x: oldX + player.w * 0.5 + (nx - oldX - player.w * 0.5) * t,
        y: oldY + player.h * 0.5 + (ny - oldY - player.h * 0.5) * t,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
        life: 10, maxLife: 10, color: "#66ccff",
      });
    }

    triggerImpact(2.0, nx, ny, 2.5);
    if (seWhipSwing) playSound(seWhipSwing, 0.6, 1.5);
    hudMessage = "AIR TRICK!";
    hudTimer = 25;
    battleRankGainByStyle("air_trick", 1.5);
    return true;
  }

  // --- Swordmaster: Prop Shredder (空中回転斬り) ---
  function performPropShredder() {
    const dir = player.facing;
    const dtActive = isDevilTriggerActive();
    const rankIdx = battleRankIndex;
    const power = (2.0 + rankIdx * 0.12) * dtPowerMul();
    player.vy = -0.5; // Hover during shred

    const reach = Math.floor(22 * dtReachMul());
    // 360-degree hitbox (all around player)
    const hitBox = {
      x: player.x - reach * 0.3,
      y: player.y - 4,
      w: player.w + reach * 0.6,
      h: player.h + 8,
    };

    const crisisMul = pinchAttackMultiplier();
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlap(hitBox, enemy)) continue;
      if (!enemy.maxHp) enemy.maxHp = Math.max(1, Math.round(enemy.kind === "bruiser" ? 16 : 7));
      if (!Number.isFinite(enemy.hp) || enemy.hp === undefined) enemy.hp = enemy.maxHp;
      const dmg = Math.max(1, Math.round(power * 0.4 * crisisMul * counterAttackMul()));
      enemy.hp = Math.max(0, enemy.hp - dmg);
      if (enemy.hp <= 0) {
        kickEnemy(enemy, dir, power * crisisMul, {
          immediateRemove: false, flyLifetime: 30, rankStyle: "prop_shredder",
        });
      } else {
        enemy.vy = Math.min(enemy.vy, -1.0);
        enemy.onGround = false;
        enemy.hitstun = Math.max(enemy.hitstun || 0, 15);
        enemy.flash = Math.max(enemy.flash || 0, 6);
      }
      spawnWaveBurst(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 0.4);
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
    }
    swordHitBoss(hitBox, dir, power);

    // Spinning slash particles
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.5;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (attackEffectTimer * 0.3);
      hitSparks.push({
        x: px + Math.cos(angle) * 10,
        y: py + Math.sin(angle) * 8,
        vx: Math.cos(angle) * 2.5,
        vy: Math.sin(angle) * 2,
        life: 8, maxLife: 8,
        color: dtActive ? "#ff8844" : "#88ccff",
      });
    }

    triggerImpact(1.5, px, py, 2.0);
    if (seWhipSwing) playSound(seWhipSwing, 0.7, 1.3);
    swordAttackCooldown = Math.max(3, 6 - rankIdx * 0.3);
    attackEffectTimer = 8;
    attackEffectMode = "sword";
    hudMessage = dtActive ? "DT PROP!" : "PROP SHREDDER!";
    hudTimer = 20;
    battleRankGainByStyle("prop_shredder", 1.2);
  }

  // --- Gunslinger: Twosome Time (shoot both directions) ---
  function performTwosomeTime() {
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.45;
    const rankIdx = battleRankIndex;
    const speed = 5.0 + rankIdx * 0.8;

    // Fire left and right simultaneously
    stage.playerWaves.push({
      kind: "bullet", x: px + 6, y: py, w: 7, h: 4,
      vx: speed, vy: (Math.random() - 0.5) * 0.3, ttl: 55, power: 0.7
    });
    stage.playerWaves.push({
      kind: "bullet", x: px - 6, y: py, w: 7, h: 4,
      vx: -speed, vy: (Math.random() - 0.5) * 0.3, ttl: 55, power: 0.7
    });

    if (seHandgun) playSound(seHandgun, 0.55, 1.0);
    triggerImpact(0.8, px, py, 1.5);
    hudMessage = "TWOSOME TIME!";
    hudTimer = 15;
    battleRankGainByStyle("twosome_time", 1.0);
  }

  function performBulletStorm() {
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.45;
    const rankIdx = battleRankIndex;
    const speed = 7.0 + rankIdx * 1.2;
    const spreadPower = 0.5 + rankIdx * 0.04;
    const sPow = dtShotPowerMul();

    stage.playerWaves.push(
      { kind: "bullet", x: px, y: py - 4, w: 5, h: 5, vx: (Math.random() - 0.5) * 0.3, vy: -speed, ttl: 50, power: spreadPower * sPow },
      { kind: "bullet", x: px - 4, y: py, w: 5, h: 5, vx: -speed, vy: (Math.random() - 0.5) * 0.3, ttl: 50, power: spreadPower * sPow },
      { kind: "bullet", x: px + 4, y: py, w: 5, h: 5, vx: speed, vy: (Math.random() - 0.5) * 0.3, ttl: 50, power: spreadPower * sPow }
    );

    if (devilTriggerTimer > 0 && devilTriggerStyle === "gunslinger") {
      stage.playerWaves.push(
        { kind: "bullet", x: px - 2, y: py - 2, w: 5, h: 5, vx: -speed * 0.76, vy: -speed * 0.54, ttl: 46, power: spreadPower * 0.8 * sPow },
        { kind: "bullet", x: px + 2, y: py - 2, w: 5, h: 5, vx: speed * 0.76, vy: -speed * 0.54, ttl: 46, power: spreadPower * 0.8 * sPow }
      );
      devilTriggerHitCount++;
    }

    if (seHandgun) playSound(seHandgun, 0.5, 1.1);
    triggerImpact(0.8, px, py, 2.0);
    battleRankGainByStyle("twosome_time", 0.9);
    hudMessage = "BULLET STORM!";
    hudTimer = 15;
  }

  function performAirSlash(stage_) {
    const dir = player.facing;
    const rankIdx = battleRankIndex;
    const reach = Math.floor((24 + rankIdx * 2 + stage_ * 4) * dtReachMul());
    const power = (1.2 + stage_ * 0.4 + rankIdx * 0.06) * dtPowerMul();
    const hitH = 16;

    const hitBox = {
      x: dir > 0 ? player.x + player.w - 2 : player.x - reach + 2,
      y: player.y + 2,
      w: reach,
      h: hitH,
    };

    // Keep enemies airborne during air combo — don't knock away
    const crisisMul = pinchAttackMultiplier();
    const effectivePower = power * crisisMul * counterAttackMul();
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlap(hitBox, enemy)) continue;
      const bf = rollBlackFlashHit(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 1.1 + power * 0.5);
      if (!enemy.maxHp) {
        enemy.maxHp = Math.max(1, Math.round(enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7));
      }
      if (!Number.isFinite(enemy.hp) || enemy.hp === undefined) enemy.hp = enemy.maxHp;
      const dmg = Math.max(1, Math.round(effectivePower * 0.6 * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
      enemy.hp = Math.max(0, enemy.hp - dmg);
      if (enemy.hp <= 0) {
        kickEnemy(enemy, dir, effectivePower * (bf ? BLACK_FLASH_DAMAGE_MUL : 1), {
          immediateRemove: false, flyLifetime: 38, rankStyle: "air_slash", blackFlash: bf, blackFlashPowerApplied: true,
        });
      } else {
        // Keep in air — slight upward push
        enemy.vx = dir * 0.8;
        enemy.vy = Math.min(enemy.vy, -1.5);
        enemy.onGround = false;
        enemy.hitstun = Math.max(enemy.hitstun || 0, 20);
        enemy.flash = Math.max(enemy.flash || 0, 8);
      }
      const hx = enemy.x + enemy.w * 0.5;
      const hy = enemy.y + enemy.h * 0.4;
      spawnWaveBurst(hx, hy, 0.5 + power * 0.3);
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
    }
    swordHitBoss(hitBox, dir, power);

    const impactPow = (0.8 + stage_ * 0.3) * dtPowerMul();
    triggerImpact(impactPow, player.x + player.w * 0.5 + dir * reach * 0.5, player.y + 10, 1.5);
    spawnSwordSlash(dir, stage_ + 1 + dtSparkCount());

    if (seWhipSwing) playSound(seWhipSwing, 0.6 + stage_ * 0.15, 1.1 - stage_ * 0.1);

    swordAttackCooldown = Math.max(4, 8 - rankIdx * 0.5);
    attackEffectTimer = 8 + stage_ * 2;
    attackEffectMode = "sword";
    battleRankGainByStyle("air_slash", 0.8 + stage_ * 0.3);
    hudMessage = stage_ === 0 ? "AIR SLASH!" : "AIR SLASH 2!";
    hudTimer = 20;
  }

  function swordHitEnemies(hitBox, dir, power, knockMul, launchUp) {
    const crisisMul = pinchAttackMultiplier();
    const effectivePower = power * crisisMul * counterAttackMul();
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;
      if (!overlap(hitBox, enemy)) continue;
      const bf = rollBlackFlashHit(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 1.1 + power * 0.5);
      kickEnemy(enemy, dir, effectivePower * (bf ? BLACK_FLASH_DAMAGE_MUL : 1), {
        immediateRemove: false,
        flyLifetime: 38,
        rankStyle: "atk1_wave_shot",
        blackFlash: bf,
        blackFlashPowerApplied: true,
      });
      if (launchUp) {
        // Launch enemies strongly UPWARD with minimal horizontal movement
        enemy.vx = dir * 0.5;  // Almost no horizontal knockback
        enemy.vy = -(8.5 + power * 0.6);  // Strong upward launch
        enemy.onGround = false;
      } else {
        enemy.vx = dir * (3 + power * 0.8) * knockMul * crisisMul;
        enemy.vy = -(2 + power * 0.4) * knockMul;
      }
      enemy.flash = 12;
      const hx = enemy.x + enemy.w * 0.5;
      const hy = enemy.y + enemy.h * 0.4;
      spawnWaveBurst(hx, hy, 0.6 + power * 0.4);
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
    }
  }

  function swordHitBoss(hitBox, dir, power, launchUp) {
    if (!stage.boss || !stage.boss.active) return;
    const crisisMul = pinchAttackMultiplier() * counterAttackMul();
    for (const boss of getBossEntities()) {
      if (boss.hp <= 0) continue;
      // Devil Trigger ignores boss invulnerability
      if (boss.invuln > 0 && devilTriggerTimer <= 0) continue;
      if (!overlap(hitBox, boss)) continue;
      const hx = boss.x + boss.w * 0.5;
      const hy = boss.y + boss.h * 0.4;
      const bf = rollBlackFlashHit(hx, hy, 1.14 + power * 0.6);
      const bossDamage = Math.max(1, Math.round((1 + bossDamageBonus()) * crisisMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
      boss.hp = Math.max(0, boss.hp - bossDamage);
      if (devilTriggerTimer <= 0) {
        boss.invuln = BOSS_HIT_INVULN_FRAMES;
      } else {
        boss.invuln = Math.min(boss.invuln, 4); // Minimal invuln in DT
      }
      boss.vx += dir * (0.4 + power * 0.15);
      if (launchUp) {
        boss.vy = Math.min(boss.vy, -(2.5 + power * 0.3));
      } else {
        boss.vy = Math.min(boss.vy, -(1 + power * 0.2));
      }
      triggerImpact(2.0 + power * 0.5, hx, hy, 3.0);
      spawnWaveBurst(hx, hy, 1.0 + power * 0.4);
      playKickSfx(1.5 + power * 0.2);
      handleBossHpZero();
      if (devilTriggerTimer > 0) devilTriggerHitCount++;
      break;
    }
  }

  function spawnSwordSlash(dir, type) {
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.4;
    const colors = ["#aaddff", "#88ccff", "#66aaff", "#ff8844", "#ff44aa"];
    const color = colors[Math.min(type, colors.length - 1)];
    for (let i = 0; i < 3 + type; i++) {
      const life = 8 + Math.random() * 6;
      hitSparks.push({
        x: px + dir * (6 + Math.random() * 14),
        y: py + (Math.random() - 0.5) * 16,
        vx: dir * (2 + Math.random() * 3),
        vy: (Math.random() - 0.5) * 2 - (type >= 4 ? 2 : 0),
        life: life,
        maxLife: life,
        color: color,
      });
    }
  }

  // --- Devil Trigger (Style-specific Burst) ---
  const DT_STYLE_NAMES = {
    swordmaster: "DEVIL TRIGGER!",
    trickster:   "QUICKSILVER!!",
    gunslinger:  "WILD TRIGGER!",
    royalguard:  "DREADNAUGHT!!",
  };
  const DT_STYLE_COLORS = {
    swordmaster: { tint: [180, 20, 0], vignette: [120, 0, 0], bar: "#ff3300", flash: "#ff4400" },
    trickster:   { tint: [180, 140, 0], vignette: [120, 80, 0], bar: "#ffcc00", flash: "#ffdd44" },
    gunslinger:  { tint: [0, 60, 200], vignette: [0, 20, 140], bar: "#4488ff", flash: "#44ccff" },
    royalguard:  { tint: [0, 140, 60], vignette: [0, 80, 30], bar: "#22ff88", flash: "#44ffaa" },
  };

  function triggerDevilTrigger() {
    if (devilTriggerTimer > 0) return false;
    if (isTimeBurstActive() || proteinBurstTimer > 0) return false;
    if (proteinBurstGauge1 < PROTEIN_BURST_MIN) return false;

    const gaugeRatio = clamp(proteinBurstGauge1 / PROTEIN_BURST_REQUIRE, 0, 1);
    const seconds = DEVIL_TRIGGER_MIN_SEC + (DEVIL_TRIGGER_MAX_SEC - DEVIL_TRIGGER_MIN_SEC) * gaugeRatio;
    devilTriggerDuration = seconds * 60;
    devilTriggerTimer = devilTriggerDuration;
    devilTriggerHitCount = 0;
    devilTriggerStyle = playerStyle;
    proteinBurstGauge1 = 0;
    proteinBurstGauge2 = 0;

    // Style-specific activation effects
    const gpx = player.x + player.w * 0.5;
    const gpy = player.y + player.h * 0.5;
    hudMessage = DT_STYLE_NAMES[playerStyle] || "DEVIL TRIGGER!";
    hudTimer = 80;
    triggerImpact(4, gpx, gpy, 5);

    // Royal Guard DT: start with full energy
    if (playerStyle === "royalguard") {
      royalGuardEnergy = ROYAL_GUARD_MAX_ENERGY;
    }
    // Trickster DT: reset cooldown instantly
    if (playerStyle === "trickster") {
      tricksterCooldown = 0;
      combatDashCooldown = 0;
    }

    // Style-colored activation burst
    const colors = DT_STYLE_COLORS[playerStyle] || DT_STYLE_COLORS.swordmaster;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      hitSparks.push({
        x: gpx, y: gpy,
        vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
        life: 18, maxLife: 18, color: colors.flash,
      });
    }

    if (seBurst1Max) playSound(seBurst1Max, 0.9);
    return true;
  }

  function endDevilTrigger() {
    devilTriggerTimer = 0;
    devilTriggerResultTimer = 180;
    devilTriggerResultCount = devilTriggerHitCount;
    devilTriggerHitCount = 0;
  }

  function isDevilTriggerActive() {
    return devilTriggerTimer > 0;
  }

  // Devil Trigger power multipliers — vary by DT style
  function dtPowerMul() {
    if (devilTriggerTimer <= 0) {
      return playerStyle === "swordmaster" ? 1.15 : 1;
    }
    // DT active: style-specific damage bonus
    switch (devilTriggerStyle) {
      case "swordmaster": return 1.5 * 1.15; // Best melee damage
      case "gunslinger":  return 1.3;         // Moderate (gun bonus elsewhere)
      case "royalguard":  return 1.2;         // Defensive focus
      case "trickster":   return 1.25;        // Speed focus
      default:            return 1.5;
    }
  }
  function dtReachMul() {
    if (devilTriggerTimer <= 0) {
      return playerStyle === "swordmaster" ? 1.1 : 1;
    }
    switch (devilTriggerStyle) {
      case "swordmaster": return 1.25 * 1.1;
      case "trickster":   return 1.15;
      default:            return 1.1;
    }
  }
  function dtKnockMul() { return devilTriggerTimer > 0 ? 1.3 : 1; }
  function dtSparkCount() { return devilTriggerTimer > 0 ? 3 : 0; }
  // Gunslinger DT: massive shot power, faster fire
  function dtShotPowerMul() {
    if (devilTriggerTimer > 0 && devilTriggerStyle === "gunslinger") return 3.0;
    return 1;
  }
  function dtShotReloadMul() {
    if (devilTriggerTimer > 0 && devilTriggerStyle === "gunslinger") return 0.3;
    return 1;
  }
  // Gunslinger DT: bullets pierce through enemies
  function dtShotPierce() {
    return devilTriggerTimer > 0 && devilTriggerStyle === "gunslinger";
  }
  // Trickster DT: speed & cooldown
  function dtTricksterCooldownMul() {
    if (devilTriggerTimer > 0 && devilTriggerStyle === "trickster") return 0.3;
    return 1;
  }
  function dtMovementSpeedMul() {
    if (devilTriggerTimer > 0 && devilTriggerStyle === "trickster") return 1.5;
    return 1;
  }
  // Royal Guard DT: auto-guard aura
  function dtRoyalGuardAutoBlock() {
    return devilTriggerTimer > 0 && devilTriggerStyle === "royalguard";
  }
  // Counter-attack bonus after emergency dodge
  function counterAttackMul() { return emergencyDodgeCounterTimer > 0 ? 2.0 : 1; }

  function resetSwordmasterState() {
    swordComboStage = 0;
    swordComboTimer = 0;
    swordDoubleJumpUsed = false;
    swordStingerActive = false;
    swordStingerTimer = 0;
    swordUpperActive = false;
    swordUpperTimer = 0;
    swordUpperHangTimer = 0;
    swordSlamActive = false;
    swordSlamTimer = 0;
    swordAttackCooldown = 0;
    swordChargeTimer = 0;
    swordChargeReadyPlayed = false;
    devilTriggerTimer = 0;
    devilTriggerDuration = 0;
    devilTriggerHitCount = 0;
    devilTriggerResultTimer = 0;
    devilTriggerResultCount = 0;
    roundTripActive = false;
    roundTripTimer = 0;
    tricksterCooldown = 0;
    royalGuardEnergy = 0;
    royalGuardBlockTimer = 0;
    driveChargeActive = false;
    driveChargeTimer = 0;
    overdriveBurstCount = 0;
    tauntTimer = 0;
    tauntBonusTimer = 0;
    tauntFlashTimer = 0;
    airComboStage = 0;
    realImpactActive = false;
    realImpactChargeActive = false;
    realImpactTimer = 0;
    realImpactChargeTimer = 0;
    dreadnoughtCooldown = 0;
    gunStingerCharging = false;
    gunStingerChargeTimer = 0;
    gunStingerActive = false;
    gunStingerTimer = 0;
    gunStingerFireTimer = 0;
    gunStingerReadyPlayed = false;
    doppelgangers = [];
    doppelgangerCooldown = 0;
    downTapWindowTimer = 0;
    doubleDownPrimedTimer = 0;
    dashTapWindowTimer = 0;
    doubleDashPrimedTimer = 0;
  }

  // ========== COMBAT DASH / DODGE / ROYAL GUARD SYSTEM ==========
  function updateCombatDash(dt, actions) {
    if (tricksterCooldown > 0) tricksterCooldown -= dt;
    if (royalGuardBlockTimer > 0) royalGuardBlockTimer -= dt;
    if (combatDashTimer > 0) {
      combatDashTimer -= dt;
      player.vx = combatDashDir * COMBAT_DASH_SPEED;
      damageInvulnTimer = Math.max(damageInvulnTimer, 2);
      if (combatDashTimer <= 0) {
        combatDashTimer = 0;
        combatDashCooldown = COMBAT_DASH_COOLDOWN;
      }
      return true;
    }
    if (combatDashCooldown > 0) combatDashCooldown -= dt;
    if (actions.dashPressed && combatDashCooldown <= 0) {
      // Royal Guard style: L = block, L+attack = Release
      if (playerStyle === "royalguard") {
        if (input.attack && royalGuardEnergy > 0) {
          // RELEASE! — unleash stored energy as a massive counter
          performRoyalRelease();
          combatDashCooldown = COMBAT_DASH_COOLDOWN;
          return true;
        }
        // Block mode — scales with battle rank
        const guardWindow = royalGuardBlockWindow();
        royalGuardBlockTimer = guardWindow;
        damageInvulnTimer = Math.max(damageInvulnTimer, guardWindow + 6);
        player.vx *= 0.3;
        hudMessage = "GUARD!";
        hudTimer = 15;
        if (seWhipSwing) playSound(seWhipSwing, 0.3, 0.8);
        // Guard box scales with rank — proactive check on press
        const gs = royalGuardBoxScale();
        const guardBox = {
          x: player.x - Math.floor(14 * gs), y: player.y - Math.floor(8 * gs),
          w: player.w + Math.floor(28 * gs), h: player.h + Math.floor(16 * gs),
        };
        let absorbed = false;
        for (const bullet of stage.hazardBullets) {
          if (bullet.dead) continue;
          if (!overlap(guardBox, bullet)) continue;
          bullet.dead = true;
          absorbed = true;
        }
        for (const shot of stage.bossShots) {
          if (shot.dead) continue;
          if (!overlap(guardBox, shot)) continue;
          shot.dead = true;
          absorbed = true;
        }
        for (const enemy of stage.enemies) {
          if (!enemy.alive || enemy.kicked) continue;
          if (!overlap(guardBox, enemy)) continue;
          const ex = enemy.x + enemy.w * 0.5;
          const px2 = player.x + player.w * 0.5;
          if (Math.abs(ex - px2) < 30) {
            enemy.hitstun = Math.max(enemy.hitstun || 0, 30);
            enemy.flash = Math.max(enemy.flash || 0, 15);
            enemy.vx = (ex > px2 ? 1 : -1) * 3.0;
            absorbed = true;
          }
        }
        if (absorbed) {
          // This is frame-0 guard = always Just Guard
          applyRoyalGuardSuccess(30, 2.5, "GUARD SUCCESS!");
        }
        combatDashCooldown = 6;
        return true;
      }

      // Determine direction
      let dashDir = player.facing;
      if (input.left) dashDir = -1;
      if (input.right) dashDir = 1;
      const isBackDash = (dashDir !== player.facing);

      // Trickster style: Air Trick (no direction in air) or enhanced teleport
      const isTrickster = playerStyle === "trickster";
      if (isTrickster && tricksterCooldown <= 0) {
        // Air Trick: if in air and no direction held, teleport to nearest enemy
        if (!player.onGround && !input.left && !input.right) {
          if (performAirTrick()) {
            combatDashCooldown = Math.floor(COMBAT_DASH_COOLDOWN * 0.4);
            return true;
          }
        }
        performTricksterDodge(dashDir);
        combatDashCooldown = Math.floor(COMBAT_DASH_COOLDOWN * 0.5);
        return true;
      }

      // Back-dash or air-dash with direction = Trickster teleport
      if ((isBackDash || !player.onGround) && tricksterCooldown <= 0) {
        performTricksterDodge(dashDir);
        combatDashCooldown = COMBAT_DASH_COOLDOWN;
        return true;
      }

      // Forward ground dash = normal combat dash
      combatDashDir = dashDir;
      combatDashTimer = COMBAT_DASH_DURATION;
      damageInvulnTimer = Math.max(damageInvulnTimer, COMBAT_DASH_INVULN);
      if (seWhipSwing) playSound(seWhipSwing, 0.4, 1.5);
      hudMessage = "DODGE!";
      hudTimer = 20;
      if (!player.onGround) {
        player.vy = Math.min(player.vy, 0.3);
      }
      return true;
    }
    return false;
  }

  // --- Royal Guard Release ---
  function performRoyalRelease() {
    const dir = player.facing;
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.4;
    const energy = royalGuardEnergy;
    const power = 3.0 + energy * 0.08;
    royalGuardEnergy = 0;

    // Massive shockwave
    const reach = 40 + Math.floor(energy * 0.4);
    const hitBox = {
      x: dir > 0 ? player.x + player.w - 4 : player.x - reach + 4,
      y: player.y - 10,
      w: reach,
      h: player.h + 20,
    };
    swordHitEnemies(hitBox, dir, power, 2.5);
    swordHitBoss(hitBox, dir, power * 1.5);

    // Release wave
    stage.playerWaves.push({
      kind: "swordwave",
      x: px + dir * 4,
      y: py - 10,
      w: reach,
      h: 20,
      vx: dir * 3,
      vy: 0,
      ttl: 25,
      phase: 0,
      spin: 0,
      power: power,
    });

    triggerImpact(5.0 + energy * 0.05, px, py, 5.0);
    spawnWaveBurst(px + dir * 10, py, 2.0);
    if (seBazooka) playSound(seBazooka, 0.9, 0.8);
    if (seStrongHit) playSound(seStrongHit, 1.0, 0.6);
    hudMessage = energy >= 80 ? "ROYAL RELEASE MAX!" : "ROYAL RELEASE!";
    hudTimer = 50;
    swordAttackCooldown = 20;
    battleRankGainByStyle("royal_release", 3.0 + energy * 0.03);
  }

  // --- GunStinger: Gunslinger rushing barrage ---
  function startGunStinger(dir) {
    gunStingerActive = true;
    gunStingerTimer = GUN_STINGER_DURATION;
    gunStingerFireTimer = 0;
    gunStingerDir = dir;
    gunStingerCharging = false;
    gunStingerChargeTimer = 0;
    gunStingerReadyPlayed = false;
    damageInvulnTimer = Math.max(damageInvulnTimer, GUN_STINGER_DURATION + 4);
    triggerImpact(2.5, player.x + player.w * 0.5, player.y + player.h * 0.5, 3);
    if (seStrongHit) playSound(seStrongHit, 0.7, 1.0);
    hudMessage = isDevilTriggerActive() ? "DT GUNSTINGER!" : "GUNSTINGER!";
    hudTimer = 40;
    battleRankGainByStyle("gun_stinger", 2.0);
  }

  function updateGunStinger(dt, actions) {
    if (!gunStingerActive) return;
    gunStingerTimer -= dt;
    gunStingerFireTimer -= dt;
    const dtActive = isDevilTriggerActive();
    const dir = gunStingerDir;
    player.facing = dir;
    player.vx = dir * GUN_STINGER_SPEED * (dtActive ? 1.2 : 1);
    damageInvulnTimer = Math.max(damageInvulnTimer, 2);
    // Melee bayonet hit as we rush
    const meleeBox = {
      x: dir > 0 ? player.x + player.w : player.x - 20,
      y: player.y + 2,
      w: 20, h: player.h - 4,
    };
    swordHitEnemies(meleeBox, dir, 1.2 + battleRankIndex * 0.1, 0.6);
    swordHitBoss(meleeBox, dir, 1.0 + battleRankIndex * 0.1);

    // Spray bullets
    if (gunStingerFireTimer <= 0) {
      gunStingerFireTimer = GUN_STINGER_FIRE_INTERVAL;
      const px = player.x + player.w * 0.5 + dir * 8;
      const py = player.y + player.h * 0.45;
      const rankIdx = battleRankIndex;
      const speed = 6.5 + rankIdx * 0.8;
      for (let i = 0; i < (dtActive ? 2 : 1); i++) {
        const spread = (Math.random() - 0.5) * 0.6;
        stage.playerWaves.push({
          kind: "bullet",
          x: px, y: py + spread * 4,
          w: 8, h: 4,
          vx: dir * speed, vy: spread * 0.8,
          ttl: 40,
          power: 0.8 * dtShotPowerMul() * (dtActive ? 1.4 : 1),
        });
      }
      if (seHandgun) playSound(seHandgun, 0.35, 1.2 + Math.random() * 0.2);
      // Muzzle sparks
      for (let i = 0; i < 2; i++) {
        hitSparks.push({
          x: px, y: py,
          vx: dir * (1.5 + Math.random() * 2),
          vy: (Math.random() - 0.5) * 1.5,
          life: 8, maxLife: 8,
          color: "#ffdd66",
        });
      }
    }

    if (gunStingerTimer <= 0) {
      gunStingerActive = false;
      dedicatedGunCooldown = 8;
      player.vx *= 0.5;
      triggerImpact(1.5, player.x + player.w * 0.5, player.y + player.h * 0.5, 2);
    }
  }

  // ========== DEDICATED GUN (K KEY - always available) ==========
  function updateDedicatedGun(dt, actions) {
    if (dedicatedGunCooldown > 0) {
      dedicatedGunCooldown -= dt;
    }
    if (bulletRainCooldown > 0) {
      bulletRainCooldown -= dt;
    }
    const playable = gameState === STATE.PLAY || gameState === STATE.BOSS;
    const rankIdx = battleRankIndex;
    const isGunslinger = playerStyle === "gunslinger";

    // GunStinger: Gunslinger J+K simultaneous press on ground, WHILE STATIONARY
    // (walking + K = normal shot to avoid accidental trigger)
    const stationary = !input.left && !input.right && Math.abs(player.vx) < 0.8;
    if (isGunslinger && playable && !deathAnimActive && !gunStingerActive
        && actions && actions.shootPressed && actions.simulJK
        && player.onGround && stationary) {
      startGunStinger(player.facing);
      return;
    }
    // Block K during Real Impact / GunStinger to avoid stray fire
    if (realImpactChargeActive || realImpactActive || gunStingerActive) return;
    // Suppress first K-press shot when it's part of a J+K combo that triggered a style move
    if (actions && actions.shootPressed && actions.simulJK && player.onGround
        && ((playerStyle === "swordmaster") || (playerStyle === "gunslinger" && stationary))) {
      return;
    }

    // Bullet Rain visual state needs to clear even on frames where K is no longer firing.
    if (player.onGround && bulletRainTimer > 0) {
      bulletRainCooldown = 30 + (6 - rankIdx) * 4;
      bulletRainTimer = 0;
      bulletRainRotation = false;
      hudMessage = "RAIN END";
      hudTimer = 15;
    } else if ((!isGunslinger || !playable || deathAnimActive) && bulletRainRotation) {
      bulletRainTimer = 0;
      bulletRainRotation = false;
    }

    // Fire on press OR hold (auto-fire when holding K)
    const wantShoot = input.shoot && dedicatedGunCooldown <= 0;
    if (!wantShoot) return;
    if (!playable) return;
    if (deathAnimActive) return;

    const dir = player.facing;
    const px = player.x + player.w * 0.5;
    const py = player.y + player.h * 0.45;

    // Rank-scaled fire rate: faster at higher ranks (Gunslinger gets bonus)
    const gunslingerBonus = isGunslinger ? 0.7 : 1.0;
    const rankReload = Math.max(3, (DEDICATED_GUN_RELOAD - rankIdx * 1.2) * gunslingerBonus);

    // Gunslinger only: Air + Down/S + K = Bullet Rain (真下に弾を打ち込む)
    // Continues until player lands — no duration limit
    if (isGunslinger && !player.onGround && input.down && bulletRainCooldown <= 0) {
      bulletRainTimer = 1; // Mark as active
      bulletRainRotation = true; // Flip character upside-down
      player.vy = Math.min(player.vy + 0.08, 1.5); // Slow descent (eventually lands)
      const bulletCount = 1 + Math.floor(rankIdx * 0.5) + (isGunslinger ? 1 : 0);
      const hSpread = 0.6 + rankIdx * 0.15 + (isGunslinger ? 0.3 : 0);
      // Cap fire rate minimum to 6 frames to reduce lag
      const rainReload = Math.max(6, rankReload);
      for (let i = 0; i < bulletCount; i++) {
        const spread = (Math.random() - 0.5) * hSpread;
        const sPow = dtShotPowerMul();
        stage.playerWaves.push({
          kind: "bullet", x: px + spread * 6, y: py + 6, w: 5, h: 5,
          vx: spread * 0.5, vy: 12.0 + Math.random() * 2.0, ttl: 25, power: 0.6 * sPow
        });
      }
      if (seHandgun) playSound(seHandgun, 0.5, 0.9);
      dedicatedGunCooldown = rainReload;
      triggerImpact(0.6, px, py + 10, 1.5);
      battleRankGainByStyle("bullet_rain", 0.8);
      hudMessage = "BULLET RAIN!";
      hudTimer = 8;
      return;
    }
    if (!isGunslinger || !input.down || player.onGround) {
      bulletRainTimer = 0;
      bulletRainRotation = false;
    }

    // Gunslinger: ↓+K (ground) = Bullet Storm (multi-direction shot)
    if (isGunslinger && input.down && player.onGround) {
      performBulletStorm();
      dedicatedGunCooldown = rankReload;
      if (!player.onGround) player.vy = Math.min(player.vy, -0.2);
      return;
    }

    // Normal gun: air shooting gives stronger hang time
    if (!player.onGround) {
      player.vy = Math.min(player.vy, -0.1);
    }

    if (gunType === 0) {
      // Handgun: fast, single shot
      const speed = 5.5 + rankIdx * 1.0;
      stage.playerWaves.push({
        kind: "bullet", x: px + dir * 6, y: py, w: 8, h: 4,
        vx: dir * speed, vy: (Math.random() - 0.5) * 0.3, ttl: 65, power: 0.6
      });
      if (seHandgun) playSound(seHandgun, 0.45);
      dedicatedGunCooldown = rankReload;
      triggerImpact(0.5, px + dir * 10, py, 1.0);
      battleRankGainByStyle("gun_handgun", 0.6);
    } else if (gunType === 1) {
      // Shotgun: short-range spread, high stagger
      const pellets = 4 + Math.min(3, Math.floor(rankIdx * 0.6));
      const spreadBase = 0.6 + rankIdx * 0.12;
      const startAngle = -Math.floor(pellets / 2);
      for (let i = 0; i < pellets; i++) {
        const ang = startAngle + i;
        stage.playerWaves.push({
          kind: "shotgun", x: px + dir * 8, y: py, w: 5, h: 5,
          vx: dir * 5.5, vy: ang * spreadBase, ttl: 12, power: 1.0,
          stagger: true,  // Flag for hitstun
        });
      }
      if (seShotgun) playSound(seShotgun, 0.7);
      dedicatedGunCooldown = Math.max(8, rankReload * 2.5);
      triggerImpact(1.5, px + dir * 8, py, 2.5);
      battleRankGainByStyle("gun_shotgun", 1.0);
    } else {
      // Grenade: arcing projectile, explodes on enemy contact or after time
      const powerBase = 3.0 + rankIdx * 0.3;
      stage.playerWaves.push({
        kind: "grenade", x: px + dir * 10, y: py - 6, w: 8, h: 8,
        vx: dir * 3.5, vy: -4.0, gravity: 0.15,
        ttl: 120, power: powerBase, spin: 0,
        exploded: false, bounced: 0,
      });
      if (seBazooka) playSound(seBazooka, 0.6);
      dedicatedGunCooldown = Math.max(12, rankReload * 4);
      triggerImpact(0.8, px + dir * 10, py, 1.5);
      battleRankGainByStyle("gun_grenade", 1.5);
    }
  }

  // ========== WEAPON SWITCH (I KEY - gun type toggle) ==========
  function handleWeaponSwitch(actions) {
    if (gunSwitchFlashTimer > 0) gunSwitchFlashTimer -= 1;
    if (!actions.weaponSwitchPressed) return;
    gunType = (gunType + 1) % 3;
    gunSwitchFlashTimer = 30;
    hudMessage = "GUN: " + GUN_TYPE_NAMES[gunType];
    hudTimer = 40;
    if (seWhipSwing) playSound(seWhipSwing, 0.3, 1.8);
  }

  function updatePlayerWaves(dt, solids) {
    if (!stage.playerWaves || stage.playerWaves.length === 0) return;
    const crisisMul = pinchAttackMultiplier();
    const screenLeft = cameraX;
    const screenRight = cameraX + W;
    const screenTop = 0;
    const screenBottom = H;

    for (const wave of stage.playerWaves) {
      if (wave.dead) continue;
      let parryHits = 0;
      let parryX = wave.x + wave.w * 0.5;
      let parryY = wave.y + wave.h * 0.5;
      if (wave.kind === "grenade") {
        // Arc trajectory with gravity
        wave.x += wave.vx * dt;
        wave.vy += (wave.gravity || 0.15) * dt;
        wave.y += wave.vy * dt;
        wave.spin = (wave.spin || 0) + dt * 0.4;
        // Bounce off ground
        const groundY = H - 24;
        if (wave.y + wave.h > groundY && wave.vy > 0) {
          wave.y = groundY - wave.h;
          wave.vy = -wave.vy * 0.4;
          wave.vx *= 0.7;
          wave.bounced = (wave.bounced || 0) + 1;
          if (wave.bounced >= 3 || Math.abs(wave.vy) < 0.3) {
            // Explode after too many bounces
            wave.ttl = 0;
          }
        }
        // Check solid collision → bounce
        const cx = wave.x + wave.w * 0.5;
        const cy = wave.y + wave.h * 0.5;
        for (const s of solids) {
          if (s.kind === "crumble" && s.state === "gone") continue;
          if (overlap(wave, s)) {
            if (wave.vy > 0 && wave.y + wave.h > s.y && wave.y < s.y + 4) {
              wave.y = s.y - wave.h;
              wave.vy = -wave.vy * 0.35;
              wave.vx *= 0.7;
              wave.bounced++;
            } else {
              wave.ttl = 0; // Hit wall → explode
            }
            break;
          }
        }
        // Check enemy collision → explode on contact
        let hitEnemy = false;
        for (const enemy of stage.enemies) {
          if (!enemy.alive || enemy.kicked) continue;
          if (overlap(wave, enemy)) { hitEnemy = true; break; }
        }
        if (!hitEnemy) {
          for (const boss of getBossEntities()) {
            if (boss.hp <= 0) continue;
            if (overlap(wave, boss)) { hitEnemy = true; break; }
          }
        }
        if (hitEnemy || wave.ttl <= 0) {
          // EXPLODE! Spawn explosion wave
          wave.dead = true;
          const ex = wave.x + wave.w * 0.5;
          const ey = wave.y + wave.h * 0.5;
          const blastSize = 36 + battleRankIndex * 3;
          stage.playerWaves.push({
            kind: "explosion",
            x: ex - blastSize * 0.5, y: ey - blastSize * 0.5,
            w: blastSize, h: blastSize,
            vx: 0, vy: 0, ttl: 18, power: wave.power * 1.5,
            anim: 0,
          });
          triggerImpact(3.0, ex, ey, 4.0);
          if (seBazooka) playSound(seBazooka, 0.9, 0.7);
          // Explosion particles
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 3;
            hitSparks.push({
              x: ex, y: ey,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1.5,
              life: 12 + Math.random() * 8, maxLife: 20,
              color: ["#ff6600", "#ffaa00", "#ff3300", "#ffcc44"][Math.floor(Math.random() * 4)],
            });
          }
        }
      } else if (wave.kind === "bazooka") {
        wave.x += wave.vx * dt;
        wave.y += wave.vy * dt;
        wave.spin = (wave.spin || 0) + dt * 0.35;
      } else if (wave.kind === "bullet" || wave.kind === "shotgun") {
        wave.x += wave.vx * dt;
        wave.y += wave.vy * dt;
        // Check for solids (Walls/Floors) - only near screen
        const cx = wave.x + wave.w * 0.5;
        const cy = wave.y + wave.h * 0.5;
        if (cx >= screenLeft - 40 && cx <= screenRight + 40 && cy >= -20 && cy <= screenBottom + 20) {
          for (const s of solids) {
            if (s.kind === "crumble" && s.state === "gone") continue;
            // Skip solids far from bullet
            if (Math.abs(s.x + s.w * 0.5 - cx) > s.w * 0.5 + 20) continue;
            if (overlap(wave, s)) {
              wave.dead = true;
              triggerImpact(0.5, cx, cy, 1.5);
              break;
            }
          }
        }
      } else if (wave.kind === "explosion") {
        // Explosion stays in place but might expand or fade
        wave.anim = (wave.anim || 0) + dt;
        if (wave.anim > 20) wave.dead = true; // Short life logic
      } else if (wave.kind === "swordwave") {
        // Swordmaster slam shockwave - expands outward briefly
        wave.phase += dt;
        wave.x += wave.vx * dt;
        wave.w += dt * 2.5; // Expand hitbox
      } else if (wave.kind === "dreadnought") {
        // Dreadnought ground shockwave - travels along the ground, grows taller
        wave.phase += dt;
        wave.x += wave.vx * dt;
        wave.h += dt * 0.6;
        wave.w += dt * 1.2;
      } else if (wave.kind === "dreadnought_ring") {
        // Expanding pulse ring — purely visual, still has damage on overlap
        wave.phase += dt;
        const grow = dt * 3.6;
        wave.x -= grow;
        wave.y -= grow * 0.55;
        wave.w += grow * 2;
        wave.h += grow * 1.1;
      } else if (wave.kind === "drive") {
        // Drive shockwave - flies forward
        wave.phase += dt;
        wave.spin = (wave.spin || 0) + dt * 0.4;
        wave.x += wave.vx * dt;
        wave.y += Math.sin(wave.phase * 0.25) * 0.3;
        // Check solid collision
        const cx = wave.x + wave.w * 0.5;
        const cy = wave.y + wave.h * 0.5;
        if (cx >= screenLeft - 40 && cx <= screenRight + 40) {
          for (const s of solids) {
            if (s.kind === "crumble" && s.state === "gone") continue;
            if (Math.abs(s.x + s.w * 0.5 - cx) > s.w * 0.5 + 20) continue;
            if (overlap(wave, s)) {
              wave.dead = true;
              triggerImpact(1.5, cx, cy, 2.5);
              break;
            }
          }
        }
      } else {
        // Original Wave
        wave.phase += dt;
        wave.spin = (wave.spin || 0) + dt * (0.24 + (wave.power || 0) * 0.18);
        wave.x += wave.vx * dt;
        wave.y += Math.sin(wave.phase * 0.2) * 0.22;
      }
      wave.ttl -= dt;
      const hitLeft = Math.max(wave.x, screenLeft);
      const hitRight = Math.min(wave.x + wave.w, screenRight);
      const hitTop = Math.max(wave.y, screenTop);
      const hitBottom = Math.min(wave.y + wave.h, screenBottom);
      const waveHitbox = hitRight > hitLeft && hitBottom > hitTop
        ? { x: hitLeft, y: hitTop, w: hitRight - hitLeft, h: hitBottom - hitTop }
        : null;

      if (waveHitbox) {
        hitBreakableGimmicks(waveHitbox, 1 + (wave.power || 0) * 0.7);
      }

      for (const enemy of stage.enemies) {
        if (wave.dead) break;
        if (!waveHitbox || !overlap(waveHitbox, enemy)) continue;
        const dir = wave.vx >= 0 ? 1 : -1;
        const isGun = wave.kind === "bullet" || wave.kind === "shotgun";

        // Gun bullets: always deal damage, ignore hitstun/kicked state
        if (isGun) {
          if (!enemy.alive) continue;
          // Initialize HP only if never set
          if (!enemy.maxHp) {
            enemy.maxHp = Math.max(1, Math.round(enemy.kind === "bruiser" ? 16 : enemy.kind === "peacock" ? 10 : 7));
          }
          if (!Number.isFinite(enemy.hp) || enemy.hp === undefined) enemy.hp = enemy.maxHp;
          const gunDmg = Math.max(1, Math.round((wave.power || 0.5) * 0.6));
          enemy.hp = Math.max(0, enemy.hp - gunDmg);
          enemy.flash = Math.max(enemy.flash || 0, 6);
          // Shotgun: heavy stagger + pushback
          if (wave.stagger && !enemy.kicked) {
            enemy.hitstun = Math.max(enemy.hitstun || 0, 18);
            enemy.flash = Math.max(enemy.flash || 0, 12);
            enemy.vx = dir * 2.0; // Knockback
          } else if (!enemy.kicked) {
            // Light flinch — bullets chip away
            enemy.hitstun = Math.max(enemy.hitstun || 0, 4);
          }
          if (enemy.hp <= 0 && !enemy.kicked) {
            // Finish off with kickEnemy for proper defeat handling
            kickEnemy(enemy, dir, (wave.power || 0.5) * 0.5, {
              immediateRemove: false,
              flyLifetime: 22,
              rankStyle: "atk1_wave_shot",
            });
          }
          const hx = enemy.x + enemy.w * 0.5;
          const hy = enemy.y + enemy.h * 0.4;
          // Gunslinger DT: piercing bullets + heavy impact
          if (dtShotPierce()) {
            triggerImpact(1.5 + (wave.power || 0) * 0.8, hx, hy, 3.0);
            spawnWaveBurst(hx, hy, 1.0 + (wave.power || 0) * 0.6);
            hitStopTimer = Math.max(hitStopTimer, 2);
            if (devilTriggerTimer > 0) devilTriggerHitCount++;
            // Don't set wave.dead — bullet pierces through
          } else {
            triggerImpact(0.4 + (wave.power || 0) * 0.2, hx, hy, 1.2);
            spawnWaveBurst(hx, hy, 0.3 + (wave.power || 0) * 0.3);
            wave.dead = true;
          }
          playKickSfx(0.6);
          if (wave.dead) break;
          continue; // Pierce: check next enemy
        }

        // Non-gun projectiles: use original kickEnemy logic
        if (!enemy.alive || enemy.kicked) continue;
        const knockMul = 1.0;
        kickEnemy(enemy, dir, (1.2 + (wave.power || 0) * 0.7) * crisisMul * knockMul, {
          immediateRemove: false,
          flyLifetime: 38,
          rankStyle: "atk1_wave_shot",
        });
        enemy.vx = dir * (5.1 + (wave.power || 0) * 1.3) * crisisMul * knockMul;
        enemy.vy = -(3.5 + (wave.power || 0) * 0.7 + (crisisMul - 1) * 0.9) * knockMul;
        enemy.flash = 12;
        const hx = enemy.x + enemy.w * 0.5;
        const hy = enemy.y + enemy.h * 0.4;
        triggerImpact((isGun ? 0.6 : 1.5) + (wave.power || 0) * (isGun ? 0.3 : 1), hx, hy, isGun ? 1.5 : 2.6);
        spawnWaveBurst(hx, hy, (isGun ? 0.4 : 0.8) + (wave.power || 0) * (isGun ? 0.4 : 0.9));
        playKickSfx(isGun ? 0.8 : 1.32 + (wave.power || 0) * 0.34);

        if (wave.kind === "bazooka") {
          spawnExplosion(wave.x + wave.w / 2, wave.y + wave.h / 2, wave.power || 2);
        }
        if (wave.kind !== "swordwave" && wave.kind !== "explosion" && wave.kind !== "drive") {
          wave.dead = true;
          break;
        }
      }

      if (!wave.dead && stage.boss.active) {
        for (const boss of getBossEntities()) {
          if (boss.hp <= 0 || boss.invuln > 0 || !waveHitbox || !overlap(waveHitbox, boss)) continue;
          const dir = wave.vx >= 0 ? 1 : -1;
          const hx = boss.x + boss.w * 0.5;
          const hy = boss.y + boss.h * 0.4;
          const bf = rollBlackFlashHit(hx, hy, 1.14 + (wave.power || 0) * 1.08);
          const bossDamage = Math.max(1, Math.round((1 + bossDamageBonus()) * crisisMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
          boss.hp = Math.max(0, boss.hp - bossDamage);
          boss.invuln = BOSS_HIT_INVULN_FRAMES;
          boss.vx += dir * (0.62 + (wave.power || 0) * 0.28 + (bf ? 0.24 : 0));
          boss.vy = Math.min(boss.vy, -(1.85 + (wave.power || 0) * 0.24 + (bf ? 0.2 : 0)));
          triggerImpact(2.0 + (wave.power || 0), hx, hy, 3.0);
          spawnWaveBurst(hx, hy, 1.0 + (wave.power || 0));
          playKickSfx(1.52 + (wave.power || 0) * 0.28);

          if (wave.kind === "bazooka") {
            spawnExplosion(wave.x + wave.w / 2, wave.y + wave.h / 2, wave.power || 2);
          }
          handleBossHpZero();
          wave.dead = true;
          break;
        }
      }




      // Guns (bullet/shotgun) cannot cancel enemy projectiles; other weapons can
      const canParry = wave.kind !== "bullet" && wave.kind !== "shotgun";
      if (canParry) {
        for (const bullet of stage.hazardBullets) {
          if (wave.dead) break;
          if (bullet.dead) continue;
          if (!waveHitbox || !overlap(waveHitbox, bullet)) continue;
          bullet.dead = true;
          parryX = bullet.x + bullet.w * 0.5;
          parryY = bullet.y + bullet.h * 0.5;
          parryHits += 1;
        }

        for (const shot of stage.bossShots) {
          if (wave.dead) break;
          if (shot.dead) continue;
          if (!waveHitbox || !overlap(waveHitbox, shot)) continue;
          shot.dead = true;
          parryX = shot.x + shot.w * 0.5;
          parryY = shot.y + shot.h * 0.5;
          parryHits += 1;
        }

        if (parryHits > 0) {
          playParrySfx();
          spawnWaveBurst(parryX, parryY, 0.72 + (wave.power || 0) * 0.7);
        }
      }

      if (wave.ttl <= 0 || wave.x + wave.w < -24 || wave.x > stage.width + 24) {
        wave.dead = true;
        continue;
      }
    }

    stage.playerWaves = stage.playerWaves.filter((w) => !w.dead);
  }

  function updateHammerShards(dt, solids) {
    if (!stage.hammerShards || stage.hammerShards.length === 0) return;

    for (const shard of stage.hammerShards) {
      if (shard.dead) continue;
      shard.ttl -= dt;
      shard.spin += dt * (0.2 + Math.abs(shard.vx) * 0.06);
      shard.vy = Math.min(shard.vy + GRAVITY * 0.54 * dt, MAX_FALL);
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;

      let hitSolid = false;
      for (const s of solids) {
        if (s.kind === "crumble" && s.state === "gone") continue;
        if (!overlap(shard, s)) continue;
        hitSolid = true;
        break;
      }
      if (hitSolid || shard.ttl <= 0 || shard.x < -36 || shard.x > stage.width + 36 || shard.y > H + 80) {
        shard.dead = true;
        continue;
      }

      hitBreakableGimmicks(shard, 1 + shard.power * 0.22);

      for (const enemy of stage.enemies) {
        if (shard.dead) break;
        if (!enemy.alive || enemy.kicked) continue;
        if (!overlap(shard, enemy)) continue;
        const dir = shard.vx >= 0 ? 1 : -1;
        kickEnemy(enemy, dir, 1.1 + shard.power * 0.85, {
          immediateRemove: false,
          flyLifetime: 24,
          rankStyle: "atk2_shard",
        });
        enemy.vx = dir * (4.0 + shard.power * 0.7);
        enemy.vy = Math.min(enemy.vy, -(3.1 + shard.power * 0.4));
        enemy.flash = 10;
        const hx = enemy.x + enemy.w * 0.5;
        const hy = enemy.y + enemy.h * 0.44;
        triggerImpact(1.2 + shard.power * 0.25, hx, hy, 1.8 + shard.power * 0.32);
        shard.dead = true;
      }

      if (!shard.dead && stage.boss.active) {
        for (const boss of getBossEntities()) {
          if (boss.hp <= 0 || boss.invuln > 0 || !overlap(shard, boss)) continue;
          const hx = boss.x + boss.w * 0.5;
          const hy = boss.y + boss.h * 0.45;
          const bf = rollBlackFlashHit(hx, hy, 1.18 + shard.power * 0.94);
          const damage = Math.max(
            1,
            Math.round((1 + bossDamageBonus() + shard.power * 0.42) * pinchAttackMultiplier() * (bf ? BLACK_FLASH_DAMAGE_MUL : 1))
          );
          boss.hp = Math.max(0, boss.hp - damage);
          boss.invuln = BOSS_HIT_INVULN_FRAMES;
          boss.vx += (shard.vx >= 0 ? 1 : -1) * (0.34 + shard.power * 0.2 + (bf ? 0.22 : 0));
          boss.vy = Math.min(boss.vy, -(1.55 + shard.power * 0.18 + (bf ? 0.2 : 0)));
          triggerImpact(1.5 + shard.power * 0.34, hx, hy, 2.3 + shard.power * 0.4);
          handleBossHpZero();
          shard.dead = true;
          break;
        }
      }

      for (const bullet of stage.hazardBullets) {
        if (bullet.dead) continue;
        if (!overlap(shard, bullet)) continue;
        bullet.dead = true;
      }

      for (const shot of stage.bossShots) {
        if (shot.dead) continue;
        if (!overlap(shard, shot)) continue;
        shot.dead = true;
      }
    }

    stage.hammerShards = stage.hammerShards.filter((s) => !s.dead);
  }

  function resolveEnemyContactDamage() {
    if (isTimeBurstStopActive()) return;
    const crisisMul = pinchAttackMultiplier();
    for (const enemy of stage.enemies) {
      if (!enemy.alive || enemy.kicked) continue;

      const weakPartyGuest = enemy.kind === "partygoon";
      const sideGrace = STOMP_SIDE_GRACE;
      const verticalGrace = STOMP_VERTICAL_GRACE;

      const touchingBody = overlap(player, enemy);
      const feetBox = {
        x: player.x - sideGrace,
        y: player.y + player.h - 6,
        w: player.w + sideGrace * 2,
        h: 10 + verticalGrace,
      };
      const stompTarget = {
        x: enemy.x - sideGrace,
        y: enemy.y - 6,
        w: enemy.w + sideGrace * 2,
        h: Math.max(9, Math.floor(enemy.h * 0.68)) + verticalGrace,
      };
      const stompTouch = overlap(feetBox, stompTarget);
      if (!touchingBody && !stompTouch) continue;

      const playerBottom = player.y + player.h;
      const enemyTop = enemy.y;
      const enemyMidY = enemy.y + enemy.h * 0.5;
      const verticalWindow = playerBottom >= enemyTop - 5 && playerBottom <= enemyTop + Math.max(9, enemy.h * 0.72);
      const centerAbove = player.y + player.h * 0.54 <= enemyMidY + 1;
      const descending = player.vy > 0.22;
      const chainAssist = stompChainGuardTimer > 0 && player.vy >= STOMP_DESCEND_MIN;
      const stompable = stompTouch && verticalWindow && centerAbove && (descending || chainAssist);

      if (stompable) {
        const dir = player.x + player.w * 0.5 < enemy.x + enemy.w * 0.5 ? 1 : -1;
        const pLv = proteinLevel();
        const tricksterBonus = playerStyle === "trickster" ? 1.4 : 1.0;
        const stompPower = ((weakPartyGuest ? 1.28 : 1.45) + pLv * 0.045) * crisisMul * tricksterBonus;
        kickEnemy(enemy, dir, stompPower + 0.35, { rankStyle: "stomp" });
        player.vy = -6.35 - Math.min(0.45, Math.abs(player.vx) * 0.08);
        player.vx += dir * 0.12;
        player.onGround = false;
        stompChainGuardTimer = STOMP_CHAIN_GUARD_FRAMES;
        hitStopTimer = Math.max(hitStopTimer, 4.6);

        if (kickComboTimer > 0) {
          kickCombo = Math.min(99, kickCombo + 1);
        } else {
          kickCombo = 1;
        }
        kickComboTimer = 58;

        const hitX = enemy.x + enemy.w * 0.5;
        const hitY = enemy.y + enemy.h * 0.4;
        const burstPower = 2.1 + stompPower * 0.55 + Math.min(0.7, kickCombo * 0.03);
        triggerKickBurst(hitX, hitY, burstPower);
        triggerImpact(2.7, hitX, hitY, 4.2);
        spawnHitSparks(hitX, hitY, "#fff2bc", "#ffb26a");
        spawnHitSparks(hitX, hitY, "#ffe6b0", "#ff6e55");
        playKickSfx(1.58 + stompPower * 0.12);
        hudMessage = kickCombo > 1 ? `踏みつけクラッシュ x${kickCombo}!` : "踏みつけクラッシュ!";
        hudTimer = 32;
        return;
      }

      if (!touchingBody) continue;

      if (invincibleTimer > 0 || proteinBurstTimer > 0) {
        const dir = player.x + player.w * 0.5 < enemy.x + enemy.w * 0.5 ? 1 : -1;
        const speedBoost = Math.min(2.2, Math.abs(player.vx) * 0.5);
        const burstBonus = proteinBurstTimer > 0 ? 2.0 : 0;
        const blastPower = 3.4 + speedBoost + burstBonus;
        kickEnemy(enemy, dir, blastPower, {
          immediateRemove: false,
          flyLifetime: 48,
          rankStyle: proteinBurstTimer > 0 ? "burst_ram" : "invincible_ram",
        });
        enemy.vx = dir * (9.4 + blastPower * 1.2);
        enemy.vy = -(6.6 + blastPower * 0.7);
        enemy.flash = 14;
        const ex = enemy.x + enemy.w * 0.5;
        const ey = enemy.y + enemy.h * 0.5;
        triggerKickBurst(ex, ey, 4.6);
        triggerImpact(5.4, ex, ey, 8.0);
        spawnHitSparks(ex, ey, "#fff7d1", "#ffb16d");
        spawnHitSparks(ex, ey, "#ffecc0", "#ff6d58");
        playKickSfx(2.06);
        hudMessage = proteinBurstTimer > 0 ? "BURSTクラッシュ!" : "無敵クラッシュ!";
        hudTimer = 20;
        return;
      }

      if (stompChainGuardTimer > 0) {
        player.vy = Math.min(player.vy, -4.6);
        player.onGround = false;
        continue;
      }

      // Royal Guard: block enemy body contact (Just Guard aware)
      if (playerStyle === "royalguard" && royalGuardBlockTimer > 0) {
        const ex = enemy.x + enemy.w * 0.5;
        const px2 = player.x + player.w * 0.5;
        const isJust = royalGuardQuality() >= 2;
        enemy.hitstun = Math.max(enemy.hitstun || 0, isJust ? 45 : 30);
        enemy.flash = Math.max(enemy.flash || 0, isJust ? 20 : 15);
        enemy.vx = (ex > px2 ? 1 : -1) * (isJust ? 4.0 : 2.5);
        applyRoyalGuardSuccess(30, 2.5, "GUARD SUCCESS!");
        continue;
      }
      if (enemy.kind === "peacock") {
        killPlayer("孔雀に接触");
      } else {
        killPlayer("敵に接触");
      }
      return;
    }
  }

  function resolveBossContactDamage() {
    if (isTimeBurstStopActive()) return;
    if (!stage.boss.active) return;
    const bosses = getBossEntities();
    for (const b of bosses) {
      if (!overlap(player, b)) continue;
      const bossName = b.kind === "god" ? "神" : b.kind === "peacockman" ? "孔雀人間" : "孔雀ボス";
      if (b.kind === "god" && (b.phaseTransitionTimer || 0) > 0) {
        const pushDir = player.x + player.w * 0.5 < b.x + b.w * 0.5 ? -1 : 1;
        player.vx += pushDir * 0.34;
        player.vy = Math.min(player.vy, -5.1);
        player.onGround = false;
        stompChainGuardTimer = Math.max(stompChainGuardTimer, STOMP_CHAIN_GUARD_FRAMES * 0.52);
        return;
      }
      const playerBottom = player.y + player.h;
      const bossTop = b.y;
      const bossMidY = b.y + b.h * 0.5;
      const sideGrace = 8;
      const stompHit = {
        x: player.x - sideGrace,
        y: player.y + Math.floor(player.h * 0.26),
        w: player.w + sideGrace * 2,
        h: player.h - Math.floor(player.h * 0.26),
      };
      const stompTouch = overlap(stompHit, b);
      const descending = player.vy > -0.26;
      const verticalWindow = playerBottom >= bossTop - 10 && playerBottom <= bossTop + 16;
      const centerAbove = player.y + player.h * 0.66 <= bossMidY + 5;
      const stompable = stompTouch && descending && verticalWindow && centerAbove;
      const nearStompSafe =
        stompTouch &&
        playerBottom >= bossTop - 14 &&
        playerBottom <= bossTop + 22 &&
        player.y + player.h * 0.72 <= bossMidY + 7 &&
        player.vy > -0.42;

      if (stompable) {
        const dir = player.x + player.w * 0.5 < b.x + b.w * 0.5 ? 1 : -1;
        if (b.invuln <= 0 && b.hp > 0) {
          const hitX = b.x + b.w * 0.5;
          const hitY = b.y + b.h * 0.25;
          const bf = rollBlackFlashHit(hitX, hitY, 1.28 + (kickCombo > 1 ? 0.24 : 0));
          const tricksterStompMul = playerStyle === "trickster" ? 1.4 : 1.0;
          const damage = Math.max(1, Math.round((1 + bossDamageBonus()) * pinchAttackMultiplier() * tricksterStompMul * (bf ? BLACK_FLASH_DAMAGE_MUL : 1)));
          b.hp = Math.max(0, b.hp - damage);
          b.invuln = BOSS_HIT_INVULN_FRAMES;
          b.vx += dir * (0.72 + (bf ? 0.28 : 0));
          b.vy = Math.min(b.vy, -(2.2 + (bf ? 0.22 : 0)));
          player.vy = -6.4;
          player.onGround = false;
          stompChainGuardTimer = STOMP_CHAIN_GUARD_FRAMES;
          hitStopTimer = Math.max(hitStopTimer, 4.2);
          triggerKickBurst(hitX, hitY, 2.9);
          triggerImpact(3.0, hitX, hitY, 4.6);
          spawnHitSparks(hitX, hitY, "#fff2bc", "#ffb26a");
          playKickSfx(1.74);
          hudMessage = `${bossName}を踏みつけ!`;
          hudTimer = 28;
          handleBossHpZero();
        } else {
          player.vy = -5.2;
          player.onGround = false;
          stompChainGuardTimer = Math.max(stompChainGuardTimer, STOMP_CHAIN_GUARD_FRAMES * 0.55);
        }
        return;
      }

      if (nearStompSafe) {
        player.vy = -5.0;
        player.onGround = false;
        stompChainGuardTimer = Math.max(stompChainGuardTimer, STOMP_CHAIN_GUARD_FRAMES * 0.55);
        return;
      }

      if (stompChainGuardTimer > 0) {
        player.vy = Math.min(player.vy, -4.8);
        player.onGround = false;
        return;
      }

      // Royal Guard: block boss contact / charge attacks (Just Guard aware)
      if (playerStyle === "royalguard" && royalGuardBlockTimer > 0) {
        const gpx = player.x + player.w * 0.5;
        const pushDir = gpx < b.x + b.w * 0.5 ? -1 : 1;
        player.vx = pushDir * 2.5;
        const energy = b.mode === "dash" ? 50 : 35;
        applyRoyalGuardSuccess(energy, 3.0, b.mode === "dash" ? "CHARGE GUARD!" : "GUARD SUCCESS!");
        return;
      }

      const rage = b.hp <= Math.ceil(b.maxHp * 0.55);
      if (b.mode === "dash") {
        killPlayer(`${bossName}の突進に被弾`);
      } else {
        if (b.kind === "god" && (b.gimmickAdvantageTimer || 0) > 0) {
          player.vy = -5.6;
          player.onGround = false;
          player.vx += (player.x + player.w * 0.5 < b.x + b.w * 0.5 ? -1 : 1) * 0.48;
          stompChainGuardTimer = Math.max(stompChainGuardTimer, STOMP_CHAIN_GUARD_FRAMES * 0.66);
          triggerImpact(1.2, player.x + player.w * 0.5, player.y + player.h * 0.5, 1.8);
          hudMessage = "電磁拘束中! 押し切れ!";
          hudTimer = 18;
          return;
        }
        killPlayer(rage ? `${bossName}の猛攻に被弾` : `${bossName}に接触して被弾`);
      }
      return;
    }
  }

  function setupGodPhaseGimmicks() {
    const left = BOSS_ARENA.minX + 34;
    const center = Math.floor((BOSS_ARENA.minX + BOSS_ARENA.maxX) * 0.5) - 8;
    const right = BOSS_ARENA.maxX - 50;
    stage.godGimmicks = [
      { id: 1, x: left, y: stage.groundY - 12, w: 16, h: 10, charge: 0, cooldown: 0, pulse: 0 },
      { id: 2, x: center, y: stage.groundY - 12, w: 16, h: 10, charge: 0, cooldown: 0, pulse: 0.9 },
      { id: 3, x: right, y: stage.groundY - 12, w: 16, h: 10, charge: 0, cooldown: 0, pulse: 1.8 },
    ];
  }

  function bossDamageBonus() {
    if (!stage || !stage.boss) return 0;
    const b = stage.boss;
    const control = stage.bossArenaControl && stage.bossArenaControl.active
      ? (stage.bossArenaControl.bonusTier || 0)
      : 0;
    const controlBonus = control > 0 ? 1 : 0;
    if (b.kind !== "god") return controlBonus;
    return controlBonus + ((b.gimmickAdvantageTimer || 0) > 0 ? 1 : 0);
  }

  function handleBossHpZero() {
    if (!stage || !stage.boss) return;
    const b = stage.boss;
    if (b.kind === "peacock") {
      const peacocks = getBossEntities(true).filter((boss) => boss.kind === "peacock");
      let anyAlive = false;
      for (const pb of peacocks) {
        if (pb.hp > 0) {
          anyAlive = true;
        } else {
          pb.hp = 0;
          pb.down = true;
          pb.mode = "down";
          pb.vx = 0;
          pb.vy = 0;
        }
      }
      if (anyAlive) return;
      defeatBoss();
      return;
    }
    if (b.hp > 0) return;
    if (b.kind === "god" && (b.phase || 1) < 2) {
      startGodSecondForm();
      return;
    }
    defeatBoss();
  }

  function activateGodGimmick(gimmick) {
    if (!stage || !stage.boss || !stage.boss.active) return;
    const b = stage.boss;
    if (b.kind !== "god" || (b.phase || 1) < 2) return;

    gimmick.charge = 0;
    gimmick.cooldown = 380;
    b.stunTimer = Math.max(b.stunTimer || 0, 88);
    b.gimmickAdvantageTimer = Math.max(b.gimmickAdvantageTimer || 0, 220);
    b.invuln = BOSS_HIT_INVULN_FRAMES;
    b.vx *= 0.24;
    b.vy = Math.min(b.vy, -1.4);
    b.hp = Math.max(0, b.hp - 2);
    const bx = b.x + b.w * 0.5;
    const by = b.y + b.h * 0.44;
    triggerImpact(3.1, bx, by, 5.4);
    spawnWaveBurst(bx, by, 1.2);
    spawnWaveBurst(gimmick.x + gimmick.w * 0.5, gimmick.y + gimmick.h * 0.5, 1.05);
    spawnHitSparks(bx, by, "#d8f6ff", "#7dd1ff");
    playCheckpointSfx();
    playParrySfx();
    playKickSfx(1.92);
    hudMessage = "電磁パネル起動! 神が硬直!";
    hudTimer = 48;
    handleBossHpZero();
  }

  function updateGodGimmicks(dt) {
    if (isTimeBurstStopActive()) return;
    if (gameState !== STATE.BOSS || !stage || !stage.boss || !stage.boss.active) return;
    const b = stage.boss;
    if (b.kind !== "god") return;
    if (!stage.godGimmicks || stage.godGimmicks.length === 0) return;

    for (const gimmick of stage.godGimmicks) {
      gimmick.pulse += dt * 0.14;
      gimmick.cooldown = Math.max(0, (gimmick.cooldown || 0) - dt);
      if ((b.phase || 1) < 2 || (b.phaseTransitionTimer || 0) > 0 || gimmick.cooldown > 0) {
        gimmick.charge = Math.max(0, gimmick.charge - dt * 0.7);
        continue;
      }

      const zone = {
        x: gimmick.x - 2,
        y: gimmick.y - 4,
        w: gimmick.w + 4,
        h: gimmick.h + 8,
      };
      const onPad = player.onGround && overlap(player, zone);
      if (onPad) {
        const add = input.attack ? 1.85 : 1.2;
        gimmick.charge = Math.min(54, gimmick.charge + dt * add);
        if (gimmick.charge >= 54) {
          activateGodGimmick(gimmick);
        }
      } else {
        gimmick.charge = Math.max(0, gimmick.charge - dt * 0.52);
      }
    }
  }

  function startGodSecondForm() {
    if (!stage || !stage.boss) return;
    const b = stage.boss;
    if (b.kind !== "god") {
      defeatBoss();
      return;
    }
    if ((b.phase || 1) >= 2) {
      defeatBoss();
      return;
    }

    b.phase = 2;
    b.phaseTransitionTimer = 0;
    b.mode = "phase_shift";
    b.modeTimer = GOD_PHASE_CUTSCENE_DURATION;
    b.phase2MaxHp = b.phase2MaxHp || GOD_BOSS_PHASE2_HP;
    b.maxHp = b.phase2MaxHp;
    b.hp = b.maxHp;
    b.invuln = GOD_PHASE_CUTSCENE_DURATION + 42;
    b.attackCycle = 0;
    b.shotCooldown = 30;
    b.stunTimer = 0;
    b.gimmickAdvantageTimer = 0;
    playerHearts = MAX_HEARTS;
    damageInvulnTimer = Math.max(damageInvulnTimer, 36);
    hurtFlashTimer = 0;
    b.vx = 0;
    b.vy = 0;
    stage.bossShots = [];
    stage.hammerShards = [];
    stage.playerWaves = [];
    stage.burstMeteors = [];
    if (!stage.godGimmicks || stage.godGimmicks.length === 0) {
      setupGodPhaseGimmicks();
    }
    for (const gimmick of stage.godGimmicks) {
      gimmick.charge = 0;
      gimmick.cooldown = 24 + gimmick.id * 6;
    }
    const arenaSpan = BOSS_ARENA.maxX - BOSS_ARENA.minX;
    const bossTargetX = BOSS_ARENA.minX + Math.floor(arenaSpan * 0.7);
    b.x = clamp(bossTargetX, BOSS_ARENA.minX + 20, BOSS_ARENA.maxX - b.w - 20);
    b.y = stage.groundY - b.h;
    player.x = clamp(BOSS_ARENA.minX + 64, BOSS_ARENA.minX + 8, BOSS_ARENA.maxX - player.w - 20);
    player.y = stage.groundY - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;

    // Keep the same boss BGM in phase 2 (no switch to invincible theme).
    stopInvincibleMusic(false);
    startBossMusic(false);
    triggerImpact(3.6, b.x + b.w * 0.5, b.y + b.h * 0.45, 6.4);
    playBossStartSfx();
    playKickSfx(2.18);
    godPhaseCutsceneTimer = 0;
    gameState = STATE.GOD_PHASE_CUTSCENE;
    cameraX = clamp((BOSS_ARENA.minX + BOSS_ARENA.maxX) * 0.5 - W * 0.5, BOSS_ARENA.minX - 120, stage.width - W);
    hudMessage = "";
    hudTimer = 0;
  }

  function finishGodSecondFormCutscene() {
    if (!stage || !stage.boss) {
      gameState = STATE.BOSS;
      godPhaseCutsceneTimer = 0;
      return;
    }
    const b = stage.boss;
    if (b.kind !== "god") {
      gameState = STATE.BOSS;
      godPhaseCutsceneTimer = 0;
      return;
    }

    b.mode = "idle";
    b.modeTimer = 32;
    b.phaseTransitionTimer = 0;
    b.shotCooldown = 18;
    b.attackCycle = 0;
    b.stunTimer = 0;
    b.gimmickAdvantageTimer = 0;
    b.vx = 0;
    b.vy = 0;
    b.y = stage.groundY - b.h;
    b.invuln = Math.max(b.invuln || 0, 24);
    stage.bossShots = [];

    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.y = stage.groundY - player.h;
    player.facing = 1;

    gameState = STATE.BOSS;
    godPhaseCutsceneTimer = 0;
    cameraX = clamp(player.x + player.w * 0.5 - W * 0.45, BOSS_ARENA.minX - 120, stage.width - W);
    hudMessage = "神 第2形態! 電磁パネルで隙を作れ!";
    hudTimer = 130;
  }

  function updateGodSecondFormCutscene(dt, actions) {
    if (!stage || !stage.boss || !stage.boss.active || stage.boss.kind !== "god") {
      gameState = STATE.BOSS;
      godPhaseCutsceneTimer = 0;
      return;
    }

    godPhaseCutsceneTimer += dt;
    const t = godPhaseCutsceneTimer;
    const b = stage.boss;

    const arenaMid = (BOSS_ARENA.minX + BOSS_ARENA.maxX) * 0.5;
    const pan = Math.sin(t * 0.045) * 10;
    cameraX = clamp(arenaMid - W * 0.5 + pan, BOSS_ARENA.minX - 120, stage.width - W);

    const heroTargetX = clamp(BOSS_ARENA.minX + 64, BOSS_ARENA.minX + 8, BOSS_ARENA.maxX - player.w - 32);
    player.x += (heroTargetX - player.x) * clamp(dt * 0.09, 0, 1);
    player.y = stage.groundY - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    player.anim += dt * 0.55;

    const rise = Math.sin(clamp(t / 112, 0, 1) * Math.PI) * 10;
    b.vx = 0;
    b.vy = 0;
    b.x = clamp(b.x + Math.sin(t * 0.08) * 0.6, BOSS_ARENA.minX + 20, BOSS_ARENA.maxX - b.w - 20);
    b.y = stage.groundY - b.h - rise;
    b.mode = "phase_shift";
    b.modeTimer = Math.max(0, GOD_PHASE_CUTSCENE_DURATION - t);
    b.phaseTransitionTimer = Math.max(1, GOD_PHASE_CUTSCENE_DURATION - t);

    const wantsSkip = actions.startPressed || actions.jumpPressed || actions.attackPressed || actions.attack2Pressed;
    if (wantsSkip && t >= GOD_PHASE_CUTSCENE_SKIP_MIN) {
      finishGodSecondFormCutscene();
      return;
    }

    if (t >= GOD_PHASE_CUTSCENE_DURATION) {
      finishGodSecondFormCutscene();
    }
  }

  function startBossBattle() {
    if (stage.boss.started) return;
    playBossStartSfx();
    const bossKind = stage.boss.kind || "god";
    const isPeacock = bossKind === "peacock";
    const isPeacockHuman = bossKind === "peacockman";
    const isGod = bossKind === "god";
    BOSS_ARENA = stage.bossArena ? { ...stage.bossArena } : BOSS_ARENA;

    if (isGod) {
      // No protein pickups during the God battle.
      for (const protein of stage.proteins) {
        protein.collected = true;
      }
    }

    // Boss arena should be a flat duel zone.
    stage.solids = stage.solids.filter((s) => {
      const inArena = s.x < BOSS_ARENA.maxX && s.x + s.w > BOSS_ARENA.minX;
      const isGround = s.y >= stage.groundY;
      return !inArena || isGround;
    });
    const arenaFloorX = BOSS_ARENA.minX - 4;
    const arenaFloorW = BOSS_ARENA.maxX - BOSS_ARENA.minX + 8;
    const hasArenaFloor = stage.solids.some(
      (s) => s.y === stage.groundY && s.x <= arenaFloorX + 4 && s.x + s.w >= arenaFloorX + arenaFloorW - 4
    );
    if (!hasArenaFloor) {
      stage.solids.push({ x: arenaFloorX, y: stage.groundY, w: arenaFloorW, h: 24, kind: "solid", state: "solid", timer: 0 });
    }
    stage.cannons = stage.cannons.filter((c) => c.x < BOSS_ARENA.minX - 16 || c.x > BOSS_ARENA.maxX + 16);
    stage.fallBlocks = stage.fallBlocks.filter((b) => b.x + b.w < BOSS_ARENA.minX - 10 || b.x > BOSS_ARENA.maxX + 10);
    stage.popSpikes = stage.popSpikes.filter((t) => t.x + t.w < BOSS_ARENA.minX - 10 || t.x > BOSS_ARENA.maxX + 10);

    stage.boss.started = true;
    stage.boss.active = true;
    stage.boss.maxHp = isPeacock
      ? PEACOCK_BOSS_HP
      : isPeacockHuman
        ? PEACOCK_HUMAN_BOSS_HP
        : GOD_BOSS_PHASE1_HP;
    stage.boss.hp = stage.boss.maxHp;
    stage.boss.x = isGod
      ? BOSS_ARENA.minX + Math.floor((BOSS_ARENA.maxX - BOSS_ARENA.minX) * 0.63)
      : BOSS_ARENA.minX + Math.floor((BOSS_ARENA.maxX - BOSS_ARENA.minX) * 0.5);
    stage.boss.y = stage.groundY - stage.boss.h;
    stage.boss.vx = 0;
    stage.boss.vy = 0;
    stage.boss.dir = -1;
    stage.boss.mode = "intro";
    stage.boss.modeTimer = isGod ? 42 : isPeacockHuman ? 38 : 34;
    stage.boss.shotCooldown = isGod ? 24 : isPeacockHuman ? 22 : 26;
    stage.boss.attackCycle = 0;
    stage.boss.spiralAngle = 0;
    stage.boss.invuln = isGod ? 24 : isPeacockHuman ? 22 : 20;
    stage.boss.phase = 1;
    stage.boss.phaseTransitionTimer = 0;
    stage.boss.stunTimer = 0;
    stage.boss.gimmickAdvantageTimer = 0;
    stage.boss.phase2MaxHp = isGod ? GOD_BOSS_PHASE2_HP : stage.boss.maxHp;
    stage.bossShots = [];
    stage.bossTwins = [];
    stage.godGimmicks = [];
    stage.bossArenaControl = null;
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    stage.hazardBullets = [];
    if (isGod) {
      stage.enemies = [];
      stage.enemies.push(
        createPartyGoon(BOSS_ARENA.minX + 42, BOSS_ARENA.minX + 10, BOSS_ARENA.minX + 108, 1),
        createPartyGoon(BOSS_ARENA.minX + 134, BOSS_ARENA.minX + 92, BOSS_ARENA.minX + 194, -1),
        createPartyGoon(BOSS_ARENA.minX + 214, BOSS_ARENA.minX + 168, BOSS_ARENA.minX + 282, 1)
      );
      setupGodPhaseGimmicks();
    } else if (isPeacock) {
      stage.enemies = [];
      const leftX = BOSS_ARENA.minX + Math.floor((BOSS_ARENA.maxX - BOSS_ARENA.minX) * 0.3);
      const rightX = BOSS_ARENA.minX + Math.floor((BOSS_ARENA.maxX - BOSS_ARENA.minX) * 0.66);
      stage.boss.x = leftX;
      stage.boss.dir = 1;
      stage.boss.attackCycle = 0;
      stage.boss.mode = "intro";
      stage.boss.modeTimer = 40;
      stage.boss.shotCooldown = 21;
      const twin = {
        kind: "peacock",
        active: true,
        x: rightX,
        y: stage.groundY - stage.boss.h,
        w: stage.boss.w,
        h: stage.boss.h,
        vx: 0,
        vy: 0,
        dir: -1,
        onGround: false,
        hp: stage.boss.maxHp,
        maxHp: stage.boss.maxHp,
        mode: "intro",
        modeTimer: 52,
        shotCooldown: 18,
        attackCycle: 1,
        spiralAngle: 0,
        invuln: 22,
        phase: 1,
        phaseTransitionTimer: 0,
        stunTimer: 0,
        gimmickAdvantageTimer: 0,
      };
      stage.bossTwins.push(twin);
    } else {
      stage.enemies = [];
      stage.boss.x = BOSS_ARENA.minX + Math.floor((BOSS_ARENA.maxX - BOSS_ARENA.minX) * 0.54);
      stage.boss.dir = -1;
      stage.boss.attackCycle = 0;
      stage.boss.mode = "intro";
      stage.boss.modeTimer = 36;
      stage.boss.shotCooldown = 20;
    }
    setupBossArenaThreats(bossKind);
    openingThemeActive = false;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    attackEffectTimer = 0;
    attackEffectMode = "none";
    attackEffectPhase = 0;
    attackEffectPower = 0;
    resetBlackFlashState(true);
    stopInvincibleMusic();

    godPhaseCutsceneTimer = 0;
    gameState = STATE.BOSS;
    startBossTheme();
    cameraX = clamp(BOSS_ARENA.minX - 96, 0, stage.width - W);
    player.x = clamp(player.x, BOSS_ARENA.minX + 10, BOSS_ARENA.maxX - player.w - 12);
    player.vx = 0;
    player.vy = Math.min(player.vy, 0);

    triggerImpact(2.4, stage.boss.x + stage.boss.w * 0.5, stage.boss.y + stage.boss.h * 0.55, 3.4);
    playKickSfx(1.8);
    hudMessage = isPeacock
      ? "STAGE 1 BOSS: 孔雀ボス2体を同時撃破せよ"
      : isPeacockHuman
        ? "STAGE 2 BOSS: 孔雀人間を撃破してマンション街区へ進め"
        : "ホームパーティー会場突入! 妨害破壊で神を弱体化";
    hudTimer = isGod ? 120 : 112;
  }

  function defeatBoss() {
    if (!stage.boss.active) return;
    const finalStage = currentStageNumber >= FINAL_STAGE_NUMBER;
    stage.boss.active = false;
    stage.boss.mode = "down";
    stage.boss.vx = 0;
    stage.boss.vy = 0;
    if (stage.bossTwins && stage.bossTwins.length > 0) {
      for (const twin of stage.bossTwins) {
        twin.active = false;
        twin.mode = "down";
        twin.vx = 0;
        twin.vy = 0;
      }
    }
    if (stage.bossArenaControl) {
      stage.bossArenaControl.active = false;
    }
    stage.bossShots = [];
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    attackEffectTimer = 0;
    attackEffectMode = "none";
    attackEffectPhase = 0;
    attackEffectPower = 0;
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    hitStopTimer = Math.max(hitStopTimer, 4);
    triggerImpact(3.1, stage.boss.x + stage.boss.w * 0.5, stage.boss.y + stage.boss.h * 0.5, 4.4);
    playKickSfx(2.2);
    playCheckpointSfx();
    startClearTheme();
    const nextStage = Math.min(FINAL_STAGE_NUMBER, currentStageNumber + 1);
    hudMessage = finalStage
      ? "白ヒゲの神を撃破!"
      : currentStageNumber === 1
        ? `孔雀ボス撃破! STAGE ${nextStage}へ`
        : `孔雀人間ボス撃破! STAGE ${nextStage}へ`;
    hudTimer = finalStage ? 150 : 120;
    godPhaseCutsceneTimer = 0;
    gameState = STATE.CLEAR;
    clearTimer = 0;
  }

  function emitPeacockBossShots(boss, rage, human = false) {
    const cx = boss.x + boss.w * 0.5 - 2;
    const cy = boss.y + 12;
    const control = bossArenaControlRatio();
    let spread = human
      ? (rage ? [-0.56, -0.34, -0.12, 0.12, 0.34, 0.56] : [-0.42, -0.18, 0.18, 0.42])
      : (rage ? [-0.42, -0.2, 0, 0.2, 0.42] : [-0.28, 0, 0.28]);
    if (control >= 0.42) {
      spread = spread.filter((_s, i) => i % 2 === 0);
    }
    if (control >= 0.78) {
      spread = [0];
    }
    const speedMul = (human ? 1.08 : 1) - control * (human ? 0.14 : 0.16);
    for (const s of spread) {
      stage.bossShots.push({
        kind: "peacock_feather",
        x: cx,
        y: human ? cy - 1 : cy,
        w: human ? 6 : 5,
        h: human ? 5 : 4,
        vx: boss.dir * ((human ? 1.72 : 1.48) + Math.abs(s) * (human ? 0.72 : 0.6)) * speedMul,
        vy: s * (human ? 1.06 : 1.12) - (human ? 0.03 : 0.06),
        ttl: human ? (rage ? 142 : 126) : (rage ? 132 : 116),
        reason: human ? "孔雀人間の羽弾に被弾" : "孔雀ボスの羽弾に被弾",
      });
    }
    if (human && rage && Math.random() < 0.28) {
      stage.bossShots.push({
        kind: "wave",
        x: cx - 4,
        y: stage.groundY - 6,
        baseY: stage.groundY - 6,
        w: 8,
        h: 4,
        vx: boss.dir * (2.12 - control * 0.2),
        vy: 0,
        ttl: 96,
        seed: Math.random() * Math.PI * 2,
        reason: "孔雀人間の衝撃波に被弾",
      });
    }
    playKickSfx(1.38);
    playProjectileSfx("enemy");
  }

  function updatePeacockBossEntity(boss, dt, solids) {
    const human = boss.kind === "peacockman";
    const rage = boss.hp <= Math.ceil(boss.maxHp * (human ? 0.56 : 0.5));
    const arenaControl = bossArenaControlRatio();
    const shotDrain = (human ? 1.18 : 1.1) - arenaControl * (human ? 0.34 : 0.38);
    const moveSlow = 1 - arenaControl * (human ? 0.1 : 0.12);
    boss.invuln = Math.max(0, boss.invuln - dt);
    boss.modeTimer -= dt;
    boss.shotCooldown -= dt * shotDrain;

    if (boss.mode === "intro") {
      boss.vx = human ? -0.34 : -0.42;
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 28 : 38) : (rage ? 34 : 44);
      }
    } else if (boss.mode === "idle") {
      boss.vx += boss.dir * (human ? (rage ? 0.3 : 0.24) : (rage ? 0.25 : 0.2)) * moveSlow * dt;
      boss.vx = clamp(
        boss.vx,
        -(human ? (rage ? 1.52 : 1.28) : (rage ? 1.34 : 1.1)) * moveSlow,
        (human ? (rage ? 1.52 : 1.28) : (rage ? 1.34 : 1.1)) * moveSlow
      );

      if (boss.x < BOSS_ARENA.minX + 16) {
        boss.x = BOSS_ARENA.minX + 16;
        boss.dir = 1;
      } else if (boss.x + boss.w > BOSS_ARENA.maxX - 16) {
        boss.x = BOSS_ARENA.maxX - 16 - boss.w;
        boss.dir = -1;
      }

      if (boss.modeTimer <= 0) {
        const pattern = boss.attackCycle % (human ? 4 : 3);
        if (pattern === 0) {
          boss.mode = "windup";
          boss.modeTimer = human ? (rage ? 14 : 18) : (rage ? 16 : 22);
          boss.vx *= 0.46;
        } else if (pattern === 1) {
          boss.mode = "shoot";
          boss.modeTimer = human ? (rage ? 82 : 72) : (rage ? 74 : 62);
          boss.shotCooldown = human ? (rage ? 8 : 11) : (rage ? 9 : 12);
          boss.vx *= 0.52;
        } else if (pattern === 2) {
          boss.mode = "leap_prep";
          boss.modeTimer = human ? (rage ? 14 : 18) : (rage ? 16 : 20);
          boss.vx *= 0.48;
        } else {
          boss.mode = "ring";
          boss.modeTimer = rage ? 72 : 64;
          boss.shotCooldown = rage ? 9 : 12;
          boss.vx *= 0.4;
        }
        boss.attackCycle += 1;
      }
    } else if (boss.mode === "windup") {
      boss.vx *= Math.pow(human ? (rage ? 0.54 : 0.6) : (rage ? 0.6 : 0.66), dt);
      if (boss.modeTimer <= 0) {
        boss.mode = "dash";
        boss.modeTimer = human ? (rage ? 34 : 28) : (rage ? 28 : 22);
        boss.vx = boss.dir * (human ? (2.62 + (rage ? 0.56 : 0)) : (2.32 + (rage ? 0.42 : 0))) * (1 - arenaControl * 0.2);
      }
    } else if (boss.mode === "dash") {
      if (boss.x <= BOSS_ARENA.minX + 3) {
        boss.x = BOSS_ARENA.minX + 3;
        boss.dir = 1;
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 24 : 34) : (rage ? 30 : 40);
      } else if (boss.x + boss.w >= BOSS_ARENA.maxX - 3) {
        boss.x = BOSS_ARENA.maxX - 3 - boss.w;
        boss.dir = -1;
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 24 : 34) : (rage ? 30 : 40);
      } else if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 24 : 34) : (rage ? 30 : 40);
      }
    } else if (boss.mode === "shoot") {
      boss.vx *= Math.pow(human ? (rage ? 0.72 : 0.78) : (rage ? 0.78 : 0.84), dt);
      if (boss.shotCooldown <= 0) {
        emitPeacockBossShots(boss, rage, human);
        boss.shotCooldown = (human ? (rage ? 10 : 14) : (rage ? 12 : 16)) * (1 + arenaControl * 0.3);
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 22 : 32) : (rage ? 30 : 40);
      }
    } else if (boss.mode === "leap_prep") {
      boss.vx *= Math.pow(human ? (rage ? 0.56 : 0.64) : (rage ? 0.62 : 0.7), dt);
      if (boss.modeTimer <= 0) {
        const targetX = clamp(
          player.x + player.w * 0.5 + player.vx * (human ? 14 : 11),
          BOSS_ARENA.minX + 20,
          BOSS_ARENA.maxX - 20
        );
        const cx = boss.x + boss.w * 0.5;
        boss.leapTargetX = targetX;
        boss.mode = "leap_air";
        boss.modeTimer = human ? (rage ? 74 : 66) : (rage ? 64 : 56);
        boss.dir = targetX >= cx ? 1 : -1;
        const dist = Math.abs(targetX - cx);
        boss.vx = boss.dir * clamp(
          (human ? 1.8 : 1.5) + dist * (human ? 0.0125 : 0.011),
          human ? 1.68 : 1.4,
          human ? (rage ? 3.08 : 2.74) : (rage ? 2.7 : 2.4)
        );
        boss.vy = human ? (rage ? -7.0 : -6.45) : (rage ? -6.6 : -6.1);
      }
    } else if (boss.mode === "leap_air") {
      if (!boss.onGround) {
        const cx = boss.x + boss.w * 0.5;
        const toward = (boss.leapTargetX || cx) - cx;
        boss.vx += clamp(toward * (human ? 0.0046 : 0.004), -0.05, 0.05) * dt;
        boss.vx = clamp(boss.vx, -(human ? (rage ? 3.08 : 2.74) : (rage ? 2.7 : 2.4)), human ? (rage ? 3.08 : 2.74) : (rage ? 2.7 : 2.4));
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = human ? (rage ? 22 : 32) : (rage ? 30 : 40);
      }
    } else if (boss.mode === "ring") {
      boss.vx *= Math.pow(rage ? 0.72 : 0.8, dt);
      if (boss.shotCooldown <= 0) {
        const cx = boss.x + boss.w * 0.5 - 2;
        const cy = boss.y + 12;
        const control = bossArenaControlRatio();
        const count = Math.max(4, Math.round((rage ? 8 : 6) * (1 - control * 0.24)));
        const speed = (rage ? 1.86 : 1.62) * (1 - control * 0.12);
        for (let i = 0; i < count; i += 1) {
          const rad = (Math.PI * 2 * i) / count;
          stage.bossShots.push({
            kind: "ring",
            x: cx,
            y: cy,
            w: 5,
            h: 5,
            vx: Math.cos(rad) * speed,
            vy: Math.sin(rad) * speed * 0.82,
            ttl: rage ? 126 : 110,
            reason: "孔雀人間の旋回弾に被弾",
          });
        }
        boss.shotCooldown = (rage ? 12 : 16) * (1 + arenaControl * 0.24);
        playKickSfx(1.44);
        playProjectileSfx("enemy");
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = rage ? 24 : 34;
      }
    }

    boss.vy = Math.min(boss.vy + GRAVITY * dt, MAX_FALL);
    moveWithCollisions(boss, solids, dt);
    boss.x = clamp(boss.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - boss.w - 2);
    if (boss.mode === "leap_air" && boss.onGround) {
      if (human) {
        const baseY = stage.groundY - 6;
        const control = bossArenaControlRatio();
        const speed = (rage ? 2.18 : 1.94) * (1 - control * 0.18);
        for (const d of [-1, 1]) {
          stage.bossShots.push({
            kind: "wave",
            x: boss.x + boss.w * 0.5 - 4,
            y: baseY,
            baseY,
            w: 8,
            h: 4,
            vx: speed * d,
            vy: 0,
            ttl: 92,
            seed: Math.random() * Math.PI * 2,
            reason: "孔雀人間の着地衝撃波に被弾",
          });
        }
      }
      triggerImpact(2.2, boss.x + boss.w * 0.5, boss.y + boss.h, 3.2);
      playKickSfx(1.52);
      boss.mode = "idle";
      boss.modeTimer = human ? (rage ? 22 : 32) : (rage ? 30 : 40);
      boss.vx *= 0.24;
      boss.vy = 0;
    }
  }

  function emitBossGroundWave(boss, rage) {
    const control = bossArenaControlRatio();
    const baseY = stage.groundY - 6;
    const speed = (rage ? 2.48 : 2.16) * (1 - control * 0.14);
    const dirs = rage ? [-1, 1, -0.82, 0.82] : [-1, 1];
    const waveDirs = control >= 0.78 ? dirs.filter((d) => Math.abs(d) === 1) : dirs;
    for (const d of waveDirs) {
      stage.bossShots.push({
        kind: "wave",
        x: boss.x + boss.w * 0.5 - 5,
        y: baseY,
        baseY,
        w: 10,
        h: 5,
        vx: speed * d,
        vy: 0,
        ttl: rage ? 126 : 108,
        seed: Math.random() * Math.PI * 2,
        reason: "神の衝撃波に被弾",
      });
    }
    triggerImpact(2.8, boss.x + boss.w * 0.5, boss.y + boss.h, 4.8);
    playKickSfx(1.66);
    playProjectileSfx("cannon");
  }

  function emitBossRingShots(boss, rage) {
    const control = bossArenaControlRatio();
    const cx = boss.x + boss.w * 0.5 - 2;
    const cy = boss.y + 12;
    const baseCount = rage ? 9 : 7;
    const count = Math.max(3, Math.round(baseCount * (1 - control * 0.35)));
    for (let i = 0; i < count; i += 1) {
      const rad = (Math.PI * 2 * i) / count;
      stage.bossShots.push({
        kind: "ring",
        x: cx,
        y: cy,
        w: 5,
        h: 5,
        vx: Math.cos(rad) * (rage ? 1.82 : 1.56) * (1 - control * 0.14),
        vy: Math.sin(rad) * (rage ? 1.44 : 1.22) * (1 - control * 0.14),
        ttl: rage ? 132 : 116,
        reason: "神の結界弾に被弾",
      });
    }
    playKickSfx(1.52);
    playProjectileSfx("enemy");
  }

  function emitBossRainBurst(boss, rage) {
    const control = bossArenaControlRatio();
    const arenaPad = 16;
    const minX = BOSS_ARENA.minX + arenaPad;
    const maxX = BOSS_ARENA.maxX - arenaPad;
    const playerCenter = clamp(player.x + player.w * 0.5, minX, maxX);
    const offset = (Math.random() * 2 - 1) * (rage ? 88 : 66);
    const targetA = clamp(playerCenter + offset, minX, maxX);
    const targetB = clamp(boss.x + boss.w * 0.5 - offset * 0.46, minX, maxX);
    const targetC = clamp((targetA + targetB) * 0.5 + (Math.random() * 2 - 1) * 18, minX, maxX);
    const targetD = clamp(playerCenter - offset * 0.34 + (Math.random() * 2 - 1) * (rage ? 44 : 32), minX, maxX);
    const targets = rage ? [targetA, targetC, targetB, targetD] : [targetA, targetB, targetD];
    const limitedTargets = control >= 0.78
      ? [targets[0]]
      : (control >= 0.42 ? targets.slice(0, 2) : targets);
    for (const tx of limitedTargets) {
      stage.bossShots.push({
        kind: "rain_warn",
        x: tx - 3,
        y: stage.groundY - 22,
        w: 6,
        h: 20,
        ttl: rage ? 24 : 28,
        wind: (Math.random() * 2 - 1) * (rage ? 0.1 : 0.08),
        rainVy: (rage ? 2.34 : 2.02) * (1 - control * 0.12),
        reason: "神の落下弾に被弾",
      });
    }
    playKickSfx(1.42);
    playProjectileSfx("cannon");
  }

  function emitBossSpiralShots(boss, rage) {
    const control = bossArenaControlRatio();
    const cx = boss.x + boss.w * 0.5 - 2;
    const cy = boss.y + 10;
    const count = Math.max(3, Math.round((rage ? 9 : 7) * (1 - control * 0.3)));
    const speed = (rage ? 1.88 : 1.58) * (1 - control * 0.14);
    const base = ((boss.spiralAngle || 0) * Math.PI) / 180;
    for (let i = 0; i < count; i += 1) {
      const ang = base + (Math.PI * 2 * i) / count;
      stage.bossShots.push({
        kind: "spiral",
        x: cx,
        y: cy,
        w: 5,
        h: 5,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.76,
        ttl: rage ? 136 : 120,
        reason: "神の螺旋弾に被弾",
      });
    }
    playKickSfx(1.48);
    playProjectileSfx("enemy");
  }

  function emitBossNovaShots(boss, rage, phase2 = false) {
    const control = bossArenaControlRatio();
    const cx = boss.x + boss.w * 0.5 - 2;
    const cy = boss.y + 12;
    const baseCount = phase2 ? (rage ? 11 : 10) : (rage ? 9 : 7);
    const count = Math.max(3, Math.round(baseCount * (1 - control * 0.34)));
    const speed = (phase2 ? (rage ? 2.08 : 1.86) : (rage ? 1.92 : 1.72)) * (1 - control * 0.16);
    for (let i = 0; i < count; i += 1) {
      const ang = (Math.PI * 2 * i) / count + (phase2 ? (boss.spiralAngle || 0) * Math.PI / 180 : 0);
      stage.bossShots.push({
        kind: phase2 ? "nova2" : "nova",
        x: cx,
        y: cy,
        w: 5,
        h: 5,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.82,
        ttl: phase2 ? 144 : 128,
        reason: phase2 ? "神第2形態の光弾に被弾" : "神の光弾に被弾",
      });
    }
    playKickSfx(phase2 ? 1.92 : 1.66);
    playProjectileSfx("enemy");
  }

  function updateBossShots(dt, solids) {
    if (isTimeBurstStopActive()) return;
    const spawned = [];
    const godAdvantageActive = stage && stage.boss && stage.boss.kind === "god" && (stage.boss.gimmickAdvantageTimer || 0) > 0;
    const control = bossArenaControlRatio();
    const shotSpeedMul = (godAdvantageActive ? 0.78 : 1) * (1 - control * 0.18);
    for (const shot of stage.bossShots) {
      if (shot.dead) continue;

      if (shot.kind === "rain_warn") {
        shot.ttl -= dt;
        if (shot.ttl <= 0) {
          spawned.push({
            kind: "rain",
            x: shot.x,
            y: -18,
            w: 6,
            h: 13,
            vx: shot.wind || 0,
            vy: shot.rainVy || 2.1,
            ttl: 104,
            reason: shot.reason || "神の落下弾に被弾",
          });
          shot.dead = true;
        }
        continue;
      } else if (shot.kind === "wave") {
        shot.x += shot.vx * dt * shotSpeedMul;
        shot.ttl -= dt;
        shot.phase = (shot.phase || 0) + dt * 0.22;
        shot.y = shot.baseY + Math.sin((shot.phase || 0) + (shot.seed || 0)) * 0.8;
      } else if (shot.kind === "spiral") {
        shot.x += shot.vx * dt * shotSpeedMul;
        shot.y += shot.vy * dt * shotSpeedMul;
        shot.ttl -= dt;
      } else if (shot.kind === "nova" || shot.kind === "nova2") {
        shot.x += shot.vx * dt * shotSpeedMul;
        shot.y += shot.vy * dt * shotSpeedMul;
        shot.ttl -= dt;
      } else if (shot.kind === "rain") {
        shot.x += shot.vx * dt * shotSpeedMul;
        shot.y += shot.vy * dt * shotSpeedMul;
        shot.vy += 0.16 * dt;
        shot.ttl -= dt;
      } else {
        shot.x += shot.vx * dt * shotSpeedMul;
        shot.y += shot.vy * dt * shotSpeedMul;
        shot.vy += shot.kind === "ring" ? 0.04 * dt : 0.1 * dt;
        shot.ttl -= dt;
      }

      const touchingPlayer = overlap(player, shot);
      if (touchingPlayer) {
        // Royal Guard: absorb boss shots during block (Just Guard aware)
        if (playerStyle === "royalguard" && royalGuardBlockTimer > 0) {
          shot.dead = true;
          applyRoyalGuardSuccess(35, 2.0, "GUARD!");
          continue;
        }
        killPlayer(shot.reason || "ボス弾に被弾");
      } else if (shot.kind !== "rain_warn") {
        const grazePower = shot.kind === "rain" ? 1.14 : shot.kind === "spiral" || shot.kind === "nova" || shot.kind === "nova2" ? 1.22 : 1.02;
        tryRegisterProjectileGraze(shot, shot, grazePower);
      }

      if (shot.ttl <= 0 || shot.x < BOSS_ARENA.minX - 60 || shot.x > BOSS_ARENA.maxX + 60 || shot.y > H + 30) {
        shot.dead = true;
        continue;
      }

      for (const s of solids) {
        if (overlap(shot, s)) {
          shot.dead = true;
          if (shot.kind === "rain") {
            triggerImpact(1.2, shot.x + shot.w * 0.5, shot.y + shot.h * 0.5, 2.1);
          }
          break;
        }
      }
    }

    stage.bossShots = stage.bossShots.filter((s) => !s.dead);
    if (spawned.length > 0) {
      stage.bossShots.push(...spawned);
    }
  }

  function updateBoss(dt, solids) {
    if (isTimeBurstStopActive()) return;
    if (!stage.boss.active) return;

    const boss = stage.boss;
    if (boss.kind === "peacock") {
      const peacocks = getBossEntities(true).filter((b) => b.kind === "peacock");
      for (const pb of peacocks) {
        if (!pb.active || pb.hp <= 0) continue;
        updatePeacockBossEntity(pb, dt, solids);
      }
      const alive = peacocks.filter((pb) => pb.active && pb.hp > 0);
      if (alive.length >= 2) {
        const a = alive[0];
        const c = alive[1];
        if (overlap(a, c)) {
          const dx = (a.x + a.w * 0.5) - (c.x + c.w * 0.5);
          const push = dx >= 0 ? 0.55 : -0.55;
          a.x += push;
          c.x -= push;
          a.vx += push * 0.06;
          c.vx -= push * 0.06;
          a.x = clamp(a.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - a.w - 2);
          c.x = clamp(c.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - c.w - 2);
        }
      }
      return;
    }
    if (boss.kind === "peacockman") {
      updatePeacockBossEntity(boss, dt, solids);
      return;
    }
    const arenaControl = bossArenaControlRatio();
    const shotDrain = (1 - arenaControl * 0.45) * (boss.kind === "god" ? GOD_BOSS_SHOT_DENSITY_MUL : 1);
    const cooldownMul = 1 + arenaControl * 0.34;
    const moveSlow = 1 - arenaControl * 0.18;
    const phase = boss.phase || 1;
    const phase2 = phase >= 2;
    const rage = boss.hp <= Math.ceil(boss.maxHp * (phase2 ? 0.6 : 0.55));
    boss.invuln = Math.max(0, boss.invuln - dt);
    boss.modeTimer -= dt;
    boss.shotCooldown -= dt * shotDrain;
    if (boss.gimmickAdvantageTimer > 0) {
      boss.gimmickAdvantageTimer = Math.max(0, boss.gimmickAdvantageTimer - dt);
    }
    const advantageActive = (boss.gimmickAdvantageTimer || 0) > 0;

    if ((boss.phaseTransitionTimer || 0) > 0) {
      boss.phaseTransitionTimer = Math.max(0, boss.phaseTransitionTimer - dt);
      boss.mode = "phase_shift";
      boss.vx *= Math.pow(0.78, dt);
      boss.vy = Math.min(boss.vy, -1.2);
      boss.spiralAngle = (boss.spiralAngle + (rage ? 8 : 6) * dt) % 360;
      if (boss.shotCooldown <= 0) {
        emitBossNovaShots(boss, true, true);
        boss.shotCooldown = 18 * cooldownMul;
      }
      if (boss.phaseTransitionTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = 28;
        boss.shotCooldown = 14 * cooldownMul;
        boss.invuln = Math.max(boss.invuln, 14);
        hudMessage = "第2形態開始! 電磁パネルで硬直を狙え!";
        hudTimer = 96;
      }
    } else if (boss.stunTimer > 0) {
      boss.stunTimer = Math.max(0, boss.stunTimer - dt);
      boss.mode = "stunned";
      boss.vx *= Math.pow(0.56, dt);
      boss.vy = Math.min(boss.vy, 0.6);
      boss.shotCooldown = Math.max(boss.shotCooldown, 8);
      if (boss.stunTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? 18 : 30;
      }
    } else if (boss.mode === "intro") {
      boss.vx = -0.54;
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = rage ? 38 : 48;
      }
    } else if (boss.mode === "idle") {
      const accelMul = phase2 ? 1.18 : 1;
      const accel = (rage ? 0.29 : 0.22) * accelMul * (advantageActive ? 0.72 : 1) * moveSlow;
      const moveCap = (rage ? 1.4 : 1.12) * (phase2 ? 1.26 : 1) * (advantageActive ? 0.8 : 1) * moveSlow;
      boss.vx += boss.dir * accel * dt;
      boss.vx = clamp(boss.vx, -moveCap, moveCap);

      if (boss.x < BOSS_ARENA.minX + 18) {
        boss.x = BOSS_ARENA.minX + 18;
        boss.dir = 1;
      } else if (boss.x + boss.w > BOSS_ARENA.maxX - 18) {
        boss.x = BOSS_ARENA.maxX - 18 - boss.w;
        boss.dir = -1;
      }

      if (boss.modeTimer <= 0) {
        const pattern = boss.attackCycle % (phase2 ? 8 : 6);
        if (pattern === 0) {
          boss.mode = "windup";
          boss.modeTimer = phase2 ? (rage ? 15 : 20) : (rage ? 20 : 28);
          boss.vx = 0;
        } else if (pattern === 1) {
          boss.mode = "shoot";
          boss.modeTimer = phase2 ? (rage ? 76 : 88) : (rage ? 78 : 66);
          boss.shotCooldown = (phase2 ? (rage ? 8 : 11) : (rage ? 9 : 13)) * cooldownMul;
          boss.shootVolleyCount = 0;
        } else if (pattern === 2) {
          boss.mode = "leap_prep";
          boss.modeTimer = phase2 ? (rage ? 16 : 22) : (rage ? 20 : 26);
          boss.vx *= 0.5;
        } else if (pattern === 3) {
          boss.mode = "ring";
          boss.modeTimer = phase2 ? (rage ? 78 : 90) : (rage ? 82 : 68);
          boss.shotCooldown = (phase2 ? (rage ? 10 : 14) : (rage ? 11 : 15)) * cooldownMul;
          boss.ringVolleyCount = 0;
          boss.vx *= 0.42;
        } else if (pattern === 4) {
          boss.mode = "rain";
          boss.modeTimer = phase2 ? (rage ? 84 : 98) : (rage ? 94 : 80);
          boss.shotCooldown = (phase2 ? (rage ? 9 : 13) : (rage ? 10 : 14)) * cooldownMul;
          boss.rainVolleyCount = 0;
          boss.vx *= 0.4;
        } else if (pattern === 5) {
          boss.mode = "spiral";
          boss.modeTimer = phase2 ? (rage ? 74 : 86) : (rage ? 88 : 74);
          boss.shotCooldown = (phase2 ? (rage ? 8 : 11) : (rage ? 9 : 13)) * cooldownMul;
          boss.spiralVolleyCount = 0;
          boss.spiralAngle = (boss.spiralAngle + (rage ? 22 : 16)) % 360;
          boss.vx *= 0.35;
        } else if (pattern === 6) {
          boss.mode = "nova";
          boss.modeTimer = rage ? 74 : 88;
          boss.shotCooldown = (rage ? 8 : 12) * cooldownMul;
          boss.novaVolleyCount = 0;
          boss.vx *= 0.32;
        } else {
          boss.mode = "windup";
          boss.modeTimer = rage ? 12 : 17;
          boss.vx *= 0.24;
        }
        boss.attackCycle += 1;
      }
    } else if (boss.mode === "windup") {
      const damp = phase2 ? (rage ? 0.56 : 0.62) : (rage ? 0.62 : 0.68);
      boss.vx *= Math.pow(damp, dt);
      if (boss.modeTimer <= 0) {
        boss.mode = "dash";
        boss.modeTimer = phase2 ? (rage ? 40 : 34) : (rage ? 34 : 28);
        const speedBase = 2.55 + (boss.maxHp - boss.hp) * 0.034 + (rage ? 0.38 : 0) + (phase2 ? 0.52 : 0);
        boss.vx = boss.dir * speedBase * (advantageActive ? 0.78 : 1) * (1 - arenaControl * 0.22);
      }
    } else if (boss.mode === "dash") {
      if (boss.x <= BOSS_ARENA.minX + 3) {
        boss.x = BOSS_ARENA.minX + 3;
        boss.dir = 1;
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 34 : 46);
      } else if (boss.x + boss.w >= BOSS_ARENA.maxX - 3) {
        boss.x = BOSS_ARENA.maxX - 3 - boss.w;
        boss.dir = -1;
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 34 : 46);
      } else if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 34 : 46);
      }
    } else if (boss.mode === "shoot") {
      boss.vx *= Math.pow(phase2 ? (rage ? 0.7 : 0.75) : (rage ? 0.74 : 0.79), dt);

      if (boss.shotCooldown <= 0) {
        const aim = player.x + player.w * 0.5 < boss.x + boss.w * 0.5 ? -1 : 1;
        const spread = ((boss.shootVolleyCount || 0) % 3) - 1;
        let volleyOffsets = phase2
          ? (rage ? [-0.56, -0.4, -0.24, -0.08, 0.08, 0.24, 0.4, 0.56] : [-0.44, -0.26, -0.1, 0.1, 0.26, 0.44])
          : (rage ? [-0.5, -0.32, -0.16, 0, 0.16, 0.32, 0.5] : [-0.32, -0.16, 0, 0.16, 0.32]);
        if (arenaControl >= 0.42) {
          volleyOffsets = volleyOffsets.filter((_v, i) => i % 2 === 0);
        }
        if (arenaControl >= 0.78) {
          volleyOffsets = [0];
        }
        for (const offset of volleyOffsets) {
          stage.bossShots.push({
            x: boss.x + boss.w * 0.5 - 2,
            y: boss.y + 10,
            w: phase2 ? 6 : (rage ? 6 : 5),
            h: phase2 ? 6 : (rage ? 6 : 5),
            vx: (aim * (1.68 + Math.abs(spread) * 0.16) + aim * offset * 0.36) * (1 - arenaControl * 0.16),
            vy: (-0.56 + spread * 0.18 + offset) * (1 - arenaControl * 0.1),
            ttl: rage ? 148 : 136,
            reason: "神の連射弾に被弾",
          });
        }
        boss.shootVolleyCount = (boss.shootVolleyCount || 0) + 1;
        if (phase2 && boss.shootVolleyCount % 2 === 0) {
          emitBossNovaShots(boss, rage, false);
        }
        boss.shotCooldown = (phase2 ? (rage ? 8 : 11) : (rage ? 10 : 14)) * cooldownMul;
      }

      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 34 : 46);
      }
    } else if (boss.mode === "leap_prep") {
      boss.vx *= Math.pow(phase2 ? (rage ? 0.6 : 0.66) : (rage ? 0.66 : 0.72), dt);
      if (boss.modeTimer <= 0) {
        const targetX = clamp(
          player.x + player.w * 0.5 + player.vx * (phase2 ? 18 : 14),
          BOSS_ARENA.minX + (phase2 ? 18 : 20),
          BOSS_ARENA.maxX - (phase2 ? 18 : 20)
        );
        const cx = boss.x + boss.w * 0.5;
        boss.leapTargetX = targetX;
        boss.mode = "leap_air";
        boss.modeTimer = phase2 ? (rage ? 90 : 78) : (rage ? 82 : 70);
        boss.dir = targetX >= cx ? 1 : -1;
        const dist = Math.abs(targetX - cx);
        boss.vx = boss.dir * clamp(1.65 + dist * 0.012, 1.65, phase2 ? (rage ? 3.6 : 3.2) : (rage ? 3.2 : 2.8));
        boss.vy = phase2 ? (rage ? -7.75 : -7.15) : (rage ? -7.35 : -6.85);
      }
    } else if (boss.mode === "leap_air") {
      if (!boss.onGround) {
        const cx = boss.x + boss.w * 0.5;
        const toward = (boss.leapTargetX || cx) - cx;
        boss.vx += clamp(toward * (phase2 ? 0.005 : 0.004), -0.05, 0.05) * dt;
        const leapCap = phase2 ? (rage ? 3.6 : 3.2) : (rage ? 3.2 : 2.8);
        boss.vx = clamp(boss.vx, -leapCap, leapCap);
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 26 : 36) : (rage ? 30 : 42);
      }
    } else if (boss.mode === "ring") {
      boss.vx *= Math.pow(phase2 ? (rage ? 0.7 : 0.76) : (rage ? 0.76 : 0.82), dt);
      if (boss.shotCooldown <= 0) {
        emitBossRingShots(boss, rage);
        boss.ringVolleyCount = (boss.ringVolleyCount || 0) + 1;
        if (phase2 && boss.ringVolleyCount % 2 === 0) {
          emitBossNovaShots(boss, rage, false);
        }
        boss.shotCooldown = (phase2 ? (rage ? 10 : 14) : (rage ? 14 : 19)) * cooldownMul;
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 32 : 44);
      }
    } else if (boss.mode === "rain") {
      const target = player.x + player.w * 0.5 >= boss.x + boss.w * 0.5 ? 1 : -1;
      boss.vx += target * (phase2 ? (rage ? 0.028 : 0.022) : (rage ? 0.022 : 0.016)) * dt;
      boss.vx *= Math.pow(phase2 ? (rage ? 0.8 : 0.84) : (rage ? 0.84 : 0.88), dt);
      boss.vx = clamp(boss.vx, -(phase2 ? 0.92 : 0.72), phase2 ? 0.92 : 0.72);
      if (boss.shotCooldown <= 0) {
        emitBossRainBurst(boss, rage);
        boss.rainVolleyCount = (boss.rainVolleyCount || 0) + 1;
        if (phase2 && boss.rainVolleyCount % 3 === 0) {
          emitBossRingShots(boss, true);
        }
        boss.shotCooldown = (phase2 ? (rage ? 8 : 12) : (rage ? 12 : 18)) * cooldownMul;
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 18 : 30) : (rage ? 30 : 42);
      }
    } else if (boss.mode === "spiral") {
      const target = player.x + player.w * 0.5 >= boss.x + boss.w * 0.5 ? 1 : -1;
      boss.vx += target * (phase2 ? (rage ? 0.036 : 0.03) : (rage ? 0.03 : 0.022)) * dt;
      boss.vx *= Math.pow(phase2 ? (rage ? 0.82 : 0.86) : (rage ? 0.86 : 0.9), dt);
      boss.vx = clamp(boss.vx, -(phase2 ? 1.1 : 0.9), phase2 ? 1.1 : 0.9);
      if (boss.shotCooldown <= 0) {
        emitBossSpiralShots(boss, rage);
        boss.spiralVolleyCount = (boss.spiralVolleyCount || 0) + 1;
        boss.spiralAngle = (boss.spiralAngle + (phase2 ? (rage ? 48 : 38) : (rage ? 36 : 27))) % 360;
        if (phase2 && boss.spiralVolleyCount % 2 === 0) {
          emitBossNovaShots(boss, rage, true);
        }
        boss.shotCooldown = (phase2 ? (rage ? 7 : 10) : (rage ? 9 : 13)) * cooldownMul;
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = phase2 ? (rage ? 16 : 26) : (rage ? 28 : 40);
      }
    } else if (boss.mode === "nova") {
      const target = player.x + player.w * 0.5 >= boss.x + boss.w * 0.5 ? 1 : -1;
      boss.vx += target * (rage ? 0.036 : 0.03) * dt;
      boss.vx *= Math.pow(rage ? 0.84 : 0.88, dt);
      boss.vx = clamp(boss.vx, -1.12, 1.12);
      if (boss.shotCooldown <= 0) {
        emitBossNovaShots(boss, rage, true);
        boss.novaVolleyCount = (boss.novaVolleyCount || 0) + 1;
        if (boss.novaVolleyCount % 2 === 0) {
          emitBossRingShots(boss, true);
        }
        boss.shotCooldown = (rage ? 8 : 11) * cooldownMul;
      }
      if (boss.modeTimer <= 0) {
        boss.mode = "idle";
        boss.modeTimer = rage ? 18 : 28;
      }
    }

    boss.vy = Math.min(boss.vy + GRAVITY * dt, MAX_FALL);
    moveWithCollisions(boss, solids, dt);
    boss.x = clamp(boss.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - boss.w - 2);
    if (boss.mode === "leap_air" && boss.onGround) {
      emitBossGroundWave(boss, phase2 ? true : rage);
      boss.mode = "idle";
      boss.modeTimer = phase2 ? (rage ? 20 : 30) : (rage ? 30 : 42);
      boss.vx *= 0.28;
      boss.vy = 0;
    }
  }

  function updateImpactEffects(dt) {
    updatePinchBgmTension(dt);
    impactShakeTimer = Math.max(0, impactShakeTimer - dt);
    proteinRushTimer = Math.max(0, proteinRushTimer - dt);
    invincibleHitCooldown = Math.max(0, invincibleHitCooldown - dt);
    damageInvulnTimer = Math.max(0, damageInvulnTimer - dt);
    hurtFlashTimer = Math.max(0, hurtFlashTimer - dt);
    kickFlashTimer = Math.max(0, kickFlashTimer - dt);
    kickFlashPower = Math.max(0, kickFlashPower - dt * 0.24);
    blackFlashTimer = Math.max(0, blackFlashTimer - dt);
    blackFlashPower = Math.max(0, blackFlashPower - dt * 0.18);
    blackFlashChanceHudTimer = Math.max(0, blackFlashChanceHudTimer - dt);
    blackFlashResultTimer = Math.max(0, blackFlashResultTimer - dt);
    battleRankFlashTimer = Math.max(0, battleRankFlashTimer - dt);
    battleRankBreakFlashTimer = Math.max(0, battleRankBreakFlashTimer - dt);
    stompChainGuardTimer = Math.max(0, stompChainGuardTimer - dt);
    hammerTimer = Math.max(0, hammerTimer - dt);
    gloveTimer = Math.max(0, gloveTimer - dt);
    hammerHitCooldown = Math.max(0, hammerHitCooldown - dt);
    gloveHitCooldown = Math.max(0, gloveHitCooldown - dt);
    weaponHudTimer = Math.max(0, weaponHudTimer - dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    attackMashTimer = Math.max(0, attackMashTimer - dt);
    if (attackMashTimer <= 0) {
      attackMashCount = 0;
    }
    attackEffectTimer = Math.max(0, attackEffectTimer - dt);
    attackEffectPhase += dt;
    waveFlashTimer = Math.max(0, waveFlashTimer - dt);
    waveFlashPower = Math.max(0, waveFlashPower - dt * 0.08);
    dashJumpAssistTimer = Math.max(0, dashJumpAssistTimer - dt);
    proteinBurstLaserTimer = Math.max(0, proteinBurstLaserTimer - dt);
    proteinBurstLaserPhase += dt;
    if (gloveTimer <= 0) gloveHitCooldown = 0;
    if (hammerTimer <= 0) hammerHitCooldown = 0;
    updateInvincibleMusicFade(dt);
    if (invincibleTimer > 0) {
      invincibleTimer = Math.max(0, invincibleTimer - dt);
      if (invincibleTimer <= 0) {
        endInvincibleMode();
      }
    }

    if (impactShakeTimer <= 0) {
      impactShakePower = Math.max(0, impactShakePower - dt * 0.18);
    }

    kickComboTimer = Math.max(0, kickComboTimer - dt);
    if (kickComboTimer <= 0) {
      kickCombo = 0;
    }

    const groundY = stage && typeof stage.groundY === "number" ? stage.groundY : H - 20;
    for (const spark of hitSparks) {
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const gravity = spark.gravity === undefined ? 0.18 : spark.gravity;
      const drag = spark.drag === undefined ? 0.94 : spark.drag;
      spark.vy += gravity * dt;
      spark.vx *= Math.pow(drag, dt);
      if (spark.kind === "blood") {
        spark.vy = Math.min(spark.vy, 6.8);
        if (!spark.splatted && spark.vy > 0.2 && spark.y >= groundY - 1) {
          spark.y = groundY - 1 + Math.random() * 0.5;
          spark.vx *= 0.38;
          spark.vy *= -0.16;
          spark.splatted = true;
          const baseSize = Math.max(1, spark.size || 1);
          spark.poolW = Math.max(2, Math.round(baseSize + Math.abs(spark.vx) * 2.1 + Math.random() * 2.4));
          spark.poolH = Math.max(1, Math.round(baseSize * 0.75));
          spark.life = Math.max(spark.life, 10 + Math.random() * 9);
          spark.maxLife = Math.max(spark.maxLife, spark.life);
        }
        if (spark.splatted) {
          spark.vx *= Math.pow(0.74, dt);
          spark.vy *= Math.pow(0.56, dt);
        }
      }
      spark.life -= dt;
    }

    for (const burst of waveBursts) {
      burst.life -= dt;
      burst.radius += (0.62 + burst.power * 0.26) * dt;
      burst.phase += dt * (0.16 + burst.power * 0.08);
    }

    for (const pop of invincibleBonusPops) {
      pop.life -= dt;
      pop.phase += dt * (0.22 + pop.power * 0.02);
      pop.x += pop.vx * dt + Math.sin(pop.phase) * 0.03 * dt;
      pop.y -= pop.vy * dt;
      pop.vy = Math.max(0.14, pop.vy * Math.pow(0.975, dt));
    }

    hitSparks = hitSparks.filter((s) => s.life > 0);
    waveBursts = waveBursts.filter((b) => b.life > 0);
    invincibleBonusPops = invincibleBonusPops.filter((p) => p.life > 0);
  }

  function resolveBreakWalls(dt) {
    for (const wall of stage.breakWalls) {
      if (wall.hp <= 0) continue;
      wall.hitCooldown = Math.max(0, (wall.hitCooldown || 0) - dt);
    }
  }

  function resolveHazards() {
    if (player.y > H + 42) {
      killPlayer("奈落に落下", { ignoreInvincible: true, instantGameOver: true });
      return;
    }

    if (isTimeBurstStopActive()) return;

    for (const block of stage.fallBlocks) {
      if (block.state !== "fall") continue;
      if (overlap(player, block)) {
        killPlayer("落下ブロックで即死");
        return;
      }
    }

    for (const trap of stage.popSpikes) {
      if (trap.destroyed || trap.state !== "active") continue;
      const rise = clamp(trap.raise || 0, 0, 1);
      if (rise < 0.35) continue;
      const activeH = Math.max(3, Math.floor(trap.h * rise));
      const hit = {
        x: trap.x + 2,
        y: trap.y + trap.h - activeH,
        w: Math.max(4, trap.w - 4),
        h: activeH,
      };
      if (overlap(player, hit)) {
        killPlayer("電撃ポールに接触");
        return;
      }
    }
  }

  function resolveGoal() {
    if (!overlap(player, stage.goal)) return;
    if (!stage.boss.started) {
      startPreBossCutscene();
    }
  }

  function startPreBossCutscene() {
    if (stage.boss.started) return;
    if (gameState !== STATE.PLAY) return;
    gameState = STATE.PRE_BOSS;
    playCheckpointSfx();
    preBossCutsceneTimer = -PRE_BOSS_ENTRY_DURATION;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    invincibleTimer = 0;
    invincibleHitCooldown = 0;
    stopInvincibleMusic();
    stopBossMusic(true);
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    const entryStartX = stage.goal.x - player.w - 16;
    player.x = Math.min(player.x, entryStartX);
    player.y = stage.groundY - player.h;
    player.facing = 1;
    player.onGround = true;
    player.vx = 0;
    player.vy = 0;
    player.anim = 0;
    hudMessage = "";
    hudTimer = 0;
  }

  function sampleActions() {
    // Secondary attack is retired from gameplay.
    input.attack2 = false;
    const downPressed = input.down && !prevInput.down;
    const dashPressedNow = input.dash && !prevInput.dash;
    const actions = {
      jumpPressed: input.jump && !prevInput.jump,
      attackPressed: input.attack && !prevInput.attack,
      attackReleased: !input.attack && prevInput.attack,
      attack2Pressed: false,
      attack2Released: false,
      shootPressed: input.shoot && !prevInput.shoot,
      shootReleased: !input.shoot && prevInput.shoot,
      dashPressed: dashPressedNow,
      downPressed: downPressed,
      weaponSwitchPressed: input.weaponSwitch && !prevInput.weaponSwitch,
      specialPressed: input.special && !prevInput.special,
      special2Pressed: input.special2 && !prevInput.special2,
      startPressed: input.start && !prevInput.start,
      styleChangePressed: input.styleChange && !prevInput.styleChange,
      burstPressed: input.burst && !prevInput.burst,
      tauntPressed: input.taunt && !prevInput.taunt,
    };

    // Double-tap trackers (decay each frame, armed on a second press within the window)
    if (downTapWindowTimer > 0) downTapWindowTimer -= 1;
    if (doubleDownPrimedTimer > 0) doubleDownPrimedTimer -= 1;
    if (dashTapWindowTimer > 0) dashTapWindowTimer -= 1;
    if (doubleDashPrimedTimer > 0) doubleDashPrimedTimer -= 1;
    if (downPressed) {
      if (downTapWindowTimer > 0) {
        doubleDownPrimedTimer = DOUBLE_TAP_PRIMED_WINDOW;
        downTapWindowTimer = 0;
      } else {
        downTapWindowTimer = DOUBLE_TAP_WINDOW;
      }
    }
    if (dashPressedNow) {
      if (dashTapWindowTimer > 0) {
        doubleDashPrimedTimer = DOUBLE_TAP_PRIMED_WINDOW;
        dashTapWindowTimer = 0;
      } else {
        dashTapWindowTimer = DOUBLE_TAP_WINDOW;
      }
    }

    // Simultaneous-press detection (J+K, J+L within SIMUL_PRESS_WINDOW)
    if (attackPressRecent > 0) attackPressRecent -= 1;
    if (shootPressRecent > 0) shootPressRecent -= 1;
    if (dashPressRecent > 0) dashPressRecent -= 1;
    actions.simulJK = false;
    actions.simulJL = false;
    if (actions.attackPressed) {
      if (shootPressRecent > 0) { actions.simulJK = true; shootPressRecent = 0; }
      if (dashPressRecent > 0) { actions.simulJL = true; dashPressRecent = 0; }
      attackPressRecent = SIMUL_PRESS_WINDOW;
    }
    if (actions.shootPressed) {
      if (attackPressRecent > 0) { actions.simulJK = true; attackPressRecent = 0; }
      shootPressRecent = SIMUL_PRESS_WINDOW;
    }
    if (dashPressedNow) {
      if (attackPressRecent > 0) { actions.simulJL = true; attackPressRecent = 0; }
      dashPressRecent = SIMUL_PRESS_WINDOW;
    }

    prevInput.jump = input.jump;
    prevInput.left = input.left;
    prevInput.right = input.right;
    prevInput.down = input.down;
    prevInput.attack = input.attack;
    prevInput.attack2 = false;
    prevInput.shoot = input.shoot;
    prevInput.dash = input.dash;
    prevInput.weaponSwitch = input.weaponSwitch;
    prevInput.special = input.special;
    prevInput.special2 = input.special2;
    prevInput.start = input.start;
    prevInput.styleChange = input.styleChange;
    prevInput.burst = input.burst;
    prevInput.taunt = input.taunt;

    return actions;
  }

  function updateEmergencyDodge(rawDt, actions) {
    if (emergencyDodgeInvulnTimer > 0) {
      emergencyDodgeInvulnTimer = Math.max(0, emergencyDodgeInvulnTimer - rawDt);
    }
    if (emergencyDodgeCounterTimer > 0) {
      emergencyDodgeCounterTimer = Math.max(0, emergencyDodgeCounterTimer - rawDt);
    }
    // Always decrement flash timer even when dodge is inactive
    if (emergencyDodgeFlashTimer > 0) {
      emergencyDodgeFlashTimer = Math.max(0, emergencyDodgeFlashTimer - rawDt);
    }
    if (!emergencyDodgeActive) return false;

    emergencyDodgeTimer = Math.max(0, emergencyDodgeTimer - rawDt);
    emergencyDodgePhase += rawDt;

    const anyButton = actions.jumpPressed || actions.attackPressed ||
      actions.specialPressed || actions.special2Pressed || actions.startPressed;

    if (anyButton) {
      emergencyDodgeActive = false;
      emergencyDodgeTimer = 0;
      emergencyDodgeInvulnTimer = EMERGENCY_DODGE_INVULN_DURATION;
      emergencyDodgeFlashTimer = 18;
      emergencyDodgeCounterTimer = 90; // Counter-attack window: 1.5 sec
      damageInvulnTimer = Math.max(damageInvulnTimer, 60);
      triggerImpact(3.5, player.x + player.w * 0.5, player.y + player.h * 0.5, 5.0);
      // Nearby enemies get stunned
      for (const enemy of stage.enemies) {
        if (!enemy.alive || enemy.kicked) continue;
        const dx = Math.abs((enemy.x + enemy.w * 0.5) - (player.x + player.w * 0.5));
        const dy = Math.abs((enemy.y + enemy.h * 0.5) - (player.y + player.h * 0.5));
        if (dx < 80 && dy < 60) {
          enemy.hitstun = Math.max(enemy.hitstun || 0, 45);
          enemy.flash = Math.max(enemy.flash || 0, 20);
        }
      }
      battleRankDodgeChain++;
      hudMessage = battleRankDodgeChain >= 3 ? "SMOKIN SEXY DODGE!" : "緊急回避成功! COUNTER READY!";
      hudTimer = 80;
      battleRankGainByStyle("emergency_dodge", 2.5 + battleRankDodgeChain * 0.5);
      playPowerupSfx();
      return false;
    }

    if (emergencyDodgeTimer <= 0) {
      emergencyDodgeActive = false;
      emergencyDodgeSkipNext = true;
      killPlayer(emergencyDodgeReason, emergencyDodgeOptions);
      return false;
    }

    return true;
  }

  function updatePlay(dt, actions) {
    if (hudTimer > 0) hudTimer -= dt;
    updateImpactEffects(dt);
    consumeBurstIfPressed(actions);
    updateTaunt(dt, actions);
    const worldDt = dt * (isTimeBurstActive() ? timeBurstDtScale() : 1);

    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      player.anim += dt * 0.2;
      if (!isTimeBurstStopActive()) {
        return;
      }
    }

    const pLv = proteinLevel();
    const rush = proteinRushTimer > 0 ? 1 : 0;
    const accel = 0.24 + pLv * 0.006 + rush * 0.03;
    const maxSpeed = 1.7 + pLv * 0.022 + rush * 0.26;
    const friction = rush ? 0.87 : 0.83;
    const jumpPower = 6.35 + pLv * 0.046 + rush * 0.16;

    const solids = collectSolids();
    const bursting = updateProteinBurst(dt, solids, 0, stage.width - player.w);

    if (!bursting) {
      const wasOnGround = player.onGround;
      const vyBeforeMove = player.vy;
      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;

      if (move !== 0) {
        player.vx += move * accel * dt;
        player.facing = move > 0 ? 1 : -1;
      } else {
        player.vx *= Math.pow(friction, dt);
      }

      const speedCap = maxSpeed * (dashJumpAssistTimer > 0 ? DASH_JUMP_SPEED_CAP_MULT : 1) * dtMovementSpeedMul();
      player.vx = clamp(player.vx, -speedCap, speedCap);

      if (actions.jumpPressed && player.onGround) {
        player.vy = -jumpPower;
        playJumpSfx();
        swordDoubleJumpUsed = false;
        const runningJump = move !== 0 && Math.abs(player.vx) >= DASH_JUMP_MIN_SPEED && Math.sign(player.vx) === move;
        if (runningJump) {
          player.vx = clamp(player.vx + move * DASH_JUMP_VX_BONUS, -maxSpeed * DASH_JUMP_SPEED_CAP_MULT, maxSpeed * DASH_JUMP_SPEED_CAP_MULT);
          player.vy -= DASH_JUMP_VY_BONUS;
          dashJumpAssistTimer = DASH_JUMP_ASSIST_FRAMES;
        }
        player.onGround = false;
      } else if (actions.jumpPressed && !player.onGround && !swordDoubleJumpUsed) {
        swordDoubleJumpUsed = true;
        player.vy = -(jumpPower * 0.85);
        playJumpSfx();
      }

      // Swordmaster upper hang
      if (swordUpperHangTimer > 0) {
        swordUpperHangTimer -= dt;
        player.vy = Math.min(player.vy, -0.1);
        if (swordUpperHangTimer <= 0) swordUpperHangTimer = 0;
      }
      if (swordStingerActive && swordStingerTimer > 0) {
        swordStingerTimer -= dt;
        const stingerDir = player.facing;
        const stingerSpd = SWORD_STINGER_SPEED * (1 + battleRankIndex * 0.08) * (devilTriggerTimer > 0 ? 1.3 : 1);
        player.vx = stingerDir * stingerSpd;
        damageInvulnTimer = Math.max(damageInvulnTimer, 2);
        // Continuous hit detection: catch new enemies during rush
        const stingerReach = 32 + battleRankIndex * 3;
        const stingerHitBox = {
          x: stingerDir > 0 ? player.x + player.w : player.x - stingerReach,
          y: player.y + 2, w: stingerReach, h: 16,
        };
        for (const enemy of stage.enemies) {
          if (!enemy.alive || enemy.kicked) continue;
          if (stingerCaughtEnemies.includes(enemy)) continue;
          if (!overlap(stingerHitBox, enemy)) continue;
          enemy.vx = 0;
          enemy.vy = 0;
          enemy.flash = 12;
          enemy.hitstun = Math.max(enemy.hitstun || 0, 20);
          stingerCaughtEnemies.push(enemy);
          spawnWaveBurst(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 0.5);
          if (seStrongHit) playSound(seStrongHit, 0.4);
          if (devilTriggerTimer > 0) devilTriggerHitCount++;
        }
        // Drag caught enemies along with player
        for (const enemy of stingerCaughtEnemies) {
          if (!enemy.alive) continue;
          enemy.x = player.x + stingerDir * (player.w + 2);
          enemy.y = player.y + (player.h - enemy.h) * 0.5;
          enemy.vx = player.vx;
          enemy.vy = 0;
          enemy.flash = Math.max(enemy.flash, 2);
        }
        // J pressed during stinger -> Million Stab
        if (actions.attackPressed && !millionStabActive) {
          millionStabActive = true;
          millionStabTimer = 12; // Short initial duration — mash to extend
          millionStabHitTimer = 0;
          swordStingerTimer = 0; // End stinger rush
          player.vx = 0; // Stop moving
          swordAttackCooldown = 0;
          hudMessage = "MILLION STAB!";
          hudTimer = 40;
          if (seStrongHit) playSound(seStrongHit, 0.7);
        }
        if (swordStingerTimer <= 0 && !millionStabActive) {
          swordStingerActive = false;
          const dir = player.facing;
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.vx = dir * 4;
            enemy.vy = -2;
          }
          stingerCaughtEnemies = [];
        }
      }
      // Million Stab: rapid multi-hit while stationary
      if (millionStabActive && millionStabTimer > 0) {
        millionStabTimer -= dt;
        millionStabHitTimer -= dt;
        player.vx = 0; // Stay in place
        // Keep player visible — clamp to stage bounds
        player.x = clamp(player.x, 0, stage.width - player.w);
        damageInvulnTimer = Math.max(damageInvulnTimer, 2);
        swordAttackCooldown = 0;
        // Rapid hits
        if (millionStabHitTimer <= 0) {
          millionStabHitTimer = MILLION_STAB_HIT_INTERVAL;
          const dir = player.facing;
          const reach = Math.floor(28 * dtReachMul());
          const power = (0.8 + battleRankIndex * 0.08) * dtPowerMul();
          const hitBox = {
            x: dir > 0 ? player.x + player.w : player.x - reach,
            y: player.y + 2,
            w: reach,
            h: 14,
          };
          swordHitEnemies(hitBox, dir, power, 0.1);
          swordHitBoss(hitBox, dir, power);
          hitStopTimer = 0;
          // Keep caught enemies locked in place
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.x = player.x + dir * (player.w + 2);
            enemy.y = player.y + (player.h - enemy.h) * 0.5;
            enemy.vx = 0;
            enemy.vy = 0;
            enemy.flash = Math.max(enemy.flash, 3);
          }
          triggerImpact(0.8, player.x + dir * 20, player.y + 8, 1.5);
          spawnSwordSlash(dir, 1 + dtSparkCount());
          if (seHandgun) playSound(seHandgun, 0.3, 1.2 + Math.random() * 0.4);
          battleRankGainByStyle("million_stab", 0.5);
        }
        // Extending: if J is pressed/mashed, extend duration (mash-based)
        if (actions.attackPressed && millionStabTimer < MILLION_STAB_DURATION) {
          millionStabTimer = Math.min(millionStabTimer + 8, MILLION_STAB_DURATION);
        }
        if (millionStabTimer <= 0) {
          millionStabActive = false;
          swordStingerActive = false;
          // Final hit — launch enemies away
          const dir = player.facing;
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.vx = dir * 6 * dtKnockMul();
            enemy.vy = -3;
          }
          stingerCaughtEnemies = [];
          swordAttackCooldown = 10;
          attackEffectTimer = 8;
          attackEffectMode = "sword";
          triggerImpact(2.0 * dtPowerMul(), player.x + dir * 20, player.y + 8, 3);
          if (seStrongHit) playSound(seStrongHit, 0.9);
        }
      }

      const gravityMult = (dashJumpAssistTimer > 0 && input.jump ? DASH_JUMP_GRAVITY_MULT : 1)
        * (swordUpperHangTimer > 0 ? 0 : 1);
      player.vy = Math.min(player.vy + GRAVITY * gravityMult * dt, MAX_FALL);
      moveWithCollisions(player, solids, dt, triggerCrumble);
      player.x = clamp(player.x, 0, stage.width - player.w);
      if (!wasOnGround && player.onGround && vyBeforeMove > 1.6) {
        playLandSfx(0.9 + clamp(vyBeforeMove / 6, 0, 1.2));
      }
      player.anim += dt;
    }

    updateCrumble(worldDt);
    updatePopSpikes(worldDt);
    updateFallBlocks(worldDt);
    updateCannons(worldDt);

    const solidsAfter = collectSolids();
    updateEnemies(worldDt, solidsAfter);
    updateHazardBullets(worldDt, solidsAfter);
    updateProteins(worldDt);
    updateHeartItems(worldDt);
    updateLifeUpItems(worldDt);
    updateBikes(worldDt);
    updateCheckpointTokens(worldDt);
    // --- Combat Dash / Trickster ---
    if (!bursting) {
      updateCombatDash(dt, actions);
    }
    // --- Round Trip update ---
    updateRoundTrip(dt);
    // --- Dedicated Gun (K key, always available) ---
    updateDedicatedGun(dt, actions);
    // --- Weapon Switch (I key) ---
    handleWeaponSwitch(actions);
    // --- Air combo reset on landing ---
    if (player.onGround && airComboCount > 0) {
      if (airComboCount >= 3) {
        hudMessage = airComboCount + " HIT AIR COMBO!";
        hudTimer = 50;
        battleRankGainByStyle("air_combo_finish", airComboCount * 0.5);
      }
      airComboCount = 0;
      airComboStage = 0;
    }
    if (airComboDisplayTimer > 0) airComboDisplayTimer -= dt;

    if (proteinBurstTimer <= 0) {
      updatePlayerAttack(dt, actions);
    }
    updatePlayerWaves(dt, solidsAfter);
    updateHammerShards(worldDt, solidsAfter);
    updateDoppelgangers(worldDt);
    updateGunStinger(dt, actions);
    resolveEnemyContactDamage();
    resolveBreakWalls(worldDt);
    resolveHazards();
    resolveGoal();

    cameraX = clamp(player.x + player.w * 0.5 - W * 0.45, 0, stage.width - W);
  }

  function updateBossBattle(dt, actions) {
    if (hudTimer > 0) hudTimer -= dt;
    updateImpactEffects(dt);
    consumeBurstIfPressed(actions);
    updateTaunt(dt, actions);
    const worldDt = dt * (isTimeBurstActive() ? timeBurstDtScale() : 1);

    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
      player.anim += dt * 0.2;
      if (!isTimeBurstStopActive()) {
        return;
      }
    }

    const pLv = proteinLevel();
    const rush = proteinRushTimer > 0 ? 1 : 0;
    const accel = 0.24 + pLv * 0.006 + rush * 0.03;
    const maxSpeed = 1.7 + pLv * 0.022 + rush * 0.26;
    const friction = rush ? 0.87 : 0.83;
    const jumpPower = 6.35 + pLv * 0.046 + rush * 0.16;

    const solids = collectSolids();
    const bursting = updateProteinBurst(dt, solids, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - player.w - 2);

    if (!bursting) {
      const wasOnGround = player.onGround;
      const vyBeforeMove = player.vy;
      let move = 0;
      if (input.left) move -= 1;
      if (input.right) move += 1;

      if (move !== 0) {
        player.vx += move * accel * dt;
        player.facing = move > 0 ? 1 : -1;
      } else {
        player.vx *= Math.pow(friction, dt);
      }

      const speedCap = maxSpeed * (dashJumpAssistTimer > 0 ? DASH_JUMP_SPEED_CAP_MULT : 1) * dtMovementSpeedMul();
      player.vx = clamp(player.vx, -speedCap, speedCap);

      if (actions.jumpPressed && player.onGround) {
        player.vy = -jumpPower;
        playJumpSfx();
        swordDoubleJumpUsed = false;
        const runningJump = move !== 0 && Math.abs(player.vx) >= DASH_JUMP_MIN_SPEED && Math.sign(player.vx) === move;
        if (runningJump) {
          player.vx = clamp(player.vx + move * DASH_JUMP_VX_BONUS, -maxSpeed * DASH_JUMP_SPEED_CAP_MULT, maxSpeed * DASH_JUMP_SPEED_CAP_MULT);
          player.vy -= DASH_JUMP_VY_BONUS;
          dashJumpAssistTimer = DASH_JUMP_ASSIST_FRAMES;
        }
        player.onGround = false;
      } else if (actions.jumpPressed && !player.onGround && !swordDoubleJumpUsed) {
        swordDoubleJumpUsed = true;
        player.vy = -(jumpPower * 0.85);
        playJumpSfx();
      }

      if (swordUpperHangTimer > 0) {
        swordUpperHangTimer -= dt;
        player.vy = Math.min(player.vy, -0.1);
        if (swordUpperHangTimer <= 0) swordUpperHangTimer = 0;
      }
      if (swordStingerActive && swordStingerTimer > 0) {
        swordStingerTimer -= dt;
        const stingerDir2 = player.facing;
        const stingerSpd2 = SWORD_STINGER_SPEED * (1 + battleRankIndex * 0.08) * (devilTriggerTimer > 0 ? 1.3 : 1);
        player.vx = stingerDir2 * stingerSpd2;
        damageInvulnTimer = Math.max(damageInvulnTimer, 2);
        // Continuous hit detection during boss stage stinger
        const stReach2 = 32 + battleRankIndex * 3;
        const stHitBox2 = {
          x: stingerDir2 > 0 ? player.x + player.w : player.x - stReach2,
          y: player.y + 2, w: stReach2, h: 16,
        };
        for (const enemy of stage.enemies) {
          if (!enemy.alive || enemy.kicked) continue;
          if (stingerCaughtEnemies.includes(enemy)) continue;
          if (!overlap(stHitBox2, enemy)) continue;
          enemy.vx = 0; enemy.vy = 0; enemy.flash = 12;
          enemy.hitstun = Math.max(enemy.hitstun || 0, 20);
          stingerCaughtEnemies.push(enemy);
          spawnWaveBurst(enemy.x + enemy.w * 0.5, enemy.y + enemy.h * 0.4, 0.5);
          if (devilTriggerTimer > 0) devilTriggerHitCount++;
        }
        for (const enemy of stingerCaughtEnemies) {
          if (!enemy.alive) continue;
          enemy.x = player.x + stingerDir2 * (player.w + 2);
          enemy.y = player.y + (player.h - enemy.h) * 0.5;
          enemy.vx = player.vx;
          enemy.vy = 0;
          enemy.flash = Math.max(enemy.flash, 2);
        }
        if (actions.attackPressed && !millionStabActive) {
          millionStabActive = true;
          millionStabTimer = 12; // Short initial — mash to extend
          millionStabHitTimer = 0;
          swordStingerTimer = 0;
          player.vx = 0;
          swordAttackCooldown = 0;
          hudMessage = "MILLION STAB!";
          hudTimer = 40;
          if (seStrongHit) playSound(seStrongHit, 0.7);
        }
        if (swordStingerTimer <= 0 && !millionStabActive) {
          swordStingerActive = false;
          const dir = player.facing;
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.vx = dir * 4;
            enemy.vy = -2;
          }
          stingerCaughtEnemies = [];
        }
      }
      if (millionStabActive && millionStabTimer > 0) {
        millionStabTimer -= dt;
        millionStabHitTimer -= dt;
        player.vx = 0;
        player.x = clamp(player.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - player.w - 2);
        damageInvulnTimer = Math.max(damageInvulnTimer, 2);
        swordAttackCooldown = 0;
        if (millionStabHitTimer <= 0) {
          millionStabHitTimer = MILLION_STAB_HIT_INTERVAL;
          const dir = player.facing;
          const reach = Math.floor(28 * dtReachMul());
          const power = (0.8 + battleRankIndex * 0.08) * dtPowerMul();
          const hitBox = {
            x: dir > 0 ? player.x + player.w : player.x - reach,
            y: player.y + 2,
            w: reach,
            h: 14,
          };
          swordHitEnemies(hitBox, dir, power, 0.1);
          swordHitBoss(hitBox, dir, power);
          hitStopTimer = 0;
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.x = player.x + dir * (player.w + 2);
            enemy.y = player.y + (player.h - enemy.h) * 0.5;
            enemy.vx = 0;
            enemy.vy = 0;
            enemy.flash = Math.max(enemy.flash, 3);
          }
          triggerImpact(0.8, player.x + dir * 20, player.y + 8, 1.5);
          spawnSwordSlash(dir, 1 + dtSparkCount());
          if (seHandgun) playSound(seHandgun, 0.3, 1.2 + Math.random() * 0.4);
          battleRankGainByStyle("million_stab", 0.5);
        }
        if (actions.attackPressed && millionStabTimer < MILLION_STAB_DURATION) {
          millionStabTimer = Math.min(millionStabTimer + 8, MILLION_STAB_DURATION);
        }
        if (millionStabTimer <= 0) {
          millionStabActive = false;
          swordStingerActive = false;
          const dir = player.facing;
          for (const enemy of stingerCaughtEnemies) {
            if (!enemy.alive) continue;
            enemy.vx = dir * 6 * dtKnockMul();
            enemy.vy = -3;
          }
          stingerCaughtEnemies = [];
          swordAttackCooldown = 10;
          attackEffectTimer = 8;
          attackEffectMode = "sword";
          triggerImpact(2.0 * dtPowerMul(), player.x + dir * 20, player.y + 8, 3);
          if (seStrongHit) playSound(seStrongHit, 0.9);
        }
      }

      const gravityMult = (dashJumpAssistTimer > 0 && input.jump ? DASH_JUMP_GRAVITY_MULT : 1)
        * (swordUpperHangTimer > 0 ? 0 : 1);
      player.vy = Math.min(player.vy + GRAVITY * gravityMult * dt, MAX_FALL);
      moveWithCollisions(player, solids, dt, triggerCrumble);
      player.x = clamp(player.x, BOSS_ARENA.minX + 2, BOSS_ARENA.maxX - player.w - 2);
      if (!wasOnGround && player.onGround && vyBeforeMove > 1.6) {
        playLandSfx(0.9 + clamp(vyBeforeMove / 6, 0, 1.2));
      }
      player.anim += dt;
    }

    updateProteins(worldDt);
    updateHeartItems(worldDt);
    updateLifeUpItems(worldDt);
    updateBikes(worldDt);
    updateBoss(worldDt, solids);
    if (gameState !== STATE.BOSS) return;
    updateGodGimmicks(worldDt);
    if (gameState !== STATE.BOSS) return;
    updateBossShots(worldDt, solids);
    if (gameState !== STATE.BOSS) return;
    updateEnemies(worldDt, solids);
    updateHazardBullets(worldDt, solids);
    // --- Combat systems (Boss battle) ---
    updateCombatDash(dt, actions);
    updateRoundTrip(dt);
    updateDedicatedGun(dt, actions);
    handleWeaponSwitch(actions);
    if (player.onGround && airComboCount > 0) {
      if (airComboCount >= 3) {
        hudMessage = airComboCount + " HIT AIR COMBO!";
        hudTimer = 50;
        battleRankGainByStyle("air_combo_finish", airComboCount * 0.5);
      }
      airComboCount = 0;
      airComboStage = 0;
    }
    if (airComboDisplayTimer > 0) airComboDisplayTimer -= dt;
    if (proteinBurstTimer <= 0) {
      updatePlayerAttack(dt, actions);
    }
    if (gameState !== STATE.BOSS) return;
    updatePlayerWaves(dt, solids);
    if (gameState !== STATE.BOSS) return;
    updateHammerShards(worldDt, solids);
    if (gameState !== STATE.BOSS) return;
    updateDoppelgangers(worldDt);
    updateGunStinger(dt, actions);
    resolveEnemyContactDamage();
    resolveBossContactDamage();
    resolveBreakWalls(worldDt);
    resolveHazards();

    cameraX = clamp(player.x + player.w * 0.5 - W * 0.45, BOSS_ARENA.minX - 120, stage.width - W);
  }

  function beginOpeningCutscene() {
    playUiStartSfx();
    titleTimer = 0;
    cutsceneTime = 0;
    stageIntroTimer = 0;
    preBossCutsceneTimer = 0;
    godPhaseCutsceneTimer = 0;
    cameraX = 0;
    if (!tutorialCompleted) {
      tutorialStep = 0;
      tutorialTimer = 0;
      tutorialStepProgress = 0;
      tutorialStepCount = 0;
      tutorialAutoTimer = 0;
      tutorialFadeOut = 0;
      tutorialSkipHold = 0;
      tutorialPage = 0;
      gameState = STATE.TUTORIAL;
    } else {
      gameState = STATE.CUTSCENE;
    }
    startOpeningTheme();
  }

  function updateTitle(dt, actions) {
    cameraX = 0;
    titleTimer += dt;
    player.anim += dt * 0.45;
    startOpeningTheme();

    if (actions.startPressed || actions.jumpPressed || actions.attackPressed || actions.attack2Pressed) {
      beginOpeningCutscene();
    }
  }

  function skipTutorial() {
    tutorialCompleted = true;
    tutorialFadeOut = 0;
    gameState = STATE.CUTSCENE;
  }

  function updateTutorial(dt, actions) {
    cameraX = 0;
    tutorialTimer += dt;
    player.anim += dt * 0.45;
    tutorialSuccessPulse = Math.max(0, tutorialSuccessPulse - dt);

    // Skip: hold start (Enter) or long-press
    if (input.start) {
      tutorialSkipHold += dt;
      if (tutorialSkipHold >= TUTORIAL_SKIP_HOLD_TIME) {
        skipTutorial();
        return;
      }
    } else {
      tutorialSkipHold = 0;
    }

    // Fade out transition
    if (tutorialFadeOut > 0) {
      tutorialFadeOut -= dt;
      if (tutorialFadeOut <= 0) {
        tutorialCompleted = true;
        gameState = STATE.CUTSCENE;
      }
      return;
    }

    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step) {
      skipTutorial();
      return;
    }

    // Auto-advance steps (like the "ready" step)
    if (step.autoAdvance) {
      tutorialAutoTimer += dt;
      if (tutorialAutoTimer >= step.autoAdvance) {
        tutorialFadeOut = 20;
      }
      return;
    }

    // Info-only steps: advance on any button press
    if (step.info) {
      if (actions.jumpPressed || actions.attackPressed || actions.startPressed || actions.dashPressed || actions.shootPressed) {
        advanceTutorialStep();
      }
      return;
    }

    // Check if current step condition is met
    if (step.check(actions)) {
      if (step.requiredCount) {
        tutorialStepCount++;
        tutorialSuccessPulse = 14;
        if (tutorialStepCount >= step.requiredCount) {
          advanceTutorialStep();
        }
      } else if (step.requiredFrames) {
        tutorialStepProgress += dt;
        tutorialSuccessPulse = Math.max(tutorialSuccessPulse, 6);
        if (tutorialStepProgress >= step.requiredFrames) {
          advanceTutorialStep();
        }
      } else {
        advanceTutorialStep();
      }
    }
  }

  function advanceTutorialStep() {
    tutorialStep++;
    tutorialStepProgress = 0;
    tutorialStepCount = 0;
    tutorialAutoTimer = 0;
    tutorialPage = 0;
    tutorialSuccessPulse = 24;
  }

  // Get phase label and color
  function getTutorialPhaseInfo(phase) {
    switch (phase) {
      case "BASIC": return { label: "基本操作", color: "#ff6f8c" };
      case "STYLE": return { label: "スタイル", color: "#ffcc22" };
      case "RANK": return { label: "バトルランク", color: "#ff6622" };
      case "ADVANCED": return { label: "上級テクニック", color: "#aa66ff" };
      case "READY": return { label: "出陣", color: "#ffd700" };
      default: return { label: "TUTORIAL", color: "#ff6f8c" };
    }
  }

  // Larger, cinematic demo stage drawn at the bottom of the tutorial.
  // Shows the hero at a bigger scale with a proper ground line, shadow, aura,
  // and action-specific choreography for each interactive step.
  function drawTutorialStage(step, t, centerX, groundY) {
    ctx.save();

    // Stage strip: horizon line + grid floor hint
    const stripTop = groundY - 30;
    ctx.fillStyle = "rgba(10, 14, 26, 0.55)";
    ctx.fillRect(0, stripTop, W, groundY - stripTop + 6);
    // Neon horizon stroke
    ctx.fillStyle = "rgba(255, 111, 140, 0.55)";
    ctx.fillRect(0, stripTop, W, 1);
    ctx.fillStyle = "rgba(168, 220, 255, 0.25)";
    ctx.fillRect(0, stripTop + 1, W, 1);
    // Floor lines (perspective hint)
    for (let i = 0; i < 5; i++) {
      const ly = stripTop + 6 + i * 5;
      const alpha = 0.05 + i * 0.04;
      ctx.fillStyle = `rgba(255, 223, 200, ${alpha})`;
      ctx.fillRect(0, ly, W, 1);
    }
    // Vertical cue ticks scrolling leftward (motion feel)
    const scroll = (t * 0.6) % 18;
    for (let x = -scroll; x < W; x += 18) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(Math.floor(x), groundY, 6, 1);
    }

    const heroScale = 1.7;
    // drawHero positions feet at y + 25 regardless of scale; visual top is at y + 25 - 25 * scale
    const HERO_BASE_H = 25;
    const spriteH = HERO_BASE_H * heroScale; // visual height on screen
    const heroY = groundY - HERO_BASE_H; // pass to drawHero so feet land on groundY
    const heroTop = groundY - spriteH; // visual top of scaled sprite
    const heroMid = heroTop + spriteH * 0.5; // visual vertical center
    const facingBase = 1;

    // Optional success pulse: white flash halo behind hero
    if (tutorialSuccessPulse > 0) {
      const p = tutorialSuccessPulse / 24;
      ctx.fillStyle = `rgba(255, 240, 180, ${0.3 * p})`;
      ctx.beginPath();
      ctx.arc(centerX, heroMid, 26 + p * 12, 0, Math.PI * 2);
      ctx.fill();
      // radiating tick marks
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8 + t * 0.04;
        const rx = centerX + Math.cos(a) * (22 + p * 18);
        const ry = heroMid + Math.sin(a) * (16 + p * 12);
        ctx.fillStyle = `rgba(255, 255, 200, ${0.6 * p})`;
        ctx.fillRect(Math.floor(rx), Math.floor(ry), 2, 2);
      }
    }

    const key = step.key;

    // --- Per-step choreography ---
    if (key === "move") {
      // Hero walks back and forth across the stage, leaving dust
      const cycle = (t * 0.012) % 2;
      const dir = cycle < 1 ? 1 : -1;
      const phase = cycle < 1 ? cycle : (cycle - 1);
      const swing = Math.sin(phase * Math.PI);
      const offset = dir * (swing * 52 - 26 * (1 - swing));
      const heroX = centerX - 7 + offset;
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dust puffs trailing
      for (let i = 0; i < 4; i++) {
        const dp = ((t * 0.05 + i * 0.25) % 1);
        const dx = heroX + 7 - dir * (4 + dp * 18);
        const dy = groundY - dp * 4;
        ctx.fillStyle = `rgba(200, 220, 255, ${0.35 * (1 - dp)})`;
        ctx.fillRect(Math.floor(dx), Math.floor(dy), 2, 2);
      }
      drawHero(heroX, heroY, dir, t * 1.6, heroScale);
      // Speed lines when moving fast
      if (swing > 0.4) {
        for (let i = 0; i < 3; i++) {
          const lx = heroX + 7 - dir * (12 + i * 6);
          const ly = heroY + 8 + i * 6;
          ctx.fillStyle = `rgba(180, 220, 255, ${0.5 - i * 0.15})`;
          ctx.fillRect(lx, ly, dir * -6, 1);
        }
      }

    } else if (key === "jump") {
      // Hero bounces: jump, peak, double jump, land
      const cycle = (t * 0.02) % 1;
      const jumpH = Math.sin(cycle * Math.PI) * 30;
      const doubleJump = cycle > 0.55 ? Math.sin((cycle - 0.55) * Math.PI / 0.45) * 14 : 0;
      const heroX = centerX - 7;
      const hy = heroY - jumpH - doubleJump;
      // Shadow shrinks with altitude
      const shadowR = Math.max(4, 11 - (jumpH + doubleJump) * 0.28);
      ctx.fillStyle = `rgba(0,0,0,${0.38 - (jumpH + doubleJump) * 0.007})`;
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, shadowR, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Double-jump burst ring
      if (cycle > 0.54 && cycle < 0.62) {
        const bp = (cycle - 0.54) / 0.08;
        ctx.strokeStyle = `rgba(255, 220, 120, ${1 - bp})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(heroX + 7, hy + HERO_BASE_H, 8 + bp * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      // Jump dust on takeoff
      if (cycle < 0.08) {
        const dp = cycle / 0.08;
        ctx.fillStyle = `rgba(220, 230, 255, ${0.7 * (1 - dp)})`;
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(heroX + 7 + i * 3, groundY - dp * 2, 2, 1);
        }
      }
      drawHero(heroX, hy, facingBase, t * 0.8, heroScale);

    } else if (key === "attack") {
      // Hero swings 3-hit combo with expanding arcs + sparks
      const cycle = (t * 0.018) % 3;
      const idx = Math.floor(cycle);
      const phase = cycle - idx;
      const heroX = centerX - 7;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHero(heroX, heroY, facingBase, t * 1.8, heroScale, phase > 0.15 && phase < 0.55 ? 0.6 : 0);
      // Slash arc
      const slashCx = heroX + 16;
      const slashCy = heroMid + 2;
      if (phase > 0.05 && phase < 0.55) {
        const alpha = 1 - (phase - 0.05) / 0.5;
        const r = 20 + idx * 5;
        const angStart = -Math.PI * 0.5 + phase * Math.PI * 1.4;
        ctx.strokeStyle = `rgba(255,${220 - idx * 30},${160 - idx * 40},${alpha * 0.9})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(slashCx, slashCy, r, angStart - 0.8, angStart + 0.8);
        ctx.stroke();
        ctx.lineWidth = 1;
        // White inner arc
        ctx.strokeStyle = `rgba(255,255,240,${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(slashCx, slashCy, r - 2, angStart - 0.4, angStart + 0.4);
        ctx.stroke();
      }
      // Sparks at impact
      if (phase > 0.18 && phase < 0.32) {
        for (let i = 0; i < 6; i++) {
          const sa = Math.random() * Math.PI * 2;
          const sd = 18 + Math.random() * 14;
          const sx = slashCx + Math.cos(sa) * sd;
          const sy = slashCy + Math.sin(sa) * sd * 0.8;
          ctx.fillStyle = `rgba(255,${200 + Math.random() * 55},120,0.9)`;
          ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
        }
      }

    } else if (key === "shoot") {
      // Hero holds a stance while bullets stream forward
      const heroX = centerX - 18;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHero(heroX, heroY, facingBase, t * 0.3, heroScale);
      // Muzzle flash pulse
      const gunY = heroMid + 4;
      const muzzlePulse = (t * 0.18) % 1;
      if (muzzlePulse < 0.2) {
        const mp = muzzlePulse / 0.2;
        ctx.fillStyle = `rgba(255, 240, 150, ${0.9 - mp * 0.9})`;
        ctx.beginPath();
        ctx.arc(heroX + 20, gunY, 5 - mp * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 - mp * 0.7})`;
        ctx.fillRect(heroX + 18, gunY - 1, 6, 2);
      }
      // Stream of bullets
      for (let i = 0; i < 5; i++) {
        const bp = ((t * 0.06 + i * 0.2) % 1);
        const bx = heroX + 22 + bp * 90;
        const by = gunY + (i % 2) * 1;
        ctx.fillStyle = `rgba(255, 220, 80, ${1 - bp})`;
        ctx.fillRect(Math.floor(bx), Math.floor(by), 5, 2);
        ctx.fillStyle = `rgba(255, 255, 220, ${0.6 * (1 - bp)})`;
        ctx.fillRect(Math.floor(bx + 3), Math.floor(by), 3, 1);
      }

    } else if (key === "dash") {
      // Hero dashes across, leaving a blue streak and afterimages
      const cycle = (t * 0.018) % 1;
      if (cycle < 0.35) {
        const heroX = centerX - 34;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        drawHero(heroX, heroY, facingBase, t * 0.5, heroScale);
      } else if (cycle < 0.6) {
        const dp = (cycle - 0.35) / 0.25;
        const startX = centerX - 34;
        const endX = centerX + 30;
        const hx = startX + (endX - startX) * dp;
        // Streak
        ctx.fillStyle = `rgba(130, 220, 255, ${0.55 * (1 - dp)})`;
        ctx.fillRect(startX, heroTop + spriteH * 0.3, hx - startX + 14, spriteH * 0.55);
        ctx.fillStyle = `rgba(220, 240, 255, ${0.45 * (1 - dp)})`;
        ctx.fillRect(startX, heroMid, hx - startX + 14, 2);
        // Afterimages
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.18 - i * 0.035;
          drawHero(hx - 7 - (i + 1) * 10, heroY, facingBase, t * 0.5, heroScale);
        }
        ctx.globalAlpha = 1;
        drawHero(hx - 7, heroY, facingBase, t * 0.5, heroScale);
      } else {
        const heroX = centerX + 24;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        drawHero(heroX, heroY, facingBase, t * 0.5, heroScale);
        // Landing flash
        const lp = (cycle - 0.6) / 0.4;
        ctx.strokeStyle = `rgba(130, 220, 255, ${0.6 * (1 - lp)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(heroX + 7, groundY, 6 + lp * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

    } else if (key === "style_try") {
      // Hero rotates through 4 style auras
      const heroX = centerX - 7;
      const styleColors = ["#ff6644", "#ffcc22", "#22aaff", "#22ff88"];
      const styleNames = ["SWORD", "TRICK", "GUN", "GUARD"];
      const cycle = (t * 0.015) % 4;
      const idx = Math.floor(cycle);
      const phase = cycle - idx;
      const color = styleColors[idx];
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Color ring swirl
      const ringR = 18 + Math.sin(t * 0.1) * 2;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12 + t * 0.06;
        const rx = heroX + 7 + Math.cos(a) * ringR;
        const ry = heroMid + Math.sin(a) * ringR * 0.7;
        const alpha = 0.3 + Math.sin(a * 2 + t * 0.1) * 0.3;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.floor(rx), Math.floor(ry), 2, 2);
      }
      ctx.globalAlpha = 1;
      // Switch flash
      if (phase < 0.18) {
        const fp = phase / 0.18;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5 * (1 - fp);
        ctx.fillRect(heroX - 14, heroTop + 4, 42, spriteH - 8);
        ctx.globalAlpha = 1;
      }
      drawHero(heroX, heroY, facingBase, t * 1.2, heroScale);
      // Style label
      ctx.fillStyle = color;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(styleNames[idx], centerX, heroTop - 3);

    } else {
      // Fallback: idle hero
      const heroX = centerX - 7;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(heroX + 7, groundY + 1, 10, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHero(heroX, heroY, facingBase, t * 0.8, heroScale);
    }

    ctx.restore();
  }

  function drawTutorialDemo(step, t, demoX, demoY) {
    // Render animated demo for each tutorial step
    const key = step.key;
    ctx.save();

    // Demo stage ground line
    const groundY = demoY + 26;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(demoX - 60, groundY, 120, 1);

    const facing = 1;
    const heroX = demoX - 7;
    const heroY = demoY;

    if (key === "move") {
      // Walking demo: hero moves left and right
      const cycle = (t * 0.03) % 2;
      const dir = cycle < 1 ? 1 : -1;
      const offset = cycle < 1 ? (cycle * 40 - 20) : ((cycle - 1) * 40 - 20);
      drawHero(heroX + offset, heroY, dir, t * 1.2, 1.2);
      // Speed lines
      for (let i = 0; i < 3; i++) {
        const lx = heroX + offset - dir * (6 + i * 5);
        const ly = heroY + 8 + i * 5;
        ctx.fillStyle = `rgba(200,220,255,${0.3 - i * 0.08})`;
        ctx.fillRect(lx, ly, dir * -4, 1);
      }

    } else if (key === "jump") {
      // Jump demo: hero bounces up and down
      const jumpCycle = (t * 0.04) % 1;
      const jumpH = Math.sin(jumpCycle * Math.PI) * 20;
      const doubleJump = jumpCycle > 0.5 ? Math.sin((jumpCycle - 0.5) * Math.PI * 2) * 8 : 0;
      drawHero(heroX, heroY - jumpH - doubleJump, 1, t * 0.8, 1.2);
      // Jump trail
      if (jumpH > 5) {
        ctx.fillStyle = `rgba(255,255,200,${jumpH / 30})`;
        ctx.beginPath();
        ctx.arc(heroX + 7, heroY + 24, 3, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (key === "attack") {
      // Combo demo: hero swings sword in sequence
      const comboCycle = (t * 0.025) % 3;
      const comboIdx = Math.floor(comboCycle);
      const comboPhase = comboCycle - comboIdx;
      drawHero(heroX, heroY, 1, t * 1.5, 1.2, comboPhase > 0.3 && comboPhase < 0.7 ? 0.5 : 0);
      // Sword slash arcs
      if (comboPhase > 0.1 && comboPhase < 0.6) {
        const slashAlpha = 1 - (comboPhase - 0.1) / 0.5;
        const slashAngle = -Math.PI * 0.3 + comboPhase * Math.PI * 1.2;
        const slashR = 16 + comboIdx * 3;
        ctx.strokeStyle = `rgba(255,${200 - comboIdx * 40},${150 - comboIdx * 50},${slashAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(heroX + 14, heroY + 10, slashR, slashAngle - 0.8, slashAngle + 0.8);
        ctx.stroke();
        // Hit sparks
        if (comboPhase > 0.2 && comboPhase < 0.35) {
          for (let i = 0; i < 4; i++) {
            const sx = heroX + 22 + Math.random() * 8;
            const sy = heroY + 6 + Math.random() * 12;
            ctx.fillStyle = `rgba(255,${200 + Math.random() * 55},100,${0.8 * slashAlpha})`;
            ctx.fillRect(sx, sy, 2, 1);
          }
        }
      }

    } else if (key === "shoot") {
      // Shooting demo: hero fires bullets
      drawHero(heroX - 10, heroY, 1, 0, 1.2);
      const bulletCycle = (t * 0.08) % 1;
      for (let i = 0; i < 3; i++) {
        const bPhase = (bulletCycle + i * 0.33) % 1;
        const bx = heroX + 8 + bPhase * 50;
        const alpha = 1 - bPhase;
        // Bullet trail
        ctx.fillStyle = `rgba(255,200,60,${alpha * 0.8})`;
        ctx.fillRect(bx, heroY + 10, 4, 2);
        ctx.fillStyle = `rgba(255,255,200,${alpha * 0.5})`;
        ctx.fillRect(bx + 1, heroY + 11, 2, 1);
      }
      // Muzzle flash
      if (bulletCycle < 0.15) {
        ctx.fillStyle = `rgba(255,240,150,${0.7 - bulletCycle * 4})`;
        ctx.beginPath();
        ctx.arc(heroX + 10, heroY + 11, 4, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (key === "dash") {
      // Dash demo: hero teleports/dashes forward
      const dashCycle = (t * 0.02) % 1;
      if (dashCycle < 0.3) {
        // Standing
        drawHero(heroX - 20, heroY, 1, t * 0.5, 1.2);
      } else if (dashCycle < 0.5) {
        // Dashing - afterimage trail
        const dashProgress = (dashCycle - 0.3) / 0.2;
        const dx = -20 + dashProgress * 40;
        // Afterimages
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.15 + (2 - i) * 0.1;
          drawHero(heroX - 20 + (dx * i / 3), heroY, 1, t * 0.5, 1.2);
        }
        ctx.globalAlpha = 1;
        drawHero(heroX + dx, heroY, 1, t * 0.5, 1.2);
        // Speed burst
        ctx.fillStyle = `rgba(150,220,255,${0.4 * (1 - dashProgress)})`;
        ctx.fillRect(heroX - 20, heroY + 4, dx, 16);
      } else {
        // Landed
        drawHero(heroX + 20, heroY, 1, t * 0.5, 1.2);
      }

    } else if (key === "style_swordmaster") {
      // Swordmaster demo: charge attack + combo
      const cycle = (t * 0.02) % 2;
      if (cycle < 0.8) {
        // Charge phase (glowing)
        const chargeRatio = cycle / 0.8;
        drawHero(heroX, heroY, 1, t * 0.3, 1.2);
        // Charge aura
        ctx.fillStyle = `rgba(255,100,68,${chargeRatio * 0.3})`;
        ctx.beginPath();
        ctx.arc(heroX + 7, heroY + 12, 10 + chargeRatio * 6, 0, Math.PI * 2);
        ctx.fill();
        // Charge particles
        for (let i = 0; i < 3; i++) {
          const angle = t * 0.1 + i * Math.PI * 0.67;
          const r = 8 + chargeRatio * 5;
          ctx.fillStyle = `rgba(255,200,150,${chargeRatio * 0.7})`;
          ctx.fillRect(heroX + 7 + Math.cos(angle) * r, heroY + 12 + Math.sin(angle) * r, 2, 2);
        }
      } else {
        // Release: big slash
        const releasePhase = (cycle - 0.8) / 1.2;
        drawHero(heroX, heroY, 1, t * 2, 1.2, 0.3);
        // Massive sword arc
        const slashSize = 22 + releasePhase * 10;
        const alpha = Math.max(0, 1 - releasePhase * 1.5);
        ctx.strokeStyle = `rgba(255,100,68,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(heroX + 14, heroY + 8, slashSize, -1.2 + releasePhase * 2, 0.8 + releasePhase * 2);
        ctx.stroke();
        // Impact sparks
        if (releasePhase < 0.3) {
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = 12 + Math.random() * 15;
            ctx.fillStyle = `rgba(255,${180 + Math.random() * 75},80,${alpha})`;
            ctx.fillRect(heroX + 14 + Math.cos(a) * d, heroY + 8 + Math.sin(a) * d, 2, 2);
          }
        }
      }

    } else if (key === "style_trickster") {
      // Trickster demo: teleport dodge sequence
      const cycle = (t * 0.025) % 1.5;
      if (cycle < 0.4) {
        drawHero(heroX - 25, heroY, 1, t * 1.2, 1.2);
        // Incoming danger indicator
        const dangerX = heroX + 30 - cycle * 40;
        ctx.fillStyle = `rgba(255,60,60,${0.5 + Math.sin(t * 0.3) * 0.3})`;
        ctx.fillRect(dangerX, heroY + 4, 8, 8);
        ctx.fillStyle = "#ff3333";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", dangerX + 4, heroY + 2);
      } else if (cycle < 0.7) {
        // Teleport flash
        const tpPhase = (cycle - 0.4) / 0.3;
        // Ghost at old position
        ctx.globalAlpha = 0.3 * (1 - tpPhase);
        drawHero(heroX - 25, heroY, 1, t * 1.2, 1.2);
        ctx.globalAlpha = 1;
        // Teleport trail
        ctx.fillStyle = `rgba(255,204,34,${0.5 * (1 - tpPhase)})`;
        ctx.fillRect(heroX - 25, heroY + 6, 50 * tpPhase, 12);
        // New position
        ctx.globalAlpha = tpPhase;
        drawHero(heroX + 25, heroY, -1, t * 1.2, 1.2);
        ctx.globalAlpha = 1;
        // Flash ring
        ctx.strokeStyle = `rgba(255,204,34,${0.6 * (1 - tpPhase)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(heroX + 25 + 7, heroY + 12, 6 + tpPhase * 10, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Counter-ready pose
        const readyPhase = (cycle - 0.7) / 0.8;
        drawHero(heroX + 25, heroY, -1, t * 0.5, 1.2);
        // Speed aura
        if (readyPhase < 0.5) {
          ctx.fillStyle = `rgba(255,204,34,${0.3 * (1 - readyPhase * 2)})`;
          ctx.beginPath();
          ctx.arc(heroX + 25 + 7, heroY + 12, 8 + readyPhase * 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }

    } else if (key === "style_gunslinger") {
      // Gunslinger demo: charge shot tiers
      const cycle = (t * 0.015) % 3;
      drawHero(heroX - 15, heroY, 1, 0, 1.2);
      if (cycle < 1) {
        // Tier 1: Machinegun rapid bullets
        const phase = cycle;
        for (let i = 0; i < 5; i++) {
          const bp = (phase * 3 + i * 0.2) % 1;
          const bx = heroX + bp * 60;
          ctx.fillStyle = `rgba(255,255,100,${1 - bp})`;
          ctx.fillRect(bx, heroY + 9 + (i % 2) * 2, 3, 1);
        }
        ctx.fillStyle = "#aaddff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("MACHINEGUN", heroX + 25, heroY - 4);
      } else if (cycle < 2) {
        // Tier 2: Shotgun spread
        const phase = (cycle - 1);
        if (phase < 0.3) {
          const sp = phase / 0.3;
          for (let i = -2; i <= 2; i++) {
            const bx = heroX + sp * 50;
            const by = heroY + 10 + i * sp * 6;
            ctx.fillStyle = `rgba(255,250,200,${1 - sp})`;
            ctx.fillRect(bx, by, 4, 2);
          }
        }
        ctx.fillStyle = "#aaddff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("SHOTGUN", heroX + 25, heroY - 4);
      } else {
        // Tier 3: Bazooka
        const phase = (cycle - 2);
        if (phase < 0.5) {
          const bp = phase / 0.5;
          const bx = heroX + bp * 55;
          // Missile body
          ctx.fillStyle = "#888";
          ctx.fillRect(bx, heroY + 8, 6, 4);
          ctx.fillStyle = "#ff4444";
          ctx.fillRect(bx + 5, heroY + 8, 2, 4);
          // Trail
          ctx.fillStyle = `rgba(255,160,60,${0.5 * (1 - bp)})`;
          ctx.fillRect(bx - 4, heroY + 9, 4, 2);
          // Explosion at impact
          if (bp > 0.8) {
            const ex = (bp - 0.8) / 0.2;
            ctx.fillStyle = `rgba(255,200,60,${0.7 * (1 - ex)})`;
            ctx.beginPath();
            ctx.arc(heroX + 55, heroY + 10, 8 + ex * 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.fillStyle = "#aaddff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BAZOOKA", heroX + 25, heroY - 4);
      }

    } else if (key === "style_royalguard") {
      // Royal Guard demo: block + release
      const cycle = (t * 0.02) % 2;
      if (cycle < 0.6) {
        // Incoming attack
        drawHero(heroX, heroY, 1, 0, 1.2);
        const attackX = heroX + 40 - cycle * 30;
        ctx.fillStyle = `rgba(255,60,60,${0.6})`;
        ctx.fillRect(attackX, heroY + 4, 6, 10);
        // Guard text
        ctx.fillStyle = "#22ff88";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GUARD!", heroX + 7, heroY - 6);
      } else if (cycle < 1.0) {
        // Just Guard flash
        const gPhase = (cycle - 0.6) / 0.4;
        drawHero(heroX, heroY, 1, 0, 1.2);
        // Shield flash
        ctx.fillStyle = `rgba(34,255,136,${0.6 * (1 - gPhase)})`;
        ctx.beginPath();
        ctx.arc(heroX + 7, heroY + 12, 10 + gPhase * 8, 0, Math.PI * 2);
        ctx.fill();
        // "JUST!" text
        ctx.fillStyle = `rgba(34,255,136,${1 - gPhase})`;
        ctx.font = "bold 9px monospace";
        ctx.fillText("JUST!", heroX + 7, heroY - 4 - gPhase * 6);
        // Energy gain sparks
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          ctx.fillStyle = `rgba(34,255,136,${0.5 * (1 - gPhase)})`;
          ctx.fillRect(heroX + 7 + Math.cos(a) * 12, heroY + 12 + Math.sin(a) * 12, 2, 2);
        }
      } else {
        // Release attack
        const rPhase = (cycle - 1.0) / 1.0;
        drawHero(heroX, heroY, 1, t * 2, 1.2, 0.4);
        if (rPhase < 0.5) {
          // Energy release wave
          const waveR = rPhase * 40;
          ctx.strokeStyle = `rgba(34,255,136,${0.8 * (1 - rPhase * 2)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(heroX + 14, heroY + 10, waveR, -0.5, 0.5);
          ctx.stroke();
          // Release text
          ctx.fillStyle = `rgba(34,255,136,${1 - rPhase * 2})`;
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("RELEASE!", heroX + 7, heroY - 8);
        }
      }

    } else if (key === "style_intro" || key === "style_try") {
      // Style switching demo: cycle through 4 styles
      const styleCycle = (t * 0.02) % 4;
      const styleIdx = Math.floor(styleCycle);
      const styleColors = ["#ff6644", "#ffcc22", "#22aaff", "#22ff88"];
      const styleNames = ["SWORD", "TRICK", "GUN", "GUARD"];
      const currentColor = styleColors[styleIdx];
      drawHero(heroX, heroY, 1, t * 0.8, 1.2);
      // Style aura
      const pulse = Math.sin(t * 0.15) * 0.2 + 0.5;
      ctx.fillStyle = currentColor;
      ctx.globalAlpha = pulse * 0.3;
      ctx.beginPath();
      ctx.arc(heroX + 7, heroY + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Style name
      ctx.fillStyle = currentColor;
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(styleNames[styleIdx], heroX + 7, heroY - 6);
      // Style dots
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === styleIdx ? styleColors[i] : "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.arc(heroX - 8 + i * 10, heroY + 30, i === styleIdx ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (key === "rank_intro" || key === "rank_tiers") {
      // Rank demo: rising rank with visual effects
      const rankColors = ["#6688ff", "#44dddd", "#44ff44", "#ffaa22", "#ff6622", "#ff4488", "#ffd700"];
      const rankNames = ["D", "B", "A", "S", "SS", "SSS", "EX"];
      const rankCycle = (t * 0.012) % 7;
      const rankIdx = Math.min(6, Math.floor(rankCycle));
      drawHero(heroX, heroY, 1, t * (1 + rankIdx * 0.3), 1.2, rankIdx > 3 ? 0.2 : 0);
      // Rank aura (grows with rank)
      const auraSize = 6 + rankIdx * 3;
      ctx.fillStyle = rankColors[rankIdx];
      ctx.globalAlpha = 0.2 + rankIdx * 0.05;
      ctx.beginPath();
      ctx.arc(heroX + 7, heroY + 12, auraSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Rank badge
      ctx.fillStyle = rankColors[rankIdx];
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(rankNames[rankIdx], heroX + 7, heroY - 6);
      // Sparks at high ranks
      if (rankIdx >= 4) {
        for (let i = 0; i < rankIdx - 2; i++) {
          const angle = t * 0.1 + i * 1.3;
          const r = auraSize + 2;
          ctx.fillStyle = `rgba(255,255,200,${0.5 + Math.sin(t * 0.2 + i) * 0.3})`;
          ctx.fillRect(heroX + 7 + Math.cos(angle) * r, heroY + 12 + Math.sin(angle) * r, 2, 1);
        }
      }

    } else if (key === "blackflash") {
      // Black Flash demo
      const cycle = (t * 0.025) % 1.5;
      drawHero(heroX, heroY, 1, t * 1.5, 1.2, cycle > 0.3 && cycle < 0.5 ? 0.4 : 0);
      if (cycle > 0.3 && cycle < 0.8) {
        const bfPhase = (cycle - 0.3) / 0.5;
        // Dark flash
        ctx.fillStyle = `rgba(0,0,0,${0.6 * (1 - bfPhase)})`;
        ctx.fillRect(demoX - 50, demoY - 10, 100, 50);
        // Black lightning
        ctx.strokeStyle = `rgba(80,0,120,${0.8 * (1 - bfPhase)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(heroX + 14, heroY + 4);
        ctx.lineTo(heroX + 22 + bfPhase * 8, heroY + 2 - bfPhase * 4);
        ctx.lineTo(heroX + 18 + bfPhase * 12, heroY + 8);
        ctx.lineTo(heroX + 28 + bfPhase * 10, heroY + 4 - bfPhase * 2);
        ctx.stroke();
        // Impact flash
        ctx.fillStyle = `rgba(120,0,200,${0.5 * (1 - bfPhase)})`;
        ctx.beginPath();
        ctx.arc(heroX + 20, heroY + 8, 6 + bfPhase * 10, 0, Math.PI * 2);
        ctx.fill();
        // "BLACK FLASH" text
        if (bfPhase < 0.5) {
          ctx.fillStyle = `rgba(180,120,255,${1 - bfPhase * 2})`;
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("BLACK FLASH!", heroX + 7, heroY - 8 - bfPhase * 6);
        }
      }

    } else if (key === "burst_intro" || key === "burst_types") {
      // Burst/DT demo
      const cycle = (t * 0.018) % 2;
      if (cycle < 1) {
        // DT activation
        const dtPhase = cycle;
        drawHero(heroX, heroY, 1, t * 1.5, 1.2);
        // Power aura
        const auraAlpha = Math.min(1, dtPhase * 2) * 0.4;
        const auraSize = 8 + dtPhase * 14;
        const dtColor = key === "burst_types" ? "rgba(255,100,68," : "rgba(200,120,255,";
        ctx.fillStyle = dtColor + auraAlpha + ")";
        ctx.beginPath();
        ctx.arc(heroX + 7, heroY + 12, auraSize, 0, Math.PI * 2);
        ctx.fill();
        // Rising particles
        for (let i = 0; i < 5; i++) {
          const py2 = heroY + 24 - (dtPhase * 30 + i * 6) % 30;
          const px2 = heroX + 2 + (i * 3) + Math.sin(t * 0.1 + i) * 3;
          ctx.fillStyle = key === "burst_types" ? `rgba(255,150,80,${0.6})` : `rgba(200,150,255,${0.6})`;
          ctx.fillRect(px2, py2, 1, 2);
        }
        // DT text
        if (dtPhase > 0.3 && dtPhase < 0.7) {
          ctx.fillStyle = key === "burst_types" ? "#ff6644" : "#cc88ff";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("DEVIL TRIGGER!", heroX + 7, heroY - 8);
        }
      } else {
        // Burst laser
        const laserPhase = cycle - 1;
        drawHero(heroX, heroY - 4, 1, t * 0.5, 1.2);
        if (laserPhase > 0.2 && laserPhase < 0.8) {
          const lp = (laserPhase - 0.2) / 0.6;
          // Laser beam
          const beamW = 4 + Math.sin(t * 0.3) * 2;
          ctx.fillStyle = `rgba(255,220,100,${0.7 * (1 - Math.abs(lp - 0.5) * 2)})`;
          ctx.fillRect(heroX + 7 - beamW / 2, heroY - 4 - 30, beamW, 30);
          ctx.fillStyle = `rgba(255,255,200,${0.5 * (1 - Math.abs(lp - 0.5) * 2)})`;
          ctx.fillRect(heroX + 7 - 1, heroY - 4 - 30, 2, 30);
          // Laser text
          ctx.fillStyle = "#ffdd44";
          ctx.font = "bold 7px monospace";
          ctx.textAlign = "center";
          ctx.fillText("BURST!", heroX + 7, heroY - 36);
        }
      }

    } else if (key === "emergency") {
      // Emergency dodge + bike demo
      const cycle = (t * 0.015) % 2;
      if (cycle < 1) {
        // Emergency dodge
        const phase = cycle;
        if (phase < 0.3) {
          drawHero(heroX, heroY, 1, t * 0.5, 1.2);
          // Danger flash
          ctx.fillStyle = `rgba(255,0,0,${0.3 * Math.sin(t * 0.3)})`;
          ctx.fillRect(demoX - 50, demoY - 10, 100, 50);
          ctx.fillStyle = "#ff4444";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("DANGER!", heroX + 7, heroY - 8);
        } else if (phase < 0.6) {
          // Slow-mo dodge
          const dp = (phase - 0.3) / 0.3;
          ctx.globalAlpha = 0.3;
          drawHero(heroX, heroY, 1, t * 0.1, 1.2);
          ctx.globalAlpha = 1;
          drawHero(heroX + dp * 30, heroY, 1, t * 0.1, 1.2);
          // Time slow effect
          ctx.fillStyle = `rgba(0,100,200,${0.2 * (1 - dp)})`;
          ctx.fillRect(demoX - 50, demoY - 10, 100, 50);
        } else {
          // Counter attack
          const cp = (phase - 0.6) / 0.4;
          drawHero(heroX + 30, heroY, -1, t * 2, 1.2, cp < 0.5 ? cp : 0);
          if (cp < 0.4) {
            ctx.fillStyle = `rgba(0,255,255,${0.6 * (1 - cp * 2.5)})`;
            ctx.font = "bold 7px monospace";
            ctx.textAlign = "center";
            ctx.fillText("COUNTER x2.0!", heroX + 37, heroY - 6);
          }
        }
      } else {
        // Bike invincibility
        const bPhase = cycle - 1;
        const bikeX = heroX - 15 + Math.sin(bPhase * Math.PI * 2) * 5;
        // Simple bike representation
        ctx.fillStyle = "#ff6688";
        ctx.fillRect(bikeX, heroY + 14, 18, 8);
        ctx.fillStyle = "#cc4466";
        ctx.fillRect(bikeX + 14, heroY + 12, 6, 6);
        // Wheels
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(bikeX + 3, heroY + 24, 3, 0, Math.PI * 2);
        ctx.arc(bikeX + 15, heroY + 24, 3, 0, Math.PI * 2);
        ctx.fill();
        // Rider
        drawHero(bikeX + 2, heroY + 2, 1, t * 2, 1.0);
        // Rainbow trail
        const trailColors = ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = trailColors[i];
          ctx.globalAlpha = 0.4;
          ctx.fillRect(bikeX - 4 - i * 3, heroY + 16 + i, 3, 2);
        }
        ctx.globalAlpha = 1;
        // Invincible text
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("INVINCIBLE!", heroX + 7, heroY - 4);
      }

    } else if (key === "ready") {
      // Already handled by autoAdvance section
    }

    ctx.restore();
  }

  function drawTutorial() {
    // Draw the game background for visual context
    const savedCamera = cameraX;
    cameraX = Math.floor((Math.sin(tutorialTimer * 0.012) * 0.5 + 0.5) * 80);
    drawSkyGradient();
    drawParallax();
    cameraX = savedCamera;

    // Softer overlay so stage remains visible behind the character
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, H);
    overlayGrad.addColorStop(0, "rgba(6, 8, 14, 0.72)");
    overlayGrad.addColorStop(0.55, "rgba(12, 14, 28, 0.52)");
    overlayGrad.addColorStop(1, "rgba(20, 10, 34, 0.78)");
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, W, H);

    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step) return;

    const phaseInfo = getTutorialPhaseInfo(step.phase);

    // Phase label (top left) with a soft glow bar
    ctx.textAlign = "left";
    ctx.fillStyle = phaseInfo.color;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(4, 4, 60, 12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = phaseInfo.color;
    ctx.font = "bold 8px monospace";
    ctx.fillText(phaseInfo.label, 8, 12);

    // Step counter (top right)
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "8px monospace";
    ctx.fillText(`${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`, W - 8, 12);

    // Progress bar at top
    const progressRatio = tutorialStep / TUTORIAL_STEPS.length;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, 0, W, 2);
    ctx.fillStyle = phaseInfo.color;
    ctx.fillRect(0, 0, W * progressRatio, 2);
    // Subtle scanline shimmer above progress bar
    ctx.fillStyle = `rgba(255,255,255,${0.18 + Math.sin(tutorialTimer * 0.2) * 0.08})`;
    ctx.fillRect(Math.max(0, W * progressRatio - 2), 0, 2, 2);

    // Content area - different layouts for info vs interactive steps
    ctx.textAlign = "center";

    if (step.info) {
      // --- Info step layout ---
      // Title with optional color accent
      const titleColor = step.color || "#ffe7b0";
      ctx.fillStyle = titleColor;
      ctx.font = "bold 13px monospace";
      ctx.fillText(step.titleJa, W / 2, 30);

      // Underline
      const titleW = ctx.measureText(step.titleJa).width;
      ctx.fillStyle = titleColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(W / 2 - titleW / 2, 33, titleW, 1);
      ctx.globalAlpha = 1;

      // Description lines
      const descLines = step.descJa;
      const lineH = 13;
      let descStartY = 48;
      ctx.font = "9px monospace";
      for (let i = 0; i < descLines.length; i++) {
        ctx.fillStyle = i === 0 ? "#f0ebd9" : "#c8c0b0";
        ctx.fillText(descLines[i], W / 2, descStartY + i * lineH);
      }

      // Sub-info table (for rank tiers, burst types etc.)
      if (step.subInfo) {
        const tableY = descStartY + descLines.length * lineH + 6;
        const rowH = 12;
        const tableW = 220;
        const tableX = (W - tableW) / 2;

        // Table background
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(tableX - 4, tableY - 4, tableW + 8, step.subInfo.length * rowH + 8);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.strokeRect(tableX - 4, tableY - 4, tableW + 8, step.subInfo.length * rowH + 8);

        ctx.font = "8px monospace";
        for (let i = 0; i < step.subInfo.length; i++) {
          const item = step.subInfo[i];
          const y = tableY + i * rowH + 8;

          // Label
          ctx.textAlign = "left";
          ctx.fillStyle = item.color;
          ctx.fillText(item.label, tableX + 2, y);

          // Description
          ctx.fillStyle = "#c8c0b0";
          ctx.fillText(item.desc, tableX + 82, y);
        }
        ctx.textAlign = "center";
      }

      // Demo animation for info steps
      const demoYInfo = step.subInfo ? (descStartY + descLines.length * lineH + 6 + step.subInfo.length * 12 + 14) : (descStartY + descLines.length * lineH + 10);
      if (demoYInfo + 30 < H - 18) {
        drawTutorialDemo(step, tutorialTimer, W / 2, demoYInfo);
      }

      // "Press any key to continue" prompt
      const promptBlink = Math.floor(tutorialTimer / 20) % 2 === 0;
      if (promptBlink) {
        ctx.fillStyle = "rgba(255,231,176,0.7)";
        ctx.font = "8px monospace";
        const nextLabel = isTouchDevice ? "タップで次へ" : "何かキーで次へ";
        ctx.fillText(nextLabel, W / 2, H - 16);
      }

    } else if (step.autoAdvance) {
      // --- Auto-advance step (ready screen) ---
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 16px monospace";
      ctx.fillText(step.titleJa, W / 2, 50);

      const descLines = step.descJa;
      ctx.font = "10px monospace";
      for (let i = 0; i < descLines.length; i++) {
        ctx.fillStyle = i === 0 ? "#f0ebd9" : "#c8c0b0";
        ctx.fillText(descLines[i], W / 2, 70 + i * 14);
      }

      // Draw hero larger for the ready screen
      const heroBob = Math.sin(tutorialTimer * 0.12) * 1.5;
      drawHero(W / 2 - 12, 100 + heroBob, 1, tutorialTimer * 1.2, 1.6);

    } else {
      // --- Interactive step layout ---
      // Title
      ctx.fillStyle = "#ffe7b0";
      ctx.font = "bold 14px monospace";
      ctx.fillText(step.titleJa, W / 2, 28);

      // Description lines
      const descLines = step.descJa;
      ctx.font = "9px monospace";
      for (let i = 0; i < descLines.length; i++) {
        ctx.fillStyle = i === 0 ? "#f0ebd9" : "#c8c0b0";
        ctx.fillText(descLines[i], W / 2, 42 + i * 11);
      }

      const interactY = 42 + descLines.length * 11 + 4;

      // Progress bar (for hold-type steps)
      if (step.requiredFrames && tutorialStepProgress > 0) {
        const barW = 100;
        const barH = 6;
        const barX = (W - barW) / 2;
        const barY = interactY;
        const ratio = Math.min(1, tutorialStepProgress / step.requiredFrames);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = phaseInfo.color;
        ctx.fillRect(barX, barY, barW * ratio, barH);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.strokeRect(barX, barY, barW, barH);
      }

      // Count indicator (for multi-press steps) - bigger, centered
      if (step.requiredCount) {
        const countPulse = tutorialSuccessPulse > 0 ? 1 + tutorialSuccessPulse / 28 : 1;
        ctx.save();
        ctx.translate(W / 2, interactY + 4);
        ctx.scale(countPulse, countPulse);
        ctx.fillStyle = tutorialSuccessPulse > 0 ? "#fff0a0" : "#aaddff";
        ctx.font = "bold 11px monospace";
        ctx.fillText(`${tutorialStepCount} / ${step.requiredCount}`, 0, 0);
        ctx.restore();
      }

      // Key hint (bobs slightly) - placed above the stage area
      const hintBaseY = interactY + (step.requiredCount ? 14 : 14);
      const hintY = hintBaseY + Math.sin(tutorialTimer * 0.15) * 1.5;
      if (isTouchDevice) {
        ctx.fillStyle = "rgba(255,224,207,0.78)";
        ctx.font = "9px monospace";
        ctx.fillText("画面下のボタンで操作", W / 2, hintY);
      } else {
        const keyHints = {
          move: "[ A ]  [ D ]",
          jump: "[ W / Space ]",
          attack: "[ J ]",
          shoot: "[ K ]",
          dash: "[ L ]",
          style_try: "[ V ]",
        };
        ctx.fillStyle = "#aaddff";
        ctx.font = "bold 11px monospace";
        ctx.fillText(keyHints[step.key] || "", W / 2, hintY);
      }

      // Dedicated demo stage area at the bottom
      drawTutorialStage(step, tutorialTimer, W / 2, H - 24);
    }

    // Skip hint (always visible)
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "7px monospace";
    const skipLabel = isTouchDevice ? "SKIP長押しでスキップ" : "Enter長押しでスキップ";
    ctx.fillText(skipLabel, W - 6, H - 5);

    // Skip progress bar
    if (tutorialSkipHold > 0) {
      const skipRatio = Math.min(1, tutorialSkipHold / TUTORIAL_SKIP_HOLD_TIME);
      const skipBarW = 50;
      const skipBarH = 2;
      const skipBarX = W - 6 - skipBarW;
      const skipBarY = H - 2;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(skipBarX, skipBarY, skipBarW, skipBarH);
      ctx.fillStyle = "#ff6f8c";
      ctx.fillRect(skipBarX, skipBarY, skipBarW * skipRatio, skipBarH);
    }

    // Fade out effect
    if (tutorialFadeOut > 0) {
      const alpha = 1 - (tutorialFadeOut / 20);
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.textAlign = "left";
  }

  function updateCutscene(dt, actions) {
    cameraX = 0;
    cutsceneTime += dt;
    startOpeningTheme();

    if (actions.startPressed || actions.jumpPressed) {
      startGameplay(true);
      return;
    }

    if (cutsceneTime > OPENING_CUTSCENE_DURATION) {
      startGameplay(true);
    }
  }

  function stageIntroDuration() {
    return currentStageNumber >= 3
      ? STAGE_INTRO_CUTSCENE_DURATION + 70
      : STAGE_INTRO_CUTSCENE_DURATION;
  }

  function beginStageIntroCutscene() {
    stageIntroTimer = 0;
    gameState = STATE.STAGE_INTRO;
    cameraX = 0;
    startOpeningTheme();
  }

  function finishStageIntroCutscene() {
    stageIntroTimer = 0;
    gameState = STATE.PLAY;
    stopInvincibleMusic();
    startStageMusic(true);
    setBgmVolume(0, 0);
    setBgmVolume(BGM_NORMAL_VOL, 0.08);
    hudMessage = stageStartMessage();
    hudTimer = Math.max(hudTimer, currentStageNumber >= 3 ? 168 : 150);
  }

  function updateStageIntroCutscene(dt, actions) {
    cameraX = 0;
    stageIntroTimer += dt;
    player.anim += dt * 0.72;
    startOpeningTheme();

    if (actions.startPressed || actions.jumpPressed || actions.attackPressed || actions.attack2Pressed) {
      finishStageIntroCutscene();
      return;
    }

    if (stageIntroTimer > stageIntroDuration()) {
      finishStageIntroCutscene();
    }
  }

  function updatePreBossCutscene(dt, actions) {
    const peacockBoss = stage.boss && (stage.boss.kind === "peacock" || stage.boss.kind === "peacockman");
    const movieDuration = peacockBoss ? 420 : PRE_BOSS_CUTSCENE_DURATION;
    if (actions.startPressed || actions.jumpPressed) {
      startBossBattle();
      return;
    }

    if (preBossCutsceneTimer < 0) {
      const targetX = stage.goal.x + 4;
      player.facing = 1;
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      player.x = Math.min(targetX, player.x + 0.94 * dt);
      player.anim += dt * 0.7;
      cameraX = clamp(stage.goal.x + stage.goal.w * 0.5 - W * 0.56, 0, stage.width - W);
      preBossCutsceneTimer += dt;
      if (preBossCutsceneTimer >= 0) {
        preBossCutsceneTimer = 0;
        startOpeningTheme();
      }
      return;
    }

    preBossCutsceneTimer += dt;
    startOpeningTheme();
    if (preBossCutsceneTimer > movieDuration) {
      startBossBattle();
    }
  }

  function returnToTitle() {
    deadReason = "";
    currentStageNumber = 1;
    collectedProteinIds = new Set();
    collectedLifeUpIds = new Set();
    stage = buildStage();
    const cp = stage.checkpoints[0];
    player = createPlayer(cp.x, cp.y);
    BOSS_ARENA = stage.bossArena ? { ...stage.bossArena } : BOSS_ARENA;
    titleTimer = 0;
    deathPauseTimer = 0;
    deathAnimActive = false;
    deathJumpVy = 0;
    deadTimer = 0;
    deadTimerMax = 0;
    cutsceneTime = 0;
    stageIntroTimer = 0;
    preBossCutsceneTimer = 0;
    godPhaseCutsceneTimer = 0;
    deathContinueMode = "checkpoint";
    cameraX = 0;
    attackCooldown = 0;
    attackChargeTimer = 0;
    attackChargeReadyPlayed = false;
    attack2ChargeTimer = 0;
    attack2ChargeReadyPlayed = false;
    attackMashCount = 0;
    attackMashTimer = 0;
    hyakuretsuTimer = 0;
    hyakuretsuHitTimer = 0;
    hyakuretsuAutoTimer = 0;
    attackEffectTimer = 0;
    attackEffectMode = "none";
    attackEffectPhase = 0;
    attackEffectPower = 0;
    resetBlackFlashState();
    resetBattleRank();
    stompChainGuardTimer = 0;
    proteinBurstGauge1 = 0;
    proteinBurstGauge2 = 0;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    stage.playerWaves = [];
    stage.hammerShards = [];
    stage.burstMeteors = [];
    waveFlashTimer = 0;
    waveFlashPower = 0;
    waveBursts = [];
    invincibleBonusPops = [];
    stopInvincibleMusic();
    stopBossMusic(true);
    stopStageMusic(true);
    gameState = STATE.TITLE;
    startOpeningTheme();
  }

  function startNextStage() {
    if (currentStageNumber >= FINAL_STAGE_NUMBER) {
      returnToTitle();
      return;
    }
    currentStageNumber += 1;
    cutsceneTime = 0;
    stageIntroTimer = 0;
    preBossCutsceneTimer = 0;
    godPhaseCutsceneTimer = 0;
    deadReason = "";
    proteinBurstGauge1 = 0;
    proteinBurstGauge2 = 0;
    proteinBurstTimer = 0;
    proteinBurstBlastDone = false;
    proteinBurstLaserTimer = 0;
    proteinBurstLaserPhase = 0;
    proteinBurstUsedGauge = 0;
    proteinBurstPower = 1;
    proteinBurstMode = PROTEIN_BURST_MODE_LASER;
    resetTimeBurstState();
    stopInvincibleMusic();
    stopBossMusic(true);
    stopStageMusic(true);
    startGameplay(false, { keepLives: true, keepDeaths: true, keepBlackFlash: true });
    beginStageIntroCutscene();
  }

  function updateDead(dt, actions) {
    deadTimer = Math.max(0, deadTimer - dt);
    deathFlashTimer = Math.max(0, deathFlashTimer - dt);
    deathShakeTimer = Math.max(0, deathShakeTimer - dt);

    const wantsFastContinue = actions.startPressed || actions.jumpPressed;
    if (wantsFastContinue && deathPauseTimer <= 0 && deadTimer > 0) {
      deadTimer = Math.min(deadTimer, 14);
    }

    if (deathPauseTimer > 0) {
      deathPauseTimer = Math.max(0, deathPauseTimer - dt);
      if (deathPauseTimer <= 0 && !deathAnimActive) {
        deathAnimActive = true;
        deathJumpVy = -5.6;
      }
    }

    if (deathAnimActive) {
      player.y += deathJumpVy * dt;
      deathJumpVy = Math.min(MAX_FALL + 2.2, deathJumpVy + GRAVITY * 1.08 * dt);
      player.anim += dt * 0.45;
    }

    if (deadTimer > 0) {
      return;
    }

    if (playerLives > 0) {
      if (deathContinueMode === "boss") {
        respawnFromBossBattle();
      } else {
        respawnFromCheckpoint();
      }
    } else {
      returnToTitle();
    }
  }

  function updateClear(dt, actions) {
    clearTimer += dt;
    if (hudTimer > 0) hudTimer -= dt;
    if (invincibleTimer > 0) {
      invincibleTimer = Math.max(0, invincibleTimer - dt);
      if (invincibleTimer <= 0) endInvincibleMode();
    }

    const finalStage = currentStageNumber >= FINAL_STAGE_NUMBER;
    if (!finalStage) {
      if (clearTimer > 150 && (actions.startPressed || actions.jumpPressed || actions.attackPressed || actions.attack2Pressed)) {
        startNextStage();
        return;
      }
      if (clearTimer > 280) {
        startNextStage();
      }
      return;
    }

    if (clearTimer > 180 && (actions.startPressed || actions.jumpPressed || actions.attackPressed || actions.attack2Pressed)) {
      returnToTitle();
    }
  }

  function update(dt, actions) {
    updateStageMusicFade(dt);

    if (gameState === STATE.TITLE) {
      updateTitle(dt, actions);
      return;
    }

    if (gameState === STATE.TUTORIAL) {
      updateTutorial(dt, actions);
      return;
    }

    if (gameState === STATE.CUTSCENE) {
      updateCutscene(dt, actions);
      return;
    }

    if (gameState === STATE.STAGE_INTRO) {
      updateStageIntroCutscene(dt, actions);
      return;
    }

    if (gameState === STATE.PRE_BOSS) {
      updatePreBossCutscene(dt, actions);
      return;
    }

    if (gameState === STATE.GOD_PHASE_CUTSCENE) {
      updateGodSecondFormCutscene(dt, actions);
      return;
    }

    if (gameState === STATE.PLAY) {
      updatePlay(dt, actions);
      return;
    }

    if (gameState === STATE.BOSS) {
      updateBossBattle(dt, actions);
      return;
    }

    if (gameState === STATE.DEAD) {
      updateDead(dt, actions);
      return;
    }

    if (gameState === STATE.CLEAR) {
      updateClear(dt, actions);
    }
  }

  function drawSkyGradient() {
    const stageId = stage && Number.isFinite(stage.id) ? stage.id : 1;
    const deluxeCity = stage && stage.theme === "city_deluxe";
    const stage2City = deluxeCity && stageId === 2;
    const stage3City = deluxeCity && stageId >= 3;
    if (deluxeCity) {
      const skyTop = stage3City ? "#03040d" : stage2City ? "#020813" : "#02040a";
      const skyMidA = stage3City ? "#1b1336" : stage2City ? "#10243f" : "#0d1630";
      const skyMidB = stage3City ? "#352661" : stage2City ? "#155678" : "#1c3560";
      const skyMidC = stage3City ? "#58457d" : stage2City ? "#2f6f96" : "#2f5a87";
      const skyBottom = stage3City ? "#8164a1" : stage2City ? "#5c9fbc" : "#4f7aa3";
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, skyTop);
      g.addColorStop(0.25, skyMidA);
      g.addColorStop(0.52, skyMidB);
      g.addColorStop(0.78, skyMidC);
      g.addColorStop(1, skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const moonX = stage3City ? 238 : stage2City ? 266 : 250;
      const moonGlow = ctx.createRadialGradient(moonX, 24, 2, moonX, 24, 34);
      moonGlow.addColorStop(0, stage3City ? "rgba(255,228,244,0.98)" : stage2City ? "rgba(222,255,248,0.98)" : "rgba(255,240,206,0.98)");
      moonGlow.addColorStop(0.2, stage3City ? "rgba(232,188,255,0.58)" : stage2City ? "rgba(172,241,255,0.58)" : "rgba(255,223,166,0.62)");
      moonGlow.addColorStop(0.5, stage3City ? "rgba(173,126,228,0.24)" : stage2City ? "rgba(102,196,228,0.22)" : "rgba(255,168,133,0.24)");
      moonGlow.addColorStop(1, stage3City ? "rgba(176,140,255,0)" : stage2City ? "rgba(120,218,244,0)" : "rgba(255,210,150,0)");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(210, 0, 86, 76);

      const skylineGlow = ctx.createLinearGradient(0, 58, 0, 146);
      skylineGlow.addColorStop(0, "rgba(255, 142, 176, 0)");
      skylineGlow.addColorStop(
        0.42,
        stage3City ? "rgba(205, 146, 255, 0.13)" : stage2City ? "rgba(124, 255, 232, 0.11)" : "rgba(255, 142, 176, 0.12)"
      );
      skylineGlow.addColorStop(
        1,
        stage3City ? "rgba(169, 162, 255, 0.2)" : stage2City ? "rgba(116, 237, 255, 0.22)" : "rgba(126, 219, 255, 0.2)"
      );
      ctx.fillStyle = skylineGlow;
      ctx.fillRect(0, 58, W, 92);

      ctx.fillStyle = stage3City ? "rgba(224, 136, 255, 0.08)" : stage2City ? "rgba(112, 255, 224, 0.08)" : "rgba(255, 126, 177, 0.08)";
      ctx.fillRect(0, 70, W, 20);
      ctx.fillStyle = stage3City ? "rgba(154, 194, 255, 0.12)" : stage2City ? "rgba(102, 232, 255, 0.12)" : "rgba(120, 214, 255, 0.12)";
      ctx.fillRect(0, 88, W, 26);

      const cloudShift = -Math.floor(cameraX * 0.05 + player.anim * 0.45) % (W + 72);
      for (let i = -1; i < 6; i += 1) {
        const cx = i * 72 + cloudShift;
        const cy = 42 + ((i * 11) % 16);
        ctx.fillStyle = stage3City ? "rgba(202, 196, 255, 0.07)" : stage2City ? "rgba(156, 228, 255, 0.08)" : "rgba(188, 218, 255, 0.07)";
        ctx.fillRect(cx, cy, 38, 3);
        ctx.fillStyle = stage3City ? "rgba(255, 188, 235, 0.05)" : stage2City ? "rgba(186, 255, 231, 0.045)" : "rgba(255, 196, 214, 0.05)";
        ctx.fillRect(cx + 8, cy + 3, 24, 2);
      }

      if (stage3City) {
        const aurora = ctx.createLinearGradient(0, 30, 0, 92);
        aurora.addColorStop(0, "rgba(208, 148, 255, 0)");
        aurora.addColorStop(0.44, "rgba(208, 148, 255, 0.08)");
        aurora.addColorStop(1, "rgba(122, 188, 255, 0)");
        ctx.fillStyle = aurora;
        ctx.fillRect(0, 30, W, 62);
      }

      const twinkleSeed = Math.floor(player.anim * 0.7);
      const twinkleCount = stage3City ? 54 : stage2City ? 42 : 46;
      const twinkleParallax = stage3City ? 0.11 : stage2City ? 0.08 : 0.09;
      const twinkleColor = stage3City ? "#ffe8ff" : stage2City ? "#e6feff" : "#f8fbff";
      const twinkleDim = stage3City ? "rgba(218,200,255,0.74)" : stage2City ? "rgba(180,236,255,0.74)" : "rgba(188,213,255,0.76)";
      for (let i = 0; i < twinkleCount; i += 1) {
        const sx = ((i * 23 + Math.floor(cameraX * twinkleParallax)) % (W + 16)) - 8;
        const sy = 4 + ((i * 19) % 58);
        const blink = (twinkleSeed + i * 2) % 16 < 4;
        ctx.fillStyle = blink ? twinkleColor : twinkleDim;
        ctx.fillRect(Math.floor(sx), sy, 1, 1);
        if (blink && i % 6 === 0) {
          ctx.fillRect(Math.floor(sx) - 1, sy, 1, 1);
          ctx.fillRect(Math.floor(sx) + 1, sy, 1, 1);
        }
      }
      return;
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#04060d");
    g.addColorStop(0.35, "#0f1a34");
    g.addColorStop(0.7, "#29446a");
    g.addColorStop(1, "#4d6d93");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const moonGlow = ctx.createRadialGradient(258, 24, 2, 258, 24, 26);
    moonGlow.addColorStop(0, "rgba(255,236,196,0.95)");
    moonGlow.addColorStop(0.25, "rgba(255,220,162,0.52)");
    moonGlow.addColorStop(1, "rgba(255,210,150,0)");
    ctx.fillStyle = moonGlow;
    ctx.fillRect(230, 0, 56, 56);

    ctx.fillStyle = "#ffdca8";
    ctx.fillRect(255, 21, 6, 6);
    ctx.fillStyle = "#fff2dd";
    ctx.fillRect(257, 23, 2, 2);

    ctx.fillStyle = "rgba(184, 214, 255, 0.1)";
    ctx.fillRect(0, 82, W, 18);

    const haze = ctx.createLinearGradient(0, 62, 0, 146);
    haze.addColorStop(0, "rgba(255, 142, 172, 0)");
    haze.addColorStop(0.36, "rgba(255, 142, 172, 0.08)");
    haze.addColorStop(1, "rgba(142, 210, 255, 0.14)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 62, W, 84);

    const cloudShift = -Math.floor(cameraX * 0.045 + player.anim * 0.38) % (W + 68);
    for (let i = -1; i < 5; i += 1) {
      const cx = i * 68 + cloudShift;
      const cy = 46 + ((i * 7) % 14);
      ctx.fillStyle = "rgba(190, 220, 255, 0.06)";
      ctx.fillRect(cx, cy, 34, 3);
      ctx.fillStyle = "rgba(245, 190, 204, 0.045)";
      ctx.fillRect(cx + 7, cy + 3, 20, 1);
    }

    const twinkleSeed = Math.floor(player.anim * 0.6);
    for (let i = 0; i < 30; i += 1) {
      const sx = ((i * 29 + Math.floor(cameraX * 0.08)) % (W + 14)) - 7;
      const sy = 6 + ((i * 17) % 48);
      const blink = (twinkleSeed + i * 3) % 14 < 3;
      ctx.fillStyle = blink ? "#f6f9ff" : "rgba(210,225,255,0.75)";
      ctx.fillRect(Math.floor(sx), sy, 1, 1);
      if (blink && i % 5 === 0) {
        ctx.fillRect(Math.floor(sx) - 1, sy, 1, 1);
      }
    }
  }

  function drawParallax() {
    const stageId = stage && Number.isFinite(stage.id) ? stage.id : 1;
    const deluxeCity = stage && stage.theme === "city_deluxe";
    const stage2City = deluxeCity && stageId === 2;
    const stage3City = deluxeCity && stageId >= 3;
    if (deluxeCity) {
      const farBody = stage3City ? "#1f183a" : stage2City ? "#123347" : "#14213a";
      const farBodyHi = stage3City ? "#31275a" : stage2City ? "#1c4d67" : "#203459";
      const farEdge = stage3City ? "#0f0d22" : stage2City ? "#0b2230" : "#0a1224";
      const farWinLit = stage3City ? "#eaa9ff" : stage2City ? "#93f2ff" : "#8ce8ff";
      const farWinDim = stage3City ? "#3a4b7b" : stage2City ? "#33607a" : "#2b456a";
      const farWinWarm = stage3City ? "#ffd4c2" : stage2City ? "#ffe0a6" : "#ffd8a2";
      const farWinCool = stage3City ? "#2d375f" : stage2City ? "#274c66" : "#253e5f";
      const farRoof = stage3City ? "#65509b" : stage2City ? "#3e7ca2" : "#35608f";
      const farRoofNeon = stage3City ? "#ff73d8" : stage2City ? "#4ff6db" : "#ff62ab";

      const midBody = stage3City ? "#2a2250" : stage2City ? "#1d425e" : "#1f3254";
      const midTop = stage3City ? "#4a3a7e" : stage2City ? "#32779a" : "#33567f";
      const midEdge = stage3City ? "#1a1735" : stage2City ? "#13374d" : "#142844";
      const midWinA = stage3City ? "#f3b9ff" : stage2City ? "#87f6ff" : "#7ceeff";
      const midWinB = stage3City ? "#425f97" : stage2City ? "#366b8d" : "#31557f";
      const midWinWarm = stage3City ? "#ffc9d4" : stage2City ? "#ffd396" : "#ffcb83";
      const midWinCool = stage3City ? "#364c77" : stage2City ? "#315975" : "#2d4b72";
      const midBand = stage3City ? "rgba(205, 154, 255, 0.16)" : stage2City ? "rgba(120, 245, 230, 0.16)" : "rgba(121, 237, 255, 0.16)";

      const cityGlowA = stage3City ? "rgba(192, 160, 246, 0.16)" : stage2City ? "rgba(122, 206, 238, 0.18)" : "rgba(145, 188, 235, 0.16)";
      const cityGlowB = stage3City ? "rgba(246, 134, 225, 0.1)" : stage2City ? "rgba(116, 255, 220, 0.1)" : "rgba(255, 132, 186, 0.1)";
      const railBase = stage3City ? "#231e34" : stage2City ? "#182b34" : "#1d2431";
      const railPost = stage3City ? "#433f60" : stage2City ? "#37515d" : "#2f394b";
      const railHi = stage3City ? "#756f96" : stage2City ? "#77a7b6" : "#566076";
      const signBody = stage3City ? "#241f3b" : stage2City ? "#163240" : "#1a2538";
      const signBodyHi = stage3City ? "#3d325d" : stage2City ? "#265667" : "#2b3b59";
      const signNeonA = stage3City ? "rgba(202, 156, 255, 0.54)" : stage2City ? "rgba(128, 255, 235, 0.52)" : "rgba(132, 240, 255, 0.52)";
      const signNeonB = stage3City ? "rgba(255, 130, 205, 0.52)" : stage2City ? "rgba(255, 214, 142, 0.46)" : "rgba(255, 152, 198, 0.5)";
      const signTextOn = stage3City ? "#ffe0ff" : stage2City ? "#eafff5" : "#fff0b8";
      const signTextOff = stage3City ? "#b8a8d8" : stage2City ? "#9cc8c7" : "#9db0cf";
      const trafficA = stage3City ? "rgba(255, 150, 228, 0.24)" : stage2City ? "rgba(255, 176, 118, 0.23)" : "rgba(255, 134, 94, 0.24)";
      const trafficB = stage3City ? "rgba(152, 198, 255, 0.21)" : stage2City ? "rgba(114, 242, 255, 0.21)" : "rgba(124, 228, 255, 0.2)";

      const farShift = -Math.floor(cameraX * 0.1) % 168;
      for (let block = -2; block < 6; block += 1) {
        const base = block * 168 + farShift;
        for (let i = 0; i < 12; i += 1) {
          const bw = 10 + ((i + block + 13) % 3) * 3;
          const h = 42 + ((i * 12 + block * 7 + 180) % 48);
          const bx = Math.floor(base + i * 14);
          const by = 124 - h;

          ctx.fillStyle = farBody;
          ctx.fillRect(bx, by, bw, h);
          ctx.fillStyle = farBodyHi;
          ctx.fillRect(bx + 1, by + 1, bw - 2, h - 2);
          ctx.fillStyle = farEdge;
          ctx.fillRect(bx + bw - 2, by + 1, 1, h - 2);

          for (let wy = by + 6; wy < 122; wy += 6) {
            const lit = (wy + i + block) % 3 !== 0;
            ctx.fillStyle = lit ? farWinLit : farWinDim;
            ctx.fillRect(bx + 2, wy, 2, 1);
            ctx.fillStyle = lit && i % 2 === 0 ? farWinWarm : farWinCool;
            ctx.fillRect(bx + bw - 4, wy + 1, 2, 1);
          }
          if ((i + block) % 5 === 0) {
            ctx.fillStyle = farRoof;
            ctx.fillRect(bx + 2, by - 3, bw - 4, 2);
            ctx.fillStyle = farRoofNeon;
            ctx.fillRect(bx + 4, by - 2, Math.max(1, bw - 8), 1);
          }
        }
      }

      const midShift = -Math.floor(cameraX * 0.26) % 132;
      for (let block = -2; block < 7; block += 1) {
        const base = block * 132 + midShift;
        for (let i = 0; i < 8; i += 1) {
          const bw = 13 + ((i + block + 18) % 2) * 3;
          const h = 58 + ((i * 15 + block * 10 + 170) % 46);
          const bx = Math.floor(base + i * 17);
          const by = 144 - h;

          ctx.fillStyle = midBody;
          ctx.fillRect(bx, by, bw, h);
          ctx.fillStyle = midTop;
          ctx.fillRect(bx, by, bw, 3);
          ctx.fillStyle = midEdge;
          ctx.fillRect(bx + bw - 2, by + 2, 1, h - 2);

          for (let wy = by + 8; wy < 140; wy += 7) {
            ctx.fillStyle = (wy + i) % 2 === 0 ? midWinA : midWinB;
            ctx.fillRect(bx + 3, wy, 2, 2);
            ctx.fillStyle = (wy + i) % 3 === 0 ? midWinWarm : midWinCool;
            ctx.fillRect(bx + bw - 5, wy + 1, 2, 2);
          }

          if ((i + block) % 4 === 0) {
            ctx.fillStyle = midBand;
            ctx.fillRect(bx + 1, by + 5, bw - 2, 2);
          }
        }
      }

      ctx.fillStyle = cityGlowA;
      ctx.fillRect(0, 118, W, 26);
      ctx.fillStyle = cityGlowB;
      ctx.fillRect(0, 128, W, 8);

      ctx.fillStyle = railBase;
      ctx.fillRect(0, 136, W, 8);
      ctx.fillStyle = railPost;
      const railShift = -Math.floor(cameraX * 0.58) % 22;
      for (let x = railShift - 22; x < W + 22; x += 22) {
        ctx.fillRect(x, 144, 4, 8);
        ctx.fillStyle = railHi;
        ctx.fillRect(x + 1, 144, 1, 8);
        ctx.fillStyle = railPost;
      }

      const signShift = -Math.floor(cameraX * 0.34) % 96;
      const signBlink = Math.floor(player.anim * 0.2) % 3;
      for (let i = -1; i < 5; i += 1) {
        const sx = i * 96 + 20 + signShift;
        const sy = 86 + (i % 2) * 8;
        ctx.fillStyle = signBody;
        ctx.fillRect(sx, sy, 32, 10);
        ctx.fillStyle = signBodyHi;
        ctx.fillRect(sx + 1, sy + 1, 30, 8);
        ctx.fillStyle = i % 2 === 0 ? signNeonA : signNeonB;
        ctx.fillRect(sx + 2, sy + 2, 28, 2);
        ctx.fillStyle = signBlink === (i + 6) % 3 ? signTextOn : signTextOff;
        ctx.fillRect(sx + 4, sy + 5, 24, 2);
      }

      const trafficShift = -Math.floor(cameraX * 1.15 + player.anim * 1.4) % 54;
      for (let i = -1; i < 8; i += 1) {
        const tx = i * 54 + trafficShift;
        ctx.fillStyle = trafficA;
        ctx.fillRect(tx, 152, 18, 1);
        ctx.fillStyle = trafficB;
        ctx.fillRect(tx + 9, 154, 16, 1);
      }
      return;
    }

    const farShift = -Math.floor(cameraX * 0.11) % 176;
    for (let block = -2; block < 5; block += 1) {
      const base = block * 176 + farShift;
      for (let i = 0; i < 12; i += 1) {
        const bw = 9 + ((i + block + 14) % 3) * 2;
        const h = 34 + ((i * 13 + block * 9 + 200) % 40);
        const bx = Math.floor(base + i * 14);
        const by = 126 - h;

        ctx.fillStyle = "#131d34";
        ctx.fillRect(bx, by, bw, h);
        ctx.fillStyle = "#1d2b48";
        ctx.fillRect(bx + 1, by + 1, bw - 2, h - 2);
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(bx + bw - 2, by + 1, 1, h - 2);

        for (let wy = by + 6; wy < 124; wy += 6) {
          const lit = (wy + i + block) % 3 !== 0;
          ctx.fillStyle = lit ? "#86dcff" : "#2a3f5f";
          ctx.fillRect(bx + 2, wy, 2, 1);
          ctx.fillStyle = lit && i % 2 === 0 ? "#ffd69b" : "#24364f";
          ctx.fillRect(bx + bw - 4, wy + 1, 2, 1);
        }

        if ((i + block) % 6 === 0) {
          ctx.fillStyle = "#2e4466";
          ctx.fillRect(bx + 2, by - 3, bw - 4, 2);
          ctx.fillStyle = "#ff4b8a";
          ctx.fillRect(bx + 4, by - 2, Math.max(1, bw - 8), 1);
        }
      }
    }

    const midShift = -Math.floor(cameraX * 0.28) % 136;
    for (let block = -2; block < 6; block += 1) {
      const base = block * 136 + midShift;
      for (let i = 0; i < 8; i += 1) {
        const bw = 12 + ((i + block + 18) % 2) * 3;
        const h = 54 + ((i * 17 + block * 11 + 200) % 40);
        const bx = Math.floor(base + i * 17);
        const by = 144 - h;

        ctx.fillStyle = "#1d2d4c";
        ctx.fillRect(bx, by, bw, h);
        ctx.fillStyle = "#304a72";
        ctx.fillRect(bx, by, bw, 3);
        ctx.fillStyle = "#142036";
        ctx.fillRect(bx + bw - 2, by + 2, 1, h - 2);

        for (let wy = by + 8; wy < 140; wy += 7) {
          ctx.fillStyle = (wy + i) % 2 === 0 ? "#79e8ff" : "#2e4865";
          ctx.fillRect(bx + 3, wy, 2, 2);
          ctx.fillStyle = (wy + i) % 3 === 0 ? "#ffc37f" : "#27405b";
          ctx.fillRect(bx + bw - 5, wy + 1, 2, 2);
        }
      }
    }

    ctx.fillStyle = "rgba(130, 160, 200, 0.15)";
    ctx.fillRect(0, 120, W, 24);

    ctx.fillStyle = "#1f2430";
    ctx.fillRect(0, 136, W, 8);
    ctx.fillStyle = "#2c3342";
    const railShift = -Math.floor(cameraX * 0.6) % 22;
    for (let x = railShift - 22; x < W + 22; x += 22) {
      ctx.fillRect(x, 144, 4, 8);
      ctx.fillStyle = "#4e5565";
      ctx.fillRect(x + 1, 144, 1, 8);
      ctx.fillStyle = "#2c3342";
    }

    const signShift = -Math.floor(cameraX * 0.31) % 104;
    const signBlink = Math.floor(player.anim * 0.22) % 2 === 0;
    for (let i = -1; i < 4; i += 1) {
      const sx = i * 104 + 28 + signShift;
      const sy = 94 + (i % 2) * 7;
      ctx.fillStyle = "#1a2133";
      ctx.fillRect(sx, sy, 28, 9);
      ctx.fillStyle = "#2b3550";
      ctx.fillRect(sx + 1, sy + 1, 26, 7);
      ctx.fillStyle = i % 2 === 0 ? "rgba(128, 236, 255, 0.4)" : "rgba(255, 166, 134, 0.36)";
      ctx.fillRect(sx + 2, sy + 2, 24, 2);
      ctx.fillStyle = signBlink ? "#ffeab7" : "#95a7c3";
      ctx.fillRect(sx + 5, sy + 5, 18, 1);
    }

    const trafficShift = -Math.floor(cameraX * 1.05 + player.anim * 1.2) % 60;
    for (let i = -1; i < 7; i += 1) {
      const tx = i * 60 + trafficShift;
      ctx.fillStyle = "rgba(255, 142, 102, 0.2)";
      ctx.fillRect(tx, 152, 14, 1);
      ctx.fillStyle = "rgba(132, 220, 255, 0.18)";
      ctx.fillRect(tx + 10, 154, 12, 1);
    }
  }

  function drawCinematicBackdropFX(godBossRoom = false) {
    if (!isCinematicMode()) return;

    const stageId = stage && Number.isFinite(stage.id) ? stage.id : 1;
    const deluxeCity = stage && stage.theme === "city_deluxe";
    const stage2City = deluxeCity && stageId === 2;
    const stage3City = deluxeCity && stageId >= 3;

    const topTint = godBossRoom
      ? "rgba(255,226,196,0.11)"
      : stage3City
        ? "rgba(232,150,255,0.13)"
        : stage2City
          ? "rgba(106,255,232,0.13)"
          : "rgba(255,116,188,0.11)";
    const horizonTint = godBossRoom
      ? "rgba(255,188,126,0.14)"
      : stage3City
        ? "rgba(130,196,255,0.16)"
        : stage2City
          ? "rgba(116,234,255,0.16)"
          : "rgba(114,216,255,0.13)";

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const colorWash = ctx.createLinearGradient(0, 0, 0, H);
    colorWash.addColorStop(0, topTint);
    colorWash.addColorStop(0.5, "rgba(255,255,255,0)");
    colorWash.addColorStop(1, horizonTint);
    ctx.fillStyle = colorWash;
    ctx.fillRect(0, 0, W, H);

    const beamColors = godBossRoom
      ? [
        "rgba(255,248,228,0.16)",
        "rgba(255,214,164,0.13)",
        "rgba(255,174,132,0.1)",
      ]
      : stage3City
        ? [
          "rgba(255,170,240,0.16)",
          "rgba(160,210,255,0.13)",
          "rgba(180,128,255,0.1)",
        ]
        : stage2City
          ? [
            "rgba(164,255,240,0.16)",
            "rgba(112,228,255,0.13)",
            "rgba(255,214,150,0.1)",
          ]
          : [
            "rgba(255,166,212,0.14)",
            "rgba(122,228,255,0.12)",
            "rgba(255,214,154,0.09)",
          ];
    const beamBase = godBossRoom ? 26 : 18;
    for (let i = 0; i < 3; i += 1) {
      const beamX = (
        i * 104 +
        Math.floor(cameraX * (0.12 + i * 0.04)) +
        Math.floor(player.anim * (1.1 + i * 0.4))
      ) % (W + 88) - 44;
      const beamW = beamBase + i * 12 + (stage3City ? 6 : 0);
      ctx.save();
      ctx.translate(beamX + beamW * 0.5, godBossRoom ? 8 : -10);
      ctx.rotate((godBossRoom ? -0.08 : -0.14) + i * 0.08);
      const beam = ctx.createLinearGradient(-beamW * 0.5, 0, beamW * 0.5, 0);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(0.5, beamColors[i]);
      beam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(-beamW * 0.5, 0, beamW, H * 1.24);
      ctx.restore();
    }

    const bokehCount = godBossRoom ? 8 : stage3City ? 12 : 10;
    for (let i = 0; i < bokehCount; i += 1) {
      const bx = (
        i * 31 +
        Math.floor(cameraX * (0.18 + (i % 3) * 0.04)) +
        Math.floor(player.anim * 0.8)
      ) % (W + 24) - 12;
      const by = (godBossRoom ? 18 : 24) + ((i * (godBossRoom ? 17 : 19)) % (godBossRoom ? 72 : 96));
      const radius = i % 3 === 0 ? 5 : 3;
      const alpha = 0.04 + (i % 4) * 0.01;
      ctx.fillStyle = godBossRoom
        ? `rgba(255, 223, 185, ${alpha})`
        : stage3City
          ? `rgba(236, 194, 255, ${alpha})`
          : stage2City
            ? `rgba(176, 255, 236, ${alpha})`
            : `rgba(188, 228, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    const floorGlow = ctx.createLinearGradient(0, stage.groundY - 18, 0, H);
    floorGlow.addColorStop(0, "rgba(255,255,255,0)");
    floorGlow.addColorStop(
      1,
      godBossRoom
        ? "rgba(255,186,126,0.08)"
        : stage3City
          ? "rgba(142,116,255,0.1)"
          : stage2City
            ? "rgba(108,234,255,0.09)"
            : "rgba(108,208,255,0.08)"
    );
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, stage.groundY - 18, W, H - (stage.groundY - 18));
  }

  function drawCinematicForegroundFX(godBossRoom = false) {
    if (!isCinematicMode()) return;

    const floorMist = ctx.createLinearGradient(0, stage.groundY - 12, 0, H);
    floorMist.addColorStop(0, "rgba(255,255,255,0)");
    floorMist.addColorStop(
      1,
      godBossRoom ? "rgba(255,228,210,0.09)" : "rgba(198, 240, 255, 0.08)"
    );
    ctx.fillStyle = floorMist;
    ctx.fillRect(0, stage.groundY - 12, W, H - (stage.groundY - 12));

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const sweepX = ((Math.floor(player.anim * 0.9) + Math.floor(cameraX * 0.32)) % (W + 72)) - 36;
    const sweep = ctx.createLinearGradient(sweepX, 0, sweepX + 40, H);
    sweep.addColorStop(0, "rgba(255,255,255,0)");
    sweep.addColorStop(0.5, godBossRoom ? "rgba(255,241,214,0.07)" : "rgba(255,255,255,0.06)");
    sweep.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(sweepX, 18, 40, H - 18);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = godBossRoom ? "rgba(46, 32, 24, 0.34)" : "rgba(16, 24, 36, 0.38)";
    ctx.lineWidth = 1;
    const cableShift = -Math.floor(cameraX * 0.92) % 140;
    for (let i = 0; i < 3; i += 1) {
      const startX = -24 + cableShift + i * 18;
      const y = 18 + i * 18;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.quadraticCurveTo(W * 0.34, y + 8 + i * 3, W * 0.72, y - 4 + i * 2);
      ctx.lineTo(W + 24, y + 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMansionInteriorBackdrop() {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, "#191320");
    wall.addColorStop(0.56, "#35253f");
    wall.addColorStop(1, "#201b2c");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    const panelShift = -Math.floor(cameraX * 0.22) % 48;
    for (let x = panelShift - 48; x < W + 48; x += 48) {
      ctx.fillStyle = "#2c1f36";
      ctx.fillRect(x + 2, 6, 44, 116);
      ctx.fillStyle = "#412d4e";
      ctx.fillRect(x + 4, 8, 40, 3);
      ctx.fillStyle = "rgba(255, 214, 152, 0.06)";
      ctx.fillRect(x + 6, 12, 1, 105);
      ctx.fillRect(x + 42, 12, 1, 105);
    }

    const colShift = -Math.floor(cameraX * 0.18) % 80;
    for (let x = colShift - 80; x < W + 80; x += 80) {
      ctx.fillStyle = "#2a1e33";
      ctx.fillRect(x + 8, 14, 12, 116);
      ctx.fillStyle = "#5a405f";
      ctx.fillRect(x + 10, 16, 8, 4);
      ctx.fillStyle = "#221826";
      ctx.fillRect(x + 11, 24, 6, 102);
      ctx.fillStyle = "rgba(255, 225, 183, 0.08)";
      ctx.fillRect(x + 12, 24, 1, 98);
    }

    const windowShift = -Math.floor(cameraX * 0.1) % 104;
    for (let i = -1; i < 4; i += 1) {
      const wx = i * 104 + 24 + windowShift;
      const wy = 18;
      ctx.fillStyle = "#111827";
      ctx.fillRect(wx, wy, 40, 54);
      ctx.fillStyle = "#223b63";
      ctx.fillRect(wx + 2, wy + 2, 36, 50);
      ctx.fillStyle = "rgba(122, 196, 255, 0.35)";
      for (let y = wy + 7; y < wy + 48; y += 8) {
        ctx.fillRect(wx + 4, y, 6, 2);
        ctx.fillRect(wx + 30, y + 2, 6, 2);
      }
      ctx.fillStyle = "#9d7a58";
      ctx.fillRect(wx - 2, wy - 2, 44, 2);
      ctx.fillRect(wx - 2, wy + 54, 44, 2);
      ctx.fillStyle = "#6a4e38";
      ctx.fillRect(wx - 3, wy, 2, 54);
      ctx.fillRect(wx + 41, wy, 2, 54);
    }

    const sway = Math.sin(player.anim * 0.08) * 1.4;
    const chainX = Math.floor(160 + sway);
    ctx.fillStyle = "#c9a46f";
    ctx.fillRect(chainX - 1, 0, 2, 20);
    ctx.fillRect(chainX - 9, 19, 18, 2);
    ctx.fillStyle = "#daba86";
    ctx.fillRect(chainX - 16, 21, 32, 3);
    ctx.fillStyle = "rgba(255, 232, 170, 0.42)";
    ctx.fillRect(chainX - 24, 24, 48, 8);
    ctx.fillStyle = "#fff2c8";
    ctx.fillRect(chainX - 14, 24, 4, 4);
    ctx.fillRect(chainX - 2, 24, 4, 4);
    ctx.fillRect(chainX + 10, 24, 4, 4);

    ctx.fillStyle = "#382533";
    ctx.fillRect(0, 130, W, 50);
    ctx.fillStyle = "#4f3344";
    ctx.fillRect(0, 130, W, 6);
    ctx.fillStyle = "#251a26";
    for (let y = 138; y < H; y += 10) {
      ctx.fillRect(0, y, W, 1);
    }

    ctx.fillStyle = "#6e2f45";
    ctx.fillRect(34, 136, W - 68, 42);
    ctx.fillStyle = "#9f4f68";
    ctx.fillRect(36, 138, W - 72, 3);
    ctx.fillStyle = "rgba(255, 204, 220, 0.1)";
    for (let x = 48; x < W - 48; x += 28) {
      ctx.fillRect(x, 148, 12, 1);
      ctx.fillRect(x + 6, 160, 10, 1);
    }

    ctx.fillStyle = "rgba(255, 210, 220, 0.08)";
    for (let x = 0; x < W; x += 28) {
      ctx.fillRect(x, 167, 14, 1);
    }
    ctx.fillStyle = "rgba(120, 190, 255, 0.06)";
    for (let y = 140; y < H; y += 8) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  function roundedRectPath(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function fillRoundedRect(x, y, w, h, r, fillStyle) {
    if (fillStyle != null) ctx.fillStyle = fillStyle;
    roundedRectPath(x, y, w, h, r);
    ctx.fill();
  }

  function strokeRoundedRect(x, y, w, h, r, strokeStyle, lineWidth = 1) {
    if (strokeStyle != null) ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    roundedRectPath(x, y, w, h, r);
    ctx.stroke();
  }

  function fillEllipse(x, y, rx, ry, fillStyle) {
    if (fillStyle != null) ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSolidCinematic(s) {
    const ox = Math.floor(s.x - cameraX);
    const oy = Math.floor(s.y);
    const radius = s.isWall ? 2 : 3;
    const topH = Math.min(6, Math.max(3, Math.floor(s.h * 0.16)));

    let topA = "#5fb8ff";
    let topB = "#f59fda";
    let bodyA = "#1d2f48";
    let bodyB = "#0d1727";
    let line = "rgba(222, 238, 255, 0.22)";
    if (s.kind === "crumble") {
      topA = "#ffb38a";
      topB = "#ffd7bf";
      bodyA = "#4c3a44";
      bodyB = "#1f1821";
      line = "rgba(255, 228, 204, 0.18)";
    }
    if (s.isWall) {
      topA = "#c48ca2";
      topB = "#f1bfcb";
      bodyA = "#43313a";
      bodyB = "#201820";
      line = "rgba(255, 223, 232, 0.16)";
    }

    const body = ctx.createLinearGradient(0, oy, 0, oy + s.h);
    body.addColorStop(0, bodyA);
    body.addColorStop(1, bodyB);
    fillRoundedRect(ox, oy, s.w, s.h, radius, body);

    const top = ctx.createLinearGradient(0, oy, 0, oy + topH);
    top.addColorStop(0, topB);
    top.addColorStop(1, topA);
    fillRoundedRect(ox, oy, s.w, topH, radius, top);

    // ネオンが上面エッジに反射するブルーム
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = s.isWall
      ? "rgba(255, 150, 185, 0.16)"
      : s.kind === "crumble"
        ? "rgba(255, 185, 120, 0.16)"
        : "rgba(120, 200, 255, 0.14)";
    ctx.fillRect(ox, oy - 1, s.w, 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fillRect(ox, oy, s.w, 1);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(ox + 2, oy + 1, Math.max(1, s.w - 4), 1);
    ctx.fillStyle = line;
    for (let x = 4; x < s.w - 2; x += 10) {
      ctx.fillRect(ox + x, oy + topH + 3, 1, Math.max(1, s.h - topH - 8));
    }
    // ビル外壁らしいパネル目地と窓明かり
    ctx.fillStyle = "rgba(8, 13, 22, 0.30)";
    for (let y = topH + 6; y < s.h - 4; y += 9) {
      ctx.fillRect(ox + 2, oy + y, Math.max(1, s.w - 4), 1);
    }
    if (s.h > 26 && !s.isWall && s.kind !== "crumble") {
      for (let y = topH + 9; y < s.h - 6; y += 9) {
        for (let x = 6; x < s.w - 5; x += 10) {
          const lit = Math.floor((s.x + x) * 0.13 + (s.y + y) * 0.31) % 5;
          if (lit === 0) {
            ctx.fillStyle = "rgba(255, 214, 150, 0.20)";
            ctx.fillRect(ox + x, oy + y, 2, 2);
          } else if (lit === 2) {
            ctx.fillStyle = "rgba(130, 200, 255, 0.13)";
            ctx.fillRect(ox + x, oy + y, 2, 2);
          }
        }
      }
    }
    // 側面の遮蔽影で立体感を出す
    const sideShade = ctx.createLinearGradient(ox + s.w - 6, 0, ox + s.w, 0);
    sideShade.addColorStop(0, "rgba(0,0,0,0)");
    sideShade.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = sideShade;
    ctx.fillRect(ox + s.w - 6, oy + 1, 6, Math.max(1, s.h - 2));
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(ox + 1, oy + s.h - 2, Math.max(1, s.w - 2), 1);
    strokeRoundedRect(ox + 0.5, oy + 0.5, s.w - 1, s.h - 1, radius, "rgba(8, 14, 24, 0.55)");
  }

  function drawHeroCinematic(x, y, facing, animFrame, scale = 1, kickPose = 0) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    const s = clamp(scale, 1, 1.9);
    const drawY = py + 25 - 25 * s;
    const step = Math.sin(animFrame * 0.28);
    const armSwing = step * 1.1;
    const legSwing = step * 1.4;
    const kick = clamp(kickPose, 0, 1);

    ctx.save();
    ctx.translate(px, drawY);
    ctx.scale(s, s);
    if (facing < 0) {
      ctx.translate(14, 0);
      ctx.scale(-1, 1);
    }

    ctx.globalAlpha = 0.18;
    fillEllipse(7, 13, 5.5, 8.4, "#89c8ff");
    ctx.globalAlpha = 1;

    const jacket = ctx.createLinearGradient(0, 12, 0, 22);
    jacket.addColorStop(0, "#30435e");
    jacket.addColorStop(1, "#121925");
    const jeans = ctx.createLinearGradient(0, 18, 0, 25);
    jeans.addColorStop(0, "#31466b");
    jeans.addColorStop(1, "#131924");

    fillEllipse(7.2, 6.3, 3.2, 3.6, "#f5d9cf");
    fillEllipse(7.2, 7.2, 3.1, 3.1, "#f2ddd6");

    ctx.fillStyle = "#0c1220";
    ctx.beginPath();
    ctx.moveTo(2.6, 5.5);
    ctx.quadraticCurveTo(4.0, 0.4, 8.0, 1.0);
    ctx.quadraticCurveTo(12.7, 1.4, 12.1, 6.2);
    ctx.quadraticCurveTo(11.4, 8.6, 9.6, 9.5);
    ctx.quadraticCurveTo(8.8, 8.1, 7.3, 8.0);
    ctx.quadraticCurveTo(6.0, 8.0, 4.6, 9.2);
    ctx.quadraticCurveTo(2.8, 8.0, 2.6, 5.5);
    ctx.closePath();
    ctx.fill();
    fillEllipse(7.8, 3.3, 1.8, 0.7, "rgba(142, 186, 255, 0.42)");

    fillRoundedRect(5.5, 9.0, 3.2, 1.2, 0.5, "#1d2332");
    fillEllipse(5.7, 6.1, 0.45, 0.6, "#34262a");
    fillEllipse(8.8, 6.1, 0.45, 0.6, "#34262a");
    fillEllipse(5.6, 5.8, 0.18, 0.18, "#ffffff");
    fillEllipse(8.7, 5.8, 0.18, 0.18, "#ffffff");
    fillRoundedRect(6.2, 7.5, 1.7, 0.42, 0.2, "#c58a83");

    ctx.save();
    ctx.translate(4.2, 12.6 + armSwing * 0.35);
    ctx.rotate(-0.18 + armSwing * 0.04 + kick * 0.06);
    fillRoundedRect(-0.7, 0, 1.7, 6.5, 0.7, "#1e2838");
    fillEllipse(0.1, 6.8, 0.9, 0.9, "#f1d5ca");
    ctx.restore();

    ctx.save();
    ctx.translate(10.7, 12.5 - armSwing * 0.3 - kick * 0.7);
    ctx.rotate(0.14 - armSwing * 0.04 - kick * 0.18);
    fillRoundedRect(-0.8, 0, 1.8, 6.6, 0.7, "#1b2434");
    fillEllipse(0.1, 6.9, 0.9, 0.9, "#f1d5ca");
    ctx.restore();

    fillRoundedRect(3.0, 11.4, 8.2, 7.8, 1.8, jacket);
    fillRoundedRect(5.2, 12.0, 3.1, 5.8, 1.1, "#f3f1ee");
    fillRoundedRect(6.6, 11.8, 0.4, 6.2, 0.2, "#9eb6d4");
    fillRoundedRect(4.0, 11.8, 1.8, 1.1, 0.4, "#43587a");
    fillRoundedRect(8.2, 11.8, 1.8, 1.1, 0.4, "#43587a");
    fillRoundedRect(5.0, 18.6, 4.4, 2.2, 0.9, "#8b4f38");

    ctx.save();
    ctx.translate(5.0, 18.8);
    ctx.rotate(-0.08 + legSwing * 0.03 - kick * 0.06);
    fillRoundedRect(0, 0, 2.2, 5.8, 0.9, jeans);
    fillRoundedRect(-0.2, 5.2, 2.7, 1.4, 0.6, "#1b1f28");
    ctx.restore();

    ctx.save();
    ctx.translate(8.4 + kick * 2.8, 18.8 - kick * 2.0);
    ctx.rotate(0.08 - legSwing * 0.03 + kick * 0.26);
    fillRoundedRect(0, 0, 2.2, 5.8 + kick * 1.0, 0.9, jeans);
    fillRoundedRect(-0.2, 5.2 + kick * 0.6, 2.9 + kick * 0.7, 1.4, 0.6, "#1b1f28");
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(10.9, 12.4);
    ctx.quadraticCurveTo(12.9, 14.0, 13.1, 17.8);
    ctx.strokeStyle = "rgba(176, 220, 255, 0.32)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }

  function drawBoyfriendCinematic(x, y) {
    const px = Math.floor(x - cameraX);
    const py = Math.floor(y);
    const bob = Math.sin(player.anim * 0.14 + x * 0.02) * 0.5;

    ctx.save();
    ctx.translate(px, py + bob);
    fillEllipse(7, 13, 4.8, 7.2, "rgba(124, 204, 255, 0.14)");
    fillEllipse(7, 6.2, 3.0, 3.5, "#f0d5c4");
    ctx.fillStyle = "#d94747";
    ctx.beginPath();
    ctx.moveTo(3.0, 4.4);
    ctx.quadraticCurveTo(4.8, 0.5, 9.8, 1.0);
    ctx.quadraticCurveTo(12.2, 1.5, 12.4, 4.2);
    ctx.lineTo(11.4, 5.2);
    ctx.lineTo(4.1, 5.2);
    ctx.closePath();
    ctx.fill();
    fillRoundedRect(4.1, 5.0, 7.8, 1.3, 0.5, "#8e2f2f");
    fillRoundedRect(3.1, 11.0, 8.0, 7.6, 1.7, "#2f5e92");
    fillRoundedRect(5.3, 11.6, 2.0, 5.1, 0.8, "#eff3f8");
    fillRoundedRect(2.0, 12.0, 1.7, 5.8, 0.7, "#1f3046");
    fillRoundedRect(10.3, 12.0, 1.7, 5.8, 0.7, "#1f3046");
    fillRoundedRect(4.4, 18.0, 2.0, 5.5, 0.8, "#2c3f57");
    fillRoundedRect(8.0, 18.0, 2.0, 5.5, 0.8, "#2c3f57");
    fillRoundedRect(4.0, 23.0, 2.7, 1.2, 0.5, "#191c24");
    fillRoundedRect(7.8, 23.0, 2.7, 1.2, 0.5, "#191c24");
    fillEllipse(5.9, 6.1, 0.4, 0.55, "#2f262a");
    fillEllipse(8.4, 6.1, 0.4, 0.55, "#2f262a");
    ctx.restore();
  }

  function drawPartygoonCinematic(enemy) {
    const x = Math.floor(enemy.x - cameraX);
    const y = Math.floor(enemy.y);
    ctx.save();
    ctx.translate(x, y);
    fillEllipse(6.5, 15.5, 5.0, 2.0, "rgba(0,0,0,0.16)");
    fillEllipse(6.5, 5.6, 2.8, 3.1, "#f0cbb8");
    fillRoundedRect(2.4, 8.8, 8.3, 7.1, 1.6, enemy.kicked ? "#694d58" : "#7c4f60");
    fillRoundedRect(1.6, 10.0, 1.5, 5.1, 0.6, "#322533");
    fillRoundedRect(9.9, 10.0, 1.5, 5.1, 0.6, "#322533");
    fillRoundedRect(4.0, 15.0, 2.0, 3.2, 0.7, "#2a2d3b");
    fillRoundedRect(7.0, 15.0, 2.0, 3.2, 0.7, "#2a2d3b");
    fillEllipse(5.7, 5.7, 0.4, 0.5, "#231b1e");
    fillEllipse(8.2, 5.7, 0.4, 0.5, "#231b1e");
    if (Math.floor((player.anim + enemy.x) * 0.12) % 2 === 0) {
      fillEllipse(enemy.dir > 0 ? 13.1 : -0.1, 6.8, 1.0, 0.55, "rgba(176, 240, 255, 0.68)");
    }
    ctx.restore();
  }

  function drawPeacockCinematic(enemy) {
    const x = Math.floor(enemy.x - cameraX);
    const y = Math.floor(enemy.y);
    const dir = enemy.dir >= 0 ? 1 : -1;
    const bodyMain = enemy.kicked ? "#3b6e82" : enemy.mode === "charge" ? "#2f93cf" : "#39a2d0";
    const tailMain = enemy.mode === "charge" ? "#39b48a" : "#43c28f";
    const tailEye = enemy.mode === "windup" ? "#f7f3a4" : "#9ff3dc";
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) {
      ctx.translate(16, 0);
      ctx.scale(-1, 1);
    }
    fillEllipse(8, 17.0, 5.2, 1.8, "rgba(0,0,0,0.16)");
    for (let i = 0; i < 4; i += 1) {
      fillEllipse(1.6 + i * 1.15, 9.2 + i * 0.5, 1.8, 4.6 - i * 0.7, `rgba(76, 214, 178, ${0.16 + i * 0.03})`);
    }
    fillEllipse(8.4, 10.4, 3.7, 4.5, bodyMain);
    fillEllipse(9.8, 6.3, 2.0, 2.2, "#17374b");
    fillEllipse(10.4, 6.1, 0.44, 0.55, "#ffffff");
    fillEllipse(8.8, 11.0, 2.2, 2.0, "#82e7d4");
    fillRoundedRect(4.2, 7.0, 2.8, 6.8, 1.1, tailMain);
    fillEllipse(5.7, 10.2, 0.8, 1.6, tailEye);
    fillRoundedRect(8.0, 14.2, 1.1, 3.1, 0.4, "#453126");
    fillRoundedRect(10.0, 14.2, 1.1, 3.1, 0.4, "#453126");
    fillRoundedRect(11.1, 6.6, 2.6, 1.1, 0.4, "#e3c56d");
    ctx.restore();
  }

  function drawBruiserCinematic(enemy) {
    const x = Math.floor(enemy.x - cameraX);
    const y = Math.floor(enemy.y);
    const armor = enemy.kicked ? "#53657c" : "#617897";
    const armorHi = enemy.kicked ? "#7f97b4" : "#93accc";
    ctx.save();
    ctx.translate(x, y);
    fillEllipse(8, 17.8, 6.0, 1.8, "rgba(0,0,0,0.18)");
    fillEllipse(8, 5.6, 3.0, 3.1, "#efccb8");
    fillRoundedRect(1.8, 8.2, 12.2, 7.6, 1.8, armor);
    fillRoundedRect(3.0, 9.0, 9.8, 2.1, 1.0, armorHi);
    fillRoundedRect(0.4, 9.5, 2.2, 5.4, 0.8, "#334053");
    fillRoundedRect(13.4, 9.5, 2.2, 5.4, 0.8, "#334053");
    fillRoundedRect(4.0, 15.0, 3.0, 3.5, 0.8, "#243042");
    fillRoundedRect(9.0, 15.0, 3.0, 3.5, 0.8, "#243042");
    fillRoundedRect(5.0, 5.0, 6.0, 1.4, 0.5, "#294057");
    fillEllipse(6.3, 5.8, 0.55, 0.5, "#d6ecff");
    fillEllipse(9.7, 5.8, 0.55, 0.5, "#d6ecff");
    if (enemy.flash > 0) {
      fillEllipse(enemy.dir > 0 ? 16.2 : -0.2, 8.6, 1.2, 0.7, "rgba(255, 235, 168, 0.78)");
    }
    ctx.restore();
  }

  function drawDefaultEnemyCinematic(enemy) {
    const x = Math.floor(enemy.x - cameraX);
    const y = Math.floor(enemy.y);
    const coat = enemy.kicked ? "#69495b" : "#513547";
    ctx.save();
    ctx.translate(x, y);
    fillEllipse(7, 16.8, 5.0, 1.6, "rgba(0,0,0,0.16)");
    fillEllipse(7, 5.7, 2.8, 3.0, "#efc5ab");
    fillRoundedRect(2.2, 8.6, 8.8, 7.1, 1.6, coat);
    fillRoundedRect(1.3, 10.0, 1.7, 4.8, 0.7, "#222a38");
    fillRoundedRect(10.0, 10.0, 1.7, 4.8, 0.7, "#222a38");
    fillRoundedRect(3.7, 14.8, 2.2, 3.2, 0.7, "#242d3c");
    fillRoundedRect(7.4, 14.8, 2.2, 3.2, 0.7, "#242d3c");
    fillEllipse(5.8, 5.8, 0.38, 0.45, "#2c2228");
    fillEllipse(8.2, 5.8, 0.38, 0.45, "#2c2228");
    if (enemy.flash > 0) {
      fillEllipse(enemy.dir > 0 ? 13.3 : -0.3, 7.0, 1.0, 0.55, "rgba(255, 230, 164, 0.78)");
    }
    ctx.restore();
  }

  function drawEnemyCinematic(enemy) {
    if (enemy.kind === "partygoon") {
      drawPartygoonCinematic(enemy);
      drawEnemyHpPips(enemy, Math.floor(enemy.x - cameraX), Math.floor(enemy.y));
      return;
    }
    if (enemy.kind === "peacock") {
      drawPeacockCinematic(enemy);
      drawEnemyHpPips(enemy, Math.floor(enemy.x - cameraX), Math.floor(enemy.y));
      return;
    }
    if (enemy.kind === "bruiser") {
      drawBruiserCinematic(enemy);
      drawEnemyHpPips(enemy, Math.floor(enemy.x - cameraX), Math.floor(enemy.y));
      return;
    }
    drawDefaultEnemyCinematic(enemy);
    drawEnemyHpPips(enemy, Math.floor(enemy.x - cameraX), Math.floor(enemy.y));
  }

  function drawPeacockBossCinematic(b) {
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    const dir = b.dir >= 0 ? 1 : -1;
    const rage = b.hp <= Math.ceil(b.maxHp * 0.4);
    ctx.save();
    ctx.translate(x + b.w * 0.5, y + 2);
    if (dir < 0) ctx.scale(-1, 1);
    for (let i = 0; i < 5; i += 1) {
      fillEllipse(-12 + i * 3.6, 16 - i * 1.2, 5.8 - i * 0.4, 12 - i, `rgba(${rage ? "96, 240, 210" : "90, 225, 200"}, ${0.12 + i * 0.025})`);
    }
    fillEllipse(0, 20, 10, 2.4, "rgba(0,0,0,0.18)");
    fillEllipse(0, 12, 8.6, 10.6, rage ? "#3290d8" : "#36a3dc");
    fillEllipse(2.2, 2.6, 4.3, 4.6, "#173b4f");
    fillRoundedRect(4.2, 1.9, 5.1, 1.7, 0.6, "#e6c86f");
    fillEllipse(3.4, 2.4, 0.8, 0.9, "#ffffff");
    fillEllipse(6.2, 2.4, 0.8, 0.9, "#ffffff");
    fillEllipse(1.2, 11.6, 5.8, 4.2, rage ? "#7ae9d7" : "#8af1df");
    fillRoundedRect(-2.6, 18.0, 3.0, 10.2, 1.2, "#31425d");
    fillRoundedRect(2.8, 18.0, 3.0, 10.2, 1.2, "#31425d");
    if (b.mode === "windup" || b.mode === "dash" || b.mode === "shoot") {
      strokeRoundedRect(-13.0, -3.0, 27.0, 36.0, 4, rage ? "rgba(255, 182, 116, 0.88)" : "rgba(174, 255, 206, 0.78)");
    }
    ctx.restore();
  }

  function drawPeacockHumanBossCinematic(b) {
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    const rage = b.hp <= Math.ceil(b.maxHp * 0.56);
    ctx.save();
    ctx.translate(x, y);
    fillEllipse(12, 36, 11.5, 2.2, "rgba(0,0,0,0.2)");
    fillEllipse(12, 8.0, 5.2, 5.4, "#eed5c4");
    fillRoundedRect(7.0, 1.2, 10.0, 2.0, 0.8, rage ? "#3a7bb0" : "#31658f");
    fillRoundedRect(4.4, 13.0, 15.2, 11.5, 2.5, rage ? "#30476f" : "#293b60");
    fillRoundedRect(2.0, 16.0, 3.0, 13.0, 1.3, rage ? "#2a7887" : "#236777");
    fillRoundedRect(19.0, 16.0, 3.0, 13.0, 1.3, rage ? "#2a7887" : "#236777");
    fillRoundedRect(7.0, 24.0, 4.0, 12.0, 1.3, "#2b3853");
    fillRoundedRect(13.0, 24.0, 4.0, 12.0, 1.3, "#2b3853");
    fillRoundedRect(9.2, 13.8, 5.0, 8.0, 1.2, "#f2f5fb");
    fillEllipse(10.0, 8.1, 0.65, 0.75, "#27303d");
    fillEllipse(14.0, 8.1, 0.65, 0.75, "#27303d");
    if (b.mode === "shoot" || b.mode === "ring" || b.mode === "leap_prep" || b.mode === "dash") {
      strokeRoundedRect(1.0, 0.0, 22.0, 38.0, 4, rage ? "rgba(255, 176, 116, 0.9)" : "rgba(124, 244, 255, 0.82)");
    }
    ctx.restore();
  }

  function drawGodBossCinematic(b) {
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    const phase2 = (b.phase || 1) >= 2;
    const rage = b.hp <= Math.ceil(b.maxHp * (phase2 ? 0.45 : 0.35));
    ctx.save();
    ctx.translate(x, y);
    fillEllipse(12, 36, 12.5, 2.3, "rgba(0,0,0,0.22)");
    fillEllipse(12, 18, 14.0, 18.0, phase2 ? "rgba(162, 150, 255, 0.18)" : "rgba(255, 196, 128, 0.16)");
    fillRoundedRect(6.0, 0.0, 12.0, 11.0, 4.5, phase2 ? "#d8d6e8" : "#e7d4bd");
    fillRoundedRect(7.2, 10.0, 9.6, 9.0, 2.0, phase2 ? "#f0dfd4" : "#e4d0bd");
    fillRoundedRect(2.2, 15.0, 19.6, 16.0, 3.2, phase2 ? "#352c4e" : "#3a2f3a");
    fillRoundedRect(0.6, 16.0, 3.0, 12.0, 1.4, "#aab2c6");
    fillRoundedRect(20.4, 16.0, 3.0, 12.0, 1.4, "#aab2c6");
    fillRoundedRect(6.2, 29.0, 4.4, 8.0, 1.2, "#2f3951");
    fillRoundedRect(13.4, 29.0, 4.4, 8.0, 1.2, "#2f3951");
    fillEllipse(9.1, 13.5, 0.8, 0.55, rage ? "#ff7788" : "#9fd8ff");
    fillEllipse(14.9, 13.5, 0.8, 0.55, rage ? "#ff7788" : "#9fd8ff");
    if (b.mode === "windup" || b.mode === "dash" || b.mode === "phase_shift" || b.mode === "shoot") {
      strokeRoundedRect(-1.0, -2.0, 26.0, 40.0, 5, rage ? "rgba(255, 152, 122, 0.88)" : "rgba(170, 210, 255, 0.82)");
    }
    ctx.restore();
  }

  function drawBossCinematic() {
    if (!stage.boss.active) return;
    const b = stage.boss;
    if (b.kind === "peacock") {
      for (const pb of getBossEntities(true).filter((boss) => boss.kind === "peacock")) {
        if (pb.hp <= 0) continue;
        drawPeacockBossCinematic(pb);
      }
      return;
    }
    if (b.kind === "peacockman") {
      drawPeacockHumanBossCinematic(b);
      return;
    }
    drawGodBossCinematic(b);
  }

  function drawSolid(s) {
    if (isCinematicMode()) {
      drawSolidCinematic(s);
      return;
    }
    let body = "#434956";
    let top = "#6c7484";

    if (s.kind === "crumble") {
      body = s.state === "warning" ? "#5f4247" : "#4b505d";
      top = s.state === "warning" ? "#cc8e78" : "#7c8292";
    }

    if (s.isWall) {
      body = "#3e333a";
      top = "#8f5967";
    }

    const ox = Math.floor(s.x - cameraX);
    const oy = Math.floor(s.y);

    ctx.fillStyle = body;
    ctx.fillRect(ox, oy, s.w, s.h);

    ctx.fillStyle = top;
    ctx.fillRect(ox, oy, s.w, 3);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let x = 2; x < s.w - 1; x += 6) {
      ctx.fillRect(ox + x, oy + 4, 1, Math.max(0, s.h - 8));
    }
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let y = 6; y < s.h - 3; y += 7) {
      ctx.fillRect(ox + 2, oy + y, Math.max(1, s.w - 4), 1);
    }
    ctx.fillStyle = "rgba(15,18,25,0.2)";
    for (let y = 8; y < s.h - 4; y += 9) {
      const notch = 2 + ((Math.floor(s.x + s.y + y) / 3) % 4);
      ctx.fillRect(ox + notch, oy + y, 2, 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(ox + 1, oy + s.h - 2, s.w - 2, 1);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(ox + s.w - 2, oy + 1, 1, s.h - 2);

    if (s.isWall) {
      ctx.fillStyle = "#2a1a18";
      const damage = s.maxHp - s.hp;
      if (damage > 0) ctx.fillRect(ox + 6, oy + 14, 8, 2);
      if (damage > 1) ctx.fillRect(ox + 4, oy + 30, 10, 2);
      if (damage > 2) ctx.fillRect(ox + 8, oy + 44, 8, 2);
    }
  }

  function drawSpikesRect(x, y, w, h, colorA, colorB) {
    const count = Math.max(1, Math.floor(w / 4));
    const span = w / count;

    for (let i = 0; i < count; i += 1) {
      const sx = x + i * span;
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + span * 0.5, y);
      ctx.lineTo(sx + span, y + h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawContactShadowScreen(x, y, width, alpha = 0.2, stretch = 1) {
    if (!isCinematicMode()) return;
    const centerX = Math.floor(x + width * 0.5);
    const radius = Math.max(6, width * 0.65 * stretch);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(centerX, Math.floor(y));
    ctx.scale(1, 0.42);
    const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
    shadow.addColorStop(0, `rgba(0,0,0,${alpha})`);
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawContactShadowWorld(worldX, y, width, alpha = 0.2, stretch = 1) {
    drawContactShadowScreen(worldX - cameraX, y, width, alpha, stretch);
  }

  function drawHero(x, y, facing, animFrame, scale = 1, kickPose = 0) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    const step = Math.sin(animFrame * 0.28);
    const legA = Math.round(step * 1.6);
    const legB = -legA;
    const armA = -Math.round(step * 1.2);
    const armB = -armA;
    const kp = clamp(kickPose, 0, 1);
    const armKickLift = Math.round(kp * 2);
    const s = clamp(scale, 1, 1.8);
    const spriteW = 14;
    const spriteH = 25;
    const missingHearts = clamp(MAX_HEARTS - playerHearts, 0, MAX_HEARTS);
    const damageTier = Math.min(4, Math.floor(missingHearts));
    const jacketMain = damageTier >= 3 ? "#0c1018" : damageTier >= 1 ? "#10141d" : "#11151f";
    const jacketShade = damageTier >= 3 ? "#171e2b" : "#1b2230";
    const jacketEdge = damageTier >= 2 ? "#090c13" : "#0d1019";
    const sleeveMain = damageTier >= 2 ? "#0b0f18" : "#0e121d";
    const shirtMain = damageTier >= 3 ? "#dfd7d1" : "#f5f2ef";
    const shirtShade = damageTier >= 2 ? "#d5ccc6" : "#e8dfd9";

    ctx.save();
    const drawY = Math.floor(py + spriteH - spriteH * s);
    ctx.translate(px, drawY);
    ctx.scale(s, s);
    if (facing < 0) {
      ctx.translate(spriteW, 0);
      ctx.scale(-1, 1);
    }

    const paint = (color, dx, dy, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, w, h);
    };

    // Hair: fluffy side bob with bangs.
    paint("#07080d", 2, 0, 10, 1);
    paint("#08090d", 1, 1, 12, 1);
    paint("#090b11", 0, 2, 14, 2);
    paint("#0e1220", 0, 4, 14, 4);
    paint("#141a2c", 1, 5, 12, 3);
    paint("#1f2740", 2, 4, 10, 2);
    paint("#2a344e", 3, 3, 8, 1);
    paint("#3a4c6b", 4, 3, 5, 1);
    paint("#1e2a43", 3, 2, 2, 1);
    paint("#1e2a43", 9, 2, 2, 1);
    paint("#12182a", 0, 8, 3, 2);
    paint("#12182a", 11, 8, 3, 2);
    paint("#1a2136", 1, 9, 4, 2);
    paint("#1a2136", 9, 9, 4, 2);
    paint("#0a0c13", 5, 4, 4, 4);
    paint("#07090f", 6, 5, 2, 4);
    paint("#05060b", 4, 4, 1, 4);
    paint("#05060b", 8, 4, 1, 4);
    paint("#364865", 6, 3, 1, 2);
    // 天使の輪（艶のハイライト）
    paint("#2c3c5e", 3, 1, 7, 1);
    paint("#4a6391", 4, 1, 4, 1);
    paint("#7e9cc9", 5, 1, 2, 1);
    paint("#3a4f78", 2, 2, 2, 1);
    paint("#3a4f78", 10, 2, 1, 1);

    // Face: softer cute look, larger eyes, small blush.
    paint("#f8e9e1", 4, 6, 6, 6);
    paint("#edd8cd", 4, 11, 6, 1);
    paint("#fff6f1", 5, 7, 2, 1);
    paint("#fff6f1", 8, 7, 2, 1);
    paint("#2a1c1d", 5, 6, 2, 1);
    paint("#2a1c1d", 8, 6, 2, 1);
    paint("#6f4838", 5, 7, 2, 2);
    paint("#6f4838", 8, 7, 2, 2);
    paint("#7e5340", 5, 8, 2, 1);
    paint("#7e5340", 8, 8, 2, 1);
    paint("#fff8f4", 5, 7, 1, 1);
    paint("#fff8f4", 8, 7, 1, 1);
    paint("#f2c8bb", 4, 9, 1, 1);
    paint("#f2c8bb", 10, 9, 1, 1);
    paint("#c48a83", 6, 10, 2, 1);
    paint("#fffdf8", 6, 11, 1, 1);
    paint("#e3b3a8", 7, 11, 1, 1);

    // Neck + rider jacket + white inner shirt.
    paint("#f3ddd1", 6, 12, 2, 1);
    paint(jacketMain, 1, 12, 12, 8);
    paint(jacketShade, 2, 12, 10, 7);
    paint(jacketEdge, 3, 13, 3, 4);
    paint(jacketEdge, 8, 13, 3, 4);
    paint("#2b3447", 3, 13, 2, 2);
    paint("#2b3447", 9, 13, 2, 2);
    paint("#d8dde8", 2, 13, 1, 1);
    paint("#d8dde8", 11, 13, 1, 1);
    // 肩のハイライト（革ジャンの艶）とジッパーの光
    paint("#39496a", 2, 12, 3, 1);
    paint("#39496a", 9, 12, 3, 1);
    paint("#cfd9ea", 7, 15, 1, 1);
    paint("#cfd9ea", 7, 17, 1, 1);
    paint(shirtMain, 5, 14, 4, 5);
    paint(shirtShade, 5, 18, 4, 1);
    paint("#bfc8d9", 9, 14, 1, 5);
    paint("#8e99ad", 4, 19, 6, 1);
    paint("#a7b3c8", 7, 13, 1, 6);
    paint("#eff2f8", 6, 14, 1, 3);

    if (damageTier > 0) {
      paint("#090b11", 4, 15, 1, 1);
      paint("#090b11", 8, 17, 1, 1);
      paint("#07080d", 6, 19, 1, 1);
      paint("#2f191a", 9, 16, 1, 1);
    }
    if (damageTier > 1) {
      paint("#05060a", 2, 16, 2, 1);
      paint("#05060a", 10, 18, 2, 1);
      paint("#2d1718", 6, 15, 2, 1);
      paint("#2d1718", 5, 17, 1, 1);
    }
    if (damageTier > 2) {
      paint("#04050a", 1, 14, 2, 2);
      paint("#04050a", 11, 16, 2, 2);
      paint("#2a1314", 5, 14, 3, 1);
      paint("#2a1314", 7, 18, 2, 1);
    }
    if (damageTier > 3) {
      paint("#030409", 3, 12, 2, 1);
      paint("#030409", 9, 12, 2, 1);
      paint("#240f10", 6, 16, 2, 2);
      paint("#240f10", 4, 18, 1, 1);
    }

    // Arms (jacket sleeves).
    paint(sleeveMain, 0, 13 + armA + armKickLift, 2, 6);
    paint("#2b3447", 1, 14 + armA + armKickLift, 1, 3);
    paint("#f4e0d3", 0, 19 + armA + armKickLift, 2, 1);
    paint("#1c2332", 0, 14 + armA + armKickLift, 1, 4);
    paint(sleeveMain, 12, 13 + armB - armKickLift, 2, 6);
    paint("#2b3447", 12, 14 + armB - armKickLift, 1, 3);
    paint("#f4e0d3", 12, 19 + armB - armKickLift, 2, 1);
    paint("#1c2332", 13, 14 + armB - armKickLift, 1, 4);
    if (damageTier > 1) {
      paint("#05060a", 0, 16 + armA + armKickLift, 1, 2);
      paint("#05060a", 13, 15 + armB - armKickLift, 1, 2);
    }

    // Legs and boots.
    if (kp > 0.04) {
      const backLift = Math.round(kp * 1.2);
      const frontReach = Math.round(kp * 3);
      const frontRaise = Math.round(kp * 2);
      const frontLen = Math.round(kp * 2);
      const backH = Math.max(2, 3 + legA - backLift);
      const frontY = 19 - frontRaise;
      const frontH = Math.max(3, 4 + legB + frontLen);

      paint("#24345a", 3, 20, 4, backH);
      paint("#324975", 4, 20, 2, 2);
      paint("#161118", 3, 20 + backH, 4, 1);
      paint("#2b1f27", 3, 21 + backH, 4, 1);

      paint("#24345a", 7 + frontReach, frontY, 4, frontH);
      paint("#324975", 8 + frontReach, frontY, 2, 2);
      paint("#161118", 8 + frontReach, frontY + frontH, 4, 1);
      paint("#2b1f27", 8 + frontReach, frontY + frontH + 1, 4, 1);
      paint("#efe8dd", 11 + frontReach, frontY + frontH, 1, 1);
    } else {
      paint("#24345a", 3, 20, 4, 3 + legA);
      paint("#324975", 4, 20, 2, 2);
      paint("#24345a", 7, 20, 4, 3 + legB);
      paint("#324975", 8, 20, 2, 2);
      paint("#3f5688", 4, 21, 1, 1);
      paint("#3f5688", 8, 21, 1, 1);
      paint("#161118", 3, 23 + legA, 4, 1);
      paint("#161118", 7, 23 + legB, 4, 1);
      paint("#2b1f27", 3, 24 + legA, 4, 1);
      paint("#2b1f27", 7, 24 + legB, 4, 1);
      // ブーツの艶
      paint("#544a5c", 4, 23 + legA, 1, 1);
      paint("#544a5c", 8, 23 + legB, 1, 1);
    }

    // Subtle silhouette polish for readability on bright backgrounds.
    paint("#05060c", 0, 3, 1, 17);
    paint("#05060c", 13, 3, 1, 17);
    paint("#05060c", 2, 24, 10, 1);

    // ネオンのリムライト（背中側に冷色、前面に暖色）
    paint("rgba(126, 196, 255, 0.32)", 0, 4, 1, 14);
    paint("rgba(126, 196, 255, 0.16)", 1, 3, 1, 4);
    paint("rgba(255, 168, 142, 0.20)", 13, 6, 1, 12);

    ctx.restore();
  }

  function drawHeroAfterimageTrail() {
    const speed = Math.abs(player.vx || 0);
    const burstAfterimageActive = isTimeBurstActive()
      && (timeBurstMode === TIME_BURST_MODE_SLOW || timeBurstMode === TIME_BURST_MODE_STOP);
    const burstDuration = timeBurstMode === TIME_BURST_MODE_STOP
      ? TIME_BURST_STOP_DURATION
      : TIME_BURST_SLOW_MAX_DURATION;
    const burstRatio = burstAfterimageActive
      ? clamp(timeBurstTimer / Math.max(1, timeBurstDuration || burstDuration), 0, 1)
      : 0;
    const blackRatio = clamp(
      Math.max(
        blackFlashTimer > 0 ? blackFlashTimer / 52 : 0,
        blackFlashSlowTimer > 0 ? blackFlashSlowTimer / BLACK_FLASH_SLOW_DURATION : 0
      ),
      0,
      1
    );
    const invRatio = clamp(invincibleTimer / INVINCIBLE_DURATION, 0, 1);
    const rushRatio = clamp(proteinRushTimer / 90, 0, 1);
    const attackRatio = clamp(
      (attackEffectTimer > 0 ? 0.56 : 0) +
      (hyakuretsuTimer > 0 ? 0.34 : 0) +
      clamp(attackChargeTimer / ATTACK_CHARGE_MAX, 0, 1) * 0.28,
      0,
      1
    );
    const airRatio = player.onGround ? 0 : clamp(Math.abs(player.vy) / 6, 0, 1);
    const trailPower = clamp(
      (speed - 0.8) * 0.26 +
      airRatio * 0.18 +
      attackRatio * 0.34 +
      rushRatio * 0.22 +
      blackRatio * 0.46 +
      invRatio * 0.34 +
      burstRatio * 0.56,
      0,
      1
    );
    if (trailPower <= 0.02) return;

    const count = 2 + Math.floor(trailPower * 3) + (burstAfterimageActive ? 1 : 0);
    const dir = player.facing || 1;
    const sway = Math.sin(player.anim * 0.2) * 0.55;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 1) / (count + 1);
      const offsetX = dir * (1.6 + t * (4 + speed * 2.2 + trailPower * 3.4));
      const offsetY = (player.onGround ? 0 : sway) * t;
      const alpha = (
        0.07 +
        trailPower * 0.17 +
        blackRatio * 0.08 +
        burstRatio * 0.1
      ) * (1 - i / (count + 1));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(-offsetX, offsetY);
      if (invincibleTimer > 0) {
        ctx.globalCompositeOperation = "screen";
        drawInvincibleBikeRide();
      } else {
        drawHero(player.x - cameraX, player.y, player.facing, player.anim - t * 2.4, 1);
        if (burstAfterimageActive) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = `rgba(132, 244, 255, ${0.34 + burstRatio * 0.22})`;
          ctx.fillRect(player.x - cameraX - 1, player.y - 1, player.w + 2, player.h + 2);
        }
      }
      ctx.restore();
    }
  }

  function drawBoyfriend(x, y) {
    const px = Math.floor(x - cameraX);
    const py = Math.floor(y);
    const bob = Math.floor(Math.sin(player.anim * 0.14 + x * 0.02) * 0.6);
    const paint = (color, dx, dy, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(px + dx, py + dy + bob, w, h);
    };

    // Red cap silhouette.
    paint("#151a24", 2, 0, 11, 1);
    paint("#d64343", 3, 1, 9, 3);
    paint("#ba3333", 3, 4, 10, 1);
    paint("#922326", 10, 2, 3, 3);
    paint("#df5353", 4, 2, 4, 1);
    paint("#ff8181", 5, 1, 3, 1);
    paint("#7d2025", 9, 5, 5, 1);
    paint("#2a1f29", 12, 5, 2, 2);

    // Face with under-cap shadow for a more human look while keeping details subtle.
    paint("#f2d7c4", 4, 5, 7, 6);
    paint("#e6c1ad", 5, 10, 5, 1);
    paint("#2a2e3a", 4, 5, 3, 2);
    paint("#2a2e3a", 9, 6, 2, 2);
    paint("#1d2432", 6, 7, 1, 1);
    paint("#1d2432", 8, 7, 1, 1);
    paint("#f8ece4", 7, 7, 1, 1);
    paint("#7f5746", 6, 9, 2, 1);
    paint("#ddb9a4", 10, 8, 1, 2);
    paint("#f0d5c2", 6, 11, 2, 1);
    paint("#fdf3ec", 6, 6, 1, 1);
    paint("#fdf3ec", 8, 6, 1, 1);
    paint("#d7a996", 7, 10, 1, 1);

    // Hoodie + jacket torso.
    paint("#1e2737", 4, 12, 6, 2);
    paint("#d9dfea", 6, 12, 2, 1);
    paint("#2f4f7a", 3, 14, 10, 8);
    paint("#466d9e", 4, 14, 8, 4);
    paint("#2a405f", 7, 14, 1, 8);
    paint("#6d88b3", 5, 14, 5, 1);
    paint("#f1f4f8", 6, 15, 3, 4);
    paint("#d8dde4", 6, 19, 3, 1);
    paint("#9fb2d0", 7, 15, 1, 4);

    // Arms and hands.
    paint("#20293a", 1, 14, 2, 6);
    paint("#20293a", 13, 14, 2, 6);
    paint("#f0d5c2", 1, 19, 1, 2);
    paint("#f0d5c2", 14, 19, 1, 2);
    paint("#2e3b53", 2, 15, 1, 3);
    paint("#2e3b53", 13, 15, 1, 3);

    // Pants + sneakers.
    paint("#324457", 4, 22, 8, 1);
    paint("#2b3446", 4, 23, 3, 4);
    paint("#2b3446", 9, 23, 3, 4);
    paint("#1e2431", 5, 23, 1, 3);
    paint("#1e2431", 10, 23, 1, 3);
    paint("#171a22", 3, 27, 4, 1);
    paint("#171a22", 9, 27, 4, 1);
    paint("#f3f4f8", 6, 27, 1, 1);
    paint("#f3f4f8", 12, 27, 1, 1);

    // Pixel silhouette to keep him readable against mansion lights.
    paint("#0d111a", 1, 1, 1, 24);
    paint("#0d111a", 13, 1, 1, 24);
    paint("#0d111a", 3, 27, 10, 1);
  }

  function drawEnemyHpPips(enemy, x, y) {
    const maxHp = Math.max(1, Math.round(enemy.maxHp || 1));
    if (maxHp <= 1) return;
    const hp = clamp(Math.round(enemy.hp || maxHp), 0, maxHp);
    // Use bar style for higher HP enemies
    const barW = Math.min(24, Math.max(14, enemy.w + 4));
    const barH = 2;
    const startX = x + Math.floor((enemy.w - barW) * 0.5);
    const startY = y - 5;
    const ratio = hp / maxHp;
    ctx.fillStyle = "rgba(10,12,17,0.78)";
    ctx.fillRect(startX - 1, startY - 1, barW + 2, barH + 2);
    ctx.fillStyle = "#2d374a";
    ctx.fillRect(startX, startY, barW, barH);
    ctx.fillStyle = ratio > 0.5 ? "#ff7468" : ratio > 0.25 ? "#ff9944" : "#ff3333";
    ctx.fillRect(startX, startY, Math.ceil(barW * ratio), barH);
  }

  function drawEnemy(enemy) {
    if (enemy.kind === "partygoon") {
      const x = Math.floor(enemy.x - cameraX);
      const y = Math.floor(enemy.y);
      const blink = Math.floor((player.anim + enemy.x) * 0.12) % 2 === 0;
      ctx.fillStyle = "rgba(8, 12, 20, 0.36)";
      ctx.fillRect(x + 1, y + 17, 11, 2);

      ctx.fillStyle = "#171220";
      ctx.fillRect(x + 1, y, 11, 1);
      ctx.fillRect(x, y + 1, 13, 7);

      ctx.fillStyle = "#a64464";
      ctx.fillRect(x + 2, y + 1, 9, 3);
      ctx.fillStyle = "#7d3551";
      ctx.fillRect(x + 3, y + 3, 7, 1);

      ctx.fillStyle = "#f0c9b4";
      ctx.fillRect(x + 3, y + 4, 7, 4);
      ctx.fillStyle = "#201d27";
      ctx.fillRect(x + 4, y + 5, 1, 1);
      ctx.fillRect(x + 8, y + 5, 1, 1);
      ctx.fillStyle = "#8a574a";
      ctx.fillRect(x + 5, y + 6, 3, 1);

      ctx.fillStyle = "#3f2c3c";
      ctx.fillRect(x + 2, y + 8, 9, 6);
      ctx.fillStyle = "#5d4157";
      ctx.fillRect(x + 3, y + 9, 7, 2);
      ctx.fillStyle = "#8ea2c4";
      ctx.fillRect(x + 6, y + 9, 1, 4);
      ctx.fillStyle = "#cfd9eb";
      ctx.fillRect(x + 7, y + 10, 1, 2);

      ctx.fillStyle = "#2a2d3b";
      ctx.fillRect(x + 2, y + 14, 3, 2);
      ctx.fillRect(x + 8, y + 14, 3, 2);
      ctx.fillStyle = "#16161f";
      ctx.fillRect(x + 2, y + 16, 3, 1);
      ctx.fillRect(x + 8, y + 16, 3, 1);

      // ネオンのリムライト
      ctx.fillStyle = "rgba(130, 200, 255, 0.20)";
      ctx.fillRect(x, y + 2, 1, 11);
      ctx.fillStyle = "rgba(255, 150, 170, 0.16)";
      ctx.fillRect(x + 12, y + 2, 1, 11);

      if (blink) {
        const sx = enemy.dir > 0 ? x + 12 : x - 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const eg = ctx.createRadialGradient(sx, y + 5, 0.5, sx, y + 5, 4);
        eg.addColorStop(0, "rgba(184, 239, 255, 0.7)");
        eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = eg;
        ctx.fillRect(sx - 4, y + 1, 8, 8);
        ctx.fillStyle = "#dff7ff";
        ctx.fillRect(sx, y + 5, 1, 1);
        ctx.restore();
      }
      drawEnemyHpPips(enemy, x, y);
      return;
    }

    if (enemy.kind === "peacock") {
      const x = Math.floor(enemy.x - cameraX);
      const y = Math.floor(enemy.y);
      const charge = enemy.mode === "charge";
      const windup = enemy.mode === "windup";
      const dir = enemy.dir;
      ctx.fillStyle = "rgba(8, 14, 18, 0.38)";
      ctx.fillRect(x + 3, y + 17, 10, 2);

      const bodyMain = enemy.kicked ? "#36596a" : charge ? "#2a7fcb" : "#2f9ac9";
      const bodyShade = enemy.kicked ? "#24434f" : charge ? "#245f9a" : "#2c7a9f";
      const tailMain = charge ? "#2f8f76" : "#2ca171";
      const tailEye = charge ? "#8ff6dc" : "#72efc8";
      const tailGlow = windup ? "#d6ff9a" : "#95eecf";

      ctx.fillStyle = "#10161f";
      ctx.fillRect(x + 4, y + 5, 8, 9);

      const tailX = dir > 0 ? x - 3 : x + 11;
      ctx.fillStyle = tailMain;
      ctx.fillRect(tailX, y + 4, 5, 10);
      ctx.fillStyle = "#1f4f73";
      ctx.fillRect(tailX + 1, y + 5, 3, 8);
      ctx.fillStyle = tailEye;
      ctx.fillRect(tailX + 2, y + 7, 1, 2);
      ctx.fillStyle = tailGlow;
      ctx.fillRect(tailX + 1, y + 11, 3, 1);
      ctx.fillStyle = "rgba(220, 255, 238, 0.45)";
      ctx.fillRect(tailX + 1, y + 6, 1, 4);
      // 羽根の目玉が発光する
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const tg = ctx.createRadialGradient(tailX + 2, y + 8, 1, tailX + 2, y + 8, 7);
      tg.addColorStop(0, windup ? "rgba(190, 255, 170, 0.40)" : "rgba(110, 240, 200, 0.24)");
      tg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = tg;
      ctx.fillRect(tailX - 5, y + 1, 14, 14);
      ctx.restore();

      ctx.fillStyle = bodyMain;
      ctx.fillRect(x + 4, y + 8, 8, 6);
      ctx.fillStyle = bodyShade;
      ctx.fillRect(x + 5, y + 10, 6, 3);
      ctx.fillStyle = charge ? "#64d9c5" : "#57d4b8";
      ctx.fillRect(x + 7, y + 6, 3, 4);
      ctx.fillStyle = charge ? "#97eddf" : "#88e6d1";
      ctx.fillRect(x + 8, y + 7, 1, 2);

      ctx.fillStyle = "#0f1520";
      ctx.fillRect(x + 8, y + 4, 3, 3);
      ctx.fillStyle = "#d7ecff";
      ctx.fillRect(x + 9, y + 5, 1, 1);

      ctx.fillStyle = "#f0c769";
      if (dir > 0) {
        ctx.fillRect(x + 11, y + 5, 3, 2);
      } else {
        ctx.fillRect(x + 5, y + 5, 3, 2);
      }

      ctx.fillStyle = "#3d2d22";
      ctx.fillRect(x + 6, y + 14, 1, 3);
      ctx.fillRect(x + 9, y + 14, 1, 3);
      ctx.fillStyle = "#231812";
      ctx.fillRect(x + 6, y + 17, 2, 1);
      ctx.fillRect(x + 8, y + 17, 2, 1);

      if (charge) {
        const fx = dir > 0 ? x + 13 : x - 4;
        ctx.fillStyle = "rgba(190,240,255,0.45)";
        ctx.fillRect(fx, y + 9, 4, 2);
        ctx.fillStyle = "rgba(120,195,245,0.55)";
        ctx.fillRect(fx + (dir > 0 ? -4 : 4), y + 9, 3, 1);
      }
      drawEnemyHpPips(enemy, x, y);
      return;
    }

    if (enemy.kind === "bruiser") {
      const x = Math.floor(enemy.x - cameraX);
      const y = Math.floor(enemy.y);
      ctx.fillStyle = "rgba(10, 14, 20, 0.4)";
      ctx.fillRect(x + 1, y + 18, 14, 2);
      const armor = enemy.kicked ? "#3d4d63" : "#50627b";
      const armorHi = enemy.kicked ? "#586f8a" : "#7187a6";
      const armorDark = enemy.kicked ? "#2c394b" : "#38495f";
      const visor = enemy.kicked ? "#9cc8eb" : "#c4e4ff";

      ctx.fillStyle = "#0e131d";
      ctx.fillRect(x + 1, y, 14, 1);
      ctx.fillRect(x, y + 1, 16, 8);

      ctx.fillStyle = "#7b3548";
      ctx.fillRect(x + 4, y + 1, 8, 2);
      ctx.fillStyle = "#f1c6aa";
      ctx.fillRect(x + 5, y + 3, 6, 4);
      ctx.fillStyle = "#263447";
      ctx.fillRect(x + 5, y + 5, 6, 2);
      ctx.fillStyle = visor;
      ctx.fillRect(x + 6, y + 5, 1, 1);
      ctx.fillRect(x + 9, y + 5, 1, 1);
      // バイザーの発光
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const vg = ctx.createRadialGradient(x + 8, y + 5.5, 0.5, x + 8, y + 5.5, 5);
      vg.addColorStop(0, "rgba(150, 215, 255, 0.40)");
      vg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = vg;
      ctx.fillRect(x + 3, y + 1, 10, 9);
      ctx.restore();

      ctx.fillStyle = armor;
      ctx.fillRect(x + 2, y + 8, 12, 7);
      ctx.fillStyle = armorHi;
      ctx.fillRect(x + 3, y + 9, 10, 2);
      ctx.fillStyle = armorDark;
      ctx.fillRect(x + 4, y + 11, 8, 3);
      ctx.fillStyle = "#9aa9bf";
      ctx.fillRect(x + 7, y + 9, 1, 5);

      ctx.fillStyle = armorDark;
      ctx.fillRect(x + 0, y + 10, 2, 4);
      ctx.fillRect(x + 14, y + 10, 2, 4);
      ctx.fillStyle = armorHi;
      ctx.fillRect(x + 0, y + 11, 1, 2);
      ctx.fillRect(x + 15, y + 11, 1, 2);
      ctx.fillStyle = "#d5dfef";
      ctx.fillRect(x + 3, y + 9, 1, 1);
      ctx.fillRect(x + 12, y + 9, 1, 1);

      ctx.fillStyle = "#2b3346";
      ctx.fillRect(x + 3, y + 15, 4, 2);
      ctx.fillRect(x + 9, y + 15, 4, 2);
      ctx.fillStyle = "#1a1f2d";
      ctx.fillRect(x + 3, y + 17, 4, 1);
      ctx.fillRect(x + 9, y + 17, 4, 1);

      if (enemy.flash > 0) {
        const mx = enemy.dir > 0 ? x + 16 : x - 3;
        ctx.fillStyle = "#ffe8a4";
        ctx.fillRect(mx, y + 8, 2, 2);
      }
      drawEnemyHpPips(enemy, x, y);
      return;
    }

    const x = Math.floor(enemy.x - cameraX);
    const y = Math.floor(enemy.y);
    ctx.fillStyle = "rgba(8, 10, 16, 0.35)";
    ctx.fillRect(x + 2, y + 17, 10, 2);
    const coat = enemy.kicked ? "#533948" : "#3b2737";
    const coatHi = enemy.kicked ? "#6a4c5d" : "#58405a";

    ctx.fillStyle = "#111217";
    ctx.fillRect(x + 2, y, 10, 1);
    ctx.fillRect(x + 1, y + 1, 12, 8);
    ctx.fillRect(x + 2, y + 9, 10, 8);

    ctx.fillStyle = enemy.kicked ? "#68303a" : "#4f212b";
    ctx.fillRect(x + 3, y + 1, 8, 3);
    ctx.fillStyle = "#f0c2a4";
    ctx.fillRect(x + 4, y + 4, 6, 4);
    ctx.fillStyle = "#2b303e";
    ctx.fillRect(x + 5, y + 5, 1, 1);
    ctx.fillRect(x + 8, y + 5, 1, 1);
    ctx.fillStyle = "#101421";
    ctx.fillRect(x + 4, y + 8, 6, 1);

    ctx.fillStyle = coat;
    ctx.fillRect(x + 2, y + 9, 10, 6);
    ctx.fillStyle = coatHi;
    ctx.fillRect(x + 3, y + 10, 8, 2);
    ctx.fillStyle = "#7988a5";
    ctx.fillRect(x + 6, y + 10, 1, 5);
    ctx.fillStyle = "#d8dff1";
    ctx.fillRect(x + 7, y + 10, 1, 3);
    ctx.fillStyle = "#1e2535";
    ctx.fillRect(x + 1, y + 10, 2, 3);
    ctx.fillRect(x + 11, y + 10, 2, 3);

    ctx.fillStyle = "#2a3144";
    ctx.fillRect(x + 3, y + 15, 3, 2);
    ctx.fillRect(x + 8, y + 15, 3, 2);
    ctx.fillStyle = "#171822";
    ctx.fillRect(x + 3, y + 17, 3, 1);
    ctx.fillRect(x + 8, y + 17, 3, 1);

    // ネオンのリムライト
    ctx.fillStyle = "rgba(130, 200, 255, 0.18)";
    ctx.fillRect(x + 1, y + 2, 1, 11);
    ctx.fillStyle = "rgba(255, 150, 170, 0.14)";
    ctx.fillRect(x + 12, y + 2, 1, 11);

    if (enemy.flash > 0) {
      const mx = enemy.dir > 0 ? x + 13 : x - 2;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const fg = ctx.createRadialGradient(mx + 1, y + 7, 0.5, mx + 1, y + 7, 5);
      fg.addColorStop(0, "rgba(255, 200, 110, 0.55)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(mx - 4, y + 2, 10, 10);
      ctx.fillStyle = "#ffe7a2";
      ctx.fillRect(mx, y + 7, 2, 1);
      ctx.fillStyle = "#ff9053";
      ctx.fillRect(mx + (enemy.dir > 0 ? 1 : -1), y + 7, 1, 1);
      ctx.restore();
    }
    drawEnemyHpPips(enemy, x, y);
  }

  function drawPeacockBossEntity(b) {
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    const warn = b.mode === "windup" || b.mode === "dash";
    const cast = b.mode === "shoot";
    const rage = b.hp <= Math.ceil(b.maxHp * 0.4);
    ctx.fillStyle = "rgba(6, 14, 20, 0.36)";
    ctx.fillRect(x + 2, y + 36, 20, 2);

    ctx.fillStyle = "#0e1723";
    ctx.fillRect(x + 3, y + 8, 18, 18);
    ctx.fillStyle = rage ? "#2f85cf" : "#2f96d2";
    ctx.fillRect(x + 4, y + 10, 16, 14);
    ctx.fillStyle = rage ? "#76d7ff" : "#66d1ff";
    ctx.fillRect(x + 7, y + 11, 10, 5);
    ctx.fillStyle = rage ? "#2e78a8" : "#337ea8";
    ctx.fillRect(x + 6, y + 16, 12, 6);

    ctx.fillStyle = "#f5d57e";
    if (b.dir > 0) {
      ctx.fillRect(x + 20, y + 12, 5, 3);
    } else {
      ctx.fillRect(x + 1, y + 12, 5, 3);
    }

    ctx.fillStyle = "#173447";
    ctx.fillRect(x + 8, y + 6, 8, 4);
    ctx.fillStyle = "#d8f0ff";
    ctx.fillRect(x + 10, y + 7, 1, 1);
    ctx.fillStyle = "#f7fbff";
    ctx.fillRect(x + 13, y + 7, 1, 1);

    ctx.fillStyle = rage ? "#2a9a7b" : "#30a87d";
    ctx.fillRect(x - 6, y + 4, 8, 22);
    ctx.fillRect(x + 22, y + 4, 8, 22);
    ctx.fillStyle = rage ? "#8ef0d3" : "#7be9cf";
    ctx.fillRect(x - 4, y + 8, 3, 13);
    ctx.fillRect(x + 24, y + 8, 3, 13);
    ctx.fillStyle = "rgba(243, 255, 232, 0.48)";
    ctx.fillRect(x - 3, y + 9, 1, 8);
    ctx.fillRect(x + 25, y + 9, 1, 8);
    ctx.fillStyle = "#f6e0a3";
    ctx.fillRect(x - 3, y + 15, 1, 2);
    ctx.fillRect(x + 25, y + 15, 1, 2);

    ctx.fillStyle = "#2b3b55";
    ctx.fillRect(x + 7, y + 26, 4, 8);
    ctx.fillRect(x + 14, y + 26, 4, 8);
    ctx.fillStyle = "#1a2333";
    ctx.fillRect(x + 7, y + 34, 4, 2);
    ctx.fillRect(x + 14, y + 34, 4, 2);

    if (cast || warn) {
      ctx.fillStyle = "rgba(120, 224, 255, 0.38)";
      ctx.fillRect(x - 3, y + 9, 30, 10);
    }
    if (warn) {
      ctx.strokeStyle = "rgba(210, 255, 188, 0.9)";
      ctx.strokeRect(x - 2, y - 1, b.w + 4, b.h + 3);
    }
  }

  function drawPeacockHumanBossEntity(b) {
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    const warn = b.mode === "windup" || b.mode === "dash" || b.mode === "leap_prep";
    const cast = b.mode === "shoot" || b.mode === "ring";
    const rage = b.hp <= Math.ceil(b.maxHp * 0.56);
    const pulse = 0.5 + Math.sin(player.anim * 0.22) * 0.5;

    ctx.fillStyle = "rgba(8, 12, 20, 0.4)";
    ctx.fillRect(x + 2, y + 36, 20, 2);

    ctx.fillStyle = rage ? "#1d5b67" : "#1c5661";
    ctx.fillRect(x - 8, y + 8, 8, 20);
    ctx.fillRect(x + 24, y + 8, 8, 20);
    ctx.fillStyle = rage ? "#4fd8b5" : "#43cda9";
    ctx.fillRect(x - 6, y + 11, 4, 14);
    ctx.fillRect(x + 26, y + 11, 4, 14);
    ctx.fillStyle = "#f7df9e";
    ctx.fillRect(x - 5, y + 16, 1, 3);
    ctx.fillRect(x + 27, y + 16, 1, 3);

    ctx.fillStyle = "#111822";
    ctx.fillRect(x + 6, y + 0, 12, 2);
    ctx.fillStyle = rage ? "#345f8d" : "#2f5680";
    ctx.fillRect(x + 5, y + 2, 14, 6);
    ctx.fillStyle = rage ? "#7ec9ff" : "#73c0f8";
    ctx.fillRect(x + 7, y + 3, 10, 3);
    ctx.fillStyle = "#eed3bf";
    ctx.fillRect(x + 7, y + 8, 10, 6);
    ctx.fillStyle = "#272d3a";
    ctx.fillRect(x + 9, y + 10, 2, 1);
    ctx.fillRect(x + 13, y + 10, 2, 1);
    ctx.fillStyle = "#8d5f4f";
    ctx.fillRect(x + 10, y + 12, 4, 1);

    ctx.fillStyle = rage ? "#2d86a9" : "#2a7ea0";
    ctx.fillRect(x + 10, y - 2, 4, 2);
    ctx.fillStyle = "#7ee3d9";
    ctx.fillRect(x + 11, y - 3, 2, 1);

    ctx.fillStyle = rage ? "#2e3b56" : "#2a3650";
    ctx.fillRect(x + 4, y + 14, 16, 9);
    ctx.fillStyle = rage ? "#54698f" : "#4a607f";
    ctx.fillRect(x + 5, y + 15, 14, 3);
    ctx.fillStyle = "#c3d2ea";
    ctx.fillRect(x + 11, y + 15, 2, 7);
    ctx.fillStyle = "#f6f9ff";
    ctx.fillRect(x + 10, y + 18, 4, 3);

    ctx.fillStyle = "#233147";
    ctx.fillRect(x + 2, y + 16, 3, 10);
    ctx.fillRect(x + 19, y + 16, 3, 10);
    ctx.fillStyle = "#f3dac6";
    ctx.fillRect(x + 1, y + 24, 2, 2);
    ctx.fillRect(x + 21, y + 24, 2, 2);

    ctx.fillStyle = "#2e3d5c";
    ctx.fillRect(x + 7, y + 23, 4, 11);
    ctx.fillRect(x + 13, y + 23, 4, 11);
    ctx.fillStyle = "#161e2d";
    ctx.fillRect(x + 7, y + 34, 4, 2);
    ctx.fillRect(x + 13, y + 34, 4, 2);
    ctx.fillStyle = "#dce5f5";
    ctx.fillRect(x + 8, y + 24, 1, 5);
    ctx.fillRect(x + 14, y + 24, 1, 5);

    if (cast || warn) {
      ctx.fillStyle = `rgba(124, 233, 255, ${0.24 + pulse * 0.14})`;
      ctx.fillRect(x - 4, y + 10, b.w + 8, 10);
    }
    if (warn) {
      ctx.strokeStyle = rage ? "rgba(255, 186, 132, 0.94)" : "rgba(198, 255, 190, 0.9)";
      ctx.strokeRect(x - 2, y - 1, b.w + 4, b.h + 3);
    }
  }

  function drawBoss() {
    if (!stage.boss.active) return;
    const b = stage.boss;
    const x = Math.floor(b.x - cameraX);
    const y = Math.floor(b.y);
    ctx.fillStyle = "rgba(8, 12, 20, 0.34)";
    ctx.fillRect(x + 2, y + b.h + 1, Math.max(6, b.w - 4), 2);
    if (b.kind === "peacock") {
      for (const pb of getBossEntities(true).filter((boss) => boss.kind === "peacock")) {
        if (pb.hp <= 0) continue;
        drawPeacockBossEntity(pb);
      }
      return;
    }
    if (b.kind === "peacockman") {
      drawPeacockHumanBossEntity(b);
      return;
    }
    const phase2 = (b.phase || 1) >= 2;
    const transitioning = (b.phaseTransitionTimer || 0) > 0;
    const stunned = (b.stunTimer || 0) > 0;
    const advantage = (b.gimmickAdvantageTimer || 0) > 0;
    const warn = b.mode === "windup" || b.mode === "dash" || b.mode === "phase_shift";
    const cast = b.mode === "shoot" || b.mode === "ring" || b.mode === "rain" || b.mode === "spiral" || b.mode === "nova" || b.mode === "phase_shift";
    const rage = b.hp <= Math.ceil(b.maxHp * (phase2 ? 0.45 : 0.35));

    if (phase2) {
      const mantle = rage ? "#3f2737" : "#34293f";
      const mantleHi = rage ? "#61324f" : "#51406b";
      const armor = rage ? "#d0c5db" : "#bfc8dd";
      const armorHi = rage ? "#ece4f4" : "#e0e8f9";
      const mask = rage ? "#f1d1bf" : "#e9d9c8";
      const eye = rage || warn || cast ? "#ff6e7f" : "#a8d9ff";
      const aura = transitioning ? 0.48 : (advantage ? 0.4 : 0.28);

      // Outer aura shell for a clear phase change silhouette.
      ctx.fillStyle = `rgba(120, 186, 255, ${aura})`;
      ctx.fillRect(x - 5, y - 6, b.w + 10, b.h + 12);
      ctx.fillStyle = `rgba(255, 131, 162, ${0.14 + (rage ? 0.16 : 0.08)})`;
      ctx.fillRect(x - 3, y - 4, b.w + 6, b.h + 8);

      // Horned crown + head.
      ctx.fillStyle = "#10131c";
      ctx.fillRect(x + 8, y - 7, 8, 2);
      ctx.fillRect(x + 4, y - 4, 3, 3);
      ctx.fillRect(x + 17, y - 4, 3, 3);
      ctx.fillStyle = rage ? "#f7d695" : "#f0cf8a";
      ctx.fillRect(x + 9, y - 6, 6, 1);

      ctx.fillStyle = armor;
      ctx.fillRect(x + 4, y, 16, 7);
      ctx.fillStyle = armorHi;
      ctx.fillRect(x + 6, y + 1, 12, 3);
      ctx.fillStyle = mask;
      ctx.fillRect(x + 7, y + 7, 10, 7);
      ctx.fillStyle = eye;
      ctx.fillRect(x + 9, y + 9, 2, 1);
      ctx.fillRect(x + 13, y + 9, 2, 1);
      ctx.fillStyle = "#d3b09a";
      ctx.fillRect(x + 10, y + 12, 4, 1);

      // Torso + cape.
      ctx.fillStyle = armor;
      ctx.fillRect(x + 6, y + 14, 12, 6);
      ctx.fillStyle = "#93a0bc";
      ctx.fillRect(x + 11, y + 14, 2, 11);
      ctx.fillStyle = "#f2f5ff";
      ctx.fillRect(x + 11, y + 15, 1, 4);
      ctx.fillStyle = mantle;
      ctx.fillRect(x + 2, y + 18, 20, 12);
      ctx.fillStyle = mantleHi;
      ctx.fillRect(x + 3, y + 19, 18, 4);
      ctx.fillStyle = "#211a2a";
      ctx.fillRect(x - 3, y + 18, 5, 11);
      ctx.fillRect(x + 22, y + 18, 5, 11);
      ctx.fillStyle = "rgba(255, 180, 210, 0.3)";
      ctx.fillRect(x - 2, y + 20, 1, 6);
      ctx.fillRect(x + 24, y + 20, 1, 6);

      // Arms + claws.
      ctx.fillStyle = "#a6b1cb";
      ctx.fillRect(x + 1, y + 15, 3, 11);
      ctx.fillRect(x + 20, y + 15, 3, 11);
      ctx.fillStyle = rage ? "#ffd39d" : "#e9e4d1";
      ctx.fillRect(x, y + 24, 2, 3);
      ctx.fillRect(x + 22, y + 24, 2, 3);

      // Legs.
      ctx.fillStyle = "#2f3a55";
      ctx.fillRect(x + 6, y + 30, 5, 6);
      ctx.fillRect(x + 13, y + 30, 5, 6);
      ctx.fillStyle = "#121722";
      ctx.fillRect(x + 6, y + 36, 5, 1);
      ctx.fillRect(x + 13, y + 36, 5, 1);

      if (cast || warn) {
        ctx.fillStyle = "#e7c17a";
        ctx.fillRect(x + 21, y + 9, 2, 18);
        ctx.fillRect(x + 20, y + 8, 4, 2);
        ctx.fillStyle = "#ffe9c3";
        ctx.fillRect(x + 19, y + 7, 6, 1);
        ctx.fillStyle = "rgba(186, 232, 255, 0.5)";
        ctx.fillRect(x + 18, y + 8, 8, 1);
      }

      if (warn) {
        ctx.strokeStyle = rage ? "rgba(255,132,148,0.95)" : "rgba(255,220,165,0.9)";
        ctx.strokeRect(x - 3, y - 4, b.w + 6, b.h + 7);
      }

      if (transitioning) {
        const pulse = 0.36 + Math.sin(player.anim * 0.5) * 0.1;
        ctx.fillStyle = `rgba(255, 247, 206, ${pulse})`;
        ctx.fillRect(x - 1, y + 3, b.w + 2, 2);
      }

      if (stunned) {
        ctx.fillStyle = "rgba(134, 236, 255, 0.78)";
        ctx.fillRect(x + 5, y - 8, 2, 2);
        ctx.fillRect(x + 11, y - 10, 2, 2);
        ctx.fillRect(x + 17, y - 8, 2, 2);
      }
      return;
    }

    ctx.fillStyle = "#11131a";
    ctx.fillRect(x + 1, y, 22, 1);
    ctx.fillRect(x, y + 1, 24, 35);

    ctx.fillStyle = phase2 ? (rage ? "#f2b766" : "#efcd95") : (rage ? "#f3cc74" : "#e7dfb5");
    ctx.fillRect(x + 8, y - 3, 8, 2);
    ctx.fillStyle = phase2 ? "rgba(255, 214, 146, 0.5)" : "rgba(255, 231, 177, 0.45)";
    ctx.fillRect(x + 7, y - 2, 10, 1);

    ctx.fillStyle = warn ? "#f4f9ff" : (phase2 ? "#f3f0ff" : "#eaf0fb");
    ctx.fillRect(x + 4, y + 1, 16, 6);
    ctx.fillStyle = "#d7e0f2";
    ctx.fillRect(x + 5, y + 2, 14, 3);
    ctx.fillStyle = "#c2cce2";
    ctx.fillRect(x + 6, y + 6, 12, 2);

    ctx.fillStyle = "#efd7c3";
    ctx.fillRect(x + 7, y + 8, 10, 6);
    ctx.fillStyle = "#d2b29a";
    ctx.fillRect(x + 8, y + 13, 8, 1);
    ctx.fillStyle = warn || cast || rage ? "#ffd6a6" : "#b6e1ff";
    ctx.fillRect(x + 9, y + 10, 2, 1);
    ctx.fillRect(x + 13, y + 10, 2, 1);

    ctx.fillStyle = "#f1f5ff";
    ctx.fillRect(x + 8, y + 13, 8, 5);
    ctx.fillStyle = "#d9e2f3";
    ctx.fillRect(x + 9, y + 14, 6, 3);
    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(x + 10, y + 17, 4, 2);
    ctx.fillStyle = "rgba(255, 246, 218, 0.5)";
    ctx.fillRect(x + 8, y + 18, 8, 1);

    ctx.fillStyle = warn ? "#c4ccd9" : (phase2 ? "#b9b5cf" : "#b6c0d0");
    ctx.fillRect(x + 3, y + 18, 18, 11);
    ctx.fillStyle = "#d4dbe8";
    ctx.fillRect(x + 4, y + 19, 16, 4);
    ctx.fillStyle = "#8fa0ba";
    ctx.fillRect(x + 11, y + 19, 2, 10);
    ctx.fillStyle = "#7f90aa";
    ctx.fillRect(x + 1, y + 20, 2, 7);
    ctx.fillRect(x + 21, y + 20, 2, 7);

    ctx.fillStyle = "#2d3951";
    ctx.fillRect(x + 4, y + 29, 6, 6);
    ctx.fillRect(x + 14, y + 29, 6, 6);
    ctx.fillStyle = "#465777";
    ctx.fillRect(x + 5, y + 30, 4, 2);
    ctx.fillRect(x + 15, y + 30, 4, 2);
    ctx.fillStyle = "#171b25";
    ctx.fillRect(x + 4, y + 35, 6, 1);
    ctx.fillRect(x + 14, y + 35, 6, 1);

    if (cast || warn) {
      ctx.fillStyle = "#d1b36b";
      ctx.fillRect(x + 19, y + 11, 2, 14);
      ctx.fillStyle = "#f3e7bb";
      ctx.fillRect(x + 18, y + 10, 4, 2);
      ctx.fillStyle = "rgba(190, 228, 255, 0.45)";
      ctx.fillRect(x + 17, y + 9, 6, 1);
    }

    if (warn) {
      ctx.strokeStyle = "rgba(255,220,165,0.9)";
      ctx.strokeRect(x - 1, y - 2, b.w + 2, b.h + 3);
      ctx.fillStyle = "rgba(255,236,188,0.16)";
      ctx.fillRect(x + 2, y + 1, b.w - 4, b.h - 2);
    }

    if (phase2 || transitioning) {
      const auraAlpha = transitioning ? 0.42 : (advantage ? 0.34 : 0.22);
      ctx.fillStyle = `rgba(136, 223, 255, ${auraAlpha})`;
      ctx.fillRect(x - 3, y - 3, b.w + 6, 1);
      ctx.fillRect(x - 3, y + b.h + 1, b.w + 6, 1);
      ctx.fillRect(x - 3, y - 2, 1, b.h + 4);
      ctx.fillRect(x + b.w + 2, y - 2, 1, b.h + 4);
    }

    if (stunned) {
      ctx.fillStyle = "rgba(134, 236, 255, 0.74)";
      ctx.fillRect(x + 6, y - 6, 2, 2);
      ctx.fillRect(x + 11, y - 8, 2, 2);
      ctx.fillRect(x + 16, y - 6, 2, 2);
    }
  }

  function drawPickupGlow(cx, cy, r, color, pulse = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawProtein(protein) {
    if (protein.collected) return;
    const x = Math.floor(protein.x - cameraX);
    const y = Math.floor(protein.y + Math.sin(protein.bob) * 1.7);

    drawPickupGlow(x + 5, y + 6, 11, "rgba(120, 220, 255, 0.30)", Math.sin(protein.bob * 2) * 0.5 + 0.5);

    // Cap
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(x + 2, y + 0, 6, 2);
    ctx.fillStyle = "#d9b473";
    ctx.fillRect(x + 3, y + 0, 4, 1);

    // Bottle body
    ctx.fillStyle = "#11182a";
    ctx.fillRect(x + 1, y + 2, 8, 10);
    ctx.fillStyle = "#f6f9ff";
    ctx.fillRect(x + 2, y + 3, 6, 8);
    ctx.fillStyle = "#d9e1ef";
    ctx.fillRect(x + 2, y + 10, 6, 1);

    // Blue label with clear P icon
    ctx.fillStyle = "#2f7de0";
    ctx.fillRect(x + 2, y + 5, 6, 4);
    ctx.fillStyle = "#b9deff";
    ctx.fillRect(x + 3, y + 6, 1, 2);
    ctx.fillRect(x + 4, y + 6, 2, 1);
    ctx.fillRect(x + 4, y + 7, 1, 1);
    ctx.fillStyle = "#7db6ff";
    ctx.fillRect(x + 2, y + 5, 6, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 3, y + 4, 1, 1);
    ctx.fillRect(x + 7, y + 4, 1, 1);
  }

  function drawHeartPickup(item) {
    if (item.collected) return;
    const x = Math.floor(item.x - cameraX);
    const y = Math.floor(item.y + Math.sin(item.bob) * 1.5);
    const pulse = Math.floor((player.anim + item.id * 9) * 0.2) % 2 === 0;

    drawPickupGlow(x + 6, y + 6, 12, "rgba(255, 132, 168, 0.32)", pulse ? 1 : 0.4);
    ctx.fillStyle = "#261824";
    ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.fillStyle = "#d63f66";
    ctx.fillRect(x + 2, y + 1, 2, 2);
    ctx.fillRect(x + 6, y + 1, 2, 2);
    ctx.fillRect(x + 1, y + 2, 8, 4);
    ctx.fillRect(x + 2, y + 6, 6, 2);
    ctx.fillRect(x + 3, y + 8, 4, 1);
    ctx.fillStyle = "#ff86a3";
    ctx.fillRect(x + 3, y + 2, 1, 1);
    ctx.fillRect(x + 7, y + 2, 1, 1);
    ctx.fillStyle = "#ffd0dc";
    ctx.fillRect(x + 4, y + 3, 2, 1);

    if (pulse) {
      ctx.fillStyle = "#ffe1e8";
      ctx.fillRect(x - 1, y + 4, 1, 1);
      ctx.fillRect(x + 12, y + 5, 1, 1);
      ctx.fillRect(x + 5, y - 1, 1, 1);
      ctx.fillRect(x + 6, y + 11, 1, 1);
    }
  }

  function drawLifeUpItem(item) {
    if (item.collected) return;
    const x = Math.floor(item.x - cameraX);
    const y = Math.floor(item.y + Math.sin(item.bob) * 1.7);
    const blink = Math.floor((player.anim + item.id * 13) * 0.2) % 2 === 0;

    drawPickupGlow(x + 6, y + 6, 12, "rgba(156, 255, 170, 0.30)", blink ? 1 : 0.4);
    ctx.fillStyle = "#152420";
    ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.fillStyle = "#54d87f";
    ctx.fillRect(x + 2, y + 2, 8, 8);
    ctx.fillStyle = "#8ff0ac";
    ctx.fillRect(x + 3, y + 3, 6, 1);
    ctx.fillStyle = "#0f3721";
    ctx.fillRect(x + 4, y + 4, 1, 4);
    ctx.fillRect(x + 5, y + 4, 2, 1);
    ctx.fillRect(x + 5, y + 7, 2, 1);
    ctx.fillRect(x + 5, y + 5, 1, 1);
    ctx.fillStyle = "#d6ffe2";
    ctx.fillRect(x + 4, y + 4, 1, 1);
    ctx.fillRect(x + 8, y + 4, 1, 1);

    if (blink) {
      ctx.fillStyle = "#e6ffe9";
      ctx.fillRect(x - 1, y + 5, 1, 1);
      ctx.fillRect(x + 12, y + 6, 1, 1);
      ctx.fillRect(x + 6, y - 1, 1, 1);
      ctx.fillRect(x + 6, y + 11, 1, 1);
    }
  }

  function drawCheckpointToken(token) {
    if (token.collected) return;
    const x = Math.floor(token.x - cameraX);
    const y = Math.floor(token.y + Math.sin(token.bob) * 1.6);
    const blink = Math.floor((player.anim + token.id * 9) * 0.2) % 2 === 0;

    drawPickupGlow(x + 6, y + 6, 13, "rgba(255, 245, 170, 0.32)", blink ? 1 : 0.4);

    ctx.fillStyle = "#1a2032";
    ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.fillStyle = "#ffe489";
    ctx.fillRect(x + 2, y + 2, 8, 8);
    ctx.fillStyle = "#fff5cc";
    ctx.fillRect(x + 3, y + 3, 6, 6);
    ctx.fillStyle = "#d08f2b";
    ctx.fillRect(x + 4, y + 4, 1, 4);
    ctx.fillRect(x + 5, y + 4, 2, 1);
    ctx.fillRect(x + 5, y + 7, 2, 1);
    ctx.fillRect(x + 5, y + 5, 1, 1);

    if (blink) {
      ctx.fillStyle = "#fff8dc";
      ctx.fillRect(x - 1, y + 5, 2, 1);
      ctx.fillRect(x + 11, y + 6, 2, 1);
      ctx.fillRect(x + 5, y - 1, 1, 2);
      ctx.fillRect(x + 6, y + 11, 1, 2);
    }
  }

  function drawBikePickup(bike) {
    if (bike.collected) return;
    const x = Math.floor(bike.x - cameraX);
    const y = Math.floor(bike.y + Math.sin(bike.bob) * 1.9);
    const blink = Math.floor(player.anim * 0.18) % 2 === 0;

    drawPickupGlow(x + 9, y + 8, 14, "rgba(120, 220, 255, 0.26)", blink ? 1 : 0.5);
    drawPickupGlow(x + 9, y + 8, 9, "rgba(255, 95, 160, 0.18)", 1);

    ctx.fillStyle = "#0f1220";
    ctx.fillRect(x + 2, y + 9, 5, 5);
    ctx.fillRect(x + 11, y + 9, 5, 5);
    ctx.fillStyle = "#7e97cd";
    ctx.fillRect(x + 3, y + 10, 2, 2);
    ctx.fillRect(x + 12, y + 10, 2, 2);

    ctx.fillStyle = "#ff5f84";
    ctx.fillRect(x + 5, y + 8, 7, 2);
    ctx.fillRect(x + 8, y + 6, 5, 2);
    ctx.fillStyle = "#6ddfff";
    ctx.fillRect(x + 6, y + 6, 3, 2);
    ctx.fillRect(x + 11, y + 5, 3, 2);
    ctx.fillRect(x + 13, y + 4, 2, 1);
    ctx.fillStyle = "#d7f6ff";
    ctx.fillRect(x + 8, y + 5, 3, 1);
    ctx.fillStyle = "#ffd983";
    ctx.fillRect(x + 10, y + 4, 3, 1);
    ctx.fillStyle = "#101626";
    ctx.fillRect(x + 8, y + 8, 2, 2);

    if (blink) {
      ctx.fillStyle = "#ffd97d";
      ctx.fillRect(x + 8, y + 1, 3, 1);
      ctx.fillRect(x + 9, y + 0, 1, 3);
      ctx.fillStyle = "#ff82c5";
      ctx.fillRect(x - 2, y + 4, 1, 1);
      ctx.fillRect(x + 19, y + 5, 1, 1);
    }
  }

  function drawWeaponItem(item) {
    if (item.collected) return;
    const x = Math.floor(item.x - cameraX);
    const y = Math.floor(item.y + Math.sin(item.bob) * 1.6);
    const hammer = item.type === "hammer";

    ctx.fillStyle = hammer ? "#1a2236" : "#2b1821";
    ctx.fillRect(x, y, 12, 12);
    ctx.fillStyle = hammer ? "#6ab3ff" : "#ff88b0";
    ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.fillStyle = "#151928";
    ctx.fillRect(x + 2, y + 2, 8, 8);

    if (hammer) {
      ctx.fillStyle = "#dce7ff";
      ctx.fillRect(x + 3, y + 3, 6, 3);
      ctx.fillStyle = "#9eb2d8";
      ctx.fillRect(x + 4, y + 4, 4, 1);
      ctx.fillStyle = "#8a5a35";
      ctx.fillRect(x + 6, y + 5, 2, 5);
      ctx.fillStyle = "#5e3b21";
      ctx.fillRect(x + 6, y + 9, 2, 1);
      ctx.fillStyle = "rgba(222, 244, 255, 0.5)";
      ctx.fillRect(x + 2, y + 2, 1, 1);
    } else {
      ctx.fillStyle = "#ffdbe4";
      ctx.fillRect(x + 3, y + 4, 6, 4);
      ctx.fillRect(x + 8, y + 5, 2, 2);
      ctx.fillStyle = "#f3b8cc";
      ctx.fillRect(x + 4, y + 5, 4, 2);
      ctx.fillStyle = "#c97b95";
      ctx.fillRect(x + 3, y + 8, 3, 2);
      ctx.fillStyle = "#ffd89d";
      ctx.fillRect(x + 1, y + 5, 2, 1);
      ctx.fillRect(x + 0, y + 6, 2, 1);
    }
  }

  function drawHitSparks() {
    for (const spark of hitSparks) {
      const lifeRatio = clamp(spark.life / spark.maxLife, 0, 1);
      const sx = Math.floor(spark.x - cameraX);
      const sy = Math.floor(spark.y);
      if (spark.kind === "blood") {
        const size = Math.max(1, spark.size || 1);
        const alpha = clamp(0.28 + lifeRatio * 0.74, 0, 1);
        ctx.globalAlpha = alpha;
        if (spark.splatted) {
          const w = Math.max(2, spark.poolW || (size + 2));
          const h = Math.max(1, spark.poolH || 1);
          ctx.fillStyle = spark.darkColor || "#5b0812";
          ctx.fillRect(sx - Math.floor(w * 0.5), sy, w, h);
          ctx.fillStyle = spark.color;
          ctx.fillRect(
            sx - Math.floor(w * 0.35),
            sy,
            Math.max(1, Math.floor(w * 0.7)),
            1
          );
        } else {
          const stretch = Math.max(1, spark.stretch || 1);
          const w = Math.max(1, Math.round(size + Math.abs(spark.vx) * 0.9 + stretch * 0.4));
          const h = Math.max(1, Math.round(size + Math.abs(spark.vy) * 0.15));
          const ox = spark.vx >= 0 ? 0 : -Math.floor(w * 0.55);
          ctx.fillStyle = spark.darkColor || "#5b0812";
          ctx.fillRect(sx + ox, sy, w, h);
          ctx.fillStyle = spark.color;
          ctx.fillRect(
            sx + ox + Math.max(0, Math.floor(w * 0.25)),
            sy,
            Math.max(1, Math.floor(w * 0.55)),
            Math.max(1, h - 1)
          );
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (spark.kind === "streak") {
        // Elongated trail aligned to velocity direction (additive glow)
        const len = Math.max(3, Math.round(4 + Math.hypot(spark.vx, spark.vy) * 1.6));
        const dirX = spark.vx >= 0 ? 1 : -1;
        const isHorizontal = Math.abs(spark.vx) >= Math.abs(spark.vy);
        const a = 0.6 + lifeRatio * 0.4;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        if (isHorizontal) {
          const ox = dirX > 0 ? -len : 0;
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = spark.color;
          ctx.fillRect(sx + ox, sy - 1, len, 3);
          ctx.globalAlpha = a;
          ctx.fillRect(sx + ox, sy, len, 1);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(sx + ox + Math.floor(len * 0.35), sy, Math.max(1, Math.floor(len * 0.35)), 1);
        } else {
          const dirY = spark.vy >= 0 ? 1 : -1;
          const oy = dirY > 0 ? -len : 0;
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = spark.color;
          ctx.fillRect(sx - 1, sy + oy, 3, len);
          ctx.globalAlpha = a;
          ctx.fillRect(sx, sy + oy, 1, len);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(sx, sy + oy + Math.floor(len * 0.35), 1, Math.max(1, Math.floor(len * 0.35)));
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        continue;
      }
      const size = lifeRatio > 0.6 ? 2 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Soft halo around the spark core
      ctx.globalAlpha = 0.3 * lifeRatio;
      ctx.fillStyle = spark.color;
      ctx.fillRect(sx - 1, sy - 1, size + 2, size + 2);
      ctx.globalAlpha = 1;
      ctx.fillRect(sx, sy, size, size);
      // White-hot core while the spark is fresh
      if (lifeRatio > 0.75) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.restore();
    }
  }

  function drawRushAura() {
    if (proteinRushTimer <= 0 && invincibleTimer <= 0 && proteinBurstTimer <= 0) return;
    const r = clamp(proteinRushTimer / 90, 0, 1);
    const i = clamp(invincibleTimer / INVINCIBLE_DURATION, 0, 1);
    const b = clamp(proteinBurstTimer / PROTEIN_BURST_DURATION, 0, 1);
    const px = Math.floor(player.x - cameraX);
    const py = Math.floor(player.y);
    const pulse = 0.25 + Math.sin(player.anim * 0.45) * 0.12;

    if (r > 0) {
      ctx.fillStyle = `rgba(110, 230, 255, ${pulse * r})`;
      ctx.fillRect(px - 3, py - 2, player.w + 6, player.h + 4);
      ctx.fillStyle = `rgba(255, 219, 132, ${0.16 * r})`;
      ctx.fillRect(px - 1, py - 1, player.w + 2, player.h + 2);
    }

    if (i > 0) {
      const shimmer = 0.18 + Math.sin(player.anim * 0.7) * 0.06;
      ctx.fillStyle = `rgba(255, 80, 80, ${shimmer * i})`;
      ctx.fillRect(px - 6, py - 6, player.w + 12, 2);
      ctx.fillStyle = `rgba(255, 173, 72, ${shimmer * i})`;
      ctx.fillRect(px - 6, py - 3, player.w + 12, 2);
      ctx.fillStyle = `rgba(255, 235, 112, ${shimmer * i})`;
      ctx.fillRect(px - 6, py + 0, player.w + 12, 2);
      ctx.fillStyle = `rgba(95, 232, 160, ${shimmer * i})`;
      ctx.fillRect(px - 6, py + 3, player.w + 12, 2);
      ctx.fillStyle = `rgba(105, 188, 255, ${shimmer * i})`;
      ctx.fillRect(px - 6, py + 6, player.w + 12, 2);
      ctx.fillStyle = `rgba(192, 142, 255, ${shimmer * i})`;
      ctx.fillRect(px - 6, py + 9, player.w + 12, 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.26 * i})`;
      ctx.strokeRect(px - 5, py - 5, player.w + 10, player.h + 10);
    }

    if (b > 0) {
      const glow = 0.22 + Math.sin(player.anim * 0.92) * 0.08;
      const rainbowPulse = 0.5 + Math.sin(player.anim * 0.55) * 0.5;
      ctx.fillStyle = `rgba(130, 244, 255, ${glow + b * 0.26})`;
      ctx.fillRect(px - 12, py - 22, player.w + 24, player.h + 20);
      ctx.fillStyle = `rgba(255, 246, 182, ${0.18 + b * 0.16})`;
      ctx.fillRect(px - 10, py - 18, player.w + 20, player.h + 12);
      ctx.fillStyle = `rgba(255, 170, 124, ${0.12 + b * 0.14})`;
      ctx.fillRect(px - 9, py - 14, player.w + 18, player.h + 8);
      ctx.strokeStyle = `rgba(216, 252, 255, ${0.28 + b * 0.34})`;
      ctx.strokeRect(px - 11, py - 20, player.w + 22, player.h + 16);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + rainbowPulse * 0.16 * b})`;
      ctx.fillRect(px - 13, py - 24, player.w + 26, 2);
      ctx.fillRect(px - 13, py + player.h - 1, player.w + 26, 2);
      for (let i = 0; i < 6; i += 1) {
        const bandY = py - 20 + i * 4;
        const bandAlpha = 0.06 + (i % 2) * 0.03 + b * 0.06;
        const bandColor = i % 3 === 0 ? "255,120,130" : i % 3 === 1 ? "255,232,120" : "138,236,255";
        ctx.fillStyle = `rgba(${bandColor}, ${bandAlpha})`;
        ctx.fillRect(px - 14, bandY, player.w + 28, 1);
      }
    }
  }

  function drawInvincibleBikeRide() {
    if (invincibleTimer <= 0) return;
    const x = Math.floor(player.x - cameraX - 8);
    const y = Math.floor(player.y + 12 + Math.sin(player.anim * 0.24) * 0.5);
    const dir = player.facing;
    const pulse = Math.sin(player.anim * 0.34);
    const shimmer = Math.sin(player.anim * 0.28) * 0.5 + 0.5;
    const rainbow = ["#ff5f8a", "#ffb66d", "#ffe46f", "#80e79a", "#78bcff", "#bf91ff"];

    for (let i = 0; i < rainbow.length; i += 1) {
      const tail = 8 + i * 4 + pulse * 2.1;
      const tx = dir > 0 ? Math.floor(x - tail) : Math.floor(x + 30 + tail);
      ctx.fillStyle = rainbow[i];
      ctx.fillRect(tx, y - 3 + (i % 2), 5, 2);
    }

    ctx.save();
    ctx.globalAlpha = 0.23 + shimmer * 0.18;
    for (let i = 0; i < rainbow.length; i += 1) {
      ctx.fillStyle = rainbow[i];
      ctx.fillRect(x - 6 + i, y - 18 + i * 2, 40 - i * 3, 2);
    }
    ctx.restore();

    const wheelSpin = Math.floor(player.anim * 0.5) % 2;
    ctx.fillStyle = "#0d111a";
    ctx.fillRect(x + 2, y + 8, 7, 7);
    ctx.fillRect(x + 21, y + 8, 7, 7);
    ctx.fillStyle = "#7089b9";
    ctx.fillRect(x + 4 + wheelSpin, y + 10, 2, 2);
    ctx.fillRect(x + 6 - wheelSpin, y + 9, 1, 1);
    ctx.fillRect(x + 23 + wheelSpin, y + 10, 2, 2);
    ctx.fillRect(x + 25 - wheelSpin, y + 9, 1, 1);
    ctx.fillStyle = "#39435a";
    ctx.fillRect(x + 5, y + 9, 1, 4);
    ctx.fillRect(x + 24, y + 9, 1, 4);

    ctx.fillStyle = "#2a3247";
    ctx.fillRect(x + 7, y + 5, 15, 3);
    ctx.fillStyle = "#8ee4ff";
    ctx.fillRect(x + 8, y + 4, 9, 1);
    ctx.fillStyle = "#ffd995";
    ctx.fillRect(x + 17, y + 4, 3, 1);
    ctx.fillStyle = "#87a2d9";
    ctx.fillRect(x + 12, y + 3, 2, 2);
    ctx.fillStyle = "#d6f3ff";
    ctx.fillRect(x + 12, y + 2, 4, 1);
    ctx.fillStyle = "#c04f62";
    ctx.fillRect(x + 11, y + 7, 5, 1);
    ctx.fillStyle = "#d4e8ff";
    ctx.fillRect(x + 9, y + 5, 1, 1);
    ctx.fillRect(x + 15, y + 5, 1, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
    ctx.fillRect(x + 7, y + 8, 15, 1);

    // Rider-only invincible sprite so it clearly looks like Rila is riding the bike.
    const riderBounce = Math.sin(player.anim * 0.44) * 0.5;
    ctx.save();
    ctx.translate(Math.floor(x + 8), Math.floor(y - 11 + riderBounce));
    if (dir < 0) {
      ctx.translate(14, 0);
      ctx.scale(-1, 1);
    }
    const paint = (color, dx, dy, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, w, h);
    };

    // Hair: round bob silhouette.
    paint("#05070b", 2, 0, 8, 1);
    paint("#070a10", 1, 1, 10, 2);
    paint("#0b1020", 0, 3, 12, 2);
    paint("#162038", 1, 5, 10, 1);
    paint("#111a2e", 0, 6, 3, 2);
    paint("#111a2e", 9, 6, 3, 2);
    paint("#293a58", 3, 3, 5, 1);
    paint("#05070b", 5, 2, 2, 4);
    paint("#080b14", 4, 4, 1, 2);
    paint("#080b14", 7, 4, 1, 2);
    paint("#0c1220", 5, 6, 2, 1);

    // Face.
    paint("#f8e9e1", 3, 5, 6, 4);
    paint("#2a1c1d", 4, 6, 1, 1);
    paint("#2a1c1d", 7, 6, 1, 1);
    paint("#6f4838", 4, 7, 1, 1);
    paint("#6f4838", 7, 7, 1, 1);
    paint("#fff8f4", 4, 6, 1, 1);
    paint("#fff8f4", 7, 6, 1, 1);
    paint("#c48a83", 5, 8, 2, 1);
    paint("#f8efe8", 5, 5, 2, 1);

    // Front bangs overlay while riding.
    paint("#0a0f1b", 3, 5, 1, 2);
    paint("#05070b", 5, 5, 2, 2);
    paint("#0a0f1b", 8, 5, 1, 2);
    paint("#162038", 6, 5, 1, 1);
    paint("#101a2c", 4, 4, 1, 2);
    paint("#101a2c", 7, 4, 1, 2);

    // Neck + rider jacket torso.
    paint("#f3ddd1", 5, 9, 2, 1);
    paint("#0f131d", 1, 10, 10, 4);
    paint("#1a2233", 2, 10, 8, 3);
    paint("#f5f2ef", 4, 11, 3, 2);
    paint("#2b3447", 2, 10, 2, 2);
    paint("#2b3447", 8, 10, 2, 2);
    paint("#d4dae6", 2, 10, 1, 1);
    paint("#d4dae6", 9, 10, 1, 1);
    paint("#a0afc7", 6, 10, 1, 4);

    // Arms reaching handle.
    paint("#0d111a", 0, 10, 2, 3);
    paint("#0d111a", 10, 10, 2, 3);
    paint("#f4e0d3", 0, 13, 1, 1);
    paint("#f4e0d3", 11, 13, 1, 1);
    paint("#101626", 11, 9, 3, 1);
    paint("#8ee4ff", 13, 8, 1, 1);

    // Seated legs + boots on the bike.
    paint("#24345a", 4, 14, 5, 2);
    paint("#324975", 5, 14, 3, 1);
    paint("#171b24", 7, 16, 3, 1);
    paint("#2b1f27", 8, 15, 3, 1);
    paint("#060910", 0, 3, 1, 12);
    paint("#060910", 11, 3, 1, 12);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.18 + shimmer * 0.18;
    for (let i = 0; i < rainbow.length; i += 1) {
      ctx.fillStyle = rainbow[(i + Math.floor(player.anim * 0.04)) % rainbow.length];
      ctx.fillRect(x + 6, y - 20 + i * 3, 20, 2);
    }
    ctx.restore();
  }

  function drawPlayerWave(wave) {
    const x = Math.floor(wave.x - cameraX);
    const y = Math.floor(wave.y);

    if (wave.kind === "bullet") {
      ctx.fillStyle = "#ffeea8"; // Pale yellow
      ctx.fillRect(x, y, wave.w, wave.h);
      ctx.fillStyle = "#ff8800"; // Orange core
      ctx.fillRect(x + 2, y + 1, wave.w - 4, wave.h - 2);
      return;
    }
    if (wave.kind === "shotgun") {
      ctx.fillStyle = "#fffacd"; // Lemon Chiffon
      ctx.fillRect(x, y, wave.w, wave.h);
      return;
    }
    if (wave.kind === "grenade") {
      ctx.save();
      ctx.translate(x + wave.w * 0.5, y + wave.h * 0.5);
      ctx.rotate(wave.spin || 0);
      // Grenade body (round)
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#556655";
      ctx.fill();
      // Pin/highlight
      ctx.beginPath();
      ctx.arc(-1, -1, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#88aa88";
      ctx.fill();
      // Fuse spark
      const sparkAlpha = 0.5 + Math.sin((wave.spin || 0) * 4) * 0.5;
      ctx.beginPath();
      ctx.arc(3, -3, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${sparkAlpha.toFixed(2)})`;
      ctx.fill();
      ctx.restore();
      return;
    }
    if (wave.kind === "bazooka") {
      ctx.save();
      ctx.translate(x + wave.w * 0.5, y + wave.h * 0.5);
      ctx.rotate(wave.spin || 0);
      // Missile Body
      ctx.fillStyle = "#888888";
      ctx.fillRect(-6, -4, 12, 8);
      // Warhead
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(6, -4, 4, 8);
      // Fins
      ctx.fillStyle = "#555555";
      ctx.fillRect(-6, -7, 4, 3);
      ctx.fillRect(-6, 4, 4, 3);
      ctx.restore();
      return;
    }
    if (wave.kind === "explosion") {
      const progress = (wave.anim || 0) / 20;
      const radius = wave.w * (0.5 + progress * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 50, ${1 - progress})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 100, ${1 - progress})`;
      ctx.fill();
      return;
    }
    if (wave.kind === "drive") {
      const alpha = clamp(wave.ttl / 30, 0, 1);
      const dtActive = devilTriggerTimer > 0;
      const spin = wave.spin || 0;
      const pulse = 0.6 + Math.sin(spin * 3) * 0.4;
      const waveDir = wave.vx >= 0 ? 1 : -1;
      const cx_ = x + wave.w * 0.5;
      const cy_ = y + wave.h * 0.5;
      const crSize = wave.w * 1.2;

      ctx.save();
      ctx.translate(cx_, cy_);
      // Outer glow (crescent aura)
      ctx.globalAlpha = 0.2 * alpha * pulse;
      ctx.fillStyle = dtActive ? "#ff4422" : "#4488ff";
      ctx.beginPath();
      ctx.arc(0, 0, crSize * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Crescent slash shape (三日月)
      ctx.globalAlpha = 0.65 * alpha;
      ctx.fillStyle = dtActive ? "#ff8844" : "#aaddff";
      ctx.beginPath();
      const arcR = crSize * 0.5;
      const innerR = arcR * 0.55;
      // Outer arc
      ctx.arc(0, 0, arcR, -Math.PI * 0.5, Math.PI * 0.5, false);
      // Inner arc (reverse to create crescent)
      ctx.arc(waveDir * arcR * 0.25, 0, innerR, Math.PI * 0.5, -Math.PI * 0.5, true);
      ctx.closePath();
      ctx.fill();

      // Bright edge
      ctx.globalAlpha = 0.8 * alpha;
      ctx.strokeStyle = dtActive ? "#ffcc66" : "#ddeeff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -Math.PI * 0.4, Math.PI * 0.4, false);
      ctx.stroke();

      // Core glow
      ctx.globalAlpha = 0.5 * alpha * pulse;
      ctx.fillStyle = dtActive ? "#ffee88" : "#eef8ff";
      ctx.beginPath();
      ctx.arc(waveDir * 2, 0, arcR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }
    if (wave.kind === "swordwave") {
      const alpha = clamp(wave.ttl / 20, 0, 1);
      const dtActive = devilTriggerTimer > 0;
      // Ground slash wave effect
      ctx.fillStyle = dtActive
        ? `rgba(255, 60, 20, ${0.35 * alpha})`
        : `rgba(160, 200, 255, ${0.3 * alpha})`;
      ctx.fillRect(x - 2, y - 2, wave.w + 4, wave.h + 4);
      ctx.fillStyle = dtActive
        ? `rgba(255, 120, 60, ${0.6 * alpha})`
        : `rgba(200, 230, 255, ${0.5 * alpha})`;
      ctx.fillRect(x, y, wave.w, wave.h);
      // Central bright line
      ctx.fillStyle = dtActive
        ? `rgba(255, 200, 100, ${0.7 * alpha})`
        : `rgba(255, 255, 255, ${0.6 * alpha})`;
      ctx.fillRect(x + 1, y + Math.floor(wave.h * 0.4), wave.w - 2, 2);
      return;
    }

    if (wave.kind === "dreadnought") {
      const alpha = clamp(wave.ttl / 30, 0, 1);
      const dir = wave.vx >= 0 ? 1 : -1;
      // Green-gold shield wave — outer green glow, inner gold bar
      ctx.fillStyle = `rgba(34, 255, 136, ${0.28 * alpha})`;
      ctx.fillRect(x - 4, y - 4, wave.w + 8, wave.h + 8);
      ctx.fillStyle = `rgba(110, 255, 170, ${0.55 * alpha})`;
      ctx.fillRect(x, y, wave.w, wave.h);
      // Gold spear center
      ctx.fillStyle = `rgba(255, 221, 85, ${0.9 * alpha})`;
      ctx.fillRect(x + 1, y + Math.floor(wave.h * 0.45), wave.w - 2, 3);
      // Leading edge flare
      const flareX = dir > 0 ? x + wave.w - 4 : x + 1;
      ctx.fillStyle = `rgba(255, 255, 220, ${0.9 * alpha})`;
      ctx.fillRect(flareX, y + 2, 3, wave.h - 4);
      // Trailing chevrons (armor shards pattern)
      for (let i = 0; i < 3; i++) {
        const cx = dir > 0 ? x + (i * 5) : x + wave.w - (i * 5) - 3;
        ctx.fillStyle = `rgba(34, 180, 110, ${(0.4 - i * 0.1) * alpha})`;
        ctx.fillRect(cx, y + 2 + i, 3, 2);
        ctx.fillRect(cx, y + wave.h - 4 - i, 3, 2);
      }
      return;
    }

    if (wave.kind === "dreadnought_ring") {
      const alpha = clamp(wave.ttl / 28, 0, 1);
      const pulse = 0.6 + 0.4 * Math.sin(wave.phase * 0.6);
      // Hollow ring — draw rectangle outline only, growing
      const w = wave.w;
      const h = wave.h;
      const thick = Math.max(2, Math.floor(4 * pulse));
      ctx.fillStyle = `rgba(255, 221, 85, ${0.55 * alpha * pulse})`;
      // top band
      ctx.fillRect(x, y, w, thick);
      // bottom band
      ctx.fillRect(x, y + h - thick, w, thick);
      // left band
      ctx.fillRect(x, y, thick, h);
      // right band
      ctx.fillRect(x + w - thick, y, thick, h);
      // Inner softer green
      ctx.fillStyle = `rgba(34, 255, 136, ${0.28 * alpha})`;
      ctx.fillRect(x + thick, y + thick, Math.max(0, w - thick * 2), Math.max(0, h - thick * 2));
      // Corner shield studs
      ctx.fillStyle = `rgba(255, 255, 210, ${0.8 * alpha})`;
      ctx.fillRect(x, y, 3, 3);
      ctx.fillRect(x + w - 3, y, 3, 3);
      ctx.fillRect(x, y + h - 3, 3, 3);
      ctx.fillRect(x + w - 3, y + h - 3, 3, 3);
      return;
    }

    const power = clamp(wave.power || 0, 0, 1.8);
    const flareBoost = clamp((power - 1) / 0.8, 0, 1);
    const shift = Math.floor(wave.phase * 0.95) % 6;
    const coreColors = ["#78f8ff", "#90d6ff", "#a4b7ff", "#ca97ff", "#ff9acb", "#ffb39a"];
    const pulse = 0.5 + Math.sin((wave.spin || 0) * 1.8) * 0.5;
    const glowA = 0.16 + power * 0.24;
    const glowB = 0.14 + pulse * 0.18;

    if (flareBoost > 0.08) {
      ctx.fillStyle = `rgba(255, 242, 184, ${0.12 + flareBoost * 0.16})`;
      ctx.fillRect(x - 10, y - 7, wave.w + 20, wave.h + 14);
    }

    ctx.fillStyle = `rgba(120, 240, 255, ${glowA})`;
    ctx.fillRect(x - 6, y - 5, wave.w + 12, wave.h + 10);
    ctx.fillStyle = `rgba(220, 190, 255, ${glowB})`;
    ctx.fillRect(x - 3, y - 2, wave.w + 6, wave.h + 4);

    for (let i = 0; i < 4; i += 1) {
      const c = coreColors[(shift + i * 2) % coreColors.length];
      const inset = i + 1;
      const alpha = 0.92 - i * 0.2;
      ctx.fillStyle = c;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x + inset, y + inset, Math.max(1, wave.w - inset * 2), Math.max(1, wave.h - inset * 2));
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.2})`;
    ctx.fillRect(x + 2, y + Math.floor(wave.h * 0.5), Math.max(2, wave.w - 4), 1);
    ctx.fillRect(x + Math.floor(wave.w * 0.5), y + 1, 1, Math.max(2, wave.h - 2));

    for (let i = 0; i < 6; i += 1) {
      const off = Math.sin((wave.spin || 0) + i * 1.7) * (3 + power * 2);
      const ry = y + 1 + i;
      const rx = wave.vx >= 0 ? x + wave.w + 1 : x - 2;
      ctx.fillStyle = `rgba(155, 242, 255, ${0.22 + power * 0.12})`;
      ctx.fillRect(Math.floor(rx + off), ry, 1, 1);
    }

    const trailDir = wave.vx >= 0 ? -1 : 1;
    for (let i = 0; i < 5; i += 1) {
      const len = 7 + i * 4 + power * 6;
      const tx = x + (trailDir > 0 ? wave.w : -len);
      const ty = y + i;
      ctx.fillStyle = `rgba(255, 230, 170, ${0.34 - i * 0.06})`;
      ctx.fillRect(Math.floor(tx + trailDir * i * 2), ty, Math.floor(len), 1);
    }

    for (let i = 0; i < 4; i += 1) {
      const sparkLen = 4 + i * 2 + power * 2;
      const sy = y + Math.floor(wave.h * 0.5) + (i - 1);
      const sx = wave.vx >= 0 ? x - sparkLen - i * 2 : x + wave.w + i * 2;
      ctx.fillStyle = `rgba(190, 252, 255, ${0.28 - i * 0.05})`;
      ctx.fillRect(Math.floor(sx), sy, Math.floor(sparkLen), 1);
    }
  }

  function drawWaveBursts() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const burst of waveBursts) {
      const ratio = clamp(burst.life / burst.maxLife, 0, 1);
      const cx = Math.floor(burst.x - cameraX);
      const cy = Math.floor(burst.y);

      if (burst.kind === "shock") {
        // Rapid expanding shockwave ring used by hit impacts
        const expand = 1 - ratio;
        const r = Math.max(3, burst.radius + expand * 18);
        // 中心の熱グロー
        const heat = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
        heat.addColorStop(0, `rgba(255, 210, 140, ${0.30 * ratio})`);
        heat.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = heat;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.strokeStyle = `rgba(255, 244, 200, ${0.85 * ratio})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 188, 120, ${0.45 * ratio})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        // Cross gleam
        const gleam = 0.6 * ratio;
        ctx.fillStyle = `rgba(255, 255, 255, ${gleam})`;
        ctx.fillRect(cx - r - 3, cy, 3, 1);
        ctx.fillRect(cx + r, cy, 3, 1);
        ctx.fillRect(cx, cy - r - 3, 1, 3);
        ctx.fillRect(cx, cy + r, 1, 3);
        continue;
      }

      const r = Math.max(2, burst.radius * (1 - (1 - ratio) * 0.22));
      ctx.strokeStyle = `rgba(140, 240, 255, ${0.35 * ratio})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.floor(cx - r), Math.floor(cy - r * 0.6), Math.floor(r * 2), Math.floor(r * 1.2));
      ctx.strokeStyle = `rgba(255, 232, 170, ${0.24 * ratio})`;
      ctx.strokeRect(Math.floor(cx - r * 0.7), Math.floor(cy - r * 0.4), Math.floor(r * 1.4), Math.floor(r * 0.8));

      for (let i = 0; i < 8; i += 1) {
        const ang = burst.phase + (Math.PI * 2 * i) / 8;
        const sx = Math.floor(cx + Math.cos(ang) * (r * 0.3));
        const sy = Math.floor(cy + Math.sin(ang) * (r * 0.2));
        const ex = Math.floor(cx + Math.cos(ang) * (r * 0.9));
        const ey = Math.floor(cy + Math.sin(ang) * (r * 0.6));
        ctx.strokeStyle = `rgba(185, 245, 255, ${0.22 * ratio})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBurstMeteors() {
    if (!stage.burstMeteors || stage.burstMeteors.length === 0) return;

    for (const meteor of stage.burstMeteors) {
      const x = Math.floor(meteor.x - cameraX);
      const groundY = Math.floor(stage.groundY - 1);
      const pulse = 0.5 + Math.sin((meteor.pulse || 0) * 3.2) * 0.5;
      const radius = meteor.radius || 24;

      if (meteor.state === "warn") {
        const alpha = 0.22 + pulse * 0.28;
        ctx.fillStyle = `rgba(255, 188, 112, ${alpha})`;
        ctx.fillRect(x - 2, 24, 4, groundY - 24);
        ctx.fillStyle = `rgba(255, 86, 70, ${0.28 + pulse * 0.2})`;
        ctx.fillRect(x - Math.floor(radius * 0.7), groundY - 2, Math.floor(radius * 1.4), 2);
        ctx.fillStyle = `rgba(255, 235, 160, ${0.2 + pulse * 0.18})`;
        ctx.fillRect(x - Math.floor(radius * 0.45), groundY - 1, Math.floor(radius * 0.9), 1);
        continue;
      }

      if (meteor.state === "fall") {
        const y = Math.floor(meteor.y);
        const trailH = Math.max(8, Math.floor(18 + meteor.power * 8));
        ctx.fillStyle = "rgba(255, 154, 96, 0.45)";
        ctx.fillRect(x - 2, y - trailH, 4, trailH);
        ctx.fillStyle = "rgba(255, 222, 156, 0.34)";
        ctx.fillRect(x - 1, y - trailH - 6, 2, trailH + 6);
        ctx.fillStyle = "#6a3942";
        ctx.fillRect(x - 3, y - 4, 6, 6);
        ctx.fillStyle = "#a64d58";
        ctx.fillRect(x - 2, y - 3, 4, 4);
        ctx.fillStyle = "#ffd8ac";
        ctx.fillRect(x - 1, y - 2, 2, 2);
        continue;
      }

      if (meteor.state === "boom") {
        const lifeRatio = clamp(meteor.life / (18 + meteor.power * 7), 0, 1);
        const burstR = radius * (1.15 + (1 - lifeRatio) * 0.42);
        const y = groundY - Math.floor(4 + (1 - lifeRatio) * 3);
        ctx.fillStyle = `rgba(255, 132, 82, ${0.2 + lifeRatio * 0.28})`;
        ctx.fillRect(Math.floor(x - burstR), y - 4, Math.floor(burstR * 2), 4);
        ctx.fillStyle = `rgba(255, 228, 170, ${0.18 + lifeRatio * 0.24})`;
        ctx.fillRect(Math.floor(x - burstR * 0.72), y - 2, Math.floor(burstR * 1.44), 2);
      }
    }
  }

  function drawInvincibleBonusPops() {
    if (invincibleBonusPops.length === 0) return;

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    for (const pop of invincibleBonusPops) {
      const lifeRatio = clamp(pop.life / pop.maxLife, 0, 1);
      const sx = Math.floor(pop.x - cameraX);
      const sy = Math.floor(pop.y - (1 - lifeRatio) * 10);
      const alpha = clamp(0.25 + lifeRatio * 1.05, 0, 1);
      const wobble = Math.sin(pop.phase * 0.9) * 1.5;
      const glowW = 33;

      ctx.globalAlpha = alpha * 0.72;
      ctx.fillStyle = "#153147";
      ctx.fillRect(sx - 14, sy - 8, glowW, 9);
      ctx.fillStyle = "#3f88b6";
      ctx.fillRect(sx - 13, sy - 7, glowW - 2, 1);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffe38e";
      ctx.fillText("+1sec", sx - 10 + wobble, sy - 7);
      ctx.fillStyle = "#fff6d8";
      ctx.fillText("+1sec", sx - 11 + wobble, sy - 8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(sx - 16 + Math.floor(wobble), sy - 5, 2, 1);
      ctx.fillRect(sx + 18 + Math.floor(wobble), sy - 6, 2, 1);
      ctx.fillRect(sx + 3 + Math.floor(wobble), sy - 10, 1, 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawAutoWeaponEffects() {
    const inPlayableState = gameState === STATE.PLAY || gameState === STATE.BOSS;
    if (!inPlayableState) return;

    const cx = Math.floor(player.x - cameraX + player.w * 0.5);
    const cy = Math.floor(player.y + player.h * 0.55);
    const dir = player.facing;

    const showingChargeReach = input.attack && attackCooldown <= 0 && attackChargeTimer > ATTACK_COMBO_TAP_MAX;
    if (showingChargeReach) {
      const chargeRatio = clamp(attackChargeTimer / ATTACK_CHARGE_MAX, 0, 1);
      const waveReady = attackChargeTimer >= ATTACK_WAVE_CHARGE_MIN;
      const morningStarSpinReady = attackChargeTimer >= ATTACK_MORNINGSTAR_SPIN_MIN && attackChargeTimer < ATTACK_MORNINGSTAR_CHARGE_MIN;
      const morningStarReady = attackChargeTimer >= ATTACK_MORNINGSTAR_CHARGE_MIN && attackChargeTimer < ATTACK_WAVE_CHARGE_MIN;
      const morningStarLongReady = attackChargeTimer >= ATTACK_MORNINGSTAR_LONG_MIN && attackChargeTimer < ATTACK_WAVE_CHARGE_MIN;
      const auraA = 0.12 + chargeRatio * 0.2;
      const auraB = 0.1 + chargeRatio * 0.18;
      const pulse = 0.5 + Math.sin(player.anim * 0.3) * 0.5;
      const auraW = 20 + Math.floor(chargeRatio * 12);
      const auraH = 18 + Math.floor(chargeRatio * 8);

      ctx.fillStyle = `rgba(120, 225, 255, ${auraA + pulse * 0.08})`;
      ctx.fillRect(cx - Math.floor(auraW * 0.5), cy - Math.floor(auraH * 0.6), auraW, auraH);
      ctx.fillStyle = `rgba(255, 198, 130, ${auraB})`;
      ctx.fillRect(cx - Math.floor((auraW - 6) * 0.5), cy - Math.floor((auraH - 6) * 0.6), auraW - 6, auraH - 6);

      const barW = 28;
      const barX = cx - Math.floor(barW * 0.5);
      const barY = Math.floor(player.y - 7);
      ctx.fillStyle = "rgba(8, 14, 25, 0.84)";
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = chargeRatio >= ATTACK_WAVE_CHARGE_MIN / ATTACK_CHARGE_MAX
        ? "#ffcf72"
        : morningStarReady
          ? "#d6f5ff"
          : morningStarSpinReady
            ? "#ffe0b7"
            : "#89e4ff";
      ctx.fillRect(barX + 1, barY + 1, Math.max(1, Math.floor((barW - 2) * chargeRatio)), 2);

      // Enhanced Morning Star Visual Indicator (Tip & Range)
      if (false && attackChargeTimer > 0) {
        const rankBoost = battleRankAttackBoost();
        const rankRangeMul = rankBoost.rangeMul;

        // Calculate Reach (Replicated from releaseChargeAttack)
        let baseReach = 0;
        if (attackChargeTimer >= ATTACK_CHARGE_MAX - 1) baseReach = 45 + Math.floor(chargeRatio * 10);
        else if (morningStarReady) {
          baseReach = 20 + Math.floor(chargeRatio * 18) + (morningStarLongReady ? 10 : 0);
        } else if (morningStarSpinReady) {
          baseReach = 12 + Math.floor(chargeRatio * 12);
        } else {
          baseReach = 12 + Math.floor(chargeRatio * 50);
        }

        const reach = Math.max(10, Math.floor(baseReach * rankRangeMul));
        const tipX = cx + dir * reach;
        const tipY = cy + 4; // Waist/Hand height

        // Draw Range Line
        ctx.beginPath();
        ctx.moveTo(cx, tipY);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; // visible but not distraction
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Tip Circle
        const tipRadius = maxChargeMorningStar ? 6 : 4;
        ctx.beginPath();
        ctx.arc(tipX, tipY, tipRadius, 0, Math.PI * 2);
        ctx.fillStyle = maxChargeMorningStar ? "rgba(255, 50, 50, 0.7)" : morningStarLongReady ? "rgba(255, 170, 0, 0.6)" : "rgba(255, 255, 100, 0.6)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();

        // If spinning, draw a faint circle path
        if (morningStarSpinReady && !morningStarReady) {
          ctx.beginPath();
          ctx.arc(cx, cy, reach, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.stroke();
        }
      }

      if (chargeRatio >= 0.98) {
        for (let i = 0; i < 8; i += 1) {
          const ang = (Math.PI * 2 * i) / 8 + player.anim * 0.1;
          const len = 12 + (i % 2) * 4;
          const ex = Math.floor(cx + Math.cos(ang) * len);
          const ey = Math.floor(cy - 4 + Math.sin(ang) * len * 0.6);
          ctx.strokeStyle = `rgba(168, 242, 255, ${0.32 - (i % 2) * 0.06})`;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 4);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }
    }

    // --- New: Gunner Charge Visuals ---
    if (playerStyle === "gunner" && shotChargeTimer > 0) {
      const chargeRatio = clamp(shotChargeTimer / SHOT_CHARGE_MAX, 0, 1);
      const auraA = 0.1 + chargeRatio * 0.15;
      const pulse = 0.5 + Math.sin(player.anim * 0.4) * 0.5;
      const auraW = 22 + Math.floor(chargeRatio * 10);
      const auraH = 20 + Math.floor(chargeRatio * 6);

      // Blue Aura for Gunner
      ctx.fillStyle = `rgba(80, 200, 255, ${auraA + pulse * 0.08})`;
      ctx.fillRect(cx - Math.floor(auraW * 0.5), cy - Math.floor(auraH * 0.6), auraW, auraH);

      // Charge Bar
      const barW = 28;
      const barX = cx - Math.floor(barW * 0.5);
      const barY = Math.floor(player.y - 8);
      ctx.fillStyle = "rgba(4, 8, 20, 0.88)";
      ctx.fillRect(barX, barY, barW, 4);

      // Color by Tier
      let barColor = "#00ffaa"; // Tier 1: Machinegun
      if (shotChargeTimer >= SHOT_CHARGE_MAX) barColor = "#ff77ff"; // Tier 3: Bazooka
      else if (shotChargeTimer >= SHOT_TIER2_THRESHOLD) barColor = "#ffd040"; // Tier 2: Shotgun

      ctx.fillStyle = barColor;
      ctx.fillRect(barX + 1, barY + 1, Math.max(1, Math.floor((barW - 2) * chargeRatio)), 2);
    }

    const showingHammerCharge = input.attack2 && attackCooldown <= 0 && attack2ChargeTimer > 2;
    if (showingHammerCharge) {
      const chargeRatio2 = clamp(attack2ChargeTimer / ATTACK2_CHARGE_MAX, 0, 1);
      const breakReady = attack2ChargeTimer >= ATTACK2_BREAK_CHARGE_MIN;
      const barW2 = 26;
      const barX2 = cx - Math.floor(barW2 * 0.5);
      const barY2 = Math.floor(player.y - 12);
      ctx.fillStyle = "rgba(18, 12, 10, 0.88)";
      ctx.fillRect(barX2, barY2, barW2, 4);
      ctx.fillStyle = breakReady ? "#ffd08a" : "#ff9a78";
      ctx.fillRect(barX2 + 1, barY2 + 1, Math.max(1, Math.floor((barW2 - 2) * chargeRatio2)), 2);

      const groundW = 20 + Math.floor(chargeRatio2 * 18);
      const groundH = 10 + Math.floor(chargeRatio2 * 5);
      const gx = dir > 0 ? cx + 3 : cx - groundW - 3;
      const gy = cy + 8;
      const alpha = 0.08 + chargeRatio2 * 0.11;
      ctx.fillStyle = `rgba(255, 153, 120, ${alpha})`;
      ctx.fillRect(gx, gy - Math.floor(groundH * 0.5), groundW, groundH);
      ctx.strokeStyle = `rgba(255, 210, 182, ${0.1 + chargeRatio2 * 0.14})`;
      ctx.strokeRect(gx, gy - Math.floor(groundH * 0.5), groundW, groundH);
    }

    if (attackEffectTimer <= 0) return;

    const mode = attackEffectMode;
    const comboStage = mode.startsWith("combo")
      ? clamp(parseInt(mode.slice(5), 10) || 0, 0, ATTACK_MASH_TRIGGER - 1)
      : 0;
    const isWave = mode === "wave";
    const isHyakuretsu = mode === "hyakuretsu";
    const isMorningStarSpin = mode === "morningstar_spin";
    const isMorningStar = mode === "morningstar";
    const isShoryu = mode === "shoryu";
    const isHammer = mode === "hammer";
    const isSword = mode === "sword";
    const isCombo = comboStage > 0;
    const comboMove = isCombo
      ? (comboStage === 1 ? "punch" : comboStage === 2 ? "kick" : "upper")
      : "none";
    const effectDuration = isSword ? 14 : isHammer ? 22 : isWave ? 16 : isHyakuretsu ? 6 : isMorningStarSpin ? 18 : isMorningStar ? 16 : isShoryu ? 18 : isCombo ? 8 + comboStage * 2 : 11;
    const ratio = clamp(attackEffectTimer / effectDuration, 0, 1);
    const effectPower = clamp(attackEffectPower, 0, 1.8);
    const visualPower = effectPower <= 1 ? effectPower : 1 + (effectPower - 1) * 0.72;
    const flashyBoost = clamp((effectPower - 1) / 0.8, 0, 1);
    if (isHammer) {
      const swing = clamp(1 - ratio, 0, 1);
      const arcLen = Math.floor(18 + effectPower * 18 + swing * 6);
      const anchorX = dir > 0 ? cx + 5 : cx - 5;
      const anchorY = cy - 10;
      const headX = dir > 0 ? anchorX + arcLen : anchorX - arcLen;
      const headY = anchorY + Math.floor(10 + swing * 12);

      for (let i = 0; i < 6; i += 1) {
        const t = i / 5;
        const lx = Math.round(anchorX + (headX - anchorX) * t);
        const ly = Math.round(anchorY + (headY - anchorY) * t + Math.sin((t + swing) * Math.PI) * 2);
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 168, 136, 0.55)" : "rgba(255, 216, 168, 0.44)";
        ctx.fillRect(lx, ly, 2, 1);
      }

      const hammerW = 8;
      const hammerH = 5;
      const hx = headX - Math.floor(hammerW * 0.5);
      const hy = headY - Math.floor(hammerH * 0.5);
      ctx.fillStyle = "#4f586e";
      ctx.fillRect(hx, hy, hammerW, hammerH);
      ctx.fillStyle = "#a8b4ca";
      ctx.fillRect(hx + 1, hy + 1, hammerW - 2, hammerH - 2);
      ctx.fillStyle = "#dce6f8";
      ctx.fillRect(hx + 2, hy + 1, 2, 1);
      ctx.fillStyle = "rgba(255, 186, 132, 0.48)";
      ctx.fillRect(hx - 4, hy + 2, hammerW + 8, 1);
      return;
    }
    if (isSword) {
      // Draw proper sword blade with slash trail (DMC style)
      const swing = clamp(1 - ratio, 0, 1);
      const bladeLen = Math.floor(22 + visualPower * 14 + swing * 5);
      const anchorX = dir > 0 ? cx + 3 : cx - 3;
      const anchorY = cy + 2;
      const dtActive = devilTriggerTimer > 0;
      // Wider swing arc for more dramatic slash
      const baseAngle = dir > 0
        ? -1.2 + swing * 2.0
        : Math.PI + 1.2 - swing * 2.0;
      const tipX = Math.round(anchorX + Math.cos(baseAngle) * bladeLen);
      const tipY = Math.round(anchorY + Math.sin(baseAngle) * bladeLen);

      // Slash trail arc (wide crescent)
      if (swing > 0.1) {
        const trailAlpha = (swing - 0.1) * 0.7 * ratio;
        ctx.save();
        ctx.globalAlpha = trailAlpha;
        ctx.strokeStyle = dtActive ? "#ff4422" : "#88bbff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const startA = dir > 0 ? -1.2 : Math.PI + 1.2;
        const endA = baseAngle;
        ctx.arc(anchorX, anchorY, bladeLen * 0.85, startA, endA, dir < 0);
        ctx.stroke();
        // Inner brighter trail
        ctx.strokeStyle = dtActive ? "#ffaa66" : "#cceeff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, bladeLen * 0.75, startA, endA, dir < 0);
        ctx.stroke();
        ctx.restore();
      }

      // Blade body: tapered sword shape
      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.rotate(baseAngle);
      // Blade outline
      ctx.fillStyle = dtActive
        ? `rgba(200, 60, 30, ${(ratio * 0.5).toFixed(2)})`
        : `rgba(140, 170, 220, ${(ratio * 0.45).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(bladeLen * 0.85, -1);
      ctx.lineTo(bladeLen, 0);
      ctx.lineTo(bladeLen * 0.85, 1);
      ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
      // Blade core (bright edge)
      ctx.fillStyle = dtActive
        ? `rgba(255, 200, 120, ${(ratio * 0.7).toFixed(2)})`
        : `rgba(220, 240, 255, ${(ratio * 0.65).toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(2, -1);
      ctx.lineTo(bladeLen * 0.8, 0);
      ctx.lineTo(2, 1);
      ctx.closePath();
      ctx.fill();
      // Guard crosspiece
      ctx.fillStyle = dtActive ? "#cc8844" : "#8899aa";
      ctx.fillRect(-1, -3, 3, 6);
      ctx.restore();

      // Tip sparkle
      const tipAlpha = ratio * 0.9;
      ctx.fillStyle = dtActive
        ? `rgba(255, 180, 80, ${tipAlpha.toFixed(2)})`
        : `rgba(255, 255, 255, ${tipAlpha.toFixed(2)})`;
      ctx.fillRect(tipX - 1, tipY - 1, 3, 3);
      return;
    }
    if (isMorningStarSpin) {
      const swing = clamp(1 - ratio, 0, 1);
      const spin = attackEffectPhase * 1.85 + swing * 1.9;
      const radius = 14 + visualPower * 15 + swing * 3;
      const anchorX = cx;
      const anchorY = cy + 3;
      const tipX = Math.round(anchorX + Math.cos(spin) * radius);
      const tipY = Math.round(anchorY + Math.sin(spin) * radius * 0.72);

      const chainLinks = 7;
      for (let i = 0; i <= chainLinks; i += 1) {
        const t = i / chainLinks;
        const lx = Math.round(anchorX + (tipX - anchorX) * t);
        const ly = Math.round(anchorY + (tipY - anchorY) * t + Math.sin(t * Math.PI) * 0.7);
        ctx.fillStyle = i % 2 === 0 ? "#ccc7bb" : "#948f84";
        ctx.fillRect(lx - 1, ly - 1, 3, 2);
      }

      const ballX = tipX - 3;
      const ballY = tipY - 3;
      const pulse = 0.5 + Math.sin((attackEffectPhase + visualPower * 3.2) * 1.05) * 0.5;
      ctx.fillStyle = "#5f5a54";
      ctx.fillRect(ballX, ballY, 7, 7);
      ctx.fillStyle = "#8f887f";
      ctx.fillRect(ballX + 1, ballY + 1, 5, 5);
      ctx.fillStyle = "#e2ddd1";
      ctx.fillRect(ballX + 2, ballY + 1, 2, 1);

      const spikeColor = `rgba(240, 246, 255, ${0.72 + pulse * 0.2})`;
      ctx.fillStyle = spikeColor;
      ctx.fillRect(ballX + 3, ballY - 2, 1, 2);
      ctx.fillRect(ballX + 3, ballY + 7, 1, 2);
      ctx.fillRect(ballX - 2, ballY + 3, 2, 1);
      ctx.fillRect(ballX + 7, ballY + 3, 2, 1);
      ctx.fillRect(ballX + 1, ballY + 1, 1, 1);
      ctx.fillRect(ballX + 5, ballY + 1, 1, 1);
      ctx.fillRect(ballX + 1, ballY + 5, 1, 1);
      ctx.fillRect(ballX + 5, ballY + 5, 1, 1);

      ctx.strokeStyle = `rgba(255, 226, 182, ${0.3 + pulse * 0.12})`;
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, radius + 1, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (isShoryu) {
      const rise = clamp(1 - ratio, 0, 1);
      const topY = cy - 18 - Math.floor((1 - rise) * 12);
      const laneCount = 6 + Math.floor(flashyBoost * 4);
      for (let i = 0; i < laneCount; i += 1) {
        const lane = i - Math.floor(laneCount * 0.5);
        const laneShift = lane * 2;
        const laneLen = 8 + Math.floor(visualPower * 5) - Math.abs(lane);
        const sy = topY + i * 3;
        const sx = dir > 0 ? cx + 5 + laneShift : cx - 13 - laneShift;
        const alpha = clamp(0.68 - i * 0.08 + flashyBoost * 0.16, 0.12, 0.9);
        ctx.fillStyle = `rgba(255, 216, 148, ${alpha})`;
        ctx.fillRect(sx, sy, Math.max(3, laneLen), 2);
        ctx.fillStyle = `rgba(255, 245, 216, ${Math.max(0.08, alpha - 0.22)})`;
        ctx.fillRect(sx + 1, sy, Math.max(1, laneLen - 2), 1);
      }

      const arcPulse = 0.5 + Math.sin((attackEffectPhase + visualPower * 2.4) * 1.1) * 0.5;
      const fistX = dir > 0 ? cx + 13 : cx - 19;
      const fistY = topY - 3;
      ctx.fillStyle = "#f5ddcf";
      ctx.fillRect(fistX, fistY, 7, 4);
      ctx.fillStyle = "#2a3348";
      ctx.fillRect(fistX + 1, fistY - 1, 4, 1);
      ctx.fillStyle = `rgba(160, 232, 255, ${0.2 + arcPulse * 0.24})`;
      ctx.fillRect(fistX - 7, fistY + 1, 18, 1);
      ctx.fillStyle = `rgba(255, 218, 152, ${0.28 + arcPulse * 0.2})`;
      ctx.fillRect(fistX - 2, fistY - 5, 8, 3);
      return;
    }
    const baseReach = isWave
      ? 34 + visualPower * 18
      : isHyakuretsu
        ? 14 + visualPower * 10
        : isMorningStar
          ? 22 + visualPower * 28
          : isCombo
            ? 12 + comboStage * 4 + (comboMove === "kick" ? 3 : comboMove === "upper" ? 1 : 0) + visualPower * 6
            : 10 + visualPower * 50;
    const reach = baseReach * (1 + flashyBoost * 0.28);
    const frontX = dir > 0 ? cx + 7 : cx - 7;
    const baseY = isWave
      ? cy - 1
      : isMorningStar
        ? cy + 5
        : isCombo
          ? (comboMove === "kick" ? cy + 4 : comboMove === "upper" ? cy + 1 : cy + 1)
          : cy + 1;
    const extraLines = isHyakuretsu
      ? Math.floor(flashyBoost * 6)
      : isMorningStar
        ? Math.floor(flashyBoost * 3)
        : Math.floor(flashyBoost * 4);
    const lineCount = (isHyakuretsu ? 9 : isMorningStar ? 6 : isCombo ? (comboMove === "upper" ? 5 : 4) : 4) + extraLines;

    if (!isMorningStar) {
      for (let i = 0; i < lineCount; i += 1) {
        const spread = isHyakuretsu
          ? Math.floor(i / 3) * 4 + ((hyakuretsuLaneTick + i) % 2)
          : isCombo
            ? comboMove === "kick"
              ? i * 3 + Math.floor((1 - ratio) * 3)
              : comboMove === "upper"
                ? i + Math.floor((1 - ratio) * 4)
                : i * 2 + Math.floor((1 - ratio) * 4)
            : i * 2 + Math.floor((1 - ratio) * 5);
        const lenBase = isHyakuretsu
          ? reach - Math.floor(i / 3) * 2
          : isCombo
            ? comboMove === "kick"
              ? reach - i * 3
              : comboMove === "upper"
                ? reach - i * 2
                : reach - i * 4
            : reach - i * 4;
        const len = lenBase + Math.sin((attackEffectPhase + i) * (isHyakuretsu ? 1.4 : 0.8)) * 2;
        const alphaBase = isHyakuretsu ? 0.68 - Math.floor(i / 3) * 0.08 : 0.55 - i * 0.1;
        const alpha = clamp(alphaBase + flashyBoost * 0.12, 0.08, 0.9);
        const sx = dir > 0 ? frontX + spread : frontX - len - spread;
        const sy = baseY - 3 + (
          isHyakuretsu
            ? (i % 3) * 4 + ((hyakuretsuLaneTick + i) % 2)
            : isCombo
              ? comboMove === "kick"
                ? i + 1
                : comboMove === "upper"
                  ? -i * 2
                  : i * 2
              : i * 2
        );
        if (isWave) {
          ctx.fillStyle = `rgba(140, 215, 255, ${alpha})`;
        } else if (isHyakuretsu) {
          const laneTone = i % 3 === 0 ? "255, 199, 148" : i % 3 === 1 ? "255, 179, 136" : "255, 162, 130";
          ctx.fillStyle = `rgba(${laneTone}, ${alpha})`;
        } else if (isCombo) {
          const comboTone = comboStage >= 3 ? "255, 182, 144" : comboStage === 2 ? "255, 207, 152" : "255, 235, 176";
          ctx.fillStyle = `rgba(${comboTone}, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255, 235, 176, ${alpha})`;
        }
        const drawLen = Math.max(2, Math.floor(len));
        const lineH = flashyBoost > 0.42 && (isWave || isHyakuretsu || i % 2 === 0) ? 2 : 1;
        ctx.fillRect(Math.floor(sx), sy, drawLen, lineH);
        if (flashyBoost > 0.2 && i % 2 === 0) {
          const glowAlpha = Math.max(0.06, 0.2 + flashyBoost * 0.14 - i * 0.03);
          const glowLen = Math.max(2, Math.floor(drawLen * (0.46 + flashyBoost * 0.28)));
          ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
          ctx.fillRect(Math.floor(sx), sy - 1, glowLen, 1);
        }
      }
    }

    if (!(isCombo && comboMove === "kick")) {
      const fistX = dir > 0 ? frontX + 2 : frontX - 8;
      const fistY = isCombo && comboMove === "upper" ? baseY - 2 : baseY - 1;
      ctx.fillStyle = "#f5ddcf";
      ctx.fillRect(fistX, fistY, 6, 3);
      ctx.fillStyle = "#2a3348";
      ctx.fillRect(fistX + 1, fistY - 1, 4, 1);
    }

    if (isWave) {
      const flareX = dir > 0 ? frontX + 15 : frontX - 15;
      ctx.fillStyle = "rgba(255, 246, 203, 0.7)";
      const flareW = 4 + Math.floor(flashyBoost * 2);
      const flareH = 8 + Math.floor(flashyBoost * 5);
      ctx.fillRect(flareX - Math.floor(flareW * 0.5), baseY - Math.floor(flareH * 0.5), flareW, flareH);
      ctx.fillRect(flareX - 6 - Math.floor(flashyBoost * 2), baseY - 1, 12 + Math.floor(flashyBoost * 4), 2);
    } else if (isMorningStar) {
      const swing = clamp(1 - ratio, 0, 1);
      const pulse = 0.5 + Math.sin((attackEffectPhase + visualPower * 3.2) * 0.9) * 0.5;
      const chainLen = Math.floor(10 + visualPower * 16 + swing * 3);
      const anchorX = dir > 0 ? frontX + 4 : frontX - 4;
      const anchorY = baseY - 2;
      const maxVisualReach = Math.max(12, Math.floor(reach * 0.86));
      const travelX = Math.min(maxVisualReach, 4 + chainLen);
      const travelY = -10 + Math.floor(swing * 14);
      const tipX = dir > 0 ? anchorX + travelX : anchorX - travelX;
      const tipY = anchorY + travelY;

      const chainLinks = 6;
      for (let i = 0; i <= chainLinks; i += 1) {
        const t = i / chainLinks;
        const lx = Math.round(anchorX + (tipX - anchorX) * t);
        const ly = Math.round(anchorY + (tipY - anchorY) * t + Math.sin(t * Math.PI) * 0.85);
        ctx.fillStyle = i % 2 === 0 ? "#c7c2b6" : "#8e887d";
        ctx.fillRect(lx - 1, ly - 1, 3, 2);
      }

      const ballX = tipX - 3;
      const ballY = tipY - 3;
      ctx.fillStyle = "#5c5752";
      ctx.fillRect(ballX, ballY, 7, 7);
      ctx.fillStyle = "#8f897f";
      ctx.fillRect(ballX + 1, ballY + 1, 5, 5);
      ctx.fillStyle = "#e0dbcf";
      ctx.fillRect(ballX + 2, ballY + 1, 2, 1);

      const spikeColor = `rgba(235, 245, 255, ${0.76 + pulse * 0.18})`;
      ctx.fillStyle = spikeColor;
      ctx.fillRect(ballX + 3, ballY - 2, 1, 2);
      ctx.fillRect(ballX + 3, ballY + 7, 1, 2);
      ctx.fillRect(ballX - 2, ballY + 3, 2, 1);
      ctx.fillRect(ballX + 7, ballY + 3, 2, 1);
      ctx.fillRect(ballX + 1, ballY + 1, 1, 1);
      ctx.fillRect(ballX + 5, ballY + 1, 1, 1);
      ctx.fillRect(ballX + 1, ballY + 5, 1, 1);
      ctx.fillRect(ballX + 5, ballY + 5, 1, 1);

      ctx.fillStyle = "rgba(255, 233, 178, 0.45)";
      ctx.fillRect(tipX + (dir > 0 ? 5 : -7), tipY - 2, 2, 2);
      ctx.fillRect(tipX + (dir > 0 ? 8 : -10), tipY + 1, 1, 1);
    } else if (isCombo) {
      if (comboMove === "punch") {
        for (let i = 0; i < 3; i += 1) {
          const offset = 3 + i * 4 + Math.floor((1 - ratio) * 2);
          const fx = dir > 0 ? frontX + 5 + offset : frontX - 11 - offset;
          const fy = baseY - 3 + (i % 2);
          const alpha = 0.62 - i * 0.12;
          ctx.fillStyle = `rgba(250, 228, 196, ${alpha})`;
          ctx.fillRect(fx, fy, 5, 2);
        }
      } else if (comboMove === "kick") {
        const bootX = dir > 0 ? frontX + 7 : frontX - 14;
        const bootY = baseY - 1;
        ctx.fillStyle = "#2d3142";
        ctx.fillRect(bootX, bootY, 7, 3);
        ctx.fillRect(bootX + (dir > 0 ? 5 : -1), bootY + 2, 3, 2);
        ctx.fillStyle = "#6c738f";
        ctx.fillRect(bootX + 1, bootY, 4, 1);
        for (let i = 0; i < 4; i += 1) {
          const arcOffset = 4 + i * 4;
          const ax = dir > 0 ? bootX + 6 + arcOffset : bootX - 3 - arcOffset;
          const ay = bootY - 2 + i;
          const alpha = 0.58 - i * 0.1;
          ctx.fillStyle = `rgba(255, 214, 150, ${alpha})`;
          ctx.fillRect(ax, ay, 4, 1);
        }
      } else {
        const upX = dir > 0 ? frontX + 7 : frontX - 11;
        const upY = baseY - 4;
        ctx.fillStyle = "#f5ddcf";
        ctx.fillRect(upX, upY, 5, 3);
        ctx.fillStyle = "#2a3348";
        ctx.fillRect(upX + 1, upY - 1, 3, 1);
        for (let i = 0; i < 5; i += 1) {
          const trailY = upY + 5 + i * 2;
          const trailX = dir > 0 ? upX - 1 + i % 2 : upX + 1 - (i % 2);
          const alpha = 0.56 - i * 0.09;
          ctx.fillStyle = `rgba(160, 224, 255, ${alpha})`;
          ctx.fillRect(trailX, trailY, 3, 1);
        }
      }
    } else if (isHyakuretsu) {
      for (let i = 0; i < 9; i += 1) {
        const lane = i % 3;
        const step = Math.floor(i / 3);
        const offset = 4 + step * 5 + ((hyakuretsuLaneTick + lane + step) % 2);
        const fx = dir > 0 ? frontX + 4 + offset : frontX - 10 - offset;
        const fy = baseY - 6 + lane * 4 + ((hyakuretsuLaneTick + i) % 2);
        const alpha = 0.74 - step * 0.1;
        ctx.fillStyle = `rgba(250, 228, 196, ${alpha})`;
        ctx.fillRect(fx, fy, 4, 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(fx + 1, fy, 2, 1);
        const trailLen = 4 + step;
        ctx.fillStyle = `rgba(146, 214, 255, ${0.44 - lane * 0.08 - step * 0.04})`;
        ctx.fillRect(fx + (dir > 0 ? -trailLen : 4), fy + 1, trailLen, 1);
      }
    }
  }

  function drawCannon(c) {
    const x = Math.floor(c.x - cameraX);
    const y = Math.floor(c.y);
    if (c.destroyed) {
      const debris = c.debrisTimer || 0;
      if (debris <= 0) return;
      const spark = Math.floor((debris + player.anim) * 0.25) % 2 === 0;
      ctx.fillStyle = "#1b1f2b";
      ctx.fillRect(x - 8, y + 4, 17, 5);
      ctx.fillStyle = "#374156";
      ctx.fillRect(x - 7, y + 4, 15, 2);
      ctx.fillStyle = "#252e40";
      ctx.fillRect(x - 10, y + 3, 4, 3);
      ctx.fillRect(x + 7, y + 5, 5, 2);
      ctx.fillStyle = "#5a657b";
      ctx.fillRect(x - 2, y + 2, 2, 2);
      ctx.fillRect(x + 3, y + 6, 2, 1);
      if (spark) {
        ctx.fillStyle = "rgba(255, 174, 118, 0.7)";
        ctx.fillRect(x - 5, y + 1, 2, 1);
        ctx.fillRect(x + 1, y + 2, 1, 1);
        ctx.fillRect(x + 5, y + 3, 1, 1);
      }
      return;
    }

    const warning = c.active && c.warning;
    const warnBlink = warning && Math.floor((c.cool || 0) / 2) % 2 === 0;
    const flash = (c.muzzleFlash || 0) > 0;
    const muzzleX = c.dir < 0 ? x - 10 : x + 11;
    const muzzleY = y + 1;
    ctx.fillStyle = "rgba(10, 12, 18, 0.34)";
    ctx.fillRect(x - 5, y + 8, 12, 2);

    ctx.fillStyle = "#20242f";
    ctx.fillRect(x - 6, y - 4, 14, 11);
    ctx.fillStyle = "#3f4c62";
    ctx.fillRect(x - 5, y - 3, 12, 8);
    ctx.fillStyle = "#667388";
    ctx.fillRect(x - 4, y - 2, 10, 2);

    ctx.fillStyle = warnBlink ? "#786168" : "#4e596d";
    if (c.dir < 0) {
      ctx.fillRect(x - 10, y - 1, 6, 5);
      ctx.fillStyle = "#7b889e";
      ctx.fillRect(x - 10, y + 1, 2, 1);
    } else {
      ctx.fillRect(x + 7, y - 1, 6, 5);
      ctx.fillStyle = "#7b889e";
      ctx.fillRect(x + 11, y + 1, 2, 1);
    }

    ctx.fillStyle = "#6e7d92";
    ctx.fillRect(x - 3, y + 6, 8, 2);
    ctx.fillStyle = "#cdd8ea";
    ctx.fillRect(x - 1, y - 2, 3, 1);

    if (warnBlink) {
      ctx.fillStyle = "rgba(255, 146, 110, 0.68)";
      for (let i = 0; i < 6; i += 1) {
        const wx = muzzleX + c.dir * (i * 6 + 1);
        ctx.fillRect(wx, muzzleY + (i % 2), 3, 1);
      }
    }

    if (warning || flash) {
      ctx.fillStyle = flash ? "#ffe0b2" : "#ffb18a";
      ctx.fillRect(muzzleX, muzzleY, 2, 2);
      ctx.fillStyle = flash ? "#ff8a54" : "#ff6d5a";
      ctx.fillRect(muzzleX + c.dir, muzzleY, 2, 2);
    }
    if (flash) {
      ctx.fillStyle = "rgba(255, 180, 120, 0.5)";
      ctx.fillRect(muzzleX + c.dir * 2, muzzleY - 1, 4, 4);
    }
  }

  function drawFallingBlock(block) {
    if (block.destroyed) {
      const debris = block.debrisTimer || 0;
      if (debris <= 0) return;
      const x = Math.floor(block.x - cameraX);
      const y = Math.floor(block.y);
      const blink = Math.floor((debris + player.anim) * 0.22) % 2 === 0;
      ctx.fillStyle = "#2e2422";
      ctx.fillRect(x + 1, y + block.h - 5, Math.max(4, block.w - 2), 4);
      ctx.fillStyle = "#72564a";
      ctx.fillRect(x + 2, y + block.h - 5, Math.max(3, block.w - 6), 1);
      ctx.fillStyle = "#6c4e43";
      ctx.fillRect(x - 1, y + block.h - 9, 4, 3);
      ctx.fillRect(x + block.w - 2, y + block.h - 8, 4, 3);
      if (blink) {
        ctx.fillStyle = "rgba(255, 212, 170, 0.62)";
        ctx.fillRect(x + Math.floor(block.w * 0.36), y + block.h - 10, 2, 1);
        ctx.fillRect(x + Math.floor(block.w * 0.6), y + block.h - 7, 1, 1);
      }
      return;
    }

    if (block.state === "gone") return;
    const x = Math.floor(block.x - cameraX);
    const y = Math.floor(block.y);

    const warn = block.state === "warning" && Math.floor(block.timer / 2) % 2 === 0;
    ctx.fillStyle = warn ? "#7d3f45" : "#3d2d29";
    ctx.fillRect(x, y, block.w, block.h);
    ctx.fillStyle = warn ? "#f0b3a0" : "#7e5a4e";
    ctx.fillRect(x, y, block.w, 3);
    ctx.fillStyle = "rgba(255, 236, 208, 0.08)";
    for (let yy = 5; yy < block.h - 3; yy += 6) {
      ctx.fillRect(x + 2, y + yy, Math.max(2, block.w - 4), 1);
    }
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + 1, y + block.h - 2, block.w - 2, 1);
    if (warn) {
      ctx.fillStyle = "rgba(255,210,170,0.55)";
      for (let ix = 2; ix < block.w - 1; ix += 6) {
        ctx.fillRect(x + ix, y + 5, 2, 1);
      }
    }

    if (block.state === "warning") {
      ctx.fillStyle = "rgba(255, 120, 120, 0.35)";
      ctx.fillRect(x - 2, stage.groundY - 3, block.w + 4, 3);
    }
  }

  function drawPopSpikeTrap(trap) {
    const x = Math.floor(trap.x - cameraX);
    const y = Math.floor(trap.y);

    if (trap.destroyed) {
      const debris = trap.debrisTimer || 0;
      if (debris <= 0) return;
      const blink = Math.floor((debris + player.anim) * 0.24) % 2 === 0;
      ctx.fillStyle = "#262d3e";
      ctx.fillRect(x, stage.groundY - 3, trap.w, 3);
      ctx.fillStyle = "#3b4963";
      ctx.fillRect(x + 2, stage.groundY - 3, Math.max(2, trap.w - 4), 1);
      ctx.fillStyle = "#48556d";
      ctx.fillRect(x + 3, stage.groundY - 6, 3, 2);
      ctx.fillRect(x + trap.w - 6, stage.groundY - 6, 3, 2);
      if (blink) {
        ctx.fillStyle = "rgba(255, 206, 138, 0.72)";
        ctx.fillRect(x + Math.floor(trap.w * 0.4), stage.groundY - 8, 2, 1);
      }
      return;
    }

    const state = trap.state || "idle";
    const warning = state === "warning";
    const active = state === "active";
    const rise = clamp(trap.raise || 0, 0, 1);

    ctx.fillStyle = "#2a3347";
    ctx.fillRect(x - 1, stage.groundY - 4, trap.w + 2, 4);
    ctx.fillStyle = "#3a4c66";
    ctx.fillRect(x, stage.groundY - 3, trap.w, 3);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 1, stage.groundY - 3, Math.max(2, trap.w - 2), 1);
    ctx.fillStyle = "rgba(8, 14, 22, 0.24)";
    ctx.fillRect(x + 2, stage.groundY - 1, Math.max(2, trap.w - 4), 1);

    if (warning) {
      const pulse = (Math.sin((trap.warningPulse || 0) * 0.26) * 0.5 + 0.5);
      ctx.fillStyle = `rgba(255, 193, 118, ${0.22 + pulse * 0.26})`;
      ctx.fillRect(x - 2, stage.groundY - 8, trap.w + 4, 2);
      ctx.fillStyle = "#ffd08b";
      for (let i = 1; i < trap.w - 2; i += 5) {
        ctx.fillRect(x + i, stage.groundY - 8, 2, 1);
      }
    }

    if (rise > 0.03) {
      const h = Math.max(2, Math.floor(trap.h * rise));
      const topY = y + trap.h - h;
      ctx.fillStyle = active ? "rgba(255, 98, 132, 0.22)" : "rgba(122, 161, 224, 0.18)";
      ctx.fillRect(x - 1, topY - 1, trap.w + 2, h + 2);
      ctx.fillStyle = active ? "#ff6e93" : "#6f88ac";
      ctx.fillRect(x + 2, topY, Math.max(3, trap.w - 4), h);
      ctx.fillStyle = active ? "#ffd2df" : "#cddbf1";
      ctx.fillRect(x + 3, topY + 1, Math.max(2, trap.w - 8), 1);
      ctx.fillStyle = active ? "rgba(255, 248, 226, 0.3)" : "rgba(224, 240, 255, 0.24)";
      ctx.fillRect(x + 3, topY + h - 2, Math.max(2, trap.w - 8), 1);
      if (active) {
        const jitter = Math.floor((trap.warningPulse || 0) * 0.9) % 3;
        ctx.fillStyle = "rgba(255, 238, 174, 0.62)";
        ctx.fillRect(x + 2 + jitter, topY + 2, 2, Math.max(1, h - 3));
        ctx.fillRect(x + trap.w - 4 - jitter, topY + 2, 2, Math.max(1, h - 4));
      }
    }
  }

  function drawGoal() {
    if (gameState === STATE.BOSS) return;
    const g = stage.goal;
    const x = Math.floor(g.x - cameraX);
    const y = Math.floor(g.y);

    if (stage.id <= 2) {
      const gx = x - 20;
      const gy = y - 56;
      const gw = 64;
      const gh = 104;

      ctx.fillStyle = "#17243a";
      ctx.fillRect(gx, gy + 6, gw, gh - 6);
      ctx.fillStyle = "#213453";
      ctx.fillRect(gx + 3, gy + 10, gw - 6, gh - 12);
      ctx.fillStyle = "#4cc4f0";
      ctx.fillRect(gx + 6, gy + 12, gw - 12, 2);
      ctx.fillStyle = "#ff8fbe";
      ctx.fillRect(gx + 8, gy + 18, gw - 16, 1);
      ctx.fillStyle = "rgba(255, 240, 214, 0.15)";
      ctx.fillRect(gx + 7, gy + 26, gw - 14, 2);

      ctx.fillStyle = "#111a2b";
      ctx.fillRect(x - 1, y - 1, g.w + 2, g.h + 2);
      ctx.fillStyle = "#1c2b44";
      ctx.fillRect(x, y, g.w, g.h);
      ctx.fillStyle = "rgba(128, 210, 255, 0.3)";
      ctx.fillRect(x + 1, y + 2, g.w - 2, g.h - 5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fillRect(x + 2, y + 4, 2, g.h - 10);
      ctx.fillRect(x + g.w - 4, y + 4, 1, g.h - 10);

      ctx.fillStyle = "#206f95";
      ctx.fillRect(gx + 24, gy + 28, 18, 3);
      ctx.fillStyle = "#4ce2ff";
      ctx.fillRect(gx + 26, gy + 29, 14, 1);
      ctx.fillStyle = "#f8d682";
      ctx.fillRect(gx + 31, gy + 32, 6, 2);

      if (stage.boss.active) {
        ctx.fillStyle = "rgba(255,40,60,0.35)";
        ctx.fillRect(x - 4, y - 2, g.w + 8, g.h + 4);
        ctx.fillStyle = "#ffd0d0";
        ctx.font = "8px monospace";
        ctx.fillText("BOSS", x - 1, y - 10);
      }
      return;
    }

    const mx = x - 46;
    const my = y - 72;
    const mw = 116;
    const mh = 120;

    // Mansion facade.
    ctx.fillStyle = "#1a1f30";
    ctx.fillRect(mx, my + 6, mw, mh - 6);
    ctx.fillStyle = "#232b40";
    ctx.fillRect(mx + 4, my + 10, mw - 8, mh - 14);
    ctx.fillStyle = "#36415d";
    ctx.fillRect(mx + 8, my + 14, mw - 16, 6);
    ctx.fillStyle = "rgba(255, 220, 178, 0.16)";
    ctx.fillRect(mx + 10, my + 22, mw - 20, 2);

    // Entrance canopy.
    ctx.fillStyle = "#2c354b";
    ctx.fillRect(x - 8, y - 8, g.w + 16, 8);
    ctx.fillStyle = "#141a28";
    ctx.fillRect(x - 6, y - 6, g.w + 12, 3);
    ctx.fillStyle = "rgba(255, 236, 186, 0.24)";
    ctx.fillRect(x - 4, y - 7, g.w + 8, 1);

    // Windows.
    ctx.fillStyle = "#1a2336";
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const wx = mx + 12 + col * 24;
        const wy = my + 24 + row * 22;
        if (wx >= x - 12 && wx <= x + g.w + 4 && wy > y - 16) continue;
        ctx.fillRect(wx, wy, 12, 10);
        ctx.fillStyle = (row + col) % 2 === 0 ? "#7dd8ff" : "#ffc88d";
        ctx.fillRect(wx + 2, wy + 2, 8, 6);
        ctx.fillStyle = "#1a2336";
      }
    }

    // Goal collision area = mansion entrance.
    ctx.fillStyle = "#121722";
    ctx.fillRect(x - 1, y - 1, g.w + 2, g.h + 2);
    ctx.fillStyle = "#1f2738";
    ctx.fillRect(x, y, g.w, g.h);

    // Boyfriend waits inside the entrance lobby.
    ctx.save();
    ctx.globalAlpha = stage.boss.active ? 0.26 : 0.72;
    drawBoyfriend(g.x + 4, g.y + 22);
    ctx.restore();

    // Glass overlay to read as "inside the mansion".
    ctx.fillStyle = "rgba(170, 210, 255, 0.24)";
    ctx.fillRect(x + 1, y + 2, g.w - 2, g.h - 6);
    ctx.fillStyle = "rgba(255, 238, 206, 0.18)";
    ctx.fillRect(x + 2, y + 4, 6, g.h - 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(x + g.w - 6, y + 4, 2, g.h - 12);

    ctx.fillStyle = "#6b4f2f";
    ctx.fillRect(x - 4, y + g.h - 4, g.w + 8, 4);
    ctx.fillStyle = "#9f7a4d";
    ctx.fillRect(x - 2, y + g.h - 4, g.w + 4, 1);
    ctx.fillStyle = "rgba(255, 244, 202, 0.2)";
    ctx.fillRect(x + 2, y + g.h - 5, g.w - 4, 1);

    if (stage.boss.active) {
      ctx.fillStyle = "rgba(180,20,20,0.45)";
      ctx.fillRect(x - 4, y - 2, g.w + 8, g.h + 4);
      ctx.fillStyle = "#ffd0d0";
      ctx.font = "8px monospace";
      ctx.fillText("LOCK", x - 2, y - 10);
    }
  }

  function drawGodGimmicks() {
    if (!stage.godGimmicks || stage.godGimmicks.length === 0) return;
    const boss = stage.boss;
    if (!boss || boss.kind !== "god" || !boss.active) return;

    const phase2Ready = (boss.phase || 1) >= 2 && (boss.phaseTransitionTimer || 0) <= 0;
    for (const gimmick of stage.godGimmicks) {
      const x = Math.floor(gimmick.x - cameraX);
      const y = Math.floor(gimmick.y);
      const chargeRatio = clamp((gimmick.charge || 0) / 54, 0, 1);
      const cooldown = Math.max(0, gimmick.cooldown || 0);
      const activePulse = (Math.sin((gimmick.pulse || 0) + player.anim * 0.06) * 0.5 + 0.5);
      const ready = phase2Ready && cooldown <= 0;
      const lit = ready && chargeRatio > 0.04;

      ctx.fillStyle = ready ? "#202d4d" : "#1f2433";
      ctx.fillRect(x - 1, y - 1, gimmick.w + 2, gimmick.h + 2);
      ctx.fillStyle = ready ? "#2f4675" : "#2b3245";
      ctx.fillRect(x, y, gimmick.w, gimmick.h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x + 1, y + 1, gimmick.w - 2, 1);

      if (lit) {
        const fillW = Math.floor((gimmick.w - 2) * chargeRatio);
        ctx.fillStyle = `rgba(110, 227, 255, ${0.3 + activePulse * 0.24})`;
        ctx.fillRect(x - 2, y - 2, gimmick.w + 4, gimmick.h + 4);
        ctx.fillStyle = "#72e3ff";
        ctx.fillRect(x + 1, y + gimmick.h - 4, fillW, 2);
      }

      if (ready && chargeRatio >= 0.98) {
        const blink = Math.floor((gimmick.pulse || 0) * 2) % 2 === 0;
        if (blink) {
          ctx.fillStyle = "rgba(255, 248, 176, 0.9)";
          ctx.fillRect(x - 2, y - 2, gimmick.w + 4, 1);
        }
      }

      if (!phase2Ready || cooldown > 0) {
        const coolRatio = clamp(cooldown / 380, 0, 1);
        ctx.fillStyle = "rgba(255, 177, 134, 0.24)";
        ctx.fillRect(x + 1, y + gimmick.h - 3, gimmick.w - 2, 1);
        ctx.fillStyle = "#ffb68a";
        ctx.fillRect(x + 1, y + gimmick.h - 3, Math.floor((gimmick.w - 2) * (1 - coolRatio)), 1);
      }

      if ((boss.gimmickAdvantageTimer || 0) > 0) {
        ctx.fillStyle = "rgba(129, 248, 255, 0.26)";
        ctx.fillRect(x - 2, y - 2, gimmick.w + 4, gimmick.h + 1);
      }
    }
  }

  function drawCityAtmosphere(godBossRoom) {
    const t = performance.now() * 0.001;
    ctx.save();

    // 1) 地平線の深度フォグ（街明かりが滲む）
    const fog = ctx.createLinearGradient(0, 96, 0, 152);
    if (godBossRoom) {
      fog.addColorStop(0, "rgba(40, 26, 52, 0)");
      fog.addColorStop(1, "rgba(70, 40, 78, 0.30)");
    } else {
      fog.addColorStop(0, "rgba(34, 48, 78, 0)");
      fog.addColorStop(1, "rgba(64, 96, 150, 0.24)");
    }
    ctx.fillStyle = fog;
    ctx.fillRect(0, 96, W, 56);

    // 2) 流れるネオンヘイズ（加算合成の光だまり）
    ctx.globalCompositeOperation = "screen";
    const hazeColors = godBossRoom
      ? ["rgba(160, 90, 170, 0.10)", "rgba(95, 60, 150, 0.085)", "rgba(200, 120, 150, 0.07)"]
      : ["rgba(70, 160, 255, 0.09)", "rgba(255, 100, 160, 0.075)", "rgba(130, 95, 255, 0.06)"];
    const span = W + 160;
    for (let i = 0; i < 3; i += 1) {
      let hx = (i * 147 + t * (6 + i * 3) - cameraX * 0.18) % span;
      if (hx < 0) hx += span;
      hx -= 80;
      const hy = 102 + i * 13 + Math.sin(t * 0.5 + i * 2.1) * 4;
      const r = 70 - i * 12;
      const grad = ctx.createRadialGradient(hx, hy, 4, hx, hy, r);
      grad.addColorStop(0, hazeColors[i]);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
    }

    // 3) 浮遊する塵・火の粉（視差つき）
    const eSpan = W + 24;
    for (let i = 0; i < 14; i += 1) {
      const seed = i * 37.7;
      let ex = (seed * 13 + t * (4 + (i % 5)) - cameraX * 0.4) % eSpan;
      if (ex < 0) ex += eSpan;
      let ey = (seed * 7 - t * 2.4 + Math.sin(t * (0.6 + (i % 3) * 0.22) + seed) * 9) % H;
      if (ey < 0) ey += H;
      const tw = 0.5 + Math.sin(t * 3 + seed) * 0.5;
      ctx.fillStyle = i % 4 === 0
        ? `rgba(255, 170, 190, ${(0.08 + tw * 0.2).toFixed(3)})`
        : `rgba(150, 210, 255, ${(0.06 + tw * 0.18).toFixed(3)})`;
      ctx.fillRect(Math.floor(ex) - 12, Math.floor(ey), 1, 1);
    }

    ctx.restore();
  }

  function drawWorld() {
    const godBossRoom = gameState === STATE.BOSS && stage.boss && stage.boss.kind === "god";
    if (godBossRoom) {
      drawMansionInteriorBackdrop();
    } else {
      drawSkyGradient();
      drawParallax();
    }
    drawCityAtmosphere(godBossRoom);
    drawCinematicBackdropFX(godBossRoom);
    ctx.fillStyle = godBossRoom ? "rgba(6,8,12,0.09)" : "rgba(8,10,16,0.07)";
    ctx.fillRect(0, 0, W, H - 18);
    const polishGlow = ctx.createLinearGradient(0, 44, 0, 150);
    polishGlow.addColorStop(0, "rgba(255, 206, 178, 0)");
    polishGlow.addColorStop(0.52, "rgba(255, 206, 178, 0.05)");
    polishGlow.addColorStop(1, "rgba(140, 224, 255, 0.08)");
    ctx.fillStyle = polishGlow;
    ctx.fillRect(0, 44, W, 110);

    ctx.save();

    for (const s of stage.solids) {
      if (s.kind === "crumble" && s.state === "gone") continue;
      drawSolid(s);
    }

    for (const wall of stage.breakWalls) {
      if (wall.hp <= 0) continue;
      drawSolid(wall);
    }

    for (const block of stage.fallBlocks) {
      drawFallingBlock(block);
    }

    for (const trap of stage.popSpikes) {
      drawPopSpikeTrap(trap);
    }

    for (const cannon of stage.cannons) {
      drawCannon(cannon);
    }

    for (const protein of stage.proteins) {
      drawProtein(protein);
    }

    for (const item of stage.heartItems) {
      drawHeartPickup(item);
    }

    for (const item of stage.lifeUpItems) {
      drawLifeUpItem(item);
    }

    for (const bike of stage.bikes) {
      drawBikePickup(bike);
    }

    for (const token of stage.checkpointTokens) {
      drawCheckpointToken(token);
    }

    drawGodGimmicks();

    for (const e of stage.enemies) {
      if (!e.alive) continue;
      drawContactShadowWorld(
        e.x,
        e.y + e.h + 1,
        e.w,
        e.kind === "bruiser" ? 0.24 : 0.18,
        e.kind === "peacock" ? 1.15 : 1.0
      );
      drawEnemy(e);
    }

    drawDoppelgangers();

    for (const bs of stage.bossShots) {
      if (bs.dead) continue;
      const sx = Math.floor(bs.x - cameraX);
      const sy = Math.floor(bs.y);
      if (bs.kind === "peacock_feather") {
        ctx.fillStyle = "rgba(128, 226, 255, 0.42)";
        ctx.fillRect(sx - 1, sy - 1, bs.w + 2, bs.h + 2);
        ctx.fillStyle = "#59d9ef";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#f6df94";
        ctx.fillRect(sx + 1, sy + 1, Math.max(2, bs.w - 2), 1);
      } else if (bs.kind === "wave") {
        ctx.fillStyle = "rgba(255, 156, 108, 0.44)";
        ctx.fillRect(sx - 2, sy - 1, bs.w + 4, bs.h + 2);
        ctx.fillStyle = "#ff9f5b";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#ffe0b4";
        ctx.fillRect(sx + 2, sy + 1, Math.max(2, bs.w - 4), Math.max(2, bs.h - 2));
      } else if (bs.kind === "ring") {
        ctx.fillStyle = "rgba(196, 165, 255, 0.42)";
        ctx.fillRect(sx - 1, sy - 1, bs.w + 2, bs.h + 2);
        ctx.fillStyle = "#c5a3ff";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#efe2ff";
        ctx.fillRect(sx + 1, sy + 1, Math.max(2, bs.w - 2), Math.max(2, bs.h - 2));
      } else if (bs.kind === "spiral") {
        ctx.fillStyle = "rgba(121, 223, 255, 0.38)";
        ctx.fillRect(sx - 1, sy - 1, bs.w + 2, bs.h + 2);
        ctx.fillStyle = "#7ee0ff";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#e8fcff";
        ctx.fillRect(sx + 1, sy + 1, Math.max(2, bs.w - 2), Math.max(2, bs.h - 2));
      } else if (bs.kind === "nova" || bs.kind === "nova2") {
        const phase2Nova = bs.kind === "nova2";
        ctx.fillStyle = phase2Nova ? "rgba(255, 175, 114, 0.48)" : "rgba(157, 232, 255, 0.42)";
        ctx.fillRect(sx - 2, sy - 2, bs.w + 4, bs.h + 4);
        ctx.fillStyle = phase2Nova ? "#ffb36f" : "#85e6ff";
        ctx.fillRect(sx - 1, sy - 1, bs.w + 2, bs.h + 2);
        ctx.fillStyle = phase2Nova ? "#ffe5b6" : "#f2fdff";
        ctx.fillRect(sx + 1, sy + 1, Math.max(2, bs.w - 2), Math.max(2, bs.h - 2));
      } else if (bs.kind === "rain_warn") {
        const blink = Math.floor((bs.ttl || 0) * 0.32) % 2 === 0;
        ctx.fillStyle = blink ? "rgba(255, 219, 127, 0.4)" : "rgba(255, 170, 94, 0.26)";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = blink ? "#ffd885" : "#ffb36c";
        ctx.fillRect(sx + 2, sy + 1, Math.max(1, bs.w - 4), Math.max(1, bs.h - 2));
      } else if (bs.kind === "rain") {
        ctx.fillStyle = "rgba(255, 116, 103, 0.45)";
        ctx.fillRect(sx - 1, sy - 2, bs.w + 2, bs.h + 4);
        ctx.fillStyle = "#ff896a";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#ffd8b6";
        ctx.fillRect(sx + 1, sy + 2, Math.max(2, bs.w - 2), Math.max(2, bs.h - 4));
      } else {
        ctx.fillStyle = "#ff8d6a";
        ctx.fillRect(sx, sy, bs.w, bs.h);
        ctx.fillStyle = "#ffd6a8";
        ctx.fillRect(sx + 1, sy + 1, bs.w - 2, bs.h - 2);
      }
    }

    for (const b of stage.hazardBullets) {
      if (b.dead) continue;
      const bx = Math.floor(b.x - cameraX);
      const by = Math.floor(b.y);
      if (b.kind === "cannon") {
        const pulse = Math.floor((player.anim + b.x * 0.04) * 0.26) % 2 === 0;
        ctx.fillStyle = "rgba(255, 98, 98, 0.42)";
        ctx.fillRect(bx - 2, by - 2, b.w + 4, b.h + 4);
        ctx.fillStyle = "#181d2b";
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.fillStyle = pulse ? "#fff0b8" : "#ffd790";
        ctx.fillRect(bx + 2, by + 2, b.w - 4, b.h - 4);
        ctx.fillStyle = "#ff7f52";
        ctx.fillRect(bx + 1, by + 1, 1, b.h - 2);
        const trailDir = b.vx > 0 ? -1 : 1;
        for (let i = 0; i < 3; i += 1) {
          ctx.fillStyle = `rgba(255, 173, 122, ${0.36 - i * 0.1})`;
          ctx.fillRect(bx + trailDir * (3 + i * 3), by + 2, 2, 2);
        }
        continue;
      }

      const enemyShot = b.kind === "enemy";
      ctx.fillStyle = enemyShot ? "#d4c2ff" : "#ffcb67";
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.fillStyle = enemyShot ? "#9f7dff" : "#ffa934";
      ctx.fillRect(bx + 1, by + 1, b.w - 2, b.h - 2);
    }

    drawBurstMeteors();

    for (const shard of stage.hammerShards || []) {
      if (shard.dead) continue;
      const sx = Math.floor(shard.x - cameraX);
      const sy = Math.floor(shard.y);
      const pulse = 0.5 + Math.sin((shard.spin || 0) * 1.9) * 0.5;
      const glowA = 0.22 + pulse * 0.16;
      ctx.fillStyle = `rgba(255, 198, 132, ${glowA})`;
      ctx.fillRect(sx - 1, sy - 1, shard.w + 2, shard.h + 2);
      ctx.fillStyle = "#5b5f73";
      ctx.fillRect(sx, sy, shard.w, shard.h);
      ctx.fillStyle = "#b5c1d8";
      ctx.fillRect(sx + 1, sy, Math.max(1, shard.w - 1), 1);
    }

    for (const wave of stage.playerWaves) {
      if (wave.dead) continue;
      drawPlayerWave(wave);
    }

    // Draw Round Trip sword
    if (roundTripActive) {
      const rtx = roundTripX - cameraX;
      const rty = roundTripY;
      const spin = (ROUND_TRIP_DURATION - roundTripTimer) * 0.4;
      const dtActive = devilTriggerTimer > 0;
      ctx.save();
      ctx.translate(rtx, rty);
      ctx.rotate(spin);
      // Glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = dtActive ? "#ff4444" : "#4488ff";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      // Blade
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = dtActive ? "#ff8866" : "#aaddff";
      ctx.fillRect(-8, -2, 16, 4);
      ctx.fillStyle = dtActive ? "#ffcc88" : "#ddeeff";
      ctx.fillRect(-6, -1, 12, 2);
      // Guard
      ctx.fillStyle = "#ffdd44";
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }

    drawWaveBursts();
    drawHitSparks();
    drawInvincibleBonusPops();
    if (stage && stage.boss && stage.boss.active) {
      drawContactShadowWorld(stage.boss.x, stage.boss.y + stage.boss.h + 1, stage.boss.w, 0.28, 1.45);
    }
    drawBoss();
    drawGoal();
    drawRushAura();
    const hurtBlink = damageInvulnTimer > 0 && !swordStingerActive && !millionStabActive && Math.floor(damageInvulnTimer / 3) % 2 === 0;
    if (!hurtBlink) {
      drawHeroAfterimageTrail();
      drawContactShadowWorld(
        player.x,
        player.y + player.h + 1,
        player.w,
        invincibleTimer > 0 ? 0.32 : 0.24,
        invincibleTimer > 0 ? 1.8 : 1.35 + clamp(Math.abs(player.vx) / 5, 0, 0.5)
      );
      if (invincibleTimer > 0) {
        drawInvincibleBikeRide();
      } else if (bulletRainRotation) {
        const hx = player.x - cameraX + player.w * 0.5;
        const hy = player.y + player.h * 0.5;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(Math.PI);
        ctx.translate(-hx, -hy);
        drawHero(player.x - cameraX, player.y, player.facing, player.anim, 1);
        ctx.restore();
      } else {
        drawHero(player.x - cameraX, player.y, player.facing, player.anim, 1);
      }
      drawAutoWeaponEffects();
    }

    drawCinematicForegroundFX(godBossRoom);

    ctx.restore();
  }

  function drawPlayerTrueColorPass() {
    const hurtBlink = damageInvulnTimer > 0 && !swordStingerActive && !millionStabActive && Math.floor(damageInvulnTimer / 3) % 2 === 0;
    if (hurtBlink) return;
    if (invincibleTimer > 0) {
      drawInvincibleBikeRide();
      return;
    }
    if (bulletRainRotation) {
      const hx = player.x - cameraX + player.w * 0.5;
      const hy = player.y + player.h * 0.5;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.PI);
      ctx.translate(-hx, -hy);
      drawHero(player.x - cameraX, player.y, player.facing, player.anim, 1);
      ctx.restore();
    } else {
      drawHero(player.x - cameraX, player.y, player.facing, player.anim, 1);
    }
    // Taunt glow effect
    if (tauntFlashTimer > 0 || tauntBonusTimer > 0) {
      const px = player.x - cameraX + player.w * 0.5;
      const py = player.y + player.h * 0.5;
      const alpha = tauntFlashTimer > 0
        ? 0.4 + 0.3 * Math.sin(tauntFlashTimer * 0.5)
        : Math.min(0.25, tauntBonusTimer / TAUNT_BONUS_DURATION * 0.25);
      const radius = tauntFlashTimer > 0 ? 18 + Math.sin(tauntFlashTimer * 0.4) * 4 : 14;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tauntFlashTimer > 0 ? "#ffdd44" : "#ffaa22";
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Counter-attack ready glow
    if (emergencyDodgeCounterTimer > 0) {
      const px = player.x - cameraX + player.w * 0.5;
      const py = player.y + player.h * 0.5;
      const alpha = 0.3 + 0.2 * Math.sin(emergencyDodgeCounterTimer * 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#44ffdd";
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTextPanel(lines, y = 136) {
    ctx.fillStyle = "rgba(10,10,14,0.78)";
    ctx.fillRect(6, y, 308, 38);
    ctx.strokeStyle = "#bca8d2";
    ctx.lineWidth = 1;
    ctx.strokeRect(6, y, 308, 38);

    ctx.fillStyle = "#f3ecff";
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";

    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], 12, y + 6 + i * 12);
    }
    drawAmmoUI();
  }

  function drawHeartIcon(x, y, filled) {
    const px = Math.floor(x);
    const py = Math.floor(y);

    ctx.fillStyle = filled ? "#d63f66" : "#5c4651";
    ctx.fillRect(px + 1, py + 0, 2, 2);
    ctx.fillRect(px + 4, py + 0, 2, 2);
    ctx.fillRect(px + 0, py + 1, 7, 3);
    ctx.fillRect(px + 1, py + 4, 5, 2);
    ctx.fillRect(px + 2, py + 6, 3, 1);

    if (filled) {
      ctx.fillStyle = "#ff7a98";
      ctx.fillRect(px + 2, py + 1, 1, 1);
      ctx.fillRect(px + 5, py + 1, 1, 1);
    }
  }

  function drawTitle() {
    const t = titleTimer;
    const savedCamera = cameraX;
    cameraX = Math.floor((Math.sin(t * 0.012) * 0.5 + 0.5) * 220);
    drawSkyGradient();
    drawParallax();
    drawCityAtmosphere(false);
    cameraX = savedCamera;

    // 暗幕 + シネマティックレターボックス
    ctx.fillStyle = "rgba(6, 8, 14, 0.42)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(2, 3, 6, 0.85)";
    ctx.fillRect(0, 0, W, 9);
    ctx.fillRect(0, H - 9, W, 9);

    ctx.save();
    ctx.textAlign = "center";
    const cx = W * 0.5;
    const titleY = 42 + Math.sin(t * 0.07) * 1.5;
    const glowPulse = 0.5 + Math.sin(t * 0.05) * 0.5;

    // ネオン発光（加算合成の多層ブルーム）
    ctx.font = "italic bold 36px monospace";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 60, 110, ${(0.14 + glowPulse * 0.12).toFixed(3)})`;
    ctx.fillText("RRR", cx, titleY + 2);
    ctx.fillText("RRR", cx + 1, titleY + 3);
    ctx.fillStyle = `rgba(80, 170, 255, ${(0.08 + glowPulse * 0.1).toFixed(3)})`;
    ctx.fillText("RRR", cx - 2, titleY + 1);
    ctx.restore();

    // 色収差エッジ（シアン/マゼンタ）
    ctx.fillStyle = "#2bd6ff";
    ctx.fillText("RRR", cx - 1.5, titleY);
    ctx.fillStyle = "#ff3d6e";
    ctx.fillText("RRR", cx + 1.5, titleY + 1);
    // ロゴ本体（上から白→ピンクのグラデーション）
    const logoGrad = ctx.createLinearGradient(0, titleY - 30, 0, titleY + 4);
    logoGrad.addColorStop(0, "#ffffff");
    logoGrad.addColorStop(0.55, "#ffdce6");
    logoGrad.addColorStop(1, "#ff8aa8");
    ctx.fillStyle = logoGrad;
    ctx.fillText("RRR", cx, titleY);

    // サブタイトルと飾り罫線
    ctx.fillStyle = "#dde6f5";
    ctx.font = "8px monospace";
    ctx.fillText("R I L A  R I D E R S  R E S C U E", cx, titleY + 15);
    ctx.fillStyle = "rgba(255, 110, 140, 0.8)";
    ctx.fillRect(cx - 80, titleY + 20, 160, 1);
    ctx.fillStyle = "rgba(120, 200, 255, 0.55)";
    ctx.fillRect(cx - 58, titleY + 22, 116, 1);

    // モード表示（左下に控えめに）
    ctx.textAlign = "left";
    ctx.fillStyle = isCinematicMode() ? "rgba(156, 246, 255, 0.75)" : "rgba(255, 231, 176, 0.75)";
    ctx.font = "7px monospace";
    ctx.fillText(
      isCinematicMode() ? "CINEMATIC / G" : "RETRO / G",
      6,
      H - 13
    );
    ctx.textAlign = "center";

    const heroBob = Math.sin(t * 0.12) * 1.2;
    drawContactShadowScreen(66, 133 + heroBob, 24, 0.24, 1.6);
    drawContactShadowScreen(222, 131 + heroBob * 0.4, 18, 0.17, 1.2);
    drawHero(68, 108 + heroBob, 1, t * 1.08, 1.4);
    drawBoyfriend(228, 104 + heroBob * 0.4);

    // 紹介テキスト（フチ線つきの半透明バンド）
    ctx.fillStyle = "rgba(8, 9, 15, 0.62)";
    ctx.fillRect(0, 118, W, 42);
    ctx.fillStyle = "rgba(255, 130, 160, 0.45)";
    ctx.fillRect(0, 118, W, 1);
    ctx.fillStyle = "rgba(120, 200, 255, 0.3)";
    ctx.fillRect(0, 159, W, 1);
    ctx.fillStyle = "#e8edf8";
    ctx.font = "10px monospace";
    ctx.fillText("彼氏救出アクション / 都会ステージ", cx, 128);
    ctx.fillStyle = "#aeb9cf";
    ctx.font = "9px monospace";
    ctx.fillText("ピンチで攻撃力アップ", cx, 140);
    ctx.fillText("黒閃: 発生で高確化 / 継続失敗で通常へ戻る", cx, 151);

    // スタート表示（点滅ではなく呼吸するフェード）
    const pulse = 0.5 + Math.sin(t * 0.1) * 0.5;
    ctx.globalAlpha = 0.35 + pulse * 0.65;
    ctx.fillStyle = "#ffe7b0";
    ctx.font = "11px monospace";
    ctx.fillText("Tap / Enter でスタート", cx, 170);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCutsceneCityBackdrop(t, danger = false) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (danger) {
      sky.addColorStop(0, "#151326");
      sky.addColorStop(0.42, "#1f2d57");
      sky.addColorStop(0.9, "#2a2a3c");
    } else {
      sky.addColorStop(0, "#111628");
      sky.addColorStop(0.46, "#233760");
      sky.addColorStop(0.9, "#2e3244");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const farShift = -Math.floor(t * 0.12) % 22;
    for (let i = -2; i < 20; i += 1) {
      const bx = i * 22 + farShift;
      const h = 34 + ((i * 11 + Math.floor(t * 0.08)) % 26);
      const by = 128 - h;
      const body = danger ? "#1f2a4a" : "#1b2743";
      const edge = danger ? "#2a3a63" : "#2b3f65";
      ctx.fillStyle = body;
      ctx.fillRect(bx, by, 14, h);
      ctx.fillStyle = edge;
      ctx.fillRect(bx + 1, by + 1, 12, 2);
      for (let wy = by + 6; wy < 124; wy += 6) {
        const hot = (wy + i) % 3 === 0;
        ctx.fillStyle = hot ? (danger ? "#ff8aa3" : "#8ce5ff") : "#31486a";
        ctx.fillRect(bx + 2, wy, 2, 1);
        ctx.fillStyle = hot ? "#ffd39a" : "#2a3d5b";
        ctx.fillRect(bx + 9, wy + 1, 2, 1);
      }
    }

    const nearShift = -Math.floor(t * 0.23) % 28;
    for (let i = -2; i < 16; i += 1) {
      const bx = i * 28 + nearShift;
      const h = 48 + ((i * 7 + Math.floor(t * 0.16)) % 36);
      const by = 136 - h;
      ctx.fillStyle = danger ? "#202a42" : "#212e4a";
      ctx.fillRect(bx, by, 18, h);
      ctx.fillStyle = danger ? "#3a4d75" : "#395077";
      ctx.fillRect(bx + 1, by + 1, 16, 3);
      ctx.fillStyle = "#162236";
      ctx.fillRect(bx + 15, by + 2, 2, h - 2);
      for (let wy = by + 8; wy < 132; wy += 7) {
        const lit = (wy + i) % 2 === 0;
        ctx.fillStyle = lit ? (danger ? "#ffc16f" : "#7ce8ff") : "#2b405f";
        ctx.fillRect(bx + 3, wy, 2, 2);
        ctx.fillStyle = lit ? "#ffdcb1" : "#344f72";
        ctx.fillRect(bx + 11, wy + 1, 2, 1);
      }
      if (i % 5 === 0) {
        ctx.fillStyle = danger ? "#ff5f8a" : "#78e4ff";
        ctx.fillRect(bx + 4, by - 2, 10, 1);
      }
    }

    ctx.fillStyle = "rgba(170, 205, 255, 0.1)";
    ctx.fillRect(0, 118, W, 16);

    ctx.fillStyle = danger ? "#252737" : "#2a313f";
    ctx.fillRect(0, 132, W, 48);
    ctx.fillStyle = danger ? "#4f5f7a" : "#48566e";
    const laneShift = -Math.floor(t * 0.48) % 24;
    for (let x = laneShift - 24; x < W + 24; x += 24) {
      ctx.fillRect(x, 142, 11, 1);
      ctx.fillRect(x + 7, 156, 8, 1);
    }
  }

  function startClear() {
    if (gameState !== STATE.CLEAR) {
      gameState = STATE.CLEAR;
      clearTimer = 0;
      hudMessage = "STAGE CLEAR!";
      hudTimer = 180;
      if (seStageClear) playSound(seStageClear, 1.0);
    }
  }

  function drawKidnapVan(x, y, t) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    const wheel = Math.floor(t * 0.36) % 2;
    const blink = Math.floor(t * 0.32) % 2 === 0;

    ctx.fillStyle = "#10151f";
    ctx.fillRect(px + 2, py + 13, 8, 8);
    ctx.fillRect(px + 28, py + 13, 8, 8);
    ctx.fillStyle = "#677da8";
    ctx.fillRect(px + 4 + wheel, py + 15, 2, 2);
    ctx.fillRect(px + 30 + wheel, py + 15, 2, 2);
    ctx.fillStyle = "#1f2a3f";
    ctx.fillRect(px, py + 4, 40, 12);
    ctx.fillStyle = "#2f3d5b";
    ctx.fillRect(px + 1, py + 5, 38, 9);
    ctx.fillStyle = "#111726";
    ctx.fillRect(px + 30, py + 5, 8, 9);
    ctx.fillStyle = "#74dafb";
    ctx.fillRect(px + 4, py + 6, 8, 4);
    ctx.fillRect(px + 14, py + 6, 7, 4);
    ctx.fillStyle = "#ff6e8f";
    ctx.fillRect(px + 22, py + 6, 6, 4);
    ctx.fillStyle = "#1b2336";
    ctx.fillRect(px + 4, py + 11, 24, 1);
    ctx.fillStyle = "#f2f7ff";
    ctx.fillRect(px + 2, py + 9, 1, 2);
    ctx.fillRect(px + 37, py + 9, 1, 2);
    if (blink) {
      ctx.fillStyle = "#ffc47c";
      ctx.fillRect(px + 39, py + 9, 2, 2);
    }
  }

  function drawCutscenePolish(t, tension = 0.6) {
    const barH = Math.floor(9 + tension * 4);
    ctx.fillStyle = `rgba(0,0,0,${0.64 + tension * 0.14})`;
    ctx.fillRect(0, 0, W, barH);
    ctx.fillRect(0, H - barH, W, barH);

    const scanA = 0.02 + tension * 0.02;
    ctx.fillStyle = `rgba(255, 220, 190, ${scanA})`;
    for (let y = barH + 1; y < H - barH; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }

    const grainTick = Math.floor(t * 0.8);
    for (let y = barH + 1; y < H - barH - 1; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const p = (x * 3 + y * 5 + grainTick) % 13;
        if (p > 2) continue;
        ctx.fillStyle = p === 0 ? "rgba(255, 255, 255, 0.04)" : "rgba(130, 190, 255, 0.025)";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function drawCutsceneHero(x, y, facing, animFrame) {
    drawHero(x, y, facing, animFrame, 1);
  }

  function drawCutscene() {
    const t = cutsceneTime;
    const dangerScene = t >= 260;

    drawCutsceneCityBackdrop(t, dangerScene);

    if (!dangerScene) {
      const introBob = Math.sin(t * 0.14) * 1.1;
      drawCutsceneHero(88, 110 + introBob, 1, t * 1.05);
      drawBoyfriend(126, 108 + introBob * 0.45);

      ctx.fillStyle = "rgba(255, 225, 174, 0.22)";
      ctx.fillRect(70, 123, 84, 3);
      ctx.fillStyle = "rgba(124, 214, 255, 0.18)";
      ctx.fillRect(58, 118, 104, 2);

      drawTextPanel([
        "りら: 私はAI。普段はジムのインストラクターなリア充。",
        "シュークリームで元気回復、プロテインはバニラ派!",
      ]);
    } else {
      if (t < 720) {
        const k = clamp((t - 260) / 430, 0, 1);
        const vanX = 128 + k * 126;
        const run = Math.sin(t * 0.22) * 1.1;
        drawCutsceneHero(70 + run + k * 12, 111, 1, t * 1.2);

        drawKidnapVan(vanX - 12, 104 + Math.sin(t * 0.13) * 1);
        drawBoyfriend(vanX + 6, 102 + Math.sin(t * 0.18) * 0.7);

        const gruntBob = Math.sin(t * 0.22) * 1.1;
        ctx.fillStyle = "#191820";
        ctx.fillRect(vanX + 18, 101 + gruntBob, 12, 24);
        ctx.fillStyle = "#7d2f54";
        ctx.fillRect(vanX + 20, 100 + gruntBob, 8, 4);
        ctx.fillStyle = "#f0c8b2";
        ctx.fillRect(vanX + 21, 105 + gruntBob, 6, 4);
        ctx.fillStyle = "#212430";
        ctx.fillRect(vanX + 22, 106 + gruntBob, 1, 1);
        ctx.fillRect(vanX + 25, 106 + gruntBob, 1, 1);
        ctx.fillStyle = "#2d3548";
        ctx.fillRect(vanX + 19, 110 + gruntBob, 10, 8);
        ctx.fillStyle = "#151821";
        ctx.fillRect(vanX + 20, 118 + gruntBob, 3, 7);
        ctx.fillRect(vanX + 25, 118 + gruntBob, 3, 7);
        ctx.fillStyle = "#ff6f9f";
        ctx.fillRect(vanX + 12, 108 + gruntBob, 4, 2);

        for (let i = 0; i < 6; i += 1) {
          const dx = vanX - 14 - i * 8 + (Math.floor(t * 0.5) % 8);
          const dy = 125 + (i % 2);
          ctx.fillStyle = `rgba(255, 206, 156, ${0.26 - i * 0.03})`;
          ctx.fillRect(dx, dy, 5, 1);
        }

        if (t < 470) {
          drawTextPanel([
            "悪の組織が彼氏に甘い話を持ちかけた。",
            "断った彼氏はホームパーティー会場へ連行された。",
          ]);
        } else if (t < 650) {
          drawTextPanel([
            "彼氏がさらわれた! りらは会場へ全力ダッシュ。",
            "今すぐ追いかけて救出だ!",
          ]);
        } else {
          drawTextPanel([
            "ターゲットはマンション最上階のホームパーティー会場。",
            "りらの救出作戦が今、始まる。",
          ]);
        }
      } else {
        const prep = clamp((t - 720) / 220, 0, 1);
        const heroX = 64 + prep * 42 + Math.sin(t * 0.12) * 1.1;
        drawCutsceneHero(heroX, 110, 1, t * 1.22);
        drawKidnapVan(26 + Math.sin(t * 0.18) * 0.9, 114, t);

        const mx = 220;
        const my = 44;
        ctx.fillStyle = "#1a2031";
        ctx.fillRect(mx, my, 88, 112);
        ctx.fillStyle = "#2a324a";
        ctx.fillRect(mx + 3, my + 4, 82, 104);
        ctx.fillStyle = "#425076";
        ctx.fillRect(mx + 10, my + 10, 68, 12);
        ctx.fillStyle = "#7ad6ff";
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(mx + 14 + i * 12, my + 14, 3, 3);
        }
        ctx.fillStyle = "#251d2b";
        ctx.fillRect(mx + 32, my + 58, 24, 42);
        ctx.fillStyle = "#8f2b58";
        ctx.fillRect(mx + 30, my + 56, 28, 3);
        ctx.fillStyle = "rgba(186, 228, 255, 0.2)";
        ctx.fillRect(mx + 35, my + 63, 18, 30);

        drawTextPanel([
          "りらはマンション街区への侵入ルートを確保。",
          "この先でSTAGE 1が始まる。",
        ]);
      }
    }

    drawCutscenePolish(t, dangerScene ? 0.84 : 0.64);

    ctx.fillStyle = "rgba(0,0,0,0.44)";
    ctx.fillRect(90, 8, 140, 14);
    ctx.fillStyle = "#f4f3ff";
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("タップ / Enter でスキップ", 101, 11);
  }

  function drawStageIntroCutscene() {
    const t = stageIntroTimer;
    const stage2 = currentStageNumber === 2;
    const stage3 = currentStageNumber >= 3;
    drawCutsceneCityBackdrop(t * (stage3 ? 0.72 : 0.84), stage3);

    if (stage2) {
      ctx.fillStyle = "#2a3045";
      ctx.fillRect(0, 132, W, 48);
      ctx.fillStyle = "#4f5d74";
      for (let i = 0; i < W; i += 16) {
        ctx.fillRect(i, 140, 8, 1);
      }

      const approach = clamp(t / 210, 0, 1);
      const heroX = 42 + approach * 76 + Math.sin(t * 0.18) * 1.1;
      const heroY = 110 + Math.sin(t * 0.11) * 0.8;
      drawCutsceneHero(heroX, heroY, 1, t * 1.2);

      const bossX = 232 + Math.sin(t * 0.07) * 1.6;
      const bossY = 100;
      ctx.fillStyle = "#121928";
      ctx.fillRect(bossX - 7, bossY + 2, 14, 6);
      ctx.fillStyle = "#69b7ff";
      ctx.fillRect(bossX - 5, bossY + 3, 10, 3);
      ctx.fillStyle = "#f1d7c1";
      ctx.fillRect(bossX - 4, bossY + 8, 8, 5);
      ctx.fillStyle = "#29334a";
      ctx.fillRect(bossX - 6, bossY + 13, 12, 12);
      ctx.fillStyle = "#58d8b8";
      ctx.fillRect(bossX - 13, bossY + 10, 5, 15);
      ctx.fillRect(bossX + 8, bossY + 10, 5, 15);
      ctx.fillStyle = "#ffe9af";
      ctx.fillRect(bossX - 11, bossY + 14, 1, 2);
      ctx.fillRect(bossX + 10, bossY + 14, 1, 2);
      ctx.fillStyle = "rgba(125, 220, 255, 0.18)";
      ctx.fillRect(bossX - 17, bossY + 5, 34, 24);

      if (t < 118) {
        drawTextPanel([
          "STAGE 2: セントラルネオン街区へ到達。",
          "孔雀人間が街区のゲートを封鎖している。",
        ]);
      } else if (t < 244) {
        drawTextPanel([
          "連撃と羽弾を見切り、中央アリーナを突破せよ。",
          "ここを越えればマンション街区へのルートが開く。",
        ]);
      } else {
        drawTextPanel([
          "りら: 迷ってる時間はない。正面突破で行く!",
          "STAGE 2 START",
        ]);
      }
      drawCutscenePolish(t, 0.72);
    } else {
      const moonX = 250 + Math.sin(t * 0.03) * 3;
      const moonY = 26 + Math.sin(t * 0.05) * 1.2;
      ctx.fillStyle = "rgba(244, 235, 198, 0.2)";
      ctx.fillRect(moonX - 12, moonY - 12, 24, 24);
      ctx.fillStyle = "#f3ebcd";
      ctx.fillRect(moonX - 5, moonY - 5, 10, 10);

      const mx = 184;
      const my = 40;
      ctx.fillStyle = "#1a2031";
      ctx.fillRect(mx, my, 98, 118);
      ctx.fillStyle = "#2a324a";
      ctx.fillRect(mx + 3, my + 4, 92, 110);
      ctx.fillStyle = "#3e4a6a";
      ctx.fillRect(mx + 10, my + 10, 78, 14);
      ctx.fillStyle = "#7ad6ff";
      for (let i = 0; i < 6; i += 1) {
        ctx.fillRect(mx + 14 + i * 12, my + 14, 3, 3);
      }
      ctx.fillStyle = "#251d2b";
      ctx.fillRect(mx + 37, my + 62, 26, 44);
      ctx.fillStyle = "#8f2b58";
      ctx.fillRect(mx + 35, my + 60, 30, 3);

      drawBoyfriend(mx + 43, my + 70);
      ctx.fillStyle = "rgba(160, 218, 255, 0.24)";
      ctx.fillRect(mx + 40, my + 66, 20, 30);

      const heroX = 72 + clamp(t / 220, 0, 1) * 70 + Math.sin(t * 0.12) * 1.1;
      drawCutsceneHero(heroX, 110, 1, t * 1.14);

      if (t >= 176) {
        const vanX = 26 + Math.sin(t * 0.16) * 1.1;
        drawKidnapVan(vanX, 114, t);
      }

      if (t < 130) {
        drawTextPanel([
          "STAGE 3: マンション街区へ突入。",
          "彼氏は最上階のホームパーティー会場にいる。",
        ]);
      } else if (t < 264) {
        drawTextPanel([
          "会場には妨害ギミックと構成員が待ち構える。",
          "突破して白ヒゲの神との決戦へ。",
        ]);
      } else {
        drawTextPanel([
          "りら: 必ず助け出して、ふたりで帰る。",
          "FINAL STAGE START",
        ]);
      }
      drawCutscenePolish(t, 0.82);
    }

    ctx.fillStyle = "rgba(0,0,0,0.44)";
    ctx.fillRect(90, 8, 140, 14);
    ctx.fillStyle = "#f4f3ff";
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("タップ / Enter でスキップ", 101, 11);
  }

  function drawPreBossCutscene() {
    const rawT = preBossCutsceneTimer;
    const peacockBoss = stage.boss && (stage.boss.kind === "peacock" || stage.boss.kind === "peacockman");
    const stage2PeacockHuman = stage.boss && stage.boss.kind === "peacockman";

    if (peacockBoss) {
      if (rawT < 0) {
        drawWorld();
        const enterRatio = clamp((rawT + PRE_BOSS_ENTRY_DURATION) / PRE_BOSS_ENTRY_DURATION, 0, 1);
        const fade = clamp(0.38 + enterRatio * 0.32, 0.38, 0.74);
        const gx = Math.floor(stage.goal.x - cameraX);
        const gy = Math.floor(stage.goal.y);
        ctx.fillStyle = `rgba(8,10,16,${fade})`;
        ctx.fillRect(gx - 4, gy + 3, stage.goal.w + 8, stage.goal.h - 3);
        drawTextPanel([
          stage2PeacockHuman
            ? "りらはゲートを開き、孔雀人間のアリーナへ入る。"
            : "りらはゲートを開き、孔雀ボスのアリーナへ入る。"
        ]);
        drawCutscenePolish(rawT + PRE_BOSS_ENTRY_DURATION, 0.52);

        ctx.fillStyle = "rgba(0,0,0,0.44)";
        ctx.fillRect(90, 8, 140, 14);
        ctx.fillStyle = "#f4f3ff";
        ctx.font = "9px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("タップ / Enter でスキップ", 101, 11);
        return;
      }

      const t = rawT + 110;
      const camBackup = cameraX;
      cameraX = clamp(stage.goal.x - 120, 0, stage.width - W);
      drawSkyGradient();
      drawParallax();
      cameraX = camBackup;

      ctx.fillStyle = "#232d40";
      ctx.fillRect(0, 132, W, 48);
      ctx.fillStyle = "#4e5f7f";
      for (let i = 0; i < W; i += 20) ctx.fillRect(i, 140, 10, 1);

      const approach = clamp(t / 146, 0, 1);
      const heroX = 62 + approach * 94;
      drawCutsceneHero(heroX, 112, 1, t * 1.1);

      const bossX = 216 + Math.sin(t * 0.1) * 1.2;
      const bossY = 106;
      if (!stage2PeacockHuman) {
        ctx.fillStyle = "#11202f";
        ctx.fillRect(bossX - 10, bossY + 12, 20, 15);
        ctx.fillStyle = "#2180ad";
        ctx.fillRect(bossX - 8, bossY + 14, 16, 10);
        ctx.fillStyle = "#45c3df";
        ctx.fillRect(bossX - 7, bossY + 15, 5, 7);
        ctx.fillRect(bossX + 2, bossY + 15, 5, 7);
        ctx.fillStyle = "#6de3f0";
        ctx.fillRect(bossX - 3, bossY + 11, 6, 6);
        ctx.fillStyle = "#f3d57f";
        ctx.fillRect(bossX + 3, bossY + 13, 5, 2);
        ctx.fillStyle = "#1a283f";
        ctx.fillRect(bossX - 1, bossY + 12, 3, 3);
        ctx.fillStyle = "#f4f7ff";
        ctx.fillRect(bossX, bossY + 13, 1, 1);

        ctx.fillStyle = "#2b9cc4";
        ctx.fillRect(bossX - 18, bossY + 8, 8, 14);
        ctx.fillRect(bossX + 10, bossY + 8, 8, 14);
        ctx.fillStyle = "#6fe3ef";
        ctx.fillRect(bossX - 15, bossY + 11, 2, 7);
        ctx.fillRect(bossX + 13, bossY + 11, 2, 7);
      } else {
        ctx.fillStyle = "#1a2538";
        ctx.fillRect(bossX - 8, bossY + 2, 16, 6);
        ctx.fillStyle = "#6cb9ff";
        ctx.fillRect(bossX - 6, bossY + 3, 12, 3);
        ctx.fillStyle = "#f0d6c0";
        ctx.fillRect(bossX - 5, bossY + 8, 10, 6);
        ctx.fillStyle = "#2a3040";
        ctx.fillRect(bossX - 3, bossY + 10, 1, 1);
        ctx.fillRect(bossX + 2, bossY + 10, 1, 1);
        ctx.fillStyle = "#2d415f";
        ctx.fillRect(bossX - 8, bossY + 14, 16, 12);
        ctx.fillStyle = "#5b7199";
        ctx.fillRect(bossX - 7, bossY + 15, 14, 3);
        ctx.fillStyle = "#d2dcef";
        ctx.fillRect(bossX - 1, bossY + 15, 2, 10);
        ctx.fillStyle = "#2a4f58";
        ctx.fillRect(bossX - 17, bossY + 10, 7, 18);
        ctx.fillRect(bossX + 10, bossY + 10, 7, 18);
        ctx.fillStyle = "#5de0be";
        ctx.fillRect(bossX - 15, bossY + 13, 3, 12);
        ctx.fillRect(bossX + 12, bossY + 13, 3, 12);
      }

      if (t < 152) {
        drawTextPanel(stage2PeacockHuman
          ? [
            "ステージ2終点: セントラルアリーナに到着。",
            "ゲートの先で孔雀人間が待ち構える。",
          ]
          : [
            "ステージ1終点: ネオンアリーナに到着。",
            "ゲートの先で孔雀ボスが待ち構える。",
          ]);
      } else if (t < 290) {
        drawTextPanel(stage2PeacockHuman
          ? [
            "孔雀人間出現! 連撃と羽弾を見切って撃破せよ。",
            "倒せばSTAGE 3のマンション街区へ進める。",
          ]
          : [
            "孔雀ボス出現! 突進と羽弾を見切って倒せ。",
            "倒せばSTAGE 2の都会中心部へ進める。",
          ]);
      } else {
        drawTextPanel(stage2PeacockHuman
          ? [
            "りら: 一気に決める。次は最終エリアへ。",
            "準備完了、BOSS BATTLE!",
          ]
          : [
            "りら: ここを突破して次の街区へ進む!",
            "準備完了、BOSS BATTLE!",
          ]);
      }
      drawCutscenePolish(t, 0.62);

      ctx.fillStyle = "rgba(0,0,0,0.44)";
      ctx.fillRect(90, 8, 140, 14);
      ctx.fillStyle = "#f4f3ff";
      ctx.font = "9px monospace";
      ctx.textBaseline = "top";
      ctx.fillText("タップ / Enter でスキップ", 101, 11);
      return;
    }

    if (rawT < 0) {
      drawWorld();
      const enterRatio = clamp((rawT + PRE_BOSS_ENTRY_DURATION) / PRE_BOSS_ENTRY_DURATION, 0, 1);
      const fade = clamp(0.42 + enterRatio * 0.38, 0.42, 0.8);
      const gx = Math.floor(stage.goal.x - cameraX);
      const gy = Math.floor(stage.goal.y);
      ctx.fillStyle = `rgba(8,10,16,${fade})`;
      ctx.fillRect(gx - 4, gy + 3, stage.goal.w + 8, stage.goal.h - 3);
      drawTextPanel(["りらはマンションの扉を開き、会場へ入る。"]);
      drawCutscenePolish(rawT + PRE_BOSS_ENTRY_DURATION, 0.58);

      ctx.fillStyle = "rgba(0,0,0,0.44)";
      ctx.fillRect(90, 8, 140, 14);
      ctx.fillStyle = "#f4f3ff";
      ctx.font = "9px monospace";
      ctx.textBaseline = "top";
      ctx.fillText("タップ / Enter でスキップ", 101, 11);
      return;
    }

    const t = rawT + PRE_BOSS_MOVIE_START_AT;
    const showInterior = t >= 230;
    const approach = clamp(t / 156, 0, 1);
    const doorOpen = clamp((t - 114) / 42, 0, 1);
    const enter = clamp((t - 166) / 58, 0, 1);
    const party = clamp((t - 246) / 138, 0, 1);
    const descend = clamp((t - 322) / 128, 0, 1);

    if (!showInterior) {
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#1a2746";
      for (let i = 0; i < W; i += 16) {
        const h = 36 + ((i / 16) % 5) * 12;
        ctx.fillRect(i, 124 - h, 11, h);
        if ((i / 16) % 2 === 0) {
          ctx.fillStyle = "#7ce2ff";
          ctx.fillRect(i + 2, 124 - h + 8, 2, 2);
          ctx.fillStyle = "#1a2746";
        }
      }

      const mx = 172;
      const my = 48;
      ctx.fillStyle = "#22293b";
      ctx.fillRect(mx, my, 104, 112);
      ctx.fillStyle = "#2f3952";
      ctx.fillRect(mx + 4, my + 4, 96, 104);
      ctx.fillStyle = "#455173";
      ctx.fillRect(mx + 10, my + 10, 84, 18);
      ctx.fillStyle = "#6ad7ff";
      for (let i = 0; i < 7; i += 1) {
        ctx.fillRect(mx + 14 + i * 12, my + 16, 4, 4);
      }

      ctx.fillStyle = "#2a1e24";
      ctx.fillRect(mx + 39, my + 64, 26, 40);
      ctx.fillStyle = "#8f2b58";
      ctx.fillRect(mx + 37, my + 62, 30, 3);

      ctx.fillStyle = "#262d3b";
      ctx.fillRect(0, 132, W, 48);
      ctx.fillStyle = "#4f5d73";
      for (let i = 0; i < W; i += 18) ctx.fillRect(i, 140, 10, 1);

      const heroX = 36 + approach * 122 + enter * 16;
      const heroY = 112 - enter * 4;
      drawCutsceneHero(heroX, heroY, 1, t * 1.3);

      const doorW = Math.max(7, Math.floor(26 - doorOpen * 18));
      ctx.fillStyle = "#11141d";
      ctx.fillRect(mx + 39, my + 64, doorW, 40);
      ctx.fillStyle = "rgba(255, 220, 170, 0.18)";
      ctx.fillRect(mx + 39 + doorW, my + 64, 26 - doorW, 40);

      ctx.fillStyle = "rgba(255, 223, 184, 0.16)";
      ctx.fillRect(mx + 46, my + 72, 14, 28);
    } else {
      drawMansionInteriorBackdrop();

      const roomX = 100;
      const roomY = 62;
      const roomW = 136;
      const roomH = 70;
      ctx.fillStyle = `rgba(62, 25, 80, ${0.46 + party * 0.28})`;
      ctx.fillRect(roomX, roomY, roomW, roomH);

      const pulse = 0.18 + (Math.sin(t * 0.24) * 0.5 + 0.5) * 0.24;
      ctx.fillStyle = `rgba(255, 123, 196, ${pulse})`;
      ctx.fillRect(roomX + 4, roomY + 4, roomW - 8, 2);
      ctx.fillStyle = `rgba(124, 214, 255, ${pulse * 0.86})`;
      ctx.fillRect(roomX + 4, roomY + 10, roomW - 8, 1);

      const guests = [roomX + 14, roomX + 36, roomX + 62, roomX + 82, roomX + 110];
      for (let i = 0; i < guests.length; i += 1) {
        const gx = guests[i];
        const bob = Math.sin(t * 0.16 + i * 0.8) * 1;
        ctx.fillStyle = i % 2 === 0 ? "#5f3f5e" : "#3d3856";
        ctx.fillRect(gx, roomY + 34 + bob, 9, 18);
        ctx.fillStyle = "#f0c7b5";
        ctx.fillRect(gx + 1, roomY + 30 + bob, 7, 4);
        ctx.fillStyle = "#201f2d";
        ctx.fillRect(gx + 2, roomY + 31 + bob, 1, 1);
        ctx.fillRect(gx + 6, roomY + 31 + bob, 1, 1);
        if (i <= 1) {
          // Clearly weak party guests.
          ctx.fillStyle = "#a0d6ff";
          ctx.fillRect(gx + 8, roomY + 35 + bob, 1, 1);
        }
      }

      ctx.fillStyle = "#3a2f28";
      ctx.fillRect(roomX + 46, roomY + 46, 34, 7);
      ctx.fillStyle = "#bb8e67";
      ctx.fillRect(roomX + 48, roomY + 44, 30, 2);
      ctx.fillStyle = "#f2d5a8";
      ctx.fillRect(roomX + 51, roomY + 43, 2, 1);
      ctx.fillRect(roomX + 73, roomY + 43, 2, 1);

      drawCutsceneHero(66, 112, 1, t * 1.2);

      if (descend > 0.01) {
        const beamX = roomX + 102;
        const beamTop = 0;
        const beamBottom = roomY + 60;
        const beamW = 13 + Math.sin(t * 0.35) * 2;
        ctx.fillStyle = `rgba(236, 246, 255, ${0.16 + descend * 0.28})`;
        ctx.fillRect(beamX - beamW, beamTop, beamW * 2, beamBottom);
        ctx.fillStyle = `rgba(255, 242, 196, ${0.14 + descend * 0.22})`;
        ctx.fillRect(beamX - 4, beamTop, 8, beamBottom);

        for (let i = 0; i < 4; i += 1) {
          const lx = beamX - 18 + i * 12 + Math.sin((t + i * 22) * 0.2) * 2;
          ctx.fillStyle = "rgba(210, 236, 255, 0.42)";
          ctx.fillRect(Math.floor(lx), Math.floor(24 + i * 10), 2, 8);
        }

        const godY = roomY - 28 + descend * 42;
        ctx.fillStyle = "#f6f8ff";
        ctx.fillRect(beamX - 8, Math.floor(godY), 16, 8);
        ctx.fillStyle = "#e5ebf9";
        ctx.fillRect(beamX - 7, Math.floor(godY + 1), 14, 5);
        ctx.fillStyle = "#f2dec5";
        ctx.fillRect(beamX - 4, Math.floor(godY + 7), 8, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(beamX - 6, Math.floor(godY + 11), 12, 6);
        ctx.fillStyle = "#d7dff2";
        ctx.fillRect(beamX - 4, Math.floor(godY + 12), 8, 2);
        ctx.fillStyle = "#f8fbff";
        ctx.fillRect(beamX - 7, Math.floor(godY + 15), 14, 8);
        ctx.fillStyle = "#dee6f8";
        ctx.fillRect(beamX - 5, Math.floor(godY + 16), 10, 4);
        ctx.fillStyle = "#f5d785";
        ctx.fillRect(beamX - 5, Math.floor(godY - 3), 10, 2);
      }
    }

    drawCutscenePolish(t, 0.76);

    if (t < 138) {
      drawTextPanel(["マンション前に到着。"]);
    } else if (t < 230) {
      drawTextPanel(["扉が開いた。りらは会場へ突入。"]);
    } else if (t < 330) {
      drawTextPanel(["会場には勧誘された構成員もいる。"]);
    } else {
      drawTextPanel(["ホームパーティーで白ヒゲの神が降臨。"]);
    }

    ctx.fillStyle = "rgba(0,0,0,0.44)";
    ctx.fillRect(90, 8, 140, 14);
    ctx.fillStyle = "#f4f3ff";
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("タップ / Enter でスキップ", 101, 11);
  }

  function drawGodSecondFormCutscene() {
    const t = godPhaseCutsceneTimer;
    const boss = stage && stage.boss ? stage.boss : null;

    drawMansionInteriorBackdrop();
    ctx.fillStyle = "rgba(12, 14, 24, 0.2)";
    ctx.fillRect(0, 0, W, H);

    // EX Mode Visuals Tone Down
    const alpha = isExBattleRankActive() ? 0.08 : 0.18;
    ctx.fillStyle = `rgba(255, 220, 150, ${alpha + (0.5 + Math.sin(t * 0.34) * 0.5) * 0.05})`;
    // replacing original line which was: ctx.fillStyle = `rgba(255, 220, 150, ${0.18 + glow * 0.05})`;
    // but here 'glow' variable is not defined in this scope yet (it was defined inside drawBoss loop in original code, 
    // but we are modifying drawGodSecondFormCutscene which might share similar logic or I am misplacing it).
    // Wait, the original plan target was `drawBoss` or `drawGame`?
    // Let's check `drawGame` or where the "screen tint" for EX mode is.
    // The previous view_file for 12560 showed `drawGodSecondFormCutscene`.
    // I need to find the main game loop draw function for "EX Mode visuals".
    // It's likely in `drawGame` or `drawBattleRankOverlay`.
    // I will skip this chunk for now and find the correct location in `drawGame`.

    ctx.fillStyle = "#2a3146";
    ctx.fillRect(0, 132, W, 48);
    ctx.fillStyle = "#50607c";
    for (let x = -8; x < W + 8; x += 20) {
      ctx.fillRect(x + ((Math.floor(t * 0.35) % 20) - 10), 141, 9, 1);
      ctx.fillRect(x + 6 + ((Math.floor(t * 0.35) % 20) - 10), 155, 7, 1);
    }

    drawCutsceneHero(player.x - cameraX, player.y, player.facing, player.anim + t * 0.08);
    if (boss && boss.active) {
      drawBoss();

      const bx = Math.floor(boss.x - cameraX + boss.w * 0.5);
      const by = Math.floor(boss.y + boss.h * 0.34);
      const charge = clamp(t / (GOD_PHASE_CUTSCENE_DURATION * 0.74), 0, 1);
      const pulse = 0.5 + Math.sin(t * 0.34) * 0.5;
      const beamH = Math.floor(56 + charge * 44);
      const beamW = Math.floor(8 + charge * 7 + pulse * 2);

      ctx.fillStyle = `rgba(200, 236, 255, ${0.12 + charge * 0.22})`;
      ctx.fillRect(bx - beamW, by - beamH, beamW * 2, beamH + 10);
      ctx.fillStyle = `rgba(255, 228, 168, ${0.1 + charge * 0.22})`;
      ctx.fillRect(bx - 3, by - beamH - 6, 6, beamH + 20);

      for (let i = 0; i < 10; i += 1) {
        const ang = (Math.PI * 2 * i) / 10 + t * 0.05;
        const len = 14 + charge * 20 + (i % 2 === 0 ? 7 : 0);
        const ex = Math.floor(bx + Math.cos(ang) * len);
        const ey = Math.floor(by + Math.sin(ang) * len * 0.66);
        ctx.strokeStyle = `rgba(152, 226, 255, ${0.24 + charge * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    drawCutscenePolish(t, 0.9);
    if (t < 70) {
      drawTextPanel(["白ヒゲの神が怒り、会場に光が満ちる。"]);
    } else if (t < 148) {
      drawTextPanel(["神が第2形態へ変貌! 攻撃パターンが変化する。"]);
    } else {
      drawTextPanel(["第2形態戦 開始。電磁パネルで隙を作れ!"]);
    }

    ctx.fillStyle = "rgba(0,0,0,0.44)";
    ctx.fillRect(86, 8, 148, 14);
    ctx.fillStyle = "#f4f3ff";
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("タップ / Enter でスキップ", 97, 11);
  }

  function drawHUD() {
    const hudH = 22;
    ctx.fillStyle = "rgba(9, 8, 12, 0.78)";
    ctx.fillRect(0, 0, W, hudH);

    const heartStartX = 6;
    const heartY = 6;
    for (let i = 0; i < MAX_HEARTS; i += 1) {
      drawHeartIcon(heartStartX + i * 10, heartY, i < playerHearts);
    }

    ctx.fillStyle = "#f7f1ff";
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`x${playerLives}`, heartStartX + MAX_HEARTS * 10 + 3, 6);

    const bossActive = gameState === STATE.BOSS && stage.boss.active;
    const burstBarX = 80;
    const burstBarY = 7;
    const burstBarW = bossActive ? 90 : 150;
    const burstGap = 2;
    const burstInnerW = Math.max(16, burstBarW - 2);
    const burstSegW1 = Math.max(7, Math.floor((burstInnerW - burstGap) * 0.5));
    const burstSegW2 = Math.max(7, burstInnerW - burstSegW1 - burstGap);
    const burstSegX1 = burstBarX + 1;
    const burstSegX2 = burstSegX1 + burstSegW1 + burstGap;

    const burstRatio1 = clamp(proteinBurstGauge1 / PROTEIN_BURST_REQUIRE, 0, 1);
    const burstRatio2 = clamp(proteinBurstGauge2 / PROTEIN_BURST_REQUIRE, 0, 1);
    const burstReady1 = proteinBurstGauge1 >= PROTEIN_BURST_MIN;
    const burstReady2 = proteinBurstGauge2 >= PROTEIN_BURST_MIN;
    const burstTone1 = burstChargeTone(burstRatio1);
    const burstTone2 = {
      hue: (burstTone1.hue + 84) % 360,
      sat: clamp(burstTone1.sat + 6, 28, 98),
      light: clamp(burstTone1.light + 2, 38, 86),
    };
    const isBerserker = playerStyle === "berserker";
    const activeTone = isBerserker ? burstTone1 : burstTone2;

    const drawBurstSegment = (x, w, ratio, tone, ready, active) => {
      const fillLight = clamp(tone.light + (ready ? 8 : 2), 44, 86);
      const fillAlpha = clamp(0.6 + ratio * 0.3 + (ready ? 0.08 : 0), 0.56, 0.98);
      ctx.fillStyle = "rgba(27, 34, 50, 0.9)";
      ctx.fillRect(x, burstBarY + 1, w, 4);
      ctx.fillStyle = `hsla(${tone.hue}, ${tone.sat}%, ${fillLight}%, ${fillAlpha})`;
      ctx.fillRect(x, burstBarY + 1, Math.floor(w * ratio), 4);
      if (ratio > 0.02) {
        const sheenW = Math.max(1, Math.floor(w * Math.min(1, ratio * 1.08)));
        ctx.fillStyle = `hsla(${tone.hue}, ${Math.min(100, tone.sat + 10)}%, ${Math.min(90, fillLight + 14)}%, ${0.22 + ratio * 0.22})`;
        ctx.fillRect(x, burstBarY + 1, sheenW, 1);
      }
      const markerX = x + Math.floor(w * (PROTEIN_BURST_MIN / PROTEIN_BURST_REQUIRE));
      ctx.fillStyle = "rgba(255, 225, 140, 0.9)";
      ctx.fillRect(markerX, burstBarY + 1, 1, 4);
      if (active) {
        ctx.fillStyle = "#fff0c2";
        ctx.fillRect(x, burstBarY + 1, w, 1);
      }
    };

    ctx.fillStyle = "rgba(27, 34, 50, 0.96)";
    // Use full width for single bar
    const fullBurstW = burstSegW1 + burstGap + burstSegW2;
    ctx.fillRect(burstBarX, burstBarY, burstBarW, 6);
    drawBurstSegment(burstBarX + 1, fullBurstW, burstRatio1, activeTone, burstReady1, proteinBurstTimer > 0 || isTimeBurstActive());

    // Update DOM HUD Layer
    updateStyleUI();

    if (bossActive) {
      const barX = 176;
      const barY = 7;
      const barW = 138;
      const totalBoss = bossTotalHealth();
      const ratio = clamp(totalBoss.hp / totalBoss.maxHp, 0, 1);
      ctx.fillStyle = "#2a1314";
      ctx.fillRect(barX, barY, barW, 6);
      ctx.fillStyle = "#e25555";
      ctx.fillRect(barX + 1, barY + 1, Math.floor((barW - 2) * ratio), 4);

      if (stage.boss.kind === "peacock" && stage.bossTwins && stage.bossTwins.length > 0) {
        ctx.fillStyle = "rgba(235, 245, 255, 0.92)";
        ctx.font = "7px monospace";
        ctx.fillText("x2", barX + barW - 12, barY + 7);
      } else if (stage.boss.kind === "peacockman") {
        ctx.fillStyle = "rgba(235, 245, 255, 0.92)";
        ctx.font = "7px monospace";
        ctx.fillText("HMN", barX + barW - 16, barY + 7);
      } else if (stage.boss.kind === "god") {
        const phase = stage.boss.phase || 1;
        ctx.fillStyle = "rgba(235, 245, 255, 0.92)";
        ctx.font = "7px monospace";
        ctx.fillText(`P${phase}`, barX + barW - 14, barY + 7);

        if (phase >= 2) {
          const advRatio = clamp((stage.boss.gimmickAdvantageTimer || 0) / 220, 0, 1);
          ctx.fillStyle = "#18303a";
          ctx.fillRect(barX, barY + 8, barW, 3);
          ctx.fillStyle = "#7be9ff";
          ctx.fillRect(barX + 1, barY + 9, Math.floor((barW - 2) * advRatio), 1);
        }
      }
    }

    const blackFlashChainActive = blackFlashChain > 0;
    const blackFlashChance = blackFlashChanceWithRank();
    if (blackFlashChance >= 0.5) {
      const blackFlashChanceStyle = blackFlashChanceHudColor(blackFlashChance);
      const text = formatBlackFlashChanceText(blackFlashChance);
      const textW = Math.ceil(ctx.measureText(text).width);
      const padX = 3;
      const boxW = textW + padX * 2 + 1;
      const boxX = W - boxW - 3;
      const boxY = 3;
      ctx.fillStyle = `rgba(20, 12, 18, ${0.78 + (blackFlashChainActive ? 0.08 : 0)})`;
      ctx.fillRect(boxX, boxY, boxW, 8);
      const chanceBarAlpha = blackFlashChainActive
        ? clamp(0.88 + Math.sin(player.anim * 0.28) * 0.08, 0.78, 0.98)
        : 0.92;
      ctx.fillStyle = `rgba(${blackFlashChanceStyle.barRgb}, ${chanceBarAlpha})`;
      ctx.fillRect(boxX, boxY + 7, boxW - 1, 1);
      ctx.fillStyle = blackFlashChanceStyle.text;
      ctx.fillText(text, boxX + padX, boxY + 1);
    }
    if (blackFlashResultTimer > 0 && blackFlashResultText) {
      const resultRatio = clamp(blackFlashResultTimer / BLACK_FLASH_RESULT_DURATION, 0, 1);
      const text = blackFlashResultText;
      const textW = Math.ceil(ctx.measureText(text).width);
      const padX = 3;
      const boxW = textW + padX * 2 + 1;
      const boxX = W - boxW - 3;
      const boxY = blackFlashChance >= 0.5 ? 12 : 3;
      const alpha = 0.62 + resultRatio * 0.32;
      ctx.fillStyle = `rgba(18, 10, 14, ${alpha})`;
      ctx.fillRect(boxX, boxY, boxW, 8);
      ctx.fillStyle = `rgba(255, 210, 150, ${0.72 + resultRatio * 0.26})`;
      ctx.fillRect(boxX, boxY + 7, boxW - 1, 1);
      ctx.fillStyle = `rgba(255, 244, 212, ${0.78 + resultRatio * 0.22})`;
      ctx.fillText(text, boxX + padX, boxY + 1);
    }

    const rank = currentBattleRank();
    const rankProgress = battleRankProgressRatio();
    const rankFlash = clamp(battleRankFlashTimer / 56, 0, 1);
    const rankBreak = clamp(battleRankBreakFlashTimer / 30, 0, 1);
    const rankLabel = rank.long;
    ctx.font = "6px monospace";
    const rankLabelW = Math.ceil(ctx.measureText(rankLabel).width);
    const rankBoxX = 6;
    const rankBoxY = 13;
    const rankBoxW = clamp(rankLabelW + 46, 112, bossActive ? 168 : 188);
    const rankBoxH = 9;
    const rankFill = 0.52 + rankFlash * 0.2;
    ctx.fillStyle = `rgba(10, 12, 20, ${rankFill})`;
    ctx.fillRect(rankBoxX, rankBoxY, rankBoxW, rankBoxH);
    ctx.strokeStyle = rankBreak > 0.01
      ? `rgba(255, 96, 96, ${0.52 + rankBreak * 0.36})`
      : `rgba(176, 204, 226, ${0.26 + rankFlash * 0.38})`;
    ctx.strokeRect(rankBoxX, rankBoxY, rankBoxW, rankBoxH);
    ctx.font = "6px monospace";
    ctx.fillStyle = rankBreak > 0.01 ? "#ff9f9f" : rank.color;
    ctx.fillText(rankLabel, rankBoxX + 3, rankBoxY + 2);
    const gaugeX = rankBoxX + rankLabelW + 7;
    const gaugeY = rankBoxY + 3;
    const gaugeW = Math.max(20, rankBoxW - (gaugeX - rankBoxX) - 3);
    ctx.fillStyle = "rgba(18, 28, 36, 0.95)";
    ctx.fillRect(gaugeX, gaugeY, gaugeW, 4);
    ctx.fillStyle = rankBreak > 0.01
      ? "rgba(255, 122, 122, 0.8)"
      : `rgba(124, 234, 255, ${0.64 + rankFlash * 0.22})`;
    ctx.fillRect(gaugeX + 1, gaugeY + 1, Math.max(1, Math.floor((gaugeW - 2) * rankProgress)), 2);

    if (battleRankFlashTimer > 24) {
      const upRatio = clamp((battleRankFlashTimer - 24) / 32, 0, 1);
      const upPulse = 0.5 + Math.sin(player.anim * 0.34) * 0.5;
      const upBoxX = rankBoxX + rankBoxW - 40;
      ctx.fillStyle = `rgba(255, 130, 108, ${0.24 + upRatio * 0.34})`;
      ctx.fillRect(upBoxX, rankBoxY - 9, 36, 8);
      ctx.fillStyle = `rgba(255, 246, 194, ${0.72 + upPulse * 0.22})`;
      ctx.font = "9px monospace";
      ctx.fillText("UP!", upBoxX + 10, rankBoxY - 8);
    }

    if (invincibleTimer > 0) {
      const sec = Math.max(0, invincibleTimer / 60);
      const text = `無敵 ${sec.toFixed(1)}s`;
      const textW = Math.ceil(ctx.measureText(text).width);
      const padX = 3;
      const boxW = textW + padX * 2 + 1;
      const boxX = W - boxW - 3;
      const boxY = 12;
      ctx.fillStyle = "rgba(10, 26, 40, 0.88)";
      ctx.fillRect(boxX, boxY, boxW, 8);
      ctx.fillStyle = "rgba(116, 231, 255, 0.95)";
      ctx.fillRect(boxX, boxY + 7, Math.max(1, Math.floor((boxW - 1) * clamp(invincibleTimer / INVINCIBLE_DURATION, 0, 1))), 1);
      ctx.fillStyle = "#dcfbff";
      ctx.fillText(text, boxX + padX, boxY + 1);
    }

    if (hurtFlashTimer > 0 && (gameState === STATE.PLAY || gameState === STATE.BOSS)) {
      const flash = clamp(hurtFlashTimer / 24, 0, 1);
      ctx.fillStyle = `rgba(255, 130, 130, ${0.18 * flash})`;
      ctx.fillRect(0, hudH, W, H - hudH);
    }

    // --- Air Combo Counter ---
    if (airComboCount >= 2 && airComboDisplayTimer > 0) {
      const comboAlpha = clamp(airComboDisplayTimer / 30, 0.3, 1.0);
      const comboText = `${airComboCount} HITS`;
      ctx.font = "bold 8px monospace";
      const tw = ctx.measureText(comboText).width;
      const cx = W - tw - 8;
      const cy = H - 22;
      ctx.fillStyle = `rgba(10, 8, 20, ${0.6 * comboAlpha})`;
      ctx.fillRect(cx - 3, cy - 1, tw + 6, 10);
      const comboColor = airComboCount >= 6 ? "#ff4466" : airComboCount >= 4 ? "#ffaa44" : "#aaddff";
      ctx.fillStyle = comboColor;
      ctx.globalAlpha = comboAlpha;
      ctx.fillText(comboText, cx, cy + 1);
      ctx.globalAlpha = 1;
    }

    // --- Dash Cooldown Indicator ---
    if (combatDashCooldown > 0) {
      const dashRatio = 1 - clamp(combatDashCooldown / COMBAT_DASH_COOLDOWN, 0, 1);
      ctx.fillStyle = "rgba(10, 12, 20, 0.5)";
      ctx.fillRect(W - 28, H - 10, 24, 3);
      ctx.fillStyle = `rgba(120, 200, 255, ${0.5 + dashRatio * 0.5})`;
      ctx.fillRect(W - 28, H - 10, Math.floor(24 * dashRatio), 3);
    }
    // --- Gun Type Indicator ---
    {
      const gunColors = ["#aaddff", "#ffaa44", "#ff6644"];
      const gunName = GUN_TYPE_NAMES[gunType];
      const flashAlpha = gunSwitchFlashTimer > 0 ? 0.3 + 0.4 * (gunSwitchFlashTimer / 30) : 0;
      ctx.font = "7px monospace";
      ctx.textBaseline = "top";
      const gx = 6;
      const gy = H - 12;
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 200, ${flashAlpha})`;
        ctx.fillRect(gx - 2, gy - 1, 60, 10);
      }
      ctx.fillStyle = gunColors[gunType];
      ctx.fillText("GUN:" + gunName, gx, gy);
    }
    // --- Style Indicator ---
    {
      const styleColors = {
        swordmaster: "#ff6644", trickster: "#ffcc44",
        gunslinger: "#44aaff", royalguard: "#44ff88",
      };
      const styleShort = {
        swordmaster: "SM", trickster: "TR",
        gunslinger: "GS", royalguard: "RG",
      };
      ctx.font = "bold 7px monospace";
      ctx.textBaseline = "top";
      const sx = 72;
      const sy = H - 12;
      ctx.fillStyle = styleColors[playerStyle] || "#ffffff";
      ctx.fillText(styleShort[playerStyle] || "??", sx, sy);
    }
    // --- Royal Guard Energy ---
    if (playerStyle === "royalguard" && royalGuardEnergy > 0) {
      const rgRatio = royalGuardEnergy / ROYAL_GUARD_MAX_ENERGY;
      ctx.fillStyle = "rgba(10, 20, 10, 0.5)";
      ctx.fillRect(6, H - 26, 50, 4);
      ctx.fillStyle = `rgba(${Math.floor(60 + rgRatio * 195)}, 255, ${Math.floor(100 + (1 - rgRatio) * 100)}, 0.8)`;
      ctx.fillRect(6, H - 26, Math.floor(50 * rgRatio), 4);
      ctx.font = "6px monospace";
      ctx.fillStyle = "#88ffaa";
      ctx.fillText("RG", 58, H - 27);
    }
    // Royal Guard flash overlay on successful guard
    if (royalGuardFlashTimer > 0) {
      royalGuardFlashTimer -= 1;
      const flashAlpha = clamp(royalGuardFlashTimer / 15, 0, 0.35);
      ctx.fillStyle = royalGuardFlashColor;
      ctx.globalAlpha = flashAlpha;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      // Shield circle around player
      const spx = player.x + player.w * 0.5 - cameraX;
      const spy = player.y + player.h * 0.5;
      const shieldR = 16 + (15 - royalGuardFlashTimer) * 1.5;
      ctx.strokeStyle = royalGuardFlashColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = clamp(royalGuardFlashTimer / 15, 0, 0.8);
      ctx.beginPath();
      ctx.arc(spx, spy, shieldR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // --- Taunt Bonus Indicator ---
    if (tauntBonusTimer > 0) {
      const tbAlpha = clamp(tauntBonusTimer / 60, 0.3, 1.0);
      ctx.font = "7px monospace";
      ctx.fillStyle = `rgba(255, 220, 60, ${tbAlpha})`;
      ctx.fillText("TAUNT x" + TAUNT_RANK_MULTIPLIER.toFixed(1), 6, H - 34);
    }
    // --- Overdrive Charge ---
    if (driveChargeActive && driveChargeTimer > 0) {
      const chargeRatio = clamp(driveChargeTimer / DRIVE_CHARGE_TIME, 0, 1);
      ctx.fillStyle = "rgba(10, 10, 20, 0.5)";
      ctx.fillRect(W * 0.5 - 25, H - 16, 50, 4);
      const ready = chargeRatio >= 1;
      ctx.fillStyle = ready ? "#ffaa00" : "#6688cc";
      ctx.fillRect(W * 0.5 - 25, H - 16, Math.floor(50 * chargeRatio), 4);
      if (ready) {
        ctx.font = "7px monospace";
        ctx.fillStyle = "#ffcc44";
        ctx.fillText("OVERDRIVE!", W * 0.5 - 22, H - 24);
      }
    }
  }

  function drawStyleCutIn() {
    if (styleCutInTimer <= 0) return;
    const ratio = clamp(styleCutInTimer / STYLE_CUT_IN_DURATION, 0, 1);
    const slideIn = clamp((1 - ratio) * 4, 0, 1);   // 0→1 fast
    const fadeOut = clamp(ratio * 2, 0, 1);           // 1→0 slow

    // Background flash band
    const bandY = H * 0.35;
    const bandH = 28;
    const bandAlpha = fadeOut * 0.6;
    ctx.fillStyle = `rgba(0, 0, 0, ${bandAlpha.toFixed(2)})`;
    ctx.fillRect(0, bandY - 2, W, bandH + 4);

    // Colored accent line
    ctx.fillStyle = styleCutInColor;
    ctx.globalAlpha = fadeOut * 0.8;
    ctx.fillRect(0, bandY - 2, W, 2);
    ctx.fillRect(0, bandY + bandH + 2, W, 2);

    // Style name text - slide in from right
    const textX = W * 0.5 + (1 - slideIn) * W * 0.4;
    ctx.font = "bold 16px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Text shadow
    ctx.fillStyle = `rgba(0, 0, 0, ${(fadeOut * 0.9).toFixed(2)})`;
    ctx.fillText(styleCutInName, textX + 1, bandY + bandH * 0.5 + 1);

    // Main text
    ctx.fillStyle = styleCutInColor;
    ctx.globalAlpha = fadeOut;
    ctx.fillText(styleCutInName, textX, bandY + bandH * 0.5);

    // Style-specific icon hint (small text below)
    const styleHints = {
      swordmaster: "J=Sword  ↓J=Drive  charge=Overdrive",
      trickster: "L=Teleport  L+back=Dodge  Air L=Air Trick",
      gunslinger: "K=Gun++  ↓K=Bullet Rain++  I=Switch",
      royalguard: "L=Guard  L+J=Release  Just Guard=Energy",
    };
    const hint = styleHints[playerStyle] || "";
    ctx.font = "7px monospace";
    ctx.fillStyle = `rgba(200, 200, 200, ${(fadeOut * 0.7).toFixed(2)})`;
    ctx.fillText(hint, W * 0.5, bandY + bandH + 10);

    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  function drawDeadOverlay() {
    const flashRatio = clamp(deathFlashTimer / 34, 0, 1);
    const blink = Math.floor((deadTimer + 12) / 5) % 2 === 0;

    ctx.fillStyle = `rgba(140, 0, 24, ${0.35 + flashRatio * 0.35})`;
    ctx.fillRect(0, 0, W, H);

    if (flashRatio > 0.04) {
      ctx.fillStyle = `rgba(255, 240, 240, ${flashRatio * 0.62})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.strokeStyle = `rgba(255, 70, 70, ${0.2 + flashRatio * 0.7})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, H);
    ctx.moveTo(W, 0);
    ctx.lineTo(0, H);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.84)";
    ctx.fillRect(34, 44, 252, 88);
    ctx.strokeStyle = blink ? "#ff8e8e" : "#8b4e4e";
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 44, 252, 88);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(36, 46, 248, 30);
    ctx.fillStyle = blink ? "#ffe4e4" : "#d8b2b2";
    ctx.font = "18px monospace";
    ctx.fillText("YOU DIED", 100, 52);

    ctx.fillStyle = "#ffd8d8";
    ctx.font = "9px monospace";
    ctx.fillText(`原因: ${deadReason || "ダメージ"}`, 48, 84);
    ctx.fillText("MISS!   LIFE -1", 108, 98);
    ctx.fillText(`残機 x${playerLives}`, 126, 110);

    if (playerLives > 0) {
      const c = Math.max(1, Math.ceil(deadTimer / 60));
      ctx.fillText(`再開まで ${c}...`, 120, 122);

      const ratio = deadTimerMax > 0 ? clamp(deadTimer / deadTimerMax, 0, 1) : 0;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(88, 133, 144, 5);
      ctx.fillStyle = "#ffd29b";
      ctx.fillRect(89, 134, Math.floor((142) * (1 - ratio)), 3);
    } else {
      ctx.fillStyle = blink ? "#ffe5b6" : "#cda977";
      ctx.fillText("GAME OVER", 122, 122);
    }
  }

  function drawClearOverlay() {
    const t = clearTimer;
    if (currentStageNumber < FINAL_STAGE_NUMBER) {
      const nextStage = currentStageNumber + 1;
      const stage1To2 = currentStageNumber === 1;
      drawCutsceneCityBackdrop(t * 0.85, false);
      const heroX = 102 + Math.sin(t * 0.08) * 1.2;
      const heroY = 106;
      drawCutsceneHero(heroX, heroY, 1, t * 1.02);
      if (stage1To2) {
        ctx.fillStyle = "#24324b";
        ctx.fillRect(186, 110, 18, 24);
        ctx.fillStyle = "#1b6f9e";
        ctx.fillRect(183, 112, 10, 14);
        ctx.fillStyle = "#63d9f0";
        ctx.fillRect(184, 115, 2, 5);
        ctx.fillStyle = "#f0cc72";
        ctx.fillRect(193, 118, 4, 2);
        ctx.fillStyle = "#fff5d3";
        ctx.fillRect(191, 106, 8, 2);
        ctx.fillStyle = "#ff9d8d";
        ctx.fillRect(197, 112, 2, 2);
      } else {
        ctx.fillStyle = "#253249";
        ctx.fillRect(183, 106, 24, 30);
        ctx.fillStyle = "#5fb4ff";
        ctx.fillRect(186, 108, 18, 8);
        ctx.fillStyle = "#f0d3be";
        ctx.fillRect(188, 116, 14, 7);
        ctx.fillStyle = "#2f3f5f";
        ctx.fillRect(186, 123, 18, 11);
        ctx.fillStyle = "#6f89b4";
        ctx.fillRect(187, 124, 16, 3);
        ctx.fillStyle = "#4fd8b6";
        ctx.fillRect(178, 114, 6, 16);
        ctx.fillRect(206, 114, 6, 16);
        ctx.fillStyle = "#ffe5a3";
        ctx.fillRect(180, 119, 1, 3);
        ctx.fillRect(209, 119, 1, 3);
      }

      const cardW = 230;
      const cardX = Math.floor((W - cardW) * 0.5);
      ctx.fillStyle = "rgba(9,12,20,0.82)";
      ctx.fillRect(cardX, 34, cardW, 70);
      ctx.strokeStyle = "rgba(170, 216, 255, 0.75)";
      ctx.strokeRect(cardX, 34, cardW, 70);
      ctx.fillStyle = "#9bd8ff";
      ctx.font = "12px monospace";
      ctx.fillText(`STAGE ${currentStageNumber} CLEAR`, cardX + 58, 46);
      ctx.fillStyle = "#f0f5ff";
      ctx.font = "9px monospace";
      if (stage1To2) {
        ctx.fillText("孔雀ボスを撃破! りらはさらに奥の都会エリアへ。", cardX + 17, 64);
        ctx.fillText("次はセントラル街区、STAGE 2が始まる。", cardX + 34, 76);
      } else {
        ctx.fillText("孔雀人間ボスを撃破! マンション街区への道が開く。", cardX + 14, 64);
        ctx.fillText("次は最終決戦、STAGE 3が始まる。", cardX + 40, 76);
      }

      drawTextPanel([
        `STAGE ${nextStage} へ移動中...`,
        "Tap / Enter で先へ進む",
      ]);
      drawCutscenePolish(t, 0.68);
      return;
    }

    if (t < 180) {
      drawCutsceneCityBackdrop(t * 0.8, true);
      const carryBob = Math.sin(t * 0.14) * 1.3;
      drawCutsceneHero(106, 106 + carryBob, 1, t * 1.08);
      drawBoyfriend(124 + cameraX, 108 + carryBob * 0.45);
      ctx.fillStyle = "#f4e5e8";
      ctx.fillRect(124, 111 + carryBob * 0.45, 11, 4);
      ctx.fillRect(128, 115 + carryBob * 0.45, 7, 3);
      ctx.fillStyle = "rgba(255, 225, 170, 0.18)";
      ctx.fillRect(88, 126, 70, 3);
      drawTextPanel([
        "白ヒゲの神を撃破。会場は静まり返る。",
        "りら: もう大丈夫、今すぐここから出よう。",
      ]);
      drawCutscenePolish(t, 0.74);
      return;
    }

    if (t < 360) {
      drawMansionInteriorBackdrop();
      const talkBob = Math.sin(t * 0.11) * 1.1;
      drawCutsceneHero(88, 108 + talkBob, 1, t * 0.95);
      drawBoyfriend(176 + cameraX, 108 - talkBob * 0.35);

      const goonXs = [134, 214];
      for (let i = 0; i < goonXs.length; i += 1) {
        const gx = goonXs[i];
        const bob = Math.sin(t * 0.09 + i * 0.8) * 0.9;
        ctx.fillStyle = "#2e3247";
        ctx.fillRect(gx, 120 + bob, 8, 16);
        ctx.fillStyle = "#c9a793";
        ctx.fillRect(gx + 1, 116 + bob, 6, 4);
        ctx.fillStyle = "#1c1f2c";
        ctx.fillRect(gx + 2, 117 + bob, 1, 1);
        ctx.fillRect(gx + 5, 117 + bob, 1, 1);
      }

      if (t < 270) {
        drawTextPanel([
          "彼氏: 助けに来てくれて、本当にありがとう。",
          "りら: 当たり前。ふたりで帰るまでが救出作戦だよ。",
        ]);
      } else {
        drawTextPanel([
          "勧誘ルートは完全遮断。会場の安全を確認。",
          "りらと彼氏はマンション屋上へ向かう。",
        ]);
      }
      drawCutscenePolish(t, 0.66);
      return;
    }

    if (t < 560) {
      drawCutsceneCityBackdrop(t * 0.7, false);
      ctx.fillStyle = "#2f3548";
      ctx.fillRect(0, 132, W, 48);
      ctx.fillStyle = "#4e5a74";
      for (let i = 0; i < W; i += 16) {
        ctx.fillRect(i, 140, 8, 1);
      }
      const approach = clamp((t - 360) / 150, 0, 1);
      const sway = Math.sin(t * 0.09) * 1.4;
      const heroX = 84 + approach * 40 + sway * 0.4;
      const bfX = 212 - approach * 34 - sway * 0.4;
      const y = 106;
      drawCutsceneHero(heroX, y, 1, t * 1.1);
      drawBoyfriend(bfX + cameraX, y + 1);

      if (approach > 0.3) {
        const ringX = Math.floor((heroX + bfX) * 0.5 + Math.sin(t * 0.2) * 1.6);
        const ringY = y - 10 + Math.floor(Math.sin(t * 0.17) * 2);
        ctx.fillStyle = "#ffe08e";
        ctx.fillRect(ringX, ringY, 3, 2);
        ctx.fillRect(ringX + 1, ringY - 1, 1, 1);
        ctx.fillStyle = "#fff7d8";
        ctx.fillRect(ringX + 1, ringY, 1, 1);
      }

      for (let i = 0; i < 8; i += 1) {
        const hx = 42 + i * 30 + ((t * 0.55 + i * 10) % 24);
        const hy = 20 + ((t * 0.4 + i * 13) % 48);
        ctx.fillStyle = i % 2 === 0 ? "#ff8cb1" : "#ffd89f";
        ctx.fillRect(Math.floor(hx), Math.floor(hy), 2, 2);
      }

      if (t < 460) {
        drawTextPanel([
          "彼氏: これからも、ずっと一緒にいてくれる?",
          "りら: もちろん。毎日、隣で支えるよ。",
        ]);
      } else {
        drawTextPanel([
          "ふたりは指輪を交わし、未来を誓った。",
          "街のネオンが祝福のように輝く。",
        ]);
      }
      drawCutscenePolish(t, 0.7);
      return;
    }

    if (t < 820) {
      ctx.fillStyle = "#1b2438";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2b3a58";
      ctx.fillRect(0, 0, W, 126);
      ctx.fillStyle = "#3f4e6c";
      ctx.fillRect(0, 126, W, 54);

      ctx.fillStyle = "#a03d52";
      ctx.fillRect(136, 126, 48, 54);
      ctx.fillStyle = "#7f2f3f";
      ctx.fillRect(140, 126, 40, 54);
      ctx.fillStyle = "#e6e0d2";
      ctx.fillRect(84, 30, 152, 72);
      ctx.fillStyle = "#cfc2aa";
      ctx.fillRect(92, 38, 136, 56);
      ctx.fillStyle = "#9f8f76";
      ctx.fillRect(152, 24, 16, 92);
      ctx.fillStyle = "#f6f2ea";
      ctx.fillRect(148, 48, 24, 22);
      ctx.fillStyle = "#ffdca2";
      ctx.fillRect(155, 53, 10, 12);

      const vow = clamp((t - 560) / 180, 0, 1);
      const sway = Math.sin(t * 0.08) * 1.4;
      const heroX = 106 + sway + vow * 10;
      const bfX = 192 - sway - vow * 9;
      const heroY = 104;
      const bfY = 104;
      drawCutsceneHero(heroX, heroY, 1, t * 1.05);
      drawBoyfriend(bfX + cameraX, bfY);

      ctx.fillStyle = "#f7f3ee";
      ctx.fillRect(Math.floor(heroX + 2), heroY + 20, 10, 5);
      ctx.fillStyle = "#e6ddd4";
      ctx.fillRect(Math.floor(heroX + 4), heroY + 19, 6, 1);
      ctx.fillStyle = "#ffcad9";
      ctx.fillRect(Math.floor(heroX + 10), heroY + 15, 2, 2);
      ctx.fillStyle = "#8ad17f";
      ctx.fillRect(Math.floor(heroX + 12), heroY + 16, 1, 3);

      const ringX = Math.floor((heroX + bfX) * 0.5 + Math.sin(t * 0.2) * 1.1);
      const ringY = 104 - Math.floor(Math.sin(t * 0.17) * 2);
      ctx.fillStyle = "#ffe08e";
      ctx.fillRect(ringX, ringY, 3, 2);
      ctx.fillRect(ringX + 1, ringY - 1, 1, 1);
      ctx.fillStyle = "#fff7d8";
      ctx.fillRect(ringX + 1, ringY, 1, 1);

      for (let i = 0; i < 12; i += 1) {
        const cx = 26 + ((i * 24 + t * 0.72) % 300);
        const cy = 18 + ((i * 14 + t * 0.43) % 62);
        ctx.fillStyle = i % 3 === 0 ? "#ff8cae" : i % 3 === 1 ? "#ffd7a2" : "#9de1ff";
        ctx.fillRect(Math.floor(cx), Math.floor(cy), 2, 2);
      }

      if (t < 700) {
        drawTextPanel([
          "マンションホールで小さな結婚式が始まる。",
          "拍手の中、りらと彼氏は夫婦になる。",
        ]);
      } else {
        drawTextPanel([
          "りら: 今日もプロテインと笑顔で最強!",
          "彼氏: これから毎日が新しい冒険だ。",
        ]);
      }
      drawCutscenePolish(t, 0.74);
      return;
    }

    ctx.fillStyle = "#07080d";
    ctx.fillRect(0, 0, W, H);
    drawCutscenePolish(t, 0.8);

    ctx.fillStyle = "#ffffff";
    ctx.font = "16px monospace";
    ctx.fillText("HAPPY WEDDING", 84, 52);
    ctx.font = "14px monospace";
    ctx.fillText("THE END", 124, 76);
    drawCutsceneHero(110, 96, 1, t * 1.1);
    drawBoyfriend(188 + cameraX, 96);
    ctx.fillStyle = "#ffdca2";
    ctx.fillRect(156, 100, 3, 2);
    ctx.fillRect(157, 99, 1, 1);
    ctx.fillStyle = "#fff8de";
    ctx.fillRect(157, 100, 1, 1);

    ctx.font = "9px monospace";
    ctx.fillStyle = "#d7d7de";
    ctx.fillText("りら & 彼氏  Rescue Complete", 90, 112);
    ctx.fillText(`PROTEIN ${collectedProteinIds.size}/${stage.proteins.length}`, 112, 122);
    ctx.fillText(`DEATHS ${deaths}`, 132, 132);
    if (t > 900) {
      ctx.fillStyle = "#f7d9d9";
      ctx.fillText("タップ/Enterでタイトルへ", 95, 146);
    }
  }

  function drawPs1Overlay() {
    if (isCinematicMode()) {
      drawCinematicCompositeOverlay();
      return;
    }

    const filmTick = Math.floor((player.anim + titleTimer) * 0.8);

    ctx.fillStyle = "rgba(10,12,18,0.06)";
    for (let y = 0; y < H; y += 2) {
      ctx.fillRect(0, y, W, 1);
    }

    for (let y = 1; y < H; y += 4) {
      ctx.fillStyle = "rgba(255, 236, 210, 0.018)";
      ctx.fillRect(0, y, W, 1);
    }

    const vignette = ctx.createRadialGradient(
      W * 0.5,
      H * 0.56,
      58,
      W * 0.5,
      H * 0.56,
      214
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    const centerBloom = ctx.createRadialGradient(
      W * 0.5,
      H * 0.52,
      10,
      W * 0.5,
      H * 0.52,
      120
    );
    centerBloom.addColorStop(0, "rgba(255, 238, 210, 0.08)");
    centerBloom.addColorStop(1, "rgba(255, 238, 210, 0)");
    ctx.fillStyle = centerBloom;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const p = (x + y + filmTick) % 10;
        if (p < 3) continue;
        ctx.fillStyle = p < 6 ? "rgba(220, 190, 160, 0.022)" : "rgba(150, 190, 255, 0.018)";
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.fillStyle = "rgba(170,205,255,0.042)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255, 166, 140, 0.026)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(132, 210, 255, 0.022)";
    ctx.fillRect(0, 0, 2, H);
    ctx.fillStyle = "rgba(255, 174, 150, 0.022)";
    ctx.fillRect(W - 2, 0, 2, H);
  }

  function drawCinematicCompositeOverlay() {
    const filmTick = Math.floor((player.anim + titleTimer) * 0.45);
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, "rgba(112, 214, 255, 0.07)");
    grade.addColorStop(0.44, "rgba(255,255,255,0)");
    grade.addColorStop(1, "rgba(255, 126, 188, 0.05)");
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 6) {
      const alpha = y % 12 === 0 ? 0.024 : 0.014;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, y, W, 1);
    }

    const vignette = ctx.createRadialGradient(
      W * 0.5,
      H * 0.56,
      72,
      W * 0.5,
      H * 0.56,
      214
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    const edgeGlow = ctx.createLinearGradient(0, 0, W, 0);
    edgeGlow.addColorStop(0, "rgba(112, 214, 255, 0.08)");
    edgeGlow.addColorStop(0.1, "rgba(112, 214, 255, 0)");
    edgeGlow.addColorStop(0.9, "rgba(255, 126, 188, 0)");
    edgeGlow.addColorStop(1, "rgba(255, 126, 188, 0.08)");
    ctx.fillStyle = edgeGlow;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 18; i += 1) {
      const x = ((i * 19 + filmTick * 3) % (W + 10)) - 5;
      const y = 24 + ((i * 29 + filmTick * 2) % Math.max(1, H - 32));
      const alpha = 0.025 + (i % 3) * 0.01;
      ctx.fillStyle = i % 2 === 0
        ? `rgba(255, 238, 214, ${alpha})`
        : `rgba(178, 236, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawBattleRankStyleOverlay() {
    if (gameState !== STATE.PLAY && gameState !== STATE.BOSS) return;

    const rankTier = clamp(battleRankIndex, 0, BATTLE_RANK_DATA.length - 1);
    const tierRatio = battleRankCoreTierRatio(rankTier);
    const progress = battleRankProgressRatio();
    const exActive = isExBattleRankActive();
    const exRatio = battleRankExProgress();
    // Tone Down EX Visuals
    const exVisualBoost = exActive ? 0.11 + exRatio * 0.17 : 0;
    const stylePower = clamp(0.06 + tierRatio * 0.68 + progress * 0.26 + exVisualBoost * 0.24, 0.06, 1.22);
    const rankFlash = clamp(battleRankFlashTimer / 56, 0, 1);
    const phase = player.anim * (0.06 + stylePower * 0.03);
    const top = 24;
    const areaH = H - top;
    const rainbowAlpha = 0.004 + stylePower * 0.016 + exVisualBoost * 0.006;
    ctx.fillStyle = `rgba(108, 190, 255, ${rainbowAlpha})`;
    ctx.fillRect(0, top, W, areaH);
    ctx.fillStyle = `rgba(255, 132, 196, ${rainbowAlpha * 0.78})`;
    ctx.fillRect(0, top, W, areaH);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const curtainCount = 1 + Math.floor(stylePower * 2.2) + (exActive ? 1 + Math.floor(exRatio * 2) : 0);
    for (let i = 0; i < curtainCount; i += 1) {
      const sweep = ((phase * 0.55 + i * 0.24) % 1 + 1) % 1;
      const x = Math.floor((sweep - 0.18) * W);
      const width = Math.floor(52 + stylePower * 46 + i * 7);
      const grad = ctx.createLinearGradient(x, top, x + width, H);
      const hue = (phase * 180 + i * 46 + tierRatio * 130) % 360;
      grad.addColorStop(0, `hsla(${hue}, 92%, 64%, 0)`);
      grad.addColorStop(0.5, `hsla(${(hue + 42) % 360}, 90%, 72%, ${0.018 + stylePower * 0.03})`);
      grad.addColorStop(1, `hsla(${(hue + 86) % 360}, 94%, 64%, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, top, width, areaH);
    }
    ctx.restore();

    const edgeAlpha = 0.004 + stylePower * 0.016 + exVisualBoost * 0.007;
    ctx.fillStyle = `rgba(182, 236, 255, ${edgeAlpha})`;
    ctx.fillRect(0, top, 2, areaH);
    ctx.fillRect(W - 2, top, 2, areaH);

    const sparkleCount = 1 + rankTier + Math.floor(progress * 3) + Math.floor(rankFlash * 2) + (exActive ? 8 + Math.floor(exRatio * 9) : 0);
    const drift = Math.floor(player.anim * (1.1 + stylePower * 1.2));
    for (let i = 0; i < sparkleCount; i += 1) {
      const sx = ((i * 37 + drift * 11) % (W + 18)) - 9;
      const sy = top + ((i * 53 + drift * 7) % Math.max(1, areaH - 6));
      const twinkle = 0.5 + Math.sin((phase + i * 0.74) * 3.8) * 0.5;
      const hue = (i * 29 + drift * 5 + tierRatio * 130) % 360;
      const alpha = 0.02 + stylePower * 0.042 + twinkle * 0.032;
      const size = twinkle > 0.95 && rankTier >= 2 ? 2 : 1;
      ctx.fillStyle = `hsla(${hue}, 95%, 74%, ${alpha})`;
      ctx.fillRect(sx, sy, size, size);
      if (size > 1 && twinkle > 0.96) {
        ctx.fillRect(sx - 1, sy, size + 2, 1);
        ctx.fillRect(sx, sy - 1, 1, size + 2);
      }
    }

    if (exActive) {
      const pulse = 0.5 + Math.sin(player.anim * 0.22) * 0.5;
      const burstAlpha = 0.06 + pulse * 0.06 + exRatio * 0.08;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const scanCount = 2 + Math.floor(exRatio * 3);
      for (let i = 0; i < scanCount; i += 1) {
        const sweep = ((phase * 0.38 + i * 0.28) % 1 + 1) % 1;
        const x = Math.floor((sweep - 0.24) * W);
        const width = Math.floor(92 + exVisualBoost * 76 + i * 14);
        const hue = (220 + i * 38 + pulse * 70 + player.anim * 0.24) % 360;
        const grad = ctx.createLinearGradient(x, top, x + width, H);
        grad.addColorStop(0, `hsla(${hue}, 100%, 72%, 0)`);
        grad.addColorStop(0.5, `hsla(${(hue + 48) % 360}, 100%, 78%, ${0.06 + exRatio * 0.09})`);
        grad.addColorStop(1, `hsla(${(hue + 96) % 360}, 100%, 72%, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, top, width, areaH);
      }
      const core = ctx.createRadialGradient(
        W * 0.5,
        top + areaH * 0.48,
        8,
        W * 0.5,
        top + areaH * 0.48,
        146 + exRatio * 44
      );
      core.addColorStop(0, `rgba(255, 252, 220, ${burstAlpha})`);
      core.addColorStop(0.44, `rgba(132, 214, 255, ${burstAlpha * 0.8})`);
      core.addColorStop(1, "rgba(22, 10, 44, 0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, top, W, areaH);
      ctx.restore();
    }

    if (rankFlash > 0.3) {
      const flare = clamp((rankFlash - 0.3) / 0.7, 0, 1);
      const text = currentBattleRank().long;
      ctx.font = "8px monospace";
      const textW = Math.ceil(ctx.measureText(text).width);
      const cx = Math.floor(W * 0.5 - textW * 0.5);
      const cy = 54 + Math.floor(Math.sin(player.anim * 0.2) * 2);
      ctx.fillStyle = `rgba(12, 18, 28, ${0.28 + flare * 0.3})`;
      ctx.fillRect(cx - 10, cy - 2, textW + 20, 11);
      ctx.fillStyle = `rgba(255, 234, 176, ${0.52 + flare * 0.44})`;
      ctx.fillText(text, cx + 1, cy - 1);
      ctx.fillStyle = `rgba(255, 122, 122, ${0.42 + flare * 0.4})`;
      ctx.fillText(text, cx, cy);
    }
  }

  function drawBlackFlashOverlay() {
    if (blackFlashTimer <= 0 || blackFlashPower <= 0.01) return;

    const ratio = clamp(blackFlashTimer / 52, 0, 1);
    const power = clamp(blackFlashPower, 0, 8);
    const sx = Math.floor(blackFlashX - cameraX);
    const sy = Math.floor(blackFlashY);
    const pulse = 0.5 + Math.sin((player.anim + blackFlashTimer) * 0.32) * 0.5;
    const pulse2 = 0.5 + Math.sin((player.anim + blackFlashTimer) * 0.58 + 1.2) * 0.5;

    ctx.fillStyle = `rgba(0, 0, 0, ${0.34 * ratio * (0.9 + power * 0.24)})`;
    ctx.fillRect(0, 24, W, H - 24);
    ctx.fillStyle = `rgba(190, 12, 30, ${0.24 * ratio * (0.9 + pulse * 0.8)})`;
    ctx.fillRect(0, 24, W, H - 24);
    ctx.fillStyle = `rgba(86, 148, 255, ${0.12 * ratio * (0.7 + pulse2 * 0.8)})`;
    ctx.fillRect(0, 24, W, H - 24);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * ratio * (0.7 + pulse * 0.7)})`;
    ctx.fillRect(0, 24, W, H - 24);

    for (let i = 0; i < 28; i += 1) {
      const ang = (Math.PI * 2 * i) / 28 + player.anim * 0.08;
      const len = 24 + power * 12 + (i % 2 === 0 ? 10 : 0);
      const ex = Math.floor(sx + Math.cos(ang) * len);
      const ey = Math.floor(sy + Math.sin(ang) * len * 0.72);
      ctx.strokeStyle = `rgba(255, 44, 66, ${0.66 * ratio})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = `rgba(16, 8, 10, ${0.52 * ratio})`;
      ctx.beginPath();
      ctx.moveTo(sx + 1, sy + 1);
      ctx.lineTo(ex + 1, ey + 1);
      ctx.stroke();
    }

    const ringR = Math.floor(11 + power * 9 + pulse * 4);
    ctx.strokeStyle = `rgba(255, 164, 184, ${0.5 * ratio})`;
    ctx.beginPath();
    ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 54, 74, ${0.74 * ratio})`;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(4, ringR - 6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120, 202, 255, ${0.42 * ratio})`;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(5, ringR - 12), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * ratio})`;
    ctx.fillRect(sx - 4, sy - 4, 8, 8);
    ctx.fillStyle = `rgba(255, 30, 50, ${0.86 * ratio})`;
    ctx.fillRect(sx - 18, sy - 2, 36, 4);
    ctx.fillRect(sx - 2, sy - 18, 4, 36);
    ctx.fillStyle = `rgba(10, 6, 8, ${0.6 * ratio})`;
    ctx.fillRect(sx - 14, sy - 1, 28, 2);
    ctx.fillRect(sx - 1, sy - 14, 2, 28);

    const slashW = Math.floor(28 + power * 10);
    const slashY = sy + Math.floor(Math.sin((player.anim + blackFlashTimer) * 0.35) * 2);
    ctx.fillStyle = `rgba(255, 90, 120, ${0.34 * ratio})`;
    ctx.fillRect(sx - slashW, slashY - 1, slashW * 2, 2);
    ctx.fillStyle = `rgba(128, 206, 255, ${0.22 * ratio})`;
    ctx.fillRect(sx - slashW + 4, slashY + 2, slashW * 2 - 8, 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * ratio})`;
    ctx.fillRect(sx - slashW + 2, slashY, slashW * 2 - 4, 1);

    for (let i = 0; i < 7; i += 1) {
      const gy = 24 + ((Math.floor(player.anim * 3) + i * 11) % (H - 28));
      const gAlpha = 0.06 + ratio * 0.16 - i * 0.01;
      if (gAlpha <= 0.01) continue;
      ctx.fillStyle = `rgba(255, ${80 + i * 18}, ${120 + i * 10}, ${gAlpha})`;
      ctx.fillRect(0, gy, W, 1);
    }
  }

  function drawKickBurstOverlay() {
    if (kickFlashTimer <= 0 || kickFlashPower <= 0.01) return;

    const ratio = clamp(kickFlashTimer / 20, 0, 1);
    const power = clamp(kickFlashPower, 0, 5);
    const sx = Math.floor(kickBurstX - cameraX);
    const sy = Math.floor(kickBurstY);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 236, 176, ${0.08 * ratio * power})`;
    ctx.fillRect(0, 24, W, H - 24);

    // 打撃点の熱グロー
    const gr = 8 + power * 5;
    const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, gr);
    glow.addColorStop(0, `rgba(255, 230, 170, ${0.5 * ratio})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sx - gr, sy - gr, gr * 2, gr * 2);

    ctx.fillStyle = `rgba(255, 255, 255, ${0.16 * ratio})`;
    ctx.fillRect(sx - 2, sy - 2, 4, 4);

    ctx.strokeStyle = `rgba(255, 210, 130, ${0.55 * ratio})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i += 1) {
      const ang = (Math.PI * 2 * i) / 10 + player.anim * 0.03;
      const len = 10 + power * 6 + ((i % 2) * 4);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(Math.floor(sx + Math.cos(ang) * len), Math.floor(sy + Math.sin(ang) * len));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWaveFlashOverlay() {
    if (waveFlashTimer <= 0 || waveFlashPower <= 0.01) return;

    const ratio = clamp(waveFlashTimer / 30, 0, 1);
    const power = clamp(waveFlashPower, 0, 3.2);
    const sx = Math.floor(waveFlashX - cameraX);
    const sy = Math.floor(waveFlashY);
    const pulse = 0.5 + Math.sin((player.anim + waveFlashTimer) * 0.26) * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const wgr = 12 + power * 8;
    const wglow = ctx.createRadialGradient(sx, sy, 1, sx, sy, wgr);
    wglow.addColorStop(0, `rgba(150, 235, 255, ${0.45 * ratio})`);
    wglow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wglow;
    ctx.fillRect(sx - wgr, sy - wgr, wgr * 2, wgr * 2);

    ctx.fillStyle = `rgba(138, 232, 255, ${0.1 * ratio * power})`;
    ctx.fillRect(0, 24, W, H - 24);
    ctx.fillStyle = `rgba(255, 244, 178, ${0.07 * ratio * power})`;
    ctx.fillRect(0, 34, W, H - 34);

    ctx.fillStyle = `rgba(255,255,255,${0.26 * ratio})`;
    ctx.fillRect(sx - 3, sy - 3, 6, 6);

    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14 + (player.anim + i) * 0.04;
      const len = 14 + power * 10 + (i % 2 === 0 ? 6 : 0);
      ctx.strokeStyle = `rgba(162, 248, 255, ${0.32 * ratio})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(Math.floor(sx + Math.cos(ang) * len), Math.floor(sy + Math.sin(ang) * len * 0.66));
      ctx.stroke();
    }

    const waveY = sy + Math.floor((pulse - 0.5) * 4);
    ctx.fillStyle = `rgba(255,255,255,${0.38 * ratio})`;
    ctx.fillRect(0, waveY - 1, W, 2);
    ctx.fillStyle = `rgba(131, 228, 255, ${0.25 * ratio})`;
    ctx.fillRect(0, waveY - 3, W, 6);
    ctx.restore();
  }

  function drawEmergencyDodgeOverlay() {
    if (!emergencyDodgeActive && emergencyDodgeFlashTimer <= 0) return;

    ctx.save(); // Start Scope

    if (emergencyDodgeActive) {
      const ratio = clamp(emergencyDodgeTimer / EMERGENCY_DODGE_WINDOW, 0, 1);
      const pulse = (Math.sin(emergencyDodgePhase * 10) + 1) * 0.5;

      ctx.save();
      ctx.globalCompositeOperation = "difference";
      const invAlpha = clamp(0.92 + pulse * 0.08, 0.85, 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${invAlpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      ctx.fillStyle = `rgba(255, 40, 60, ${0.06 + ratio * 0.1})`;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 7; i += 1) {
        const gy = ((Math.floor(emergencyDodgePhase * 4) + i * 11) % H);
        ctx.fillStyle = `rgba(255, 200, 80, ${0.06 + ratio * 0.06})`;
        ctx.fillRect(0, gy, W, 1);
      }

      const barY = H * 0.7;
      const barW = Math.floor((W - 20) * ratio);
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(8, barY - 1, W - 16, 8);
      const barHue = ratio > 0.3 ? 120 : 0;
      ctx.fillStyle = `hsl(${barHue}, 90%, ${55 + pulse * 15}%)`;
      ctx.fillRect(10, barY, barW, 5);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const promptPulse = Math.floor(emergencyDodgePhase * 4) % 2 === 0;
      if (promptPulse) {
        ctx.fillText("▶ ボタンを押して回避! ◀", W * 0.5, barY - 10);
      }
      ctx.textAlign = "left";
    }

    if (emergencyDodgeFlashTimer > 0 && !emergencyDodgeActive) {
      const flashRatio = clamp(emergencyDodgeFlashTimer / 12, 0, 1);
      ctx.fillStyle = `rgba(180, 255, 220, ${0.35 * flashRatio})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore(); // End Scope
  }

  function drawTimeBurstOverlay() {
    if (!isTimeBurstActive()) return;
    const duration = Math.max(1, timeBurstDuration || (timeBurstMode === TIME_BURST_MODE_STOP ? TIME_BURST_STOP_DURATION : TIME_BURST_SLOW_MAX_DURATION));
    const ratio = clamp(timeBurstTimer / duration, 0, 1);
    const pulse = 0.5 + Math.sin(timeBurstPhase * 0.55 + player.anim * 0.08) * 0.5;

    if (timeBurstMode === TIME_BURST_MODE_SLOW) {
      ctx.save();
      ctx.globalCompositeOperation = "difference";
      const invAlpha = clamp(0.86 + pulse * 0.12, 0.78, 1);
      ctx.fillStyle = `rgba(255, 255, 255, ${invAlpha})`;
      ctx.fillRect(0, 24, W, H - 24);
      ctx.restore();

      ctx.fillStyle = `rgba(132, 244, 255, ${0.08 + ratio * 0.12})`;
      ctx.fillRect(0, 24, W, H - 24);
      for (let i = 0; i < 9; i += 1) {
        const gy = 24 + ((Math.floor(timeBurstPhase * 3) + i * 9) % Math.max(1, H - 28));
        ctx.fillStyle = `rgba(255, 245, 186, ${0.06 + ratio * 0.08 - i * 0.004})`;
        ctx.fillRect(0, gy, W, 1);
      }
      return;
    }

    if (timeBurstMode === TIME_BURST_MODE_STOP) {
      ctx.fillStyle = `rgba(232, 232, 232, ${0.08 + ratio * 0.16})`;
      ctx.fillRect(0, 24, W, H - 24);
      const lineCount = 12;
      for (let i = 0; i < lineCount; i += 1) {
        const ly = 24 + i * Math.floor((H - 24) / lineCount);
        const alpha = 0.05 + pulse * 0.06 - i * 0.002;
        ctx.fillStyle = `rgba(18, 18, 18, ${Math.max(0.02, alpha)})`;
        ctx.fillRect(0, ly, W, 1);
      }
    }
  }

  function drawDevilTriggerOverlay() {
    // DT result display
    if (devilTriggerResultTimer > 0) {
      devilTriggerResultTimer -= 1;
      const alpha = clamp(devilTriggerResultTimer / 60, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      const resultColors = DT_STYLE_COLORS[devilTriggerStyle] || DT_STYLE_COLORS.swordmaster;
      ctx.fillStyle = resultColors.bar;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      const resultName = (DT_STYLE_NAMES[devilTriggerStyle] || "DEVIL TRIGGER!").replace(/!+$/, "");
      ctx.fillText(`${resultName} RESULT: ${devilTriggerResultCount} HITS!`, W * 0.5, H * 0.35);
      ctx.restore();
    }

    if (devilTriggerTimer <= 0) return;

    // Style-specific tint colors
    const colors = DT_STYLE_COLORS[devilTriggerStyle] || DT_STYLE_COLORS.swordmaster;
    const [tr, tg, tb] = colors.tint;
    const [vr, vg, vb] = colors.vignette;

    const ratio = clamp(devilTriggerTimer / devilTriggerDuration, 0, 1);
    const pulse = 0.5 + Math.sin(performance.now() * 0.004) * 0.15;
    const intensity = 0.12 + pulse * 0.06;

    // World tint (style-colored)
    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${intensity * ratio})`;
    ctx.fillRect(0, 0, W, H);

    // Vignette edges
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.2, W * 0.5, H * 0.5, W * 0.7);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, `rgba(${vr}, ${vg}, ${vb}, ${0.15 * ratio})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // DT timer bar (style-colored)
    const barW = 60;
    const barH = 3;
    const barX = Math.floor(W * 0.5 - barW * 0.5);
    const barY = 18;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = colors.bar;
    ctx.globalAlpha = 0.8 + pulse * 0.2;
    ctx.fillRect(barX, barY, Math.floor(barW * ratio), barH);
    ctx.globalAlpha = 1;

    // Style name label
    const dtLabel = DT_STYLE_NAMES[devilTriggerStyle] || "DEVIL TRIGGER!";
    if (ratio > 0.9) {
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = colors.flash;
      ctx.globalAlpha = clamp((ratio - 0.9) * 10, 0, 1);
      ctx.fillText(dtLabel.replace("!", "").replace("!", ""), W * 0.5, barY + barH + 9);
      ctx.globalAlpha = 1;
    }
  }

  function drawProteinBurstLaserOverlay() {
    const laserModeActive = proteinBurstMode === PROTEIN_BURST_MODE_LASER && proteinBurstTimer > 0;
    if (proteinBurstLaserTimer <= 0 && !laserModeActive) return;

    const ratio = clamp(proteinBurstLaserTimer / PROTEIN_BURST_LASER_DURATION, 0, 1);
    const burstRatio = laserModeActive ? clamp(proteinBurstTimer / PROTEIN_BURST_DURATION, 0, 1) : 0;
    const intensity = Math.max(ratio, burstRatio * 0.92);
    const sweep = 1 - ratio;
    const topY = 24;
    const laserY = Math.floor(topY + sweep * (H - topY - 8));
    const pulse = 0.5 + Math.sin(proteinBurstLaserPhase * 0.9) * 0.5;
    const fastPulse = 0.5 + Math.sin(proteinBurstLaserPhase * 1.7) * 0.5;
    const hueBase = (proteinBurstLaserPhase * 5.6 + player.anim * 2.2) % 360;
    const stripeH = Math.max(8, Math.floor((H - topY) / 6));

    for (let i = 0; i < 6; i += 1) {
      const hue = (hueBase + i * 54) % 360;
      const alpha = 0.05 + intensity * 0.09 + (i % 2 === 0 ? pulse * 0.03 : fastPulse * 0.03);
      ctx.fillStyle = `hsla(${hue}, 95%, 62%, ${alpha})`;
      ctx.fillRect(0, topY + i * stripeH, W, stripeH + 2);
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + fastPulse * 0.1 * intensity})`;
    ctx.fillRect(0, topY, W, H - topY);

    for (let i = 0; i < 15; i += 1) {
      const x = Math.floor((W / 12) * i + Math.sin((proteinBurstLaserPhase + i) * 0.7) * 6);
      const w = i % 2 === 0 ? 2 : 1;
      const hue = (hueBase + i * 22 + pulse * 26) % 360;
      ctx.fillStyle = `hsla(${hue}, 96%, 66%, ${0.16 + intensity * 0.26})`;
      ctx.fillRect(x, topY, w, H - topY);
      ctx.fillStyle = `hsla(${(hue + 42) % 360}, 90%, 78%, ${0.12 + intensity * 0.16})`;
      ctx.fillRect(x + 1, topY, 1, H - topY);
    }

    const px = Math.floor(player.x - cameraX + player.w * 0.5);
    const py = Math.floor(player.y + player.h * 0.4);
    for (let i = 0; i < 5; i += 1) {
      const spread = 8 + i * 6 + fastPulse * 2;
      const hue = (hueBase + i * 70) % 360;
      ctx.strokeStyle = `hsla(${hue}, 98%, 76%, ${0.16 + intensity * 0.13 - i * 0.02})`;
      ctx.beginPath();
      ctx.moveTo(px - spread, py);
      ctx.lineTo(px + spread, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py - spread * 0.5);
      ctx.lineTo(px, py + spread * 0.5);
      ctx.stroke();
    }

    if (proteinBurstLaserTimer > 0) {
      for (let i = 0; i < 7; i += 1) {
        const hue = (hueBase + i * 46 + fastPulse * 40) % 360;
        const bandY = laserY - 7 + i * 2;
        ctx.fillStyle = `hsla(${hue}, 100%, 64%, ${0.28 + ratio * 0.2})`;
        ctx.fillRect(0, bandY, W, 2);
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${0.34 + ratio * 0.28})`;
      ctx.fillRect(0, laserY - 1, W, 3);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.36 + ratio * 0.28})`;
      ctx.fillRect(0, laserY, W, 2);
      const mirrorY = Math.floor(topY + (1 - sweep) * (H - topY - 8));
      ctx.fillStyle = `hsla(${(hueBase + 180) % 360}, 90%, 70%, ${0.22 + ratio * 0.18})`;
      ctx.fillRect(0, mirrorY - 1, W, 3);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    if (gameState === STATE.TITLE) {
      drawTitle();
      drawPs1Overlay();
      return;
    }

    if (gameState === STATE.TUTORIAL) {
      drawTutorial();
      drawPs1Overlay();
      return;
    }

    if (gameState === STATE.CUTSCENE) {
      drawCutscene();
      drawPs1Overlay();
      return;
    }

    if (gameState === STATE.STAGE_INTRO) {
      drawStageIntroCutscene();
      drawPs1Overlay();
      return;
    }

    if (gameState === STATE.PRE_BOSS) {
      drawPreBossCutscene();
      drawPs1Overlay();
      return;
    }

    if (gameState === STATE.GOD_PHASE_CUTSCENE) {
      drawGodSecondFormCutscene();
      drawPs1Overlay();
      return;
    }

    const deadShake = gameState === STATE.DEAD ? deathShakeTimer * 0.2 : 0;
    const impactRatio = clamp(impactShakeTimer / 18, 0, 1);
    const playShake = (gameState === STATE.PLAY || gameState === STATE.BOSS) ? impactShakePower * impactRatio : 0;
    const shakePower = Math.max(deadShake, playShake);
    let shakeX = 0;
    let shakeY = 0;
    if (shakePower > 0.01) {
      shakeX = (Math.random() * 2 - 1) * shakePower;
      shakeY = (Math.random() * 2 - 1) * (shakePower * 0.6);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);
    const stopMonochrome = isTimeBurstActive() && timeBurstMode === TIME_BURST_MODE_STOP;
    if (stopMonochrome) {
      ctx.filter = "grayscale(1) contrast(1.1)";
    }
    drawWorld();
    drawBattleRankStyleOverlay();
    drawBlackFlashOverlay();
    drawKickBurstOverlay();
    drawWaveFlashOverlay();
    drawProteinBurstLaserOverlay();
    drawDevilTriggerOverlay();
    if (stopMonochrome) {
      ctx.filter = "none";
    }
    drawTimeBurstOverlay();
    drawEmergencyDodgeOverlay();
    if (isTimeBurstActive() || emergencyDodgeActive) {
      // Keep protagonist colors stable during time-burst/dodge post effects.
      drawPlayerTrueColorPass();
    }
    drawHUD();
    drawStyleCutIn();

    if (gameState === STATE.DEAD) {
      drawDeadOverlay();
    }

    if (gameState === STATE.CLEAR) {
      drawClearOverlay();
    }
    ctx.restore();
    // drawVersion(); // Removed to prevent potential freeze
    drawPs1Overlay();
  }

  const holdButtonBindings = new Map();

  function releaseHoldButtonByKey(key) {
    const binding = holdButtonBindings.get(key);
    if (!binding) return;
    binding.releaseAll();
  }

  function releaseAllHoldButtons() {
    for (const binding of holdButtonBindings.values()) {
      binding.releaseAll();
    }
  }

  function bindHoldButton(id, key) {
    const el = document.getElementById(id);
    if (!el) return;

    const pointers = new Set();

    const releasePointer = (pointerId) => {
      if (!pointers.has(pointerId)) return false;
      pointers.delete(pointerId);
      try {
        if (el.hasPointerCapture && el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      } catch (_e) {
        // Ignore capture errors; release fallback still works.
      }
      if (pointers.size === 0) {
        input[key] = false;
        el.classList.remove("is-down");
      }
      return true;
    };

    const releaseAll = () => {
      if (pointers.size === 0 && !input[key]) return;
      pointers.clear();
      input[key] = false;
      el.classList.remove("is-down");
    };

    const down = (e) => {
      e.preventDefault();
      unlockAudio();
      if (pointers.has(e.pointerId)) return;
      pointers.add(e.pointerId);
      input[key] = true;
      el.classList.add("is-down");
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_e) {
        // Ignore capture errors and keep hold handling active.
      }
    };

    const up = (e) => {
      if (releasePointer(e.pointerId)) {
        e.preventDefault();
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("lostpointercapture", up);
    holdButtonBindings.set(key, {
      id,
      key,
      releaseAll,
      releasePointer,
    });
  }

  let burstButton1 = document.getElementById("btn-special");
  if (!burstButton1) {
    const clusterRight = document.querySelector(".cluster-right");
    if (clusterRight) {
      burstButton1 = document.createElement("button");
      burstButton1.id = "btn-special";
      burstButton1.className = "ctrl action special";
      burstButton1.textContent = "burst1";
      clusterRight.appendChild(burstButton1);
    }
  }

  let burstButton2 = document.getElementById("btn-special2");
  if (!burstButton2) {
    const clusterRight = document.querySelector(".cluster-right");
    if (clusterRight) {
      burstButton2 = document.createElement("button");
      burstButton2.id = "btn-special2";
      burstButton2.className = "ctrl action special";
      burstButton2.textContent = "burst2";
      clusterRight.appendChild(burstButton2);
    }
  }

  function applyBurstButtonTone(button, ratio, tone, ready, full, playable) {
    if (!button) return;
    const fillLight = clamp(tone.light + (ready ? 10 : 4) + (full ? 5 : 0), 46, 90);
    const topLight = clamp(tone.light * 0.66 + 11, 22, 62);
    const bottomLight = clamp(tone.light * 0.4 + 8, 16, 45);
    const borderLight = clamp(fillLight + 5, 52, 93);
    const glowAlpha = clamp((ready ? 0.2 : 0.06) + ratio * 0.22 + (full ? 0.1 : 0), 0.06, 0.6);
    button.style.setProperty("--burst-fill", `${Math.round(ratio * 100)}%`);
    button.style.setProperty("--burst-alpha", (0.12 + ratio * 0.62).toFixed(3));
    button.style.setProperty("--burst-hue", tone.hue.toFixed(1));
    button.style.setProperty("--burst-sat", `${tone.sat.toFixed(1)}%`);
    button.style.setProperty("--burst-fill-light", `${fillLight.toFixed(1)}%`);
    button.style.setProperty("--burst-top-light", `${topLight.toFixed(1)}%`);
    button.style.setProperty("--burst-bottom-light", `${bottomLight.toFixed(1)}%`);
    button.style.setProperty("--burst-border-light", `${borderLight.toFixed(1)}%`);
    button.style.setProperty("--burst-glow-alpha", glowAlpha.toFixed(3));
    button.disabled = !ready;
    button.classList.toggle("not-ready", playable && !ready);
    button.classList.toggle("ready", ready);
    button.classList.toggle("full", full);
  }

  function refreshBurstButtonUi() {
    if (!burstButton1) return;
    const playable = gameState === STATE.PLAY || gameState === STATE.BOSS;
    const chargeRatio1 = clamp(proteinBurstGauge1 / PROTEIN_BURST_REQUIRE, 0, 1);

    // Tone based on current style (Red for Berserker, Blue for Gunner)
    // Actually, let's keep it simple or check playerStyle
    const isBerserker = playerStyle === "berserker";
    const tone1 = burstChargeTone(chargeRatio1);
    const tone2 = {
      hue: (tone1.hue + 84) % 360,
      sat: clamp(tone1.sat + 6, 28, 98),
      light: clamp(tone1.light + 2, 38, 86),
    };
    const activeTone = isBerserker ? tone1 : tone2;

    const busy = proteinBurstTimer > 0 || isTimeBurstActive();
    const ready1 = playable && proteinBurstGauge1 >= PROTEIN_BURST_MIN && !busy;
    const full1 = proteinBurstGauge1 >= PROTEIN_BURST_REQUIRE;

    applyBurstButtonTone(burstButton1, chargeRatio1, activeTone, ready1, full1, playable);

    if (burstButton1) burstButton1.textContent = full1 ? "BURST!" : "BURST";
    if (!ready1) releaseHoldButtonByKey("burst");
  }

  try {
    bindHoldButton("btn-left", "left");
    bindHoldButton("btn-right", "right");
    bindHoldButton("btn-jump", "jump");
    bindHoldButton("btn-attack", "attack");
    bindHoldButton("btn-style", "styleChange");
    bindHoldButton("btn-special", "burst");
    bindHoldButton("btn-special2", "special2");
    refreshBurstButtonUi();
  } catch (_e) { console.error("[init] button setup", _e); }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();

    if (gameState === STATE.TITLE) {
      beginOpeningCutscene();
      return;
    }

    if (gameState === STATE.TUTORIAL) {
      // Taps on canvas during tutorial are ignored (use buttons)
      return;
    }

    if (gameState === STATE.CUTSCENE) {
      startOpeningTheme();
      return;
    }

    if (gameState === STATE.STAGE_INTRO) {
      finishStageIntroCutscene();
      return;
    }

    if (gameState === STATE.PRE_BOSS) {
      startOpeningTheme();
      return;
    }

    if (gameState === STATE.GOD_PHASE_CUTSCENE) {
      if (godPhaseCutsceneTimer >= GOD_PHASE_CUTSCENE_SKIP_MIN) {
        finishGodSecondFormCutscene();
      }
      return;
    }

    if (gameState === STATE.CLEAR) {
      if (clearTimer > 180) {
        returnToTitle();
      }
      return;
    }

    if (gameState === STATE.DEAD) {
      return;
    }
  });

  // Multiple actions per key: ArrowUp triggers both "jump" and "up"
  const keyToInput = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "jump",
    KeyW: "jump",
    Space: "jump",
    ArrowDown: "down",
    KeyJ: "attack",
    KeyF: "attack",
    KeyK: "shoot",
    KeyL: "dash",
    KeyI: "weaponSwitch",
    KeyU: "burst",
    KeyS: "down",
    KeyT: "taunt",
    KeyV: "styleChange",
    Enter: "start",
  };
  // Keys that also set "up" direction (ArrowUp and W)
  const keyAlsoUp = { ArrowUp: true, KeyW: true };

  window.addEventListener("keydown", (e) => {
    unlockAudio();
    if (e.code === "KeyG") {
      if (!e.repeat) {
        toggleVisualMode();
      }
      e.preventDefault();
      return;
    }
    const mapped = keyToInput[e.code];
    if (!mapped) return;

    if (mapped === "styleChange" && !input.styleChange) {
      // Logic moved to main loop to prevent double-toggling
    }

    input[mapped] = true;
    // ArrowUp/W also sets "up" direction for attack combos
    if (keyAlsoUp[e.code]) input.up = true;

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", (e) => {
    const mapped = keyToInput[e.code];
    if (!mapped) return;
    input[mapped] = false;
    if (keyAlsoUp[e.code]) input.up = false;
  });

  window.addEventListener("blur", () => {
    releaseAllHoldButtons();
    input.left = false;
    input.right = false;
    input.up = false;
    input.jump = false;
    input.down = false;
    input.attack = false;
    input.attack2 = false;
    input.shot = false;
    input.shoot = false;
    input.dash = false;
    input.weaponSwitch = false;
    input.burst = false;
    input.styleChange = false;
    input.special = false;
    input.special2 = false;
    input.taunt = false;
    input.start = false;
  });
  window.addEventListener("pagehide", () => {
    releaseAllHoldButtons();
    input.special2 = false;
    input.start = false;
    input.shot = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseAllHoldButtons();
      input.special2 = false;
      input.start = false;
      input.shot = false;
    }
  });

  const blockGesture = (e) => e.preventDefault();
  window.addEventListener("gesturestart", blockGesture, { passive: false });
  window.addEventListener("gesturechange", blockGesture, { passive: false });
  window.addEventListener("gestureend", blockGesture, { passive: false });
  window.addEventListener("dblclick", blockGesture, { passive: false });
  window.addEventListener("contextmenu", blockGesture);
  window.addEventListener("selectstart", blockGesture);
  window.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
  let lastTouchEndAt = 0;
  window.addEventListener("touchend", (e) => {
    if (!e.touches || e.touches.length === 0) {
      releaseAllHoldButtons();
    }
    const now = performance.now();
    if (now - lastTouchEndAt < 320) {
      e.preventDefault();
    }
    lastTouchEndAt = now;
  }, { passive: false });
  window.addEventListener("touchcancel", () => {
    releaseAllHoldButtons();
  }, { passive: false });

  let last = performance.now();
  let _loopErrorCount = 0;
  let shellPaused = false;
  function loop(now) {
    if (shellPaused) {
      last = now;
      requestAnimationFrame(loop);
      return;
    }
    try {
      const rawDt = Math.min(2.4, (now - last) / 16.6667);
      last = now;
      updateTimeBurstState(rawDt);
      updateTimeStopClockSfx(rawDt);
      applyTimeStopSilence();

      let dt = rawDt;
      const inCombat = gameState === STATE.PLAY || gameState === STATE.BOSS;
      if (inCombat && blackFlashSlowTimer > 0) {
        const slowRatio = clamp(blackFlashSlowTimer / BLACK_FLASH_SLOW_DURATION, 0, 1);
        const dtScale = 1 - slowRatio * (1 - BLACK_FLASH_SLOW_SCALE);
        dt *= dtScale;
        blackFlashSlowTimer = Math.max(0, blackFlashSlowTimer - rawDt);
      } else if (blackFlashSlowTimer > 0) {
        blackFlashSlowTimer = Math.max(0, blackFlashSlowTimer - rawDt);
      }

      scheduleBGM();
      const actions = sampleActions();

      // DMC Style Change (V key + direction = direct select)
      // ↑+V = Swordmaster, →+V = Trickster, ↓+V = Gunslinger, ←+V = Royal Guard
      // V alone = cycle
      if (actions.styleChangePressed) {
        const styleColors = {
          swordmaster: "#ff4422", trickster: "#ffcc22",
          gunslinger: "#22aaff", royalguard: "#22ff88",
        };
        const styleNames = {
          swordmaster: "SWORDMASTER!", trickster: "TRICKSTER!",
          gunslinger: "GUNSLINGER!", royalguard: "ROYAL GUARD!",
        };
        let newStyle;
        if (input.up || input.jump) newStyle = "swordmaster";
        else if (input.right) newStyle = "trickster";
        else if (input.down) newStyle = "gunslinger";
        else if (input.left) newStyle = "royalguard";
        else {
          // Cycle
          const styles = ["swordmaster", "trickster", "gunslinger", "royalguard"];
          const idx = styles.indexOf(playerStyle);
          newStyle = styles[(idx + 1) % styles.length];
        }

        if (newStyle !== playerStyle) {
          playerStyle = newStyle;

          // Cut-in effect
          styleCutInTimer = STYLE_CUT_IN_DURATION;
          styleCutInName = styleNames[playerStyle];
          styleCutInColor = styleColors[playerStyle] || "#ffffff";

          hudMessage = styleCutInName;
          hudTimer = 60;

          // Impact flash
          triggerImpact(2.0, player.x + player.w * 0.5, player.y + player.h * 0.5, 3.0);
          if (seWhipSwing) playSound(seWhipSwing, 0.6, 1.6);

          // Style switch sparks
          const px = player.x + player.w * 0.5;
          const py = player.y + player.h * 0.5;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            hitSparks.push({
              x: px, y: py,
              vx: Math.cos(angle) * 3,
              vy: Math.sin(angle) * 3,
              life: 14, maxLife: 14,
              color: styleCutInColor,
            });
          }

          // Reset timers
          shotReloadTimer = 0;
          attackCooldown = 0;
          attackChargeTimer = 0;
          swordComboStage = 0;
          swordComboTimer = 0;
          swordChargeTimer = 0;
          swordChargeReadyPlayed = false;
          swordStingerActive = false;
          swordStingerTimer = 0;
          swordUpperActive = false;
          swordUpperHangTimer = 0;
          swordSlamActive = false;
          swordAttackCooldown = 0;
          driveChargeActive = false;
          driveChargeTimer = 0;

          updateStyleUI();
        }
      }
      // Decrement cut-in timer
      if (styleCutInTimer > 0) styleCutInTimer -= rawDt;

      if (inCombat) {
        const dodgeFrozen = updateEmergencyDodge(rawDt, actions);
        if (dodgeFrozen) {
          dt *= EMERGENCY_DODGE_SLOWMO_SCALE;
        }
      }

      update(dt, actions);
      refreshBurstButtonUi();
      render();
      _loopErrorCount = 0;
    } catch (e) {
      if (_loopErrorCount < 10) {
        console.error("[game loop error]", e);
      }
      _loopErrorCount++;
      // Emergency reset to prevent stuck state after errors
      shotChargeTimer = 0;
      shotMachineGunCount = 0;
    }
    requestAnimationFrame(loop);
  }


  // Version Indicator (Fix for missing definition)
  const GAME_VERSION = "v0.6.1 (GunnerFix)";

  // --- Gunner UI & Helper Functions ---
  // --- Gunner UI & Helper Functions ---
  const btnAttack = document.getElementById("btn-attack");
  const hudAmmo = document.getElementById("hud-ammo");
  const hudChargeFill = document.getElementById("hud-charge-fill");

  // --- Mobile Touch Controls Auto-Detection ---
  const controlsSection = document.querySelector(".controls");
  if (controlsSection) {
    if (isTouchDevice) {
      controlsSection.removeAttribute("style");
    } else {
      controlsSection.style.display = "none";
    }
  }

  // Bind additional touch buttons (shoot, dash, down, skip)
  try {
    bindHoldButton("btn-shoot", "shoot");
    bindHoldButton("btn-dash", "dash");
    bindHoldButton("btn-down", "down");
    // Skip tutorial button triggers "start" input
    bindHoldButton("btn-skip", "start");
  } catch (_e) { console.error("[init] extra button setup", _e); }

  try { updateStyleUI(); } catch (_e) { console.error("[init] updateStyleUI", _e); }
  console.log("Game Version:", GAME_VERSION);
  requestAnimationFrame(loop);

  function updateStyleUI() {
    if (btnAttack) {
      // 色付けはCSS側（data-style属性セレクタ）に任せる
      btnAttack.dataset.style = playerStyle;
    }

    if (hudAmmo && hudChargeFill) {
      // 1. Ammo Display
      if (playerStyle === "gunner") {
        hudAmmo.style.display = "block";
        const maxAmmo = gunnerMaxAmmo;
        hudAmmo.textContent = `Ammo: ${gunnerAmmo} / ${maxAmmo}`;
        // Low Ammo Warning
        if (gunnerAmmo <= maxAmmo / 5) {
          hudAmmo.style.color = "#ff0000";
          hudAmmo.style.textShadow = "0 0 5px #ff0000";
        } else {
          hudAmmo.style.color = "#ffffff";
          hudAmmo.style.textShadow = "1px 1px 0 #000";
        }
      } else {
        hudAmmo.style.display = "none";
      }

      // 2. Charge Bar Display
      let chargeRatio = 0;

      if (playerStyle === "berserker") {
        chargeRatio = attackChargeTimer / ATTACK_CHARGE_MAX;
      } else if (playerStyle === "gunner") {
        chargeRatio = shotChargeTimer / SHOT_CHARGE_MAX;
      } else if (playerStyle === "swordmaster") {
        chargeRatio = swordChargeTimer / SWORD_CHARGE_MAX;
      }

      const chargeRatio2 = attack2ChargeTimer / ATTACK2_CHARGE_MAX;

      chargeRatio = Math.max(chargeRatio, chargeRatio2);
      chargeRatio = Math.min(1, Math.max(0, chargeRatio));

      hudChargeFill.style.width = `${chargeRatio * 100}%`;

      if (chargeRatio >= 1) {
        hudChargeFill.style.background = "#ffff00";
      } else {
        hudChargeFill.style.background = "#00ff00";
      }
    }
  }

  function drawAmmoUI() {
    if (playerStyle !== "gunner") return;

    ctx.save();
    const ammoRatio = clamp(gunnerAmmo / Math.max(1, gunnerMaxAmmo), 0, 1);
    const isLow = ammoRatio <= 0.2;
    const isEmpty = gunnerAmmo <= 0;
    const pulse = isEmpty ? Math.abs(Math.sin(performance.now() * 0.006)) : 0;

    // Background panel
    const panelX = 6;
    const panelY = 62;
    const panelW = 108;
    const panelH = 28;
    ctx.fillStyle = `rgba(0, 0, 0, ${isEmpty ? 0.82 + pulse * 0.1 : 0.72})`;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = isEmpty ? `rgba(255, 60, 60, ${0.7 + pulse * 0.3})` : isLow ? "rgba(255, 180, 60, 0.6)" : "rgba(0, 220, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    // Ammo text - larger and bolder
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (isEmpty) {
      ctx.fillStyle = `rgba(255, 50, 50, ${0.8 + pulse * 0.2})`;
      ctx.fillText("NO AMMO", panelX + 5, panelY + 3);
    } else if (isLow) {
      ctx.fillStyle = "#ff9933";
      ctx.fillText(`AMMO: ${gunnerAmmo}/${gunnerMaxAmmo}`, panelX + 5, panelY + 3);
    } else {
      ctx.fillStyle = "#00eeff";
      ctx.fillText(`AMMO: ${gunnerAmmo}/${gunnerMaxAmmo}`, panelX + 5, panelY + 3);
    }

    // Ammo bar - wider and taller
    const barX = panelX + 5;
    const barY = panelY + 17;
    const barW = panelW - 10;
    const barH = 7;

    ctx.fillStyle = "#222";
    ctx.fillRect(barX, barY, barW, barH);

    if (isEmpty) {
      ctx.fillStyle = `rgba(255, 40, 40, ${0.6 + pulse * 0.4})`;
    } else if (isLow) {
      ctx.fillStyle = "#ff9933";
    } else {
      ctx.fillStyle = "#00ddff";
    }
    ctx.fillRect(barX, barY, Math.floor(barW * ammoRatio), barH);

    // Highlight on top of bar
    if (ammoRatio > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(barX, barY, Math.floor(barW * ammoRatio), 2);
    }

    ctx.restore();
  }

  function drawChargeIndicator() {
    if (playerStyle !== "gunner" || shotChargeTimer <= 0) return;

    const x = player.x;
    const y = player.y - 10;
    const w = 20;
    const h = 4;
    const fill = clamp(shotChargeTimer / SHOT_CHARGE_MAX, 0, 1);

    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);

    // Color based on Tier
    let color = "#fff";
    if (shotChargeTimer >= SHOT_CHARGE_MAX) color = "#ff00ff"; // Bazooka
    else if (shotChargeTimer >= SHOT_TIER2_THRESHOLD) color = "#ffaa00"; // Shotgun
    else if (shotChargeTimer >= SHOT_TIER1_THRESHOLD) color = "#00ff00"; // Machinegun

    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * fill, h);
  }

  // --- Master Volume Slider ---
  const volSlider = document.getElementById("vol-slider");
  const volValue = document.getElementById("vol-value");
  function applyMasterVolume() {
    if (stageMusic && !stageMusic.paused) {
      try { stageMusic.volume = clamp(BGM_NORMAL_VOL * masterVolume, 0, 1); } catch (_e) {}
    }
    if (bossMusic && !bossMusic.paused) {
      try { bossMusic.volume = clamp(BOSS_BGM_VOL * masterVolume, 0, 1); } catch (_e) {}
    }
    if (invincibleMusic && !invincibleMusic.paused) {
      try { invincibleMusic.volume = clamp(INVINCIBLE_BGM_VOL * masterVolume, 0, 1); } catch (_e) {}
    }
  }
  if (volSlider) {
    volSlider.addEventListener("input", () => {
      masterVolume = parseInt(volSlider.value, 10) / 100;
      if (volValue) volValue.textContent = volSlider.value + "%";
      applyMasterVolume();
    });
  }
  // Mute toggle with M key
  let preMuteVolume = 0.7;
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyM") {
      if (masterVolume > 0) {
        preMuteVolume = masterVolume;
        masterVolume = 0;
      } else {
        masterVolume = preMuteVolume || 0.7;
      }
      if (volSlider) volSlider.value = Math.round(masterVolume * 100);
      if (volValue) volValue.textContent = Math.round(masterVolume * 100) + "%";
      applyMasterVolume();
    }
  });

  // --- Shell integration API (shell.js から利用) ---
  const shellPausedMedia = [];
  window.RRR = {
    pause() {
      if (shellPaused) return;
      shellPaused = true;
      // 押しっぱなし入力の解放（blurハンドラを再利用）
      window.dispatchEvent(new Event("blur"));
      shellPausedMedia.length = 0;
      for (const m of [stageMusic, bossMusic, invincibleMusic]) {
        if (m && !m.paused) {
          try { m.pause(); shellPausedMedia.push(m); } catch (_e) {}
        }
      }
      if (audioCtx && audioCtx.state === "running") {
        try { audioCtx.suspend(); } catch (_e) {}
      }
    },
    resume() {
      if (!shellPaused) return;
      shellPaused = false;
      for (const m of shellPausedMedia) {
        try { m.play().catch(() => {}); } catch (_e) {}
      }
      shellPausedMedia.length = 0;
      if (audioCtx && audioCtx.state === "suspended") {
        try { audioCtx.resume(); } catch (_e) {}
      }
    },
    isPaused: () => shellPaused,
    getState: () => gameState,
    isTouchDevice: () => isTouchDevice,
    getVisualMode: () => visualMode,
    toggleVisualMode: () => toggleVisualMode(),
    getMasterVolume: () => masterVolume,
    setMasterVolume(v) {
      masterVolume = clamp(v, 0, 1);
      if (volSlider) volSlider.value = Math.round(masterVolume * 100);
      if (volValue) volValue.textContent = Math.round(masterVolume * 100) + "%";
      applyMasterVolume();
    },
    returnToTitle() {
      // ポーズ中に保持したBGMは再開させない（タイトルBGMはエンジン側が管理）
      shellPausedMedia.length = 0;
      try { returnToTitle(); } catch (_e) { console.error("[shell] returnToTitle", _e); }
    },
  };

})();
