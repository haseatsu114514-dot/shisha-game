// つむぎの取材・コンテスト。本筋の読了と個人的な親しさは分ける。
import { state, save } from "../core/state.js";
import { ensureAffinityLevel } from "../core/stats.js";
import { play, hooks, dialogueSequence } from "../vn/engine.js";
import { DB, cgUrl } from "../core/data.js";
import { el } from "../core/util.js";
import { layers, imageReady } from "../core/ui.js";
import { sketchIn } from "../core/scene-motions.js";
import { hasContact } from "../daily/spots.js";
import { TSUMUGI_STORY } from "../daily/tsumugi-schedule.js";
export { TSUMUGI_STORY } from "../daily/tsumugi-schedule.js";

/** 正本は変えず、完成画の直前で区切る。分岐・末尾の報酬は元の会話へ残す。 */
export async function playTsumugiSketch(id, bg) {
  const dialogue = DB.dialogues[id];
  const at = dialogue?.lines.findIndex(line => line.type === "show_cg");
  if (!(at > 0)) return play(id, { bg });
  const owner = state;
  return dialogueSequence(async () => {
    const intro = await play({ dialogue_id: `${id}_presentation`, metadata: { bg },
      branches: dialogue.branches, lines: dialogue.lines.slice(0, at) }, { bg });
    if (intro?.cancelled || state !== owner) return { cancelled: true };
    const cg = dialogue.lines[at].cg_id;
    const url = cgUrl(cg);
    let still = null;
    const previousCg = hooks.onCg;
    const handoff = shown => {
      if (shown === cg) still?.remove();
      previousCg?.(shown);
    };
    try {
      if (url && await imageReady(url, 15000) && state === owner) {
        // 演出が開く先にも同じ完成画を置き、VNのCGが表示されるまで保持する。
        await sketchIn(() => {
          if (state !== owner) return;
          still = el("div.vn-cg.show", { dataset: { cg, sketchStill: "true" },
            style: { backgroundImage: `url("${url}")`, transition: "none" } });
          layers.fx.append(still);
        }, url);
      }
      if (state !== owner) return { cancelled: true };
      hooks.onCg = handoff;
      return await play({ ...dialogue, lines: dialogue.lines.slice(at) }, { bg });
    } finally {
      still?.remove();
      if (hooks.onCg === handoff) hooks.onCg = previousCg;
    }
  });
}

/** 途中の旧セーブでも、未読の場面を実際に読んでから進める。訪問回数から既読を作らない。 */
export async function playTsumugiStory(untilDay, { sketch = null, deferFlags = [] } = {}) {
  if (state.chapter !== 1) return;
  const owner = state;
  const hadContact = state.contacts.includes("tsumugi");
  const wasKnown = !!state.flags._met_tsumugi;
  const wasLimeContact = !!state.flags._lime_contact_tsumugi;
  // 過去の交換は覚えるが、新しい取材の話をしたことにはしない。
  if (hasContact("tsumugi")) state.flags._lime_contact_tsumugi = true;
  if (state.met.tsumugi || (state.story.tsumugi || 0) > 0) state.flags._met_tsumugi = true;
  let backfilled = hadContact !== state.contacts.includes("tsumugi") || wasKnown !== !!state.flags._met_tsumugi
    || wasLimeContact !== !!state.flags._lime_contact_tsumugi;
  for (const step of TSUMUGI_STORY) {
    if (step.day > untilDay) break;
    // 休養で予定を繰り越した場面は、ロードだけで読了・完了にしない。
    if (!state.flags[step.flag] && deferFlags.includes(step.flag)) break;
    const unread = !state.flags[step.flag];
    if (unread) {
      const result = step.dialogue === "ch1_tsumugi_sketch" && sketch ? await sketch() : await play(step.dialogue);
      if (result?.cancelled || state !== owner) return;
      state.flags[step.flag] = true;
      state.flags._tsumugi_story_day = `${state.chapter}:${state.day}`;
    }
    const gained = step.level ? ensureAffinityLevel("tsumugi", step.level) : 0;
    hasContact("tsumugi");
    // 再開時の補完も、次の行動を選ぶ前に保存する。
    if (unread || backfilled || gained) save();
    backfilled = false;
  }
}
