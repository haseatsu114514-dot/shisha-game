// カードゲーム「一台勝負」の絵の引き当て。
// 1) このゲームのために作った絵: remake/img/ui/ichidai/<種類>/<id>.webp。下の ICHIDAI_ART に id があるものだけ読む
//    （一覧は remake/tools/build_ichidai_art.py が書き直す。足し方は asset_sources/card_game/README.md）。
//      flavor … 葉（id は ichidai-data.js の FLAVORS の id）   card … デッキのカード（CARDS の id）
//      table … 卓（mat）                                        back … 裏面（deck＝デッキ・judge＝審査カード）
// 2) 無いものは本編の正規の絵を使う: 葉＝ショップの箱絵、炭＝シーシャ作りの炭、チャコスタ＝コンロ、人物・審査員＝顔アイコン、
//    ボウルとHMD＝シーシャ作り・ショップの機材。
// 3) それも無い技・イベント・器具は、成長盤の線画アイコンを仮の絵にする（絵が届いたら 1) が優先される）。
import { imgFileUrl } from "../core/img-file.js";
import { faceIconUrl } from "../core/data.js";
import { SHOP_ART } from "../daily/shop-art.js";
import { AF_VANILLA_ART } from "../daily/shop-art-af-vanilla.js";
import { REMAINING_SHOP_ART } from "../daily/shop-art-remaining.js";
import { LIMITED_FLAVOR_ART } from "../daily/shop-art-limited.js";
import { CHARACTER_FLAVOR_ART } from "../daily/shop-art-character-flavors.js";
import { NEW_FLAVOR_ART } from "../daily/shop-art-new-flavors.js";
import { FLAVOR_CARTONS_3287_ART } from "../daily/shop-art-flavor-cartons-3287.js";

export const ICHIDAI_ART = Object.freeze({
  flavor: [],
  card: ["add_coal", "all_in", "ash_tap", "blow", "breath", "buyout", "draft", "duel", "encore", "fan", "go_second", "heat_in", "heat_out", "hype", "inner", "loosen", "outer", "read", "repack", "reset", "show_smoke", "timer", "tongs", "venue_heat"],
  table: [],
  back: [],
});

const own = (kind, id) => (ICHIDAI_ART[kind]?.includes(id) ? { url: imgFileUrl(`ui/ichidai/${kind}/${id}.webp`), mode: "art" } : null);
/** このゲームのために作った絵のURL（無ければ null） */
export const artUrl = (kind, id) => own(kind, id)?.url || null;

const making = (name) => imgFileUrl(`ui/making/${name}.webp`);
const icon = (name) => imgFileUrl(`ui/growth_board/icons/${name}.webp`);
const equip = (name) => imgFileUrl(`shop/equipment/${name}.webp`);

// ───────── 葉 ─────────
// ショップの箱絵（本編 shop.js の generatedFlavorArt と同じ並び）。箱絵の無い葉のうち、同じ果物の箱があるものはそれを借りる。
const shopBox = (id) => AF_VANILLA_ART[id] || SHOP_ART[id] || REMAINING_SHOP_ART[id] || LIMITED_FLAVOR_ART[id]
  || NEW_FLAVOR_ART[id] || CHARACTER_FLAVOR_ART[id] || FLAVOR_CARTONS_3287_ART[id] || null;
const FLAVOR_ALIAS = { ice_grape: "grape" };
/** 葉の絵。{ url, mode:"art" } か { url, size:[w,h], box:[x,y,w,h], mode:"box" }。無ければ null */
export function flavorArt(id) {
  const box = shopBox(id) || shopBox(FLAVOR_ALIAS[id]);
  return own("flavor", id) || (box ? { ...box, mode: "box" } : null);
}

// ───────── デッキのカード ─────────
const CARD_SPRITE = { flat: "coal_flat_just", cube: "coal_just", dense_flat: "coal_flat_red", chacosta: "heat_stove" };
// 人物カードと審査員 → 本編のキャラID（顔アイコン）
export const PERSON_FACE = Object.freeze({ sumi: "sumi", naru: "naru", adam: "adam", minto: "minto", mashiro: "mashiro", tsumugi: "tsumugi", packy: "pakki" });
export const JUDGE_FACE = Object.freeze({ kamizono: "maezono", hakase: "dr_kemuri", sensu: "sui", emir: "emil", taiyo: "da_silva" });
// 絵がまだ無いカードの仮の絵（成長盤の線画アイコン）
const CARD_ICON = {
  heat_in: "skill_K16", heat_out: "skill_K22", blow: "skill_K12", show_smoke: "skill_K21", all_in: "peak", duel: "skill_K08",
  read: "skill_K07", ash_tap: "skill_K14", add_coal: "perk_heat", tongs: "skill_K11", fan: "perk_coal", inner: "skill_K06", outer: "skill_K17",
  loosen: "perk_leaf", breath: "perk_sleep", reset: "skill_K24",
  windguard: "perk_dodge", timer: "perk_gauge", ice_hose: "perk_pull", diffuser: "skill_K02",
  hype: "skill_K13", draft: "skill_K05", venue_heat: "perk_stage", go_second: "skill_K04", buyout: "skill_K20", repack: "skill_K18", encore: "skill_K10",
};
/** 顔アイコン。本編のデータを読んでいれば設定の画風に合わせ、試遊ページでは現行の絵を直接読む */
export const faceUrl = (charId) => (charId ? faceIconUrl(charId) || imgFileUrl(`ui/face_icons/face_${charId}.webp`) : null);
/** カードの絵。mode: "art"（専用の絵）/"sprite"（炭・コンロ。透過）/"face"（顔）/"icon"（線画）。無ければ null */
export function cardArt(id) {
  return own("card", id)
    || (CARD_SPRITE[id] ? { url: making(CARD_SPRITE[id]), mode: "sprite" } : null)
    || (PERSON_FACE[id] ? { url: faceUrl(PERSON_FACE[id]), mode: "face" } : null)
    || (CARD_ICON[id] ? { url: icon(CARD_ICON[id]), mode: "icon" } : null);
}

// ───────── 卓の上のもの ─────────
/** 炭の絵。shape: "flat"|"cube"、state: "cold"（置いたばかり）|"warm"（火おこし中）|"hot"（焼けた・表向き）|"ember"（種火） */
export const coalSprite = (shape, state) => making(`coal${shape === "flat" ? "_flat" : ""}_${{ cold: "cold", warm: "red", hot: "just", ember: "white" }[state]}`);
export const STOVE_ART = making("heat_stove");
const BOWL_ART = { silicone: ["bowl_empty_silicone", "bowl_packed_normal"], funnel: ["bowl_empty_phunnel", "bowl_packed_phunnel_normal"],
  clay: ["bowl_empty_clay", "bowl_empty_clay"], beat80: ["bowl_empty_clay", "bowl_empty_clay"] };
export const bowlArt = (bowlId, packed) => making((BOWL_ART[bowlId] || BOWL_ART.clay)[packed ? 1 : 0]);
const HMD_ART = { lotus: "lotos_hagal", amaburst: "amaburst_hms", tanukish: "tanukish_lid", big_tanukish: "tanukish_lid" };
export const hmdArt = (hmdId) => equip(HMD_ART[hmdId] || "lotos_hagal");
