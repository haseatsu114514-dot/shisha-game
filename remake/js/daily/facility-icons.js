// Reusable facility art. No unlock, guest or save dependencies.
export const FACILITY_SHEET = new URL('../../../assets/ui/map-facilities-579.webp', import.meta.url).href;
export const FACILITY_SHEET_SIZE = Object.freeze([2172, 724]);
export const FACILITY_EXTRA_SHEET = new URL('../../../assets/ui/map-facilities-extra-579.webp', import.meta.url).href;
export const CINEMA_ICON = new URL('../../../assets/ui/map-rojiura-cinema.webp', import.meta.url).href;
// Half-open crops with two source pixels of breathing room. Badge anchors touch an opaque right-side contour.
export const FACILITY_ICONS = Object.freeze({
  rojiura_cinema: Object.freeze({ badge: Object.freeze([476, 170]), label: '路地裏シネマ', src: CINEMA_ICON,
    sheetSize: Object.freeze([512, 512]), rect: Object.freeze([0, 0, 512, 512]) }),
  kannondo: Object.freeze({ badge: Object.freeze([743, 244]), label: '観音堂', rect: Object.freeze([21, 87, 815, 561]) }),
  home: Object.freeze({ badge: Object.freeze([1453, 281]), label: '自宅', rect: Object.freeze([842, 125, 663, 556]) }),
  kohaku: Object.freeze({ badge: Object.freeze([1994, 293]), label: '喫茶こはく', rect: Object.freeze([1552, 104, 568, 539]) }),
  axe_bar: Object.freeze({ badge: Object.freeze([688, 153]), label: '斧投げBar', extra: true, rect: Object.freeze([56, 14, 655, 495]) }),
  choizap: Object.freeze({ badge: Object.freeze([1466, 178]), label: 'CHOI-ZAP', extra: true, rect: Object.freeze([844, 49, 633, 459]) }),
  fortune: Object.freeze({ badge: Object.freeze([659, 652]), label: '路上占い', extra: true, rect: Object.freeze([81, 513, 632, 496]) }),
  trpg_bar: Object.freeze({ badge: Object.freeze([1425, 650]), label: 'ボドゲカフェ', extra: true, rect: Object.freeze([821, 512, 664, 494]) }),
});
export const FACILITY_ICON_SIZES = Object.freeze([32, 48, 64, 80, 96, 128]);
const SPOT_ICONS = Object.freeze({ kannon: 'kannondo', rest: 'home', cafe: 'kohaku',
  rojiura_cinema: 'rojiura_cinema',
  axe_bar: 'axe_bar', choizap: 'choizap', fortune: 'fortune', trpg_bar: 'trpg_bar' });
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
