const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 3306,
  database: process.env.DATABASE_NAME || 'ku_pms_db',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || 'P@55w0rd'
});

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    
    // Get all tables in database
    const [tables] = await conn.execute("SHOW TABLES");
    const existingTables = tables.map(t => Object.values(t)[0]).sort();
    
    console.log('\n📊 Current tables in database:');
    existingTables.forEach(t => console.log(`  ✓ ${t}`));
    
    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    pool.end();
    process.exit(0);
  }
})();
