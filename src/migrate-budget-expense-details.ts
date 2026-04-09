import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

/**
 * Directly migrate budget_expense_details table structure
 * and clone data from expense_details
 */
async function migrateBudgetExpenseDetails() {
  try {
    console.log("Starting budget_expense_details migration...");

    // Backup old data
    console.log("1. Backing up old data...");
    await db.execute(
      sql`CREATE TABLE budget_expense_details_backup LIKE budget_expense_details`
    );
    await db.execute(
      sql`INSERT INTO budget_expense_details_backup SELECT * FROM budget_expense_details`
    );
    console.log("   ✓ Backup created");

    // Drop foreign key constraint
    console.log("2. Dropping foreign key constraints...");
    try {
      await db.execute(
        sql`ALTER TABLE budget_expense_details DROP FOREIGN KEY budget_expense_details_budget_group_id_budget_groups_id_fk`
      );
    } catch (e) {
      console.log("   (Foreign key not found or already dropped)");
    }

    // Drop table
    console.log("3. Dropping old table...");
    await db.execute(sql`DROP TABLE IF EXISTS budget_expense_details`);
    console.log("   ✓ Old table dropped");

    // Create new table with new schema
    console.log("4. Creating new table with updated schema...");
    await db.execute(sql`
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

    // Get all data from expense_details
    console.log("5. Cloning data from expense_details...");
    const allExpenseDetails = await db.query.expenseDetails.findMany();
    console.log(`   Found ${allExpenseDetails.length} records in expense_details`);

    if (allExpenseDetails.length > 0) {
      // Insert data into new table
      await db.execute(sql`
        INSERT INTO budget_expense_details 
        (id, name, detail_type, detail_type_display, parent_id, budget_group_id, is_active, created_at, updated_at)
        VALUES
        ${sql.join(
          allExpenseDetails.map(
            (item) =>
              sql`(${item.id}, ${item.name}, ${item.detailType}, ${item.detailTypeDisplay}, ${item.parentId}, ${item.budgetGroupId}, ${item.isActive ? 1 : 0}, ${item.createdAt}, ${item.updatedAt})`
          ),
          sql`, `
        )}
      `);
      console.log(`   ✓ Cloned ${allExpenseDetails.length} records`);
    }

    console.log("\n✓ Migration completed successfully!");
    console.log("  Backup available in: budget_expense_details_backup table");

  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

migrateBudgetExpenseDetails().then(() => process.exit(0));
