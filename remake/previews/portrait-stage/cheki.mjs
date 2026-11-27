// 縦画面C案「煙の舞台」: チェキ（PEPPERMINT の初来店）を縦へ移した試作（要望台帳 VPS03）。
// 本編の流れ（data/dialogue/ch1_minto.json の ch1_minto_first: みんとの「チェキ撮っていく？」→ 返事 → cheki_taken の show_cg effect:"cheki"）をそのまま縦にした:
//   みんとの誘い → 「みんとのチェキ（1,000円）」／「今日は見送る」→ カメラを受け取る → ファインダーで「撮る」（縦の専用の札）
//   → 本編の演出 c（みんとの絵柄が斜めに差し込み、写真が下から大きく出て乾いて色がつき、ピンクと緑のマーカーで落書きを書く）→ 写真を受け取って会話の続き。
// 台詞は正本の台本をそのまま読む（photo-talk.mjs）。演出の順・時間・落書きの書き順は本編 remake/js/motions/cheki.js の c と同じ。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝店とみんと（撮る間はファインダー、撮った後はチェキが主役の大きさ）、真ん中＝台詞の帯、下（親指の届く所）＝返事の札・シャッター。
// 写真は縦長（993×1584）なので、縦の画面では本編（横）より大きく、上の画面の高さいっぱい近くで書いて、そのまま会話のCGとして残す。
// 1,000円は試作だけの財布（shop-data.mjs の WALLET）から払う。本編の所持金・思い出の品・保存には触れない。音は鳴らさない。
import { el, sleep } from "../../js/core/util.js";
import { svg, move } from "../../js/core/transition-kit.js";
import { MG_EASE as E, burst } from "../../js/core/mg-kit.js";
import { WALLET, yen } from "./shop-data.mjs";
import { loadDialogue, findDialogue, isSpeech, Telop } from "./photo-talk.mjs";

const REMAKE_IMG = new URL("../../img/", import.meta.url).href;
const CG_URL = `${REMAKE_IMG}cgs/cg_minto_first_cheki.webp`;
const STAGE_ART = `${REMAKE_IMG}ui/character_intros/graphic/bg_minto.webp`; // みんとの登場カットインの背景（本編 c の舞台と同じ）
const KEEPSAKE = { name: "みんとの初来店チェキ", cost: 1000 }; // remake/js/core/keepsakes.js の minto_first_cheki
const SET_IN = [{ clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" }, { clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" }]; // cheki.js

// ---------------------------------------------------------------- 本編 remake/js/motions/cheki.js の写し（印画紙・落書きの書き順・マーカー）
// 落書きの芯線（INK）は、CG の落書きの画素を細線化して書き順に並べ直したもの。CG を差し替えた時は本編と一緒に作り直す。
// 横の会話CGの位置（chekiBox）は縦では使わないので写していない。キャップの音（SE.tick）は鳴らさない。

const CW = 993, CH = 1584; // 元画像の大きさ（落書きの座標はこの画素で持つ）
const PHOTO = "inset(8.08% 10.47% 22.22% 10.57%)"; // 写真の範囲（元画像の実測）
const INK_COLOR = { p: "#fc5dac", g: "#3ac26f" }; // 落書きのインクの色（ピンク・緑）
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
const easeIn = (k) => k * k * k;
// b: 区間ごとのイージング（全体は linear）。弾み・揺れの途中のキーフレームで曲線が歪まないようにする
const Q_OUT = "cubic-bezier(.25,1,.5,1)", Q_OUT2 = "cubic-bezier(.33,1,.68,1)", SINE = "cubic-bezier(.37,0,.63,1)", C_IN = "cubic-bezier(.32,0,.67,0)";

/** ペンを宙に浮かせて動かす（spin で軸をくるっと回す。半分回ったところで onHalf） */
function penHop(pen, to, ms, { lift = 26, land = 0, spin = 0, ang = pen.at.ang, onHalf = null, ease = easeIO } = {}) {
  const from = { ...pen.at };
  let half = false;
  return tween(ms, (k) => {
    const e = ease(k);
    if (!half && k >= 0.5) { half = true; onHalf?.(); }
    // 現在の高さから着地点へ降ろす。以前は最後に元の高さへ戻り、書き始めの1コマで紙へ飛んでいた。
    const height = from.lift + (land - from.lift) * e + lift * Math.sin(Math.PI * k);
    pen.place(from.x + (to[0] - from.x) * e, from.y + (to[1] - from.y) * e, height, from.ang + (ang - from.ang) * e + spin * e);
  }).then(() => pen.place(to[0], to[1], land, ang));
}

/** マーカーで画を順に書く。画と画の間はペンを浮かせて移る。onFrame(x, y) で毎フレームの位置を知らせる */
// 落書き全体の速さ（旧2.4）。#1081 H06: お絵描き演出が長いという報告を受けて短縮。
// pace・minStroke・minHop: 1画・画と画の間の最短の時間（c は約5秒に収めるため短くする。a／b は今までの値）
function writeInk(pen, list, { speed = 5.2, base = 24, hop = 9, onFrame = null, pace = 1.6, minStroke = 90, minHop = 100 } = {}) {
  const plan = [];
  let t = 0, at = [pen.at.x, pen.at.y];
  for (const s of list) {
    const a = s.pts[0];
    const d = Math.hypot(a[0] - at[0], a[1] - at[1]);
    if (d > 2) { const dur = Math.max(minHop, (12 + d / hop) * pace); plan.push({ t0: t, dur, from: at, to: a, d }); t += dur; }
    const dur = Math.max(minStroke, base + s.len / speed) * pace;
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
      // コマ落ちで移動区間を飛び越えても、浮いていたペンを一瞬で紙へ落とさない。
      lift = pen.at.lift + Math.max(-6, Math.min(6, lift - pen.at.lift));
      pen.place(x, y, lift, ang);
      onFrame?.(x, y);
      if (i < plan.length || Math.abs(lift) > 0.01) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
}

/** キャップを外す: ペン先の方へ抜けて、回りながら飛んでいく */
function capOff(pen, root, x, y, color, tuned = false) {
  burst(root, x, y, { n: 7, r0: 56, r1: 150, color, width: 12, dur: 400 });
  // tuned: 抜ける→飛ぶを区間ごとに（飛ぶ側だけ減速。全体の曲線だと抜けた直後に飛び切ってしまう）
  const e1 = tuned ? { easing: SINE } : {}, e2 = tuned ? { easing: Q_OUT } : {};
  return move(pen.cap, [
    { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, ...e1 },
    { transform: "translate(0px, 46px) rotate(0deg)", opacity: 1, offset: 0.25, ...e2 },
    { transform: "translate(150px, 260px) rotate(160deg)", opacity: 0 },
  ], 420, { easing: tuned ? "linear" : E.out });
}

// ---------------------------------------------------------------- a: チェキ: ファインダー → シャッター → 下から出てくる → 振って乾かす → 寄ってマーカーで書く → 引いて仕上げ


// ---------------------------------------------------------------- 縦の画面

const ICONS = {
  ckShutter: '<path d="M4 8.500A1.500 1.500 0 0 1 5.500 7h2.200l1.300-2h6l1.300 2h2.200A1.500 1.500 0 0 1 20 8.500v9A1.500 1.500 0 0 1 18.500 19h-13A1.500 1.500 0 0 1 4 17.500z"/><circle cx="12" cy="13" r="3.600"/>',
  ckGo: '<path d="M9 5.500 15.500 12 9 18.500"/>',
  ckAgain: '<path d="M4.500 12a7.500 7.500 0 1 0 2.400-5.500"/><path d="M4 4.500v4.500h4.500"/>',
};

export class ChekiScene {
  static META = {
    id: "cheki", label: "チェキ", acc: "#ff7aa8",
    gallery: {
      title: "チェキ（PEPPERMINT の初来店）",
      note: "本編のチェキを縦へ。台詞は本編の台本（data/dialogue/ch1_minto.json の ch1_minto_first）、演出は本編の c（みんとの絵柄が斜めに差し込み、写真が下から出て乾いて色がつき、ピンクと緑のマーカーで落書き）をそのまま縦の上の画面で。写真が縦長なので、本編より大きく書いて、そのまま会話のCGとして残す。撮る所だけ縦の専用の札（ファインダーと大きなシャッター）にした。1,000円は試作だけの財布から。",
      shots: [
        { caption: "みんとの誘い（返事を選ぶ）", shot: "offer" },
        { caption: "ファインダーで撮る", shot: "finder" },
        { caption: "落書きを書く（くり返し）", shot: "loop" },
        { caption: "撮れたチェキ（会話のCGとして残る）", shot: "done" },
      ],
    },
  };

  /** @param opts shot＝一覧（PC）に並べる場面（offer・finder・loop・done） */
  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, opts: { ...opts } });
    Object.assign(kit.ICONS, ICONS);
    Object.assign(this, { gen: 0, resolveCtrl: null, print: null });
    if (!phone.fixed) phone.extOpts.shot = null;
  }

  html() {
    const { REMAKE_IMG: IMG } = this.kit;
    return `
      <div class="ck-app">
        <section class="ck-stage" data-slot="stage">
          <img class="ck-bg" src="${IMG}backgrounds/peppermint.webp" alt="">
          <img class="ck-minto" data-slot="minto" src="${IMG}sprites/character_variants/new/minto/chr_minto_wink.webp" alt="">
          <div class="ck-finder" data-slot="finder" hidden><i></i><i></i><i></i><i></i><span class="ck-finder-dot"></span></div>
          <div class="mo-cheki at-c ck-show" data-slot="show"></div>
          <header class="ck-head"><span class="ck-where"><b>PEPPERMINT</b><small>繁華街</small></span><span class="ck-money"><small>所持金</small><b data-slot="money"></b></span></header>
          <p class="ck-toast" data-slot="toast" hidden></p>
        </section>
        <section class="pt-telop off" data-slot="telop"><b class="pt-name"></b><p class="pt-text"></p><i class="pt-more" aria-hidden="true"></i></section>
        <div class="pt-ctrl" data-slot="ctrl"></div>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = Object.fromEntries(["stage", "minto", "finder", "show", "money", "toast", "telop", "ctrl"].map((k) => [k, q(`[data-slot="${k}"]`)]));
    this.telop = new Telop(this.refs.telop, this.kit);
    this.syncMoney();
    loadDialogue("ch1_minto").then((data) => {
      if (this.dead) return;
      const scene = findDialogue(data, "ch1_minto_first");
      const at = scene?.lines.findIndex((l) => l.type === "choice" && l.id === "minto_first_cheki") ?? -1;
      if (at < 1) throw new Error("ch1_minto_first にチェキの返事が見つからない");
      this.script = { offer: scene.lines[at - 1], choice: scene.lines[at], branches: scene.branches };
      const shot = this.opts.shot;
      if (shot === "finder") this.showFinder();
      else if (shot === "done") this.showDone();
      else if (shot === "loop") this.loop();
      else this.run();
    }).catch((error) => {
      if (this.dead) return;
      console.warn("チェキの台本を読めませんでした:", error);
      this.telop.say({ speaker: "", text: "台本を読み込めませんでした" }, { wait: false });
    });
  }

  destroy() { this.dead = true; this.gen += 1; this.telop?.stop(); this.resolveCtrl = null; }

  alive(gen) { return !this.dead && gen === this.gen; }

  syncMoney() { this.refs.money.textContent = yen(WALLET.money); }

  toast(text) {
    const { toast } = this.refs;
    toast.textContent = text; toast.hidden = false;
    toast.classList.remove("show"); void toast.offsetWidth; toast.classList.add("show");
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { if (!this.dead) toast.hidden = true; }, 2600);
  }

  /** 下の札（返事・シャッター・終わり）を出して、押された値を待つ */
  ask(html) {
    this.refs.ctrl.innerHTML = html;
    this.refs.ctrl.classList.remove("in"); void this.refs.ctrl.offsetWidth; this.refs.ctrl.classList.add("in");
    return new Promise((resolve) => { this.resolveCtrl = resolve; });
  }

  face(name) { this.refs.minto.src = `${this.kit.REMAKE_IMG}sprites/character_variants/new/minto/chr_minto_${name === "wink" ? "wink" : "smile"}.webp`; }

  async say(line) {
    if (line.speaker === "minto") this.face(line.face);
    this.refs.ctrl.innerHTML = "";
    await this.telop.say(line);
  }

  /* ── 本編の台本の順に進める ── */

  async run() {
    const gen = ++this.gen, { offer, choice, branches } = this.script, { esc } = this.kit;
    await this.say(offer);
    if (!this.alive(gen)) return;
    const pick = await this.ask(`<div class="pt-choices">${choice.choices.map((c, i) => {
      const locked = c.condition_type === "money" && !WALLET.keepsakes.includes(KEEPSAKE.name) && WALLET.money < (c.threshold || 0);
      return `<button data-ck="pick" data-v="${i}"${locked ? " disabled" : ""}>${esc(c.text)}</button>`;
    }).join("")}</div>`);
    if (!this.alive(gen)) return;
    let branch = choice.choices[pick]?.next;
    const paid = WALLET.keepsakes.includes(KEEPSAKE.name);
    if (branch === "cheki_buy") branch = paid || WALLET.money >= KEEPSAKE.cost ? "cheki_taken" : "cheki_short"; // cheki_buy の所持金の条件
    for (const line of branches[branch] || []) {
      if (!this.alive(gen)) return;
      if (isSpeech(line)) await this.say(line);
      else if (line.type === "show_cg") { await this.shoot(gen); }
      else if (line.type === "buy_keepsake") {
        // 払うのは最初の1枚だけ（「もう一度見る」で見直す時は払わない。本編のチェキは初来店の一度きり）
        if (!WALLET.keepsakes.includes(KEEPSAKE.name)) { WALLET.money -= KEEPSAKE.cost; WALLET.keepsakes.push(KEEPSAKE.name); this.syncMoney(); }
        this.toast(`思い出の品「${KEEPSAKE.name}」（${yen(KEEPSAKE.cost)}）`);
      } else if (line.type === "hide_cg") this.hidePrint();
    }
    if (!this.alive(gen)) return;
    this.telop.hide();
    const next = await this.ask(`<div class="pt-choices end"><button data-ck="pick" data-v="again">${this.kit.icon("ckAgain")}<span>もう一度見る</span></button><button class="go" data-ck="pick" data-v="leave"><span>店を出る</span>${this.kit.icon("ckGo")}</button></div>`);
    if (!this.alive(gen)) return;
    if (next === "leave" && !this.phone.fixed) this.phone.setScene("tonari"); // 1台表示の流れ: みんとの店 → tonari の2人の会話（これまでと同じ）
    else { this.reset(); this.run(); }
  }

  /** ファインダーを構えて、シャッターを待つ → 撮る */
  async shoot(gen) {
    this.refs.finder.hidden = false;
    this.el.dataset.ckView = "finder";
    await this.ask(`<button class="ck-shutter" data-ck="pick" data-v="shoot" aria-label="撮る"><span class="ck-shutter-ring">${this.kit.icon("ckShutter")}</span><b>撮る</b></button>`);
    if (!this.alive(gen)) return;
    this.refs.ctrl.innerHTML = "";
    this.telop.hide();
    this.refs.finder.hidden = true;
    await this.playCheki(gen);
  }

  reset() {
    this.refs.show.replaceChildren();
    this.refs.show.classList.remove("held", "gone");
    this.refs.finder.hidden = true;
    this.el.dataset.ckView = "";
    this.print = null;
  }

  hidePrint() {
    this.refs.show.classList.add("gone");
    this.el.dataset.ckView = "";
  }

  /** 上の画面の大きさから、写真の置き場所（会話のCGとして残す大きさ）を決める */
  box() {
    const { stage } = this.refs, W = stage.clientWidth, H = stage.clientHeight;
    const h = Math.min(H * 0.8, W * 0.82 * CH / CW), w = h * CW / CH;
    return { W, H, w, h, left: (W - w) / 2, top: H * 0.54 - h / 2 };
  }

  /* ── 演出（本編 cheki.js の c を、縦の上の画面に） ── */

  async playCheki(gen, { quick = false } = {}) {
    const { show } = this.refs;
    this.reset();
    this.el.dataset.ckView = "cheki";
    const img = new Image(); img.src = CG_URL; await img.decode().catch(() => {});
    if (!this.alive(gen)) return;
    const box = this.box(), { W, H } = box;
    const dim = el("i.mo-ck-c-dim");
    const art = el("i.mo-ck-c-art", { style: { backgroundImage: `url("${STAGE_ART}")` } });
    const set = el("div.mo-ck-c-set", [art, el("i.mo-ck-c-shade")]);
    const dark = el("i.mo-ck-dark.ck-dark");
    const ink = { line1: inkStrokes("line1"), line2: inkStrokes("line2"), sign: inkStrokes("sign"), leaf: inkStrokes("leaf"), deco: inkStrokes("deco"), side: inkStrokes("side") };
    const print = makePrint(CG_URL, ink, "linear-gradient(160deg, #eef2f3, #d5dde2)");
    const fly = el("div.mo-ck-fly", { style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.w}px`, height: `${box.h}px`, transformOrigin: "50% 50%" } });
    Object.assign(print.film.style, { left: "0", top: "0", width: "100%", height: "100%" });
    fly.append(print.film);
    const pens = { p: marker("#fffaf2", "#d9d4cf", INK_COLOR.p), g: marker("#fffaf2", "#d9d4cf", INK_COLOR.g) };
    print.top.append(pens.p.g, pens.g.g);
    const flash = el("div.mo-ck-flash");
    show.append(dim, set, dark, fly, flash);
    this.print = { fly, print };
    const fill = (x) => `polygon(-420px 0, ${x}px 0, ${x - 160}px ${H}px, -420px ${H}px)`;
    dark.style.clipPath = fill(-40);
    // 書いている間は少し大きく、上の画面の真ん中に（本編の BIG。縦の写真なので 1.08 倍で高さいっぱい近く）
    const dy = H * 0.5 - (box.top + box.h / 2), big = `translate(0px, ${dy.toFixed(1)}px) scale(1.08)`;
    // 1. 店が沈み、みんとの絵柄が斜めに差し込む
    move(dim, [{ opacity: 0 }, { opacity: 0.45 }], 380, { easing: "ease" });
    move(set, SET_IN, 500, { easing: E.inOut });
    move(art, [{ transform: "scale(1.1) translateX(1.5%)" }, { transform: "scale(1.04)" }], 5200, { easing: "linear" });
    await sleep(260);
    if (!this.alive(gen)) return;
    // 2. シャッターの光。写真が下から大きく出てきて、乾いて色がつく
    move(flash, [{ opacity: 0.7 }, { opacity: 0 }], 320, { easing: E.out });
    move(fly, [
      { transform: `translate(0px, ${(dy + H * 0.7).toFixed(1)}px) rotate(-7deg) scale(0.97)`, easing: Q_OUT2 },
      { transform: `translate(0px, ${(dy - 12).toFixed(1)}px) rotate(1.5deg) scale(1.09)`, offset: 0.7, easing: SINE },
      { transform: big },
    ], 560, { easing: "linear" });
    await sleep(220);
    if (!this.alive(gen)) return;
    const developed = develop(print, 820);
    // 3. ピンクのペンが入ってキャップを外し、ピンク → 緑 → ピンクと持ち替えて書く
    const tip = ink.line1[0].pts[0], pp = pens.p;
    pp.place(tip[0] + 420, tip[1] + 520, 70, 46);
    pp.g.style.opacity = "1";
    await penHop(pp, [tip[0] + 24, tip[1] - 34], 220, { lift: 30, land: 30, ang: 30, ease: easeOut });
    capOff(pp, print.top, tip[0] + 24, tip[1] - 34, INK_COLOR.p, true);
    await sleep(60);
    await penHop(pp, tip, 70, { lift: 0 });
    const handoff = async (from, to, next) => {
      penHop(from, [from.at.x + 360, from.at.y + 520], 140, { lift: 30, ang: 50, ease: easeIn });
      move(from.g, [{ opacity: 1 }, { opacity: 0 }], 100, { delay: 40 }).then(() => { from.g.style.opacity = "0"; from.g.getAnimations().forEach((x) => x.cancel()); });
      to.place(next[0] + 420, next[1] + 520, 60, 50);
      to.g.style.opacity = "1";
      await penHop(to, next, 150, { lift: 30, ang: 30, ease: easeOut });
    };
    const quickInk = { speed: 14, base: 4, hop: 30, pace: quick ? 0.7 : 1, minStroke: 30, minHop: 40 };
    await writeInk(pp, ink.line1, quickInk);
    if (!this.alive(gen)) return;
    pens.g.cap.style.display = "none";
    await handoff(pp, pens.g, ink.line2[0].pts[0]);
    await writeInk(pens.g, ink.line2, quickInk);
    if (!this.alive(gen)) return;
    await handoff(pens.g, pp, ink.sign[0].pts[0]);
    const rest = Promise.all([
      ...ink.leaf.map((s, i) => inkSelf(s, 300, 40 + i * 50, Q_OUT)),
      ...ink.deco.map((s, i) => inkSelf(s, 280, 120 + i * 60, Q_OUT)),
      ...ink.side.map((s, i) => inkSelf(s, 260, 200 + i * 40, Q_OUT)),
    ]);
    await writeInk(pp, ink.sign, quickInk);
    await Promise.all([rest, developed]);
    if (!this.alive(gen)) return;
    // 4. 仕上げ: ペンが抜け、光が横切る。暗い幕が斜めに横切りながら、写真が会話のCGの大きさへ落ち着く
    penHop(pp, [pp.at.x + 360, pp.at.y + 520], 200, { lift: 30, ang: 50, ease: easeIn });
    print.full.style.opacity = "1";
    sweep(print, 380);
    await sleep(260);
    move(print.shadow, [{ opacity: 1 }, { opacity: 0.5 }], 340, { delay: 200 });
    move(dark, [{ clipPath: fill(-40) }, { clipPath: fill(W + 440) }], 460, { easing: E.inOut });
    await move(fly, [{ transform: big }, { transform: "translate(0px, 0px) scale(1)" }], 520, { easing: CAM });
    this.refs.show.classList.add("held");
  }

  /** 一覧（PC）の見本: 書き終えて会話のCGとして残った所（演出なし） */
  showFinished() {
    const { show } = this.refs;
    this.reset();
    this.el.dataset.ckView = "cheki";
    const box = this.box();
    const ink = { line1: [], line2: [], sign: [], leaf: [], deco: [], side: [] };
    const print = makePrint(CG_URL, ink, "transparent");
    print.full.style.opacity = "1"; print.fog.style.opacity = "0";
    const fly = el("div.mo-ck-fly", { style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.w}px`, height: `${box.h}px` } }, [print.film]);
    Object.assign(print.film.style, { left: "0", top: "0", width: "100%", height: "100%" });
    const art = el("i.mo-ck-c-art", { style: { backgroundImage: `url("${STAGE_ART}")`, transform: "scale(1.04)" } });
    show.append(el("i.mo-ck-c-dim", { style: { opacity: "0.45" } }), el("div.mo-ck-c-set", { style: { clipPath: SET_IN[1].clipPath } }, [art, el("i.mo-ck-c-shade")]), el("i.mo-ck-dark.ck-dark.full"), fly);
    show.classList.add("held");
    this.print = { fly, print };
  }

  showFinder() {
    const { offer } = this.script, taken = this.script.branches.cheki_taken;
    const before = taken.slice(0, taken.findIndex((l) => l.type === "show_cg")).filter(isSpeech);
    this.face(offer.face);
    this.telop.say(before.at(-1) || offer, { wait: false });
    this.refs.finder.hidden = false;
    this.el.dataset.ckView = "finder";
    this.ask(`<button class="ck-shutter" data-ck="pick" data-v="shoot" aria-label="撮る"><span class="ck-shutter-ring">${this.kit.icon("ckShutter")}</span><b>撮る</b></button>`).then(() => { const gen = ++this.gen; this.telop.hide(); this.refs.ctrl.innerHTML = ""; this.refs.finder.hidden = true; this.playCheki(gen); });
  }

  showDone() {
    const taken = this.script.branches.cheki_taken;
    const after = taken.slice(taken.findIndex((l) => l.type === "show_cg") + 1).filter(isSpeech);
    this.showFinished();
    this.telop.say(after[0], { wait: false });
  }

  /** 一覧（PC）の見本: 撮る → 書く を、くり返し見せる */
  async loop() {
    const gen = ++this.gen;
    this.telop.hide();
    await this.playCheki(gen);
    if (!this.alive(gen) || !this.el.isConnected) return;
    await sleep(2400);
    if (this.alive(gen) && this.el.isConnected) this.loop();
  }

  /* ── 入力 ── */

  onClick(event) {
    const hit = event.target.closest("[data-ck]");
    if (hit && this.el.contains(hit)) {
      const v = hit.dataset.v, resolve = this.resolveCtrl;
      this.resolveCtrl = null;
      resolve?.(/^\d+$/.test(v) ? Number(v) : v);
      return true;
    }
    if (event.target.closest('[data-slot="telop"]') || event.target.closest('[data-slot="stage"]')) { this.telop?.tap(); return true; }
    return false;
  }

  move() {}

  pressA() {
    if (this.telop?.tap()) return;
    this.refs.ctrl.querySelector("[data-ck]:not(:disabled)")?.click();
  }

  tick() {}

  relayout() {
    // 大きさが変わったら、残っている写真を新しい置き場所へ（書いている途中の演出はそのまま）
    const fly = this.print?.fly;
    if (!fly || !this.refs.show.classList.contains("held")) return;
    const box = this.box();
    Object.assign(fly.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.w}px`, height: `${box.h}px` });
  }
}
