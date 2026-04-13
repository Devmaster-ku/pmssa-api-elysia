/**
 * Safe migration script — สร้าง 6 ตารางใหม่สำหรับ "การดำเนินโครงการ"
 * ไม่กระทบตารางเดิมใดๆ — ใช้ CREATE TABLE IF NOT EXISTS + CREATE TYPE IF NOT EXISTS
 *
 * วิธีรัน: cd backend && bun run src/migrate-implementation.ts
 */
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("🔧 Creating enums (IF NOT EXISTS)...");

    // ── 1. Enum types ───────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE funding_group AS ENUM ('main', 'supplement', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE work_plan_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE budget_expense_type AS ENUM ('main', 'sub', 'custom');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    console.log("✅ Enums ready");

    // ── 2. Tables ───────────────────────────────────────
    console.log("🔧 Creating project_implementations...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_implementations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        past_performance TEXT,
        risk_management TEXT,
        start_date DATE,
        end_date DATE,
        project_location TEXT,
        province VARCHAR(255),
        evaluation_method TEXT,
        expected_outcome TEXT,
        current_step INTEGER DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_implementations_project_id ON project_implementations(project_id);`);

    console.log("🔧 Creating project_operators...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_operators (
        id SERIAL PRIMARY KEY,
        implementation_id INTEGER NOT NULL REFERENCES project_implementations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        operator_name VARCHAR(500),
        responsibility TEXT,
        order_number INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_operators_impl_id ON project_operators(implementation_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_operators_user_id ON project_operators(user_id);`);

    console.log("🔧 Creating project_funding_sources...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_funding_sources (
        id SERIAL PRIMARY KEY,
        implementation_id INTEGER NOT NULL REFERENCES project_implementations(id) ON DELETE CASCADE,
        funding_group funding_group DEFAULT 'main',
        funding_name VARCHAR(500),
        amount NUMERIC(15,2) DEFAULT 0,
        funding_type VARCHAR(255),
        order_number INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_funding_sources_impl_id ON project_funding_sources(implementation_id);`);

    console.log("🔧 Creating project_work_plans...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_work_plans (
        id SERIAL PRIMARY KEY,
        implementation_id INTEGER NOT NULL REFERENCES project_implementations(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        responsible_person VARCHAR(500),
        status work_plan_status DEFAULT 'pending',
        order_number INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_work_plans_impl_id ON project_work_plans(implementation_id);`);

    console.log("🔧 Creating project_budget_usages...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_budget_usages (
        id SERIAL PRIMARY KEY,
        implementation_id INTEGER NOT NULL REFERENCES project_implementations(id) ON DELETE CASCADE,
        parent_id INTEGER,
        expense_type budget_expense_type DEFAULT 'main',
        expense_detail_id INTEGER,
        expense_name VARCHAR(500),
        amount NUMERIC(15,2) DEFAULT 0,
        calculation_method VARCHAR(255),
        necessity_reason TEXT,
        remark TEXT,
        personnel_count INTEGER,
        order_number INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_budget_usages_impl_id ON project_budget_usages(implementation_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_budget_usages_parent_id ON project_budget_usages(parent_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_budget_usages_expense_type ON project_budget_usages(expense_type);`);

    console.log("🔧 Creating project_signatories...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_signatories (
        id SERIAL PRIMARY KEY,
        implementation_id INTEGER NOT NULL REFERENCES project_implementations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        signatory_name VARCHAR(500),
        position_title VARCHAR(500),
        sign_order INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_signatories_impl_id ON project_signatories(implementation_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_signatories_user_id ON project_signatories(user_id);`);

    await client.query("COMMIT");
    console.log("\n🎉 Migration complete! 6 tables created successfully.");
    console.log("   - project_implementations");
    console.log("   - project_operators");
    console.log("   - project_funding_sources");
    console.log("   - project_work_plans");
    console.log("   - project_budget_usages");
    console.log("   - project_signatories");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed, rolled back:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
