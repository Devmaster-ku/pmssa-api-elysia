const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

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
    
    // Get an existing user to create a valid token
    const [users] = await conn.execute('SELECT id, username, role FROM users LIMIT 1');
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      process.exit(1);
    }
    
    const user = users[0];
    console.log(`\n✓ Found user: ${user.username} (role: ${user.role})`);
    
    // Create a valid JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'ku-pms-super-secret-jwt-key-2026-change-in-production',
      { expiresIn: '1h' }
    );
    
    console.log(`✓ Generated JWT token\n`);
    
    // Test the announcements endpoint
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/maintenance/announcements',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📊 API Response:');
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body:`, JSON.parse(data));
        
        if (res.statusCode === 200) {
          console.log('\n✅ API is working correctly!');
        } else {
          console.log('\n⚠️ API returned non-200 status');
        }
        
        process.exit(0);
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error.message);
      process.exit(1);
    });
    
    req.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    if (pool) pool.end();
  }
})();
