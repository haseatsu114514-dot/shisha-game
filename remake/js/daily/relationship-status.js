// 関係の表示は、実際の回答・読了・交際から組み立てる。表示だけで保存データを補わない。
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { affinityLevel, affinityGateWaiting } from "../core/stats.js";
import { BOND_QUESTIONS, BOND_FINALES, questionVisitDue, finaleDue, settledFriend } from "./bonds.js";
import { romanceRouteOpen } from "./romance.js";
import { hiyoriFinaleReady } from "../core/hiyori-route.js";

const meetingPlace = {
  sumi: "tonari", tsumugi: "tonari", naru: "KEMURIKUSA", adam: "EDEN",
  rin: "夜のDr.fookahの2階", minto: "PEPPERMINT", hiyori: "tonari", samechan: "SHISHARK", ageha: "MELTY PUFF",
  mashiro: "mukai",
};
const summary = (kind, label, hint) => ({ kind, label, hint });

// 段階の仕組み（♥3で方向を選ぶ・♥5で特別なイベントと贈り物）は人間関係タブの全体ガイドに一度だけ置く。
// ここでは次の一手だけを示し、各人の行では反復しない。
function finaleHint(id) {
  const def = BOND_FINALES[id];
  if (finaleDue(id)) {
    if (def.invite) return "LIMEの私的な約束で、特別なイベントへ。";
    return `${def.night ? "夜、" : "次に"}${meetingPlace[id] || "いつもの場所"}で会うと、特別なイベントへ。`;
  }
  if (id === "tsumugi" && state.chapter === 1 && state.day < 12 && !state.flags._tsumugi_contest_submitted) {
    return "つむぎの絵の応募を見届けよう。特別なイベントは、その後に。";
  }
  if (id === "minto" && !(state.flags._minto_identity_revealed && state.flags._minto_name_known)) {
    return "LIMEの私的な約束で、仕事を離れた彼女と話そう。";
  }
  return "まだ聞いていない話を進めよう。個別の交流が揃うと、特別なイベントへ。";
}

/** その人との直近の思い出（実際に読んだ交流の記憶）を一つ返す。無ければ null。 */
export function recentMemoryEcho(id) {
  const ids = Array.isArray(state.relationshipMemories) ? state.relationshipMemories : [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const memory = DB.relationshipMemories[ids[i]];
    if (memory && memory.char_id === id) return memory.echo;
  }
  return null;
}

/** 好感度と恋愛の方向、成立済みの関係を分けて案内する（読み取り専用）。 */
export function relationshipStatus(id) {
  if ((state.lovers || []).includes(id)) {
    return summary("lover", "恋人", "♥5のまま、恋人としての交流で２人の仲は深まる。");
  }
  if (settledFriend(id)) {
    return summary("friend", "友達", state.chapter === 1
      ? "LIMEの雑談や一服の誘いで、交流は続く。"
      : "友人としての大きな節目を迎えた。");
  }
  if (romanceRouteOpen(id)) {
    if (id === "mashiro") return summary("romance", "告白を選べる", "寄り道から、休日にましろの部屋でお茶をする日へ。");
    return summary("romance", "告白を選べる", (state.flags._confession_wait || 0) > state.day
      ? "今は想いを胸にしまっている。後日の夜、もう一度伝えられる。"
      : "予定の合う夜の帰り道で、想いを伝えるか選べる。");
  }

  const lv = affinityLevel(id);
  const answers = Object.values(state.romanceChoices || {}).filter(a => a?.char === id && Number.isFinite(a.value));
  const friend = !!state.flags[`_friend_${id}`] || answers.some(a => a.value === 0);
  const romance = !friend && answers.some(a => a.value > 0);
  if (friend || romance) {
    // あげは（#1988・#2023）: 恋愛ルートで♥5なら、締めくくりの有無にかかわらず帰郷後の再会の翌日に本人から言葉がある。
    const agehaWords = id === "ageha" && romance && lv >= 5 && (state.chapter >= 3 || !!state.finales?.[id]);
    const hint = agehaWords ? (state.chapter >= 3 ? "帰郷してMELTY PUFFを訪ねた翌日に、本人の言葉を聞ける。"
        : "県大会のあとも、店に通う約束は続く。本人の言葉は、そのあとで。")
      : state.finales?.[id] ? "相手との大切な交流を見届けた。"
      : id === "hiyori" && !BOND_FINALES[id]?.gift ? "ひよりとの交流を続けよう。関係の続きは、これからの物語で。"
      : id === "hiyori" && !hiyoriFinaleReady() ? "まだ聞いていないひよりの話を進めよう。斧投げや仕事の話を見届けてから、次の節目へ。"
      // 締めくくりはMELTY PUFFに通える第2章だけ。
      : id === "ageha" ? (lv >= 5 && state.chapter === 2 ? finaleHint(id) : "")
      : lv >= 5 ? finaleHint(id)
      : ""; // ♥5までの道のりと贈り物の説明は全体ガイドにまとめ、各人の行では直近の思い出を前に出す
    return summary(romance ? "romance" : "friend", romance ? "恋愛ルート" : "友人ルート", hint);
  }

  if (state.finales?.[id]) return summary("neutral", "交流の節目", "相手との大切な交流を見届けた。");

  // 後発キャラは現在の物語の範囲で案内し、未接続の告白を約束しない。
  if (id === "hiyori") {
    if (lv >= 3 && affinityGateWaiting(id)) return summary("choice", "スミさんとの再会待ち", "スミさんのLIMEを読んで、夜のtonariで再会しよう。");
    const q = BOND_QUESTIONS[id];
    const script = DB.dialogues[q?.dialogue];
    if (!script?.lines?.length || script.metadata?.preview_only) {
      return summary("neutral", "交流中", "スミさんやひよりとの交流を、少しずつ深めよう。");
    }
  }
  if (id === "samechan" && (state.chapter || 1) < 2) {
    return summary("neutral", "交流中", "今はLIMEで連絡を取り合える。SHISHARKでの交流は第2章から。");
  }

  const question = BOND_QUESTIONS[id];
  const canChoose = !!DB.dialogues[question?.dialogue] || id === "samechan" && !!DB.dialogues.samechan_shop_bond_question;
  if (canChoose) {
    if (lv < 3) return summary("neutral", "交流中", ""); // ♥3の節目の説明は全体ガイドに集約
    const hint = questionVisitDue(id)
      ? `次に${meetingPlace[id] || "いつもの場所"}で会うと、恋愛・友情の方向を選べる。`
      : id === "minto" ? "私服で会うLIMEの約束を進めると、恋愛・友情を選ぶ会話へ。"
      : "相手の話を進めると、恋愛・友情を選ぶ会話へ。";
    return summary("choice", "関係を考える会話待ち", hint);
  }
  if (BOND_FINALES[id]) return summary("neutral", "交流中", lv >= 5 ? finaleHint(id) : "");
  return summary("neutral", "交流中", "これからの物語で、少しずつ仲を深めよう。");
}
