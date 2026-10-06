"use strict";
// 通りの試作（本編未接続）。エリアマップ → 繁華街の通りを8方向で歩く → 店に入る／しらべる／話す／ファストトラベル。
// 古町の観音堂（?area=kannon・AA14）: 石段を上がってお参り・常香炉の煙・おみくじ・近づくと飛び立つ鳩・寝ている白い猫。
// 歩行（移動・向きの量子化・2コマ歩行・左右反転・足元yソート・タップ移動）は web/proto/walk/index.html と同じ挙動。
(() => {
  // ---------------------------------------------------------------- 定数
  const STAGE_W = 1280, STAGE_H = 720;                   // 画面（キャンバス）の大きさ
  // 内部解像度と「1ドットの大きさ」はステージJSONの view / unit で決まる（applyProfile）。
  //   標準: 320×180 を4倍・unit 1 ／ 高解像度2.5D（stage_hankagai_hd.json）: 640×360 を2倍・unit 1.5
  let VIEW_W = 320, VIEW_H = 180, SCALE = 4;
  let U = 1;                                             // 標準版を1とした、長さ・速さの倍率
  let DU = 1;                                            // コードで描く小物（柵・「！」など）の拡大率。ドットが崩れないよう整数にできる
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
  // ?stage=hd … 高解像度2.5D版（AA9）／ ?stage=set … ハリボテ背景版（AA11。背景は一枚絵・キャラ72ドット）
  const STAGE_KIND = ["hd", "set"].includes(params.get("stage")) ? params.get("stage") : "base";
  const HD = STAGE_KIND === "hd";
  // エリアごとのステージ。観音堂はハリボテ背景版だけ（「画質」の切り替えは繁華街だけに効く）
  const STAGE_FILES = {
    hankagai: { base: "stage_hankagai.json", hd: "stage_hankagai_hd.json", set: "stage_hankagai_set.json" },
    kannon: { set: "stage_kannon_set.json" },
  };
  const AREA_ID = STAGE_FILES[params.get("area")] ? params.get("area") : "hankagai";
  const STAGE_FILE = STAGE_FILES[AREA_ID][STAGE_KIND] || STAGE_FILES[AREA_ID].set;
  const BUST = `?t=${Date.now()}`;
  const S = (v) => Math.round(v * U);                    // 標準版のドット数 → 今のステージのドット数

  function applyProfile(st) {
    const v = st.view || {};
    VIEW_W = v.w || 320;
    VIEW_H = v.h || 180;
    SCALE = v.scale || 4;
    U = st.unit || 1;
    DU = st.drawUnit || U;
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
    ctx.scale(DU, DU);
    draw();
    ctx.restore();
  }

  // エリアマップのピン（%）。歩けるのは繁華街と古町（観音堂）
  const AREAS = [
    { id: "hankagai", label: "繁華街", x: 58, y: 36, open: true },
    { id: "tonari", label: "tonari", x: 86, y: 36 },
    { id: "tonya", label: "問屋街", x: 34, y: 24 },
    { id: "shitamachi", label: "下町", x: 44, y: 62 },
    { id: "kannon", label: "古町", sub: "観音堂", x: 17, y: 56, open: true },
    { id: "home", label: "自宅", x: 88, y: 62 },
  ];

  const $ = (s) => document.querySelector(s);
  const canvas = $("#view");
  const mainCtx = canvas.getContext("2d");
  let ctx = mainCtx;                // 夜のハリボテ版では、人と小物だけを別のレイヤーに描いてから色を合わせる

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
  const PROP_PH_SIZE = {
    vending: [23, 34], bench: [23, 16], aboard: [16, 19], plant: [16, 18], lamp: [13, 56], bicycle: [29, 19],
    // 観音堂（AA14）。キャラの身長32に対する大きさ
    koro: [30, 30], saisen: [30, 16], toro: [15, 40], omikuji: [14, 28], endai: [32, 14], nobori: [10, 82],
  };
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
      case "koro": {                                         // 常香炉: 3本脚の青銅の香炉と、反った屋根
        const bronze = "#5d6b5a", dark = "#3b4639";
        box(Math.round(w * 0.08), Math.round(h * 0.06), Math.round(w * 0.84), Math.round(h * 0.12), dark);  // 屋根
        box(Math.round(w * 0.42), 0, Math.round(w * 0.16), Math.round(h * 0.08), dark);
        box(Math.round(w * 0.3), Math.round(h * 0.18), Math.round(w * 0.4), Math.round(h * 0.16), bronze);  // 柱
        box(Math.round(w * 0.06), Math.round(h * 0.34), Math.round(w * 0.88), Math.round(h * 0.3), bronze); // 炉
        box(Math.round(w * 0.06), Math.round(h * 0.34), Math.round(w * 0.88), 2, "#8a9a82");
        box(Math.round(w * 0.14), Math.round(h * 0.42), Math.round(w * 0.72), 2, "#c9a24a");                // 縁の金
        box(Math.round(w * 0.12), Math.round(h * 0.64), 3, h - Math.round(h * 0.64), dark);                // 脚
        box(Math.round(w * 0.5) - 1, Math.round(h * 0.64), 3, h - Math.round(h * 0.64), dark);
        box(Math.round(w * 0.85) - 2, Math.round(h * 0.64), 3, h - Math.round(h * 0.64), dark);
        break;
      }
      case "saisen":                                         // 賽銭箱: 木の箱と、上の格子
        box(0, Math.round(h * 0.2), w, h - Math.round(h * 0.2), "#7a4a26");
        box(0, Math.round(h * 0.2), w, 2, "#a8743e");
        for (let x = 2; x < w - 2; x += 4) box(x, 0, 2, Math.round(h * 0.34), "#5a361c");
        box(0, Math.round(h * 0.3), w, 1, "#3b2414");
        box(Math.round(w * 0.3), Math.round(h * 0.55), Math.round(w * 0.4), Math.round(h * 0.18), "#c9a24a");
        break;
      case "toro": {                                         // 石灯籠: 宝珠・笠・火袋・竿・台
        const st = "#a39e94", sd = "#7c776e";
        box(Math.round(w / 2) - 2, 0, 4, 4, st);
        box(1, 4, w - 2, Math.round(h * 0.12), sd);
        box(Math.round(w * 0.2), Math.round(h * 0.22), Math.round(w * 0.6), Math.round(h * 0.2), st);
        box(Math.round(w * 0.32), Math.round(h * 0.26), Math.round(w * 0.36), Math.round(h * 0.12), "#f3c45a");  // 火袋の灯り
        box(Math.round(w * 0.1), Math.round(h * 0.42), Math.round(w * 0.8), 3, sd);
        box(Math.round(w * 0.34), Math.round(h * 0.42) + 3, Math.round(w * 0.32), Math.round(h * 0.4), st);
        box(Math.round(w * 0.12), h - Math.round(h * 0.14), Math.round(w * 0.76), Math.round(h * 0.14), sd);
        break;
      }
      case "omikuji":                                        // おみくじ: 木の台に六角の筒
        box(Math.round(w * 0.1), Math.round(h * 0.4), Math.round(w * 0.8), h - Math.round(h * 0.4), "#8b5a2e");
        box(Math.round(w * 0.1), Math.round(h * 0.4), Math.round(w * 0.8), 2, "#b07a44");
        box(Math.round(w * 0.3), 0, Math.round(w * 0.4), Math.round(h * 0.4), "#c23b2a");
        box(Math.round(w * 0.3), 0, Math.round(w * 0.4), 2, "#e8d6a6");
        break;
      case "endai":                                          // 縁台: 赤い毛氈をかけた木の台
        box(0, 0, w, Math.round(h * 0.45), "#c8352a");
        box(0, 0, w, 2, "#e25a44");
        box(2, Math.round(h * 0.45), 3, h - Math.round(h * 0.45), "#5a3a22");
        box(w - 5, Math.round(h * 0.45), 3, h - Math.round(h * 0.45), "#5a3a22");
        break;
      case "nobori":                                         // 幟: 細い竿に、白地に色の模様だけの旗（文字なし）
        box(1, 0, 2, h, "#6a5a48");
        box(3, 2, w - 3, Math.round(h * 0.78), "#f1ece0");
        box(5, Math.round(h * 0.12), w - 7, Math.round(h * 0.08), "#c23b2a");
        box(5, Math.round(h * 0.34), w - 7, Math.round(h * 0.14), "#3a3a44");
        box(5, Math.round(h * 0.58), w - 7, Math.round(h * 0.06), "#c23b2a");
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
    const k = Math.max(1, Math.round(CHAR_SIZE / 36));          // 72ドットのキャラなら2倍で描く
    const cw = 24, ch = 36;
    const cv = makeCanvas(cw * SHEET_DIRS.length * k, ch * 2 * k);
    const g = cv.getContext("2d");
    g.scale(k, k);
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
    return { img: outline(cv), cell: [cw * k, ch * k], anchor: [12 * k, (ch - 2) * k], source: "placeholder" };
  }
  const CAPSULE = {
    tsumugi: { body: "#4a2d63", hair: "#5e3b28", skin: "#f6cfb4", leg: "#1c1c24" },
    mob_obasan: { body: "#c8a97e", hair: "#6a4a32", skin: "#f1c9a8", leg: "#2b3150" },
    mob_student: { body: "#3f6b66", hair: "#33405f", skin: "#f1c9a8", leg: "#3a4a78" },
    mob_oldman: { body: "#3b4566", hair: "#d8d4cc", skin: "#e9bf9c", leg: "#2c3350" },   // 作務衣のおじいさん（観音堂）
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

  // ハリボテ版の一枚絵が無い時の仮の通り（空・建物の帯・歩道・車道と、入口の位置に暗いドア）
  function makeSetPlaceholder() {
    const cv = makeCanvas(stage.width, VIEW_H);
    const g = cv.getContext("2d");
    const gt = stage.groundTop, curb = stage.walk.y1 + S(2);
    const sky = g.createLinearGradient(0, 0, 0, gt);
    sky.addColorStop(0, NIGHT ? "#0b1030" : "#8fc3ee");
    sky.addColorStop(1, NIGHT ? "#2b2350" : "#e9dcc4");
    g.fillStyle = sky;
    g.fillRect(0, 0, cv.width, gt);
    g.fillStyle = NIGHT ? "#3a3240" : "#8b6a4c";
    for (const d of stage.doors) {
      const [x, top, w] = d.rect || [0, 0, 0];
      if (w) g.fillRect(x - S(50), top - S(70), w + S(100), gt - top + S(70));   // 店の建物のかたまり
    }
    g.fillStyle = "#b9b3a8";
    g.fillRect(0, gt, cv.width, curb - gt);
    g.fillStyle = "#d0a034";
    g.fillRect(0, Math.round(gt + (curb - gt) * 0.55), cv.width, S(3));
    g.fillStyle = "#3a393c";
    g.fillRect(0, curb, cv.width, VIEW_H - curb);
    g.fillStyle = "#2a1a12";
    for (const d of stage.doors) if (d.rect) g.fillRect(...d.rect);
    return cv;
  }

  // 観音堂（AA14）の仮の境内: 空・遠くの木立・仁王門・本堂（石段・大提灯）・絵馬掛け・鐘楼・白壁・石畳・玉垣。
  // 配置は stage.ph（Codex のパネルが届いたら使わなくなる）
  function makeKannonPlaceholder() {
    const cv = makeCanvas(stage.width, VIEW_H);
    const g = cv.getContext("2d");
    const ph = stage.ph, gt = stage.groundTop, W = stage.width;
    const box = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const sky = g.createLinearGradient(0, 0, 0, gt);
    sky.addColorStop(0, NIGHT ? "#0b1030" : "#7fb6ea");
    sky.addColorStop(1, NIGHT ? "#2b2350" : "#e6e2d0");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, gt);
    const r = mulberry32(1818);
    for (let x = -20; x < W + 20; x += 18 + r() * 22) {                 // 遠くの木立
      const rad = 22 + r() * 26;
      g.fillStyle = NIGHT ? "#141c26" : (r() < 0.5 ? "#4f7a4a" : "#5e8a52");
      g.beginPath();
      g.ellipse(x, gt - 40 - r() * 30, rad, rad * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
    box(0, gt - 52, W, 52, NIGHT ? "#1a2230" : "#557f4c");
    const red = NIGHT ? "#7a2a24" : "#c8402e", redD = NIGHT ? "#561c18" : "#96301f";
    const roof = NIGHT ? "#262a36" : "#3e4452", roofL = NIGHT ? "#363b4a" : "#5a6272";
    const lit = NIGHT ? "#ffcf6a" : "#e8a040";
    if (ph.gate) {                                                      // 仁王門
      const [x0, x1, top] = ph.gate, w = x1 - x0;
      box(x0 - 12, top, w + 24, 16, roof);
      box(x0 - 4, top - 4, w + 8, 4, roofL);
      box(x0 + 6, top + 16, w - 12, 28, redD);
      box(x0 - 6, top + 44, w + 12, 12, roof);
      box(x0 + 4, top + 56, w - 8, gt - top - 56, red);
      for (let i = 0; i < 4; i++) box(x0 + 8 + i * (w - 24) / 3, top + 56, 8, gt - top - 56, redD);
      box(x0 + w * 0.4, top + 70, w * 0.2, gt - top - 70, "#2a1a16");   // 門の奥（通れない）
      box(x0 + 22, top + 74, w * 0.18, gt - top - 90, "#4a2a22");       // 仁王の籠
      box(x1 - 22 - w * 0.18, top + 74, w * 0.18, gt - top - 90, "#4a2a22");
    }
    if (ph.bell) {                                                      // 鐘楼
      const [x0, x1, top] = ph.bell, w = x1 - x0;
      box(x0 - 10, top, w + 20, 14, roof);
      box(x0 - 2, top - 4, w + 4, 4, roofL);
      box(x0 + 6, top + 14, 6, gt - top - 14, redD);
      box(x1 - 12, top + 14, 6, gt - top - 14, redD);
      box(x0 + w / 2 - 12, top + 22, 24, 30, NIGHT ? "#2c3a32" : "#4c6450");
      box(x0 - 4, gt - 26, w + 8, 26, "#9a948a");
    }
    if (ph.hall) {                                                      // 本堂
      const [x0, x1, roofTop, floor] = ph.hall, w = x1 - x0;
      const [s0, s1] = ph.stairs || [x0 + w * 0.4, x1 - w * 0.4];
      box(x0 - 10, floor, w + 20, gt - floor, "#9a948a");               // 石の基壇
      box(x0 - 10, floor, w + 20, 3, "#b8b2a6");
      box(x0 + 10, roofTop + 70, w - 20, floor - roofTop - 70, red);     // 堂
      for (let x = x0 + 16; x < x1 - 20; x += 44) box(x, roofTop + 70, 8, floor - roofTop - 70, redD);
      box(x0 + 10, roofTop + 90, w - 20, 6, NIGHT ? "#bdb6a4" : "#efe6d2");
      box(x0 + 40, roofTop + 104, w - 80, floor - roofTop - 108, NIGHT ? "#2e2224" : "#4a2f26");
      box(x0 - 34, roofTop + 14, w + 68, 40, roof);                     // 大屋根
      box(x0 - 18, roofTop, w + 36, 16, roofL);
      box(x0 + w * 0.3, roofTop - 6, w * 0.4, 8, roof);
      box(x0 - 14, roofTop + 54, w + 28, 16, redD);
      const lx = (s0 + s1) / 2;                                         // 大提灯
      box(lx - 18, roofTop + 76, 36, 44, NIGHT ? "#e0603a" : "#d04a30");
      box(lx - 18, roofTop + 76, 36, 4, "#2a2020");
      box(lx - 18, roofTop + 116, 36, 4, "#2a2020");
      box(lx - 10, roofTop + 86, 20, 24, lit);
      for (let y = floor, i = 0; y < gt; y += 6, i++) {                   // 石段
        box(s0, y, s1 - s0, 6, i % 2 ? "#a9a397" : "#bdb7ab");
        box(s0, y + 5, s1 - s0, 1, "#7c776e");
      }
      box(s0 - 4, floor - 2, 4, gt - floor + 2, "#7c776e");
      box(s1, floor - 2, 4, gt - floor + 2, "#7c776e");
    }
    if (ph.ema) {                                                       // 絵馬掛け
      const [x0, x1] = ph.ema;
      box(x0, gt - 44, x1 - x0, 6, "#5a3a22");
      box(x0 + 2, gt - 38, 4, 38, "#5a3a22");
      box(x1 - 6, gt - 38, 4, 38, "#5a3a22");
      for (let y = gt - 36; y < gt - 8; y += 9) {
        for (let x = x0 + 8; x < x1 - 10; x += 7) box(x, y, 6, 6, r() < 0.15 ? "#e8d6a6" : "#d8b47a");
      }
    }
    if (ph.wallFrom != null) {                                          // 白壁（境内の端）
      box(ph.wallFrom, gt - 70, W - ph.wallFrom, 70, NIGHT ? "#8a8a94" : "#efe9dc");
      box(ph.wallFrom - 4, gt - 78, W - ph.wallFrom + 4, 10, roof);
      box(ph.wallFrom, gt - 14, W - ph.wallFrom, 14, "#9a948a");
    }
    const front = stage.walk.y1 + S(4);
    for (let y = gt; y < front; y += 12) {                              // 石畳
      const off = ((y - gt) / 12) % 2 ? 11 : 0;
      for (let x = -off; x < W; x += 22) {
        const k = 160 + Math.floor(r() * 26);
        box(x, y, 22, 12, NIGHT ? `rgb(${k * 0.45},${k * 0.45},${k * 0.55})` : `rgb(${k},${k - 6},${k - 14})`);
        box(x, y, 22, 1, "rgba(40,36,32,0.35)");
        box(x, y, 1, 12, "rgba(40,36,32,0.35)");
      }
    }
    box(0, front, W, VIEW_H - front, NIGHT ? "#3a3a44" : "#b8b0a0");    // 手前の砂利と玉垣
    for (let x = 4; x < W; x += 26) box(x, front + 2, 8, 18, NIGHT ? "#55555f" : "#8e897f");
    box(0, front + 4, W, 4, NIGHT ? "#55555f" : "#8e897f");
    return cv;
  }

  // 鳩と猫（AA14）。画像（pigeon.png / cat.png）が無い時の仮のドット絵。1文字＝1ドット・右向き
  const PIX_PAL = {
    h: "#7c8494", e: "#1c1820", k: "#e8dcc0", n: "#4f8a6e", p: "#7a5a8c", b: "#a3a9b6", B: "#c0c5cf",
    w: "#8a919f", d: "#3f4350", t: "#5c6270", f: "#d0706a",
  };
  const PIGEON_FRAMES = {
    stand: ["..............", "........hh....", ".......hhhe...", ".......hhhhk..", "........np....", "...bbbbbnpb...",
      ".ttbwwwwwbbB..", "tttbwdwdwbBB..", "...bbbbbbBB...", ".....f..f....."],
    walk: ["..............", ".........hh...", "........hhhe..", "........hhhhk.", ".........np...", "...bbbbbbnpb..",
      ".ttbwwwwwbbB..", "tttbwdwdwbBB..", "...bbbbbbBB...", "....f....f...."],
    peck1: ["..............", "..............", "..............", "..............", "...bbbbbb.....", ".ttbwwwwwbn...",
      "tttbwdwdwbnp..", "...bbbbbbBhhe.", "....bbbbB.hhhk", ".....f..f....."],
    peck2: ["..............", "..............", "..............", "..............", "...bbbbbb.....", ".ttbwwwwwbn...",
      "tttbwdwdwbBnp.", "...bbbbbbB.hhe", "....bbbbB..hhh", ".....f..f...hk"],
    fly1: ["...w....w.....", "...ww..ww.....", "....wwwww..hh.", ".....wwww.hhhe", "...bbbbbbnphhk", ".ttbbbbbbbB...",
      "tt..bBBBB.....", "..............", "..............", ".............."],
    fly2: ["..............", "..............", "...........hh.", "..wwwwwww.hhhe", "...bbbbbbnphhk", ".ttbwwwwwbB...",
      "tt..bBBBB.....", "..............", "..............", ".............."],
    fly3: ["..............", "..............", "...........hh.", "..........hhhe", "...bbbbbbnphhk", ".ttbwwwwwbB...",
      "tt..wwwwB.....", "....www.......", ".....w........", ".............."],
  };
  PIGEON_FRAMES.fly4 = PIGEON_FRAMES.fly2;
  const CAT_PAL = { w: "#f2efe8", s: "#cfc9bd", i: "#e8a0a0", e: "#3a3236" };
  const CAT_FRAMES = {
    sleep: ["................", "................", "................", "....wwwwwww.w.w.", "..wwwwwwwwwwwww.",
      ".wwwwwwwwwwwewe.", ".wwwwwwwwwwwwwi.", "swwsssswwwwwww..", ".sssssssssss...."],
    sit: ["...........w.w..", "...........wwww.", "..........wewew.", "..........wwiww.", "....wwwwwwwwww..",
      "..wwwwwwwwwwww..", ".w.wwwwwwwwwww..", "ww.wwwwwwwswws..", ".s..wsssssw.ws.."],
  };
  // 文字のドット絵 → 1枚のシート（コマを横に並べ、外側1ドットに輪郭）。{ img, cell, anchor, frames: {名前: 列} }
  function makePixSheet(frames, pal) {
    const names = Object.keys(frames);
    const fw = frames[names[0]][0].length + 2, fh = frames[names[0]].length + 2;
    const sheet = makeCanvas(fw * names.length, fh);
    const sg = sheet.getContext("2d");
    names.forEach((name, i) => {
      const cv = makeCanvas(fw, fh);
      const g = cv.getContext("2d");
      frames[name].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const col = pal[row[x]];
          if (!col) continue;
          g.fillStyle = col;
          g.fillRect(x + 1, y + 1, 1, 1);
        }
      });
      sg.drawImage(outline(cv), i * fw, 0);
    });
    return { img: sheet, cell: [fw, fh], anchor: [Math.floor(fw / 2), fh - 1], frames: Object.fromEntries(names.map((n, i) => [n, i])), source: "placeholder" };
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
    const propNames = [...new Set(stage.objects.map((o) => o.img).filter(Boolean))];   // 猫・見えない「しらべる」場所は画像なし
    const glowProps = new Set(stage.objects.filter((o) => o.img === "lamp" || o.glow).map((o) => o.img));
    const [facadeImgs, propImgs, groundImg] = await Promise.all([
      Promise.all(facadeIds.map((id) => loadImage(`${STREET_DIR}facade_${id}.png${BUST}`))),
      Promise.all(propNames.map((n) => loadImage(`${STREET_DIR}prop_${n}.png${BUST}`))),
      stage.set ? Promise.resolve(null) : loadImage(`${STREET_DIR}ground.png${BUST}`),   // ハリボテ版は地面も一枚絵の中
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
      if (NIGHT && glowProps.has(n)) {                       // 街灯・石灯籠の灯り
        assets.glows[`prop_${n}`] = makeGlow(assets.props[n]);
        if (stage.bloom) assets.blooms[`prop_${n}`] = makeBloom(assets.glows[`prop_${n}`], stage.bloom);
      }
    });
    if (!stage.set) {
      const groundMeta = (assets.meta && assets.meta.ground) || groundDefault();
      if (!groundImg) assets.missing.push("ground.png");
      assets.ground = groundImg || makeGroundPlaceholder(groundMeta);
    }
    // ハリボテ版: 通り全体の一枚絵（昼／夜）。無ければ仮の絵をコードで描く
    if (stage.set) {
      const name = NIGHT ? (stage.set.imgNight || stage.set.img) : stage.set.img;
      const img = await loadImage(`${STREET_DIR}${name}${BUST}`);
      if (!img) assets.missing.push(name);
      assets.set = img || (stage.ph ? makeKannonPlaceholder() : makeSetPlaceholder());
      if (NIGHT && img) {
        assets.glows.set = makeGlow(img);
        if (stage.bloom) assets.blooms.set = makeBloom(assets.glows.set, stage.bloom);
      }
    }
    // 遠景: far.img（夜は far.imgNight）があれば使う。無ければコード描画の街並み（標準版の大きさで描いて拡大）
    const farCfg = stage.far || {};
    const farW = Math.ceil(stage.width * (farCfg.parallax || BACKDROP_PARALLAX)) + VIEW_W + 4;
    const farName = NIGHT ? (farCfg.imgNight || farCfg.img) : farCfg.img;
    const farImg = farName ? await loadImage(`${STREET_DIR}${farName}${BUST}`) : null;
    assets.farSource = farImg ? "image" : "code";
    const farSrc = farImg || makeBackdrop(Math.ceil(farW / U), Math.ceil(stage.groundTop / U));
    assets.backdrop = stage.set ? null : (farImg || U !== 1 || farCfg.blur || farCfg.haze)
      ? makeFarLayer(farSrc, farW, stage.groundTop, farCfg)
      : farSrc;
    if (stage.foreground) {
      const fgImg = stage.foreground.img ? await loadImage(`${STREET_DIR}${stage.foreground.img}${BUST}`) : null;
      assets.poleTile = makePoleTile(stage.foreground, fgImg);
      assets.fgSource = fgImg ? "image" : "code";
    }

    const sheetSpecs = [["tsumugi", WALK_DIR, "tsumugi_walk"], ...stage.npcs.map((n) => [n.sheet, n.sheetDir ? ROOT + n.sheetDir : STREET_DIR, n.sheet])];
    await Promise.all(sheetSpecs.map(async ([key, dir, file]) => {
      assets.sheets[key] = await loadSheet(dir, file, CAPSULE[key] || CAPSULE.mob_obasan);
    }));

    facades = stage.facades.map((f) => ({ ...f, ...assets.facades[f.id] }));
    const facadeById = Object.fromEntries(facades.map((f) => [f.id, f]));
    doors = stage.doors.map((d) => {
      if (d.rect) {                                          // ハリボテ版: 背景に描かれたドアの位置をそのまま使う
        const [x, top, w, h] = d.rect;
        return { ...d, x, w, top, h, cx: x + w / 2 };
      }
      const f = facadeById[d.facade];
      const [dx, dy, dw, dh] = f.geo.door;
      const top = stage.groundTop - f.geo.h + dy;
      return { ...d, x: f.x + dx, w: dw, top, h: dh, cx: f.x + dx + dw / 2 };
    });
    // 鳩・猫（観音堂）: pigeon.png / cat.png（コマの並びは street_assets.json）。無ければ仮のドット絵
    if (stage.pigeons) assets.pigeon = await loadCritter("pigeon", PIGEON_FRAMES, PIX_PAL);
    if (stage.objects.some((o) => o.creature === "cat")) assets.cat = await loadCritter("cat", CAT_FRAMES, CAT_PAL);
    objects = stage.objects.map((o) => {
      let art = assets.props[o.img];
      if (o.creature === "cat") art = makeCanvas(...assets.cat.cell);
      else if (!o.img) art = makeCanvas(...(o.hit || [S(16), S(16)]));   // 背景に描かれた物を「しらべる」だけの場所
      return { ...o, art, seen: 0 };
    });
    npcs = stage.npcs.map((n) => ({
      ...n, homeDir: n.dir, heading: n.dir === "left" ? -1 : 1, frame: 0, animT: 0, moving: false,
      talking: false, talked: 0, pauseUntil: 0, nextPause: 3 + rnd() * 4, waitT: 0, restoreAt: 0,
    }));
    initPigeons();
    $("#travel-hint").textContent = stage.travelHint || "入ったことのある店の前へ移動できます（X: 閉じる）";

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

  async function loadCritter(name, frames, pal) {
    const meta = assets.meta && assets.meta[name];
    const img = meta ? await loadImage(`${STREET_DIR}${name}.png${BUST}`) : null;
    if (!img) {
      assets.missing.push(`${name}.png`);
      return makePixSheet(frames, pal);
    }
    return { img, cell: meta.cell, anchor: meta.anchor, frames: meta.frames, source: "image" };
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
  // 歩ける範囲: 歩道の帯（walk）＋ 本堂の石段のような追加の矩形（walkExtra・観音堂）
  const walkRects = () => [stage.walk, ...(stage.walkExtra || [])];
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  function onWalk(x, y) {
    const rs = walkRects();
    return [x - FOOT_HALF_W, x + FOOT_HALF_W].every((px) => rs.some((r) => inRect(r, px, y)));
  }
  // いちばん近い歩ける位置（タップ先・近づく先）
  function clampWalk(x, y) {
    let best = null, bestD = Infinity;
    for (const r of walkRects()) {
      const cx = clamp(x, r.x0 + FOOT_HALF_W, r.x1 - FOOT_HALF_W), cy = clamp(y, r.y0, r.y1);
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    return best;
  }
  function blocked(x, y, who) {
    if (!onWalk(x, y)) return true;
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
      if (!o.text && !o.action) continue;
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
    else if (it.ref.action) doAction(it.ref);
    else look(it.ref);
  }
  function look(o) {
    const lines = o.seen > 0 && o.textAgain ? o.textAgain : o.text;
    o.seen++;
    say(lines);
  }
  // タップした所にあるもの（人 → 物 → 入口 の順に優先）
  function hitTest(wx, wy) {
    for (const n of npcs) {
      const sh = assets.sheets[n.sheet];
      if (Math.abs(wx - n.x) <= sh.cell[0] / 3 && wy >= n.y - sh.anchor[1] && wy <= n.y + S(2)) return { kind: "npc", id: n.id, ref: n };
    }
    for (const o of objects) {
      if (!o.text && !o.action) continue;
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
    return clampWalk(hit.ref.x, hit.ref.y + S(6));
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
    if (mode === "walk" || mode === "menu") {
      updateNpcs(dt, now);
      updatePigeons(dt);
      updateSmoke(dt);
    }
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

  // ---------------------------------------------------------------- 鳩（観音堂・AA14）
  // 地面では立つ・歩く・ついばむを繰り返す。人が近づくと飛び立つ（走ると遠くから逃げ、じっとしていると足元まで寄ってくる）。
  // 一羽が飛ぶと近くの鳩もつられて飛ぶ。屋根（perches）に止まるか、画面の外へ飛んでいき、しばらくして人がいなければ舞い戻る
  const pigeons = [];
  const PG = { walk: 9, fly: 120, rise: 60, near: 40 };     // 標準版のドット/秒・ドット
  function initPigeons() {
    pigeons.length = 0;
    const cfg = stage.pigeons;
    if (!cfg) return;
    for (const f of cfg.flocks) {
      for (let i = 0; i < f.count; i++) {
        pigeons.push({
          flock: f, x: f.x0 + rnd() * (f.x1 - f.x0), y: f.y0 + rnd() * (f.y1 - f.y0), z: 0, vx: 0, vy: 0, vz: 0,
          state: "ground", face: rnd() < 0.5 ? -1 : 1, act: "stand", actT: rnd() * 1.5, frame: "stand", frameT: 0,
          drift: 0, scareIn: -1, scareFrom: null, timer: 0, path: null, flaps: 0,
        });
      }
    }
    // 夜は屋根で休んでいて降りてこない（近づいても飛ばない）
    if (NIGHT && cfg.perches && cfg.perches.length) {
      pigeons.forEach((pg, i) => {
        const p = cfg.perches[i % cfg.perches.length];
        pg.state = "perch";
        pg.timer = Infinity;
        pg.x = p.x0 + rnd() * (p.x1 - p.x0);
        pg.z = pg.y - p.y;
      });
    }
  }
  const randIn = ([a, b]) => a + rnd() * (b - a);
  // 鳩が怖がる相手と距離。走る人 70・歩く人 34・立ち止まった人 12（標準版のドット）。歩いている通行人も少し
  function threatNear(pg) {
    const list = [];
    if (mode === "walk" || mode === "menu") {
      list.push({ x: player.x, y: player.y, r: S(player.running ? 70 : player.moving ? 34 : 12) });
    }
    for (const n of npcs) if (n.moving) list.push({ x: n.x, y: n.y, r: S(24) });
    let best = null;
    for (const t of list) {
      const d = Math.hypot(pg.x - t.x, (pg.y - t.y) * 1.5);
      if (d < t.r * 1.8 && (!best || d / t.r < best.k)) best = { ...t, d, k: d / t.r };
    }
    return best;
  }
  function flyPath(pg, sx, sy, ex, ey, gy, to, lift) {
    const dist = Math.hypot(ex - sx, ey - sy);
    pg.path = { sx, sy, ex, ey, cx: (sx + ex) / 2, cy: Math.min(sy, ey) - lift, gy, to, t: 0, dur: clamp(dist / (PG.fly * U), 0.7, 2.6) };
    pg.state = "fly";
    if (Math.abs(ex - sx) > 1) pg.face = ex > sx ? 1 : -1;
  }
  function takeOff(pg, from) {
    const cfg = stage.pigeons;
    const dir = Math.sign(pg.x - from.x) || (rnd() < 0.5 ? -1 : 1);
    pg.face = dir;
    pg.scareIn = -1;
    pg.flaps = 0;
    // 近くの鳩もつられて飛ぶ（少し遅れて）
    for (const q of pigeons) {
      if (q === pg || q.state !== "ground" || q.scareIn >= 0) continue;
      if (Math.hypot(q.x - pg.x, q.y - pg.y) < S(PG.near)) { q.scareIn = 0.06 + rnd() * 0.3; q.scareFrom = from; }
    }
    const perches = (cfg.perches || []).filter((p) => Math.sign((p.x0 + p.x1) / 2 - pg.x) === dir || rnd() < 0.3);
    if (perches.length && rnd() < (cfg.perchChance ?? 0.5)) {
      const p = perches[Math.floor(rnd() * perches.length)];
      flyPath(pg, pg.x, pg.y, p.x0 + rnd() * (p.x1 - p.x0), p.y, pg.y, "perch", S(26));
      return;
    }
    pg.state = "fly";
    pg.path = null;
    pg.vx = dir * PG.fly * U * (0.8 + rnd() * 0.4);
    pg.vy = -S(10) * rnd();
    pg.vz = PG.rise * U * (0.7 + rnd() * 0.5);
  }
  // 舞い戻る先: 群れの場所のうち、人から離れた所
  function landingSpot(f) {
    for (let i = 0; i < 8; i++) {
      const x = f.x0 + rnd() * (f.x1 - f.x0), y = f.y0 + rnd() * (f.y1 - f.y0);
      if (Math.hypot(x - player.x, (y - player.y) * 1.5) > S(60)) return { x, y };
    }
    return null;
  }
  const playerFarFrom = (x) => mode !== "walk" || Math.abs(player.x - x) > S(90);
  function updatePigeons(dt) {
    const cfg = stage.pigeons;
    if (!cfg) return;
    for (const pg of pigeons) {
      pg.frameT += dt;
      if (pg.state === "ground") {
        const th = threatNear(pg);
        if (th && th.k < 1 && pg.scareIn < 0) { pg.scareIn = rnd() * 0.12; pg.scareFrom = th; }
        if (pg.scareIn >= 0) {
          pg.scareIn -= dt;
          if (pg.scareIn < 0) takeOff(pg, pg.scareFrom);
          continue;
        }
        if (th && pg.act !== "walk") {                       // まだ遠いけど気になる → 歩いて離れる
          pg.act = "walk";
          pg.actT = 0.5 + rnd() * 0.6;
          pg.face = Math.sign(pg.x - th.x) || pg.face;
        }
        pg.actT -= dt;
        if (pg.actT <= 0) {
          const r = rnd();
          if (r < 0.45) { pg.act = "peck"; pg.actT = 0.8 + rnd(); }
          else if (r < 0.8) {
            pg.act = "walk";
            pg.actT = 0.4 + rnd();
            if (rnd() < 0.3) pg.face *= -1;
            pg.drift = (rnd() - 0.5) * S(6);
          } else { pg.act = "stand"; pg.actT = 0.5 + rnd() * 1.1; }
        }
        if (pg.act === "walk") {
          const f = pg.flock;
          pg.x += pg.face * PG.walk * U * dt;
          pg.y = clamp(pg.y + pg.drift * dt, f.y0, f.y1);
          if (pg.x < f.x0 - S(20)) pg.face = 1;
          if (pg.x > f.x1 + S(20)) pg.face = -1;
          pg.frame = Math.floor(pg.frameT / 0.14) % 2 ? "walk" : "stand";
        } else if (pg.act === "peck") {
          pg.frame = Math.floor(pg.frameT / 0.18) % 2 ? "peck2" : "peck1";
        } else pg.frame = "stand";
      } else if (pg.state === "fly") {
        const P = pg.path;
        if (P) {
          P.t = Math.min(1, P.t + dt / P.dur);
          const t = P.t, u = 1 - t;
          const bx = u * u * P.sx + 2 * u * t * P.cx + t * t * P.ex;
          const by = u * u * P.sy + 2 * u * t * P.cy + t * t * P.ey;
          pg.x = bx;
          pg.y = P.gy;
          pg.z = P.gy - by;
          const gliding = P.to === "ground" && t > 0.25 && t < 0.8;
          pg.frame = gliding ? "fly2" : ["fly1", "fly2", "fly3", "fly4"][Math.floor(pg.frameT / 0.07) % 4];
          if (t >= 1) {
            pg.path = null;
            if (P.to === "perch") { pg.state = "perch"; pg.timer = randIn(cfg.returnSec || [7, 13]); pg.frame = "stand"; }
            else { pg.state = "ground"; pg.z = 0; pg.act = "stand"; pg.actT = 0.4 + rnd() * 0.6; pg.frame = "stand"; }
          }
        } else {
          pg.x += pg.vx * dt;
          pg.y += pg.vy * dt;
          pg.z += pg.vz * dt;
          pg.vz += S(30) * dt;
          pg.frame = ["fly1", "fly2", "fly3", "fly4"][Math.floor(pg.frameT / 0.07) % 4];
          if (pg.y - pg.z < -S(24) || pg.x < -S(30) || pg.x > stage.width + S(30)) {
            pg.state = "away";
            pg.timer = randIn(cfg.returnSec || [7, 13]);
          }
        }
      } else if (pg.state === "perch") {
        pg.timer -= dt;
        pg.frame = Math.floor(pg.frameT / 1.3) % 3 === 2 ? "peck1" : "stand";
        if (pg.frameT % 4 < dt) pg.face *= -1;
        if (pg.timer <= 0) {
          const spot = landingSpot(pg.flock);
          if (spot && playerFarFrom(spot.x)) flyPath(pg, pg.x, pg.y - pg.z, spot.x, spot.y, spot.y, "ground", S(8));
          else pg.timer = 1 + rnd();
        }
      } else if (pg.state === "away") {
        pg.timer -= dt;
        if (pg.timer <= 0) {
          const spot = landingSpot(pg.flock);
          if (spot && playerFarFrom(spot.x)) {
            const from = rnd() < 0.5 ? -1 : 1;
            flyPath(pg, spot.x + from * S(150), -S(20), spot.x, spot.y, spot.y, "ground", -S(30));
          } else pg.timer = 1 + rnd();
        }
      }
    }
  }

  // ---------------------------------------------------------------- 煙・小さな演出（観音堂）
  const smoke = [];                 // 常香炉の煙 { x, y, t, life, vx, vy, seed }
  const effects = [];               // 賽銭の放物線・「チャリン」など { kind, t, dur, ... }
  let prayDim = null;               // 手を合わせている間、画面を少し暗くする { t, dur }
  let smokeT = 0;
  function updateSmoke(dt) {
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = 0.16;
      for (const o of objects) {
        if (!o.smoke) continue;
        smoke.push({ x: o.x + (rnd() - 0.5) * S(8), y: o.y - o.art.height + S(3), t: 0, life: 2.4 + rnd() * 1.2,
          vx: (rnd() - 0.5) * S(3), vy: -S(9), seed: rnd() * 6 });
      }
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.t += dt;
      p.x += (p.vx + Math.sin(p.t * 1.7 + p.seed) * S(3)) * dt;
      p.y += p.vy * dt;
      if (p.t > p.life) smoke.splice(i, 1);
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].t += dt;
      if (effects[i].t > effects[i].dur) effects.splice(i, 1);
    }
    if (prayDim) {
      prayDim.t += dt;
      if (prayDim.t > prayDim.dur) prayDim = null;
    }
  }
  const later = (ms, fn) => setTimeout(fn, ms);
  const headY = () => player.y - assets.sheets.tsumugi.anchor[1] * 0.7;
  function doAction(o) {
    if (o.action === "pray") pray(o);
    else if (o.action === "smoke") waftSmoke(o);
    else if (o.action === "omikuji") drawOmikuji(o);
    else look(o);
  }
  // お参り: 賽銭を投げる → チャリン → 手を合わせる（画面が少し暗くなる）→ ひとこと。お寺なので拍手はしない
  let lastPray = -1;
  function pray(o) {
    busy = true;
    player.dir = "up";
    effects.push({ kind: "coin", t: 0, dur: 0.45, x0: player.x, y0: headY(), x1: o.x, y1: o.y - o.art.height + S(2) });
    later(450, () => effects.push({ kind: "pop", t: 0, dur: 1.0, text: "チャリン", x: o.x, y: o.y - o.art.height - S(6) }));
    later(800, () => { prayDim = { t: 0, dur: 1.7 }; });
    later(2300, () => {
      busy = false;
      save.visited[`${stage.id}_pray`] = true;
      persist();
      const lines = stage.prayLines || ["（……）"];
      let i = Math.floor(rnd() * lines.length);
      if (i === lastPray && lines.length > 1) i = (i + 1) % lines.length;
      lastPray = i;
      say(["お賽銭を入れて、手を合わせた。", lines[i]]);
    });
  }
  // 常香炉: 煙を手で招いて浴びる
  function waftSmoke(o) {
    busy = true;
    player.dir = quantizeDir(o.x - player.x, o.y - player.y, player.dir);
    const top = o.y - o.art.height + S(3);
    for (let i = 0; i < 14; i++) {
      later(i * 50, () => {
        const k = 0.9 + rnd() * 0.5;
        smoke.push({ x: o.x + (rnd() - 0.5) * S(8), y: top, t: 0, life: 1.1 * k, seed: rnd() * 6,
          vx: (player.x - o.x) / (1.1 * k) * 0.9, vy: (headY() - top) / (1.1 * k) * 0.9 });
      });
    }
    later(1000, () => { busy = false; look(o); });
  }
  // おみくじ: 筒を振って1本引く（引くのはページを開いている間に1回）
  function drawOmikuji(o) {
    if (o.seen > 0) { say(stage.omikujiAgain || ["もう引いた。"]); return; }
    busy = true;
    player.dir = quantizeDir(o.x - player.x, o.y - player.y, player.dir);
    effects.push({ kind: "shake", t: 0, dur: 0.7, ref: o });
    effects.push({ kind: "pop", t: 0, dur: 0.9, text: "ガラガラ", x: o.x, y: o.y - o.art.height - S(6) });
    later(800, () => {
      busy = false;
      o.seen++;
      const list = stage.omikuji || [{ name: "吉", word: "" }];
      const r = list[Math.floor(rnd() * list.length)];
      o.result = r.name;
      say(["百円を入れて、おみくじを引いた。", `……${r.name}。「${r.word}」`]);
    });
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
  // 鳩・猫のシート（コマ名 → 列）。右向きの絵なので face < 0 で左右反転
  function drawCritter(sheet, frame, x, y, flip) {
    const col = sheet.frames[frame] ?? 0;
    const [cw, ch] = sheet.cell;
    const [ax, ay] = sheet.anchor;
    const top = Math.round(y) - ay;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x) - (cw - 1 - ax) + cw, top);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet.img, col * cw, 0, cw, ch, 0, 0, cw, ch);
      ctx.restore();
    } else {
      ctx.drawImage(sheet.img, col * cw, 0, cw, ch, Math.round(x) - ax, top, cw, ch);
    }
  }
  function drawShadow(x, y, w) {
    withUnit(x, y, () => {
      ctx.fillStyle = "rgba(20, 12, 24, 0.32)";
      const rx = Math.round(w / DU / 2);
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
    drawSign([f.x + sx, stage.groundTop - f.geo.h + sy, sw, sh], f.sign, f.id);
  }
  // 無地の看板の矩形 [x, y, w, h]（ワールド座標）に店名を描く
  function drawSign(rect, text, styleId) {
    if (!text) return;
    const [rx, ry, sw, sh] = rect;
    const style = {
      peppermint: ["#e2457c", "rgba(255,255,255,0.75)"],
      kemurikusa: ["#f1dfb2", "rgba(0,0,0,0.8)"],
    }[styleId] || ["#fbe9c6", "rgba(40,24,10,0.85)"];
    const x = rx + sw / 2, y = ry + sh / 2 + 0.5;
    let size = Math.min(sh * 0.72, 8 * U);
    ctx.font = `${size}px "DotGothic16", sans-serif`;
    const tw = ctx.measureText(text).width;
    if (tw > sw * 0.88) {
      size *= (sw * 0.88) / tw;
      ctx.font = `${size}px "DotGothic16", sans-serif`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const off = 0.5 * U;
    ctx.fillStyle = style[1];
    ctx.fillText(text, x + off, y + off);
    ctx.fillStyle = style[0];
    ctx.fillText(text, x, y);
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

  // ハリボテ版の夜: 一枚絵を少し暗くしてから、窓・看板・ランタンの灯り（夜の一枚絵から抜き出したもの）を戻す
  function drawSetNightLights(camX) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = stage.nightTint || "#4a5294";
    ctx.fillRect(camX, 0, VIEW_W, VIEW_H);
    ctx.globalCompositeOperation = "source-over";
    if (assets.glows.set) ctx.drawImage(assets.glows.set, camX, 0, VIEW_W, VIEW_H, camX, 0, VIEW_W, VIEW_H);
    const bloom = assets.blooms.set;
    if (bloom) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.45;
      ctx.drawImage(bloom, camX - bloom.pad, -bloom.pad, VIEW_W + bloom.pad * 2, VIEW_H + bloom.pad * 2,
        camX - bloom.pad, -bloom.pad, VIEW_W + bloom.pad * 2, VIEW_H + bloom.pad * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
  // 人と小物を別のレイヤーに描き、夜の色（nightSprite）を上から重ねてから画面に載せる
  let spriteLayer = null;
  function drawTintedItems(items, camX) {
    if (!spriteLayer || spriteLayer.width !== VIEW_W) spriteLayer = makeCanvas(VIEW_W, VIEW_H);
    const lc = spriteLayer.getContext("2d");
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, VIEW_W, VIEW_H);
    lc.imageSmoothingEnabled = false;
    lc.setTransform(1, 0, 0, 1, -camX, 0);
    ctx = lc;
    try { for (const it of items) it.draw(); } finally { ctx = mainCtx; }
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = "source-atop";             // 描いた画素の上にだけ色を重ねる
    lc.fillStyle = stage.nightSprite || "rgba(26, 30, 74, 0.4)";
    lc.fillRect(0, 0, VIEW_W, VIEW_H);
    lc.globalCompositeOperation = "source-over";
    ctx.drawImage(spriteLayer, camX, 0);
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

    const visible = (x0, x1) => x1 >= camX - S(4) && x0 <= camX + VIEW_W + S(4);
    if (assets.set) {
      // ハリボテ版: 通り全体の一枚絵をそのまま敷く（空・建物・歩道・車道まで描かれている）
      ctx.setTransform(SCALE, 0, 0, SCALE, -camX * SCALE, 0);
      ctx.drawImage(assets.set, camX, 0, VIEW_W, VIEW_H, camX, 0, VIEW_W, VIEW_H);
      if (NIGHT) drawSetNightLights(camX);     // 灯りは背景にだけ重ねる（人や小物の上に窓の光が乗らないように）
    } else {
      // 遠景（視差）
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.drawImage(assets.backdrop, Math.round(camX * farP), 0, VIEW_W, gt, 0, 0, VIEW_W, gt);
      ctx.setTransform(SCALE, 0, 0, SCALE, -camX * SCALE, 0);
      for (const w of stage.walls || []) if (visible(w.x0, w.x1)) drawWall(w);
      for (const f of facades) if (visible(f.x, f.x + f.geo.w)) ctx.drawImage(f.art, f.x, gt - f.geo.h);
      const gw = assets.ground.width;
      for (let x = Math.floor(camX / gw) * gw; x < camX + VIEW_W; x += gw) ctx.drawImage(assets.ground, x, gt);
    }
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

    // 飛んでいる鳩の影（高く上がるほど薄く）
    for (const pg of pigeons) {
      if (pg.state !== "fly" || !visible(pg.x - S(6), pg.x + S(6))) continue;
      const a = clamp(1 - pg.z / S(50), 0, 1) * 0.3;
      if (a <= 0.02) continue;
      ctx.fillStyle = `rgba(20, 12, 24, ${a.toFixed(2)})`;
      ctx.fillRect(Math.round(pg.x) - S(3), Math.round(pg.y) - 1, S(6), 2);
    }

    // 足元のyで前後を決めて描く
    const items = [];
    const now = performance.now();
    for (const o of objects) {
      if (!visible(o.x - o.art.width / 2, o.x + o.art.width / 2)) continue;
      if (o.creature === "cat") {                              // 白い猫: ふだんは寝ていて、近づくと起き上がってこちらを見る
        const near = mode === "walk" && Math.hypot(player.x - o.x, (player.y - o.y) * 1.5) < S(40);
        const breath = !near && Math.floor(now / 1400) % 2 ? 1 : 0;
        items.push({ y: o.y, draw: () => drawCritter(assets.cat, near ? "sit" : "sleep", o.x, o.y + breath, player.x < o.x) });
        continue;
      }
      if (!o.img) continue;                                    // 背景に描かれた物（絵馬掛けなど）
      const shake = effects.find((e) => e.kind === "shake" && e.ref === o);
      const dx = shake ? Math.round(Math.sin(shake.t * 40) * S(1)) : 0;
      items.push({ y: o.y, draw: () => ctx.drawImage(o.art, Math.round(o.x - o.art.width / 2) + dx, o.y - o.art.height) });
    }
    for (const pg of pigeons) {
      if (pg.state === "away" || !visible(pg.x - S(8), pg.x + S(8))) continue;
      // 屋根の鳩は一番奥、高く飛んでいる鳩は一番手前
      const sortY = pg.state === "perch" ? -1 : (pg.state === "fly" && pg.z > S(14) ? 1e9 : pg.y);
      items.push({ y: sortY, draw: () => drawCritter(assets.pigeon, pg.frame, pg.x, pg.y - pg.z, pg.face < 0) });
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
    if (assets.set && NIGHT) drawTintedItems(items, camX);
    else for (const it of items) it.draw();

    if (NIGHT) {
      if (!assets.set) {                                     // ハリボテ版は背景にだけ済ませてある（drawSetNightLights）
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = stage.nightTint || "#4a5294";
        ctx.fillRect(camX, 0, VIEW_W, VIEW_H);
        ctx.globalCompositeOperation = "source-over";
      }
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
      for (const o of objects) {
        if (!(o.img === "lamp" || o.glow) || !visible(o.x - S(30), o.x + S(30))) continue;
        const lampGlow = assets.glows[`prop_${o.img}`], lampBloom = assets.blooms[`prop_${o.img}`];
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
    // 常香炉の煙（ふわっと広がりながら薄くなる）
    for (const p of smoke) {
      if (!visible(p.x - S(8), p.x + S(8))) continue;
      const k = p.t / p.life;
      const r = Math.round(S(1.2) + k * S(3));
      ctx.fillStyle = NIGHT ? `rgba(200, 204, 228, ${(0.32 * (1 - k)).toFixed(3)})` : `rgba(246, 244, 240, ${(0.42 * (1 - k)).toFixed(3)})`;
      ctx.fillRect(Math.round(p.x) - r, Math.round(p.y) - r, r * 2, r * 2);
    }
    for (const e of effects) {
      const k = e.t / e.dur;
      if (e.kind === "coin") {                                 // お賽銭の放物線
        const x = e.x0 + (e.x1 - e.x0) * k, y = e.y0 + (e.y1 - e.y0) * k - Math.sin(Math.PI * k) * S(16);
        withUnit(x, y, () => {
          ctx.fillStyle = "#6a4a12";
          ctx.fillRect(-2, -2, 4, 4);
          ctx.fillStyle = "#f2c94a";
          ctx.fillRect(-1, -2, 2, 3);
        });
      } else if (e.kind === "pop") {
        ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1);
        drawWorldText(e.text, e.x, e.y - k * S(6), 5 * U, "#ffe9a0");
        ctx.globalAlpha = 1;
      }
    }
    for (const f of facades) if (visible(f.x, f.x + f.geo.w)) drawSignText(f);
    for (const sg of stage.signs || []) if (visible(sg.rect[0], sg.rect[0] + sg.rect[2])) drawSign(sg.rect, sg.text, sg.style);
    if (b && visible(b.x - S(8), b.x + S(20))) {
      ctx.font = `${4.5 * U}px "DotGothic16", sans-serif`;
      const half = ctx.measureText("試作範囲外").width / 2 + S(2);
      drawWorldText("試作範囲外", Math.min(b.x + S(8), stage.width - half), stage.walk.y0 - S(12), 4.5 * U, "#f2c230");
    }

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

    if (prayDim) {
      const k = prayDim.t / prayDim.dur;
      const a = 0.38 * Math.min(1, k * 4, (1 - k) * 4);
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.fillStyle = `rgba(16, 10, 24, ${a.toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
      const on = b.dataset.res === STAGE_KIND;
      b.setAttribute("aria-pressed", String(on));
      b.onclick = () => {
        if (on) return;
        const q = new URLSearchParams(location.search);
        q.delete("reset");
        if (b.dataset.res === "base") q.delete("stage");
        else q.set("stage", b.dataset.res);
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
      b.innerHTML = a.open ? `${a.label}${a.sub ? `<small>${a.sub}</small>` : ""}` : `${a.label}<small>準備中</small>`;
      b.addEventListener("click", (e) => {
        e.currentTarget.blur();
        if (busy || mode !== "map") return;
        if (!a.open) toast("このエリアは準備中です。試作で歩けるのは繁華街と古町だけ。");
        else if (a.id === stage.id) enterStreet();
        else {                                               // 別のエリア: そのステージで読み直す（?area=）
          const q = new URLSearchParams(location.search);
          q.delete("reset");
          q.set("area", a.id);
          location.search = `?${q}`;
        }
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
      { label: stage.spawnLabel || "通りの入口", go: () => placePlayer(stage.spawn.x, stage.spawn.y, stage.spawn.dir) },
      ...doors.map((d) => ({
        label: save.visited[d.id] ? `${d.label}の前` : "？？？",
        off: !save.visited[d.id],
        door: d.id,
        go: () => placeAtDoor(d, "down"),
      })),
      ...(stage.travel || []).map((t) => ({                  // 入口のない場所（観音堂の本堂の前など）。一度行ったら選べる
        label: save.visited[t.needs] ? t.label : "？？？",
        off: !save.visited[t.needs],
        door: t.id,
        go: () => placePlayer(t.x, t.y, t.dir),
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
    player.target = clampWalk(p.x, p.y);
    player.tapRun = farTarget();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointerHeld || mode !== "walk" || msg.active) return;
    const p = pointerToWorld(e);
    player.target = clampWalk(p.x, p.y);
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
      pigeons: pigeons.reduce((c, pg) => ({ ...c, [pg.state]: (c[pg.state] || 0) + 1 }), {}),
      prayDim: !!prayDim,
      missing: assets.missing.slice(),
      night: NIGHT,
    }),
    // ステージの配置（スモークテストが座標を決めるのに使う。標準版・高解像度版どちらでも同じテストを回せる）
    layout: () => ({
      id: stage.id, kind: STAGE_KIND, hd: HD, unit: U, view: [VIEW_W, VIEW_H, SCALE], width: stage.width, groundTop: stage.groundTop,
      walk: { ...stage.walk }, spawn: { ...stage.spawn }, exit: stage.exit && { ...stage.exit },
      speed: SPEED, dashMult: DASH_MULT, runTapDist: RUN_TAP_DIST, footHalfW: FOOT_HALF_W, footH: FOOT_H,
      npcRows: npcs.map((n) => ({ id: n.id, y: n.y, patrol: n.patrol || null })),
      doors: doors.map((d) => ({ id: d.id, cx: d.cx })),
      objects: objects.map((o) => ({ id: o.id, x: o.x, y: o.y, solid: o.solid || null, w: o.art.width, h: o.art.height, action: o.action || null })),
      walkExtra: (stage.walkExtra || []).map((r) => ({ ...r })),
      pigeons: pigeons.map((pg) => ({ x: Math.round(pg.x), y: Math.round(pg.y), z: Math.round(pg.z), state: pg.state })),
      critters: { pigeon: assets.pigeon ? assets.pigeon.source : null, cat: assets.cat ? assets.cat.source : null },
      npcs: npcs.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      farSource: assets.farSource, foreground: !!assets.poleTile, fgSource: assets.fgSource || null,
      setSource: stage.set ? (assets.missing.includes(NIGHT ? (stage.set.imgNight || stage.set.img) : stage.set.img) ? "placeholder" : "image") : null,
    }),
    place: (x, y, dir = "down") => {
      if (mode !== "walk") return false;
      placePlayer(x, y, dir);
      return true;
    },
    // 屋根・画面の外にいる鳩の「戻るまでの時間」を0にする（スモークテストで戻ってくるのを待たないため）
    pigeonsReturnNow: () => { for (const pg of pigeons) if (pg.state === "perch" || pg.state === "away") pg.timer = 0; },
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
