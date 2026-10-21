// 名前欄とログだけの解決。台本のspeakerは立ち絵・声・演出のために保持する。
import { stripTags } from "./text.js";

const PLAYER_SPEAKERS = new Set(["hajime", "hazime"]);
const AFTER_OPENING = new Set(["daily", "tournament", "aftermath", "cleared"]);

/** 名前紹介済みか。既存の進行記録だけを読み、LOAD後の状態を毎行評価する。 */
export function playerNameKnown(save) {
  return !!(save?.flags?._intro_hajime || save?.flags?._ch1_opening?.introDone
    || save?.chapter > 1 || AFTER_OPENING.has(save?.phase));
}

// 棚卸し済みの実況・取材者・客の声だけを匿名話者にする。
// 全文引用でも、つむぎのメモ(ch1_tsumugi_fourth)などは語りのまま。
const EXTERNAL_VOICE_SCENES = new Set([
  "ch1_cold_open", "ch1_tournament_after", "ch1_naru_group_regulars",
  "ch1_adam_group_soutoku", "ch1_minto_first", "ch1_minto_group_regulars", "ch1_rei_cameo",
]);
function externalVoice(text, dialogueId) {
  return EXTERNAL_VOICE_SCENES.has(dialogueId) && /^(?:「[^「」]*」[。！？\s]*)+$/u.test(text);
}

/**
 * textは補間・既存報酬cue処理後の本文。報酬の解析より先に整形しない。
 * resolveNameにはその場面のcontextを含めた既存displayNameを渡す。
 * 地の文を発声や内心へ書き換えず、すでに（…）の内心も二重に囲まない。
 */
export function linePresentation(line, { text, save, resolveName, dialogueId, isReward = false }) {
  if (isReward) return { name: "", text, thought: false };
  const speaker = String(line.speaker || "");
  const plainText = stripTags(text).trim();
  // 登録直後のLIME自動通知。主人公の発声・内心にはしない。
  if (!speaker && dialogueId === "ch1_minto_first" && /^『[^『』]*』$/u.test(plainText)) {
    return { name: "", text, thought: false };
  }
  if (!speaker && externalVoice(plainText, dialogueId)) {
    return { name: resolveName("???"), text, thought: false };
  }
  const player = !speaker || PLAYER_SPEAKERS.has(speaker);
  const name = player ? (playerNameKnown(save) ? resolveName("hajime") : "???")
    : speaker === "samechan" && line.voice === "korochan" ? "コロちゃん" : resolveName(speaker);
  return { name, text, thought: player && /^（[\s\S]*）$/u.test(plainText) };
}
