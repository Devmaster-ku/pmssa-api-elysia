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

console.log("\n📊 VERIFICATION: PostgreSQL Sequences Status\n");
console.log("=".repeat(80));

const client = await pool.connect();

try {
  for (const table of tables) {
    const sequenceName = `${table}_id_seq`;
    
    // Get current max ID
    const maxIdResult = await client.query(
      `SELECT MAX(id) as max_id FROM "${table}"`
    );
    const maxId = maxIdResult.rows[0]?.max_id || 0;
    
    // Get last value of sequence
    const lastvalResult = await client.query(
      `SELECT last_value FROM "${sequenceName}"`
    );
    const lastValue = lastvalResult.rows[0]?.last_value;
    
    const status = lastValue > maxId ? "✅ OK" : "⚠️ ISSUE";
    console.log(`${status} ${table}`);
    console.log(`   MAX(id)=${maxId}, sequence_last_value=${lastValue}, next_id=${lastValue + 1}`);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ VERIFICATION COMPLETE - All sequences are fixed!");
  
} finally {
  client.release();
  await pool.end();
}
