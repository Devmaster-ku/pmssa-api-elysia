/**
 * migrate-projects.ts
 * Migrate ตาราง projects, project_details, project_targets, project_detail_sdgs
 * ให้สอดคล้องกับ projects.json และ project-details.json
 *
 * Usage: bun run src/migrate-projects.ts
 */

import { Client } from "pg";

// ─── Phase 1: ALTER TYPE ADD VALUE ─────────────────────────────────────────────
// ต้องรัน OUTSIDE transaction เท่านั้น (PostgreSQL requirement)
const ENUM_ALTER_STATEMENTS: { label: string; sql: string }[] = [
  {
    label: "project_status ← add 'active'",
    sql: `ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'active'`,
  },
  {
    label: "project_status ← add 'pending_approval'",
    sql: `ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'pending_approval'`,
  },
];

// ─── Phase 2: DDL inside transaction ──────────────────────────────────────────
const DDL_STATEMENTS: { label: string; sql: string }[] = [
  // ── 2.1 สร้าง enum types ใหม่ ──────────────────────────────────────────────
  {
    label: "CREATE TYPE project_type",
    sql: `
      DO $$ BEGIN
        CREATE TYPE project_type AS ENUM ('main', 'sub');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },
  {
    label: "CREATE TYPE target_status",
    sql: `
      DO $$ BEGIN
        CREATE TYPE target_status AS ENUM (
          'pending', 'in_progress', 'achieved', 'completed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },

  // ── 2.2 ปรับตาราง projects ─────────────────────────────────────────────────
  {
    label: "projects ← DROP fiscal_year",
    sql: `ALTER TABLE projects DROP COLUMN IF EXISTS fiscal_year`,
  },
  {
    label: "projects ← ADD hierarchy columns",
    sql: `
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS parent_id          integer,
        ADD COLUMN IF NOT EXISTS project_code       varchar(100),
        ADD COLUMN IF NOT EXISTS level              integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS path               varchar(500)`,
  },
  {
    label: "projects ← ADD project_type column",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'project_type'
        ) THEN
          ALTER TABLE projects ADD COLUMN project_type project_type NOT NULL DEFAULT 'main';
        END IF;
      END $$`,
  },
  {
    label: "projects ← ADD year column",
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'year'
        ) THEN
          ALTER TABLE projects ADD COLUMN year varchar(10) NOT NULL DEFAULT '2568';
        END IF;
      END $$`,
  },
  {
    label: "projects ← ADD budget columns",
    sql: `
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS budget_type_id     integer,
        ADD COLUMN IF NOT EXISTS budget_group_id    integer,
        ADD COLUMN IF NOT EXISTS initial_budget     numeric(15,2),
        ADD COLUMN IF NOT EXISTS allocated_budget   numeric(15,2),
        ADD COLUMN IF NOT EXISTS actual_value       numeric(15,2) DEFAULT 0`,
  },
  {
    label: "projects ← ADD document/content columns",
    sql: `
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS recipient          varchar(500),
        ADD COLUMN IF NOT EXISTS document_reference varchar(500),
        ADD COLUMN IF NOT EXISTS document_number    varchar(255),
        ADD COLUMN IF NOT EXISTS document_date      date,
        ADD COLUMN IF NOT EXISTS content            text,
        ADD COLUMN IF NOT EXISTS notes              text`,
  },
  {
    label: "projects ← ADD workflow columns",
    sql: `
      ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS submitted_at       timestamp,
        ADD COLUMN IF NOT EXISTS submitted_by       integer,
        ADD COLUMN IF NOT EXISTS approved_at        timestamp,
        ADD COLUMN IF NOT EXISTS approved_by        integer,
        ADD COLUMN IF NOT EXISTS approval_note      text,
        ADD COLUMN IF NOT EXISTS rejected_at        timestamp,
        ADD COLUMN IF NOT EXISTS rejected_by        integer,
        ADD COLUMN IF NOT EXISTS rejection_reason   text,
        ADD COLUMN IF NOT EXISTS started_at         timestamp,
        ADD COLUMN IF NOT EXISTS started_by         integer,
        ADD COLUMN IF NOT EXISTS deleted_at         timestamp`,
  },

  // ── 2.3 FK constraints สำหรับ projects ────────────────────────────────────
  {
    label: "projects ← FK parent_id → projects(id)",
    sql: `
      DO $$ BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_parent_id_fk
          FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },
  {
    label: "projects ← FK submitted_by → users(id)",
    sql: `
      DO $$ BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_submitted_by_fk
          FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },
  {
    label: "projects ← FK approved_by → users(id)",
    sql: `
      DO $$ BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_approved_by_fk
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },
  {
    label: "projects ← FK rejected_by → users(id)",
    sql: `
      DO $$ BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_rejected_by_fk
          FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },
  {
    label: "projects ← FK started_by → users(id)",
    sql: `
      DO $$ BEGIN
        ALTER TABLE projects ADD CONSTRAINT projects_started_by_fk
          FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$`,
  },

  // ── 2.4 Indexes สำหรับ projects ──────────────────────────────────────────
  {
    label: "INDEX idx_projects_parent_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_projects_parent_id       ON projects (parent_id)`,
  },
  {
    label: "INDEX idx_projects_year",
    sql: `CREATE INDEX IF NOT EXISTS idx_projects_year             ON projects (year)`,
  },
  {
    label: "INDEX idx_projects_project_type",
    sql: `CREATE INDEX IF NOT EXISTS idx_projects_project_type    ON projects (project_type)`,
  },
  {
    label: "INDEX idx_projects_budget_type_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_projects_budget_type_id  ON projects (budget_type_id)`,
  },
  {
    label: "INDEX idx_projects_budget_group_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_projects_budget_group_id ON projects (budget_group_id)`,
  },

  // ── 2.5 CREATE TABLE project_details ────────────────────────────────────────
  {
    label: "CREATE TABLE project_details",
    sql: `
      CREATE TABLE IF NOT EXISTS project_details (
        id                              serial         PRIMARY KEY,
        project_id                      integer        NOT NULL
          REFERENCES projects(id) ON DELETE CASCADE,
        project_manager_id              integer
          REFERENCES users(id) ON DELETE SET NULL,
        department_id                   integer
          REFERENCES organizations(id) ON DELETE SET NULL,

        principles_and_reasons          text,
        objectives                      text,
        target_group                    text,
        project_scope                   text,
        success_criteria                text,
        risk_assessment                 text,

        project_start_date              date,
        project_end_date                date,
        expected_completion_date        date,

        strategy_id                     integer
          REFERENCES strategies(id) ON DELETE SET NULL,

        book_number                     varchar(100),
        date_info                       varchar(255),

        summary_info                    text,
        summary_completed_at            timestamp,
        summary_completed_by            integer
          REFERENCES users(id) ON DELETE SET NULL,

        supporting_document_path_new    varchar(500),
        supporting_document_name_new    varchar(500),
        evaluation_document_path_new    varchar(500),
        evaluation_document_name_new    varchar(500),

        created_at  timestamp NOT NULL DEFAULT NOW(),
        updated_at  timestamp NOT NULL DEFAULT NOW(),
        deleted_at  timestamp
      )`,
  },
  {
    label: "INDEX project_details: project_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_details_project_id         ON project_details (project_id)`,
  },
  {
    label: "INDEX project_details: project_manager_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_details_project_manager_id ON project_details (project_manager_id)`,
  },
  {
    label: "INDEX project_details: department_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_details_department_id      ON project_details (department_id)`,
  },
  {
    label: "INDEX project_details: strategy_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_details_strategy_id        ON project_details (strategy_id)`,
  },

  // ── 2.6 CREATE TABLE project_targets ────────────────────────────────────────
  {
    label: "CREATE TABLE project_targets",
    sql: `
      CREATE TABLE IF NOT EXISTS project_targets (
        id                      serial   PRIMARY KEY,
        project_detail_id       integer  NOT NULL
          REFERENCES project_details(id) ON DELETE CASCADE,

        target_description      text,
        order_number            integer,
        target_status           target_status DEFAULT 'pending',

        target_value            numeric(15,2),
        actual_value            numeric(15,2),
        measurement_unit        varchar(100),
        completion_percentage   numeric(5,2) DEFAULT 0,

        target_start_date       date,
        target_end_date         date,
        actual_completion_date  date,

        target_criteria         text,
        achievement_notes       text,
        challenges              text,
        lessons_learned         text,

        responsible_user_id     integer
          REFERENCES users(id) ON DELETE SET NULL,

        created_at  timestamp NOT NULL DEFAULT NOW(),
        updated_at  timestamp NOT NULL DEFAULT NOW(),
        deleted_at  timestamp
      )`,
  },
  {
    label: "INDEX project_targets: project_detail_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_targets_project_detail_id  ON project_targets (project_detail_id)`,
  },
  {
    label: "INDEX project_targets: target_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_targets_target_status       ON project_targets (target_status)`,
  },
  {
    label: "INDEX project_targets: responsible_user_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_targets_responsible_user_id ON project_targets (responsible_user_id)`,
  },

  // ── 2.7 CREATE TABLE project_detail_sdgs ────────────────────────────────────
  {
    label: "CREATE TABLE project_detail_sdgs",
    sql: `
      CREATE TABLE IF NOT EXISTS project_detail_sdgs (
        id                serial   PRIMARY KEY,
        project_detail_id integer  NOT NULL
          REFERENCES project_details(id) ON DELETE CASCADE,
        sdg_id            integer  NOT NULL
          REFERENCES sdgs(id) ON DELETE CASCADE,
        created_at        timestamp NOT NULL DEFAULT NOW(),
        updated_at        timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_project_detail_sdg UNIQUE (project_detail_id, sdg_id)
      )`,
  },
  {
    label: "INDEX project_detail_sdgs: project_detail_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_detail_sdgs_project_detail_id ON project_detail_sdgs (project_detail_id)`,
  },
  {
    label: "INDEX project_detail_sdgs: sdg_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_detail_sdgs_sdg_id            ON project_detail_sdgs (sdg_id)`,
  },
];

// ─── helpers ────────────────────────────────────────────────────────────────
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

function ok(label: string) {
  process.stdout.write(`  ${GREEN}✓${RESET} ${label}\n`);
}
function skip(label: string, reason: string) {
  process.stdout.write(`  ${YELLOW}⊘${RESET} ${label} — ${YELLOW}${reason}${RESET}\n`);
}
function fail(label: string, err: any) {
  process.stdout.write(`  ${RED}✗${RESET} ${label}\n`);
  process.stdout.write(`    ${RED}${String(err?.message ?? err).split("\n")[0]}${RESET}\n`);
}

// ─── main ────────────────────────────────────────────────────────────────────
async function migrate() {
  const client = new Client({
    host:     process.env.DATABASE_HOST     ?? "127.0.0.1",
    port:     Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME     ?? "ku_pmssa_db",
    user:     process.env.DATABASE_USER     ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "",
  });

  console.log(`\n${BOLD}${CYAN}▶ migrate-projects${RESET}`);
  console.log(`  Host: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);
  console.log(`  DB  : ${process.env.DATABASE_NAME}\n`);

  await client.connect();

  let phase1Errors = 0;
  let phase2Errors = 0;

  // ── Phase 1: ALTER TYPE ADD VALUE (ต้องรันนอก transaction) ──────────────────
  console.log(`${BOLD}Phase 1 — Enum updates (outside transaction)${RESET}`);
  for (const stmt of ENUM_ALTER_STATEMENTS) {
    try {
      await client.query(stmt.sql);
      ok(stmt.label);
    } catch (err: any) {
      // "invalid input value for enum" → value already added by a previous run
      if (err.message?.includes("already exists")) {
        skip(stmt.label, "already exists");
      } else {
        fail(stmt.label, err);
        phase1Errors++;
      }
    }
  }

  if (phase1Errors > 0) {
    console.log(`\n${RED}✗ Phase 1 มี ${phase1Errors} error — หยุดการ migrate${RESET}\n`);
    await client.end();
    process.exit(1);
  }

  // ── Phase 2: DDL inside single transaction ────────────────────────────────
  console.log(`\n${BOLD}Phase 2 — DDL (inside transaction)${RESET}`);
  await client.query("BEGIN");
  try {
    for (const stmt of DDL_STATEMENTS) {
      try {
        await client.query(stmt.sql);
        ok(stmt.label);
      } catch (err: any) {
        fail(stmt.label, err);
        phase2Errors++;
        throw err; // rollback
      }
    }
    await client.query("COMMIT");
  } catch (_) {
    await client.query("ROLLBACK");
    console.log(`\n${RED}✗ ROLLBACK — transaction ถูก rollback แล้ว${RESET}\n`);
    await client.end();
    process.exit(1);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${GREEN}✅ migrate-projects เสร็จสมบูรณ์${RESET}`);
  console.log(`   ตาราง: projects (updated), project_details, project_targets, project_detail_sdgs\n`);

  await client.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(`\n${RED}✗ Fatal:${RESET}`, err);
  process.exit(1);
});
