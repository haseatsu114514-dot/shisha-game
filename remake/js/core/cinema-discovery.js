// 訪問数・好感度から未読の紹介を補完しない。友人にも開く任意施設。
export const CINEMA_INTRO = "samechan_cinema_introduction";
export const cinemaDiscovered = game => !!game && game.chapter >= 2
  && game.flags?._samechan_cinema_introduced === true;
export const cinemaIntroductionDue = game => !!game && game.chapter >= 2
  && game.phase === "daily" && !!game.met?.samechan
  && game.flags?._samechan_quiet_seat_done === true && !cinemaDiscovered(game);

export const CINEMA = Object.freeze({
  id: "rojiura_cinema", kind: "spot", region: "home",
  label: "路地裏シネマ", area: "商店街の路地裏",
  x: 47, y: 19, theme: "stadium", glyph: "映",
  cost: 1000, stamina: -8, stat: "insight", openSlots: [0, 1],
  bg: "bg_rojiura_cinema", preview: "bg_rojiura_cinema",
  first: "cinema_first_screening",
  pool: ["cinema_handmade_shark", "cinema_sound_before_shadow"],
  desc: "サメ映画を大切に上映する小さな名画座。1,000円・体力8・1行動で一作を観る。",
});
