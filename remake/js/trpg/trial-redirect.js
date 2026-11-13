// TRPGの試遊は、本編から起動する1本にまとめた（TRF21）。
// 物語だけ・本棚だけを直接開く古いページ（trpg-preview.html・trpg-campaign-preview.html）を人が開いた時は、
// 本編の試遊（index.html?trial=trpg）へ送る。自動検査（navigator.webdriver）と、開発で直接開く時（?harness=1）は
// これまでどおり、このページをそのまま使う。
const direct = typeof navigator !== "undefined" && navigator.webdriver === true
  || new URLSearchParams(globalThis.location?.search || "").has("harness");
export const redirectedToTrial = !direct && typeof location !== "undefined";
if (redirectedToTrial) location.replace(new URL("index.html?trial=trpg", location.href).href);
