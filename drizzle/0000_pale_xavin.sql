CREATE TABLE `farm_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`x` real NOT NULL,
	`z` real NOT NULL,
	`angle` real NOT NULL,
	`action` text NOT NULL,
	`basket` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `farm_presence_updated_at_idx` ON `farm_presence` (`updated_at`);