// 実ゲームと独立したメモリーstorage。設定・既読・ギャラリーも本人の保存へ書かない。
const memory = new Map();
const storage = { getItem: key => memory.get(String(key)) ?? null,
  setItem: (key, value) => memory.set(String(key), String(value)), removeItem: key => memory.delete(String(key)),
  clear: () => memory.clear(), key: index => [...memory.keys()][index] ?? null, get length() { return memory.size; } };
Object.defineProperty(window, 'localStorage', { value: storage });
Object.defineProperty(window, 'sessionStorage', { value: storage });
const [{ loadAll, bgUrl }, core, ui, hud, map, spots, city, preparation, locations, cityData] = await Promise.all([
  import('./core/data.js'), import('./core/state.js'), import('./core/ui.js'), import('./daily/hud.js'),
  import('./daily/map.js'), import('./daily/spots.js'), import('./chapters/ch2-outings.js'),
  import('./chapters/ch2-preparation.js'), import('./core/city-locations.js'), import('./chapters/ch2-city-data.js'),
]);
const stage = document.querySelector('#stage');
function fit() {
  const scale = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.setProperty('--k', scale);
  stage.style.setProperty('--read-scale', Math.max(1, 1 / scale));
}
addEventListener('resize', fit); fit();
document.body.dataset.mapVariant = 'current';
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'map-comparison-variant') return;
  if (['current', 'improved'].includes(event.data.variant)) document.body.dataset.mapVariant = event.data.variant;
});
// 改善案はピンの二度押しで確定しない。カードの確認操作は実装済みのgoを使用する。
document.addEventListener('click', event => {
  if (document.body.dataset.mapVariant !== 'improved') return;
  const pin = event.target.closest('.spot-pin');
  if (pin) {
    document.querySelector('.map-info')?.removeAttribute('data-collapsed');
    if (pin.classList.contains('sel')) event.stopPropagation();
  }
}, true);
try {
  await loadAll(); ui.initLayers(); core.newGame();
  const params = new URLSearchParams(location.search);
  const town = params.get('city') === 'widehanga';
  const scenario = params.get('scenario');
  const unknown = scenario === 'unknown';
  Object.assign(core.state, { chapter:town ? 2 : 1, phase:'daily', day:scenario === 'closed' ? 3 : 4,
    slot:scenario === 'night' ? 1 : 0, weatherSeed:42 });
  core.config.seVolume = core.config.bgmVolume = 0;
  if (!unknown) {
    for (const id of ['sumi','tsumugi','naru','adam','minto','rin','ageha','kumicho','rei']) core.state.met[id] = true;
    Object.assign(core.state.flags, { _spot_guide_naru:true, _spot_guide_adam:true, _spot_guide_minto:true, _cafe_introduced:true, _fortune_rumor_heard:true, _axe_bar_rumor_done:true });
    for (const outing of city.CITY_OUTINGS) core.state.flags[outing.flag] = true;
  }
  hud.initHud({}); hud.showHud(); await ui.warmUiArt();
  const regions = town ? [
    { id:'home', label:`地元・${locations.HOME_CITY_NAME}`, background:bgUrl('bg_osu_map_day'), spots:spots.allSpots },
    { id:'widehanga', label:`隣町・${locations.CH2_CITY_NAME}`, background:cityData.MAP[scenario === 'night' ? 'night' : 'day'],
      spots:() => [...preparation.PREPARATION_SPOTS, city.CITY_SHOP, ...city.knownCityOutings(core.state)] },
  ] : null;
  async function show() {
    const destination = await map.chooseSpot({ regions, regionId:town ? 'widehanga' : null });
    if (destination) {
      parent.postMessage({ type:'map-comparison-result', text:'行き先の確認ができました（試遊のため移動・消費は行いません）。' }, location.origin);
      ui.dropRetired(); void show();
    }
  }
  void show();
  new MutationObserver(() => {
    const info = document.querySelector('.map-info');
    if (!info || info.querySelector('.comparison-close')) return;
    const close = document.createElement('button');
    close.className = 'comparison-close'; close.textContent = '×';
    close.setAttribute('aria-label', '案内を閉じて地図を見る');
    close.onclick = () => { info.dataset.collapsed = 'true'; };
    info.append(close);
  }).observe(document.querySelector('#screen'), { childList:true, subtree:true });
} catch (error) {
  document.querySelector('#screen').textContent = `比較画面を読み込めませんでした: ${error.message}`;
  console.error(error);
}
