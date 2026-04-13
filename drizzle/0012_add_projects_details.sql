-- Migration: 0012_add_projects_details
-- ปรับ projects table ให้สอดคล้องกับ projects.json
-- เพิ่มตาราง project_details, project_targets, project_detail_sdgs

-- ============================================
-- 1. เพิ่ม enum types ใหม่
-- ============================================
DO $$ BEGIN
  CREATE TYPE project_type AS ENUM ('main', 'sub');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE target_status AS ENUM ('pending', 'in_progress', 'achieved', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- เพิ่มค่าใหม่ใน project_status enum (ต้องทำนอก transaction)
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'active';

-- ============================================
-- 2. อัปเดตตาราง projects
-- ============================================

-- ลบ fiscal_year ออก (ใช้ year แทน)
ALTER TABLE projects DROP COLUMN IF EXISTS fiscal_year;

-- เพิ่มคอลัมน์ใหม่
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS parent_id         integer,
  ADD COLUMN IF NOT EXISTS project_code      varchar(100),
  ADD COLUMN IF NOT EXISTS project_type      project_type NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS level             integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS path              varchar(500),
  ADD COLUMN IF NOT EXISTS year              varchar(10) NOT NULL DEFAULT '2568',
  ADD COLUMN IF NOT EXISTS budget_type_id    integer,
  ADD COLUMN IF NOT EXISTS budget_group_id   integer,
  ADD COLUMN IF NOT EXISTS initial_budget    numeric(15,2),
  ADD COLUMN IF NOT EXISTS allocated_budget  numeric(15,2),
  ADD COLUMN IF NOT EXISTS actual_value      numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipient         varchar(500),
  ADD COLUMN IF NOT EXISTS document_reference varchar(500),
  ADD COLUMN IF NOT EXISTS document_number   varchar(255),
  ADD COLUMN IF NOT EXISTS document_date     date,
  ADD COLUMN IF NOT EXISTS content           text,
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS submitted_at      timestamp,
  ADD COLUMN IF NOT EXISTS submitted_by      integer,
  ADD COLUMN IF NOT EXISTS approved_at       timestamp,
  ADD COLUMN IF NOT EXISTS approved_by       integer,
  ADD COLUMN IF NOT EXISTS approval_note     text,
  ADD COLUMN IF NOT EXISTS rejected_at       timestamp,
  ADD COLUMN IF NOT EXISTS rejected_by       integer,
  ADD COLUMN IF NOT EXISTS rejection_reason  text,
  ADD COLUMN IF NOT EXISTS started_at        timestamp,
  ADD COLUMN IF NOT EXISTS started_by        integer,
  ADD COLUMN IF NOT EXISTS deleted_at        timestamp;

-- เพิ่ม FK constraints สำหรับคอลัมน์ใหม่
ALTER TABLE projects
  ADD CONSTRAINT projects_parent_id_fk
    FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD CONSTRAINT projects_submitted_by_fk
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD CONSTRAINT projects_approved_by_fk
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD CONSTRAINT projects_rejected_by_fk
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD CONSTRAINT projects_started_by_fk
    FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL;

-- เพิ่ม indexes
CREATE INDEX IF NOT EXISTS idx_projects_parent_id      ON projects (parent_id);
CREATE INDEX IF NOT EXISTS idx_projects_year           ON projects (year);
CREATE INDEX IF NOT EXISTS idx_projects_project_type   ON projects (project_type);
CREATE INDEX IF NOT EXISTS idx_projects_budget_type_id ON projects (budget_type_id);
CREATE INDEX IF NOT EXISTS idx_projects_budget_group_id ON projects (budget_group_id);

-- ============================================
-- 3. สร้างตาราง project_details
-- ============================================
CREATE TABLE IF NOT EXISTS project_details (
  id                              serial PRIMARY KEY,
  project_id                      integer NOT NULL
    REFERENCES projects(id) ON DELETE CASCADE,
  project_manager_id              integer
    REFERENCES users(id) ON DELETE SET NULL,
  department_id                   integer
    REFERENCES organizations(id) ON DELETE SET NULL,

  -- เนื้อหาโครงการ
  principles_and_reasons          text,
  objectives                      text,
  target_group                    text,
  project_scope                   text,
  success_criteria                text,
  risk_assessment                 text,

  -- กำหนดการ
  project_start_date              date,
  project_end_date                date,
  expected_completion_date        date,

  -- ยุทธศาสตร์ที่เชื่อมโยง
  strategy_id                     integer
    REFERENCES strategies(id) ON DELETE SET NULL,

  -- เอกสาร
  book_number                     varchar(100),
  date_info                       varchar(255),

  -- สรุปผลการดำเนินงาน
  summary_info                    text,
  summary_completed_at            timestamp,
  summary_completed_by            integer
    REFERENCES users(id) ON DELETE SET NULL,

  -- ไฟล์แนบ
  supporting_document_path_new    varchar(500),
  supporting_document_name_new    varchar(500),
  evaluation_document_path_new    varchar(500),
  evaluation_document_name_new    varchar(500),

  created_at  timestamp NOT NULL DEFAULT NOW(),
  updated_at  timestamp NOT NULL DEFAULT NOW(),
  deleted_at  timestamp
);

CREATE INDEX IF NOT EXISTS idx_project_details_project_id        ON project_details (project_id);
CREATE INDEX IF NOT EXISTS idx_project_details_project_manager_id ON project_details (project_manager_id);
CREATE INDEX IF NOT EXISTS idx_project_details_department_id     ON project_details (department_id);
CREATE INDEX IF NOT EXISTS idx_project_details_strategy_id       ON project_details (strategy_id);

-- ============================================
-- 4. สร้างตาราง project_targets
-- ============================================
CREATE TABLE IF NOT EXISTS project_targets (
  id                    serial PRIMARY KEY,
  project_detail_id     integer NOT NULL
    REFERENCES project_details(id) ON DELETE CASCADE,

  target_description    text,
  order_number          integer,
  target_status         target_status DEFAULT 'pending',

  target_value          numeric(15,2),
  actual_value          numeric(15,2),
  measurement_unit      varchar(100),
  completion_percentage numeric(5,2) DEFAULT 0,

  target_start_date     date,
  target_end_date       date,
  actual_completion_date date,

  target_criteria       text,
  achievement_notes     text,
  challenges            text,
  lessons_learned       text,

  responsible_user_id   integer
    REFERENCES users(id) ON DELETE SET NULL,

  created_at  timestamp NOT NULL DEFAULT NOW(),
  updated_at  timestamp NOT NULL DEFAULT NOW(),
  deleted_at  timestamp
);

CREATE INDEX IF NOT EXISTS idx_project_targets_project_detail_id   ON project_targets (project_detail_id);
CREATE INDEX IF NOT EXISTS idx_project_targets_target_status        ON project_targets (target_status);
CREATE INDEX IF NOT EXISTS idx_project_targets_responsible_user_id  ON project_targets (responsible_user_id);

-- ============================================
-- 5. สร้างตาราง project_detail_sdgs (junction)
-- ============================================
CREATE TABLE IF NOT EXISTS project_detail_sdgs (
  id                serial PRIMARY KEY,
  project_detail_id integer NOT NULL
    REFERENCES project_details(id) ON DELETE CASCADE,
  sdg_id            integer NOT NULL
    REFERENCES sdgs(id) ON DELETE CASCADE,
  created_at        timestamp NOT NULL DEFAULT NOW(),
  updated_at        timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_detail_sdg UNIQUE (project_detail_id, sdg_id)
);

CREATE INDEX IF NOT EXISTS idx_project_detail_sdgs_project_detail_id ON project_detail_sdgs (project_detail_id);
CREATE INDEX IF NOT EXISTS idx_project_detail_sdgs_sdg_id            ON project_detail_sdgs (sdg_id);
