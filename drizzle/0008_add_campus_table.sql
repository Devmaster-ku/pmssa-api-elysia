-- Migration: 0008_add_campus_table
-- สร้างตาราง campus และ seed ข้อมูลวิทยาเขต

CREATE TABLE `campus` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name_th` varchar(255) NOT NULL,
  `name_en` varchar(255),
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `campus_id` PRIMARY KEY(`id`)
);

-- Seed ข้อมูลวิทยาเขตมหาวิทยาลัยเกษตรศาสตร์
INSERT INTO `campus` (`name_th`, `name_en`, `is_active`) VALUES
  ('บางเขน', 'Bang Khen', true),
  ('วิทยาเขตกำแพงแสน', 'Kamphaeng Saen Campus', true),
  ('วิทยาเขตเฉลิมพระเกียรติ จังหวัดสกลนคร', 'Chalermphrakiat Sakon Nakhon Province Campus', true),
  ('วิทยาเขตศรีราชา', 'Sriracha Campus', true),
  ('สำนักงานเขตบริหารการเรียนรู้พื้นที่สุพรรณบุรี', 'Suphanburi Educational Administration Zone', true),
  ('สถาบันสมทบ', 'Affiliated Institute', true);
