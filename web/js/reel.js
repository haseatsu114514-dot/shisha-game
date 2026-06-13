// MOKU!MOKU!パッキー — C.STATION公式マスコットアプリのスロット（日常リール）。
//
// 本編接続済み（2026-06-13）。仕様の正典は docs/pakki_slot_spec.md、
// 接続箇所は docs/pakki_slot_install_guide.md。動作確認用の試打台は web/reel_demo.html。
//
// Aタイプ＋天井のジャグラー風スロット。「1行動=1回転」で全画面のスロット画面が出て、
// GOGO!風の「MOKU!」ランプ（パッキー）が光ったら大当たり（完全告知）。回りきってから報酬確定。
// ・抽選は決定論RNG（シード＋総回転数）— ロードしても結果が変わらない＝リセマラ不可
// ・恩恵はステータスのみ:「直前の行動で伸びたステがさらに伸びる」アンコール抽選
// ・ハズレでも対象ステ+1（サイレント）。天井（ゾーン/本天井・持ち越し）で最終的に全員救済
// ・フリーズは1セーブ1回まで＆引き弱には裏で確率を上げる「見えない制御」入り
// ・抽選の中身は core に隔離してあり node テスト（web/test/reel.mjs）から検証する
"use strict";

const REEL = (() => {
  // ================================================================ 純粋コア
  // mulberry32: 軽量な決定論PRNG
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // 回転番号ごとに独立したストリームを切る（seed と count を混ぜる）
  function rngFor(seed, count) {
    return mulberry32((seed ^ Math.imul(count + 1, 2654435761)) >>> 0);
  }

  // ---- 役テーブル（weight 合計 1000）----
  // ジャグラー準拠の役構成（2026-06-13 オーナー指示）。1章 ≒ 14日×2行動 = 28回転前提:
  //   ベル＝ジャグラーの「ぶどう」枠の常連小役（1/6.7・コツコツ +2）
  //   リプレイ 1/7.3（実機オマージュ・再遊技）／チェリー＝角チェリー 1/25（うち約1/16が重複ペカ）
  //   REG=BAR（バケ）＝1/31／BIG=赤7＝1/36／中段チェリー等 1/200（BIG確定プレミア）
  //   ペカ合算 ≒ 1/14（バケ寄りに少し増量）／フリーズは別枠制御（下記）
  const ROLES = [
    { id: "miss",   weight: 604 },
    { id: "replay", weight: 137 },
    { id: "bell",   weight: 150 },  // ぶどう枠の常連小役（ジャグラーのぶどう相当）
    { id: "cherry", weight: 40 },   // 角チェリー（うち一部が重複ペカ）
    { id: "rare",   weight: 5 },    // 中段チェリー/単独パッキー → BIG確定（プレミア告知）
    { id: "reg",    weight: 32 },   // バケ（BAR）。オーナー指示で少し増量
    { id: "big",    weight: 28 },   // BIG（赤7）
    { id: "freeze", weight: 4 },    // 名目値。実際は FREEZE_CONTROL が管理する
  ];
  const PEKA = ["reg", "big", "freeze", "rare"]; // ランプが光る役（チェリー重複は別途）
  // チェリー重複: チェリーのうち約1/16で同時当選（重複ペカ）。
  // 1/8 だと重複だけで章0.4回出て「事件」感が薄れるため半減（2026-06-12）
  const CHERRY_OVERLAP = { chance: 0.0625, bigShare: 0.45 };
  // フリーズ制御:「完全確率に見せかけて管理」
  //   序盤は出ない → 通常 1/250 → 引けないまま回し込んだら裏でテーブル昇格 → 1セーブ1回まで。
  //   抑制/昇格ぶんの weight は big に折り込み、ペカ合算は外から見て一定に保つ
  const FREEZE_CONTROL = { warmupSpins: 20, baseWeight: 4, pityAt: 110, pityWeight: 12, maxPerSave: 1 };
  // 裏確変（引き弱救済）: 生涯ペカ数が期待値の55%を割っていたら、こっそり reg/big を1.7倍
  const RESCUE = { minSpins: 30, ratio: 0.55, mult: 1.7, expectedRate: 0.075 };
  // 天井: ゾーン=8連続ハズレで次回小役以上 ／ 本天井=40Gペカ無しで次回ペカ確定（日・章をまたいで持ち越し）
  const CEILING = { zoneRun: 8, mainRun: 40 };
  // ジャグ連: BIG級（big/rare/freeze/重複BIG）後 5G は reg/big ×1.5（ハズレから移譲）
  const JUG_REN = { games: 5, mult: 1.5 };
  const REPLAY_CHAIN_MAX = 4;

  // 恩恵はステータスのみ（現金・アイテムは出さない）。
  // exp は「直前の行動で伸びたステ」への上乗せ量。表示ルール（1-2=少し/3-4=上がった/5+=大きく）準拠。
  // quiet は通知なし（ハズレ+1の最低保証など）。
  const EFFECTS = {
    miss:   { exp: 1, quiet: true },
    replay: { exp: 1, quiet: true },
    bell:   { exp: 2 },                 // ぶどう枠の常連小役（コツコツ積もる）
    cherry: { exp: 2 },                 // 角チェリー。重複時はボーナスぶんが上乗せされる
    rare:   { exp: 6, zone: true },     // BIG確定（プレミア）
    reg:    { exp: 4 },
    big:    { exp: 6, zone: true },
    freeze: { exp: 8, zone: true },
  };

  function pickWeighted(rng, entries) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let v = rng() * total;
    for (const e of entries) { v -= e.weight; if (v < 0) return e.id; }
    return entries[entries.length - 1].id;
  }

  // その回転で実際に使う weight 表を組む（フリーズ制御・裏確変・ジャグ連を織り込む）。
  // st: { count, missRun, bonusGap, zoneLeft, bonusCount, freezeCount }
  function effectiveTable(st) {
    const t = ROLES.map((r) => ({ ...r }));
    const get = (id) => t.find((r) => r.id === id);
    // --- フリーズ制御（差分は big に折り込んでペカ合算を一定に保つ）
    let fz = FREEZE_CONTROL.baseWeight;
    if ((st.freezeCount || 0) >= FREEZE_CONTROL.maxPerSave) fz = 0;
    else if (st.count < FREEZE_CONTROL.warmupSpins) fz = 0;
    else if (st.count >= FREEZE_CONTROL.pityAt) fz = FREEZE_CONTROL.pityWeight;
    get("big").weight += FREEZE_CONTROL.baseWeight - fz;
    get("freeze").weight = fz;
    // --- 裏確変（引き弱救済）: reg/big を増やし、その分ハズレを減らす
    if (st.count >= RESCUE.minSpins &&
        (st.bonusCount || 0) < st.count * RESCUE.expectedRate * RESCUE.ratio) {
      let added = 0;
      for (const id of ["reg", "big"]) {
        const inc = Math.round(get(id).weight * (RESCUE.mult - 1));
        get(id).weight += inc; added += inc;
      }
      get("miss").weight = Math.max(1, get("miss").weight - added);
    }
    // --- ジャグ連ゾーン
    if (st.zoneLeft > 0) {
      let added = 0;
      for (const id of ["reg", "big"]) {
        const inc = Math.round(get(id).weight * (JUG_REN.mult - 1));
        get(id).weight += inc; added += inc;
      }
      get("miss").weight = Math.max(1, get("miss").weight - added);
    }
    return t;
  }

  // 1回転ぶんの役を決める（天井込み）。counters は spinSeries 側で更新する
  function rollRole(rng, st) {
    // 本天井: 次回ペカ確定（プレミア系は直撃専用なので reg/big から）
    if (st.bonusGap >= CEILING.mainRun) {
      return pickWeighted(rng, ROLES.filter((r) => r.id === "reg" || r.id === "big"));
    }
    let role = pickWeighted(rng, effectiveTable(st));
    // ゾーン天井: 連続ハズレが規定に達していたらハズレを小役以上に格上げ
    // （フリーズ/中段チェリーは救済からは出さない＝プレミアは直撃のみ）
    if (role === "miss" && st.missRun >= CEILING.zoneRun) {
      role = pickWeighted(rng, ROLES.filter((r) => !["miss", "freeze", "rare"].includes(r.id)));
    }
    return role;
  }

  // 告知バリエーション（ペカ時のみ）。プレミア系は低確率で世界が変わる
  const VARIANTS = [
    { id: "after",  weight: 64 },  // 後プカ（基本。リール停止→ペカッ）
    { id: "before", weight: 14 },  // 先プカ（レバオンで光る）
    { id: "okure",  weight: 12 },  // 遅れ「……プゴッ」（ガコッのパロ）
    { id: "silent", weight: 10 },  // 無音回転（SE消失＝プレミア告知）
  ];

  // ---- リール盤面（図柄ストリップ・実機ジャグラー配列を参考）----
  // seven=赤7(BIG) / bar=BAR(REG) / bell=ベル(ジャグラーのぶどう枠＝常連小役) /
  // cherry=角チェリー / replay=リプレイ(シーシャの水の青) / smoke=煙ブランク / pakki=パッキー柄(ピエロ枠)
  // ・各リール 赤7×1・BAR×1・パッキー×1（ピエロ相当の激レア）
  // ・左リールは「BARの2コマ下にチェリー」配置＝常にBAR狙い。ハズレはBARを中段に、
  //   チェリー成立時はBAR上段・チェリー下段（実機の角チェリー）。
  // ・横一列（上段/下段）の揃いはベル/リプレイ/7/BARでは作らない（同図柄を縦に隣接させない）。
  //   チェリーは小役なので下段（角）に止まってOK。有効ラインは中央＋斜め。
  const STRIPS = [
    // 左リール: bar(idx6) の2コマ下に cherry(idx8)＝常にBAR狙いで角チェリー
    ["seven", "bell", "replay", "bell", "smoke", "replay", "bar", "replay", "cherry", "bell", "replay", "smoke", "bell", "replay", "bell", "pakki"],
    // 中リール
    ["bell", "seven", "replay", "bell", "cherry", "bell", "replay", "smoke", "bell", "replay", "bell", "smoke", "bell", "bar", "replay", "pakki"],
    // 右リール: seven(idx2) の真下に bar(idx3)＝実機の「7の下にBAR」
    ["replay", "bell", "seven", "bar", "replay", "bell", "smoke", "bell", "replay", "cherry", "bell", "replay", "bell", "smoke", "bell", "pakki"],
  ];
  function stripIdx(strip, sym, rng) {
    const cands = [];
    strip.forEach((s, i) => { if (s === sym) cands.push(i); });
    return cands[Math.floor(rng() * cands.length)] || 0;
  }
  // ハズレ目: 左は「隣にチェリーが無い煙」（角チェリーに見える誤爆を防ぐ）
  function safeSmoke(strip, rng) {
    const cands = [];
    strip.forEach((s, i) => {
      if (s !== "smoke") return;
      const n = strip.length;
      if (strip[(i + 1) % n] === "cherry" || strip[(i - 1 + n) % n] === "cherry") return;
      cands.push(i);
    });
    return cands[Math.floor(rng() * cands.length)] || 0;
  }
  // 中段に止まる図柄のインデックスを返す（ボーナスはハズレ目で止まり、ランプが教える＝ジャグラー流）
  function stopsFor(role, rng) {
    const BAR0 = STRIPS[0].indexOf("bar"); // 左リールは常にBARを中段に＝BAR狙い
    const missStops = () => {
      // 左リールはBARを中段に（BAR狙い風）。中・右はバラして横揃いを作らない
      const midSym = rng() < 0.5 ? "smoke" : "cherry";
      const rightSym = midSym === "smoke" ? "replay" : (rng() < 0.5 ? "smoke" : "replay");
      return [
        BAR0,
        stripIdx(STRIPS[1], midSym, rng),
        stripIdx(STRIPS[2], rightSym, rng),
      ];
    };
    switch (role) {
      case "replay": return STRIPS.map((s) => stripIdx(s, "replay", rng));
      case "bell":   return STRIPS.map((s) => stripIdx(s, "bell", rng));
      case "cherry": {
        // 角チェリー（BAR狙い）: 左リールは BAR上段・チェリー下段（bar の2コマ下が cherry）
        return [(BAR0 + 1) % STRIPS[0].length,
                stripIdx(STRIPS[1], "smoke", rng), stripIdx(STRIPS[2], "smoke", rng)];
      }
      case "rare": {
        // 中段チェリー or 単独パッキー（どちらもBIG確定の出目）
        const sym = rng() < 0.6 ? "cherry" : "pakki";
        return [stripIdx(STRIPS[0], sym, rng),
                stripIdx(STRIPS[1], "smoke", rng), stripIdx(STRIPS[2], "replay", rng)];
      }
      default: return missStops(); // miss / reg / big / freeze
    }
  }

  // 有効ライン: 中段＋右下がり＋右上がり（実機ジャグラーは上下段も含む5ラインだが、
  // 本作はオーナー方針で「中央＋斜め」に絞る）。下段・上段の横揃いは作らない。
  const LINES = [
    { id: "center", weight: 60 },
    { id: "down",   weight: 20 }, // 右下がり（左上→右下）
    { id: "up",     weight: 20 }, // 右上がり（左下→右上）
  ];
  function pickLine(rng) { return pickWeighted(rng, LINES); }
  // 指定ラインに sym を揃える停止位置。表示は top=strip[s-1]/mid=strip[s]/bottom=strip[s+1]
  function lineStops(sym, line, rng) {
    return STRIPS.map((strip, i) => {
      const base = stripIdx(strip, sym, rng);
      const n = strip.length;
      let off = 0;
      if (line === "down") off = (i === 0 ? 1 : i === 2 ? -1 : 0); // 左上→右下
      else if (line === "up") off = (i === 0 ? -1 : i === 2 ? 1 : 0); // 左下→右上
      return (base + off + n) % n;
    });
  }

  // 1行動ぶんの抽選（リプレイ連鎖込み）。reel の counters/count を進め、結果配列を返す。
  // 結果はこの場で確定・保存される前提（決定論なのでロードしても同じ結果になる）
  function spinSeries(reel, ctx) {
    const results = [];
    let chain = 0;
    do {
      const rng = rngFor(reel.seed, reel.count);
      const st = {
        count: reel.count, missRun: reel.missRun, bonusGap: reel.bonusGap,
        zoneLeft: reel.zoneLeft, bonusCount: reel.bonusCount || 0, freezeCount: reel.freezeCount || 0,
      };
      const role = rollRole(rng, st);
      // チェリー重複（角チェリー＋同時当選）
      let overlap = null;
      if (role === "cherry" && rng() < CHERRY_OVERLAP.chance) {
        overlap = rng() < CHERRY_OVERLAP.bigShare ? "big" : "reg";
      }
      const eff = EFFECTS[role];
      const isPeka = PEKA.includes(role) || !!overlap;
      const premium = role === "rare" || role === "freeze";
      // 当たり/ボーナスは揃えるライン（中央/斜め）を決める。小役は初期停止からそのラインに揃える
      const line = (role === "bell" || role === "replay" || isPeka) ? pickLine(rng) : "center";
      const stops = (role === "bell" || role === "replay") ? lineStops(role, line, rng) : stopsFor(role, rng);
      const result = {
        n: reel.count,
        role,
        overlap,
        premium,
        line,
        hitGap: isPeka ? st.bonusGap + 1 : 0, // この当たりまでのゲーム数（データランプ用）
        stops,
        variant: isPeka && role !== "freeze"
          ? (premium ? "premium" : pickWeighted(rng, VARIANTS))
          : "none",
        exp: (eff.exp || 0) + (overlap ? EFFECTS[overlap].exp : 0),
        quiet: !!eff.quiet && !overlap,
        zone: !!eff.zone || overlap === "big",
        gakkun: !!ctx && !!ctx.chapterFirst && chain === 0,
        ceiling: st.bonusGap >= CEILING.mainRun ? "main" : (role !== "miss" && st.missRun >= CEILING.zoneRun ? "zone" : ""),
      };
      // カウンタ更新
      reel.count += 1;
      reel.missRun = role === "miss" ? reel.missRun + 1 : 0;
      reel.bonusGap = isPeka ? 0 : reel.bonusGap + 1;
      reel.bonusCount = (reel.bonusCount || 0) + (isPeka ? 1 : 0);
      if (role === "freeze") reel.freezeCount = (reel.freezeCount || 0) + 1;
      if (result.zone) reel.zoneLeft = JUG_REN.games;
      else if (reel.zoneLeft > 0) reel.zoneLeft -= 1;
      results.push(result);
      if (role !== "replay") break;
      chain += 1;
    } while (chain < REPLAY_CHAIN_MAX);
    return results;
  }

  // バランス調整用シミュレータ（コンソールから __reelDebug.simulate(100000) で分布確認）
  function simulate(n, seed) {
    const reel = {
      seed: (seed === undefined ? 1 : seed) >>> 0,
      count: 0, missRun: 0, bonusGap: 0, zoneLeft: 0, bonusCount: 0, freezeCount: 0,
    };
    const dist = {}; let spins = 0; let exp = 0; let overlaps = 0; let pekas = 0;
    while (spins < n) {
      for (const r of spinSeries(reel, {})) {
        dist[r.role] = (dist[r.role] || 0) + 1;
        exp += r.exp; spins++;
        if (r.overlap) overlaps++;
        if (PEKA.includes(r.role) || r.overlap) pekas++;
      }
    }
    const out = { spins, exp, overlaps, pekaRate: `1/${(spins / pekas).toFixed(1)}`, perChapter28: {} };
    for (const [k, v] of Object.entries(dist)) {
      out[k] = `${v} (1/${(spins / v).toFixed(1)})`;
      out.perChapter28[k] = +(v / spins * 28).toFixed(2);
    }
    return out;
  }

  const core = {
    mulberry32, rngFor, ROLES, EFFECTS, PEKA, CEILING, JUG_REN, REPLAY_CHAIN_MAX,
    CHERRY_OVERLAP, FREEZE_CONTROL, RESCUE, VARIANTS, STRIPS, LINES,
    effectiveTable, rollRole, stopsFor, pickLine, lineStops, spinSeries, simulate, pickWeighted,
  };

  // ================================================================ ここからブラウザ専用
  // game.js のグローバル: state / save / gainBanner / updateHud / STAT_KEYS /
  //   STAT_BADGE / config / faceIconHtml を実行時参照する。
  // 行動するたびに【全画面スロット画面】(#reel-stage) を出し、回りきってから報酬を確定する。

  function newReelState() {
    return {
      seed: (Math.random() * 0x100000000) >>> 0,
      count: 0,
      missRun: 0,     // ゾーン天井用: 連続ハズレ数
      bonusGap: 0,    // 本天井用: ペカ間の回転数（持ち越し）
      zoneLeft: 0,    // ジャグ連ゾーン残りG
      bonusCount: 0,  // 生涯ペカ数（裏確変の判定に使う）
      freezeCount: 0, // フリーズ取得数（1セーブ1回制御）
      pending: [],    // 未演出かつ未確定の結果（演出後に報酬を適用する）
      renLeft: 0,     // モク連チャレンジ残りG（0=非アクティブ。演出のみ・恩恵なし）
      introDone: false,
      lastChapter: 0,
      note: { big: 0, reg: 0, rare: 0, freeze: 0, replay: 0, cherry: 0, cherryOverlap: 0, bell: 0, freezeLog: [], history: [] },
    };
  }

  // ---- 直前の行動で伸びたステの記録（gainStat から呼ばれる）----
  let statBuffer = {};
  function noteStat(en, amount) {
    if (!en || !(amount > 0)) return;
    statBuffer[en] = (statBuffer[en] || 0) + amount;
  }
  function pickTarget() {
    const keys = Object.keys(statBuffer);
    let target = null;
    if (keys.length) {
      const order = ["technique", "sense", "guts", "charm", "insight"];
      target = order.filter((k) => keys.includes(k))
        .sort((a, b) => statBuffer[b] - statBuffer[a])[0] || keys[0];
    } else if (typeof state !== "undefined" && state && state.stats) {
      // 行動がステを伸ばさなかった場合は一番低いステ（家シーシャと同じ思想）
      target = Object.entries(state.stats).sort((a, b) => a[1] - b[1])[0][0];
    }
    statBuffer = {};
    return target || "guts";
  }

  function fx() {
    try { return (typeof config !== "undefined" && config.reelFx) || "full"; } catch (e) { return "full"; }
  }
  function sfx(name, ...args) {
    if (fx() === "off") return;
    if (typeof window !== "undefined" && window.SFX && SFX[name]) { try { SFX[name](...args); } catch (e) { /* noop */ } }
  }

  // ---- 抽選コミット（カウンタと記録は確定。報酬は applyReward で演出後に確定する） ----
  function onAction() {
    if (typeof state === "undefined" || !state || !state.reel) return;
    if (state.phase !== "daily") return; // 日常の行動のみ
    const reel = state.reel;
    const chapterFirst = reel.lastChapter !== state.chapter;
    reel.lastChapter = state.chapter;
    const target = pickTarget();
    const results = spinSeries(reel, { chapterFirst });
    for (const r of results) {
      r.target = target; r.applied = false;
      const note = reel.note || (reel.note = {});
      const bump = (k) => { note[k] = (note[k] || 0) + 1; };
      if (r.role === "big") bump("big");
      if (r.role === "reg") bump("reg");
      if (r.role === "rare") bump("rare");
      if (r.role === "replay") bump("replay");
      if (r.role === "cherry") bump("cherry");
      if (r.overlap) bump("cherryOverlap");
      if (r.role === "bell") bump("bell");
      if (r.role === "freeze") {
        bump("freeze");
        (note.freezeLog || (note.freezeLog = [])).push({ chapter: state.chapter, day: state.day, n: r.n });
      }
      // データランプ用の当たり履歴（BB=赤7/プレミア/フリーズ・重複BIG ／ RB=BAR）
      const isPeka = PEKA.includes(r.role) || !!r.overlap;
      if (isPeka) {
        const kind = (r.role === "reg" || r.overlap === "reg") ? "RB" : "BB";
        (note.history || (note.history = [])).push({ kind, g: r.hitGap || 0 });
        if (note.history.length > 30) note.history.shift();
      }
      reel.pending.push(r);
    }
    if (typeof save === "function") save();
    if (typeof updateHud === "function") updateHud();
  }

  // 報酬確定（スロットが回りきってから呼ぶ＝「回ってから経験値」）
  function applyReward(r) {
    if (!r || r.applied) return;
    r.applied = true;
    if (r.exp > 0 && state.stats && r.target in state.stats) {
      state.stats[r.target] = Math.max(0, Math.min(100, state.stats[r.target] + r.exp));
    }
    if (typeof updateHud === "function") updateHud();
    if (typeof save === "function") save();
  }

  // ================================================================ 全画面ステージ
  // 図柄は当面 CSS/絵文字のプレースホルダ。後で画像生成に差し替え可能:
  //   assets/reel/sym_<id>.png（seven/bar/bell/cherry/replay/smoke/pakki）を置いて
  //   build_data.py / build_standalone.py で取り込むと自動で画像表示に切り替わる（symHtml）。
  const SYM = {
    seven:  '<span class="sym sym-seven">7</span>',
    bar:    '<span class="sym sym-bar">BAR</span>',
    bell:   '<span class="sym sym-bell"></span>',   // 形は CSS で（沖ドキ風の鐘＋パイン網目）
    cherry: '<span class="sym sym-cherry">🍒</span>',
    replay: '<span class="sym sym-replay">💧</span>',
    smoke:  '<span class="sym sym-smoke">☁︎</span>',
    pakki:  '<span class="sym sym-pakki">ぷ</span>',
  };
  // 図柄画像が用意されていれば <img> で差し替え、無ければ CSS プレースホルダにフォールバック
  function symAsset(s) {
    const key = "assets/reel/sym_" + s + ".png";
    if (typeof window !== "undefined" && window.ASSET_DATA && window.ASSET_DATA[key]) return window.ASSET_DATA[key];
    return "../" + key; // 開発時（web/ から見た相対）
  }
  function symAvailable(s) {
    const key = "assets/reel/sym_" + s + ".png";
    if (typeof window !== "undefined" && window.ASSET_DATA && window.ASSET_DATA[key]) return true;
    const D2 = (typeof window !== "undefined" && window.GAME_DATA) || null;
    return !!(D2 && Array.isArray(D2.reel_symbols) && D2.reel_symbols.includes(s));
  }
  function symHtml(s) {
    if (symAvailable(s)) return '<span class="sym sym-img sym-' + s + '" style="background-image:url(\'' + symAsset(s) + '\')"></span>';
    return SYM[s];
  }
  function pakkiFace(cls) {
    if (typeof faceIconHtml === "function") { const h = faceIconHtml("packii", cls || "rs-face"); if (h) return h; }
    return '<span class="' + (cls || "rs-face") + ' rs-face-fallback">ぷ</span>';
  }

  const CELL = 84, LEN = STRIPS[0].length;
  let stage = null, busy = false, skipReq = false;

  function ensureStage() {
    if (stage) return stage;
    const game = document.querySelector("#game"); if (!game) return null;
    stage = document.createElement("div"); stage.id = "reel-stage";
    stage.innerHTML =
      '<div class="rstage-veil"></div>' +
      '<div class="rstage-inner">' +
        '<div class="rstage-data" id="rstage-data"></div>' +
        '<div class="rstage-challenge" id="rstage-challenge"></div>' +
        '<div class="rstage-cabinet">' +
          '<div class="rstage-top">' +
            '<div class="rstage-lamp" id="rstage-lamp"><span class="rl-sign"><i>M</i><i>O</i><i>K</i><i>U</i><i>!</i></span></div>' +
          '</div>' +
          '<div class="rstage-window">' +
            '<div class="rstage-reels">' +
              STRIPS.map((strip) => '<div class="rstage-reel"><div class="rstage-strip">' +
                strip.concat(strip, strip).map((s) => '<div class="rstage-cell">' + symHtml(s) + '</div>').join('') +
              '</div></div>').join('') +
            '</div>' +
            '<div class="rstage-lines" id="rstage-lines">' +
              '<span class="payline center"></span><span class="payline down"></span><span class="payline up"></span>' +
            '</div>' +
          '</div>' +
          '<div class="rstage-deck">' +
            '<div class="rstage-lever" id="rstage-lever"><span class="lever-mount"></span><span class="lever-stick"></span><span class="lever-ball"><i></i></span></div>' +
            '<div class="rstage-bet"><span class="betbtn max">MAX<br>BET</span></div>' +
            '<div class="rstage-stops"><span class="stopbtn"></span><span class="stopbtn"></span><span class="stopbtn"></span></div>' +
          '</div>' +
          '<div class="rstage-bottom">' +
            '<div class="rl-mascot">' + pakkiFace("rs-face") + '</div>' +
            '<div class="rstage-name">MOKU!MOKU!パッキー</div>' +
          '</div>' +
        '</div>' +
        '<div class="rstage-banner" id="rstage-banner"></div>' +
      '</div>' +
      '<div class="rstage-skip">タップでとばす</div>';
    game.appendChild(stage);
    stage.addEventListener("click", () => { skipReq = true; });
    setStops([1, 1, 1]);
    return stage;
  }
  function strips() { return [...stage.querySelectorAll(".rstage-strip")]; }
  function tyFor(i) { return -CELL * (i + LEN - 1); }
  function setStops(s) { strips().forEach((el, i) => { el.classList.remove("spinning"); el.style.transform = "translateY(" + tyFor(s[i]) + "px)"; }); }
  function lamp(on, prem) {
    const l = stage && stage.querySelector("#rstage-lamp"); if (!l) return;
    l.classList.toggle("lit", !!on); l.classList.toggle("premium", !!prem);
    stage.classList.toggle("lamp-on", !!on); // 顔（マスコット）も連動して光らせる
  }
  function banner(html, cls) { const b = stage && stage.querySelector("#rstage-banner"); if (!b) return; b.className = "rstage-banner" + (cls ? " " + cls : "") + (html ? " show" : ""); b.innerHTML = html || ""; }
  function setMode(m) { if (!stage) return; stage.classList.toggle("mini", m === "mini"); stage.classList.toggle("full", m === "full"); }
  function openStage(mode) { ensureStage(); stage.classList.add("show"); setMode(mode || "mini"); renderData(); renderChallenge(); }
  function closeStage() { if (stage) { stage.classList.remove("show", "freeze-mode", "full", "mini"); banner(""); lamp(false); clearLines(); } }
  function hideStage() { if (stage) stage.classList.remove("show"); }

  // 有効ライン（中央/斜め）の点滅
  function clearLines() { if (!stage) return; stage.querySelectorAll(".payline").forEach((p) => p.classList.remove("on")); }
  function flashLine(line) {
    if (!stage) return; clearLines();
    const el = stage.querySelector(".payline." + (line || "center"));
    if (el) el.classList.add("on");
  }

  // データランプ（BB/RB回数・総ゲーム・直近の当たりG履歴）
  function renderData() {
    const box = stage && stage.querySelector("#rstage-data"); if (!box || !state || !state.reel) return;
    const hist = (state.reel.note && state.reel.note.history) || [];
    const bb = hist.filter((h) => h.kind === "BB").length;
    const rb = hist.filter((h) => h.kind === "RB").length;
    const recent = hist.slice(-8);
    box.innerHTML =
      '<span class="rd-cell rd-bb">BB <b>' + bb + '</b></span>' +
      '<span class="rd-cell rd-rb">RB <b>' + rb + '</b></span>' +
      '<span class="rd-cell rd-g">G <b>' + (state.reel.count || 0) + '</b></span>' +
      '<span class="rd-hist">' + recent.map((h) => '<i class="' + (h.kind === "RB" ? "rb" : "bb") + '">' + h.g + '</i>').join('') + '</span>';
  }

  // モク連チャレンジ（残りG表示。恩恵なしの演出）
  function renderChallenge() {
    const box = stage && stage.querySelector("#rstage-challenge"); if (!box || !state || !state.reel) return;
    const left = state.reel.renLeft || 0;
    if (left > 0) { box.classList.add("show"); box.innerHTML = '<span class="rc-fire">🔥</span> モク連チャレンジ <b>残り ' + left + '</b>'; }
    else { box.classList.remove("show"); box.innerHTML = ''; }
  }

  // skip対応の待機。タップ（skipReq）で即解決
  function wait(ms) {
    return new Promise((resolve) => {
      if (skipReq) return resolve();
      const to = setTimeout(() => { clearInterval(iv); resolve(); }, ms);
      const iv = setInterval(() => { if (skipReq) { clearTimeout(to); clearInterval(iv); resolve(); } }, 40);
    });
  }

  async function spinReels(stopArr, opts) {
    opts = opts || {};
    const els = strips();
    // レバーオン: レバーをガコッと引く
    const lever = stage.querySelector("#rstage-lever");
    if (lever) { lever.classList.add("pull"); setTimeout(() => lever.classList.remove("pull"), 320); }
    const btns = [...stage.querySelectorAll(".stopbtn")];
    btns.forEach((b) => b.classList.add("armed"));
    els.forEach((el) => { el.style.transform = ""; el.classList.add("spinning"); });
    if (opts.silent) stage.classList.add("silent"); else stage.classList.remove("silent");
    await wait(opts.fast ? 160 : (opts.silent ? 1300 : 540));
    for (let i = 0; i < 3; i++) {
      els[i].classList.remove("spinning");
      els[i].style.transform = "translateY(" + tyFor(stopArr[i]) + "px)";
      els[i].classList.add("land");
      // 対応する停止ボタンを押した演出
      if (btns[i]) { btns[i].classList.remove("armed"); btns[i].classList.add("hit"); setTimeout(() => btns[i].classList.remove("hit"), 220); }
      sfx("reelStop");
      await wait(opts.fast ? 60 : 160);
      els[i].classList.remove("land");
    }
    btns.forEach((b) => b.classList.remove("armed"));
    stage.classList.remove("silent");
  }

  // 抽象表現でステ上昇を見せる（数値は出さない＝CLAUDE.md準拠）
  function rewardWord(exp) { return exp >= 5 ? "大きく上がった" : exp >= 3 ? "上がった" : "少し上がった"; }
  async function showReward(r, fast, bonus) {
    const names = typeof STAT_KEYS !== "undefined" ? STAT_KEYS : {};
    const badges = typeof STAT_BADGE !== "undefined" ? STAT_BADGE : {};
    const nm = names[r.target] || r.target;
    banner('<div class="rs-reward' + (bonus ? " bonus" : "") + '">' +
      '<span class="rs-rw-badge">' + (badges[r.target] || "上") + '</span>' +
      '<span class="rs-rw-text">【' + nm + '】が<br>' + rewardWord(r.exp) + '！</span></div>', "reward");
    if (!bonus) sfx("reelWin");
    await wait(fast ? 240 : 1050);
  }

  // ミニ表示の1回転（通常・小役）: 左下の小さな筐体で素早く回す。当たり（ペカ）は出さない
  async function presentMini(r) {
    banner(""); lamp(false);
    if (r.gakkun) { stage.classList.add("gakkun"); setTimeout(() => stage.classList.remove("gakkun"), 500); }
    sfx("reelLever");
    await spinReels(r.stops, { fast: true });
    if (r.role === "replay") { stage.classList.add("flash"); sfx("reelWin"); flashLine(r.line); setTimeout(() => { stage.classList.remove("flash"); clearLines(); }, 380); }
    else if (r.role === "bell") { sfx("reelWin"); flashLine(r.line); setTimeout(clearLines, 380); }
    else if (r.role === "cherry") { sfx("reelWin"); } // 角チェリーはライン点滅なし
    if (!r.quiet) quietGain(r); // 小役のステ上昇は隅のバナーで（数値は出さない）
    await wait(220);
  }

  // 1回転の全画面演出（当たり＝ペカ用）
  async function presentOne(r) {
    const fast = fx() === "lite";
    banner(""); lamp(false);
    if (r.gakkun) { stage.classList.add("gakkun"); setTimeout(() => stage.classList.remove("gakkun"), 500); }
    if (r.role === "freeze" && !fast) { await presentFreeze(r); return; }

    const silent = r.variant === "silent" && !fast;
    if (!silent) sfx("reelLever");
    if (r.variant === "before" && !fast) lamp(true, false);                  // 先プカ
    if (r.variant === "okure" && !fast) setTimeout(() => sfx("pugo"), 420);   // 遅れプゴッ
    await spinReels(r.stops, { fast, silent });

    if (r.role === "miss") { banner('<span class="rs-koto">こつこつ…</span>', "quiet"); await wait(fast ? 140 : 380); return; }
    if (r.role === "replay") {
      stage.classList.add("flash"); sfx("reelWin"); flashLine(r.line);
      banner('<b>リプレイ</b><span>もう1回転！</span>', "replay");
      await wait(fast ? 150 : 680); stage.classList.remove("flash"); clearLines(); return;
    }
    if (r.role === "bell") { sfx("reelWin"); flashLine(r.line); banner('<b>ベル</b>', "win"); await showReward(r, fast); clearLines(); return; }
    if (r.role === "cherry" && !r.overlap) { sfx("reelWin"); banner('<b>チェリー</b>', "win"); await showReward(r, fast); return; }

    // ---- ペカ（reg / big / rare / チェリー重複）----
    const big = r.role === "big" || r.role === "rare" || r.overlap === "big";
    if (r.variant === "okure" && !fast) await wait(280);
    lamp(true, r.premium || r.ceiling === "main");
    sfx("puka");
    banner(r.premium ? '<b>ぷぷぷぷぷーっ！</b>' : (r.ceiling === "main" ? '<b>おたすけパッキー！</b>' : '<b>ぷぷぷっ！</b>'), "peka");
    await wait(fast ? 160 : 680);
    // 7 / BAR を有効ライン（中央/斜め）にそろえる
    banner('<span>' + (big ? "赤7" : "BAR") + 'をそろえろ！</span>', "aim");
    await spinReels(lineStops(big ? "seven" : "bar", r.line || "center", Math.random), { fast });
    flashLine(r.line);
    sfx("fanfare");
    stage.classList.add("win-flash"); setTimeout(() => stage.classList.remove("win-flash"), 600);
    await showReward(r, fast, true);
    clearLines();
  }

  // ロングフリーズ（プレミア）
  async function presentFreeze(r) {
    const els = strips();
    els.forEach((el) => { el.style.transform = ""; el.classList.add("spinning"); });
    await wait(500);
    els.forEach((el) => el.classList.add("frozen"));
    sfx("pugo"); stage.classList.add("silent", "freeze-mode");
    await wait(900);
    banner('<div class="rs-glitch"></div><div class="rs-encode"><b>EN:CODE</b><span>運命、再コンパイル中……</span></div>', "freeze");
    sfx("glitch");
    await wait(1400);
    els.forEach((el) => el.classList.remove("frozen", "spinning"));
    stage.classList.remove("silent");
    setStops(STRIPS.map((s) => s.indexOf("seven")));
    banner('<div class="rs-freeze-label">FREEZE</div>' +
      '<div class="rs-pakki-dance">' + pakkiFace("rs-face big") + pakkiFace("rs-face big") + pakkiFace("rs-face big") + '</div>' +
      '<div class="rs-freeze-sub">ぷぷぷぷぷーーっ！！</div>', "freeze boom");
    sfx("freezeBoom"); sfx("fanfare"); lamp(true, true);
    await wait(1900);
    stage.classList.remove("freeze-mode");
    await showReward(r, false, true);
    banner('<div class="rs-hall">殿堂入り！スロノートに刻まれた</div>', "reward");
    await wait(1300);
  }

  // 演出OFF時の控えめなバナー（既存の隅バナーを流用）
  function quietGain(r) {
    if (typeof gainBanner !== "function" || r.quiet) return;
    const names = typeof STAT_KEYS !== "undefined" ? STAT_KEYS : {};
    const badges = typeof STAT_BADGE !== "undefined" ? STAT_BADGE : {};
    gainBanner({ kind: "stat", badge: badges[r.target] || "上", labelTop: "PAKKI SLOT", labelMain: names[r.target] || r.target, labelSub: rewardWord(r.exp) });
  }

  // pending を順に消化（リプレイ連鎖も「揃い→もう1回転」と続けて見せる）
  async function playSession() {
    const reel = state && state.reel;
    if (!reel || !reel.pending.length) return;
    if (busy) return; busy = true;
    try {
      if (fx() === "off") {
        for (const r of reel.pending) { applyReward(r); quietGain(r); updateRen(r); }
        reel.pending = []; if (typeof save === "function") save();
        return;
      }
      const fast = fx() === "lite";
      openStage("mini"); // 通常は左下にミニ筐体
      await wait(140);
      while (reel.pending.length) {
        const r = reel.pending[0];
        skipReq = false;
        renderChallenge();
        const peka = PEKA.includes(r.role) || !!r.overlap;
        if (peka) {
          // 当たって光る時だけ全画面に拡大
          setMode("full"); renderData(); renderChallenge();
          await wait(fast ? 80 : 440); // ズームイン
          await presentOne(r);
          applyReward(r);              // 回りきってから経験値を確定
          await runRen(r);             // モク連チャレンジ（GET/開始の盛り上げ）
          renderData();
          await wait(fast ? 80 : 260);
          setMode("mini");             // ミニへズームアウト
          await wait(fast ? 60 : 400);
        } else {
          await presentMini(r);
          applyReward(r);
          // モク連チャレンジ中の非当たりはカウントダウン（恩恵なし・カウンタのみ）
          if (reel.renLeft > 0) { reel.renLeft -= 1; renderChallenge(); }
        }
        reel.pending.shift();
        if (typeof save === "function") save();
        await wait(60);
      }
      // ミニ筐体はマップに常駐させる（closeStage しない）
    } finally { busy = false; }
  }

  // モク連チャレンジ: 当たるたびに10G挑戦開始。10G以内にまた当たれば「モク連GET！」で継続。
  // 恩恵は無し（純粋な盛り上げ演出）。renLeft は state に永続。
  function updateRen(r) {
    if (!state || !state.reel) return;
    const isPeka = PEKA.includes(r.role) || !!r.overlap;
    if (isPeka) { state.reel.renLeft = 10; }
    else if (state.reel.renLeft > 0) { state.reel.renLeft -= 1; }
  }
  async function runRen(r) {
    if (!state || !state.reel) return;
    const isPeka = PEKA.includes(r.role) || !!r.overlap;
    const fast = fx() === "lite";
    if (isPeka) {
      const wasActive = state.reel.renLeft > 0;
      state.reel.renLeft = 10; // 開始/継続
      renderChallenge();
      banner(wasActive ? '<b class="rc-get">モク連GET！</b>' : '<b class="rc-go">モク連チャレンジ！</b>', "ren");
      await wait(fast ? 200 : 1100);
    } else if (state.reel.renLeft > 0) {
      state.reel.renLeft -= 1;
      renderChallenge();
      if (state.reel.renLeft === 0) { banner('<span class="rc-miss">モク連ならず…</span>', "ren"); await wait(fast ? 120 : 600); }
    }
  }

  // 行動セッション（endAction から呼ぶ）: 抽選 → 全画面演出 → done
  function runActionSession(done) {
    done = done || function () {};
    if (typeof state === "undefined" || !state || !state.reel || state.phase !== "daily") { done(); return; }
    onAction();
    if (!state.reel.pending.length) { done(); return; }
    if (!state.reel.introDone) {
      if (fx() === "off") { state.reel.introDone = true; if (typeof save === "function") save(); playSession().then(done); return; }
      showIntro(() => { playSession().then(done); });
      return;
    }
    playSession().then(done);
  }

  // マップ表示時: 未消化があれば消化、無ければミニ筐体を常駐表示
  function onMapShown() {
    if (busy) return;
    if (typeof state === "undefined" || !state || !state.reel) return;
    if (fx() === "off") { hideStage(); return; } // 演出OFFは筐体を出さない
    if (!state.reel.pending.length) {
      // 行動の隙間: 左下にミニ筐体だけ常駐
      if (state.reel.introDone) openStage("mini");
      return;
    }
    if (!state.reel.introDone) { showIntro(() => playSession()); return; }
    playSession();
  }

  // ---- 初回のみ: パッキーのアプリ説明（詳しめ）----
  const INTRO_LINES = [
    "ぷぷぷっ！ C.STATIONの公式アプリ『MOKU!MOKU!パッキー』、キミのスマホに入れといたよ〜！",
    "使い方はカンタン。キミが一日に【行動】するたび、このスロットが自動でまわるんだ。自分でレバーは叩かない——勝手に、まわる。",
    "ボクの顔（このランプ）が【光ったら大当たり】！ 赤7やBARがそろって、キミのステータスがグーンと伸びるよ。",
    "ハズレても損はナシ。まわすたび、その日がんばったことが【ちょっとずつ】積もっていく。お金は出ないけど、そのぶん全部キミの実力になる。",
    "当たりが遠い日も心配ご無用。しばらく当たらないと【天井】でボクが救済する。粘った分はちゃーんと報われるよ。",
    "そして……ごくまれに、画面ごと世界がバグる【フリーズ】ってのがある。ゲームを通して拝めるかどうかの超レア。出たら自慢していい。",
    "むずかしいことは考えなくてOK。行動して、光ったら喜ぶ。それだけ！ それじゃ、いってみよう——ぷぷぷっ！",
  ];
  function showIntro(onClose) {
    let box = document.querySelector("#reel-intro");
    if (!box) { box = document.createElement("div"); box.id = "reel-intro"; document.querySelector("#game").appendChild(box); }
    let i = 0;
    const render = () => {
      box.innerHTML =
        '<div class="ri-panel">' +
          '<div class="ri-head">' + pakkiFace("rs-face big") + '<span class="ri-app">MOKU!MOKU!パッキー</span></div>' +
          '<p class="ri-text">' + INTRO_LINES[i] + '</p>' +
          '<span class="ri-next">▼ タップ（' + (i + 1) + '/' + INTRO_LINES.length + '）</span>' +
        '</div>';
    };
    render(); box.className = "show"; sfx("open");
    box.onclick = () => {
      i += 1;
      if (i === 2) sfx("puka");
      if (i < INTRO_LINES.length) { render(); sfx("click"); return; }
      box.className = ""; box.innerHTML = ""; box.onclick = null;
      state.reel.introDone = true; if (typeof save === "function") save();
      if (onClose) onClose();
    };
  }

  // デバッグ/調整用フック（テスト・コンソールから使う）
  if (typeof window !== "undefined") {
    window.__reelDebug = {
      core, simulate,
      state: () => (typeof state !== "undefined" && state ? state.reel : null),
      // 演出確認用: 役を偽造して全画面演出だけ再生（カウンタ・報酬は動かさない）
      async force(role, line) {
        const rng = mulberry32((Date.now() & 0xffff) >>> 0);
        const ln = line || (role === "bell" || role === "replay" || PEKA.includes(role) ? "center" : "center");
        const r = {
          n: 0, role, overlap: null, premium: role === "rare" || role === "freeze", line: ln,
          stops: (role === "bell" || role === "replay") ? lineStops(role, ln, rng) : stopsFor(role, rng),
          variant: PEKA.includes(role) && role !== "freeze" ? (role === "rare" ? "premium" : "after") : "none",
          exp: role === "miss" ? 1 : 6, quiet: role === "miss", zone: false, gakkun: false, ceiling: "", target: "technique", applied: true, hitGap: 0,
        };
        const peka = PEKA.includes(role) || !!r.overlap;
        openStage(peka ? "full" : "mini"); skipReq = false;
        if (peka) { await presentOne(r); } else { await presentMini(r); }
        // 確認用に少し残してミニへ
        if (peka) { await wait(300); setMode("mini"); }
      },
    };
  }

  return { core, newReelState, noteStat, onAction, runActionSession, onMapShown, hideStage };
})();

if (typeof window !== "undefined") window.REEL = REEL;
if (typeof module !== "undefined" && module.exports) module.exports = REEL;
