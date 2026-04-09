import { db } from "./src/db/index";
import { budgetGroups } from "./src/schema/index";

async function testBudgetGroupInsert() {
  try {
    console.log("=== Testing Budget Group Insert with Drizzle ORM ===\n");

    // Try multiple test cases
    const testCases = [
      { budgetTypeId: 1, name: "Test Group - " + new Date().getTime() },
    ];

    for (const testData of testCases) {
      console.log("Attempting to insert:", JSON.stringify(testData, null, 2));
      console.log("");

      try {
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
        console.log("\n");
      } catch (insertError: any) {
        console.error("❌ Insert failed");
        console.error("Error Code:", insertError.cause?.code);
        console.error("Error Message:", insertError.message);
        if (insertError.cause?.detail) console.error("Detail:", insertError.cause.detail);
        console.error("\n");
      }
    }

  } catch (error: any) {
    console.error("❌ FATAL ERROR:\n");
    console.error("Error Message:", error.message);
    console.error("Full Error Object:");
    console.error(JSON.stringify(error, null, 2));
  } finally {
    process.exit(0);
  }
}

testBudgetGroupInsert();
