-- Migration: Add sub_dep_id column to user_affiliations
-- เพิ่มคอลัมน์ sub_dep_id (หน่วยงานย่อย) หลัง org_id

ALTER TABLE `user_affiliations`
  ADD COLUMN `sub_dep_id` int NULL AFTER `org_id`,
  ADD CONSTRAINT `fk_affiliations_sub_dep` FOREIGN KEY (`sub_dep_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL;

CREATE INDEX `idx_affiliations_sub_dep_id` ON `user_affiliations` (`sub_dep_id`);
