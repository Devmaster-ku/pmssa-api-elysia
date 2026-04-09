CREATE TABLE `budget_expense_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budget_group_id` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_expense_details_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_expense_details_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `budget_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subsidy_type_id` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_groups_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `budget_subsidies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_subsidies_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_subsidies_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `budget_subsidy_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subsidy_id` int NOT NULL,
	`code` varchar(50) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_subsidy_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_subsidy_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
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
ALTER TABLE `strategic_departments` ADD `fiscal_plan` varchar(20);--> statement-breakpoint
ALTER TABLE `strategies` ADD `fiscal_plan` varchar(20);--> statement-breakpoint
ALTER TABLE `budget_expense_details` ADD CONSTRAINT `budget_expense_details_budget_group_id_budget_groups_id_fk` FOREIGN KEY (`budget_group_id`) REFERENCES `budget_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_expense_details` ADD CONSTRAINT `budget_expense_details_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_expense_details` ADD CONSTRAINT `budget_expense_details_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD CONSTRAINT `budget_groups_subsidy_type_id_budget_subsidy_types_id_fk` FOREIGN KEY (`subsidy_type_id`) REFERENCES `budget_subsidy_types`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD CONSTRAINT `budget_groups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD CONSTRAINT `budget_groups_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidies` ADD CONSTRAINT `budget_subsidies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidies` ADD CONSTRAINT `budget_subsidies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidy_types` ADD CONSTRAINT `budget_subsidy_types_subsidy_id_budget_subsidies_id_fk` FOREIGN KEY (`subsidy_id`) REFERENCES `budget_subsidies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidy_types` ADD CONSTRAINT `budget_subsidy_types_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidy_types` ADD CONSTRAINT `budget_subsidy_types_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_department_id_organizations_id_fk` FOREIGN KEY (`department_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_strategies` ADD CONSTRAINT `strategic_dean_strategies_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_strategic_dean_strategy_id_strategic_dean_strategies_id_fk` FOREIGN KEY (`strategic_dean_strategy_id`) REFERENCES `strategic_dean_strategies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_dean_tactics` ADD CONSTRAINT `strategic_dean_tactics_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_budget_expense_details_group_id` ON `budget_expense_details` (`budget_group_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_groups_subsidy_type_id` ON `budget_groups` (`subsidy_type_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_subsidy_types_subsidy_id` ON `budget_subsidy_types` (`subsidy_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_dept_id` ON `strategic_dean_strategies` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_year` ON `strategic_dean_strategies` (`year`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_strategies_is_active` ON `strategic_dean_strategies` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_tactics_strategy_id` ON `strategic_dean_tactics` (`strategic_dean_strategy_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dean_tactics_is_active` ON `strategic_dean_tactics` (`is_active`);