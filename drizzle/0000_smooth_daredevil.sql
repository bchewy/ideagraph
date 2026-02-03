CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`filename` text NOT NULL,
	`openai_file_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
