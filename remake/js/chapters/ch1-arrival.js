import { DB } from "../core/data.js";
import { play, dialogueSequence } from "../vn/engine.js";
import { maybeShuraba } from "../daily/romance.js";

/** 受付・会場到着 → 控室前の鉢合わせ → 控室。台本IDと既読の行位置は維持する。 */
export async function playTournamentArrival() {
  const id = "ch1_tournament_arrival";
  const arrival = DB.dialogues[id];
  const roomAt = arrival.lines.findIndex(line => line.text?.startsWith("出場者控室に入る。"));
  if (roomAt < 0) throw new Error("Chapter 1 arrival: waiting-room entry is missing");
  await dialogueSequence(async () => {
    await play(id, { toLine: roomAt });
    await maybeShuraba();
    await play(id, { fromLine: roomAt });
  });
}
