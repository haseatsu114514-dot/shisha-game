// スタッフロール（#517）。第5章のフィナーレを読み終えたあとに流し、終わったらタイトルへ戻る。
// 決定（2026-10-30）: 縦に流れる文字＋BGM。初回は飛ばせず、2回目からは飛ばせる。
// オーナー指定（2026-11-02）: 名前はすべて「あつき」。役職だけを並べる。
// 「2回目」は端末の設定（config.staffRollSeen）で覚えるので、新しく始め直した周回でも飛ばせる。
import { el, sleep } from "../core/util.js";
import { showScreen } from "../core/ui.js";
import { playBgm, stopBgm } from "../core/audio.js";
import { config, saveConfig } from "../core/state.js";

// 専用曲（スタッフロール用の、1回で終わる曲）ができたら、このキーだけ差し替える。今はタイトル曲を仮に当てる。
export const STAFF_ROLL_BGM = "title";
export const STAFF_ROLL_MS = 60000; // 流れる時間（最後の一行が画面の真ん中に止まるまで）
const HOLD_MS = 3500; // 最後の一行を止めて見せる時間
const FADE_MS = 1200;

export const STAFF_ROLL_TITLE = "水煙前線 -EN:CODE-";
// クレジットのデータ（ここだけ直せば画面に出る）。上から順に流れる。
// ゲームには他の作者の曲も入っているので、あつきの音楽の役職は「作曲」と書かない（曲は下の「使用楽曲」）。
export const STAFF_CREDITS = Object.freeze([
  { role: "企画・監督", name: "あつき" },
  { role: "シナリオ", name: "あつき" },
  { role: "キャラクターデザイン", name: "あつき" },
  { role: "グラフィック", name: "あつき" },
  { role: "選曲・サウンド", name: "あつき" },
  { role: "演出", name: "あつき" },
  { role: "プログラム", name: "あつき" },
  { role: "制作", name: "あつき" },
].map(credit => Object.freeze(credit)));

// 使用楽曲（他の作者の曲）。オーナー指定（2026-11-02）で、あつきの役職のあとに欄を作る。
// 根拠は asset_sources/music/README.md と confirmed-tournament-bgm-20261009.md（両配布元とも表記の形の指定は無い）。
// 配布元・作曲者が記録に無い曲は仮の文言を入れずに出さない。確かめたら1行足せば出る。
export const STAFF_MUSIC = Object.freeze([
  { title: "Overture!", composer: "秋山裕和", source: "H/MIX GALLERY" },
  { title: "Mind Duel", composer: "shimtone", source: "OpenTracks" },
  { title: "おいしいお菓子を捧げよ！", composer: "Napi", source: "M-ART" },
].map(song => Object.freeze(song)));
export const STAFF_ROLL_CLOSING = "Thank you for playing";

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** 今このスタッフロールを飛ばせるか（一度最後まで見た端末だけ） */
export const staffRollSkippable = () => config.staffRollSeen === true;

function sections() {
  return [
    el("section.staff-roll-title", [el("h1", { text: STAFF_ROLL_TITLE })]),
    ...STAFF_CREDITS.map(({ role, name }) => el("section.staff-roll-credit", [
      el("p.staff-roll-role", { text: role }),
      el("p.staff-roll-name", { text: name }),
    ])),
    STAFF_MUSIC.length ? el("section.staff-roll-music", [
      el("p.staff-roll-role", { text: "使用楽曲" }),
      ...STAFF_MUSIC.map(({ title, composer, source }) => el("div.staff-roll-song", [
        el("p.staff-roll-song-title", { text: `「${title}」` }),
        el("p.staff-roll-song-credit", { text: `作曲 ${composer}（${source}）` }),
      ])),
    ]) : null,
    el("section.staff-roll-closing", [el("p", { text: STAFF_ROLL_CLOSING })]),
  ].filter(Boolean);
}

/**
 * スタッフロールを最後まで（または飛ばすまで）流す。終わると端末に「見た」を記録する。
 * @param opts.durationMs 流れる時間（テストでだけ短くする）
 * @param opts.skippable 飛ばすボタンを出すか（既定は一度見た端末だけ）
 * @returns {Promise<{ skipped: boolean }>}
 */
export async function playStaffRoll({ durationMs = STAFF_ROLL_MS, skippable = staffRollSkippable() } = {}) {
  const reduced = reducedMotion();
  const parts = sections();
  const track = el("div.staff-roll-track", parts);
  let skip = null;
  const skipped = new Promise(resolve => { skip = resolve; });
  const button = skippable
    ? el("button.staff-roll-skip", { type: "button", dataset: { test: "staff-roll-skip" }, text: "SKIP", onclick: () => skip(true) })
    : null;
  const host = el("main.staff-roll", {
    dataset: { test: "staff-roll", mode: reduced ? "pages" : "scroll", skippable: skippable ? "yes" : "no" },
    "aria-label": "スタッフロール",
  }, [el("div.staff-roll-view", [track]), button]);
  const onKey = event => {
    if (!skippable || !["Escape", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    skip(true);
  };
  showScreen("staff-roll", host);
  playBgm(STAFF_ROLL_BGM);
  window.addEventListener("keydown", onKey);
  const hold = durationMs >= STAFF_ROLL_MS ? HOLD_MS : Math.round(durationMs * 0.1);
  let animation = null;
  let timer = null;
  try {
    await new Promise(requestAnimationFrame);
    const run = reduced ? showPages(parts, durationMs, ms => (timer = ms)) : scroll(host, track, parts.at(-1), durationMs, a => (animation = a));
    const result = await Promise.race([run.then(() => sleep(hold)).then(() => false), skipped]);
    config.staffRollSeen = true;
    saveConfig();
    host.classList.add("ending");
    stopBgm(FADE_MS / 1000);
    await sleep(durationMs >= STAFF_ROLL_MS ? FADE_MS : 0);
    return { skipped: result === true };
  } finally {
    window.removeEventListener("keydown", onKey);
    animation?.cancel();
    if (timer) clearTimeout(timer.id);
  }
}

/** 下から上へ流し、最後の一行を画面の真ん中で止める。アニメーションが止まっても時間で必ず進める。 */
function scroll(host, track, last, durationMs, keep) {
  const view = host.clientHeight || 720;
  const end = view / 2 - (last.offsetTop + last.offsetHeight / 2);
  const animation = track.animate([{ transform: `translateY(${view}px)` }, { transform: `translateY(${end}px)` }],
    { duration: durationMs, easing: "linear", fill: "forwards" });
  keep(animation);
  return Promise.race([animation.finished.catch(() => {}), sleep(durationMs + 500)]);
}

/** 動きを減らす設定: 動かさずに1枚ずつ入れ替える（最後の一行で止まる）。 */
async function showPages(parts, durationMs, keep) {
  const each = Math.max(1, Math.floor(durationMs / parts.length));
  for (const [index, part] of parts.entries()) {
    parts.forEach(other => other.classList.toggle("on", other === part));
    if (index < parts.length - 1) await new Promise(resolve => keep({ id: setTimeout(resolve, each) }));
  }
}
