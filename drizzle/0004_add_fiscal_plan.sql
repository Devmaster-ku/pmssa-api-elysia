-- Migration: Add fiscal_plan column to strategies and strategic_departments tables
-- Date: 2025-10-20
-- Description: Add fiscal_plan column to support fiscal year tracking

ALTER TABLE `strategies` ADD COLUMN `fiscal_plan` varchar(20);
--> statement-breakpoint
ALTER TABLE `strategic_departments` ADD COLUMN `fiscal_plan` varchar(20);
