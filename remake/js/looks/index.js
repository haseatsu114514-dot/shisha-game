// 様式ごとの部品の出し入れ。現行だけで遊ぶ端末には、新版・DS風のコードを読み込ませない。
// 各部品は setActive(on) を公開する。on=false では自分が足した要素・監視・クラスをすべて片付け、現行の画面へ戻す。
import { LOOK_EVENT, currentLook } from "../core/look.js";

const loaders = {
  neo: () => import("./neo.js"),
  retro: () => import("./retro.js"),
};
const loaded = new Map();
let installed = false;
let revision = 0;

async function apply(look) {
  const mine = ++revision;
  for (const [id, mod] of loaded) if (id !== look) mod.setActive(false);
  if (!loaders[look]) return;
  if (!loaded.has(look)) {
    try { loaded.set(look, await loaders[look]()); }
    catch (error) { console.error(`[look] ${look} を読み込めませんでした`, error); return; }
  }
  // 読み込みを待つ間に別の様式へ切り替わっていたら、古いほうは出さない。
  if (mine === revision) loaded.get(look).setActive(true);
}

/** 起動時に一度呼ぶ（core/look.js の initLook の後）。 */
export function installLooks() {
  if (installed) return;
  installed = true;
  document.addEventListener(LOOK_EVENT, (event) => apply(event.detail.look));
  apply(currentLook());
}
