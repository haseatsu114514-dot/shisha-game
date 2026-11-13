// DJ の手応えの数値（2026-11-13 DJF11）。演出・音量・間だけをここに集める。採点・判定・フロアの熱の決まりは model.mjs（ここでは変えない）。
// 凍結しない: ブラウザのコンソールで `__dj.feel.hold.PERFECT = 140` のように書き換えると、止めずにその場で変わる（保存はされない）。
// URL でも上書きできる: `?feel=hold.PERFECT:140,afterglow.ms:0`（数値だけ）。
export const FEEL = {
  // 【止め】決まった瞬間、フロアの絵（客・光・皿の回転）だけを止める時間 ms。曲は止めない（拍が狂うので）。明けた瞬間に客が跳ねる
  hold: { PERFECT: 90, GOOD: 60, OK: 0, EARLY: 0, LATE: 0, S: 110, A: 70, B: 0, C: 0, finish: 140, stamp: 60 },
  // 【止めの間の暗さ】止めている間のフロアの明るさ（1 = そのまま）。暗く落としてから白く光らせる
  holdDim: .55,
  // 【跳ね】止めが明けた後、客がいつもより高く跳ねる倍率と、元に戻るまでの拍数
  burst: { PERFECT: 2.2, GOOD: 1.6, S: 2.4, A: 1.7, combo: 1.35, finish: 2.6, beats: 2 },
  // 【揺れの型】drop = 縦にドン（入り）／sway = 横に小さく（フェーダーが8拍続いた）／big = 縦横＋手前へ（S のつなぎ・セット終了）／stumble = 横にがくっ（入りを外した・つなぎが荒れた）
  shake: { PERFECT: 'drop', GOOD: 'drop', EARLY: 'stumble', LATE: 'stumble', combo8: 'sway', combo16: 'sway', combo24: 'drop', combo32: 'big', S: 'big', A: 'drop', C: 'stumble', finish: 'big' },
  // 【閃光】白い光の強さ（0〜1）。止めが明けた瞬間に出て、すっと消える
  flash: { PERFECT: 1, GOOD: .6, combo: .35, S: 1, A: .6, finish: 1 },
  // 【音符】決まった時に客席から上がる音符の数
  notes: { PERFECT: 8, GOOD: 4, S: 12, A: 6, finish: 20 },
  // 【振動】スマホの振動 ms（並びは「振動・休み・振動…」）
  buzz: { PERFECT: [14, 36, 22], GOOD: [14], OK: [8], EARLY: [36], LATE: [36], combo: [10], broken: [24], S: [16, 40, 16, 40, 30], A: [16, 40, 20], finish: [20, 50, 20, 50, 40] },
  // 【効果音】全体の大きさ（曲の音量に対する倍率）と、出来事ごとの大きさ。大きい出来事ほど大きく
  sfx: { master: 1, tick: .16, tickLast: .22, click: .22, impact: .5, impactSmall: .32, stumble: .26, clap: .2, thud: .22, up: .2, down: .2, stamp: .42,
    cheer: { PERFECT: .5, GOOD: .26, combo16: .14, combo24: .2, combo32: .34, S: .6, A: .34, pickGreat: .22, finishS: .7, finishA: .55, finishB: .3, finishC: 0 },
    applause: { S: .5, A: .4, B: .26, C: .12 } },
  // 【カウントの音】入りの手前の 4・3・2・1 に小さなクリック（最後の1つだけ少し高い）。0 = 鳴らさない
  countTicks: 4,
  // 【コンボの字】段（〜7・8〜・16〜・24〜）ごとの字の大きさ px（スマホ表示は幅が無いので 20〜23 で固定）
  comboSize: [14, 16, 18, 20],
  // 【セット終了の余韻】結果の板を出すまでの時間 ms（タップ・クリック・キーで飛ばせる）と、点を数え上げる時間 ms
  afterglow: { ms: 1500, countUp: 900, reducedMs: 300 },
};
const leaf = (path) => { const keys = path.split('.'), last = keys.pop(); let at = FEEL; for (const k of keys) { at = at?.[k]; if (!at || typeof at !== 'object') return null; } return last in at && typeof at[last] === 'number' ? [at, last] : null; };
/** `?feel=hold.PERFECT:140,afterglow.ms:0` → FEEL を上書きする（知らない名前・数値でない値は無視）。 */
export function applyFeelOverrides(text) {
  const done = [];
  for (const part of String(text || '').split(',')) {
    const [path, raw] = part.split(':'), value = Number(raw), at = path && raw !== undefined && raw !== '' && Number.isFinite(value) ? leaf(path.trim()) : null;
    if (at) { at[0][at[1]] = value; done.push(path.trim()); }
  }
  return done;
}
