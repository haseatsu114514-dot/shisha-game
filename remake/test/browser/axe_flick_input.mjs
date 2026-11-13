// 斧投げの「上へ弾いて投げる」操作を、本物のマウス・タッチの入力で再現する（結果は注入しない）。
// 強さは離す直前の上向きの速さで決まるので、CDP の timestamp で入力の時刻を決め、速さを決まった値にする
// （ゲームは event.timeStamp で速さを測る。Playwright の mouse/touchscreen は時刻を指定できない）。
import { flickSpeedFor } from "../../js/minigames/axe-pull-model.js";

const STEPS = 5, DURATION = 80;

/** (x, y) から上へ、raw の強さになる速さで弾く。height は斧投げの画面（[data-test="axe-game"]）の高さ（px）。
 *  lean は左右へ流す量（上へ1動く間に横へ lean 動く）。rise を渡すと、速さの代わりにその距離を DURATION で動く。 */
export async function flick(page, { x, y, height, power = .62, touch = false, lean = 0, rise = null, duration = null }) {
  // 上へ動く距離を画面の高さの1〜3割に収める（遅い弾きは時間をかけ、速い弾きは短く。速さは同じ）。画面の外へ出ると中止になる
  const speed = flickSpeedFor(power);
  duration ??= rise === null ? Math.min(Math.max(DURATION, Math.ceil(100 / speed)), Math.floor(300 / speed)) : DURATION;
  const distance = rise ?? flickSpeedFor(power) * height * duration / 1000;
  // Playwright の偽の時計（page.clock）が入っている間は、入力の時刻も偽の時計の値になる。その時は1歩ごとに時計を同じだけ進める
  const fakeClock = await page.evaluate(() => !/\[native code\]/.test(String(performance.now)));
  const tick = async () => { if (fakeClock) await page.clock.runFor(duration / STEPS); };
  const cdp = await page.context().newCDPSession(page);
  const t0 = Date.now() / 1000, at = i => t0 + duration / 1000 * i / STEPS;
  const point = i => ({ x: x + distance * lean * i / STEPS, y: y - distance * i / STEPS });
  try {
    if (touch) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point(0), id: 1 }], timestamp: at(0) });
      for (let i = 1; i <= STEPS; i++) { await tick(); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point(i), id: 1 }], timestamp: at(i) }); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: at(STEPS) });
    } else {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(0), timestamp: at(0) - .05 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point(0), button: "left", buttons: 1, clickCount: 1, timestamp: at(0) });
      for (let i = 1; i <= STEPS; i++) { await tick(); await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point(i), button: "left", buttons: 1, timestamp: at(i) }); }
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point(STEPS), button: "left", buttons: 0, clickCount: 1, timestamp: at(STEPS) });
    }
  } finally { await cdp.detach(); }
}

/** 右の取っ手（狙いを動かさずに弾く台）から弾く */
export async function flickFromHandle(page, options = {}) {
  const grip = await page.locator('[data-test="axe-pull-handle"]').boundingBox();
  const stage = await page.locator('[data-test="axe-game"]').boundingBox();
  if (!grip || !stage) throw new Error("the actual flick handle and stage must be visible");
  await flick(page, { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2, height: stage.height, ...options });
}

/** 的の上の点（的の絵の座標 330,245 が中心）に触れて、そのまま弾く */
export async function flickFromBoard(page, { at = { x: 330, y: 245 }, ...options } = {}) {
  const p = await page.locator(".axe-target").evaluate((node, at) => {
    const point = new DOMPoint(at.x, at.y).matrixTransform(node.getScreenCTM());
    return { x: point.x, y: point.y };
  }, at);
  const stage = await page.locator('[data-test="axe-game"]').boundingBox();
  await flick(page, { ...p, height: stage.height, ...options });
}

/** 2026-11-13: 弾いて投げる操作も、狙いは横→縦の針を的のタップで止める（投げる時だけ上へ弾く）。
 *  choice（またはもう横の工程）から、針が x・y（ゲージの値 0〜1。0.5 が真ん中）に来た所で的をタップして止め、power まで進める。
 *  Playwright の偽の時計の間は、時計を必要なだけ進めてからタップする（偽の時計では待ち合わせが進まないため）。 */
export async function stanceAt(page, { touch = false, x = .5, y = .5 } = {}) {
  const game = page.locator('[data-test="axe-game"]');
  const phase = () => game.getAttribute("data-phase");
  // マキのレッスンの説明（横・縦の止め方）が開いたら、ここで止めて呼んだ側に読ませる
  const coached = () => page.locator('[data-test="axe-coach"]').count().then(n => n > 0);
  const fakeClock = await page.evaluate(() => !/\[native code\]/.test(String(performance.now)));
  const center = await page.locator(".axe-target").evaluate(node => {
    // 板の右下（青から離れ、真ん中からも離れた所）。構える前に真ん中近くを触ると宣言の取り消しになるため
    const point = new DOMPoint(480, 420).matrixTransform(node.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  const tap = async () => { if (touch) await page.touchscreen.tap(center.x, center.y); else await page.mouse.click(center.x, center.y); };
  const waitPhase = value => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value, fakeClock ? { polling: 50 } : undefined)
    .catch(async error => { if (fakeClock && await phase() === value) return; throw error; });
  async function settle(value) {
    if (!fakeClock) return waitPhase(value);
    for (let i = 0; i < 40 && await phase() !== value; i++) await page.clock.runFor(50);
  }
  if (await coached()) return;
  if (await phase() === "choice") {
    // 直前の操作（「次の投へ」など）から 250ms の取りこぼし防止を越えてから触れる
    if (fakeClock) await page.clock.runFor(300); else await page.waitForTimeout(300);
    await tap(); await settle("horizontal");
  }
  for (const [step, value, next] of [["horizontal", x, "vertical"], ["vertical", y, "power"]]) {
    if (await coached()) return;
    if (await phase() !== step) continue;
    await page.evaluate(() => { delete window.__axeStanceTiming; });
    if (fakeClock) {
      await page.clock.runFor(260);
      const now = Number(await game.getAttribute("data-timing"));
      // 針は 0→1 を 1.8 秒で上がり、1→0 を 1.8 秒で下がる。上がる途中で value に届くまで進める
      const wait = now < value ? (value - now) * 1800 : (now - value) * 1800 + 0;
      await page.clock.runFor(Math.max(0, Math.round(wait)));
    } else {
      await page.waitForFunction(({ value }) => {
        const n = document.querySelector('[data-test="axe-game"]');
        const t = Number(n?.dataset.timing), prev = window.__axeStanceTiming ?? t; window.__axeStanceTiming = t;
        return t >= prev && Math.abs(t - value) < .02;
      }, { value }, { polling: "raf" });
    }
    await tap(); await settle(next);
  }
}
