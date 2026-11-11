// 占いの札の表（#3278・台帳 TMG44）。占う相手ごとに「その人っぽい」大アルカナを1枚。
// 札の絵は人物・顔・文字のない絵で、相手の名前は札にも帯にも出さない（CI110）。帯に出すのは札の名前（例: XVII 星）だけ。
// 絵は表の枠（#3254）の窓に入れた札の表（asset_sources/transitions/tarot-arcana-3278/make_webp.py が作る）。裏は #3254 の札の裏。
// 札の無い相手と、絵が読めなかったときは、これまでどおり光だけの表（motions/tarot.js）。
// 演出のファイル（motions/tarot.js）は使うときに読むので、先読み（vn/engine.js）からも引けるよう対応表はここに置く。

const card = (file, no, name) => Object.freeze({ file, no, name });
/** 相手のキャラID → 札（file: arcana/ のファイル名・no: 番号・name: 札の名前） */
export const TAROT_ARCANA = Object.freeze({
  sumi: card("09-hermit", "IX", "隠者"),
  naru: card("01-magician", "I", "魔術師"),
  adam: card("06-lovers", "VI", "恋人"),
  minto: card("03-empress", "III", "女帝"),
  tsumugi: card("17-star", "XVII", "星"),
  rio: card("02-high-priestess", "II", "女教皇"),
  hiyori: card("08-strength", "VIII", "力"),
  samechan: card("10-wheel", "X", "運命の輪"),
  ageha: card("19-sun", "XIX", "太陽"),
  kumicho: card("05-hierophant", "V", "教皇"),
  rei: card("18-moon", "XVIII", "月"),
  saku: card("00-fool", "0", "愚者"), // 綾取
  steve: card("14-temperance", "XIV", "節制"),
  volk: card("04-emperor", "IV", "皇帝"),
  mashiro: card("12-hanged", "XII", "吊るされた男"),
  da_silva: card("20-judgement", "XX", "審判"),
  sheikh: card("21-world", "XXI", "世界"),
  master_hookah: card("11-justice", "XI", "正義"), // 王 煙楼
  noor: card("07-chariot", "VII", "戦車"),
});

const DIR = new URL("../../img/ui/transitions/tarot/", import.meta.url).href;
/** 札の裏（#3254・1024x1536 の原寸。外は透過で、札の外形は CSS の .mo-tarot-pic.back で面に合わせる） */
export const TAROT_BACK_URL = `${DIR}card-back.webp`;
export const tarotArcana = (charId) => (typeof charId === "string" && Object.hasOwn(TAROT_ARCANA, charId) ? TAROT_ARCANA[charId] : null);
export const arcanaUrl = (arc) => `${DIR}arcana/${arc.file}.webp`;
/** 会話の先読みに足す絵（札の無い相手は無し） */
export function tarotArtUrls(charId) {
  const arc = tarotArcana(charId);
  return arc ? [TAROT_BACK_URL, arcanaUrl(arc)] : [];
}

/** めくる前に、裏と表の絵を読み終えておく。札の無い相手・読めない・時間切れは null（光だけの表で続ける） */
export async function loadTarotArt(charId, timeoutMs = 6000) {
  const arc = tarotArcana(charId);
  if (!arc) return null;
  const load = (src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    return img.decode().then(() => img);
  };
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs, null); });
  const ready = Promise.all([load(TAROT_BACK_URL), load(arcanaUrl(arc))])
    .then(([back, front]) => ({ arc, back, front }), () => null);
  try {
    return await Promise.race([ready, late]);
  } finally {
    clearTimeout(timer);
  }
}
