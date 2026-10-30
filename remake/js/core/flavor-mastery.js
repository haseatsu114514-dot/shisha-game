// 味の系統ごとの熟練度。同じ味のメーカー違いは経験を共有する。
export const MASTERY_THRESHOLDS = [0, 6, 18, 36, 60];
const MASTERY_MAX_XP = MASTERY_THRESHOLDS.at(-1);
export const flavorFamily = (id, flavors = {}) => flavors[id]?.family || id;
export const masteryXp = (s, id, flavors = {}) => Math.min(MASTERY_MAX_XP, Math.max(0, Number(s?.flavorMastery?.[flavorFamily(id, flavors)]) || 0));
export const masteryLevel = (s, id, flavors = {}) => MASTERY_THRESHOLDS.filter(x => masteryXp(s, id, flavors) >= x).length;
export function masteryLabel(s, id, flavors = {}) {
  const level = masteryLevel(s, id, flavors);
  return `熟練度 ${"★".repeat(level)}${"☆".repeat(5 - level)}${level === 5 ? " MAX" : ""}`;
}
export function gainFlavorExperience(s, mix, budget, flavors = {}) {
  const valid = Object.entries(mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const total = valid.reduce((sum, [, g]) => sum + g, 0);
  if (!total || !Number.isFinite(budget) || budget <= 0) return [];
  const families = {};
  for (const [id, g] of valid) { const f = flavorFamily(id, flavors); families[f] = (families[f] || 0) + g; }
  s.flavorMastery ||= {};
  return Object.entries(families).map(([id, g]) => {
    const before = masteryLevel(s, id, flavors);
    s.flavorMastery[id] = Math.min(MASTERY_MAX_XP, Math.round((masteryXp(s, id, flavors) + budget * g / total) * 1000) / 1000);
    return { id, before, level: masteryLevel(s, id, flavors) };
  });
}
// 旧版では同じ人の味の話が複数回に分かれていた。第4回へ移した後も、
// 旧セーブで受け取った分だけを差し引いて、残りだけを受け取れるようにする。
export const FOURTH_FLAVOR_LESSONS = {
  ch1_naru_fourth: [
    ["ch1_naru_first", { vanilla: 1 }],
    ["ch1_naru_third", { vanilla: 1 }],
  ],
  ch1_rin_fourth: [
    ["ch1_rin_second", { rose: 1, lychee: 1 }],
    ["ch1_rin_repeat", { blueberry: 1 }],
  ],
  ch2_kumicho_fourth: [["ch2_kumicho_second", { dragonfruit: 1 }]],
  ch2_rei_fourth: [["ch2_rei_first", { rose: 1 }]],
};
// 会話の最後まで読んだ回だけ。好感度や過去の訪問回数から補完しない。
export function learnFlavorStory(s, dialogue, flavors = {}) {
  const lesson = dialogue?.metadata?.flavor_lesson;
  const key = dialogue?.dialogue_id;
  if (!key || !lesson || s.flavorLessons?.includes(key)) return [];
  const former = FOURTH_FLAVOR_LESSONS[key];
  if (former) {
    const received = s.flavorLessons || [];
    const gains = former.filter(([id]) => !received.includes(id))
      .flatMap(([, mix]) => gainFlavorExperience(s, mix, 12, flavors));
    (s.flavorLessons ||= []).push(key);
    return gains;
  }
  (s.flavorLessons ||= []).push(key);
  return gainFlavorExperience(s, lesson, 12, flavors);
}
// ゲーム内の調整値。基本情報はLv.1から開示し、使い慣れた葉ほど予測と仕上げが安定する。
// 配合の重さで平均するため、熟練した葉を少量足しても一杯全体の効果にはならない。
export function mixMasteryProfile(s, mix, flavors = {}) {
  const entries = Object.entries(mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const largest = entries.reduce((max, [, g]) => Math.max(max, g), 0);
  const total = entries.reduce((sum, [, g]) => sum + g / largest, 0);
  const weighted = total ? entries.reduce((sum, [id, g]) => sum + (masteryLevel(s, id, flavors) - 1) / 4 * (g / largest) / total, 0) : 0;
  const progress = Math.max(0, Math.min(1, weighted));
  return {
    level: 1 + 4 * progress,
    progress,
    bonus: 8 * progress,
    aromaBonus: 6 * progress,
    forecastGain: .45 * progress,
  };
}
export function masteryBonus(s, mix, flavors = {}) {
  return mixMasteryProfile(s, mix, flavors).bonus;
}

// 毎日3種類・各6g。日付と保存済みseedで固定し、出入りやLOADで再抽選しない。
const LEFTOVERS = ["double_apple", "mint", "blueberry", "orange", "vanilla", "peach", "lemon", "grape"];
export function staffFlavors(s) {
  const index = Math.abs((s.weatherSeed || 0) + s.day + (s.chapter || 1) * 3) % LEFTOVERS.length;
  return [0, 2, 4].map(n => LEFTOVERS[(index + n) % LEFTOVERS.length]);
}
export const masteryDay = s => `${s.chapter}:${s.day}`;
export function staffStock(s, id) {
  if (!staffFlavors(s).includes(id)) return 0;
  return Math.max(0, 6 - (s.staffPractice?.day === masteryDay(s) ? s.staffPractice.used?.[id] || 0 : 0));
}
export function spendPracticeMix(s, mix) {
  const staff = {}, own = {};
  for (const [id, grams] of Object.entries(mix)) {
    if (!Number.isFinite(grams) || grams < 0) return null;
    staff[id] = Math.min(grams, staffStock(s, id));
    own[id] = grams - staff[id];
    if (own[id] > (s.flavorStock[id] || 0)) return null;
  }
  if (s.staffPractice?.day !== masteryDay(s)) s.staffPractice = { day: masteryDay(s), used: {} };
  for (const id of Object.keys(mix)) {
    s.staffPractice.used[id] = (s.staffPractice.used[id] || 0) + staff[id];
    s.flavorStock[id] = Math.max(0, (s.flavorStock[id] || 0) - own[id]);
  }
  return { staff, own };
}
