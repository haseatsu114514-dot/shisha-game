// チェキ（PEPPERMINT 初来店・ch1_minto_first の cheki_taken の show_cg effect:"cheki"）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
// どちらも 撮る → 余白が真っ白なまま出てくる → 乾いて色がつく → マーカーで落書きを書く → 会話のCGと同じ位置に置く、の順。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- 共通: 印画紙・落書きの書き順・マーカー

const CHEKI = { bg: "#2a2238", deep: "#17111f", main: "#ff7aa8", mid: "#6ee7c8", light: "#fff6e5", white: "#ffffff" };
const CW = 993, CH = 1584; // 元画像の大きさ（落書きの座標はこの画素で持つ）
const PHOTO = "inset(8.08% 10.47% 22.22% 10.57%)"; // 写真の範囲（元画像の実測）
const INK_COLOR = { p: "#fc5dac", g: "#3ac26f" }; // 落書きのインクの色（ピンク・緑）
const VN_INK = "#0b0812"; // 会話のCGの下地（base.css の --ink）
// 落書きの芯線。元画像の落書きの画素を細線化し、書き順・向きに並べ直したもの。
// 「色と太さ:x,y x,y …」を | で区切る。太さは線を隠すマスクの太さ（元の線より少し太い）
const INK = {
  line1: "p25:108,1268 105,1273 102,1275 99,1275 91,1269 87,1268 83,1269 81,1274 82,1283 86,1292 99,1307 105,1310 108,1310 111,1307 118,1294 128,1275 132,1262 132,1256 130,1253 128,1252 124,1252 118,1256 108,1268|p25:155,1313 156,1332 160,1359 162,1369 166,1380|p35:187,1314 204,1307 214,1305 221,1301 230,1300|p35:215,1291 216,1300 220,1307 222,1323 222,1334 223,1341 222,1349 219,1361 214,1366 211,1368 205,1368 202,1367 200,1364 198,1358 199,1350 202,1345 208,1340 213,1339 225,1337 236,1338 246,1342|p27:270,1291 270,1310 274,1338 279,1350 283,1354 287,1355 292,1355 297,1354 301,1351 310,1342 322,1324|p25:302,1283 307,1293|p25:319,1276 323,1281 324,1285|p31:364,1275 366,1284 370,1293 372,1302 380,1312 386,1317 386,1322 387,1325 394,1329|p31:406,1265 404,1275 400,1284 398,1292 395,1303 391,1311 387,1317 384,1326 377,1336 371,1340 366,1341 363,1340 361,1339 359,1335 357,1329 358,1319 363,1309 365,1306 369,1304 373,1304 381,1313 385,1315 388,1314 391,1311 394,1306 398,1292 400,1284 402,1279 407,1277 417,1277 426,1279 430,1281 438,1290 440,1296 441,1307 439,1318 435,1326 428,1338|p29:496,1268 493,1273 477,1294 475,1300 478,1304 508,1325|p33:547,1264 541,1285 540,1301 533,1318 539,1302 542,1299 550,1298 556,1298 559,1301 568,1314 573,1316 577,1316 583,1314 589,1309 593,1304 599,1293|p27:664,1286 662,1287 657,1286 651,1277 647,1274 642,1275 640,1280 640,1291 644,1307 650,1319 653,1323 656,1324 659,1324 662,1322 669,1312 678,1300 685,1287 685,1279 683,1277 681,1277 674,1278 664,1286",
  line2: "g33:178,1430 190,1424 200,1421 207,1416 221,1413|g33:184,1450 194,1445 205,1441 210,1436 218,1434 225,1431|g33:199,1409 205,1424 209,1448 209,1463 207,1475 203,1485 196,1493 193,1494 189,1494 186,1493 184,1492 182,1486 183,1480 186,1474 193,1468 207,1464 212,1460 235,1462|g31:255,1422 268,1418 273,1412 285,1408|g31:271,1406 266,1467 267,1473|g25:289,1431 296,1427 302,1425|g25:292,1454 302,1455 312,1452|g37:331,1402 342,1397 350,1395 358,1391 377,1386|g37:340,1415 345,1423 348,1431|g37:377,1403 374,1419|g37:333,1439 350,1431 361,1432 362,1430 362,1426 364,1424 375,1419 390,1417|g37:351,1378 352,1389 356,1398 359,1419 362,1427 361,1440 365,1449 367,1468|g37:359,1445 355,1447 352,1450 333,1477|g37:363,1437 375,1439 405,1451|g33:420,1405 426,1402 440,1397 460,1393 457,1397 454,1405 445,1423 443,1431 443,1437 445,1444 450,1449 459,1451 466,1449|g37:519,1373 519,1396 517,1404 517,1427 521,1436 523,1456|g37:495,1410 500,1405 504,1403 513,1401 516,1402 517,1403 516,1428 515,1430 509,1435 505,1443|g37:517,1414 518,1412 520,1410 528,1407 532,1405 542,1396 550,1390 556,1387 564,1386 570,1388 575,1394 576,1399 578,1413 576,1418 573,1429 567,1437 563,1440 560,1442 555,1442 552,1440 550,1434 551,1427 554,1422 560,1417 565,1415 576,1415 592,1418|g29:640,1384 638,1385 634,1384 624,1377 620,1376 616,1375 613,1377 610,1380 607,1385 607,1390 611,1403 622,1422 638,1439 642,1442 646,1443 649,1442 651,1439 663,1414 670,1395 671,1382 669,1374 667,1370 662,1367 657,1367 653,1368 648,1373 640,1384",
  sign: "p25:747,1446 751,1444 755,1444 756,1448 757,1455 756,1458 753,1465 747,1466 742,1472 741,1478 742,1480 745,1481 750,1479 753,1474 754,1470 755,1462 758,1455 769,1451 775,1448 779,1447|p25:771,1437 772,1447 770,1470|p25:796,1425 791,1455 793,1446 795,1443 799,1443 806,1448 809,1449 813,1447 817,1440|p23:825,1415 829,1421 831,1422|p23:841,1414 831,1423 830,1436 831,1439 834,1440 838,1439 846,1436|p21:756,1501 778,1486 813,1468 842,1455 857,1449 866,1447|p25:872,1463 882,1453 884,1450 885,1446 879,1440 876,1434 869,1419 867,1407 870,1397 872,1395 876,1394 880,1397 884,1403 887,1404 890,1403 897,1395 902,1392 905,1391 908,1392 912,1396 911,1406 905,1421 894,1438 890,1443 886,1445",
  leaf: "g24:782,1344 772,1328 767,1312 769,1297 775,1283 785,1270 797,1261 812,1254 828,1250 839,1250 838,1265 835,1285 830,1302 822,1318 810,1330 795,1340 782,1344|g24:776,1338 766,1322 755,1312 740,1309 722,1311 706,1317 697,1323 704,1335 716,1346 732,1353 748,1356 763,1352 778,1342|g20:783,1344 786,1356 796,1366 810,1373 821,1375|g24:775,1323 792,1334 804,1326 774,1307 778,1294 814,1317 820,1306 784,1283 792,1273 826,1293 829,1280 803,1264 818,1258 831,1266|g22:768,1342 770,1336 760,1324 754,1349 742,1349 749,1317 737,1315 730,1346 719,1341 725,1316 712,1320 709,1332|g23:725,1272 735,1284|g25:891,1269 880,1284|g21:890,1305 904,1304",
  deco: "p23:724,1386 723,1388 721,1389 715,1387 711,1387 709,1390 709,1394 711,1399 717,1406 725,1412 728,1414 730,1414 732,1411 736,1394 737,1382 735,1379 731,1378 727,1381 724,1386|p23:855,1321 855,1323 858,1326 863,1329 867,1330 863,1335 859,1343 858,1346 856,1342 847,1337 850,1333 855,1321|g23:696,1435 696,1438 698,1440 705,1444 709,1444 706,1446 705,1449 702,1455 701,1461 701,1458 699,1456 693,1452 689,1451 691,1448 694,1443 696,1435|g23:78,1381 79,1386 82,1390 87,1393 93,1394 89,1397 85,1408 84,1413 81,1410 75,1405 70,1402 73,1399 77,1390 78,1386 78,1381|p27:105,1454 97,1450 93,1449 89,1452 88,1457 91,1466 95,1474 103,1483 109,1486 112,1485 115,1480 122,1459 125,1445 124,1442 122,1440 117,1441 114,1444 109,1453 107,1454 105,1454",
  side: "p23:80,412 78,413 71,413 69,416 70,421 73,426 76,429 79,430 81,429 83,427 87,412 87,409 86,409 82,410 80,412|g23:918,358 916,359 914,358 909,352 906,351 902,352 901,356 901,364 906,380 913,390 917,393 921,388 927,373 933,352 931,348 927,347 924,349 920,357 918,358|g23:75,532 75,538 77,541 82,546 88,549 86,553 81,564 80,572 79,566 70,557 66,554 69,551 74,542 75,538 75,532|g21:916,448 917,455 920,458 925,460 922,463 919,468 918,476 918,472 916,468 911,465 907,464 910,463 914,458 916,453 916,448|p23:71,766 67,760 62,758 59,759 58,761 58,768 59,774 62,785 70,797 73,800 76,801 78,799 86,779 88,769 89,760 88,757 85,757 81,759 77,766 74,767 71,766|p23:922,751 920,751 913,748 911,749 910,752 911,758 914,765 917,770 921,772 924,771 926,767 931,753 930,750 928,749 922,751|g23:915,963 915,968 916,970 922,973 927,973 923,976 918,988 915,984 910,981 907,980 910,979 911,977 915,968 915,963|g21:77,1122 77,1124 79,1127 83,1129 87,1130 85,1132 81,1139 81,1144 77,1139 73,1137 70,1136 74,1133 77,1122|p23:921,1097 919,1099 916,1098 911,1092 908,1090 905,1091 904,1095 905,1109 909,1128 913,1136 915,1138 917,1139 919,1138 921,1136 926,1123 931,1109 935,1093 934,1087 933,1086 930,1086 926,1089 921,1097",
};

/** 一画ずつの点列と、先頭からの長さ。paths にはこの画を隠しているマスクの線が入る */
function inkStrokes(group) {
  return INK[group].split("|").map((s) => {
    const [head, body] = s.split(":");
    const pts = body.split(" ").map((p) => p.split(",").map(Number));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { col: head[0], w: Number(head.slice(1)), pts, cum, len: cum[cum.length - 1] || 1, paths: [] };
  });
}
/** 画の先頭から d の位置 */
function pointAt(s, d) {
  const { pts, cum } = s;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const k = Math.max(0, Math.min(1, (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1)));
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
}
/** 画を k（0〜1）まで書いた状態にする */
const inkTo = (s, k) => s.paths.forEach((p) => { p.style.strokeDashoffset = String((s.len + 1) * (1 - k)); });
/** ペンなしで画が自分で書かれる（トリムパス） */
const inkSelf = (s, dur, delay = 0, easing = E.out) => Promise.all(s.paths.map((p) => move(p, [{ strokeDashoffset: s.len + 1 }, { strokeDashoffset: 0 }], dur, { easing, delay })));

/** 会話のCGレイヤーと同じ位置・大きさ（vn.css の縦型チェキ: 高さ 100%-230px、上から18px） */
function chekiBox(img) {
  const h = H - 230;
  const w = Math.round(h * (img.naturalWidth / img.naturalHeight || CW / CH));
  return { left: (W - w) / 2, top: 18, width: w, height: h };
}
async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  return img;
}

let inkSerial = 0;
const CARD = [45, 72, 903, 1458]; // 白い台紙（角の丸みは10px）
const PHOTO_BOX = [105, 128, 784, 1104];
// 落書きのある領域（下の余白・左右の余白）。マスクを描き直す範囲を狭くして軽くする
const REGIONS = [[45, 1232, 903, 298], [45, 320, 62, 860], [886, 320, 62, 860]];
const pos = ([x, y, w, h]) => ({ left: `${(x / CW) * 100}%`, top: `${(y / CH) * 100}%`, width: `${(w / CW) * 100}%`, height: `${(h / CH) * 100}%` });

/** 印画紙: 影・白い台紙・写真・乳白の膜・落書き（マスクで書いたところだけ元の絵）・仕上げの一枚・光・ペンの層 */
function makePrint(url, ink, milk) {
  const film = el("div.mo-ck-film");
  const shadow = el("i.mo-ck-shadow", { style: pos(CARD) });
  const card = el("i.mo-ck-card", { style: pos(CARD) });
  const photo = el("img.mo-ck-layer", { src: url, alt: "", style: { clipPath: PHOTO } });
  const fog = el("i.mo-ck-milk", { style: { ...pos(PHOTO_BOX), background: milk } });
  const regions = REGIONS.map(([x, y, w, h]) => {
    const id = `mo-ck-ink-${++inkSerial}`;
    const g = svg("g", { fill: "none", stroke: "#fff", "stroke-linecap": "round", "stroke-linejoin": "round" });
    const area = { x, y, width: w, height: h };
    const art = svg("svg", { viewBox: `${x} ${y} ${w} ${h}`, preserveAspectRatio: "none", class: "mo-ck-ink", style: Object.entries(pos([x, y, w, h])).map(([k, v]) => `${k}:${v}`).join(";") }, [
      svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...area }, [g])]),
      svg("image", { href: url, x: 0, y: 0, width: CW, height: CH, preserveAspectRatio: "none", mask: `url(#${id})` }),
    ]);
    return { x, y, w, h, g, art };
  });
  for (const list of Object.values(ink)) for (const s of list) {
    const p = svg("path", { d: `M${s.pts.join(" L")}`, "stroke-width": s.w, "stroke-dasharray": `${s.len} ${s.len + 2}`, "stroke-dashoffset": s.len + 1 });
    const [x0, y0] = s.pts[0];
    const r = regions.find((q) => x0 >= q.x && x0 <= q.x + q.w && y0 >= q.y && y0 <= q.y + q.h) || regions[0];
    s.paths.push(p);
    r.g.append(p);
  }
  const full = el("img.mo-ck-layer", { src: url, alt: "", style: { opacity: "0" } });
  const shine = el("i.mo-ck-shine", { style: pos(CARD) });
  const top = svg("svg", { viewBox: `0 0 ${CW} ${CH}`, preserveAspectRatio: "none", class: "mo-ck-ink" });
  film.append(shadow, card, photo, fog, ...regions.map((r) => r.art), full, shine, top);
  return { film, shadow, photo, fog, full, shine, top };
}

/** 乾いて色がつく: 乳白 → 少し暗く色の薄い絵 → 色が乗る（写真の部分だけ）。終わったらフィルタを外して軽くする */
async function develop(print, ms) {
  const f = (b, c, s, sp) => ({ filter: `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${sp})` });
  move(print.fog, [{ opacity: 0.96 }, { opacity: 0.7, offset: 0.25 }, { opacity: 0.18, offset: 0.55 }, { opacity: 0 }], ms, { easing: "linear" });
  await move(print.photo, [f(1.7, 0.25, 0, 0), f(1.3, 0.5, 0.05, 0.2), { ...f(0.78, 1.18, 0.12, 0.3), offset: 0.55 }, { ...f(0.92, 1.06, 0.62, 0.1), offset: 0.8 }, f(1, 1, 1, 0)], ms, { easing: "linear" });
  [print.photo, print.fog].forEach((n) => n.getAnimations().forEach((x) => x.cancel()));
  print.fog.style.opacity = "0";
}

/** 光がすっと横切る（台紙の形だけ） */
const sweep = (print, ms = 620, delay = 0) => move(print.shine, [{ backgroundPosition: "130% 0", opacity: 1 }, { backgroundPosition: "-30% 0", opacity: 1 }], ms, { easing: E.inOut, delay });

/** マーカー（ペン先が原点、軸は上向き）。body は軸の色、trim は首の色。cap を外して書く */
function marker(body, trim, color) {
  const inks = [];
  const inked = (tag, attrs) => { const n = svg(tag, { ...attrs, fill: color }); inks.push(n); return n; };
  const L = 372;
  const sil = `M -8 -46 L -4 -6 Q 0 0 4 -6 L 8 -46 L 14 -46 L 25 -78 L 25 ${-L + 14} Q 25 ${-L} 11 ${-L} L -11 ${-L} Q -25 ${-L} -25 ${-L + 14} L -25 -78 L -14 -46 Z`;
  const shadow = svg("path", { d: sil, fill: "#1d1430", opacity: 0.2 });
  const cap = svg("g", {}, [
    inked("rect", { x: -28, y: -112, width: 56, height: 118, rx: 20 }),
    svg("rect", { x: -28, y: -78, width: 56, height: 7, fill: "#000", opacity: 0.14 }),
    svg("rect", { x: -18, y: -104, width: 9, height: 100, rx: 4.5, fill: "#fff", opacity: 0.45 }),
    svg("rect", { x: 14, y: -128, width: 9, height: 70, rx: 4.5, fill: body }), // クリップ
  ]);
  const pen = svg("g", {}, [
    inked("path", { d: "M -8 -48 L -4 -7 Q 0 0 4 -7 L 8 -48 Z" }), // フェルトのペン先
    svg("path", { d: "M -14 -44 L -25 -80 L 25 -80 L 14 -44 Z", fill: trim }), // 首
    svg("rect", { x: -25, y: -L + 22, width: 50, height: L - 100, rx: 12, fill: body }), // 軸
    inked("rect", { x: -25, y: -236, width: 50, height: 50 }), // 色の帯
    svg("rect", { x: -25, y: -228, width: 50, height: 6, fill: "#fff", opacity: 0.35 }),
    inked("rect", { x: -22, y: -L, width: 44, height: 34, rx: 12 }), // 尻栓
    svg("rect", { x: -17, y: -L + 34, width: 9, height: L - 128, rx: 4.5, fill: "#fff", opacity: 0.6 }), // 光
    svg("rect", { x: 11, y: -L + 30, width: 9, height: L - 118, rx: 4.5, fill: "#000", opacity: 0.13 }), // 陰
    cap,
  ]);
  const shade = svg("g", {}, [shadow]);
  const g = svg("g", {}, [shade, pen]);
  g.style.opacity = "0";
  const at = { x: 0, y: 0, lift: 0, ang: 30 };
  return {
    g, cap, at,
    /** 位置 x,y（ペン先）・紙からの高さ lift・傾き ang（度） */
    place(x, y, lift = at.lift, ang = at.ang) {
      Object.assign(at, { x, y, lift, ang });
      g.setAttribute("transform", `translate(${x} ${y})`);
      pen.setAttribute("transform", `translate(${lift * 0.35} ${-lift}) rotate(${ang})`);
      shade.setAttribute("transform", `translate(${10 + lift * 0.9} ${12 + lift * 0.5}) rotate(${ang})`);
    },
    setInk(c) { inks.forEach((n) => n.setAttribute("fill", c)); },
  };
}

/** 決まった時間 ms で毎フレーム f(k) を呼ぶ（k は 0→1。終わったら止まる） */
function tween(ms, f) {
  return new Promise((done) => {
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      f(k);
      if (k < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
}
const CAM = "cubic-bezier(.6,0,.2,1)"; // カメラの寄り引き（速すぎて飛ばないように少し柔らかく）
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOut = (k) => 1 - (1 - k) ** 3;

/** ペンを宙に浮かせて動かす（spin で軸をくるっと回す。半分回ったところで onHalf） */
function penHop(pen, to, ms, { lift = 26, spin = 0, ang = pen.at.ang, onHalf = null } = {}) {
  const from = { ...pen.at };
  let half = false;
  return tween(ms, (k) => {
    const e = easeIO(k);
    if (!half && k >= 0.5) { half = true; onHalf?.(); }
    pen.place(from.x + (to[0] - from.x) * e, from.y + (to[1] - from.y) * e, from.lift + (lift - from.lift) * Math.sin(Math.PI * Math.min(1, k * 1.15)), from.ang + (ang - from.ang) * e + spin * e);
  }).then(() => pen.place(pen.at.x, pen.at.y, pen.at.lift, ang));
}

/** マーカーで画を順に書く。画と画の間はペンを浮かせて移る。onFrame(x, y) で毎フレームの位置を知らせる */
function writeInk(pen, list, { speed = 5.2, base = 24, hop = 9, onFrame = null } = {}) {
  const plan = [];
  let t = 0, at = [pen.at.x, pen.at.y];
  for (const s of list) {
    const a = s.pts[0];
    const d = Math.hypot(a[0] - at[0], a[1] - at[1]);
    if (d > 2) { const dur = 12 + d / hop; plan.push({ t0: t, dur, from: at, to: a, d }); t += dur; }
    const dur = base + s.len / speed;
    plan.push({ t0: t, dur, s }); t += dur;
    at = s.pts[s.pts.length - 1];
  }
  return new Promise((done) => {
    const t0 = performance.now();
    let i = 0, lx = pen.at.x, ang = pen.at.ang;
    const tick = (now) => {
      const ms = now - t0;
      while (i < plan.length && ms >= plan[i].t0 + plan[i].dur) { if (plan[i].s) inkTo(plan[i].s, 1); i++; }
      let x, y, lift = 0;
      if (i >= plan.length) [x, y] = at;
      else {
        const p = plan[i];
        const k = Math.max(0, (ms - p.t0) / p.dur);
        if (p.s) {
          // 書き始めと書き終わりは少しゆっくり
          const e = 0.55 * k + 0.45 * (0.5 - Math.cos(Math.PI * k) / 2);
          inkTo(p.s, e);
          [x, y] = pointAt(p.s, e * p.s.len);
        } else {
          const e = easeIO(k);
          x = p.from[0] + (p.to[0] - p.from[0]) * e;
          y = p.from[1] + (p.to[1] - p.from[1]) * e;
          lift = Math.sin(Math.PI * k) * Math.min(34, 8 + p.d * 0.12);
        }
      }
      // 横に走るほど少し寝かせる（追従の揺れ）
      ang += (30 + Math.max(-9, Math.min(9, (x - lx) * 0.9)) - ang) * 0.25;
      lx = x;
      pen.place(x, y, lift, ang);
      onFrame?.(x, y);
      if (i < plan.length) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
}

/** キャップを外す: ペン先の方へ抜けて、回りながら飛んでいく */
function capOff(pen, root, x, y, color) {
  SE.tick();
  burst(root, x, y, { n: 7, r0: 56, r1: 150, color, width: 12, dur: 400 });
  return move(pen.cap, [
    { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1 },
    { transform: "translate(0px, 46px) rotate(0deg)", opacity: 1, offset: 0.25 },
    { transform: "translate(150px, 260px) rotate(160deg)", opacity: 0 },
  ], 420, { easing: E.out });
}

// ---------------------------------------------------------------- a: チェキ: ファインダー → シャッター → 下から出てくる → 振って乾かす → 寄ってマーカーで書く → 引いて仕上げ

/** placeCg(): 書き終えた瞬間に会話のCGを同じ位置へ置く（重ねたフィルムを外す前に呼ぶ） */
export async function a(url, placeCg = null) {
  const P = pick(CHEKI);
  const mono = P.main === "#6b4fb0";
  const img = await loadImage(url);
  await stagePlay("cheki", async (node) => {
    const box = chekiBox(img);
    const kx = box.width / CW, ky = box.height / CH;
    const back = backdrop(P.bg);
    back.style.opacity = "0";
    const stripes = el("div.mo-ck-stripes", { style: { "--c": P.main } }, [el("i")]);
    const glow = el("i.mo-ck-glow", { style: { "--c": P.mid } });
    const cam = el("div.mo-ck-cam");
    const ink = { line1: inkStrokes("line1"), line2: inkStrokes("line2"), sign: inkStrokes("sign"), leaf: inkStrokes("leaf"), deco: inkStrokes("deco"), side: inkStrokes("side") };
    const print = makePrint(url, ink, mono ? "linear-gradient(160deg, #efeaf9, #d9d0ee)" : "linear-gradient(160deg, #eef2f3, #d5dde2)");
    const { film } = print;
    Object.assign(film.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, visibility: "hidden" }); // 出てくるまで描かない
    cam.append(film);
    const pen = marker(mono ? P.light : "#fffaf2", mono ? P.mid : "#d9d4cf", INK_COLOR.p);
    print.top.append(pen.g);
    const art = stageSvg();
    const fxArt = stageSvg();
    // ファインダー: 四隅のカギと、合焦する小さな枠
    const fx = 400, fy = 40, fw = 480, fh = 470, k = 70;
    const corners = [[fx, fy + k, fx, fy, fx + k, fy], [fx + fw - k, fy, fx + fw, fy, fx + fw, fy + k], [fx, fy + fh - k, fx, fy + fh, fx + k, fy + fh], [fx + fw - k, fy + fh, fx + fw, fy + fh, fx + fw, fy + fh - k]]
      .map(([x1, y1, x2, y2, x3, y3]) => svg("path", { d: `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`, fill: "none", stroke: P.white, "stroke-width": 7, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }));
    const focus = svg("rect", { x: 610, y: 200, width: 64, height: 46, fill: "none", stroke: P.white, "stroke-width": 4, class: "tr-scale" });
    art.append(...corners, focus);
    const blades = stageSvg([...Array(6)].map((_, i) => svg("g", { transform: `rotate(${i * 60 + 18} ${W / 2} ${H / 2})` }, [
      svg("rect", { x: W / 2 - 1000, y: H / 2 - 760 - 1100, width: 2000, height: 1100, fill: i % 2 ? P.deep : P.bg, stroke: P.main, "stroke-width": 3, class: "mo-blade" }),
    ])));
    const flash = el("div.mo-ck-flash");
    node.append(back, stripes, glow, art, cam, fxArt, blades, flash);
    // 1. ファインダーの四隅が描かれ、枠が迷ってから合う
    corners.forEach((c, i) => move(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 240, { easing: E.out, delay: i * 30 }));
    await move(focus, [{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(0.85)", opacity: 1, offset: 0.5 }, { transform: "scale(1.1)", offset: 0.75 }, { transform: "scale(1)" }], 440, { easing: E.out });
    focus.setAttribute("stroke", P.mid);
    ring(art, 642, 223, { r: 70, color: P.mid, width: 5, dur: 360 });
    await sleep(110);
    // 2. シャッターの羽根が閉じてフラッシュ
    SE.punch();
    await Promise.all([...blades.querySelectorAll(".mo-blade")].map((b) => move(b, [{ transform: "translate(0,0)" }, { transform: "translate(0, 770px)" }], 130, { easing: E.in })));
    back.style.opacity = "1";
    art.replaceChildren();
    move(flash, [{ opacity: 1 }, { opacity: 0 }], 360, { easing: E.out });
    move(blades, [{ opacity: 1 }, { opacity: 0 }], 130);
    move(stripes, [{ opacity: 0 }, { opacity: 1 }], 500);
    move(glow, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }], 700, { easing: E.out });
    // 3. 余白の真っ白なフィルムが下から伸びて出てくる（写真はまだ乳白）
    SE.pour();
    film.style.visibility = "";
    await move(film, [
      { transform: "translateY(122%) rotate(-8deg) scale(0.92, 1.14)" },
      { transform: "translateY(-3%) rotate(1deg) scale(1.02, 0.97)", offset: 0.7 },
      { transform: "translateY(0) rotate(-3deg) scale(1, 1)" },
    ], 480, { easing: E.out });
    burst(fxArt, W / 2, box.top + box.height + 4, { n: 7, r0: 26, r1: 96, color: P.light, width: 5, turn: Math.PI / 7 });
    // 4. 振って乾かす（下の端を持って左右に3回。尾を引く線）。乳白 → 少し暗く → 色が乗る
    const dev = develop(print, 1350);
    const px = box.left + box.width / 2, py = box.top + box.height;
    const swish = (dir, delay) => {
      for (let i = 0; i < 3; i++) {
        const R = 560 - i * 56;
        const a0 = -dir * (21 + i * 1.5) * (Math.PI / 180), a1 = -dir * (40 - i * 3) * (Math.PI / 180);
        const pt = (t) => `${px + R * Math.sin(t)} ${py - R * Math.cos(t)}`;
        const arc = svg("path", { d: `M ${pt(a1)} A ${R} ${R} 0 0 ${dir > 0 ? 1 : 0} ${pt(a0)}`, fill: "none", stroke: P.light, "stroke-width": 6 - i, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
        fxArt.append(arc);
        move(arc, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 320, { easing: E.out, delay: delay + i * 30 }).then(() => arc.remove());
      }
    };
    swish(1, 80); swish(-1, 270); swish(1, 450);
    move(film, [
      { transform: "translate(0px, 0px) rotate(-3deg)" },
      { transform: "translate(16px, -8px) rotate(7deg)", offset: 0.17 },
      { transform: "translate(-18px, -9px) rotate(-8deg)", offset: 0.36 },
      { transform: "translate(14px, -6px) rotate(6deg)", offset: 0.55 },
      { transform: "translate(-4px, -1px) rotate(-1.5deg)", offset: 0.76 },
      { transform: "translate(0px, 0px) rotate(0deg)" },
    ], 1000, { easing: "cubic-bezier(.45,0,.4,1)" });
    [[-34, 90], [box.width + 30, 200], [-26, 330]].forEach(([dx, dy], i) => twinkle(fxArt, box.left + dx, box.top + dy, { color: P.light, size: 13, delay: 820 + i * 120 }));
    await sleep(1020);
    // 5. 色が乗りきる間に下の余白へ寄る。ペンが画面の外から入ってきてキャップを外す
    const Z = 3;
    const camAt = (cx, cy, sx = W / 2, sy = 400) => `translate(${sx - Z * (box.left + cx * kx)}px, ${sy - Z * (box.top + cy * ky)}px) scale(${Z})`;
    const first = ink.line1[0].pts[0];
    const camIn = [330, 1300];
    move(cam, [{ transform: "translate(0px, 0px) scale(1)" }, { transform: camAt(...camIn) }], 600, { easing: CAM });
    move(stripes, [{ transform: "scale(1)" }, { transform: "scale(1.18)" }], 600, { easing: CAM });
    move(glow, [{ transform: "scale(1)" }, { transform: "scale(1.5)" }], 600, { easing: CAM });
    await sleep(200);
    pen.place(first[0] + 760, first[1] + 620, 70, 52);
    pen.g.style.opacity = "1";
    await penHop(pen, [first[0] + 26, first[1] - 36], 320, { lift: 30, ang: 30 });
    capOff(pen, print.top, first[0] + 26, first[1] - 36, INK_COLOR.p);
    await sleep(110);
    await dev;
    await penHop(pen, first, 80, { lift: 0 });
    // 6. ピンクで1行目 → 回して緑に持ち替えて2行目 → ピンクで名前（カメラはペンを少し追う）
    const drift = (from, to, ms) => move(cam, [{ transform: camAt(...from) }, { transform: camAt(...to) }], ms, { easing: "ease-in-out" });
    const swap = async (to, color, camFrom, camTo) => {
      move(cam, [{ transform: camAt(...camFrom) }, { transform: camAt(...camTo) }], 320, { easing: CAM });
      ring(print.top, pen.at.x, pen.at.y - 190, { r: 120, color: P.white, width: 10, dur: 360 });
      SE.tick();
      await penHop(pen, to, 250, { lift: 40, spin: 360, onHalf: () => pen.setInk(color) });
    };
    drift(camIn, [460, 1305], 700);
    await writeInk(pen, ink.line1, { speed: 5, base: 16, hop: 12 });
    await swap(ink.line2[0].pts[0], INK_COLOR.g, [460, 1305], [330, 1430]);
    drift([330, 1430], [520, 1430], 760);
    await writeInk(pen, ink.line2, { speed: 7.2, base: 11, hop: 16 });
    await swap(ink.sign[0].pts[0], INK_COLOR.p, [520, 1430], [740, 1440]);
    await writeInk(pen, ink.sign, { speed: 6, base: 13, hop: 16 });
    // 7. ペンが抜け、引きながら葉っぱ・ハート・きらめきが次々に描かれる
    penHop(pen, [pen.at.x + 700, pen.at.y - 560], 300, { lift: 60, ang: 64 }).then(() => { pen.g.style.opacity = "0"; });
    await sleep(90);
    SE.whoosh();
    move(cam, [{ transform: camAt(740, 1440) }, { transform: "translate(0px, 0px) scale(1)" }], 620, { easing: CAM });
    move(stripes, [{ transform: "scale(1.18)" }, { transform: "scale(1)" }], 620, { easing: CAM });
    move(glow, [{ transform: "scale(1.5)" }, { transform: "scale(1)" }], 620, { easing: CAM });
    ink.leaf.forEach((s, i) => inkSelf(s, 230, 40 + i * 36));
    ink.deco.forEach((s, i) => inkSelf(s, 210, 120 + i * 55));
    ink.side.forEach((s, i) => inkSelf(s, 200, 220 + i * 36));
    await sleep(580);
    // 8. 仕上げ: 光が横切り、四隅にきらめき。背景を会話のCGと同じ黒へ戻し、同じ位置にCGを置く
    print.full.style.opacity = "1";
    SE.perfect();
    sweep(print, 520);
    ring(fxArt, box.left + box.width - 40, box.top + box.height - 60, { r: 60, color: P.main, width: 6, dur: 440 });
    twinkle(fxArt, box.left + box.width - 18, box.top + box.height - 92, { color: P.main, size: 22 });
    twinkle(fxArt, box.left + 16, box.top + box.height - 30, { color: P.mid, size: 16, delay: 80 });
    twinkle(fxArt, box.left + box.width + 8, box.top + 40, { color: P.light, size: 14, delay: 150 });
    move(film, [{ transform: "scale(1)" }, { transform: "scale(1.035)", offset: 0.35 }, { transform: "scale(1)" }], 400, { easing: E.out });
    await sleep(80);
    move(stripes, [{ opacity: 1 }, { opacity: 0 }], 300);
    move(glow, [{ opacity: 1 }, { opacity: 0 }], 300);
    move(print.shadow, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(back, [{ backgroundColor: P.bg }, { backgroundColor: VN_INK }], 320);
    placeCg?.();
  });
}

// ---------------------------------------------------------------- b: チェキ: カメラ本体 → 絞りとフラッシュ → 裏向きで出てきて、くるっと返って飛んでくる → あおいで乾かす → ルーペの拡大でマーカーを追う → 戻して仕上げ

const CHEKI_B = { bg: "#c8f2e4", deep: "#21413b", main: "#ff7aa8", mid: "#86dfc4", light: "#fff6e8", white: "#ffffff" };
const CHEKI_B_MONO = { bg: "#ded3f7", deep: "#241a4a", main: "#6b4fb0", mid: "#9a82d8", light: "#f7f3ff", white: "#ffffff" };

/** 平らなインスタントカメラ（中心が原点。幅360・高さ250）。iris(k) で絞りを 0=開く〜1=閉じる */
function cameraArt(P) {
  const lx = 46, ly = 22; // レンズの中心
  const clip = `mo-ck-lens-${++inkSerial}`;
  const blades = [...Array(6)].map((_, i) => svg("path", { d: "M 0 0 L 84 0 L 84 76 L 0 76 Z", fill: i % 2 ? P.mid : P.light, stroke: P.deep, "stroke-width": 2 }));
  const iris = svg("g", { "clip-path": `url(#${clip})`, transform: `translate(${lx} ${ly})` }, [svg("circle", { r: 60, fill: P.deep }), svg("circle", { cx: -18, cy: -20, r: 16, fill: P.white, opacity: 0.35 }), ...blades]);
  const flashGlass = svg("rect", { x: -150, y: -88, width: 92, height: 50, rx: 10, fill: P.light });
  const button = svg("rect", { x: 92, y: -132, width: 58, height: 26, rx: 9, fill: P.light, stroke: P.deep, "stroke-width": 3 });
  const body = svg("g", {}, [
    svg("defs", {}, [svg("clipPath", { id: clip }, [svg("circle", { r: 60 })])]),
    svg("rect", { x: -180, y: -112, width: 360, height: 252, rx: 48, fill: "#000", opacity: 0.16, transform: "translate(10 12)" }), // 影
    button,
    svg("rect", { x: -180, y: -112, width: 360, height: 252, rx: 48, fill: P.main }),
    svg("path", { d: "M -180 70 L 180 70 L 180 92 Q 180 140 132 140 L -132 140 Q -180 140 -180 92 Z", fill: "#000", opacity: 0.12 }),
    svg("rect", { x: -96, y: -112, width: 192, height: 12, rx: 6, fill: P.deep }), // 取り出し口
    flashGlass,
    ...[0, 1, 2].map((i) => svg("line", { x1: -140 + i * 22, y1: -46, x2: -118 + i * 22, y2: -80, stroke: P.white, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 })),
    svg("rect", { x: 104, y: -88, width: 44, height: 34, rx: 9, fill: P.deep }), // ファインダー
    svg("circle", { cx: lx, cy: ly, r: 98, fill: P.light }),
    svg("circle", { cx: lx, cy: ly, r: 80, fill: P.deep }),
    svg("circle", { cx: lx, cy: ly, r: 70, fill: "none", stroke: P.mid, "stroke-width": 4 }),
    iris,
    // ミントの葉のしるし
    svg("path", { d: "M -128 92 C -128 62, -98 46, -78 50 C -76 74, -96 96, -128 92 Z", fill: P.light }),
    svg("path", { d: "M -124 88 L -88 58", stroke: P.main, "stroke-width": 3, "stroke-linecap": "round" }),
  ]);
  const inner = svg("g", {}, [body]);
  inner.style.transformBox = "fill-box";
  inner.style.transformOrigin = "50% 100%";
  const g = svg("g", { transform: `translate(${W / 2} 452)` }, [inner]);
  return {
    g, inner, button, flashGlass,
    flash: [W / 2 - 104, 452 - 63],
    iris(k) {
      blades.forEach((b, i) => b.setAttribute("transform", `rotate(${i * 60 + 24 * k}) translate(${(1 - k) * 66 - 6} ${-(1 - k) * 10})`));
    },
  };
}

/** 裏面（台紙と、写真の部分が黒い） */
function backFace(P) {
  return el("div.mo-ck-backface", {}, [
    el("i.mo-ck-card", { style: pos(CARD) }),
    el("i.mo-ck-backsheet", { style: { ...pos(PHOTO_BOX), background: `linear-gradient(150deg, ${P.deep}, #120e18)` } }),
    el("i.mo-ck-backline", { style: pos([150, 1300, 300, 26]) }),
    el("i.mo-ck-backline", { style: pos([150, 1350, 200, 26]) }),
  ]);
}

/** placeCg(): 書き終えた瞬間に会話のCGを同じ位置へ置く（重ねたフィルムを外す前に呼ぶ） */
export async function b(url, placeCg = null) {
  const P = pick(CHEKI_B, CHEKI_B_MONO);
  const mono = P.main === "#6b4fb0";
  const img = await loadImage(url);
  await stagePlay("cheki", async (node) => {
    const box = chekiBox(img);
    const kx = box.width / CW, ky = box.height / CH;
    const back = backdrop(P.bg);
    const dots = el("i.mo-ck-dots", { style: { "--c": P.white } });
    const disc = el("i.mo-ck-disc", { style: { "--c": P.mid } });
    const band = el("i.mo-ck-band", { style: { background: P.main } });
    const scene = el("div.mo-ck-scene", {}, [back, dots, disc]);
    const dark = el("i.mo-ck-dark", { style: { background: VN_INK } });
    const ink = { line1: inkStrokes("line1"), line2: inkStrokes("line2"), sign: inkStrokes("sign"), leaf: inkStrokes("leaf"), deco: inkStrokes("deco"), side: inkStrokes("side") };
    const milk = mono ? "linear-gradient(160deg, #efeaf9, #d9d0ee)" : "linear-gradient(160deg, #eef2f3, #d5dde2)";
    const print = makePrint(url, ink, milk);
    const fly = el("div.mo-ck-fly", { style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` } });
    const flip = el("div.mo-ck-flip");
    const rear = backFace(P);
    Object.assign(print.film.style, { left: "0", top: "0", width: "100%", height: "100%", visibility: "hidden" });
    flip.append(rear, print.film);
    fly.append(flip);
    fly.style.visibility = "hidden"; // 取り出し口から出るまで隠す
    const cam = cameraArt(P);
    cam.inner.style.transform = "translateY(420px)"; // 弾んで出るまで画面の下
    const camArt = stageSvg([cam.g]);
    // ルーペ: 原寸の印画紙の写しをペン先に合わせて動かす
    const LR = 236, lcx = 900, lcy = 352;
    const loupe = el("div.mo-ck-loupe", { style: { left: `${lcx - LR}px`, top: `${lcy - LR}px`, width: `${LR * 2}px`, height: `${LR * 2}px`, background: "#f7f6f5" } });
    const zoom = makePrint(url, ink, milk);
    Object.assign(zoom.film.style, { left: "0", top: "0", width: `${CW}px`, height: `${CH}px` });
    zoom.fog.style.opacity = "0";
    zoom.shadow.style.display = "none";
    loupe.append(zoom.film);
    const pens = { p: marker(mono ? P.light : "#fffaf2", mono ? P.mid : "#d9d4cf", INK_COLOR.p), g: marker(mono ? P.light : "#fffaf2", mono ? P.mid : "#d9d4cf", INK_COLOR.g) };
    zoom.top.append(pens.p.g, pens.g.g);
    const ui = stageSvg();
    const ringOut = svg("circle", { cx: lcx, cy: lcy, r: LR + 14, fill: "none", stroke: P.main, "stroke-width": 6, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, transform: `rotate(-90 ${lcx} ${lcy})` });
    const ringIn = svg("circle", { cx: lcx, cy: lcy, r: LR, fill: "none", stroke: P.white, "stroke-width": 10 });
    const callout = svg("line", { stroke: P.deep, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 });
    const reticle = svg("g", { opacity: 0 }, [svg("circle", { r: 13, fill: "none", stroke: P.deep, "stroke-width": 3 }), svg("circle", { r: 3.5, fill: P.deep })]);
    ui.append(callout, reticle, ringOut);
    const loupeRing = stageSvg([ringIn]);
    loupeRing.style.transformOrigin = `${lcx}px ${lcy}px`; // ルーペと同じ中心で拡大・縮小
    const fxArt = stageSvg();
    const flash = el("div.mo-ck-flash");
    node.append(scene, band, dark, fly, camArt, loupe, loupeRing, ui, fxArt, flash);
    loupe.style.display = "none"; // 開くまで描かない（原寸の写しは重い）
    loupeRing.style.opacity = "0";
    cam.iris(0);
    const wipe = (x) => `polygon(${x - 260}px 0, ${x}px 0, ${x - 160}px 720px, ${x - 420}px 720px)`;
    const fill = (x) => `polygon(-420px 0, ${x}px 0, ${x - 160}px 720px, -420px 720px)`;
    dark.style.clipPath = fill(-40);
    // 1. 斜めの帯が横切って背景が入れ替わり、カメラが下から弾んで出てくる
    move(band, [{ clipPath: wipe(-40) }, { clipPath: wipe(W + 460) }], 520, { easing: E.inOut });
    move(scene, [{ clipPath: fill(-40) }, { clipPath: fill(W + 440) }], 520, { easing: E.inOut, delay: 60 });
    move(camArt, [{ clipPath: fill(-40) }, { clipPath: fill(W + 440) }], 520, { easing: E.inOut, delay: 60 }); // カメラも帯の後ろから
    move(dots, [{ transform: "translate(0px, 0px)" }, { transform: "translate(-56px, -28px)" }], 6000, { easing: "linear" });
    await sleep(120);
    SE.whoosh();
    await move(cam.inner, [
      { transform: "translateY(420px) scale(0.86, 1.2)" },
      { transform: "translateY(-26px) scale(1.04, 0.95)", offset: 0.6 },
      { transform: "translateY(6px) scale(0.98, 1.03)", offset: 0.82 },
      { transform: "translateY(0px) scale(1, 1)" },
    ], 460, { easing: E.out });
    // 2. ため → ボタンを押す → 絞りが閉じて開き、フラッシュ
    move(cam.button, [{ transform: "translateY(0px)" }, { transform: "translateY(9px)", offset: 0.5 }, { transform: "translateY(0px)" }], 260, { easing: E.out });
    await move(cam.inner, [{ transform: "scale(1, 1)" }, { transform: "scale(1.05, 0.93)" }], 120, { easing: E.out });
    SE.punch();
    tween(220, (k) => cam.iris(Math.sin(Math.PI * k)));
    cam.flashGlass.setAttribute("fill", P.white);
    move(flash, [{ opacity: 0.85 }, { opacity: 0 }], 380, { easing: E.out });
    ring(fxArt, ...cam.flash, { r: 220, color: P.white, width: 14, dur: 520 });
    burst(fxArt, ...cam.flash, { n: 10, r0: 70, r1: 190, color: P.white, width: 7, dur: 460 });
    await move(cam.inner, [
      { transform: "translateY(0px) rotate(0deg) scale(1.05, 0.93)" },
      { transform: "translateY(-18px) rotate(-5deg) scale(0.97, 1.05)", offset: 0.4 },
      { transform: "translateY(0px) rotate(0deg) scale(1, 1)" },
    ], 320, { easing: E.out });
    cam.flashGlass.setAttribute("fill", P.light);
    // 3. 上の取り出し口から、裏向きのフィルムがせり出す
    SE.pour();
    const cy0 = box.top + box.height / 2, s0 = 0.42;
    const at0 = (y, extra = "") => `translate(0px, ${y - cy0}px) scale(${s0}) ${extra}`;
    fly.style.visibility = "";
    await move(fly, [{ transform: at0(452 - 112 + (box.height * s0) / 2 + 6) }, { transform: at0(452 - 112 - (box.height * s0) * 0.12) }], 380, { easing: E.out });
    await sleep(40);
    // 4. 抜けて飛び出し、くるっと表に返りながら真ん中へ。カメラは下へ落ちていく
    SE.whoosh();
    move(cam.inner, [{ transform: "translateY(0px) rotate(0deg)" }, { transform: "translateY(560px) rotate(14deg)" }], 460, { easing: E.in });
    const yUp = 452 - 112 - (box.height * s0) * 0.12;
    move(fly, [
      { transform: at0(yUp, "rotate(0deg)") },
      { transform: `translate(0px, ${yUp - 120 - cy0}px) scale(0.7) rotate(-14deg)`, offset: 0.35 },
      { transform: "translate(0px, -10px) scale(1.04) rotate(3deg)", offset: 0.78 },
      { transform: "translate(0px, 0px) scale(1) rotate(0deg)" },
    ], 560, { easing: "cubic-bezier(.3,.6,.3,1)" });
    for (let i = 0; i < 5; i++) {
      const x = W / 2 + (i - 2) * 46, len = 90 + (i % 2) * 50;
      const line = svg("line", { x1: x, y1: 330 + len, x2: x, y2: 330, stroke: mono ? P.white : P.deep, "stroke-width": 5, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, opacity: 0.55 });
      fxArt.append(line);
      move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 360, { easing: E.out, delay: 40 + i * 25 }).then(() => line.remove());
    }
    await move(flip, [{ transform: "perspective(1100px) rotateY(0deg)" }, { transform: "perspective(1100px) rotateY(90deg)" }], 220, { easing: E.in });
    rear.style.visibility = "hidden";
    print.film.style.visibility = "";
    // 5. 表に返った時から乾き始める。あおいで乾かす（上下に煽る2.5Dの揺れと風の線）。乳白 → 少し暗く → 色が乗る
    const dev = develop(print, 1050);
    await move(flip, [{ transform: "perspective(1100px) rotateY(-90deg)" }, { transform: "perspective(1100px) rotateY(0deg)" }], 320, { easing: E.out });
    const fan = (dir, delay) => {
      for (let i = 0; i < 3; i++) {
        const y = dir < 0 ? box.top - 6 - i * 16 : box.top + box.height + 10 + i * 16;
        const x0 = box.left - 40 + i * 30, x1 = box.left + box.width + 40 - i * 30;
        const line = svg("line", { x1: dir < 0 ? x1 : x0, y1: y, x2: dir < 0 ? x0 : x1, y2: y, stroke: mono ? P.main : P.deep, "stroke-width": 5 - i, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, opacity: 0.6 });
        fxArt.append(line);
        move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 300, { easing: E.out, delay: delay + i * 35 }).then(() => line.remove());
      }
    };
    fan(-1, 20); fan(1, 220); fan(-1, 420);
    move(flip, [
      { transform: "perspective(900px) rotateX(0deg)" },
      { transform: "perspective(900px) rotateX(22deg)", offset: 0.16 },
      { transform: "perspective(900px) rotateX(-18deg)", offset: 0.36 },
      { transform: "perspective(900px) rotateX(13deg)", offset: 0.56 },
      { transform: "perspective(900px) rotateX(-4deg)", offset: 0.78 },
      { transform: "perspective(900px) rotateX(0deg)" },
    ], 840, { easing: "cubic-bezier(.45,0,.4,1)" });
    [[-30, 70], [box.width + 26, 180], [-24, 320]].forEach(([dx, dy], i) => twinkle(fxArt, box.left + dx, box.top + dy, { color: mono ? P.main : P.white, size: 14, delay: 560 + i * 110 }));
    await dev;
    // 6. 写真を左へ寄せ、右にルーペが開く。ペン先の位置を印と線で結ぶ
    const sx = -306, sy = 40;
    const small = { left: box.left + sx, top: box.top + sy };
    const tip = { x: ink.line1[0].pts[0][0], y: ink.line1[0].pts[0][1] };
    const view = { x: tip.x, y: tip.y }, mark = { x: 0, y: 0 };
    const follow = (x, y, snap = false) => {
      const k = snap ? 1 : 0.22;
      view.x += (x - view.x) * k;
      view.y += (y - view.y) * k;
      zoom.film.style.transform = `translate(${LR - 40 - view.x}px, ${LR + 70 - view.y}px)`;
      const rx = small.left + x * kx, ry = small.top + y * ky;
      Object.assign(mark, { x: rx, y: ry });
      reticle.setAttribute("transform", `translate(${rx} ${ry})`);
      const d = Math.hypot(lcx - rx, lcy - ry) || 1;
      callout.setAttribute("x1", rx + ((lcx - rx) / d) * 14);
      callout.setAttribute("y1", ry + ((lcy - ry) / d) * 14);
      callout.setAttribute("x2", lcx - ((lcx - rx) / d) * (LR + 6));
      callout.setAttribute("y2", lcy - ((lcy - ry) / d) * (LR + 6));
    };
    follow(tip.x, tip.y, true);
    move(fly, [{ transform: "translate(0px, 0px)" }, { transform: `translate(${sx}px, ${sy}px)` }], 420, { easing: CAM });
    move(disc, [{ transform: "translate(0px, 0px)" }, { transform: `translate(${sx * 0.6}px, ${sy * 0.6}px)` }], 420, { easing: CAM });
    await sleep(150);
    SE.select();
    loupe.style.display = loupeRing.style.opacity = "";
    move(loupe, [{ transform: "scale(0)" }, { transform: "scale(1.06)", offset: 0.7 }, { transform: "scale(1)" }], 420, { easing: E.out });
    move(loupeRing, [{ transform: "scale(0)" }, { transform: "scale(1.06)", offset: 0.7 }, { transform: "scale(1)" }], 420, { easing: E.out });
    move(ringOut, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 520, { easing: E.out, delay: 80 });
    reticle.style.opacity = callout.style.opacity = "1";
    move(reticle, [{ opacity: 0 }, { opacity: 1 }], 200);
    move(callout, [{ opacity: 0 }, { opacity: 1 }], 200, { delay: 120 });
    // ピンクのペンが下から入り、キャップを外す
    const pp = pens.p;
    pp.place(tip.x + 420, tip.y + 520, 70, 46);
    pp.g.style.opacity = "1";
    await penHop(pp, [tip.x + 24, tip.y - 34], 260, { lift: 30, ang: 30 });
    capOff(pp, zoom.top, tip.x + 24, tip.y - 34, INK_COLOR.p);
    await sleep(80);
    await penHop(pp, [tip.x, tip.y], 70, { lift: 0 });
    // 7. ピンク → 緑 → ピンクと持ち替えて書く（使い終えたペンは右下へ抜け、次のペンが入る）
    const handoff = async (from, to, next) => {
      penHop(from, [from.at.x + 360, from.at.y + 520], 220, { lift: 30, ang: 50 });
      move(from.g, [{ opacity: 1 }, { opacity: 0 }], 160, { delay: 60 }).then(() => { from.g.style.opacity = "0"; from.g.getAnimations().forEach((x) => x.cancel()); });
      to.place(next[0] + 420, next[1] + 520, 60, 50);
      to.g.style.opacity = "1";
      SE.tick();
      await penHop(to, next, 250, { lift: 30, ang: 30 });
    };
    const track = { onFrame: (x, y) => follow(x, y) };
    await writeInk(pp, ink.line1, { speed: 5.5, base: 14, hop: 13, ...track });
    pens.g.cap.style.display = "none";
    const trackTo = ([x, y]) => tween(250, () => follow(x, y));
    trackTo(ink.line2[0].pts[0]);
    await handoff(pp, pens.g, ink.line2[0].pts[0]);
    await writeInk(pens.g, ink.line2, { speed: 7.2, base: 11, hop: 16, ...track });
    trackTo(ink.sign[0].pts[0]);
    await handoff(pens.g, pp, ink.sign[0].pts[0]);
    await writeInk(pp, ink.sign, { speed: 6, base: 13, hop: 16, ...track });
    // 8. ルーペがペン先の印へ吸い込まれて閉じ、写真が真ん中へ戻る。残りの落書きが次々に描かれる
    penHop(pp, [pp.at.x + 360, pp.at.y + 520], 240, { lift: 30, ang: 50 });
    await sleep(50);
    const { x: rx, y: ry } = mark;
    const shut = [{ transform: "translate(0px, 0px) scale(1)" }, { transform: `translate(${rx - lcx}px, ${ry - lcy}px) scale(0)` }];
    move(loupe, shut, 280, { easing: E.in });
    move(loupeRing, shut, 280, { easing: E.in });
    move(ringOut, [{ opacity: 1 }, { opacity: 0 }], 140);
    move(callout, [{ opacity: 1 }, { opacity: 0 }], 180);
    await sleep(260);
    ring(fxArt, rx, ry, { r: 50, color: P.main, width: 6, dur: 380 });
    move(reticle, [{ opacity: 1 }, { opacity: 0 }], 140);
    SE.whoosh();
    move(fly, [{ transform: `translate(${sx}px, ${sy}px)` }, { transform: "translate(0px, 0px)" }], 460, { easing: CAM });
    move(disc, [{ transform: `translate(${sx * 0.6}px, ${sy * 0.6}px)` }, { transform: "translate(0px, 0px)" }], 460, { easing: CAM });
    ink.leaf.forEach((s, i) => inkSelf(s, 220, 30 + i * 32));
    ink.deco.forEach((s, i) => inkSelf(s, 200, 100 + i * 50));
    ink.side.forEach((s, i) => inkSelf(s, 190, 160 + i * 32));
    await sleep(440);
    // 9. 仕上げ: 光が横切り、ぽんと弾む。暗い幕が斜めに横切って会話のCGと同じ黒にし、同じ位置にCGを置く
    print.full.style.opacity = "1";
    SE.perfect();
    sweep(print, 520);
    twinkle(fxArt, box.left + box.width - 16, box.top + box.height - 96, { color: P.main, size: 22 });
    twinkle(fxArt, box.left + 14, box.top + box.height - 28, { color: mono ? P.main : P.deep, size: 16, delay: 80 });
    twinkle(fxArt, box.left + box.width + 10, box.top + 36, { color: mono ? P.mid : P.white, size: 15, delay: 150 });
    move(fly, [{ transform: "scale(1)" }, { transform: "scale(1.04)", offset: 0.35 }, { transform: "scale(1)" }], 400, { easing: E.out });
    await sleep(80);
    move(print.shadow, [{ opacity: 1 }, { opacity: 0 }], 340);
    await move(dark, [{ clipPath: fill(-40) }, { clipPath: fill(W + 440) }], 380, { easing: E.inOut });
    placeCg?.();
  });
}
