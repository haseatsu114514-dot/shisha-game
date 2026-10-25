// 訪問数・好感度から未読の紹介を補完しない。友人にも開く任意施設。
export const CINEMA_INTRO = "samechan_cinema_introduction";
export const cinemaDiscovered = game => !!game && game.chapter >= 2
  && game.flags?._samechan_cinema_introduced === true;
export const cinemaIntroductionDue = game => !!game && game.chapter >= 2
  && game.phase === "daily" && !!game.met?.samechan
  && game.flags?._samechan_quiet_seat_done === true && !cinemaDiscovered(game);

// 上映作品は4本の小さな固定レパートリー。同じ作品の別場面・感想を再訪で読む。
export const CINEMA_FILMS = Object.freeze({
  shark: Object.freeze({ label: "サメ映画", bg: "bg_rojiura_cinema" }),
  space: Object.freeze({ label: "宇宙SF", bg: "bg_rojiura_cinema_space" }),
  monster: Object.freeze({ label: "着ぐるみ怪獣", bg: "bg_rojiura_cinema_monster" }),
  detective: Object.freeze({ label: "白黒探偵", bg: "bg_rojiura_cinema_detective" }),
});
export const CINEMA = Object.freeze({
  id: "rojiura_cinema", kind: "spot", region: "home",
  label: "路地裏シネマ", area: "商店街の路地裏",
  x: 47, y: 19, theme: "stadium", glyph: "映",
  cost: 1000, stamina: -8, stat: "insight",
  bg: "bg_rojiura_cinema", preview: "bg_rojiura_cinema",
  first: "cinema_first_screening",
  pool: ["cinema_cardboard_planet", "cinema_handmade_shark", "cinema_rubber_monster",
    "cinema_handpainted_sign", "cinema_detective_shadow", "cinema_sound_before_shadow",
    "cinema_endroll_applause", "cinema_last_row", "cinema_space_radio",
    "cinema_monster_footprints", "cinema_detective_silence"],
  desc: "四本ほどのB級映画を繰り返しかける小さな名画座。サメ映画も定番。1,000円・体力8・1行動。",
});
