// DJ の縦画面（?layout=portrait。2026-11-27 オーナー「DJも縦画面で遊べるようの欲しい。左右の皿とか写すと小さくなるのでズームする感じで次に触る側へ」）。
// 見た目だけ: 音・判定・採点（app.mjs・model.mjs・audio.mjs）には触れない。この引数が無ければ何もしない（横の画面はそのまま）。
// 並べ方は portrait.css。ここでやるのは3つ:
//   1. 画面の当て方: 幅 640 の縦長の板（高さは画面の縦横比のぶん。39:66〜39:92）。横の当て方（controller-fx.mjs）は幅と倍率を横用に入れるので、縦は別の変数（--ps・--ph）で当てる。
//   2. 寄る先（data-focus）: 次に触る側の皿へ寄る。a＝左の皿、b＝右の皿、wide＝両方を引いて見せる（つなぐ・選ぶ・結果）。
//      本編が画面に出している印だけを読んで決める（▶の金の矢印・皿の矢印・横フェーダーの枠・選曲の札・皿の役割 data-role）。
//   3. 皿の大きさ（--pjog）: 寄った時に、皿の置き場いっぱいの大きさにする。
// ?shot=a|b|mix は、一覧（PC）に並べる止め絵（寄る先を固定し、遊び方の板を閉じる）。
const params = new URLSearchParams(location.search);
if (params.get('layout') === 'portrait') {
  const root = document.documentElement, stage = document.getElementById('dj-stage'), $ = id => document.getElementById(id);
  root.dataset.layout = 'portrait';
  root.dataset.density = 'phone'; // 字と押す所は、本編のスマホ向けの大きさ（style.css の phone density）を土台にする
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('./portrait.css', import.meta.url).href;
  document.head.append(link);

  const W = 640, MIN_H = W * 66 / 39, MAX_H = W * 92 / 39;
  function fit() {
    const k = Math.min(innerWidth / W, innerHeight / MIN_H);
    stage.style.setProperty('--ps', String(k));
    stage.style.setProperty('--ph', `${Math.round(Math.min(innerHeight / k, MAX_H))}px`);
    // 皿は、置き場の幅と、曲名・▶の段を除いた高さに収まる大きさ
    const deck = $('deck-a');
    if (deck.offsetWidth) stage.style.setProperty('--pjog', `${Math.round(Math.max(220, Math.min(deck.offsetWidth - 150, deck.offsetHeight - 24)))}px`);
  }
  link.addEventListener('load', () => { fit(); dispatchEvent(new Event('resize')); }); // 並べ替えた後の寸法で、本編にも測り直させる
  addEventListener('resize', fit);
  fit();

  const shot = params.get('shot'), forced = { a: 'a', b: 'b', mix: 'wide' }[shot] || null;
  const shown = key => !$(key).hidden;
  /** いま寄る先。 */
  function focus() {
    if (forced) return forced;
    if (shown('pick') || $('score-result').childElementCount) return 'wide';
    for (const key of ['a', 'b']) if (shown('jog-arrows-' + key)) return key; // ズレを直す皿
    for (const key of ['a', 'b']) if (shown('point-play-' + key)) return key; // いま押す ▶
    if (shown('guide')) return 'wide';                                        // つなぎの最中は、横フェーダー（皿は引きで）
    const roles = ['a', 'b'].map(key => $('deck-' + key).dataset.role);
    const next = roles.indexOf('next');
    // カウント待ちの間に、次に入れる曲の皿へ先に寄っておく（片方が鳴っていて、もう片方に曲が載っている時）
    if (next >= 0 && roles.includes('master')) return 'ab'[next];
    if (roles.includes('incoming')) return 'wide';
    return 'a'; // 始める前は左の皿（最初の ▶）
  }
  const sync = () => { const next = focus(); if (stage.dataset.focus !== next) stage.dataset.focus = next; };
  const watch = new MutationObserver(sync);
  for (const id of ['pick', 'guide', 'jog-arrows-a', 'jog-arrows-b', 'point-play-a', 'point-play-b', 'deck-a', 'deck-b'])
    watch.observe($(id), { attributes: true, attributeFilter: ['hidden', 'data-role', 'data-playing'] });
  watch.observe($('score-result'), { childList: true });
  sync();
  if (forced) { // 止め絵: 触れない・遊び方の板は閉じる
    root.dataset.fixed = '';
    const close = () => { if (!$('howto').hidden) $('help').click(); };
    setTimeout(close, 300); setTimeout(close, 1200);
  }
}
