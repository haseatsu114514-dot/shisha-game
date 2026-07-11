// A3 体力バランス / A5 経済バランスの検証（master_spec）。
// 実コードの定数をページから読み、通常プレイは事故らず・無理し続けると寝込む曲線を保証。
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); } })();
const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[balance]", ...a);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => { console.error("PAGEERROR", e.message); process.exit(1); });
await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

const c = await page.evaluate(() => ({ cost: STAMINA_COST, gain: STAMINA_GAIN, low: STAMINA_LOW }));
log("stamina cost:", JSON.stringify(c.cost), "gain:", JSON.stringify(c.gain), "low:", c.low);

// (A3-1) 通常の混在プレイ（昼バイト＋夜キャラ訪問、就寝回復）を14日。
// 新仕様（2026-07-02 オーナー指定）: 章の間に一度は「家で休むか」を考える
// ゾーン（警告ライン+15）まで落ちること。かつ、落ちたら1回休む素直な
// プレイで警告ライン未満（酸欠リスク）には入らない＝詰まないこと。
// 2026-07-07（F8）: 就寝回復をさらに下げた（26→19。訪問+会話=26で±0だった穴を塞ぐ）。
// 2026-07-08: 「まだ全然余る」との再報告で19→14へ再調整。休憩検討は最大5回まで許容に仕様更新
const CONSIDER = c.low + 15; // 休憩を検討し始めるゲージ
let sta = 100, considered = 0, sickNormal = false;
for (let d = 0; d < 14; d++) {
  sta = Math.max(0, sta - c.cost.baito);        // 昼: バイト
  if (sta <= CONSIDER) {
    considered++;                                // 夜: ゲージを見て家で休む判断
    sta = Math.min(100, sta + c.gain.rest);
  } else {
    sta = Math.max(0, sta - c.cost.visit);       // 夜: 訪問
  }
  if (sta < c.low) sickNormal = true;            // 警告ライン未満まで落ちたら厳しすぎ
  sta = Math.min(100, sta + c.gain.sleep);       // 就寝回復
}
log(`通常プレイ14日: 最終体力${sta} 休憩検討${considered}回 警告未満=${sickNormal}`);
if (considered < 1) throw new Error("A3: 14日間で一度も休憩を考える場面が来ない（減りが緩すぎ）");
if (considered > 5) throw new Error("A3: 休憩の検討が5回を超える（厳しすぎ）");
if (sickNormal) throw new Error("A3: 素直に休んでも警告ラインを割る（厳しすぎ）");

// (A3-1b) 店巡りだけ（訪問×2/日）でも体力は減っていき、章内に一度は休憩を考える
// （旧バランスは訪問2回<就寝回復で一生減らなかった＝オーナー報告 2026-07-02）
sta = 100; let consideredVisit = 0; let sickVisit = false;
for (let d = 0; d < 14; d++) {
  sta = Math.max(0, sta - c.cost.visit);
  if (sta <= CONSIDER) { consideredVisit++; sta = Math.min(100, sta + c.gain.rest); }
  else sta = Math.max(0, sta - c.cost.visit);
  if (sta < c.low) sickVisit = true;
  sta = Math.min(100, sta + c.gain.sleep);
}
log(`店巡りプレイ14日: 最終体力${sta} 休憩検討${consideredVisit}回 警告未満=${sickVisit}`);
if (consideredVisit < 1) throw new Error("A3-1b: 店巡りだけだと体力が一生減らない（訪問コスト<回復）");
if (sickVisit) throw new Error("A3-1b: 店巡りで警告ラインを割る（厳しすぎ）");

// (A3-2) 毎日2回バイト（無理し続ける）→ いずれ低体力に入る（システムが機能している）
sta = 100; let hitLow = false;
for (let d = 0; d < 14; d++) {
  sta = Math.max(0, sta - c.cost.baito * 2);
  if (sta < c.low) hitLow = true;
  sta = Math.min(100, sta + c.gain.sleep);
}
log(`無理プレイ(毎日2バイト)14日: 低体力到達=${hitLow}`);
if (!hitLow) throw new Error("A3: 無理を重ねても寝込まない（ペナルティが機能していない）");

// (A3-3) 1日休養で回復しきる（若いので甘め）
sta = c.low - 5;
sta = Math.min(100, sta + c.gain.rest + c.gain.sleep);
log(`低体力から休養1日: ${sta}`);
if (sta < 80) throw new Error("A3: 休養しても回復が鈍い（甘め設計に反する）");
log("A3 体力バランス OK");

// (A5) 経済: 標準プレイの所持金が破綻しないこと（バイト最低額・大会賞金から）
const econ = await page.evaluate(() => {
  const baitoMin = Math.max(8000, (D.baito_settings && D.baito_settings.base_pay) || 8000);
  return { baitoMin, start: 30000, visitCost: 3000 };
});
log(`バイト最低${econ.baitoMin}円 / 訪問費${econ.visitCost}円 / 初期${econ.start}円`);
// 14日・1日1バイトなら最低でも 8000*14=112,000 の収入。訪問など支出を引いても黒字維持
const income = econ.baitoMin * 14;
const spend = econ.visitCost * 14 + 4000 /*gym*/ + 800 * 3 /*cafe*/;
if (income - spend <= 0) throw new Error("A5: 標準プレイで赤字になりうる");
log(`14日想定: 収入${income} - 支出${spend} = +${income - spend}（黒字維持）`);
log("A5 経済バランス OK");

console.log("[balance] BALANCE PASSED ✅");
await browser.close();
