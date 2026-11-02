// Reusable facility art. No unlock, guest or save dependencies.
export const FACILITY_SHEET = new URL('../../../assets/ui/map-facilities-579.webp', import.meta.url).href;
export const FACILITY_SHEET_SIZE = Object.freeze([2172, 724]);
export const FACILITY_EXTRA_SHEET = new URL('../../../assets/ui/map-facilities-extra-579.webp', import.meta.url).href;
export const CINEMA_ICON = new URL('../../../assets/ui/map-rojiura-cinema.webp', import.meta.url).href;
// 地図アイコンの追加分（2026-11-02 MPI。Codex の候補からオーナーが採用）。1枚ずつの透過 WebP（長辺384px）。
// 路上占いは「どこに現れても違和感のない」持ち運びの出店に作り直した（旧版は extra シートの店構え。シートは残す）。
const single = (file, label, [width, height], badge) => Object.freeze({ badge: Object.freeze(badge), label,
  src: new URL(`../../../assets/ui/${file}`, import.meta.url).href,
  sheetSize: Object.freeze([width, height]), rect: Object.freeze([0, 0, width, height]) });
// Half-open crops with two source pixels of breathing room. Badge anchors touch an opaque right-side contour.
export const FACILITY_ICONS = Object.freeze({
  rojiura_cinema: Object.freeze({ badge: Object.freeze([476, 170]), label: '路地裏シネマ', src: CINEMA_ICON,
    sheetSize: Object.freeze([512, 512]), rect: Object.freeze([0, 0, 512, 512]) }),
  kannondo: Object.freeze({ badge: Object.freeze([743, 244]), label: '観音堂', rect: Object.freeze([21, 87, 815, 561]) }),
  home: Object.freeze({ badge: Object.freeze([1453, 281]), label: '自宅', rect: Object.freeze([842, 125, 663, 556]) }),
  kohaku: Object.freeze({ badge: Object.freeze([1994, 293]), label: '喫茶こはく', rect: Object.freeze([1552, 104, 568, 539]) }),
  axe_bar: Object.freeze({ badge: Object.freeze([688, 153]), label: '斧投げBar', extra: true, rect: Object.freeze([56, 14, 655, 495]) }),
  choizap: Object.freeze({ badge: Object.freeze([1466, 178]), label: 'CHOI-ZAP', extra: true, rect: Object.freeze([844, 49, 633, 459]) }),
  trpg_bar: Object.freeze({ badge: Object.freeze([1425, 650]), label: 'ボドゲカフェ', extra: true, rect: Object.freeze([821, 512, 664, 494]) }),
  fortune: single('map-facilities-fortune-stall.webp', '路上占い', [384, 383], [347, 144]),
  tokyo_park: single('map-facilities-tokyo-park.webp', '東京の公園', [384, 347], [361, 120]),
  mukai_back_room: single('map-facilities-mukai-back-room.webp', 'mukaiの奥の部屋', [384, 327], [368, 82]),
  mukai_attic: single('map-facilities-mukai-attic.webp', 'mukaiの屋根裏', [384, 377], [379, 134]),
  smartphone: single('map-facilities-smartphone.webp', 'スマホ', [353, 384], [265, 96]),
  shinkansen_station: single('map-facilities-shinkansen-station.webp', '新幹線の駅', [384, 354], [312, 175]),
  dubai_souq: single('map-facilities-dubai-souq.webp', 'スーク', [384, 324], [380, 89]),
  dubai_creek: single('map-facilities-dubai-creek.webp', 'クリーク沿い', [384, 298], [378, 132]),
  dubai_mosque: single('map-facilities-dubai-mosque.webp', '風の回廊モスク', [384, 327], [378, 147]),
  dubai_inn: single('map-facilities-dubai-inn.webp', '旧市街の宿', [384, 347], [380, 157]),
  dubai_inn_lobby: single('map-facilities-dubai-inn-lobby.webp', '宿のロビー', [384, 311], [372, 80]),
  dubai_practice_hall: single('map-facilities-dubai-practice-hall.webp', '公式練習会場', [384, 269], [368, 67]),
});
export const FACILITY_ICON_SIZES = Object.freeze([32, 48, 64, 80, 96, 128]);
const SPOT_ICONS = Object.freeze({ kannon: 'kannondo', rest: 'home', cafe: 'kohaku',
  rojiura_cinema: 'rojiura_cinema',
  axe_bar: 'axe_bar', choizap: 'choizap', fortune: 'fortune', trpg_bar: 'trpg_bar',
  ch3_tokyo_gym: 'choizap', // 第3章の東京のCHOI-ZAP（同じチェーンの高架下の店）
  // MPI: 東京・ドバイ・第5章の行き先。新幹線の駅は2か所で共用（オーナー決定 2026-11-02）。路地裏の神社は場所の決定待ち（#2166）
  ch3_tokyo_park: 'tokyo_park', ch5_tokyo_park: 'tokyo_park', ch3_tokyo_room: 'mukai_back_room', ch5_tokyo_attic: 'mukai_attic',
  // 第3章の「地元と連絡」はスマホの絵でなく LIME のマーク（map.js・オーナー決定 2026-11-02）
  ch5_call: 'smartphone', ch5_to_tokyo: 'shinkansen_station', ch5_tokyo_home: 'shinkansen_station',
  ch4_dubai_souq: 'dubai_souq', ch4_dubai_creek: 'dubai_creek', ch4_dubai_mosque: 'dubai_mosque', ch4_dubai_inn: 'dubai_inn',
  ch4_dubai_naru: 'dubai_inn_lobby', ch4_dubai_practice: 'dubai_practice_hall' });
export const hasFacilityIcon = id => Object.hasOwn(SPOT_ICONS, id);

// Morphology follows the alpha silhouette, rather than adding a rectangular backing.
function ensureStickerOutline(document) {
  if (document.getElementById('facility-sticker-outline')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
  svg.innerHTML = '<defs><filter id="facility-sticker-outline" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
    '<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="edge"/>' +
    '<feFlood flood-color="#fff3df" result="white"/><feComposite in="white" in2="edge" operator="in" result="border"/>' +
    '<feMerge><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  document.body.append(svg);
}

export function createMapFacilityIcon(spotId) {
  return hasFacilityIcon(spotId) ? createFacilityIcon(SPOT_ICONS[spotId], { size: 96, decorative: true, sticker: true }) : null;
}

export function facilityIconLayout(id, size = 48) {
  const entry = Object.hasOwn(FACILITY_ICONS, id) && FACILITY_ICONS[id];
  if (!entry) throw new RangeError(`Unknown facility: ${id}`);
  if (!FACILITY_ICON_SIZES.includes(size)) throw new RangeError(`Unsupported icon size: ${size}`);
  const [x, y, width, height] = entry.rect;
  const [sheetWidth, sheetHeight] = entry.sheetSize || (entry.extra ? [1536, 1024] : FACILITY_SHEET_SIZE);
  const scale = size / Math.max(width, height);
  return { width: width * scale, height: height * scale,
    sheetWidth: sheetWidth * scale, sheetHeight: sheetHeight * scale,
    badgeX: (entry.badge[0] - x) * scale, badgeY: (entry.badge[1] - y) * scale,
    left: -x * scale, top: -y * scale, src: entry.src || (entry.extra ? FACILITY_EXTRA_SHEET : FACILITY_SHEET) };
}

export function createFacilityIcon(id, { size = 48, decorative = false, sticker = false, document = globalThis.document } = {}) {
  const layout = facilityIconLayout(id, size);
  if (sticker) ensureStickerOutline(document);
  const icon = document.createElement('span');
  icon.className = `facility-icon${sticker ? ' sticker' : ''}`;
  icon.dataset.facility = id;
  icon.style.width = icon.style.height = `${size}px`;
  icon.style.setProperty('--facility-badge-x', `${layout.badgeX}px`);
  icon.style.setProperty('--facility-badge-y', `${layout.badgeY}px`);
  if (decorative) icon.setAttribute('aria-hidden', 'true');
  else { icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', FACILITY_ICONS[id].label); }
  const crop = document.createElement('span');
  crop.className = 'facility-icon-crop';
  crop.style.width = `${layout.width}px`;
  crop.style.height = `${layout.height}px`;
  const image = document.createElement('img');
  image.fetchPriority = 'high';
  image.decoding = 'async';
  image.src = layout.src;
  image.alt = '';
  image.draggable = false;
  if (id === 'rojiura_cinema') image.onerror = () => {
    crop.textContent = '映';
    crop.style.display = 'grid';
    crop.style.placeItems = 'center';
  };
  for (const [property, value] of Object.entries({ width: layout.sheetWidth, height: layout.sheetHeight,
    left: layout.left, top: layout.top })) image.style[property] = `${value}px`;
  crop.append(image);
  icon.append(crop);
  return icon;
}
