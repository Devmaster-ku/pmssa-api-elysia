-- Migration: 0013_add_unit_type_to_budget_usages
-- เพิ่มคอลัมน์ unit_type ใน project_budget_usages สำหรับ sub-items ของค่าใช้จ่ายประเภทกำหนดเอง

ALTER TABLE project_budget_usages
  ADD COLUMN IF NOT EXISTS unit_type VARCHAR(50);
