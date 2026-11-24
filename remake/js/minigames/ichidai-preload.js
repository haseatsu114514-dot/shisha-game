import { imgFileUrl } from "../core/img-file.js";
import { createPrefetchQueue, prepareImage } from "../core/loading-prefetch.js";
import { CARD, KIT } from "./ichidai-data.js";
import { artUrl, bowlArt, cardArt, coalSprite, faceUrl, flavorArt, hmdArt, JUDGE_FACE } from "./ichidai-art.js";

// CSS で使う卓まわり、結果・審査の部品と、カードを拡大したときの印。
const TABLE_ART = ["window", "button-glass", "button-gold", "medal-gold", "board", "cutin-band"]
  .map((name) => imgFileUrl(`ui/craft-night/${name}.webp`));
const SIGN_ART = ["firepower", "heat", "taste", "capacity", "turn", "puff", "prep", "any", "ignite",
  "fruit", "cool", "spice", "floral", "sweet", "rarity", "vote"]
  .map((name) => imgFileUrl(`ui/ichidai/signs/${name}.svg`));

export async function prepareIchidaiArt(game, { players, portraits, signal, skin }) {
  const urls = new Set([
    artUrl("back", "deck"),
    ...players.map(({ id }) => faceUrl(id)),
  ]);
  // 開始時に確定した場と各席の一式を使う。場の外でも、課題や入門で詰めてある葉は表示する。
  const leaves = new Set(game.market);
  const cards = new Set();
  for (const player of game.P) {
    for (const id of Object.keys(player.bowl)) leaves.add(id);
    for (const [id] of KIT[player.kit].cards) cards.add(id);
    urls.add(bowlArt(player.bowlId, false));
    urls.add(hmdArt(player.hmd));
  }
  for (const id of leaves) urls.add(flavorArt(id)?.url);
  for (const id of cards) {
    urls.add(cardArt(id)?.url);
    if (CARD[id].type !== "coal") continue;
    for (const stage of ["cold", "warm", "hot", "ember"]) {
      urls.add(coalSprite(id === "cube" ? "cube" : "flat", stage));
    }
  }
  for (const id of game.tour.judges) urls.add(faceUrl(JUDGE_FACE[id]));
  for (const url of [...portraits, ...TABLE_ART, imgFileUrl("backgrounds/bg_tonari_inside_night.webp"), artUrl("table", "mat"), artUrl("back", "judge")]) urls.add(url);
  if (!skin || skin === "a" || skin === "b") for (const url of SIGN_ART) urls.add(url);
  if (skin === "a" || skin === "b") urls.add(imgFileUrl(`ui/ichidai/skin-${skin}/mat.webp`));

  // VS と通信・デコードを取り合わないよう件数を絞る。個々の失敗は既存の代替表示に任せる。
  const queue = createPrefetchQueue({ concurrency: 6, capacity: urls.size });
  await Promise.allSettled([...urls].filter(Boolean).map((url) => queue.prepare(url, async () => {
    if (!signal?.aborted) await prepareImage(url, { signal });
  })));
}
