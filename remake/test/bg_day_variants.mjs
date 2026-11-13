// 第3章の東京の4店（mukai・煙幕・鉄の煙・Smoke & Glory）の昼の版（#3282 B3・B4・B8・B9・BGU06）。
// 昼の版を使うのは、時間帯が「昼」と明示された時だけ。時間帯を渡さない呼び出しは、昼か夜かを知らないまま呼んでいる
// （第3章の夜の場面にも使われる）ので、今までどおり窓の外が夕方〜夜の絵のまま。夜は無印の絵に夜の色調補正を掛けない（窓の外が夜の絵なので）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB, sceneBg, bgUrl } from "../js/core/data.js";

DB.manifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
// 拡張子は環境で変わる（ブラウザは WebP）ので、名前だけで比べる。
const file = (art) => String(art.url).split("/").pop().replace(/\.(?:png|webp)$/, "");

for (const shop of ["bg_mukai_shop", "bg_yohaku_shop", "bg_volk_shop", "bg_steve_shop"]) {
  assert(DB.manifest.backgrounds.includes(`${shop}.png`) && DB.manifest.backgrounds.includes(`${shop}_day.png`), `${shop}: 無印と昼の版が目録にある`);
  assert.equal(file(sceneBg(shop, "day")), `${shop}_day`, `${shop}: 昼と明示すると昼の版`);
  assert.equal(file(sceneBg(`res://assets/backgrounds/${shop}.png`, "day")), `${shop}_day`, `${shop}: res:// の参照でも昼の版`);
  assert.equal(sceneBg(shop, "day").tint, null, `${shop}: 昼の版に色調補正は掛けない`);
  // 時間帯を渡さない呼び出し・夜の呼び出しは、今までの絵（窓の外が夕方〜夜）。
  assert.equal(file(sceneBg(shop)), `${shop}`, `${shop}: 時間帯を渡さない呼び出しは今までの絵`);
  assert.equal(file(sceneBg(shop, undefined)), `${shop}`);
  assert.equal(file(sceneBg(shop, "night")), `${shop}`, `${shop}: 夜は今までの絵`);
  assert.equal(bgUrl(shop), sceneBg(shop).url, `${shop}: bgUrl も時間帯を渡さなければ今までの絵`);
  assert.equal(bgUrl(shop, "day"), sceneBg(shop, "day").url);
  // 絵の名前で昼を指定した時はそのまま。
  assert.equal(file(sceneBg(`${shop}_day`, "night")), `${shop}_day`, `${shop}: 名前で昼の版を指定したら夜でも昼の版`);
}

// 夜の色調補正: 無印の絵は窓の外が夕方〜夜なので、夜に補正を掛けるのは今までと同じ（昼の版では掛けない）。
assert.equal(sceneBg("bg_mukai_shop", "night").tint, "night");

// ほかの場所には触れていない: 昼夜の差分がある場所は今までどおり時間帯で選ぶ。
assert.equal(file(sceneBg("bg_tonari_inside", "day")), "bg_tonari_inside_day");
assert.equal(file(sceneBg("bg_tonari_inside", "night")), "bg_tonari_inside_night");
assert.equal(file(sceneBg("bg_tonari_inside")), "bg_tonari_inside_day", "昼夜の差分がある場所は、省くと昼（今までどおり）");
assert.equal(file(sceneBg("bg_eden_shop", "day")), "bg_eden_shop");
assert.deepEqual(sceneBg(null, "day"), { url: null, tint: null });
assert.deepEqual(sceneBg("unknown_art", "day"), { url: null, tint: null });
console.log("bg day variants ok");
