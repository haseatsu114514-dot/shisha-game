// node remake/test/ngplus_cycle_meta.mjs
// NG+（Issue #1228）U2: 周回メタ層 suien_remake_cycle v1 の読み書き・真エンド記録・開始通知。
import assert from "node:assert/strict";

const store = new Map();
let failSet = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (failSet) throw new Error("quota"); store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
globalThis.sessionStorage ??= globalThis.localStorage;

const meta = await import("../js/core/cycle-meta.js");
const gallery = await import("../js/core/gallery-progress.js");
const core = await import("../js/core/state.js");
const { CYCLE_META_KEY, CYCLE_META_VERSION, emptyCycleMeta, readCycleMeta, saveCycleMeta,
  recordTrueEnd, recordTrueEndForRun, recordCycleStarted } = meta;
const { GALLERY_PROGRESS_KEY, readGalleryProgress } = gallery;
const { newState, save } = core;

const copy = (v) => JSON.parse(JSON.stringify(v));

function trueEndState() {
  const s = newState();
  s.cycle = 1;
  s.cycleId = "cycle-test-1";
  s.stats.technique = 42;
  s.money = 5000;
  s.lovers = ["minto"];
  s.affinity = { minto: 99 };
  s.tournament = { attempts: 3, lastRank: 2, losses: 1, lastLossAttempt: null, retryAssist: false };
  s.flags._ch2_tournament = { attempts: 2, history: [{ win: true }, { win: false }] };
  s.flags._ch3_tournament = { attempts: 4, history: [{ win: true }, { win: true }] };
  s.flags._ch4 = { attempts: 1 };
  return s;
}

// ---------------------------------------------------------------- A. 初期形と読み取り
{
  store.clear();
  assert.equal(CYCLE_META_VERSION, 1);
  assert.deepEqual(readCycleMeta(), emptyCycleMeta());
  assert.equal(store.has(CYCLE_META_KEY), false, "読み込みだけでは保存しない");

  store.set(CYCLE_META_KEY, "{broken json");
  assert.deepEqual(readCycleMeta(), emptyCycleMeta(), "不正JSONは初期形として読む");

  store.set(CYCLE_META_KEY, JSON.stringify({ version: 99, unlocked: true, highestCycleStarted: 7 }));
  assert.deepEqual(readCycleMeta(), emptyCycleMeta(), "未対応versionは初期形として読む");

  store.set(CYCLE_META_KEY, JSON.stringify({
    version: 1, unlocked: "yes", highestCycleStarted: 0,
    trueEnds: [{ cycleId: "a", cycle: 1, at: "t", loversAtEnd: ["minto", "Bad ID", "minto"] }, { cycle: 2 }],
    carryPackage: { fromCycleId: "a", fromCycle: 1, data: [] },
    lifetime: { tournamentWins: -1, tournamentAttempts: 2.5 },
  }));
  const normalized = readCycleMeta();
  assert.equal(normalized.unlocked, false);
  assert.equal(normalized.highestCycleStarted, 1);
  assert.deepEqual(normalized.trueEnds, [{ cycleId: "a", cycle: 1, at: "t", loversAtEnd: ["minto"] }]);
  assert.equal(normalized.carryPackage, null, "dataが配列のパッケージは採用しない");
  assert.deepEqual(normalized.lifetime, { tournamentWins: 0, tournamentAttempts: 0 });
}

// ---------------------------------------------------------------- B. 真エンド記録
{
  store.clear();
  const s = trueEndState();
  assert.equal(recordTrueEnd(s), true);
  const m = readCycleMeta();
  assert.equal(m.unlocked, true);
  assert.equal(m.trueEnds.length, 1);
  assert.equal(m.trueEnds[0].cycleId, "cycle-test-1");
  assert.equal(m.trueEnds[0].cycle, 1);
  assert.deepEqual(m.trueEnds[0].loversAtEnd, ["minto"]);
  assert.equal(m.carryPackage.fromCycleId, "cycle-test-1");
  assert.equal(m.carryPackage.fromCycle, 1);
  assert.equal(m.carryPackage.data.stats.technique, 42);
  assert.equal(m.carryPackage.data.money, 5000);
  // 引き継ぎパッケージに好感度・恋愛のキーが含まれない（§9.1 完了条件）
  for (const key of ["affinity", "story", "lovers", "loveLevel", "finales", "loverEventsSeen"]) {
    assert.equal(Object.hasOwn(m.carryPackage.data, key), false, `dataに ${key} を含めない`);
  }
  // 通算: 試行 3+2+4+1、勝利は履歴のある第2・3章分 1+2
  assert.deepEqual(m.lifetime, { tournamentWins: 3, tournamentAttempts: 10 });
  // U8 のルート記録へも渡る（表示専用・別キー）
  const progress = readGalleryProgress();
  assert.equal(progress.routeRecords.minto?.trueEndAsLover, true);
  assert.ok(progress.clearedChapters.includes(5));

  // 同一 cycleId の再通知: 履歴と通算は増えず、パッケージだけ最新化される
  s.money = 7777;
  assert.equal(recordTrueEnd(s), true);
  const again = readCycleMeta();
  assert.equal(again.trueEnds.length, 1);
  assert.deepEqual(again.lifetime, { tournamentWins: 3, tournamentAttempts: 10 });
  assert.equal(again.carryPackage.data.money, 7777);

  // 別 cycleId は同じ周回数でも別の到達として記録される
  const s2 = trueEndState();
  s2.cycleId = "cycle-test-2";
  s2.lovers = [];
  assert.equal(recordTrueEnd(s2), true);
  const two = readCycleMeta();
  assert.equal(two.trueEnds.length, 2);
  assert.deepEqual(two.lifetime, { tournamentWins: 6, tournamentAttempts: 20 });
}

// ---------------------------------------------------------------- C. 不備な state は記録しない
{
  store.clear();
  assert.equal(recordTrueEnd(null), false);
  assert.equal(recordTrueEnd({}), false);
  assert.equal(recordTrueEnd({ cycle: 1 }), false);
  assert.equal(recordTrueEnd({ cycleId: "x", cycle: 0 }), false);
  assert.equal(recordTrueEnd({ cycleId: "", cycle: 1 }), false);
  assert.equal(store.has(CYCLE_META_KEY), false);
  assert.equal(store.has(GALLERY_PROGRESS_KEY), false, "不備な通知では進行層にも書かない");
}

// ---------------------------------------------------------------- D. 開始通知は最大周回数だけ
{
  store.clear();
  assert.equal(recordTrueEnd(trueEndState()), true);
  const before = readCycleMeta();
  assert.equal(recordCycleStarted({ cycle: 2, cycleId: "cycle-test-2", cycleStartStats: {} }), true);
  assert.equal(recordCycleStarted({ cycle: 3, cycleId: "cycle-test-3", cycleStartStats: {} }), true);
  assert.equal(recordCycleStarted({ cycle: 2, cycleId: "cycle-test-2b", cycleStartStats: {} }), true);
  const after = readCycleMeta();
  assert.equal(after.highestCycleStarted, 3, "古い周回の開始で下がらない");
  assert.equal(after.unlocked, before.unlocked);
  assert.deepEqual(after.trueEnds, before.trueEnds);
  assert.deepEqual(after.carryPackage, before.carryPackage);
  assert.deepEqual(after.lifetime, before.lifetime);
  assert.equal(recordCycleStarted({ cycle: 0 }), false);
  assert.equal(recordCycleStarted(null), false);

  // 開始通知だけでは解放されない
  store.clear();
  assert.equal(recordCycleStarted({ cycle: 2, cycleId: "x", cycleStartStats: {} }), true);
  assert.equal(readCycleMeta().unlocked, false);
}

// ---------------------------------------------------------------- E. ロード・保存では解放されない
{
  store.clear();
  const s = newState();
  s.flags._ch5_cleared = true;
  core.setState?.(s);
  save();
  assert.equal(readCycleMeta().unlocked, false, "第5章クリア記録や通常セーブでは解放しない");
  assert.equal(store.has(CYCLE_META_KEY), false);
}

// ---------------------------------------------------------------- F. 保存失敗の通知と周回内セーブの保全
{
  store.clear();
  const s = trueEndState();
  const snapshot = copy({ cycle: s.cycle, cycleId: s.cycleId, money: s.money, lovers: s.lovers });
  failSet = true;
  assert.equal(saveCycleMeta(emptyCycleMeta()), false);
  assert.equal(recordTrueEnd(s), false, "メタ保存の失敗は戻り値で判別できる");
  failSet = false;
  assert.deepEqual(
    { cycle: s.cycle, cycleId: s.cycleId, money: s.money, lovers: s.lovers }, snapshot,
    "保存失敗でも周回内 state は壊れない");
  assert.equal(recordTrueEnd(s), true, "失敗後の再通知で記録できる");
  assert.equal(readCycleMeta().trueEnds.length, 1, "再通知で到達は重複しない");
}

// ---------------------------------------------------------------- G. 締めの流れからの通知（recordTrueEndForRun）
{
  // 初回のスタッフロール直後は解放と到達を記録する
  store.clear();
  const a = trueEndState();
  assert.equal(recordTrueEndForRun(a, { justFinished: true }), true);
  const first = readCycleMeta();
  assert.equal(first.unlocked, true);
  assert.equal(first.trueEnds.length, 1);
  assert.equal(first.carryPackage.fromCycleId, "cycle-test-1");
  assert.equal(readGalleryProgress().routeRecords.minto?.trueEndAsLover, true);

  // 同じ周回の再通知（完了カード・盤を使った後）は、到達と通算を増やさずパッケージだけ最新化する
  a.money = 9100;
  assert.equal(recordTrueEndForRun(a), true);
  const refreshed = readCycleMeta();
  assert.equal(refreshed.trueEnds.length, 1);
  assert.deepEqual(refreshed.lifetime, first.lifetime);
  assert.equal(refreshed.carryPackage.data.money, 9100);

  // 別の周回 B が初回のスタッフロールを見終えたら、パッケージは B になる
  const b = trueEndState();
  b.cycleId = "cycle-test-b";
  b.cycle = 2;
  b.money = 300;
  assert.equal(recordTrueEndForRun(b, { justFinished: true }), true);
  const afterB = readCycleMeta();
  assert.equal(afterB.carryPackage.fromCycleId, "cycle-test-b");
  assert.equal(afterB.trueEnds.length, 2);

  // その後に A のクリア済み保存を開いても巻き戻さない（何も書かない）
  const raw = store.get(CYCLE_META_KEY);
  a.money = 1;
  assert.equal(recordTrueEndForRun(a), true, "書かなくてよい通知は成功として返す");
  assert.equal(store.get(CYCLE_META_KEY), raw, "記録済みの古い周回の保存を開いてもメタ層を書き換えない");

  // 接続前に見終えた、未記録の古い保存 P を開いたときも、B のパッケージは残し、到達と通算だけ足す
  const p = trueEndState();
  p.cycleId = "cycle-test-prefix";
  p.money = 50;
  p.lovers = ["tsumugi"];
  assert.equal(recordTrueEndForRun(p), true);
  const backfilled = readCycleMeta();
  assert.deepEqual(backfilled.carryPackage, afterB.carryPackage, "別の周回のパッケージは巻き戻さない");
  assert.equal(backfilled.trueEnds.length, 3);
  assert.equal(backfilled.trueEnds[2].cycleId, "cycle-test-prefix");
  assert.deepEqual(backfilled.lifetime, {
    tournamentWins: afterB.lifetime.tournamentWins + 3,
    tournamentAttempts: afterB.lifetime.tournamentAttempts + 10,
  });
  assert.equal(readGalleryProgress().routeRecords.tsumugi?.trueEndAsLover, true);
  const rawP = store.get(CYCLE_META_KEY);
  assert.equal(recordTrueEndForRun(p), true);
  assert.equal(store.get(CYCLE_META_KEY), rawP, "記録した後に開き直しても書かない");

  // B の保存を開き直せば、B のパッケージとして最新化される
  b.money = 400;
  assert.equal(recordTrueEndForRun(b), true);
  const reopenedB = readCycleMeta();
  assert.equal(reopenedB.carryPackage.fromCycleId, "cycle-test-b");
  assert.equal(reopenedB.carryPackage.data.money, 400);
  assert.equal(reopenedB.trueEnds.length, 3);

  // 解放済みでもパッケージが検証で落ちていたら作り直す（タイトルの周回開始を行き止まりにしない）
  const broken = JSON.parse(store.get(CYCLE_META_KEY));
  broken.carryPackage = { fromCycleId: "cycle-test-b", fromCycle: 2, data: [] };
  store.set(CYCLE_META_KEY, JSON.stringify(broken));
  assert.equal(readCycleMeta().carryPackage, null);
  assert.equal(recordTrueEndForRun(a), true);
  const rebuilt = readCycleMeta();
  assert.equal(rebuilt.carryPackage.fromCycleId, "cycle-test-1");
  assert.equal(rebuilt.carryPackage.data.money, 1);
  assert.equal(rebuilt.trueEnds.length, 3, "到達済みの周回は重複しない");
  assert.deepEqual(rebuilt.lifetime, reopenedB.lifetime);

  // keepPackage はパッケージが無ければ作る（未解放の端末で接続前の保存を開いた場合と同じ結果）
  store.clear();
  assert.equal(recordTrueEnd(p, { keepPackage: true }), true);
  assert.equal(readCycleMeta().carryPackage.fromCycleId, "cycle-test-prefix");

  // 不備な state は記録しない
  store.clear();
  assert.equal(recordTrueEndForRun(null), false);
  assert.equal(recordTrueEndForRun({ cycle: 1 }), false, "cycleId が無い");
  assert.equal(recordTrueEndForRun({ cycleId: "x", cycle: 0 }, { justFinished: true }), false);
  assert.equal(store.has(CYCLE_META_KEY), false);
  assert.equal(store.has(GALLERY_PROGRESS_KEY), false);

  // 保存できない端末でも例外にせず false を返し、次の通知で記録できる
  failSet = true;
  assert.equal(recordTrueEndForRun(trueEndState(), { justFinished: true }), false);
  failSet = false;
  assert.equal(readCycleMeta().unlocked, false);
  assert.equal(recordTrueEndForRun(trueEndState()), true);
  assert.equal(readCycleMeta().unlocked, true);
}

console.log("ngplus_cycle_meta: all assertions passed");
