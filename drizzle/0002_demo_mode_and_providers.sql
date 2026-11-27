ALTER TABLE `articles` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `articles_is_demo_idx` ON `articles` (`is_demo`);--> statement-breakpoint
ALTER TABLE `briefings` ADD `provider` text DEFAULT 'gemini' NOT NULL;--> statement-breakpoint
ALTER TABLE `briefings` ADD `is_demo` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `briefings_is_demo_idx` ON `briefings` (`is_demo`);