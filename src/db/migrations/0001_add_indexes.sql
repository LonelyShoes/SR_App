CREATE INDEX `meetings_start_at_idx` ON `meetings` (`start_at`);--> statement-breakpoint
CREATE INDEX `meetings_dirty_idx` ON `meetings` (`dirty`);--> statement-breakpoint
CREATE INDEX `minutes_meeting_id_idx` ON `minutes` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `minutes_dirty_idx` ON `minutes` (`dirty`);--> statement-breakpoint
CREATE INDEX `tasks_status_quadrant_idx` ON `tasks` (`status`,`quadrant`);--> statement-breakpoint
CREATE INDEX `tasks_due_at_idx` ON `tasks` (`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_completed_at_idx` ON `tasks` (`completed_at`);--> statement-breakpoint
CREATE INDEX `tasks_dirty_idx` ON `tasks` (`dirty`);--> statement-breakpoint
CREATE INDEX `timer_sessions_started_at_idx` ON `timer_sessions` (`started_at`);--> statement-breakpoint
CREATE INDEX `timer_sessions_dirty_idx` ON `timer_sessions` (`dirty`);