// カメラの競り合い。ライバルが粘るモデル側の duel とは独立している。
const CAMERA = Object.freeze({
  start: 3, interval: 0.1, enterGap: 2, enterTime: 0.9, exitGap: 4.5, exitTime: 0.35, cooldown: 2,
});
const samePair = (pair, a, b) => pair && (pair[0] === a && pair[1] === b || pair[0] === b && pair[1] === a);

export class CamelRaceDuel {
  pair = null;
  candidate = null;
  candidateSince = 0;
  separatedSince = null;
  nextSample = CAMERA.start;
  readyAt = CAMERA.start;

  update(t, rows) {
    if (t < this.nextSample) return;
    this.nextSample = t + CAMERA.interval;
    let activeRank = rows.length;
    let activeLead = 0;
    if (this.pair) {
      const a = rows.findIndex(row => row.id === this.pair[0]);
      const b = rows.findIndex(row => row.id === this.pair[1]);
      if (rows[a].finishedAt !== null || rows[b].finishedAt !== null) {
        this.end(t);
        return;
      }
      if (Math.abs(rows[a].distance - rows[b].distance) > CAMERA.exitGap) {
        this.separatedSince ??= t;
        if (t - this.separatedSince >= CAMERA.exitTime) {
          this.end(t);
          return;
        }
      } else {
        this.separatedSince = null;
      }
      activeLead = Math.min(a, b);
      // 3頭以上なら、今撮っている2頭より前の組に移る。順位が入れ替わるたびには切り替えない。
      activeRank = activeLead + Number(Math.abs(a - b) > 1);
    }
    if (t < this.readyAt) return;
    for (let i = 0; i < rows.length - 1 && i < activeRank; i++) {
      const a = rows[i], b = rows[i + 1];
      if (a.finishedAt !== null || b.finishedAt !== null || a.distance - b.distance > CAMERA.enterGap) continue;
      // 前の組と今の組の間に空きがあれば、別の競り合いとして今の組を映し続ける。
      let next = i + 1;
      while (next < activeLead && rows[next].distance - rows[next + 1].distance <= CAMERA.enterGap) next++;
      if (next < activeLead) continue;
      if (!samePair(this.candidate, a.id, b.id)) {
        this.candidate = [a.id, b.id];
        this.candidateSince = t;
      } else if (t - this.candidateSince >= CAMERA.enterTime) {
        this.pair = this.candidate;
        this.candidate = null;
        this.separatedSince = null;
      }
      return;
    }
    this.candidate = null;
  }

  end(t) {
    this.pair = this.candidate = null;
    this.separatedSince = null;
    this.readyAt = t + CAMERA.cooldown;
  }
}
