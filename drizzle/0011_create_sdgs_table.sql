-- Create sdgs table for Sustainable Development Goals
CREATE TABLE `sdgs` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `code` varchar(50) NOT NULL UNIQUE,
  `name` text NOT NULL,
  `description` text,
  `parent_id` int,
  `display_name` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `sdgs_parent_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `sdgs` (`id`) ON DELETE SET NULL,
  INDEX `idx_sdgs_code` (`code`),
  INDEX `idx_sdgs_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
