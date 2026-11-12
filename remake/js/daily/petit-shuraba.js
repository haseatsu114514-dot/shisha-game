// プチ修羅場の再生（SRB10〜）。決まり（条件・順番・記録）は core/petit-shuraba.js、台本は data/dialogue/petit_shuraba.json（使う時に読む）。
// 差し込み口:
//   petitAfterDate(id)  … 恋人とのデートの終わり（romance.js の playDate・samechan-date.js）と、mukai でましろと過ごした後（第3・5章）
//   petitAfterVisit(spot) … 店や施設の訪問を終えた後（calendar.js の performSpotAction）
// どれも行動・体力・能力を使わない寄り道で、読み終えた時だけ記録する（途中のLOAD・読み込み失敗では何も残さない）。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { play, isPlaying } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { markPetit, petitActive, petitAfterDatePick, petitAfterVisitPick, PETIT_SCENES, joinPetitScenes } from "../core/petit-shuraba.js";

const FILE = "petit_shuraba";
let loading = null;
async function loadScenes() {
  if (PETIT_SCENES.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues(FILE, PETIT_SCENES).then(scenes => { Object.assign(DB.dialogues, scenes); })
    .finally(() => { loading = null; });
  await loading;
}

/** 読み終えた時だけ記録して保存する。 */
async function read(pick, dialogue, options = {}) {
  const owner = state;
  if (!dialogue) return false;
  const result = await play(dialogue, options);
  if (state !== owner || !result || result.cancelled) return false;
  markPetit(owner, pick.key);
  save();
  return true;
}

/**
 * LIMEの誤爆: デートのお礼を、別の恋人へ送ってしまう。帰り道の地の文 → 相手のトーク（はじめの誤送信が自分の吹き出しで出る）→ 締めの地の文。
 * 文面は remake/data/lover.json の misfire（送った文 sent と、受け取った恋人ごとの返事 to[ID]）。トークは受信箱の履歴に残る。
 */
async function misfire(pick) {
  const data = DB.lover?.misfire, lines = data?.to?.[pick.to];
  if (!data?.sent || !lines?.m?.length || !lines.r?.length) return false;
  const owner = state;
  const opened = await play("petit_lime_misfire_open");
  if (state !== owner || !opened || opened.cancelled) return false;
  const { openPhone } = await import("./phone.js"); // phone.js → romance.js → ここ、の循環を避けて使う時に読む
  if (state !== owner) return false;
  await openPhone([{ id: "_petit_lime_misfire", sender: pick.to, type: "chat", lover: true,
    messages: [{ me: true, text: data.sent }, ...lines.m], replies: lines.r }], { title: "帰り道", time: state.slot ? "夜" : "昼" });
  if (state !== owner) return false;
  markPetit(owner, pick.key);
  save();
  await play("petit_lime_misfire_close");
  return state === owner;
}

/** 恋人 id と過ごした時間の終わりに、プチ修羅場を一つ読む（あれば）。読んだら true。bg: 背景の上書き（省くと今の背景のまま）。 */
export async function petitAfterDate(id, { bg = null } = {}) {
  if (!state || !petitActive(state) || isPlaying()) return false;
  const pick = petitAfterDatePick(state, id);
  if (!pick) return false;
  const owner = state;
  try { await loadScenes(); } catch { return false; } // 寄り道なので、読めなければ出さない
  if (state !== owner) return false;
  const options = bg ? { bg } : {};
  if (pick.kind === "call") return read(pick, joinPetitScenes(DB.dialogues, ["petit_date_call", `petit_date_call_${pick.partner}`, "petit_date_call_close"]), options);
  if (pick.kind === "notice") return read(pick, DB.dialogues[`petit_notice_${pick.who}`], options);
  if (pick.kind === "misfire") return misfire(pick);
  return false;
}

/** 訪ねた先（地図の行き先）を、プチ修羅場の決まりが見る形にする。 */
export function petitPlace(spot) {
  if (!spot) return null;
  if (spot.kind === "tonari") return { kind: "tonari" };
  if (spot.id === "rojiura_cinema") return { kind: "cinema" };
  // 第5章の通い店は talkWith、サメちゃんの店は id、Dr.fookah は2階の凛想に会えた時だけ「訪ねた」になる
  const who = spot.talkWith || (spot.id === "shishark" ? "samechan" : spot.kind === "shop" ? "rio" : spot.charId);
  return who ? { kind: "shop", who } : null;
}

/** 店や施設の訪問を終えた後に、プチ修羅場を一つ読む（あれば）。読んだら true。 */
export async function petitAfterVisit(spot, { bg = null } = {}) {
  if (!state || !petitActive(state) || isPlaying()) return false;
  const pick = petitAfterVisitPick(state, petitPlace(spot));
  if (!pick) return false;
  const owner = state;
  try { await loadScenes(); } catch { return false; }
  if (state !== owner) return false;
  const options = bg ? { bg } : {};
  if (pick.kind === "cross") {
    return read(pick, joinPetitScenes(DB.dialogues, ["petit_cross_open", `petit_cross_host_${pick.host}`, `petit_cross_guest_${pick.guest}`, "petit_cross_close"]),
      // 自分の店に立つみんとは営業の姿なので、視線の帯も営業の顔で出す（客として来たみんとは私服の栞）
      { ...options, cast: [pick.host === "minto" ? { id: "minto", face: "normal" } : pick.host, pick.guest] });
  }
  return read(pick, DB.dialogues[pick.scene], options);
}
