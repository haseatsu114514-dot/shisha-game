// ハートの外形は目印。中央の白丸だけで雑念との接触を判定する。
export const HEART_SIZE = 20;
export function heartHitRadius(gutsTier, focus = 1) {
  return 4 * (1 - 0.2 * gutsTier) / focus;
}
export function heartTouchesBullet(b, x, y, radius) {
  const nearX = Math.max(b.x, Math.min(x, b.x + b.w));
  const nearY = Math.max(b.y, Math.min(y, b.y + b.h));
  return (x - nearX) ** 2 + (y - nearY) ** 2 < radius ** 2;
}
