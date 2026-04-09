import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 3306,
  database: process.env.DATABASE_NAME || 'ku_pms_db',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || 'P@55w0rd'
});

(async () => {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n📊 Table Structure Verification:');
    const [cols] = await conn.execute('DESCRIBE budget_expense_details');
    cols.forEach(col => {
      console.log(`  • ${col.Field}: ${col.Type}`);
    });
    
    console.log('\n📈 Data Count:');
    const [count] = await conn.execute('SELECT COUNT(*) as cnt FROM budget_expense_details');
    console.log(`  ✓ Total records: ${count[0].cnt}`);
    
    const [samples] = await conn.execute('SELECT id, name, detail_type, budget_group_id FROM budget_expense_details LIMIT 3');
    console.log('\n🔍 Sample Data:');
    samples.forEach(s => {
      console.log(`  ID: ${s.id}, Name: ${s.name}, Type: ${s.detail_type}, Group: ${s.budget_group_id}`);
    });
    
    // Check foreign keys
    console.log('\n🔗 Foreign Key Checks:');
    const [fks] = await conn.execute(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = 'budget_expense_details' AND CONSTRAINT_NAME LIKE '%fk%'
    `);
    fks.forEach(fk => {
      console.log(`  • ${fk.CONSTRAINT_NAME}: ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}(${fk.REFERENCED_COLUMN_NAME})`);
    });
    
    conn.release();
    console.log('\n✅ Migration verification complete!\n');
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    pool.end();
  }
})();
