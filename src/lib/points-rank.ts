/** 宿題10分=1pt、自主10分=3pt の素点 */
export function rawPointsForSession(
  minutes: number,
  kind: "homework" | "self_study"
): number {
  const blocks = Math.floor(minutes / 10);
  return kind === "homework" ? blocks * 1 : blocks * 3;
}

/** 1日あたり「3倍」が掛かる素点の上限（ジュース枠） */
export const DAILY_TRIPLE_RAW_CAP = 30;

/**
 * 今日すでに3倍消化した素点 tripleUsed に対し、今回の raw を分配。
 * 返り値: { awarded, newTripleUsed, triplePortion }
 */
export function applyDailyTriple(
  raw: number,
  tripleUsed: number,
  todayKey: string,
  storedBonusDate: string | null
): { awarded: number; newTripleUsed: number; newBonusDate: string } {
  let used = tripleUsed;
  if (storedBonusDate !== todayKey) {
    used = 0;
  }
  const room = Math.max(0, DAILY_TRIPLE_RAW_CAP - used);
  const triplePortion = Math.min(raw, room);
  const normalPortion = raw - triplePortion;
  const awarded = normalPortion + triplePortion * 3;
  return {
    awarded,
    newTripleUsed: used + triplePortion,
    newBonusDate: todayKey,
  };
}

export const RANKS = [
  // ── Layer 1: 🌿 植物・大樹層 ──
  { id: "seed", name: "🌱 シード", minPoints: 0 },
  { id: "sprout", name: "🌿 スプラウト", minPoints: 100 },
  { id: "leaf", name: "🍃 リーフ", minPoints: 200 },
  { id: "flower", name: "🌸 フラワー", minPoints: 300 },
  { id: "tree", name: "🌳 ツリー", minPoints: 400 },
  { id: "forest", name: "🌲 フォレスト", minPoints: 500 },
  { id: "plant_master", name: "🌴 プラントマスター", minPoints: 600 },

  // ── Layer 2: 🪵 自然・素材層 ──
  { id: "mud", name: "🟤 マッド", minPoints: 700 },
  { id: "wood", name: "🪵 ウッド", minPoints: 800 },
  { id: "bush", name: "🌿 ブッシュ", minPoints: 900 },
  { id: "stone", name: "🪨 ストーン", minPoints: 1000 },
  { id: "rock", name: "🗿 ロック", minPoints: 1100 },
  { id: "clay", name: "🏺 クレイ", minPoints: 1200 },
  { id: "nature_master", name: "🏔️ ネイチャーマスター", minPoints: 1300 },

  // ── Layer 3: ⚔️ 金属・武具層 ──
  { id: "iron", name: "⚙️ アイアン", minPoints: 1400 },
  { id: "steel", name: "🔩 スチール", minPoints: 1500 },
  { id: "bronze", name: "🥉 ブロンズ", minPoints: 1600 },
  { id: "silver", name: "🥈 シルバー", minPoints: 1700 },
  { id: "gold", name: "🥇 ゴールド", minPoints: 1800 },
  { id: "titanium", name: "🔧 チタニウム", minPoints: 1900 },
  { id: "chrome", name: "✨ クロム", minPoints: 2000 },
  { id: "tungsten", name: "💠 タングステン", minPoints: 2100 },
  { id: "metal_master", name: "⚔️ メタルマスター", minPoints: 2200 },

  // ── Layer 4: 💎 宝石・貴石層 ──
  { id: "quartz", name: "🔮 クォーツ", minPoints: 2300 },
  { id: "topaz", name: "💛 トパーズ", minPoints: 2400 },
  { id: "amethyst", name: "💜 アメジスト", minPoints: 2500 },
  { id: "aquamarine", name: "💙 アクアマリン", minPoints: 2600 },
  { id: "emerald", name: "💚 エメラルド", minPoints: 2700 },
  { id: "sapphire", name: "🔵 サファイア", minPoints: 2800 },
  { id: "ruby", name: "❤️ ルビー", minPoints: 2900 },
  { id: "diamond", name: "💎 ダイヤモンド", minPoints: 3000 },
  { id: "black_diamond", name: "🖤 ブラックダイヤモンド", minPoints: 3100 },
  { id: "jewel_master", name: "👑 ジュエルマスター", minPoints: 3200 },

  // ── Layer 5: ✨ ファンタジー素材層 ──
  { id: "damascus", name: "🗡️ ダマスカス", minPoints: 3300 },
  { id: "mithril", name: "🪄 ミスリル", minPoints: 3400 },
  { id: "adamantite", name: "🛡️ アダマンタイト", minPoints: 3500 },
  { id: "orichalcum", name: "⚡ オリハルコン", minPoints: 3600 },
  { id: "hihi_irokane", name: "🔥 ヒヒイロカネ", minPoints: 3700 },
  { id: "legend_material_master", name: "✨ レジェンドマテリアルマスター", minPoints: 3800 },

  // ── Layer 6: 🐲 幻獣・生物層 ──
  { id: "slime", name: "🫧 スライム", minPoints: 3900 },
  { id: "goblin", name: "👺 ゴブリン", minPoints: 4000 },
  { id: "wolf", name: "🐺 ウルフ", minPoints: 4100 },
  { id: "ogre", name: "👹 オーガ", minPoints: 4200 },
  { id: "griffon", name: "🦁 グリフォン", minPoints: 4300 },
  { id: "chimera", name: "🐍 キマイラ", minPoints: 4400 },
  { id: "wyvern", name: "🦎 ワイバーン", minPoints: 4500 },
  { id: "dragon", name: "🐉 ドラゴン", minPoints: 4600 },
  { id: "behemoth", name: "🦣 ベヒーモス", minPoints: 4700 },
  { id: "leviathan", name: "🐋 リヴァイアサン", minPoints: 4800 },
  { id: "beast_master", name: "🐲 ビーストマスター", minPoints: 4900 },

  // ── Layer 7: 🦅 翼・飛行層 ──
  { id: "feather", name: "🪶 フェザー", minPoints: 5000 },
  { id: "wing", name: "🕊️ ウィング", minPoints: 5100 },
  { id: "hawk", name: "🐦 ホーク", minPoints: 5200 },
  { id: "eagle", name: "🦅 イーグル", minPoints: 5300 },
  { id: "sky_soarer", name: "☁️ スカイマスター", minPoints: 5400 },
  { id: "phoenix", name: "🔥 フェニックス", minPoints: 5500 },
  { id: "sky_master", name: "🌤️ スカイマスター", minPoints: 5600 },

  // ── Layer 8: 🔮 魔術・神秘層 ──
  { id: "mana", name: "💫 マナ", minPoints: 5700 },
  { id: "wizard", name: "🧙 ウィザード", minPoints: 5800 },
  { id: "warlock", name: "🔮 ウォーロック", minPoints: 5900 },
  { id: "sorcerer", name: "⚡ ソーサラー", minPoints: 6000 },
  { id: "archmage", name: "🌟 アークメイジ", minPoints: 6100 },
  { id: "sage", name: "📖 賢者", minPoints: 6200 },
  { id: "oracle", name: "👁️ オラクル", minPoints: 6300 },
  { id: "spell_master", name: "🪄 スペルマスター", minPoints: 6400 },

  // ── Layer 9: 🎖️ 軍隊・階級層 ──
  { id: "private", name: "🪖 二等兵", minPoints: 6500 },
  { id: "corporal", name: "🎖️ 伍長", minPoints: 6600 },
  { id: "sergeant", name: "💪 軍曹", minPoints: 6700 },
  { id: "second_lieutenant", name: "⭐ 少尉", minPoints: 6800 },
  { id: "first_lieutenant", name: "🌟 中尉", minPoints: 6900 },
  { id: "captain_military", name: "🎯 大尉", minPoints: 7000 },
  { id: "major", name: "🏅 少佐", minPoints: 7100 },
  { id: "lt_colonel", name: "🎗️ 中佐", minPoints: 7200 },
  { id: "colonel", name: "🦅 大佐", minPoints: 7300 },
  { id: "general", name: "⚔️ 将軍", minPoints: 7400 },
  { id: "admiral", name: "🚢 提督", minPoints: 7500 },
  { id: "military_master", name: "🎖️ ミリタリーマスター", minPoints: 7600 },

  // ── Layer 10: 🏰 貴族・爵位層 ──
  { id: "knight", name: "🛡️ ナイト", minPoints: 7700 },
  { id: "baron", name: "🏠 男爵", minPoints: 7800 },
  { id: "viscount", name: "🏛️ 子爵", minPoints: 7900 },
  { id: "earl", name: "🍷 伯爵", minPoints: 8000 },
  { id: "marquis", name: "🏰 侯爵", minPoints: 8100 },
  { id: "duke", name: "👑 公爵", minPoints: 8200 },
  { id: "prince", name: "🤴 親王", minPoints: 8300 },
  { id: "king", name: "👑 国王", minPoints: 8400 },
  { id: "emperor", name: "🏯 皇帝", minPoints: 8500 },
  { id: "royal_master", name: "👑 ロイヤルマスター", minPoints: 8600 },

  // ── Layer 11: ⛩️ 和風・伝統層 ──
  { id: "ashigaru", name: "🏹 足軽", minPoints: 8700 },
  { id: "samurai", name: "⚔️ 侍", minPoints: 8800 },
  { id: "bugyo", name: "📜 奉行", minPoints: 8900 },
  { id: "daimyo", name: "🏯 大名", minPoints: 9000 },
  { id: "shogun", name: "⛩️ 将軍", minPoints: 9100 },
  { id: "shihan", name: "🥋 師範", minPoints: 9200 },
  { id: "menkyo_kaiden", name: "📜 免許皆伝", minPoints: 9300 },
  { id: "haoh", name: "👹 覇王", minPoints: 9400 },
  { id: "tengen", name: "☯️ 天元", minPoints: 9500 },
  { id: "japanese_master", name: "🗾 ジャパニーズマスター", minPoints: 9600 },

  // ── Layer 12: ❄️ 気象・自然現象層 ──
  { id: "mist", name: "🌫️ ミスト", minPoints: 9700 },
  { id: "breeze", name: "🍃 ブリーズ", minPoints: 9800 },
  { id: "gale", name: "💨 ゲイル", minPoints: 9900 },
  { id: "storm", name: "⛈️ ストーム", minPoints: 10000 },
  { id: "blizzard", name: "❄️ ブリザード", minPoints: 10100 },
  { id: "thunder", name: "⚡ サンダー", minPoints: 10200 },
  { id: "lightning", name: "🌩️ ライトニング", minPoints: 10300 },
  { id: "nova", name: "💥 ノヴァ", minPoints: 10400 },
  { id: "weather_master", name: "🌈 ウェザーマスター", minPoints: 10500 },

  // ── Layer 13: 🕯️ 光と闇・コントラスト層 ──
  { id: "shadow", name: "🌑 シャドウ", minPoints: 10600 },
  { id: "twilight", name: "🌅 トワイライト", minPoints: 10700 },
  { id: "luminous", name: "🌟 ルミナス", minPoints: 10800 },
  { id: "shine", name: "✨ シャイン", minPoints: 10900 },
  { id: "glow", name: "💡 グロウ", minPoints: 11000 },
  { id: "halo", name: "😇 ヘイロー", minPoints: 11100 },
  { id: "aurora", name: "🌌 オーロラ", minPoints: 11200 },
  { id: "lightness_master", name: "🌞 ライトネスマスター", minPoints: 11300 },

  // ── Layer 14: ⛓️ ダーク・罪層 ──
  { id: "sinner", name: "⛓️ シンナー", minPoints: 11400 },
  { id: "prisoner", name: "🔒 プリズナー", minPoints: 11500 },
  { id: "assassin", name: "🗡️ アサシン", minPoints: 11600 },
  { id: "punisher", name: "💀 パニッシャー", minPoints: 11700 },
  { id: "devil", name: "😈 デビル", minPoints: 11800 },
  { id: "satan", name: "👿 サタン", minPoints: 11900 },
  { id: "lucifer", name: "🔥 ルシファー", minPoints: 12000 },
  { id: "darkness_master", name: "🖤 ダークネスマスター", minPoints: 12100 },

  // ── Layer 15: 🃏 運命・カード層 ── ※ ここから加速 ──
  { id: "fool", name: "🃏 フール", minPoints: 12200 },
  { id: "jack", name: "♠️ ジャック", minPoints: 12400 },
  { id: "queen", name: "♥️ クイーン", minPoints: 12684 },
  { id: "king_card", name: "♦️ キング", minPoints: 13051 },
  { id: "ace", name: "♣️ エース", minPoints: 13501 },
  { id: "joker", name: "🎭 ジョーカー", minPoints: 14035 },
  { id: "world", name: "🌍 ワールド", minPoints: 14653 },
  { id: "card_master", name: "🃏 カードマスター", minPoints: 15354 },

  // ── Layer 16: 🎨 色彩・アート層 ──
  { id: "monochrome", name: "⬛ モノクローム", minPoints: 16138 },
  { id: "sepia", name: "🟫 セピア", minPoints: 17006 },
  { id: "primary", name: "🔴 プライマリー", minPoints: 17958 },
  { id: "neon", name: "💜 ネオン", minPoints: 18993 },
  { id: "prism", name: "🌈 プリズム", minPoints: 20112 },
  { id: "ultimate_white", name: "⬜ アルティメットホワイト", minPoints: 21314 },
  { id: "art_master", name: "🎨 アートマスター", minPoints: 22599 },

  // ── Layer 17: ✨ レアリティ・システム層 ──
  { id: "common", name: "⚪ コモン", minPoints: 23968 },
  { id: "uncommon", name: "🟢 アンコモン", minPoints: 25421 },
  { id: "rare", name: "🔵 レア", minPoints: 26957 },
  { id: "epic", name: "🟣 エピック", minPoints: 28577 },
  { id: "legendary", name: "🟠 レジェンダリー", minPoints: 30280 },
  { id: "mythic", name: "🔴 ミシック", minPoints: 32067 },
  { id: "artifact", name: "🟡 アーティファクト", minPoints: 33937 },
  { id: "ultimate", name: "⭐ アルティメット", minPoints: 35891 },
  { id: "system_master", name: "💠 システムマスター", minPoints: 37928 },

  // ── Layer 18: 🪐 天体・宇宙層 ──
  { id: "dust", name: "🌑 ダスト", minPoints: 40049 },
  { id: "meteor", name: "☄️ メテオ", minPoints: 42253 },
  { id: "satellite", name: "🛰️ サテライト", minPoints: 44541 },
  { id: "planet", name: "🪐 プラネット", minPoints: 46912 },
  { id: "star", name: "⭐ スター", minPoints: 49367 },
  { id: "galaxy", name: "🌌 ギャラクシー", minPoints: 51905 },
  { id: "quasar", name: "💫 クエーサー", minPoints: 54527 },
  { id: "black_hole", name: "🕳️ ブラックホール", minPoints: 57232 },
  { id: "universe", name: "🌍 ユニバース", minPoints: 60021 },
  { id: "cosmo_master", name: "🪐 コスモマスター", minPoints: 62893 },

  // ── Layer 19: 🔱 神話・神域層 ──
  { id: "hero", name: "🦸 ヒーロー", minPoints: 65849 },
  { id: "apostle", name: "🙏 アポストル", minPoints: 68888 },
  { id: "guardian", name: "🛡️ ガーディアン", minPoints: 72011 },
  { id: "demigod", name: "⚡ デミゴッド", minPoints: 75217 },
  { id: "titan", name: "🗿 タイタン", minPoints: 78507 },
  { id: "seraphim", name: "👼 セラフィム", minPoints: 81881 },
  { id: "god", name: "🔱 ゴッド", minPoints: 85337 },
  { id: "zeus_odin", name: "⚡ ゼウス／オーディン", minPoints: 88878 },
  { id: "chaos", name: "🌀 カオス", minPoints: 92502 },
  { id: "eternal_master", name: "♾️ エターナルマスター", minPoints: 96209 },

  // ── Layer 20: 🏫 受験層 ──
  { id: "kawaguchi_master", name: "🏫 川口市立附属中学校マスター", minPoints: 100000 },
] as const;

export type RankDef = (typeof RANKS)[number];

export function rankForPoints(totalPoints: number): RankDef {
  let current: RankDef = RANKS[0];
  for (const r of RANKS) {
    if (totalPoints >= r.minPoints) current = r;
  }
  return current;
}
