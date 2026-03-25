CREATE TABLE `weekly_quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`quiz_date` text NOT NULL,
	`japanese_score` real,
	`math_score` real,
	`science_score` real,
	`social_score` real,
	`max_score` real,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `weekly_quizzes_user_id_idx` ON `weekly_quizzes` (`user_id`);--> statement-breakpoint
CREATE INDEX `weekly_quizzes_user_date_idx` ON `weekly_quizzes` (`user_id`, `quiz_date`);
