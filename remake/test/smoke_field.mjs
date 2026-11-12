// 人が吐く煙（js/core/smoke.js）の計算部分の検査。DOM を使わない。
//   node remake/test/smoke_field.mjs
import assert from "node:assert/strict";
import { createSmokeField, firstPersonBreath, mouthBreath, ringBreath, coverBreath, hazeBreath, hazeLayer, parseColor, smokeTint, smokeAllowed, GRID_W, GRID_H, SMOKE_WHITE } from "../js/core/smoke.js";
import { hazeLevel } from "../js/core/shop-haze.js";

// 同じ乱数列なら同じ煙になる（撮り直しても結果が変わらないようにする）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function run(specs, seconds, seed = 7) {
  const field = createSmokeField({ random: rng(seed) });
  const ids = [].concat(specs).map((s) => field.breath(s));
  for (let t = 0; t < seconds; t += 1 / 60) field.step(1 / 60);
  return { field, ids };
}
const px = new Uint32Array(GRID_W * GRID_H);
const alphaOf = (v) => v >>> 24;

// ---- 色
assert.deepEqual(parseColor("#fff"), [1, 1, 1]);
assert.deepEqual(parseColor("rgb(255, 0, 51)"), [1, 0, .2]);
assert.equal(parseColor("なし"), null);
assert.deepEqual(smokeTint(null), [...SMOKE_WHITE], "色が無ければ白い煙");
const pink = smokeTint("#ff0000");
assert.ok(pink[0] > pink[1] && pink.every((v) => v > .5), "葉の色は、白い煙にうっすら移すだけ");

// ---- DOM の無い環境では出さない
assert.equal(smokeAllowed(), false);

// ---- 吐いている間は煙があり、消えきると何も残らない
{
  const { field, ids } = run(mouthBreath("", { x: .5, y: .4 }), 1.0);
  assert.ok(field.count > 5, "吐いている間は房がある");
  assert.equal(field.done(ids[0]), false);
  const painted = field.paint(px);
  assert.ok(painted > 800, `升目に描かれる（${painted}）`);
  assert.equal(px.filter((v) => v !== 0).length, painted, "描いた升目の数が合う");
  // 透けは決まった段だけ（半端な濃さを作らない）
  const alphas = new Set([...px].filter((v) => v).map(alphaOf));
  assert.ok(alphas.size <= 5, `濃さは5段まで（${[...alphas]}）`);
  assert.ok(Math.max(...alphas) < 255, "ふつうの煙は少し透ける");
  // 色は 1色の煙で4色まで
  const tones = new Set([...px].filter((v) => v).map((v) => v & 0xffffff));
  assert.ok(tones.size >= 2 && tones.size <= 4, `塗りは4色まで（${tones.size}）`);
  for (let t = 0; t < 9; t += 1 / 60) field.step(1 / 60);
  assert.equal(field.count, 0, "時間がたてば全部消える");
  assert.equal(field.busy, false);
  assert.equal(field.done(ids[0]), true);
  assert.equal(field.paint(px), 0);
  assert.ok(px.every((v) => v === 0), "消えたあとは升目に何も残らない");
}

// ---- 同じ乱数列なら同じ絵
{
  const a = new Uint32Array(GRID_W * GRID_H), b = new Uint32Array(GRID_W * GRID_H);
  run(firstPersonBreath("good"), 1.2, 11).field.paint(a);
  run(firstPersonBreath("good"), 1.2, 11).field.paint(b);
  assert.deepEqual(a, b);
}

// ---- 煙が成績表になる: 最適 ＞ 適温 ＞ ぬるい の順に、画面を満たす量が減る。熱すぎはすぐ消える
{
  const area = (q, sec) => run(firstPersonBreath(q), sec, 3).field.paint(px);
  const best = area("best", 1.4), good = area("good", 1.4), thin = area("thin", 1.4);
  assert.ok(best > good && good > thin * 2, `best ${best} > good ${good} > thin ${thin}`);
  assert.ok(area("harsh", 2.2) < area("good", 2.2) * .5, "熱すぎた煙は、ちぎれてすぐ消える");
  run(firstPersonBreath("thin"), 1.0, 3).field.paint(px);
  assert.ok(Math.max(...[...px].filter((v) => v).map(alphaOf)) < 160, "ぬるい煙は薄い");
}

// ---- 吐き方: 「小さく二度」は間が空く。「上へ」は口元より上に溜まる
{
  const twice = createSmokeField({ random: rng(5) });
  mouthBreath("twice", { x: .5, y: .5 }).forEach((s) => twice.breath(s));
  let before = 0, gap = 0;
  for (let t = 0; t < 1.2; t += 1 / 60) { twice.step(1 / 60); if (Math.abs(t - .45) < .01) before = twice.count; if (Math.abs(t - .8) < .01) gap = twice.count; }
  assert.ok(before > 0 && twice.count > gap, "二度目でまた房が増える");

  const centroidY = (field) => { field.paint(px); let sum = 0, n = 0; for (let i = 0; i < px.length; i++) if (px[i]) { sum += Math.floor(i / GRID_W); n++; } return sum / n / GRID_H; };
  assert.ok(centroidY(run(mouthBreath("up", { x: .5, y: .6 }), 1.6).field) < centroidY(run(mouthBreath("long", { x: .5, y: .6 }), 1.6).field) - .03, "「上へ」は上に溜まる");
  // 左向きは左へ流れる
  const centroidX = (field) => { field.paint(px); let sum = 0, n = 0; for (let i = 0; i < px.length; i++) if (px[i]) { sum += i % GRID_W; n++; } return sum / n / GRID_W; };
  assert.ok(centroidX(run(mouthBreath("long", { x: .5, y: .4, side: -1 }), 1.5).field) < .47);
  assert.ok(centroidX(run(mouthBreath("long", { x: .5, y: .4, side: 1 }), 1.5).field) > .53);
}

// ---- 煙の輪: まん中が抜けている
{
  // 輪は昇りながら広がるので、塗られた升目の重心を輪の中心として、そこが抜けていることを見る
  const { field } = run(ringBreath({ x: .5, y: .6, radius: .12, size: .024 }), .9);
  const painted = field.paint(px);
  let sx = 0, sy = 0;
  for (let i = 0; i < px.length; i++) if (px[i]) { sx += i % GRID_W; sy += Math.floor(i / GRID_W); }
  const cx = Math.round(sx / painted), cy = Math.round(sy / painted);
  assert.equal(px[cy * GRID_W + cx], 0, "輪のまん中は抜けている");
  assert.ok(cy / GRID_H < .56, "輪は昇っていく");
  // 輪の形を保つ: 左右の端まで房が並んでいる（ばらけて飛び散らない）
  const row = [...px.slice(cy * GRID_W, (cy + 1) * GRID_W)].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
  assert.ok(row.length > 6 && row.at(-1) - row[0] > .1 * GRID_W && row.at(-1) - row[0] < .3 * GRID_W, `輪の幅が保たれている（${row[0]}〜${row.at(-1)}）`);
}

// ---- 画面を覆う煙: 覆いきる時間があり、透かさない。そのあと晴れる
{
  const { field } = run(coverBreath(), 1.05);
  const painted = field.paint(px);
  assert.ok(painted > GRID_W * GRID_H * .97, `画面を覆う（${(painted / px.length * 100).toFixed(1)}%）`);
  assert.ok([...px].filter((v) => v).every((v) => alphaOf(v) === 255), "覆う煙は透かさない");
  for (let t = 0; t < 2.6; t += 1 / 60) field.step(1 / 60);
  assert.equal(field.paint(px), 0, "晴れる");
}

// ---- 2色の煙（つむぎの見え方）: 両方の色が出る
{
  const { field } = run(mouthBreath("", { x: .5, y: .5, colors: [[1, .56, .8], [.5, .84, 1]] }), 1.2);
  field.paint(px);
  const reds = new Set([...px].filter((v) => v).map((v) => (v & 0xff) > ((v >>> 16) & 0xff) ? "warm" : "cool"));
  assert.deepEqual([...reds].sort(), ["cool", "warm"]);
}

// ---- 店に漂う煙（KMR21）: うっすら。画面を覆わず、縁は段々に薄く、部屋の上半分に溜まる
{
  const random = rng(21), field = createSmokeField({ random });
  let wait = 0;
  for (let t = 0; t < 30; t += 1 / 8) { wait -= 1 / 8; if (wait <= 0) { wait = 2.8 + 2.4 * random(); field.breath(hazeBreath(random)); } field.step(1 / 8); }
  const painted = field.paint(px), share = painted / px.length;
  assert.ok(share > .005 && share < .15, `漂う煙は小さな房がまばらにある程度（${(share * 100).toFixed(1)}%）`);
  const alphas = [...new Set([...px].filter((v) => v).map(alphaOf))].sort((a, b) => a - b);
  assert.ok(alphas.length >= 3, `縁へ向かって段々に薄くなる（${alphas}）`);
  assert.ok(alphas.at(-1) < 200, "いちばん濃い所でも、人が吐く煙より薄い");
  let low = 0;
  for (let i = 0; i < px.length; i++) if (px[i] && Math.floor(i / GRID_W) > GRID_H * .72) low++;
  assert.ok(low < painted * .05, "台詞の箱のあたり（画面の下）には溜まらない");
}

// ---- 漂う煙を出す背景: シーシャ屋の店内だけ。夜は濃く、昼は控えめ。作業台・結果発表では出さない
{
  const B = "img/backgrounds/";
  assert.equal(hazeLevel(`${B}bg_tonari_inside_night.webp`, "", "", "day"), 1, "絵の名前が夜なら夜");
  assert.equal(hazeLevel("res://assets/backgrounds/bg_tonari_inside_overcast_day.png", "", "", "night"), .55, "曇りの昼も同じ店・昼");
  assert.equal(hazeLevel(`${B}bg_tonari_inside.webp`, "", "night", "day"), 1, "色味が夜なら夜");
  assert.equal(hazeLevel(`${B}kemurikusa.webp`, "", "", "night"), 1, "昼夜で同じ絵の店は、今の時間帯で決める");
  assert.equal(hazeLevel(`${B}kemurikusa.webp?v=abc`, "", "", "day"), .55);
  for (const shop of ["bg_eden_shop", "eden", "peppermint", "bg_ageha_shop", "bg_yuzugaya_kumicho", "bg_mukai_shop", "bg_yohaku_shop", "bg_steve_shop", "bg_volk_shop", "bg_longlong_shop", "bg_dubai_cafe_day", "bg_dubai_cafe_salim_day", "bg_dubai_alley_cafe_night"])
    assert.ok(hazeLevel(`${B}${shop}.webp`, "", "", "night") > 0, `${shop} はシーシャ屋`);
  for (const other of ["bg_home_night", "bg_street_night", "bg_fookah_showroom", "bg_shop", "bg_c_station_night", "bg_cafe_night", "bg_choizap_night", "bg_club_seam", "bg_tournament_stage", "bg_tonari_customer_hands", "bg_title", ""])
    assert.equal(hazeLevel(other && `${B}${other}.webp`, "", "", "night"), 0, `${other || "背景なし"} には出さない`);
  for (const screen of ["bench", "count", "result", "title", "end"])
    assert.equal(hazeLevel(`${B}bg_tonari_inside_night.webp`, screen, "", "night"), 0, `${screen} の画面では出さない`);
}

// ---- 漂う煙の常駐処理: 8コマだけ計算・描画し、退場時は即座に計算を止める。
{
  const names = ["document", "performance", "requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"];
  const saved = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const jobs = new Map(), children = [];
  let now = 0, next = 1, draws = 0;
  const schedule = (fn, ms) => { const id = next++; jobs.set(id, { fn, at: now + ms }); return id; };
  const advance = (ms) => {
    const end = now + ms;
    while (jobs.size) {
      const [id, job] = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (job.at > end) break;
      jobs.delete(id); now = job.at; job.fn(now);
    }
    now = end;
  };
  const host = { append(canvas) { children.push(canvas); canvas.isConnected = true; } };
  const doc = { hidden: false, createElement() { return {
    style: {}, isConnected: false, setAttribute() {},
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() { draws++; } }; },
    remove() { this.isConnected = false; const i = children.indexOf(this); if (i >= 0) children.splice(i, 1); },
  }; } };
  try {
    for (const [name, value] of Object.entries({ document: doc, performance: { now: () => now }, requestAnimationFrame: (fn) => schedule(fn, 16), cancelAnimationFrame: (id) => jobs.delete(id), setTimeout: schedule, clearTimeout: (id) => jobs.delete(id) }))
      Object.defineProperty(globalThis, name, { configurable: true, value });
    const haze = hazeLayer(host, { random: rng(21) });
    assert.ok(haze.field.count > 0 && haze.field.count < 8, "入店時は小さな房だけを育て、煙を大量に先行計算しない");
    advance(1000);
    assert.ok(draws >= 8 && draws <= 9, `常駐中の描画は毎秒8回ほど（${draws}）`);
    assert.equal(+haze.canvas.style.opacity, .07, "夜でも層の濃さは7%（従来44%）");
    haze.setLevel(.55);
    assert.ok(+haze.canvas.style.opacity < .06, "昼はさらに薄い");
    haze.stop();
    const stoppedDraws = draws;
    assert.equal(haze.field.count, 0, "退場し始めた時点で煙の計算を片付ける");
    advance(1000);
    assert.equal(draws, stoppedDraws, "薄れている間は描き直さない");
    assert.ok(haze.canvas.isConnected, "最後の絵は薄れ終わるまで残す");
    const nextHaze = hazeLayer(host, { random: rng(22) });
    assert.equal(children.length, 1, "素早い再入店でも、消えかけの煙を重ねない");
    assert.equal(haze.canvas.isConnected, false);
    doc.hidden = true;
    advance(200);
    assert.equal(nextHaze.canvas.isConnected, false, "非表示のタブでは常駐処理を止める");
    assert.equal(jobs.size, 0, "計算・退場のタイマーを残さない");
  } finally {
    names.forEach((name, i) => saved[i] ? Object.defineProperty(globalThis, name, saved[i]) : delete globalThis[name]);
  }
}

console.log("smoke field: PASS (色・吐き方・成績表・輪・覆う・2色・漂う煙・出す背景・後片付け)");
