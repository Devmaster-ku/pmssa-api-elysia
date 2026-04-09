-- ============================================
-- สร้าง 4 Budget Tables โดยตรง (ปลอดภัย)
-- ใช้ CREATE TABLE IF NOT EXISTS เพื่อป้องกันข้อผิดพลาด
-- ============================================

-- 1. budget_supports
CREATE TABLE IF NOT EXISTS `budget_supports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `department_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_supports_department_id` (`department_id`),
  KEY `idx_budget_supports_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. budget_types (FK -> budget_supports)
CREATE TABLE IF NOT EXISTS `budget_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(500) NOT NULL,
  `budget_category` varchar(100) DEFAULT NULL,
  `budget_category_display` varchar(255) DEFAULT NULL,
  `budget_support_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_types_budget_support_id` (`budget_support_id`),
  KEY `idx_budget_types_department_id` (`department_id`),
  KEY `idx_budget_types_is_active` (`is_active`),
  CONSTRAINT `budget_types_budget_support_id_fk`
    FOREIGN KEY (`budget_support_id`) REFERENCES `budget_supports` (`id`)
    ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. budget_groups (FK -> budget_types)
CREATE TABLE IF NOT EXISTS `budget_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(500) NOT NULL,
  `group_type` varchar(100) DEFAULT NULL,
  `group_type_display` varchar(500) DEFAULT NULL,
  `budget_type_id` int NOT NULL,
  `department_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_groups_budget_type_id` (`budget_type_id`),
  KEY `idx_budget_groups_department_id` (`department_id`),
  KEY `idx_budget_groups_is_active` (`is_active`),
  CONSTRAINT `budget_groups_budget_type_id_fk`
    FOREIGN KEY (`budget_type_id`) REFERENCES `budget_types` (`id`)
    ON DELETE RESTRICT ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. expense_details (FK -> budget_groups nullable, self-ref parent_id)
CREATE TABLE IF NOT EXISTS `expense_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(500) NOT NULL,
  `detail_type` enum('main','sub') NOT NULL DEFAULT 'main',
  `detail_type_display` varchar(100) DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `budget_group_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expense_details_parent_id` (`parent_id`),
  KEY `idx_expense_details_budget_group_id` (`budget_group_id`),
  KEY `idx_expense_details_department_id` (`department_id`),
  KEY `idx_expense_details_detail_type` (`detail_type`),
  KEY `idx_expense_details_is_active` (`is_active`),
  CONSTRAINT `expense_details_parent_id_fk`
    FOREIGN KEY (`parent_id`) REFERENCES `expense_details` (`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `expense_details_budget_group_id_fk`
    FOREIGN KEY (`budget_group_id`) REFERENCES `budget_groups` (`id`)
    ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ตรวจสอบผลลัพธ์
-- ============================================
SHOW TABLES LIKE 'budget_%';
SHOW TABLES LIKE 'expense_%';
