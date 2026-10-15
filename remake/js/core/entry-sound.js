// 予約だけでは鳴らさない。背景DOMの差し替えまで確定した移動だけを一度確定する。
export function bellEntry(spotId, chapter) {
  return spotId === "tonari" || (spotId === "mukai" && chapter === 3);
}
export function createEntrySound(opts, chapter, ring) {
  let committed = false;
  return (url) => {
    if (committed) return;
    committed = true;
    // 現行の接続はtonariのみ。古い予約で別の背景を開いても鳴らさない。
    if (opts?.spotId === "tonari" && bellEntry(opts.spotId, chapter)
      && /(?:^|\/)bg_tonari_inside(?:_(?:overcast_)?(?:day|night))?\.(?:png|webp)(?:[?#]|$)/.test(String(url))) ring();
  };
}
