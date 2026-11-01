// 読取専用の確認スクリプト。stdoutに結果を出すだけで、ファイルへの書込・プロセス起動・通信はしない。
// 実行: node --experimental-vm-modules remake/test/craft_keys_focus.mjs
// Event/DOM ports only; exercise actual common module and the steam input-connection source.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const commonSrc = fs.readFileSync(new URL("../js/craft/common.js", import.meta.url), "utf8");
const steamSrc = fs.readFileSync(new URL("../js/craft/steam.js", import.meta.url), "utf8");

// steam-main.js の入力接続区間（direction 定義から keyup listener まで）をマーカーで抽出する。
const STEAM_START = "  const direction = { ArrowLeft";
const STEAM_END = 'listen(window, "keyup", (e) => keysDown.delete(direction[e.key]));';
assert.equal(steamSrc.indexOf(STEAM_START), steamSrc.lastIndexOf(STEAM_START), "start marker not unique");
assert.equal(steamSrc.indexOf(STEAM_END), steamSrc.lastIndexOf(STEAM_END), "end marker not unique");
const startAt = steamSrc.indexOf(STEAM_START);
const endAt = steamSrc.indexOf(STEAM_END);
assert.ok(startAt >= 0 && endAt > startAt, "steam marker not found");
const steamSlice = steamSrc.slice(startAt, endAt + STEAM_END.length);

// window / document は実 keys() がグローバルとして参照するため、vm context に登録する adapter。
const listeners = new Map();
const windowStub = {
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  removeEventListener(type, fn) {
    listeners.set(type, (listeners.get(type) || []).filter((f) => f !== fn));
  },
  dispatch(type, ev) {
    for (const fn of [...(listeners.get(type) || [])]) fn(ev);
  },
};
const docStub = {
  activeElement: null,
  guideOpen: false,
  querySelector(sel) {
    return sel === ".bench-guide[open]" && this.guideOpen ? {} : null;
  },
};

// closest() の最小adapter（クラス名の祖先探索のみ）。
function makeEl(classes = [], parent = null) {
  return {
    classes,
    parent,
    closest(sel) {
      const names = sel.split(",").map((s) => s.trim().replace(/^\./, ""));
      for (let cur = this; cur; cur = cur.parent) {
        if (names.some((n) => cur.classes.includes(n))) return cur;
      }
      return null;
    },
  };
}
const body = makeEl();
const guideSummary = makeEl(["summary"], makeEl(["bench-guide"]));
const condition = makeEl(["bench-condition"]);

const ctx = vm.createContext({ window: windowStub, document: docStub });
function synth(id, names, values) {
  return new vm.SyntheticModule(names, function () {
    for (const n of names) this.setExport(n, values[n]);
  }, { context: ctx, identifier: id });
}
const noop = () => {};
const stubMods = {
  "../core/state.js": synth("state", ["state"], { state: {} }),
  "../core/growth-effects.js": synth("growth-effects", ["growthPerks", "growthSkill", "SKILL_TUNING"], { growthPerks: () => null, growthSkill: () => false, SKILL_TUNING: {} }),
  "../core/util.js": synth("util", ["el", "sleep", "clamp"], { el: noop, sleep: noop, clamp: (v) => v }),
  "../core/audio.js": synth("audio", ["SE"], { SE: {} }),
  "../core/stats.js": synth("stats", ["tier01"], { tier01: noop }),
  "./session.js": synth("session", ["craftTest", "presentBenchResult"], { craftTest: { auto: null }, presentBenchResult: noop }),
  "../core/condition.js": synth("condition", ["craftCondition"], { craftCondition: noop }),
};

// common-main.js を無改変で評価する。
const commonMod = new vm.SourceTextModule(commonSrc, { context: ctx, identifier: "common-main.js" });
await commonMod.link((spec) => {
  if (!(spec in stubMods)) throw new Error(`unexpected import: ${spec}`);
  return stubMods[spec];
});
await commonMod.evaluate();
const { keys } = commonMod.namespace;

// steam の入力接続区間を関数本体として評価する。running は true に固定、refresh/slash は記録port。
const steamFactory = new vm.Script(
  `(function (running, keysDown, refresh, slash, keys, listen, window) {\n${steamSlice}\nreturn { unkey, direction };\n})`,
  { filename: "steam-main.js(input-slice)" },
).runInContext(ctx);

const calls = { refresh: 0, slash: 0, enter: 0 };
const keysDown = new Set();
const listen = (target, type, fn) => target.addEventListener(type, fn);
const { unkey } = steamFactory(true, keysDown, () => calls.refresh++, () => calls.slash++, keys, listen, windowStub);
// Enter は steam の map に無いため、同じ実 keys() に通過確認用の map を別登録する。
const removeEnterProbe = keys({ Enter: () => calls.enter++ });

const MOVE = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d" };
function dispatchKey(type, key, target) {
  const ev = { key, code: key, repeat: false, target, prevented: false, preventDefault() { this.prevented = true; } };
  windowStub.dispatch(type, ev);
  return ev;
}
function reset(guideOpen, active) {
  docStub.guideOpen = guideOpen;
  docStub.activeElement = active;
  keysDown.clear();
  calls.refresh = calls.slash = calls.enter = 0;
}

const contexts = [
  { id: "closed-body", guideOpen: false, target: body, active: body },
  { id: "closed-target-summary-focus-body", guideOpen: false, target: guideSummary, active: body },
  { id: "closed-target-body-focus-summary", guideOpen: false, target: body, active: guideSummary },
  { id: "closed-target-condition", guideOpen: false, target: condition, active: body },
  { id: "closed-target-body-focus-condition", guideOpen: false, target: body, active: condition },
  { id: "open-guide-target-body", guideOpen: true, target: body, active: body },
  { id: "closed-target-action", guideOpen: false, target: makeEl(["dodge-action"]), active: body },
  { id: "closed-target-timer", guideOpen: false, target: makeEl(["timer-button"]), active: body },
];

const rows = [];
function check(row, actual, expected) {
  rows.push({ ...row, expected, actual, ok: actual === expected });
}

for (const c of contexts) {
  const inCondition = c.target === condition;
  const inGuide = c.target === guideSummary;
  const inAction = !!c.target.closest(".dodge-action");
  const inTimer = !!c.target.closest(".timer-button");
  // 契約: 閉じたguideでは方向キーを通す（summaryにfocusが残る場合も含む）。
  const expectMove = !c.guideOpen && !inCondition;
  // 契約: guide内・condition内・guide open中のSpace/Enterはミニゲームへ流さない。
  const expectAction = !c.guideOpen && !inCondition && !inGuide && !inTimer;
  for (const key of Object.keys(MOVE)) {
    reset(c.guideOpen, c.active);
    try {
      dispatchKey("keydown", key, c.target);
      check({ context: c.id, key, probe: "move" }, keysDown.has(MOVE[key]), expectMove);
    } catch (err) {
      rows.push({ context: c.id, key, probe: "move", fixtureError: String(err) });
    }
  }
  for (const key of [" ", "Enter"]) {
    reset(c.guideOpen, c.active);
    try {
      dispatchKey("keydown", key, c.target);
      if (key === " ") check({ context: c.id, key, probe: "refresh" }, calls.refresh > 0, expectAction);
      else check({ context: c.id, key, probe: "enter-passthrough" }, calls.enter > 0, expectAction && !inAction);
    } catch (err) {
      rows.push({ context: c.id, key, probe: key === " " ? "refresh" : "enter-passthrough", fixtureError: String(err) });
    }
  }
}

// keyup は実 steam listener が window に登録する。event.target に関係なく方向Setから外れる契約。
for (const [label, target] of [["guide", guideSummary], ["condition", condition], ["body", body]]) {
  reset(false, body);
  dispatchKey("keydown", "ArrowLeft", body);
  try {
    dispatchKey("keyup", "ArrowLeft", target);
    check({ context: `keyup-target-${label}`, key: "ArrowLeft", probe: "keyup-clears" }, keysDown.has("l"), false);
  } catch (err) {
    rows.push({ context: `keyup-target-${label}`, key: "ArrowLeft", probe: "keyup-clears", fixtureError: String(err) });
  }
}

// Removing the steam map must preserve the independent Enter probe; no keyup listener is invented here.
reset(false, body);
unkey();
dispatchKey("keydown", "ArrowRight", body);
check({ context: "remove-steam", probe: "movement-unregistered" }, keysDown.has("r"), false);
dispatchKey("keydown", "Enter", body);
check({ context: "remove-steam", probe: "enter-probe-remains" }, calls.enter, 1);
removeEnterProbe();
dispatchKey("keydown", "Enter", body);
check({ context: "remove-enter-probe", probe: "no-second-call" }, calls.enter, 1);

// 既存の呼び出しはopt-inしない限り、操作ボタンのSpaceを横取りしない。
const removeDefaultProbe = keys({ " ": () => calls.refresh++ });
reset(false, body);
dispatchKey("keydown", " ", makeEl(["dodge-action"]));
check({ context: "default-action-space", probe: "native-button-preserved" }, calls.refresh, 0);
dispatchKey("keydown", " ", body);
check({ context: "default-body-space", probe: "shortcut-preserved" }, calls.refresh, 1);
removeDefaultProbe();

const mismatches = rows.filter((r) => r.ok === false);
const fixtureErrors = rows.filter((r) => r.fixtureError);
const report = {
  status: mismatches.length || fixtureErrors.length ? "fail" : "pass",
  rows: rows.length,
  mismatches: mismatches.length,
  fixtureErrors: fixtureErrors.length,
  mismatchRows: mismatches,
  fixtureErrorRows: fixtureErrors,
  allRows: rows,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = mismatches.length > 0 || fixtureErrors.length > 0 ? 1 : 0;
