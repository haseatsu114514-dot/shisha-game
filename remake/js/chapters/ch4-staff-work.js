// 会場の仕事を既存の日常の固定夜と、世界大会のcheckpointへつなぐ薄い表示アダプタ。
import { state, save } from "../core/state.js";
import { DB, bgUrl, CHAPTER_DIALOGUE_FILES } from "../core/data.js";
import { readDialogues } from "../core/chapter-data.js";
import { setBg, showScreen, retireScreen } from "../core/ui.js";
import { play, hooks } from "../vn/engine.js";
import { newSession, openBench, waitBenchReady, benchRoot } from "../craft/session.js";
import { evaluateMix } from "../craft/steps.js";
import { runCare } from "../craft/pull.js";
import { temperatureAfterSteam } from "../craft/conditions.js";
import { ensureFlavorLife } from "../craft/flavor-life.js";
import { CH4_STAFF_IDS, CH4_STAFF_SCENE_FILES, CH4_STAFF_BG, chapterFourStaffNight,
  chapterFourStaffSceneAllowed, chapterFourStaffDialogue, recordChapterFourStaffChoice,
  completeChapterFourStaffScene, runChapterFourStaffNight } from "./ch4-staff-work-progress.js";

export async function loadChapterFourStaffDialogues() {
  const ids = CH4_STAFF_SCENE_FILES.ch4_staff_work;
  if (ids.every(id => DB.dialogues[id]?.lines?.length)) return;
  Object.assign(DB.dialogues, await readDialogues(CHAPTER_DIALOGUE_FILES.ch4Staff, ids));
}

async function readStaffScene(id, { isCurrent = () => true } = {}) {
  const owner = state, live = () => state === owner && isCurrent();
  if (!live() || !chapterFourStaffSceneAllowed(owner, id)) return false;
  await loadChapterFourStaffDialogues();
  if (!live()) return false;
  const source = chapterFourStaffDialogue(owner, DB.dialogues[id]);
  const bg = bgUrl(id === CH4_STAFF_IDS.notice ? "bg_dubai_inn_night" : CH4_STAFF_BG);
  showScreen("none", null);
  await setBg(bg);
  if (!live()) return false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  window.addEventListener("pagehide", abort, { once: true });
  const previous = hooks.onChoice;
  const onChoice = (...args) => {
    previous?.(...args);
    if (live() && !controller.signal.aborted && args[0] === id
      && recordChapterFourStaffChoice(owner, id, args[1], args[2])) save();
  };
  hooks.onChoice = onChoice;
  try {
    const result = await play(source, { bg, signal: controller.signal });
    return live() && !controller.signal.aborted && !!result && !result.cancelled;
  } finally {
    if (hooks.onChoice === onChoice) hooks.onChoice = previous;
    window.removeEventListener("pagehide", abort);
  }
}

/** 店の仕込みを引き受け、一度だけ熱を整える。葉・私物・体力・経験値は使わない。 */
export async function adjustChapterFourStaffService(choice, { isCurrent = () => true, menuButton } = {}) {
  const owner = state, live = () => state === owner && isCurrent();
  if (!live()) return null;
  const cs = newSession("tutorial");
  cs.serviceRecipient = "共用ブースのお客さん";
  cs.venueBg = CH4_STAFF_BG;
  cs.venueLabel = "共用ブース";
  cs.audienceIds = [];
  cs.lessonHelp = { care: {
    brief: "客が話してくれた希望に合わせ、一度だけ調整する",
    detail: choice === "sweetness" ? "甘さは控えめ。炭の数と置き方を決め、茶の香りを確かめてから戻す"
      : "軽い吸い心地の希望。炭の数と置き方を決め、最低一口で確かめてから戻す",
  } };
  cs.eventTitle = "共用ブースの一台";
  cs.eventNote = "注文を聞いた客へ、一度だけ調整して戻す";
  cs.practiceScope = "care";
  cs.equip = { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" };
  const mixes = { sakura: { sakura: 3, black_tea: 9 }, peach: { peach: 4, black_tea: 8 }, tea: { black_tea: 12 } };
  cs.mix = { ...(mixes[owner.flags._ch4_strategy] || mixes.tea) };
  cs.mixInfo = evaluateMix(cs);
  cs.pack = "normal";
  cs.place = "triangle";
  cs.holes = { total: 24, outer: 24, middle: 0, inner: 0 };
  cs.heat = { heatPower: 50 };
  cs.steamSeconds = 480;
  cs.practiceSource = { temperature: temperatureAfterSteam(cs, cs.steamSeconds, 0) };
  ensureFlavorLife(cs);
  openBench(cs, { steps: [["care1", "一度の調整"]] });
  await waitBenchReady(cs);
  if (!live()) return null;
  if (menuButton) benchRoot(cs)?.querySelector(".bench-top")?.append(menuButton());
  await runCare(cs, { round: 1 });
  if (!live()) return null;
  retireScreen();
  return cs;
}

/** 昼夜の行動後に追加消費なしで読む。既存のFESTA等の期限や任意試作には触れない。 */
export function chapterFourStaffNightEvent(options = {}) {
  const owner = state, event = chapterFourStaffNight(owner);
  if (!event) return null;
  const live = () => state === owner && (options.isCurrent?.() ?? true);
  return {
    id: `dubai-staff:${event.id}`, schedule: "fixed", pin: null, label: event.label, beat: event.beat,
    done: () => chapterFourStaffNight(owner)?.id !== event.id,
    run: async () => {
      const finished = await runChapterFourStaffNight(owner, { read: id => readStaffScene(id, { isCurrent: live }),
        adjust: choice => adjustChapterFourStaffService(choice, { ...options, isCurrent: live }), save, isCurrent: live });
      // runNightPlan は戻り値を判定しない。未読の夜を消費して翌日へ送らない。
      if (!finished || !live()) throw new DOMException("Dubai staff work interrupted", "AbortError");
      return true;
    },
  };
}

/** 大会の一台の途中の短い記憶／結果後の片づけ。未体験・既読ならそのまま続ける。 */
export async function readChapterFourStaffCheckpoint(id, options = {}) {
  const owner = state;
  if (!chapterFourStaffSceneAllowed(owner, id)) return true;
  if (!await readStaffScene(id, options) || state !== owner || !(options.isCurrent?.() ?? true)) return false;
  if (!completeChapterFourStaffScene(owner, id)) return false;
  save();
  return true;
}
