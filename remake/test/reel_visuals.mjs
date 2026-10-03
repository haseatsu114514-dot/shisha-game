// /remake/test/reel_visuals.html を実ブラウザで開く。実際のCSS補間を毎フレーム検査する。
// セーブへの報酬・回転数の加算は行わない（forceは表示専用）。
import { loadAll, faceIconUrl } from "../js/core/data.js";
import { initLayers, gainCard, layers } from "../js/core/ui.js";
import { newGame, state, loadConfig } from "../js/core/state.js";
import { mountReel, force, core } from "../js/daily/reel.js";
import { sleep, nextFrame } from "../js/core/util.js";

const output = document.querySelector("#checks");
const check = (ok, message) => { if (!ok) throw new Error(message); };
const fit = () => document.querySelector("#stage").style.setProperty("--k", Math.min(innerWidth / 1280, innerHeight / 720));
fit(); window.addEventListener("resize", fit);

async function waitFor(predicate, ms = 10000) {
  const end = performance.now() + ms;
  while (!predicate()) {
    check(performance.now() < end, "演出待ちのタイムアウト");
    await sleep(25);
  }
}
const pos = (node, cell) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 / cell;

async function runCase(role, variant, remount = false) {
  output.textContent = `検証中: ${role} / ${variant}`;
  const rewardBefore = JSON.stringify({ stats: state.stats, count: state.reel.count });
  force(role, variant);
  await waitFor(() => document.querySelector(".rc-board"));
  let frames = 0, rightOnly = 0, slowing = 0, remounted = false;
  const slowPositions = new Set();
  while (document.querySelector(".rc-board")) {
    await nextFrame();
    const large = [...document.querySelectorAll(".rc-strip")];
    if (!large.length) break;
    const mini = [...document.querySelectorAll(".rw-strip")];
    check(mini.length === 3, "小筐体のリールが足りない");
    for (let i = 0; i < 3; i++) {
      check(Math.abs(pos(large[i], 66) - pos(mini[i], 26)) < 0.025,
        `${role}/${variant}: リール${i + 1}の位置が拡大盤と一致しない`);
      check(large[i].classList.contains("spinning") === mini[i].classList.contains("spinning"),
        `${role}/${variant}: リール${i + 1}の回転/停止が一致しない`);
      check(getComputedStyle(mini[i]).animationName === "none", "小筐体が別の時計で回転している");
    }
    if (!large[0].classList.contains("spinning") && !large[1].classList.contains("spinning") && large[2].classList.contains("spinning")) {
      rightOnly++;
      if (remount && !remounted) {
        layers.screen.replaceChildren();
        mountReel(layers.screen);
        remounted = true;
        await nextFrame(); // 新しい筐体にも次の描画フレームで追従する。
      }
    }
    if (large[2].style.transition.includes("1.25s") && !document.querySelector(".rc-board.done")) {
      slowing++;
      slowPositions.add(Math.round(pos(large[2], 66) * 1000));
    }
    frames++;
  }
  check(frames > 60 && rightOnly > 10 && slowing > 10, "右だけ回転・減速する区間を検証できなかった");
  check(slowPositions.size > 10, "最後のリールが実際に減速しながら動いていない");
  check(!remount || remounted, "筐体の再マウントを検証できなかった");
  check(!document.querySelector(".rw-strip.mirrored"), "演出終了後に同期処理が残っている");
  const right = core.STRIPS[2];
  const sevenBar = right.findIndex((symbol, i) => symbol === "seven" && right[(i + 1) % right.length] === "bar");
  const expected = [core.STRIPS[0].indexOf("seven"), core.STRIPS[1].indexOf("seven"), sevenBar + (role === "reg" ? 1 : 0)];
  [...document.querySelectorAll(".rw-strip")].forEach((node, i) => {
    check(Math.abs(pos(node, 26) + expected[i] + core.STRIPS[i].length - 1) < 0.025,
      `${role}/${variant}: 小筐体の最終出目が7・7・${role === "reg" ? "BAR" : "7"}になっていない`);
  });
  check(JSON.stringify({ stats: state.stats, count: state.reel.count }) === rewardBefore, "表示テストで報酬または回転数が変わった");
  console.log(`[reel-visuals] PASS ${role}/${variant}: ${frames} frames, right-only ${rightOnly}, slow ${slowing}${remount ? ', remount' : ''}`);
}

function colorPreview() {
  gainCard({ kind: "stat", stat: "charm", badge: "魅", top: "STATUS UP", main: "魅力", sub: "上がった" });
  gainCard({ kind: "affinity", face: faceIconUrl("tsumugi"), top: "AFFINITY UP", main: "つむぎ", sub: "好感度が上がった", hearts: { from: [100,0,0,0,0], to: [100,40,0,0,0] } });
}

try {
  loadConfig();
  initLayers();
  await loadAll();
  await Promise.all(["500", "700"].map((w) => document.fonts.load(`${w} 20px "Suien Gothic"`)));
  newGame(); state.phase = "daily"; state.reel.introDone = true;
  await mountReel(layers.screen);
  for (const file of ["symbols.png", "symbols-premium.png", "bezel.png"]) {
    const img = new Image(); img.src = `img/ui/pakki-slot/${file}`;
    await img.decode(); check(img.naturalWidth > 0, `生成画像が読めない: ${file}`);
  }
  for (const id of ["seven", "bar", "smoke", "pakki"]) {
    check(getComputedStyle(document.querySelector(`.sym-${id}`)).backgroundImage.includes("symbols-premium.png"), `${id}の新しい図柄が反映されていない`);
  }
  for (const node of document.querySelectorAll(".sym")) {
    const art = node.getBoundingClientRect(), cell = node.parentElement.getBoundingClientRect();
    check(art.width <= cell.width && art.height <= cell.height, "新しい図柄がリールのコマからはみ出している");
    check(Math.abs((art.top + art.bottom) - (cell.top + cell.bottom)) < 0.1, "図柄がコマの中央にない");
  }
  const seven = document.querySelector(".sym-seven").getBoundingClientRect();
  check(seven.width / seven.height > 1.6, "赤7が横長になっていない");
  check(getComputedStyle(document.querySelector(".rw-machine"), "::before").backgroundImage.includes("bezel.png"), "枠の差し替えが反映されていない");
  colorPreview();
  await nextFrame();
  const charm = document.querySelector(".gain-card.st-charm"), affinity = document.querySelector(".gain-card.affinity");
  check(getComputedStyle(charm).getPropertyValue("--gc").trim() === "#b49aef", "魅力が紫になっていない");
  check(getComputedStyle(affinity).getPropertyValue("--gc").trim() === "#f48fb1", "好感度のピンクが変わっている");
  for (const [role, variant] of [["big", "before"], ["big", "after"], ["reg", "before"], ["reg", "after"]]) {
    await runCase(role, variant, role === "reg" && variant === "after");
  }
  // 通常回転に戻ったあとにミラー用のCSS・補間設定が残らないことも確認。
  force("miss");
  await nextFrame();
  check([...document.querySelectorAll(".rw-strip")].every((n) => getComputedStyle(n).animationName === "rw-spin"), "通常回転が復帰しない");
  await waitFor(() => !document.querySelector(".rw-strip.spinning"));
  output.textContent = "PASS: BIG/REGの先告知・後告知、右リールの回転/減速、再マウント、通常回転、画像、通知色";
  document.body.dataset.result = "pass";
  const preview = document.querySelector("#preview"); preview.hidden = false;
  preview.onclick = async () => {
    preview.disabled = true;
    force("big", "before");
    await waitFor(() => document.querySelector(".rc-board.reach"));
    colorPreview();
    await waitFor(() => !document.querySelector(".rc-board"));
    preview.disabled = false;
  };
} catch (error) {
  output.textContent = `FAIL: ${error.message}`;
  document.body.dataset.result = "fail";
  console.error(error);
}
