// CAMEL RACE の画面（Canvas 描写・操作・チュートリアル・リザルト）。計算は camel-race-model.js。
// 本編の #stage（1280×720）か、独立ページの host に重ねて開く。本編の保存・進行・体力はここでは触らない
// （結果を返すだけ。記録と報酬は chapters/ch4-camel-race.js が確定する）。
//
// 操作: Space＝声をかける（輪が重なる瞬間・当たるとその場で一伸び）／X＝押している間ムチ（騎手の腕が回る・スタミナを使う）。
// スマホは下の2つの大きなボタン（ムチは押し続ける）。
// ラクダ・ロボット騎手・SUV・車輪は Codex の絵（assets/ui/camel_race・2026-11-02 採用。原画は asset_sources/ch4-camel-race）。
// 絵が読めない環境では Canvas の描画に戻す。砂漠・柵・砂煙・合図の輪・HUD は Canvas で描く。
import { el } from "../core/util.js";
import { SE, currentBgm, playBgm, preloadBgm, unlockAudio, playCamelRaceSe, preloadCamelRaceSe, setBgmPlaybackRate, resetBgmTempo, tickBgmPlaybackRate } from "../core/audio.js";
import { imgFileUrl } from "../core/img-file.js";
import { faceIconUrl } from "../core/data.js";
import { RACE, CUE, PLAYER, WHIP, CAMEL_CUPS, camelCup, camelCupQualified, camelMastered, camelExpert, rng, createRace, stepRace, pressVoice, setWhip, whipReady, activeCue, inSpurt, standings, scoreRace,
  whipDrain, finishMargins, POLICIES, PLAYER_CAMEL, RIVAL_PROFILES } from "./camel-race-model.js";
import { CAMEL_RACE_BGM, camelRaceBgmRate } from "./camel-race-bgm.js";

import { camelStaminaReadout, SPURT_RESERVE } from "./camel-race-feedback.js";

export const CAMEL_RACE_TITLE = "CAMEL RACE";
const CUP_TIME_NOTE = "この訪問中の再挑戦は日付を進めません。完走して戻ると従来どおり昼の1行動を使います。";
const W = 1280, H = 720;
const PX_PER_M = 18;              // 1m＝18px（画面に約70mが入る）
const PLAYER_SCREEN_X = 420;      // 自分のラクダの基本の位置。速くなると前へ、遅くなると後ろへ少しずれる（カメラが遅れて追う）
// カメラは群れを画面に収める（2026-11-11）: 前に相手がいれば自分を左へ、後ろから来ていれば右へ寄せる。
// 右は SUV（2つのボタンの間）に脚が隠れない位置まで。
const FRAME_X = Object.freeze({ min: 320, max: 460, limit: 470, perMeter: 4 });
const HORIZON = 330;
// 奥から手前の4列。自分のラクダは調教師の車（SUV）が並走する、いちばん手前の列で大きく見せる
// （2026-11-02 オーナー「どれが自分か分かりずらい」）。足元（y + 31×scale）はすべて手前の柵（y=604）より上。
// 手前の柵はラクダの後に描いて、脚の前を通す。
// 2026-11-11 オーナー「安っぽく見える」: ラクダが小さく走路が空いて見えたので、絵を2割大きくし（CAMEL_ART.scale 0.3→0.36）、
// 奥の列との大きさの差を詰めて、4頭が一つの群れに見えるようにした。
const LANES = [
  { id: "front", y: 424, scale: 0.8 },
  { id: "closer", y: 458, scale: 0.87 },
  { id: "steady", y: 497, scale: 0.95 },
  { id: "player", y: 546, scale: 1.06 },
];
// 鞍の幕（2026-11-02 オーナー「ラクダに色のついた幕」）: 絵の画素で、コブから尻までを覆う四隅と番号の円。
// 上の辺はラクダの輪郭の外まで取り、絵の不透明な所にだけ塗る（source-atop）ので、背の線に沿って切れる。色は順位の札と同じ。
const BLANKET = Object.freeze({ corners: [[126, 136], [298, 64], [314, 222], [144, 234]], disc: [214, 172], radius: 30, trim: 18 });
const SKIN_SCALE = 0.5;           // 幕を塗ったラクダの絵を半分の大きさで作り置く（描く大きさは 0.23〜0.32 倍）
// SUV の車体絵（v6・#3044）にはじめと運転手は焼き込み済み。コードで重ねるのは
// リモコンの状態ランプと吹き出しだけ。位置は絵の画素: アンテナ先端と、吹き出しの付け根（頭の上）。
const HAJIME_AT = Object.freeze({ antenna: [308, 90], balloon: [200, 96] });
// 声かけの輪は自分のラクダの背のロボット騎手（声はその小さなスピーカーへ届く）を囲む。
// 奥の列のラクダと重なっても、どのラクダの輪か迷わない位置（列の y からの差）。
const CUE_AT = Object.freeze({ dx: -26, dy: -77, inner: 24, outer: 52 });
// 顔アイコンは設定の立ち絵の画風に合わせる（faceIconUrl）。目録の読み込み前だけ現行の PNG
const FARIS_ICON = new URL("../../../assets/ui/face_icons/face_faris.png", import.meta.url).href;
// 助手席のファーリスの声（実況の代わり）。一人称は俺、はじめは「ハジメ」。台詞の末尾に「。」を付けない（text-style）。
const CALLS = Object.freeze({
  intro: "ハジメ、手前の金のゼッケンがハビーバだ！",
  go: "出た！ 輪が出たら声だぞ！",
  lead: "先頭だ！ ハビーバ、いい顔してる！",
  pass: name => `${name}を抜いた！ その調子！`,
  passed: name => `${name}が来た！ 声、声！`,
  leader: name => `${name}が前に出た。まだ焦るなよ`,
  half: "半分！ スパートの分の息は残しとけよ",
  spurt: "ここからだ！ 残した息でムチを使え！",
  last100: "あと100！ いけいけいけ！",
  tired: "ハビーバがバテてる……ムチを離して声で整えろ",
  combo: "その声だ、ハビーバが乗ってきた！",
  // 駆け引き（風よけ・競り合い）は、初めて起きた時にファーリスが教える。
  draft: name => `${name}の後ろは風よけだ、息が戻るぞ`,
  duel: name => `${name}が粘る！ 声を当てるかムチで抜け！`,
  duelWon: name => `競り勝った！ ${name}は気落ちしたぞ`,
  duelHeld: name => `${name}に粘られた。息を整えてもう一度だ`,
  closing: name => `${name}がすぐ後ろだ、気を抜くなよ`,
  photo: "写真判定だ……！",
  finish: ["勝った！ 1着だ、ハジメ！", "2着！ あと少しだった！", "3着か。次はもっといける", "最下位……でも、ちゃんと走りきった"],
});
const ICONS = Object.freeze({
  voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2v5.6h3.8l5 4.2V5l-5 4.2z" fill="currentColor"/><path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  signal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2 4.5 13.6h6.3L9.9 22l8.8-11.8h-6.4z" fill="currentColor"/></svg>',
  camel: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 30l3-9c-2-1-3-3-3-6 0-4 3-7 7-7 2-4 6-6 10-3 3 2 5 2 7 0l4-6c2-1 5 0 6 2l2 4-4 1-4 7c-1 4-4 7-8 8l1 9h-3l-2-8h-6l-3 8H9l2-8-3-1-1 9z" fill="currentColor"/></svg>',
});
const TUTORIAL = [
  // 3ページとも短く（#2836）。キーは kbd で添え、タッチ端末では CSS で隠す。結果・大会選びの「？」から読み直せる。
  { icon: "camel", art: "howto-camel", title: "ラクダは、自分で走る", body: "手前を走る金のゼッケン（★）がハビーバ。操縦はしない。背中のロボット騎手へ「声」と「ムチ」を送るだけ。前のラクダのすぐ後ろは風よけで息が戻る。並びかけると相手が粘るので、声かムチで抜き切る。" },
  { icon: "voice", art: "howto-voice", title: "声をかける ── 左のボタン", key: "Space", body: "騎手のまわりの金の輪が縮む。内側の輪と重なった瞬間に押すと PERFECT で、ぐっと伸びる。輪の縮む速さは毎回ちがうので、よく見て押す。外したり連打したりすると、スタミナが減る。" },
  { icon: "signal", art: "howto-whip", title: "ムチ ── 右のボタンを押し続ける", key: "X", body: "押している間は加速して息が減り、離すと調子に応じて回復。40以下で注意、30未満は減速。空になる前に離し、輪に合わせた声で整える。ゲージの白い印は終盤3秒ぶんの目安。最後の4分の1の LAST SPURT はムチがよく効く。" },
];
// レース中の SE ID は従来どおり（sfx("hoof") など）。録音はラクダ専用で、他ミニゲームの合成SEは置き換えない。
const sfx = name => { try { if (name === "select" || name === "click" || name === "cancel") SE[name]?.(); else playCamelRaceSe(name); } catch { /* 音は無くても遊べる */ } };
const armCamelAudio = () => { unlockAudio(); preloadCamelRaceSe(); };

// ---- 絵（Codex・2026-11-02 採用）。寸法は絵の画素で、asset_sources/ch4-camel-race/README.md で測った値。
// ラクダは4コマ（512×384・右向き）。背の線は4コマとも1px以内で、ground の線に足元をそろえる。
// 騎手（160×160）はコブの頂点（x=260）の45px後ろの背に、鞍の底を合わせて座らせる。
// SUV（720×360）の車輪の上に、回転用の車輪（160×160・直径約140px）を 137/160 倍で重ねる。
const ART_FILES = Object.freeze({
  camel: [1, 2, 3, 4].map(i => `ui/camel_race/camel_${i}.webp`),
  jockey: "ui/camel_race/jockey.webp", suv: "ui/camel_race/suv.webp", wheel: "ui/camel_race/wheel.webp",
  track: "backgrounds/bg_dubai_camel_track_morning.webp",
  balloon: "ui/camel_race/ui/balloon.webp",
});
// 奥の景色（レース場の朝の絵・1280×720）。1.25倍にして、絵の y=395（奥の柵の根元）を走路の奥の柵（y=398）にそろえ、
// レースの進み具合で 0→320px だけ横へ流す（遠景のゆっくりした流れ）。走路から手前はコードで描く砂地。
const BACKDROP = Object.freeze({ scale: 1.25, sourceGround: 395, ground: 398 });
const TRACK_TOP = 386, TRACK_BOTTOM = 612, ROAD_BOTTOM = 688, TILE_W = 640;
const CAMEL_ART = Object.freeze({ scale: 0.36, width: 512, height: 384, centerX: 256, ground: 342, seatX: 215, seatY: 131, stride: 4.5 });
// 影・足元の輪・名札などの寸法は絵が 0.3 倍だった頃の値で書いてあるので、この倍率を掛ける。
const BODY = CAMEL_ART.scale / 0.3;
const JOCKEY_ART = Object.freeze({ cx: 94, bottom: 133, scale: 0.9 });
// SUV は手前（カメラ寄り）を走るので、ラクダより大きく描く（0.3→0.4。はじめが窓に見える大きさ）。
const SUV_ART = Object.freeze({ scale: 0.4, centerX: 359, ground: 346, wheels: [[153, 282], [583, 282]], wheel: 130 / 160, radius: 65 });
// AI のラクダの毛色の違い（ctx.filter が無い端末では同じ色のまま。名札の色で見分ける）。
const RIVAL_TINT = Object.freeze({ front: "sepia(0.25) saturate(1.25) brightness(0.95)", closer: "brightness(1.12) saturate(0.85)", steady: "brightness(0.82) saturate(1.05)" });
let artTask = null;
/** 絵をすべて読み終えたら { camel: [..4], jockey, suv, wheel }。1枚でも読めなければ null（Canvas の描画に戻す）。 */
export function loadCamelArt() {
  if (typeof Image === "undefined") return Promise.resolve(null);
  const load = rel => { const image = new Image(); image.decoding = "async"; image.src = imgFileUrl(rel); return image.decode().then(() => image); };
  // 吹き出しの絵（CR-UI13）は読めなくても他の絵は使う（吹き出しは従来の描画に戻す）。
  const balloon = load(ART_FILES.balloon).catch(() => null);
  artTask ||= Promise.all([Promise.all(ART_FILES.camel.map(load)), load(ART_FILES.jockey), load(ART_FILES.suv), load(ART_FILES.wheel), load(ART_FILES.track), balloon])
    .then(([camel, jockey, suv, wheel, track, balloonImage]) => ({ camel, jockey, suv, wheel, track, balloon: balloonImage,
      ground: groundTiles(), skins: camelSkins(camel) }))
    .catch(() => null);
  return artTask;
}
if (typeof Image !== "undefined" && typeof document !== "undefined") void loadCamelArt();

/** 4頭それぞれの4コマに、毛色（AI）と色の幕・番号を塗った絵を作り置く。{ id: [canvas×4] } */
function camelSkins(frames) {
  const skins = {};
  for (const camel of [PLAYER_CAMEL, ...RIVAL_PROFILES]) {
    const me = camel.id === "player";
    const number = me ? "★" : String(RIVAL_PROFILES.indexOf(camel) + 2);
    skins[camel.id] = frames.map(frame => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(frame.width * SKIN_SCALE); canvas.height = Math.round(frame.height * SKIN_SCALE);
      const g = canvas.getContext("2d");
      g.scale(SKIN_SCALE, SKIN_SCALE);
      if (!me && RIVAL_TINT[camel.id]) g.filter = RIVAL_TINT[camel.id];
      g.drawImage(frame, 0, 0);
      g.filter = "none";
      // ここから下は、ラクダの絵の不透明な所にだけ塗る。
      g.globalCompositeOperation = "source-atop";
      const path = new Path2D();
      BLANKET.corners.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
      g.fillStyle = camel.color; g.fill(path);
      // 下ほど暗い影（2段）と、縁の飾り帯（自分は白に赤の線、AI は白）。
      g.save(); g.clip(path);
      g.fillStyle = "rgba(30,14,4,0.16)"; g.fillRect(0, 186, 512, 60);
      g.fillStyle = "rgba(30,14,4,0.12)"; g.fillRect(0, 206, 512, 40);
      g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(0, 0, 512, 128);
      g.restore();
      g.lineJoin = "round";
      g.lineWidth = BLANKET.trim; g.strokeStyle = me ? "#fff3c4" : "#fffaf0"; g.stroke(path);
      g.lineWidth = 4; g.strokeStyle = me ? "#c8302a" : "rgba(30,14,4,0.55)"; g.stroke(path);
      // 番号の円。
      const [cx, cy] = BLANKET.disc;
      g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(cx, cy, BLANKET.radius, 0, Math.PI * 2); g.fill();
      g.lineWidth = 4; g.strokeStyle = "rgba(30,14,4,0.6)"; g.stroke();
      g.fillStyle = me ? "#c8302a" : camel.color; g.font = "900 38px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(number, cx, cy + 2);
      return canvas;
    });
  }
  return skins;
}

/** 走路の砂地と、SUV が走る道のタイル（横幅 TILE_W で左右がつながる）。蹄の跡・まだらの砂・轍を描き込む。 */
function groundTiles() {
  const random = rng(20261102);
  const tile = (height, top, bottom, paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_W; canvas.height = height;
    const g = canvas.getContext("2d");
    const base = g.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, top); base.addColorStop(1, bottom);
    g.fillStyle = base; g.fillRect(0, 0, TILE_W, height);
    // 横にまたぐ描き込みは左右に2回描いて、つなぎ目を消す。
    const wrap = draw => { draw(0); draw(TILE_W); draw(-TILE_W); };
    paint(g, height, wrap);
    return canvas;
  };
  const sand = tile(TRACK_BOTTOM - TRACK_TOP, "#d9b47c", "#c2894f", (g, h, wrap) => {
    // ならした砂の筋（横）。
    for (let i = 0; i < 70; i++) {
      const y = random() * h, x = random() * TILE_W, w = 60 + random() * 220, light = random() < 0.5;
      g.fillStyle = light ? "rgba(255,236,200,0.10)" : "rgba(120,72,30,0.08)";
      wrap(o => g.fillRect(x + o, y, w, 1 + random() * 2));
    }
    // まだらの砂粒。手前ほど大きい。
    for (let i = 0; i < 2600; i++) {
      const y = random() * h, x = random() * TILE_W, r = 0.4 + (y / h) * 1.4 * random();
      g.fillStyle = random() < 0.5 ? `rgba(255,240,210,${0.18 + random() * 0.2})` : `rgba(110,64,26,${0.12 + random() * 0.18})`;
      wrap(o => { g.beginPath(); g.arc(x + o, y, r, 0, Math.PI * 2); g.fill(); });
    }
    // 蹄の跡（小さな三日月の影と縁の明るさ）。
    for (let i = 0; i < 130; i++) {
      const y = 8 + random() * (h - 12), x = random() * TILE_W, r = 1.6 + (y / h) * 3;
      wrap(o => {
        g.fillStyle = "rgba(96,54,20,0.20)"; g.beginPath(); g.ellipse(x + o, y, r * 1.5, r * 0.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,232,190,0.18)"; g.beginPath(); g.ellipse(x + o + r * 0.6, y + r * 0.3, r * 1.2, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      });
    }
  });
  const road = tile(ROAD_BOTTOM - TRACK_BOTTOM, "#a98457", "#8f6b43", (g, h, wrap) => {
    for (let i = 0; i < 1400; i++) {
      const y = random() * h, x = random() * TILE_W;
      g.fillStyle = random() < 0.5 ? "rgba(255,230,190,0.16)" : "rgba(60,36,16,0.16)";
      wrap(o => g.fillRect(x + o, y, 1 + random() * 2, 1));
    }
    // 2本の轍（タイヤの跡）。
    for (const y of [h * 0.42, h * 0.78]) {
      g.fillStyle = "rgba(70,44,20,0.22)"; g.fillRect(0, y - 5, TILE_W, 10);
      for (let x = 0; x < TILE_W; x += 7) { g.fillStyle = "rgba(50,30,12,0.25)"; g.fillRect(x, y - 4, 3, 8); }
    }
  });
  return { sand, road };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtTime = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
const active = new WeakMap();

/**
 * @param host 重ねる要素（既定: #stage）
 * @param tutorial 開始前のチュートリアルを出すか
 * @param pilot テスト・デモ用の自動操作（"perfect"／"good"／"none"／"spam"／関数）
 * @param timeScale テスト用の早回し
 * @param best 以前の自己ベスト（リザルトで更新を知らせる）
 * 戻り値: { completed, cancelled, runs: [採点…], best: 最高の採点, last: 最後の採点 }
 */
export function runCamelRace({ host = document.getElementById("stage"), signal = null, seed = null, tutorial = true, allowRetry = true,
  pilot = null, timeScale = 1, best = null, cups = null, cupRecords = {}, reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const bgmBefore = currentBgm();
  void preloadBgm(CAMEL_RACE_BGM);
  const runs = [];
  const unlocked = new Set(cups || ["practice", "rookie"]);
  let selectedCup = "practice";
  const summary = completed => {
    const bestRun = runs.reduce((top, run) => !top || run.total > top.total ? run : top, null);
    return { completed, cancelled: !completed, runs: runs.map(run => ({ ...run })), best: bestRun ? { ...bestRun } : null, last: runs.length ? { ...runs.at(-1) } : null };
  };
  if (signal?.aborted) return Promise.resolve(summary(false));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; });
  active.set(host, promise);

  const previousFocus = document.activeElement;
  const canvas = el("canvas.camel-canvas", { width: W, height: H, "aria-hidden": "true" });
  const ctx = canvas.getContext("2d");
  const feedback = el("div.camel-feedback", { "aria-hidden": "true" });
  const banner = el("div.camel-banner", { "aria-hidden": "true" });
  const countdownNode = el("div.camel-countdown", { "aria-hidden": "true" });
  const live = el("p.camel-live", { role: "status", "aria-live": "polite" });
  const standingsNode = el("ol.camel-standings", { "aria-label": "順位" });
  // コースの上に重ねる HUD（文字がにじまないよう HTML）。進み具合・時計と速度計・調子・スタミナとムチ。
  const allCamels = [PLAYER_CAMEL, ...RIVAL_PROFILES];
  const dots = new Map(allCamels.map(camel => [camel.id, el("i.camel-dot", { dataset: { who: camel.id }, style: { "--camel-color": camel.color } })]));
  const progressNode = el("div.camel-progress", { "aria-hidden": "true" }, [el("div.camel-progress-track", [
    el("div.camel-progress-spurt", { style: { "--x": RACE.spurtFrom } }, [el("span", { text: "SPURT" })]),
    ...[0.25, 0.5].map(x => el("i.camel-progress-tick", { style: { "--x": x } })),
    el("i.camel-progress-flag"), ...dots.values(),
  ])]);
  // 画面いっぱいにコースを出し、見出し・時計・順位・ボタンはコースの上に重ねる（上下の帯でコースを狭めない）。
  // 左上: 題名と時計、上の中央: 進み具合、右上: やめる と順位（縦）、左下: 声（調子の棒つき）、右下: ムチ（スタミナつき）。
  const clockTime = el("b.camel-clock-time", { text: "0:00.00" });
  // 速度計（km/h）: 車の速度計の読み。声で一伸び・ムチで伸びるのが数字でも見える。
  const speedValue = el("b.camel-speed-value", { text: "0" });
  const speedFill = el("i");
  const speedNode = el("div.camel-speed", { "aria-hidden": "true", dataset: { state: "cruise" } }, [
    el("span.camel-speed-read", [speedValue, el("small", { text: "km/h" })]), el("span.camel-speed-bar", [speedFill])]);
  const clockNode = el("div.camel-clock", { "aria-hidden": "true" }, [
    el("h1.camel-title", { text: CAMEL_RACE_TITLE }), clockTime, speedNode,
    el("small.camel-clock-sub", { text: "練習レース 1,000m・4頭", dataset: { test: "camel-event-name" } })]);
  const rhythmBars = Array.from({ length: 5 }, () => el("i"));
  const staminaValue = el("b", { text: "100" });
  const staminaFill = el("i");
  const staminaNode = el("span.camel-stamina", { "aria-hidden": "true", dataset: { state: "ok" } }, [
    el("span.camel-stamina-bar", [staminaFill, el("span.camel-stamina-mark", { style: { "--x": PLAYER.tired / 100 } }), el("span.camel-stamina-reserve", { title: "終盤3秒ぶんの目安", style: { left: `${SPURT_RESERVE}%` } })]), staminaValue]);
  const hudNode = el("div.camel-hud", { hidden: true }, [progressNode, clockNode, standingsNode]);
  const signalCost = el("small.camel-signal-note", { text: "押している間" });
  // スマホ横持ちでは名前の文字を隠してアイコン（🔊・⚡）とゲージだけにするので、読み上げ名は aria-label に持たせる（#2836）。
  const voiceButton = el("button.camel-control.camel-voice", { type: "button", "aria-label": "声をかける", dataset: { test: "camel-voice", cue: "off" } }, [
    el("span.camel-control-icon", { html: ICONS.voice }),
    el("span.camel-control-text", [el("strong", { text: "声をかける" }),
      el("span.camel-rhythm", { "aria-hidden": "true" }, [el("small", { text: "調子" }), el("span.camel-rhythm-bars", rhythmBars)])]),
    el("kbd", { text: "Space" })]);
  const signalButton = el("button.camel-control.camel-signal", { type: "button", "aria-label": "ムチ（押している間）", dataset: { test: "camel-signal", state: "ready" } }, [
    el("i.camel-control-cool", { "aria-hidden": "true" }),
    el("span.camel-control-icon", { html: ICONS.signal }),
    el("span.camel-control-text", [el("span.camel-signal-head", [el("strong", { text: "ムチ" }), signalCost]), staminaNode]),
    el("kbd", { text: "X" })]);
  const pacingText = el("span"), reserveText = el("small");
  const pacingNode = el("div.camel-pacing", { hidden: true, dataset: { test: "camel-pacing" } }, [pacingText, reserveText]);
  // 息の予告はムチのボタンのすぐ上に積む（2026-11-11。画面の中央下は SUV とはじめを見せる）。
  const controls = el("div.camel-controls", [voiceButton, el("div.camel-control-stack", [pacingNode, signalButton])]);
  const closeButton = el("button.camel-close", { type: "button", text: "やめる", dataset: { test: "camel-close" } });
  // 助手席のファーリスの声（上の中央、進み具合の下）。顔のアイコンが読めなければ名前だけ。
  const callText = el("span.camel-call-text");
  const callIcon = el("img.camel-call-icon", { src: faceIconUrl("faris") || FARIS_ICON, alt: "", onerror: event => { event.currentTarget.hidden = true; } });
  const callNode = el("div.camel-call", { "aria-hidden": "true", dataset: { test: "camel-call" } }, [callIcon, el("span.camel-call-body", [el("b", { text: "ファーリス" }), callText])]);
  const flashNode = el("div.camel-flash", { "aria-hidden": "true" });
  const boostLabel = el("div.camel-boost-label", { hidden: true, text: "≫ WIND BOOST", dataset: { test: "camel-boost-label" }, "aria-hidden": "true" });
  const stageNode = el("div.camel-stage", [canvas, flashNode, hudNode, callNode, feedback, banner, countdownNode, boostLabel, controls, closeButton]);
  const sheet = el("div.camel-sheet", { hidden: true });
  const root = el("section.camel-game", { role: "dialog", "aria-modal": "true", "aria-label": CAMEL_RACE_TITLE, tabindex: "-1",
    dataset: { test: "camel-game", phase: "loading", reducedMotion: String(reducedMotion) } }, [stageNode, live, sheet]);
  host.append(root);
  // 音の解禁はユーザー操作が起点（自動再生制限）。本編は main.js が全体で受けているが、
  // 試遊ページ等の単独表示でも BGM・SE が鳴るよう、レース画面自身の操作でも解禁する（#3065）。
  root.addEventListener("pointerdown", armCamelAudio);
  root.addEventListener("keydown", armCamelAudio);
  // 部品ごとに読込成否を判定し、欠けた画像だけ CSS 表示へ戻す。
  for (const [cls, rel] of [
    ["cr-card", "ui/camel_race/ui/program-card.webp"],
    ["cr-btn", "ui/camel_race/ui/button-primary.webp"],
    ["cr-btn-secondary", "ui/camel_race/ui/button-secondary.webp"],
    ["cr-dash", "ui/camel_race/ui/dash-panel.webp"],
    ["cr-rank", "ui/camel_race/ui/rank-plate.webp"],
    ["cr-rank-player", "ui/camel_race/ui/rank-plate-player.webp"],
    ["cr-medal-gold", "ui/camel_race/ui/medal-gold.webp"],
    ["cr-gauge-frame", "ui/camel_race/ui/gauge-frame.webp"],
    ["cr-gauge-fill", "ui/camel_race/ui/gauge-fill.webp"],
    ["cr-call", "ui/camel_race/ui/call-plate.webp"],
    ["cr-finish", "ui/camel_race/ui/finish-post.webp"],
    ["cr-stamp-s", "ui/camel_race/ui/stamp-s.webp"],
    ["cr-stamp-a", "ui/camel_race/ui/stamp-a.webp"],
    ["cr-stamp-b", "ui/camel_race/ui/stamp-b.webp"],
    ["cr-stamp-c", "ui/camel_race/ui/stamp-c.webp"],
    ["cr-word-perfect", "ui/camel_race/ui/word-perfect.webp"],
  ]) {
    const probe = new Image();
    probe.onload = () => root.classList.add(cls);
    probe.src = imgFileUrl(rel);
  }

  let art = null;
  void loadCamelArt().then(value => {
    art = value;
    if (done) return;
    root.dataset.art = value ? "sprites" : "canvas";
    if (phase === "tutorial" || phase === "loading") draw();
  });
  let race = null, phase = "loading", raf = 0, last = null, goalAt = 0, feedbackTimer = 0, bannerTimer = 0, countdownLeft = 0, countdownShown = -1;
  let lastStaminaNotice = -99;
  let standingsStamp = 0, whip = 0, done = false, spurtShown = false, settleTimer = 0;
  // 演出: 画面の揺れ・ゴールのスロー・GO の柵・連続成功・ファーリスの声・抜いた／抜かれた。
  let shake = 0, slow = 0, goTime = -1, combo = 0, callTimer = 0, lastCallAt = -9, spurtTint = 0;
  // カメラは自分のラクダを少し遅れて追う: 伸びた瞬間はラクダが画面の前へ出て、カメラが追いつく（camShift px）。
  let camShift = 0, camAt = 0, lastStride = -1;
  // 群れを収める位置（frameX）、風よけの見せ方の濃さ（draftFx 0〜1）、競り合いの演出（duelFx）、一度だけ教える声（taught）。
  let frameX = PLAYER_SCREEN_X, draftFx = 0, duelFx = null, closingAt = -99, margins = null;
  const taught = new Set();
  // Canvas の文字も画面と同じ書体で描く（既定の sans-serif だと端末ごとに字が変わり、HUD と揃わない）。
  const FONT = getComputedStyle(root).fontFamily || "sans-serif";
  // 車体絵に焼き込みのはじめの吹き出し（表情は絵の一部で切り替わらない。face 引数は呼び出し互換のため受けるだけ）。
  let hajimeText = "", hajimeTextTimer = 0;
  const hajime = (text, face, seconds = 0.9) => {
    if (text) { hajimeText = text; hajimeTextTimer = seconds; }
  };
  const playerX = () => Math.min(FRAME_X.limit, frameX + camShift);
  let lastPosition = 0, leaderId = null, marks = new Set();
  // スマホではコース（1280×720）が半分ほどに縮むので、Canvas の名札・吹き出し・順位の文字だけ大きくする。
  let textScale = 1;
  const resizer = typeof ResizeObserver === "function" ? new ResizeObserver(([entry]) => {
    textScale = clamp(W / (entry.contentRect.width || W), 1, 1.6);
  }) : null;
  resizer?.observe(canvas);
  const dust = [], confetti = [], sparks = [], waves = [], floaters = [];
  const streaks = Array.from({ length: 26 }, (_, i) => ({ x: (i * 211) % W, y: 120 + ((i * 97) % 520), len: 60 + (i * 37) % 140, v: 0.7 + ((i * 13) % 10) / 12 }));
  const rivalSeed = () => (seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
  const pilotPolicy = typeof pilot === "function" ? pilot : pilot ? POLICIES[pilot] : null;
  if (pilot && !pilotPolicy) { active.delete(host); root.remove(); return Promise.reject(new RangeError(`Unknown pilot: ${pilot}`)); }

  const setPhase = next => {
    phase = next; root.dataset.phase = next;
    controls.hidden = next !== "race" && next !== "countdown";
    hudNode.hidden = !["countdown", "race", "goal"].includes(next);
    pacingNode.hidden = !["countdown", "race"].includes(next);
    if (next !== "race") boostLabel.hidden = true;
  };
  const announce = text => { live.textContent = text; };
  const showFeedback = (text, kind, sub = "") => {
    const detail = typeof sub === "string" ? sub.trim() : "";
    const subNodes = detail && detail !== "null" && detail !== "undefined" ? [el("small", { text: sub })] : [];
    feedback.replaceChildren(el("b", { text }), ...subNodes);
    feedback.dataset.kind = kind; feedback.classList.remove("show");
    void feedback.offsetWidth; feedback.classList.add("show"); feedbackTimer = 0.75;
  };
  /** ファーリスの声。force でなければ前の声から少し空ける（大事な声が流れないように）。 */
  const say = (text, force = false) => {
    if (!race || (!force && race.t - lastCallAt < 2.2)) return;
    lastCallAt = race?.t ?? 0;
    callText.textContent = text;
    callNode.classList.remove("show"); void callNode.offsetWidth; callNode.classList.add("show");
    callTimer = 2.6;
  };
  const cuePoint = () => { const lane = laneOf("player"); return { x: playerX() + CUE_AT.dx, y: lane.y + CUE_AT.dy }; };
  /** 声が当たった所から火花と波紋を飛ばす（PERFECT は金で多く、GOOD は水色で少なく、外れは灰の煙）。 */
  const burst = kind => {
    if (reducedMotion) return;
    const { x, y } = cuePoint();
    const count = kind === "perfect" ? 18 : kind === "good" ? 9 : 5;
    const color = kind === "perfect" ? [255, 214, 102] : kind === "good" ? [150, 230, 255] : [190, 170, 150];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3, v = (kind === "miss" ? 40 : 140) + Math.random() * 120;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.55 + Math.random() * 0.25, age: 0, color, r: kind === "miss" ? 7 : 3 + Math.random() * 2.5, smoke: kind === "miss" });
    }
    if (kind !== "miss") waves.push({ x, y, r: 22, age: 0, life: kind === "perfect" ? 0.5 : 0.38, color, width: kind === "perfect" ? 6 : 4 });
  };
  const showBanner = (text, kind, seconds = 1.6, sub = "") => {
    banner.replaceChildren(el("b", { text }), ...(sub ? [el("small", { text: sub })] : []));
    banner.dataset.kind = kind; banner.classList.add("show"); bannerTimer = seconds;
  };

  // ---- 入力 -----------------------------------------------------------------------------------------
  const onVoice = () => {
    if (phase !== "race" || !race) return;
    const result = pressVoice(race);
    if (!result) return;
    flashButton(voiceButton, result.type);
    if (result.type === "perfect" || result.type === "good") {
      combo += 1;
      const sub = combo >= 2 ? `${combo} COMBO` : "";
      if (result.type === "perfect") { sfx("perfect"); showFeedback("PERFECT", "perfect", sub); hajime("ハイッ！", "smile"); }
      else { sfx("good"); showFeedback("GOOD", "good", sub || (result.dt > 0 ? "少し遅め" : "少し早め")); hajime("よしっ", "smile"); }
      burst(result.type);
      if (combo === 5 && !marks.has("combo")) { marks.add("combo"); say(CALLS.combo); }
    } else { combo = 0; sfx("miss"); showFeedback(result.spam ? "連打はダメ" : "無駄な声", "miss"); burst("miss"); hajime("あっ", "surprise"); }
  };
  /** ムチを押す・離す。押している間だけ騎手の腕が回り続け、ラクダが伸びる（スタミナを使う）。 */
  const onWhip = on => {
    if (!race || (phase !== "race" && on)) return;
    const result = setWhip(race, on);
    signalButton.classList.toggle("held", !!on);
    if (!result) return;
    if (result.type === "release") return;
    if (result.type === "spent") { flashButton(signalButton, "miss"); sfx("miss"); showFeedback("息が切れてる", "miss", "離して声で整える"); hajime("くっ……", "surprise"); return; }
    flashButton(signalButton, "boost");
    sfx("whoosh");
    hajime(result.type === "spurt" ? "ラストだ、いけーっ！" : "いけっ！", "excited");
    if (!reducedMotion) {
      // 入れた瞬間: 画面が揺れ、ラクダの後ろで砂が爆ぜる。
      shake = Math.max(shake, result.type === "spurt" ? 0.5 : 0.32);
      const lane = laneOf("player");
      for (let i = 0; i < 14; i++) dust.push({ x: playerX() - 40 + Math.random() * 30, y: lane.y + 24, r: 10 + Math.random() * 14, a: 0.55, vx: -(120 + Math.random() * 160), vy: -(30 + Math.random() * 60), s: lane.scale });
    }
    if (result.type === "spurt") showFeedback("スパート！", "spurt", "残した息を使おう");
  };
  const flashButton = (button, kind) => {
    button.dataset.hit = kind; button.classList.remove("hit"); void button.offsetWidth; button.classList.add("hit");
  };
  const press = (button, handler) => {
    button.addEventListener("pointerdown", event => { event.preventDefault(); handler(); });
    button.addEventListener("keydown", event => { if (event.key === " " || event.key === "Enter") event.preventDefault(); });
  };
  press(voiceButton, onVoice);
  // ムチは押している間だけ。指が少しずれても離れないよう、押した要素に捕まえておく。
  signalButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    try { signalButton.setPointerCapture(event.pointerId); } catch { /* 捕まえられない端末 */ }
    onWhip(true);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) signalButton.addEventListener(type, () => onWhip(false));
  signalButton.addEventListener("keydown", event => { if (event.key === " " || event.key === "Enter") event.preventDefault(); });
  signalButton.addEventListener("contextmenu", event => event.preventDefault());
  const isWhipKey = event => event.key === "x" || event.key === "X" || event.code === "KeyX";
  const onKey = event => {
    if (sheet.hidden === false) return;
    if (isWhipKey(event)) { event.preventDefault(); event.stopPropagation(); if (!event.repeat) onWhip(true); return; }
    if (event.repeat) return;
    if (event.code === "Space" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onVoice(); }
  };
  const onBlur = () => onWhip(false);
  window.addEventListener("blur", onBlur);
  // キーはウィンドウの捕捉段階で受ける。本編の会話エンジンがウィンドウのキーを拾わないよう、ここで止める
  // （以前は止めるだけで、レースの中のキー処理まで届いていなかった）。カードのボタンの Space は既定の動作のまま。
  const ours = event => (event.code === "Space" || event.key === " " || isWhipKey(event))
    && (root.contains(document.activeElement) || phase === "race" || phase === "countdown");
  const windowKey = event => { if (!ours(event)) return; armCamelAudio(); onKey(event); event.stopImmediatePropagation(); };
  const windowKeyUp = event => {
    if (!isWhipKey(event)) return;
    onWhip(false);
    if (ours(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  window.addEventListener("keydown", windowKey, true);
  window.addEventListener("keyup", windowKeyUp, true);

  // ---- 終了 -----------------------------------------------------------------------------------------
  const cleanup = completed => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    resizer?.disconnect();
    window.removeEventListener("keydown", windowKey, true);
    window.removeEventListener("keyup", windowKeyUp, true);
    window.removeEventListener("blur", onBlur);
    signal?.removeEventListener("abort", abort);
    root.remove();
    active.delete(host);
    resetBgmTempo();
    if (currentBgm() === CAMEL_RACE_BGM) playBgm(bgmBefore);
    try { previousFocus?.focus?.(); } catch { /* 元の要素が無い */ }
    finish(summary(completed));
  };
  const abort = () => cleanup(runs.length > 0);
  signal?.addEventListener("abort", abort, { once: true });
  closeButton.addEventListener("click", () => { sfx("cancel"); cleanup(runs.length > 0); });

  // ---- 進行 -----------------------------------------------------------------------------------------
  /** 遊び方。back があれば「？」から開いた読み直しで、最後のページと「閉じる」で元のカードへ戻る（レースは始めない）。 */
  function openTutorial(page = 0, back = null) {
    setPhase("tutorial");
    const step = TUTORIAL[page];
    const lastPage = page === TUTORIAL.length - 1;
    const next = el("button.btn.primary", { type: "button", text: lastPage ? back ? "閉じる" : "スタート" : "次へ", dataset: { test: "camel-tutorial-next" },
      onclick: () => { sfx(lastPage && !back ? "select" : "click"); lastPage ? back ? back() : startRace() : openTutorial(page + 1, back); } });
    const skip = back ? el("button.btn.ghost", { type: "button", text: "閉じる", dataset: { test: "camel-tutorial-close" }, onclick: () => { sfx("cancel"); back(); } })
      : el("button.btn.ghost", { type: "button", text: "とばしてスタート", dataset: { test: "camel-tutorial-skip" }, onclick: () => { sfx("select"); startRace(); } });
    sheet.replaceChildren(el("div.camel-card.camel-tutorial", { dataset: { test: "camel-tutorial", page: String(page) } }, [
      // 遊び方の絵（CR-UI11・#3046）。読めなければアイコンに戻す。
      el("div.camel-tutorial-visual", [
        el("div.camel-tutorial-icon", { dataset: { kind: step.icon }, html: ICONS[step.icon] }),
        el("img.camel-tutorial-art", { src: imgFileUrl(`ui/camel_race/ui/${step.art}.webp`), alt: "", dataset: { test: "camel-tutorial-art" },
          onerror: event => { event.currentTarget.remove(); } }),
      ]),
      el("div.camel-tutorial-body", [
        el("p.camel-eyebrow", { text: `HOW TO PLAY  ${page + 1} / ${TUTORIAL.length}` }),
        el("h2", [step.title, step.key ? el("kbd.camel-key", { text: step.key }) : null]), el("p", { text: step.body }),
        el("div.camel-steps", { "aria-hidden": "true" }, TUTORIAL.map((_, i) => el("i", { class: i === page ? "on" : null }))),
      ]),
      el("div.camel-card-actions", lastPage ? [next] : [skip, next]),
    ]));
    sheet.hidden = false;
    next.focus();
  }
  /** カードの右上の「？」: 遊び方を読み直し、閉じると back で元のカードへ戻る。 */
  const helpButton = back => el("button.camel-help", { type: "button", text: "？", "aria-label": "遊び方を見る", dataset: { test: "camel-help" },
    onclick: () => { sfx("click"); openTutorial(0, back); } });
  function openCups() {
    setPhase("cups");
    hudNode.hidden = true;
    // 時間の決まり（下の小さな文）は、スマホでは札に出さず title で読む（#2729）
    sheet.replaceChildren(el("div.camel-card.camel-cup-card", { title: CUP_TIME_NOTE, dataset: { test: "camel-cups" } }, [
      el("p.camel-eyebrow", { text: "HABIBA RACING CLUB" }),
      el("h2", { text: "ハビーバと、次の大会へ" }),
      el("p", { text: "大会は入門から。中級認定の追加火種は一度だけ、上級は称号への挑戦。" }),
      el("div.camel-cups", CAMEL_CUPS.map((cup, index) => {
        const enabled = unlocked.has(cup.id);
        const mastered = cupRecords[cup.id]?.mastered || runs.some(run => cup.id === "standard" ? camelMastered(run) : cup.id === "expert" && camelExpert(run));
        return el("button.camel-cup", { type: "button", disabled: !enabled,
          dataset: { test: "camel-cup", cup: cup.id }, onclick: () => { sfx("select"); selectedCup = cup.id; startRace(); } }, [
          el("small", { text: index ? `CUP 0${index}` : "PRACTICE" }),
          el("strong", { text: cup.name }), el("span", { text: `${cup.length.toLocaleString("ja-JP")}m ・ 4頭` }),
          el("span", { text: enabled ? cup.note : cup.id === "standard" ? "入門大会3位以内で解放" : "標準大会の中級認定で解放" }),
          el("b", { text: mastered ? cup.id === "expert" ? "砂漠の名調教師" : "中級認定済み" : enabled ? "出走する →" : "未解放" }),
        ]);
      })),
      el("small.camel-cup-note", { text: CUP_TIME_NOTE }),
      helpButton(openCups),
    ]));
    sheet.hidden = false;
    sheet.querySelector(".camel-cup:not(:disabled)")?.focus();
  }
  function startRace() {
    armCamelAudio();
    playBgm(CAMEL_RACE_BGM);
    resetBgmTempo();
    preloadCamelRaceSe();
    sheet.hidden = true; sheet.replaceChildren();
    race = createRace({ seed: rivalSeed(), cup: selectedCup });
    clockNode.querySelector(".camel-clock-sub").textContent = `${camelCup(selectedCup).name} ${race.length.toLocaleString("ja-JP")}m・4頭`;
    dust.length = 0; confetti.length = 0; sparks.length = 0; waves.length = 0; floaters.length = 0;
    lastStaminaNotice = -99;
    whip = 0; spurtShown = false; goalAt = 0; settleTimer = 0;
    shake = 0; slow = 0; goTime = -1; combo = 0; spurtTint = 0; lastCallAt = -9; lastPosition = 0; leaderId = null; marks = new Set();
    camShift = 0; lastStride = -1; hajimeTextTimer = 0;
    frameX = PLAYER_SCREEN_X; draftFx = 0; duelFx = null; closingAt = -99; margins = null;
    signalButton.classList.remove("held");
    countdownLeft = RACE.countdown; countdownShown = -1; last = null;
    setPhase("countdown");
    announce("スタートまで3秒。手前の金のゼッケンが自分のラクダ（ハビーバ）。");
    say(CALLS.intro, true);
    hajime("よし、いくぞ", "serious", 2.4);
    root.focus({ preventScroll: true });
    buildStandings();
    renderStandings();
    updateHud(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (done) return;
    raf = requestAnimationFrame(frame);
    if (last === null) last = now;
    let dt = Math.min(0.1, (now - last) / 1000) * timeScale;
    last = now;
    if (phase === "countdown") {
      countdownLeft -= dt;
      const shown = Math.ceil(countdownLeft);
      if (shown !== countdownShown) {
        countdownShown = shown;
        if (shown > 0) { countdownNode.textContent = String(shown); countdownNode.classList.add("show"); sfx("count"); }
        else {
          countdownNode.textContent = "GO!"; sfx("count"); sfx("reelLever"); setPhase("race"); goTime = 0;
          announce("スタート。輪が重なったら声をかける。"); setTimeout(() => countdownNode.classList.remove("show"), 500);
          say(CALLS.go, true);
          if (!reducedMotion) {
            // 柵が上がって4頭が一斉に飛び出す: 足元から砂が爆ぜ、画面が揺れる。
            shake = 0.45;
            for (const lane of LANES) for (let i = 0; i < 10; i++) {
              dust.push({ x: playerX() - 20 + Math.random() * 60, y: lane.y + 26 * lane.scale, r: 8 + Math.random() * 14, a: 0.6, vx: -(60 + Math.random() * 140), vy: -(20 + Math.random() * 50), s: lane.scale });
            }
          }
        }
      }
    } else if (phase === "race") {
      let acc = dt;
      while (acc > 0 && !race.finished) {
        // 自動操作（テスト・デモ）は早回しでも輪を逃さないよう、モデルの1歩ごとに判断する。
        if (pilotPolicy) {
          const action = pilotPolicy(race) || {};
          if (action.voice) onVoice();
          onWhip(!!action.whip);
        }
        const step = Math.min(acc, 1 / 60); stepRace(race, step); acc -= step;
      }
      consumeEvents();
      watchRace();
      if (race.finished) {
        setPhase("goal");
        goalAt = 0;
        const rank = race.rank;
        margins = finishMargins(race);
        // 着差: 1着なら2着との差、それ以外はすぐ前の相手との差。0.15秒以内は写真判定。
        const edge = rank === 1 ? margins.behind : margins.ahead;
        const photo = !!edge && edge.seconds <= 0.15;
        showBanner(rank === 1 ? "1着 GOAL!" : `${rank}着 GOAL`, rank === 1 ? "goal" : "goal-place", 2.6,
          edge ? `${photo ? "写真判定 ・ " : ""}${edge.name}と ${edge.seconds.toFixed(2)}秒差` : "");
        sfx(rank === 1 ? "fanfare" : rank <= 3 ? "jingle" : "crowd");
        say(photo && rank === 1 ? `${CALLS.photo} ${CALLS.finish[0]}` : CALLS.finish[rank - 1] || CALLS.finish.at(-1), true);
        hajime(["やったー！", "くそっ、あと少し！", "まだまだ……", "うそだろ……"][rank - 1] || "……", rank === 1 ? "smile" : rank === 4 ? "sad" : "serious", 3);
        if (!reducedMotion) {
          // ゴールの瞬間: 白く光り、揺れ、少しのあいだスローで線を越える。
          slow = 1.1; shake = 0.4;
          flashNode.classList.remove("show"); void flashNode.offsetWidth; flashNode.classList.add("show");
          const pieces = rank === 1 ? 110 : rank <= 3 ? 60 : 0;
          const hues = rank === 1 ? [45, 50, 38, 0, 200] : [45, 30, 200, 120];
          for (let i = 0; i < pieces; i++) confetti.push({ x: W / 2 + (Math.random() - 0.5) * 900, y: -20 - Math.random() * 260, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 180, rot: Math.random() * 6, hue: hues[i % hues.length] });
        }
      }
    } else if (phase === "goal") {
      // ゴール後は見た目だけ走り続ける（モデルは止まる）。最初の約1秒はスロー。
      const rate = slow > 0 ? 0.32 : 1;
      if (slow > 0) slow -= dt;
      goalAt += dt * rate;
      if (goalAt > 2.3) openResult();
    }
    if (phase === "race" && race && !race.finished) {
      setBgmPlaybackRate(camelRaceBgmRate(race.player.speed));
      tickBgmPlaybackRate(dt);
    } else {
      resetBgmTempo();
    }
    animate(dt);
    draw();
  }
  function consumeEvents() {
    for (const event of race.events) {
      if (event.kind === "voice" && event.type === "lost") { combo = 0; sfx("miss"); showFeedback("見送った……", "lost"); }
      else if (event.kind === "spurt" && !spurtShown) {
        spurtShown = true; showBanner("LAST SPURT", "spurt"); announce("ラストスパート。ムチを押し続けるなら今。");
        say(CALLS.spurt, true); sfx("slotBonus"); if (Math.random() < 0.3) playCamelRaceSe("grunt");
        if (!reducedMotion) { spurtTint = 1; shake = Math.max(shake, 0.25); }
      }
      else if (event.kind === "stamina" && event.type === "exhausted") { showBanner("息が切れた", "tired", 1.2); say(CALLS.tired, true); }
      else if (event.kind === "draft" && event.type === "in") {
        // 風よけに入った: 最初の一度だけファーリスが教える。以後は足元の風と息のゲージで分かる。
        if (!taught.has("draft") && race.t > 3) { taught.add("draft"); say(CALLS.draft(rivalName(event.who)), true); }
      }
      else if (event.kind === "duel") {
        const name = rivalName(event.who);
        if (event.type === "start") {
          duelFx = { who: event.who, age: 0 };
          floaters.push({ text: "競り合い！", kind: "duel", age: 0, life: 1.2, at: race.t });
          sfx("slotBonus"); hajime("負けるな！", "excited", 1.2);
          if (!reducedMotion) shake = Math.max(shake, 0.22);
          if (!taught.has("duel")) { taught.add("duel"); say(CALLS.duel(name), true); }
          announce(`${name}と競り合い。声を当てるかムチで抜く。`);
        } else {
          duelFx = null;
          const won = event.type === "won";
          floaters.push({ text: won ? "競り勝った！" : "粘られた……", kind: won ? "up" : "down", age: 0, life: 1.3, at: race.t });
          if (won) { sfx("reelWin"); if (!taught.has("duelWon")) { taught.add("duelWon"); say(CALLS.duelWon(name), true); } }
          else if (!taught.has("duelHeld")) { taught.add("duelHeld"); say(CALLS.duelHeld(name)); }
        }
      }
    }
    race.events.length = 0;
  }
  const rivalName = id => RIVAL_PROFILES.find(profile => profile.id === id)?.name || "相手";
  /** 順位の入れ替わり・先頭の交代・半分と残り100mを見て、ファーリスの声と「抜いた」の文字を出す。 */
  function watchRace() {
    const rows = standings(race);
    const me = rows.find(row => row.id === "player");
    // 出だしの3秒は4頭が団子なので数えない。並走で行ったり来たりしても、文字は0.8秒に1回まで。
    if (race.t < 3) { lastPosition = me.position; leaderId = rows[0].id; return; }
    // 変わった順位は、前の知らせから0.8秒たつまで持ち越す（並走の行ったり来たりをまとめる）。
    const quiet = (floaters.at(-1)?.at ?? -9) < race.t - 0.8;
    if (me.position !== lastPosition && quiet) {
      const up = me.position < lastPosition;
      const other = rows[up ? me.position : me.position - 2]; // 入れ替わった相手（自分の1つ後ろ／前）
      floaters.push({ text: up ? `${me.position}位 ▲` : `${me.position}位 ▼`, kind: up ? "up" : "down", age: 0, life: 1.3, at: race.t });
      if (up) { sfx("reelWin"); if (me.position === 1) say(CALLS.lead, true); else if (other) say(CALLS.pass(other.name)); }
      else if (other) say(CALLS.passed(other.name));
      lastPosition = me.position;
    }
    if (rows[0].id !== leaderId) {
      if (leaderId && rows[0].id !== "player") say(CALLS.leader(rows[0].name));
      leaderId = rows[0].id;
    }
    const left = race.length - race.player.distance;
    // すぐ後ろ（2〜8m）に付かれて先頭を走っている時は、たまに知らせる（後ろの相手は画面の左で見えにくい）。
    const shadow = me.position === 1 && rows[1] ? race.player.distance - rows[1].distance : 99;
    if (shadow > 2 && shadow < 8 && race.t - closingAt > 14 && race.t > 8 && !inSpurt(race)) { closingAt = race.t; say(CALLS.closing(rows[1].name)); }
    if (!marks.has("half") && race.player.distance >= race.length / 2) { marks.add("half"); say(CALLS.half); }
    if (!marks.has("last100") && left <= 100) { marks.add("last100"); say(CALLS.last100, true); }
  }
  function animate(dt) {
    if (feedbackTimer > 0 && (feedbackTimer -= dt) <= 0) feedback.classList.remove("show");
    if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) banner.classList.remove("show");
    whip = race?.player.whipping && phase === "race" ? 1 : Math.max(0, whip - dt * 2.4);
    shake = Math.max(0, shake - dt * 1.6);
    if (hajimeTextTimer > 0) hajimeTextTimer -= dt;
    if (race && phase === "race") {
      // 速いほど前へ（最大120px）、遅いと後ろへ。カメラはゆっくり追いつく。
      const target = reducedMotion ? 0 : clamp((race.player.speed - PLAYER.base) * 12, -24, 60);
      camShift += (target - camShift) * Math.min(1, dt * 2.2);
      // 群れを収める: 前にいる相手（50m以内）と後ろの相手（40m以内）の遠い方へ、画面の余白を寄せる。
      let ahead = 0, behind = 0;
      for (const rival of race.rivals) {
        const gap = rival.distance - race.player.distance;
        if (gap > 0 && gap < 50) ahead = Math.max(ahead, gap); else if (gap < 0 && gap > -40) behind = Math.max(behind, -gap);
      }
      const frame = clamp(PLAYER_SCREEN_X - (ahead - behind) * FRAME_X.perMeter, FRAME_X.min, FRAME_X.max);
      frameX += (frame - frameX) * Math.min(1, dt * 0.9);
      draftFx += ((race.player.drafting ? 1 : 0) - draftFx) * Math.min(1, dt * 4);
      if (duelFx) duelFx.age += dt;
      // 蹄の音: 自分のラクダの一完歩ごと。速くなるほど詰まって聞こえる。
      const stride = Math.floor(race.player.distance / 4.5);
      if (stride !== lastStride) { if (lastStride >= 0) sfx("hoof"); lastStride = stride; }
    }
    spurtTint = Math.max(0, spurtTint - dt * 0.8);
    if (goTime >= 0) goTime += dt;
    if (callTimer > 0 && (callTimer -= dt) <= 0) callNode.classList.remove("show");
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 1 - dt * 2;
      if (p.age >= p.life) sparks.splice(i, 1);
    }
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.age += dt; w.r += 220 * dt; if (w.age >= w.life) waves.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.age += dt; if (f.age >= f.life) floaters.splice(i, 1); }
    if (race && (phase === "race" || phase === "goal")) {
      standingsStamp += dt;
      if (standingsStamp > 0.25) { standingsStamp = 0; renderStandings(); }
      updateHud();
      if (!reducedMotion) {
        const boosting = race.player.whipping;
        for (const camel of [race.player, ...race.rivals]) {
          const lane = laneOf(camel.id);
          const sx = screenX(camel);
          if (sx < -80 || sx > W + 80) continue;
          const me = camel.id === "player", big = me && boosting ? 1.6 : 1;
          dust.push({ x: sx - 30 * lane.scale * BODY, y: lane.y + 10, r: (6 + Math.random() * 8) * big * BODY, a: 0.42, vx: -(40 + Math.random() * 40) * big, vy: -(14 + Math.random() * 18), s: lane.scale });
          // 調子がいい間（調子の棒4本以上）は、自分の足元から金の粒がこぼれる。
          if (me && phase === "race" && race.player.rhythm >= 0.75 && Math.random() < 0.6) {
            sparks.push({ x: sx - 10 + Math.random() * 40, y: lane.y + 20 + Math.random() * 12, vx: -(80 + Math.random() * 80), vy: -(20 + Math.random() * 40), life: 0.5, age: 0, color: [255, 214, 102], r: 2 + Math.random() * 1.5 });
          }
        }
        const suv = suvPosition();
        dust.push({ x: suv.x - 70, y: suv.y + 26, r: 10 + Math.random() * 12, a: 0.32, vx: -(90 + Math.random() * 60), vy: -(10 + Math.random() * 20), s: 1 });
      }
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const puff = dust[i];
      puff.x += puff.vx * dt; puff.y += puff.vy * dt; puff.r += 22 * dt; puff.a -= 0.55 * dt;
      if (puff.a <= 0) dust.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const piece = confetti[i];
      piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.rot += dt * 4;
      if (piece.y > H + 20) confetti.splice(i, 1);
    }
  }
  const laneOf = id => LANES.find(lane => lane.id === id);
  // 見た目の位置（モデルはゴールで止まるが、画面では線を越えてからゆっくり速度を落として走り続ける）。
  const coast = (speed, since) => {
    if (!(since > 0)) return 0;
    const decel = 5, trot = 4, stop = Math.max(0, (speed - trot) / decel), a = Math.min(since, stop);
    return speed * a - 0.5 * decel * a * a + trot * Math.max(0, since - stop);
  };
  const afterGoal = () => (phase === "goal" || phase === "result") ? goalAt : 0;
  const viewDistance = camel => {
    if (!race) return 0;
    if (camel.finishedAt !== null) return camel.distance + coast(camel.speed, race.t + afterGoal() - camel.finishedAt);
    return camel.distance + camel.speed * afterGoal();
  };
  const screenX = camel => PLAYER_SCREEN_X + (viewDistance(camel) - camAt) * PX_PER_M;
  // SUV は自分のラクダの少し前を並走する（左下・右下のボタンに隠れない画面の中央寄り）。
  // SUV（調教師の車）は自分のラクダの少し前を並走し、ラクダが伸びると半分だけ遅れてついていく。
  // 右端は「ムチ」のボタンにかからない位置まで（車体の右端 ≦ 約850px）。
  // 車体の左端（中心−144px）が自分のラクダの鼻先より右に来るように置く（ラクダの脚を車で隠さない）。
  const suvPosition = () => ({ x: clamp(playerX() + 262, 640, 716) + Math.sin((race?.t || 0) * 1.3) * 4, y: 640 + Math.sin((race?.t || 0) * 9) * 1.5 });

  // ---- 描写 -----------------------------------------------------------------------------------------
  function draw() {
    const t = (race?.t || 0) + afterGoal();
    camAt = race ? viewDistance(race.player) - (playerX() - PLAYER_SCREEN_X) / PX_PER_M : 0;
    const camX = camAt;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 揺れ（GO・ムチ・ゴール）と、ムチの間だけ自分のラクダへ少し寄る。
    if (!reducedMotion && race) {
      const amp = shake * shake * 14;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      // 揺れで画面の端が空かないよう、揺れの幅だけ少し拡大して覆う。
      const zoom = 1 + amp / 300 + whip * 0.035 + (phase === "goal" && slow > 0 ? 0.05 * Math.min(1, slow) : 0);
      if (zoom > 1) { const lane = laneOf("player"), px = playerX(); ctx.translate(px, lane.y); ctx.scale(zoom, zoom); ctx.translate(-px, -lane.y); }
    }
    if (art) drawPaintedGround(camX);
    else drawPlainGround(camX);
    for (const lane of LANES) { ctx.fillStyle = "rgba(255,240,210,0.07)"; ctx.fillRect(0, lane.y - 2, W, 3); }
    // 柵（奥と手前）と100mごとの表示板。
    drawEventDecor(camX);
    drawFence(camX, 396, 0.7);
    drawMarkers(camX);
    drawGates(camX);
    drawSpeedLines(0);
    // 砂煙（奥）。
    drawDust(0.6);
    // ラクダ（奥から手前）。
    if (race) {
      const order = LANES.map(lane => lane.id === "player" ? race.player : race.rivals.find(r => r.id === lane.id)).filter(Boolean);
      for (const camel of order) {
        const lane = laneOf(camel.id);
        const sx = screenX(camel);
        if (camel.id === "player") drawPlayerRing(sx, lane.y, lane.scale, t);
        drawCamel(sx, lane.y, lane.scale, camel, t);
      }
      drawStartBar(camX);
      drawFence(camX, 604, 1);
      drawOffscreen();
      drawWhipWind();
      drawSuv();
      for (const camel of order) {
        const lane = laneOf(camel.id);
        drawNameTag(screenX(camel), lane.y, lane.scale, camel);
      }
      drawDust(1);
      drawSpeedLines(1);
      drawDraft();
      drawDuel();
      drawLight();
      drawCue();
      drawEffects();
      drawConfetti();
    } else { drawFence(camX, 604, 1); drawSuv(); drawLight(); }
    ctx.restore();
  }
  /** 絵の背景: 奥の景色をゆっくり流し、走路・道・手前の砂地をタイルで速く流す。 */
  function drawPaintedGround(camX) {
    const progress = race ? clamp(camX / race.length, 0, 1) : 0;
    const width = W * BACKDROP.scale, height = H * BACKDROP.scale;
    const pan = -(width - W) * progress;
    const top = BACKDROP.ground - BACKDROP.sourceGround * BACKDROP.scale;
    ctx.drawImage(art.track, pan, top, width, height);
    const scroll = ((camX * PX_PER_M) % TILE_W + TILE_W) % TILE_W;
    const strip = (tile, y) => { for (let x = -scroll; x < W; x += TILE_W) ctx.drawImage(tile, x, y); };
    // 奥の柵の根元へ、走路の砂をぼかしてつなぐ。
    ctx.save();
    const fade = ctx.createLinearGradient(0, TRACK_TOP - 14, 0, TRACK_TOP + 12);
    fade.addColorStop(0, "rgba(217,180,124,0)"); fade.addColorStop(1, "rgba(217,180,124,1)");
    ctx.fillStyle = fade; ctx.fillRect(0, TRACK_TOP - 14, W, 26);
    ctx.restore();
    strip(art.ground.sand, TRACK_TOP);
    strip(art.ground.road, TRACK_BOTTOM);
    // 道より手前の砂（少し暗く、ぼかし気味）。
    strip(art.ground.sand, ROAD_BOTTOM);
    ctx.fillStyle = "rgba(90,52,22,0.28)"; ctx.fillRect(0, ROAD_BOTTOM, W, H - ROAD_BOTTOM);
    // 遠くの走路ほど薄い霞。
    const haze = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_TOP + 90);
    haze.addColorStop(0, "rgba(255,226,170,0.35)"); haze.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, TRACK_TOP, W, 90);
  }
  /** 絵が読めないときの背景（空・砂丘・平らな地面）。 */
  function drawPlainGround(camX) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, "#1f3a66"); sky.addColorStop(0.55, "#6f9ad0"); sky.addColorStop(1, "#f3d9a7");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 2);
    ctx.fillStyle = "rgba(255, 236, 190, 0.95)"; ctx.beginPath(); ctx.arc(1040, 150, 46, 0, Math.PI * 2); ctx.fill();
    drawDunes(camX * 0.08, HORIZON - 40, 90, "#c9a56a", 0.9);
    drawDunes(camX * 0.22 + 400, HORIZON - 6, 60, "#dbb77c", 1);
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, "#e2c48c"); ground.addColorStop(0.45, "#d9b67a"); ground.addColorStop(1, "#c79d5f");
    ctx.fillStyle = ground; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    ctx.fillStyle = "#cfa86a"; ctx.fillRect(0, 400, W, 200);
    ctx.fillStyle = "#a88a5c"; ctx.fillRect(0, TRACK_BOTTOM, W, ROAD_BOTTOM - TRACK_BOTTOM);
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, 648, W, 2);
  }
  /** 朝の光: 左（太陽の側）から暖かい光、四隅を少し落とす。 */
  function drawLight() {
    ctx.save();
    const warm = ctx.createLinearGradient(0, 0, W, 0);
    warm.addColorStop(0, "rgba(255,170,80,0.16)"); warm.addColorStop(0.45, "rgba(255,190,110,0.04)"); warm.addColorStop(1, "rgba(80,60,120,0.06)");
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, H * 0.95);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(30,14,4,0.32)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function drawDunes(offset, baseY, amp, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, HORIZON + 4);
    for (let x = 0; x <= W; x += 16) {
      const wx = x + offset;
      const y = baseY - Math.abs(Math.sin(wx / 260)) * amp - Math.sin(wx / 73) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, HORIZON + 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  /** 白い管の柵。支柱は砂に右下へ影を落とし、手すりは上が明るく下が陰る。 */
  // 大会の飾りは走路の奥だけに置く。視線を遮らず、既存の背景・ラクダの絵を活かす。
  function drawEventDecor(camX) {
    if (!race || race.cup === "practice") return;
    const palette = race.cup === "expert" ? ["#e5b64a", "#51396e", "#fff1cf"]
      : race.cup === "standard" ? ["#e5b64a", "#bd4946", "#fff1cf"] : ["#40978d", "#f2c16b", "#fff1cf"];
    const offset = ((camX * 2) % 360 + 360) % 360;
    ctx.save();
    for (let x = -offset; x < W + 360; x += 360) {
      ctx.strokeStyle = "#80613d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 320); ctx.lineTo(x, 393); ctx.moveTo(x + 360, 320); ctx.lineTo(x + 360, 393); ctx.stroke();
      ctx.strokeStyle = "#e6d0a2"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, 322); ctx.quadraticCurveTo(x + 180, 354, x + 360, 322); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const px = x + 15 + i * 30, k = (px - x) / 360, py = 322 + 64 * k * (1 - k);
        ctx.fillStyle = palette[i % palette.length];
        ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.lineTo(px + 8, py + 1); ctx.lineTo(px, py + 19); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawFence(camX, y, scale) {
    const spacing = 5 * PX_PER_M;
    const start = -((camX * PX_PER_M - PLAYER_SCREEN_X) % spacing) - spacing;
    const postH = 22 * scale, postW = 4 * scale, top = y - postH;
    ctx.save();
    ctx.fillStyle = "rgba(70,40,15,0.22)";
    for (let x = start; x < W + spacing; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + postW, y); ctx.lineTo(x + postW + 16 * scale, y + 5 * scale); ctx.lineTo(x + 16 * scale, y + 5 * scale); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(70,40,15,0.18)"; ctx.fillRect(0, y + 2, W, 3 * scale);
    for (let x = start; x < W + spacing; x += spacing) {
      const post = ctx.createLinearGradient(x, 0, x + postW, 0);
      post.addColorStop(0, "#fffaf0"); post.addColorStop(1, "#c9c0ae");
      ctx.fillStyle = post; ctx.fillRect(x, top, postW, postH);
    }
    const rail = ctx.createLinearGradient(0, top - 3 * scale, 0, top + 4 * scale);
    rail.addColorStop(0, "#fffdf6"); rail.addColorStop(0.55, "#efe8da"); rail.addColorStop(1, "#b9ae98");
    ctx.fillStyle = rail; ctx.fillRect(0, top - 3 * scale, W, 7 * scale);
    ctx.fillStyle = "rgba(255,190,110,0.35)"; ctx.fillRect(0, top - 3 * scale, W, 1);
    ctx.restore();
  }
  /** 100mごとの距離板: 木の杭に、上が朱色のクリーム色の板。右下へ短い影。 */
  function drawMarkers(camX) {
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let m = 100; m < (race?.length || 0); m += 100) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -50 || sx > W + 50) continue;
      ctx.fillStyle = "rgba(70,40,15,0.22)"; ctx.beginPath(); ctx.moveTo(sx - 2, 396); ctx.lineTo(sx + 3, 396); ctx.lineTo(sx + 22, 402); ctx.lineTo(sx + 16, 402); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#6b4a2a"; ctx.fillRect(sx - 2, 350, 5, 47);
      ctx.fillStyle = "#8a6238"; ctx.fillRect(sx - 2, 350, 2, 47);
      ctx.fillStyle = "#3a2412"; ctx.beginPath(); ctx.roundRect(sx - 27, 327, 54, 31, 3); ctx.fill();
      ctx.fillStyle = "#f6ecd6"; ctx.beginPath(); ctx.roundRect(sx - 25, 329, 50, 27, 2); ctx.fill();
      ctx.fillStyle = "#b8322c"; ctx.fillRect(sx - 25, 329, 50, 6);
      ctx.fillStyle = "rgba(58,36,18,0.14)"; ctx.fillRect(sx - 25, 350, 50, 6);
      ctx.font = `900 15px ${FONT}`; ctx.fillStyle = "#2a1d14"; ctx.fillText(String(m), sx, 346);
    }
    ctx.restore();
  }
  /** スタートとゴールの門: 木の柱2本に布の幕を張り、上に小旗。ゴールは幕の上下が市松。 */
  function drawGates(camX) {
    for (const [m, label, cloth, ink] of [[0, "START", "#2f8f6b", "#f6ecd6"], [race?.length || RACE.length, "FINISH", "#c8302a", "#fff6e5"]]) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -160 || sx > W + 160) continue;
      const goal = m > 0, t = (race?.t || 0) + afterGoal();
      ctx.save();
      // 柱（奥の柵の外と、手前の柵の外）。手前の柱が太く、右下へ影。
      ctx.fillStyle = "rgba(70,40,15,0.25)"; ctx.beginPath(); ctx.moveTo(sx - 8, 610); ctx.lineTo(sx + 8, 610); ctx.lineTo(sx + 46, 620); ctx.lineTo(sx + 28, 620); ctx.closePath(); ctx.fill();
      for (const [px, top, bottom, w] of [[sx - 20, 262, 398, 8], [sx - 7, 246, 611, 13]]) {
        ctx.fillStyle = "#5c3d20"; ctx.fillRect(px, top, w, bottom - top);
        ctx.fillStyle = "#8a6238"; ctx.fillRect(px, top, w * 0.4, bottom - top);
        ctx.fillStyle = "#3a2412"; ctx.fillRect(px - 1, top - 4, w + 2, 5);
      }
      // 小旗（柱の上で少しはためく）。
      const wave = reducedMotion ? 0 : Math.sin(t * 7 + m) * 3;
      for (const [px, py, size] of [[sx - 16, 258, 15], [sx, 242, 20]]) {
        ctx.fillStyle = goal ? "#fff6e5" : cloth;
        ctx.beginPath(); ctx.moveTo(px, py - size); ctx.lineTo(px + size * 1.5, py - size * 0.62 + wave); ctx.lineTo(px, py - size * 0.25); ctx.closePath(); ctx.fill();
        if (goal) { ctx.fillStyle = "#1a120c"; ctx.beginPath(); ctx.moveTo(px, py - size); ctx.lineTo(px + size * 0.75, py - size * 0.81 + wave / 2); ctx.lineTo(px, py - size * 0.62); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = "#3a2412"; ctx.fillRect(px - 1, py - size, 2, size);
      }
      // 幕: 手前の柱から左右へ張った布（下の辺が少したるむ）。縁に濃い縫い目。
      const bx = sx - 96, by = 268, bw = 192, bh = 46;
      ctx.fillStyle = "rgba(30,14,4,0.28)"; ctx.beginPath(); ctx.roundRect(bx + 5, by + 6, bw, bh, 3); ctx.fill();
      ctx.fillStyle = cloth; ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bh); ctx.quadraticCurveTo(bx + bw / 2, by + bh + 7, bx, by + bh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.13)"; ctx.fillRect(bx, by, bw, bh * 0.42);
      if (goal) for (let i = 0; i < 24; i++) for (const row of [0, 1]) {
        ctx.fillStyle = (i + row) % 2 ? "#1a120c" : "#fff6e5"; ctx.fillRect(bx + i * 8, row ? by + 6 : by, 8, 6);
      }
      ctx.strokeStyle = "rgba(30,14,4,0.55)"; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.font = `900 24px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(30,14,4,0.7)"; ctx.strokeText(label, sx, by + (goal ? 30 : 25));
      ctx.fillStyle = ink; ctx.fillText(label, sx, by + (goal ? 30 : 25));
      ctx.restore();
    }
  }
  /** 絵のラクダ（4コマ）とロボット騎手。足元を ground の線に、騎手をコブの後ろにそろえる。 */
  function drawCamelSprite(x, y, s, camel, t) {
    const k = s * CAMEL_ART.scale;
    const frame = camel.speed > 1 ? Math.floor((viewDistance(camel) / CAMEL_ART.stride) * 4) % 4 : 0;
    const image = art.skins[camel.id]?.[(frame + 4) % 4] || art.camel[(frame + 4) % 4];
    const iw = CAMEL_ART.width * k, ih = CAMEL_ART.height * k;
    const dx = x - CAMEL_ART.centerX * k, dy = y + 30 * s - CAMEL_ART.ground * k;
    const me = camel.id === "player";
    ctx.save();
    ctx.fillStyle = "rgba(70,38,12,0.28)"; ctx.beginPath(); ctx.ellipse(x + 22 * s * BODY, y + 31 * s, 66 * s * BODY, 7 * s * BODY, 0, 0, Math.PI * 2); ctx.fill();
    // ムチの間と声で大きく伸びた直後は、自分のラクダの後ろに残像を2つ。
    if (me && !reducedMotion && race && (race.player.whipping || race.player.surge > 1.2) && phase === "race") {
      for (const [back, alpha] of [[46, 0.16], [24, 0.28]]) { ctx.globalAlpha = alpha; ctx.drawImage(image, dx - back * s, dy, iw, ih); }
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(image, dx, dy, iw, ih);
    // 騎手: 鞍の底を背に合わせ、ムチの間は腕を回して前後に揺らす（自分のラクダ）。
    const jk = k * JOCKEY_ART.scale;
    const sx = dx + CAMEL_ART.seatX * k, sy = dy + CAMEL_ART.seatY * k;
    const swing = me ? (race?.player.whipping ? Math.sin(t * 22) * 0.3 : Math.sin(whip * Math.PI * 3) * whip * 0.28) : (camel.whipping ? Math.sin(t * 22) * 0.3 : Math.sin(t * 6 + x) * 0.04);
    ctx.translate(sx, sy); ctx.rotate(-swing);
    ctx.drawImage(art.jockey, -JOCKEY_ART.cx * jk, -JOCKEY_ART.bottom * jk, art.jockey.width * jk, art.jockey.height * jk);
    ctx.restore();
  }
  /** 名札。AI はゼッケンと同じ色の丸と名前を小さく、自分は金の札に今の順位を大きく（手前の柵より上に描く）。 */
  function drawNameTag(x, y, s, camel) {
    if (x < -80 || x > W + 80) return;
    const me = camel.id === "player";
    // 出だしは4頭が重なるので、AI の名札はゼッケンだけにする（自分の札は出す）。
    if (!me && (phase === "countdown" || (race && race.t < 2.5))) return;
    // スマホで大きくした分だけ札を上げ、下の「声をかける」ボタンに隠れないようにする。
    if (!me && duelFx?.who === camel.id) return;
    const zoom = Math.min(textScale, me ? 1.4 : 1.3);
    ctx.save(); ctx.translate(me ? x : x - 14 * s * BODY, me ? y + 36 * s - (zoom - 1) * 50 : y - 104 * s * BODY - (zoom - 1) * 10); ctx.scale(zoom, zoom); ctx.textBaseline = "middle";
    if (me) {
      const position = race ? standings(race).find(row => row.id === "player").position : 1;
      const name = `★ ${camel.name}`, rank = `${position}位`;
      ctx.font = `900 15px ${FONT}`; const nameW = ctx.measureText(name).width;
      ctx.font = `900 17px ${FONT}`; const rankW = ctx.measureText(rank).width;
      const w = nameW + rankW + 34, h = 26;
      ctx.fillStyle = "rgba(60,30,4,0.55)"; ctx.beginPath(); ctx.roundRect(-w / 2 + 2, 3, w, h, 13); ctx.fill();
      ctx.fillStyle = "#ffcf5a"; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 13); ctx.fill();
      ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#3a2006"; ctx.beginPath(); ctx.roundRect(w / 2 - rankW - 16, 3, rankW + 13, h - 6, 10); ctx.fill();
      ctx.font = `900 15px ${FONT}`; ctx.textAlign = "left"; ctx.fillStyle = "#3a2006"; ctx.fillText(name, -w / 2 + 11, h / 2 + 1);
      ctx.font = `900 17px ${FONT}`; ctx.textAlign = "center"; ctx.fillStyle = "#ffe27a"; ctx.fillText(rank, w / 2 - rankW / 2 - 9.5, h / 2 + 1);
    } else {
      ctx.globalAlpha = 0.85;
      ctx.font = `bold 12px ${FONT}`;
      const w = ctx.measureText(camel.name).width + 22, h = 18;
      ctx.fillStyle = "rgba(20,12,6,0.66)"; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 9); ctx.fill();
      ctx.fillStyle = camel.color; ctx.beginPath(); ctx.arc(-w / 2 + 9, h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff6e5"; ctx.textAlign = "center"; ctx.fillText(camel.name, 5, h / 2 + 0.5);
    }
    ctx.restore();
  }
  /** 自分のラクダの足元の金の輪（脈打つ）。いちばん先に描いて、ラクダの下に敷く。 */
  function drawPlayerRing(x, y, s, t) {
    const pulse = reducedMotion ? 0.5 : (Math.sin(t * 5) + 1) / 2;
    const cx = x + 22 * s * BODY, cy = y + 31 * s, rx = 84 * s * BODY, ry = 14 * s * BODY;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    glow.addColorStop(0, "rgba(255,214,102,0.34)"); glow.addColorStop(0.7, "rgba(255,190,70,0.16)"); glow.addColorStop(1, "rgba(255,190,70,0)");
    ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = (3 + pulse * 2) * (rx / ry) * 0.5; ctx.strokeStyle = `rgba(255,214,102,${0.65 + pulse * 0.3})`;
    ctx.beginPath(); ctx.arc(cx, cy, rx * (0.92 + pulse * 0.06), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawCamel(x, y, s, camel, t) {
    if (art) { drawCamelSprite(x, y, s, camel, t); return; }
    const gait = camel.speed > 1 ? (camel.distance / 3.4) * Math.PI * 2 : 0; // 歩幅に合わせた足の位相
    const bob = Math.sin(gait * 2) * 3 * s;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    const body = camel.color, dark = shade(body, -60), light = shade(body, 28);
    // 影。
    ctx.fillStyle = "rgba(60,40,20,0.22)"; ctx.beginPath(); ctx.ellipse(0, 30 - bob / s, 50, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 足（4本。長く、膝で折れる。前後で位相をずらしたギャロップ）。
    ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const legs = [[-30, 0, -1], [-22, Math.PI * 0.85, 1], [20, Math.PI * 1.15, -1], [28, Math.PI * 0.3, 1]];
    for (const [lx, phase, side] of legs) {
      const swing = Math.sin(gait + phase) * 18, lift = Math.max(0, Math.cos(gait + phase)) * 10;
      ctx.strokeStyle = side > 0 ? dark : shade(body, -90);
      ctx.beginPath(); ctx.moveTo(lx, 2); ctx.lineTo(lx + swing * 0.45, 16 - lift * 0.4); ctx.lineTo(lx + swing, 30 - lift); ctx.stroke();
    }
    // 胴（やや前上がり）とこぶ（背中の上にひとつ、高く）。
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -2, 42, 15, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, -20, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(6, -24, 10, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    // 首（前から高く持ち上げて S 字に）と頭（前を向き、少し下げる）。
    ctx.strokeStyle = body; ctx.lineWidth = 13; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(34, -6); ctx.quadraticCurveTo(50, -8, 58, -34); ctx.quadraticCurveTo(62, -48, 66, -52); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(72, -54, 13, 7, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(82, -51, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill(); // 鼻先
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(66, -60, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill(); // 耳
    ctx.fillStyle = "#1a120c"; ctx.beginPath(); ctx.arc(74, -57, 1.8, 0, Math.PI * 2); ctx.fill();
    // 尾。
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-42, -4); ctx.quadraticCurveTo(-54, 2 + Math.sin(gait) * 4, -52, 14); ctx.stroke();
    // 鞍とロボット騎手（こぶの後ろに座る小さな箱型。アンテナ・点滅する灯・振る腕）。
    ctx.fillStyle = camel.color; ctx.fillRect(-32, -22, 26, 8);
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(-30, -14, 22, 3);
    ctx.fillStyle = "#e9eef3"; ctx.fillRect(-30, -40, 18, 18);
    ctx.fillStyle = "#34404a"; ctx.fillRect(-30, -40, 18, 4);
    ctx.fillStyle = "#7fd3ff"; ctx.fillRect(-26, -34, 10, 4); // バイザー
    ctx.fillStyle = "#c9d2da"; ctx.beginPath(); ctx.arc(-21, -42, 5, Math.PI, 0); ctx.fill(); // 丸い頭
    ctx.strokeStyle = "#34404a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-17, -42); ctx.lineTo(-15, -58); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 8 + x) > 0 ? "#ff5a5a" : "#5a1a1a"; ctx.beginPath(); ctx.arc(-15, -59, 2.4, 0, Math.PI * 2); ctx.fill();
    // 腕（ムチで振る）。ムチを振っている間は、ライバルの騎手も大きく回す。
    const swing = camel.id === "player" ? (race?.player.whipping ? Math.sin(t * 22) : Math.sin(whip * Math.PI * 3) * whip) : (camel.whipping ? Math.sin(t * 22) : Math.sin(t * 3 + x) * 0.1);
    ctx.save(); ctx.translate(-30, -32); ctx.rotate(-0.6 - swing * 1.4);
    ctx.strokeStyle = "#34404a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, 0); ctx.stroke();
    ctx.strokeStyle = "#f0c060"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-30, 2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  /** 画面の外のライバル: 端に色の札と距離（「どこにいるか」が一目で分かる大きさ）。 */
  function drawOffscreen() {
    for (const rival of race.rivals) {
      const sx = screenX(rival);
      if (sx >= -40 && sx <= W + 40) continue;
      const lane = laneOf(rival.id), right = sx > W;
      const gap = Math.abs(Math.round(viewDistance(rival) - viewDistance(race.player)));
      const text = `${rival.name} ${right ? "+" : "−"}${gap}m`;
      ctx.save();
      ctx.translate(right ? W - 14 : 14, lane.y - 18); ctx.scale(Math.min(textScale, 1.3), Math.min(textScale, 1.3));
      ctx.font = `900 14px ${FONT}`; ctx.textBaseline = "middle";
      const w = ctx.measureText(text).width + 34, h = 24, x0 = right ? -w : 0;
      ctx.fillStyle = "rgba(26,14,6,0.78)"; ctx.beginPath(); ctx.roundRect(x0, -h / 2, w, h, 6); ctx.fill();
      ctx.fillStyle = rival.color; ctx.beginPath();
      const ax = right ? -9 : 9, dir = right ? 1 : -1;
      ctx.moveTo(ax + dir * 5, 0); ctx.lineTo(ax - dir * 4, -6); ctx.lineTo(ax - dir * 4, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff6e5"; ctx.textAlign = right ? "right" : "left"; ctx.fillText(text, right ? -20 : 20, 1);
      ctx.restore();
    }
  }
  /** 絵の SUV。車体の車輪の上に回転用の車輪を重ね、地面を流れる速さで回す。 */
  function drawSuvSprite(x, y) {
    const k = SUV_ART.scale;
    const dx = x - SUV_ART.centerX * k, dy = y + 41 - SUV_ART.ground * k;
    ctx.save();
    ctx.fillStyle = "rgba(40,25,10,0.28)"; ctx.beginPath(); ctx.ellipse(x, y + 40, 125, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(art.suv, dx, dy, art.suv.width * k, art.suv.height * k);
    drawHajime(dx, dy, k);
    const size = art.wheel.width * SUV_ART.wheel * k;
    const angle = ((race ? viewDistance(race.player) : 0) * PX_PER_M) / (SUV_ART.radius * k);
    for (const [wx, wy] of SUV_ART.wheels) {
      ctx.save(); ctx.translate(dx + wx * k, dy + wy * k); ctx.rotate(reducedMotion ? 0 : angle);
      ctx.drawImage(art.wheel, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }
  /** 車体絵に焼き込みのはじめへ重ねる、リモコンの状態ランプと吹き出し。人物とリモコン本体は車体絵の一部。 */
  function drawHajime(dx, dy, k) {
    const t = (race?.t || 0) + afterGoal();
    // リモコンのアンテナ先端の状態ランプ（声で緑、ムチの間は赤く点滅）。
    const px = dx + HAJIME_AT.antenna[0] * k, py = dy + HAJIME_AT.antenna[1] * k;
    const whipping = race?.player.whipping, voiced = hajimeTextTimer > 0 && !whipping;
    ctx.save();
    ctx.fillStyle = whipping ? (Math.sin(t * 30) > 0 ? "#ff5a4a" : "#7a1a12") : voiced ? "#8ee6a8" : "#3a5a40";
    ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 吹き出し（声・ムチを入れた時の掛け声）。絵（CR-UI13）があれば九分割で描き、無ければ従来の図形。
    if (hajimeTextTimer > 0 && hajimeText) {
      const alpha = Math.min(1, hajimeTextTimer / 0.2);
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(dx + HAJIME_AT.balloon[0] * k, dy + HAJIME_AT.balloon[1] * k); ctx.scale(textScale, textScale);
      ctx.font = `900 17px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const balloonImage = art?.balloon;
      // 箱は尻尾（左下）基準で置く: 原点＝はじめの頭の真上。尻尾の先が原点に来て、箱は右上へ伸びる。
      // （中央基準だと長い掛け声ほど尻尾が車の後ろへ流れてしまう。）
      if (balloonImage) {
        const bw = Math.max(ctx.measureText(hajimeText).width + 34, 104), bh = 42;
        // 九分割: 原画 384×192・帯48px。尻尾は左下の角の中にある。
        const S = 48, iw = balloonImage.width, ih = balloonImage.height, cs = 21;
        const x0 = -14, y0 = -bh - 6, x1 = x0 + cs, x2 = x0 + bw - cs, y1 = y0 + cs, y2 = y0 + bh - cs;
        ctx.drawImage(balloonImage, 0, 0, S, S, x0, y0, cs, cs);
        ctx.drawImage(balloonImage, iw - S, 0, S, S, x2, y0, cs, cs);
        ctx.drawImage(balloonImage, 0, ih - S, S, S, x0, y2, cs, cs);
        ctx.drawImage(balloonImage, iw - S, ih - S, S, S, x2, y2, cs, cs);
        ctx.drawImage(balloonImage, S, 0, iw - 2 * S, S, x1, y0, bw - 2 * cs, cs);
        ctx.drawImage(balloonImage, S, ih - S, iw - 2 * S, S, x1, y2, bw - 2 * cs, cs);
        ctx.drawImage(balloonImage, 0, S, S, ih - 2 * S, x0, y1, cs, bh - 2 * cs);
        ctx.drawImage(balloonImage, iw - S, S, S, ih - 2 * S, x2, y1, cs, bh - 2 * cs);
        ctx.drawImage(balloonImage, S, S, iw - 2 * S, ih - 2 * S, x1, y1, bw - 2 * cs, bh - 2 * cs);
        ctx.fillStyle = "#2a1a0e"; ctx.fillText(hajimeText, x0 + bw / 2, y0 + bh / 2);
      } else {
        const bw = ctx.measureText(hajimeText).width + 24, bh = 30;
        const x0 = -18, y0 = -bh - 12;
        ctx.fillStyle = "#fffaf0"; ctx.strokeStyle = "#2a1a0e"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(x0, y0, bw, bh, 15); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + bh - 1); ctx.lineTo(x0 + 16, y0 + bh + 10); ctx.lineTo(x0 + 24, y0 + bh - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#2a1a0e"; ctx.fillText(hajimeText, x0 + bw / 2, y0 + bh / 2 + 1);
      }
      ctx.restore();
    }
  }
  function drawSuv() {
    const { x, y } = suvPosition();
    if (art) { drawSuvSprite(x, y); return; }
    const t = race?.t || 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(40,25,10,0.28)"; ctx.beginPath(); ctx.ellipse(0, 30, 92, 9, 0, 0, Math.PI * 2); ctx.fill();
    // 車体（白いSUV）。
    ctx.fillStyle = "#f3f1ea"; roundRect(-86, -14, 172, 38, 8);
    ctx.fillStyle = "#e4e0d4"; roundRect(-56, -40, 112, 30, 10);
    ctx.fillStyle = "#39506a"; roundRect(-50, -36, 44, 22, 4); roundRect(2, -36, 46, 22, 4);
    // 窓から出たリモコンのアンテナと、覗く調教師。
    ctx.fillStyle = "#3b2e22"; ctx.beginPath(); ctx.arc(28, -24, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1a120c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44, -28); ctx.lineTo(60, -62); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 10) > 0 ? "#8ee6a8" : "#2f6b44"; ctx.beginPath(); ctx.arc(60, -63, 3, 0, Math.PI * 2); ctx.fill();
    // 車輪。
    for (const wx of [-52, 54]) {
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(wx, 26, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9a9a9a"; ctx.beginPath(); ctx.arc(wx, 26, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, 26); ctx.lineTo(wx + Math.cos(t * 18) * 7, 26 + Math.sin(t * 18) * 7); ctx.stroke();
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function drawDust(layer) {
    for (const puff of dust) {
      if ((layer < 1) !== (puff.s < 0.9)) continue;
      const r = puff.r * puff.s, a = Math.max(0, puff.a);
      const glow = ctx.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, r);
      glow.addColorStop(0, `rgba(238, 210, 160, ${a})`); glow.addColorStop(0.6, `rgba(222, 186, 132, ${a * 0.55})`); glow.addColorStop(1, "rgba(222, 186, 132, 0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(puff.x, puff.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  /** 自分のラクダの頭の上: 輪が出ていない間は金の▼（自分の目印）、輪が出たら声かけの輪。 */
  function drawCue() {
    if (phase !== "race" && phase !== "countdown") return;
    const cue = phase === "race" ? activeCue(race) : null;
    const { x: cx, y: cy } = cuePoint();
    const t = race?.t || 0;
    if (!cue) {
      const bob = reducedMotion ? 0 : Math.sin(t * 6) * 4;
      ctx.save(); ctx.translate(cx, cy - 44 + bob);
      ctx.fillStyle = "rgba(60,30,4,0.45)"; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.lineTo(17, -9); ctx.lineTo(1, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffcf5a"; ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(16, -12); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // スタート前と出だしは「これがあなたのラクダ」の吹き出し。
      if (phase === "countdown" || t < 1.5) {
        const text = "あなたのラクダ  ハビーバ";
        ctx.save(); ctx.translate(cx, cy - 64); ctx.scale(textScale, textScale);
        ctx.font = `900 18px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText(text).width + 32, h = 34, by = -22;
        ctx.fillStyle = "#ffcf5a"; ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(-w / 2, by - h / 2, w, h, 17); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3a2006"; ctx.fillText(text, 0, by + 1); ctx.restore();
      }
      return;
    }
    // 内側の目標の輪。
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(58,30,6,0.5)"; ctx.beginPath(); ctx.arc(cx, cy, CUE_AT.inner, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,245,220,0.95)";
    ctx.beginPath(); ctx.arc(cx, cy, CUE_AT.inner, 0, Math.PI * 2); ctx.stroke();
    const progress = clamp(cue.progress, 0, 1.3);
    const radius = CUE_AT.inner + (1 - Math.min(progress, 1)) * CUE_AT.outer;
    const late = cue.dt > 0;
    // 縮む輪は濃い縁を先に引いて、砂の上でも読めるようにする。競り合いの間は朱色。
    ctx.lineWidth = 9; ctx.strokeStyle = `rgba(58,30,6,${late ? 0.25 : 0.55})`; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = late ? `rgba(255,120,120,${clamp(1 - cue.dt / CUE.good, 0, 1)})` : race.player.duel ? "rgba(255, 150, 90, 0.98)" : "rgba(255, 210, 110, 0.95)";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    if (Math.abs(cue.dt) <= CUE.perfect) { ctx.fillStyle = "rgba(255,230,160,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, CUE_AT.inner, 0, Math.PI * 2); ctx.fill(); }
  }
  /** スタートの柵: 走路を横切る赤白の棒。GO で上へ跳ね上がる。 */
  function drawStartBar(camX) {
    const sx = PLAYER_SCREEN_X + (0 - camX) * PX_PER_M + 118;
    if (sx < -60 || sx > W + 60) return;
    const lift = goTime < 0 ? 0 : Math.min(1, goTime / 0.45);
    const rise = (1 - (1 - lift) ** 3) * 300;
    if (rise >= 300) return;
    ctx.save(); ctx.globalAlpha = 1 - lift * 0.6;
    const top = 398 - rise, bottom = 600 - rise, slant = 26;
    // 奥から手前へ少し傾けた棒（手前ほど右）。赤白の縞。
    const len = Math.hypot(slant, bottom - top), angle = Math.atan2(bottom - top, slant);
    ctx.translate(sx - slant / 2, top); ctx.rotate(angle);
    for (let i = 0; i < len; i += 22) { ctx.fillStyle = (i / 22) % 2 ? "#fffaf0" : "#c8302a"; ctx.fillRect(i, -5, Math.min(22, len - i), 10); }
    ctx.strokeStyle = "rgba(40,20,6,0.55)"; ctx.lineWidth = 1.5; ctx.strokeRect(0, -5, len, 10);
    ctx.restore();
  }
  /** 速さの線: 自分の速さ・ムチ・スパートで濃く、数を増やす。layer 0 は奥（空と柵の上）、1 は手前。 */
  function drawSpeedLines(layer) {
    if (reducedMotion || !race || phase !== "race") return;
    const boosting = race.player.whipping;
    const fast = clamp((race.player.speed - 17) / 5, 0, 1);
    const power = clamp(fast * 0.55 + (boosting ? 0.5 : 0) + (inSpurt(race) ? 0.3 : 0), 0, 1);
    if (power < 0.08) return;
    const move = viewDistance(race.player) * PX_PER_M;
    ctx.save();
    ctx.lineCap = "round";
    streaks.forEach((line, i) => {
      if ((i % 2) !== layer || i / streaks.length > 0.35 + power * 0.65) return;
      // 奥は柵とテントの高さだけ（空に線を引くと傷に見える）、手前は道と手前の砂。
      const y = layer ? 600 + (line.y % 110) : 318 + (line.y % 70);
      const x = W - ((line.x + move * line.v * 1.6) % (W + 300));
      const len = line.len * (0.6 + power);
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, "rgba(255,248,230,0)"); g.addColorStop(1, `rgba(255,248,230,${0.25 + power * 0.45})`);
      ctx.strokeStyle = g; ctx.lineWidth = layer ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    });
    ctx.restore();
  }
  /** 自機の上下を走る白青の風。声の輪・名札・ラクダ本体は空ける。 */
  function drawWhipWind() {
    if (reducedMotion || phase !== "race" || !race?.player.whipping) return;
    const x = playerX(), y = laneOf("player").y;
    ctx.save(); ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const offset = 350 - ((race.t * (420 + i * 21) + i * 91) % 700);
      const sx = x + offset, sy = y + (i % 2 ? 39 + (i % 3) * 9 : -142 - (i % 3) * 8);
      const len = (inSpurt(race) ? 130 : 85) + (i % 4) * 19;
      const gradient = ctx.createLinearGradient(sx, sy, sx + len, sy);
      gradient.addColorStop(0, "rgba(110,226,255,0)"); gradient.addColorStop(.7, "rgba(173,240,255,.7)"); gradient.addColorStop(1, "rgba(255,255,255,.95)");
      ctx.strokeStyle = "rgba(21,68,82,.35)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy - 3); ctx.stroke();
      ctx.strokeStyle = gradient; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }
  /** 風よけ: 前のラクダから自分へ、風が割れて流れる線と「風よけ」の札。息が戻っていることを絵で見せる。 */
  function drawDraft() {
    if (phase !== "race" || !race || draftFx < 0.04) return;
    const lane = laneOf("player"), x = playerX(), y = lane.y;
    ctx.save();
    if (!reducedMotion) {
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        // ラクダの背の上を、前から後ろへ弧を描いて抜ける風。
        const k = ((race.t * (1.1 + i * 0.13) + i * 0.37) % 1), bow = 34 + (i % 3) * 16;
        const sx = x + 150 - k * 330, sy = y - 44 * BODY - (i % 4) * 13 - Math.sin(k * Math.PI) * bow * 0.35;
        const len = 46 + (i % 3) * 18;
        const fade = Math.sin(k * Math.PI) * draftFx;
        const g = ctx.createLinearGradient(sx, sy, sx + len, sy);
        g.addColorStop(0, "rgba(190,246,220,0)"); g.addColorStop(1, `rgba(214,255,236,${0.75 * fade})`);
        ctx.strokeStyle = `rgba(24,70,52,${0.28 * fade})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + len / 2, sy - 5, sx + len, sy + 1); ctx.stroke();
        ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.stroke();
      }
    }
    // 札: 自分のラクダの後ろ上。「風よけ 息↑」。
    ctx.globalAlpha = draftFx;
    ctx.translate(x - 96 * BODY, y - 88 * BODY); ctx.scale(Math.min(textScale, 1.35), Math.min(textScale, 1.35));
    const text = "風よけ  息↑";
    ctx.font = `900 15px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 22, h = 24;
    ctx.fillStyle = "rgba(14,52,40,0.86)"; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.strokeStyle = "#9ff0cf"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#e4fff3"; ctx.fillText(text, 0, 1);
    ctx.restore();
  }
  /** 競り合い: 相手との間に火花と「VS」、相手の頭上に「粘る！」。残り時間は細い帯で見せる。 */
  function drawDuel() {
    if (phase !== "race" || !race || !duelFx) return;
    const rival = race.rivals.find(r => r.id === duelFx.who);
    if (!rival) return;
    const mine = laneOf("player"), theirs = laneOf(rival.id);
    const ax = playerX(), bx = screenX(rival);
    const mx = (ax + bx) / 2 + 30, my = (mine.y + theirs.y) / 2 - 62 * BODY;
    const pulse = reducedMotion ? 0.5 : (Math.sin(duelFx.age * 16) + 1) / 2;
    ctx.save();
    if (!reducedMotion) {
      for (let i = 0; i < 6; i++) {
        const a = duelFx.age * 9 + i * 1.05, r = 20 + ((duelFx.age * 60 + i * 13) % 26);
        ctx.strokeStyle = `rgba(255,${190 + (i % 2) * 40},90,${0.85 - r / 60})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 14, my + Math.sin(a) * 10); ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r * 0.7); ctx.stroke();
      }
    }
    ctx.translate(mx, my); ctx.scale(Math.min(textScale, 1.35) * (1 + pulse * 0.08), Math.min(textScale, 1.35) * (1 + pulse * 0.08));
    ctx.font = `900 26px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    ctx.lineWidth = 7; ctx.strokeStyle = "#4a1a04"; ctx.strokeText("VS", 0, 0);
    ctx.fillStyle = "#ffcf5a"; ctx.fillText("VS", 0, 0);
    ctx.restore();
    // 相手の頭上の「粘る！」と、粘りの残り（赤い帯が縮む）。
    const left = clamp((rival.duelUntil - race.t) / 2.4, 0, 1);
    ctx.save();
    ctx.translate(bx - 14 * theirs.scale * BODY, theirs.y - 104 * theirs.scale * BODY + 9); ctx.scale(Math.min(textScale, 1.35), Math.min(textScale, 1.35));
    ctx.font = `900 15px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const text = `${rival.name}が粘る！`, w = ctx.measureText(text).width + 20, h = 24;
    ctx.fillStyle = "rgba(74,16,10,0.88)"; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.fillStyle = "#ff8a6a"; ctx.fillRect(-w / 2 + 3, h / 2 - 4, (w - 6) * left, 2);
    ctx.fillStyle = "#ffe2d6"; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  /** 火花・波紋・「抜いた」の文字・スパートの色。 */
  function drawEffects() {
    ctx.save();
    for (const w of waves) {
      const k = 1 - w.age / w.life;
      ctx.strokeStyle = `rgba(${w.color.join(",")},${k * 0.9})`; ctx.lineWidth = w.width * k + 1;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of sparks) {
      const k = 1 - p.age / p.life;
      ctx.fillStyle = p.smoke ? `rgba(${p.color.join(",")},${k * 0.45})` : `rgba(${p.color.join(",")},${k})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.smoke ? p.r * (1.5 - k) * 2 : p.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    const lane = laneOf("player");
    for (const f of floaters) {
      const k = f.age / f.life, up = f.kind === "up";
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.font = `900 ${Math.round(30 * textScale)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const duel = f.kind === "duel";
      const y = lane.y - (duel ? 196 : 96) - k * 40, fx = playerX() + (duel ? 40 : 150);
      ctx.lineJoin = "round";
      ctx.lineWidth = 7; ctx.strokeStyle = duel ? "#4a1a04" : up ? "#0c3a18" : "#4a0c0c"; ctx.strokeText(f.text, fx, y);
      ctx.fillStyle = duel ? "#ffcf5a" : up ? "#9dffb4" : "#ff9a9a"; ctx.fillText(f.text, fx, y);
    }
    ctx.globalAlpha = 1;
    if (spurtTint > 0 || (race && inSpurt(race) && phase === "race")) {
      // スパート区間は画面の縁を赤みの夕日色に。入った瞬間は強く。
      const strength = 0.24 + spurtTint * 0.28;
      const edge = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
      edge.addColorStop(0, "rgba(255,120,40,0)"); edge.addColorStop(1, `rgba(255,96,32,${strength})`);
      ctx.fillStyle = edge; ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
  }
  function drawConfetti() {
    for (const piece of confetti) {
      ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.rot); ctx.fillStyle = `hsl(${piece.hue} 85% 65%)`; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
  }
  const chips = new Map();
  /** 順位表の4枚の札を作る（以後は並び順だけ変えて、入れ替わりを滑らせる）。 */
  function buildStandings() {
    chips.clear();
    standingsNode.replaceChildren(...[race.player, ...race.rivals].map(camel => {
      const chip = el("li", { dataset: { who: camel.id, test: camel.id === "player" ? "camel-standing-player" : null }, style: { "--camel-color": camel.color } }, [
        el("b.camel-rank-badge"), el("span.camel-chip-name", { text: camel.id === "player" ? `★ ${camel.name}` : camel.name }), el("small.camel-chip-gap")]);
      chips.set(camel.id, chip);
      return chip;
    }));
  }
  function renderStandings() {
    const rows = standings(race);
    const leader = rows[0];
    for (const row of rows) {
      const chip = chips.get(row.id);
      if (!chip) continue;
      const before = Number(chip.dataset.pos || 0);
      chip.style.setProperty("--pos", String(row.position - 1));
      chip.dataset.pos = String(row.position);
      chip.querySelector(".camel-rank-badge").textContent = String(row.position);
      chip.querySelector(".camel-chip-gap").textContent = row.finishedAt !== null ? "GOAL"
        : row.position === 1 ? "TOP" : `↓${Math.max(0, Math.round(leader.distance - row.distance))}m`;
      if (before && before !== row.position) {
        chip.dataset.move = row.position < before ? "up" : "down";
        clearTimeout(chip.moveTimer);
        chip.moveTimer = setTimeout(() => { delete chip.dataset.move; }, 900);
      }
    }
  }
  const hudCache = {};
  const setOnce = (key, value, apply) => { if (hudCache[key] !== value) { hudCache[key] = value; apply(value); } };
  /** HUD を今のレースに合わせる（変わった所だけ書き換える）。 */
  function updateHud(force = false) {
    if (!race) return;
    if (force) for (const key of Object.keys(hudCache)) delete hudCache[key];
    for (const camel of [race.player, ...race.rivals]) {
      setOnce(`dot-${camel.id}`, Math.round(clamp(camel.distance / race.length, 0, 1) * 1000) / 1000, x => dots.get(camel.id)?.style.setProperty("--x", String(x)));
    }
    setOnce("time", fmtTime(race.t), text => { clockTime.textContent = text; });
    const lit = Math.round(race.player.rhythm * 5);
    setOnce("rhythm", lit, n => rhythmBars.forEach((bar, i) => bar.classList.toggle("on", i < n)));
    const stamina = Math.round(race.player.stamina);
    setOnce("stamina", stamina, v => { staminaValue.textContent = String(v); staminaFill.style.setProperty("--v", String(v / 100)); });
    const locked = !whipReady(race);
    const readout = camelStaminaReadout(race);
    setOnce("staminaState", readout.state, state => {
      staminaNode.dataset.state = state; signalButton.dataset.stamina = state; pacingNode.dataset.state = state;
      if (phase === "race" && ["low", "tired", "spent"].includes(state)) {
        announce(readout.message);
        if (race.t - lastStaminaNotice >= 6) { sfx("miss"); lastStaminaNotice = race.t; }
      }
    });
    setOnce("pacing", readout.message, text => { pacingText.textContent = text; });
    setOnce("reserve", readout.reserveText, text => { reserveText.textContent = text; });
    boostLabel.hidden = phase !== "race" || !readout.accelerating;
    const spurt = inSpurt(race);
    const state = locked ? "spent" : race.player.whipping ? "whipping" : spurt ? "spurt" : "ready";
    setOnce("signal", state, value => { signalButton.dataset.state = value; });
    // 空になった後は、使えるようになるまでの戻り具合を暗く満たす。
    setOnce("cool", locked ? Math.round((1 - clamp(race.player.stamina / WHIP.resume, 0, 1)) * 50) / 50 : 0, v => signalButton.style.setProperty("--cool", String(v)));
    // ムチの横の小さな字: 押している間・スパート・息切れ。
    setOnce("signalNote", state === "spent" ? "息を整え中" : state === "whipping" ? `−${Math.round(whipDrain(race))}/秒`
      : race.player.duel ? "抜き切れ！" : spurt ? "スパート！" : race.player.drafting ? "風よけ中" : "押している間", text => { signalCost.textContent = text; });
    // 速度計（m/s × 3.6）。ムチの間は赤、一伸びの間は金。
    const kmh = Math.round(race.player.speed * 3.6);
    setOnce("speed", kmh, v => { speedValue.textContent = String(v); speedFill.style.setProperty("--v", String(clamp((v - 50) / 40, 0, 1))); });
    setOnce("speedState", race.player.whipping ? "whip" : race.player.surge > 0.6 ? "surge" : "cruise", v => { speedNode.dataset.state = v; });
    setOnce("cue", phase === "race" && activeCue(race) ? "on" : "off", v => { voiceButton.dataset.cue = v; });
    // 判定の文字（PERFECT 等）は、輪のすぐ上に出す。カメラの寄せで自分のラクダが動くので毎回合わせる。
    const at = cuePoint();
    setOnce("feedbackX", Math.round(at.x / W * 1000) / 10, v => feedback.style.setProperty("left", `${v}%`));
    setOnce("feedbackY", Math.round((at.y - 104) / H * 1000) / 10, v => feedback.style.setProperty("top", `${v}%`));
    setOnce("draft", phase === "race" && race.player.drafting ? "on" : "off", v => { staminaNode.dataset.draft = v; signalButton.dataset.draft = v; });
    setOnce("duel", phase === "race" && race.player.duel ? "on" : "off", v => { voiceButton.dataset.duel = v; signalButton.dataset.duel = v; root.dataset.duel = v; });
  }
  function openResult() {
    const score = scoreRace(race);
    const run = { ...score, seed: race.seed };
    runs.push(run);
    setPhase("result");
    const previousBest = Math.max(best?.total ?? -1, ...runs.slice(0, -1).map(item => item.total));
    const isBest = score.total > previousBest;
    announce(`${score.rank}位でゴール。スコア${score.total}、評価${score.grade}。`);
    const resultMargins = margins || finishMargins(race);
    const resultEdge = score.rank === 1 ? resultMargins?.behind : resultMargins?.ahead;
    const bar = (label, value, max) => el("div.camel-score-row", [
      el("span", { text: label }), el("div.camel-score-bar", [el("i", { style: { width: `${(value / max) * 100}%` } })]),
      el("b", { text: `${value}／${max}` })]);
    // 点数は0から数え上げ、評価の判子を押す（動きを減らす設定ではすぐ出す）。
    const totalNode = el("strong", { text: String(score.total) });
    if (!reducedMotion) {
      const started = performance.now(), shownRun = runs.length;
      totalNode.textContent = "0";
      const count = now => {
        if (done || runs.length !== shownRun || phase !== "result") return;
        const k = Math.min(1, (now - started - 300) / 900);
        totalNode.textContent = String(Math.round(Math.max(0, k) ** 0.6 * score.total));
        if (k < 1) requestAnimationFrame(count);
      };
      requestAnimationFrame(count);
      setTimeout(() => { if (!done && runs.length === shownRun && phase === "result") sfx("stamp"); }, 1050);
    }
    if (run.cup === "rookie" && camelCupQualified(run)) unlocked.add("standard");
    if (camelMastered(run)) unlocked.add("expert");
    const again = el("button.btn.primary", { type: "button", text: "もう一度", dataset: { test: "camel-retry" }, onclick: () => { sfx("select"); startRace(); } });
    const choose = el("button.btn", { type: "button", text: "大会を選ぶ", dataset: { test: "camel-choose-cup" }, onclick: () => { sfx("click"); openCups(); } });
    const leave = el("button.btn", { type: "button", text: "終える", dataset: { test: "camel-finish" }, onclick: () => { sfx("click"); cleanup(true); } });
    const card = el("div.camel-card.camel-result", { dataset: { test: "camel-result", rank: String(score.rank), grade: score.grade, total: String(score.total) } }, [
      el("p.camel-eyebrow", { text: `${camelCup(run.cup).name} / RESULT` }),
      el("div.camel-result-head", [
        el("div.camel-medal", { dataset: { rank: String(score.rank) } }, [el("strong", { text: String(score.rank) }), el("span", { text: "位" })]),
        el("div.camel-result-score", [
          el("p.camel-time", { text: `TIME ${fmtTime(score.time)}${resultEdge ? `  ・  ${resultEdge.name}と ${resultEdge.seconds.toFixed(2)}秒差` : ""}`, dataset: { test: "camel-result-time" } }),
          el("p.camel-total", [el("small", { text: "SCORE" }), totalNode, el("small", { text: "/ 100" })]),
        ]),
        el("div.camel-grade-letter", { dataset: { grade: score.grade } }, [el("small", { text: "評価" }), el("strong", { text: score.grade })]),
      ]),
      bar("順位", score.parts.rank, 40), bar("声かけ", score.parts.timing, 35), bar("スタミナ", score.parts.stamina, 25),
      el("ul.camel-stats", [["PERFECT", score.stats.perfect], ["GOOD", score.stats.good], ["見送り", score.stats.lost],
        ["無駄な声", score.stats.spam ? `${score.stats.miss}（連打${score.stats.spam}）` : score.stats.miss], ["競り合い", `${score.stats.duelsWon}勝／${score.stats.duels}回`], ["ムチ", `${score.stats.whipTime}秒（スパート${score.stats.spurtWhip}秒）`]]
        .map(([label, value]) => el("li", [el("small", { text: label }), el("b", { text: String(value) })]))),
      isBest && (best !== null || runs.length > 1) ? el("p.camel-best", { text: "自己ベスト更新！", dataset: { test: "camel-new-best" } }) : null,
      camelMastered(run) ? el("p.camel-best", { text: "中級認定！ 連打に頼らず、声と息を合わせた走り。追加の火種は初回のみ夜に精算。" })
        : camelExpert(run) ? el("p.camel-best", { text: "称号獲得：砂漠の名調教師" }) : null,
      el("div.camel-card-actions", allowRetry ? [again, choose, leave] : [leave]),
    ]);
    // 「？」で遊び方を読んだあとは、同じ結果のカードへ戻す（採点・記録はやり直さない）。
    const showResult = () => {
      setPhase("result");
      sheet.replaceChildren(card);
      sheet.hidden = false;
      // 低い画面ではカードが内側スクロールになる。素の focus() だとボタンへ勝手にスクロールして
      // メダルや見出しが上に切れるので、スクロールさせずに頭から見せる。
      (allowRetry ? again : leave).focus({ preventScroll: true });
    };
    card.append(helpButton(() => { totalNode.textContent = String(score.total); showResult(); }));
    showResult();
  }

  // ---- 開始 -----------------------------------------------------------------------------------------
  draw();
  if (tutorial) openTutorial(0); else if (cups) openCups(); else startRace();
  return promise;
}

/** 色を少し暗く／明るくする（#rrggbb）。 */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => clamp(v + amount, 0, 255);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

export { PLAYER_CAMEL, RIVAL_PROFILES };


