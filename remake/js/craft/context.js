// 制作の表示だけ。練習・レッスン・リハーサルに架空の客や審査員を置かない。
export function craftContext(cs) {
  const practice=cs.mode==="drill"||cs.mode==="rehearsal"||!!cs.practiceKind;
  if(cs.mode==="tournament")return {title:"提供",summary:"審査員へシーシャを提供した。しばらく吸ってもらおう",recipient:"審査員",returned:"審査員へ戻せた",waiting:"審査員が吸ううちに"};
  if(cs.mode==="tutorial")return {title:"仕上がりの確認",summary:"スミさんと仕上がりを確かめよう",recipient:"スミさん",returned:"スミさんと確かめられた",waiting:"試し吸いをするうちに"};
  if(practice)return {title:"試し吸い",summary:"自分で吸って仕上がりを確かめよう",recipient:"自分",returned:"自分で仕上がりを確かめられた",waiting:"試し吸いを続けるうちに"};
  return {title:"提供",summary:"お客さんへシーシャを提供した。しばらく吸ってもらおう",recipient:"お客さん",returned:"お客さんへ戻せた",waiting:"お客さんが吸ううちに"};
}
export function craftMode(cs,defaults) {
  if(cs.eventTitle)return cs.eventTitle;
  return cs.practiceKind&&cs.practiceKind!=="rehearsal"&&cs.mode!=="tutorial"?"PRACTICE":defaults[cs.mode]||"";
}
export function craftModeNote(cs,defaults) {
  return cs.eventNote || (cs.mode!=="tutorial"&&cs.practiceKind ? cs.practiceKind==="rehearsal"?"大会前のリハーサル":cs.practiceKind==="midcheck"?"手順の中間チェック":"一台を作る練習" : defaults[cs.mode]||"");
}
