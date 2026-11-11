// 「てつこといっしょ / TETSUKO TIME」（#2454）のモデルと確定点。DOM を持たない部分だけを Node で確かめる
// （実UIの到達・確定は browser/ch3_tokyo_daily.mjs）。
// 入口の足場（PR #2521）の「保存を一切変えない」契約は、正ゲーム化で次の新しい契約に置き換えた:
//   確定点 settleTetsukoTime は、意味のあるふれあいで未確定の訪問キーのときだけ、来訪記録 +1 と _tetsuko_time を書き、
//   回復 12 を返す（体力の加算は呼び出し側）。それ以外は保存に触らない。能力・お金・好感度・日付・時間帯は書かない。
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { newState } from "../js/core/state.js";
import { TOKYO_OUTINGS, OUTINGS_FLAG } from "../js/chapters/ch3-outing-progress.js";
import { classifyFlag } from "../js/core/carry.js";
import { TETSUKO_TIME, TETSUKO_STAMINA, TETSUKO_CAMERA, TETSUKO_TOY_VIEW, TETSUKO_LEAP, WATCH_IDLE_MS, tetsukoCameraFor, tetsukoToyCamera, petZoneAt,
  settleTetsukoTime, tetsukoVisitKey, openTetsukoTime } from "../js/minigames/tetsuko-time.js";
import {
  TETSUKO_TIME_FLAG, MOODS, MOMENTS, PROPS, SLOTS, ALBUM_LIMIT, PET_REST_STREAK, PLAY_PAW, PLAY_AUTO_CATCH, AUTO_DELAY,
  JOY, JOY_MAX, JOY_HEARTS, PET_ZONES, SWEET_ZONES, WISH_PATIENCE,
  moodOf, moodLabel, relationStage, sessionStage, readTetsukoRecord, createSession, openingReaction, act, canAct,
  autonomous, autoDelay, placeProp, takePhoto, farewell, sessionResult, unlockedProps, discoveryGuide,
  invite, peakReaction, seekMoment, sweetZoneOf, joyHearts,
} from "../js/minigames/tetsuko-model.js";
import { HELP } from "../js/minigames/tetsuko-help.js";

const CAT = TOKYO_OUTINGS.find(item => item.id === "tetsuko");
/** 第3章・東京の一日。来訪回数と面識を決めたセーブ。 */
function save({ count = 0, day = 40, slot = 1, mashiro = true, record } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 3, day, slot, stamina: 40, money: 5000, phase: "daily" });
  value.flags[OUTINGS_FLAG] = count ? { tetsuko: count, mukai_help: 2 } : { mukai_help: 2 };
  if (record) value.flags[TETSUKO_TIME_FLAG] = record;
  if (mashiro) value.met.mashiro = true;
  value.affinity.mashiro = 7;
  return value;
}
const everyText = [], everyPop = [];
const keep = reaction => {
  if (reaction?.text) everyText.push(reaction.text);
  if (reaction?.pop) everyPop.push(reaction.pop);
  for (const step of reaction?.steps || []) { everyText.push(step.text); if (step.pop) everyPop.push(step.pop); }
  return reaction;
};

// 入口の形: メタ情報・開く関数・確定点。回復は「少し構っていく」と同じ内部値。
{
  assert.deepEqual(TETSUKO_TIME, { id: "tetsuko_time", title: "てつこといっしょ", roman: "TETSUKO TIME" });
  assert.equal(typeof openTetsukoTime, "function");
  assert.equal(TETSUKO_STAMINA, 12);
  assert.equal(CAT.stamina, TETSUKO_STAMINA, "回復は内部値12のまま（二重化しない）");
}

// 回帰の砦: 既存の外出定義（4段階＋巡回3本・能力やお金の報酬なし。#1993）を壊していない。
{
  assert.equal(CAT.place, "mukai");
  assert(CAT.repeat === true);
  assert(!CAT.stat && !CAT.money && !CAT.affinityWith, "能力・お金・好感度の報酬は付かない");
  assert.deepEqual(CAT.stages, ["ch3_outing_tetsuko", "ch3_outing_tetsuko_brush", "ch3_outing_tetsuko_wait", "ch3_outing_tetsuko_trust"]);
  assert.deepEqual(CAT.loop, ["ch3_outing_tetsuko_lap", "ch3_outing_tetsuko_belly", "ch3_outing_tetsuko_door"]);
}

// 周回: 記録は来訪記録と同じく持ち越さない。
assert.equal(classifyFlag(TETSUKO_TIME_FLAG), "progression", "_tetsuko_time は周回で持ち越さない（_ch3_outings と同じ）");
assert.equal(classifyFlag(OUTINGS_FLAG), "progression");

// 気分は通算日で決まり、開き直しで変わらない。4つとも出る。段階0〜1の「甘えたい」は言い換える。
{
  for (let day = 1; day <= 30; day += 1) assert.equal(moodOf(day).id, moodOf(day).id);
  assert.equal(createSession(save({ day: 41 })).mood, createSession(save({ day: 41, count: 3 })).mood, "同じ日は回数によらず同じ気分");
  const seen = new Set(Array.from({ length: 60 }, (_, index) => moodOf(index + 1).id));
  assert.deepEqual([...seen].sort(), MOODS.map(mood => mood.id).sort());
  const clingy = MOODS.find(mood => mood.id === "clingy");
  assert.match(moodLabel(clingy, 0), /気にしている/);
  assert.match(moodLabel(clingy, 3), /甘えたい/);
}

// 関係の段階は来訪記録から導く（新しい数値を作らない）: 回数 0,1→0／2→1／3→2／4以上→3。
// 今回の段階は、入口で読む段階会話の分を含める（回数4未満なら次の会話を読んでから来る）。
{
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(relationStage), [0, 0, 1, 2, 3, 3, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(sessionStage), [0, 1, 2, 3, 3, 3]);
  // 旧セーブ（膝・見送りまで来ている）は最初から気を許した段階。_tetsuko_time が無くても既定で入れる。
  const old = save({ count: 7 });
  const session = createSession(old, { visitKey: tetsukoVisitKey(old) });
  assert.equal(session.stage, 3);
  assert.deepEqual(session.props, { bench: null, floor: null, bed: null });
  assert.deepEqual(session.found, []);
  assert.equal(readTetsukoRecord(old).sessions, 0);
}

// 画面を開いたとき: 段階2以上は「こちらを待っていた」（④）。どの段階でも反応がある。開いただけでは確定しない。
{
  for (const count of [0, 1, 2, 4]) {
    const session = createSession(save({ count }));
    const reaction = keep(openingReaction(session));
    assert(reaction.text.length > 0);
    assert.equal(session.meaningful, false, "開いただけでは意味のあるふれあいにならない");
    assert.equal(reaction.found === "waiting", session.stage >= 2, `回数${count}: 待っていたのは段階2以上`);
  }
}

// なでる: 段階で反応が変わる。続けすぎると休止（今は、もういいらしい）、ほかの操作か、てつこが自分で動くと戻る。
// 関係は下がらない（来訪記録に触らない）。
{
  const value = save({ count: 1 });
  const before = structuredClone(value);
  const session = createSession(value);
  const texts = [];
  for (let i = 0; i < PET_REST_STREAK; i += 1) texts.push(keep(act(session, "pet")).text);
  assert.match(texts[PET_REST_STREAK - 1], /もういいらしい/, "続けすぎると「今は、もういいらしい」");
  assert(!texts.slice(0, -1).some(text => /もういい/.test(text)));
  assert.match(keep(act(session, "pet")).text, /もういいらしい/, "続けている間は休止のまま");
  keep(act(session, "watch"));
  assert.doesNotMatch(keep(act(session, "pet")).text, /もういい/, "ほかの操作をすれば戻る");
  for (let i = 0; i < PET_REST_STREAK; i += 1) keep(act(session, "pet"));
  session.autoTicks = 0; session.wish = { kind: "watch" };
  assert(!autonomous(session).quiet);
  assert.doesNotMatch(keep(act(session, "pet")).text, /もういい/, "てつこが自分で動いた後も、またなでられる");
  assert.equal(session.stage, 1, "休止しても段階は下がらない");
  assert.deepEqual(value, before, "モデルはセーブを書かない");
  // 気を許した段階のなでるは「初めてすりすり」（⑤）。
  const close = createSession(save({ count: 5 }));
  assert.equal(keep(act(close, "pet")).found, "first_rub");
  assert.equal(keep(act(createSession(save({ count: 0 })), "pet")).found, null, "様子見の段階では、すりすりはまだ");
}

// なでる場所（§10）: 頭・あご・背中のどれかが今日のお気に入り（日によって変わる・同じ日は同じ）。見つけると喉が鳴り、ごきげんが多めにたまる。
// しっぽだけは触らせてくれない（ぷいと向くだけ。ごきげんは減らず、続けた回数にも数えない）。広い範囲で分け、一点の正解探しにしない。
{
  const days = Array.from({ length: 40 }, (_, index) => sweetZoneOf(index + 1));
  assert.deepEqual([...new Set(days)].sort(), [...SWEET_ZONES].sort(), "お気に入りは3か所とも出る");
  for (let day = 1; day <= 20; day += 1) assert.equal(sweetZoneOf(day), sweetZoneOf(day), "同じ日は同じ場所");
  assert(!SWEET_ZONES.includes("tail") && PET_ZONES.includes("tail"));
  for (const count of [0, 1, 2]) {
    const session = createSession(save({ count, day: 12 }));
    const plain = SWEET_ZONES.find(zone => zone !== session.sweet);
    const dull = keep(act(session, "pet", { zone: plain }));
    const liked = keep(act(session, "pet", { zone: session.sweet }));
    assert.equal(dull.sweet, false);
    assert.equal(liked.sweet, true, `回数${count}: お気に入りの場所に気づく`);
    assert(liked.joy.gain > 0 && dull.joy.gain > 0, "どこをなでても、ごきげんは少し上がる");
    assert.notEqual(liked.text, keep(act(session, "pet", { zone: session.sweet })).text, "2回目からは別の文");
    const joy = session.joy, streak = session.petStreak;
    const tail = keep(act(session, "pet", { zone: "tail" }));
    assert.match(tail.text, /しっぽ/);
    assert.equal(tail.joy.gain, 0);
    assert.equal(session.joy, joy, "しっぽを触っても、ごきげんは減らない");
    assert.equal(session.petStreak, streak, "しっぽは、続けた回数に数えない");
    assert.equal(keep(act(session, "pet", { zone: "nowhere" })).zone, "head", "知らない場所は頭として扱う");
  }
  // 画面の当たり: 座った絵は上から頭・あご、下の左がしっぽ、ほかは背中。丸くなった絵は右が頭。向きを変えた時は左右を入れ替える。
  assert.equal(petZoneAt(.5, .2), "head");
  assert.equal(petZoneAt(.5, .55), "chin");
  assert.equal(petZoneAt(.6, .8), "back");
  assert.equal(petZoneAt(.15, .85), "tail");
  assert.equal(petZoneAt(.85, .85, { flip: true }), "tail");
  assert.equal(petZoneAt(.15, .85, { flip: true }), "back");
  assert.equal(petZoneAt(.8, .7, { curled: true }), "head");
  assert.equal(petZoneAt(.2, .7, { curled: true }), "back");
  assert.equal(petZoneAt(NaN, NaN), "head");
  for (let x = 0; x <= 1; x += .05) for (let y = 0; y <= 1; y += .05) assert(PET_ZONES.includes(petZoneAt(x, y)), "枠のどこを触っても、どこかの場所になる");
}

// 猫じゃらし: 見る→狙う→前足（①）→飛びつく。飛びついた先にじゃらしがあれば捕まえ（段階0は押さえてすぐ離す、1以上は抱える＝②）、
// 引いていれば空振り。5回振ったら必ず捕まえる（逃がし続ける勝負にしない）。空振りは2回まで続き、その次は必ず捕まえる。
{
  const shy = createSession(save({ count: 0 }));
  assert.equal(canAct(shy, "catch"), false, "振る前は捕まえられない");
  assert.equal(canAct(shy, "miss"), false, "振る前は空振りもない");
  const swings = [1, 2, 3, 4, 5].map(() => keep(act(shy, "play")));
  assert.deepEqual(swings.map(item => item.kind), ["play", "play", "play", "play", "catch"]);
  assert.equal(PLAY_PAW, 3);
  assert.equal(swings[2].found, "first_paw");
  assert.equal(swings[3].found, null, "同じしぐさは一度だけ記録");
  assert(swings.every(item => !item.pounce), "様子見の段階は飛びつかない（その場で前足を出す）");
  assert.equal(swings[4].found, null, "様子見の段階は押さえてすぐ離す（抱えるのはまだ）");
  assert.equal(shy.swings, 0, "捕まえたら、じゃらしは手元へ戻る");
  const friend = createSession(save({ count: 1 }));
  keep(act(friend, "play"));
  const hold = keep(act(friend, "catch"));
  assert.equal(hold.kind, "catch");
  assert.equal(hold.found, "hug_toy");
  const auto = createSession(save({ count: 3 }));
  const run = Array.from({ length: PLAY_AUTO_CATCH - 1 }, () => keep(act(auto, "play")));
  assert.deepEqual(run.map(item => !!item.pounce), [false, false, false, true], "前足の次のひと振りで飛びつく");
  assert.equal(keep(act(auto, "play")).found, "hug_toy", "5回目は必ず捕まえて抱える");
  // 空振り: 飛びついた先にじゃらしが無かった。てつこの負けではなく遊びの一コマで、ごきげんは上がる。
  const dodge = createSession(save({ count: 2 }));
  for (let i = 0; i < PLAY_PAW + 1; i += 1) keep(act(dodge, "play"));
  const joy = dodge.joy;
  const first = keep(act(dodge, "miss"));
  assert.equal(first.kind, "miss");
  assert.match(first.text, /空振り/);
  assert(dodge.joy > joy, "空振りでも、ごきげんは上がる");
  assert.equal(keep(act(dodge, "play")).pounce, true, "空振りの後は、もう一度飛びつく");
  assert.notEqual(keep(act(dodge, "miss")).text, first.text, "2回目の空振りは別の文");
  assert.equal(keep(act(dodge, "play")).kind, "catch", "空振りが2回続いたら、次は必ず捕まえる");
  assert.equal(dodge.swings, 0);
  assert.equal(dodge.misses, 0);
}

// ブラシ: ブラシの会話を読んだ後（段階1以上）。1回目でうっとり（③）。採点しない。
{
  const shy = createSession(save({ count: 0 }));
  assert.equal(canAct(shy, "brush"), false);
  assert.equal(act(shy, "brush"), null, "できない操作は何も変えない");
  assert.equal(shy.meaningful, false);
  const friend = createSession(save({ count: 1 }));
  assert.equal(keep(act(friend, "brush")).found, "brush_bliss");
  assert(keep(act(friend, "brush")).text.length > 0, "2回目以降も反応がある");
}

// おやつ: ゲーム内の1日に1回。同じ日の2回目は押せない。翌日はまた出せる。なくても関係は進む。
{
  const value = save({ count: 2, day: 50 });
  const session = createSession(value);
  const treat = keep(act(session, "treat"));
  assert(treat.steps.length >= 2, "匂いを確かめる→食べる→顔を洗う");
  assert.equal(canAct(session, "treat"), false);
  assert.equal(act(session, "treat"), null);
  assert(settleTetsukoTime(value, { ...sessionResult(session), visitKey: "3:50:1:2" }).committed);
  assert.equal(value.flags[TETSUKO_TIME_FLAG].treatDay, 50);
  assert.equal(canAct(createSession(value), "treat"), false, "同じ日に入り直しても、今日はもうあげた");
  value.day = 51;
  assert.equal(canAct(createSession(value), "treat"), true, "翌日はまた出せる");
}

// 見守る: 1回目は前足をそろえる（⑧）。気を許した段階で甘えたい日か2回目以降は膝で寝る（⑩・ムカイさんの小声）。
{
  const session = createSession(save({ count: 0 }));
  const first = keep(act(session, "watch"));
  assert.equal(first.found, "paws_together");
  assert.equal(session.meaningful, true, "見守る1回だけでも意味のあるふれあい");
  assert(keep(act(session, "watch")).text.length > 0, "2回目以降も何か起きる");
  const close = createSession(save({ count: 4 }));
  keep(act(close, "watch"));
  const lap = close.mood === "clingy" ? close : (keep(act(close, "watch")), close);
  assert(lap.found.includes("lap_nap"), "気を許したら膝で寝る");
  assert.equal(lap.cat.pose, "lap");
  assert(canAct(lap, "pet") && canAct(lap, "play"), "膝に乗られても、ほかの操作ができる（操作不能にしない）");
}

// 小物: 3枠に置く。解放は段階と面識で増え、減らない。同じ物は一か所だけ。
{
  const ids = (stage, met) => unlockedProps(stage, met).map(prop => prop.id);
  assert.deepEqual(ids(0, true), ["box", "ball"]);
  assert.deepEqual(ids(1, true), ["box", "ball", "cushion"]);
  assert.deepEqual(ids(2, false), ["box", "ball", "cushion", "scratcher"], "トンネルはましろちゃんを知ってから");
  assert.deepEqual(ids(2, true), ["box", "ball", "cushion", "scratcher", "tunnel"]);
  assert.deepEqual(ids(3, true), PROPS.map(prop => prop.id));
  const session = createSession(save({ count: 0 }));
  assert.deepEqual(session.newProps, ["box", "ball"], "初めての訪問で、箱とボールが使える");
  assert.equal(placeProp(session, "bench", "cushion"), false, "まだ借りていない物は置けない");
  assert.equal(placeProp(session, "bench", "ball"), false, "ボールは床だけ");
  assert(placeProp(session, "bench", "box"));
  assert(placeProp(session, "floor", "box"), "別の枠へ置けば移る");
  assert.deepEqual(session.props, { bench: null, floor: "box", bed: null });
  assert(placeProp(session, "floor", null));
  assert.deepEqual(session.props, { bench: null, floor: null, bed: null });
  assert.equal(session.meaningful, false, "もようがえだけでは確定しない");
  assert.deepEqual(createSession(save({ count: 1 })).newProps, ["cushion"], "ブラシの会話の日に、座布団を借りる");
  assert.deepEqual(createSession(save({ count: 2 })).newProps, ["scratcher", "tunnel"], "待っていた日に、爪とぎとトンネル");
  assert.deepEqual(createSession(save({ count: 3 })).newProps, ["bed"], "すり寄ってきた日に、猫ベッド");
  assert.deepEqual(createSession(save({ count: 6 })).newProps, [], "その後は増えない");
  for (const prop of PROPS) for (const slot of prop.slots) assert(SLOTS.includes(slot));
}

// 自律行動: 1回おきに待機を挟み、直前と同じ行動は引かない。置いた物を使う。未発見を優先する。
{
  for (const day of [3, 17, 40, 77]) {
    const session = createSession(save({ count: 2, day }));
    placeProp(session, "floor", "box");
    const picks = [];
    for (let i = 0; i < 24; i += 1) picks.push(keep(autonomous(session)));
    for (let i = 1; i < picks.length; i += 2) assert.equal(picks[i].quiet, true, "1回おきに落ち着く");
    const acts = picks.filter(pick => !pick.quiet).map(pick => pick.id);
    for (let i = 1; i < acts.length; i += 1) assert.notEqual(acts[i], acts[i - 1], "同じ行動を続けて引かない");
    assert(session.found.includes("box_peek"), `day ${day}: 箱を置くと、数回のうちに箱から顔だけ出す`);
    assert(acts.some(id => id === "box_in" || id === "box_peek"), "置いた物を使う");
    assert.equal(session.meaningful, true, "しぐさを見届けたら、見守ったのと同じ");
  }
  const quiet = createSession(save({ count: 0 }));
  assert.equal(autonomous(quiet).quiet, undefined);
  assert.equal(quiet.meaningful, false, "何も見つけなければ、眺めていただけでは確定しない");
  const s = createSession(save());
  for (let i = 0; i < 6; i += 1) {
    const delay = autoDelay(s);
    assert(delay >= AUTO_DELAY.min && delay <= AUTO_DELAY.max);
  }
  assert.equal(autoDelay(s, { reduced: true }), AUTO_DELAY.reduced);
}

// おねだり（§10）: てつこのほうから「これがいい」を見せる。最初の拍で出て、応えると多めにごきげんがたまる。
// 応えなくても損はなく、しばらくすると忘れる（ごきげんも段階も減らない）。寝ている・膝の上では出さない。
{
  const KINDS = ["pet", "play", "brush", "treat", "watch", "decor"];
  for (const count of [0, 1, 2, 4]) for (const day of [3, 8, 21, 40]) {
    const session = createSession(save({ count, day }));
    keep(openingReaction(session));
    const asleep = session.cat.face === "sleep";
    const first = keep(autonomous(session));
    if (asleep) { assert.notEqual(first.id, "ask", "寝ている間は、おねだりしない"); continue; }
    assert.equal(first.id, "ask", `回数${count}・${day}日目: 最初の拍で、してほしいことを見せる`);
    assert(KINDS.includes(first.wish.kind));
    assert.deepEqual(session.wish, first.wish);
    assert.equal(session.meaningful, false, "おねだりを見ただけでは確定しない");
    if (count === 0) assert.notEqual(first.wish.kind, "pet", "様子見の段階は、なでてとは言わない");
    if (first.wish.kind === "brush") assert(canAct(session, "brush"), "使えない道具はねだらない");
    // 応えない: 何拍かすると忘れる。ごきげんは減らない。
    const joy = session.joy;
    let forgot = false;
    for (let i = 0; i < (WISH_PATIENCE + 2) * 2 && !forgot; i += 1) forgot = !!autonomous(session).forgot;
    assert(forgot, "応えないと、そのうち忘れる");
    assert.equal(session.wish, null);
    assert(session.joy >= joy, "忘れても、ごきげんは減らない");
    assert.equal(session.stage, sessionStage(count), "段階も変わらない");
  }
  // 応える: じゃらしのおねだりは、振る・捕まえる・空振りのどれでも。応えた分だけ多くたまる。
  const eager = createSession(save({ count: 2, day: 9 }));
  eager.wish = { kind: "play", prop: null, moment: null };
  const granted = keep(act(eager, "play"));
  assert.equal(granted.granted, true);
  assert.equal(granted.joy.gain, JOY.look + JOY.wish);
  assert.equal(eager.wish, null);
  assert.equal(keep(act(eager, "play")).granted, false, "同じおねだりは一度だけ");
  const other = createSession(save({ count: 2, day: 9 }));
  other.wish = { kind: "brush", prop: null, moment: null };
  assert.equal(keep(act(other, "pet")).granted, false, "別の遊びをしても叱られない（おねだりは残る）");
  assert.equal(other.wish.kind, "brush");
  // 物のおねだりは、置いた物をてつこが使った時に応えたことになる。
  const decor = createSession(save({ count: 0, day: 9 }));
  decor.wish = { kind: "decor", prop: "box", moment: "box_peek" };
  placeProp(decor, "floor", "box");
  assert.equal(keep(autonomous(decor)).granted, true, "箱を置くと、のぞきに来て喜ぶ");
  // 見つけたばかりのしぐさを保っている間（写真を撮れる間）も、姿を変えずにおねだりだけ出す。
  const held = createSession(save({ count: 4, day: 9 }));
  keep(act(held, "pet"));
  const pose = structuredClone(held.cat);
  const ask = keep(autonomous(held, { holding: true }));
  assert.equal(ask.id, "ask");
  assert.deepEqual(held.cat, pose, "姿は変えない");
  assert.equal(held.moment, "first_rub", "写真に撮れるしぐさのまま");
  assert.equal(autonomous(held, { holding: true }).quiet, true);
  assert.equal(autonomous(held, { holding: true }).quiet, true, "保っている間は、ほかの行動をしない");
  // 手帳の「このしぐさを探す」: 次のおねだりが、そのしぐさの手がかりになる。
  const seeker = createSession(save({ count: 0, day: 9 }));
  seekMoment(seeker, "ball_watch");
  const want = keep(autonomous(seeker));
  assert.equal(want.id, "ask");
  assert.deepEqual([want.wish.kind, want.wish.prop, want.wish.moment], ["decor", "ball", "ball_watch"]);
}

// 触らずに眺めている（§10）: 隣で見守ったことになる（操作と同じ扱い。「そっと見守る」のボタンは無い）。
{
  assert(WATCH_IDLE_MS >= 5000 && WATCH_IDLE_MS <= 10000, "見守ったことになるまでの長さは数秒");
  const session = createSession(save({ count: 0, day: 9 }));
  session.wish = { kind: "play", prop: null, moment: null };
  const seen = keep(autonomous(session, { idle: true }));
  assert.equal(seen.watched, true);
  assert.equal(seen.found, "paws_together", "隣にいるだけで、前足をそろえる（⑧）");
  assert.equal(session.meaningful, true);
  assert.equal(session.wish.kind, "play", "見守っただけでは、じゃらしのおねだりは消えない");
  assert.equal(autonomous(session, { idle: true }).quiet, true);
  assert.notEqual(autonomous(session, { idle: true }).watched, true, "毎回は見守りにならない（合間に、てつこが自分で動く）");
  // 気を許した段階は、眺めているうちに膝に乗ってくる（⑩）。膝の上では、しばらくそのまま寝ている。
  const close = createSession(save({ count: 5, day: 9 }));
  for (let i = 0; i < 40 && !close.found.includes("lap_nap"); i += 1) keep(autonomous(close, { idle: true }));
  assert(close.found.includes("lap_nap"), "眺めているだけで、そのうち膝で寝る");
  assert.equal(close.cat.pose, "lap");
  const naps = Array.from({ length: 6 }, () => autonomous(close, { idle: true })).filter(item => !item.quiet);
  assert(naps.length >= 3 && naps.every(item => close.cat.pose === "lap" && /膝/.test(item.text)), "膝に乗ったら、すぐには降りない");
  for (let i = 1; i < naps.length; i += 1) assert.notEqual(naps[i].id, naps[i - 1].id);
}

// ごきげん（§10）: ふれあうほどたまり、減らない。いっぱいになると「とっておき」（段階ごと）で、空に戻ってまたためられる。
// 能力・お金・好感度には触らない。通算の回数だけ、手帳のために記録へ足す。
{
  assert.equal(JOY_MAX % JOY_HEARTS, 0);
  for (const count of [0, 1, 2, 5]) {
    const value = save({ count, day: 14 });
    const before = structuredClone(value);
    const session = createSession(value, { visitKey: tetsukoVisitKey(value) });
    assert.equal(session.joy, 0);
    assert.equal(peakReaction(session), null, "たまる前は、とっておきは出ない");
    let last = 0, guard = 0;
    while (!session.peakReady && guard < 200) {
      const kind = ["play", "play", "play", "play", "miss", "play", "catch", "pet", "watch"][guard % 9];
      const reaction = canAct(session, kind) ? keep(act(session, kind, { zone: SWEET_ZONES[guard % 3] })) : keep(autonomous(session));
      assert(session.joy >= last, "ごきげんは減らない");
      assert(session.joy <= JOY_MAX);
      assert.equal(joyHearts(session), Math.floor(session.joy / (JOY_MAX / JOY_HEARTS)));
      if (!reaction.quiet) assert.equal(reaction.joy.value, session.joy);
      last = session.joy;
      guard += 1;
    }
    assert(session.peakReady, `回数${count}: ふれあっていれば、いっぱいになる`);
    assert(guard <= 40, `長くかからない（${guard}手）`);
    assert.equal(joyHearts(session), JOY_HEARTS);
    assert.equal(keep(act(session, "pet")).joy.gain, 0, "とっておきを見るまでは、それ以上たまらない");
    const peak = keep(peakReaction(session));
    assert.equal(peak.peak, true);
    assert.equal(peak.peaks, 1);
    assert(peak.text.length > 0 && peak.pop);
    assert(session.joy < JOY_MAX / JOY_HEARTS * 2, "ハートは空に戻る（見つけた分だけ少し入ることはある）");
    assert.equal(session.peakReady, false);
    assert.equal(peakReaction(session), null);
    if (session.stage >= 3) assert(["lap_nap", "first_rub"].includes(peak.moment), "気を許した段階のとっておきは、写真に撮れるしぐさ");
    assert.deepEqual(value, before, "モデルはセーブを書かない");
    // 確定すると、通算の回数だけ記録に足される（ほかは今までどおり）。
    assert.equal(sessionResult(session).peaks, 1);
    assert(settleTetsukoTime(value, sessionResult(session)).committed);
    assert.equal(value.flags[TETSUKO_TIME_FLAG].peaks, 1);
    value.day += 1;
    const again = createSession(value, { visitKey: tetsukoVisitKey(value) });
    assert.equal(again.joy, 0, "ごきげんは次の日へ持ち越さない");
    assert.equal(again.pastPeaks, 1);
    keep(act(again, "pet"));
    assert(settleTetsukoTime(value, sessionResult(again)).committed);
    assert.equal(value.flags[TETSUKO_TIME_FLAG].peaks, 1, "とっておきが無かった日は増えない");
  }
  // 段階ごとに別のとっておき。
  const peaks = [0, 1, 2, 5].map(count => { const session = createSession(save({ count, day: 14 })); session.peakReady = true; session.joy = JOY_MAX; return peakReaction(session).text; });
  assert.equal(new Set(peaks).size, 4);
  // 壊れた記録は 0 として読む。「少し構っていく」（結果に peaks が無い）は回数を変えない。
  assert.equal(readTetsukoRecord(save({ record: { peaks: "many" } })).peaks, 0);
  assert.equal(readTetsukoRecord(save({ record: { peaks: -2 } })).peaks, 0);
  const short = save({ count: 5, record: { peaks: 3 } });
  assert(settleTetsukoTime(short, { meaningful: true, visitKey: tetsukoVisitKey(short) }).committed);
  assert.equal(short.flags[TETSUKO_TIME_FLAG].peaks, 3);
}

// 置いてある物をタップして誘う（§10）: 箱なら顔を出す・入る、ボールなら見送る・転がす。一緒に遊んだことになる。
{
  const session = createSession(save({ count: 0, day: 6 }));
  assert.equal(invite(session, "box"), null, "置いていない物では誘えない");
  assert.equal(session.meaningful, false);
  placeProp(session, "floor", "box");
  placeProp(session, "floor", "ball");
  assert.equal(invite(session, "box"), null, "片付いた物でも誘えない");
  const first = keep(invite(session, "ball"));
  assert.equal(first.id, "ball_watch");
  assert.equal(first.invited, "ball");
  assert.equal(session.meaningful, true, "物で誘ったら、ふれあったことになる");
  assert(first.joy.gain >= JOY.invite);
  assert.equal(keep(invite(session, "ball")).id, "ball_paw", "続けて誘うと、別の反応");
  assert.equal(keep(invite(session, "ball")).id, "ball_watch");
  placeProp(session, "bench", "box");
  assert.equal(keep(invite(session, "box")).id, "box_peek");
  assert.equal(session.cat.inside, "box");
  assert.equal(keep(invite(session, "box")).id, "box_in");
}

// 同じ種なら同じ流れ（テスト・再現用）。
{
  const run = () => { const s = createSession(save({ count: 3, day: 21 })); placeProp(s, "floor", "ball"); return Array.from({ length: 12 }, () => autonomous(s).id); };
  assert.deepEqual(run(), run());
}

// 図鑑12件は、条件を満たせば数回の訪問で全部見つかる（低確率を何十回も引かせない）。写真を撮らなくても失わない。
{
  const value = save({ count: 0, day: 60 });
  let visits = 0;
  while (MOMENTS.some(moment => !readTetsukoRecord(value).found.includes(moment.id)) && visits < 12) {
    const session = createSession(value, { visitKey: tetsukoVisitKey(value) });
    keep(openingReaction(session));
    const stage = session.stage;
    // その日の段階で置ける物を置く（ベッドと箱は両方）。
    if (stage >= 3) { placeProp(session, "bed", "bed"); placeProp(session, "bench", "box"); placeProp(session, "floor", "ball"); }
    else if (stage >= 1) { placeProp(session, "bench", "cushion"); placeProp(session, "floor", "box"); }
    else placeProp(session, "floor", "ball");
    for (const kind of ["pet", "play", "play", "play", "catch", "brush", "watch", "watch"]) keep(act(session, kind));
    for (let i = 0; i < 16; i += 1) keep(autonomous(session));
    keep(farewell(session));
    const settled = settleTetsukoTime(value, sessionResult(session));
    assert(settled.committed);
    value.day += 1;
    visits += 1;
  }
  const record = readTetsukoRecord(value);
  assert.deepEqual(record.found, MOMENTS.map(moment => moment.id), `12件すべて見つかる（${visits}回の訪問）`);
  assert(visits <= 8, `数回の訪問で揃う（${visits}回）`);
  assert.equal(record.album.length, 0, "写真を撮らなくても、発見は記録される");
  assert.equal(value.flags[OUTINGS_FLAG].tetsuko, visits);
}

// 写真: 今見えているしぐさだけ。同じしぐさは1件（撮り直すと新しい方）、最大12件。画像は保存しない。
{
  const session = createSession(save({ count: 4 }));
  assert.equal(takePhoto(session), false, "しぐさが見えていない時は撮れない");
  keep(act(session, "pet"));
  assert(takePhoto(session));
  assert(takePhoto(session));
  assert.equal(session.album.length, 1, "同じしぐさは1件");
  const value = save({ count: 4, record: { album: MOMENTS.map((m, i) => ({ moment: m.id, day: i, props: {}, png: "data:image/png;base64,AAAA" }))
    .concat([{ moment: "first_paw", day: 99 }, { moment: "not_a_moment", day: 1 }]) } });
  const record = readTetsukoRecord(value);
  assert.equal(record.album.length, ALBUM_LIMIT);
  assert(record.album.every(entry => !("png" in entry)), "画像データは記録に残さない");
  assert.equal(record.album.find(entry => entry.moment === "first_paw").day, 0, "重複は先の1件だけ");
  // 夜に撮った写真は night を残す（手帳で夜の裏口を背にして見せる）。昼の写真と旧い記録には付けない。壊れた値は昼。
  const night = createSession(save({ count: 4, slot: 1 }));
  keep(act(night, "pet"));
  assert(takePhoto(night));
  assert.equal(night.album[0].night, true);
  const day = createSession(save({ count: 4, slot: 0 }));
  keep(act(day, "pet"));
  assert(takePhoto(day));
  assert.equal("night" in day.album[0], false);
  const kept = readTetsukoRecord(save({ record: { album: [{ moment: "first_rub", day: 3, props: {}, night: true }, { moment: "hug_toy", day: 4, props: {}, night: "yes" }] } }));
  assert.equal(kept.album[0].night, true);
  assert.equal("night" in kept.album[1], false, "true 以外は昼として読む");
  const nightValue = save({ count: 4, slot: 1 });
  const nightSession = createSession(nightValue, { visitKey: tetsukoVisitKey(nightValue) });
  keep(act(nightSession, "pet")); takePhoto(nightSession);
  assert(settleTetsukoTime(nightValue, sessionResult(nightSession)).committed);
  assert.equal(nightValue.flags[TETSUKO_TIME_FLAG].album[0].night, true, "確定しても夜の写真のまま");
}

// 確定点: 意味のあるふれあいでない／訪問キーが無い／同じキーの2回目は保存に触らない。
{
  const value = save({ count: 2 });
  const before = structuredClone(value);
  const session = createSession(value, { visitKey: tetsukoVisitKey(value) });
  keep(openingReaction(session));
  placeProp(session, "floor", "box");
  assert.deepEqual(settleTetsukoTime(value, sessionResult(session)), { committed: false }, "何もせず帰ると確定しない");
  assert.deepEqual(value, before, "保存は不変（配置だけの変更も残さない）");
  assert.deepEqual(settleTetsukoTime(value, { meaningful: true }), { committed: false }, "訪問キーが無ければ確定しない");
  assert.deepEqual(settleTetsukoTime(value, undefined), { committed: false });
  assert.deepEqual(settleTetsukoTime(null, { meaningful: true, visitKey: "x" }), { committed: false });
  assert.deepEqual(value, before);
}

// 確定点: 確定で変わるのは来訪記録と _tetsuko_time だけ。能力・経験値・お金・好感度・日付・時間帯・体力は不変
// （体力は呼び出し側が返り値で足す）。同じ訪問キーで二度目は確定しない（二重押し・再入場）。
{
  const value = save({ count: 3, day: 44 });
  const key = tetsukoVisitKey(value);
  assert.equal(key, "3:44:1:3");
  const before = structuredClone(value);
  const session = createSession(value, { visitKey: key });
  keep(openingReaction(session));
  placeProp(session, "floor", "box");
  keep(act(session, "pet"));
  assert(takePhoto(session), "すりすりの瞬間を写真に残す");
  keep(act(session, "treat"));
  assert.equal(takePhoto(session), false, "おやつの後はしぐさが見えていない");
  const result = sessionResult(session);
  assert.deepEqual(settleTetsukoTime(value, result), { committed: true, stamina: 12 });
  assert.deepEqual(settleTetsukoTime(value, result), { committed: false }, "同じ訪問は二度確定しない");
  assert.equal(value.flags[OUTINGS_FLAG].tetsuko, 4);
  assert.equal(value.flags[OUTINGS_FLAG].mukai_help, 2, "ほかの外出の記録はそのまま");
  const record = value.flags[TETSUKO_TIME_FLAG];
  assert.deepEqual(record.props, { bench: null, floor: "box", bed: null }, "配置は次回も同じ場所");
  assert.deepEqual(record.found, MOMENTS.map(m => m.id).filter(id => result.found.includes(id)));
  assert.equal(record.treatDay, 44);
  assert.equal(record.sessions, 1);
  assert.equal(record.lastKey, key);
  assert.equal(record.album.length, 1);
  const rest = structuredClone(value);
  delete rest.flags[OUTINGS_FLAG]; delete rest.flags[TETSUKO_TIME_FLAG];
  const was = structuredClone(before);
  delete was.flags[OUTINGS_FLAG]; delete was.flags[TETSUKO_TIME_FLAG];
  assert.deepEqual(rest, was, "能力・経験値・お金・好感度・面識・日付・時間帯・体力は一切変わらない");
  // 次の訪問は回数が進んだので別のキー。
  assert.notEqual(tetsukoVisitKey(value), key);
  // 「少し構っていく」（台本だけ）も同じ確定点を通る。記録した配置・発見は保たれる。
  value.slot = 0; value.day = 45;
  assert(settleTetsukoTime(value, { meaningful: true, visitKey: tetsukoVisitKey(value) }).committed);
  assert.equal(value.flags[OUTINGS_FLAG].tetsuko, 5);
  assert.deepEqual(value.flags[TETSUKO_TIME_FLAG].props, record.props);
  assert.deepEqual(value.flags[TETSUKO_TIME_FLAG].found, record.found);
  assert.equal(value.flags[TETSUKO_TIME_FLAG].sessions, 2);
}

// 壊れた記録・旧セーブでも入れる。未知の id・二重配置・置けない枠は捨てる。
{
  const value = save({ count: 4, record: { props: { bench: "ball", floor: "box", bed: "box" }, found: ["nope", "waiting", "first_paw"], treatDay: "x", sessions: -3 } });
  const record = readTetsukoRecord(value);
  assert.deepEqual(record.props, { bench: null, floor: "box", bed: null });
  assert.deepEqual(record.found, ["first_paw", "waiting"], "図鑑の並びで、知っている id だけ");
  assert.equal(record.treatDay, null);
  assert.equal(record.sessions, 0);
  assert.deepEqual(readTetsukoRecord({}).props, { bench: null, floor: null, bed: null });
  const flags = save({ record: [] });
  assert.deepEqual(readTetsukoRecord(flags).found, []);
}

// 帰りの見送り（⑫）は、気を許した段階で、ふれあいの後だけ。
{
  const idle = createSession(save({ count: 4 }));
  assert.equal(farewell(idle), null, "何もしていなければ見送りはない（確定もしない）");
  const close = createSession(save({ count: 4 }));
  keep(act(close, "pet"));
  assert.equal(keep(farewell(close)).found, "see_off");
  const shy = createSession(save({ count: 1 }));
  keep(act(shy, "pet"));
  assert.equal(farewell(shy), null);
}

// 画面の文（text-style）: 地の文は「。」で終える・全角48字以内・旧表記なし。人物の一言は末尾に「。」を付けない。
{
  for (const day of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const count of [0, 1, 2, 3, 6]) {
      const session = createSession(save({ count, day }));
      for (const slot of SLOTS) for (const prop of PROPS) placeProp(session, slot, prop.id);
      keep(openingReaction(session));
      for (const kind of ["pet", "play", "play", "play", "play", "miss", "play", "miss", "play", "catch", "brush", "brush", "brush", "treat", "watch", "watch", "pet", "pet", "pet", "pet"]) keep(act(session, kind));
      for (const zone of [...PET_ZONES, ...PET_ZONES, ...PET_ZONES]) keep(act(session, "pet", { zone }));
      for (const prop of PROPS) keep(invite(session, prop.id));
      for (let i = 0; i < 40; i += 1) { const r = keep(autonomous(session, { idle: i % 7 === 0 })); if (r.line) everyText.push(`LINE:${r.line.text}`); }
      session.peakReady = true;
      const peak = keep(peakReaction(session));
      if (peak.line) everyText.push(`LINE:${peak.line.text}`);
      session.peakReady = true;
      keep(peakReaction(session));
      keep(farewell(session));
    }
  }
  const texts = [...new Set(everyText)];
  assert(texts.length >= 30, `反応の文が十分にある（${texts.length}）`);
  for (const text of texts) {
    if (text.startsWith("LINE:")) { assert(!/。$/.test(text), `台詞の末尾に「。」を付けない: ${text}`); continue; }
    assert(/。$/.test(text), `地の文は「。」で終える: ${text}`);
    assert(!text.includes("\n"), "手動改行を入れない");
    assert([...text].length <= 48, `全角48字以内: ${text}`);
  }
  // 擬音（猫のそばに大きく出す）は短く、句点を付けない。
  const pops = [...new Set(everyPop)];
  assert(pops.length >= 15, `擬音が十分にある（${pops.length}）`);
  for (const pop of pops) assert([...pop].length <= 5 && !/[。、\n]/.test(pop), `擬音は5字以内・句読点なし: ${pop}`);
  // 「？」の文は短く、「。」で終える。画面の道具（なでる・じゃらし・ブラシ・おやつ）と、しるし（ごきげん・吹き出し・カメラ）が載っている。
  const helpRows = HELP.flatMap(group => group.rows);
  for (const row of helpRows) assert(/。$/.test(row.text) && [...row.text].length <= 30, `あそびかたの文は30字以内: ${row.text}`);
  for (const name of ["なでる", "じゃらし", "ブラシ", "おやつ", "ごきげん", "吹き出し", "カメラ", "もようがえ", "てつこ手帳", "帰る"]) assert(helpRows.some(row => row.name === name), `あそびかたに ${name} がある`);
  const strings = [...texts, ...pops, ...helpRows.map(row => row.text), ...MOODS.flatMap(mood => [mood.label, mood.shyLabel || ""]), ...MOMENTS.flatMap(m => [m.name, m.hint]), ...PROPS.flatMap(p => [p.name, p.from])];
  for (const text of strings) assert(!/テツコ|ヤニネコ/.test(text), `旧表記を使わない: ${text}`);
  for (const mood of MOODS) assert(/。$/.test(mood.label) && (!mood.shyLabel || /。$/.test(mood.shyLabel)));
}

// ソース走査: モデルは DOM・保存・報酬の API を持たない。確定点は来訪記録と _tetsuko_time 以外を書かない
// （体力の加算・toast は呼び出し側 ch3-tokyo-daily.js）。
{
  // コメントの説明文（「呼び出し側が addStamina(12)」等）には当たらないよう、コードだけを見る。
  const code = file => fs.readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
  const model = code("../js/minigames/tetsuko-model.js");
  for (const banned of ["document.", "window.", "localStorage", "addStamina", "gainAffinity", "earnStat", "addMoney", "earnSceneCompletion", "save()", "value.flags["])
    assert(!model.includes(banned), `モデルは ${banned} を使わない`);
  const time = code("../js/minigames/tetsuko-time.js");
  for (const banned of ["addStamina", "gainAffinity", "earnStat", "addMoney", "earnSceneCompletion", "paidAction", "spinReel"])
    assert(!time.includes(banned), `てつこといっしょの画面と確定点は ${banned} を使わない（回復は呼び出し側）`);
  const writes = [...time.matchAll(/value\.flags\[([A-Z_]+)\]\s*=/g)].map(match => match[1]);
  assert.deepEqual([...new Set(writes)].sort(), ["OUTINGS_FLAG", "TETSUKO_TIME_FLAG"], "確定点が書くのは2つの記録だけ");
}

// てつこメモ（手帳の一言）と、絵の差し替え表（tetsuko-art.js）。
{
  for (const moment of MOMENTS) {
    assert(/。$/.test(moment.memo) && [...moment.memo].length <= 48, `てつこメモは地の文・48字以内: ${moment.memo}`);
    assert(!/テツコ|ヤニネコ/.test(moment.memo));
  }
  // #2690 の12枚と、#3214（TKT26）の跳ぶ・空振り・鳴く・つつく
  const POSES = ["loaf", "crouch", "reach", "hug", "groom", "yawn", "belly", "rub", "walk_a", "walk_b", "lookback", "stretch", "leap", "flop", "mew", "poke"];
  const hints = new Set(MOMENTS.map(moment => moment.art).filter(Boolean));
  for (const kind of ["pet", "play", "play", "play", "catch", "brush", "brush", "treat", "watch"]) {
    const reaction = act(createSession(save({ count: 4 })), kind);
    if (reaction?.art) hints.add(reaction.art);
  }
  const session = createSession(save({ count: 4, day: 7 }));
  for (const slot of SLOTS) for (const prop of PROPS) placeProp(session, slot, prop.id);
  for (let i = 0; i < 60; i += 1) { const reaction = autonomous(session); if (reaction.art) hints.add(reaction.art); }
  for (const hint of hints) assert(POSES.includes(hint), `しぐさの絵の名前は依頼した12枚のどれか: ${hint}`);
  const { ART_READY, artAttrs } = await import("../js/minigames/tetsuko-art.js");
  // quick の CI は画像を取らない（sparse checkout）ので、手元のファイルではなく Git に登録済みかで確かめる。
  const tracked = new Set(execFileSync("git", ["ls-files", "--", "remake/img/ui/tetsuko/", "remake/img/backgrounds/"],
    { cwd: new URL("../../", import.meta.url), encoding: "utf8" }).split("\n").filter(Boolean));
  const exists = rel => tracked.has(`remake/img/ui/tetsuko/${rel}`);
  for (const pose of ART_READY.poses) { assert(POSES.includes(pose)); assert(exists(`cat_${pose}.webp`), `届いたしぐさの絵がある: cat_${pose}.webp`); }
  // 小物は、CSS が読むファイルが全部そろっていること（箱とベッドは手前の層も・おやつは前後2枚・じゃらしは先と棒・ブラシはカーソルも）。
  const PROP_FILES = { box: ["prop_box.webp", "prop_box_front.webp"], bed: ["prop_bed.webp", "prop_bed_front.webp"],
    plate: ["prop_plate_full.webp", "prop_plate_empty.webp"], teaser: ["prop_teaser_tip.webp", "prop_teaser_stick.webp"],
    brush: ["prop_brush.webp", "prop_brush_cursor.png"], lap: ["prop_lap.webp"], tunnel_tail: ["prop_tunnel_tail.webp"] };
  for (const prop of ART_READY.props) {
    assert(PROPS.some(item => item.id === prop) || PROP_FILES[prop], `小物の名前は依頼した物: ${prop}`);
    for (const file of PROP_FILES[prop] || [`prop_${prop}.webp`]) assert(exists(file), `届いた小物の絵がある: ${file}`);
  }
  const css = fs.readFileSync(new URL("../css/tetsuko-time.css", import.meta.url), "utf8");
  for (const prop of ART_READY.props.filter(id => PROPS.some(item => item.id === id)))
    assert(css.includes(`[data-art-props~="${prop}"] .tt-prop[data-prop="${prop}"] > .tt-prop-back`), `小物の絵を出す CSS がある: ${prop}`);
  // UI: 組の部品は全部の状態、シートは1つずつ切り出した絵が全部そろっていること（#3213）。
  const { TK_ICONS } = await import("../js/minigames/tetsuko-art.js");
  const UI_FILES = {
    tk_icons: TK_ICONS.map(name => `ui_tk_icon_${name}.webp`),
    tk_fx: ["heart", "spark", "note", "sweat", "fur", "paw", "purr", "puff"].map(name => `ui_tk_fx_${name}.webp`),
    tk_token: ["ui_tk_token.webp", "ui_tk_token_pressed.webp", "ui_tk_token_active.webp"],
    tk_tab: ["ui_tk_tab.webp", "ui_tk_tab_pressed.webp", "ui_tk_tab_door.webp"],
    tk_heart: ["ui_tk_heart.webp", "ui_tk_heart_empty.webp"],
  };
  for (const part of ART_READY.ui) for (const file of UI_FILES[part] || [`ui_${part}.webp`]) assert(exists(file), `届いたUIの絵がある: ${file}`);
  // CSS が読む小物・しぐさ・専用テーマの絵は、どれも登録済み（名前の書き間違いで 404 にしない）。
  // 紙×ラベンダーの ui_*（#2691・採用しない）の規則は ART_READY に名前が無いので読まれない。ここでは数えない。
  for (const file of ["../css/tetsuko-time.css", "../css/tetsuko-theme.css"]) {
    const text = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    for (const [, name] of text.matchAll(/url\("\.\.\/img\/ui\/tetsuko\/((?:ui_tk_|cat_|prop_)[^"]+)"\)/g)) assert(exists(name), `${file} が読む絵がある: ${name}`);
  }
  // 新しい理由の書いてある素材は、CSS の描画を絵に替えている（膝・しっぽ・札・ハートなど）。
  const themeCss = fs.readFileSync(new URL("../css/tetsuko-theme.css", import.meta.url), "utf8");
  for (const part of ART_READY.ui.filter(name => name.startsWith("tk_"))) assert(themeCss.includes(`[data-art-ui~="${part}"]`), `専用テーマの絵を使う CSS がある: ${part}`);
  assert(css.includes('[data-art-props~="tunnel_tail"]') && css.includes('[data-art-props~="lap"]'), "膝としっぽの絵を使う CSS がある");
  if (ART_READY.background) assert(tracked.has("remake/img/backgrounds/bg_mukai_backdoor_day.webp"), "裏口の絵がある");
  assert.deepEqual(Object.keys(artAttrs()).sort(), ["artBg", "artProps", "artUi"]);
}

// TKT17（てつこを主役に）: カメラは寄せて（1.3倍以上）、どの居場所でも、てつこの枠が段ボールの外枠（20px）の内側に収まる。
// 居場所と大きさは CSS の .tt-cat[data-at] から読む（JS に写さない）。測れない時は引いた全体（zoom 1）。
{
  assert(TETSUKO_CAMERA.zoom >= 1.3, "てつこを大きく映す");
  assert.deepEqual(tetsukoCameraFor({}), { k: 1, x: 0, y: 0 }, "測れなければ引いた全体");
  const css = fs.readFileSync(new URL("../css/tetsuko-time.css", import.meta.url), "utf8");
  const spots = [...css.matchAll(/\.tt-cat\[data-at="([^"]+)"\] \{ --x: (\d+)px; --y: (\d+)px; --s: ([\d.]+); \}/g)]
    .map(([, at, x, y, s]) => ({ at, x: Number(x), y: Number(y), s: Number(s) }));
  assert(spots.length >= 8, `居場所を CSS から読めた (${spots.length})`);
  for (const spot of spots) {
    const cam = tetsukoCameraFor(spot);
    assert.equal(cam.k, TETSUKO_CAMERA.zoom, `${spot.at}: 寄せて映す`);
    assert(cam.x <= 0 && cam.x >= 1280 * (1 - cam.k) && cam.y <= 0 && cam.y >= 720 * (1 - cam.k), `${spot.at}: 舞台の外は映さない`);
    const w = 270 * spot.s, h = TETSUKO_CAMERA.catHeight * spot.s;
    const box = { l: cam.x + cam.k * (spot.x - w / 2), r: cam.x + cam.k * (spot.x + w / 2), t: cam.y + cam.k * (spot.y - h), b: cam.y + cam.k * spot.y };
    assert(box.l >= 20 && box.r <= 1260 && box.t >= 20 && box.b <= 700, `${spot.at}: てつこが画面に収まる ${JSON.stringify(box)}`);
  }
}

// じゃらしで遊ぶ間のカメラ（§10）: 飛びつく先が見えるよう、てつこを追わずに少し引く。舞台の外は映さない。
{
  const cam = tetsukoToyCamera();
  assert.equal(cam.k, TETSUKO_TOY_VIEW.zoom);
  assert(cam.k > 1 && cam.k < TETSUKO_CAMERA.zoom, "寄せすぎず、全体よりは近い");
  assert(cam.x <= 0 && cam.x >= 1280 * (1 - cam.k) && cam.y <= 0 && cam.y >= 720 * (1 - cam.k), "舞台の外は映さない");
  // 飛びついた先（TETSUKO_LEAP）のどこでも、いちばん横に長いしぐさの絵（跳ぶ・空振り）まで外枠（20px）の内側に映る（端で体が切れない）。
  // しぐさの絵は 1024×768 の画面を 0.754 倍で出す（CSS の .tt-cat-pose）。絵の中の猫の幅を測って halfWidth と比べる。
  for (const x of [TETSUKO_LEAP.min, 640, TETSUKO_LEAP.max]) {
    const box = { l: cam.x + cam.k * (x - TETSUKO_LEAP.halfWidth), r: cam.x + cam.k * (x + TETSUKO_LEAP.halfWidth),
      t: cam.y + cam.k * (TETSUKO_LEAP.y - TETSUKO_CAMERA.catHeight), b: cam.y + cam.k * TETSUKO_LEAP.y };
    assert(box.l >= 20 && box.r <= 1260 && box.t >= 20 && box.b <= 700, `飛びついた先 x=${x} で、てつこが画面に収まる ${JSON.stringify(box)}`);
  }
  assert(TETSUKO_LEAP.max - TETSUKO_LEAP.min >= 600, "飛びまわれる幅は十分にある");
}

// 見守る初回だけの発見を、膝に乗る日や見守った後に案内しない。
{
  for (const count of [0, 1, 4]) for (const mood of MOODS) for (const watches of [0, 1, 2]) {
    const session = createSession(save({ count }));
    session.mood = mood.id;
    session.watches = watches;
    session.found = MOMENTS.filter(moment => moment.id !== "paws_together").map(moment => moment.id);
    const reachable = watches === 0 && !(session.stage >= 3 && session.mood === "clingy");
    assert.equal(discoveryGuide(session, "paws_together").id === "paws_together", reachable,
      `前足をそろえる案内は今できる時だけ: ${count}/${mood.id}/${watches}`);
    if (reachable) assert.equal(act(session, "watch").moment, "paws_together");
  }
}

// 次の一手・模様替えの反応・撤去の回帰。旧セーブの確定点は変えない。
{
for(let count=0;count<5;count++) {
 const s=createSession(save({ count }));
 assert.equal(discoveryGuide(s).kind,'play');
 act(s,'play');act(s,'play');assert.match(discoveryGuide(s).text,/もうひと振り/);
 act(s,'play');assert(s.found.includes('first_paw'));
 assert.notEqual(discoveryGuide(s).id,'first_paw');
 if(count>0){assert.equal(discoveryGuide(s).kind,'play');assert.equal(discoveryGuide(s).id,'hug_toy');act(s,'catch');assert(s.found.includes('hug_toy'));}
 placeProp(s,'floor','box');const a=autonomous(s);assert.equal(a.id,'box_peek');
 assert.equal(s.cat.inside,'box');placeProp(s,'floor',null);assert.equal(s.cat.inside,null);
 assert.equal(s.curiousProp,null);
 placeProp(s,'floor','ball');assert.equal(autonomous(s).id,'ball_watch');
 assert(!('curiousProp' in sessionResult(s)));
}
const s=createSession(save({ count: 0 }));assert.notEqual(discoveryGuide(s,'lap_nap').id,'lap_nap');
assert.equal(discoveryGuide(s,'box_peek').kind,'decor');
console.log('discovery loop / immediate prop curiosity / removal / stage gates: PASS');

}
console.log("tetsuko time model and settle: ok");

