CREATE TABLE `budget_expense_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`budget_group_id` int NOT NULL,
	`code` varchar(100) NOT NULL,
	`name_th` varchar(500) NOT NULL,
	`name_en` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_expense_details_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_subsidies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`name_th` varchar(500) NOT NULL,
	`name_en` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_subsidies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_subsidy_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subsidy_id` int NOT NULL,
	`code` varchar(100) NOT NULL,
	`name_th` varchar(500) NOT NULL,
	`name_en` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budget_subsidy_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('super_admin','univ_executive','univ_officer','campus_executive','campus_officer','faculty_executive','unit_head','org_admin','project_lead','staff') NOT NULL,
	`permission_code` varchar(100) NOT NULL,
	`granted` boolean NOT NULL DEFAULT false,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_role_permission_code` UNIQUE(`role`,`permission_code`)
);
--> statement-breakpoint
ALTER TABLE `budget_expense_details` ADD CONSTRAINT `budget_expense_details_budget_group_id_budget_groups_id_fk` FOREIGN KEY (`budget_group_id`) REFERENCES `budget_groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_subsidy_types` ADD CONSTRAINT `budget_subsidy_types_subsidy_id_budget_subsidies_id_fk` FOREIGN KEY (`subsidy_id`) REFERENCES `budget_subsidies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_budget_expense_details_group_id` ON `budget_expense_details` (`budget_group_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_expense_details_is_active` ON `budget_expense_details` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_budget_subsidies_is_active` ON `budget_subsidies` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_budget_subsidy_types_subsidy_id` ON `budget_subsidy_types` (`subsidy_id`);--> statement-breakpoint
CREATE INDEX `idx_budget_subsidy_types_is_active` ON `budget_subsidy_types` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_role_permissions_role` ON `role_permissions` (`role`);--> statement-breakpoint
CREATE INDEX `idx_role_permissions_code` ON `role_permissions` (`permission_code`);--> statement-breakpoint
INSERT INTO `campus` (`name_th`, `name_en`, `is_active`) VALUES
  ('บางเขน', 'Bang Khen', true),
  ('วิทยาเขตกำแพงแสน', 'Kamphaeng Saen Campus', true),
  ('วิทยาเขตเฉลิมพระเกียรติ จังหวัดสกลนคร', 'Chalermphrakiat Sakon Nakhon Province Campus', true),
  ('วิทยาเขตศรีราชา', 'Sriracha Campus', true),
  ('สำนักงานเขตบริหารการเรียนรู้พื้นที่สุพรรณบุรี', 'Suphanburi Educational Administration Zone', true),
  ('สถาบันสมทบ', 'Affiliated Institute', true);