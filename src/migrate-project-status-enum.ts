/**
 * migrate-project-status-enum.ts
 * อัปเดต project_status enum ให้ตรงกับ STATUSES ที่กำหนด:
 *   draft | pending_approval | approved | rejected | active | completed | cancelled
 *
 * ลบออก : pending, in_progress, closed
 * เพิ่ม  : cancelled
 * เปลี่ยน label: completed = ปิดโครงการ
 *
 * Usage: bun run src/migrate-project-status-enum.ts
 */

import { Client } from "pg";

const client = new Client({
  host:     process.env.DATABASE_HOST     ?? "127.0.0.1",
  port:     Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME     ?? "ku_pmssa_db",
  user:     process.env.DATABASE_USER     ?? "postgres",
  password: process.env.DATABASE_PASSWORD ?? "",
});

async function run() {
  await client.connect();
  console.log("Connected to database");

  try {
    await client.query("BEGIN");

    // ── 1. Map สถานะเก่าที่จะถูกลบ → สถานะที่ถูกต้อง ──────────────────────────
    const mappings: { from: string; to: string }[] = [
      { from: "pending",     to: "pending_approval" },
      { from: "in_progress", to: "active" },
      { from: "closed",      to: "completed" },
    ];

    for (const { from, to } of mappings) {
      const res = await client.query(
        `UPDATE projects SET status = $1::text::project_status
         WHERE status::text = $2`,
        [to, from]
      );
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  Remapped '${from}' → '${to}' (${res.rowCount} rows)`);
      }
    }

    // ── 2. สร้าง enum ใหม่ ────────────────────────────────────────────────────
    await client.query(`
      CREATE TYPE project_status_new AS ENUM (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'active',
        'completed',
        'cancelled'
      )
    `);
    console.log("  Created project_status_new enum");

    // ── 3. Drop default ก่อน (Postgres ต้องการ) แล้วค่อย alter type ──────────
    await client.query(`ALTER TABLE projects ALTER COLUMN status DROP DEFAULT`);
    await client.query(`
      ALTER TABLE projects
        ALTER COLUMN status TYPE project_status_new
        USING status::text::project_status_new
    `);
    console.log("  Altered projects.status column to project_status_new");

    // ── 4. ลบ enum เก่า และเปลี่ยนชื่อ enum ใหม่ ─────────────────────────────
    await client.query(`DROP TYPE project_status`);
    await client.query(`ALTER TYPE project_status_new RENAME TO project_status`);
    console.log("  Replaced project_status enum");

    // ── 5. Restore default ────────────────────────────────────────────────────
    await client.query(`ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'draft'::project_status`);
    console.log("  Restored DEFAULT 'draft' on projects.status");

    await client.query("COMMIT");
    console.log("\nMigration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nMigration failed — rolled back.");
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
