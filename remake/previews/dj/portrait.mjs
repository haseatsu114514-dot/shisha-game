// DJ の縦画面（?layout=portrait。2026-11-27 オーナー「DJも縦画面で遊べるようの欲しい。左右の皿とか写すと小さくなるのでズームする感じで次に触る側へ」）。
// 見た目だけ: 音・判定・採点（app.mjs・model.mjs・audio.mjs）には触れない。この引数が無ければ何もしない（横の画面はそのまま）。
// 並べ方は portrait.css。ここでやるのは3つ:
//   1. 画面の当て方: 幅 640 の縦長の板（高さは画面の縦横比のぶん。39:66〜39:92）。横の当て方（controller-fx.mjs）は幅と倍率を横用に入れるので、縦は別の変数（--ps・--ph）で当てる。
//   2. 寄る先（data-focus）: ブースは横と同じ機材の配置のまま、次に触る側へ寄って拡大する（VPG13）。a＝左の皿、b＝右の皿、wide＝真ん中（案内とミキサー。つなぐ・選ぶ・結果）。
//      本編が画面に出している印だけを読んで決める（▶の金の矢印・皿の矢印・横フェーダーの枠・選曲の札・皿の役割 data-role）。寄る倍率（--zd・--zc）もここで決める。
//   3. いまやること（案内の1行）を、フロアのすぐ下へ写す（皿へ寄っている間、真ん中の案内は窓の外になるので）。
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
  const FLOOR = 300, COACH = 84, BOOTH_H = 432; // フロアの高さ・案内の1行の高さ・ブースの元の高さ（style.css の値）
  function fit() {
    const k = Math.min(innerWidth / W, innerHeight / MIN_H), height = Math.round(Math.min(innerHeight / k, MAX_H));
    stage.style.setProperty('--ps', String(k));
    stage.style.setProperty('--ph', `${height}px`);
    // ブースを映す場所（フロアと案内の下）と、寄る倍率: 皿の列（幅 384）・真ん中の列（幅 500）が、幅と高さの両方に収まる所まで
    const area = height - FLOOR - COACH;
    stage.style.setProperty('--ctop', `${FLOOR + COACH}px`);
    stage.style.setProperty('--area-h', `${area}px`);
    stage.style.setProperty('--zd', Math.min(W / 384, area / BOOTH_H).toFixed(3));
    stage.style.setProperty('--zc', Math.min(W / 500, area / BOOTH_H).toFixed(3));
  }
  link.addEventListener('load', () => { fit(); dispatchEvent(new Event('resize')); }); // 並べ替えた後の寸法で、本編にも測り直させる
  addEventListener('resize', fit);
  fit();
  // いまやること（案内の1行）を、フロアのすぐ下へ写す（皿へ寄っている間、真ん中の案内は窓の外になる）
  const coach = Object.assign(document.createElement('p'), { className: 'p-coach' });
  coach.setAttribute('aria-hidden', 'true'); // 読み上げは本編の案内（#coaching）がする
  stage.append(coach);
  const copyCoach = () => { const from = $('coaching'); if (coach.textContent !== from.textContent) coach.textContent = from.textContent; coach.classList.toggle('warn', from.classList.contains('warn')); };
  new MutationObserver(copyCoach).observe($('coaching'), { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  copyCoach();

  const shot = params.get('shot'), forced = { a: 'a', b: 'b', mix: 'wide' }[shot] || null;
  const shown = key => !$(key).hidden;
  /** いま寄る先。 */
  function focus() {
    if (forced) return forced;
    if (shown('pick') || $('score-result').childElementCount) return 'wide';
    // つなぎの最中は真ん中（横フェーダー）。拍がズレても皿へは寄らず、横フェーダーのすぐ上の ◀・▶（ズレ直しのボタン・VPG15）で直す
    if (shown('guide')) return 'wide';
    for (const key of ['a', 'b']) if (shown('jog-arrows-' + key)) return key; // ズレを直す皿
    for (const key of ['a', 'b']) if (shown('point-play-' + key)) return key; // いま押す ▶
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
