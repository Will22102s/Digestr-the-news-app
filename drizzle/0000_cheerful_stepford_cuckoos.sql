CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`published_at` integer DEFAULT (unixepoch()) NOT NULL,
	`is_bookmarked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_url_unique` ON `articles` (`url`);--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `articles_category_id_idx` ON `articles` (`category_id`);--> statement-breakpoint
CREATE INDEX `articles_feed_id_idx` ON `articles` (`feed_id`);--> statement-breakpoint
CREATE INDEX `articles_is_bookmarked_idx` ON `articles` (`is_bookmarked`);--> statement-breakpoint
CREATE TABLE `briefings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_slug` text NOT NULL,
	`title` text NOT NULL,
	`content_markdown` text NOT NULL,
	`read_time_minutes` integer DEFAULT 0 NOT NULL,
	`article_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `briefings_category_created_idx` ON `briefings` (`category_slug`,`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text DEFAULT '#0A84FF' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`source_type` text DEFAULT 'rss' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_fetched_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_url_unique` ON `feeds` (`url`);--> statement-breakpoint
CREATE INDEX `feeds_category_id_idx` ON `feeds` (`category_id`);--> statement-breakpoint
CREATE INDEX `feeds_is_active_idx` ON `feeds` (`is_active`);