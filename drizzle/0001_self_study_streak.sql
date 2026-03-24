ALTER TABLE `users` ADD `self_study_streak` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `last_self_study_local_date` text;
