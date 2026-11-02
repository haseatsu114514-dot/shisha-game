import { craftContinueContext, recordContinueContext, clearContinueHistory } from "./continue-context.js";
// 第1章「煙がつなぐ街（スモーク・アンド・タイズ）」── SMOKE CROWN CUP 編 の台本。
// 章の流れはこのファイルを上から読めば追えるようにしてある（正史: brand/story_and_structure.md 第1章）。
import { el, sleep } from "../core/util.js";
import { playEntrance } from "./tournament-entrance.js";
import { playTournamentArrival } from "./ch1-arrival.js";
import { DB, bgUrl, faceIconUrl, realName, displayName, loadTournamentCraftDialogue } from "../core/data.js";
import { mountColdOpen } from "../scenes/coldopen.js";
import { playTonariOpening } from "../scenes/tonari-opening.js";
import { layers, showScreen, clearScreen, setBg, smokeWipe, dayCard, roundCut, toast, bannersIdle, retire, retireScreen, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { state, save, markMet, setFlag, flag, requestResumeOnBoot } from "../core/state.js";
import { addMoney, maxStamina, addStamina, gainStat } from "../core/stats.js";
import { playBgm, preloadBgm, stopBgm, SE } from "../core/audio.js";
import { play, hooks } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { syncNightQueue, runNightPlan, finishDeferredNights } from "../daily/night-events.js";
import { initHud, showHud, daysLeft } from "../daily/hud.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { chapterDay } from "../core/chapter-clock.js";
import { openPhone, morningMessages } from "../daily/phone.js";
import { radar } from "../daily/status.js";
import { onDialogueEnter } from "../daily/romance.js";
import { recordRomanceChoice, bondCondition } from "../daily/bonds.js";
import { storySeen } from "../daily/spots.js";
import { recordCg } from "../scenes/gallery.js";
import { newSession, openBench, tickerSay, waitBenchReady, runDrill } from "../craft/session.js";
import * as bc from "../craft/broadcast.js";
import { playTournamentEvent } from "../craft/tournament-story.js";
import { servedEvaluationLines } from "../craft/served-eval.js";
import { naruTastingLine } from "../craft/naru-tasting.js";
import { stepSetup, stepMix, stepPack, stepPlace, stepSteamTime, regulationFor } from "../craft/steps.js";
import { stepWater } from "../craft/water-view.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull } from "../craft/pull.js";
import { runCare } from "../craft/care.js";
import { buildGameOver, warmGameOver } from "./gameover.js";
import { captureEntryResources, restoreEntryResources, applyAssistRecovery } from "./tournament-resources.js";
import { runFullPractice, CRAFT_STEPS, recordPractice } from "../craft/practice.js";
import { basicsExperienced, fullPracticeToday, careExperienced, recommendedDrill } from "../craft/practice-history.js";
import { prepareFlavorStock } from "../daily/preparation.js";
import { chooseDrill } from "../daily/tonari.js";
import { warmCraftAssets } from "../craft/readiness.js";
import { playTsumugiStory, playTsumugiSketch } from "./tsumugi-story.js";
import { meetHiyoriAtTonari } from "../daily/hiyori.js";
import { computeShisha, finalize } from "../craft/score.js";
import { outcomeOf, showStandings, resultCountdown, nagumoCutin, resultTable } from "../craft/result.js";
import { playChapterPreview } from "./ch1-preview.js";
import { craftRecognition } from "../craft/recognition.js";
import { playCh1Title } from "./ch1-title-motion.js";
import { giveSumiRig, giveEarlyHomeRig } from "../daily/home-rig.js";
import { configureFirstBrew, firstBrewOrder, rememberFirstBrew, serveFirstBrew } from "./first-brew.js";
import { recordTournamentLoss, chooseRetryAssist } from "./retry-assist.js";

const BG = (name) => `res://assets/backgrounds/${name}.png`;
const TONARI = BG("bg_tonari_inside");
const TONARI_N = BG("bg_tonari_inside_night");
const STAGE = BG("bg_tournament_stage");
const PRIZE = 30000;

// ---------------------------------------------------------------- 会話フック

export function setupHooks() {
  hooks.onEnter = onDialogueEnter; // 告白の返事（accept/reject）・set_romance
  hooks.onCg = recordCg;           // 見たCGはギャラリーで見返せる
  hooks.interpolate = (t) => t.replace(/\{daysLeft\}/g, String(daysLeft() ?? "")).replace(/\{day\}/g, String(chapterDay(state)))
    .replace(/\{tsumugiFollowers\}/g, typeof DB.characters.tsumugi?.art_sns?.followers === "number" ? `${DB.characters.tsumugi.art_sns.followers / 10000}万` : "たくさん")
    .replace(/\{tsumugiContestTheme\}/g, DB.characters.tsumugi?.art_contest?.theme || "記憶と気配の交差")
    .replace(/\{fortuneName\}/g, state.fortune ? displayName(state.fortune.char, state) : "その人"); // 占い師の結果
  // 交友の締めくくり: lover / romance_open。story_seen は固有会話を読んだか（約束・既知の話の分岐）
  hooks.evalCondition = (line) => line.condition_type === "story_seen" ? storySeen(line.dialogue) : bondCondition(line);
  hooks.onChoice = (dialogueId, choiceId, branch, nextId, choice, line) => {
    // 途中の質問・締めくくりの最後の質問（choice.romance＝隠し恋愛値。選択肢 id ごとに一度だけ）
    recordRomanceChoice(line, choice);
    // 下描きの実回答だけを保存する。旧セーブの読了・好感度からは補わない。
    if (dialogueId === "ch1_tsumugi_work_in_progress" && choiceId === "tsumugi_contest_draft"
      && ["draft_window", "draft_hands"].includes(branch)) {
      state.flags._tsumugi_contest_draft_window = branch === "draft_window";
      state.flags._tsumugi_contest_draft_hands = branch === "draft_hands";
      save();
    }
    // 後日の反応は、実際に選んだ接し方とDAY2の読了だけを根拠にする。
    if (dialogueId === "ch1_salaryman_regular" && choiceId === "salaryman_first_serve"
      && ["regular_order", "regular_water"].includes(branch)) {
      state.flags._salaryman_service_order = branch === "regular_order";
      state.flags._salaryman_service_water = branch === "regular_water";
      save();
    }
    // 初回提供の二択の記録。大会後のスミの一言は、才能ルート（顔を見ろと言われた側）を実際に選んだ時だけ変える。
    if (dialogueId === "ch1_tutorial_oneesan" && choiceId === "oneesan_praise_feel"
      && ["op_talent", "op_report"].includes(branch)) {
      state.flags._op_praise_talent = branch === "op_talent";
      state.flags._op_praise_report = branch === "op_report";
      save();
    }
    // 練習を選んだ直後に閉じても、再開時に選択を変えたり接客を飛ばしたりしない。
    if (dialogueId === "remake_tutorial_offer" && branch === "practice") {
      const progress = openingProgress();
      progress.tutorialChoice = branch;
      setFlag("_tutorial_requested");
      save();
    }
    // チョイザップ入会（初月分4,000円。初回キャンペーンで3か月は追加料金なし。3か月後の失効・再課金は未実装で、会員フラグは恒久）
    // 所持金が足りないときは引き落とさず会員化もしない（選択肢の無効化に加えた二重防御。分岐側が会員フラグで成否を読む）
    if (dialogueId === "ch1_choizap_first" && branch === "register" && state.money >= 4000) {
      addMoney(-4000);
      setFlag("_gym_member");
    }
    // 選択だけを保存する。報酬・補正・読了は、実際の練習/会話を終えてから。
    if (dialogueId === "ch1_day7_last_night") {
      state.flags._ch1_eve = { choice: branch };
      save();
    }
    const preparationKey = { remake_preparation_review: "_ch1_early", remake_preparation_retry: "_ch1_early", remake_midcheck_review: "_ch1_mid" }[dialogueId];
    if (preparationKey) {
      (state.flags[preparationKey] ||= {}).choice = branch;
      save();
    }
  };
}

// ---------------------------------------------------------------- 開幕

export async function startNewGame() {
  setupHooks();
  state.flags._ch1_opening = {};
  save();
  if (await openingPart() === false) return;
  await dailyPart();
}

function openingProgress() {
  // 旧版で opening が保存されるのは ch1_opening を読み終えてから。
  // 練習や接客の読了はここから推測せず、残りの場面を実際に読む。
  return state.flags._ch1_opening ||= { introDone: true };
}

async function openingPart() {
  const owner = state;
  const progress = openingProgress();
  clearScreen();
  if (!progress.introDone) {
    stopBgm();
    await setBg(null, { instant: true }); // 先に暗転を置いてから場面を重ねる（後から来た暗転に場面が隠れないように）
    // コールドオープン: 1年後の世界大会の決勝の一瞬（顔も会場の全景も見せない）。
    // 場面は背景レイヤーに置く＝会話の文字より奥（手前に置くと文字が隠れて真っ暗に見えていた）
    const scene = mountColdOpen();
    // Decorative images keep loading alongside narration; decoding them must not
    // hold the first dialogue window (the cold-open lines need no portraits/bg).
    const co = DB.dialogues.ch1_cold_open;
    await play(co ? { ...co, metadata: { ...(co.metadata || {}), effect: "" } } : "ch1_cold_open"); // 下の煙もやは場面側で描く
    scene.stop();
    await sleep(600);
    const titleResult = await playCh1Title();
    if (titleResult.cancelled || state !== owner) return false;
    playBgm("tonari");
    await playTonariOpening();
    progress.introDone = true;
    save();
  }
  playBgm("tonari");
  await playTsumugiStory(1); // 初日に取材と連絡先交換。配達・他店のイベントより先に関係を作る。
  if (!progress.departureDone) {
    await play("ch1_tsumugi_departure", { bg: TONARI });
    progress.departureDone = true;
    save();
  }
  // 旧版で一台を完成済み・新しい注文記録なしなら、接客だけ従来どおり続ける。
  const legacyLesson = flag("_tutorial_done") && !progress.firstOrderDone && !progress.firstBrew;
  if (!legacyLesson && await firstBrewOrder(progress) === false) return false;
  // 冒頭の一台は必修。未完了の旧「skip」保存も、注文済みの配合を使ってレッスンへ戻す。
  // 既に日常へ進んだ保存は openingPart を通らないので、完了した冒頭を繰り返さない。
  if (progress.tutorialChoice === "skip" && !flag("_tutorial_done")) progress.offerDone = false;
  const resumeChoice = progress.tutorialChoice === "practice" || flag("_tutorial_done");
  progress.tutorialChoice = "practice";
  setFlag("_tutorial_requested");
  delete state.flags._tutorial_skipped;
  if (!progress.offerDone) {
    const offer = DB.dialogues.remake_tutorial_offer;
    await play(resumeChoice ? { ...offer, lines: offer.branches.practice, branches: {} } : offer, { bg: TONARI });
    progress.offerDone = true;
    save();
  }
  await tutorial(progress);
  if (!progress.oneesanDone) {
    if (legacyLesson) await play("ch1_tutorial_oneesan", { bg: TONARI });
    else if (await serveFirstBrew(progress) === false) return false;
    progress.oneesanDone = true;
    save();
  }
  state.phase = "daily";
  state.statsAtChapterStart = { ...state.stats };
  save();
}

export async function resumeGame() {
  setupHooks();
  if (state.chapter === 2) return resumeChapterModule(() => import("./ch2.js"), m => m.resumeChapterTwo(), "第2章の街へ戻っています…");
  if (state.chapter === 3) return resumeChapterModule(() => import("./ch3.js"), m => m.resumeChapterThree(), "第3章へ戻っています…");
  if (state.chapter === 4) return resumeChapterModule(() => import("./ch4.js"), m => m.resumeChapterFour(), "第4章へ戻っています…");
  if (state.chapter === 5) return resumeChapterModule(() => import("./ch5.js"), m => m.resumeChapterFive(), "第5章へ戻っています…");
  if (state.phase === "cleared") return showClear();
  if (state.phase === "aftermath") return finishAfterTournament();
  if (state.phase === "tournament" && state.tournament?.victory) return resumeVictory();
  if (state.phase === "tournament") return tournamentDay();
  if (state.phase === "opening" && await openingPart() === false) return;
  await dailyPart();
}

// SAVEからの再開で、次章モジュールの動的 import を軽いロード表示付きで待つ（A-1）。
// 取得に失敗（通信断・デプロイ直後のキャッシュ不整合）しても無反応で止めず、
// 「もう一度試す／タイトルへ戻る」で操作可能に戻す。章の中身の失敗は各章側が扱う。
async function resumeChapterModule(load, run, label) {
  try { return await run(await withLoadingNotice(load(), loadingNotice(label))); }
  catch { return showResumeError(); }
}

function showResumeError() {
  return new Promise(() => {
    // 同じ文書では失敗した import がキャッシュされ、再取得されないブラウザがある。
    // 既存のLOADと同じ起動経路で、保存済みの続きから文書ごと読み直す。
    const reload = (resume) => {
      if (retry.disabled || home.disabled) return;
      retry.disabled = home.disabled = true;
      if (resume) requestResumeOnBoot();
      location.reload();
    };
    const retry = el("button.btn.primary", { text: "もう一度試す", dataset: { test: "resume-retry" }, onclick: () => reload(true) });
    const home = el("button.btn", { text: "タイトルへ戻る", dataset: { test: "resume-title" }, onclick: () => reload(false) });
    const root = el("div.end-screen", [
      el("div.end-title", { text: "続きを読み込めませんでした" }),
      el("div.end-sub", { text: "通信を確認して、もう一度お試しください。確定した進行は残っています。" }),
      el("div.end-actions", [retry, home]),
    ]);
    showScreen("end", root);
    retry.focus({ preventScroll: true });
  });
}

async function dailyPart() {
  syncNightQueue(NIGHT_EVENTS);
  const deferFlags = state.deferredNightEvents.filter((entry) => entry.chapter === state.chapter).flatMap((entry) => entry.doneKeys || []);
  await playTsumugiStory(Math.max(1, state.day - 1), { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N), deferFlags });
  await runDaily({ nightEvents: NIGHT_EVENTS, beforeHomecoming: giveEarlyHomeRig });
  await tournamentDay();
}

// ---------------------------------------------------------------- チュートリアル（スミさんの手本つきの通し）

async function tutorial(progress = null) {
  if (!progress || !flag("_tutorial_done")) {
    await play("remake_tutorial_intro", { bg: TONARI });
    const cs = newSession("tutorial");
    if (progress?.firstOrderDone) configureFirstBrew(cs);
    openBench(cs, { steps: TUTORIAL_STEPS });
    await stepMix(cs);
    await stepPack(cs);
    await runHoles(cs);
    await stepPlace(cs);
    await runHeat(cs);
    await stepSteamTime(cs);
    await runSteamDodge(cs);
    await runPull(cs);
    // 焦がしたら、スミさんが葉を詰め直して吸い出しからやり直す（TH06。レッスンはGAME OVERにしない）。
    while (cs.failed) {
      await play(cs.failed === "burnt" ? "remake_tutorial_burnt" : "remake_tutorial_retry", { bg: TONARI });
      Object.assign(cs, { failed: null, burnt: false, pull: null, pullDone: false, leaf: null });
      openBench(cs, { steps: TUTORIAL_STEPS });
      await runPull(cs);
    }
    recordPractice(cs, "tutorial");
    if (progress?.firstOrderDone) rememberFirstBrew(progress, cs);
    state.flags._tutorial_done = true;
    delete state.flags._tutorial_skipped;
    save();
  }
  if (!progress?.tutorialResultRead) {
    await play("remake_tutorial_result", { bg: TONARI });
    if (progress) progress.tutorialResultRead = true;
    save();
  }
  retire(layers.screen.querySelector(":scope > .bench")); // 次の会話（お姉さん）の後ろに作業台を残さない
}

// ---------------------------------------------------------------- 夜の固定イベント
// pin=マップの「!」印／teaser=前日の就寝時の予感／beat=イベント前のつなぎ一行

const nightScene = (id, bg) => async (context) => {
  const dialogue = DB.dialogues[id];
  if ((bg || dialogue?.metadata?.bg || "").includes("tonari") && dialogue?.lines?.some((line) => line.speaker === "sumi")) await meetHiyoriAtTonari();
  // 配達報告から同じ来店で続く場合だけ、正本の冒頭から再入店の節を除く。
  // DB本体・残りの台詞・分岐・dialogue_idは変更せず、通常訪問には元の台本を使う。
  const opening = dialogue?.lines?.[0];
  const sameVisit = context?.returnedToTonari && id === "ch1_salaryman_regular" && typeof opening?.text === "string";
  const scene = sameVisit ? { ...dialogue, lines: [
    { ...opening, text: "夜のtonari。帰り際、スミさんに「悪い、カウンター頼めるか」と呼び止められた。" },
    ...dialogue.lines.slice(1),
  ] } : id;
  await play(scene, bg ? { bg } : {});
};
// 完成を告げる台詞の後、完成画を提示するところで描画演出を入れる。
const sketchScene = (id, bg) => async () => {
  return await playTsumugiSketch(id, bg);
};
const once = (key, fn) => ({ id: key, doneKeys: [key], run: async (context) => { await fn(context); setFlag(key); }, done: () => flag(key) });

export const NIGHT_EVENTS = {
  2: { label: "常連さんの話", schedule: "regular", pin: "tonari", teaser: "tonari", beat: "夜。常連さんの話を聞きに、tonariへ──", ...once("_ev_salaryman", nightScene("ch1_salaryman_regular", TONARI_N)) },
  3: { id: "_ev_first_practice", doneKeys: ["_tsumugi_contest_progress", "_ev_first_practice"], schedule: "preparation", deadline: 6,
    label: "基礎の確認", pin: "tonari", teaser: "tonari", beat: "夜。つむぎの途中の絵を見にtonariへ。閉店後はスミさんと練習を相談する──",
    done: () => flag("_tsumugi_contest_progress") && flag("_ev_first_practice"),
    run: earlyPractice },
  5: { label: "スミさんの話", schedule: "regular", pin: "tonari", teaser: "tonari", beat: "夜。スミさんの話を聞きに、閉店間際のtonariへ──", ...once("_ev_day5", nightScene("ch1_day5_sumi_story", TONARI_N)) },
  7: { schedule: "preparation", deadline: 12, prerequisites: ["_ev_first_practice", "_tsumugi_contest_progress"],
    label: "中間準備", pin: "tonari", teaser: "tonari", beat: "大会への準備を確かめに、夜のtonariへ──", ...once("_ev_midcheck", midPreparation) },
  9: { label: "出場者説明会", pin: "c_station", teaser: "イベントホール", beat: "夜。C.STATIONと同じビルのイベントホールへ──", ...once("_ev_meet_rivals", nightScene("ch1_meet_rivals", BG("bg_c_station_night"))) },
  10: { label: "常連さんの変化", schedule: "regular", prerequisites: ["_ev_salaryman"], pin: "tonari", teaser: "tonari", beat: "夜。常連さんの様子が気になって、tonariへ──", ...once("_ev_salaryman_change", nightScene("ch1_salaryman_change", TONARI_N)) },
  11: { id: "_ev_tsumugi_sketch", doneKeys: ["_ev_tsumugi_sketch", "_tsumugi_contest_submitted"], label: "つむぎの応募", pin: "tonari", teaser: "tonari", beat: "夜。つむぎが描き終えた絵を見に、閉店間際のtonariへ──",
    done: () => flag("_ev_tsumugi_sketch") && flag("_tsumugi_contest_submitted"),
    run: async () => {
      await playTsumugiStory(11, { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N) });
      setFlag("_ev_tsumugi_sketch");
    } },
  [TOURNAMENT_DAY - 1]: { id: "_ev_rehearsal", doneKeys: ["_ev_last_night", "_tsumugi_contest_eve"], label: "大会前夜", pin: "tonari", teaser: "tonari", beat: "夜。大会前夜のtonariへ。今夜の過ごし方を考える──",
    done: () => flag("_ev_last_night") && flag("_tsumugi_contest_eve"),
    run: async () => {
      await playTsumugiStory(TOURNAMENT_DAY - 1);
      await lastNight();
    } },
};

async function lastNight() {
  // 旧セーブの読了は維持。通し練習がなくても、過ごし方を終えた夜へ戻さない。
  if (flag("_ev_last_night")) return;
  const dialogue = DB.dialogues.ch1_day7_last_night;
  if (!state.flags._ch1_eve?.choice) {
    // 既存のVN選択を使い、分岐会話は実作業の後に読む。
    await play({ ...dialogue, branches: {} }, { bg: TONARI_N });
  }
  const progress = state.flags._ch1_eve;
  if (progress.choice === "practice") await rehearsal(progress);
  if (progress.choice === "drill" && !progress.practiceDone) {
    if (!progress.drill) { progress.drill = await chooseDrill(); save(); }
    beginEvePractice(progress);
    const tier = await runDrill(progress.drill);
    state.best[progress.drill] = Math.max(state.best[progress.drill] ?? -1, tier);
    progress.practiceDone = true;
    save();
  }
  // 報酬キューは分岐の末尾でVNが一度だけ適用する（コード側では加算しない）。
  await play({ dialogue_id: `${dialogue.dialogue_id}_${progress.choice}`, lines: dialogue.branches[progress.choice] }, { bg: TONARI_N });
  state.flags._last_night = progress.choice;
  if (progress.choice === "sleep_early") {
    addStamina(maxStamina() - state.stamina);
    state.flags._home_tonight = true;
    // #2088: 早寝は休養と同じく、溜めた発熱予約を消し、今夜の告白も後回しにする
    delete state.flags._cold_pending;
    delete state.flags._overwork;
    state.flags._eve_slept = state.day;
  }
  setFlag("_ev_last_night");
  save();
}

function beginEvePractice(progress) {
  // 中断した制作は初めから。保存途中の消耗を重ねず、完了済みの制作は呼ばない。
  progress.staminaBefore ??= state.stamina;
  state.stamina = progress.staminaBefore;
  save();
}

// DAY3だけを直列化する。LOAD後の別stateには旧taskを再利用しない。
const earlyPracticeRuns = new WeakMap();
function earlyPractice() {
  const owner = state, chapter = owner.chapter, day = owner.day, slot = owner.slot, phase = owner.phase;
  if (earlyPracticeRuns.has(owner)) return earlyPracticeRuns.get(owner);
  const task = Promise.resolve().then(async () => {
    let progress;
    const requireCurrent = () => {
      if (state !== owner || owner.chapter !== chapter || owner.day !== day || owner.slot !== slot || owner.phase !== phase
        || progress && owner.flags._ch1_early !== progress) {
        throw new DOMException("DAY3 practice owner changed", "AbortError");
      }
    };
    const read = async (scene) => {
      requireCurrent();
      const result = await play(scene, { bg: TONARI_N });
      requireCurrent();
      if (!result || result.cancelled) throw new DOMException("DAY3 dialogue interrupted", "AbortError");
    };
    requireCurrent();
    await playTsumugiStory(3);
    requireCurrent();
    if (flag("_ev_first_practice")) return;
    progress = owner.flags._ch1_early ||= {};
    // 現在の通し制作を提供・講評まで終えた保存なら、同じ一台を作り直さない。
    if (!progress.feedbackRead) {
      if (!progress.practiceDone) {
        if (!progress.choice) {
          const id = basicsExperienced() ? "remake_preparation_review"
            : fullPracticeToday() ? "remake_preparation_retry" : "remake_preparation_first";
          await read(id);
          // 今回のfull-only導線を読み終えた地点を保存する。既存のchoiceを変換しない。
          progress.choice = "full";
          save();
        }
        beginEvePractice(progress);
        const cs = await runFullPractice({ coached: true, adjustments: false, kind: "early",
          isCurrent: () => { requireCurrent(); return true; } });
        requireCurrent();
        // 実runnerは提供記録のない中断時にthrowする。false/cancelも完了へ変えない。
        if (!cs || cs.cancelled || !cs.pullDone) throw new DOMException("DAY3 practice interrupted", "AbortError");
        progress.failed = cs.failed || null;
        progress.practiceDone = true;
        save();
      }
      if (progress.failed) await read("remake_preparation_failed_day3");
      await read("remake_preparation_first_end");
      progress.feedbackRead = true;
      save();
    }
    requireCurrent();
    setFlag("_ev_first_practice");
  }).finally(() => earlyPracticeRuns.delete(owner));
  earlyPracticeRuns.set(owner, task);
  return task;
}

async function midPreparation() {
  const progress = state.flags._ch1_mid ||= {};
  if (!progress.introRead) {
    await play("remake_midcheck_intro", { bg: TONARI_N });
    progress.introRead = true;
    save();
  }
  if (!progress.stockDone) { await prepareFlavorStock(); progress.stockDone = true; save(); }
  if (!progress.choice) {
    if (careExperienced()) await play({ ...DB.dialogues.remake_midcheck_review, branches: {} }, { bg: TONARI_N });
    else { progress.choice = "full"; save(); }
  }
  if (!progress.practiceDone && progress.choice !== "stock") {
    beginEvePractice(progress);
    const cs = await runFullPractice({ kind: "midcheck" });
    progress.failed = cs.failed || null;
    if (cs.failed) progress.midBranch = null;
    else {
      const shisha = computeShisha(cs);
      const score = avgScore(cs.holes.score, cs.heat.score, shisha.craftQuality, cs.careHistory?.[0]?.score, cs.careHistory?.[1]?.score);
      // リハーサルの good / rough 境界で中間講評を二択に分ける。
      progress.midBranch = score >= 68 ? "mid_good" : "mid_rough";
    }
    progress.practiceDone = true;
    save();
  }
  if (!progress.feedbackRead) {
    if (progress.failed) await play("remake_preparation_failed", { bg: TONARI_N });
    const midcheck = DB.dialogues.remake_midcheck;
    const branch = progress.midBranch ? midcheck?.branches?.[progress.midBranch] : undefined;
    // 旧セーブなど分岐記録がない場合は、従来の会話をそのまま読む。
    if (branch) await play({ ...midcheck, lines: [...branch, ...midcheck.lines], branches: {} }, { bg: TONARI_N });
    else await play("remake_midcheck", { bg: TONARI_N });
    progress.feedbackRead = true;
    save();
  }
  // 家シーシャ（#638）: 中盤の修行のあと、スミさんが「これやる」とミャアの卓上台を譲る（一度だけ・途中から再開しても渡す）
  await giveSumiRig({ bg: TONARI_N });
}

// 前日リハーサルは本番と同じ一台＋2回の調整。旧セーブにも仕入れの機会を用意する。
async function rehearsal(progress = null) {
  // 旧 _ev_rehearsal は実制作・結果会話まで完了済み。二台目を強制しない。
  if (progress && flag("_ev_rehearsal") && !progress.practiceDone) return;
  let result = progress?.result;
  if (!progress?.practiceDone) {
    await prepareFlavorStock();
    await play("remake_rehearsal_intro", { bg: TONARI_N });
    if (progress) beginEvePractice(progress);
    const cs = await runFullPractice({ kind: "rehearsal" });
    if (cs.failed) {
      state.rehearsal = "rough";
      result = "burnt";
    } else {
      const shisha = computeShisha(cs);
      const score = avgScore(cs.holes.score, cs.heat.score, shisha.craftQuality, cs.careHistory[0].score, cs.careHistory[1].score);
      result = state.rehearsal = score >= 85 ? "great" : score >= 68 ? "good" : "rough";
    }
    if (progress) {
      Object.assign(progress, { practiceDone: true, result });
      setFlag("_ev_rehearsal"); // 実制作の記録。会話・睡眠・ドリルでは立てない。
      save();
    }
  }
  if (progress?.feedbackRead) return;
  await play(`remake_rehearsal_${result}`, { bg: TONARI_N });
  if (progress) { progress.feedbackRead = true; save(); }
}

// ---------------------------------------------------------------- 大会当日

const STEPS_R1 = CRAFT_STEPS.filter(([id]) => !["pull", "care1", "care2"].includes(id));
// チュートリアルは吸い出し・提供まで同じ作業台で進むため、進捗ヘッダーにも pull を含める（大会R1用の STEPS_R1 とは分ける）。
export const TUTORIAL_STEPS = CRAFT_STEPS.filter(([id]) => !["setup", "care1", "care2"].includes(id));
const STEPS_ALL = CRAFT_STEPS;
// 中間順位の出来栄えは、ある工程の点だけで平均する（ロートスでアルミを飛ばすと穴あけの点が無い）。
const avgScore = (...values) => { const f = values.filter(Number.isFinite); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0; };

async function tournamentDay() {
  await loadTournamentCraftDialogue();
  // DAY14から再開しても、実際に延期した準備だけを本番の前に救済する。
  syncNightQueue(NIGHT_EVENTS, { resting: false });
  await runNightPlan(NIGHT_EVENTS, async () => {
    await play({ dialogue_id: "remake_rest_preparation_catchup", lines: [{ speaker: "", text: "大会に出る前に、スミさんと残っていた準備を確かめた。" }] });
  });
  await playTsumugiStory(TOURNAMENT_DAY - 1, { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N) });
  // 旧セーブでDAY14の日常から再開しても、前夜の会話を落とさず大会へ進める。
  if (state.phase !== "tournament") {
    await prepareFlavorStock();
    await lastNight();
  }
  // SKIPで会場の会話がすぐ終わっても、操作は素材の準備完了まで始めない。
  const assetsReady = warmCraftAssets("tournament");
  clearScreen();
  initHud({});
  if (state.phase !== "tournament") {
    state.phase = "tournament";
    state.day = TOURNAMENT_DAY;
    state.slot = 0;
    showHud(true);
    playBgm("kansetsu_shomei_to_black_coffee");
    await dayCard(`DAY ${TOURNAMENT_DAY}`, "SMOKE CROWN CUP 当日");
    const cheers = morningMessages({ tournamentDay: true });
    if (cheers.length) await openPhone(cheers, { time: "AM 7:40" });
    captureEntryResources(state); // 初回制作前に一度だけ。在庫と体力を同じ境界で保存。
    save();
    toast("大会直前のデータをセーブした");
  }
  showHud(false);
  restoreEntryResources(state);
  applyAssistRecovery(state, state.tournament.retryAssist, maxStamina());
  state.tournament.attempts++;
  for (const id of ["naru", "adam", "minto", "nagumo", "maezono", "dr_kemuri"]) markMet(id);
  void preloadBgm("bgm_tournament_edm");
  void preloadBgm("bgm_tournament_craft");
  void warmGameOver();
  await smokeWipe(() => playBgm("bgm_tournament_wait"), { color: "dark" });
  await playTournamentArrival();
  playBgm("bgm_tournament_edm");
  await play("ch1_tournament_opening", { bg: STAGE });
  const regulation = regulationFor({ mode: "tournament" });
  const challenge = regulation?.flavor === "mint" ? "ミント" : "レモン";
  const source = regulation?.supply ? "葉は主催者が支給します！" : "葉は自分で持ち込むこと！";
  await play({ dialogue_id: "ch1_tournament_rule_recap", lines: [
    { speaker: "pakki", face: "excited", text: `本日の課題はッ！ ${challenge}を2g以上！ ${source}` },
  ] }, { bg: STAGE });
  await withLoadingNotice(assetsReady, loadingNotice("大会の準備をしています…"));
  await entrance();

  // ROUND 1 ── 準備
  playBgm("bgm_tournament_craft");
  const cs = newSession("tournament");
  cs.retryAssist = state.tournament.retryAssist === true;
  await roundCut("ROUND 1", "準備");
  await play("remake_round1_intro", { bg: STAGE });
  await playTournamentEvent(cs, "opening", { bg: STAGE });
  openBench(cs, { steps: STEPS_ALL });
  await waitBenchReady(cs);
  tickerSay("パッキー「さあ4人一斉にスタート！ 制限時間は60分ッ！」");
  // 工程の頭でパッキーが前振り、出来に応じて観客のコメントが流れる（生放送レイヤー）。
  await stepSetup(cs);
  await stepWater(cs);
  bc.block(cs, "mix");
  await stepMix(cs);
  bc.judge(cs, bc.judgeOf(cs.mixInfo.score), "配合");
  bc.block(cs, "pack");
  await stepPack(cs);
  await playTournamentEvent(cs, "packed", { bg: STAGE });
  bc.burst(cs, "good", 1);
  bc.block(cs, "foil");
  await runHoles(cs);
  await stepPlace(cs);
  bc.block(cs, "coalfire");
  await runHeat(cs);
  await stepSteamTime(cs);
  await playTournamentEvent(cs, "waiting", { bg: STAGE });
  bc.block(cs, "steam");
  await runSteamDodge(cs);
  await sleep(900);
  bc.clearComments();
  await play("ch1_tournament_match", { bg: STAGE });
  await play("ch1_tournament_r1_end", { bg: STAGE });
  await showStandings(1, avgScore(cs.holes.score, cs.heat.score), cs);
  await playTournamentEvent(cs, "interlude1", { bg: STAGE });

  // ROUND 2 ── 吸い出し・提供
  await roundCut("ROUND 2", "吸い出し・提供");
  openBench(cs, { steps: STEPS_ALL });
  await waitBenchReady(cs);
  bc.block(cs, "pull");
  if (await runPull(cs) === false) return;
  if (cs.failed) return failedOut(cs.failed, cs);
  // 固定の「個性も薄い」ではなく、実配合と提供時の温度から一口の感想を2行だけ差し込む。
  const served = DB.dialogues.ch1_tournament_served;
  const servedLines = served.lines.slice();
  servedLines.splice(1, 0, ...servedEvaluationLines(cs));
  await play({ ...served, lines: servedLines }, { bg: STAGE });
  cs.tournamentStory.servedAroma = computeShisha(cs).aroma;
  bc.burst(cs, "serve", 1);
  await sleep(900);
  bc.clearComments();
  await play("ch1_tournament_r2_end", { bg: STAGE });
  cs.stats = computeShisha(cs);
  await showStandings(2, avgScore(cs.holes.score, cs.heat.score, cs.stats.craftQuality), cs);
  await playTournamentEvent(cs, "interlude2", { bg: STAGE });

  // ROUND 3・4 ── 同じ一台を2回調整する。温度・炭交換・葉の持ちは連続する。
  for (const round of [1, 2]) {
    await roundCut(`ROUND ${round + 2}`, `調整 ${round}回目`);
    openBench(cs, { steps: STEPS_ALL });
    await waitBenchReady(cs);
    bc.block(cs, "adjust");
    await runCare(cs, { round });
    if (cs.failed) return failedOut(cs.failed, cs);
    await sleep(900);
    bc.clearComments();
    cs.stats = null;
    await play(round === 1 ? "ch1_tournament_r3_end" : "remake_round4_end", { bg: STAGE });
    if (round === 1) await showStandings(3, avgScore(cs.holes.score, cs.heat.score, computeShisha(cs).craftQuality, cs.care.score), cs);
  }

  await playTournamentEvent(cs, "interlude3", { bg: STAGE });

  // 審査は完成品と2回の調整の実績で決まる。
  playBgm("bgm_judging");
  await play("remake_judging_intro", { bg: STAGE });
  finalize(cs);
  await playTournamentEvent(cs, "tasting", { bg: STAGE });
  const out = outcomeOf(cs.total);
  state.tournament.lastRank = out.rank;
  state.tournament.lastTotal = cs.total;
  save();

  if (out.rank === 1) {
    state.tournament.victory = { step: 0, revealed: false };
    save();
    // 南雲の二口 →「もうだめだ」→ 10カウント → プチュン → 南雲の持ち点10が先頭のはじめへ入り、優勝を締める（逆転ではない・#1282）
    // 審査待ちのなるの一言は、実際の調整実績（安定／立て直し／終盤帯外／記録不足）に合わせて差し替える。
    const judging = DB.dialogues.ch1_tournament_judging;
    const judgingLines = judging.lines.map(line =>
      line.cue === "naru_tasting" ? { ...line, text: naruTastingLine(cs) } : line);
    await play({ ...judging, lines: judgingLines }, { bg: STAGE });
    await resultCountdown(cs, out.kind);
    retireScreen(); // カウント画面は次の場面で片付く
    playBgm("bgm_aftermath");
    await nagumoCutin(1);
    await play("ch1_tournament_reveal", { bg: STAGE });
    await resultTable(cs, 1);
    state.tournament.victory.revealed = true;
    save();
    await victory(cs);
  } else {
    await resultCountdown(cs, out.kind);
    retireScreen();
    await nagumoCutin(out.rank);
    await resultTable(cs, out.rank);
    await play("ch1_tournament_defeat", { bg: STAGE });
    await play("remake_defeat_follow", { bg: TONARI_N });
    await showGameOver({ rank: out.rank, cs });
  }
}

/** 入場（ライバル → 主人公）。スミさんの一言つき。共有部品 tournament-entrance.js（#2031） */
const entrance = () => playEntrance(1);

// ---------------------------------------------------------------- 優勝のあと

async function victory(cs) {
  const owner = state;
  // #2088: 優勝後の余韻は長いので、段ごとに保存して途中から再開できるようにする（賞金・能力加算は一度だけ）。
  const v = owner.tournament.victory ||= { step: 0, revealed: true };
  if (!v.paid) {
    clearContinueHistory(owner);
    owner.tournament.retryAssist = false;
    v.comment = (cs ? craftRecognition(cs) : null)?.comment || null;
    addMoney(PRIZE);
    delete owner.tournament.stockSnap;
    delete owner.tournament.entryResources;
    v.paid = true;
    save();
  }
  // スミさんの祝福LIMEは、閉店後のtonariで祝杯を交わす前に届く。tonariへ戻る背景切替の手前で場面を区切る。
  const after = DB.dialogues.ch1_tournament_after;
  const tonariAt = after.lines.findIndex(line => line.type === "bg" && line.bg?.includes("bg_tonari_inside"));
  const lobby = BG("bg_c_station_lobby");
  // 大会後の数日は日常のslotを進めず描く。LOADでも各段の場所・時間を背景から確立する。
  const inScene = (bg, run) => async () => {
    await setBg(bgUrl(bg));
    if (state !== owner) return; // 背景の準備中にLOADされたら、古い会話・電話・報酬を始めない。
    return run();
  };
  const steps = [
    inScene(lobby, () => play({ ...after, lines: after.lines.slice(0, tonariAt) }, { bg: lobby })),
    inScene(lobby, () => openPhone([
      {
        id: "_sys_sumi_scoresheet", sender: "sumi", messages: [
          "おう。優勝、見事だった",
          ...(v.comment ? [v.comment] : []),
          "最後の調整まで、よく作りきったな",
          "今日は喜べ。帰ったら、一緒に一服しよう",
        ], close_label: "……はい。ありがとうございます、スミさん",
      },
    ], { time: "PM 6:52", title: "表彰式のあと" })),
    inScene(TONARI_N, () => play({ ...after, lines: after.lines.slice(tonariAt) })),
    inScene(TONARI_N, () => play("interval_day1_naru_lime")),
    inScene(TONARI_N, () => gainStat("guts", 1)),
    // 優勝の夜。記録を続ける博士の伏線へ。
    inScene(TONARI_N, () => openPhone([
      {
        id: "_sys_unknown_recorded", sender: "???", messages: [
          "本日のあなたの試合データは、すべて記録させていただきました。",
        ], close_label: "……誰？",
      },
    ], { time: "PM 11:47", title: "優勝の夜" })),
    inScene(BG("bg_home_day"), () => play("interval_day1_morning_win")),
    inScene(BG("kemurikusa"), () => play("ch1_naru_promise")),
    inScene(BG("kemurikusa"), () => play("interval_day2_adam_lime")),
    inScene(BG("kemurikusa"), () => gainStat("insight", 1)),
    inScene(TONARI_N, () => play("interval_day5_eve")),
  ];
  while (v.step < steps.length) {
    await steps[v.step]();
    if (state !== owner) return;
    v.step += 1;
    save();
  }
  if (state !== owner) return;
  delete owner.tournament.victory;
  owner.phase = "aftermath";
  save();
  await finishAfterTournament();
}

/** #2088: 優勝確定後に閉じたセーブは、大会を作り直さず余韻の続きから */
async function resumeVictory() {
  const owner = state;
  clearScreen(); // LOADを選んだタイトルを、続きのLIMEの背後にも残さない。
  showHud(false);
  playBgm("bgm_aftermath");
  const v = owner.tournament.victory;
  if (!v.revealed) {
    await nagumoCutin(1);
    if (state !== owner) return;
    await play("ch1_tournament_reveal", { bg: STAGE });
    if (state !== owner) return;
    v.revealed = true;
    save();
  }
  if (state !== owner) return;
  await victory(null);
}

async function finishAfterTournament() {
  const owner = state;
  showHud(false);
  state.restDay = null; // 大会を終え、体調が戻った後の補完。発病当日の参加はここまで。
  setFlag("_rest_after_tournament");
  await finishDeferredNights(NIGHT_EVENTS, async () => {
    await play({ dialogue_id: "remake_rest_after_tournament", lines: [{ speaker: "", text: "大会を終えて、体調が戻った後。休養で見送ったtonariの予定を、改めて訪ねた。" }] });
  });
  if (state !== owner) return;
  delete state.flags._rest_after_tournament;
  owner.phase = "cleared";
  save();
  await bannersIdle();
  if (state !== owner) return;
  await showClear();
}

export async function showClear() {
  const owner = state;
  playBgm("bgm_aftermath");
  showHud(false);
  await setBg(bgUrl("bg_tonari_inside", "night"), { tint: "dim" });
  if (state !== owner) return;
  let playing = false;
  const next = el("button.btn.primary", { text: "第2章へ進む", dataset: { test: "end-chapter2" }, onclick: async () => {
    if (playing || !root.isConnected || state !== owner) return;
    playing = true; next.disabled = true; replay.disabled = true;
    try {
      const chapter = await withLoadingNotice(import("./ch2.js"), loadingNotice("第2章の街へ向かっています…"));
      if (root.isConnected && state === owner) await chapter.beginChapterTwo();
    } catch { toast("第2章を読み込めなかった。通信を確認して、もう一度試してください"); }
    finally { playing = false; next.disabled = false; replay.disabled = false; }
  } });
  const replay = el("button.btn.primary", { text: "次回予告をもう一度", dataset: { test: "end-preview" } });
  const root = el("div.end-screen.clear", [
    el("div.end-title", { text: "第1章 クリア" }),
    el("div.end-sub", { text: "SMOKE CROWN CUP 優勝 ── 勝ちは、始まりだった。" }),
    el("div.end-body", [
      el("div.end-radar", [radar(state.stats, state.statsAtChapterStart, 300)]),
      el("div.end-notes", [
        el("p", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
        el("div.next-teaser", [el("small", { text: "NEXT CHAPTER" }), el("b", { text: "第二章『才能の壁』" }), el("span", { text: "ホロウ・クラウン / HAZE: OPEN CLOUD 編" })]),
      ]),
    ]),
    el("p.clear-last-line", { text: "あなたの煙は、誰に届いている？" }),
    el("div.end-actions", [next, replay, el("button.btn", { text: "タイトルへ", dataset: { test: "end-title" }, onclick: () => location.reload() })]),
  ]);
  showScreen("end", root);
  async function preview(first = false) {
    if (playing || !root.isConnected) return;
    playing = true; replay.disabled = true; next.disabled = true;
    const controller = new AbortController();
    const observer = new MutationObserver(() => { if (!root.isConnected) controller.abort(); });
    observer.observe(layers.screen, { childList: true });
    let result;
    try { result = await playChapterPreview({ signal: controller.signal }); }
    finally { observer.disconnect(); }
    if (first && root.isConnected && ["completed", "skipped"].includes(result) && state === owner && state.phase === "cleared") {
      state.flags._ch1_preview_seen = true;
      save();
    }
    playing = false; replay.disabled = false; next.disabled = false;
    if (root.isConnected) {
      playBgm("bgm_aftermath");
      replay.focus({ preventScroll: true });
    }
  }
  replay.addEventListener("click", () => preview(false));
  if (!flag("_ch1_preview_seen")) await preview(true);
}

/** 一台を焦がした大会は、審査を待たずにその場でGAME OVER（TH06）。再挑戦は通常の敗北と同じ。 */
/** 一台がダメになった大会は、審査を待たずにその場でGAME OVER（TH06・TH18〜TH20）。 */
async function failedOut(reason, cs) {
  bc.clearComments();
  save();
  await smokeWipe(() => showGameOver({ reason, cs }), { color: "dark" });
}

/**
 * 大会コンティニュー。スミさん3台本／交際中の恋人が語りかけ、選択後の一言を見せる。
 * 声なしの立ち絵・字幕・SE・BGMを gameover.js から制御し、再挑戦なら大会の頭へ。
 */
async function showGameOver({ rank = 0, reason = "rank", variant = null, cs = null, preview = false } = {}) {
  const owner = state;
  const tournament = owner?.tournament;
  if (!preview && state?.phase === "tournament") {
    recordTournamentLoss(state.tournament);
    save();
  }
  await warmGameOver(); // BGM・表情・枠の準備中は選択期限を消費しない。
  if (state !== owner) return; // 準備待ち中にLOADした旧画面を、新しい保存の上へ出さない。
  showHud(false);
  stopBgm();
  SE.miss();
  const root = buildGameOver({
    reason, rank, variant,
    context: !preview && owner?.phase === "tournament"
      ? recordContinueContext(owner, owner.tournament, owner.tournament.attempts, craftContinueContext(cs, { chapter: 1, reason, rank }))
      : craftContinueContext(cs, { chapter: 1, reason, rank }),
    onRetry: async () => {
      if (!owner) { location.reload(); return; }
      const assisted = await chooseRetryAssist(tournament, () => state === owner && owner.tournament === tournament && root.isConnected);
      if (assisted === null) { if (state === owner && root.isConnected) await showGameOver({ reason, rank, cs, variant: root.continueVariant, preview }); return; }
      if (state !== owner || !root.isConnected) return;
      save();
      retire(root);
      smokeWipe(() => { if (state === owner) tournamentDay(); }, { color: "dark" });
    },
    onTitle: () => location.reload(),
  });
  showScreen("end", root);
}

/** 開発用: 大会当日から始める（__remake.dev.tournament()） */
export function devTournament() {
  setupHooks();
  return tournamentDay();
}

/** テスト用: レッスン（スミさんの手本つきの通し）と前日リハーサルを単体で始める */
export function devTutorial() {
  setupHooks();
  return tutorial();
}
export function devRehearsal() {
  setupHooks();
  return rehearsal();
}
/** テスト・確認用: 大会のGAME OVER画面だけを出す（reason: rank / burnt / cold / leaf） */
export function devGameOver(reason = "burnt", rank = 2, variant = null) {
  setupHooks();
  return showGameOver({ reason, rank, variant, preview: true });
}
