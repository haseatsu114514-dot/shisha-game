// 第5章の遠出（東京・ドバイ）の交通の決まり（FIN13・FIN14 / 2026-11-02 オーナー「東京は配送便で」「ドバイの交通費はシェイクの手紙で」）。
// 状態を読む・記録するだけで、行動・場面・所持金は扱わない（chapters/ch5-tokyo.js・ch5-dubai.js が使う。単体で読めるよう import しない）。
//
// 東京: Dr.fookah の配送便（問屋街から東京店へ葉を運ぶ車）に乗せてもらう。運賃はかからない。
//   便は昼に出て、途中の店で荷を降ろしながら走るので、着くのは夜（その日の昼と夜の2行動。新幹線の1行動より1つ多い）。
//   帰りも同じ便で、昼に出て夜に地元へ着く。夜は便が無い。今夜にLIMEの約束がある日も乗らない（約束を飛ばさない）。
// ドバイ: シェイクの手紙に、毎回往復の切符が同封されている（運賃はかからない。切符1枚で1往復）。
//   最初の手紙は「ドバイへ」を選んだ時に読む。2通目からは、ドバイから帰った日の DUBAI_LETTER_DAYS 日後の朝に届く。

/** 配送便で使う行動の数（昼に出て夜に着く）。 */
export const TOKYO_VAN_SLOTS = 2;
/** ドバイから帰って、次の手紙（往復の切符入り）が届くまでの日数。 */
export const DUBAI_LETTER_DAYS = 2;
/** 2通目からの手紙の場面（順に巡回する。data/dialogue/ch5_dubai.json）。 */
export const DUBAI_LETTER_AGAIN = Object.freeze(["ch5_dubai_letter_again", "ch5_dubai_letter_again_b"]);

const LETTER = "_ch5_dubai_letter"; // 最初の招待の手紙を読んだ
const LETTERS = "_ch5_dubai_letters"; // 読んだ手紙の数（無い旧保存は、最初の手紙を読んでいれば1通）
const TICKET = "_ch5_dubai_ticket"; // 手紙に同封された往復の切符を持っている
const FLIGHTS = "_ch5_dubai_flights"; // ドバイへ飛んだ回数
const BACK_DAY = "_ch5_dubai_back_day"; // ドバイから帰った日（通算日）

const tonightInvite = value => {
  const invite = value?.pendingInvite;
  return !!invite && (invite.day ?? value.day) === value.day && invite.slot === 1;
};

/** 配送便に乗れない理由（乗れる時は null）。地図のピンと、選んだ時の確認で同じものを使う。 */
export function tokyoVanBlock(value) {
  if ((value?.slot ?? 0) !== 0) return { why: "配送便は昼に出る。夜は便が無い", tag: "便は昼だけ" };
  if (tonightInvite(value)) return { why: "今夜はLIMEの約束がある。配送便はまた今度", tag: "今夜は約束" };
  return null;
}

/** 往復の切符を持っているか。切符の記録が無い旧保存は、最初の手紙を読んで、まだ飛んでいなければ持っている。 */
export function hasDubaiTicket(value) {
  const flags = value?.flags || {};
  if (typeof flags[TICKET] === "boolean") return flags[TICKET];
  return !!flags[LETTER] && !(flags[FLIGHTS] > 0);
}

const lettersRead = flags => Number.isInteger(flags[LETTERS]) ? flags[LETTERS] : flags[LETTER] ? 1 : 0;

/**
 * 「ドバイへ」の今の状態。
 * - { ok: true, letter: null }: 切符を持っている
 * - { ok: true, letter: 場面ID }: 手紙が届いている（読むと切符が手に入る）
 * - { ok: false, daysLeft }: 次の手紙を待っている
 * 帰った日の記録が無い旧保存（前の決まりで往復を払っていた保存）は、もう届いている。
 */
export function dubaiTripStatus(value) {
  if (hasDubaiTicket(value)) return { ok: true, letter: null };
  const flags = value?.flags || {};
  const read = lettersRead(flags);
  const letter = read === 0 ? "ch5_dubai_letter" : DUBAI_LETTER_AGAIN[(read - 1) % DUBAI_LETTER_AGAIN.length];
  const back = flags[BACK_DAY];
  const daysLeft = read > 0 && Number.isInteger(back) ? back + DUBAI_LETTER_DAYS - value.day : 0;
  return daysLeft > 0 ? { ok: false, daysLeft } : { ok: true, letter };
}

/** 手紙を読み終えた（同封の往復の切符が手に入る）。 */
export function receiveDubaiLetter(value) {
  const flags = value.flags;
  flags[LETTERS] = lettersRead(flags) + 1;
  flags[LETTER] = true;
  flags[TICKET] = true;
}

/** 切符でドバイへ飛んだ（帰りの便も同じ切符）。 */
export function useDubaiTicket(value) {
  const flags = value.flags;
  flags[TICKET] = false;
  flags[FLIGHTS] = (flags[FLIGHTS] || 0) + 1;
}

/** ドバイから帰った（次の手紙は、この日の DUBAI_LETTER_DAYS 日後の朝に届く）。 */
export function recordDubaiReturn(value) {
  value.flags[BACK_DAY] = value.day;
}
