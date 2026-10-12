window.TRAILER_SPEC = {
  title: "水煙前線",
  subtitle: "-EN:CODE-",
  duration: 37,
  fps: 24,
  width: 1280,
  height: 720,
  audio: "none",
  segments: [
    {kind:"intro", duration:2.5, text:"勝つほど、遠くなる。"},
    {kind:"scene", duration:5.5, image:"../images/01-sumi-silence.png", speaker:"スミ", text:"あの顔は、知ってる。", source:"data/dialogue/ch2_main.json#ch2_sumi_silence", move:"in", focus:[0.32,0.35]},
    {kind:"scene", duration:5, image:"../images/02-naru-confrontation.png", speaker:"なる", text:"話してる相手まで点で見なくていいだろ", source:"data/dialogue/ch2_isolation.json#ch2_naru_confrontation", move:"hold", focus:[0.75,0.35]},
    {kind:"scene", duration:4.5, image:"../images/03-minto-warning.png", speaker:"みんと", text:"何があっても、わたしはここにいるから。", source:"data/dialogue/ch2_isolation.json#ch2_minto_warning", move:"in", focus:[0.4,0.42]},
    {kind:"scene", duration:5.5, image:"../images/04-tsumugi-water.png", speaker:"つむぎ", text:"……少し、お水を飲みませんか", source:"data/dialogue/ch2_isolation.json#ch2_tsumugi_color", move:"slide", focus:[0.57,0.64]},
    {kind:"scene", duration:4.5, image:"../images/05-ageha-departure.png", speaker:"アゲハ", text:"……ごめん。理由は、聞かないで", source:"data/dialogue/ch2_isolation.json#ch2_empty_victory", move:"in", focus:[0.32,0.42]},
    {kind:"scene", duration:6, image:"../images/06-empty-victory.png", speaker:"はじめ（心の声）", text:"……俺、なんのために勝ったんだっけ。", source:"data/dialogue/ch2_isolation.json#ch2_empty_victory", move:"out", focus:[0.68,0.55]},
    {kind:"outro", duration:3.5, text:"誰のために、煙を作る。"}
  ]
};
