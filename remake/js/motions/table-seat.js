// ミニゲームの入口・出口の幕「卓へ座る」（#2688 F13・#2736）。ミニゲーム本体の画面・UIテーマには触らない。
// 入口: 葉の窓が閉じてゲーム名の判子が押され、覆った内側でゲームが始まってから窓が開く（約0.5秒）。
// 出口: ゲームの画面が片付いた同じ描画で紫に覆い、判子を残して窓が開いて元の場所へ戻る（入口の逆）。
// 続けて次のゲームが始まる（レッスン → 本番）ときは、出口の幕をそのまま次の入口に使う。
// SKIP中は短く、動きを減らす設定ではフェードだけ、テストの高速送り（vnTest.turbo）と2画面表示では出さない。
// 外すときは、呼び出し側の seated(...) を元の関数へ戻すだけでよい（保存・記録・報酬には触れない）。

let parked = null; // 出口の幕が開き終わる前に次の入口が来たら、そのまま引き継ぐ

const skipMotion = () => typeof document === "undefined" || !document.getElementById?.("stage")
  || !!window.__remake?.vnTest?.turbo || !!document.body?.classList.contains("game-ds");

/** run をゲーム名つきの入口・出口で包んだ関数を返す。中断（例外）のときは出口を出さずにそのまま投げる */
export function seated(name, run) {
  return async (...args) => {
    if (skipMotion()) return run(...args);
    const mod = await import("./table-seat-motion.js").catch((e) => { console.error(e); return null; });
    if (!mod) return run(...args);
    let enter = null;
    try { enter = await mod.enterTable(document.getElementById("stage"), name, parked); }
    catch (e) { console.error(e); }
    parked = null;
    let started;
    try { started = run(...args); }
    catch (e) { enter?.release(); throw e; }
    enter?.release();
    const result = await started;
    try { parked = mod.leaveTable(document.getElementById("stage"), name, () => { parked = null; }); }
    catch (e) { console.error(e); }
    return result;
  };
}
