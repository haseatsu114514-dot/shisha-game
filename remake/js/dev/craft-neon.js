// シーシャ作りパート「ネオン版」試作の切り替え（?debug=1 のデバッグパネル専用）。
// 既定はオフ。craft-neon.css をページ基準で動的に読み込み、<html> に craft-neon クラスを付け外しする。
import { buildVersioned } from "../core/asset-version.js";

const KEY = "suien_debug_craft_neon";
const CLASS = "craft-neon";
const LINK_ID = "craft-neon-style";

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: value => { try { localStorage.setItem(KEY, value); } catch {} },
};

function ensureStylesheet() {
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = buildVersioned(new URL("css/craft-neon.css", document.baseURI).href);
  document.head.append(link);
}

function apply(on) {
  const enabled = Boolean(on);
  if (enabled) ensureStylesheet();
  document.documentElement.classList.toggle(CLASS, enabled);
  return enabled;
}

/** 現在のネオン版状態（オンなら true）。 */
export function craftNeonOn() {
  return document.documentElement.classList.contains(CLASS);
}

/** ネオン版のオン／オフを切り替え、端末へ保存する。 */
export function setCraftNeon(on) {
  const enabled = apply(on);
  store.set(enabled ? "1" : "0");
  return enabled;
}

/** 保存済みの設定を復元する（未保存なら既定のオフのまま）。 */
export function installCraftNeon() {
  return apply(store.get() === "1");
}
