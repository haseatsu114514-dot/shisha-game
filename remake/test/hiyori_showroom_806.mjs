// Issue #806: ひよりはDr.fookahショールーム（spot.kind === "shop"）では会わない。
// ショールームでは初対面・再会・相席の全イベントが発生しないことを検証。
// 実行: node --experimental-vm-modules remake/test/hiyori_showroom_806.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const hiyori = JSON.parse(await fs.readFile(new URL("data/dialogue/hiyori.json", root), "utf8"));
const DB = { hiyori, dialogues: Object.fromEntries(hiyori.dialogues.map(d => [d.dialogue_id, d])) };
const state = {}, played = [];
let saves = 0;
const context = vm.createContext({ Math, Set, Promise, console });

// spotsList にショールーム { id: "shop", kind: "shop" } を含め、候補選定時に渡す
const spotsList = [
  { id: "tonari", kind: "tonari" },
  { id: "naru", kind: "rival", closedOn: 3 },
  { id: "adam", kind: "rival", closedOn: 5 },
  { id: "minto", kind: "rival", closedOn: 6 },
  { id: "shop", kind: "shop", label: "Dr.fookah" },
  { id: "cafe", kind: "spot" },
  { id: "kannon", kind: "spot" },
  { id: "choizap", kind: "spot" },
  { id: "c_station", kind: "spot" },
  { id: "fortune", kind: "fortune" },
  { id: "rest", kind: "rest" },
  { id: "samechan", kind: "samechan" },
];

const mocks = {
  "core/data.js": { DB },
  "core/state.js": { state, save: () => saves++ },
  "core/stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], setStoryAffinityCap() {}, releaseStoryAffinity: () => 0, affinityGateWaiting: () => false,
    gainAffinity: (id, n) => { state.affinity[id] = (state.affinity[id] || 0) + n; },
    affinityLevel: () => 3,
    ensureAffinityLevel: (id, level) => { const target = [0, 9, 20, 33, 48, 66][level]; if (!id || !Number.isInteger(level) || !(target > 0) || state.lovers.includes(id)) return 0; const before = state.affinity[id] || 0; state.affinity[id] = Math.max(before, target); return state.affinity[id] - before; },
    releaseHiyoriAffinity: () => {},
    addMoney() {},
    addStamina() {},
  },
  "vn/engine.js": { play: async id => { played.push(id); return { cancelled: false }; }, isPlaying: () => false },
  "daily/bonds.js": {
    afterStory: async () => {},
    hiyoriQuestionReady: () => false,
    playHiyoriQuestion: async () => false,
    finaleAtVisit: () => false,
    playFinale: async () => false,
  },
  "daily/spots.js": {
    allSpots: () => spotsList,
    isClosed: spot => spot.closedOn === state.day % 7,
    isUnlocked: spot => !spot.locked,
    shortNormalVisit: () => false,
  },
  "daily/spot-hours.js": { rinUnavailable: () => state.slot === 1 ? "" : "夜から" },
  "daily/hiyori-axe.js": { hiyoriAxeAffordable: () => false, playHiyoriAxeSequence: async () => false },
  "daily/trpg.js": { maybeRecruitTrpgMember: async () => false },
};

const modules = new Map();
async function load(name) {
  if (modules.has(name)) return modules.get(name);
  const mod = mocks[name]
    ? new vm.SyntheticModule(Object.keys(mocks[name]), function () {
      for (const [key, value] of Object.entries(mocks[name])) this.setExport(key, value);
    }, { context, identifier: name })
    : new vm.SourceTextModule(await fs.readFile(new URL(`remake/js/${name}`, root), "utf8"), { context, identifier: name });
  modules.set(name, mod);
  await mod.link(specifier => load(new URL(specifier, `https://test/${name}`).pathname.slice(1)));
  return mod;
}

const mod = await load("daily/hiyori.js");
await mod.evaluate();
const { hiyoriShopEligible, hiyoriShopLocation, hiyoriShopEncounterDue, visitHiyoriAtShop } = mod.namespace;

const utilMod = await load("core/util.js");
await utilMod.evaluate();
const { seeded } = utilMod.namespace;

// encounterRoll と同一のハッシュ・PRNG計算
function calcRoll(spotId, seed, slot, day = 1, chapter = 1) {
  const key = `hiyori:${chapter}:${day}:${slot}:${spotId}`;
  let salt = 2166136261;
  for (const char of key) salt = Math.imul(salt ^ char.charCodeAt(0), 16777619) >>> 0;
  return seeded(seed, salt);
}

// hiyori_frequency.mjs と同一の前提（met: { hiyori: true } により hiyoriFirstMeetingReady を成立させる）
function reset(seed = 0, flags = { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true,
  _hiyori_message_delivered: true, _hiyori_cracks_done: true }) {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, {
    seed,
    chapter: 1,
    day: 1,
    slot: 1,
    flags: { ...flags },
    contacts: [],
    met: { hiyori: true },
    story: {},
    affinity: {},
    lovers: [],
    finales: {},
    loveLevel: {},
    visitedDay: {},
    pendingInvite: null,
  });
  played.length = 0;
  saves = 0;
}

console.log("1. hiyoriShopEligible: ショールーム除外と他店の適格性");
{
  const showroom = spotsList.find(s => s.id === "shop");
  assert.equal(hiyoriShopEligible(showroom), false, "ショールーム (kind: shop) は対象外であること");
  assert.equal(hiyoriShopEligible({ id: "custom_shop", kind: "shop" }), false, "kind: shop はすべて対象外");

  // 不適格な施設
  for (const id of ["tonari", "cafe", "kannon", "choizap", "fortune", "rest"]) {
    const s = spotsList.find(sp => sp.id === id);
    assert.equal(hiyoriShopEligible(s), false, `${id} は対象外であること`);
  }

  // 適格な店舗
  for (const id of ["naru", "adam", "minto"]) {
    const s = spotsList.find(sp => sp.id === id);
    assert.equal(hiyoriShopEligible(s), true, `ライバル店 ${id} は対象であること`);
  }
  assert.equal(hiyoriShopEligible(spotsList.find(s => s.id === "samechan")), true, "samechan は対象であること");
  assert.equal(hiyoriShopEligible(spotsList.find(s => s.id === "c_station")), true, "c_station は対象であること");
}

console.log("2. 初対面前: 旧コードならshopが選ばれるseedが存在し、新コードでは昼夜ともnon-nullでshopが選ばれないこと");
{
  const showroom = spotsList.find(s => s.id === "shop");
  assert(showroom, "spotsList に shop が存在すること");

  for (const slot of [0, 1]) {
    let nonNullCount = 0;
    let oldWouldPickShop = 0;
    const chosenLocations = new Set();

    for (let seed = 0; seed < 500; seed++) {
      reset(seed, {});
      state.slot = slot;

      // 1. 新コードの実際の動作を検証: 必ず non-null で他店舗が選ばれ、shop は選ばれない
      const loc = hiyoriShopLocation();
      assert(loc !== null, `初対面前 seed ${seed}, slot ${slot} では有効な店が必ず選ばれること`);
      nonNullCount++;
      assert.notEqual(loc, "shop", `seed ${seed}, slot ${slot} でショールームが選ばれてはならない`);
      assert(["naru", "adam", "minto", "c_station", "samechan"].includes(loc));
      chosenLocations.add(loc);
      assert.equal(hiyoriShopEncounterDue(showroom), false);

      // 2. 旧コード条件（shop が候補に含まれていた場合）で shop が最小 roll になるか検証
      // 旧候補リスト: ["naru", "adam", "minto", "c_station", "samechan", "shop"]
      const oldCandIds = ["naru", "adam", "minto", "c_station", "samechan", "shop"];
      const oldCand = oldCandIds.map(id => ({ id, roll: calcRoll(id, seed, slot, 1, 1) }))
        .sort((a, b) => a.roll - b.roll || a.id.localeCompare(b.id));
      if (oldCand[0]?.id === "shop") {
        oldWouldPickShop++;
      }
    }

    // 各ループで non-null の回数 > 0 をアサート
    assert(nonNullCount > 0, `slot ${slot} で non-null 選出回数が 0 より大きいこと (実際: ${nonNullCount})`);
    assert.equal(nonNullCount, 500, `初対面前は全 seed で選出されること`);
    assert(!chosenLocations.has("shop"), `slot ${slot} で chosenLocations に shop が含まれないこと`);
    assert(chosenLocations.size > 1, `slot ${slot} で複数の店舗に分散して選出されていること`);

    // 旧コードなら shop が選ばれる seed が確実に存在したことを検証（空振り防止）
    assert(oldWouldPickShop > 0, `旧コード（shopを含む候補リスト）であれば slot ${slot} で shop が選ばれる seed が存在すること (実際: ${oldWouldPickShop} seeds)`);
  }

  // ショールームへ無理やり訪問しても false で終了し、初対面イベントは発火しない
  reset(42, {});
  state.slot = 1;
  const res = await visitHiyoriAtShop(showroom, { scheduledSpot: "shop" });
  assert.equal(res, false, "ショールームへの訪問は拒絶されること");
  assert.equal(state.flags._hiyori_meeting_done, undefined);
  assert.equal(state.flags._hiyori_meeting_shop, undefined);
  assert.equal(state.contacts.includes("hiyori"), false);
  assert.equal(played.length, 0);
}

console.log("3. 他店での初対面と進行（正常動作維持の確認）");
{
  reset(131, {});
  state.slot = 1;
  const target = hiyoriShopLocation();
  assert(target && ["naru", "adam", "minto", "c_station", "samechan"].includes(target), "初対面対象が有効な他店舗であること");
  const spot = spotsList.find(s => s.id === target);
  const ok = await visitHiyoriAtShop(spot);
  assert.equal(ok, true, "他店舗での初対面訪問が成功すること");
  assert.equal(state.flags._hiyori_meeting_done, true);
  assert.equal(state.flags._hiyori_meeting_shop, target);
  assert.notEqual(state.flags._hiyori_meeting_shop, "shop");
  // モック環境では VN エンジンによる _lime_contact_hiyori 付与を実行しないため、
  // 他店での連絡先追加（hiyoriHasContact）の検証は本番VNが動くブラウザテスト hiyori_encounters.mjs に任せ、
  // 本テストでは「ショールームでは連絡先が増えないこと」（セクション2）を担保する。
  assert.equal(played.includes("hiyori_meeting"), true);
}

console.log("4. 初対面後・再会（relay / cracks）: ショールームは選ばれず他店が選ばれる（non-null > 0）");
{
  const showroom = spotsList.find(s => s.id === "shop");
  let relayNonNullCount = 0;
  const relayLocations = new Set();

  for (let seed = 0; seed < 200; seed++) {
    for (let day = 1; day <= 7; day++) {
      for (const slot of [0, 1]) {
        reset(seed, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true });
        state.day = day;
        state.slot = slot;
        const loc = hiyoriShopLocation();
        if (loc) {
          relayNonNullCount++;
          assert.notEqual(loc, "shop", "再会候補にショールームが含まれてはならない");
          assert(["naru", "adam", "minto", "c_station", "samechan"].includes(loc));
          relayLocations.add(loc);
        }
      }
    }
  }
  assert(relayNonNullCount > 0, `初対面後(relay)の non-null 選出回数が 0 より大きいこと (実際: ${relayNonNullCount})`);
  assert(!relayLocations.has("shop"), "relayLocations に shop が含まれないこと");

  // cracks 段階（伝言読了済み、好感度あり）
  let cracksNonNullCount = 0;
  const cracksLocations = new Set();
  for (let seed = 0; seed < 200; seed++) {
    for (let day = 1; day <= 7; day++) {
      for (const slot of [0, 1]) {
        reset(seed, {
          _hiyori_meeting_done: true,
          _hiyori_sumi_message_done: true,
          _hiyori_message_delivered: true,
        });
        state.day = day;
        state.slot = slot;
        state.affinity.hiyori = 10;
        const loc = hiyoriShopLocation();
        if (loc) {
          cracksNonNullCount++;
          assert.notEqual(loc, "shop", "cracks 候補にショールームが含まれてはならない");
          assert(["naru", "adam", "minto", "c_station", "samechan"].includes(loc));
          cracksLocations.add(loc);
        }
      }
    }
  }
  assert(cracksNonNullCount > 0, `初対面後(cracks)の non-null 選出回数が 0 より大きいこと (実際: ${cracksNonNullCount})`);
  assert(!cracksLocations.has("shop"), "cracksLocations に shop が含まれないこと");

  // ショールーム直接訪問拒絶
  reset(131, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true });
  assert.equal(await visitHiyoriAtShop(showroom, { scheduledSpot: "shop" }), false);
}

console.log("5. 相席（repeat）: ショールームは選ばれず他店が選ばれる（non-null > 0）");
{
  const showroom = spotsList.find(s => s.id === "shop");
  let repeatNonNullCount = 0;
  const repeatLocations = new Set();

  for (let seed = 0; seed < 200; seed++) {
    for (let day = 1; day <= 7; day++) {
      for (const slot of [0, 1]) {
        reset(seed, {
          _hiyori_meeting_done: true,
          _hiyori_sumi_message_done: true,
          _hiyori_message_delivered: true,
          _hiyori_cracks_done: true,
          _hiyori_repeat_count: 0,
        });
        state.day = day;
        state.slot = slot;
        const loc = hiyoriShopLocation();
        if (loc) {
          repeatNonNullCount++;
          assert.notEqual(loc, "shop", "相席候補にショールームが含まれてはならない");
          assert(["naru", "adam", "minto", "c_station", "samechan"].includes(loc));
          repeatLocations.add(loc);
        }
      }
    }
  }
  assert(repeatNonNullCount > 0, `相席(repeat)の non-null 選出回数が 0 より大きいこと (実際: ${repeatNonNullCount})`);
  assert(!repeatLocations.has("shop"), "repeatLocations に shop が含まれないこと");

  // ショールーム直接訪問拒絶
  reset(131, {
    _hiyori_meeting_done: true,
    _hiyori_sumi_message_done: true,
    _hiyori_message_delivered: true,
    _hiyori_cracks_done: true,
    _hiyori_repeat_count: 1,
  });
  assert.equal(await visitHiyoriAtShop(showroom, { scheduledSpot: "shop" }), false);
}

console.log("6. 旧セーブ互換: _hiyori_meeting_shop がショールームIDでも壊れないこと（non-null > 0）");
{
  const showroom = spotsList.find(s => s.id === "shop");
  let oldSaveNonNullCount = 0;
  const oldSaveLocations = new Set();

  for (let seed = 0; seed < 200; seed++) {
    for (let day = 1; day <= 7; day++) {
      for (const slot of [0, 1]) {
        reset(seed, {
          _hiyori_meeting_done: true,
          _hiyori_meeting_shop: "shop",
          _hiyori_sumi_message_done: true,
        });
        state.day = day;
        state.slot = slot;
        const loc = hiyoriShopLocation();
        if (loc) {
          oldSaveNonNullCount++;
          assert.notEqual(loc, "shop", "旧セーブでもショールームは再会候補にならない");
          assert(["naru", "adam", "minto", "c_station", "samechan"].includes(loc));
          oldSaveLocations.add(loc);
        }
      }
    }
  }
  assert(oldSaveNonNullCount > 0, `旧セーブでの non-null 選出回数が 0 より大きいこと (実際: ${oldSaveNonNullCount})`);
  assert(!oldSaveLocations.has("shop"), "oldSaveLocations に shop が含まれないこと");

  // 他店で再会イベントが正常に消化できること
  reset(131, {
    _hiyori_meeting_done: true,
    _hiyori_meeting_shop: "shop",
    _hiyori_sumi_message_done: true,
  });
  state.slot = 1;
  while (!hiyoriShopLocation() && state.seed < 1000) state.seed++;
  const eligibleLoc = hiyoriShopLocation();
  assert(eligibleLoc && eligibleLoc !== "shop", "有効な他店舗が選ばれていること");
  const spot = spotsList.find(s => s.id === eligibleLoc);
  const success = await visitHiyoriAtShop(spot);
  assert.equal(success, true, "旧セーブから他店での再会が成功すること");
  assert.equal(state.flags._hiyori_meeting_shop, "shop", "旧初対面店舗記録は破壊されない");
  assert.equal(state.flags._hiyori_message_delivered, true);
  assert.equal(await visitHiyoriAtShop(showroom, { scheduledSpot: "shop" }), false);
}

console.log("7. SAVE / LOAD 後の不変性と整合性");
{
  reset(131, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true });
  state.slot = 1;
  while (!hiyoriShopLocation() && state.seed < 1000) state.seed++;
  const beforeLoc = hiyoriShopLocation();
  assert(beforeLoc && beforeLoc !== "shop", "ロード前で有効な他店舗が選ばれていること");

  // シリアライズ＆デシリアライズ
  const serialized = JSON.stringify(state);
  const restored = JSON.parse(serialized);

  // 復元して検証
  reset(restored.seed, restored.flags);
  state.slot = restored.slot;
  state.day = restored.day;
  const afterLoc = hiyoriShopLocation();
  assert.equal(beforeLoc, afterLoc, "SAVE/LOAD 前後で選定先が変わらないこと");
  assert.notEqual(afterLoc, "shop", "SAVE/LOAD 後もショールームは選ばれないこと");
}

console.log("\nALL CHECKS PASSED (Issue #806 Hiyori Showroom Exclusion)");
