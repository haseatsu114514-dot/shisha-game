// 本筋で完読した連絡だけを読む。受信/返信/好感度/既読/SAVEは更新しない。
export function storyThreadStatus(sender, game) {
  if (sender !== "naru" || game?.chapter !== 2 || !game.flags?._ch2_read_ch2_naru_window) return null;
  if (game.flags._ch2_naru_hurt) return "連絡の状況：謝罪は既読のまま。電話にもまだ出てもらえていない。下には以前のやり取りを残しています。";
  if (game.flags._ch2_naru_listened) return "連絡の状況：休業した店の前で、居場所を尋ねるLIMEを送った。その件への返事はまだない。下には以前のやり取りを残しています。";
  return null;
}
