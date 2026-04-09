import { db } from "./db";
import { budgetSupports, budgetSubsidies } from "./schema";

/**
 * Clone data from budget_supports to budget_subsidies
 * Maps: id, name→nameTh, isActive, createdAt, updatedAt
 * Generates: code from id (String), nameEn=null, createdBy/updatedBy=null
 */
async function cloneBudgetSupportsToBudgetSubsidies() {
  try {
    console.log("Starting data clone from budget_supports to budget_subsidies...");

    // Get all data from budget_supports
    const allBudgetSupports = await db.select().from(budgetSupports);
    console.log(`Found ${allBudgetSupports.length} records in budget_supports`);

    if (allBudgetSupports.length === 0) {
      console.log("No data to clone");
      return;
    }

    // Prepare data for insertion (map budget_supports to budget_subsidies)
    const dataToInsert = allBudgetSupports.map((item) => ({
      id: item.id,
      code: String(item.id),
      nameTh: item.name,
      nameEn: null,
      isActive: item.isActive,
      createdBy: null,
      updatedBy: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Insert into budget_subsidies
    await db.insert(budgetSubsidies).values(dataToInsert);
    console.log(`Successfully cloned ${dataToInsert.length} records to budget_subsidies`);

    // Verify the clone
    const clonedData = await db.select().from(budgetSubsidies);
    console.log(`Verification: budget_subsidies now has ${clonedData.length} records`);

  } catch (error) {
    console.error("Error cloning data:", error);
    process.exit(1);
  }
}

cloneBudgetSupportsToBudgetSubsidies().then(() => {
  console.log("✓ Data clone completed successfully");
  process.exit(0);
});
