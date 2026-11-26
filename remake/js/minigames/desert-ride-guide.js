// 案内専用の一時状態。物理・採点・セーブには触れない。
import { EDGE, SPEED } from "./desert-ride-model.js";

export const RETURN_GUIDE = Object.freeze({ speed: SPEED.start, seconds: 1.5 });

/** 同じ側の深い砂で低速が続いた時だけ、内側を示す。時計は滑走中の時間。 */
export function createReturnGuide() {
  let side = 0, since = 0;
  return game => {
    const next = game && !game.finished && game.air <= 0 && game.fallT <= 0
      && Math.abs(game.x) > EDGE && game.speed <= RETURN_GUIDE.speed ? Math.sign(game.x) : 0;
    if (!next) { side = 0; return null; }
    if (next !== side || game.t < since) { side = next; since = game.t; }
    if (game.t - since < RETURN_GUIDE.seconds) return null;
    return side < 0 ? "right" : "left";
  };
}
