const mysql = require('mysql2/promise');

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
    
    console.log('\n📊 Checking announcements table structure:');
    const [cols] = await conn.execute('DESCRIBE announcements');
    cols.forEach(col => {
      console.log(`  • ${col.Field}: ${col.Type} (Null: ${col.Null}, Default: ${col.Default})`);
    });
    
    console.log('\n📈 Data in announcements table:');
    const [data] = await conn.execute('SELECT COUNT(*) as cnt FROM announcements');
    console.log(`  ✓ Total records: ${data[0].cnt}`);
    
    // Try the problematic query
    console.log('\n🔍 Testing query: SELECT * FROM announcements WHERE is_active = true');
    try {
      const [result] = await conn.execute('SELECT id, title, is_active, is_pinned FROM announcements WHERE is_active = true ORDER BY is_pinned DESC, created_at DESC');
      console.log(`  ✓ Query successful, returned ${result.length} rows`);
      if (result.length > 0) {
        console.log(`  First row:`, result[0]);
      }
    } catch (e) {
      console.log(`  ✗ Query failed:`, e.message);
    }
    
    conn.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    pool.end();
  }
})();
