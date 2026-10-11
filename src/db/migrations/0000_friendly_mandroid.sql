CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`location` text,
	`participants` text,
	`agenda` text,
	`status` text DEFAULT 'rencana' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`reminder_offset_min` integer,
	`reminder_notification_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `minutes` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	`discussion` text,
	`decisions` text,
	`attendees` text,
	`action_items` text,
	`attachments` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`quadrant` text NOT NULL,
	`due_at` integer,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`meeting_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timer_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`planned_sec` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`actual_sec` integer NOT NULL,
	`preset_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`dirty` integer DEFAULT 1 NOT NULL
);
