// 第1章「一吸目（ファーストドロー）」── SMOKE CROWN CUP 編 の台本。
// 章の流れはこのファイルを上から読めば追えるようにしてある（正史: brand/story_and_structure.md 第1章）。
import { el, sleep } from "../core/util.js";
import { bgUrl, faceIconUrl, realName } from "../core/data.js";
import { layers, showScreen, clearScreen, setBg, smokeWipe, chapterTitle, dayCard, roundCut, toast, bannersIdle, retire } from "../core/ui.js";
import { state, save, markMet, setFlag, flag } from "../core/state.js";
import { addMoney, maxStamina, gainStat } from "../core/stats.js";
import { playBgm, stopBgm, SE } from "../core/audio.js";
import { play, hooks } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { initHud, showHud, daysLeft, MAX_DAYS } from "../daily/hud.js";
import { openPhone, morningMessages } from "../daily/phone.js";
import { ownsFlavor } from "../daily/shop.js";
import { radar } from "../daily/status.js";
import { newSession, openBench, tickerSay } from "../craft/session.js";
import { stepSetup, stepConcept, stepMix, stepPack, stepPlace, stepSteamTime } from "../craft/steps.js";
import { runHoles } from "../craft/holes.js";
import { runHeat } from "../craft/heat.js";
import { runSteamDodge } from "../craft/steam.js";
import { runPull } from "../craft/pull.js";
import { runCare } from "../craft/care.js";
import { runTrial } from "../craft/trial.js";
import { computeShisha, finalize } from "../craft/score.js";
import { outcomeOf, showStandings, resultCountdown, nagumoCutin, resultTable } from "../craft/result.js";

const BG = (name) => `res://assets/backgrounds/${name}.png`;
const TONARI = BG("bg_tonari_inside");
const TONARI_N = BG("bg_tonari_inside_night");
const STAGE = BG("bg_tournament_stage");
const PRIZE = 30000;

// ---------------------------------------------------------------- 会話フック

function setupHooks() {
  hooks.interpolate = (t) => t.replace(/\{daysLeft\}/g, String(daysLeft())).replace(/\{day\}/g, String(state.day));
  hooks.onChoice = (dialogueId, choiceId, branch) => {
    // チョイザップ入会（月額4,000円）
    if (dialogueId === "ch1_choizap_first" && branch === "register") {
      addMoney(-4000);
      setFlag("_gym_member");
    }
    // 大会前夜の過ごし方（練習=本番に小ボーナス／スミさん=根性／早寝=体力全快）
    if (dialogueId === "ch1_day7_last_night") {
      state.flags._last_night = branch;
      if (branch === "sleep_early") state.stamina = maxStamina();
    }
  };
}

// ---------------------------------------------------------------- 開幕

export async function startNewGame() {
  setupHooks();
  clearScreen();
  stopBgm();
  setBg(null, { instant: true });
  // コールドオープン: 1年後のドバイ決勝の一瞬（顔は見せない）
  layers.fx.append(el("div.cold-open", [el("i.co-l"), el("i.co-r"), el("i.co-crowd")]));
  SE.crowd(3);
  await play("ch1_cold_open");
  document.querySelector(".cold-open")?.remove();
  await chapterTitle({ no: "第一章", name: "一吸目", read: "ファーストドロー ── FIRST DRAW", sub: "SMOKE CROWN CUP 編" });
  playBgm("tonari");
  await play("ch1_opening", { bg: TONARI });
  save();
  await tutorial();
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
  state.flags._tutorial_done = true;
  await play("remake_tutorial_result", { bg: TONARI });
}

// ---------------------------------------------------------------- 夜の固定イベント
// pin=マップの「!」印／teaser=前日の就寝時の予感／beat=イベント前のつなぎ一行

const nightScene = (id, bg) => () => play(id, bg ? { bg } : {});
const once = (key, fn) => ({ run: async () => { setFlag(key); await fn(); }, done: () => flag(key) });

const NIGHT_EVENTS = {
  2: { pin: "tonari", teaser: "tonari", beat: "夜、tonariに顔を出す──", ...once("_ev_salaryman", nightScene("ch1_salaryman_regular", TONARI_N)) },
  4: { pin: null, teaser: "帰り道", beat: "買い出しの帰り道──", ...once("_ev_ageha_cameo", nightScene("ch1_ageha_encounter", BG("bg_street_night"))) },
  5: { pin: "tonari", teaser: "tonari", beat: "閉店後の店に、もう少しだけ残る──", ...once("_ev_day5", nightScene("ch1_day5_sumi_story", TONARI_N)) },
  7: { pin: "tonari", teaser: "tonari", beat: "大会まで、ちょうど折り返し──", ...once("_ev_midcheck", nightScene("remake_midcheck")) },
  9: { pin: "c_station", teaser: "C.STATION", beat: "夜。C.STATIONで出場者説明会──", ...once("_ev_meet_rivals", nightScene("ch1_meet_rivals", BG("bg_c_station_night"))) },
  10: { pin: "tonari", teaser: "tonari", beat: "帰り道、tonariに寄っていく──", ...once("_ev_salaryman_change", nightScene("ch1_salaryman_change", TONARI_N)) },
  12: { pin: "tonari", teaser: "tonari", beat: "閉店間際のtonari──", ...once("_ev_tsumugi_sketch", nightScene("ch1_tsumugi_sketch", TONARI_N)) },
  13: { pin: "tonari", teaser: "tonari", beat: "夜。店の作業台で、前日リハーサル──", ...once("_ev_rehearsal", rehearsal) },
  14: { pin: null, teaser: "", beat: "大会前夜──", ...once("_ev_last_night", nightScene("ch1_day7_last_night", BG("bg_home_night"))) },
};

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
  const s = computeShisha(cs);
  const score = (cs.holes.score + cs.heat.score + s.craftQuality) / 3;
  state.rehearsal = score >= 85 ? "great" : score >= 68 ? "good" : "rough";
  await play(`remake_rehearsal_${state.rehearsal}`, { bg: TONARI_N });
}

// ---------------------------------------------------------------- 大会当日

const STEPS_R1 = [["setup", "SETUP"], ["concept", "CONCEPT"], ["mix", "MIX"], ["pack", "PACK"], ["holes", "FOIL"], ["heat", "HEAT"], ["place", "SET"], ["steam", "STEAM"]];
const STEPS_ALL = [...STEPS_R1, ["pull", "PULL"], ["care", "CARE"], ["trial", "TRIAL"]];

async function tournamentDay() {
  clearScreen();
  initHud({});
  if (state.phase !== "tournament") {
    state.phase = "tournament";
    state.day = MAX_DAYS + 1;
    state.slot = 0;
    showHud(true);
    playBgm("daily_part");
    await dayCard(`DAY ${MAX_DAYS + 1}`, "SMOKE CROWN CUP 当日");
    const cheers = morningMessages({ tournamentDay: true });
    if (cheers.length) await openPhone(cheers, { time: "AM 7:40" });
    // 本番用フレーバーを仕入れていなければ、スミさんのお情け（強制購入はしない）
    const stocked = state.flavors.some((id) => id !== "double_apple") || ownsFlavor("mint");
    await play(stocked ? "remake_flavor_brought" : "remake_flavor_rescue", { bg: TONARI });
    save();
    toast("大会直前のデータをセーブした");
  }
  showHud(false);
  state.tournament.attempts++;
  for (const id of ["naru", "adam", "minto", "nagumo", "maezono", "dr_kemuri"]) markMet(id);
  await smokeWipe(() => playBgm("bgm_tournament_wait"), { color: "dark" });
  await play("ch1_tournament_arrival");
  await play("ch1_tournament_opening", { bg: STAGE });
  playBgm("bgm_tournament_edm");
  await entrance();

  // ROUND 1 ── 組み立て
  const cs = newSession("tournament");
  await roundCut("ROUND 1", "組み立て");
  await play("remake_round1_intro", { bg: STAGE });
  openBench(cs, { steps: STEPS_ALL });
  tickerSay("パッキー「さあ4人一斉にスタート！ 制限時間は60分ッ！」");
  await stepSetup(cs);
  await stepConcept(cs);
  await stepMix(cs);
  await stepPack(cs);
  await runHoles(cs);
  await runHeat(cs);
  await stepPlace(cs);
  await stepSteamTime(cs);
  await runSteamDodge(cs);
  await play("ch1_tournament_match", { bg: STAGE });
  await play("ch1_tournament_r1_end", { bg: STAGE });
  await showStandings(1, (cs.holes.score + cs.heat.score) / 2);

  // ROUND 2 ── 吸い出し・提供
  await roundCut("ROUND 2", "吸い出し・提供");
  openBench(cs, { steps: STEPS_ALL });
  await runPull(cs);
  await play("ch1_tournament_r2_end", { bg: STAGE });
  cs.stats = computeShisha(cs);
  await showStandings(2, (cs.holes.score + cs.heat.score + cs.stats.craftQuality) / 3);

  // ROUND 3 ── 熱管理
  await roundCut("ROUND 3", "熱管理");
  openBench(cs, { steps: STEPS_ALL });
  await runCare(cs);
  cs.stats = null;
  await play("ch1_tournament_r3_end", { bg: STAGE });

  // 審査 ── FLAVOR TRIAL
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
    playBgm("bgm_result_emotional");
    await nagumoCutin(1);
    await play("ch1_tournament_reveal", { bg: STAGE });
    await resultTable(cs, 1);
    await victory();
  } else {
    await resultCountdown(cs, out.kind);
    await nagumoCutin(out.rank);
    await resultTable(cs, out.rank);
    await play("ch1_tournament_defeat", { bg: STAGE });
    await play("remake_defeat_follow", { bg: TONARI_N });
    await showDefeat(out.rank);
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
  await play("ch1_tournament_after", { bg: STAGE });
  // 優勝の夜: 師匠の採点表 → 未知の送信者
  await openPhone([
    {
      id: "_sys_sumi_scoresheet", sender: "sumi", messages: [
        "おう。優勝、見事だった",
        "……で、だ。開示された採点表、もう見たか",
        "技術点も個性点も、お前は4人の中で下位だ。なるにも負けてる",
        "お前を勝たせたのは、南雲さんの「総合印象点」ひとつ。あの人が、お前にだけ満点をつけた",
        "勝ちは勝ちだ。今日のお前の煙が美味かったのも、嘘じゃない。──だが「実力で勝った」とは思うな",
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
  gainStat("insight", 2);
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
        el("p", { text: "第2章は、リメイク版ではまだ準備中です。" }),
        el("div.next-teaser", [el("small", { text: "NEXT ──" }), el("b", { text: "県大会『HAZE: OPEN CLOUD』" }), el("span", { text: "県中の煙自慢が、この称号を狙っている。" })]),
      ]),
    ]),
    el("div.end-actions", [el("button.btn.primary", { text: "タイトルへ", dataset: { test: "end-title" }, onclick: () => location.reload() })]),
  ]);
  showScreen("end", root);
}

async function showDefeat(rank) {
  showHud(false);
  stopBgm();
  const root = el("div.end-screen.gameover", [
    el("div.end-title", { text: "GAME OVER" }),
    el("div.end-sub", { text: `結果は${rank}位。優勝だけが次への切符だった。ここで、終わってしまった。` }),
    el("div.end-body", [el("div.end-radar", [radar(state.stats, state.statsAtChapterStart, 280)]),
      el("div.end-notes", [el("p", { text: "大会の頭から、もう一度挑戦できる（大会直前のデータから再開）。" })])]),
    el("div.end-actions", [
      el("button.btn.primary", { text: "もう一度挑戦する", dataset: { test: "retry" }, onclick: () => { SE.select(); retire(root); smokeWipe(() => { tournamentDay(); }, { color: "dark" }); } }),
      el("button.btn", { text: "タイトルへ", onclick: () => location.reload() }),
    ]),
  ]);
  showScreen("end", root);
}
