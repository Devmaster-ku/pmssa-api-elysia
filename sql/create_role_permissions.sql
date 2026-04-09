-- =============================================
-- สร้างตาราง role_permissions สำหรับระบบ Permission Matrix
-- รันใน MySQL เพื่อสร้างตารางใหม่โดยไม่กระทบตารางเดิม
-- =============================================

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id`               INT           NOT NULL AUTO_INCREMENT,
  `role`             ENUM(
                       'super_admin', 'univ_executive', 'univ_officer',
                       'campus_executive', 'campus_officer', 'faculty_executive',
                       'unit_head', 'org_admin', 'project_lead', 'staff'
                     ) NOT NULL,
  `permission_code`  VARCHAR(100)  NOT NULL,
  `granted`          BOOLEAN       NOT NULL DEFAULT FALSE,
  `updated_by`       INT           NULL,
  `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_permission_code` (`role`, `permission_code`),
  INDEX `idx_role_permissions_role` (`role`),
  INDEX `idx_role_permissions_code` (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
