import { foundTrpgClub } from "./campaign.js";

const pending = new WeakSet();

/** Reuse the authored shop conversation in the main game's usual VN. */
export function trpgClubFoundingDialogue(club) {
  return {
    dialogue_id: "trpg_club_founding",
    lines: [...club.lines, { type: "choice", id: "trpg_club_proposal", choices: [
      { text: "店の仕事があると伝える", next: "proposal_time" },
      { text: "知り合いを誘うのは苦手と伝える", next: "proposal_people" },
    ] }],
    branches: Object.fromEntries(["proposal_time", "proposal_people"].map(key =>
      [key, [...club.branches[key], ...club.branches.founded]])),
  };
}

/** Only a completed, still-current visit creates the club. Existing saves need no new flag. */
export async function playTrpgClubFounding({ getState, catalog, club, play, save = () => {},
  signal, isCurrent = () => true }) {
  const owner = getState();
  if (!owner || owner.chapter < catalog.unlockChapter || owner.phase !== "daily"
    || signal?.aborted || !isCurrent() || pending.has(owner)) return false;
  if (owner.trpg?.club?.founded) return true;
  const stamp = `${owner.chapter}:${owner.day}:${owner.slot}`;
  pending.add(owner);
  try {
    const result = await play(trpgClubFoundingDialogue(club), { signal });
    if (result?.cancelled || signal?.aborted || getState() !== owner || !isCurrent()
      || owner.phase !== "daily" || `${owner.chapter}:${owner.day}:${owner.slot}` !== stamp) return false;
    if (foundTrpgClub(owner, catalog)) save();
    return !!owner.trpg?.club?.founded;
  } finally { pending.delete(owner); }
}
