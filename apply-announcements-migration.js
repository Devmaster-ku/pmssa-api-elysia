const mysql = require('mysql2/promise');
const fs = require('fs');

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT) || 3306,
  database: process.env.DATABASE_NAME || 'ku_pms_db',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || 'P@55w0rd',
  multipleStatements: true
});

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    
    console.log('\n🔨 Creating announcements table...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS \`announcements\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`title\` varchar(500) NOT NULL,
        \`content\` text NOT NULL,
        \`type\` enum('info','warning','success','danger') NOT NULL DEFAULT 'info',
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`is_pinned\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_by\` int,
        \`updated_by\` int,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_announcements_is_active\` (\`is_active\`),
        KEY \`idx_announcements_created_at\` (\`created_at\`),
        CONSTRAINT \`announcements_created_by_users_id_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`announcements_updated_by_users_id_fk\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      )
    `;
    
    await conn.execute(sql);
    console.log('✅ Announcements table created successfully');
    
    // Verify it was created
    const [tables] = await conn.execute('SHOW TABLES LIKE "announcements"');
    if (tables.length > 0) {
      console.log('\n✓ Table exists in database');
      const [cols] = await conn.execute('DESCRIBE announcements');
      console.log('\n📋 Table structure:');
      cols.forEach(col => {
        console.log(`  • ${col.Field}: ${col.Type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    pool.end();
  }
})();
