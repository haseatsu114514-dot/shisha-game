// 起動: ステージの拡縮 → データ読込 → タイトル。
import { $, sleep } from "./core/util.js";
import { loadAll, DB, assetUrl, bgUrl, portraitInfo, makingUrl } from "./core/data.js";
import { initLayers, imageReady } from "./core/ui.js";
import { loadConfig, state, load, consumeResumeOnBoot } from "./core/state.js";
import { unlockAudio } from "./core/audio.js";
import { vnTest } from "./vn/engine.js";
import { craftTest } from "./craft/session.js";
import { showTitle } from "./scenes/title.js";
import { resumeGame } from "./chapters/ch1.js";

function fitStage() {
  const stage = $("#stage");
  const w = window.visualViewport?.width || window.innerWidth;
  const h = window.visualViewport?.height || window.innerHeight;
  stage.style.setProperty("--k", String(Math.min(w / 1280, h / 720)));
}

async function boot() {
  fitStage();
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
  window.visualViewport?.addEventListener("resize", fitStage);
  initLayers();
  loadConfig();
  // 自動再生制限: 最初の操作で音を解禁（以後も操作のたびに保険で呼ぶ・軽い）
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  const bar = $("#boot .boot-bar i");
  try {
    // データと一緒に書体も待つ（読み込み前の代わりの字で一瞬崩れて見えないように）。遅い回線では4秒で先へ
    const fonts = Promise.race([
      Promise.all(["500", "700", "900"].map((w) => document.fonts.load(`${w} 20px "Suien Gothic"`, "水煙前線あA7"))),
      new Promise((r) => setTimeout(r, 4000)),
    ]).catch(() => {});
    await Promise.all([loadAll((p) => { bar.style.width = `${Math.round(p * 100)}%`; }), fonts]);
  } catch (e) {
    $("#boot .boot-msg").textContent = `読み込みに失敗しました（${e.message}）。ローカルサーバー越しに開いているか確認してください。`;
    throw e;
  }
  // タイトルの絵とロゴが読めてから幕を開ける（最大3秒）
  await Promise.race([Promise.all(TITLE_IMAGES.map((r) => imageReady(assetUrl(r), 3000))), sleep(3000)]);
  $("#boot").classList.add("done");
  setTimeout(() => $("#boot").remove(), 700);
  // ゲーム中にロードした直後は、タイトルを飛ばしてそのデータから再開する
  if (consumeResumeOnBoot() && load()) { resumeGame(); warmUp(); return; }
  showTitle();
  warmUp();
}

const TITLE_IMAGES = ["assets/ui/title_arts/title_art_keyvisual_01.png", "assets/ui/ui_title_logo.png"];

/** タイトルを見ている間に、日常でよく出る絵を1枚ずつ裏で読んでおく（初めて出る場面で絵が遅れないように） */
async function warmUp() {
  const bgs = ["bg_osu_map_day", "bg_osu_map_night", "bg_tonari_inside_day", "bg_tonari_inside_night", "bg_home_day", "bg_home_night", "bg_shop", "bg_tournament_stage"];
  const faces = [["sumi", "normal"], ["tsumugi", "normal"], ["naru", "normal"], ["adam", "normal"], ["minto", "normal"], ["rin", "normal"], ["pakki", "normal"]];
  const urls = [
    ...bgs.map((b) => bgUrl(b)),
    ...faces.map(([c, f]) => portraitInfo(c, f)?.src),
    ...["bench_base.png", "stove_coil.png", "hookah_base.png"].map((m) => makingUrl(m)),
  ].filter(Boolean);
  for (const u of urls) await imageReady(u, 8000);
}

// テスト・デバッグ用フック（見た目を変えてもテストが壊れないよう、ここだけに依存させる）
window.__remake = {
  get state() { return state; },
  DB,
  vnTest,
  craftTest,
  // MOKUMOKUパッキー: 分布確認 __remake.reel.simulate(100000) ／演出だけ見る __remake.reel.force("big", "before"|"after")
  reel: {
    async simulate(n = 100000) { return (await import("./daily/reel.js")).simulate(n); },
    async force(role = "big", variant = "after") { return (await import("./daily/reel.js")).force(role, variant); },
  },
  // 開発用ジャンプ（コンソールから: __remake.dev.tournament() など）。※今のセーブを上書きする
  dev: {
    async tournament() {
      const { newGame } = await import("./core/state.js");
      const ch1 = await import("./chapters/ch1.js");
      newGame();
      window.__remake.state.phase = "daily";
      window.__remake.state.day = 15;
      return ch1.devTournament();
    },
    async drill(kind = "heat") {
      const { newGame } = await import("./core/state.js");
      const { runDrill } = await import("./craft/session.js");
      newGame();
      return runDrill(kind);
    },
  },
};

boot();
