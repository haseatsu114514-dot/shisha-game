// node remake/test/ngplus_carry.mjs
// NG+（Issue #1228）: 旧セーブの移行、state/flag の引き継ぎ分類の網羅、引き継ぎパッケージの抽出。
import assert from "node:assert/strict";
import fs from "node:fs";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
globalThis.sessionStorage ??= globalThis.localStorage;

const core = await import("../js/core/state.js");
const carry = await import("../js/core/carry.js");
const { MAX_MONEY } = await import("../js/core/rules.js");
const { SCHEMA, SAVE_KEY, SAVE_SLOTS, newState, load, save, loadFromSlot } = core;
const { STATE_KEY_RULES, FLAG_EXACT_RULES, FLAG_FAMILY_RULES, GIFT_EQUIPMENT_IDS, KEEPSAKE_ORIGINS,
  buildCarryPackage } = carry;

assert.equal(carry.classifyFlag("_shift_mix_citrus"), "progression");
assert.equal(carry.flagVerdict("_shift_mix_citrus"), "reset");
{
  const s = core.newState();
  s.flags._shift_mix_citrus = 0;
  s.flags._shift_mix_double_apple = 1;
  const pkg = buildCarryPackage(s);
  assert.equal("_shift_mix_citrus" in pkg.flags, false);
  assert.equal("_shift_mix_double_apple" in pkg.flags, false);
}

const root = new URL("../../", import.meta.url);
const copy = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- A. SCHEMA 24 と後方互換
{
  assert.equal(SCHEMA, 24);
  const fresh = newState();
  assert.equal(fresh.cycle, 1);
  assert.equal(typeof fresh.cycleId, "string");
  assert.ok(fresh.cycleId.length > 0);
  assert.deepEqual(fresh.cycleStartStats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
  assert.equal(fresh.carryOptions, null);

  const legacy = () => {
    const s = copy(newState());
    s.schema = 21;
    for (const k of ["cycle", "cycleId", "cycleStartStats", "carryOptions"]) delete s[k];
    s.money = 12345;
    s.stats.technique = 42;
    s.flags = { _ch1_mid: true };
    s.affinity = { minto: 7 };
    s.lovers = ["minto"];
    s.chapter = 2;
    s.day = 5;
    s.tokyoVisits = {
      version: 1,
      plans: [{
        id: "minto-33", characterId: "minto", status: "staying",
        arrivalDay: 33, returnDay: 35,
        meetup: { id: "d33-noon", day: 33, slot: 0 },
        date: { id: "d34-night", day: 34, slot: 1 },
        met: true, dateDone: false,
      }],
      offers: {}, closedSlots: ["d33-noon"], chats: { minto: "3-33" },
    };
    s.flavorMastery = { fruit: 3 };
    s.flavorLessons = ["minto_fruit"];
    s.flavorStock = { double_apple: 37 };
    s.staffPractice = { day: "2-5", used: { double_apple: 4 } };
    return s;
  };
  const checkMigrated = (s) => {
    assert.equal(s.schema, 24);
    assert.equal(s.cycle, 1);
    assert.ok(typeof s.cycleId === "string" && s.cycleId.length > 0);
    assert.deepEqual(s.cycleStartStats, { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 });
    assert.equal(s.carryOptions, null);
    assert.equal(s.money, 12345);
    assert.equal(s.stats.technique, 42);
    assert.equal(s.flags._ch1_mid, true);
    assert.deepEqual(s.affinity, { minto: 7 });
    assert.deepEqual(s.lovers, ["minto"]);
    assert.equal(s.chapter, 2);
    assert.equal(s.day, 5);
    const original = legacy();
    for (const k of ["tokyoVisits", "flavorMastery", "flavorLessons", "flavorStock", "staffPractice"]) {
      assert.deepEqual(s[k], original[k], `schema 21 の ${k} を保持する`);
    }
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(legacy()));
  const loaded = load();
  checkMigrated(loaded);

  // 冪等性: 保存して読み直しても周回IDは変わらない
  const id = loaded.cycleId;
  save();
  assert.equal(load().cycleId, id);

  // 手動枠
  const slotKey = SAVE_SLOTS[1].key;
  localStorage.setItem(slotKey, JSON.stringify(legacy()));
  checkMigrated(loadFromSlot(slotKey));

  // スキーマ22の周回データは維持し、第4回既読なら味の話の未取得分だけ補う。
  const prior = copy(newState());
  prior.schema = 22;
  prior.cycle = 2;
  prior.cycleId = "kept-cycle-2";
  prior.cycleStartStats.technique = 19;
  prior.story = { naru: 5 };
  prior.flavorLessons = ["ch1_naru_first"];
  prior.flavorMastery = { vanilla: 12 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(prior));
  const upgraded = load();
  assert.equal(upgraded.schema, 24);
  assert.equal(upgraded.cycle, 2);
  assert.equal(upgraded.cycleId, "kept-cycle-2");
  assert.equal(upgraded.cycleStartStats.technique, 19);
  assert.equal(upgraded.flavorMastery.vanilla, 24);
  assert(upgraded.flavorLessons.includes("ch1_naru_fourth"));
  save();
  const repeated = load();
  assert.equal(repeated.flavorMastery.vanilla, 24);
  assert.equal(repeated.cycleId, "kept-cycle-2");
}

// ---------------------------------------------------------------- B. state キー分類の網羅
{
  const keys = new Set([...Object.keys(newState()), "savedAt"]);
  const ruleKeys = new Set(Object.keys(STATE_KEY_RULES));
  for (const k of keys) assert.ok(ruleKeys.has(k), `STATE_KEY_RULES に無いキー: ${k}`);
  for (const k of ruleKeys) assert.ok(keys.has(k), `STATE_KEY_RULES の余分なキー: ${k}`);
  for (const [k, r] of Object.entries(STATE_KEY_RULES)) {
    assert.ok(["carry", "reset", "conditional"].includes(r.verdict), `verdict が不正: ${k}`);
  }
}

// ---------------------------------------------------------------- C. flags 分類の網羅（ソース走査）
{
  const walk = (dir, ext, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
      if (e.isDirectory()) walk(p, ext, out);
      else if (e.name.endsWith(ext)) out.push(p);
    }
    return out;
  };
  const jsFiles = walk(new URL("remake/js/", root), ".js");
  const jsonFiles = walk(new URL("data/", root), ".json");
  const exact = new Set();
  const families = new Set();
  const addExact = (name) => { const n = name.replace(/^!/, ""); if (n) exact.add(n); };
  const addStrings = (text) => { for (const m of text.matchAll(/"([^"]+)"/g)) addExact(m[1]); };
  const SET_METHODS = new Set(["add", "has", "delete", "clear", "get", "set", "keys", "values", "entries",
    "forEach", "size", "length"]);

  // テンプレートリテラル走査: `${}` の入れ子・内側のバッククォート・文字列・コメントに耐える
  const scanTemplates = (src, found) => {
    const skipString = (i, q) => { for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++; return i; };
    const template = (i) => { // src[i] === "`"。閉じバッククォートの位置を返す
      let text = "";
      for (i++; i < src.length && src[i] !== "`"; i++) {
        if (src[i] === "\\") { text += src[i + 1] ?? ""; i++; continue; }
        if (src[i] === "$" && src[i + 1] === "{") { i = expr(i + 2); text += "*"; continue; }
        text += src[i];
      }
      found.push(text);
      return i;
    };
    const expr = (i) => { // `${` の直後から、対応する `}` の位置を返す
      for (let depth = 1; i < src.length; i++) {
        const c = src[i];
        if (c === "{") depth++;
        else if (c === "}" && --depth === 0) return i;
        else if (c === "`") i = template(i);
        else if (c === '"' || c === "'") i = skipString(i, c);
      }
      return i;
    };
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "`") i = template(i);
      else if (c === '"' || c === "'") i = skipString(i, c);
      else if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; }
      else if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); if (i < 0) break; i++; }
    }
  };

  for (const f of jsFiles) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:setFlag|flag)\(\s*"([^"]+)"/g)) addExact(m[1]);
    for (const m of src.matchAll(/flags\[\s*"([^"]+)"\s*\]/g)) addExact(m[1]);
    for (const m of src.matchAll(/\bflags\.([A-Za-z_$][\w$]*)/g)) if (!SET_METHODS.has(m[1])) addExact(m[1]);
    for (const m of src.matchAll(/[A-Za-z_$]*[Ff]lag\s*:\s*"([^"]+)"/g)) addExact(m[1]);
    for (const m of src.matchAll(/(?:prerequisites|doneKeys)\s*:\s*\[([^\]]*)\]/g)) addStrings(m[1]);
    const templates = [];
    scanTemplates(src, templates);
    for (const t of templates) {
      const first = t.indexOf("*");
      if (t.startsWith("_") && first >= 4 && !t.startsWith("_tokyo_*_*")) families.add(t);
    }
  }
  for (const f of jsonFiles) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/"[A-Za-z_]*[Ff]lag[A-Za-z_]*"\s*:\s*"([^"]+)"/g)) addExact(m[1]);
    for (const m of src.matchAll(/"set_flags"\s*:\s*\[([^\]]*)\]/g)) addStrings(m[1]);
    for (const m of src.matchAll(/"(?:prerequisites|doneKeys)"\s*:\s*\[([^\]]*)\]/g)) addStrings(m[1]);
  }

  const exactNames = FLAG_EXACT_RULES.map(([n]) => n);
  assert.equal(new Set(exactNames).size, exactNames.length, "FLAG_EXACT_RULES に重複名がある");
  const exactSet = new Set(exactNames);
  const missing = [...exact].filter((n) => !exactSet.has(n)).sort();
  assert.deepEqual(missing, [], `FLAG_EXACT_RULES に無い flag 参照: ${missing.join(", ")}`);

  const patterns = FLAG_FAMILY_RULES.map(([p]) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`));
  const unmatched = [...families].filter((t) => !patterns.some((re) => re.test(t))).sort();
  assert.deepEqual(unmatched, [], `FLAG_FAMILY_RULES に一致しない動的 flag: ${unmatched.join(", ")}`);
  assert.ok(exact.size > 100, "flag 走査が働いていない");
}

// ---------------------------------------------------------------- D. 引き継ぎパッケージの抽出
{
  const s = newState();
  s.stats.technique = 55;
  s.money = 2_000_000;
  // 装備枠は残った所持にあるものだけ残るので、hms の lotos_hagal も所持に含める
  s.owned = ["hagal_80beat", "lotos_hagal", "suyaki_minto"];
  s.equip = { bowl: "suyaki_minto", hms: "lotos_hagal" };
  s.keepsakes = ["ryuji_purikura", "minto_first_cheki"];
  s.trpg = { ...(s.trpg ?? {}), stock: ["x"], club: { founded: { chapter: 2, day: 3 }, members: { rin: { chapter: 2, day: 4 } } } };
  s.flags = { _gym_member: true, _motion_seen_intro: true, _flavor_grape: true, _ch1_cleared: true,
    _brand_new_unclassified: true, _kuji_seen: false };
  s.affinity = { minto: 9 };
  s.lovers = ["minto"];
  s.loveLevel = { minto: 3 };
  s._brand_new_unclassified = { value: 123 };
  const before = copy(s);

  const pkg = buildCarryPackage(s);
  const allowed = ["stats", "statXp", "money", "flavors", "flavorStock", "flavorMastery", "flavorLessons",
    "recipes", "goods", "kuji", "reel", "best", "owned", "equip", "keepsakes", "trpg", "flags"];
  assert.deepEqual(Object.keys(pkg).sort(), [...allowed].sort());
  assert.ok(!("_brand_new_unclassified" in pkg), "未知のトップレベルキーは引き継がない");

  const forbidden = new Set(["affinity", "affinityCarry", "story", "lovers", "loveLevel", "lovePts", "loveCarry",
    "loverSince", "lastDate", "loverEventsSeen", "guilt", "romance", "romanceChoices", "finales", "friendHangouts",
    "met", "contacts", "inbox", "limeRead", "pendingInvite", "notes", "relationshipMemories", "visits", "visitedDay"]);
  const seen = new Set();
  const collect = (v) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { seen.add(k); collect(x); }
  };
  collect(pkg);
  const leaked = [...seen].filter((k) => forbidden.has(k));
  assert.deepEqual(leaked, [], `禁止キーの混入: ${leaked.join(", ")}`);

  assert.equal(pkg.money, MAX_MONEY);
  assert.equal(pkg.stats.technique, 55);
  assert.ok(!pkg.owned.includes("suyaki_minto"));
  assert.ok(pkg.owned.includes("hagal_80beat"));
  assert.ok(!("bowl" in pkg.equip));
  assert.equal(pkg.equip.hms, "lotos_hagal");
  assert.deepEqual(pkg.keepsakes, []);
  assert.ok(!("club" in pkg.trpg));
  assert.deepEqual(pkg.trpg.stock, ["x"]);
  assert.deepEqual(Object.keys(pkg.flags).sort(), ["_flavor_grape", "_gym_member", "_motion_seen_intro"]);

  // 深いコピー
  pkg.stats.technique = 1;
  pkg.flags._gym_member = false;
  assert.equal(s.stats.technique, 55);
  assert.deepEqual(s, before);
}

// ---------------------------------------------------------------- E. データとの照合
{
  const equipment = JSON.parse(fs.readFileSync(new URL("data/equipment.json", root), "utf8")).equipment;
  const giftIds = equipment.filter((e) => e.gift).map((e) => e.id).sort();
  assert.deepEqual([...GIFT_EQUIPMENT_IDS].sort(), giftIds);

  const src = fs.readFileSync(new URL("remake/js/core/keepsakes.js", root), "utf8");
  const ids = [...src.matchAll(/([a-z0-9_]+): \{ name:/g)].map((m) => m[1]).sort();
  assert.ok(ids.length > 0);
  assert.deepEqual(Object.keys(KEEPSAKE_ORIGINS).sort(), ids);
}

// ---------------------------------------------------------------- F. 未来スキーマの拒否（#1254）
{
  const future = copy(newState());
  future.schema = SCHEMA + 1;
  future.money = 12345;
  const futureRaw = JSON.stringify(future);
  const slotRaw = JSON.stringify({ ...future, money: 23456 });
  const slotKey = SAVE_SLOTS[1].key;
  localStorage.setItem(SAVE_KEY, futureRaw);
  localStorage.setItem(slotKey, slotRaw);
  const stateBefore = core.state;
  const before = copy(core.state);
  // オートセーブ: 拒否後も両方の原本と現在の state を保持する
  assert.equal(load(), null, "未来スキーマのオートセーブは拒否する");
  assert.equal(localStorage.getItem(SAVE_KEY), futureRaw, "拒否した原本は書き換えない");
  assert.equal(localStorage.getItem(slotKey), slotRaw, "オートセーブの拒否で手動枠を書き換えない");
  assert.equal(core.state, stateBefore, "拒否で state を差し替えない");
  assert.deepEqual(core.state, before, "拒否で state の内容を変えない");
  // 手動枠: 拒否し、オートセーブへ進ませない
  assert.equal(loadFromSlot(slotKey), null, "未来スキーマの手動枠は拒否する");
  assert.equal(localStorage.getItem(SAVE_KEY), futureRaw, "手動枠の拒否でオートセーブを上書きしない");
  assert.equal(localStorage.getItem(slotKey), slotRaw, "手動枠の原本も書き換えない");
  assert.equal(core.state, stateBefore, "手動枠の拒否で state を差し替えない");
  assert.deepEqual(core.state, before, "手動枠の拒否で state の内容を変えない");
}

console.log("ngplus carry: PASS (schema 24 migration, state/flag classification coverage, package extraction, data cross-check, future schema refusal)");
