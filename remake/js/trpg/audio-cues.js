// TRPG の音の割り当て（仮。一旦入れた音で、オーナーの試聴後に差し替える前提）。
// 出典・ライセンス（すべて CC0）・再生成手順は asset_sources/music/trpg-audio/README.md。
// SE は assets/audio/se/trpg/、BGM は assets/audio/bgm/ の manifest 登録曲（core/audio.js の playBgm）。

/** 卓の効果音: 種類 -> 録音ファイル（複数ならランダムに切り替える）。無い種類は合成音のまま。 */
export const TRPG_SE = Object.freeze({
  open: ["book_open.wav"],                         // 本棚から本を開く・物語の開始
  page: ["page_flip_01.wav", "page_flip_02.wav"],  // 場面が変わる（探索→見立て→山場→結末）
  shake: ["dice_shake.wav"],                       // ダイスを手の中で振る
  land: ["dice_throw_01.wav", "dice_throw_02.wav", "dice_throw_03.wav"], // 2個が卓に落ちる
  rethrow: ["die_throw_01.wav", "die_throw_02.wav"], // 1個だけ振り直す
  card: ["card_place_01.wav", "card_place_02.wav"],  // 連携札を出す
  slip: ["card_slide_01.wav", "card_slide_02.wav"],  // 手がかりのメモが卓へ滑る
  success: ["jingle_success.wav"],
  mixed: ["jingle_mixed.wav"],
  trouble: ["jingle_trouble.wav"],
  critical: ["jingle_critical.wav"],
  fumble: ["jingle_fumble.wav"],
  ending: ["jingle_ending.wav"],
});

/** シナリオの見た目テーマ（presentation.theme）-> 卓の間に流す BGM のキー。 */
export const TRPG_THEME_BGM = Object.freeze({
  harbor: "bgm_trpg",          // ordinary-cup: ボドゲカフェの採用曲そのまま
  shark: "bgm_trpg_shark",     // shark-last-order
  leaf: "bgm_trpg_leaf",       // leaf-mail
  heist: "bgm_trpg_heist",     // apple-thief
  island: "bgm_trpg_island",   // shark-island
  mist: "bgm_trpg_magic",      // mist-kingdom（magic と共用）
  space: "bgm_trpg_space",     // smoke-robot
  magic: "bgm_trpg_magic",     // fading-familiar
  fox: "bgm_trpg_fox",         // fox-market
  stage: "bgm_trpg_stage",     // stage-ghost
  castle: "bgm_trpg_castle",   // moonflower-encore
  sparkle: "bgm_purikura",     // purikura-hero: 既存のプリクラ曲
  mansion: "bgm_trpg_mansion", // doll-requiem
});

/** 本棚（シナリオ選択）と卓の外で流す曲。 */
export const TRPG_SHELF_BGM = "bgm_trpg";
