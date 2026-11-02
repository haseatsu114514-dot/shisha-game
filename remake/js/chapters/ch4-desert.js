// 第4章ドバイ・砂丘のサンドボード（DESERT RIDE）の本編接続。
// 宿の隣の砂漠ツアーのデスクで現地ガイドのヌール（characters.json の noor）と3回話すと、昼の外出「ヌールと砂丘へ」が地図に出る。
// 外出は昼の行動枠を1つ使う（value.slot を 1 にする。ラクダレースと同じで、同じ日の昼にもう一方へは行けない）。
// 同じ外出の中の再挑戦は追加の行動を使わない。記録は state.desert、進み具合は flags._ch4_desert。
// 報酬は初回完走の経験値（core/growth.js の awardActionExp。心得の盤が有効な時だけ入る）と、
// Aランク以上で寝る前の「遊びのご褒美」（growth-board-data.js の PLAY_REWARDS "desert-a"）。能力値の直接加算はしない。
// ゲーム本体は minigames/desert-ride.js（保存を読まない）。台詞は data/dialogue/ch4_desert.json。
import { state, save, config } from "../core/state.js";
import { DB } from "../core/data.js";
import { showScreen, setBg, layers, toast } from "../core/ui.js";
import { readDialogues } from "../core/chapter-data.js";
import { play } from "../vn/engine.js";
import { awardActionExp } from "../core/growth.js";

export * from "./ch4-desert-progress.js";
import { DESERT_TALKS, DESERT_SCENES, DESERT_RACE_WIN_LINE, DESERT_NARU_LINES, DESERT_DIALOGUE_IDS, desertRivals, markNaruMet, DESERT_DIALOGUE_FILE, DESERT_GUIDE, desertTalkScene, completeDesertTalk,
  desertOutingStatus, beginDesertOuting, desertRecords, recordDesertResult, desertProgress } from "./ch4-desert-progress.js";

let dialogueTask = null;
export function loadDesertDialogues() {
  if (!dialogueTask) dialogueTask = readDialogues(DESERT_DIALOGUE_FILE, DESERT_DIALOGUE_IDS).then(dialogues => {
    for (const id of DESERT_DIALOGUE_IDS) DB.dialogues[id] = dialogues[id];
    return dialogues;
  }).catch(error => { dialogueTask = null; throw error; });
  return dialogueTask;
}

const firstLine = id => DB.dialogues[id]?.lines?.[0]?.text || "";
let active = false;

/**
 * 地図からの入口。kind "desert_talk" はデスクの会話を1つ読んで確定、kind "desert" は砂丘へ出かけて遊ぶ。
 * 読了・完走の確定と保存はここで行う。中断（signal・LOAD・タイトル）は確定済みの分だけ残す。
 * 戻り値: 何かを確定したら true。
 */
export async function visitDesert(destination, { day, isCurrent = () => true, signal = null, host = null } = {}) {
  if (active || !state || !destination || destination.ok === false || signal?.aborted || !isCurrent()) return false;
  active = true;
  const owner = state;
  const current = () => !signal?.aborted && state === owner && isCurrent();
  const read = async (id, bg) => {
    showScreen("none", null);
    layers.hud.replaceChildren(); layers.hud.classList.remove("show");
    if (bg) await setBg(bg, { fast: true });
    if (!current()) return false;
    const result = await play(DB.dialogues[id], { signal });
    return current() && !!result && !result.cancelled;
  };
  let changed = false;
  try {
    await loadDesertDialogues();
    if (!current()) return false;
    const { bgUrl } = await import("../core/data.js");
    if (destination.kind === "desert_talk") {
      const id = desertTalkScene(owner, day);
      if (!id || !await read(id, bgUrl("bg_dubai_inn_day"))) return false;
      if (!completeDesertTalk(owner, id, day)) return false;
      save(); changed = true;
      // 初対面の登場カットイン（名乗った後に一度だけ。立ち絵が無い間も名前と一言は出す）
      if (id === DESERT_TALKS[0] && !owner.flags._intro_noor) {
        const { playIntro } = await import("../vn/intro.js");
        if (current()) await playIntro(DESERT_GUIDE, { override: { display_name: DB.characters[DESERT_GUIDE]?.display_name } });
      }
      if (id === DESERT_TALKS[DESERT_TALKS.length - 1] && current()) toast("昼の行き先に「ヌールと砂丘へ」が加わった", { kind: "good" });
      return changed;
    }
    if (destination.kind !== "desert") return false;
    const status = desertOutingStatus(owner, day);
    if (!status.ok) return false;
    const [{ runDesertRide }, { DESERT_BG, DESERT_DUSK_BG, loadDesertArt }] = await Promise.all([
      import("../minigames/desert-ride.js"), import("../minigames/desert-ride-art.js")]);
    if (!current()) return false;
    loadDesertArt(); // 到着の会話の間にゲームの絵を読み始める
    if (!await read(status.first ? DESERT_SCENES.arrive : DESERT_SCENES.again, bgUrl(DESERT_BG))) return false;
    // ここで昼の行動枠を使う。以降の滑り直しは何度でも、追加の消費なし。
    if (!beginDesertOuting(owner, day)) return false;
    save(); changed = true;
    showScreen("none", null);
    const before = desertRecords(owner);
    const name = DB.characters[DESERT_GUIDE]?.display_name || "ヌール", naruName = DB.characters.naru?.display_name || "なる";
    const rivals = desertRivals(owner);
    // ヌールに勝った後の最初の外出: なるが砂丘に来て勝負を持ちかける（一度だけ）
    if (rivals.includes("naru") && !before.naruMet) {
      if (!await read(DESERT_SCENES.naruArrive, bgUrl(DESERT_BG))) return changed;
      if (markNaruMet(owner)) save();
      showScreen("none", null);
    }
    let firstWin = false, firstNaruWin = false;
    const { results } = await runDesertRide({
      host: host || document.getElementById("stage") || layers.screen, signal, tutorial: status.first,
      best: before.best ? { score: before.best.score, rank: before.best.rank } : null,
      reducedMotion: (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!config.reduceShake,
      guide: name, rivals,
      onResult: result => {
        if (!current()) return;
        const saved = recordDesertResult(owner, result, { awardExp: awardActionExp });
        if (!saved) return;
        save();
        if (saved.firstWin) firstWin = true;
        if (saved.firstNaruWin) firstNaruWin = true;
        const best = saved.newBest && !saved.firstClear ? " 自己ベスト更新" : "";
        if (saved.who === "naru") toast(`${naruName}「${firstLine(saved.won ? DESERT_NARU_LINES.win : DESERT_NARU_LINES.lose)}」${best}`, { kind: "good" });
        else toast(`${name}「${firstLine(saved.won ? DESERT_RACE_WIN_LINE : `venue_noor_result_${result.rank}`)}」${best}`, { kind: "good" });
        if (saved.firstClear) toast("初めての完走。砂丘の写真を、ヌールが撮ってくれた", { kind: "good" });
      },
    });
    if (!current()) return changed;
    // 夕日の砂丘で話す（完走の有無にかかわらず、下りてきたら）。中断しても外出の記録は残っている。
    void results;
    // 初めて競走でヌールに勝った日は、ゴールの旗の下で短く話してから夕日へ
    if (firstWin && !await read(DESERT_SCENES.raceFirstWin, bgUrl(DESERT_BG))) return changed;
    // 初めてなるに勝った日も、夕日の前に一言
    if (firstNaruWin && !await read(DESERT_SCENES.naruFirstWin, bgUrl(DESERT_BG))) return changed;
    await read(status.first ? DESERT_SCENES.sunsetFirst : DESERT_SCENES.sunsetAgain, bgUrl(DESERT_DUSK_BG));
    return changed;
  } finally { active = false; }
}

/**
 * 日常ループ（版2）の行き先の処理。戻り値は calendar の performSpot の形 { used, exerted, slotsUsed }。
 * デスクの会話は時間を使わない（used: false）。砂丘は visitDesert の中で昼の行動（slot）を使い済みなので slotsUsed: 0。
 * 体力は使わない（砂丘は気分転換。日常ループが外出のたびに経験値を足さないようにし、育成は初回完走の分だけにする）。
 */
export async function performDesertSpot(entry, { day, showHud = null } = {}) {
  const owner = state;
  const before = desertProgress(owner).outings;
  const hudRoot = layers.hud.firstElementChild;
  try {
    await visitDesert({ kind: entry.place === "tour_desk" ? "desert_talk" : "desert", ok: true }, { day });
  } finally {
    if (hudRoot && !hudRoot.isConnected) layers.hud.replaceChildren(hudRoot);
    showHud?.(true);
  }
  const went = state === owner && desertProgress(owner).outings > before;
  return { used: went, exerted: false, slotsUsed: 0 };
}
