// ラクダレースBGM: 走行速度→再生倍率の対応（競走モデルは変更しない）。
import assert from "node:assert/strict";
import { PLAYER, WHIP } from "../js/minigames/camel-race-model.js";
import { camelRaceBgmRate, CAMEL_RACE_BGM_RATE, CAMEL_RACE_BGM } from "../js/minigames/camel-race-bgm.js";

assert.equal(CAMEL_RACE_BGM, "bgm_camel_race");
assert.equal(CAMEL_RACE_BGM_RATE.min, 1);
assert.equal(CAMEL_RACE_BGM_RATE.max, 1.14);

const cruise = PLAYER.base * (PLAYER.rhythmFloor + PLAYER.rhythmSpan);
const top = cruise + WHIP.spurtBoost;
assert.equal(CAMEL_RACE_BGM_RATE.cruise, cruise);
assert.equal(CAMEL_RACE_BGM_RATE.top, top);

assert.equal(camelRaceBgmRate(cruise), 1);
assert.equal(camelRaceBgmRate(cruise - 2), 1);
assert.equal(camelRaceBgmRate(PLAYER.base), 1);
assert.equal(camelRaceBgmRate(10), 1);
assert.equal(camelRaceBgmRate(top), 1.14);
assert.equal(camelRaceBgmRate(top + 8), 1.14);
assert.equal(camelRaceBgmRate(NaN), 1);
assert.equal(camelRaceBgmRate(), 1);

const mid = camelRaceBgmRate(cruise + (top - cruise) / 2);
assert.ok(Math.abs(mid - (1 + 1.14) / 2) < 1e-12, `midpoint rate ${mid}`);
const whip = camelRaceBgmRate(cruise + WHIP.boost);
assert.ok(whip > 1 && whip < 1.14, `mid-whip rate ${whip}`);
assert.ok(camelRaceBgmRate(cruise + 0.01) > 1);

console.log("[camel race BGM rate] PASS: cruise=1.00, last-spurt whip=1.14, below-cruise stays 1.00");
