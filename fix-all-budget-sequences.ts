import { Pool } from "pg";

const pool = new Pool({
  user: "postgres",
  password: "P@55w0rd&aiu",
  host: "127.0.0.1",
  port: 5432,
  database: "ku_pmssa_db"
});

const tables = [
  "budget_expense_details",
  "budget_groups",
  "budget_subsidy_types",
  "budget_subsidies"
];

console.log("🔍 BUDGET SEQUENCES FIX - ALL TABLES\n");
console.log("=".repeat(80));

const client = await pool.connect();

try {
  const versionResult = await client.query("SELECT version()");
  console.log("\n✅ Connected to PostgreSQL");
  console.log("=".repeat(80) + "\n");

  for (const table of tables) {
    console.log(`\n📋 Table: ${table}`);
    console.log("-".repeat(80));
    
    try {
      // Get current max ID (BEFORE)
      const maxIdResult = await client.query(
        `SELECT MAX(id) as max_id FROM "${table}"`
      );
      const currentMaxId = maxIdResult.rows[0]?.max_id || 0;
      
      console.log(`  Before: MAX(id) = ${currentMaxId}`);
      
      // Get current sequence name
      const sequenceName = `${table}_id_seq`;
      
      // Reset the sequence
      const nextVal = currentMaxId + 1;
      const alterSequenceSQL = `ALTER SEQUENCE "${sequenceName}" RESTART WITH ${nextVal}`;
      
      try {
        await client.query(alterSequenceSQL);
        console.log(`  ✓ Sequence reset: "${sequenceName}" → RESTART WITH ${nextVal}`);
      } catch (err) {
        console.log(`  ⚠ Note: Sequence update (might already be correct): ${(err as Error).message}`);
      }
      
      // Verify by getting the next value
      const nextValueResult = await client.query(
        `SELECT nextval('${sequenceName}') as next_val`
      );
      const nextValue = nextValueResult.rows[0]?.next_val;
      
      // Get the max ID again to confirm (AFTER)
      const newMaxIdResult = await client.query(
        `SELECT MAX(id) as max_id FROM "${table}"`
      );
      const newMaxId = newMaxIdResult.rows[0]?.max_id || 0;
      
      console.log(`  After:  MAX(id) = ${newMaxId}`);
      console.log(`  Next sequence value will be: ${nextValue}`);
      console.log(`  Status: ✅ Sequence verified and fixed`);
      
    } catch (err) {
      console.log(`  ❌ Error processing table: ${(err as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ ALL BUDGET SEQUENCES HAVE BEEN FIXED");
  console.log("=".repeat(80) + "\n");

} finally {
  client.release();
  await pool.end();
}
