// #2455: 上達は累積、火種は一度だけ。growth 内なので途中経過もNG+へ持ち越す。
// 確定済み結果のアダプターだけが recordPlayMastery を呼ぶ。試遊・中断は呼ばない。
import { emit } from './bus.js';

export const PLAY_MASTERY = Object.freeze({
  axe: { title: '斧投げの達人', goal: 3, hint: '10投でSを1回、またはA以上を累計3回（部門不問）' },
  dj: { title: 'フロアのつなぎ手', goal: 2, hint: '異なる2セットでA以上（SYNC可）' },
  camel: { title: 'ラクダレース中級認定', goal: 1, hint: '標準で3位以内・声20点・スタミナ20点・連打1回以内' },
  desert: { title: '砂丘の乗り手', goal: 3, hint: 'ヌールに1勝、またはA以上を累計3回' },
  trpg: { title: '物語の読み手', goal: 2, hint: '異なる2冊で見立てと提案を達成（出目不問）' },
  tetsuko: { title: 'てつこの友だち', goal: 3, hint: '気を許してくれたら、思い出を3種類' },
});
const object = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const count = x => Number.isInteger(x) && x > 0 ? x : 0;
const good = rank => rank === 'A' || rank === 'S';
const unique = xs => [...new Set((Array.isArray(xs) ? xs : []).filter(x => typeof x === 'string' && x))];

export function masteryRecord(s, game) {
  const raw = object(s?.growth?.playMastery?.[game]);
  return { count: Math.min(PLAY_MASTERY[game]?.goal || 0, count(raw.count)), items: unique(raw.items),
    done: raw.done === true || s?.growth?.rewards?.[`${game}-master`] === true,
    ...(game === "tetsuko" ? { bond: Math.min(4, count(raw.bond)) } : {}),
    last: typeof raw.last === 'string' ? raw.last : null };
}
const put = (s, game, r) => {
  s.growth = object(s.growth); s.growth.playMastery = object(s.growth.playMastery);
  s.growth.playMastery[game] = r;
};

/** 旧保存は証明できる実績だけ救済する。plays から過去のA回数を推測しない。 */
export function syncPlayMastery(s) {
  for (const game of Object.keys(PLAY_MASTERY)) {
    const r = masteryRecord(s, game);
    if (game === 'axe') {
      const b = s.flags?._axe_bar_records?.league?.best;
      if (b?.maximum > 0 && b.total / b.maximum >= .62) r.count = Math.max(r.count, 1);
      if (b?.maximum > 0 && b.total / b.maximum >= .8) r.done = true;
    }
    if (game === 'dj') r.items = unique([...r.items, ...Object.entries(object(s.dj?.sets)).filter(([id, x]) => ['1','2','3'].includes(id) && good(x?.best?.rank)).map(([id]) => id)]);
    if (game === 'trpg') r.items = unique([...r.items, ...Object.entries(object(s.trpg?.cleared)).filter(([, x]) => x?.stars === 3 || x?.mastery === true).map(([id]) => id)]);
    if (game === 'camel' && s.flags?._camel_cups?.standard?.mastered === true) r.done = true;
    if (game === 'desert') {
      if (good(s.desert?.bestRank)) r.count = Math.max(r.count, 1);
      if (count(s.desert?.wins)) r.done = true;
    }
    if (game === 'tetsuko') {
      r.bond = Math.min(4, Math.max(r.bond, count(s.flags?._ch3_outings?.tetsuko)));
      const known = ['waiting','first_paw','hug_toy','brush_bliss','paws_together','first_rub','lap_nap','box_peek','ball_watch','odd_sleep','box_over_bed','see_off'];
      r.items = unique([...r.items, ...unique(s.flags?._tetsuko_time?.found).filter(x => known.includes(x))]);
    }
    if (['dj','trpg','tetsuko'].includes(game)) r.count = Math.min(PLAY_MASTERY[game].goal, r.items.length);
    r.done ||= r.count >= PLAY_MASTERY[game].goal && (game !== 'tetsuko' || r.bond >= 4);
    put(s, game, r);
  }
}

/** token は確定点で作る。その結果の二重通知では回数を増やさない。 */
export function recordPlayMastery(s, game, result, token) {
  if (!s || !PLAY_MASTERY[game] || !result || result.cancelled || result.completed === false || typeof token !== 'string' || !token) return false;
  const r = masteryRecord(s, game);
  if (r.last === token) return false;
  const before = r.done;
  // 進み具合（回数・集めたもの・お世話・認定）が変わった時だけ知らせる。3投練習など、数えない記録のたびに出さない
  const progress = (x) => JSON.stringify([x.count, x.items, x.bond, x.done]);
  const was = progress(r);
  r.last = token;
  if (game === 'axe' && result.throwCount === 10 && result.throws?.length === 10 && result.maximum > 0) {
    const ratio = result.total / result.maximum;
    if (ratio >= .62) r.count = Math.min(3, r.count + 1);
    if (ratio >= .8) r.done = true;
  }
  if (game === 'desert') {
    if (good(result.rank)) r.count = Math.min(3, r.count + 1);
    if (result.race?.won && result.race?.who !== 'naru') r.done = true;
  }
  if (game === 'dj' && good(result.rank) && [1,2,3].includes(Number(result.set))) r.items = unique([...r.items, String(result.set)]);
  if (game === 'trpg' && result.rating?.marks?.insight === true && result.rating?.marks?.plan === true) r.items = unique([...r.items, result.scenarioId]);
  if (['dj','trpg','tetsuko'].includes(game)) r.count = Math.min(PLAY_MASTERY[game].goal, r.items.length);
  r.done ||= r.count >= PLAY_MASTERY[game].goal && (game !== 'tetsuko' || r.bond >= 4);
  put(s, game, r);
  syncPlayMastery(s);
  const now = masteryRecord(s, game);
  if (progress(now) !== was) emit('play-mastery', { state: s, game, newly: !before && now.done });
  return true;
}
export function masteryLine(s, game) {
  const r = masteryRecord(s, game), rule = PLAY_MASTERY[game];
  return r.done ? `認定：${rule.title}` : `${rule.hint} · ${r.count}/${rule.goal}`;
}
