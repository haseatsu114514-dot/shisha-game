// #1081 A10: 成長通知は初回は必ずフル、2回目以降は「見た演出を短く」設定オンのときだけ短くする。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { bannerHold, gainSeenKey } from "../js/core/gain-notice.js";

const stat = { kind: "stat", stat: "sense", points: 2 };
const affinity = { kind: "affinity", sub: "好感度が少し上がった", hearts: { from: [0, 0, 0, 0, 0], to: [50, 0, 0, 0, 0] } };

// 記録の対象は能力の通常加算と好感度の通常加算だけ
assert.equal(gainSeenKey(stat), "_motion_seen_gain_stat_sense");
assert.equal(gainSeenKey({ ...stat, stat: "charm" }), "_motion_seen_gain_stat_charm");
assert.equal(gainSeenKey(affinity), "_motion_seen_gain_affinity");
assert.equal(gainSeenKey({ ...stat, evolution: true }), null);
assert.equal(gainSeenKey({ ...stat, fx: "新しい効果" }), null);
assert.equal(gainSeenKey({ ...affinity, bond: true }), null);
assert.equal(gainSeenKey({ ...affinity, sub: "仲が深まった（♥2）" }), null);
assert.equal(gainSeenKey({ kind: "notice" }), null);

// 初回・設定オフは従来の長さ、短縮は既読＋設定オンのときだけ
assert.equal(bannerHold(stat), 2200);
assert.equal(bannerHold(stat, true), 1200);
assert.equal(bannerHold(affinity), 2600);
assert.equal(bannerHold(affinity, true), 1500);
// 段上がり・新効果は短縮しても常にフル
assert.equal(bannerHold({ ...stat, evolution: true }, true), 4200);
assert.equal(bannerHold({ ...stat, fx: "x" }, true), 3200);
// 実際のpumpBanners配線を仮想時計で検証する（表示時間・設定・途中SAVE/LOAD・画面除去）。
const uiSource = fs.readFileSync(new URL("../js/core/ui.js", import.meta.url), "utf8");
const start = uiSource.indexOf("function pumpBanners() {");
const end = uiSource.indexOf("/** 通知の光を", start);
assert(start >= 0 && end > start, "production pumpBanners is available");
function harness(flags = {}, shortSeen = true) {
  let now = 0;
  const timers = [], cards = [];
  const context = vm.createContext({
    state: { flags: { ...flags } }, config: { shortSeen }, bannerBusy: 0, bannerQueue: [],
    gainSeenKey, bannerHold,
    el: () => {
      const card = { isConnected: false, classList: { add() {}, remove() {} },
        remove() { this.isConnected = false; } };
      cards.push(card); return card;
    },
    statBadge: () => ({}), heartRow: () => null, SE: { select() {} },
    layers: { banners: { append(card) { card.isConnected = true; } } },
    requestAnimationFrame: fn => fn(),
    setTimeout: (fn, delay) => { timers.push({ fn, at: now + delay }); },
  });
  vm.runInContext(uiSource.slice(start, end), context);
  return {
    context, cards,
    show() {
      context.bannerQueue.push({ kind: "stat", stat: "sense", points: 0, owner: context.state });
      context.pumpBanners();
    },
    advance(ms) {
      const target = now + ms;
      while (true) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > target) break;
        const timer = timers.shift(); now = timer.at; timer.fn();
      }
      now = target;
    },
  };
}
const key = gainSeenKey(stat);
{
  const h = harness(); h.show();
  assert.equal(h.context.state.flags[key], undefined, "do not mark a newly queued notification as seen");
  h.advance(1000);
  const savedFlags = { ...h.context.state.flags };
  h.advance(1199);
  assert.equal(h.context.state.flags[key], undefined, "first notification stays unread until full hold completes");
  h.advance(1);
  assert.equal(h.context.state.flags[key], true, "completed full hold records seen");
  h.advance(420); h.show(); h.advance(1199);
  assert.equal(h.context.bannerBusy, 1, "repeat notification remains during shortened hold");
  h.advance(1);
  assert.equal(h.cards.at(-1).isConnected, true, "exit animation is preserved");
  h.advance(420); assert.equal(h.context.bannerBusy, 0);
  const resumed = harness(savedFlags); resumed.show(); resumed.advance(1200);
  assert.equal(resumed.context.state.flags[key], undefined, "SAVE during first hold cannot make LOAD skip it");
  resumed.advance(1000); assert.equal(resumed.context.state.flags[key], true);
}
{
  const h = harness(); h.show(); h.advance(1000);
  const oldOwner = h.context.state;
  h.context.state = { flags: {} }; h.advance(1200);
  assert.equal(oldOwner.flags[key], undefined, "LOAD does not mark the interrupted owner's notice seen");
  assert.equal(h.context.state.flags[key], undefined, "LOAD does not write to the replacement owner");
}
{
  const h = harness(); h.show(); h.advance(1000); h.cards.at(-1).remove(); h.advance(1200);
  assert.equal(h.context.state.flags[key], undefined, "removed notice is not completed");
}
{
  const h = harness({ [key]: true }, false); h.show(); h.advance(1200);
  assert.equal(h.context.bannerBusy, 1, "setting off keeps repeat notification full-length");
  h.advance(1420); assert.equal(h.context.bannerBusy, 0);
}
console.log("gain notice A10: PASS (pure functions + production timing/SAVE/LOAD/removal wiring)");

