CREATE TABLE `department_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`department_id` int NOT NULL,
	`sub_department_id` int,
	`role` enum('super_admin','admin','manager','project_manager','staff','member') NOT NULL DEFAULT 'member',
	`roles` json,
	`position` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `department_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_user_department` UNIQUE(`user_id`,`department_id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parent_id` int,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`name_en` varchar(255),
	`type` enum('main','sub') NOT NULL DEFAULT 'main',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255),
	`name` varchar(255) NOT NULL,
	`phone` varchar(50),
	`avatar` varchar(500),
	`department` varchar(255),
	`position` varchar(255),
	`management_position` varchar(255),
	`is_management` boolean NOT NULL DEFAULT false,
	`role` enum('super_admin','admin','manager','project_manager','staff','member') NOT NULL DEFAULT 'member',
	`ku_uid` varchar(100),
	`ku_faculty_id` varchar(50),
	`ku_position` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`email_verified_at` timestamp,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_ku_uid_unique` UNIQUE(`ku_uid`)
);
--> statement-breakpoint
ALTER TABLE `department_users` ADD CONSTRAINT `department_users_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_users` ADD CONSTRAINT `department_users_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `department_users` ADD CONSTRAINT `department_users_sub_department_id_departments_id_fk` FOREIGN KEY (`sub_department_id`) REFERENCES `departments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_dept_users_department_id` ON `department_users` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_dept_users_role` ON `department_users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_dept_users_is_active` ON `department_users` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_departments_parent_id` ON `departments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_departments_type` ON `departments` (`type`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_ku_uid` ON `users` (`ku_uid`);--> statement-breakpoint
CREATE INDEX `idx_users_department` ON `users` (`department`);