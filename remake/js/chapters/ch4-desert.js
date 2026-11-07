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
import { addMoney, gainAffinity, visitAffinity } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { questionDoneKey } from "../core/affinity-stages.js";
import { DESERT_TALKS, DESERT_INVITE_STAGE, NOOR_QUESTION_CHOICE, NOOR_CONFESSION, NOOR_OTHER_LOVER_FLAG, NOOR_VISIT_CONFESSION_FLAG, noorConfessionWaiting, DESERT_SCENES, DESERT_CAFE_PRICE, desertCafeVisit, completeDesertCafeVisit, DESERT_RACE_WIN_LINE, DESERT_NARU_LINES, DESERT_DIALOGUE_IDS, desertRivals, markNaruMet, DESERT_DIALOGUE_FILE, DESERT_GUIDE, desertTalkScene, completeDesertTalk,
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
 * 地図からの入口。kind "desert_talk" はカフェ・サーリムで会話を1つ読んで確定（paid なら一台の代金 3,000円）、
 * kind "desert" は砂丘へ出かけて遊ぶ（2回目からツアー代）。会話のたびにヌールの好感度が上がる（段階 +16・雑談 +8）。
 * 読了・完走の確定と保存はここで行う。中断（signal・LOAD・タイトル）は確定済みの分だけ残す。
 * scene: 読む台詞 id の差し替え（第5章の書き出し。段階の数え方・報酬は元の id のまま。第4章は渡さない）。
 * 戻り値: 何かを確定したら true。
 */
export async function visitDesert(destination, { day, isCurrent = () => true, signal = null, host = null, paid = false, naru = true, scene = id => id } = {}) {
  if (active || !state || !destination || destination.ok === false || signal?.aborted || !isCurrent()) return false;
  active = true;
  const owner = state;
  const current = () => !signal?.aborted && state === owner && isCurrent();
  const prepare = async bg => {
    showScreen("none", null);
    layers.hud.replaceChildren(); layers.hud.classList.remove("show");
    if (bg) await setBg(bg, { fast: true });
    return current();
  };
  const read = async (id, bg) => {
    if (!await prepare(bg)) return false;
    const result = await play(DB.dialogues[id], { signal });
    return current() && !!result && !result.cancelled;
  };
  let changed = false;
  try {
    await loadDesertDialogues();
    if (!current()) return false;
    const { bgUrl } = await import("../core/data.js");
    if (destination.kind === "desert_talk") {
      const legacy = destination.legacy === true;
      const visit = desertCafeVisit(owner, day, { legacy });
      if (!visit) return false;
      if (paid && DESERT_CAFE_PRICE > spendableMoney(owner)) { toast(`お金が足りない（${DESERT_CAFE_PRICE.toLocaleString("ja-JP")}円）`); return false; }
      // ♥5の締めくくり（DSR20）: 再生・ルートの記録・専用ハガルは bonds.js の playFinale。読み終えたら今日の来店として確定する
      if (visit.kind === "finale") {
        const { finaleDue, playFinale } = await import("../daily/bonds.js");
        if (!current() || !finaleDue(DESERT_GUIDE) || !await prepare(bgUrl("bg_dubai_inn_day"))) return false;
        if (!await playFinale(DESERT_GUIDE, { bg: bgUrl("bg_dubai_inn_day"), signal, deferSave: true }) || !current()) return false;
        if (!completeDesertCafeVisit(owner, visit, day, { legacy })) return false;
        if (paid) addMoney(-DESERT_CAFE_PRICE);
        save(); changed = true;
        if (noorConfessionWaiting(owner)) toast("次の砂丘で、ヌールが待っている（ツアー代はいらない）", { kind: "good" });
        return changed;
      }
      const id = visit.id;
      if (!await read(scene(id), bgUrl("bg_dubai_inn_day"))) return false;
      if (!completeDesertCafeVisit(owner, visit, day, { legacy })) return false;
      if (paid) addMoney(-DESERT_CAFE_PRICE);
      // ♥3の問いに答えた（選択は engine の onChoice → bonds.js の recordRomanceChoice が記録済み）
      if (id === "ch4_noor_bond_question" && owner.romanceChoices?.[NOOR_QUESTION_CHOICE]) owner.flags[questionDoneKey(DESERT_GUIDE)] = true;
      gainAffinity(DESERT_GUIDE, visitAffinity(visit.kind));
      save(); changed = true;
      // 初対面の登場カットイン（名乗った後に一度だけ。立ち絵が無い間も名前と一言は出す）
      if (id === DESERT_TALKS[0] && !owner.flags._intro_noor) {
        const { playIntro } = await import("../vn/intro.js");
        if (current()) await playIntro(DESERT_GUIDE);
      }
      if (id === DESERT_TALKS[DESERT_INVITE_STAGE - 1] && current()) toast("昼の行き先に「ヌールと砂丘へ」が加わった", { kind: "good" });
      return changed;
    }
    if (destination.kind !== "desert") return false;
    const status = desertOutingStatus(owner, day);
    if (!status.ok) return false;
    const [{ runDesertRide }, { DESERT_BG, DESERT_DUSK_BG, loadDesertArt }] = await Promise.all([
      import("../minigames/desert-ride.js"), import("../minigames/desert-ride-art.js")]);
    if (!current()) return false;
    loadDesertArt(); // 到着の会話の間にゲームの絵を読み始める
    if (!await read(scene(status.first ? DESERT_SCENES.arrive : DESERT_SCENES.again), bgUrl(DESERT_BG))) return false;
    // ここで昼の行動枠を使う（2回目からはツアー代も）。以降の滑り直しは何度でも、追加の消費なし。
    if (!beginDesertOuting(owner, day)) return false;
    if (status.price) addMoney(-status.price);
    // ヌールと一緒に過ごす外出なので、好感度も少し上がる（雑談と同じ +8）
    gainAffinity(DESERT_GUIDE, visitAffinity("talk"));
    save(); changed = true;
    showScreen("none", null);
    const before = desertRecords(owner);
    const name = DB.characters[DESERT_GUIDE]?.display_name || "ヌール", naruName = DB.characters.naru?.display_name || "なる";
    // 締めくくりで「二人で見たい」と答えた後の砂丘: 滑ったあと夕日で告白（DSR20）。この日はなるを呼ばない
    const confessionDay = status.invited === true;
    // 第5章（帰国後にまたドバイへ来た日・naru: false）は、なるは地元の KEMURIKUSA にいるので砂丘に来ない。ヌールとだけ滑る
    const rivals = !naru || (confessionDay && !before.naruMet) ? ["noor"] : desertRivals(owner);
    // ヌールに勝った後の最初の外出: なるが砂丘に来て勝負を持ちかける（一度だけ）
    if (rivals.includes("naru") && !before.naruMet) {
      if (!await read(DESERT_SCENES.naruArrive, bgUrl(DESERT_BG))) return changed;
      if (markNaruMet(owner)) save();
      showScreen("none", null);
    }
    let firstWin = false, firstNaruWin = false;
    const { results } = await runDesertRide({
      host: host || document.getElementById("stage") || layers.screen, signal, tutorial: status.first,
      best: before.best, legacyBest: before.legacyBest,
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
    if (confessionDay) {
      const { romanceRouteOpen } = await import("../daily/romance.js");
      if (current() && romanceRouteOpen(DESERT_GUIDE)) {
        // ほかに恋人がいれば、返事の前に一度だけ立ち止まる（台本の条件で出す一時の印）
        owner.flags[NOOR_OTHER_LOVER_FLAG] = (owner.lovers || []).length > 0;
        // 第5章で締めくくりを迎えた人（遊びに来ている間の告白・2026-11-07 オーナー決定）は「また日本に帰る」の言い方（台本の visiting）
        owner.flags[NOOR_VISIT_CONFESSION_FLAG] = (owner.finales?.[DESERT_GUIDE]?.chapter || 0) >= 5;
        try { await read(NOOR_CONFESSION, bgUrl(DESERT_DUSK_BG)); }
        finally { delete owner.flags[NOOR_OTHER_LOVER_FLAG]; delete owner.flags[NOOR_VISIT_CONFESSION_FLAG]; }
        // 付き合うと LIME を交換する（台本の _lime_contact_noor）。以後、離れていても朝のLIMEが届く（remake/data/lover.json）
        if (owner.flags[`_lime_contact_${DESERT_GUIDE}`] && !(owner.contacts || []).includes(DESERT_GUIDE)) (owner.contacts ||= []).push(DESERT_GUIDE);
        if (state === owner) save();
        return changed;
      }
    }
    await read(scene(status.first ? DESERT_SCENES.sunsetFirst : DESERT_SCENES.sunsetAgain), bgUrl(DESERT_DUSK_BG));
    return changed;
  } finally { active = false; }
}

/**
 * 日常ループ（版2）の行き先の処理。戻り値は calendar の performSpot の形 { used, exerted, slotsUsed }。
 * デスクの会話は時間を使わない（used: false）。砂丘は visitDesert の中で昼の行動（slot）を使い済みなので slotsUsed: 0。
 * 体力は使わない（砂丘は気分転換。日常ループが外出のたびに経験値を足さないようにし、育成は初回完走の分だけにする）。
 * naru: false は第5章（なるを砂丘に呼ばない）。scene は第5章の書き出しの差し替え（visitDesert）。
 */
export async function performDesertSpot(entry, { day, showHud = null, naru = true, scene } = {}) {
  const owner = state;
  const cafe = entry.place === "tour_desk";
  const before = desertProgress(owner);
  const hudRoot = layers.hud.firstElementChild;
  let changed = false;
  try {
    changed = await visitDesert({ kind: cafe ? "desert_talk" : "desert", ok: true }, { day, paid: cafe, naru, scene });
  } finally {
    if (hudRoot && !hudRoot.isConnected) layers.hud.replaceChildren(hudRoot);
    showHud?.(true);
  }
  if (state !== owner) return { used: false, exerted: false, slotsUsed: 0 };
  // カフェは一台吸う来店なので、ほかのカフェと同じく行動を1つ使う（体力は使わない）。砂丘は外出の確定で slot を使い済み
  if (cafe) return { used: !!changed, exerted: false };
  const went = desertProgress(owner).outings > before.outings;
  return { used: went, exerted: false, slotsUsed: 0 };
}

