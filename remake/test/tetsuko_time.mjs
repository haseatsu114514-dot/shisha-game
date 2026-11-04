// 「てつこといっしょ / TETSUKO TIME」の入口の土台（#2454）: 選べる入口と準備中の画面だけで、
// 保存は一切変えない。正ゲーム（なでる・猫じゃらし・気分・図鑑・アルバム等）はまだ実装しない。
// ここでは DOM を持たない足場の契約だけを検証する（実UIの到達フローは browser/ch3_tokyo_daily.mjs）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { newState } from "../js/core/state.js";
import { TOKYO_OUTINGS } from "../js/chapters/ch3-outing-progress.js";
import { TETSUKO_TIME, settleTetsukoTime, openTetsukoTime } from "../js/minigames/tetsuko-time.js";

// 入口モジュールの契約: メタ情報と、開く関数・確定点の形。
{
  assert.deepEqual(TETSUKO_TIME, { id: "tetsuko_time", title: "てつこといっしょ", roman: "TETSUKO TIME" });
  assert.equal(typeof openTetsukoTime, "function", "open(context) 形式の入口がある");
  assert.equal(typeof settleTetsukoTime, "function", "本編アダプターの確定点がある（§10-4）");
}

// 足場は何も確定しない: 回復・来訪・好感度・フラグ・時間を動かさない。引数の有無によらず副作用なし。
{
  assert.deepEqual(settleTetsukoTime(), { committed: false }, "引数なしでも確定なし");
  const value = newState();
  value.chapter = 3; value.stamina = 40; value.money = 5000; value.slot = 1;
  value.flags._ch3_outings = { tetsuko: 2, mukai_help: 1 };
  const before = structuredClone(value);
  const out = settleTetsukoTime(value, { played: true, petted: true });
  assert.deepEqual(out, { committed: false }, "意味のあるふれあいを渡しても足場は確定しない");
  assert.deepEqual(value, before, "準備中の入口はセーブを一切変えない（回復・来訪・フラグ・時間なし）");
}

// ソース走査: 足場が報酬・保存の API を一切使っていないこと（うっかり書き戻しの再発防止）。
{
  const src = fs.readFileSync(new URL("../js/minigames/tetsuko-time.js", import.meta.url), "utf8");
  // コメントの日本語（回復(12) 等）には当たらない、実際の書き込み API のトークンだけを禁止する。
  for (const banned of ["addStamina", "gainAffinity", "earnStat", "addMoney", "earnSceneCompletion",
    "paidAction", "spinReel", "save()", "state.flags", "OUTINGS_FLAG"]) {
    assert(!src.includes(banned), `足場は ${banned} を使わない（保存・報酬を動かさない）`);
  }
  assert(!/from\s+["'][^"']*core\/stats\.js["']/.test(src), "足場は stats.js（報酬 API）を import しない");
  // TODO と §10 の責務分割が残っていること（後任が差し込み点を見つけられる）。
  assert(src.includes("TODO(#2454)"), "正ゲームの差し込み点に TODO(#2454) がある");
  assert(src.includes("§10"), "§10 の責務分割（モデル/画面/データ/アダプター/アルバム）を記す");
}

// 回帰の砦: 既存の「少し構っていく」の外出定義（回復+12・4段階＋巡回。#1993）を壊していない。
{
  const cat = TOKYO_OUTINGS.find(item => item.id === "tetsuko");
  assert(cat, "てつこの外出は残っている");
  assert.equal(cat.stamina, 12, "回復は内部値12のまま（二重化しない土台）");
  assert.equal(cat.place, "mukai");
  assert(cat.repeat === true, "何度でも会える");
  assert(!cat.stat && !cat.money, "能力・お金の報酬は付かない");
  assert.equal(cat.stages.length, 4, "関係は既存4段階");
  assert.equal(cat.loop.length, 3, "4段階の後は巡回3場面");
}

console.log("tetsuko time entry scaffold: ok");
