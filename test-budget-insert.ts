import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function testInsert() {
  try {
    console.log('=== Testing Budget Groups Insert ===\n');
    
    // Check if budgetTypeId 1 exists
    console.log('1. Checking if budgetTypeId 1 exists in budget_types table...');
    const budgetTypeQuery = await pool.query(
      'SELECT id, name FROM budget_types WHERE id = ',
      [1]
    );
    
    if (budgetTypeQuery.rows.length === 0) {
      console.log('❌ ERROR: budgetTypeId 1 does NOT exist in budget_types table\n');
      console.log('Available budget_types:');
      const allTypes = await pool.query('SELECT id, name FROM budget_types ORDER BY id');
      console.log(allTypes.rows);
    } else {
      console.log('✓ Found: budgetTypeId 1 -', budgetTypeQuery.rows[0].name, '\n');
      
      // Try to insert into budget_groups
      console.log('2. Attempting to insert test row into budget_groups table...');
      const insertQuery = await pool.query(
        'INSERT INTO budget_groups (budget_type_id, name) VALUES (, ) RETURNING *',
        [1, 'Test Group']
      );
      
      console.log('✓ Insert successful!\n');
      console.log('Inserted record:');
      console.log(JSON.stringify(insertQuery.rows[0], null, 2));
    }
    
  } catch (error: any) {
    console.error('❌ Full Error Details:');
    console.error('  Error Code:', error.code);
    console.error('  Error Message:', error.message);
    console.error('  SQL State:', error.sqlState);
    console.error('  Detail:', error.detail);
    console.error('  Full Error:', JSON.stringify(error, null, 2));
  } finally {
    await pool.end();
  }
}

testInsert();
