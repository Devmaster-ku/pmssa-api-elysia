const mysql = require('mysql2/promise');
const http = require('http');

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
    
    // Test the query directly
    console.log('\n🔍 Testing direct database query:');
    const [data] = await conn.execute(
      'SELECT id, title, type, is_active, is_pinned FROM announcements WHERE is_active = true ORDER BY is_pinned DESC, created_at DESC'
    );
    console.log(`✓ Query successful, returned ${data.length} rows`);
    
    console.log('\n✅ announcements table is working correctly!');
    console.log(`✓ Table exists and is queryable`);
    console.log(`✓ Can query with WHERE clause`);
    console.log(`✓ Can order by multiple columns`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    pool.end();
    process.exit(0);
  }
})();
