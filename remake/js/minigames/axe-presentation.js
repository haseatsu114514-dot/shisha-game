import { BULLS, KILLS } from "./axe-model.js";

const redCenters = [{ x: 0, y: 0 }, ...BULLS];
function direction(landing, targets) {
  const nearest = targets.reduce((best, target) =>
    Math.hypot(target.x - landing.x, target.y - landing.y) < Math.hypot(best.x - landing.x, best.y - landing.y) ? target : best);
  const dx = nearest.x - landing.x, dy = nearest.y - landing.y;
  return (Math.abs(dx) > .025 ? dx < 0 ? "左" : "右" : "") + (Math.abs(dy) > .025 ? dy < 0 ? "上" : "下" : "");
}

/** Copy follows the resolved outcome; it never changes scoring or the next throw. */
export function shotFeedback(shot) {
  if (shot.outcome === "drop") return { label: "DROP", tone: "drop",
    tip: (shot.dropReason === "weak" ? "力が足りず落下。" : "力が強く回転が合わず落下。") + "次は力54〜70%の緑の帯で止めよう。" };
  if (shot.outcome === "killshot") return { label: "KILLSHOT", tone: "killshot",
    tip: shot.score === 8 ? "宣言した青の中心に命中！鮮やかな一投。" : "宣言した青に命中！狙いと力が決まった。" };
  if (shot.outcome === "bull") return { label: "BULL'S EYE", tone: "bull", tip: "赤い中心に命中！鮮やかな一投。" };
  if (shot.outcome === "killshot-miss") {
    const target = KILLS.find(target => target.id === shot.called);
    const toward = target ? "次は着地点から" + direction(shot.landing, [target]) + "の青を狙おう。" : "次は宣言した青を狙おう。";
    return { label: "MISS", tone: "miss", tip: "宣言した青だけが得点対象。" + toward };
  }
  const hit = shot.outcome === "hit";
  const focus = shot.sway?.fatigue >= .7 && !shot.sway.focused ? "構えが長いときは「息を整える」も。" : "";
  return { label: hit ? "ON TARGET" : "MISS", tone: hit ? "hit" : "miss",
    tip: "次は着地点から" + direction(shot.landing, redCenters) + "の赤い中心を狙おう。" + focus };
}

/** Average is numeric, rounded to one decimal. Streak is the best run of 6+ points. */
export function sessionStats(shots = []) {
  let bulls = 0, killshots = 0, stuck = 0, total = 0, best = 0, streak = 0, run = 0;
  for (const shot of shots) {
    bulls += Number(shot.outcome === "bull" && shot.score === 6);
    killshots += Number(shot.outcome === "killshot");
    stuck += Number(Boolean(shot.stuck));
    total += shot.score; best = Math.max(best, shot.score);
    run = shot.score >= 6 ? run + 1 : 0; streak = Math.max(streak, run);
  }
  return { bulls, killshots, stuck, average: shots.length ? Math.round(total / shots.length * 10) / 10 : 0, best, streak };
}
