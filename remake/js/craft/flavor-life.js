// TH77〜82: 赤い葉5枚。使用中の1枚だけが赤→茶→黒→消えると進む。
// hp は次に使える赤い葉の残数。最後の赤が茶色になったら、その一台は失敗。
export const LEAF_MAX = 5;

export function ensureFlavorLife(cs) {
  cs.leaf ??= { hp: LEAF_MAX, max: LEAF_MAX, burn: 0 };
  cs.leaf.max = LEAF_MAX;
  cs.leaf.burn ??= 0;
  return cs.leaf;
}

export function burnFlavorLeaf(leaf) {
  if (leaf.hp <= 0) return;
  if (!leaf.burn) {
    leaf.hp--;
    leaf.burn = 1;
  } else {
    leaf.burn = (leaf.burn + 1) % 3;
  }
}

export function flavorLeafStages(leaf) {
  const hp = leaf?.hp ?? LEAF_MAX, burn = leaf?.burn ?? 0;
  const gone = LEAF_MAX - hp - (burn ? 1 : 0);
  return Array.from({ length: LEAF_MAX }, (_, i) =>
    i < gone ? "gone" : i === gone && burn ? (burn === 1 ? "brown" : "black") : "red");
}
