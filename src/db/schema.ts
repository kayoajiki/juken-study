import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  lastStudyLocalDate: text("last_study_local_date"),
  notificationEnabled: integer("notification_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(0),
  monthlyPoints: integer("monthly_points").notNull().default(0),
  monthlySeason: text("monthly_season"),
  bestMonthlyPoints: integer("best_monthly_points").notNull().default(0),
  bestMonthlySeason: text("best_monthly_season"),
  consecutivePerfectMonths: integer("consecutive_perfect_months").notNull().default(0),
  earnedBadges: text("earned_badges").notNull().default("[]"),
  dailyBonusLocalDate: text("daily_bonus_local_date"),
  dailyBonusTripleUsed: integer("daily_bonus_triple_used").notNull().default(0),
  selfStudyStreak: integer("self_study_streak").notNull().default(0),
  lastSelfStudyLocalDate: text("last_self_study_local_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const studySessions = sqliteTable(
  "study_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    kind: text("kind").notNull(),
    minutes: integer("minutes").notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("study_sessions_user_id_idx").on(t.userId),
    index("study_sessions_user_started_idx").on(t.userId, t.startedAt),
  ]
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    timeOfDay: text("time_of_day").notNull(),
    targetMinutes: integer("target_minutes").notNull().default(30),
    repeatType: text("repeat_type").notNull(),
    weekday: integer("weekday"),
    targetDate: text("target_date"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (t) => [index("schedules_user_id_idx").on(t.userId)]
);

export const breakRules = sqliteTable(
  "break_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    minBlockMinutes: integer("min_block_minutes").notNull(),
    maxBlockMinutes: integer("max_block_minutes").notNull(),
    breakMinutes: integer("break_minutes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("break_rules_user_id_idx").on(t.userId)]
);

// 日次目標時間の履歴（適用開始日単位）
export const dailyGoalHistory = sqliteTable(
  "daily_goal_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // この日から適用される目標（Asia/Tokyo, YYYY-MM-DD）
    effectiveDate: text("effective_date").notNull(),
    minutes: integer("minutes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("daily_goal_history_user_effective_unique").on(t.userId, t.effectiveDate),
    index("daily_goal_history_user_effective_idx").on(t.userId, t.effectiveDate),
  ]
);

// 家庭内で共有する「ホーム画面トピックス」スタンプ
export const homeTopicStamps = sqliteTable(
  "home_topic_stamps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(), // YYYY-MM-DD (Asia/Tokyo)
    topicId: text("topic_id").notNull(),

    likes: integer("likes", { mode: "boolean" }).notNull().default(false),
    sparks: integer("sparks", { mode: "boolean" }).notNull().default(false), // 応援
    cheers: integer("cheers", { mode: "boolean" }).notNull().default(false), // がんばれ
    focuses: integer("focuses", { mode: "boolean" }).notNull().default(false), // 集中
    stars: integer("stars", { mode: "boolean" }).notNull().default(false), // ナイス

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("home_topic_stamps_user_day_topic_unique").on(t.userId, t.dateKey, t.topicId),
    index("home_topic_stamps_date_topic_idx").on(t.dateKey, t.topicId),
  ]
);

// 家庭内で共有する「ホーム画面トピックス」コメント（最大3件/トピック）
export const homeTopicComments = sqliteTable(
  "home_topic_comments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(), // YYYY-MM-DD (Asia/Tokyo)
    topicId: text("topic_id").notNull(),
    comment: text("comment").notNull(),

    createdAtMs: integer("created_at_ms").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("home_topic_comments_date_topic_idx").on(t.dateKey, t.topicId),
    index("home_topic_comments_user_idx").on(t.userId),
  ]
);

export const scheduleMemos = sqliteTable(
  "schedule_memos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 適用開始日（この日から繰り返し／この日だけならその日） YYYY-MM-DD Tokyo */
    date: text("date").notNull(),
    text: text("text").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    /** once | daily | weekdays | weekly（繰り返しは日ごとの完了は schedule_memo_day_done） */
    repeatType: text("repeat_type").notNull().default("once"),
    /** weekly のとき 0=日…6=土（東京）。それ以外は null */
    weekday: integer("weekday"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("schedule_memos_user_date_idx").on(t.userId, t.date)]
);

/** 繰り返しメモの「その日」だけの完了状態 */
export const scheduleMemoDayDone = sqliteTable(
  "schedule_memo_day_done",
  {
    memoId: text("memo_id")
      .notNull()
      .references(() => scheduleMemos.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(),
    done: integer("done", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.memoId, t.dateKey] })]
);

export const monthlyTestReports = sqliteTable(
  "monthly_test_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    title: text("title"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("monthly_test_reports_user_ym").on(t.userId, t.yearMonth),
    index("monthly_test_reports_user_idx").on(t.userId),
  ]
);

export const weeklyQuizzes = sqliteTable(
  "weekly_quizzes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quizDate: text("quiz_date").notNull(),
    japaneseScore: real("japanese_score"),
    mathScore: real("math_score"),
    scienceScore: real("science_score"),
    socialScore: real("social_score"),
    maxScore: real("max_score"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("weekly_quizzes_user_id_idx").on(t.userId),
    index("weekly_quizzes_user_date_idx").on(t.userId, t.quizDate),
  ]
);

export const testResultNodes = sqliteTable(
  "test_result_nodes",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => monthlyTestReports.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    label: text("label").notNull(),
    subjectKey: text("subject_key"),
    score: real("score"),
    deviation: real("deviation"),
    scale10: integer("scale10"),
    rankNational: text("rank_national"),
    rankGender: text("rank_gender"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("test_result_nodes_report_idx").on(t.reportId),
    index("test_result_nodes_parent_idx").on(t.parentId),
  ]
);
