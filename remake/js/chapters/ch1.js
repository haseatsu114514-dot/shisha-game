// 第1章「一吸目（ファーストドロー）」── SMOKE CROWN CUP 編 の台本。
// 章の流れはこのファイルを上から読めば追えるようにしてある（正史: brand/story_and_structure.md 第1章）。
import { el, sleep } from "../core/util.js";
import { DB, bgUrl, sceneBg, faceIconUrl, realName, displayName } from "../core/data.js";
import { mountColdOpen } from "../scenes/coldopen.js";
import { layers, showScreen, clearScreen, setBg, smokeWipe, chapterTitle, dayCard, roundCut, toast, bannersIdle, retire, retireScreen } from "../core/ui.js";
import { state, save, markMet, setFlag, flag, timeOfDay } from "../core/state.js";
import { sketchIn } from "../core/scene-motions.js";
import { addMoney, maxStamina, addStamina } from "../core/stats.js";
import { playBgm, preloadBgm, stopBgm, SE } from "../core/audio.js";
import { play, hooks } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { initHud, showHud, daysLeft } from "../daily/hud.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { openPhone, morningMessages } from "../daily/phone.js";
import { ownsFlavor, flavorStock, addFlavorStock, SHOP_FLAVORS } from "../daily/shop.js";
import { radar } from "../daily/status.js";
import { onDialogueEnter, maybeShuraba } from "../daily/romance.js";
import { recordRomanceChoice, bondCondition } from "../daily/bonds.js";
import { storySeen } from "../daily/spots.js";
import { recordCg } from "../scenes/gallery.js";
import { newSession, openBench, tickerSay } from "../craft/session.js";
import * as bc from "../craft/broadcast.js";
import { stepSetup, stepConcept, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull } from "../craft/pull.js";
import { runCare } from "../craft/care.js";
import { buildGameOver } from "./gameover.js";
import { runTrial } from "../craft/trial.js";
import { playTsumugiStory } from "./tsumugi-story.js";
import { meetHiyoriAtTonari } from "../daily/hiyori.js";
import { computeShisha, finalize } from "../craft/score.js";
import { outcomeOf, showStandings, resultCountdown, nagumoCutin, resultTable } from "../craft/result.js";

const BG = (name) => `res://assets/backgrounds/${name}.png`;
const TONARI = BG("bg_tonari_inside");
const TONARI_N = BG("bg_tonari_inside_night");
const STAGE = BG("bg_tournament_stage");
const PRIZE = 30000;

// ---------------------------------------------------------------- 会話フック

export function setupHooks() {
  hooks.onEnter = onDialogueEnter; // 告白の返事（accept/reject）・set_romance
  hooks.onCg = recordCg;           // 見たCGはギャラリーで見返せる
  hooks.interpolate = (t) => t.replace(/\{daysLeft\}/g, String(daysLeft())).replace(/\{day\}/g, String(state.day))
    .replace(/\{tsumugiFollowers\}/g, typeof DB.characters.tsumugi?.art_sns?.followers === "number" ? `${DB.characters.tsumugi.art_sns.followers / 10000}万` : "たくさん")
    .replace(/\{tsumugiContestTheme\}/g, DB.characters.tsumugi?.art_contest?.theme || "日常の風景")
    .replace(/\{fortuneName\}/g, state.fortune ? displayName(state.fortune.char, state) : "その人"); // 占い師の結果
  // 交友の締めくくり: lover / romance_open。story_seen は固有会話を読んだか（約束・既知の話の分岐）
  hooks.evalCondition = (line) => line.condition_type === "story_seen" ? storySeen(line.dialogue) : bondCondition(line);
  hooks.onChoice = (dialogueId, choiceId, branch, nextId, choice, line) => {
    // 途中の質問・締めくくりの最後の質問（choice.romance＝隠し恋愛値。選択肢 id ごとに一度だけ）
    recordRomanceChoice(line, choice);
    // チョイザップ入会（月額4,000円）
    if (dialogueId === "ch1_choizap_first" && branch === "register") {
      addMoney(-4000);
      setFlag("_gym_member");
    }
    // 大会前夜の過ごし方（練習=本番に小ボーナス／スミさん=根性／早寝=体力全快）
    if (dialogueId === "ch1_day7_last_night") {
      state.flags._last_night = branch;
      if (branch === "sleep_early") addStamina(maxStamina() - state.stamina);
    }
  };
}

// ---------------------------------------------------------------- 開幕

export async function startNewGame() {
  setupHooks();
  clearScreen();
  stopBgm();
  await setBg(null, { instant: true }); // 先に暗転を置いてから場面を重ねる（後から来た暗転に場面が隠れないように）
  // コールドオープン: 1年後の世界大会の決勝の一瞬（顔も会場の全景も見せない）。
  // 場面は背景レイヤーに置く＝会話の文字より奥（手前に置くと文字が隠れて真っ暗に見えていた）
  const scene = mountColdOpen();
  const co = DB.dialogues.ch1_cold_open;
  await play(co ? { ...co, metadata: { ...(co.metadata || {}), effect: "" } } : "ch1_cold_open"); // 下の煙もやは場面側で描く
  scene.stop();
  await sleep(600);
  await chapterTitle({ no: "第一章", name: "一吸目", read: "ファーストドロー ── FIRST DRAW", sub: "SMOKE CROWN CUP 編" });
  playBgm("tonari");
  await play("ch1_opening", { bg: TONARI });
  save();
  await playTsumugiStory(1); // 初日に取材と連絡先交換。配達・他店のイベントより先に関係を作る。
  await play("ch1_tsumugi_departure", { bg: TONARI });
  await play("remake_tutorial_offer", { bg: TONARI });
  if (flag("_tutorial_requested")) await tutorial();
  else setFlag("_tutorial_skipped");
  await play("ch1_tutorial_oneesan", { bg: TONARI });
  state.phase = "daily";
  state.statsAtChapterStart = { ...state.stats };
  save();
  await dailyPart();
}

export async function resumeGame() {
  setupHooks();
  if (state.phase === "cleared") return showClear();
  if (state.phase === "tournament") return tournamentDay();
  if (state.phase === "opening") state.phase = "daily";
  await dailyPart();
}

async function dailyPart() {
  await playTsumugiStory(Math.max(1, state.day - 1), { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N) });
  await runDaily({ nightEvents: NIGHT_EVENTS });
  await tournamentDay();
}

// ---------------------------------------------------------------- チュートリアル（スミさんの手本つきの通し）

async function tutorial() {
  await play("remake_tutorial_intro", { bg: TONARI });
  const cs = newSession("tutorial");
  openBench(cs, { steps: STEPS_R1.filter(([id]) => id !== "setup" && id !== "concept") });
  await stepMix(cs);
  await stepPack(cs);
  await runHoles(cs);
  await runHeat(cs);
  await stepPlace(cs);
  await stepSteamTime(cs);
  await runSteamDodge(cs);
  await runPull(cs);
  // 焦がしたら、スミさんが葉を詰め直して吸い出しからやり直す（TH06。レッスンはGAME OVERにしない）。
  while (cs.failed) {
    await play("remake_tutorial_burnt", { bg: TONARI });
    Object.assign(cs, { failed: null, burnt: false, pull: null, pullDone: false, leaf: null });
    openBench(cs, { steps: STEPS_R1.filter(([id]) => id !== "setup" && id !== "concept") });
    await runPull(cs);
  }
  state.flags._tutorial_done = true;
  delete state.flags._tutorial_skipped;
  await play("remake_tutorial_result", { bg: TONARI });
  retire(layers.screen.querySelector(":scope > .bench")); // 次の会話（お姉さん）の後ろに作業台を残さない
}

// ---------------------------------------------------------------- 夜の固定イベント
// pin=マップの「!」印／teaser=前日の就寝時の予感／beat=イベント前のつなぎ一行

const nightScene = (id, bg) => async () => {
  const dialogue = DB.dialogues[id];
  if ((bg || dialogue?.metadata?.bg || "").includes("tonari") && dialogue?.lines?.some((line) => line.speaker === "sumi")) await meetHiyoriAtTonari();
  await play(id, bg ? { bg } : {});
};
// つむぎのスケッチ: 紙の上に鉛筆の線で店が描かれ、色が乗ってから会話へ
const sketchScene = (id, bg) => async () => {
  const art = sceneBg(bg, timeOfDay());
  await sketchIn(async () => { if (art.url) await setBg(art.url, { tint: art.tint }); }, art.url);
  await play(id, { bg });
};
const once = (key, fn) => ({ run: async () => { setFlag(key); await fn(); }, done: () => flag(key) });

const NIGHT_EVENTS = {
  2: { pin: "tonari", teaser: "tonari", beat: "夜、tonariに顔を出す──", ...once("_ev_salaryman", nightScene("ch1_salaryman_regular", TONARI_N)) },
  3: { pin: "tonari", teaser: "tonari", beat: "閉店前、つむぎが途中の絵を見せに来た──",
    done: () => flag("_tsumugi_contest_progress"), run: () => playTsumugiStory(3) },
  4: { pin: null, teaser: "帰り道", beat: "買い出しの帰り道──", ...once("_ev_ageha_cameo", nightScene("ch1_ageha_encounter", BG("bg_street_night"))) },
  5: { pin: "tonari", teaser: "tonari", beat: "閉店後の店に、もう少しだけ残る──", ...once("_ev_day5", nightScene("ch1_day5_sumi_story", TONARI_N)) },
  7: { pin: "tonari", teaser: "tonari", beat: "大会まで、ちょうど折り返し──", ...once("_ev_midcheck", nightScene("remake_midcheck")) },
  9: { pin: "c_station", teaser: "C.STATION", beat: "夜。C.STATIONで出場者説明会──", ...once("_ev_meet_rivals", nightScene("ch1_meet_rivals", BG("bg_c_station_night"))) },
  10: { pin: "tonari", teaser: "tonari", beat: "帰り道、tonariに寄っていく──", ...once("_ev_salaryman_change", nightScene("ch1_salaryman_change", TONARI_N)) },
  12: { pin: "tonari", teaser: "tonari", beat: "閉店間際、つむぎが描き終えた絵を開く──",
    done: () => flag("_ev_tsumugi_sketch") && flag("_tsumugi_contest_submitted"),
    run: async () => {
      await playTsumugiStory(12, { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N) });
      setFlag("_ev_tsumugi_sketch");
    } },
  [TOURNAMENT_DAY - 1]: { pin: "tonari", teaser: "tonari", beat: "夜。店の作業台で、前日リハーサル──",
    done: () => flag("_ev_rehearsal") && flag("_ev_last_night") && flag("_tsumugi_contest_eve"),
    run: async () => {
      await playTsumugiStory(TOURNAMENT_DAY - 1);
      if (!flag("_ev_rehearsal")) await once("_ev_rehearsal", rehearsal).run();
      await lastNight();
    } },
};

async function lastNight() {
  if (!flag("_ev_last_night")) await once("_ev_last_night", nightScene("ch1_day7_last_night", BG("bg_home_night"))).run();
}

// 前日リハーサル: 本番と同じ工程を通す（コンセプトと審査は無し）。出来が本番の小ボーナスになる
async function rehearsal() {
  await play("remake_rehearsal_intro", { bg: TONARI_N });
  const cs = newSession("rehearsal");
  openBench(cs, { steps: STEPS_R1.filter(([id]) => id !== "concept").concat([["pull", "PULL"]]) });
  await stepSetup(cs);
  await stepMix(cs);
  await stepPack(cs);
  await runHoles(cs);
  await runHeat(cs);
  await stepPlace(cs);
  await stepSteamTime(cs);
  await runSteamDodge(cs);
  await runPull(cs);
  // 焦がした通しは手応えなし。スミさんの一言で終わり、本番の加点もない（TH06）。
  if (cs.failed) {
    state.rehearsal = "rough";
    await play("remake_rehearsal_burnt", { bg: TONARI_N });
    return;
  }
  const s = computeShisha(cs);
  const score = (cs.holes.score + cs.heat.score + s.craftQuality) / 3;
  state.rehearsal = score >= 85 ? "great" : score >= 68 ? "good" : "rough";
  await play(`remake_rehearsal_${state.rehearsal}`, { bg: TONARI_N });
}

// ---------------------------------------------------------------- 大会当日

const STEPS_R1 = [["setup", "SETUP"], ["concept", "CONCEPT"], ["mix", "MIX"], ["pack", "PACK"], ["holes", "FOIL"], ["heat", "HEAT"], ["place", "SET"], ["steam", "STEAM"]];
const STEPS_ALL = [...STEPS_R1, ["pull", "PULL"], ["care", "CARE"], ["trial", "TRIAL"]];

async function tournamentDay() {
  await playTsumugiStory(TOURNAMENT_DAY - 1, { sketch: sketchScene("ch1_tsumugi_sketch", TONARI_N) });
  // 旧セーブでDAY14の日常から再開しても、前夜の会話を落とさず大会へ進める。
  if (state.phase !== "tournament") await lastNight();
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
    // 本番用フレーバーを仕入れていなければ、スミさんのお情け（強制購入はしない）
    const stocked = SHOP_FLAVORS.some((id) => id !== "double_apple" && ownsFlavor(id));
    await play(stocked ? "remake_flavor_brought" : "remake_flavor_rescue", { bg: TONARI });
    if (!stocked && flavorStock("double_apple") < 12) addFlavorStock("double_apple", 12 - flavorStock("double_apple")); // スミさんの「一回分」
    state.tournament.stockSnap = { ...state.flavorStock }; // 再挑戦は大会の頭から＝持ち込み在庫も会場入り前に戻す
    save();
    toast("大会直前のデータをセーブした");
  }
  showHud(false);
  if (state.tournament.stockSnap) state.flavorStock = { ...state.tournament.stockSnap };
  state.tournament.attempts++;
  for (const id of ["naru", "adam", "minto", "nagumo", "maezono", "dr_kemuri"]) markMet(id);
  void preloadBgm("bgm_tournament_edm");
  void preloadBgm("bgm_tournament_craft");
  await smokeWipe(() => playBgm("bgm_tournament_wait"), { color: "dark" });
  await play("ch1_tournament_arrival");
  await maybeShuraba(); // 恋人が2人以上いたら、ロビーで鉢合わせる
  playBgm("bgm_tournament_edm");
  await play("ch1_tournament_opening", { bg: STAGE });
  await entrance();

  // ROUND 1 ── 組み立て
  playBgm("bgm_tournament_craft");
  const cs = newSession("tournament");
  await roundCut("ROUND 1", "組み立て");
  await play("remake_round1_intro", { bg: STAGE });
  openBench(cs, { steps: STEPS_ALL });
  tickerSay("パッキー「さあ4人一斉にスタート！ 制限時間は60分ッ！」");
  // 工程の頭でパッキーが前振り、出来に応じて観客のコメントが流れる（生放送レイヤー）。点数は作業台の SCORE に入る
  await stepSetup(cs);
  bc.block(cs, "theme");
  await stepConcept(cs);
  bc.block(cs, "mix");
  await stepMix(cs);
  bc.judge(cs, bc.judgeOf(cs.mixInfo.score), "配合");
  bc.block(cs, "pack");
  await stepPack(cs);
  bc.burst(cs, "good", 1);
  bc.block(cs, "foil");
  await runHoles(cs);
  bc.judge(cs, bc.judgeOf(cs.holes.score), "穴あけ");
  bc.block(cs, "coalfire");
  await runHeat(cs);
  bc.judge(cs, bc.judgeOf(cs.heat.score), "炭");
  await stepPlace(cs);
  await stepSteamTime(cs);
  bc.block(cs, "steam");
  await runSteamDodge(cs);
  bc.judge(cs, bc.judgeOf(cs.steam.score), "蒸らし");
  await sleep(900);
  bc.clearComments();
  await play("ch1_tournament_match", { bg: STAGE });
  await play("ch1_tournament_r1_end", { bg: STAGE });
  await showStandings(1, (cs.holes.score + cs.heat.score) / 2);

  // ROUND 2 ── 吸い出し・提供
  await roundCut("ROUND 2", "吸い出し・提供");
  openBench(cs, { steps: STEPS_ALL });
  bc.block(cs, "pull");
  await runPull(cs);
  if (cs.failed) return failedOut(cs.failed);
  bc.judge(cs, bc.judgeOf(cs.pull.score), "提供");
  bc.burst(cs, "serve", 1);
  await sleep(900);
  bc.clearComments();
  await play("ch1_tournament_r2_end", { bg: STAGE });
  cs.stats = computeShisha(cs);
  await showStandings(2, (cs.holes.score + cs.heat.score + cs.stats.craftQuality) / 3);

  // ROUND 3 ── 熱管理
  await roundCut("ROUND 3", "熱管理");
  openBench(cs, { steps: STEPS_ALL });
  bc.block(cs, "adjust");
  await runCare(cs);
  if (cs.failed) return failedOut(cs.failed);
  bc.judge(cs, bc.judgeOf(cs.care.score), "熱管理");
  await sleep(900);
  bc.clearComments();
  cs.stats = null;
  await play("ch1_tournament_r3_end", { bg: STAGE });

  // 審査 ── FLAVOR TRIAL
  playBgm("bgm_tournament_wait"); // 審査曲は未確定。制作曲とは分けて従来の代用を使う。
  await play("remake_trial_intro", { bg: STAGE });
  openBench(cs, { steps: STEPS_ALL });
  await runTrial(cs);
  finalize(cs);
  const out = outcomeOf(cs.total);
  state.tournament.lastRank = out.rank;
  state.tournament.lastTotal = cs.total;
  save();

  if (out.rank === 1) {
    // 南雲の二口 →「もうだめだ」→ 10カウント → プチュン → 南雲の持ち点10一括投入 → 優勝
    await play("ch1_tournament_judging", { bg: STAGE });
    await resultCountdown(cs, out.kind);
    retireScreen(); // カウント画面は次の場面で片付く
    playBgm("bgm_result_emotional");
    await nagumoCutin(1);
    await play("ch1_tournament_reveal", { bg: STAGE });
    await resultTable(cs, 1);
    await victory();
  } else {
    await resultCountdown(cs, out.kind);
    retireScreen();
    await nagumoCutin(out.rank);
    await resultTable(cs, out.rank);
    await play("ch1_tournament_defeat", { bg: STAGE });
    await play("remake_defeat_follow", { bg: TONARI_N });
    await showGameOver({ rank: out.rank });
  }
}

/** 入場（ライバル → 主人公）。スミさんの一言つき。自動で送られる */
async function entrance() {
  const cards = [
    { id: "naru", ring: "孤高の探求者", note: "なる……人格者だが、煙は別人だ。基礎が異常に堅い" },
    { id: "adam", ring: "ダブルアップルの匠", note: "アダムは一点突破。正面から殴り合うな" },
    { id: "minto", ring: "甘い嵐", note: "みんとは緩急で揺さぶってくる。乗せられるな" },
    { id: "hajime", ring: "tonari の新星", note: "──行ってこい。お前の煙を見せてやれ" },
  ];
  const host = el("div.entrance");
  layers.fx.append(host);
  for (const c of cards) {
    const face = c.id === "hajime" ? el("span.ent-face.ph", { text: "YOU" }) : el("img.ent-face", { src: faceIconUrl(c.id), alt: "" });
    const card = el(`div.ent-card${c.id === "hajime" ? ".me" : ""}`, [
      el("div.ent-cut", [face, el("span.ent-tag", { text: c.id === "hajime" ? "CHALLENGER" : "RIVAL" })]),
      el("div.ent-meta", [
        el("div.ent-ring", { text: c.ring }),
        el("div.ent-name", { text: c.id === "hajime" ? "はじめ" : realName(c.id) }),
        el("div.ent-note", { text: `スミ「${c.note}」` }),
      ]),
    ]);
    host.replaceChildren(card);
    await sleep(30);
    card.classList.add("in");
    c.id === "hajime" ? SE.fanfare() : SE.select();
    await sleep(window.__remake?.craftTest?.auto ? 80 : 2100);
  }
  host.remove();
}

// ---------------------------------------------------------------- 優勝のあと

async function victory() {
  addMoney(PRIZE);
  delete state.tournament.stockSnap;
  await play("ch1_tournament_after", { bg: STAGE });
  // 優勝の夜: 師匠の採点表 → 未知の送信者
  await openPhone([
    {
      id: "_sys_sumi_scoresheet", sender: "sumi", messages: [
        "おう。優勝、見事だった",
        "……で、だ。開示された採点表、もう見たか",
        "技術点も個性点も、お前は4人の中で下位だ。なるにも負けてる",
        "お前を勝たせたのは、南雲さんの「総合印象点」ひとつ。あの人が、お前にだけ満点をつけた",
        "勝ちは勝ちだ。今日のお前の煙が美味かったのも、嘘じゃない。──だが、これで覚えることがなくなったとは思うな",
        "あの一票が何だったのか。次の舞台までに、自分で答えを出せ",
      ], close_label: "……はい。ありがとうございます、スミさん",
    },
    {
      id: "_sys_unknown_recorded", sender: "???", messages: [
        "SMOKE CROWN CUP 優勝、おめでとうございます。",
        "本日のあなたの試合データは、すべて記録させていただきました。",
        "炭の配置、蒸らし時間、引きの圧、提供時の所作。──実に興味深い。",
        "また、お会いしましょう。",
      ], close_label: "……誰？",
    },
  ], { time: "PM 11:47", title: "優勝の夜" });
  await play("ch1_naru_promise");
  state.phase = "cleared";
  save();
  await bannersIdle();
  await showClear();
}

export async function showClear() {
  playBgm("bgm_result_emotional");
  showHud(false);
  setBg(bgUrl("bg_tonari_inside", "night"), { tint: "dim" });
  const root = el("div.end-screen.clear", [
    el("div.end-title", { text: "第1章 クリア" }),
    el("div.end-sub", { text: "SMOKE CROWN CUP 優勝 ── 次は県大会『HAZE: OPEN CLOUD』へ。" }),
    el("div.end-body", [
      el("div.end-radar", [radar(state.stats, state.statsAtChapterStart, 300)]),
      el("div.end-notes", [
        el("p", { text: "この章で伸びたもの ── 淡い面が章のはじめ、明るい面がいまの自分。" }),
        el("p", { text: "第2章は、まだ準備中です。" }),
        el("div.next-teaser", [el("small", { text: "NEXT ──" }), el("b", { text: "県大会『HAZE: OPEN CLOUD』" }), el("span", { text: "県中の煙自慢が、この称号を狙っている。" })]),
      ]),
    ]),
    el("div.end-actions", [el("button.btn.primary", { text: "タイトルへ", dataset: { test: "end-title" }, onclick: () => location.reload() })]),
  ]);
  showScreen("end", root);
}

/** 一台を焦がした大会は、審査を待たずにその場でGAME OVER（TH06）。再挑戦は通常の敗北と同じ。 */
/** 一台がダメになった大会は、審査を待たずにその場でGAME OVER（TH06・TH18〜TH20）。 */
async function failedOut(reason) {
  bc.clearComments();
  save();
  await smokeWipe(() => showGameOver({ reason }), { color: "dark" });
}

/**
 * 大会コンティニュー。スミさん3台本／交際中の恋人が語りかけ、選択後の一言を見せる。
 * 声なしの立ち絵・字幕・SE・BGMを gameover.js から制御し、再挑戦なら大会の頭へ。
 */
async function showGameOver({ rank = 0, reason = "rank", variant = null } = {}) {
  showHud(false);
  stopBgm();
  SE.miss();
  const root = buildGameOver({
    reason, rank, variant,
    onRetry: () => { retire(root); smokeWipe(() => { tournamentDay(); }, { color: "dark" }); },
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
  return showGameOver({ reason, rank, variant });
}
