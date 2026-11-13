// Both chapters keep progress validation before this shared commit operation.
// JSON copy and mutation order preserve existing save/error behavior.
export function finishTournamentStep(progress, craft) {
  progress.craft = JSON.parse(JSON.stringify(craft));
  progress.rollback = null;
  if (craft.failed) { progress.stage = "defeat"; progress.failure = craft.failed; }
  else progress.step++;
  return progress;
}
