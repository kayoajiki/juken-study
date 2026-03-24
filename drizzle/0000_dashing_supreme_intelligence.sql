CREATE TABLE `break_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`min_block_minutes` integer NOT NULL,
	`max_block_minutes` integer NOT NULL,
	`break_minutes` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `break_rules_user_id_idx` ON `break_rules` (`user_id`);--> statement-breakpoint
CREATE TABLE `monthly_test_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`year_month` text NOT NULL,
	`title` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_test_reports_user_ym` ON `monthly_test_reports` (`user_id`,`year_month`);--> statement-breakpoint
CREATE INDEX `monthly_test_reports_user_idx` ON `monthly_test_reports` (`user_id`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`time_of_day` text NOT NULL,
	`target_minutes` integer DEFAULT 30 NOT NULL,
	`repeat_type` text NOT NULL,
	`weekday` integer,
	`target_date` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_user_id_idx` ON `schedules` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`kind` text NOT NULL,
	`minutes` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_sessions_user_id_idx` ON `study_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `study_sessions_user_started_idx` ON `study_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `test_result_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`parent_id` text,
	`label` text NOT NULL,
	`subject_key` text,
	`score` real,
	`deviation` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `monthly_test_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `test_result_nodes_report_idx` ON `test_result_nodes` (`report_id`);--> statement-breakpoint
CREATE INDEX `test_result_nodes_parent_idx` ON `test_result_nodes` (`parent_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`total_study_minutes` integer DEFAULT 0 NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`last_study_local_date` text,
	`notification_enabled` integer DEFAULT false NOT NULL,
	`daily_bonus_local_date` text,
	`daily_bonus_triple_used` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);