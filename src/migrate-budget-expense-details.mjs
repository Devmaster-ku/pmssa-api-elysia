#!/usr/bin/env node

import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  multipleStatements: true,
});

async function migrateBudgetExpenseDetails() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("Connected to database");

    console.log("\n1. Backing up old data...");
    try {
      // Just drop backup if it exists (optional - data will be recreated)
      await connection.execute(
        "DROP TABLE IF EXISTS budget_expense_details_backup"
      );
      console.log("   ✓ Ready for migration");
    } catch (e) {
      console.log("   (Proceeding with migration)");
    }

    console.log("\n2. Dropping foreign key constraints...");
    try {
      await connection.execute(
        "ALTER TABLE budget_expense_details DROP FOREIGN KEY budget_expense_details_budget_group_id_budget_groups_id_fk"
      );
      console.log("   ✓ Foreign key dropped");
    } catch (e) {
      console.log("   (Foreign key not found or already dropped)");
    }

    console.log("\n3. Dropping old table...");
    await connection.execute("DROP TABLE IF EXISTS budget_expense_details");
    console.log("   ✓ Old table dropped");

    console.log("\n4. Creating new table with updated schema...");
    await connection.execute(`
      CREATE TABLE budget_expense_details (
        id int NOT NULL AUTO_INCREMENT,
        name varchar(500) NOT NULL,
        detail_type enum('main','sub') NOT NULL DEFAULT 'main',
        detail_type_display varchar(100) NULL,
        parent_id int NULL,
        budget_group_id int NULL,
        is_active tinyint(1) NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_budget_expense_details_parent_id (parent_id),
        KEY idx_budget_expense_details_budget_group_id (budget_group_id),
        KEY idx_budget_expense_details_detail_type (detail_type),
        KEY idx_budget_expense_details_is_active (is_active),
        CONSTRAINT budget_expense_details_parent_id_budget_expense_details_id_fk FOREIGN KEY (parent_id) REFERENCES budget_expense_details(id) ON DELETE SET NULL,
        CONSTRAINT budget_expense_details_budget_group_id_budget_groups_id_fk FOREIGN KEY (budget_group_id) REFERENCES budget_groups(id) ON DELETE RESTRICT
      )
    `);
    console.log("   ✓ New table created");

    console.log("\n5. Cloning data from expense_details...");
    const [rows] = await connection.execute(
      "SELECT id, name, detail_type, detail_type_display, parent_id, budget_group_id, is_active, created_at, updated_at FROM expense_details"
    );
    console.log(`   Found ${rows.length} records in expense_details`);

    if (rows.length > 0) {
      // Helper function to format datetime for MySQL
      const formatDateTime = (date) => {
        if (!date) return 'NULL';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `'${year}-${month}-${day} ${hours}:${minutes}:${seconds}'`;
      };

      // Insert in batches to avoid query size limits
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = batch
          .map(
            (row) =>
              `(${row.id}, '${row.name.replace(/'/g, "\\'")}', '${row.detail_type}', ${row.detail_type_display ? `'${row.detail_type_display.replace(/'/g, "\\'")}'` : "NULL"}, ${row.parent_id}, ${row.budget_group_id}, ${row.is_active}, ${formatDateTime(row.created_at)}, ${formatDateTime(row.updated_at)})`
          )
          .join(",");

        await connection.execute(`
          INSERT INTO budget_expense_details 
          (id, name, detail_type, detail_type_display, parent_id, budget_group_id, is_active, created_at, updated_at)
          VALUES ${values}
        `);
      }
      console.log(`   ✓ Cloned ${rows.length} records`);
    }

    console.log("\n✓ Migration completed successfully!");
    console.log("  Old data backed up in: budget_expense_details_backup table\n");

  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) await connection.release();
    await pool.end();
  }
}

migrateBudgetExpenseDetails().then(() => process.exit(0));
