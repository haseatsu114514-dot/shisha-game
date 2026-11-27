// 店番のモブの客の絵（試作用。VPM29）。店 → 客の絵のID（種類。二人連れは 種類-a / 種類-b）→ パターンの並び
// キーは本編の客の絵のID（remake/js/daily/tonari-floor-data.js の GUESTS・floor-venues.js の MUKAI_GUESTS・DUBAI_GUESTS）。
// 絵は 256×256 の透過 WebP（胸から上。頭頂が上から約4%・あごが約64%）。出典と作り方は asset_sources/ui/portrait-stage-mobs-20261127/README.md
export const MOB_ART = {
  tonari: {
    first: [{ idle: "tonari-first-1.webp", happy: "tonari-first-1-happy.webp" }, { idle: "tonari-first-2.webp", happy: "tonari-first-2-happy.webp" }],
    worker: [{ idle: "tonari-worker-1.webp", happy: "tonari-worker-1-happy.webp" }, { idle: "tonari-worker-2.webp", happy: "tonari-worker-2-happy.webp" }],
    "train-a": [{ idle: "tonari-train-a-1.webp", happy: "tonari-train-a-1-happy.webp" }, { idle: "tonari-train-a-2.webp", happy: "tonari-train-a-2-happy.webp" }],
    "train-b": [{ idle: "tonari-train-b-1.webp", happy: "tonari-train-b-1-happy.webp" }, { idle: "tonari-train-b-2.webp", happy: "tonari-train-b-2-happy.webp" }],
    reader: [{ idle: "tonari-reader-1.webp", happy: "tonari-reader-1-happy.webp" }, { idle: "tonari-reader-2.webp", happy: "tonari-reader-2-happy.webp" }],
    "walkers-a": [{ idle: "tonari-walkers-a-1.webp", happy: "tonari-walkers-a-1-happy.webp" }, { idle: "tonari-walkers-a-2.webp", happy: "tonari-walkers-a-2-happy.webp" }],
    "walkers-b": [{ idle: "tonari-walkers-b-1.webp", happy: "tonari-walkers-b-1-happy.webp" }, { idle: "tonari-walkers-b-2.webp", happy: "tonari-walkers-b-2-happy.webp" }],
    nose: [{ idle: "tonari-nose-1.webp", happy: "tonari-nose-1-happy.webp" }, { idle: "tonari-nose-2.webp", happy: "tonari-nose-2-happy.webp" }],
    "students-a": [{ idle: "tonari-students-a-1.webp", happy: "tonari-students-a-1-happy.webp" }, { idle: "tonari-students-a-2.webp", happy: "tonari-students-a-2-happy.webp" }],
    "students-b": [{ idle: "tonari-students-b-1.webp", happy: "tonari-students-b-1-happy.webp" }, { idle: "tonari-students-b-2.webp", happy: "tonari-students-b-2-happy.webp" }],
    "talkers-a": [{ idle: "tonari-talkers-a-1.webp", happy: "tonari-talkers-a-1-happy.webp" }, { idle: "tonari-talkers-a-2.webp", happy: "tonari-talkers-a-2-happy.webp" }],
    "talkers-b": [{ idle: "tonari-talkers-b-1.webp", happy: "tonari-talkers-b-1-happy.webp" }, { idle: "tonari-talkers-b-2.webp", happy: "tonari-talkers-b-2-happy.webp" }],
    elder: [{ idle: "tonari-elder-1.webp", happy: "tonari-elder-1-happy.webp" }, { idle: "tonari-elder-2.webp", happy: "tonari-elder-2-happy.webp" }],
    "friends-a": [{ idle: "tonari-friends-a-1.webp", happy: "tonari-friends-a-1-happy.webp" }, { idle: "tonari-friends-a-2.webp", happy: "tonari-friends-a-2-happy.webp" }],
    "friends-b": [{ idle: "tonari-friends-b-1.webp", happy: "tonari-friends-b-1-happy.webp" }, { idle: "tonari-friends-b-2.webp", happy: "tonari-friends-b-2-happy.webp" }],
  },
  mukai: {
    remote: [{ idle: "mukai-remote-1.webp", happy: "mukai-remote-1-happy.webp" }, { idle: "mukai-remote-2.webp", happy: "mukai-remote-2-happy.webp" }],
    office: [{ idle: "mukai-office-1.webp", happy: "mukai-office-1-happy.webp" }, { idle: "mukai-office-2.webp", happy: "mukai-office-2-happy.webp" }],
    "after_work-a": [{ idle: "mukai-after_work-a-1.webp", happy: "mukai-after_work-a-1-happy.webp" }, { idle: "mukai-after_work-a-2.webp", happy: "mukai-after_work-a-2-happy.webp" }],
    "after_work-b": [{ idle: "mukai-after_work-b-1.webp", happy: "mukai-after_work-b-1-happy.webp" }, { idle: "mukai-after_work-b-2.webp", happy: "mukai-after_work-b-2-happy.webp" }],
    coffee_lover: [{ idle: "mukai-coffee_lover-1.webp", happy: "mukai-coffee_lover-1-happy.webp" }, { idle: "mukai-coffee_lover-2.webp", happy: "mukai-coffee_lover-2-happy.webp" }],
    new_tokyo: [{ idle: "mukai-new_tokyo-1.webp", happy: "mukai-new_tokyo-1-happy.webp" }, { idle: "mukai-new_tokyo-2.webp", happy: "mukai-new_tokyo-2-happy.webp" }],
    critic: [{ idle: "mukai-critic-1.webp", happy: "mukai-critic-1-happy.webp" }, { idle: "mukai-critic-2.webp", happy: "mukai-critic-2-happy.webp" }],
    "night_pair-a": [{ idle: "mukai-night_pair-a-1.webp", happy: "mukai-night_pair-a-1-happy.webp" }, { idle: "mukai-night_pair-a-2.webp", happy: "mukai-night_pair-a-2-happy.webp" }],
    "night_pair-b": [{ idle: "mukai-night_pair-b-1.webp", happy: "mukai-night_pair-b-1-happy.webp" }, { idle: "mukai-night_pair-b-2.webp", happy: "mukai-night_pair-b-2-happy.webp" }],
  },
  dubai: {
    traveler: [{ idle: "dubai-traveler-1.webp", happy: "dubai-traveler-1-happy.webp" }, { idle: "dubai-traveler-2.webp", happy: "dubai-traveler-2-happy.webp" }],
    souq_shopper: [{ idle: "dubai-souq_shopper-1.webp", happy: "dubai-souq_shopper-1-happy.webp" }, { idle: "dubai-souq_shopper-2.webp", happy: "dubai-souq_shopper-2-happy.webp" }],
    local_regular: [{ idle: "dubai-local_regular-1.webp", happy: "dubai-local_regular-1-happy.webp" }, { idle: "dubai-local_regular-2.webp", happy: "dubai-local_regular-2-happy.webp" }],
    vip: [{ idle: "dubai-vip-1.webp", happy: "dubai-vip-1-happy.webp" }, { idle: "dubai-vip-2.webp", happy: "dubai-vip-2-happy.webp" }],
    "majlis-a": [{ idle: "dubai-majlis-a-1.webp", happy: "dubai-majlis-a-1-happy.webp" }, { idle: "dubai-majlis-a-2.webp", happy: "dubai-majlis-a-2-happy.webp" }],
    "majlis-b": [{ idle: "dubai-majlis-b-1.webp", happy: "dubai-majlis-b-1-happy.webp" }, { idle: "dubai-majlis-b-2.webp", happy: "dubai-majlis-b-2-happy.webp" }],
    "pair_tour-a": [{ idle: "dubai-pair_tour-a-1.webp", happy: "dubai-pair_tour-a-1-happy.webp" }, { idle: "dubai-pair_tour-a-2.webp", happy: "dubai-pair_tour-a-2-happy.webp" }],
    "pair_tour-b": [{ idle: "dubai-pair_tour-b-1.webp", happy: "dubai-pair_tour-b-1-happy.webp" }, { idle: "dubai-pair_tour-b-2.webp", happy: "dubai-pair_tour-b-2-happy.webp" }],
    business: [{ idle: "dubai-business-1.webp", happy: "dubai-business-1-happy.webp" }, { idle: "dubai-business-2.webp", happy: "dubai-business-2-happy.webp" }],
  },
};
export const mobUrl = (file) => new URL(`./img/mob/${file}`, import.meta.url).href;
