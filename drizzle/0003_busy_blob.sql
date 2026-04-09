CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` enum('create','read','update','delete') NOT NULL,
	`actor_user_id` int,
	`actor_affiliation_id` int,
	`target_resource` varchar(100) NOT NULL,
	`target_resource_id` varchar(100),
	`details` json,
	`ip_address` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int,
	`campus_id` int,
	`code` varchar(50) NOT NULL,
	`name_th` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`org_level` enum('university','campus','faculty','department') NOT NULL DEFAULT 'faculty',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role_in_project` enum('lead','member','viewer') NOT NULL DEFAULT 'member',
	`can_edit` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_project_user` UNIQUE(`project_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_name` varchar(500) NOT NULL,
	`org_id` int NOT NULL,
	`fiscal_year` int NOT NULL,
	`status` enum('draft','pending','approved','rejected','in_progress','completed') NOT NULL DEFAULT 'draft',
	`created_by` int,
	`lead_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategic_department_tactics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategic_department_id` int NOT NULL,
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
	CONSTRAINT `strategic_department_tactics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategic_departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(1000) NOT NULL,
	`department_id` int,
	`description` text,
	`year` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`deleted_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `strategic_departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategic_tactics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`strategy_id` int NOT NULL,
	`name` varchar(1000) NOT NULL,
	`description` text,
	`order_sequence` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`deleted_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `strategic_tactics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(1000) NOT NULL,
	`campus` varchar(100),
	`order_list` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`deleted_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_affiliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`org_id` int NOT NULL,
	`sub_dep_id` int,
	`role` enum('super_admin','univ_executive','univ_officer','campus_executive','campus_officer','faculty_executive','unit_head','org_admin','project_lead','staff') NOT NULL DEFAULT 'staff',
	`position_title` varchar(255),
	`is_primary` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`start_date` date,
	`end_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_affiliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_org_role` UNIQUE(`user_id`,`org_id`,`role`)
);
--> statement-breakpoint
DROP TABLE `department_users`;--> statement-breakpoint
DROP TABLE `departments`;--> statement-breakpoint
DROP INDEX `idx_users_role` ON `users`;--> statement-breakpoint
DROP INDEX `idx_users_department` ON `users`;--> statement-breakpoint
ALTER TABLE `users` ADD `name_th` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `name_en` varchar(255);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_affiliation_id_user_affiliations_id_fk` FOREIGN KEY (`actor_affiliation_id`) REFERENCES `user_affiliations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_lead_user_id_users_id_fk` FOREIGN KEY (`lead_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_department_tactics` ADD CONSTRAINT `strategic_department_tactics_strategic_department_id_strategic_departments_id_fk` FOREIGN KEY (`strategic_department_id`) REFERENCES `strategic_departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_department_tactics` ADD CONSTRAINT `strategic_department_tactics_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_department_tactics` ADD CONSTRAINT `strategic_department_tactics_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_department_tactics` ADD CONSTRAINT `strategic_department_tactics_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_departments` ADD CONSTRAINT `strategic_departments_department_id_organizations_id_fk` FOREIGN KEY (`department_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_departments` ADD CONSTRAINT `strategic_departments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_departments` ADD CONSTRAINT `strategic_departments_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_departments` ADD CONSTRAINT `strategic_departments_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_tactics` ADD CONSTRAINT `strategic_tactics_strategy_id_strategies_id_fk` FOREIGN KEY (`strategy_id`) REFERENCES `strategies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_tactics` ADD CONSTRAINT `strategic_tactics_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_tactics` ADD CONSTRAINT `strategic_tactics_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategic_tactics` ADD CONSTRAINT `strategic_tactics_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategies` ADD CONSTRAINT `strategies_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategies` ADD CONSTRAINT `strategies_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `strategies` ADD CONSTRAINT `strategies_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_affiliations` ADD CONSTRAINT `user_affiliations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_affiliations` ADD CONSTRAINT `user_affiliations_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_affiliations` ADD CONSTRAINT `user_affiliations_sub_dep_id_organizations_id_fk` FOREIGN KEY (`sub_dep_id`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_resource` ON `audit_logs` (`target_resource`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_organizations_parent_id` ON `organizations` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_organizations_campus_id` ON `organizations` (`campus_id`);--> statement-breakpoint
CREATE INDEX `idx_organizations_org_level` ON `organizations` (`org_level`);--> statement-breakpoint
CREATE INDEX `idx_project_members_user_id` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_org_id` ON `projects` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_fiscal_year` ON `projects` (`fiscal_year`);--> statement-breakpoint
CREATE INDEX `idx_projects_lead_user_id` ON `projects` (`lead_user_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dept_tactics_dept_id` ON `strategic_department_tactics` (`strategic_department_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_dept_tactics_is_active` ON `strategic_department_tactics` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_strategic_departments_department_id` ON `strategic_departments` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_departments_year` ON `strategic_departments` (`year`);--> statement-breakpoint
CREATE INDEX `idx_strategic_departments_is_active` ON `strategic_departments` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_strategic_tactics_strategy_id` ON `strategic_tactics` (`strategy_id`);--> statement-breakpoint
CREATE INDEX `idx_strategic_tactics_is_active` ON `strategic_tactics` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_strategies_campus` ON `strategies` (`campus`);--> statement-breakpoint
CREATE INDEX `idx_strategies_order_list` ON `strategies` (`order_list`);--> statement-breakpoint
CREATE INDEX `idx_strategies_is_active` ON `strategies` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_affiliations_org_id` ON `user_affiliations` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_affiliations_role` ON `user_affiliations` (`role`);--> statement-breakpoint
CREATE INDEX `idx_affiliations_is_active` ON `user_affiliations` (`is_active`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `department`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `position`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `management_position`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `is_management`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;