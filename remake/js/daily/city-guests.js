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
const IDS = Object.keys(VISITS).flatMap(id => [sceneId(id, false), sceneId(id, true)]);
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
    const { readDialogues } = await import("../chapters/ch2-city-data.js");
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
    const result = await play(sceneId(visit.id, !!state.flags[`_city_guest_seen_${visit.id}`]), {
      bg: bg || `res://assets/backgrounds/${visit.bg}.png`, signal: controller.signal,
    });
    if (!current() || result?.cancelled) return false;
    state.flags[`_city_guest_seen_${visit.id}`] = true;
    state.flags._city_guest_day = dayKey(state);
    save();
    return true;
  } finally {
    active = false;
    unsubscribe();
    controller.abort();
  }
}
