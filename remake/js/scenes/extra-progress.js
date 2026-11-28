// タイトルの EXTRA（あそびば）の進み具合（要望台帳 EXT04）。2026-11-27 オーナー「ミニゲームにも進行度が関係するのはセーブデータから」。
// 段（初級・中級・上級）・ラクダの大会・DJ のセット・ボドゲカフェの本棚は、全セーブ枠（オートセーブ・手動の枠）と遊んでいる最中の
// 状態のうち、その遊びがいちばん進んだもの（遊びごとに選ぶ）から開く。ここは移行を通した写しを読むだけで、どのセーブも書かない。
// EXTRA で遊んだ結果も、この写しの上で捨てる（scenes/extra.js）。
import { SAVE_SLOTS, readSlotMigrated, newState, state } from "../core/state.js";
import { TIERS, TIER_LABEL, tierOpen, tierRecord, tierLockNote, syncPlayTiers } from "../core/play-tiers.js";

const copy = (value) => JSON.parse(JSON.stringify(value));

/** 進み具合を読むセーブの写し（移行済み）。無ければ、はじめの状態を1つ（初級だけが開く）。 */
export function extraSaves() {
  const saves = SAVE_SLOTS.map((slot) => readSlotMigrated(slot.key)).filter(Boolean);
  if (state?.day) { try { saves.push(copy(state)); } catch { /* 写せない状態は読まない */ } }
  if (!saves.length) saves.push(newState());
  // 段を知らない旧保存の実績を、本編のメニューと同じく段へ取り込む（写しの上だけ）
  for (const save of saves) { try { syncPlayTiers(save); } catch { /* 読めない記録は飛ばす */ } }
  return saves;
}

/** 遊びの段の札（初級・中級・上級）。閉じた段には開き方（ひとつ下の段のクリア）。 */
export function tierCards(owner, game) {
  const { cleared } = tierRecord(owner, game);
  return TIERS.map((tier) => ({ tier, label: TIER_LABEL[tier], open: tierOpen(owner, game, tier), cleared: cleared.includes(tier), lock: tierLockNote(tier) }));
}

const tierScore = (owner, game) => tierCards(owner, game).reduce((sum, card) => sum + (card.open ? 10 : 0) + (card.cleared ? 1 : 0), 0);
/** その遊びがいちばん進んだセーブ（同点なら先の枠）。 */
function bestOf(saves, score) {
  let best = saves[0], top = -Infinity;
  for (const save of saves) {
    let value = -Infinity;
    try { value = score(save); } catch { value = -Infinity; }
    if (value > top) { top = value; best = save; }
  }
  return best;
}

/**
 * 遊びごとの進み具合。owner は選んだセーブの写し（遊びを始める時にさらに写して渡す）。
 * - axe: 段＝10投の部門（初級 レク・中級 アマ・上級 プロ）。練習（3投）は段の外でいつでも
 * - dj: セット（1〜3。開き方は本編と同じ djSetOpen）
 * - camel: 出られる大会（本編と同じ availableCamelCups）
 * - desert: 段と、来てくれる相手（なるは上級クリアか、もう会っていれば）
 * - trpg: 本棚（持っている本・遊び終えた物語・部員）
 */
export async function loadExtraProgress(saves = extraSaves()) {
  const [{ DJ_SETS, djSetOpen, djRecords }, camel, desert] = await Promise.all([
    import("../minigames/dj.js"), import("../chapters/ch4-camel-progress.js"), import("../chapters/ch4-desert-progress.js")]);
  const axeOwner = bestOf(saves, (s) => tierScore(s, "axe"));
  const djOwner = bestOf(saves, (s) => DJ_SETS.filter((set) => djSetOpen(s, set.id)).length * 10 + tierRecord(s, "dj").cleared.length);
  const camelOwner = bestOf(saves, (s) => camel.availableCamelCups(s).length * 10 + tierRecord(s, "camel").cleared.length);
  const desertOwner = bestOf(saves, (s) => tierScore(s, "desert") + (desert.desertRivals(s).length > 1 ? 5 : 0));
  const trpgScore = (s) => (s.trpg?.owned?.length || 0) * 10 + Object.keys(s.trpg?.cleared || {}).length * 3 + Object.keys(s.trpg?.club?.members || {}).length;
  const trpgOwner = bestOf(saves, trpgScore);
  const djSets = djRecords(djOwner).sets;
  return {
    axe: { owner: axeOwner, tiers: tierCards(axeOwner, "axe") },
    dj: { owner: djOwner, tiers: tierCards(djOwner, "dj"),
      sets: DJ_SETS.map((set, index) => ({ ...set, open: djSetOpen(djOwner, set.id), best: djSets[set.id]?.best?.rank || null,
        lock: index ? `${TIER_LABEL[DJ_SETS[index - 1].tier]}クリアで開く` : "" })) },
    camel: { owner: camelOwner, tiers: tierCards(camelOwner, "camel"), cups: camel.availableCamelCups(camelOwner), record: camel.camelRaceRecord(camelOwner) },
    desert: { owner: desertOwner, tiers: tierCards(desertOwner, "desert"), rivals: desert.desertRivals(desertOwner), records: desert.desertRecords(desertOwner) },
    trpg: { owner: trpgOwner, books: trpgOwner.trpg?.owned?.length || 0, cleared: Object.keys(trpgOwner.trpg?.cleared || {}).length,
      club: !!trpgOwner.trpg?.club?.founded },
  };
}
