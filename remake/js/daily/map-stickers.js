// #661: 白縁つき施設シール。元の#579プレビュー素材と独立して管理する。
export const FACILITY_SHEET = new URL('../../../assets/ui/map-facility-stickers-661.png', import.meta.url).href;
export const FACILITY_SHEET_SIZE = Object.freeze([1254, 1254]);
// 元画像を変更せずCSSで切り出す。各シールの白縁を含む半開区間。
export const FACILITY_ICONS = Object.freeze({
  kannondo: Object.freeze({ label: '観音堂', rect: Object.freeze([20, 31, 621, 573]) }),
  home: Object.freeze({ label: '自宅', rect: Object.freeze([668, 29, 570, 594]) }),
  choizap: Object.freeze({ label: 'チョイザップ', rect: Object.freeze([654, 623, 583, 597]) }),
  kohaku: Object.freeze({ label: '喫茶こはく', rect: Object.freeze([16, 626, 625, 588]) }),
});
export const FACILITY_ICON_SIZES = Object.freeze([32, 48, 64, 128]);

export function facilityIconLayout(id, size = 48) {
  const entry = Object.hasOwn(FACILITY_ICONS, id) && FACILITY_ICONS[id];
  if (!entry) throw new RangeError(`Unknown facility: ${id}`);
  if (!FACILITY_ICON_SIZES.includes(size)) throw new RangeError(`Unsupported icon size: ${size}`);
  const [x, y, width, height] = entry.rect;
  const scale = size / Math.max(width, height);
  return { width: width * scale, height: height * scale,
    sheetWidth: 1254 * scale, sheetHeight: 1254 * scale,
    left: -x * scale, top: -y * scale };
}

export function createFacilityIcon(id, { size = 48, decorative = false, document = globalThis.document } = {}) {
  const layout = facilityIconLayout(id, size);
  const icon = document.createElement('span');
  icon.className = 'facility-icon';
  icon.dataset.facility = id;
  icon.style.width = icon.style.height = `${size}px`;
  if (decorative) icon.setAttribute('aria-hidden', 'true');
  else { icon.setAttribute('role', 'img'); icon.setAttribute('aria-label', FACILITY_ICONS[id].label); }
  const crop = document.createElement('span');
  crop.className = 'facility-icon-crop';
  crop.style.width = `${layout.width}px`;
  crop.style.height = `${layout.height}px`;
  const image = document.createElement('img');
  image.src = FACILITY_SHEET;
  image.alt = '';
  image.draggable = false;
  for (const [property, value] of Object.entries({ width: layout.sheetWidth, height: layout.sheetHeight,
    left: layout.left, top: layout.top })) image.style[property] = `${value}px`;
  crop.append(image);
  icon.append(crop);
  return icon;
}
