CREATE TABLE `budget_supports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`department_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_supports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `budget_subsidy_types`;--> statement-breakpoint
RENAME TABLE `budget_expense_details` TO `budget_types`;--> statement-breakpoint
RENAME TABLE `budget_subsidies` TO `expense_details`;--> statement-breakpoint
ALTER TABLE `budget_types` RENAME COLUMN `budget_group_id` TO `name`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP INDEX `budget_expense_details_code_unique`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP INDEX `budget_groups_code_unique`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP INDEX `budget_subsidies_code_unique`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP FOREIGN KEY `budget_expense_details_budget_group_id_budget_groups_id_fk`;
--> statement-breakpoint
ALTER TABLE `budget_types` DROP FOREIGN KEY `budget_expense_details_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `budget_types` DROP FOREIGN KEY `budget_expense_details_updated_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `budget_groups` DROP FOREIGN KEY `budget_groups_subsidy_type_id_budget_subsidy_types_id_fk`;
--> statement-breakpoint
ALTER TABLE `budget_groups` DROP FOREIGN KEY `budget_groups_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `budget_groups` DROP FOREIGN KEY `budget_groups_updated_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `expense_details` DROP FOREIGN KEY `budget_subsidies_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `expense_details` DROP FOREIGN KEY `budget_subsidies_updated_by_users_id_fk`;
--> statement-breakpoint
DROP INDEX `idx_budget_expense_details_group_id` ON `budget_types`;--> statement-breakpoint
DROP INDEX `idx_budget_groups_subsidy_type_id` ON `budget_groups`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `expense_details` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `budget_types` MODIFY COLUMN `name` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_types` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `expense_details` ADD PRIMARY KEY(`id`);--> statement-breakpoint
ALTER TABLE `budget_types` ADD `budget_category` varchar(100);--> statement-breakpoint
ALTER TABLE `budget_types` ADD `budget_category_display` varchar(255);--> statement-breakpoint
ALTER TABLE `budget_types` ADD `budget_support_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_types` ADD `department_id` int;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD `name` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD `group_type` varchar(100);--> statement-breakpoint
ALTER TABLE `budget_groups` ADD `group_type_display` varchar(500);--> statement-breakpoint
ALTER TABLE `budget_groups` ADD `budget_type_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD `department_id` int;--> statement-breakpoint
ALTER TABLE `expense_details` ADD `name` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `expense_details` ADD `detail_type` enum('main','sub') DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE `expense_details` ADD `detail_type_display` varchar(100);--> statement-breakpoint
ALTER TABLE `expense_details` ADD `parent_id` int;--> statement-breakpoint
ALTER TABLE `expense_details` ADD `budget_group_id` int;--> statement-breakpoint
ALTER TABLE `expense_details` ADD `department_id` int;--> statement-breakpoint
CREATE INDEX `idx_budget_supports_department_id` ON `budget_supports` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_supports_is_active` ON `budget_supports` (`is_active`);--> statement-breakpoint
ALTER TABLE `budget_types` ADD CONSTRAINT `budget_types_budget_support_id_budget_supports_id_fk` FOREIGN KEY (`budget_support_id`) REFERENCES `budget_supports`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_groups` ADD CONSTRAINT `budget_groups_budget_type_id_budget_types_id_fk` FOREIGN KEY (`budget_type_id`) REFERENCES `budget_types`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_budget_types_budget_support_id` ON `budget_types` (`budget_support_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_types_department_id` ON `budget_types` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_types_is_active` ON `budget_types` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_budget_groups_budget_type_id` ON `budget_groups` (`budget_type_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_groups_department_id` ON `budget_groups` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_groups_is_active` ON `budget_groups` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_expense_details_parent_id` ON `expense_details` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_details_budget_group_id` ON `expense_details` (`budget_group_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_details_department_id` ON `expense_details` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_details_detail_type` ON `expense_details` (`detail_type`);--> statement-breakpoint
CREATE INDEX `idx_expense_details_is_active` ON `expense_details` (`is_active`);--> statement-breakpoint
ALTER TABLE `budget_types` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP COLUMN `name_th`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP COLUMN `name_en`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP COLUMN `created_by`;--> statement-breakpoint
ALTER TABLE `budget_types` DROP COLUMN `updated_by`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `subsidy_type_id`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `name_th`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `name_en`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `created_by`;--> statement-breakpoint
ALTER TABLE `budget_groups` DROP COLUMN `updated_by`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP COLUMN `code`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP COLUMN `name_th`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP COLUMN `name_en`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP COLUMN `created_by`;--> statement-breakpoint
ALTER TABLE `expense_details` DROP COLUMN `updated_by`;