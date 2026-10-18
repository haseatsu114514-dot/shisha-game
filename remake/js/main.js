// 起動: ステージの拡縮 → データ読込 → タイトル。
import { TOURNAMENT_DAY } from "./core/rules.js";
import { $, sleep } from "./core/util.js";
import { loadAll, DB, bgUrl, portraitInfo, makingUrl } from "./core/data.js";
import { initLayers, imageReady, FRAME_ART, warmUiArt } from "./core/ui.js";
import { loadConfig, state, load, consumeResumeOnBoot } from "./core/state.js";
import { unlockAudio } from "./core/audio.js";
import { vnTest } from "./vn/engine.js";
import { createDevInspector } from "./core/dev-inspector.js";
import { createEventPreview } from "./core/dev-event-preview.js";
import { createIsolatedEventPlayer } from "./core/dev-isolated-player.js";
import { craftTest } from "./craft/session.js";
import { showTitle } from "./scenes/title.js";
import { prepareTitleArt } from "./scenes/title-art.js";
import { isNormalTitleForced } from "./scenes/title-layout.js";
import { initDailyLayout } from "./scenes/daily-layout.js";
import { initGameLayout } from "./scenes/game-layout.js";
import { applyTextSize } from "./scenes/settings.js";
import { resumeGame } from "./chapters/ch1.js";

function fitStage() {
  const stage = $("#stage");
  const w = window.visualViewport?.width || window.innerWidth;
  const h = window.visualViewport?.height || window.innerHeight;
  stage.style.setProperty("--k", String(Math.min(w / 1280, h / 720)));
}

export async function boot() {
  fitStage();
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
  window.visualViewport?.addEventListener("resize", fitStage);
  initLayers();
  initGameLayout();
  initDailyLayout();
  loadConfig();
  applyTextSize();
  // 自動再生制限: 最初の操作で音を解禁（以後も操作のたびに保険で呼ぶ・軽い）
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  const bar = $("#boot .boot-bar i");
  // データと一緒に書体も待つ（読み込み前の代わりの字で一瞬崩れて見えないように）。遅い回線では4秒で先へ
  const fonts = Promise.race([
    Promise.all(["500", "700", "900"].map((w) => document.fonts.load(`${w} 20px "Suien Gothic"`, "水煙前線あA7"))),
    new Promise((r) => setTimeout(r, 4000)),
  ]).catch(() => {});
  await Promise.all([loadAll((p) => { bar.style.width = `${Math.round(p * 100)}%`; }), fonts]);
  // 抽選した1枚だけをデコードしてから幕を開ける。全候補を起動時にダウンロードしない。
  const [titleArt] = await Promise.all([prepareTitleArt(), Promise.all([
    imageReady("img/ui/ui_title_logo_rich.webp", 3000),
    ...FRAME_ART.map((u) => imageReady(u, 3000, { keep: true })),
  ])]);
  // ゲーム中にロードした直後は、タイトルを飛ばしてそのデータから再開する
  const resumeRequested = consumeResumeOnBoot();
  // 復旧URLは通常タイトルを開く。セーブの読込・書換えは行わない。
  if (!isNormalTitleForced() && resumeRequested && load()) resumeGame();
  else showTitle(titleArt);
  // タイトルを描けたことを確認してから、読み込み画面を閉じる。
  $("#boot").classList.add("done");
  setTimeout(() => $("#boot")?.remove(), 700);
  warmUp();
}

/** タイトルを見ている間に、日常でよく出る絵を裏で読んでおく（初めて出る場面で絵が遅れないように） */
async function warmUp() {
  // 先に小さなUIの絵（枠・看板・顔アイコン・スロットの図柄）を並行で。背景・立ち絵はそのあと1枚ずつ
  await Promise.all([warmUiArt(), ...["bg_osu_map_day", "bg_osu_map_night"].map((bg) => imageReady(bgUrl(bg), 8000, { keep: true }))]);
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
  // Read-only inspection: __remake.inspect.snapshot(), .events('ch1'), .eventInfo(id)
  inspect: createDevInspector(() => state, () => DB.dialogues),
  preview: createEventPreview(() => DB.dialogues, document),
  rehearsal: createIsolatedEventPlayer(() => DB.dialogues, document),
  // MOKUMOKUパッキー: 分布確認 __remake.reel.simulate(100000) ／演出だけ見る __remake.reel.force("big", "before"|"after")
  reel: {
    async simulate(n = 100000) { return (await import("./daily/reel.js")).simulate(n); },
    async force(role = "big", variant = "after") { return (await import("./daily/reel.js")).force(role, variant); },
  },
  // 開発用ジャンプ（コンソールから: __remake.dev.tournament() など）。※今のセーブを上書きする
  dev: {
    // マップ→場所の移動トランジションの比較用（pin / steps / walk / door / noren / walkdoor。本編の既定は door）。URLの ?move=pin でも切り替わる
    async moveStyle(style) {
      const moves = await import("./core/transition-moves.js");
      if (style) moves.setMoveStyle(style);
      return moves.moveStyle();
    },
    // 扉・場面の演出の配色（mono＝紫1色／free＝場面ごとの色）。URLの ?mopal=free でも切り替わる
    async motionPalette(name) {
      const kit = await import("./core/mg-kit.js");
      if (name) kit.setMotionPalette(name);
      return kit.motionPalette();
    },
    // 場面ごとの動きのパターン（a／b）。本編は採用（mg-kit.js の ADOPTED_VARIANT）。"auto" で採用に戻す。URLの ?movar=b でも切り替わる
    async motionVariant(name) {
      const kit = await import("./core/mg-kit.js");
      if (name) kit.setMotionVariant(name);
      return Object.fromEntries(Object.keys(kit.ADOPTED_VARIANT).map((k) => [k, kit.motionVariant(k)]));
    },
    // 場面ごとのモーショングラフィックスを本来の背景・会話つきで見る（cheki / tarot / gift / shift / shark / sketch）。
    // 夜明けの天気は dawn-sun / dawn-cloud / dawn-rain / dawn-sick（DAY3→4）。くじのガラガラは garagara-S / -A / -B / -C、ラストワン賞は garagara-LAST（C賞のあとに続けて見るなら garagara-C+LAST）。章題は chapter-1 / -2 / -4 / -5。※今のセーブを上書きする
    async motion(name = "cheki") {
      const core = await import("./core/state.js");
      const { play } = await import("./vn/engine.js");
      const { setBg } = await import("./core/ui.js");
      const { sceneBg, bgUrl } = await import("./core/data.js");
      const { bgRef } = await import("./daily/spots.js");
      const motions = await import("./core/scene-motions.js");
      core.newGame();
      const state = core.state; // newGame() で作り直した状態
      Object.assign(state, { phase: "daily", day: 12, slot: 1 });
      for (const id of ["sumi", "tsumugi", "naru", "minto", "adam", "rin"]) state.met[id] = true;
      document.getElementById("screen").replaceChildren();
      const tonariNight = "res://assets/backgrounds/bg_tonari_inside_night.png";
      if (name === "cheki") {
        const scene = DB.dialogues.ch1_minto_first;
        return play({ dialogue_id: "dev_cheki", metadata: {}, lines: scene.branches.cheki_taken }, { bg: bgRef("peppermint") });
      }
      if (name === "tarot") {
        state.fortune = { char: "tsumugi" };
        return play("remake_fortune_result", { bg: bgRef("bg_street") });
      }
      if (name === "gift") {
        await setBg(bgUrl("bg_tonari_inside", "night"));
        return motions.giftOpen("suyaki_tsumugi");
      }
      if (name === "shift") {
        Object.assign(state, { slot: 0 });
        await play("remake_baito_start", { bg: "res://assets/backgrounds/bg_tonari_inside.png" });
        await motions.shiftClose();
        return play("remake_baito_end", { bg: "res://assets/backgrounds/bg_tonari_inside.png" });
      }
      if (name === "shark") {
        await setBg(bgUrl("bg_street", "night"));
        return (await import("./daily/samechan.js")).playSamechanEncounter();
      }
      if (name.startsWith("chapter")) {
        const n = Number(name.split("-")[1] || 1);
        const { CHAPTER_TITLE_ART } = await import("./core/chapter-title-art.js");
        const { chapterTitle } = await import("./core/ui.js");
        const entry = CHAPTER_TITLE_ART.find((c) => c.chapter === n) || { no: `第${n}章`, name: "", read: "" };
        await setBg(null);
        return chapterTitle(entry);
      }
      if (name.startsWith("garagara")) {
        const rank = name.split("-")[1] || "S";
        await setBg(bgUrl("bg_shop"));
        return (await import("./daily/kuji.js")).previewReveal(rank);
      }
      if (name.startsWith("dawn")) {
        const kind = name.split("-")[1] || "sun";
        const { dayTurn } = await import("./core/ui.js");
        state.weatherSeed = { rain: 1, sun: 2, cloud: 10, sick: 2 }[kind] ?? 2; // DAY4 がその天気になる種
        Object.assign(state, { day: 3, slot: 2 });
        await setBg(bgUrl("bg_home", "night"));
        await sleep(700);
        return dayTurn(async () => {
          state.day = 4;
          state.slot = 0;
          await setBg(bgUrl("bg_home", "day"), { instant: true });
          const weather = (await import("./daily/weather.js")).weatherOf();
          return { fromDay: 3, day: 4, fromLeft: TOURNAMENT_DAY - 3, left: TOURNAMENT_DAY - 4, rain: weather === "rain", weather, sick: kind === "sick" };
        });
      }
      if (name === "sketch") {
        const art = sceneBg(tonariNight, "night");
        await setBg(null);
        await motions.sketchIn(async () => { await setBg(art.url, { tint: art.tint }); }, art.url);
        return play("ch1_tsumugi_sketch", { bg: tonariNight });
      }
      return null;
    },
    async tournament() {
      const { newGame } = await import("./core/state.js");
      const ch1 = await import("./chapters/ch1.js");
      newGame();
      window.__remake.state.phase = "tournament";
      window.__remake.state.day = TOURNAMENT_DAY;
      // 開発ジャンプは日常の仕入れ案内を省き、検証用の持ち込みを用意する。
      window.__remake.state.flavorStock = { double_apple: 50, mint: 50, blueberry: 50 };
      window.__remake.state.flavors = ["double_apple", "mint", "blueberry"];
      return ch1.devTournament();
    },
    // リザルトを待たずに3種類のコンティニュー演出を確認（0〜2を指定）。
    async gameOver(reason = "rank", variant = 0) {
      const { devGameOver } = await import("./chapters/ch1.js");
      return devGameOver(reason, reason === "rank" ? 2 : 0, variant);
    },
    async drill(kind = "heat") {
      const { newGame } = await import("./core/state.js");
      const { runDrill } = await import("./craft/session.js");
      newGame();
      return runDrill(kind);
    },
  },
};
