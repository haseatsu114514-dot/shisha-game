"use strict";
// 通りの試作（本編未接続）。エリアマップ → 繁華街の通りを8方向で歩く → 店に入る／しらべる／話す／ファストトラベル。
// 歩行（移動・向きの量子化・2コマ歩行・左右反転・足元yソート・タップ移動）は web/proto/walk/index.html と同じ挙動。
(() => {
  // ---------------------------------------------------------------- 定数
  const STAGE_W = 1280, STAGE_H = 720;                   // 画面（キャンバス）の大きさ
  // 内部解像度と「1ドットの大きさ」はステージJSONの view / unit で決まる（applyProfile）。
  //   標準: 320×180 を4倍・unit 1 ／ 高解像度2.5D（stage_hankagai_hd.json）: 640×360 を2倍・unit 1.5
  let VIEW_W = 320, VIEW_H = 180, SCALE = 4;
  let U = 1;                                             // 標準版を1とした、長さ・速さの倍率
  const ROOT = "../../../";
  let STREET_DIR = ROOT + "assets/proto_street/";
  const WALK_DIR = ROOT + "assets/proto_walk/";
  let CHAR_SIZE = 32;                                    // 歩行シートの高さ（tsumugi_walk_32 など）
  const SAVE_KEY = "shisha_proto_street_v1";
  const SHEET_DIRS = ["down", "down_right", "right", "up_right", "up"]; // 歩行シートの列順
  const DIR8 = ["right", "down_right", "down", "down_left", "left", "up_left", "up", "up_right"]; // atan2順（y下向き）
  const MIRROR = { down_left: "down_right", left: "right", up_left: "up_right" };
  const R2 = Math.SQRT1_2;
  const DIR_VEC = {
    right: [1, 0], down_right: [R2, R2], down: [0, 1], down_left: [-R2, R2],
    left: [-1, 0], up_left: [-R2, -R2], up: [0, -1], up_right: [R2, -R2],
  };
  // 以下の長さ・速さは標準版のドット単位。applyProfile で unit 倍する
  const BASE = {
    speed: 80,          // 歩く速さ（ドット/秒。AA7: 64→80）
    runTapDist: 72,     // これより遠くをタップしたら走って向かう（AA8）
    footHalfW: 5,       // 足元の当たり判定（約10×4）
    footH: 4,
    reach: 20,          // 決定できる距離（足元から）
    camLead: 32,        // カメラの先読み
  };
  let SPEED, RUN_TAP_DIST, FOOT_HALF_W, FOOT_H, REACH, CAM_LEAD;
  const DASH_MULT = 1.75, ANIM_SEC = 0.16;               // ダッシュ倍率・1コマの長さ
  const DUST_EVERY = 0.09;                               // 走っている間に足元へ砂ぼこりを出す間隔（秒）
  const TYPE_MS = 30;                                    // 1文字の表示間隔
  const FADE_MS = 260;
  const BACKDROP_PARALLAX = 0.5;                         // 遠景の視差（ステージの far.parallax で上書き）
  const params = new URLSearchParams(location.search);
  const NIGHT = params.get("night") === "1";
  const HD = params.get("stage") === "hd";               // 高解像度2.5D版（AA9）
  const STAGE_FILE = HD ? "stage_hankagai_hd.json" : "stage_hankagai.json";
  const BUST = `?t=${Date.now()}`;
  const S = (v) => Math.round(v * U);                    // 標準版のドット数 → 今のステージのドット数

  function applyProfile(st) {
    const v = st.view || {};
    VIEW_W = v.w || 320;
    VIEW_H = v.h || 180;
    SCALE = v.scale || 4;
    U = st.unit || 1;
    STREET_DIR = ROOT + (st.assets || "assets/proto_street/");
    CHAR_SIZE = st.charSize || 32;
    SPEED = BASE.speed * U;
    RUN_TAP_DIST = BASE.runTapDist * U;
    FOOT_HALF_W = S(BASE.footHalfW);
    FOOT_H = S(BASE.footH);
    REACH = BASE.reach * U;
    CAM_LEAD = BASE.camLead * U;
  }
  // 標準版のドット単位で描く小物（柵・道しるべ・「！」・砂ぼこりなど）を、今のステージの大きさに拡大して描く
  function withUnit(x, y, draw) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(U, U);
    draw();
    ctx.restore();
  }

  // エリアマップのピン（%）。歩けるのは繁華街だけ
  const AREAS = [
    { id: "hankagai", label: "繁華街", x: 58, y: 36, open: true },
    { id: "tonari", label: "tonari", x: 86, y: 36 },
    { id: "tonya", label: "問屋街", x: 34, y: 24 },
    { id: "shitamachi", label: "下町", x: 44, y: 62 },
    { id: "furumachi", label: "古町", x: 17, y: 56 },
    { id: "home", label: "自宅", x: 88, y: 62 },
  ];

  const $ = (s) => document.querySelector(s);
  const canvas = $("#view");
  const ctx = canvas.getContext("2d");

  // ---------------------------------------------------------------- 訪問記録（このブラウザだけ）
  const save = (() => {
    const blank = { visited: {} };
    try {
      if (params.get("reset") === "1") localStorage.removeItem(SAVE_KEY);
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { ...blank, ...data, visited: { ...(data && data.visited) } };
      }
    } catch (e) { /* 読めない環境では毎回まっさら */ }
    return blank;
  })();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できなくても動く */ }
  }

  // ---------------------------------------------------------------- 小道具
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function makeCanvas(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    return cv;
  }
  async function loadJSON(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }
  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  // 不透明部分の外側1ドットに輪郭を付ける（仮素材用）
  function outline(cv, color = "#241a2a") {
    const g = cv.getContext("2d");
    const { width: w, height: h } = cv;
    const src = g.getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
    g.fillStyle = color;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }
  // 夜用: 暖色で明るい画素（窓の灯り・ランプ）だけを抜き出す
  function makeGlow(art) {
    const cv = makeCanvas(art.width, art.height);
    const g = cv.getContext("2d");
    g.drawImage(art, 0, 0);
    let data;
    try { data = g.getImageData(0, 0, cv.width, cv.height); } catch (e) { return null; } // file:// 等で読めない時は灯り無し
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      const warm = r > 150 && r > b + 45 && (r + gg + b) / 3 > 125;
      if (!warm) p[i + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    return cv;
  }

  // ---------------------------------------------------------------- 仮素材（画像が無い時の代役）
  const FACADE_PH = {
    cafe: { wall: "#8b6446", roof: "#3c3632", accent: "#d9702a" },
    peppermint: { wall: "#eab0c4", roof: "#5f8f7c", accent: "#9fd9c2" },
    kemurikusa: { wall: "#cdbb94", roof: "#2f2a2e", accent: "#3a2c26" },
    filler_a: { wall: "#7c6146", roof: "#2f2a2e", accent: "#4f7a4a" },
    filler_b: { wall: "#8a8178", roof: "#2f2a2e", accent: "#6f6a64" },
    filler_c: { wall: "#6b5038", roof: "#2f2a2e", accent: "#2e3c66" },
  };
  function facadeGeo(id, img) {
    const m = assets.meta && assets.meta.facades && assets.meta.facades[id];
    if (m) return m;
    const w = img ? img.width : S(96), h = img ? img.height : S(100);
    return { w, h, door: [Math.round(w * 0.68), h - S(38), S(16), S(36)], sign: [Math.round(w * 0.16), Math.round(h * 0.4), Math.round(w * 0.56), S(12)] };
  }
  function makeFacadePlaceholder(id, geo) {
    const c = FACADE_PH[id] || FACADE_PH.filler_b;
    const cv = makeCanvas(geo.w, geo.h);
    const g = cv.getContext("2d");
    const roofH = Math.round(geo.h * 0.14);
    g.fillStyle = c.roof;
    g.fillRect(4, 0, geo.w - 8, roofH);
    g.fillRect(0, roofH - 3, geo.w, 3);
    g.fillStyle = c.wall;
    g.fillRect(3, roofH, geo.w - 6, geo.h - roofH);
    g.fillStyle = "#e9b85c";                                // 2階の窓
    g.fillRect(Math.round(geo.w * 0.15), roofH + 6, Math.round(geo.w * 0.28), 12);
    g.fillRect(Math.round(geo.w * 0.57), roofH + 6, Math.round(geo.w * 0.28), 12);
    const [sx, sy, sw, sh] = geo.sign;
    g.fillStyle = "#5a3b22";
    g.fillRect(sx, sy, sw, sh);
    g.fillStyle = c.accent;                                 // 日除け
    g.fillRect(3, sy + sh + 2, geo.w - 6, 5);
    const [dx, dy, dw, dh] = geo.door;
    g.fillStyle = "#d9a35a";                                // 1階のショーウィンドウ
    g.fillRect(8, dy + 4, Math.max(8, dx - 14), dh - 12);
    g.fillStyle = "#3b2516";                                // ドア
    g.fillRect(dx, dy, dw, dh);
    g.fillStyle = "#e9b85c";
    g.fillRect(dx + 3, dy + 4, dw - 6, Math.round(dh * 0.35));
    return outline(cv);
  }
  const PROP_PH_SIZE = { vending: [23, 34], bench: [23, 16], aboard: [16, 19], plant: [16, 18], lamp: [13, 56], bicycle: [29, 19] };
  function makePropPlaceholder(name) {
    const m = assets.meta && assets.meta.props && assets.meta.props[name];
    const [w, h] = m ? [m.w, m.h] : (PROP_PH_SIZE[name] || [16, 16]).map(S);
    const cv = makeCanvas(w, h);
    const g = cv.getContext("2d");
    const box = (x, y, bw, bh, col) => { g.fillStyle = col; g.fillRect(x, y, bw, bh); };
    switch (name) {
      case "vending":
        box(1, 0, w - 2, h - 1, "#e8e2d2");
        box(3, 3, w - 6, Math.round(h * 0.5), "#f4cf6a");
        for (let i = 0; i < 4; i++) box(4 + i * 4, 5, 2, 4, ["#5fb34f", "#e04b3f", "#3f7fd6", "#f09a2a"][i]);
        box(4, h - 8, w - 8, 3, "#3a3a3a");
        break;
      case "bench":
        box(1, 2, w - 2, 3, "#a8642c");
        box(1, 7, w - 2, 3, "#b8743a");
        box(2, 10, 2, h - 10, "#3a3430");
        box(w - 4, 10, 2, h - 10, "#3a3430");
        break;
      case "aboard":
        box(2, 0, w - 4, h - 3, "#b57a3c");
        box(4, 2, w - 8, h - 7, "#2f3a33");
        box(2, h - 3, 2, 3, "#b57a3c");
        box(w - 4, h - 3, 2, 3, "#b57a3c");
        break;
      case "plant":
        box(2, 0, w - 4, h - 7, "#4e9a3a");
        box(4, 2, w - 8, h - 10, "#79c24f");
        box(4, h - 7, w - 8, 7, "#c4683a");
        break;
      case "lamp":
        box(Math.floor(w / 2) - 1, 10, 3, h - 10, "#4a3e30");
        box(2, 1, w - 4, 9, "#f3c45a");
        box(1, 0, w - 2, 2, "#4a3e30");
        box(Math.floor(w / 2) - 3, h - 3, 7, 3, "#4a3e30");
        break;
      case "bicycle":
        g.strokeStyle = "#2c2c2c";
        g.lineWidth = 2;
        g.beginPath(); g.arc(6, h - 7, 5, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(w - 7, h - 7, 5, 0, Math.PI * 2); g.stroke();
        box(6, h - 12, w - 13, 2, "#6fae3a");
        box(w - 9, 2, 6, 4, "#b58a5a");
        break;
      default:
        box(0, 0, w, h, "#888");
    }
    return outline(cv);
  }
  // キャラ: 色付きのカプセル（向きは目の位置、歩きは足の上下で分かる）
  function makeCapsuleSheet(col) {
    const cw = 24, ch = 36;
    const cv = makeCanvas(cw * SHEET_DIRS.length, ch * 2);
    const g = cv.getContext("2d");
    SHEET_DIRS.forEach((dir, c) => {
      const [dx, dy] = DIR_VEC[dir];
      for (let f = 0; f < 2; f++) {
        const ox = c * cw, oy = f * ch;
        const box = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(ox + x, oy + y, w, h); };
        box(8, 28 - (f === 1 ? 1 : 0), 3, 6 + (f === 1 ? 1 : 0), col.leg);       // 足（コマごとに片方を上げる）
        box(13, 28 - (f === 0 ? 1 : 0), 3, 6 + (f === 0 ? 1 : 0), col.leg);
        box(7, 15, 10, 14, col.body);                                              // 胴
        box(8, 14, 8, 1, col.body);
        for (let y = 0; y < 12; y++) {                                             // 頭
          const half = Math.round(Math.sqrt(36 - (y - 5.5) * (y - 5.5)));
          box(12 - half, 3 + y, half * 2, 1, y < 4 || dy < -0.5 ? col.hair : col.skin);
        }
        if (dy > -0.5) {                                                           // 目
          const ex = Math.round(dx * 3);
          if (Math.abs(dx) > 0.9) box(12 + ex, 9, 1, 2, "#241a2a");
          else { box(9 + ex, 9, 1, 2, "#241a2a"); box(14 + ex, 9, 1, 2, "#241a2a"); }
        }
      }
    });
    return { img: outline(cv), cell: [cw, ch], anchor: [12, ch - 2], source: "placeholder" };
  }
  const CAPSULE = {
    tsumugi: { body: "#4a2d63", hair: "#5e3b28", skin: "#f6cfb4", leg: "#1c1c24" },
    mob_obasan: { body: "#c8a97e", hair: "#6a4a32", skin: "#f1c9a8", leg: "#2b3150" },
    mob_student: { body: "#3f6b66", hair: "#33405f", skin: "#f1c9a8", leg: "#3a4a78" },
  };
  function makeGroundPlaceholder(meta) {
    const cv = makeCanvas(meta.w, meta.h);
    const g = cv.getContext("2d");
    const rnd = mulberry32(912);
    const [s0, s1] = meta.sidewalk, [c0, c1] = meta.curb, [r0, r1] = meta.road;
    for (let y = s0; y < s1; y += 9) {
      for (let x = 0; x < meta.w; x += 10) {
        const k = 128 + Math.floor(rnd() * 22);
        g.fillStyle = y === s0 + 18 ? "#d0a034" : `rgb(${k},${k - 4},${k - 10})`;
        g.fillRect(x, y, 10, Math.min(9, s1 - y));
        g.fillStyle = "rgba(40,36,32,0.45)";
        g.fillRect(x, y, 10, 1);
        g.fillRect(x, y, 1, Math.min(9, s1 - y));
      }
    }
    g.fillStyle = "#a9a49c";
    g.fillRect(0, c0, meta.w, c1 - c0);
    g.fillStyle = "#6f6a64";
    g.fillRect(0, c1 - 1, meta.w, 1);
    g.fillStyle = "#3a393c";
    g.fillRect(0, r0, meta.w, r1 - r0);
    g.fillStyle = "#c9c6bd";
    for (let x = 2; x < meta.w; x += 20) g.fillRect(x, r0 + Math.round((r1 - r0) * 0.48), 10, 2);
    return cv;
  }
  // 地面の画像も street_assets.json も無い時の帯の割り付け（地面の上端から画面の下まで）
  function groundDefault() {
    const h = VIEW_H - stage.groundTop;
    const s1 = Math.round(h * 0.56), c1 = s1 + Math.max(2, Math.round(h * 0.06));
    return { w: S(200), h, sidewalk: [0, s1], curb: [s1, c1], road: [c1, h] };
  }

  // 奥の街並み（建物の隙間から見える空と遠景。コード描画・視差で少し遅れて動く）
  function makeBackdrop(width, height) {
    const cv = makeCanvas(width, height);
    const g = cv.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, height);
    if (NIGHT) { sky.addColorStop(0, "#0b1030"); sky.addColorStop(1, "#2b2350"); }
    else { sky.addColorStop(0, "#9cc6ea"); sky.addColorStop(1, "#f1dcc0"); }
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    const rnd = mulberry32(20261003);
    for (let layer = 0; layer < 2; layer++) {
      let x = -10;
      while (x < width) {
        const w = 18 + Math.floor(rnd() * 26);
        const h = (layer === 0 ? 60 : 36) + Math.floor(rnd() * (layer === 0 ? 40 : 30));
        const top = height - h;
        g.fillStyle = NIGHT ? (layer === 0 ? "#1b1d36" : "#252845") : (layer === 0 ? "#9aa1b3" : "#848c9e");
        g.fillRect(x, top, w - 2, h);
        for (let wy = top + 4; wy < height - 6; wy += 6) {
          for (let wx = x + 3; wx < x + w - 5; wx += 5) {
            const lit = NIGHT ? rnd() < 0.35 : rnd() < 0.12;
            g.fillStyle = NIGHT ? (lit ? "#f2c76b" : "#2c2f4c") : (lit ? "#e9eef6" : (layer === 0 ? "#868d9f" : "#747c8e"));
            g.fillRect(wx, wy, 2, 3);
          }
        }
        x += w + Math.floor(rnd() * 6);
      }
    }
    return cv;
  }
  function drawWall(w) {
    // コンクリートブロック塀（商店街の外れ・空き地の前）。模様は標準版のドット単位で描いて拡大する
    const top = stage.groundTop - w.h;
    withUnit(w.x0, top, () => {
      const ww = (w.x1 - w.x0) / U, wh = w.h / U;
      ctx.fillStyle = "#9d988f";
      ctx.fillRect(0, 0, ww, wh);
      ctx.fillStyle = "#857f76";
      for (let y = 2; y < wh; y += 5) {
        ctx.fillRect(0, y, ww, 1);
        const off = ((y - 2) / 5) % 2 ? 6 : 0;
        for (let x = off; x < ww; x += 12) ctx.fillRect(x, y, 1, Math.min(5, wh - y));
      }
      ctx.fillStyle = "#b8b3aa";
      ctx.fillRect(0, 0, ww, 2);
      ctx.fillStyle = "#5f5a53";
      ctx.fillRect(0, 2, ww, 1);
    });
  }

  // ---------------------------------------------------------------- 世界
  let stage = null;
  const assets = { meta: null, facades: {}, props: {}, glows: {}, blooms: {}, ground: null, backdrop: null, poleTile: null, farSource: "code", sheets: {}, missing: [] };
  let facades = [], doors = [], objects = [], npcs = [];
  const player = { x: 0, y: 0, dir: "down", frame: 0, animT: 0, moving: false, target: null, pending: null, tapRun: false, running: false, dustT: 0 };
  const dust = [];                 // 走った時の砂ぼこり { x, y, t }
  const cam = { x: 0, lead: 0 };     // lead: 歩く向きの先を少し多めに見せる（横スクロールの先読み）
  const keys = { up: false, down: false, left: false, right: false, dash: false };
  let mode = "loading";            // loading / map / walk / menu / interior
  let busy = false;                // 暗転中は入力を受けない
  let focus = null;                // いま決定できる相手
  let pointerHeld = false;
  let currentDoor = null;
  const rnd = mulberry32(1003);

  async function init() {
    stage = await loadJSON(STAGE_FILE + BUST);
    if (stage && stage.extends) {
      // 高解像度版は標準版のステージを土台にして、配置と大きさだけ上書きする（テキストは標準版の1か所だけ）
      const base = await loadJSON(stage.extends + BUST);
      stage = base ? mergeStage(base, stage) : null;
    }
    if (!stage) {
      showFatal(`${STAGE_FILE} を読めませんでした。リポジトリのルートで python3 -m http.server 8123 を起動して開いてください。`);
      return;
    }
    applyProfile(stage);
    assets.meta = await loadJSON(STREET_DIR + "street_assets.json" + BUST);
    if (!assets.meta) assets.missing.push("street_assets.json");

    const facadeIds = [...new Set(stage.facades.map((f) => f.id))];
    const propNames = [...new Set(stage.objects.map((o) => o.img))];
    const [facadeImgs, propImgs, groundImg] = await Promise.all([
      Promise.all(facadeIds.map((id) => loadImage(`${STREET_DIR}facade_${id}.png${BUST}`))),
      Promise.all(propNames.map((n) => loadImage(`${STREET_DIR}prop_${n}.png${BUST}`))),
      loadImage(`${STREET_DIR}ground.png${BUST}`),
    ]);
    facadeIds.forEach((id, i) => {
      const img = facadeImgs[i];
      if (!img) assets.missing.push(`facade_${id}.png`);
      const geo = facadeGeo(id, img);
      assets.facades[id] = { art: img || makeFacadePlaceholder(id, geo), geo };
      if (NIGHT) assets.glows[id] = makeGlow(assets.facades[id].art);
      if (NIGHT && stage.bloom) assets.blooms[id] = makeBloom(assets.glows[id], stage.bloom);
    });
    propNames.forEach((n, i) => {
      if (!propImgs[i]) assets.missing.push(`prop_${n}.png`);
      assets.props[n] = propImgs[i] || makePropPlaceholder(n);
      if (NIGHT && n === "lamp") {
        assets.glows.prop_lamp = makeGlow(assets.props[n]);
        if (stage.bloom) assets.blooms.prop_lamp = makeBloom(assets.glows.prop_lamp, stage.bloom);
      }
    });
    const groundMeta = (assets.meta && assets.meta.ground) || groundDefault();
    if (!groundImg) assets.missing.push("ground.png");
    assets.ground = groundImg || makeGroundPlaceholder(groundMeta);
    // 遠景: far.img（夜は far.imgNight）があれば使う。無ければコード描画の街並み（標準版の大きさで描いて拡大）
    const farCfg = stage.far || {};
    const farW = Math.ceil(stage.width * (farCfg.parallax || BACKDROP_PARALLAX)) + VIEW_W + 4;
    const farName = NIGHT ? (farCfg.imgNight || farCfg.img) : farCfg.img;
    const farImg = farName ? await loadImage(`${STREET_DIR}${farName}${BUST}`) : null;
    assets.farSource = farImg ? "image" : "code";
    const farSrc = farImg || makeBackdrop(Math.ceil(farW / U), Math.ceil(stage.groundTop / U));
    assets.backdrop = (farImg || U !== 1 || farCfg.blur || farCfg.haze)
      ? makeFarLayer(farSrc, farW, stage.groundTop, farCfg)
      : farSrc;
    if (stage.foreground) {
      const fgImg = stage.foreground.img ? await loadImage(`${STREET_DIR}${stage.foreground.img}${BUST}`) : null;
      assets.poleTile = makePoleTile(stage.foreground, fgImg);
      assets.fgSource = fgImg ? "image" : "code";
    }

    const sheetSpecs = [["tsumugi", WALK_DIR, "tsumugi_walk"], ...stage.npcs.map((n) => [n.sheet, STREET_DIR, n.sheet])];
    await Promise.all(sheetSpecs.map(async ([key, dir, file]) => {
      assets.sheets[key] = await loadSheet(dir, file, CAPSULE[key] || CAPSULE.mob_obasan);
    }));

    facades = stage.facades.map((f) => ({ ...f, ...assets.facades[f.id] }));
    const facadeById = Object.fromEntries(facades.map((f) => [f.id, f]));
    doors = stage.doors.map((d) => {
      const f = facadeById[d.facade];
      const [dx, dy, dw, dh] = f.geo.door;
      const top = stage.groundTop - f.geo.h + dy;
      return { ...d, x: f.x + dx, w: dw, top, h: dh, cx: f.x + dx + dw / 2 };
    });
    objects = stage.objects.map((o) => ({ ...o, art: assets.props[o.img] }));
    npcs = stage.npcs.map((n) => ({
      ...n, homeDir: n.dir, heading: n.dir === "left" ? -1 : 1, frame: 0, animT: 0, moving: false,
      talking: false, talked: 0, pauseUntil: 0, nextPause: 3 + rnd() * 4, waitT: 0, restoreAt: 0,
    }));

    $("#hud-ph").classList.toggle("hidden", assets.missing.length === 0);
    $("#hud-ph").title = assets.missing.join(", ");
    $("#hud-name").textContent = stage.name;
    buildPins();
    if (params.get("area") === stage.id) enterStreet(true);
    else showAreaMap(true);
  }

  function mergeStage(base, over) {
    const out = { ...base, ...over };
    for (const key of ["facades", "doors", "objects", "npcs"]) {
      if (!over[key]) continue;
      const byId = Object.fromEntries((base[key] || []).map((x) => [x.id, x]));
      out[key] = over[key].map((x) => ({ ...(byId[x.id] || {}), ...x }));
    }
    for (const key of ["exit", "barricade", "spawn"]) if (base[key] && over[key]) out[key] = { ...base[key], ...over[key] };
    delete out.extends;
    return out;
  }

  async function loadSheet(dir, name, colors) {
    const img = await loadImage(`${dir}${name}_${CHAR_SIZE}.png${BUST}`);
    if (!img) {
      assets.missing.push(`${name}_${CHAR_SIZE}.png`);
      return makeCapsuleSheet(colors);
    }
    const meta = await loadJSON(`${dir}${name}_${CHAR_SIZE}.json${BUST}`);
    const cell = (meta && meta.cell) || [Math.floor(img.width / SHEET_DIRS.length), Math.floor(img.height / 2)];
    const anchor = (meta && meta.anchor) || [Math.floor(cell[0] / 2), cell[1] - 2];
    return { img, cell, anchor, source: "image" };
  }

  function showFatal(text) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = "#fff";
    ctx.font = '28px "DotGothic16", sans-serif';
    ctx.fillText(text, 40, 340);
  }

  // ---------------------------------------------------------------- 当たり判定
  function footRect(x, y) {
    return { x0: x - FOOT_HALF_W, x1: x + FOOT_HALF_W, y0: y - FOOT_H, y1: y };
  }
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  function solidRects(except) {
    const list = [];
    for (const o of objects) {
      if (!o.solid) continue;
      const [w, h] = o.solid;
      list.push({ x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h, y1: o.y });
    }
    for (const n of npcs) if (n !== except) list.push(footRect(n.x, n.y));
    return list;
  }
  function blocked(x, y, who) {
    const w = stage.walk;
    if (x - FOOT_HALF_W < w.x0 || x + FOOT_HALF_W > w.x1 || y < w.y0 || y > w.y1) return true;
    const r = footRect(x, y);
    if (who !== player && overlap(r, footRect(player.x, player.y))) return true;
    return solidRects(who).some((s) => overlap(r, s));
  }
  function quantizeDir(vx, vy, fallback) {
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) return fallback;
    const i = ((Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) % 8) + 8) % 8;
    return DIR8[i];
  }
  const clampWalkY = (y) => clamp(y, stage.walk.y0, stage.walk.y1);

  // ---------------------------------------------------------------- 決定対象（入口・しらべる・人）
  function interactables() {
    const list = doors.map((d) => ({ kind: "door", id: d.id, x: d.cx, y: stage.groundTop + S(2), halfW: d.w / 2, ref: d }));
    for (const o of objects) {
      if (!o.text) continue;
      const h = o.solid ? o.solid[1] : 0;
      list.push({ kind: "object", id: o.id, x: o.x, y: o.y - h / 2, halfW: o.solid ? o.solid[0] / 2 : 4, ref: o });
    }
    for (const n of npcs) list.push({ kind: "npc", id: n.id, x: n.x, y: n.y - S(2), halfW: S(4), ref: n });
    if (stage.barricade) {
      list.push({ kind: "barricade", id: "barricade", x: stage.barricade.x - S(6), y: clampWalkY(player.y), halfW: 0, ref: stage.barricade });
    }
    return list;
  }
  function reachOf(it) {
    const nx = clamp(player.x, it.x - it.halfW, it.x + it.halfW);
    const vx = nx - player.x, vy = it.y - player.y;
    return { d: Math.hypot(vx, vy), vx, vy };
  }
  function findFocus() {
    const [fx, fy] = DIR_VEC[player.dir];
    let best = null, bestD = Infinity;
    for (const it of interactables()) {
      const { d, vx, vy } = reachOf(it);
      if (d > REACH) continue;
      if (d > 2 && (fx * vx + fy * vy) / d < 0.3) continue;   // 向いている側にあるものだけ
      if (d < bestD) { best = it; bestD = d; }
    }
    return best;
  }
  function interact(it) {
    if (!it) return;
    if (it.kind === "door") enterShop(it.ref);
    else if (it.kind === "npc") talkTo(it.ref);
    else say(it.ref.text);
  }
  // タップした所にあるもの（人 → 物 → 入口 の順に優先）
  function hitTest(wx, wy) {
    for (const n of npcs) {
      const sh = assets.sheets[n.sheet];
      if (Math.abs(wx - n.x) <= sh.cell[0] / 3 && wy >= n.y - sh.anchor[1] && wy <= n.y + S(2)) return { kind: "npc", id: n.id, ref: n };
    }
    for (const o of objects) {
      if (!o.text) continue;
      const w = o.art.width, h = o.art.height;
      if (wx >= o.x - w / 2 && wx <= o.x + w / 2 && wy >= o.y - h && wy <= o.y + S(2)) return { kind: "object", id: o.id, ref: o };
    }
    for (const d of doors) if (wx >= d.x - S(2) && wx <= d.x + d.w + S(2) && wy >= d.top - S(2) && wy <= stage.groundTop + S(4)) return { kind: "door", id: d.id, ref: d };
    const b = stage.barricade;
    if (b && wx >= b.x - S(10) && wx <= b.x + S(16) && wy >= stage.groundTop - S(8)) return { kind: "barricade", id: "barricade", ref: b };
    return null;
  }
  function approachPoint(hit) {
    const w = stage.walk;
    if (hit.kind === "door") return { x: hit.ref.cx, y: w.y0 + S(3) };
    if (hit.kind === "npc") {
      const n = hit.ref;
      return { x: n.x + (player.x < n.x ? -S(13) : S(13)), y: clampWalkY(n.y) };
    }
    if (hit.kind === "barricade") return { x: hit.ref.x - S(14), y: clampWalkY(player.y) };
    return { x: hit.ref.x, y: clampWalkY(hit.ref.y + S(6)) };
  }
  function arrive() {
    player.target = null;
    const p = player.pending;
    player.pending = null;
    if (!p) return;
    const it = interactables().find((i) => i.kind === p.kind && i.id === p.id);
    if (!it) return;
    const { d, vx, vy } = reachOf(it);
    if (d > REACH + S(6)) return;
    player.dir = quantizeDir(vx, vy, "up");
    interact(it);
  }

  // ---------------------------------------------------------------- 更新
  function update(dt) {
    const now = performance.now();
    const frozen = mode !== "walk" || busy || msg.active;
    if (!frozen) updatePlayer(dt);
    else if (player.moving) { player.moving = false; player.running = false; player.frame = 0; player.animT = 0; }
    if (mode === "walk" || mode === "menu") updateNpcs(dt, now);
    for (let i = dust.length - 1; i >= 0; i--) {
      dust[i].t += dt;
      if (dust[i].t > 0.4) dust.splice(i, 1);
    }
    focus = !frozen ? findFocus() : null;
    // カメラ（横方向だけ追従）
    const dirX = player.moving ? DIR_VEC[player.dir][0] : 0;
    cam.lead += (dirX * CAM_LEAD * (player.running ? 1.4 : 1) - cam.lead) * (1 - Math.exp(-dt * 2.5));
    const tx = clamp(player.x + cam.lead - VIEW_W / 2, 0, stage.width - VIEW_W);
    cam.x += (tx - cam.x) * (1 - Math.exp(-dt * 10));
  }

  function updatePlayer(dt) {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    let remain = Infinity;
    if (vx || vy) {
      player.target = null;
      player.pending = null;
      player.tapRun = false;
    } else if (player.target) {
      const tx = player.target.x - player.x, ty = player.target.y - player.y;
      const d = Math.hypot(tx, ty);
      if (d < 1) {
        if (!pointerHeld) arrive();
      } else {
        vx = tx / d;
        vy = ty / d;
        remain = d;
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len;
      vy /= len;
      // 走る: Shift を押している／「ダッシュ」ボタンがON／遠くをタップした
      player.running = keys.dash || !!save.alwaysRun || (player.tapRun && !!player.target);
      const step = Math.min(remain, SPEED * (player.running ? DASH_MULT : 1) * dt);
      const bx = player.x, by = player.y;
      const nx = player.x + vx * step, ny = player.y + vy * step;
      if (!blocked(nx, player.y, player)) player.x = nx;    // 軸ごとに動かして壁沿いに滑る
      if (!blocked(player.x, ny, player)) player.y = ny;
      const moved = Math.hypot(player.x - bx, player.y - by);
      player.dir = quantizeDir(vx, vy, player.dir);
      if (player.target && moved < step * 0.2 && !pointerHeld) arrive(); // 行き止まり
      if (!player.moving) {
        player.moving = true;
        player.frame = 1;                                    // 歩き出しで一歩目を出す
        player.animT = 0;
      }
      player.animT += dt * (player.running ? 1.5 : 1);
      while (player.animT >= ANIM_SEC) {
        player.animT -= ANIM_SEC;
        player.frame ^= 1;
      }
      if (player.running && moved > 0.01) {
        player.dustT -= dt;
        if (player.dustT <= 0) {
          player.dustT = DUST_EVERY;
          dust.push({ x: player.x - vx * S(4) + (Math.random() - 0.5) * S(3), y: player.y, t: 0 });
        }
      }
      // 左端（通りの入口）へ歩くとエリアマップへ
      const ex = stage.exit;
      if (ex && vx < 0 && player.x <= ex.x + ex.w + FOOT_HALF_W) goAreaMap();
    } else if (player.moving) {
      player.moving = false;
      player.running = false;
      player.tapRun = false;
      player.frame = 0;
      player.animT = 0;
    }
  }

  function updateNpcs(dt, now) {
    for (const n of npcs) {
      if (n.talking) { n.moving = false; n.frame = 0; continue; }
      if (!n.patrol) {
        if (n.restoreAt && now >= n.restoreAt) { n.dir = n.homeDir; n.restoreAt = 0; }
        continue;
      }
      if (now < n.pauseUntil) { n.moving = false; n.frame = 0; continue; }
      n.dir = n.heading > 0 ? "right" : "left";
      const nx = n.x + n.heading * (n.speed || 26) * dt;
      if (nx < n.patrol[0] || nx > n.patrol[1]) {          // 端で立ち止まって折り返す
        n.heading *= -1;
        n.pauseUntil = now + 1200 + rnd() * 900;
        continue;
      }
      if (blocked(nx, n.y, n)) {                             // 人や物で塞がれたら待つ。長く塞がれたら引き返す
        n.moving = false;
        n.frame = 0;
        n.waitT += dt;
        if (n.waitT > 1.5) { n.heading *= -1; n.waitT = 0; n.pauseUntil = now + 600; }
        continue;
      }
      n.waitT = 0;
      n.x = nx;
      if (!n.moving) { n.moving = true; n.frame = 1; n.animT = 0; }
      n.animT += dt;
      while (n.animT >= ANIM_SEC * 1.3) { n.animT -= ANIM_SEC * 1.3; n.frame ^= 1; }
      n.nextPause -= dt;
      if (n.nextPause <= 0) {                                // たまに立ち止まる
        n.pauseUntil = now + 900 + rnd() * 1600;
        n.nextPause = 4 + rnd() * 5;
      }
    }
  }

  // ---------------------------------------------------------------- 描画
  function spriteFor(dir) {
    const base = MIRROR[dir] || dir;
    return { col: SHEET_DIRS.indexOf(base), flip: !!MIRROR[dir] };
  }
  function drawSprite(sheet, dir, frame, x, y) {
    const { col, flip } = spriteFor(dir);
    const [cw, ch] = sheet.cell;
    const [ax, ay] = sheet.anchor;
    const sx = col * cw, sy = frame * ch;
    const top = Math.round(y) - ay;
    if (flip) {
      const left = Math.round(x) - (cw - 1 - ax);
      ctx.save();
      ctx.translate(left + cw, top);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet.img, sx, sy, cw, ch, 0, 0, cw, ch);
      ctx.restore();
    } else {
      ctx.drawImage(sheet.img, sx, sy, cw, ch, Math.round(x) - ax, top, cw, ch);
    }
  }
  function drawShadow(x, y, w) {
    withUnit(x, y, () => {
      ctx.fillStyle = "rgba(20, 12, 24, 0.32)";
      const rx = Math.round(w / U / 2);
      for (let r = -1; r <= 1; r++) {
        const half = Math.round(rx * Math.sqrt(1 - (r / 2) * (r / 2)));
        ctx.fillRect(-half, r, half * 2, 1);
      }
    });
  }
  function drawBarricade(b, y) {
    // 工事用の柵（黄と黒の縞の板＋脚）。通りを縦に塞ぐように並べる
    withUnit(b.x, y, () => {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(1, -9, 1, 9);
      ctx.fillRect(14, -9, 1, 9);
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, -13, 16, 6);
      for (let i = 0; i < 16; i += 4) {
        ctx.fillStyle = "#f2c230";
        ctx.fillRect(i + 1, -12, 2, 4);
      }
    });
  }
  function drawCone(x, y) {
    withUnit(x, y, () => {
      ctx.fillStyle = "#e0602a";
      ctx.fillRect(-1, -9, 3, 2);
      ctx.fillRect(-2, -7, 5, 2);
      ctx.fillStyle = "#f3f0e8";
      ctx.fillRect(-2, -5, 5, 1);
      ctx.fillStyle = "#e0602a";
      ctx.fillRect(-3, -4, 7, 3);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(-4, -1, 9, 1);
    });
  }
  function drawSignText(f) {
    if (!f.sign) return;
    const [sx, sy, sw, sh] = f.geo.sign;
    const style = {
      peppermint: ["#e2457c", "rgba(255,255,255,0.75)"],
      kemurikusa: ["#f1dfb2", "rgba(0,0,0,0.8)"],
    }[f.id] || ["#fbe9c6", "rgba(40,24,10,0.85)"];
    const x = f.x + sx + sw / 2, y = stage.groundTop - f.geo.h + sy + sh / 2 + 0.5;
    let size = Math.min(sh * 0.72, 8 * U);
    ctx.font = `${size}px "DotGothic16", sans-serif`;
    const tw = ctx.measureText(f.sign).width;
    if (tw > sw * 0.88) {
      size *= (sw * 0.88) / tw;
      ctx.font = `${size}px "DotGothic16", sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const off = 0.5 * U;
    ctx.fillStyle = style[1];
    ctx.fillText(f.sign, x + off, y + off);
    ctx.fillStyle = style[0];
    ctx.fillText(f.sign, x, y);
  }
  function drawWorldText(text, x, y, size, color) {
    ctx.font = `${size}px "DotGothic16", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(text, x + 0.5, y + 0.5);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function drawExitPost() {
    // 通りの入口の道しるべ
    withUnit(0, stage.groundTop, () => {
      ctx.fillStyle = "#3a2e24";
      ctx.fillRect(5, -14, 2, 30);
      ctx.fillStyle = "#2a5a8a";
      ctx.fillRect(1, -22, 44, 9);
      ctx.fillStyle = "#e8eef6";
      ctx.fillRect(1, -22, 44, 1);
      drawWorldText(`◀ ${stage.exit.label}`, 23, -17.5, 4.5, "#ffffff");
    });
  }

  // ---------------------------------------------------------------- 奥行き（高解像度2.5D版のレイヤー・AA9）
  // 遠景: 画像（far.img）があれば使い、無ければコード描画の街並み。ぼかして、霞を重ねて、ゆっくり動かす
  function makeFarLayer(src, width, height, cfg) {
    const cv = makeCanvas(width, height);
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = !!cfg.blur;
    const sw = Math.max(1, Math.round(src.width * height / src.height));
    for (let x = 0; x < width; x += sw) g.drawImage(src, x, 0, sw, height);
    if (cfg.haze) {
      const h = g.createLinearGradient(0, 0, 0, height);
      const c = NIGHT ? "18, 22, 58" : "226, 232, 244";
      h.addColorStop(0, `rgba(${c}, 0)`);
      h.addColorStop(1, `rgba(${c}, ${cfg.haze})`);
      g.fillStyle = h;
      g.fillRect(0, 0, width, height);
    }
    if (!cfg.blur) return cv;
    const out = makeCanvas(width, height);
    const og = out.getContext("2d");
    og.filter = `blur(${cfg.blur}px)`;
    og.drawImage(cv, 0, 0);
    return out;
  }
  // 手前: カメラのすぐ前を横切る電柱と電線（通りより速く動き、ピントが合っていないのでぼける）。
  // 電柱は fg_utility_pole.png があればそれを、無ければコードで描く。電線は次の柱まで必ずつながるようにコードで描く
  function makePoleTile(cfg, img) {
    const spacing = cfg.spacing, h = VIEW_H + S(20);
    const col = NIGHT ? "#0b0a12" : "#2b2732";
    const iw = img ? Math.round(img.width * h / img.height) : 0;
    const poleW = img ? iw : S(13);
    const w = spacing + poleW;
    const cv = makeCanvas(w, h);
    const g = cv.getContext("2d");
    let cx;
    if (img) {
      g.imageSmoothingEnabled = true;
      g.drawImage(img, 0, 0, iw, h);
      cx = iw / 2;
    } else {
      const pw = S(7), px = S(3);
      g.fillStyle = col;
      g.fillRect(px, 0, pw, h);                                        // 柱
      g.fillRect(px - S(10), S(34), pw + S(20), S(3));                // 腕木
      g.fillRect(px - S(6), S(48), pw + S(12), S(2));
      g.fillStyle = NIGHT ? "#1a1824" : "#4a4552";
      g.fillRect(px + pw - S(2), 0, S(2), h);                         // 柱の陰
      cx = px + pw / 2;
    }
    g.strokeStyle = col;
    g.lineWidth = Math.max(1, U);
    const wires = cfg.wires || [[34, 26], [40, 30], [48, 22]];         // [高さ, たるみ]（標準版のドット）
    for (const [y, sag] of wires) {
      g.beginPath();
      g.moveTo(cx, S(y));
      g.quadraticCurveTo(cx + spacing / 2, S(y + sag), cx + spacing, S(y));
      g.stroke();
    }
    cv.poleCx = cx;
    if (!cfg.blur) return cv;
    const out = makeCanvas(w, h);
    const og = out.getContext("2d");
    og.filter = `blur(${cfg.blur}px)`;
    og.drawImage(cv, 0, 0);
    out.poleCx = cx;
    return out;
  }
  // 灯りのにじみ: 灯りの中でも特に明るい芯（電球・窓の一番明るいところ）だけをぼかして重ねる
  //（灯り全体をにじませると、PEPPERMINT のピンクの壁まで白く飛ぶ）
  function makeBloom(glow, radius) {
    if (!glow) return null;
    const core = makeCanvas(glow.width, glow.height);
    const cg = core.getContext("2d");
    cg.drawImage(glow, 0, 0);
    let data;
    try { data = cg.getImageData(0, 0, core.width, core.height); } catch (e) { return null; }
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      if ((p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) < 190) p[i + 3] = 0;
    }
    cg.putImageData(data, 0, 0);
    const pad = Math.ceil(radius * 3);
    const cv = makeCanvas(glow.width + pad * 2, glow.height + pad * 2);
    const g = cv.getContext("2d");
    g.filter = `blur(${radius}px)`;
    g.drawImage(core, pad, pad);
    cv.pad = pad;
    return cv;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    if (!stage || mode === "loading" || mode === "map" || mode === "interior") return;
    const camX = Math.round(cam.x);
    const gt = stage.groundTop;
    const farP = (stage.far && stage.far.parallax) || BACKDROP_PARALLAX;

    // 遠景（視差）
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.drawImage(assets.backdrop, Math.round(camX * farP), 0, VIEW_W, gt, 0, 0, VIEW_W, gt);

    ctx.setTransform(SCALE, 0, 0, SCALE, -camX * SCALE, 0);
    const visible = (x0, x1) => x1 >= camX - S(4) && x0 <= camX + VIEW_W + S(4);
    for (const w of stage.walls || []) if (visible(w.x0, w.x1)) drawWall(w);
    for (const f of facades) if (visible(f.x, f.x + f.geo.w)) ctx.drawImage(f.art, f.x, gt - f.geo.h);
    const gw = assets.ground.width;
    for (let x = Math.floor(camX / gw) * gw; x < camX + VIEW_W; x += gw) ctx.drawImage(assets.ground, x, gt);
    if (stage.exit && visible(0, S(46))) drawExitPost();

    // 走った時の砂ぼこり（地面の上・人や物より奥）
    for (const p of dust) {
      const k = p.t / 0.4;
      withUnit(p.x, p.y - k * 4 * U, () => {
        const r = 1 + Math.round(k * 2);
        ctx.fillStyle = `rgba(250, 246, 236, ${(0.9 * (1 - k)).toFixed(2)})`;
        ctx.fillRect(-r, -r, r * 2, r);
        ctx.fillRect(-r + 1, -r - 1, Math.max(1, r * 2 - 2), 1);
      });
    }

    // 足元のyで前後を決めて描く
    const items = [];
    for (const o of objects) {
      if (!visible(o.x - o.art.width / 2, o.x + o.art.width / 2)) continue;
      items.push({ y: o.y, draw: () => ctx.drawImage(o.art, Math.round(o.x - o.art.width / 2), o.y - o.art.height) });
    }
    for (const n of npcs) {
      const sheet = assets.sheets[n.sheet];
      items.push({ y: n.y, draw: () => { drawShadow(n.x, n.y, sheet.cell[0] * 0.55); drawSprite(sheet, n.dir, n.frame, n.x, n.y); } });
    }
    const ps = assets.sheets.tsumugi;
    items.push({ y: player.y + 0.01, draw: () => { drawShadow(player.x, player.y, ps.cell[0] * 0.55); drawSprite(ps, player.dir, player.frame, player.x, player.y); } });
    const b = stage.barricade;
    if (b && visible(b.x - S(8), b.x + S(20))) {
      const w = stage.walk;
      const rows = Math.max(3, Math.round((w.y1 - w.y0) / S(14)));
      for (let i = 0; i < rows; i++) {
        const by = Math.round(w.y0 + S(4) + (w.y1 - w.y0 - S(4)) * (i / (rows - 1)));
        items.push({ y: by, draw: () => drawBarricade(b, by) });
      }
      items.push({ y: w.y1 + S(2), draw: () => drawCone(b.x + S(22), w.y1 + S(2)) });
    }
    items.sort((a, c) => a.y - c.y);
    for (const it of items) it.draw();

    if (NIGHT) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#4a5294";
      ctx.fillRect(camX, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = "source-over";
      for (const f of facades) {
        if (!visible(f.x, f.x + f.geo.w)) continue;
        const glow = assets.glows[f.id];
        if (glow) ctx.drawImage(glow, f.x, gt - f.geo.h);
        const bloom = assets.blooms[f.id];
        if (bloom) {                                         // 灯りのにじみ（高解像度版）
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.5;
          ctx.drawImage(bloom, f.x - bloom.pad, gt - f.geo.h - bloom.pad);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }
      const lampGlow = assets.glows.prop_lamp, lampBloom = assets.blooms.prop_lamp;
      for (const o of objects) {
        if (o.img !== "lamp" || !visible(o.x - S(30), o.x + S(30))) continue;
        const lx = Math.round(o.x - o.art.width / 2), ly = o.y - o.art.height;
        if (lampGlow) ctx.drawImage(lampGlow, lx, ly);
        ctx.globalCompositeOperation = "lighter";
        if (lampBloom) ctx.drawImage(lampBloom, lx - lampBloom.pad, ly - lampBloom.pad);
        ctx.fillStyle = "rgba(255, 196, 120, 0.10)";
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          ctx.ellipse(o.x, o.y - S(2), S(26 - r * 7), S(7 - r * 2), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
    }
    for (const f of facades) if (visible(f.x, f.x + f.geo.w)) drawSignText(f);
    if (b && visible(b.x - S(8), b.x + S(20))) drawWorldText("試作範囲外", b.x + S(8), stage.walk.y0 - S(12), 4.5 * U, "#f2c230");

    // 手前の電柱と電線（通りより速く動く・プレイヤーに重なる時は薄く）
    const fg = stage.foreground;
    if (fg && assets.poleTile) {
      const tile = assets.poleTile;
      const pScreenX = player.x - camX;
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.imageSmoothingEnabled = true;
      for (let i = 0; i < fg.count; i++) {
        const x = Math.round(fg.start + i * fg.spacing - camX * fg.parallax);
        if (x > VIEW_W || x + tile.width < 0) continue;
        const poleX = x + tile.poleCx;
        const near = Math.abs(poleX - pScreenX) < S(14);
        ctx.globalAlpha = near ? 0.35 : 0.92;
        ctx.drawImage(tile, x, -S(10));
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }
    // 画面全体の光と周辺減光（高解像度版）
    const post = stage.post;
    if (post) {
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      if (post.sun && !NIGHT) {
        const g = ctx.createLinearGradient(0, 0, VIEW_W * 0.7, VIEW_H);
        g.addColorStop(0, `rgba(255, 226, 170, ${post.sun})`);
        g.addColorStop(1, "rgba(255, 226, 170, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (post.vignette) {
        const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.62);
        g.addColorStop(0, "rgba(10, 6, 20, 0)");
        g.addColorStop(1, `rgba(10, 6, 20, ${post.vignette})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      ctx.setTransform(SCALE, 0, 0, SCALE, -camX * SCALE, 0);
    }

    // 決定できる相手がいる時は頭上に「！」
    if (focus && !busy && !msg.active) {
      const bob = Math.floor(performance.now() / 300) % 2;
      withUnit(player.x, Math.round(player.y) - ps.anchor[1] - S(6), () => {
        const y = -bob;
        ctx.fillStyle = "#241a2a";
        ctx.fillRect(-3, y - 1, 7, 10);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-2, y, 5, 8);
        ctx.fillStyle = "#d8402a";
        ctx.fillRect(0, y + 1, 1, 4);
        ctx.fillRect(0, y + 6, 1, 1);
      });
    }
    // タップ先の目印
    if (player.target && Math.floor(performance.now() / 180) % 2 === 0) {
      withUnit(player.target.x, player.target.y, () => {
        ctx.fillStyle = "#f4d27a";
        ctx.fillRect(-2, 0, 5, 1);
        ctx.fillRect(0, -2, 1, 5);
      });
    }
  }

  // ---------------------------------------------------------------- メッセージ（1回の表示は全角24字×2行以内）
  // 折り返しは本編 web/js/engine.js の autoWrap() と同じ規則（全角24字・半角は0.5字・
  // 文末「。！？」→読点の順で手前の区切りを優先・行頭禁則）。ブラウザ任せだと語の途中で折れるため
  const WRAP_LIMIT = 24;
  const WRAP_BREAK_AFTER = "、。，．！？…‥」』）】〉》";
  const WRAP_NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
  const charW = (ch) => (ch.charCodeAt(0) <= 0xff ? 0.5 : 1);
  function wrapLine(text) {
    const seg = Array.from(text);
    let out = [];
    let width = 0;
    let lineStart = 0;
    for (let i = 0; i < seg.length; i++) {
      out.push(seg[i]);
      width += charW(seg[i]);
      if (width < WRAP_LIMIT || i === seg.length - 1) continue;
      let cut = -1;
      for (const set of ["。！？", WRAP_BREAK_AFTER]) {
        for (let k = out.length - 1; k >= lineStart && cut < 0; k--) {
          if (!set.includes(out[k])) continue;
          let c = k + 1;
          while (c < out.length && WRAP_NO_LINE_START.includes(out[c])) c++;
          let w = 0;
          for (let j = lineStart; j < c; j++) w += charW(out[j]);
          if (w >= WRAP_LIMIT * 0.3) cut = c;
        }
        if (cut >= 0) break;
      }
      if (cut < 0 || cut >= out.length) {
        while (i + 1 < seg.length && WRAP_NO_LINE_START.includes(seg[i + 1])) out.push(seg[++i]);
        // 残りが2文字以下なら折らずに今の行へ吸収（末尾だけが次の行に孤立しないように）
        let rem = 0;
        for (let k = i + 1; k < seg.length; k++) rem += charW(seg[k]);
        if (rem <= 2) {
          for (let k = i + 1; k < seg.length; k++) out.push(seg[k]);
          break;
        }
        cut = out.length;
      }
      out.splice(cut, 0, "\n");
      lineStart = cut + 1;
      width = 0;
      for (let j = lineStart; j < out.length; j++) width += charW(out[j]);
    }
    return out;
  }
  const msg = { active: false, lines: [], idx: 0, shown: 0, acc: 0, done: null };
  function say(lines, opts = {}) {
    msg.active = true;
    msg.lines = lines.map(wrapLine);
    msg.idx = 0;
    msg.shown = 0;
    msg.acc = 0;
    msg.done = opts.onDone || null;
    $("#msg-name").textContent = opts.name || "";
    $("#msg-name").classList.toggle("hidden", !opts.name);
    $("#msg").classList.remove("hidden");
    player.target = null;
    player.pending = null;
    renderMsg();
  }
  function renderMsg() {
    const line = msg.lines[msg.idx] || [];
    $("#msg-text").textContent = line.slice(0, msg.shown).join("");
    $("#msg-next").classList.toggle("hidden", msg.shown < line.length);
  }
  function advanceMsg() {
    const line = msg.lines[msg.idx] || [];
    if (msg.shown < line.length) {
      msg.shown = line.length;
      renderMsg();
      return;
    }
    msg.idx++;
    if (msg.idx < msg.lines.length) {
      msg.shown = 0;
      msg.acc = 0;
      renderMsg();
      return;
    }
    msg.active = false;
    $("#msg").classList.add("hidden");
    const done = msg.done;
    msg.done = null;
    if (done) done();
  }
  function tickMsg(dt) {
    if (!msg.active) return;
    const line = msg.lines[msg.idx] || [];
    if (msg.shown >= line.length) return;
    msg.acc += dt * 1000;
    let changed = false;
    while (msg.acc >= TYPE_MS && msg.shown < line.length) {
      msg.acc -= TYPE_MS;
      msg.shown++;
      changed = true;
    }
    if (changed) renderMsg();
  }

  // ---------------------------------------------------------------- 通行人
  function talkTo(n) {
    n.talking = true;
    n.moving = false;
    n.frame = 0;
    n.dir = quantizeDir(player.x - n.x, player.y - n.y, n.dir);
    player.dir = quantizeDir(n.x - player.x, n.y - player.y, player.dir);
    const lines = n.talked > 0 && n.textAgain ? n.textAgain : n.text;
    n.talked++;
    say(lines.map((l) => `「${l}」`), {
      name: n.name,
      onDone: () => {
        n.talking = false;
        const now = performance.now();
        if (n.patrol) n.pauseUntil = now + 900;
        else n.restoreAt = now + 1500;
      },
    });
  }

  // ---------------------------------------------------------------- 暗転・場面
  function fadeTo(mid, after) {
    busy = true;
    $("#fade").classList.add("on");
    setTimeout(() => {
      mid();
      $("#fade").classList.remove("on");
      setTimeout(() => {
        busy = false;
        if (after) after();
      }, FADE_MS);
    }, FADE_MS);
  }
  function setStreetUi(on) {
    for (const id of ["#hud", "#help", "#pad"]) $(id).classList.toggle("hidden", !on);
  }
  function placePlayer(x, y, dir) {
    player.x = x;
    player.y = y;
    player.dir = dir;
    player.frame = 0;
    player.moving = false;
    player.target = null;
    player.pending = null;
    player.tapRun = false;
    player.running = false;
    dust.length = 0;
    cam.lead = 0;
    cam.x = clamp(player.x - VIEW_W / 2, 0, stage.width - VIEW_W);
  }
  function placeAtDoor(d, dir) {
    placePlayer(d.cx, stage.walk.y0 + S(6), dir);
  }

  // エリアマップ右上の「標準 / 高解像度」切り替え（URL の ?stage=hd を付け外しして読み直す）
  function buildResToggle() {
    const box = $("#res-toggle");
    for (const b of box.querySelectorAll("button")) {
      const on = (b.dataset.res === "hd") === HD;
      b.setAttribute("aria-pressed", String(on));
      b.onclick = () => {
        if (on) return;
        const q = new URLSearchParams(location.search);
        q.delete("reset");
        if (b.dataset.res === "hd") q.set("stage", "hd");
        else q.delete("stage");
        const qs = q.toString();
        location.search = qs ? `?${qs}` : "";
      };
    }
  }
  function buildPins() {
    buildResToggle();
    const box = $("#pins");
    box.innerHTML = "";
    for (const a of AREAS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pin ${a.open ? "on" : "off"}`;
      b.style.left = `${a.x}%`;
      b.style.top = `${a.y}%`;
      b.dataset.area = a.id;
      b.innerHTML = a.open ? a.label : `${a.label}<small>準備中</small>`;
      b.addEventListener("click", (e) => {
        e.currentTarget.blur();
        if (busy || mode !== "map") return;
        if (a.open) enterStreet();
        else toast("このエリアは準備中です。試作で歩けるのは繁華街だけ。");
      });
      box.appendChild(b);
    }
  }
  let toastTimer = 0;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 1800);
  }
  function showAreaMap(first) {
    const show = () => {
      mode = "map";
      $("#areamap-bg").src = `${ROOT}assets/backgrounds/bg_osu_map_${NIGHT ? "night" : "day"}.png`;
      $("#areamap").classList.remove("hidden");
      $("#interior").classList.add("hidden");
      $("#travel").classList.add("hidden");
      setStreetUi(false);
    };
    if (first) show();
    else fadeTo(show);
  }
  function enterStreet(first) {
    const go = () => {
      $("#areamap").classList.add("hidden");
      $("#toast").classList.add("hidden");
      mode = "walk";
      setStreetUi(true);
      placePlayer(stage.spawn.x, stage.spawn.y, stage.spawn.dir);
    };
    if (first) go();
    else fadeTo(go);
  }
  function goAreaMap() {
    if (busy) return;
    keys.left = false;
    showAreaMap(false);
  }

  function enterShop(d) {
    if (busy) return;
    currentDoor = d;
    fadeTo(() => {
      mode = "interior";
      save.visited[d.id] = true;
      persist();
      $("#interior-bg").src = ROOT + (NIGHT ? d.interior.night : d.interior.day);
      $("#interior-name").textContent = d.label;
      $("#btn-out").classList.add("hidden");
      $("#interior").classList.remove("hidden");
      setStreetUi(false);
    }, () => say(d.enterText, { onDone: () => $("#btn-out").classList.remove("hidden") }));
  }
  function leaveShop() {
    if (busy || mode !== "interior" || msg.active) return;
    const d = currentDoor;
    fadeTo(() => {
      $("#interior").classList.add("hidden");
      mode = "walk";
      currentDoor = null;
      setStreetUi(true);
      placeAtDoor(d, "down");
    });
  }

  // ---------------------------------------------------------------- ファストトラベル
  let travelItems = [];
  let travelSel = 0;
  function openTravel() {
    if (busy || mode !== "walk" || msg.active) return;
    travelItems = [
      { label: "通りの入口", go: () => placePlayer(stage.spawn.x, stage.spawn.y, stage.spawn.dir) },
      ...doors.map((d) => ({
        label: save.visited[d.id] ? `${d.label}の前` : "？？？",
        off: !save.visited[d.id],
        door: d.id,
        go: () => placeAtDoor(d, "down"),
      })),
      { label: "エリアマップへ", map: true },
    ];
    travelSel = 0;
    mode = "menu";
    player.target = null;
    player.pending = null;
    renderTravel();
    $("#travel").classList.remove("hidden");
  }
  function closeTravel() {
    $("#travel").classList.add("hidden");
    if (mode === "menu") mode = "walk";
  }
  function renderTravel() {
    const ul = $("#travel-list");
    ul.innerHTML = "";
    travelItems.forEach((it, i) => {
      const li = document.createElement("li");
      li.textContent = it.label;
      if (it.off) li.classList.add("off");
      if (i === travelSel) li.classList.add("sel");
      if (it.door) li.dataset.door = it.door;
      li.addEventListener("click", () => { travelSel = i; renderTravel(); chooseTravel(); });
      ul.appendChild(li);
    });
  }
  function moveTravel(step) {
    let i = travelSel;
    for (let k = 0; k < travelItems.length; k++) {
      i = (i + step + travelItems.length) % travelItems.length;
      if (!travelItems[i].off) break;
    }
    travelSel = i;
    renderTravel();
  }
  function chooseTravel() {
    const it = travelItems[travelSel];
    if (!it || it.off || busy) return;
    closeTravel();
    if (it.map) goAreaMap();
    else fadeTo(it.go);
  }

  // ---------------------------------------------------------------- 入力
  const MOVE_KEYS = {
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ShiftLeft: "dash", ShiftRight: "dash",
  };
  const ACT_KEYS = new Set(["KeyZ", "Enter", "NumpadEnter", "Space"]);
  const CANCEL_KEYS = new Set(["KeyX", "Escape"]);
  function act() {
    if (busy) return;
    if (msg.active) { advanceMsg(); return; }
    if (mode === "walk") interact(findFocus());
    else if (mode === "interior") leaveShop();
    else if (mode === "map") enterStreet();
    else if (mode === "menu") chooseTravel();
  }
  window.addEventListener("keydown", (e) => {
    const mk = MOVE_KEYS[e.code];
    if (mk) {
      keys[mk] = true;
      if (mk !== "dash") e.preventDefault();
      if (mode === "menu" && !e.repeat && (mk === "up" || mk === "down")) moveTravel(mk === "up" ? -1 : 1);
      return;
    }
    const isAct = ACT_KEYS.has(e.code), isCancel = CANCEL_KEYS.has(e.code), isMap = e.code === "KeyM";
    if (!isAct && !isCancel && !isMap) return;
    e.preventDefault();
    if (e.repeat || busy) return;
    if (msg.active) { if (isAct || isCancel) advanceMsg(); return; }
    if (mode === "walk") {
      if (isAct) act();
      else if (isMap) openTravel();
    } else if (mode === "menu") {
      if (isAct) chooseTravel();
      else closeTravel();
    } else if (mode === "interior") {
      leaveShop();
    } else if (mode === "map" && isAct) {
      enterStreet();
    }
  });
  window.addEventListener("keyup", (e) => {
    const mk = MOVE_KEYS[e.code];
    if (mk) keys[mk] = false;
  });
  window.addEventListener("blur", () => { for (const k of Object.keys(keys)) keys[k] = false; });

  // 遠くをタップしたら走って向かう（スマホでもダッシュできるように・AA8）
  function farTarget() {
    const t = player.target;
    return !!t && Math.hypot(t.x - player.x, t.y - player.y) > RUN_TAP_DIST;
  }
  function pointerToWorld(e) {
    const r = canvas.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * VIEW_W;
    const sy = ((e.clientY - r.top) / r.height) * VIEW_H;
    return { x: Math.round(cam.x) + sx, y: sy };
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (busy) return;
    if (msg.active) { advanceMsg(); return; }
    if (mode === "menu") { closeTravel(); return; }
    if (mode !== "walk") return;
    const p = pointerToWorld(e);
    const hit = hitTest(p.x, p.y);
    if (hit) {
      player.pending = { kind: hit.kind, id: hit.id };
      player.target = approachPoint(hit);
      player.tapRun = farTarget();
      return;
    }
    pointerHeld = true;
    canvas.setPointerCapture(e.pointerId);
    player.pending = null;
    player.target = { x: clamp(p.x, stage.walk.x0 + FOOT_HALF_W, stage.walk.x1 - FOOT_HALF_W), y: clampWalkY(p.y) };
    player.tapRun = farTarget();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointerHeld || mode !== "walk" || msg.active) return;
    const p = pointerToWorld(e);
    player.target = { x: clamp(p.x, stage.walk.x0 + FOOT_HALF_W, stage.walk.x1 - FOOT_HALF_W), y: clampWalkY(p.y) };
    player.tapRun = farTarget();                             // 押したまま遠くへ引っぱると走る
  });
  const release = () => { pointerHeld = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  $("#msg").addEventListener("pointerdown", (e) => { e.stopPropagation(); if (!busy && msg.active) advanceMsg(); });
  $("#interior").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    if (!busy && msg.active) advanceMsg();
  });
  $("#btn-out").addEventListener("click", (e) => { e.currentTarget.blur(); leaveShop(); });
  $("#btn-act").addEventListener("click", (e) => { e.currentTarget.blur(); act(); });
  function syncRunButton() {
    const b = $("#btn-run");
    b.setAttribute("aria-pressed", String(!!save.alwaysRun));
    b.textContent = save.alwaysRun ? "ダッシュ ON" : "ダッシュ";
  }
  $("#btn-run").addEventListener("click", (e) => {
    e.currentTarget.blur();
    save.alwaysRun = !save.alwaysRun;
    persist();
    syncRunButton();
  });
  syncRunButton();
  $("#btn-map").addEventListener("click", (e) => {
    e.currentTarget.blur();
    if (mode === "menu") closeTravel();
    else openTravel();
  });

  // ---------------------------------------------------------------- 画面フィット
  function fit() {
    const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    $("#stage").style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  // ---------------------------------------------------------------- ループ
  let last = performance.now();
  document.addEventListener("visibilitychange", () => { last = performance.now(); });
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (stage && mode !== "loading") {
      update(dt);
      tickMsg(dt);
      render();
    }
    requestAnimationFrame(loop);
  }

  // テスト・デバッグ用
  window.__street = {
    state: () => ({
      ready: mode !== "loading",
      mode, busy,
      x: Math.round(player.x * 10) / 10, y: Math.round(player.y * 10) / 10, dir: player.dir, moving: player.moving,
      running: player.running, alwaysRun: !!save.alwaysRun,
      camX: Math.round(cam.x),
      focus: focus ? `${focus.kind}:${focus.id}` : null,
      msg: msg.active ? (msg.lines[msg.idx] || []).join("").replace(/\n/g, "") : null,
      interior: currentDoor ? currentDoor.id : null,
      visited: { ...save.visited },
      travel: mode === "menu" ? travelItems.map((t) => ({ label: t.label, off: !!t.off })) : null,
      npcs: npcs.map((n) => ({ id: n.id, x: Math.round(n.x), y: n.y, dir: n.dir, talking: n.talking })),
      missing: assets.missing.slice(),
      night: NIGHT,
    }),
    // ステージの配置（スモークテストが座標を決めるのに使う。標準版・高解像度版どちらでも同じテストを回せる）
    layout: () => ({
      id: stage.id, hd: HD, unit: U, view: [VIEW_W, VIEW_H, SCALE], width: stage.width, groundTop: stage.groundTop,
      walk: { ...stage.walk }, spawn: { ...stage.spawn }, exit: stage.exit && { ...stage.exit },
      speed: SPEED, dashMult: DASH_MULT, runTapDist: RUN_TAP_DIST, footHalfW: FOOT_HALF_W,
      doors: doors.map((d) => ({ id: d.id, cx: d.cx })),
      objects: objects.map((o) => ({ id: o.id, x: o.x, y: o.y, solid: o.solid || null, w: o.art.width, h: o.art.height })),
      npcs: npcs.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      farSource: assets.farSource, foreground: !!assets.poleTile, fgSource: assets.fgSource || null,
    }),
    place: (x, y, dir = "down") => {
      if (mode !== "walk") return false;
      placePlayer(x, y, dir);
      return true;
    },
    warp: (doorId) => {
      const d = doors.find((x) => x.id === doorId);
      if (!d) return false;
      $("#areamap").classList.add("hidden");
      $("#interior").classList.add("hidden");
      $("#travel").classList.add("hidden");
      mode = "walk";
      setStreetUi(true);
      placeAtDoor(d, "up");
      return true;
    },
  };

  init();
  requestAnimationFrame(loop);
})();
