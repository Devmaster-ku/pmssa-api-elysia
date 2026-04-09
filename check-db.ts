import { Pool } from "pg";

const pool = new Pool({
  host: "127.0.0.1",
  port: 5432,
  user: "postgres",
  password: "P@55w0rd&aiu",
  database: "ku_pmssa_db",
});

(async () => {
  try {
    console.log("=== 1. Listing all tables in public schema ===\n");
    const tablesResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name",
      ["public"]
    );

    console.log("Tables in public schema:");
    tablesResult.rows.forEach((row) => console.log(`  - ${row.table_name}`));

    console.log("\n=== 2. Structure of budget_groups table ===\n");
    const structureResult = await pool.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 AND table_schema=$2 ORDER BY ordinal_position",
      ["budget_groups", "public"]
    );

    console.log("Columns in budget_groups:");
    structureResult.rows.forEach((row) => {
      console.log(
        `  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`
      );
    });

    console.log("\n=== 3. Foreign key constraints on budget_groups ===\n");
    const fkResult = await pool.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = $1
        AND tc.table_name = $2
        AND tc.table_schema = $3
      ORDER BY tc.constraint_name
    `, ["FOREIGN KEY", "budget_groups", "public"]);

    if (fkResult.rows.length > 0) {
      console.log("Foreign key constraints:");
      fkResult.rows.forEach((row) => {
        console.log(
          `  - ${row.constraint_name}: ${row.column_name} -> ${row.referenced_table_name}.${row.referenced_column_name}`
        );
      });
    } else {
      console.log("No foreign key constraints found.");
    }

    console.log("\n=== 4. All constraints on budget_groups ===\n");
    const allConstraints = await pool.query(
      "SELECT constraint_type, constraint_name FROM information_schema.table_constraints WHERE table_name=$1 AND table_schema=$2 ORDER BY constraint_type",
      ["budget_groups", "public"]
    );

    console.log("All constraints:");
    allConstraints.rows.forEach((row) => {
      console.log(`  - ${row.constraint_type}: ${row.constraint_name}`);
    });
  } catch (error) {
    console.error("Database error:", error);
  } finally {
    await pool.end();
  }
})();
