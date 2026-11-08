// 起動: ステージの拡縮 → データ読込 → タイトル。
import { installNoZoom } from "./core/no-zoom.js";
import { installDoubleTapGuard } from "./core/double-tap-guard.js";
import { TOURNAMENT_DAY } from "./core/rules.js";
import { $, sleep } from "./core/util.js";
import { loadAll, loadDeferredDialogues, loadCinemaDialogue, loadTournamentCraftDialogue, DB, bgUrl, portraitInfo, makingUrl } from "./core/data.js";
import { loadVnFonts } from "./core/vn-fonts.js";
import { initLayers, imageReady, FRAME_ART, warmUiArt } from "./core/ui.js";
import { loadConfig, state, load, consumeResumeOnBoot, tickPlayTime } from "./core/state.js";
import { unlockAudio, preloadBgm } from "./core/audio.js";
import { applyUiTheme } from "./core/ui-theme.js";
import { installRotateGuard } from "./core/rotate-guard.js";
import { imgFileUrl } from "./core/img-file.js";
import { withLoading } from "./core/loading.js";
import { vnTest, enableSeenLinePersistence } from "./vn/engine.js";
import { createDevInspector } from "./core/dev-inspector.js";
import { createEventPreview } from "./core/dev-event-preview.js";
import { createIsolatedEventPlayer } from "./core/dev-isolated-player.js";
import { craftTest } from "./craft/session.js";
import { showTitle } from "./scenes/title.js";
import { prepareTitleArt } from "./scenes/title-art.js";
import { isNormalTitleForced } from "./scenes/title-layout.js";
import { initGameLayout } from "./scenes/game-layout.js";
import { resumeGame } from "./chapters/ch1.js";
import { setGrowthPreview, growthEnabled, gainExp, ensureGrowth, openGrowthBoard } from "./core/growth.js";
installNoZoom(); // ダブルタップによる拡大を止める（#2826。ピンチは禁止しない）
installDoubleTapGuard(); // ダブルタップ拡大の保険（#2852）。no-zoom が入っていれば __suienNoZoom を見て自動で何もしない
enableSeenLinePersistence(); // 既読SKIPの記録は本編でだけ端末に残す
// デバッグ用の道具（URL に ?debug=1 で左下に「DBG」・?debug=0 で消す。速さ・シーシャ作りの自動など）。
// リリース前に、この1行と remake/js/dev/ のフォルダを消す（remake/README.md「デバッグ用の道具」）
try { const q = new URLSearchParams(location.search).get("debug"); if (q !== null) localStorage.setItem("suien_debug", q === "1" ? "1" : "0"); if (localStorage.getItem("suien_debug") === "1") import("./dev/debug-panel.js").then(m => m.mountDebugPanel()).catch(e => console.error(e)); } catch {}

const PHONE_DENSITY_K = 0.62;
function fitStage() {
  const stage = $("#stage");
  const viewport = window.visualViewport;
  // Browser zoom shrinks visualViewport in CSS pixels. Normalize that zoom out
  // of the game fit so it does not also change --k (or cancel accessible zoom).
  // Keep following the visible height when browser chrome / the keyboard moves.
  const zoom = viewport?.scale || 1;
  const w = viewport ? viewport.width * zoom : window.innerWidth;
  const h = viewport ? viewport.height * zoom : window.innerHeight;
  const k = Math.min(w / 1280, h / 720);
  stage.style.setProperty("--k", String(k));
  // スマホ規格（#2851）: 横持ちスマホ（Plus/Pro Max の 0.60 も含む）で共通部品の文字・タップ部品を大きくする。css/phone-density.css
  // 横長の画面だけ（PC の縦長ウィンドウや縦持ちは対象外。縦持ちのスマホは横向きの案内になる）
  if (k < PHONE_DENSITY_K && w > h) document.documentElement.dataset.density = "phone";
  else delete document.documentElement.dataset.density;
  // ワイドステージ（#2861）: 横長の画面では黒帯ぶんだけステージを広げる（高さは720のまま・最大1600）。
  // 中身の層は中央1280に置いたまま、背景と端へ出す部品だけが広がった幅を使う（base.css）。
  const stageW = Math.min(1600, Math.max(1280, Math.floor((w / h) * 720)));
  if (stageW > 1280) {
    stage.style.setProperty("--stage-w", `${stageW}px`);
    // 広げてもまだ残る黒帯（画面px）。safe-area のうち黒帯で吸収できない分だけ端の部品を内側へ寄せる
    stage.style.setProperty("--stage-bar", `${Math.max(0, (w - stageW * k) / 2)}px`);
    stage.dataset.wide = "";
  } else {
    stage.style.removeProperty("--stage-w");
    stage.style.removeProperty("--stage-bar");
    delete stage.dataset.wide;
  }
}

export async function boot() {
  fitStage();
  window.addEventListener("resize", fitStage);
  window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
  window.visualViewport?.addEventListener("resize", fitStage);
  installRotateGuard(); // 縦持ちの回転ガード中は、制作の時計と音を止める（#2941）
  initLayers();
  initGameLayout();
  const cfg = loadConfig();
  applyUiTheme(cfg.uiTheme);
  // 設定「揺れ・閃光を減らす」を CSS からも見えるようにする（場面の演出の閃光を省く・#2688 F11）
  document.body.classList.toggle("reduce-shake", !!cfg.reduceShake);
  const growthParam = new URLSearchParams(location.search).get("growth");
  if (growthParam === "1" || growthParam === "0") setGrowthPreview(growthParam === "1");
  // 自動再生制限: 最初の操作で音を解禁（以後も操作のたびに保険で呼ぶ・軽い）
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
  document.addEventListener("visibilitychange", tickPlayTime); // タブが隠れている間はプレイ時間を数えない（#2902）

  // 起動の待ち時間も、ゲーム内と同じ共通ロード画面（背景イラスト案B・ロゴ・発光ゲージ）で見せる。
  // 静的な #boot はモジュール読込前と起動失敗時の受け皿として残し、ゲートが閉じた後に役目を終える。
  // 漫画は boot 文脈の登録がないため表示されず、読了待ちも入らない（起動に追加の待ちを足さない）。
  let titleArt;
  await withLoading(async ({ report }) => {
    // データと一緒に書体も待つ（読み込み前の代わりの字で一瞬崩れて見えないように）。遅い回線では4秒で先へ
    const fonts = Promise.race([
      Promise.all(["500", "700", "900"].map((w) => document.fonts.load(`${w} 20px "Suien Gothic"`, "水煙前線あA7"))),
      new Promise((r) => setTimeout(r, 4000)),
    ]).catch(() => {});
    await Promise.all([loadAll((p) => {
      // ゲージはデータ読込の実績（済んだ割合）にだけ追従させる。表示の進捗で起動を止めない。
      try { report(Math.round(p * 100), 100); } catch { /* 表示だけの進捗で起動を止めない */ }
    }), fonts]);
    // 抽選した1枚だけをデコードしてから幕を開ける。全候補を起動時にダウンロードしない。
    [titleArt] = await Promise.all([prepareTitleArt(), preloadBgm("title"), Promise.all([
      imageReady(imgFileUrl("ui/ui_title_logo_rich.webp"), 3000),
      ...FRAME_ART.map((u) => imageReady(u, 3000, { keep: true })),
    ])]);
  }, { label: "ゲームを準備しています…", context: "boot", chapter: 1 });
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
  // 後段台詞はタイトル後に先読みする。失敗しても起動を妨げず、各入口で再試行する。
  loadDeferredDialogues().catch(() => {});
  loadCinemaDialogue().catch(() => {});
  loadTournamentCraftDialogue().catch(() => {});
  // 会話用の明朝2書体はタイトル後に先読みし、失敗時は会話開始時に再試行する。
  loadVnFonts().catch(() => {});
  // 先に小さなUIの絵（枠・看板・顔アイコン・スロットの図柄）を並行で。背景・立ち絵はそのあと1枚ずつ
  // 店ロゴはマップまで要らないので、タイトル直後の帯域を空けるためアイドル時に回す（ui.js 側）。
  await Promise.all([warmUiArt({ deferStores: true }), ...["bg_osu_map_day", "bg_osu_map_night"].map((bg) => imageReady(bgUrl(bg), 8000, { keep: true }))]);
  const bgs = ["bg_osu_map_day", "bg_osu_map_night", "bg_tonari_inside_day", "bg_tonari_inside_night", "bg_home_day", "bg_home_night", "bg_shop"];
  const faces = [["sumi", "normal"], ["tsumugi", "normal"], ["naru", "normal"], ["adam", "normal"], ["minto", "normal"], ["rio", "normal"], ["pakki", "normal"]];
  const urls = [
    ...bgs.map((b) => bgUrl(b)),
    ...faces.map(([c, f]) => portraitInfo(c, f)?.src),
    ...["bench_base.png", "stove_coil.png", "hookah_base.png"].map((m) => makingUrl(m)),
  ].filter(Boolean);
  for (const u of urls) await imageReady(u, 8000);
  // 大会ステージは大会当日にしか出ないので、最後にアイドル時へ回す（遅くとも8秒で必ず始める）。
  const warmStage = () => imageReady(bgUrl("bg_tournament_stage"), 8000);
  if (typeof requestIdleCallback === "function") requestIdleCallback(warmStage, { timeout: 8000 });
  else setTimeout(warmStage, 4000);
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
    // 経験値・レベル・火種（心得の盤 第二弾・未公開）をこの端末だけ有効にする。URLの ?growth=1 / ?growth=0 でも切り替わる
    growth(on) {
      if (on !== undefined) setGrowthPreview(!!on);
      return growthEnabled() && state ? { ...ensureGrowth() } : growthEnabled();
    },
    // 経験値を足す（寝ると精算される）。例: __remake.dev.addExp(400)
    addExp(n = 200) { return gainExp(n); },
    // 心得の盤を開く（?growth=1 のときだけ）。火種が無ければ addHidane で足す
    board() { return openGrowthBoard(); },
    addHidane(n = 5, kind = "any") { const g = ensureGrowth(); g.hidane[kind] = (g.hidane[kind] || 0) + n; return { ...g.hidane }; },
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
      for (const id of ["sumi", "tsumugi", "naru", "minto", "adam", "rio"]) state.met[id] = true;
      document.getElementById("screen").replaceChildren();
      const tonariNight = "res://assets/backgrounds/bg_tonari_inside_night.png";
      if (name === "cheki") {
        const scene = DB.dialogues.ch1_minto_first;
        return play({ dialogue_id: "dev_cheki", metadata: {}, lines: scene.branches.cheki_taken }, { bg: bgRef("peppermint") });
      }
      // LIME交換: lime（なる）／lime-adam／lime-minto-private（栞の私用アカウント）
      if (name.startsWith("lime")) {
        const [, id = "naru", context = null] = name.split("-");
        state.contacts = ["sumi", "tsumugi", "minto", "adam", "naru"].filter((c) => c !== id || context === "private");
        if (context === "private") Object.assign(state.flags, { _minto_name_known: true, _lime_exchange_shown_minto_private: true });
        state.flags[`_lime_contact_${id}`] = true;
        await setBg(bgUrl("bg_tonari_inside", "night"));
        return motions.limeExchange(id, context);
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
      if (name.startsWith("train")) {
        const tone = name.split("-")[1] === "night" ? "night" : "day";
        await setBg(bgUrl("bg_tonari_inside", tone));
        const { PRIVATE_PASSENGERS } = await import("./motions/train-passengers.js");
        const tokens = name.split("-").slice(1);
        const passenger = tokens.find(id => Object.hasOwn(PRIVATE_PASSENGERS, id));
        const destination = tokens.find(id => ["home", "widehanga"].includes(id));
        return motions.trainRide(() => setBg(bgUrl("bg_street", tone), { instant: true }), {
          ...(name.includes("halloween") ? { halloween: true } : {}), ...(passenger ? { cameo: passenger } : {}),
          ...(destination ? { to: destination } : {}),
        });
      }
      if (name.startsWith("shinkansen")) {
        const destination = name.split("-")[1] === "home" ? "home" : "tokyo";
        await setBg(bgUrl(destination === "home" ? "bg_mukai_shop" : "bg_tonari_inside", "day"));
        return motions.shinkansenRide(() => setBg(bgUrl(destination === "home" ? "bg_tonari_inside" : "bg_ch3_train_arrival"), { instant: true }),
          { from: destination === "home" ? "tokyo" : "home", to: destination });
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
      // プリクラ（#939）: purikura は演出だけ、purikura-scene はあげはのギャル友の回を通しで
      if (name.startsWith("purikura")) {
        const { ROOMS } = await import("./chapters/ch2-city-data.js");
        const { readDialogues } = await import("./core/chapter-data.js");
        Object.assign(state, { chapter: 2, slot: 0 });
        state.met.ageha = true;
        await setBg(ROOMS.ageha);
        if (name !== "purikura-scene") return motions.purikuraShot();
        Object.assign(DB.dialogues, await readDialogues("ch2_ageha_story", ["remake_ch2_ageha_gyaru"]));
        return play("remake_ch2_ageha_gyaru", { bg: ROOMS.ageha });
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
      window.__remake.state.flavorStock = { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 };
      window.__remake.state.flavors = ["double_apple", "mint", "blueberry", "lemon"];
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

