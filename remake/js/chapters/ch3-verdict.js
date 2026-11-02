// 全国大会の調整〜決着の台本を、実際の調整履歴（炭を替えたか・客の様子）と前日の方針に合わせて差し替える。
// 台本の正本（ch3_main.json）は変えず、読む直前に行の文だけ置き換える。履歴が無い旧セーブは正本のまま読む。

const STRATEGY_LINES = {
  aroma: "（前の夜に決めた、最初の香りをはっきり届けること。揺れても、そこは自分で確かめ直せた）",
  light: "（前の夜に決めた、ゆっくり吸える軽さ。客が長く吸ってくれたのが、その答えだと思いたい）",
  sweet: "（前の夜に決めた、甘い余韻を残すこと。最後の一口まで、そこを見て動けた）",
};

// 調整1回分の記録から「炭を替えたか」と温度の落ち着き先を読む。
function careOf(record) {
  if (!record || typeof record !== "object") return null;
  return { moved: (record.coals || 0) > 0, over: !!record.over, under: !!record.under };
}

function customerLine({ moved, over, under }) {
  if (moved) return over ? "熱いけど、香りが立ってる。もう少し様子を見たいな"
    : under ? "替えてもらったのに、まだ少し薄いかな。でも嫌じゃない"
    : "戻ってきた。さっきより吸いやすい、ずっと吸ってたい";
  return over ? "まだ少し熱いけど、ゆっくり吸えば大丈夫そう"
    : under ? "だんだん穏やかになってきた。もう少し濃くてもいいかも"
    : "このくらいなら、もう少し吸ってたい";
}

function replaceLines(lines, table) {
  return lines.flatMap(line => {
    const to = table.get(line.text);
    return to === undefined ? [line] : to === null ? [] : [].concat(to).map(text => ({ ...line, ...text }));
  });
}

function adjustmentTable(care) {
  const table = new Map();
  if (care.moved) {
    table.set("香りを急いで立たせたくなる。隣ではスティーブが、灰を落とした炭をすぐには戻さない。", [{ text: "薄くなった煙を、客の様子と照らす。消耗した炭を替え、熱を戻した。隣ではスティーブが、自分の炭を静かに見ている。" }]);
    table.set("（待つって、手を抜くことじゃなかった）", [{ text: "（動かすのも、自分で見て決めたことだ。誰かの手本じゃなくていい）" }]);
    table.set("客が息を継ぐ。はじめも手を止め、吸い終わってからホースを受け取った。", [{ text: "客が息を継ぐ。はじめは吸い口を渡し、煙の戻りを見た。" }]);
    table.set("やるじゃん。僕が仕掛けたのに、僕の方が待たされた", [{ text: "動かしたのは君の判断か。釣れたと思ったのに、ちゃんと自分の理由で動いてる" }]);
    table.set("……今の待ち時間、記録していいか", [{ text: "……今の炭替えの判断、記録していいか" }]);
  } else {
    table.set("久世の鋭い苦みがまだ鼻に残る。はじめの煙が薄く思え、炭に手が伸びた。", [{ text: "久世の鋭い苦みがまだ鼻に残る。はじめの煙が薄く思え、炭に手が伸びかけた。" }]);
    table.set("その手を見た久世の震えが止まる。", [{ text: "その手の動きを見た久世の震えが止まる。" }]);
    table.set("あはっ、動いた！　僕の一口を基準にしちゃった？", [{ text: "あはっ、手が出た！　僕の一口を基準にしかけたでしょ？" }]);
    table.set("煙幕で言ったよね、最後の甘さは長いって。今なら直せるよ？", [{ text: "煙幕で言ったよね、最後の甘さは長いって。直すのは、まだ早いよ？" }]);
  }
  table.set("このくらいなら、もう少し吸ってたい", [{ text: customerLine(care) }]);
  return table;
}

export function adjustmentLines(lines, craft) {
  const care = careOf(craft?.careHistory?.[0]);
  return care ? replaceLines(lines, adjustmentTable(care)) : lines;
}

export function resultLines(lines, craft, strategyKey) {
  const history = (craft?.careHistory || []).map(careOf).filter(Boolean);
  const table = new Map();
  if (history.some(care => care.moved)) {
    table.set("君の炭は動かなかった。助言は、本当だよ", [{ text: "君は炭を替えた。僕の煙に釣られたんじゃなく、自分の目で決めて。助言は、本当だよ" }]);
    table.set("客の一口を待てました。助言にも揺さぶりにも急がず、俺の一台を選べた", [{ text: "客の様子を見て、必要な分だけ替えました。動かすのも待つのも、俺が選べた" }]);
  }
  const strategy = STRATEGY_LINES[strategyKey];
  const out = history.length ? replaceLines(lines, table) : lines;
  if (!strategy) return out;
  const at = out.findIndex(line => line.speaker === "hajime" && /俺の一台を選べた|俺が選べた/.test(line.text));
  if (at < 0) return out;
  return [...out.slice(0, at + 1), { speaker: "hajime", face: "normal", text: strategy }, ...out.slice(at + 1)];
}

// 敗退時の一言も、待ったのか替えたのかで振り返りを変える。
export function defeatLines(lines, craft) {
  const history = (craft?.careHistory || []).map(careOf).filter(Boolean);
  if (!history.length || history.some(care => care.moved)) return lines;
  return replaceLines(lines, new Map([["……もう少し、待てた気がする", [{ text: "……待つだけじゃなく、替えてもよかった気がする" }]]]));
}
