-- Migration: Add dean-level strategy tables
-- Date: 2026-03-19
-- Description: Create strategic_dean_strategies and strategic_dean_tactics tables
--              for dean-level strategies, mirroring strategic_departments pattern

CREATE TABLE `strategic_dean_strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(1000) NOT NULL,
	`department_id` int,
	`description` text,
	`year` int,
	`fiscal_plan` varchar(20),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`deleted_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `strategic_dean_strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategic_dean_tactics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategic_dean_strategy_id` int NOT NULL,
	`name` varchar(1000) NOT NULL,
	`description` text,
	`order` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`deleted_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `strategic_dean_tactics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_department_id_organizations_id_fk` FOREIGN KEY (`department_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_strategic_dean_strategy_id_fk` FOREIGN KEY (`strategic_dean_strategy_id`) REFERENCES `strategic_dean_strategies`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_dept_id` ON `strategic_dean_strategies` (`department_id`);
--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_year` ON `strategic_dean_strategies` (`year`);
--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_is_active` ON `strategic_dean_strategies` (`is_active`);
--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_tactics_strategy_id` ON `strategic_dean_tactics` (`strategic_dean_strategy_id`);
--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_tactics_is_active` ON `strategic_dean_tactics` (`is_active`);
