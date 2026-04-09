-- Migration: Restructure User Model (level-user.txt v2.0)
-- เปลี่ยนจาก 5 roles → 10 roles, departments → organizations, department_users → user_affiliations
-- เพิ่ม projects, project_members, audit_logs

-- =============================================
-- 1. สร้างตาราง organizations (แทน departments)
-- =============================================
CREATE TABLE IF NOT EXISTS `organizations` (
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
DROP INDEX IF EXISTS `idx_organizations_parent_id` ON `organizations`;
--> statement-breakpoint
CREATE INDEX `idx_organizations_parent_id` ON `organizations` (`parent_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_organizations_campus_id` ON `organizations`;
--> statement-breakpoint
CREATE INDEX `idx_organizations_campus_id` ON `organizations` (`campus_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_organizations_org_level` ON `organizations`;
--> statement-breakpoint
CREATE INDEX `idx_organizations_org_level` ON `organizations` (`org_level`);
--> statement-breakpoint

-- =============================================
-- 2. Migrate ข้อมูลจาก departments → organizations
-- =============================================
INSERT INTO `organizations` (`id`, `code`, `name_th`, `org_level`, `parent_id`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`)
SELECT `id`, `code`, `name`, CASE WHEN `type` = 'main' THEN 'faculty' ELSE 'department' END, `parent_id`, `is_active`, `created_by`, `updated_by`, `created_at`, `updated_at`
FROM `departments`
WHERE NOT EXISTS (SELECT 1 FROM `organizations` WHERE `organizations`.`id` = `departments`.`id`);
--> statement-breakpoint

-- =============================================
-- 3. ปรับตาราง users
-- =============================================
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `name_th` varchar(255) NOT NULL DEFAULT '' AFTER `password`;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `name_en` varchar(255) AFTER `name_th`;
--> statement-breakpoint
UPDATE `users` SET `name_th` = `name` WHERE `name_th` = '' AND `name` IS NOT NULL AND `name` != '';
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `name`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `department`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `position`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `management_position`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `is_management`;
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN IF EXISTS `role`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_users_role` ON `users`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_users_department` ON `users`;
--> statement-breakpoint

-- =============================================
-- 4. สร้างตาราง user_affiliations (แทน department_users)
-- =============================================
CREATE TABLE IF NOT EXISTS `user_affiliations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `org_id` int NOT NULL,
  `role` enum('super_admin','univ_executive','univ_officer','campus_executive','campus_officer','faculty_executive','unit_head','org_admin','project_lead','staff') NOT NULL DEFAULT 'staff',
  `position_title` varchar(255),
  `is_primary` boolean NOT NULL DEFAULT false,
  `is_active` boolean NOT NULL DEFAULT true,
  `start_date` date,
  `end_date` date,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_affiliations_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_affiliations_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_affiliations_org` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
DROP INDEX IF EXISTS `uq_user_org_role` ON `user_affiliations`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_org_role` ON `user_affiliations` (`user_id`, `org_id`, `role`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_affiliations_org_id` ON `user_affiliations`;
--> statement-breakpoint
CREATE INDEX `idx_affiliations_org_id` ON `user_affiliations` (`org_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_affiliations_role` ON `user_affiliations`;
--> statement-breakpoint
CREATE INDEX `idx_affiliations_role` ON `user_affiliations` (`role`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_affiliations_is_active` ON `user_affiliations`;
--> statement-breakpoint
CREATE INDEX `idx_affiliations_is_active` ON `user_affiliations` (`is_active`);
--> statement-breakpoint

-- =============================================
-- 5. Migrate ข้อมูลจาก department_users → user_affiliations
-- =============================================
INSERT INTO `user_affiliations` (`id`, `user_id`, `org_id`, `role`, `position_title`, `is_primary`, `is_active`, `created_at`, `updated_at`)
SELECT
  `id`,
  `user_id`,
  `department_id`,
  CASE
    WHEN `role` = 'super_admin' THEN 'super_admin'
    WHEN `role` = 'admin' THEN 'org_admin'
    WHEN `role` = 'manager' AND `is_management` = true THEN 'faculty_executive'
    WHEN `role` = 'manager' AND `is_management` = false THEN 'unit_head'
    WHEN `role` = 'project_manager' THEN 'project_lead'
    ELSE 'staff'
  END,
  COALESCE(`position`, `management_position`),
  false,
  `is_active`,
  `created_at`,
  `updated_at`
FROM `department_users`
WHERE NOT EXISTS (SELECT 1 FROM `user_affiliations` WHERE `user_affiliations`.`id` = `department_users`.`id`);
--> statement-breakpoint

-- =============================================
-- 6. สร้างตาราง projects
-- =============================================
CREATE TABLE IF NOT EXISTS `projects` (
  `id` int AUTO_INCREMENT NOT NULL,
  `project_name` varchar(500) NOT NULL,
  `org_id` int NOT NULL,
  `fiscal_year` int NOT NULL,
  `status` enum('draft','pending','approved','rejected','in_progress','completed') NOT NULL DEFAULT 'draft',
  `created_by` int,
  `lead_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `projects_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_projects_org` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_projects_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_projects_lead` FOREIGN KEY (`lead_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_projects_org_id` ON `projects`;
--> statement-breakpoint
CREATE INDEX `idx_projects_org_id` ON `projects` (`org_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_projects_status` ON `projects`;
--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_projects_fiscal_year` ON `projects`;
--> statement-breakpoint
CREATE INDEX `idx_projects_fiscal_year` ON `projects` (`fiscal_year`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_projects_lead_user_id` ON `projects`;
--> statement-breakpoint
CREATE INDEX `idx_projects_lead_user_id` ON `projects` (`lead_user_id`);
--> statement-breakpoint

-- =============================================
-- 7. สร้างตาราง project_members
-- =============================================
CREATE TABLE IF NOT EXISTS `project_members` (
  `id` int AUTO_INCREMENT NOT NULL,
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role_in_project` enum('lead','member','viewer') NOT NULL DEFAULT 'member',
  `can_edit` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `project_members_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_project_members_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
DROP INDEX IF EXISTS `uq_project_user` ON `project_members`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_project_user` ON `project_members` (`project_id`, `user_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_project_members_user_id` ON `project_members`;
--> statement-breakpoint
CREATE INDEX `idx_project_members_user_id` ON `project_members` (`user_id`);
--> statement-breakpoint

-- =============================================
-- 8. สร้างตาราง audit_logs
-- =============================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `action` enum('create','read','update','delete') NOT NULL,
  `actor_user_id` int,
  `actor_affiliation_id` int,
  `target_resource` varchar(100) NOT NULL,
  `target_resource_id` varchar(100),
  `details` json,
  `ip_address` varchar(50),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`),
  CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_logs_affiliation` FOREIGN KEY (`actor_affiliation_id`) REFERENCES `user_affiliations`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_audit_logs_actor` ON `audit_logs`;
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor` ON `audit_logs` (`actor_user_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_audit_logs_resource` ON `audit_logs`;
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_resource` ON `audit_logs` (`target_resource`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_audit_logs_created_at` ON `audit_logs`;
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);
--> statement-breakpoint

-- =============================================
-- 9. ลบตารางเดิม (หลังจาก migrate ข้อมูลเสร็จแล้ว)
-- =============================================
DROP TABLE IF EXISTS `department_users`;
--> statement-breakpoint
DROP TABLE IF EXISTS `departments`;
