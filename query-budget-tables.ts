import { db } from "./src/db";
import { budgetTypes, budgetSubsidies } from "./src/schema";
import { sql } from "drizzle-orm";

async function queryBudgetTables() {
  try {
    console.log("=== DATABASE QUERY RESULTS ===\n");

    // 1. Count budget_types
    console.log("1. Count of records in budget_types table:");
    const budgetTypesCount = await db
      .select({ count: sql`count(*)` })
      .from(budgetTypes);
    console.log(`   Total: ${budgetTypesCount[0].count}\n`);

    // 2. First 5 records from budget_types
    console.log("2. First 5 records from budget_types (id, name):");
    const budgetTypesSample = await db
      .select({ id: budgetTypes.id, name: budgetTypes.name })
      .from(budgetTypes)
      .limit(5);
    console.log(budgetTypesSample);
    console.log("");

    // 3. Count budget_subsidies
    console.log("3. Count of records in budget_subsidies table:");
    const budgetSubsidiesCount = await db
      .select({ count: sql`count(*)` })
      .from(budgetSubsidies);
    console.log(`   Total: ${budgetSubsidiesCount[0].count}\n`);

    // 4. First 5 records from budget_subsidies
    console.log("4. First 5 records from budget_subsidies (id, name_th):");
    const budgetSubsidiesSample = await db
      .select({ id: budgetSubsidies.id, nameTh: budgetSubsidies.nameTh })
      .from(budgetSubsidies)
      .limit(5);
    console.log(budgetSubsidiesSample);
    console.log("");

    console.log("=== QUERY COMPLETE ===");
    process.exit(0);
  } catch (error) {
    console.error("Error querying database:", error);
    process.exit(1);
  }
}

queryBudgetTables();
