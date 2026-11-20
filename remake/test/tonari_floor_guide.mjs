// フロア専用の店内画（STAGES.floor）の「配置図」。絵が届く前に、位置と重なりを実画面で確かめるための仮の店内を描く。
// ブラウザの中で使う（canvas）。検査（test/browser/tonari_floor.mjs）と、Codex へ渡す配置図
// （asset_sources/ui/tonari-floor-20261120/layout-guide.png）の両方をここから作る。ゲーム本体は読み込まない。
import { STAGES } from "../js/daily/tonari-floor-stage.js";

const W = 1600, H = 900;
const px = ([x, y, w, h]) => [x * W / 100, y * H / 100, w * W / 100, h * H / 100];

function box(ctx, rect, fill, radius = 10, stroke = null) {
  const [x, y, w, h] = px(rect);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/** 店内（卓を除く）と、卓の前景の2枚を描いて data URL で返す。 */
export function drawFloorGuide({ night = false, zones = false } = {}) {
  const stage = STAGES.floor;
  const room = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const front = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const r = room.getContext("2d"), f = front.getContext("2d");
  // 壁と床
  r.fillStyle = night ? "#c9a37a" : "#ead9bd"; r.fillRect(0, 0, W, H * 0.44);
  r.fillStyle = night ? "#7a4a2c" : "#a8683c"; r.fillRect(0, H * 0.44, W, H * 0.56);
  r.fillStyle = "#4a2f1e"; r.fillRect(0, 0, W, H * 0.035);
  // 窓（奥の壁）
  for (const x of [11, 36, 61]) box(r, [x, 11, 20, 15], night ? "#22305a" : "#9fd0ea", 4, "#6b4226");
  // 灯り
  for (const [x, y, radius] of stage.lamps) {
    r.beginPath(); r.arc(x * W / 100, y * H / 100, radius * 4, 0, Math.PI * 2);
    r.fillStyle = ["#d9573f", "#3f7bd9", "#e2b13c", "#4ea66a"][Math.round(x) % 4]; r.fill();
  }
  // 敷物・入口・カウンター
  box(r, stage.rug, "#b5645a", 6, "#7c3f3a");
  box(r, stage.door, "#5b3a22", 4, "#3a2416");
  box(r, [stage.door[0] + 1.5, stage.door[1] + 4, stage.door[2] - 3.5, 30], night ? "#22305a" : "#9fd0ea", 4);
  box(r, stage.counter, "#6e4326", 4, "#3a2416");
  box(r, [stage.counter[0], stage.counter[1], stage.counter[2], 9], "#9a6238", 4);
  // ソファ（背と座面）と卓（卓は前景へ）
  for (const spot of stage.spots) {
    const [x, y, w, h] = spot.sofa;
    box(r, [x, y, w, h], "#4f6a3c", 14, "#31432a");
    box(r, [x + 1, y + h * 0.62, w - 2, h * 0.34], "#6f8a52", 10);
    const [tx, ty, tw, th] = spot.table;
    box(f, [tx, ty, tw, th], "#8a5226", 8, "#4a2f1e");
    box(f, [tx, ty, tw, th * 0.6], "#b9743a", 8);
  }
  if (zones) {
    // Codex へ渡す配置図: ゲームが重ねる物の場所（灰＝帯と札、点線＝客の絵、白丸＝番号札、白い縦棒＝卓の上の一台）
    r.drawImage(front, 0, 0);
    r.fillStyle = "#2b2b2b99";
    r.fillRect(0, 0, W, H * 0.13);
    r.fillRect(W * 0.18, H * 0.875, W * 0.64, H * 0.11);
    r.fillRect(W * 0.012, H * 0.14, W * 0.117, H * 0.14);
    r.fillRect(W * 0.8, H * 0.14, W * 0.188, H * 0.32);
    r.setLineDash([12, 8]); r.lineWidth = 4; r.strokeStyle = "#ffffff";
    for (const spot of stage.spots) {
      const gh = spot.h * H / 100, gw = gh * 1.5; // 二人組の絵（横1.5）が入る範囲
      r.strokeRect(spot.seat[0] * W / 100 - gw / 2, spot.seat[1] * H / 100 - gh, gw, gh);
    }
    r.setLineDash([]);
    for (const spot of stage.spots) {
      r.beginPath(); r.arc(spot.plate[0] * W / 100, spot.plate[1] * H / 100, 20, 0, Math.PI * 2);
      r.fillStyle = "#ffffff"; r.fill();
      r.fillRect(spot.prop[0] * W / 100 - 5, (spot.prop[1] - spot.propH) * H / 100, 10, spot.propH * H / 100);
    }
  }
  return { room: room.toDataURL("image/png"), front: front.toDataURL("image/png") };
}

/** 配置図を絵として持つ舞台。runTonariFloor({ stage: floorGuideStage() }) で専用レイアウトを試せる。 */
export function floorGuideStage({ night = false } = {}) {
  const { room, front } = drawFloorGuide({ night });
  return { ...STAGES.floor, id: "floor-guide", art: { day: room, night: room, frontDay: front, frontNight: front } };
}
