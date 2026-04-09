import { db } from "./db";
import { expenseDetails, budgetExpenseDetails } from "./schema";

/**
 * Clone data from expense_details to budget_expense_details
 * Maps all fields except department_id (which doesn't exist in budget_expense_details)
 */
async function cloneExpenseDetailsToBudgetExpenseDetails() {
  try {
    console.log("Starting data clone from expense_details to budget_expense_details...");

    // Get all data from expense_details
    const allExpenseDetails = await db.select().from(expenseDetails);
    console.log(`Found ${allExpenseDetails.length} records in expense_details`);

    if (allExpenseDetails.length === 0) {
      console.log("No data to clone");
      return;
    }

    // Prepare data for insertion (map expense_details to budget_expense_details)
    const dataToInsert = allExpenseDetails.map((item) => ({
      id: item.id,
      name: item.name,
      detailType: item.detailType,
      detailTypeDisplay: item.detailTypeDisplay,
      parentId: item.parentId,
      budgetGroupId: item.budgetGroupId,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    // Insert into budget_expense_details
    await db.insert(budgetExpenseDetails).values(dataToInsert);
    console.log(`Successfully cloned ${dataToInsert.length} records to budget_expense_details`);

    // Verify the clone
    const clonedData = await db.select().from(budgetExpenseDetails);
    console.log(`Verification: budget_expense_details now has ${clonedData.length} records`);

  } catch (error) {
    console.error("Error cloning data:", error);
    process.exit(1);
  }
}

cloneExpenseDetailsToBudgetExpenseDetails().then(() => {
  console.log("✓ Data clone completed successfully");
  process.exit(0);
});
