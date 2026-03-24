export type EarnedBadge = {
  id: string;
  type: string;
  label: string;
  emoji: string;
  earnedAt: string; // ISO
};

export const BADGE_CATALOG: Record<string, Omit<EarnedBadge, "earnedAt">> = {
  first_record:      { id: "first_record",      type: "first_record",      label: "はじめの一歩",       emoji: "👣" },
  minutes_100:       { id: "minutes_100",        type: "minutes_100",       label: "累計100分達成",      emoji: "📖" },
  minutes_1000:      { id: "minutes_1000",       type: "minutes_1000",      label: "累計1000分達成",     emoji: "💪" },
  minutes_10000:     { id: "minutes_10000",      type: "minutes_10000",     label: "累計10000分達成",    emoji: "🏅" },
  subject_math:      { id: "subject_math",       type: "subject_math",      label: "算数マスター",       emoji: "🧮" },
  subject_japanese:  { id: "subject_japanese",   type: "subject_japanese",  label: "国語博士",           emoji: "📝" },
  subject_science:   { id: "subject_science",    type: "subject_science",   label: "理科の達人",         emoji: "🔬" },
  subject_social:    { id: "subject_social",     type: "subject_social",    label: "社会の達人",         emoji: "🌍" },
  subject_aptitude:  { id: "subject_aptitude",   type: "subject_aptitude",  label: "適性の達人",         emoji: "🎯" },
  all_subjects:      { id: "all_subjects",       type: "all_subjects",      label: "全教科制覇",         emoji: "🌈" },
  first_goal:        { id: "first_goal",         type: "first_goal",        label: "はじめての目標達成",  emoji: "⭐" },
  season_best:       { id: "season_best",        type: "season_best",       label: "シーズン自己ベスト",  emoji: "🏆" },
  rank_silver:       { id: "rank_silver",        type: "rank_silver",       label: "シルバー到達",       emoji: "🥈" },
  rank_gold:         { id: "rank_gold",          type: "rank_gold",         label: "ゴールド到達",       emoji: "🥇" },
  rank_master:       { id: "rank_master",        type: "rank_master",       label: "マスター到達",       emoji: "💎" },
  early_bird:        { id: "early_bird",         type: "early_bird",        label: "早起き勉強家",       emoji: "🌅" },
  triple_subject:    { id: "triple_subject",     type: "triple_subject",    label: "1日3教科制覇",      emoji: "🎪" },
};

export function badgePerfectMonths(count: number): Omit<EarnedBadge, "earnedAt"> {
  const emoji = count >= 12 ? "🏆" : count >= 6 ? "👑" : count >= 3 ? "💎" : count >= 2 ? "🥇" : "🏅";
  return { id: `perfect_months_${count}`, type: "perfect_months", label: `${count}ヶ月連続皆勤賞`, emoji };
}

export function parseBadges(json: string): EarnedBadge[] {
  try { return JSON.parse(json) as EarnedBadge[]; } catch { return []; }
}
