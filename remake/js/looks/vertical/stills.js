// 縦画面「煙の舞台」: 縦に作り直したスチル（要望台帳 VPT01〜VPT12）。
// 本編が会話で一枚絵（show_cg）を出したとき、ここに id がある絵は、横長の絵の代わりに縦の絵（2:3）を出す（talk.js の syncCg）。
// 絵は remake/img/cgs/portrait/<id>.webp。原画・依頼文・検品は asset_sources/stills-portrait-20261128/。
// 本編の横画面と旧版の見た目は、今までどおり横長の絵（remake/img/cgs/<id>.webp）を使う。
import { imgFileUrl } from "../../core/img-file.js";

export const PORTRAIT_STILLS = new Set([
  // 第1章
  "cg_oneesan_first_smoke", "cg_ch1_sumi_training", "cg_tsumugi_smoke_color", "cg_ch1_tsumugi_heart_art", "cg_minto_cheki",
  "cg_minto_casual", "cg_ch1_minto_casual_reveal", "cg_ch1_tournament_battle", "cg_ch1_sui_smile", "cg_ch1_dr_kemuri_hook",
  // 第2章
  "cg_ch2_kanzaki_id_check", "cg_ch2_sofa_wet_cloth", "cg_ch2_ageha_lesson", "cg_ch2_naru_score_sheet", "cg_naru_after_hours",
  "cg_ch2_rest_notebook", "cg_ch2_rei_earphone", "cg_ch2_ageha_white_bear",
  // 第3章
  "cg_ch3_childhood_offered_hand", "cg_saku_mashiro_childhood", "cg_mashiro_double_apple", "cg_ch3_mashiro_no_craft_day",
  "cg_ch3_mukai_latte_cat", "cg_naru_next_entry", "cg_ch3_liars_night", "cg_ch3_national_ask_customer", "cg_naru_last_chance", "cg_ch3_half_cake",
  // 第4章
  "cg_ch4_dubai_arrival", "cg_ch4_traveler_chair", "cg_ch4_festa_welcome", "cg_ch4_creek_dhow", "cg_ch4_noor_pencil_x",
  "cg_ch4_traveler_tongs", "cg_ch4_sheikh_reveal", "cg_ch4_world_handshake", "cg_ch4_young_sumi_water",
  // 第5章
  "cg_ch5_sumi_pulls_chair", "cg_ch5_doctor_yunomi", "cg_ch5_tsumugi_serves_hajime", "cg_ch5_adam_two_bowls", "cg_ch5_shisha_9000",
  "cg_ch5_regular_hose_lap", "cg_ch5_cocreation_notes", "cg_ch5_party_toast",
  // 告白・結末
  "cg_minto_confession", "cg_tsumugi_confession", "cg_ageha_confession", "cg_mashiro_confession", "cg_rio_confession",
  "cg_hiyori_confession", "cg_samechan_confession", "cg_ending_tonari_night",
]);

/** 縦の絵の URL（無ければ null） */
export function portraitStillUrl(id) {
  return id && PORTRAIT_STILLS.has(id) ? imgFileUrl(`cgs/portrait/${id}.webp`) : null;
}
