// 縦画面の試作: DESERT RIDE を縦の画面で動かす（縦試作の枠 ../index.html?view=play&scene=desert が iframe で読む。単体でも開ける）。
// 本編の画面（remake/js/minigames/desert-ride.js）を layout: "portrait" で呼ぶだけ。規則・採点・絵・音は本編のまま、並べ方は desert.css。
// 記録はこのページを開いている間だけ覚える（本編の保存にも、単独ページの記録にも触れない）。
// ?shot=menu|help|practice|count|run|air|result は、一覧（PC）に並べる止め絵。?tier=easy|normal|hard、?course= は単独ページと同じ。
// 段の解放は本編と同じ（DSR107）: 最初は初級だけ。その段でヌールに勝つと次の段が開き、上級をクリアすると、なるの札（4枚目。それまでは「？？？」）が開く。
// ?open=all は、3段ともクリア済み・なるも開いた入口（一覧に並べる止め絵や、なるとの勝負を見る時）。
import { runDesertRide } from "../../../js/minigames/desert-ride.js";
import { desertBestKey, RULES_VERSION } from "../../../js/minigames/desert-ride-model.js";
import { TIERS } from "../../../js/core/play-tiers.js";
import { initPortraitFit, shot, param, tellParent, until } from "./frame.mjs";

const stage = document.getElementById("stage");
initPortraitFit(stage);

const bests = {};
// クリア済みの段（ページを開いている間だけ覚える。本編は保存の growth.playTiers.desert）
const cleared = new Set(param("open") === "all" ? TIERS : []);
const openTiersNow = () => TIERS.filter((t, i) => i === 0 || cleared.has(TIERS[i - 1]));
const rivalsNow = () => cleared.has("hard") ? ["noor", "naru"] : ["noor"];
/** 止め絵の場面を作る（本編の検査用の窓口 window.__desertRide を使う）。 */
async function pose(name) {
  const ride = await until(() => window.__desertRide);
  if (name === "help") { (await until(() => document.querySelector('[data-test="desert-help"]'))).click(); return; }
  if (name === "menu") return;
  if (name === "practice") { // 練習の最初の説明（ヌールの吹き出し）
    (await until(() => document.querySelector('[data-test="desert-practice"]'))).click();
    await until(() => ride.mode === "practice" && ride.game && !document.querySelector('[data-test="desert-guide"]').hidden);
    await new Promise(resolve => setTimeout(resolve, 900));
    ride.pause(true); ride.redraw();
    return;
  }
  ride.start("run", "noor");
  if (name === "count") { // スタートの合図と相手の名乗り
    await until(() => ride.mode === "run" && ride.game && ride.countdown > 0 && ride.countdown < 2.2);
    ride.pause(true);
    return;
  }
  await until(() => ride.mode === "run" && ride.game);
  ride.skipCountdown(); ride.autoplay("expert");
  if (name === "result") { // 自動で最後まで滑らせ、結果の画面で止まる
    ride.setSpeedUp(12);
    (await until(() => document.querySelector('[data-test="desert-result"] button'), { timeout: 60000 })).blur(); // 止め絵に、キー操作の枠を出さない
    return;
  }
  const g = () => ride.game;
  const when = {
    run: () => g().z > 260 && g().air <= 0 && g().fallT <= 0 && g().boostT <= 0,
    air: () => g().air > 0 && g().airKind === "big" && Math.abs(g().rot) > 0.3 && 1 - g().air / g().airTotal > 0.3,
  }[name] || (() => g().z > 260);
  ride.setSpeedUp(4);
  await until(() => !g() || g().finished || when(), { every: 16, timeout: 60000 });
  ride.setSpeedUp(1); ride.pause(true); ride.redraw();
}

async function play() {
  const asked = TIERS.includes(param("tier")) ? param("tier") : null;
  const courseId = param("course") || undefined;
  if (shot) pose(shot).catch(error => console.warn(error));
  for (;;) {
    const best = Object.values(bests).sort((a, b) => b.score - a.score)[0] || null;
    await runDesertRide({
      host: stage, layout: "portrait", tutorial: false, best, bests, rivals: rivalsNow(), tiers: openTiersNow(), cleared: [...cleared],
      tier: asked && openTiersNow().includes(asked) ? asked : openTiersNow().at(-1), courseId,
      onResult: result => {
        const key = desertBestKey(result);
        if (!bests[key] || result.score > bests[key].score) bests[key] = { score: result.score, rank: result.rank, rulesVersion: RULES_VERSION };
        // その段でヌールより先にゴールしたら、その段（と下の段）をクリア。なるとの勝負は段の外
        if (result.race?.who === "noor" && result.race.won && TIERS.includes(result.tier)) for (const t of TIERS.slice(0, TIERS.indexOf(result.tier) + 1)) cleared.add(t);
        return { tiers: openTiersNow(), cleared: [...cleared], rivals: rivalsNow() };
      },
    });
    // 「砂丘を下りる」: 本編では街へ戻る。試作では入口へ戻し、枠に知らせる
    tellParent("leave", { game: "desert" });
    if (shot) return;
  }
}
play();
