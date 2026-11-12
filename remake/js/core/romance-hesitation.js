// 新しい相手へ踏み出す前の迷い。会話・保存・恋人成立は呼び出し側が行う。
// #3426 の会話エンジン変更とは独立して検証する。接続前の準備段階。
// 正本: confession.json のはじめの呼称、brand/character_profiles.md の呼称規約。
const CALLS = Object.freeze({
  tsumugi: "つむぎちゃん", rio: "凛想さん", ageha: "あげはさん",
  mashiro: "ましろちゃん", samechan: "サメちゃん", hiyori: "ひよりさん", noor: "ヌールさん",
});
const HEROES = new Set(["minto", ...Object.keys(CALLS)]);
const inner = text => ({ speaker: "hajime", text: `（${text}）`, portrait: false });

/** 表示名でなく、はじめが私的な会話で呼ぶ名前。本名未取得のみんとを先取りしない。 */
export function loverCallName(id, value) {
  if (id === "minto") return value?.flags?._minto_name_known ? "栞さん" : "みんとさん";
  // 壊れた旧保存のIDを人名として露出しない。相手の存在自体は消さない。
  return CALLS[id] || "あの人";
}

/** 交際順を保ち、重複だけを除く。同じ恋人への選択は迷いの対象にしない。 */
export function otherLovers(value, target) {
  const lovers = Array.isArray(value?.lovers) ? value.lovers : [];
  if (lovers.includes(target)) return [];
  return [...new Set(lovers.filter(id => typeof id === "string" && id.length > 0))];
}

/** 文言では判定しない。実際の恋愛値または正式な交際先への遷移だけを対象にする。 */
export function romanceIntent(value, dialogueId, line, choice, dialogues = {}) {
  if (!choice || !Array.isArray(line?.choices) || !line.choices.includes(choice)) return null;
  const next = String(choice.next_id || "");
  const match = /^confession_(\w+)_accept$/.exec(next);
  if (match && HEROES.has(match[1]) && dialogueId === `confession_${match[1]}`
    && dialogues[next]?.metadata?.set_romance === match[1]) {
    return { target: match[1], kind: "commit" };
  }
  if (HEROES.has(line.romance_char) && typeof line.id === "string" && line.id
    && Number.isFinite(choice.romance) && Math.round(choice.romance) > 0
    && !value?.romanceChoices?.[line.id]) {
    return { target: line.romance_char, kind: "court", choiceId: line.id };
  }
  return null;
}

/** 全員の呼称を順番通りに。長い場合も名前を省略せず、名前の途中では区切らない。 */
export function apologyLines(names) {
  if (!names.length) return [];
  const chunks = [];
  let chunk = "";
  // 各行48字以内。最後の「……ごめん」と括弧の余地をあらかじめ確保する。
  for (const name of names) {
    const joined = chunk ? `${chunk}、${name}` : name;
    if (chunk && [...joined].length > 40) { chunks.push(chunk); chunk = name; }
    else chunk = joined;
  }
  chunks.push(chunk);
  return chunks.map((text, i) => inner(text + (i === chunks.length - 1 ? "……ごめん" : "……")));
}

/**
 * 会話の一時状態だけを持つ。セーブに承認フラグを残さない。
 * UIは remember → decide の両方で戻れる。accepted は元の選択を一度適用してよいという結果。
 * accepted の apology を読み終え、state/会話の所有者を再確認してから元の選択を適用する。
 * 写真は既存 portraitInfo で解決すること。ここでは画像URL・CG解放・面識を作らない。
 */
export function createRomanceHesitation(value, intent) {
  if (!intent || !HEROES.has(intent.target) || !["court", "commit"].includes(intent.kind)) return null;
  const ids = otherLovers(value, intent.target);
  if (!ids.length) return null;
  const names = ids.map(id => loverCallName(id, value));
  const signature = () => JSON.stringify(otherLovers(value, intent.target).map(id => [id, loverCallName(id, value)]));
  const initial = signature();
  let stage = "remember";
  const current = next => next === value && signature() === initial
    && !value.flags?.[`_friend_${intent.target}`]
    && !(intent.choiceId && value.romanceChoices?.[intent.choiceId]);
  const memories = ids.map((id, i) => ({
    id, name: names[i],
    // 凛想は恋人IDが rio、立ち絵IDが rin。みんとの私服は名乗り済みだけ。
    portrait: HEROES.has(id) ? { id: id === "rio" ? "rin" : id,
      face: id === "minto" && value.flags?._minto_name_known ? "ura_normal" : "normal" } : null,
    line: inner(`${names[i]}の顔が、浮かんだ`),
  }));
  const views = {
    remember: {
      lines: [inner(ids.length === 1 ? "……でも、俺には彼女がいるよな" : "……でも、俺には付き合っている人たちがいる")],
      memories,
      choices: [{ action: "cancel", text: "いったん、言葉を飲み込む" }, { action: "continue", text: "それでも、気持ちを確かめる" }],
    },
    decide: {
      lines: [inner("今の関係を変えないまま、先へ進むのか"), inner("……まだ、言わずに戻ることもできる")],
      choices: [{ action: "cancel", text: "今は伝えない。元の選択に戻る" },
        { action: "continue", text: intent.kind === "commit" ? "それでも、付き合うと伝える" : "それでも、この気持ちを伝える" }],
    },
  };
  return {
    target: intent.target, kind: intent.kind, partners: ids.slice(),
    get stage() { return stage; },
    view: () => views[stage] || null,
    current,
    choose(action, nextValue) {
      if (!["remember", "decide"].includes(stage)) return { status: "closed" };
      if (!current(nextValue)) { stage = "cancelled"; return { status: "stale" }; }
      if (action === "cancel") { stage = "cancelled"; return { status: "cancelled" }; }
      if (action !== "continue") return { status: "ignored" };
      if (stage === "remember") { stage = "decide"; return { status: "pending" }; }
      stage = "accepted";
      return { status: "accepted", apology: intent.kind === "commit" ? apologyLines(names) : [] };
    },
  };
}
