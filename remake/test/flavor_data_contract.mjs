// フレーバーデータのデータ契約テスト（#1265）。
// 正規化後の DB ではなく、正規化前の生データ data/flavors.json を直接検証する。
// 目的は「コードが名前で読む前提」がデータ側で silently 崩れるのを CI で止めること。
// node remake/test/flavor_data_contract.mjs
//
// 契約の根拠:
// - 特性値（stats）は flavor-profile.js が 0..10 に clamp して読む前提（js/craft/flavor-profile.js:12-32）。
//   steps.js の味傾向集計も stats の数値をそのまま重み付けする（js/craft/steps.js:189）。
// - カテゴリの既知集合は shop.js の CAT_LABEL（js/daily/shop.js:35）。
// - ID 参照の実在は flavorById の引当（js/core/data.js:121）が前提。
// - メーカー実在の検証は data_loading.mjs 側の担当なので、ここでは重複実装しない。
// - recipes.json の flavors / golden はフレーバー ID ではなく系統キー
//   （familyKeyOf: js/craft/steps.js:129）なので、ID 参照としては検証しない。
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;

const errors = [];
const check = (cond, message) => { if (!cond) errors.push(message); };
const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isString = (v) => typeof v === "string";

// コードが名前で読む必須フィールド（全フレーバーに存在することが前提）。
const REQUIRED_FIELDS = [
  "id", "name", "short_name", "category", "price", "description",
  "heat_tolerance", "smoke_weight", "steam_bias", "leaf", "stats", "maker",
];
// flavor-profile.js / steps.js が名前で読む特性値キー。
const STAT_KEYS = [
  "heat_resistance", "refreshing", "sweet_natural", "sweet_confection", "cooling",
  "assertiveness", "acquired_taste", "smoke_body", "sourness", "spiciness", "floral", "nicotine",
];
// shop.js CAT_LABEL のキー集合。
const CATEGORIES = new Set(["cooling", "sweet", "fruit", "spice", "floral"]);
// 存在すれば有限な number でなければならない数値フィールド（値域の根拠がないものは型だけを見る）。
const NUMERIC_FIELDS = ["heat_tolerance", "smoke_weight", "steam_bias", "chapter_min", "mix_life"];

check(Array.isArray(flavors) && flavors.length > 0, "flavors.json: flavors が空または配列でない");

const ids = new Set();
for (const f of flavors) {
  const label = isString(f?.id) && f.id ? `flavor ${f.id}` : `flavor (id不明: ${JSON.stringify(f?.id)})`;
  check(f && typeof f === "object" && !Array.isArray(f), `${label}: オブジェクトでない`);
  if (!f || typeof f !== "object") continue;
  for (const key of REQUIRED_FIELDS) check(f[key] !== undefined, `${label}: 必須フィールド ${key} がない`);
  check(isString(f.id) && f.id.length > 0, `${label}: id が空または文字列でない`);
  if (isString(f.id)) {
    check(!ids.has(f.id), `${label}: id が重複している`);
    ids.add(f.id);
  }
  for (const key of ["name", "short_name", "description", "maker", "leaf"]) {
    check(isString(f[key]), `${label}: ${key} が文字列でない`);
  }
  check(isString(f.name) && f.name.length > 0, `${label}: name が空`);
  check(CATEGORIES.has(f.category), `${label}: category が未知値 ${JSON.stringify(f.category)}`);
  check(isFiniteNumber(f.price) && f.price >= 0, `${label}: price が有限な 0 以上の数値でない (${JSON.stringify(f.price)})`);
  for (const key of NUMERIC_FIELDS) {
    if (f[key] !== undefined) check(isFiniteNumber(f[key]), `${label}: ${key} が有限な数値でない (${JSON.stringify(f[key])})`);
  }
  // 任意の甘さ特性値。flavor-profile.js が 0..10 の強さとして clamp して読む。
  if (f.perceived_sweetness !== undefined) {
    check(isFiniteNumber(f.perceived_sweetness) && f.perceived_sweetness >= 0 && f.perceived_sweetness <= 10,
      `${label}: perceived_sweetness が 0..10 の数値でない (${JSON.stringify(f.perceived_sweetness)})`);
  }
  // 特性値: 12キーが揃い、各値が有限な 0..10。
  check(f.stats && typeof f.stats === "object" && !Array.isArray(f.stats), `${label}: stats がオブジェクトでない`);
  if (f.stats && typeof f.stats === "object") {
    for (const key of STAT_KEYS) {
      const v = f.stats[key];
      check(isFiniteNumber(v) && v >= 0 && v <= 10, `${label}: stats.${key} が 0..10 の数値でない (${JSON.stringify(v)})`);
    }
  }
  // 加熱表現のアンカー値も同じ 0..10 の特性値として読まれる。
  if (f.thermal_expression !== undefined) {
    const te = f.thermal_expression;
    check(te && typeof te === "object" && !Array.isArray(te), `${label}: thermal_expression がオブジェクトでない`);
    if (te && typeof te === "object") {
      for (const anchor of ["low", "middle", "high"]) {
        const values = te[anchor];
        if (values === undefined) continue;
        check(values && typeof values === "object", `${label}: thermal_expression.${anchor} がオブジェクトでない`);
        if (!values || typeof values !== "object") continue;
        for (const [key, v] of Object.entries(values)) {
          check(isFiniteNumber(v) && v >= 0 && v <= 10,
            `${label}: thermal_expression.${anchor}.${key} が 0..10 の数値でない (${JSON.stringify(v)})`);
        }
      }
    }
  }
  // ng_flavors は編集ツールがフレーバー ID の配列として扱う（tools/browser/flavor_stats_editor.html）。
  if (f.ng_flavors !== undefined) {
    check(Array.isArray(f.ng_flavors), `${label}: ng_flavors が配列でない`);
    if (Array.isArray(f.ng_flavors)) {
      for (const ref of f.ng_flavors) check(ids.has(ref), `${label}: ng_flavors の参照先 ${JSON.stringify(ref)} が存在しない`);
    }
  }
}

// 型が明確なフレーバー ID 参照の実在（他データファイル側）。
const ngMixes = read("../../data/ng_mixes.json").ng_mixes;
for (const mix of ngMixes) {
  for (const ref of mix.flavors || []) {
    check(ids.has(ref), `ng_mixes ${mix.id}: flavors の参照先 ${JSON.stringify(ref)} が存在しない`);
  }
}
// くじ景品は kuji.js の grant() が flavorId / flavors[].id を実在庫へ付与する（js/daily/kuji.js:53-58）。
// 参照そのものを持たない景品（旧箱の詰め合わせ等）は対象外とし、参照がある場合だけ実在を見る。
const kuji = read("../../data/kuji.json");
for (const section of ["grades", "legacyGrades"]) {
  for (const [gradeId, grade] of Object.entries(kuji[section] || {})) {
    for (const prize of grade.prizes || []) {
      if (prize.type !== "flavor") continue;
      if (prize.flavorId !== undefined) {
        check(ids.has(prize.flavorId), `kuji ${section}.${gradeId}「${prize.name}」: flavorId ${JSON.stringify(prize.flavorId)} が存在しない`);
      }
      if (Array.isArray(prize.flavors)) {
        for (const leaf of prize.flavors) {
          check(ids.has(leaf.id), `kuji ${section}.${gradeId}「${prize.name}」: flavors の参照先 ${JSON.stringify(leaf.id)} が存在しない`);
        }
      }
    }
  }
}

assert(errors.length === 0, `フレーバーデータ契約違反 ${errors.length} 件:\n${errors.join("\n")}`);
console.log(`flavor_data_contract: ${flavors.length} flavors, all contracts OK`);
