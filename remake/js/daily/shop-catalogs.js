import { CH2_CITY_NAME } from "../core/city-locations.js";
// 地元店の定番とは別の、隣町店の実際に購入できる品揃え。課題のストロベリーも扱う。
export const WIDEHANGA_FLAVORS = [
  "strawberry", "mint", "double_apple", "dragonfruit", "kiwi", "cool_mint",
  "blueberry_mint", "caramel", "cappuccino", "black_tea", "sakura", "jasmine", "rose",
  "white_gummy_bear", "red_gummy_bear", "spring_water",
  // 第2章の新入荷（いちごミルク・REIの「イエス」・あげはの南国系）。ライム・ビスケットは発売章（第3章）を過ぎた第5章から並ぶ。
  "milk", "cherry", "passion_fruit", "lime", "biscuit",
];
export const WIDEHANGA_SHOP_NAME = `Dr.fookah ${CH2_CITY_NAME}店`;

// 東京編で久世・スティーブ・ヴォルクの葉を自分でも試せる売り場。
// chocolate: 全国大会の課題「ドバジ チョコレート」。本番は大会が支給するが、事前に買って練習しておける場（#1052）。
// lime: スティーブのレモンライムを自分でも組める。biscuit: 課題のチョコと合わせて練習できる焼き菓子。
export const TOKYO_FLAVORS = ["spring_water", "black_tea", "nightside_blast_mint", "nightside_earlgrey_release", "mountain_mist", "pistachio", "frozen_citrus", "lemon", "cool_mint", "double_apple", "grape", "chocolate", "lime", "biscuit"];
export const TOKYO_SHOP_NAME = "Dr.fookah 東京店";

// 第4章ドバイ。日本の各店で扱ってきた葉を全部そろえる（品目は shop.js の DUBAI_FLAVORS）。
export const DUBAI_SHOP_NAME = "Dr.fookah ドバイ店";
