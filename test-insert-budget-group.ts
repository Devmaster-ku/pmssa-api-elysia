import { db } from "./src/db/index";
import { budgetGroups } from "./src/schema/index";

async function testBudgetGroupInsert() {
  try {
    console.log("=== Testing Budget Group Insert with Drizzle ORM ===\n");

    // Frontend sends this exact data
    const testData = {
      budgetTypeId: 1,
      name: "Test Group",
    };

    console.log("Attempting to insert:", JSON.stringify(testData, null, 2));
    console.log("\n");

    // Attempt the insert using Drizzle ORM
    const result = await db
      .insert(budgetGroups)
      .values({
        budgetTypeId: testData.budgetTypeId,
        name: testData.name,
      })
      .returning();

    console.log("✓ Insert successful!\n");
    console.log("Inserted record:");
    console.log(JSON.stringify(result[0], null, 2));

  } catch (error: any) {
    console.error("❌ FULL ERROR DETAILS:\n");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Error Name:", error.name);
    if (error.detail) console.error("Detail:", error.detail);
    if (error.hint) console.error("Hint:", error.hint);
    console.error("\nFull Error Object:");
    console.error(JSON.stringify(error, null, 2));
  } finally {
    process.exit(0);
  }
}

testBudgetGroupInsert();
