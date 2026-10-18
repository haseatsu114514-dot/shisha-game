// Reusable facility art. No unlock, guest or save dependencies.
export const FACILITY_SHEET = new URL('../../../assets/ui/map-facilities-579.png', import.meta.url).href;
export const FACILITY_SHEET_SIZE = Object.freeze([2172, 724]);
export const FACILITY_EXTRA_SHEET = new URL('../../../assets/ui/map-facilities-extra-579.webp', import.meta.url).href;
// Half-open source coordinates; two source pixels of breathing room around alpha > 2.
export const FACILITY_ICONS = Object.freeze({
  kannondo: Object.freeze({ label: '観音堂', rect: Object.freeze([21, 87, 815, 561]) }),
  home: Object.freeze({ label: '自宅', rect: Object.freeze([842, 125, 663, 556]) }),
  kohaku: Object.freeze({ label: '喫茶こはく', rect: Object.freeze([1552, 104, 568, 539]) }),
  axe_bar: Object.freeze({ label: '斧投げBar', extra: true, rect: Object.freeze([56, 14, 655, 495]) }),
  choizap: Object.freeze({ label: 'チョイザップ', extra: true, rect: Object.freeze([844, 49, 633, 459]) }),
  fortune: Object.freeze({ label: '路上占い', extra: true, rect: Object.freeze([81, 513, 632, 496]) }),
  trpg_bar: Object.freeze({ label: 'ボドゲカフェ', extra: true, rect: Object.freeze([821, 512, 664, 494]) }),
});
export const FACILITY_ICON_SIZES = Object.freeze([32, 48, 64, 80, 128]);
const SPOT_ICONS = Object.freeze({ kannon: 'kannondo', rest: 'home', cafe: 'kohaku',
  axe_bar: 'axe_bar', choizap: 'choizap', fortune: 'fortune', trpg_bar: 'trpg_bar' });
export const hasFacilityIcon = id => Object.hasOwn(SPOT_ICONS, id);

// Morphology follows the alpha silhouette, rather than adding a rectangular backing.
function ensureStickerOutline(document) {
  if (document.getElementById('facility-sticker-outline')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
  svg.innerHTML = '<defs><filter id="facility-sticker-outline" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
    '<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="edge"/>' +
    '<feFlood flood-color="#fff3df" result="white"/><feComposite in="white" in2="edge" operator="in" result="border"/>' +
    '<feMerge><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  document.body.append(svg);
}

export function createMapFacilityIcon(spotId) {
  return hasFacilityIcon(spotId) ? createFacilityIcon(SPOT_ICONS[spotId], { size: 80, decorative: true, sticker: true }) : null;
}

export function facilityIconLayout(id, size = 48) {
  const entry = Object.hasOwn(FACILITY_ICONS, id) && FACILITY_ICONS[id];
  if (!entry) throw new RangeError(`Unknown facility: ${id}`);
  if (!FACILITY_ICON_SIZES.includes(size)) throw new RangeError(`Unsupported icon size: ${size}`);
  const [x, y, width, height] = entry.rect;
  const [sheetWidth, sheetHeight] = entry.extra ? [1536, 1024] : FACILITY_SHEET_SIZE;
  const scale = size / Math.max(width, height);
  return { width: width * scale, height: height * scale,
    sheetWidth: sheetWidth * scale, sheetHeight: sheetHeight * scale,
    left: -x * scale, top: -y * scale, src: entry.extra ? FACILITY_EXTRA_SHEET : FACILITY_SHEET };
}

export function createFacilityIcon(id, { size = 48, decorative = false, sticker = false, document = globalThis.document } = {}) {
  const layout = facilityIconLayout(id, size);
  if (sticker) ensureStickerOutline(document);
  const icon = document.createElement('span');
  icon.className = `facility-icon${sticker ? ' sticker' : ''}`;
  icon.dataset.facility = id;
  icon.style.width = icon.style.height = `${size}px`;
  if (decorative) icon.setAttribute('aria-hidden', 'true');
  else { icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', FACILITY_ICONS[id].label); }
  const crop = document.createElement('span');
  crop.className = 'facility-icon-crop';
  crop.style.width = `${layout.width}px`;
  crop.style.height = `${layout.height}px`;
  const image = document.createElement('img');
  image.src = layout.src;
  image.alt = '';
  image.draggable = false;
  for (const [property, value] of Object.entries({ width: layout.sheetWidth, height: layout.sheetHeight,
    left: layout.left, top: layout.top })) image.style[property] = `${value}px`;
  crop.append(image);
  icon.append(crop);
  return icon;
}
