import { db } from "./db";
import { budgetTypes, budgetSubsidyTypes } from "./schema";

/**
 * Clone data from budget_types to budget_subsidy_types
 * Maps: id, budgetSupportId→subsidyId, name→nameTh, isActive, createdAt, updatedAt
 * Generates: code from id (String), nameEn=null, createdBy/updatedBy=null
 * Discards: budgetCategory, budgetCategoryDisplay, departmentId
 */
async function cloneBudgetTypesToBudgetSubsidyTypes() {
  try {
    console.log("Starting data clone from budget_types to budget_subsidy_types...");

    // Get all data from budget_types
    const allBudgetTypes = await db.select().from(budgetTypes);
    console.log(`Found ${allBudgetTypes.length} records in budget_types`);

    if (allBudgetTypes.length === 0) {
      console.log("No data to clone");
      return;
    }

    // Prepare data for insertion (map budget_types to budget_subsidy_types)
    const dataToInsert = allBudgetTypes.map((item) => ({
      id: item.id,
      subsidyId: item.budgetSupportId,
      code: String(item.id),
      nameTh: item.name,
      nameEn: null,
      isActive: item.isActive,
      createdBy: null,
      updatedBy: null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Insert into budget_subsidy_types
    await db.insert(budgetSubsidyTypes).values(dataToInsert);
    console.log(`Successfully cloned ${dataToInsert.length} records to budget_subsidy_types`);

    // Verify the clone
    const clonedData = await db.select().from(budgetSubsidyTypes);
    console.log(`Verification: budget_subsidy_types now has ${clonedData.length} records`);

  } catch (error) {
    console.error("Error cloning data:", error);
    process.exit(1);
  }
}

cloneBudgetTypesToBudgetSubsidyTypes().then(() => {
  console.log("✓ Data clone completed successfully");
  process.exit(0);
});
