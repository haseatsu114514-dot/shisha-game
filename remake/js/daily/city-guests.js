// 隣町の知人が地元へ一服に来る。電車・地図・来店で同じ抽選を読み、描画では保存しない。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { on } from "../core/bus.js";
import { toast } from "../core/ui.js";
import { play, isPlaying } from "../vn/engine.js";
import { isUnlocked, isClosed } from "./spots.js";
import { openingStatus } from "./spot-hours.js";
import { trainPassengers } from "../motions/train-passengers.js";

const VISITS = {
  ageha: { spotId: "minto", bg: "peppermint" },
  kumicho: { spotId: "adam", bg: "bg_eden_shop" },
  rei: { spotId: "tonari", bg: "bg_tonari_inside" },
};
const sceneId = (id, repeat) => `ch2_city_guest_${id}_${repeat ? "repeat" : "first"}`;
// 2回目からの来店は、繰り返しの回を順に巡回する（2026-11-11 オーナー「推奨で全部」RVE07。神崎・クラウドは3本、あげはは1本のまま）。
// 巡回の位置は `_city_guest_count_<id>`（読み終えた繰り返しの回数）。無い旧保存は0として、従来どおり `_repeat` から。
const REPEATS = Object.freeze({ ageha: ["repeat"], kumicho: ["repeat", "repeat_b", "repeat_c"], rei: ["repeat", "repeat_b", "repeat_c"] });
const repeatIds = id => (REPEATS[id] || ["repeat"]).map(suffix => `ch2_city_guest_${id}_${suffix}`);
const IDS = Object.keys(VISITS).flatMap(id => [sceneId(id, false), ...repeatIds(id)]);
const countKey = id => `_city_guest_count_${id}`;
/** 次に読む場面（初回か、繰り返しの巡回）。保存は変えない。 */
export function cityGuestScene(value, id) {
  if (!value?.flags?.[`_city_guest_seen_${id}`]) return sceneId(id, false);
  const pool = repeatIds(id), count = Number(value.flags[countKey(id)]) || 0;
  return pool[Math.max(0, Math.floor(count)) % pool.length];
}
const dayKey = value => `${value.chapter}:${value.day}`;
let active = false, loading = null;

export function cityGuestVisit() {
  const value = state;
  if (!value || value.phase !== "daily" || value.chapter < 2 || value.slot > 1
      || value.flags._city_guest_day === dayKey(value)) return null;
  const { cameo } = trainPassengers(value, { from: "widehanga", to: "home" });
  if (!VISITS[cameo]) return null;
  const invite = value.pendingInvite;
  if (invite?.sender === cameo && (invite.day ?? value.day) === value.day) return null;
  return { ...VISITS[cameo], id: cameo, owner: value, chapter: value.chapter, day: value.day, slot: value.slot };
}

/** 店が開いているときだけ地図にも来店にも同じ客を出す。 */
export function cityGuestAtShop(spot) {
  const visit = cityGuestVisit();
  if (!visit || !spot || visit.spotId !== spot.id || spot.unavailable
      || !isUnlocked(spot) || isClosed(spot) || !openingStatus(spot, state).ok) return null;
  return visit;
}

async function loadDialogues() {
  if (IDS.every(id => DB.dialogues[id]?.lines?.length)) return;
  if (!loading) loading = (async () => {
    const { CHAPTER_DIALOGUE_FILES } = await import("../core/data.js");
    const { readDialogues } = await import("../core/chapter-data.js");
    Object.assign(DB.dialogues, await readDialogues(CHAPTER_DIALOGUE_FILES.cityGuests, IDS));
  })().finally(() => { loading = null; });
  await loading;
}

/** 入店時の予定を使う。通常の訪問に添え、料金・行動・能力報酬は追加しない。 */
export async function visitCityGuestAtShop(spot, { scheduledVisit = cityGuestAtShop(spot), bg } = {}) {
  if (!scheduledVisit || scheduledVisit.spotId !== spot?.id
      || VISITS[scheduledVisit.id]?.spotId !== spot?.id || active || isPlaying()) return false;
  const visit = scheduledVisit, owner = visit.owner;
  const controller = new AbortController();
  const current = () => state === owner && state.phase === "daily" && state.chapter === visit.chapter && state.day === visit.day
    && state.slot === visit.slot && state.met?.[visit.id] && state.flags._city_guest_day !== dayKey(state)
    && !controller.signal.aborted;
  if (!current()) return false;
  const unsubscribe = on("hud", () => { if (!current()) controller.abort(); });
  active = true;
  try {
    try { await loadDialogues(); }
    catch {
      if (current()) toast("来店中の客の会話を読み込めませんでした。通常の訪問は完了しています");
      return false;
    }
    if (!current()) return false;
    const repeat = !!state.flags[`_city_guest_seen_${visit.id}`];
    const result = await play(cityGuestScene(state, visit.id), {
      bg: bg || `res://assets/backgrounds/${visit.bg}.png`, signal: controller.signal,
    });
    if (!current() || result?.cancelled) return false;
    state.flags[`_city_guest_seen_${visit.id}`] = true;
    if (repeat) state.flags[countKey(visit.id)] = (Number(state.flags[countKey(visit.id)]) || 0) + 1;
    state.flags._city_guest_day = dayKey(state);
    save();
    return true;
  } finally {
    active = false;
    unsubscribe();
    controller.abort();
  }
}
