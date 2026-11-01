// 周回開始（Issue #1228、NGPLUS-DESIGN.md §2・§3.3〜§3.5・§8）。
import { state, newState, newCycleId, setState, save, STAT_KEYS } from "./state.js";
import { readCycleMeta } from "./cycle-meta.js";
import { MAX_MONEY } from "./rules.js";
import { maxStamina } from "./stats.js";

// §3.5: 自己ベスト best は知識・記録系として knowledge に含める。
const GROUP_KEYS = {
  stats: ["stats", "statXp", "growth"],
  money: ["money"],
  items: ["owned", "equip", "goods", "kuji", "reel", "trpg", "flavorStock", "keepsakes"],
  knowledge: ["flavors", "flavorMastery", "flavorLessons", "recipes", "best"],
};

/** §4: 難易度へ渡す周回開始の根拠。1周目は能力の持ち込みなし。 */
export function difficultyEvidence(state) {
  return { cycle: state.cycle, carryStats: state.cycle > 1 && state.carryOptions?.groups?.stats !== false };
}

/**
 * difficultyForRun(value, { cycle, carryStats }) へ渡す周回の根拠。
 * 結果は state に保存しない。
 */
export function confirmRunDifficulty(state, difficultyForRunFn) {
  return typeof difficultyForRunFn === "function" ? difficultyForRunFn(state, difficultyEvidence(state)) : 0;
}

/**
 * §3.2・§7: 解放判定は U2 の周回メタ層（suien_remake_cycle）を正本とする。
 * 解放の書き込みは recordTrueEnd の明示通知だけが行い、章クリアだけでは解放しない。
 * 真エンド到達の判定自体は #517 / D7 の領域であり、ここでは決めない。
 */
export function isNextCycleUnlocked() {
  return readCycleMeta().unlocked === true;
}

/** 抽出済みパッケージを適用して次の周回を開始する（§3.4）。 */
export function startNextCycle(pkg, options = {}) {
  // buildCarryPackage の出力に fromCycle はない。U2 recordTrueEnd のメタ層パッケージが
  // fromCycle を持つ場合はそちらを優先し、なければ呼び出し側・現在の周回の順で補う。
  const fromCycle = pkg.fromCycle ?? options.fromCycle ?? state?.cycle ?? 1;
  const next = newState();
  const defaultEquip = structuredClone(next.equip);
  const groups = Object.fromEntries(Object.keys(GROUP_KEYS).map(key => [key, options.groups?.[key] !== false]));
  next.carryOptions = { groups };

  // §2・§3.4-2: 許可されたグループだけを複製。関係・進行は newState の初期値に保つ。
  for (const [group, keys] of Object.entries(GROUP_KEYS)) {
    if (!groups[group]) continue;
    for (const key of keys) {
      if (Object.hasOwn(pkg, key)) next[key] = structuredClone(pkg[key]);
    }
  }
  if (groups.money) next.money = Math.min(MAX_MONEY, next.money);
  // flags はパッケージ側で carry 判定済みなので、グループ選択によらず適用する。
  if (Object.hasOwn(pkg, "flags")) next.flags = structuredClone(pkg.flags);

  // §3.4-3: 抽出時に落ちた枠も復旧する。既定装備も所持していなければ枠を落とす。
  for (const slot of new Set([...Object.keys(defaultEquip), ...Object.keys(next.equip)])) {
    if (next.owned.includes(next.equip[slot])) continue;
    if (next.owned.includes(defaultEquip[slot])) next.equip[slot] = defaultEquip[slot];
    else delete next.equip[slot];
  }

  // §3.4-5〜7: 確定した5能力を独立した開始時スナップショットにする。
  next.cycle = fromCycle + 1;
  next.cycleId = newCycleId();
  next.cycleStartStats = structuredClone(Object.fromEntries(STAT_KEYS.map(key => [key, next.stats[key]])));
  next.statsAtChapterStart = structuredClone(next.cycleStartStats);
  setState(next);
  // §3.4-4: maxStamina はグローバル state の根性を読むため、差し替えの後で計算する。
  next.stamina = maxStamina();

  // §3.4-8: highestCycleStarted の永続化は U2（cycle-meta）への申し送り。
  options.onCycleStarted?.({ cycle: next.cycle, cycleId: next.cycleId, cycleStartStats: next.cycleStartStats });
  confirmRunDifficulty(next, options.difficultyForRun);
  // §3.4-9・§8: オートセーブ上書き確認の UI は U10 が呼び出し前に行う（本単元の範囲外）。
  save();
  return next;
}
