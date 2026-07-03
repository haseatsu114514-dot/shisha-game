// MOKUMOKUパッキー — 謎のマスコット「パッキー」のスロット（日常リール）。
//
// ⚠️ 実装待ちパッケージ（本編未接続）: 組み込み手順・仕様の正典は docs/pakki_slot_spec.md。
//    このファイル単体で完結しており、game.js 等への接続はオーナーのGOが出てから行う。
//
// Aタイプ＋天井。「1行動=1回転」でマップ隅のミニ筐体が回り、
// パッキーのランプが光ったら大当たり（完全告知）。
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
  // 回せる回数が少ない（1章 ≒ 14日×2行動 = 28回転）前提で逆算。
  // 天井（持ち越し）がある分、当たりはシブめに寄せる（2026-06-12 オーナー指示）:
  //   リプレイ 1/7.3（実機オマージュ）／チェリー 1/9.1（うち約1/16がボーナス重複）／
  //   ベル 1/83（レア小役）／中段チェリー等 1/200（BIG確定プレミア）／
  //   ペカ合算 ≒ 1/15（章1.8回前後。ハマれば天井が拾う）／フリーズは別枠制御（下記）
  const ROLES = [
    { id: "miss",   weight: 666 },
    { id: "replay", weight: 137 },
    { id: "cherry", weight: 110 },
    { id: "bell",   weight: 28 },
    { id: "rare",   weight: 5 },   // 中段チェリー/単独パッキー → BIG確定（プレミア告知）
    { id: "reg",    weight: 24 },
    { id: "big",    weight: 26 },
    { id: "freeze", weight: 4 },   // 名目値。実際は FREEZE_CONTROL が管理する
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
  const CEILING = { zoneRun: 8, mainRun: 15 }; // 本天井=15回でペカ確定（当たればリセット）。残り5回から示唆を出す
  // ジャグ連: BIG級（big/rare/freeze/重複BIG）後 5G は reg/big ×1.5（ハズレから移譲）
  const JUG_REN = { games: 5, mult: 1.5 };
  const REPLAY_CHAIN_MAX = 4;

  // 恩恵はステータスのみ（現金・アイテムは出さない）。
  // exp は「直前の行動で伸びたステ」への上乗せ量。表示ルール（1-2=少し/3-4=上がった/5+=大きく）準拠。
  // quiet は通知なし（ハズレ+1の最低保証など）。
  const EFFECTS = {
    miss:   { exp: 1, quiet: true },
    replay: { exp: 1, quiet: true },
    cherry: { exp: 2 },                 // 重複時はボーナスぶんが上乗せされる
    bell:   { exp: 3 },
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

  // ---- リール盤面（図柄ストリップ）----
  // seven=赤7 / bar=BAR / bell=パイナップルのベル / cherry=チェリー /
  // replay=リプレイ(シーシャの水の青) / smoke=煙ブランク / pakki=パッキー柄(ピエロ枠)
  const STRIPS = [
    ["seven", "smoke", "replay", "cherry", "smoke", "bar", "replay", "smoke", "bell", "cherry", "smoke", "replay", "pakki", "smoke", "cherry", "replay"],
    ["smoke", "seven", "replay", "smoke", "cherry", "bar", "smoke", "replay", "bell", "smoke", "cherry", "replay", "smoke", "pakki", "replay", "smoke"],
    ["replay", "smoke", "seven", "cherry", "replay", "bar", "smoke", "bell", "replay", "smoke", "cherry", "smoke", "replay", "bar", "smoke", "pakki"],
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
    const missStops = () => {
      // 左は煙固定なので、中・右が両方煙になると「煙揃い」に見えてしまう → 必ずバラす
      const midSym = rng() < 0.5 ? "smoke" : "cherry";
      const rightSym = midSym === "smoke" ? "replay" : (rng() < 0.5 ? "smoke" : "replay");
      return [
        safeSmoke(STRIPS[0], rng),
        stripIdx(STRIPS[1], midSym, rng),
        stripIdx(STRIPS[2], rightSym, rng),
      ];
    };
    switch (role) {
      case "replay": return STRIPS.map((s) => stripIdx(s, "replay", rng));
      case "bell":   return STRIPS.map((s) => stripIdx(s, "bell", rng));
      case "cherry": {
        // 角チェリー: 左リールのチェリーを上下どちらかの隅に見せる
        const c = stripIdx(STRIPS[0], "cherry", rng);
        const off = rng() < 0.5 ? 1 : -1;
        return [(c + off + STRIPS[0].length) % STRIPS[0].length,
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
      const result = {
        n: reel.count,
        role,
        overlap,
        premium,
        stops: stopsFor(role, rng),
        variant: isPeka && role !== "freeze"
          ? (premium ? "premium" : pickWeighted(rng, VARIANTS))
          : "none",
        exp: (eff.exp || 0) + (overlap ? EFFECTS[overlap].exp : 0),
        quiet: !!eff.quiet && !overlap,
        zone: !!eff.zone || overlap === "big",
        gakkun: !!ctx && !!ctx.chapterFirst && chain === 0,
        ceiling: st.bonusGap >= CEILING.mainRun ? "main" : (role !== "miss" && st.missRun >= CEILING.zoneRun ? "zone" : ""),
      };
      // リプレイ連鎖の途中（直前がリプレイ）かどうか。演出を速回しせずフルで見せる判定に使う
      result._afterReplay = chain > 0;
      // カウンタ更新
      reel.count += 1;
      reel.missRun = role === "miss" ? reel.missRun + 1 : 0;
      reel.bonusGap = isPeka ? 0 : reel.bonusGap + 1;
      // 本天井（15回）までの残り。当たれば満タンに戻る。残り5回から示唆を出す
      result.ceilingRemain = isPeka ? CEILING.mainRun : Math.max(0, CEILING.mainRun - reel.bonusGap);
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
    CHERRY_OVERLAP, FREEZE_CONTROL, RESCUE, VARIANTS, STRIPS,
    effectiveTable, rollRole, stopsFor, spinSeries, simulate, pickWeighted,
  };

  // ================================================================ ここからブラウザ専用
  // （game.js のグローバル: state / save / gainBanner / toast / updateHud /
  //   STAT_KEYS / STAT_BADGE / config / faceIconHtml / $ を実行時に参照する）

  function newReelState() {
    return {
      seed: (Math.random() * 0x100000000) >>> 0,
      count: 0,
      missRun: 0,     // ゾーン天井用: 連続ハズレ数
      bonusGap: 0,    // 本天井用: ペカ間の回転数（持ち越し）
      zoneLeft: 0,    // ジャグ連ゾーン残りG
      bonusCount: 0,  // 生涯ペカ数（裏確変の判定に使う）
      freezeCount: 0, // フリーズ取得数（1セーブ1回制御）
      pending: [],    // 未演出の結果（演出前にリロードしても同じ内容が再生される）
      introDone: false,
      lastChapter: 0,
      note: { big: 0, reg: 0, rare: 0, freeze: 0, replay: 0, cherry: 0, cherryOverlap: 0, bell: 0, freezeLog: [] },
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
      // 一番大きく伸びたステを対象に（同率はステ定義順で決定論的に）
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
    return "full";
  }
  function sfx(name, ...args) {
    if (fx() === "off") return;
    if (typeof window !== "undefined" && window.SFX && SFX[name]) { try { SFX[name](...args); } catch (e) { /* noop */ } }
  }

  // ---- 行動時のコミット（endAction から呼ばれる）----
  // 結果と報酬はこの瞬間に確定して state に書き込む。演出は後追い（スロットの内部抽選と同じ構造）
  function onAction() {
    if (typeof state === "undefined" || !state || !state.reel) return;
    if (state.phase !== "daily") return; // 日常の行動のみ（チュートリアル・大会は回さない）
    const reel = state.reel;
    const chapterFirst = reel.lastChapter !== state.chapter;
    reel.lastChapter = state.chapter;
    const target = pickTarget();
    const results = spinSeries(reel, { chapterFirst });
    for (const r of results) {
      r.target = target;
      // ステ上乗せ（直接書き込み。バナーは演出時に出す）。章ごとのソフトキャップを尊重(#42)
      if (r.exp > 0 && state.stats && target in state.stats) {
        const cap = (typeof statSoftCap === "function") ? statSoftCap() : 100;
        state.stats[target] = Math.max(0, Math.min(cap, state.stats[target] + r.exp));
      }
      // スロノート（Phase 2 の記録画面用に今から積んでおく）
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
      reel.pending.push(r);
    }
    if (typeof updateHud === "function") updateHud();
  }

  // ================================================================ ウィジェット・演出
  const CELL = 26;        // リール1コマの高さpx
  const LEN = STRIPS[0].length;
  let widget = null;
  let cutin = null;
  let busy = false;       // 演出シーケンス中
  let bonusWait = null;   // プカ点灯中（タップ待ち）の結果
  let idleWaiters = [];

  const SYM_HTML = {
    seven:  '<span class="sym sym-seven">7</span>',
    bar:    '<span class="sym sym-bar">BAR</span>',
    bell:   '<span class="sym sym-bell">🍍</span>',
    cherry: '<span class="sym sym-cherry">🍒</span>',
    replay: '<span class="sym sym-replay">💧</span>',
    smoke:  '<span class="sym sym-smoke">☁︎</span>',
    pakki:  '<span class="sym sym-pakki">ぷ</span>',
  };
  function pakkiFace(cls) {
    if (typeof faceIconHtml === "function") {
      const h = faceIconHtml("packii", cls || "rw-face");
      if (h) return h;
    }
    return `<span class="${(cls || "rw-face")} rw-face-fallback">ぷ</span>`;
  }

  function ensureWidget() {
    if (widget) return widget;
    const map = document.querySelector("#screen-map");
    if (!map) return null;
    widget = document.createElement("div");
    widget.id = "reel-widget";
    widget.innerHTML =
      `<div class="rw-lamp-wrap"><span class="rw-lamp-rays" aria-hidden="true"></span>` +
      `<button id="reel-lamp" type="button" title="MOKUMOKUパッキー">${pakkiFace("rw-face")}</button></div>` +
      `<span class="rw-lever-arm" aria-hidden="true"></span>` +
      `<div class="rw-machine">` +
      STRIPS.map((strip, i) =>
        `<div class="rw-reel" data-i="${i}"><div class="rw-strip">` +
        strip.concat(strip, strip).map((s) => `<div class="rw-cell">${SYM_HTML[s]}</div>`).join("") +
        `</div></div>`).join("") +
      `</div>` +
      `<div class="rw-plate">MOKUMOKU<b>パッキー</b></div>` +
      `<div class="rw-bubble" id="reel-bubble"></div>`;
    map.appendChild(widget);
    setStops([1, 1, 2]); // 初期出目
    document.querySelector("#reel-lamp").addEventListener("click", () => {
      if (bonusWait) settleBonus(bonusWait, false);
    });
    return widget;
  }
  function stripEls() { return [...widget.querySelectorAll(".rw-strip")]; }
  function tyFor(idx) { return -CELL * (idx + LEN - 1); }
  function setStops(stops) {
    stripEls().forEach((el, i) => {
      el.classList.remove("spinning");
      el.style.transform = `translateY(${tyFor(stops[i])}px)`;
    });
  }
  function bubble(text, ms, cls) {
    const b = document.querySelector("#reel-bubble");
    if (!b) return;
    b.textContent = text;
    b.classList.remove("hot", "rare");
    if (cls) b.classList.add(cls); // 熱い/レアなセリフは色を変える（T24）
    b.classList.add("show");
    clearTimeout(bubble._t);
    if (ms !== 0) bubble._t = setTimeout(() => b.classList.remove("show"), ms || 1800);
  }
  // 直近3件と被らないランダム抽選（同じセリフの連発を防ぐ・T24）
  const _recentLines = [];
  function pick(pool) {
    if (!pool || !pool.length) return "";
    let c, tries = 0;
    do { c = pool[Math.floor(Math.random() * pool.length)]; tries++; }
    while (_recentLines.includes(c) && tries < 10 && pool.length > 3);
    _recentLines.push(c); if (_recentLines.length > 3) _recentLines.shift();
    return c;
  }
  function lampOn(premium) {
    const lamp = document.querySelector("#reel-lamp");
    if (!lamp) return;
    lamp.classList.add("lit");
    if (premium) lamp.classList.add("premium");
    // GOGOランプ風: 点灯ポップ＋光条レイ＋中段ラインのフラッシュ。予熱は解除
    widget.classList.add("attract", "lamp-lit", "win-flash");
    widget.classList.remove("warm");
    if (premium) widget.classList.add("lamp-premium");
  }
  function lampOff() {
    const lamp = document.querySelector("#reel-lamp");
    if (!lamp) return;
    lamp.classList.remove("lit", "premium");
    widget.classList.remove("attract", "lamp-lit", "lamp-premium", "win-flash");
  }

  function ensureCutin() {
    if (cutin) return cutin;
    cutin = document.createElement("div");
    cutin.id = "reel-cutin";
    document.querySelector("#game").appendChild(cutin);
    return cutin;
  }

  function hasPending() {
    return !!(typeof state !== "undefined" && state && state.reel && state.reel.pending && state.reel.pending.length);
  }
  function isResolving() {
    return busy || !!bonusWait || hasPending();
  }
  function notifyIdle() {
    if (isResolving()) return;
    const waiters = idleWaiters.splice(0);
    waiters.forEach((fn) => fn());
  }
  function waitForIdle(cb, timeoutMs = 12000) {
    if (!cb) return;
    if (!isResolving()) return cb();
    let done = false;
    let timer = 0;
    const wrapped = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cb();
    };
    idleWaiters.push(wrapped);
    timer = setTimeout(() => {
      const i = idleWaiters.indexOf(wrapped);
      if (i >= 0) idleWaiters.splice(i, 1);
      wrapped();
    }, timeoutMs);
  }

  // ---- マップ表示時に未演出の結果を流す（showMap から呼ばれる）----
  function onMapShown() {
    if (typeof state === "undefined" || !state || !state.reel) return;
    if (!ensureWidget()) { notifyIdle(); return; }
    widget.classList.toggle("hidden", fx() === "off");
    if (busy) return;
    const queue = state.reel.pending;
    if (!queue || !queue.length) { notifyIdle(); return; }
    if (!state.reel.introDone) { showIntro(() => onMapShown()); return; }
    // 取り出してから保存（演出前にリロードされても二重適用しない。報酬は適用済み）
    const items = queue.splice(0, queue.length);
    if (typeof save === "function") save();
    runQueue(items);
  }

  function runQueue(items) {
    if (!items.length) { busy = false; notifyIdle(); return; }
    busy = true;
    // 積み残し（夜の分など）が複数あれば、最後の1件だけフル演出・残りは速回し。
    // ただしリプレイ連鎖（もう1回転）は一瞬で過ぎると何が起きたか分からないのでフルで見せる
    const item = items.shift();
    const inReplayChain = item.role === "replay" || item._afterReplay;
    const fast = fx() === "lite" || (items.length > 0 && !inReplayChain);
    presentSpin(item, fast, () => runQueue(items));
  }

  // ---- 1回転の演出 ----
  function presentSpin(r, fast, done) {
    if (!widget || !document.querySelector("#screen-map.active") || fx() === "off") {
      // マップ外・演出OFFなら結果通知だけ（報酬は適用済み）
      announce(r);
      return done();
    }
    // 前のボーナスがタップされないまま残っていたら即精算
    if (bonusWait) settleBonus(bonusWait, true);

    const silent = r.variant === "silent" && !fast;
    const strips = stripEls();
    lampOff();

    // レバオン（レバーアームを叩く小アニメ・ジャグラー風の儀式感）
    if (!fast) {
      widget.classList.add("lever-pull");
      setTimeout(() => widget.classList.remove("lever-pull"), 380);
    }
    if (r.gakkun) widget.classList.add("gakkun");           // 章の1回転目だけガックン（分かる人向け）
    setTimeout(() => widget.classList.remove("gakkun"), 500);
    if (!silent) sfx("reelLever");
    if (r.variant === "okure" && !fast) setTimeout(() => sfx("pugo"), 420); // 遅れ「……プゴッ」
    // 先告知（先プカ）は廃止：回転前には光らせない。点灯はリール停止後に見せてから揃える（T31）
    strips.forEach((el) => { el.style.transform = ""; el.classList.add("spinning"); });
    if (silent) widget.classList.add("silent-spin");

    if (r.role === "freeze" && !fast) return presentFreeze(r, done);

    // 停止（ハズレはテンポ最優先で速く）。
    // 当たり（ペカ予定）の回転は第3リールだけ「溜め」を入れる＝
    // 止まる……止まる……ペカッ、のジャグラー的なドキドキ（2026-07-02）
    const spinMs = fast ? 120 : silent ? 1600 : (r.role === "miss" ? 240 : 420);
    const gap = fast ? 40 : 130;
    const willPeka = PEKA.includes(r.role) || !!r.overlap;
    const tension = willPeka && !fast && r.role !== "freeze";
    const tensionMs = tension ? 560 : 0;
    setTimeout(() => {
      r.stops.forEach((stop, i) => {
        setTimeout(() => {
          const el = strips[i];
          el.classList.remove("spinning");
          el.style.transform = `translateY(${tyFor(stop)}px)`;
          el.classList.add("land");
          setTimeout(() => el.classList.remove("land"), 240);
          if (!silent && !fast) sfx("reelStop");
          if (tension && i === 1) widget.classList.add("tension");   // 2つ止まって残り1つ…
          if (i === 2) widget.classList.remove("tension");
        }, gap * i + (i === 2 ? tensionMs : 0));
      });
      setTimeout(() => {
        widget.classList.remove("silent-spin", "tension");
        afterStop(r, fast, done);
      }, gap * 2 + tensionMs + (fast ? 60 : 200) + (silent ? 500 : 0));
    }, spinMs);
  }

  // 役の恩恵をパッキー口調で説明する（T18）。経験値は数値を出さず体感語で
  function benefitLine(r) {
    const names = typeof STAT_KEYS !== "undefined" ? STAT_KEYS : {};
    const stat = (r && r.target && names[r.target]) ? names[r.target] : null;
    const amt = r.exp >= 6 ? "ぐーんと" : r.exp >= 4 ? "かなり" : r.exp >= 2 ? "ちょっと" : "少し";
    return stat ? `【${stat}】が${amt}上がったよ！` : `${amt}上がったよ！`;
  }
  // 天井が近いときの抽象的な示唆（数値は出さない・短く・近づくほど熱く・パターン多め）（T19/T21/T24）
  const CEILING_HINTS = {
    far:  ["……近いかも？", "そろそろ？", "む、来そう", "気配がする……", "んん？", "ボクの勘が……"],
    near: ["もうすぐ……！？", "近い……！", "ピクッ……！", "あと少し……？", "うずうず……！", "そろそろだよっ"],
    soon: ["次っ……！？", "来るッ……！", "いつ光っても……！", "ビンビンくる……！", "うおっ、もう！", "ためてためて……！"],
  };
  function ceilingHint(remain) {
    return pick(remain <= 1 ? CEILING_HINTS.soon : remain <= 3 ? CEILING_HINTS.near : CEILING_HINTS.far);
  }
  // 外れでもたまに楽しいことを言う（T18/T21/T24・短く・多バリエーション）。
  // パッキーの人格＝かわいい見た目で他人事、たまに毒、基本ごきげん（2026-07-02 見直し）
  const FUN_MISS = [
    "はずれ〜♪", "ぷぷっ、ノーカン！", "むむ、惜しい", "今、力ためてる！たぶん", "ボクはウソつくよ♪",
    "やる気は満タン！", "次に期待してね♪", "知ってた（嘘）", "ボクのせいじゃないよ？",
    "煙、いい色〜", "まばたきした？", "今のは練習！", "宇宙を感じる……", "ぷかぷか〜", "ぐぬぬ",
    "……はっ、寝てた", "ノーコメントで！", "むむむ", "ぼちぼち〜", "外れの音も、わりと好き",
    "ふー、ねむい", "鼻がムズムズ", "おっと", "んっ、今の見た？", "へいきへいき", "ボクは元気〜",
    "もういっちょ！", "ぷっぷくぷー", "なんでもないよ", "むにゃ……", "しゃきーん",
    "おなかすいた", "次こそ次こそ", "ボクを信じて？", "うーん、地味", "運も仕込みのうち！",
    "ぼー……", "き、来るかと思った", "ふっかーつ！", "そういう日もある", "夢は次回に持ち越し！",
    "けむに巻かれたね♪", "回すキミの顔、真剣〜", "光る予定は未定！", "ハズレも実力のうち♪",
  ];
  function funMiss() { return pick(FUN_MISS); }
  // ごくまれに出るレア台詞（外れ時・短く・赤文字で表示）（T21/T24）
  const RARE_MISS = [
    "ねえ、たまにはボクの話も♪", "（小声）誰が作ったんだろ、これ", "スミさん、さっき笑ってたよ？",
    "今、いい匂いした。気のせい？", "案外いいコンビかもね", "キミの煙、ボク好きだよ",
    "ボク、夜はどこで寝てると思う？", "光る瞬間はね、ボクにも見えないんだ",
  ];
  function rareMiss() { return pick(RARE_MISS); }
  function bonusName(r) {
    return (r.role === "big" || r.overlap === "big") ? "ビッグボーナス"
      : r.role === "rare" ? "プレミア"
      : "レギュラーボーナス";
  }

  function afterStop(r, fast, done) {
    switch (r.role) {
      case "miss":
        // 天井が近いほどランプがほんのり「予熱」する（数値は出さない・雰囲気の楽しみ）
        widget.classList.toggle("warm", r.ceilingRemain > 0 && r.ceilingRemain <= 3);
        // 天井が近いと抽象的に示唆（数値は出さない）。たまに外れでも楽しい/レアなことを言う（T18/T19/T24）
        if (!fast) {
          if (r.ceilingRemain > 0 && r.ceilingRemain <= 5) {
            bubble(ceilingHint(r.ceilingRemain), 1500, r.ceilingRemain <= 1 ? "hot" : null);
            if (r.ceilingRemain <= 2 && fx() !== "off") sfx("puka");
          } else {
            // 回すごとに必ず何かしらコメントする（オーナー要望）。レアはまれに赤文字で
            const rnd = Math.random();
            if (rnd < 0.04) { bubble(rareMiss(), 2200, "rare"); sfx("reelWin"); }
            else bubble(funMiss(), 1400);
          }
        }
        return done();
      case "replay":
        // リプレイ成立＝もう1回転。揃った直後に再回転すると何が起きたか分からないので、
        // 「リプレイ成立！」を見せたまま、はっきり間をおいてから次の回転へ（指摘2回目・#リプレイが一瞬）
        if (fast) { setTimeout(done, 60); return; }
        widget.classList.add("flash-blue"); sfx("reelWin");
        bubble("リプレイ成立！", 0); // 0=自動で消さず保持。揃いをしっかり見せる
        setTimeout(() => widget.classList.remove("flash-blue"), 520);
        setTimeout(() => { bubble("……もう1回転！", 1000); sfx("puka"); }, 1050); // ひと呼吸おいて予告
        setTimeout(() => { done(); }, 1700); // 揃い → 間 → 再回転
        return;
      case "cherry": {
        sfx("reelWin");
        if (!r.overlap) {
          // 役名→恩恵の2段読み上げ（T18）。連結すると吹き出しが2行に折れて長いため分ける
          if (!fast) { bubble("チェリーッ！", 800); setTimeout(() => bubble(benefitLine(r), 1500), 850); }
          announce(r);
          return setTimeout(done, fast ? 60 : 700);
        }
        // チェリー重複: 小役の払い出しの後にひと呼吸おいてペカッ。
        // キューは止めない（ランプ点灯のまま進み、タップ or 次の回転前に自動精算）
        const start = () => {
          lampOn(false);
          sfx("puka");
          bubble("えっ、チェリーと一緒に光った！？", 0);
          bonusWait = { ...r, done };
          if (fast) return settleBonus(bonusWait, true);
          setTimeout(() => { if (bonusWait) settleBonus(bonusWait, false); }, 700); // 点灯を見せたら自動で揃える（タップ不要・タップは早送り）
        };
        return setTimeout(start, fast ? 0 : 600);
      }
      case "bell":
        sfx("reelWin");
        // 役名→恩恵の2段読み上げ（T18）。連結すると吹き出しが2行に折れて長いため分ける
        if (!fast) { bubble("パインベルッ！", 800); setTimeout(() => bubble(benefitLine(r), 1500), 850); }
        announce(r);
        return setTimeout(done, fast ? 60 : 800);
      case "rare": {
        // 中段チェリー/単独パッキー = BIG確定（プレミア告知）
        const start = () => {
          lampOn(true);
          sfx("puka");
          bubble("ぷぷぷぷぷ！！", 0);
          bonusWait = { ...r, done };
          if (fast) return settleBonus(bonusWait, true);
          setTimeout(() => { if (bonusWait) settleBonus(bonusWait, false); }, 800); // 点灯を見せたら自動で揃える（タップ不要・タップは早送り）
        };
        if (fast) return start();
        sfx("pugo");
        return setTimeout(start, 650);
      }
      case "reg":
      case "big": {
        // プカッ（完全告知）。光ったら自動でリールが揃う（タップは早送りできるだけ）
        const start = () => {
          lampOn(r.variant === "silent" || r.ceiling === "main");
          sfx("puka");
          bubble(r.ceiling === "main" ? "おたすけパッキー！" : "ぷぷぷっ！", 0);
          bonusWait = { ...r, done };
          if (fast) return settleBonus(bonusWait, true);
          setTimeout(() => { if (bonusWait) settleBonus(bonusWait, false); }, 700);
        };
        return setTimeout(start, r.variant === "after" || r.variant === "silent" ? (fast ? 0 : 320) : 0);
      }
      case "freeze":
        // fast時のフリーズはカットイン省略で即精算
        announce(r);
        return done();
      default:
        return done();
    }
  }

  // ---- ボーナス精算（狙え→揃い→バナー）----
  function settleBonus(b, fast) {
    bonusWait = null;
    lampOff();
    bubble("", 1);
    // 揃った瞬間の筐体ポップ（気持ちよさの一押し）
    if (!fast && widget) {
      widget.classList.remove("bonus-pop");
      void widget.offsetWidth;
      widget.classList.add("bonus-pop");
      setTimeout(() => widget.classList.remove("bonus-pop"), 700);
    }
    const finish = () => {
      announce(b);
      // ボーナスも役名→恩恵の2段でパッキーが読み上げる（T18・連結だと吹き出しが2行に折れる）。
      // BIG/プレミアは熱いので赤文字（T24）
      const big = b.role === "big" || b.role === "rare" || b.overlap === "big";
      if (!fast && fx() !== "off") {
        const cls = big ? "hot" : null;
        bubble(`${bonusName(b)}ッ！`, 950, cls);
        setTimeout(() => bubble(benefitLine(b), 1900, cls), 1000);
      }
      if (b.done) { const d = b.done; b.done = null; d(); }
    };
    if (fast || fx() === "lite") { sfx("fanfare"); return finish(); }
    const isBig = b.role === "big" || b.role === "rare" || b.overlap === "big";
    const c = ensureCutin();
    // BIG=赤7赤7赤7 / バケ(REG)=7-7-BAR（#40）。1コマずつ出るので「赤7・赤7…」のあとBARでバケ確定の見せ方になる
    const cellSyms = isBig ? [SYM_HTML.seven, SYM_HTML.seven, SYM_HTML.seven]
                           : [SYM_HTML.seven, SYM_HTML.seven, SYM_HTML.bar];
    const label = isBig ? "BIG BONUS" : "BONUS";
    c.className = "show bonus";
    // 完全告知（ランプが先に光る）なので「リーチ」ではなく、揃えにいく実況にする
    c.innerHTML =
      `<div class="rc-bonus-board">` +
      `<div class="rc-aim">${isBig ? "光ったら揃う！　赤7──" : "赤7…赤7…からの──！？"}</div>` +
      `<div class="rc-cells">` +
      cellSyms.map((s) => `<div class="rc-cell">${s}</div>`).join("") +
      `</div>` +
      `<div class="rc-bonus-label">${label}</div>` +
      `</div>`;
    const cells = [...c.querySelectorAll(".rc-cell")];
    cells.forEach((cell, i) => setTimeout(() => { cell.classList.add("on"); sfx("reelStop"); }, 380 + i * 330));
    setTimeout(() => {
      c.querySelector(".rc-bonus-board").classList.add("done");
      sfx("fanfare");
      if (b.zone) bubble("パッキータイム！", 2600);
    }, 380 + 3 * 330);
    setTimeout(() => { c.className = ""; c.innerHTML = ""; finish(); }, 2500);
  }

  // ---- ロングフリーズ（プレミア: 回転が止まる→EN:CODEグリッチ→7揃い確定）----
  function presentFreeze(r, done) {
    const strips = stripEls();
    const c = ensureCutin();
    setTimeout(() => {
      // 回転が「ガッ」と止まる → 全SE消失の間
      strips.forEach((el) => el.classList.add("frozen"));
      sfx("pugo");
      widget.classList.add("silent-spin");
      setTimeout(() => {
        c.className = "show freeze";
        c.innerHTML =
          `<div class="rc-freeze">` +
          `<div class="rc-glitch-lines"></div>` +
          `<div class="rc-freeze-text"><b>EN:CODE</b><span>運命、再コンパイル中……</span></div>` +
          `</div>`;
        sfx("glitch");
        setTimeout(() => {
          c.innerHTML =
            `<div class="rc-freeze boom">` +
            `<div class="rc-freeze-label">FREEZE BONUS</div>` +
            `<div class="rc-pakki-dance">${pakkiFace("rw-face big")}${pakkiFace("rw-face big")}${pakkiFace("rw-face big")}</div>` +
            `<div class="rc-freeze-sub">ぷぷぷぷぷーーっ！！</div>` +
            `</div>`;
          sfx("freezeBoom"); sfx("fanfare");
          strips.forEach((el) => { el.classList.remove("frozen", "spinning"); });
          setStops(STRIPS.map((s) => s.indexOf("seven")));
          widget.classList.remove("silent-spin");
          lampOn(true);
          setTimeout(() => {
            c.className = ""; c.innerHTML = "";
            lampOff();
            bubble("殿堂入り！スロノートに刻まれた", 3000);
            announce(r);
            done();
          }, 2400);
        }, 1500);
      }, 1100);
    }, 700);
  }

  // ---- 報酬バナー（報酬自体はコミット時に適用済み。ここは見せるだけ）----
  function announce(r) {
    if (typeof gainBanner !== "function") return;
    if (r.exp > 0 && !r.quiet && r.target) {
      const label = r.exp >= 5 ? "大きく上がった" : r.exp >= 3 ? "上がった" : "少し上がった";
      const names = typeof STAT_KEYS !== "undefined" ? STAT_KEYS : {};
      const badges = typeof STAT_BADGE !== "undefined" ? STAT_BADGE : {};
      gainBanner({
        kind: "stat", stat: r.target, badge: badges[r.target] || "上",
        labelTop: "PAKKI SLOT", labelMain: names[r.target] || r.target, labelSub: label,
      });
    }
  }

  // ---- 初回のみ: パッキーのアプリ説明 ----
  const INTRO_LINES = [
    "ぷぷぷっ！ C.STATION公式アプリ『MOKUMOKUパッキー』、インストール完了〜！",
    "キミが一日なにか行動するたび、ボクのスロットがかってに1回転するよ。回すんじゃない——回っちゃうんだ。",
    "ルールはシンプル！ ボクの顔が光ったら——大当たりっ！ それだけ！",
    "外れても大丈夫。回したぶんだけ、その日がんばったことがちゃーんと積もるしくみ。それじゃ、今日もぷかぷかいこう！",
  ];
  function showIntro(onClose) {
    let box = document.querySelector("#reel-intro");
    if (!box) {
      box = document.createElement("div");
      box.id = "reel-intro";
      document.querySelector("#game").appendChild(box);
    }
    let i = 0;
    const render = () => {
      box.innerHTML =
        `<div class="ri-panel">` +
        `<div class="ri-head">${pakkiFace("rw-face big")}<span class="ri-app">MOKUMOKUパッキー</span></div>` +
        `<p class="ri-text">${INTRO_LINES[i]}</p>` +
        `<span class="ri-next">▼ タップ</span>` +
        `</div>`;
    };
    render();
    box.className = "show";
    sfx("open");
    box.onclick = () => {
      i += 1;
      if (i === 2) sfx("puka"); // 「光ったら大当たり」のデモ
      if (i < INTRO_LINES.length) { render(); sfx("click"); return; }
      box.className = ""; box.innerHTML = ""; box.onclick = null;
      state.reel.introDone = true;
      if (typeof save === "function") save();
      if (onClose) onClose();
    };
  }

  // デバッグ/調整用フック（テスト・コンソールから使う）
  if (typeof window !== "undefined") {
    window.__reelDebug = {
      core,
      simulate,
      state: () => (typeof state !== "undefined" && state ? state.reel : null),
      // 演出確認用: 役を偽造して演出だけ再生（カウンタ・報酬は動かさない）
      force(role) {
        const rng = mulberry32((Date.now() & 0xffff) >>> 0);
        const r = {
          n: 0, role, overlap: null, premium: role === "rare" || role === "freeze",
          stops: stopsFor(role, rng),
          variant: PEKA.includes(role) && role !== "freeze" ? (role === "rare" ? "premium" : "after") : "none",
          exp: 0, quiet: true, zone: false, gakkun: false, ceiling: "", target: null,
        };
        ensureWidget();
        presentSpin(r, false, () => {});
      },
    };
  }

  return { core, newReelState, noteStat, onAction, onMapShown, isResolving, waitForIdle };
})();

if (typeof window !== "undefined") window.REEL = REEL;
if (typeof module !== "undefined" && module.exports) module.exports = REEL;
