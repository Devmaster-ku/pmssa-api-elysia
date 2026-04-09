import { db } from "./src/db/index";
import { budgetGroups } from "./src/schema/index";
import { sql } from "drizzle-orm";

async function fixAndTest() {
  try {
    console.log("=== Checking budget_groups table and sequence ===\n");

    // Check the current max id
    const result = await db.execute(sql`SELECT MAX(id) as max_id FROM budget_groups`);
    console.log("Current max ID in budget_groups:", result.rows[0].max_id);

    // Reset the sequence
    console.log("\nResetting sequence to max_id + 1...");
    await db.execute(sql`SELECT setval('budget_groups_id_seq', (SELECT MAX(id) FROM budget_groups) + 1)`);
    console.log("✓ Sequence reset\n");

    // Now try to insert
    console.log("Attempting insert with dynamic name...");
    const testData = {
      budgetTypeId: 1,
      name: "Test Group - " + new Date().getTime(),
    };

    const insertResult = await db
      .insert(budgetGroups)
      .values({
        budgetTypeId: testData.budgetTypeId,
        name: testData.name,
      })
      .returning();

    console.log("✓ Insert successful!\n");
    console.log("Inserted record:");
    console.log(JSON.stringify(insertResult[0], null, 2));

  } catch (error: any) {
    console.error("❌ Error:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    if (error.detail) console.error("Detail:", error.detail);
    console.error("\nFull error:", JSON.stringify(error, null, 2));
  } finally {
    process.exit(0);
  }
}

fixAndTest();
